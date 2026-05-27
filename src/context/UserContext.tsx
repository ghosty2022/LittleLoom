// src/context/UserContext.tsx
// FIXED VERSION - Addresses:
// 1. Race conditions in username registration
// 2. Atomic username operations
// 3. Better error handling
// 4. Consistent profile sync

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Import UserRole and permissions from central location
import { UserRole, Permission, ROLE_PERMISSIONS } from '../types/roles';

// Use same keys as AuthContext for consistency
const SECURE_KEYS = {
  USER_PROFILE: 'littleloom_user_profile_secure',
  COMMUNITY_PROFILE: 'littleloom_community_profile_secure',
  USERNAME_REGISTRY: 'littleloom_username_registry_secure',
} as const;

const ASYNC_KEYS = {
  USER_PROFILE: 'littleloom_user_profile',
  COMMUNITY_PROFILE: 'littleloom_community_profile',
  USERNAME_REGISTRY: 'littleloom_username_registry',
  PROFILE_SYNC_QUEUE: 'littleloom_profile_sync_queue',
} as const;

// Secure storage wrapper with better error handling
const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`SecureStore getItem failed for ${key}:`, error);
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
      console.warn(`SecureStore setItem failed for ${key}:`, error);
      return false;
    }
  },
  async deleteItem(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.warn(`SecureStore deleteItem failed for ${key}:`, error);
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
    selectedTopics: string[];
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

interface UsernameRegistry {
  [username: string]: string; // username -> userId mapping
}

interface UserState {
  isLoading: boolean;
  profile: UserProfile | null;
  communityProfile: CommunityProfile | null;
  permissions: Permission | null;
  usernameRegistry: UsernameRegistry;
}

// FIX: Default context value that NEVER throws — provides safe no-ops until Provider mounts
const DEFAULT_USER_STATE: UserState = {
  isLoading: true,
  profile: null,
  communityProfile: null,
  permissions: null,
  usernameRegistry: {},
};

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

  // Username security - FIXED: Atomic operations
  checkUsernameAvailable: (username: string, currentUserId?: string) => Promise<{ available: boolean; message: string }>;
  registerUsername: (username: string, userId: string) => Promise<boolean>;
  unregisterUsername: (username: string) => Promise<boolean>;
  // NEW: Atomic username update
  updateUsername: (oldUsername: string, newUsername: string, userId: string) => Promise<{ success: boolean; message: string }>;

  // Topic preferences
  updateSelectedTopics: (topics: string[]) => Promise<void>;
  getSelectedTopics: () => string[];

  // Profile sync
  syncProfileToPosts: () => Promise<void>;

  // Utility
  getDisplayName: () => string;
  getUserType: () => 'parent' | 'guardian' | 'community';
  clearUserData: () => Promise<void>;
}

// FIX: Create context with a default value that has all methods as no-ops
const createDefaultContextValue = (): UserContextType => ({
  ...DEFAULT_USER_STATE,
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
  checkUsernameAvailable: async () => ({ available: false, message: 'Loading...' }),
  registerUsername: async () => false,
  unregisterUsername: async () => false,
  updateUsername: async () => ({ success: false, message: 'Loading...' }),
  updateSelectedTopics: async () => {},
  getSelectedTopics: () => [],
  syncProfileToPosts: async () => {},
  getDisplayName: () => 'Anonymous',
  getUserType: () => 'community',
  clearUserData: async () => {},
});

const UserContext = createContext<UserContextType>(createDefaultContextValue());

// FIX: Import useAuth at module level to avoid dynamic require issues
let useAuthHook: any = null;
try {
  const AuthModule = require('./AuthContext');
  useAuthHook = AuthModule.useAuth;
} catch (e) {
  // AuthContext not available yet — will retry in provider
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthHook ? useAuthHook() : { 
    isAuthenticated: false, 
    isLoading: false, 
    userProfile: null, 
    updateUserProfile: async () => {} 
  };
  
  const { isAuthenticated, isLoading: authLoading, userProfile: authProfile, updateUserProfile: updateAuthProfile } = auth;

  const [state, setState] = useState<UserState>(DEFAULT_USER_STATE);
  const [isReady, setIsReady] = useState(false);
  const syncQueueRef = useRef<Partial<CommunityProfile>[]>([]);
  const initRef = useRef(false);
  // NEW: Lock for atomic username operations
  const usernameLockRef = useRef(false);

  // FIX: Load user data immediately on mount, don't wait for auth effect
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    const initialize = async () => {
      await loadUser();
      setIsReady(true);
    };
    
    initialize();
  }, []);

  // React to auth changes after initial load
  useEffect(() => {
    if (!isReady) return;
    
    if (isAuthenticated && !authLoading) {
      loadUser();
    } else if (!isAuthenticated) {
      setState(DEFAULT_USER_STATE);
    }
  }, [isAuthenticated, authLoading, isReady]);

  const loadUser = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [secureData, asyncData, communitySecure, communityAsync, registrySecure, registryAsync] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(ASYNC_KEYS.USER_PROFILE),
        secureStorage.getItem(SECURE_KEYS.COMMUNITY_PROFILE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_PROFILE),
        secureStorage.getItem(SECURE_KEYS.USERNAME_REGISTRY),
        AsyncStorage.getItem(ASYNC_KEYS.USERNAME_REGISTRY),
      ]);

      const profileStr = secureData || asyncData;
      const communityStr = communitySecure || communityAsync;
      const registryStr = registrySecure || registryAsync;

      let profile: UserProfile | null = null;
      let communityProfile: CommunityProfile | null = null;
      let usernameRegistry: UsernameRegistry = {};

      if (profileStr) {
        try { profile = JSON.parse(profileStr); } catch (e) { /* ignore parse error */ }
      }
      
      // Only use authProfile if no stored profile exists
      if (!profile && authProfile) {
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
        try { communityProfile = JSON.parse(communityStr); } catch (e) { /* ignore */ }
      } else if (profile) {
        communityProfile = createDefaultCommunityProfile(profile);
        await saveCommunityProfile(communityProfile);
      }

      if (registryStr) {
        try { usernameRegistry = JSON.parse(registryStr); } catch (e) { /* ignore */ }
      }

      // Calculate permissions based on role
      const role = profile?.role;
      let permissions: Permission | null = null;

      if (role) {
        const roleKey = typeof role === 'string' ? role : UserRole[role as keyof typeof UserRole];
        permissions = ROLE_PERMISSIONS[role as UserRole] || ROLE_PERMISSIONS[UserRole.VIEWER];
      }

      setState({
        isLoading: false,
        profile,
        communityProfile,
        permissions,
        usernameRegistry,
      });
    } catch (error) {
      console.error('Error loading user:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authProfile]);

  const saveUserProfile = async (profile: UserProfile): Promise<void> => {
    const profileStr = JSON.stringify(profile);
    await Promise.all([
      secureStorage.setItem(SECURE_KEYS.USER_PROFILE, profileStr),
      AsyncStorage.setItem(ASYNC_KEYS.USER_PROFILE, profileStr),
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
      selectedTopics: [],
    },
  });

  const saveCommunityProfile = async (profile: CommunityProfile): Promise<void> => {
    const profileStr = JSON.stringify(profile);
    await Promise.all([
      secureStorage.setItem(SECURE_KEYS.COMMUNITY_PROFILE, profileStr),
      AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_PROFILE, profileStr),
    ]);
  };

  const saveUsernameRegistry = async (registry: UsernameRegistry): Promise<void> => {
    const registryStr = JSON.stringify(registry);
    await Promise.all([
      secureStorage.setItem(SECURE_KEYS.USERNAME_REGISTRY, registryStr),
      AsyncStorage.setItem(ASYNC_KEYS.USERNAME_REGISTRY, registryStr),
    ]);
  };

  // FIXED: USERNAME SECURITY METHODS with atomic operations
  const checkUsernameAvailable = useCallback(async (
    username: string, 
    currentUserId?: string
  ): Promise<{ available: boolean; message: string }> => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');

    if (!trimmed) return { available: false, message: 'Username is required' };
    if (trimmed.length < 3) return { available: false, message: 'Username must be at least 3 characters' };
    if (trimmed.length > 30) return { available: false, message: 'Username must be less than 30 characters' };

    const validPattern = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
    if (!validPattern.test(trimmed)) {
      return { available: false, message: 'Must start with a letter. Only letters, numbers, underscores, and dots allowed.' };
    }

    if (/[_.]{2,}/.test(trimmed)) {
      return { available: false, message: 'Cannot contain consecutive special characters' };
    }

    if (/[_.]$/.test(trimmed)) {
      return { available: false, message: 'Cannot end with a special character' };
    }

    const reservedUsernames = ['admin', 'littleloom', 'support', 'official', 'mod', 'moderator', 'system'];
    if (reservedUsernames.includes(trimmed)) {
      return { available: false, message: 'This username is reserved' };
    }

    // Check registry
    const registry = state.usernameRegistry;
    const existingUserId = registry[trimmed];

    if (existingUserId && existingUserId !== currentUserId) {
      return { available: false, message: 'This username is already taken' };
    }

    return { available: true, message: 'Username is available' };
  }, [state.usernameRegistry]);

  // FIXED: Atomic username registration with lock
  const registerUsername = useCallback(async (username: string, userId: string): Promise<boolean> => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    
    // Wait for any ongoing operation
    while (usernameLockRef.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    usernameLockRef.current = true;
    
    try {
      // Re-check availability under lock
      const check = await checkUsernameAvailable(trimmed, userId);
      if (!check.available) {
        return false;
      }
      
      const newRegistry = { ...state.usernameRegistry, [trimmed]: userId };
      await saveUsernameRegistry(newRegistry);
      setState(prev => ({ ...prev, usernameRegistry: newRegistry }));
      return true;
    } finally {
      usernameLockRef.current = false;
    }
  }, [state.usernameRegistry, checkUsernameAvailable]);

  const unregisterUsername = useCallback(async (username: string): Promise<boolean> => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    
    while (usernameLockRef.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    usernameLockRef.current = true;
    
    try {
      const newRegistry = { ...state.usernameRegistry };
      delete newRegistry[trimmed];
      await saveUsernameRegistry(newRegistry);
      setState(prev => ({ ...prev, usernameRegistry: newRegistry }));
      return true;
    } finally {
      usernameLockRef.current = false;
    }
  }, [state.usernameRegistry]);

  // NEW: Atomic username update (unregister old + register new)
  const updateUsername = useCallback(async (
    oldUsername: string, 
    newUsername: string, 
    userId: string
  ): Promise<{ success: boolean; message: string }> => {
    while (usernameLockRef.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    usernameLockRef.current = true;
    
    try {
      // Validate new username
      const check = await checkUsernameAvailable(newUsername, userId);
      if (!check.available) {
        return { success: false, message: check.message };
      }
      
      // Unregister old
      const oldTrimmed = oldUsername.trim().toLowerCase().replace(/^@/, '');
      const newTrimmed = newUsername.trim().toLowerCase().replace(/^@/, '');
      
      const newRegistry = { ...state.usernameRegistry };
      delete newRegistry[oldTrimmed];
      newRegistry[newTrimmed] = userId;
      
      await saveUsernameRegistry(newRegistry);
      setState(prev => ({ ...prev, usernameRegistry: newRegistry }));
      
      return { success: true, message: 'Username updated successfully' };
    } catch (error) {
      console.error('updateUsername error:', error);
      return { success: false, message: 'Failed to update username' };
    } finally {
      usernameLockRef.current = false;
    }
  }, [state.usernameRegistry, checkUsernameAvailable]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!state.profile) return;

    try {
      const newProfile = { ...state.profile, ...updates };
      await saveUserProfile(newProfile);

      try {
        if (updateAuthProfile) {
          await updateAuthProfile(updates);
        }
      } catch (authError) {
        console.log('AuthContext sync failed, local storage is source of truth');
      }

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
      console.error('updateProfile error:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  }, [state.profile, state.permissions, updateAuthProfile]);

  const updateAvatar = useCallback(async (uri: string) => {
    await updateProfile({ avatar: uri });
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

  const loadCommunityProfile = useCallback(async (userId?: string): Promise<CommunityProfile | null> => {
    if (!userId || userId === state.profile?.id) {
      return state.communityProfile;
    }
    return null;
  }, [state.communityProfile, state.profile]);

  // FIXED: updateCommunityProfile with atomic username handling
  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityProfile>) => {
    if (!state.communityProfile) return;

    try {
      const newProfile = { ...state.communityProfile, ...updates };

      // Handle username change atomically
      if (updates.handle && updates.handle !== state.communityProfile.handle) {
        const oldHandle = state.communityProfile.handle.replace(/^@/, '');
        const newHandle = updates.handle.replace(/^@/, '');
        
        const result = await updateUsername(oldHandle, newHandle, state.communityProfile.userId);
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      await saveCommunityProfile(newProfile);
      setState(prev => ({ ...prev, communityProfile: newProfile }));
      syncQueueRef.current.push(updates);
    } catch (error) {
      console.error('updateCommunityProfile error:', error);
      Alert.alert('Error', 'Failed to update community profile');
    }
  }, [state.communityProfile, updateUsername]);

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

  const updateSelectedTopics = useCallback(async (topics: string[]) => {
    if (!state.communityProfile) return;

    const trimmedTopics = topics.slice(0, 5);

    const newProfile = {
      ...state.communityProfile,
      preferences: {
        ...state.communityProfile.preferences,
        selectedTopics: trimmedTopics,
      },
    };

    await saveCommunityProfile(newProfile);
    await AsyncStorage.setItem('@community_selected_topics', JSON.stringify(trimmedTopics));
    if (state.profile?.id) {
      await AsyncStorage.setItem(`@community_selected_topics_${state.profile.id}`, JSON.stringify(trimmedTopics));
    }

    setState(prev => ({ ...prev, communityProfile: newProfile }));
  }, [state.communityProfile, state.profile]);

  const getSelectedTopics = useCallback((): string[] => {
    return state.communityProfile?.preferences?.selectedTopics || [];
  }, [state.communityProfile]);

  const syncProfileToPosts = useCallback(async () => {
    if (!state.communityProfile || !state.profile) return;

    try {
      const postsData = await AsyncStorage.getItem('@community_posts');
      if (!postsData) return;

      const posts = JSON.parse(postsData);
      const userId = state.profile.id;

      const updatedPosts = posts.map((post: any) => {
        if (post.authorId === userId) {
          return {
            ...post,
            author: {
              ...post.author,
              displayName: state.communityProfile!.displayName,
              handle: state.communityProfile!.handle,
              avatar: state.communityProfile!.avatar || post.author.avatar,
              bio: state.communityProfile!.bio,
            },
          };
        }
        return post;
      });

      await AsyncStorage.setItem('@community_posts', JSON.stringify(updatedPosts));
    } catch (error) {
      console.error('syncProfileToPosts error:', error);
    }
  }, [state.communityProfile, state.profile]);

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
    if (state.communityProfile?.handle) {
      await unregisterUsername(state.communityProfile.handle);
    }

    await Promise.all([
      secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
      secureStorage.deleteItem(SECURE_KEYS.COMMUNITY_PROFILE),
      secureStorage.deleteItem(SECURE_KEYS.USERNAME_REGISTRY),
      AsyncStorage.removeItem(ASYNC_KEYS.USER_PROFILE),
      AsyncStorage.removeItem(ASYNC_KEYS.COMMUNITY_PROFILE),
      AsyncStorage.removeItem(ASYNC_KEYS.USERNAME_REGISTRY),
      AsyncStorage.removeItem(ASYNC_KEYS.PROFILE_SYNC_QUEUE),
    ]);
    setState(DEFAULT_USER_STATE);
  }, [state.communityProfile, unregisterUsername]);

  // FIX: Memoize value so it's stable and immediately available to children
  const value = useMemo(() => ({
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
    checkUsernameAvailable,
    registerUsername,
    unregisterUsername,
    updateUsername,
    updateSelectedTopics,
    getSelectedTopics,
    syncProfileToPosts,
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
    checkUsernameAvailable,
    registerUsername,
    unregisterUsername,
    updateUsername,
    updateSelectedTopics,
    getSelectedTopics,
    syncProfileToPosts,
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

// FIX: Safe useUser that never throws during initialization
export const useUser = () => {
  const context = useContext(UserContext);
  return context;
};

export default UserProvider;