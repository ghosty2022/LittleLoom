// src/hooks/useSecurity.ts
// Safe wrapper — inlines a minimal fallback so early-mounting
// components don't crash with "must be used within SecurityProvider".

import { useContext } from 'react';
import { SecurityContext } from '../context/SecurityContext';

function getFallbackSecurity() {
  return {
    isLoading: true,
    isSecurityLocked: false,
    isAppLocked: false,
    settings: {
      isBiometricEnabled: false,
      isPinEnabled: false,
      isAppLockEnabled: false,
      autoLockTimeout: 5,
      availableAuthTypes: [],
      biometricTypeName: 'Biometric',
      securityLevel: 0,
      hasSecurityQuestions: false,
    },
    isBiometricHardwareAvailable: false,
    isBiometricEnrolled: false,
    availableBiometricTypes: [],
    securityQuestions: [],
    checkBiometricCapabilities: async () => {},
    authenticateWithBiometric: async () => ({ success: false, error: 'not_available' }),
    toggleBiometric: async () => false,
    setupPin: async () => false,
    verifyPin: async () => false,
    changePin: async () => false,
    toggleAppLock: async () => {},
    updateAutoLockTimeout: async () => {},
    lockApp: async () => {},
    unlockApp: async () => false,
    checkSecurityOnResume: async () => {},
    getBiometricTypeName: () => 'Biometric',
    getBiometricIcon: () => 'finger-print',
    getAvailableAuthMethods: () => ({ hasBiometric: false, hasPin: false }),
    forceUnlock: async () => {},
    setSharingActive: async () => {},
    isSharingActive: () => false,
    getAvailableBiometricTypes: async () => [],
    clearSecurityState: async () => {},
    clearPinOnly: async () => {},
    resetUnlockLock: () => {},
    saveSecurityQuestions: async () => false,
    verifySecurityAnswers: async () => false,
    loadSecurityQuestions: async () => [],
    clearSecurityQuestions: async () => {},
    checkHasSecurityQuestions: () => false,
    getStoredBiometricCredentials: async () => null,
    saveBiometricCredentials: async () => false,
    clearBiometricCredentials: async () => {},
    refreshBiometricStatus: async () => {},
    getBiometricHardwareAvailable: () => false,
    getBiometricEnrolled: () => false,
    getBiometricEnabled: () => false,
    readBiometricEnabledFromStorage: async () => false,
    getSecuritySnapshot: () => ({
      hasAnySecurity: false,
      hasBiometric: false,
      hasPin: false,
    }),
  };
}

export function useSecurity() {
  try {
    const context = useContext(SecurityContext);
    if (!context) return getFallbackSecurity() as any;
    return context;
  } catch {
    return getFallbackSecurity() as any;
  }
}

export default useSecurity;