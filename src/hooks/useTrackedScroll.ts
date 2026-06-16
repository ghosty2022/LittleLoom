import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeApp } from './useSafeContexts';

export const useTrackedScroll = (
  userOnScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
  options?: {
    hideThreshold?: number;
    showThreshold?: number;
    velocityThreshold?: number;
  }
) => {
  const safeApp = useSafeApp();
  const lastY = useRef(0);
  const lastTime = useRef(Date.now());
  const lastProcessedY = useRef(0);
  const lastProcessedTime = useRef(Date.now());
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);

  const {
    hideThreshold = 50,
    showThreshold = 20,
    velocityThreshold = 1.2,
  } = options || {};

  // Guard: if useSafeApp returns invalid data, return a no-op function
  const handleScroll = safeApp?.handleScroll;
  const isCommunityScreen = safeApp?.isCommunityScreen ?? false;
  const hasValidHandler = typeof handleScroll === 'function';

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;
    const isAtTop = currentY <= 2;
    const { contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 2;

    lastY.current = currentY;
    lastTime.current = now;

    // Always call user's onScroll if it's a function
    if (typeof userOnScroll === 'function') {
      userOnScroll(event);
    }

    // If no valid app scroll handler, skip nav tracking
    if (!hasValidHandler) {
      return;
    }

    if (isCommunityScreen) {
      return;
    }

    const deltaTime = now - lastProcessedTime.current;

    if (deltaTime < 12) {
      return;
    }

    const deltaY = currentY - lastProcessedY.current;
    const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0;

    if (deltaY > 0) {
      accumulatedDown.current += deltaY;
      accumulatedUp.current = 0;
    } else if (deltaY < 0) {
      accumulatedUp.current += Math.abs(deltaY);
      accumulatedDown.current = 0;
    }

    if (isAtTop || isAtBottom) {
      handleScroll(currentY, velocity, true);
      accumulatedDown.current = 0;
      accumulatedUp.current = 0;
    } else if (accumulatedDown.current > hideThreshold || (velocity > velocityThreshold && deltaY > 5)) {
      handleScroll(currentY, velocity, false);
      accumulatedDown.current = 0;
    } else if (accumulatedUp.current > showThreshold || (velocity > velocityThreshold && deltaY < -3)) {
      handleScroll(currentY, velocity, true);
      accumulatedUp.current = 0;
    }

    lastProcessedY.current = currentY;
    lastProcessedTime.current = now;
  }, [handleScroll, userOnScroll, isCommunityScreen, hideThreshold, showThreshold, velocityThreshold, hasValidHandler]);

  return onScroll;
};

export default useTrackedScroll;