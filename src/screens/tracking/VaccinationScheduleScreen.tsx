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
  ActivityIndicator,
  Pressable,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  runOnJS,
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
  startOfDay,
} from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useBaby, BabyProfile } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useTheme } from '../../context/AppContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { supabase } from '../../lib/supabase';

declare const __DEV__: boolean;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (Platform.OS === 'android' && !IS_FABRIC && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
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
  doses: Omit<
    VaccineDose,
    'id' | 'status' | 'dueDate' | 'category' | 'completedDate' | 'notes' | 'recordedBy'
  >[];
}

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
   VACCINE SCHEDULE DATA (unchanged — full WHO/CDC schedule)
   ═══════════════════════════════════════════════════════════════════════════ */

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
const SUPABASE_SCHEDULE_KEY = 'canonical_vaccine_schedule_v1';

/* ═══════════════════════════════════════════════════════════════════════════
   SUPABASE LOADER
   ═══════════════════════════════════════════════════════════════════════════ */

async function loadVaccineScheduleFromSupabase(): Promise<VaccineSeries[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const queries: any[] = [
      supabase.from('app_settings').select('value').eq('key', SUPABASE_SCHEDULE_KEY).maybeSingle(),
    ];

    if (user?.id) {
      queries.push(
        supabase.from('app_settings').select('value')
          .eq('key', `${SUPABASE_SCHEDULE_KEY}:${user.id}`)
          .eq('user_id', user.id)
          .maybeSingle()
      );
    }

    const results = await Promise.all(queries);

    for (const res of [...results].reverse()) {
      const raw = res?.data?.value;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* ignore bad JSON */ }
      }
    }

    if (VACCINE_SERIES.length > 0) {
      await supabase
        .from('app_settings')
        .upsert(
          {
            key: SUPABASE_SCHEDULE_KEY,
            value: JSON.stringify(VACCINE_SERIES),
            user_id: user?.id ?? '00000000-0000-0000-0000-000000000000',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key, user_id' }
        )
        .then(() => {}, () => {});
    }
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Vaccination] Supabase schedule load failed:', e);
    }
  }
  return VACCINE_SERIES;
}

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
   GradientText + PressableScale + SectionHeader
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const SectionHeader = memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  action?: () => void; actionLabel?: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionActionText, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Vaccine Pulse — compact animated header (no hero card)
   ═══════════════════════════════════════════════════════════════════════════ */

const VaccinePulse = memo<{
  isDark: boolean;
  baby: BabyProfile | null;
  ageMonths: number;
  stats: { completed: number; overdue: number; due: number; total: number; progress: number };
  onBabyPress: () => void;
  onPDF: () => void;
  onAdd: () => void;
}>(({ isDark, baby, ageMonths, stats, onBabyPress, onPDF, onAdd }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, rotate, glow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const hasAttention = stats.overdue > 0;
  const statusColor = hasAttention ? DS.danger : stats.progress >= 80 ? DS.success : stats.progress >= 40 ? DS.primary : DS.warning;
  const statusLabel = !baby
    ? 'Add baby profile to start'
    : hasAttention
    ? `${stats.overdue} dose${stats.overdue === 1 ? '' : 's'} overdue`
    : stats.due > 0
    ? `${stats.due} due soon · ${stats.progress}% protected`
    : stats.progress === 100
    ? 'All up to date 🎉'
    : `${stats.progress}% protected · ${stats.completed}/${stats.total}`;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                {baby ? (
                  <SafeAvatar avatar={baby.avatar} size={44} fallbackIcon="happy-outline" fallbackColor={DS.primary} borderWidth={0} />
                ) : (
                  <Ionicons name="add-circle" size={26} color={DS.primary} />
                )}
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {baby?.name || 'Add Baby'}
              </Text>
              {baby && (
                <View style={[styles.pulseAgePill, { backgroundColor: `${DS.primary}18` }]}>
                  <Text style={[styles.pulseAgeText, { color: DS.primary }]}>{ageMonths}mo</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: hasAttention ? DS.danger : statusColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onPDF} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="document-text-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onAdd} activeScale={0.9}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add" size={22} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success }]}>{stats.completed}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>done</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{stats.due}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>due</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: stats.overdue > 0 ? DS.danger : DS.gray400 }]}>{stats.overdue}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>late</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{stats.total}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>total</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */

const AuraRibbon = memo<{
  isDark: boolean; icon: keyof typeof Ionicons.glyphMap; color: string;
  label: string; text: string; onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Protection Ring (compact, replaces score card)
   ═══════════════════════════════════════════════════════════════════════════ */

const ProtectionRing = memo<{ stats: any; isDark: boolean; onPress: () => void }>(({ stats, isDark, onPress }) => {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(stats.progress, 100);
  const offset = circumference - (progress / 100) * circumference;

  const progressColor = progress >= 80 ? DS.success : progress >= 50 ? DS.primary : progress >= 25 ? DS.warning : DS.danger;

  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <LinearGradient
            colors={[`${progressColor}10`, `${progressColor}02`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.lg }}>
            {/* Ring */}
            <View style={{ width: size, height: size }}>
              {(() => {
                try {
                  const Svg = require('react-native-svg').default || require('react-native-svg');
                  const { Circle, Defs, LinearGradient: SvgGradient, Stop } = require('react-native-svg');
                  return (
                    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                      <Defs>
                        <SvgGradient id="protRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor={DS.primary} />
                          <Stop offset="100%" stopColor={DS.accent} />
                        </SvgGradient>
                      </Defs>
                      <Circle
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                        strokeWidth={stroke} fill="none"
                      />
                      <Circle
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke="url(#protRingGrad)"
                        strokeWidth={stroke} fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                      />
                    </Svg>
                  );
                } catch {
                  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: progressColor }} />;
                }
              })()}
              <View style={styles.ringInner}>
                <Text style={[styles.ringVal, { color: isDark ? DS.white : DS.gray900 }]}>{progress}</Text>
                <Text style={[styles.ringLbl, { color: isDark ? DS.gray500 : DS.gray400 }]}>/100</Text>
              </View>
            </View>

            {/* Labels + mini bars */}
            <View style={{ flex: 1, gap: 8 }}>
              <View>
                <Text style={[styles.protTitle, { color: isDark ? DS.white : DS.gray900 }]}>Protection</Text>
                <Text style={[styles.protSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Immunity index</Text>
              </View>
              {[
                { label: 'Core', value: stats.completed, total: stats.total, color: DS.success },
                { label: 'Due', value: stats.due, total: stats.total || 1, color: DS.warning },
                { label: 'Late', value: stats.overdue, total: stats.total || 1, color: DS.danger },
              ].map((s) => (
                <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.protMiniLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{s.label}</Text>
                  <View style={[styles.protBarBg, { backgroundColor: `${s.color}12` }]}>
                    <View style={[styles.protBarFill, {
                      width: `${Math.min((s.value / (s.total || 1)) * 100, 100)}%`,
                      backgroundColor: s.color,
                    }]} />
                  </View>
                  <Text style={[styles.protMiniValue, { color: s.color }]}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Category Pills (horizontal)
   ═══════════════════════════════════════════════════════════════════════════ */

const CategoryPills = memo<{
  doses: VaccineDose[];
  activeCategory: string;
  onSelect: (key: string) => void;
  isDark: boolean;
}>(({ doses, activeCategory, onSelect, isDark }) => {
  const categories = useMemo(() => {
    const base = [
      { key: 'all', label: 'All', icon: 'grid-outline' as const, color: DS.primary },
      { key: 'core', label: 'Core', icon: 'shield-checkmark' as const, color: DS.success },
      { key: 'recommended', label: 'Recommended', icon: 'star' as const, color: DS.info },
      { key: 'high_risk', label: 'High Risk', icon: 'warning' as const, color: DS.warning },
      { key: 'travel', label: 'Travel', icon: 'airplane' as const, color: '#8b5cf6' },
    ];
    return base.map(c => {
      if (c.key === 'all') return { ...c, count: doses.length };
      const seriesIds = VACCINE_SERIES.filter(s => s.category === c.key).map(s => s.id);
      return { ...c, count: doses.filter(d => seriesIds.includes(d.vaccineId)).length };
    }).filter(c => c.key === 'all' || c.count > 0);
  }, [doses]);

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}
      >
        {categories.map((c) => {
          const active = activeCategory === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() => onSelect(c.key)}
              activeOpacity={0.85}
              style={[
                styles.catPill,
                {
                  backgroundColor: active ? c.color : isDark ? DS.darkCard : DS.white,
                  borderColor: active ? c.color : isDark ? DS.darkBorder : DS.gray200,
                },
              ]}
            >
              <Ionicons name={c.icon} size={13} color={active ? DS.white : c.color} />
              <Text style={[styles.catPillText, { color: active ? DS.white : isDark ? DS.gray300 : DS.gray700 }, active && { fontWeight: '700' }]}>
                {c.label}
              </Text>
              <View style={[
                styles.catPillBadge,
                { backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${c.color}15` },
              ]}>
                <Text style={[styles.catPillBadgeText, { color: active ? DS.white : c.color }]}>{c.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Tab Bar
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = memo(({ tabs, activeTab, onChange, isDark }: {
  tabs: { key: VaccineTab; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: VaccineTab;
  onChange: (t: VaccineTab) => void;
  isDark: boolean;
}) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab) => {
      const active = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tabItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}
        >
          <Ionicons name={tab.icon} size={15} color={active ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
          <Text style={[styles.tabLabel, { color: active ? DS.primary : isDark ? DS.gray400 : DS.gray500 }, active && { fontWeight: '700' }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Status Filter
   ═══════════════════════════════════════════════════════════════════════════ */

const StatusFilterRow = memo(({ selected, onChange, counts, isDark }: {
  selected: StatusFilter; onChange: (s: StatusFilter) => void;
  counts: Record<StatusFilter, number>; isDark: boolean;
}) => {
  const opts: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: DS.primary },
    { key: 'pending', label: 'Pending', color: DS.warning },
    { key: 'completed', label: 'Done', color: DS.success },
    { key: 'overdue', label: 'Late', color: DS.danger },
  ];
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: DS.space.lg, gap: 8, marginBottom: DS.space.md }}>
      {opts.map(o => {
        const active = selected === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.statusChip,
              {
                backgroundColor: active ? o.color : isDark ? DS.darkCard : DS.white,
                borderColor: active ? o.color : isDark ? DS.darkBorder : DS.gray200,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.statusChipText, { color: active ? DS.white : isDark ? DS.gray300 : DS.gray700 }, active && { fontWeight: '700' }]}>
              {o.label}
            </Text>
            <Text style={[styles.statusChipBadge, { color: active ? DS.white : o.color }, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              {counts[o.key] || 0}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Timeline
   ═══════════════════════════════════════════════════════════════════════════ */

const VaccineTimeline = memo(({ doses, onDosePress, isDark }: {
  doses: VaccineDose[]; onDosePress: (d: VaccineDose) => void; isDark: boolean;
}) => {
  const timelineItems = useMemo(() => {
    return [...doses]
      .sort((a, b) => {
        const da = safeParseDate(a.dueDate), db = safeParseDate(b.dueDate);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      })
      .map((dose) => ({
        ...dose,
        isPast: safeParseDate(dose.dueDate) ? isBefore(safeParseDate(dose.dueDate)!, startOfDay(new Date())) : false,
      }));
  }, [doses]);

  if (!timelineItems.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md, marginBottom: DS.space.md }}>
          <View style={[styles.sectionIcon, { backgroundColor: `${DS.primary}18` }]}>
            <Ionicons name="time-outline" size={16} color={DS.primary} />
          </View>
          <View>
            <Text style={[styles.tlTitle, { color: isDark ? DS.white : DS.gray900 }]}>Vaccine Timeline</Text>
            <Text style={[styles.tlSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Your immunization journey</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          {timelineItems.map((item, i) => {
            const statusColor =
              item.status === 'completed' ? DS.success
              : item.status === 'overdue' ? DS.danger
              : item.status === 'due' ? DS.warning
              : DS.info;
            const statusLabel =
              item.status === 'completed' ? 'Done'
              : item.status === 'overdue' ? 'Late'
              : item.status === 'due' ? 'Soon' : 'Soon';
            return (
              <TouchableOpacity key={item.id} onPress={() => onDosePress(item)} style={styles.tlNode}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.tlDot, { backgroundColor: statusColor, borderColor: statusColor }]}>
                    {item.status === 'completed' && <Ionicons name="checkmark" size={10} color="#fff" />}
                  </View>
                  {i < timelineItems.length - 1 && (
                    <View style={[styles.tlConnector, {
                      backgroundColor: item.status === 'completed' && timelineItems[i + 1]?.status === 'completed'
                        ? DS.success
                        : isDark ? 'rgba(255,255,255,0.1)' : DS.gray200,
                    }]} />
                  )}
                </View>
                <View style={{ alignItems: 'center', marginTop: 8, gap: 2 }}>
                  <Text style={[styles.tlNodeShort, { color: isDark ? DS.white : DS.gray900 }]}>{item.shortName}</Text>
                  <Text style={[styles.tlNodeDose, { color: isDark ? DS.gray500 : DS.gray400 }]}>D{item.doseNumber}</Text>
                  <Text style={[styles.tlNodeStatus, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Dose Row (compact ribbon-style)
   ═══════════════════════════════════════════════════════════════════════════ */

const DoseRow = memo(({ dose, index, onComplete, onViewDetails, isDark }: {
  dose: VaccineDose;
  index: number;
  onComplete: (d: VaccineDose) => void;
  onViewDetails: (s: VaccineSeries) => void;
  isDark: boolean;
}) => {
  const series = VACCINE_SERIES.find(s => s.id === dose.vaccineId);
  const daysUntilDue = safeDiffDays(dose.dueDate, new Date());
  const config = {
    completed: { color: DS.success, icon: 'checkmark-circle' as const, label: 'Done' },
    due: { color: DS.warning, icon: 'time' as const, label: 'Due' },
    overdue: { color: DS.danger, icon: 'alert-circle' as const, label: 'Late' },
    upcoming: { color: DS.info, icon: 'calendar' as const, label: 'Soon' },
    scheduled: { color: '#8b5cf6', icon: 'calendar-outline' as const, label: 'Set' },
  }[dose.status];

  const showBorder = dose.status === 'overdue' || dose.status === 'due';

  return (
    <Animated.View entering={FadeInUp.delay(index * 40).springify()}>
      <PressableScale onPress={() => series && onViewDetails(series)} activeScale={0.98}>
        <View style={[styles.doseRow, {
          backgroundColor: isDark ? DS.darkCard : DS.white,
          borderColor: showBorder
            ? config.color + '45'
            : isDark ? DS.darkBorder : DS.gray200,
          borderLeftColor: config.color,
          borderLeftWidth: 3,
        }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
            <View style={[styles.doseIcon, { backgroundColor: `${config.color}15` }]}>
              <Ionicons name={config.icon} size={18} color={config.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.doseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                  {dose.vaccineName}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: `${config.color}15` }]}>
                  <Text style={[styles.statusPillText, { color: config.color }]}>{config.label}</Text>
                </View>
              </View>
              <Text style={[styles.doseMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                Dose {dose.doseNumber}/{dose.totalDoses} · {dose.recommendedAgeLabel}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Ionicons name="calendar-outline" size={11} color={isDark ? DS.gray500 : DS.gray400} />
                <Text style={[styles.doseDate, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                  {dose.status === 'completed' && dose.completedDate
                    ? `Given ${safeFmt(dose.completedDate, 'MMM d')}`
                    : dose.status === 'overdue'
                    ? `${Math.abs(daysUntilDue)}d overdue`
                    : `Due ${safeFmt(dose.dueDate, 'MMM d')}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.doseActions}>
            {dose.status !== 'completed' && (
              <PressableScale onPress={() => onComplete(dose)} activeScale={0.94}>
                <LinearGradient
                  colors={dose.status === 'overdue' ? [DS.danger, '#dc2626'] : [DS.primary, DS.accent]}
                  style={styles.doseRecordBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="checkmark" size={13} color={DS.white} />
                  <Text style={styles.doseRecordText}>Record</Text>
                </LinearGradient>
              </PressableScale>
            )}
            {dose.status === 'completed' && (
              <View style={[styles.doseDoneBadge, { backgroundColor: `${DS.success}12` }]}>
                <Ionicons name="checkmark-done" size={13} color={DS.success} />
                <Text style={[styles.doseDoneText, { color: DS.success }]}>Recorded</Text>
              </View>
            )}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Insights Card
   ═══════════════════════════════════════════════════════════════════════════ */

const VaccineInsights = memo(({
  doses, baby, isDark, onInsightPress,
}: {
  doses: VaccineDose[];
  baby: BabyProfile | null;
  isDark: boolean;
  onInsightPress: (i: VaccineInsight) => void;
}) => {
  const insights = useMemo((): VaccineInsight[] => {
    const items: VaccineInsight[] = [];
    const now = Date.now();
    const ageMonths = baby ? safeDiffMonths(new Date(), baby.birthDate) : 0;

    const overdueDoses = doses.filter(d => d.status === 'overdue');
    if (overdueDoses.length > 0) {
      const mostUrgent = overdueDoses.sort((a, b) => {
        const da = safeParseDate(a.dueDate), db = safeParseDate(b.dueDate);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      })[0];
      const daysLate = Math.abs(safeDiffDays(mostUrgent.dueDate, new Date()));
      items.push({
        id: 'urgent-overdue',
        type: 'urgent',
        title: `${mostUrgent.vaccineName} Overdue`,
        description: `${daysLate} days past due. Schedule appointment ASAP to maintain protection.`,
        emoji: '⚠️',
        color: DS.danger,
        priority: 'high',
        action: { label: 'Schedule', screen: 'VaccinationSchedule', params: { filter: 'overdue' } },
        timestamp: now,
      });
    }

    doses.filter(d => d.status === 'due').slice(0, 1).forEach(d => {
      const daysUntil = safeDiffDays(d.dueDate, new Date());
      items.push({
        id: `upcoming-${d.id}`,
        type: 'upcoming',
        title: `${d.vaccineName} Due Soon`,
        description: `Due in ${daysUntil} days (${safeFmt(d.dueDate, 'MMM d')}). Prepare for appointment.`,
        emoji: '💉',
        color: DS.warning,
        priority: 'medium',
        action: { label: 'Record', screen: 'VaccinationSchedule', params: { doseId: d.id } },
        timestamp: now,
      });
    });

    const recentlyCompleted = doses.filter(d => d.completedDate && safeDiffDays(new Date(), d.completedDate) <= 7);
    if (recentlyCompleted.length > 0) {
      items.push({
        id: 'recent-completion',
        type: 'completed',
        title: 'Great Progress! 🎉',
        description: `${recentlyCompleted.length} dose${recentlyCompleted.length > 1 ? 's' : ''} completed recently. Keep it up!`,
        emoji: '🛡️',
        color: DS.success,
        priority: 'low',
        timestamp: now,
      });
    }

    if (ageMonths >= 6 && ageMonths < 7) {
      const fluDose = doses.find(d => d.vaccineId === 'flu' && d.doseNumber === 1);
      if (fluDose && fluDose.status === 'upcoming') {
        items.push({
          id: 'flu-recommendation',
          type: 'info',
          title: 'Flu Season Ready',
          description: 'Annual flu vaccination is now recommended. Consider scheduling with your pediatrician.',
          emoji: '🤧',
          color: DS.info,
          priority: 'medium',
          action: { label: 'Learn More', screen: 'VaccineDetail', params: { vaccineId: 'flu' } },
          timestamp: now,
        });
      }
    }

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
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }).slice(0, 4);
  }, [doses, baby]);

  if (!insights.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(160).springify()}>
      <SectionHeader
        title="Smart Insights"
        subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`}
        icon="sparkles-outline"
        color={DS.accent}
      />
      <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
        {insights.map((insight, i) => (
          <PressableScale key={insight.id} onPress={() => onInsightPress(insight)} activeScale={0.98}>
            <View style={[styles.insightCard, {
              backgroundColor: isDark ? DS.darkCard : DS.white,
              borderColor: insight.priority === 'high' ? `${insight.color}50` : isDark ? DS.darkBorder : DS.gray200,
              borderLeftColor: insight.color,
              borderLeftWidth: 3,
            }]}>
              <LinearGradient
                colors={[`${insight.color}10`, `${insight.color}02`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
                <View style={[styles.insightIcon, { backgroundColor: `${insight.color}15` }]}>
                  <Text style={{ fontSize: 20 }}>{insight.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.insightTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{insight.title}</Text>
                  <Text style={[styles.insightDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{insight.description}</Text>
                  {insight.action && (
                    <View style={[styles.insightAction, { backgroundColor: `${insight.color}12` }]}>
                      <Text style={[styles.insightActionText, { color: insight.color }]}>{insight.action.label} →</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Travel Planner
   ═══════════════════════════════════════════════════════════════════════════ */

const TravelPlanner = memo(({ doses, isDark, onPlan }: { doses: VaccineDose[]; isDark: boolean; onPlan: () => void }) => {
  const travelDoses = useMemo(() => {
    const travelIds = VACCINE_SERIES.filter(s => s.category === 'travel').map(s => s.id);
    return doses.filter(d => travelIds.includes(d.vaccineId) && d.status !== 'completed');
  }, [doses]);

  if (!travelDoses.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Travel Ready" subtitle={`${travelDoses.length} pending`} icon="airplane-outline" color="#8b5cf6" />
      <View style={{ paddingHorizontal: DS.space.lg }}>
        <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: '#8b5cf640', borderLeftColor: '#8b5cf6', borderLeftWidth: 3 }]}>
          {travelDoses.map((dose, i) => (
            <View key={dose.id} style={[styles.travelRow, i < travelDoses.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
            }]}>
              <View style={[styles.travelDot, { backgroundColor: dose.status === 'overdue' ? DS.danger : DS.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.travelName, { color: isDark ? DS.white : DS.gray900 }]}>{dose.vaccineName}</Text>
                <Text style={[styles.travelDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                  {dose.status === 'overdue' ? 'Overdue' : 'Pending'}
                </Text>
              </View>
              <Text style={[styles.travelStatus, { color: dose.status === 'overdue' ? DS.danger : DS.warning }]}>
                {dose.status === 'overdue' ? 'Late' : 'Soon'}
              </Text>
            </View>
          ))}
          <PressableScale onPress={onPlan} activeScale={0.97} style={{ marginTop: DS.space.md }}>
            <LinearGradient colors={['#8b5cf6', '#a78bfa']} style={styles.travelBtn}>
              <Ionicons name="map" size={16} color={DS.white} />
              <Text style={styles.travelBtnText}>Plan Travel Vaccines</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Modals
   ═══════════════════════════════════════════════════════════════════════════ */

const RecordVaccineModal = memo(({ visible, dose, onClose, onSave, isDark }: any) => {
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
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Record {dose.vaccineName}</Text>
              <Text style={[styles.modalSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Dose {dose.doseNumber} of {dose.totalDoses}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.6 }}>
            <Text style={[styles.modalInputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Date given</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            />

            <Text style={[styles.modalInputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Location</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
              value={location}
              onChangeText={setLocation}
              placeholder="Clinic or hospital"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            />

            <Text style={[styles.modalInputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Batch number</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
              value={batchNumber}
              onChangeText={setBatchNumber}
              placeholder="Vaccine lot number"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            />

            {dose.sideEffects?.length > 0 && (
              <>
                <Text style={[styles.modalInputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Side effects observed</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {dose.sideEffects.map((effect: string) => {
                    const active = selectedSideEffects.includes(effect);
                    return (
                      <TouchableOpacity
                        key={effect}
                        onPress={() => toggleSideEffect(effect)}
                        style={[
                          styles.sideChip,
                          {
                            backgroundColor: active ? `${DS.primary}20` : isDark ? 'rgba(255,255,255,0.05)' : DS.gray100,
                            borderColor: active ? DS.primary : 'transparent',
                          },
                        ]}
                      >
                        <Text style={[styles.sideChipText, { color: active ? DS.primary : isDark ? DS.gray300 : DS.gray700 }, active && { fontWeight: '700' }]}>
                          {effect}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[styles.modalInputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Notes</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Any reactions or observations..."
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            />
          </ScrollView>

          <PressableScale onPress={handleSave} activeScale={0.97} style={{ marginTop: 12 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.modalSaveBtn}>
              <Ionicons name="checkmark-circle" size={18} color={DS.white} />
              <Text style={styles.modalSaveText}>Save Record</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
});

const VaccineDetailModal = memo(({ visible, series, onClose, isDark }: {
  visible: boolean; series: VaccineSeries | null; onClose: () => void; isDark: boolean;
}) => {
  if (!series) return null;

  const catColor =
    series.category === 'core' ? DS.success
    : series.category === 'recommended' ? DS.info
    : series.category === 'travel' ? '#8b5cf6' : DS.warning;
  const catLabel =
    series.category === 'core' ? 'Core'
    : series.category === 'recommended' ? 'Recommended'
    : series.category === 'travel' ? 'Travel' : 'High Risk';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{series.name}</Text>
              <Text style={[styles.modalSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{series.description}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.65 }}>
            <View style={[styles.detailBadge, { backgroundColor: `${catColor}15` }]}>
              <Text style={[styles.detailBadgeText, { color: catColor }]}>{catLabel}</Text>
            </View>

            <Text style={[styles.detailSectionLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Dosing Schedule</Text>
            {series.doses.map((dose, i) => (
              <View key={i} style={styles.detailDoseRow}>
                <View style={[styles.detailDoseNum, { backgroundColor: `${DS.primary}15` }]}>
                  <Text style={[styles.detailDoseNumText, { color: DS.primary }]}>{dose.doseNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailDoseAge, { color: isDark ? DS.white : DS.gray900 }]}>{dose.recommendedAgeLabel}</Text>
                  <Text style={[styles.detailDoseDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>{dose.description}</Text>
                </View>
              </View>
            ))}

            <Text style={[styles.detailSectionLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Contraindications</Text>
            {series.doses[0].contraindications.length > 0 ? (
              series.doses[0].contraindications.map((c, i) => (
                <View key={i} style={styles.contraRow}>
                  <Ionicons name="warning-outline" size={14} color={DS.danger} />
                  <Text style={[styles.contraText, { color: isDark ? DS.gray300 : DS.gray700 }]}>{c}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.noContra, { color: isDark ? DS.gray500 : DS.gray400 }]}>No specific contraindications listed</Text>
            )}

            <Text style={[styles.detailSectionLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Route</Text>
            <Text style={[styles.detailText, { color: isDark ? DS.gray300 : DS.gray700 }]}>{series.doses[0].route}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function VaccinationScheduleScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { triggerHaptic } = useCustomization();
  const { isDark } = useTheme();
  const { currentBaby } = useBaby();

  const [doses, setDoses] = useState<VaccineDose[]>([]);
  const [activeTab, setActiveTab] = useState<VaccineTab>('schedule');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedDose, setSelectedDose] = useState<VaccineDose | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<VaccineSeries | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const currentBabyRef = useRef(currentBaby);
  currentBabyRef.current = currentBaby;

  /* ── loadRecords — declared BEFORE useFocusEffect ── */
  const loadRecords = useCallback(async () => {
    const baby = currentBabyRef.current;
    if (!baby) {
      setDoses([]);
      setIsLoadingInitial(false);
      return;
    }
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY}_${baby.id}`);
      const records: Record<string, { completedDate: string; notes: string; sideEffects: string[]; batchNumber?: string; location?: string }> =
        stored ? JSON.parse(stored) : {};

      const schedule = await loadVaccineScheduleFromSupabase();
      const birthDate = safeParseDate(baby.birthDate) || new Date();
      const generatedDoses: VaccineDose[] = [];

      schedule.forEach((series) => {
        series.doses.forEach((dose) => {
          const dueDate = addDays(birthDate, dose.recommendedAgeDays);
          const record = records[`${series.id}_${dose.doseNumber}`];
          let status: VaccineDose['status'] = 'upcoming';
          if (record) status = 'completed';
          else if (isBefore(startOfDay(dueDate), startOfDay(new Date()))) status = 'overdue';
          else if (safeDiffDays(dueDate, new Date()) <= 14) status = 'due';

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
            category:
              dose.recommendedAgeDays <= 30 ? 'birth'
              : dose.recommendedAgeDays <= 365 ? 'infant'
              : dose.recommendedAgeDays <= 730 ? 'toddler'
              : dose.recommendedAgeDays <= 2190 ? 'preschool'
              : 'adolescent',
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
        const da = safeParseDate(a.dueDate), db = safeParseDate(b.dueDate);
        if (!da || !db) return 0;
        return da.getTime() - db.getTime();
      }));
    } catch (error) {
      console.error('Error loading vaccination records:', error);
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [currentBaby?.id, loadRecords]);

  useFocusEffect(useCallback(() => { loadRecords(); }, [loadRecords]));

  const babyModalShownRef = useRef(false);
  useEffect(() => {
    if (!currentBaby && !babyModalShownRef.current && !isLoadingInitial) {
      babyModalShownRef.current = true;
      const timer = setTimeout(() => setShowBabyRequiredModal(true), 400);
      return () => clearTimeout(timer);
    }
    if (currentBaby) babyModalShownRef.current = false;
  }, [currentBaby, isLoadingInitial]);

  const saveRecord = useCallback(async (doseId: string, data: any) => {
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
      HAPTIC_SUCCESS();
    } catch (error) {
      console.error('Error saving record:', error);
    }
  }, [currentBaby, loadRecords]);

  const handleComplete = useCallback((dose: VaccineDose) => {
    setSelectedDose(dose);
    setShowRecordModal(true);
  }, []);

  const handleSaveRecord = useCallback((doseId: string, data: any) => {
    saveRecord(doseId, data);
    setShowRecordModal(false);
    setSelectedDose(null);
  }, [saveRecord]);

  const handleViewDetails = useCallback((series: VaccineSeries) => {
    setSelectedSeries(series);
    setShowDetailModal(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadRecords(); }
    catch (e) { console.warn('Refresh failed', e); }
    finally { setRefreshing(false); }
  }, [loadRecords]);

  const handleTabChange = useCallback((tab: VaccineTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    HAPTIC_LIGHT();
  }, []);

  const handleCategoryPress = useCallback((cat: string) => {
    setActiveCategory(cat);
    setActiveTab('schedule');
    HAPTIC_LIGHT();
  }, []);

  const handleInsightPress = useCallback((insight: VaccineInsight) => {
    HAPTIC_LIGHT();
    if (insight.action?.screen) {
      navigation.navigate(insight.action.screen, insight.action.params);
    }
  }, [navigation]);

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

  const filterCounts = useMemo((): Record<StatusFilter, number> => {
    let base = doses;
    if (activeCategory !== 'all') {
      const seriesIds = VACCINE_SERIES.filter(s => s.category === activeCategory).map(s => s.id);
      base = base.filter(d => seriesIds.includes(d.vaccineId));
    }
    return {
      all: base.length,
      pending: base.filter(d => d.status === 'due' || d.status === 'overdue' || d.status === 'upcoming').length,
      completed: base.filter(d => d.status === 'completed').length,
      overdue: base.filter(d => d.status === 'overdue').length,
    };
  }, [doses, activeCategory]);

  /* ── Grouped ── */
  const groupedDoses = useMemo(() => {
    const groups: Record<string, VaccineDose[]> = {};
    filteredDoses.forEach((dose) => {
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

  const ageMonths = useMemo(() => currentBaby ? safeDiffMonths(new Date(), currentBaby.birthDate) : 0, [currentBaby]);

  /* ── Ribbon ── */
  const topRibbon = useMemo(() => {
    if (!currentBaby) {
      return {
        icon: 'information-circle-outline' as const,
        color: DS.info,
        label: 'Baby profile needed',
        text: 'Add a baby profile to start tracking immunizations',
        onPress: () => navigation.navigate('CreateBabyProfile'),
      };
    }
    if (stats.overdue > 0) {
      const overdueDose = doses.find(d => d.status === 'overdue');
      return {
        icon: 'alert-circle-outline' as const,
        color: DS.danger,
        label: `${stats.overdue} overdue`,
        text: overdueDose ? `${overdueDose.vaccineName} — Dose ${overdueDose.doseNumber} is late. Schedule now` : 'Schedule an appointment',
        onPress: () => setStatusFilter('overdue'),
      };
    }
    if (stats.due > 0) {
      const dueDose = doses.find(d => d.status === 'due');
      return {
        icon: 'time-outline' as const,
        color: DS.warning,
        label: 'Up next',
        text: dueDose ? `${dueDose.vaccineName} due ${safeFmt(dueDose.dueDate, 'MMM d')}` : `${stats.due} due soon`,
        onPress: () => setStatusFilter('pending'),
      };
    }
    if (stats.progress === 100) {
      return {
        icon: 'shield-checkmark-outline' as const,
        color: DS.success,
        label: 'All protected',
        text: 'All vaccines for current age are up to date 🎉',
      };
    }
    return {
      icon: 'sparkles-outline' as const,
      color: DS.primary,
      label: 'On track',
      text: `${stats.progress}% of scheduled vaccines complete — keep going`,
    };
  }, [currentBaby, stats, doses, navigation]);

  const tabs: { key: VaccineTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'schedule', label: 'Schedule', icon: 'calendar-outline' },
    { key: 'timeline', label: 'Timeline', icon: 'time-outline' },
    { key: 'insights', label: 'Insights', icon: 'bulb-outline' },
    { key: 'records', label: 'Records', icon: 'document-text-outline' },
  ];

  const completedDoses = doses.filter(d => d.status === 'completed');

  /* ─── RENDER ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[
          styles.stickyHeader,
          {
            paddingTop: HEADER_TOP_PADDING,
            backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
          headerAnim,
        ]}
      >
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              VACCINES
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby ? `${currentBaby.name} · ${ageMonths}mo` : 'No baby'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('PediatricianPDFExport')}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="document-text-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={DS.primary} colors={[DS.primary, DS.accent]}
            progressViewOffset={HEADER_TOTAL_HEIGHT} />
        }
      >
        {/* Pulse */}
        <VaccinePulse
          isDark={isDark}
          baby={currentBaby}
          ageMonths={ageMonths}
          stats={stats}
          onBabyPress={() => {
            if (!currentBaby) navigation.navigate('CreateBabyProfile');
            else navigation.navigate('SwitchBaby', { returnTo: 'Main', returnLabel: 'Vaccines' });
          }}
          onPDF={() => navigation.navigate('PediatricianPDFExport')}
          onAdd={() => {
            if (!currentBaby) { setShowBabyRequiredModal(true); return; }
            const nextDue = doses.find(d => d.status === 'due' || d.status === 'overdue');
            if (nextDue) handleComplete(nextDue);
          }}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Protection Ring */}
        {currentBaby && (
          <View style={{ marginTop: DS.space.md }}>
            <ProtectionRing stats={stats} isDark={isDark} onPress={() => setActiveTab('records')} />
          </View>
        )}

        {/* Category Pills */}
        {currentBaby && doses.length > 0 && (
          <View style={{ marginTop: DS.space.md }}>
            <CategoryPills doses={doses} activeCategory={activeCategory} onSelect={handleCategoryPress} isDark={isDark} />
          </View>
        )}

        {/* Tabs */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {/* ═══ TAB: SCHEDULE ═══ */}
        {activeTab === 'schedule' && (
          <>
            {currentBaby && doses.length > 0 && (
              <View style={{ marginTop: DS.space.md }}>
                <StatusFilterRow
                  selected={statusFilter}
                  onChange={setStatusFilter}
                  counts={filterCounts}
                  isDark={isDark}
                />
              </View>
            )}

            {isLoadingInitial ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <ActivityIndicator color={DS.primary} size="large" />
                <Text style={{ color: isDark ? DS.gray400 : DS.gray500, marginTop: 12, fontSize: 13, fontWeight: '500' }}>
                  Loading schedule…
                </Text>
              </View>
            ) : Object.entries(groupedDoses).length > 0 ? (
              Object.entries(groupedDoses).map(([category, categoryDoses]) => (
                <View key={category} style={{ marginTop: DS.space.lg }}>
                  <Text style={[styles.groupLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    {categoryLabels[category] || category}
                  </Text>
                  <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                    {categoryDoses.map((dose, i) => (
                      <DoseRow
                        key={dose.id}
                        dose={dose}
                        index={i}
                        onComplete={handleComplete}
                        onViewDetails={handleViewDetails}
                        isDark={isDark}
                      />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <Ionicons name="shield-checkmark-outline" size={36} color={isDark ? DS.gray500 : DS.gray400} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No vaccines match</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Try changing category or status filter
                </Text>
              </View>
            )}

            <TravelPlanner doses={doses} isDark={isDark} onPlan={() => navigation.navigate('TravelPlanner')} />
          </>
        )}

        {/* ═══ TAB: TIMELINE ═══ */}
        {activeTab === 'timeline' && (
          <>
            <View style={{ marginTop: DS.space.md }}>
              <VaccineTimeline doses={doses} onDosePress={handleComplete} isDark={isDark} />
            </View>
            {(() => {
              const nextDose = doses.find(d => d.status === 'due' || d.status === 'overdue');
              if (!nextDose) return null;
              return (
                <Animated.View entering={FadeInUp.delay(200).springify()} style={{ marginTop: DS.space.md, paddingHorizontal: DS.space.lg }}>
                  <View style={[styles.nextDoseCard, {
                    backgroundColor: isDark ? DS.darkCard : DS.white,
                    borderColor: nextDose.status === 'overdue' ? `${DS.danger}40` : `${DS.warning}40`,
                    borderLeftColor: nextDose.status === 'overdue' ? DS.danger : DS.warning,
                  }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.md }}>
                      <Ionicons
                        name={nextDose.status === 'overdue' ? 'alert-circle' : 'notifications'}
                        size={24}
                        color={nextDose.status === 'overdue' ? DS.danger : DS.warning}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.nextDoseTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                          {nextDose.status === 'overdue' ? 'Vaccination overdue' : 'Next vaccination due'}
                        </Text>
                        <Text style={[styles.nextDoseText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                          {nextDose.vaccineName} — Dose {nextDose.doseNumber}/{nextDose.totalDoses}
                        </Text>
                        <Text style={[styles.nextDoseDate, {
                          color: nextDose.status === 'overdue' ? DS.danger : DS.warning,
                        }]}>
                          {nextDose.status === 'overdue'
                            ? `Overdue by ${Math.abs(safeDiffDays(nextDose.dueDate, new Date()))} days`
                            : `Due ${safeFmt(nextDose.dueDate, 'MMM d, yyyy')}`}
                        </Text>
                      </View>
                    </View>
                    <PressableScale onPress={() => handleComplete(nextDose)} activeScale={0.97} style={{ marginTop: DS.space.md }}>
                      <LinearGradient
                        colors={nextDose.status === 'overdue' ? [DS.danger, '#dc2626'] : [DS.primary, DS.accent]}
                        style={styles.nextDoseBtn}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.nextDoseBtnText}>Record Now</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                </Animated.View>
              );
            })()}
          </>
        )}

        {/* ═══ TAB: INSIGHTS ═══ */}
        {activeTab === 'insights' && (
          <>
            <View style={{ marginTop: DS.space.md }}>
              <VaccineInsights doses={doses} baby={currentBaby} isDark={isDark} onInsightPress={handleInsightPress} />
            </View>

            <Animated.View entering={FadeInUp.delay(240).springify()} style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
              <SectionHeader title="Related Tools" icon="link-outline" color={DS.info} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { icon: '📊', label: 'Growth', screen: 'GrowthDashboard', grad: [DS.primary, DS.primaryLight] as [string, string] },
                  { icon: '🌟', label: 'Milestones', screen: 'Timeline', grad: [DS.warning, '#fbbf24'] as [string, string] },
                  { icon: '🏆', label: 'Awards', screen: 'Achievements', grad: ['#8b5cf6', '#a78bfa'] as [string, string] },
                ].map((a, i) => (
                  <PressableScale key={i} onPress={() => navigation.navigate(a.screen, (a as any).params ?? undefined)} activeScale={0.94} style={{ flex: 1 }}>
                    <LinearGradient colors={a.grad} style={styles.quickAct} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Text style={{ fontSize: 20 }}>{a.icon}</Text>
                      <Text style={styles.quickActText}>{a.label}</Text>
                    </LinearGradient>
                  </PressableScale>
                ))}
              </View>
            </Animated.View>
          </>
        )}

        {/* ═══ TAB: RECORDS ═══ */}
        {activeTab === 'records' && (
          <View style={{ marginTop: DS.space.md }}>
            <SectionHeader
              title="Vaccination Records"
              subtitle={`${completedDoses.length} recorded`}
              icon="document-text-outline"
              color={DS.success}
            />
            <View style={{ paddingHorizontal: DS.space.lg }}>
              <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, padding: 0 }]}>
                {completedDoses.length > 0 ? (
                  completedDoses
                    .sort((a, b) => {
                      const da = safeParseDate(a.completedDate), db = safeParseDate(b.completedDate);
                      return (db?.getTime() || 0) - (da?.getTime() || 0);
                    })
                    .map((dose, i, arr) => (
                      <View
                        key={dose.id}
                        style={[styles.recordRow, i < arr.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
                        }]}
                      >
                        <View style={[styles.recordIcon, { backgroundColor: `${DS.success}15` }]}>
                          <Ionicons name="checkmark-circle" size={18} color={DS.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.recordName, { color: isDark ? DS.white : DS.gray900 }]}>{dose.vaccineName}</Text>
                          <Text style={[styles.recordMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                            Dose {dose.doseNumber}/{dose.totalDoses}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.recordDate, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                            {safeFmt(dose.completedDate, 'MMM d, yyyy')}
                          </Text>
                          {dose.notes && (
                            <Text style={[styles.recordNotes, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
                              {dose.notes}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))
                ) : (
                  <View style={styles.emptyState}>
                    <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                      <Ionicons name="clipboard-outline" size={36} color={isDark ? DS.gray500 : DS.gray400} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No records yet</Text>
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      Record a vaccination to see it here
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Attribution */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: DS.space.xl, paddingHorizontal: DS.space.lg }}>
          <Ionicons name="information-circle-outline" size={12} color={isDark ? DS.gray600 : DS.gray400} />
          <Text style={{ fontSize: 10, fontWeight: '500', color: isDark ? DS.gray600 : DS.gray400, textAlign: 'center', flex: 1 }}>
            WHO Routine Immunization Tables · CDC 2026 Childhood Schedule
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Baby Required Modal */}
      <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBabyRequiredModal(false)}>
          <View style={[styles.babyReqCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqIcon}>
              <Ionicons name="people-outline" size={28} color={DS.white} />
            </LinearGradient>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900, textAlign: 'center' }]}>Baby Profile Needed</Text>
            <Text style={[styles.modalSub, { color: isDark ? DS.gray400 : DS.gray500, textAlign: 'center', marginBottom: 20, marginTop: 6 }]}>
              Create a baby profile to start tracking vaccinations.
            </Text>
            <PressableScale
              onPress={() => { setShowBabyRequiredModal(false); navigation.navigate('CreateBabyProfile'); }}
              activeScale={0.97}
              style={{ width: '100%' }}
            >
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqBtn}>
                <Text style={styles.babyReqBtnText}>Create Baby Profile</Text>
                <Ionicons name="arrow-forward" size={16} color={DS.white} />
              </LinearGradient>
            </PressableScale>
            <TouchableOpacity onPress={() => setShowBabyRequiredModal(false)} style={{ paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Record Modal */}
      <RecordVaccineModal
        visible={showRecordModal}
        dose={selectedDose}
        onClose={() => { setShowRecordModal(false); setSelectedDose(null); }}
        onSave={handleSaveRecord}
        isDark={isDark}
      />

      {/* Detail Modal */}
      <VaccineDetailModal
        visible={showDetailModal}
        series={selectedSeries}
        onClose={() => { setShowDetailModal(false); setSelectedSeries(null); }}
        isDark={isDark}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, height: 48,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse */
  pulseWrap: {
    marginHorizontal: DS.space.lg, marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md,
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '75%' },
  pulseAgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseStats: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg, marginTop: DS.space.md,
  },
  pulseStat: { alignItems: 'center', flex: 1 },
  pulseStatVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pulseStatDiv: { width: 1, height: 22 },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Card */
  card: {
    marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg,
    padding: DS.space.md, borderWidth: 1, overflow: 'hidden',
    ...DS.shadow.sm,
  },

  /* Protection Ring */
  ringInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringVal: { fontSize: 22, fontWeight: '800' },
  ringLbl: { fontSize: 10, fontWeight: '600' },
  protTitle: { fontSize: 14, fontWeight: '800' },
  protSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  protMiniLabel: { fontSize: 10, fontWeight: '600', width: 32 },
  protBarBg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  protBarFill: { height: '100%', borderRadius: 3 },
  protMiniValue: { fontSize: 11, fontWeight: '800', width: 24, textAlign: 'right' },

  /* Category pills */
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1,
  },
  catPillText: { fontSize: 12, fontWeight: '600' },
  catPillBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center' },
  catPillBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Tabs */
  tabBar: {
    flexDirection: 'row', marginHorizontal: DS.space.lg,
    padding: 4, borderRadius: DS.radius.full, gap: 2,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 9, borderRadius: DS.radius.full,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Status filter */
  statusChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: DS.radius.md, borderWidth: 1,
  },
  statusChipText: { fontSize: 12, fontWeight: '600' },
  statusChipBadge: {
    fontSize: 10, fontWeight: '800',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
    backgroundColor: 'transparent', overflow: 'hidden',
  },

  /* Group label */
  groupLabel: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.6, marginHorizontal: DS.space.lg, marginBottom: DS.space.sm,
  },

  /* Dose row */
  doseRow: {
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
    ...DS.shadow.sm,
  },
  doseIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  doseName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  statusPillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  doseMeta: { fontSize: 11, fontWeight: '500', marginTop: 3 },
  doseDate: { fontSize: 10, fontWeight: '500' },
  doseActions: { flexDirection: 'row', marginTop: DS.space.sm, paddingTop: DS.space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.15)', justifyContent: 'flex-end' },
  doseRecordBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.sm },
  doseRecordText: { color: DS.white, fontSize: 11, fontWeight: '700' },
  doseDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.radius.sm },
  doseDoneText: { fontSize: 11, fontWeight: '700' },

  /* Timeline */
  tlTitle: { fontSize: 14, fontWeight: '800' },
  tlSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  tlNode: { alignItems: 'center', width: 72 },
  tlDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  tlConnector: { width: 44, height: 2, marginHorizontal: -2 },
  tlNodeShort: { fontSize: 11, fontWeight: '700' },
  tlNodeDose: { fontSize: 9, fontWeight: '500' },
  tlNodeStatus: { fontSize: 9, fontWeight: '700', marginTop: 2 },

  /* Insights */
  insightCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  insightIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  insightDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  insightAction: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  insightActionText: { fontSize: 10, fontWeight: '700' },

  /* Travel */
  travelRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.sm },
  travelDot: { width: 8, height: 8, borderRadius: 4 },
  travelName: { fontSize: 13, fontWeight: '700' },
  travelDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  travelStatus: { fontSize: 11, fontWeight: '700' },
  travelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: DS.radius.md },
  travelBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  /* Next dose */
  nextDoseCard: {
    padding: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, borderLeftWidth: 4,
    ...DS.shadow.sm,
  },
  nextDoseTitle: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  nextDoseText: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  nextDoseDate: { fontSize: 12, fontWeight: '700' },
  nextDoseBtn: { paddingVertical: 12, borderRadius: DS.radius.md, alignItems: 'center' },
  nextDoseBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  /* Records */
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md },
  recordIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recordName: { fontSize: 13, fontWeight: '700' },
  recordMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  recordDate: { fontSize: 11, fontWeight: '600' },
  recordNotes: { fontSize: 10, fontWeight: '500', maxWidth: 100, marginTop: 1 },

  /* Quick actions */
  quickAct: {
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 14, borderRadius: DS.radius.md,
  },
  quickActText: { color: DS.white, fontSize: 10, fontWeight: '700' },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: DS.space['3xl'], paddingHorizontal: DS.space.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: {
    width: '100%', maxWidth: 420, borderRadius: DS.radius['2xl'],
    padding: DS.space.lg, ...DS.shadow.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: DS.space.md },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  modalSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  modalInputLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  modalInput: { height: 46, borderRadius: DS.radius.md, paddingHorizontal: 14, fontSize: 14, fontWeight: '600' },
  modalInputMulti: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  modalSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: DS.radius.md },
  modalSaveText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  sideChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: DS.radius.sm, borderWidth: 1 },
  sideChipText: { fontSize: 11, fontWeight: '600' },

  /* Detail modal */
  detailBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: DS.radius.sm, marginBottom: DS.space.md },
  detailBadgeText: { fontSize: 11, fontWeight: '700' },
  detailSectionLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: DS.space.md, marginBottom: 8 },
  detailDoseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  detailDoseNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  detailDoseNumText: { fontSize: 11, fontWeight: '800' },
  detailDoseAge: { fontSize: 13, fontWeight: '700' },
  detailDoseDesc: { fontSize: 11, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  contraRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  contraText: { fontSize: 12, fontWeight: '500', flex: 1 },
  noContra: { fontSize: 12, fontStyle: 'italic', fontWeight: '500' },
  detailText: { fontSize: 12, fontWeight: '600' },

  /* Baby required */
  babyReqCard: { width: '100%', maxWidth: 340, borderRadius: DS.radius['2xl'], padding: DS.space['2xl'], alignItems: 'center', ...DS.shadow.lg },
  babyReqIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  babyReqBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, width: '100%' },
  babyReqBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
});