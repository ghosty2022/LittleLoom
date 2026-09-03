// src/hooks/usePhotoScanner.ts

import { useState, useCallback } from 'react';
import { PhotoScanner, ScanProgress, ScanResult } from '../services/PhotoScanner';
import { supabase } from '../lib/supabase';

export function usePhotoScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const scan = useCallback(async (options?: { quick?: boolean; days?: number }) => {
    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      const scanner = new PhotoScanner((p) => setProgress(p));
      
      const afterDate = options?.days 
        ? new Date(Date.now() - options.days * 24 * 60 * 60 * 1000)
        : undefined;
      
      const scanResult = await scanner.scan({ afterDate });
      setResult(scanResult);
      
      // Optionally store results in Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user && scanResult.media.length > 0) {
        // Store scan results or trigger sync
        console.log(`[PhotoScanner] Found ${scanResult.media.length} photos`);
      }
      
      return scanResult;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Scan failed');
      setError(errorObj);
      throw errorObj;
    } finally {
      setIsScanning(false);
    }
  }, []);

  const scanCustom = useCallback(async (afterDate?: Date, beforeDate?: Date) => {
    setIsScanning(true);
    setError(null);

    const scanner = new PhotoScanner((p) => setProgress(p));
    
    try {
      const scanResult = await scanner.scan({ afterDate, beforeDate });
      setResult(scanResult);
      return scanResult;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Scan failed');
      setError(errorObj);
      throw errorObj;
    } finally {
      setIsScanning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setProgress(null);
    setError(null);
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    progress,
    result,
    error,
    scan,
    scanCustom,
    reset,
  };
}

export default usePhotoScanner;