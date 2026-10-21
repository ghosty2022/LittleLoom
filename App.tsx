import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  AppState,
  View,
  Text,
  Image,
  useColorScheme,
  LogBox,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAppLock } from '@/hooks/useAppLock';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Font from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, FadeIn, FadeInDown,
} from 'react-native-reanimated';
import { getAppSetting } from '@/database/dbHelpers';
import { DatabaseProvider } from '@/context/DatabaseContext';

import { AppProvider, useTheme } from '@/context/AppContext';
import ContextProvider from '@/providers/ContextProvider';
import { ModalProvider } from '@/utils/modal';
import AppNavigator from '@/navigation/AppNavigator';
import { statePersistence } from '@/utils/statePersistence';
import { InlineSpinner } from '@/components/UniversalSpinner';
import { ensureAllImageDirs } from '@/utils/imageUtils';

import ErrorBoundary from '@/components/ErrorBoundary';
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer';

import { AIBootstrapGate } from '@/components/AIBootstrapGate';

import SweetAlertProvider from '@/components/SweetAlert';
import { setSweetAlert } from '@/utils/imageUtils';
import { useSweetAlert } from '@/components/SweetAlert';

import { notificationService } from '@/services/NotificationService';

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'The provided Linking scheme',
  'JavaScript logs will be removed from Metro',
  'Navigation state from different app version',
  'Reanimated',
  'Worklets',
  'expo-ai-kit',
  'react-native-executorch',
  'edge-llm',
]);

SplashScreen.preventAutoHideAsync();

const ESSENTIAL_FONTS = {
  Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
};

const NON_RESTORABLE_ROUTES = new Set([
  'SecurityLock', 'Login', 'SignUp', 'ForgotPassword', 'Onboarding',
]);

const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({
  children, style, colors = ['#667eea', '#764ba2', '#f093fb'],
}: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return (
          <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>
            {l}
          </Text>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Splash theme palettes
   ═══════════════════════════════════════════════════════════════════════════ */

const SPLASH_THEMES = {
  trueBlack: {
    gradient: ['#000000', '#0a0a0a', '#1a1a2e'] as const,
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.7)',
    ring: 'rgba(255,255,255,0.2)',
    glow: 'rgba(139,92,246,0.35)',
    glow2: 'rgba(236,72,153,0.25)',
    spinner: 'rgba(255,255,255,0.9)',
    statusBar: 'light' as const,
  },
  dark: {
    gradient: ['#0f0f1e', '#1a1a2e', '#2d1b4e'] as const,
    text: '#f1f5f9',
    subtext: 'rgba(241,245,249,0.7)',
    ring: 'rgba(255,255,255,0.2)',
    glow: 'rgba(139,92,246,0.4)',
    glow2: 'rgba(236,72,153,0.3)',
    spinner: 'rgba(255,255,255,0.9)',
    statusBar: 'light' as const,
  },
  light: {
    gradient: ['#f8faff', '#eef0f5', '#e4e8f0'] as const,
    text: '#1c1917',
    subtext: 'rgba(28,25,23,0.65)',
    ring: 'rgba(99,102,241,0.25)',
    glow: 'rgba(99,102,241,0.25)',
    glow2: 'rgba(236,72,153,0.2)',
    spinner: 'rgba(99,102,241,0.9)',
    statusBar: 'dark' as const,
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   CustomSplashScreen — the ONLY startup splash
   ═══════════════════════════════════════════════════════════════════════════ */

interface CustomSplashScreenProps {
  isDark: boolean;
  isTrueBlack: boolean;
}

const CustomSplashScreen = React.memo<CustomSplashScreenProps>(({ isDark, isTrueBlack }) => {
  const colors = isTrueBlack
    ? SPLASH_THEMES.trueBlack
    : isDark
    ? SPLASH_THEMES.dark
    : SPLASH_THEMES.light;

  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 12000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.85, { duration: 2000 }), withTiming(0.4, { duration: 2000 })), -1, true);
  }, [pulse, rotate, glow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.splashContainer}>
      <LinearGradient
        colors={colors.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={[colors.glow, 'transparent']}
        style={styles.splashGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[colors.glow2, 'transparent']}
        style={styles.splashGlowBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
      />

      <StatusBar style={colors.statusBar} />
      <Animated.View entering={FadeIn.duration(400)} style={styles.splashContent}>
        <View style={styles.splashLogoWrap}>
          <Animated.View style={[styles.splashGlowRing, { backgroundColor: colors.glow }, glowStyle]} />
          <Animated.View style={[styles.splashLogoRing, { borderColor: colors.ring }, ringStyle]}>
            <LinearGradient
              colors={['#667eea', '#764ba2', '#f093fb', '#667eea']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <View style={[styles.splashLogoInner, { backgroundColor: isTrueBlack ? '#000' : isDark ? '#0f0f1e' : '#f8faff' }]}>
            <Image
              source={require('./assets/logo.png')}
              style={styles.splashLogoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.splashBrand}>
            LittleLoom
          </GradientText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(350)}>
          <Text style={[styles.splashTagline, { color: colors.subtext }]}>
            Gentle Care, Happy Baby
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200).duration(300)} style={{ marginTop: 32 }}>
          <InlineSpinner size={28} color={colors.spinner} />
        </Animated.View>
      </Animated.View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   InnerApp
   ═══════════════════════════════════════════════════════════════════════════ */

interface InnerAppProps {
  initialState: object | undefined;
  onStateChange: (state: object | undefined) => void;
  initialRouteName?: 'Login' | 'Onboarding' | 'Main' | 'Splash';
}

const InnerApp: React.FC<InnerAppProps> = React.memo(({ initialState, onStateChange, initialRouteName }) => {
  const { isDark, colors: themeColors } = useTheme();
  useAppLock();

  const sweetAlert = useSweetAlert();

  useEffect(() => {
    setSweetAlert(sweetAlert);
  }, [sweetAlert]);

  return (
    <SweetAlertProvider
      isDark={isDark}
      themeColors={{
        primary: themeColors?.primary || '#6366f1',
        secondary: themeColors?.secondary || '#8b5cf6',
        accent: themeColors?.accent || '#ec4899',
      }}
      reduceMotion={false}
    >
      <ModalProvider>
        <View style={styles.container}>
          <AIBootstrapGate />
          <AppNavigator
            initialState={initialState}
            onStateChange={onStateChange}
            initialRouteName={initialRouteName}
          />
          <GlobalAudioPlayer />
        </View>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ModalProvider>
    </SweetAlertProvider>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   App — full lifecycle preserved
   ═══════════════════════════════════════════════════════════════════════════ */

export default function App(): React.ReactElement | null {
  const systemScheme = useColorScheme();

  const [themeLoaded, setThemeLoaded] = useState(false);
  const [initialTheme, setInitialTheme] = useState({
    isDark: systemScheme === 'dark',
    isTrueBlack: false,
  });

  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] = useState<object | undefined>(undefined);
  const [initError, setInitError] = useState<string | null>(null);
  const [initialRouteName, setInitialRouteName] = useState<'Login' | 'Onboarding' | 'Main' | 'Splash'>('Splash');

  const lastStateRef = useRef<object | undefined>(undefined);
  const lastStateKeyRef = useRef<string>('');
  const initStartedRef = useRef(false);
  const stateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splashHiddenRef = useRef(false);
  const notificationInitRef = useRef(false);
  const sessionCleanupDoneRef = useRef(false);

  /* ── Session cleanup ── */
  useEffect(() => {
    if (sessionCleanupDoneRef.current) return;
    sessionCleanupDoneRef.current = true;

    const clearCorruptedSession = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const authKeys = keys.filter(
          (k) => typeof k === 'string' && (
            k.includes('auth-token') || k.startsWith('sb-') || k.includes('supabase.auth')
          )
        );
        if (authKeys.length === 0) return;

        for (const key of authKeys) {
          try {
            const value = await AsyncStorage.getItem(key);
            if (!value) continue;
            let parsed: any = null;
            try {
              parsed = JSON.parse(value);
            } catch {
              console.log('[App] 🧹 Removing non-JSON auth key:', key);
              await AsyncStorage.removeItem(key);
              continue;
            }
            const hasAccessToken =
              parsed?.access_token || parsed?.session?.access_token || parsed?.currentSession?.access_token;
            const hasUser =
              parsed?.user || parsed?.session?.user || parsed?.currentSession?.user;
            if (!hasAccessToken && !hasUser) {
              console.log('[App] 🧹 Removing corrupted auth key:', key);
              await AsyncStorage.removeItem(key);
            }
          } catch (innerErr) {
            console.warn('[App] Session cleanup inner error:', innerErr);
          }
        }
      } catch (e) {
        console.warn('[App] Session cleanup error:', e);
      }
    };
    clearCorruptedSession();
  }, []);

  /* ── Theme load + initial route pre-check ── */
  useEffect(() => {
    let mounted = true;
    const loadTheme = async () => {
      try {
        // Both reads in parallel — shaves 30-80ms off cold boot.
        const [saved, seenOnboarding] = await Promise.all([
          getAppSetting('appearance').catch(() => null),
          AsyncStorage.getItem(ONBOARDING_SEEN_KEY).catch(() => null),
        ]);
        if (!mounted) return;

        const isDark =
          saved === 'dark' || saved === 'trueBlack' || (!saved && systemScheme === 'dark');
        const isTrueBlack = saved === 'trueBlack';
        setInitialTheme({ isDark, isTrueBlack });

        // Pre-compute initial route so the Splash route never has to mount.
        if (seenOnboarding === 'true') {
          setInitialRouteName('Login');
        } else {
          setInitialRouteName('Onboarding');
        }
      } catch {
        if (!mounted) return;
        setInitialTheme({ isDark: systemScheme === 'dark', isTrueBlack: false });
        setInitialRouteName('Login');
      } finally {
        if (mounted) setThemeLoaded(true);
      }
    };
    loadTheme();
    return () => { mounted = false; };
  }, [systemScheme]);

  /* ── Main init ── */
  useEffect(() => {
    if (!themeLoaded || initStartedRef.current) return;
    initStartedRef.current = true;

    const init = async () => {
      try {
        const essentialTasks = Promise.all([
          Font.loadAsync(ESSENTIAL_FONTS).catch((e) => {
            console.warn('[App] Font loading failed:', e);
            return null;
          }),
        ]);

        await Promise.race([
          essentialTasks,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Essential init timeout')), 1500)
          ),
        ]).catch((e) => {
          console.warn('[App] Essential tasks timed out, continuing...', e);
        });

        if (!splashHiddenRef.current) {
          await SplashScreen.hideAsync();
          splashHiddenRef.current = true;
        }
        setReady(true);

        runBackgroundTasks().catch((e) => {
          console.warn('[App] Background tasks error:', e);
        });
      } catch (e) {
        console.error('[App] Critical init error:', e);
        setInitError('Failed to initialize app');
        if (!splashHiddenRef.current) {
          await SplashScreen.hideAsync();
          splashHiddenRef.current = true;
        }
        setReady(true);
      }
    };

    init();

    return () => {
      if (statePersistence && typeof statePersistence.cleanup === 'function') {
        statePersistence.cleanup();
      }
    };
  }, [themeLoaded]);

  const runBackgroundTasks = async () => {
    try {
      const additionalFonts = {
        MaterialIcons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
        MaterialCommunityIcons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
        Feather: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
      };
      Font.loadAsync(additionalFonts).catch((e) => {
        console.warn('[App] Additional fonts failed:', e);
      });

      await initNotificationService();

      if (ensureAllImageDirs && typeof ensureAllImageDirs === 'function') {
        await ensureAllImageDirs();
      }

      if (SystemUI && typeof SystemUI.setBackgroundColorAsync === 'function') {
        await SystemUI.setBackgroundColorAsync(
          initialTheme.isTrueBlack ? '#000000' : initialTheme.isDark ? '#08080f' : '#f8faff'
        );
      }

      await restoreNavigationState();
    } catch (e) {
      console.warn('[App] Background tasks error:', e);
    }
  };

  const initNotificationService = async () => {
    if (notificationInitRef.current) return;
    notificationInitRef.current = true;
    try {
      const success = await notificationService.initialize();
      if (success) {
        console.log('[App] ✅ Notification service ready');
      } else {
        console.log('[App] ⚠️ Notification service initialized with warnings');
      }
    } catch (error) {
      console.warn('[App] Notification service init failed:', error);
    }
  };

  const restoreNavigationState = async () => {
    try {
      const [setupCompleteStr, hasParent2Str, hasBabyStr, wasLocked] = await Promise.all([
        AsyncStorage.getItem('littleloom_setup_complete'),
        AsyncStorage.getItem('littleloom_parent2_completed'),
        AsyncStorage.getItem('littleloom_baby_completed'),
        AsyncStorage.getItem('littleloom_security_lock'),
      ]);

      const hasParent2 = hasParent2Str === 'true' || hasParent2Str === 'skipped';
      const hasBaby = hasBabyStr === 'true' || hasBabyStr === 'skipped';
      const setupDone = setupCompleteStr === 'true' || (hasParent2 && hasBaby);

      if (!setupDone || wasLocked === 'true') {
        if (statePersistence && typeof statePersistence.clearNavigationState === 'function') {
          await statePersistence.clearNavigationState();
        }
        return;
      }

      if (statePersistence && typeof statePersistence.getNavigationState === 'function') {
        const navState = await statePersistence.getNavigationState();
        if (navState?.state) {
          const routeName = navState.routeName as string;
          if (!NON_RESTORABLE_ROUTES.has(routeName)) {
            setInitialState(navState.state);
          } else if (statePersistence && typeof statePersistence.clearNavigationState === 'function') {
            await statePersistence.clearNavigationState();
          }
        }
      }
    } catch (e) {
      console.warn('[App] Nav restore failed:', e);
    }
  };

  /* ── AppState persistence ── */
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next === 'active') {
        notificationService.flushQueue().catch(() => {});
      }
      if (AppState.currentState === 'active' && (next === 'inactive' || next === 'background')) {
        if (lastStateRef.current) {
          const parsed = lastStateRef.current as any;
          const route = parsed.routes?.[parsed.index];
          if (route?.name !== 'SecurityLock') {
            if (statePersistence && typeof statePersistence.saveNavigationState === 'function') {
              await statePersistence.saveNavigationState(
                lastStateRef.current, route?.name, route?.params
              );
            }
          }
        }
        if (statePersistence && typeof statePersistence.flushPendingSaves === 'function') {
          await statePersistence.flushPendingSaves();
        }
      }
    });
    return () => sub.remove();
  }, []);

  const onStateChange = useCallback((state: object | undefined) => {
    if (!state) return;
    const stateKey =
      (state as any)?.key || JSON.stringify((state as any)?.routes?.[(state as any)?.index]);
    if (stateKey && stateKey === lastStateKeyRef.current) return;
    if (stateKey) lastStateKeyRef.current = stateKey;
    lastStateRef.current = state;

    const parsed = state as any;
    const route = parsed.routes?.[parsed.index];
    if (route && route.name !== 'SecurityLock') {
      if (stateSaveTimerRef.current) clearTimeout(stateSaveTimerRef.current);
      stateSaveTimerRef.current = setTimeout(() => {
        if (statePersistence && typeof statePersistence.queueSave === 'function') {
          statePersistence.queueSave('@littleloom_nav_state_v4', {
            state,
            routeName: route.name,
            params: route.params,
            timestamp: Date.now(),
            appVersion: '2.1.0',
          });
        }
        if (statePersistence && typeof statePersistence.saveLastRoute === 'function') {
          statePersistence.saveLastRoute(route.name, route.params);
        }
        stateSaveTimerRef.current = null;
      }, 2000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (stateSaveTimerRef.current) clearTimeout(stateSaveTimerRef.current);
    };
  }, []);

  /* ── Render gates ── */
  if (!themeLoaded || !ready) {
    return <CustomSplashScreen isDark={initialTheme.isDark} isTrueBlack={initialTheme.isTrueBlack} />;
  }

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>😵</Text>
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
      </View>
    );
  }

  return (
    <DatabaseProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={styles.root}>
          <SafeAreaProvider>
            <AppProvider>
              <ContextProvider>
                <InnerApp
                  initialState={initialState}
                  onStateChange={onStateChange}
                  initialRouteName={initialRouteName}
                />
              </ContextProvider>
            </AppProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </DatabaseProvider>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },

  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  splashGlowTopLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  splashGlowBottomRight: {
    position: 'absolute',
    bottom: -140,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  splashContent: { alignItems: 'center', zIndex: 1 },
  splashLogoWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 28,
  },
  splashGlowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  splashLogoRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: 'hidden',
    borderWidth: 2,
  },
  splashLogoInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogoImage: { width: 68, height: 68 },
  splashBrand: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  splashTagline: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
    marginTop: 8,
    textAlign: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8faff',
    padding: 32,
  },
  errorEmoji: { fontSize: 64, marginBottom: 16 },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});