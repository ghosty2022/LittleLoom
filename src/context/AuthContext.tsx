// src/context/AuthContext.tsx
// Full Supabase Auth - No local DB fallbacks - FIXED RLS and Avatar issues
//
// ─── CHANGELOG (this version) ────────────────────────────────────────
//   • validateCurrentSession:
//       - Reads isAuthenticatedRef.current (not state.isAuthenticated)
//         to avoid stale-closure bugs in the periodic check
//       - Distinguishes transient errors (network) from a genuine
//         `session === null` — only wipes state on the latter
//       - Retries getSession() once after 400ms before declaring
//         the user logged out, in case auto-refresh is in flight
//   • signOut:
//       - Uses { scope: 'local' } so refresh_token is NOT revoked
//         server-side. Prevents the "Invalid login credentials on
//         second attempt" bug where an internal cleanup signOut
//         killed the user's session before their next login.
//   • Periodic 5-minute check:
//       - Double-confirms the session is genuinely dead before
//         triggering signOut. A single failed check no longer logs
//         the user out.

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

  // ─── Refs holding latest state values so callbacks with empty deps
  //     can still read them without stale closures. ────────────────
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

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
        // Only log — do NOT wipe. A transient error here is not a
        // reason to log the user out.
        if (error && __DEV__) {
          console.warn('[Auth] Refresh session failed:', error.message);
        }
        return false;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        if (userError && __DEV__) {
          console.warn('[Auth] Get user failed:', userError.message);
        }
        return false;
      }

      if (isMounted.current) {
        setState(prev => ({ ...prev, session }));
      }
      return true;
    } catch (error) {
      if (__DEV__) console.error('[Auth] Refresh session error:', error);
      return false;
    }
  }, []);

  /**
   * Validate the current Supabase session.
   *
   * Behavior:
   *   • Transient error  → preserve current state, return whether we
   *                        were authenticated before
   *   • Session is null  → retry once after 400ms (auto-refresh may
   *                        be in flight), then wipe if still null
   *   • Valid session    → update state and return true
   */
  const validateCurrentSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      // ─── Transient error — do NOT wipe user state ────────────────
      if (error) {
        if (__DEV__) {
          console.warn('[Auth] Session check failed (transient):', error.message);
        }
        // Read from ref — avoids stale closure when this callback has
        // an empty deps array.
        return Boolean(isAuthenticatedRef.current);
      }

      // ─── Genuinely no session — retry once before wiping ─────────
      if (!session) {
        await new Promise((r) => setTimeout(r, 400));
        const { data: { session: retry } } = await supabase.auth.getSession();

        if (retry?.user) {
          if (isMounted.current) {
            setState((prev) => ({ ...prev, session: retry }));
          }
          return true;
        }

        // Confirmed dead — wipe local state.
        if (__DEV__) console.warn('[Auth] No session — clearing local state');
        await Promise.all([
          secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
          secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
        ]);

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

      // ─── Valid session — keep state fresh ───────────────────────
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
      if (__DEV__) console.error('[Auth] Session validation error:', error);
      // Fail-safe: don't wipe on unexpected errors.
      return Boolean(isAuthenticatedRef.current);
    }
  }, []);

  const forceLogoutOnInvalidSession = useCallback(async (): Promise<boolean> => {
    try {
      const isValid = await validateCurrentSession();
      if (!isValid && isAuthenticatedRef.current) {
        if (__DEV__) console.log('[Auth] Force logout due to invalid session');
        await signOut();
        return false;
      }
      return true;
    } catch (error) {
      if (__DEV__) console.error('[Auth] Force logout error:', error);
      return false;
    }
  }, [validateCurrentSession]);

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

        // ─── FIX: Kill any stale SDK session so auto-refresh can't ──
        //     silently log this user in behind our back. Without this,
        //     a wrong-password attempt still ends up authenticated
        //     because the SDK refreshes an old refresh_token.
        //
        //     We only do this when the failure is auth-related
        //     (invalid credentials / no user). Network failures are
        //     left alone.
        const msg = (authError?.message || '').toLowerCase();
        const isAuthFailure =
          msg.includes('invalid') ||
          msg.includes('credentials') ||
          msg.includes('not found') ||
          !authData?.user;

        if (isAuthFailure) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {}
          try {
            await secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN);
            await secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE);
          } catch {}
          try {
            clearUserIdCache();
          } catch {}
        }

        if (msg.includes('email not confirmed')) {
          try {
            const { error: resendError } = await supabase.auth.resend({
              type: 'signup',
              email: email.trim(),
            });
            if (!resendError) {
              return {
                success: false,
                message:
                  'Please check your email and confirm your account. A new confirmation link has been sent.',
              };
            }
          } catch (e) {}
          return {
            success: false,
            message:
              'Please check your email and confirm your account before signing in.',
          };
        }

        if (msg.includes('invalid login credentials')) {
          return {
            success: false,
            message: 'Invalid email or password. Please try again.',
          };
        }

        return {
          success: false,
          message:
            authError?.message ||
            'Unable to sign in. Please try again.',
        };
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

      // ─── FIX: Read the live profile from the profiles table ────
      // The auth user_metadata may be stale. The profiles table is
      // the authoritative source for full_name, email, and avatar.
      let liveFullName = fullName;
      let liveEmail = userEmail;
      let liveAvatar = userMeta.avatar || '👤';
      let livePhone: string | undefined;

      try {
        const { data: liveProfile } = await supabase
          .from('profiles')
          .select('full_name, email, avatar, avatar_url, phone_number')
          .eq('id', user.id)
          .maybeSingle();

        if (liveProfile) {
          liveFullName = liveProfile.full_name || fullName;
          liveEmail = liveProfile.email || userEmail;
          liveAvatar =
            liveProfile.avatar ||
            liveProfile.avatar_url ||
            liveAvatar;
          livePhone = liveProfile.phone_number || undefined;
        }
      } catch (e) {
        if (__DEV__) console.warn('[Auth] Live profile fetch failed:', e);
      }

      const baseName = liveFullName || liveEmail.split('@')[0];
      const baseHandle = `@${baseName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

      const userProfile: UserProfile = {
        id: user.id,
        fullName: liveFullName,
        email: liveEmail,
        phoneNumber: livePhone,
        avatar: liveAvatar,
        role: (userMeta.role as 'parent1' | 'parent2' | 'guardian') || 'parent1',
        createdAt: user.created_at || new Date().toISOString(),
        preferences: { notifications: true, darkMode: false, language: 'en' },
        communityUsername: commUsername || baseName,
        communityHandle: commHandle || baseHandle,
        communityBio: commBio || '',
        communityAvatar: commAvatar || liveAvatar,
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
      if (__DEV__) console.error('[Auth] Sign in error:', error);
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
      if (__DEV__) console.log('[Auth] SignUp attempt for:', email);

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
          if (__DEV__) console.log('[Auth] User exists, attempting sign in...');
          const result = await performSignInInternal(email.trim(), password, false);
          return result;
        }

        return { success: false, message: signUpError?.message || 'Could not create account' };
      }

      if (__DEV__) console.log('[Auth] User created successfully:', signUpData.user.id);
      const token = signUpData.session?.access_token || '';
      const userId = signUpData.user.id;

      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshSession();

      try {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
        });
        if (!resendError && __DEV__) {
          console.log('[Auth] Confirmation email sent');
        }
      } catch (resendErr) {
        if (__DEV__) console.warn('[Auth] Could not send confirmation:', resendErr);
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
      if (__DEV__) console.error('[Auth] Sign up error:', error);
      return { success: false, message: 'Failed to create account. Please try again.' };
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock, performSignInInternal, refreshSession]);

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
        if (__DEV__) console.error('[Auth] Social sign in failed:', authError.message);
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
      if (__DEV__) console.error('Social sign in error:', error);
      return { success: false, message: 'Social authentication failed' };
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock]);

  // ─── SIGN OUT ──────────────────────────────────────────────────────────

  const signOut = useCallback(async (): Promise<void> => {
    if (signInLock.current) await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      if (__DEV__) console.log('[Auth] Starting sign out process...');

      // Clear navigation lock
      await AsyncStorage.setItem('littleloom_security_lock', 'false');

      // ─── Sign out LOCALLY only — do NOT revoke the server token ──
      // `scope: 'local'` clears the session from this device's storage
      // WITHOUT invalidating the refresh_token server-side.
      //
      // Why this matters: the previous default (`scope: 'global'`)
      // revoked the refresh_token on every signOut call. Our
      // `validateCurrentSession()` and periodic 5-minute check can
      // legitimately fail to reach Supabase (network hiccup, cold
      // start), and each of those failures used to trigger a global
      // signOut — which then made the user's NEXT login attempt fail
      // with "Invalid login credentials" because the server had
      // already revoked the token.
      //
      // Local-only cleanup preserves the user's ability to sign back
      // in immediately, and matches how Supabase's own docs recommend
      // handling signOut in mobile apps.
      await supabase.auth.signOut({ scope: 'local' });

      // Clear all secure storage
      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
        secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
        secureStorage.deleteItem(SECURE_KEYS.SOCIAL_PROVIDER),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);

      // Clear all AsyncStorage auth-related keys
      await AsyncStorage.multiRemove([
        ASYNC_KEYS.ONBOARDING_COMPLETE,
        ASYNC_KEYS.NAVIGATION_LOCK,
        'littleloom_security_lock',
        'littleloom_last_auth_state',
        'littleloom_nav_state_v4',
        '@littleloom_nav_state_v4',
        'littleloom_last_active_global',
        '@littleloom_cached_baby',
        '@littleloom_cached_activities_v2',
        '@littleloom_smart_notifications',
        '@littleloom_bayes_backfilled_v1',
      ]);

      // Clear user ID cache
      clearUserIdCache();

      // Reset state to unauthenticated - COMPLETE RESET
      if (isMounted.current) {
        setState({
          isLoading: false,
          isAuthenticated: false,
          userToken: null,
          userProfile: null,
          session: null,
          onboardingComplete: false,
          hasSeenOnboarding: false,
          isBiometricAvailable: stateRef.current.isBiometricAvailable,
          isBiometricEnabled: false,
          isBiometricLoginEnabled: false,
          setupComplete: false,
          hasParent2: false,
          hasBaby: false,
          availableBiometricTypes: stateRef.current.availableBiometricTypes,
          biometricTypeName: stateRef.current.biometricTypeName,
        });
      }

      if (__DEV__) console.log('[Auth] Sign out completed successfully - user is now logged out');
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign out error:', error);

      // Even if there's an error, try to reset the auth state
      if (isMounted.current) {
        setState({
          isLoading: false,
          isAuthenticated: false,
          userToken: null,
          userProfile: null,
          session: null,
          onboardingComplete: false,
          hasSeenOnboarding: false,
          isBiometricAvailable: stateRef.current.isBiometricAvailable,
          isBiometricEnabled: false,
          isBiometricLoginEnabled: false,
          setupComplete: false,
          hasParent2: false,
          hasBaby: false,
          availableBiometricTypes: stateRef.current.availableBiometricTypes,
          biometricTypeName: stateRef.current.biometricTypeName,
        });
      }
    }
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
      if (__DEV__) console.error('Biometric availability check failed:', error);
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
      if (__DEV__) console.error('Biometric authentication error:', error);
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
      if (__DEV__) console.error('Enable biometric error:', error);
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
      if (__DEV__) console.error('Enable biometric login error:', error);
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
      if (__DEV__) console.error('Disable biometric login error:', error);
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
      if (__DEV__) console.error('Biometric login error:', error);
      return { success: false, message: 'Biometric login failed' };
    } finally {
      releaseBiometricLock();
    }
  }, [acquireBiometricLock, releaseBiometricLock, checkBiometricAvailability, hasBiometricLoginCredentials, authenticateWithBiometric, performSignInInternal]);

  // ─── USER PROFILE FUNCTIONS ───────────────────────────────────────────

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    const currentProfile = stateRef.current.userProfile;
    if (!currentProfile) return false;

    try {
      const updatedProfile = { ...currentProfile, ...updates };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));

      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }

      return true;
    } catch (error) {
      if (__DEV__) console.error('Update user profile error:', error);
      return false;
    }
  }, []);

  const updateUserPreferences = useCallback(async (prefs: Partial<UserProfile['preferences']>): Promise<boolean> => {
    const currentProfile = stateRef.current.userProfile;
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
      if (__DEV__) console.error('Update preferences error:', error);
      return false;
    }
  }, []);

  const getCurrentUserProfile = useCallback((): UserProfile | null => {
    return stateRef.current.userProfile;
  }, []);

  // ─── COMMUNITY PROFILE FUNCTIONS ──────────────────────────────────────

  const updateCommunityProfile = useCallback(async (updates: { username?: string; handle?: string; bio?: string; avatar?: string; displayName?: string }): Promise<boolean> => {
    const currentProfile = stateRef.current.userProfile;
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
      if (__DEV__) console.error('Update community profile error:', error);
      return false;
    }
  }, []);

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
      if (__DEV__) console.error('Get community profile error:', error);
      return null;
    }
  }, []);

  const updateCommunityStats = useCallback(async (stats: Partial<UserProfile['communityStats']>): Promise<boolean> => {
    const currentProfile = stateRef.current.userProfile;
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
      if (__DEV__) console.error('Update community stats error:', error);
      return false;
    }
  }, []);

  const updateCommunityTopics = useCallback(async (topics: string[]): Promise<boolean> => {
    const currentProfile = stateRef.current.userProfile;
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
      if (__DEV__) console.error('Update community topics error:', error);
      return false;
    }
  }, []);

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

      const registryJson = await AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME);
      const existingUsernames = registryJson ? [registryJson] : [];

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
      if (__DEV__) console.error('Check username availability error:', error);
      return { available: false, message: 'Failed to check username availability' };
    }
  }, []);

  const registerCommunityUsername = useCallback(async (username: string): Promise<boolean> => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    const availability = await isUsernameAvailable(trimmed);
    if (!availability.available) return false;

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
      if (__DEV__) console.error(`Skip ${step} error:`, error);
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
      if (__DEV__) console.error(`Complete ${step} error:`, error);
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
      if (__DEV__) console.error('Reset setup flow error:', error);
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
      if (__DEV__) console.error('Mark onboarding seen error:', error);
    }
  }, []);

  const shouldShowBiometricPrompt = useCallback(async (): Promise<boolean> => {
    try {
      const [biometricEnabled, hasCredentials] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
        hasBiometricLoginCredentials(),
      ]);

      if (stateRef.current.isBiometricAvailable && biometricEnabled !== 'true') {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }, [hasBiometricLoginCredentials]);

  // ─── UTILITY FUNCTIONS ────────────────────────────────────────────────

  const isAppActive = useCallback((): boolean => {
    return appStateRef.current === 'active';
  }, []);

  const getLastActiveTime = useCallback((): number => {
    return lastActiveTimeRef.current;
  }, []);

  const getBiometricTypeInfo = useCallback((): { type: string; icon: string } => {
    const types = stateRef.current.availableBiometricTypes;
    return {
      type: getBiometricTypeName(types),
      icon: getBiometricIcon(types),
    };
  }, []);

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
    const email = stateRef.current.userProfile?.email;
    if (!email) return false;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return !error;
    } catch {
      return false;
    }
  }, []);

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
    try {
      const trimmedCode = code.trim().toUpperCase();

      // ─── 1. Validate the invite code from the database ──────────────
      const { data: inviteData, error: inviteError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', trimmedCode)
        .eq('used', false)
        .eq('revoked', false)
        .maybeSingle();

      if (inviteError) {
        if (__DEV__) console.error('[Auth] Invite code validation error:', inviteError);
        return { success: false, message: 'Error validating invite code' };
      }

      if (!inviteData) {
        // ─── Check if this is a partial signup ──────────────────────────
        const { data: partialData, error: partialError } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', trimmedCode)
          .eq('used', true)
          .eq('signup_completed', false)
          .eq('revoked', false)
          .maybeSingle();

        if (!partialError && partialData) {
          if (__DEV__) console.log('[Auth] Continuing partial signup for code:', trimmedCode);
          // Proceed with signup but don't mark as used again
        } else {
          return { success: false, message: 'Invalid or expired invite code' };
        }
      }

      // ─── 2. Check if expired ─────────────────────────────────────────
      const now = Date.now();
      const expiresAt = (inviteData?.created_at || 0) + (inviteData?.expires_in_days || 7) * 24 * 60 * 60 * 1000;
      if (inviteData && now > expiresAt) {
        return { success: false, message: 'Invite code has expired' };
      }

      // ─── 3. Check if user already exists ─────────────────────────────
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        return { success: false, message: 'An account with this email already exists. Please sign in instead.' };
      }

      // ─── 4. Proceed with signup ──────────────────────────────────────
      const signUpResult = await signUp(fullName, email, password);

      if (!signUpResult.success) {
        return { success: false, message: signUpResult.message || 'Signup failed' };
      }

      // ─── 5. Get the newly created user ──────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // ─── 6. Mark the invite code as used ──────────────────────────
        if (inviteData) {
          const { error: updateError } = await supabase
            .from('invite_codes')
            .update({
              used: true,
              used_by: user.id,
              used_at: Date.now(),
              used_by_email: email.trim().toLowerCase(),
              used_by_name: fullName.trim(),
              signup_completed: true,
              updated_at: Date.now(),
            })
            .eq('code', trimmedCode);

          if (updateError) {
            if (__DEV__) console.error('[Auth] Failed to mark invite code as used:', updateError);
          }
        } else {
          const { error: updateError } = await supabase
            .from('invite_codes')
            .update({
              signup_completed: true,
              used_by: user.id,
              used_by_email: email.trim().toLowerCase(),
              used_by_name: fullName.trim(),
              updated_at: Date.now(),
            })
            .eq('code', trimmedCode);

          if (updateError) {
            if (__DEV__) console.error('[Auth] Failed to complete partial signup:', updateError);
          }
        }

        // ─── 7. Create family member entry ─────────────────────────────
        const familyMemberId = `fm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        try {
          const role = inviteData?.role || 'viewer';
          const relationship = inviteData?.relationship || 'Family Member';
          const creatorId = inviteData?.creator_id || user.id;
          const babyId = inviteData?.family_id;

          if (!babyId) {
            if (__DEV__) console.error('[Auth] No family_id in invite data');
            return {
              success: true,
              message: 'Account created but no family found. Please contact support.'
            };
          }

          const familyMemberData = {
            id: familyMemberId,
            baby_id: babyId,
            user_id: user.id,
            email: email.trim().toLowerCase(),
            full_name: fullName.trim(),
            role: role,
            relationship: relationship,
            permissions: {},
            added_at: new Date().toISOString(),
            added_by: creatorId,
            can_be_removed: true,
            notifications_enabled: true,
            status: 'active',
            updated_at: new Date().toISOString(),
            is_deleted: false,
          };

          if (__DEV__) console.log('[Auth] Creating family member:', JSON.stringify(familyMemberData, null, 2));

          const { error: familyError } = await supabase
            .from('family_members')
            .insert(familyMemberData);

          if (familyError) {
            if (__DEV__) console.error('[Auth] Failed to create family member:', familyError);

            try {
              const minimalData = {
                id: familyMemberId,
                baby_id: babyId,
                user_id: user.id,
                email: email.trim().toLowerCase(),
                full_name: fullName.trim(),
                role: role,
                relationship: relationship,
                permissions: {},
                added_at: new Date().toISOString(),
                added_by: creatorId,
                can_be_removed: true,
                notifications_enabled: true,
                status: 'active',
                updated_at: new Date().toISOString(),
              };

              const { error: retryError } = await supabase
                .from('family_members')
                .insert(minimalData);

              if (retryError) {
                if (__DEV__) console.error('[Auth] Failed to create family member (retry):', retryError);
              }
            } catch (retryErr) {
              if (__DEV__) console.error('[Auth] Family member retry failed:', retryErr);
            }
          } else {
            if (__DEV__) console.log('[Auth] Family member created successfully:', familyMemberId);
          }

          // ─── 8. If role is parent2, update baby's parent2_id ──────────
          if (role === 'parent2') {
            try {
              const { error: updateBabyError } = await supabase
                .from('babies')
                .update({
                  parent2_id: user.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', babyId);

              if (updateBabyError) {
                if (__DEV__) console.error('[Auth] Failed to update parent2:', updateBabyError);
              }
            } catch (updateParent2Error) {
              if (__DEV__) console.error('[Auth] Parent2 update error:', updateParent2Error);
            }
          }
        } catch (familyInsertError) {
          if (__DEV__) console.error('[Auth] Family member insertion error:', familyInsertError);
        }
      }

      const roleDisplay = inviteData?.role === 'parent2' ? 'Parent 2'
        : inviteData?.role === 'guardian' ? 'Guardian'
        : 'Viewer';

      return {
        success: true,
        message: `Welcome to the family! You've joined as ${roleDisplay}`
      };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign up with invite code error:', error);
      return { success: false, message: 'Failed to join family. Please try again.' };
    }
  }, [signUp]);

  // ─── FIND USER FUNCTIONS ──────────────────────────────────────────────

  const findUserByEmail = useCallback(async (email: string): Promise<{ userId: string; email: string; fullName: string; role: string } | null> => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (!profileError && profileData) {
        return {
          userId: profileData.id,
          email: profileData.email,
          fullName: profileData.full_name,
          role: profileData.role || 'parent1',
        };
      }

      return null;
    } catch (error) {
      if (__DEV__) console.error('Find user by email error:', error);
      return null;
    }
  }, []);

  const findUserByEmailOrUsername = useCallback(async (identifier: string): Promise<{ userId: string; email: string; fullName: string; role: string } | null> => {
    if (identifier.includes('@')) {
      return await findUserByEmail(identifier);
    }
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

        if (sessionError && __DEV__) {
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
        let effectiveSession = session;

        if (session && token) {
          // ─── Trust the cached session first ─────────────────────
          isValidSession = true;
          if (userProfileStr) {
            try { userProfile = JSON.parse(userProfileStr); } catch {}
          }

          // Optional background verify
          supabase.auth.getUser().then(({ data, error }) => {
            if (error && /jwt|invalid|expired/i.test(error.message)) {
              if (__DEV__) console.warn('[Auth] Token rejected by server:', error.message);
              Promise.all([
                secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
                secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
              ]).then(() => clearUserIdCache());
            }
          }).catch(() => {});
        } else if (token && !session) {
          // ─── FIX: Token exists but session is null ──────────────
          // This happens when Supabase's internal getSession() fails
          // on cold start but our stored token is still valid.
          // We try to recover the session from AsyncStorage.
          try {
            const keys = await AsyncStorage.getAllKeys();
            const authKey = keys.find(
              k => k.includes('auth-token') || k.includes('supabase.auth')
            );
            if (authKey) {
              const stored = await AsyncStorage.getItem(authKey);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.access_token && parsed?.refresh_token) {
                  const { data: setData, error: setError } = await supabase.auth.setSession({
                    access_token: parsed.access_token,
                    refresh_token: parsed.refresh_token,
                  });
                  if (!setError && setData.session) {
                    if (__DEV__) console.log('[Auth] ✅ Recovered session from storage');
                    effectiveSession = setData.session;
                    isValidSession = true;
                    if (userProfileStr) {
                      try { userProfile = JSON.parse(userProfileStr); } catch {}
                    }
                  }
                }
              }
            }
          } catch (recoverErr) {
            if (__DEV__) console.warn('[Auth] Session recovery failed:', recoverErr);
          }
        }

        if (userProfile && isValidSession) {
          // ─── FIX: Refresh live name/email/avatar from Supabase ─────
          // The cached profile may have the fallback "Parent" name.
          // Always pull the authoritative values from the profiles table.
          try {
            const liveUserId =
              userProfile.id ||
              effectiveSession?.user?.id;

            if (liveUserId) {
              const { data: liveProfile } = await supabase
                .from('profiles')
                .select('full_name, email, avatar, avatar_url, phone_number')
                .eq('id', liveUserId)
                .maybeSingle();

              if (liveProfile) {
                userProfile = {
                  ...userProfile,
                  fullName: liveProfile.full_name || userProfile.fullName || 'Parent',
                  email: liveProfile.email || userProfile.email || '',
                  avatar:
                    liveProfile.avatar ||
                    liveProfile.avatar_url ||
                    userProfile.avatar ||
                    '👤',
                  phoneNumber: liveProfile.phone_number || userProfile.phoneNumber,
                };
              }
            }
          } catch (e) {
            if (__DEV__) console.warn('[Auth] Live profile fetch failed:', e);
          }

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

          // Persist the enriched profile so subsequent boots are fast
          try {
            await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
          } catch {}
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
            session: effectiveSession || null,
          });
        }
        initComplete.current = true;
      } catch (error) {
        if (__DEV__) console.error('Auth init failed:', error);
        if (isMounted.current) setState(prev => ({ ...prev, isLoading: false }));
        initComplete.current = true;
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (__DEV__) console.log('[Auth] Auth state change:', event);

      if (event === 'SIGNED_IN' && session) {
        const user = session.user;
        const userMeta = user.user_metadata || {};

        // ─── FIX: Don't overwrite the cached profile with a
        //     fallback-only stub. Only update the session here; the
        //     profile is authored by performSignInInternal and/or
        //     initAuth, which both read the live profiles row.
        const existingProfile = stateRef.current.userProfile;
        const sameUser = existingProfile?.id === user.id;

        const userProfile: UserProfile = sameUser && existingProfile
          ? existingProfile
          : {
              id: user.id,
              fullName:
                userMeta.full_name ||
                userMeta.fullName ||
                user.email?.split('@')[0] ||
                'User',
              email: user.email || '',
              avatar: userMeta.avatar || '👤',
              role:
                (userMeta.role as 'parent1' | 'parent2' | 'guardian') ||
                'parent1',
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
        if (__DEV__) console.log('[Auth] SIGNED_OUT event received, clearing state');
        clearUserIdCache();
        if (isMounted.current) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            userToken: null,
            userProfile: null,
            session: null,
            onboardingComplete: false,
            hasSeenOnboarding: false,
            isBiometricAvailable: stateRef.current.isBiometricAvailable,
            isBiometricEnabled: false,
            isBiometricLoginEnabled: false,
            setupComplete: false,
            hasParent2: false,
            hasBaby: false,
            availableBiometricTypes: stateRef.current.availableBiometricTypes,
            biometricTypeName: stateRef.current.biometricTypeName,
          });
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
            // ─── Double-confirm before hard signOut ────────────────
            // A single failed validation could be a network blip.
            // Ask once more after a short delay; only sign out if
            // the session is confirmed dead on both attempts.
            await new Promise((r) => setTimeout(r, 1500));
            const { data: { session } } = await supabase.auth.getSession();
            if (!session && isMounted.current) {
              if (__DEV__) console.log('[Auth] Session confirmed dead — signing out');
              await signOut();
            } else if (isMounted.current && __DEV__) {
              console.log('[Auth] Session recovered — skipping signOut');
            }
          }
        } catch (error) {
          if (__DEV__) console.warn('[Auth] Periodic session check error:', error);
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