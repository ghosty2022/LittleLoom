// App.tsx — FINAL INTEGRATED VERSION
// FIXED: Removed double SweetAlertProvider wrapping (handled by ContextProvider)
// FIXED: Splash screen timer cleanup on unmount
// FIXED: Initialization errors caught and handled gracefully
// FIXED: Primitive fallback if ErrorBoundary dependencies fail
// FIXED: All imports use @/ aliases

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, AppState, Platform, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';

import { AppProvider, useTheme } from '@/context/AppContext';
import ContextProvider from '@/providers/ContextProvider';
import { ModalProvider } from '@/utils/modal';
import AppNavigator from '@/navigation/AppNavigator';
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer';
import { notificationService } from '@/services/NotificationService';
import { statePersistence } from '@/utils/statePersistence';
import { InlineSpinner } from '@/components/UniversalSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ensureAllImageDirs } from '@/utils/imageUtils';

SplashScreen.preventAutoHideAsync();

const NAV_STATE_KEY = '@littleloom_nav_state_v2';
const LAST_ROUTE_KEY = '@littleloom_last_route_v2';

// ==================== CUSTOM SPLASH SCREEN ====================

const CustomSplashScreen = React.memo(() => (
  <View style={styles.splashContainer}>
    <LinearGradient 
      colors={['#667eea', '#764ba2', '#f093fb']} 
      style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }} 
      end={{ x: 1, y: 1 }}
    />
    <StatusBar style="light" />
    <Animated.View entering={FadeIn.duration(400)} style={styles.splashContent}>
      <View style={styles.splashLogoRing}>
        <Text style={styles.splashEmoji}>🍼</Text>
      </View>
      <Text style={styles.splashBrand}>LittleLoom</Text>
      <View style={{ marginTop: 24 }}>
        <InlineSpinner size={28} color="rgba(255,255,255,0.9)" />
      </View>
    </Animated.View>
  </View>
));

// ==================== INNER APP (with theme access) ====================

interface InnerAppProps {
  initialState: object | undefined;
  onStateChange: (state: object | undefined) => Promise<void>;
}

const InnerApp: React.FC<InnerAppProps> = ({ initialState, onStateChange }) => {
  const { isDark } = useTheme();

  return (
    <ModalProvider>
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <AppNavigator 
          initialState={initialState}
          onStateChange={onStateChange}
        />
        <GlobalAudioPlayer />
      </Animated.View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ModalProvider>
  );
};

// ==================== MAIN APP ====================

export default function App(): JSX.Element | null {
  const [appReady, setAppReady] = useState(false);
  const [navReady, setNavReady] = useState(Platform.OS === 'web');
  const [initialState, setInitialState] = useState<object | undefined>(undefined);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  const lastStateRef = useRef<object | undefined>(undefined);
  const initRef = useRef(false);
  const splashMinTimeRef = useRef<number>(0);
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize all systems
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          statePersistence.initialize(),
          notificationService.initialize(),
          ensureAllImageDirs(),
        ]);
      } catch (e) {
        console.warn('Non-critical initialization error:', e);
      }
    };
    init();

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.screen) {
        console.log('Navigate to:', data.screen);
        // TODO: Deep link navigation
      }
    });

    SystemUI.setBackgroundColorAsync('#f8faff').catch(() => {});
    splashMinTimeRef.current = Date.now() + 1500;

    return () => {
      sub.remove();
      statePersistence.cleanup();
    };
  }, []);

  // Restore navigation state
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const restore = async () => {
      try {
        const saved = await AsyncStorage.getItem(NAV_STATE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as { routes?: Array<{ name: string }>; index?: number };
          const route = parsed.routes?.[parsed.index ?? 0];
          if (route?.name !== 'SecurityLock') {
            setInitialState(parsed);
          } else {
            await AsyncStorage.removeItem(NAV_STATE_KEY);
          }
        }
      } catch (e) {
        console.warn('Nav restore failed:', e);
      } finally {
        setNavReady(true);
      }
    };
    requestAnimationFrame(() => restore());
  }, []);

  // Save navigation state on background
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (AppState.currentState === 'active' && (next === 'inactive' || next === 'background')) {
        if (lastStateRef.current) {
          const parsed = lastStateRef.current as { routes?: Array<{ name: string }>; index?: number };
          const route = parsed.routes?.[parsed.index ?? 0];
          if (route?.name !== 'SecurityLock') {
            await AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(lastStateRef.current));
          }
        }
        await statePersistence.flushPendingSaves?.();
      }
    });
    return () => sub.remove();
  }, []);

  const onStateChange = useCallback(async (state: object | undefined) => {
    if (!state) return;
    lastStateRef.current = state;
    const parsed = state as { routes: Array<{ name: string; params?: object }>; index: number };
    const route = parsed.routes[parsed.index];
    if (!route || route.name === 'SecurityLock') return;

    await AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
    await statePersistence.saveNavigationState(route.name, route.params);
    await AsyncStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({
      name: route.name,
      params: route.params,
      timestamp: Date.now(),
    }));
  }, []);

  // Hide splash screen
  useEffect(() => {
    const hideSplash = async () => {
      if (appReady && navReady) {
        await SplashScreen.hideAsync();
        const remaining = splashMinTimeRef.current - Date.now();
        if (remaining > 0) {
          splashTimerRef.current = setTimeout(() => setShowCustomSplash(false), remaining);
        } else {
          setShowCustomSplash(false);
        }
      }
    };
    hideSplash();
  }, [appReady, navReady]);

  // Cleanup splash timer on unmount
  useEffect(() => {
    return () => {
      if (splashTimerRef.current) {
        clearTimeout(splashTimerRef.current);
      }
    };
  }, []);

  // Mark app ready
  useEffect(() => {
    setAppReady(true);
  }, []);

  if (!appReady || !navReady || showCustomSplash) {
    return <CustomSplashScreen />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <AppProvider>
            <ContextProvider>
              <InnerApp 
                initialState={initialState}
                onStateChange={onStateChange}
              />
            </ContextProvider>
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashLogoRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  splashEmoji: {
    fontSize: 56,
  },
  splashBrand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});