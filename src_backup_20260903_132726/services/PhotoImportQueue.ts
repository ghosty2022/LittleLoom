// src/services/PhotoImportQueue.ts
// Manages background photo import with SQLite queue

import { db } from '../database/db';
import { photos, photoImportQueue } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { PhotoScanner, ScannedPhoto } from './PhotoScanner';
import { PhotoClassifier, ClassificationResult } from './PhotoClassifier';
import * as Crypto from 'expo-crypto';

export interface ImportOptions {
  babyId?: string;
  autoClassify?: boolean;
  markAsFavorite?: boolean;
  source?: string;
  skipExisting?: boolean;
}

export class PhotoImportQueue {
  private scanner: PhotoScanner;
  private classifier: PhotoClassifier;
  private isProcessing: boolean = false;
  private abortController: AbortController | null = null;

  constructor() {
    this.scanner = new PhotoScanner();
    this.classifier = new PhotoClassifier();
  }

  async queuePhotos(photosList: ScannedPhoto[], options: ImportOptions = {}): Promise<number> {
    let queued = 0;

    for (const photo of photosList) {
      if (options.skipExisting !== false) {
        const existing = await db.select().from(photos).where(eq(photos.uri, photo.uri)).limit(1);
        if (existing.length > 0) continue;
      }

      const id = await this.generateId(photo.uri);
      let classification: ClassificationResult | null = null;
      
      if (options.autoClassify !== false) {
        classification = await this.classifier.classify(photo);
      }

      await db.insert(photoImportQueue).values({
        id,
        uri: photo.uri,
        status: 'pending',
        priority: classification?.confidence || 50,
        sourceType: options.source || 'gallery_scan',
        detectedBabyIds: classification?.suggestedBabyIds || [],
        aiConfidence: classification?.confidence || 0,
      }).onConflictDoNothing();

      queued++;
    }

    return queued;
  }

  async processQueue(
    options: ImportOptions = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    processed: number;
    imported: number;
    skipped: number;
    failed: number;
  }> {
    if (this.isProcessing) {
      throw new Error('Import already in progress');
    }

    this.isProcessing = true;
    this.abortController = new AbortController();

    const results = { processed: 0, imported: 0, skipped: 0, failed: 0 };

    try {
      const jobs = await db.select().from(photoImportQueue)
        .where(eq(photoImportQueue.status, 'pending'))
        .orderBy(photoImportQueue.priority)
        .limit(50);

      const total = jobs.length;

      for (let i = 0; i < jobs.length; i++) {
        if (this.abortController.signal.aborted) break;

        const job = jobs[i];
        
        try {
          await this.processJob(job, options);
          results.imported++;
        } catch (err) {
          if (job.retryCount < 3) {
            await db.update(photoImportQueue)
              .set({
                status: 'pending',
                retryCount: job.retryCount + 1,
                errorMessage: err instanceof Error ? err.message : 'Unknown error',
              })
              .where(eq(photoImportQueue.id, job.id));
          } else {
            await db.update(photoImportQueue)
              .set({
                status: 'failed',
                errorMessage: err instanceof Error ? err.message : 'Unknown error',
                processedAt: new Date(),
              })
              .where(eq(photoImportQueue.id, job.id));
            results.failed++;
          }
        }

        results.processed++;
        
        if (onProgress) {
          onProgress(i + 1, total);
        }

        if (i % 3 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }

    } finally {
      this.isProcessing = false;
    }

    return results;
  }

  private async processJob(job: typeof photoImportQueue.$inferSelect, options: ImportOptions): Promise<void> {
    await db.update(photoImportQueue)
      .set({ status: 'processing' })
      .where(eq(photoImportQueue.id, job.id));

    const existing = await db.select().from(photos).where(eq(photos.uri, job.uri)).limit(1);
    if (existing.length > 0) {
      await db.update(photoImportQueue)
        .set({ status: 'skipped', processedAt: new Date() })
        .where(eq(photoImportQueue.id, job.id));
      return;
    }

    await db.insert(photos).values({
      id: job.id,
      uri: job.uri,
      babyId: options.babyId,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      type: 'auto_import',
      source: options.source || 'auto_import',
      isFavorite: options.markAsFavorite || false,
      isPrivate: false,
      isScreenshot: false,
      tags: [],
      aiTags: [],
      backupStatus: 'pending',
      facesDetected: [],
    });

    await db.update(photoImportQueue)
      .set({ status: 'completed', processedAt: new Date() })
      .where(eq(photoImportQueue.id, job.id));
  }

  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
  }> {
    const all = await db.select().from(photoImportQueue);
    const stats = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
    
    for (const row of all) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats]++;
      }
    }
    return stats;
  }

  async clearCompleted(): Promise<number> {
    const result = await db.delete(photoImportQueue)
      .where(
        eq(photoImportQueue.status, 'completed')
      );
    return result.changes || 0;
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isProcessing = false;
  }

  private async generateId(uri: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uri
    ).then(hash => hash.substring(0, 16));
  }
}

export default PhotoImportQueue;
