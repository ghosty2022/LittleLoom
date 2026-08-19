// src/database/schema.ts
// Drizzle ORM schema — fully aligned with Supabase tables

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/* ═══════════════════════════════════════════════════════════════════════════
   BABIES TABLE — matches Supabase `babies` table
   ═══════════════════════════════════════════════════════════════════════════ */

export const babies = sqliteTable('babies', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  dateOfBirth: text('date_of_birth').notNull(),
  gender: text('gender'), // 'male' | 'female' | 'other'
  bloodType: text('blood_type'),
  medicalNotes: text('medical_notes'),
  parent1Id: text('parent1_id'),
  parent2Id: text('parent2_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  syncStatus: text('sync_status').notNull().default('pending'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  activeIdx: index('idx_babies_active').on(table.isActive),
  parentIdx: index('idx_babies_parent').on(table.parent1Id),
  syncIdx: index('idx_babies_sync').on(table.syncStatus),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   TRACKER ENTRIES TABLE — unified entry storage
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
  // Legacy fields for backward compatibility (populated from data JSON)
  loggedBy: text('logged_by'),
  loggedByName: text('logged_by_name'),
  loggedByRole: text('logged_by_role'),
  notificationId: text('notification_id'),
  reminderScheduled: integer('reminder_scheduled', { mode: 'boolean' }).default(false),
  syncedAt: text('synced_at'),
  editedBy: text('edited_by'),
  editedAt: integer('edited_at'),
  // Soft delete
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  syncStatus: text('sync_status').notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  trackerIdx: index('idx_entries_tracker').on(table.trackerId),
  babyIdx: index('idx_entries_baby').on(table.babyId),
  timestampIdx: index('idx_entries_timestamp').on(table.timestamp),
  babyTrackerIdx: index('idx_entries_baby_tracker').on(table.babyId, table.trackerId),
  syncIdx: index('idx_entries_sync').on(table.syncStatus),
}));

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY MEMBERS TABLE — matches Supabase `family_members`
   ═══════════════════════════════════════════════════════════════════════════ */

export const familyMembers = sqliteTable('family_members', {
  id: text('id').primaryKey().notNull(),
  babyId: text('baby_id').notNull().references(() => babies.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  avatar: text('avatar'),
  role: text('role').notNull(), // 'parent1' | 'parent2' | 'guardian' | 'viewer'
  relationship: text('relationship').notNull().default('Family'),
  permissions: text('permissions', { mode: 'json' }).$type<Record<string, boolean>>().notNull().default(sql`'{}'`),
  addedAt: text('added_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  addedBy: text('added_by').notNull(),
  canBeRemoved: integer('can_be_removed', { mode: 'boolean' }).notNull().default(true),
  lastActive: text('last_active'),
  phoneNumber: text('phone_number'),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('pending'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  syncStatus: text('sync_status').notNull().default('pending'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  babyIdx: index('idx_family_baby').on(table.babyId),
  emailIdx: index('idx_family_email').on(table.email),
  roleIdx: index('idx_family_role').on(table.role),
  statusIdx: index('idx_family_status').on(table.status),
  babyRoleIdx: index('idx_family_baby_role').on(table.babyId, table.role),
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
   TYPE EXPORTS
   ═══════════════════════════════════════════════════════════════════════════ */

export type Baby = typeof babies.$inferSelect;
export type NewBaby = typeof babies.$inferInsert;

export type TrackerEntry = typeof trackerEntries.$inferSelect;
export type NewTrackerEntry = typeof trackerEntries.$inferInsert;

export type FamilyMember = typeof familyMembers.$inferSelect;
export type NewFamilyMember = typeof familyMembers.$inferInsert;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;