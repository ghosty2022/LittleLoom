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

// ─── Schema + Data Migration Runner ───────────────────────────────────

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const database = getDb();
      await migrate(database, migrations);
      console.log('[DB] Schema migrations applied');

      // 2. Run AsyncStorage → SQLite data migration
      const { runOneTimeMigration } = await import('./dbHelpers');
      await runOneTimeMigration();
      console.log('[DB] Data migration complete');
    } catch (error) {
      console.error('[DB] Initialization failed:', error);
      initPromise = null; // Allow retry on next call
      throw error;
    }
  })();

  return initPromise;
}

// ─── Migration Hook (for React components to await if needed) ────────

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

// ─── Schema Export ────────────────────────────────────────────────────

export * from './schema';

// ─── Utility: Reset Database ──────────────────────────────────────────

export async function resetDatabase(): Promise<void> {
  const { deleteDatabaseSync } = require('expo-sqlite');
  deleteDatabaseSync(DB_NAME);
  dbInstance = null;
  expoDb = null;
  initPromise = null;
}

export default db;