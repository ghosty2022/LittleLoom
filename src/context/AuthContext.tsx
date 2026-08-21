// src/context/AuthContext.tsx
// Full Supabase Auth - No local DB fallbacks

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SocialUser } from '../hooks/useSocialAuth';
import { supabase } from '@/utils/supabase';
import { Session, User } from '@supabase/supabase-js';
import { clearUserIdCache } from '@/database/dbHelpers';

// ─── SINGLE SOURCE OF TRUTH FOR ONBOARDING ─────────────────────────────
export const ONBOARDING_KEY = '@littleloom_onboarding_complete_v3';
export const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

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
  ONBOARDING_COMPLETE: ONBOARDING_KEY,
  HAS_SEEN_ONBOARDING: ONBOARDING_SEEN_KEY,
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
  session: Session | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signInWithSocial: (socialUser: SocialUser) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  checkBiometricAvailability: () => Promise<boolean>;
  authenticateWithBiometric: (promptMessage?: string) => Promise<LocalAuthentication.LocalAuthenticationResult>;
  enableBiometricForApp: () => Promise<boolean>;
  enableBiometricLogin: (email: string, password: string) => Promise<boolean>;
  disableBiometricLogin: () => Promise<void>;
  hasBiometricLoginCredentials: () => Promise<boolean>;
  loginWithBiometric: () => Promise<{ success: boolean; message?: string }>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  updateUserPreferences: (prefs: Partial<UserProfile['preferences']>) => Promise<boolean>;
  skipSetup: (step: 'parent2' | 'baby') => Promise<void>;
  completeSetup: (step: 'parent2' | 'baby') => Promise<boolean>;
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
  updateCommunityProfile: (updates: { username?: string; handle?: string; bio?: string; avatar?: string; displayName?: string }) => Promise<boolean>;
  getCommunityProfile: () => Promise<{ username: string; handle: string; bio: string; avatar: string; displayName: string; stats: any; selectedTopics: string[] } | null>;
  updateCommunityStats: (stats: Partial<UserProfile['communityStats']>) => Promise<boolean>;
  updateCommunityTopics: (topics: string[]) => Promise<boolean>;
  isUsernameAvailable: (username: string) => Promise<{ available: boolean; message: string }>;
  registerCommunityUsername: (username: string) => Promise<boolean>;
  updateCommunityUsername: (newUsername: string) => Promise<{ success: boolean; message: string }>;
  updateCommunityAvatar: (avatarUri: string) => Promise<boolean>;
  signUpWithInviteCode: (
    code: string,
    fullName: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPasswordForUser: (email: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  findUserByEmail: (email: string) => Promise<{ userId: string; email: string; fullName: string; role: string } | null>;
  findUserByEmailOrUsername: (identifier: string) => Promise<{ userId: string; email: string; fullName: string; role: string } | null>;
  findUserByEmailOrUsernameOrPhone: (identifier: string) => Promise<{ userId: string; email: string; fullName: string; role: string } | null>;
  checkSession: () => Promise<boolean>;
  forceLogoutOnInvalidSession: () => Promise<boolean>;
  verifyPassword: (password: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<{ success: boolean; message: string }>;
  deleteAccountWithConfirmation: () => Promise<{ success: boolean; message: string }>;
  refreshSession: () => Promise<boolean>;
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
    session: null,
  });

  const isMounted = useRef(true);
  const initComplete = useRef(false);
  const setupCompleteCallbackRef = useRef<(() => Promise<void>) | null>(null);
  
  const signInLock = useRef(false);
  const signInLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const biometricLoginLock = useRef(false);
  const biometricLoginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSignInTime = useRef(0);
  
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastActiveTimeRef = useRef<number>(Date.now());
  const isAuthenticatedRef = useRef<boolean>(false);

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

  // ─── SESSION MANAGEMENT ─────────────────────────────────────────────────

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.warn('[Auth] Refresh session failed:', error?.message);
        return false;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.warn('[Auth] Get user failed:', userError?.message);
        return false;
      }

      if (isMounted.current) {
        setState(prev => ({ ...prev, session }));
      }
      return true;
    } catch (error) {
      console.error('[Auth] Refresh session error:', error);
      return false;
    }
  }, []);

  const validateCurrentSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.warn('[Auth] Session validation failed, clearing local state');
        await Promise.all([
          secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
          secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
        ]);
        
        // Clear the user ID cache
        clearUserIdCache();
        
        if (isMounted.current) {
          setState(prev => ({ 
            ...prev, 
            isAuthenticated: false,
            userToken: null,
            userProfile: null,
            session: null,
          }));
        }
        return false;
      }

      if (isMounted.current) {
        setState(prev => ({ ...prev, session }));
      }

      const user = session.user;
      const userMeta = user.user_metadata || {};
      
      const currentProfile = await secureStorage.getItem(SECURE_KEYS.USER_PROFILE);
      let profile = currentProfile ? JSON.parse(currentProfile) : null;
      
      if (profile && profile.id !== user.id) {
        const updatedProfile: UserProfile = {
          id: user.id,
          fullName: userMeta.full_name || userMeta.fullName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          avatar: userMeta.avatar || '👤',
          role: (userMeta.role as 'parent1' | 'parent2' | 'guardian') || 'parent1',
          createdAt: user.created_at || new Date().toISOString(),
          preferences: { notifications: true, darkMode: false, language: 'en' },
        };
        
        await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
        if (isMounted.current) {
          setState(prev => ({ ...prev, userProfile: updatedProfile }));
        }
      }
      
      return true;
    } catch (error) {
      console.error('[Auth] Session validation error:', error);
      return false;
    }
  }, []);

  const forceLogoutOnInvalidSession = useCallback(async (): Promise<boolean> => {
    try {
      const isValid = await validateCurrentSession();
      if (!isValid && state.isAuthenticated) {
        console.log('[Auth] Force logout due to invalid session');
        await signOut();
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Auth] Force logout error:', error);
      return false;
    }
  }, [validateCurrentSession, state.isAuthenticated]);

  // ─── SIGN IN ────────────────────────────────────────────────────────────

  const performSignInInternal = useCallback(async (email: string, password: string, isBiometric: boolean = false): Promise<{ success: boolean; message?: string; user?: User }> => {
    try {
      if (!email || !password) {
        return { success: false, message: 'Missing email or password' };
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData?.user) {
        console.warn('[Auth] Supabase sign in failed:', authError?.message);
        
        if (authError?.message?.toLowerCase().includes('email not confirmed')) {
          try {
            const { error: resendError } = await supabase.auth.resend({
              type: 'signup',
              email: email.trim(),
            });
            if (!resendError) {
              return { 
                success: false, 
                message: 'Please check your email and confirm your account. A new confirmation link has been sent.' 
              };
            }
          } catch (e) {}
          return { success: false, message: 'Please check your email and confirm your account before signing in.' };
        }
        
        if (authError?.message?.toLowerCase().includes('invalid login credentials')) {
          return { success: false, message: 'Invalid email or password. Please try again.' };
        }
        
        return { success: false, message: authError?.message || 'Unable to sign in. Please try again.' };
      }

      const token = authData.session?.access_token || '';
      const user = authData.user;

      const userEmail = user.email || email.trim();
      const userMeta = user.user_metadata || {};
      const fullName = userMeta.full_name || userMeta.fullName || userEmail.split('@')[0];

      // Load community profile data from AsyncStorage
      const [commUsername, commHandle, commBio, commAvatar, commDisplayName, commStats, commTopics] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_HANDLE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_BIO),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_AVATAR),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_STATS),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS),
      ]);
      
      const baseName = fullName || userEmail.split('@')[0];
      const baseHandle = `@${baseName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      
      const userProfile: UserProfile = {
        id: user.id,
        fullName: baseName,
        email: userEmail,
        avatar: userMeta.avatar || '👤',
        role: (userMeta.role as 'parent1' | 'parent2' | 'guardian') || 'parent1',
        createdAt: user.created_at || new Date().toISOString(),
        preferences: { notifications: true, darkMode: false, language: 'en' },
        communityUsername: commUsername || baseName,
        communityHandle: commHandle || baseHandle,
        communityBio: commBio || '',
        communityAvatar: commAvatar || userMeta.avatar || '👤',
        communityDisplayName: commDisplayName || baseName,
        communityStats: commStats ? JSON.parse(commStats) : { posts: 0, followers: 0, following: 0, helpful: 0 },
        communitySelectedTopics: commTopics ? JSON.parse(commTopics) : [],
      };

      const [tokenStored, profileStored] = await Promise.all([
        secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token),
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile)),
      ]);
      
      if (!tokenStored || !profileStored) {
        console.warn('[Auth] Failed to save login data to secure storage');
        return { success: false, message: 'Failed to save login data' };
      }

      await AsyncStorage.setItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING, 'true');

      const [setupCompleteStr, hasParent2Str, hasBabyStr] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
        AsyncStorage.getItem(ASYNC_KEYS.PARENT2_COMPLETED),
        AsyncStorage.getItem(ASYNC_KEYS.BABY_COMPLETED),
      ]);
      
      const p2Done = hasParent2Str === 'true' ? true : hasParent2Str === 'skipped' ? 'skipped' : false;
      const babyDone = hasBabyStr === 'true' ? true : hasBabyStr === 'skipped' ? 'skipped' : false;
      const bothStepsAddressed = hasParent2Str !== null && hasBabyStr !== null;
      const isSetupComplete = setupCompleteStr === 'true' || bothStepsAddressed;
      
      if (isSetupComplete) {
        await AsyncStorage.setItem(ASYNC_KEYS.ONBOARDING_COMPLETE, 'true');
      }

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          userToken: token,
          userProfile,
          session: authData.session,
          onboardingComplete: isSetupComplete,
          hasSeenOnboarding: true,
          setupComplete: isSetupComplete,
          hasParent2: p2Done,
          hasBaby: babyDone,
        }));
      }
      return { success: true, user };
    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      return { success: false, message: 'An unexpected error occurred. Please try again.' };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    if (!acquireSignInLock()) return { success: false, message: 'Another sign in operation in progress' };
    const now = Date.now();
    if (now - lastSignInTime.current < 1500) {
      await new Promise(resolve => setTimeout(resolve, 1500 - (now - lastSignInTime.current)));
    }
    try {
      const result = await performSignInInternal(email, password, false);
      lastSignInTime.current = Date.now();
      return result;
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock, performSignInInternal]);

  // ─── SIGN UP ───────────────────────────────────────────────────────────

  const signUp = useCallback(async (fullName: string, email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    if (!acquireSignInLock()) return { success: false, message: 'Another operation in progress' };
    try {
      console.log('[Auth] SignUp attempt for:', email);
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError || !signUpData?.user) {
        console.warn('[Auth] Supabase sign up rejected:', signUpError?.message);
        
        if (signUpError?.message?.toLowerCase().includes('already registered') ||
            signUpError?.message?.toLowerCase().includes('user already exists')) {
          console.log('[Auth] User exists, attempting sign in...');
          const result = await performSignInInternal(email.trim(), password, false);
          return result;
        }
        
        return { success: false, message: signUpError?.message || 'Could not create account' };
      }

      console.log('[Auth] User created successfully:', signUpData.user.id);
      const token = signUpData.session?.access_token || '';
      const userId = signUpData.user.id;
      
      try {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
        });
        if (!resendError) {
          console.log('[Auth] Confirmation email sent');
        }
      } catch (resendErr) {
        console.warn('[Auth] Could not send confirmation:', resendErr);
      }
      
      const handle = `@${fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      
      const userProfile: UserProfile = {
        id: userId,
        fullName,
        email: email.trim(),
        avatar: '👤',
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
        AsyncStorage.setItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING, 'true'),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_USERNAME, fullName),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_HANDLE, handle),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME, fullName),
      ]);

      await AsyncStorage.multiRemove([
        ASYNC_KEYS.SETUP_COMPLETE,
        ASYNC_KEYS.HAS_PARENT2,
        ASYNC_KEYS.HAS_BABY,
        ASYNC_KEYS.PARENT2_COMPLETED,
        ASYNC_KEYS.BABY_COMPLETED,
      ]);

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          userToken: token,
          userProfile,
          session: signUpData.session,
          onboardingComplete: false,
          hasSeenOnboarding: true,
          setupComplete: false,
          hasParent2: false,
          hasBaby: false,
        }));
      }

      return { success: true };
    } catch (error) {
      console.error('[Auth] Sign up error:', error);
      return { success: false, message: 'Failed to create account. Please try again.' };
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock, performSignInInternal]);

  // ─── SOCIAL SIGN IN ────────────────────────────────────────────────────

  const signInWithSocial = useCallback(async (socialUser: SocialUser): Promise<{ success: boolean; message?: string }> => {
    if (!acquireSignInLock()) return { success: false, message: 'Another sign in operation in progress' };
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithOAuth({
        provider: socialUser.provider === 'google' ? 'google' : 
                  socialUser.provider === 'apple' ? 'apple' : 
                  socialUser.provider === 'facebook' ? 'facebook' : 'google',
      });

      if (authError) {
        console.error('[Auth] Social sign in failed:', authError.message);
        return { success: false, message: 'Unable to sign in with social provider. Please try again.' };
      }

      const token = `social_token_${socialUser.provider}_${Date.now()}`;
      
      const userProfile: UserProfile = {
        id: socialUser.id || `social_${Date.now()}`,
        fullName: socialUser.fullName,
        email: socialUser.email,
        avatar: socialUser.avatar || '👤',
        role: 'parent1',
        createdAt: new Date().toISOString(),
        preferences: { notifications: true, darkMode: false, language: 'en' },
        socialProvider: socialUser.provider,
        communityUsername: socialUser.fullName,
        communityHandle: `@${socialUser.fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`,
        communityBio: '',
        communityAvatar: socialUser.avatar || '👤',
        communityDisplayName: socialUser.fullName,
        communityStats: { posts: 0, followers: 0, following: 0, helpful: 0 },
        communitySelectedTopics: [],
      };

      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token),
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile)),
        secureStorage.setItem(SECURE_KEYS.SOCIAL_PROVIDER, socialUser.provider),
        AsyncStorage.setItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING, 'true'),
      ]);

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          userToken: token,
          userProfile,
          onboardingComplete: false,
          hasSeenOnboarding: true,
          setupComplete: false,
          hasParent2: false,
          hasBaby: false,
        }));
      }

      return { success: true };
    } catch (error) {
      console.error('Social sign in error:', error);
      return { success: false, message: 'Social authentication failed' };
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock]);

  // ─── SIGN OUT ──────────────────────────────────────────────────────────

  const signOut = useCallback(async (): Promise<void> => {
    if (signInLock.current) await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      await AsyncStorage.setItem('littleloom_security_lock', 'false');
      
      const [hasParent2Str, hasBabyStr, setupComplete, hasSeenOnboarding] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.HAS_PARENT2),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_BABY),
        AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING),
      ]);

      await supabase.auth.signOut();

      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
        secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
        secureStorage.deleteItem(SECURE_KEYS.SOCIAL_PROVIDER),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
        AsyncStorage.multiRemove([
          ASYNC_KEYS.ONBOARDING_COMPLETE,
          ASYNC_KEYS.NAVIGATION_LOCK,
          'littleloom_security_lock',
        ]),
      ]);

      // ─── CRITICAL: Clear the user ID cache ────────────────────────────
      clearUserIdCache();

      const hasParent2 = hasParent2Str === 'true' ? true : hasParent2Str === 'skipped' ? 'skipped' : false;
      const hasBaby = hasBabyStr === 'true' ? true : hasBabyStr === 'skipped' ? 'skipped' : false;

      if (isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          isAuthenticated: false,
          userToken: null,
          userProfile: null,
          session: null,
          onboardingComplete: hasSeenOnboarding === 'true',
          hasSeenOnboarding: hasSeenOnboarding === 'true',
          isBiometricLoginEnabled: false,
          setupComplete: setupComplete === 'true',
          hasParent2,
          hasBaby,
        }));
      }
    } catch (error) { console.error('Sign out error:', error); }
  }, []);

  // ─── BIOMETRIC FUNCTIONS ──────────────────────────────────────────────

  const checkBiometricAvailability = useCallback(async (): Promise<boolean> => {
    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      
      if (hasHardware && isEnrolled) {
        let availableTypes: LocalAuthentication.AuthenticationType[] = [];
        try {
          availableTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        } catch (e) {}
        
        const typeName = getBiometricTypeName(availableTypes);
        
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isBiometricAvailable: true,
            availableBiometricTypes: availableTypes,
            biometricTypeName: typeName,
          }));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return false;
    }
  }, []);

  const authenticateWithBiometric = useCallback(async (promptMessage?: string): Promise<LocalAuthentication.LocalAuthenticationResult> => {
    try {
      const available = await checkBiometricAvailability();
      if (!available) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      return await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to continue',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: String(error) };
    }
  }, [checkBiometricAvailability]);

  const enableBiometricForApp = useCallback(async (): Promise<boolean> => {
    try {
      const available = await checkBiometricAvailability();
      if (!available) return false;

      const result = await authenticateWithBiometric('Enable biometric authentication');
      if (result.success) {
        await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'true');
        if (isMounted.current) {
          setState(prev => ({ ...prev, isBiometricEnabled: true }));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Enable biometric error:', error);
      return false;
    }
  }, [checkBiometricAvailability, authenticateWithBiometric]);

  const enableBiometricLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const available = await checkBiometricAvailability();
      if (!available) return false;

      const result = await authenticateWithBiometric('Enable biometric login');
      if (result.success) {
        await Promise.all([
          secureStorage.setItem(SECURE_KEYS.BIOMETRIC_EMAIL, email),
          secureStorage.setItem(SECURE_KEYS.BIOMETRIC_PASSWORD, password),
          secureStorage.setItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED, 'true'),
        ]);
        
        if (isMounted.current) {
          setState(prev => ({ ...prev, isBiometricLoginEnabled: true }));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Enable biometric login error:', error);
      return false;
    }
  }, [checkBiometricAvailability, authenticateWithBiometric]);

  const disableBiometricLogin = useCallback(async (): Promise<void> => {
    try {
      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
        AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'false'),
      ]);
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, isBiometricLoginEnabled: false, isBiometricEnabled: false }));
      }
    } catch (error) {
      console.error('Disable biometric login error:', error);
    }
  }, []);

  const hasBiometricLoginCredentials = useCallback(async (): Promise<boolean> => {
    try {
      const [email, password, enabled] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);
      return !!(email && password && enabled === 'true');
    } catch (error) {
      return false;
    }
  }, []);

  const loginWithBiometric = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!acquireBiometricLock()) {
      return { success: false, message: 'Biometric login in progress' };
    }
    
    try {
      const [available, hasCredentials] = await Promise.all([
        checkBiometricAvailability(),
        hasBiometricLoginCredentials(),
      ]);
      
      if (!available) {
        return { success: false, message: 'Biometric authentication not available' };
      }
      
      if (!hasCredentials) {
        return { success: false, message: 'No biometric credentials saved' };
      }

      const result = await authenticateWithBiometric('Login with biometric');
      if (!result.success) {
        return { success: false, message: 'Biometric authentication failed' };
      }

      const email = await secureStorage.getItem(SECURE_KEYS.BIOMETRIC_EMAIL);
      const password = await secureStorage.getItem(SECURE_KEYS.BIOMETRIC_PASSWORD);
      
      if (!email || !password) {
        return { success: false, message: 'Missing biometric credentials' };
      }

      const signInResult = await performSignInInternal(email, password, true);
      if (!signInResult.success) {
        return { success: false, message: signInResult.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Biometric login error:', error);
      return { success: false, message: 'Biometric login failed' };
    } finally {
      releaseBiometricLock();
    }
  }, [acquireBiometricLock, releaseBiometricLock, checkBiometricAvailability, hasBiometricLoginCredentials, authenticateWithBiometric, performSignInInternal]);

  // ─── USER PROFILE FUNCTIONS ───────────────────────────────────────────

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    const currentProfile = state.userProfile;
    if (!currentProfile) return false;

    try {
      const updatedProfile = { ...currentProfile, ...updates };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }
      
      return true;
    } catch (error) {
      console.error('Update user profile error:', error);
      return false;
    }
  }, [state.userProfile]);

  const updateUserPreferences = useCallback(async (prefs: Partial<UserProfile['preferences']>): Promise<boolean> => {
    const currentProfile = state.userProfile;
    if (!currentProfile) return false;

    try {
      const updatedProfile = {
        ...currentProfile,
        preferences: { ...currentProfile.preferences, ...prefs } as UserProfile['preferences'],
      };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }
      return true;
    } catch (error) {
      console.error('Update preferences error:', error);
      return false;
    }
  }, [state.userProfile]);

  const getCurrentUserProfile = useCallback((): UserProfile | null => {
    return state.userProfile;
  }, [state.userProfile]);

  // ─── COMMUNITY PROFILE FUNCTIONS ──────────────────────────────────────

  const updateCommunityProfile = useCallback(async (updates: { username?: string; handle?: string; bio?: string; avatar?: string; displayName?: string }): Promise<boolean> => {
    const currentProfile = state.userProfile;
    if (!currentProfile) return false;

    try {
      const updatedProfile: UserProfile = { ...currentProfile };
      if (updates.username !== undefined) updatedProfile.communityUsername = updates.username;
      if (updates.handle !== undefined) updatedProfile.communityHandle = updates.handle;
      if (updates.bio !== undefined) updatedProfile.communityBio = updates.bio;
      if (updates.avatar !== undefined) updatedProfile.communityAvatar = updates.avatar;
      if (updates.displayName !== undefined) updatedProfile.communityDisplayName = updates.displayName;

      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
      
      if (updates.username !== undefined) {
        await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_USERNAME, updates.username);
      }
      if (updates.handle !== undefined) {
        await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_HANDLE, updates.handle);
      }
      if (updates.bio !== undefined) {
        await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_BIO, updates.bio);
      }
      if (updates.avatar !== undefined) {
        await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_AVATAR, updates.avatar);
      }
      if (updates.displayName !== undefined) {
        await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME, updates.displayName);
      }

      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }
      return true;
    } catch (error) {
      console.error('Update community profile error:', error);
      return false;
    }
  }, [state.userProfile]);

  const getCommunityProfile = useCallback(async (): Promise<{ username: string; handle: string; bio: string; avatar: string; displayName: string; stats: any; selectedTopics: string[] } | null> => {
    try {
      const [username, handle, bio, avatar, displayName, stats, selectedTopics] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_HANDLE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_BIO),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_AVATAR),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_STATS),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS),
      ]);

      return {
        username: username || '',
        handle: handle || '',
        bio: bio || '',
        avatar: avatar || '👤',
        displayName: displayName || '',
        stats: stats ? JSON.parse(stats) : { posts: 0, followers: 0, following: 0, helpful: 0 },
        selectedTopics: selectedTopics ? JSON.parse(selectedTopics) : [],
      };
    } catch (error) {
      console.error('Get community profile error:', error);
      return null;
    }
  }, []);

  const updateCommunityStats = useCallback(async (stats: Partial<UserProfile['communityStats']>): Promise<boolean> => {
    const currentProfile = state.userProfile;
    if (!currentProfile) return false;

    try {
      const currentStats = currentProfile.communityStats || { posts: 0, followers: 0, following: 0, helpful: 0 };
      const updatedStats = { ...currentStats, ...stats };
      
      const updatedProfile = { ...currentProfile, communityStats: updatedStats };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
      await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_STATS, JSON.stringify(updatedStats));
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }
      return true;
    } catch (error) {
      console.error('Update community stats error:', error);
      return false;
    }
  }, [state.userProfile]);

  const updateCommunityTopics = useCallback(async (topics: string[]): Promise<boolean> => {
    const currentProfile = state.userProfile;
    if (!currentProfile) return false;

    try {
      const updatedProfile = { ...currentProfile, communitySelectedTopics: topics };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
      await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS, JSON.stringify(topics));
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }
      return true;
    } catch (error) {
      console.error('Update community topics error:', error);
      return false;
    }
  }, [state.userProfile]);

  const updateCommunityUsername = useCallback(async (newUsername: string): Promise<{ success: boolean; message: string }> => {
    const trimmed = newUsername.trim().toLowerCase().replace(/^@/, '');
    
    if (trimmed.length < 3) {
      return { success: false, message: 'Username must be at least 3 characters' };
    }
    if (trimmed.length > 30) {
      return { success: false, message: 'Username must be less than 30 characters' };
    }
    
    const validPattern = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
    if (!validPattern.test(trimmed)) {
      return { success: false, message: 'Must start with a letter. Only letters, numbers, underscores, and dots allowed.' };
    }

    const availability = await isUsernameAvailable(trimmed);
    if (!availability.available) {
      return { success: false, message: availability.message };
    }

    const success = await updateCommunityProfile({ username: trimmed, handle: `@${trimmed}` });
    return { success, message: success ? 'Username updated successfully' : 'Failed to update username' };
  }, [updateCommunityProfile]);

  const updateCommunityAvatar = useCallback(async (avatarUri: string): Promise<boolean> => {
    return await updateCommunityProfile({ avatar: avatarUri });
  }, [updateCommunityProfile]);

  // ─── USERNAME AVAILABILITY ────────────────────────────────────────────

  const isUsernameAvailable = useCallback(async (username: string): Promise<{ available: boolean; message: string }> => {
    try {
      const trimmed = username.trim().toLowerCase().replace(/^@/, '');
      
      if (trimmed.length < 3) {
        return { available: false, message: 'Username must be at least 3 characters' };
      }
      
      // Check against community profiles in AsyncStorage
      const registryJson = await AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME);
      const existingUsernames = registryJson ? [registryJson] : [];
      
      // Also check local registry if it exists
      const allUsernamesJson = await AsyncStorage.getItem('littleloom_username_registry');
      let allUsernames: string[] = [];
      if (allUsernamesJson) {
        try {
          const parsed = JSON.parse(allUsernamesJson);
          allUsernames = Array.isArray(parsed) ? parsed : [];
        } catch {}
      }
      
      const allExisting = [...existingUsernames, ...allUsernames];
      
      if (allExisting.some(u => u.toLowerCase() === trimmed)) {
        return { available: false, message: 'Username is already taken' };
      }
      
      return { available: true, message: 'Username is available' };
    } catch (error) {
      console.error('Check username availability error:', error);
      return { available: false, message: 'Failed to check username availability' };
    }
  }, []);

  const registerCommunityUsername = useCallback(async (username: string): Promise<boolean> => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    const availability = await isUsernameAvailable(trimmed);
    if (!availability.available) return false;
    
    // Save to registry
    try {
      const registryJson = await AsyncStorage.getItem('littleloom_username_registry');
      let registry: string[] = registryJson ? JSON.parse(registryJson) : [];
      if (!Array.isArray(registry)) registry = [];
      registry.push(trimmed);
      await AsyncStorage.setItem('littleloom_username_registry', JSON.stringify(registry));
    } catch {}
    
    return await updateCommunityProfile({ 
      username: trimmed, 
      handle: `@${trimmed}`,
      displayName: trimmed,
    });
  }, [isUsernameAvailable, updateCommunityProfile]);

  // ─── SETUP FUNCTIONS ──────────────────────────────────────────────────

  const skipSetup = useCallback(async (step: 'parent2' | 'baby'): Promise<void> => {
    try {
      const key = step === 'parent2' ? ASYNC_KEYS.PARENT2_COMPLETED : ASYNC_KEYS.BABY_COMPLETED;
      await AsyncStorage.setItem(key, 'skipped');
      
      const stateKey = step === 'parent2' ? 'hasParent2' : 'hasBaby';
      if (isMounted.current) {
        setState(prev => ({ ...prev, [stateKey]: 'skipped' as const }));
      }
    } catch (error) {
      console.error(`Skip ${step} error:`, error);
    }
  }, []);

  const completeSetup = useCallback(async (step: 'parent2' | 'baby'): Promise<boolean> => {
    try {
      const key = step === 'parent2' ? ASYNC_KEYS.PARENT2_COMPLETED : ASYNC_KEYS.BABY_COMPLETED;
      await AsyncStorage.setItem(key, 'true');
      
      const stateKey = step === 'parent2' ? 'hasParent2' : 'hasBaby';
      if (isMounted.current) {
        setState(prev => ({ ...prev, [stateKey]: true as const }));
      }

      const [parent2Completed, babyCompleted] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.PARENT2_COMPLETED),
        AsyncStorage.getItem(ASYNC_KEYS.BABY_COMPLETED),
      ]);

      if (parent2Completed !== null && babyCompleted !== null) {
        await AsyncStorage.setItem(ASYNC_KEYS.SETUP_COMPLETE, 'true');
        await AsyncStorage.setItem(ASYNC_KEYS.ONBOARDING_COMPLETE, 'true');
        
        if (isMounted.current) {
          setState(prev => ({ 
            ...prev, 
            setupComplete: true, 
            onboardingComplete: true 
          }));
        }
        
        if (setupCompleteCallbackRef.current) {
          await setupCompleteCallbackRef.current();
        }
      }

      return true;
    } catch (error) {
      console.error(`Complete ${step} error:`, error);
      return false;
    }
  }, []);

  const resetSetupFlow = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([
        ASYNC_KEYS.SETUP_COMPLETE,
        ASYNC_KEYS.HAS_PARENT2,
        ASYNC_KEYS.HAS_BABY,
        ASYNC_KEYS.PARENT2_COMPLETED,
        ASYNC_KEYS.BABY_COMPLETED,
        ASYNC_KEYS.ONBOARDING_COMPLETE,
      ]);
      
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          setupComplete: false,
          onboardingComplete: false,
          hasParent2: false,
          hasBaby: false,
        }));
      }
    } catch (error) {
      console.error('Reset setup flow error:', error);
    }
  }, []);

  const wasSetupCompleted = useCallback(async (): Promise<{ hasParent2: boolean | 'skipped'; hasBaby: boolean | 'skipped'; setupComplete: boolean }> => {
    try {
      const [parent2Completed, babyCompleted, setupComplete] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.PARENT2_COMPLETED),
        AsyncStorage.getItem(ASYNC_KEYS.BABY_COMPLETED),
        AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
      ]);

      const hasParent2 = parent2Completed === 'true' ? true : parent2Completed === 'skipped' ? 'skipped' : false;
      const hasBaby = babyCompleted === 'true' ? true : babyCompleted === 'skipped' ? 'skipped' : false;
      const setupCompleteBool = setupComplete === 'true' || (parent2Completed !== null && babyCompleted !== null);

      return { hasParent2, hasBaby, setupComplete: setupCompleteBool };
    } catch (error) {
      return { hasParent2: false, hasBaby: false, setupComplete: false };
    }
  }, []);

  const setSetupCompleteCallback = useCallback((callback: (() => Promise<void>) | null) => {
    setupCompleteCallbackRef.current = callback;
  }, []);

  // ─── ONBOARDING FUNCTIONS ─────────────────────────────────────────────

  const markOnboardingSeen = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING, 'true');
      if (isMounted.current) {
        setState(prev => ({ ...prev, hasSeenOnboarding: true }));
      }
    } catch (error) {
      console.error('Mark onboarding seen error:', error);
    }
  }, []);

  const shouldShowBiometricPrompt = useCallback(async (): Promise<boolean> => {
    try {
      const [biometricEnabled, hasCredentials] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
        hasBiometricLoginCredentials(),
      ]);
      
      if (state.isBiometricAvailable && biometricEnabled !== 'true') {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }, [state.isBiometricAvailable, hasBiometricLoginCredentials]);

  // ─── UTILITY FUNCTIONS ────────────────────────────────────────────────

  const isAppActive = useCallback((): boolean => {
    return appStateRef.current === 'active';
  }, []);

  const getLastActiveTime = useCallback((): number => {
    return lastActiveTimeRef.current;
  }, []);

  const getBiometricTypeInfo = useCallback((): { type: string; icon: string } => {
    const types = state.availableBiometricTypes;
    return {
      type: getBiometricTypeName(types),
      icon: getBiometricIcon(types),
    };
  }, [state.availableBiometricTypes]);

  const clearAllLocks = useCallback(() => {
    releaseSignInLock();
    releaseBiometricLock();
  }, [releaseSignInLock, releaseBiometricLock]);

  // ─── PASSWORD FUNCTIONS ───────────────────────────────────────────────

  const forgotPassword = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Password reset email sent' };
    } catch (error) {
      return { success: false, message: 'Failed to send reset email' };
    }
  }, []);

  const resetPasswordForUser = useCallback(async (email: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to update password' };
    }
  }, []);

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    if (!state.userProfile?.email) return false;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: state.userProfile.email,
        password,
      });
      return !error;
    } catch {
      return false;
    }
  }, [state.userProfile?.email]);

  // ─── ACCOUNT FUNCTIONS ────────────────────────────────────────────────

  const deleteAccount = useCallback(async (password: string): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Account deletion requires additional verification. Please contact support.' };
  }, []);

  const deleteAccountWithConfirmation = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Account deletion requires additional verification. Please contact support.' };
  }, []);

  // ─── SIGN UP WITH INVITE CODE ─────────────────────────────────────────

  const signUpWithInviteCode = useCallback(async (
    code: string,
    fullName: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> => {
    const result = await signUp(fullName, email, password);
    return result;
  }, [signUp]);

  // ─── FIND USER FUNCTIONS (Supabase only) ─────────────────────────────

  const findUserByEmail = useCallback(async (email: string): Promise<{ userId: string; email: string; fullName: string; role: string } | null> => {
    try {
      // First try to get from auth
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (error) {
        console.warn('[Auth] Admin list users error:', error.message);
        return null;
      }
      
      const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) return null;
      
      const meta = user.user_metadata || {};
      return {
        userId: user.id,
        email: user.email || '',
        fullName: meta.full_name || meta.fullName || user.email?.split('@')[0] || '',
        role: meta.role || 'parent1',
      };
    } catch (error) {
      console.error('Find user by email error:', error);
      return null;
    }
  }, []);

  const findUserByEmailOrUsername = useCallback(async (identifier: string): Promise<{ userId: string; email: string; fullName: string; role: string } | null> => {
    // Check if it's an email
    if (identifier.includes('@')) {
      return await findUserByEmail(identifier);
    }
    // Otherwise check by username - this would require a users table in Supabase
    // For now, try email lookup as fallback
    return await findUserByEmail(identifier);
  }, [findUserByEmail]);

  const findUserByEmailOrUsernameOrPhone = useCallback(async (identifier: string): Promise<{ userId: string; email: string; fullName: string; role: string } | null> => {
    return await findUserByEmailOrUsername(identifier);
  }, [findUserByEmailOrUsername]);

  // ─── CHECK SESSION ────────────────────────────────────────────────────

  const checkSession = useCallback(async (): Promise<boolean> => {
    return await validateCurrentSession();
  }, [validateCurrentSession]);

  // ─── INITIALIZATION ─────────────────────────────────────────────────────

  useEffect(() => {
    if (initComplete.current) return;
    
    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('[Auth] Session error:', sessionError.message);
        }

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

        let isValidSession = false;
        let userProfile = null;
        
        if (session && token) {
          try {
            const { data: { user }, error } = await supabase.auth.getUser();
            isValidSession = !error && !!user;
            console.log('[Auth] Session validation:', isValidSession ? 'valid' : 'invalid');
            
            if (isValidSession && userProfileStr) {
              userProfile = JSON.parse(userProfileStr);
            }
          } catch (e) {
            console.warn('[Auth] Session validation error:', e);
            isValidSession = false;
          }
          
          if (!isValidSession) {
            console.log('[Auth] Invalid session detected, clearing local state');
            await Promise.all([
              secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
              secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
              secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
              secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
              secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
            ]);
            // Clear the user ID cache
            clearUserIdCache();
          }
        }
        
        if (userProfile && isValidSession) {
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

        const p2Done = parent2Completed !== null;
        const bDone = babyCompleted !== null;
        const explicitSetupComplete = setupComplete === 'true';
        const bothStepsAddressed = p2Done && bDone;
        const shouldBeSetupComplete = explicitSetupComplete || bothStepsAddressed;

        const hasParent2 = parent2Completed === 'true' ? true : 
                          parent2Completed === 'skipped' ? 'skipped' :
                          hasParent2Str === 'true' ? true :
                          hasParent2Str === 'skipped' ? 'skipped' : false;
                          
        const hasBaby = babyCompleted === 'true' ? true :
                       babyCompleted === 'skipped' ? 'skipped' :
                       hasBabyStr === 'true' ? true :
                       hasBabyStr === 'skipped' ? 'skipped' : false;

        const isOnboardingDone = onboardingComplete === 'true';
        const effectiveOnboardingComplete = isOnboardingDone || shouldBeSetupComplete;

        if (isMounted.current) {
          setState({
            isLoading: false,
            isAuthenticated: isValidSession && !!token,
            userToken: isValidSession ? token : null,
            userProfile: isValidSession ? userProfile : null,
            onboardingComplete: effectiveOnboardingComplete,
            hasSeenOnboarding: hasSeenOnboarding === 'true' || (isValidSession && !!token),
            isBiometricAvailable: biometricAvailable,
            isBiometricEnabled: biometricEnabled === 'true',
            isBiometricLoginEnabled: biometricLoginEnabled === 'true',
            setupComplete: shouldBeSetupComplete,
            hasParent2,
            hasBaby,
            availableBiometricTypes: availableTypes,
            biometricTypeName: bioTypeName,
            session: session || null,
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

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state change:', event);
      
      if (event === 'SIGNED_IN' && session) {
        const user = session.user;
        const userMeta = user.user_metadata || {};
        
        const userProfile: UserProfile = {
          id: user.id,
          fullName: userMeta.full_name || userMeta.fullName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          avatar: userMeta.avatar || '👤',
          role: (userMeta.role as 'parent1' | 'parent2' | 'guardian') || 'parent1',
          createdAt: user.created_at || new Date().toISOString(),
          preferences: { notifications: true, darkMode: false, language: 'en' },
        };
        
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            userToken: session.access_token,
            userProfile,
            session,
          }));
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear the user ID cache on sign out
        clearUserIdCache();
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isAuthenticated: false,
            userToken: null,
            userProfile: null,
            session: null,
          }));
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        if (isMounted.current) {
          setState(prev => ({ ...prev, session }));
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // ─── PERIODIC SESSION CHECK ─────────────────────────────────────────

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    if (state.isAuthenticated) {
      intervalId = setInterval(async () => {
        try {
          const isValid = await validateCurrentSession();
          if (!isValid && isMounted.current) {
            console.log('[Auth] Periodic session check failed, logging out...');
            await signOut();
          }
        } catch (error) {
          console.warn('[Auth] Periodic session check error:', error);
        }
      }, 300000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [state.isAuthenticated, validateCurrentSession, signOut]);

  // ─── CONTEXT VALUE ────────────────────────────────────────────────────

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
    signUpWithInviteCode,
    forgotPassword,
    resetPasswordForUser,
    findUserByEmail,
    findUserByEmailOrUsername,
    findUserByEmailOrUsernameOrPhone,
    checkSession,
    forceLogoutOnInvalidSession,
    verifyPassword,
    deleteAccount,
    deleteAccountWithConfirmation,
    refreshSession,
  }), [
    state,
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
    signUpWithInviteCode,
    forgotPassword,
    resetPasswordForUser,
    findUserByEmail,
    findUserByEmailOrUsername,
    findUserByEmailOrUsernameOrPhone,
    checkSession,
    forceLogoutOnInvalidSession,
    verifyPassword,
    deleteAccount,
    deleteAccountWithConfirmation,
    refreshSession,
  ]);

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