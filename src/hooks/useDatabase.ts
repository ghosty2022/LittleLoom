// src/hooks/useDatabase.ts
// Safe wrapper — falls back to a no-op shape when the provider isn't
// mounted yet, instead of crashing the tree.

import { useContext } from 'react';
import { DatabaseContext } from '../context/DatabaseContext';

export function useDatabase() {
  try {
    const context = useContext(DatabaseContext);
    if (!context) {
      return {
        isReady: false,
        error: null,
        retry: () => {},
        isOnline: true,
        userId: null,
        session: null,
        refreshSession: async () => {},
        signOut: async () => {},
      } as any;
    }
    return context;
  } catch {
    return {
      isReady: false,
      error: null,
      retry: () => {},
      isOnline: true,
      userId: null,
      session: null,
      refreshSession: async () => {},
      signOut: async () => {},
    } as any;
  }
}

export default useDatabase;