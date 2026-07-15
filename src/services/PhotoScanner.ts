
// src/services/PhotoScanner.ts
// Scans device gallery for baby-related photos

import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ScannedPhoto {
  id: string;
  uri: string;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  filename: string;
  mediaType: 'photo' | 'video' | 'unknown';
  albumId?: string;
  duration?: number;
}

export interface ScanResult {
  photos: ScannedPhoto[];
  totalFound: number;
  alreadyImported: number;
  newPhotos: number;
}

export interface ScanProgress {
  phase: 'requesting_permission' | 'scanning' | 'analyzing' | 'importing' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
  photosFound: number;
  photosImported: number;
}

export type ScanProgressCallback = (progress: ScanProgress) => void;

/* ═══════════════════════════════════════════════════════════════════════════
   HEURISTIC FILTERS
   ═══════════════════════════════════════════════════════════════════════════ */

const EXCLUDED_KEYWORDS = [
  'screenshot', 'screen_shot', 'screen-shot',
  'receipt', 'invoice', 'document', 'pdf',
  'meme', 'gif', 'sticker', 'wallpaper',
  'download', 'temp', 'cache',
];

/* ═══════════════════════════════════════════════════════════════════════════
   PHOTO SCANNER
   ═══════════════════════════════════════════════════════════════════════════ */

export class PhotoScanner {
  private abortController: AbortController | null = null;
  private onProgress: ScanProgressCallback | null = null;

  constructor(progressCallback?: ScanProgressCallback) {
    this.onProgress = progressCallback || null;
  }

  /* ─── Request permission ───────────────────────────────────────── */
  async requestPermission(): Promise<boolean> {
    this.reportProgress('requesting_permission', 0, 1, 'Requesting photo library access...');
    
    const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
    
    if (status === 'granted') {
      return true;
    }
    
    if (!canAskAgain) {
      Alert.alert(
        'Photo Access Required',
        'Please enable photo library access in Settings to scan for baby photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              if (Platform.OS === 'ios') {
                const { Linking } = require('react-native');
                Linking.openURL('app-settings:');
              } else {
                const { Linking } = require('react-native');
                Linking.openSettings();
              }
            }
          },
        ]
      );
    }
    
    return false;
  }

  /* ─── Check permission ──────────────────────────────────────────── */
  async checkPermission(): Promise<boolean> {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status === 'granted';
  }

  /* ─── Full scan ─────────────────────────────────────────────────── */
  async scan(options: {
    afterDate?: Date;
    beforeDate?: Date;
    maxResults?: number;
    includeScreenshots?: boolean;
    includeVideos?: boolean;
  } = {}): Promise<ScanResult> {
    this.abortController = new AbortController();
    
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) {
        throw new Error('Photo library permission denied');
      }
    }

    this.reportProgress('scanning', 0, 100, 'Scanning photo library...');

    try {
      const mediaQuery: MediaLibrary.AssetsOptions = {
        first: options.maxResults || 5000,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        mediaType: options.includeVideos 
          ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
          : MediaLibrary.MediaType.photo,
      };

      if (options.afterDate) {
        (mediaQuery as any).createdAfter = options.afterDate.getTime();
      }

      if (options.beforeDate) {
        (mediaQuery as any).createdBefore = options.beforeDate.getTime();
      }

      const assets = await MediaLibrary.getAssetsAsync(mediaQuery);
      
      this.reportProgress('scanning', 50, 100, `Found ${assets.assets.length} photos...`);

      const scannedPhotos: ScannedPhoto[] = [];
      const total = assets.assets.length;

      for (let i = 0; i < assets.assets.length; i++) {
        if (this.abortController.signal.aborted) {
          throw new Error('Scan cancelled');
        }

        const asset = assets.assets[i];
        
        if (!options.includeScreenshots && this.isScreenshot(asset)) {
          continue;
        }

        scannedPhotos.push({
          id: asset.id,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          creationTime: asset.creationTime,
          modificationTime: asset.modificationTime,
          filename: asset.filename,
          mediaType: asset.mediaType as 'photo' | 'video' | 'unknown',
        });

        if (i % 50 === 0) {
          this.reportProgress('analyzing', i, total, `Analyzing photo ${i + 1} of ${total}...`);
        }
      }

      this.reportProgress('completed', total, total, `Scan complete! Found ${scannedPhotos.length} photos.`);

      return {
        photos: scannedPhotos,
        totalFound: assets.assets.length,
        alreadyImported: 0,
        newPhotos: scannedPhotos.length,
      };

    } catch (error) {
      this.reportProgress('error', 0, 0, `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /* ─── Quick scan ────────────────────────────────────────────────── */
  async quickScan(days: number = 7): Promise<ScanResult> {
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days);
    
    return this.scan({
      afterDate,
      maxResults: 1000,
    });
  }

  /* ─── Deep scan ─────────────────────────────────────────────────── */
  async deepScan(): Promise<ScanResult> {
    return this.scan({
      maxResults: 10000,
      includeScreenshots: false,
    });
  }

  /* ─── Get albums ────────────────────────────────────────────────── */
  async getAlbums(): Promise<MediaLibrary.Album[]> {
    const albums = await MediaLibrary.getAlbumsAsync();
    return albums.filter(a => 
      !['Screenshots', 'Download', 'Downloads', 'Cache', 'Temp'].includes(a.title)
    );
  }

  /* ─── Scan specific album ───────────────────────────────────────── */
  async scanAlbum(albumId: string, maxResults: number = 500): Promise<ScannedPhoto[]> {
    const assets = await MediaLibrary.getAssetsAsync({
      first: maxResults,
      album: albumId,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    return assets.assets.map(asset => ({
      id: asset.id,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
      modificationTime: asset.modificationTime,
      filename: asset.filename,
      mediaType: asset.mediaType as 'photo' | 'video' | 'unknown',
      albumId,
    }));
  }

  /* ─── Cancel scan ───────────────────────────────────────────────── */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /* ─── Helpers ──────────────────────────────────────────────────── */
  private isScreenshot(asset: MediaLibrary.Asset): boolean {
    const lowerName = asset.filename.toLowerCase();
    return (
      lowerName.includes('screenshot') ||
      lowerName.includes('screen_shot') ||
      lowerName.includes('screen-shot') ||
      lowerName.startsWith('screenshot') ||
      lowerName.startsWith('screencapture')
    );
  }

  private reportProgress(
    phase: ScanProgress['phase'],
    current: number,
    total: number,
    message: string
  ): void {
    if (this.onProgress) {
      this.onProgress({
        phase,
        current,
        total,
        message,
        photosFound: 0,
        photosImported: 0,
      });
    }
  }
}

export default PhotoScanner;
