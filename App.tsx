import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  AppState,
  Platform,
  View,
  Text,
  useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Notifications from 'expo-notifications';
import * as Font from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

import { AppProvider, useTheme } from '@/context/AppContext';
import ContextProvider from '@/providers/ContextProvider';
import { ModalProvider } from '@/utils/modal';
import AppNavigator from '@/navigation/AppNavigator';
import { notificationService } from '@/services/NotificationService';
import { statePersistence } from '@/utils/statePersistence';
import { InlineSpinner } from '@/components/UniversalSpinner';
import { ensureAllImageDirs } from '@/utils/imageUtils';

// ─── Static imports (Metro does NOT support React.lazy + dynamic import()) ───
import ErrorBoundary from '@/components/ErrorBoundary';
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer';

SplashScreen.preventAutoHideAsync();

const APPEARANCE_STORAGE_KEY = '@littleloom_appearance_v1';

// ─── Icon fonts ───────────────────────────────────────────────────────
const ICON_FONTS_TO_PRELOAD = {
  'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  'MaterialIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
  'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
  'FontAwesome': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf'),
  'FontAwesome5_Regular': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.ttf'),
  'FontAwesome5_Solid': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.ttf'),
  'Feather': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
  'AntDesign': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.ttf'),
  'Entypo': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Entypo.ttf'),
  'EvilIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/EvilIcons.ttf'),
  'Foundation': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Foundation.ttf'),
  'Octicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Octicons.ttf'),
  'SimpleLineIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/SimpleLineIcons.ttf'),
  'Zocial': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Zocial.ttf'),
};

const CRITICAL_IMAGES_TO_PRELOAD: number[] = [];

// ─── Non-restorable routes ────────────────────────────────────────────
const NON_RESTORABLE_ROUTES = new Set([
  'SecurityLock', 'Login', 'SignUp', 'ForgotPassword', 'Onboarding'
]);

// ─── Theme hook ───────────────────────────────────────────────────────
const useSavedThemeForSplash = () => {
  const systemScheme = useColorScheme();
  const [savedAppearance, setSavedAppearance] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)
      .then(setSavedAppearance)
      .catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (!savedAppearance) return systemScheme === 'dark';
    if (savedAppearance === 'system') return systemScheme === 'dark';
    if (savedAppearance === 'trueBlack' || savedAppearance === 'dark') return true;
    return false;
  }, [savedAppearance, systemScheme]);

  const isTrueBlack = savedAppearance === 'trueBlack';

  return { isDark, isTrueBlack };
};

// ─── Optimized Splash: memoized, no re-renders ─────────────────────────
const CustomSplashScreen = React.memo(() => {
  const { isDark, isTrueBlack } = useSavedThemeForSplash();

  const colors = useMemo(() => {
    if (isTrueBlack) {
      return {
        gradient: ['#000000', '#0a0a0a', '#1a1a2e'] as const,
        text: '#ffffff',
        subtext: 'rgba(255,255,255,0.7)',
        ring: 'rgba(255,255,255,0.2)',
        spinner: 'rgba(255,255,255,0.9)',
      };
    }
    if (isDark) {
      return {
        gradient: ['#0f0f1e', '#1a1a2e', '#2d1b4e'] as const,
        text: '#f1f5f9',
        subtext: 'rgba(241,245,249,0.7)',
        ring: 'rgba(255,255,255,0.2)',
        spinner: 'rgba(255,255,255,0.9)',
      };
    }
    return {
      gradient: ['#667eea', '#764ba2', '#f093fb'] as const,
      text: '#ffffff',
      subtext: 'rgba(255,255,255,0.85)',
      ring: 'rgba(255,255,255,0.3)',
      spinner: 'rgba(255,255,255,0.9)',
    };
  }, [isDark, isTrueBlack]);

  return (
    <View style={styles.splashContainer}>
      <LinearGradient
        colors={colors.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Animated.View entering={FadeIn.duration(300)} style={styles.splashContent}>
        <View style={[styles.splashLogoRing, { borderColor: colors.ring }]}>
          <Text style={styles.splashEmoji}>🍼</Text>
        </View>
        <Text style={[styles.splashBrand, { color: colors.text }]}>
          LittleLoom
        </Text>
        <Text style={[styles.splashTagline, { color: colors.subtext }]}>
          Gentle Care, Happy Baby
        </Text>
        <View style={{ marginTop: 32 }}>
          <InlineSpinner size={28} color={colors.spinner} />
        </View>
      </Animated.View>
    </View>
  );
});

interface InnerAppProps {
  initialState: object | undefined;
  onStateChange: (state: object | undefined) => void;
}

const InnerApp: React.FC<InnerAppProps> = React.memo(({ initialState, onStateChange }) => {
  const { isDark } = useTheme();

  return (
    <ModalProvider>
      <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
        <AppNavigator initialState={initialState} onStateChange={onStateChange} />
        <GlobalAudioPlayer />
      </Animated.View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ModalProvider>
  );
});

// ─── MAIN APP: Single init, parallel everything ───────────────────────
export default function App(): JSX.Element | null {
  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] = useState<object | undefined>(undefined);
  const [initError, setInitError] = useState<string | null>(null);

  const lastStateRef = useRef<object | undefined>(undefined);
  const initStartedRef = useRef(false);

  // ─── SINGLE EFFECT: Everything parallel ─────────────────────────────
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const init = async () => {
      try {
        // Phase 1: Start ALL async work immediately in parallel
        const fontPromise = Font.loadAsync(ICON_FONTS_TO_PRELOAD);
        const imagePromise = CRITICAL_IMAGES_TO_PRELOAD.length > 0
          ? Promise.all(CRITICAL_IMAGES_TO_PRELOAD.map(uri => Image.prefetch(uri)))
          : Promise.resolve();
        const servicesPromise = Promise.all([
          notificationService.initialize().catch(e => console.warn('Notification init:', e)),
          ensureAllImageDirs().catch(e => console.warn('Image dirs init:', e)),
          SystemUI.setBackgroundColorAsync('#f8faff').catch(() => {}),
        ]);

        // Phase 2: Restore nav state (can happen in parallel with fonts)
        const navRestorePromise = (async () => {
          try {
            const navState = await statePersistence.getNavigationState();
            if (navState?.state) {
              const routeName = navState.routeName as string;
              if (!NON_RESTORABLE_ROUTES.has(routeName)) {
                setInitialState(navState.state);
              } else {
                await statePersistence.clearNavigationState();
              }
            }
          } catch (e) {
            console.warn('Nav restore failed:', e);
          }
        })();

        // Phase 3: Wait for everything to finish (parallel)
        await Promise.all([fontPromise, imagePromise, servicesPromise, navRestorePromise]);

        // Phase 4: Hide splash IMMEDIATELY when ready
        await SplashScreen.hideAsync();
        setReady(true);

      } catch (e) {
        console.error('Critical init error:', e);
        setInitError('Failed to initialize app');
        await SplashScreen.hideAsync();
      }
    };

    init();

    // Cleanup
    return () => {
      statePersistence.cleanup();
    };
  }, []);

  // ─── Background state saving ─────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (AppState.currentState === 'active' && (next === 'inactive' || next === 'background')) {
        if (lastStateRef.current) {
          const parsed = lastStateRef.current as any;
          const route = parsed.routes?.[parsed.index];
          if (route?.name !== 'SecurityLock') {
            await statePersistence.saveNavigationState(
              lastStateRef.current,
              route?.name,
              route?.params
            );
          }
        }
        await statePersistence.flushPendingSaves();
      }
    });
    return () => sub.remove();
  }, []);

  const onStateChange = useCallback((state: object | undefined) => {
    if (!state) return;
    lastStateRef.current = state;

    const parsed = state as any;
    const route = parsed.routes?.[parsed.index];
    if (route && route.name !== 'SecurityLock') {
      statePersistence.queueSave('@littleloom_nav_state_v4', {
        state,
        routeName: route.name,
        params: route.params,
        timestamp: Date.now(),
        appVersion: '2.1.0',
      });
      statePersistence.saveLastRoute(route.name, route.params);
    }
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────
  if (!ready) {
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
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  splashTagline: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
  },
});