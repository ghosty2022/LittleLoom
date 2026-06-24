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
import Reanimated, {
  useAnimatedScrollHandler,
  AnimatedProps,
  createAnimatedComponent,
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
// Removed: Reanimated v3 has built-in Reanimated.ScrollView
// Removed: Reanimated v3 has built-in Reanimated.FlatList
// Removed: Reanimated v3 has built-in Reanimated.SectionList

// ─── Helper: Detect animated event object ───────────────────────────────
// CRITICAL: useAnimatedScrollHandler returns an OBJECT, not a function.
// Animated.event() also returns an object.
// These objects must ONLY go to Animated.* components.
const isAnimatedEventObject = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value !== 'object') return false;

  // Reanimated v2/v3 event objects
  const keys = Object.keys(value);
  const hasWorklet = keys.includes('__worklet') || value.worklet === true;
  const hasEventName = keys.includes('eventName') || keys.includes('eventNames');
  
  // Reanimated v3 specific
  const isReanimatedHandler = 
    keys.includes('__reanimatedWorkletInit') ||
    typeof value.__reanimatedEventHandler === 'object';

  // RN Animated.event objects
  const isAnimatedEvent = value.__isNative === true ||
    (Array.isArray(value._listeners) && value._listeners.length > 0);

  // Fallback: numeric keys indicate event mapping object
  const hasNumericKeys = keys.some(k => /^\d+$/.test(k));

  return hasWorklet || hasEventName || isReanimatedHandler || isAnimatedEvent || hasNumericKeys;
};

// ─── AutoHideScrollView ─────────────────────────────────────────────────
// ⚠️  FOR REGULAR SCROLL HANDLERS ONLY (function callbacks)
// ⚠️  NEVER pass useAnimatedScrollHandler output here!
// ⚠️  If you do, the animated handler will be SILENTLY IGNORED to prevent crashes.
export const AutoHideScrollView = forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimated = isAnimatedEventObject(userOnScroll);

    if (isAnimated && __DEV__) {
      console.warn(
        `[LittleLoom] AutoHideScrollView received an animated event object for onScroll. ` +
        `This will be ignored. Use AutoHideAnimatedScrollView instead for animated scroll handlers. `
      );
    }

    // Only accept function handlers. Animated objects are discarded.
    const safeUserOnScroll = (!isAnimated && typeof userOnScroll === 'function')
      ? userOnScroll
      : undefined;

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
// ✅ FOR ANIMATED EVENTS ONLY (useAnimatedScrollHandler output)
// ✅ This uses Reanimated.ScrollView under the hood
interface AnimatedScrollViewProps extends ScrollViewProps {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedScrollView = forwardRef<ScrollView, AnimatedScrollViewProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimated = isAnimatedEventObject(userOnScroll);

    if (isAnimated) {
      return (
        <Reanimated.ScrollView
          ref={ref}
          {...rest}
          onScroll={userOnScroll as any}
          scrollEventThrottle={props.scrollEventThrottle || 16}
        />
      );
    }

    // Regular function handler - wrap with tracking
    const trackedOnScroll = useSafeTrackedScroll(
      typeof userOnScroll === 'function' ? userOnScroll : undefined
    );

    return (
      <Reanimated.ScrollView
        ref={ref}
        {...rest}
        onScroll={trackedOnScroll as any}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideFlatList ───────────────────────────────────────────────────
// ⚠️  FOR REGULAR SCROLL HANDLERS ONLY
export const AutoHideFlatList = forwardRef<FlatList<any>, FlatListProps<any>>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimated = isAnimatedEventObject(userOnScroll);

    if (isAnimated && __DEV__) {
      console.warn(
        `[LittleLoom] AutoHideFlatList received an animated event object for onScroll. ` +
        `This will be ignored. Use AutoHideAnimatedFlatList instead.`
      );
    }

    const safeUserOnScroll = (!isAnimated && typeof userOnScroll === 'function')
      ? userOnScroll
      : undefined;

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
// ✅ FOR ANIMATED EVENTS ONLY
interface AnimatedFlatListProps extends FlatListProps<any> {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedFlatList = forwardRef<FlatList<any>, AnimatedFlatListProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimated = isAnimatedEventObject(userOnScroll);

    if (isAnimated) {
      return (
        <Reanimated.FlatList
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
      <Reanimated.FlatList
        ref={ref}
        {...rest}
        onScroll={trackedOnScroll as any}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

// ─── AutoHideSectionList ────────────────────────────────────────────────
// ⚠️  FOR REGULAR SCROLL HANDLERS ONLY
export const AutoHideSectionList = forwardRef<SectionList<any>, SectionListProps<any>>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimated = isAnimatedEventObject(userOnScroll);

    if (isAnimated && __DEV__) {
      console.warn(
        `[LittleLoom] AutoHideSectionList received an animated event object for onScroll. ` +
        `This will be ignored. Use AutoHideAnimatedSectionList instead.`
      );
    }

    const safeUserOnScroll = (!isAnimated && typeof userOnScroll === 'function')
      ? userOnScroll
      : undefined;

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
// ✅ FOR ANIMATED EVENTS ONLY
interface AnimatedSectionListProps extends SectionListProps<any> {
  onScroll?: ReturnType<typeof useAnimatedScrollHandler> | ScrollHandler;
}

export const AutoHideAnimatedSectionList = forwardRef<SectionList<any>, AnimatedSectionListProps>(
  (props, ref) => {
    const { onScroll: userOnScroll, ...rest } = props;

    const isAnimated = isAnimatedEventObject(userOnScroll);

    if (isAnimated) {
      return (
        <Reanimated.SectionList
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
      <Reanimated.SectionList
        ref={ref}
        {...rest}
        onScroll={trackedOnScroll as any}
        scrollEventThrottle={props.scrollEventThrottle || 16}
      />
    );
  }
);

export default AutoHideScrollView;
