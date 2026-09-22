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

  // GDPR blocklist check
  try {
    const v = await AsyncStorage.getItem(`${GDPR_BLOCKLIST_KEY}${babyId}`);
    if (v === 'true') {
      return { published: 0, skipped: metrics.length, reason: 'gdpr_blocked' };
    }
  } catch {}

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
          if (__DEV__) console.warn('[Cohort] Update rejected:', error.message);
          // Distinguish network errors (retryable) from trigger rejections
          const isNetworkError =
            /network|timeout|fetch|connection/i.test(error.message);
          if (isNetworkError) {
            const { enqueueCohortOp } = await import('./CohortOfflineQueue');
            await enqueueCohortOp('ai_cohort_priors', {
              ...payload,
              metric,
              age_cohort: cohort,
            });
          }
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
          if (__DEV__) console.warn('[Cohort] Insert rejected:', error.message);
          const isNetworkError =
            /network|timeout|fetch|connection/i.test(error.message);
          if (isNetworkError) {
            const { enqueueCohortOp } = await import('./CohortOfflineQueue');
            await enqueueCohortOp('ai_cohort_priors', payload);
          }
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

// ─── Age-cohort re-bucketing ────────────────────────────────────────
// Called from bootstrap.ts. Detects when a baby has crossed an age
// bucket boundary (e.g., 6mo → 12mo) and clears stale local caches.

const LAST_COHORT_KEY = '@littleloom_last_cohort_v1:';

export interface CohortCheckResult {
  changed: boolean;
  fromCohort: AgeCohort | null;
  toCohort: AgeCohort;
  clearedCaches: string[];
}

export async function checkAndHandleCohortChange(
  babyId: string,
  birthDateISO: string,
  metrics: MetricKey[]
): Promise<CohortCheckResult> {
  const currentCohort = ageToCohort(birthDateISO);
  const storageKey = `${LAST_COHORT_KEY}${babyId}`;

  let lastCohort: AgeCohort | null = null;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    lastCohort = (raw as AgeCohort) || null;
  } catch {}

  // First run: just record current cohort, nothing to clear
  if (lastCohort === null) {
    await AsyncStorage.setItem(storageKey, currentCohort);
    return {
      changed: false,
      fromCohort: null,
      toCohort: currentCohort,
      clearedCaches: [],
    };
  }

  // No change
  if (lastCohort === currentCohort) {
    return {
      changed: false,
      fromCohort: lastCohort,
      toCohort: currentCohort,
      clearedCaches: [],
    };
  }

  // Cohort changed — clear cached cohort priors for this baby
  const clearedCaches: string[] = [];
  for (const metric of metrics) {
    // Clear old cohort's cached prior
    const oldKey = `${COHORT_CACHE_PREFIX}${metric}:${lastCohort}`;
    const newKey = `${COHORT_CACHE_PREFIX}${metric}:${currentCohort}`;
    try {
      await AsyncStorage.removeItem(oldKey);
      clearedCaches.push(oldKey);
      await AsyncStorage.removeItem(newKey); // force fresh fetch
      clearedCaches.push(newKey);
    } catch {}
  }

  // Also clear local Bayesian memory cache so priors get re-loaded
  try {
    const { resetLocalCacheForBaby } = await import('./BayesianEngine');
    if (typeof resetLocalCacheForBaby === 'function') {
      await resetLocalCacheForBaby(babyId);
    }
  } catch {}

  await AsyncStorage.setItem(storageKey, currentCohort);

  if (__DEV__) {
    console.log(
      `[Cohort] Re-bucketed ${babyId}: ${lastCohort} → ${currentCohort} ` +
      `(cleared ${clearedCaches.length} caches)`
    );
  }

  return {
    changed: true,
    fromCohort: lastCohort,
    toCohort: currentCohort,
    clearedCaches,
  };
}
// ─── GDPR: Delete all cohort contributions for a baby ──────────────
// NOTE: Because cohort priors are aggregated without baby_id, we
// cannot surgically remove one baby's contribution from an already-
// merged posterior. What we CAN do:
//   1. Delete the local device's cached cohort data.
//   2. Delete this device's auth-scoped rows from ai_cohort_write_log.
//   3. Mark the baby as "do not contribute" in app_settings.
//   4. Log a GDPR erasure event for audit trail.
//
// The aggregate itself is irreversible — this is documented in the
// privacy policy and matches the standard approach used by federated
// learning systems.

const GDPR_BLOCKLIST_KEY = '@littleloom_cohort_do_not_contribute_v1:';

export async function deleteCohortContributions(
  babyId: string,
  userId: string
): Promise<{ success: boolean; message: string; clearedCaches: number }> {
  const clearedCaches: string[] = [];

  try {
    // 1. Clear all local cohort caches
    const keys = await AsyncStorage.getAllKeys();
    const cohortKeys = keys.filter(
      k =>
        k.startsWith(COHORT_CACHE_PREFIX) ||
        k.startsWith('@littleloom_predictor_cohort_v1:') ||
        k.startsWith(LAST_PUBLISH_KEY) ||
        k.startsWith('@littleloom_predictor_last_publish_v1')
    );
    if (cohortKeys.length > 0) {
      await AsyncStorage.multiRemove(cohortKeys);
      clearedCaches.push(...cohortKeys);
    }

    // 2. Delete this user's cohort write log rows (auth-scoped)
    await supabase
      .from('ai_cohort_write_log')
      .delete()
      .eq('user_id', userId);

    // 3. Blocklist this baby from future contributions
    await AsyncStorage.setItem(`${GDPR_BLOCKLIST_KEY}${babyId}`, 'true');

    // 4. Audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'gdpr_cohort_erasure',
        resource_type: 'ai_cohort_priors',
        resource_id: babyId,
        details: {
          cleared_caches: clearedCaches.length,
          timestamp: new Date().toISOString(),
          note: 'Aggregate priors are irreversible; local caches and future contributions removed.',
        },
      });
    } catch {}

    if (__DEV__) {
      console.log(
        `[Cohort] GDPR erasure for ${babyId}: cleared ${clearedCaches.length} caches`
      );
    }

    return {
      success: true,
      message:
        'Your local cohort caches and future contributions have been removed. ' +
        'Note: previously-aggregated priors cannot be reversed as they contain no identifying data.',
      clearedCaches: clearedCaches.length,
    };
  } catch (e) {
    return {
      success: false,
      message: `GDPR erasure failed: ${e}`,
      clearedCaches: clearedCaches.length,
    };
  }
}

// ─── Check whether a baby is blocked from contributing ─────────────

export async function isCohortContributionBlocked(
  babyId: string
): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(`${GDPR_BLOCKLIST_KEY}${babyId}`);
    return v === 'true';
  } catch {
    return false;
  }
}