import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeApp } from './useSafeContexts';
import Animated, { runOnJS } from 'react-native-reanimated';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
type AnimatedScrollHandler = ReturnType<typeof Animated.useAnimatedScrollHandler>;

export const useTrackedScroll = (
  userOnScroll?: ScrollHandler | AnimatedScrollHandler,
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

  const handleScroll = safeApp?.handleScroll;
  const isCommunityScreen = safeApp?.isCommunityScreen ?? false;
  const hasValidHandler = typeof handleScroll === 'function';

  // Detect if userOnScroll is an animated event object (from useAnimatedScrollHandler)
  const isAnimatedEvent = userOnScroll !== null && 
    typeof userOnScroll === 'object' && 
    !Array.isArray(userOnScroll) &&
    Object.prototype.toString.call(userOnScroll) !== '[object Function]';

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;
    const isAtTop = currentY <= 2;
    const { contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 2;

    lastY.current = currentY;
    lastTime.current = now;

    // If it's a regular function, call it
    if (typeof userOnScroll === 'function') {
      userOnScroll(event);
    }
    // If it's an animated event object, DON'T try to call it - it's handled by Reanimated internally
    // The animated event will fire on its own worklet thread

    if (!hasValidHandler || isCommunityScreen) {
      return;
    }

    const deltaTime = now - lastProcessedTime.current;
    if (deltaTime < 12) return;

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
  }, [handleScroll, userOnScroll, isCommunityScreen, hideThreshold, showThreshold, velocityThreshold, hasValidHandler, isAnimatedEvent]);

  // Return the appropriate handler based on what was passed
  if (isAnimatedEvent) {
    // For animated events, we can't wrap them. Instead, use the scroll handler
    // and let Reanimated handle the animated event separately.
    // The caller should use useAnimatedScrollHandler directly and combine
    // nav tracking via a separate mechanism.
    return onScroll;
  }

  return onScroll;
};