/**
 * Shared entry-formatting helpers.
 * Source of truth for how a tracker entry's `data` map is rendered as
 * human-readable rows across AddEntry, UniversalTrackerHub, EntryDetail,
 * TrackerEntryCard, PDF exports, etc.
 *
 * Do not fork this. If a screen needs a different rendering, it should add
 * a local wrapper, not a local copy of the primitives.
 */

export const SKIP_ENTRY_KEYS: ReadonlySet<string> = new Set([
  'id',
  'timestamp',
  'babyId',
  'type',
  'title',
  'icon',
  'photoUris',
  'photos',
  'photo',
  'notes',
  'tags',
  'location',
  'syncedAt',
  'loggedBy',
  'loggedByName',
  'loggedByRole',
  'editedAt',
  'editedBy',
  'editedByName',
]);

export const prettifyFieldKey = (k: string): string =>
  k
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

export const formatFieldValue = (key: string, value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const strings = value.map(String).filter(Boolean);
    return strings.length > 0 ? strings.join(', ') : null;
  }
  if (typeof value === 'object') {
    const o = value as any;
    if (typeof o?.name === 'string') return o.name;
    if (typeof o?.label === 'string') return o.label;
    return null;
  }
  return String(value);
};

export const formatDuration = (seconds: unknown): string => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0 || s > 86400) return '';
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const cleanImageUris = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const flat = (raw as unknown[]).flat(Infinity);
  const strings = flat
    .map((u) => {
      if (typeof u === 'string') return u;
      if (u && typeof u === 'object' && typeof (u as any).uri === 'string') {
        return (u as any).uri as string;
      }
      return '';
    })
    .filter((u): u is string => u.length > 0);
  return [...new Set(strings)];
};

export const getEntryFields = (
  entry: { data?: Record<string, unknown> },
): Array<[string, unknown]> => {
  return Object.entries(entry.data || {}).filter(([k, v]) => {
    if (SKIP_ENTRY_KEYS.has(k)) return false;
    return formatFieldValue(k, v) !== null;
  });
};