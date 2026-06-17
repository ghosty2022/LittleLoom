import React, { useCallback, useRef, forwardRef } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  FlatList,
  FlatListProps,
  SectionList,
  SectionListProps,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  AnimatedProps,
} from 'react-native-reanimated';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

// ─── Safe Scroll Hook ──────────────────────────────────────────────────
const useSafeTrackedScroll = (
  userOnScroll?: ScrollHandler | unknown,
  options?: {
    hideThreshold?: number;
    showThreshold?: number;
    velocityThreshold?: number;
  }
): ScrollHandler => {
  const lastY = useRef(0);
  const lastProcessedY = useRef(0);
  const lastProcessedTime = useRef(Date.now());
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);

  const {
    hideThreshold = 50,
    showThreshold = 20,
    velocityThreshold = 1.2,
  } = options || {};

  // CRITICAL FIX: Only use userOnScroll if it's actually a function
  const safeUserHandler = typeof userOnScroll === 'function' ? (userOnScroll as ScrollHandler) : undefined;

  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;
    const { contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtTop = currentY <= 2;
    const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 2;

    lastY.current = currentY;

    // Call user's onScroll first - ONLY if it's a function
    if (safeUserHandler) {
      safeUserHandler(event);
    }

    // Throttle nav tracking
    const deltaTime = now - lastProcessedTime.current;
    if (deltaTime < 16) return;

    const processedDelta = currentY - lastProcessedY.current;
    const velocity = deltaTime > 0 ? Math.abs(processedDelta / deltaTime) : 0;

    if (processedDelta > 0) {
      accumulatedDown.current += processedDelta;
      accumulatedUp.current = 0;
    } else if (processedDelta < 0) {
      accumulatedUp.current += Math.abs(processedDelta);
      accumulatedDown.current = 0;
    }

    if (isAtTop || isAtBottom) {
      accumulatedDown.current = 0;
      accumulatedUp.current = 0;
    } else if (accumulatedDown.current > hideThreshold || (velocity > velocityThreshold && processedDelta > 5)) {
      accumulatedDown.current = 0;
    } else if (accumulatedUp.current > showThreshold || (velocity > velocityThreshold && processedDelta < -3)) {
      accumulatedUp.current = 0;
    }

    lastProcessedY.current = currentY;
    lastProcessedTime.current = now;
  }, [safeUserHandler, hideThreshold, showThreshold, velocityThreshold]);
};

// ─── Animated ScrollView component ─────────────────────────────────────
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ─── AutoHideScrollView ────────────────────────────────────────────────────
export const AutoHideScrollView = forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const userOnScroll = props.onScroll;
    
    // CRITICAL FIX: Check if it's an animated event object
    const isAnimatedEvent = typeof userOnScroll === 'object' && userOnScroll !== null;
    
    if (isAnimatedEvent) {
      // Use Animated.ScrollView for animated events
      return (
        <AutoHideAnimatedScrollView
          ref={ref as any}
          {...(props as any)}
          onScroll={userOnScroll as any}
        />
      );
    }

    const safeUserOnScroll = typeof userOnScroll === 'function' ? userOnScroll : undefined;
    const onScroll = useSafeTrackedScroll(safeUserOnScroll);

    return (
      <ScrollView
        ref={ref}
        {...props}
        onScroll={onScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideAnimatedScrollView ────────────────────────────────────────────
// For ANIMATED ScrollView - properly handles animated events
interface AnimatedScrollViewProps extends ScrollViewProps {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedScrollView = forwardRef<ScrollView, AnimatedScrollViewProps>(
  (props, ref) => {
    const userOnScroll = props.onScroll;

    // Check if this is an animated event object (from useAnimatedScrollHandler)
    const isAnimatedEvent = typeof userOnScroll === 'object' && userOnScroll !== null;

    // If it's a plain function, wrap it with tracking
    // If it's an animated event, pass it through directly
    const trackedOnScroll = useSafeTrackedScroll(
      typeof userOnScroll === 'function' ? userOnScroll : undefined
    );

    // CRITICAL: For animated events, pass the original object directly.
    // For functions, use the tracked wrapper.
    const finalOnScroll = isAnimatedEvent ? userOnScroll : trackedOnScroll;

    return (
      <AnimatedScrollView
        ref={ref}
        {...props}
        onScroll={finalOnScroll as any}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

export default AutoHideScrollView;