// src/database/db.ts
// Drizzle ORM connection with Expo SQLite + Supabase sync

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';

const DB_NAME = 'littleloom.db';

let expoDb: SQLiteDatabase | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let initPromise: Promise<void> | null = null;

export function getDb() {
  if (!dbInstance) {
    expoDb = openDatabaseSync(DB_NAME);
    dbInstance = drizzle(expoDb, { schema });
  }
  return dbInstance;
}

export const db = getDb();

/* ─── TABLE CREATION FALLBACK ──────────────────────────────────────────
   Ensures tables exist even if Drizzle migrations fail
   ──────────────────────────────────────────────────────────────────────── */

const CORE_TABLES_SQL = [
  // App Settings
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,

  // Babies
  `CREATE TABLE IF NOT EXISTS babies (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    date_of_birth TEXT NOT NULL,
    gender TEXT,
    blood_type TEXT,
    medical_notes TEXT,
    parent1_id TEXT,
    parent2_id TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_status TEXT DEFAULT 'pending' NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL
  )`,

  // Tracker Entries
  `CREATE TABLE IF NOT EXISTS tracker_entries (
    id TEXT PRIMARY KEY NOT NULL,
    tracker_id TEXT NOT NULL,
    baby_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    title TEXT,
    data TEXT DEFAULT '{}' NOT NULL,
    notes TEXT,
    tags TEXT DEFAULT '[]',
    photo_uris TEXT DEFAULT '[]',
    location TEXT,
    mood TEXT,
    logged_by TEXT,
    logged_by_name TEXT,
    logged_by_role TEXT,
    notification_id TEXT,
    reminder_scheduled INTEGER DEFAULT 0,
    synced_at TEXT,
    edited_by TEXT,
    edited_at INTEGER,
    is_deleted INTEGER DEFAULT 0 NOT NULL,
    sync_status TEXT DEFAULT 'pending' NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,

  // Family Members
  `CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY NOT NULL,
    baby_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'Family',
    permissions TEXT DEFAULT '{}' NOT NULL,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    added_by TEXT NOT NULL,
    can_be_removed INTEGER DEFAULT 1 NOT NULL,
    last_active TEXT,
    phone_number TEXT,
    notifications_enabled INTEGER DEFAULT 1 NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_status TEXT DEFAULT 'pending' NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_babies_active ON babies (is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_babies_parent ON babies (parent1_id)`,
  `CREATE INDEX IF NOT EXISTS idx_babies_sync ON babies (sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_tracker ON tracker_entries (tracker_id)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_baby ON tracker_entries (baby_id)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON tracker_entries (timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_baby_tracker ON tracker_entries (baby_id, tracker_id)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_sync ON tracker_entries (sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_family_baby ON family_members (baby_id)`,
  `CREATE INDEX IF NOT EXISTS idx_family_email ON family_members (email)`,
  `CREATE INDEX IF NOT EXISTS idx_family_role ON family_members (role)`,
  `CREATE INDEX IF NOT EXISTS idx_family_status ON family_members (status)`,
  `CREATE INDEX IF NOT EXISTS idx_family_baby_role ON family_members (baby_id, role)`,
];

async function ensureCoreTablesExist(database: SQLiteDatabase): Promise<void> {
  const checkResult = database.getAllSync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'"
  );

  if (checkResult.length > 0) {
    return;
  }

  console.log('[DB] Core tables missing — creating with raw SQL fallback...');

  for (const sql of CORE_TABLES_SQL) {
    try {
      database.execSync(sql);
    } catch (err) {
      const msg = String(err);
      if (!msg.includes('already exists')) {
        console.warn(`[DB] Table creation warning: ${msg}`);
      }
    }
  }

  console.log('[DB] Core tables created via fallback');
}

/* ─── DATABASE INITIALIZATION ───────────────────────────────────────── */

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const database = getDb();

      // 1. Try Drizzle migrate
      try {
        // migrations imported from ./migrations/migrations
        const migrations = await import('./migrations/migrations');
        await migrate(database, migrations.default || migrations);
        console.log('[DB] Schema migrations applied');
      } catch (migrateErr) {
        console.warn('[DB] Drizzle migrate failed, using fallback:', migrateErr);
      }

      // 2. Ensure tables exist
      if (expoDb) {
        await ensureCoreTablesExist(expoDb);
      }

      // 3. Run data migration
      const { runOneTimeMigration } = await import('./dbHelpers');
      await runOneTimeMigration();
      console.log('[DB] Data migration complete');
    } catch (error) {
      console.error('[DB] Initialization failed:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

export * from './schema';