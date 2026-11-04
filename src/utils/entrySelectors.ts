import { isSameDay, startOfDay } from 'date-fns';

/** Baby-scoped, non-deleted, timestamp-valid entries only. */
export function scopedEntries(
  entries: any[] | undefined,
  babyId: string | undefined | null,
): any[] {
  if (!Array.isArray(entries) || !babyId) return [];
  return entries.filter(
    (e) =>
      e &&
      typeof e.timestamp === 'number' &&
      !Number.isNaN(e.timestamp) &&
      e.babyId === babyId &&
      !e.isDeleted,
  );
}

/** Resolve a tracker/type key from an entry. */
export function entryTrackerId(e: any): string {
  return String(e?.trackerId || e?.type || '');
}

/** Count today's entries for a specific tracker, or all trackers if omitted. */
export function countToday(entries: any[], trackerId?: string): number {
  const start = startOfDay(new Date()).getTime();
  return entries.filter(
    (e) => e?.timestamp >= start && (!trackerId || entryTrackerId(e) === trackerId),
  ).length;
}

export interface ResolvedLogger {
  name: string;
  label: string;
  avatar: string;
  member: any | null;
  role: string;
}

/**
 * Resolve the CURRENT display name + relationship for the entry's logger.
 * Falls back to the historical snapshot if the member row is gone.
 *
 * Order of resolution:
 *   1. member.userId === entry.loggedBy     (canonical)
 *   2. member.id    === entry.loggedBy      (legacy)
 *   3. member.fullName === entry.loggedByName (last resort)
 *
 * Then label = member.relationship || member.role || entry.loggedByRole
 */
export function resolveLogger(entry: any, members: any[]): ResolvedLogger {
  if (!entry) {
    return { name: 'You', label: 'Primary Parent', avatar: '', member: null, role: 'parent1' };
  }

  const safeMembers = Array.isArray(members) ? members : [];
  const by = entry.loggedBy;
  const byName = String(entry.loggedByName || '').trim();

  const member =
    (by &&
      (safeMembers.find((m) => m.userId === by) ||
        safeMembers.find((m) => m.id === by))) ||
    (byName &&
      safeMembers.find(
        (m) => (m.fullName || '').trim().toLowerCase() === byName.toLowerCase(),
      )) ||
    null;

  const name = String(member?.fullName || '').trim() || byName || 'Someone';
  const label = String(
    member?.relationship || member?.role || entry.loggedByRole || '',
  ).trim();
  const role = String(member?.role || entry.loggedByRole || '').toLowerCase();
  const avatar = String(member?.avatar || '').trim();

  return { name, label, avatar, member, role };
}