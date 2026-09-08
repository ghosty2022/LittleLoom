// PediatricianPDFExport.tsx — v4.0
// Professional PDF Template System with Shareable Templates
// Full Microsoft Forms-style sharing and response collection

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
  Dimensions,
  Share,
  Image,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Linking,
} from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useCustomization } from '@/hooks/useCustomization';
import { useSweetAlert } from '@/hooks/useSweetAlert';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/context/TrackerContext';
import { useBaby } from '@/context/BabyContext';
import { useFamily } from '@/context/FamilyContext';
import { useAuth } from '@/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInMonths, subDays } from 'date-fns';
import { supabase } from '@/utils/supabase';

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */
interface ReportSection {
  id: string;
  label: string;
  emoji: string;
  enabled: boolean;
  description: string;
}

interface TrackerEntry {
  id: string;
  trackerId: string;
  trackerName: string;
  timestamp: string;
  data: Record<string, any>;
  duration?: number;
  amount?: number;
}

interface DoctorReport {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  doctorNotes?: string;
  templateType?: 'visit' | 'full' | 'growth' | 'emergency' | 'development' | 'wellness';
  isDoctorFilled?: boolean;
  templateId?: string;
  shareableLink?: string;
  responseId?: string;
  respondentName?: string;
  respondentEmail?: string;
}

interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox' | 'date' | 'number' | 'select' | 'email' | 'phone' | 'signature';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  value?: string;
  helpText?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sections: TemplateField[];
  shareableLink?: string;
  responseCount?: number;
  createdBy?: string;
  createdAt?: string;
}

interface ShareableTemplateResponse {
  id: string;
  templateId: string;
  respondentName: string;
  respondentEmail?: string;
  submittedAt: string;
  responses: Record<string, string>;
  status: 'pending' | 'reviewed' | 'approved';
}

type ReportMode = 'generate' | 'templates' | 'upload' | 'share';

/* ═══════════════════════════════════════════════════════════════════════
   CLINICAL DATA — WHO/CDC Simplified Reference Curves
   ═══════════════════════════════════════════════════════════════════════ */
const GROWTH_REF = {
  boy: {
    weight: [{ m: 0, med: 3.3, sd: 0.4 }, { m: 1, med: 4.5, sd: 0.5 }, { m: 2, med: 5.6, sd: 0.6 }, { m: 3, med: 6.4, sd: 0.7 }, { m: 6, med: 7.9, sd: 0.8 }, { m: 9, med: 8.9, sd: 0.9 }, { m: 12, med: 9.8, sd: 1.0 }, { m: 18, med: 11.0, sd: 1.1 }, { m: 24, med: 12.2, sd: 1.2 }],
    height: [{ m: 0, med: 50, sd: 2.0 }, { m: 3, med: 61, sd: 2.3 }, { m: 6, med: 67, sd: 2.5 }, { m: 12, med: 76, sd: 2.8 }, { m: 24, med: 87, sd: 3.2 }],
    head: [{ m: 0, med: 35.0, sd: 1.5 }, { m: 3, med: 40.0, sd: 1.5 }, { m: 6, med: 43.0, sd: 1.5 }, { m: 12, med: 47.0, sd: 1.5 }, { m: 24, med: 49.0, sd: 1.5 }],
  },
  girl: {
    weight: [{ m: 0, med: 3.2, sd: 0.4 }, { m: 1, med: 4.2, sd: 0.5 }, { m: 2, med: 5.1, sd: 0.6 }, { m: 3, med: 5.8, sd: 0.6 }, { m: 6, med: 7.3, sd: 0.7 }, { m: 9, med: 8.2, sd: 0.8 }, { m: 12, med: 9.1, sd: 0.9 }, { m: 18, med: 10.2, sd: 1.0 }, { m: 24, med: 11.5, sd: 1.1 }],
    height: [{ m: 0, med: 49, sd: 2.0 }, { m: 3, med: 60, sd: 2.3 }, { m: 6, med: 65, sd: 2.4 }, { m: 12, med: 74, sd: 2.8 }, { m: 24, med: 85, sd: 3.1 }],
    head: [{ m: 0, med: 34.5, sd: 1.5 }, { m: 3, med: 39.0, sd: 1.5 }, { m: 6, med: 42.0, sd: 1.5 }, { m: 12, med: 46.0, sd: 1.5 }, { m: 24, med: 48.0, sd: 1.5 }],
  },
};

const getGrowthRef = (gender: string, type: 'weight' | 'height' | 'head', ageMonths: number) => {
  const g = gender === 'girl' || gender === 'female' ? 'girl' : 'boy';
  const arr = GROWTH_REF[g][type];
  if (ageMonths <= 0) return arr[0];
  if (ageMonths >= 24) return arr[arr.length - 1];
  const lower = [...arr].reverse().find((a: any) => a.m <= ageMonths) || arr[0];
  const upper = arr.find((a: any) => a.m >= ageMonths) || arr[arr.length - 1];
  if (lower.m === upper.m) return lower;
  const ratio = (ageMonths - lower.m) / (upper.m - lower.m);
  return { med: lower.med + (upper.med - lower.med) * ratio, sd: lower.sd + (upper.sd - lower.sd) * ratio };
};

const zToPercentile = (z: number): number => {
  const b1 = 0.31938153, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
  const p = 0.2316419;
  const t = 1 / (1 + p * Math.abs(z));
  const phi = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - phi * (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));
  return Math.round((z >= 0 ? cdf : 1 - cdf) * 100);
};

const VACCINE_SCHEDULE = [
  { name: 'Hepatitis B', code: 'hepB', doses: [{ ageMo: 0, label: 'Birth' }, { ageMo: 1, label: '1-2 mo' }, { ageMo: 6, label: '6-18 mo' }] },
  { name: 'DTaP', code: 'dtap', doses: [{ ageMo: 2, label: '2 mo' }, { ageMo: 4, label: '4 mo' }, { ageMo: 6, label: '6 mo' }, { ageMo: 15, label: '15-18 mo' }] },
  { name: 'IPV (Polio)', code: 'ipv', doses: [{ ageMo: 2, label: '2 mo' }, { ageMo: 4, label: '4 mo' }, { ageMo: 6, label: '6-18 mo' }] },
  { name: 'Hib', code: 'hib', doses: [{ ageMo: 2, label: '2 mo' }, { ageMo: 4, label: '4 mo' }, { ageMo: 6, label: '6 mo' }, { ageMo: 12, label: '12-15 mo' }] },
  { name: 'PCV13', code: 'pcv', doses: [{ ageMo: 2, label: '2 mo' }, { ageMo: 4, label: '4 mo' }, { ageMo: 6, label: '6 mo' }, { ageMo: 12, label: '12-15 mo' }] },
  { name: 'Rotavirus', code: 'rv', doses: [{ ageMo: 2, label: '2 mo' }, { ageMo: 4, label: '4 mo' }, { ageMo: 6, label: '6 mo' }] },
  { name: 'MMR', code: 'mmr', doses: [{ ageMo: 12, label: '12-15 mo' }, { ageMo: 48, label: '4-6 yr' }] },
  { name: 'Varicella', code: 'var', doses: [{ ageMo: 12, label: '12-15 mo' }, { ageMo: 48, label: '4-6 yr' }] },
  { name: 'Hepatitis A', code: 'hepA', doses: [{ ageMo: 12, label: '12-23 mo' }, { ageMo: 18, label: '2nd dose' }] },
  { name: 'Influenza', code: 'flu', doses: [{ ageMo: 6, label: '6+ mo (annual)' }] },
];

const MILESTONE_EXPECTATIONS = [
  { maxMo: 2, category: 'physical', items: ['Lifts head briefly', 'Pushes up on arms'], critical: true },
  { maxMo: 2, category: 'social', items: ['Makes eye contact', 'Smiles reflexively'], critical: true },
  { maxMo: 4, category: 'physical', items: ['Holds head steady', 'Rolls front to back', 'Pushes up to elbows'], critical: true },
  { maxMo: 4, category: 'cognitive', items: ['Tracks objects 180°', 'Reaches for toys'], critical: false },
  { maxMo: 6, category: 'physical', items: ['Sits with support', 'Rolls both ways', 'Bears weight on legs'], critical: true },
  { maxMo: 6, category: 'language', items: ['Babbles consonants', 'Turns to sounds'], critical: true },
  { maxMo: 9, category: 'physical', items: ['Sits without support', 'Crawls or creeps', 'Pulls to stand'], critical: false },
  { maxMo: 9, category: 'social', items: ['Plays peek-a-boo', 'Stranger anxiety'], critical: false },
  { maxMo: 12, category: 'physical', items: ['Stands independently', 'First steps possible', 'Pincer grasp'], critical: true },
  { maxMo: 12, category: 'language', items: ['Says "mama/dada" specifically', 'Understands "no"'], critical: true },
  { maxMo: 12, category: 'social', items: ['Waves bye-bye', 'Shows preferences'], critical: false },
  { maxMo: 18, category: 'physical', items: ['Walks independently', 'Climbs stairs assisted', 'Scribbles'], critical: false },
  { maxMo: 18, category: 'language', items: ['Says 3-6 words', 'Follows 1-step commands'], critical: true },
  { maxMo: 24, category: 'physical', items: ['Runs', 'Kicks ball', 'Jumps in place'], critical: false },
  { maxMo: 24, category: 'language', items: ['2-word phrases', '50+ words vocabulary'], critical: true },
  { maxMo: 24, category: 'social', items: ['Parallel play', 'Shows affection'], critical: false },
];

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
const formatDate = (iso: string | number) => {
  try { return format(new Date(iso), 'MMM d, yyyy h:mm a'); } catch { return 'Invalid date'; }
};

const escapeHtml = (str: string) =>
  str?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') || '';

const getBabyAgeMonths = (birthDate?: string) => {
  if (!birthDate) return 0;
  return differenceInMonths(new Date(), new Date(birthDate));
};

/* ═══════════════════════════════════════════════════════════════════════
   TEMPLATE DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════ */
const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'wellness',
    name: 'Wellness Visit',
    description: 'Comprehensive checkup template with all sections',
    icon: 'heart',
    color: '#10b981',
    sections: [
      { id: 'visit_date', label: 'Visit Date', type: 'date', required: true },
      { id: 'chief_complaint', label: 'Chief Complaint / Reason for Visit', type: 'textarea', placeholder: 'Describe the main reason for this visit...' },
      { id: 'history', label: 'History of Present Illness', type: 'textarea', placeholder: 'Detailed history of the current condition...' },
      { id: 'medications', label: 'Current Medications', type: 'textarea', placeholder: 'List all current medications, dosages, and frequency...' },
      { id: 'allergies', label: 'Allergies', type: 'textarea', placeholder: 'List all known allergies and reactions...' },
      { id: 'physical_exam', label: 'Physical Examination Findings', type: 'textarea', placeholder: 'Vital signs, general appearance, system-specific findings...' },
      { id: 'growth_measurements', label: 'Growth Measurements', type: 'text', placeholder: 'Weight, height, head circumference with percentiles...' },
      { id: 'assessment', label: 'Assessment / Diagnosis', type: 'textarea', placeholder: 'Clinical assessment and diagnoses...' },
      { id: 'plan', label: 'Treatment Plan', type: 'textarea', placeholder: 'Medications, referrals, follow-up plan...' },
      { id: 'instructions', label: 'Parent/Caregiver Instructions', type: 'textarea', placeholder: 'Instructions provided to family...' },
      { id: 'next_visit', label: 'Next Visit / Follow-up', type: 'date', placeholder: 'Recommended follow-up date' },
      { id: 'doctor_name', label: "Doctor's Name", type: 'text', required: true },
      { id: 'doctor_signature', label: "Doctor's Signature", type: 'signature', placeholder: 'Electronically signed by...' },
      { id: 'doctor_email', label: "Doctor's Email", type: 'email', placeholder: 'doctor@practice.com', helpText: 'For sending the completed report' },
    ],
  },
  {
    id: 'growth',
    name: 'Growth & Development',
    description: 'Focused on growth tracking and milestones',
    icon: 'trending-up',
    color: '#667eea',
    sections: [
      { id: 'visit_date', label: 'Visit Date', type: 'date', required: true },
      { id: 'weight', label: 'Weight (kg/lbs)', type: 'text', placeholder: 'Enter weight with percentile' },
      { id: 'height', label: 'Height/Length (cm/in)', type: 'text', placeholder: 'Enter height with percentile' },
      { id: 'head_circumference', label: 'Head Circumference (cm/in)', type: 'text', placeholder: 'Enter head circumference with percentile' },
      { id: 'bmi', label: 'BMI / BMI Percentile', type: 'text', placeholder: 'Enter BMI and percentile' },
      { id: 'milestones_achieved', label: 'Milestones Achieved', type: 'textarea', placeholder: 'List developmental milestones achieved...' },
      { id: 'milestones_concerns', label: 'Developmental Concerns', type: 'textarea', placeholder: 'Any concerns about development...' },
      { id: 'growth_concerns', label: 'Growth Concerns', type: 'textarea', placeholder: 'Any concerns about growth trajectory...' },
      { id: 'nutrition', label: 'Nutrition Assessment', type: 'textarea', placeholder: 'Feeding habits, diet, concerns...' },
      { id: 'sleep', label: 'Sleep Assessment', type: 'textarea', placeholder: 'Sleep patterns, duration, quality...' },
      { id: 'next_steps', label: 'Next Steps / Recommendations', type: 'textarea', placeholder: 'Follow-up plan, referrals...' },
      { id: 'doctor_name', label: "Doctor's Name", type: 'text', required: true },
      { id: 'doctor_email', label: "Doctor's Email", type: 'email', placeholder: 'doctor@practice.com' },
    ],
  },
  {
    id: 'emergency',
    name: 'Emergency Visit',
    description: 'For urgent care and emergency department visits',
    icon: 'alert-circle',
    color: '#ef4444',
    sections: [
      { id: 'visit_date', label: 'Visit Date & Time', type: 'date', required: true },
      { id: 'arrival_mode', label: 'Mode of Arrival', type: 'select', options: ['Walk-in', 'Ambulance', 'Transferred', 'Other'], placeholder: 'Select mode of arrival...' },
      { id: 'chief_complaint', label: 'Chief Complaint', type: 'textarea', required: true, placeholder: 'Primary reason for emergency visit...' },
      { id: 'triage_notes', label: 'Triage Notes', type: 'textarea', placeholder: 'Triage assessment and acuity level...' },
      { id: 'history', label: 'History of Present Illness', type: 'textarea', placeholder: 'Detailed history of the current emergency...' },
      { id: 'physical_exam', label: 'Physical Examination', type: 'textarea', placeholder: 'Emergency department physical exam findings...' },
      { id: 'diagnostics', label: 'Diagnostics Performed', type: 'textarea', placeholder: 'Lab work, imaging, procedures...' },
      { id: 'diagnosis', label: 'Diagnosis', type: 'textarea', required: true, placeholder: 'Final diagnosis...' },
      { id: 'treatment', label: 'Treatment Provided', type: 'textarea', placeholder: 'Medications, interventions, procedures...' },
      { id: 'disposition', label: 'Disposition', type: 'select', options: ['Discharged Home', 'Admitted', 'Transferred', 'Observation', 'Other'], placeholder: 'Select disposition...' },
      { id: 'instructions', label: 'Discharge Instructions', type: 'textarea', placeholder: 'Instructions for home care, medications, follow-up...' },
      { id: 'doctor_name', label: "Doctor's Name", type: 'text', required: true },
      { id: 'doctor_phone', label: "Doctor's Phone", type: 'phone', placeholder: '555-123-4567' },
    ],
  },
  {
    id: 'vaccine',
    name: 'Vaccination Record',
    description: 'Immunization history and schedule',
    icon: 'medical',
    color: '#3b82f6',
    sections: [
      { id: 'visit_date', label: 'Visit Date', type: 'date', required: true },
      { id: 'vaccines_given', label: 'Vaccines Given Today', type: 'textarea', placeholder: 'List vaccines administered with lot numbers...' },
      { id: 'reactions', label: 'Reactions / Side Effects', type: 'textarea', placeholder: 'Any immediate reactions or concerns...' },
      { id: 'next_vaccines', label: 'Next Vaccines Due', type: 'textarea', placeholder: 'Upcoming vaccines with due dates...' },
      { id: 'vaccine_history', label: 'Vaccine History Review', type: 'textarea', placeholder: 'Review of previous vaccinations...' },
      { id: 'parent_questions', label: 'Parent Questions Addressed', type: 'textarea', placeholder: 'Questions answered regarding vaccination...' },
      { id: 'doctor_name', label: "Doctor's Name", type: 'text', required: true },
    ],
  },
  {
    id: 'development',
    name: 'Developmental Assessment',
    description: 'Focused on developmental screening and milestones',
    icon: 'brain',
    color: '#8b5cf6',
    sections: [
      { id: 'visit_date', label: 'Visit Date', type: 'date', required: true },
      { id: 'developmental_history', label: 'Developmental History', type: 'textarea', placeholder: 'Previous development, concerns, milestones...' },
      { id: 'milestones_current', label: 'Current Milestones', type: 'textarea', placeholder: 'Recent milestones achieved...' },
      { id: 'milestones_concerns', label: 'Milestone Concerns', type: 'textarea', placeholder: 'Any delayed milestones or concerns...' },
      { id: 'behavioral_observations', label: 'Behavioral Observations', type: 'textarea', placeholder: 'Behavior, social interaction, communication...' },
      { id: 'developmental_screening', label: 'Developmental Screening Results', type: 'textarea', placeholder: 'Screening tools used and results...' },
      { id: 'speech_language', label: 'Speech & Language Assessment', type: 'textarea', placeholder: 'Speech and language evaluation...' },
      { id: 'motor_skills', label: 'Motor Skills Assessment', type: 'textarea', placeholder: 'Gross and fine motor skills...' },
      { id: 'social_emotional', label: 'Social-Emotional Assessment', type: 'textarea', placeholder: 'Social skills, emotional regulation...' },
      { id: 'recommendations', label: 'Recommendations & Next Steps', type: 'textarea', placeholder: 'Therapies, interventions, follow-up...' },
      { id: 'doctor_name', label: "Doctor's Name", type: 'text', required: true },
      { id: 'doctor_email', label: "Doctor's Email", type: 'email', placeholder: 'doctor@practice.com' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════════════ */
const useReportTheme = () => {
  const { isDark, colors, fullThemeColors, borderRadiusValue } = useCustomization();
  return useMemo(() => ({
    primary: colors?.primary || '#667eea',
    secondary: colors?.secondary || '#764ba2',
    isDark: !!isDark,
    bg: fullThemeColors?.background || (isDark ? '#0a0a1a' : '#f8faff'),
    surface: fullThemeColors?.surface || (isDark ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.9)'),
    card: fullThemeColors?.card || (isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)'),
    border: fullThemeColors?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    text: {
      primary: fullThemeColors?.text || (isDark ? '#ffffff' : '#1a1a1a'),
      secondary: fullThemeColors?.textSecondary || (isDark ? '#94a3b8' : '#64748b'),
      muted: fullThemeColors?.textMuted || (isDark ? '#64748b' : '#94a3b8'),
    },
    radius: borderRadiusValue || 16,
  }), [isDark, colors, fullThemeColors, borderRadiusValue]);
};

/* ═══════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════ */
const GlassCard = ({ children, style, onPress, active }: any) => {
  const theme = useReportTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.85} style={[styles.glassCard, { borderRadius: theme.radius, borderColor: active ? theme.primary : 'rgba(255,255,255,0.1)' }, active && { borderWidth: 2 }, style]}>
      <LinearGradient colors={theme.isDark ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

const SectionHeader = ({ title, subtitle, icon }: any) => {
  const theme = useReportTheme();
  return (
    <View style={styles.sectionHeader}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${theme.primary}12` }]}><Ionicons name={icon} size={16} color={theme.primary} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>}
      </View>
    </View>
  );
};

const Badge = ({ text, color, bg }: any) => (
  <View style={[styles.badge, { backgroundColor: bg || `${color}15` }]}><Text style={[styles.badgeText, { color }]}>{text}</Text></View>
);

/* ═══════════════════════════════════════════════════════════════════════
   BABY PROFILE HEADER
   ═══════════════════════════════════════════════════════════════════════ */
const BabyProfileHeader = ({ baby }: { baby: any }) => {
  const theme = useReportTheme();
  const ageMo = getBabyAgeMonths(baby?.birthDate);
  const ageDisplay = baby?.birthDate ? (() => {
    const y = Math.floor(ageMo / 12);
    const m = ageMo % 12;
    return y > 0 ? `${y}y ${m}m` : `${m} mo`;
  })() : 'Unknown';

  const initials = (baby?.name || 'B').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Animated.View entering={FadeInUp.springify()}>
      <GlassCard style={styles.profileCard}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.profileGradient}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {baby?.avatar ? (
                <Image source={{ uri: baby.avatar }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarRing} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{baby?.name || 'Baby'}</Text>
              <Text style={styles.profileMeta}>{ageDisplay} old • {baby?.gender || 'Unknown gender'}</Text>
              <View style={styles.profileChips}>
                {baby?.bloodType && <Badge text={`🩸 ${baby.bloodType}`} color="#fff" bg="rgba(255,255,255,0.2)" />}
                {baby?.allergies?.length > 0 && <Badge text={`⚠️ ${baby.allergies.length} Allergies`} color="#fef2f2" bg="rgba(239,68,68,0.3)" />}
                {ageMo < 6 && <Badge text="🍼 Infant" color="#fff" bg="rgba(255,255,255,0.2)" />}
              </View>
            </View>
          </View>
        </LinearGradient>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   INTELLIGENCE FEATURES (simplified for space)
   ═══════════════════════════════════════════════════════════════════════ */
const GrowthPercentileCard = ({ entries, baby }: { entries: TrackerEntry[]; baby: any }) => {
  const theme = useReportTheme();
  const ageMo = getBabyAgeMonths(baby?.birthDate);
  const gender = baby?.gender === 'girl' || baby?.gender === 'female' ? 'girl' : 'boy';

  const percentiles = useMemo(() => {
    const growth = entries.filter(e => e.trackerId === 'growth').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (!growth.length || ageMo < 0) return null;

    const latest = growth[0];
    const result: any[] = [];
    ['weight', 'height', 'head'].forEach((type: string) => {
      const val = parseFloat(latest.data?.[type]);
      if (!val || isNaN(val)) return;
      const ref = getGrowthRef(gender, type as any, ageMo);
      const z = (val - ref.med) / ref.sd;
      const p = Math.max(1, Math.min(99, zToPercentile(z)));
      const status = z < -2 ? 'concern' : z < -1 ? 'watch' : z > 2 ? 'watch' : 'normal';
      result.push({ type, value: val, unit: latest.data?.unit || (type === 'weight' ? 'kg' : 'cm'), percentile: p, z: z.toFixed(1), status });
    });
    return result;
  }, [entries, ageMo, gender]);

  if (!percentiles?.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <SectionHeader title="Clinical Growth Percentiles" icon="analytics-outline" subtitle="WHO/CDC reference curves" />
      <GlassCard>
        <View style={styles.percGrid}>
          {percentiles.map((p: any) => (
            <View key={p.type} style={styles.percItem}>
              <View style={styles.percTop}>
                <Text style={[styles.percLabel, { color: theme.text.muted }]}>{p.type.toUpperCase()}</Text>
                <Badge text={`Z: ${p.z}`} color={p.status === 'normal' ? '#10b981' : p.status === 'watch' ? '#f59e0b' : '#ef4444'} bg={`${p.status === 'normal' ? '#10b981' : p.status === 'watch' ? '#f59e0b' : '#ef4444'}12`} />
              </View>
              <Text style={[styles.percValue, { color: theme.text.primary }]}>{p.value} <Text style={{ fontSize: 13, color: theme.text.muted }}>{p.unit}</Text></Text>
              <View style={styles.percBarWrap}>
                <View style={[styles.percBarTrack, { backgroundColor: `${theme.primary}10` }]}>
                  <View style={[styles.percBarFill, { width: `${p.percentile}%`, backgroundColor: p.status === 'normal' ? '#10b981' : p.status === 'watch' ? '#f59e0b' : '#ef4444' }]} />
                </View>
                <Text style={[styles.percNum, { color: theme.text.secondary }]}>{p.percentile}th %ile</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.percDisclaimer, { color: theme.text.muted }]}>Percentiles are approximate using WHO/CDC reference data. Always consult your pediatrician for clinical interpretation.</Text>
      </GlassCard>
    </Animated.View>
  );
};

// ─── TEMPLATE FIELD COMPONENT ──────────────────────────────────────────────

const TemplateFieldComponent = ({ 
  field, 
  value, 
  onChange, 
  theme,
  readonly = false,
}: { 
  field: TemplateField; 
  value: string; 
  onChange: (id: string, value: string) => void;
  theme: any;
  readonly?: boolean;
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const renderField = () => {
    if (readonly) {
      return (
        <View style={[styles.templateReadonlyValue, { borderColor: theme.border }]}>
          <Text style={[styles.templateReadonlyText, { color: value ? theme.text.primary : theme.text.muted }]}>
            {value || '—'}
          </Text>
        </View>
      );
    }

    switch (field.type) {
      case 'textarea':
        return (
          <TextInput
            style={[styles.templateTextArea, { 
              color: theme.text.primary,
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderColor: isFocused ? theme.primary : theme.border,
            }]}
            placeholder={field.placeholder || ''}
            placeholderTextColor={theme.text.muted}
            value={value}
            onChangeText={(text) => onChange(field.id, text)}
            multiline
            numberOfLines={4}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textAlignVertical="top"
          />
        );
      
      case 'select':
        return (
          <View style={[styles.templateSelectContainer, { 
            borderColor: isFocused ? theme.primary : theme.border,
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          }]}>
            <TextInput
              style={[styles.templateSelect, { color: theme.text.primary }]}
              placeholder={field.placeholder || 'Select option...'}
              placeholderTextColor={theme.text.muted}
              value={value}
              onChangeText={(text) => onChange(field.id, text)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <Ionicons name="chevron-down" size={18} color={theme.text.muted} style={{ position: 'absolute', right: 12, top: 14 }} />
          </View>
        );
      
      case 'date':
        return (
          <TouchableOpacity
            style={[styles.templateDateInput, { 
              borderColor: isFocused ? theme.primary : theme.border,
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }]}
            onPress={() => {
              const today = new Date().toISOString().split('T')[0];
              onChange(field.id, today);
            }}
          >
            <Text style={[styles.templateDateText, { color: value ? theme.text.primary : theme.text.muted }]}>
              {value || field.placeholder || 'Select date...'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={theme.text.muted} />
          </TouchableOpacity>
        );
      
      case 'signature':
        return (
          <TouchableOpacity
            style={[styles.templateSignatureInput, { 
              borderColor: isFocused ? theme.primary : theme.border,
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }]}
            onPress={() => {
              // In a real app, open signature pad
              Alert.alert('Signature', 'Please enter your signature:', [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'OK', 
                  onPress: () => {
                    // For now, just set a placeholder
                    onChange(field.id, `Dr. ${Date.now().toString().slice(-4)}`);
                  } 
                },
              ]);
            }}
          >
            <Text style={[styles.templateSignatureText, { color: value ? theme.text.primary : theme.text.muted }]}>
              {value || field.placeholder || 'Tap to sign...'}
            </Text>
            <Ionicons name="create-outline" size={18} color={theme.text.muted} />
          </TouchableOpacity>
        );
      
      default:
        return (
          <TextInput
            style={[styles.templateInput, { 
              color: theme.text.primary,
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderColor: isFocused ? theme.primary : theme.border,
            }]}
            placeholder={field.placeholder || ''}
            placeholderTextColor={theme.text.muted}
            value={value}
            onChangeText={(text) => onChange(field.id, text)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType={field.type === 'email' ? 'email-address' : field.type === 'phone' ? 'phone-pad' : 'default'}
          />
        );
    }
  };

  return (
    <View style={styles.templateFieldContainer}>
      <View style={styles.templateFieldLabel}>
        <Text style={[styles.templateFieldLabelText, { color: theme.text.secondary }]}>
          {field.label}
          {field.required && <Text style={{ color: '#ef4444' }}> *</Text>}
        </Text>
        {field.helpText && (
          <Text style={[styles.templateHelpText, { color: theme.text.muted }]}>
            {field.helpText}
          </Text>
        )}
      </View>
      {renderField()}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SCREEN — Four Modes
   ═══════════════════════════════════════════════════════════════════════ */
export const PediatricianPDFExport: React.FC = () => {
  const theme = useReportTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { entries } = useTracker();
  const { parent1, parent2, guardians } = useFamily();
  const { userProfile } = useAuth();
  const sweetAlert = useSweetAlert();

  // ─── State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ReportMode>('generate');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [template, setTemplate] = useState<ReportTemplate>('full');
  const [customNotes, setCustomNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [reportHistory, setReportHistory] = useState<DoctorReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DoctorReport | null>(null);
  const [showReportDetail, setShowReportDetail] = useState(false);
  
  // ─── Template Form State ───────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [shareableTemplates, setShareableTemplates] = useState<ReportTemplate[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareResponses, setShareResponses] = useState<ShareableTemplateResponse[]>([]);
  const [selectedTemplateForShare, setSelectedTemplateForShare] = useState<ReportTemplate | null>(null);

  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'summary', label: 'Visit Summary', emoji: '📋', enabled: true, description: 'Overview of recent visits and stats' },
    { id: 'babyInfo', label: 'Child Profile', emoji: '👶', enabled: true, description: 'Name, age, blood type, allergies, photo' },
    { id: 'family', label: 'Family Contacts', emoji: '👨‍👩‍👧', enabled: true, description: 'Parents and guardians info' },
    { id: 'growth', label: 'Growth Charts', emoji: '📈', enabled: true, description: 'Weight, height, head circumference trends' },
    { id: 'percentiles', label: 'Clinical Percentiles', emoji: '📊', enabled: true, description: 'WHO/CDC percentile analysis' },
    { id: 'vaccines', label: 'Vaccination Compliance', emoji: '💉', enabled: true, description: 'Due, overdue, and upcoming vaccines' },
    { id: 'development', label: 'Developmental Check', emoji: '🧠', enabled: true, description: 'Milestone red flag scanner' },
    { id: 'correlations', label: 'Medical Correlations', emoji: '🔗', enabled: true, description: 'Symptom-medication pattern detection' },
    { id: 'sleep', label: 'Sleep Analysis', emoji: '😴', enabled: true, description: 'Sleep debt and circadian rhythm' },
    { id: 'feeding', label: 'Feeding & Nutrition', emoji: '🍼', enabled: true, description: 'Feeding logs and patterns' },
    { id: 'health', label: 'Health Events', emoji: '🏥', enabled: true, description: 'Doctor visits, symptoms, temperatures' },
    { id: 'medications', label: 'Medications', emoji: '💊', enabled: true, description: 'Current and recent medications' },
    { id: 'forecast', label: 'Predictive Forecasts', emoji: '🔮', enabled: true, description: 'Growth projections and next events' },
    { id: 'notes', label: 'Custom Notes', emoji: '📝', enabled: true, description: 'Your notes for the pediatrician' },
  ]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  // ─── Load saved data ────────────────────────────────────────────────────
  useEffect(() => {
    loadReports();
    loadShareableTemplates();
    loadShareResponses();
  }, []);

  const loadReports = async () => {
    try {
      const reportsDir = new Directory(Paths.document, 'DoctorReports');
      if (!reportsDir.exists) {
        reportsDir.create();
        return;
      }
      const files = reportsDir.list();
      const reports: DoctorReport[] = [];
      for (const file of files) {
        if (file instanceof File && file.extension === '.json') {
          try {
            const content = file.textSync();
            const data = JSON.parse(content);
            reports.push({ ...data, uri: file.uri });
          } catch (e) {
            console.warn('Failed to parse report:', e);
          }
        }
      }
      setReportHistory(reports.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const loadShareableTemplates = async () => {
    try {
      const templatesDir = new Directory(Paths.document, 'ShareableTemplates');
      if (!templatesDir.exists) {
        templatesDir.create();
        return;
      }
      const files = templatesDir.list();
      const templates: ReportTemplate[] = [];
      for (const file of files) {
        if (file instanceof File && file.extension === '.json') {
          try {
            const content = file.textSync();
            const data = JSON.parse(content);
            templates.push(data);
          } catch (e) {
            console.warn('Failed to parse shareable template:', e);
          }
        }
      }
      setShareableTemplates(templates);
    } catch (error) {
      console.error('Failed to load shareable templates:', error);
    }
  };

  const loadShareResponses = async () => {
    try {
      const responsesDir = new Directory(Paths.document, 'ShareResponses');
      if (!responsesDir.exists) {
        responsesDir.create();
        return;
      }
      const files = responsesDir.list();
      const responses: ShareableTemplateResponse[] = [];
      for (const file of files) {
        if (file instanceof File && file.extension === '.json') {
          try {
            const content = file.textSync();
            const data = JSON.parse(content);
            responses.push(data);
          } catch (e) {
            console.warn('Failed to parse share response:', e);
          }
        }
      }
      setShareResponses(responses.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch (error) {
      console.error('Failed to load share responses:', error);
    }
  };

  const saveReport = async (report: DoctorReport) => {
    try {
      const reportsDir = new Directory(Paths.document, 'DoctorReports');
      if (!reportsDir.exists) reportsDir.create();
      
      const file = new File(reportsDir, `${report.id}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(report));
      
      await loadReports();
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  };

  const saveShareableTemplate = async (template: ReportTemplate) => {
    try {
      const templatesDir = new Directory(Paths.document, 'ShareableTemplates');
      if (!templatesDir.exists) templatesDir.create();
      
      const file = new File(templatesDir, `${template.id}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(template));
      
      await loadShareableTemplates();
    } catch (error) {
      console.error('Failed to save shareable template:', error);
    }
  };

  const saveShareResponse = async (response: ShareableTemplateResponse) => {
    try {
      const responsesDir = new Directory(Paths.document, 'ShareResponses');
      if (!responsesDir.exists) responsesDir.create();
      
      const file = new File(responsesDir, `${response.id}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(response));
      
      await loadShareResponses();
    } catch (error) {
      console.error('Failed to save share response:', error);
    }
  };

  const deleteReportFile = async (reportId: string) => {
    try {
      const reportsDir = new Directory(Paths.document, 'DoctorReports');
      const file = new File(reportsDir, `${reportId}.json`);
      if (file.exists) file.delete();
      await loadReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  // ─── Toggle sections ──────────────────────────────────────────────────
  const toggleSection = (id: string) => setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));

  const applyTemplate = (t: ReportTemplate) => {
    setTemplate(t);
    const presets: Record<ReportTemplate, string[]> = {
      full: sections.map(s => s.id),
      visit: ['summary', 'babyInfo', 'family', 'growth', 'percentiles', 'vaccines', 'health', 'medications', 'notes'],
      growth: ['babyInfo', 'growth', 'percentiles', 'feeding', 'sleep', 'development', 'forecast'],
      emergency: ['babyInfo', 'family', 'health', 'medications', 'correlations', 'notes'],
      development: ['babyInfo', 'growth', 'percentiles', 'development', 'sleep', 'forecast', 'notes'],
    };
    setSections(prev => prev.map(s => ({ ...s, enabled: presets[t].includes(s.id) })));
  };

  // ─── Filter entries ────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    if (dateRange === 'all') return entries;
    const days = { '7d': 7, '30d': 30, '90d': 90 };
    const cutoff = subDays(new Date(), days[dateRange]).getTime();
    return entries.filter((e: TrackerEntry) => new Date(e.timestamp).getTime() > cutoff);
  }, [entries, dateRange]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayEntries = filteredEntries.filter((e: TrackerEntry) => new Date(e.timestamp) >= today);
    return { total: filteredEntries.length, today: todayEntries.length, trackers: new Set(filteredEntries.map((e: TrackerEntry) => e.trackerId)).size };
  }, [filteredEntries]);

  // ─── Template Handlers ─────────────────────────────────────────────────
  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    const initialValues: Record<string, string> = {};
    template.sections.forEach(field => {
      initialValues[field.id] = '';
    });
    setTemplateValues(initialValues);
    setShowTemplateForm(true);
  };

  const handleTemplateFieldChange = (id: string, value: string) => {
    setTemplateValues(prev => ({ ...prev, [id]: value }));
  };

  const handleGenerateTemplatePDF = async () => {
    if (!selectedTemplate) return;
    if (!currentBaby) {
      sweetAlert?.alert?.('No Baby', 'Select a baby profile first.');
      return;
    }

    const missing = selectedTemplate.sections
      .filter(f => f.required && !templateValues[f.id]?.trim())
      .map(f => f.label);
    
    if (missing.length > 0) {
      sweetAlert?.alert?.('Missing Fields', `Please fill in: ${missing.join(', ')}`);
      return;
    }

    setGenerating(true);
    try {
      const html = generateTemplateHTML(selectedTemplate, templateValues);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      const fileName = `${(currentBaby.name || 'Baby').replace(/\s+/g, '_')}_${selectedTemplate.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`;
      const reportsDir = new Directory(Paths.document, 'DoctorReports');
      if (!reportsDir.exists) reportsDir.create();
      
      const sourceFile = new File(uri);
      const destFile = new File(reportsDir, fileName);
      sourceFile.move(destFile);

      const report: DoctorReport = {
        id: `template_${Date.now()}`,
        name: fileName,
        uri: destFile.uri,
        mimeType: 'application/pdf',
        size: destFile.size,
        uploadedAt: new Date().toISOString(),
        status: 'pending',
        templateType: selectedTemplate.id as any,
        isDoctorFilled: true,
        templateId: selectedTemplate.id,
        doctorNotes: 'Template-filled report generated',
      };

      await saveReport(report);
      setShowTemplateForm(false);
      sweetAlert?.success('Template Generated!', `${selectedTemplate.name} report created successfully.`);
    } catch (err) { 
      console.error(err); 
      sweetAlert?.alert?.('Failed', 'Could not generate template PDF. Please try again.'); 
    } finally { 
      setGenerating(false); 
    }
  };

  // ─── Generate Template HTML ───────────────────────────────────────────
  const generateTemplateHTML = (template: ReportTemplate, values: Record<string, string>) => {
    const baby = currentBaby;
    const babyName = baby?.name || 'Baby';
    const babyDob = baby?.birthDate ? format(new Date(baby.birthDate), 'MMM d, yyyy') : 'N/A';
    const ageMo = getBabyAgeMonths(baby?.birthDate);
    const ageText = baby?.birthDate ? (() => {
      const y = Math.floor(ageMo / 12); const m = ageMo % 12;
      return y > 0 ? `${y}y ${m}m` : `${m} months`;
    })() : 'N/A';

    const fieldsHTML = template.sections.map(field => {
      const value = values[field.id] || '';
      return `
        <div class="template-field">
          <div class="template-field-label">${field.label}${field.required ? ' <span style="color:#ef4444;">*</span>' : ''}</div>
          <div class="template-field-value">${escapeHtml(value) || '—'}</div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(babyName)} - ${escapeHtml(template.name)}</title>
  <style>
    @page { margin: 30px; size: auto; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 850px; margin: 0 auto; padding: 24px; background: #fff; }
    .header { text-align: center; padding-bottom: 20px; border-bottom: 3px solid ${template.color}; margin-bottom: 28px; }
    .header h1 { margin: 0; font-size: 26px; color: ${template.color}; letter-spacing: -0.5px; }
    .header .subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
    .header .baby-info { display: flex; justify-content: center; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
    .header .baby-info span { font-size: 13px; color: #64748b; }
    .header .baby-info strong { color: #1e293b; }
    .template-section { margin-bottom: 24px; }
    .template-section h2 { font-size: 18px; color: ${template.color}; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; font-weight: 800; }
    .template-field { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
    .template-field-label { font-weight: 700; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
    .template-field-value { font-size: 15px; color: #1e293b; padding: 4px 0; min-height: 28px; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    .disclaimer { background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 12px; color: #64748b; border-left: 4px solid ${template.color}; }
    @media print { body { padding: 0; } .template-section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 ${escapeHtml(template.name)}</h1>
    <div class="subtitle">Generated by LittleLoom on ${format(new Date(), 'MMMM d, yyyy')}</div>
    <div class="baby-info">
      <span><strong>Patient:</strong> ${escapeHtml(babyName)}</span>
      <span><strong>DOB:</strong> ${babyDob}</span>
      <span><strong>Age:</strong> ${ageText}</span>
      ${baby?.gender ? `<span><strong>Gender:</strong> ${escapeHtml(baby.gender)}</span>` : ''}
    </div>
  </div>

  <div class="template-section">
    <h2>📋 Visit Details</h2>
    ${fieldsHTML}
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This is a clinical document for medical record-keeping. 
    All information should be verified by the attending physician. 
    This document is not a substitute for professional medical advice.
  </div>

  <div class="footer">
    <p>Generated from LittleLoom tracking data • ${format(new Date(), 'MMM d, yyyy h:mm a')}</p>
    <p>Not a substitute for professional medical advice. Always consult your pediatrician.</p>
  </div>
</body>
</html>`;
  };

  // ─── Generate Full Report HTML ────────────────────────────────────────
  const generateFullReportHTML = useCallback(() => {
    const baby = currentBaby;
    const babyName = baby?.name || 'Baby';
    const babyDob = baby?.birthDate ? format(new Date(baby.birthDate), 'MMM d, yyyy') : 'N/A';
    const ageMo = getBabyAgeMonths(baby?.birthDate);
    const ageText = baby?.birthDate ? (() => {
      const y = Math.floor(ageMo / 12); const m = ageMo % 12;
      return y > 0 ? `${y}y ${m}m` : `${m} months`;
    })() : 'N/A';
    const gender = baby?.gender === 'girl' || baby?.gender === 'female' ? 'girl' : 'boy';
    const enabledIds = new Set(sections.filter(s => s.enabled).map(s => s.id));
    const rangeLabel = dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : dateRange === '90d' ? 'Last 90 Days' : 'All Time';

    // Simple family HTML (reuse from earlier)
    const familyHTML = () => {
      const contacts: string[] = [];
      if (parent1) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent1.fullName || 'Parent 1')}</strong><br/>${escapeHtml(parent1.relationship || 'Parent')}${parent1.phoneNumber ? `<br/>📞 ${escapeHtml(parent1.phoneNumber)}` : ''}${parent1.email ? `<br/>✉️ ${escapeHtml(parent1.email)}` : ''}</div>`);
      if (parent2) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent2.fullName || 'Parent 2')}</strong><br/>${escapeHtml(parent2.relationship || 'Parent')}${parent2.phoneNumber ? `<br/>📞 ${escapeHtml(parent2.phoneNumber)}` : ''}${parent2.email ? `<br/>✉️ ${escapeHtml(parent2.email)}` : ''}</div>`);
      return contacts.length ? `<div class="grid-2">${contacts.join('')}</div>` : '<p class="muted">No family contacts recorded.</p>';
    };

    // ─── Full Report Content ────────────────────────────────────────────
    const babyProfileHTML = () => `
      <div class="grid-3">
        <div class="metric"><div class="metric-value">${escapeHtml(babyName)}</div><div class="metric-label">Name</div></div>
        <div class="metric"><div class="metric-value">${ageText}</div><div class="metric-label">Age</div></div>
        <div class="metric"><div class="metric-value">${babyDob}</div><div class="metric-label">Date of Birth</div></div>
      </div>
      ${baby?.gender ? `<p style="margin-top:10px;"><strong>Gender:</strong> ${escapeHtml(baby.gender)}</p>` : ''}
      ${baby?.bloodType ? `<p><strong>Blood Type:</strong> ${escapeHtml(baby.bloodType)}</p>` : ''}
      ${baby?.allergies?.length ? `<div class="alert-box"><strong>⚠️ Allergies:</strong> ${escapeHtml(baby.allergies.join(', '))}</div>` : ''}
      ${baby?.medicalNotes ? `<div class="info-box"><strong>Medical Notes:</strong> ${escapeHtml(baby.medicalNotes)}</div>` : ''}
    `;

    const summaryHTML = () => {
      const recentVisits = filteredEntries.filter((e: TrackerEntry) => ['doctor_visit', 'dental_visit', 'therapy'].includes(e.trackerId));
      const recentMeds = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'medication');
      const recentSymptoms = filteredEntries.filter((e: TrackerEntry) => ['symptom', 'temperature', 'allergy'].includes(e.trackerId));
      return `<div class="section"><h2>📋 Visit Summary</h2><p style="color:#64748b;font-size:13px;margin-bottom:16px;">Report period: <strong>${rangeLabel}</strong> | Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}</p><div class="grid-2"><div class="card"><strong>Total Entries</strong><br/><span style="font-size:24px;font-weight:800;color:#667eea;">${filteredEntries.length}</span></div><div class="card"><strong>Health Events</strong><br/><span style="font-size:24px;font-weight:800;color:#ef4444;">${recentVisits.length}</span></div><div class="card"><strong>Medications</strong><br/><span style="font-size:24px;font-weight:800;color:#f59e0b;">${recentMeds.length}</span></div><div class="card"><strong>Symptoms</strong><br/><span style="font-size:24px;font-weight:800;color:#8b5cf6;">${recentSymptoms.length}</span></div></div></div>`;
    };

    const notesHTML = customNotes.trim() ? `<div class="section"><h2>📝 Notes for Pediatrician</h2><div class="info-box" style="white-space:pre-wrap;">${escapeHtml(customNotes)}</div></div>` : '';

    const sectionsHTML = [
      enabledIds.has('summary') ? summaryHTML() : '',
      enabledIds.has('babyInfo') ? `<div class="section"><h2>👶 Child Profile</h2>${babyProfileHTML()}</div>` : '',
      enabledIds.has('family') ? `<div class="section"><h2>👨‍👩‍👧 Family Contacts</h2>${familyHTML()}</div>` : '',
      enabledIds.has('growth') ? `<div class="section"><h2>📈 Growth & Development</h2><p class="muted">Growth chart data available in full report.</p></div>` : '',
      enabledIds.has('percentiles') ? `<div class="section"><h2>📊 Clinical Growth Percentiles</h2><p class="muted">Percentile data available in full report.</p></div>` : '',
      enabledIds.has('vaccines') ? `<div class="section"><h2>💉 Vaccination Compliance</h2><p class="muted">Vaccination data available in full report.</p></div>` : '',
      enabledIds.has('development') ? `<div class="section"><h2>🧠 Developmental Check</h2><p class="muted">Developmental data available in full report.</p></div>` : '',
      enabledIds.has('notes') ? notesHTML : '',
    ].filter(Boolean).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(babyName)} - Pediatric Report</title>
  <style>
    @page { margin: 32px; size: auto; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 24px; background: #fff; }
    .header { text-align: center; padding-bottom: 20px; border-bottom: 3px solid #667eea; margin-bottom: 28px; }
    .header h1 { margin: 0; font-size: 28px; color: #1e293b; letter-spacing: -0.5px; }
    .header .subtitle { color: #64748b; font-size: 13px; margin-top: 6px; font-weight: 500; }
    .baby-info { display: flex; justify-content: center; gap: 24px; margin-top: 14px; flex-wrap: wrap; }
    .baby-info span { font-size: 13px; color: #64748b; }
    .baby-info strong { color: #1e293b; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section h2 { font-size: 17px; color: #667eea; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; font-weight: 800; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .card { background: #f8fafc; border-radius: 12px; padding: 16px; font-size: 13px; border: 1px solid #e2e8f0; }
    .metric { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 18px; text-align: center; color: white; }
    .metric-value { font-size: 22px; font-weight: 800; word-break: break-word; }
    .metric-label { font-size: 11px; opacity: 0.9; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .muted { color: #94a3b8; font-style: italic; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; white-space: pre-wrap; }
    .contact-card { background: #f8fafc; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.8; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    .doctor-section { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .doctor-section h3 { color: #065f46; margin-bottom: 8px; }
    .doctor-section .field { margin: 8px 0; padding: 8px; background: white; border-radius: 6px; border: 1px solid #d1fae5; }
    .doctor-section .field-label { font-weight: 600; color: #065f46; }
    @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 Pediatric Visit Report</h1>
    <div class="subtitle">Generated by LittleLoom on ${format(new Date(), 'MMMM d, yyyy')}</div>
    <div class="baby-info">
      <span><strong>Patient:</strong> ${escapeHtml(babyName)}</span>
      <span><strong>DOB:</strong> ${babyDob}</span>
      <span><strong>Age:</strong> ${ageText}</span>
      ${baby?.gender ? `<span><strong>Gender:</strong> ${escapeHtml(baby.gender)}</span>` : ''}
    </div>
  </div>
  ${sectionsHTML}
  <!-- Doctor's Notes Section -->
  <div class="doctor-section">
    <h3>👨‍⚕️ Pediatrician's Notes</h3>
    <p style="color:#065f46;font-size:13px;">This section is intended for the pediatrician to fill out during the visit.</p>
    <div class="field">
      <div class="field-label">📋 Clinical Findings:</div>
      <div style="min-height:60px;border:1px dashed #86efac;border-radius:4px;padding:8px;margin-top:4px;color:#6b7280;">[To be filled by pediatrician]</div>
    </div>
    <div class="field">
      <div class="field-label">💊 Recommendations:</div>
      <div style="min-height:60px;border:1px dashed #86efac;border-radius:4px;padding:8px;margin-top:4px;color:#6b7280;">[To be filled by pediatrician]</div>
    </div>
    <div class="field">
      <div class="field-label">📅 Follow-up Plan:</div>
      <div style="min-height:40px;border:1px dashed #86efac;border-radius:4px;padding:8px;margin-top:4px;color:#6b7280;">[To be filled by pediatrician]</div>
    </div>
  </div>
  <div class="footer">
    <p>This report was generated from LittleLoom tracking data.</p>
    <p>Not a substitute for professional medical advice. Always consult your pediatrician.</p>
  </div>
</body>
</html>`;
  }, [currentBaby, filteredEntries, sections, dateRange, customNotes, parent1, parent2]);

  // ─── Generate Full Report PDF ─────────────────────────────────────────
  const generateFullReportPDF = useCallback(async () => {
    const enabledCount = sections.filter(s => s.enabled).length;
    if (!enabledCount) { sweetAlert?.alert?.('No Sections', 'Enable at least one section.'); return; }
    if (!currentBaby) { sweetAlert?.alert?.('No Baby', 'Select a baby profile first.'); return; }

    setGenerating(true);
    try {
      const html = generateFullReportHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      
      const fileName = `${(currentBaby.name || 'Baby').replace(/\s+/g, '_')}_Report_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`;
      const reportsDir = new Directory(Paths.document, 'DoctorReports');
      if (!reportsDir.exists) reportsDir.create();
      
      const sourceFile = new File(uri);
      const destFile = new File(reportsDir, fileName);
      sourceFile.move(destFile);

      const report: DoctorReport = {
        id: `report_${Date.now()}`,
        name: fileName,
        uri: destFile.uri,
        mimeType: 'application/pdf',
        size: destFile.size,
        uploadedAt: new Date().toISOString(),
        status: 'pending',
        templateType: template,
        isDoctorFilled: false,
      };
      
      await saveReport(report);
      sweetAlert?.success('Report Ready!', 'Your PDF report has been generated and saved.');
      
      sweetAlert?.confirm?.('Share Report?', 'Would you like to share this report with your pediatrician?',
        async () => {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(destFile.uri, { mimeType: 'application/pdf', dialogTitle: `${currentBaby.name}'s Report` });
          }
        },
        () => {}
      );
    } catch (err) { 
      console.error(err); 
      sweetAlert?.alert?.('Failed', 'Could not create PDF. Please try again.'); 
    } finally { 
      setGenerating(false); 
    }
  }, [generateFullReportHTML, sections, currentBaby, sweetAlert, template]);

  // ─── Upload Doctor-Filled Report ──────────────────────────────────────
  const uploadDoctorReport = useCallback(async () => {
    if (!currentBaby) {
      sweetAlert?.alert?.('No Baby', 'Select a baby profile first.');
      return;
    }

    setUploading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        setUploading(false);
        return;
      }

      const asset = result.assets[0];
      
      const reportsDir = new Directory(Paths.document, 'DoctorReports');
      if (!reportsDir.exists) reportsDir.create();
      
      const sourceFile = new File(asset.uri);
      const fileName = `${(currentBaby.name || 'Baby').replace(/\s+/g, '_')}_DoctorFilled_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`;
      const destFile = new File(reportsDir, fileName);
      sourceFile.copy(destFile);

      const report: DoctorReport = {
        id: `doctor_${Date.now()}`,
        name: asset.name || fileName,
        uri: destFile.uri,
        mimeType: asset.mimeType || 'application/pdf',
        size: asset.size || 0,
        uploadedAt: new Date().toISOString(),
        status: 'reviewed',
        isDoctorFilled: true,
        doctorNotes: 'Doctor-filled report uploaded',
      };

      await saveReport(report);
      setUploading(false);
      sweetAlert?.success('Uploaded!', 'Doctor-filled report uploaded successfully.');
    } catch (error) {
      setUploading(false);
      sweetAlert?.alert?.('Error', 'Failed to upload report. Please try again.');
    }
  }, [currentBaby, sweetAlert]);

  // ─── SHAREABLE TEMPLATE SYSTEM ────────────────────────────────────────

  // Generate a shareable link for a template
  const createShareableTemplate = useCallback(async (template: ReportTemplate) => {
    if (!userProfile) {
      sweetAlert?.alert?.('Error', 'Please sign in to create shareable templates.');
      return;
    }

    const shareableTemplate: ReportTemplate = {
      ...template,
      shareableLink: `https://littleloom.app/share/template/${template.id}`,
      responseCount: 0,
      createdBy: userProfile.id,
      createdAt: new Date().toISOString(),
    };

    await saveShareableTemplate(shareableTemplate);
    sweetAlert?.success('Shareable Link Created!', 'Your template is now ready to share.');
  }, [userProfile, sweetAlert]);

  // Share the template link via native share or copy
  const shareTemplateLink = useCallback(async (template: ReportTemplate) => {
    const link = template.shareableLink || `https://littleloom.app/share/template/${template.id}`;
    setShareLink(link);
    setSelectedTemplateForShare(template);
    setShowShareModal(true);
  }, []);

  // Copy link to clipboard
  const copyLinkToClipboard = useCallback(async (link: string) => {
    try {
      await Clipboard.setString(link);
      sweetAlert?.success('Link Copied!', 'The shareable link has been copied to your clipboard.');
    } catch (error) {
      sweetAlert?.alert?.('Error', 'Could not copy link. Please try again.');
    }
  }, [sweetAlert]);

  // Share via native share dialog
  const shareViaNative = useCallback(async (link: string, templateName: string) => {
    try {
      const message = `📋 ${templateName} Template\n\nPlease fill out this template at:\n${link}\n\nThis is a secure, shareable form for pediatric records.`;
      await Share.share({
        message: message,
        title: `Share ${templateName} Template`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, []);

  // Simulate receiving a response (in production, this would be from a server)
  const simulateResponse = useCallback(async (templateId: string) => {
    const template = shareableTemplates.find(t => t.id === templateId);
    if (!template) return;

    const response: ShareableTemplateResponse = {
      id: `response_${Date.now()}`,
      templateId: templateId,
      respondentName: 'Dr. Sarah Johnson',
      respondentEmail: 'sarah.johnson@pediatrics.com',
      submittedAt: new Date().toISOString(),
      responses: {
        visit_date: new Date().toISOString().split('T')[0],
        chief_complaint: 'Routine wellness check. Parent reports good appetite and development.',
        history: 'No significant medical history. Birth history unremarkable.',
        medications: 'None currently.',
        allergies: 'No known allergies.',
        physical_exam: 'Vital signs normal. Age-appropriate development.',
        assessment: 'Healthy child, meeting all developmental milestones.',
        plan: 'Continue current routine. Next visit in 3 months.',
        doctor_name: 'Dr. Sarah Johnson',
        doctor_signature: 'Dr. Sarah Johnson, MD',
        doctor_email: 'sarah.johnson@pediatrics.com',
      },
      status: 'pending',
    };

    await saveShareResponse(response);
    sweetAlert?.success('Response Received!', 'A doctor has completed your template.');
  }, [shareableTemplates, sweetAlert]);

  // View all responses for a template
  const viewResponses = useCallback((templateId: string) => {
    const responses = shareResponses.filter(r => r.templateId === templateId);
    if (responses.length === 0) {
      sweetAlert?.alert('No Responses', 'No one has submitted this template yet.');
      return;
    }

    // Show responses in a modal or navigation
    Alert.alert(
      'Responses',
      `${responses.length} response(s) received:\n\n${responses.map(r => 
        `• ${r.respondentName} (${new Date(r.submittedAt).toLocaleDateString()}) - ${r.status}`
      ).join('\n')}`,
      [{ text: 'OK' }]
    );
  }, [shareResponses, sweetAlert]);

  // ─── Share Modal ──────────────────────────────────────────────────────
  const ShareModal = () => (
    <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
      <View style={styles.shareModalOverlay}>
        <View style={[styles.shareModalContent, { backgroundColor: theme.bg }]}>
          <View style={styles.shareModalHeader}>
            <Text style={[styles.shareModalTitle, { color: theme.text.primary }]}>Share Template</Text>
            <TouchableOpacity onPress={() => setShowShareModal(false)} style={styles.shareModalClose}>
              <Ionicons name="close" size={24} color={theme.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.shareModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.shareLinkContainer}>
              <Text style={[styles.shareLinkLabel, { color: theme.text.secondary }]}>Shareable Link</Text>
              <View style={[styles.shareLinkRow, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                <Text style={[styles.shareLinkText, { color: theme.text.primary }]} numberOfLines={1}>
                  {shareLink}
                </Text>
                <TouchableOpacity onPress={() => copyLinkToClipboard(shareLink)} style={styles.shareLinkCopyBtn}>
                  <Ionicons name="copy-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.shareActions}>
              <TouchableOpacity 
                style={[styles.shareActionBtn, { backgroundColor: theme.primary }]} 
                onPress={() => {
                  if (selectedTemplateForShare) {
                    shareViaNative(shareLink, selectedTemplateForShare.name);
                  }
                }}
              >
                <Ionicons name="share-social-outline" size={20} color="#fff" />
                <Text style={styles.shareActionBtnText}>Share via App</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.shareActionBtn, { backgroundColor: '#10b981' }]} 
                onPress={() => {
                  sweetAlert?.alert(
                    'Share via Email/SMS',
                    'You can share this link via your preferred messaging app using the Share button above.',
                  );
                }}
              >
                <Ionicons name="mail-outline" size={20} color="#fff" />
                <Text style={styles.shareActionBtnText}>Email/SMS</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.shareInstructions}>
              <Text style={[styles.shareInstructionsTitle, { color: theme.text.secondary }]}>How it works:</Text>
              <Text style={[styles.shareInstructionsText, { color: theme.text.muted }]}>
                1. Share this link with your pediatrician or specialist
              </Text>
              <Text style={[styles.shareInstructionsText, { color: theme.text.muted }]}>
                2. They fill out the template on their device
              </Text>
              <Text style={[styles.shareInstructionsText, { color: theme.text.muted }]}>
                3. You'll receive the completed report back automatically
              </Text>
              <Text style={[styles.shareInstructionsText, { color: theme.text.muted }]}>
                4. Review and save the filled report
              </Text>
            </View>

            {selectedTemplateForShare && (
              <View style={styles.shareTemplateInfo}>
                <Text style={[styles.shareTemplateName, { color: theme.text.primary }]}>
                  📋 {selectedTemplateForShare.name}
                </Text>
                <Text style={[styles.shareTemplateDesc, { color: theme.text.muted }]}>
                  {selectedTemplateForShare.description}
                </Text>
                <Badge 
                  text={`${selectedTemplateForShare.sections.length} fields`} 
                  color={selectedTemplateForShare.color} 
                  bg={`${selectedTemplateForShare.color}15`} 
                />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ─── View Report ──────────────────────────────────────────────────────
  const viewReport = useCallback(async (report: DoctorReport) => {
    try {
      const file = new File(report.uri);
      if (!file.exists) {
        sweetAlert?.alert?.('Error', 'Report file not found.');
        return;
      }
      setSelectedReport(report);
      setShowReportDetail(true);
    } catch (error) {
      sweetAlert?.alert?.('Error', 'Could not open report.');
    }
  }, [sweetAlert]);

  // ─── Delete Report ────────────────────────────────────────────────────
  const deleteReport = useCallback((report: DoctorReport) => {
    sweetAlert?.confirm?.('Delete Report', `Delete "${report.name}"?`,
      async () => {
        try {
          const file = new File(report.uri);
          if (file.exists) file.delete();
          await deleteReportFile(report.id);
          sweetAlert?.success('Deleted', 'Report removed.');
        } catch (error) {
          sweetAlert?.alert?.('Error', 'Could not delete report.');
        }
      },
      () => {}
    );
  }, [sweetAlert]);

  // ─── Share Report ─────────────────────────────────────────────────────
  const shareReport = useCallback(async (report: DoctorReport) => {
    try {
      const file = new File(report.uri);
      if (!file.exists) {
        sweetAlert?.alert?.('Error', 'Report file not found.');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
      }
    } catch (error) {
      sweetAlert?.alert?.('Error', 'Could not share report.');
    }
  }, [sweetAlert]);

  // ─── Render ────────────────────────────────────────────────────────────

  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Ionicons name="document-text-outline" size={64} color={theme.text.muted} />
        <Text style={[styles.emptyTitle, { color: theme.text.primary, marginTop: 16 }]}>No Baby Profile</Text>
        <Text style={[styles.emptySub, { color: theme.text.muted, textAlign: 'center', marginTop: 8 }]}>Select a baby profile to generate or upload reports.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>{currentBaby.name}'s Reports</Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.muted }]}>Pediatric Documents</Text>
      </Animated.View>

      <Animated.ScrollView 
        onScroll={scrollHandler} 
        scrollEventThrottle={16} 
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }} 
        showsVerticalScrollIndicator={false}
      >
        <BabyProfileHeader baby={currentBaby} />

        {/* ─── Mode Selector ────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(40).springify()}>
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'generate' && { backgroundColor: theme.primary }]}
              onPress={() => setMode('generate')}
            >
              <Ionicons name="create-outline" size={18} color={mode === 'generate' ? '#fff' : theme.text.primary} />
              <Text style={[styles.modeBtnText, { color: mode === 'generate' ? '#fff' : theme.text.primary }]}>Generate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'templates' && { backgroundColor: theme.primary }]}
              onPress={() => setMode('templates')}
            >
              <Ionicons name="document-text-outline" size={18} color={mode === 'templates' ? '#fff' : theme.text.primary} />
              <Text style={[styles.modeBtnText, { color: mode === 'templates' ? '#fff' : theme.text.primary }]}>Templates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'share' && { backgroundColor: theme.primary }]}
              onPress={() => setMode('share')}
            >
              <Ionicons name="share-social-outline" size={18} color={mode === 'share' ? '#fff' : theme.text.primary} />
              <Text style={[styles.modeBtnText, { color: mode === 'share' ? '#fff' : theme.text.primary }]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'upload' && { backgroundColor: theme.primary }]}
              onPress={() => setMode('upload')}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={mode === 'upload' ? '#fff' : theme.text.primary} />
              <Text style={[styles.modeBtnText, { color: mode === 'upload' ? '#fff' : theme.text.primary }]}>Upload</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── GENERATE MODE ────────────────────────────────────────────── */}
        {mode === 'generate' && (
          <>
            <Animated.View entering={FadeInUp.delay(60).springify()}>
              <GlassCard style={styles.heroCard}>
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="document-text" size={36} color="#fff" />
                  <Text style={styles.heroTitle}>Generate Full Report</Text>
                  <Text style={styles.heroSub}>Create a comprehensive pediatric report</Text>
                  <View style={styles.heroStats}>
                    <View style={styles.heroStat}><Text style={styles.heroStatNum}>{stats.total}</Text><Text style={styles.heroStatLabel}>Entries</Text></View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStat}><Text style={styles.heroStatNum}>{stats.trackers}</Text><Text style={styles.heroStatLabel}>Trackers</Text></View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStat}><Text style={styles.heroStatNum}>{stats.today}</Text><Text style={styles.heroStatLabel}>Today</Text></View>
                  </View>
                </LinearGradient>
              </GlassCard>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(80).springify()}>
              <SectionHeader title="Report Template" icon="layers-outline" subtitle="Choose a starting preset" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
                {([
                  { id: 'full', label: 'Full Report', icon: 'document-text', desc: 'Everything' },
                  { id: 'visit', label: 'Visit Summary', icon: 'medical', desc: 'Essentials' },
                  { id: 'growth', label: 'Growth Focus', icon: 'trending-up', desc: 'Charts & %iles' },
                  { id: 'development', label: 'Development', icon: 'body', desc: 'Milestones' },
                  { id: 'emergency', label: 'Emergency', icon: 'warning', desc: 'Health & contacts' },
                ] as const).map(t => (
                  <TouchableOpacity key={t.id} onPress={() => applyTemplate(t.id as ReportTemplate)} style={[styles.templateChip, template === t.id && { borderColor: theme.primary, backgroundColor: `${theme.primary}15` }]}>
                    <Ionicons name={t.icon as any} size={20} color={template === t.id ? theme.primary : theme.text.muted} />
                    <Text style={[styles.templateLabel, { color: template === t.id ? theme.primary : theme.text.primary }]}>{t.label}</Text>
                    <Text style={[styles.templateDesc, { color: theme.text.muted }]}>{t.desc}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(100).springify()}>
              <SectionHeader title="Date Range" icon="calendar-outline" />
              <View style={styles.rangeRow}>
                {(['7d', '30d', '90d', 'all'] as const).map(r => (
                  <TouchableOpacity key={r} onPress={() => setDateRange(r)} style={[styles.rangeBtn, dateRange === r && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                    <Text style={[styles.rangeBtnText, { color: dateRange === r ? '#fff' : theme.text.primary }]}>{r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* ─── Sections Toggle ──────────────────────────────────────── */}
            <Animated.View entering={FadeInUp.delay(120).springify()}>
              <SectionHeader title="Report Sections" icon="list-outline" subtitle="Toggle what to include" />
              <GlassCard style={styles.sectionsCard}>
                {sections.map((sec, idx) => (
                  <View key={sec.id} style={[styles.sectionRow, idx !== sections.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                    <View style={styles.sectionRowLeft}>
                      <Text style={styles.sectionEmoji}>{sec.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sectionRowLabel, { color: theme.text.primary }]}>{sec.label}</Text>
                        <Text style={[styles.sectionRowDesc, { color: theme.text.muted }]}>{sec.description}</Text>
                      </View>
                    </View>
                    <Switch value={sec.enabled} onValueChange={() => toggleSection(sec.id)} trackColor={{ false: '#767577', true: `${theme.primary}80` }} thumbColor={sec.enabled ? theme.primary : '#f4f3f4'} />
                  </View>
                ))}
              </GlassCard>
            </Animated.View>

            {/* ─── Notes ────────────────────────────────────────────────── */}
            <Animated.View entering={FadeInUp.delay(140).springify()}>
              <SectionHeader title="Notes for Doctor" icon="create-outline" subtitle="Concerns or questions" />
              <GlassCard style={styles.notesCard}>
                <TextInput 
                  value={customNotes} 
                  onChangeText={setCustomNotes} 
                  placeholder="e.g., Fussy after feeds, rash on neck..." 
                  placeholderTextColor={theme.text.muted} 
                  multiline 
                  numberOfLines={4} 
                  style={[styles.notesInput, { color: theme.text.primary }]} 
                  textAlignVertical="top" 
                />
              </GlassCard>
            </Animated.View>

            {/* ─── Generate Button ──────────────────────────────────────── */}
            <Animated.View entering={FadeInUp.delay(160).springify()}>
              <TouchableOpacity onPress={generateFullReportPDF} disabled={generating} style={[styles.generateBtn, { backgroundColor: generating ? theme.text.muted : theme.primary }]}>
                {generating ? <ActivityIndicator color="#fff" /> : <><Ionicons name="download-outline" size={22} color="#fff" /><Text style={styles.generateBtnText}>Generate PDF Report</Text></>}
              </TouchableOpacity>
              <Text style={[styles.disclaimer, { color: theme.text.muted }]}>Reports are generated locally. No data leaves your device.</Text>
            </Animated.View>
          </>
        )}

        {/* ─── TEMPLATES MODE ───────────────────────────────────────────── */}
        {mode === 'templates' && (
          <>
            <Animated.View entering={FadeInUp.delay(60).springify()}>
              <GlassCard style={styles.uploadHeroCard}>
                <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.templateHeroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="document-text" size={36} color="#fff" />
                  <Text style={styles.uploadHeroTitle}>Fillable Report Templates</Text>
                  <Text style={styles.uploadHeroSub}>Choose a template, fill it out, and generate a professional PDF</Text>
                </LinearGradient>
              </GlassCard>
            </Animated.View>

            <View style={styles.templateGrid}>
              {REPORT_TEMPLATES.map((t, index) => (
                <Animated.View key={t.id} entering={FadeInUp.delay(80 + index * 60).springify()} style={styles.templateGridItem}>
                  <TouchableOpacity
                    style={[styles.templateCard, { borderColor: `${t.color}30` }]}
                    onPress={() => handleTemplateSelect(t)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.templateCardIcon, { backgroundColor: `${t.color}15` }]}>
                      <Ionicons name={t.icon as any} size={28} color={t.color} />
                    </View>
                    <Text style={[styles.templateCardName, { color: theme.text.primary }]}>{t.name}</Text>
                    <Text style={[styles.templateCardDesc, { color: theme.text.muted }]}>{t.description}</Text>
                    <View style={[styles.templateCardBadge, { backgroundColor: `${t.color}10` }]}>
                      <Text style={[styles.templateCardBadgeText, { color: t.color }]}>{t.sections.length} fields</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </>
        )}

        {/* ─── SHARE MODE ────────────────────────────────────────────────── */}
        {mode === 'share' && (
          <>
            <Animated.View entering={FadeInUp.delay(60).springify()}>
              <GlassCard style={styles.shareHeroCard}>
                <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.shareHeroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="share-social" size={36} color="#fff" />
                  <Text style={styles.shareHeroTitle}>Shareable Templates</Text>
                  <Text style={styles.shareHeroSub}>Send templates to doctors and receive filled reports</Text>
                </LinearGradient>
              </GlassCard>
            </Animated.View>

            <SectionHeader 
              title="Your Shareable Templates" 
              icon="share-social-outline" 
              subtitle={`${shareableTemplates.length} templates shared`} 
            />

            {shareableTemplates.length === 0 ? (
              <GlassCard>
                <View style={styles.emptyShareContainer}>
                  <Ionicons name="share-social-outline" size={48} color={theme.text.muted} />
                  <Text style={[styles.emptyShareText, { color: theme.text.muted }]}>No shareable templates yet</Text>
                  <Text style={[styles.emptyShareSub, { color: theme.text.muted }]}>
                    Generate a template and create a shareable link
                  </Text>
                </View>
              </GlassCard>
            ) : (
              shareableTemplates.map((t) => (
                <GlassCard key={t.id} style={styles.shareTemplateCard}>
                  <View style={styles.shareTemplateRow}>
                    <View style={styles.shareTemplateLeft}>
                      <View style={[styles.shareTemplateIcon, { backgroundColor: `${t.color}15` }]}>
                        <Ionicons name={t.icon as any} size={22} color={t.color} />
                      </View>
                      <View style={styles.shareTemplateInfo}>
                        <Text style={[styles.shareTemplateName, { color: theme.text.primary }]}>{t.name}</Text>
                        <Text style={[styles.shareTemplateMeta, { color: theme.text.muted }]}>
                          {t.sections.length} fields • {t.responseCount || 0} responses
                        </Text>
                      </View>
                    </View>
                    <View style={styles.shareTemplateActions}>
                      <TouchableOpacity 
                        onPress={() => createShareableTemplate(t)} 
                        style={[styles.shareTemplateAction, { backgroundColor: `${t.color}15` }]}
                      >
                        <Ionicons name="link-outline" size={16} color={t.color} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => shareTemplateLink(t)} 
                        style={[styles.shareTemplateAction, { backgroundColor: `${theme.primary}15` }]}
                      >
                        <Ionicons name="share-outline" size={16} color={theme.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => viewResponses(t.id)} 
                        style={[styles.shareTemplateAction, { backgroundColor: '#10b98115' }]}
                      >
                        <Ionicons name="chatbubbles-outline" size={16} color="#10b981" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}

            {/* ─── Recent Responses ─────────────────────────────────────── */}
            {shareResponses.length > 0 && (
              <>
                <SectionHeader 
                  title="Recent Responses" 
                  icon="chatbubbles-outline" 
                  subtitle={`${shareResponses.length} total responses`} 
                />
                {shareResponses.slice(0, 5).map((response) => {
                  const template = shareableTemplates.find(t => t.id === response.templateId);
                  return (
                    <GlassCard key={response.id} style={styles.responseCard}>
                      <View style={styles.responseRow}>
                        <View style={styles.responseInfo}>
                          <Text style={[styles.responseName, { color: theme.text.primary }]}>
                            {response.respondentName}
                          </Text>
                          <Text style={[styles.responseMeta, { color: theme.text.muted }]}>
                            {template?.name || 'Unknown template'} • {new Date(response.submittedAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={[styles.responseStatusBadge, { 
                          backgroundColor: response.status === 'approved' ? '#10b98115' : 
                                         response.status === 'reviewed' ? '#3b82f615' : '#f59e0b15' 
                        }]}>
                          <Text style={[styles.responseStatusText, { 
                            color: response.status === 'approved' ? '#10b981' : 
                                   response.status === 'reviewed' ? '#3b82f6' : '#f59e0b' 
                          }]}>
                            {response.status === 'approved' ? 'Approved' : 
                             response.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </GlassCard>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ─── UPLOAD MODE ──────────────────────────────────────────────── */}
        {mode === 'upload' && (
          <>
            <Animated.View entering={FadeInUp.delay(60).springify()}>
              <GlassCard style={styles.uploadHeroCard}>
                <LinearGradient colors={['#10b981', '#34d399']} style={styles.uploadHeroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="cloud-upload" size={36} color="#fff" />
                  <Text style={styles.uploadHeroTitle}>Upload Completed Report</Text>
                  <Text style={styles.uploadHeroSub}>Upload the PDF report filled out by your pediatrician</Text>
                  
                  <TouchableOpacity 
                    onPress={uploadDoctorReport} 
                    disabled={uploading} 
                    style={[styles.uploadHeroBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                  >
                    {uploading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="cloud-upload-outline" size={20} color="#fff" /><Text style={styles.uploadHeroBtnText}>Upload Report</Text></>}
                  </TouchableOpacity>
                </LinearGradient>
              </GlassCard>
            </Animated.View>

            {/* ─── Report List ──────────────────────────────────────────── */}
            <Animated.View entering={FadeInUp.delay(80).springify()}>
              <SectionHeader 
                title="All Reports" 
                icon="document-text-outline" 
                subtitle={`${reportHistory.length} reports saved`} 
              />
              
              {reportHistory.length === 0 ? (
                <GlassCard>
                  <View style={styles.emptyReportsContainer}>
                    <Ionicons name="document-text-outline" size={48} color={theme.text.muted} />
                    <Text style={[styles.emptyReportsText, { color: theme.text.muted }]}>No reports yet</Text>
                    <Text style={[styles.emptyReportsSub, { color: theme.text.muted }]}>Generate or upload your first report</Text>
                  </View>
                </GlassCard>
              ) : (
                reportHistory.map((report) => (
                  <GlassCard key={report.id} style={styles.reportCard}>
                    <View style={styles.reportCardRow}>
                      <View style={styles.reportCardLeft}>
                        <View style={[styles.reportCardIcon, { 
                          backgroundColor: report.isDoctorFilled ? '#10b98115' : '#667eea15' 
                        }]}>
                          <Ionicons 
                            name={report.isDoctorFilled ? 'medical-outline' : 'document-text'} 
                            size={24} 
                            color={report.isDoctorFilled ? '#10b981' : '#667eea'} 
                          />
                        </View>
                        <View style={styles.reportCardInfo}>
                          <Text style={[styles.reportCardName, { color: theme.text.primary }]} numberOfLines={1}>
                            {report.name}
                          </Text>
                          <Text style={[styles.reportCardMeta, { color: theme.text.muted }]}>
                            {new Date(report.uploadedAt).toLocaleDateString()} • 
                            {report.isDoctorFilled ? ' 👨‍⚕️ Filled' : ' 📄 Generated'}
                          </Text>
                          <View style={styles.reportCardStatus}>
                            <View style={[styles.reportStatusDot, { 
                              backgroundColor: report.status === 'approved' ? '#10b981' : 
                                             report.status === 'reviewed' ? '#3b82f6' : '#f59e0b' 
                            }]} />
                            <Text style={[styles.reportCardStatusText, { color: theme.text.muted }]}>
                              {report.status === 'approved' ? 'Approved' : 
                               report.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.reportCardActions}>
                        <TouchableOpacity onPress={() => viewReport(report)} style={styles.reportCardAction}>
                          <Ionicons name="eye-outline" size={18} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => shareReport(report)} style={styles.reportCardAction}>
                          <Ionicons name="share-outline" size={18} color={theme.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteReport(report)} style={styles.reportCardAction}>
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </GlassCard>
                ))
              )}
            </Animated.View>
          </>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>

      {/* ─── Template Form Modal ────────────────────────────────────────── */}
      <Modal visible={showTemplateForm} transparent animationType="slide" onRequestClose={() => setShowTemplateForm(false)}>
        <KeyboardAvoidingView 
          style={styles.templateFormOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.templateFormContent, { backgroundColor: theme.bg }]}>
            <View style={styles.templateFormHeader}>
              <Text style={[styles.templateFormTitle, { color: theme.text.primary }]}>
                {selectedTemplate?.name || 'Template'}
              </Text>
              <TouchableOpacity onPress={() => setShowTemplateForm(false)} style={styles.templateFormClose}>
                <Ionicons name="close" size={24} color={theme.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.templateFormBody} showsVerticalScrollIndicator={false}>
              {selectedTemplate && (
                <>
                  <Text style={[styles.templateFormDesc, { color: theme.text.muted }]}>
                    {selectedTemplate.description}
                  </Text>
                  
                  {selectedTemplate.sections.map((field) => (
                    <TemplateFieldComponent
                      key={field.id}
                      field={field}
                      value={templateValues[field.id] || ''}
                      onChange={handleTemplateFieldChange}
                      theme={theme}
                    />
                  ))}

                  <TouchableOpacity
                    style={[styles.templateFormSubmit, { backgroundColor: selectedTemplate.color }]}
                    onPress={handleGenerateTemplatePDF}
                    disabled={generating}
                  >
                    {generating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={20} color="#fff" />
                        <Text style={styles.templateFormSubmitText}>Generate Template PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.templateFormShareBtn, { borderColor: selectedTemplate.color }]}
                    onPress={async () => {
                      setShowTemplateForm(false);
                      await createShareableTemplate(selectedTemplate);
                      setMode('share');
                    }}
                  >
                    <Ionicons name="share-social-outline" size={20} color={selectedTemplate.color} />
                    <Text style={[styles.templateFormShareText, { color: selectedTemplate.color }]}>
                      Make Shareable
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Share Modal ────────────────────────────────────────────────── */}
      <ShareModal />

      {/* ─── Report Detail Modal ───────────────────────────────────────── */}
      <Modal visible={showReportDetail} transparent animationType="slide" onRequestClose={() => setShowReportDetail(false)}>
        <View style={styles.detailModalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: theme.bg }]}>
            <View style={styles.detailModalHeader}>
              <Text style={[styles.detailModalTitle, { color: theme.text.primary }]}>Report Details</Text>
              <TouchableOpacity onPress={() => setShowReportDetail(false)} style={styles.detailModalClose}>
                <Ionicons name="close" size={24} color={theme.text.primary} />
              </TouchableOpacity>
            </View>
            
            {selectedReport && (
              <ScrollView style={styles.detailModalBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.detailIconWrap, { 
                  backgroundColor: selectedReport.isDoctorFilled ? '#10b98115' : '#667eea15' 
                }]}>
                  <Ionicons 
                    name={selectedReport.isDoctorFilled ? 'medical-outline' : 'document-text'} 
                    size={48} 
                    color={selectedReport.isDoctorFilled ? '#10b981' : '#667eea'} 
                  />
                </View>
                
                <Text style={[styles.detailFileName, { color: theme.text.primary }]}>{selectedReport.name}</Text>
                
                <View style={styles.detailMetaGrid}>
                  <View style={styles.detailMetaItem}>
                    <Text style={[styles.detailMetaLabel, { color: theme.text.muted }]}>Uploaded</Text>
                    <Text style={[styles.detailMetaValue, { color: theme.text.primary }]}>
                      {new Date(selectedReport.uploadedAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailMetaItem}>
                    <Text style={[styles.detailMetaLabel, { color: theme.text.muted }]}>Status</Text>
                    <View style={[styles.detailStatusBadge, { 
                      backgroundColor: selectedReport.status === 'approved' ? '#10b98115' : 
                                     selectedReport.status === 'reviewed' ? '#3b82f615' : '#f59e0b15' 
                    }]}>
                      <Text style={[styles.detailStatusText, { 
                        color: selectedReport.status === 'approved' ? '#10b981' : 
                               selectedReport.status === 'reviewed' ? '#3b82f6' : '#f59e0b' 
                      }]}>
                        {selectedReport.status === 'approved' ? '✅ Approved' : 
                         selectedReport.status === 'reviewed' ? '📋 Reviewed' : '⏳ Pending'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={[styles.detailMetaItem, { marginTop: 8 }]}>
                  <Text style={[styles.detailMetaLabel, { color: theme.text.muted }]}>Type</Text>
                  <Text style={[styles.detailMetaValue, { color: theme.text.primary }]}>
                    {selectedReport.isDoctorFilled ? '👨‍⚕️ Doctor-Filled Report' : '📄 Generated Report'}
                  </Text>
                </View>
                
                {selectedReport.doctorNotes && (
                  <View style={styles.detailNotes}>
                    <Text style={[styles.detailNotesLabel, { color: theme.text.muted }]}>Doctor's Notes</Text>
                    <Text style={[styles.detailNotesText, { color: theme.text.primary }]}>
                      {selectedReport.doctorNotes}
                    </Text>
                  </View>
                )}
                
                <View style={styles.detailActions}>
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, { backgroundColor: theme.primary }]} 
                    onPress={() => {
                      if (selectedReport) shareReport(selectedReport);
                    }}
                  >
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.detailActionBtnText}>Share</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, { backgroundColor: selectedReport.isDoctorFilled ? theme.secondary : '#667eea' }]} 
                    onPress={() => {
                      if (selectedReport) {
                        Linking.openURL(selectedReport.uri);
                      }
                    }}
                  >
                    <Ionicons name="eye-outline" size={18} color="#fff" />
                    <Text style={styles.detailActionBtnText}>Open</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, { backgroundColor: '#ef4444' }]} 
                    onPress={() => {
                      if (selectedReport) {
                        deleteReport(selectedReport);
                        setShowReportDetail(false);
                      }
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.detailActionBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  
  /* Sticky Header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* Glass Card */
  glassCard: { marginHorizontal: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  /* Section Header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, marginTop: 20, gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* Mode Selector */
  modeSelector: { flexDirection: 'row', gap: 6, marginHorizontal: 16, marginBottom: 16, flexWrap: 'wrap' },
  modeBtn: { flex: 1, minWidth: (SCREEN_W - 56) / 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', backgroundColor: 'rgba(255,255,255,0.5)' },
  modeBtnText: { fontSize: 11, fontWeight: '700' },

  /* Hero Cards */
  heroCard: { marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },
  heroGradient: { padding: 22, alignItems: 'center', borderRadius: 16 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 10 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3, textAlign: 'center' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 20 },
  heroStat: { alignItems: 'center', minWidth: 60 },
  heroStatNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.3)' },

  /* Share Hero */
  shareHeroCard: { marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },
  shareHeroGradient: { padding: 22, alignItems: 'center', borderRadius: 16 },
  shareHeroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 10 },
  shareHeroSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3, textAlign: 'center' },

  /* Template Hero */
  templateHeroGradient: { padding: 22, alignItems: 'center', borderRadius: 16 },

  /* Upload Hero */
  uploadHeroCard: { marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },
  uploadHeroGradient: { padding: 22, alignItems: 'center', borderRadius: 16 },
  uploadHeroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 10 },
  uploadHeroSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3, textAlign: 'center' },
  uploadHeroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  uploadHeroBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Templates */
  templateScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  templateChip: { width: 100, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)', backgroundColor: 'rgba(255,255,255,0.5)' },
  templateLabel: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  templateDesc: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  /* Template Grid */
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 16, marginBottom: 16 },
  templateGridItem: { width: (SCREEN_W - 56) / 2 },
  templateCard: { padding: 16, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)' },
  templateCardIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  templateCardName: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  templateCardDesc: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginBottom: 8, opacity: 0.7 },
  templateCardBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  templateCardBadgeText: { fontSize: 10, fontWeight: '700' },

  /* Template Form */
  templateFormOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  templateFormContent: { width: '100%', maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  templateFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  templateFormTitle: { fontSize: 18, fontWeight: '800' },
  templateFormClose: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  templateFormBody: { padding: 20 },
  templateFormDesc: { fontSize: 14, fontWeight: '500', marginBottom: 20, opacity: 0.7 },
  templateFormSubmit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginTop: 12 },
  templateFormSubmitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  templateFormShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, marginTop: 10 },
  templateFormShareText: { fontSize: 14, fontWeight: '700' },

  /* Template Fields */
  templateFieldContainer: { marginBottom: 16 },
  templateFieldLabel: { marginBottom: 6 },
  templateFieldLabelText: { fontSize: 13, fontWeight: '600' },
  templateHelpText: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  templateInput: { height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, borderWidth: 1 },
  templateTextArea: { height: 100, borderRadius: 10, paddingHorizontal: 14, paddingTop: 12, fontSize: 15, borderWidth: 1, textAlignVertical: 'top' },
  templateSelectContainer: { height: 48, borderRadius: 10, paddingHorizontal: 14, borderWidth: 1, justifyContent: 'center' },
  templateSelect: { fontSize: 15, paddingVertical: 12 },
  templateDateInput: { height: 48, borderRadius: 10, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateDateText: { fontSize: 15 },
  templateSignatureInput: { height: 48, borderRadius: 10, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateSignatureText: { fontSize: 15 },
  templateReadonlyValue: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  templateReadonlyText: { fontSize: 15 },

  /* Date Range */
  rangeRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  rangeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.6)' },
  rangeBtnText: { fontSize: 13, fontWeight: '700' },

  /* Badge */
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  /* Profile Header */
  profileCard: { marginHorizontal: 16, marginBottom: 16, overflow: 'hidden' },
  profileGradient: { padding: 20, borderRadius: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { position: 'relative' },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 24, fontWeight: '800', color: '#fff' },
  avatarRing: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 42, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileMeta: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },
  profileChips: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },

  /* Percentiles */
  percGrid: { padding: 16, gap: 14 },
  percItem: { gap: 6 },
  percTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  percLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  percValue: { fontSize: 20, fontWeight: '800' },
  percBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  percBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  percBarFill: { height: '100%', borderRadius: 3 },
  percNum: { fontSize: 11, fontWeight: '700', width: 50, textAlign: 'right' },
  percDisclaimer: { fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },

  /* Sections Toggle */
  sectionsCard: { paddingVertical: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  sectionRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
  sectionEmoji: { fontSize: 20 },
  sectionRowLabel: { fontSize: 15, fontWeight: '700' },
  sectionRowDesc: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Notes */
  notesCard: { padding: 12 },
  notesInput: { fontSize: 14, lineHeight: 20, minHeight: 80, fontWeight: '500' },

  /* Generate Button */
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 18, marginHorizontal: 16, marginTop: 8 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 14, lineHeight: 18, marginHorizontal: 30 },

  /* Report Cards */
  reportCard: { padding: 0, overflow: 'hidden' },
  reportCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  reportCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  reportCardIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  reportCardInfo: { flex: 1 },
  reportCardName: { fontSize: 14, fontWeight: '700' },
  reportCardMeta: { fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  reportCardStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  reportStatusDot: { width: 6, height: 6, borderRadius: 3 },
  reportCardStatusText: { fontSize: 10, fontWeight: '600', opacity: 0.7 },
  reportCardActions: { flexDirection: 'row', gap: 6 },
  reportCardAction: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },

  /* Empty State */
  emptyReportsContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyReportsText: { fontSize: 16, fontWeight: '600' },
  emptyReportsSub: { fontSize: 13, fontWeight: '500', opacity: 0.7 },
  emptyShareContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyShareText: { fontSize: 16, fontWeight: '600' },
  emptyShareSub: { fontSize: 13, fontWeight: '500', opacity: 0.7, textAlign: 'center' },

  /* Share Templates */
  shareTemplateCard: { padding: 0, overflow: 'hidden' },
  shareTemplateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 10 },
  shareTemplateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  shareTemplateIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  shareTemplateName: { fontSize: 14, fontWeight: '700' },
  shareTemplateMeta: { fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  shareTemplateActions: { flexDirection: 'row', gap: 6 },
  shareTemplateAction: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  /* Responses */
  responseCard: { padding: 0, overflow: 'hidden' },
  responseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  responseInfo: { flex: 1 },
  responseName: { fontSize: 14, fontWeight: '700' },
  responseMeta: { fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  responseStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  responseStatusText: { fontSize: 10, fontWeight: '700' },

  /* Share Modal */
  shareModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  shareModalContent: { width: '100%', maxWidth: 400, maxHeight: '80%', borderRadius: 24, overflow: 'hidden' },
  shareModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  shareModalTitle: { fontSize: 18, fontWeight: '800' },
  shareModalClose: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  shareModalBody: { padding: 20 },
  shareLinkContainer: { marginBottom: 20 },
  shareLinkLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  shareLinkRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12 },
  shareLinkText: { fontSize: 13, fontWeight: '500', flex: 1, paddingVertical: 12 },
  shareLinkCopyBtn: { padding: 8 },
  shareActions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  shareActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12 },
  shareActionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  shareInstructions: { backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 16, gap: 6 },
  shareInstructionsTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  shareInstructionsText: { fontSize: 12, fontWeight: '500', lineHeight: 20, opacity: 0.8 },
  shareTemplateInfo: { marginTop: 16, padding: 14, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, alignItems: 'center', gap: 4 },

  /* Detail Modal */
  detailModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  detailModalContent: { width: '100%', maxWidth: 400, maxHeight: '80%', borderRadius: 24, overflow: 'hidden' },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  detailModalTitle: { fontSize: 18, fontWeight: '800' },
  detailModalClose: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },
  detailModalBody: { padding: 20 },
  detailIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  detailFileName: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  detailMetaGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  detailMetaItem: { flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 12 },
  detailMetaLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 },
  detailMetaValue: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  detailStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
  detailStatusText: { fontSize: 12, fontWeight: '700' },
  detailNotes: { backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 12, marginTop: 8 },
  detailNotesLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 },
  detailNotesText: { fontSize: 14, fontWeight: '500', marginTop: 4, lineHeight: 20 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  detailActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  detailActionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Empty */
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { fontSize: 14, lineHeight: 20 },
});

export default PediatricianPDFExport;