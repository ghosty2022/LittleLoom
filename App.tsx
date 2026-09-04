// App.tsx - WITHOUT Stripe
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

// FIX: Lazy load Reanimated to avoid resolution issues
let ReanimatedLoaded = false;
const loadReanimated = async () => {
  if (ReanimatedLoaded) return;
  try {
    await import('react-native-reanimated');
    ReanimatedLoaded = true;
    console.log('[App] Reanimated loaded successfully');
  } catch (error) {
    console.warn('[App] Failed to load Reanimated:', error);
  }
};

// Lazy load notification service to avoid startup issues
let notificationService: any = null;
let notificationServiceLoaded = false;

const loadNotificationService = async () => {
  if (notificationServiceLoaded) return notificationService;
  try {
    const module = await import('@/services/NotificationService');
    notificationService = module.notificationService || module.default;
    notificationServiceLoaded = true;
    return notificationService;
  } catch (error) {
    console.warn('[App] Failed to load notification service:', error);
    return null;
  }
};

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'The provided Linking scheme',
  'JavaScript logs will be removed from Metro',
  'Navigation state from different app version',
  // Ignore Reanimated warnings in development
  'Reanimated',
  'Worklets',
]);

SplashScreen.preventAutoHideAsync();

// CRITICAL FIX: Only preload essential fonts, load others lazily
const ESSENTIAL_FONTS = {
  'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
};

const NON_RESTORABLE_ROUTES = new Set([
  'SecurityLock', 'Login', 'SignUp', 'ForgotPassword', 'Onboarding'
]);

const SPLASH_THEMES = {
  trueBlack: {
    gradient: ['#000000', '#0a0a0a', '#1a1a2e'] as const,
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.7)',
    ring: 'rgba(255,255,255,0.2)',
    spinner: 'rgba(255,255,255,0.9)',
    statusBar: 'light' as const,
  },
  dark: {
    gradient: ['#0f0f1e', '#1a1a2e', '#2d1b4e'] as const,
    text: '#f1f5f9',
    subtext: 'rgba(241,245,249,0.7)',
    ring: 'rgba(255,255,255,0.2)',
    spinner: 'rgba(255,255,255,0.9)',
    statusBar: 'light' as const,
  },
  light: {
    gradient: ['#667eea', '#764ba2', '#f093fb'] as const,
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.85)',
    ring: 'rgba(255,255,255,0.3)',
    spinner: 'rgba(255,255,255,0.9)',
    statusBar: 'dark' as const,
  },
};

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

  return (
    <View style={styles.splashContainer}>
      <LinearGradient
        colors={colors.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <StatusBar style={colors.statusBar} />
      <View style={styles.splashContent}>
        <View style={[styles.splashLogoRing, { borderColor: colors.ring }]}>
          <Image
            source={require('./assets/logo.png')}
            style={styles.splashLogoImage}
            resizeMode="contain"
          />
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
      </View>
    </View>
  );
});

interface InnerAppProps {
  initialState: object | undefined;
  onStateChange: (state: object | undefined) => void;
}

const InnerApp: React.FC<InnerAppProps> = React.memo(({ initialState, onStateChange }) => {
  const { isDark } = useTheme();
  useAppLock();

  return (
    <ModalProvider>
      <View style={styles.container}>
        <AppNavigator initialState={initialState} onStateChange={onStateChange} />
        <GlobalAudioPlayer />
      </View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ModalProvider>
  );
});

export default function App(): JSX.Element | null {
  const systemScheme = useColorScheme();

  const [themeLoaded, setThemeLoaded] = useState(false);
  const [initialTheme, setInitialTheme] = useState({
    isDark: systemScheme === 'dark',
    isTrueBlack: false,
  });

  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] = useState<object | undefined>(undefined);
  const [initError, setInitError] = useState<string | null>(null);

  const lastStateRef = useRef<object | undefined>(undefined);
  const lastStateKeyRef = useRef<string>('');
  const initStartedRef = useRef(false);
  const stateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splashHiddenRef = useRef(false);
  const notificationInitRef = useRef(false);

  // Phase 0: Read theme from database immediately
  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const saved = await getAppSetting('appearance');
        if (!mounted) return;

        const isDark =
          saved === 'dark' ||
          saved === 'trueBlack' ||
          (!saved && systemScheme === 'dark');
        const isTrueBlack = saved === 'trueBlack';

        setInitialTheme({ isDark, isTrueBlack });
      } catch (e) {
        setInitialTheme({
          isDark: systemScheme === 'dark',
          isTrueBlack: false,
        });
      } finally {
        if (mounted) setThemeLoaded(true);
      }
    };

    loadTheme();
    return () => { mounted = false; };
  }, [systemScheme]);

  // Phase 1: Parallel initialization with aggressive timeout
  useEffect(() => {
    if (!themeLoaded || initStartedRef.current) return;
    initStartedRef.current = true;

    const init = async () => {
      try {
        // Load Reanimated first (non-blocking)
        loadReanimated().catch(e => {
          console.warn('[App] Reanimated load failed:', e);
        });

        // Start all init tasks in parallel - don't await them all
        const essentialTasks = Promise.all([
          // Only essential font loading
          Font.loadAsync(ESSENTIAL_FONTS).catch(e => {
            console.warn('[App] Font loading failed:', e);
            return null;
          }),
        ]);

        // Wait for essential tasks with shorter timeout
        await Promise.race([
          essentialTasks,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Essential init timeout')), 2000)
          )
        ]).catch(e => {
          console.warn('[App] Essential tasks timed out, continuing...', e);
        });

        // CRITICAL FIX: Hide splash immediately after essential tasks
        if (!splashHiddenRef.current) {
          await SplashScreen.hideAsync();
          splashHiddenRef.current = true;
        }
        setReady(true);

        // Run non-essential tasks in background (don't await)
        runBackgroundTasks().catch(e => {
          console.warn('[App] Background tasks error:', e);
        });

      } catch (e) {
        console.error('[App] Critical init error:', e);
        setInitError('Failed to initialize app');
        if (!splashHiddenRef.current) {
          await SplashScreen.hideAsync();
          splashHiddenRef.current = true;
        }
        setReady(true); // Show app even with error
      }
    };

    init();

    return () => {
      if (statePersistence && typeof statePersistence.cleanup === 'function') {
        statePersistence.cleanup();
      }
    };
  }, [themeLoaded]);

  // Background tasks that don't block startup
  const runBackgroundTasks = async () => {
    try {
      // Load additional fonts in background
      const additionalFonts = {
        'MaterialIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
        'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
        'Feather': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
      };
      Font.loadAsync(additionalFonts).catch(e => {
        console.warn('[App] Additional fonts failed:', e);
      });

      // Notification service - lazy loaded with error handling
      await initNotificationService();

      // Image directories (non-blocking)
      if (ensureAllImageDirs && typeof ensureAllImageDirs === 'function') {
        await ensureAllImageDirs();
      }

      // System UI (non-blocking)
      if (SystemUI && typeof SystemUI.setBackgroundColorAsync === 'function') {
        await SystemUI.setBackgroundColorAsync(
          initialTheme.isTrueBlack ? '#000000' : 
          initialTheme.isDark ? '#08080f' : '#f8faff'
        );
      }

      // Navigation state restoration (non-blocking)
      await restoreNavigationState();

    } catch (e) {
      console.warn('[App] Background tasks error:', e);
    }
  };

  // Lazy load notification service
  const initNotificationService = async () => {
    if (notificationInitRef.current) return;
    notificationInitRef.current = true;

    try {
      const service = await loadNotificationService();
      if (service && typeof service.initialize === 'function') {
        await service.initialize();
        console.log('[App] Notification service initialized');
      } else {
        console.log('[App] Notification service not available');
      }
    } catch (error) {
      console.warn('[App] Notification service init failed:', error);
      // Don't throw - allow app to continue
    }
  };

  // Navigation state restoration - non-blocking
  const restoreNavigationState = async () => {
    try {
      // Quick check for setup completion
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

  // Phase 2: Background state saving
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (
        AppState.currentState === 'active' &&
        (next === 'inactive' || next === 'background')
      ) {
        if (lastStateRef.current) {
          const parsed = lastStateRef.current as any;
          const route = parsed.routes?.[parsed.index];
          if (route?.name !== 'SecurityLock') {
            if (statePersistence && typeof statePersistence.saveNavigationState === 'function') {
              await statePersistence.saveNavigationState(
                lastStateRef.current,
                route?.name,
                route?.params
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

    const stateKey = (state as any)?.key || JSON.stringify((state as any)?.routes?.[(state as any)?.index]);
    if (stateKey && stateKey === lastStateKeyRef.current) return;
    if (stateKey) lastStateKeyRef.current = stateKey;

    lastStateRef.current = state;

    const parsed = state as any;
    const route = parsed.routes?.[parsed.index];
    if (route && route.name !== 'SecurityLock') {
      if (stateSaveTimerRef.current) {
        clearTimeout(stateSaveTimerRef.current);
      }
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
      if (stateSaveTimerRef.current) {
        clearTimeout(stateSaveTimerRef.current);
      }
    };
  }, []);

  if (!themeLoaded || !ready) {
    return (
      <CustomSplashScreen
        isDark={initialTheme.isDark}
        isTrueBlack={initialTheme.isTrueBlack}
      />
    );
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

  // ─── WITHOUT STRIPE ────────────────────────────────────────────────────
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
                />
              </ContextProvider>
            </AppProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </DatabaseProvider>
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
  splashLogoImage: {
    width: 72,
    height: 72,
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
    backgroundColor: '#f8faff',
    padding: 32,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
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