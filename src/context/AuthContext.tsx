// src/context/AuthContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
// REMOVED: import { supabase } from '../lib/supabase';  // ← unused, removed
import { SocialUser } from '../hooks/useSocialAuth';

const SECURE_KEYS = {
  AUTH_TOKEN: 'littleloom_auth_token',
  USER_PROFILE: 'littleloom_user_profile_secure',
  PIN_HASH: 'littleloom_pin_hash',
  BIOMETRIC_EMAIL: 'littleloom_biometric_email',
  BIOMETRIC_PASSWORD: 'littleloom_biometric_password',
  BIOMETRIC_LOGIN_ENABLED: 'littleloom_biometric_login_enabled',
  SOCIAL_PROVIDER: 'littleloom_social_provider',
} as const;

const ASYNC_KEYS = {
  ONBOARDING_COMPLETE: 'littleloom_onboarding_complete',
  HAS_SEEN_ONBOARDING: '@littleloom_has_seen_onboarding',
  BIOMETRIC_ENABLED: 'littleloom_biometric_enabled',
  BIOMETRIC_AVAILABLE: 'littleloom_biometric_available',
  SETUP_COMPLETE: 'littleloom_setup_complete',
  HAS_PARENT2: 'littleloom_has_parent2',
  HAS_BABY: 'littleloom_has_baby',
  PARENT2_COMPLETED: 'littleloom_parent2_completed',
  BABY_COMPLETED: 'littleloom_baby_completed',
  LAST_AUTH_STATE: 'littleloom_last_auth_state',
  NAVIGATION_LOCK: 'littleloom_navigation_lock',
  COMMUNITY_USERNAME: 'littleloom_community_username',
  COMMUNITY_HANDLE: 'littleloom_community_handle',
  COMMUNITY_BIO: 'littleloom_community_bio',
  COMMUNITY_AVATAR: 'littleloom_community_avatar',
  COMMUNITY_DISPLAY_NAME: 'littleloom_community_display_name',
  COMMUNITY_STATS: 'littleloom_community_stats',
  COMMUNITY_SELECTED_TOPICS: 'littleloom_community_selected_topics',
  USERNAME_REGISTRY: 'littleloom_username_registry',
} as const;

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  role: 'parent1' | 'parent2' | 'guardian';
  createdAt: string;
  preferences?: {
    notifications?: boolean;
    darkMode?: boolean;
    language?: string;
  };
  socialProvider?: 'google' | 'apple' | 'facebook' | null;
  // Community-specific fields (synced with community profile)
  communityUsername?: string;
  communityHandle?: string;
  communityBio?: string;
  communityAvatar?: string;
  communityDisplayName?: string;
  communityStats?: {
    posts: number;
    followers: number;
    following: number;
    helpful: number;
  };
  communitySelectedTopics?: string[];
}

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  userToken: string | null;
  userProfile: UserProfile | null;
  onboardingComplete: boolean;
  hasSeenOnboarding: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  isBiometricLoginEnabled: boolean;
  setupComplete: boolean;
  hasParent2: boolean | 'skipped';
  hasBaby: boolean | 'skipped';
  availableBiometricTypes: LocalAuthentication.AuthenticationType[];
  biometricTypeName: string;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (fullName: string, email: string, password: string) => Promise<boolean>;
  signInWithSocial: (socialUser: SocialUser) => Promise<boolean>;
  signOut: () => Promise<void>;
  checkBiometricAvailability: () => Promise<boolean>;
  authenticateWithBiometric: (promptMessage?: string) => Promise<LocalAuthentication.LocalAuthenticationResult>;
  enableBiometricForApp: () => Promise<boolean>;
  enableBiometricLogin: (email: string, password: string) => Promise<boolean>;
  disableBiometricLogin: () => Promise<void>;
  hasBiometricLoginCredentials: () => Promise<boolean>;
  loginWithBiometric: () => Promise<boolean>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  updateUserPreferences: (prefs: Partial<UserProfile['preferences']>) => Promise<boolean>;
  skipSetup: (step: 'parent2' | 'baby') => Promise<void>;
  completeSetup: (step: 'parent2' | 'baby') => Promise<void>;
  resetSetupFlow: () => Promise<void>;
  wasSetupCompleted: () => Promise<{ hasParent2: boolean | 'skipped'; hasBaby: boolean | 'skipped'; setupComplete: boolean }>;
  setSetupCompleteCallback: (callback: (() => Promise<void>) | null) => void;
  markOnboardingSeen: () => Promise<void>;
  shouldShowBiometricPrompt: () => Promise<boolean>;
  isAppActive: () => boolean;
  getLastActiveTime: () => number;
  getBiometricTypeInfo: () => { type: string; icon: string };
  clearAllLocks: () => void;
  getCurrentUserProfile: () => UserProfile | null;
  // Community profile methods — unified with auth
  updateCommunityProfile: (updates: { username?: string; handle?: string; bio?: string; avatar?: string; displayName?: string }) => Promise<boolean>;
  getCommunityProfile: () => Promise<{ username: string; handle: string; bio: string; avatar: string; displayName: string; stats: any; selectedTopics: string[] } | null>;
  updateCommunityStats: (stats: Partial<UserProfile['communityStats']>) => Promise<boolean>;
  updateCommunityTopics: (topics: string[]) => Promise<boolean>;
  isUsernameAvailable: (username: string) => Promise<{ available: boolean; message: string }>;
  registerCommunityUsername: (username: string) => Promise<boolean>;
  updateCommunityUsername: (newUsername: string) => Promise<{ success: boolean; message: string }>;
  updateCommunityAvatar: (avatarUri: string) => Promise<boolean>;
}

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStore get error for ${key}:`, error);
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
      console.error(`SecureStore set error for ${key}:`, error);
      return false;
    }
  },
  async deleteItem(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error(`SecureStore delete error for ${key}:`, error);
      return false;
    }
  },
};

const getBiometricTypeName = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (!types || types.length === 0) return 'Biometric';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris Scan';
  return 'Biometric';
};

const getBiometricIcon = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'scan-outline';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'finger-print';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'eye';
  return 'finger-print';
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    userToken: null,
    userProfile: null,
    onboardingComplete: false,
    hasSeenOnboarding: false,
    isBiometricAvailable: false,
    isBiometricEnabled: false,
    isBiometricLoginEnabled: false,
    setupComplete: false,
    hasParent2: false,
    hasBaby: false,
    availableBiometricTypes: [],
    biometricTypeName: 'Biometric',
  });

  const isMounted = useRef(true);
  const initComplete = useRef(false);
  const setupCompleteCallbackRef = useRef<(() => Promise<void>) | null>(null);
  
  const signInLock = useRef(false);
  const signInLockTimer = useRef<NodeJS.Timeout | null>(null);
  const biometricLoginLock = useRef(false);
  const biometricLoginTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSignInTime = useRef(0);
  
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastActiveTimeRef = useRef<number>(Date.now());
  const isAuthenticatedRef = useRef<boolean>(false);
  
  // Username registry for community — persisted to AsyncStorage
  const usernameRegistryRef = useRef<Record<string, string>>({});
  const usernameLockRef = useRef(false);

  const acquireSignInLock = useCallback((): boolean => {
    if (signInLock.current) return false;
    signInLock.current = true;
    if (signInLockTimer.current) clearTimeout(signInLockTimer.current);
    signInLockTimer.current = setTimeout(() => { signInLock.current = false; }, 10000);
    return true;
  }, []);

  const releaseSignInLock = useCallback(() => {
    if (signInLockTimer.current) { clearTimeout(signInLockTimer.current); signInLockTimer.current = null; }
    signInLock.current = false;
  }, []);

  const acquireBiometricLock = useCallback((): boolean => {
    if (biometricLoginLock.current) return false;
    biometricLoginLock.current = true;
    if (biometricLoginTimer.current) clearTimeout(biometricLoginTimer.current);
    biometricLoginTimer.current = setTimeout(() => { biometricLoginLock.current = false; }, 15000);
    return true;
  }, []);

  const releaseBiometricLock = useCallback(() => {
    if (biometricLoginTimer.current) { clearTimeout(biometricLoginTimer.current); biometricLoginTimer.current = null; }
    biometricLoginLock.current = false;
  }, []);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      releaseSignInLock();
      releaseBiometricLock();
    };
  }, [releaseSignInLock, releaseBiometricLock]);

  useEffect(() => { isAuthenticatedRef.current = state.isAuthenticated; }, [state.isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = appStateRef.current;
      if (nextAppState.match(/inactive|background/) && previousState === 'active') {
        lastActiveTimeRef.current = Date.now();
        await AsyncStorage.setItem('littleloom_last_active_global', lastActiveTimeRef.current.toString());
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  // Load username registry from storage
  const loadUsernameRegistry = useCallback(async () => {
    try {
      const registry = await AsyncStorage.getItem(ASYNC_KEYS.USERNAME_REGISTRY);
      if (registry) {
        usernameRegistryRef.current = JSON.parse(registry);
      }
    } catch (error) {
      console.error('Error loading username registry:', error);
    }
  }, []);

  // Save username registry to storage
  const saveUsernameRegistry = useCallback(async (registry: Record<string, string>) => {
    try {
      usernameRegistryRef.current = registry;
      await AsyncStorage.setItem(ASYNC_KEYS.USERNAME_REGISTRY, JSON.stringify(registry));
      return true;
    } catch (error) {
      console.error('Error saving username registry:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (initComplete.current) return;
    
    const initAuth = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        await loadUsernameRegistry();
        
        const [
          token,
          userProfileStr,
          onboardingComplete,
          hasSeenOnboarding,
          biometricEnabled,
          biometricLoginEnabled,
          setupComplete,
          hasParent2Str,
          hasBabyStr,
          parent2Completed,
          babyCompleted,
        ] = await Promise.all([
          secureStorage.getItem(SECURE_KEYS.AUTH_TOKEN),
          secureStorage.getItem(SECURE_KEYS.USER_PROFILE),
          AsyncStorage.getItem(ASYNC_KEYS.ONBOARDING_COMPLETE),
          AsyncStorage.getItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING),
          AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
          secureStorage.getItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
          AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
          AsyncStorage.getItem(ASYNC_KEYS.HAS_PARENT2),
          AsyncStorage.getItem(ASYNC_KEYS.HAS_BABY),
          AsyncStorage.getItem(ASYNC_KEYS.PARENT2_COMPLETED),
          AsyncStorage.getItem(ASYNC_KEYS.BABY_COMPLETED),
        ]);

        let userProfile = userProfileStr ? JSON.parse(userProfileStr) : null;
        
        // Load community profile data if exists — MERGED with auth profile
        if (userProfile) {
          const [commUsername, commHandle, commBio, commAvatar, commDisplayName, commStats, commTopics] = await Promise.all([
            AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME),
            AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_HANDLE),
            AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_BIO),
            AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_AVATAR),
            AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME),
            AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_STATS),
            AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS),
          ]);
          
          const baseName = userProfile.fullName || 'Parent';
          const baseHandle = `@${baseName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
          
          userProfile = {
            ...userProfile,
            communityUsername: commUsername || baseName,
            communityHandle: commHandle || baseHandle,
            communityBio: commBio || '',
            communityAvatar: commAvatar || userProfile.avatar || '👤',
            communityDisplayName: commDisplayName || baseName,
            communityStats: commStats ? JSON.parse(commStats) : { posts: 0, followers: 0, following: 0, helpful: 0 },
            communitySelectedTopics: commTopics ? JSON.parse(commTopics) : [],
          };
        }
        
        let biometricAvailable = false;
        let availableTypes: LocalAuthentication.AuthenticationType[] = [];
        let bioTypeName = 'Biometric';
        
        try {
          if (LocalAuthentication?.hasHardwareAsync) {
            const [hasHardware, isEnrolled] = await Promise.all([
              LocalAuthentication.hasHardwareAsync(),
              LocalAuthentication.isEnrolledAsync(),
            ]);
            if (hasHardware && isEnrolled && LocalAuthentication.supportedAuthenticationTypesAsync) {
              availableTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
              bioTypeName = getBiometricTypeName(availableTypes);
            }
            biometricAvailable = hasHardware && isEnrolled;
          }
        } catch (bioError) { biometricAvailable = false; }

        const hasParent2 = parent2Completed === 'true' ? true : 
                          parent2Completed === 'skipped' ? 'skipped' :
                          hasParent2Str === 'true' ? true :
                          hasParent2Str === 'skipped' ? 'skipped' : false;
                          
        const hasBaby = babyCompleted === 'true' ? true :
                       babyCompleted === 'skipped' ? 'skipped' :
                       hasBabyStr === 'true' ? true :
                       hasBabyStr === 'skipped' ? 'skipped' : false;

        const isSetupComplete = (parent2Completed !== null && babyCompleted !== null) || setupComplete === 'true';

        if (isMounted.current) {
          setState({
            isLoading: false,
            isAuthenticated: !!token,
            userToken: token,
            userProfile,
            onboardingComplete: onboardingComplete === 'true',
            hasSeenOnboarding: hasSeenOnboarding === 'true',
            isBiometricAvailable: biometricAvailable,
            isBiometricEnabled: biometricEnabled === 'true',
            isBiometricLoginEnabled: biometricLoginEnabled === 'true',
            setupComplete: isSetupComplete,
            hasParent2,
            hasBaby,
            availableBiometricTypes: availableTypes,
            biometricTypeName: bioTypeName,
          });
        }
        initComplete.current = true;
      } catch (error) {
        console.error('Auth init failed:', error);
        if (isMounted.current) setState(prev => ({ ...prev, isLoading: false }));
        initComplete.current = true;
      }
    };

    initAuth();
  }, [loadUsernameRegistry]);

  const markOnboardingSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING, 'true');
      if (isMounted.current) setState(prev => ({ ...prev, hasSeenOnboarding: true }));
    } catch (error) { console.error('Error marking onboarding:', error); }
  }, []);

  const checkBiometricAvailability = useCallback(async (): Promise<boolean> => {
    try {
      if (!LocalAuthentication?.hasHardwareAsync) return false;
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      const available = hasHardware && isEnrolled;
      let types: LocalAuthentication.AuthenticationType[] = [];
      if (available && LocalAuthentication.supportedAuthenticationTypesAsync) {
        types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      }
      if (isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          isBiometricAvailable: available,
          availableBiometricTypes: types,
          biometricTypeName: getBiometricTypeName(types),
        }));
      }
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_AVAILABLE, available ? 'true' : 'false');
      return available;
    } catch (error) { return false; }
  }, []);

  const authenticateWithBiometric = useCallback(async (promptMessage?: string) => {
    try {
      if (!LocalAuthentication?.authenticateAsync) return { success: false, error: 'not_available' };
      return await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Authenticate with LittleLoom`,
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
    } catch (error) { return { success: false, error: 'unknown' }; }
  }, []);

  const enableBiometricForApp = useCallback(async (): Promise<boolean> => {
    const result = await authenticateWithBiometric('Confirm to enable biometric unlock');
    if (result.success) {
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'true');
      if (isMounted.current) setState(prev => ({ ...prev, isBiometricEnabled: true }));
      return true;
    }
    return false;
  }, [authenticateWithBiometric]);

  const enableBiometricLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await authenticateWithBiometric(`Confirm to enable ${state.biometricTypeName} login`);
      if (!result.success) return false;

      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_EMAIL, email),
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_PASSWORD, password),
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED, 'true'),
      ]);

      if (isMounted.current) setState(prev => ({ ...prev, isBiometricLoginEnabled: true }));
      return true;
    } catch (error) { return false; }
  }, [authenticateWithBiometric, state.biometricTypeName]);

  const disableBiometricLogin = useCallback(async (): Promise<void> => {
    await Promise.all([
      secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
      secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
      secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
    ]);
    if (isMounted.current) setState(prev => ({ ...prev, isBiometricLoginEnabled: false }));
  }, []);

  const hasBiometricLoginCredentials = useCallback(async (): Promise<boolean> => {
    try {
      const [email, password, enabled] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);
      return !!(email && password && enabled === 'true');
    } catch (error) { return false; }
  }, []);

  const performSignInInternal = useCallback(async (email: string, password: string, isBiometric: boolean = false): Promise<boolean> => {
    try {
      if (!email || !password) {
        Alert.alert('Error', 'Please enter both email and password');
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      
      const token = `auth_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Load existing community profile or create defaults
      const [commUsername, commHandle, commBio, commAvatar, commDisplayName, commStats, commTopics] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_HANDLE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_BIO),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_AVATAR),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_STATS),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS),
      ]);
      
      const baseName = email.split('@')[0];
      const baseHandle = `@${baseName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      
      const userProfile: UserProfile = {
        id: userId,
        fullName: baseName,
        email,
        role: 'parent1',
        createdAt: new Date().toISOString(),
        preferences: { notifications: true, darkMode: false, language: 'en' },
        communityUsername: commUsername || baseName,
        communityHandle: commHandle || baseHandle,
        communityBio: commBio || '',
        communityAvatar: commAvatar || '👤',
        communityDisplayName: commDisplayName || baseName,
        communityStats: commStats ? JSON.parse(commStats) : { posts: 0, followers: 0, following: 0, helpful: 0 },
        communitySelectedTopics: commTopics ? JSON.parse(commTopics) : [],
      };

      const [tokenStored, profileStored] = await Promise.all([
        secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token),
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile)),
      ]);
      
      if (!tokenStored || !profileStored) {
        Alert.alert('Error', 'Failed to save login data');
        return false;
      }

      await AsyncStorage.setItem(ASYNC_KEYS.ONBOARDING_COMPLETE, 'true');

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          userToken: token,
          userProfile,
          onboardingComplete: true,
        }));
      }
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in');
      return false;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!acquireSignInLock()) return false;
    const now = Date.now();
    if (now - lastSignInTime.current < 1500) {
      await new Promise(resolve => setTimeout(resolve, 1500 - (now - lastSignInTime.current)));
    }
    try {
      const success = await performSignInInternal(email, password, false);
      lastSignInTime.current = Date.now();
      return success;
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock, performSignInInternal]);

  const signInWithSocial = useCallback(async (socialUser: SocialUser): Promise<boolean> => {
    if (!acquireSignInLock()) return false;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const token = `social_token_${socialUser.provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Load existing community profile or create defaults
      const [commUsername, commHandle, commBio, commAvatar, commDisplayName, commStats, commTopics] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_HANDLE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_BIO),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_AVATAR),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_STATS),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS),
      ]);
      
      const baseName = socialUser.fullName;
      const baseHandle = `@${baseName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      
      const userProfile: UserProfile = {
        id: socialUser.id,
        fullName: socialUser.fullName,
        email: socialUser.email,
        avatar: socialUser.avatar,
        role: 'parent1',
        createdAt: new Date().toISOString(),
        preferences: { notifications: true, darkMode: false, language: 'en' },
        socialProvider: socialUser.provider,
        communityUsername: commUsername || baseName,
        communityHandle: commHandle || baseHandle,
        communityBio: commBio || '',
        communityAvatar: commAvatar || socialUser.avatar || '👤',
        communityDisplayName: commDisplayName || baseName,
        communityStats: commStats ? JSON.parse(commStats) : { posts: 0, followers: 0, following: 0, helpful: 0 },
        communitySelectedTopics: commTopics ? JSON.parse(commTopics) : [],
      };

      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token),
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile)),
        secureStorage.setItem(SECURE_KEYS.SOCIAL_PROVIDER, socialUser.provider),
        AsyncStorage.setItem(ASYNC_KEYS.ONBOARDING_COMPLETE, 'true'),
      ]);

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          userToken: token,
          userProfile,
          onboardingComplete: true,
        }));
      }

      lastSignInTime.current = Date.now();
      return true;
    } catch (error) {
      console.error('Social sign in error:', error);
      Alert.alert('Error', 'Social sign in failed');
      return false;
    } finally {
      releaseSignInLock();
    }
  }, [acquireSignInLock, releaseSignInLock]);

  const signUp = useCallback(async (fullName: string, email: string, password: string): Promise<boolean> => {
    if (!acquireSignInLock()) return false;
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const token = `auth_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const handle = `@${fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      
      const userProfile: UserProfile = {
        id: userId,
        fullName,
        email,
        role: 'parent1',
        createdAt: new Date().toISOString(),
        preferences: { notifications: true, darkMode: false, language: 'en' },
        communityUsername: fullName,
        communityHandle: handle,
        communityBio: '',
        communityAvatar: '👤',
        communityDisplayName: fullName,
        communityStats: { posts: 0, followers: 0, following: 0, helpful: 0 },
        communitySelectedTopics: [],
      };

      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token),
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile)),
        AsyncStorage.setItem(ASYNC_KEYS.ONBOARDING_COMPLETE, 'true'),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_USERNAME, fullName),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_HANDLE, handle),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME, fullName),
      ]);

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          userToken: token,
          userProfile,
          onboardingComplete: true,
        }));
      }

      lastSignInTime.current = Date.now();
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to create account');
      return false;
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock]);

  const loginWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!acquireBiometricLock()) return false;
    try {
      const authResult = await authenticateWithBiometric(`Login with ${state.biometricTypeName}`);
      if (!authResult.success) return false;

      const [storedEmail, storedPassword] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
      ]);

      if (!storedEmail || !storedPassword) {
        Alert.alert('Setup Required', `Please log in with your password first to enable ${state.biometricTypeName} login.`);
        return false;
      }

      const success = await performSignInInternal(storedEmail, storedPassword, true);
      lastSignInTime.current = Date.now();
      return success;
    } catch (error) { return false; } 
    finally { releaseBiometricLock(); }
  }, [authenticateWithBiometric, state.biometricTypeName, acquireBiometricLock, releaseBiometricLock, performSignInInternal]);

  const shouldShowBiometricPrompt = useCallback(async (): Promise<boolean> => {
    if (!state.isBiometricAvailable) return false;
    if (state.isBiometricLoginEnabled) return false;
    const hasCreds = await hasBiometricLoginCredentials();
    return !hasCreds;
  }, [state.isBiometricAvailable, state.isBiometricLoginEnabled, hasBiometricLoginCredentials]);

  const signOut = useCallback(async (): Promise<void> => {
    if (signInLock.current) await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const [hasParent2Str, hasBabyStr, setupComplete, hasSeenOnboarding, biometricLoginEnabled] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.HAS_PARENT2),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_BABY),
        AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);

      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
        secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
        secureStorage.deleteItem(SECURE_KEYS.PIN_HASH),
        secureStorage.deleteItem(SECURE_KEYS.SOCIAL_PROVIDER),
        AsyncStorage.multiRemove([
          ASYNC_KEYS.ONBOARDING_COMPLETE,
          ASYNC_KEYS.BIOMETRIC_ENABLED,
          ASYNC_KEYS.NAVIGATION_LOCK,
        ]),
      ]);

      const hasParent2 = hasParent2Str === 'true' ? true : hasParent2Str === 'skipped' ? 'skipped' : false;
      const hasBaby = hasBabyStr === 'true' ? true : hasBabyStr === 'skipped' ? 'skipped' : false;

      if (isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          isAuthenticated: false,
          userToken: null,
          userProfile: null,
          onboardingComplete: false,
          hasSeenOnboarding: hasSeenOnboarding === 'true',
          isBiometricEnabled: false,
          isBiometricLoginEnabled: biometricLoginEnabled === 'true',
          setupComplete: setupComplete === 'true',
          hasParent2,
          hasBaby,
        }));
      }
    } catch (error) { console.error('Sign out error:', error); }
  }, []);

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      const updated = { ...state.userProfile, ...updates };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updated));
      if (isMounted.current) setState(prev => ({ ...prev, userProfile: updated }));
      return true;
    } catch (error) { return false; }
  }, [state.userProfile]);

  const updateUserPreferences = useCallback(async (prefs: Partial<UserProfile['preferences']>): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      const updated = { ...state.userProfile, preferences: { ...state.userProfile.preferences, ...prefs } };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updated));
      if (isMounted.current) setState(prev => ({ ...prev, userProfile: updated }));
      return true;
    } catch (error) { return false; }
  }, [state.userProfile]);

  // ==================== COMMUNITY PROFILE METHODS ====================
  // These are unified with auth so community works seamlessly

  const updateCommunityProfile = useCallback(async (updates: { username?: string; handle?: string; bio?: string; avatar?: string; displayName?: string }): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      
      const updatedProfile = { ...state.userProfile };
      const storageOps: Promise<any>[] = [];
      
      if (updates.username !== undefined) {
        updatedProfile.communityUsername = updates.username;
        storageOps.push(AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_USERNAME, updates.username));
      }
      if (updates.handle !== undefined) {
        updatedProfile.communityHandle = updates.handle;
        storageOps.push(AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_HANDLE, updates.handle));
      }
      if (updates.bio !== undefined) {
        updatedProfile.communityBio = updates.bio;
        storageOps.push(AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_BIO, updates.bio));
      }
      if (updates.avatar !== undefined) {
        updatedProfile.communityAvatar = updates.avatar;
        // Also update main avatar if not set
        if (!updatedProfile.avatar) {
          updatedProfile.avatar = updates.avatar;
        }
        storageOps.push(AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_AVATAR, updates.avatar));
      }
      if (updates.displayName !== undefined) {
        updatedProfile.communityDisplayName = updates.displayName;
        storageOps.push(AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME, updates.displayName));
      }
      
      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile)),
        ...storageOps,
      ]);
      
      if (isMounted.current) setState(prev => ({ ...prev, userProfile: updatedProfile }));
      return true;
    } catch (error) {
      console.error('Update community profile error:', error);
      return false;
    }
  }, [state.userProfile]);

  const getCommunityProfile = useCallback(async (): Promise<{ username: string; handle: string; bio: string; avatar: string; displayName: string; stats: any; selectedTopics: string[] } | null> => {
    try {
      if (!state.userProfile) return null;
      return {
        username: state.userProfile.communityUsername || state.userProfile.fullName,
        handle: state.userProfile.communityHandle || `@${state.userProfile.fullName.toLowerCase().replace(/\s+/g, '_')}`,
        bio: state.userProfile.communityBio || '',
        avatar: state.userProfile.communityAvatar || state.userProfile.avatar || '👤',
        displayName: state.userProfile.communityDisplayName || state.userProfile.fullName,
        stats: state.userProfile.communityStats || { posts: 0, followers: 0, following: 0, helpful: 0 },
        selectedTopics: state.userProfile.communitySelectedTopics || [],
      };
    } catch (error) {
      return null;
    }
  }, [state.userProfile]);

  const updateCommunityStats = useCallback(async (stats: Partial<UserProfile['communityStats']>): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      const newStats = { ...state.userProfile.communityStats, ...stats };
      const updated = { ...state.userProfile, communityStats: newStats };
      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updated)),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_STATS, JSON.stringify(newStats)),
      ]);
      if (isMounted.current) setState(prev => ({ ...prev, userProfile: updated }));
      return true;
    } catch (error) { return false; }
  }, [state.userProfile]);

  const updateCommunityTopics = useCallback(async (topics: string[]): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      const trimmed = topics.slice(0, 5);
      const updated = { ...state.userProfile, communitySelectedTopics: trimmed };
      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updated)),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS, JSON.stringify(trimmed)),
      ]);
      if (isMounted.current) setState(prev => ({ ...prev, userProfile: updated }));
      return true;
    } catch (error) { return false; }
  }, [state.userProfile]);

  const isUsernameAvailable = useCallback(async (username: string): Promise<{ available: boolean; message: string }> => {
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
    
    const reserved = ['admin', 'littleloom', 'support', 'official', 'mod', 'moderator', 'system'];
    if (reserved.includes(trimmed)) {
      return { available: false, message: 'This username is reserved' };
    }
    
    // Check if current user already owns it
    const currentUserId = state.userProfile?.id;
    const existingUserId = usernameRegistryRef.current[trimmed];
    if (existingUserId && existingUserId !== currentUserId) {
      return { available: false, message: 'This username is already taken' };
    }
    
    return { available: true, message: 'Username is available' };
  }, [state.userProfile]);

  const registerCommunityUsername = useCallback(async (username: string): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      
      // Acquire lock
      while (usernameLockRef.current) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      usernameLockRef.current = true;
      
      try {
        const trimmed = username.trim().toLowerCase().replace(/^@/, '');
        const check = await isUsernameAvailable(trimmed);
        if (!check.available) return false;
        
        const newRegistry = { ...usernameRegistryRef.current, [trimmed]: state.userProfile.id };
        await saveUsernameRegistry(newRegistry);
        
        // Update profile with new username
        await updateCommunityProfile({ 
          username: trimmed,
          handle: `@${trimmed}` 
        });
        
        return true;
      } finally {
        usernameLockRef.current = false;
      }
    } catch (error) { 
      usernameLockRef.current = false;
      return false; 
    }
  }, [state.userProfile, isUsernameAvailable, saveUsernameRegistry, updateCommunityProfile]);

  const updateCommunityUsername = useCallback(async (newUsername: string): Promise<{ success: boolean; message: string }> => {
    try {
      if (!state.userProfile) {
        return { success: false, message: 'Not authenticated' };
      }
      
      // Acquire lock
      while (usernameLockRef.current) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      usernameLockRef.current = true;
      
      try {
        const trimmed = newUsername.trim().toLowerCase().replace(/^@/, '');
        const currentUsername = (state.userProfile.communityUsername || '').toLowerCase().replace(/^@/, '');
        
        if (trimmed === currentUsername) {
          return { success: true, message: 'No changes needed' };
        }
        
        const check = await isUsernameAvailable(trimmed);
        if (!check.available) {
          return { success: false, message: check.message };
        }
        
        // Remove old username from registry
        const newRegistry = { ...usernameRegistryRef.current };
        if (currentUsername) {
          delete newRegistry[currentUsername];
        }
        newRegistry[trimmed] = state.userProfile.id;
        
        await saveUsernameRegistry(newRegistry);
        
        // Update profile
        await updateCommunityProfile({ 
          username: trimmed,
          handle: `@${trimmed}` 
        });
        
        return { success: true, message: 'Username updated successfully' };
      } finally {
        usernameLockRef.current = false;
      }
    } catch (error) { 
      usernameLockRef.current = false;
      return { success: false, message: 'Failed to update username' }; 
    }
  }, [state.userProfile, isUsernameAvailable, saveUsernameRegistry, updateCommunityProfile]);

  const updateCommunityAvatar = useCallback(async (avatarUri: string): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      
      // Normalize image URI
      let normalizedUri = avatarUri;
      if (avatarUri.startsWith('file://')) {
        normalizedUri = avatarUri;
      } else if (avatarUri.startsWith('/')) {
        normalizedUri = `file://${avatarUri}`;
      }
      
      await updateCommunityProfile({ avatar: normalizedUri });
      
      // Also update main profile avatar
      const updated = { ...state.userProfile, avatar: normalizedUri };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updated));
      if (isMounted.current) setState(prev => ({ ...prev, userProfile: updated }));
      
      return true;
    } catch (error) {
      console.error('Update community avatar error:', error);
      return false;
    }
  }, [state.userProfile, updateCommunityProfile]);

  const setSetupCompleteCallback = useCallback((callback: (() => Promise<void>) | null) => {
    setupCompleteCallbackRef.current = callback;
  }, []);

  const completeSetup = useCallback(async (step: 'parent2' | 'baby') => {
    try {
      if (step === 'parent2') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_PARENT2, 'true'),
          AsyncStorage.setItem(ASYNC_KEYS.PARENT2_COMPLETED, 'true'),
        ]);
        if (isMounted.current) setState(prev => ({ ...prev, hasParent2: true }));
      } else if (step === 'baby') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_BABY, 'true'),
          AsyncStorage.setItem(ASYNC_KEYS.BABY_COMPLETED, 'true'),
        ]);
        if (isMounted.current) setState(prev => ({ ...prev, hasBaby: true }));
      }
      
      const [hasP2, hasB] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.PARENT2_COMPLETED),
        AsyncStorage.getItem(ASYNC_KEYS.BABY_COMPLETED),
      ]);
      
      const setupDone = hasP2 !== null && hasB !== null;
      if (setupDone) {
        await AsyncStorage.setItem(ASYNC_KEYS.SETUP_COMPLETE, 'true');
        if (isMounted.current) setState(prev => ({ ...prev, setupComplete: true }));
        if (setupCompleteCallbackRef.current) {
          try { await setupCompleteCallbackRef.current(); } catch (error) {}
        }
      }
    } catch (error) {}
  }, []);

  const skipSetup = useCallback(async (step: 'parent2' | 'baby') => {
    try {
      if (step === 'parent2') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_PARENT2, 'skipped'),
          AsyncStorage.setItem(ASYNC_KEYS.PARENT2_COMPLETED, 'skipped'),
        ]);
        if (isMounted.current) setState(prev => ({ ...prev, hasParent2: 'skipped' }));
      } else if (step === 'baby') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_BABY, 'skipped'),
          AsyncStorage.setItem(ASYNC_KEYS.BABY_COMPLETED, 'skipped'),
        ]);
        if (isMounted.current) setState(prev => ({ ...prev, hasBaby: 'skipped' }));
      }
      
      await AsyncStorage.setItem(ASYNC_KEYS.SETUP_COMPLETE, 'true');
      if (isMounted.current) setState(prev => ({ ...prev, setupComplete: true }));
      
      if (setupCompleteCallbackRef.current) {
        try { await setupCompleteCallbackRef.current(); } catch (error) {}
      }
    } catch (error) {}
  }, []);

  const wasSetupCompleted = useCallback(async () => {
    try {
      const [hasParent2Str, hasBabyStr, setupComplete] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.PARENT2_COMPLETED),
        AsyncStorage.getItem(ASYNC_KEYS.BABY_COMPLETED),
        AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
      ]);
      const hasParent2 = hasParent2Str === 'true' ? true : hasParent2Str === 'skipped' ? 'skipped' : false;
      const hasBaby = hasBabyStr === 'true' ? true : hasBabyStr === 'skipped' ? 'skipped' : false;
      return { hasParent2, hasBaby, setupComplete: setupComplete === 'true' || (hasParent2Str !== null && hasBabyStr !== null) };
    } catch (error) { return { hasParent2: false, hasBaby: false, setupComplete: false }; }
  }, []);

  const resetSetupFlow = useCallback(async () => {
    await AsyncStorage.multiRemove([
      ASYNC_KEYS.SETUP_COMPLETE,
      ASYNC_KEYS.HAS_PARENT2,
      ASYNC_KEYS.HAS_BABY,
      ASYNC_KEYS.PARENT2_COMPLETED,
      ASYNC_KEYS.BABY_COMPLETED,
    ]);
    if (isMounted.current) setState(prev => ({ ...prev, setupComplete: false, hasParent2: false, hasBaby: false }));
  }, []);

  const isAppActive = useCallback(() => appStateRef.current === 'active', []);
  const getLastActiveTime = useCallback(() => lastActiveTimeRef.current, []);
  const getBiometricTypeInfo = useCallback(() => ({
    type: state.biometricTypeName,
    icon: getBiometricIcon(state.availableBiometricTypes),
  }), [state.biometricTypeName, state.availableBiometricTypes]);

  const clearAllLocks = useCallback(() => {
    releaseSignInLock();
    releaseBiometricLock();
  }, [releaseSignInLock, releaseBiometricLock]);

  const getCurrentUserProfile = useCallback(() => state.userProfile, [state.userProfile]);

  const value = React.useMemo(() => ({
    ...state,
    signIn,
    signUp,
    signInWithSocial,
    signOut,
    checkBiometricAvailability,
    authenticateWithBiometric,
    enableBiometricForApp,
    enableBiometricLogin,
    disableBiometricLogin,
    hasBiometricLoginCredentials,
    loginWithBiometric,
    updateUserProfile,
    updateUserPreferences,
    skipSetup,
    completeSetup,
    resetSetupFlow,
    wasSetupCompleted,
    setSetupCompleteCallback,
    markOnboardingSeen,
    shouldShowBiometricPrompt,
    isAppActive,
    getLastActiveTime,
    getBiometricTypeInfo,
    clearAllLocks,
    getCurrentUserProfile,
    updateCommunityProfile,
    getCommunityProfile,
    updateCommunityStats,
    updateCommunityTopics,
    isUsernameAvailable,
    registerCommunityUsername,
    updateCommunityUsername,
    updateCommunityAvatar,
  }), [state, signIn, signUp, signInWithSocial, signOut, checkBiometricAvailability, authenticateWithBiometric, enableBiometricForApp, enableBiometricLogin, disableBiometricLogin, hasBiometricLoginCredentials, loginWithBiometric, updateUserProfile, updateUserPreferences, skipSetup, completeSetup, resetSetupFlow, wasSetupCompleted, setSetupCompleteCallback, markOnboardingSeen, shouldShowBiometricPrompt, isAppActive, getLastActiveTime, getBiometricTypeInfo, clearAllLocks, getCurrentUserProfile, updateCommunityProfile, getCommunityProfile, updateCommunityStats, updateCommunityTopics, isUsernameAvailable, registerCommunityUsername, updateCommunityUsername, updateCommunityAvatar]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthProvider;