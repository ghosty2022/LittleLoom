// src/hooks/useNotificationSetup.ts
// ─────────────────────────────────────────────────────────────────────
// @deprecated  Navigation from notification taps is now owned by
//              AppNavigator via `notificationService.addResponseHandler()`.
//
// This hook used to register its own response handler, which raced with
// AppNavigator's handler and caused "The action 'NAVIGATE' with payload
// {name: 'Reminders'} was not handled" warnings — because it used the
// OLD screen names ('Reminders' instead of 'TrackerReminders', etc.).
//
// It is now a no-op. Kept only so existing call sites don't crash.
// ─────────────────────────────────────────────────────────────────────

import { notificationService } from '@/services/NotificationService';

interface UseNotificationSetupOptions {
  /** @deprecated No longer used. Kept for backward compatibility. */
  autoNavigate?: boolean;
}

/**
 * @deprecated See file header. AppNavigator owns notification tap routing.
 */
export function useNotificationSetup(_options: UseNotificationSetupOptions = {}) {
  return {
    service: notificationService,
  };
}

export default useNotificationSetup;