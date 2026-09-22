// src/context/ActivityContext.tsx
// DEPRECATED: This context is now a read-only adapter for TrackerContext.
// All data management should go through TrackerContext.

import React, { createContext, useContext, useMemo } from 'react';
import { useTracker } from '../hooks/useTrackerContext';
import { TrackerEntry } from '../types/trackers';

// The ActivityEntry type is now an alias for TrackerEntry for backward compatibility.
export type ActivityEntry = TrackerEntry;

interface ActivityContextType {
  entries: ActivityEntry[];
  isLoading: boolean;
  error: string | null;

  getEntriesByType: (type: string, babyId?: string) => ActivityEntry[];
  getEntriesByBaby: (babyId: string) => ActivityEntry[];
  getEntriesByDateRange: (startDate: number, endDate: number, babyId?: string) => ActivityEntry[];
  getEntryById: (id: string) => ActivityEntry | undefined;
  getTodayCount: (type: string, babyId?: string) => number;
  getCurrentBabyId: () => string | null;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ children }: { children: React.ReactNode }): JSX.Element {
  // Read all data directly from the single source of truth: TrackerContext
  const {
    entries,
    isLoading,
    getEntries,
    getEntriesByDate,
    getEntryById: getTrackerEntryById,
    getCurrentBabyId,
    getTodaySummary,
  } = useTracker();

  const getTodayCount = React.useCallback((type: string, babyId?: string) => {
    // Defensive: fallback context may not implement getTodaySummary
    if (typeof getTodaySummary !== 'function') return 0;
    const summary = getTodaySummary() || [];
    return summary.find(item => item.trackerId === type)?.count || 0;
  }, [getTodaySummary]);

  const value = useMemo<ActivityContextType>(() => ({
    entries: Array.isArray(entries) ? entries : [],
    isLoading: !!isLoading,
    error: null, // Errors are handled by TrackerContext
    getEntriesByType: (type, babyId) =>
      (typeof getEntries === 'function' ? getEntries(type) || [] : [])
        .filter(e => !babyId || e.babyId === babyId),
    getEntriesByBaby: (babyId) =>
      (typeof getEntries === 'function' ? getEntries() || [] : [])
        .filter(e => e.babyId === babyId),
    getEntriesByDateRange: (start, end, babyId) =>
      (typeof getEntries === 'function' ? getEntries() || [] : [])
        .filter(e => e.timestamp >= start && e.timestamp <= end && (!babyId || e.babyId === babyId)),
    getEntryById: (id) => (typeof getTrackerEntryById === 'function' ? getTrackerEntryById(id) : undefined),
    getTodayCount,
    getCurrentBabyId: typeof getCurrentBabyId === 'function' ? getCurrentBabyId : () => null,
  }), [entries, isLoading, getEntries, getTrackerEntryById, getTodayCount, getCurrentBabyId]);

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity(): ActivityContextType {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}

export default ActivityContext;