












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