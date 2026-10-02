// src/hooks/useAuth.ts

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSafeAuth } from './useSafeContexts';

// Safe wrapper — never throws. Delegates to the canonical fallback in
// useSafeContexts when the provider isn't mounted. This prevents
// "must be used within AuthProvider" crashes during early bootstrap.
export function useAuth() {
  try {
    const context = useContext(AuthContext);
    if (!context) return useSafeAuth() as any;
    return context;
  } catch {
    return useSafeAuth() as any;
  }
}

export default useAuth;