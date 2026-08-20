// src/hooks/index.ts
// Safe context hooks - COMPLETE FIX with explicit exports

// First, export everything from useSafeContexts
export { 
  useSafeApp, 
  useSafeBaby, 
  useSafeAuth, 
  useSafeCustomization, 
  useSafeTracker,
  useSafeActivity,
  useSafeUser, // <-- ADD THIS
  useUnifiedTheme,
} from './useSafeContexts';

// Also export as default from useSafeContexts
export { default as useSafeContexts } from './useSafeContexts';

// Main hooks
export { useActivity } from './useActivity';
export { useAuth } from './useAuth';
export { useBaby } from '@/context/BabyContext';
export { useCustomization } from './useCustomization';
export { useFamily } from './useFamily';
export { useMedia } from './useMedia';
export { useNotifications } from './useNotifications';
export { useSafety } from './useSafety';
export { useSecurity } from './useSecurity';
export { useSupabase } from './useSupabase';
export { useSweetAlert } from './useSweetAlert';

// ─── useUser is now exported from useSafeContexts as useSafeUser
// For backward compatibility, we still export useUser
export { useSafeUser as useUser } from './useSafeContexts';

export { useUnifiedTrackerTheme } from './useUnifiedTrackerTheme';
export { useTracker } from './useTrackerContext';
export { useRouteBasedNavVisibility } from './useRouteBasedNavVisibility';
export { useActivityPersistence, useEmergencySave, useComponentPersistence } from './useActivityPersistence';
export { useAudioPlayer } from './useAudioPlayer';
export { useCountdown } from './useCountdown';
export { useDatabase } from './useDatabase';
export { useGrowthIntelligence } from './useGrowthIntelligence';
export { useIntelligentSplash } from './useIntelligentSplash';
export { useModal } from './useModal';
export { usePersistedForm, usePersistedScroll, usePersistedValue } from './usePersistedState';
export { usePhotoCapture } from './usePhotoCapture';
export { usePhotoScanner } from './usePhotoScanner';
export { usePredictiveReminders } from './usePredictiveReminders';
export { useReportRoute } from './useReportRoute';
export { useSmartAlbums } from './useSmartAlbums';
export { useSocialAuth } from './useSocialAuth';
export { useTimelineCorrelations } from './useTimelineCorrelations';
export { useTrackerAchievements } from './useTrackerAchievements';
export { useTrackerProgressive } from './useTrackerProgressive';
export { useWHOGrowthCalculator } from './useWHOGrowthCalculator';

// Re-export all from useSafeContexts as a namespace
export * as SafeContexts from './useSafeContexts';