import { useMemo } from 'react';
import { WHO_BOY_LMS, WHO_GIRL_LMS, zScoreToValue } from './useWHOGrowthCalculator';

export interface SuggestionRange {
  low: number;
  median: number;
  high: number;
  unit: string;
}

export function useMeasurementSuggestions(
  gender: 'boy' | 'girl' | 'other' | null | undefined,
  ageMonths: number | null
) {
  return useMemo(() => {
    if (!gender || gender === 'other' || ageMonths === null || ageMonths < 0 || ageMonths > 24) return null;

    const table = gender === 'boy' ? WHO_BOY_LMS : WHO_GIRL_LMS;
    const clampedAge = Math.max(0, Math.min(24, Math.round(ageMonths)));
    const row = table[clampedAge];
    if (!row) return null;

    const toRange = (lms: { L: number; M: number; S: number }, unit: string): SuggestionRange => ({
      low: Math.round(zScoreToValue(-2, lms) * 100) / 100,
      median: Math.round(zScoreToValue(0, lms) * 100) / 100,
      high: Math.round(zScoreToValue(2, lms) * 100) / 100,
      unit,
    });

    return {
      weight: toRange(row.weight, 'kg'),
      height: toRange(row.height, 'cm'),
      head: toRange(row.head, 'cm'),
    };
  }, [gender, ageMonths]);
}

export function getAgeInMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  if (isNaN(birth.getTime())) return 0;
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
}