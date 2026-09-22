// src/services/NotificationService.ts
// Notification service — supports both Expo and Supabase notifications.
// Includes: permission request, handler setup, Android channels, chat notifications.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface LocalNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  trigger?: Notifications.NotificationTriggerInput | { seconds: number } | null;
  channelId?: string;
  sound?: boolean;
}

interface QueueItem {
  id: string;
  payload: LocalNotificationPayload;
  enqueuedAt: number;
  attempts: number;
}

// ─── SERVICE ────────────────────────────────────────────────────────────

class NotificationService {
  private isInitialized = false;
  private queue: QueueItem[] = [];

  /**
   * Initialize the notification service.
   * Requests permissions, sets the handler, creates Android channels.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

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

      // Set the notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          // Required by some Expo SDK versions
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
      });

      // Android channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General Notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#667eea',
        });

        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#667eea',
        });

        await Notifications.setNotificationChannelAsync('achievements', {
          name: 'Achievements',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#f59e0b',
        });

        await Notifications.setNotificationChannelAsync('chat', {
          name: 'Family Chat',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#06b6d4',
        });

        await Notifications.setNotificationChannelAsync('safety', {
          name: 'Safety Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#ef4444',
        });
      }

      this.isInitialized = true;
      console.log('[NotificationService] Initialized successfully');
    } catch (error) {
      console.warn('[NotificationService] Initialization error:', error);
    }
  }

  // ─── PERMISSIONS ──────────────────────────────────────────────────────

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') return true;

      const { status: newStatus } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
      });
      return newStatus === 'granted';
    } catch (error) {
      console.warn('[NotificationService] Permission request error:', error);
      return false;
    }
  }

  // ─── SEND LOCAL NOTIFICATION ──────────────────────────────────────────

  /**
   * Schedule a local notification.
   * Returns the notification ID, or null on failure.
   */
  async scheduleLocalNotification(
    payload: LocalNotificationPayload
  ): Promise<string | null> {
    try {
      await this.initialize();

      const triggerInput: Notifications.NotificationTriggerInput | null =
        payload.trigger && 'seconds' in payload.trigger
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: (payload.trigger as { seconds: number }).seconds,
            }
          : (payload.trigger as Notifications.NotificationTriggerInput) || null;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          sound: payload.sound !== false,
          ...(Platform.OS === 'android' && {
            channelId: payload.channelId || 'default',
          }),
        },
        trigger: triggerInput,
      });

      return id;
    } catch (error) {
      console.warn('[NotificationService] Schedule error:', error);
      // Queue for retry
      this.queue.push({
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        payload,
        enqueuedAt: Date.now(),
        attempts: 1,
      });
      return null;
    }
  }

  /**
   * Fire an immediate notification (no trigger).
   */
  async sendImmediate(payload: LocalNotificationPayload): Promise<string | null> {
    return this.scheduleLocalNotification({ ...payload, trigger: null });
  }

  // ─── CHAT NOTIFICATIONS ───────────────────────────────────────────────

  /**
   * Send a notification for a family chat message.
   */
  async sendChatNotification(
    senderName: string,
    messagePreview: string,
    chatId: string
  ): Promise<string | null> {
    return this.sendImmediate({
      title: `💬 ${senderName}`,
      body: messagePreview.slice(0, 120),
      data: {
        type: 'chat_message',
        screen: 'FamilyChat',
        params: { chatId },
        chatId,
      },
      channelId: 'chat',
    });
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.warn('[NotificationService] Cancel error:', error);
    }
  }

  async cancelAll(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('[NotificationService] Cancel all error:', error);
    }
  }

  // ─── QUERY ────────────────────────────────────────────────────────────

  async getAllScheduled(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('[NotificationService] Query error:', error);
      return [];
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
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.warn('[NotificationService] Set badge error:', error);
    }
  }

  // ─── QUEUE MANAGEMENT ─────────────────────────────────────────────────

  /**
   * Retry queued notifications. Call this on app foreground.
   */
  async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const toRetry = [...this.queue];
    this.queue = [];

    for (const item of toRetry) {
      if (item.attempts >= 5) {
        if (__DEV__) {
          console.warn('[NotificationService] Dropping after 5 attempts:', item.id);
        }
        continue;
      }

      const result = await this.scheduleLocalNotification(item.payload);
      if (!result) {
        item.attempts += 1;
        this.queue.push(item);
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

// ─── SINGLETON ──────────────────────────────────────────────────────────

export const notificationService = new NotificationService();
export default notificationService;