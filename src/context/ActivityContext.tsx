// src/context/ActivityContext.tsx
// ─────────────────────────────────────────────────────────────────────
// DEPRECATED pass-through adapter.
//
// TrackerContext is the single source of truth for all entries.
// This context exists ONLY so legacy screens that still call
// `useActivity()` continue to work.
//
// It:
//   • Reads `entries` from useTracker() during render (no state copy)
//   • Exposes no-op bridge methods (`syncWithBabyContext`, `loadEntries`)
//   • Never throws — safe to consume outside a provider (returns fallback)
// ─────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useTracker } from '@/hooks/useTrackerContext';
import type { TrackerEntry } from '@/types/trackers';

// ActivityEntry is a legacy alias for TrackerEntry.
export type ActivityEntry = TrackerEntry;

interface ActivityContextType {
  entries: ActivityEntry[];
  isLoading: boolean;
  error: string | null;

  getEntriesByType: (type: string, babyId?: string) => ActivityEntry[];
  getEntriesByBaby: (babyId: string) => ActivityEntry[];
  getEntriesByDateRange: (start: number, end: number, babyId?: string) => ActivityEntry[];
  getEntryById: (id: string) => ActivityEntry | undefined;
  getTodayCount: (type: string, babyId?: string) => number;
  getCurrentBabyId: () => string | null;

  // Bridge shims for ContextProvider's ActivitySyncBridge
  syncWithBabyContext: (babyId: string | null) => Promise<void>;
  refreshEntries: () => Promise<void>;
  loadEntries: () => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  // Read everything from TrackerContext. Never copy to local state.
  const tracker = useTracker();

  const entries = Array.isArray(tracker?.entries) ? tracker.entries : [];
  const isLoading = !!tracker?.isLoading;

  // ─── Passthroughs that are safe if tracker methods are missing ───
  const getEntriesSafe = useCallback(
    (trackerId?: string): ActivityEntry[] => {
      if (typeof tracker?.getEntries !== 'function') return [];
      try {
        const list = tracker.getEntries(trackerId);
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
    [tracker?.getEntries]
  );

  const getTodaySummarySafe = useCallback(() => {
    if (typeof tracker?.getTodaySummary !== 'function') return [];
    try {
      const summary = tracker.getTodaySummary();
      return Array.isArray(summary) ? summary : [];
    } catch {
      return [];
    }
  }, [tracker?.getTodaySummary]);

  const getCurrentBabyIdSafe = useCallback((): string | null => {
    if (typeof tracker?.getCurrentBabyId === 'function') {
      try {
        return tracker.getCurrentBabyId();
      } catch {
        return null;
      }
    }
    return null;
  }, [tracker?.getCurrentBabyId]);

  const refreshEntries = useCallback(async () => {
    if (typeof tracker?.refreshEntries === 'function') {
      try {
        await tracker.refreshEntries();
      } catch (e) {
        if (__DEV__) console.warn('[ActivityContext] refreshEntries failed:', e);
      }
    }
  }, [tracker?.refreshEntries]);

  const loadEntries = useCallback(async () => {
    await refreshEntries();
  }, [refreshEntries]);

  const syncWithBabyContext = useCallback(
    async (_babyId: string | null) => {
      // TrackerContext already subscribes to baby changes internally.
      // This is a no-op shim so the ActivitySyncBridge in
      // ContextProvider doesn't crash. If a real refresh is needed,
      // trigger it manually.
      await refreshEntries();
    },
    [refreshEntries]
  );

  const value = useMemo<ActivityContextType>(
    () => ({
      entries,
      isLoading,
      error: null,
      getEntriesByType: (type, babyId) =>
        getEntriesSafe(type).filter((e) => !babyId || e.babyId === babyId),
      getEntriesByBaby: (babyId) =>
        getEntriesSafe().filter((e) => e.babyId === babyId),
      getEntriesByDateRange: (start, end, babyId) =>
        getEntriesSafe().filter(
          (e) =>
            e.timestamp >= start &&
            e.timestamp <= end &&
            (!babyId || e.babyId === babyId)
        ),
      getEntryById: (id) =>
        typeof tracker?.getEntryById === 'function'
          ? tracker.getEntryById(id)
          : undefined,
      getTodayCount: (type: string) => {
        const summary = getTodaySummarySafe();
        return summary.find((item: any) => item.trackerId === type)?.count || 0;
      },
      getCurrentBabyId: getCurrentBabyIdSafe,
      syncWithBabyContext,
      refreshEntries,
      loadEntries,
    }),
    [
      entries,
      isLoading,
      getEntriesSafe,
      getTodaySummarySafe,
      getCurrentBabyIdSafe,
      tracker?.getEntryById,
      syncWithBabyContext,
      refreshEntries,
      loadEntries,
    ]
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

/**
 * Safe hook — never throws. Returns a fallback if the provider
 * isn't mounted (e.g., during early bootstrap or in tests).
 */
export function useActivity(): ActivityContextType {
  const ctx = useContext(ActivityContext);
  if (ctx !== undefined) return ctx;

  // ─── Fallback (no provider mounted) ──────────────────────────
  return {
    entries: [],
    isLoading: false,
    error: null,
    getEntriesByType: () => [],
    getEntriesByBaby: () => [],
    getEntriesByDateRange: () => [],
    getEntryById: () => undefined,
    getTodayCount: () => 0,
    getCurrentBabyId: () => null,
    syncWithBabyContext: async () => {},
    refreshEntries: async () => {},
    loadEntries: async () => {},
  };
}

export default ActivityContext;