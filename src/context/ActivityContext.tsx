













import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useTracker } from '@/hooks/useTrackerContext';
import type { TrackerEntry } from '@/types/trackers';


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

  
  syncWithBabyContext: (babyId: string | null) => Promise<void>;
  refreshEntries: () => Promise<void>;
  loadEntries: () => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  // Get tracker from the safe bridge hook (never throws)
  const tracker = useTracker();

  // ── CURRENT BABY SCOPE GUARD ─────────────────────────────────────
  // `tracker.entries` is populated asynchronously on baby switch. During
  // the refresh window it still contains the PREVIOUS baby's rows, which
  // made MoreScreen show a stale "Entries" count. We hard-scope it here
  // against the tracker's own current baby id so every consumer
  // (MoreScreen, HomeScreen, etc.) only ever sees the current baby's data.
  const trackerBabyId: string | null =
    typeof tracker?.getCurrentBabyId === 'function'
      ? (() => {
          try {
            return tracker.getCurrentBabyId();
          } catch {
            return null;
          }
        })()
      : null;

  const rawEntries = Array.isArray(tracker?.entries) ? tracker.entries : [];

  // When `trackerBabyId` is null (e.g. mid-sign-out), return []. When it's
  // present, keep only entries whose babyId matches. This also guards
  // against the tiny window where the tracker hasn't yet committed the
  // wipe for the new baby.
  const entries = useMemo(() => {
    if (!trackerBabyId) return [];
    return rawEntries.filter((e: any) => e?.babyId === trackerBabyId);
  }, [rawEntries, trackerBabyId]);

  const isLoading = !!tracker?.isLoading;
  
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