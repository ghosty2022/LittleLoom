// src/hooks/useVaultUnlock.ts
// ═══════════════════════════════════════════════════════════════════════════
// Vault unlock hook — works with biometric AND/OR PIN AND/OR app lock.
//
// Behaviour:
//   • unlock() prompts biometric first; falls back to PIN if biometric fails
//   • If NO security is configured at all, refuses and tells user to set up
//   • Auto-relocks after `relockAfterMs` of inactivity (default 60s)
//   • Auto-relocks when app backgrounds
//   • Exposes lock() for manual relock
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSecurity } from '../context/SecurityContext';
import { useSweetAlert } from '../components/SweetAlert';

const RELOCK_AFTER_MS = 60_000; // 60s of inactivity → re-lock

export interface VaultUnlockState {
  /** True while the vault is currently unlocked in memory. */
  isUnlocked: boolean;
  /** True while a biometric/PIN prompt is showing. */
  isAuthenticating: boolean;
  /** True if the device has *any* security configured (biometric, PIN, or app lock). */
  hasAnySecurity: boolean;
  /** True if biometric hardware is available + enrolled. */
  hasBiometric: boolean;
  /** True if a PIN has been set up. */
  hasPin: boolean;

  /** Prompt the user to unlock. Returns true on success. */
  unlock: (reason?: string) => Promise<boolean>;
  /** Lock the vault immediately (e.g. when leaving the tab). */
  lock: () => void;
  /** Refresh "has any security" from fresh storage. */
  refreshSecurityStatus: () => Promise<void>;
}

export const useVaultUnlock = (): VaultUnlockState => {
  const security = useSecurity();
  const sweetAlert = useSweetAlert();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasAnySecurity, setHasAnySecurity] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const relockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Refresh security status from fresh storage ──────────────────── */
  const refreshSecurityStatus = useCallback(async () => {
    try {
      const [bioEnabled, pinEnabled, appLockEnabled] = await Promise.all([
        // Read FRESH — never trust closures
        security.readBiometricEnabledFromStorage?.() ?? Promise.resolve(false),
        Promise.resolve(security.settings.isPinEnabled),
        Promise.resolve(security.settings.isAppLockEnabled),
      ]);

      const bioHw = security.isBiometricHardwareAvailable && security.isBiometricEnrolled;

      setHasBiometric(bioHw && bioEnabled);
      setHasPin(Boolean(pinEnabled));
      setHasAnySecurity(Boolean(bioEnabled || pinEnabled || appLockEnabled));
    } catch {
      setHasAnySecurity(false);
      setHasBiometric(false);
      setHasPin(false);
    }
  }, [security]);

  /* ─── Initial refresh ─────────────────────────────────────────────── */
  useEffect(() => {
    refreshSecurityStatus();
  }, [refreshSecurityStatus]);

  /* ─── Auto-relock timer ───────────────────────────────────────────── */
  const scheduleRelock = useCallback(() => {
    if (relockTimerRef.current) clearTimeout(relockTimerRef.current);
    relockTimerRef.current = setTimeout(() => {
      if (isUnlocked) {
        if (__DEV__) console.log('[Vault] Auto-relocked (inactivity)');
        setIsUnlocked(false);
      }
    }, RELOCK_AFTER_MS);
  }, [isUnlocked]);

  const lock = useCallback(() => {
    if (relockTimerRef.current) {
      clearTimeout(relockTimerRef.current);
      relockTimerRef.current = null;
    }
    if (isUnlocked) {
      if (__DEV__) console.log('[Vault] Manually locked');
      setIsUnlocked(false);
    }
  }, [isUnlocked]);

  /* ─── AppState listener: lock on background ───────────────────────── */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next.match(/inactive|background/)) {
        lock();
      }
    });
    return () => sub.remove();
  }, [lock]);

  /* ─── Cleanup on unmount ──────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (relockTimerRef.current) clearTimeout(relockTimerRef.current);
    };
  }, []);

  /* ─── Main unlock flow ────────────────────────────────────────────── */
  const unlock = useCallback(
    async (reason: string = 'Unlock Private Vault'): Promise<boolean> => {
      if (isUnlocked) return true;
      if (isAuthenticating) return false;

      // Refresh status first — user may have just enabled biometric in settings
      await refreshSecurityStatus();

      const bioAvailable =
        hasBiometric && security.isBiometricHardwareAvailable && security.isBiometricEnrolled;
      const pinAvailable = hasPin;

      if (!bioAvailable && !pinAvailable) {
        sweetAlert(
          'Vault Locked',
          'Enable biometrics or set a PIN in Settings → Security to use the private vault.',
          'info'
        );
        return false;
      }

      setIsAuthenticating(true);

      try {
        // 1) Try biometric first if available
        if (bioAvailable) {
          const result = await security.authenticateWithBiometric(reason);
          if (result.success) {
            setIsUnlocked(true);
            lastActivityRef.current = Date.now();
            scheduleRelock();
            return true;
          }
          if (result.error === 'user_cancel' || result.error === 'system_cancel') {
            return false;
          }
          // Biometric failed for another reason — fall through to PIN
        }

        // 2) Try PIN if configured
        if (pinAvailable && security.verifyPin) {
          // We can't render a PIN entry here, so we navigate to SecurityLock.
          // Return false and let the caller navigate.
          if (__DEV__) console.log('[Vault] Falling back to PIN via SecurityLock');
          return false;
        }

        sweetAlert('Authentication Failed', 'Could not verify your identity.', 'warning');
        return false;
      } catch (e) {
        if (__DEV__) console.warn('[Vault] Unlock error:', e);
        return false;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [
      isUnlocked,
      isAuthenticating,
      hasBiometric,
      hasPin,
      security,
      sweetAlert,
      refreshSecurityStatus,
      scheduleRelock,
    ]
  );

  return {
    isUnlocked,
    isAuthenticating,
    hasAnySecurity,
    hasBiometric,
    hasPin,
    unlock,
    lock,
    refreshSecurityStatus,
  };
};

export default useVaultUnlock;