// src/hooks/useTrackedScroll.ts
import { useTrackedScroll as useGlobalTrackedScroll } from '../utils/GlobalScrollPatch';

// Re-export with simpler name for your screens
export const useTrackedScroll = useGlobalTrackedScroll;

// Also export as default
export default useTrackedScroll;