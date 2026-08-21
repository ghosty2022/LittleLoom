// src/hooks/useActivity.ts
// Use the ActivityContext directly

import { useContext } from 'react';
import { ActivityContext } from '../context/ActivityContext';

export function useActivity() {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}

export default useActivity;