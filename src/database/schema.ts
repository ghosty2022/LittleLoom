// src/database/schema.ts
// Drizzle ORM schema — models auto-generate tables

import { sqliteTable, text, integer, real, blob, index, uniqueIndex, foreignKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/* ═══════════════════════════════════════════════════════════════════════════
   BABIES TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const babies = sqliteTable('babies', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  dateOfBirth: text('date_of_birth').notNull(),
  gender: text('gender'), // 'male' | 'female' | 'other'
  bloodType: text('blood_type'),
  allergies: text('allergies', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  medicalNotes: text('medical_notes'),
  parent1Id: text('parent1_id'),
  parent2Id: text('parent2_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  syncStatus: text('sync_status').notNull().default('pending'),
}, (table) => ({
  activeIdx: index('idx_babies_active').on(table.isActive),
  parentIdx: index('idx_babies_parent').on(table.parent1Id),
  syncIdx: index('idx_babies_sync').on(table.syncStatus),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   PHOTOS TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey().notNull(),
  uri: text('uri').notNull().unique(),
  localUri: text('local_uri'),
  thumbnailUri: text('thumbnail_uri'),
  babyId: text('baby_id').references(() => babies.id, { onDelete: 'set null' }),
  date: text('date').notNull(),
  timestamp: integer('timestamp').notNull(),
  type: text('type').notNull().default('daily'),
  caption: text('caption'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
  isScreenshot: integer('is_screenshot', { mode: 'boolean' }).notNull().default(false),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  location: text('location'),
  exif: text('exif', { mode: 'json' }).$type<Record<string, any>>(),
  mood: text('mood'),
  source: text('source').notNull().default('camera'),
  backupStatus: text('backup_status').notNull().default('pending'),
  facesDetected: text('faces_detected', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  aiTags: text('ai_tags', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  blurHash: text('blur_hash'),
  folder: text('folder'),
  linkedEntryId: text('linked_entry_id'),
  linkedEntryType: text('linked_entry_type'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  syncStatus: text('sync_status').notNull().default('pending'),
}, (table) => ({
  babyIdx: index('idx_photos_baby').on(table.babyId),
  dateIdx: index('idx_photos_date').on(table.date),
  timestampIdx: index('idx_photos_timestamp').on(table.timestamp),
  typeIdx: index('idx_photos_type').on(table.type),
  favoriteIdx: index('idx_photos_favorite').on(table.isFavorite),
  privateIdx: index('idx_photos_private').on(table.isPrivate),
  sourceIdx: index('idx_photos_source').on(table.source),
  backupIdx: index('idx_photos_backup').on(table.backupStatus),
  syncIdx: index('idx_photos_sync').on(table.syncStatus),
  babyDateIdx: index('idx_photos_baby_date').on(table.babyId, table.date),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER ENTRIES TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const trackerEntries = sqliteTable('tracker_entries', {
  id: text('id').primaryKey().notNull(),
  trackerId: text('tracker_id').notNull(),
  babyId: text('baby_id').notNull().references(() => babies.id, { onDelete: 'cascade' }),
  timestamp: integer('timestamp').notNull(),
  title: text('title'),
  data: text('data', { mode: 'json' }).$type<Record<string, any>>().notNull().default(sql`'{}'`),
  notes: text('notes'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  photoUris: text('photo_uris', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  location: text('location'),
  mood: text('mood'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  syncStatus: text('sync_status').notNull().default('pending'),
}, (table) => ({
  trackerIdx: index('idx_entries_tracker').on(table.trackerId),
  babyIdx: index('idx_entries_baby').on(table.babyId),
  timestampIdx: index('idx_entries_timestamp').on(table.timestamp),
  babyTrackerIdx: index('idx_entries_baby_tracker').on(table.babyId, table.trackerId),
  syncIdx: index('idx_entries_sync').on(table.syncStatus),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   PHOTO IMPORT QUEUE TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const photoImportQueue = sqliteTable('photo_import_queue', {
  id: text('id').primaryKey().notNull(),
  uri: text('uri').notNull().unique(),
  status: text('status').notNull().default('pending'),
  priority: integer('priority').notNull().default(0),
  sourceType: text('source_type').notNull(),
  detectedBabyIds: text('detected_baby_ids', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  aiConfidence: real('ai_confidence'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  processedAt: text('processed_at'),
}, (table) => ({
  statusIdx: index('idx_queue_status').on(table.status),
  priorityIdx: index('idx_queue_priority').on(table.status, table.priority),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   SMART ALBUMS TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const smartAlbums = sqliteTable('smart_albums', {
  id: text('id').primaryKey().notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'smart' | 'baby' | 'activity' | 'date' | 'folder' | 'face'
  icon: text('icon'),
  gradient: text('gradient', { mode: 'json' }).$type<[string, string]>(),
  filterQuery: text('filter_query'),
  photoCount: integer('photo_count').notNull().default(0),
  coverPhotoId: text('cover_photo_id').references(() => photos.id, { onDelete: 'set null' }),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  typeIdx: index('idx_albums_type').on(table.type),
  systemIdx: index('idx_albums_system').on(table.isSystem, table.sortOrder),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM PHOTOS (MANY-TO-MANY)
   ═══════════════════════════════════════════════════════════════════════════ */

export const albumPhotos = sqliteTable('album_photos', {
  albumId: text('album_id').notNull().references(() => smartAlbums.id, { onDelete: 'cascade' }),
  photoId: text('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  addedAt: text('added_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: uniqueIndex('idx_album_photos_pk').on(table.albumId, table.photoId),
  photoIdx: index('idx_album_photos_photo').on(table.photoId),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   APP SETTINGS TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/* ═══════════════════════════════════════════════════════════════════════════
   SCAN SESSIONS TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const scanSessions = sqliteTable('scan_sessions', {
  id: text('id').primaryKey().notNull(),
  startedAt: text('started_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at'),
  photosFound: integer('photos_found').notNull().default(0),
  photosImported: integer('photos_imported').notNull().default(0),
  photosSkipped: integer('photos_skipped').notNull().default(0),
  status: text('status').notNull().default('running'),
  errorMessage: text('error_message'),
});

/* ═══════════════════════════════════════════════════════════════════════════
   TYPE EXPORTS (inferred from schema)
   ═══════════════════════════════════════════════════════════════════════════ */

export type Baby = typeof babies.$inferSelect;
export type NewBaby = typeof babies.$inferInsert;

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;

export type TrackerEntry = typeof trackerEntries.$inferSelect;
export type NewTrackerEntry = typeof trackerEntries.$inferInsert;

export type PhotoImportJob = typeof photoImportQueue.$inferSelect;
export type NewPhotoImportJob = typeof photoImportQueue.$inferInsert;

export type SmartAlbum = typeof smartAlbums.$inferSelect;
export type NewSmartAlbum = typeof smartAlbums.$inferInsert;

export type AlbumPhoto = typeof albumPhotos.$inferSelect;
export type NewAlbumPhoto = typeof albumPhotos.$inferInsert;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

export type ScanSession = typeof scanSessions.$inferSelect;
export type NewScanSession = typeof scanSessions.$inferInsert;
