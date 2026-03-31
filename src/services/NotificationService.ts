// src/services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_SETTINGS_KEY = '@littleloom_notification_settings';

export interface NotificationSettings {
  enabled: boolean;
  achievements: boolean;
  streakReminders: boolean;
  dailySummary: boolean;
  milestoneAlerts: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private settings: NotificationSettings = {
    enabled: true,
    achievements: true,
    streakReminders: true,
    dailySummary: true,
    milestoneAlerts: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  };

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadSettings();
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      await Notifications.setNotificationChannelAsync('achievements', {
        name: 'Achievements',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#f59e0b',
      });
      
      await Notifications.setNotificationChannelAsync('streaks', {
        name: 'Streak Protection',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 100, 300, 100, 300],
        lightColor: '#ef4444',
      });
    }

    // Listen for notification responses
    Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);
  }

  private handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    
    // Handle navigation or actions based on notification type
    if (data?.type === 'streak_reminder') {
      console.log('Navigate to tracking for streak protection');
    } else if (data?.type === 'achievement_unlocked') {
      console.log('Navigate to achievements');
    }
  };

  async loadSettings(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
    }
  }

  async saveSettings(settings: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(this.settings));
  }

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Must use physical device for push notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  }

  async scheduleStreakReminder(streakDays: number, hoursLeft: number): Promise<string | null> {
    if (!this.settings.enabled || !this.settings.streakReminders) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 Streak at Risk!',
        body: `Your ${streakDays}-day streak ends in ${hoursLeft} hours! Log an activity now.`,
        data: { type: 'streak_reminder', screen: 'UniversalTracker' },
        sound: 'default',
        priority: Notifications.AndroidPriority.HIGH,
      },
      trigger: { 
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1 
      },
    });

    // Schedule follow-up if urgent
    if (hoursLeft <= 2) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ URGENT: Streak Ending!',
          body: `Only ${hoursLeft} hours left! Tap to log now!`,
          data: { type: 'streak_urgent', screen: 'UniversalTracker' },
        },
        trigger: { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 3600 
        },
      });
    }

    return id;
  }

  async scheduleAchievementReminder(achievementTitle: string, emoji: string): Promise<string | null> {
    if (!this.settings.enabled || !this.settings.achievements) return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} Achievement Goal`,
        body: `Keep working on: ${achievementTitle}! You're close!`,
        data: { type: 'achievement_reminder', screen: 'Achievements' },
      },
      trigger: { 
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9, 
        minute: 0, 
        repeats: true 
      },
    });
  }

  async scheduleDailySummary(babyName: string): Promise<string | null> {
    if (!this.settings.enabled || !this.settings.dailySummary) return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `📊 Daily Summary for ${babyName}`,
        body: `See today's activities and progress toward achievements!`,
        data: { type: 'daily_summary', screen: 'Timeline' },
      },
      trigger: { 
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20, 
        minute: 0, 
        repeats: true 
      },
    });
  }

  async sendImmediateNotification(title: string, body: string, data?: any): Promise<void> {
    if (!this.settings.enabled) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // null = immediate
    });
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }
}

export const notificationService = NotificationService.getInstance();