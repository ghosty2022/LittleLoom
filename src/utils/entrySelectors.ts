import { isSameDay, startOfDay } from 'date-fns';

/** Baby-scoped, non-deleted, timestamp-valid entries only. */
export function scopedEntries(entries: any[] | undefined, babyId: string | undefined | null): any[] {
  if (!Array.isArray(entries) || !babyId) return [];
  return entries.filter(
    (e) => e && typeof e.timestamp === 'number' && !Number.isNaN(e.timestamp) && e.babyId === babyId && !e.isDeleted,
  );
}

/** Resolve a tracker/type key from an entry. */
export function entryTrackerId(e: any): string {
  return String(e?.trackerId || e?.type || '');
}

/** Count today's entries for a specific tracker, or all trackers if omitted. */
export function countToday(entries: any[], trackerId?: string): number {
  const start = startOfDay(new Date()).getTime();
  return entries.filter((e) => e?.timestamp >= start && (!trackerId || entryTrackerId(e) === trackerId)).length;
}

/**
 * Resolve the CURRENT display name + relationship for the entry's logger.
 * Falls back to the historical snapshot if the member row is gone.
 */
export function resolveLogger(entry: any, members: any[]): { name: string; label: string; avatar: string; member: any } {
  const by = entry?.loggedBy;
  const byName = String(entry?.loggedByName || '').trim();
  const member =
    (by && (members.find((m) => m.userId === by) || members.find((m) => m.id === by))) ||
    (byName && members.find((m) => (m.fullName || '').trim().toLowerCase() === byName.toLowerCase())) ||
    null;
  const name = member?.fullName || byName || 'Someone';
  const label = member?.relationship || entry?.loggedByRole || '';
  return { name, label, avatar: member?.avatar || '', member };
}