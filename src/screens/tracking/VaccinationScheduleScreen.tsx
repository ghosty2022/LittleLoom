import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { , Alert, Animated, Button, Dimensions, Modal, Platform, RefreshControl, ScrollView, Settings, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInDays, differenceInMonths, addDays, parseISO, isValid, isBefore, isAfter, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBaby, BabyProfile } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BLUR_INTENSITY = Platform.OS === 'ios' ? 80 : 60;

/* ═══════════════════════════════════════════════════════════════════════════
   WHO/CDC-BASED VACCINATION SCHEDULE DATA
   Sources: WHO Immunization Routine Tables, CDC 2026 Childhood Schedule,
   AAP Recommended Childhood Immunization Schedule 2026
   ═══════════════════════════════════════════════════════════════════════════ */

export interface VaccineDose {
  id: string;
  vaccineId: string;
  vaccineName: string;
  shortName: string;
  doseNumber: number;
  totalDoses: number;
  recommendedAgeDays: number;
  recommendedAgeLabel: string;
  dueDate: string; // ISO date
  completedDate?: string;
  status: 'completed' | 'due' | 'overdue' | 'upcoming' | 'scheduled';
  category: 'birth' | 'infant' | 'toddler' | 'preschool' | 'adolescent';
  description: string;
  sideEffects: string[];
  contraindications: string[];
  route: string;
  notes?: string;
  recordedBy?: string;
}

export interface VaccineSeries {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: 'core' | 'recommended' | 'high_risk' | 'travel';
  doses: Omit<VaccineDose, 'id' | 'status' | 'dueDate'>[];
}

/* ── WHO/CDC Standard Vaccination Series ── */
const VACCINE_SERIES: VaccineSeries[] = [
  {
    id: 'hepb',
    name: 'Hepatitis B',
    shortName: 'HepB',
    description: 'Protects against hepatitis B virus infection',
    category: 'core',
    doses: [
      { vaccineId: 'hepb', vaccineName: 'Hepatitis B', shortName: 'HepB', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 0, recommendedAgeLabel: 'Birth', description: 'Monovalent HepB within 24 hours of birth', sideEffects: ['Soreness at injection site', 'Low fever'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hepb', vaccineName: 'Hepatitis B', shortName: 'HepB', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 30, recommendedAgeLabel: '1–2 months', description: 'Second dose 1–2 months after birth dose', sideEffects: ['Soreness', 'Mild fever'], contraindications: ['Severe allergic reaction to yeast'], route: 'IM' },
      { vaccineId: 'hepb', vaccineName: 'Hepatitis B', shortName: 'HepB', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 180, recommendedAgeLabel: '6–18 months', description: 'Final dose, not earlier than 24 weeks of age', sideEffects: ['Soreness', 'Fatigue'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'dtap',
    name: 'DTaP (Diphtheria, Tetanus, Pertussis)',
    shortName: 'DTaP',
    description: 'Protects against diphtheria, tetanus, and whooping cough',
    category: 'core',
    doses: [
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 1, totalDoses: 5, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of DTaP series', sideEffects: ['Fever', 'Fussiness', 'Redness at site'], contraindications: ['Encephalopathy within 7 days of previous dose'], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 2, totalDoses: 5, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Fever', 'Swelling'], contraindications: [], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 3, totalDoses: 5, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose, minimum 4 weeks after dose 2', sideEffects: ['Fever', 'Irritability'], contraindications: [], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 4, totalDoses: 5, recommendedAgeDays: 450, recommendedAgeLabel: '15–18 months', description: 'Fourth dose, minimum 6 months after dose 3', sideEffects: ['Local reaction', 'Mild fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 5, totalDoses: 5, recommendedAgeDays: 1460, recommendedAgeLabel: '4–6 years', description: 'Fifth dose before school entry', sideEffects: ['Arm soreness', 'Headache'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'ipv',
    name: 'Polio (IPV)',
    shortName: 'IPV',
    description: 'Inactivated poliovirus vaccine',
    category: 'core',
    doses: [
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 1, totalDoses: 4, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of IPV series', sideEffects: ['Soreness', 'Redness'], contraindications: ['Severe allergic reaction to neomycin/streptomycin'], route: 'IM or SC' },
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 2, totalDoses: 4, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Soreness'], contraindications: [], route: 'IM or SC' },
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 3, totalDoses: 4, recommendedAgeDays: 180, recommendedAgeLabel: '6–18 months', description: 'Third dose, may be given at 6–18 months', sideEffects: ['Soreness'], contraindications: [], route: 'IM or SC' },
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 4, totalDoses: 4, recommendedAgeDays: 1460, recommendedAgeLabel: '4–6 years', description: 'Fourth dose before school entry', sideEffects: ['Soreness'], contraindications: [], route: 'IM or SC' },
    ],
  },
  {
    id: 'hib',
    name: 'Hib (Haemophilus influenzae type b)',
    shortName: 'Hib',
    description: 'Protects against Hib disease (meningitis, pneumonia)',
    category: 'core',
    doses: [
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 1, totalDoses: 4, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of Hib series', sideEffects: ['Fever', 'Irritability'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 2, totalDoses: 4, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 3, totalDoses: 4, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose (may vary by brand)', sideEffects: ['Fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 4, totalDoses: 4, recommendedAgeDays: 365, recommendedAgeLabel: '12–15 months', description: 'Booster dose, minimum 8 weeks after dose 3', sideEffects: ['Local reaction'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'pcv',
    name: 'PCV (Pneumococcal Conjugate)',
    shortName: 'PCV',
    description: 'Protects against pneumococcal disease',
    category: 'core',
    doses: [
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 1, totalDoses: 4, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of PCV series', sideEffects: ['Fever', 'Irritability', 'Decreased appetite'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 2, totalDoses: 4, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Fever', 'Fussiness'], contraindications: [], route: 'IM' },
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 3, totalDoses: 4, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose, minimum 4 weeks after dose 2', sideEffects: ['Fever', 'Local reaction'], contraindications: [], route: 'IM' },
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 4, totalDoses: 4, recommendedAgeDays: 365, recommendedAgeLabel: '12–15 months', description: 'Booster dose, minimum 8 weeks after dose 3', sideEffects: ['Fever', 'Local reaction'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'rv',
    name: 'Rotavirus',
    shortName: 'RV',
    description: 'Oral vaccine protecting against rotavirus gastroenteritis',
    category: 'core',
    doses: [
      { vaccineId: 'rv', vaccineName: 'Rotavirus', shortName: 'RV', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First oral dose (RV1 or RV5)', sideEffects: ['Mild diarrhea', 'Vomiting', 'Irritability'], contraindications: ['Severe combined immunodeficiency', 'History of intussusception'], route: 'Oral' },
      { vaccineId: 'rv', vaccineName: 'Rotavirus', shortName: 'RV', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second oral dose, minimum 4 weeks after dose 1', sideEffects: ['Diarrhea', 'Fussiness'], contraindications: [], route: 'Oral' },
      { vaccineId: 'rv', vaccineName: 'Rotavirus', shortName: 'RV', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose (RV5 only), minimum 4 weeks after dose 2', sideEffects: ['Diarrhea'], contraindications: [], route: 'Oral' },
    ],
  },
  {
    id: 'mmr',
    name: 'MMR (Measles, Mumps, Rubella)',
    shortName: 'MMR',
    description: 'Protects against measles, mumps, and rubella',
    category: 'core',
    doses: [
      { vaccineId: 'mmr', vaccineName: 'MMR', shortName: 'MMR', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 365, recommendedAgeLabel: '12–15 months', description: 'First dose at 12–15 months', sideEffects: ['Fever', 'Mild rash', 'Swelling of glands'], contraindications: ['Pregnancy', 'Severe immunodeficiency'], route: 'SC' },
      { vaccineId: 'mmr', vaccineName: 'MMR', shortName: 'MMR', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 1460, recommendedAgeLabel: '4–6 years', description: 'Second dose before school entry', sideEffects: ['Fever', 'Rash'], contraindications: [], route: 'SC' },
    ],
  },
  {
    id: 'varicella',
    name: 'Varicella (Chickenpox)',
    shortName: 'VAR',
    description: 'Protects against chickenpox',
    category: 'core',
    doses: [
      { vaccineId: 'varicella', vaccineName: 'Varicella', shortName: 'VAR', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 365, recommendedAgeLabel: '12–15 months', description: 'First dose at 12–15 months', sideEffects: ['Soreness', 'Mild rash', 'Fever'], contraindications: ['Severe immunodeficiency', 'Pregnancy'], route: 'SC' },
      { vaccineId: 'varicella', vaccineName: 'Varicella', shortName: 'VAR', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 1460, recommendedAgeLabel: '4–6 years', description: 'Second dose before school entry', sideEffects: ['Soreness', 'Mild fever'], contraindications: [], route: 'SC' },
    ],
  },
  {
    id: 'hepa',
    name: 'Hepatitis A',
    shortName: 'HepA',
    description: 'Protects against hepatitis A virus',
    category: 'core',
    doses: [
      { vaccineId: 'hepa', vaccineName: 'Hepatitis A', shortName: 'HepA', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 365, recommendedAgeLabel: '12–23 months', description: 'First dose at 12–23 months', sideEffects: ['Soreness', 'Headache', 'Loss of appetite'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hepa', vaccineName: 'Hepatitis A', shortName: 'HepA', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 547, recommendedAgeLabel: '6 months after dose 1', description: 'Second dose, minimum 6 months after dose 1', sideEffects: ['Soreness', 'Fatigue'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'menb',
    name: 'Meningococcal B',
    shortName: 'MenB',
    description: 'Protects against meningococcal B disease',
    category: 'recommended',
    doses: [
      { vaccineId: 'menb', vaccineName: 'Meningococcal B', shortName: 'MenB', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 56, recommendedAgeLabel: '8 weeks', description: 'First dose at 8 weeks (high risk) or 10 years', sideEffects: ['Soreness', 'Fever', 'Fatigue'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'menb', vaccineName: 'Meningococcal B', shortName: 'MenB', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 84, recommendedAgeLabel: '12 weeks', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Soreness', 'Headache'], contraindications: [], route: 'IM' },
      { vaccineId: 'menb', vaccineName: 'Meningococcal B', shortName: 'MenB', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 365, recommendedAgeLabel: '12–15 months', description: 'Booster dose at 12–15 months', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'menacwy',
    name: 'Meningococcal ACWY',
    shortName: 'MenACWY',
    description: 'Protects against meningococcal A, C, W, Y',
    category: 'recommended',
    doses: [
      { vaccineId: 'menacwy', vaccineName: 'Meningococcal ACWY', shortName: 'MenACWY', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 3285, recommendedAgeLabel: '11–12 years', description: 'First dose at 11–12 years', sideEffects: ['Soreness', 'Headache', 'Fatigue'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'menacwy', vaccineName: 'Meningococcal ACWY', shortName: 'MenACWY', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 5840, recommendedAgeLabel: '16 years', description: 'Booster at 16 years', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'tdap',
    name: 'Tdap (Tetanus, Diphtheria, Pertussis)',
    shortName: 'Tdap',
    description: 'Adolescent/adult booster for tetanus, diphtheria, pertussis',
    category: 'recommended',
    doses: [
      { vaccineId: 'tdap', vaccineName: 'Tdap', shortName: 'Tdap', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 3285, recommendedAgeLabel: '11–12 years', description: 'Single dose at 11–12 years', sideEffects: ['Soreness', 'Fever', 'Headache'], contraindications: ['Encephalopathy within 7 days of previous dose'], route: 'IM' },
    ],
  },
  {
    id: 'hpv',
    name: 'HPV (Human Papillomavirus)',
    shortName: 'HPV',
    description: 'Protects against HPV-related cancers',
    category: 'recommended',
    doses: [
      { vaccineId: 'hpv', vaccineName: 'HPV', shortName: 'HPV', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 3285, recommendedAgeLabel: '11–12 years', description: 'First dose at 11–12 years (can start at 9)', sideEffects: ['Soreness', 'Swelling', 'Headache'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hpv', vaccineName: 'HPV', shortName: 'HPV', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 3468, recommendedAgeLabel: '6–12 months after dose 1', description: 'Second dose, minimum 5 months after dose 1', sideEffects: ['Soreness', 'Headache'], contraindications: [], route: 'IM' },
      { vaccineId: 'hpv', vaccineName: 'HPV', shortName: 'HPV', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 3833, recommendedAgeLabel: '6 months after dose 1', description: 'Third dose (if started at age 15+ or immunocompromised)', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'flu',
    name: 'Influenza (Flu)',
    shortName: 'Flu',
    description: 'Annual flu vaccination',
    category: 'recommended',
    doses: [
      { vaccineId: 'flu', vaccineName: 'Influenza', shortName: 'Flu', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 180, recommendedAgeLabel: '6 months+', description: 'First dose at 6 months (2 doses first season)', sideEffects: ['Soreness', 'Low fever', 'Aches'], contraindications: ['Severe allergic reaction to eggs', 'Guillain-Barré syndrome'], route: 'IM' },
      { vaccineId: 'flu', vaccineName: 'Influenza', shortName: 'Flu', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 210, recommendedAgeLabel: '4 weeks after dose 1', description: 'Second dose for first season only', sideEffects: ['Soreness', 'Mild fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'covid',
    name: 'COVID-19',
    shortName: 'COVID',
    description: 'COVID-19 vaccination',
    category: 'recommended',
    doses: [
      { vaccineId: 'covid', vaccineName: 'COVID-19', shortName: 'COVID', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 180, recommendedAgeLabel: '6 months+', description: 'First dose at 6–23 months', sideEffects: ['Soreness', 'Fever', 'Fatigue'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'covid', vaccineName: 'COVID-19', shortName: 'COVID', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 210, recommendedAgeLabel: '3–8 weeks after dose 1', description: 'Second dose', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'covid', vaccineName: 'COVID-19', shortName: 'COVID', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 540, recommendedAgeLabel: '8 weeks after dose 2', description: 'Third dose (if indicated)', sideEffects: ['Soreness', 'Fatigue'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'bcg',
    name: 'BCG (Tuberculosis)',
    shortName: 'BCG',
    description: 'Protects against tuberculosis (where endemic)',
    category: 'high_risk',
    doses: [
      { vaccineId: 'bcg', vaccineName: 'BCG', shortName: 'BCG', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 0, recommendedAgeLabel: 'Birth', description: 'Single dose at birth in endemic areas', sideEffects: ['Small ulcer at site', 'Scar formation'], contraindications: ['Severe immunodeficiency', 'HIV in high-resource settings'], route: 'ID' },
    ],
  },
  {
    id: 'typhoid',
    name: 'Typhoid',
    shortName: 'Typhoid',
    description: 'Protects against typhoid fever',
    category: 'travel',
    doses: [
      { vaccineId: 'typhoid', vaccineName: 'Typhoid', shortName: 'Typhoid', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 730, recommendedAgeLabel: '2 years+', description: 'Single dose for travel to endemic areas', sideEffects: ['Fever', 'Headache', 'Redness'], contraindications: ['Severe immunodeficiency'], route: 'IM or Oral' },
    ],
  },
  {
    id: 'yellow_fever',
    name: 'Yellow Fever',
    shortName: 'YF',
    description: 'Required for travel to certain countries',
    category: 'travel',
    doses: [
      { vaccineId: 'yellow_fever', vaccineName: 'Yellow Fever', shortName: 'YF', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 270, recommendedAgeLabel: '9 months+', description: 'Single dose for travel to endemic areas', sideEffects: ['Fever', 'Headache', 'Muscle pain'], contraindications: ['Severe immunodeficiency', 'Egg allergy'], route: 'SC' },
    ],
  },
  {
    id: 'japanese_encephalitis',
    name: 'Japanese Encephalitis',
    shortName: 'JE',
    description: 'For travel to endemic areas in Asia',
    category: 'travel',
    doses: [
      { vaccineId: 'je', vaccineName: 'Japanese Encephalitis', shortName: 'JE', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 60, recommendedAgeLabel: '2 months+', description: 'First dose for travel to endemic areas', sideEffects: ['Soreness', 'Fever', 'Headache'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'je', vaccineName: 'Japanese Encephalitis', shortName: 'JE', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 88, recommendedAgeLabel: '4 weeks after dose 1', description: 'Second dose', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
];

const STORAGE_KEY = '@littleloom_vaccination_records';

/* ── Safe date parsing ── */
const safeParseDate = (dateString: string | undefined | null): Date | null => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    if (isValid(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
};

const safeFormatDate = (date: Date | string | undefined | null, formatStr: string): string => {
  const parsed = safeParseDate(typeof date === 'string' ? date : undefined) || (date instanceof Date ? date : null);
  if (!parsed) return 'Unknown date';
  try {
    return format(parsed, formatStr);
  } catch {
    return 'Invalid date';
  }
};

const safeDifferenceInDays = (dateLeft: Date | string | undefined, dateRight: Date | string | undefined): number => {
  const left = safeParseDate(typeof dateLeft === 'string' ? dateLeft : undefined) || (dateLeft instanceof Date ? dateLeft : null);
  const right = safeParseDate(typeof dateRight === 'string' ? dateRight : undefined) || (dateRight instanceof Date ? dateRight : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

/* ── GlassCard Component ── */
const GlassCard = memo(({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.glassCard, style]}>
    <View style={styles.glassBorder} />
    <View style={styles.glassContent}>{children}</View>
  </View>
));

/* ── SweetAlert Component ── */
interface SweetAlertProps {
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

const SweetAlert = memo<SweetAlertProps>(({
  visible,
  type,
  title,
  message,
  onClose,
  duration = 3000,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const colors = {
    success: { bg: '#10b981', icon: 'checkmark-circle' as const },
    error: { bg: '#ef4444', icon: 'close-circle' as const },
    warning: { bg: '#f59e0b', icon: 'warning' as const },
    info: { bg: '#3b82f6', icon: 'information-circle' as const },
  };

  const theme = colors[type];

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withSpring(1);
      const timer = setTimeout(() => {
        scale.value = withSpring(0);
        opacity.value = withSpring(0, {}, () => {
          onClose();
        });
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, animatedStyle]}>
        <LinearGradient colors={[theme.bg, `${theme.bg}dd`]} style={styles.alertGradient}>
          <Ionicons name={theme.icon} size={64} color="#fff" />
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertDismiss} onPress={onClose}>
            <Text style={styles.alertDismissText}>Tap to dismiss</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
});

/* ── RecordVaccineModal ── */
interface RecordVaccineModalProps {
  visible: boolean;
  dose: VaccineDose | null;
  onClose: () => void;
  onSave: (doseId: string, data: { date: string; notes: string; sideEffects: string[] }) => void;
}

const RecordVaccineModal = memo<RecordVaccineModalProps>(({ visible, dose, onClose, onSave }) => {
  const { themeColors } = useCustomization();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);

  useEffect(() => {
    if (visible && dose) {
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setSelectedSideEffects([]);
    }
  }, [visible, dose]);

  if (!dose) return null;

  const handleSave = () => {
    onSave(dose.id, { date: new Date(date).toISOString(), notes, sideEffects: selectedSideEffects });
  };

  const toggleSideEffect = (effect: string) => {
    setSelectedSideEffects(prev =>
      prev.includes(effect) ? prev.filter(e => e !== effect) : [...prev, effect]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
          <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Record {dose.vaccineName}</Text>
              <Text style={styles.modalSubtitle}>Dose {dose.doseNumber} of {dose.totalDoses}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date Given</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
            />
          </View>

          {dose.sideEffects.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Side Effects (select any)</Text>
              <View style={styles.sideEffectsContainer}>
                {dose.sideEffects.map(effect => (
                  <TouchableOpacity
                    key={effect}
                    onPress={() => toggleSideEffect(effect)}
                    style={[
                      styles.sideEffectChip,
                      selectedSideEffects.includes(effect) && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                    ]}
                  >
                    <Text style={[
                      styles.sideEffectChipText,
                      selectedSideEffects.includes(effect) && { color: '#fff' },
                    ]}>
                      {effect}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this vaccination..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>Save Record</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ── VaccineDetailModal ── */
interface VaccineDetailModalProps {
  visible: boolean;
  series: VaccineSeries | null;
  onClose: () => void;
}

const VaccineDetailModal = memo<VaccineDetailModalProps>(({ visible, series, onClose }) => {
  if (!series) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, { maxHeight: SCREEN_WIDTH * 1.2 }]}>
          <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{series.name}</Text>
              <Text style={styles.modalSubtitle}>{series.description}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Category</Text>
              <View style={[styles.categoryBadge, { backgroundColor: series.category === 'core' ? '#10b98120' : series.category === 'recommended' ? '#3b82f620' : '#f59e0b20' }]}>
                <Text style={[styles.categoryBadgeText, { color: series.category === 'core' ? '#10b981' : series.category === 'recommended' ? '#3b82f6' : '#f59e0b' }]}>
                  {series.category === 'core' ? 'Core' : series.category === 'recommended' ? 'Recommended' : 'High Risk / Travel'}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Dosing Schedule</Text>
              {series.doses.map((dose, index) => (
                <View key={index} style={styles.doseDetailRow}>
                  <View style={styles.doseDetailNumber}>
                    <Text style={styles.doseDetailNumberText}>{dose.doseNumber}</Text>
                  </View>
                  <View style={styles.doseDetailContent}>
                    <Text style={styles.doseDetailAge}>{dose.recommendedAgeLabel}</Text>
                    <Text style={styles.doseDetailDesc}>{dose.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Contraindications</Text>
              {series.doses[0].contraindications.map((c, i) => (
                <View key={i} style={styles.contraindicationRow}>
                  <Ionicons name="warning-outline" size={14} color="#ef4444" />
                  <Text style={styles.contraindicationText}>{c}</Text>
                </View>
              ))}
              {series.doses[0].contraindications.length === 0 && (
                <Text style={styles.noContraindications}>No specific contraindications listed</Text>
              )}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Administration</Text>
              <Text style={styles.detailText}>Route: {series.doses[0].route}</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ── DoseCard Component ── */
interface DoseCardProps {
  dose: VaccineDose;
  onComplete: (dose: VaccineDose) => void;
  onViewDetails: (series: VaccineSeries) => void;
}

const DoseCard = memo<DoseCardProps>(({ dose, onComplete, onViewDetails }) => {
  const { themeColors } = useCustomization();
  const series = VACCINE_SERIES.find(s => s.id === dose.vaccineId);

  const statusConfig = {
    completed: { color: '#10b981', bg: '#10b98115', icon: 'checkmark-circle' as const, label: 'Completed' },
    due: { color: '#f59e0b', bg: '#f59e0b15', icon: 'time' as const, label: 'Due Now' },
    overdue: { color: '#ef4444', bg: '#ef444415', icon: 'alert-circle' as const, label: 'Overdue' },
    upcoming: { color: '#3b82f6', bg: '#3b82f615', icon: 'calendar' as const, label: 'Upcoming' },
    scheduled: { color: '#8b5cf6', bg: '#8b5cf615', icon: 'calendar-outline' as const, label: 'Scheduled' },
  };

  const config = statusConfig[dose.status];
  const daysUntilDue = safeDifferenceInDays(dose.dueDate, new Date());

  return (
    <Animated.View entering={FadeInUp.springify()}>
      <GlassCard style={[styles.doseCard, dose.status === 'overdue' && styles.doseCardOverdue]}>
        <View style={styles.doseCardHeader}>
          <View style={[styles.doseStatusIndicator, { backgroundColor: config.color }]} />
          <View style={styles.doseCardTitleSection}>
            <Text style={styles.doseCardTitle}>{dose.vaccineName}</Text>
            <Text style={styles.doseCardSubtitle}>Dose {dose.doseNumber} of {dose.totalDoses}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.doseCardBody}>
          <View style={styles.doseInfoRow}>
            <Ionicons name="calendar-outline" size={14} color="#64748b" />
            <Text style={styles.doseInfoText}>
              {dose.status === 'completed' && dose.completedDate
                ? `Given: ${safeFormatDate(dose.completedDate, 'MMM d, yyyy')}`
                : `Due: ${safeFormatDate(dose.dueDate, 'MMM d, yyyy')}`}
            </Text>
          </View>
          <View style={styles.doseInfoRow}>
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text style={styles.doseInfoText}>Recommended: {dose.recommendedAgeLabel}</Text>
          </View>
          {dose.status === 'overdue' && (
            <View style={styles.overdueBanner}>
              <Ionicons name="warning" size={14} color="#ef4444" />
              <Text style={styles.overdueText}>{Math.abs(daysUntilDue)} days overdue — schedule now</Text>
            </View>
          )}
          {dose.status === 'due' && daysUntilDue <= 7 && (
            <View style={styles.dueSoonBanner}>
              <Ionicons name="notifications" size={14} color="#f59e0b" />
              <Text style={styles.dueSoonText}>Due in {daysUntilDue} days</Text>
            </View>
          )}
          {dose.notes && (
            <View style={styles.notesRow}>
              <Ionicons name="document-text" size={14} color="#94a3b8" />
              <Text style={styles.notesText}>{dose.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.doseCardFooter}>
          <TouchableOpacity onPress={() => series && onViewDetails(series)} style={styles.detailButton}>
            <Text style={[styles.detailButtonText, { color: themeColors.primary }]}>Details</Text>
          </TouchableOpacity>
          {dose.status !== 'completed' ? (
            <TouchableOpacity onPress={() => onComplete(dose)} style={[styles.completeButton, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.completeButtonText}>Record</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.completedBadge, { backgroundColor: '#10b98120' }]}>
              <Ionicons name="checkmark-done" size={16} color="#10b981" />
              <Text style={[styles.completedBadgeText, { color: '#10b981' }]}>Done</Text>
            </View>
          )}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

type FilterType = 'all' | 'core' | 'recommended' | 'high_risk' | 'travel';
type StatusFilter = 'all' | 'pending' | 'completed' | 'overdue';

export default function VaccinationScheduleScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { currentBaby, babies, switchBaby } = useBaby();
  const { themeColors, triggerHaptic } = useCustomization();

  const [doses, setDoses] = useState<VaccineDose[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDose, setSelectedDose] = useState<VaccineDose | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<VaccineSeries | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  /* ── Load/Save vaccination records ── */
  useEffect(() => {
    loadRecords();
  }, [currentBaby?.id]);

  const loadRecords = async () => {
    if (!currentBaby) return;
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY}_${currentBaby.id}`);
      const records: Record<string, { completedDate: string; notes: string; sideEffects: string[] }> = stored ? JSON.parse(stored) : {};

      const birthDate = safeParseDate(currentBaby.birthDate) || new Date();
      const generatedDoses: VaccineDose[] = [];

      VACCINE_SERIES.forEach(series => {
        series.doses.forEach((dose, index) => {
          const dueDate = addDays(birthDate, dose.recommendedAgeDays);
          const record = records[`${series.id}_${dose.doseNumber}`];

          let status: VaccineDose['status'] = 'upcoming';
          if (record) {
            status = 'completed';
          } else if (isBefore(startOfDay(dueDate), startOfDay(new Date()))) {
            status = 'overdue';
          } else if (safeDifferenceInDays(dueDate, new Date()) <= 14) {
            status = 'due';
          }

          generatedDoses.push({
            id: `${series.id}_${dose.doseNumber}`,
            vaccineId: series.id,
            vaccineName: dose.vaccineName,
            shortName: dose.shortName,
            doseNumber: dose.doseNumber,
            totalDoses: dose.totalDoses,
            recommendedAgeDays: dose.recommendedAgeDays,
            recommendedAgeLabel: dose.recommendedAgeLabel,
            dueDate: dueDate.toISOString(),
            completedDate: record?.completedDate,
            status,
            category: dose.recommendedAgeDays <= 30 ? 'birth' :
              dose.recommendedAgeDays <= 365 ? 'infant' :
              dose.recommendedAgeDays <= 730 ? 'toddler' :
              dose.recommendedAgeDays <= 2190 ? 'preschool' : 'adolescent',
            description: dose.description,
            sideEffects: dose.sideEffects,
            contraindications: dose.contraindications,
            route: dose.route,
            notes: record?.notes,
            recordedBy: record ? 'Parent' : undefined,
          });
        });
      });

      setDoses(generatedDoses.sort((a, b) => {
        const dateA = safeParseDate(a.dueDate);
        const dateB = safeParseDate(b.dueDate);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      }));
    } catch (error) {
      console.error('Error loading vaccination records:', error);
    }
  };

  const saveRecord = async (doseId: string, data: { date: string; notes: string; sideEffects: string[] }) => {
    if (!currentBaby) return;
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY}_${currentBaby.id}`);
      const records = stored ? JSON.parse(stored) : {};

      records[doseId] = {
        completedDate: data.date,
        notes: data.notes,
        sideEffects: data.sideEffects,
      };

      await AsyncStorage.setItem(`${STORAGE_KEY}_${currentBaby.id}`, JSON.stringify(records));
      await loadRecords();

      triggerHaptic('success');
      setAlert({
        visible: true,
        type: 'success',
        title: 'Vaccination Recorded!',
        message: 'Your baby\'s immunization record has been updated.',
      });
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to save vaccination record.',
      });
    }
  };

  const handleComplete = useCallback((dose: VaccineDose) => {
    setSelectedDose(dose);
    setShowRecordModal(true);
  }, []);

  const handleSaveRecord = useCallback((doseId: string, data: { date: string; notes: string; sideEffects: string[] }) => {
    saveRecord(doseId, data);
    setShowRecordModal(false);
    setSelectedDose(null);
  }, [currentBaby]);

  const handleViewDetails = useCallback((series: VaccineSeries) => {
    setSelectedSeries(series);
    setShowDetailModal(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  }, [currentBaby]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const completed = doses.filter(d => d.status === 'completed').length;
    const overdue = doses.filter(d => d.status === 'overdue').length;
    const due = doses.filter(d => d.status === 'due').length;
    const total = doses.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, overdue, due, total, progress };
  }, [doses]);

  /* ── Filtered doses ── */
  const filteredDoses = useMemo(() => {
    let filtered = doses;

    if (activeFilter !== 'all') {
      const seriesIds = VACCINE_SERIES.filter(s => s.category === activeFilter).map(s => s.id);
      filtered = filtered.filter(d => seriesIds.includes(d.vaccineId));
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        filtered = filtered.filter(d => d.status === 'due' || d.status === 'overdue' || d.status === 'upcoming');
      } else if (statusFilter === 'completed') {
        filtered = filtered.filter(d => d.status === 'completed');
      } else if (statusFilter === 'overdue') {
        filtered = filtered.filter(d => d.status === 'overdue');
      }
    }

    return filtered;
  }, [doses, activeFilter, statusFilter]);

  /* ── Upcoming/next dose ── */
  const nextDose = useMemo(() => {
    return doses.find(d => d.status === 'due' || d.status === 'overdue');
  }, [doses]);

  /* ── Group by category ── */
  const groupedDoses = useMemo(() => {
    const groups: Record<string, VaccineDose[]> = {};
    filteredDoses.forEach(dose => {
      if (!groups[dose.category]) groups[dose.category] = [];
      groups[dose.category].push(dose);
    });
    return groups;
  }, [filteredDoses]);

  const categoryLabels: Record<string, string> = {
    birth: '🏥 Birth',
    infant: '👶 Infant (0–12 months)',
    toddler: '🧒 Toddler (1–2 years)',
    preschool: '🎒 Preschool (2–6 years)',
    adolescent: '🧑 Adolescent (11+ years)',
  };

  if (!currentBaby) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LinearGradient colors={['#f8fafc', '#e0e7ff', '#ddd6fe']} style={StyleSheet.absoluteFill} />
        <Ionicons name="medical" size={64} color="#667eea" style={{ marginBottom: 16 }} />
        <Text style={styles.noDataTitle}>No Baby Profile Selected</Text>
        <Text style={styles.noDataText}>Select a baby profile to view vaccination schedule</Text>
        <TouchableOpacity
          style={[styles.createProfileButton, { backgroundColor: themeColors.primary }]}
          onPress={() => navigation.navigate('SwitchBaby')}
        >
          <Text style={styles.createProfileButtonText}>Select Baby Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#f8fafc', '#e0e7ff', '#ddd6fe']} style={StyleSheet.absoluteFill} />

      <SweetAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert(prev => ({ ...prev, visible: false }))}
      />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.springify()}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <BlurView intensity={BLUR_INTENSITY} style={StyleSheet.absoluteFill} />
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>💉 Vaccinations</Text>
            <Text style={styles.headerSubtitle}>WHO-Based Schedule</Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('GrowthDashboard')} style={styles.headerButton}>
            <BlurView intensity={BLUR_INTENSITY} style={StyleSheet.absoluteFill} />
            <Ionicons name="trending-up" size={22} color="#1e293b" />
          </TouchableOpacity>
        </View>

        {/* Baby Switcher */}
        {babies.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.babySwitcher}>
            {babies.map((baby) => (
              <TouchableOpacity
                key={baby.id}
                onPress={() => switchBaby(baby.id)}
                style={[styles.babyChip, currentBaby.id === baby.id && styles.babyChipActive]}
              >
                <SafeAvatar
                  avatar={baby.avatar}
                  size={28}
                  fallbackIcon="person"
                  fallbackColor={themeColors.primary}
                  fallbackBgColor={themeColors.primary + '20'}
                  borderWidth={0}
                />
                <Text style={[styles.babyChipName, currentBaby.id === baby.id && styles.babyChipNameActive]}>
                  {baby.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + (babies.length > 1 ? 160 : 120), paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }
      >
        {/* Progress Card */}
        <GlassCard style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressTitle}>Immunization Progress</Text>
              <Text style={styles.progressSubtitle}>{stats.completed} of {stats.total} doses completed</Text>
            </View>
            <View style={[styles.progressCircle, { borderColor: themeColors.primary }]}>
              <Text style={[styles.progressPercent, { color: themeColors.primary }]}>{stats.progress}%</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${stats.progress}%`, backgroundColor: themeColors.primary }]} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.due}</Text>
              <Text style={styles.statLabel}>Due Soon</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.overdue}</Text>
              <Text style={styles.statLabel}>Overdue</Text>
            </View>
          </View>
        </GlassCard>

        {/* Next Dose Alert */}
        {nextDose && (
          <Animated.View entering={FadeInUp.delay(200).springify()}>
            <GlassCard style={[styles.nextDoseCard, nextDose.status === 'overdue' && styles.nextDoseCardOverdue]}>
              <View style={styles.nextDoseHeader}>
                <Ionicons
                  name={nextDose.status === 'overdue' ? 'alert-circle' : 'notifications'}
                  size={24}
                  color={nextDose.status === 'overdue' ? '#ef4444' : '#f59e0b'}
                />
                <View style={styles.nextDoseContent}>
                  <Text style={styles.nextDoseTitle}>
                    {nextDose.status === 'overdue' ? '⚠️ Vaccination Overdue' : '💡 Next Vaccination Due'}
                  </Text>
                  <Text style={styles.nextDoseText}>
                    {nextDose.vaccineName} — Dose {nextDose.doseNumber} of {nextDose.totalDoses}
                  </Text>
                  <Text style={styles.nextDoseDate}>
                    {nextDose.status === 'overdue'
                      ? `Overdue by ${Math.abs(safeDifferenceInDays(nextDose.dueDate, new Date()))} days`
                      : `Due ${safeFormatDate(nextDose.dueDate, 'MMM d, yyyy')}`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleComplete(nextDose)}
                style={[styles.nextDoseButton, { backgroundColor: nextDose.status === 'overdue' ? '#ef4444' : themeColors.primary }]}
              >
                <Text style={styles.nextDoseButtonText}>Record Now</Text>
              </TouchableOpacity>
            </GlassCard>
          </Animated.View>
        )}

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {([
            { key: 'all', label: 'All', icon: 'list' },
            { key: 'core', label: 'Core', icon: 'shield-checkmark' },
            { key: 'recommended', label: 'Recommended', icon: 'star' },
            { key: 'high_risk', label: 'High Risk', icon: 'warning' },
            { key: 'travel', label: 'Travel', icon: 'airplane' },
          ] as const).map(filter => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={[
                styles.filterChip,
                activeFilter === filter.key && { backgroundColor: themeColors.primary },
              ]}
            >
              <Ionicons
                name={filter.icon}
                size={14}
                color={activeFilter === filter.key ? '#fff' : '#64748b'}
              />
              <Text style={[
                styles.filterChipText,
                activeFilter === filter.key && { color: '#fff' },
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status Filter */}
        <View style={styles.statusFilterContainer}>
          {([
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'completed', label: 'Completed' },
            { key: 'overdue', label: 'Overdue' },
          ] as const).map(filter => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setStatusFilter(filter.key)}
              style={[
                styles.statusChip,
                statusFilter === filter.key && { backgroundColor: `${themeColors.primary}20`, borderColor: themeColors.primary },
              ]}
            >
              <Text style={[
                styles.statusChipText,
                statusFilter === filter.key && { color: themeColors.primary, fontWeight: '700' },
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dose List */}
        {Object.entries(groupedDoses).map(([category, categoryDoses]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{categoryLabels[category] || category}</Text>
            {categoryDoses.map(dose => (
              <DoseCard
                key={dose.id}
                dose={dose}
                onComplete={handleComplete}
                onViewDetails={handleViewDetails}
              />
            ))}
          </View>
        ))}

        {filteredDoses.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="shield-check" size={64} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No vaccinations found</Text>
            <Text style={styles.emptyStateText}>Try adjusting your filters</Text>
          </View>
        )}

        {/* WHO Attribution */}
        <View style={styles.attribution}>
          <Ionicons name="information-circle" size={14} color="#94a3b8" />
          <Text style={styles.attributionText}>
            Based on WHO Immunization Routine Tables & CDC 2026 Childhood Schedule
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Modals */}
      <RecordVaccineModal
        visible={showRecordModal}
        dose={selectedDose}
        onClose={() => { setShowRecordModal(false); setSelectedDose(null); }}
        onSave={handleSaveRecord}
      />

      <VaccineDetailModal
        visible={showDetailModal}
        series={selectedSeries}
        onClose={() => { setShowDetailModal(false); setSelectedSeries(null); }}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  noDataTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  noDataText: { fontSize: 16, color: '#64748b', textAlign: 'center', marginHorizontal: 32 },
  createProfileButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createProfileButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  glassBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  glassContent: { flex: 1 },

  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alertContainer: {
    width: SCREEN_WIDTH * 0.85,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  alertGradient: {
    padding: 28,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  alertDismiss: { marginTop: 8 },
  alertDismissText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },

  babySwitcher: {
    marginTop: 16,
    paddingHorizontal: 4,
    gap: 10,
  },
  babyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    gap: 6,
  },
  babyChipActive: { backgroundColor: '#667eea' },
  babyChipName: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  babyChipNameActive: { color: '#fff' },

  scrollContent: { paddingHorizontal: 20 },

  progressCard: {
    padding: 20,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  progressSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  progressCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '800',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(100,116,139,0.1)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(100,116,139,0.15)',
  },

  nextDoseCard: {
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  nextDoseCardOverdue: {
    borderLeftColor: '#ef4444',
  },
  nextDoseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  nextDoseContent: {
    flex: 1,
    marginLeft: 12,
  },
  nextDoseTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  nextDoseText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 2,
  },
  nextDoseDate: {
    fontSize: 13,
    color: '#64748b',
  },
  nextDoseButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextDoseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  filterContainer: {
    gap: 10,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.1)',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },

  statusFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
       backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },

  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: -0.3,
  },

  doseCard: {
    marginBottom: 10,
    padding: 16,
  },
  doseCardOverdue: {
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  doseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  doseStatusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  doseCardTitleSection: {
    flex: 1,
  },
  doseCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  doseCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  doseCardBody: {
    gap: 6,
    marginBottom: 12,
  },
  doseInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doseInfoText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  overdueText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  dueSoonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  dueSoonText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },

  doseCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.08)',
  },
  detailButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.08)',
  },
  detailButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },

  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  attributionText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },

  /* ── Modal Styles ── */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: SCREEN_WIDTH * 1.3,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.08)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  inputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  sideEffectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sideEffectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.15)',
  },
  sideEffectChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  saveButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ── Detail Modal Styles ── */
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  doseDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  doseDetailNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  doseDetailNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#667eea',
  },
  doseDetailContent: {
    flex: 1,
  },
  doseDetailAge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  doseDetailDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 18,
  },
  contraindicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  contraindicationText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  noContraindications: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
