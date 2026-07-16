// src/database/db.ts
// Drizzle ORM connection using expo-sqlite

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';
import migrations from './migrations/migrations';

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

// ─── CRITICAL: Raw table creation fallback ──────────────────────────
// If Drizzle migrate() fails to create tables (journal exists but tables don't),
// we create them manually using raw SQL.

const CORE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS babies (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    date_of_birth TEXT NOT NULL,
    gender TEXT,
    blood_type TEXT,
    allergies TEXT DEFAULT '[]',
    medical_notes TEXT,
    parent1_id TEXT,
    parent2_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    sync_status TEXT DEFAULT 'pending' NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL
  )`,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_status TEXT DEFAULT 'pending' NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY NOT NULL,
    baby_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL,
    relationship TEXT NOT NULL,
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
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY NOT NULL,
    uri TEXT NOT NULL UNIQUE,
    local_uri TEXT,
    thumbnail_uri TEXT,
    baby_id TEXT,
    date TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    type TEXT DEFAULT 'daily' NOT NULL,
    caption TEXT,
    is_favorite INTEGER DEFAULT 0 NOT NULL,
    is_private INTEGER DEFAULT 0 NOT NULL,
    is_screenshot INTEGER DEFAULT 0 NOT NULL,
    tags TEXT DEFAULT '[]',
    location TEXT,
    exif TEXT,
    mood TEXT,
    source TEXT DEFAULT 'camera' NOT NULL,
    backup_status TEXT DEFAULT 'pending' NOT NULL,
    faces_detected TEXT DEFAULT '[]',
    ai_tags TEXT DEFAULT '[]',
    blur_hash TEXT,
    folder TEXT,
    linked_entry_id TEXT,
    linked_entry_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sync_status TEXT DEFAULT 'pending' NOT NULL,
    is_deleted INTEGER DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS smart_albums (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    icon TEXT,
    gradient TEXT,
    filter_query TEXT,
    photo_count INTEGER DEFAULT 0 NOT NULL,
    cover_photo_id TEXT,
    is_system INTEGER DEFAULT 0 NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS album_photos (
    album_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (album_id, photo_id)
  )`,
  `CREATE TABLE IF NOT EXISTS photo_import_queue (
    id TEXT PRIMARY KEY NOT NULL,
    uri TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending' NOT NULL,
    priority INTEGER DEFAULT 0 NOT NULL,
    source_type TEXT NOT NULL,
    detected_baby_ids TEXT DEFAULT '[]',
    ai_confidence REAL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS scan_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TEXT,
    photos_found INTEGER DEFAULT 0 NOT NULL,
    photos_imported INTEGER DEFAULT 0 NOT NULL,
    photos_skipped INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'running' NOT NULL,
    error_message TEXT
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
  `CREATE INDEX IF NOT EXISTS idx_photos_baby ON photos (baby_id)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_date ON photos (date)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_timestamp ON photos (timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_type ON photos (type)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_favorite ON photos (is_favorite)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_private ON photos (is_private)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_source ON photos (source)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_backup ON photos (backup_status)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_sync ON photos (sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_photos_baby_date ON photos (baby_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_type ON smart_albums (type)`,
  `CREATE INDEX IF NOT EXISTS idx_albums_system ON smart_albums (is_system, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_queue_status ON photo_import_queue (status)`,
  `CREATE INDEX IF NOT EXISTS idx_queue_priority ON photo_import_queue (status, priority)`,
];

async function ensureCoreTablesExist(database: SQLiteDatabase): Promise<void> {
  // Check if app_settings table exists
  const checkResult = database.getAllSync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'"
  );
  
  if (checkResult.length > 0) {
    console.log('[DB] Core tables verified');
    return;
  }

  console.log('[DB] Core tables missing — creating with raw SQL fallback...');

  for (const sql of CORE_TABLES_SQL) {
    try {
      database.execSync(sql);
    } catch (err) {
      // Ignore "already exists" errors, throw others
      const msg = String(err);
      if (!msg.includes('already exists')) {
        console.warn(`[DB] Table creation warning: ${msg}`);
      }
    }
  }

  console.log('[DB] Core tables created via fallback');
}

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const database = getDb();
      
      // 1. Try Drizzle migrate (may fail silently or skip)
      try {
        await migrate(database, migrations);
        console.log('[DB] Schema migrations applied');
      } catch (migrateErr) {
        console.warn('[DB] Drizzle migrate failed, will use fallback:', migrateErr);
      }

      // 2. CRITICAL: Verify tables actually exist, create if missing
      if (expoDb) {
        ensureCoreTablesExist(expoDb);
      }

      // 3. Run AsyncStorage → SQLite data migration
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

export function useDatabaseMigrations() {
  const [status, setStatus] = useState({
    success: false,
    error: null as Error | null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    initializeDatabase()
      .then(() => {
        if (!cancelled) setStatus({ success: true, error: null, isLoading: false });
      })
      .catch((err) => {
        if (!cancelled) setStatus({ success: false, error: err, isLoading: false });
      });

    return () => { cancelled = true; };
  }, []);

  return status;
}

export * from './schema';

export async function resetDatabase(): Promise<void> {
  const { deleteDatabaseSync } = require('expo-sqlite');
  deleteDatabaseSync(DB_NAME);
  dbInstance = null;
  expoDb = null;
  initPromise = null;
}

export default db;