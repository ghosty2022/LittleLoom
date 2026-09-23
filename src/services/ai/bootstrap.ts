// src/services/ai/bootstrap.ts
// ─────────────────────────────────────────────────────────────────────
// Wires every AI engine to the app's lifecycle.
// Call `bootstrapAI(babyId)` once per app launch / baby switch.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { backfillBayesianIfNeeded } from './backfillBayesian';
import { backfillPredictor } from './PredictorEngine';
import { observeValue, extractMetricValue, MetricKey } from './BayesianEngine';
// CohortPriors is dynamically imported to avoid circular dependency
import { featureEngineer } from './FeatureEngineer';

const LAUNCH_FLAG = '@littleloom_ai_bootstrapped_v1';
const LAST_FEATURE_RUN = '@littleloom_last_feature_run_v1';

// Map tracker entries → Bayesian metrics
const TRACKER_TO_METRICS: Record<string, MetricKey[]> = {
  temperature: ['temperature_c'],
  feed: ['feeding_ml', 'feed_interval_min'],
  sleep: ['sleep_duration_min', 'sleep_interval_min'],
  growth: ['weight_kg', 'height_cm', 'head_cm'],
  mood: ['mood_score'],
  heart_rate: ['heart_rate_bpm'],
  blood_oxygen: ['blood_oxygen'],
  diaper: ['diaper_interval_min'],
  potty: ['diaper_interval_min'],
  wake_time: ['wake_window_min'],
};

let bootstrappedFor: string | null = null;
let isRunning = false;

export async function bootstrapAI(babyId: string, force = false): Promise<void> {
  if (!babyId) return;
  if (!force && bootstrappedFor === babyId) return;
  if (isRunning) return;
  isRunning = true;

  try {
    console.log(`[AI Bootstrap] Starting for baby ${babyId}...`);

    // 0a. Flush pending telemetry from prior session
    try {
      const { flushTelemetry } = await import('./Telemetry');
      await flushTelemetry();
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Telemetry flush failed:', e);
    }

    // 0. Flush any pending cohort operations from prior offline sessions
    try {
      const { flushCohortQueue, getCohortQueueSize } = await import(
        './CohortOfflineQueue'
      );
      const size = await getCohortQueueSize();
      if (size > 0) {
        const result = await flushCohortQueue();
        console.log(
          `[AI Bootstrap] Cohort queue flush: ${result.flushed} ok, ` +
          `${result.failed} failed, ${result.dropped} dropped`
        );
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Queue flush failed:', e);
    }

    // 0a. Cache baby meta EARLY so all engines can resolve cohort priors
    //     on the very first launch (critical for cold-start).
    try {
      const metaKey = `@littleloom_baby_meta_v1:${babyId}`;
      const cached = await AsyncStorage.getItem(metaKey);
      if (!cached) {
        const { data: babyRow } = await supabase
          .from('babies')
          .select('date_of_birth, gender')
          .eq('id', babyId)
          .maybeSingle();
        if (babyRow?.date_of_birth) {
          await AsyncStorage.setItem(
            metaKey,
            JSON.stringify({
              birthDate: babyRow.date_of_birth,
              gender: babyRow.gender,
            })
          );
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Early baby meta cache failed:', e);
    }

    // 1. Backfill Bayesian learning (90 days) — idempotent, runs once per baby
    const bayesResult = await backfillBayesianIfNeeded(babyId, 90);
    if (bayesResult.ran) {
      console.log(
        `[AI Bootstrap] Bayesian: ${bayesResult.samples} samples across ${bayesResult.metrics} metrics`
      );
    }

    // 2. Backfill predictor state (30 days) — idempotent
    await Promise.all([
      backfillPredictor(babyId, 'sleep', 30),
      backfillPredictor(babyId, 'feed', 30),
      backfillPredictor(babyId, 'diaper', 30),
    ]);
    console.log('[AI Bootstrap] Predictors backfilled');

    // 3. Feature engineering for today (idempotent)
    const today = new Date();
    await featureEngineer.computeAndStoreFeatures(babyId, today);
    console.log('[AI Bootstrap] Today features stored');

    // (baby meta is cached at step 0a — no duplicate here)
    // 4. On subsequent launches, backfill 7 days of features if stale
    const lastRun = await AsyncStorage.getItem(LAST_FEATURE_RUN);
    const lastRunTs = lastRun ? parseInt(lastRun, 10) : 0;
    const dayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - lastRunTs > dayMs) {
      await featureEngineer.backfillRange(babyId, 7).catch(() => {});
      await AsyncStorage.setItem(LAST_FEATURE_RUN, String(Date.now()));
    }

    // 4a. Check for age-cohort boundary crossing
    try {
      const { checkAndHandleCohortChange } = await import('./CohortPriors');
      const { data: babyRow } = await supabase
        .from('babies')
        .select('date_of_birth')
        .eq('id', babyId)
        .maybeSingle();

      if (babyRow?.date_of_birth) {
        const metricsToCheck: MetricKey[] = [
          'temperature_c', 'feeding_ml', 'feed_interval_min',
          'sleep_duration_min', 'sleep_interval_min', 'diaper_interval_min',
          'weight_kg', 'height_cm', 'head_cm', 'mood_score',
        ];
        const cohortCheck = await checkAndHandleCohortChange(
          babyId,
          babyRow.date_of_birth,
          metricsToCheck
        );
        if (cohortCheck.changed) {
          console.log(
            `[AI Bootstrap] Cohort changed ${cohortCheck.fromCohort} → ${cohortCheck.toCohort}`
          );
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Cohort check failed:', e);
    }

    // 4b. Refresh correlation cache if stale (>24h old)
    try {
      const { getCachedCorrelations, discoverCorrelations } =
        await import('./CorrelationEngine');
      const cached = await getCachedCorrelations(babyId);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      const needsRefresh =
        cached.length === 0 ||
        (cached[0] as any).computed_at < oneDayAgo;

      if (needsRefresh) {
        await discoverCorrelations(babyId, 45);
        console.log('[AI Bootstrap] Correlations refreshed');
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Correlation refresh failed:', e);
    }

    // 4c. Publish predictor states to cohort pool
    try {
      const { publishPredictorToCohort } = await import('./PredictorCohort');
      const { getAllPredictorStates } = await import('./PredictorEngine');
      const { isCollaborativeLearningEnabled } = await import('./CohortPriors');

      if (await isCollaborativeLearningEnabled()) {
        const { data: babyRow } = await supabase
          .from('babies')
          .select('date_of_birth')
          .eq('id', babyId)
          .maybeSingle();

        if (babyRow?.date_of_birth) {
          const states = await getAllPredictorStates(babyId, [
            'sleep', 'feed', 'diaper', 'medication',
          ]);
          const result = await publishPredictorToCohort(
            babyId,
            babyRow.date_of_birth,
            states,
            { minSamples: 30 }
          );
          if (result.published > 0) {
            console.log(
              `[AI Bootstrap] Published ${result.published} predictor states to cohort`
            );
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Predictor cohort publish failed:', e);
    }

    // 5. Publish local posteriors to cohort pool (opt-in, throttled)
    try {
      const { publishToCohort, isCollaborativeLearningEnabled } =
        await import('./CohortPriors');

      if (await isCollaborativeLearningEnabled()) {
        // Need baby's birth date
        const { data: babyRow } = await supabase
          .from('babies')
          .select('date_of_birth')
          .eq('id', babyId)
          .maybeSingle();

        if (babyRow?.date_of_birth) {
          const metricsToPublish: MetricKey[] = [
            'temperature_c',
            'feeding_ml',
            'feed_interval_min',
            'sleep_duration_min',
            'sleep_interval_min',
            'diaper_interval_min',
            'weight_kg',
            'height_cm',
            'head_cm',
            'mood_score',
          ];

          const result = await publishToCohort(
            babyId,
            babyRow.date_of_birth,
            metricsToPublish,
            { minSamples: 30 }
          );

          if (result.published > 0) {
            console.log(
              `[AI Bootstrap] Published ${result.published} metrics to cohort pool ` +
              `(${result.skipped} skipped${result.reason ? `, ${result.reason}` : ''})`
            );
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Cohort publish failed:', e);
    }

    bootstrappedFor = babyId;
    console.log('[AI Bootstrap] ✅ Complete');
  } catch (e) {
    console.error('[AI Bootstrap] Failed:', e);
  } finally {
    isRunning = false;
  }
}

// ─── Live event observer ────────────────────────────────────────────
// Call this AFTER addEntry succeeds, so AI learns in real time.

export async function observeEntry(
  babyId: string,
  trackerId: string,
  data: Record<string, unknown>,
  timestamp: number = Date.now()
): Promise<void> {
  if (!babyId || !trackerId) return;

  const metrics = TRACKER_TO_METRICS[trackerId];
  if (!metrics || metrics.length === 0) return;

  try {
    for (const metric of metrics) {
      const value = extractMetricValue(metric, data);
      if (value !== null && Number.isFinite(value)) {
        await observeValue(babyId, metric, value);
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[AI Bootstrap] observeEntry failed:', e);
  }
}

// ─── Reset everything ───────────────────────────────────────────────

export async function resetAIForBaby(babyId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAUNCH_FLAG);
    await AsyncStorage.removeItem(LAST_FEATURE_RUN);
    // Dynamic imports to avoid circular dependency at module load time
    const { resetLearningForBaby } = await import('./BayesianEngine');
    const { resetPredictor } = await import('./PredictorEngine');
    if (typeof resetLearningForBaby === 'function') {
      await resetLearningForBaby(babyId);
    }
    if (typeof resetPredictor === 'function') {
      await Promise.all([
        resetPredictor(babyId, 'sleep'),
        resetPredictor(babyId, 'feed'),
        resetPredictor(babyId, 'diaper'),
      ]);
    }
    bootstrappedFor = null;
    console.log(`[AI Bootstrap] Reset for baby ${babyId}`);
  } catch (e) {
    console.warn('[AI Bootstrap] resetAIForBaby failed:', e);
  }
}