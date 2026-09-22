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

    // 4. On subsequent launches, backfill 7 days of features if stale
    const lastRun = await AsyncStorage.getItem(LAST_FEATURE_RUN);
    const lastRunTs = lastRun ? parseInt(lastRun, 10) : 0;
    const dayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - lastRunTs > dayMs) {
      await featureEngineer.backfillRange(babyId, 7).catch(() => {});
      await AsyncStorage.setItem(LAST_FEATURE_RUN, String(Date.now()));
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
    // BayesianEngine & PredictorEngine have their own reset helpers.
    const { resetLearningForBaby } = require('./BayesianEngine');
    const { resetPredictor } = require('./PredictorEngine');
    await resetLearningForBaby(babyId);
    await Promise.all([
      resetPredictor(babyId, 'sleep'),
      resetPredictor(babyId, 'feed'),
      resetPredictor(babyId, 'diaper'),
    ]);
    bootstrappedFor = null;
    console.log(`[AI Bootstrap] Reset for baby ${babyId}`);
  } catch (e) {
    console.warn('[AI Bootstrap] resetAIForBaby failed:', e);
  }
}