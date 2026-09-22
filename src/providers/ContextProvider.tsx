// src/providers/ContextProvider.tsx - COMPLETE FIXED
import React, { useEffect, useRef, useMemo, useContext, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { UserProvider } from '@/context/UserContext';
import { BabyProvider, useBaby } from '@/context/BabyContext';
import { FamilyProvider } from '@/context/FamilyContext';
import { FamilyChatProvider } from '@/context/FamilyChatContext';
import { ActivityProvider, useActivity } from '@/context/ActivityContext';
import { SecurityProvider } from '@/context/SecurityContext';
import { MediaProvider } from '@/context/MediaContext';
import { CommunityProvider } from '@/context/CommunityContext';
import { SafetyProvider } from '@/context/SafetyContext';
import { AudioProvider } from '@/context/AudioContext';
import { AppProvider, useTheme } from '@/context/AppContext';
import { TrackerProvider, TrackerContext } from '@/context/TrackerContext';
import { SweetAlertProvider } from '@/components/SweetAlert';
import { AIBootstrapGate } from '@/components/AIBootstrapGate';
import useCustomization from '@/hooks/useCustomization';

// Lazy-load NotificationService so a bad export doesn't crash the whole app
let notificationService: any = null;
try {
  const notifModule = require('@/services/NotificationService');
  notificationService = notifModule?.notificationService ?? notifModule?.default ?? null;
} catch (e) {
  console.warn('[ContextProvider] NotificationService unavailable:', e);
}

interface ContextProviderProps {
  children: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════
// SecurityAuthBridge
// ═══════════════════════════════════════════════════════════════════════
const SecurityAuthBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();

  return (
    <SecurityProvider
      isAuthenticated={auth.isAuthenticated}
      setupComplete={auth.setupComplete}
      setSetupCompleteCallback={auth.setSetupCompleteCallback}
      isAppActive={auth.isAppActive}
    >
      {children}
    </SecurityProvider>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// ActivitySyncBridge
// ───────────────────────────────────────────────────────────────────────
// Rules of Hooks compliance: useBaby() and useActivity() are called
// UNCONDITIONALLY (no try/catch around the hook calls). Only the method
// accesses are guarded, so a future context shape change can't crash
// the whole app but also can't desync React's hook ordering.
// ═══════════════════════════════════════════════════════════════════════
const ActivitySyncBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const babyIdRef = useRef<string | null>(null);
  const initRef = useRef(false);

  // ─── Hooks — called unconditionally (Rules of Hooks) ────────────────
  const baby = useBaby();
  const activity = useActivity();

  // ─── Guarded method access ──────────────────────────────────────────
  const babyId: string | null =
    typeof baby?.getCurrentBabyId === 'function' ? baby.getCurrentBabyId() : null;

  const subscribeToBabyChanges =
    typeof baby?.subscribeToBabyChanges === 'function'
      ? baby.subscribeToBabyChanges
      : null;

  const syncWithBabyContext =
    typeof activity?.syncWithBabyContext === 'function'
      ? activity.syncWithBabyContext
      : null;

  babyIdRef.current = babyId;

  // ─── Subscribe to baby changes ──────────────────────────────────────
  useEffect(() => {
    if (!subscribeToBabyChanges) return;

    const unsubscribe = subscribeToBabyChanges((newBabyId: string | null) => {
      console.log('[ActivitySyncBridge] Baby changed to:', newBabyId);
      babyIdRef.current = newBabyId;

      if (newBabyId && !initRef.current) {
        initRef.current = true;
        if (syncWithBabyContext) {
          Promise.resolve(syncWithBabyContext(newBabyId)).catch((err) => {
            if (__DEV__) console.warn('[ActivitySyncBridge] sync failed:', err);
          });
        }
      }
    });

    return unsubscribe;
  }, [subscribeToBabyChanges, syncWithBabyContext]);

  // ─── Initial sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (!babyId || initRef.current) return;
    initRef.current = true;
    console.log('[ActivitySyncBridge] Initial sync with baby:', babyId);
    if (syncWithBabyContext) {
      Promise.resolve(syncWithBabyContext(babyId)).catch((err) => {
        if (__DEV__) console.warn('[ActivitySyncBridge] initial sync failed:', err);
      });
    }
  }, [babyId, syncWithBabyContext]);

  // ─── Notifications init ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!notificationService?.initialize) return;
      try {
        await notificationService.initialize();
      } catch (e) {
        console.warn('[ActivitySyncBridge] Notification init error:', e);
      }
    };
    init();
  }, []);

  return <>{children}</>;
};

// ═══════════════════════════════════════════════════════════════════════
// TrackerBabySync
// ───────────────────────────────────────────────────────────────────────
// Same Rules of Hooks fix as ActivitySyncBridge: useBaby() unconditional.
// ═══════════════════════════════════════════════════════════════════════
const TrackerBabySync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const trackerContext = useContext(TrackerContext);
  const initRef = useRef(false);
  const currentBabyIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // ─── Hooks — called unconditionally (Rules of Hooks) ────────────────
  const baby = useBaby();

  // ─── Guarded method access ──────────────────────────────────────────
  const babyId: string | null =
    typeof baby?.getCurrentBabyId === 'function' ? baby.getCurrentBabyId() : null;

  const subscribeToBabyChanges =
    typeof baby?.subscribeToBabyChanges === 'function'
      ? baby.subscribeToBabyChanges
      : null;

  const loadBabies =
    typeof baby?.loadBabies === 'function' ? baby.loadBabies : null;

  currentBabyIdRef.current = babyId;

  // ─── Lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── Force load babies on mount if we don't have one yet ────────────
  useEffect(() => {
    if (loadBabies && !babyId) {
      console.log('[TrackerBabySync] No baby ID, forcing load...');
      Promise.resolve(loadBabies()).catch((err) => {
        if (__DEV__) console.warn('[TrackerBabySync] loadBabies failed:', err);
      });
    }
  }, [loadBabies, babyId]);

  // ─── Subscribe to baby changes ──────────────────────────────────────
  useEffect(() => {
    if (!trackerContext || !subscribeToBabyChanges) return;

    console.log('[TrackerBabySync] Setting up subscription to BabyContext');

    const unsubscribe = subscribeToBabyChanges((newBabyId: string | null) => {
      if (!isMountedRef.current) return;

      console.log('[TrackerBabySync] Baby changed to:', newBabyId);
      currentBabyIdRef.current = newBabyId;

      if (trackerContext && typeof trackerContext.setCurrentBabyId === 'function') {
        trackerContext.setCurrentBabyId(newBabyId);
      }

      if (
        trackerContext &&
        typeof trackerContext.refreshEntries === 'function' &&
        newBabyId
      ) {
        // Use requestAnimationFrame to prevent render cycles
        requestAnimationFrame(() => {
          if (isMountedRef.current) {
            Promise.resolve(trackerContext.refreshEntries()).catch((err) => {
              if (__DEV__) console.warn('[TrackerBabySync] refreshEntries failed:', err);
            });
          }
        });
      }
    });

    // Initial sync - use the latest baby ID
    const currentId = currentBabyIdRef.current || babyId;
    if (currentId && trackerContext && typeof trackerContext.setCurrentBabyId === 'function') {
      console.log('[TrackerBabySync] Initial sync with baby:', currentId);
      trackerContext.setCurrentBabyId(currentId);
    }

    return unsubscribe;
  }, [trackerContext, babyId, subscribeToBabyChanges]);

  // ─── Sync when tracker context becomes available ────────────────────
  useEffect(() => {
    if (!trackerContext) return;
    const currentId = currentBabyIdRef.current || babyId;
    if (currentId && typeof trackerContext.setCurrentBabyId === 'function') {
      console.log('[TrackerBabySync] Tracker available, syncing baby:', currentId);
      trackerContext.setCurrentBabyId(currentId);
    }
  }, [trackerContext, babyId]);

  return <>{children}</>;
};

// ═══════════════════════════════════════════════════════════════════════
// SweetAlertWrapper
// ═══════════════════════════════════════════════════════════════════════
const SweetAlertWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme();
  const customization = useCustomization();

  const themeColors = useMemo(() => {
    return {
      primary: customization.themeColors?.primary || '#667eea',
      secondary: customization.themeColors?.secondary || '#764ba2',
      accent: customization.themeColors?.accent || '#43e97b',
      shouldReduceMotion: customization.shouldReduceMotion ?? false,
    };
  }, [customization.themeColors, customization.shouldReduceMotion]);

  return (
    <SweetAlertProvider
      isDark={isDark}
      themeColors={{
        primary: themeColors.primary,
        secondary: themeColors.secondary,
        accent: themeColors.accent,
      }}
      reduceMotion={themeColors.shouldReduceMotion}
    >
      {children}
    </SweetAlertProvider>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// FamilyChatWrapper — retry-tolerant
// ═══════════════════════════════════════════════════════════════════════
const FamilyChatWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    try {
      if (typeof FamilyChatProvider === 'undefined') {
        console.error('[FamilyChatWrapper] FamilyChatProvider is undefined');
        setHasError(true);
        setReady(true);
        return;
      }

      const timer = setTimeout(() => setReady(true), 50);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('[FamilyChatWrapper] Error initializing:', error);
      setHasError(true);
      setReady(true);
    }
  }, []);

  if (!ready || hasError) {
    if (hasError) {
      console.warn(
        '[FamilyChatWrapper] FamilyChatProvider failed to load, rendering children directly'
      );
    }
    return <>{children}</>;
  }

  try {
    return <FamilyChatProvider>{children}</FamilyChatProvider>;
  } catch (error) {
    console.error('[FamilyChatWrapper] Error rendering FamilyChatProvider:', error);
    return <>{children}</>;
  }
};

// ═══════════════════════════════════════════════════════════════════════
// PROVIDER ORDER — FIXED
// ───────────────────────────────────────────────────────────────────────
// Rules:
//   1. TrackerProvider MUST be above ActivityProvider
//      (ActivityProvider reads useTracker() during render)
//   2. TrackerProvider MUST be above TrackerBabySync
//      (TrackerBabySync reads useContext(TrackerContext))
//   3. BabyProvider MUST be above TrackerProvider
//      (TrackerProvider reads currentBabyId from BabyContext)
//   4. AIBootstrapGate MUST be inside BabyProvider
//      (it reads useBaby())
//   5. SweetAlertWrapper MUST be inside AppProvider (for theme)
// ═══════════════════════════════════════════════════════════════════════
export default function ContextProvider({ children }: ContextProviderProps) {
  return (
    <AuthProvider>
      <AppProvider>
        <UserProvider>
          <BabyProvider>
            <SecurityAuthBridge>
              <FamilyProvider>
                {/* TrackerProvider owns ALL entry data — must be above ActivityProvider */}
                <TrackerProvider>
                  {/* ActivityProvider is a read-only adapter for Tracker */}
                  <ActivityProvider>
                    <AudioProvider>
                      <ActivitySyncBridge>
                        <MediaProvider>
                          <FamilyChatWrapper>
                            <CommunityProvider>
                              <SafetyProvider>
                                <TrackerBabySync>
                                  {/* AIBootstrapGate runs AI warm-up on app launch + baby change */}
                                  <AIBootstrapGate />
                                  <SweetAlertWrapper>
                                    {children}
                                  </SweetAlertWrapper>
                                </TrackerBabySync>
                              </SafetyProvider>
                            </CommunityProvider>
                          </FamilyChatWrapper>
                        </MediaProvider>
                      </ActivitySyncBridge>
                    </AudioProvider>
                  </ActivityProvider>
                </TrackerProvider>
              </FamilyProvider>
            </SecurityAuthBridge>
          </BabyProvider>
        </UserProvider>
      </AppProvider>
    </AuthProvider>
  );
}