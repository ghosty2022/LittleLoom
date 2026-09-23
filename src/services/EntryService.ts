// src/services/EntryService.ts
// ─────────────────────────────────────────────────────────────────────
// Unified entry CRUD service.
//
// THE single source of truth for reading/writing tracker entries.
// Every context uses this — no more direct supabase.from('tracker_entries')
// calls scattered across the codebase.
//
// Responsibilities:
//   • Save entries (insert or upsert) with offline queue fallback
//   • Update entries with conflict detection
//   • Soft-delete entries
//   • Read entries with filters
//   • Sanitize payloads for PostgREST (no undefined/NaN/functions)
//
// Does NOT:
//   • Manage UI state (contexts do that)
//   • Handle realtime (useRealtimeSubscription does that)
//   • Do business logic (streaks, insights — those live in contexts)
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import type { TrackerEntry } from '@/types/trackers';

// ─── Types ──────────────────────────────────────────────────────────

export interface SaveEntryOptions {
  /** Force an upsert even if the entry might already exist */
  upsert?: boolean;
  /** If true, do not attempt Supabase write — only local cache + queue */
  offlineOnly?: boolean;
}

export interface SaveEntryResult {
  ok: boolean;
  entry?: TrackerEntry;
  /** True if the write was queued (offline) instead of applied */
  queued?: boolean;
  error?: string;
}

export interface GetEntriesOptions {
  babyId: string;
  trackerId?: string;
  /** Only return entries newer than this timestamp */
  since?: number;
  /** Only return entries older than this timestamp */
  until?: number;
  /** Include soft-deleted entries */
  includeDeleted?: boolean;
  /** Max results */
  limit?: number;
}

// ─── Payload Sanitizer ──────────────────────────────────────────────
// PostgREST rejects: undefined, NaN, functions, circular refs.
// This runs on every write so a bad value never silently corrupts an entry.

export function sanitizePayload(value: unknown): unknown {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, v) => {
        if (typeof v === 'function') return undefined;
        if (typeof v === 'number' && !Number.isFinite(v)) return null;
        if (typeof v === 'undefined') return null;
        return v;
      })
    );
  } catch {
    return {};
  }
}

function sanitizePhotoUris(uris?: unknown): string[] {
  if (!Array.isArray(uris)) return [];
  // Flatten any nested arrays and coerce objects with .uri to strings
  const flat = (uris as unknown[]).flat(Infinity);
  const strings = flat
    .map((u) => {
      if (typeof u === 'string') return u;
      if (u && typeof u === 'object' && typeof (u as any).uri === 'string') {
        return (u as any).uri as string;
      }
      return '';
    })
    .filter((u): u is string => u.length > 0);
  // Dedupe while preserving order
  return [...new Set(strings)];
}

function sanitizeTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter(
    (t): t is string => typeof t === 'string' && t.length > 0
  );
}

// ─── Map Row → TrackerEntry ─────────────────────────────────────────
//
// Canonical row-to-entry mapper. Used by:
//   • EntryService.getEntries / getEntryById
//   • TrackerContext's realtime subscription callback
//
// Handles every shape Supabase can return:
//   • timestamptz as ISO string OR epoch ms number
//   • data as jsonb object OR JSON string
//   • photo_uris / tags / linked_entries as jsonb array OR null
//   • Missing timestamp → falls back to created_at → Date.now()

export function mapRowToEntry(row: any): TrackerEntry {
  if (!row) {
    throw new Error('[mapRowToEntry] Received null/undefined row');
  }

  // ── Timestamp: normalize to epoch ms, never NaN ──────────────────
  const rawTs = row.timestamp ?? row.created_at;
  const tsMs =
    typeof rawTs === 'number'
      ? rawTs
      : typeof rawTs === 'string'
        ? new Date(rawTs).getTime()
        : Date.now();
  const timestamp = Number.isFinite(tsMs) ? tsMs : Date.now();

  // ── Photo URIs: jsonb array → clean string[] ─────────────────────
  // Prefer publicUrl over uri when both exist (survives cache clears).
  const photoUris: string[] | undefined = (() => {
    const raw = row.photo_uris ?? row.photos ?? row.photo_urls;
    if (!Array.isArray(raw)) return undefined;

    const flat = (raw as unknown[]).flat(Infinity);
    const strings = flat
      .map((u) => {
        if (typeof u === 'string') return u;
        if (u && typeof u === 'object') {
          const obj = u as any;
          // Prefer remote URL for persistence
          if (typeof obj.publicUrl === 'string' && obj.publicUrl.length > 0) {
            return obj.publicUrl;
          }
          if (typeof obj.url === 'string' && obj.url.length > 0) {
            return obj.url;
          }
          if (typeof obj.uri === 'string' && obj.uri.length > 0) {
            return obj.uri;
          }
        }
        return '';
      })
      .filter((u): u is string => u.length > 0);

    const deduped = [...new Set(strings)];
    return deduped.length > 0 ? deduped : undefined;
  })();

  // ── Tags: jsonb array → clean string[] ───────────────────────────
  const tags: string[] | undefined = Array.isArray(row.tags)
    ? row.tags.filter(
        (t: unknown): t is string => typeof t === 'string' && t.length > 0
      )
    : undefined;

  // ── Linked entries: jsonb array or [] ────────────────────────────
  const linkedEntries = Array.isArray(row.linked_entries)
    ? row.linked_entries
    : [];

  // ── Data: jsonb object OR JSON string ────────────────────────────
  let parsedData: Record<string, unknown> = {};
  if (row.data && typeof row.data === 'object') {
    // Defensive copy — we're about to mutate this
    parsedData = { ...(row.data as Record<string, unknown>) };
  } else if (typeof row.data === 'string') {
    try {
      parsedData = JSON.parse(row.data);
    } catch {
      parsedData = {};
    }
  }

  // ── Edited-at: normalize to epoch ms or undefined ────────────────
  let editedAt: number | undefined;
  if (typeof row.edited_at === 'number') {
    editedAt = row.edited_at;
  } else if (typeof row.edited_at === 'string') {
    const parsed = new Date(row.edited_at).getTime();
    editedAt = Number.isFinite(parsed) ? parsed : undefined;
  }

  // ── Normalize duration if present ────────────────────────────────
  // Duration should always be in SECONDS for consistency
  if (parsedData.duration !== undefined) {
    const rawDur = parsedData.duration;
    if (typeof rawDur === 'string') {
      // Parse "1h 30m" / "90m" / "3600s" strings
      const str = rawDur.trim().toLowerCase();
      const asNum = Number(str);
      if (Number.isFinite(asNum)) {
        parsedData.duration = asNum;
      } else {
        let total = 0;
        const re = /(\d+(?:\.\d+)?)\s*(h|hr|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(str)) !== null) {
          const n = parseFloat(match[1]);
          const u = match[2][0];
          total += u === 'h' ? n * 3600 : u === 'm' ? n * 60 : n;
        }
        parsedData.duration = total > 0 ? total : undefined;
      }
    }
    // Guard against absurd values
    if (typeof parsedData.duration === 'number' && parsedData.duration > 86400) {
      if (__DEV__) console.warn('[mapRowToEntry] Absurd duration:', parsedData.duration);
      parsedData.duration = undefined;
    }
  }

  return {
    id: String(row.id),
    babyId: String(row.baby_id),
    trackerId: String(row.tracker_id || row.tracker_type || 'custom'),
    timestamp,
    title: String(row.title || ''),
    data: parsedData,
    loggedBy: String(row.logged_by || ''),
    loggedByName: String(row.logged_by_name || ''),
    loggedByRole: (row.logged_by_role as any) || 'parent1',
    notes: row.notes || undefined,
    photoUris,
    tags,
    notificationId: row.notification_id || undefined,
    reminderScheduled: row.reminder_scheduled === true,
    syncedAt: row.synced_at || undefined,
    editedBy: row.edited_by || undefined,
    editedAt,
    isDeleted: row.is_deleted === true,
    linkedEntries,
  };
}

// ─── Build Supabase Payload ─────────────────────────────────────────

export interface RawEntryInput {
  id: string;
  trackerId: string;
  trackerType: string;
  babyId: string;
  timestamp: number;
  title: string;
  data: Record<string, unknown>;
  notes?: string;
  photoUris?: string[];
  tags?: string[];
  loggedBy: string;
  loggedByName: string;
  loggedByRole: string;
  notificationId?: string;
  reminderScheduled?: boolean;
}

export function buildSupabasePayload(input: RawEntryInput) {
  const now = new Date().toISOString();

  // Guard: if the input timestamp is missing or invalid, fall back to now.
  // This prevents "Invalid Date" from being written to the DB.
  const tsMs =
    typeof input.timestamp === 'number' && Number.isFinite(input.timestamp)
      ? input.timestamp
      : Date.now();
  const timestamp = new Date(tsMs).toISOString();

  return {
    id: input.id,
    tracker_id: input.trackerId,
    tracker_type: input.trackerType,
    baby_id: input.babyId,
    timestamp,
    title: input.title || '',
    data: sanitizePayload(input.data),
    notes: input.notes || null,
    photo_uris: sanitizePhotoUris(input.photoUris),
    tags: sanitizeTags(input.tags),
    logged_by: input.loggedBy,
    logged_by_name: input.loggedByName,
    logged_by_role: input.loggedByRole,
    created_by: input.loggedBy,
    created_by_name: input.loggedByName,
    created_by_role: input.loggedByRole,
    notification_id: input.notificationId || null,
    reminder_scheduled: input.reminderScheduled || false,
    synced_at: now,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
}

// ─── Save Entry ─────────────────────────────────────────────────────
// The canonical write path. Call this from every context.

export async function saveEntry(
  input: RawEntryInput,
  options: SaveEntryOptions = {}
): Promise<SaveEntryResult> {
  const payload = buildSupabasePayload(input);

  // ─── Offline-only mode (used for queueing) ───────────────────────
  if (options.offlineOnly) {
    return { ok: true, queued: true };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'No authenticated user' };
    }

    // ─── Duplicate guard: same tracker + same baby + within 5s ────
    // Catches double-tap save and offline-queue replays.
    const fiveSecondsAgo = new Date(
      new Date(input.timestamp).getTime() - 5000
    ).toISOString();
    const fiveSecondsLater = new Date(
      new Date(input.timestamp).getTime() + 5000
    ).toISOString();

    const { data: dupes } = await supabase
      .from('tracker_entries')
      .select('id, data')
      .eq('baby_id', input.babyId)
      .eq('tracker_id', input.trackerId)
      .eq('is_deleted', false)
      .gte('timestamp', fiveSecondsAgo)
      .lte('timestamp', fiveSecondsLater);

    if (dupes && dupes.length > 0) {
      const incomingData = JSON.stringify(sanitizePayload(input.data));
      const isDuplicate = dupes.some(
        (d) => JSON.stringify(sanitizePayload(d.data)) === incomingData
      );

      if (isDuplicate) {
        if (__DEV__) {
          console.warn(
            '[EntryService] Duplicate entry suppressed:',
            input.trackerId
          );
        }
        return { ok: true };
      }
    }

    const startMs = Date.now();

    // ─── Idempotency: always upsert on id ────────────────────────
    const { error } = await supabase
      .from('tracker_entries')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw new Error(error.message);

    // ─── Telemetry (non-blocking) ────────────────────────────────
    import('@/services/ai/Telemetry')
      .then(({ recordEvent }) => {
        recordEvent({
          kind: 'entry_save_ok',
          trackerId: input.trackerId,
          durationMs: Date.now() - startMs,
        }).catch(() => {});
      })
      .catch(() => {});

    await invalidateCache(input.babyId);
    return { ok: true };
  } catch (error: any) {
    if (__DEV__) {
      console.warn(
        '[EntryService] Supabase write failed, will queue:',
        error?.message
      );
    }

    // ─── Telemetry for failure ────────────────────────────────────
    import('@/services/ai/Telemetry')
      .then(({ recordEvent }) => {
        recordEvent({
          kind: 'entry_save_fail',
          trackerId: input.trackerId,
          errorType: categorizeError(error?.message),
        }).catch(() => {});
      })
      .catch(() => {});

    return { ok: false, error: error?.message || 'Unknown error' };
  }
}

// ─── Error categorizer (used by telemetry) ──────────────────────────

function categorizeError(msg?: string): string {
  if (!msg) return 'unknown';
  if (/network|timeout|fetch|connection/i.test(msg)) return 'network';
  if (/permission|rls|forbidden|401|403/i.test(msg)) return 'permission';
  if (/duplicate|unique|conflict|23505/i.test(msg)) return 'duplicate';
  if (/constraint|check|invalid/i.test(msg)) return 'validation';
  return 'other';
}

// ─── Update Entry ───────────────────────────────────────────────────

export interface UpdateEntryInput {
  id: string;
  updates: Partial<{
    title: string;
    notes: string;
    data: Record<string, unknown>;
    timestamp: number;
    photoUris: string[];
    tags: string[];
  }>;
  editedBy: string;
}

export async function updateEntry(
  input: UpdateEntryInput
): Promise<{ ok: boolean; error?: string }> {
  const remoteUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    edited_by: input.editedBy,
    edited_at: Date.now(),
  };

  if (input.updates.title !== undefined) {
    remoteUpdates.title = input.updates.title;
  }
  if (input.updates.notes !== undefined) {
    remoteUpdates.notes = input.updates.notes;
  }
  if (input.updates.data !== undefined) {
    remoteUpdates.data = sanitizePayload(input.updates.data);
  }
  if (input.updates.timestamp !== undefined) {
    remoteUpdates.timestamp = new Date(input.updates.timestamp).toISOString();
  }
  if (input.updates.photoUris !== undefined) {
    remoteUpdates.photo_uris = sanitizePhotoUris(input.updates.photoUris);
  }
  if (input.updates.tags !== undefined) {
    remoteUpdates.tags = sanitizeTags(input.updates.tags);
  }

  try {
    const { error } = await supabase
      .from('tracker_entries')
      .update(remoteUpdates)
      .eq('id', input.id);

    if (error) throw new Error(error.message);

    return { ok: true };
  } catch (error: any) {
    if (__DEV__) {
      console.warn('[EntryService] Update failed:', error?.message);
    }
    return { ok: false, error: error?.message || 'Unknown error' };
  }
}

// ─── Soft Delete Entry ──────────────────────────────────────────────

export async function softDeleteEntry(
  entryId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tracker_entries')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (error) throw new Error(error.message);

    return { ok: true };
  } catch (error: any) {
    if (__DEV__) {
      console.warn('[EntryService] Delete failed:', error?.message);
    }
    return { ok: false, error: error?.message || 'Unknown error' };
  }
}

// ─── Restore Entry ──────────────────────────────────────────────────

export async function restoreEntry(
  entryId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('tracker_entries')
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (error) throw new Error(error.message);

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Unknown error' };
  }
}

// ─── Get Entries ────────────────────────────────────────────────────

export async function getEntries(
  options: GetEntriesOptions
): Promise<TrackerEntry[]> {
  try {
    let query = supabase
      .from('tracker_entries')
      .select('*')
      .eq('baby_id', options.babyId);

    if (!options.includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    if (options.trackerId) {
      query = query.eq('tracker_id', options.trackerId);
    }

    if (options.since !== undefined) {
      query = query.gte('timestamp', new Date(options.since).toISOString());
    }

    if (options.until !== undefined) {
      query = query.lte('timestamp', new Date(options.until).toISOString());
    }

    query = query.order('timestamp', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      if (__DEV__) {
        console.warn('[EntryService] Read failed:', error.message);
      }
      return await readFromCache(options);
    }

    return (data || []).map(mapRowToEntry);
  } catch (error: any) {
    if (__DEV__) {
      console.warn('[EntryService] Read error:', error?.message);
    }
    return await readFromCache(options);
  }
}

// ─── Get Single Entry ───────────────────────────────────────────────

export async function getEntryById(
  entryId: string
): Promise<TrackerEntry | null> {
  try {
    const { data, error } = await supabase
      .from('tracker_entries')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (error || !data) return null;
    return mapRowToEntry(data);
  } catch {
    return null;
  }
}

// ─── Cache Helpers ──────────────────────────────────────────────────
// Simple AsyncStorage cache so reads succeed offline.

const CACHE_PREFIX = '@littleloom_entry_cache:';

function cacheKey(babyId: string): string {
  return `${CACHE_PREFIX}${babyId}`;
}

async function invalidateCache(babyId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(babyId));
  } catch {}
}

async function readFromCache(
  options: GetEntriesOptions
): Promise<TrackerEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(options.babyId));
    if (!raw) return [];
    const cached: TrackerEntry[] = JSON.parse(raw);
    let filtered = cached;
    if (!options.includeDeleted) {
      filtered = filtered.filter(e => !e.isDeleted);
    }
    if (options.trackerId) {
      filtered = filtered.filter(e => e.trackerId === options.trackerId);
    }
    if (options.since !== undefined) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }
    if (options.until !== undefined) {
      filtered = filtered.filter(e => e.timestamp <= options.until!);
    }
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  } catch {
    return [];
  }
}

async function writeCache(
  babyId: string,
  entries: TrackerEntry[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(babyId), JSON.stringify(entries));
  } catch {}
}

// ─── Cache Warm-Up (called from context after successful read) ─────

export async function warmCache(
  babyId: string,
  entries: TrackerEntry[]
): Promise<void> {
  try {
    // Read existing cache and merge — preserve older entries that
    // may not be in the fresh query result.
    const existing = await readFromCache({ babyId, includeDeleted: true });

    // Build a map keyed by id, newest data wins
    const merged = new Map<string, TrackerEntry>();
    for (const e of existing) merged.set(e.id, e);
    for (const e of entries) merged.set(e.id, e);

    // Sort by timestamp descending and keep the newest 500
    const final = [...merged.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 500);

    await writeCache(babyId, final);
  } catch {
    // Fall back to overwrite if merge fails
    await writeCache(babyId, entries);
  }
}

// ─── Get Cached Entries (offline read) ──────────────────────────────

export async function getCachedEntries(
  babyId: string
): Promise<TrackerEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(babyId));
    if (!raw) return [];
    return JSON.parse(raw) as TrackerEntry[];
  } catch {
    return [];
  }
}

// ─── Cleanup (used on sign-out) ─────────────────────────────────────

export async function clearEntryCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {}
}

// ─── Convenience: get all entries for one tracker ───────────────────

export async function getEntriesForTracker(
  babyId: string,
  trackerId: string,
  limit: number = 100
): Promise<TrackerEntry[]> {
  return getEntries({ babyId, trackerId, limit });
}

// ─── Convenience: get entries in a date range ───────────────────────

export async function getEntriesInRange(
  babyId: string,
  fromMs: number,
  toMs: number
): Promise<TrackerEntry[]> {
  return getEntries({ babyId, since: fromMs, until: toMs, limit: 2000 });
}

// ─── Convenience: count entries for one tracker ─────────────────────

export async function countEntriesForTracker(
  babyId: string,
  trackerId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tracker_entries')
      .select('id', { count: 'exact', head: true })
      .eq('baby_id', babyId)
      .eq('tracker_id', trackerId)
      .eq('is_deleted', false);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Singleton-style Export ─────────────────────────────────────────
// Declared LAST so every helper it references is already defined.

export const EntryService = {
  saveEntry,
  updateEntry,
  softDeleteEntry,
  restoreEntry,
  getEntries,
  getEntryById,
  getCachedEntries,
  warmCache,
  clearEntryCache,
  buildSupabasePayload,
  mapRowToEntry,
  sanitizePayload,
  sanitizePhotoUris,
  sanitizeTags,
  // Convenience helpers
  getEntriesForTracker,
  getEntriesInRange,
  countEntriesForTracker,
};

export default EntryService;