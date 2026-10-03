// src/hooks/usePhotoScanner.ts

import { useState, useCallback } from 'react';
import { PhotoScanner, ScanProgress, ScanResult } from '../services/PhotoScanner';
import type { UnifiedPhoto } from '../types/photos';
import { supabase } from '../utils/supabase';

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
      
      // PhotoScanner surfaces local device media for user review.
      // Persisting to tracker entries is the caller's responsibility
      // via `useTracker().addEntry({ photoUris })` so AI observeEntry
      // runs on the real entry (not a synthetic one).
      if (__DEV__ && scanResult.media.length > 0) {
        console.log(
          `[PhotoScanner] Surfaced ${scanResult.media.length} local photos ` +
          `(photos=${scanResult.photos.length}, total=${scanResult.totalFound})`
        );
      }

      // ── Classify the first few photos on-device (fire-and-forget) ──
      // This gives users smart tags without blocking the scan.
      (async () => {
        try {
          const { classifyImage } = await import('../services/ai/PhotoClassifier');
          const sample = scanResult.media.slice(0, 10);
          for (const photo of sample) {
            if (photo.uri) {
              const result = await classifyImage(photo.uri, 3);
              if (result.topLabel) {
                (photo as any).aiTags = result.labels.map((l) => l.label);
              }
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[PhotoScanner] classification failed:', e);
        }
      })();
      
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