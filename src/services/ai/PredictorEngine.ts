// src/services/ai/PredictorEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Time-series prediction for sleep, feed, and diaper events.
//
// Method: Holt-Winters triple exponential smoothing, adapted for
// irregular event streams. We model INTER-EVENT INTERVALS (minutes
// between events) rather than absolute timestamps — that's what
// actually varies with age, feeding schedule, and routine.
//
// FIXES in this version:
//   ✓ `.gte('timestamp', ISO)` — PostgREST requires timestamptz strings,
//     not raw ms numbers. Was causing "date/time field value out of range".
//   ✓ Normalize `row.timestamp` (string | Date | number) to epoch ms
//     before arithmetic. Previously `curr - prev` produced NaN when
//     Supabase returned ISO strings, so backfill silently produced 0
//     intervals and the predictor stayed at the fallback state.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { getCurrentUserId as getCanonicalUserId } from '@/database/dbHelpers';

// ─── Types ──────────────────────────────────────────────────────────

export type PredictorType = 'sleep' | 'feed' | 'diaper' | 'wake' | 'medication';

export interface HoltWintersParams {
  alpha: number;
  beta: number;
  gamma: number;
  seasonLength: number;
}

export interface PredictorState {
  babyId: string;
  type: PredictorType;
  n: number;
  level: number;
  trend: number;
  seasonal: number[];
  variance: number;
  lastInterval: number;
  lastObservedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface Prediction {
  type: PredictorType;
  predictedAt: number;
  predictedInterval: number;
  confidence: number;
  earliest: number;
  latest: number;
  label: string;
  minutesUntil: number;
}

// ─── Defaults ────────────────────────────────────────────────────────

const DEFAULT_PARAMS: HoltWintersParams = {
  alpha: 0.35,
  beta: 0.10,
  gamma: 0.20,
  seasonLength: 6,
};

const FALLBACK_INTERVALS: Record<PredictorType, number> = {
  sleep: 180,
  feed: 150,
  diaper: 120,
  wake: 90,
  medication: 360,
};

const STORAGE_PREFIX = '@littleloom_predictor_v1:';
const storageKey = (babyId: string, type: PredictorType) =>
  `${STORAGE_PREFIX}${babyId}:${type}`;

const SUPABASE_PREFIX = 'predictor:';
const supabaseKey = (babyId: string, type: PredictorType) =>
  `${SUPABASE_PREFIX}${babyId}:${type}`;

const memCache = new Map<string, PredictorState>();

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Normalize any timestamp representation to epoch milliseconds.
 * Supabase returns timestamptz as an ISO string; the predictor works
 * in ms numbers, so every read must go through this.
 */
function toMs(ts: unknown): number {
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    // Heuristic: values below ~1e12 are seconds, above are ms.
    return ts < 1e12 ? ts * 1000 : ts;
  }
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

/**
 * PostgREST expects ISO strings for timestamptz comparisons. Convert
 * the ms cutoff once, at the call site, so we don't forget.
 */
function toISO(ms: number): string {
  return new Date(ms).toISOString();
}

// ─── Math ────────────────────────────────────────────────────────────

const seasonSlot = (timestamp: number, seasonLength: number): number => {
  const hour = new Date(timestamp).getHours();
  return Math.floor((hour / 24) * seasonLength);
};

const updateHoltWinters = (
  state: PredictorState,
  observedInterval: number,
  observedAt: number,
  params: HoltWintersParams
): PredictorState => {
  const m = params.seasonLength;
  const slot = seasonSlot(observedAt, m);

  const seasonal =
    state.seasonal.length === m ? [...state.seasonal] : Array(m).fill(0);

  const L_prev = state.level;
  const T_prev = state.trend;
  const S_slot = seasonal[slot] ?? 0;

  const L_new =
    params.alpha * (observedInterval - S_slot) +
    (1 - params.alpha) * (L_prev + T_prev);

  const T_new =
    params.beta * (L_new - L_prev) + (1 - params.beta) * T_prev;

  seasonal[slot] =
    params.gamma * (observedInterval - L_new) +
    (1 - params.gamma) * S_slot;

  const predicted = L_prev + T_prev + S_slot;
  const residual = observedInterval - predicted;

  const newVariance =
    state.n === 0
      ? residual * residual
      : 0.85 * state.variance + 0.15 * residual * residual;

  return {
    ...state,
    n: state.n + 1,
    level: L_new,
    trend: T_new,
    seasonal,
    variance: newVariance,
    lastInterval: observedInterval,
    lastObservedAt: observedAt,
    updatedAt: Date.now(),
  };
};

const initialState = (babyId: string, type: PredictorType): PredictorState => ({
  babyId,
  type,
  n: 0,
  level: FALLBACK_INTERVALS[type],
  trend: 0,
  seasonal: [],
  variance: 0,
  lastInterval: 0,
  lastObservedAt: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// ─── Persistence ─────────────────────────────────────────────────────

async function loadState(
  babyId: string,
  type: PredictorType
): Promise<PredictorState> {
  const key = storageKey(babyId, type);
  const cached = memCache.get(key);
  if (cached) return cached;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const state = JSON.parse(raw) as PredictorState;
      memCache.set(key, state);
      return state;
    }
  } catch {}

  try {
    const userId = await getCurrentUserId();
    if (userId) {
      const { data } = await supabase
        .from('app_settings')
        .select('value, updated_at')
        .eq('key', supabaseKey(babyId, type))
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.updated_at) {
        const age = Date.now() - new Date(data.updated_at).getTime();
        if (age <= 90 * 24 * 60 * 60 * 1000 && data.value) {
          const state = JSON.parse(data.value) as PredictorState;
          memCache.set(key, state);
          AsyncStorage.setItem(key, data.value).catch(() => {});
          return state;
        }
      } else if (data?.value) {
        const state = JSON.parse(data.value) as PredictorState;
        memCache.set(key, state);
        AsyncStorage.setItem(key, data.value).catch(() => {});
        return state;
      }
    }
  } catch {}

  try {
    const { getPredictorCohortPrior } = await import('./PredictorCohort');
    const { ageToCohort } = await import('./CohortPriors');

    const babyMetaRaw = await AsyncStorage.getItem(
      `@littleloom_baby_meta_v1:${babyId}`
    );
    const birthDate = babyMetaRaw ? JSON.parse(babyMetaRaw).birthDate : null;

    if (birthDate) {
      const cohort = ageToCohort(birthDate);
      const prior = await getPredictorCohortPrior(type, cohort);

      if (prior && prior.sampleCount >= 30) {
        const fallback = FALLBACK_INTERVALS[type];
        if (prior.level >= fallback * 0.3 && prior.level <= fallback * 3) {
          const cohortState: PredictorState = {
            babyId,
            type,
            n: 0,
            level: prior.level,
            trend: prior.trend,
            seasonal:
              prior.seasonal.length === 6
                ? prior.seasonal
                : Array(6).fill(0),
            variance: 0,
            lastInterval: 0,
            lastObservedAt: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          if (__DEV__) {
            console.log(
              `[Predictor] Loaded cohort prior for ${type} @ ${cohort}: ` +
                `level=${prior.level.toFixed(1)} trend=${prior.trend.toFixed(2)} ` +
                `n=${prior.sampleCount}`
            );
          }

          memCache.set(key, cohortState);
          return cohortState;
        }
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[Predictor] Cohort prior load failed:', e);
  }

  const fresh = initialState(babyId, type);
  memCache.set(key, fresh);
  return fresh;
}

// ─── Read all local predictor states (for cohort publishing) ────────

export async function getAllPredictorStates(
  babyId: string,
  kinds: PredictorType[]
): Promise<Array<{ kind: PredictorType; state: PredictorState }>> {
  const out: Array<{ kind: PredictorType; state: PredictorState }> = [];
  for (const kind of kinds) {
    try {
      const state = await loadState(babyId, kind);
      out.push({ kind, state });
    } catch {}
  }
  return out;
}

// Canonical helper — defined before use to avoid TDZ errors.
async function getCurrentUserId(): Promise<string | null> {
  return getCanonicalUserId();
}

async function persistState(state: PredictorState): Promise<void> {
  const key = storageKey(state.babyId, state.type);
  memCache.set(key, state);

  const payload = JSON.stringify(state);
  AsyncStorage.setItem(key, payload).catch(() => {});

  getCurrentUserId()
    .then((userId) => {
      if (!userId) return;
      supabase
        .from('app_settings')
        .upsert(
          {
            key: supabaseKey(state.babyId, state.type),
            value: payload,
            user_id: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key,user_id' }
        )
        .then(({ error }) => {
          if (error && __DEV__) {
            console.warn('[Predictor] Supabase sync failed:', error.message);
          }
        });
    })
    .catch(() => {});
}

// ─── Core prediction math ────────────────────────────────────────────

function predictNext(state: PredictorState): Prediction {
  const now = Date.now();
  const m = DEFAULT_PARAMS.seasonLength;

  const baseTime = state.lastObservedAt > 0 ? state.lastObservedAt : now;
  const projectedAt = baseTime + Math.max(state.level, 30) * 60000;
  const slot = seasonSlot(projectedAt, m);
  const seasonal = state.seasonal[slot] ?? 0;

  let predictedInterval = state.level + state.trend + seasonal;

  const floor = FALLBACK_INTERVALS[state.type] * 0.3;
  const ceiling = FALLBACK_INTERVALS[state.type] * 3;
  predictedInterval = Math.max(floor, Math.min(ceiling, predictedInterval));

  const nConfidence = 1 - Math.exp(-state.n / 8);
  const sigma = Math.sqrt(state.variance);
  const varConfidence =
    sigma > 0
      ? Math.min(1, predictedInterval / (predictedInterval + sigma))
      : 0.9;

  const confidence =
    Math.round((nConfidence * 0.65 + varConfidence * 0.35) * 100) / 100;

  const bandMin = Math.max(5, predictedInterval - sigma);
  const bandMax = predictedInterval + sigma;

  const predictedAt = baseTime + predictedInterval * 60000;

  const minutesUntil = Math.round((predictedAt - now) / 60000);

  return {
    type: state.type,
    predictedAt,
    predictedInterval: Math.round(predictedInterval),
    confidence,
    earliest: baseTime + bandMin * 60000,
    latest: baseTime + bandMax * 60000,
    label: labelFor(state.type, minutesUntil),
    minutesUntil,
  };
}

function labelFor(type: PredictorType, minutesUntil: number): string {
  const inText = formatMinutes(minutesUntil);
  switch (type) {
    case 'sleep':
      return `Next sleep likely in ${inText}`;
    case 'feed':
      return `Next feed likely in ${inText}`;
    case 'diaper':
      return `Next diaper change likely in ${inText}`;
    case 'wake':
      return `Baby may wake in ${inText}`;
    case 'medication':
      return `Next dose due in ${inText}`;
    default:
      return `Next ${type} in ${inText}`;
  }
}

export function formatMinutes(mins: number): string {
  if (mins < 0) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Public API ──────────────────────────────────────────────────────

export async function observeEvent(
  babyId: string,
  type: PredictorType,
  eventTimestamp: number
): Promise<Prediction> {
  const state = await loadState(babyId, type);

  let updated = state;
  if (state.lastObservedAt > 0) {
    const intervalMin = (eventTimestamp - state.lastObservedAt) / 60000;

    // Per-type acceptable interval bounds (minutes)
    // Prevents a 3-day-old stale entry from poisoning the model
    const bounds: Record<PredictorType, [number, number]> = {
      sleep: [20, 20 * 60],      // 20 min – 20 h
      feed: [30, 12 * 60],       // 30 min – 12 h
      diaper: [15, 12 * 60],     // 15 min – 12 h
      wake: [15, 12 * 60],
      medication: [60, 24 * 60], // 1 h – 24 h
    };
    const [minI, maxI] = bounds[state.type] ?? [1, 24 * 60];

    if (intervalMin >= minI && intervalMin <= maxI) {
      updated = updateHoltWinters(
        state,
        intervalMin,
        eventTimestamp,
        DEFAULT_PARAMS
      );
      await persistState(updated);
    } else if (__DEV__) {
      console.log(
        `[Predictor] Rejected interval ${intervalMin.toFixed(1)}m for ${state.type} ` +
        `(bounds ${minI}–${maxI}m)`
      );
    }
  } else {
    updated = {
      ...state,
      lastObservedAt: eventTimestamp,
      updatedAt: Date.now(),
    };
    await persistState(updated);
  }

  return predictNext(updated);
}

export async function getPrediction(
  babyId: string,
  type: PredictorType
): Promise<Prediction> {
  const state = await loadState(babyId, type);
  return predictNext(state);
}

export async function getPredictions(
  babyId: string,
  types: PredictorType[]
): Promise<Prediction[]> {
  return Promise.all(types.map((t) => getPrediction(babyId, t)));
}

export async function resetPredictor(
  babyId: string,
  type: PredictorType
): Promise<void> {
  const key = storageKey(babyId, type);
  memCache.delete(key);

  try {
    await AsyncStorage.removeItem(key);
  } catch {}

  try {
    const userId = await getCurrentUserId();
    if (userId) {
      await supabase
        .from('app_settings')
        .delete()
        .eq('key', supabaseKey(babyId, type))
        .eq('user_id', userId);
    }
  } catch {}

  if (__DEV__) {
    console.log(`[Predictor] Reset ${type} for baby ${babyId}`);
  }
}

export async function backfillPredictor(
  babyId: string,
  type: PredictorType,
  daysBack: number = 30
): Promise<{ samples: number }> {
  const cutoffMs = Date.now() - daysBack * 86400000;

  const trackerMap: Record<PredictorType, string[]> = {
    sleep: ['sleep'],
    feed: ['feed'],
    diaper: ['diaper'],
    wake: ['sleep'],
    medication: ['medication'],
  };

  const trackerIds = trackerMap[type];

  // FIX: PostgREST expects a timestamptz string, not raw ms.
  const { data, error } = await supabase
    .from('tracker_entries')
    .select('id, tracker_id, timestamp')
    .eq('baby_id', babyId)
    .in('tracker_id', trackerIds)
    .eq('is_deleted', false)
    .gte('timestamp', toISO(cutoffMs))
    .order('timestamp', { ascending: true });

  if (error || !data) {
    if (__DEV__) {
      console.warn('[Predictor] Backfill query failed:', error?.message);
    }
    return { samples: 0 };
  }

  const intervals: Array<{ interval: number; at: number }> = [];
  for (let i = 1; i < data.length; i++) {
    const prevRow = data[i - 1];
    const currRow = data[i];
    if (!prevRow || !currRow) continue;
    // FIX: normalize both timestamps to ms before subtracting.
    const prevMs = toMs(prevRow.timestamp);
    const currMs = toMs(currRow.timestamp);
    if (prevMs === 0 || currMs === 0) continue;
    const intervalMin = (currMs - prevMs) / 60000;
    if (intervalMin > 1 && intervalMin < 24 * 60) {
      intervals.push({ interval: intervalMin, at: currMs });
    }
  }

  if (intervals.length === 0) return { samples: 0 };

  let state = initialState(babyId, type);
  for (const { interval, at } of intervals) {
    state = updateHoltWinters(state, interval, at, DEFAULT_PARAMS);
  }

  await persistState(state);

  if (__DEV__) {
    console.log(`[Predictor] Backfilled ${intervals.length} intervals for ${type}`);
  }

  return { samples: intervals.length };
}