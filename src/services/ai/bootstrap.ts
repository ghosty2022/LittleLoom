









import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { AIService } from './AIService';

const LAUNCH_FLAG = '@littleloom_ai_bootstrapped_v1';
const LAST_FEATURE_RUN = '@littleloom_last_feature_run_v1';
const BOOTSTRAPPED_FOR_KEY = '@littleloom_ai_bootstrapped_for_v1';



import type { MetricKey } from './BayesianEngine';

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


export type BootstrapPhase = 'idle' | 'running' | 'done' | 'failed';

export interface BootstrapSnapshot {
  phase: BootstrapPhase;
  babyId: string | null;
  startedAt?: number;
  finishedAt?: number;
}

type BootstrapListener = (snap: BootstrapSnapshot) => void;

let currentSnapshot: BootstrapSnapshot = {
  phase: 'idle',
  babyId: null,
};

const bootstrapListeners = new Set<BootstrapListener>();

function emitBootstrap(patch: Partial<BootstrapSnapshot>) {
  currentSnapshot = { ...currentSnapshot, ...patch };
  for (const fn of bootstrapListeners) {
    try {
      fn(currentSnapshot);
    } catch {
      /* listener error — never crash the bootstrap */
    }
  }
}

export function getBootstrapSnapshot(): BootstrapSnapshot {
  return currentSnapshot;
}

export function subscribeBootstrap(fn: BootstrapListener): () => void {
  bootstrapListeners.add(fn);
  fn(currentSnapshot);
  return () => {
    bootstrapListeners.delete(fn);
  };
}


let bootstrappedFor: string | null = null;
let isRunning = false;
let runningBabyId: string | null = null;


async function cacheBabyMetaEarly(babyId: string): Promise<void> {
  try {
    const metaKey = `@littleloom_baby_meta_v1:${babyId}`;
    const cached = await AsyncStorage.getItem(metaKey);
    if (cached) return;

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
  } catch (e) {
    if (__DEV__) {
      console.warn('[AI Bootstrap] Early baby meta cache failed:', e);
    }
  }
}


async function resolveBootstrappedFor(): Promise<string | null> {
  if (bootstrappedFor !== null) return bootstrappedFor;
  try {
    const v = await AsyncStorage.getItem(BOOTSTRAPPED_FOR_KEY);
    bootstrappedFor = v || null;
  } catch {
    bootstrappedFor = null;
  }
  return bootstrappedFor;
}



export async function bootstrapAI(
  babyId: string,
  force = false
): Promise<void> {
  if (!babyId) return;

  
  const persisted = await resolveBootstrappedFor();
  if (!force && persisted === babyId && bootstrappedFor === babyId) {
    
    
    if (currentSnapshot.phase === 'idle') {
      emitBootstrap({
        phase: 'done',
        babyId,
        finishedAt: Date.now(),
      });
    }
    return;
  }

  
  if (isRunning && runningBabyId !== babyId) {
    if (__DEV__) {
      console.log(
        '[AI Bootstrap] Already running for different baby, skipping'
      );
    }
    return;
  }
  if (isRunning) return;

  isRunning = true;
  runningBabyId = babyId;
  emitBootstrap({
    phase: 'running',
    babyId,
    startedAt: Date.now(),
    finishedAt: undefined,
  });

  
  const aborted = () => runningBabyId !== babyId;

  try {
    console.log(`[AI Bootstrap] Starting for baby ${babyId}...`);

    
    try {
      const snap = await AIService.init();
      if (snap.status === 'unavailable') {
        if (__DEV__) {
          console.warn(
            '[AI Bootstrap] AI runtime unavailable — continuing with ' +
              'fallback statistical engines only'
          );
        }
      } else if (__DEV__) {
        console.log(
          `[AI Bootstrap] AI runtime ready (aiKit=${snap.packages.aiKit}, ` +
            `executorch=${snap.packages.executorch}, ` +
            `smartAi=${snap.packages.smartAi}, ` +
            `vision=${snap.packages.visionModel})`
        );
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] AIService.init failed:', e);
    }

    if (aborted()) return;

    
    try {
      const { flushTelemetry } = await import('./Telemetry');
      await flushTelemetry();
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Telemetry flush failed:', e);
    }

    if (aborted()) return;

    
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

    
    await cacheBabyMetaEarly(babyId);

    if (aborted()) return;

    
    try {
      const { backfillBayesianIfNeeded } = await import('./backfillBayesian');
      const bayesResult = await backfillBayesianIfNeeded(babyId, 90);
      if (bayesResult.ran) {
        console.log(
          `[AI Bootstrap] Bayesian: ${bayesResult.samples} samples across ` +
            `${bayesResult.metrics} metrics`
        );
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Bayesian backfill failed:', e);
    }

    if (aborted()) return;

    
    try {
      const { backfillPredictor } = await import('./PredictorEngine');
      await Promise.all([
        backfillPredictor(babyId, 'sleep', 30),
        backfillPredictor(babyId, 'feed', 30),
        backfillPredictor(babyId, 'diaper', 30),
      ]);
      console.log('[AI Bootstrap] Predictors backfilled');
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Predictor backfill failed:', e);
    }

    if (aborted()) return;

    
    try {
      const { featureEngineer } = await import('./FeatureEngineer');
      const today = new Date();
      await featureEngineer.computeAndStoreFeatures(babyId, today);
      console.log('[AI Bootstrap] Today features stored');
    } catch (e) {
      if (__DEV__) {
        console.warn('[AI Bootstrap] Feature engineering failed:', e);
      }
    }

    if (aborted()) return;

    
    try {
      const lastRun = await AsyncStorage.getItem(LAST_FEATURE_RUN);
      const lastRunTs = lastRun ? parseInt(lastRun, 10) : 0;
      const dayMs = 24 * 60 * 60 * 1000;

      if (Date.now() - lastRunTs > dayMs) {
        const { featureEngineer } = await import('./FeatureEngineer');
        await featureEngineer.backfillRange(babyId, 7).catch(() => {});
        await AsyncStorage.setItem(LAST_FEATURE_RUN, String(Date.now()));
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Feature backfill failed:', e);
    }

    if (aborted()) return;

    
    try {
      const { checkAndHandleCohortChange } = await import('./CohortPriors');
      const { data: babyRow } = await supabase
        .from('babies')
        .select('date_of_birth')
        .eq('id', babyId)
        .maybeSingle();

      if (babyRow?.date_of_birth) {
        const metricsToCheck: MetricKey[] = [
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
        const cohortCheck = await checkAndHandleCohortChange(
          babyId,
          babyRow.date_of_birth,
          metricsToCheck
        );
        if (cohortCheck.changed) {
          console.log(
            `[AI Bootstrap] Cohort changed ${cohortCheck.fromCohort} → ` +
              `${cohortCheck.toCohort}`
          );
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Cohort check failed:', e);
    }

    if (aborted()) return;

    
    try {
      const { getCachedCorrelations, discoverCorrelations } = await import(
        './CorrelationEngine'
      );
      const cached = await getCachedCorrelations(babyId);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      const needsRefresh =
        cached.length === 0 || (cached[0] as any).computed_at < oneDayAgo;

      if (needsRefresh) {
        await discoverCorrelations(babyId, 45);
        console.log('[AI Bootstrap] Correlations refreshed');
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[AI Bootstrap] Correlation refresh failed:', e);
      }
    }

    if (aborted()) return;

    
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
            'sleep',
            'feed',
            'diaper',
            'medication',
          ]);
          const result = await publishPredictorToCohort(
            babyId,
            babyRow.date_of_birth,
            states,
            { minSamples: 30 }
          );
          if (result.published > 0) {
            console.log(
              `[AI Bootstrap] Published ${result.published} predictor states ` +
                `to cohort`
            );
          }
        }
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[AI Bootstrap] Predictor cohort publish failed:', e);
      }
    }

    if (aborted()) return;

    
    try {
      const { publishToCohort, isCollaborativeLearningEnabled } =
        await import('./CohortPriors');

      if (await isCollaborativeLearningEnabled()) {
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
              `[AI Bootstrap] Published ${result.published} metrics to cohort ` +
                `pool (${result.skipped} skipped${
                  result.reason ? `, ${result.reason}` : ''
                })`
            );
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[AI Bootstrap] Cohort publish failed:', e);
    }

    
    bootstrappedFor = babyId;
    await AsyncStorage.setItem(BOOTSTRAPPED_FOR_KEY, babyId);
    console.log('[AI Bootstrap] ✅ Complete');
    emitBootstrap({
      phase: 'done',
      babyId,
      finishedAt: Date.now(),
    });
  } catch (e) {
    console.error('[AI Bootstrap] Failed:', e);
    emitBootstrap({
      phase: 'failed',
      babyId,
      finishedAt: Date.now(),
    });
  } finally {
    isRunning = false;
    runningBabyId = null;
  }
}




export async function observeEntry(
  babyId: string,
  trackerId: string,
  data: Record<string, unknown>,
  timestamp: number = Date.now()
): Promise<void> {
  if (!babyId || !trackerId) return;
  if (!data || typeof data !== 'object') return;

  const metrics = TRACKER_TO_METRICS[trackerId];
  if (!metrics || metrics.length === 0) return;

  try {
    
    const { observeValue, extractMetricValue } = await import(
      './BayesianEngine'
    );

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



export async function resetAIForBaby(babyId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      LAUNCH_FLAG,
      LAST_FEATURE_RUN,
      BOOTSTRAPPED_FOR_KEY,
    ]);

    const [{ resetLearningForBaby }, { resetPredictor }] = await Promise.all([
      import('./BayesianEngine'),
      import('./PredictorEngine'),
    ]);

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
    emitBootstrap({ phase: 'idle', babyId: null });
    console.log(`[AI Bootstrap] Reset for baby ${babyId}`);
  } catch (e) {
    console.warn('[AI Bootstrap] resetAIForBaby failed:', e);
  }
}