
import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useBaby } from '../context/BabyContext';
import {
  bootstrapAI,
  subscribeBootstrap,
  type BootstrapPhase,
} from '../services/ai/bootstrap';
import { useTheme } from '@/context/AppContext';

type UIPhase = 'idle' | 'warming' | 'ready' | 'failed';

/**
 * Mounts under <BabyProvider>. Watches `currentBaby` and kicks off
 * AI warm-up whenever the active baby changes OR the app returns to
 * foreground after a long background.
 *
 * Renders a subtle, non-blocking pill in the top-right while AI is
 * warming up and for ~2.5s after it becomes ready.
 */
export const AIBootstrapGate: React.FC = () => {
  const { currentBaby } = useBaby();

  
  
  const theme = (() => {
    try {
      return useTheme();
    } catch {
      return { isDark: false, colors: {} as any };
    }
  })();
  const isDark = theme?.isDark ?? false;
  const accent = theme?.colors?.primary ?? '#667eea';

  const lastBabyIdRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const bootstrappedIdsRef = useRef<Set<string>>(new Set());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<UIPhase>('idle');

  
  const opacity = useRef(new Animated.Value(0)).current;

  const fadeIn = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const fadeOut = (thenIdle = true) => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && thenIdle) setPhase('idle');
    });
  };

  const scheduleHide = (ms = 2500) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => fadeOut(true), ms);
  };

  
  useEffect(() => {
    const unsub = subscribeBootstrap((snap) => {
      if (__DEV__) {
        console.log(
          `[AIBootstrapGate] phase=${snap.phase} baby=${snap.babyId ?? '—'}`
        );
      }

      if (snap.phase === 'running') {
        setPhase('warming');
        fadeIn();
      } else if (snap.phase === 'done') {
        setPhase('ready');
        fadeIn();
        scheduleHide(2500);
      } else if (snap.phase === 'failed') {
        setPhase('failed');
        fadeIn();
        scheduleHide(3000);
      } else {
        
        fadeOut(true);
      }
    });

    return () => {
      unsub();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    
  }, []);

  
  useEffect(() => {
    const id = currentBaby?.id ?? null;
    if (!id) return;
    if (lastBabyIdRef.current === id) return;

    lastBabyIdRef.current = id;

    
    setPhase('warming');
    fadeIn();

    bootstrapAI(id, true)
      .then(() => {
        bootstrappedIdsRef.current.add(id);
        if (__DEV__) {
          console.log(`[AIBootstrapGate] Bootstrap complete for baby ${id}`);
        }
      })
      .catch((err) => {
        console.warn('[AIBootstrapGate] bootstrapAI failed:', err);

        
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (lastBabyIdRef.current === id) {
            bootstrapAI(id).catch(() => {});
          }
        }, 30000);
      });
  }, [currentBaby?.id]);

  
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (prev.match(/inactive|background/) && next === 'active') {
        const id = lastBabyIdRef.current;
        if (id) {
          bootstrapAI(id).catch(() => {});
        }
      }
    });

    return () => sub.remove();
  }, []);

  
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  
  if (phase === 'idle') return null;

  const pillBg = isDark ? 'rgba(30, 30, 46, 0.92)' : 'rgba(255, 255, 255, 0.96)';
  const pillBorder = isDark
    ? 'rgba(255, 255, 255, 0.10)'
    : 'rgba(0, 0, 0, 0.06)';
  const pillText = isDark ? '#e2e8f0' : '#1e293b';

  const label =
    phase === 'ready'
      ? 'AI ready'
      : phase === 'failed'
      ? 'AI offline'
      : 'AI learning…';

  const dotColor =
    phase === 'ready' ? '#22c55e' : phase === 'failed' ? '#ef4444' : accent;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: pillBg, borderColor: pillBorder },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.label, { color: pillText }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 9999,
    elevation: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default AIBootstrapGate;