import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Linking,
  Pressable,
  StatusBar,
} from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useCustomization } from '@/hooks/useCustomization';
import { useSweetAlert } from '@/components/SweetAlert';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/hooks/useTrackerContext';
import { useBaby } from '@/context/BabyContext';
import { useFamily } from '@/context/FamilyContext';
import { useAuth } from '@/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInMonths, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════
   CLINICAL DATA
   ═══════════════════════════════════════════════════════════════════════ */
import {
  WHO_BOY_LMS,
  WHO_GIRL_LMS,
  calculateZScore,
  calculateZScoreRestricted,
  calculatePercentilePrecise,
  zScoreToPercentile,
  zScoreToValue,
} from '@/hooks/useWHOGrowthCalculator';

const getGrowthRef = (
  gender: string,
  type: 'weight' | 'height' | 'head',
  ageMonths: number
): { med: number; sd: number } => {
  const g: 'boy' | 'girl' = gender === 'girl' || gender === 'female' ? 'girl' : 'boy';
  const clampedAge = Math.max(0, Math.min(24, Math.round(ageMonths)));
  const table = g === 'girl' ? WHO_GIRL_LMS : WHO_BOY_LMS;
  const lms = table[clampedAge]?.[type];
  if (!lms) return { med: 0, sd: 1 };
  const med = zScoreToValue(0, lms);
  const plus1 = zScoreToValue(1, lms);
  return { med, sd: Math.max(0.01, plus1 - med) };
};

const zToPercentile = (z: number): number => zScoreToPercentile(z);

/* ═══════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════ */

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
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

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
type PresetId = 'full' | 'visit' | 'growth' | 'development' | 'emergency';

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */
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
const escapeHtml = (str: string) =>
  str?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') || '';

const getBabyAgeMonths = (birthDate?: string) => {
  if (!birthDate) return 0;
  return differenceInMonths(new Date(), new Date(birthDate));
};

const genderToLMS: (g?: string) => 'boy' | 'girl' = (g) =>
  g === 'girl' || g === 'female' ? 'girl' : 'boy';

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
  const { isDark } = useCustomization();
  return useMemo(() => ({ isDark: !!isDark }), [isDark]);
};

/* ═══════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
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
const PressableScale = React.memo<{
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

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: {
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

/* ═══════════════════════════════════════════════════════════════════════
   Report Pulse — compact animated header (no big hero card)
   ═══════════════════════════════════════════════════════════════════════ */

const ReportPulse = React.memo<{
  isDark: boolean;
  baby: any;
  ageMonths: number;
  stats: { total: number; trackers: number; reports: number; pending: number };
  onBabyPress: () => void;
  onSwitchMode: (mode: ReportMode) => void;
}>(({ isDark, baby, ageMonths, stats, onBabyPress, onSwitchMode }) => {
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

  const hasAttention = stats.pending > 0;
  const statusColor = hasAttention ? DS.warning : stats.reports > 0 ? DS.success : DS.primary;
  const statusLabel = !baby
    ? 'Add baby profile to start'
    : hasAttention
    ? `${stats.pending} report${stats.pending === 1 ? '' : 's'} pending review`
    : stats.reports > 0
    ? `${stats.reports} report${stats.reports === 1 ? '' : 's'} saved · ready to share`
    : 'Ready to generate your first report';

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
                {baby?.avatar ? (
                  <Image source={{ uri: baby.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <Ionicons name="person" size={22} color={DS.primary} />
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
              <View style={[styles.pulseLiveDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={() => onSwitchMode('upload')} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="cloud-upload-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={() => onSwitchMode('generate')} activeScale={0.9}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add" size={22} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{stats.total}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>entries</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.accent }]}>{stats.trackers}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>trackers</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success }]}>{stats.reports}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>reports</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: stats.pending > 0 ? DS.warning : DS.gray400 }]}>{stats.pending}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>pending</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════ */

const AuraRibbon = React.memo<{
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

/* ═══════════════════════════════════════════════════════════════════════
   Mode Switcher
   ═══════════════════════════════════════════════════════════════════════ */

const ModeSwitcher = React.memo<{
  mode: ReportMode;
  onChange: (m: ReportMode) => void;
  isDark: boolean;
  counts: { generate?: number; templates?: number; upload?: number; share?: number };
}>(({ mode, onChange, isDark, counts }) => {
  const opts: { key: ReportMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'generate', label: 'Generate', icon: 'create-outline' },
    { key: 'templates', label: 'Templates', icon: 'document-text-outline' },
    { key: 'share', label: 'Share', icon: 'share-social-outline' },
    { key: 'upload', label: 'Upload', icon: 'cloud-upload-outline' },
  ];
  return (
    <View style={[styles.modeBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
      {opts.map((o) => {
        const active = mode === o.key;
        const count = counts[o.key as keyof typeof counts];
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.modeItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}
            activeOpacity={0.85}
          >
            <Ionicons name={o.icon} size={15} color={active ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
            <Text style={[styles.modeLabel, { color: active ? DS.primary : isDark ? DS.gray400 : DS.gray500 }, active && { fontWeight: '700' }]}>
              {o.label}
            </Text>
            {!!count && count > 0 && !active && (
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{count > 9 ? '9+' : count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════
   Baby Ribbon — slim profile instead of big gradient card
   ═══════════════════════════════════════════════════════════════════════ */

const BabyRibbon = React.memo<{ baby: any; isDark: boolean }>(({ baby, isDark }) => {
  const ageMo = getBabyAgeMonths(baby?.birthDate);
  const ageDisplay = baby?.birthDate
    ? (() => {
        const y = Math.floor(ageMo / 12);
        const m = ageMo % 12;
        return y > 0 ? `${y}y ${m}m` : `${m}mo`;
      })()
    : '—';

  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <View style={[styles.babyRibbon, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.babyRibbonAvatar, { backgroundColor: `${DS.primary}15` }]}>
          {baby?.avatar ? (
            <Image source={{ uri: baby.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          ) : (
            <Ionicons name="person" size={22} color={DS.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.babyRibbonName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
            {baby?.name || 'Baby'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            <Text style={[styles.babyRibbonMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {ageDisplay} · {baby?.gender || 'Unknown'}
            </Text>
            {baby?.bloodType && (
              <View style={[styles.chipTiny, { backgroundColor: `${DS.danger}15` }]}>
                <Text style={[styles.chipTinyText, { color: DS.danger }]}>🩸 {baby.bloodType}</Text>
              </View>
            )}
            {baby?.allergies?.length > 0 && (
              <View style={[styles.chipTiny, { backgroundColor: `${DS.warning}15` }]}>
                <Text style={[styles.chipTinyText, { color: DS.warning }]}>⚠️ {baby.allergies.length}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════
   Template Field Component (preserved, restyled)
   ═══════════════════════════════════════════════════════════════════════ */

const TemplateFieldComponent = ({
  field,
  value,
  onChange,
  isDark,
  readonly = false,
}: {
  field: TemplateField;
  value: string;
  onChange: (id: string, value: string) => void;
  isDark: boolean;
  readonly?: boolean;
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const renderField = () => {
    if (readonly) {
      return (
        <View style={[styles.templateReadonlyValue, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <Text style={[styles.templateReadonlyText, { color: value ? (isDark ? DS.white : DS.gray900) : DS.gray400 }]}>
            {value || '—'}
          </Text>
        </View>
      );
    }

    const inputBg = isDark ? 'rgba(255,255,255,0.05)' : DS.gray50;
    const borderClr = isFocused ? DS.primary : isDark ? DS.darkBorder : DS.gray200;
    const textClr = isDark ? DS.white : DS.gray900;

    switch (field.type) {
      case 'textarea':
        return (
          <TextInput
            style={[styles.templateTextArea, { color: textClr, backgroundColor: inputBg, borderColor: borderClr }]}
            placeholder={field.placeholder || ''}
            placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
            value={value}
            onChangeText={(text) => onChange(field.id, text)}
            multiline
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textAlignVertical="top"
          />
        );

      case 'select':
        return (
          <View style={[styles.templateSelectContainer, { borderColor: borderClr, backgroundColor: inputBg }]}>
            <TextInput
              style={[styles.templateSelect, { color: textClr }]}
              placeholder={field.placeholder || 'Select option...'}
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={value}
              onChangeText={(text) => onChange(field.id, text)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <Ionicons name="chevron-down" size={18} color={isDark ? DS.gray400 : DS.gray500} style={{ position: 'absolute', right: 12, top: 14 }} />
          </View>
        );

      case 'date':
        return (
          <TouchableOpacity
            style={[styles.templateDateInput, { borderColor: borderClr, backgroundColor: inputBg }]}
            onPress={() => onChange(field.id, new Date().toISOString().split('T')[0])}
            activeOpacity={0.8}
          >
            <Text style={[styles.templateDateText, { color: value ? textClr : isDark ? DS.gray500 : DS.gray400 }]}>
              {value || field.placeholder || 'Select date...'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} />
          </TouchableOpacity>
        );

      case 'signature':
        return (
          <TouchableOpacity
            style={[styles.templateDateInput, { borderColor: borderClr, backgroundColor: inputBg }]}
            onPress={() => {
              Alert.alert('Signature', 'Enter your signature:', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: () => onChange(field.id, `Dr. ${Date.now().toString().slice(-4)}`) },
              ]);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.templateDateText, { color: value ? textClr : isDark ? DS.gray500 : DS.gray400 }]}>
              {value || field.placeholder || 'Tap to sign...'}
            </Text>
            <Ionicons name="create-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} />
          </TouchableOpacity>
        );

      default:
        return (
          <TextInput
            style={[styles.templateInput, { color: textClr, backgroundColor: inputBg, borderColor: borderClr }]}
            placeholder={field.placeholder || ''}
            placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
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
      <View style={{ marginBottom: 6 }}>
        <Text style={[styles.templateFieldLabelText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
          {field.label}
          {field.required && <Text style={{ color: DS.danger }}> *</Text>}
        </Text>
        {field.helpText && (
          <Text style={[styles.templateHelpText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
            {field.helpText}
          </Text>
        )}
      </View>
      {renderField()}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════ */
export const PediatricianPDFExport: React.FC = () => {
  const theme = useReportTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { entries } = useTracker();
  const { parent1, parent2, guardians } = useFamily();
  const { userProfile } = useAuth();
  const sweetAlert = useSweetAlert();
  const isDark = theme.isDark;

  // ─── State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ReportMode>('generate');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [presetId, setPresetId] = useState<PresetId>('full');
  const [customNotes, setCustomNotes] = useState('');
  const [reportHistory, setReportHistory] = useState<DoctorReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DoctorReport | null>(null);
  const [showReportDetail, setShowReportDetail] = useState(false);

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
    { id: 'percentiles', label: 'Clinical Percentiles', emoji: '📊', enabled: true, description: 'WHO percentile analysis' },
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
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    loadReports();
    loadShareableTemplates();
    loadShareResponses();
  }, []);

  const loadReports = async () => {
    try {
      const reportsDir = new Directory(Paths.document, 'DoctorReports');
      if (!reportsDir.exists) { reportsDir.create(); return; }
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
      if (!templatesDir.exists) { templatesDir.create(); return; }
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
      if (!responsesDir.exists) { responsesDir.create(); return; }
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

  const toggleSection = (id: string) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));

  const applyTemplate = (preset: PresetId) => {
    setPresetId(preset);
    const presets: Record<PresetId, string[]> = {
      full: sections.map(s => s.id),
      visit: ['summary', 'babyInfo', 'family', 'growth', 'percentiles', 'vaccines', 'health', 'medications', 'notes'],
      growth: ['babyInfo', 'growth', 'percentiles', 'feeding', 'sleep', 'development', 'forecast'],
      emergency: ['babyInfo', 'family', 'health', 'medications', 'correlations', 'notes'],
      development: ['babyInfo', 'growth', 'percentiles', 'development', 'sleep', 'forecast', 'notes'],
    };
    setSections(prev => prev.map(s => ({ ...s, enabled: presets[preset].includes(s.id) })));
  };

  const filteredEntries = useMemo(() => {
    if (dateRange === 'all') return entries as TrackerEntry[];
    const days = { '7d': 7, '30d': 30, '90d': 90 };
    const cutoff = subDays(new Date(), days[dateRange]).getTime();
    return (entries as TrackerEntry[]).filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }, [entries, dateRange]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEntries = filteredEntries.filter((e) => new Date(e.timestamp) >= today);
    const pending = reportHistory.filter(r => r.status === 'pending').length;
    return {
      total: filteredEntries.length,
      today: todayEntries.length,
      trackers: new Set(filteredEntries.map((e) => e.trackerId)).size,
      reports: reportHistory.length,
      pending,
    };
  }, [filteredEntries, reportHistory]);

  const pulseStats = useMemo(() => ({
    total: filteredEntries.length,
    trackers: new Set(filteredEntries.map((e) => e.trackerId)).size,
    reports: reportHistory.length,
    pending: reportHistory.filter(r => r.status === 'pending').length,
  }), [filteredEntries, reportHistory]);

  const ageMonths = getBabyAgeMonths(currentBaby?.birthDate);

  /* ── Ribbon ── */
  const topRibbon = useMemo(() => {
    if (!currentBaby) {
      return {
        icon: 'information-circle-outline' as const,
        color: DS.info,
        label: 'Baby profile needed',
        text: 'Add a baby profile to start generating reports',
      };
    }
    if (pulseStats.pending > 0) {
      return {
        icon: 'time-outline' as const,
        color: DS.warning,
        label: `${pulseStats.pending} pending`,
        text: `${pulseStats.pending} report${pulseStats.pending === 1 ? '' : 's'} awaiting review — tap to view`,
        onPress: () => setMode('upload'),
      };
    }
    if (shareResponses.filter(r => r.status === 'pending').length > 0) {
      const count = shareResponses.filter(r => r.status === 'pending').length;
      return {
        icon: 'chatbubbles-outline' as const,
        color: DS.success,
        label: `${count} new ${count === 1 ? 'response' : 'responses'}`,
        text: 'Your shared templates received new responses',
        onPress: () => setMode('share'),
      };
    }
    return {
      icon: 'sparkles-outline' as const,
      color: DS.primary,
      label: 'Ready',
      text: `${pulseStats.total} entries · ${pulseStats.trackers} trackers ready to report`,
      onPress: () => setMode('generate'),
    };
  }, [currentBaby, pulseStats, shareResponses]);

  /* ── Template handler ── */
  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    const initialValues: Record<string, string> = {};
    template.sections.forEach(field => { initialValues[field.id] = ''; });
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
      HAPTIC_SUCCESS();
      sweetAlert?.success('Template Generated!', `${selectedTemplate.name} report created successfully.`);
    } catch (err) {
      console.error(err);
      sweetAlert?.alert?.('Failed', 'Could not generate template PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generateTemplateHTML = (template: ReportTemplate, values: Record<string, string>) => {
    const baby = currentBaby;
    const babyName = baby?.name || 'Baby';
    const babyDob = baby?.birthDate ? format(new Date(baby.birthDate), 'MMM d, yyyy') : 'N/A';
    const ageMo = getBabyAgeMonths(baby?.birthDate);
    const ageText = baby?.birthDate
      ? (() => {
          const y = Math.floor(ageMo / 12);
          const m = ageMo % 12;
          return y > 0 ? `${y}y ${m}m` : `${m} months`;
        })()
      : 'N/A';

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

  const generateFullReportHTML = useCallback(() => {
    const baby = currentBaby;
    const babyName = baby?.name || 'Baby';
    const babyDob = baby?.birthDate ? format(new Date(baby.birthDate), 'MMM d, yyyy') : 'N/A';
    const ageMo = getBabyAgeMonths(baby?.birthDate);
    const ageText = baby?.birthDate
      ? (() => {
          const y = Math.floor(ageMo / 12);
          const m = ageMo % 12;
          return y > 0 ? `${y}y ${m}m` : `${m} months`;
        })()
      : 'N/A';
    const gender = genderToLMS(baby?.gender);
    const enabledIds = new Set(sections.filter(s => s.enabled).map(s => s.id));
    const rangeLabel =
      dateRange === '7d' ? 'Last 7 Days'
      : dateRange === '30d' ? 'Last 30 Days'
      : dateRange === '90d' ? 'Last 90 Days' : 'All Time';

    const familyHTML = () => {
      const contacts: string[] = [];
      if (parent1) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent1.fullName || 'Parent 1')}</strong><br/>${escapeHtml(parent1.relationship || 'Parent')}${parent1.phoneNumber ? `<br/>📞 ${escapeHtml(parent1.phoneNumber)}` : ''}${parent1.email ? `<br/>✉️ ${escapeHtml(parent1.email)}` : ''}</div>`);
      if (parent2) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent2.fullName || 'Parent 2')}</strong><br/>${escapeHtml(parent2.relationship || 'Parent')}${parent2.phoneNumber ? `<br/>📞 ${escapeHtml(parent2.phoneNumber)}` : ''}${parent2.email ? `<br/>✉️ ${escapeHtml(parent2.email)}` : ''}</div>`);
      (guardians || []).forEach((g: any) => {
        contacts.push(`<div class="contact-card"><strong>${escapeHtml(g.fullName || 'Guardian')}</strong><br/>${escapeHtml(g.relationship || 'Guardian')}${g.phoneNumber ? `<br/>📞 ${escapeHtml(g.phoneNumber)}` : ''}${g.email ? `<br/>✉️ ${escapeHtml(g.email)}` : ''}</div>`);
      });
      return contacts.length
        ? `<div class="grid-2">${contacts.join('')}</div>`
        : '<p class="muted">No family contacts recorded.</p>';
    };

    const growthPercentileHTML = () => {
      if (!baby?.birthDate) return '<p class="muted">No birth date on file — percentiles cannot be computed.</p>';
      const growthEntries = filteredEntries
        .filter((e) => e.trackerId === 'growth')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (growthEntries.length === 0) return '<p class="muted">No growth measurements in this period.</p>';

      const byType: Record<string, TrackerEntry> = {};
      for (const e of growthEntries) {
        const t = String(e.data?.measurementType ?? '').toLowerCase();
        const normalized = t === 'length' ? 'height' : t === 'hc' || t === 'headcircumference' ? 'head' : t;
        if (['weight', 'height', 'head'].includes(normalized) && !byType[normalized]) byType[normalized] = e;
      }

      const rows: string[] = [];
      (['weight', 'height', 'head'] as const).forEach((metric) => {
        const entry = byType[metric];
        let raw: number | null = null;
        let unit = metric === 'weight' ? 'kg' : 'cm';
        if (entry) {
          const parsed = parseFloat(String(entry.data?.value ?? ''));
          if (Number.isFinite(parsed) && parsed > 0) {
            raw = parsed;
            if (entry.data?.unit) unit = String(entry.data.unit);
          }
        }
        if (raw === null) {
          const legacy = growthEntries.find((e) => {
            const v = parseFloat(String(e.data?.[metric] ?? ''));
            return Number.isFinite(v) && v > 0;
          });
          if (legacy) {
            raw = parseFloat(String(legacy.data[metric]));
            if (legacy.data?.unit) unit = String(legacy.data.unit);
          }
        }
        if (raw === null) return;

        const p = calculatePercentilePrecise(raw, ageMo, metric, gender);
        const status = p < 3 || p > 97 ? '⚠️ Concern' : p < 16 || p > 84 ? '👀 Watch' : '✓ Normal';

        rows.push(
          `<tr>` +
            `<td style="padding:8px;border:1px solid #e2e8f0;"><strong>${metric.toUpperCase()}</strong></td>` +
            `<td style="padding:8px;border:1px solid #e2e8f0;">${raw.toFixed(1)} ${unit}</td>` +
            `<td style="padding:8px;border:1px solid #e2e8f0;">${p}th percentile</td>` +
            `<td style="padding:8px;border:1px solid #e2e8f0;">${status}</td>` +
          `</tr>`
        );
      });

      if (rows.length === 0) return '<p class="muted">No valid measurements to compute percentiles.</p>';

      const latestTs = growthEntries[0]?.timestamp;
      const latestLine = latestTs
        ? `<p style="color:#64748b;font-size:12px;margin-bottom:12px;">Latest measurement: ${format(new Date(latestTs), 'MMM d, yyyy')}</p>`
        : '';

      return `
        ${latestLine}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Metric</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Value</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">WHO Percentile</th>
              <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Status</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      `;
    };

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
      const recentVisits = filteredEntries.filter((e) => ['doctor_visit', 'dental_visit', 'therapy', 'vaccine'].includes(e.trackerId));
      const recentMeds = filteredEntries.filter((e) => e.trackerId === 'medication');
      const recentSymptoms = filteredEntries.filter((e) => ['symptom', 'temperature', 'allergy'].includes(e.trackerId));
      return `<div class="section"><h2>📋 Visit Summary</h2><p style="color:#64748b;font-size:13px;margin-bottom:16px;">Report period: <strong>${rangeLabel}</strong> | Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}</p><div class="grid-2"><div class="card"><strong>Total Entries</strong><br/><span style="font-size:24px;font-weight:800;color:#667eea;">${filteredEntries.length}</span></div><div class="card"><strong>Health Events</strong><br/><span style="font-size:24px;font-weight:800;color:#ef4444;">${recentVisits.length}</span></div><div class="card"><strong>Medications</strong><br/><span style="font-size:24px;font-weight:800;color:#f59e0b;">${recentMeds.length}</span></div><div class="card"><strong>Symptoms</strong><br/><span style="font-size:24px;font-weight:800;color:#8b5cf6;">${recentSymptoms.length}</span></div></div></div>`;
    };

    const notesHTML = customNotes.trim()
      ? `<div class="section"><h2>📝 Notes for Pediatrician</h2><div class="info-box" style="white-space:pre-wrap;">${escapeHtml(customNotes)}</div></div>`
      : '';

    const sectionsHTML = [
      enabledIds.has('summary') ? summaryHTML() : '',
      enabledIds.has('babyInfo') ? `<div class="section"><h2>👶 Child Profile</h2>${babyProfileHTML()}</div>` : '',
      enabledIds.has('family') ? `<div class="section"><h2>👨‍👩‍👧 Family Contacts</h2>${familyHTML()}</div>` : '',
      (enabledIds.has('growth') || enabledIds.has('percentiles')) ? `<div class="section"><h2>📈 Growth & WHO Percentiles</h2>${growthPercentileHTML()}</div>` : '',
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
  }, [currentBaby, filteredEntries, sections, dateRange, customNotes, parent1, parent2, guardians]);

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
        templateType: presetId,
        isDoctorFilled: false,
      };

      await saveReport(report);
      HAPTIC_SUCCESS();
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
  }, [generateFullReportHTML, sections, currentBaby, sweetAlert, presetId]);

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
      HAPTIC_SUCCESS();
      sweetAlert?.success('Uploaded!', 'Doctor-filled report uploaded successfully.');
    } catch (error) {
      setUploading(false);
      sweetAlert?.alert?.('Error', 'Failed to upload report. Please try again.');
    }
  }, [currentBaby, sweetAlert]);

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
    HAPTIC_SUCCESS();
    sweetAlert?.success('Shareable Link Created!', 'Your template is now ready to share.');
  }, [userProfile, sweetAlert]);

  const shareTemplateLink = useCallback(async (template: ReportTemplate) => {
    const link = template.shareableLink || `https://littleloom.app/share/template/${template.id}`;
    setShareLink(link);
    setSelectedTemplateForShare(template);
    setShowShareModal(true);
  }, []);

  const copyLinkToClipboard = useCallback(async (link: string) => {
    try {
      await Clipboard.setString(link);
      sweetAlert?.success('Link Copied!', 'The shareable link has been copied to your clipboard.');
    } catch (error) {
      sweetAlert?.alert?.('Error', 'Could not copy link. Please try again.');
    }
  }, [sweetAlert]);

  const shareViaNative = useCallback(async (link: string, templateName: string) => {
    try {
      const message = `📋 ${templateName} Template\n\nPlease fill out this template at:\n${link}\n\nThis is a secure, shareable form for pediatric records.`;
      await Share.share({ message, title: `Share ${templateName} Template` });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, []);

  const viewResponses = useCallback((templateId: string) => {
    const responses = shareResponses.filter(r => r.templateId === templateId);
    if (responses.length === 0) {
      sweetAlert?.alert('No Responses', 'No one has submitted this template yet.');
      return;
    }

    Alert.alert(
      'Responses',
      `${responses.length} response(s) received:\n\n${responses.map(r =>
        `• ${r.respondentName} (${new Date(r.submittedAt).toLocaleDateString()}) - ${r.status}`
      ).join('\n')}`,
      [{ text: 'OK' }]
    );
  }, [shareResponses, sweetAlert]);

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

  /* ─── RENDER ─── */
  if (!currentBaby) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient
          colors={isDark ? [DS.darkBg, '#12121e'] : ['#f8faff', '#eef0f5']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
          <Ionicons name="document-text-outline" size={56} color={isDark ? DS.gray500 : DS.gray400} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: isDark ? DS.white : DS.gray900, marginTop: 16, letterSpacing: -0.3 }}>
          No Baby Profile
        </Text>
        <Text style={{ fontSize: 13, color: isDark ? DS.gray400 : DS.gray500, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
          Select a baby profile to generate or upload reports.
        </Text>
      </View>
    );
  }

  const bgColors = isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0'];

  const modeCounts = {
    generate: undefined,
    templates: REPORT_TEMPLATES.length,
    share: shareableTemplates.length,
    upload: reportHistory.length,
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors as any} style={StyleSheet.absoluteFill} />

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
            onPress={() => {
              try {
                const { navigation } = require('@react-navigation/native');
                // Use window nav fallback if navigation not provided as prop
              } catch {}
            }}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              REPORTS
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby.name} · {ageMonths}mo
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setMode('upload')}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pulse */}
        <ReportPulse
          isDark={isDark}
          baby={currentBaby}
          ageMonths={ageMonths}
          stats={pulseStats}
          onBabyPress={() => { /* navigate to switch baby */ }}
          onSwitchMode={setMode}
        />

        {/* Baby ribbon (slim profile) */}
        <View style={{ marginTop: DS.space.md }}>
          <BabyRibbon baby={currentBaby} isDark={isDark} />
        </View>

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Mode switcher */}
        <View style={{ marginTop: DS.space.md }}>
          <ModeSwitcher mode={mode} onChange={setMode} isDark={isDark} counts={modeCounts} />
        </View>

        {/* ═══ GENERATE MODE ═══ */}
        {mode === 'generate' && (
          <>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Report Preset" subtitle="Choose a starting template" icon="layers-outline" color={DS.primary} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
                {([
                  { id: 'full' as PresetId, label: 'Full', icon: 'document-text' as const, desc: 'Everything' },
                  { id: 'visit' as PresetId, label: 'Visit', icon: 'medical' as const, desc: 'Essentials' },
                  { id: 'growth' as PresetId, label: 'Growth', icon: 'trending-up' as const, desc: 'Charts' },
                  { id: 'development' as PresetId, label: 'Dev', icon: 'body' as const, desc: 'Milestones' },
                  { id: 'emergency' as PresetId, label: 'ER', icon: 'warning' as const, desc: 'Urgent' },
                ]).map(t => {
                  const active = presetId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => applyTemplate(t.id)}
                      style={[
                        styles.presetPill,
                        {
                          backgroundColor: active ? DS.primary : isDark ? DS.darkCard : DS.white,
                          borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                        },
                      ]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={t.icon} size={16} color={active ? DS.white : DS.primary} />
                      <Text style={[styles.presetPillLabel, { color: active ? DS.white : isDark ? DS.gray200 : DS.gray800 }, active && { fontWeight: '700' }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Date Range" icon="calendar-outline" color={DS.info} />
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: DS.space.lg }}>
                {(['7d', '30d', '90d', 'all'] as const).map(r => {
                  const active = dateRange === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setDateRange(r)}
                      style={[styles.rangePill, {
                        backgroundColor: active ? DS.primary : isDark ? DS.darkCard : DS.white,
                        borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                      }]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.rangePillText, { color: active ? DS.white : isDark ? DS.gray300 : DS.gray700 }, active && { fontWeight: '700' }]}>
                        {r === '7d' ? '7d' : r === '30d' ? '30d' : r === '90d' ? '90d' : 'All'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Sections" subtitle={`${sections.filter(s => s.enabled).length}/${sections.length} enabled`} icon="list-outline" color={DS.accent} />
              <View style={{ paddingHorizontal: DS.space.lg }}>
                <View style={[styles.sectionsCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  {sections.map((sec, idx) => (
                    <View key={sec.id} style={[
                      styles.sectionRow,
                      idx !== sections.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
                      },
                    ]}>
                      <Text style={{ fontSize: 18 }}>{sec.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sectionRowLabel, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                          {sec.label}
                        </Text>
                        <Text style={[styles.sectionRowDesc, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
                          {sec.description}
                        </Text>
                      </View>
                      <Switch
                        value={sec.enabled}
                        onValueChange={() => toggleSection(sec.id)}
                        trackColor={{ false: isDark ? DS.gray700 : DS.gray300, true: `${DS.primary}80` }}
                        thumbColor={sec.enabled ? DS.primary : isDark ? DS.gray500 : DS.white}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Notes for Doctor" icon="create-outline" color={DS.warning} />
              <View style={{ paddingHorizontal: DS.space.lg }}>
                <View style={[styles.notesBox, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <TextInput
                    value={customNotes}
                    onChangeText={setCustomNotes}
                    placeholder="e.g., Fussy after feeds, rash on neck..."
                    placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                    multiline
                    numberOfLines={4}
                    style={[styles.notesInput, { color: isDark ? DS.white : DS.gray900 }]}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              <PressableScale onPress={generateFullReportPDF} disabled={generating} activeScale={0.97}>
                <LinearGradient
                  colors={generating ? [DS.gray400, DS.gray500] : [DS.primary, DS.accent]}
                  style={styles.generateBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  {generating ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="download-outline" size={20} color="#fff" />
                      <Text style={styles.generateBtnText}>Generate PDF Report</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
              <Text style={[styles.disclaimer, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                Reports are generated locally · no data leaves your device
              </Text>
            </View>
          </>
        )}

        {/* ═══ TEMPLATES MODE ═══ */}
        {mode === 'templates' && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Report Templates" subtitle="Fill out and generate professional PDFs" icon="document-text-outline" color="#8b5cf6" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DS.space.lg, gap: 10 }}>
              {REPORT_TEMPLATES.map((t, i) => (
                <Animated.View key={t.id} entering={FadeInUp.delay(i * 40).springify()} style={{ width: (SCREEN_W - 40 - 10) / 2 }}>
                  <PressableScale onPress={() => handleTemplateSelect(t)} activeScale={0.96}>
                    <View style={[styles.templateCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: `${t.color}40` }]}>
                      <LinearGradient
                        colors={[`${t.color}15`, `${t.color}03`]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      />
                      <View style={[styles.templateIcon, { backgroundColor: `${t.color}18` }]}>
                        <Ionicons name={t.icon as any} size={22} color={t.color} />
                      </View>
                      <Text style={[styles.templateName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={2}>
                        {t.name}
                      </Text>
                      <Text style={[styles.templateDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
                        {t.description}
                      </Text>
                      <View style={[styles.templateBadge, { backgroundColor: `${t.color}18` }]}>
                        <Text style={[styles.templateBadgeText, { color: t.color }]}>{t.sections.length} fields</Text>
                      </View>
                    </View>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* ═══ SHARE MODE ═══ */}
        {mode === 'share' && (
          <>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader
                title="Shared Templates"
                subtitle={`${shareableTemplates.length} shared · ${shareResponses.length} responses`}
                icon="share-social-outline"
                color="#f59e0b"
              />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {shareableTemplates.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                      <Ionicons name="share-social-outline" size={32} color={isDark ? DS.gray500 : DS.gray400} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No shared templates</Text>
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      Generate a template and create a shareable link
                    </Text>
                  </View>
                ) : (
                  shareableTemplates.map((t) => (
                    <PressableScale key={t.id} activeScale={0.98}>
                      <View style={[styles.shareRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                        <View style={[styles.shareRowIcon, { backgroundColor: `${t.color}18` }]}>
                          <Ionicons name={t.icon as any} size={20} color={t.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.shareRowName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                            {t.name}
                          </Text>
                          <Text style={[styles.shareRowMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                            {t.sections.length} fields · {t.responseCount || 0} responses
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <TouchableOpacity
                            onPress={() => createShareableTemplate(t)}
                            style={[styles.shareRowBtn, { backgroundColor: `${t.color}15` }]}
                          >
                            <Ionicons name="link-outline" size={14} color={t.color} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => shareTemplateLink(t)}
                            style={[styles.shareRowBtn, { backgroundColor: `${DS.primary}15` }]}
                          >
                            <Ionicons name="share-outline" size={14} color={DS.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => viewResponses(t.id)}
                            style={[styles.shareRowBtn, { backgroundColor: `${DS.success}15` }]}
                          >
                            <Ionicons name="chatbubbles-outline" size={14} color={DS.success} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </PressableScale>
                  ))
                )}
              </View>
            </View>

            {shareResponses.length > 0 && (
              <View style={{ marginTop: DS.space.lg }}>
                <SectionHeader title="Recent Responses" subtitle={`${shareResponses.length} total`} icon="chatbubbles-outline" color={DS.success} />
                <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                  {shareResponses.slice(0, 5).map((r) => {
                    const tpl = shareableTemplates.find(t => t.id === r.templateId);
                    return (
                      <View key={r.id} style={[styles.responseRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.responseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                            {r.respondentName}
                          </Text>
                          <Text style={[styles.responseMeta, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
                            {tpl?.name || 'Unknown'} · {new Date(r.submittedAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, {
                          backgroundColor: r.status === 'approved' ? `${DS.success}15` : r.status === 'reviewed' ? `${DS.info}15` : `${DS.warning}15`,
                        }]}>
                          <Text style={[styles.statusPillText, {
                            color: r.status === 'approved' ? DS.success : r.status === 'reviewed' ? DS.info : DS.warning,
                          }]}>
                            {r.status === 'approved' ? 'Approved' : r.status === 'reviewed' ? 'Reviewed' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* ═══ UPLOAD MODE ═══ */}
        {mode === 'upload' && (
          <>
            <View style={{ marginTop: DS.space.lg }}>
              <PressableScale onPress={uploadDoctorReport} disabled={uploading} activeScale={0.97}>
                <View style={{ paddingHorizontal: DS.space.lg }}>
                  <LinearGradient
                    colors={[DS.success, '#34d399']}
                    style={styles.uploadHero}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.uploadIconCircle}>
                      {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload" size={28} color="#fff" />}
                    </View>
                    <Text style={styles.uploadHeroTitle}>{uploading ? 'Uploading...' : 'Upload Doctor Report'}</Text>
                    <Text style={styles.uploadHeroSub}>Choose a PDF or image from your device</Text>
                  </LinearGradient>
                </View>
              </PressableScale>
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader
                title="All Reports"
                subtitle={`${reportHistory.length} saved`}
                icon="document-text-outline"
                color={DS.primary}
              />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {reportHistory.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                      <Ionicons name="document-text-outline" size={32} color={isDark ? DS.gray500 : DS.gray400} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No reports yet</Text>
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      Generate or upload your first report
                    </Text>
                  </View>
                ) : (
                  reportHistory.map((report, index) => (
                    <Animated.View key={report.id} entering={FadeInUp.delay(index * 50).springify()}>
                      <PressableScale onPress={() => viewReport(report)} activeScale={0.98}>
                        <View style={[styles.reportRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, borderLeftColor: report.isDoctorFilled ? DS.success : DS.primary }]}>
                          <View style={[styles.reportRowIcon, { backgroundColor: report.isDoctorFilled ? `${DS.success}15` : `${DS.primary}15` }]}>
                            <Ionicons
                              name={report.isDoctorFilled ? 'medical-outline' : 'document-text'}
                              size={20}
                              color={report.isDoctorFilled ? DS.success : DS.primary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.reportRowName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                              {report.name}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <View style={[styles.statusDot, {
                                backgroundColor: report.status === 'approved' ? DS.success : report.status === 'reviewed' ? DS.info : DS.warning,
                              }]} />
                              <Text style={[styles.reportRowMeta, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
                                {new Date(report.uploadedAt).toLocaleDateString()} · {report.status}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity onPress={() => viewReport(report)} style={styles.reportRowBtn}>
                              <Ionicons name="eye-outline" size={16} color={DS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => shareReport(report)} style={styles.reportRowBtn}>
                              <Ionicons name="share-outline" size={16} color={DS.accent} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteReport(report)} style={styles.reportRowBtn}>
                              <Ionicons name="trash-outline" size={16} color={DS.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </PressableScale>
                    </Animated.View>
                  ))
                )}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* ═══ Template Form Modal ═══ */}
      <Modal visible={showTemplateForm} transparent animationType="slide" onRequestClose={() => setShowTemplateForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { backgroundColor: isDark ? DS.darkBg : DS.white, maxHeight: '90%' }]}>
            <View style={[styles.modalSheetHeader, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalSheetTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                  {selectedTemplate?.name || 'Template'}
                </Text>
                <Text style={[styles.modalSheetSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                  {selectedTemplate?.description}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTemplateForm(false)} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray800} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: DS.space.lg }} showsVerticalScrollIndicator={false}>
              {selectedTemplate && (
                <>
                  {selectedTemplate.sections.map((field) => (
                    <TemplateFieldComponent
                      key={field.id}
                      field={field}
                      value={templateValues[field.id] || ''}
                      onChange={handleTemplateFieldChange}
                      isDark={isDark}
                    />
                  ))}

                  <PressableScale onPress={handleGenerateTemplatePDF} disabled={generating} activeScale={0.97} style={{ marginTop: 8 }}>
                    <LinearGradient
                      colors={generating ? [DS.gray400, DS.gray500] : [selectedTemplate.color, selectedTemplate.color + 'CC']}
                      style={styles.modalPrimaryBtn}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                      {generating ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Ionicons name="download-outline" size={18} color="#fff" />
                          <Text style={styles.modalPrimaryBtnText}>Generate Template PDF</Text>
                        </>
                      )}
                    </LinearGradient>
                  </PressableScale>

                  <PressableScale
                    onPress={async () => {
                      setShowTemplateForm(false);
                      await createShareableTemplate(selectedTemplate);
                      setMode('share');
                    }}
                    activeScale={0.97}
                    style={{ marginTop: 10 }}
                  >
                    <View style={[styles.modalOutlineBtn, { borderColor: selectedTemplate.color }]}>
                      <Ionicons name="share-social-outline" size={18} color={selectedTemplate.color} />
                      <Text style={[styles.modalOutlineBtnText, { color: selectedTemplate.color }]}>
                        Make Shareable
                      </Text>
                    </View>
                  </PressableScale>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Share Modal ═══ */}
      <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowShareModal(false)} />
          <View style={[styles.shareModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={[styles.modalSheetHeader, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Text style={[styles.modalSheetTitle, { color: isDark ? DS.white : DS.gray900 }]}>Share Template</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray800} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: DS.space.lg }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.shareLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>SHAREABLE LINK</Text>
              <View style={[styles.shareLinkBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Text style={[styles.shareLinkText, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                  {shareLink}
                </Text>
                <TouchableOpacity onPress={() => copyLinkToClipboard(shareLink)} style={{ padding: 4 }}>
                  <Ionicons name="copy-outline" size={20} color={DS.primary} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: DS.space.lg }}>
                <PressableScale
                  onPress={() => { if (selectedTemplateForShare) shareViaNative(shareLink, selectedTemplateForShare.name); }}
                  activeScale={0.96}
                  style={{ flex: 1 }}
                >
                  <LinearGradient colors={[DS.primary, DS.accent]} style={styles.shareModalBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="share-social-outline" size={18} color="#fff" />
                    <Text style={styles.shareModalBtnText}>Share</Text>
                  </LinearGradient>
                </PressableScale>
                <PressableScale
                  onPress={() => sweetAlert?.alert('Share via Email/SMS', 'Use the Share button to send via your preferred app.')}
                  activeScale={0.96}
                  style={{ flex: 1 }}
                >
                  <LinearGradient colors={[DS.success, '#059669']} style={styles.shareModalBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="mail-outline" size={18} color="#fff" />
                    <Text style={styles.shareModalBtnText}>Email/SMS</Text>
                  </LinearGradient>
                </PressableScale>
              </View>

              <View style={[styles.shareInfoBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                <Text style={[styles.shareInfoTitle, { color: isDark ? DS.white : DS.gray900 }]}>How it works</Text>
                {[
                  '1. Share this link with your pediatrician',
                  '2. They fill out the template on their device',
                  '3. You receive the completed report back',
                  '4. Review and save the filled report',
                ].map((line, i) => (
                  <Text key={i} style={[styles.shareInfoLine, { color: isDark ? DS.gray400 : DS.gray500 }]}>{line}</Text>
                ))}
              </View>

              {selectedTemplateForShare && (
                <View style={[styles.shareTemplatePreview, { backgroundColor: `${selectedTemplateForShare.color}10`, borderColor: `${selectedTemplateForShare.color}30` }]}>
                  <Text style={[styles.shareTemplatePreviewName, { color: selectedTemplateForShare.color }]}>
                    📋 {selectedTemplateForShare.name}
                  </Text>
                  <Text style={[styles.shareTemplatePreviewDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
                    {selectedTemplateForShare.description}
                  </Text>
                  <View style={[styles.templateBadge, { backgroundColor: `${selectedTemplateForShare.color}18` }]}>
                    <Text style={[styles.templateBadgeText, { color: selectedTemplateForShare.color }]}>
                      {selectedTemplateForShare.sections.length} fields
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ Report Detail Modal ═══ */}
      <Modal visible={showReportDetail} transparent animationType="slide" onRequestClose={() => setShowReportDetail(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowReportDetail(false)} />
          <View style={[styles.shareModal, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <View style={[styles.modalSheetHeader, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Text style={[styles.modalSheetTitle, { color: isDark ? DS.white : DS.gray900 }]}>Report Details</Text>
              <TouchableOpacity onPress={() => setShowReportDetail(false)} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray800} />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView style={{ padding: DS.space.lg }} showsVerticalScrollIndicator={false}>
                <View style={[styles.reportDetailIcon, {
                  backgroundColor: selectedReport.isDoctorFilled ? `${DS.success}15` : `${DS.primary}15`,
                }]}>
                  <Ionicons
                    name={selectedReport.isDoctorFilled ? 'medical-outline' : 'document-text'}
                    size={40}
                    color={selectedReport.isDoctorFilled ? DS.success : DS.primary}
                  />
                </View>

                <Text style={[styles.reportDetailName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={2}>
                  {selectedReport.name}
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: DS.space.md }}>
                  <View style={[styles.reportMetaBlock, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                    <Text style={[styles.reportMetaLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>UPLOADED</Text>
                    <Text style={[styles.reportMetaValue, { color: isDark ? DS.white : DS.gray900 }]}>
                      {new Date(selectedReport.uploadedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.reportMetaBlock, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                    <Text style={[styles.reportMetaLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>STATUS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <View style={[styles.statusDot, {
                        backgroundColor: selectedReport.status === 'approved' ? DS.success : selectedReport.status === 'reviewed' ? DS.info : DS.warning,
                      }]} />
                      <Text style={[styles.reportMetaValue, {
                        color: selectedReport.status === 'approved' ? DS.success : selectedReport.status === 'reviewed' ? DS.info : DS.warning,
                        textTransform: 'capitalize',
                      }]}>
                        {selectedReport.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedReport.doctorNotes && (
                  <View style={[styles.doctorNotesBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                    <Text style={[styles.reportMetaLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>NOTES</Text>
                    <Text style={[styles.doctorNotesText, { color: isDark ? DS.gray200 : DS.gray700 }]}>
                      {selectedReport.doctorNotes}
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: DS.space.lg }}>
                  <PressableScale
                    onPress={() => shareReport(selectedReport)}
                    activeScale={0.96}
                    style={{ flex: 1 }}
                  >
                    <LinearGradient colors={[DS.primary, DS.accent]} style={styles.reportActionBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Ionicons name="share-outline" size={16} color="#fff" />
                      <Text style={styles.reportActionBtnText}>Share</Text>
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale
                    onPress={() => Linking.openURL(selectedReport.uri)}
                    activeScale={0.96}
                    style={{ flex: 1 }}
                  >
                    <LinearGradient colors={[DS.success, '#059669']} style={styles.reportActionBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Ionicons name="eye-outline" size={16} color="#fff" />
                      <Text style={styles.reportActionBtnText}>Open</Text>
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale
                    onPress={() => { deleteReport(selectedReport); setShowReportDetail(false); }}
                    activeScale={0.96}
                    style={{ flex: 1 }}
                  >
                    <LinearGradient colors={[DS.danger, '#dc2626']} style={styles.reportActionBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={styles.reportActionBtnText}>Delete</Text>
                    </LinearGradient>
                  </PressableScale>
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

  /* Baby ribbon */
  babyRibbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    marginHorizontal: DS.space.lg, padding: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  babyRibbonAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  babyRibbonName: { fontSize: 15, fontWeight: '800' },
  babyRibbonMeta: { fontSize: 11, fontWeight: '500' },
  chipTiny: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  chipTinyText: { fontSize: 9, fontWeight: '700' },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Mode switcher */
  modeBar: {
    flexDirection: 'row', marginHorizontal: DS.space.lg,
    padding: 4, borderRadius: DS.radius.full, gap: 2,
  },
  modeItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 9, borderRadius: DS.radius.full, position: 'relative',
  },
  modeLabel: { fontSize: 10, fontWeight: '600' },
  modeBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7,
    backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2,
  },
  modeBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800' },

  /* Preset pills */
  presetPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: DS.radius.full, borderWidth: 1,
  },
  presetPillLabel: { fontSize: 12, fontWeight: '600' },

  /* Range pills */
  rangePill: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: DS.radius.md, borderWidth: 1,
  },
  rangePillText: { fontSize: 12, fontWeight: '600' },

  /* Sections card */
  sectionsCard: {
    borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingHorizontal: DS.space.md, paddingVertical: DS.space.md,
  },
  sectionRowLabel: { fontSize: 13, fontWeight: '700' },
  sectionRowDesc: { fontSize: 10, fontWeight: '500', marginTop: 1 },

  /* Notes */
  notesBox: { borderRadius: DS.radius.lg, borderWidth: 1, padding: DS.space.md },
  notesInput: { fontSize: 13, lineHeight: 19, minHeight: 80, fontWeight: '500' },

  /* Generate */
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: DS.radius.lg,
    ...DS.shadow.md,
  },
  generateBtnText: { color: DS.white, fontSize: 15, fontWeight: '800' },
  disclaimer: { textAlign: 'center', fontSize: 11, fontWeight: '500', marginTop: 10, paddingHorizontal: DS.space.md },

  /* Template cards */
  templateCard: {
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1.5,
    overflow: 'hidden', minHeight: 160,
  },
  templateIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.sm },
  templateName: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  templateDesc: { fontSize: 10, fontWeight: '500', lineHeight: 14, flex: 1 },
  templateBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: DS.space.sm },
  templateBadgeText: { fontSize: 9, fontWeight: '700' },

  /* Share row */
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  shareRowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  shareRowName: { fontSize: 13, fontWeight: '700' },
  shareRowMeta: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  shareRowBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* Response row */
  responseRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  responseName: { fontSize: 13, fontWeight: '700' },
  responseMeta: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  /* Upload hero */
  uploadHero: {
    padding: DS.space.lg, borderRadius: DS.radius.xl,
    alignItems: 'center', gap: DS.space.sm, ...DS.shadow.md,
  },
  uploadIconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  uploadHeroTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  uploadHeroSub: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },

  /* Report row */
  reportRow: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, borderLeftWidth: 3,
  },
  reportRowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  reportRowName: { fontSize: 13, fontWeight: '700' },
  reportRowMeta: { fontSize: 10, fontWeight: '500' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  reportRowBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  /* Empty */
  emptyState: {
    alignItems: 'center', paddingVertical: DS.space['3xl'], paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg, borderWidth: 1,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  /* Modal */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalSheet: {
    width: '100%', maxWidth: 440,
    borderTopLeftRadius: DS.radius['2xl'], borderTopRightRadius: DS.radius['2xl'],
    ...DS.shadow.lg,
  },
  modalSheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: DS.space.lg, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalSheetTitle: { fontSize: 17, fontWeight: '800' },
  modalSheetSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  /* Template field */
  templateFieldContainer: { marginBottom: DS.space.md },
  templateFieldLabelText: { fontSize: 12, fontWeight: '700' },
  templateHelpText: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  templateInput: { height: 46, borderRadius: DS.radius.md, paddingHorizontal: 14, fontSize: 14, borderWidth: 1 },
  templateTextArea: { height: 100, borderRadius: DS.radius.md, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, borderWidth: 1, textAlignVertical: 'top' },
  templateSelectContainer: { height: 46, borderRadius: DS.radius.md, paddingHorizontal: 14, borderWidth: 1, justifyContent: 'center' },
  templateSelect: { fontSize: 14, paddingVertical: 12 },
  templateDateInput: { height: 46, borderRadius: DS.radius.md, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateDateText: { fontSize: 14 },
  templateReadonlyValue: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: DS.radius.md, borderWidth: 1 },
  templateReadonlyText: { fontSize: 14 },

  /* Modal buttons */
  modalPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: DS.radius.md, ...DS.shadow.md,
  },
  modalPrimaryBtnText: { color: DS.white, fontSize: 14, fontWeight: '800' },
  modalOutlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: DS.radius.md, borderWidth: 1.5,
  },
  modalOutlineBtnText: { fontSize: 13, fontWeight: '700' },

  /* Share modal */
  shareModal: {
    width: '100%', maxWidth: 440, borderRadius: DS.radius['2xl'], overflow: 'hidden',
    ...DS.shadow.lg,
  },
  shareLabel: {
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 8,
  },
  shareLinkBox: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: DS.radius.md, borderWidth: 1,
  },
  shareLinkText: { flex: 1, fontSize: 12, fontWeight: '500', marginRight: 8 },
  shareModalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: DS.radius.md,
  },
  shareModalBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },
  shareInfoBox: { padding: DS.space.md, borderRadius: DS.radius.md, marginTop: DS.space.md },
  shareInfoTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  shareInfoLine: { fontSize: 12, fontWeight: '500', lineHeight: 20 },
  shareTemplatePreview: {
    padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1,
    marginTop: DS.space.md,
  },
  shareTemplatePreviewName: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  shareTemplatePreviewDesc: { fontSize: 11, fontWeight: '500', marginBottom: 8 },

  /* Report detail */
  reportDetailIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: DS.space.md },
  reportDetailName: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: DS.space.sm },
  reportMetaBlock: { flex: 1, padding: DS.space.md, borderRadius: DS.radius.md },
  reportMetaLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  reportMetaValue: { fontSize: 13, fontWeight: '700' },
  doctorNotesBox: { padding: DS.space.md, borderRadius: DS.radius.md, marginTop: DS.space.md },
  doctorNotesText: { fontSize: 12, fontWeight: '500', lineHeight: 18, marginTop: 4 },
  reportActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12, borderRadius: DS.radius.md,
  },
  reportActionBtnText: { color: DS.white, fontSize: 12, fontWeight: '700' },
});

export default PediatricianPDFExport;