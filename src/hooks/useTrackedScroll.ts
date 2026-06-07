import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeApp } from '../hooks/useSafeContexts';

export const useTrackedScroll = (
  userOnScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
) => {
  const { handleScroll } = useSafeApp(); // ✅ FIXED: was useApp() — doesn't exist
  const lastY = useRef(0);
  const lastTime = useRef(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;
    const deltaTime = now - lastTime.current;

    // Throttle to ~60fps
    if (deltaTime < 16) {
      if (typeof userOnScroll === 'function') {
        userOnScroll(event);
      }
      return;
    }

    const deltaY = currentY - lastY.current;
    const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0;
    const isAtTop = currentY <= 5;

    // Only emit if meaningful scroll
    if (Math.abs(deltaY) > 0.5) {
      handleScroll(currentY, velocity, isAtTop);
      lastY.current = currentY;
    }

    lastTime.current = now;
    if (typeof userOnScroll === 'function') {
      userOnScroll(event);
    }
  }, [handleScroll, userOnScroll]);

  return onScroll;
};

export default useTrackedScroll;