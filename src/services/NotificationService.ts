














import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';



export const NOTIFICATION_CHANNELS = {
  DEFAULT: 'default',
  REMINDERS: 'reminders',
  ACHIEVEMENTS: 'achievements',
  CHAT: 'chat',
  SAFETY: 'safety',
  SYSTEM: 'system',
  ACTIVITIES: 'activities',
  FEEDING: 'feeding',
  SLEEP: 'sleep',
  POTTY: 'potty',
  GROWTH: 'growth',
  COMMUNITY: 'community',
  STREAKS: 'streaks',
} as const;

export type NotificationChannel = typeof NOTIFICATION_CHANNELS[keyof typeof NOTIFICATION_CHANNELS];



export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: NotificationChannel;
  sound?: boolean;
  badge?: number;
  priority?: 'high' | 'normal' | 'low';
  /** Delay in seconds before showing (for scheduled notifications) */
  delaySeconds?: number;
  /** Category for iOS action buttons */
  categoryIdentifier?: string;
}

export interface ScheduledNotification {
  id: string;
  payload: NotificationPayload;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  scheduledAt: number;
  sentAt?: number;
  error?: string;
  attempts: number;
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
  chatNotifications: boolean;
  achievementNotifications: boolean;
  reminderNotifications: boolean;
  safetyAlerts: boolean;
}

export type NotificationResponseHandler = (
  notification: Notifications.NotificationResponse
) => void;



const STORAGE_KEYS = {
  SETTINGS: '@littleloom_notification_settings_v3',
  PENDING_QUEUE: '@littleloom_notification_queue_v2',
  LAST_PERMISSION_REQUEST: '@littleloom_last_permission_request',
  PUSH_TOKEN: '@littleloom_push_token',
} as const;

const MAX_QUEUE_SIZE = 50;
const MAX_RETRY_ATTEMPTS = 3;
const PERMISSION_REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000; 

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  pushEnabled: true,
  inAppEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  badgeEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  chatNotifications: true,
  achievementNotifications: true,
  reminderNotifications: true,
  safetyAlerts: true,
};



class NotificationService {
  private static instance: NotificationService | null = null;
  
  
  private isInitialized = false;
  private isInitializing = false;
  private permissionGranted = false;
  private pushToken: string | null = null;
  private settings: NotificationSettings = { ...DEFAULT_SETTINGS };
  private appState: AppStateStatus = AppState.currentState;
  
  
  private queue: ScheduledNotification[] = [];
  
  
  private responseHandlers: Set<NotificationResponseHandler> = new Set();
  
  
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  
  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  

  /**
   * Initialize the notification service.
   * Safe to call multiple times — only initializes once.
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) {
      
      return new Promise((resolve) => {
        const check = () => {
          if (this.isInitialized) resolve(true);
          else if (!this.isInitializing) resolve(false);
          else setTimeout(check, 100);
        };
        check();
      });
    }

    this.isInitializing = true;

    try {
      console.log('[NotificationService] Initializing...');

      
      await this.loadSettings();

      
      this.setupNotificationHandler();

      
      const granted = await this.requestPermissions();
      this.permissionGranted = granted;

      
      if (Platform.OS === 'android') {
        await this.createAndroidChannels();
      }

      
      if (granted && Device.isDevice) {
        await this.getPushToken();
      }

      
      this.setupListeners();

      
      await this.loadQueue();

      
      this.flushQueue().catch((e) => {
        console.warn('[NotificationService] Queue flush failed:', e);
      });

      this.isInitialized = true;
      this.isInitializing = false;
      
      console.log('[NotificationService] ✅ Initialized successfully');
      console.log(`[NotificationService] Permission: ${granted ? 'granted' : 'denied'}`);
      console.log(`[NotificationService] Push token: ${this.pushToken ? 'available' : 'none'}`);
      
      return true;
    } catch (error) {
      console.error('[NotificationService] ❌ Initialization failed:', error);
      this.isInitializing = false;
      
      this.isInitialized = true;
      return false;
    }
  }

  

  /**
   * Request notification permissions.
   * Returns true if granted, false otherwise.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        console.log('[NotificationService] Permission already granted');
        return true;
      }

      
      const lastRequest = await AsyncStorage.getItem(STORAGE_KEYS.LAST_PERMISSION_REQUEST);
      const lastRequestTime = lastRequest ? parseInt(lastRequest, 10) : 0;
      const timeSinceLastRequest = Date.now() - lastRequestTime;

      if (timeSinceLastRequest < PERMISSION_REQUEST_COOLDOWN_MS && existingStatus === 'denied') {
        console.log('[NotificationService] Permission request on cooldown');
        return false;
      }

      
      console.log('[NotificationService] Requesting permission...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowDisplayInCarPlay: true,
        },
      });

      await AsyncStorage.setItem(STORAGE_KEYS.LAST_PERMISSION_REQUEST, Date.now().toString());

      const granted = status === 'granted';
      console.log(`[NotificationService] Permission ${granted ? 'granted' : 'denied'}`);
      
      return granted;
    } catch (error) {
      console.error('[NotificationService] Permission request error:', error);
      return false;
    }
  }

  /**
   * Check if notification permissions are granted.
   */
  async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch {
      return false;
    }
  }

  /**
   * Get current permission status.
   */
  async getPermissionStatus(): Promise<Notifications.NotificationPermissionsStatus> {
    return Notifications.getPermissionsAsync();
  }

  

  /**
   * Set up the notification handler.
   * CRITICAL: Must be called exactly ONCE per app launch.
   */
  private setupNotificationHandler(): void {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data || {};
        const type = data.type as string;
        
        
        const shouldShow = this.shouldShowNotification(type);
        const isInQuietHours = this.isInQuietHours();
        
        
        const isSafetyAlert = type === 'safety_alert' || type === 'sos';
        
        const showAlert = shouldShow && (!isInQuietHours || isSafetyAlert);
        
        return {
          shouldShowAlert: showAlert && this.settings.inAppEnabled,
          shouldPlaySound: showAlert && this.settings.soundEnabled,
          shouldSetBadge: showAlert && this.settings.badgeEnabled,
          priority: isSafetyAlert 
            ? Notifications.AndroidNotificationPriority.MAX 
            : Notifications.AndroidNotificationPriority.HIGH,
        };
      },
    });
    
    console.log('[NotificationService] Handler configured');
  }

  /**
   * Determine if a notification type should be shown based on settings.
   */
  private shouldShowNotification(type: string | undefined): boolean {
    if (!this.settings.enabled || !this.settings.pushEnabled) return false;
    if (!type) return true;

    switch (type) {
      case 'chat_message':
        return this.settings.chatNotifications;
      case 'achievement_unlocked':
      case 'achievement_reminder':
        return this.settings.achievementNotifications;
      case 'activity_reminder':
      case 'reminder':
      case 'streak_reminder':
      case 'streak_urgent':
        return this.settings.reminderNotifications;
      case 'safety_alert':
      case 'sos':
        return this.settings.safetyAlerts;
      default:
        return true;
    }
  }

  

  /**
   * Create all Android notification channels.
   * Idempotent — safe to call multiple times.
   */
  private async createAndroidChannels(): Promise<void> {
    const channels = [
      {
        id: NOTIFICATION_CHANNELS.DEFAULT,
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#667eea',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.REMINDERS,
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#667eea',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.ACHIEVEMENTS,
        name: 'Achievements',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#f59e0b',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.CHAT,
        name: 'Family Chat',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 50, 100],
        lightColor: '#06b6d4',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.SAFETY,
        name: 'Safety Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#ef4444',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.SYSTEM,
        name: 'System',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 100],
        lightColor: '#64748b',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.ACTIVITIES,
        name: 'Activities',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#3b82f6',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.FEEDING,
        name: 'Feeding',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 50, 200],
        lightColor: '#fa709a',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.SLEEP,
        name: 'Sleep',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150, 150, 150],
        lightColor: '#667eea',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.POTTY,
        name: 'Potty',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150, 100, 150],
        lightColor: '#f59e0b',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.GROWTH,
        name: 'Growth',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#22c55e',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.COMMUNITY,
        name: 'Community',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#8b5cf6',
        sound: null,
      },
      {
        id: NOTIFICATION_CHANNELS.STREAKS,
        name: 'Streaks',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 100, 300],
        lightColor: '#f59e0b',
        sound: null,
      },
    ];

    try {
      await Promise.all(
        channels.map((channel) =>
          Notifications.setNotificationChannelAsync(channel.id, {
            name: channel.name,
            importance: channel.importance,
            vibrationPattern: channel.vibrationPattern,
            lightColor: channel.lightColor,
            sound: channel.sound,
            enableVibrate: this.settings.vibrationEnabled,
            enableLights: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: channel.id === NOTIFICATION_CHANNELS.SAFETY,
          }).catch((e) => {
            console.warn(`[NotificationService] Failed to create channel ${channel.id}:`, e);
          })
        )
      );
      
      console.log(`[NotificationService] Created ${channels.length} Android channels`);
    } catch (error) {
      console.warn('[NotificationService] Channel creation error:', error);
    }
  }

  

  private async getPushToken(): Promise<string | null> {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId 
        ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.log('[NotificationService] No project ID configured for push');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      this.pushToken = token.data;
      
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token.data);
      
      console.log('[NotificationService] Push token obtained');
      return token.data;
    } catch (error) {
      console.warn('[NotificationService] Push token error:', error);
      return null;
    }
  }

  getPushTokenSync(): string | null {
    return this.pushToken;
  }

  

  private setupListeners(): void {
    
    this.notificationListener?.remove();
    this.responseListener?.remove();
    this.appStateSubscription?.remove();

    
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[NotificationService] Notification received:', 
          notification.request.identifier);
        
        this.storeNotificationHistory(notification).catch(() => {});
      }
    );

    
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[NotificationService] Notification tapped:', 
          response.notification.request.identifier);
        
        
        this.responseHandlers.forEach((handler) => {
          try {
            handler(response);
          } catch (e) {
            console.warn('[NotificationService] Response handler error:', e);
          }
        });
      }
    );

    
    this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const prevState = this.appState;
      this.appState = nextState;

      
      if (prevState.match(/inactive|background/) && nextState === 'active') {
        console.log('[NotificationService] App foregrounded, flushing queue');
        this.flushQueue().catch(() => {});
        this.updateBadgeCount().catch(() => {});
      }
    });

    console.log('[NotificationService] Listeners configured');
  }

  /**
   * Register a handler for notification responses (taps).
   * Returns an unsubscribe function.
   */
  addResponseHandler(handler: NotificationResponseHandler): () => void {
    this.responseHandlers.add(handler);
    return () => {
      this.responseHandlers.delete(handler);
    };
  }

  

  /**
   * Schedule a local notification.
   * Returns the notification ID or null on failure.
   */
  async scheduleNotification(
    payload: NotificationPayload
  ): Promise<string | null> {
    
    if (!this.permissionGranted) {
      const granted = await this.checkPermission();
      if (!granted) {
        console.log('[NotificationService] Cannot schedule — no permission');
        
        await this.enqueue(payload);
        return null;
      }
    }

    
    if (!this.settings.enabled || !this.settings.pushEnabled) {
      console.log('[NotificationService] Notifications disabled');
      return null;
    }

    
    const isSafetyAlert = payload.data?.type === 'safety_alert' 
      || payload.data?.type === 'sos';
    
    if (this.isInQuietHours() && !isSafetyAlert) {
      console.log('[NotificationService] In quiet hours, queuing');
      await this.enqueue(payload);
      return null;
    }

    try {
      const trigger: Notifications.NotificationTriggerInput | null = 
        payload.delaySeconds && payload.delaySeconds > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: payload.delaySeconds,
            }
          : null;

      const content: Notifications.NotificationContentInput = {
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: payload.sound !== false && this.settings.soundEnabled,
        badge: payload.badge ?? (this.settings.badgeEnabled ? 1 : undefined),
        ...(payload.categoryIdentifier && {
          categoryIdentifier: payload.categoryIdentifier,
        }),
      };

      
      if (Platform.OS === 'android') {
        content.channelId = payload.channelId || NOTIFICATION_CHANNELS.DEFAULT;
        content.priority = this.getAndroidPriority(payload.priority);
        content.vibrate = this.settings.vibrationEnabled 
          ? [0, 250, 250, 250] 
          : undefined;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });

      console.log(`[NotificationService] Scheduled notification: ${id}`);
      return id;
    } catch (error) {
      console.error('[NotificationService] Schedule error:', error);
      await this.enqueue(payload);
      return null;
    }
  }

  /**
   * Send an immediate notification.
   */
  async sendImmediate(payload: NotificationPayload): Promise<string | null> {
    return this.scheduleNotification({ ...payload, delaySeconds: 0 });
  }

  private getAndroidPriority(
    priority?: 'high' | 'normal' | 'low'
  ): Notifications.AndroidNotificationPriority {
    switch (priority) {
      case 'high':
        return Notifications.AndroidNotificationPriority.HIGH;
      case 'low':
        return Notifications.AndroidNotificationPriority.LOW;
      default:
        return Notifications.AndroidNotificationPriority.DEFAULT;
    }
  }

  

  private async enqueue(payload: NotificationPayload): Promise<void> {
    const item: ScheduledNotification = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      payload,
      status: 'pending',
      scheduledAt: Date.now(),
      attempts: 0,
    };

    this.queue.push(item);

    
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    await this.saveQueue();
  }

  async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    if (!this.permissionGranted) return;
    if (this.isInQuietHours()) return;

    console.log(`[NotificationService] Flushing ${this.queue.length} queued notifications`);

    const toProcess = [...this.queue];
    this.queue = [];

    for (const item of toProcess) {
      if (item.attempts >= MAX_RETRY_ATTEMPTS) {
        console.log(`[NotificationService] Dropping notification after ${MAX_RETRY_ATTEMPTS} attempts`);
        continue;
      }

      item.attempts++;
      
      const result = await this.scheduleNotification(item.payload);
      
      if (!result) {
        
        this.queue.push(item);
      }
    }

    await this.saveQueue();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_QUEUE,
        JSON.stringify(this.queue)
      );
    } catch (e) {
      console.warn('[NotificationService] Failed to save queue:', e);
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`[NotificationService] Loaded ${this.queue.length} queued notifications`);
      }
    } catch (e) {
      console.warn('[NotificationService] Failed to load queue:', e);
      this.queue = [];
    }
  }

  

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[NotificationService] Failed to load settings:', e);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async updateSettings(updates: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    
    
    if (updates.vibrationEnabled !== undefined && Platform.OS === 'android') {
      await this.createAndroidChannels();
    }
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  

  isInQuietHours(): boolean {
    const { quietHoursStart, quietHoursEnd } = this.settings;
    if (!quietHoursStart || !quietHoursEnd) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = quietHoursStart.split(':').map(Number);
    const [endH, endM] = quietHoursEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  

  async sendChatNotification(
    senderName: string,
    messagePreview: string,
    chatId: string
  ): Promise<string | null> {
    return this.sendImmediate({
      title: `💬 ${senderName}`,
      body: messagePreview.length > 100 
        ? messagePreview.substring(0, 100) + '...' 
        : messagePreview,
      channelId: NOTIFICATION_CHANNELS.CHAT,
      data: {
        type: 'chat_message',
        screen: 'FamilyChat',
        chatId,
      },
    });
  }

  async sendAchievementNotification(
    achievementName: string,
    description: string
  ): Promise<string | null> {
    return this.sendImmediate({
      title: `🏆 Achievement Unlocked!`,
      body: `${achievementName}: ${description}`,
      channelId: NOTIFICATION_CHANNELS.ACHIEVEMENTS,
      data: {
        type: 'achievement_unlocked',
        screen: 'Achievements',
        achievementName,
      },
    });
  }

  async sendActivityReminder(
    activityType: string,
    babyName: string,
    delayMinutes: number,
    details?: string
  ): Promise<string | null> {
    const titles: Record<string, string> = {
      feed: `🍼 Time to feed ${babyName}!`,
      sleep: `😴 ${babyName} might be sleepy`,
      potty: `🚽 Potty check for ${babyName}`,
      milestone: `🎉 Milestone reminder for ${babyName}`,
      growth: `📏 Growth tracking for ${babyName}`,
      medication: `💊 Medication reminder for ${babyName}`,
      diaper: `🧷 Diaper check for ${babyName}`,
      bath: `🛁 Bath time for ${babyName}`,
      default: `⏰ Reminder for ${babyName}`,
    };

    const channelMap: Record<string, NotificationChannel> = {
      feed: NOTIFICATION_CHANNELS.FEEDING,
      sleep: NOTIFICATION_CHANNELS.SLEEP,
      potty: NOTIFICATION_CHANNELS.POTTY,
      growth: NOTIFICATION_CHANNELS.GROWTH,
      medication: NOTIFICATION_CHANNELS.REMINDERS,
      default: NOTIFICATION_CHANNELS.ACTIVITIES,
    };

    return this.scheduleNotification({
      title: titles[activityType] || titles.default,
      body: details || `Tap to open LittleLoom and track this activity.`,
      channelId: channelMap[activityType] || channelMap.default,
      delaySeconds: delayMinutes * 60,
      data: {
        type: 'activity_reminder',
        screen: 'Timeline',
        activityType,
        babyName,
      },
    });
  }

  async sendSafetyAlert(title: string, body: string): Promise<string | null> {
    return this.sendImmediate({
      title: `🛡️ ${title}`,
      body,
      channelId: NOTIFICATION_CHANNELS.SAFETY,
      priority: 'high',
      sound: true,
      data: {
        type: 'safety_alert',
        screen: 'Safety',
      },
    });
  }

  async sendStreakReminder(
    streakDays: number,
    hoursLeft: number
  ): Promise<string | null> {
    return this.sendImmediate({
      title: `🔥 Streak at Risk!`,
      body: `Your ${streakDays}-day streak ends in ${hoursLeft} hours! Log an activity now.`,
      channelId: NOTIFICATION_CHANNELS.STREAKS,
      priority: 'high',
      data: {
        type: 'streak_reminder',
        screen: 'Timeline',
        streakDays,
      },
    });
  }

  

  async cancelNotification(id: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn('[NotificationService] Cancel error:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.queue = [];
      await this.saveQueue();
    } catch (error) {
      console.warn('[NotificationService] Cancel all error:', error);
    }
  }

  async cancelByCategory(category: string): Promise<void> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = scheduled.filter(
        (n) => n.content.data?.type === category
      );
      
      await Promise.all(
        toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
      );
    } catch (error) {
      console.warn('[NotificationService] Cancel by category error:', error);
    }
  }

  

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch {
      return [];
    }
  }

  async getPresentedNotifications(): Promise<Notifications.Notification[]> {
    try {
      return await Notifications.getPresentedNotificationsAsync();
    } catch {
      return [];
    }
  }

  async dismissAllPresented(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.warn('[NotificationService] Dismiss error:', error);
    }
  }

  

  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch {
      return 0;
    }
  }

  async setBadgeCount(count: number): Promise<void> {
    if (!this.settings.badgeEnabled) return;
    try {
      await Notifications.setBadgeCountAsync(Math.max(0, count));
    } catch (error) {
      console.warn('[NotificationService] Set badge error:', error);
    }
  }

  async incrementBadge(amount: number = 1): Promise<void> {
    const current = await this.getBadgeCount();
    await this.setBadgeCount(current + amount);
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  private async updateBadgeCount(): Promise<void> {
    try {
      const presented = await this.getPresentedNotifications();
      await this.setBadgeCount(presented.length);
    } catch {}
  }

  

  private async storeNotificationHistory(
    notification: Notifications.Notification
  ): Promise<void> {
    try {
      const key = '@littleloom_notification_history_v2';
      const stored = await AsyncStorage.getItem(key);
      const history: any[] = stored ? JSON.parse(stored) : [];

      history.unshift({
        id: notification.request.identifier,
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        timestamp: Date.now(),
        read: false,
      });

      
      while (history.length > 100) {
        history.pop();
      }

      await AsyncStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      console.warn('[NotificationService] Failed to store history:', e);
    }
  }

  async getNotificationHistory(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem('@littleloom_notification_history_v2');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async clearNotificationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem('@littleloom_notification_history_v2');
    } catch {}
  }

  

  isReady(): boolean {
    return this.isInitialized;
  }

  hasPermission(): boolean {
    return this.permissionGranted;
  }

  getAppState(): AppStateStatus {
    return this.appState;
  }

  isAppForegrounded(): boolean {
    return this.appState === 'active';
  }
}



export const notificationService = NotificationService.getInstance();
export default notificationService;