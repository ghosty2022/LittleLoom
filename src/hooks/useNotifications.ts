import React from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const getCustomization = async () => {
  const { useCustomization } = await import('@/hooks/useCustomization');
  return useCustomization;
};

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
} as const;

export type NotificationChannels = typeof NOTIFICATION_CHANNELS[keyof typeof NOTIFICATION_CHANNELS];

export async function initNotifications() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return false;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        ...(Platform.OS === 'ios' && {
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      }),
    });

    if (Platform.OS === 'android') {
      const channelConfigs: Array<{ id: string; name: string; importance: Notifications.AndroidImportance; lightColor: string; vibrationPattern?: number[] }> = [
        { id: NOTIFICATION_CHANNELS.DEFAULT, name: 'Default', importance: Notifications.AndroidImportance.MAX, lightColor: '#667eea', vibrationPattern: [0, 250, 250, 250] },
        { id: NOTIFICATION_CHANNELS.REMINDERS, name: 'Reminders', importance: Notifications.AndroidImportance.HIGH, lightColor: '#667eea', vibrationPattern: [0, 250, 250, 250] },
        { id: NOTIFICATION_CHANNELS.ACHIEVEMENTS, name: 'Achievements', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#f59e0b', vibrationPattern: [0, 100, 100, 100] },
        { id: NOTIFICATION_CHANNELS.CHAT, name: 'Chat Messages', importance: Notifications.AndroidImportance.HIGH, lightColor: '#22c55e', vibrationPattern: [0, 100, 50, 100] },
        { id: NOTIFICATION_CHANNELS.SAFETY, name: 'Safety Alerts', importance: Notifications.AndroidImportance.HIGH, lightColor: '#ef4444', vibrationPattern: [0, 300, 100, 300] },
        { id: NOTIFICATION_CHANNELS.ACTIVITIES, name: 'Activity Reminders', importance: Notifications.AndroidImportance.HIGH, lightColor: '#3b82f6', vibrationPattern: [0, 200, 100, 200] },
        { id: NOTIFICATION_CHANNELS.FEEDING, name: 'Feeding Reminders', importance: Notifications.AndroidImportance.HIGH, lightColor: '#fa709a', vibrationPattern: [0, 200, 50, 200] },
        { id: NOTIFICATION_CHANNELS.SLEEP, name: 'Sleep Reminders', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#667eea', vibrationPattern: [0, 150, 150, 150] },
        { id: NOTIFICATION_CHANNELS.POTTY, name: 'Potty Reminders', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#f59e0b', vibrationPattern: [0, 150, 100, 150] },
        { id: NOTIFICATION_CHANNELS.GROWTH, name: 'Growth Tracking', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#22c55e', vibrationPattern: [0, 100, 100, 100] },
      ];

      await Promise.all(
        channelConfigs.map(config => 
          Notifications.setNotificationChannelAsync(config.id, {
            name: config.name,
            importance: config.importance,
            vibrationPattern: config.vibrationPattern,
            lightColor: config.lightColor,
            sound: 'default',
          })
        )
      );
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Error initializing notifications:', message);
    return false;
  }
}

interface ScheduleOptions {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  trigger?: Notifications.NotificationTriggerInput;
  channelId?: NotificationChannels;
}

class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;
  private scheduledReminders: Map<string, string> = new Map();

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    if (this.isInitialized) return true;
    const success = await initNotifications();
    this.isInitialized = success;
    return success;
  }

  async scheduleLocalNotification(options: ScheduleOptions): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          data: options.data || {},
          sound: true,
          badge: 1,
        },
        trigger: options.trigger || null,
      });
      return identifier;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Failed to schedule notification:', message);
      return null;
    }
  }

  async cancelNotification(identifier: string) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      this.scheduledReminders.delete(identifier);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Failed to cancel notification:', message);
    }
  }

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledReminders.clear();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Failed to cancel all notifications:', message);
    }
  }

  async scheduleActivityReminder(type: string, babyName: string, minutes: number, details?: string) {
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
      default: NOTIFICATION_CHANNELS.ACTIVITIES,
    };

    const id = await this.scheduleLocalNotification({
      title: titles[type] || titles.default,
      body: details || `Tap to open LittleLoom and track this activity.`,
      trigger: { seconds: minutes * 60 },
      channelId: channelMap[type] || channelMap.default,
    });

    if (id) {
      this.scheduledReminders.set(`${type}_${babyName}`, id);
    }

    return id;
  }

  async scheduleReminder(type: 'feed' | 'sleep' | 'potty' | 'milestone', babyName: string, minutes: number) {
    return this.scheduleActivityReminder(type, babyName, minutes);
  }

  async sendAchievementNotification(achievement: string, description: string) {
    return this.scheduleLocalNotification({
      title: `🏆 Achievement Unlocked!`,
      body: `${achievement}: ${description}`,
      channelId: NOTIFICATION_CHANNELS.ACHIEVEMENTS,
    });
  }

  async sendChatNotification(senderName: string, message: string) {
    return this.scheduleLocalNotification({
      title: `💬 ${senderName}`,
      body: message,
      channelId: NOTIFICATION_CHANNELS.CHAT,
    });
  }

  async sendSafetyAlert(title: string, body: string) {
    return this.scheduleLocalNotification({
      title: `🛡️ ${title}`,
      body,
      channelId: NOTIFICATION_CHANNELS.SAFETY,
    });
  }

  async sendActivityCompleteNotification(activityType: string, babyName: string) {
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
    });
  }

  getScheduledReminders(): Array<{ key: string; identifier: string }> {
    return Array.from(this.scheduledReminders.entries()).map(([key, identifier]) => ({
      key,
      identifier,
    }));
  }
}

export const notificationService = NotificationService.getInstance();

export function useNotifications() {
  const [isEnabled, setIsEnabled] = React.useState(true);

  React.useEffect(() => {
    const checkSettings = async () => {
      try {
        const useCustomization = await getCustomization();
        const customization = useCustomization();
        setIsEnabled(customization.settings?.notifications ?? true);
      } catch {
        setIsEnabled(true);
      }
    };
    checkSettings();
  }, []);

  const schedule = React.useCallback(async (options: ScheduleOptions) => {
    if (!isEnabled) return null;
    return notificationService.scheduleLocalNotification(options);
  }, [isEnabled]);

  const cancel = React.useCallback((id: string) => {
    return notificationService.cancelNotification(id);
  }, []);

  const cancelAll = React.useCallback(() => {
    return notificationService.cancelAllNotifications();
  }, []);

  const scheduleActivity = React.useCallback((type: string, babyName: string, minutes: number, details?: string) => {
    if (!isEnabled) return Promise.resolve(null);
    return notificationService.scheduleActivityReminder(type, babyName, minutes, details);
  }, [isEnabled]);

  return {
    isEnabled,
    schedule,
    cancel,
    cancelAll,
    scheduleActivity,
    service: notificationService,
  };
}

export default notificationService;
