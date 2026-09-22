// src/providers/ContextProvider.tsx
// ─────────────────────────────────────────────────────────────────────
// Provider composition root for the entire app.
//
// CHANGELOG (this version):
//   ✓ REMOVED TrackerBabySync — it was redundant. TrackerProvider already
//     subscribes to BabyContext internally (see TrackerContext.tsx
//     `subscribeToBabyChanges` effect). Keeping a second subscriber in
//     this file caused an infinite re-subscribe loop that flooded the
//     console with "[TrackerBabySync] Setting up subscription to
//     BabyContext" 200+ times per session.
//
//   ✓ ActivitySyncBridge — rewritten to use refs (no context objects in
//     deps arrays) + one-shot subscription guards. Previously re-subscribed
//     on every render because both `subscribeToBabyChanges` (new identity
//     per baby change) and `activity` (new identity per entry change) were
//     in the deps array.
//
//   ✓ FamilyChatWrapper — fixed a broken effect cleanup that leaked a
//     setTimeout and never cleared state on the happy path.
//
//   ✓ notificationService — hardened lazy-load. Falls back to `null` if
//     the module is missing, and every caller guards with `?.initialize`.
//
// PROVIDER ORDER (do not change casually):
//   1. AuthProvider        — must be outermost (everything depends on auth)
//   2. AppProvider         — theme + notifications (needs auth for storage)
//   3. UserProvider        — user profile + community identity
//   4. BabyProvider        — current baby + family membership
//   5. SecurityAuthBridge  — needs isAuthenticated + setupComplete
//   6. FamilyProvider      — needs BabyContext (currentBaby.id)
//   7. TrackerProvider     — needs BabyContext + FamilyContext
//   8. ActivityProvider    — reads useTracker() during render
//   9. AudioProvider       — reads BabyContext (favorites per baby)
//  10. ActivitySyncBridge  — bridges Baby → Activity
//  11. MediaProvider
//  12. FamilyChatWrapper   — needs Family + Auth + Baby
//  13. CommunityProvider   — needs Auth
//  14. SafetyProvider
//  15. AIBootstrapGate     — needs BabyContext
//  16. SweetAlertWrapper   — needs AppContext (theme)
// ─────────────────────────────────────────────────────────────────────

import React, {
  useEffect,
  useRef,
  useMemo,
  useState,
} from 'react';

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
import { TrackerProvider } from '@/context/TrackerContext';
import { SweetAlertProvider } from '@/components/SweetAlert';
import { AIBootstrapGate } from '@/components/AIBootstrapGate';
import useCustomization from '@/hooks/useCustomization';

// ─── Lazy-load NotificationService ──────────────────────────────────
// A bad export in NotificationService should NOT crash the whole app.
// We resolve it once at module load and every caller guards with
// optional chaining (`notificationService?.initialize`).
let notificationService: {
  initialize?: () => Promise<void>;
  sendChatNotification?: (
    sender: string,
    body: string,
    chatId: string
  ) => Promise<void>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const notifModule = require('@/services/NotificationService');
  notificationService =
    notifModule?.notificationService ??
    notifModule?.default ??
    (typeof notifModule?.initialize === 'function' ? notifModule : null);
} catch (e) {
  console.warn('[ContextProvider] NotificationService unavailable:', e);
}

// ─── Props ──────────────────────────────────────────────────────────
interface ContextProviderProps {
  children: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════════
// SecurityAuthBridge
// ───────────────────────────────────────────────────────────────────
// SecurityProvider needs auth state + a setup-complete callback that
// AuthContext owns. We bridge them here so SecurityProvider stays
// decoupled from AuthContext.
// ═══════════════════════════════════════════════════════════════════
const SecurityAuthBridge: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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

// ═══════════════════════════════════════════════════════════════════
// ActivitySyncBridge
// ───────────────────────────────────────────────────────────────────
// Bridges BabyContext → ActivityContext.
//
// WHY REFS: `useBaby()` and `useActivity()` both return fresh objects on
// every provider render. If we put them in the effect's deps array, the
// effect re-fires on every render, and `subscribeToBabyChanges` (which
// fires its callback immediately on subscribe) re-triggers
// `syncWithBabyContext`, which updates ActivityContext state, which
// creates a new `activity` object... infinite loop.
//
// We solve it by:
//   1. Keeping live context values in refs (never in deps).
//   2. Using `didSubscribeRef` / `didInitialSyncRef` guards so each
//      one-shot effect runs exactly once.
//   3. Reading the current `babyId` primitive from a ref inside the
//      subscription callback so we can bail if nothing changed.
// ═══════════════════════════════════════════════════════════════════
const ActivitySyncBridge: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // ── Hooks: called unconditionally (Rules of Hooks) ─────────────
  const baby = useBaby();
  const activity = useActivity();

  // ── Live refs so nothing hits the deps array ───────────────────
  const babyContextRef = useRef(baby);
  babyContextRef.current = baby;

  const activityContextRef = useRef(activity);
  activityContextRef.current = activity;

  // ── Current baby id primitive (for callback bail-out) ──────────
  const babyId: string | null =
    typeof baby?.getCurrentBabyId === 'function'
      ? baby.getCurrentBabyId()
      : null;

  const babyIdRef = useRef<string | null>(babyId);
  babyIdRef.current = babyId;

  // ── One-shot guards ────────────────────────────────────────────
  const didSubscribeRef = useRef(false);
  const didInitialSyncRef = useRef(false);
  const didInitNotificationsRef = useRef(false);
  const isMountedRef = useRef(true);

  // ── Unmount flag ───────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Subscribe to baby changes ONCE ─────────────────────────────
  // Deps intentionally empty. The `subscribe` function is grabbed from
  // the ref at subscription time and never re-subscribed. If the
  // context later provides a new `subscribeToBabyChanges` identity
  // (which it shouldn't — see BabyContext fix), we still keep the
  // original subscription because the underlying pub/sub bus
  // (`babyChangeSubscribers` array) is stable.
  useEffect(() => {
    if (didSubscribeRef.current) return;

    const subscribe = babyContextRef.current?.subscribeToBabyChanges;
    if (typeof subscribe !== 'function') return;

    didSubscribeRef.current = true;

    const unsubscribe = subscribe((newBabyId: string | null) => {
      if (!isMountedRef.current) return;

      // Bail if nothing actually changed. This is the #1 guard against
      // the re-subscription loop.
      if (newBabyId === babyIdRef.current) return;
      babyIdRef.current = newBabyId;

      console.log('[ActivitySyncBridge] Baby changed to:', newBabyId);

      const actx = activityContextRef.current;
      const syncFn = actx?.syncWithBabyContext;

      if (newBabyId && typeof syncFn === 'function') {
        // Batch to next frame so we don't nest state updates.
        requestAnimationFrame(() => {
          if (!isMountedRef.current) return;
          Promise.resolve(syncFn(newBabyId)).catch((err) => {
            if (__DEV__) {
              console.warn('[ActivitySyncBridge] sync failed:', err);
            }
          });
        });
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── One-time initial sync ──────────────────────────────────────
  useEffect(() => {
    if (didInitialSyncRef.current) return;
    if (!babyId) return;

    const syncFn = activityContextRef.current?.syncWithBabyContext;
    if (typeof syncFn !== 'function') return;

    didInitialSyncRef.current = true;
    console.log('[ActivitySyncBridge] Initial sync with baby:', babyId);

    Promise.resolve(syncFn(babyId)).catch((err) => {
      if (__DEV__) {
        console.warn('[ActivitySyncBridge] initial sync failed:', err);
      }
    });
  }, [babyId]);

  // ── One-time Notifications init ────────────────────────────────
  useEffect(() => {
    if (didInitNotificationsRef.current) return;
    if (!notificationService?.initialize) return;
    didInitNotificationsRef.current = true;

    (async () => {
      try {
        await notificationService!.initialize!();
      } catch (e) {
        console.warn('[ActivitySyncBridge] Notification init error:', e);
      }
    })();
  }, []);

  return <>{children}</>;
};

// ═══════════════════════════════════════════════════════════════════
// SweetAlertWrapper
// ───────────────────────────────────────────────────────────────────
// Provides theme context to the global SweetAlert provider. Must live
// inside AppProvider (for `isDark`) and useCustomization (for palette).
// ═══════════════════════════════════════════════════════════════════
const SweetAlertWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isDark } = useTheme();
  const customization = useCustomization();

  const themeColors = useMemo(
    () => ({
      primary: customization.themeColors?.primary || '#667eea',
      secondary: customization.themeColors?.secondary || '#764ba2',
      accent: customization.themeColors?.accent || '#43e97b',
      shouldReduceMotion: customization.shouldReduceMotion ?? false,
    }),
    [customization.themeColors, customization.shouldReduceMotion]
  );

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

// ═══════════════════════════════════════════════════════════════════
// FamilyChatWrapper
// ───────────────────────────────────────────────────────────────────
// Delays mounting FamilyChatProvider by one frame so its heavy
// realtime setup doesn't block the initial paint.
//
// FIX: the previous version had a broken cleanup that returned
// `undefined` on the error path (leaking the timer), and never cleared
// the timer on the happy path (could set state after unmount). We now
// track a `cancelled` flag and always clear the timeout.
// ═══════════════════════════════════════════════════════════════════
const FamilyChatWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ready, setReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      if (typeof FamilyChatProvider === 'undefined') {
        console.error('[FamilyChatWrapper] FamilyChatProvider is undefined');
        if (!cancelled) {
          setHasError(true);
          setReady(true);
        }
        return;
      }

      timer = setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 50);
    } catch (error) {
      console.error('[FamilyChatWrapper] Error initializing:', error);
      if (!cancelled) {
        setHasError(true);
        setReady(true);
      }
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ── Not ready yet: render children directly (no provider) ──────
  if (!ready) {
    return <>{children}</>;
  }

  // ── Error: fall back to a plain pass-through ───────────────────
  if (hasError) {
    console.warn(
      '[FamilyChatWrapper] FamilyChatProvider failed to load, rendering children directly'
    );
    return <>{children}</>;
  }

  // ── Ready: mount the real provider ─────────────────────────────
  try {
    return <FamilyChatProvider>{children}</FamilyChatProvider>;
  } catch (error) {
    console.error(
      '[FamilyChatWrapper] Error rendering FamilyChatProvider:',
      error
    );
    return <>{children}</>;
  }
};

// ═══════════════════════════════════════════════════════════════════
// ContextProvider — composition root
// ═══════════════════════════════════════════════════════════════════
export default function ContextProvider({ children }: ContextProviderProps) {
  return (
    <AuthProvider>
      <AppProvider>
        <UserProvider>
          <BabyProvider>
            <SecurityAuthBridge>
              <FamilyProvider>
                {/* TrackerProvider owns ALL entry data.
                    It subscribes to BabyContext internally — no
                    separate TrackerBabySync bridge is needed. */}
                <TrackerProvider>
                  {/* ActivityProvider is a read-only adapter for Tracker */}
                  <ActivityProvider>
                    <AudioProvider>
                      <ActivitySyncBridge>
                        <MediaProvider>
                          <FamilyChatWrapper>
                            <CommunityProvider>
                              <SafetyProvider>
                                {/* AIBootstrapGate runs AI warm-up on
                                    app launch + baby change */}
                                <AIBootstrapGate />
                                <SweetAlertWrapper>
                                  {children}
                                </SweetAlertWrapper>
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