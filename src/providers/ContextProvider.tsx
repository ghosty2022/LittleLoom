










































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





let notificationService: {
  initialize?: () => Promise<void>;
  sendChatNotification?: (
    sender: string,
    body: string,
    chatId: string
  ) => Promise<void>;
} | null = null;

try {
  
  const notifModule = require('@/services/NotificationService');
  notificationService =
    notifModule?.notificationService ??
    notifModule?.default ??
    (typeof notifModule?.initialize === 'function' ? notifModule : null);
} catch (e) {
  console.warn('[ContextProvider] NotificationService unavailable:', e);
}


interface ContextProviderProps {
  children: React.ReactNode;
}








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


















const ActivitySyncBridge: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  
  const baby = useBaby();
  const activity = useActivity();

  
  const babyContextRef = useRef(baby);
  babyContextRef.current = baby;

  const activityContextRef = useRef(activity);
  activityContextRef.current = activity;

  
  const babyId: string | null =
    typeof baby?.getCurrentBabyId === 'function'
      ? baby.getCurrentBabyId()
      : null;

  const babyIdRef = useRef<string | null>(babyId);
  babyIdRef.current = babyId;

  
  const didSubscribeRef = useRef(false);
  const didInitialSyncRef = useRef(false);
  const didInitNotificationsRef = useRef(false);
  const isMountedRef = useRef(true);

  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  
  
  
  
  
  
  
  useEffect(() => {
    if (didSubscribeRef.current) return;

    const subscribe = babyContextRef.current?.subscribeToBabyChanges;
    if (typeof subscribe !== 'function') return;

    didSubscribeRef.current = true;

    const unsubscribe = subscribe((newBabyId: string | null) => {
      if (!isMountedRef.current) return;

      
      
      if (newBabyId === babyIdRef.current) return;
      babyIdRef.current = newBabyId;

      console.log('[ActivitySyncBridge] Baby changed to:', newBabyId);

      const actx = activityContextRef.current;
      const syncFn = actx?.syncWithBabyContext;

      if (newBabyId && typeof syncFn === 'function') {
        
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
    
  }, []);

  
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