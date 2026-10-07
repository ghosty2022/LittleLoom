


import { useContext } from 'react';
import { BabyContext } from '../context/BabyContext';
import { useSafeBaby } from './useSafeContexts';

export function useBaby() {
  try {
    const context = useContext(BabyContext);
    if (!context) return useSafeBaby() as any;
    return context;
  } catch {
    return useSafeBaby() as any;
  }
}

export default useBaby;