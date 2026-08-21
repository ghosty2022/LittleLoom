// src/hooks/useDatabase.ts

import { useContext } from 'react';
import { DatabaseContext } from '../context/DatabaseContext';

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export default useDatabase;