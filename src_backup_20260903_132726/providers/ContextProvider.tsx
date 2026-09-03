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
  // Safely get baby ID
  let babyId: string | null = null;
  let subscribeToBabyChanges: ((cb: (id: string | null) => void) => () => void) | null = null;
  const babyIdRef = useRef<string | null>(null);
  
  try {
    const baby = useBaby();
    babyId = baby.getCurrentBabyId();
    subscribeToBabyChanges = baby.subscribeToBabyChanges;
    babyIdRef.current = babyId;
  } catch {
    // BabyContext not ready yet
  }
  
  const { syncWithBabyContext } = useActivity();
  const initRef = useRef(false);

  // Subscribe to baby changes
  useEffect(() => {
    if (!subscribeToBabyChanges) return;
    
    const unsubscribe = subscribeToBabyChanges((newBabyId) => {
      console.log('[ActivitySyncBridge] Baby changed to:', newBabyId);
      babyIdRef.current = newBabyId;
      if (newBabyId && !initRef.current) {
        initRef.current = true;
        syncWithBabyContext(newBabyId);
      }
    });
    
    return unsubscribe;
  }, [subscribeToBabyChanges, syncWithBabyContext]);

  // Initial sync
  useEffect(() => {
    if (!babyId || initRef.current) return;
    initRef.current = true;
    console.log('[ActivitySyncBridge] Initial sync with baby:', babyId);
    syncWithBabyContext(babyId);
  }, [babyId, syncWithBabyContext]);

  // Poll for baby ID changes
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const baby = useBaby();
        const newId = baby.getCurrentBabyId();
        if (newId !== babyIdRef.current && newId) {
          console.log('[ActivitySyncBridge] Poll detected baby change:', newId);
          babyIdRef.current = newId;
          if (!initRef.current) {
            initRef.current = true;
            syncWithBabyContext(newId);
          }
        }
      } catch {
        // Ignore
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [syncWithBabyContext]);

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
  const trackerContext = useContext(TrackerContext);
  const initRef = useRef(false);
  const currentBabyIdRef = useRef<string | null>(null);
  
  // Get baby data - with retry if not ready
  let babyId: string | null = null;
  let subscribeToBabyChanges: ((cb: (id: string | null) => void) => () => void) | null = null;
  let loadBabies: (() => Promise<void>) | null = null;
  let refreshCurrentBaby: (() => Promise<void>) | null = null;
  
  try {
    const baby = useBaby();
    babyId = baby.getCurrentBabyId();
    subscribeToBabyChanges = baby.subscribeToBabyChanges;
    loadBabies = baby.loadBabies;
    refreshCurrentBaby = baby.refreshCurrentBaby;
    currentBabyIdRef.current = babyId;
  } catch (e) {
    console.warn('[TrackerBabySync] BabyContext not ready yet');
  }

  // Force load babies on mount
  useEffect(() => {
    if (loadBabies && !babyId) {
      console.log('[TrackerBabySync] No baby ID, forcing load...');
      loadBabies();
    }
  }, [loadBabies, babyId]);

  // Subscribe to baby changes
  useEffect(() => {
    if (!trackerContext || !subscribeToBabyChanges) return;
    
    console.log('[TrackerBabySync] Setting up subscription to BabyContext');
    
    // Subscribe to baby changes from BabyContext
    const unsubscribe = subscribeToBabyChanges((newBabyId) => {
      console.log('[TrackerBabySync] Baby changed to:', newBabyId);
      currentBabyIdRef.current = newBabyId;
      
      if (trackerContext && trackerContext.setCurrentBabyId) {
        trackerContext.setCurrentBabyId(newBabyId);
      }
      
      if (trackerContext && trackerContext.refreshEntries && newBabyId) {
        trackerContext.refreshEntries();
      }
    });

    // Initial sync - use the latest baby ID
    const currentId = currentBabyIdRef.current || babyId;
    if (currentId && trackerContext && trackerContext.setCurrentBabyId) {
      console.log('[TrackerBabySync] Initial sync with baby:', currentId);
      trackerContext.setCurrentBabyId(currentId);
    }

    return unsubscribe;
  }, [trackerContext, babyId, subscribeToBabyChanges]);

  // Sync when tracker context becomes available
  useEffect(() => {
    if (!trackerContext) return;
    const currentId = currentBabyIdRef.current || babyId;
    if (currentId && trackerContext.setCurrentBabyId) {
      console.log('[TrackerBabySync] Tracker available, syncing baby:', currentId);
      trackerContext.setCurrentBabyId(currentId);
    }
  }, [trackerContext, babyId]);

  // Poll for baby ID changes
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const baby = useBaby();
        const newId = baby.getCurrentBabyId();
        if (newId !== currentBabyIdRef.current) {
          console.log('[TrackerBabySync] Poll detected baby change:', newId);
          currentBabyIdRef.current = newId;
          if (trackerContext && trackerContext.setCurrentBabyId) {
            trackerContext.setCurrentBabyId(newId);
          }
        }
      } catch {
        // Ignore
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [trackerContext]);

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

// ─── FIXED PROVIDER ORDER ─────────────────────────────────────────────
// AudioProvider MUST be HIGHER in the tree so it wraps ALL components that use useAudio()
export default function ContextProvider({ children }: ContextProviderProps) {
  return (
    <AuthProvider>
      <AppProvider>
        <UserProvider>
          <BabyProvider>
            <SecurityAuthBridge>
              <FamilyProvider>
                <ActivityProvider>
                  {/* AudioProvider must be OUTSIDE ActivitySyncBridge but INSIDE ActivityProvider */}
                  {/* It must also wrap SweetAlertWrapper and all other children */}
                  <AudioProvider>
                    <ActivitySyncBridge>
                      <MediaProvider>
                        <FamilyChatWrapper>
                          <CommunityProvider>
                            <SafetyProvider>
                              <TrackerProvider>
                                <TrackerBabySync>
                                  {/* SweetAlertWrapper now INSIDE AudioProvider */}
                                  <SweetAlertWrapper>
                                    {children}
                                  </SweetAlertWrapper>
                                </TrackerBabySync>
                              </TrackerProvider>
                            </SafetyProvider>
                          </CommunityProvider>
                        </FamilyChatWrapper>
                      </MediaProvider>
                    </ActivitySyncBridge>
                  </AudioProvider>
                </ActivityProvider>
              </FamilyProvider>
            </SecurityAuthBridge>
          </BabyProvider>
        </UserProvider>
      </AppProvider>
    </AuthProvider>
  );
}