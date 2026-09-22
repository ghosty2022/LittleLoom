// src/services/ai/PredictorCohort.ts
// ─────────────────────────────────────────────────────────────────────
// Cross-family learning for the PredictorEngine (Holt-Winters).
// Publishes level/trend/seasonal parameters per age cohort, and
// injects them into cold-start babies.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { AgeCohort, ageToCohort, isCollaborativeLearningEnabled } from './CohortPriors';

const PREDICTOR_CACHE_PREFIX = '@littleloom_predictor_cohort_v1:';
export const PREDICTOR_LAST_PUBLISH_KEY = '@littleloom_predictor_last_publish_v1';

export type PredictorKind = 'sleep' | 'feed' | 'diaper' | 'wake' | 'medication';

export interface PredictorCohortPrior {
  kind: PredictorKind;
  ageCohort: AgeCohort;
  level: number;       // baseline inter-event interval (minutes)
  trend: number;       // per-event drift (minutes)
  seasonal: number[];  // 6-slot seasonal decomposition
  sampleCount: number;
  contributorCount: number;
  updatedAt: number;
}

// ─── Fetch cohort predictor prior (24h cache) ──────────────────────

export async function getPredictorCohortPrior(
  kind: PredictorKind,
  cohort: AgeCohort
): Promise<PredictorCohortPrior | null> {
  const cacheKey = `${PREDICTOR_CACHE_PREFIX}${kind}:${cohort}`;
  const dayMs = 24 * 60 * 60 * 1000;

  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as PredictorCohortPrior;
      if (Date.now() - cached.updatedAt < dayMs) return cached;
    }
  } catch {}

  try {
    const { data, error } = await supabase
      .from('ai_predictor_cohorts')
      .select('*')
      .eq('kind', kind)
      .eq('age_cohort', cohort)
      .maybeSingle();

    if (error || !data) return null;

    const prior: PredictorCohortPrior = {
      kind,
      ageCohort: cohort,
      level: Number(data.level),
      trend: Number(data.trend),
      seasonal: Array.isArray(data.seasonal) ? data.seasonal : [],
      sampleCount: Number(data.sample_count),
      contributorCount: Number(data.contributor_count),
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(cacheKey, JSON.stringify(prior));
    return prior;
  } catch {
    return null;
  }
}

// ─── Publish local predictor state to cohort pool ──────────────────

export interface PredictorPublishResult {
  published: number;
  skipped: number;
  reason?: string;
}

export async function publishPredictorToCohort(
  babyId: string,
  birthDateISO: string,
  states: Array<{ kind: PredictorKind; state: any }>,
  options: { minSamples?: number } = {}
): Promise<PredictorPublishResult> {
  const allowed = await isCollaborativeLearningEnabled();
  if (!allowed) {
    return { published: 0, skipped: states.length, reason: 'opt_out' };
  }

  // Respect the per-baby GDPR blocklist
  try {
    const { isCohortContributionBlocked } = await import('./CohortPriors');
    const blocked = await isCohortContributionBlocked(babyId);
    if (blocked) {
      return { published: 0, skipped: states.length, reason: 'gdpr_blocked' };
    }
  } catch {}

  const minSamples = options.minSamples ?? 30;

  // Throttle to once per 12h
  const lastRaw = await AsyncStorage.getItem(PREDICTOR_LAST_PUBLISH_KEY);
  const last = lastRaw ? parseInt(lastRaw, 10) : 0;
  if (Date.now() - last < 12 * 60 * 60 * 1000) {
    return { published: 0, skipped: states.length, reason: 'throttled' };
  }

  const cohort = ageToCohort(birthDateISO);
  let published = 0;
  let skipped = 0;

  for (const { kind, state } of states) {
    try {
      if (!state || state.n < minSamples || !Array.isArray(state.seasonal)) {
        skipped++;
        continue;
      }
      if (!Number.isFinite(state.level) || !Number.isFinite(state.trend)) {
        skipped++;
        continue;
      }

      // Sanity bounds per kind (mirrors PredictorEngine FALLBACK_INTERVALS)
      const fallbacks: Record<PredictorKind, number> = {
        sleep: 180, feed: 150, diaper: 120, wake: 90, medication: 360,
      };
      const fallback = fallbacks[kind];
      if (state.level < fallback * 0.3 || state.level > fallback * 3) {
        skipped++;
        continue;
      }

      const { data: existing } = await supabase
        .from('ai_predictor_cohorts')
        .select('*')
        .eq('kind', kind)
        .eq('age_cohort', cohort)
        .maybeSingle();

      if (existing) {
        // Weighted merge by sample count
        const existingWeight = Number(existing.sample_count) || 1;
        const localWeight = state.n;
        const totalWeight = existingWeight + localWeight;

        const mergedLevel =
          (Number(existing.level) * existingWeight +
            state.level * localWeight) / totalWeight;
        const mergedTrend =
          (Number(existing.trend) * existingWeight +
            state.trend * localWeight) / totalWeight;

        // Seasonal merge: average slot-by-slot, padded to 6
        const existingSeasonal: number[] = Array.isArray(existing.seasonal)
          ? existing.seasonal : [0, 0, 0, 0, 0, 0];
        const localSeasonal: number[] = state.seasonal.slice(0, 6);
        while (localSeasonal.length < 6) localSeasonal.push(0);

        const mergedSeasonal = localSeasonal.map((v, i) => {
          const e = existingSeasonal[i] ?? 0;
          return (
            (e * existingWeight + v * localWeight) / totalWeight
          );
        });

        const { error } = await supabase
          .from('ai_predictor_cohorts')
          .update({
            level: mergedLevel,
            trend: mergedTrend,
            seasonal: mergedSeasonal,
            sample_count: Number(existing.sample_count) + state.n,
            contributor_count: Number(existing.contributor_count) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('kind', kind)
          .eq('age_cohort', cohort);

        if (error) {
          if (__DEV__) console.warn('[PredictorCohort] Update rejected:', error.message);
          const isNetworkError =
            /network|timeout|fetch|connection/i.test(error.message);
          if (isNetworkError) {
            const { enqueueCohortOp } = await import('./CohortOfflineQueue');
            await enqueueCohortOp('ai_predictor_cohorts', {
              kind,
              age_cohort: cohort,
              level: mergedLevel,
              trend: mergedTrend,
              seasonal: mergedSeasonal,
              sample_count: Number(existing.sample_count) + state.n,
              contributor_count: Number(existing.contributor_count) + 1,
              updated_at: new Date().toISOString(),
            });
          }
          skipped++;
          continue;
        }
      } else {
        const seasonal = state.seasonal.slice(0, 6);
        while (seasonal.length < 6) seasonal.push(0);

        const { error } = await supabase
          .from('ai_predictor_cohorts')
          .insert({
            kind,
            age_cohort: cohort,
            level: state.level,
            trend: state.trend,
            seasonal,
            sample_count: state.n,
            contributor_count: 1,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          if (__DEV__) console.warn('[PredictorCohort] Insert rejected:', error.message);
          const isNetworkError =
            /network|timeout|fetch|connection/i.test(error.message);
          if (isNetworkError) {
            const { enqueueCohortOp } = await import('./CohortOfflineQueue');
            await enqueueCohortOp('ai_predictor_cohorts', {
              kind,
              age_cohort: cohort,
              level: state.level,
              trend: state.trend,
              seasonal,
              sample_count: state.n,
              contributor_count: 1,
              updated_at: new Date().toISOString(),
            });
          }
          skipped++;
          continue;
        }
      }

      published++;
    } catch (err) {
      if (__DEV__) console.warn('[PredictorCohort] publish failed for', kind, err);
      skipped++;
    }
  }

  await AsyncStorage.setItem(PREDICTOR_LAST_PUBLISH_KEY, String(Date.now()));
  return { published, skipped };
}