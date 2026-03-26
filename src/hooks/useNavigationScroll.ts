// src/hooks/useNavigationScroll.ts
import { useTrackedScroll } from '../utils/GlobalScrollPatch';

export const useNavigationScroll = (onScroll?: (e: any) => void) => {
  return useTrackedScroll(onScroll);
};