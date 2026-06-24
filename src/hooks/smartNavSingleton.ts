// src/hooks/smartNavSingleton.ts
import * as Haptics from 'expo-haptics';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export interface SmartNavState {
  isVisible: boolean;
  isFullyHidden: boolean;
  progress: number;
}

export let _state: SmartNavState = { isVisible: true, isFullyHidden: false, progress: 1 };
export let _stateMachine: 'idle' | 'hiding' | 'showing' | 'hidden' | 'visible' = 'visible';
export const _listeners = new Set<(state: SmartNavState) => void>();
export const _metrics = {
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

export const _emit = (state: SmartNavState) => {
  _state = state;
  _listeners.forEach(cb => cb(state));
};

export const _setNavState = (newState: 'hidden' | 'visible', immediate = false, enableHaptics = true) => {
  if (_stateMachine === newState && !_metrics.forced) return;
  if (_metrics.timer) { clearTimeout(_metrics.timer); _metrics.timer = null; }

  if (immediate) {
    _stateMachine = newState;
    _metrics.forced = false;
    if (enableHaptics && newState === 'visible') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    _emit({ isVisible: newState === 'visible', isFullyHidden: newState === 'hidden', progress: newState === 'visible' ? 1 : 0 });
    return;
  }

  _metrics.timer = setTimeout(() => {
    _metrics.timer = null;
    _stateMachine = newState;
    _metrics.forced = false;
    if (enableHaptics) {
      Haptics.impactAsync(newState === 'visible' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft);
    }
    _emit({ isVisible: newState === 'visible', isFullyHidden: newState === 'hidden', progress: newState === 'visible' ? 1 : 0 });
  }, newState === 'hidden' ? 150 : 80);
};