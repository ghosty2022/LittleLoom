// src/database/db.ts
// Drizzle ORM connection using expo-sqlite
// Uses proper Drizzle migrations for schema + custom data migration

import { useState, useEffect } from 'react';
import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';
import migrations from './migrations/migrations';

// ─── Database Setup ───────────────────────────────────────────────────

const DB_NAME = 'littleloom.db';
let expoDb: SQLiteDatabase;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getExpoDb(): SQLiteDatabase {
  if (!expoDb) {
    expoDb = openDatabaseSync(DB_NAME);
  }
  return expoDb;
}

export function getDb() {
  if (!dbInstance) {
    const database = getExpoDb();
    dbInstance = drizzle(database, { schema });
  }
  return dbInstance;
}

// ─── Main Export ─────────────────────────────────────────────────────

export const db = getDb();

// ─── Schema + Data Migration Runner ───────────────────────────────────

let initPromise: Promise<void> | null = null;

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Run Drizzle schema migrations (creates/updates all tables)
      await migrate(db, migrations);
      console.log('[DB] Schema migrations applied');

      // 2. Run AsyncStorage → SQLite data migration
      const { runOneTimeMigration } = await import('./dbHelpers');
      await runOneTimeMigration();
    } catch (error) {
      console.error('[DB] Initialization failed:', error);
      throw error;
    }
  })();

  return initPromise;
}

// Fire on module load — blocks until migrations complete
initializeDatabase().catch(console.error);

// ─── Migration Hook (for React components to await if needed) ────────

export function useDatabaseMigrations() {
  const [status, setStatus] = useState({ success: false, error: null as Error | null });

  useEffect(() => {
    initializeDatabase()
      .then(() => setStatus({ success: true, error: null }))
      .catch((err) => setStatus({ success: false, error: err }));
  }, []);

  return status;
}

// ─── Schema Export ────────────────────────────────────────────────────

export * from './schema';

// ─── Utility: Reset Database ──────────────────────────────────────────

export async function resetDatabase(): Promise<void> {
  const { deleteDatabaseSync } = require('expo-sqlite');
  deleteDatabaseSync(DB_NAME);
  dbInstance = null;
  expoDb = undefined as any;
}

export default db;