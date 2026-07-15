// src/context/DatabaseContext.tsx
// Provides database access throughout the app

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../database/db';
import * as schema from '../database/schema';

type DatabaseContextType = {
  isReady: boolean;
  error: Error | null;
  schema: typeof schema;
};

const DatabaseContext = createContext<DatabaseContextType>({
  isReady: false,
  error: null,
  schema,
});

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Test connection
        await db.select().from(schema.appSettings).limit(1);
        
        if (mounted) {
          setIsReady(true);
        }
      } catch (err) {
        console.log('[DB] First run - tables will be created by Drizzle');
        if (mounted) {
          setIsReady(true);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <DatabaseContext.Provider value={{ isReady, error, schema }}>
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
