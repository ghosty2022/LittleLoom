// src/services/ai/CorrelationEngine.ts
// ─────────────────────────────────────────────────────────────────────
// Discovers real patterns in a baby's tracker history.
//
// Approach:
//   1. Group entries into "days"
//   2. For each candidate relationship (A → B), compute stats
//   3. Rank by effect size × sample size × recency
//
// No ML. Just honest Pearson correlation, Cohen's d, and
// count-based conditional probability. We only surface correlations that
// are:
//   - Statistically meaningful (|r| > 0.3 or |d| > 0.5)
//   - Well-sampled (n >= 8)
//   - Actionable (a parent can DO something about it)
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

export type CorrelationKind =
  | 'feed_before_sleep'
  | 'feed_count_vs_mood'
  | 'sleep_vs_mood'
  | 'tummy_time_vs_milestone'
  | 'outdoor_vs_sleep'
  | 'night_wakings_vs_feed'
  | 'diaper_vs_feed'
  | 'medication_vs_symptom'
  | 'play_vs_mood';

export interface DiscoveredCorrelation {
  id: string;
  kind: CorrelationKind;
  headline: string;
  description: string;
  effectSize: number;
  samples: number;
  direction: 'positive' | 'negative' | 'none';
  suggestion: string;
  emoji: string;
  metricA: string;
  metricB: string;
}

// ─── Data helpers ────────────────────────────────────────────────────

type Entry = {
  tracker_id: string;
  timestamp: number;
  data: Record<string, unknown>;
};

const dayKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

const groupByDay = (entries: Entry[]): Map<string, Entry[]> => {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = dayKey(e.timestamp);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(e);
  }
  return map;
};

const pearson = (xs: number[], ys: number[]): number => {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const dxv = (xs[i] ?? 0) - mx;
    const dyv = (ys[i] ?? 0) - my;
    num += dxv * dyv;
    dx += dxv * dxv;
    dy += dyv * dyv;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
};

const cohensD = (a: number[], b: number[]): number => {
  if (a.length < 3 || b.length < 3) return 0;
  const ma = a.reduce((x, y) => x + y, 0) / a.length;
  const mb = b.reduce((x, y) => x + y, 0) / b.length;
  const va = a.reduce((x, y) => x + (y - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((x, y) => x + (y - mb) ** 2, 0) / (b.length - 1);
  const pooled = Math.sqrt(
    ((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2)
  );
  return pooled === 0 ? 0 : (ma - mb) / pooled;
};

// ─── Detectors ───────────────────────────────────────────────────────

function detectFeedBeforeSleep(entries: Entry[]): DiscoveredCorrelation | null {
  const sleeps = entries.filter(e => e.tracker_id === 'sleep');
  const feeds = entries.filter(e => e.tracker_id === 'feed');
  if (sleeps.length < 8 || feeds.length < 8) return null;

  const sleepDurations: number[] = [];
  const hadRecentFeed: number[] = [];

  for (const sleep of sleeps) {
    const duration = Number(
      sleep.data?.duration ?? sleep.data?.duration_minutes
    );
    if (!Number.isFinite(duration) || duration <= 0) continue;

    const recentFeed = feeds.find(f => {
      const delta = sleep.timestamp - f.timestamp;
      return delta > 0 && delta <= 30 * 60 * 1000;
    });

    sleepDurations.push(duration);
    hadRecentFeed.push(recentFeed ? 1 : 0);
  }

  if (sleepDurations.length < 8) return null;

  const withFeed = sleepDurations.filter((_, i) => hadRecentFeed[i] === 1);
  const withoutFeed = sleepDurations.filter((_, i) => hadRecentFeed[i] === 0);

  if (withFeed.length < 3 || withoutFeed.length < 3) return null;

  const d = cohensD(withFeed, withoutFeed);
  if (Math.abs(d) < 0.5) return null;

  const avgWith = withFeed.reduce((a, b) => a + b, 0) / withFeed.length;
  const avgWithout =
    withoutFeed.reduce((a, b) => a + b, 0) / withoutFeed.length;
  const diff = avgWith - avgWithout;

  return {
    id: 'feed_before_sleep',
    kind: 'feed_before_sleep',
    headline:
      diff > 0
        ? `Feeding before naps adds ~${Math.round(diff)} min to sleep`
        : `Feeding before naps may shorten sleep by ${Math.round(
            Math.abs(diff)
          )} min`,
    description: `On ${withFeed.length} naps, you fed within 30 min of sleep. Those naps averaged ${Math.round(
      avgWith
    )} min vs ${Math.round(avgWithout)} min without a recent feed.`,
    effectSize: Math.abs(d),
    samples: sleepDurations.length,
    direction: diff > 0 ? 'positive' : 'negative',
    suggestion:
      diff > 0
        ? 'Try to offer a feed 15–30 min before each nap.'
        : 'Consider spacing feeds further from nap time.',
    emoji: '🍼😴',
    metricA: 'feed',
    metricB: 'sleep',
  };
}

function detectFeedCountVsMood(entries: Entry[]): DiscoveredCorrelation | null {
  const byDay = groupByDay(entries);
  const days: { feeds: number; mood: number }[] = [];

  for (const dayEntries of byDay.values()) {
    const feeds = dayEntries.filter(e => e.tracker_id === 'feed').length;
    const moods = dayEntries
      .filter(e => e.tracker_id === 'mood')
      .map(e => Number(e.data?.mood ?? e.data?.value))
      .filter(n => Number.isFinite(n) && n > 0);
    if (feeds === 0 || moods.length === 0) continue;
    const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
    days.push({ feeds, mood: avgMood });
  }

  if (days.length < 8) return null;

  const r = pearson(
    days.map(d => d.feeds),
    days.map(d => d.mood)
  );
  if (Math.abs(r) < 0.3) return null;

  return {
    id: 'feed_count_vs_mood',
    kind: 'feed_count_vs_mood',
    headline:
      r > 0
        ? `More feeds correlate with better mood (r=${r.toFixed(2)})`
        : `More feeds correlate with lower mood (r=${r.toFixed(2)})`,
    description: `Across ${days.length} days, days with more feeds tended to have ${
      r > 0 ? 'higher' : 'lower'
    } average mood scores.`,
    effectSize: Math.abs(r),
    samples: days.length,
    direction: r > 0 ? 'positive' : 'negative',
    suggestion:
      r > 0
        ? 'Consistent feeds seem to help mood — keep the schedule steady.'
        : 'Check whether overtired feeds are causing fussiness.',
    emoji: '🍼😊',
    metricA: 'feed',
    metricB: 'mood',
  };
}

function detectNightWakingsVsFeed(
  entries: Entry[]
): DiscoveredCorrelation | null {
  const byDay = groupByDay(entries);
  const days: { lastFeedHour: number; wakings: number }[] = [];

  for (const [, dayEntries] of byDay) {
    const feeds = dayEntries
      .filter(e => e.tracker_id === 'feed')
      .sort((a, b) => b.timestamp - a.timestamp);
    const nightWakings = dayEntries.filter(e => {
      const h = new Date(e.timestamp).getHours();
      return e.tracker_id === 'sleep' && (h >= 22 || h < 6);
    }).length;

    if (feeds.length === 0 || nightWakings === 0) continue;
    const lastFeed = feeds[0];
    if (!lastFeed) continue;
    const hour = new Date(lastFeed.timestamp).getHours();
    days.push({ lastFeedHour: hour, wakings: nightWakings });
  }

  if (days.length < 8) return null;

  const r = pearson(
    days.map(d => d.lastFeedHour),
    days.map(d => d.wakings)
  );
  if (Math.abs(r) < 0.3) return null;

  return {
    id: 'night_wakings_vs_feed',
    kind: 'night_wakings_vs_feed',
    headline:
      r > 0
        ? `Later last feeds correlate with more night wakings`
        : `Earlier last feeds correlate with more night wakings`,
    description: `Across ${days.length} nights, the hour of the last feed showed a correlation of ${r.toFixed(
      2
    )} with night wakings.`,
    effectSize: Math.abs(r),
    samples: days.length,
    direction: r > 0 ? 'negative' : 'positive',
    suggestion:
      r > 0
        ? 'Try moving the last feed 30 min earlier and see if night sleep improves.'
        : 'Consider a dream-feed closer to bedtime.',
    emoji: '🌙🍼',
    metricA: 'feed',
    metricB: 'sleep',
  };
}

function detectOutdoorVsSleep(entries: Entry[]): DiscoveredCorrelation | null {
  const byDay = groupByDay(entries);
  const days: { outdoor: number; sleep: number }[] = [];

  // Both 'outdoor' and 'outdoor_time' are valid tracker IDs in this app.
  // Also match the legacy 'walk' tracker which is a form of outdoor time.
  const OUTDOOR_IDS = new Set(['outdoor', 'outdoor_time', 'walk']);

  for (const [, dayEntries] of byDay) {
    const outdoor = dayEntries
      .filter(e => OUTDOOR_IDS.has(e.tracker_id))
      .reduce((sum, e) => {
        const d = e.data || {};
        // Duration is stored in SECONDS per the schema
        const seconds = Number(d.duration ?? 0);
        const minutes = Number(d.minutes ?? 0);
        // Prefer minutes if explicitly present; otherwise seconds/60
        const mins = minutes > 0 ? minutes : seconds > 0 ? seconds / 60 : 0;
        return sum + mins;
      }, 0);
    const sleepMin = dayEntries
      .filter(e => e.tracker_id === 'sleep')
      .reduce(
        (sum, e) =>
          sum + Number(e.data?.duration ?? e.data?.duration_minutes ?? 0),
        0
      );

    if (sleepMin === 0) continue;
    days.push({ outdoor, sleep: sleepMin });
  }

  if (days.length < 8) return null;

  const r = pearson(
    days.map(d => d.outdoor),
    days.map(d => d.sleep)
  );
  if (Math.abs(r) < 0.3) return null;

  return {
    id: 'outdoor_vs_sleep',
    kind: 'outdoor_vs_sleep',
    headline:
      r > 0
        ? `Outdoor time correlates with ${r > 0.5 ? 'much ' : ''}better sleep`
        : `Outdoor time correlates with lower sleep totals`,
    description: `Across ${days.length} days, more outdoor minutes tended to come with ${
      r > 0 ? 'more' : 'less'
    } total sleep.`,
    effectSize: Math.abs(r),
    samples: days.length,
    direction: r > 0 ? 'positive' : 'negative',
    suggestion:
      r > 0
        ? 'Try 20+ minutes of outdoor time each afternoon.'
        : 'Check whether long outings are disrupting naps.',
    emoji: '🌳😴',
    metricA: 'outdoor',
    metricB: 'sleep',
  };
}

// ─── Public API ──────────────────────────────────────────────────────

const DETECTORS: Array<(entries: Entry[]) => DiscoveredCorrelation | null> = [
  detectFeedBeforeSleep,
  detectFeedCountVsMood,
  detectNightWakingsVsFeed,
  detectOutdoorVsSleep,
];

export async function discoverCorrelations(
  babyId: string,
  daysBack: number = 45
): Promise<DiscoveredCorrelation[]> {
  const cutoff = Date.now() - daysBack * 86400000;

  const { data, error } = await supabase
    .from('tracker_entries')
    .select('tracker_id, timestamp, data')
    .eq('baby_id', babyId)
    .eq('is_deleted', false)
    .gte('timestamp', cutoff)
    .order('timestamp', { ascending: true });

  if (error || !data) {
    if (__DEV__) {
      console.warn('[Correlation] query failed:', error?.message);
    }
    return [];
  }

  const entries: Entry[] = data.map(row => ({
    tracker_id: row.tracker_id,
    timestamp: row.timestamp,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {},
  }));

  const results: DiscoveredCorrelation[] = [];
  for (const detect of DETECTORS) {
    try {
      const r = detect(entries);
      if (r) results.push(r);
    } catch (e) {
      if (__DEV__) console.warn('[Correlation] detector threw:', e);
    }
  }

  results.sort(
    (a, b) =>
      b.effectSize * Math.log(b.samples + 1) -
      a.effectSize * Math.log(a.samples + 1)
  );

  // ─── Persist to cache so subsequent reads are instant ─────────
  if (results.length > 0) {
    try {
      const rows = results.map(r => ({
        baby_id: babyId,
        kind: r.kind,
        headline: r.headline,
        description: r.description,
        effect_size: r.effectSize,
        samples: r.samples,
        direction: r.direction,
        suggestion: r.suggestion,
        emoji: r.emoji,
        metric_a: r.metricA,
        metric_b: r.metricB,
        computed_at: new Date().toISOString(),
      }));

      await supabase
        .from('ai_correlation_cache')
        .upsert(rows, { onConflict: 'baby_id,kind' });
    } catch (e) {
      if (__DEV__) console.warn('[Correlation] Cache write failed:', e);
    }
  }

  return results;
}

// ─── Read from cache (instant, no query) ────────────────────────────

// ─── Invalidate cache after N new entries ──────────────────────────

const INVALIDATE_THRESHOLD = 5; // refresh after 5 new entries
const LAST_INVALIDATE_KEY_PREFIX = '@littleloom_corr_invalidate_v1:';

export async function invalidateCorrelationCacheIfStale(
  babyId: string,
  force: boolean = false
): Promise<boolean> {
  if (!babyId) return false;

  const key = `${LAST_INVALIDATE_KEY_PREFIX}${babyId}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const lastTimestamp = raw ? parseInt(raw, 10) : 0;

    // Count entries CREATED since the last invalidation (by timestamp, not id).
    // This is resilient to soft-deletes and edits.
    let query = supabase
      .from('tracker_entries')
      .select('id', { count: 'exact', head: true })
      .eq('baby_id', babyId)
      .eq('is_deleted', false);

    if (lastTimestamp > 0) {
      query = query.gt('timestamp', lastTimestamp);
    }

    const { count, error } = await query;
    if (error) return false;
    const newEntryCount = count ?? 0;

    if (force || newEntryCount >= INVALIDATE_THRESHOLD) {
      // Delete cached rows so next read recomputes
      await supabase
        .from('ai_correlation_cache')
        .delete()
        .eq('baby_id', babyId);

      // Record the timestamp of the newest entry we just accounted for
      const { data: newest } = await supabase
        .from('tracker_entries')
        .select('timestamp')
        .eq('baby_id', babyId)
        .eq('is_deleted', false)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      const cutoff = newest?.timestamp ?? Date.now();
      await AsyncStorage.setItem(key, String(cutoff));

      if (__DEV__) {
        console.log(
          `[Correlation] Cache invalidated for ${babyId} ` +
          `(${newEntryCount} new entries since last run)`
        );
      }
      return true;
    }

    return false;
  } catch (e) {
    if (__DEV__) console.warn('[Correlation] Invalidation failed:', e);
    return false;
  }
}

export async function getCachedCorrelations(
  babyId: string
): Promise<DiscoveredCorrelation[]> {
  try {
    const { data, error } = await supabase
      .from('ai_correlation_cache')
      .select('*')
      .eq('baby_id', babyId)
      .order('effect_size', { ascending: false });

    if (error || !data) return [];

    return data.map(row => ({
      id: row.kind,
      kind: row.kind as CorrelationKind,
      headline: row.headline,
      description: row.description,
      effectSize: Number(row.effect_size),
      samples: Number(row.samples),
      direction: row.direction as 'positive' | 'negative' | 'none',
      suggestion: row.suggestion || '',
      emoji: row.emoji || '🔗',
      metricA: row.metric_a || '',
      metricB: row.metric_b || '',
    }));
  } catch {
    return [];
  }
}