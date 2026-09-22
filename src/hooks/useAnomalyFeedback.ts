// src/hooks/useAnomalyFeedback.ts
// Captures user feedback on AI anomaly warnings so the model can
// suppress false positives and reinforce true positives.
// ─────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { observeValue, MetricKey } from '@/services/ai/BayesianEngine';

export type AnomalyAction =
  | 'confirmed_anomaly'
  | 'dismissed_normal'
  | 'dismissed_other';

export function useAnomalyFeedback() {
  const recordFeedback = useCallback(
    async (
      babyId: string,
      metric: MetricKey,
      value: number,
      flaggedZ: number,
      action: AnomalyAction
    ): Promise<void> => {
      if (!babyId) return;

      // 1. Persist the feedback row
      try {
        await supabase.from('ai_anomaly_feedback').insert({
          baby_id: babyId,
          metric,
          value,
          flagged_z: flaggedZ,
          user_action: action,
        });
      } catch (e) {
        if (__DEV__) console.warn('[AnomalyFeedback] Insert failed:', e);
      }

      // 2. If user says "this is normal for us", feed it back into
      //    the Bayesian model so the posterior shifts toward this value.
      if (action === 'dismissed_normal') {
        try {
          // Observe the value 3x to give it extra weight — we want the
          // model to learn this IS normal, not just "maybe normal".
          for (let i = 0; i < 3; i++) {
            await observeValue(babyId, metric, value, {
              rejectOutliers: false, // explicitly bypass the sanity gate
            });
          }
        } catch (e) {
          if (__DEV__) console.warn('[AnomalyFeedback] observeValue failed:', e);
        }
      }

      // 3. If user confirmed it's an anomaly, no action needed —
      //    the existing posterior was correct.
    },
    []
  );

  return { recordFeedback };
}

export default useAnomalyFeedback;