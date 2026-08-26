// src/providers/ContextProvider.tsx
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
import useCustomization from '@/hooks/useCustomization';
import { notificationService } from '@/services/NotificationService';

interface ContextProviderProps {
  children: React.ReactNode;
}

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

const ActivitySyncBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentBabyId, getCurrentBabyId } = useBaby();
  const { syncWithBabyContext, getCurrentBabyId: getActivityBabyId } = useActivity();
  const initRef = useRef(false);

  useEffect(() => {
    const babyId = currentBabyId || getCurrentBabyId();
    if (!babyId || initRef.current) return;
    initRef.current = true;

    const doSync = async () => {
      await syncWithBabyContext(babyId);
    };
    doSync();
  }, [currentBabyId, getCurrentBabyId, syncWithBabyContext]);

  useEffect(() => {
    const init = async () => {
      await notificationService.initialize();
    };
    init();
  }, []);

  return <>{children}</>;
};

// TrackerBabySync - syncs TrackerContext with BabyContext
const TrackerBabySync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getCurrentBabyId: getBabyFromContext, subscribeToBabyChanges } = useBaby();
  const trackerContext = useContext(TrackerContext);
  const initRef = useRef(false);

  useEffect(() => {
    // Subscribe to baby changes from BabyContext
    const unsubscribe = subscribeToBabyChanges((babyId) => {
      console.log('[TrackerBabySync] Baby changed to:', babyId);
      if (trackerContext && trackerContext.setCurrentBabyId) {
        trackerContext.setCurrentBabyId(babyId);
      }
      // Also refresh entries when baby changes
      if (trackerContext && trackerContext.refreshEntries && babyId) {
        trackerContext.refreshEntries();
      }
    });

    // Initial sync
    const initialBabyId = getBabyFromContext();
    if (initialBabyId && trackerContext && trackerContext.setCurrentBabyId) {
      trackerContext.setCurrentBabyId(initialBabyId);
    }

    return unsubscribe;
  }, [trackerContext, getBabyFromContext, subscribeToBabyChanges]);

  // Also sync when tracker context becomes available
  useEffect(() => {
    if (!trackerContext) return;
    const babyId = getBabyFromContext();
    if (babyId && trackerContext.setCurrentBabyId) {
      trackerContext.setCurrentBabyId(babyId);
    }
  }, [trackerContext, getBabyFromContext]);

  return <>{children}</>;
};

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

// Wrapper that defers FamilyChatProvider to next tick
const FamilyChatWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return <>{children}</>;
  }

  return (
    <FamilyChatProvider>
      {children}
    </FamilyChatProvider>
  );
};

// ─── CORRECT PROVIDER ORDER ────────────────────────────────────────────
// BabyProvider MUST be first and wrap everything that needs useBaby()
export default function ContextProvider({ children }: ContextProviderProps) {
  return (
    <AuthProvider>
      <AppProvider>
        <UserProvider>
          {/* BabyProvider wraps ALL components that need useBaby() */}
          <BabyProvider>
            {/* SecurityAuthBridge needs useAuth() but not useBaby() */}
            <SecurityAuthBridge>
              <FamilyProvider>
                <ActivityProvider>
                  {/* ActivitySyncBridge uses useBaby() - it's inside BabyProvider now */}
                  <ActivitySyncBridge>
                    <AudioProvider>
                      <MediaProvider>
                        <FamilyChatWrapper>
                          <CommunityProvider>
                            <SafetyProvider>
                              {/* TrackerProvider is INSIDE BabyProvider so TrackerBabySync can use useBaby() */}
                              <TrackerProvider>
                                {/* TrackerBabySync uses useBaby() - it's inside BabyProvider */}
                                <TrackerBabySync>
                                  <SweetAlertWrapper>
                                    {children}
                                  </SweetAlertWrapper>
                                </TrackerBabySync>
                              </TrackerProvider>
                            </SafetyProvider>
                          </CommunityProvider>
                        </FamilyChatWrapper>
                      </MediaProvider>
                    </AudioProvider>
                  </ActivitySyncBridge>
                </ActivityProvider>
              </FamilyProvider>
            </SecurityAuthBridge>
          </BabyProvider>
        </UserProvider>
      </AppProvider>
    </AuthProvider>
  );
}