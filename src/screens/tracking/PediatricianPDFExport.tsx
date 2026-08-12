import React, { useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useCustomization } from '@/hooks/useCustomization';
import { useSweetAlert } from '@/hooks/useSweetAlert';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/context/TrackerContext';
import { useBaby } from '@/context/BabyContext';
import { useFamily } from '@/context/FamilyContext';
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
import { format, differenceInMonths, differenceInYears, differenceInDays, subDays, isAfter, parseISO } from 'date-fns';

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

type ReportTemplate = 'visit' | 'full' | 'growth' | 'emergency' | 'development';

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
  const lower = arr.findLast((a: any) => a.m <= ageMonths) || arr[0];
  const upper = arr.find((a: any) => a.m >= ageMonths) || arr[arr.length - 1];
  if (lower.m === upper.m) return lower;
  const ratio = (ageMonths - lower.m) / (upper.m - lower.m);
  return { med: lower.med + (upper.med - lower.med) * ratio, sd: lower.sd + (upper.sd - lower.sd) * ratio };
};

const zToPercentile = (z: number): number => {
  // Simplified error-function approximation for standard normal CDF
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
   BABY PROFILE HEADER — With Avatar
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
   INTELLIGENCE FEATURE 1 — Clinical Growth Percentiles
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

/* ═══════════════════════════════════════════════════════════════════════
   INTELLIGENCE FEATURE 2 — Vaccination Compliance Tracker
   ═══════════════════════════════════════════════════════════════════════ */
const VaccinationComplianceCard = ({ entries, baby }: { entries: TrackerEntry[]; baby: any }) => {
  const theme = useReportTheme();
  const ageMo = getBabyAgeMonths(baby?.birthDate);

  const vaxStatus = useMemo(() => {
    const vaxEntries = entries.filter(e => ['vaccine', 'immunization'].includes(e.trackerId));
    const loggedNames = vaxEntries.map(e => (e.data?.vaccineName || e.data?.name || e.trackerName || '').toLowerCase());

    return VACCINE_SCHEDULE.map(v => {
      const status = v.doses.map(d => {
        const isDue = ageMo >= d.ageMo;
        const windowEnd = d.ageMo + (v.code === 'mmr' || v.code === 'var' ? 6 : 3);
        const isOverdue = ageMo > windowEnd;
        const isLogged = loggedNames.some(ln => ln.includes(v.code) || ln.includes(v.name.toLowerCase().split(' ')[0]));
        return { ...d, isDue, isOverdue, isLogged, status: isLogged ? 'done' : isOverdue ? 'overdue' : isDue ? 'due' : 'upcoming' };
      });
      const done = status.filter(s => s.status === 'done').length;
      const total = status.length;
      return { ...v, doses: status, progress: done, total, pct: Math.round((done / total) * 100) };
    });
  }, [entries, ageMo]);

  const totalDone = vaxStatus.reduce((a, v) => a + v.progress, 0);
  const totalDue = vaxStatus.reduce((a, v) => a + v.doses.filter((d: any) => d.isDue).length, 0);

  return (
    <Animated.View entering={FadeInUp.delay(120).springify()}>
      <SectionHeader title="Vaccination Compliance" icon="shield-checkmark-outline" subtitle={`${totalDone} of ${totalDue} due doses logged`} />
      <GlassCard>
        <View style={styles.vaxList}>
          {vaxStatus.slice(0, 6).map((v: any) => (
            <View key={v.code} style={[styles.vaxRow, { borderBottomColor: theme.border }]}>
              <View style={styles.vaxLeft}>
                <Text style={[styles.vaxName, { color: theme.text.primary }]}>{v.name}</Text>
                <View style={styles.vaxDots}>
                  {v.doses.map((d: any, i: number) => (
                    <View key={i} style={[styles.vaxDot, { backgroundColor: d.status === 'done' ? '#10b981' : d.status === 'overdue' ? '#ef4444' : d.status === 'due' ? '#f59e0b' : `${theme.text.muted}30` }]} />
                  ))}
                </View>
              </View>
              <Badge text={`${v.progress}/${v.total}`} color={v.pct === 100 ? '#10b981' : v.pct >= 50 ? '#f59e0b' : '#ef4444'} bg={`${v.pct === 100 ? '#10b981' : v.pct >= 50 ? '#f59e0b' : '#ef4444'}12`} />
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   INTELLIGENCE FEATURE 3 — Developmental Red Flag Scanner
   ═══════════════════════════════════════════════════════════════════════ */
const DevelopmentalRedFlagsCard = ({ entries, baby }: { entries: TrackerEntry[]; baby: any }) => {
  const theme = useReportTheme();
  const ageMo = getBabyAgeMonths(baby?.birthDate);

  const analysis = useMemo(() => {
    const milestoneEntries = entries.filter(e => e.trackerId === 'milestone');
    const achieved = new Set(milestoneEntries.map(e => (e.data?.category || 'physical').toLowerCase()));
    const relevant = MILESTONE_EXPECTATIONS.filter(m => m.maxMo <= ageMo + 2 && m.maxMo >= ageMo - 4);
    const flags = relevant.filter(m => m.critical && !achieved.has(m.category)).map(m => ({ ...m, severity: m.maxMo < ageMo ? 'red' : 'yellow' }));
    const met = relevant.filter(m => achieved.has(m.category));
    return { flags, met, total: relevant.length };
  }, [entries, ageMo]);

  if (!analysis.total) return null;

  return (
    <Animated.View entering={FadeInUp.delay(160).springify()}>
      <SectionHeader title="Developmental Check" icon="brain-outline" subtitle={`${analysis.met.length}/${analysis.total} milestones on track`} />
      <GlassCard>
        {analysis.flags.length > 0 && (
          <View style={[styles.redFlagBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={[styles.redFlagText, { color: '#991b1b' }]}>{analysis.flags.length} potential delay{analysis.flags.length !== 1 ? 's' : ''} flagged for {ageMo}mo</Text>
          </View>
        )}
        <View style={styles.devGrid}>
          {analysis.flags.map((f: any, i: number) => (
            <View key={i} style={[styles.devCard, { borderLeftColor: f.severity === 'red' ? '#ef4444' : '#f59e0b', borderLeftWidth: 3 }]}>
              <Text style={[styles.devCategory, { color: f.severity === 'red' ? '#ef4444' : '#f59e0b' }]}>{f.category.toUpperCase()}</Text>
              <Text style={[styles.devItems, { color: theme.text.secondary }]}>{f.items.join(' • ')}</Text>
              <Text style={[styles.devExpected, { color: theme.text.muted }]}>Expected by {f.maxMo}mo</Text>
            </View>
          ))}
          {analysis.met.map((f: any, i: number) => (
            <View key={`met-${i}`} style={[styles.devCard, { borderLeftColor: '#10b981', borderLeftWidth: 3, opacity: 0.7 }]}>
              <Text style={[styles.devCategory, { color: '#10b981' }]}>{f.category.toUpperCase()} ✅</Text>
              <Text style={[styles.devItems, { color: theme.text.muted }]}>{f.items.join(' • ')}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   INTELLIGENCE FEATURE 4 — Medical Event Correlator
   ═══════════════════════════════════════════════════════════════════════ */
const MedicalCorrelatorCard = ({ entries }: { entries: TrackerEntry[] }) => {
  const theme = useReportTheme();
  const insights = useMemo(() => {
    const result: any[] = [];
    const meds = entries.filter(e => e.trackerId === 'medication').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const symptoms = entries.filter(e => ['symptom', 'temperature', 'allergy', 'skin_condition'].includes(e.trackerId)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const feeds = entries.filter(e => e.trackerId === 'feed').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Med -> Symptom correlation (symptom within 72h of med start)
    meds.slice(0, 5).forEach(med => {
      const medTime = new Date(med.timestamp).getTime();
      const related = symptoms.find(s => {
        const st = new Date(s.timestamp).getTime();
        return st > medTime && st < medTime + 72 * 3600000;
      });
      if (related) {
        result.push({
          type: 'alert',
          icon: '⚠️',
          title: `Reaction Pattern`,
          desc: `${related.data?.symptomType || 'Symptom'} logged ${Math.round((new Date(related.timestamp).getTime() - medTime) / 3600000)}h after ${med.data?.medicationName || 'medication'}`,
          color: '#f59e0b',
        });
      }
    });

    // Fever + Vaccine correlation
    const fevers = entries.filter(e => e.trackerId === 'temperature' && parseFloat(e.data?.value) > 38);
    const vax = entries.filter(e => ['vaccine', 'immunization'].includes(e.trackerId));
    fevers.slice(0, 3).forEach(f => {
      const fTime = new Date(f.timestamp).getTime();
      const nearVax = vax.find(v => {
        const vt = new Date(v.timestamp).getTime();
        return Math.abs(fTime - vt) < 48 * 3600000;
      });
      if (nearVax) {
        result.push({
          type: 'info',
          icon: '🌡️',
          title: 'Post-Vaccination Fever',
          desc: `Fever ${f.data?.value}° logged within 48h of vaccination`,
          color: '#3b82f6',
        });
      }
    });

    // Feed gap -> Sleep quality
    const sleeps = entries.filter(e => e.trackerId === 'sleep' && e.duration).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (feeds.length >= 2 && sleeps.length >= 1) {
      const lastFeed = new Date(feeds[0].timestamp).getTime();
      const lastSleep = sleeps[0];
      const feedGap = (lastFeed - new Date(feeds[1].timestamp).getTime()) / 3600000;
      if (feedGap > 4 && lastSleep.duration && lastSleep.duration < 60) {
        result.push({
          type: 'tip',
          icon: '💡',
          title: 'Feed-Sleep Correlation',
          desc: `Long feed gap (${Math.round(feedGap)}h) followed by short sleep (${lastSleep.duration}m)`,
          color: '#8b5cf6',
        });
      }
    }

    return result.slice(0, 4);
  }, [entries]);

  if (!insights.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Medical Correlations" icon="git-compare-outline" subtitle="Pattern detection across trackers" />
      <View style={styles.corrList}>
        {insights.map((ins: any, i: number) => (
          <GlassCard key={i} style={[styles.corrCard, { borderLeftColor: ins.color, borderLeftWidth: 3 }]}>
            <Text style={styles.corrEmoji}>{ins.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.corrTitle, { color: theme.text.primary }]}>{ins.title}</Text>
              <Text style={[styles.corrDesc, { color: theme.text.secondary }]}>{ins.desc}</Text>
            </View>
          </GlassCard>
        ))}
      </View>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   INTELLIGENCE FEATURE 5 — Sleep Debt & Circadian Analyzer
   ═══════════════════════════════════════════════════════════════════════ */
const SleepDebtCard = ({ entries, baby }: { entries: TrackerEntry[]; baby: any }) => {
  const theme = useReportTheme();
  const ageMo = getBabyAgeMonths(baby?.birthDate);
  const recSleep = ageMo < 4 ? 15 : ageMo < 12 ? 14 : ageMo < 24 ? 13 : 12; // hours per 24h

  const analysis = useMemo(() => {
    const sleeps = entries.filter(e => e.trackerId === 'sleep' && e.duration).slice(0, 14);
    if (!sleeps.length) return null;
    const totalMins = sleeps.reduce((s, e) => s + (e.duration || 0), 0);
    const avgHrs = totalMins / sleeps.length / 60;
    const debt = Math.max(0, recSleep - avgHrs * (sleeps.length >= 7 ? 1 : 24 / sleeps.length)); // rough
    const bedtimes = sleeps.map(e => new Date(e.timestamp).getHours()).filter(h => h > 17 || h < 4);
    const avgBed = bedtimes.length ? bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length : 0;
    const consistency = bedtimes.length > 2 ? Math.sqrt(bedtimes.map(h => Math.pow(h - avgBed, 2)).reduce((a, b) => a + b, 0) / bedtimes.length) : 0;
    const score = Math.min(100, Math.round((avgHrs / recSleep) * 60 + (1 - Math.min(consistency, 3) / 3) * 40));
    return { avgHrs: Math.round(avgHrs * 10) / 10, debt: Math.round(debt * 10) / 10, consistency: Math.round(consistency * 10) / 10, score, naps: sleeps.filter(e => new Date(e.timestamp).getHours() >= 6 && new Date(e.timestamp).getHours() < 18).length };
  }, [entries, recSleep]);

  if (!analysis) return null;
  const scoreColor = analysis.score >= 80 ? '#10b981' : analysis.score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <Animated.View entering={FadeInUp.delay(240).springify()}>
      <SectionHeader title="Sleep Debt Analysis" icon="moon-outline" subtitle={`Recommended: ~${recSleep}h / 24h`} />
      <GlassCard>
        <View style={styles.sleepTop}>
          <View style={styles.sleepScoreCircle}>
            <Text style={[styles.sleepScoreNum, { color: scoreColor }]}>{analysis.score}</Text>
            <Text style={[styles.sleepScoreLabel, { color: theme.text.muted }]}>Sleep Score</Text>
          </View>
          <View style={styles.sleepMetricsCol}>
            <View style={styles.sleepMetricRow}>
              <Ionicons name="time-outline" size={16} color={theme.text.secondary} />
              <Text style={[styles.sleepMetricText, { color: theme.text.primary }]}>Avg {analysis.avgHrs}h per session</Text>
            </View>
            <View style={styles.sleepMetricRow}>
              <Ionicons name="alert-circle-outline" size={16} color={analysis.debt > 2 ? '#ef4444' : theme.text.secondary} />
              <Text style={[styles.sleepMetricText, { color: analysis.debt > 2 ? '#ef4444' : theme.text.primary }]}>{analysis.debt > 0 ? `${analysis.debt}h estimated debt` : 'No sleep debt'}</Text>
            </View>
            <View style={styles.sleepMetricRow}>
              <Ionicons name="repeat-outline" size={16} color={theme.text.secondary} />
              <Text style={[styles.sleepMetricText, { color: theme.text.primary }]}>Bedtime variance: ±{analysis.consistency}h</Text>
            </View>
          </View>
        </View>
        <View style={[styles.sleepBarBg, { backgroundColor: `${scoreColor}10` }]}>
          <View style={[styles.sleepBarFill, { width: `${analysis.score}%`, backgroundColor: scoreColor }]} />
        </View>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   INTELLIGENCE FEATURE 6 — Predictive Growth & Event Forecast
   ═══════════════════════════════════════════════════════════════════════ */
const PredictiveForecastCard = ({ entries, baby }: { entries: TrackerEntry[]; baby: any }) => {
  const theme = useReportTheme();
  const ageMo = getBabyAgeMonths(baby?.birthDate);

  const forecast = useMemo(() => {
    const growth = entries.filter(e => e.trackerId === 'growth').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const result: any[] = [];

    if (growth.length >= 2) {
      const w = growth.map(e => ({ t: new Date(e.timestamp).getTime(), v: parseFloat(e.data?.weight) || 0 })).filter(p => p.v > 0);
      if (w.length >= 2) {
        const dt = (w[w.length - 1].t - w[0].t) / (1000 * 60 * 60 * 24 * 7); // weeks
        const dv = w[w.length - 1].v - w[0].v;
        const velocity = dt > 0 ? dv / dt : 0;
        const nextW = w[w.length - 1].v + velocity * 2;
        result.push({ type: 'growth', label: 'Weight Forecast', value: `${nextW.toFixed(2)} kg`, sub: `${velocity > 0 ? '+' : ''}${velocity.toFixed(1)} kg/week`, icon: 'trending-up-outline', color: '#667eea' });
      }
    }

    // Next feed prediction
    const feeds = entries.filter(e => e.trackerId === 'feed').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (feeds.length >= 2) {
      const gap = (new Date(feeds[0].timestamp).getTime() - new Date(feeds[1].timestamp).getTime()) / 3600000;
      const next = new Date(new Date(feeds[0].timestamp).getTime() + gap * 3600000);
      if (isAfter(next, new Date())) {
        result.push({ type: 'feed', label: 'Next Feed', value: format(next, 'h:mm a'), sub: `~${Math.round(gap)}h interval`, icon: 'restaurant-outline', color: '#fa709a' });
      }
    }

    // Next sleep prediction
    const sleeps = entries.filter(e => e.trackerId === 'sleep').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (sleeps.length >= 2) {
      const gap = (new Date(sleeps[0].timestamp).getTime() - new Date(sleeps[1].timestamp).getTime()) / 3600000;
      const next = new Date(new Date(sleeps[0].timestamp).getTime() + gap * 3600000);
      if (isAfter(next, new Date())) {
        result.push({ type: 'sleep', label: 'Next Sleep', value: format(next, 'h:mm a'), sub: `~${Math.round(gap)}h interval`, icon: 'moon-outline', color: '#11998e' });
      }
    }

    // Milestone window
    const nextMilestone = MILESTONE_EXPECTATIONS.find(m => m.maxMo > ageMo && m.maxMo <= ageMo + 3);
    if (nextMilestone) {
      result.push({ type: 'milestone', label: 'Upcoming Milestone', value: `${nextMilestone.maxMo}mo window`, sub: nextMilestone.items[0], icon: 'trophy-outline', color: '#ffd700' });
    }

    return result;
  }, [entries, ageMo]);

  if (!forecast.length) return null;

  return (
    <Animated.View entering={FadeInUp.delay(280).springify()}>
      <SectionHeader title="Predictive Forecasts" icon="time-outline" subtitle="AI-powered projections from patterns" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.forecastScroll}>
        {forecast.map((f: any, i: number) => (
          <GlassCard key={i} style={styles.forecastCard}>
            <View style={[styles.forecastIconWrap, { backgroundColor: `${f.color}12` }]}>
              <Ionicons name={f.icon} size={22} color={f.color} />
            </View>
            <Text style={[styles.forecastLabel, { color: theme.text.muted }]}>{f.label}</Text>
            <Text style={[styles.forecastValue, { color: f.color }]}>{f.value}</Text>
            <Text style={[styles.forecastSub, { color: theme.text.secondary }]}>{f.sub}</Text>
          </GlassCard>
        ))}
      </ScrollView>
    </Animated.View>
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
  const sweetAlert = useSweetAlert();

  const [generating, setGenerating] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [template, setTemplate] = useState<ReportTemplate>('full');
  const [customNotes, setCustomNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [reportHistory, setReportHistory] = useState<{ path: string; date: string; name: string }[]>([]);

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

  const toggleSection = (id: string) => setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));

  const applyTemplate = (t: ReportTemplate) => {
    setTemplate(t);
    const presets: Record<ReportTemplate, string[]> = {
      full: sections.map(s => s.id),
      visit: ['summary', 'babyInfo', 'family', 'growth', 'percentiles', 'vaccines', 'health', 'medications', 'notes'],
      growth: ['babyInfo', 'growth', 'percentiles', 'feeding', 'sleep', 'development', 'forecast'],
      emergency: ['babyInfo', 'family', 'health', 'medications', 'correlations', 'notes'],
      development: ['babyInfo', 'growth', 'percentiles', 'development', 'milestones', 'sleep', 'forecast', 'notes'],
    };
    setSections(prev => prev.map(s => ({ ...s, enabled: presets[t].includes(s.id) })));
  };

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

  /* ═════════════════════════════════════════════════════════════════════
     PDF HTML GENERATOR — Enhanced with all 6 intelligence features
     ═════════════════════════════════════════════════════════════════════ */
  const generateHTML = useCallback(() => {
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

    const familyHTML = () => {
      const contacts: string[] = [];
      if (parent1) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent1.fullName || 'Parent 1')}</strong><br/>${escapeHtml(parent1.relationship || 'Parent')}${parent1.phoneNumber ? `<br/>📞 ${escapeHtml(parent1.phoneNumber)}` : ''}${parent1.email ? `<br/>✉️ ${escapeHtml(parent1.email)}` : ''}</div>`);
      if (parent2) contacts.push(`<div class="contact-card"><strong>${escapeHtml(parent2.fullName || 'Parent 2')}</strong><br/>${escapeHtml(parent2.relationship || 'Parent')}${parent2.phoneNumber ? `<br/>📞 ${escapeHtml(parent2.phoneNumber)}` : ''}${parent2.email ? `<br/>✉️ ${escapeHtml(parent2.email)}` : ''}</div>`);
      guardians?.forEach((g: any) => contacts.push(`<div class="contact-card"><strong>${escapeHtml(g.fullName || 'Guardian')}</strong><br/>${escapeHtml(g.relationship || 'Guardian')}${g.phoneNumber ? `<br/>📞 ${escapeHtml(g.phoneNumber)}` : ''}${g.email ? `<br/>✉️ ${escapeHtml(g.email)}` : ''}</div>`));
      return contacts.length ? `<div class="grid-2">${contacts.join('')}</div>` : '<p class="muted">No family contacts recorded.</p>';
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

    const growthChartHTML = () => {
      const growthEntries = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'growth').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (growthEntries.length < 2) return '<p class="muted">Not enough growth data for chart.</p>';
      const W = 700, H = 260, pad = 50;
      const makeSeries = (key: string, color: string) => {
        const pts = growthEntries.map((e: TrackerEntry) => ({ t: new Date(e.timestamp).getTime(), v: parseFloat(e.data?.[key]) || 0 })).filter(p => p.v > 0);
        if (pts.length < 2) return '';
        const max = Math.max(...pts.map(p => p.v), 1); const min = Math.min(...pts.map(p => p.v), 0);
        const points = pts.map((p, i) => { const x = pad + (i / (pts.length - 1)) * (W - pad * 2); const y = H - pad - ((p.v - min) / (max - min || 1)) * (H - pad * 2); return `${x},${y}`; }).join(' ');
        return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/><text x="${W - pad}" y="${pad + (['weight','height','head'].indexOf(key) * 16)}" text-anchor="end" font-size="11" fill="${color}" font-weight="700">${key.charAt(0).toUpperCase() + key.slice(1)}</text>`;
      };
      return `<div class="chart-wrap"><svg width="${W}" height="${H}" style="background:#f8fafc;border-radius:12px;"><text x="${W / 2}" y="22" text-anchor="middle" font-size="15" font-weight="bold" fill="#1e293b">Growth Trends</text>${makeSeries('weight', '#667eea')}${makeSeries('height', '#10b981')}${makeSeries('head', '#f59e0b')}<line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="#e2e8f0" stroke-width="1"/><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H - pad}" stroke="#e2e8f0" stroke-width="1"/></svg></div><div class="grid-3" style="margin-top:10px;">${['weight', 'height', 'head'].map(k => { const last = [...growthEntries].reverse().find((e: TrackerEntry) => e.data?.[k]); return `<div class="card" style="text-align:center;"><strong style="color:#64748b;font-size:11px;text-transform:uppercase;">${k}</strong><br/><span style="font-size:20px;font-weight:800;color:#1e293b;">${last ? `${last.data[k]} ${last.data.unit || (k === 'weight' ? 'kg' : 'cm')}` : '--'}</span></div>`; }).join('')}</div>`;
    };

    const percentileHTML = () => {
      if (!ageMo) return '';
      const growth = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'growth').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (!growth.length) return '';
      const latest = growth[0];
      const rows = ['weight', 'height', 'head'].map(type => {
        const val = parseFloat(latest.data?.[type]);
        if (!val) return '';
        const ref = getGrowthRef(gender, type as any, ageMo);
        const z = (val - ref.med) / ref.sd;
        const p = Math.max(1, Math.min(99, zToPercentile(z)));
        const status = z < -2 ? 'Below 2nd %ile — Consult pediatrician' : z < -1 ? '10th-25th %ile — Monitor' : z > 2 ? 'Above 98th %ile — Monitor' : '25th-75th %ile — Normal';
        const color = z < -2 || z > 2 ? '#ef4444' : z < -1 ? '#f59e0b' : '#10b981';
        return `<tr><td><strong>${type.toUpperCase()}</strong></td><td>${val} ${latest.data?.unit || (type === 'weight' ? 'kg' : 'cm')}</td><td style="color:${color};font-weight:700;">${p}th percentile</td><td>${status}</td></tr>`;
      }).filter(Boolean).join('');
      return rows ? `<div class="section"><h2>📊 Clinical Growth Percentiles</h2><p style="color:#64748b;font-size:12px;margin-bottom:10px;">Based on WHO/CDC reference data for ${gender} at ${ageMo} months.</p><table><thead><tr><th>Measurement</th><th>Value</th><th>Percentile</th><th>Clinical Note</th></tr></thead><tbody>${rows}</tbody></table></div>` : '';
    };

    const vaccineHTML = () => {
      const vaxEntries = filteredEntries.filter((e: TrackerEntry) => ['vaccine', 'immunization'].includes(e.trackerId));
      const logged = vaxEntries.map(e => (e.data?.vaccineName || e.data?.name || e.trackerName || '').toLowerCase());
      const rows = VACCINE_SCHEDULE.flatMap(v => v.doses.map((d, i) => {
        const isDue = ageMo >= d.ageMo;
        if (!isDue) return '';
        const isLogged = logged.some(ln => ln.includes(v.code) || ln.includes(v.name.toLowerCase().split(' ')[0]));
        const status = isLogged ? '✅ Completed' : ageMo > d.ageMo + 3 ? '❌ Overdue' : '⏳ Due Now';
        const color = isLogged ? '#10b981' : ageMo > d.ageMo + 3 ? '#ef4444' : '#f59e0b';
        return `<tr><td>${v.name} (Dose ${i + 1})</td><td>${d.label}</td><td style="color:${color};font-weight:700;">${status}</td></tr>`;
      })).filter(Boolean).join('');
      return rows ? `<div class="section"><h2>💉 Vaccination Compliance</h2><table><thead><tr><th>Vaccine</th><th>Due Age</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : '';
    };

    const developmentHTML = () => {
      const achieved = new Set(filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'milestone').map(e => (e.data?.category || 'physical').toLowerCase()));
      const relevant = MILESTONE_EXPECTATIONS.filter(m => m.maxMo <= ageMo + 2 && m.maxMo >= ageMo - 4);
      const flags = relevant.filter(m => m.critical && !achieved.has(m.category));
      if (!flags.length) return '<div class="section"><h2>🧠 Developmental Check</h2><div class="success-box">All critical milestones on track for current age.</div></div>';
      const rows = flags.map(f => `<tr><td><strong>${f.category.toUpperCase()}</strong></td><td>${f.items.join(', ')}</td><td>By ${f.maxMo} months</td><td style="color:#ef4444;font-weight:700;">⚠️ Not logged</td></tr>`).join('');
      return `<div class="section"><h2>🧠 Developmental Check</h2><p style="color:#64748b;font-size:12px;margin-bottom:10px;">Red flags indicate expected milestones not yet recorded.</p><table><thead><tr><th>Category</th><th>Expected Skills</th><th>Window</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    };

    const correlationHTML = () => {
      const meds = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'medication').slice(0, 5);
      const symptoms = filteredEntries.filter((e: TrackerEntry) => ['symptom', 'temperature', 'allergy'].includes(e.trackerId));
      const items: string[] = [];
      meds.forEach(med => {
        const mt = new Date(med.timestamp).getTime();
        const rel = symptoms.find(s => new Date(s.timestamp).getTime() > mt && new Date(s.timestamp).getTime() < mt + 72 * 3600000);
        if (rel) items.push(`<li><strong>Possible reaction:</strong> ${rel.data?.symptomType || 'Symptom'} appeared ${Math.round((new Date(rel.timestamp).getTime() - mt) / 3600000)}h after ${med.data?.medicationName || 'medication'}.</li>`);
      });
      const fevers = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'temperature' && parseFloat(e.data?.value) > 38);
      const vax = filteredEntries.filter((e: TrackerEntry) => ['vaccine', 'immunization'].includes(e.trackerId));
      fevers.slice(0, 3).forEach(f => {
        const ft = new Date(f.timestamp).getTime();
        const near = vax.find(v => Math.abs(ft - new Date(v.timestamp).getTime()) < 48 * 3600000);
        if (near) items.push(`<li><strong>Post-vaccination fever:</strong> ${f.data?.value}° recorded within 48h of immunization.</li>`);
      });
      return items.length ? `<div class="section"><h2>🔗 Medical Correlations</h2><ul style="font-size:13px;line-height:1.8;color:#374151;">${items.join('')}</ul></div>` : '';
    };

    const sleepDebtHTML = () => {
      const sleeps = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'sleep' && e.duration);
      if (!sleeps.length) return '';
      const total = sleeps.reduce((s, e) => s + (e.duration || 0), 0);
      const avg = total / sleeps.length / 60;
      const rec = ageMo < 4 ? 15 : ageMo < 12 ? 14 : ageMo < 24 ? 13 : 12;
      const debt = Math.max(0, rec - avg);
      const score = Math.min(100, Math.round((avg / rec) * 100));
      const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
      return `<div class="section"><h2>😴 Sleep Debt Analysis</h2><div class="grid-3"><div class="card" style="text-align:center;"><span style="font-size:22px;font-weight:800;color:${color};">${score}</span><br/><span style="font-size:11px;color:#64748b;">Sleep Score</span></div><div class="card" style="text-align:center;"><span style="font-size:22px;font-weight:800;color:#1e293b;">${avg.toFixed(1)}h</span><br/><span style="font-size:11px;color:#64748b;">Avg per Session</span></div><div class="card" style="text-align:center;"><span style="font-size:22px;font-weight:800;color:${debt > 2 ? '#ef4444' : '#64748b'};">${debt.toFixed(1)}h</span><br/><span style="font-size:11px;color:#64748b;">Est. Debt</span></div></div><p style="color:#64748b;font-size:12px;margin-top:10px;">Recommended sleep for ${ageMo}mo: ~${rec} hours per 24h period.</p></div>`;
    };

    const forecastHTML = () => {
      const growth = filteredEntries.filter((e: TrackerEntry) => e.trackerId === 'growth').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const items: string[] = [];
      if (growth.length >= 2) {
        const w = growth.map(e => ({ t: new Date(e.timestamp).getTime(), v: parseFloat(e.data?.weight) || 0 })).filter(p => p.v > 0);
        if (w.length >= 2) {
          const dt = (w[w.length - 1].t - w[0].t) / (1000 * 60 * 60 * 24 * 7);
          const v = dt > 0 ? (w[w.length - 1].v - w[0].v) / dt : 0;
          items.push(`<li><strong>Weight trajectory:</strong> ${v > 0 ? '+' : ''}${v.toFixed(2)} kg/week. Projected weight in 2 weeks: <strong>${(w[w.length - 1].v + v * 2).toFixed(2)} kg</strong>.</li>`);
        }
      }
      const nextM = MILESTONE_EXPECTATIONS.find(m => m.maxMo > ageMo && m.maxMo <= ageMo + 3);
      if (nextM) items.push(`<li><strong>Next milestone window:</strong> ${nextM.maxMo} months — ${nextM.items[0]}.</li>`);
      return items.length ? `<div class="section"><h2>🔮 Predictive Forecasts</h2><ul style="font-size:13px;line-height:1.8;color:#374151;">${items.join('')}</ul></div>` : '';
    };

    const buildTable = (trackerIds: string[], title: string, emoji: string, columns: string[]) => {
      const items = filteredEntries.filter((e: TrackerEntry) => trackerIds.includes(e.trackerId));
      if (!items.length) return '';
      const rows = items.slice(0, 50).map((e: TrackerEntry) => {
        const data = e.data || {};
        const details = Object.entries(data).filter(([k]) => !['notes', 'photos', 'syncedAt'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ');
        return `<tr><td>${formatDate(e.timestamp)}</td><td><strong>${escapeHtml(e.trackerName || e.trackerId)}</strong></td><td>${escapeHtml(details)}${data.notes ? `<br/><em style="color:#64748b;">${escapeHtml(String(data.notes))}</em>` : ''}</td></tr>`;
      }).join('');
      return `<div class="section"><h2>${emoji} ${title}</h2><table><thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
    };

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
      enabledIds.has('growth') ? `<div class="section"><h2>📈 Growth & Development</h2>${growthChartHTML()}</div>` : '',
      enabledIds.has('percentiles') ? percentileHTML() : '',
      enabledIds.has('vaccines') ? vaccineHTML() : '',
      enabledIds.has('development') ? developmentHTML() : '',
      enabledIds.has('correlations') ? correlationHTML() : '',
      enabledIds.has('sleep') ? sleepDebtHTML() : '',
      enabledIds.has('feeding') ? buildTable(['feed', 'solid_food', 'breastfeeding', 'bottle_weaning', 'snack', 'water', 'vitamin'], 'Feeding & Nutrition', '🍼', ['Date', 'Type', 'Details']) : '',
      enabledIds.has('health') ? buildTable(['doctor_visit', 'dental_visit', 'therapy', 'symptom', 'temperature', 'allergy', 'skin_condition'], 'Health Events', '🏥', ['Date', 'Type', 'Details']) : '',
      enabledIds.has('medications') ? buildTable(['medication'], 'Medications', '💊', ['Date', 'Name', 'Details']) : '',
      enabledIds.has('forecast') ? forecastHTML() : '',
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
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { background: #f8fafc; font-weight: 700; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:hover { background: #f8fafc; }
    .chart-wrap { margin-top: 12px; text-align: center; }
    .muted { color: #94a3b8; font-style: italic; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; white-space: pre-wrap; }
    .success-box { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 13px; }
    .contact-card { background: #f8fafc; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.8; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
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
  <div class="footer">
    <p>This report was generated from LittleLoom tracking data.</p>
    <p>Not a substitute for professional medical advice. Always consult your pediatrician.</p>
  </div>
</body>
</html>`;
  }, [currentBaby, filteredEntries, sections, dateRange, customNotes, parent1, parent2, guardians]);

  /* ── Generate PDF ── */
  const generatePDF = useCallback(async () => {
    const enabledCount = sections.filter(s => s.enabled).length;
    if (!enabledCount) { sweetAlert?.alert?.('No Sections', 'Enable at least one section.'); return; }
    if (!currentBaby) { sweetAlert?.alert?.('No Baby', 'Select a baby profile first.'); return; }

    setGenerating(true);
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const safeName = (currentBaby.name || 'Baby').replace(/\s+/g, '_');
      const fileName = `${safeName}_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newPath });
      setReportHistory(prev => [{ path: newPath, date: format(new Date(), 'MMM d, h:mm a'), name: fileName }, ...prev].slice(0, 10));
      sweetAlert?.confirm?.('Report Ready!', 'Share the PDF now?', async () => {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(newPath, { mimeType: 'application/pdf', dialogTitle: `${currentBaby.name}'s Report`, UTI: 'com.adobe.pdf' });
        } else { await Share.share({ title: `${currentBaby.name}'s Report`, url: newPath }); }
      });
    } catch (err) { console.error(err); sweetAlert?.alert?.('Failed', 'Could not create PDF.'); }
    finally { setGenerating(false); }
  }, [generateHTML, sections, currentBaby, sweetAlert]);

  const shareExisting = async (path: string) => { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/pdf' }); };
  const deleteReport = async (path: string) => { try { await FileSystem.deleteAsync(path); } catch {} setReportHistory(prev => prev.filter(r => r.path !== path)); };

  if (!currentBaby) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Ionicons name="document-text-outline" size={64} color={theme.text.muted} />
        <Text style={[styles.emptyTitle, { color: theme.text.primary, marginTop: 16 }]}>No Baby Profile</Text>
        <Text style={[styles.emptySub, { color: theme.text.muted, textAlign: 'center', marginTop: 8 }]}>Select a baby profile to generate reports.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>{currentBaby.name}'s Report</Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.muted }]}>Pediatric Export</Text>
      </Animated.View>

      <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <BabyProfileHeader baby={currentBaby} />

        <Animated.View entering={FadeInUp.delay(40).springify()}>
          <GlassCard style={styles.heroCard}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="document-text" size={36} color="#fff" />
              <Text style={styles.heroTitle}>Pediatrician Report</Text>
              <Text style={styles.heroSub}>Professional PDF with clinical intelligence</Text>
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

        <Animated.View entering={FadeInUp.delay(60).springify()}>
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

        <Animated.View entering={FadeInUp.delay(80).springify()}>
          <SectionHeader title="Date Range" icon="calendar-outline" />
          <View style={styles.rangeRow}>
            {(['7d', '30d', '90d', 'all'] as const).map(r => (
              <TouchableOpacity key={r} onPress={() => setDateRange(r)} style={[styles.rangeBtn, dateRange === r && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                <Text style={[styles.rangeBtnText, { color: dateRange === r ? '#fff' : theme.text.primary }]}>{r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <GrowthPercentileCard entries={filteredEntries} baby={currentBaby} />
        <VaccinationComplianceCard entries={filteredEntries} baby={currentBaby} />
        <DevelopmentalRedFlagsCard entries={filteredEntries} baby={currentBaby} />
        <MedicalCorrelatorCard entries={filteredEntries} />
        <SleepDebtCard entries={filteredEntries} baby={currentBaby} />
        <PredictiveForecastCard entries={filteredEntries} baby={currentBaby} />

        <Animated.View entering={FadeInUp.delay(100).springify()}>
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

        <Animated.View entering={FadeInUp.delay(120).springify()}>
          <SectionHeader title="Notes for Doctor" icon="create-outline" subtitle="Concerns or questions" />
          <GlassCard style={styles.notesCard}>
            <TextInput value={customNotes} onChangeText={setCustomNotes} placeholder="e.g., Fussy after feeds, rash on neck..." placeholderTextColor={theme.text.muted} multiline numberOfLines={4} style={[styles.notesInput, { color: theme.text.primary }]} textAlignVertical="top" />
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(140).springify()}>
          <TouchableOpacity onPress={() => setShowPreview(!showPreview)} style={styles.previewToggle}>
            <Ionicons name={showPreview ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.primary} />
            <Text style={[styles.previewToggleText, { color: theme.primary }]}>{showPreview ? 'Hide Preview' : 'Show Preview'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {showPreview && (
          <Animated.View entering={FadeInUp.springify()}>
            <GlassCard style={styles.previewCard}>
              <Text style={[styles.previewTitle, { color: theme.text.primary }]}>Report Preview</Text>
              <View style={styles.previewMeta}>
                <Text style={[styles.previewMetaText, { color: theme.text.muted }]}>📋 {sections.filter(s => s.enabled).length} sections</Text>
                <Text style={[styles.previewMetaText, { color: theme.text.muted }]}>📅 {dateRange === 'all' ? 'All time' : `Last ${dateRange.replace('d',' days')}`}</Text>
                <Text style={[styles.previewMetaText, { color: theme.text.muted }]}>👤 {currentBaby.name}</Text>
              </View>
              <View style={[styles.previewBar, { backgroundColor: `${theme.primary}12` }]}>
                <View style={[styles.previewBarFill, { width: `${Math.min(100, (filteredEntries.length / 50) * 100)}%`, backgroundColor: theme.primary }]} />
              </View>
              <Text style={[styles.previewBarLabel, { color: theme.text.muted }]}>{filteredEntries.length} entries analyzed</Text>
            </GlassCard>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(160).springify()}>
          <TouchableOpacity onPress={generatePDF} disabled={generating} style={[styles.generateBtn, { backgroundColor: generating ? theme.text.muted : theme.primary }]}>
            {generating ? <ActivityIndicator color="#fff" /> : <><Ionicons name="download-outline" size={22} color="#fff" /><Text style={styles.generateBtnText}>Generate PDF Report</Text></>}
          </TouchableOpacity>
          <Text style={[styles.disclaimer, { color: theme.text.muted }]}>Reports are generated locally. No data leaves your device.</Text>
        </Animated.View>

        {reportHistory.length > 0 && (
          <Animated.View entering={FadeInUp.delay(180).springify()}>
            <SectionHeader title="Recent Reports" icon="time-outline" />
            {reportHistory.map(report => (
              <GlassCard key={report.path} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <View style={[styles.historyIconWrap, { backgroundColor: `${theme.primary}12` }]}><Ionicons name="document" size={20} color={theme.primary} /></View>
                  <View><Text style={[styles.historyName, { color: theme.text.primary }]} numberOfLines={1}>{report.name}</Text><Text style={[styles.historyDate, { color: theme.text.muted }]}>{report.date}</Text></View>
                </View>
                <View style={styles.historyActions}>
                  <TouchableOpacity onPress={() => shareExisting(report.path)} style={styles.historyActionBtn}><Ionicons name="share-outline" size={18} color={theme.primary} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteReport(report.path)} style={styles.historyActionBtn}><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </Animated.View>
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>
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

  /* Glass */
  glassCard: { marginHorizontal: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  /* Section Header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, marginTop: 20, gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

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

  /* Badge */
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  /* Hero */
  heroCard: { marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },
  heroGradient: { padding: 22, alignItems: 'center', borderRadius: 16 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 10 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3, textAlign: 'center' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 20 },
  heroStat: { alignItems: 'center', minWidth: 60 },
  heroStatNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.3)' },

  /* Templates */
  templateScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  templateChip: { width: 100, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)', backgroundColor: 'rgba(255,255,255,0.5)' },
  templateLabel: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  templateDesc: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  /* Date Range */
  rangeRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  rangeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.6)' },
  rangeBtnText: { fontSize: 13, fontWeight: '700' },

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

  /* Vaccines */
  vaxList: { padding: 12 },
  vaxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  vaxLeft: { flex: 1, paddingRight: 12 },
  vaxName: { fontSize: 14, fontWeight: '700' },
  vaxDots: { flexDirection: 'row', gap: 4, marginTop: 4 },
  vaxDot: { width: 8, height: 8, borderRadius: 4 },

  /* Development */
  redFlagBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, margin: 12, marginBottom: 4 },
  redFlagText: { fontSize: 13, fontWeight: '700', flex: 1 },
  devGrid: { padding: 12, gap: 8 },
  devCard: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.02)' },
  devCategory: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  devItems: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  devExpected: { fontSize: 11, fontWeight: '500', marginTop: 4 },

  /* Correlations */
  corrList: { paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  corrCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  corrEmoji: { fontSize: 22 },
  corrTitle: { fontSize: 13, fontWeight: '700' },
  corrDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginTop: 2 },

  /* Sleep */
  sleepTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  sleepScoreCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' },
  sleepScoreNum: { fontSize: 26, fontWeight: '800' },
  sleepScoreLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  sleepMetricsCol: { flex: 1, gap: 8 },
  sleepMetricRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sleepMetricText: { fontSize: 13, fontWeight: '600' },
  sleepBarBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginHorizontal: 16, marginBottom: 16 },
  sleepBarFill: { height: '100%', borderRadius: 3 },

  /* Forecast */
  forecastScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4, marginBottom: 16 },
  forecastCard: { width: 150, padding: 14, alignItems: 'center', gap: 6 },
  forecastIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  forecastLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  forecastValue: { fontSize: 16, fontWeight: '800' },
  forecastSub: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

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

  /* Preview */
  previewToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 8 },
  previewToggleText: { fontSize: 14, fontWeight: '700' },
  previewCard: { padding: 16 },
  previewTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  previewMeta: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  previewMetaText: { fontSize: 12, fontWeight: '600' },
  previewBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  previewBarFill: { height: '100%', borderRadius: 3 },
  previewBarLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  /* Generate */
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 18, marginHorizontal: 16, marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 14, lineHeight: 18, marginHorizontal: 30 },

  /* History */
  historyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginBottom: 10 },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  historyIconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  historyName: { fontSize: 14, fontWeight: '700', maxWidth: 180 },
  historyDate: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  historyActions: { flexDirection: 'row', gap: 8 },
  historyActionBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.04)' },

  /* Empty */
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { fontSize: 14, lineHeight: 20 },
});

export default PediatricianPDFExport;