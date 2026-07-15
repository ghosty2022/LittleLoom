// src/hooks/usePhotoScanner.ts
import { useState, useCallback } from 'react';
import { PhotoScanner, ScanProgress, ScanResult } from '../services/PhotoScanner';
import { usePhotoSync } from '../context/PhotoSyncContext';

export function usePhotoScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { startScan: contextStartScan } = usePhotoSync();

  const scan = useCallback(async (options?: { quick?: boolean; days?: number }) => {
    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      await contextStartScan(options);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Scan failed'));
    } finally {
      setIsScanning(false);
    }
  }, [contextStartScan]);

  const scanCustom = useCallback(async (afterDate?: Date, beforeDate?: Date) => {
    setIsScanning(true);
    setError(null);

    const scanner = new PhotoScanner((p) => setProgress(p));
    
    try {
      const scanResult = await scanner.scan({ afterDate, beforeDate });
      setResult(scanResult);
      return scanResult;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Scan failed'));
      throw err;
    } finally {
      setIsScanning(false);
    }
  }, []);

  return {
    isScanning,
    progress,
    result,
    error,
    scan,
    scanCustom,
  };
}

export default usePhotoScanner;