// src/services/photoService.ts
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO SERVICE — The single bridge between tracker entries, local photos,
// and the gallery UI. Wraps AsyncStorage metadata so all screens share
// exactly one source of truth.
// ═══════════════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackerEntry } from '../types/trackers';
import {
  UnifiedPhoto,
  photosFromTrackerEntry,
  dedupePhotos,
  sortPhotosDesc,
} from '../types/photos';

const KEYS = {
  FAVORITES: '@littleloom_gallery_favorites_v2',
  PRIVATE: '@littleloom_gallery_private_v2',
  CAPTIONS: '@littleloom_gallery_captions_v2',
  TAGS: '@littleloom_gallery_tags_v2',
  LOCAL_PHOTOS: '@littleloom_gallery_local_v2',
} as const;

export interface PhotoMetadata {
  favorites: Set<string>;
  privates: Set<string>;
  captions: Record<string, string>;
  tags: Record<string, string[]>;
  localPhotos: UnifiedPhoto[];
}

// ─── LOAD ──────────────────────────────────────────────────────────────────

export const loadPhotoMetadata = async (): Promise<PhotoMetadata> => {
  try {
    const [favStr, privStr, capStr, tagStr, localStr] = await Promise.all([
      AsyncStorage.getItem(KEYS.FAVORITES),
      AsyncStorage.getItem(KEYS.PRIVATE),
      AsyncStorage.getItem(KEYS.CAPTIONS),
      AsyncStorage.getItem(KEYS.TAGS),
      AsyncStorage.getItem(KEYS.LOCAL_PHOTOS),
    ]);

    return {
      favorites: new Set(favStr ? JSON.parse(favStr) : []),
      privates: new Set(privStr ? JSON.parse(privStr) : []),
      captions: capStr ? JSON.parse(capStr) : {},
      tags: tagStr ? JSON.parse(tagStr) : {},
      localPhotos: localStr ? JSON.parse(localStr) : [],
    };
  } catch (e) {
    if (__DEV__) console.warn('[photoService] loadPhotoMetadata failed:', e);
    return {
      favorites: new Set(),
      privates: new Set(),
      captions: {},
      tags: {},
      localPhotos: [],
    };
  }
};

// ─── SAVE ──────────────────────────────────────────────────────────────────

export const saveFavorites = async (favorites: Set<string>): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify([...favorites]));
  } catch {}
};

export const savePrivates = async (privates: Set<string>): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.PRIVATE, JSON.stringify([...privates]));
  } catch {}
};

export const saveCaptions = async (
  captions: Record<string, string>
): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.CAPTIONS, JSON.stringify(captions));
  } catch {}
};

export const saveTags = async (
  tags: Record<string, string[]>
): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.TAGS, JSON.stringify(tags));
  } catch {}
};

export const saveLocalPhotos = async (
  photos: UnifiedPhoto[]
): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.LOCAL_PHOTOS, JSON.stringify(photos));
  } catch {}
};

// ─── BUILD UNIFIED GALLERY ─────────────────────────────────────────────────

/**
 * Builds the complete unified photo list from tracker entries + local captures.
 * Every photo is enriched with user metadata (favorites/privates/captions/tags).
 * Deduplicated by uri. Sorted newest-first.
 */
export const buildUnifiedGallery = (
  entries: TrackerEntry[],
  meta: PhotoMetadata,
  babyNameMap: Map<string, string>
): UnifiedPhoto[] => {
  const fromTrackers: UnifiedPhoto[] = [];

  for (const entry of entries) {
    const babyName = entry.babyId
      ? babyNameMap.get(entry.babyId)
      : undefined;

    const photos = photosFromTrackerEntry(entry, {
      babyName,
      isFavorite: false, // placeholder; merged below
      isPrivate: false,
    });

    for (const p of photos) {
      fromTrackers.push({
        ...p,
        isFavorite: meta.favorites.has(p.id),
        isPrivate: meta.privates.has(p.id),
        caption: meta.captions[p.id] ?? p.caption,
        tags: meta.tags[p.id] ?? p.tags,
      });
    }
  }

  const fromLocal: UnifiedPhoto[] = meta.localPhotos.map((p) => ({
    ...p,
    isFavorite: meta.favorites.has(p.id),
    isPrivate: meta.privates.has(p.id),
    caption: meta.captions[p.id] ?? p.caption,
    tags: meta.tags[p.id] ?? p.tags ?? [],
  }));

  return sortPhotosDesc(dedupePhotos([...fromTrackers, ...fromLocal]));
};

// ─── GETTERS (safe, no throw) ──────────────────────────────────────────────

export const isFavorite = (meta: PhotoMetadata, id: string): boolean =>
  meta.favorites.has(id);

export const isPrivate = (meta: PhotoMetadata, id: string): boolean =>
  meta.privates.has(id);

export const getCaption = (
  meta: PhotoMetadata,
  id: string,
  fallback?: string
): string | undefined => meta.captions[id] ?? fallback;

export const getTags = (
  meta: PhotoMetadata,
  id: string,
  fallback: string[] = []
): string[] => meta.tags[id] ?? fallback;

// ─── TOGGLE HELPERS (immutable) ────────────────────────────────────────────

export const toggleInSet = <T,>(set: Set<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

// ─── MUTATION HELPERS ──────────────────────────────────────────────────────

export const buildLocalCapturePhoto = (
  uri: string,
  babyId: string | undefined,
  source: 'camera' | 'gallery' = 'camera'
): UnifiedPhoto => ({
  id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  uri,
  timestamp: Date.now(),
  type: 'daily',
  source,
  babyId,
  isFavorite: false,
  isPrivate: false,
  tags: [],
  backupStatus: 'local',
});

export default {
  loadPhotoMetadata,
  saveFavorites,
  savePrivates,
  saveCaptions,
  saveTags,
  saveLocalPhotos,
  buildUnifiedGallery,
  isFavorite,
  isPrivate,
  getCaption,
  getTags,
  toggleInSet,
  buildLocalCapturePhoto,
};