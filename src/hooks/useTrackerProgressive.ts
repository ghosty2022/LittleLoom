/**
 * useTrackerProgressive — The central progressive intelligence hook.
 * Aggregates ALL smart features into a single clean API for forms & screens.
 *
 * Sources consumed:
 *   - useTracker (entries, history, streaks, insights, templates, reminders)
 *   - useBaby (baby profile, age, growth data)
 *   - useGrowthIntelligence (growth scores, milestone readiness)
 *   - usePredictiveReminders (smart reminder triggers)
 *   - useTimelineCorrelations (cross-tracker pattern detection)
 *
 * Target: DynamicTrackerForm.tsx + SmartTrackerScreen.tsx + AddEntryScreen.tsx
 */

import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  differenceInDays,
  differenceInHours,
  subDays,
  subHours,
  format,
  isSameDay,
  isToday,
} from 'date-fns';

// FIX: Import directly from context sources to avoid circular deps
import { useTracker } from './useTrackerContext';
import { useBaby } from '@/context/BabyContext';
import {
  TrackerEntry,
  TrackerStreak,
  TrackerInsight,
  UnifiedTrackerConfig,
  ReminderRule,
  FieldConfig,
} from '@/types/trackers';

// FIX: Use safe dynamic requires to prevent circular dependency crashes
const useGrowthIntelligenceSafe = () => {
  try {
    const { useGrowthIntelligence } = require('./useGrowthIntelligence');
    return useGrowthIntelligence();
  } catch {
    return { growthIndex: null, isLoading: false };
  }
};

const usePredictiveRemindersSafe = () => {
  try {
    const { usePredictiveReminders } = require('./usePredictiveReminders');
    return usePredictiveReminders();
  } catch {
    return { reminders: [], isLoading: false };
  }
};

const useTimelineCorrelationsSafe = () => {
  try {
    const { useTimelineCorrelations } = require('./useTimelineCorrelations');
    return useTimelineCorrelations();
  } catch {
    return { correlations: [], isLoading: false };
  }
};

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═════════════════════════════════════════════════════════════ */

export type SuggestionSource = 'yesterday' | 'pattern' | 'partner' | 'template' | 'correlation' | 'time_based';

export interface ProgressiveSuggestion {
  fieldId: string;
  value: unknown;
  source: SuggestionSource;
  confidence: number; // 0-100
  label: string;
  emoji: string;
}

export interface ProgressiveTrend {
  direction: 'up' | 'down' | 'same';
  delta: number | null;
  deltaLabel: string;
}

export interface ProgressiveTemplate {
  id: string;
  name: string;
  emoji: string;
  data: Record<string, unknown>;
  isDefault?: boolean;
  source: 'builtin' | 'user_saved' | 'auto_generated';
}

export interface ProgressiveCorrelation {
  id: string;
  trackerId: string;
  trackerName: string;
  trackerEmoji: string;
  emoji: string;
  message: string;
  action: 'log_now' | 'prefill' | 'view' | 'none';
  prefillData?: Record<string, unknown>;
  confidence: number;
}

export interface ProgressiveReminder {
  id: string;
  title: string;
  body: string;
  emoji: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: ReminderRule['type'] | 'predictive';
  actionButtons?: { id: string; label: string; action: string }[];
  dueAt?: number;
}

export interface ProgressiveTimeContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number;
  isWeekend: boolean;
  isHoliday: boolean;
  usualTimes: string[];
  nextSuggestedTime?: string;
}

export interface TrackerProgressiveState {
  prefillData: Record<string, unknown>;
  suggestions: ProgressiveSuggestion[];

  streak: TrackerStreak | null;
  isAtRisk: boolean;
  hoursUntilBreak: number;
  streakMessage: string;

  insights: TrackerInsight[];
  hasNewInsights: boolean;

  correlations: ProgressiveCorrelation[];

  activeReminders: ProgressiveReminder[];
  hasUrgentReminders: boolean;

  templates: ProgressiveTemplate[];

  trends: Record<string, ProgressiveTrend>;

  timeContext: ProgressiveTimeContext;

  isLoading: boolean;
  lastUpdated: number;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═════════════════════════════════════════════════════════════ */

const getTimeOfDay = (hour: number): ProgressiveTimeContext['timeOfDay'] => {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
};

const formatTime = (hour: number): string => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
};

const computeTrend = (
  current: number | undefined,
  previous: number | undefined
): ProgressiveTrend => {
  if (
    current === undefined ||
    previous === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return { direction: 'same', delta: null, deltaLabel: '' };
  }
  const delta = current - previous;
  const absDelta = Math.abs(delta);
  let deltaLabel = '';
  if (absDelta >= 1) deltaLabel = `${absDelta.toFixed(1)}`;
  else if (absDelta > 0) deltaLabel = `${(absDelta * 100).toFixed(0)}%`;

  return {
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
    delta: absDelta,
    deltaLabel,
  };
};

/* ═══════════════════════════════════════════════════════════════
   MAIN HOOK
   ═════════════════════════════════════════════════════════════ */

export const useTrackerProgressive = (trackerId: string) => {
  const {
    entries,
    getEntries,
    getSmartSuggestions,
    getYesterdayData,
    getStreak,
    getInsights,
    dismissInsight,
    getTemplates,
    getPendingReminders,
    trackers,
  } = useTracker();

  const { currentBaby, growthData } = useBaby();
  const { growthIndex } = useGrowthIntelligenceSafe();
  const { reminders: predictiveReminders } = usePredictiveRemindersSafe();
  const { correlations: timelineCorrelations } = useTimelineCorrelationsSafe();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const [now, setNow] = useState(() => new Date());
  const nowRef = useRef(now);
  nowRef.current = now;

  const [userSavedTemplates, setUserSavedTemplates] = useState<ProgressiveTemplate[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (trackerId) {
      getTemplates(trackerId)
        .then((templates: any[]) => {
          setUserSavedTemplates(
            templates.map((t) => ({
              ...t,
              source: 'user_saved' as const,
            }))
          );
        })
        .catch(() => setUserSavedTemplates([]));
    } else {
      setUserSavedTemplates([]);
    }
  }, [trackerId, getTemplates]);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setIsLoading(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const safeTrackers = trackers || [];

  const trackerConfig = useMemo(
    () => safeTrackers.find((t) => t.id === trackerId),
    [safeTrackers, trackerId]
  );

  /* ── All entries for this tracker ── */
  const trackerEntries = useMemo(
    () => (trackerId ? getEntries(trackerId) || [] : []),
    [getEntries, trackerId, entries, refreshToken]
  );

  /* ── Today's entries ── */
  const todayEntries = useMemo(
    () =>
      trackerEntries.filter((e) => {
        const entryDate = new Date(e.timestamp);
        return isSameDay(entryDate, now);
      }),
    [trackerEntries, now]
  );

  /* ── Yesterday's entries ── */
  const yesterdayEntries = useMemo(
    () =>
      trackerEntries.filter((e) => {
        const entryDate = new Date(e.timestamp);
        return isSameDay(entryDate, subDays(now, 1));
      }),
    [trackerEntries, now]
  );

  /* ── Last 14 days entries ── */
  const recentEntries = useMemo(
    () => trackerEntries.filter((e) => e.timestamp > subDays(now, 14).getTime()),
    [trackerEntries, now]
  );

  /* ═══════════════════════════════════════════════════════════
     TIME CONTEXT
     ═══════════════════════════════════════════════════════════ */

  const timeContext = useMemo((): ProgressiveTimeContext => {
    const hour = now.getHours();
    const timeOfDay = getTimeOfDay(hour);

    const hourCounts: Record<number, number> = {};
    recentEntries.forEach((e) => {
      const h = new Date(e.timestamp).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });

    const usualTimes = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => formatTime(parseInt(h)));

    let nextSuggestedTime: string | undefined;
    if (usualTimes.length > 0 && hourCounts[hour] === undefined) {
      const nextHour = Object.entries(hourCounts)
        .map(([h]) => parseInt(h))
        .filter((h) => h > hour)
        .sort((a, b) => a - b)[0];
      if (nextHour !== undefined) {
        nextSuggestedTime = formatTime(nextHour);
      }
    }

    return {
      timeOfDay,
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isHoliday: false, // Could integrate holiday API
      usualTimes,
      nextSuggestedTime,
    };
  }, [recentEntries, now]);

  /* ═══════════════════════════════════════════════════════════
     STREAK
     ═══════════════════════════════════════════════════════════ */

  const streakData = useMemo(() => {
    const s = getStreak(trackerId);
    if (!s) return null;

    const hoursUntilBreak = s.isAtRisk ? Math.max(0, 24 - now.getHours()) : 0;

    let streakMessage = '';
    if (s.currentStreak === 0) streakMessage = 'Start your first streak!';
    else if (s.isAtRisk) streakMessage = `Log in ${hoursUntilBreak}h to keep your 🔥`;
    else if (s.currentStreak >= 7) streakMessage = `${s.currentStreak} days! You're on fire! 🔥`;
    else if (s.currentStreak >= 3) streakMessage = `${s.currentStreak} day streak — great consistency!`;
    else streakMessage = `${s.currentStreak} day streak — keep it up!`;

    return {
      ...s,
      hoursUntilBreak,
      streakMessage,
    };
  }, [getStreak, trackerId, now]);

  /* ═══════════════════════════════════════════════════════════
     PREFILL DATA & SUGGESTIONS
     ═══════════════════════════════════════════════════════════ */

  const { prefillData, suggestions } = useMemo(() => {
    const prefill: Record<string, unknown> = {};
    const sugg: ProgressiveSuggestion[] = [];

    const yesterday = getYesterdayData(trackerId);
    if (yesterday && Object.keys(yesterday).length > 0) {
      Object.entries(yesterday).forEach(([fieldId, value]) => {
        if (value !== undefined && value !== '' && value !== null) {
          prefill[fieldId] = value;
          sugg.push({
            fieldId,
            value,
            source: 'yesterday',
            confidence: 95,
            label: 'Yesterday',
            emoji: '⏰',
          });
        }
      });
    }

    const patternSuggestions = getSmartSuggestions(trackerId) || {};
    Object.entries(patternSuggestions).forEach(([fieldId, value]) => {
      if (prefill[fieldId] === undefined && value !== undefined) {
        prefill[fieldId] = value;
        sugg.push({
          fieldId,
          value,
          source: 'pattern',
          confidence: 80,
          label: `Usually at ${timeContext.usualTimes[0] || 'this time'}`,
          emoji: '📊',
        });
      }
    });

    if (trackerConfig?.fields) {
      trackerConfig.fields.forEach((field) => {
        if (prefill[field.id] !== undefined) return;

        if (field.type === 'time' || field.type === 'datetime') {
          const nowTime = format(now, 'HH:mm');
          prefill[field.id] = nowTime;
          sugg.push({
            fieldId: field.id,
            value: nowTime,
            source: 'time_based',
            confidence: 100,
            label: 'Now',
            emoji: '🕐',
          });
        }
      });
    }

    const partnerEntry = trackerEntries.find(
      (e) =>
        e.loggedByRole === 'parent2' &&
        e.timestamp > subHours(now, 6).getTime()
    );
    if (partnerEntry) {
      Object.entries(partnerEntry.data || {}).forEach(([fieldId, value]) => {
        if (
          prefill[fieldId] === undefined &&
          value !== undefined &&
          value !== '' &&
          value !== null
        ) {
          sugg.push({
            fieldId,
            value,
            source: 'partner',
            confidence: 75,
            label: `Other parent: ${String(value).slice(0, 20)}`,
            emoji: '👤',
          });
        }
      });
    }

    const safeCorrelations = timelineCorrelations || [];
    safeCorrelations
      .filter((c) => {
        const relatedId = c.relatedEntry?.trackerId;
        const primaryId = c.primaryEntry?.trackerId;
        return relatedId === trackerId || primaryId === trackerId;
      })
      .forEach((c) => {
        if (trackerId === 'medication' && c.type === 'health_alert') {
          if (!prefill['reason']) {
            prefill['reason'] = 'Fever';
            sugg.push({
              fieldId: 'reason',
              value: 'Fever',
              source: 'correlation',
              confidence: 90,
              label: c.insight || 'Health alert detected',
              emoji: '🔗',
            });
          }
        }

        if (trackerId === 'sleep' && c.type === 'feed_sleep_pattern') {
          if (!prefill['sleepType']) {
            prefill['sleepType'] = 'nap';
            sugg.push({
              fieldId: 'sleepType',
              value: 'nap',
              source: 'correlation',
              confidence: 85,
              label: 'Post-feed nap detected',
              emoji: '🍼😴',
            });
          }
        }
      });

    return { prefillData: prefill, suggestions: sugg };
  }, [
    getYesterdayData,
    getSmartSuggestions,
    trackerEntries,
    timelineCorrelations,
    trackerId,
    timeContext,
    trackerConfig,
    now,
  ]);

  /* ═══════════════════════════════════════════════════════════
     TRENDS
     ═══════════════════════════════════════════════════════════ */

  const trends = useMemo(() => {
    const result: Record<string, ProgressiveTrend> = {};

    if (todayEntries.length > 0 && yesterdayEntries.length > 0) {
      const todayData = todayEntries[0].data || {};
      const yestData = yesterdayEntries[0].data || {};

      Object.keys({ ...todayData, ...yestData }).forEach((fieldId) => {
        const current = Number(todayData[fieldId]);
        const previous = Number(yestData[fieldId]);
        if (Number.isFinite(current) && Number.isFinite(previous)) {
          result[fieldId] = computeTrend(current, previous);
        }
      });
    }

    const yesterday = getYesterdayData(trackerId);
    if (yesterday) {
      Object.entries(yesterday).forEach(([fieldId, yestVal]) => {
        if (result[fieldId]) return; // Already computed
        const current = Number(prefillData[fieldId]);
        const previous = Number(yestVal);
        if (Number.isFinite(current) && Number.isFinite(previous)) {
          result[fieldId] = computeTrend(current, previous);
        }
      });
    }

    return result;
  }, [todayEntries, yesterdayEntries, prefillData, getYesterdayData, trackerId]);

  /* ═══════════════════════════════════════════════════════════
     INSIGHTS
     ═══════════════════════════════════════════════════════════ */

  const insights = useMemo(() => {
    const allInsights = getInsights() || [];
    const filtered = allInsights.filter(
      (i) =>
        i.trackerId === trackerId ||
        i.action?.trackerId === trackerId ||
        (i.type === 'correlation' && i.description?.toLowerCase().includes(trackerId))
    );
    return filtered;
  }, [getInsights, trackerId, refreshToken]);

  const hasNewInsights = useMemo(
    () => insights.some((i) => !i.dismissedAt && i.generatedAt > Date.now() - 24 * 60 * 60 * 1000),
    [insights]
  );

  /* ═══════════════════════════════════════════════════════════
     CORRELATIONS
     ═══════════════════════════════════════════════════════════ */

  const correlations = useMemo((): ProgressiveCorrelation[] => {
    const safeTimelineCorrelations = timelineCorrelations || [];
    return safeTimelineCorrelations
      .filter((c) => {
        const primaryId = c.primaryEntry?.trackerId;
        const relatedId = c.relatedEntry?.trackerId;
        return primaryId === trackerId || relatedId === trackerId;
      })
      .map((c) => {
        const primaryId = c.primaryEntry?.trackerId;
        const relatedId = c.relatedEntry?.trackerId;
        const isPrimary = primaryId === trackerId;
        const otherTrackerId = isPrimary ? relatedId : primaryId;
        const otherTracker = safeTrackers.find((t) => t.id === otherTrackerId);

        let action: ProgressiveCorrelation['action'] = 'view';
        let prefillData: Record<string, unknown> | undefined;

        if (trackerId === 'medication' && c.type === 'health_alert') {
          action = 'prefill';
          prefillData = { reason: 'Fever reducer', name: 'Acetaminophen' };
        } else if (trackerId === 'sleep' && c.type === 'feed_sleep_pattern') {
          action = 'prefill';
          prefillData = { sleepType: 'nap' };
        } else if (c.type === 'growth_milestone_correlation') {
          action = 'view';
        }

        return {
          id: c.id,
          trackerId: otherTrackerId || '',
          trackerName: otherTracker?.name || otherTrackerId || 'Unknown',
          trackerEmoji: otherTracker?.emoji || '🔗',
          emoji:
            c.type === 'feed_sleep_pattern'
              ? '🍼😴'
              : c.type === 'growth_milestone_correlation'
              ? '📏🏆'
              : c.type === 'health_alert'
              ? '🌡️💊'
              : '🔗',
          message: c.insight || 'Pattern detected',
          action,
          prefillData,
          confidence: Number.isFinite(c.confidence) ? c.confidence : 50,
        };
      });
  }, [timelineCorrelations, trackerId, safeTrackers]);

  /* ═══════════════════════════════════════════════════════════
     REMINDERS
     ═══════════════════════════════════════════════════════════ */

  const activeReminders = useMemo((): ProgressiveReminder[] => {
    const pending = getPendingReminders() || [];

    const safePredictiveReminders = predictiveReminders || [];
    const predictive = safePredictiveReminders
      .filter(
        (r: any) =>
          r.basedOn?.some((b: any) => b.trackerId === trackerId) ||
          r.suggestedTrackerId === trackerId
      )
      .map(
        (r: any): ProgressiveReminder => ({
          id: `pred_${r.id}`,
          title: r.title,
          body: r.description,
          emoji: r.emoji,
          priority: r.priority,
          type: 'predictive',
          actionButtons: [
            { id: 'log', label: 'Log Now', action: 'log_now' },
            { id: 'dismiss', label: 'Dismiss', action: 'dismiss' },
          ],
          dueAt: r.suggestedTime?.getTime?.() || r.suggestedTime,
        })
      );

    const all = [
      ...pending.map(
        (r): ProgressiveReminder => ({
          id: r.id,
          title: r.title,
          body: r.body,
          emoji: r.emoji,
          priority: r.condition?.then?.priority || 'normal',
          type: r.type,
          actionButtons: r.actionButtons?.map((b: any) => ({
            id: b.id,
            label: b.label,
            action: b.action,
          })),
        })
      ),
      ...predictive,
    ];

    return all;
  }, [getPendingReminders, predictiveReminders, trackerId]);

  const hasUrgentReminders = useMemo(
    () => activeReminders.some((r) => r.priority === 'high' || r.priority === 'urgent'),
    [activeReminders]
  );

  /* ═══════════════════════════════════════════════════════════
     TEMPLATES
     ═══════════════════════════════════════════════════════════ */

  const templates = useMemo((): ProgressiveTemplate[] => {
    const builtIn: ProgressiveTemplate[] = (trackerConfig?.templates || []).map((t: any) => ({
      ...t,
      source: 'builtin' as const,
    }));

    const autoGenerated: ProgressiveTemplate[] = [];

    if (
      trackerId === 'medication' &&
      correlations.some((c) => c.message.toLowerCase().includes('fever'))
    ) {
      autoGenerated.push({
        id: 'auto_fever_reducer',
        name: 'Fever Reducer',
        emoji: '🌡️',
        data: {
          name: 'Acetaminophen',
          dosage: '2.5ml',
          type: 'liquid',
          reason: 'Fever',
        },
        source: 'auto_generated',
      });
    }

    if (
      trackerId === 'sleep' &&
      correlations.some(
        (c) =>
          c.message.toLowerCase().includes('feed') &&
          c.message.toLowerCase().includes('sleep')
      )
    ) {
      autoGenerated.push({
        id: 'auto_nap',
        name: 'Post-Feed Nap',
        emoji: '😴',
        data: {
          sleepType: 'nap',
          location: 'crib',
        },
        source: 'auto_generated',
      });
    }

    return [...builtIn, ...userSavedTemplates, ...autoGenerated];
  }, [trackerConfig, userSavedTemplates, trackerId, correlations]);

  /* ═══════════════════════════════════════════════════════════
     COMPOSED STATE
     ═══════════════════════════════════════════════════════════ */

  const state: TrackerProgressiveState = useMemo(
    () => ({
      prefillData,
      suggestions,
      streak: streakData
        ? {
            trackerId,
            currentStreak: streakData.currentStreak,
            longestStreak: streakData.longestStreak,
            lastLoggedAt: streakData.lastLoggedAt,
            nextDueAt: (streakData as any).nextDueAt,
            isAtRisk: streakData.isAtRisk,
            goalProgress: (streakData as any).goalProgress,
          }
        : null,
      isAtRisk: streakData?.isAtRisk ?? false,
      hoursUntilBreak: streakData?.hoursUntilBreak ?? 0,
      streakMessage: streakData?.streakMessage ?? '',
      insights,
      hasNewInsights,
      correlations,
      activeReminders,
      hasUrgentReminders,
      templates,
      trends,
      timeContext,
      isLoading,
      lastUpdated: Date.now(),
    }),
    [
      prefillData,
      suggestions,
      streakData,
      insights,
      hasNewInsights,
      correlations,
      activeReminders,
      hasUrgentReminders,
      templates,
      trends,
      timeContext,
      isLoading,
      trackerId,
    ]
  );

  /* ═══════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════ */

  const applyAllYesterday = useCallback(() => {
    const yesterday = getYesterdayData(trackerId);
    return yesterday || {};
  }, [getYesterdayData, trackerId]);

  const dismissInsightById = useCallback(
    (insightId: string) => {
      dismissInsight(insightId);
      setRefreshToken((t) => t + 1);
    },
    [dismissInsight]
  );

  const refresh = useCallback(() => {
    setRefreshToken((t) => t + 1);
    setNow(new Date()); // Also refresh time
  }, []);

  return {
    ...state,
    applyAllYesterday,
    dismissInsight: dismissInsightById,
    refresh,
    todayEntries,
    yesterdayEntries,
    recentEntries,
  };
};

export default useTrackerProgressive;