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

// ─── Types ─────────────────────────────────────────────────────────────
type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

// ─── Utility: Check if value is an animated event object ───────────────
const isAnimatedEventObject = (value: any): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'function') return false;
  // Animated event objects from Reanimated typically have these properties
  // or are objects with a specific structure
  return typeof value === 'object';
};

// ─── Safe Scroll Hook ──────────────────────────────────────────────────
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
  // CRITICAL: Never call if it's an animated event object
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

    // Call user's onScroll first - ONLY if it's a function
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

    // Navigation visibility logic (placeholder - implement based on your nav system)
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

// ─── AutoHideScrollView ────────────────────────────────────────────────────
// For REGULAR ScrollView - only accepts function onScroll
export const AutoHideScrollView = forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    // CRITICAL: Only extract onScroll if it's a function
    // If it's an animated event object, DO NOT use it - log warning and ignore
    const userOnScroll = props.onScroll;
    const isAnimatedEvent = isAnimatedEventObject(userOnScroll);

    // Safety check: if animated event is passed to regular ScrollView, warn and ignore
    if (isAnimatedEvent) {
      console.warn(
        '[AutoHideScrollView] Animated event object passed to regular ScrollView. ' +
        'Use AutoHideAnimatedScrollView for animated scroll handlers. ' +
        'The animated onScroll will be ignored to prevent crashes.'
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

// ─── AutoHideFlatList ──────────────────────────────────────────────────────
// For REGULAR FlatList - only accepts function onScroll
export function AutoHideFlatList<T>(props: FlatListProps<T>) {
  const userOnScroll = props.onScroll;
  const isAnimatedEvent = isAnimatedEventObject(userOnScroll);

  if (isAnimatedEvent) {
    console.warn(
      '[AutoHideFlatList] Animated event object passed to regular FlatList. ' +
      'Use Animated.FlatList directly for animated scroll handlers.'
    );
  }

  const safeUserOnScroll = typeof userOnScroll === 'function' ? userOnScroll : undefined;
  const onScroll = useSafeTrackedScroll(safeUserOnScroll);

  return (
    <FlatList
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

// ─── AutoHideSectionList ───────────────────────────────────────────────────
// For REGULAR SectionList - only accepts function onScroll
export function AutoHideSectionList<T, SectionT>(props: SectionListProps<T, SectionT>) {
  const userOnScroll = props.onScroll;
  const isAnimatedEvent = isAnimatedEventObject(userOnScroll);

  if (isAnimatedEvent) {
    console.warn(
      '[AutoHideSectionList] Animated event object passed to regular SectionList. ' +
      'Use Animated.SectionList directly for animated scroll handlers.'
    );
  }

  const safeUserOnScroll = typeof userOnScroll === 'function' ? userOnScroll : undefined;
  const onScroll = useSafeTrackedScroll(safeUserOnScroll);

  return (
    <SectionList
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

// ─── AutoHideAnimatedScrollView ────────────────────────────────────────────
// For ANIMATED ScrollView - properly handles both animated events AND functions
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Extend props to allow animated onScroll
interface AnimatedScrollViewProps extends ScrollViewProps {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedScrollView = forwardRef<ScrollView, AnimatedScrollViewProps>(
  (props, ref) => {
    const userOnScroll = props.onScroll;

    // Check if this is an animated event object (from useAnimatedScrollHandler)
    const isAnimatedEvent = isAnimatedEventObject(userOnScroll);

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

// ─── AutoHideAnimatedFlatList ──────────────────────────────────────────────
// For ANIMATED FlatList
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

interface AnimatedFlatListProps<T> extends FlatListProps<T> {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export function AutoHideAnimatedFlatList<T>(props: AnimatedFlatListProps<T>) {
  const userOnScroll = props.onScroll;
  const isAnimatedEvent = isAnimatedEventObject(userOnScroll);

  const trackedOnScroll = useSafeTrackedScroll(
    typeof userOnScroll === 'function' ? userOnScroll : undefined
  );

  const finalOnScroll = isAnimatedEvent ? userOnScroll : trackedOnScroll;

  return (
    <AnimatedFlatList
      {...props}
      onScroll={finalOnScroll as any}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

// ─── AutoHideAnimatedSectionList ───────────────────────────────────────────
// For ANIMATED SectionList
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

interface AnimatedSectionListProps<T, SectionT> extends SectionListProps<T, SectionT> {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export function AutoHideAnimatedSectionList<T, SectionT>(props: AnimatedSectionListProps<T, SectionT>) {
  const userOnScroll = props.onScroll;
  const isAnimatedEvent = isAnimatedEventObject(userOnScroll);

  const trackedOnScroll = useSafeTrackedScroll(
    typeof userOnScroll === 'function' ? userOnScroll : undefined
  );

  const finalOnScroll = isAnimatedEvent ? userOnScroll : trackedOnScroll;

  return (
    <AnimatedSectionList
      {...props}
      onScroll={finalOnScroll as any}
      scrollEventThrottle={props.scrollEventThrottle || 16}
    />
  );
}

export default AutoHideScrollView;