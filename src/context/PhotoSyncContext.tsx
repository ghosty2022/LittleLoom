
// src/context/PhotoSyncContext.tsx
// Manages auto-import and background photo scanning

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { PhotoScanner, ScanProgress } from '../services/PhotoScanner';
import { PhotoImportQueue } from '../services/PhotoImportQueue';
import { useBaby } from './BabyContext';

interface PhotoSyncContextType {
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScanTime: Date | null;
  startScan: (options?: { quick?: boolean; days?: number }) => Promise<void>;
  cancelScan: () => void;
  importQueuedPhotos: () => Promise<void>;
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

const PhotoSyncContext = createContext<PhotoSyncContextType | null>(null);

export const PhotoSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [queueStats, setQueueStats] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 });
  
  const scannerRef = useRef<PhotoScanner | null>(null);
  const importQueueRef = useRef<PhotoImportQueue | null>(null);
  
  const { currentBaby } = useBaby();

  const startScan = useCallback(async (options: { quick?: boolean; days?: number } = {}) => {
    if (isScanning) return;
    
    setIsScanning(true);
    setScanProgress({
      phase: 'requesting_permission',
      current: 0,
      total: 100,
      message: 'Starting scan...',
      photosFound: 0,
      photosImported: 0,
    });

    try {
      const scanner = new PhotoScanner((progress) => {
        setScanProgress(progress);
      });
      scannerRef.current = scanner;

      const result = options.quick 
        ? await scanner.quickScan(options.days || 7)
        : await scanner.deepScan();

      setScanProgress(prev => prev ? {
        ...prev,
        phase: 'importing',
        message: `Importing ${result.newPhotos} photos...`,
      } : null);

      const queue = new PhotoImportQueue();
      importQueueRef.current = queue;

      const queued = await queue.queuePhotos(result.photos, {
        babyId: currentBaby?.id,
        autoClassify: true,
        skipExisting: true,
        source: 'auto_import',
      });

      await queue.processQueue({
        babyId: currentBaby?.id,
        source: 'auto_import',
      }, (current, total) => {
        setScanProgress(prev => prev ? {
          ...prev,
          current,
          total,
          photosImported: current,
        } : null);
      });

      const stats = await queue.getQueueStats();
      setQueueStats(stats);

      setLastScanTime(new Date());
      setScanProgress({
        phase: 'completed',
        current: 100,
        total: 100,
        message: `Scan complete! Imported ${queued} photos.`,
        photosFound: result.totalFound,
        photosImported: queued,
      });

    } catch (error) {
      setScanProgress({
        phase: 'error',
        current: 0,
        total: 100,
        message: error instanceof Error ? error.message : 'Scan failed',
        photosFound: 0,
        photosImported: 0,
      });
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, currentBaby]);

  const cancelScan = useCallback(() => {
    scannerRef.current?.cancel();
    importQueueRef.current?.cancel();
    setIsScanning(false);
  }, []);

  const importQueuedPhotos = useCallback(async () => {
    const queue = new PhotoImportQueue();
    await queue.processQueue({
      babyId: currentBaby?.id,
    });
    const stats = await queue.getQueueStats();
    setQueueStats(stats);
  }, [currentBaby]);

  return (
    <PhotoSyncContext.Provider value={{
      isScanning,
      scanProgress,
      lastScanTime,
      startScan,
      cancelScan,
      importQueuedPhotos,
      queueStats,
    }}>
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
