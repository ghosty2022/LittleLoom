// src/context/SecurityContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
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
  SHARING_ACTIVE: 'littleloom_sharing_active',
  NAVIGATION_LOCKED: 'littleloom_navigation_locked',
} as const;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
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
      return false;
    }
  },
};

// Biometric type configuration interface
export interface BiometricTypeConfig {
  type: LocalAuthentication.AuthenticationType;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface SecuritySettings {
  isBiometricEnabled: boolean;
  isPinEnabled: boolean;
  isAppLockEnabled: boolean;
  autoLockTimeout: number;
  availableAuthTypes: LocalAuthentication.AuthenticationType[];
  biometricTypeName: string;
  securityLevel: LocalAuthentication.SecurityLevel;
}

interface SecurityState {
  isLoading: boolean;
  isSecurityLocked: boolean;
  settings: SecuritySettings;
  isBiometricHardwareAvailable: boolean;
  isBiometricEnrolled: boolean;
  availableBiometricTypes: BiometricTypeConfig[];
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
};

// Helper function to get all biometric configurations
const getBiometricConfigs = (types: LocalAuthentication.AuthenticationType[]): BiometricTypeConfig[] => {
  const configs: BiometricTypeConfig[] = [];
  
  if (!types || !Array.isArray(types)) return configs;
  
  types.forEach(type => {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        configs.push({
          type,
          name: 'Face ID',
          icon: 'scan-outline',
          description: 'Use your face to unlock',
          color: '#667eea',
        });
        break;
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        configs.push({
          type,
          name: 'Fingerprint',
          icon: 'finger-print',
          description: 'Use your fingerprint to unlock',
          color: '#43e97b',
        });
        break;
      case LocalAuthentication.AuthenticationType.IRIS:
        configs.push({
          type,
          name: 'Iris Scan',
          icon: 'eye',
          description: 'Use your eyes to unlock',
          color: '#ffa502',
        });
        break;
    }
  });
  
  return configs;
};

// Helper to get primary biometric type name
const getPrimaryBiometricName = (types: LocalAuthentication.AuthenticationType[]): string => {
  if (!types || types.length === 0) return 'Biometric';
  
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris Scan';
  }
  return 'Biometric';
};

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Resolve AuthContext at runtime to avoid circular dependency
  let auth: any;
  try {
    const AuthModule = require('./AuthContext');
    auth = AuthModule.useAuth();
  } catch (e) {
    auth = {
      isAuthenticated: false,
      setupComplete: false,
      setSetupCompleteCallback: () => {},
      isAppActive: () => true,
    };
  }
  
  const { isAuthenticated, setupComplete, setSetupCompleteCallback, isAppActive } = auth;
  
  const [state, setState] = useState<SecurityState>({
    isLoading: true,
    isSecurityLocked: false,
    settings: defaultSettings,
    isBiometricHardwareAvailable: false,
    isBiometricEnrolled: false,
    availableBiometricTypes: [],
  });

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isMounted = useRef(true);
  const lastActiveRef = useRef<number>(Date.now());
  const sharingActiveRef = useRef<boolean>(false);
  const unlockInProgressRef = useRef<boolean>(false);
  const securityCheckLockRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Register forceUnlock as the setup complete callback
  useEffect(() => {
    if (setSetupCompleteCallback) {
      setSetupCompleteCallback(forceUnlock);
    }
    
    return () => {
      if (setSetupCompleteCallback) {
        setSetupCompleteCallback(null);
      }
    };
  }, [setSetupCompleteCallback]);

  // Initialize security state
  useEffect(() => {
    const initSecurity = async () => {
      try {
        const [
          biometricEnabled,
          pinHash,
          appLockEnabled,
          autoLockTimeout,
          securityLocked,
        ] = await Promise.all([
          AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
          secureStorage.getItem(SECURE_KEYS.PIN_HASH),
          AsyncStorage.getItem(ASYNC_KEYS.APP_LOCK_ENABLED),
          AsyncStorage.getItem(ASYNC_KEYS.AUTO_LOCK_TIMEOUT),
          AsyncStorage.getItem(ASYNC_KEYS.SECURITY_LOCK),
        ]);

        const hasPin = !!pinHash;
        const isAppLockEnabled = appLockEnabled === 'true';
        const hasSecurityEnabled = (biometricEnabled === 'true') || hasPin || isAppLockEnabled;

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            isSecurityLocked: (securityLocked === 'true') && hasSecurityEnabled,
            settings: {
              ...prev.settings,
              isBiometricEnabled: biometricEnabled === 'true',
              isPinEnabled: hasPin,
              isAppLockEnabled: isAppLockEnabled,
              autoLockTimeout: parseInt(autoLockTimeout || '5', 10),
            },
          }));
        }

        await checkBiometricCapabilities();
      } catch (error) {
        if (isMounted.current) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    if (isAuthenticated) {
      initSecurity();
    } else {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [isAuthenticated]);

  // AppState handling - prevents lock during sharing
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('🔒 Security AppState:', appState.current, '->', nextAppState);
      
      // App coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Don't check security immediately if sharing was active
        if (sharingActiveRef.current) {
          console.log('📤 Sharing was active, deferring security check');
          sharingActiveRef.current = false;
          await AsyncStorage.setItem(ASYNC_KEYS.SHARING_ACTIVE, 'false');
          
          const now = Date.now();
          lastActiveRef.current = now;
          await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
          
          appState.current = nextAppState;
          return;
        }

        setTimeout(async () => {
          if (isMounted.current && isAppActive()) {
            await checkSecurityOnResume();
          }
        }, 500);
      }
      
      // App going to background - update last active time
      if (nextAppState.match(/inactive|background/) && appState.current === 'active') {
        console.log('🔒 App going to background, saving last active time');
        const now = Date.now();
        lastActiveRef.current = now;
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
      }
      
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAppActive]);

  // Update last active periodically while app is active
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isAuthenticated && !state.isSecurityLocked && appState.current === 'active' && !sharingActiveRef.current) {
        const now = Date.now();
        lastActiveRef.current = now;
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, state.isSecurityLocked]);

  const checkBiometricCapabilities = useCallback(async () => {
    try {
      // Safety check for module availability
      if (!LocalAuthentication || !LocalAuthentication.hasHardwareAsync) {
        console.log('LocalAuthentication module not available');
        return;
      }

      const [hasHardware, isEnrolled, types, securityLevel] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync ? 
          LocalAuthentication.supportedAuthenticationTypesAsync() : 
          Promise.resolve([]),
        LocalAuthentication.getEnrolledLevelAsync ? 
          LocalAuthentication.getEnrolledLevelAsync() : 
          Promise.resolve(LocalAuthentication.SecurityLevel.NONE),
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
    } catch (error) {
      console.error('Biometric check failed:', error);
    }
  }, []);

  const authenticateWithBiometric = useCallback(async (promptMessage?: string) => {
    if (unlockInProgressRef.current) {
      return { success: false, error: 'in_progress' };
    }

    // Safety check
    if (!LocalAuthentication || !LocalAuthentication.authenticateAsync) {
      return { success: false, error: 'not_available' };
    }

    unlockInProgressRef.current = true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || `Authenticate with ${state.settings.biometricTypeName}`,
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      return result;
    } catch (error) {
      return { success: false, error: 'unknown' };
    } finally {
      setTimeout(() => {
        unlockInProgressRef.current = false;
      }, 1000);
    }
  }, [state.settings.biometricTypeName]);

  const toggleBiometric = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (enabled) {
      const result = await authenticateWithBiometric('Confirm to enable biometric unlock');
      if (result.success) {
        await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'true');
        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            settings: { ...prev.settings, isBiometricEnabled: true },
          }));
        }
        return true;
      }
      return false;
    } else {
      await AsyncStorage.setItem(ASYNC_KEYS.BIOMETRIC_ENABLED, 'false');
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, isBiometricEnabled: false },
        }));
      }
      return true;
    }
  }, [authenticateWithBiometric]);

  const hashPin = async (pin: string): Promise<string> => {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin + 'littleloom_salt_v1'
    );
  };

  const setupPin = useCallback(async (pin: string): Promise<boolean> => {
    if (pin.length < 4 || pin.length > 6) {
      Alert.alert('Invalid PIN', 'PIN must be 4-6 digits');
      return false;
    }
    const hashedPin = await hashPin(pin);
    await secureStorage.setItem(SECURE_KEYS.PIN_HASH, hashedPin);
    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, isPinEnabled: true },
      }));
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
      Alert.alert('Error', 'Current PIN is incorrect');
      return false;
    }
    return await setupPin(newPin);
  }, [verifyPin, setupPin]);

  const toggleAppLock = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(ASYNC_KEYS.APP_LOCK_ENABLED, enabled ? 'true' : 'false');
    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, isAppLockEnabled: enabled },
      }));
    }
  }, []);

  const updateAutoLockTimeout = useCallback(async (minutes: number) => {
    await AsyncStorage.setItem(ASYNC_KEYS.AUTO_LOCK_TIMEOUT, minutes.toString());
    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, autoLockTimeout: minutes },
      }));
    }
  }, []);

  const lockApp = useCallback(async () => {
    const hasSecurity = state.settings.isBiometricEnabled || 
                       state.settings.isPinEnabled || 
                       state.settings.isAppLockEnabled;
    
    if (!hasSecurity) {
      Alert.alert('No Security Enabled', 'Please enable PIN or Biometric lock first.');
      return;
    }

    await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_LOCK, 'true');
    await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, Date.now().toString());
    if (isMounted.current) {
      setState(prev => ({ ...prev, isSecurityLocked: true }));
    }
  }, [state.settings]);

  const unlockApp = useCallback(async (method: 'biometric' | 'pin', data?: string): Promise<boolean> => {
    if (unlockInProgressRef.current) {
      console.log('⚠️ Unlock already in progress');
      return false;
    }

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
        if (isMounted.current) {
          setState(prev => ({ ...prev, isSecurityLocked: false }));
        }
        return true;
      }
      return false;
    } finally {
      setTimeout(() => {
        unlockInProgressRef.current = false;
      }, 500);
    }
  }, [authenticateWithBiometric, verifyPin]);

  const forceUnlock = useCallback(async () => {
    await AsyncStorage.setItem(ASYNC_KEYS.SECURITY_LOCK, 'false');
    await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, Date.now().toString());
    if (isMounted.current) {
      setState(prev => ({ ...prev, isSecurityLocked: false }));
    }
    console.log('🔓 Force unlocked for setup flow');
  }, []);

  // Check security on resume with debouncing
  const checkSecurityOnResume = useCallback(async () => {
    if (securityCheckLockRef.current) {
      console.log('⚠️ Security check already in progress');
      return;
    }

    if (!isAuthenticated) {
      console.log('🔒 Not authenticated, skipping security check');
      return;
    }
    
    if (!setupComplete) {
      console.log('⏸️ Setup not complete, skipping security check');
      return;
    }

    const sharingActive = await AsyncStorage.getItem(ASYNC_KEYS.SHARING_ACTIVE);
    if (sharingActive === 'true') {
      console.log('📤 Sharing active, skipping security check');
      return;
    }
    
    securityCheckLockRef.current = true;

    try {
      const [appLockEnabled, lastActiveStr, biometricEnabled, pinEnabled] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEYS.APP_LOCK_ENABLED),
        AsyncStorage.getItem(ASYNC_KEYS.LAST_ACTIVE),
        AsyncStorage.getItem(ASYNC_KEYS.BIOMETRIC_ENABLED),
        secureStorage.getItem(SECURE_KEYS.PIN_HASH),
      ]);

      const isAppLockEnabled = appLockEnabled === 'true';
      const hasBiometric = biometricEnabled === 'true';
      const hasPin = !!pinEnabled;
      const hasSecurityEnabled = isAppLockEnabled || hasBiometric || hasPin;
      
      console.log('🔒 Security check:', { isAppLockEnabled, hasBiometric, hasPin, hasSecurityEnabled });
      
      if (!hasSecurityEnabled) {
        console.log('🔒 No security enabled, skipping lock');
        securityCheckLockRef.current = false;
        return;
      }

      const isLocked = await AsyncStorage.getItem(ASYNC_KEYS.SECURITY_LOCK);
      if (isLocked === 'true') {
        console.log('🔒 Already locked');
        if (isMounted.current) {
          setState(prev => ({ ...prev, isSecurityLocked: true }));
        }
        securityCheckLockRef.current = false;
        return;
      }

      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : lastActiveRef.current;
      const timeout = state.settings.autoLockTimeout * 60 * 1000;
      const timeSinceLastActive = Date.now() - lastActive;
      
      console.log('🔒 Timeout check:', { timeSinceLastActive, timeout });
      
      if (timeSinceLastActive > timeout) {
        console.log('🔒 Timeout exceeded, locking app');
        await lockApp();
      } else {
        const now = Date.now();
        lastActiveRef.current = now;
        await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
      }
    } catch (error) {
      console.error('🔒 Security check error:', error);
    } finally {
      securityCheckLockRef.current = false;
    }
  }, [isAuthenticated, setupComplete, state.settings.autoLockTimeout, lockApp]);

  const getBiometricTypeName = useCallback(() => {
    return state.settings.biometricTypeName;
  }, [state.settings.biometricTypeName]);

  const getAvailableAuthMethods = useCallback(() => {
    return {
      hasBiometric: state.settings.isBiometricEnabled && state.isBiometricHardwareAvailable && state.isBiometricEnrolled,
      hasPin: state.settings.isPinEnabled,
    };
  }, [state.settings.isBiometricEnabled, state.settings.isPinEnabled, state.isBiometricHardwareAvailable, state.isBiometricEnrolled]);

  const setSharingActive = useCallback(async (active: boolean) => {
    sharingActiveRef.current = active;
    await AsyncStorage.setItem(ASYNC_KEYS.SHARING_ACTIVE, active ? 'true' : 'false');
    
    if (active) {
      const now = Date.now();
      lastActiveRef.current = now;
      await AsyncStorage.setItem(ASYNC_KEYS.LAST_ACTIVE, now.toString());
    }
    
    console.log('📤 Sharing active:', active);
  }, []);

  const isSharingActive = useCallback(() => {
    return sharingActiveRef.current;
  }, []);

  const getAvailableBiometricTypes = useCallback(async (): Promise<BiometricTypeConfig[]> => {
    try {
      // Safety check
      if (!LocalAuthentication || !LocalAuthentication.hasHardwareAsync) {
        return [];
      }

      const [hasHardware, isEnrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync ? 
          LocalAuthentication.supportedAuthenticationTypesAsync() : 
          Promise.resolve([]),
      ]);

      if (!hasHardware || !isEnrolled) return [];
      
      return getBiometricConfigs(types);
    } catch (error) {
      console.error('Error getting biometric types:', error);
      return [];
    }
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
  }), [state, checkBiometricCapabilities, authenticateWithBiometric, toggleBiometric, setupPin, verifyPin, changePin, toggleAppLock, updateAutoLockTimeout, lockApp, unlockApp, checkSecurityOnResume, getBiometricTypeName, getAvailableAuthMethods, forceUnlock, setSharingActive, isSharingActive, getAvailableBiometricTypes]);

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