// src/providers/ContextProvider.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Import all providers directly
import { AuthProvider } from '../context/AuthContext';
import { UserProvider } from '../context/UserContext';
import { BabyProvider } from '../context/BabyContext';
import { FamilyProvider } from '../context/FamilyContext';
import { FamilyChatProvider } from '../context/FamilyChatContext';
import { ActivityProvider } from '../context/ActivityContext';
import { SecurityProvider } from '../context/SecurityContext';
import { MediaProvider } from '../context/MediaContext';
import { CommunityProvider } from '../context/CommunityContext';
import { SafetyProvider } from '../context/SafetyContext';
import { AudioProvider } from '../context/AudioContext';

interface ContextProviderProps {
  children: React.ReactNode;
  onReady?: () => void;
}

export default function ContextProvider({ children, onReady }: ContextProviderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to let all providers mount, then notify parent
    const timer = setTimeout(() => {
      setIsReady(true);
      if (onReady) {
        onReady();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [onReady]);

  return (
    <AuthProvider>
      <UserProvider>
        <BabyProvider>
          <SecurityProvider>
            <ActivityProvider>
              <MediaProvider>
                <FamilyProvider>
                  <FamilyChatProvider>
                    <CommunityProvider>
                      <SafetyProvider>
                        <AudioProvider>
                          {children}
                          {!isReady && (
                            <View style={styles.loadingOverlay}>
                              <ActivityIndicator size="small" color="#667eea" />
                            </View>
                          )}
                        </AudioProvider>
                      </SafetyProvider>
                    </CommunityProvider>
                  </FamilyChatProvider>
                </FamilyProvider>
              </MediaProvider>
            </ActivityProvider>
          </SecurityProvider>
        </BabyProvider>
      </UserProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8faff',
    zIndex: 999,
  },
});