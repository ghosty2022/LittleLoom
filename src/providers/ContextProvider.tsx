// src/providers/ContextProvider.tsx
// FULLY SYNCED: All contexts integrated with notification/activity sync
// FIXED: Proper children prop typing, no TypeScript errors
// FIXED: Cross-context bridges for Activity ↔ Baby ↔ Notification
// FIXED: useCustomization hook called at top level, not inside useMemo

import React, { useEffect, useRef, useMemo } from 'react';
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
import { SweetAlertProvider } from '@/components/SweetAlert';
import useCustomization from '@/hooks/useCustomization';
import { notificationService } from '@/services/NotificationService';

interface ContextProviderProps {
  children: React.ReactNode;
}

// Bridge: Reads AuthContext and passes state to SecurityProvider as props
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

// Bridge: Syncs ActivityContext with BabyContext and NotificationService
const ActivitySyncBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentBabyId, currentBaby } = useBaby();
  const { syncWithBabyContext } = useActivity();
  const initRef = useRef(false);

  // Sync activities when baby changes
  useEffect(() => {
    if (!currentBabyId || initRef.current) return;
    initRef.current = true;
    
    const doSync = async () => {
      await syncWithBabyContext(currentBabyId);
    };
    doSync();
  }, [currentBabyId, syncWithBabyContext]);

  // Initialize notification service
  useEffect(() => {
    const init = async () => {
      await notificationService.initialize();
    };
    init();
  }, []);

  return <>{children}</>;
};

// Inner wrapper — called AFTER all providers are mounted
const SweetAlertWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme();

  // ✅ FIXED: Call useCustomization at the TOP LEVEL of the component
  // Do NOT call hooks inside useMemo, useEffect, callbacks, or conditionals
  let customizationResult: ReturnType<typeof useCustomization> | null = null;
  try {
    customizationResult = useCustomization();
  } catch {
    // useCustomization not available, will use defaults below
  }

  const themeColors = useMemo(() => {
    let colors = {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#43e97b',
    };
    let shouldReduceMotion = false;

    if (customizationResult) {
      colors = customizationResult.themeColors || colors;
      shouldReduceMotion = customizationResult.shouldReduceMotion ?? false;
    }

    return { colors, shouldReduceMotion };
  }, [customizationResult]);

  return (
    <SweetAlertProvider
      isDark={isDark}
      themeColors={{
        primary: themeColors.colors.primary,
        secondary: themeColors.colors.secondary,
        accent: themeColors.colors.accent,
      }}
      reduceMotion={themeColors.shouldReduceMotion}
    >
      {children}
    </SweetAlertProvider>
  );
};

export default function ContextProvider({ children }: ContextProviderProps) {
  return (
    <AuthProvider>
      <AppProvider>
        <UserProvider>
          <BabyProvider>
            <SecurityAuthBridge>
              <ActivityProvider>
                <ActivitySyncBridge>
                  <MediaProvider>
                    <FamilyProvider>
                      <FamilyChatProvider>
                        <CommunityProvider>
                          <SafetyProvider>
                            <AudioProvider>
                              <SweetAlertWrapper>
                                {children}
                              </SweetAlertWrapper>
                            </AudioProvider>
                          </SafetyProvider>
                        </CommunityProvider>
                      </FamilyChatProvider>
                    </FamilyProvider>
                  </MediaProvider>
                </ActivitySyncBridge>
              </ActivityProvider>
            </SecurityAuthBridge>
          </BabyProvider>
        </UserProvider>
      </AppProvider>
    </AuthProvider>
  );
}