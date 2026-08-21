// src/hooks/useBaby.ts
// Use BabyContext directly

import { useContext } from 'react';
import { BabyContext } from '../context/BabyContext';

export function useBaby() {
  const context = useContext(BabyContext);
  if (context === undefined) {
    throw new Error('useBaby must be used within a BabyProvider');
  }
  return context;
}

export default useBaby;