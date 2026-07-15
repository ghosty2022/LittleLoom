// src/context/DatabaseContext.tsx
// Provides database access throughout the app

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getDatabase, PhotoRepository, TrackerRepository, BabyRepository } from '../database';
import { SQLiteDatabase } from 'expo-sqlite';

interface DatabaseContextType {
  db: SQLiteDatabase | null;
  isReady: boolean;
  error: Error | null;
  photoRepo: PhotoRepository;
  trackerRepo: TrackerRepository;
  babyRepo: BabyRepository;
  resetDatabase: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const photoRepo = React.useMemo(() => new PhotoRepository(), []);
  const trackerRepo = React.useMemo(() => new TrackerRepository(), []);
  const babyRepo = React.useMemo(() => new BabyRepository(), []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const database = await getDatabase();
        if (mounted) {
          setDb(database);
          setIsReady(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Database init failed'));
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const resetDatabase = useCallback(async () => {
    // Implementation from database/connection.ts
    const { resetDatabase: doReset } = await import('../database/connection');
    await doReset();
    setDb(null);
    setIsReady(false);
    // Re-init
    const database = await getDatabase();
    setDb(database);
    setIsReady(true);
  }, []);

  return (
    <DatabaseContext.Provider value={{
      db,
      isReady,
      error,
      photoRepo,
      trackerRepo,
      babyRepo,
      resetDatabase,
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error('useDatabase must be used within DatabaseProvider');
  return context;
};

export default DatabaseProvider;