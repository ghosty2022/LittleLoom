import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  format,
  differenceInDays,
  differenceInMonths,
  addDays,
  parseISO,
  isValid,
  isBefore,
  isAfter,
  startOfDay,
  addMonths,
  subDays,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBaby, BabyProfile } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Unified with GrowthDashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: {
    xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999,
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   WHO/CDC VACCINATION SCHEDULE DATA
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
  dueDate: string;
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

const VACCINE_SERIES: VaccineSeries[] = [
  {
    id: 'hepb', name: 'Hepatitis B', shortName: 'HepB', description: 'Protects against hepatitis B virus infection', category: 'core',
    doses: [
      { vaccineId: 'hepb', vaccineName: 'Hepatitis B', shortName: 'HepB', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 0, recommendedAgeLabel: 'Birth', description: 'Monovalent HepB within 24 hours of birth', sideEffects: ['Soreness at injection site', 'Low fever'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hepb', vaccineName: 'Hepatitis B', shortName: 'HepB', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 30, recommendedAgeLabel: '1-2 months', description: 'Second dose 1-2 months after birth dose', sideEffects: ['Soreness', 'Mild fever'], contraindications: ['Severe allergic reaction to yeast'], route: 'IM' },
      { vaccineId: 'hepb', vaccineName: 'Hepatitis B', shortName: 'HepB', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 180, recommendedAgeLabel: '6-18 months', description: 'Final dose, not earlier than 24 weeks of age', sideEffects: ['Soreness', 'Fatigue'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'dtap', name: 'DTaP', shortName: 'DTaP', description: 'Diphtheria, Tetanus, Pertussis', category: 'core',
    doses: [
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 1, totalDoses: 5, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of DTaP series', sideEffects: ['Fever', 'Fussiness', 'Redness at site'], contraindications: ['Encephalopathy within 7 days of previous dose'], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 2, totalDoses: 5, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Fever', 'Swelling'], contraindications: [], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 3, totalDoses: 5, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose, minimum 4 weeks after dose 2', sideEffects: ['Fever', 'Irritability'], contraindications: [], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 4, totalDoses: 5, recommendedAgeDays: 450, recommendedAgeLabel: '15-18 months', description: 'Fourth dose, minimum 6 months after dose 3', sideEffects: ['Local reaction', 'Mild fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'dtap', vaccineName: 'DTaP', shortName: 'DTaP', doseNumber: 5, totalDoses: 5, recommendedAgeDays: 1460, recommendedAgeLabel: '4-6 years', description: 'Fifth dose before school entry', sideEffects: ['Arm soreness', 'Headache'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'ipv', name: 'Polio (IPV)', shortName: 'IPV', description: 'Inactivated poliovirus vaccine', category: 'core',
    doses: [
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 1, totalDoses: 4, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of IPV series', sideEffects: ['Soreness', 'Redness'], contraindications: ['Severe allergic reaction to neomycin/streptomycin'], route: 'IM or SC' },
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 2, totalDoses: 4, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Soreness'], contraindications: [], route: 'IM or SC' },
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 3, totalDoses: 4, recommendedAgeDays: 180, recommendedAgeLabel: '6-18 months', description: 'Third dose, may be given at 6-18 months', sideEffects: ['Soreness'], contraindications: [], route: 'IM or SC' },
      { vaccineId: 'ipv', vaccineName: 'Polio', shortName: 'IPV', doseNumber: 4, totalDoses: 4, recommendedAgeDays: 1460, recommendedAgeLabel: '4-6 years', description: 'Fourth dose before school entry', sideEffects: ['Soreness'], contraindications: [], route: 'IM or SC' },
    ],
  },
  {
    id: 'hib', name: 'Hib', shortName: 'Hib', description: 'Haemophilus influenzae type b', category: 'core',
    doses: [
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 1, totalDoses: 4, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of Hib series', sideEffects: ['Fever', 'Irritability'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 2, totalDoses: 4, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 3, totalDoses: 4, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose (may vary by brand)', sideEffects: ['Fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'hib', vaccineName: 'Hib', shortName: 'Hib', doseNumber: 4, totalDoses: 4, recommendedAgeDays: 365, recommendedAgeLabel: '12-15 months', description: 'Booster dose, minimum 8 weeks after dose 3', sideEffects: ['Local reaction'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'pcv', name: 'PCV (Pneumococcal)', shortName: 'PCV', description: 'Pneumococcal conjugate vaccine', category: 'core',
    doses: [
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 1, totalDoses: 4, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First dose of PCV series', sideEffects: ['Fever', 'Irritability', 'Decreased appetite'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 2, totalDoses: 4, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Fever', 'Fussiness'], contraindications: [], route: 'IM' },
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 3, totalDoses: 4, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose, minimum 4 weeks after dose 2', sideEffects: ['Fever', 'Local reaction'], contraindications: [], route: 'IM' },
      { vaccineId: 'pcv', vaccineName: 'Pneumococcal', shortName: 'PCV', doseNumber: 4, totalDoses: 4, recommendedAgeDays: 365, recommendedAgeLabel: '12-15 months', description: 'Booster dose, minimum 8 weeks after dose 3', sideEffects: ['Fever', 'Local reaction'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'rv', name: 'Rotavirus', shortName: 'RV', description: 'Oral vaccine against rotavirus gastroenteritis', category: 'core',
    doses: [
      { vaccineId: 'rv', vaccineName: 'Rotavirus', shortName: 'RV', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 60, recommendedAgeLabel: '2 months', description: 'First oral dose (RV1 or RV5)', sideEffects: ['Mild diarrhea', 'Vomiting', 'Irritability'], contraindications: ['Severe combined immunodeficiency', 'History of intussusception'], route: 'Oral' },
      { vaccineId: 'rv', vaccineName: 'Rotavirus', shortName: 'RV', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 120, recommendedAgeLabel: '4 months', description: 'Second oral dose, minimum 4 weeks after dose 1', sideEffects: ['Diarrhea', 'Fussiness'], contraindications: [], route: 'Oral' },
      { vaccineId: 'rv', vaccineName: 'Rotavirus', shortName: 'RV', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 180, recommendedAgeLabel: '6 months', description: 'Third dose (RV5 only), minimum 4 weeks after dose 2', sideEffects: ['Diarrhea'], contraindications: [], route: 'Oral' },
    ],
  },
  {
    id: 'mmr', name: 'MMR', shortName: 'MMR', description: 'Measles, Mumps, Rubella', category: 'core',
    doses: [
      { vaccineId: 'mmr', vaccineName: 'MMR', shortName: 'MMR', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 365, recommendedAgeLabel: '12-15 months', description: 'First dose at 12-15 months', sideEffects: ['Fever', 'Mild rash', 'Swelling of glands'], contraindications: ['Pregnancy', 'Severe immunodeficiency'], route: 'SC' },
      { vaccineId: 'mmr', vaccineName: 'MMR', shortName: 'MMR', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 1460, recommendedAgeLabel: '4-6 years', description: 'Second dose before school entry', sideEffects: ['Fever', 'Rash'], contraindications: [], route: 'SC' },
    ],
  },
  {
    id: 'varicella', name: 'Varicella', shortName: 'VAR', description: 'Chickenpox vaccine', category: 'core',
    doses: [
      { vaccineId: 'varicella', vaccineName: 'Varicella', shortName: 'VAR', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 365, recommendedAgeLabel: '12-15 months', description: 'First dose at 12-15 months', sideEffects: ['Soreness', 'Mild rash', 'Fever'], contraindications: ['Severe immunodeficiency', 'Pregnancy'], route: 'SC' },
      { vaccineId: 'varicella', vaccineName: 'Varicella', shortName: 'VAR', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 1460, recommendedAgeLabel: '4-6 years', description: 'Second dose before school entry', sideEffects: ['Soreness', 'Mild fever'], contraindications: [], route: 'SC' },
    ],
  },
  {
    id: 'hepa', name: 'Hepatitis A', shortName: 'HepA', description: 'Hepatitis A virus protection', category: 'core',
    doses: [
      { vaccineId: 'hepa', vaccineName: 'Hepatitis A', shortName: 'HepA', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 365, recommendedAgeLabel: '12-23 months', description: 'First dose at 12-23 months', sideEffects: ['Soreness', 'Headache', 'Loss of appetite'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hepa', vaccineName: 'Hepatitis A', shortName: 'HepA', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 547, recommendedAgeLabel: '6 months after dose 1', description: 'Second dose, minimum 6 months after dose 1', sideEffects: ['Soreness', 'Fatigue'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'menb', name: 'Meningococcal B', shortName: 'MenB', description: 'Protects against meningococcal B disease', category: 'recommended',
    doses: [
      { vaccineId: 'menb', vaccineName: 'Meningococcal B', shortName: 'MenB', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 56, recommendedAgeLabel: '8 weeks', description: 'First dose at 8 weeks (high risk) or 10 years', sideEffects: ['Soreness', 'Fever', 'Fatigue'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'menb', vaccineName: 'Meningococcal B', shortName: 'MenB', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 84, recommendedAgeLabel: '12 weeks', description: 'Second dose, minimum 4 weeks after dose 1', sideEffects: ['Soreness', 'Headache'], contraindications: [], route: 'IM' },
      { vaccineId: 'menb', vaccineName: 'Meningococcal B', shortName: 'MenB', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 365, recommendedAgeLabel: '12-15 months', description: 'Booster dose at 12-15 months', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'menacwy', name: 'Meningococcal ACWY', shortName: 'MenACWY', description: 'Protects against meningococcal A, C, W, Y', category: 'recommended',
    doses: [
      { vaccineId: 'menacwy', vaccineName: 'Meningococcal ACWY', shortName: 'MenACWY', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 3285, recommendedAgeLabel: '11-12 years', description: 'First dose at 11-12 years', sideEffects: ['Soreness', 'Headache', 'Fatigue'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'menacwy', vaccineName: 'Meningococcal ACWY', shortName: 'MenACWY', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 5840, recommendedAgeLabel: '16 years', description: 'Booster at 16 years', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'tdap', name: 'Tdap', shortName: 'Tdap', description: 'Adolescent/adult booster', category: 'recommended',
    doses: [
      { vaccineId: 'tdap', vaccineName: 'Tdap', shortName: 'Tdap', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 3285, recommendedAgeLabel: '11-12 years', description: 'Single dose at 11-12 years', sideEffects: ['Soreness', 'Fever', 'Headache'], contraindications: ['Encephalopathy within 7 days of previous dose'], route: 'IM' },
    ],
  },
  {
    id: 'hpv', name: 'HPV', shortName: 'HPV', description: 'Human Papillomavirus protection', category: 'recommended',
    doses: [
      { vaccineId: 'hpv', vaccineName: 'HPV', shortName: 'HPV', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 3285, recommendedAgeLabel: '11-12 years', description: 'First dose at 11-12 years (can start at 9)', sideEffects: ['Soreness', 'Swelling', 'Headache'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'hpv', vaccineName: 'HPV', shortName: 'HPV', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 3468, recommendedAgeLabel: '6-12 months after dose 1', description: 'Second dose, minimum 5 months after dose 1', sideEffects: ['Soreness', 'Headache'], contraindications: [], route: 'IM' },
      { vaccineId: 'hpv', vaccineName: 'HPV', shortName: 'HPV', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 3833, recommendedAgeLabel: '6 months after dose 1', description: 'Third dose (if started at age 15+ or immunocompromised)', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'flu', name: 'Influenza', shortName: 'Flu', description: 'Annual flu vaccination', category: 'recommended',
    doses: [
      { vaccineId: 'flu', vaccineName: 'Influenza', shortName: 'Flu', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 180, recommendedAgeLabel: '6 months+', description: 'First dose at 6 months (2 doses first season)', sideEffects: ['Soreness', 'Low fever', 'Aches'], contraindications: ['Severe allergic reaction to eggs', 'Guillain-Barre syndrome'], route: 'IM' },
      { vaccineId: 'flu', vaccineName: 'Influenza', shortName: 'Flu', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 210, recommendedAgeLabel: '4 weeks after dose 1', description: 'Second dose for first season only', sideEffects: ['Soreness', 'Mild fever'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'covid', name: 'COVID-19', shortName: 'COVID', description: 'COVID-19 vaccination', category: 'recommended',
    doses: [
      { vaccineId: 'covid', vaccineName: 'COVID-19', shortName: 'COVID', doseNumber: 1, totalDoses: 3, recommendedAgeDays: 180, recommendedAgeLabel: '6 months+', description: 'First dose at 6-23 months', sideEffects: ['Soreness', 'Fever', 'Fatigue'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'covid', vaccineName: 'COVID-19', shortName: 'COVID', doseNumber: 2, totalDoses: 3, recommendedAgeDays: 210, recommendedAgeLabel: '3-8 weeks after dose 1', description: 'Second dose', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
      { vaccineId: 'covid', vaccineName: 'COVID-19', shortName: 'COVID', doseNumber: 3, totalDoses: 3, recommendedAgeDays: 540, recommendedAgeLabel: '8 weeks after dose 2', description: 'Third dose (if indicated)', sideEffects: ['Soreness', 'Fatigue'], contraindications: [], route: 'IM' },
    ],
  },
  {
    id: 'bcg', name: 'BCG', shortName: 'BCG', description: 'Tuberculosis (where endemic)', category: 'high_risk',
    doses: [
      { vaccineId: 'bcg', vaccineName: 'BCG', shortName: 'BCG', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 0, recommendedAgeLabel: 'Birth', description: 'Single dose at birth in endemic areas', sideEffects: ['Small ulcer at site', 'Scar formation'], contraindications: ['Severe immunodeficiency', 'HIV in high-resource settings'], route: 'ID' },
    ],
  },
  {
    id: 'typhoid', name: 'Typhoid', shortName: 'Typhoid', description: 'Typhoid fever protection', category: 'travel',
    doses: [
      { vaccineId: 'typhoid', vaccineName: 'Typhoid', shortName: 'Typhoid', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 730, recommendedAgeLabel: '2 years+', description: 'Single dose for travel to endemic areas', sideEffects: ['Fever', 'Headache', 'Redness'], contraindications: ['Severe immunodeficiency'], route: 'IM or Oral' },
    ],
  },
  {
    id: 'yellow_fever', name: 'Yellow Fever', shortName: 'YF', description: 'Required for travel to certain countries', category: 'travel',
    doses: [
      { vaccineId: 'yellow_fever', vaccineName: 'Yellow Fever', shortName: 'YF', doseNumber: 1, totalDoses: 1, recommendedAgeDays: 270, recommendedAgeLabel: '9 months+', description: 'Single dose for travel to endemic areas', sideEffects: ['Fever', 'Headache', 'Muscle pain'], contraindications: ['Severe immunodeficiency', 'Egg allergy'], route: 'SC' },
    ],
  },
  {
    id: 'japanese_encephalitis', name: 'Japanese Encephalitis', shortName: 'JE', description: 'For travel to endemic areas in Asia', category: 'travel',
    doses: [
      { vaccineId: 'je', vaccineName: 'Japanese Encephalitis', shortName: 'JE', doseNumber: 1, totalDoses: 2, recommendedAgeDays: 60, recommendedAgeLabel: '2 months+', description: 'First dose for travel to endemic areas', sideEffects: ['Soreness', 'Fever', 'Headache'], contraindications: ['Severe allergic reaction to previous dose'], route: 'IM' },
      { vaccineId: 'je', vaccineName: 'Japanese Encephalitis', shortName: 'JE', doseNumber: 2, totalDoses: 2, recommendedAgeDays: 88, recommendedAgeLabel: '4 weeks after dose 1', description: 'Second dose', sideEffects: ['Soreness', 'Fever'], contraindications: [], route: 'IM' },
    ],
  },
];

const STORAGE_KEY = '@littleloom_vaccination_records';

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try {
    const p = parseISO(d);
    return isValid(p) ? p : null;
  } catch { return null; }
};

const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  const p = safeParseDate(typeof d === 'string' ? d : undefined) || (d instanceof Date ? d : null);
  if (!p) return '---';
  try { return format(p, fmt); } catch { return '---'; }
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return Math.max(0, differenceInMonths(left, right));
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type VaccineTab = 'schedule' | 'timeline' | 'insights' | 'records';
type StatusFilter = 'all' | 'pending' | 'completed' | 'overdue';

interface VaccineInsight {
  id: string;
  type: 'urgent' | 'upcoming' | 'completed' | 'info' | 'travel' | 'side_effect';
  title: string;
  description: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  action?: { label: string; screen: string; params?: any };
  timestamp: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFINED SUB-COMPONENTS (Matching GrowthDashboard style)
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = memo(({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const { themeColors } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      active && { borderColor: themeColors.primary, borderWidth: 2 },
      style
    ]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

const SectionHeader = memo(({ title, subtitle, action, actionLabel, themeColors }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string; themeColors: any }) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: '#1e293b' }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: '#64748b' }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: themeColors.primary }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
      </TouchableOpacity>
    )}
  </View>
));

const TabBar = memo(({ tabs, activeTab, onChange, themeColors }: { tabs: { key: VaccineTab; label: string; icon: string }[]; activeTab: VaccineTab; onChange: (t: VaccineTab) => void; themeColors: any }) => (
  <View style={styles.tabBar}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[
            styles.tabItem,
            isActive && { backgroundColor: '#fff', /* no shadow */ }
          ]}
        >
          <Ionicons name={tab.icon as any} size={16} color={isActive ? themeColors.primary : '#64748b'} />
          <Text style={[
            styles.tabLabel,
            { color: isActive ? themeColors.primary : '#64748b' },
            isActive && { fontWeight: '700' }
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));


/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 1: Smart Vaccine Timeline (Horizontal scrollable timeline)
   ═══════════════════════════════════════════════════════════════════════════ */

const VaccineTimeline = memo(({ doses, onDosePress, themeColors }: { doses: VaccineDose[]; onDosePress: (d: VaccineDose) => void; themeColors: any }) => {
  const timelineItems = useMemo(() => {
    const sorted = [...doses].sort((a, b) => {
      const da = safeParseDate(a.dueDate);
      const db = safeParseDate(b.dueDate);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

    return sorted.map(dose => {
      const due = safeParseDate(dose.dueDate);
      return {
        ...dose,
        isPast: due ? isBefore(due, startOfDay(new Date())) : false,
      };
    });
  }, [doses]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard>
        <View style={styles.timelineHeader}>
          <View style={[styles.timelineIconBg, { backgroundColor: `${themeColors.primary}15` }]}>
            <Ionicons name="time" size={20} color={themeColors.primary} />
          </View>
          <View>
            <Text style={styles.timelineTitle}>Vaccine Timeline</Text>
            <Text style={styles.timelineSubtitle}>Visual journey of immunizations</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
          {timelineItems.map((item, i) => (
            <TouchableOpacity key={item.id} onPress={() => onDosePress(item)} style={styles.timelineNode}>
              <View style={styles.timelineNodeTop}>
                <View style={[
                  styles.timelineDot,
                  item.status === 'completed' && { backgroundColor: '#10b981', borderColor: '#10b981' },
                  item.status === 'overdue' && { backgroundColor: '#ef4444', borderColor: '#ef4444' },
                  item.status === 'due' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
                  item.status === 'upcoming' && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
                ]}>
                  {item.status === 'completed' && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                {i < timelineItems.length - 1 && (
                  <View style={[
                    styles.timelineConnector,
                    item.status === 'completed' && timelineItems[i + 1]?.status === 'completed' && { backgroundColor: '#10b981' },
                  ]} />
                )}
              </View>
              <View style={styles.timelineNodeContent}>
                <Text style={styles.timelineNodeShort}>{item.shortName}</Text>
                <Text style={styles.timelineNodeDose}>D{item.doseNumber}</Text>
                <Text style={[
                  styles.timelineNodeStatus,
                  item.status === 'completed' && { color: '#10b981' },
                  item.status === 'overdue' && { color: '#ef4444' },
                  item.status === 'due' && { color: '#f59e0b' },
                ]}>
                  {item.status === 'completed' ? 'Done' : item.status === 'overdue' ? 'Late' : item.status === 'due' ? 'Soon' : 'Upcoming'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: Vaccine Protection Score (Hero metric like Growth Score)
   ═══════════════════════════════════════════════════════════════════════════ */

const ProtectionScore = memo(({ stats, themeColors }: { stats: any; themeColors: any }) => {
  const score = stats?.progress || 0;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <GlassCard>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreLeft}>
            <View style={[styles.scoreRing, { borderColor: `${themeColors.primary}30` }]}>
              <Text style={[styles.scoreValue, { color: themeColors.primary }]}>{score}</Text>
              <Text style={[styles.scoreMax, { color: '#94a3b8' }]}>/100</Text>
            </View>
            <View style={styles.scoreLabels}>
              <Text style={styles.scoreLabel}>Protection Score</Text>
              <Text style={styles.scoreSubLabel}>Immunity Index</Text>
            </View>
          </View>
          <View style={styles.scoreRight}>
            {[
              { label: 'Core', value: stats?.completed || 0, total: stats?.total || 0, color: '#10b981', icon: 'shield-checkmark' },
              { label: 'Due', value: stats?.due || 0, total: 0, color: '#f59e0b', icon: 'time' },
              { label: 'Overdue', value: stats?.overdue || 0, total: 0, color: '#ef4444', icon: 'alert-circle' },
            ].map(s => (
              <View key={s.label} style={styles.scoreMini}>
                <Ionicons name={s.icon as any} size={14} color={s.color} />
                <View style={styles.scoreMiniBarWrap}>
                  <View style={[styles.scoreMiniBarBg, { backgroundColor: `${s.color}15` }]}>
                    <View style={[styles.scoreMiniBarFill, { 
                      width: s.total > 0 ? `${(s.value / s.total) * 100}%` : s.value > 0 ? '100%' : '0%', 
                      backgroundColor: s.color 
                    }]} />
                  </View>
                </View>
                <Text style={[styles.scoreMiniValue, { color: s.color }]}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: Smart Vaccine Insights (AI-powered recommendations)
   ═══════════════════════════════════════════════════════════════════════════ */

const VaccineInsights = memo(({ doses, baby, themeColors, onInsightPress }: { doses: VaccineDose[]; baby: BabyProfile; themeColors: any; onInsightPress: (insight: VaccineInsight) => void }) => {
  const insights = useMemo((): VaccineInsight[] => {
    const items: VaccineInsight[] = [];
    const now = Date.now();
    const ageMonths = safeDiffMonths(new Date(), baby.birthDate);

    // Overdue alerts
    const overdueDoses = doses.filter(d => d.status === 'overdue');
    if (overdueDoses.length > 0) {
      const mostUrgent = overdueDoses.sort((a, b) => {
        const da = safeParseDate(a.dueDate);
        const db = safeParseDate(b.dueDate);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      })[0];
      const daysLate = Math.abs(safeDiffDays(mostUrgent.dueDate, new Date()));
      items.push({
        id: 'urgent-overdue',
        type: 'urgent',
        title: `${mostUrgent.vaccineName} Overdue`,
        description: `${daysLate} days past due. Schedule appointment ASAP to maintain protection.`,
        emoji: '⚠️',
        color: '#ef4444',
        priority: 'high',
        action: { label: 'Schedule', screen: 'VaccinationSchedule', params: { filter: 'overdue' } },
        timestamp: now,
      });
    }

    // Upcoming due
    const upcomingDue = doses.filter(d => d.status === 'due').slice(0, 1);
    upcomingDue.forEach(d => {
      const daysUntil = safeDiffDays(d.dueDate, new Date());
      items.push({
        id: `upcoming-${d.id}`,
        type: 'upcoming',
        title: `${d.vaccineName} Due Soon`,
        description: `Due in ${daysUntil} days (${safeFmt(d.dueDate, 'MMM d')}). Prepare for appointment.`,
        emoji: '💉',
        color: '#f59e0b',
        priority: 'medium',
        action: { label: 'Record', screen: 'VaccinationSchedule', params: { doseId: d.id } },
        timestamp: now,
      });
    });

    // Completion celebration
    const recentlyCompleted = doses.filter(d => {
      if (!d.completedDate) return false;
      return safeDiffDays(new Date(), d.completedDate) <= 7;
    });
    if (recentlyCompleted.length > 0) {
      items.push({
        id: 'recent-completion',
        type: 'completed',
        title: 'Great Progress! 🎉',
        description: `${recentlyCompleted.length} dose${recentlyCompleted.length > 1 ? 's' : ''} completed recently. Keep it up!`,
        emoji: '🛡️',
        color: '#10b981',
        priority: 'low',
        timestamp: now,
      });
    }

    // Age-based recommendations
    if (ageMonths >= 6 && ageMonths < 7) {
      const fluDose = doses.find(d => d.vaccineId === 'flu' && d.doseNumber === 1);
      if (fluDose && fluDose.status === 'upcoming') {
        items.push({
          id: 'flu-recommendation',
          type: 'info',
          title: 'Flu Season Ready',
          description: 'Annual flu vaccination is now recommended. Consider scheduling with your pediatrician.',
          emoji: '🤧',
          color: '#3b82f6',
          priority: 'medium',
          action: { label: 'Learn More', screen: 'VaccineDetail', params: { vaccineId: 'flu' } },
          timestamp: now,
        });
      }
    }

    // Travel alert check
    const travelVaccines = doses.filter(d => {
      const series = VACCINE_SERIES.find(s => s.id === d.vaccineId);
      return series?.category === 'travel' && d.status !== 'completed';
    });
    if (travelVaccines.length > 0) {
      items.push({
        id: 'travel-alert',
        type: 'travel',
        title: 'Travel Vaccines Pending',
        description: `${travelVaccines.length} travel vaccine${travelVaccines.length > 1 ? 's' : ''} not yet administered. Check requirements before travel.`,
        emoji: '✈️',
        color: '#8b5cf6',
        priority: 'medium',
        action: { label: 'View Travel', screen: 'VaccinationSchedule', params: { filter: 'travel' } },
        timestamp: now,
      });
    }

    return items.sort((a, b) => {
      const prioOrder = { high: 0, medium: 1, low: 2 };
      return prioOrder[a.priority] - prioOrder[b.priority];
    }).slice(0, 4);
  }, [doses, baby]);

  if (insights.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader 
        title="Smart Insights" 
        subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`}
        themeColors={themeColors}
      />
      {insights.map((insight, i) => (
        <Animated.View key={insight.id} entering={FadeInUp.delay(i * 60).springify()}>
          <TouchableOpacity 
            onPress={() => onInsightPress(insight)} 
            activeOpacity={0.85} 
            style={[
              styles.insightCard,
              insight.priority === 'high' && { borderLeftWidth: 3, borderLeftColor: insight.color },
            ]}
          >
            <View style={styles.insightRow}>
              <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
                <Text style={styles.insightEmoji}>{insight.emoji}</Text>
              </View>
              <View style={styles.insightContent}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle} numberOfLines={1}>{insight.title}</Text>
                  <Text style={styles.insightTime}>{safeFmt(insight.timestamp, 'MMM d')}</Text>
                </View>
                <Text style={styles.insightDesc} numberOfLines={2}>{insight.description}</Text>
                {insight.action && (
                  <View style={[styles.insightActionBadge, { backgroundColor: `${themeColors.primary}10` }]}>
                    <Text style={[styles.insightActionText, { color: themeColors.primary }]}>{insight.action.label} →</Text>
                  </View>
                )}
              </View>
              <View style={[styles.insightPriority, { backgroundColor: insight.color }]} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 4: Vaccine Category Grid (Visual category cards)
   ═══════════════════════════════════════════════════════════════════════════ */

const VaccineCategoryGrid = memo(({ doses, onCategoryPress, themeColors }: { doses: VaccineDose[]; onCategoryPress: (cat: string) => void; themeColors: any }) => {
  const categories = useMemo(() => [
    { key: 'core', label: 'Core', icon: 'shield-checkmark', color: '#10b981', desc: 'Essential' },
    { key: 'recommended', label: 'Recommended', icon: 'star', color: '#3b82f6', desc: 'Advised' },
    { key: 'high_risk', label: 'High Risk', icon: 'warning', color: '#f59e0b', desc: 'Special' },
    { key: 'travel', label: 'Travel', icon: 'airplane', color: '#8b5cf6', desc: 'Travel' },
  ], []);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; pending: number }> = {};
    categories.forEach(c => {
      const seriesIds = VACCINE_SERIES.filter(s => s.category === c.key).map(s => s.id);
      const catDoses = doses.filter(d => seriesIds.includes(d.vaccineId));
      stats[c.key] = {
        total: catDoses.length,
        completed: catDoses.filter(d => d.status === 'completed').length,
        pending: catDoses.filter(d => d.status !== 'completed').length,
      };
    });
    return stats;
  }, [doses, categories]);

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      <View style={styles.categoryGrid}>
        {categories.map((cat) => {
          const stat = categoryStats[cat.key];
          const progress = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
          return (
            <TouchableOpacity 
              key={cat.key} 
              onPress={() => onCategoryPress(cat.key)}
              style={[
                styles.categoryCard,
                { borderColor: `${cat.color}20` },
              ]}
            >
              <LinearGradient
                colors={[`${cat.color}08`, `${cat.color}02`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={[styles.categoryIconBg, { backgroundColor: `${cat.color}15` }]}>
                <Ionicons name={cat.icon as any} size={20} color={cat.color} />
              </View>
              <Text style={[styles.categoryLabel, { color: '#1e293b' }]}>{cat.label}</Text>
              <Text style={[styles.categoryDesc, { color: '#64748b' }]}>{cat.desc}</Text>
              <View style={styles.categoryProgressWrap}>
                <View style={[styles.categoryProgressBg, { backgroundColor: `${cat.color}12` }]}>
                  <View style={[styles.categoryProgressFill, { width: `${progress}%`, backgroundColor: cat.color }]} />
                </View>
                <Text style={[styles.categoryProgressText, { color: cat.color }]}>{Math.round(progress)}%</Text>
              </View>
              <Text style={[styles.categoryCount, { color: '#94a3b8' }]}>
                {stat.completed}/{stat.total} doses
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 5: Dose Detail Card (Redesigned - compact, information-dense)
   ═══════════════════════════════════════════════════════════════════════════ */

const DoseDetailCard = memo(({ dose, onComplete, onViewDetails, themeColors, index }: { dose: VaccineDose; onComplete: (d: VaccineDose) => void; onViewDetails: (s: VaccineSeries) => void; themeColors: any; index: number }) => {
  const series = VACCINE_SERIES.find(s => s.id === dose.vaccineId);
  const daysUntilDue = safeDiffDays(dose.dueDate, new Date());

  const statusConfig = {
    completed: { color: '#10b981', bg: '#10b98112', icon: 'checkmark-circle' as const, label: 'Done' },
    due: { color: '#f59e0b', bg: '#f59e0b12', icon: 'time' as const, label: 'Due' },
    overdue: { color: '#ef4444', bg: '#ef444412', icon: 'alert-circle' as const, label: 'Late' },
    upcoming: { color: '#3b82f6', bg: '#3b82f612', icon: 'calendar' as const, label: 'Soon' },
    scheduled: { color: '#8b5cf6', bg: '#8b5cf612', icon: 'calendar-outline' as const, label: 'Set' },
  };

  const config = statusConfig[dose.status];

  return (
    <Animated.View entering={FadeInUp.delay(index * 40).springify()}>
      <TouchableOpacity 
        onPress={() => series && onViewDetails(series)}
        activeOpacity={0.9}
        style={[
          styles.doseDetailCard,
          dose.status === 'overdue' && { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
          dose.status === 'due' && { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
        ]}
      >
        <View style={styles.doseDetailTop}>
          <View style={styles.doseDetailLeft}>
            <View style={[styles.doseDetailIconBg, { backgroundColor: config.bg }]}>
              <Ionicons name={config.icon} size={18} color={config.color} />
            </View>
            <View style={styles.doseDetailInfo}>
              <Text style={styles.doseDetailName}>{dose.vaccineName}</Text>
              <Text style={styles.doseDetailMeta}>Dose {dose.doseNumber} of {dose.totalDoses} • {dose.recommendedAgeLabel}</Text>
            </View>
          </View>
          <View style={[styles.doseDetailBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.doseDetailBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.doseDetailMiddle}>
          <View style={styles.doseDetailDateRow}>
            <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
            <Text style={styles.doseDetailDateText}>
              {dose.status === 'completed' && dose.completedDate
                ? `Given: ${safeFmt(dose.completedDate, 'MMM d, yyyy')}`
                : `Due: ${safeFmt(dose.dueDate, 'MMM d, yyyy')}`}
            </Text>
          </View>

          {dose.status === 'overdue' && (
            <View style={styles.doseDetailAlertRow}>
              <Ionicons name="warning" size={13} color="#ef4444" />
              <Text style={styles.doseDetailAlertText}>{Math.abs(daysUntilDue)} days overdue</Text>
            </View>
          )}
          {dose.status === 'due' && daysUntilDue <= 7 && (
            <View style={styles.doseDetailAlertRow}>
              <Ionicons name="notifications" size={13} color="#f59e0b" />
              <Text style={[styles.doseDetailAlertText, { color: '#f59e0b' }]}>Due in {daysUntilDue} days</Text>
            </View>
          )}
          {dose.notes && (
            <View style={styles.doseDetailNotesRow}>
              <Ionicons name="document-text" size={13} color="#94a3b8" />
              <Text style={styles.doseDetailNotesText}>{dose.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.doseDetailBottom}>
          <TouchableOpacity onPress={() => series && onViewDetails(series)} style={styles.doseDetailDetailBtn}>
            <Text style={[styles.doseDetailDetailText, { color: themeColors.primary }]}>Details</Text>
          </TouchableOpacity>
          {dose.status !== 'completed' ? (
            <TouchableOpacity onPress={() => onComplete(dose)} style={[styles.doseDetailRecordBtn, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="checkmark" size={14} color="#fff" />
              <Text style={styles.doseDetailRecordText}>Record</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.doseDetailDoneBadge}>
              <Ionicons name="checkmark-done" size={14} color="#10b981" />
              <Text style={styles.doseDetailDoneText}>Recorded</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 6: Travel Vaccine Planner (Travel-specific section)
   ═══════════════════════════════════════════════════════════════════════════ */

const TravelVaccinePlanner = memo(({ doses, themeColors, onPlanTravel }: { doses: VaccineDose[]; themeColors: any; onPlanTravel: () => void }) => {
  const travelDoses = useMemo(() => {
    const travelSeriesIds = VACCINE_SERIES.filter(s => s.category === 'travel').map(s => s.id);
    return doses.filter(d => travelSeriesIds.includes(d.vaccineId) && d.status !== 'completed');
  }, [doses]);

  if (travelDoses.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader 
        title="Travel Ready" 
        subtitle={`${travelDoses.length} vaccines needed for travel`}
        themeColors={themeColors}
      />
      <GlassCard>
        <View style={styles.travelHeader}>
          <View style={[styles.travelIconBg, { backgroundColor: '#8b5cf615' }]}>
            <Ionicons name="airplane" size={22} color="#8b5cf6" />
          </View>
          <View style={styles.travelHeaderText}>
            <Text style={styles.travelTitle}>Travel Vaccination Checklist</Text>
            <Text style={styles.travelSubtitle}>Plan ahead for safe travel</Text>
          </View>
        </View>

        <View style={styles.travelList}>
          {travelDoses.map((dose, i) => {
            const series = VACCINE_SERIES.find(s => s.id === dose.vaccineId);
            return (
              <View key={dose.id} style={[styles.travelItem, i < travelDoses.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(100,116,139,0.08)' }]}>
                <View style={styles.travelItemLeft}>
                  <View style={[styles.travelItemDot, { backgroundColor: dose.status === 'overdue' ? '#ef4444' : '#f59e0b' }]} />
                  <View>
                    <Text style={styles.travelItemName}>{dose.vaccineName}</Text>
                    <Text style={styles.travelItemDesc}>{series?.description}</Text>
                  </View>
                </View>
                <Text style={[styles.travelItemStatus, { color: dose.status === 'overdue' ? '#ef4444' : '#f59e0b' }]}>
                  {dose.status === 'overdue' ? 'Overdue' : 'Pending'}
                </Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity onPress={onPlanTravel} style={[styles.travelPlanBtn, { backgroundColor: '#8b5cf6' }]}>
          <Ionicons name="map" size={16} color="#fff" />
          <Text style={styles.travelPlanText}>Plan Travel Vaccines</Text>
        </TouchableOpacity>
      </GlassCard>
    </Animated.View>
  );
});


/* ═══════════════════════════════════════════════════════════════════════════
   MODALS (Redesigned to match GrowthDashboard style)
   ═══════════════════════════════════════════════════════════════════════════ */

const RecordVaccineModal = memo(({ visible, dose, onClose, onSave, themeColors }: any) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [selectedSideEffects, setSelectedSideEffects] = useState<string[]>([]);
  const [batchNumber, setBatchNumber] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (visible && dose) {
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setSelectedSideEffects([]);
      setBatchNumber('');
      setLocation('');
    }
  }, [visible, dose]);

  if (!dose) return null;

  const handleSave = () => {
    onSave(dose.id, { 
      date: new Date(date).toISOString(), 
      notes, 
      sideEffects: selectedSideEffects,
      batchNumber: batchNumber || undefined,
      location: location || undefined,
    });
  };

  const toggleSideEffect = (effect: string) => {
    setSelectedSideEffects(prev =>
      prev.includes(effect) ? prev.filter(e => e !== effect) : [...prev, effect]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
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

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.6 }}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date Given</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location</Text>
              <TextInput 
                style={styles.input} 
                value={location} 
                onChangeText={setLocation} 
                placeholder="Clinic or hospital name"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Batch Number</Text>
              <TextInput 
                style={styles.input} 
                value={batchNumber} 
                onChangeText={setBatchNumber} 
                placeholder="Vaccine batch/lot number"
                placeholderTextColor="#94a3b8"
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
          </ScrollView>

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

const VaccineDetailModal = memo(({ visible, series, onClose }: { visible: boolean; series: VaccineSeries | null; onClose: () => void }) => {
  if (!series) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, { maxHeight: SCREEN_W * 1.2 }]}>
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

const BabySwitcherModal = memo(({ visible, onClose, babies, currentBaby, onSwitch, themeColors }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.babySwitcherModal}>
          <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.babySwitcherTitle}>Select Baby</Text>
          {babies.map((baby: BabyProfile) => (
            <TouchableOpacity
              key={baby.id}
              onPress={() => { onSwitch(baby.id); onClose(); }}
              style={[styles.babySwitcherItem, currentBaby?.id === baby.id && { backgroundColor: `${themeColors.primary}15` }]}
            >
              <SafeAvatar avatar={baby.avatar} size={44} fallbackIcon="person" borderColor={currentBaby?.id === baby.id ? themeColors.primary : '#e2e8f0'} borderWidth={2} />
              <View style={styles.babySwitcherInfo}>
                <Text style={styles.babySwitcherName}>{baby.name}</Text>
                <Text style={styles.babySwitcherMeta}>{safeFmt(baby.birthDate, 'MMM d, yyyy')} • {safeDiffMonths(new Date(), baby.birthDate)} months</Text>
              </View>
              {currentBaby?.id === baby.id && <Ionicons name="checkmark-circle" size={22} color={themeColors.primary} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — REDESIGNED WITH TABS & GROWTHDASHBOARD STYLE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function VaccinationScheduleScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { themeColors, triggerHaptic } = useCustomization();
  const { currentBaby, babies, switchBaby } = useBaby();

  const [doses, setDoses] = useState<VaccineDose[]>([]);
  const [activeTab, setActiveTab] = useState<VaccineTab>('schedule');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedDose, setSelectedDose] = useState<VaccineDose | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<VaccineSeries | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBabySwitcher, setShowBabySwitcher] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  /* ── Load/Save vaccination records ── */
  useEffect(() => {
    loadRecords();
  }, [currentBaby?.id]);

  const loadRecords = async () => {
    if (!currentBaby) return;
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY}_${currentBaby.id}`);
      const records: Record<string, { completedDate: string; notes: string; sideEffects: string[]; batchNumber?: string; location?: string }> = stored ? JSON.parse(stored) : {};

      const birthDate = safeParseDate(currentBaby.birthDate) || new Date();
      const generatedDoses: VaccineDose[] = [];

      VACCINE_SERIES.forEach(series => {
        series.doses.forEach((dose) => {
          const dueDate = addDays(birthDate, dose.recommendedAgeDays);
          const record = records[`${series.id}_${dose.doseNumber}`];

          let status: VaccineDose['status'] = 'upcoming';
          if (record) {
            status = 'completed';
          } else if (isBefore(startOfDay(dueDate), startOfDay(new Date()))) {
            status = 'overdue';
          } else if (safeDiffDays(dueDate, new Date()) <= 14) {
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

  const saveRecord = async (doseId: string, data: { date: string; notes: string; sideEffects: string[]; batchNumber?: string; location?: string }) => {
    if (!currentBaby) return;
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY}_${currentBaby.id}`);
      const records = stored ? JSON.parse(stored) : {};

      records[doseId] = {
        completedDate: data.date,
        notes: data.notes,
        sideEffects: data.sideEffects,
        batchNumber: data.batchNumber,
        location: data.location,
      };

      await AsyncStorage.setItem(`${STORAGE_KEY}_${currentBaby.id}`, JSON.stringify(records));
      await loadRecords();

      triggerHaptic('success');
    } catch (error) {
      console.error('Error saving record:', error);
    }
  };

  const handleComplete = useCallback((dose: VaccineDose) => {
    setSelectedDose(dose);
    setShowRecordModal(true);
  }, []);

  const handleSaveRecord = useCallback((doseId: string, data: any) => {
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

  const handleTabChange = useCallback((tab: VaccineTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleCategoryPress = useCallback((cat: string) => {
    setActiveCategory(cat);
    setActiveTab('schedule');
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleInsightPress = useCallback((insight: VaccineInsight) => {
    triggerHaptic('light');
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen, insight.action.params);
    }
  }, [navigation, triggerHaptic]);

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

    if (activeCategory !== 'all') {
      const seriesIds = VACCINE_SERIES.filter(s => s.category === activeCategory).map(s => s.id);
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
  }, [doses, activeCategory, statusFilter]);

  /* ── Group by age category ── */
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
    infant: '👶 Infant (0-12 months)',
    toddler: '🧒 Toddler (1-2 years)',
    preschool: '🎒 Preschool (2-6 years)',
    adolescent: '🧑 Adolescent (11+ years)',
  };

  const ageMonths = useMemo(() => {
    if (!currentBaby) return 0;
    return safeDiffMonths(new Date(), currentBaby.birthDate);
  }, [currentBaby]);

  const tabs = [
    { key: 'schedule' as VaccineTab, label: 'Schedule', icon: 'calendar-outline' },
    { key: 'timeline' as VaccineTab, label: 'Timeline', icon: 'time-outline' },
    { key: 'insights' as VaccineTab, label: 'Insights', icon: 'bulb-outline' },
    { key: 'records' as VaccineTab, label: 'Records', icon: 'document-text-outline' },
  ];

  if (!currentBaby) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={['#f8fafc', '#e0e7ff', '#ddd6fe']} style={StyleSheet.absoluteFill} />
        <Ionicons name="medical" size={64} color="#667eea" style={{ marginBottom: 16 }} />
        <Text style={styles.noDataTitle}>No Baby Profile Selected</Text>
        <Text style={styles.noDataText}>Select a baby profile to view vaccination schedule</Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: themeColors.primary }]}
          onPress={() => navigation.navigate('SwitchBaby')}
        >
          <Text style={styles.createBtnText}>Select Baby Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#f8fafc', '#e0e7ff', '#ddd6fe']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyTitle}>{currentBaby.name}'s Vaccines</Text>
        <Text style={styles.stickySubtitle}>{ageMonths} months • {stats.completed}/{stats.total} doses</Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} colors={[themeColors.primary, themeColors.secondary]} />
        }
      >
        {/* ── TOP HEADER ROW ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1e293b" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowBabySwitcher(true)} style={styles.babyChip}>
            <SafeAvatar avatar={currentBaby.avatar} size={36} fallbackIcon="person" borderColor={themeColors.primary} borderWidth={2} />
            <View style={styles.babyChipText}>
              <Text style={styles.babyChipName}>{currentBaby.name}</Text>
              <Text style={styles.babyChipAge}>{ageMonths}mo</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => {
            const nextDue = doses.find(d => d.status === 'due' || d.status === 'overdue');
            if (nextDue) handleComplete(nextDue);
          }} style={[styles.addBtn, { backgroundColor: themeColors.primary }]}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── PROTECTION SCORE (Hero) ── */}
        <ProtectionScore stats={stats} themeColors={themeColors} />

        {/* ── VACCINE CATEGORY GRID ── */}
        <VaccineCategoryGrid doses={doses} onCategoryPress={handleCategoryPress} themeColors={themeColors} />

        {/* ── TAB BAR ── */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} themeColors={themeColors} />

        {/* ═════════════════════════════════════════════════════════════════
            TAB: SCHEDULE
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'schedule' && (
          <>
            {/* Status Filter */}
            <View style={styles.statusFilterContainer}>
              {([
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'completed', label: 'Done' },
                { key: 'overdue', label: 'Late' },
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

            {/* Dose List by Category */}
            {Object.entries(groupedDoses).map(([category, categoryDoses]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{categoryLabels[category] || category}</Text>
                {categoryDoses.map((dose, i) => (
                  <DoseDetailCard
                    key={dose.id}
                    dose={dose}
                    onComplete={handleComplete}
                    onViewDetails={handleViewDetails}
                    themeColors={themeColors}
                    index={i}
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

            {/* Travel Vaccines */}
            <TravelVaccinePlanner doses={doses} themeColors={themeColors} onPlanTravel={() => navigation.navigate('TravelPlanner')} />
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: TIMELINE
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <>
            <VaccineTimeline doses={doses} onDosePress={handleComplete} themeColors={themeColors} />

            {/* Next Dose Alert */}
            {(() => {
              const nextDose = doses.find(d => d.status === 'due' || d.status === 'overdue');
              if (!nextDose) return null;
              return (
                <Animated.View entering={FadeInUp.delay(250).springify()}>
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
                            ? `Overdue by ${Math.abs(safeDiffDays(nextDose.dueDate, new Date()))} days`
                            : `Due ${safeFmt(nextDose.dueDate, 'MMM d, yyyy')}`}
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
              );
            })()}
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: INSIGHTS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'insights' && (
          <>
            <VaccineInsights doses={doses} baby={currentBaby} themeColors={themeColors} onInsightPress={handleInsightPress} />

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              {[
                { icon: '📊', label: 'Growth', screen: 'GrowthDashboard', gradient: ['#6366f1', '#818cf8'] },
                { icon: '🌟', label: 'Milestones', screen: 'Timeline', params: { filter: 'milestone' }, gradient: ['#f59e0b', '#fbbf24'] },
                { icon: '🏆', label: 'Achievements', screen: 'Achievements', gradient: ['#8b5cf6', '#a78bfa'] },
              ].map((action, i) => (
                <TouchableOpacity key={i} onPress={() => navigation.navigate(action.screen, action.params)} style={styles.quickAction}>
                  <LinearGradient colors={action.gradient as [string, string]} style={styles.quickActionGradient}>
                    <Text style={styles.quickActionIcon}>{action.icon}</Text>
                    <Text style={styles.quickActionText}>{action.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════
            TAB: RECORDS
           ═════════════════════════════════════════════════════════════════ */}
        {activeTab === 'records' && (
          <View style={styles.section}>
            <SectionHeader 
              title="Vaccination Records" 
              subtitle={`${doses.filter(d => d.status === 'completed').length} recorded`}
              themeColors={themeColors}
            />
            <GlassCard style={styles.recordsCard}>
              {doses
                .filter(d => d.status === 'completed')
                .sort((a, b) => {
                  const da = safeParseDate(a.completedDate);
                  const db = safeParseDate(b.completedDate);
                  return (db?.getTime() || 0) - (da?.getTime() || 0);
                })
                .map((dose, i, arr) => (
                  <View key={dose.id} style={[styles.recordRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(100,116,139,0.08)' }]}>
                    <View style={[styles.recordIconBg, { backgroundColor: '#10b98112' }]}>
                      <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordName}>{dose.vaccineName}</Text>
                      <Text style={styles.recordMeta}>Dose {dose.doseNumber} of {dose.totalDoses}</Text>
                    </View>
                    <View style={styles.recordRight}>
                      <Text style={styles.recordDate}>{safeFmt(dose.completedDate, 'MMM d, yyyy')}</Text>
                      {dose.notes && <Text style={styles.recordNotes} numberOfLines={1}>{dose.notes}</Text>}
                    </View>
                  </View>
                ))}
              {doses.filter(d => d.status === 'completed').length === 0 && (
                <View style={styles.emptyRecords}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyRecordsText}>No records yet</Text>
                  <Text style={styles.emptyRecordsSub}>Record your first vaccination to see it here</Text>
                </View>
              )}
            </GlassCard>
          </View>
        )}

        {/* WHO Attribution */}
        <View style={styles.attribution}>
          <Ionicons name="information-circle" size={14} color="#94a3b8" />
          <Text style={styles.attributionText}>
            Based on WHO Immunization Routine Tables & CDC 2026 Childhood Schedule
          </Text>
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* ── MODALS ── */}
      <RecordVaccineModal
        visible={showRecordModal}
        dose={selectedDose}
        onClose={() => { setShowRecordModal(false); setSelectedDose(null); }}
        onSave={handleSaveRecord}
        themeColors={themeColors}
      />

      <VaccineDetailModal
        visible={showDetailModal}
        series={selectedSeries}
        onClose={() => { setShowDetailModal(false); setSelectedSeries(null); }}
      />

      <BabySwitcherModal
        visible={showBabySwitcher}
        onClose={() => setShowBabySwitcher(false)}
        babies={babies}
        currentBaby={currentBaby}
        onSwitch={switchBaby}
        themeColors={themeColors}
      />
    </View>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned (Matching GrowthDashboard)
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 24 },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    /* no shadow */,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  glassBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  glassContent: { flex: 1 },

  // ── Top Header ──
  topHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginHorizontal: 16, 
    marginBottom: 16 
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  babyChip: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  babyChipText: { flex: 1 },
  babyChipName: { fontSize: 16, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  babyChipAge: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 1 },
  addBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // ── Sticky Header ──
  stickyHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingBottom: 10 
  },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },

  // ── Section Header ──
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginHorizontal: 20, 
    marginBottom: 12, 
    marginTop: 8 
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Tab Bar ──
  tabBar: { 
    flexDirection: 'row', 
    marginHorizontal: 16, 
    marginBottom: 16, 
    padding: 4, 
    borderRadius: 16, 
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  tabItem: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 6, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Protection Score ──
  scoreContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18, 
    gap: 16 
  },
  scoreLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14 
  },
  scoreRing: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    borderWidth: 4, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  scoreValue: { fontSize: 24, fontWeight: '800' },
  scoreMax: { fontSize: 12, fontWeight: '600' },
  scoreLabels: { gap: 2 },
  scoreLabel: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  scoreSubLabel: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  scoreRight: { flex: 1, gap: 8 },
  scoreMini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreMiniBarWrap: { flex: 1 },
  scoreMiniBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreMiniBarFill: { height: '100%', borderRadius: 3 },
  scoreMiniValue: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'right' },

  // ── Category Grid ──
  categoryGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
    marginHorizontal: 16, 
    marginBottom: 16 
  },
  categoryCard: { 
    width: (SCREEN_W - 56) / 2, 
    padding: 14, 
    borderRadius: 20, 
    overflow: 'hidden',
    borderWidth: 1,
    /* no shadow */,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  categoryIconBg: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  categoryDesc: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  categoryProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  categoryProgressBg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  categoryProgressFill: { height: '100%', borderRadius: 3 },
  categoryProgressText: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
  categoryCount: { fontSize: 11, fontWeight: '500' },

  // ── Status Filter ──
  statusFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginHorizontal: 16,
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

  // ── Category Section ──
  categorySection: { marginBottom: 20 },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
    marginLeft: 20,
    letterSpacing: -0.3,
  },

  // ── Dose Detail Card ──
  doseDetailCard: {
    marginBottom: 10,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    /* no shadow */,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  doseDetailTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  doseDetailLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doseDetailIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doseDetailInfo: { gap: 1 },
  doseDetailName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  doseDetailMeta: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  doseDetailBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  doseDetailBadgeText: { fontSize: 11, fontWeight: '700' },
  doseDetailMiddle: { gap: 4, marginBottom: 10 },
  doseDetailDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doseDetailDateText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  doseDetailAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  doseDetailAlertText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  doseDetailNotesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  doseDetailNotesText: { fontSize: 11, color: '#94a3b8', flex: 1 },
  doseDetailBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.08)',
  },
  doseDetailDetailBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(100,116,139,0.08)',
  },
  doseDetailDetailText: { fontSize: 12, fontWeight: '600' },
  doseDetailRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doseDetailRecordText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  doseDetailDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#10b98112',
  },
  doseDetailDoneText: { fontSize: 12, fontWeight: '700', color: '#10b981' },

  // ── Timeline ──
  timelineHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16, 
    paddingBottom: 12 
  },
  timelineIconBg: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  timelineTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  timelineSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  timelineScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 0 },
  timelineNode: { alignItems: 'center', width: 70 },
  timelineNodeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineConnector: {
    width: 46,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: -2,
  },
  timelineNodeContent: { alignItems: 'center', gap: 2 },
  timelineNodeShort: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  timelineNodeDose: { fontSize: 10, color: '#64748b', fontWeight: '500' },
  timelineNodeStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // ── Next Dose Card ──
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

  // ── Insight Card ──
  insightCard: { 
    padding: 14, 
    marginBottom: 8, 
    borderRadius: 16, 
    marginHorizontal: 16, 
    /* no shadow */,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIconBg: { 
    width: 42, 
    height: 42, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  insightTime: { fontSize: 11, fontWeight: '500', color: '#94a3b8' },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#475569' },
  insightActionBadge: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8, 
    marginTop: 4 
  },
  insightActionText: { fontSize: 11, fontWeight: '700' },
  insightPriority: { width: 4, height: 36, borderRadius: 2 },

  // ── Travel Section ──
  travelHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16, 
    paddingBottom: 12 
  },
  travelIconBg: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  travelHeaderText: { flex: 1 },
  travelTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  travelSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  travelList: { paddingHorizontal: 16, paddingBottom: 8 },
  travelItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    gap: 10 
  },
  travelItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  travelItemDot: { width: 8, height: 8, borderRadius: 4 },
  travelItemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  travelItemDesc: { fontSize: 11, color: '#64748b', marginTop: 1 },
  travelItemStatus: { fontSize: 12, fontWeight: '700' },
  travelPlanBtn: {
    margin: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  travelPlanText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Quick Actions ──
  quickActions: { 
    flexDirection: 'row', 
    gap: DESIGN.spacing.md, 
    marginHorizontal: DESIGN.spacing.lg, 
    marginBottom: DESIGN.spacing.xxl, 
    marginTop: 8 
  },
  quickAction: { 
    flex: 1, 
    borderRadius: 16, 
    overflow: 'hidden', 
    /* no shadow */ 
  },
  quickActionGradient: { 
    paddingVertical: 16, 
    alignItems: 'center', 
    gap: 6 
  },
  quickActionIcon: { fontSize: 22 },
  quickActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Records ──
  recordsCard: { padding: 8 },
  recordRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    gap: 12 
  },
  recordIconBg: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  recordInfo: { flex: 1, gap: 2 },
  recordName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  recordMeta: { fontSize: 11, fontWeight: '500', color: '#64748b' },
  recordRight: { alignItems: 'flex-end', gap: 2 },
  recordDate: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  recordNotes: { fontSize: 10, color: '#94a3b8', maxWidth: 120 },
  emptyRecords: { padding: 32, alignItems: 'center', gap: 8 },
  emptyRecordsText: { fontSize: 16, fontWeight: '700', color: '#64748b' },
  emptyRecordsSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  // ── Empty States ──
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateTitle: { fontSize: 18, fontWeight: '700', color: '#64748b', marginTop: 16 },
  emptyStateText: { fontSize: 14, color: '#94a3b8', marginTop: 4 },

  // ── Attribution ──
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  attributionText: { fontSize: 11, color: '#94a3b8', textAlign: 'center' },

  // ── Section ──
  section: { marginBottom: DESIGN.spacing.xl },

  // ── No Data States ──
  noDataTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  noDataText: { fontSize: 15, fontWeight: '500', color: '#64748b', textAlign: 'center', marginHorizontal: 40, marginBottom: 24 },
  createBtn: { 
    paddingHorizontal: 32, 
    paddingVertical: 16, 
    borderRadius: 16, 
    shadowColor: '#667eea', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 8 
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  modalContent: { 
    width: '100%', 
    maxWidth: 400, 
    borderRadius: DESIGN.radius.xl, 
    padding: DESIGN.spacing.xxl, 
    overflow: 'hidden', 
    /* no shadow */ 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: '#1e293b' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  modalClose: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    backgroundColor: 'rgba(100,116,139,0.1)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, color: '#64748b' },
  input: { 
    height: 50, 
    borderRadius: 12, 
    backgroundColor: 'rgba(100,116,139,0.08)', 
    paddingHorizontal: 16, 
    fontSize: 16, 
    fontWeight: '600',
    color: '#1e293b',
  },
  inputMultiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
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
  saveButton: { marginTop: 6, borderRadius: 12, overflow: 'hidden' },
  saveButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Baby Switcher Modal ──
  babySwitcherModal: { 
    width: '85%', 
    maxWidth: 360, 
    borderRadius: 24, 
    padding: 20, 
    overflow: 'hidden' 
  },
  babySwitcherTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center', color: '#1e293b' },
  babySwitcherItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 8 
  },
  babySwitcherInfo: { flex: 1 },
  babySwitcherName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  babySwitcherMeta: { fontSize: 12, fontWeight: '500', marginTop: 2, color: '#64748b' },

  // ── Detail Modal ──
  detailSection: { marginBottom: 20 },
  detailLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  detailText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: { fontSize: 12, fontWeight: '700' },
  doseDetailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
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
  doseDetailNumberText: { fontSize: 12, fontWeight: '800', color: '#667eea' },
  doseDetailContent: { flex: 1 },
  doseDetailAge: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  doseDetailDesc: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 18 },
  contraindicationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  contraindicationText: { fontSize: 13, color: '#475569', flex: 1 },
  noContraindications: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
});