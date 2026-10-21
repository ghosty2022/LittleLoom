import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Image,
  UIManager,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import {
  differenceInMinutes,
  startOfDay,
  endOfDay,
  subDays,
  isToday,
  isYesterday,
  format,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDateTimePicker } from '../../hooks/useDateTimePicker';
import { isFieldVisible } from '../../utils/form';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks';
import { useBaby } from '../../context/BabyContext';
import { UnifiedTrackerConfig } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { TimelinePicker } from '../../components/trackers/TimelinePicker';
import { DynamicTrackerForm } from '../../components/trackers/DynamicTrackerForm';
import { TrackerEntryCard } from '../../components/trackers/TrackerEntryCard';
import { useTrackerProgressive } from '../../hooks/useTrackerProgressive';
import { useAnomalyFeedback } from '../../hooks/useAnomalyFeedback';
import type { ProgressiveCorrelation } from '../../hooks/useTrackerProgressive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = 52;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (Platform.OS === 'android' && !IS_FABRIC && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
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

type AddEntryRouteProp = RouteProp<RootStackParamList, 'AddEntry'>;
type AddEntryNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface YesterdayEntry {
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
  notes?: string;
  tags?: string[];
  title?: string;
  photoUris?: string[];
}
interface QuickTemplate {
  id: string;
  label: string;
  icon: string;
  data: Record<string, unknown>;
  color: string;
}
interface SmartSuggestion {
  id: string;
  fieldId: string;
  label: string;
  value: unknown;
  confidence: number;
  reason: string;
}
interface ContextInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'tip' | 'trend';
  message: string;
  emoji: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
}

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const cleanImageUris = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const flat = (raw as unknown[]).flat(Infinity);
  const strings = flat
    .map((u) => {
      if (typeof u === 'string') return u;
      if (u && typeof u === 'object' && typeof (u as any).uri === 'string') return (u as any).uri as string;
      return '';
    })
    .filter((u): u is string => u.length > 0);
  return [...new Set(strings)];
};

const formatFieldValue = (key: string, value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? null : value.map(String).join(', ');
  if (typeof value === 'object') {
    const o = value as any;
    if (o?.name) return String(o.name);
    if (o?.label) return String(o.label);
    return JSON.stringify(value);
  }
  return String(value);
};

const getEntryFields = (entry: YesterdayEntry) => {
  return Object.entries(entry.data || {}).filter(([k, v]) => {
    if (['id', 'timestamp', 'babyId', 'type', 'title', 'icon', 'photoUris'].includes(k)) return false;
    return formatFieldValue(k, v) !== null;
  });
};

const shouldFilterField = (k: string) =>
  ['id', 'timestamp', 'babyId', 'type', 'title', 'icon', 'photoUris'].includes(k);

const prettifyFieldKey = (k: string) =>
  k.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\w/, (c) => c.toUpperCase());

const formatDuration = (seconds: unknown): string => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText + PressableScale
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

/* ═══════════════════════════════════════════════════════════════════════════
   SectionHeader
   ═══════════════════════════════════════════════════════════════════════════ */
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
   Context Pulse Header — replaces SmartContextHeader
   ═══════════════════════════════════════════════════════════════════════════ */
const ContextPulse = memo(({
  isDark, tracker, baby, entriesToday, lastEntryTime, onBabyPress,
}: {
  isDark: boolean;
  tracker: UnifiedTrackerConfig;
  baby: any;
  entriesToday: number;
  lastEntryTime: Date | null;
  onBabyPress: () => void;
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

  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const timeIcon = hour < 12 ? 'sunny-outline' : hour < 17 ? 'partly-sunny-outline' : 'moon-outline';
  const timeSinceLast = lastEntryTime ? differenceInMinutes(new Date(), lastEntryTime) : null;
  const timeSinceText = timeSinceLast !== null
    ? timeSinceLast < 60
      ? `${timeSinceLast}m ago`
      : timeSinceLast < 1440
      ? `${Math.floor(timeSinceLast / 60)}h ago`
      : `${Math.floor(timeSinceLast / 1440)}d ago`
    : 'No entries yet';

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? [`${tracker.gradient[0]}25`, `${tracker.gradient[1]}10`, 'rgba(139,92,246,0.04)']
            : [`${tracker.gradient[0]}12`, `${tracker.gradient[1]}06`, 'rgba(255,255,255,0.4)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${tracker.gradient[0]}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${tracker.gradient[1]}${isDark ? '35' : '22'}`, 'transparent']}
          style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, { backgroundColor: `${tracker.gradient[0]}35` }, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient
                  colors={[tracker.gradient[0], tracker.gradient[1], DS.warning, tracker.gradient[0]]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                <SafeAvatar avatar={baby?.avatar} gender={baby?.gender} size={44} fallbackIcon="happy-outline" fallbackColor={tracker.gradient[0]} />
              </View>
            </View>
          </PressableScale>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {baby?.name || 'Baby'}
              </Text>
              <View style={[styles.pulseAgePill, { backgroundColor: `${tracker.gradient[0]}18` }]}>
                <Ionicons name={timeIcon as any} size={10} color={tracker.gradient[0]} />
                <Text style={[styles.pulseAgeText, { color: tracker.gradient[0] }]}>{timeLabel}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 13 }}>{tracker.emoji}</Text>
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {tracker.name} · {entriesToday} today
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="time-outline" size={14} color={isDark ? DS.gray300 : DS.gray600} />
            </View>
            <Text style={[styles.pulseLastText, { color: isDark ? DS.gray500 : DS.gray400 }]}>{timeSinceText}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Ribbon (for learning mode, urgent, etc.)
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
   Quick Templates
   ═══════════════════════════════════════════════════════════════════════════ */
const QuickTemplates = memo(({ templates, onSelect, isDark }: { templates: QuickTemplate[]; onSelect: (t: QuickTemplate) => void; isDark: boolean }) => {
  if (!templates.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Quick Templates" subtitle="Tap to prefill" icon="flash-outline" color={DS.warning} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {templates.map(t => (
          <PressableScale key={t.id} onPress={() => onSelect(t)} activeScale={0.94}>
            <View style={[styles.chip, { backgroundColor: `${t.color}12`, borderColor: `${t.color}30` }]}>
              <Text style={{ fontSize: 18 }}>{t.icon}</Text>
              <Text style={[styles.chipText, { color: isDark ? DS.gray200 : DS.gray800 }]}>{t.label}</Text>
              <Ionicons name="flash" size={12} color={t.color} />
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Suggestions
   ═══════════════════════════════════════════════════════════════════════════ */
const SmartSuggestions = memo(({
  suggestions, applied, onApply, onDismiss, primaryColor, isDark,
}: {
  suggestions: SmartSuggestion[];
  applied: Set<string>;
  onApply: (s: SmartSuggestion) => void;
  onDismiss: (id: string) => void;
  primaryColor: string;
  isDark: boolean;
}) => {
  const visible = suggestions.filter(s => !applied.has(s.id) && s.confidence >= 60);
  if (!visible.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(140).springify()}>
      <SectionHeader title="Smart Suggestions" icon="sparkles-outline" color={primaryColor} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {visible.map(s => {
          const confColor = s.confidence >= 90 ? DS.success : s.confidence >= 75 ? DS.warning : DS.danger;
          return (
            <PressableScale key={s.id} onPress={() => onApply(s)} activeScale={0.94}>
              <View style={[styles.suggChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.white, borderColor: `${primaryColor}25` }]}>
                <View style={[styles.suggDot, { backgroundColor: confColor }]} />
                <Text style={[styles.suggLabel, { color: isDark ? DS.gray200 : DS.gray800 }]}>{s.label}</Text>
                <Text style={[styles.suggValue, { color: isDark ? DS.gray400 : DS.gray500 }]}>{String(s.value)}</Text>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDismiss(s.id); }} style={{ padding: 2 }}>
                  <Ionicons name="close" size={13} color={isDark ? DS.gray500 : DS.gray400} />
                </TouchableOpacity>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Time Wheel
   ═══════════════════════════════════════════════════════════════════════════ */
const TimeWheel = memo(({
  date, onDateChange, onTimeChange, trackerColor, isDark,
}: {
  date: Date; onDateChange: () => void; onTimeChange: (d: Date) => void; trackerColor: string; isDark: boolean;
}) => {
  const blocks = useMemo(() => {
    const out: { label: string; time: string; period: string; isSuggested: boolean }[] = [];
    for (let h = 6; h <= 22; h += 2) {
      const d = new Date(date);
      d.setHours(h, 0, 0, 0);
      out.push({
        label: h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening',
        time: format(d, 'h:mm a'),
        period: h < 12 ? 'AM' : 'PM',
        isSuggested: Math.abs(d.getHours() - date.getHours()) <= 1,
      });
    }
    return out;
  }, [date]);

  const isTodayDate = isToday(date);
  const isYesterdayDate = isYesterday(date);

  return (
    <Animated.View entering={FadeInUp.delay(180).springify()}>
      <SectionHeader title="When" icon="time-outline" color={trackerColor} />
      <View style={{ flexDirection: 'row', paddingHorizontal: DS.space.lg, gap: 10, marginBottom: DS.space.md }}>
        <PressableScale onPress={onDateChange} activeScale={0.97} style={{ flex: 1 }}>
          <View style={[styles.dateChip, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Ionicons name="calendar-outline" size={15} color={trackerColor} />
            <Text style={[styles.dateChipText, { color: isDark ? DS.white : DS.gray900 }]}>
              {isTodayDate ? 'Today' : isYesterdayDate ? 'Yesterday' : format(date, 'EEE, MMM d')}
            </Text>
            <Ionicons name="chevron-forward" size={13} color={isDark ? DS.gray500 : DS.gray400} />
          </View>
        </PressableScale>
        <PressableScale onPress={onDateChange} activeScale={0.97}>
          <View style={[styles.timeChip, { backgroundColor: `${trackerColor}15` }]}>
            <Ionicons name="time-outline" size={15} color={trackerColor} />
            <Text style={[styles.timeChipText, { color: trackerColor }]}>{format(date, 'h:mm a')}</Text>
          </View>
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
        {blocks.map((b, i) => (
          <PressableScale key={i} onPress={() => {
            const newD = new Date(date);
            const hourPart = parseInt(b.time.split(':')[0]);
            const isPM = b.period === 'PM' && hourPart !== 12;
            const isAM = b.period === 'AM' && hourPart === 12;
            const h = isPM ? hourPart + 12 : isAM ? 0 : hourPart;
            newD.setHours(h, 0, 0, 0);
            onTimeChange(newD);
          }} activeScale={0.94}>
            <View style={[styles.timeBlock, {
              backgroundColor: b.isSuggested ? `${trackerColor}15` : isDark ? DS.darkCard : DS.white,
              borderColor: b.isSuggested ? `${trackerColor}45` : isDark ? DS.darkBorder : DS.gray200,
            }]}>
              <Text style={[styles.timeBlockLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{b.label}</Text>
              <Text style={[styles.timeBlockTime, { color: b.isSuggested ? trackerColor : isDark ? DS.white : DS.gray900 }]}>{b.time}</Text>
              {b.isSuggested && (
                <View style={[styles.nowBadge, { backgroundColor: trackerColor }]}>
                  <Text style={styles.nowBadgeText}>NOW</Text>
                </View>
              )}
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Context Insights Strip
   ═══════════════════════════════════════════════════════════════════════════ */
const InsightsStrip = memo(({ insights, isDark }: { insights: ContextInsight[]; isDark: boolean }) => {
  if (!insights.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(220).springify()}>
      <SectionHeader title="Context Insights" icon="analytics-outline" color={DS.info} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {insights.map(i => (
          <View key={i.id} style={[styles.insightCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, borderLeftColor: i.color }]}>
            <LinearGradient colors={[`${i.color}10`, `${i.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Text style={{ fontSize: 20 }}>{i.emoji}</Text>
            <Text style={[styles.insightMsg, { color: isDark ? DS.gray200 : DS.gray800 }]} numberOfLines={2}>{i.message}</Text>
            <View style={[styles.insightPriority, { backgroundColor: `${i.color}18` }]}>
              <Text style={[styles.insightPriorityText, { color: i.color }]}>{i.priority}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Streak Ring
   ═══════════════════════════════════════════════════════════════════════════ */
const StreakRing = memo(({
  streak, isAtRisk, entriesToday, dailyGoal, trackerColor, isDark, onLogNow,
}: {
  streak: any; isAtRisk: boolean; entriesToday: number; dailyGoal: number; trackerColor: string;
  isDark: boolean; onLogNow: () => void;
}) => {
  if (!streak || streak.currentStreak === 0) return null;
  const progress = Math.min(entriesToday / dailyGoal, 1);
  return (
    <Animated.View entering={FadeInUp.delay(260).springify()}>
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.lg }}>
          <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
            <View style={[styles.ringOuter, { borderColor: `${trackerColor}20` }]} />
            <View style={[styles.ringInner, {
              borderColor: isAtRisk ? DS.danger : trackerColor,
              borderTopColor: 'transparent',
              transform: [{ rotate: `${-90 + progress * 360}deg` }],
            }]} />
            <View style={{ alignItems: 'center', position: 'absolute' }}>
              <Text style={[styles.ringValue, { color: isAtRisk ? DS.danger : trackerColor }]}>{entriesToday}</Text>
              <Text style={[styles.ringLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>of {dailyGoal}</Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={isAtRisk ? 'flame-outline' : 'flame'} size={20} color={isAtRisk ? DS.danger : trackerColor} />
              <Text style={[styles.streakText, { color: isAtRisk ? DS.danger : trackerColor }]}>
                {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={[styles.streakMsg, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
              {isAtRisk
                ? `Log in the next few hours to keep your streak`
                : `You're on a roll! Keep logging consistently.`}
            </Text>
            {isAtRisk && (
              <PressableScale onPress={onLogNow} activeScale={0.94}>
                <LinearGradient colors={[DS.danger, DS.danger + 'CC']} style={styles.streakBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.streakBtnText}>Log Now</Text>
                </LinearGradient>
              </PressableScale>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Yesterday Strip
   ═══════════════════════════════════════════════════════════════════════════ */
const YesterdayStrip = memo(({
  entries, trackerColor, isDark, onCopy, onViewAll,
}: {
  entries: YesterdayEntry[]; trackerColor: string; isDark: boolean;
  onCopy: (e: YesterdayEntry) => void; onViewAll: () => void;
}) => {
  if (!entries.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
          <View style={[styles.sectionIcon, { backgroundColor: `${trackerColor}18` }]}>
            <Ionicons name="calendar-outline" size={16} color={trackerColor} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Yesterday</Text>
            <Text style={styles.sectionSub}>{entries.length} record{entries.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onViewAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={[styles.sectionActionText, { color: trackerColor }]}>View All</Text>
          <Ionicons name="chevron-forward" size={13} color={trackerColor} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {entries.map(e => {
          const fields = getEntryFields(e);
          const entryDate = new Date(e.timestamp);
          return (
            <PressableScale key={e.id} onPress={() => onCopy(e)} activeScale={0.94}>
              <View style={[styles.yestCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={[styles.yestTime, { backgroundColor: `${trackerColor}15` }]}>
                    <Ionicons name="time-outline" size={11} color={trackerColor} />
                    <Text style={[styles.yestTimeText, { color: trackerColor }]}>{format(entryDate, 'h:mm a')}</Text>
                  </View>
                  <Ionicons name="copy-outline" size={14} color={isDark ? DS.gray500 : DS.gray400} />
                </View>
                {fields.slice(0, 2).map(([key, value]) => (
                  <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[styles.yestFieldLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{prettifyFieldKey(key)}</Text>
                    <Text style={[styles.yestFieldValue, { color: isDark ? DS.gray200 : DS.gray800 }]} numberOfLines={1}>{formatFieldValue(key, value)}</Text>
                  </View>
                ))}
                {fields.length > 2 && (
                  <Text style={[styles.yestMore, { color: isDark ? DS.gray500 : DS.gray400 }]}>+{fields.length - 2} more</Text>
                )}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Confirm Modal
   ═══════════════════════════════════════════════════════════════════════════ */
interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: Record<string, unknown>;
  tracker: UnifiedTrackerConfig;
  babyName: string;
  babyAvatar?: string;
  date: Date;
  notes?: string;
  tags: string[];
  photoUris?: string[];
}

const ConfirmModal = memo<ConfirmModalProps>(({
  visible, onClose, onConfirm, data, tracker, babyName, babyAvatar, date, notes, tags, photoUris = [],
}) => {
  const { isDark } = useCustomization();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); opacity.value = withTiming(1, { duration: 250 }); }
    else { scale.value = withTiming(0.9, { duration: 200 }); opacity.value = withTiming(0, { duration: 200 }); }
  }, [visible]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  const preview = useMemo(
    () => Object.entries(data).filter(([k, v]) => !shouldFilterField(k) && formatFieldValue(k, v) !== null),
    [data],
  );
  const uris = useMemo(() => cleanImageUris(photoUris.length ? photoUris : (data as any)?.photoUris), [photoUris, data]);

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Animated.View style={[styles.confirmCard, anim, { backgroundColor: isDark ? DS.darkCard : DS.white }]} onStartShouldSetResponder={() => true}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <LinearGradient colors={tracker.gradient} style={styles.confirmIcon}>
              <Text style={{ fontSize: 28 }}>{tracker.emoji}</Text>
            </LinearGradient>
            <Text style={[styles.confirmTitle, { color: isDark ? DS.white : DS.gray900 }]}>Confirm {tracker.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <SafeAvatar avatar={babyAvatar} size={22} fallbackIcon="person" borderWidth={0} />
              <Text style={[styles.confirmSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>For {babyName}</Text>
            </View>
          </View>
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.confirmPreview, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <Text style={[styles.confirmTime, { color: isDark ? DS.gray400 : DS.gray500 }]}>{format(date, 'MMM d, yyyy • h:mm a')}</Text>
              {uris.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }} contentContainerStyle={{ gap: 8 }}>
                  {uris.map((u, i) => <Image key={i} source={{ uri: u }} style={styles.confirmPhoto} resizeMode="cover" />)}
                </ScrollView>
              )}
              <Text style={[styles.confirmPreviewTitle, { color: isDark ? DS.white : DS.gray900 }]}>{tracker.emoji} {tracker.name}</Text>
              {notes ? <Text style={[styles.confirmNotes, { color: isDark ? DS.gray400 : DS.gray500 }]}>{notes}</Text> : null}
              {preview.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {preview.map(([k, v]) => (
                    <View key={k} style={[styles.confirmRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <Text style={[styles.confirmRowLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{prettifyFieldKey(k)}</Text>
                      <Text style={[styles.confirmRowValue, { color: isDark ? DS.gray200 : DS.gray800 }]}>{formatFieldValue(k, v)}</Text>
                    </View>
                  ))}
                </View>
              )}
              {tags.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? DS.darkBorder : DS.gray200 }}>
                  <Ionicons name="pricetag-outline" size={14} color={isDark ? DS.gray500 : DS.gray400} />
                  <Text style={[styles.confirmTags, { color: isDark ? DS.gray400 : DS.gray500 }]}>{tags.join(', ')}</Text>
                </View>
              )}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <PressableScale onPress={onClose} activeScale={0.96} style={{ flex: 1 }}>
              <View style={[styles.confirmCancel, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Text style={[styles.confirmCancelText, { color: isDark ? DS.gray300 : DS.gray600 }]}>Edit</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => { HAPTIC_SUCCESS(); onConfirm(); }} activeScale={0.96} style={{ flex: 2 }}>
              <LinearGradient colors={tracker.gradient} style={styles.confirmSave} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="checkmark-circle" size={18} color={DS.white} />
                <Text style={styles.confirmSaveText}>Save Entry</Text>
              </LinearGradient>
            </PressableScale>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Yesterday Entries Modal
   ═══════════════════════════════════════════════════════════════════════════ */
const YesterdayModal = memo(({
  visible, onClose, entries, tracker, onCopy, isDark,
}: {
  visible: boolean; onClose: () => void; entries: YesterdayEntry[];
  tracker: UnifiedTrackerConfig; onCopy: (e: YesterdayEntry) => void; isDark: boolean;
}) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); opacity.value = withTiming(1, { duration: 250 }); }
    else { scale.value = withTiming(0.9); opacity.value = withTiming(0); }
  }, [visible]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Animated.View style={[styles.yestModalCard, anim, { backgroundColor: isDark ? DS.darkCard : DS.white }]} onStartShouldSetResponder={() => true}>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <LinearGradient colors={tracker.gradient} style={styles.yestModalIcon}>
              <Ionicons name="calendar-outline" size={26} color={DS.white} />
            </LinearGradient>
            <Text style={[styles.confirmTitle, { color: isDark ? DS.white : DS.gray900 }]}>Yesterday's {tracker.name}</Text>
            <Text style={[styles.confirmSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {entries.length} record{entries.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 14, right: 14, padding: 6 }}>
              <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
            {entries.map((e, idx) => {
              const fields = getEntryFields(e);
              const entryDate = new Date(e.timestamp);
              const ePhotos = cleanImageUris((e as any)?.photoUris);
              return (
                <Animated.View key={e.id} entering={FadeInUp.delay(idx * 50).springify()}>
                  <View style={[styles.yestModalEntry, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={[styles.yestTime, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                        <Ionicons name="time-outline" size={12} color={tracker.gradient[0]} />
                        <Text style={[styles.yestTimeText, { color: tracker.gradient[0] }]}>{format(entryDate, 'h:mm a')}</Text>
                      </View>
                      {e.title && <Text style={[styles.yestModalTitle, { color: isDark ? DS.gray200 : DS.gray800 }]} numberOfLines={1}>{e.title}</Text>}
                    </View>
                    {fields.map(([k, v]) => (
                      <View key={k} style={[styles.confirmRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                        <Text style={[styles.confirmRowLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{prettifyFieldKey(k)}</Text>
                        <Text style={[styles.confirmRowValue, { color: isDark ? DS.gray200 : DS.gray800 }]}>{formatFieldValue(k, v)}</Text>
                      </View>
                    ))}
                    {e.notes && (
                      <Text style={{ fontSize: 12, fontStyle: 'italic', color: isDark ? DS.gray400 : DS.gray500, marginTop: 8 }}>{e.notes}</Text>
                    )}
                    {ePhotos.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
                        {ePhotos.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 48, height: 48, borderRadius: 8 }} />)}
                      </ScrollView>
                    )}
                    <PressableScale onPress={() => { HAPTIC_MEDIUM(); onCopy(e); onClose(); }} activeScale={0.94}>
                      <LinearGradient colors={tracker.gradient} style={styles.yestCopyBtn}>
                        <Ionicons name="copy-outline" size={14} color={DS.white} />
                        <Text style={styles.yestCopyText}>Copy to Today</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                </Animated.View>
              );
            })}
          </ScrollView>
          <PressableScale onPress={onClose} activeScale={0.97} style={{ margin: 16 }}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.yestDoneBtn}>
              <Text style={styles.yestDoneText}>Close</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TrackerContent
   ═══════════════════════════════════════════════════════════════════════════ */
function TrackerContent({
  tracker, selectedTrackerId, date, setDate, pendingData, setPendingData, pendingOptions, setPendingOptions,
  showConfirm, setShowConfirm, showYesterdayModal, setShowYesterdayModal,
  yesterdayEntries, setYesterdayEntries, errors, setErrors,
  dismissedCorrelations, setDismissedCorrelations, dismissedReminders, setDismissedReminders,
  appliedCorrelationPrefill, setAppliedCorrelationPrefill, appliedSuggestions, setAppliedSuggestions,
  editEntryId, navigation, setShowPicker,
}: any) {
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const { fullThemeColors, isDark, borderRadiusValue, fontSizeMultiplier, shouldReduceMotion } = useCustomization();
  const { success, error } = useSweetAlert();
  const { getEntries, addEntry } = useTracker();
  const { currentBaby } = useBaby();
  const insets = useSafeAreaInsets();

  const datePicker = useDateTimePicker();
  const [anomalyWarning, setAnomalyWarning] = useState<string | null>(null);
  const [anomalyMetric, setAnomalyMetric] = useState<string | null>(null);
  const [anomalyValue, setAnomalyValue] = useState<number | null>(null);
  const [anomalyZ, setAnomalyZ] = useState<number | null>(null);

  const anomalyFeedback = useAnomalyFeedback();
  const progressive = useTrackerProgressive(selectedTrackerId || '');
  const {
    prefillData, suggestions, streak, isAtRisk, hoursUntilBreak, streakMessage,
    insights, correlations, activeReminders, hasUrgentReminders, templates, trends, timeContext, refresh: refreshProgressive,
  } = progressive;

  const recentEntries = useMemo(() => {
    if (!tracker || !currentBaby) return [];
    return getEntries(tracker.id, 3);
  }, [tracker, getEntries, currentBaby]);

  const visibleCorrelations = useMemo(() => (correlations || []).filter((c: any) => !dismissedCorrelations.has(c.id)), [correlations, dismissedCorrelations]);
  const visibleReminders = useMemo(() => (activeReminders || []).filter((r: any) => !dismissedReminders.has(r.id)), [activeReminders, dismissedReminders]);

  const entriesToday = useMemo(() => {
    if (!tracker || !currentBaby) return 0;
    const s = startOfDay(new Date()).getTime(), e = endOfDay(new Date()).getTime();
    return getEntries(tracker.id).filter((x: any) => x.timestamp >= s && x.timestamp <= e).length;
  }, [tracker, getEntries, currentBaby]);

  const lastEntryTime = useMemo(() => {
    if (!tracker || !currentBaby) return null;
    const list = getEntries(tracker.id).sort((a: any, b: any) => b.timestamp - a.timestamp);
    return list.length ? new Date(list[0].timestamp) : null;
  }, [tracker, getEntries, currentBaby]);

  const quickTemplates = useMemo((): QuickTemplate[] => {
    if (!tracker) return [];
    switch (tracker.id) {
      case 'feed': return [
        { id: 'bl', label: 'Breast L', icon: '🤱', data: { feedType: 'breast', side: 'left' }, color: '#ec4899' },
        { id: 'br', label: 'Breast R', icon: '🤱', data: { feedType: 'breast', side: 'right' }, color: '#ec4899' },
        { id: 'b4', label: 'Bottle 4oz', icon: '🍼', data: { feedType: 'bottle', bottleAmount: 4, bottleAmount_unit: 'oz' }, color: DS.primary },
        { id: 'b6', label: 'Bottle 6oz', icon: '🍼', data: { feedType: 'bottle', bottleAmount: 6, bottleAmount_unit: 'oz' }, color: DS.primary },
      ];
      case 'sleep': return [
        { id: 's30', label: 'Short Nap', icon: '😴', data: { sleepType: 'nap', status: 'completed' }, color: '#8b5cf6' },
        { id: 's60', label: 'Long Nap', icon: '😴', data: { sleepType: 'nap', status: 'completed' }, color: '#8b5cf6' },
        { id: 'sn', label: 'Night', icon: '🌙', data: { sleepType: 'night', status: 'completed' }, color: '#5F27CD' },
      ];
      case 'diaper': return [
        { id: 'wet', label: 'Wet', icon: '💧', data: { type: 'wet' }, color: '#06b6d4' },
        { id: 'dirty', label: 'Dirty', icon: '💩', data: { type: 'dirty' }, color: DS.warning },
        { id: 'both', label: 'Both', icon: '💧💩', data: { type: 'both' }, color: DS.danger },
      ];
      case 'potty': return [
        { id: 'p', label: 'Pee', icon: '💧', data: { type: 'pee', successful: true }, color: '#06b6d4' },
        { id: 'po', label: 'Poop', icon: '💩', data: { type: 'poop', successful: true }, color: DS.warning },
      ];
      default: return [];
    }
  }, [tracker]);

  const smartSuggestions = useMemo((): SmartSuggestion[] => {
    if (!tracker) return [];
    const out: SmartSuggestion[] = [];
    (suggestions || []).forEach((s: any, i: number) => {
      if (!s.fieldId || s.value == null || s.value === '') return;
      if ((s.confidence || 0) < 60) return;
      out.push({ id: `sugg-${i}`, fieldId: s.fieldId, label: prettifyFieldKey(s.fieldId), value: s.value, confidence: s.confidence, reason: s.reason || 'Based on your patterns' });
    });
    return out;
  }, [tracker, suggestions]);

  const contextInsights = useMemo((): ContextInsight[] => {
    if (!tracker || !currentBaby) return [];
    const out: ContextInsight[] = [];
    if (entriesToday === 0) out.push({ id: 'first', type: 'tip', message: `First ${tracker.name.toLowerCase()} of the day. Great time to log!`, emoji: '✨', color: DS.success, priority: 'low' });
    if (isAtRisk && streak?.currentStreak > 0) out.push({ id: 'risk', type: 'anomaly', message: `Streak at risk! Log within ${hoursUntilBreak}h`, emoji: '🔥', color: DS.danger, priority: 'high' });
    if (timeContext?.nextSuggestedTime) out.push({ id: 'next', type: 'pattern', message: `Usually logged around ${timeContext.nextSuggestedTime}`, emoji: '⏰', color: DS.primary, priority: 'medium' });
    return out;
  }, [tracker, currentBaby, entriesToday, isAtRisk, streak, hoursUntilBreak, timeContext]);

  useEffect(() => {
    if (selectedTrackerId) refreshProgressive();
  }, [selectedTrackerId, refreshProgressive]);

  useEffect(() => {
    if (!tracker || editEntryId || !currentBaby) return;
    const yesterday = subDays(new Date(), 1);
    const s = startOfDay(yesterday).getTime(), e = endOfDay(yesterday).getTime();
    const filtered = getEntries(tracker.id)
      .filter((x: any) => x.timestamp >= s && x.timestamp <= e)
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((x: any) => ({
        id: x.id, timestamp: x.timestamp, data: x.data || {}, notes: x.notes, tags: x.tags, title: x.title,
        photoUris: cleanImageUris(x.photoUris),
      }));
    setYesterdayEntries(filtered);
  }, [tracker, getEntries, editEntryId, currentBaby, setYesterdayEntries]);

  useEffect(() => {
    if (!tracker) return;
    let didApplyCorrelation = false;
    setPendingData((prev: any) => {
      const nd = { ...prev };
      let changed = false;
      const TIME_SENSITIVE = ['sleep', 'feed', 'dream_feed'];
      if (TIME_SENSITIVE.includes(tracker.id) && nd.startTime === undefined) {
        nd.startTime = date.toISOString();
        changed = true;
      }
      Object.entries(prefillData || {}).forEach(([k, v]) => {
        if (nd[k] === undefined && v !== undefined && v !== '') { nd[k] = v; changed = true; }
      });
      (suggestions || []).forEach((s: any) => {
        if (nd[s.fieldId] === undefined && s.confidence >= 80) { nd[s.fieldId] = s.value; changed = true; }
      });
      if (appliedCorrelationPrefill) {
        Object.entries(appliedCorrelationPrefill).forEach(([k, v]) => { nd[k] = v; changed = true; });
        didApplyCorrelation = true;
      }
      return changed ? nd : prev;
    });
    if (didApplyCorrelation) setAppliedCorrelationPrefill(null);
  }, [prefillData, suggestions, appliedCorrelationPrefill, tracker, setPendingData, setAppliedCorrelationPrefill, date]);

  useEffect(() => {
    if (!editEntryId || !tracker) return;
    const entry = getEntries(tracker.id).find((e: any) => e.id === editEntryId);
    if (entry) {
      setDate(new Date(entry.timestamp));
      setPendingData(entry.data || {});
      setPendingOptions({ notes: entry.notes, tags: entry.tags, photoUris: cleanImageUris(entry.photoUris) });
    }
  }, [editEntryId, tracker, getEntries, setDate, setPendingData, setPendingOptions]);

  useEffect(() => {
    if (!currentBaby?.id || !tracker) return;
    const check = async () => {
      try {
        const { detectAnomaly, extractMetricValue } = require('../../services/ai/BayesianEngine');
        const checks: Array<{ metric: any }> = [];
        if (tracker.id === 'temperature') checks.push({ metric: 'temperature_c' });
        if (tracker.id === 'growth') { checks.push({ metric: 'weight_kg' }); checks.push({ metric: 'height_cm' }); }
        if (tracker.id === 'feed') checks.push({ metric: 'feeding_ml' });
        for (const { metric } of checks) {
          const value = extractMetricValue(metric, pendingData);
          if (value === null) continue;
          const result = await detectAnomaly(currentBaby.id, metric, value);
          if (result.isAnomaly && result.severity !== 'low') {
            setAnomalyWarning(result.explanation || 'Value looks unusual for this baby.');
            setAnomalyMetric(metric); setAnomalyValue(value); setAnomalyZ(result.zScore);
            return;
          }
        }
        setAnomalyWarning(null); setAnomalyMetric(null); setAnomalyValue(null); setAnomalyZ(null);
      } catch { setAnomalyWarning(null); }
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [pendingData, currentBaby?.id, tracker?.id]);

  const dateRef = useRef(date);
  dateRef.current = date;

  const handleCopyYesterday = useCallback((entry: YesterdayEntry) => {
    HAPTIC_SUCCESS();
    setDate(new Date());
    setPendingData({ ...entry.data });
    if (entry.notes || entry.tags || entry.photoUris) {
      setPendingOptions((prev: any) => ({
        ...prev,
        notes: entry.notes || prev.notes,
        tags: entry.tags || prev.tags,
        photoUris: cleanImageUris(entry.photoUris || prev.photoUris || []),
      }));
    }
    success('Copied!', `Yesterday's ${tracker?.name || 'entry'} data loaded.`);
  }, [success, tracker?.name, setDate, setPendingData, setPendingOptions]);

  const handleDatePress = useCallback(() => {
    HAPTIC_LIGHT();
    datePicker.open({ value: dateRef.current instanceof Date ? dateRef.current : new Date(), mode: 'datetime' }, (picked) => {
      if (picked) setDate(picked);
    });
  }, [datePicker, setDate]);

  const buildTitle = useCallback((data: Record<string, unknown>): string => {
    if (!tracker) return 'Entry';
    const d = data;
    const dur = formatDuration(d.duration);
    switch (tracker.id) {
      case 'potty': return `${d.type || 'Potty'}${d.successful ? ' ✓' : ''}`;
      case 'feed': {
        if (d.feedType === 'solid') return `Solid Food${d.food ? `: ${d.food}` : ''}`;
        const amount = d.bottleAmount ? ` (${d.bottleAmount}${d.bottleAmount_unit === 'oz' ? ' oz' : ' ml'})` : '';
        return `${d.feedType || 'Feed'}${amount}${dur ? ` • ${dur}` : ''}`;
      }
      case 'sleep': return `${d.sleepType === 'nap' ? 'Nap' : d.sleepType === 'night' ? 'Night Sleep' : d.sleepType || 'Sleep'}${dur ? ` • ${dur}` : ''}`;
      case 'growth': return `${d.measurementType || 'Measurement'}: ${d.value || ''}${d.value_unit ? ` ${d.value_unit}` : d.unit ? ` ${d.unit}` : ''}`;
      case 'medication': return `${d.name || 'Medicine'}${d.dosage ? ` ${d.dosage}` : ''}`;
      case 'milestone': return `🌟 ${d.title || 'New Milestone'}`;
      case 'diaper': return `${d.type || 'Diaper'} Change`;
      case 'temperature': return `🌡️ ${d.value || ''}${d.unit === 'fahrenheit' ? '°F' : '°C'}`;
      case 'note': return (d.title as string) || 'Note';
      case 'bath': return `🛁 Bath${dur ? ` • ${dur}` : ''}`;
      case 'pumping': return `🤱 Pumping${d.amount ? ` (${d.amount}${d.amount_unit === 'oz' ? ' oz' : ' ml'})` : ''}${dur ? ` • ${dur}` : ''}`;
      case 'tummy_time': return `😤 Tummy Time${dur ? ` • ${dur}` : ''}`;
      default: return `${tracker.emoji} ${tracker.name}${dur ? ` • ${dur}` : ''}`;
    }
  }, [tracker]);

  const handleFormSubmit = useCallback((data: Record<string, unknown>, options: { title?: string; notes?: string; photoUris?: string[]; tags?: string[] }) => {
    setPendingData(data);
    setPendingOptions((prev: any) => ({
      notes: options?.notes || prev?.notes || '',
      tags: options?.tags || prev?.tags || [],
      photoUris: cleanImageUris(options?.photoUris || prev?.photoUris || []),
    }));
    setShowConfirm(true);
  }, [setPendingData, setPendingOptions, setShowConfirm]);

  const confirmSave = useCallback(async () => {
    if (!tracker) return;
    try {
      const finalData: Record<string, unknown> = { ...pendingData };
      const ONGOING = ['sleep', 'feed', 'dream_feed', 'nap'];
      if (ONGOING.includes(tracker.id)) {
        const wantsStarted = finalData.status === 'started' || finalData.status === 'ongoing';
        const hasStart = finalData.startTime && String(finalData.startTime).length > 0;
        if (wantsStarted && !hasStart) { finalData.startTime = date.toISOString(); finalData.status = 'started'; }
      }
      try {
        const visibleIds = new Set(
          (tracker.fields || []).filter((f) => {
            try { return typeof isFieldVisible === 'function' ? isFieldVisible(f, finalData) : true; } catch { return true; }
          }).map(f => f.id),
        );
        Object.keys(finalData).forEach((k) => {
          const isUnit = k.endsWith('_unit');
          const baseId = isUnit ? k.slice(0, -5) : k;
          if (!visibleIds.has(k) && !visibleIds.has(baseId)) delete finalData[k];
        });
      } catch {}
      const durTrackers = ['sleep', 'feed', 'dream_feed', 'nap'];
      if (durTrackers.includes(tracker.id)) {
        const hasStart = finalData.startTime && String(finalData.startTime).length > 0;
        const hasEnd = finalData.endTime && String(finalData.endTime).length > 0;
        if (hasStart && hasEnd) {
          const sMs = new Date(String(finalData.startTime)).getTime();
          const eMs = new Date(String(finalData.endTime)).getTime();
          if (!isNaN(sMs) && !isNaN(eMs) && eMs > sMs) {
            const secs = Math.round((eMs - sMs) / 1000);
            if (secs >= 60) { finalData.duration = secs; finalData.status = 'completed'; }
            else { delete finalData.duration; finalData.status = 'completed'; }
          } else {
            delete finalData.duration;
            if (finalData.status !== 'started') finalData.status = 'ongoing';
          }
        } else if (hasStart && !hasEnd) {
          delete finalData.duration;
          if (finalData.status !== 'started') finalData.status = 'ongoing';
        } else if (hasEnd && !hasStart) {
          delete finalData.duration;
          finalData.status = 'completed';
        }
      }
      const safePhotoUris = cleanImageUris(pendingOptions?.photoUris || []);
      const safeTags = Array.isArray(pendingOptions?.tags) ? pendingOptions.tags.filter((t): t is string => typeof t === 'string' && t.length > 0) : [];
      const entry = await addEntry(tracker.id, finalData, {
        title: buildTitle(finalData),
        notes: pendingOptions?.notes || '',
        tags: safeTags,
        photoUris: safePhotoUris,
      });
      if (entry) {
        HAPTIC_SUCCESS();
        setShowConfirm(false);
        success('Saved!', `${tracker.name} entry added successfully.`);
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('UniversalTrackerHub' as never);
      }
    } catch (err) {
      console.error('Save error:', err);
      error('Error', 'Failed to save entry. Please try again.');
    }
  }, [tracker, pendingData, pendingOptions, addEntry, success, error, navigation, buildTitle, setShowConfirm, date]);

  const handleTemplateSelect = useCallback((tmpl: QuickTemplate) => {
    HAPTIC_MEDIUM();
    setPendingData((prev: any) => ({ ...prev, ...tmpl.data }));
    success('Template Applied', `${tmpl.label} prefill loaded.`);
  }, [success, setPendingData]);

  const handleApplySuggestion = useCallback((s: SmartSuggestion) => {
    HAPTIC_LIGHT();
    setPendingData((prev: any) => {
      const nd = { ...prev };
      if (s.fieldId && s.value !== undefined) nd[s.fieldId] = s.value;
      return nd;
    });
    setAppliedSuggestions((prev: Set<string>) => new Set([...prev, s.id]));
  }, [setPendingData, setAppliedSuggestions]);

  const handleDismissSuggestion = useCallback((id: string) => {
    setAppliedSuggestions((prev: Set<string>) => new Set([...prev, id]));
  }, [setAppliedSuggestions]);

  const handleCorrelationAction = useCallback((c: ProgressiveCorrelation) => {
    HAPTIC_LIGHT();
    if (c.prefillData) setAppliedCorrelationPrefill(c.prefillData);
  }, [setAppliedCorrelationPrefill]);

  const handleDismissCorrelation = useCallback((id: string) => {
    setDismissedCorrelations((prev: Set<string>) => new Set([...prev, id]));
  }, [setDismissedCorrelations]);

  const handleDismissReminder = useCallback((id: string) => {
    setDismissedReminders((prev: Set<string>) => new Set([...prev, id]));
  }, [setDismissedReminders]);

  const progressiveState = useMemo(() => ({
    prefillData, suggestions, streak, insights, correlations, activeReminders, templates, trends, timeContext,
    yesterdayEntries: yesterdayEntries.slice(0, 5),
    todayEntries: getEntries(tracker?.id ?? '').filter((e: any) => e.timestamp >= new Date().setHours(0, 0, 0, 0)).slice(0, 5),
  }), [prefillData, suggestions, streak, insights, correlations, activeReminders, templates, trends, timeContext, yesterdayEntries, getEntries, tracker?.id]);

  const urgentReminders = visibleReminders.filter((r: any) => r.priority === 'urgent' || r.priority === 'high');

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark
          ? ['#0c0a09', `${tracker.gradient[0]}08`, '#0c0a09']
          : ['#f8faff', `${tracker.gradient[0]}08`, '#eef0f5']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.stickyHeader, {
          paddingTop: HEADER_TOP_PADDING,
          backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
          borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
        }]}
      >
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={() => { HAPTIC_LIGHT(); if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('UniversalTrackerHub' as never); }}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { HAPTIC_LIGHT(); setShowPicker(true); }}
            style={[styles.headerPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Text style={{ fontSize: 16 }}>{tracker.emoji}</Text>
            <Text style={[styles.headerPillText, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {editEntryId ? 'Edit' : 'Add'} {tracker.name}
            </Text>
            <Ionicons name="chevron-down" size={14} color={isDark ? DS.gray400 : DS.gray500} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { HAPTIC_LIGHT(); setShowPicker(true); }}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="swap-horizontal" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <Animated.ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Pulse Header */}
          <ContextPulse
            isDark={isDark}
            tracker={tracker}
            baby={currentBaby}
            entriesToday={entriesToday}
            lastEntryTime={lastEntryTime}
            onBabyPress={() => navigation.navigate('SwitchBaby', { returnTo: 'AddEntry', returnLabel: 'Log' })}
          />

          {/* Learning mode ribbon */}
          {(() => {
            const hasData = typeof progressive?.hasRealData === 'boolean' ? progressive.hasRealData : false;
            const count = typeof progressive?.entryCount === 'number' ? progressive.entryCount : (yesterdayEntries?.length ?? 0) + (todayEntries?.length ?? 0);
            if (hasData || count >= 5) return null;
            const remaining = Math.max(0, 5 - count);
            return (
              <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
                <AuraRibbon
                  isDark={isDark}
                  icon="sparkles-outline"
                  color={tracker.gradient[0]}
                  label="Learning mode"
                  text={`Log ${remaining} more ${tracker.name.toLowerCase()} ${remaining === 1 ? 'entry' : 'entries'} to unlock smart suggestions`}
                />
              </View>
            );
          })()}

          {/* Urgent ribbon */}
          {hasUrgentReminders && urgentReminders.length > 0 && (
            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
              <AuraRibbon isDark={isDark} icon="alert-circle-outline" color={DS.danger} label="Urgent" text={`${urgentReminders.length} reminder${urgentReminders.length !== 1 ? 's' : ''} need attention`} />
            </View>
          )}

          {/* Streak Ring */}
          {streak && streak.currentStreak > 0 && (
            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
              <StreakRing streak={streak} isAtRisk={isAtRisk} entriesToday={entriesToday} dailyGoal={3} trackerColor={tracker.gradient[0]} isDark={isDark}
                onLogNow={() => scrollViewRef.current?.scrollTo({ y: 500, animated: true })} />
            </View>
          )}

          {/* Quick Templates */}
          <View style={{ marginTop: DS.space.lg }}>
            <QuickTemplates templates={quickTemplates} onSelect={handleTemplateSelect} isDark={isDark} />
          </View>

          {/* Smart Suggestions */}
          <View style={{ marginTop: DS.space.md }}>
            <SmartSuggestions suggestions={smartSuggestions} applied={appliedSuggestions} onApply={handleApplySuggestion} onDismiss={handleDismissSuggestion} primaryColor={tracker.gradient[0]} isDark={isDark} />
          </View>

          {/* Time Wheel */}
          <View style={{ marginTop: DS.space.lg }}>
            <TimeWheel date={date} onDateChange={handleDatePress} onTimeChange={(d: Date) => setDate(d)} trackerColor={tracker.gradient[0]} isDark={isDark} />
          </View>

          {/* Context Insights */}
          <View style={{ marginTop: DS.space.lg }}>
            <InsightsStrip insights={contextInsights} isDark={isDark} />
          </View>

          {/* Related tracker suggestions */}
          {(() => {
            const suggestions = progressive?.relatedTrackerSuggestions;
            if (!Array.isArray(suggestions) || !suggestions.length) return null;
            const seen = new Set<string>();
            const uniq = suggestions.filter((s: any) => {
              if (!s?.trackerId || seen.has(s.trackerId)) return false;
              seen.add(s.trackerId);
              return true;
            });
            if (!uniq.length) return null;
            return (
              <View style={{ marginTop: DS.space.lg }}>
                <SectionHeader title="Often Logged Together" icon="link-outline" color={DS.info} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
                  {uniq.slice(0, 3).map((s: any) => (
                    <PressableScale key={s.id} onPress={() => navigation.navigate('AddEntry', { trackerId: s.trackerId })} activeScale={0.94}>
                      <View style={[styles.relChip, { backgroundColor: `${tracker.gradient[0]}10`, borderColor: `${tracker.gradient[0]}30` }]}>
                        <Text style={{ fontSize: 15 }}>{s.emoji}</Text>
                        <Text style={[styles.relChipText, { color: tracker.gradient[0] }]}>{s.label}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </ScrollView>
              </View>
            );
          })()}

          {/* Reminders */}
          {visibleReminders.length > 0 && (
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Reminders" icon="notifications-outline" color={DS.warning} />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {visibleReminders.slice(0, 2).map((r: any) => (
                  <View key={r.id} style={[styles.reminderCard, {
                    backgroundColor: isDark ? DS.darkCard : DS.white,
                    borderColor: isDark ? DS.darkBorder : DS.gray200,
                    borderLeftColor: r.priority === 'urgent' || r.priority === 'high' ? DS.danger : tracker.gradient[0],
                  }]}>
                    <Text style={{ fontSize: 20 }}>{r.emoji || '🔔'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{r.title || ''}</Text>
                      <Text style={[styles.reminderBody, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{r.body || ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDismissReminder(r.id)} style={{ padding: 4 }}>
                      <Ionicons name="close" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Correlations */}
          {visibleCorrelations.length > 0 && (
            <View style={{ marginTop: DS.space.lg }}>
              <SectionHeader title="Correlations" icon="git-branch-outline" color={DS.accent} />
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {visibleCorrelations.slice(0, 2).map((c: any) => (
                  <View key={c.id} style={[styles.corrCard, {
                    backgroundColor: isDark ? DS.darkCard : DS.white,
                    borderColor: isDark ? DS.darkBorder : DS.gray200,
                    borderLeftColor: tracker.gradient[0],
                  }]}>
                    <Text style={{ fontSize: 20 }}>{c.emoji || '🔗'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={2}>{c.message || ''}</Text>
                      <Text style={[styles.reminderBody, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        {c.trackerEmoji || ''} {c.trackerName || ''} · {c.confidence ?? 0}% match
                      </Text>
                    </View>
                    {c.action !== 'none' && (
                      <PressableScale onPress={() => handleCorrelationAction(c)} activeScale={0.94}>
                        <LinearGradient colors={[tracker.gradient[0], tracker.gradient[1]]} style={styles.corrApply}>
                          <Text style={styles.corrApplyText}>{c.action === 'log_now' ? 'Log' : c.action === 'prefill' ? 'Apply' : 'View'}</Text>
                        </LinearGradient>
                      </PressableScale>
                    )}
                    <TouchableOpacity onPress={() => handleDismissCorrelation(c.id)} style={{ padding: 4 }}>
                      <Ionicons name="close" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Yesterday */}
          <View style={{ marginTop: DS.space.lg }}>
            <YesterdayStrip entries={yesterdayEntries} trackerColor={tracker.gradient[0]} isDark={isDark} onCopy={handleCopyYesterday} onViewAll={() => setShowYesterdayModal(true)} />
          </View>

          {/* Recent */}
          {recentEntries.length > 0 && !editEntryId && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()} style={{ marginTop: DS.space.lg }}>
              <SectionHeader title={`Recent ${tracker.name}`} icon="time-outline" color={tracker.gradient[0]} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
                {recentEntries.map((entry: any) => (
                  <TrackerEntryCard
                    key={entry.id}
                    entry={entry}
                    compact={true}
                    onPress={() => navigation.navigate('EntryDetail', { entryId: entry.id, trackerId: entry.trackerId })}
                  />
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Anomaly warning */}
          {anomalyWarning && (
            <Animated.View entering={FadeInUp.springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              <View style={[styles.anomalyCard, { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Ionicons name="sparkles" size={18} color={DS.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: DS.warning, fontWeight: '700', fontSize: 13 }}>AI noticed something</Text>
                    <Text style={{ color: isDark ? DS.gray400 : DS.gray500, fontSize: 12, marginTop: 3, lineHeight: 17 }}>{anomalyWarning}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAnomalyWarning(null)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={16} color={DS.warning} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <PressableScale onPress={async () => {
                    if (currentBaby?.id && anomalyMetric) await anomalyFeedback.recordFeedback(currentBaby.id, anomalyMetric, anomalyValue ?? 0, anomalyZ ?? 0, 'dismissed_normal');
                    setAnomalyWarning(null);
                  }} activeScale={0.94} style={{ flex: 1 }}>
                    <View style={[styles.anomalyBtn, { backgroundColor: `${DS.success}15` }]}>
                      <Text style={{ color: DS.success, fontWeight: '700', fontSize: 12 }}>Normal for us</Text>
                    </View>
                  </PressableScale>
                  <PressableScale onPress={async () => {
                    if (currentBaby?.id && anomalyMetric) await anomalyFeedback.recordFeedback(currentBaby.id, anomalyMetric, anomalyValue ?? 0, anomalyZ ?? 0, 'confirmed_anomaly');
                    setAnomalyWarning(null);
                  }} activeScale={0.94} style={{ flex: 1 }}>
                    <View style={[styles.anomalyBtn, { backgroundColor: `${DS.danger}15` }]}>
                      <Text style={{ color: DS.danger, fontWeight: '700', fontSize: 12 }}>Concern</Text>
                    </View>
                  </PressableScale>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
              <View style={[styles.errorsCard, { backgroundColor: `${DS.danger}10`, borderColor: `${DS.danger}30` }]}>
                {errors.map((err: string, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Ionicons name="alert-circle" size={14} color={DS.danger} />
                    <Text style={{ color: DS.danger, fontSize: 12, fontWeight: '500', flex: 1 }}>{err}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Form */}
          <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
            <DynamicTrackerForm
              tracker={tracker}
              initialData={pendingData}
              progressiveState={progressiveState}
              onSubmit={handleFormSubmit}
              onCancel={() => { if (navigation.canGoBack()) navigation.goBack(); else setShowPicker(true); }}
              key={selectedTrackerId || 'no-tracker'}
            />
          </View>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSave}
        data={{ ...pendingData }}
        photoUris={cleanImageUris(pendingOptions.photoUris)}
        tracker={tracker}
        babyName={currentBaby?.name || 'Baby'}
        babyAvatar={currentBaby?.avatar}
        date={date}
        notes={pendingOptions.notes}
        tags={Array.isArray(pendingOptions.tags) ? pendingOptions.tags.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0) : []}
      />

      <YesterdayModal
        visible={showYesterdayModal}
        onClose={() => setShowYesterdayModal(false)}
        entries={yesterdayEntries}
        tracker={tracker}
        onCopy={handleCopyYesterday}
        isDark={isDark}
      />

      {Platform.OS === 'ios' && datePicker.iosPicker.visible && (
        <Modal transparent animationType="slide" visible={datePicker.iosPicker.visible} statusBarTranslucent onRequestClose={datePicker.dismissIos}>
          <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={datePicker.dismissIos}>
            <View style={{ backgroundColor: isDark ? DS.darkCard : DS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 }}>
              <View style={{ alignItems: 'flex-end', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }}>
                <TouchableOpacity onPress={datePicker.dismissIos}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: DS.primary }}>Done</Text>
                </TouchableOpacity>
              </View>
              {(() => {
                try {
                  const DateTimePicker = require('@react-native-community/datetimepicker').default;
                  return <DateTimePicker value={datePicker.iosPicker.value} mode={datePicker.iosPicker.mode} display="spinner" onValueChange={datePicker.handleIosChange} textColor={isDark ? DS.white : DS.gray900} />;
                } catch { return null; }
              })()}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main screen
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AddEntryScreen() {
  const navigation = useNavigation<AddEntryNavigationProp>();
  const route = useRoute<AddEntryRouteProp>();
  const { isDark } = useCustomization();
  const { getTracker } = useTracker();
  const { currentBaby, babyLoading } = useBaby();

  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(route.params?.trackerId || null);
  const [showPicker, setShowPicker] = useState(!route.params?.trackerId);
  const [date, setDate] = useState(new Date());
  const [showConfirm, setShowConfirm] = useState(false);
  const [showYesterdayModal, setShowYesterdayModal] = useState(false);
  const [yesterdayEntries, setYesterdayEntries] = useState<YesterdayEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dismissedCorrelations, setDismissedCorrelations] = useState<Set<string>>(new Set());
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const [appliedCorrelationPrefill, setAppliedCorrelationPrefill] = useState<Record<string, unknown> | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const [pendingData, setPendingData] = useState<Record<string, unknown>>(() => ({ ...route.params?.presetData }));
  const [pendingOptions, setPendingOptions] = useState<{ notes?: string; tags?: string[]; photoUris?: string[] }>({ photoUris: [] });
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (!babyLoading && !currentBaby) t = setTimeout(() => setShowBabyRequiredModal(true), 400);
    return () => clearTimeout(t);
  }, [babyLoading, currentBaby]);

  const tracker = useMemo(() => (selectedTrackerId ? getTracker(selectedTrackerId) : undefined), [selectedTrackerId, getTracker]);
  const editEntryId = useMemo(() => (route.params as any)?.editMode ? (route.params as any)?.eventId : undefined, [route.params]);
  const [, setFormInstanceKey] = useState(0);

  const handleTrackerSelect = useCallback((trackerId: string) => {
    if (!trackerId) return;
    setSelectedTrackerId(trackerId);
    setShowPicker(false);
    setPendingOptions({ photoUris: [] });
    setPendingData({});
    setErrors([]);
    setDismissedCorrelations(new Set());
    setDismissedReminders(new Set());
    setAppliedCorrelationPrefill(null);
    setAppliedSuggestions(new Set());
    setShowYesterdayModal(false);
    setYesterdayEntries([]);
    setFormInstanceKey(k => k + 1);
    setDate(new Date());
  }, []);

  const handlePickerClose = useCallback(() => {
    if (!selectedTrackerId) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('UniversalTrackerHub' as never);
    } else setShowPicker(false);
  }, [selectedTrackerId, navigation]);

  if (showPicker) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray50 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <TimelinePicker visible onClose={handlePickerClose} onSelect={handleTrackerSelect} currentBabyName={currentBaby?.name} currentBabyAvatar={currentBaby?.avatar} />
        <TouchableOpacity onPress={handlePickerClose} style={{ position: 'absolute', top: 50, right: 20, padding: 10, zIndex: 999 }}>
          <Ionicons name="close" size={26} color={isDark ? DS.white : DS.gray900} />
        </TouchableOpacity>
      </View>
    );
  }

  if (!tracker) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <Ionicons name="alert-circle-outline" size={48} color={isDark ? DS.gray500 : DS.gray400} />
        <Text style={{ color: isDark ? DS.gray500 : DS.gray400, fontSize: 16, marginTop: 8 }}>Tracker not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TrackerContent
        tracker={tracker}
        selectedTrackerId={selectedTrackerId}
        date={date}
        setDate={setDate}
        pendingData={pendingData}
        setPendingData={setPendingData}
        pendingOptions={pendingOptions}
        setPendingOptions={setPendingOptions}
        showConfirm={showConfirm}
        setShowConfirm={setShowConfirm}
        showYesterdayModal={showYesterdayModal}
        setShowYesterdayModal={setShowYesterdayModal}
        yesterdayEntries={yesterdayEntries}
        setYesterdayEntries={setYesterdayEntries}
        errors={errors}
        setErrors={setErrors}
        dismissedCorrelations={dismissedCorrelations}
        setDismissedCorrelations={setDismissedCorrelations}
        dismissedReminders={dismissedReminders}
        setDismissedReminders={setDismissedReminders}
        appliedCorrelationPrefill={appliedCorrelationPrefill}
        setAppliedCorrelationPrefill={setAppliedCorrelationPrefill}
        appliedSuggestions={appliedSuggestions}
        setAppliedSuggestions={setAppliedSuggestions}
        editEntryId={editEntryId}
        navigation={navigation}
        setShowPicker={setShowPicker}
      />
      <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBabyRequiredModal(false)}>
          <View style={[styles.babyReqCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.babyReqIcon}>
              <Ionicons name="people-outline" size={28} color={DS.white} />
            </LinearGradient>
            <Text style={[styles.confirmTitle, { color: isDark ? DS.white : DS.gray900 }]}>Baby Profile Needed</Text>
            <Text style={[styles.confirmSub, { color: isDark ? DS.gray400 : DS.gray500, marginBottom: 20 }]}>
              Create a baby profile to start tracking.
            </Text>
            <PressableScale onPress={() => { setShowBabyRequiredModal(false); navigation.navigate('CreateBabyProfile'); }} activeScale={0.97} style={{ width: '100%' }}>
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
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DS.space.lg, height: 48 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: 19 },
  headerPillText: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },

  /* Pulse */
  pulseWrap: { marginHorizontal: DS.space.lg, marginTop: DS.space.md, borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33 },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  pulseAgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 11, fontWeight: '700' },
  pulseSubText: { fontSize: 12, fontWeight: '500' },
  pulseIconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pulseLastText: { fontSize: 10, fontWeight: '600' },

  /* Ribbon */
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: DS.space.lg, marginBottom: DS.space.sm, marginTop: DS.space.xs },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionActionText: { fontSize: 12, fontWeight: '700' },

  /* Chips */
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: DS.radius.full, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },
  suggChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  suggDot: { width: 6, height: 6, borderRadius: 3 },
  suggLabel: { fontSize: 11, fontWeight: '700' },
  suggValue: { fontSize: 11, fontWeight: '600' },

  /* Date & Time */
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: DS.radius.md, borderWidth: 1 },
  dateChipText: { flex: 1, fontSize: 13, fontWeight: '700' },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: DS.radius.md },
  timeChipText: { fontSize: 13, fontWeight: '800' },
  timeBlock: { width: 80, height: 80, borderRadius: DS.radius.md, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1 },
  timeBlockLabel: { fontSize: 10, fontWeight: '600' },
  timeBlockTime: { fontSize: 13, fontWeight: '800' },
  nowBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginTop: 2 },
  nowBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800' },

  /* Insight */
  insightCard: { width: 200, padding: DS.space.md, borderRadius: DS.radius.lg, borderLeftWidth: 3, borderWidth: 1, overflow: 'hidden', gap: 6 },
  insightMsg: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  insightPriority: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  insightPriorityText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  /* Card */
  card: { marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, padding: DS.space.md, borderWidth: 1, ...DS.shadow.sm },

  /* Ring */
  ringOuter: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 4 },
  ringInner: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 4 },
  ringValue: { fontSize: 22, fontWeight: '800' },
  ringLabel: { fontSize: 10, fontWeight: '600' },
  streakText: { fontSize: 16, fontWeight: '800' },
  streakMsg: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  streakBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, marginTop: 4 },
  streakBtnText: { color: DS.white, fontSize: 11, fontWeight: '700' },

  /* Yesterday strip */
  yestCard: { width: 160, padding: 12, borderRadius: DS.radius.lg, borderWidth: 1 },
  yestTime: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  yestTimeText: { fontSize: 10, fontWeight: '700' },
  yestFieldLabel: { fontSize: 10, fontWeight: '500', flex: 1 },
  yestFieldValue: { fontSize: 10, fontWeight: '700', maxWidth: 80 },
  yestMore: { fontSize: 9, fontWeight: '600', marginTop: 3 },

  /* Reminder / corr cards */
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, borderLeftWidth: 3 },
  reminderTitle: { fontSize: 13, fontWeight: '700' },
  reminderBody: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  corrCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, borderLeftWidth: 3 },
  corrApply: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  corrApplyText: { color: DS.white, fontSize: 11, fontWeight: '700' },

  /* Related chips */
  relChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  relChipText: { fontSize: 12, fontWeight: '600' },

  /* Anomaly */
  anomalyCard: { padding: 12, borderRadius: DS.radius.md, borderWidth: 1 },
  anomalyBtn: { paddingVertical: 8, borderRadius: 10, alignItems: 'center' },

  /* Errors */
  errorsCard: { padding: 12, borderRadius: DS.radius.md, borderWidth: 1 },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 400, borderRadius: DS.radius['2xl'], padding: DS.space.lg, ...DS.shadow.lg },
  confirmIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  confirmTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  confirmSub: { fontSize: 12, fontWeight: '500' },
  confirmPreview: { padding: 14, borderRadius: DS.radius.lg, borderWidth: 1 },
  confirmTime: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  confirmPhoto: { width: 72, height: 72, borderRadius: 12 },
  confirmPreviewTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  confirmNotes: { fontSize: 12, fontStyle: 'italic', marginBottom: 8, lineHeight: 17 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  confirmRowLabel: { fontSize: 12, fontWeight: '500' },
  confirmRowValue: { fontSize: 12, fontWeight: '700' },
  confirmTags: { fontSize: 12, fontStyle: 'italic', flex: 1 },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: DS.radius.md, alignItems: 'center', borderWidth: 1 },
  confirmCancelText: { fontSize: 14, fontWeight: '700' },
  confirmSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: DS.radius.md },
  confirmSaveText: { color: DS.white, fontSize: 14, fontWeight: '700' },

  /* Yesterday modal */
  yestModalCard: { width: '100%', maxWidth: 420, borderRadius: DS.radius['2xl'], overflow: 'hidden', maxHeight: '85%', ...DS.shadow.lg },
  yestModalIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  yestModalEntry: { padding: 14, borderRadius: DS.radius.lg, borderWidth: 1, marginBottom: 10 },
  yestModalTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  yestCopyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  yestCopyText: { color: DS.white, fontSize: 12, fontWeight: '700' },
  yestDoneBtn: { paddingVertical: 14, borderRadius: DS.radius.md, alignItems: 'center' },
  yestDoneText: { color: DS.white, fontSize: 14, fontWeight: '700' },

  /* Baby required */
  babyReqCard: { width: '100%', maxWidth: 340, borderRadius: DS.radius['2xl'], padding: DS.space['2xl'], alignItems: 'center', ...DS.shadow.lg },
  babyReqIcon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  babyReqBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, width: '100%' },
  babyReqBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
});