// src/services/PhotoImportQueue.ts
// Manages background photo import with SQLite queue

import { PhotoRepository, Photo } from '../database';
import { PhotoScanner, ScannedPhoto } from './PhotoScanner';
import { PhotoClassifier, ClassificationResult } from './PhotoClassifier';
import * as Crypto from 'expo-crypto';

export interface ImportJob {
  id: string;
  uri: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  priority: number;
  sourceType: string;
  detectedBabyIds: string[];
  aiConfidence: number;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  processedAt?: string;
}

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

  /* ─── Queue photos for import ───────────────────────────────────── */
  async queuePhotos(photos: ScannedPhoto[], options: ImportOptions = {}): Promise<number> {
    const repo = new PhotoRepository();
    const now = new Date().toISOString();
    let queued = 0;

    for (const photo of photos) {
      // Check if already exists
      if (options.skipExisting !== false) {
        const exists = await repo.existsByUri(photo.uri);
        if (exists) continue;
      }

      // Generate ID
      const id = await this.generateId(photo.uri);

      // Classify if enabled
      let classification: ClassificationResult | null = null;
      if (options.autoClassify !== false) {
        classification = await this.classifier.classify(photo);
      }

      // Add to queue
      await repo.query(
        `INSERT OR IGNORE INTO "photo_import_queue" 
         (id, uri, status, priority, sourceType, detectedBabyIds, aiConfidence, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          photo.uri,
          'pending',
          classification?.confidence || 50,
          options.source || 'gallery_scan',
          JSON.stringify(classification?.suggestedBabyIds || []),
          classification?.confidence || 0,
          now,
        ]
      );

      queued++;
    }

    return queued;
  }

  /* ─── Process queue ───────────────────────────────────────────── */
  async processQueue(options: ImportOptions = {}, onProgress?: (current: number, total: number) => void): Promise<{
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

    const repo = new PhotoRepository();
    const results = { processed: 0, imported: 0, skipped: 0, failed: 0 };

    try {
      // Get pending jobs
      const jobs = await repo.query<ImportJob>(
        `SELECT * FROM "photo_import_queue" 
         WHERE status = 'pending' 
         ORDER BY priority DESC, createdAt ASC 
         LIMIT 50`
      );

      const total = jobs.length;

      for (let i = 0; i < jobs.length; i++) {
        if (this.abortController.signal.aborted) break;

        const job = jobs[i];
        
        try {
          await this.processJob(job, options);
          results.imported++;
        } catch (err) {
          if (job.retryCount < 3) {
            await repo.query(
              `UPDATE "photo_import_queue" 
               SET status = 'pending', retryCount = retryCount + 1, errorMessage = ?
               WHERE id = ?`,
              [err instanceof Error ? err.message : 'Unknown error', job.id]
            );
          } else {
            await repo.query(
              `UPDATE "photo_import_queue" 
               SET status = 'failed', errorMessage = ?, processedAt = ?
               WHERE id = ?`,
              [err instanceof Error ? err.message : 'Unknown error', new Date().toISOString(), job.id]
            );
            results.failed++;
          }
        }

        results.processed++;
        
        if (onProgress) {
          onProgress(i + 1, total);
        }

        // Yield every 3 items
        if (i % 3 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }

    } finally {
      this.isProcessing = false;
    }

    return results;
  }

  /* ─── Process single job ──────────────────────────────────────── */
  private async processJob(job: ImportJob, options: ImportOptions): Promise<void> {
    const repo = new PhotoRepository();
    const now = new Date().toISOString();

    // Mark as processing
    await repo.query(
      `UPDATE "photo_import_queue" SET status = 'processing' WHERE id = ?`,
      [job.id]
    );

    // Check if photo already in main table
    const exists = await repo.existsByUri(job.uri);
    if (exists) {
      await repo.query(
        `UPDATE "photo_import_queue" SET status = 'skipped', processedAt = ? WHERE id = ?`,
        [now, job.id]
      );
      return;
    }

    // Create photo record
    const photo: Partial<Photo> = {
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
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await repo.insert(photo);

    // Mark as completed
    await repo.query(
      `UPDATE "photo_import_queue" SET status = 'completed', processedAt = ? WHERE id = ?`,
      [now, job.id]
    );
  }

  /* ─── Get queue stats ─────────────────────────────────────────── */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
  }> {
    const repo = new PhotoRepository();
    const results = await repo.query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM "photo_import_queue" GROUP BY status`
    );

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
    for (const row of results) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }
    return stats;
  }

  /* ─── Clear completed jobs ────────────────────────────────────── */
  async clearCompleted(): Promise<number> {
    const repo = new PhotoRepository();
    const result = await repo.query(
      `DELETE FROM "photo_import_queue" WHERE status IN ('completed', 'skipped')`
    );
    return result.length;
  }

  /* ─── Cancel processing ─────────────────────────────────────────── */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isProcessing = false;
  }

  /* ─── Helper ───────────────────────────────────────────────────── */
  private async generateId(uri: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      uri
    ).then(hash => hash.substring(0, 16));
  }
}

export default PhotoImportQueue;