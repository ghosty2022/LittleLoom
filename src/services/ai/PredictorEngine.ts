// src/services/ai/PredictorEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Time-series prediction for sleep, feed, and diaper events.
//
// Method: Holt-Winters triple exponential smoothing, adapted for
// irregular event streams. We model INTER-EVENT INTERVALS (minutes
// between events) rather than absolute timestamps — that's what
// actually varies with age, feeding schedule, and routine.
//
// Public API:
//   observeEvent(babyId, type, eventTimestamp) → Prediction
//   getPrediction(babyId, type) → Prediction
//   getPredictions(babyId, types[]) → Prediction[]
//   resetPredictor(babyId, type) → void
//   backfillPredictor(babyId, type, daysBack) → { samples: number }
//   formatMinutes(mins) → string
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

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
        .select('value')
        .eq('key', supabaseKey(babyId, type))
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.value) {
        const state = JSON.parse(data.value) as PredictorState;
        memCache.set(key, state);
        AsyncStorage.setItem(key, data.value).catch(() => {});
        return state;
      }
    }
  } catch {}

  const fresh = initialState(babyId, type);
  memCache.set(key, fresh);
  return fresh;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {}
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function persistState(state: PredictorState): Promise<void> {
  const key = storageKey(state.babyId, state.type);
  memCache.set(key, state);

  const payload = JSON.stringify(state);
  AsyncStorage.setItem(key, payload).catch(() => {});

  // Fire-and-forget Supabase sync WITH user_id (RLS-safe)
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

  // Use the *predicted* future time's slot rather than the current slot,
  // so we pick the seasonal component that actually applies to the
  // predicted event's time of day.
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
    case 'sleep': return `Next sleep likely in ${inText}`;
    case 'feed': return `Next feed likely in ${inText}`;
    case 'diaper': return `Next diaper change likely in ${inText}`;
    case 'wake': return `Baby may wake in ${inText}`;
    case 'medication': return `Next dose due in ${inText}`;
    default: return `Next ${type} in ${inText}`;
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

    if (intervalMin > 1 && intervalMin < 24 * 60) {
      updated = updateHoltWinters(
        state,
        intervalMin,
        eventTimestamp,
        DEFAULT_PARAMS
      );
      await persistState(updated);
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
  return Promise.all(types.map(t => getPrediction(babyId, t)));
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
  const cutoff = Date.now() - daysBack * 86400000;

  const trackerMap: Record<PredictorType, string[]> = {
    sleep: ['sleep'],
    feed: ['feed'],
    diaper: ['diaper'],
    wake: ['sleep'],
    medication: ['medication'],
  };

  const trackerIds = trackerMap[type];

  const { data, error } = await supabase
    .from('tracker_entries')
    .select('id, tracker_id, timestamp')
    .eq('baby_id', babyId)
    .in('tracker_id', trackerIds)
    .eq('is_deleted', false)
    .gte('timestamp', cutoff)
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
    const prev = prevRow.timestamp;
    const curr = currRow.timestamp;
    const intervalMin = (curr - prev) / 60000;
    if (intervalMin > 1 && intervalMin < 24 * 60) {
      intervals.push({ interval: intervalMin, at: curr });
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