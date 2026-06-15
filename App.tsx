import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, AppState, Platform, View, Text, useColorScheme } from 'react-native';
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
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer';
import { notificationService } from '@/services/NotificationService';
import { statePersistence } from '@/utils/statePersistence';
import { InlineSpinner } from '@/components/UniversalSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ensureAllImageDirs } from '@/utils/imageUtils';

SplashScreen.preventAutoHideAsync();

const SPLASH_MIN_DURATION = 1500;

const APPEARANCE_STORAGE_KEY = '@littleloom_appearance_v1';

// ─── FIX #1: Preload ALL icon fonts your app uses ──────────────────────
// Each of these is a .ttf file that normally loads lazily on first icon render
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

// ─── FIX #2: Preload critical images that appear on first screen ─────
// Use Image.prefetch with resolved asset modules (numbers from Metro)
const CRITICAL_IMAGES_TO_PRELOAD = [
  // Only add images that actually exist in your assets folder
  // Uncomment and adjust paths based on your actual assets:
  // require('@/assets/images/logo.png'),
  // require('@/assets/images/baby-placeholder.png'),
];

// ─── Theme-aware splash ─────────────────────────────────────────────────
const useSavedThemeForSplash = () => {
  const systemScheme = useColorScheme();
  const [savedAppearance, setSavedAppearance] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_STORAGE_KEY).then(val => {
      setSavedAppearance(val);
    }).catch(() => {});
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

const CustomSplashScreen = React.memo(() => {
  const { isDark, isTrueBlack } = useSavedThemeForSplash();

  const splashColors = useMemo(() => {
    if (isTrueBlack) {
      return {
        gradient: ['#000000', '#0a0a0a', '#1a1a2e'] as const,
        textColor: '#ffffff',
        subtextColor: 'rgba(255,255,255,0.7)',
        ringColor: 'rgba(255,255,255,0.2)',
        spinnerColor: 'rgba(255,255,255,0.9)',
      };
    }
    if (isDark) {
      return {
        gradient: ['#0f0f1e', '#1a1a2e', '#2d1b4e'] as const,
        textColor: '#f1f5f9',
        subtextColor: 'rgba(241,245,249,0.7)',
        ringColor: 'rgba(255,255,255,0.2)',
        spinnerColor: 'rgba(255,255,255,0.9)',
      };
    }
    return {
      gradient: ['#667eea', '#764ba2', '#f093fb'] as const,
      textColor: '#ffffff',
      subtextColor: 'rgba(255,255,255,0.85)',
      ringColor: 'rgba(255,255,255,0.3)',
      spinnerColor: 'rgba(255,255,255,0.9)',
    };
  }, [isDark, isTrueBlack]);

  return (
    <View style={styles.splashContainer}>
      <LinearGradient
        colors={splashColors.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Animated.View entering={FadeIn.duration(400)} style={styles.splashContent}>
        <View style={[styles.splashLogoRing, { borderColor: splashColors.ringColor }]}>
          <Text style={styles.splashEmoji}>🍼</Text>
        </View>
        <Text style={[styles.splashBrand, { color: splashColors.textColor }]}>
          LittleLoom
        </Text>
        <Text style={[styles.splashTagline, { color: splashColors.subtextColor }]}>
          Gentle Care, Happy Baby
        </Text>
        <View style={{ marginTop: 32 }}>
          <InlineSpinner size={28} color={splashColors.spinnerColor} />
        </View>
      </Animated.View>
    </View>
  );
});

const ErrorFallback = React.memo(() => (
  <View style={styles.errorContainer}>
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={StyleSheet.absoluteFill}
    />
    <Text style={styles.errorEmoji}>😔</Text>
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorSubtitle}>Please restart the app</Text>
  </View>
));

interface InnerAppProps {
  initialState: object | undefined;
  onStateChange: (state: object | undefined) => void;
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

export default function App(): JSX.Element | null {
  const [appReady, setAppReady] = useState(false);
  const [navReady, setNavReady] = useState(Platform.OS === 'web');
  const [initialState, setInitialState] = useState<object | undefined>(undefined);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [fontsPreloaded, setFontsPreloaded] = useState(false);

  const lastStateRef = useRef<object | undefined>(undefined);
  const initRef = useRef(false);
  const splashMinTimeRef = useRef<number>(0);
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── FIX #3: Preload icon fonts FIRST — before anything else renders ─
  useEffect(() => {
    const preloadFonts = async () => {
      try {
        splashMinTimeRef.current = Date.now() + SPLASH_MIN_DURATION;

        // Load ALL icon fonts in parallel
        await Font.loadAsync(ICON_FONTS_TO_PRELOAD);

        // Preload critical images into memory (only if you have images to preload)
        if (CRITICAL_IMAGES_TO_PRELOAD.length > 0) {
          await Promise.all(
            CRITICAL_IMAGES_TO_PRELOAD.map(uri => Image.prefetch(uri))
          );
        }

        setFontsPreloaded(true);
      } catch (e) {
        console.warn('Font preload warning:', e);
        // Don't block app start if fonts fail — they'll load lazily
        setFontsPreloaded(true);
      }
    };

    preloadFonts();
  }, []);

  // ─── Phase 1: Initialize services (fast, no blocking) ──────────────────
  useEffect(() => {
    const init = async () => {
      try {
        statePersistence.initialize();

        await Promise.all([
          notificationService.initialize().catch(e => console.warn('Notification init:', e)),
          ensureAllImageDirs().catch(e => console.warn('Image dirs init:', e)),
          SystemUI.setBackgroundColorAsync('#f8faff').catch(() => {}),
        ]);

        await statePersistence.clearOldState(7);

      } catch (e) {
        console.warn('Non-critical initialization error:', e);
      }
    };
    init();

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.screen) {
        console.log('Navigate to:', data.screen);
      }
    });

    return () => {
      sub.remove();
      statePersistence.cleanup();
    };
  }, []);

  // ─── Phase 2: Restore navigation state ──────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const restore = async () => {
      try {
        const navState = await statePersistence.getNavigationState();

        if (navState?.state) {
          const nonRestorableRoutes = [
            'SecurityLock', 'Login', 'SignUp', 'ForgotPassword', 'Onboarding'
          ];

          if (!nonRestorableRoutes.includes(navState.routeName)) {
            setInitialState(navState.state);
          } else {
            await statePersistence.clearNavigationState();
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

  // ─── Phase 3: Background state saving ──────────────────────────────────
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

  // ─── FIX #4: Only hide splash when fonts are preloaded AND everything ready
  useEffect(() => {
    const hideSplash = async () => {
      if (appReady && navReady && fontsPreloaded) {
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
  }, [appReady, navReady, fontsPreloaded]);

  useEffect(() => {
    return () => {
      if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    };
  }, []);

  // ─── FIX #5: Mark app ready after short delay to let contexts init ───
  useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!appReady || !navReady || !fontsPreloaded || showCustomSplash) {
    return <CustomSplashScreen />;
  }

  if (initError) {
    return <ErrorFallback />;
  }

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
});
