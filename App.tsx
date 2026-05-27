// src/App.tsx
import './src/utils/GlobalScrollPatch';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, useColorScheme, AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

// Keep splash visible until we're ready
SplashScreen.preventAutoHideAsync();

// Set notification handler BEFORE any component renders
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Import providers directly
import ContextProvider from './src/providers/ContextProvider';
import { ModalProvider } from './src/utils/modal';
import AppNavigator from './src/navigation/AppNavigator';
import { GlobalAudioPlayer } from './src/components/GlobalAudioPlayer';
import { notificationService } from './src/services/NotificationService';

// Import state persistence
import { statePersistence } from './src/utils/statePersistence';

// Navigation persistence key
const NAVIGATION_STATE_KEY = '@littleloom_nav_state_v1';
const LAST_ROUTE_KEY = '@littleloom_last_route_v1';
const SECURITY_LOCK_KEY = 'littleloom_security_lock';

export default function App(): JSX.Element | null {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initialNavigationState, setInitialNavigationState] = useState<any>(undefined);
  const [isNavigationReady, setIsNavigationReady] = useState(Platform.OS === 'web');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  // Keep the latest navigation state in a ref for instant background access
  const lastNavigationStateRef = useRef<any>(null);
  const initComplete = useRef(false);

  // Set system UI color immediately
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(isDark ? '#000000' : '#f8faff');
  }, [isDark]);

  // Initialize state persistence manager
  useEffect(() => {
    statePersistence.initialize();
    return () => {
      statePersistence.cleanup();
    };
  }, []);

  // Initialize notifications
  useEffect(() => {
    const initNotifications = async () => {
      try {
        await notificationService.initialize();
        const hasPermission = await notificationService.requestPermissions();
        console.log('Notification permissions:', hasPermission ? 'granted' : 'denied');
        
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          console.log('Notification tapped:', data);
          if (data?.screen) {
            console.log('Should navigate to:', data.screen);
          }
        });
        
        return () => subscription.remove();
      } catch (error) {
        console.warn('Failed to initialize notifications:', error);
      }
    };
    
    initNotifications();
  }, []);

  // CRITICAL FIX: Restore navigation state on mount - Exclude SecurityLock
  useEffect(() => {
    if (initComplete.current) return;
    
    const restoreNavigationState = async () => {
      try {
        // Check for deep link first - don't restore if there's a deep link
        const initialUrl = await Linking.getInitialURL();
        
        if (Platform.OS !== 'web' && initialUrl == null) {
          const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
          
          if (savedState) {
            const parsedState = JSON.parse(savedState);
            
            // CRITICAL FIX: Validate and sanitize the restored state
            if (parsedState && typeof parsedState === 'object' && Array.isArray(parsedState.routes)) {
              const currentRoute = parsedState.routes[parsedState.index];
              
              // NEVER restore to SecurityLock as initial state - it causes instant re-lock
              if (currentRoute?.name === 'SecurityLock') {
                console.log('🚫 Prevented restoring SecurityLock as initial state');
                await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
                await AsyncStorage.removeItem(LAST_ROUTE_KEY);
              } else {
                setInitialNavigationState(parsedState);
                console.log('🔄 Restored navigation state:', currentRoute?.name);
              }
            } else {
              console.warn('Invalid navigation state found, clearing...');
              await AsyncStorage.removeItem(NAVIGATION_STATE_KEY);
              await AsyncStorage.removeItem(LAST_ROUTE_KEY);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to restore navigation state:', error);
      } finally {
        setIsNavigationReady(true);
        initComplete.current = true;
      }
    };

    if (!isNavigationReady) {
      restoreNavigationState();
    }
  }, [isNavigationReady]);

  // Critical initialization
  useEffect(() => {
    let mounted = true;

    const prepareApp = async () => {
      try {
        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            // Additional deferred initialization can go here
          });
        });
      } catch (error) {
        console.warn('Error preparing app:', error);
      } finally {
        if (mounted) {
          setAppIsReady(true);
        }
      }
    };

    prepareApp();

    return () => {
      mounted = false;
    };
  }, []);

  // CRITICAL FIX: Handle app state changes - Don't save state when locked
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // App going to background - save everything immediately
      if (
        appStateRef.current === 'active' && 
        (nextAppState === 'inactive' || nextAppState === 'background')
      ) {
        console.log('💾 App going to background - saving state...');
        
        // Check if we're currently on SecurityLock - don't save that state
        const currentRoute = lastNavigationStateRef.current?.routes?.[lastNavigationStateRef.current?.index];
        
        if (currentRoute?.name !== 'SecurityLock' && lastNavigationStateRef.current) {
          try {
            await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(lastNavigationStateRef.current));
          } catch (e) {
            console.warn('Failed to save nav state on background:', e);
          }
        }
        
        await statePersistence.flushPendingSaves?.();
      }
      
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Persist navigation state when it changes
  const onNavigationStateChange = useCallback(async (state: any) => {
    if (!state) return;
    
    // Keep in ref for instant background access
    lastNavigationStateRef.current = state;
    
    try {
      const currentRoute = state.routes[state.index];
      
      // Don't persist SecurityLock state
      if (currentRoute?.name === 'SecurityLock') {
        return;
      }
      
      await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
      
      if (currentRoute) {
        await statePersistence.saveNavigationState(
          currentRoute.name,
          currentRoute.params
        );
        
        await AsyncStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({
          name: currentRoute.name,
          params: currentRoute.params,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.warn('Failed to persist navigation state:', error);
    }
  }, []);

  // Hide splash when ready
  useEffect(() => {
    if (appIsReady && isNavigationReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady, isNavigationReady]);

  if (!appIsReady || !isNavigationReady) {
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
              <AppNavigator 
                isDark={isDark} 
                initialState={initialNavigationState}
                onStateChange={onNavigationStateChange}
              />
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
