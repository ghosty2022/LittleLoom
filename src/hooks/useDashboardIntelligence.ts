// src/hooks/useDashboardIntelligence.ts
import { useMemo, useCallback } from 'react';
import { differenceInDays, subDays, startOfDay, endOfDay } from 'date-fns';

import { useTracker } from './useTrackerContext';
import { useBaby } from '../context/BabyContext';
import { useGrowthIntelligence } from './useGrowthIntelligence';
import { usePredictiveReminders } from './usePredictiveReminders';
import { useTimelineCorrelations } from './useTimelineCorrelations';
import type { TrackerEntry } from '../types/trackers';

// ─── TYPES ─────────────────────────────────────────────────────────────

export interface WellnessScore {
  overall: number;
  nutrition: number;
  sleep: number;
  activity: number;
  hydration: number;
}

export interface SleepQuality {
  score: number;
  totalHours: number;
  longestStretch: number;
  wakeCount: number;
  trend: 'up' | 'down' | 'stable';
}

export interface FeedingPattern {
  avgInterval: number;
  totalVolume: number;
  lastSide: string;
  nextFeedEstimate: string;
}

export interface DailyGoal {
  id: string;
  label: string;
  icon: string;
  target: number;
  current: number;
  color: string;
  unit: string;
}

export interface DashboardIntelligence {
  // Stats
  todayCount: number;
  weekTotal: number;
  avgPerDay: number;
  totalEntries: number;
  
  // Wellness
  wellnessScore: WellnessScore;
  
  // Sleep
  sleepQuality: SleepQuality | null;
  
  // Feeding
  feedingPattern: FeedingPattern | null;
  
  // Goals
  dailyGoals: DailyGoal[];
  completedGoals: number;
  
  // Streak
  streakDays: number;
  isStreakAtRisk: boolean;
  hoursUntilBreak: number;
  
  // Predictive
  nextEvents: Array<{
    id: string;
    trackerId: string;
    label: string;
    emoji: string;
    color: string;
    dueInMinutes: number;
    predictedTime: string;
    confidence: number;
  }>;
  
  // Raw data for components
  entries: TrackerEntry[];
  todayEntries: TrackerEntry[];
  weekEntries: TrackerEntry[];
}

// ─── FALLBACK STATE ──────────────────────────────────────────────────

const DEFAULT_WELLNESS: WellnessScore = {
  overall: 0,
  nutrition: 0,
  sleep: 0,
  activity: 0,
  hydration: 0,
};

const EMPTY_INTELLIGENCE: DashboardIntelligence = {
  todayCount: 0,
  weekTotal: 0,
  avgPerDay: 0,
  totalEntries: 0,
  wellnessScore: DEFAULT_WELLNESS,
  sleepQuality: null,
  feedingPattern: null,
  dailyGoals: [],
  completedGoals: 0,
  streakDays: 0,
  isStreakAtRisk: false,
  hoursUntilBreak: 0,
  nextEvents: [],
  entries: [],
  todayEntries: [],
  weekEntries: [],
};

// ─── HOOK ─────────────────────────────────────────────────────────────

export function useDashboardIntelligence(): DashboardIntelligence {
  try {
    // SAFE: Try to get tracker context, but don't crash if it fails
    let trackerResult;
    try {
      trackerResult = useTracker();
    } catch {
      return EMPTY_INTELLIGENCE;
    }

    // SAFE: Check if we got a valid result
    const entries = Array.isArray(trackerResult?.entries) ? trackerResult.entries : [];
    const getEntries = trackerResult?.getEntries || (() => []);

    // SAFE: Try to get baby context
    let currentBaby = null;
    try {
      const babyResult = useBaby();
      currentBaby = babyResult?.currentBaby || null;
    } catch {
      // Baby context not available, continue with null
    }

    // SAFE: Optional hooks that might not be available
    let growthIndex = null;
    let reminders = [];
    let correlations = [];
    try {
      const growth = useGrowthIntelligence();
      growthIndex = growth?.growthIndex || null;
    } catch {
      // Growth intelligence not available
    }

    try {
      const pred = usePredictiveReminders();
      reminders = Array.isArray(pred?.reminders) ? pred.reminders : [];
    } catch {
      // Predictive reminders not available
    }

    try {
      const corr = useTimelineCorrelations();
      correlations = Array.isArray(corr?.correlations) ? corr.correlations : [];
    } catch {
      // Timeline correlations not available
    }

    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const weekAgo = subDays(now, 7).getTime();

    // Filter entries safely
    const allEntries = entries;
    const todayEntries = allEntries.filter(e => e?.timestamp >= todayStart);
    const weekEntries = allEntries.filter(e => e?.timestamp >= weekAgo);

    // Today count
    const todayCount = todayEntries.length;

    // Week stats
    const weekTotal = weekEntries.length;
    const avgPerDay = weekTotal > 0 ? Math.round((weekTotal / 7) * 10) / 10 : 0;
    const totalEntries = allEntries.length;

    // ── Wellness Score ──
    const wellnessScore = useMemo((): WellnessScore => {
      const feedCount = todayEntries.filter(e => e?.trackerId === 'feed').length;
      const sleepMins = todayEntries
        .filter(e => e?.trackerId === 'sleep')
        .reduce((sum, e) => sum + (e?.duration || 0), 0);
      const diaperCount = todayEntries.filter(e => e?.trackerId === 'diaper').length;
      const milestoneCount = todayEntries.filter(e => e?.trackerId === 'milestone').length;

      const nutrition = Math.min(100, Math.round((feedCount / 8) * 100));
      const sleep = Math.min(100, Math.round((sleepMins / 840) * 100));
      const activity = Math.min(100, Math.round((milestoneCount / 3) * 100));
      const hydration = Math.min(100, Math.round((diaperCount / 6) * 100));

      return {
        overall: Math.min(100, Math.round((nutrition + sleep + activity + hydration) / 4)),
        nutrition,
        sleep,
        activity,
        hydration,
      };
    }, [todayEntries]);

    // ── Sleep Quality ──
    const sleepQuality = useMemo((): SleepQuality | null => {
      const sleepEntries = allEntries
        .filter(e => e?.trackerId === 'sleep')
        .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
        .slice(0, 7);

      if (sleepEntries.length === 0) return null;

      const totalHours = sleepEntries.reduce((sum, e) => sum + (e?.duration || 0), 0) / 60;
      const durations = sleepEntries.map(e => e?.duration || 0);
      const longestStretch = Math.max(...durations) / 60;
      const avgDuration = sleepEntries.length > 0 ? totalHours / sleepEntries.length : 0;
      const wakeCount = sleepEntries.filter(e => e?.data?.status === 'ended').length;

      const recent = durations.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, durations.length);
      const older = durations.slice(3, 6).reduce((a, b) => a + b, 0) / Math.min(3, durations.length - 3);
      const trend = recent > older * 1.1 ? 'up' : recent < older * 0.9 ? 'down' : 'stable';

      const score = Math.min(100, Math.round(
        (Math.min(avgDuration / 14, 1)) * 40 + 
        (Math.min(longestStretch / 6, 1)) * 30 + 
        (1 - Math.min(wakeCount / 5, 1)) * 30
      ));

      return {
        score,
        totalHours: Math.round(totalHours * 10) / 10,
        longestStretch: Math.round(longestStretch * 10) / 10,
        wakeCount,
        trend,
      };
    }, [allEntries]);

    // ── Feeding Pattern ──
    const feedingPattern = useMemo((): FeedingPattern | null => {
      const feedEntries = allEntries
        .filter(e => e?.trackerId === 'feed')
        .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
        .slice(0, 10);

      if (feedEntries.length < 2) return null;

      const intervals: number[] = [];
      for (let i = 0; i < feedEntries.length - 1; i++) {
        const diff = ((feedEntries[i]?.timestamp || 0) - (feedEntries[i + 1]?.timestamp || 0)) / 3600000;
        if (diff > 0 && diff < 12) intervals.push(diff);
      }

      const avgInterval = intervals.length > 0 
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length * 10) / 10 
        : 3;

      const totalVolume = feedEntries.reduce((sum, e) => sum + (e?.amount || e?.value || 120), 0);
      const lastEntry = feedEntries[0];
      const lastSide = lastEntry?.data?.side === 'left' ? 'left' 
        : lastEntry?.data?.side === 'right' ? 'right' 
        : lastEntry?.data?.feedType === 'bottle' ? 'bottle' 
        : lastEntry?.data?.feedType === 'solid' ? 'solid' 
        : 'left';
      
      const nextFeed = new Date((lastEntry?.timestamp || Date.now()) + avgInterval * 3600000);

      return {
        avgInterval,
        totalVolume,
        lastSide,
        nextFeedEstimate: formatTime(nextFeed),
      };
    }, [allEntries]);

    // ── Daily Goals ──
    const dailyGoals = useMemo((): DailyGoal[] => {
      return [
        {
          id: 'feed-goal',
          label: 'Feeds',
          icon: '🍼',
          target: 8,
          current: todayEntries.filter(e => e?.trackerId === 'feed').length,
          color: '#fa709a',
          unit: 'feeds',
        },
        {
          id: 'sleep-goal',
          label: 'Sleep',
          icon: '🌙',
          target: 14,
          current: Math.floor(todayEntries.filter(e => e?.trackerId === 'sleep').reduce((sum, e) => sum + (e?.duration || 0), 0) / 60),
          color: '#11998e',
          unit: 'hrs',
        },
        {
          id: 'diaper-goal',
          label: 'Diapers',
          icon: '👶',
          target: 6,
          current: todayEntries.filter(e => e?.trackerId === 'diaper').length,
          color: '#8B5CF6',
          unit: 'changes',
        },
        {
          id: 'milestone-goal',
          label: 'Moments',
          icon: '🏆',
          target: 1,
          current: todayEntries.filter(e => e?.trackerId === 'milestone').length,
          color: '#ffd700',
          unit: 'logs',
        },
      ];
    }, [todayEntries]);

    const completedGoals = dailyGoals.filter(g => g.current >= g.target).length;

    // ── Streak ──
    const streakDays = useMemo(() => {
      let streak = 0;
      let date = new Date();
      while (true) {
        const dayStart = startOfDay(date).getTime();
        const dayEnd = endOfDay(date).getTime();
        const hasEntry = allEntries.some(e => (e?.timestamp || 0) >= dayStart && (e?.timestamp || 0) <= dayEnd);
        if (hasEntry) {
          streak++;
          date = subDays(date, 1);
        } else {
          break;
        }
      }
      return streak;
    }, [allEntries]);

    const isStreakAtRisk = streakDays > 0 && todayCount === 0;
    const hoursUntilBreak = isStreakAtRisk ? 24 - now.getHours() : 0;

    // ── Next Events ──
    const nextEvents = useMemo(() => {
      const events: DashboardIntelligence['nextEvents'] = [];
      const nowTime = Date.now();

      // Feed prediction
      const feedEntries = allEntries.filter(e => e?.trackerId === 'feed').sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
      if (feedEntries.length >= 2) {
        const avgGap = ((feedEntries[0]?.timestamp || 0) - (feedEntries[Math.min(3, feedEntries.length - 1)]?.timestamp || 0)) / 
          Math.min(3, feedEntries.length - 1);
        const nextFeed = (feedEntries[0]?.timestamp || 0) + avgGap;
        const dueIn = Math.max(0, Math.floor((nextFeed - nowTime) / 60000));
        if (dueIn < 180) {
          events.push({
            id: 'next-feed',
            trackerId: 'feed',
            label: 'Next Feed',
            emoji: '🍼',
            color: '#fa709a',
            dueInMinutes: dueIn,
            predictedTime: formatTime(new Date(nextFeed)),
            confidence: Math.min(95, 60 + feedEntries.length * 5),
          });
        }
      }

      // Sleep prediction
      const sleepEntries = allEntries.filter(e => e?.trackerId === 'sleep').sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
      if (sleepEntries.length >= 2) {
        const lastSleep = sleepEntries[0];
        const avgWakeWindow = 3 * 60;
        const nextSleep = (lastSleep?.timestamp || 0) + (lastSleep?.duration || avgWakeWindow) * 60000;
        const dueIn = Math.max(0, Math.floor((nextSleep - nowTime) / 60000));
        if (dueIn < 240) {
          events.push({
            id: 'next-sleep',
            trackerId: 'sleep',
            label: 'Next Sleep',
            emoji: '🌙',
            color: '#11998e',
            dueInMinutes: dueIn,
            predictedTime: formatTime(new Date(nextSleep)),
            confidence: Math.min(90, 50 + sleepEntries.length * 4),
          });
        }
      }

      // Diaper prediction
      const diaperEntries = allEntries.filter(e => e?.trackerId === 'diaper').sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
      if (diaperEntries.length >= 2) {
        const avgGap = ((diaperEntries[0]?.timestamp || 0) - (diaperEntries[Math.min(5, diaperEntries.length - 1)]?.timestamp || 0)) / 
          Math.min(5, diaperEntries.length - 1);
        const nextDiaper = (diaperEntries[0]?.timestamp || 0) + avgGap;
        const dueIn = Math.max(0, Math.floor((nextDiaper - nowTime) / 60000));
        if (dueIn < 120) {
          events.push({
            id: 'next-diaper',
            trackerId: 'diaper',
            label: 'Next Diaper',
            emoji: '👶',
            color: '#8B5CF6',
            dueInMinutes: dueIn,
            predictedTime: formatTime(new Date(nextDiaper)),
            confidence: Math.min(85, 55 + diaperEntries.length * 3),
          });
        }
      }

      return events.sort((a, b) => a.dueInMinutes - b.dueInMinutes).slice(0, 3);
    }, [allEntries]);

    return {
      todayCount,
      weekTotal,
      avgPerDay,
      totalEntries,
      wellnessScore,
      sleepQuality,
      feedingPattern,
      dailyGoals,
      completedGoals,
      streakDays,
      isStreakAtRisk,
      hoursUntilBreak,
      nextEvents,
      entries: allEntries,
      todayEntries,
      weekEntries,
    };

  } catch (error) {
    // FALLBACK: If ANY error occurs, return empty intelligence
    console.warn('[useDashboardIntelligence] Error, returning fallback:', error);
    return EMPTY_INTELLIGENCE;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}