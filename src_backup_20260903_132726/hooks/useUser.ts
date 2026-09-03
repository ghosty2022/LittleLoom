// src/hooks/useUser.ts
import { useContext } from 'react';
import { UserContext } from '../context/UserContext';

// This is a safe wrapper that doesn't throw
export const useUser = () => {
  try {
    const context = useContext(UserContext);
    if (!context) {
      return getFallbackUserContext();
    }
    return context;
  } catch (e) {
    return getFallbackUserContext();
  }
};

function getFallbackUserContext() {
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

export default useUser;