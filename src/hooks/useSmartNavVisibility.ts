// src/hooks/useSmartNavVisibility.ts
import { useCallback, useRef, useEffect } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

interface SmartNavConfig {
  /** Minimum scroll velocity (px/ms) to trigger hide */
  hideVelocityThreshold?: number;
  /** Minimum scroll velocity to trigger show */
  showVelocityThreshold?: number;
  /** Accumulated scroll distance before hiding */
  hideDistanceThreshold?: number;
  /** Accumulated scroll distance before showing */
  showDistanceThreshold?: number;
  /** Delay before hiding after scroll stops */
  hideDelay?: number;
  /** Delay before showing after scroll stops */
  showDelay?: number;
  /** Whether to enable haptic feedback on state changes */
  enableHaptics?: boolean;
}

interface SmartNavState {
  isVisible: boolean;
  isFullyHidden: boolean;
  progress: number; // 0 = fully hidden, 1 = fully visible
}

type ScrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

/**
 * 2026 Smart Navigation Visibility Engine
 * 
 * Uses velocity-based hysteresis with predictive intent detection.
 * Instead of reacting to every scroll pixel, it builds a "confidence score"
 * for hide/show decisions based on scroll patterns.
 */
export const useSmartNavVisibility = (config: SmartNavConfig = {}) => {
  const {
    hideVelocityThreshold = 0.8,
    showVelocityThreshold = 0.5,
    hideDistanceThreshold = 80,
    showDistanceThreshold = 40,
    hideDelay = 150,
    showDelay = 80,
    enableHaptics = true,
  } = config;

  // State machine: 'idle' | 'hiding' | 'showing' | 'hidden' | 'visible'
  const stateRef = useRef<'idle' | 'hiding' | 'showing' | 'hidden' | 'visible'>('visible');
  const metricsRef = useRef({
    lastY: 0,
    lastTime: Date.now(),
    accumulatedDown: 0,
    accumulatedUp: 0,
    direction: 'none' as 'up' | 'down' | 'none',
    confidence: 0, // -100 to 100, negative = hide confidence, positive = show confidence
    timer: null as ReturnType<typeof setTimeout> | null,
    isAtTop: false,
    isAtBottom: false,
  });

  const stateCallbackRef = useRef<((state: SmartNavState) => void) | null>(null);

  const setNavState = useCallback((newState: 'hidden' | 'visible', immediate = false) => {
    const m = metricsRef.current;
    
    if (stateRef.current === newState) return;

    // Clear any pending timer
    if (m.timer) {
      clearTimeout(m.timer);
      m.timer = null;
    }

    if (immediate) {
      stateRef.current = newState;
      if (enableHaptics && newState === 'visible') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      stateCallbackRef.current?.({
        isVisible: newState === 'visible',
        isFullyHidden: newState === 'hidden',
        progress: newState === 'visible' ? 1 : 0,
      });
      return;
    }

    const delay = newState === 'hidden' ? hideDelay : showDelay;
    
    m.timer = setTimeout(() => {
      stateRef.current = newState;
      m.timer = null;
      
      if (enableHaptics) {
        const hapticStyle = newState === 'visible' 
          ? Haptics.ImpactFeedbackStyle.Light 
          : Haptics.ImpactFeedbackStyle.Soft;
        Haptics.impactAsync(hapticStyle);
      }

      stateCallbackRef.current?.({
        isVisible: newState === 'visible',
        isFullyHidden: newState === 'hidden',
        progress: newState === 'visible' ? 1 : 0,
      });
    }, delay);
  }, [hideDelay, showDelay, enableHaptics]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentY = contentOffset.y;
    const m = metricsRef.current;

    const deltaY = currentY - m.lastY;
    const deltaTime = now - m.lastTime;
    const velocity = deltaTime > 0 ? deltaY / deltaTime : 0; // px/ms

    m.isAtTop = currentY <= 5;
    m.isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 5;

    // Always show at top or bottom
    if (m.isAtTop || m.isAtBottom) {
      m.accumulatedDown = 0;
      m.accumulatedUp = 0;
      m.confidence = 50; // Bias toward showing
      if (stateRef.current === 'hidden' || stateRef.current === 'hiding') {
        setNavState('visible', m.isAtTop); // Immediate at top, delayed at bottom
      }
      m.lastY = currentY;
      m.lastTime = now;
      return;
    }

    // Determine direction with deadzone to prevent jitter
    const deadzone = 0.3; // px/ms
    if (velocity > deadzone) {
      m.direction = 'down';
    } else if (velocity < -deadzone) {
      m.direction = 'up';
    }

    // Accumulate distance in current direction, decay opposite
    if (m.direction === 'down') {
      m.accumulatedDown += Math.abs(deltaY);
      m.accumulatedUp *= 0.7; // Decay
    } else if (m.direction === 'up') {
      m.accumulatedUp += Math.abs(deltaY);
      m.accumulatedDown *= 0.7;
    }

    // Build confidence score
    if (m.direction === 'down') {
      const velocityFactor = Math.min(Math.abs(velocity) / hideVelocityThreshold, 2);
      const distanceFactor = Math.min(m.accumulatedDown / hideDistanceThreshold, 1.5);
      m.confidence -= (velocityFactor * 15 + distanceFactor * 10);
    } else if (m.direction === 'up') {
      const velocityFactor = Math.min(Math.abs(velocity) / showVelocityThreshold, 2);
      const distanceFactor = Math.min(m.accumulatedUp / showDistanceThreshold, 1.5);
      m.confidence += (velocityFactor * 20 + distanceFactor * 15);
    }

    // Clamp confidence
    m.confidence = Math.max(-100, Math.min(100, m.confidence));

    // State transitions based on confidence thresholds
    const HIDE_THRESHOLD = -60;
    const SHOW_THRESHOLD = 40;

    if (m.confidence <= HIDE_THRESHOLD && stateRef.current !== 'hidden' && stateRef.current !== 'hiding') {
      setNavState('hidden');
      stateRef.current = 'hiding';
    } else if (m.confidence >= SHOW_THRESHOLD && stateRef.current !== 'visible' && stateRef.current !== 'showing') {
      setNavState('visible');
      stateRef.current = 'showing';
    }

    m.lastY = currentY;
    m.lastTime = now;
  }, [setNavState, hideVelocityThreshold, showVelocityThreshold, hideDistanceThreshold, showDistanceThreshold]);

  const reset = useCallback(() => {
    const m = metricsRef.current;
    m.lastY = 0;
    m.accumulatedDown = 0;
    m.accumulatedUp = 0;
    m.confidence = 0;
    m.direction = 'none';
    if (m.timer) {
      clearTimeout(m.timer);
      m.timer = null;
    }
    stateRef.current = 'visible';
  }, []);

  const forceHide = useCallback(() => {
    reset();
    setNavState('hidden', true);
  }, [reset, setNavState]);

  const forceShow = useCallback(() => {
    reset();
    setNavState('visible', true);
  }, [reset, setNavState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (metricsRef.current.timer) {
        clearTimeout(metricsRef.current.timer);
      }
    };
  }, []);

  return {
    onScroll,
    reset,
    forceHide,
    forceShow,
    subscribe: (callback: (state: SmartNavState) => void) => {
      stateCallbackRef.current = callback;
      return () => { stateCallbackRef.current = null; };
    },
    getCurrentState: () => ({
      isVisible: stateRef.current === 'visible' || stateRef.current === 'showing',
      isFullyHidden: stateRef.current === 'hidden',
      progress: stateRef.current === 'visible' ? 1 : stateRef.current === 'hidden' ? 0 : 0.5,
    }),
  };
};

export type { SmartNavState, SmartNavConfig };
export default useSmartNavVisibility;