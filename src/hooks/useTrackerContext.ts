// src/hooks/useTrackerContext.ts
// FIX: Safe hook that returns a fallback instead of throwing

import { useContext } from 'react';
import { TrackerContext } from '../context/TrackerContext';

// ─── FALLBACK TRACKER CONTEXT ────────────────────────────────────────

function getFallbackTrackerContext() {
  return {
    isLoading: false,
    trackers: [],
    customTrackers: [],
    entries: [],
    entriesByTracker: {},
    lastTrackerId: null,
    currentBabyId: null,
    progressive: {
      todayEntries: [],
      yesterdayEntries: [],
      streaks: [],
      insights: [],
      pendingReminders: [],
      recentTemplates: [],
      detectedPatterns: [],
    },
    getTracker: () => undefined,
    getTrackersByCategory: () => [],
    searchTrackers: () => [],
    createCustomTracker: async () => null,
    updateCustomTracker: async () => false,
    deleteCustomTracker: async () => false,
    duplicateTracker: async () => null,
    addEntry: async () => null,
    updateEntry: async () => false,
    deleteEntry: async () => false,
    getEntries: (_trackerId?: string, _limit?: number) => [] as any[],
    getEntriesByDate: (_trackerId?: string, _date?: Date | string) => [] as any[],
    getEntryById: () => undefined,
    getTrackerStats: () => ({ totalEntries: 0, thisWeek: 0, thisMonth: 0, lastEntry: null, streakDays: 0 }),
    getTodaySummary: () => [] as any[],
    canUseTracker: () => false,
    canCreateEntry: () => false,
    canEditEntry: () => false,
    canDeleteEntry: () => false,
    getSmartSuggestions: (_trackerId?: string) => ({}) as Record<string, unknown>,
    getYesterdayData: (_trackerId?: string) => null as Record<string, unknown> | null,
    getStreak: (_trackerId?: string) => null as any,
    getInsights: () => [] as any[],
    dismissInsight: () => {},
    getPendingReminders: () => [],
    scheduleReminder: async () => '',
    cancelReminder: async () => {},
    snoozeReminder: async () => {},
    saveTemplate: async () => {},
    getTemplates: async (_trackerId?: string) => [] as any[],
    linkEntries: async (_id1?: string, _id2?: string, _relation?: string) => {},
    getLinkedEntries: () => [],
    syncToLegacyActivity: () => ({} as any),
    getLegacyActivities: () => [],
    syncFromBabyContext: async () => {},
    refreshTrackers: async () => {},
    refreshEntries: async () => {},
    setCurrentBabyId: () => {},
    // ─── Baby ID accessor ────────────────────────────────────
    getCurrentBabyId: () => null as string | null,
    getCustomTrackers: () => [],
    getSystemTrackers: () => [],
    getTrackerById: () => undefined,
    getTrackers: () => [],
    getEntriesByTrackerId: () => [],
    getRecentEntries: () => [],
    getTrackerEntries: () => [],
    getStreakDays: () => 0,
    getStreakForTracker: () => 0,
    getLastEntryForTracker: () => null,
    getTodayEntriesForTracker: () => [],
    applyAllYesterday: () => ({}),
    
  };
}

/**
 * useTracker - Safe hook for accessing tracker context
 * Returns a fallback if the context is not available
 */
export function useTracker() {
  try {
    const ctx = useContext(TrackerContext);
    if (!ctx) {
      return getFallbackTrackerContext();
    }
    return ctx;
  } catch {
    return getFallbackTrackerContext();
  }
}

export default useTracker;