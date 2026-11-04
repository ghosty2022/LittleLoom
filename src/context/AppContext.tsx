


import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useColorScheme, AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as KeepAwake from 'expo-keep-awake';
import * as Device from 'expo-device';
import { supabase } from '@/utils/supabase';
import { getAppSetting, setAppSetting } from '@/database/dbHelpers';
import { useCustomization, AppearanceMode } from '../hooks/useCustomization';



const BACKGROUND_SYNC_TASK = 'BACKGROUND_NOTIFICATION_SYNC';

if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      const result = await performBackgroundNotificationSync();
      return result?.hasUpdates
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
      console.error('[BackgroundSync] Task error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}



export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  primaryLight: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  glassBackground: string;
  glassBorder: string;
  navBackground: string;
  handleBar: string;
  shadowColor: string;
}

export interface NotificationSettings {
  enabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  allowBackgroundSync: boolean;
  syncInterval: number;
  achievementReminders: boolean;
  streakReminders: boolean;
  chatNotifications: boolean;
  safetyAlerts: boolean;
  dailySummary: boolean;
  activityReminders: boolean;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: 'default' | boolean;
  priority?: 'high' | 'normal' | 'low';
  badge?: number;
}

export interface ScheduledNotification {
  id: string;
  payload: NotificationPayload;
  trigger: Notifications.NotificationTriggerInput | null;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  scheduledAt: number;
  sentAt?: number;
  error?: string;
}

export interface AppContextType {
  
  themeMode: ThemeMode;
  appearance: AppearanceMode;
  isDark: boolean;
  isTrueBlack: boolean;
  isPureWhite: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setAppearance: (appearance: AppearanceMode) => Promise<void>;
  toggleTheme: () => void;
  setDarkMode: (isDark: boolean) => void;
  themeReady: boolean;
  isCommunityScreen: boolean;
  setCommunityScreen: (isCommunity: boolean) => void;

  
  notificationSettings: NotificationSettings;
  isNotificationReady: boolean;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  scheduleNotification: (payload: NotificationPayload, trigger?: Notifications.NotificationTriggerInput) => Promise<string | null>;
  sendImmediateNotification: (payload: NotificationPayload) => Promise<string | null>;
  cancelNotification: (id: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  getScheduledNotifications: () => Promise<Notifications.NotificationRequest[]>;
  getNotificationHistory: () => Promise<any[]>;
  markNotificationRead: (id: string) => Promise<void>;
  getBadgeCount: () => Promise<number>;
  isInQuietHours: () => boolean;
  enableKeepAwake: (reason?: string) => Promise<void>;
  releaseKeepAwake: () => Promise<void>;

  
  setNavigationRef: (ref: any) => void;
}



const LIGHT_COLORS: ThemeColors = {
  background: '#f8faff', surface: '#ffffff', card: '#ffffff',
  text: '#1a1a1a', textSecondary: '#64748b', border: '#e2e8f0',
  primary: '#667eea', primaryLight: '#a3bffa', accent: '#fa709a',
  success: '#22c55e', warning: '#f59e0b', error: '#ef4444',
  glassBackground: 'rgba(255,255,255,0.95)', glassBorder: 'rgba(255,255,255,0.5)',
  navBackground: '#ffffff', handleBar: 'rgba(0,0,0,0.15)', shadowColor: '#667eea',
};

const DARK_COLORS: ThemeColors = {
  background: '#08080f', surface: '#12121e', card: '#16162a',
  text: '#f0f0f7', textSecondary: '#9ca3af', border: 'rgba(255,255,255,0.05)',
  primary: '#818cf8', primaryLight: '#a5b4fc', accent: '#fb7185',
  success: '#10b981', warning: '#f59e0b', error: '#ef4444',
  glassBackground: 'rgba(26,26,42,0.96)', glassBorder: 'rgba(255,255,255,0.1)',
  navBackground: '#1a1a2e', handleBar: 'rgba(255,255,255,0.25)', shadowColor: '#000000',
};

const TRUE_BLACK_COLORS: ThemeColors = {
  background: '#000000', surface: '#0a0a0a', card: '#0d0d0d',
  text: '#ffffff', textSecondary: '#a0a0b0', border: 'rgba(255,255,255,0.06)',
  primary: '#a3bffa', primaryLight: '#818cf8', accent: '#fb7185',
  success: '#4ade80', warning: '#fbbf24', error: '#f87171',
  glassBackground: 'rgba(10,10,10,0.95)', glassBorder: 'rgba(255,255,255,0.08)',
  navBackground: '#0a0a0a', handleBar: 'rgba(255,255,255,0.25)', shadowColor: '#000000',
};

const PURE_WHITE_COLORS: ThemeColors = {
  background: '#ffffff', surface: '#fafafa', card: '#ffffff',
  text: '#000000', textSecondary: '#525252', border: '#e5e5e5',
  primary: '#4f46e5', primaryLight: '#818cf8', accent: '#e11d48',
  success: '#16a34a', warning: '#d97706', error: '#dc2626',
  glassBackground: 'rgba(255,255,255,0.98)', glassBorder: 'rgba(0,0,0,0.06)',
  navBackground: '#ffffff', handleBar: 'rgba(0,0,0,0.15)', shadowColor: '#000000',
};



const THEME_STORAGE_KEY = 'theme_mode';
const APPEARANCE_STORAGE_KEY = 'appearance';
const NOTIFICATION_SETTINGS_KEY = '@littleloom_notification_settings_v2';
const NOTIFICATION_HISTORY_KEY = '@littleloom_notification_history';
const PENDING_NOTIFICATIONS_KEY = '@littleloom_pending_notifications';
const DEVICE_ID_KEY = '@littleloom_device_id';



let _cachedAppearance: AppearanceMode | null = null;
let _cachedThemeMode: ThemeMode | null = null;
let _themeLoaded = false;
let _navigationRef: any = null;

// ── Single source of truth for "what nav ref should notification taps
//    use?". AppContext and AppNavigator both need to talk to the
//    navigator. Sharing a module-level variable that App.tsx / AppNavigator
//    never set was the reason `handleNavigation` always hit
//    `null.navigate(...)`. We now expose a setter that pulls the ref
//    from the navigationContainerRef singleton.
import { navigationRef as sharedNavigationRef } from '@/navigation/navigationRef';



const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  badgeEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  allowBackgroundSync: true,
  syncInterval: 5,
  achievementReminders: true,
  streakReminders: true,
  chatNotifications: true,
  safetyAlerts: true,
  dailySummary: true,
  activityReminders: true,
};



async function performBackgroundNotificationSync(): Promise<{ hasUpdates: boolean }> {
  try {
    const settings = await loadNotificationSettings();
    if (!settings.allowBackgroundSync) return { hasUpdates: false };

    const pending = await loadPendingNotifications();
    let hasUpdates = false;

    for (const notification of pending) {
      if (notification.status === 'pending') {
        try {
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: notification.payload.title,
              body: notification.payload.body,
              data: notification.payload.data || {},
              sound: notification.payload.sound !== false,
              badge: notification.payload.badge || 1,
              ...(Platform.OS === 'android' && {
                channelId: notification.payload.channelId || 'default',
                priority: notification.payload.priority === 'high'
                  ? Notifications.AndroidPriority.HIGH
                  : notification.payload.priority === 'low'
                    ? Notifications.AndroidPriority.LOW
                    : Notifications.AndroidPriority.DEFAULT,
              }),
            },
            trigger: null,
          });
          notification.status = 'sent';
          notification.sentAt = Date.now();
          hasUpdates = true;
        } catch (error) {
          notification.status = 'failed';
          notification.error = String(error);
        }
      }
    }

    if (hasUpdates) {
      await savePendingNotifications(pending);
    }

    return { hasUpdates };
  } catch (error) {
    console.error('[BackgroundSync] Error:', error);
    return { hasUpdates: false };
  }
}



async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await getAppSetting(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
    }
    const asyncStored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (asyncStored) {
      const parsed = { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(asyncStored) };
      await setAppSetting(NOTIFICATION_SETTINGS_KEY, JSON.stringify(parsed));
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to load notification settings:', error);
  }
  return { ...DEFAULT_NOTIFICATION_SETTINGS };
}

async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await setAppSetting(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}

async function loadPendingNotifications(): Promise<ScheduledNotification[]> {
  try {
    const stored = await getAppSetting(PENDING_NOTIFICATIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    const asyncStored = await AsyncStorage.getItem(PENDING_NOTIFICATIONS_KEY);
    if (asyncStored) {
      const parsed = JSON.parse(asyncStored);
      await setAppSetting(PENDING_NOTIFICATIONS_KEY, JSON.stringify(parsed));
      return parsed;
    }
  } catch {
    return [];
  }
  return [];
}

async function savePendingNotifications(notifications: ScheduledNotification[]): Promise<void> {
  await setAppSetting(PENDING_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  await AsyncStorage.setItem(PENDING_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

async function getDeviceId(): Promise<string> {
  try {
    let id = await getAppSetting(DEVICE_ID_KEY);
    if (id) return id;
    
    id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    await setAppSetting(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `device_${Date.now()}`;
  }
}



const AppContext = createContext<AppContextType>({
  themeMode: 'system',
  appearance: 'system',
  isDark: false,
  isTrueBlack: false,
  isPureWhite: false,
  colors: LIGHT_COLORS,
  setThemeMode: async () => {},
  setAppearance: async () => {},
  toggleTheme: () => {},
  setDarkMode: () => {},
  themeReady: false,
  isCommunityScreen: false,
  setCommunityScreen: () => {},
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationReady: false,
  updateNotificationSettings: async () => {},
  scheduleNotification: async () => null,
  sendImmediateNotification: async () => null,
  cancelNotification: async () => {},
  cancelAllNotifications: async () => {},
  getScheduledNotifications: async () => [],
  getNotificationHistory: async () => [],
  markNotificationRead: async () => {},
  getBadgeCount: () => 0,
  isInQuietHours: () => false,
  enableKeepAwake: async () => {},
  releaseKeepAwake: async () => {},
  setNavigationRef: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const customization = useCustomization();

  

  const [themeMode, setThemeModeState] = useState<ThemeMode>(_cachedThemeMode ?? 'system');
  const [appearance, setAppearanceState] = useState<AppearanceMode>(_cachedAppearance ?? 'system');
  const [themeReady, setThemeReady] = useState(_themeLoaded);
  const [isCommunityScreen, setIsCommunityScreen] = useState(false);

  

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isNotificationReady, setIsNotificationReady] = useState(false);
  const [keepAwakeRef, setKeepAwakeRef] = useState<{ release: () => Promise<void> } | null>(null);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const appStateListener = useRef<any>(null);
  const isInitialized = useRef(false);
  const initStarted = useRef(false);
  const isMounted = useRef(true);

  
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
      if (appStateListener.current) {
        appStateListener.current.remove();
        appStateListener.current = null;
      }
      if (keepAwakeRef) {
        keepAwakeRef.release().catch(() => {});
        setKeepAwakeRef(null);
      }
    };
  }, [keepAwakeRef]);

  

  useEffect(() => {
    if (_themeLoaded) return;

    let mounted = true;
    const load = async () => {
      try {
        let [savedTheme, savedAppearance] = await Promise.all([
          getAppSetting(THEME_STORAGE_KEY),
          getAppSetting(APPEARANCE_STORAGE_KEY),
        ]);

        if (!savedTheme) {
          savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
          if (savedTheme) await setAppSetting(THEME_STORAGE_KEY, savedTheme);
        }
        if (!savedAppearance) {
          savedAppearance = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
          if (savedAppearance) await setAppSetting(APPEARANCE_STORAGE_KEY, savedAppearance);
        }

        if (!mounted || !isMounted.current) return;

        const finalAppearance = (savedAppearance && ['system', 'light', 'dark', 'trueBlack', 'pureWhite'].includes(savedAppearance))
          ? savedAppearance as AppearanceMode
          : customization.settings.appearance ?? 'system';

        const finalThemeMode = (savedTheme && ['light', 'dark', 'system'].includes(savedTheme))
          ? savedTheme as ThemeMode
          : (finalAppearance === 'light' || finalAppearance === 'pureWhite') ? 'light'
          : (finalAppearance === 'dark' || finalAppearance === 'trueBlack') ? 'dark'
          : 'system';

        _cachedAppearance = finalAppearance;
        _cachedThemeMode = finalThemeMode;
        _themeLoaded = true;

        setAppearanceState(finalAppearance);
        setThemeModeState(finalThemeMode);
        setThemeReady(true);
      } catch (e) {
        console.warn('Theme load failed:', e);
        _themeLoaded = true;
        if (mounted && isMounted.current) setThemeReady(true);
      }
    };

    load();
    return () => { mounted = false; };
  }, [customization.settings.appearance]);

  

  useEffect(() => {
    if (!customization?.isLoaded || !_themeLoaded) return;
    const customApp = customization.settings?.appearance;
    if (customApp && customApp !== _cachedAppearance) {
      _cachedAppearance = customApp;
      setAppearanceState(customApp);

      const newMode: ThemeMode = (customApp === 'light' || customApp === 'pureWhite') ? 'light'
        : (customApp === 'dark' || customApp === 'trueBlack') ? 'dark' : 'system';
      _cachedThemeMode = newMode;
      setThemeModeState(newMode);

      setAppSetting(APPEARANCE_STORAGE_KEY, customApp).catch(() => {});
      setAppSetting(THEME_STORAGE_KEY, newMode).catch(() => {});
      AsyncStorage.multiSet([
        [APPEARANCE_STORAGE_KEY, customApp],
        [THEME_STORAGE_KEY, newMode],
      ]).catch(() => {});
    }
  }, [customization.isLoaded, customization.settings.appearance]);

  

  // ── NOTIFICATIONS: DELEGATE TO `NotificationService` ──────────
  // The old code ran a parallel permission flow + listener registry
  // *inside* AppContext, which meant:
  //   • Two permission prompts could race on cold boot.
  //   • Notification history was written to AsyncStorage by AppContext
  //     but read by NotificationService from a different key.
  //   • Every tap fired BOTH AppContext's handler AND AppNavigator's
  //     handler. AppContext's version routed to non-existent screens
  //     ('Safety', 'Reminders', 'Community') and always threw.
  //
  // `NotificationService` already owns channels, permissions, history,
  // queue-flush, badge count, and delivery — so AppContext now just
  // mirrors its settings and forwards writes. One source of truth.
  const ensureNotificationsInitialized = useCallback(async () => {
    if (isInitialized.current) return true;
    if (initStarted.current) {
      return new Promise<boolean>((resolve) => {
        const check = () => {
          if (isInitialized.current) resolve(true);
          else setTimeout(check, 100);
        };
        check();
      });
    }
    initStarted.current = true;

    try {
      const { notificationService } = await import('@/services/NotificationService');
      const ok = await notificationService.initialize();

      // Mirror the settings the service loaded (which is the single
      // source of truth) into our React state so the settings screen
      // shows the current toggles.
      const svcSettings = notificationService.getSettings();
      const merged: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...svcSettings,
        // `allowBackgroundSync`/`syncInterval`/`achievementReminders`/
        // `streakReminders`/`chatNotifications`/`safetyAlerts`/
        // `dailySummary`/`activityReminders` live only in AppContext's
        // local key (they're not part of NotificationService's schema).
        // Preserve whatever we loaded from AppContext storage on top.
        ...(await loadNotificationSettings()),
      };
      setNotificationSettings(merged);

      // Store & mirror history into the shared key so `getNotificationHistory`
      // returns what `NotificationService.storeNotificationHistory` wrote.
      try {
        const history = await notificationService.getNotificationHistory();
        await AsyncStorage.setItem(
          NOTIFICATION_HISTORY_KEY,
          JSON.stringify(history || []),
        );
      } catch {}

      appStateListener.current = AppState.addEventListener('change', handleAppStateChange);

      // Optional background sync — kept as-is, but now goes through
      // NotificationService so the queue actually drains.
      if (merged.allowBackgroundSync) {
        try {
          const status = await BackgroundFetch.getStatusAsync();
          if (status !== BackgroundFetch.BackgroundFetchStatus.Denied) {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
            if (!isRegistered) {
              await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                minimumInterval: merged.syncInterval || 5,
                stopOnTerminate: false,
                startOnBoot: true,
              });
            }
          }
        } catch (error) {
          console.warn('[AppContext] Background sync setup error:', error);
        }
      }

      isInitialized.current = true;
      setIsNotificationReady(ok);
      return ok;
    } catch (error) {
      console.error('[AppContext] Notification init failed:', error);
      setIsNotificationReady(false);
      isInitialized.current = false;
      initStarted.current = false;
      return false;
    }
  }, [handleAppStateChange]);
  


  // ── Notification-tap handling lives in AppNavigator + CommunityNavigator ──
  //
  // The old code registered a THIRD handler here. Between AppNavigator's
  // `navigateFromNotification` and CommunityNavigator's
  // `handleCommunityNotification`, every tap was already routed correctly
  // — AppNavigator to root-stack screens (FamilyChat, Achievements,
  // TrackerReminders, SafetyCorner, Timeline) and CommunityNavigator to
  // Community-stack screens (Chat, PostDetail, Notifications). The
  // AppContext handler was a *duplicate* that only knew about non-existent
  // screens ('Safety', 'Reminders', 'Community') and always threw.
  //
  // We keep a single, tiny AppState listener that flushes NotificationService's
  // queue on foreground resume — because the service's own listener only
  // fires when `AppState` transitions from background→active, and it only
  // does so if `NotificationService.initialize()` has been called.

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      if (keepAwakeRef) {
        keepAwakeRef.release().catch(() => {});
        setKeepAwakeRef(null);
      }
    } else if (nextAppState === 'active') {
      // Flush anything queued while we were backgrounded (permission
      // denial, quiet hours, etc.) so the user sees everything on return.
      import('@/services/NotificationService')
        .then(({ notificationService }) => {
          notificationService.flushQueue().catch(() => {});
          notificationService.setBadgeCount(
            (notificationSettings as any)?.badgeEnabled ? undefined as any : 0
          ).catch(() => {});
        })
        .catch(() => {});
    }
  }, [keepAwakeRef, notificationSettings]);

  // Backwards-compat shim: some screens call `handleNotificationReceived`
  // directly during testing. Forward it to NotificationService so the
  // history buffer is still populated.
  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      // NotificationService already stores history in its own listener —
      // we don't double-write here. But if you've swapped out the service,
      // uncomment the `storeNotification` call below.
      // storeNotification(notification);
      void notification;
    },
    [],
  );

  // Kept as a no-op stub so external callers don't crash. All real
  // navigation happens in AppNavigator + CommunityNavigator.
  const handleNotificationResponse = useCallback(
    (_response: Notifications.NotificationResponse) => {},
    [],
  );

  const handleNavigation = useCallback(
    (_data: Record<string, unknown>, _navigation: any) => {},
    [],
  );

  

  const storeNotification = useCallback(async (notification: Notifications.Notification) => {
    try {
      let history = [];
      const stored = await getAppSetting(NOTIFICATION_HISTORY_KEY);
      if (stored) {
        history = JSON.parse(stored);
      } else {
        const asyncStored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
        if (asyncStored) {
          history = JSON.parse(asyncStored);
        }
      }

      history.push({
        id: notification.request.identifier,
        content: notification.request.content,
        timestamp: Date.now(),
        read: false,
      });

      while (history.length > 100) {
        history.shift();
      }

      await setAppSetting(NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn('[AppContext] Failed to store notification:', error);
    }
  }, []);

  

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    _cachedThemeMode = mode;
    await setAppSetting(THEME_STORAGE_KEY, mode).catch(() => {});
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const setAppearance = useCallback(async (newAppearance: AppearanceMode) => {
    setAppearanceState(newAppearance);
    _cachedAppearance = newAppearance;

    const nextTheme: ThemeMode = (newAppearance === 'light' || newAppearance === 'pureWhite') ? 'light'
      : (newAppearance === 'dark' || newAppearance === 'trueBlack') ? 'dark' : 'system';
    setThemeModeState(nextTheme);
    _cachedThemeMode = nextTheme;

    customization?.updateSettings?.({ appearance: newAppearance });
    await Promise.all([
      setAppSetting(APPEARANCE_STORAGE_KEY, newAppearance),
      setAppSetting(THEME_STORAGE_KEY, nextTheme),
      AsyncStorage.multiSet([
        [APPEARANCE_STORAGE_KEY, newAppearance],
        [THEME_STORAGE_KEY, nextTheme],
      ]),
    ]).catch(() => {});
  }, [customization]);

  const toggleTheme = useCallback(() => {
    const modes: AppearanceMode[] = ['system', 'light', 'dark', 'trueBlack', 'pureWhite'];
    setAppearanceState(prev => {
      const next = modes[(modes.indexOf(prev) + 1) % modes.length];
      _cachedAppearance = next;
      const nextTheme: ThemeMode = (next === 'light' || next === 'pureWhite') ? 'light'
        : (next === 'dark' || next === 'trueBlack') ? 'dark' : 'system';
      _cachedThemeMode = nextTheme;
      setThemeModeState(nextTheme);
      setAppSetting(APPEARANCE_STORAGE_KEY, next).catch(() => {});
      setAppSetting(THEME_STORAGE_KEY, nextTheme).catch(() => {});
      AsyncStorage.multiSet([
        [APPEARANCE_STORAGE_KEY, next],
        [THEME_STORAGE_KEY, nextTheme],
      ]).catch(() => {});
      customization.updateSettings({ appearance: next });
      return next;
    });
  }, [customization]);

  const setDarkMode = useCallback((dark: boolean) => {
    const newMode: ThemeMode = dark ? 'dark' : 'light';
    const newAppearance: AppearanceMode = dark ? 'dark' : 'light';
    setThemeModeState(newMode);
    setAppearanceState(newAppearance);
    _cachedThemeMode = newMode;
    _cachedAppearance = newAppearance;
    customization.updateSettings({ appearance: newAppearance });
    setAppSetting(THEME_STORAGE_KEY, newMode).catch(() => {});
    setAppSetting(APPEARANCE_STORAGE_KEY, newAppearance).catch(() => {});
    AsyncStorage.multiSet([
      [THEME_STORAGE_KEY, newMode],
      [APPEARANCE_STORAGE_KEY, newAppearance],
    ]).catch(() => {});
  }, [customization]);

  

  const isDark = useMemo(() => {
    if (appearance === 'system') return systemColorScheme === 'dark';
    if (appearance === 'trueBlack') return true;
    if (appearance === 'pureWhite') return false;
    return appearance === 'dark';
  }, [appearance, systemColorScheme]);

  const isTrueBlack = appearance === 'trueBlack';
  const isPureWhite = appearance === 'pureWhite';

  const colors = useMemo(() => {
    if (isTrueBlack) return TRUE_BLACK_COLORS;
    if (isPureWhite) return PURE_WHITE_COLORS;
    return isDark ? DARK_COLORS : LIGHT_COLORS;
  }, [isDark, isTrueBlack, isPureWhite]);

  

  const isInQuietHours = useCallback((): boolean => {
    if (!notificationSettings.quietHoursStart || !notificationSettings.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    const [startH, startM] = notificationSettings.quietHoursStart.split(':').map(Number);
    const [endH, endM] = notificationSettings.quietHoursEnd.split(':').map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }, [notificationSettings]);

  

  // ── SCHEDULE — route THROUGH NotificationService ───────────────
  // The old path duplicated delivery (its own scheduleNotificationAsync
  // call, its own quiet-hours check, its own settings gate). That's the
  // reason two competing queues existed. We now delegate everything to
  // NotificationService so there's exactly one queue, one dedupe ledger,
  // and one delivery pipeline.
  const scheduleNotification = useCallback(async (
    payload: NotificationPayload,
    trigger?: Notifications.NotificationTriggerInput,
  ): Promise<string | null> => {
    try {
      const ok = await ensureNotificationsInitialized();
      if (!ok) return null;

      const { notificationService } = await import('@/services/NotificationService');

      // Translate the AppContext payload into a NotificationService payload.
      // `trigger` is passed through when non-null so scheduled (future)
      // notifications land at the right time. `delaySeconds` is derived
      // from DATE triggers that are in the future.
      let delaySeconds: number | undefined;
      if (trigger && (trigger as any)?.type === 'date') {
        const when = (trigger as any)?.date;
        const ts = when instanceof Date ? when.getTime() : new Date(when).getTime();
        if (Number.isFinite(ts)) {
          delaySeconds = Math.max(0, Math.round((ts - Date.now()) / 1000));
        }
      } else if (trigger && (trigger as any)?.type === 'timeInterval') {
        delaySeconds = (trigger as any)?.seconds;
      }

      const id = await notificationService.scheduleNotification({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        channelId: payload.channelId as any,
        sound: payload.sound !== false,
        priority: payload.priority,
        badge: payload.badge,
        delaySeconds,
      });

      return id ?? null;
    } catch (error) {
      console.error('[AppContext] Schedule error:', error);
      return null;
    }
  }, [ensureNotificationsInitialized]);

  const sendImmediateNotification = useCallback(
    (payload: NotificationPayload): Promise<string | null> =>
      scheduleNotification(payload, null),
    [scheduleNotification],
  );

  const cancelNotification = useCallback(async (id: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn('[AppContext] Cancel error:', error);
    }
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await setAppSetting(PENDING_NOTIFICATIONS_KEY, JSON.stringify([]));
      await AsyncStorage.removeItem(PENDING_NOTIFICATIONS_KEY);
    } catch (error) {
      console.warn('[AppContext] Cancel all error:', error);
    }
  }, []);

  const getScheduledNotifications = useCallback(async () => {
    await ensureNotificationsInitialized();
    return await Notifications.getAllScheduledNotificationsAsync();
  }, [ensureNotificationsInitialized]);

  const getNotificationHistory = useCallback(async () => {
    try {
      // Read the *shared* history — `NotificationService.storeNotificationHistory`
      // is the single writer. AppContext's legacy writer is removed in
      // FIX 1; we keep a read-through of the shared key so anything written
      // before the upgrade still loads.
      const { notificationService } = await import('@/services/NotificationService');
      const svcHistory = await notificationService.getNotificationHistory();
      if (Array.isArray(svcHistory) && svcHistory.length > 0) {
        return svcHistory;
      }
      const stored = await getAppSetting(NOTIFICATION_HISTORY_KEY);
      if (stored) return JSON.parse(stored);
      const asyncStored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
      return asyncStored ? JSON.parse(asyncStored) : [];
    } catch {
      return [];
    }
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      // Update NotificationService's own history (source of truth).
      try {
        const { notificationService } = await import('@/services/NotificationService');
        const history = await notificationService.getNotificationHistory();
        const updated = (history || []).map((n: any) =>
          n.id === id ? { ...n, read: true } : n,
        );
        await AsyncStorage.setItem(
          '@littleloom_notification_history_v2',
          JSON.stringify(updated),
        );
        // Refresh the badge from the new unread count.
        const unread = updated.filter((n: any) => n.read !== true).length;
        await notificationService.setBadgeCount(unread);
      } catch {}

      // Mirror into the AppContext history key so the settings UI
      // updates if it reads via getNotificationHistory().
      let history: any[] = [];
      const stored = await getAppSetting(NOTIFICATION_HISTORY_KEY);
      if (stored) history = JSON.parse(stored);
      else {
        const asyncStored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
        if (asyncStored) history = JSON.parse(asyncStored);
      }
      const updated = history.map((n: any) => (n.id === id ? { ...n, read: true } : n));
      await setAppSetting(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('[AppContext] Mark read error:', error);
    }
  }, []);

  // ── Real unread count ─────────────────────────────────────────
  // The old hardcoded `0` meant the app icon never showed a badge
  // even when a chat message arrived while the app was backgrounded.
  // We compute from `notificationHistory`: any entry with
  // `read === false` counts. `markNotificationRead` flips that flag,
  // and `storeNotification` appends to it, so this stays accurate.
  const getBadgeCount = useCallback(async (): Promise<number> => {
    try {
      const history = await getNotificationHistory();
      return Array.isArray(history)
        ? history.filter((n: any) => n && n.read !== true).length
        : 0;
    } catch {
      return 0;
    }
  }, [getNotificationHistory]);

  const updateNotificationSettings = useCallback(async (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...notificationSettings, ...updates };
    setNotificationSettings(newSettings);
    await saveNotificationSettings(newSettings);
    await ensureNotificationsInitialized();

    
    
    try {
      const { notificationService } = await import('@/services/NotificationService');
      await notificationService.updateSettings({
        enabled: newSettings.enabled,
        pushEnabled: newSettings.pushEnabled,
        inAppEnabled: newSettings.inAppEnabled,
        soundEnabled: newSettings.soundEnabled,
        vibrationEnabled: newSettings.vibrationEnabled,
        badgeEnabled: newSettings.badgeEnabled,
        quietHoursStart: newSettings.quietHoursStart,
        quietHoursEnd: newSettings.quietHoursEnd,
        chatNotifications: newSettings.chatNotifications,
        achievementNotifications: newSettings.achievementReminders,
        reminderNotifications: newSettings.activityReminders || newSettings.streakReminders,
        safetyAlerts: newSettings.safetyAlerts,
      });
    } catch (e) {
      console.warn('[AppContext] Failed to sync notification settings with service:', e);
    }

    if (updates.allowBackgroundSync !== undefined) {
      if (updates.allowBackgroundSync) {
        try {
          const status = await BackgroundFetch.getStatusAsync();
          if (status !== BackgroundFetch.BackgroundFetchStatus.Denied) {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
            if (!isRegistered) {
              await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                minimumInterval: newSettings.syncInterval || 5,
                stopOnTerminate: false,
                startOnBoot: true,
              });
            }
          }
        } catch (error) {
          console.warn('[AppContext] Background sync update error:', error);
        }
      } else {
        try {
          await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
        } catch {}
      }
    }
  }, [notificationSettings, ensureNotificationsInitialized]);

  const enableKeepAwake = useCallback(async (reason: string = 'Critical') => {
    try {
      if (!keepAwakeRef) {
        const ref = await KeepAwake.activateKeepAwakeAsync(`LittleLoom_${reason}`);
        setKeepAwakeRef(ref);
      }
    } catch (error) {
      console.warn('[AppContext] Enable keep awake error:', error);
    }
  }, [keepAwakeRef]);

  const releaseKeepAwake = useCallback(async () => {
    try {
      if (keepAwakeRef) {
        await keepAwakeRef.release();
        setKeepAwakeRef(null);
      }
    } catch (error) {
      console.warn('[AppContext] Release keep awake error:', error);
    }
  }, [keepAwakeRef]);

  const setNavigationRef = useCallback((ref: any) => {
    _navigationRef = ref;
  }, []);

  const setCommunityScreen = useCallback((isComm: boolean) => {
    setIsCommunityScreen(isComm);
  }, []);

  

  const value = useMemo(() => ({
    themeMode,
    appearance,
    isDark,
    isTrueBlack,
    isPureWhite,
    colors,
    setThemeMode,
    setAppearance,
    toggleTheme,
    setDarkMode,
    themeReady,
    isCommunityScreen,
    setCommunityScreen,
    notificationSettings,
    isNotificationReady,
    updateNotificationSettings,
    scheduleNotification,
    sendImmediateNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    getNotificationHistory,
    markNotificationRead,
    getBadgeCount,
    isInQuietHours,
    enableKeepAwake,
    releaseKeepAwake,
    setNavigationRef,
  }), [
    themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors,
    themeReady, isCommunityScreen, notificationSettings, isNotificationReady,
    setThemeMode, setAppearance, toggleTheme, setDarkMode, setCommunityScreen,
    updateNotificationSettings, scheduleNotification, sendImmediateNotification,
    cancelNotification, cancelAllNotifications, getScheduledNotifications,
    getNotificationHistory, markNotificationRead, getBadgeCount, isInQuietHours,
    enableKeepAwake, releaseKeepAwake, setNavigationRef,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// ─── HOOKS ─────────────────────────────────────────────────────────

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

export const useTheme = () => {
  const { themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady } = useApp();
  return { themeMode, appearance, isDark, isTrueBlack, isPureWhite, colors, setThemeMode, setAppearance, toggleTheme, setDarkMode, themeReady };
};

export const useNotifications = () => {
  const {
    notificationSettings,
    isNotificationReady,
    updateNotificationSettings,
    scheduleNotification,
    sendImmediateNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    getNotificationHistory,
    markNotificationRead,
    getBadgeCount,
    isInQuietHours,
    enableKeepAwake,
    releaseKeepAwake,
  } = useApp();

  return {
    settings: notificationSettings,
    isReady: isNotificationReady,
    updateSettings: updateNotificationSettings,
    schedule: scheduleNotification,
    sendImmediate: sendImmediateNotification,
    cancel: cancelNotification,
    cancelAll: cancelAllNotifications,
    getScheduled: getScheduledNotifications,
    getHistory: getNotificationHistory,
    markRead: markNotificationRead,
    getBadgeCount,
    isInQuietHours,
    enableKeepAwake,
    releaseKeepAwake,
  };
};

export default AppContext;