import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  format,
  isToday,
  isYesterday,
  isSameDay,
  formatDistanceToNow,
  differenceInDays,
  parseISO,
  isValid,
} from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import { useCustomization } from '@/hooks/useCustomization';
import { useUnifiedTrackerTheme } from '@/hooks/useUnifiedTrackerTheme';
import { useTracker } from '../../hooks';
import { useBaby } from '@/context/BabyContext';
import { useFamily } from '@/context/FamilyContext';
import { getMemberDisplayLabel } from '@/types/roles';
import { resolveTargetId } from '@/utils/memberNavigation';
import { SafeAvatar } from '@/components/SafeAvatar';
import { useSweetAlert } from '@/components/SweetAlert';

const { width: SCREEN_W } = Dimensions.get('window');

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

const SKIP_KEYS = new Set([
  'id', 'timestamp', 'babyId', 'type', 'title', 'icon',
  'photoUris', 'photos', 'photo', 'notes', 'tags', 'location', 'syncedAt',
  'loggedBy', 'loggedByName', 'loggedByRole', 'editedAt', 'editedBy', 'editedByName',
]);

const ROLE_META: Record<string, { label: string; color: string }> = {
  parent1: { label: 'Primary Parent', color: DS.primary },
  parent2: { label: 'Co-Parent', color: DS.accent },
  guardian: { label: 'Guardian', color: DS.success },
  viewer: { label: 'Viewer', color: DS.gray500 },
  admin: { label: 'Admin', color: DS.warning },
};

const EDIT_HISTORY_KEY = '@littleloom_edit_history_v1';

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const safeStr = (val: unknown, fallback = ''): string => (val == null ? fallback : String(val));
const safeNum = (val: unknown, fallback = 0): number => {
  if (val == null) return fallback;
  const n = Number(val);
  return Number.isNaN(n) || !Number.isFinite(n) ? fallback : n;
};

const safeParseDate = (d?: string | null): Date | null => {
  if (!d) return null;
  try { const p = parseISO(d); return isValid(p) ? p : null; } catch { return null; }
};

const safeFmt = (d: Date | string | null | undefined, fmt: string): string => {
  const p = safeParseDate(typeof d === 'string' ? d : undefined) || (d instanceof Date ? d : null);
  if (!p) return '—';
  try { return format(p, fmt); } catch { return '—'; }
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  const left = safeParseDate(typeof a === 'string' ? a : undefined) || (a instanceof Date ? a : null);
  const right = safeParseDate(typeof b === 'string' ? b : undefined) || (b instanceof Date ? b : null);
  if (!left || !right) return 0;
  return differenceInDays(left, right);
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface EntryEditVersion {
  editedAt: number;
  editedBy?: string;
  editedByName: string;
  prevTitle?: string;
  prevNotes?: string;
  prevTimestamp: number;
  prevData?: Record<string, unknown>;
  prevPhotoUris?: string[];
  prevTags?: string[];
}

type FieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'bool'; bool: boolean }
  | { kind: 'rating'; rating: number }
  | { kind: 'chips'; chips: string[] }
  | { kind: 'duration'; minutes: number }
  | { kind: 'measurement'; value: number; unit: string };

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const humanizeKey = (key: string): string =>
  key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const formatDurationMin = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const formatValue = (key: string, value: unknown, data: Record<string, unknown>): FieldValue | null => {
  if (value === undefined || value === null || value === '') return null;
  if ((key === 'unit' || key === 'value_unit') && data.value !== undefined) return null;
  if (typeof value === 'boolean') return { kind: 'bool', bool: value };
  if (Array.isArray(value)) return value.length === 0 ? null : { kind: 'chips', chips: value.map(String) };
  if (typeof value === 'object') {
    const o = value as any;
    if (o?.name) return { kind: 'text', text: String(o.name) };
    if (o?.label) return { kind: 'text', text: String(o.label) };
    return { kind: 'text', text: JSON.stringify(value) };
  }
  if (typeof value === 'number') {
    const lk = key.toLowerCase();
    if ((lk.includes('quality') || lk.includes('rating') || lk.includes('mood') || lk.includes('severity')) && value >= 1 && value <= 5) {
      return { kind: 'rating', rating: value };
    }
    if (lk.includes('duration') || lk.endsWith('minutes') || lk === 'mins') {
      return { kind: 'duration', minutes: value };
    }
    if (key === 'value') {
      const unit = (data.unit ?? data.value_unit) as string | undefined;
      if (unit) return { kind: 'measurement', value, unit };
    }
    return { kind: 'text', text: String(value) };
  }
  const str = String(value).replace(/_/g, ' ');
  return { kind: 'text', text: str.length > 1 ? str[0].toUpperCase() + str.slice(1) : str };
};

const versionValueText = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '—';
  if (typeof v === 'object') {
    const o = v as any;
    if (o?.name) return String(o.name);
    if (o?.label) return String(o.label);
    return JSON.stringify(v);
  }
  return String(v);
};

/* ═══════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════ */

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

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel, isDark }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  action?: () => void; actionLabel?: string; isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{subtitle}</Text>}
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

const GlassCard = ({ children, style, onPress, active = false, isDark }: any) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[
        styles.glassCard,
        {
          backgroundColor: isDark ? DS.darkCard : DS.white,
          borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
        },
        style,
      ]}
    >
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Entry Pulse — compact animated header
   ═══════════════════════════════════════════════════════════════════════════ */

const EntryPulse = React.memo<{
  isDark: boolean;
  entry: any;
  tracker: any;
  accent: string;
  baby: any;
  ageAtLogging: string;
  dayLabel: string;
  stats: {
    entryNumber: number;
    totalInTracker: number;
    sameDayCount: number;
    sincePrev: string | null;
    avgGap: string | null;
  };
  photosCount: number;
  onBabyPress: () => void;
  onSharePress: () => void;
  onDeletePress: () => void;
  canDelete: boolean;
}>(({
  isDark, entry, tracker, accent, baby, ageAtLogging, dayLabel, stats,
  photosCount, onBabyPress, onSharePress, onDeletePress, canDelete,
}) => {
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

  const timeLabel = entry ? format(new Date(entry.timestamp), 'h:mm a') : '';
  const statusLabel = entry ? `${dayLabel} · ${timeLabel}` : '';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? [`${accent}25`, `${accent}10`, 'rgba(139,92,246,0.04)']
            : [`${accent}12`, `${accent}06`, 'rgba(255,255,255,0.4)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${accent}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${accent}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, { backgroundColor: `${accent}35` }, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient
                  colors={[accent, (tracker?.gradient?.[1] as string) || accent, DS.warning, accent]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                <Text style={{ fontSize: 24 }}>{tracker?.emoji || '📝'}</Text>
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {entry?.title || tracker?.name || 'Entry'}
              </Text>
              <View style={[styles.pulseTrackerPill, { backgroundColor: `${accent}18` }]}>
                <Text style={[styles.pulseTrackerText, { color: accent }]} numberOfLines={1}>
                  {tracker?.name || 'Tracker'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: accent }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}{ageAtLogging ? ` · ${ageAtLogging}` : ''}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onSharePress} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="share-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            {canDelete && (
              <PressableScale onPress={onDeletePress} activeScale={0.9}>
                <View style={[styles.pulseIconBtn, { backgroundColor: `${DS.danger}15` }]}>
                  <Ionicons name="trash-outline" size={18} color={DS.danger} />
                </View>
              </PressableScale>
            )}
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: accent }]} numberOfLines={1}>
              #{stats.entryNumber}
            </Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>of {stats.totalInTracker}</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{stats.sameDayCount + 1}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>same day</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: '#8b5cf6' }]} numberOfLines={1}>
              {stats.sincePrev || '—'}
            </Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>gap</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success }]} numberOfLines={1}>
              {stats.avgGap || '—'}
            </Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>typical</Text>
          </View>
        </View>

        {photosCount > 0 && (
          <View style={[styles.pulsePhotosPill, { backgroundColor: `${accent}12` }]}>
            <Ionicons name="images-outline" size={12} color={accent} />
            <Text style={[styles.pulsePhotosText, { color: accent }]}>{photosCount} photo{photosCount === 1 ? '' : 's'}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   Sparkline
   ═══════════════════════════════════════════════════════════════════════════ */

const Sparkline = ({ data, color, width = 80, height = 30 }: {
  data: number[]; color: string; width?: number; height?: number;
}) => {
  if (!data || data.length < 2) return null;
  const maxVal = Math.max(...data, 0.1);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * chartW,
    y: padding + chartH - ((v - minVal) / range) * chartH,
  }));

  return (
    <View style={{ width, height }}>
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = pt.x - prev.x, dy = pt.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const midX = (prev.x + pt.x) / 2, midY = (prev.y + pt.y) / 2;
        return (
          <View key={i} style={{
            position: 'absolute',
            left: midX - len / 2, top: midY - 1,
            width: len, height: 2, backgroundColor: color,
            borderRadius: 1, opacity: 0.7,
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}
      {points.map((pt, i) => (
        <View key={`pt-${i}`} style={{
          position: 'absolute',
          left: pt.x - 2, top: pt.y - 2,
          width: 4, height: 4, borderRadius: 2,
          backgroundColor: color, borderWidth: 1, borderColor: DS.white,
        }} />
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ValueCell
   ═══════════════════════════════════════════════════════════════════════════ */

const ValueCell = ({ value, accent, isDark }: { value: FieldValue; accent: string; isDark: boolean }) => {
  if (value.kind === 'bool') {
    return (
      <View style={[styles.boolPill, { backgroundColor: value.bool ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)' }]}>
        <Text style={[styles.boolPillText, { color: value.bool ? DS.success : DS.danger }]}>
          {value.bool ? 'Yes' : 'No'}
        </Text>
      </View>
    );
  }
  if (value.kind === 'rating') {
    return (
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons key={i} name={i <= value.rating ? 'star' : 'star-outline'} size={14}
            color={i <= value.rating ? DS.warning : isDark ? DS.gray600 : DS.gray300} />
        ))}
      </View>
    );
  }
  if (value.kind === 'chips') {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
        {value.chips.map((c, i) => (
          <View key={`${c}-${i}`} style={[styles.valueChip, { backgroundColor: `${accent}15` }]}>
            <Text style={[styles.valueChipText, { color: accent }]}>{c}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (value.kind === 'duration') {
    return <Text style={[styles.rowValue, { color: isDark ? DS.white : DS.gray900 }]}>{formatDurationMin(value.minutes)}</Text>;
  }
  if (value.kind === 'measurement') {
    return <Text style={[styles.rowValue, { color: isDark ? DS.white : DS.gray900 }]}>{value.value} {value.unit}</Text>;
  }
  return <Text style={[styles.rowValue, { color: isDark ? DS.white : DS.gray900 }]}>{value.text}</Text>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   Entry Intelligence Panel
   ═══════════════════════════════════════════════════════════════════════════ */

const EntryIntelligencePanel = ({ entry, tracker, allEntries, accent, isDark }: any) => {
  const safeEntries = Array.isArray(allEntries) ? allEntries : [];
  const safeTracker = tracker ?? null;

  const stats = useMemo(() => {
    if (!entry || safeEntries.length === 0) return null;
    const trackerEntries = safeEntries.filter((e: any) => e?.trackerId === entry.trackerId).sort((a: any, b: any) => a.timestamp - b.timestamp);
    const entryIndex = trackerEntries.findIndex((e: any) => e.id === entry.id);
    const prevEntry = entryIndex > 0 ? trackerEntries[entryIndex - 1] : null;
    const sameDay = safeEntries.filter((e: any) => e && e.id !== entry.id && isSameDay(new Date(e.timestamp), new Date(entry.timestamp)));
    const valueTrend = trackerEntries.map((e: any) => {
      const val = e.data?.value ?? e.data?.amount ?? e.data?.duration ?? e.data?.temperature ?? 0;
      return safeNum(val, 0);
    });
    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = trackerEntries.filter((e: any) => e.timestamp >= weekAgo).length;
    const prevWeek = trackerEntries.filter((e: any) => e.timestamp >= weekAgo - 7 * 86400000 && e.timestamp < weekAgo).length;
    const weekTrend = prevWeek === 0 ? 100 : Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
    const gapMs = prevEntry ? entry.timestamp - prevEntry.timestamp : null;
    const avgGapMs = trackerEntries.length >= 2
      ? trackerEntries.reduce((sum: number, e: any, i: number) => {
          if (i === 0) return sum;
          return sum + (e.timestamp - trackerEntries[i - 1].timestamp);
        }, 0) / (trackerEntries.length - 1)
      : null;

    const fmtGap = (ms: number): string => {
      const mins = Math.round(ms / 60000);
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
      const d = Math.floor(h / 24);
      return `${d}d`;
    };

    const dayEntries = safeEntries.filter((e: any) => e && isSameDay(new Date(e.timestamp), new Date(entry.timestamp))).sort((a: any, b: any) => a.timestamp - b.timestamp);
    const dayIndex = dayEntries.findIndex((e: any) => e.id === entry.id) + 1;

    return {
      totalInTracker: trackerEntries.length,
      entryNumber: entryIndex + 1,
      prevEntry,
      sameDayCount: sameDay.length,
      dayPosition: dayIndex,
      dayTotal: dayEntries.length,
      sincePrev: gapMs ? fmtGap(gapMs) : null,
      avgGap: avgGapMs ? fmtGap(avgGapMs) : null,
      weekTrend,
      thisWeek,
      valueTrend: valueTrend.slice(-7),
    };
  }, [entry, safeEntries]);

  if (!stats) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Entry Intelligence" subtitle="Patterns & context" icon="analytics-outline" color={accent} isDark={isDark} />
      <GlassCard isDark={isDark}>
        <View style={{ padding: DS.space.md }}>
          <View style={styles.intelGrid}>
            <View style={styles.intelTile}>
              <View style={[styles.intelIconBg, { backgroundColor: `${DS.primary}12` }]}>
                <Ionicons name="list-outline" size={18} color={DS.primary} />
              </View>
              <Text style={[styles.intelValue, { color: isDark ? DS.white : DS.gray900 }]}>{stats.entryNumber}</Text>
              <Text style={[styles.intelLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>of {stats.totalInTracker} in {safeTracker?.name || 'tracker'}</Text>
            </View>
            <View style={styles.intelTile}>
              <View style={[styles.intelIconBg, { backgroundColor: `${DS.warning}12` }]}>
                <Ionicons name="calendar-number-outline" size={18} color={DS.warning} />
              </View>
              <Text style={[styles.intelValue, { color: isDark ? DS.white : DS.gray900 }]}>{stats.dayPosition}</Text>
              <Text style={[styles.intelLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{stats.dayTotal} that day</Text>
            </View>
            {stats.sincePrev && (
              <View style={styles.intelTile}>
                <View style={[styles.intelIconBg, { backgroundColor: '#8b5cf612' }]}>
                  <Ionicons name="timer-outline" size={18} color="#8b5cf6" />
                </View>
                <Text style={[styles.intelValue, { color: isDark ? DS.white : DS.gray900 }]}>{stats.sincePrev}</Text>
                <Text style={[styles.intelLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>since previous</Text>
              </View>
            )}
            {stats.avgGap && (
              <View style={styles.intelTile}>
                <View style={[styles.intelIconBg, { backgroundColor: `${DS.success}12` }]}>
                  <Ionicons name="stats-chart-outline" size={18} color={DS.success} />
                </View>
                <Text style={[styles.intelValue, { color: isDark ? DS.white : DS.gray900 }]}>{stats.avgGap}</Text>
                <Text style={[styles.intelLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>typical gap</Text>
              </View>
            )}
          </View>

          {stats.valueTrend.length >= 2 && (
            <View style={[styles.trendRow, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trendLabel, { color: isDark ? DS.gray300 : DS.gray700 }]}>Value Trend</Text>
                <Text style={[styles.trendSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>Last {stats.valueTrend.length} entries</Text>
              </View>
              <Sparkline data={stats.valueTrend} color={safeTracker?.gradient?.[0] || accent} />
            </View>
          )}

          <View style={[styles.trendRow, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trendLabel, { color: isDark ? DS.gray300 : DS.gray700 }]}>This Week</Text>
              <Text style={[styles.trendSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>{stats.thisWeek} entries</Text>
            </View>
            <View style={[styles.trendBadge, { backgroundColor: stats.weekTrend >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
              <Ionicons name={stats.weekTrend >= 0 ? 'trending-up' : 'trending-down'} size={12} color={stats.weekTrend >= 0 ? DS.success : DS.danger} />
              <Text style={[styles.trendBadgeText, { color: stats.weekTrend >= 0 ? DS.success : DS.danger }]}>
                {stats.weekTrend > 0 ? '+' : ''}{stats.weekTrend}%
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Similar Entries
   ═══════════════════════════════════════════════════════════════════════════ */

const SimilarEntriesPanel = ({
  entry,
  allEntries,
  getTracker,
  onOpenEntry,
  isDark,
  accent,
  members = [],
}: any) => {
  // `getTracker` is a required prop, but callers may pass it as
  // `undefined` if `useTracker()` returned a degraded context
  // (TrackerProvider not hydrated, or context shape changed).
  // Fall back to a no-op so `.name` lookups can't crash.
  const safeGetTracker =
    typeof getTracker === 'function' ? getTracker : (_id: string) => undefined;

  const safeEntries = Array.isArray(allEntries) ? allEntries : [];
  const safeMembers = Array.isArray(members) ? members : [];

  const similar = useMemo(() => {
    if (!entry) return [];
    return safeEntries
      .filter(
        (e: any) =>
          e &&
          e.id !== entry.id &&
          e.trackerId === entry.trackerId,
      )
      .slice(0, 3)
      .sort((a: any, b: any) => b.timestamp - a.timestamp);
  }, [entry, safeEntries]);

  if (similar.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader
        title="Recent Similar"
        subtitle={`Other ${safeGetTracker(entry?.trackerId)?.name || 'entries'}`}
        icon="copy-outline"
        color={accent}
        isDark={isDark}
      />
      <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
        {similar.map((e: any) => {
          const t = safeGetTracker(e.trackerId);
          const c = t?.gradient?.[0] || t?.color || accent;
          return (
            <PressableScale key={e.id} onPress={() => onOpenEntry(e)} activeScale={0.98}>
              <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: DS.space.md }}>
                  <View style={[styles.similarIconBg, { backgroundColor: `${c}12` }]}>
                    <Text style={{ fontSize: 18 }}>{t?.emoji || '📋'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.similarTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                      {e.title || t?.name || 'Entry'}
                    </Text>
                    <Text style={[styles.similarMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      {safeFmt(e.timestamp, 'MMM d, h:mm a')}
                      {(() => {
                        const logger =
                          (safeMembers.find((m: any) => m.userId === (e as any).loggedBy) ||
                            safeMembers.find((m: any) => m.id === (e as any).loggedBy)) ||
                          null;
                        const displayName = logger?.fullName || e.loggedByName;
                        const displayLabel = logger
                          ? getMemberDisplayLabel({ role: logger.role, relationship: logger.relationship })
                          : '';
                        if (!displayName) return '';
                        return displayLabel
                          ? ` • ${displayName} (${displayLabel})`
                          : ` • ${displayName}`;
                      })()}
                    </Text>
                  </View>
                  <View style={[styles.similarValueBadge, { backgroundColor: `${c}12` }]}>
                    <Text style={[styles.similarValueText, { color: c }]}>
                      {e.data?.value ?? e.data?.amount ?? '—'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={isDark ? DS.gray600 : DS.gray400} />
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EntryDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const theme = useUnifiedTrackerTheme();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    triggerHaptic,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
  } = useCustomization();

  const trackerCtx = useTracker();

  // ── SAFETY NET ─────────────────────────────────────────────
  // `useTracker()` may return a degraded context on very first
  // render (TrackerProvider not yet hydrated), or a fallback that
  // doesn't define `getTracker`. Destructuring directly would give
  // `undefined` for every function we call during render — the
  // exact root cause of `TypeError: Cannot read property 'name'
  // of undefined` in SimilarEntriesPanel / EntryIntelligencePanel.
  // We guard each accessor with a safe no-op.
  const getEntryById = trackerCtx?.getEntryById ?? (() => undefined);
  const getTracker = trackerCtx?.getTracker ?? (() => undefined);
  const getEntries = trackerCtx?.getEntries ?? (() => []);
  const getEntriesByDate = trackerCtx?.getEntriesByDate ?? (() => []);
  const addEntry = trackerCtx?.addEntry ?? (async () => null);
  const deleteEntry = trackerCtx?.deleteEntry ?? (async () => false);
  const canEditEntry = trackerCtx?.canEditEntry ?? (() => false);
  const canDeleteEntry = trackerCtx?.canDeleteEntry ?? (() => false);
  const canCreateEntry = trackerCtx?.canCreateEntry ?? (() => false);
  const allEntries = Array.isArray(trackerCtx?.entries) ? trackerCtx.entries : [];
  const { babies, currentBaby } = useBaby();
  // Pull family members so we can resolve the CURRENT name + role for
  // the logger — same source of truth as HomeScreen's RecentTimeline.
  const { members, loadFamily } = useFamily();
  const { success, confirm } = useSweetAlert();

  const entryId = route.params?.entryId;
  const entry = entryId ? getEntryById(entryId) : undefined;
  const tracker = entry ? getTracker(entry.trackerId) : undefined;

  const accent = tracker?.gradient?.[0] || tracker?.color || DS.primary;
  const heroColors: [string, string] = [accent, (tracker?.gradient?.[1] as string) || DS.accent];

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editHistory, setEditHistory] = useState<EntryEditVersion[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!entryId) return;
      try {
        const raw = await AsyncStorage.getItem(EDIT_HISTORY_KEY);
        const store = raw ? JSON.parse(raw) : {};
        const list = Array.isArray(store[entryId]) ? store[entryId] : [];
        if (mounted) setEditHistory(list);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [entryId, entry?.editedAt]);

  // ── Refresh family on focus ─────────────────────────────────────
  // The audit card resolves the logger's CURRENT name + role from
  // `members`. If the user changed that person's role/name on
  // another device (or in EditGuardian), we want the audit card to
  // reflect it as soon as the screen is focused — not just after
  // the next cold boot.
  useFocusEffect(
    useCallback(() => {
      if (typeof loadFamily === 'function') {
        loadFamily().catch(() => {});
      }
      return () => {};
    }, [loadFamily]),
  );

  const baby = useMemo(() => {
    if (!entry) return currentBaby;
    return babies?.find((b: any) => b.id === entry.babyId) || currentBaby;
  }, [entry, babies, currentBaby]);

  const entryDate = entry ? new Date(entry.timestamp) : null;
  const photos = useMemo(() => {
    const raw = entry?.photoUris;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((u): u is string => typeof u === 'string' && u.length > 0);
  }, [entry]);
  const tags = useMemo(() => entry?.tags ?? [], [entry]);
  const locationName = typeof entry?.location?.name === 'string' ? entry.location.name : '';

  const canEdit = entry ? canEditEntry(entry) : false;
  const canDelete = entry ? canDeleteEntry(entry) : false;
  const canDuplicate = entry ? canCreateEntry(entry.trackerId) : false;

  const dayLabel = useMemo(() => {
    if (!entryDate) return '';
    if (isToday(entryDate)) return 'Today';
    if (isYesterday(entryDate)) return 'Yesterday';
    return format(entryDate, 'EEEE');
  }, [entryDate]);

  const relativeLabel = useMemo(() => {
    if (!entryDate) return '';
    try { return formatDistanceToNow(entryDate, { addSuffix: true }); } catch { return ''; }
  }, [entryDate]);

  const detailRows = useMemo(() => {
    if (!entry?.data) return [] as { key: string; label: string; value: FieldValue }[];
    const data = entry.data as Record<string, unknown>;
    const orderedKeys: string[] = [];
    (tracker?.fields || []).forEach((f: any) => {
      if (f?.id && data[f.id] !== undefined) orderedKeys.push(f.id);
    });
    Object.keys(data).forEach((k) => {
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    });
    return orderedKeys
      .filter((k) => !SKIP_KEYS.has(k))
      .map((k) => {
        const field = tracker?.fields?.find((fl: any) => fl.id === k);
        return {
          key: k,
          label: field?.label || humanizeKey(k),
          value: formatValue(k, data[k], data),
        };
      })
      .filter((r): r is { key: string; label: string; value: FieldValue } => r.value !== null);
  }, [entry, tracker]);

  const sameDayEntries = useMemo(() => {
    if (!entry) return [] as any[];
    if (typeof getEntriesByDate !== 'function') return [] as any[];
    const list = getEntriesByDate(new Date(entry.timestamp));
    if (!Array.isArray(list)) return [] as any[];
    return list
      .filter((e: any) => e && e.id !== entry.id)
      .slice(0, 8);
  }, [entry, getEntriesByDate]);

  const trackerHistory = useMemo(() => {
    if (!entry) return { prev: null as any, next: null as any, index: -1, total: 0 };
    if (typeof getEntries !== 'function') {
      return { prev: null as any, next: null as any, index: -1, total: 0 };
    }
    const raw = getEntries(entry.trackerId);
    const list = Array.isArray(raw) ? raw.slice().sort((a: any, b: any) => a.timestamp - b.timestamp) : [];
    const index = list.findIndex((e: any) => e.id === entry.id);
    return {
      prev: index > 0 ? list[index - 1] : null,
      next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
      index,
      total: list.length,
    };
  }, [entry, getEntries]);

  const syncedLabel = useMemo(() => {
    if (!entry?.syncedAt) return null;
    const d = new Date(entry.syncedAt as any);
    return isNaN(d.getTime()) ? null : format(d, 'MMM d, h:mm a');
  }, [entry]);

  const historyRows = useMemo(() => {
    if (!entry || editHistory.length === 0) return [] as any[];
    return editHistory.map((v, idx) => {
      const isLast = idx === editHistory.length - 1;
      const afterData = (isLast ? entry.data : editHistory[idx + 1]?.prevData) as Record<string, unknown> | undefined;
      const afterTitle = isLast ? entry.title : editHistory[idx + 1]?.prevTitle;
      const afterNotes = isLast ? entry.notes : editHistory[idx + 1]?.prevNotes;
      const afterTimestamp = isLast ? entry.timestamp : editHistory[idx + 1]?.prevTimestamp;
      const changes: { label: string; before: string; after: string }[] = [];
      if ((v.prevTitle || '') !== (afterTitle || '')) changes.push({ label: 'Title', before: versionValueText(v.prevTitle), after: versionValueText(afterTitle) });
      if ((v.prevNotes || '') !== (afterNotes || '')) changes.push({ label: 'Notes', before: versionValueText(v.prevNotes), after: versionValueText(afterNotes) });
      if (afterTimestamp && v.prevTimestamp !== afterTimestamp) {
        changes.push({
          label: 'Time',
          before: format(new Date(v.prevTimestamp), 'MMM d, h:mm a'),
          after: format(new Date(afterTimestamp), 'MMM d, h:mm a'),
        });
      }
      const prevData = (v.prevData || {}) as Record<string, unknown>;
      const nextData = (afterData || {}) as Record<string, unknown>;
      const allKeys = [...new Set([...Object.keys(prevData), ...Object.keys(nextData)])].filter(k => !SKIP_KEYS.has(k));
      allKeys.forEach(k => {
        const before = versionValueText(prevData[k]);
        const after = versionValueText(nextData[k]);
        if (before !== after) {
          const field = tracker?.fields?.find((fl: any) => fl.id === k);
          changes.push({ label: field?.label || humanizeKey(k), before, after });
        }
      });
      return {
        key: `${v.editedAt}-${idx}`,
        version: idx + 1,
        editedAt: v.editedAt,
        editedByName: v.editedByName || 'Unknown',
        changes,
      };
    }).reverse();
  }, [entry, editHistory, tracker]);

  const ageAtLogging = useMemo(() => {
    const dobStr = (baby as any)?.birthDate;
    if (!dobStr || !entryDate) return baby?.age ? `${baby.age}` : '';
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return baby?.age ? `${baby.age}` : '';
    const totalDays = Math.floor((entryDate.getTime() - dob.getTime()) / 86400000);
    if (totalDays < 0) return '';
    if (totalDays < 1) return 'Newborn';
    if (totalDays < 14) return `${totalDays}d old`;
    if (totalDays < 60) {
      const weeks = Math.floor(totalDays / 7);
      const remDays = totalDays % 7;
      return remDays > 0 ? `${weeks}w ${remDays}d old` : `${weeks}w old`;
    }
    let months = (entryDate.getFullYear() - dob.getFullYear()) * 12;
    months += entryDate.getMonth() - dob.getMonth();
    if (entryDate.getDate() < dob.getDate()) months--;
    if (months < 0) months = 0;
    if (months < 24) {
      const anchor = new Date(dob);
      anchor.setMonth(anchor.getMonth() + months);
      const remDays = Math.max(0, Math.floor((entryDate.getTime() - anchor.getTime()) / 86400000));
      return remDays > 0 ? `${months}m ${remDays}d old` : `${months}mo old`;
    }
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}y ${remMonths}m old` : `${years}y old`;
  }, [baby, entryDate]);

  const shareText = useMemo(() => {
    if (!entry || !entryDate) return '';
    const lines = [
      `${tracker?.emoji || '📝'} ${entry.title || 'Entry'}`,
      `${tracker?.name || entry.trackerId} — ${format(entryDate, 'EEEE, MMM d, yyyy')} at ${format(entryDate, 'h:mm a')}`,
      '',
      ...detailRows.map((r) => {
        const v = r.value;
        const txt =
          v.kind === 'bool' ? (v.bool ? 'Yes' : 'No')
          : v.kind === 'rating' ? `${v.rating}/5`
          : v.kind === 'chips' ? v.chips.join(', ')
          : v.kind === 'duration' ? formatDurationMin(v.minutes)
          : v.kind === 'measurement' ? `${v.value} ${v.unit}`
          : v.text;
        return `• ${r.label}: ${txt}`;
      }),
    ];
    if (entry.notes) lines.push('', `Notes: ${entry.notes}`);
    if (tags.length > 0) lines.push(`Tags: ${tags.map((t: string) => `#${t}`).join(' ')}`);
    if (photos.length > 0) lines.push(`📷 ${photos.length} photo${photos.length > 1 ? 's' : ''} attached`);
    lines.push('', `Logged by ${loggedByDisplay?.name || 'You'}${loggedByDisplay?.label ? ` (${loggedByDisplay.label})` : ''} • LittleLoom`);
    return lines.join('\n');
  }, [entry, entryDate, detailRows, tracker, tags, photos, loggedByDisplay]);

  // ── LIVE LOGGER RESOLUTION ─────────────────────────────────────
  // Same source of truth as HomeScreen's RecentTimeline: resolve the
  // logger from `family_members` (live names + relationships), not
  // from the immutable `entry.loggedByName/loggedByRole` snapshot.
  //
  //   • member.userId === entry.loggedBy → canonical match
  //   • member.id === entry.loggedBy     → legacy fallback
  //   • member.fullName === entry.loggedByName → last-resort match
  //
  // Then label = getMemberDisplayLabel({ role, relationship }) which
  // yields "Mother"/"Father"/"Guardian"/"Primary Parent"/etc. — the
  // same human label used everywhere else in the app.
  //
  // If no member row matches (deleted account, orphaned entry) we
  // gracefully fall back to the historical snapshot but never
  // default to "Primary Parent" — we surface the historical role
  // honestly and label unknown loggers as "Family Member".
  const loggedByDisplay = useMemo(() => {
    if (!entry) {
      return {
        name: 'You',
        role: 'parent1' as string,
        relationship: '',
        label: 'Primary Parent',
        avatar: '',
        member: null as any,
      };
    }

    const rawBy: any = (entry as any).loggedBy;
    const rawByName: string = String((entry as any).loggedByName || '').trim();

    // Look up the canonical member row for the logger.
    const member =
      (rawBy &&
        (members.find((m: any) => m.userId === rawBy) ||
          members.find((m: any) => m.id === rawBy))) ||
      (rawByName &&
        members.find(
          (m: any) =>
            (m.fullName || '').trim().toLowerCase() ===
            rawByName.toLowerCase(),
        )) ||
      null;

    // Role: prefer the LIVE family_members role; fall back to the
    // historical snapshot (`loggedByRole`). Never default to
    // 'parent1' — that was the "everyone shows as Primary Parent"
    // bug. Unknown → 'viewer' so the label reads "Viewer" and
    // callers can choose to hide it if they want.
    const liveRole: string = String(
      (member as any)?.role || (entry as any).loggedByRole || 'viewer',
    ).toLowerCase();

    // Relationship: prefer LIVE `relationship` (Mother/Father/etc.),
    // which is what `getMemberDisplayLabel` produces.
    const liveRelationship: string =
      String((member as any)?.relationship || '').trim();

    // The canonical human label — "Mother", "Father", "Guardian",
    // "Primary Parent", "Co-Parent", "Viewer", or "Family Member".
    const label: string = getMemberDisplayLabel({
      role: liveRole,
      relationship: liveRelationship,
    });

    // Display name: prefer LIVE `fullName` (handles rename); fall
    // back to the historical `loggedByName` only if the member is
    // gone.
    const liveName: string =
      String((member as any)?.fullName || '').trim() ||
      rawByName ||
      'You';

    const liveAvatar: string =
      String((member as any)?.avatar || '').trim();

    return {
      name: liveName,
      role: liveRole,
      relationship: liveRelationship,
      label,
      avatar: liveAvatar,
      member,
    };
  }, [entry, members]);

  // Color for the audit avatar + role pill — derived from the LIVE
  // role, not the historical snapshot.
  const roleMeta = useMemo(() => {
    return (
      ROLE_META[loggedByDisplay.role] || {
        label: loggedByDisplay.label,
        color: accent,
      }
    );
  }, [loggedByDisplay.role, loggedByDisplay.label, accent]);

  /* Handlers */
  const handleShare = useCallback(async () => {
    if (!shareText) return;
    triggerHaptic('light');
    try { await Share.share({ message: shareText }); } catch {}
  }, [shareText, triggerHaptic]);

  const handleEdit = useCallback(() => {
    if (!entry) return;
    triggerHaptic('light');
    navigation.navigate('AddEntry', { editMode: true, eventId: entry.id, trackerId: entry.trackerId });
  }, [entry, navigation, triggerHaptic]);

  const handleDuplicate = useCallback(async () => {
    if (!entry) return;
    if (typeof addEntry !== 'function') {
      if (__DEV__) console.warn('[EntryDetail] addEntry unavailable — cannot duplicate');
      return;
    }
    triggerHaptic('medium');
    const copy = await addEntry(entry.trackerId, { ...(entry.data as Record<string, unknown>) }, {
      title: entry.title,
      notes: entry.notes,
      photoUris: entry.photoUris,
      tags: entry.tags,
    });
    if (copy) {
      triggerHaptic('success');
      success('Duplicated', 'A copy was logged with the current time.');
    }
  }, [entry, addEntry, success, triggerHaptic]);

  const handleDelete = useCallback(() => {
    if (!entry) return;
    if (typeof deleteEntry !== 'function') {
      if (__DEV__) console.warn('[EntryDetail] deleteEntry unavailable');
      return;
    }
    triggerHaptic('warning');
    confirm(
      'Delete Entry',
      `Delete "${entry.title || 'this entry'}"? This cannot be undone.`,
      async () => {
        const ok = await deleteEntry(entry.id);
        if (ok) {
          triggerHaptic('success');
          success('Deleted', 'Entry removed');
          navigation.goBack();
        }
      },
      () => triggerHaptic('light'),
      'Delete',
      'Cancel'
    );
  }, [entry, confirm, deleteEntry, navigation, success, triggerHaptic]);

  const openEntry = useCallback((e: any) => {
    triggerHaptic('light');
    navigation.push('EntryDetail', { entryId: e.id, trackerId: e.trackerId });
  }, [navigation, triggerHaptic]);

  const computedStats = useMemo(() => {
    if (!entry) return { entryNumber: 0, totalInTracker: 0, sameDayCount: 0, sincePrev: null, avgGap: null };
    const trackerEntries = safeEntries.filter((e: any) => e?.trackerId === entry.trackerId).sort((a: any, b: any) => a.timestamp - b.timestamp);
    const entryIndex = trackerEntries.findIndex((e: any) => e.id === entry.id);
    const prevEntry = entryIndex > 0 ? trackerEntries[entryIndex - 1] : null;
    const sameDay = safeEntries.filter((e: any) => e && e.id !== entry.id && isSameDay(new Date(e.timestamp), new Date(entry.timestamp)));
    const gapMs = prevEntry ? entry.timestamp - prevEntry.timestamp : null;
    const avgGapMs = trackerEntries.length >= 2
      ? trackerEntries.reduce((sum: number, e: any, i: number) => {
          if (i === 0) return sum;
          return sum + (e.timestamp - trackerEntries[i - 1].timestamp);
        }, 0) / (trackerEntries.length - 1)
      : null;
    const fmtGap = (ms: number): string => {
      const mins = Math.round(ms / 60000);
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
      const d = Math.floor(h / 24);
      return `${d}d`;
    };
    return {
      entryNumber: entryIndex + 1,
      totalInTracker: trackerEntries.length,
      sameDayCount: sameDay.length,
      sincePrev: gapMs ? fmtGap(gapMs) : null,
      avgGap: avgGapMs ? fmtGap(avgGapMs) : null,
    };
  }, [entry, safeEntries]);

  const topRibbon = useMemo(() => {
    if (!entry) {
      return { icon: 'alert-circle-outline' as const, color: DS.danger, label: 'Not found', text: 'This entry may have been deleted' };
    }
    if (ageAtLogging) {
      return { icon: 'calendar-outline' as const, color: DS.info, label: 'Age at logging', text: ageAtLogging };
    }
    if (photos.length > 0) {
      return { icon: 'images-outline' as const, color: accent, label: 'Photos', text: `${photos.length} photo${photos.length === 1 ? '' : 's'} attached`, onPress: () => setViewerIndex(0) };
    }
    return { icon: 'sparkles-outline' as const, color: accent, label: 'Entry', text: `${stats.entryNumber} of ${stats.totalInTracker} ${tracker?.name || 'logs'}` };
  }, [entry, ageAtLogging, photos.length, stats, tracker, accent]);

  /* Missing entry fallback */
  if (!entry || !entryDate) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? [DS.darkBg, '#12121e'] : ['#f8faff', '#eef0f5']} style={StyleSheet.absoluteFill} />
        <View style={[styles.stickyHeader, {
          paddingTop: HEADER_TOP_PADDING,
          backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
        }]}>
          <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.headerInner}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
                ENTRY
              </GradientText>
            </View>
            <View style={{ width: 38 }} />
          </View>
        </View>
        <View style={[styles.emptyState, { marginTop: HEADER_TOTAL_HEIGHT + 60, backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
            <Ionicons name="search-outline" size={40} color={isDark ? DS.gray500 : DS.gray400} />
          </View>
          <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>Entry not found</Text>
          <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            This entry may have been deleted, or it belongs to a different baby profile.
          </Text>
          <PressableScale onPress={() => navigation.goBack()} activeScale={0.97}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyBtn}>
              <Text style={{ color: DS.white, fontWeight: '800', fontSize: 14 }}>Go Back</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    );
  }

  const stats = computedStats;

  /* ─── RENDER ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark
          ? [DS.darkBg, `${accent}08`, '#0c0a09']
          : ['#f8faff', `${accent}08`, '#eef0f5']}
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
              ENTRY
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {tracker?.name || entry.trackerId} · {dayLabel}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="share-outline" size={20} color={isDark ? DS.white : DS.gray800} />
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
        <EntryPulse
          isDark={isDark}
          entry={entry}
          tracker={tracker}
          accent={accent}
          baby={baby}
          ageAtLogging={ageAtLogging}
          dayLabel={dayLabel}
          stats={stats}
          photosCount={photos.length}
          onBabyPress={() => {
            if (baby) navigation.navigate('SwitchBaby' as any, { returnTo: 'EntryDetail' });
          }}
          onSharePress={handleShare}
          onDeletePress={handleDelete}
          canDelete={canDelete}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} onPress={topRibbon.onPress} />
        </View>

        {/* Baby ribbon */}
        {baby && (
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
              <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: DS.space.md }}>
                  <SafeAvatar avatar={baby.avatar} size={44} fallbackIcon="person" borderColor={accent} borderWidth={2} animated={false} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.babyName, { color: isDark ? DS.white : DS.gray900 }]}>{baby.name}</Text>
                    {!!ageAtLogging && <Text style={[styles.babyMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>{ageAtLogging}</Text>}
                  </View>
                  {photos.length > 0 && (
                    <View style={[styles.photoCountPill, { backgroundColor: `${accent}15` }]}>
                      <Ionicons name="images-outline" size={12} color={accent} />
                      <Text style={[styles.photoCountText, { color: accent }]}>{photos.length}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Animated.View entering={FadeInUp.delay(140).springify()}>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Photos" subtitle={`${photos.length} attached`} icon="images-outline" color={accent} isDark={isDark} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
                {photos.map((uri, idx) => (
                  <PressableScale key={`${uri}-${idx}`} onPress={() => setViewerIndex(idx)} activeScale={0.94}>
                    <View style={styles.photoThumb}>
                      <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
                      {idx === 0 && photos.length > 1 && (
                        <View style={styles.photoBadge}>
                          <Text style={styles.photoBadgeText}>+{photos.length - 1}</Text>
                        </View>
                      )}
                    </View>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* Intelligence */}
        <View style={{ marginTop: DS.space.lg }}>
          <EntryIntelligencePanel entry={entry} tracker={tracker} allEntries={allEntries} accent={accent} isDark={isDark} />
        </View>

        {/* Details */}
        {detailRows.length > 0 && (
          <Animated.View entering={FadeInUp.delay(180).springify()}>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Details" subtitle={`${detailRows.length} fields`} icon="list-outline" color={accent} isDark={isDark} />
              <GlassCard isDark={isDark}>
                <View style={{ padding: DS.space.md }}>
                  {detailRows.map((r, i) => (
                    <View key={r.key} style={[
                      styles.row,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? DS.darkBorder : DS.gray200 },
                    ]}>
                      <Text style={[styles.rowLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{r.label}</Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <ValueCell value={r.value} accent={accent} isDark={isDark} />
                      </View>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </View>
          </Animated.View>
        )}

        {/* Notes */}
        {!!entry.notes && (
          <Animated.View entering={FadeInUp.delay(220).springify()}>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Notes" icon="document-text-outline" color={accent} isDark={isDark} />
              <GlassCard isDark={isDark}>
                <View style={{ padding: DS.space.md }}>
                  <Text style={[styles.notesText, { color: isDark ? DS.white : DS.gray900 }]}>{entry.notes}</Text>
                </View>
              </GlassCard>
            </View>
          </Animated.View>
        )}

        {/* Tags & Location */}
        {(tags.length > 0 || !!locationName) && (
          <Animated.View entering={FadeInUp.delay(260).springify()}>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Tags & Location" icon="pricetags-outline" color={accent} isDark={isDark} />
              <GlassCard isDark={isDark}>
                <View style={{ padding: DS.space.md }}>
                  {!!locationName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="navigate-outline" size={14} color={accent} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? DS.white : DS.gray900 }}>
                        {locationName}
                      </Text>
                    </View>
                  )}
                  {tags.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: locationName ? 10 : 0 }}>
                      {tags.map((t: string, i: number) => (
                        <View key={`${t}-${i}`} style={[styles.valueChip, { backgroundColor: `${accent}15` }]}>
                          <Text style={[styles.valueChipText, { color: accent }]}>#{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </GlassCard>
            </View>
          </Animated.View>
        )}

        {/* Audit */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Record Info" icon="shield-checkmark-outline" color={accent} isDark={isDark} />
            <GlassCard isDark={isDark}>
              <View style={{ padding: DS.space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Avatar — use the live family avatar when we
                      resolved a member; otherwise fall back to the
                      role-initial circle. */}
                  {loggedByDisplay.avatar ? (
                    <PressableScale
                      activeScale={0.94}
                      onPress={() => {
                        if (!loggedByDisplay.member) return;
                        try {
                          HAPTIC_LIGHT();
                          const targetId = resolveTargetId(loggedByDisplay.member);
                          if (targetId) {
                            navigation.navigate('EditGuardian' as any, {
                              guardianId: targetId,
                              mode:
                                loggedByDisplay.role === 'parent2'
                                  ? 'parent2'
                                  : loggedByDisplay.role === 'viewer'
                                  ? 'viewer'
                                  : 'guardian',
                              fromChat: false,
                              fromFamily: true,
                            });
                          }
                        } catch {}
                      }}
                    >
                      <SafeAvatar
                        avatar={loggedByDisplay.avatar}
                        size={42}
                        fallbackIcon="person"
                        borderColor={roleMeta.color}
                        borderWidth={2}
                        animated={false}
                      />
                    </PressableScale>
                  ) : (
                    <View style={[styles.auditAvatar, { backgroundColor: roleMeta.color }]}>
                      <Text style={styles.auditAvatarText}>
                        {loggedByDisplay.name.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.auditName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                      {/* Show "Name (Relationship)" — same idiom as
                          HomeScreen's RecentTimeline. If there's no
                          relationship, fall back to just the name. */}
                      {loggedByDisplay?.name || 'You'}
                      {!!loggedByDisplay?.label &&
                        loggedByDisplay.label !== 'Family Member' &&
                        loggedByDisplay.label !== loggedByDisplay.name && (
                          <Text style={{ color: isDark ? DS.gray400 : DS.gray500, fontWeight: '600' }}>
                            {` (${loggedByDisplay.label})`}
                          </Text>
                        )}
                    </Text>
                    <Text style={[styles.auditMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                      Logged {format(entryDate, 'MMM d, yyyy • h:mm a')}
                    </Text>
                    <View style={[styles.rolePill, { backgroundColor: `${roleMeta.color}18` }]}>
                      <Text style={[styles.rolePillText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
                    </View>
                  </View>
                </View>

                {!!entry.editedAt && (
                  <View style={styles.auditSubRow}>
                    <Ionicons name="create-outline" size={13} color={isDark ? DS.gray500 : DS.gray400} />
                    <Text style={[styles.auditSubText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                      Edited {format(new Date(entry.editedAt), 'MMM d, yyyy • h:mm a')}
                    </Text>
                  </View>
                )}

                {historyRows.length > 0 && (
                  <View style={[styles.historyWrap, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
                      activeOpacity={0.75}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        HAPTIC_LIGHT();
                        setHistoryExpanded(prev => !prev);
                      }}
                    >
                      <Ionicons name="time-outline" size={14} color={accent} />
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: isDark ? DS.white : DS.gray900 }}>
                        Edit history · {historyRows.length} previous version{historyRows.length > 1 ? 's' : ''}
                      </Text>
                      <Ionicons name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={isDark ? DS.gray500 : DS.gray400} />
                    </TouchableOpacity>
                    {historyExpanded && historyRows.map((row: any) => (
                      <View key={row.key} style={[styles.historyVersion, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <View style={[styles.historyVersionBadge, { backgroundColor: `${accent}15` }]}>
                            <Text style={[styles.historyVersionBadgeText, { color: accent }]}>v{row.version}</Text>
                          </View>
                          <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: isDark ? DS.gray400 : DS.gray500 }} numberOfLines={1}>
                            {row.editedByName} • {format(new Date(row.editedAt), 'MMM d, h:mm a')}
                          </Text>
                        </View>
                        {row.changes.length === 0 ? (
                          <Text style={{ fontSize: 11, color: isDark ? DS.gray500 : DS.gray400, fontStyle: 'italic' }}>
                            No field changes recorded
                          </Text>
                        ) : row.changes.map((c: any, i: number) => (
                          <View key={`${row.key}-${i}`} style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <Text style={{ width: 72, fontSize: 11, fontWeight: '700', color: isDark ? DS.gray500 : DS.gray400, textTransform: 'capitalize' }}>
                              {c.label}
                            </Text>
                            <Text style={{ flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16, color: isDark ? DS.gray400 : DS.gray500 }} numberOfLines={2}>
                              <Text style={{ textDecorationLine: 'line-through', color: isDark ? DS.gray600 : DS.gray400 }}>{c.before}</Text>
                              {'  →  '}
                              <Text style={{ color: isDark ? DS.white : DS.gray900, fontWeight: '600' }}>{c.after}</Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                {!!syncedLabel && (
                  <View style={styles.auditSubRow}>
                    <Ionicons name="cloud-done-outline" size={13} color={isDark ? DS.gray500 : DS.gray400} />
                    <Text style={[styles.auditSubText, { color: isDark ? DS.gray500 : DS.gray400 }]}>Synced {syncedLabel}</Text>
                  </View>
                )}
                <View style={styles.auditSubRow}>
                  <Ionicons name="finger-print-outline" size={13} color={isDark ? DS.gray500 : DS.gray400} />
                  <Text style={[styles.auditSubText, { color: isDark ? DS.gray500 : DS.gray400 }]}>ID …{entry.id.slice(-6)}</Text>
                </View>
              </View>
            </GlassCard>
          </View>
        </Animated.View>

        {/* More from this day */}
        {sameDayEntries.length > 0 && (
          <Animated.View entering={FadeInUp.delay(340).springify()}>
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title={`More from ${dayLabel}`} subtitle={`${sameDayEntries.length} entries`} icon="calendar-outline" color={accent} isDark={isDark} />
              <GlassCard isDark={isDark}>
                <View style={{ padding: DS.space.md }}>
                  {sameDayEntries.map((e: any, i: number) => {
                    const t = getTracker(e.trackerId);
                    const c = t?.gradient?.[0] || t?.color || accent;
                    return (
                      <PressableScale key={e.id} onPress={() => openEntry(e)} activeScale={0.98}>
                        <View style={[
                          styles.dayRow,
                          i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? DS.darkBorder : DS.gray200 },
                        ]}>
                          <View style={[styles.dayEmojiWrap, { backgroundColor: `${c}15` }]}>
                            <Text style={{ fontSize: 18 }}>{t?.emoji || '📋'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dayTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                              {e.title || t?.name || 'Entry'}
                            </Text>
                            <Text style={[styles.dayMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                              {format(new Date(e.timestamp), 'h:mm a')}
                              {(() => {
                                const logger =
                                  members.find((m: any) => m.userId === (e as any).loggedBy) ||
                                  members.find((m: any) => m.id === (e as any).loggedBy) ||
                                  null;
                                const displayName = logger?.fullName || e.loggedByName;
                                const displayLabel = logger
                                  ? getMemberDisplayLabel({ role: logger.role, relationship: logger.relationship })
                                  : '';
                                if (!displayName) return '';
                                return displayLabel
                                  ? ` • ${displayName} (${displayLabel})`
                                  : ` • ${displayName}`;
                              })()}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray600 : DS.gray400} />
                        </View>
                      </PressableScale>
                    );
                  })}
                  <PressableScale
                    onPress={() => navigation.navigate('Timeline')}
                    activeScale={0.97}
                  >
                    <View style={[styles.dayFooter, { borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: accent }}>Open full day in Timeline</Text>
                      <Ionicons name="arrow-forward" size={14} color={accent} />
                    </View>
                  </PressableScale>
                </View>
              </GlassCard>
            </View>
          </Animated.View>
        )}

        {/* Similar */}
        <View style={{ marginTop: DS.space.lg }}>
          <SimilarEntriesPanel entry={entry} allEntries={allEntries} getTracker={getTracker} onOpenEntry={openEntry} isDark={isDark} accent={accent} />
        </View>

        {/* Prev / Next */}
        {(trackerHistory.prev || trackerHistory.next) && (
          <Animated.View entering={FadeInUp.delay(380).springify()}>
            <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {trackerHistory.prev ? (
                  <PressableScale onPress={() => openEntry(trackerHistory.prev!)} activeScale={0.97} style={{ flex: 1 }}>
                    <View style={[styles.prevNextBtn, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="chevron-back" size={12} color={isDark ? DS.gray500 : DS.gray400} />
                        <Text style={[styles.prevNextLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Older</Text>
                      </View>
                      <Text style={[styles.prevNextTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                        {trackerHistory.prev.title || 'Entry'}
                      </Text>
                      <Text style={[styles.dayMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                        {format(new Date(trackerHistory.prev.timestamp), 'MMM d, h:mm a')}
                      </Text>
                    </View>
                  </PressableScale>
                ) : <View style={{ flex: 1 }} />}
                {trackerHistory.next ? (
                  <PressableScale onPress={() => openEntry(trackerHistory.next!)} activeScale={0.97} style={{ flex: 1 }}>
                    <View style={[styles.prevNextBtn, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, alignItems: 'flex-end' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.prevNextLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Newer</Text>
                        <Ionicons name="chevron-forward" size={12} color={isDark ? DS.gray500 : DS.gray400} />
                      </View>
                      <Text style={[styles.prevNextTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                        {trackerHistory.next.title || 'Entry'}
                      </Text>
                      <Text style={[styles.dayMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                        {format(new Date(trackerHistory.next.timestamp), 'MMM d, h:mm a')}
                      </Text>
                    </View>
                  </PressableScale>
                ) : <View style={{ flex: 1 }} />}
              </View>
              {trackerHistory.total > 0 && (
                <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '600', marginTop: 10, color: isDark ? DS.gray500 : DS.gray400 }}>
                  Entry {trackerHistory.index + 1} of {trackerHistory.total} in {tracker?.name || entry.trackerId}
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* Action bar */}
        {(canEdit || canDuplicate || canDelete) && (
          <Animated.View entering={FadeInUp.delay(420).springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {canEdit && (
                <PressableScale onPress={handleEdit} activeScale={0.97} style={{ flex: 1.4 }}>
                  <LinearGradient colors={heroColors} style={styles.actionPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="create-outline" size={17} color={DS.white} />
                    <Text style={styles.actionPrimaryText}>Edit</Text>
                  </LinearGradient>
                </PressableScale>
              )}
              {canDuplicate && (
                <PressableScale onPress={handleDuplicate} activeScale={0.97} style={{ flex: 1 }}>
                  <View style={[styles.actionSecondary, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <Ionicons name="copy-outline" size={16} color={accent} />
                    <Text style={[styles.actionSecondaryText, { color: accent }]}>Duplicate</Text>
                  </View>
                </PressableScale>
              )}
              {canDelete && (
                <PressableScale onPress={handleDelete} activeScale={0.97} style={{ flex: 1 }}>
                  <View style={[styles.actionSecondary, { backgroundColor: `${DS.danger}08`, borderColor: `${DS.danger}25` }]}>
                    <Ionicons name="trash-outline" size={16} color={DS.danger} />
                    <Text style={[styles.actionSecondaryText, { color: DS.danger }]}>Delete</Text>
                  </View>
                </PressableScale>
              )}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Fullscreen viewer */}
      <Modal visible={viewerIndex !== null} animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewerContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * SCREEN_W, y: 0 }}
            onMomentumScrollEnd={(e) => setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          >
            {photos.map((uri, idx) => (
              <View key={`viewer-${uri}-${idx}`} style={{ width: SCREEN_W, flex: 1, justifyContent: 'center' }}>
                <Image source={{ uri }} style={{ width: SCREEN_W, height: '80%' }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewerIndex(null)}>
            <Ionicons name="close" size={22} color={DS.white} />
          </TouchableOpacity>
          {photos.length > 1 && (
            <View style={[styles.viewerCounter, { top: insets.top + 20 }]}>
              <Text style={styles.viewerCounterText}>{(viewerIndex ?? 0) + 1} / {photos.length}</Text>
            </View>
          )}
        </View>
      </Modal>
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
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2, maxWidth: 200 },

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
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33 },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  pulseTrackerPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, maxWidth: '50%' },
  pulseTrackerText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseStats: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg, marginTop: DS.space.md,
  },
  pulseStat: { alignItems: 'center', flex: 1 },
  pulseStatVal: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  pulseStatLbl: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  pulseStatDiv: { width: 1, height: 22 },
  pulsePhotosPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: DS.space.sm,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  pulsePhotosText: { fontSize: 10, fontWeight: '700' },

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

  /* Card */
  card: {
    borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden',
    ...DS.shadow.sm,
  },
  glassCard: {
    marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg,
    borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm,
  },
  glassContent: { flex: 1 },

  /* Baby ribbon */
  babyName: { fontSize: 14, fontWeight: '800' },
  babyMeta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  photoCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  photoCountText: { fontSize: 11, fontWeight: '800' },

  /* Photos */
  photoThumb: { width: 110, height: 110, borderRadius: DS.radius.md, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute', right: 6, bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  photoBadgeText: { color: DS.white, fontSize: 10, fontWeight: '800' },

  /* Intelligence */
  intelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  intelTile: {
    width: (SCREEN_W - 32 - 40 - 12) / 2,
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: DS.radius.sm, gap: 4,
  },
  intelIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  intelValue: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  intelLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  trendRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4,
  },
  trendLabel: { fontSize: 13, fontWeight: '700' },
  trendSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendBadgeText: { fontSize: 12, fontWeight: '700' },

  /* Details rows */
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  rowLabel: { fontSize: 12, fontWeight: '600', width: 118 },
  rowValue: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  boolPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  boolPillText: { fontSize: 12, fontWeight: '800' },
  valueChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  valueChipText: { fontSize: 12, fontWeight: '700' },

  /* Notes */
  notesText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },

  /* Audit */
  auditAvatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  auditAvatarText: { color: DS.white, fontSize: 16, fontWeight: '800' },
  auditName: { fontSize: 14, fontWeight: '800' },
  auditMeta: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start', marginTop: 4 },
  rolePillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  auditSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  auditSubText: { fontSize: 11, fontWeight: '600' },

  /* History */
  historyWrap: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  historyVersion: { marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: DS.radius.sm, padding: 10 },
  historyVersionBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  historyVersionBadgeText: { fontSize: 10, fontWeight: '800' },

  /* Day rows */
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dayEmojiWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayTitle: { fontSize: 13, fontWeight: '700' },
  dayMeta: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  dayFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4,
  },

  /* Prev/Next */
  prevNextBtn: { flex: 1, borderWidth: 1, padding: 12, borderRadius: DS.radius.md },
  prevNextLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  prevNextTitle: { fontSize: 13, fontWeight: '700', marginTop: 3 },

  /* Similar */
  similarIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  similarTitle: { fontSize: 13, fontWeight: '700' },
  similarMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  similarValueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  similarValueText: { fontSize: 11, fontWeight: '800' },

  /* Actions */
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: DS.radius.md, ...DS.shadow.md,
  },
  actionPrimaryText: { color: DS.white, fontSize: 14, fontWeight: '800' },
  actionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: DS.radius.md, borderWidth: 1,
  },
  actionSecondaryText: { fontSize: 13, fontWeight: '800' },

  /* Empty */
  emptyState: {
    marginHorizontal: DS.space.lg, paddingVertical: DS.space['3xl'], paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center',
  },
  emptyIcon: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },

  /* Viewer */
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerClose: {
    position: 'absolute', right: 20, width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  viewerCounter: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  viewerCounterText: { color: DS.white, fontSize: 13, fontWeight: '800' },
});