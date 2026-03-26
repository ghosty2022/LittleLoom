import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

// ============================================
// SECURE STORAGE KEYS
// ============================================
const SECURE_KEYS = {
  AUTH_TOKEN: 'littleloom_auth_token',
  USER_PROFILE: 'littleloom_user_profile_secure',
  PIN_HASH: 'littleloom_pin_hash',
  BIOMETRIC_EMAIL: 'littleloom_biometric_email',
  BIOMETRIC_PASSWORD: 'littleloom_biometric_password',
  BIOMETRIC_LOGIN_ENABLED: 'littleloom_biometric_login_enabled',
} as const;

// ============================================
// ASYNC STORAGE KEYS
// ============================================
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
  LAST_AUTH_STATE: 'littleloom_last_auth_state', // NEW: Track auth state changes
} as const;

// ============================================
// TYPES
// ============================================
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
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (fullName: string, email: string, password: string) => Promise<boolean>;
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
  // NEW: App state management
  isAppActive: () => boolean;
  getLastActiveTime: () => number;
}

// ============================================
// SECURE STORAGE HELPERS
// ============================================
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

// ============================================
// CONTEXT CREATION
// ============================================
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ============================================
  // STATE
  // ============================================
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
  });

  // ============================================
  // REFS FOR RACE CONDITION PREVENTION
  // ============================================
  const isMounted = useRef(true);
  const initComplete = useRef(false);
  const setupCompleteCallbackRef = useRef<(() => Promise<void>) | null>(null);
  
  // CRITICAL: Prevent duplicate sign-in attempts
  const signInLock = useRef(false);
  const biometricLoginLock = useRef(false);
  const lastSignInTime = useRef(0);
  
  // App state tracking
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastActiveTimeRef = useRef<number>(Date.now());
  const isAuthenticatedRef = useRef<boolean>(false);

  // ============================================
  // LIFECYCLE
  // ============================================
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Sync auth state to ref for AppState handler
  useEffect(() => {
    isAuthenticatedRef.current = state.isAuthenticated;
  }, [state.isAuthenticated]);

  // ============================================
  // APP STATE HANDLER - PREVENT UNWANTED SIGN-OUTS
  // ============================================
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = appStateRef.current;
      
      console.log('📱 AppState:', previousState, '->', nextAppState);
      
      // Going to background
      if (nextAppState.match(/inactive|background/) && previousState === 'active') {
        lastActiveTimeRef.current = Date.now();
        await AsyncStorage.setItem('littleloom_last_active_global', lastActiveTimeRef.current.toString());
      }
      
      // Coming to foreground - CRITICAL: Don't auto-sign-out
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        // Just update last active time, don't trigger auth checks here
        lastActiveTimeRef.current = Date.now();
        
        // Verify token still exists (don't clear state, just verify)
        const token = await secureStorage.getItem(SECURE_KEYS.AUTH_TOKEN);
        if (!token && isAuthenticatedRef.current) {
          console.log('🔴 Token missing on resume, but preserving state to prevent loop');
          // Don't auto sign-out here - let the app handle it gracefully
        }
      }
      
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // ============================================
  // INITIALIZATION
  // ============================================
  useEffect(() => {
    if (initComplete.current) return;
    
    const initAuth = async () => {
      try {
        console.log('🔵 Initializing AuthContext...');
        
        // Add small delay to prevent race conditions with other contexts
        await new Promise(resolve => setTimeout(resolve, 100));
        
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

        const userProfile = userProfileStr ? JSON.parse(userProfileStr) : null;
        
        // Check biometric hardware availability
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        const biometricAvailable = hasHardware && isEnrolled;

        // Parse setup states
        const hasParent2 = parent2Completed === 'true' ? true : 
                          parent2Completed === 'skipped' ? 'skipped' :
                          hasParent2Str === 'true' ? true :
                          hasParent2Str === 'skipped' ? 'skipped' : false;
                          
        const hasBaby = babyCompleted === 'true' ? true :
                       babyCompleted === 'skipped' ? 'skipped' :
                       hasBabyStr === 'true' ? true :
                       hasBabyStr === 'skipped' ? 'skipped' : false;

        const isSetupComplete = setupComplete === 'true' || 
                               (parent2Completed !== null && babyCompleted !== null);

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
          });
          
          console.log('🟢 AuthContext initialized:', {
            isAuthenticated: !!token,
            hasSeenOnboarding: hasSeenOnboarding === 'true',
            biometricAvailable,
            biometricLoginEnabled: biometricLoginEnabled === 'true',
            setupComplete: isSetupComplete,
            hasParent2,
            hasBaby,
          });
        }
        
        initComplete.current = true;
      } catch (error) {
        console.error('🔴 Auth init failed:', error);
        if (isMounted.current) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
        initComplete.current = true;
      }
    };

    initAuth();
  }, []);

  // ============================================
  // ONBOARDING
  // ============================================
  const markOnboardingSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING, 'true');
      if (isMounted.current) {
        setState(prev => ({ ...prev, hasSeenOnboarding: true }));
      }
      console.log('🟢 Onboarding marked as seen');
    } catch (error) {
      console.error('🔴 Error marking onboarding as seen:', error);
    }
  }, []);

  // ============================================
  // BIOMETRIC METHODS
  // ============================================
  const checkBiometricAvailability = useCallback(async (): Promise<boolean> => {
    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      
      const available = hasHardware && isEnrolled;
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, isBiometricAvailable: available }));
      }
      
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_AVAILABLE, available ? 'true' : 'false');
      return available;
    } catch (error) {
      console.error('Biometric check failed:', error);
      return false;
    }
  }, []);

  const authenticateWithBiometric = useCallback(async (promptMessage?: string) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate with LittleLoom',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      return result;
    } catch (error) {
      console.error('Biometric auth error:', error);
      return { success: false, error: 'unknown' };
    }
  }, []);

  const enableBiometricForApp = useCallback(async (): Promise<boolean> => {
    const result = await authenticateWithBiometric('Confirm to enable biometric unlock');
    if (result.success) {
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'true');
      if (isMounted.current) {
        setState(prev => ({ ...prev, isBiometricEnabled: true }));
      }
      return true;
    }
    return false;
  }, [authenticateWithBiometric]);

  // ============================================
  // BIOMETRIC LOGIN (PASSWORDLESS)
  // ============================================
  const enableBiometricLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await authenticateWithBiometric('Confirm to enable Face ID login');
      if (!result.success) {
        return false;
      }

      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_EMAIL, email),
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_PASSWORD, password),
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED, 'true'),
      ]);

      if (isMounted.current) {
        setState(prev => ({ ...prev, isBiometricLoginEnabled: true }));
      }

      console.log('🟢 Biometric login enabled');
      return true;
    } catch (error) {
      console.error('🔴 Enable biometric login error:', error);
      return false;
    }
  }, [authenticateWithBiometric]);

  const disableBiometricLogin = useCallback(async (): Promise<void> => {
    try {
      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);

      if (isMounted.current) {
        setState(prev => ({ ...prev, isBiometricLoginEnabled: false }));
      }

      console.log('🟢 Biometric login disabled');
    } catch (error) {
      console.error('🔴 Disable biometric login error:', error);
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

  // ============================================
  // PASSWORDLESS BIOMETRIC LOGIN
  // ============================================
  const loginWithBiometric = useCallback(async (): Promise<boolean> => {
    // CRITICAL: Prevent duplicate biometric login attempts
    if (biometricLoginLock.current) {
      console.log('⚠️ Biometric login already in progress, rejecting duplicate');
      return false;
    }

    // Check if we recently logged in (prevent double-tap issues)
    const now = Date.now();
    if (now - lastSignInTime.current < 2000) {
      console.log('⚠️ Recent login detected, ignoring duplicate biometric request');
      return false;
    }

    biometricLoginLock.current = true;

    try {
      // First authenticate with biometric hardware
      const authResult = await authenticateWithBiometric('Login with Face ID');
      if (!authResult.success) {
        console.log('🔴 Biometric authentication failed or cancelled');
        biometricLoginLock.current = false;
        return false;
      }

      // Retrieve stored credentials
      const [storedEmail, storedPassword] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
      ]);

      if (!storedEmail || !storedPassword) {
        Alert.alert('Setup Required', 'Please log in with your password first to enable Face ID login.');
        biometricLoginLock.current = false;
        return false;
      }

      console.log('🔵 Biometric login - auto-signing in with stored credentials');
      
      // Perform sign-in with stored credentials (bypass signIn lock since this is internal)
      const success = await performSignInInternal(storedEmail, storedPassword, true);
      
      lastSignInTime.current = Date.now();
      biometricLoginLock.current = false;
      return success;
    } catch (error) {
      console.error('🔴 Biometric login error:', error);
      biometricLoginLock.current = false;
      return false;
    }
  }, [authenticateWithBiometric]);

  const shouldShowBiometricPrompt = useCallback(async (): Promise<boolean> => {
    if (!state.isBiometricAvailable) return false;
    if (state.isBiometricLoginEnabled) return false;
    
    const hasCreds = await hasBiometricLoginCredentials();
    return !hasCreds;
  }, [state.isBiometricAvailable, state.isBiometricLoginEnabled, hasBiometricLoginCredentials]);

  // ============================================
  // CORE SIGN IN (WITH RACE CONDITION PROTECTION)
  // ============================================
  const performSignInInternal = async (email: string, password: string, isBiometric: boolean = false): Promise<boolean> => {
    try {
      if (!email || !password) {
        Alert.alert('Error', 'Please enter both email and password');
        return false;
      }

      console.log(`🔵 ${isBiometric ? 'Biometric' : 'Password'} sign in for:`, email);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate token and profile
      const token = `auth_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userProfile: UserProfile = {
        id: Math.random().toString(36).substr(2, 9),
        fullName: email.split('@')[0],
        email,
        role: 'parent1',
        createdAt: new Date().toISOString(),
        preferences: {
          notifications: true,
          darkMode: false,
          language: 'en',
        },
      };

      // Save to secure storage
      const [tokenStored, profileStored] = await Promise.all([
        secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token),
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile)),
      ]);
      
      if (!tokenStored || !profileStored) {
        Alert.alert('Error', 'Failed to save login data. Please try again.');
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

      console.log('🟢 Sign in successful');
      return true;
    } catch (error) {
      console.error('🔴 Sign in error:', error);
      Alert.alert('Error', 'Failed to sign in. Please check your connection and try again.');
      return false;
    }
  };

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    // CRITICAL: Prevent duplicate sign-in attempts
    if (signInLock.current) {
      console.log('⚠️ Sign in already in progress, rejecting duplicate');
      return false;
    }

    // Prevent rapid re-login attempts
    const now = Date.now();
    if (now - lastSignInTime.current < 1500) {
      console.log('⚠️ Recent login detected, throttling request');
      await new Promise(resolve => setTimeout(resolve, 1500 - (now - lastSignInTime.current)));
    }

    signInLock.current = true;
    console.log('🔵 Attempting login for:', email);

    try {
      const success = await performSignInInternal(email, password, false);
      lastSignInTime.current = Date.now();
      return success;
    } finally {
      signInLock.current = false;
    }
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string): Promise<boolean> => {
    if (signInLock.current) {
      console.log('⚠️ Sign up already in progress');
      return false;
    }

    signInLock.current = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const token = `auth_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userProfile: UserProfile = {
        id: Math.random().toString(36).substr(2, 9),
        fullName,
        email,
        role: 'parent1',
        createdAt: new Date().toISOString(),
        preferences: {
          notifications: true,
          darkMode: false,
          language: 'en',
        },
      };

      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.AUTH_TOKEN, token),
        secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(userProfile)),
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
      console.error('🔴 Sign up error:', error);
      Alert.alert('Error', 'Failed to create account');
      return false;
    } finally {
      signInLock.current = false;
    }
  }, []);

  // ============================================
  // SIGN OUT - PRESERVES SETUP STATE & BIOMETRIC LOGIN
  // ============================================
  const signOut = useCallback(async (): Promise<void> => {
    console.log('🔵 Signing out...');

    // Prevent sign-out during active operations
    if (signInLock.current) {
      console.log('⚠️ Sign in progress, delaying sign out');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      // Get preserved states before clearing
      const [hasParent2Str, hasBabyStr, setupComplete, hasSeenOnboarding, biometricLoginEnabled] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.HAS_PARENT2),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_BABY),
        AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_SEEN_ONBOARDING),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);

      // Clear auth data but preserve biometric login credentials
      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.AUTH_TOKEN),
        secureStorage.deleteItem(SECURE_KEYS.USER_PROFILE),
        secureStorage.deleteItem(SECURE_KEYS.PIN_HASH),
        // DO NOT DELETE: BIOMETRIC_EMAIL, BIOMETRIC_PASSWORD, BIOMETRIC_LOGIN_ENABLED
        AsyncStorage.multiRemove([
          ASYNC_KEYS.ONBOARDING_COMPLETE,
          ASYNC_KEYS.BIOMETRIC_ENABLED,
        ]),
      ]);

      const hasParent2 = hasParent2Str === 'true' ? true : 
                        hasParent2Str === 'skipped' ? 'skipped' : false;
      const hasBaby = hasBabyStr === 'true' ? true : 
                     hasBabyStr === 'skipped' ? 'skipped' : false;

      if (isMounted.current) {
        setState({
          isLoading: false,
          isAuthenticated: false,
          userToken: null,
          userProfile: null,
          onboardingComplete: false,
          hasSeenOnboarding: hasSeenOnboarding === 'true',
          isBiometricAvailable: state.isBiometricAvailable,
          isBiometricEnabled: false,
          isBiometricLoginEnabled: biometricLoginEnabled === 'true',
          setupComplete: setupComplete === 'true',
          hasParent2,
          hasBaby,
        });
      }

      console.log('🟢 Sign out successful - biometric login preserved:', biometricLoginEnabled === 'true');
    } catch (error) {
      console.error('🔴 Sign out error:', error);
    }
  }, [state.isBiometricAvailable]);

  // ============================================
  // PROFILE METHODS
  // ============================================
  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      
      const updated = { ...state.userProfile, ...updates };
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updated));
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updated }));
      }
      
      return true;
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', 'Failed to update profile');
      return false;
    }
  }, [state.userProfile]);

  const updateUserPreferences = useCallback(async (prefs: Partial<UserProfile['preferences']>): Promise<boolean> => {
    try {
      if (!state.userProfile) return false;
      
      const updated = {
        ...state.userProfile,
        preferences: { ...state.userProfile.preferences, ...prefs },
      };
      
      await secureStorage.setItem(SECURE_KEYS.USER_PROFILE, JSON.stringify(updated));
      
      if (isMounted.current) {
        setState(prev => ({ ...prev, userProfile: updated }));
      }
      
      return true;
    } catch (error) {
      console.error('Update preferences error:', error);
      return false;
    }
  }, [state.userProfile]);

  // ============================================
  // SETUP FLOW METHODS
  // ============================================
  const setSetupCompleteCallback = useCallback((callback: (() => Promise<void>) | null) => {
    setupCompleteCallbackRef.current = callback;
    console.log('🔵 Setup complete callback registered:', callback ? 'yes' : 'no');
  }, []);

  const completeSetup = useCallback(async (step: 'parent2' | 'baby') => {
    console.log('🔵 completeSetup called for:', step);
    try {
      if (step === 'parent2') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_PARENT2, 'true'),
          AsyncStorage.setItem(ASYNC_KEYS.PARENT2_COMPLETED, 'true'),
        ]);
        if (isMounted.current) {
          setState(prev => ({ ...prev, hasParent2: true }));
        }
      } else if (step === 'baby') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_BABY, 'true'),
          AsyncStorage.setItem(ASYNC_KEYS.BABY_COMPLETED, 'true'),
        ]);
        if (isMounted.current) {
          setState(prev => ({ ...prev, hasBaby: true }));
        }
      }
      
      // Check if all setup is complete
      const [hasP2, hasB] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.HAS_PARENT2),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_BABY),
      ]);
      
      const setupDone = (hasP2 === 'true' || hasP2 === 'skipped') && 
                       (hasB === 'true' || hasB === 'skipped');
      
      if (setupDone) {
        await AsyncStorage.setItem(ASYNC_KEYS.SETUP_COMPLETE, 'true');
        if (isMounted.current) {
          setState(prev => ({ ...prev, setupComplete: true }));
        }
        
        console.log('✅ Setup complete - triggering security unlock callback');
        if (setupCompleteCallbackRef.current) {
          try {
            await setupCompleteCallbackRef.current();
          } catch (error) {
            console.error('🔴 Setup complete callback error:', error);
          }
        }
      }
    } catch (error) {
      console.error('🔴 Complete setup error:', error);
    }
  }, []);

  const skipSetup = useCallback(async (step: 'parent2' | 'baby') => {
    console.log('🔵 skipSetup called for:', step);
    try {
      if (step === 'parent2') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_PARENT2, 'skipped'),
          AsyncStorage.setItem(ASYNC_KEYS.PARENT2_COMPLETED, 'skipped'),
        ]);
        if (isMounted.current) {
          setState(prev => ({ ...prev, hasParent2: 'skipped' }));
        }
      } else if (step === 'baby') {
        await Promise.all([
          AsyncStorage.setItem(ASYNC_KEYS.HAS_BABY, 'skipped'),
          AsyncStorage.setItem(ASYNC_KEYS.BABY_COMPLETED, 'skipped'),
        ]);
        if (isMounted.current) {
          setState(prev => ({ ...prev, hasBaby: 'skipped' }));
        }
      }
      
      await AsyncStorage.setItem(ASYNC_KEYS.SETUP_COMPLETE, 'true');
      if (isMounted.current) {
        setState(prev => ({ ...prev, setupComplete: true }));
      }
      
      console.log('✅ Setup skipped but complete - triggering security unlock callback');
      if (setupCompleteCallbackRef.current) {
        try {
          await setupCompleteCallbackRef.current();
        } catch (error) {
          console.error('🔴 Setup skip callback error:', error);
        }
      }
    } catch (error) {
      console.error('🔴 Skip setup error:', error);
    }
  }, []);

  const wasSetupCompleted = useCallback(async () => {
    try {
      const [hasParent2Str, hasBabyStr, setupComplete] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.HAS_PARENT2),
        AsyncStorage.getItem(ASYNC_KEYS.HAS_BABY),
        AsyncStorage.getItem(ASYNC_KEYS.SETUP_COMPLETE),
      ]);

      const hasParent2 = hasParent2Str === 'true' ? true : 
                        hasParent2Str === 'skipped' ? 'skipped' : false;
      const hasBaby = hasBabyStr === 'true' ? true : 
                     hasBabyStr === 'skipped' ? 'skipped' : false;

      return {
        hasParent2,
        hasBaby,
        setupComplete: setupComplete === 'true',
      };
    } catch (error) {
      console.error('🔴 Check setup completion error:', error);
      return { hasParent2: false, hasBaby: false, setupComplete: false };
    }
  }, []);

  const resetSetupFlow = useCallback(async () => {
    try {
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
          setupComplete: false,
          hasParent2: false,
          hasBaby: false,
        }));
      }
    } catch (error) {
      console.error('Reset setup error:', error);
    }
  }, []);

  // ============================================
  // APP STATE HELPERS
  // ============================================
  const isAppActive = useCallback(() => {
    return appStateRef.current === 'active';
  }, []);

  const getLastActiveTime = useCallback(() => {
    return lastActiveTimeRef.current;
  }, []);

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value = React.useMemo(() => ({
    ...state,
    signIn,
    signUp,
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
  }), [
    state,
    signIn,
    signUp,
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