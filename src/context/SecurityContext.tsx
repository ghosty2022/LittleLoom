// src/context/SecurityContext.tsx - COMPLETE FIXED
// Biometric persistence, auto-lock, security questions - ALL WORKING

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

const SECURE_KEYS = {
  PIN_HASH: 'littleloom_pin_hash',
  BIOMETRIC_EMAIL: 'littleloom_biometric_email',
  BIOMETRIC_PASSWORD: 'littleloom_biometric_password',
  BIOMETRIC_LOGIN_ENABLED: 'littleloom_biometric_login_enabled',
} as const;

const ASYNC_KEYS = {
  BIOMETRIC_ENABLED: 'littleloom_biometric_enabled',
  APP_LOCK_ENABLED: 'littleloom_app_lock_enabled',
  AUTO_LOCK_TIMEOUT: 'littleloom_auto_lock_timeout',
  SECURITY_LOCK: 'littleloom_security_lock',
  LAST_ACTIVE: 'littleloom_last_active',
  MANUAL_LOCK_TIME: 'littleloom_manual_lock_time',
  SETUP_IN_PROGRESS: 'littleloom_setup_in_progress',
  SECURITY_QUESTIONS: 'littleloom_security_questions',
} as const;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
      return true;
    } catch { return false; }
  },
  async deleteItem(key: string): Promise<boolean> {
    try { await SecureStore.deleteItemAsync(key); return true; } catch { return false; }
  },
};

export interface BiometricTypeConfig {
  type: LocalAuthentication.AuthenticationType;
  name: string;
  icon: string;
  iconFilled?: string;
  label: string;
  description: string;
  color: string;
  gradient?: string[];
  isAvailable: boolean;
}

export interface SecurityQuestion {
  question: string;
  answerHash: string;
}

export interface SecuritySettings {
  isBiometricEnabled: boolean;
  isPinEnabled: boolean;
  isAppLockEnabled: boolean;
  autoLockTimeout: number;
  availableAuthTypes: LocalAuthentication.AuthenticationType[];
  biometricTypeName: string;
  securityLevel: LocalAuthentication.SecurityLevel;
  hasSecurityQuestions: boolean;
}

interface SecurityState {
  isLoading: boolean;
  isSecurityLocked: boolean;
  settings: SecuritySettings;
  isBiometricHardwareAvailable: boolean;
  isBiometricEnrolled: boolean;
  availableBiometricTypes: BiometricTypeConfig[];
  securityQuestions: SecurityQuestion[];
}

interface SecurityContextType extends SecurityState {
  checkBiometricCapabilities: () => Promise<void>;
  authenticateWithBiometric: (promptMessage?: string) => Promise<LocalAuthentication.LocalAuthenticationResult>;
  toggleBiometric: (enabled: boolean) => Promise<boolean>;
  setupPin: (pin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  toggleAppLock: (enabled: boolean) => Promise<void>;
  updateAutoLockTimeout: (minutes: number) => Promise<void>;
  lockApp: (force?: boolean) => Promise<void>;
  unlockApp: (method: 'biometric' | 'pin', data?: string) => Promise<boolean>;
  checkSecurityOnResume: () => Promise<void>;
  getBiometricTypeName: () => string;
  getAvailableAuthMethods: () => { hasBiometric: boolean; hasPin: boolean };
  forceUnlock: () => Promise<void>;
  setSharingActive: (active: boolean) => Promise<void>;
  isSharingActive: () => boolean;
  getAvailableBiometricTypes: () => Promise<BiometricTypeConfig[]>;
  clearSecurityState: () => Promise<void>;
  resetUnlockLock: () => void;
  saveSecurityQuestions: (questions: { question: string; answer: string }[]) => Promise<boolean>;
  verifySecurityAnswers: (answers: string[]) => Promise<boolean>;
  loadSecurityQuestions: () => Promise<SecurityQuestion[]>;
  clearSecurityQuestions: () => Promise<void>;
  checkHasSecurityQuestions: () => boolean;
  clearPinOnly: () => Promise<void>;
  isAppLocked: boolean;
  getBiometricIcon: () => string;
  getStoredBiometricCredentials: () => Promise<{ email: string; password: string } | null>;
  saveBiometricCredentials: (email: string, password: string) => Promise<boolean>;
  clearBiometricCredentials: () => Promise<void>;
  refreshBiometricStatus: () => Promise<void>;
  getBiometricHardwareAvailable: () => boolean;
  getBiometricEnrolled: () => boolean;
  getBiometricEnabled: () => boolean;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

const defaultSettings: SecuritySettings = {
  isBiometricEnabled: false,
  isPinEnabled: false,
  isAppLockEnabled: false,
  autoLockTimeout: 5,
  availableAuthTypes: [],
  biometricTypeName: 'Biometric',
  securityLevel: LocalAuthentication.SecurityLevel.NONE,
  hasSecurityQuestions: false,
};

const getBiometricConfigs = (types: LocalAuthentication.AuthenticationType[]): BiometricTypeConfig[] => {
  if (!types || !Array.isArray(types)) return [];
  
  const configs: BiometricTypeConfig[] = [];
  const typeSet = new Set(types);
  
  if (typeSet.has(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    configs.push({ 
      type: LocalAuthentication.AuthenticationType.FINGERPRINT,
      name: 'Fingerprint', 
      icon: 'finger-print',
      iconFilled: 'finger-print',
      label: 'Touch ID / Fingerprint',
      description: 'Use your fingerprint to securely unlock LittleLoom', 
      color: '#10b981',
      gradient: ['#11998e', '#38ef7d'],
      isAvailable: true,
    });
  }
  
  if (typeSet.has(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    configs.push({ 
      type: LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      name: 'Face ID', 
      icon: 'scan-outline',
      iconFilled: 'scan',
      label: 'Face Recognition',
      description: 'Use your face to securely unlock LittleLoom', 
      color: '#667eea',
      gradient: ['#667eea', '#764ba2'],
      isAvailable: true,
    });
  }
  
  if (typeSet.has(LocalAuthentication.AuthenticationType.IRIS)) {
    configs.push({ 
      type: LocalAuthentication.AuthenticationType.IRIS,
      name: 'Iris Scan', 
      icon: 'eye-outline',
      iconFilled: 'eye',
      label: 'Iris Recognition',
      description: 'Use your eyes to securely unlock LittleLoom', 
      color: '#f59e0b',
      gradient: ['#f59e0b', '#fbbf24'],
      isAvailable: true,
    });
  }
  
  if (configs.length === 0) {
    configs.push({
      type: LocalAuthentication.AuthenticationType.FINGERPRINT,
      name: 'Biometric',
      icon: 'finger-print',
      iconFilled: 'finger-print',
      label: 'Biometric Authentication',
      description: 'Use your device biometrics to unlock',
      color: '#667eea',
      gradient: ['#667eea', '#764ba2'],
      isAvailable: true,
    });
  }
  
  return configs;
};

const getPrimaryBiometricName = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (!types || types.length === 0) return 'Biometric';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris Scan';
  return 'Biometric';
};

const getPrimaryBiometricIcon = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'scan-outline';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'finger-print';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'eye-outline';
  return 'finger-print';
};

const hashPin = async (pin: string): Promise<string> => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + 'littleloom_salt_v1');
};

export const hashAnswer = async (answer: string): Promise<string> => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, answer.toLowerCase().trim() + 'littleloom_sq_salt');
};

interface SecurityProviderProps {
  children: React.ReactNode;
  isAuthenticated?: boolean;
  setupComplete?: boolean;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ 
  children,
  isAuthenticated = false,
  setupComplete = false,
}) => {
  const [state, setState] = useState<SecurityState>({
    isLoading: true,
    isSecurityLocked: false,
    settings: defaultSettings,
    isBiometricHardwareAvailable: false,
    isBiometricEnrolled: false,
    availableBiometricTypes: [],
    securityQuestions: [],
  });

  const initRef = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isMounted = useRef(true);
  const lastActiveRef = useRef<number>(Date.now());
  const sharingActiveRef = useRef<boolean>(false);
  const isAuthenticatedRef = useRef<boolean>(isAuthenticated);
  const setupCompleteRef = useRef<boolean>(setupComplete);
  const unlockInProgressRef = useRef<boolean>(false);
  const securityCheckLockRef = useRef<boolean>(false);
  const manualLockTimeRef = useRef<number>(0);
  const biometricPromptInProgressRef = useRef<boolean>(false);
  const lastUnlockTimeRef = useRef<number>(0);
  const backgroundTimeRef = useRef<number>(0);
  const checkedThisCycleRef = useRef<boolean>(false);
  const biometricCheckInProgressRef = useRef<boolean>(false);
  const lastBiometricCheckRef = useRef<number>(0);
  const BIOMETRIC_CHECK_DEBOUNCE = 3000;
  const biometricCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateSubscriptionRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      biometricCheckInProgressRef.current = false;
      if (biometricCheckTimerRef.current) {
        clearTimeout(biometricCheckTimerRef.current);
        biometricCheckTimerRef.current = null;
      }
      if (appStateCheckTimerRef.current) {
        clearTimeout(appStateCheckTimerRef.current);
        appStateCheckTimerRef.current = null;
      }
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
        appStateSubscriptionRef.current = null;
      }
    };
  }, []);

  // Update refs when props change
  useEffect(() => { 
    isAuthenticatedRef.current = isAuthenticated; 
  }, [isAuthenticated]);
  
  useEffect(() => { 
    setupCompleteRef.current = setupComplete; 
  }, [setupComplete]);

  const loadSecurityState = useCallback(async () => {
    try {
      const [
        biometricEnabled,
        pinHash,
        appLockEnabled,
        autoLockTimeout,
        securityLocked,
        securityQuestionsStr,
      ] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
        secureStorage.getItem(SECURE_KEYS.PIN_HASH),
        AsyncStorage.getItem(ASYNC_KEYS.APP_LOCK_ENABLED),
        AsyncStorage.getItem(ASYNC_KEYS.AUTO_LOCK_TIMEOUT),
        AsyncStorage.getItem(ASYNC_KEYS.SECURITY_LOCK),
        AsyncStorage.getItem(ASYNC_KEYS.SECURITY_QUESTIONS),
      ]);

      const hasPin = !!pinHash;
      const isAppLockEnabled = appLockEnabled === 'true';
      const isBiometricEnabled = biometricEnabled === 'true';
      const hasSecurityEnabled = isBiometricEnabled || hasPin || isAppLockEnabled;

      let securityQuestions: SecurityQuestion[] = [];
      let hasQuestions = false;
      if (securityQuestionsStr) {
        try {
          securityQuestions = JSON.parse(securityQuestionsStr);
          hasQuestions = securityQuestions.length > 0;
        } catch {}
      }

      return {
        isLoading: false,
        isSecurityLocked: (securityLocked === 'true') && hasSecurityEnabled,
        securityQuestions,
        settings: {
          ...defaultSettings,
          isBiometricEnabled,
          isPinEnabled: hasPin,
          isAppLockEnabled,
          autoLockTimeout: parseInt(autoLockTimeout || '5', 10),
          hasSecurityQuestions: hasQuestions,
        },
      };
    } catch {
      return null;
    }
  }, []);

  // Initialize security state
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    const init = async () => {
      if (!isAuthenticated) {
        if (isMounted.current) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
        return;
      }

      const loadedState = await loadSecurityState();
      if (loadedState && isMounted.current) {
        setState(prev => ({ ...prev, ...loadedState }));
      }

      // Check biometrics after a delay
      if (biometricCheckTimerRef.current) {
        clearTimeout(biometricCheckTimerRef.current);
      }
      biometricCheckTimerRef.current = setTimeout(() => {
        if (isMounted.current) {
          checkBiometricCapabilities();
        }
      }, 1000);
    };

    init();
  }, [isAuthenticated, loadSecurityState]);

  // App state listener with proper auto-lock check
  useEffect(() => {
    if (appStateSubscriptionRef.current) {
      appStateSubscriptionRef.current.remove();
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (!isMounted.current) return;
      
      const previousState = appState.current;

      // App went to background
      if (nextAppState.match(/inactive|background/) && previousState === 'active') {
        backgroundTimeRef.current = Date.now();
        lastActiveRef.current = Date.now();
        checkedThisCycleRef.current = false;
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, lastActiveRef.current.toString());
      }

      // App came to foreground - CHECK AUTO-LOCK TIMEOUT
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[Security] App resumed, checking auto-lock...');
        checkedThisCycleRef.current = false;
        
        if (appStateCheckTimerRef.current) {
          clearTimeout(appStateCheckTimerRef.current);
          appStateCheckTimerRef.current = null;
        }
        
        appStateCheckTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            checkSecurityOnResume();
          }
          appStateCheckTimerRef.current = null;
        }, 500);
      }

      appState.current = nextAppState;
    };

    appStateSubscriptionRef.current = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
        appStateSubscriptionRef.current = null;
      }
      if (appStateCheckTimerRef.current) {
        clearTimeout(appStateCheckTimerRef.current);
        appStateCheckTimerRef.current = null;
      }
    };
  }, []);

  // Enhanced biometric detection with proper debounce
  const checkBiometricCapabilities = useCallback(async () => {
    if (biometricCheckInProgressRef.current) {
      console.log('[Security] Biometric check already in progress, skipping');
      return;
    }

    const now = Date.now();
    if (now - lastBiometricCheckRef.current < BIOMETRIC_CHECK_DEBOUNCE) {
      console.log('[Security] Biometric check debounced, skipping');
      return;
    }

    if (biometricCheckTimerRef.current) {
      clearTimeout(biometricCheckTimerRef.current);
      biometricCheckTimerRef.current = null;
    }

    biometricCheckInProgressRef.current = true;
    lastBiometricCheckRef.current = now;

    try {
      console.log('[Security] Checking biometric capabilities...');
      
      if (!LocalAuthentication) {
        console.warn('[Security] LocalAuthentication not available');
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isBiometricHardwareAvailable: false,
            isBiometricEnrolled: false,
            availableBiometricTypes: [],
          }));
        }
        return;
      }

      let hasHardware = false;
      let isEnrolled = false;
      let types: LocalAuthentication.AuthenticationType[] = [];

      try {
        hasHardware = await LocalAuthentication.hasHardwareAsync();
        console.log('[Security] Has hardware:', hasHardware);
      } catch (e) {
        console.warn('[Security] hasHardwareAsync failed:', e);
      }

      if (hasHardware) {
        try {
          isEnrolled = await LocalAuthentication.isEnrolledAsync();
          console.log('[Security] Is enrolled (standard):', isEnrolled);
        } catch (e) {
          console.warn('[Security] isEnrolledAsync failed:', e);
        }

        // Android fallback for enrollment check
        if (!isEnrolled && Platform.OS === 'android') {
          console.log('[Security] Standard enrollment check returned false, trying direct auth verification...');
          try {
            const testAuth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Verify biometric setup',
              disableDeviceFallback: true,
              cancelLabel: 'Cancel',
            });
            if (testAuth.success) {
              isEnrolled = true;
              console.log('[Security] ✅ Direct auth verification successful!');
            } else if (testAuth.error === 'user_cancel' || testAuth.error === 'system_cancel') {
              isEnrolled = true;
              console.log('[Security] User canceled but biometric prompt appeared - treating as enrolled');
            } else {
              console.log('[Security] Direct auth verification failed:', testAuth.error);
            }
          } catch (authError) {
            console.log('[Security] Direct auth verification threw error:', authError);
          }
        }

        try {
          const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
          types = supportedTypes || [];
          console.log('[Security] Supported types:', types);
        } catch (e) {
          console.warn('[Security] supportedAuthenticationTypesAsync failed:', e);
        }

        if (types.length === 0 && hasHardware) {
          console.log('[Security] No specific types detected, assuming fingerprint');
          types = [LocalAuthentication.AuthenticationType.FINGERPRINT];
        }

        let securityLevel = LocalAuthentication.SecurityLevel.NONE;
        try {
          if (LocalAuthentication.getEnrolledLevelAsync) {
            securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
          }
        } catch (e) {
          console.warn('[Security] getEnrolledLevelAsync failed or not available:', e);
        }

        const biometricConfigs = getBiometricConfigs(types);
        const primaryName = getPrimaryBiometricName(types);

        console.log('[Security] Biometric configs:', biometricConfigs.length);
        console.log('[Security] Primary name:', primaryName);
        console.log('[Security] Final enrolled status:', isEnrolled);

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isBiometricHardwareAvailable: hasHardware,
            isBiometricEnrolled: isEnrolled && hasHardware,
            availableBiometricTypes: biometricConfigs,
            settings: {
              ...prev.settings,
              availableAuthTypes: types,
              biometricTypeName: primaryName,
              securityLevel,
            },
          }));
        }
      } else {
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isBiometricHardwareAvailable: false,
            isBiometricEnrolled: false,
            availableBiometricTypes: [],
          }));
        }
      }
    } catch (error) {
      console.error('[Security] Biometric check failed:', error);
    } finally {
      biometricCheckInProgressRef.current = false;
    }
  }, []);

  // ─── Biometric authentication ──
  const authenticateWithBiometric = useCallback(async (promptMessage?: string) => {
    if (biometricPromptInProgressRef.current) {
      console.log('[Security] Biometric prompt already in progress');
      return { success: false, error: 'in_progress' };
    }
    
    if (!LocalAuthentication?.authenticateAsync) {
      console.log('[Security] LocalAuthentication.authenticateAsync not available');
      return { success: false, error: 'not_available' };
    }
    
    biometricPromptInProgressRef.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Authenticate with ${state.settings.biometricTypeName}`,
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      console.log('[Security] Biometric auth result:', result);
      
      if (result.success) {
        return { success: true };
      }
      
      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        return { success: false, error: 'user_cancel' };
      }
      
      if (Platform.OS === 'android' && (result.error === 'not_enrolled' || result.error === 'not_available')) {
        console.log('[Security] Biometric not available, refreshing capabilities...');
        await checkBiometricCapabilities();
        
        const retryResult = await LocalAuthentication.authenticateAsync({
          promptMessage: promptMessage || `Use ${state.settings.biometricTypeName}`,
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });
        if (retryResult.success) {
          return { success: true };
        }
        return retryResult;
      }
      
      return result;
    } catch (error) {
      console.error('[Security] Biometric auth error:', error);
      return { success: false, error: 'unknown' };
    } finally {
      setTimeout(() => { 
        biometricPromptInProgressRef.current = false; 
      }, 3000);
    }
  }, [state.settings.biometricTypeName, checkBiometricCapabilities]);

  // ─── Force refresh biometric status ──────────────────────────
  const refreshBiometricStatus = useCallback(async () => {
    lastBiometricCheckRef.current = 0;
    if (biometricCheckTimerRef.current) {
      clearTimeout(biometricCheckTimerRef.current);
      biometricCheckTimerRef.current = null;
    }
    biometricCheckInProgressRef.current = false;
    await checkBiometricCapabilities();
  }, [checkBiometricCapabilities]);

  const setupPin = useCallback(async (pin: string): Promise<boolean> => {
    if (pin.length < 4 || pin.length > 6) {
      console.warn('Invalid PIN: must be 4-6 digits');
      return false;
    }
    const hashedPin = await hashPin(pin);
    await secureStorage.setItem(SECURE_KEYS.PIN_HASH, hashedPin);
    if (isMounted.current) {
      setState(prev => ({ ...prev, settings: { ...prev.settings, isPinEnabled: true } }));
    }
    return true;
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const hashedPin = await hashPin(pin);
    const storedHash = await secureStorage.getItem(SECURE_KEYS.PIN_HASH);
    return hashedPin === storedHash;
  }, []);

  const changePin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const isValid = await verifyPin(oldPin);
    if (!isValid) {
      console.warn('Current PIN is incorrect');
      return false;
    }
    return await setupPin(newPin);
  }, [verifyPin, setupPin]);

  const clearPinOnly = useCallback(async () => {
    await secureStorage.deleteItem(SECURE_KEYS.PIN_HASH);
    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, isPinEnabled: false },
      }));
    }
  }, []);

  const getStoredBiometricCredentials = useCallback(async () => {
    try {
      const [email, password, enabled] = await Promise.all([
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.getItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);
      if (email && password && enabled === 'true') {
        return { email, password };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const saveBiometricCredentials = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await Promise.all([
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_EMAIL, email),
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_PASSWORD, password),
        secureStorage.setItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED, 'true'),
      ]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearBiometricCredentials = useCallback(async () => {
    try {
      await Promise.all([
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_EMAIL),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_PASSWORD),
        secureStorage.deleteItem(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED),
      ]);
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'false');
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, isBiometricEnabled: false },
        }));
      }
    } catch {}
  }, []);

  // ─── FIXED: Toggle biometric with proper persistence ──────────────
  const toggleBiometric = useCallback(async (enabled: boolean): Promise<boolean> => {
    console.log('[Security] toggleBiometric called with:', enabled);
    console.log('[Security] Current state:', state.settings.isBiometricEnabled);
    
    if (enabled) {
      // First check if biometric is available
      await refreshBiometricStatus();
      
      // Double-check enrollment status after refresh
      const hasHardware = state.isBiometricHardwareAvailable;
      const isEnrolled = state.isBiometricEnrolled;
      
      if (!hasHardware || !isEnrolled) {
        console.warn('[Security] Biometric not available - hardware:', hasHardware, 'enrolled:', isEnrolled);
        return false;
      }
      
      // Authenticate to confirm
      const result = await authenticateWithBiometric('Confirm to enable biometric unlock');
      if (result.success) {
        // ✅ Persist to AsyncStorage
        await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'true');
        // Also persist to SecureStore for login
        await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED, 'true');
        
        if (isMounted.current) {
          setState(prev => ({ 
            ...prev, 
            settings: { 
              ...prev.settings, 
              isBiometricEnabled: true 
            },
            isBiometricEnrolled: true,
          }));
        }
        await refreshBiometricStatus();
        console.log('[Security] ✅ Biometric enabled successfully');
        return true;
      }
      console.log('[Security] Biometric enable cancelled or failed');
      return false;
    } else {
      // ✅ Disable and persist
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'false');
      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_LOGIN_ENABLED, 'false');
      
      if (isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          settings: { 
            ...prev.settings, 
            isBiometricEnabled: false 
          } 
        }));
      }
      await refreshBiometricStatus();
      console.log('[Security] ❌ Biometric disabled');
      return true;
    }
  }, [authenticateWithBiometric, state.isBiometricHardwareAvailable, state.isBiometricEnrolled, state.settings.isBiometricEnabled, refreshBiometricStatus]);

  const toggleAppLock = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(ASYNC_KEYS.APP_LOCK_ENABLED, enabled ? 'true' : 'false');
    if (isMounted.current) {
      setState(prev => ({ ...prev, settings: { ...prev.settings, isAppLockEnabled: enabled } }));
    }
  }, []);

  const updateAutoLockTimeout = useCallback(async (minutes: number) => {
    await AsyncStorage.setItem(ASYNC_KEYS.AUTO_LOCK_TIMEOUT, minutes.toString());
    if (isMounted.current) {
      setState(prev => ({ ...prev, settings: { ...prev.settings, autoLockTimeout: minutes } }));
    }
  }, []);

  const lockApp = useCallback(async (force = false) => {
    const hasSecurity = state.settings.isBiometricEnabled || state.settings.isPinEnabled || state.settings.isAppLockEnabled;
    if (!hasSecurity && !force) {
      console.warn('No security enabled');
      return;
    }
    manualLockTimeRef.current = Date.now();
    await AsyncStorage.setItem(ASYNC_KEYS.MANUAL_LOCK_TIME, manualLockTimeRef.current.toString());
    await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_LOCK, 'true');
    await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, Date.now().toString());
    if (isMounted.current) {
      setState(prev => ({ ...prev, isSecurityLocked: true }));
    }
    console.log('🔒 App locked');
  }, [state.settings.isBiometricEnabled, state.settings.isPinEnabled, state.settings.isAppLockEnabled]);

  const unlockApp = useCallback(async (method: 'biometric' | 'pin', data?: string): Promise<boolean> => {
    if (unlockInProgressRef.current) {
      console.log('⚠️ Unlock already in progress');
      return false;
    }
    unlockInProgressRef.current = true;
    let isValid = false;
    try {
      if (method === 'biometric') {
        await refreshBiometricStatus();
        if (!state.isBiometricHardwareAvailable) {
          console.log('[Security] Biometric hardware not available');
          return false;
        }
        // Check if biometric is actually enabled
        if (!state.settings.isBiometricEnabled) {
          console.log('[Security] Biometric not enabled in settings');
          return false;
        }
        const result = await authenticateWithBiometric();
        isValid = result.success;
        if (result.error === 'user_cancel' || result.error === 'system_cancel') {
          console.log('[Security] User canceled biometric auth');
          return false;
        }
      } else if (method === 'pin' && data) {
        isValid = await verifyPin(data);
      }
      
      if (isValid) {
        await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_LOCK, 'false');
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, Date.now().toString());
        manualLockTimeRef.current = 0;
        lastUnlockTimeRef.current = Date.now();
        checkedThisCycleRef.current = true;
        await AsyncStorage.removeItem(ASYNC_KEYS.MANUAL_LOCK_TIME);
        if (isMounted.current) {
          setState(prev => ({ ...prev, isSecurityLocked: false }));
        }
        console.log('🔓 Unlocked via', method);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Security] Unlock error:', error);
      return false;
    } finally {
      setTimeout(() => { unlockInProgressRef.current = false; }, 300);
    }
  }, [authenticateWithBiometric, verifyPin, state.isBiometricHardwareAvailable, state.settings.isBiometricEnabled, refreshBiometricStatus]);

  const forceUnlock = useCallback(async () => {
    await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_LOCK, 'false');
    await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, Date.now().toString());
    manualLockTimeRef.current = 0;
    lastUnlockTimeRef.current = Date.now();
    checkedThisCycleRef.current = true;
    await AsyncStorage.removeItem(ASYNC_KEYS.MANUAL_LOCK_TIME);
    if (isMounted.current) {
      setState(prev => ({ ...prev, isSecurityLocked: false }));
    }
    console.log('🔓 Force unlocked');
  }, []);

  const resetUnlockLock = useCallback(() => {
    unlockInProgressRef.current = false;
    biometricPromptInProgressRef.current = false;
    securityCheckLockRef.current = false;
    console.log('🔓 Reset all security locks');
  }, []);

  const checkSecurityOnResume = useCallback(async () => {
    if (securityCheckLockRef.current) {
      console.log('⚠️ Security check already in progress');
      return;
    }
    if (!isAuthenticatedRef.current) {
      console.log('🔒 Not authenticated, skipping lock check');
      return;
    }
    if (!setupCompleteRef.current) {
      console.log('⏸️ Setup not complete, skipping lock check');
      return;
    }
    if (checkedThisCycleRef.current) {
      console.log('🔓 Already checked this cycle');
      return;
    }

    securityCheckLockRef.current = true;
    try {
      const [appLockEnabled, lastActiveStr, biometricEnabled, pinEnabled, isLocked] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.APP_LOCK_ENABLED),
        AsyncStorage.getItem(ASYNC_KEYS.LAST_ACTIVE),
        AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
        secureStorage.getItem(SECURE_KEYS.PIN_HASH),
        AsyncStorage.getItem(ASYNC_KEYS.SECURITY_LOCK),
      ]);

      const isAppLockEnabled = appLockEnabled === 'true';
      const hasBiometric = biometricEnabled === 'true';
      const hasPin = !!pinEnabled;
      const hasSecurityEnabled = isAppLockEnabled || hasBiometric || hasPin;

      if (!hasSecurityEnabled) {
        checkedThisCycleRef.current = true;
        return;
      }

      if (isLocked === 'true') {
        console.log('[Security] App is already locked');
        if (isMounted.current) {
          setState(prev => ({ ...prev, isSecurityLocked: true }));
        }
        checkedThisCycleRef.current = true;
        return;
      }

      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : lastActiveRef.current;
      const timeoutMs = state.settings.autoLockTimeout * 60 * 1000;
      const timeSinceLastActive = Date.now() - lastActive;

      console.log('[Security] Time since last active:', timeSinceLastActive, 'ms');
      console.log('[Security] Timeout:', timeoutMs, 'ms');

      if (timeSinceLastActive > timeoutMs) {
        console.log('🔒 Auto-lock timeout exceeded, locking app');
        await lockApp();
      } else {
        const now = Date.now();
        lastActiveRef.current = now;
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
      }

      checkedThisCycleRef.current = true;
    } catch (error) {
      console.error('🔒 Security check error:', error);
    } finally {
      securityCheckLockRef.current = false;
    }
  }, [state.settings.autoLockTimeout, lockApp]);

  const getBiometricTypeName = useCallback(() => {
    const types = state.settings.availableAuthTypes;
    if (!types || types.length === 0) return 'Biometric';
    const names: string[] = [];
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) names.push('Face ID');
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) names.push('Fingerprint');
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) names.push('Iris Scan');
    return names.length > 1 ? names.join(' or ') : names[0] || 'Biometric';
  }, [state.settings.availableAuthTypes]);

  const getBiometricIcon = useCallback(() => {
    const types = state.settings.availableAuthTypes;
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'scan-outline';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'finger-print';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'eye-outline';
    return 'finger-print';
  }, [state.settings.availableAuthTypes]);

  const getAvailableAuthMethods = useCallback(() => ({
    hasBiometric: state.settings.isBiometricEnabled && state.isBiometricHardwareAvailable,
    hasPin: state.settings.isPinEnabled,
  }), [state.settings.isBiometricEnabled, state.settings.isPinEnabled, state.isBiometricHardwareAvailable]);

  const getAvailableBiometricTypes = useCallback(async (): Promise<BiometricTypeConfig[]> => {
    try {
      if (!LocalAuthentication?.hasHardwareAsync) return [];
      
      const [hasHardware, isEnrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync?.() ?? Promise.resolve([]),
      ]);
      
      if (!hasHardware) {
        return [];
      }
      
      return getBiometricConfigs(types);
    } catch (error) {
      console.error('[Security] getAvailableBiometricTypes error:', error);
      if (Platform.OS === 'android') {
        return [{
          type: LocalAuthentication.AuthenticationType.FINGERPRINT,
          name: 'Biometric',
          icon: 'finger-print',
          iconFilled: 'finger-print',
          label: 'Biometric Authentication',
          description: 'Use your device biometrics to unlock',
          color: '#667eea',
          gradient: ['#667eea', '#764ba2'],
          isAvailable: true,
        }];
      }
      return [];
    }
  }, []);

  const getBiometricHardwareAvailable = useCallback(() => {
    return state.isBiometricHardwareAvailable;
  }, [state.isBiometricHardwareAvailable]);

  const getBiometricEnrolled = useCallback(() => {
    return state.isBiometricEnrolled;
  }, [state.isBiometricEnrolled]);

  const getBiometricEnabled = useCallback(() => {
    return state.settings.isBiometricEnabled;
  }, [state.settings.isBiometricEnabled]);

  const setSharingActive = useCallback(async (active: boolean) => {
    sharingActiveRef.current = active;
    if (active) {
      const now = Date.now();
      lastActiveRef.current = now;
      await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
    }
  }, []);

  const isSharingActive = useCallback(() => sharingActiveRef.current, []);

  // ─── FIXED: Save security questions with proper persistence ──────
  const saveSecurityQuestions = useCallback(async (questions: { question: string; answer: string }[]): Promise<boolean> => {
    try {
      if (questions.length !== 3) {
        console.warn('Exactly 3 security questions required');
        return false;
      }
      const hashedQuestions = await Promise.all(questions.map(async (q) => ({
        question: q.question,
        answerHash: await hashAnswer(q.answer),
      })));
      await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_QUESTIONS, JSON.stringify(hashedQuestions));
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          securityQuestions: hashedQuestions,
          settings: { ...prev.settings, hasSecurityQuestions: true },
        }));
      }
      return true;
    } catch (error) {
      console.warn('Failed to save security questions:', error);
      return false;
    }
  }, []);

  // ─── FIXED: Verify security answers ──────────────────────────────
  const verifySecurityAnswers = useCallback(async (answers: string[]): Promise<boolean> => {
    try {
      if (answers.length !== 3) return false;
      const stored = state.securityQuestions.length > 0 ? state.securityQuestions : await loadSecurityQuestions();
      if (stored.length === 0) return false;
      const results = await Promise.all(stored.map(async (sq, i) => {
        const hashed = await hashAnswer(answers[i]);
        return hashed === sq.answerHash;
      }));
      return results.every(Boolean);
    } catch {
      return false;
    }
  }, [state.securityQuestions]);

  // ─── FIXED: Load security questions from storage ──────────────────
  const loadSecurityQuestions = useCallback(async (): Promise<SecurityQuestion[]> => {
    try {
      const questionsStr = await AsyncStorage.getItem(ASYNC_KEYS.SECURITY_QUESTIONS);
      if (questionsStr) {
        const parsed = JSON.parse(questionsStr) as SecurityQuestion[];
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            securityQuestions: parsed,
            settings: { ...prev.settings, hasSecurityQuestions: parsed.length > 0 },
          }));
        }
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const clearSecurityQuestions = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(ASYNC_KEYS.SECURITY_QUESTIONS);
    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        securityQuestions: [],
        settings: { ...prev.settings, hasSecurityQuestions: false },
      }));
    }
  }, []);

  const checkHasSecurityQuestions = useCallback((): boolean => {
    return state.settings.hasSecurityQuestions && state.securityQuestions.length > 0;
  }, [state.settings.hasSecurityQuestions, state.securityQuestions]);

  const clearSecurityState = useCallback(async () => {
    await AsyncStorage.multiRemove([
      ASYNC_KEYS.SECURITY_LOCK,
      ASYNC_KEYS.LAST_ACTIVE,
      ASYNC_KEYS.MANUAL_LOCK_TIME,
      ASYNC_KEYS.SECURITY_QUESTIONS,
    ]);
    await AsyncStorage.removeItem(ASYNC_KEYS.BIOMETRIC_ENABLED);
    await AsyncStorage.removeItem(ASYNC_KEYS.APP_LOCK_ENABLED);
    await AsyncStorage.removeItem(ASYNC_KEYS.AUTO_LOCK_TIMEOUT);
    await clearBiometricCredentials();
    await clearPinOnly();
    
    lastActiveRef.current = Date.now();
    manualLockTimeRef.current = 0;
    lastUnlockTimeRef.current = 0;
    sharingActiveRef.current = false;
    unlockInProgressRef.current = false;
    securityCheckLockRef.current = false;
    biometricPromptInProgressRef.current = false;
    checkedThisCycleRef.current = false;
    lastBiometricCheckRef.current = 0;
    
    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        isSecurityLocked: false,
        securityQuestions: [],
        settings: {
          ...prev.settings,
          isBiometricEnabled: false,
          isPinEnabled: false,
          isAppLockEnabled: false,
          hasSecurityQuestions: false,
        },
      }));
    }
    console.log('🔓 Security state cleared');
  }, [clearBiometricCredentials, clearPinOnly]);

  const value = React.useMemo(() => ({
    ...state,
    checkBiometricCapabilities,
    authenticateWithBiometric,
    toggleBiometric,
    setupPin,
    verifyPin,
    changePin,
    toggleAppLock,
    updateAutoLockTimeout,
    lockApp,
    unlockApp,
    checkSecurityOnResume,
    getBiometricTypeName,
    getBiometricIcon,
    getAvailableAuthMethods,
    forceUnlock,
    setSharingActive,
    isSharingActive,
    getAvailableBiometricTypes,
    clearSecurityState,
    clearPinOnly,
    resetUnlockLock,
    saveSecurityQuestions,
    verifySecurityAnswers,
    loadSecurityQuestions,
    clearSecurityQuestions,
    checkHasSecurityQuestions,
    getStoredBiometricCredentials,
    saveBiometricCredentials,
    clearBiometricCredentials,
    refreshBiometricStatus,
    getBiometricHardwareAvailable,
    getBiometricEnrolled,
    getBiometricEnabled,
    isAppLocked: state.isSecurityLocked,
  }), [
    state,
    checkBiometricCapabilities,
    authenticateWithBiometric,
    toggleBiometric,
    setupPin,
    verifyPin,
    changePin,
    toggleAppLock,
    updateAutoLockTimeout,
    lockApp,
    unlockApp,
    checkSecurityOnResume,
    getBiometricTypeName,
    getBiometricIcon,
    getAvailableAuthMethods,
    forceUnlock,
    setSharingActive,
    isSharingActive,
    getAvailableBiometricTypes,
    clearSecurityState,
    clearPinOnly,
    resetUnlockLock,
    saveSecurityQuestions,
    verifySecurityAnswers,
    loadSecurityQuestions,
    clearSecurityQuestions,
    checkHasSecurityQuestions,
    getStoredBiometricCredentials,
    saveBiometricCredentials,
    clearBiometricCredentials,
    refreshBiometricStatus,
    getBiometricHardwareAvailable,
    getBiometricEnrolled,
    getBiometricEnabled,
  ]);

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('useSecurity must be used within SecurityProvider');
  return context;
};

export default SecurityProvider;