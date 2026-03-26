import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Import UserRole and permissions from central location
import { UserRole, Permission, ROLE_PERMISSIONS } from '../types/roles';

// Use same keys as AuthContext for consistency
const SECURE_KEYS = {
  USER_PROFILE: 'littleloom_user_profile_secure',
  COMMUNITY_PROFILE: 'littleloom_community_profile_secure',
} as const;

const ASYNC_KEYS = {
  USER_PROFILE: 'littleloom_user_profile',
  COMMUNITY_PROFILE: 'littleloom_community_profile',
} as const;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      return true;
    } catch (error) {
      return false;
    }
  },
  async deleteItem(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      return false;
    }
  },
};

// Community-specific types
export interface CommunityProfile {
  userId: string;
  displayName: string;
  handle: string;
  bio: string;
  avatar?: string;
  location?: string;
  isVerified: boolean;
  joinDate: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
    helpful: number;
  };
  badges: CommunityBadge[];
  preferences: {
    isPublic: boolean;
    allowMessages: boolean;
    showLocation: boolean;
  };
}

export interface CommunityBadge {
  id: string;
  emoji: string;
  name: string;
  color: string;
  earnedAt: string;
}

// Updated to match AuthContext UserProfile exactly
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  role: UserRole | 'parent1' | 'parent2' | 'guardian';
  preferences: {
    notifications: boolean;
    darkMode: 'system' | 'light' | 'dark';
    units: 'metric' | 'imperial';
  };
  createdAt: string;
  lastLoginAt: string;
  // Community linkage
  communityProfile?: CommunityProfile;
}

interface UserState {
  isLoading: boolean;
  profile: UserProfile | null;
  communityProfile: CommunityProfile | null;
  permissions: Permission | null;
}

interface UserContextType extends UserState {
  // Family/Parent methods
  loadUser: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateAvatar: (uri: string) => Promise<void>;
  updatePreferences: (prefs: Partial<UserProfile['preferences']>) => Promise<void>;
  hasPermission: (action: keyof Permission) => boolean;
  canAccessFeature: (feature: string) => boolean;
  
  // Community methods
  loadCommunityProfile: (userId?: string) => Promise<CommunityProfile | null>;
  updateCommunityProfile: (updates: Partial<CommunityProfile>) => Promise<void>;
  toggleCommunityPrivacy: () => Promise<void>;
  getCommunityStats: () => Promise<CommunityProfile['stats']>;
  isCommunityProfileComplete: () => boolean;
  
  // Utility
  getDisplayName: () => string;
  getUserType: () => 'parent' | 'guardian' | 'community';
  clearUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

// Import useAuth - we'll use a mock for now if not available
// In real implementation, import from './AuthContext'
const useAuth = () => {
  // This is a placeholder - in real code, import from AuthContext
  // For now, return mock that will be overridden by actual import
  return {
    isAuthenticated: false,
    isLoading: false,
    userProfile: null as UserProfile | null,
    updateUserProfile: async (_updates: Partial<UserProfile>) => {},
  };
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to use actual AuthContext, fallback to mock if not available
  let auth;
  try {
    // Dynamic import to avoid circular dependency
    const AuthModule = require('./AuthContext');
    auth = AuthModule.useAuth();
  } catch (e) {
    auth = useAuth();
  }
  
  const { isAuthenticated, isLoading: authLoading, userProfile: authProfile, updateUserProfile: updateAuthProfile } = auth;
  
  const [state, setState] = useState<UserState>({
    isLoading: false,
    profile: null,
    communityProfile: null,
    permissions: null,
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadUser();
    } else if (!isAuthenticated) {
      setState({ isLoading: false, profile: null, communityProfile: null, permissions: null });
    }
  }, [isAuthenticated, authLoading]);

  const loadUser = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [secureData, asyncData, communitySecure, communityAsync] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(ASYNC_KEYS.USER_PROFILE),
        secureStorage.getItem(SECURE_KEYS.COMMUNITY_PROFILE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_PROFILE),
      ]);

      const profileStr = secureData || asyncData;
      const communityStr = communitySecure || communityAsync;
      
      let profile: UserProfile | null = null;
      let communityProfile: CommunityProfile | null = null;
      
      if (profileStr) {
        profile = JSON.parse(profileStr);
      } else if (authProfile) {
        // Use auth profile as base - ensure role compatibility
        profile = {
          ...authProfile,
          preferences: {
            notifications: true,
            darkMode: 'system',
            units: 'metric',
          },
          lastLoginAt: new Date().toISOString(),
        };
        await saveUserProfile(profile);
      }

      if (communityStr) {
        communityProfile = JSON.parse(communityStr);
      } else if (profile) {
        // Create default community profile
        communityProfile = createDefaultCommunityProfile(profile);
        await saveCommunityProfile(communityProfile);
      }

      // Calculate permissions based on role
      const role = profile?.role;
      let permissions: Permission | null = null;
      
      if (role) {
        // Handle both enum and string literal roles
        const roleKey = typeof role === 'string' ? role : UserRole[role as keyof typeof UserRole];
        permissions = ROLE_PERMISSIONS[role as UserRole] || ROLE_PERMISSIONS[UserRole.VIEWER];
      }

      setState({
        isLoading: false,
        profile,
        communityProfile,
        permissions,
      });
    } catch (error) {
      console.error('Error loading user:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authProfile]);

  const saveUserProfile = async (profile: UserProfile): Promise<void> => {
    await Promise.all([
      secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(profile)),
      AsyncStorage.setItem(ASYNC_KEYS.USER_PROFILE, JSON.stringify(profile)),
    ]);
  };

  const createDefaultCommunityProfile = (userProfile: UserProfile): CommunityProfile => ({
    userId: userProfile.id,
    displayName: userProfile.fullName,
    handle: `@${userProfile.fullName.toLowerCase().replace(/\\s+/g, '_')}_${userProfile.id.slice(0, 4)}`,
    bio: '',
    isVerified: false,
    joinDate: new Date().toISOString(),
    stats: {
      posts: 0,
      followers: 0,
      following: 0,
      helpful: 0,
    },
    badges: [],
    preferences: {
      isPublic: true,
      allowMessages: true,
      showLocation: false,
    },
  });

  const saveCommunityProfile = async (profile: CommunityProfile): Promise<void> => {
    await Promise.all([
      secureStorage.setItem(SECURE_KEYS.COMMUNITY_PROFILE, JSON.stringify(profile)),
      AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_PROFILE, JSON.stringify(profile)),
    ]);
  };

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!state.profile) return;
    
    try {
      const newProfile = { ...state.profile, ...updates };
      await saveUserProfile(newProfile);
      
      // Sync with AuthContext
      await updateAuthProfile(updates);
      
      // Recalculate permissions if role changed
      let permissions = state.permissions;
      if (updates.role) {
        permissions = ROLE_PERMISSIONS[updates.role as UserRole] || ROLE_PERMISSIONS[UserRole.VIEWER];
      }
      
      setState(prev => ({
        ...prev,
        profile: newProfile,
        permissions,
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  }, [state.profile, state.permissions, updateAuthProfile]);

  const updateAvatar = useCallback(async (uri: string) => {
    await updateProfile({ avatar: uri });
    // Also update community avatar if exists
    if (state.communityProfile) {
      await updateCommunityProfile({ avatar: uri });
    }
  }, [updateProfile, state.communityProfile]);

  const updatePreferences = useCallback(async (prefs: Partial<UserProfile['preferences']>) => {
    if (!state.profile) return;
    await updateProfile({
      preferences: { ...state.profile.preferences, ...prefs },
    });
  }, [state.profile, updateProfile]);

  const hasPermission = useCallback((action: keyof Permission): boolean => {
    return state.permissions?.[action] ?? false;
  }, [state.permissions]);

  const canAccessFeature = useCallback((feature: string): boolean => {
    const featurePermissions: Record<string, (p: Permission) => boolean> = {
      'add_baby': p => p.manageFamily,
      'delete_entry': p => p.delete,
      'export_data': p => p.exportData,
      'manage_security': p => p.manageSecurity,
      'invite_guardian': p => p.manageFamily && p.write,
      'community_post': () => true,
      'community_message': () => true,
    };
    return state.permissions ? featurePermissions[feature]?.(state.permissions) ?? true : false;
  }, [state.permissions]);

  // Community Methods
  const loadCommunityProfile = useCallback(async (userId?: string): Promise<CommunityProfile | null> => {
    // If no userId or matches current user, return own profile
    if (!userId || userId === state.profile?.id) {
      return state.communityProfile;
    }
    
    // TODO: Fetch other user's profile from API
    // For now, return null to indicate external profile
    return null;
  }, [state.communityProfile, state.profile]);

  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityProfile>) => {
    if (!state.communityProfile) return;
    
    try {
      const newProfile = { ...state.communityProfile, ...updates };
      await saveCommunityProfile(newProfile);
      setState(prev => ({ ...prev, communityProfile: newProfile }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update community profile');
    }
  }, [state.communityProfile]);

  const toggleCommunityPrivacy = useCallback(async () => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({
      preferences: {
        ...state.communityProfile.preferences,
        isPublic: !state.communityProfile.preferences.isPublic,
      },
    });
  }, [state.communityProfile, updateCommunityProfile]);

  const getCommunityStats = useCallback(async (): Promise<CommunityProfile['stats']> => {
    return state.communityProfile?.stats || { posts: 0, followers: 0, following: 0, helpful: 0 };
  }, [state.communityProfile]);

  const isCommunityProfileComplete = useCallback((): boolean => {
    if (!state.communityProfile) return false;
    return !!(
      state.communityProfile.bio &&
      state.communityProfile.displayName &&
      state.communityProfile.handle
    );
  }, [state.communityProfile]);

  const getDisplayName = useCallback((): string => {
    return state.communityProfile?.displayName || 
           state.profile?.fullName || 
           'Anonymous';
  }, [state.communityProfile, state.profile]);

  const getUserType = useCallback((): 'parent' | 'guardian' | 'community' => {
    if (!state.profile) return 'community';
    if (state.profile.role === UserRole.GUARDIAN || state.profile.role === 'guardian') return 'guardian';
    return 'parent';
  }, [state.profile]);

  const clearUserData = useCallback(async (): Promise<void> => {
    await Promise.all([
      secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
      secureStorage.deleteItem(SECURE_KEYS.COMMUNITY_PROFILE),
      AsyncStorage.removeItem(ASYNC_KEYS.USER_PROFILE),
      AsyncStorage.removeItem(ASYNC_KEYS.COMMUNITY_PROFILE),
    ]);
    setState({ isLoading: false, profile: null, communityProfile: null, permissions: null });
  }, []);

  const value = React.useMemo(() => ({
    ...state,
    loadUser,
    updateProfile,
    updateAvatar,
    updatePreferences,
    hasPermission,
    canAccessFeature,
    loadCommunityProfile,
    updateCommunityProfile,
    toggleCommunityPrivacy,
    getCommunityStats,
    isCommunityProfileComplete,
    getDisplayName,
    getUserType,
    clearUserData,
  }), [
    state, 
    loadUser, 
    updateProfile, 
    updateAvatar, 
    updatePreferences, 
    hasPermission, 
    canAccessFeature,
    loadCommunityProfile,
    updateCommunityProfile,
    toggleCommunityPrivacy,
    getCommunityStats,
    isCommunityProfileComplete,
    getDisplayName,
    getUserType,
    clearUserData,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};

export default UserProvider;