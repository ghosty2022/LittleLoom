// src/services/ai/CohortOfflineQueue.ts
// ─────────────────────────────────────────────────────────────────────
// Persistent queue for cohort publish operations that failed due to
// network errors. Flushes on next bootstrap / app foreground.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

const QUEUE_KEY = '@littleloom_cohort_queue_v1';
const MAX_QUEUE_SIZE = 50;

export interface CohortQueueItem {
  id: string;
  table: 'ai_cohort_priors' | 'ai_predictor_cohorts';
  operation: 'upsert';
  payload: Record<string, unknown>;
  enqueuedAt: number;
  attempts: number;
  lastError?: string;
}

async function loadQueue(): Promise<CohortQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as CohortQueueItem[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: CohortQueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {}
}

export async function enqueueCohortOp(
  table: CohortQueueItem['table'],
  payload: Record<string, unknown>
): Promise<void> {
  const queue = await loadQueue();

  // Deduplicate by natural key
  const naturalKey =
    table === 'ai_cohort_priors'
      ? `${payload.metric ?? ''}:${payload.age_cohort ?? ''}`
      : `${payload.kind ?? payload.metric ?? ''}:${payload.age_cohort ?? ''}`;

  const existingIndex = queue.findIndex(item => {
    const key =
      item.table === 'ai_cohort_priors'
        ? `${item.payload.metric ?? ''}:${item.payload.age_cohort ?? ''}`
        : `${item.payload.kind ?? item.payload.metric ?? ''}:${item.payload.age_cohort ?? ''}`;
    return item.table === table && key === naturalKey;
  });

  const item: CohortQueueItem = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    table,
    operation: 'upsert',
    payload,
    enqueuedAt: Date.now(),
    attempts: 0,
  };

  if (existingIndex >= 0) {
    // Replace older version with newer payload
    queue[existingIndex] = item;
  } else {
    queue.push(item);
  }

  // Cap queue size (drop oldest)
  while (queue.length > MAX_QUEUE_SIZE) {
    queue.shift();
  }

  await saveQueue(queue);
}

export async function flushCohortQueue(): Promise<{
  flushed: number;
  failed: number;
  dropped: number;
}> {
  const queue = await loadQueue();
  if (queue.length === 0) return { flushed: 0, failed: 0, dropped: 0 };

  let flushed = 0;
  let failed = 0;
  const retained: CohortQueueItem[] = [];

  for (const item of queue) {
    // Drop items older than 7 days (stale)
    if (Date.now() - item.enqueuedAt > 7 * 24 * 60 * 60 * 1000) {
      continue;
    }
    // Drop items with too many attempts
    if (item.attempts >= 5) {
      continue;
    }

    try {
      if (item.table === 'ai_cohort_priors') {
        const p = item.payload;
        const { error } = await supabase
          .from('ai_cohort_priors')
          .upsert(p, { onConflict: 'metric,age_cohort' });
        if (error) throw new Error(error.message);
      } else if (item.table === 'ai_predictor_cohorts') {
        const p = item.payload;
        const { error } = await supabase
          .from('ai_predictor_cohorts')
          .upsert(p, { onConflict: 'kind,age_cohort' });
        if (error) throw new Error(error.message);
      }
      flushed++;
    } catch (err) {
      item.attempts += 1;
      item.lastError = String(err);
      retained.push(item);
      failed++;
    }
  }

  const dropped = queue.length - flushed - retained.length;
  await saveQueue(retained);

  if (__DEV__ && (flushed > 0 || failed > 0 || dropped > 0)) {
    console.log(
      `[CohortQueue] Flush: ${flushed} flushed, ${failed} failed, ${dropped} dropped`
    );
  }

  return { flushed, failed, dropped };
}

export async function getCohortQueueSize(): Promise<number> {
  return (await loadQueue()).length;
}

export async function clearCohortQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}