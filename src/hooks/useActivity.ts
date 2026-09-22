// src/hooks/useActivity.ts
// Safe wrapper — returns a fallback instead of throwing (matches the
// convention used by useTrackerContext, useSafeContexts, etc.)

import { useContext } from 'react';
import { ActivityContext } from '../context/ActivityContext';

function getFallbackActivity() {
  return {
    entries: [] as any[],
    isLoading: false,
    error: null as string | null,
    getEntriesByType: () => [] as any[],
    getEntriesByBaby: () => [] as any[],
    getEntriesByDateRange: () => [] as any[],
    getEntryById: () => undefined,
    getTodayCount: () => 0,
    getCurrentBabyId: () => null as string | null,
    syncWithBabyContext: async () => {},
    refreshEntries: async () => {},
    loadEntries: async () => {},
  };
}

export function useActivity() {
  try {
    const context = useContext(ActivityContext);
    if (context === undefined || context === null) {
      return getFallbackActivity();
    }
    return context;
  } catch {
    return getFallbackActivity();
  }
}

export default useActivity;