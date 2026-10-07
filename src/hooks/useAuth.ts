

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useSafeAuth } from './useSafeContexts';




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