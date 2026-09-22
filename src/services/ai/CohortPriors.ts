// src/services/ai/CohortPriors.ts
// ─────────────────────────────────────────────────────────────────────
// Cross-family learning: aggregates per-baby posteriors into
// age-cohort priors, then injects them into cold-start babies.
//
// Privacy model:
//   - Only metric names, posterior parameters, and age buckets leave
//     the device. No baby_id, no user_id, no raw values.
//   - Requires explicit opt-in via `@littleloom_ai_collaborative_v1`.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { MetricKey, getLearnedRange } from './BayesianEngine';

const COLLABORATIVE_OPT_IN_KEY = '@littleloom_ai_collaborative_v1';
const COHORT_CACHE_PREFIX = '@littleloom_cohort_prior_v1:';
const LAST_PUBLISH_KEY = '@littleloom_cohort_last_publish_v1';

export type AgeCohort = '0-1mo' | '1-3mo' | '3-6mo' | '6-12mo' | '12-24mo' | '24mo+';

export interface CohortPrior {
  metric: MetricKey;
  ageCohort: AgeCohort;
  mu: number;
  sigma: number;
  lambda: number;
  alpha: number;
  beta: number;
  sampleCount: number;
  contributorCount: number;
  updatedAt: number;
}

// ─── Age cohort helper ──────────────────────────────────────────────

export function ageToCohort(birthDateISO: string): AgeCohort {
  const birth = new Date(birthDateISO);
  const now = new Date();
  if (isNaN(birth.getTime())) return '0-1mo';

  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (months < 1) return '0-1mo';
  if (months < 3) return '1-3mo';
  if (months < 6) return '3-6mo';
  if (months < 12) return '6-12mo';
  if (months < 24) return '12-24mo';
  return '24mo+';
}

// ─── Opt-in gate ────────────────────────────────────────────────────

export async function isCollaborativeLearningEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(COLLABORATIVE_OPT_IN_KEY);
    if (v === null) return false; // default OFF until user opts in
    return v === 'true';
  } catch {
    return false;
  }
}

export async function setCollaborativeLearningEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(COLLABORATIVE_OPT_IN_KEY, enabled ? 'true' : 'false');
}

// ─── Fetch cohort priors (with 24h cache) ───────────────────────────

export async function getCohortPrior(
  metric: MetricKey,
  cohort: AgeCohort
): Promise<CohortPrior | null> {
  const cacheKey = `${COHORT_CACHE_PREFIX}${metric}:${cohort}`;
  const dayMs = 24 * 60 * 60 * 1000;

  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as CohortPrior;
      if (Date.now() - cached.updatedAt < dayMs) return cached;
    }
  } catch {}

  try {
    const { data, error } = await supabase
      .from('ai_cohort_priors')
      .select('*')
      .eq('metric', metric)
      .eq('age_cohort', cohort)
      .maybeSingle();

    if (error || !data) return null;

    const prior: CohortPrior = {
      metric,
      ageCohort: cohort,
      mu: Number(data.mu),
      sigma: Number(data.sigma),
      lambda: Number(data.lambda),
      alpha: Number(data.alpha),
      beta: Number(data.beta),
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

// ─── Publish local posterior into the cohort pool ──────────────────

export interface PublishResult {
  published: number;
  skipped: number;
  reason?: string;
}

export async function publishToCohort(
  babyId: string,
  birthDateISO: string,
  metrics: MetricKey[],
  options: { minSamples?: number } = {}
): Promise<PublishResult> {
  const allowed = await isCollaborativeLearningEnabled();
  if (!allowed) {
    return { published: 0, skipped: metrics.length, reason: 'opt_out' };
  }

  const minSamples = options.minSamples ?? 30;
  const cohort = ageToCohort(birthDateISO);

  // Throttle: publish at most once per 12h per device
  const lastPublishRaw = await AsyncStorage.getItem(LAST_PUBLISH_KEY);
  const lastPublish = lastPublishRaw ? parseInt(lastPublishRaw, 10) : 0;
  if (Date.now() - lastPublish < 12 * 60 * 60 * 1000) {
    return { published: 0, skipped: metrics.length, reason: 'throttled' };
  }

  let published = 0;
  let skipped = 0;

  for (const metric of metrics) {
    try {
      const local = await getLearnedRange(babyId, metric);

      // Don't pollute the pool with under-sampled data
      if (local.samples < minSamples || local.confidence < 0.3) {
        skipped++;
        continue;
      }

      const sigmaSq = local.stddev * local.stddev;

      // Upsert into cohort table with running-average merge
      const { data: existing } = await supabase
        .from('ai_cohort_priors')
        .select('*')
        .eq('metric', metric)
        .eq('age_cohort', cohort)
        .maybeSingle();

      let payload: any;

      if (existing) {
        // Confidence-weighted merge: contributors with more samples dominate
        const existingWeight = Number(existing.sample_count) || 1;
        const localWeight = local.samples;
        const totalWeight = existingWeight + localWeight;

        const mergedMu =
          (Number(existing.mu) * existingWeight + local.mean * localWeight) /
          totalWeight;
        const mergedSigma = Math.sqrt(
          (Number(existing.sigma) ** 2 * existingWeight +
            sigmaSq * localWeight) /
            totalWeight
        );

        payload = {
          mu: mergedMu,
          sigma: mergedSigma,
          lambda: Number(existing.lambda) + local.samples,
          alpha: Number(existing.alpha) + local.samples / 2,
          beta: Number(existing.beta) + (sigmaSq * local.samples) / 2,
          sample_count: Number(existing.sample_count) + local.samples,
          contributor_count: Number(existing.contributor_count) + 1,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('ai_cohort_priors')
          .update(payload)
          .eq('metric', metric)
          .eq('age_cohort', cohort);

        if (error) {
          if (__DEV__) console.warn('[Cohort] Update failed:', error.message);
          skipped++;
          continue;
        }
      } else {
        payload = {
          metric,
          age_cohort: cohort,
          mu: local.mean,
          sigma: local.stddev,
          lambda: local.samples,
          alpha: local.samples / 2 + 1,
          beta: (sigmaSq * local.samples) / 2,
          sample_count: local.samples,
          contributor_count: 1,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('ai_cohort_priors').insert(payload);

        if (error) {
          if (__DEV__) console.warn('[Cohort] Insert failed:', error.message);
          skipped++;
          continue;
        }
      }

      published++;
    } catch (err) {
      if (__DEV__) console.warn('[Cohort] publish failed for', metric, err);
      skipped++;
    }
  }

  await AsyncStorage.setItem(LAST_PUBLISH_KEY, String(Date.now()));
  return { published, skipped };
}

// ─── Inject cohort prior into a cold-start baby ────────────────────
// Returns true if a prior was found and should be used.

export async function tryLoadCohortPrior(
  babyId: string,
  birthDateISO: string,
  metric: MetricKey
): Promise<CohortPrior | null> {
  const cohort = ageToCohort(birthDateISO);
  return getCohortPrior(metric, cohort);
}