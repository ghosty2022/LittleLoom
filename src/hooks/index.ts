// src/hooks/index.ts
// ─────────────────────────────────────────────────────────────────────
// Barrel export for all hooks. Single source of truth.
//
// IMPORTANT CONVENTIONS:
//   • Safe hooks (useSafeApp, useSafeAuth, …) never throw — use them in
//     components that might mount before a provider is ready.
//   • `useNotificationSetup` is NOT `useNotifications`:
//       - useNotificationSetup() — registers a navigation tap handler
//       - useNotifications()     — settings + scheduling (from AppContext)
//   • `useTracker` comes from `./useTrackerContext` (safe wrapper), NOT
//     from `../context/TrackerContext` (which only exports the raw context).
//   • The canonical NotificationService singleton is re-exported here so
//     consumers can `import { notificationService } from '@/hooks'`.
// ─────────────────────────────────────────────────────────────────────

// ─── Safe context hooks (never throw) ───────────────────────────────
export {
  useSafeApp,
  useSafeBaby,
  useSafeAuth,
  useSafeCustomization,
  useSafeTracker,
  useSafeActivity,
  useSafeUser,
  useUnifiedTheme,
} from './useSafeContexts';

export { default as useSafeContexts } from './useSafeContexts';

// ─── Main context wrappers ──────────────────────────────────────────
// These delegate to the corresponding context hooks and fall back to
// safe defaults if the provider isn't mounted yet.
export { useActivity } from './useActivity';
export { useAuth } from './useAuth';
export { useBaby } from './useBaby';
export { useCustomization } from './useCustomization';
export { useDatabase } from './useDatabase';
export { useFamily } from './useFamily';
export { useMedia } from './useMedia';
export { useSafety } from './useSafety';
export { useSecurity } from './useSecurity';
export { useSupabase } from './useSupabase';
export { useSweetAlert } from './useSweetAlert';
export { useUser } from './useUser';

// ─── Notification setup (navigation tap handler) ────────────────────
// IMPORTANT: this is NOT the same hook as `useNotifications` from
// `@/context/AppContext`:
//   • useNotificationSetup()  → registers a navigation tap handler
//   • useNotifications()      → settings + scheduling API
//
// The old barrel exported `useNotifications` from a file that never
// existed (`./useNotifications`), which silently broke every screen
// that imported it from `@/hooks`. That bug is fixed here.
export {
  useNotificationSetup,
  default as useNotificationSetupDefault,
} from './useNotificationSetup';

// ─── Feature hooks ──────────────────────────────────────────────────
export { useUnifiedTrackerTheme } from './useUnifiedTrackerTheme';
export { useTracker } from './useTrackerContext';
export { useRouteBasedNavVisibility } from './useRouteBasedNavVisibility';
export {
  useActivityPersistence,
  useEmergencySave,
  useComponentPersistence,
} from './useActivityPersistence';
export { useAnomalyFeedback } from './useAnomalyFeedback';
export { useAppLock } from './useAppLock';
export { useAudioPlayer } from './useAudioPlayer';
export { useCountdown } from './useCountdown';
export { useDateTimePicker } from './useDateTimePicker';
export { useGrowthIntelligence } from './useGrowthIntelligence';
export { useIntelligentSplash } from './useIntelligentSplash';
export { useKeepAwake } from './useKeepAwake';
export { useMeasurementSuggestions } from './useMeasurementSuggestions';
export { useModal } from './useModal';
export {
  usePersistedForm,
  usePersistedScroll,
  usePersistedValue,
} from './usePersistedState';
export { usePhotoCapture } from './usePhotoCapture';
export { usePhotoScanner } from './usePhotoScanner';
export { usePredictiveReminders } from './usePredictiveReminders';
export { useReportRoute } from './useReportRoute';
export { useSmartAlbums } from './useSmartAlbums';
export { useSocialAuth } from './useSocialAuth';
export { useTimelineCorrelations } from './useTimelineCorrelations';
export { useTrackerAchievements } from './useTrackerAchievements';
export { useTrackerProgressive } from './useTrackerProgressive';
export { useVaultUnlock } from './useVaultUnlock';
export { useWHOGrowthCalculator } from './useWHOGrowthCalculator';

// ─── Offline and Realtime hooks ─────────────────────────────────────
export { useOfflineSync } from './useOfflineSync';
export { useRealtimeSubscription } from './useRealtimeSubscription';

// ─── Unified NotificationService (singleton) ────────────────────────
// Re-exported here so consumers can write:
//     import { notificationService, NOTIFICATION_CHANNELS } from '@/hooks';
// instead of deep-importing from '@/services/NotificationService'.
//
// The types are ALIASED to avoid colliding with the `NotificationPayload`
// and `NotificationSettings` shapes already exported by AppContext.
export {
  notificationService,
  NOTIFICATION_CHANNELS,
} from '@/services/NotificationService';

export type {
  NotificationPayload as UnifiedNotificationPayload,
  NotificationSettings as UnifiedNotificationSettings,
  NotificationChannel,
  NotificationResponseHandler,
} from '@/services/NotificationService';

// ─── Namespace re-export ────────────────────────────────────────────
export * as SafeContexts from './useSafeContexts';