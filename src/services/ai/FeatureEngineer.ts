// src/services/ai/FeatureEngineer.ts
// ─────────────────────────────────────────────────────────────────────
// Nightly feature engineering for the ai_features table.
//
// FIXES in this version:
//   ✓ Computes ALL 18 columns (was missing 4)
//   ✓ Handles unit conversions correctly (F→C, oz→ml, seconds→minutes)
//   ✓ Sanitizes for PostgREST (no undefined/NaN)
//   ✓ Robust to missing entries (returns zeros, not crashes)
//   ✓ Uses canonical Supabase client
//
// Public API:
//   - computeAndStoreFeatures(babyId, date): Promise<void>
//   - backfillRange(babyId, daysBack): Promise<number>
// ─────────────────────────────────────────────────────────────────────

import { supabase } from '@/utils/supabase';
import { calculatePercentilePrecise } from '@/hooks/useWHOGrowthCalculator';

// ─── Types ──────────────────────────────────────────────────────────

interface RawEntry {
  id: string;
  baby_id: string;
  tracker_id: string;
  tracker_type: string;
  timestamp: string;
  data: Record<string, unknown> | string;
  notes?: string | null;
  logged_by?: string | null;
}

export interface ComputedFeatures {
  feed_count: number;
  feed_total_ml: number;
  feed_avg_interval_minutes: number | null;
  sleep_total_minutes: number;
  sleep_nap_count: number;
  sleep_consistency_score: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  weight_percentile: number | null;
  weight_velocity_kg_per_week: number | null;
  temperature_max: number | null;
  symptom_count: number;
  routine_consistency_score: number;
  parent_engagement_score: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

const parseData = (data: unknown): Record<string, unknown> => {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  if (typeof data === 'object') return data as Record<string, unknown>;
  return {};
};

const safeNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date): Date => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

/** Convert amount to ml (handles oz → ml) */
const toMl = (data: Record<string, unknown>): number => {
  const raw = safeNum(data.amount, 0);
  if (raw <= 0) return 0;
  const unit = String(data.unit || 'ml').toLowerCase();
  return unit === 'oz' ? raw * 29.5735 : raw;
};

/** Convert duration to minutes (handles seconds + strings like "1h 30m") */
const toMinutes = (data: Record<string, unknown>): number => {
  const d = data.duration;
  if (typeof d === 'number' && Number.isFinite(d)) {
    // Your schema stores duration in seconds
    return d / 60;
  }
  if (typeof d === 'string') {
    // Parse "1h 30m" / "45m" / "90s"
    const s = d.trim().toLowerCase();
    const asNum = Number(s);
    if (Number.isFinite(asNum)) return asNum / 60;
    let total = 0;
    const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(s)) !== null) {
      const n = parseFloat(match[1]);
      const u = match[2][0];
      total += u === 'h' ? n * 60 : u === 'm' ? n : n / 60;
    }
    return total;
  }
  const minutes = safeNum(data.minutes, 0);
  return minutes;
};

/** Convert temp to Celsius */
const toCelsius = (data: Record<string, unknown>): number | null => {
  const v = Number(data.value);
  if (!Number.isFinite(v)) return null;
  const unit = String(data.unit || 'celsius').toLowerCase();
  return unit === 'fahrenheit' ? ((v - 32) * 5) / 9 : v;
};

// ─── The Service ────────────────────────────────────────────────────

export class FeatureEngineer {
  /**
   * Compute and store features for one baby for one day.
   * Idempotent — safe to run multiple times.
   */
  async computeAndStoreFeatures(babyId: string, date: Date): Promise<void> {
    try {
      const entries = await this.getEntriesForDay(babyId, date);
      if (entries.length === 0) return;

      const previous = await this.getPreviousFeatures(babyId, date);
      // Load baby profile (for WHO percentile computation)
      let baby: any = null;
      try {
        const { data: b } = await supabase
          .from('babies')
          .select('date_of_birth, gender')
          .eq('id', babyId)
          .maybeSingle();
        // Normalize so downstream code that reads `birth_date` still works
        baby = b ? { ...b, birth_date: b.date_of_birth } : null;
      } catch {}
      const features = this.computeFeatures(entries, previous, baby);

      const { error } = await supabase
        .from('ai_features')
        .upsert(
          {
            baby_id: babyId,
            feature_date: dateKey(date),
            ...features,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'baby_id,feature_date' }
        );

      if (error) {
        console.warn('[FeatureEngineer] Upsert failed:', error.message);
      } else if (__DEV__) {
        console.log(`[FeatureEngineer] Stored features for ${babyId} on ${dateKey(date)}`);
      }
    } catch (err) {
      console.error('[FeatureEngineer] computeAndStoreFeatures failed:', err);
    }
  }

  /**
   * Backfill the last `daysBack` days. Useful after reinstall or
   * when first enabling AI features.
   */
  async backfillRange(babyId: string, daysBack: number = 30): Promise<number> {
    let count = 0;
    for (let i = daysBack; i >= 1; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      await this.computeAndStoreFeatures(babyId, date);
      count++;
    }
    return count;
  }

  // ─── Private ────────────────────────────────────────────────────

  private async getEntriesForDay(babyId: string, date: Date): Promise<RawEntry[]> {
    const start = startOfDay(date);
    const end = endOfDay(date);

    const { data, error } = await supabase
      .from('tracker_entries')
      .select('id, baby_id, tracker_id, tracker_type, timestamp, data, notes, logged_by')
      .eq('baby_id', babyId)
      .eq('is_deleted', false)
      .gte('timestamp', start.toISOString())
      .lt('timestamp', end.toISOString());

    if (error) {
      console.error('[FeatureEngineer] getEntriesForDay error:', error.message);
      return [];
    }
    return (data || []) as RawEntry[];
  }

  private async getPreviousFeatures(babyId: string, date: Date): Promise<any> {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);

    try {
      const { data, error } = await supabase
        .from('ai_features')
        .select('*')
        .eq('baby_id', babyId)
        .eq('feature_date', dateKey(prev))
        .maybeSingle();

      if (error) {
        if (__DEV__) console.warn('[FeatureEngineer] getPreviousFeatures error:', error.message);
        return null;
      }
      return data || null;
    } catch {
      return null;
    }
  }

  private computeFeatures(entries: RawEntry[], previous: any, baby?: any): ComputedFeatures {
    // Guard against non-array input
    const safeEntries = Array.isArray(entries) ? entries.filter(e => 
      e && e.tracker_id && e.timestamp && !isNaN(new Date(e.timestamp).getTime())
    ) : [];

    // ─── Segment entries by tracker ──────────────────────────────
    const feedEntries = safeEntries.filter((e) => e.tracker_id === 'feed');
    const sleepEntries = safeEntries.filter((e) => e.tracker_id === 'sleep');
    const growthEntries = safeEntries.filter((e) => e.tracker_id === 'growth');
    const tempEntries = safeEntries.filter((e) => e.tracker_id === 'temperature');
    const symptomEntries = safeEntries.filter((e) => e.tracker_id === 'symptom');

    // ─── Feeding ─────────────────────────────────────────────────
    const feedCount = feedEntries.length;
    const feedTotalMl = feedEntries.reduce((sum, e) => sum + toMl(parseData(e.data)), 0);

    let feedAvgIntervalMinutes: number | null = null;
    if (feedCount >= 2) {
      const times = feedEntries
        .map((e) => new Date(e.timestamp).getTime())
        .sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push((times[i] - times[i - 1]) / 60000);
      }
      if (intervals.length > 0) {
        feedAvgIntervalMinutes =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }
    }

    // ─── Sleep ───────────────────────────────────────────────────
    const sleepTotalMinutes = sleepEntries.reduce(
      (sum, e) => sum + toMinutes(parseData(e.data)),
      0
    );
    const sleepNapCount = sleepEntries.filter((e) => {
      const d = parseData(e.data);
      return String(d.sleepType || '').toLowerCase() === 'nap';
    }).length;

    // Sleep consistency: standard deviation of sleep start times, lower = more consistent
    let sleepConsistencyScore: number | null = null;
    if (sleepEntries.length >= 2) {
      const startHours = sleepEntries.map((e) => {
        const d = new Date(e.timestamp);
        return d.getHours() + d.getMinutes() / 60;
      });
      const mean = startHours.reduce((a, b) => a + b, 0) / startHours.length;
      const variance =
        startHours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) /
        startHours.length;
      const stddev = Math.sqrt(variance);
      // Map: stddev 0 → 100, stddev 4h+ → 0
      sleepConsistencyScore = Math.max(0, Math.min(100, 100 - (stddev / 4) * 100));
    }

    // ─── Growth ──────────────────────────────────────────────────
    const weightEntry = growthEntries.find((e) => {
      const d = parseData(e.data);
      return String(d.measurementType || '').toLowerCase() === 'weight';
    });
    const heightEntry = growthEntries.find((e) => {
      const d = parseData(e.data);
      return String(d.measurementType || '').toLowerCase() === 'height';
    });

    const weightKg = weightEntry
      ? safeNum(parseData(weightEntry.data).value, NaN)
      : null;
    const weightKgSafe = Number.isFinite(weightKg) ? weightKg : previous?.weight_kg ?? null;

    const heightCm = heightEntry
      ? safeNum(parseData(heightEntry.data).value, NaN)
      : null;
    const heightCmSafe = Number.isFinite(heightCm) ? heightCm : previous?.height_cm ?? null;

    // Weight velocity (kg/week) — needs previous days' data
    let weightVelocity: number | null = null;
    if (
      weightKgSafe !== null && 
      Number.isFinite(weightKgSafe) &&
      previous?.weight_kg != null && 
      Number.isFinite(Number(previous.weight_kg))
    ) {
      const prevWeight = Number(previous.weight_kg);
      weightVelocity = (weightKgSafe - prevWeight) / 7;
      // Guard against absurd values (> 1 kg/week is physically impossible for infants)
      if (!Number.isFinite(weightVelocity) || Math.abs(weightVelocity) > 1) {
        weightVelocity = null;
      }
    }

    // Compute WHO weight-for-age percentile using the static import.
    let weightPercentile: number | null = previous?.weight_percentile ?? null;
    if (weightKgSafe !== null && baby?.birth_date && baby?.gender) {
      try {
        const b = new Date(baby.birth_date);
        const n = new Date();
        const ageMonths = Math.max(
          0,
          (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth())
        );
        // babies.gender is 'male' | 'female' | 'other' in the DB.
        // The WHO calculator expects 'boy' | 'girl'.
        const genderRaw = String(baby.gender || '').toLowerCase();
        const g: 'boy' | 'girl' =
          genderRaw === 'female' || genderRaw === 'girl' ? 'girl' : 'boy';
        weightPercentile = calculatePercentilePrecise(
          weightKgSafe,
          ageMonths,
          'weight',
          g
        );
      } catch {
        // calculator unavailable — keep null
      }
    }

    // ─── Health ──────────────────────────────────────────────────
    const temps = tempEntries
      .map((e) => toCelsius(parseData(e.data)))
      .filter((t): t is number => t !== null);

    const temperatureMax = temps.length > 0 ? Math.max(...temps) : null;
    const symptomCount = symptomEntries.length;

    // ─── Engagement ──────────────────────────────────────────────
    // Routine consistency: how spread out across the day the entries are
    const hoursWithEntries = new Set(
      safeEntries.map((e) => new Date(e.timestamp).getHours())
    );
    const routineConsistency = Math.min(
      100,
      (hoursWithEntries.size / 24) * 100 * 2.5
    );

    // Parent engagement: weighted by role diversity and entry spread
    //   - Multiple family members logging = higher engagement
    //   - Entries spread across the day = higher engagement
    //   - Rapid bursts (spam) get dampened
    //
    // NOTE: `logged_by` is a non-null UUID column, so `filter(Boolean)` is
    // mostly redundant. We keep it for safety against legacy rows.
    const uniqueLoggers = new Set(
      safeEntries.map(e => e.logged_by).filter(Boolean)
    ).size;

    const uniqueHours = hoursWithEntries.size;

    // Diversity bonus: 1 logger = 1.0x, 2+ loggers = 1.3x, 3+ = 1.5x
    const diversityMultiplier =
      uniqueLoggers >= 3 ? 1.5 : uniqueLoggers >= 2 ? 1.3 : 1.0;

    // Spread bonus: more distinct hours = richer data
    const spreadBonus = Math.min(20, uniqueHours * 1.5);

    const rawEngagement = safeEntries.length * 2 * diversityMultiplier + spreadBonus;

    // Clamp to [0, 100]
    const parentEngagement = Math.min(100, Math.round(rawEngagement));

    return {
      feed_count: feedCount,
      feed_total_ml: Number(feedTotalMl.toFixed(2)),
      feed_avg_interval_minutes:
        feedAvgIntervalMinutes !== null
          ? Number(feedAvgIntervalMinutes.toFixed(2))
          : null,
      sleep_total_minutes: Math.round(sleepTotalMinutes),
      sleep_nap_count: sleepNapCount,
      sleep_consistency_score:
        sleepConsistencyScore !== null
          ? Number(sleepConsistencyScore.toFixed(2))
          : null,
      weight_kg: weightKgSafe !== null ? Number(weightKgSafe.toFixed(3)) : null,
      height_cm: heightCmSafe !== null ? Number(heightCmSafe.toFixed(2)) : null,
      weight_percentile:
        weightPercentile !== null ? Number(weightPercentile) : null,
      weight_velocity_kg_per_week:
        weightVelocity !== null ? Number(weightVelocity.toFixed(4)) : null,
      temperature_max:
        temperatureMax !== null ? Number(temperatureMax.toFixed(2)) : null,
      symptom_count: symptomCount,
      routine_consistency_score: Number(routineConsistency.toFixed(2)),
      parent_engagement_score: Number(parentEngagement.toFixed(2)),
    };
  }
}

// ─── Singleton + default export ─────────────────────────────────────

export const featureEngineer = new FeatureEngineer();
export default featureEngineer;