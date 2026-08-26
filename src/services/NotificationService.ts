// src/services/NotificationService.ts

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── CHANNEL TYPES ──────────────────────────────────────────────────

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

export type NotificationChannels = typeof NOTIFICATION_CHANNELS[keyof typeof NOTIFICATION_CHANNELS];

// ─── INTERFACES ────────────────────────────────────────────────────

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: NotificationChannels;
  sound?: 'default' | boolean;
  priority?: 'high' | 'normal' | 'low';
  badge?: number;
}

// ─── NOTIFICATION SERVICE ──────────────────────────────────────────

class NotificationService {
  private static instance: NotificationService | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize the notification service
   * Sets up notification channels for Android
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });

      if (status !== 'granted') {
        console.warn('[NotificationService] Permission not granted');
      }

      // Set up Android channels
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      this.isInitialized = true;
      console.log('[NotificationService] Initialized successfully');
    } catch (error) {
      console.warn('[NotificationService] Initialization error:', error);
      // Don't throw - allow app to continue
    }
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    try {
      const channels: {
        id: string;
        name: string;
        importance: Notifications.AndroidImportance;
        sound?: string;
      }[] = [
        {
          id: NOTIFICATION_CHANNELS.DEFAULT,
          name: 'General Notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
        },
        {
          id: NOTIFICATION_CHANNELS.REMINDERS,
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
        },
        {
          id: NOTIFICATION_CHANNELS.ACHIEVEMENTS,
          name: 'Achievements',
          importance: Notifications.AndroidImportance.HIGH,
        },
        {
          id: NOTIFICATION_CHANNELS.CHAT,
          name: 'Family Chat',
          importance: Notifications.AndroidImportance.HIGH,
        },
        {
          id: NOTIFICATION_CHANNELS.SAFETY,
          name: 'Safety Alerts',
          importance: Notifications.AndroidImportance.HIGH,
        },
        {
          id: NOTIFICATION_CHANNELS.SYSTEM,
          name: 'System Notifications',
          importance: Notifications.AndroidImportance.LOW,
        },
        {
          id: NOTIFICATION_CHANNELS.ACTIVITIES,
          name: 'Activities',
          importance: Notifications.AndroidImportance.DEFAULT,
        },
        {
          id: NOTIFICATION_CHANNELS.FEEDING,
          name: 'Feeding',
          importance: Notifications.AndroidImportance.DEFAULT,
        },
        {
          id: NOTIFICATION_CHANNELS.SLEEP,
          name: 'Sleep',
          importance: Notifications.AndroidImportance.DEFAULT,
        },
        {
          id: NOTIFICATION_CHANNELS.POTTY,
          name: 'Potty',
          importance: Notifications.AndroidImportance.DEFAULT,
        },
        {
          id: NOTIFICATION_CHANNELS.GROWTH,
          name: 'Growth',
          importance: Notifications.AndroidImportance.DEFAULT,
        },
        {
          id: NOTIFICATION_CHANNELS.COMMUNITY,
          name: 'Community',
          importance: Notifications.AndroidImportance.DEFAULT,
        },
        {
          id: NOTIFICATION_CHANNELS.STREAKS,
          name: 'Streaks',
          importance: Notifications.AndroidImportance.HIGH,
        },
      ];

      for (const channel of channels) {
        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: channel.importance,
          sound: channel.sound || 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#667eea',
        });
      }

      console.log('[NotificationService] Android channels setup complete');
    } catch (error) {
      console.warn('[NotificationService] Failed to setup Android channels:', error);
    }
  }

  /**
   * Schedule a notification
   */
  async scheduleLocalNotification(options: NotificationPayload): Promise<string | null> {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled || !settings.pushEnabled) {
        return null;
      }

      const trigger = options.data?.delay
        ? { seconds: options.data.delay as number }
        : null;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          data: options.data || {},
          sound: options.sound !== false && settings.soundEnabled,
          badge: options.badge || 1,
          ...(Platform.OS === 'android' && {
            channelId: options.channelId || 'default',
            priority: options.priority === 'high'
              ? Notifications.AndroidPriority.HIGH
              : options.priority === 'low'
                ? Notifications.AndroidPriority.LOW
                : Notifications.AndroidPriority.DEFAULT,
          }),
        },
        trigger: trigger,
      });

      return id;
    } catch (error) {
      console.warn('[NotificationService] Failed to schedule notification:', error);
      return null;
    }
  }

  /**
   * Cancel a notification
   */
  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      console.warn('[NotificationService] Failed to cancel notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('[NotificationService] Failed to cancel all notifications:', error);
    }
  }

  /**
   * Get scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('[NotificationService] Failed to get scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Schedule an activity reminder
   */
  async scheduleActivityReminder(
    type: string,
    babyName: string,
    minutes: number,
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

    const channelMap: Record<string, NotificationChannels> = {
      feed: NOTIFICATION_CHANNELS.FEEDING,
      sleep: NOTIFICATION_CHANNELS.SLEEP,
      potty: NOTIFICATION_CHANNELS.POTTY,
      growth: NOTIFICATION_CHANNELS.GROWTH,
      medication: NOTIFICATION_CHANNELS.REMINDERS,
      default: NOTIFICATION_CHANNELS.ACTIVITIES,
    };

    return this.scheduleLocalNotification({
      title: titles[type] || titles.default,
      body: details || `Tap to open LittleLoom and track this activity.`,
      channelId: channelMap[type] || channelMap.default,
      data: {
        type: 'activity_reminder',
        screen: 'Timeline',
        activityType: type,
        delay: minutes * 60,
      },
    });
  }

  /**
   * Send achievement notification
   */
  async sendAchievementNotification(achievement: string, description: string): Promise<string | null> {
    return this.scheduleLocalNotification({
      title: `🏆 Achievement Unlocked!`,
      body: `${achievement}: ${description}`,
      channelId: NOTIFICATION_CHANNELS.ACHIEVEMENTS,
      data: { type: 'achievement_unlocked', screen: 'Achievements' },
    });
  }

  /**
   * Send chat notification
   */
  async sendChatNotification(senderName: string, message: string, chatId?: string): Promise<string | null> {
    return this.scheduleLocalNotification({
      title: `💬 ${senderName}`,
      body: message.length > 60 ? message.substring(0, 60) + '...' : message,
      channelId: NOTIFICATION_CHANNELS.CHAT,
      data: { type: 'chat_message', screen: 'FamilyChat', chatId },
    });
  }

  /**
   * Send safety alert
   */
  async sendSafetyAlert(title: string, body: string): Promise<string | null> {
    return this.scheduleLocalNotification({
      title: `🛡️ ${title}`,
      body,
      channelId: NOTIFICATION_CHANNELS.SAFETY,
      priority: 'high',
      data: { type: 'safety_alert', screen: 'Safety' },
    });
  }

  /**
   * Send activity complete notification
   */
  async sendActivityCompleteNotification(activityType: string, babyName: string): Promise<string | null> {
    const messages: Record<string, string> = {
      potty: `🎉 ${babyName} had a successful potty visit!`,
      feed: `🍼 ${babyName} was fed successfully.`,
      sleep: `😴 ${babyName} is now sleeping.`,
      milestone: `🏆 New milestone reached for ${babyName}!`,
      growth: `📏 Growth measurement recorded for ${babyName}.`,
      default: `✅ Activity completed for ${babyName}.`,
    };

    return this.scheduleLocalNotification({
      title: `✅ Activity Logged`,
      body: messages[activityType] || messages.default,
      channelId: NOTIFICATION_CHANNELS.ACTIVITIES,
      data: { type: 'activity_complete', screen: 'Timeline' },
    });
  }

  /**
   * Send streak reminder
   */
  async sendStreakReminder(streakDays: number, hoursLeft: number): Promise<string | null> {
    return this.scheduleLocalNotification({
      title: `🔥 Streak at Risk!`,
      body: `Your ${streakDays}-day streak ends in ${hoursLeft} hours! Log an activity now.`,
      channelId: NOTIFICATION_CHANNELS.STREAKS,
      priority: 'high',
      data: { type: 'streak_reminder', screen: 'Timeline' },
    });
  }

  /**
   * Send urgent streak reminder
   */
  async sendUrgentStreakReminder(streakDays: number, hoursLeft: number): Promise<string | null> {
    return this.scheduleLocalNotification({
      title: `⏰ URGENT: Streak Ending!`,
      body: `Only ${hoursLeft} hours left for your ${streakDays}-day streak! Tap to log now!`,
      channelId: NOTIFICATION_CHANNELS.STREAKS,
      priority: 'high',
      data: { type: 'streak_urgent', screen: 'Timeline' },
    });
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(babyName: string, summary: string): Promise<string | null> {
    return this.scheduleLocalNotification({
      title: `📊 Daily Summary for ${babyName}`,
      body: summary,
      channelId: NOTIFICATION_CHANNELS.DEFAULT,
      data: { type: 'daily_summary', screen: 'Timeline' },
    });
  }

  /**
   * Get notification settings
   */
  private async getSettings(): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem('@littleloom_notification_settings_v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[NotificationService] Failed to load notification settings:', error);
    }
    return {
      enabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      badgeEnabled: true,
    };
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem('@littleloom_pending_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear pending notifications
   */
  async clearPendingNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem('@littleloom_pending_notifications');
    } catch (error) {
      console.warn('[NotificationService] Failed to clear pending notifications:', error);
    }
  }

  /**
   * Request permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });
      return status === 'granted';
    } catch (error) {
      console.warn('[NotificationService] Failed to request permissions:', error);
      return false;
    }
  }

  /**
   * Get permission status
   */
  async getPermissionsStatus(): Promise<Notifications.NotificationPermissionsStatus> {
    return await Notifications.getPermissionsAsync();
  }
}

// ─── SINGLETON INSTANCE ────────────────────────────────────────────
// Create the instance at the bottom of the file
const notificationServiceInstance = NotificationService.getInstance();

// ─── EXPORT ─────────────────────────────────────────────────────────
export const notificationService = notificationServiceInstance;
export default notificationServiceInstance;