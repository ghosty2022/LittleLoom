// src/hooks/useUser.ts
// Single source of truth — re-uses the fallback defined in useSafeContexts
// so the two cannot drift.

import { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { useSafeUser } from './useSafeContexts';

export const useUser = () => {
  try {
    const context = useContext(UserContext);
    if (!context) {
      // Delegate to the canonical safe wrapper's fallback
      return useSafeUser();
    }
    return context;
  } catch {
    return useSafeUser();
  }
};

export default useUser;