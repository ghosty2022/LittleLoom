// src/hooks/useNotifications.ts
import { useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/NotificationService';

export function useNotifications() {
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Initialize notifications on app start
    notificationService.initialize();
    
    // Request permissions
    notificationService.requestPermissions();
    
    // Listen for incoming notifications while app is running
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });
    
    // Listen for notification responses (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;
      
      // Handle deep linking based on notification data
      if (data?.screen) {
        console.log('Should navigate to:', data.screen);
      }
    });
    
    return () => {
      notificationListener.remove();
      responseListener.current?.remove();
    };
  }, []);

  const scheduleStreakReminder = useCallback(async (streakDays: number, hoursLeft: number) => {
    return await notificationService.scheduleStreakReminder(streakDays, hoursLeft);
  }, []);

  const scheduleAchievementReminder = useCallback(async (title: string, emoji: string) => {
    return await notificationService.scheduleAchievementReminder(title, emoji);
  }, []);

  const scheduleDailySummary = useCallback(async (babyName: string) => {
    return await notificationService.scheduleDailySummary(babyName);
  }, []);

  const sendImmediateNotification = useCallback(async (title: string, body: string, data?: any) => {
    await notificationService.sendImmediateNotification(title, body, data);
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    await notificationService.cancelAllNotifications();
  }, []);

  return {
    scheduleStreakReminder,
    scheduleAchievementReminder,
    scheduleDailySummary,
    sendImmediateNotification,
    cancelAllNotifications,
  };
}

export default useNotifications;