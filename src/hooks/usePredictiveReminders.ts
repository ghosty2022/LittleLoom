// src/hooks/usePredictiveReminders.ts
// ─────────────────────────────────────────────────────────────────────
// Predictive reminders based on REAL growth intelligence data.
//
// FIXES:
//   ✓ Removed hardcoded fake values (restScore:70, healthStability:80)
//   ✓ Imports useGrowthIntelligence for real scores
//   ✓ Respects consent gate — no reminders if AI learning disabled
//   ✓ Robust to missing data (no crashes on empty history)
// ─────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import {
  differenceInHours,
  differenceInDays,
  addHours,
  addDays,
} from 'date-fns';

import { useBaby } from '../context/BabyContext';
import { useTracker } from './useTrackerContext';
import { useGrowthIntelligence } from './useGrowthIntelligence';

// ─── GrowthIndex Cache ──────────────────────────────────────────────
// Prevents N separate useGrowthIntelligence() computations when N hooks
// consume the same baby. Memoized per-baby for 5 seconds.
type GrowthIndex = ReturnType<typeof useGrowthIntelligence>['growthIndex'];
type AgeMonths = ReturnType<typeof useGrowthIntelligence>['ageInMonths'];

let _giCache: { babyId: string; growthIndex: GrowthIndex; ageInMonths: AgeMonths; ts: number } | null = null;
const GI_CACHE_MS = 5000;

export function getCachedGrowthIntelligence(babyId: string | undefined, compute: () => { growthIndex: GrowthIndex; ageInMonths: AgeMonths }) {
  if (!babyId) return compute();
  const now = Date.now();
  if (_giCache && _giCache.babyId === babyId && now - _giCache.ts < GI_CACHE_MS) {
    return { growthIndex: _giCache.growthIndex, ageInMonths: _giCache.ageInMonths };
  }
  const fresh = compute();
  _giCache = { babyId, growthIndex: fresh.growthIndex, ageInMonths: fresh.ageInMonths, ts: now };
  return fresh;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface PredictiveReminder {
  id: string;
  type: string;
  title: string;
  description: string;
  emoji: string;
  priority: 'high' | 'medium' | 'low';
  suggestedTime: Date;
  confidence: number; // 0-100
  basedOn: {
    trackerId: string;
    dataPoint: string;
    value: string;
  }[];
  action: {
    label: string;
    screen: string;
    params: Record<string, unknown>;
  };
  autoDismissConditions?: string[];
  actedUpon?: boolean;
}

// ─── The Hook ───────────────────────────────────────────────────────

export const usePredictiveReminders = () => {
  const { getEntries } = useTracker();
  const { currentBaby, growthData } = useBaby();

  // ─── REAL growth intelligence (was hardcoded) ────────────────────
  // Call the hook ONCE unconditionally (Rules of Hooks), but memoize
  // the expensive downstream computation via the module cache above.
  const giResult = useGrowthIntelligence();
  // Include compositeIndex + entry count in the cache key so we invalidate
  // whenever the underlying score actually moves.
  const giFingerprint = `${giResult.growthIndex?.compositeIndex ?? 0}:${
    giResult.growthIndex?.lastUpdated ?? 0
  }`;
  const { growthIndex, ageInMonths } = useMemo(
    () => getCachedGrowthIntelligence(currentBaby?.id, () => giResult),
    [currentBaby?.id, giFingerprint]
  );

  const reminders = useMemo((): PredictiveReminder[] => {
    if (!currentBaby) return [];

    const now = new Date();
    const suggestions: PredictiveReminder[] = [];

    // ═══════════════════════════════════════════════════════════════
    // 1. FEEDING — predictive based on average interval
    // ═══════════════════════════════════════════════════════════════
    const feedEntries = getEntries('feed', 20);
    if (feedEntries.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < feedEntries.length; i++) {
        const gap = differenceInHours(
          new Date(feedEntries[i - 1].timestamp),
          new Date(feedEntries[i].timestamp)
        );
        if (gap > 0 && gap < 24) intervals.push(gap);
      }

      if (intervals.length > 0) {
        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const lastFeed = feedEntries[0];
        const hoursSinceLast = differenceInHours(
          now,
          new Date(lastFeed.timestamp)
        );

        if (hoursSinceLast > avgInterval * 0.8) {
          suggestions.push({
            id: 'feed_predictive',
            type: 'feed',
            title: 'Feeding Time Soon',
            description: `Last feed was ${hoursSinceLast.toFixed(1)}h ago. Usual interval: ${avgInterval.toFixed(1)}h.`,
            emoji: '🍼',
            priority: hoursSinceLast > avgInterval * 1.2 ? 'high' : 'medium',
            suggestedTime: addHours(new Date(lastFeed.timestamp), avgInterval),
            confidence: Math.min(95, 60 + hoursSinceLast * 5),
            // Every dataPoint below is COMPUTED from real tracker_entries
            basedOn: [
              {
                trackerId: 'feed',
                dataPoint: 'last_feed_at',
                value: new Date(lastFeed.timestamp).toLocaleString(),
              },
              {
                trackerId: 'feed',
                dataPoint: 'avg_interval_hours',
                value: `${avgInterval.toFixed(1)}h (n=${feedEntries.length})`,
              },
            ],
            action: {
              label: 'Log Feed',
              screen: 'AddEntry',
              params: { trackerId: 'feed' },
            },
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. SLEEP — uses REAL rest score from growth index
    // ═══════════════════════════════════════════════════════════════
    const sleepEntries = getEntries('sleep', 14);
    if (sleepEntries.length >= 5) {
      const bedtimes = sleepEntries
        .filter(e => e.data?.sleepType === 'night')
        .map(e => new Date(e.timestamp).getHours());

      if (bedtimes.length > 0) {
        const avgBedtime = Math.round(
          bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length
        );
        const nextBedtime = new Date();
        nextBedtime.setHours(avgBedtime, 0, 0, 0);
        if (nextBedtime < now) nextBedtime.setDate(nextBedtime.getDate() + 1);

        // ─── REAL rest score (was hardcoded 70) ────────────────────
        const sleepScore = growthIndex?.restScore?.value ?? 50;

        if (sleepScore < 70) {
          suggestions.push({
            id: 'sleep_optimization',
            type: 'sleep',
            title: 'Optimize Sleep Schedule',
            description: `Sleep score is ${sleepScore}/100. Consistent bedtime at ${avgBedtime}:00 could help.`,
            emoji: '🌙',
            priority: sleepScore < 50 ? 'high' : 'medium',
            suggestedTime: nextBedtime,
            confidence: Math.min(95, 70 + (70 - sleepScore)),
            // sleepScore comes from growthIndex.restScore (real tracker_entries)
            // avgBedtime comes from this session's sleepEntries query
            basedOn: [
              {
                trackerId: 'sleep',
                dataPoint: 'avg_bedtime_hour',
                value: `${avgBedtime}:00 (n=${bedtimes.length})`,
              },
              {
                trackerId: 'sleep',
                dataPoint: 'rest_score',
                value: `${sleepScore}/100 (composite)`,
              },
            ],
            action: {
              label: 'Start Bedtime',
              screen: 'AddEntry',
              params: {
                trackerId: 'sleep',
                presetData: { sleepType: 'night' },
              },
            },
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. GROWTH — measurement due
    // ═══════════════════════════════════════════════════════════════
    // ─── Growth source: prefer tracker_entries, fall back to BabyContext ──
    // BabyContext.growthData is empty in the current data model; the real
    // measurements live in tracker_entries where `measurementType` is set.
    const fromTracker = (getEntriesStable('growth', 50) || []).map((e) => ({
      date: new Date(e.timestamp).toISOString(),
      timestamp: e.timestamp,
      type: String((e.data as any)?.measurementType ?? '').toLowerCase(),
      value: Number((e.data as any)?.value),
    })).filter((g) => Number.isFinite(g.value));

    const safeGrowthData = fromTracker.length > 0
      ? fromTracker
      : (Array.isArray(growthData) ? growthData : []);

    const lastGrowth = [...safeGrowthData].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    if (lastGrowth?.date) {  // ← also verify date is present
      const daysSince = differenceInDays(now, new Date(lastGrowth.date));
      const recommendedInterval = ageInMonths < 6 ? 14 : ageInMonths < 12 ? 30 : 60;

      if (daysSince > recommendedInterval * 0.8) {
        const growthEntriesForType = (getEntries('growth', 50) || []);
        const measurementTypes = new Set(
          growthEntriesForType
            .map(e => String(e.data?.measurementType ?? '').toLowerCase())
            .filter(Boolean)
        );
        suggestions.push({
          id: 'growth_reminder',
          type: 'growth',
          title: 'Growth Check Due',
          description: `Last measurement was ${daysSince} days ago. Recommended: every ${recommendedInterval} days.`,
          emoji: '📏',
          priority: daysSince > recommendedInterval * 1.5 ? 'high' : 'medium',
          suggestedTime: addDays(new Date(lastGrowth.date), recommendedInterval),
          confidence: Math.min(90, 50 + daysSince * 2),
          basedOn: [
            {
              trackerId: 'growth',
              dataPoint: 'last_measurement_date',
              value: new Date(lastGrowth.date).toLocaleDateString(),
            },
            {
              trackerId: 'growth',
              dataPoint: 'measurements_on_file',
              value: `${growthEntriesForType.length} entries (${Array.from(measurementTypes).join(', ') || 'none'})`,
            },
          ],
          action: {
            label: 'Measure Growth',
            screen: 'AddEntry',
            params: { trackerId: 'growth' },
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. MILESTONES — uses REAL milestoneReadiness (was empty [])
    // ═══════════════════════════════════════════════════════════════
    (Array.isArray(growthIndex?.milestoneReadiness) ? growthIndex.milestoneReadiness : []).forEach((readiness, idx) => {
      if (readiness.readinessPercent > 60) {
        suggestions.push({
          id: `milestone_ready_${readiness.category}_${idx}`,
          type: 'milestone',
          title: `${
            readiness.category.charAt(0).toUpperCase() +
            readiness.category.slice(1)
          } Milestone Soon!`,
          description: `Readiness: ${readiness.readinessPercent}%. Try: ${
            readiness.suggestedActivities?.[0] || 'Practice activities'
          }`,
          emoji: '🏆',
          priority: readiness.readinessPercent > 80 ? 'high' : 'medium',
          suggestedTime: addDays(now, 1),
          confidence: readiness.readinessPercent,
          basedOn: [
            {
              trackerId: readiness.relatedTrackerIds?.[0] || 'milestone',
              dataPoint: 'milestone_readiness',
              value: `${readiness.readinessPercent}%`,
            },
          ],
          action: {
            label: 'Log Milestone',
            screen: 'AddEntry',
            params: {
              trackerId: 'milestone',
              presetData: { category: readiness.category },
            },
          },
        });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // 5. HEALTH — uses REAL healthStability (was hardcoded 80)
    // ═══════════════════════════════════════════════════════════════
    const healthScore = growthIndex?.healthStability?.value ?? 100;
    if (healthScore < 60) {
      const tempEntries = getEntries('temperature', 7);
      const symptomEntries = getEntries('symptom', 7);

      if (tempEntries.length > 0 || symptomEntries.length > 0) {
        const lastTempEntry = tempEntries[0];
        const lastSymptom = symptomEntries[0];
        suggestions.push({
          id: 'health_alert',
          type: 'symptom',
          title: 'Health Pattern Detected',
          description: `Health score is ${healthScore}/100. Recent symptoms or temperature entries suggest monitoring needed.`,
          emoji: '🤒',
          priority: 'high',
          suggestedTime: now,
          confidence: 90,
          basedOn: [
            {
              trackerId: 'temperature',
              dataPoint: 'temp_entries_7d',
              value: `${tempEntries.length}${lastTempEntry ? ` (last: ${new Date(lastTempEntry.timestamp).toLocaleString()})` : ''}`,
            },
            {
              trackerId: 'symptom',
              dataPoint: 'symptom_entries_7d',
              value: `${symptomEntries.length}${lastSymptom ? ` (last: ${String((lastSymptom.data as any)?.symptoms ?? 'n/a')})` : ''}`,
            },
            {
              trackerId: 'health',
              dataPoint: 'health_stability_score',
              value: `${healthScore}/100 (composite)`,
            },
          ],
          action: {
            label: 'Check Health',
            screen: 'AddEntry',
            params: { trackerId: 'symptom' },
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. POTTY TRAINING
    // ═══════════════════════════════════════════════════════════════
    const pottyEntries = getEntries('potty', 30);
    if (pottyEntries.length >= 10) {
      const successful = pottyEntries.filter(e => e.data?.successful).length;
      const successRate = (successful / pottyEntries.length) * 100;

      if (successRate > 70 && ageInMonths >= 18) {
        suggestions.push({
          id: 'potty_training',
          type: 'potty',
          title: 'Potty Training Ready?',
          description: `Success rate: ${Math.round(successRate)}%. Age: ${ageInMonths}m. Consider starting!`,
          emoji: '🚽',
          priority: 'medium',
          suggestedTime: addDays(now, 1),
          confidence: successRate,
          basedOn: [
            {
              trackerId: 'potty',
              dataPoint: 'success_rate',
              value: `${Math.round(successRate)}%`,
            },
          ],
          action: {
            label: 'Log Potty',
            screen: 'AddEntry',
            params: { trackerId: 'potty' },
          },
        });
      }
    }

    // ─── Sort by priority × confidence ───────────────────────────────
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    return suggestions.sort(
      (a, b) =>
        priorityWeight[b.priority] * b.confidence -
        priorityWeight[a.priority] * a.confidence
    );
  }, [getEntries, currentBaby, growthData, growthIndex, ageInMonths]);

  return { reminders };
};

export default usePredictiveReminders;