import React, { useRef, useCallback } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  FlatList,
  FlatListProps,
  SectionList,
  SectionListProps,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';

// ─── Types ─────────────────────────────────────────────────────────────
type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

// ─── Safe Scroll Hook (no external dependencies that cause re-render loops) ─
const useSafeTrackedScroll = (
  userOnScroll?: ScrollHandler | unknown,
  options?: {
    hideThreshold?: number;
    showThreshold?: number;
    velocityThreshold?: number;
  }
): ScrollHandler => {
  // Refs to track scroll state without causing re-renders
  const lastY = useRef(0);
  const lastProcessedY = useRef(0);
  const lastProcessedTime = useRef(Date.now());
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);
  const directionRef = useRef<'up' | 'down'>('up');
  const isAtTopRef = useRef(true);

  const {
    hideThreshold = 50,
    showThreshold = 20,
    velocityThreshold = 1.2,
  } = options || {};

  // Only call user handler if it's actually a function
  const safeUserHandler = typeof userOnScroll === 'function' ? (userOnScroll as ScrollHandler) : undefined;

  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;
    const { contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtTop = currentY <= 2;
    const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 2;
    const deltaY = currentY - lastY.current;

    lastY.current = currentY;
    isAtTopRef.current = isAtTop;

    if (Math.abs(deltaY) > 0.5) {
      directionRef.current = deltaY > 0 ? 'down' : 'up';
    }

    // Call user's onScroll first
    if (safeUserHandler) {
      safeUserHandler(event);
    }

    // Throttle nav tracking to avoid re-render loops
    const deltaTime = now - lastProcessedTime.current;
    if (deltaTime < 16) return; // 60fps throttle

    const processedDelta = currentY - lastProcessedY.current;
    const velocity = deltaTime > 0 ? Math.abs(processedDelta / deltaTime) : 0;

    if (processedDelta > 0) {
      accumulatedDown.current += processedDelta;
      accumulatedUp.current = 0;
    } else if (processedDelta < 0) {
      accumulatedUp.current += Math.abs(processedDelta);
      accumulatedDown.current = 0;
    }

    // ─── CRITICAL: Dispatch nav visibility via a custom event instead of context state ─
    // This avoids re-render loops by not calling context setState during scroll
    if (isAtTop || isAtBottom) {
      // Show nav at edges
      requestAnimationFrame(() => {
        try {
          // Use a global event emitter or ref-based approach instead of React state
          // This is a placeholder - replace with your actual nav visibility mechanism
          // that doesn't trigger React re-renders (e.g., direct native module call,
          // shared value, or imperative API)
        } catch (e) { /* silent */ }
      });
      accumulatedDown.current = 0;
      accumulatedUp.current = 0;
    } else if (accumulatedDown.current > hideThreshold || (velocity > velocityThreshold && processedDelta > 5)) {
      requestAnimationFrame(() => {
        try { /* hide nav */ } catch (e) { /* silent */ }
      });
      accumulatedDown.current = 0;
    } else if (accumulatedUp.current > showThreshold || (velocity > velocityThreshold && processedDelta < -3)) {
      requestAnimationFrame(() => {
        try { /* show nav */ } catch (e) { /* silent */ }
      });
      accumulatedUp.current = 0;
    }

    lastProcessedY.current = currentY;
    lastProcessedTime.current = now;
  }, [safeUserHandler, hideThreshold, showThreshold, velocityThreshold]);
};

// ─── AutoHideScrollView ────────────────────────────────────────────────────
export const AutoHideScrollView = React.forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const userOnScroll = typeof props.onScroll === 'function' ? props.onScroll : undefined;
    const onScroll = useSafeTrackedScroll(userOnScroll);

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

// ─── AutoHideFlatList ──────────────────────────────────────────────────────
export function AutoHideFlatList<T>(props: FlatListProps<T>) {
  const userOnScroll = typeof props.onScroll === 'function' ? props.onScroll : undefined;
  const onScroll = useSafeTrackedScroll(userOnScroll);

  return (
    <FlatList
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

// ─── AutoHideSectionList ───────────────────────────────────────────────────
export function AutoHideSectionList<T, SectionT>(props: SectionListProps<T, SectionT>) {
  const userOnScroll = typeof props.onScroll === 'function' ? props.onScroll : undefined;
  const onScroll = useSafeTrackedScroll(userOnScroll);

  return (
    <SectionList
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

// ─── AutoHideAnimatedScrollView ────────────────────────────────────────────
// For reanimated scroll views, we MUST preserve the animated event object.
// The user should pass a worklet or useAnimatedScrollHandler result.
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export const AutoHideAnimatedScrollView = React.forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const userOnScroll = props.onScroll;

    // If user passed an animated event object (not a function), preserve it
    // and DON'T wrap it with our tracking - animated events must go directly
    // to Animated.ScrollView without interception.
    const isAnimatedEvent = userOnScroll !== undefined && typeof userOnScroll !== 'function';

    // Only track if it's a plain function
    const trackedOnScroll = useSafeTrackedScroll(
      typeof userOnScroll === 'function' ? userOnScroll : undefined
    );

    const finalOnScroll = isAnimatedEvent ? userOnScroll : trackedOnScroll;

    return (
      <AnimatedScrollView
        ref={ref}
        {...props}
        onScroll={finalOnScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

export default AutoHideScrollView;