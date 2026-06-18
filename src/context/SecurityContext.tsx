import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

const SECURE_KEYS = {
  PIN_HASH: 'littleloom_pin_hash',
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
  description: string;
  color: string;
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
  lockApp: () => Promise<void>;
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
  hasSecurityQuestions: () => boolean;
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
  const configs: BiometricTypeConfig[] = [];
  if (!types || !Array.isArray(types)) return configs;
  types.forEach(type => {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        configs.push({ type, name: 'Face ID', icon: 'scan-outline', description: 'Use your face to unlock', color: '#667eea' });
        break;
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        configs.push({ type, name: 'Fingerprint', icon: 'finger-print', description: 'Use your fingerprint to unlock', color: '#43e97b' });
        break;
      case LocalAuthentication.AuthenticationType.IRIS:
        configs.push({ type, name: 'Iris Scan', icon: 'eye', description: 'Use your eyes to unlock', color: '#ffa502' });
        break;
    }
  });
  return configs;
};

const getPrimaryBiometricName = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (!types || types.length === 0) return 'Biometric';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris Scan';
  return 'Biometric';
};

// ─── Hashing Utilities (top-level, no hook dependency) ─────────────────
const hashPin = async (pin: string): Promise<string> => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + 'littleloom_salt_v1');
};

const hashAnswer = async (answer: string): Promise<string> => {
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

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isMounted = useRef(true);
  const lastActiveRef = useRef<number>(Date.now());
  const sharingActiveRef = useRef<boolean>(false);
  const unlockInProgressRef = useRef<boolean>(false);
  const securityCheckLockRef = useRef<boolean>(false);
  const manualLockTimeRef = useRef<number>(0);
  const biometricPromptInProgressRef = useRef<boolean>(false);
  const lastUnlockTimeRef = useRef<number>(0);
  const backgroundTimeRef = useRef<number>(0);
  const checkedThisCycleRef = useRef<boolean>(false);

  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    const initSecurity = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const [
          biometricEnabled, pinHash, appLockEnabled, autoLockTimeout,
          securityLocked, securityQuestionsStr,
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
        const hasSecurityEnabled = (biometricEnabled === 'true') || hasPin || isAppLockEnabled;

        let securityQuestions: SecurityQuestion[] = [];
        let hasQuestions = false;
        if (securityQuestionsStr) {
          try {
            securityQuestions = JSON.parse(securityQuestionsStr);
            hasQuestions = securityQuestions.length > 0;
          } catch {}
        }

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            isSecurityLocked: (securityLocked === 'true') && hasSecurityEnabled,
            securityQuestions,
            settings: {
              ...prev.settings,
              isBiometricEnabled: biometricEnabled === 'true',
              isPinEnabled: hasPin,
              isAppLockEnabled,
              autoLockTimeout: parseInt(autoLockTimeout || '5', 10),
              hasSecurityQuestions: hasQuestions,
            },
          }));
        }
        await checkBiometricCapabilities();
      } catch {
        if (isMounted.current) setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    if (isAuthenticated) initSecurity();
    else if (isMounted.current) setState(prev => ({ ...prev, isLoading: false }));
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = appState.current;
      if (nextAppState.match(/inactive|background/) && previousState === 'active') {
        backgroundTimeRef.current = Date.now();
        lastActiveRef.current = Date.now();
        checkedThisCycleRef.current = false;
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, lastActiveRef.current.toString());
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isAuthenticated && !state.isSecurityLocked && appState.current === 'active' && !sharingActiveRef.current) {
        lastActiveRef.current = Date.now();
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, lastActiveRef.current.toString());
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated, state.isSecurityLocked]);

  const checkBiometricCapabilities = useCallback(async () => {
    try {
      if (!LocalAuthentication || !LocalAuthentication.hasHardwareAsync) return;
      const [hasHardware, isEnrolled, types, securityLevel] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync?.() ?? Promise.resolve([]),
        LocalAuthentication.getEnrolledLevelAsync?.() ?? Promise.resolve(LocalAuthentication.SecurityLevel.NONE),
      ]);
      const biometricConfigs = getBiometricConfigs(types);
      const primaryName = getPrimaryBiometricName(types);
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isBiometricHardwareAvailable: hasHardware,
          isBiometricEnrolled: isEnrolled,
          availableBiometricTypes: biometricConfigs,
          settings: {
            ...prev.settings,
            availableAuthTypes: types,
            biometricTypeName: primaryName,
            securityLevel,
          },
        }));
      }
    } catch (error) { console.error('Biometric check failed:', error); }
  }, []);

  const authenticateWithBiometric = useCallback(async (promptMessage?: string) => {
    if (biometricPromptInProgressRef.current) return { success: false, error: 'in_progress' };
    if (!LocalAuthentication?.authenticateAsync) return { success: false, error: 'not_available' };
    biometricPromptInProgressRef.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Authenticate with ${state.settings.biometricTypeName}`,
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      return result;
    } catch { return { success: false, error: 'unknown' }; }
    finally { setTimeout(() => { biometricPromptInProgressRef.current = false; }, 2000); }
  }, [state.settings.biometricTypeName]);

  const toggleBiometric = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (enabled) {
      const result = await authenticateWithBiometric('Confirm to enable biometric unlock');
      if (result.success) {
        await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'true');
        if (isMounted.current) setState(prev => ({ ...prev, settings: { ...prev.settings, isBiometricEnabled: true } }));
        return true;
      }
      return false;
    } else {
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'false');
      if (isMounted.current) setState(prev => ({ ...prev, settings: { ...prev.settings, isBiometricEnabled: false } }));
      return true;
    }
  }, [authenticateWithBiometric]);

  const setupPin = useCallback(async (pin: string): Promise<boolean> => {
    if (pin.length < 4 || pin.length > 6) { console.warn('Invalid PIN: must be 4-6 digits'); return false; }
    const hashedPin = await hashPin(pin);
    await secureStorage.setItem(SECURE_KEYS.PIN_HASH, hashedPin);
    if (isMounted.current) setState(prev => ({ ...prev, settings: { ...prev.settings, isPinEnabled: true } }));
    return true;
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const hashedPin = await hashPin(pin);
    const storedHash = await secureStorage.getItem(SECURE_KEYS.PIN_HASH);
    return hashedPin === storedHash;
  }, []);

  const changePin = useCallback(async (oldPin: string, newPin: string): Promise<boolean> => {
    const isValid = await verifyPin(oldPin);
    if (!isValid) { console.warn('Current PIN is incorrect'); return false; }
    return await setupPin(newPin);
  }, [verifyPin, setupPin]);

  const toggleAppLock = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(ASYNC_KEYS.APP_LOCK_ENABLED, enabled ? 'true' : 'false');
    if (isMounted.current) setState(prev => ({ ...prev, settings: { ...prev.settings, isAppLockEnabled: enabled } }));
  }, []);

  const updateAutoLockTimeout = useCallback(async (minutes: number) => {
    await AsyncStorage.setItem(ASYNC_KEYS.AUTO_LOCK_TIMEOUT, minutes.toString());
    if (isMounted.current) setState(prev => ({ ...prev, settings: { ...prev.settings, autoLockTimeout: minutes } }));
  }, []);

  const lockApp = useCallback(async () => {
    const hasSecurity = state.settings.isBiometricEnabled || state.settings.isPinEnabled || state.settings.isAppLockEnabled;
    if (!hasSecurity) { console.warn('No security enabled'); return; }
    manualLockTimeRef.current = Date.now();
    await AsyncStorage.setItem(ASYNC_KEYS.MANUAL_LOCK_TIME, manualLockTimeRef.current.toString());
    await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_LOCK, 'true');
    await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, Date.now().toString());
    if (isMounted.current) setState(prev => ({ ...prev, isSecurityLocked: true }));
    console.log('🔒 App manually locked');
  }, [state.settings]);

  const unlockApp = useCallback(async (method: 'biometric' | 'pin', data?: string): Promise<boolean> => {
    if (unlockInProgressRef.current) { console.log('⚠️ Unlock already in progress'); return false; }
    unlockInProgressRef.current = true;
    let isValid = false;
    try {
      if (method === 'biometric') {
        const result = await authenticateWithBiometric();
        isValid = result.success;
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
        if (isMounted.current) setState(prev => ({ ...prev, isSecurityLocked: false }));
        return true;
      }
      return false;
    } finally {
      setTimeout(() => { unlockInProgressRef.current = false; }, 200);
    }
  }, [authenticateWithBiometric, verifyPin]);

  const forceUnlock = useCallback(async () => {
    await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_LOCK, 'false');
    await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, Date.now().toString());
    manualLockTimeRef.current = 0;
    lastUnlockTimeRef.current = Date.now();
    checkedThisCycleRef.current = true;
    await AsyncStorage.removeItem(ASYNC_KEYS.MANUAL_LOCK_TIME);
    if (isMounted.current) setState(prev => ({ ...prev, isSecurityLocked: false }));
    console.log('🔓 Force unlocked');
  }, []);

  const resetUnlockLock = useCallback(() => {
    unlockInProgressRef.current = false;
    biometricPromptInProgressRef.current = false;
    securityCheckLockRef.current = false;
    console.log('🔓 Reset all security locks');
  }, []);

  const checkSecurityOnResume = useCallback(async () => {
    if (securityCheckLockRef.current) { console.log('⚠️ Security check already in progress'); return; }
    if (!isAuthenticated) { console.log('🔒 Not authenticated, skipping'); return; }
    if (!setupComplete) { console.log('⏸️ Setup not complete, skipping'); return; }
    if (checkedThisCycleRef.current) { console.log('🔓 Already checked this cycle'); return; }

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

      console.log('🔒 Security check:', { hasBiometric, hasPin, isAppLockEnabled, hasSecurityEnabled });

      if (!hasSecurityEnabled) { console.log('🔒 No security enabled'); checkedThisCycleRef.current = true; return; }

      if (isLocked === 'true') {
        console.log('🔒 Already locked');
        if (isMounted.current) setState(prev => ({ ...prev, isSecurityLocked: true }));
        checkedThisCycleRef.current = true;
        return;
      }

      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : lastActiveRef.current;
      const timeout = state.settings.autoLockTimeout * 60 * 1000;
      const timeSinceLastActive = Date.now() - lastActive;

      console.log('🔒 Timeout check:', { timeSinceLastActive, timeout, minutes: Math.round(timeSinceLastActive / 60000) });

      if (timeSinceLastActive > timeout) {
        console.log('🔒 Timeout exceeded, locking app');
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
  }, [isAuthenticated, setupComplete, state.settings.autoLockTimeout, lockApp]);

  const getBiometricTypeName = useCallback(() => state.settings.biometricTypeName, [state.settings.biometricTypeName]);

  const getAvailableAuthMethods = useCallback(() => ({
    hasBiometric: state.settings.isBiometricEnabled && state.isBiometricHardwareAvailable && state.isBiometricEnrolled,
    hasPin: state.settings.isPinEnabled,
  }), [state.settings.isBiometricEnabled, state.settings.isPinEnabled, state.isBiometricHardwareAvailable, state.isBiometricEnrolled]);

  const setSharingActive = useCallback(async (active: boolean) => {
    sharingActiveRef.current = active;
    if (active) {
      const now = Date.now();
      lastActiveRef.current = now;
      await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
    }
    console.log('📤 Sharing active:', active);
  }, []);

  const isSharingActive = useCallback(() => sharingActiveRef.current, []);

  const getAvailableBiometricTypes = useCallback(async (): Promise<BiometricTypeConfig[]> => {
    try {
      if (!LocalAuthentication?.hasHardwareAsync) return [];
      const [hasHardware, isEnrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync?.() ?? Promise.resolve([]),
      ]);
      if (!hasHardware || !isEnrolled) return [];
      return getBiometricConfigs(types);
    } catch { return []; }
  }, []);

  const saveSecurityQuestions = useCallback(async (questions: { question: string; answer: string }[]): Promise<boolean> => {
    try {
      if (questions.length !== 3) { console.warn('Exactly 3 security questions required'); return false; }
      const hashedQuestions = await Promise.all(questions.map(async (q) => ({
        question: q.question,
        answerHash: await hashAnswer(q.answer),
      })));
      await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_QUESTIONS, JSON.stringify(hashedQuestions));
      if (isMounted.current) setState(prev => ({
        ...prev, securityQuestions: hashedQuestions,
        settings: { ...prev.settings, hasSecurityQuestions: true },
      }));
      return true;
    } catch { console.warn('Failed to save security questions'); return false; }
  }, []);

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
    } catch { return false; }
  }, [state.securityQuestions]);

  const loadSecurityQuestions = useCallback(async (): Promise<SecurityQuestion[]> => {
    try {
      const questionsStr = await AsyncStorage.getItem(ASYNC_KEYS.SECURITY_QUESTIONS);
      if (questionsStr) {
        const parsed = JSON.parse(questionsStr) as SecurityQuestion[];
        if (isMounted.current) setState(prev => ({
          ...prev, securityQuestions: parsed,
          settings: { ...prev.settings, hasSecurityQuestions: parsed.length > 0 },
        }));
        return parsed;
      }
      return [];
    } catch { return []; }
  }, []);

  const clearSecurityQuestions = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(ASYNC_KEYS.SECURITY_QUESTIONS);
    if (isMounted.current) setState(prev => ({
      ...prev, securityQuestions: [],
      settings: { ...prev.settings, hasSecurityQuestions: false },
    }));
  }, []);

  const hasSecurityQuestions = useCallback((): boolean => {
    return state.settings.hasSecurityQuestions && state.securityQuestions.length > 0;
  }, [state.settings.hasSecurityQuestions, state.securityQuestions]);

  const clearSecurityState = useCallback(async () => {
    await AsyncStorage.multiRemove([
      ASYNC_KEYS.SECURITY_LOCK, ASYNC_KEYS.LAST_ACTIVE,
      ASYNC_KEYS.MANUAL_LOCK_TIME, ASYNC_KEYS.SECURITY_QUESTIONS,
    ]);
    lastActiveRef.current = Date.now();
    manualLockTimeRef.current = 0;
    lastUnlockTimeRef.current = 0;
    sharingActiveRef.current = false;
    unlockInProgressRef.current = false;
    securityCheckLockRef.current = false;
    biometricPromptInProgressRef.current = false;
    checkedThisCycleRef.current = false;
    if (isMounted.current) setState(prev => ({
      ...prev, isSecurityLocked: false, securityQuestions: [],
      settings: { ...prev.settings, isBiometricEnabled: false, isPinEnabled: false, isAppLockEnabled: false, hasSecurityQuestions: false },
    }));
    console.log('🔓 Security state cleared');
  }, []);

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
    getAvailableAuthMethods,
    forceUnlock,
    setSharingActive,
    isSharingActive,
    getAvailableBiometricTypes,
    clearSecurityState,
    resetUnlockLock,
    saveSecurityQuestions,
    verifySecurityAnswers,
    loadSecurityQuestions,
    clearSecurityQuestions,
    hasSecurityQuestions,
  }), [state, checkBiometricCapabilities, authenticateWithBiometric, toggleBiometric, setupPin, verifyPin, changePin, toggleAppLock, updateAutoLockTimeout, lockApp, unlockApp, checkSecurityOnResume, getBiometricTypeName, getAvailableAuthMethods, forceUnlock, setSharingActive, isSharingActive, getAvailableBiometricTypes, clearSecurityState, resetUnlockLock, saveSecurityQuestions, verifySecurityAnswers, loadSecurityQuestions, clearSecurityQuestions, hasSecurityQuestions]);

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