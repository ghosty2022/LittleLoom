// src/services/PhotoClassifier.ts
// Heuristic-based photo classification for baby detection

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { ScannedPhoto } from './PhotoScanner';

export interface ClassificationResult {
  photoId: string;
  isBabyRelated: boolean;
  confidence: number;
  detectedFaces: number;
  dominantColors: string[];
  suggestedBabyIds: string[];
  suggestedTags: string[];
  suggestedType: 'milestone' | 'daily' | 'sleep' | 'feeding' | 'potty' | 'growth' | 'general';
}

export class PhotoClassifier {
  async classify(photo: ScannedPhoto): Promise<ClassificationResult> {
    const results: Partial<ClassificationResult> = {
      photoId: photo.id,
      detectedFaces: 0,
      dominantColors: [],
      suggestedBabyIds: [],
      suggestedTags: [],
    };

    try {
      const filenameScore = this.analyzeFilename(photo.filename);
      const metadataScore = await this.analyzeMetadata(photo);
      const imageScore = await this.analyzeImageContent(photo.uri);
      const timeScore = this.analyzeTimestamp(photo.creationTime);

      const confidence = Math.min(100, Math.round(
        filenameScore * 0.25 +
        metadataScore * 0.15 +
        imageScore * 0.45 +
        timeScore * 0.15
      ));

      results.isBabyRelated = confidence >= 50;
      results.confidence = confidence;
      results.suggestedType = this.inferType(photo, filenameScore, timeScore);
      results.suggestedTags = this.extractTags(photo.filename);

      return results as ClassificationResult;

    } catch (error) {
      console.warn('[PhotoClassifier] Classification failed:', error);
      return {
        photoId: photo.id,
        isBabyRelated: false,
        confidence: 0,
        detectedFaces: 0,
        dominantColors: [],
        suggestedBabyIds: [],
        suggestedTags: [],
        suggestedType: 'general',
      };
    }
  }

  async classifyBatch(
    photos: ScannedPhoto[],
    onProgress?: (current: number, total: number) => void
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    for (let i = 0; i < photos.length; i++) {
      const result = await this.classify(photos[i]);
      results.push(result);
      
      if (onProgress && i % 10 === 0) {
        onProgress(i + 1, photos.length);
      }
      
      if (i % 5 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }
    
    return results;
  }

  private analyzeFilename(filename: string): number {
    const lower = filename.toLowerCase();
    let score = 30;

    const positiveSignals = [
      /baby/i, /infant/i, /newborn/i, /toddler/i,
      /bath/i, /feeding/i, /sleep/i, /nap/i,
      /crawl/i, /walk/i, /smile/i, /laugh/i,
      /birthday/i, /month/i, /week/i,
      /mama/i, /dada/i, /mom/i, /dad/i,
      /family/i, /cute/i, /adorable/i,
      /img_\d{8}/, /photo_\d{8}/,
    ];

    const negativeSignals = [
      /screenshot/i, /screen[_-]?shot/i,
      /receipt/i, /invoice/i, /document/i,
      /download/i, /temp/i, /cache/i,
      /wallpaper/i, /meme/i, /gif/i,
    ];

    for (const signal of positiveSignals) {
      if (signal.test(lower)) score += 15;
    }

    for (const signal of negativeSignals) {
      if (signal.test(lower)) score -= 30;
    }

    if (/\d{4}[-_]\d{2}[-_]\d{2}/.test(lower)) score += 10;
    if (/dsc_\d+/i.test(lower) || /img_\d+/i.test(lower)) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private async analyzeMetadata(photo: ScannedPhoto): Promise<number> {
    let score = 30;

    if (photo.width < photo.height) score += 15;

    const mp = (photo.width * photo.height) / 1000000;
    if (mp >= 1 && mp <= 24) score += 10;
    if (mp > 24) score -= 10;

    try {
      const info = await FileSystem.getInfoAsync(photo.uri);
      if (info.exists && 'size' in info) {
        const sizeMB = info.size / (1024 * 1024);
        if (sizeMB > 0.1 && sizeMB < 50) score += 10;
        if (sizeMB > 100) score -= 20;
      }
    } catch {
      // Ignore
    }

    return Math.max(0, Math.min(100, score));
  }

  private async analyzeImageContent(uri: string): Promise<number> {
    try {
      const thumbnail = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 100 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const info = await FileSystem.getInfoAsync(thumbnail.uri);
      
      if (info.exists && 'size' in info) {
        if (info.size > 2000 && info.size < 50000) return 60;
        if (info.size >= 50000) return 75;
      }

      return 40;
    } catch {
      return 30;
    }
  }

  private analyzeTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    const hour = date.getHours();
    let score = 30;

    if (hour >= 6 && hour <= 21) score += 15;
    
    const day = date.getDay();
    if (day === 0 || day === 6) score += 5;

    const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) score += 10;
    else if (ageDays < 365) score += 5;
    else if (ageDays > 365 * 3) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private inferType(
    photo: ScannedPhoto,
    filenameScore: number,
    timeScore: number
  ): ClassificationResult['suggestedType'] {
    const lower = photo.filename.toLowerCase();
    const hour = new Date(photo.creationTime).getHours();

    if (/sleep|nap|bed|night/i.test(lower)) return 'sleep';
    if (/feed|bottle|breast|milk/i.test(lower)) return 'feeding';
    if (/bath|shower|water/i.test(lower)) return 'daily';
    if (/potty|toilet|pee|poop/i.test(lower)) return 'potty';
    if (/measure|weight|height|growth/i.test(lower)) return 'growth';
    if (/mileston|first|birthday|party/i.test(lower)) return 'milestone';
    
    if (hour >= 20 || hour <= 6) return 'sleep';
    if (hour >= 6 && hour <= 9) return 'feeding';

    return 'daily';
  }

  private extractTags(filename: string): string[] {
    const tags: string[] = [];
    const lower = filename.toLowerCase();

    const tagMap: Record<string, string[]> = {
      'bath': ['bath', 'hygiene'],
      'sleep': ['sleep', 'rest'],
      'nap': ['nap', 'sleep'],
      'feed': ['feeding', 'nutrition'],
      'bottle': ['bottle', 'feeding'],
      'breast': ['breastfeeding', 'feeding'],
      'smile': ['smile', 'happy'],
      'laugh': ['laugh', 'happy', 'joy'],
      'walk': ['walking', 'milestone'],
      'crawl': ['crawling', 'milestone'],
      'birthday': ['birthday', 'celebration', 'milestone'],
      'party': ['party', 'celebration'],
      'family': ['family', 'together'],
      'outdoor': ['outdoor', 'nature'],
      'beach': ['beach', 'outdoor', 'summer'],
      'park': ['park', 'outdoor', 'play'],
    };

    for (const [keyword, tagList] of Object.entries(tagMap)) {
      if (lower.includes(keyword)) {
        tags.push(...tagList);
      }
    }

    return [...new Set(tags)];
  }
}

export default PhotoClassifier;
