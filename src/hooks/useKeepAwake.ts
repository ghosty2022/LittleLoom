// src/hooks/useKeepAwake.ts

import { useEffect, useRef } from 'react';
import * as KeepAwake from 'expo-keep-awake';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export function useKeepAwake(shouldKeepAwake: boolean = true, reason: string = 'Critical') {
  const ref = useRef<{ release: () => Promise<void> } | null>(null);

  const activate = useCallback(async () => {
    if (ref.current) return;
    try {
      ref.current = await KeepAwake.activateKeepAwakeAsync(`LittleLoom_${reason}`);
    } catch (error) {
      console.warn('[useKeepAwake] Activate error:', error);
    }
  }, [reason]);

  const release = useCallback(async () => {
    if (!ref.current) return;
    try {
      await ref.current.release();
      ref.current = null;
    } catch (error) {
      console.warn('[useKeepAwake] Release error:', error);
    }
  }, []);

  // Activate/deactivate based on prop
  useEffect(() => {
    if (shouldKeepAwake) {
      activate();
    } else {
      release();
    }

    return () => {
      release();
    };
  }, [shouldKeepAwake, activate, release]);

  // Activate when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (shouldKeepAwake) {
        activate();
      }
      return () => {
        if (shouldKeepAwake) {
          release();
        }
      };
    }, [shouldKeepAwake, activate, release])
  );

  return { activate, release, isActive: !!ref.current };
}