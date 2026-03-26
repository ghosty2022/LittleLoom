// src/App.tsx
import './src/utils/GlobalScrollPatch';

import React, { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { InteractionManager } from 'react-native';

// Keep splash visible until we're ready
SplashScreen.preventAutoHideAsync();

// Import providers directly
import ContextProvider from './src/providers/ContextProvider';
import { ModalProvider } from './src/utils/modal';
import AppNavigator from './src/navigation/AppNavigator';
import { GlobalAudioPlayer } from './src/components/GlobalAudioPlayer';

export default function App(): JSX.Element | null {
  const [appIsReady, setAppIsReady] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Set system UI color immediately
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(isDark ? '#000000' : '#f8faff');
  }, [isDark]);

  // Critical initialization - defer notifications
  useEffect(() => {
    let mounted = true;

    const prepareApp = async () => {
      try {
        // Defer notifications to avoid blocking startup
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            import('./src/utils/notifications').then(({ initNotifications }) => {
              initNotifications();
            }).catch(console.warn);
          });
        });
      } catch (error) {
        console.warn('Error preparing app:', error);
      } finally {
        if (mounted) {
          // Remove artificial delay - app is ready immediately
          setAppIsReady(true);
        }
      }
    };

    prepareApp();

    return () => {
      mounted = false;
    };
  }, []);

  // Hide splash when ready
  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <ModalProvider>
          <ContextProvider>
            <Animated.View 
              entering={FadeIn.duration(300)} 
              style={[styles.container, isDark ? styles.containerDark : null]}
            >
              <AppNavigator isDark={isDark} />
              <GlobalAudioPlayer />
            </Animated.View>
            <StatusBar 
              style={isDark ? 'light' : 'dark'} 
              backgroundColor={isDark ? '#000000' : '#f8faff'}
              translucent={false}
            />
          </ContextProvider>
        </ModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8faff',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
});