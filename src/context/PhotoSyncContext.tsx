// src/context/PhotoSyncContext.tsx
// Manages photo import and sync with Supabase Storage
// FIXED: legacy FS, ref-based queue reads, no stale closures, no infinite loops

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/utils/supabase';
import { useBaby } from './BabyContext';
import { useAuth } from './AuthContext';
import { useSweetAlert } from '../components/SweetAlert';
import { decode } from 'base64-arraybuffer';

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

export interface ScanProgress {
  phase:
    | 'requesting_permission'
    | 'scanning'
    | 'processing'
    | 'uploading'
    | 'importing'
    | 'completed'
    | 'error'
    | 'cancelled';
  current: number;
  total: number;
  message: string;
  photosFound: number;
  photosImported: number;
}

export interface ScannedPhoto {
  uri: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  creationDate: Date;
  modificationDate: Date;
  mediaType: 'photo' | 'video';
}

export interface ImportQueueItem {
  id: string;
  photo: ScannedPhoto;
  babyId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  uploadedUrl?: string;
}

export interface ScanHistoryEntry {
  id: string;
  timestamp: string;
  photosFound: number;
  photosImported: number;
  duration: number;
  status: 'completed' | 'failed' | 'cancelled';
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface PhotoSyncState {
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScanTime: Date | null;
  queue: ImportQueueItem[];
  queueStats: QueueStats;
}

interface PhotoSyncContextType extends PhotoSyncState {
  startScan: (options?: { quick?: boolean; days?: number }) => Promise<void>;
  cancelScan: () => void;
  importQueuedPhotos: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearCompleted: () => Promise<void>;
  getScanHistory: () => Promise<ScanHistoryEntry[]>;
  clearScanHistory: () => Promise<void>;
}

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const PhotoSyncContext = createContext<PhotoSyncContextType | null>(null);

const PHOTO_SYNC_QUEUE_KEY = '@littleloom_photo_sync_queue';
const SCAN_HISTORY_KEY = '@littleloom_scan_history';
const LAST_SCAN_KEY = '@littleloom_last_scan_time';
const PHOTOS_BUCKET = 'baby_photos';
const MAX_HISTORY = 50;
const BATCH_SIZE = 100;
const AUTO_IMPORT_THRESHOLD = 20;

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

const uuid = (): string => Crypto.randomUUID();

const buildQueueId = (): string => `photo_${Date.now()}_${uuid().slice(0, 8)}`;

const buildEntryId = (): string => `photo_${Date.now()}_${uuid().slice(0, 8)}`;

const computeStats = (queue: ImportQueueItem[]): QueueStats => ({
  pending: queue.filter(i => i.status === 'pending').length,
  processing: queue.filter(i => i.status === 'processing').length,
  completed: queue.filter(i => i.status === 'completed').length,
  failed: queue.filter(i => i.status === 'failed').length,
});

const safeParseJSON = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/* ═══════════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════════ */

export const PhotoSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PhotoSyncState>({
    isScanning: false,
    scanProgress: null,
    lastScanTime: null,
    queue: [],
    queueStats: { pending: 0, processing: 0, completed: 0, failed: 0 },
  });

  const { currentBaby } = useBaby();
  const { userProfile } = useAuth();
  const sweetAlert = useSweetAlert();

  // ─── Refs ─────────────────────────────────────────────────────────
  const queueRef = useRef<ImportQueueItem[]>([]);          // ⭐ always fresh
  const scannerRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const isMounted = useRef(true);
  const processingRef = useRef(false);

  // ─── Keep queueRef in sync with state.queue ───────────────────────
  useEffect(() => {
    queueRef.current = state.queue;
  }, [state.queue]);

  // ─── Mount lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    loadQueue();
    loadLastScanTime();
    return () => {
      isMounted.current = false;
      scannerRef.current.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Persistence ────────────────────────────────────────────── */

  const loadQueue = useCallback(async () => {
    try {
      const path = FileSystem.documentDirectory + PHOTO_SYNC_QUEUE_KEY;
      const data = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const queue = safeParseJSON<ImportQueueItem[]>(data, []);
      if (!isMounted.current) return;
      queueRef.current = queue;
      setState(prev => ({
        ...prev,
        queue,
        queueStats: computeStats(queue),
      }));
    } catch {
      // First run — no queue file
    }
  }, []);

  const saveQueue = useCallback(async (queue: ImportQueueItem[]) => {
    try {
      const path = FileSystem.documentDirectory + PHOTO_SYNC_QUEUE_KEY;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(queue), {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (error) {
      console.warn('[PhotoSync] Failed to save queue:', error);
    }
  }, []);

  /**
   * Centralised queue mutator. Always updates ref + state + persistence.
   */
  const commitQueue = useCallback(
    async (next: ImportQueueItem[]) => {
      queueRef.current = next;
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          queue: next,
          queueStats: computeStats(next),
        }));
      }
      await saveQueue(next);
    },
    [saveQueue],
  );

  const loadLastScanTime = useCallback(async () => {
    try {
      const path = FileSystem.documentDirectory + LAST_SCAN_KEY;
      const data = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const iso = safeParseJSON<string>(data, '');
      if (iso && isMounted.current) {
        setState(prev => ({ ...prev, lastScanTime: new Date(iso) }));
      }
    } catch {
      // no-op
    }
  }, []);

  const saveLastScanTime = useCallback(async (time: Date) => {
    try {
      const path = FileSystem.documentDirectory + LAST_SCAN_KEY;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(time.toISOString()), {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (error) {
      console.warn('[PhotoSync] Failed to save last scan time:', error);
    }
  }, []);

  /* ─── Scan History ───────────────────────────────────────────── */

  const getScanHistory = useCallback(async (): Promise<ScanHistoryEntry[]> => {
    try {
      const path = FileSystem.documentDirectory + SCAN_HISTORY_KEY;
      const data = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return safeParseJSON<ScanHistoryEntry[]>(data, []);
    } catch {
      return [];
    }
  }, []);

  const saveScanHistory = useCallback(
    async (entry: ScanHistoryEntry) => {
      try {
        const history = await getScanHistory();
        history.unshift(entry);
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
        const path = FileSystem.documentDirectory + SCAN_HISTORY_KEY;
        await FileSystem.writeAsStringAsync(path, JSON.stringify(history), {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (error) {
        console.warn('[PhotoSync] Failed to save scan history:', error);
      }
    },
    [getScanHistory],
  );

  const clearScanHistory = useCallback(async () => {
    try {
      const path = FileSystem.documentDirectory + SCAN_HISTORY_KEY;
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch (error) {
      console.warn('[PhotoSync] Failed to clear scan history:', error);
    }
  }, []);

  /* ─── Scan Photos ────────────────────────────────────────────── */

  const scanPhotos = useCallback(async (days: number = 7): Promise<ScannedPhoto[]> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission is required');
    }

    const photos: ScannedPhoto[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let hasNextPage = true;
    let endCursor: string | undefined;

    while (hasNextPage && !scannerRef.current.cancelled) {
      const {
        assets,
        endCursor: nextCursor,
        hasNextPage: hasNext,
      } = await MediaLibrary.getAssetsAsync({
        first: BATCH_SIZE,
        after: endCursor,
        mediaType: ['photo'],
        createdAfter: startDate,
        sortBy: ['creationTime'],
      });

      for (const asset of assets) {
        if (scannerRef.current.cancelled) break;

        let localUri = asset.uri;
        try {
          const info = await MediaLibrary.getAssetInfoAsync(asset);
          localUri = info.localUri || info.uri || asset.uri;
        } catch {
          // fall back to asset.uri
        }

        photos.push({
          uri: localUri,
          fileName: asset.filename || `photo_${asset.id}.jpg`,
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          creationDate: new Date(asset.creationTime),
          modificationDate: new Date(asset.modificationTime),
          mediaType: 'photo',
        });
      }

      endCursor = nextCursor;
      hasNextPage = hasNext || false;

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          scanProgress: prev.scanProgress
            ? {
                ...prev.scanProgress,
                current: photos.length,
                photosFound: photos.length,
                message: `Found ${photos.length} photos...`,
              }
            : null,
        }));
      }
    }

    return photos;
  }, []);

  /* ─── Upload to Supabase Storage ─────────────────────────────── */

  const uploadToStorage = useCallback(
    async (photo: ScannedPhoto, babyId: string): Promise<string> => {
      const ext = photo.fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${babyId}/${Date.now()}_${uuid().slice(0, 8)}.${ext}`;

      const fileData = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const contentType =
        ext === 'png' ? 'image/png' :
        ext === 'webp' ? 'image/webp' :
        ext === 'heic' || ext === 'heif' ? 'image/heic' :
        'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(storagePath, decode(fileData), {
          contentType,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from(PHOTOS_BUCKET)
        .getPublicUrl(storagePath);

      return urlData.publicUrl;
    },
    [],
  );

  /* ─── Process One Item ──────────────────────────────────────── */

  /**
   * Processes a single queue item. Reads & writes the queue through
   * the ref, so concurrent iterations never step on each other.
   */
  const processQueueItem = useCallback(
    async (item: ImportQueueItem): Promise<{ success: boolean; url?: string; error?: unknown }> => {
      if (!item.babyId) {
        const err = new Error('No baby ID specified');
        return { success: false, error: err };
      }

      // Mark as processing
      const marked = queueRef.current.map(q =>
        q.id === item.id ? { ...q, status: 'processing' as const, error: undefined } : q,
      );
      await commitQueue(marked);

      try {
        const url = await uploadToStorage(item.photo, item.babyId);

        const entryId = buildEntryId();
        const { error: entryError } = await supabase.from('tracker_entries').insert({
          id: entryId,
          tracker_id: 'photo',
          baby_id: item.babyId,
          timestamp: item.photo.creationDate.getTime(),
          title: '📸 Photo',
          data: {
            photoUrl: url,
            fileName: item.photo.fileName,
            fileSize: item.photo.fileSize,
            width: item.photo.width,
            height: item.photo.height,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        });

        if (entryError) throw new Error(entryError.message);

        const done = queueRef.current.map(q =>
          q.id === item.id
            ? { ...q, status: 'completed' as const, uploadedUrl: url, error: undefined }
            : q,
        );
        await commitQueue(done);

        return { success: true, url };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        const failed = queueRef.current.map(q =>
          q.id === item.id ? { ...q, status: 'failed' as const, error: message } : q,
        );
        await commitQueue(failed);
        return { success: false, error };
      }
    },
    [commitQueue, uploadToStorage],
  );

  /* ─── Import Pending ────────────────────────────────────────── */

  const importQueuedPhotos = useCallback(async (): Promise<void> => {
    if (processingRef.current) {
      sweetAlert.alert('Import in Progress', 'Please wait for the current import to finish', 'info');
      return;
    }

    const pendingItems = queueRef.current.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) {
      sweetAlert.alert('No Pending Photos', 'All photos have been imported', 'info');
      return;
    }

    processingRef.current = true;

    if (isMounted.current) {
      setState(prev => ({
        ...prev,
        scanProgress: {
          phase: 'uploading',
          current: 0,
          total: pendingItems.length,
          message: `Importing ${pendingItems.length} photos...`,
          photosFound: pendingItems.length,
          photosImported: 0,
        },
      }));
    }

    let importedCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < pendingItems.length; i++) {
        if (scannerRef.current.cancelled) break;

        const result = await processQueueItem(pendingItems[i]);
        result.success ? importedCount++ : failedCount++;

        if (isMounted.current) {
          setState(prev => ({
            ...prev,
            scanProgress: prev.scanProgress
              ? {
                  ...prev.scanProgress,
                  current: i + 1,
                  photosImported: importedCount,
                  message: `Imported ${importedCount}/${pendingItems.length} photos...`,
                }
              : null,
          }));
        }
      }

      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          scanProgress: prev.scanProgress
            ? {
                ...prev.scanProgress,
                phase: 'completed',
                message: `Import complete! Imported ${importedCount} photos.`,
                photosImported: importedCount,
              }
            : null,
        }));
      }

      if (failedCount > 0) {
        sweetAlert.alert(
          'Import Complete with Errors',
          `Imported ${importedCount} photos, ${failedCount} failed. You can retry failed imports.`,
          'warning',
        );
      } else if (importedCount > 0) {
        sweetAlert.alert('Import Complete', `Successfully imported ${importedCount} photos! 🎉`, 'success');
      }
    } finally {
      processingRef.current = false;
    }
  }, [processQueueItem, sweetAlert]);

  /* ─── Start Scan ────────────────────────────────────────────── */

  const startScan = useCallback(
    async (options: { quick?: boolean; days?: number } = {}): Promise<void> => {
      if (state.isScanning) {
        sweetAlert.alert('Scan in Progress', 'A scan is already running', 'info');
        return;
      }

      if (!currentBaby?.id) {
        sweetAlert.alert('No Baby Selected', 'Please select a baby first', 'warning');
        return;
      }

      const days = options.days ?? (options.quick ? 7 : 30);
      scannerRef.current.cancelled = false;
      const startedAt = Date.now();

      setState(prev => ({
        ...prev,
        isScanning: true,
        scanProgress: {
          phase: 'requesting_permission',
          current: 0,
          total: 100,
          message: 'Requesting permissions...',
          photosFound: 0,
          photosImported: 0,
        },
      }));

      try {
        setState(prev => ({
          ...prev,
          scanProgress: prev.scanProgress
            ? { ...prev.scanProgress, phase: 'scanning', message: 'Scanning photos...' }
            : null,
        }));

        const photos = await scanPhotos(days);

        if (scannerRef.current.cancelled) {
          setState(prev => ({
            ...prev,
            isScanning: false,
            scanProgress: prev.scanProgress
              ? { ...prev.scanProgress, phase: 'cancelled', message: 'Scan cancelled' }
              : null,
          }));
          return;
        }

        if (photos.length === 0) {
          sweetAlert.alert('No Photos Found', 'No new photos found in the selected date range', 'info');
          setState(prev => ({
            ...prev,
            isScanning: false,
            scanProgress: prev.scanProgress
              ? {
                  ...prev.scanProgress,
                  phase: 'completed',
                  message: 'No new photos found',
                  photosFound: 0,
                  photosImported: 0,
                }
              : null,
          }));
          await saveLastScanTime(new Date());
          return;
        }

        setState(prev => ({
          ...prev,
          scanProgress: prev.scanProgress
            ? {
                ...prev.scanProgress,
                phase: 'importing',
                message: `Adding ${photos.length} photos to import queue...`,
              }
            : null,
        }));

        const newItems: ImportQueueItem[] = photos.map(photo => ({
          id: buildQueueId(),
          photo,
          babyId: currentBaby.id,
          status: 'pending' as const,
        }));

        const merged = [...queueRef.current, ...newItems];
        await commitQueue(merged);

        if (photos.length <= AUTO_IMPORT_THRESHOLD) {
          await importQueuedPhotos();
        } else {
          sweetAlert.alert(
            'Photos Ready for Import',
            `${photos.length} photos found. You can import them now or later.`,
            'success',
          );
        }

        await saveScanHistory({
          id: `scan_${Date.now()}`,
          timestamp: new Date().toISOString(),
          photosFound: photos.length,
          photosImported: 0,
          duration: Date.now() - startedAt,
          status: 'completed',
        });

        await saveLastScanTime(new Date());

        setState(prev => ({
          ...prev,
          isScanning: false,
          scanProgress: prev.scanProgress
            ? {
                ...prev.scanProgress,
                phase: 'completed',
                message: `Scan complete! Found ${photos.length} photos.`,
                photosFound: photos.length,
              }
            : null,
        }));
      } catch (error) {
        console.error('[PhotoSync] Scan error:', error);
        setState(prev => ({
          ...prev,
          isScanning: false,
          scanProgress: prev.scanProgress
            ? {
                ...prev.scanProgress,
                phase: 'error',
                message: error instanceof Error ? error.message : 'Scan failed',
              }
            : null,
        }));
        sweetAlert.alert(
          'Scan Error',
          error instanceof Error ? error.message : 'Failed to scan photos',
          'error',
        );
      }
    },
    [
      state.isScanning,
      currentBaby,
      scanPhotos,
      commitQueue,
      importQueuedPhotos,
      saveScanHistory,
      saveLastScanTime,
      sweetAlert,
    ],
  );

  /* ─── Retry Failed ───────────────────────────────────────────── */

  const retryFailed = useCallback(async (): Promise<void> => {
    const failed = queueRef.current.filter(i => i.status === 'failed');
    if (failed.length === 0) {
      sweetAlert.alert('No Failed Items', 'All imports were successful', 'info');
      return;
    }

    const reset = queueRef.current.map(i =>
      i.status === 'failed' ? { ...i, status: 'pending' as const, error: undefined } : i,
    );
    await commitQueue(reset);

    await importQueuedPhotos();
  }, [commitQueue, importQueuedPhotos, sweetAlert]);

  /* ─── Clear Completed ────────────────────────────────────────── */

  const clearCompleted = useCallback(async (): Promise<void> => {
    const cleared = queueRef.current.filter(
      i => i.status !== 'completed' && i.status !== 'failed',
    );
    await commitQueue(cleared);
    sweetAlert.alert('Cleared', 'Completed imports have been cleared', 'success');
  }, [commitQueue, sweetAlert]);

  /* ─── Cancel Scan ────────────────────────────────────────────── */

  const cancelScan = useCallback((): void => {
    scannerRef.current.cancelled = true;
    setState(prev => ({
      ...prev,
      isScanning: false,
      scanProgress: prev.scanProgress
        ? { ...prev.scanProgress, phase: 'cancelled', message: 'Scan cancelled' }
        : null,
    }));
  }, []);

  /* ─── Context Value ──────────────────────────────────────────── */

  const value = useMemo<PhotoSyncContextType>(
    () => ({
      ...state,
      startScan,
      cancelScan,
      importQueuedPhotos,
      retryFailed,
      clearCompleted,
      getScanHistory,
      clearScanHistory,
    }),
    [
      state,
      startScan,
      cancelScan,
      importQueuedPhotos,
      retryFailed,
      clearCompleted,
      getScanHistory,
      clearScanHistory,
    ],
  );

  return <PhotoSyncContext.Provider value={value}>{children}</PhotoSyncContext.Provider>;
};

export const usePhotoSync = (): PhotoSyncContextType => {
  const context = useContext(PhotoSyncContext);
  if (!context) throw new Error('usePhotoSync must be used within PhotoSyncProvider');
  return context;
};

export default PhotoSyncProvider;