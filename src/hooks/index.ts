// src/hooks/index.ts
// Safe context hooks - COMPLETE FIX with explicit exports

import { useContext } from 'react';
import { UserContext } from '../context/UserContext';

// First, export everything from useSafeContexts
export { 
  useSafeApp, 
  useSafeBaby, 
  useSafeAuth, 
  useSafeCustomization, 
  useSafeTracker,
  useSafeActivity,
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

// ─── DEFINE useUser DIRECTLY HERE ──────────────────────────────────────
// This avoids the circular dependency through UserContext.tsx
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    // Return safe default
    return {
      isLoading: false,
      profile: null,
      communityProfile: null,
      permissions: null,
      usernameRegistry: {},
      isReady: false,
      loadUser: async () => {},
      updateProfile: async () => {},
      updateAvatar: async () => {},
      updatePreferences: async () => {},
      hasPermission: () => false,
      canAccessFeature: () => false,
      loadCommunityProfile: async () => null,
      updateCommunityProfile: async () => {},
      toggleCommunityPrivacy: async () => {},
      getCommunityStats: async () => ({ posts: 0, followers: 0, following: 0, helpful: 0 }),
      isCommunityProfileComplete: () => false,
      checkUsernameAvailable: async () => ({ available: false, message: 'Not available' }),
      registerUsername: async () => false,
      unregisterUsername: async () => false,
      updateUsername: async () => ({ success: false, message: '' }),
      updateSelectedTopics: async () => {},
      getSelectedTopics: () => [],
      syncProfileToPosts: async () => {},
      getDisplayName: () => 'Anonymous',
      getUserType: () => 'community' as const,
      clearUserData: async () => {},
      updateCommunityDisplayName: async () => {},
      updateCommunityBio: async () => {},
      updateCommunityAvatar: async () => {},
      updateCommunityHandle: async () => ({ success: false, message: '' }),
      getCommunityHandle: () => '',
      syncWithAuthProfile: async () => {},
      getAuthProfile: () => null,
    };
  }
  return context;
};
// ──────────────────────────────────────────────────────────────────────

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