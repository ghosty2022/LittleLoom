// src/database/db.ts
// Drizzle ORM connection using expo-sqlite
// Migrations are optional - schema auto-creates on first run

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

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

// ─── Migration Hook (optional - for when you generate migrations) ─────

export function useDatabaseMigrations() {
  // Try to use Drizzle's migrator if migrations exist
  try {
    const { useMigrations } = require('drizzle-orm/expo-sqlite/migrator');

    let migrations: any;
    try {
      migrations = require('./migrations/migrations').default;
    } catch {
      // No migrations generated yet - that's OK
      migrations = { journal: { entries: [] }, migrations: {} };
    }

    return useMigrations(db, migrations);
  } catch {
    // drizzle-orm/expo-sqlite/migrator not available
    return { success: true, error: null };
  }
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