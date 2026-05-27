// src/hooks/useTrackedScroll.ts
import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { scrollEmitter } from '../context/NavigationContext';

/**
 * Hook to track scroll events and auto-hide/show the navigation bar.
 * 
 * Usage:
 *   const { onScroll } = useTrackedScroll();
 *   <ScrollView onScroll={onScroll} scrollEventThrottle={16}>
 * 
 * Or with your own handler:
 *   const { onScroll } = useTrackedScroll((e) => console.log(e.nativeEvent.contentOffset.y));
 */
export const useTrackedScroll = (
  userOnScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
) => {
  const lastY = useRef(0);
  const lastTime = useRef(0);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;

    // Throttle to ~60fps and only emit on meaningful changes
    if (now - lastTime.current < 16) {
      userOnScroll?.(event);
      return;
    }

    // Only emit if actually moving (prevents jitter at boundaries)
    if (Math.abs(currentY - lastY.current) > 0.5) {
      scrollEmitter.emit(event);
      lastY.current = currentY;
    }

    lastTime.current = now;
    userOnScroll?.(event);
  }, [userOnScroll]);

  return { onScroll: handleScroll };
};

export default useTrackedScroll;