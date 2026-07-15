// src/hooks/useDatabase.ts
import { useDatabase as useDbContext } from '../context/DatabaseContext';

export function useDatabase() {
  return useDbContext();
}

export default useDatabase;