// src/context/UserContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { UserRole, Permission, ROLE_PERMISSIONS } from '../types/roles';
import { useAuth } from './AuthContext';

const SECURE_KEYS = {
  USER_PROFILE: 'littleloom_user_profile_secure',
  COMMUNITY_PROFILE: 'littleloom_community_profile_secure',
  USERNAME_REGISTRY: 'littleloom_username_registry_secure',
} as const;

const ASYNC_KEYS = {
  COMMUNITY_PROFILE: 'littleloom_community_profile',
  USERNAME_REGISTRY: 'littleloom_username_registry',
  PROFILE_SYNC_QUEUE: 'littleloom_profile_sync_queue',
  COMMUNITY_SELECTED_TOPICS: '@community_selected_topics',
} as const;

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
  communityProfile?: CommunityProfile;
}

interface UsernameRegistry {
  [username: string]: string;
}

interface UserState {
  isLoading: boolean;
  profile: UserProfile | null;
  communityProfile: CommunityProfile | null;
  permissions: Permission | null;
  usernameRegistry: UsernameRegistry;
}

const DEFAULT_USER_STATE: UserState = {
  isLoading: true,
  profile: null,
  communityProfile: null,
  permissions: null,
  usernameRegistry: {},
};

interface UserContextType extends UserState {
  loadUser: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateAvatar: (uri: string) => Promise<void>;
  updatePreferences: (prefs: Partial<UserProfile['preferences']>) => Promise<void>;
  hasPermission: (action: keyof Permission) => boolean;
  canAccessFeature: (feature: string) => boolean;
  loadCommunityProfile: (userId?: string) => Promise<CommunityProfile | null>;
  updateCommunityProfile: (updates: Partial<CommunityProfile>) => Promise<void>;
  toggleCommunityPrivacy: () => Promise<void>;
  getCommunityStats: () => Promise<CommunityProfile['stats']>;
  isCommunityProfileComplete: () => boolean;
  checkUsernameAvailable: (username: string, currentUserId?: string) => Promise<{ available: boolean; message: string }>;
  registerUsername: (username: string, userId: string) => Promise<boolean>;
  unregisterUsername: (username: string) => Promise<boolean>;
  updateUsername: (oldUsername: string, newUsername: string, userId: string) => Promise<{ success: boolean; message: string }>;
  updateSelectedTopics: (topics: string[]) => Promise<void>;
  getSelectedTopics: () => string[];
  syncProfileToPosts: () => Promise<void>;
  getDisplayName: () => string;
  getUserType: () => 'parent' | 'guardian' | 'community';
  clearUserData: () => Promise<void>;
  isReady: boolean;
  // NEW: Community-specific profile updates
  updateCommunityDisplayName: (name: string) => Promise<void>;
  updateCommunityBio: (bio: string) => Promise<void>;
  updateCommunityAvatar: (uri: string) => Promise<void>;
  updateCommunityHandle: (handle: string) => Promise<{ success: boolean; message: string }>;
  getCommunityHandle: () => string;
  // NEW: Seamless auth integration
  syncWithAuthProfile: () => Promise<void>;
  getAuthProfile: () => UserProfile | null;
}

const createDefaultContextValue = (): UserContextType => ({
  ...DEFAULT_USER_STATE,
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
  updateCommunityDisplayName: async () => {},
  updateCommunityBio: async () => {},
  updateCommunityAvatar: async () => {},
  updateCommunityHandle: async () => ({ success: false, message: '' }),
  getCommunityHandle: () => '',
  syncWithAuthProfile: async () => {},
  getAuthProfile: () => null,
});

const UserContext = createContext<UserContextType>(createDefaultContextValue());

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading, userProfile: authProfile, updateUserProfile: updateAuthProfile, getCurrentUserProfile } = useAuth();

  const [state, setState] = useState<UserState>(DEFAULT_USER_STATE);
  const [isReady, setIsReady] = useState(false);
  const syncQueueRef = useRef<Partial<CommunityProfile>[]>([]);
  const initRef = useRef(false);
  const usernameLockRef = useRef(false);

  // Gate initialization on auth being ready
  useEffect(() => {
    if (initRef.current) return;
    if (authLoading) return;

    initRef.current = true;
    const initialize = async () => {
      await loadUser();
      setIsReady(true);
    };
    initialize();
  }, [authLoading]);

  // React to auth state changes after initial load
  useEffect(() => {
    if (!isReady) return;
    if (authLoading) return;

    if (isAuthenticated && authProfile) {
      loadUser();
    } else if (!isAuthenticated) {
      setState(DEFAULT_USER_STATE);
      setIsReady(false);
      initRef.current = false;
    }
  }, [isAuthenticated, authLoading, isReady, authProfile?.id]);

  const saveCommunityProfile = async (profile: CommunityProfile): Promise<void> => {
    const profileStr = JSON.stringify(profile);
    await Promise.all([
      secureStorage.setItem(SECURE_KEYS.COMMUNITY_PROFILE, profileStr),
      AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_PROFILE, profileStr),
    ]);
  };

  const createDefaultCommunityProfile = (userProfile: UserProfile): CommunityProfile => ({
    userId: userProfile.id,
    displayName: userProfile.fullName,
    handle: `@${userProfile.fullName.toLowerCase().replace(/\s+/g, '_')}_${userProfile.id.slice(0, 4)}`,
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

  const saveUsernameRegistry = async (registry: UsernameRegistry): Promise<void> => {
    const registryStr = JSON.stringify(registry);
    await Promise.all([
      secureStorage.setItem(SECURE_KEYS.USERNAME_REGISTRY, registryStr),
      AsyncStorage.setItem(ASYNC_KEYS.USERNAME_REGISTRY, registryStr),
    ]);
  };

  const loadUser = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [communitySecure, communityAsync, registrySecure, registryAsync] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.COMMUNITY_PROFILE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_PROFILE),
        secureStorage.getItem(SECURE_KEYS.USERNAME_REGISTRY),
        AsyncStorage.getItem(ASYNC_KEYS.USERNAME_REGISTRY),
      ]);

      const communityStr = communitySecure || communityAsync;
      const registryStr = registrySecure || registryAsync;

      let profile: UserProfile | null = null;
      let communityProfile: CommunityProfile | null = null;
      let usernameRegistry: UsernameRegistry = {};

      // AuthContext is the single source of truth for auth profile
      if (authProfile) {
        profile = {
          id: authProfile.id,
          fullName: authProfile.fullName,
          email: authProfile.email,
          phoneNumber: authProfile.phoneNumber,
          avatar: authProfile.avatar,
          role: authProfile.role as UserRole | 'parent1' | 'parent2' | 'guardian',
          preferences: {
            notifications: authProfile.preferences?.notifications ?? true,
            darkMode: (authProfile.preferences?.darkMode as 'system' | 'light' | 'dark') ?? 'system',
            units: 'metric',
          },
          createdAt: authProfile.createdAt,
          lastLoginAt: new Date().toISOString(),
        };
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

    const registry = state.usernameRegistry;
    const existingUserId = registry[trimmed];

    if (existingUserId && existingUserId !== currentUserId) {
      return { available: false, message: 'This username is already taken' };
    }

    return { available: true, message: 'Username is available' };
  }, [state.usernameRegistry]);

  const registerUsername = useCallback(async (username: string, userId: string): Promise<boolean> => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    
    while (usernameLockRef.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    usernameLockRef.current = true;
    
    try {
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
      const check = await checkUsernameAvailable(newUsername, userId);
      if (!check.available) {
        return { success: false, message: check.message };
      }
      
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
      
      // Sync back to AuthContext (single source of truth for auth profile)
      try {
        if (updateAuthProfile) {
          await updateAuthProfile(updates);
        }
      } catch (authError) {
        console.log('AuthContext sync failed:', authError);
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

  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityProfile>) => {
    if (!state.communityProfile) return;

    try {
      const newProfile = { ...state.communityProfile, ...updates };

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

  // NEW: Community-specific convenience methods
  const updateCommunityDisplayName = useCallback(async (name: string) => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({ displayName: name.trim() });
  }, [state.communityProfile, updateCommunityProfile]);

  const updateCommunityBio = useCallback(async (bio: string) => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({ bio: bio.trim() });
  }, [state.communityProfile, updateCommunityProfile]);

  const updateCommunityAvatar = useCallback(async (uri: string) => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({ avatar: uri });
    // Also sync to auth profile
    await updateProfile({ avatar: uri });
  }, [state.communityProfile, updateCommunityProfile, updateProfile]);

  const updateCommunityHandle = useCallback(async (handle: string): Promise<{ success: boolean; message: string }> => {
    if (!state.communityProfile) {
      return { success: false, message: 'No community profile found' };
    }
    
    const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
    const currentHandle = state.communityProfile.handle.replace(/^@/, '');
    
    if (cleanHandle === currentHandle) {
      return { success: true, message: 'No changes needed' };
    }

    try {
      const result = await updateUsername(currentHandle, cleanHandle, state.communityProfile.userId);
      if (result.success) {
        await updateCommunityProfile({ handle: `@${cleanHandle}` });
      }
      return result;
    } catch (error) {
      return { success: false, message: 'Failed to update handle' };
    }
  }, [state.communityProfile, updateUsername, updateCommunityProfile]);

  const getCommunityHandle = useCallback((): string => {
    return state.communityProfile?.handle || state.profile?.fullName || 'Anonymous';
  }, [state.communityProfile, state.profile]);

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
    await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS, JSON.stringify(trimmedTopics));
    if (state.profile?.id) {
      await AsyncStorage.setItem(`${ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS}_${state.profile.id}`, JSON.stringify(trimmedTopics));
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
      secureStorage.deleteItem(SECURE_KEYS.COMMUNITY_PROFILE),
      secureStorage.deleteItem(SECURE_KEYS.USERNAME_REGISTRY),
      AsyncStorage.removeItem(ASYNC_KEYS.COMMUNITY_PROFILE),
      AsyncStorage.removeItem(ASYNC_KEYS.USERNAME_REGISTRY),
      AsyncStorage.removeItem(ASYNC_KEYS.PROFILE_SYNC_QUEUE),
    ]);
    setState(DEFAULT_USER_STATE);
    setIsReady(false);
    initRef.current = false;
  }, [state.communityProfile, unregisterUsername]);

  // NEW: Seamless auth integration
  const syncWithAuthProfile = useCallback(async () => {
    if (!authProfile) return;

    try {
      const updates: Partial<UserProfile> = {
        id: authProfile.id,
        fullName: authProfile.fullName,
        email: authProfile.email,
        avatar: authProfile.avatar,
      };

      await updateProfile(updates);

      // Sync community-specific fields if they exist in auth
      if (authProfile.communityDisplayName || authProfile.communityBio || authProfile.communityAvatar) {
        const commUpdates: Partial<CommunityProfile> = {};
        if (authProfile.communityDisplayName) commUpdates.displayName = authProfile.communityDisplayName;
        if (authProfile.communityBio) commUpdates.bio = authProfile.communityBio;
        if (authProfile.communityAvatar) commUpdates.avatar = authProfile.communityAvatar;
        if (authProfile.communityHandle) commUpdates.handle = authProfile.communityHandle;

        await updateCommunityProfile(commUpdates);
      }
    } catch (error) {
      console.error('syncWithAuthProfile error:', error);
    }
  }, [authProfile, updateProfile, updateCommunityProfile]);

  const getAuthProfile = useCallback(() => {
    return state.profile;
  }, [state.profile]);

  const value = useMemo(() => ({
    ...state,
    isReady,
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
    updateCommunityDisplayName,
    updateCommunityBio,
    updateCommunityAvatar,
    updateCommunityHandle,
    getCommunityHandle,
    syncWithAuthProfile,
    getAuthProfile,
  }), [
    state, isReady,
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
    updateCommunityDisplayName,
    updateCommunityBio,
    updateCommunityAvatar,
    updateCommunityHandle,
    getCommunityHandle,
    syncWithAuthProfile,
    getAuthProfile,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  return context;
};

export default UserProvider;