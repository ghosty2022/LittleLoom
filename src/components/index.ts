// src/components/index.ts

// REMOVED: export { AutoHideScrollView } from './AutoHideScrollWrappers';

// Default exports (components that use `export default`)
export { default as LiquidGlassNavigation } from './LiquidGlassNavigation';
export { default as CircularProgress } from './CircularProgress';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as GlobalAudioPlayer } from './GlobalAudioPlayer';
export { default as SafeAvatar } from './SafeAvatar';
export { default as ScreenWrapper } from './ScreenWrapper';
export { default as SweetAlert } from './SweetAlert';
export { default as TimelinePicker } from './trackers/TimelinePicker';
export { default as DynamicTrackerForm } from './trackers/DynamicTrackerForm';
export { default as TrackerEntryCard } from './trackers/TrackerEntryCard';
export { default as LittleLoomAvatars } from './avatars/LittleLoomAvatars';
export { default as LittleLoomIcons } from './icons/LittleLoomIcons';

// Named exports (components that export named members)
export { InlineSpinner } from './UniversalSpinner';

// SafeAvatar named exports (SafeBabyAvatar, SafeParentAvatar are named exports in SafeAvatar.tsx)
export { SafeBabyAvatar, SafeParentAvatar } from './SafeAvatar';

// TabIcons — individual icon components (named exports, not default)
export { HomeIcon, TrackIcon, GrowIcon, ConnectIcon, MoreIcon, AddLogIcon } from './TabIcons';