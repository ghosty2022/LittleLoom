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
    getEntries: () => [],
    getEntriesByDate: () => [],
    getEntryById: () => undefined,
    getTrackerStats: () => ({ totalEntries: 0, thisWeek: 0, thisMonth: 0, lastEntry: null, streakDays: 0 }),
    getTodaySummary: () => [],
    canUseTracker: () => false,
    canCreateEntry: () => false,
    canEditEntry: () => false,
    canDeleteEntry: () => false,
    getSmartSuggestions: () => ({}),
    getYesterdayData: () => null,
    getStreak: () => undefined,
    getInsights: () => [],
    dismissInsight: () => {},
    getPendingReminders: () => [],
    scheduleReminder: async () => '',
    cancelReminder: async () => {},
    snoozeReminder: async () => {},
    saveTemplate: async () => {},
    getTemplates: async () => [],
    linkEntries: async () => {},
    getLinkedEntries: () => [],
    syncToLegacyActivity: () => ({} as any),
    getLegacyActivities: () => [],
    syncFromBabyContext: async () => {},
    refreshTrackers: async () => {},
    refreshEntries: async () => {},
    setCurrentBabyId: () => {},
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