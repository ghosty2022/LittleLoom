// src/context/UserContext.tsx
// Full Supabase implementation

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/utils/supabase';
import { useAuth } from './AuthContext';
import { useSweetAlert } from '@/components/SweetAlert';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../types/roles';

const ASYNC_KEYS = {
  COMMUNITY_PROFILE: 'littleloom_community_profile',
  USERNAME_REGISTRY: 'littleloom_username_registry',
  PROFILE_SYNC_QUEUE: 'littleloom_profile_sync_queue',
  COMMUNITY_SELECTED_TOPICS: '@community_selected_topics',
} as const;

// dbStorage now uses Supabase
const dbStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      
      if (error) {
        console.warn(`DB getItem failed for ${key}:`, error.message);
        return null;
      }
      return data?.value || null;
    } catch (error) {
      console.warn(`DB getItem failed for ${key}:`, error);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      
      if (error) {
        console.warn(`DB setItem failed for ${key}:`, error.message);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`DB setItem failed for ${key}:`, error);
      return false;
    }
  },
  async deleteItem(key: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', key);
      
      if (error) {
        console.warn(`DB deleteItem failed for ${key}:`, error.message);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`DB deleteItem failed for ${key}:`, error);
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
  updateCommunityDisplayName: (name: string) => Promise<void>;
  updateCommunityBio: (bio: string) => Promise<void>;
  updateCommunityAvatar: (uri: string) => Promise<void>;
  updateCommunityHandle: (handle: string) => Promise<{ success: boolean; message: string }>;
  getCommunityHandle: () => string;
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
  const { alert: sweetAlert } = useSweetAlert();

  const [state, setState] = useState<UserState>(DEFAULT_USER_STATE);
  const [isReady, setIsReady] = useState(false);
  const syncQueueRef = useRef<Partial<CommunityProfile>[]>([]);
  const initRef = useRef(false);
  const usernameLockRef = useRef(false);

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
  }, [isAuthenticated, authLoading, isReady, authProfile]);

  /* ─── Save Community Profile ────────────────────────────────────────── */

  const saveCommunityProfile = async (profile: CommunityProfile): Promise<void> => {
    await dbStorage.setItem(ASYNC_KEYS.COMMUNITY_PROFILE, JSON.stringify(profile));
    
    // Also save to profiles table in Supabase
    await supabase
      .from('profiles')
      .update({
        community_display_name: profile.displayName,
        community_handle: profile.handle,
        community_bio: profile.bio,
        community_avatar: profile.avatar,
        community_stats: profile.stats,
        is_verified: profile.isVerified,
        is_public: profile.preferences.isPublic,
        allow_messages: profile.preferences.allowMessages,
        show_activity_status: profile.preferences.showLocation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.userId);
  };

  /* ─── Create Default Community Profile ──────────────────────────────── */

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

  /* ─── Save Username Registry ────────────────────────────────────────── */

  const saveUsernameRegistry = async (registry: UsernameRegistry): Promise<void> => {
    await dbStorage.setItem(ASYNC_KEYS.USERNAME_REGISTRY, JSON.stringify(registry));
  };

  /* ─── Load User ──────────────────────────────────────────────────────── */

  const loadUser = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const [communityStr, registryStr] = await Promise.all([
        dbStorage.getItem(ASYNC_KEYS.COMMUNITY_PROFILE),
        dbStorage.getItem(ASYNC_KEYS.USERNAME_REGISTRY),
      ]);

      let profile: UserProfile | null = null;
      let communityProfile: CommunityProfile | null = null;
      let usernameRegistry: UsernameRegistry = {};

      if (authProfile) {
        // Fetch full profile from Supabase
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authProfile.id)
          .single();

        if (!profileError && profileData) {
          profile = {
            id: authProfile.id,
            fullName: profileData.full_name || authProfile.fullName,
            email: profileData.email || authProfile.email,
            phoneNumber: profileData.phone_number || authProfile.phoneNumber,
            avatar: profileData.avatar || authProfile.avatar,
            role: profileData.role || authProfile.role,
            preferences: {
              notifications: profileData.notifications_enabled ?? true,
              darkMode: 'system',
              units: 'metric',
            },
            createdAt: profileData.created_at || authProfile.createdAt,
            lastLoginAt: new Date().toISOString(),
          };
        } else {
          // Fallback to auth profile
          profile = {
            id: authProfile.id,
            fullName: authProfile.fullName,
            email: authProfile.email,
            phoneNumber: authProfile.phoneNumber,
            avatar: authProfile.avatar,
            role: authProfile.role,
            preferences: {
              notifications: authProfile.preferences?.notifications ?? true,
              darkMode: 'system',
              units: 'metric',
            },
            createdAt: authProfile.createdAt,
            lastLoginAt: new Date().toISOString(),
          };
        }
      }

      if (communityStr) {
        try { communityProfile = JSON.parse(communityStr); } catch (e) { /* ignore */ }
      } else if (profile) {
        // Check if profile exists in Supabase
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.id)
          .single();

        if (profileError || !existingProfile) {
          // Create profile in Supabase
          await supabase
            .from('profiles')
            .insert({
              id: profile.id,
              full_name: profile.fullName,
              email: profile.email,
              avatar: profile.avatar,
              role: profile.role,
              created_at: profile.createdAt,
              updated_at: new Date().toISOString(),
            });
        }

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

  /* ─── Check Username Available ──────────────────────────────────────── */

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

    // Check Supabase profiles table
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('community_handle', `@${trimmed}`)
      .maybeSingle();

    if (!error && existing && existing.id !== currentUserId) {
      return { available: false, message: 'This username is already taken' };
    }

    // Check local registry as fallback
    const registry = state.usernameRegistry;
    const existingUserId = registry[trimmed];

    if (existingUserId && existingUserId !== currentUserId) {
      return { available: false, message: 'This username is already taken' };
    }

    return { available: true, message: 'Username is available' };
  }, [state.usernameRegistry]);

  /* ─── Register Username ────────────────────────────────────────────── */

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

      // Update Supabase profile
      const { error } = await supabase
        .from('profiles')
        .update({
          community_handle: `@${trimmed}`,
          community_username: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Register username error:', error.message);
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

  /* ─── Unregister Username ──────────────────────────────────────────── */

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

  /* ─── Update Username ──────────────────────────────────────────────── */

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

      // Update Supabase profile
      const { error } = await supabase
        .from('profiles')
        .update({
          community_handle: `@${newTrimmed}`,
          community_username: newTrimmed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Update username error:', error.message);
        return { success: false, message: 'Failed to update username' };
      }

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

  /* ─── Update Profile ────────────────────────────────────────────────── */

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!state.profile) return;

    try {
      const newProfile = { ...state.profile, ...updates };

      // Update Supabase profiles table
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.phoneNumber !== undefined) dbUpdates.phone_number = updates.phoneNumber;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.role !== undefined) dbUpdates.role = updates.role;

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', state.profile.id);

      if (error) {
        console.error('Update profile error:', error.message);
      }

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
      sweetAlert.alert('Error', 'Failed to update profile', 'warning');
    }
  }, [state.profile, state.permissions, updateAuthProfile]);

  /* ─── Persist Picked Image ─────────────────────────────────────────── */

  const COMMUNITY_AVATARS_DIR = FileSystem.documentDirectory + 'community_avatars/';

  const persistPickedImage = async (sourceUri: string, userId: string): Promise<string | null> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(COMMUNITY_AVATARS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(COMMUNITY_AVATARS_DIR, { intermediates: true });
      }

      const ext = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const processedUri = `${COMMUNITY_AVATARS_DIR}${userId}_${Date.now()}.${safeExt}`;

      if (sourceUri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(processedUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (sourceUri.startsWith('data:')) {
        const base64Data = sourceUri.split(',')[1];
        if (base64Data) {
          await FileSystem.writeAsStringAsync(processedUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        } else {
          throw new Error('Invalid data URI');
        }
      } else {
        await FileSystem.copyAsync({ from: sourceUri, to: processedUri });
      }

      const fileInfo = await FileSystem.getInfoAsync(processedUri);
      if (!fileInfo.exists) return null;

      // Also upload to Supabase Storage
      const fileData = await FileSystem.readAsStringAsync(processedUri, { encoding: FileSystem.EncodingType.Base64 });
      const storagePath = `avatars/${userId}_${Date.now()}.${safeExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, decode(fileData), {
          contentType: `image/${safeExt}`,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Avatar upload to storage error:', uploadError.message);
        return processedUri;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(storagePath);

      return urlData.publicUrl || processedUri;
    } catch (error) {
      console.error('[persistPickedImage] Failed:', error);
      return null;
    }
  };

  /* ─── Pick and Upload Avatar ───────────────────────────────────────── */

  const pickAndUploadAvatar = useCallback(async (): Promise<string | null> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Permission Required', 'Please allow access to your photo library', 'warning');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return null;

      const userId = state.profile?.id || 'unknown';
      const permanentUri = await persistPickedImage(result.assets[0].uri, userId);

      if (!permanentUri) {
        sweetAlert.alert('Error', 'Failed to save image', 'error');
        return null;
      }

      await updateProfile({ avatar: permanentUri });
      if (state.communityProfile) {
        await updateCommunityProfile({ avatar: permanentUri });
      }

      return permanentUri;
    } catch (error) {
      console.error('Avatar upload error:', error);
      sweetAlert.alert('Error', 'Failed to upload avatar', 'error');
      return null;
    }
  }, [state.profile, state.communityProfile, updateProfile, updateCommunityProfile]);

  /* ─── Update Avatar ─────────────────────────────────────────────────── */

  const updateAvatar = useCallback(async (uri: string) => {
    await updateProfile({ avatar: uri });
    if (state.communityProfile) {
      await updateCommunityProfile({ avatar: uri });
    }
  }, [updateProfile, state.communityProfile]);

  /* ─── Update Preferences ────────────────────────────────────────────── */

  const updatePreferences = useCallback(async (prefs: Partial<UserProfile['preferences']>) => {
    if (!state.profile) return;
    await updateProfile({
      preferences: { ...state.profile.preferences, ...prefs },
    });
  }, [state.profile, updateProfile]);

  /* ─── Has Permission ────────────────────────────────────────────────── */

  const hasPermission = useCallback((action: keyof Permission): boolean => {
    return state.permissions?.[action] ?? false;
  }, [state.permissions]);

  /* ─── Can Access Feature ───────────────────────────────────────────── */

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

  /* ─── Load Community Profile ───────────────────────────────────────── */

  const loadCommunityProfile = useCallback(async (userId?: string): Promise<CommunityProfile | null> => {
    if (!userId || userId === state.profile?.id) {
      return state.communityProfile;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) return null;

      return {
        userId: data.id,
        displayName: data.community_display_name || data.full_name,
        handle: data.community_handle || `@${data.full_name.toLowerCase().replace(/\s+/g, '_')}`,
        bio: data.community_bio || '',
        avatar: data.community_avatar || data.avatar,
        isVerified: data.is_verified || false,
        joinDate: data.created_at || new Date().toISOString(),
        stats: data.community_stats || { posts: 0, followers: 0, following: 0, helpful: 0 },
        badges: [],
        preferences: {
          isPublic: data.is_public ?? true,
          allowMessages: data.allow_messages ?? true,
          showLocation: data.show_activity_status ?? false,
          selectedTopics: [],
        },
      };
    } catch (error) {
      console.error('loadCommunityProfile error:', error);
      return null;
    }
  }, [state.profile, state.communityProfile]);

  /* ─── Update Community Profile ─────────────────────────────────────── */

  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityProfile>) => {
    if (!state.communityProfile) return;

    try {
      const newProfile = { ...state.communityProfile, ...updates };

      // Update handle if changed
      if (updates.handle && updates.handle !== state.communityProfile.handle) {
        const oldHandle = state.communityProfile.handle.replace(/^@/, '');
        const newHandle = updates.handle.replace(/^@/, '');

        const result = await updateUsername(oldHandle, newHandle, state.communityProfile.userId);
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      // Update Supabase profiles table
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.displayName !== undefined) dbUpdates.community_display_name = updates.displayName;
      if (updates.handle !== undefined) dbUpdates.community_handle = updates.handle;
      if (updates.bio !== undefined) dbUpdates.community_bio = updates.bio;
      if (updates.avatar !== undefined) dbUpdates.community_avatar = updates.avatar;
      if (updates.stats !== undefined) dbUpdates.community_stats = updates.stats;
      if (updates.isVerified !== undefined) dbUpdates.is_verified = updates.isVerified;
      if (updates.preferences?.isPublic !== undefined) dbUpdates.is_public = updates.preferences.isPublic;
      if (updates.preferences?.allowMessages !== undefined) dbUpdates.allow_messages = updates.preferences.allowMessages;
      if (updates.preferences?.showLocation !== undefined) dbUpdates.show_activity_status = updates.preferences.showLocation;

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', state.communityProfile.userId);

      if (error) {
        console.error('Update community profile error:', error.message);
      }

      await saveCommunityProfile(newProfile);
      setState(prev => ({ ...prev, communityProfile: newProfile }));
      syncQueueRef.current.push(updates);
    } catch (error) {
      console.error('updateCommunityProfile error:', error);
      sweetAlert.alert('Error', 'Failed to update community profile', 'warning');
    }
  }, [state.communityProfile, updateUsername]);

  /* ─── Update Community Display Name ───────────────────────────────── */

  const updateCommunityDisplayName = useCallback(async (name: string) => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({ displayName: name.trim() });
  }, [state.communityProfile, updateCommunityProfile]);

  /* ─── Update Community Bio ─────────────────────────────────────────── */

  const updateCommunityBio = useCallback(async (bio: string) => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({ bio: bio.trim() });
  }, [state.communityProfile, updateCommunityProfile]);

  /* ─── Update Community Avatar ──────────────────────────────────────── */

  const updateCommunityAvatar = useCallback(async (uri: string) => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({ avatar: uri });
    await updateProfile({ avatar: uri });
  }, [state.communityProfile, updateCommunityProfile, updateProfile]);

  /* ─── Update Community Handle ──────────────────────────────────────── */

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

  /* ─── Get Community Handle ─────────────────────────────────────────── */

  const getCommunityHandle = useCallback((): string => {
    return state.communityProfile?.handle || state.profile?.fullName || 'Anonymous';
  }, [state.communityProfile, state.profile]);

  /* ─── Toggle Community Privacy ────────────────────────────────────── */

  const toggleCommunityPrivacy = useCallback(async () => {
    if (!state.communityProfile) return;
    await updateCommunityProfile({
      preferences: {
        ...state.communityProfile.preferences,
        isPublic: !state.communityProfile.preferences.isPublic,
      },
    });
  }, [state.communityProfile, updateCommunityProfile]);

  /* ─── Get Community Stats ──────────────────────────────────────────── */

  const getCommunityStats = useCallback(async (): Promise<CommunityProfile['stats']> => {
    return state.communityProfile?.stats || { posts: 0, followers: 0, following: 0, helpful: 0 };
  }, [state.communityProfile]);

  /* ─── Is Community Profile Complete ────────────────────────────────── */

  const isCommunityProfileComplete = useCallback((): boolean => {
    if (!state.communityProfile) return false;
    return !!(
      state.communityProfile.bio &&
      state.communityProfile.displayName &&
      state.communityProfile.handle
    );
  }, [state.communityProfile]);

  /* ─── Update Selected Topics ───────────────────────────────────────── */

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
    await dbStorage.setItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS, JSON.stringify(trimmedTopics));
    if (state.profile?.id) {
      await dbStorage.setItem(`${ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS}_${state.profile.id}`, JSON.stringify(trimmedTopics));
    }

    setState(prev => ({ ...prev, communityProfile: newProfile }));
  }, [state.communityProfile, state.profile]);

  /* ─── Get Selected Topics ──────────────────────────────────────────── */

  const getSelectedTopics = useCallback((): string[] => {
    return state.communityProfile?.preferences?.selectedTopics || [];
  }, [state.communityProfile]);

  /* ─── Sync Profile to Posts ────────────────────────────────────────── */

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

  /* ─── Get Display Name ─────────────────────────────────────────────── */

  const getDisplayName = useCallback((): string => {
    return state.communityProfile?.displayName ||
           state.profile?.fullName ||
           'Anonymous';
  }, [state.communityProfile, state.profile]);

  /* ─── Get User Type ────────────────────────────────────────────────── */

  const getUserType = useCallback((): 'parent' | 'guardian' | 'community' => {
    if (!state.profile) return 'community';
    if (state.profile.role === UserRole.GUARDIAN || state.profile.role === 'guardian') return 'guardian';
    return 'parent';
  }, [state.profile]);

  /* ─── Clear User Data ──────────────────────────────────────────────── */

  const clearUserData = useCallback(async (): Promise<void> => {
    if (state.communityProfile?.handle) {
      await unregisterUsername(state.communityProfile.handle);
    }

    await Promise.all([
      dbStorage.deleteItem(ASYNC_KEYS.COMMUNITY_PROFILE),
      dbStorage.deleteItem(ASYNC_KEYS.USERNAME_REGISTRY),
      AsyncStorage.removeItem(ASYNC_KEYS.PROFILE_SYNC_QUEUE),
    ]);

    setState(DEFAULT_USER_STATE);
    setIsReady(false);
    initRef.current = false;
  }, [state.communityProfile, unregisterUsername]);

  /* ─── Sync with Auth Profile ───────────────────────────────────────── */

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

  /* ─── Get Auth Profile ─────────────────────────────────────────────── */

  const getAuthProfile = useCallback(() => {
    return state.profile;
  }, [state.profile]);

  /* ─── Memoized Value ────────────────────────────────────────────────── */

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

export { UserContext };
export default UserProvider;