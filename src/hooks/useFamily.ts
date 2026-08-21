// src/hooks/useFamily.ts

import { useContext } from 'react';
import { FamilyContext } from '../context/FamilyContext';

export function useFamily() {
  const context = useContext(FamilyContext);
  if (context === undefined) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
}

export default useFamily;