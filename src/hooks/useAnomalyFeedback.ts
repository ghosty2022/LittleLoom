




import { useCallback } from 'react';
import { supabase } from '@/utils/supabase';

// Type-only import — erased at build time, so it can't crash the module
// if the BayesianEngine has a transitive runtime failure.
import type { MetricKey } from '@/services/ai/BayesianEngine';

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

      
      
          if (action === 'dismissed_normal') {
        try {
          const { observeValue } = await import('@/services/ai/BayesianEngine');
          await observeValue(babyId, metric, value, {
            rejectOutliers: false,
          });
        } catch (e) {
          if (__DEV__) console.warn('[AnomalyFeedback] observeValue failed:', e);
        }
      }

      
      
    },
    []
  );

  return { recordFeedback };
}

export default useAnomalyFeedback;