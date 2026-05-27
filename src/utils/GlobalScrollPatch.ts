// src/utils/GlobalScrollPatch.ts
/**
 * GLOBAL SCROLL PATCH - Safe hook-based approach
 * Use useTrackedScroll() in your ScrollViews/FlatLists instead of patching RN internals
 */

import {
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

// ============================================
// SCROLL DIRECTION & STATE
// ============================================

export type ScrollDirection = 'up' | 'down' | 'none';

export interface ScrollState {
  direction: ScrollDirection;
  offsetY: number;
  velocity: number;
  isAtTop: boolean;
  isAtBottom: boolean;
  isScrolling: boolean;
}

// ============================================
// GLOBAL SCROLL HANDLER REGISTRY
// ============================================

type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>, state: ScrollState) => void;

const scrollHandlers = new Set<ScrollHandler>();

export const registerScrollHandler = (handler: ScrollHandler) => {
  scrollHandlers.add(handler);
  return () => scrollHandlers.delete(handler);
};

export const emitScrollEvent = (
  event: NativeSyntheticEvent<NativeScrollEvent>,
  state: ScrollState
) => {
  scrollHandlers.forEach(handler => {
    try {
      handler(event, state);
    } catch (e) {
      console.error('Scroll handler error:', e);
    }
  });
};

// ============================================
// SCROLL STATE CALCULATOR
// ============================================

let lastOffsetY = 0;
let lastTimestamp = 0;
let scrollTimeout: NodeJS.Timeout | null = null;

export const calculateScrollState = (
  event: NativeSyntheticEvent<NativeScrollEvent>
): ScrollState => {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  const currentOffsetY = contentOffset.y;
  const currentTimestamp = Date.now();
  const deltaY = currentOffsetY - lastOffsetY;
  const deltaTime = currentTimestamp - lastTimestamp;

  const velocity = deltaTime > 0 ? Math.abs(deltaY / deltaTime) : 0;

  let direction: ScrollDirection = 'none';
  if (Math.abs(deltaY) > 2) {
    direction = deltaY > 0 ? 'down' : 'up';
  }

  const isAtTop = currentOffsetY <= 0;
  const isAtBottom = currentOffsetY + layoutMeasurement.height >= contentSize.height - 10;

  lastOffsetY = currentOffsetY;
  lastTimestamp = currentTimestamp;

  return {
    direction,
    offsetY: currentOffsetY,
    velocity,
    isAtTop,
    isAtBottom,
    isScrolling: true,
  };
};

export const markScrollEnd = () => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    lastOffsetY = 0;
    lastTimestamp = 0;
  }, 150);
};

// ============================================
// HOOK: useTrackedScroll
// Drop-in replacement for onScroll in any ScrollView/FlatList/SectionList
// ============================================

export const useTrackedScroll = (
  originalOnScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
) => {
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const state = calculateScrollState(event);
    emitScrollEvent(event, state);
    markScrollEnd();
    originalOnScroll?.(event);
  }, [originalOnScroll]);
};

// ============================================
// HOOK: useScrollHandlerRegistration
// For NavigationContext to listen globally
// ============================================

export const useScrollHandlerRegistration = (handler: ScrollHandler) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrappedHandler: ScrollHandler = (event, state) => {
      handlerRef.current(event, state);
    };
    return registerScrollHandler(wrappedHandler);
  }, []);
};

// ============================================
// HOOK: useAutoHideNavOnScroll
// Convenience hook for screens that need nav auto-hide
// ============================================

const SCROLL_DOWN_THRESHOLD = 50;
const SCROLL_UP_THRESHOLD = 10;
const VELOCITY_THRESHOLD = 0.5;

export const useAutoHideNavOnScroll = (
  onHideNav: () => void,
  onShowNav: () => void,
  options?: {
    downThreshold?: number;
    upThreshold?: number;
    velocityThreshold?: number;
    disabled?: boolean;
  }
) => {
  const {
    downThreshold = SCROLL_DOWN_THRESHOLD,
    upThreshold = SCROLL_UP_THRESHOLD,
    velocityThreshold = VELOCITY_THRESHOLD,
    disabled = false,
  } = options || {};

  const accumulatedScroll = useRef(0);
  const isHidden = useRef(false);

  const handleScroll = useCallback((state: ScrollState) => {
    if (disabled) return;

    if (state.isAtTop) {
      if (isHidden.current) {
        isHidden.current = false;
        accumulatedScroll.current = 0;
        onShowNav();
      }
      return;
    }

    if (state.direction === 'down') {
      accumulatedScroll.current += Math.abs(state.offsetY - lastOffsetY);
      if (!isHidden.current && accumulatedScroll.current > downThreshold && state.velocity > velocityThreshold) {
        isHidden.current = true;
        onHideNav();
      }
    }

    if (state.direction === 'up') {
      accumulatedScroll.current = 0;
      if (isHidden.current && Math.abs(state.offsetY - lastOffsetY) > upThreshold) {
        isHidden.current = false;
        onShowNav();
      }
    }
  }, [disabled, downThreshold, upThreshold, velocityThreshold, onHideNav, onShowNav]);

  useScrollHandlerRegistration((event, state) => {
    handleScroll(state);
  });
};

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

export const patchScrollComponents = () => {
  console.log('⚠️ patchScrollComponents() is deprecated. Use useTrackedScroll() hook instead.');
};

export default {
  registerScrollHandler,
  emitScrollEvent,
  useTrackedScroll,
  useScrollHandlerRegistration,
  useAutoHideNavOnScroll,
  calculateScrollState,
};