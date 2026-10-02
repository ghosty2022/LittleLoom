// src/hooks/useNotificationSetup.ts
// ─────────────────────────────────────────────────────────────────────
// Hook to set up notification response handling with navigation.
// Call this ONCE in your root navigation component.
// ─────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { notificationService } from '@/services/NotificationService';

interface UseNotificationSetupOptions {
  /** Whether to automatically navigate on notification tap */
  autoNavigate?: boolean;
}

export function useNotificationSetup(options: UseNotificationSetupOptions = {}) {
  const { autoNavigate = true } = options;
  const navigation = useNavigation<any>();
  const isSetupRef = useRef(false);
  const initialNotificationHandledRef = useRef(false);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      if (!autoNavigate) return;

      const data = response.notification.request.content.data || {};
      const type = data.type as string;
      const screen = data.screen as string;
      const params = (data.params as Record<string, unknown>) || {};

      console.log('[NotificationSetup] Handling tap:', { type, screen, params });

      try {
        switch (type) {
          case 'chat_message':
            navigation.navigate('FamilyChat', {
              chatId: data.chatId,
              ...params,
            });
            break;

          case 'achievement_unlocked':
          case 'achievement_reminder':
            navigation.navigate('Achievements', params);
            break;

          case 'activity_reminder':
          case 'reminder':
            navigation.navigate('Reminders', params);
            break;

          case 'streak_reminder':
          case 'streak_urgent':
            navigation.navigate('Timeline', { type: 'potty', ...params });
            break;

          case 'safety_alert':
          case 'sos':
            navigation.navigate('Safety', params);
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
            } else {
              // Default to home
              navigation.navigate('Home');
            }
        }
      } catch (error) {
        console.warn('[NotificationSetup] Navigation error:', error);
        // Fallback to home
        try {
          navigation.navigate('Home');
        } catch {}
      }
    },
    [navigation, autoNavigate]
  );

  useEffect(() => {
    if (isSetupRef.current) return;
    isSetupRef.current = true;

    // Register response handler
    const unsubscribe = notificationService.addResponseHandler(
      handleNotificationResponse
    );

    // Handle initial notification (app was opened from notification)
    const handleInitialNotification = async () => {
      if (initialNotificationHandledRef.current) return;
      initialNotificationHandledRef.current = true;

      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          console.log('[NotificationSetup] App opened from notification');
          // Small delay to ensure navigation is ready
          setTimeout(() => {
            handleNotificationResponse(response);
          }, 500);
        }
      } catch (error) {
        console.warn('[NotificationSetup] Initial notification error:', error);
      }
    };

    handleInitialNotification();

    return () => {
      unsubscribe();
    };
  }, [handleNotificationResponse]);

  return {
    service: notificationService,
  };
}

export default useNotificationSetup;