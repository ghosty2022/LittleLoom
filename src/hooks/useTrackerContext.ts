// src/hooks/useTrackerContext.ts
// FIX: Direct import pattern - no proxy issues

import { useContext } from 'react';
import { TrackerContext } from '../context/TrackerContext';

/**
 * useTracker - Safe hook for accessing tracker context
 * Must be used within a TrackerProvider
 */
export const useTracker = () => {
  const ctx = useContext(TrackerContext);
  if (!ctx) {
    throw new Error('useTracker must be used within TrackerProvider');
  }
  return ctx;
};

// Also export as default for consistency
export default useTracker;