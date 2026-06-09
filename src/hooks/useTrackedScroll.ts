import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeApp } from '../hooks/useSafeContexts';

export const useTrackedScroll = (
  userOnScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
) => {
  const { handleScroll, isCommunityScreen } = useSafeApp();
  const lastY = useRef(0);
  const lastTime = useRef(Date.now());
  const lastProcessedY = useRef(0);
  const lastProcessedTime = useRef(Date.now());

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;
    const isAtTop = currentY <= 5;

    // Always update last known position for continuity
    lastY.current = currentY;
    lastTime.current = now;

    // Skip nav handling on community screens
    if (isCommunityScreen) {
      if (typeof userOnScroll === 'function') {
        userOnScroll(event);
      }
      return;
    }

    const deltaTime = now - lastProcessedTime.current;

    // Throttle: only process for nav every ~16ms (60fps), but always process user callback
    if (deltaTime < 16) {
      if (typeof userOnScroll === 'function') {
        userOnScroll(event);
      }
      return;
    }

    const deltaY = currentY - lastProcessedY.current;
    const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0;

    // Only emit to nav handler if meaningful scroll occurred
    if (Math.abs(deltaY) > 0.5 || isAtTop) {
      handleScroll(currentY, velocity, isAtTop);
      lastProcessedY.current = currentY;
      lastProcessedTime.current = now;
    }

    if (typeof userOnScroll === 'function') {
      userOnScroll(event);
    }
  }, [handleScroll, userOnScroll, isCommunityScreen]);

  return onScroll;
};

export default useTrackedScroll;