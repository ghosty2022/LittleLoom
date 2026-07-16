// src/providers/ContextProvider.tsx
import React, { useEffect, useRef, useMemo, useState, useContext } from 'react';
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
// FIX: Import only what exists - useTracker hook if available, not TrackerContext
import { TrackerProvider } from '@/context/TrackerContext';
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
  const { currentBabyId } = useBaby();
  const { syncWithBabyContext } = useActivity();
  const initRef = useRef(false);

  useEffect(() => {
    if (!currentBabyId || initRef.current) return;
    initRef.current = true;

    const doSync = async () => {
      await syncWithBabyContext(currentBabyId);
    };
    doSync();
  }, [currentBabyId, syncWithBabyContext]);

  useEffect(() => {
    const init = async () => {
      await notificationService.initialize();
    };
    init();
  }, []);

  return <>{children}</>;
};

// FIX: Safe tracker sync without requiring TrackerContext export
const TrackerBabySync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentBabyId } = useBaby();
  
  // Use lazy context access to avoid crash if context doesn't exist
  const trackerContext = useContext(
    // @ts-ignore - handle missing context gracefully
    require('@/context/TrackerContext').TrackerContext || React.createContext(null)
  );
  const initRef = useRef(false);

  useEffect(() => {
    if (!currentBabyId || initRef.current) return;
    if (!trackerContext) return; // Safe: skip if context not available
    
    initRef.current = true;
    if (trackerContext.setCurrentBabyId) {
      trackerContext.setCurrentBabyId(currentBabyId);
    }
  }, [currentBabyId, trackerContext]);

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

export default function ContextProvider({ children }: ContextProviderProps) {
  return (
    <AuthProvider>
      <AppProvider>
        <UserProvider>
          <BabyProvider>
            <SecurityAuthBridge>
              <FamilyProvider>
                <ActivityProvider>
                  <ActivitySyncBridge>
                    <MediaProvider>
                      <FamilyChatWrapper>
                        <CommunityProvider>
                          <SafetyProvider>
                            <AudioProvider>
                              <TrackerProvider>
                                <TrackerBabySync>
                                  <SweetAlertWrapper>
                                    {children}
                                  </SweetAlertWrapper>
                                </TrackerBabySync>
                              </TrackerProvider>
                            </AudioProvider>
                          </SafetyProvider>
                        </CommunityProvider>
                      </FamilyChatWrapper>
                    </MediaProvider>
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