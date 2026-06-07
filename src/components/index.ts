// src/components/index.ts
// UNIFIED COMPONENT EXPORTS — Single source of truth for all UI components

// ─── Core UI ───
export { CircularProgress } from './CircularProgress';
export { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from './SafeAvatar';
export { ScreenWrapper } from './ScreenWrapper';
export { LiquidGlassNavigation } from './LiquidGlassNavigation';
export { GlobalAudioPlayer } from './GlobalAudioPlayer';

// ─── Loading & Feedback ───
export {
  UniversalSpinner,
  InlineSpinner,
  CommunitySpinner,
  AuthSpinner,
  SettingsSpinner,
  TrackingSpinner,
  SkeletonLoader,
  ShimmerLoader,
  ShimmerPresets,
  ScreenSkeletons,
} from './UniversalSpinner';

// ─── Alerts & Modals ───
export { SweetAlertProvider, useSweetAlert, showSweetAlert } from './SweetAlert';

// ─── Error Handling ───
export { ErrorBoundary, useErrorHandler } from './ErrorBoundary';

// ─── Scroll Wrappers ───
export { AutoHideScrollView, AutoHideAnimatedScrollView } from './AutoHideScrollWrappers';