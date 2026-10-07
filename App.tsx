
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

const CustomSplashScreen = React.memo<CustomSplashScreenProps>(
  ({ isDark, isTrueBlack }) => {
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
  }
);

interface InnerAppProps {
  initialState: object | undefined;
  onStateChange: (state: object | undefined) => void;
}

const InnerApp: React.FC<InnerAppProps> = React.memo(
  ({ initialState, onStateChange }) => {
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
            {/* AI initializes in background — does not block children */}
            <AIBootstrapGate />
            <AppNavigator
              initialState={initialState}
              onStateChange={onStateChange}
            />
            <GlobalAudioPlayer />
          </View>
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </ModalProvider>
      </SweetAlertProvider>
    );
  }
);

export default function App(): React.ReactElement | null {
  const systemScheme = useColorScheme();

  const [themeLoaded, setThemeLoaded] = useState(false);
  const [initialTheme, setInitialTheme] = useState({
    isDark: systemScheme === 'dark',
    isTrueBlack: false,
  });

  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] = useState<object | undefined>(
    undefined
  );
  const [initError, setInitError] = useState<string | null>(null);

  const lastStateRef = useRef<object | undefined>(undefined);
  const lastStateKeyRef = useRef<string>('');
  const initStartedRef = useRef(false);
  const stateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const splashHiddenRef = useRef(false);
  const notificationInitRef = useRef(false);
  const sessionCleanupDoneRef = useRef(false);

  
  useEffect(() => {
    if (sessionCleanupDoneRef.current) return;
    sessionCleanupDoneRef.current = true;

    const clearCorruptedSession = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const authKeys = keys.filter(
          (k) =>
            typeof k === 'string' &&
            (k.includes('auth-token') ||
              k.startsWith('sb-') ||
              k.includes('supabase.auth'))
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
              parsed?.access_token ||
              parsed?.session?.access_token ||
              parsed?.currentSession?.access_token;

            const hasUser =
              parsed?.user ||
              parsed?.session?.user ||
              parsed?.currentSession?.user;

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
      } catch {
        setInitialTheme({
          isDark: systemScheme === 'dark',
          isTrueBlack: false,
        });
      } finally {
        if (mounted) setThemeLoaded(true);
      }
    };

    loadTheme();
    return () => {
      mounted = false;
    };
  }, [systemScheme]);

  
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
            setTimeout(
              () => reject(new Error('Essential init timeout')),
              2000
            )
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
          initialTheme.isTrueBlack
            ? '#000000'
            : initialTheme.isDark
            ? '#08080f'
            : '#f8faff'
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
      const [setupCompleteStr, hasParent2Str, hasBabyStr, wasLocked] =
        await Promise.all([
          AsyncStorage.getItem('littleloom_setup_complete'),
          AsyncStorage.getItem('littleloom_parent2_completed'),
          AsyncStorage.getItem('littleloom_baby_completed'),
          AsyncStorage.getItem('littleloom_security_lock'),
        ]);

      const hasParent2 =
        hasParent2Str === 'true' || hasParent2Str === 'skipped';
      const hasBaby = hasBabyStr === 'true' || hasBabyStr === 'skipped';
      const setupDone =
        setupCompleteStr === 'true' || (hasParent2 && hasBaby);

      if (!setupDone || wasLocked === 'true') {
        if (
          statePersistence &&
          typeof statePersistence.clearNavigationState === 'function'
        ) {
          await statePersistence.clearNavigationState();
        }
        return;
      }

      if (
        statePersistence &&
        typeof statePersistence.getNavigationState === 'function'
      ) {
        const navState = await statePersistence.getNavigationState();
        if (navState?.state) {
          const routeName = navState.routeName as string;
          if (!NON_RESTORABLE_ROUTES.has(routeName)) {
            setInitialState(navState.state);
          } else if (
            statePersistence &&
            typeof statePersistence.clearNavigationState === 'function'
          ) {
            await statePersistence.clearNavigationState();
          }
        }
      }
    } catch (e) {
      console.warn('[App] Nav restore failed:', e);
    }
  };

  
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next === 'active') {
        notificationService.flushQueue().catch(() => {});
      }

      if (
        AppState.currentState === 'active' &&
        (next === 'inactive' || next === 'background')
      ) {
        if (lastStateRef.current) {
          const parsed = lastStateRef.current as any;
          const route = parsed.routes?.[parsed.index];
          if (route?.name !== 'SecurityLock') {
            if (
              statePersistence &&
              typeof statePersistence.saveNavigationState === 'function'
            ) {
              await statePersistence.saveNavigationState(
                lastStateRef.current,
                route?.name,
                route?.params
              );
            }
          }
        }
        if (
          statePersistence &&
          typeof statePersistence.flushPendingSaves === 'function'
        ) {
          await statePersistence.flushPendingSaves();
        }
      }
    });
    return () => sub.remove();
  }, []);

  const onStateChange = useCallback((state: object | undefined) => {
    if (!state) return;

    const stateKey =
      (state as any)?.key ||
      JSON.stringify((state as any)?.routes?.[(state as any)?.index]);
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
        if (
          statePersistence &&
          typeof statePersistence.queueSave === 'function'
        ) {
          statePersistence.queueSave('@littleloom_nav_state_v4', {
            state,
            routeName: route.name,
            params: route.params,
            timestamp: Date.now(),
            appVersion: '2.1.0',
          });
        }
        if (
          statePersistence &&
          typeof statePersistence.saveLastRoute === 'function'
        ) {
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
  splashContent: { alignItems: 'center' },
  splashLogoRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  splashLogoImage: { width: 72, height: 72 },
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