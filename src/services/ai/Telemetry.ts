// src/services/ai/Telemetry.ts
// ─────────────────────────────────────────────────────────────────────
// Lightweight, privacy-respecting telemetry for entry operations.
// NO PII. NO baby data. Just counts + error categories.
// Stores locally and flushes to Supabase on next successful save.
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

const QUEUE_KEY = '@littleloom_telemetry_v1';
const MAX_QUEUE = 100;

export type TelemetryEvent =
  | { kind: 'entry_save_ok'; trackerId: string; durationMs: number }
  | { kind: 'entry_save_fail'; trackerId: string; errorType: string }
  | { kind: 'entry_duplicate_suppressed'; trackerId: string }
  | { kind: 'photo_upload_fail'; trackerId: string; errorType: string }
  | { kind: 'ai_learning_fail'; trackerId: string; engine: string };

interface QueuedEvent extends TelemetryEvent {
  ts: number;
  sessionId: string;
}

let sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export async function recordEvent(event: TelemetryEvent): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];

    queue.push({ ...event, ts: Date.now(), sessionId });

    // Cap queue
    while (queue.length > MAX_QUEUE) queue.shift();

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Telemetry must never break the app
  }
}

export async function flushTelemetry(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue: QueuedEvent[] = JSON.parse(raw);
    if (queue.length === 0) return;

    // Don't flush if offline
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Batch insert
    const rows = queue.map((e) => ({
      user_id: user.id,
      session_id: e.sessionId,
      kind: e.kind,
      tracker_id: (e as any).trackerId ?? null,
      error_type: (e as any).errorType ?? null,
      duration_ms: (e as any).durationMs ?? null,
      recorded_at: new Date(e.ts).toISOString(),
    }));

    const { error } = await supabase.from('app_telemetry').insert(rows);
    if (error) {
      // Don't clear queue — retry next time
      if (__DEV__) console.warn('[Telemetry] Flush failed:', error.message);
      return;
    }

    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (e) {
    if (__DEV__) console.warn('[Telemetry] Flush error:', e);
  }
}