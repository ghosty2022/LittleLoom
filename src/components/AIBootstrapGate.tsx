import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useBaby } from '../context/BabyContext';
import { bootstrapAI } from '../services/ai/bootstrap';

/**
 * Mounts under <BabyProvider>. Watches `currentBaby` and
 * kicks off AI warm-up whenever the active baby changes OR
 * the app returns to foreground after a long background.
 *
 * Force-runs when the baby is brand new (no prior bootstrap flag).
 */
export const AIBootstrapGate: React.FC = () => {
  const { currentBaby } = useBaby();
  const lastBabyIdRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const bootstrappedIdsRef = useRef<Set<string>>(new Set());
  // Baby change → bootstrap (non-forced; bootstrapAI is idempotent)
  useEffect(() => {
    const id = currentBaby?.id ?? null;
    if (!id) return;
    if (lastBabyIdRef.current === id) return;

    lastBabyIdRef.current = id;

    // Always force a warm-up on first mount for a baby so backfill runs
    // immediately. bootstrapAI is internally throttled so this is safe.
    bootstrapAI(id, true)
      .then(() => {
        bootstrappedIdsRef.current.add(id);
        if (__DEV__) {
          console.log(`[AIBootstrapGate] Bootstrap complete for baby ${id}`);
        }
      })
      .catch((err) => {
        // Log always (not just DEV) — silent failures hide real bugs
        console.warn('[AIBootstrapGate] bootstrapAI failed:', err);
        // Schedule a retry in 30s so we don't hammer the network on permanent failures
        setTimeout(() => {
          if (lastBabyIdRef.current === id) {
            bootstrapAI(id).catch(() => {});
          }
        }, 30000);
      });
  }, [currentBaby?.id]);

  // App foreground → opportunistically re-run bootstrap (throttled internally)
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

  return null;
};