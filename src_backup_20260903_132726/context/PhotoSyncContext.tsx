// src/context/PhotoSyncContext.tsx
// Manages photo import and sync with Supabase Storage

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '@/utils/supabase';
import { useBaby } from './BabyContext';
import { useAuth } from './AuthContext';
import { useSweetAlert } from '../components/SweetAlert';
import { decode } from 'base64-arraybuffer';

export interface ScanProgress {
  phase: 'requesting_permission' | 'scanning' | 'processing' | 'uploading' | 'importing' | 'completed' | 'error';
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

interface PhotoSyncState {
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScanTime: Date | null;
  queue: ImportQueueItem[];
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
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

export interface ScanHistoryEntry {
  id: string;
  timestamp: string;
  photosFound: number;
  photosImported: number;
  duration: number;
  status: 'completed' | 'failed' | 'cancelled';
}

const PhotoSyncContext = createContext<PhotoSyncContextType | null>(null);

const PHOTO_SYNC_QUEUE_KEY = '@littleloom_photo_sync_queue';
const SCAN_HISTORY_KEY = '@littleloom_scan_history';
const LAST_SCAN_KEY = '@littleloom_last_scan_time';
const PHOTOS_BUCKET = 'baby_photos';

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
  
  const scannerRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    loadQueue();
    loadLastScanTime();
    return () => { isMounted.current = false; };
  }, []);

  // Update queue stats whenever queue changes
  useEffect(() => {
    const stats = {
      pending: state.queue.filter(item => item.status === 'pending').length,
      processing: state.queue.filter(item => item.status === 'processing').length,
      completed: state.queue.filter(item => item.status === 'completed').length,
      failed: state.queue.filter(item => item.status === 'failed').length,
    };
    setState(prev => ({ ...prev, queueStats: stats }));
  }, [state.queue]);

  /* ─── Load/Save Queue ────────────────────────────────────────────────── */

  const loadQueue = useCallback(async () => {
    try {
      const data = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + PHOTO_SYNC_QUEUE_KEY,
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      const queue = JSON.parse(data);
      if (isMounted.current) {
        setState(prev => ({ ...prev, queue }));
      }
    } catch {
      // No queue file exists
    }
  }, []);

  const saveQueue = useCallback(async (queue: ImportQueueItem[]) => {
    try {
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + PHOTO_SYNC_QUEUE_KEY,
        JSON.stringify(queue),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('[PhotoSync] Failed to save queue:', error);
    }
  }, []);

  const loadLastScanTime = useCallback(async () => {
    try {
      const data = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + LAST_SCAN_KEY,
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      const time = new Date(JSON.parse(data));
      if (isMounted.current) {
        setState(prev => ({ ...prev, lastScanTime: time }));
      }
    } catch {
      // No last scan time
    }
  }, []);

  const saveLastScanTime = useCallback(async (time: Date) => {
    try {
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + LAST_SCAN_KEY,
        JSON.stringify(time.toISOString()),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('[PhotoSync] Failed to save last scan time:', error);
    }
  }, []);

  /* ─── Scan History ───────────────────────────────────────────────────── */

  const getScanHistory = useCallback(async (): Promise<ScanHistoryEntry[]> => {
    try {
      const data = await FileSystem.readAsStringAsync(
        FileSystem.documentDirectory + SCAN_HISTORY_KEY,
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      return JSON.parse(data);
    } catch {
      return [];
    }
  }, []);

  const saveScanHistory = useCallback(async (entry: ScanHistoryEntry) => {
    try {
      const history = await getScanHistory();
      history.unshift(entry);
      if (history.length > 50) history.pop(); // Keep last 50
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + SCAN_HISTORY_KEY,
        JSON.stringify(history),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('[PhotoSync] Failed to save scan history:', error);
    }
  }, [getScanHistory]);

  const clearScanHistory = useCallback(async () => {
    try {
      await FileSystem.deleteAsync(
        FileSystem.documentDirectory + SCAN_HISTORY_KEY,
        { idempotent: true }
      );
    } catch (error) {
      console.error('[PhotoSync] Failed to clear scan history:', error);
    }
  }, []);

  /* ─── Scan Photos ────────────────────────────────────────────────────── */

  const scanPhotos = useCallback(async (days: number = 7): Promise<ScannedPhoto[]> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission required');
    }

    const photos: ScannedPhoto[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let hasNextPage = true;
    let endCursor: string | undefined;

    while (hasNextPage && !scannerRef.current.cancelled) {
      const { assets, endCursor: nextCursor, hasNextPage: hasNext } = await MediaLibrary.getAssetsAsync({
        first: 100,
        after: endCursor,
        mediaType: ['photo'],
        createdAfter: startDate,
        sortBy: ['creationTime'],
      });

      for (const asset of assets) {
        if (scannerRef.current.cancelled) break;
        
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
        const isLocal = assetInfo.localUri || assetInfo.uri;

        photos.push({
          uri: isLocal || asset.uri,
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
      
      // Update progress
      setState(prev => ({
        ...prev,
        scanProgress: prev.scanProgress ? {
          ...prev.scanProgress,
          current: photos.length,
          photosFound: photos.length,
          message: `Found ${photos.length} photos...`,
        } : null,
      }));
    }

    return photos;
  }, []);

  /* ─── Upload to Supabase Storage ───────────────────────────────────── */

  const uploadToStorage = useCallback(async (
    photo: ScannedPhoto,
    babyId: string
  ): Promise<string> => {
    const fileName = `${babyId}/${Date.now()}_${photo.fileName || 'photo.jpg'}`;
    
    // Read file as base64
    const fileData = await FileSystem.readAsStringAsync(photo.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { error: uploadError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(fileName, decode(fileData), {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage
      .from(PHOTOS_BUCKET)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }, []);

  /* ─── Import Photos ──────────────────────────────────────────────────── */

  const processQueueItem = useCallback(async (item: ImportQueueItem) => {
    if (!item.babyId) {
      throw new Error('No baby ID specified');
    }

    // Update status to processing
    const updatedQueue = state.queue.map(q =>
      q.id === item.id ? { ...q, status: 'processing' as const } : q
    );
    setState(prev => ({ ...prev, queue: updatedQueue }));
    await saveQueue(updatedQueue);

    try {
      // Upload to Supabase storage
      const url = await uploadToStorage(item.photo, item.babyId);

      // Save to tracker entries
      const { error: entryError } = await supabase
        .from('tracker_entries')
        .insert({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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

      if (entryError) {
        throw new Error(entryError.message);
      }

      // Mark as completed
      const completedQueue = updatedQueue.map(q =>
        q.id === item.id ? { ...q, status: 'completed' as const, uploadedUrl: url } : q
      );
      setState(prev => ({ ...prev, queue: completedQueue }));
      await saveQueue(completedQueue);

      return { success: true, url };

    } catch (error) {
      // Mark as failed
      const failedQueue = updatedQueue.map(q =>
        q.id === item.id ? {
          ...q,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Upload failed',
        } : q
      );
      setState(prev => ({ ...prev, queue: failedQueue }));
      await saveQueue(failedQueue);

      return { success: false, error };
    }
  }, [state.queue, saveQueue, uploadToStorage]);

  /* ─── Start Scan ────────────────────────────────────────────────────── */

  const startScan = useCallback(async (options: { quick?: boolean; days?: number } = {}) => {
    if (state.isScanning) {
      sweetAlert.alert('Scan in Progress', 'A scan is already running', 'info');
      return;
    }

    if (!currentBaby?.id) {
      sweetAlert.alert('No Baby Selected', 'Please select a baby first', 'warning');
      return;
    }

    const days = options.days || (options.quick ? 7 : 30);
    scannerRef.current.cancelled = false;
    const startTime = Date.now();

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
      // Scan photos
      setState(prev => ({
        ...prev,
        scanProgress: prev.scanProgress ? {
          ...prev.scanProgress,
          phase: 'scanning',
          message: 'Scanning photos...',
        } : null,
      }));

      const photos = await scanPhotos(days);

      if (scannerRef.current.cancelled) {
        setState(prev => ({
          ...prev,
          isScanning: false,
          scanProgress: prev.scanProgress ? {
            ...prev.scanProgress,
            phase: 'cancelled',
            message: 'Scan cancelled',
          } : null,
        }));
        return;
      }

      if (photos.length === 0) {
        sweetAlert.alert('No Photos Found', 'No new photos found in the selected date range', 'info');
        setState(prev => ({
          ...prev,
          isScanning: false,
          scanProgress: prev.scanProgress ? {
            ...prev.scanProgress,
            phase: 'completed',
            message: 'No new photos found',
            photosFound: 0,
            photosImported: 0,
          } : null,
        }));
        return;
      }

      // Add to queue
      setState(prev => ({
        ...prev,
        scanProgress: prev.scanProgress ? {
          ...prev.scanProgress,
          phase: 'importing',
          message: `Adding ${photos.length} photos to import queue...`,
        } : null,
      }));

      const queueItems: ImportQueueItem[] = photos.map(photo => ({
        id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        photo,
        babyId: currentBaby.id,
        status: 'pending' as const,
      }));

      const updatedQueue = [...state.queue, ...queueItems];
      setState(prev => ({ ...prev, queue: updatedQueue }));
      await saveQueue(updatedQueue);

      // Auto-import if not too many
      if (photos.length <= 20) {
        await importQueuedPhotos();
      } else {
        sweetAlert.alert(
          'Photos Ready for Import',
          `${photos.length} photos found. You can import them now or later.`,
          'success'
        );
      }

      const duration = Date.now() - startTime;
      await saveScanHistory({
        id: `scan_${Date.now()}`,
        timestamp: new Date().toISOString(),
        photosFound: photos.length,
        photosImported: 0,
        duration,
        status: 'completed',
      });

      await saveLastScanTime(new Date());

      setState(prev => ({
        ...prev,
        isScanning: false,
        scanProgress: prev.scanProgress ? {
          ...prev.scanProgress,
          phase: 'completed',
          message: `Scan complete! Found ${photos.length} photos.`,
          photosFound: photos.length,
          photosImported: 0,
        } : null,
      }));

    } catch (error) {
      console.error('[PhotoSync] Scan error:', error);
      setState(prev => ({
        ...prev,
        isScanning: false,
        scanProgress: prev.scanProgress ? {
          ...prev.scanProgress,
          phase: 'error',
          message: error instanceof Error ? error.message : 'Scan failed',
          photosFound: 0,
          photosImported: 0,
        } : null,
      }));
      sweetAlert.alert('Scan Error', error instanceof Error ? error.message : 'Failed to scan photos', 'error');
    }
  }, [state.isScanning, state.queue, currentBaby, scanPhotos, saveQueue, saveScanHistory, saveLastScanTime, sweetAlert]);

  /* ─── Import Queued Photos ──────────────────────────────────────────── */

  const importQueuedPhotos = useCallback(async () => {
    const pendingItems = state.queue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      sweetAlert.alert('No Pending Photos', 'All photos have been imported', 'info');
      return;
    }

    let importedCount = 0;
    let failedCount = 0;

    setState(prev => ({
      ...prev,
      scanProgress: prev.scanProgress ? {
        ...prev.scanProgress,
        phase: 'uploading',
        message: `Importing ${pendingItems.length} photos...`,
      } : {
        phase: 'uploading',
        current: 0,
        total: pendingItems.length,
        message: `Importing ${pendingItems.length} photos...`,
        photosFound: pendingItems.length,
        photosImported: 0,
      },
    }));

    for (let i = 0; i < pendingItems.length; i++) {
      if (scannerRef.current.cancelled) break;

      const item = pendingItems[i];
      const result = await processQueueItem(item);

      if (result.success) {
        importedCount++;
      } else {
        failedCount++;
      }

      setState(prev => ({
        ...prev,
        scanProgress: prev.scanProgress ? {
          ...prev.scanProgress,
          current: i + 1,
          photosImported: importedCount,
          message: `Imported ${importedCount}/${pendingItems.length} photos...`,
        } : null,
      }));
    }

    const totalImported = state.queue.filter(q => q.status === 'completed').length;

    setState(prev => ({
      ...prev,
      scanProgress: prev.scanProgress ? {
        ...prev.scanProgress,
        phase: 'completed',
        message: `Import complete! Imported ${importedCount} photos.`,
        photosImported: totalImported,
      } : null,
    }));

    if (failedCount > 0) {
      sweetAlert.alert(
        'Import Complete with Errors',
        `Imported ${importedCount} photos, ${failedCount} failed. You can retry failed imports.`,
        'warning'
      );
    } else {
      sweetAlert.alert('Import Complete', `Successfully imported ${importedCount} photos! 🎉`, 'success');
    }
  }, [state.queue, processQueueItem, sweetAlert]);

  const retryFailed = useCallback(async () => {
    const failedItems = state.queue.filter(item => item.status === 'failed');
    
    if (failedItems.length === 0) {
      sweetAlert.alert('No Failed Items', 'All imports were successful', 'info');
      return;
    }

    // Reset failed items to pending
    const resetQueue = state.queue.map(item =>
      item.status === 'failed' ? { ...item, status: 'pending' as const, error: undefined } : item
    );
    setState(prev => ({ ...prev, queue: resetQueue }));
    await saveQueue(resetQueue);

    await importQueuedPhotos();
  }, [state.queue, saveQueue, importQueuedPhotos, sweetAlert]);

  const clearCompleted = useCallback(async () => {
    const clearedQueue = state.queue.filter(item => 
      item.status !== 'completed' && item.status !== 'failed'
    );
    setState(prev => ({ ...prev, queue: clearedQueue }));
    await saveQueue(clearedQueue);
    sweetAlert.alert('Cleared', 'Completed imports have been cleared', 'success');
  }, [state.queue, saveQueue, sweetAlert]);

  /* ─── Cancel Scan ────────────────────────────────────────────────────── */

  const cancelScan = useCallback(() => {
    scannerRef.current.cancelled = true;
    setState(prev => ({
      ...prev,
      isScanning: false,
      scanProgress: prev.scanProgress ? {
        ...prev.scanProgress,
        phase: 'cancelled',
        message: 'Scan cancelled',
      } : null,
    }));
  }, []);

  /* ─── Value ──────────────────────────────────────────────────────────── */

  const value = React.useMemo(() => ({
    ...state,
    startScan,
    cancelScan,
    importQueuedPhotos,
    retryFailed,
    clearCompleted,
    getScanHistory,
    clearScanHistory,
  }), [state, startScan, cancelScan, importQueuedPhotos, retryFailed, clearCompleted, getScanHistory, clearScanHistory]);

  return (
    <PhotoSyncContext.Provider value={value}>
      {children}
    </PhotoSyncContext.Provider>
  );
};

export const usePhotoSync = () => {
  const context = useContext(PhotoSyncContext);
  if (!context) throw new Error('usePhotoSync must be used within PhotoSyncProvider');
  return context;
};

export default PhotoSyncProvider;