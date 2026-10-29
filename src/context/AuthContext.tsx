import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { SocialUser } from '../hooks/useSocialAuth';
import { supabase } from '@/utils/supabase';
import { Session, User } from '@supabase/supabase-js';
import { clearUserIdCache } from '@/database/dbHelpers';

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
  RECENT_PW_HASHES: 'littleloom_recent_pw_hashes',
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

export interface UserLookupResult {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType extends AuthState {
  signIn: (identifier: string, password: string) => Promise<{ success: boolean; message?: string }>;
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
  resetPasswordWithPin: (
    email: string,
    pin: string,
    newPassword: string
  ) => Promise<{ success: boolean; message: string }>;
  findUserByEmail: (email: string) => Promise<UserLookupResult | null>;
  findUserByEmailOrUsername: (identifier: string) => Promise<UserLookupResult | null>;
  findUserByEmailOrUsernameOrPhone: (identifier: string) => Promise<UserLookupResult | null>;
  checkSession: () => Promise<boolean>;
  forceLogoutOnInvalidSession: () => Promise<boolean>;
  verifyPassword: (password: string) => Promise<boolean>;
  deleteAccount: (password: string) => Promise<{ success: boolean; message: string }>;
  deleteAccountWithConfirmation: () => Promise<{ success: boolean; message: string }>;
  refreshSession: () => Promise<boolean>;
  /** Fan out a profile change to every context + every signed-in device. */
  broadcastProfileChange: (
    fields: Array<'fullName' | 'avatar' | 'bio' | 'handle' | 'displayName' | 'coverPhoto' | 'phone' | 'email'>,
  ) => Promise<void>;
  /** Subscribe to profile-change events. Returns unsubscribe. */
  subscribeToProfileChanges: (listener: ProfileChangeListener) => () => void;
}

// SecureStore rejects keys containing characters outside [A-Za-z0-9._-].
// Strip a leading "@" and any other illegal chars so callers can't blow up
// LogBox if they pass the wrong thing. Non-conforming keys are logged once.
const SECURE_KEY_RE = /^[A-Za-z0-9._-]+$/;
const warnBadKey = (op: string, key: string) => {
  if (__DEV__) {
    console.warn(
      `[secureStorage:${op}] Invalid SecureStore key "${key}". ` +
        `Keys may only contain A-Z, a-z, 0-9, ".", "-", "_" — call ignored.`,
    );
  }
};

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!key || !SECURE_KEY_RE.test(key)) {
      warnBadKey('getItem', key);
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStore get error for ${key}:`, error);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<boolean> {
    if (!key || !SECURE_KEY_RE.test(key)) {
      warnBadKey('setItem', key);
      return false;
    }
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
    if (!key || !SECURE_KEY_RE.test(key)) {
      warnBadKey('deleteItem', key);
      return false;
    }
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error(`SecureStore delete error for ${key}:`, error);
      return false;
    }
  },
};

// Platform-aware: Android over-reports FACIAL_RECOGNITION. Prefer fingerprint
// when both are supported, matching SecurityContext.resolveEnrolledBiometricType.
const getBiometricTypeName = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (!types || types.length === 0) return 'Biometric';
  const preferFingerprint = Platform.OS === 'android';
  if (preferFingerprint && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris Scan';
  return 'Biometric';
};

const getBiometricIcon = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (!types || types.length === 0) return 'finger-print';
  const preferFingerprint = Platform.OS === 'android';
  if (preferFingerprint && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'finger-print';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'scan-outline';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'finger-print';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'eye-outline';
  return 'finger-print';
};

const hashPinForRecovery = async (pin: string): Promise<string> => {
  const Crypto = require('expo-crypto');
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + 'littleloom_salt_v1'
  );
};

const AuthContext = createContext<AuthContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────
// Cross-context profile-change bus
// ─────────────────────────────────────────────────────────────────────
// Any code that mutates the `profiles` table (or the in-memory profile
// in AuthContext/UserContext) should call this so every listener
// re-hydrates. It does three things:
//   1) Fires a synchronous in-memory event to all local subscribers.
//   2) Broadcasts on the `littleloom-profile-changes` Supabase channel
//      so OTHER devices signed into the same account update live.
//   3) Optionally persists a `profile_change_ts` in AsyncStorage so
//      listeners can invalidate stale caches on next mount.
//
// `userId` is required — this is a per-account event, not global.
// ─────────────────────────────────────────────────────────────────────
type ProfileChangePayload = {
  userId: string;
  fields: Array<'fullName' | 'avatar' | 'bio' | 'handle' | 'displayName' | 'coverPhoto' | 'phone' | 'email'>;
  at: number;
};

type ProfileChangeListener = (payload: ProfileChangePayload) => void;
const _profileChangeListeners = new Set<ProfileChangeListener>();
let _profileChannel: any = null;

const getProfileChangeChannel = () => {
  if (_profileChannel) return _profileChannel;
  try {
    _profileChannel = supabase.channel('littleloom-profile-changes', {
      config: { broadcast: { self: false } },
    });
    _profileChannel.on(
      'broadcast',
      { event: 'profile-changed' },
      (msg: { payload?: ProfileChangePayload }) => {
        const p = msg?.payload;
        if (!p?.userId) return;
        _profileChangeListeners.forEach((fn) => {
          try { fn(p); } catch {}
        });
      },
    );
    _profileChannel.subscribe();
  } catch {}
  return _profileChannel;
};

export const subscribeToProfileChanges = (
  listener: ProfileChangeListener,
): (() => void) => {
  _profileChangeListeners.add(listener);
  getProfileChangeChannel();
  return () => { _profileChangeListeners.delete(listener); };
};

export const broadcastProfileChange = async (
  payload: Omit<ProfileChangePayload, 'at'>,
): Promise<void> => {
  const full: ProfileChangePayload = { ...payload, at: Date.now() };
  // Fire local listeners synchronously first (zero-latency UX).
  _profileChangeListeners.forEach((fn) => {
    try { fn(full); } catch {}
  });
  // Then broadcast cross-device.
  try {
    const ch = getProfileChangeChannel();
    await ch?.send?.({
      type: 'broadcast',
      event: 'profile-changed',
      payload: full,
    });
  } catch {}
  // Record the timestamp so caches can invalidate.
  try {
    await AsyncStorage.setItem(
      `littleloom_profile_change_ts_${payload.userId}`,
      String(full.at),
    );
  } catch {}
};

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

  // ═══════════════════════════════════════════════════════════════════════
  // IDENTIFIER RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════

  const findUserByEmail = useCallback(async (email: string): Promise<UserLookupResult | null> => {
    if (!email?.trim()) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (!error && data?.email) {
        return {
          userId: data.id,
          email: data.email,
          fullName: data.full_name,
          role: data.role || 'parent1',
        };
      }
      return null;
    } catch (error) {
      if (__DEV__) console.error('Find user by email error:', error);
      return null;
    }
  }, []);

  const findUserByEmailOrUsername = useCallback(async (
    identifier: string
  ): Promise<UserLookupResult | null> => {
    const raw = (identifier || '').trim();
    if (!raw) return null;

    if (raw.includes('@') && raw.includes('.')) {
      return await findUserByEmail(raw);
    }

    const normalized = raw.toLowerCase();
    const handleWithAt = normalized.startsWith('@') ? normalized : `@${normalized}`;
    const handleBare = normalized.replace(/^@/, '');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .or(
          `community_handle.eq.${handleWithAt},community_username.eq.${handleBare},username.eq.${handleBare}`
        )
        .maybeSingle();

      if (!error && data?.email) {
        return {
          userId: data.id,
          email: data.email,
          fullName: data.full_name,
          role: data.role || 'parent1',
        };
      }
    } catch (e) {
      if (__DEV__) console.warn('[Auth] username lookup failed:', e);
    }

    return await findUserByEmail(raw);
  }, [findUserByEmail]);

  const findUserByEmailOrUsernameOrPhone = useCallback(async (
    identifier: string
  ): Promise<UserLookupResult | null> => {
    const raw = (identifier || '').trim();
    if (!raw) return null;

    const phoneLike = /^[\+\d][\d\s\-\(\)]{5,}$/.test(raw);
    if (phoneLike) {
      const digits = raw.replace(/[^\d]/g, '');
      if (digits.length >= 7) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, phone_number')
            .not('phone_number', 'is', null)
            .ilike('phone_number', `%${digits.slice(-7)}%`)
            .limit(5);

          if (!error && data && data.length === 1 && data[0].email) {
            return {
              userId: data[0].id,
              email: data[0].email,
              fullName: data[0].full_name,
              role: data[0].role || 'parent1',
            };
          }
        } catch (e) {
          if (__DEV__) console.warn('[Auth] phone lookup failed:', e);
        }
      }
    }

    return await findUserByEmailOrUsername(raw);
  }, [findUserByEmailOrUsername]);

  // ═══════════════════════════════════════════════════════════════════════
  // SESSION REFRESH / VALIDATION
  // ═══════════════════════════════════════════════════════════════════════

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
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

  const validateCurrentSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        if (__DEV__) {
          console.warn('[Auth] Session check failed (transient):', error.message);
        }
        return Boolean(isAuthenticatedRef.current);
      }

      if (!session) {
        await new Promise((r) => setTimeout(r, 400));
        const { data: { session: retry } } = await supabase.auth.getSession();

        if (retry?.user) {
          if (isMounted.current) {
            setState((prev) => ({ ...prev, session: retry }));
          }
          return true;
        }

        if (__DEV__) console.warn('[Auth] No session — clearing local state');
        await Promise.all([
          secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
          secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
          secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
          secureStorage.deleteItem(SECURE_KEYS.RECENT_PW_HASHES),
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

  // ═══════════════════════════════════════════════════════════════════════
  // SIGN IN
  // ═══════════════════════════════════════════════════════════════════════

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

        const msg = (authError?.message || '').toLowerCase();
        const isAuthFailure =
          msg.includes('invalid') ||
          msg.includes('credentials') ||
          msg.includes('not found') ||
          !authData?.user;

        if (isAuthFailure) {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
          try {
            await secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN);
            await secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE);
          } catch {}
          try { clearUserIdCache(); } catch {}
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
          } catch {}
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
          message: authError?.message || 'Unable to sign in. Please try again.',
        };
      }

      // Invalidate any stale/null cached user ID before we proceed.
      clearUserIdCache();

      const token = authData.session?.access_token || '';
      const user = authData.user;

      const userEmail = user.email || email.trim();
      const userMeta = user.user_metadata || {};
      const fullName = userMeta.full_name || userMeta.fullName || userEmail.split('@')[0];

      const [commUsername, commHandle, commBio, commAvatar, commDisplayName, commStats, commTopics] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_USERNAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_HANDLE),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_BIO),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_AVATAR),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_STATS),
        AsyncStorage.getItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS),
      ]);

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
          liveAvatar = liveProfile.avatar || liveProfile.avatar_url || liveAvatar;
          livePhone = liveProfile.phone_number || undefined;
        }
      } catch (e) {
        if (__DEV__) console.warn('[Auth] Live profile fetch failed:', e);
      }

      const baseName = liveFullName || liveEmail.split('@')[0];
      const baseHandle = `@${baseName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

      try {
        const { data: handleRow } = await supabase
          .from('profiles')
          .select('community_handle, community_username')
          .eq('id', user.id)
          .maybeSingle();

        const hasHandle =
          !!(handleRow?.community_handle || '').toString().trim() ||
          !!(handleRow?.community_username || '').toString().trim();

        if (!hasHandle) {
          let candidate = baseHandle.replace(/^@+/, '');
          let handleTaken = false;
          for (let i = 0; i < 5; i++) {
            const suffix = i === 0 ? '' : String(Math.floor(Math.random() * 9000) + 1000);
            const tryHandle = i === 0 ? candidate : `${candidate}${suffix}`;
            const { data: existing } = await supabase
              .from('profiles')
              .select('id')
              .eq('community_handle', `@${tryHandle}`)
              .maybeSingle();

            if (!existing || existing.id === user.id) {
              candidate = tryHandle;
              handleTaken = false;
              break;
            }
            handleTaken = true;
          }
          if (!handleTaken) {
            await supabase
              .from('profiles')
              .update({
                community_handle: `@${candidate}`,
                community_username: candidate,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[Auth] Auto-seed username failed:', e);
      }

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

      const [bioEnabled, bioLoginEnabled] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);

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
          isBiometricEnabled: bioEnabled === 'true',
          isBiometricLoginEnabled: bioLoginEnabled === 'true',
        }));
      }
      return { success: true, user };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign in error:', error);
      return { success: false, message: 'An unexpected error occurred. Please try again.' };
    }
  }, []);

  const signIn = useCallback(async (identifier: string, password: string): Promise<{ success: boolean; message?: string }> => {
    if (!acquireSignInLock()) return { success: false, message: 'Another sign in operation in progress' };
    const now = Date.now();
    if (now - lastSignInTime.current < 1500) {
      await new Promise(resolve => setTimeout(resolve, 1500 - (now - lastSignInTime.current)));
    }
    try {
      const raw = (identifier || '').trim();

      let email = raw;
      const looksLikeEmail = raw.includes('@') && raw.includes('.');

      if (!looksLikeEmail) {
        const resolved = await findUserByEmailOrUsernameOrPhone(raw);
        if (!resolved?.email) {
          return {
            success: false,
            message: 'No account found for that email, username, or phone number.',
          };
        }
        email = resolved.email;
      }

      const result = await performSignInInternal(email, password, false);
      lastSignInTime.current = Date.now();
      return result;
    } finally { releaseSignInLock(); }
  }, [acquireSignInLock, releaseSignInLock, performSignInInternal, findUserByEmailOrUsernameOrPhone]);

  // ═══════════════════════════════════════════════════════════════════════
  // SIGN UP — FIXED: proper try/catch/finally structure
  // ═══════════════════════════════════════════════════════════════════════

  const signUp = useCallback(async (fullName: string, email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    if (!acquireSignInLock()) return { success: false, message: 'Another operation in progress' };
    if (signInLockTimer.current) clearTimeout(signInLockTimer.current);
    signInLockTimer.current = setTimeout(() => { signInLock.current = false; }, 30000);

    try {
      if (__DEV__) console.log('[Auth] SignUp attempt for:', email);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName } },
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

      if (!signUpData.session) {
        const userProfile: UserProfile = {
          id: userId,
          fullName,
          email: email.trim(),
          avatar: '👤',
          role: 'parent1',
          createdAt: new Date().toISOString(),
          preferences: { notifications: true, darkMode: false, language: 'en' },
          communityUsername: fullName,
          communityHandle: `@${fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`,
          communityBio: '',
          communityAvatar: '👤',
          communityDisplayName: fullName,
          communityStats: { posts: 0, followers: 0, following: 0, helpful: 0 },
          communitySelectedTopics: [],
        };
        try {
          await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
        } catch {}
        return {
          success: false,
          message:
            'Account created! Please check your email to confirm your address, then sign in.',
        };
      }

      await new Promise(resolve => setTimeout(resolve, 300));

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

      const tokenStored = await secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token);
      const profileStored = await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
      if (!tokenStored || !profileStored) {
        return {
          success: false,
          message:
            'Your account was created, but we could not save your session on this device. Please sign in.',
        };
      }

      await Promise.all([
        AsyncStorage.setItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING, 'true'),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_USERNAME, fullName),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_HANDLE, handle),
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME, fullName),
      ]).catch(() => {});

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
    } catch (error: any) {
      if (__DEV__) console.error('[Auth] Sign up error:', error);
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        return {
          success: false,
          message: 'An account with this email already exists. Please sign in.',
        };
      }
      return { success: false, message: 'Failed to create account. Please try again.' };
    } finally {
      releaseSignInLock();
    }
  }, [acquireSignInLock, releaseSignInLock, performSignInInternal]);

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

  // ═══════════════════════════════════════════════════════════════════════
  // SIGN OUT
  // ═══════════════════════════════════════════════════════════════════════

  const signOut = useCallback(async (): Promise<void> => {
    if (signInLock.current) await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      if (__DEV__) console.log('[Auth] Starting sign out process...');

      const signedOutUserId = stateRef.current.userProfile?.id;

      await AsyncStorage.setItem('littleloom_security_lock', 'false');
      await supabase.auth.signOut({ scope: 'local' });

      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
        secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
        secureStorage.deleteItem(SECURE_KEYS.SOCIAL_PROVIDER),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
        secureStorage.deleteItem(SECURE_KEYS.RECENT_PW_HASHES),
      ]);

      await AsyncStorage.multiRemove([
        ASYNC_KEYS.ONBOARDING_COMPLETE,
        ASYNC_KEYS.NAVIGATION_LOCK,
        'littleloom_security_lock',
        'littleloom_last_active',
        'littleloom_manual_lock_time',
        'littleloom_last_auth_state',
        'littleloom_nav_state_v4',
        '@littleloom_nav_state_v4',
        'littleloom_last_active_global',
        '@littleloom_cached_baby',
        '@littleloom_cached_activities_v2',
        '@littleloom_smart_notifications',
        '@littleloom_bayes_backfilled_v1',
      ]);

      if (signedOutUserId) {
        const keysToRemove = [
          '@community_posts_v2',
          '@community_likes_v2',
          '@community_bookmarks_v2',
          '@community_reposts_v2',
          '@community_notifications_v2',
          '@community_messages_v2',
          '@community_blocked_users_v2',
          '@community_user_stats_v2',
          '@community_selected_topics_v2',
          '@community_popular_posts_v2',
          '@community_trending_topics_v2',
          '@community_user_followers_v2',
          '@community_user_following_v2',
          '@community_user_profiles_v2',
          '@community_last_sync_v2',
          '@littleloom_achievements_unlocked_v2',
          '@littleloom_achievements_unlocked_at',
          '@littleloom_dismissed_reminders',
          '@littleloom_tracker_correlations',
          '@littleloom_has_skipped_baby',
          '@littleloom_current_baby_id',
          '@littleloom_babies_cache',
          '@littleloom_last_baby_sync',
          '@littleloom_baby_sync_version',
          '@littleloom_current_family_code',
          '@littleloom_typing_status',
          '@littleloom_favorites_',
          '@littleloom_imported_tracks',
          '@littleloom_sleep_timer',
          '@littleloom_dismissed_tracker_insights',
          '@littleloom_edit_history_v1',
          'littleloom_safety_data_v2',
          'littleloom_emergency_logs_v2',
          'littleloom_safety_streak_v2',
          'littleloom_doctor_reports_v2',
          'littleloom_community_profile',
          'littleloom_username_registry',
          'littleloom_profile_sync_queue',
          '@community_selected_topics_v2',
          '@community_selected_topics',       // UserContext's scoped key (no _v2)
          '@littleloom_community_onboarding_v3',
          '@user_location_cache',
        ];

        await AsyncStorage.multiRemove(
          keysToRemove.flatMap((k) => [k, `${k}_${signedOutUserId}`]),
        );
        // Explicitly nuke the location cache (it is global, not scoped).
        try { await AsyncStorage.removeItem('@user_location_cache'); } catch {}
      }

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

      if (__DEV__) console.log('[Auth] Sign out completed successfully - user is now logged out');
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign out error:', error);
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

  // ═══════════════════════════════════════════════════════════════════════
  // BIOMETRIC
  // ═══════════════════════════════════════════════════════════════════════

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
        } catch {}

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
    } catch {
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

      const storedIdentifier = await secureStorage.getItem(SECURE_KEYS.BIOMETRIC_EMAIL);
      const password = await secureStorage.getItem(SECURE_KEYS.BIOMETRIC_PASSWORD);

      if (!storedIdentifier || !password) {
        return { success: false, message: 'Missing biometric credentials' };
      }

      let email = storedIdentifier;
      if (!(storedIdentifier.includes('@') && storedIdentifier.includes('.'))) {
        const resolved = await findUserByEmailOrUsernameOrPhone(storedIdentifier);
        if (!resolved?.email) {
          return { success: false, message: 'Saved account no longer exists. Please sign in again.' };
        }
        email = resolved.email;
        try {
          await secureStorage.setItem(SECURE_KEYS.BIOMETRIC_EMAIL, email);
        } catch {}
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
  }, [acquireBiometricLock, releaseBiometricLock, checkBiometricAvailability, hasBiometricLoginCredentials, authenticateWithBiometric, performSignInInternal, findUserByEmailOrUsernameOrPhone]);

  // ═══════════════════════════════════════════════════════════════════════
  // PROFILE UPDATES
  // ═══════════════════════════════════════════════════════════════════════

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    const currentProfile = stateRef.current.userProfile;
    if (!currentProfile) return false;

    try {
      const updatedProfile = { ...currentProfile, ...updates };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));

      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }

      // Fan out so every other context (UserContext, CommunityContext,
      // FamilyContext, tracker screens, chat avatars) re-hydrates.
      const changed: Array<'fullName' | 'avatar' | 'bio' | 'handle' | 'displayName' | 'coverPhoto' | 'phone' | 'email'> = [];
      if (updates.fullName !== undefined) changed.push('fullName');
      if (updates.avatar !== undefined) changed.push('avatar');
      if (updates.communityBio !== undefined) changed.push('bio');
      if (updates.communityDisplayName !== undefined) changed.push('displayName');
      if (updates.communityHandle !== undefined) changed.push('handle');
      if (updates.phoneNumber !== undefined) changed.push('phone');
      if (updates.email !== undefined) changed.push('email');
      if (changed.length > 0) {
        await broadcastProfileChange({
          userId: currentProfile.id,
          fields: changed,
        });
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

      if (updates.username !== undefined) await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_USERNAME, updates.username);
      if (updates.handle !== undefined) await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_HANDLE, updates.handle);
      if (updates.bio !== undefined) await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_BIO, updates.bio);
      if (updates.avatar !== undefined) await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_AVATAR, updates.avatar);
      if (updates.displayName !== undefined) await AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_DISPLAY_NAME, updates.displayName);

      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updatedProfile }));
      }

      const changed: Array<'fullName' | 'avatar' | 'bio' | 'handle' | 'displayName' | 'coverPhoto' | 'phone' | 'email'> = [];
      if (updates.displayName !== undefined) changed.push('displayName');
      if (updates.avatar !== undefined) changed.push('avatar');
      if (updates.bio !== undefined) changed.push('bio');
      if (updates.handle !== undefined) changed.push('handle');
      if (changed.length > 0) {
        await broadcastProfileChange({
          userId: currentProfile.id,
          fields: changed,
        });
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

    const clean = Array.isArray(topics) ? topics.filter((x) => typeof x === 'string') : [];

    try {
      // 1. Update in-memory + SecureStore profile
      const updatedProfile = { ...currentProfile, communitySelectedTopics: clean };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));

      // 2. Write to ALL AsyncStorage keys the CommunityContext + Navigator read
      await Promise.all([
        AsyncStorage.setItem(ASYNC_KEYS.COMMUNITY_SELECTED_TOPICS, JSON.stringify(clean)),
        AsyncStorage.setItem(
          `@community_selected_topics_v2_${currentProfile.id}`,
          JSON.stringify(clean),
        ),
        AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(clean)),
      ]);

      // 3. Persist to the DB so cold starts hydrate correctly
      try {
        await supabase
          .from('profiles')
          .update({
            community_selected_topics: clean,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentProfile.id);
      } catch (dbErr) {
        if (__DEV__) console.warn('[Auth] DB topics write failed:', dbErr);
      }

      if (isMounted.current) {
        setState((prev) => ({ ...prev, userProfile: updatedProfile }));
      }
      return true;
    } catch (error) {
      if (__DEV__) console.error('Update community topics error:', error);
      return false;
    }
  }, []);

  const isUsernameAvailable = useCallback(async (username: string): Promise<{ available: boolean; message: string }> => {
    try {
      const trimmed = username.trim().toLowerCase().replace(/^@/, '');

      if (trimmed.length < 3) return { available: false, message: 'Username must be at least 3 characters' };

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

  const updateCommunityUsername = useCallback(async (newUsername: string): Promise<{ success: boolean; message: string }> => {
    const trimmed = newUsername.trim().toLowerCase().replace(/^@/, '');

    if (trimmed.length < 3) return { success: false, message: 'Username must be at least 3 characters' };
    if (trimmed.length > 30) return { success: false, message: 'Username must be less than 30 characters' };

    const validPattern = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
    if (!validPattern.test(trimmed)) {
      return { success: false, message: 'Must start with a letter. Only letters, numbers, underscores, and dots allowed.' };
    }

    const availability = await isUsernameAvailable(trimmed);
    if (!availability.available) return { success: false, message: availability.message };

    const success = await updateCommunityProfile({ username: trimmed, handle: `@${trimmed}` });
    return { success, message: success ? 'Username updated successfully' : 'Failed to update username' };
  }, [updateCommunityProfile]);

  const updateCommunityAvatar = useCallback(async (avatarUri: string): Promise<boolean> => {
    return await updateCommunityProfile({ avatar: avatarUri });
  }, [updateCommunityProfile]);

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

  // ═══════════════════════════════════════════════════════════════════════
  // SETUP FLOW
  // ═══════════════════════════════════════════════════════════════════════

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
          setState(prev => ({ ...prev, setupComplete: true, onboardingComplete: true }));
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
    } catch {
      return { hasParent2: false, hasBaby: false, setupComplete: false };
    }
  }, []);

  const setSetupCompleteCallback = useCallback((callback: (() => Promise<void>) | null) => {
    setupCompleteCallbackRef.current = callback;
  }, []);

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
      const [biometricEnabled] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
      ]);

      if (stateRef.current.isBiometricAvailable && biometricEnabled !== 'true') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const isAppActive = useCallback((): boolean => {
    return appStateRef.current === 'active';
  }, []);

  const getLastActiveTime = useCallback((): number => {
    return lastActiveTimeRef.current;
  }, []);

  const getBiometricTypeInfo = useCallback((): { type: string; icon: string } => {
    const types = stateRef.current.availableBiometricTypes;
    return { type: getBiometricTypeName(types), icon: getBiometricIcon(types) };
  }, []);

  const clearAllLocks = useCallback(() => {
    releaseSignInLock();
    releaseBiometricLock();
  }, [releaseSignInLock, releaseBiometricLock]);

  // ═══════════════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ═══════════════════════════════════════════════════════════════════════

  const forgotPassword = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const trimmed = email?.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { success: false, message: 'Please enter a valid email address' };
      }

      const user = await findUserByEmail(trimmed);
      if (!user) {
        return { success: true, message: 'If an account exists, a reset link was sent.' };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'littleloom://reset-password',
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Password reset email sent' };
    } catch (error) {
      if (__DEV__) console.error('[Auth] forgotPassword error:', error);
      return { success: false, message: 'Failed to send reset email' };
    }
  }, [findUserByEmail]);

  const resetPasswordForUser = useCallback(async (_email: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      if (!newPassword || newPassword.length < 8) {
        return { success: false, message: 'Password must be at least 8 characters' };
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Password updated successfully' };
    } catch {
      return { success: false, message: 'Failed to update password' };
    }
  }, []);

  const resetPasswordWithPin = useCallback(async (
    email: string,
    pin: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const trimmed = email?.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { success: false, message: 'Please enter a valid email address' };
      }
      if (!pin || pin.length < 4 || pin.length > 6) {
        return { success: false, message: 'Please enter your 4-6 digit PIN' };
      }
      if (!newPassword || newPassword.length < 8) {
        return { success: false, message: 'New password must be at least 8 characters' };
      }

      const user = await findUserByEmail(trimmed);
      if (!user) {
        return { success: false, message: 'No account found for this email address' };
      }

      // ── RECENT-PASSWORD BLOCKLIST ─────────────────────────────────
      // Refuse if the user is trying to reuse a password they changed
      // in the last 3 successful resets. Backed by SecureStore so it
      // survives app restarts but is wiped on signOut.
      try {
        const Crypto = require('expo-crypto');
        const newHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          newPassword + 'littleloom_pw_salt_v1',
        );
        const recentRaw = await secureStorage.getItem(SECURE_KEYS.RECENT_PW_HASHES);
        const recentHashes: string[] = recentRaw ? JSON.parse(recentRaw) : [];
        if (recentHashes.includes(newHash)) {
          return {
            success: false,
            message: "You can't reuse one of your last 3 passwords. Choose a new one.",
          };
        }
        // Save this password's hash AFTER a successful reset (below).
        (resetPasswordWithPin as any)._pendingHash = newHash;
      } catch {}

      const storedHash = await secureStorage.getItem(SECURE_KEYS.PIN_HASH);
      if (!storedHash) {
        return {
          success: false,
          message:
            'No PIN is set up on this device. Use the email recovery link instead.',
        };
      }

      const providedHash = await hashPinForRecovery(pin);
      if (providedHash !== storedHash) {
        return { success: false, message: 'Incorrect PIN. Please try again.' };
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          'reset-password-with-pin',
          {
            body: {
              email: trimmed,
              pinHash: providedHash,
              newPassword,
            },
          }
        );

        if (error) {
          if (__DEV__) console.warn('[Auth] resetPasswordWithPin function error:', error);

          // FunctionsHttpError hides the response body. Read it so the
          // real server message ("Incorrect PIN", "User not found",
          // "Password recently used", etc.) reaches the user.
          let serverMessage: string | null = null;
          try {
            const ctx: any = (error as any).context;
            if (ctx?.json) {
              const body = await ctx.json();
              serverMessage =
                (body && (body.message || body.error)) || null;
            } else if (ctx?.text) {
              const text = await ctx.text();
              if (text) {
                try {
                  const parsed = JSON.parse(text);
                  serverMessage = parsed?.message || parsed?.error || null;
                } catch {
                  serverMessage = text;
                }
              }
            } else if (typeof (error as any).message === 'string' && (error as any).message.length > 0) {
              // Some SDK versions put the body in `.message`.
              const m = (error as any).message as string;
              if (!m.toLowerCase().includes('non-2xx')) serverMessage = m;
            }
          } catch {
            /* body unreadable — fall through */
          }

          if (serverMessage) {
            return { success: false, message: serverMessage };
          }

          return {
            success: false,
            message:
              'Could not reach the recovery service. Please try again in a moment.',
          };
        }

        const payload = (data ?? {}) as { success?: boolean; message?: string };
        if (payload.success === true) {
          // Persist the new hash for the recent-passwords blocklist.
          try {
            const pendingHash = (resetPasswordWithPin as any)._pendingHash as string | undefined;
            if (pendingHash) {
              const recentRaw = await secureStorage.getItem(SECURE_KEYS.RECENT_PW_HASHES);
              const recentHashes: string[] = recentRaw ? JSON.parse(recentRaw) : [];
              const next = [pendingHash, ...recentHashes.filter((h) => h !== pendingHash)].slice(0, 3);
              await secureStorage.setItem(SECURE_KEYS.RECENT_PW_HASHES, JSON.stringify(next));
            }
          } catch {}
          return {
            success: true,
            message:
              payload.message ||
              'Password reset successfully. You can now sign in with your new password.',
          };
        }

        return {
          success: false,
          message: payload.message || 'Password reset failed. Please try again.',
        };
      } catch (err) {
        if (__DEV__) console.error('[Auth] resetPasswordWithPin invoke failed:', err);
        // Try to recover a message from the thrown value too.
        let msg: string | null = null;
        try {
          const anyErr: any = err;
          const ctx = anyErr?.context;
          if (ctx?.json) {
            const body = await ctx.json();
            msg = body?.message || body?.error || null;
          } else if (typeof anyErr?.message === 'string' && !anyErr.message.toLowerCase().includes('non-2xx')) {
            msg = anyErr.message;
          }
        } catch {}
        return {
          success: false,
          message: msg || 'Password reset failed. Please try again.',
        };
      }
    } catch (error) {
      if (__DEV__) console.error('[Auth] resetPasswordWithPin error:', error);
      return { success: false, message: 'Failed to reset password' };
    }
  }, [findUserByEmail]);

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    const email = stateRef.current.userProfile?.email;
    if (!email) return false;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return !error;
    } catch {
      return false;
    }
  }, []);

  const deleteAccount = useCallback(async (_password: string): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Account deletion requires additional verification. Please contact support.' };
  }, []);

  const deleteAccountWithConfirmation = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Account deletion requires additional verification. Please contact support.' };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // INVITE CODE SIGN UP
  // ═══════════════════════════════════════════════════════════════════════

  const signUpWithInviteCode = useCallback(async (
    code: string,
    fullName: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const trimmedCode = code.trim().toUpperCase();

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
        } else {
          return { success: false, message: 'Invalid or expired invite code' };
        }
      }

      const now = Date.now();
      const expiresAt = (inviteData?.created_at || 0) + (inviteData?.expires_in_days || 7) * 24 * 60 * 60 * 1000;
      if (inviteData && now > expiresAt) {
        return { success: false, message: 'Invite code has expired' };
      }

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        return { success: false, message: 'An account with this email already exists. Please sign in instead.' };
      }

      const signUpResult = await signUp(fullName, email, password);
      if (!signUpResult.success) {
        return { success: false, message: signUpResult.message || 'Signup failed' };
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        if (inviteData) {
          await supabase
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
        } else {
          await supabase
            .from('invite_codes')
            .update({
              signup_completed: true,
              used_by: user.id,
              used_by_email: email.trim().toLowerCase(),
              used_by_name: fullName.trim(),
              updated_at: Date.now(),
            })
            .eq('code', trimmedCode);
        }

        const familyMemberId = `fm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        try {
          const role = inviteData?.role || 'viewer';
          const relationship = inviteData?.relationship || 'Family Member';
          const creatorId = inviteData?.creator_id || user.id;
          const babyId = inviteData?.family_id;

          if (!babyId) {
            return {
              success: true,
              message: 'Account created but no family found. Please contact support.',
            };
          }

          const familyMemberData = {
            id: familyMemberId,
            baby_id: babyId,
            user_id: user.id,
            email: email.trim().toLowerCase(),
            full_name: fullName.trim(),
            role,
            relationship,
            permissions: {},
            added_at: new Date().toISOString(),
            added_by: creatorId,
            can_be_removed: true,
            notifications_enabled: true,
            status: 'active',
            updated_at: new Date().toISOString(),
            is_deleted: false,
          };

          const { error: familyError } = await supabase
            .from('family_members')
            .insert(familyMemberData);

          if (familyError) {
            if (__DEV__) console.error('[Auth] Failed to create family member:', familyError);
          }

          if (role === 'parent2') {
            try {
              await supabase
                .from('babies')
                .update({ parent2_id: user.id, updated_at: new Date().toISOString() })
                .eq('id', babyId);
            } catch {}
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
        message: `Welcome to the family! You've joined as ${roleDisplay}`,
      };
    } catch (error) {
      if (__DEV__) console.error('[Auth] Sign up with invite code error:', error);
      return { success: false, message: 'Failed to join family. Please try again.' };
    }
  }, [signUp]);

  const checkSession = useCallback(async (): Promise<boolean> => {
    return await validateCurrentSession();
  }, [validateCurrentSession]);

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION + AUTH LISTENER
  // ═══════════════════════════════════════════════════════════════════════

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
          isValidSession = true;
          if (userProfileStr) {
            try { userProfile = JSON.parse(userProfileStr); } catch {}
          }

          supabase.auth.getUser().then(({ error }) => {
            if (error && /jwt|invalid|expired/i.test(error.message)) {
              if (__DEV__) console.warn('[Auth] Token rejected by server:', error.message);
              Promise.all([
                secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
                secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
              ]).then(() => clearUserIdCache());
            }
          }).catch(() => {});
        } else if (token && !session) {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const authKey = keys.find(k => k.includes('auth-token') || k.includes('supabase.auth'));
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
          try {
            const liveUserId = userProfile.id || effectiveSession?.user?.id;
            if (liveUserId) {
              const { data: liveProfile } = await supabase
                .from('profiles')
                .select('full_name, email, avatar, avatar_url, phone_number, community_selected_topics')
                .eq('id', liveUserId)
                .maybeSingle();

              if (liveProfile) {
                userProfile = {
                  ...userProfile,
                  fullName: liveProfile.full_name || userProfile.fullName || 'Parent',
                  email: liveProfile.email || userProfile.email || '',
                  avatar: liveProfile.avatar || liveProfile.avatar_url || userProfile.avatar || '👤',
                  phoneNumber: liveProfile.phone_number || userProfile.phoneNumber,
                };

                // Hydrate topics from DB — the authoritative source.
                const dbTopics = Array.isArray(liveProfile.community_selected_topics)
                  ? (liveProfile.community_selected_topics as string[])
                  : [];
                if (dbTopics.length > 0) {
                  (userProfile as any).communitySelectedTopics = dbTopics;
                }
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

          // Merge topics: keep any DB value we just hydrated above; otherwise
          // fall back to AsyncStorage; otherwise to the existing in-memory list.
          const asyncTopics = commTopics ? JSON.parse(commTopics) : [];
          const existingTopics = Array.isArray(userProfile.communitySelectedTopics)
            ? userProfile.communitySelectedTopics
            : [];
          const mergedTopics =
            existingTopics.length > 0
              ? existingTopics
              : Array.isArray(asyncTopics) && asyncTopics.length > 0
                ? asyncTopics
                : [];

          userProfile = {
            ...userProfile,
            communityUsername: commUsername || baseName,
            communityHandle: commHandle || baseHandle,
            communityBio: commBio || '',
            communityAvatar: commAvatar || userProfile.avatar || '👤',
            communityDisplayName: commDisplayName || baseName,
            communityStats: commStats ? JSON.parse(commStats) : { posts: 0, followers: 0, following: 0, helpful: 0 },
            communitySelectedTopics: mergedTopics,
          };

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
        } catch { biometricAvailable = false; }

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
        // Clear any cached user ID (from a previous session or a
        // `null` cached during the sign-out window) so subsequent
        // dbHelpers.getCurrentUserId() calls resolve against the
        // *new* session immediately.
        clearUserIdCache();
        const user = session.user;
        const userMeta = user.user_metadata || {};

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
      } else if (event === 'PASSWORD_RECOVERY') {
        if (isMounted.current) {
          setState(prev => ({ ...prev, session }));
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        if (isMounted.current) {
          setState(prev => ({ ...prev, session }));
        }
      }
    });

    // ── Realtime `profiles` listener ───────────────────────────────
    // Any UPDATE to our own row (from this device, another device, or
    // a webhook) refreshes the in-memory userProfile and fans out to
    // every ProfileChange subscriber. This is what makes avatar / name
    // / bio changes reflect *instantly* across every screen.
    let profilesChannel: any = null;
    try {
      const meId = stateRef.current.userProfile?.id;
      profilesChannel = supabase
        .channel('auth-profiles-self')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
          },
          async (payload: any) => {
            const row = payload?.new;
            if (!row?.id) return;
            const current = stateRef.current.userProfile;
            if (!current || current.id !== row.id) return;

            const updated: UserProfile = {
              ...current,
              fullName: row.full_name || current.fullName,
              email: row.email || current.email,
              phoneNumber: row.phone_number || current.phoneNumber,
              avatar: row.community_avatar || row.avatar_url || row.avatar || current.avatar,
              communityAvatar: row.community_avatar || current.communityAvatar,
              communityDisplayName: row.community_display_name || current.communityDisplayName,
              communityBio: row.community_bio || current.communityBio,
              communityHandle: row.community_handle || current.communityHandle,
              communityUsername: row.community_username || current.communityUsername,
              isVerified: row.is_verified ?? (current as any).isVerified,
              communityStats: row.community_stats || current.communityStats,
              communitySelectedTopics:
                row.community_selected_topics || current.communitySelectedTopics,
            };

            await secureStorage.setItem(
              SECURE_KEYS.USER_PROFILE,
              JSON.stringify(updated),
            );

            if (isMounted.current) {
              setState((prev) => ({ ...prev, userProfile: updated }));
            }

            // Fan out to every context/screen.
            broadcastProfileChange({
              userId: row.id,
              fields: ['fullName', 'avatar', 'bio', 'handle', 'displayName', 'coverPhoto'],
            }).catch(() => {});
          },
        )
        .subscribe();
    } catch (err) {
      if (__DEV__) console.warn('[Auth] profiles realtime subscribe failed:', err);
    }

    return () => {
      authListener?.subscription.unsubscribe();
      try { if (profilesChannel) supabase.removeChannel(profilesChannel); } catch {}
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // PERIODIC SESSION CHECK
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (state.isAuthenticated) {
      intervalId = setInterval(async () => {
        try {
          const isValid = await validateCurrentSession();
          if (!isValid && isMounted.current) {
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

  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════

  const value = useMemo(() => ({
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
    resetPasswordWithPin,
    findUserByEmail,
    findUserByEmailOrUsername,
    findUserByEmailOrUsernameOrPhone,
    checkSession,
    forceLogoutOnInvalidSession,
    verifyPassword,
    deleteAccount,
    deleteAccountWithConfirmation,
    refreshSession,
    // Profile-change fan-out
    broadcastProfileChange: async (
      fields: ProfileChangePayload['fields'],
    ) => {
      const id = stateRef.current.userProfile?.id;
      if (!id) return;
      await broadcastProfileChange({ userId: id, fields });
    },
    subscribeToProfileChanges,
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
    resetPasswordWithPin,
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