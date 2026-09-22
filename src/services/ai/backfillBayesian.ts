// src/services/ai/backfillBayesian.ts
// ─────────────────────────────────────────────────────────────────────
// One-time seed of the Bayesian engine from existing tracker entries.
// Uses the canonical observeValue() from BayesianEngine.
//
// FIXES in this version:
//   ✓ `.gte('timestamp', ISO)` — PostgREST requires timestamptz strings,
//     not raw ms numbers (was: "date/time field value out of range").
//   ✓ Corrupted JSON rows no longer abort the whole backfill.
//   ✓ `observeValue` failures now log at __DEV__ so bugs are visible.
//   ✓ Transient network errors no longer permanently mark the baby as
//     backfilled — we retry on the next launch.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { observeValue, MetricKey, extractMetricValue } from './BayesianEngine';

const BACKFILL_FLAG_PREFIX = '@littleloom_bayes_backfilled_v1:';

const hasBackfilled = async (babyId: string): Promise<boolean> => {
  try {
    const v = await AsyncStorage.getItem(BACKFILL_FLAG_PREFIX + babyId);
    return v === '1';
  } catch {
    return false;
  }
};

const markBackfilled = async (babyId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(BACKFILL_FLAG_PREFIX + babyId, '1');
  } catch {}
};

const METRIC_FIELD_MAP: Record<string, Partial<Record<string, MetricKey>>> = {
  temperature: { value: 'temperature_c' },
  feed: {
    amount_ml: 'feeding_ml',
    amount: 'feeding_ml',
    quantity: 'feeding_ml',
    value: 'feeding_ml',
  },
  sleep: {
    duration_minutes: 'sleep_duration_min',
    duration: 'sleep_duration_min',
  },
  nap: {
    duration_minutes: 'sleep_duration_min',
    duration: 'sleep_duration_min',
  },
  growth: {
    weight: 'weight_kg',
    weight_kg: 'weight_kg',
    height: 'height_cm',
    height_cm: 'height_cm',
    head: 'head_cm',
    head_circumference: 'head_cm',
  },
  mood: { mood: 'mood_score', value: 'mood_score' },
  heart_rate: { bpm: 'heart_rate_bpm', value: 'heart_rate_bpm' },
  blood_oxygen: { spo2: 'blood_oxygen', value: 'blood_oxygen' },
  diaper: {
    duration: 'diaper_interval_min',
    minutes: 'diaper_interval_min',
  },
  potty: {
    duration: 'diaper_interval_min',
    minutes: 'diaper_interval_min',
  },
  wake_time: { minutes: 'wake_window_min' },
  poop: {
    duration: 'poop_interval_hr',
    minutes: 'poop_interval_hr',
  },
};

export async function backfillBayesianIfNeeded(
  babyId: string,
  daysBack: number = 90
): Promise<{ ran: boolean; samples: number; metrics: number }> {
  if (await hasBackfilled(babyId)) {
    return { ran: false, samples: 0, metrics: 0 };
  }

  if (__DEV__) {
    console.log(`[Bayes] Backfilling learning for baby ${babyId}...`);
  }

  const cutoff = Date.now() - daysBack * 86400000;

  // PostgREST expects a timestamptz string, not raw milliseconds.
  const { data: entries, error } = await supabase
    .from('tracker_entries')
    .select('tracker_id, data, timestamp')
    .eq('baby_id', babyId)
    .eq('is_deleted', false)
    .gte('timestamp', new Date(cutoff).toISOString())
    .order('timestamp', { ascending: true });

  if (error || !entries) {
    // Distinguish transient errors (network, timeouts) from permanent
    // ones (table missing, RLS denial). Transient errors should NOT
    // mark the baby as backfilled — we want to retry on next launch.
    const msg = error?.message ?? '';
    const isTransient =
      /network|timeout|fetch|connection|5\d\d/i.test(msg);

    if (__DEV__) {
      console.warn(
        `[Bayes] Backfill query failed (${isTransient ? 'transient' : 'permanent'}):`,
        msg
      );
    }

    if (!isTransient) {
      await markBackfilled(babyId);
    }
    return { ran: false, samples: 0, metrics: 0 };
  }

  let sampleCount = 0;
  const metricsTouched = new Set<MetricKey>();

  for (const row of entries) {
    const fieldMap = METRIC_FIELD_MAP[row.tracker_id];
    if (!fieldMap) continue;

    // Guard against corrupted JSON rows — a single bad row must not
    // abort the whole backfill.
    let data: Record<string, unknown> = {};
    try {
      data =
        typeof row.data === 'string'
          ? JSON.parse(row.data)
          : (row.data as Record<string, unknown>) || {};
    } catch {
      continue;
    }

    for (const metric of Object.values(fieldMap)) {
      if (!metric) continue;
      const num = extractMetricValue(metric, data);
      if (num === null) continue;

      try {
        await observeValue(babyId, metric, num);
        sampleCount++;
        metricsTouched.add(metric);
      } catch (e) {
        if (__DEV__) {
          console.warn(`[Bayes] observeValue failed for ${metric}:`, e);
        }
      }
    }
  }

  await markBackfilled(babyId);

  if (__DEV__) {
    console.log(
      `[Bayes] Backfill complete: ${sampleCount} samples across ${metricsTouched.size} metrics`
    );
  }

  return { ran: true, samples: sampleCount, metrics: metricsTouched.size };
}

export async function resetBackfillFlag(babyId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(BACKFILL_FLAG_PREFIX + babyId);
  } catch {}
}