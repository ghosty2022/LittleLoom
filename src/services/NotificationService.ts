// src/services/EnhancedNotificationService.ts

import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as KeepAwake from 'expo-keep-awake';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

// ─── TASK DEFINITION ──────────────────────────────────────────────

const BACKGROUND_SYNC_TASK = 'BACKGROUND_NOTIFICATION_SYNC';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const data = await NotificationSyncService.getInstance().performBackgroundSync();
    return data?.hasUpdates 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundSync] Error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── TYPES ──────────────────────────────────────────────────────────

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
  syncInterval: number; // minutes
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: 'default' | boolean;
  priority?: 'high' | 'normal' | 'low';
  badge?: number;
  category?: string;
  threadId?: string;
  summaryArgument?: string;
}

export interface ScheduledNotification {
  id: string;
  payload: NotificationPayload;
  trigger: Notifications.NotificationTriggerInput;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  scheduledAt: number;
  sentAt?: number;
  error?: string;
}

// ─── SYNC SERVICE ──────────────────────────────────────────────────

export class NotificationSyncService {
  private static instance: NotificationSyncService;
  private lastSyncTime: number = 0;
  private syncInterval: number = 5 * 60 * 1000; // 5 minutes default
  private isSyncing: boolean = false;

  static getInstance(): NotificationSyncService {
    if (!NotificationSyncService.instance) {
      NotificationSyncService.instance = new NotificationSyncService();
    }
    return NotificationSyncService.instance;
  }

  async performBackgroundSync(): Promise<{ hasUpdates: boolean }> {
    if (this.isSyncing) return { hasUpdates: false };
    this.isSyncing = true;

    try {
      const settings = await this.getSettings();
      if (!settings.allowBackgroundSync) {
        return { hasUpdates: false };
      }

      const now = Date.now();
      if (now - this.lastSyncTime < this.syncInterval) {
        return { hasUpdates: false };
      }

      // Sync pending notifications
      const pending = await this.getPendingNotifications();
      let hasUpdates = false;

      for (const notification of pending) {
        if (notification.status === 'pending') {
          try {
            const id = await this.sendImmediateNotification(notification.payload);
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
        await this.savePendingNotifications(pending);
      }

      this.lastSyncTime = now;
      return { hasUpdates };
    } finally {
      this.isSyncing = false;
    }
  }

  private async getSettings(): Promise<NotificationSettings> {
    const defaultSettings: NotificationSettings = {
      enabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      badgeEnabled: true,
      allowBackgroundSync: true,
      syncInterval: 5,
    };

    try {
      const stored = await AsyncStorage.getItem('@littleloom_notification_settings_v2');
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
    }

    return defaultSettings;
  }

  private async getPendingNotifications(): Promise<ScheduledNotification[]> {
    try {
      const stored = await AsyncStorage.getItem('@littleloom_pending_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async savePendingNotifications(notifications: ScheduledNotification[]): Promise<void> {
    await AsyncStorage.setItem('@littleloom_pending_notifications', JSON.stringify(notifications));
  }

  private async sendImmediateNotification(payload: NotificationPayload): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: payload.sound !== false,
        badge: payload.badge || 1,
        categoryIdentifier: payload.category,
        threadIdentifier: payload.threadId,
        summaryArgument: payload.summaryArgument,
        ...(Platform.OS === 'android' && {
          channelId: payload.channelId || 'default',
          priority: payload.priority === 'high' 
            ? Notifications.AndroidPriority.HIGH 
            : payload.priority === 'low'
              ? Notifications.AndroidPriority.LOW
              : Notifications.AndroidPriority.DEFAULT,
        }),
      },
      trigger: null, // immediate
    });
  }
}

// ─── MAIN NOTIFICATION SERVICE ────────────────────────────────────

export class EnhancedNotificationService {
  private static instance: EnhancedNotificationService;
  private isInitialized: boolean = false;
  private appStateListener: any = null;
  private keepAwakeRef: { release: () => Promise<void> } | null = null;
  private settings: NotificationSettings | null = null;
  private responseListener: any = null;
  private notificationListener: any = null;

  static getInstance(): EnhancedNotificationService {
    if (!EnhancedNotificationService.instance) {
      EnhancedNotificationService.instance = new EnhancedNotificationService();
    }
    return EnhancedNotificationService.instance;
  }

  // ─── INITIALIZATION ─────────────────────────────────────────────

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Load settings
      const syncService = NotificationSyncService.getInstance();
      this.settings = await syncService['getSettings']();

      if (!this.settings.enabled) {
        console.log('[Notifications] Disabled by user settings');
        return false;
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('[Notifications] Permission denied');
        return false;
      }

      // Setup Android channels
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Setup notification handler
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const data = notification.request.content.data;
          const channelId = data?.channelId as string || 'default';
          
          return {
            shouldShowAlert: this.settings?.inAppEnabled ?? true,
            shouldPlaySound: this.settings?.soundEnabled ?? true,
            shouldSetBadge: this.settings?.badgeEnabled ?? true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            ...(Platform.OS === 'android' && { channelId }),
          };
        },
      });

      // Setup listeners
      this.setupListeners();

      // Setup background sync
      if (this.settings.allowBackgroundSync) {
        await this.setupBackgroundSync();
      }

      // Setup keep awake for critical screens
      await this.setupKeepAwake();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[Notifications] Initialization error:', error);
      return false;
    }
  }

  // ─── PERMISSIONS ──────────────────────────────────────────────────

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('[Notifications] Must use physical device');
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
        });
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('[Notifications] Permission request error:', error);
      return false;
    }
  }

  // ─── ANDROID CHANNELS ────────────────────────────────────────────

  private async setupAndroidChannels(): Promise<void> {
    const channelConfigs: Array<{
      id: string;
      name: string;
      importance: Notifications.AndroidImportance;
      vibrationPattern?: number[];
      lightColor?: string;
      sound?: string;
    }> = [
      {
        id: 'default',
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c6cf1',
      },
      {
        id: 'achievements',
        name: 'Achievements',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#f59e0b',
      },
      {
        id: 'streaks',
        name: 'Streak Protection',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 100, 300, 100, 300],
        lightColor: '#ef4444',
      },
      {
        id: 'chat',
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 50, 100],
        lightColor: '#22c55e',
      },
      {
        id: 'safety',
        name: 'Safety Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 100, 300],
        lightColor: '#ef4444',
        sound: 'safety.wav',
      },
      {
        id: 'reminders',
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#667eea',
      },
      {
        id: 'activities',
        name: 'Activities',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#3b82f6',
      },
      {
        id: 'community',
        name: 'Community',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150, 150, 150],
        lightColor: '#8b5cf6',
      },
    ];

    for (const config of channelConfigs) {
      try {
        await Notifications.setNotificationChannelAsync(config.id, {
          name: config.name,
          importance: config.importance,
          vibrationPattern: config.vibrationPattern,
          lightColor: config.lightColor,
          sound: config.sound,
          enableVibrate: true,
          enableLights: true,
        });
      } catch (error) {
        console.warn(`[Notifications] Failed to create channel ${config.id}:`, error);
      }
    }
  }

  // ─── LISTENERS ────────────────────────────────────────────────────

  private setupListeners(): void {
    // Remove existing listeners
    this.cleanupListeners();

    // Notification received while app is foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Notification response (tapped)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );

    // App state changes
    this.appStateListener = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private cleanupListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }

  private handleNotificationReceived(notification: Notifications.Notification): void {
    console.log('[Notifications] Received:', notification.request.identifier);
    
    // Store for later if needed
    const data = notification.request.content.data;
    if (data?.type) {
      this.storeNotification(notification);
    }
  }

  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    console.log('[Notifications] Response:', response.notification.request.identifier);
    
    const data = response.notification.request.content.data;
    if (!data) return;

    // Navigate based on data
    const navigation = this.getNavigation();
    if (navigation) {
      this.handleNavigation(data, navigation);
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'background') {
      // Schedule background sync
      if (this.settings?.allowBackgroundSync) {
        this.scheduleBackgroundSync();
      }
    } else if (nextAppState === 'active') {
      // Release keep awake if not needed
      this.releaseKeepAwake();
    }
  }

  // ─── BACKGROUND SYNC ─────────────────────────────────────────────

  private async setupBackgroundSync(): Promise<void> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.log('[BackgroundSync] Permission denied');
        return;
      }

      // Register the task if not already registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
          minimumInterval: this.settings?.syncInterval || 5,
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('[BackgroundSync] Task registered');
      }

      // Schedule immediate sync
      await this.scheduleBackgroundSync();
    } catch (error) {
      console.error('[BackgroundSync] Setup error:', error);
    }
  }

  private async scheduleBackgroundSync(): Promise<void> {
    try {
      const syncService = NotificationSyncService.getInstance();
      await syncService.performBackgroundSync();
    } catch (error) {
      console.error('[BackgroundSync] Schedule error:', error);
    }
  }

  // ─── KEEP AWAKE ──────────────────────────────────────────────────

  private async setupKeepAwake(): Promise<void> {
    try {
      // Only keep awake for critical screens
      const isCritical = await this.isCriticalScreen();
      if (isCritical) {
        this.keepAwakeRef = await KeepAwake.activateKeepAwakeAsync('LittleLoom_Critical');
      }
    } catch (error) {
      console.warn('[KeepAwake] Setup error:', error);
    }
  }

  async enableKeepAwake(reason: string = 'Critical'): Promise<void> {
    try {
      if (!this.keepAwakeRef) {
        this.keepAwakeRef = await KeepAwake.activateKeepAwakeAsync(`LittleLoom_${reason}`);
      }
    } catch (error) {
      console.warn('[KeepAwake] Enable error:', error);
    }
  }

  async releaseKeepAwake(): Promise<void> {
    try {
      if (this.keepAwakeRef) {
        await this.keepAwakeRef.release();
        this.keepAwakeRef = null;
      }
    } catch (error) {
      console.warn('[KeepAwake] Release error:', error);
    }
  }

  private async isCriticalScreen(): Promise<boolean> {
    // Check if current screen requires keep awake
    try {
      const currentScreen = await AsyncStorage.getItem('@littleloom_current_screen');
      const criticalScreens = ['Tracking', 'Chat', 'SleepTimer', 'Achievements'];
      return criticalScreens.includes(currentScreen || '');
    } catch {
      return false;
    }
  }

  // ─── NAVIGATION ──────────────────────────────────────────────────

  private getNavigation(): any {
    // This should be set by the app
    return (global as any).__NAVIGATION__ || null;
  }

  private handleNavigation(data: Record<string, unknown>, navigation: any): void {
    const type = data.type as string;
    const screen = data.screen as string;
    const params = data.params as Record<string, unknown> || {};

    switch (type) {
      case 'streak_reminder':
      case 'streak_urgent':
        navigation.navigate('Timeline', { type: 'potty', ...params });
        break;
      case 'achievement_reminder':
      case 'achievement_unlocked':
        navigation.navigate('Achievements', params);
        break;
      case 'chat_message':
        navigation.navigate('FamilyChat', params);
        break;
      case 'safety_alert':
        navigation.navigate('Safety', params);
        break;
      case 'reminder':
        navigation.navigate('Reminders', params);
        break;
      case 'daily_summary':
        navigation.navigate('Timeline', params);
        break;
      case 'community_notification':
        navigation.navigate('Community', params);
        break;
      default:
        if (screen) {
          navigation.navigate(screen, params);
        }
        break;
    }
  }

  // ─── STORAGE ─────────────────────────────────────────────────────

  private async storeNotification(notification: Notifications.Notification): Promise<void> {
    try {
      const key = '@littleloom_notification_history';
      const stored = await AsyncStorage.getItem(key);
      const history = stored ? JSON.parse(stored) : [];
      
      history.push({
        id: notification.request.identifier,
        content: notification.request.content,
        timestamp: Date.now(),
        read: false,
      });

      // Keep last 100
      while (history.length > 100) {
        history.shift();
      }

      await AsyncStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      console.warn('[Notifications] Failed to store notification:', error);
    }
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────

  async scheduleNotification(
    payload: NotificationPayload,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.settings?.enabled || !this.settings?.pushEnabled) {
      return null;
    }

    // Check quiet hours
    if (this.isInQuietHours()) {
      // Store for later
      const notification: ScheduledNotification = {
        id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        payload,
        trigger: trigger || null,
        status: 'pending',
        scheduledAt: Date.now(),
      };

      const pending = await NotificationSyncService.getInstance()['getPendingNotifications']();
      pending.push(notification);
      await NotificationSyncService.getInstance()['savePendingNotifications'](pending);
      return notification.id;
    }

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          sound: payload.sound !== false && this.settings.soundEnabled,
          badge: payload.badge || 1,
          categoryIdentifier: payload.category,
          threadIdentifier: payload.threadId,
          summaryArgument: payload.summaryArgument,
          ...(Platform.OS === 'android' && {
            channelId: payload.channelId || 'default',
            priority: payload.priority === 'high' 
              ? Notifications.AndroidPriority.HIGH 
              : payload.priority === 'low'
                ? Notifications.AndroidPriority.LOW
                : Notifications.AndroidPriority.DEFAULT,
          }),
        },
        trigger: trigger || null,
      });

      return id;
    } catch (error) {
      console.error('[Notifications] Schedule error:', error);
      return null;
    }
  }

  async sendImmediateNotification(payload: NotificationPayload): Promise<string | null> {
    return this.scheduleNotification(payload, null);
  }

  async cancelNotification(id: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn('[Notifications] Cancel error:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.removeItem('@littleloom_pending_notifications');
    } catch (error) {
      console.warn('[Notifications] Cancel all error:', error);
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  async getNotificationHistory(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem('@littleloom_notification_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    try {
      const key = '@littleloom_notification_history';
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const history = JSON.parse(stored);
        const updated = history.map((n: any) => 
          n.id === id ? { ...n, read: true } : n
        );
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
    } catch (error) {
      console.warn('[Notifications] Mark read error:', error);
    }
  }

  getBadgeCount(): number {
    // Return unread count from stored notifications
    // This should be calculated based on your app's state
    return 0;
  }

  isInQuietHours(): boolean {
    if (!this.settings?.quietHoursStart || !this.settings?.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    const [startH, startM] = this.settings.quietHoursStart.split(':').map(Number);
    const [endH, endM] = this.settings.quietHoursEnd.split(':').map(Number);
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Crosses midnight
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings } as NotificationSettings;
    await AsyncStorage.setItem('@littleloom_notification_settings_v2', JSON.stringify(this.settings));

    // Update background sync if changed
    if (settings.allowBackgroundSync !== undefined) {
      if (settings.allowBackgroundSync) {
        await this.setupBackgroundSync();
      } else {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK).catch(() => {});
      }
    }
  }

  async getSettings(): Promise<NotificationSettings> {
    if (!this.settings) {
      const syncService = NotificationSyncService.getInstance();
      this.settings = await syncService['getSettings']();
    }
    return { ...this.settings };
  }

  async cleanup(): Promise<void> {
    this.cleanupListeners();
    await this.releaseKeepAwake();
    this.isInitialized = false;
  }
}

export const enhancedNotificationService = EnhancedNotificationService.getInstance();
export default enhancedNotificationService;