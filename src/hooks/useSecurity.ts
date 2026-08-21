// src/hooks/useSecurity.ts

import { useContext } from 'react';
import { SecurityContext } from '../context/SecurityContext';

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}

export default useSecurity;