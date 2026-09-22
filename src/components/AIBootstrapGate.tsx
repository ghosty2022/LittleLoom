// src/components/AIBootstrapGate.tsx
import React, { useEffect } from 'react';
import { useBaby } from '../context/BabyContext';
import { bootstrapAI } from '../services/ai/bootstrap';

/**
 * Mounts under <BabyProvider>. Watches `currentBaby` and
 * kicks off AI warm-up whenever the active baby changes.
 */
export const AIBootstrapGate: React.FC = () => {
  const { currentBaby } = useBaby();

  useEffect(() => {
    if (currentBaby?.id) {
      bootstrapAI(currentBaby.id).catch(() => {});
    }
  }, [currentBaby?.id]);

  return null;
};