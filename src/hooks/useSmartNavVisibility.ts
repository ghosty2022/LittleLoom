// src/hooks/useSmartNavVisibility.ts
import { useCallback, useRef, useEffect } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

interface SmartNavConfig {
  hideVelocityThreshold?: number;
  showVelocityThreshold?: number;
  hideDistanceThreshold?: number;
  showDistanceThreshold?: number;
  hideDelay?: number;
  showDelay?: number;
  enableHaptics?: boolean;
}

export interface SmartNavState {
  isVisible: boolean;
  isFullyHidden: boolean;
  progress: number;
}

// ─── SINGLETON STATE (shared across all hook instances) ──────────────
let _state: SmartNavState = { isVisible: true, isFullyHidden: false, progress: 1 };
let _stateMachine: 'idle' | 'hiding' | 'showing' | 'hidden' | 'visible' = 'visible';
let _listeners = new Set<(state: SmartNavState) => void>();
let _metrics = {
  lastY: 0,
  lastTime: Date.now(),
  accumulatedDown: 0,
  accumulatedUp: 0,
  direction: 'none' as 'up' | 'down' | 'none',
  confidence: 0,
  timer: null as ReturnType<typeof setTimeout> | null,
  isAtTop: false,
  isAtBottom: false,
  forced: false,
};

const _emit = (state: SmartNavState) => {
  _state = state;
  _listeners.forEach(cb => cb(state));
};

const _setNavState = (newState: 'hidden' | 'visible', immediate = false, enableHaptics = true) => {
  if (_stateMachine === newState && !_metrics.forced) return;

  if (_metrics.timer) {
    clearTimeout(_metrics.timer);
    _metrics.timer = null;
  }

  if (immediate) {
    _stateMachine = newState;
    _metrics.forced = false;
    if (enableHaptics && newState === 'visible') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    _emit({
      isVisible: newState === 'visible',
      isFullyHidden: newState === 'hidden',
      progress: newState === 'visible' ? 1 : 0,
    });
    return;
  }

  const delay = newState === 'hidden' ? 150 : 80;

  _metrics.timer = setTimeout(() => {
    _metrics.timer = null;
    _stateMachine = newState;
    _metrics.forced = false;

    if (enableHaptics) {
      const hapticStyle = newState === 'visible'
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Soft;
      Haptics.impactAsync(hapticStyle);
    }

    _emit({
      isVisible: newState === 'visible',
      isFullyHidden: newState === 'hidden',
      progress: newState === 'visible' ? 1 : 0,
    });
  }, delay);
};

// ─── HOOK ────────────────────────────────────────────────────────────
export const useSmartNavVisibility = (config: SmartNavConfig = {}) => {
  const {
    hideVelocityThreshold = 0.8,
    showVelocityThreshold = 0.5,
    hideDistanceThreshold = 80,
    showDistanceThreshold = 40,
    enableHaptics = true,
  } = config;

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (_metrics.forced) return;

    const now = Date.now();
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentY = contentOffset.y;
    const m = _metrics;

    const deltaY = currentY - m.lastY;
    const deltaTime = now - m.lastTime;
    const velocity = deltaTime > 0 ? deltaY / deltaTime : 0;

    m.isAtTop = currentY <= 5;
    m.isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 5;

    if (m.isAtTop || m.isAtBottom) {
      m.accumulatedDown = 0;
      m.accumulatedUp = 0;
      m.confidence = 50;
      if (_stateMachine === 'hidden' || _stateMachine === 'hiding') {
        _setNavState('visible', m.isAtTop, enableHaptics);
      }
      m.lastY = currentY;
      m.lastTime = now;
      return;
    }

    const deadzone = 0.3;
    if (velocity > deadzone) m.direction = 'down';
    else if (velocity < -deadzone) m.direction = 'up';

    if (m.direction === 'down') {
      m.accumulatedDown += Math.abs(deltaY);
      m.accumulatedUp *= 0.7;
    } else if (m.direction === 'up') {
      m.accumulatedUp += Math.abs(deltaY);
      m.accumulatedDown *= 0.7;
    }

    if (m.direction === 'down') {
      const velocityFactor = Math.min(Math.abs(velocity) / hideVelocityThreshold, 2);
      const distanceFactor = Math.min(m.accumulatedDown / hideDistanceThreshold, 1.5);
      m.confidence -= (velocityFactor * 15 + distanceFactor * 10);
    } else if (m.direction === 'up') {
      const velocityFactor = Math.min(Math.abs(velocity) / showVelocityThreshold, 2);
      const distanceFactor = Math.min(m.accumulatedUp / showDistanceThreshold, 1.5);
      m.confidence += (velocityFactor * 20 + distanceFactor * 15);
    }

    m.confidence = Math.max(-100, Math.min(100, m.confidence));

    const HIDE_THRESHOLD = -60;
    const SHOW_THRESHOLD = 40;

    if (m.confidence <= HIDE_THRESHOLD && _stateMachine !== 'hidden' && _stateMachine !== 'hiding') {
      _setNavState('hidden', false, enableHaptics);
      _stateMachine = 'hiding';
    } else if (m.confidence >= SHOW_THRESHOLD && _stateMachine !== 'visible' && _stateMachine !== 'showing') {
      _setNavState('visible', false, enableHaptics);
      _stateMachine = 'showing';
    }

    m.lastY = currentY;
    m.lastTime = now;
  }, [hideVelocityThreshold, showVelocityThreshold, hideDistanceThreshold, showDistanceThreshold, enableHaptics]);

  const reset = useCallback(() => {
    _metrics.lastY = 0;
    _metrics.accumulatedDown = 0;
    _metrics.accumulatedUp = 0;
    _metrics.confidence = 0;
    _metrics.direction = 'none';
    _metrics.forced = false;
    if (_metrics.timer) {
      clearTimeout(_metrics.timer);
      _metrics.timer = null;
    }
    _stateMachine = 'visible';
  }, []);

  const forceHide = useCallback(() => {
    reset();
    _metrics.forced = true;
    _setNavState('hidden', true, enableHaptics);
  }, [reset, enableHaptics]);

  const forceShow = useCallback(() => {
    reset();
    _metrics.forced = true;
    _setNavState('visible', true, enableHaptics);
  }, [reset, enableHaptics]);

  const subscribe = useCallback((callback: (state: SmartNavState) => void) => {
    _listeners.add(callback);
    callback(_state);
    return () => { _listeners.delete(callback); };
  }, []);

  const getCurrentState = useCallback(() => _state, []);

  useEffect(() => {
    return () => {
      if (_metrics.timer) {
        clearTimeout(_metrics.timer);
        _metrics.timer = null;
      }
    };
  }, []);

  return {
    onScroll,
    reset,
    forceHide,
    forceShow,
    subscribe,
    getCurrentState,
  };
};

export type { SmartNavConfig };
export default useSmartNavVisibility;