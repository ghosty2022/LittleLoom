// src/types/photos.ts
// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL PHOTO TYPES — the single source of truth for photo data
// across GalleryScreen, PhotoSyncContext, PhotoScanner, and tracker entries.
//
// Prior to this file, three incompatible types existed:
//   - `GalleryPhoto`     (GalleryScreen)     → tracker-linked display
//   - `ImportQueueItem`  (PhotoSyncContext)  → upload queue
//   - `ScannedPhoto`     (PhotoScanner)      → raw device gallery
//
// All three now derive from or convert to `UnifiedPhoto`.
// ═══════════════════════════════════════════════════════════════════════════

import type { TrackerEntry } from './trackers';

// ─── PHOTO CATEGORIES ──────────────────────────────────────────────────────

export type PhotoType =
  | 'milestone'
  | 'daily'
  | 'sleep'
  | 'feed'
  | 'feeding'       // legacy alias for 'feed'
  | 'potty'
  | 'diaper'
  | 'growth'
  | 'medication'
  | 'symptom'
  | 'temperature'
  | 'vaccine'
  | 'tracker'
  | 'auto_import'
  | 'photo'         // the standalone `photo` tracker
  | 'all';

/** Normalize legacy/variant type strings to a canonical PhotoType. */
export const normalizePhotoType = (raw: string | undefined): PhotoType => {
  if (!raw) return 'tracker';
  const lower = raw.toLowerCase();
  if (lower === 'feeding') return 'feed';
  const known: PhotoType[] = [
    'milestone', 'daily', 'sleep', 'feed', 'potty', 'diaper',
    'growth', 'medication', 'symptom', 'temperature', 'vaccine',
    'tracker', 'auto_import', 'photo', 'all',
  ];
  return (known.includes(lower as PhotoType) ? lower : 'tracker') as PhotoType;
};

// ─── PHOTO SOURCES ─────────────────────────────────────────────────────────

export type PhotoSource =
  | 'camera'
  | 'gallery'
  | 'auto_import'
  | 'google_photos'
  | 'icloud'
  | 'tracker';

export type BackupStatus = 'synced' | 'pending' | 'failed' | 'local';
export type SyncStatus = 'synced' | 'pending' | 'conflict';

// ─── PHOTO METADATA ────────────────────────────────────────────────────────

export interface PhotoFace {
  babyId: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PhotoExif {
  width?: number;
  height?: number;
  size?: number;
  device?: string;
  iso?: number;
  aperture?: string;
  focalLength?: string;
  exposure?: string;
  orientation?: number;
}

export interface LinkedTrackerEntry {
  entryId: string;
  trackerId: string;
  title: string;
  notes?: string;
  timestamp: number;
}

export type BabyMood =
  | 'happy'
  | 'neutral'
  | 'sad'
  | 'excited'
  | 'tired'
  | 'sleepy';

// ─── UNIFIED PHOTO ─────────────────────────────────────────────────────────
// This is THE photo shape used everywhere. All conversion helpers below
// produce this shape from any input format.

export interface UnifiedPhoto {
  /** Stable unique id — deterministic across surfaces. */
  id: string;
  /** Local `file://` uri OR remote `https://` URL. Never null. */
  uri: string;
  /** Optional remote URL if uploaded to Supabase Storage. */
  publicUrl?: string;
  /** Supabase storage path (used for deletion). */
  storagePath?: string;
  /** Unix ms epoch. */
  timestamp: number;

  /** Which tracker produced this photo, or `tracker` if orphaned. */
  type: PhotoType;
  /** Where it came from. */
  source: PhotoSource;

  /** Baby ownership. */
  babyId?: string;
  babyName?: string;

  // ── User metadata (persisted locally) ──
  isFavorite: boolean;
  isPrivate: boolean;
  tags: string[];
  caption?: string;
  mood?: BabyMood;

  // ── Auto-detected metadata ──
  exif?: PhotoExif;
  faces?: PhotoFace[];
  blurHash?: string;

  // ── Cloud sync ──
  backupStatus?: BackupStatus;
  syncStatus?: SyncStatus;

  // ── Linkage to tracker entry (the source of truth) ──
  linkedEntry?: LinkedTrackerEntry;

  // ── Diagnostics ──
  /** Filename as it existed on device (for debugging). */
  fileName?: string;
  /** File size in bytes (for upload progress). */
  fileSize?: number;
}

// ─── CONVERSION HELPERS ────────────────────────────────────────────────────

/**
 * Extracts every photo uri from a TrackerEntry, producing a UnifiedPhoto
 * for each. This is the canonical bridge from tracker → gallery.
 */
export const photosFromTrackerEntry = (
  entry: TrackerEntry,
  overrides?: Partial<Pick<UnifiedPhoto, 'isFavorite' | 'isPrivate' | 'caption' | 'tags' | 'babyName'>>
): UnifiedPhoto[] => {
  if (!entry || entry.isDeleted) return [];

  const raw = entry.photoUris;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Flatten in case photoUris contains nested arrays (SmartPhotoField quirk)
  const flat = (raw as unknown[]).flat(Infinity) as unknown[];

  const uris: string[] = [];
  for (const u of flat) {
    if (typeof u === 'string' && u.length > 0) {
      uris.push(u);
    } else if (u && typeof u === 'object' && typeof (u as any).uri === 'string') {
      const obj = u as { uri: string; publicUrl?: string };
      uris.push(obj.publicUrl || obj.uri);
    }
  }

  const uniqueUris = [...new Set(uris)];

  return uniqueUris.map((uri, idx) => ({
    id: `${entry.id}_${idx}`,
    uri,
    timestamp: entry.timestamp,
    type: normalizePhotoType(entry.trackerId),
    source: 'tracker',
    babyId: entry.babyId,
    babyName: overrides?.babyName,
    isFavorite: overrides?.isFavorite ?? false,
    isPrivate: overrides?.isPrivate ?? false,
    tags: overrides?.tags ?? entry.tags ?? [],
    caption: overrides?.caption ?? entry.notes,
    linkedEntry: {
      entryId: entry.id,
      trackerId: entry.trackerId,
      title: entry.title,
      notes: entry.notes,
      timestamp: entry.timestamp,
    },
    backupStatus: uri.startsWith('https://') ? 'synced' : 'local',
  }));
};

/**
 * Convert a PhotoScanner `ScannedPhoto` into a UnifiedPhoto (local-only).
 */
export const photoFromScanned = (scanned: {
  uri: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  creationDate?: Date;
  mediaType?: 'photo' | 'video';
}): UnifiedPhoto => ({
  id: `scan_${scanned.fileName ?? Date.now()}`,
  uri: scanned.uri,
  timestamp: scanned.creationDate?.getTime() ?? Date.now(),
  type: 'auto_import',
  source: 'gallery',
  isFavorite: false,
  isPrivate: false,
  tags: [],
  fileName: scanned.fileName,
  fileSize: scanned.fileSize,
  exif: {
    width: scanned.width,
    height: scanned.height,
    size: scanned.fileSize,
  },
  backupStatus: 'local',
});

/**
 * Deduplicate a list of photos by uri. First occurrence wins.
 */
export const dedupePhotos = (photos: UnifiedPhoto[]): UnifiedPhoto[] => {
  const seen = new Set<string>();
  const out: UnifiedPhoto[] = [];
  for (const p of photos) {
    if (!p.uri || seen.has(p.uri)) continue;
    seen.add(p.uri);
    out.push(p);
  }
  return out;
};

/**
 * Sort photos newest-first.
 */
export const sortPhotosDesc = (photos: UnifiedPhoto[]): UnifiedPhoto[] =>
  [...photos].sort((a, b) => b.timestamp - a.timestamp);