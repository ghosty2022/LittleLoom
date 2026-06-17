// src/components/AutoHideScrollWrappers.tsx
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
  userOnScroll?: ScrollHandler,
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

  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const currentY = event.nativeEvent.contentOffset.y;
    const { contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtTop = currentY <= 2;
    const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 2;

    lastY.current = currentY;

    // Call user's function handler
    if (userOnScroll) {
      userOnScroll(event);
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
  }, [userOnScroll, hideThreshold, showThreshold, velocityThreshold]);
};

// ─── Animated component factories ────────────────────────────────────────
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

// ─── AutoHideScrollView ─────────────────────────────────────────────────
// FOR REGULAR SCROLL HANDLERS ONLY (function callbacks)
// NEVER pass useAnimatedScrollHandler output here!
export const AutoHideScrollView = forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;
    
    // Only accept function handlers
    const safeUserOnScroll = typeof userOnScroll === 'function' ? userOnScroll : undefined;
    const onScroll = useSafeTrackedScroll(safeUserOnScroll);

    return (
      <ScrollView
        ref={ref}
        {...rest}
        onScroll={onScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideAnimatedScrollView ─────────────────────────────────────────
// FOR ANIMATED EVENTS ONLY (useAnimatedScrollHandler output)
// This uses Animated.ScrollView under the hood
interface AnimatedScrollViewProps extends ScrollViewProps {
  // Accept both animated event objects and regular functions
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedScrollView = forwardRef<ScrollView, AnimatedScrollViewProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    // If it's an animated event object, pass directly to AnimatedScrollView
    // AnimatedScrollView knows how to handle reanimated event objects
    const isAnimatedEvent = userOnScroll !== null && 
      typeof userOnScroll === 'object' && 
      typeof (userOnScroll as any).__worklet !== 'undefined';

    if (isAnimatedEvent) {
      return (
        <AnimatedScrollView
          ref={ref}
          {...rest}
          onScroll={userOnScroll as any}
          scrollEventThrottle={props.scrollEventThrottle || 16}
        />
      );
    }

    // Otherwise, wrap with tracking
    const trackedOnScroll = useSafeTrackedScroll(
      typeof userOnScroll === 'function' ? userOnScroll : undefined
    );

    return (
      <AnimatedScrollView
        ref={ref}
        {...rest}
        onScroll={trackedOnScroll as any}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideFlatList ───────────────────────────────────────────────────
// FOR REGULAR SCROLL HANDLERS ONLY
export const AutoHideFlatList = forwardRef<FlatList<any>, FlatListProps<any>>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;
    
    const safeUserOnScroll = typeof userOnScroll === 'function' ? userOnScroll : undefined;
    const onScroll = useSafeTrackedScroll(safeUserOnScroll);

    return (
      <FlatList
        ref={ref}
        {...rest}
        onScroll={onScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideAnimatedFlatList ───────────────────────────────────────────
// FOR ANIMATED EVENTS ONLY
interface AnimatedFlatListProps extends FlatListProps<any> {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedFlatList = forwardRef<FlatList<any>, AnimatedFlatListProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimatedEvent = userOnScroll !== null && 
      typeof userOnScroll === 'object' && 
      typeof (userOnScroll as any).__worklet !== 'undefined';

    if (isAnimatedEvent) {
      return (
        <AnimatedFlatList
          ref={ref}
          {...rest}
          onScroll={userOnScroll as any}
          scrollEventThrottle={props.scrollEventThrottle || 16}
        />
      );
    }

    const trackedOnScroll = useSafeTrackedScroll(
      typeof userOnScroll === 'function' ? userOnScroll : undefined
    );

    return (
      <AnimatedFlatList
        ref={ref}
        {...rest}
        onScroll={trackedOnScroll as any}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideSectionList ────────────────────────────────────────────────
// FOR REGULAR SCROLL HANDLERS ONLY
export const AutoHideSectionList = forwardRef<SectionList<any>, SectionListProps<any>>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;
    
    const safeUserOnScroll = typeof userOnScroll === 'function' ? userOnScroll : undefined;
    const onScroll = useSafeTrackedScroll(safeUserOnScroll);

    return (
      <SectionList
        ref={ref}
        {...rest}
        onScroll={onScroll}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideAnimatedSectionList ────────────────────────────────────────
// FOR ANIMATED EVENTS ONLY
interface AnimatedSectionListProps extends SectionListProps<any> {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedSectionList = forwardRef<SectionList<any>, AnimatedSectionListProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimatedEvent = userOnScroll !== null && 
      typeof userOnScroll === 'object' && 
      typeof (userOnScroll as any).__worklet !== 'undefined';

    if (isAnimatedEvent) {
      return (
        <AnimatedSectionList
          ref={ref}
          {...rest}
          onScroll={userOnScroll as any}
          scrollEventThrottle={props.scrollEventThrottle || 16}
        />
      );
    }

    const trackedOnScroll = useSafeTrackedScroll(
      typeof userOnScroll === 'function' ? userOnScroll : undefined
    );

    return (
      <AnimatedSectionList
        ref={ref}
        {...rest}
        onScroll={trackedOnScroll as any}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

export default AutoHideScrollView;