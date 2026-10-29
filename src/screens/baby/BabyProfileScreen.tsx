import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  ActionSheetIOS,
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
  Platform,
  StatusBar,
  Text,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
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
import { useFocusEffect } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';

import type { RootStackParamList } from '../../types/navigation';
import { useFamily } from '../../context/FamilyContext';
import { UserRole, getMemberDisplayLabel } from '../../types/roles';
import { useBaby } from '../../context/BabyContext';
import type { Milestone } from '../../context/BabyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useTracker } from '../../hooks/useTrackerContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';
import { supabase } from '@/utils/supabase';

const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (
  Platform.OS === 'android' &&
  !IS_FABRIC &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─── Aura Design System ─── */
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

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DELIVERY_TYPES = ['Vaginal', 'C-Section', 'VBAC', 'Other'];
const BIRTH_ATTENDANTS = ['Obstetrician', 'Midwife', 'Family Doctor', 'Doula', 'Other'];
const FEEDING_PLANS = ['Breastfeeding', 'Formula', 'Combination', 'Pumping'];

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] as [string, string] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#06b6d4', gradient: ['#06b6d4', '#10b981'] as [string, string] },
];

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#6366f1' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#ef4444' },
];

const ROLE_PRESENTATION: Record<string, { label: string; icon: any; color: string; gradient: [string, string]; relationLabel: string }> = {
  parent1: { label: 'Primary Parent', icon: 'person-circle', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'], relationLabel: 'Primary Parent' },
  parent2: { label: 'Co-Parent', icon: 'person-circle', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'], relationLabel: 'Co-Parent' },
  guardian: { label: 'Guardian', icon: 'shield-checkmark', color: '#10b981', gradient: ['#10b981', '#34d399'], relationLabel: 'Guardian' },
  viewer: { label: 'Viewer', icon: 'eye', color: '#94a3b8', gradient: ['#94a3b8', '#cbd5e1'], relationLabel: 'Family Member' },
  baby: { label: 'Baby', icon: 'happy', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], relationLabel: 'Child' },
};

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

const TRACKER_META: Record<string, { emoji: string; color: string; label: string }> = {
  feed:        { emoji: '🍼', color: '#fa709a', label: 'Feeding' },
  sleep:       { emoji: '🌙', color: '#11998e', label: 'Sleep' },
  diaper:      { emoji: '👶', color: '#8B5CF6', label: 'Diaper' },
  potty:       { emoji: '💧', color: '#667eea', label: 'Potty' },
  growth:      { emoji: '📏', color: '#43e97b', label: 'Growth' },
  milestone:   { emoji: '🏆', color: '#ffd700', label: 'Milestone' },
  medication:  { emoji: '💊', color: '#ff6b6b', label: 'Medication' },
  temperature: { emoji: '🌡️', color: '#ef4444', label: 'Temperature' },
  symptom:     { emoji: '🤒', color: '#f97316', label: 'Symptom' },
  vaccine:     { emoji: '💉', color: '#3b82f6', label: 'Vaccine' },
  pumping:     { emoji: '🤱', color: '#ec4899', label: 'Pumping' },
  bath:        { emoji: '🛁', color: '#3b82f6', label: 'Bath' },
  tummy_time:  { emoji: '🤸', color: '#10b981', label: 'Tummy Time' },
  reading:     { emoji: '📚', color: '#6366f1', label: 'Reading' },
  walk:        { emoji: '🚶', color: '#0ea5e9', label: 'Walk' },
  note:        { emoji: '📝', color: '#64748b', label: 'Note' },
  mood:        { emoji: '😊', color: '#f59e0b', label: 'Mood' },
  default:     { emoji: '•',  color: '#94a3b8', label: 'Activity' },
};

type BabyFamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
type ProfileTab = 'overview' | 'milestones' | 'health' | 'family';

/* ─── Helpers ─── */
const dbToFormEnum = (value?: string | null): string => {
  if (!value) return '';
  return value.split('_').map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : '')).join(' ');
};
const formEnumToDb = (value?: string | null): string | null => {
  if (!value) return null;
  return value.toLowerCase().replace(/[\s-]+/g, '_');
};
const numToStr = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  return String(v);
};

const uploadImageToSupabase = async (localUri: string, babyId: string): Promise<string | null> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt) ? fileExt : 'jpg';
    const fileName = `${babyId}_${Date.now()}.${safeExt}`;
    const filePath = `baby_avatars/${fileName}`;
    const { error } = await supabase.storage.from('baby_avatars').upload(filePath, decode(base64), { contentType: `image/${safeExt}`, cacheControl: '3600', upsert: false });
    if (error) { if (__DEV__) console.warn('[BabyProfile] Upload error:', error.message); return null; }
    const { data: urlData } = supabase.storage.from('baby_avatars').getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (error) { if (__DEV__) console.warn('[BabyProfile] Upload error:', error); return null; }
};

const isImageUri = (value: string | undefined | null | any[]): boolean => {
  if (!value) return false;
  if (Array.isArray(value)) value = value.length > 0 ? value[0] : null;
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:') || value.startsWith('ph://') || value.startsWith('assets-library://');
};

const isEmoji = (value: string | undefined | null | any[]): boolean => {
  if (!value) return false;
  if (Array.isArray(value)) value = value.length > 0 ? value[0] : null;
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  try { const da = a instanceof Date ? a : new Date(a); const db = b instanceof Date ? b : new Date(b); return Math.max(0, differenceInMonths(da, db)); } catch { return 0; }
};
const safeDiffDays = (a: Date | string, b: Date | string): number => {
  try { const da = a instanceof Date ? a : new Date(a); const db = b instanceof Date ? b : new Date(b); return differenceInDays(da, db); } catch { return 0; }
};

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Sub-Components
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: any) => {
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
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const GlassCard = React.memo(({ children, style, isDark, delay = 0 }: any) => (
  <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }, style]}>
    <LinearGradient colors={isDark ? ['rgba(255,255,255,0.02)', 'transparent'] : ['rgba(255,255,255,0.4)', 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    {children}
  </Animated.View>
));

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: any) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={15} color={color} /></View>}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: any) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab: any) => {
      const active = activeTab === tab.key;
      return (
        <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]} activeOpacity={0.8}>
          <Ionicons name={tab.icon} size={14} color={active ? DS.primary : (isDark ? DS.gray400 : DS.gray500)} />
          <Text style={[styles.tabLabel, { color: active ? DS.primary : (isDark ? DS.gray400 : DS.gray500) }, active && { fontWeight: '700' }]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ─── Identity Capsule (replaces hero) ─── */
const BabyIdentityCapsule = React.memo<any>(({
  isDark, babyPhoto, babyName, gender, ageDisplay, isEditing, babyStats,
  onAvatarPress, onEdit, onSave, isSaving, onDelete, canEdit,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  const genderOpt = GENDER_OPTIONS.find(g => g.value === gender) || GENDER_OPTIONS[2];
  const gradient = genderOpt.gradient;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={isDark ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)'] : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <LinearGradient colors={[`${gradient[0]}${isDark ? '45' : '28'}`, 'transparent']} style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${gradient[1]}${isDark ? '35' : '22'}`, 'transparent']} style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <PressableScale onPress={onAvatarPress} activeScale={0.94} disabled={!canEdit}>
            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.avatarGlow, { backgroundColor: `${gradient[0]}35` }, glowStyle]} />
              <Animated.View style={[styles.avatarRing, ringStyle]}>
                <LinearGradient colors={[gradient[0], gradient[1], DS.warning, gradient[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                {isImageUri(babyPhoto) ? (
                  <Image source={{ uri: babyPhoto as string }} style={{ width: 78, height: 78, borderRadius: 39 }} resizeMode="cover" />
                ) : isEmoji(babyPhoto) ? (
                  <Text style={{ fontSize: 38 }}>{babyPhoto}</Text>
                ) : (
                  <Ionicons name={genderOpt.icon as any} size={36} color={gradient[0]} />
                )}
              </View>
              {canEdit && (
                <View style={[styles.editBadge, { borderColor: isDark ? DS.darkSurface : DS.white }]}>
                  <Ionicons name="camera" size={11} color={DS.white} />
                </View>
              )}
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {babyName || 'Baby'}
            </Text>
            <Text style={[styles.capsuleMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {ageDisplay} · {genderOpt.label}
            </Text>
            <View style={styles.capsuleStats}>
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.warning }]}>{babyStats?.streak || 0}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>streak</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.accent }]}>{babyStats?.milestones || 0}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>wins</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.primary }]}>{babyStats?.entries || 0}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>entries</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onEdit} disabled={!canEdit} activeScale={0.9}>
              <View style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name={isEditing ? 'close' : 'create-outline'} size={18} color={isEditing ? DS.danger : (isDark ? DS.gray300 : DS.gray600)} />
              </View>
            </PressableScale>
            <PressableScale onPress={onDelete} disabled={!canEdit} activeScale={0.9}>
              <View style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' }]}>
                <Ionicons name="trash-outline" size={18} color={DS.danger} />
              </View>
            </PressableScale>
          </View>
        </View>

        {isEditing && (
          <Animated.View entering={FadeInUp.springify()} style={styles.capsuleActions}>
            <PressableScale onPress={onSave} disabled={isSaving} activeScale={0.94} style={{ flex: 1 }}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.actionPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {isSaving ? <ActivityIndicator size="small" color={DS.white} /> : (
                  <>
                    <Ionicons name="checkmark" size={15} color={DS.white} />
                    <Text style={[styles.actionPrimaryText, { color: DS.white }]}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </PressableScale>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
});

/* ─── Insight Ribbon ─── */
const InsightRibbon = React.memo<any>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ─── KpiPill (unchanged visual, Aura styled) ─── */
const KpiPill = React.memo(({ icon, value, label, color, isDark }: any) => (
  <PressableScale activeScale={0.97} style={{ flex: 1 }}>
    <View style={[styles.kpiPill, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <LinearGradient colors={[`${color}10`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[styles.kpiIcon, { backgroundColor: `${color}15` }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{label}</Text>
    </View>
  </PressableScale>
));

/* ─── Birth Details Grid Card ─── */
const BirthDetailsGrid = React.memo(({ isDark, items, isCompact, onAddMissing }: any) => (
  <GlassCard isDark={isDark}>
    <View style={{ padding: DS.space.md }}>
      <View style={styles.birthGrid}>
        {items.map((item: any, i: number) => {
          const hasValue = item.value !== undefined && item.value !== null && String(item.value).trim() !== '';
          return (
            <View key={i} style={[styles.birthItem, { minWidth: isCompact ? '45%' : '30%', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }, !hasValue && { opacity: 0.55 }]}>
              <Text style={[styles.birthLabel, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>{item.label}</Text>
              <Text style={[styles.birthValue, { color: hasValue ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray500 : DS.gray400), fontStyle: hasValue ? 'normal' : 'italic' }]} numberOfLines={2}>
                {hasValue ? `${item.value}${item.suffix}` : 'Not set'}
              </Text>
            </View>
          );
        })}
      </View>
      {onAddMissing && (
        <PressableScale onPress={onAddMissing} activeScale={0.97} style={{ marginTop: DS.space.sm }}>
          <View style={[styles.addMissingBtn, { backgroundColor: `${DS.primary}10` }]}>
            <Ionicons name="add-circle-outline" size={15} color={DS.primary} />
            <Text style={[styles.addMissingText, { color: DS.primary }]}>Fill in missing details</Text>
          </View>
        </PressableScale>
      )}
    </View>
  </GlassCard>
));

/* ─── Stat Tiles (compact grid) ─── */
const StatTiles = React.memo(({ isDark, stats }: any) => (
  <View style={styles.statTiles}>
    {stats.map((s: any, i: number) => (
      <Animated.View key={i} entering={FadeInUp.delay(i * 50).springify()} style={{ flex: 1 }}>
        <View style={[styles.statTile, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={[styles.statTileIcon, { backgroundColor: `${s.color}15` }]}>
            <Ionicons name={s.icon} size={15} color={s.color} />
          </View>
          <Text style={[styles.statTileValue, { color: s.color }]}>{s.value}</Text>
          <Text style={[styles.statTileLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{s.label}</Text>
        </View>
      </Animated.View>
    ))}
  </View>
));

/* ─── Health Status Card (Monitor / Healthy) ─── */
const HealthStatusCard = React.memo(({ isDark, medicalNotes, allergies }: any) => {
  const hasIssues = !!(medicalNotes || allergies);
  const statusColor = hasIssues ? DS.warning : DS.success;
  return (
    <GlassCard isDark={isDark} delay={40}>
      <View style={{ padding: DS.space.md, flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
        <View style={[styles.healthIcon, { backgroundColor: `${statusColor}18` }]}>
          <Ionicons name={hasIssues ? 'medical' : 'checkmark-circle'} size={22} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>
            {hasIssues ? 'Monitor' : 'All Clear'}
          </Text>
          <Text style={[styles.cardSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
            {medicalNotes || (allergies ? `Allergies: ${allergies}` : 'No medical concerns recorded')}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
});

/* ─── Milestone Row ─── */
const MilestoneRow = React.memo<any>(({ milestone, index, onDelete, isDark }) => {
  const cat = MILESTONE_CATEGORIES.find(c => c.id === milestone.category) || MILESTONE_CATEGORIES[0];
  return (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <View style={[styles.milestoneCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
          <View style={[styles.milestoneIcon, { backgroundColor: `${cat.color}18` }]}>
            <Ionicons name={cat.icon as any} size={20} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.milestoneTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{milestone.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={[styles.milestoneCat, { backgroundColor: `${cat.color}15` }]}>
                <Text style={[styles.milestoneCatText, { color: cat.color }]}>{cat.label}</Text>
              </View>
              <Text style={[styles.milestoneDate, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                {format(new Date(milestone.achievedAt), 'MMM d, yyyy')}
              </Text>
            </View>
            {milestone.description ? (
              <Text style={[styles.milestoneDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{milestone.description}</Text>
            ) : null}
          </View>
          <PressableScale onPress={() => onDelete(milestone.id)} activeScale={0.9}>
            <View style={[styles.deleteBtn, { backgroundColor: `${DS.danger}10` }]}>
              <Ionicons name="trash-outline" size={15} color={DS.danger} />
            </View>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Activity Row ─── */
const ActivityRow = React.memo<any>(({ activity, index, isDark }) => {
  const trackerId = String(activity.trackerId || activity.tracker_id || activity.type || 'note');
  const meta = TRACKER_META[trackerId] || TRACKER_META.default;
  const ts = Number(activity.timestamp) || Date.now();
  return (
    <Animated.View entering={FadeInUp.delay(index * 40).springify()}>
      <View style={[styles.activityCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
          <View style={[styles.activityIcon, { backgroundColor: `${meta.color}15` }]}>
            <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activityTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {activity.title || meta.label}
            </Text>
            {activity.notes ? (
              <Text style={[styles.activityNotes, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{activity.notes}</Text>
            ) : null}
            <Text style={[styles.activityTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>
              {format(new Date(ts), 'MMM d, h:mm a')}
            </Text>
          </View>
          <View style={[styles.activityBadge, { backgroundColor: `${meta.color}15` }]}>
            <Text style={[styles.activityBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Family Node ─── */
const FamilyNode = React.memo<any>(({ member, roleKey, index, onPress, isDark, size }) => {
  const meta = ROLE_PRESENTATION[roleKey] || ROLE_PRESENTATION.viewer;
  const avatarSrc: string | undefined = member?.avatar;
  const isUrl = avatarSrc && (avatarSrc.startsWith('http') || avatarSrc.startsWith('file://'));
  const isEmoji = avatarSrc && avatarSrc.length <= 4 && /\p{Emoji}/u.test(avatarSrc);

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <PressableScale onPress={onPress} activeScale={0.94}>
        <View style={[styles.familyNode, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <LinearGradient colors={meta.gradient} style={[styles.familyAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
            {isUrl ? (
              <Image source={{ uri: avatarSrc! }} style={{ width: '100%', height: '100%' }} />
            ) : isEmoji ? (
              <Text style={{ fontSize: size * 0.45 }}>{avatarSrc}</Text>
            ) : (
              <Ionicons name={meta.icon} size={size * 0.55} color={DS.white} />
            )}
          </LinearGradient>
          <Text style={[styles.familyName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{member.fullName || 'Member'}</Text>
          <View style={[styles.familyBadge, { backgroundColor: `${meta.color}18` }]}>
            <Text style={[styles.familyBadgeText, { color: meta.color }]}>
              {getMemberDisplayLabel({ role: member.role, relationship: member.relationship })}
            </Text>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ─── Skeleton ─── */
const CapsuleSkeleton = React.memo(({ isDark }: any) => (
  <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
    <View style={styles.capsuleRow}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 20, width: 130, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
        <View style={{ height: 13, width: 100, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }} />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ gap: 4 }}>
              <View style={{ height: 14, width: 28, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
              <View style={{ height: 10, width: 40, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  </View>
));

/* ─── Modals ─── */
const ActionModal = React.memo(({ visible, onClose, title, children, isDark }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalDrag}><View style={[styles.dragIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} /></View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

const EmojiPickerModal = React.memo(({ visible, onClose, onSelect, isDark }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalDrag}><View style={[styles.dragIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} /></View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => { onSelect(emoji); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} style={[styles.emojiBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const PickerModal = React.memo(({ visible, onClose, onSelect, options, selectedValue, title, isDark }: any) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { maxHeight: '60%', backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalDrag}><View style={[styles.dragIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} /></View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map((item: string) => (
              <TouchableOpacity key={item} style={[styles.pickerItem, selectedValue === item && { backgroundColor: `${DS.primary}10` }]} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={[styles.pickerItemText, { color: selectedValue === item ? DS.primary : (isDark ? DS.gray200 : DS.gray700) }, selectedValue === item && { fontWeight: '700' }]}>{item}</Text>
                {selectedValue === item && <Ionicons name="checkmark-circle" size={18} color={DS.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BabyFamilyCenterScreen({ navigation, route }: BabyFamilyCenterScreenProps) {
  const { mode = 'baby', babyId: routeBabyId } = route.params || { mode: 'baby' };
  const { isDark, colors: appColors } = useApp();
  const { fullThemeColors } = useCustomization();
  const themeColors = appColors || fullThemeColors;
  const { userProfile } = useAuth();
  const { profile } = useUser();
  const sweetAlert = useSweetAlert();

  const { width: SCREEN_W } = useWindowDimensions();
  const isCompact = SCREEN_W < 360;
  const isTablet = SCREEN_W >= 768;
  const FAMILY_NODE_SIZE = isCompact ? 80 : 92;

  const {
    babies, updateBaby, currentBaby, loadBabies, deleteBaby,
    milestones, calculateAge, addMilestone, deleteMilestone,
  } = useBaby();
  const { entries: trackerEntries, refreshEntries } = useTracker();
  const { members, loadFamily } = useFamily();

  const isBabyMode = mode === 'baby';

  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveConfirmOpenRef = useRef(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const firstHydrateDone = useRef(false);

  const currentBabyData = useMemo(() => {
    if (!isBabyMode) return null;
    const id = routeBabyId || currentBaby?.id;
    if (!id) return null;
    return babies.find(b => b.id === id) || currentBaby || null;
  }, [isBabyMode, routeBabyId, babies, currentBaby]);

  const [babyName, setBabyName] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(2);
  const [selectedGender, setSelectedGender] = useState('boy');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [babyPhoto, setBabyPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [pediatrician, setPediatrician] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [birthWeight, setBirthWeight] = useState('');
  const [birthHeight, setBirthHeight] = useState('');
  const [birthHeadCircumference, setBirthHeadCircumference] = useState('');
  const [gestationalWeeks, setGestationalWeeks] = useState('');
  const [apgar1Min, setApgar1Min] = useState('');
  const [apgar5Min, setApgar5Min] = useState('');
  const [deliveryType, setDeliveryType] = useState('');
  const [birthAttendant, setBirthAttendant] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [multipleBirth, setMultipleBirth] = useState(false);
  const [birthOrder, setBirthOrder] = useState('');
  const [feedingPlan, setFeedingPlan] = useState('');
  const [birthTime, setBirthTime] = useState('');

  const [pickerState, setPickerState] = useState<{ visible: boolean; type: 'bloodType' | 'deliveryType' | 'birthAttendant' | 'feedingPlan' | null }>({ visible: false, type: null });

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
  }));

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

  const loadDataFromBaby = useCallback((baby: any) => {
    if (!baby) return;
    setBabyName(baby.name || '');
    setSelectedSkin(typeof baby.skinTone === 'number' ? baby.skinTone : 2);
    setSelectedGender(baby.gender || 'boy');
    setBirthDate(baby.birthDate ? new Date(baby.birthDate) : new Date());
    setBabyPhoto(baby.avatar || baby.avatar_url || null);
    setBloodType(baby.bloodType || '');
    setAllergies(Array.isArray(baby.allergies) ? baby.allergies.join(', ') : (baby.allergies || ''));
    setMedicalNotes(baby.medicalNotes || '');
    setWeight(numToStr(baby.weight));
    setHeight(numToStr(baby.height));
    setEmergencyContact(baby.emergencyContact || '');
    setPediatrician(baby.pediatrician || '');
    setNotificationsEnabled(baby.notificationsEnabled !== false);
    setBirthWeight(numToStr(baby.birthWeight));
    setBirthHeight(numToStr(baby.birthHeight));
    setBirthHeadCircumference(numToStr(baby.birthHeadCircumference));
    setGestationalWeeks(numToStr(baby.gestationalWeeks));
    setApgar1Min(numToStr(baby.apgar1Min));
    setApgar5Min(numToStr(baby.apgar5Min));
    setDeliveryType(dbToFormEnum(baby.deliveryType));
    setBirthAttendant(dbToFormEnum(baby.birthAttendant));
    setBirthPlace(baby.birthPlace || '');
    setMultipleBirth(baby.multipleBirth === true);
    setBirthOrder(numToStr(baby.birthOrder));
    setFeedingPlan(baby.feedingPlan ? dbToFormEnum(baby.feedingPlan) : '');
    setBirthTime(baby.birthTime || '');
    setIsEditing(false);
  }, []);

  const refreshBabyDataLight = useCallback(async () => {
    if (isLoadingRef.current) return;
    const targetId = currentBabyData?.id || routeBabyId || currentBaby?.id;
    if (!targetId) return;
    isLoadingRef.current = true;
    try {
      await loadBabies(true);
      await refreshEntries();
      await loadFamily();
      const { data: fresh } = await supabase.from('babies').select('*').eq('id', targetId).maybeSingle();
      if (fresh && isMountedRef.current) {
        loadDataFromBaby({
          id: fresh.id, name: fresh.name, skinTone: fresh.skin_tone ?? 2,
          gender: fresh.gender === 'male' ? 'boy' : fresh.gender === 'female' ? 'girl' : 'other',
          birthDate: fresh.date_of_birth, avatar: fresh.avatar || fresh.avatar_url || null,
          avatar_url: fresh.avatar_url || fresh.avatar || null, bloodType: fresh.blood_type,
          allergies: fresh.allergies, medicalNotes: fresh.medical_notes,
          weight: fresh.current_weight_kg, height: fresh.current_height_cm,
          emergencyContact: fresh.emergency_contact, pediatrician: fresh.pediatrician,
          notificationsEnabled: fresh.notifications_enabled !== false,
          birthWeight: fresh.birth_weight_kg, birthHeight: fresh.birth_height_cm,
          birthHeadCircumference: fresh.birth_head_circumference, gestationalWeeks: fresh.gestational_weeks,
          apgar1Min: fresh.apgar_1min, apgar5Min: fresh.apgar_5min,
          deliveryType: fresh.delivery_type, birthAttendant: fresh.birth_attendant,
          birthPlace: fresh.birth_place, multipleBirth: fresh.multiple_birth,
          birthOrder: fresh.birth_order, feedingPlan: fresh.feeding_plan, birthTime: fresh.birth_time,
        });
      }
    } catch (error) { if (__DEV__) console.warn('[BabyProfile] refresh error:', error); }
    finally {
      isLoadingRef.current = false;
      if (isMountedRef.current && !firstHydrateDone.current) { firstHydrateDone.current = true; setIsHydrating(false); }
    }
  }, [currentBabyData?.id, routeBabyId, currentBaby?.id, loadBabies, refreshEntries, loadFamily, loadDataFromBaby]);

  const loadFullData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      await loadBabies(true);
      await loadFamily();
      await refreshEntries();
      if (currentBabyData && isMountedRef.current) loadDataFromBaby(currentBabyData);
    } catch (error) { if (__DEV__) console.warn('[BabyProfile] load error:', error); }
    finally {
      isLoadingRef.current = false;
      if (isMountedRef.current && !firstHydrateDone.current) { firstHydrateDone.current = true; setIsHydrating(false); }
    }
  }, [loadBabies, loadFamily, refreshEntries, currentBabyData, loadDataFromBaby]);

  const lastLoadedFingerprintRef = useRef<string>('');

  useEffect(() => {
    if (!currentBabyData) return;
    const fingerprint = JSON.stringify({
      id: currentBabyData.id, name: currentBabyData.name,
      avatar: currentBabyData.avatar || currentBabyData.avatar_url || null,
      birthDate: currentBabyData.birthDate, gender: currentBabyData.gender,
      skinTone: currentBabyData.skinTone, bloodType: currentBabyData.bloodType || '',
      allergies: currentBabyData.allergies || [], medicalNotes: currentBabyData.medicalNotes || '',
      weight: currentBabyData.weight || '', height: currentBabyData.height || '',
      emergencyContact: currentBabyData.emergencyContact || '', pediatrician: currentBabyData.pediatrician || '',
      notificationsEnabled: currentBabyData.notificationsEnabled !== false,
      birthWeight: currentBabyData.birthWeight || '', birthHeight: currentBabyData.birthHeight || '',
      birthHeadCircumference: currentBabyData.birthHeadCircumference || '',
      gestationalWeeks: currentBabyData.gestationalWeeks || '',
      apgar1Min: currentBabyData.apgar1Min || '', apgar5Min: currentBabyData.apgar5Min || '',
      deliveryType: currentBabyData.deliveryType || '', birthAttendant: currentBabyData.birthAttendant || '',
      birthPlace: currentBabyData.birthPlace || '', multipleBirth: currentBabyData.multipleBirth === true,
      birthOrder: currentBabyData.birthOrder || '', feedingPlan: currentBabyData.feedingPlan || '',
      birthTime: currentBabyData.birthTime || '',
    });
    if (lastLoadedFingerprintRef.current === fingerprint) return;
    lastLoadedFingerprintRef.current = fingerprint;
    loadDataFromBaby(currentBabyData);
    if (!firstHydrateDone.current) { firstHydrateDone.current = true; setIsHydrating(false); }
  }, [currentBabyData, loadDataFromBaby]);

  useEffect(() => {
    isMountedRef.current = true;
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current && !firstHydrateDone.current) { firstHydrateDone.current = true; setIsHydrating(false); }
    }, 1200);
    return () => {
      clearTimeout(safetyTimer);
      isMountedRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  useFocusEffect(useCallback(() => {
    if (currentBabyData && !isLoadingRef.current) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshBabyDataLight().catch(() => {});
        // Family members also need a refresh on focus so a role
        // change made in FamilySharing/EditGuardian is reflected
        // immediately in the tree.
        loadFamily().catch(() => {});
      }, 300);
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [currentBabyData, refreshBabyDataLight, loadFamily]));

  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    try {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch (error) { if (__DEV__) console.warn('[BabyProfile] ensureDirExists error:', error); }
  };

  const getPermanentImagePath = (targetBabyId: string) => `${FileSystem.documentDirectory}baby_images/${targetBabyId}_avatar_${Date.now()}.jpg`;

  const persistPickedImage = async (sourceUri: string, targetBabyId: string): Promise<string | null> => {
    try {
      await ensureDirExists();
      const permanentUri = getPermanentImagePath(targetBabyId);
      if (sourceUri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(permanentUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (sourceUri.startsWith('data:')) {
        const base64Data = sourceUri.split(',')[1];
        if (base64Data) await FileSystem.writeAsStringAsync(permanentUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        else throw new Error('Invalid data URI');
      } else await FileSystem.copyAsync({ from: sourceUri, to: permanentUri });
      const fileInfo = await FileSystem.getInfoAsync(permanentUri);
      if (!fileInfo.exists) return null;
      return permanentUri;
    } catch (error) { if (__DEV__) console.warn('[persistPickedImage] Failed:', error); return null; }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { sweetAlert.error('Permission Required', 'Please allow access to your camera.'); return; }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]?.uri) {
        setIsUploading(true);
        const targetBabyId = currentBabyData?.id || 'temp';
        const permanentUri = await persistPickedImage(result.assets[0].uri, targetBabyId);
        if (permanentUri) { setBabyPhoto(permanentUri); setIsEditing(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sweetAlert.success('Photo Ready!', 'Tap Save Changes to apply.'); }
        else sweetAlert.error('Error', 'Failed to save photo');
        setIsUploading(false);
      }
    } catch (error) { if (__DEV__) console.warn('[BabyProfile] handleTakePhoto error:', error); setIsUploading(false); sweetAlert.error('Error', 'Failed to save photo'); }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { sweetAlert.error('Permission Required', 'Please allow access to your photo library.'); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]?.uri) {
        setIsUploading(true);
        const targetBabyId = currentBabyData?.id || 'temp';
        const permanentUri = await persistPickedImage(result.assets[0].uri, targetBabyId);
        if (permanentUri) { setBabyPhoto(permanentUri); setIsEditing(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); sweetAlert.success('Photo Ready!', 'Tap Save Changes to apply.'); }
        else sweetAlert.error('Error', 'Failed to save photo');
        setIsUploading(false);
      }
    } catch (error) { if (__DEV__) console.warn('[BabyProfile] handlePickImage error:', error); setIsUploading(false); sweetAlert.error('Error', 'Failed to save photo'); }
  };

  const handleEmojiSelect = (emoji: string) => {
    setBabyPhoto(emoji);
    setIsEditing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sweetAlert.success('Avatar Updated!', 'Tap Save Changes to apply.');
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library', 'Pick Emoji'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) handleTakePhoto();
          else if (buttonIndex === 2) handlePickImage();
          else if (buttonIndex === 3) setShowEmojiPicker(true);
        }
      );
    } else setShowImagePicker(true);
  };

  const checkForChanges = useCallback(() => {
    if (!currentBabyData) return [];
    const changes: string[] = [];
    const b: any = currentBabyData;
    const currentAllergies = Array.isArray(b.allergies) ? b.allergies.join(', ') : (b.allergies || '');
    if (babyName !== (b.name || '')) changes.push('Name');
    if (selectedGender !== (b.gender || 'boy')) changes.push('Gender');
    if (babyPhoto !== (b.avatar || b.avatar_url || null)) changes.push('Profile photo');
    if (bloodType !== (b.bloodType || '')) changes.push('Blood type');
    if (allergies !== currentAllergies) changes.push('Allergies');
    if (medicalNotes !== (b.medicalNotes || '')) changes.push('Medical notes');
    if (weight !== numToStr(b.weight)) changes.push('Weight');
    if (height !== numToStr(b.height)) changes.push('Height');
    if (emergencyContact !== (b.emergencyContact || '')) changes.push('Emergency contact');
    if (pediatrician !== (b.pediatrician || '')) changes.push('Pediatrician');
    if (birthWeight !== numToStr(b.birthWeight)) changes.push('Birth weight');
    if (birthHeight !== numToStr(b.birthHeight)) changes.push('Birth height');
    if (birthHeadCircumference !== numToStr(b.birthHeadCircumference)) changes.push('Head circumference');
    if (gestationalWeeks !== numToStr(b.gestationalWeeks)) changes.push('Gestational weeks');
    if (apgar1Min !== numToStr(b.apgar1Min)) changes.push('Apgar 1min');
    if (apgar5Min !== numToStr(b.apgar5Min)) changes.push('Apgar 5min');
    if (deliveryType !== dbToFormEnum(b.deliveryType)) changes.push('Delivery type');
    if (birthAttendant !== dbToFormEnum(b.birthAttendant)) changes.push('Birth attendant');
    if (birthPlace !== (b.birthPlace || '')) changes.push('Birth place');
    if (multipleBirth !== (b.multipleBirth === true)) changes.push('Multiple birth');
    if (birthOrder !== numToStr(b.birthOrder)) changes.push('Birth order');
    if (feedingPlan !== dbToFormEnum(b.feedingPlan)) changes.push('Feeding plan');
    if (birthTime !== (b.birthTime || '')) changes.push('Birth time');
    if (notificationsEnabled !== (b.notificationsEnabled !== false)) changes.push('Notifications');
    return changes;
  }, [currentBabyData, babyName, selectedGender, babyPhoto, bloodType, allergies, medicalNotes, weight, height, emergencyContact, pediatrician, birthWeight, birthHeight, birthHeadCircumference, gestationalWeeks, apgar1Min, apgar5Min, deliveryType, birthAttendant, birthPlace, multipleBirth, birthOrder, feedingPlan, birthTime, notificationsEnabled]);

  const handleSavePress = () => {
    if (saveConfirmOpenRef.current || isSaving) return;
    const changes = checkForChanges();
    if (changes.length === 0) { sweetAlert.toast('No Changes', 'No modifications detected'); return; }
    saveConfirmOpenRef.current = true;
    sweetAlert.confirm('Save Changes?', `You are about to update:\n${changes.join('\n')}`, async () => {
      try { await handleSave(); } finally { saveConfirmOpenRef.current = false; }
    }, () => { saveConfirmOpenRef.current = false; }, 'Save', 'Cancel');
  };

  const handleSave = async () => {
    try {
      if (!currentBabyData) return;
      setIsSaving(true);
      const currentAvatar = currentBabyData.avatar || currentBabyData.avatar_url || '';
      let avatarUrl = currentBabyData.avatar_url || currentBabyData.avatar || '';
      let avatarUpdated = false;
      if (babyPhoto && babyPhoto !== currentAvatar && (babyPhoto.startsWith('file://') || babyPhoto.startsWith('content://') || babyPhoto.startsWith('http'))) {
        if (babyPhoto.startsWith('http')) { avatarUrl = babyPhoto; avatarUpdated = true; }
        else {
          try {
            const uploadedUrl = await uploadImageToSupabase(babyPhoto, currentBabyData.id);
            if (uploadedUrl) { avatarUrl = uploadedUrl; avatarUpdated = true; }
            else { const permanentUri = await persistPickedImage(babyPhoto, currentBabyData.id); if (permanentUri) { avatarUrl = permanentUri; avatarUpdated = true; } }
          } catch { const permanentUri = await persistPickedImage(babyPhoto, currentBabyData.id); if (permanentUri) { avatarUrl = permanentUri; avatarUpdated = true; } }
        }
      } else if (babyPhoto && !babyPhoto.startsWith('file://') && !babyPhoto.startsWith('content://') && !babyPhoto.startsWith('http')) {
        avatarUrl = babyPhoto; avatarUpdated = true;
      }
      const b: any = currentBabyData;
      const currentAllergies = Array.isArray(b.allergies) ? b.allergies.join(', ') : (b.allergies || '');
      const babyUpdates: any = {};
      if (babyName !== (b.name || '')) babyUpdates.name = babyName;
      if (selectedSkin !== (typeof b.skinTone === 'number' ? b.skinTone : 2)) babyUpdates.skinTone = selectedSkin;
      if (selectedGender !== (b.gender || 'boy')) babyUpdates.gender = selectedGender;
      if (birthDate.toISOString() !== (b.birthDate || '')) babyUpdates.birthDate = birthDate.toISOString();
      if (bloodType !== (b.bloodType || '')) babyUpdates.bloodType = bloodType || null;
      if (allergies !== currentAllergies) babyUpdates.allergies = allergies ? allergies.split(',').map(a => a.trim()).filter(Boolean) : [];
      if (medicalNotes !== (b.medicalNotes || '')) babyUpdates.medicalNotes = medicalNotes || null;
      if (weight !== numToStr(b.weight)) babyUpdates.weight = weight || null;
      if (height !== numToStr(b.height)) babyUpdates.height = height || null;
      if (emergencyContact !== (b.emergencyContact || '')) babyUpdates.emergencyContact = emergencyContact || null;
      if (pediatrician !== (b.pediatrician || '')) babyUpdates.pediatrician = pediatrician || null;
      if (notificationsEnabled !== (b.notificationsEnabled !== false)) babyUpdates.notificationsEnabled = notificationsEnabled;
      if (birthWeight !== numToStr(b.birthWeight)) babyUpdates.birthWeight = birthWeight || null;
      if (birthHeight !== numToStr(b.birthHeight)) babyUpdates.birthHeight = birthHeight || null;
      if (birthHeadCircumference !== numToStr(b.birthHeadCircumference)) babyUpdates.birthHeadCircumference = birthHeadCircumference || null;
      if (gestationalWeeks !== numToStr(b.gestationalWeeks)) babyUpdates.gestationalWeeks = gestationalWeeks || null;
      if (apgar1Min !== numToStr(b.apgar1Min)) babyUpdates.apgar1Min = apgar1Min || null;
      if (apgar5Min !== numToStr(b.apgar5Min)) babyUpdates.apgar5Min = apgar5Min || null;
      if (deliveryType !== dbToFormEnum(b.deliveryType)) babyUpdates.deliveryType = formEnumToDb(deliveryType);
      if (birthAttendant !== dbToFormEnum(b.birthAttendant)) babyUpdates.birthAttendant = formEnumToDb(birthAttendant);
      if (birthPlace !== (b.birthPlace || '')) babyUpdates.birthPlace = birthPlace || null;
      if (multipleBirth !== (b.multipleBirth === true)) babyUpdates.multipleBirth = multipleBirth;
      if (birthOrder !== numToStr(b.birthOrder)) babyUpdates.birthOrder = birthOrder || null;
      if (feedingPlan !== dbToFormEnum(b.feedingPlan)) babyUpdates.feedingPlan = feedingPlan ? feedingPlan.toLowerCase() : null;
      if (birthTime !== (b.birthTime || '')) babyUpdates.birthTime = birthTime || null;
      if (avatarUpdated) { babyUpdates.avatar = avatarUrl; babyUpdates.avatar_url = avatarUrl; }
      if (Object.keys(babyUpdates).length === 0) { setIsSaving(false); setIsEditing(false); return; }
      babyUpdates.lastUpdated = new Date().toISOString();
      await updateBaby(currentBabyData.id, babyUpdates);
      setIsEditing(false);
      if (avatarUpdated) setBabyPhoto(avatarUrl);
      await refreshBabyDataLight();

      // If the avatar changed, fan out so family/chat/baby lists
      // that show the baby avatar re-render. We broadcast against
      // the baby's parent1 (the authoritative user id for the baby
      // scope) so subscribers can invalidate the right caches.
      if (avatarUpdated) {
        try {
          const { broadcastProfileChange } = require('../../context/AuthContext');
          const broadcasterId = currentBabyData.parent1Id || userProfile?.id;
          if (broadcasterId) {
            await broadcastProfileChange({ userId: broadcasterId, fields: ['avatar'] });
          }
        } catch {}
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sweetAlert.success('Profile Saved!', `${babyName}'s profile has been updated.`);
    } catch (error) { if (__DEV__) console.warn('[BabyProfile] Save error:', error); sweetAlert.error('Error', 'Failed to update profile'); }
    finally { setIsSaving(false); }
  };

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: '', category: 'physical' as Milestone['category'], description: '', achievedAt: new Date().toISOString().split('T')[0] });

  const handleAddMilestone = async () => {
    if (!currentBabyData || !newMilestone.title) return;
    const success = await addMilestone({ babyId: currentBabyData.id, title: newMilestone.title, category: newMilestone.category, description: newMilestone.description, achievedAt: newMilestone.achievedAt });
    if (success) {
      setShowAddMilestone(false);
      setNewMilestone({ title: '', category: 'physical', description: '', achievedAt: new Date().toISOString().split('T')[0] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sweetAlert.success('Milestone Recorded!', 'Another amazing achievement!');
      await refreshBabyDataLight();
    } else sweetAlert.error('Error', 'Could not save milestone');
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    sweetAlert.confirm('Delete Milestone', 'Are you sure you want to delete this milestone?', async () => {
      await deleteMilestone(milestoneId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      sweetAlert.success('Deleted', 'Milestone has been removed.');
      await refreshBabyDataLight();
    }, () => {}, 'Delete', 'Cancel');
  };

  const { verifyPassword } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBaby = useCallback(() => {
    if (isDeleting || saveConfirmOpenRef.current) return;
    saveConfirmOpenRef.current = true;
    sweetAlert.confirm('Delete Profile?', `⚠️ This will permanently delete ${currentBabyData?.name}'s profile and all associated data. This action cannot be undone.`, () => {
      sweetAlert.hide();
      setTimeout(() => {
        sweetAlert.securePrompt('Confirm Password', `Enter your password to permanently delete ${currentBabyData?.name}'s profile:`, async (password: string) => {
          if (!password) { sweetAlert.error('Error', 'Password is required'); setIsDeleting(false); return; }
          if (isDeleting) return;
          setIsDeleting(true);
          try {
            const isValid = await verifyPassword(password);
            if (!isValid) { sweetAlert.error('Error', 'Incorrect password. Please try again.'); setIsDeleting(false); return; }
            if (currentBabyData) {
              await deleteBaby(currentBabyData.id);
              sweetAlert.success('Profile Deleted', `${currentBabyData.name}'s profile has been removed.`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setIsDeleting(false); saveConfirmOpenRef.current = false;
              setTimeout(() => navigation.goBack(), 1500);
            }
          } catch { sweetAlert.error('Error', 'Failed to delete profile'); setIsDeleting(false); }
        }, () => { setIsDeleting(false); saveConfirmOpenRef.current = false; }, 'Delete', 'Cancel');
      }, 300);
    }, () => { setIsDeleting(false); saveConfirmOpenRef.current = false; }, 'Delete', 'Cancel');
  }, [currentBabyData, deleteBaby, navigation, sweetAlert, verifyPassword, isDeleting]);

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) { setBirthDate(selectedDate); setIsEditing(true); }
  };

  const handleTabChange = useCallback((tab: ProfileTab) => {
    if (!IS_FABRIC) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadFullData(); } catch (error) { if (__DEV__) console.warn('[BabyProfile] refresh error:', error); }
    finally { setRefreshing(false); }
  }, [loadFullData]);

  const recentActivities = useMemo(() => {
    if (!currentBabyData?.id) return [];
    const id = currentBabyData.id;
    return trackerEntries.filter((e: any) => {
      if (!e || e.isDeleted) return false;
      const entryBabyId = e.babyId || e.baby_id;
      if (!entryBabyId) return false;
      return String(entryBabyId) === String(id);
    }).sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 30);
  }, [trackerEntries, currentBabyData?.id]);

  const babyMilestones = useMemo(() => {
    if (!currentBabyData?.id) return [];
    return milestones.filter(m => m.babyId === currentBabyData.id).sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }, [milestones, currentBabyData?.id]);

  const babyStats = useMemo(() => {
    if (!currentBabyData) return null;
    return { streak: currentBabyData.streak || 0, milestones: babyMilestones.length, photos: currentBabyData.photos || 0, entries: recentActivities.length };
  }, [currentBabyData, babyMilestones.length, recentActivities.length]);

  const genderOption = GENDER_OPTIONS.find(g => g.value === selectedGender);
  const ageDisplay = calculateAge(currentBabyData?.birthDate || new Date().toISOString());

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' as const },
    { key: 'milestones' as ProfileTab, label: 'Milestones', icon: 'trophy-outline' as const },
    { key: 'health' as ProfileTab, label: 'Health', icon: 'medical-outline' as const },
    { key: 'family' as ProfileTab, label: 'Family', icon: 'people-outline' as const },
  ];

  const renderPickerModal = () => {
    const type = pickerState.type;
    if (!type || !pickerState.visible) return null;
    let options: string[] = []; let title = ''; let value = '';
    switch (type) {
      case 'bloodType': options = BLOOD_TYPES; title = 'Select Blood Type'; value = bloodType; break;
      case 'deliveryType': options = DELIVERY_TYPES; title = 'Select Delivery Type'; value = deliveryType; break;
      case 'birthAttendant': options = BIRTH_ATTENDANTS; title = 'Select Birth Attendant'; value = birthAttendant; break;
      case 'feedingPlan': options = FEEDING_PLANS; title = 'Select Feeding Plan'; value = feedingPlan; break;
    }
    return (
      <PickerModal visible={true} onClose={() => setPickerState({ visible: false, type: null })} onSelect={(val) => {
        switch (type) {
          case 'bloodType': setBloodType(val); break;
          case 'deliveryType': setDeliveryType(val); break;
          case 'birthAttendant': setBirthAttendant(val); break;
          case 'feedingPlan': setFeedingPlan(val); break;
        }
        setIsEditing(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }} options={options} selectedValue={value} title={title} isDark={isDark} />
    );
  };

  const gotoBirthDetailsEditor = useCallback(() => { setActiveTab('health'); setIsEditing(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, []);

  /* ─── Ribbon ─── */
  const topRibbon = useMemo(() => {
    if (!currentBabyData) return { icon: 'information-circle-outline' as const, color: DS.info, label: 'No profile', text: 'Create a profile to get started' };
    if (medicalNotes || allergies) return { icon: 'medical-outline' as const, color: DS.warning, label: 'Health note', text: medicalNotes || `Allergies: ${allergies}`, onPress: () => setActiveTab('health') };
    if (babyMilestones.length === 0) return { icon: 'trophy-outline' as const, color: DS.accent, label: 'Track wins', text: 'Record first milestone to unlock patterns', onPress: () => setActiveTab('milestones') };
    const daysOld = safeDiffDays(new Date(), birthDate);
    if (daysOld < 30) return { icon: 'sparkles-outline' as const, color: DS.primary, label: 'Newborn', text: `${daysOld} days old — precious early days`, onPress: () => setActiveTab('overview') };
    return { icon: 'leaf-outline' as const, color: DS.success, label: 'On track', text: `${babyMilestones.length} milestones · ${recentActivities.length} entries logged`, onPress: () => setActiveTab('overview') };
  }, [currentBabyData, medicalNotes, allergies, babyMilestones.length, recentActivities.length, birthDate]);

  if (!currentBabyData && !isHydrating) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <Ionicons name="person-outline" size={64} color={DS.gray400} />
        <Text style={{ marginTop: 16, color: isDark ? DS.gray400 : DS.gray500, fontSize: 16, fontWeight: '600' }}>Baby not found</Text>
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.96}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: DS.white }}>Go Back</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{currentBabyData?.name || 'Baby Profile'}</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{ageDisplay} · {genderOption?.label}</Text>
      </Animated.View>

      {/* Back button */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
      >
        {/* Identity Capsule */}
        <View style={{ paddingHorizontal: DS.space.lg }}>
          {isHydrating && !currentBabyData ? (
            <CapsuleSkeleton isDark={isDark} />
          ) : (
            <BabyIdentityCapsule
              isDark={isDark}
              babyPhoto={babyPhoto}
              babyName={babyName}
              gender={selectedGender}
              ageDisplay={ageDisplay}
              isEditing={isEditing}
              babyStats={babyStats}
              onAvatarPress={showPhotoOptions}
              onEdit={() => setIsEditing(!isEditing)}
              onSave={handleSavePress}
              isSaving={isSaving}
              onDelete={handleDeleteBaby}
              canEdit={!!currentBabyData}
            />
          )}
        </View>

        {/* Insight ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Tab bar */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {/* Body */}
        {!currentBabyData ? (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ height: 96, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', marginBottom: 12 }} />
            ))}
          </View>
        ) : (
          <>
            {/* ─── OVERVIEW ─── */}
            {activeTab === 'overview' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <StatTiles isDark={isDark} stats={[
                  { icon: 'flame-outline', value: babyStats?.streak || 0, label: 'Streak', color: DS.warning },
                  { icon: 'trophy-outline', value: babyStats?.milestones || 0, label: 'Wins', color: DS.accent },
                  { icon: 'document-text-outline', value: babyStats?.entries || 0, label: 'Entries', color: DS.primary },
                ]} />

                <HealthStatusCard isDark={isDark} medicalNotes={medicalNotes} allergies={allergies} />

                <PressableScale onPress={() => setShowDatePicker(true)} activeScale={0.98}>
                  <View style={[styles.dateCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <View style={[styles.dateIcon, { backgroundColor: `${DS.primary}15` }]}>
                      <Ionicons name="calendar-outline" size={18} color={DS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dateLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Birth Date</Text>
                      <Text style={[styles.dateValue, { color: isDark ? DS.white : DS.gray900 }]}>{format(birthDate, 'MMMM d, yyyy')}</Text>
                      {birthTime ? <Text style={[styles.dateSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>🕐 {birthTime}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                  </View>
                </PressableScale>

                <SectionHeader title="Birth Details" subtitle="Information from birth" icon="sparkles-outline" color={DS.primary} />
                <BirthDetailsGrid isDark={isDark} isCompact={isCompact} onAddMissing={(!birthWeight || !birthHeight) ? gotoBirthDetailsEditor : undefined} items={[
                  { label: 'Weight', value: birthWeight, suffix: ' kg' },
                  { label: 'Height', value: birthHeight, suffix: ' cm' },
                  { label: 'Head', value: birthHeadCircumference, suffix: ' cm' },
                  { label: 'Gestational', value: gestationalWeeks, suffix: ' w' },
                  { label: 'Apgar 1m', value: apgar1Min, suffix: '' },
                  { label: 'Apgar 5m', value: apgar5Min, suffix: '' },
                  { label: 'Delivery', value: deliveryType, suffix: '' },
                  { label: 'Attendant', value: birthAttendant, suffix: '' },
                  { label: 'Birth Place', value: birthPlace, suffix: '' },
                  { label: 'Feeding', value: feedingPlan, suffix: '' },
                  { label: 'Blood Type', value: bloodType, suffix: '' },
                  { label: 'Birth Order', value: birthOrder, suffix: '' },
                ]} />

                <SectionHeader title="Recent Activity" subtitle={`${recentActivities.length} entries`} icon="time-outline" color={DS.accent} action={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)} actionLabel="View All" />
                {recentActivities.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <Ionicons name="time-outline" size={32} color={DS.primary} />
                    <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No activity yet</Text>
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Start tracking to see patterns emerge</Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {recentActivities.slice(0, 8).map((activity: any, i: number) => (
                      <ActivityRow key={activity.id || i} activity={activity} index={i} isDark={isDark} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ─── MILESTONES ─── */}
            {activeTab === 'milestones' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <PressableScale onPress={() => setShowAddMilestone(true)} activeScale={0.97}>
                  <LinearGradient colors={[DS.warning, '#f97316']} style={styles.addMilestoneBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="add" size={20} color={DS.white} />
                    <Text style={styles.addMilestoneText}>Record New Milestone</Text>
                  </LinearGradient>
                </PressableScale>

                {babyMilestones.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <Ionicons name="trophy-outline" size={40} color={DS.warning} />
                    <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No Milestones Yet</Text>
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Record first smile, steps, words, and more!</Text>
                  </View>
                ) : babyMilestones.map((milestone, i) => (
                  <MilestoneRow key={milestone.id} milestone={milestone} index={i} onDelete={handleDeleteMilestone} isDark={isDark} />
                ))}
              </View>
            )}

            {/* ─── HEALTH ─── */}
            {activeTab === 'health' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <GlassCard isDark={isDark}>
                  <View style={{ padding: DS.space.md }}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Health Info</Text>
                      {!isEditing ? (
                        <PressableScale onPress={() => setIsEditing(true)} activeScale={0.9}>
                          <View style={[styles.editPill, { backgroundColor: `${DS.primary}15` }]}>
                            <Ionicons name="create-outline" size={13} color={DS.primary} />
                            <Text style={[styles.editPillText, { color: DS.primary }]}>Edit</Text>
                          </View>
                        </PressableScale>
                      ) : (
                        <View style={[styles.editBadgeActive, { backgroundColor: `${DS.warning}15` }]}>
                          <Text style={[styles.editBadgeActiveText, { color: DS.warning }]}>Editing</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Blood Type</Text>
                    <TouchableOpacity style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]} onPress={() => isEditing && setPickerState({ visible: true, type: 'bloodType' })} disabled={!isEditing}>
                      <Ionicons name="water-outline" size={16} color={DS.primary} />
                      <Text style={[styles.inputText, { color: bloodType ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray500 : DS.gray400) }]}>{bloodType || 'Select'}</Text>
                      <Ionicons name="chevron-down" size={16} color={isEditing ? DS.primary : DS.gray400} />
                    </TouchableOpacity>

                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Allergies</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Ionicons name="warning-outline" size={16} color={DS.warning} />
                      <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={allergies} onChangeText={(t) => { setAllergies(t); setIsEditing(true); }} placeholder="e.g., Peanuts" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} editable={isEditing} selectionColor={DS.primary} />
                    </View>

                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Medical Notes</Text>
                    <TextInput style={[styles.textArea, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, color: isDark ? DS.white : DS.gray900 }, !isEditing && { opacity: 0.5 }]} value={medicalNotes} onChangeText={(t) => { setMedicalNotes(t); setIsEditing(true); }} placeholder="Any important health info..." placeholderTextColor={isDark ? DS.gray500 : DS.gray400} multiline numberOfLines={3} editable={isEditing} selectionColor={DS.primary} />

                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Weight (kg)</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Ionicons name="fitness-outline" size={16} color={DS.primary} />
                      <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={weight} onChangeText={(t) => { setWeight(t); setIsEditing(true); }} placeholder="e.g., 4.2" keyboardType="decimal-pad" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} editable={isEditing} selectionColor={DS.primary} />
                    </View>

                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Height (cm)</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Ionicons name="resize-outline" size={16} color={DS.primary} />
                      <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={height} onChangeText={(t) => { setHeight(t); setIsEditing(true); }} placeholder="e.g., 58" keyboardType="decimal-pad" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} editable={isEditing} selectionColor={DS.primary} />
                    </View>
                  </View>
                </GlassCard>

                <GlassCard isDark={isDark} delay={80}>
                  <View style={{ padding: DS.space.md }}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Birth Details</Text>
                      {!isEditing && (
                        <PressableScale onPress={gotoBirthDetailsEditor} activeScale={0.9}>
                          <View style={[styles.editPill, { backgroundColor: `${DS.primary}15` }]}>
                            <Ionicons name="create-outline" size={13} color={DS.primary} />
                            <Text style={[styles.editPillText, { color: DS.primary }]}>Edit</Text>
                          </View>
                        </PressableScale>
                      )}
                    </View>

                    {[
                      { label: 'Birth Weight (kg)', icon: 'scale-outline', value: birthWeight, setter: setBirthWeight, key: 'decimal-pad' },
                      { label: 'Birth Height (cm)', icon: 'resize-outline', value: birthHeight, setter: setBirthHeight, key: 'decimal-pad' },
                      { label: 'Head Circ. (cm)', icon: 'aperture-outline', value: birthHeadCircumference, setter: setBirthHeadCircumference, key: 'decimal-pad' },
                      { label: 'Gestational Weeks', icon: 'calendar-outline', value: gestationalWeeks, setter: setGestationalWeeks, key: 'number-pad' },
                      { label: 'Apgar 1min', icon: 'pulse-outline', value: apgar1Min, setter: setApgar1Min, key: 'number-pad' },
                      { label: 'Apgar 5min', icon: 'pulse-outline', value: apgar5Min, setter: setApgar5Min, key: 'number-pad' },
                      { label: 'Birth Place', icon: 'location-outline', value: birthPlace, setter: setBirthPlace, key: 'default' },
                      { label: 'Birth Order', icon: 'list-outline', value: birthOrder, setter: setBirthOrder, key: 'number-pad' },
                      { label: 'Birth Time', icon: 'time-outline', value: birthTime, setter: setBirthTime, key: 'default' },
                    ].map((f, i) => (
                      <View key={i} style={{ marginTop: DS.space.md }}>
                        <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{f.label}</Text>
                        <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                          <Ionicons name={f.icon as any} size={16} color={DS.primary} />
                          <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={f.value} onChangeText={(t) => { f.setter(t); setIsEditing(true); }} keyboardType={f.key as any} placeholder="—" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} editable={isEditing} selectionColor={DS.primary} />
                        </View>
                      </View>
                    ))}

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: DS.space.md }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Delivery</Text>
                        <TouchableOpacity style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]} onPress={() => isEditing && setPickerState({ visible: true, type: 'deliveryType' })} disabled={!isEditing}>
                          <Text style={[styles.inputText, { color: deliveryType ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray500 : DS.gray400), flex: 1 }]}>{deliveryType || 'Select'}</Text>
                          <Ionicons name="chevron-down" size={14} color={DS.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Feeding Plan</Text>
                        <TouchableOpacity style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]} onPress={() => isEditing && setPickerState({ visible: true, type: 'feedingPlan' })} disabled={!isEditing}>
                          <Text style={[styles.inputText, { color: feedingPlan ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray500 : DS.gray400), flex: 1 }]}>{feedingPlan || 'Select'}</Text>
                          <Ionicons name="chevron-down" size={14} color={DS.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </GlassCard>

                <GlassCard isDark={isDark} delay={160}>
                  <View style={{ padding: DS.space.md }}>
                    <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Emergency & Pediatrician</Text>

                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Emergency Contact</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Ionicons name="call-outline" size={16} color={DS.danger} />
                      <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={emergencyContact} onChangeText={(t) => { setEmergencyContact(t); setIsEditing(true); }} placeholder="+1 (555) 123-4567" keyboardType="phone-pad" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} editable={isEditing} selectionColor={DS.primary} />
                    </View>

                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Pediatrician</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Ionicons name="medical-outline" size={16} color={DS.success} />
                      <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={pediatrician} onChangeText={(t) => { setPediatrician(t); setIsEditing(true); }} placeholder="Dr. Smith" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} editable={isEditing} selectionColor={DS.primary} />
                    </View>

                    <View style={[styles.prefRow, { borderTopColor: isDark ? DS.darkBorder : DS.gray200, marginTop: DS.space.md, paddingTop: DS.space.md }]}>
                      <Ionicons name="notifications-outline" size={20} color={DS.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.prefLabel, { color: isDark ? DS.white : DS.gray900 }]}>Notifications</Text>
                        <Text style={[styles.prefDesc, { color: isDark ? DS.gray500 : DS.gray400 }]}>Milestone & health reminders</Text>
                      </View>
                      <Switch value={notificationsEnabled} onValueChange={(v) => { setNotificationsEnabled(v); setIsEditing(true); }} trackColor={{ false: DS.gray300, true: DS.primary }} thumbColor={DS.white} disabled={!isEditing} />
                    </View>
                  </View>
                </GlassCard>

                {isEditing && (
                  <PressableScale onPress={handleSavePress} activeScale={0.97}>
                    <LinearGradient colors={[DS.primary, DS.accent]} style={styles.saveBigBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      {isSaving ? <ActivityIndicator size="small" color={DS.white} /> : <Text style={styles.saveBigText}>Save All Changes</Text>}
                    </LinearGradient>
                  </PressableScale>
                )}
              </View>
            )}

            {/* ─── FAMILY ─── */}
            {activeTab === 'family' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <GlassCard isDark={isDark}>
                  <View style={{ padding: DS.space.md }}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.cardIcon, { backgroundColor: `${DS.primary}15` }]}>
                          <Ionicons name="people" size={14} color={DS.primary} />
                        </View>
                        <View>
                          <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Family Tree</Text>
                          <Text style={[styles.cardSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>{members.length} connected</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.familyRow}>
                      {members.filter(m => m.role === UserRole.PARENT_1 || m.role === UserRole.PARENT_2).map((m, i) => {
                        const roleKey = m.role === UserRole.PARENT_1 ? 'parent1' : 'parent2';
                        const displayLabel = getMemberDisplayLabel({ role: m.role, relationship: m.relationship });
                        return (
                          <FamilyNode
                            key={`${m.id}_${m.role}_${i}`}
                            member={m}
                            roleKey={roleKey}
                            index={i}
                            onPress={() => sweetAlert.alert(
                              m.fullName,
                              `${displayLabel}\n${m.email || 'No email'}`,
                            )}
                            isDark={isDark}
                            size={FAMILY_NODE_SIZE * 0.55}
                          />
                        );
                      })}
                      <Animated.View entering={FadeInUp.delay(150).springify()}>
                        <View style={[styles.familyNode, styles.familyNodeHighlight, { backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)', borderColor: DS.warning }]}>
                          <LinearGradient colors={ROLE_PRESENTATION.baby.gradient} style={[styles.familyAvatar, { width: FAMILY_NODE_SIZE * 0.55, height: FAMILY_NODE_SIZE * 0.55, borderRadius: FAMILY_NODE_SIZE * 0.275 }]}>
                            {isImageUri(babyPhoto) ? <Image source={{ uri: babyPhoto as string }} style={{ width: '100%', height: '100%' }} /> : isEmoji(babyPhoto) ? <Text style={{ fontSize: FAMILY_NODE_SIZE * 0.35 }}>{babyPhoto}</Text> : <Ionicons name={ROLE_PRESENTATION.baby.icon} size={FAMILY_NODE_SIZE * 0.3} color={DS.white} />}
                          </LinearGradient>
                          <Text style={[styles.familyName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{currentBabyData?.name || 'Baby'}</Text>
                          <View style={[styles.familyBadge, { backgroundColor: `${ROLE_PRESENTATION.baby.color}18` }]}>
                            <Text style={[styles.familyBadgeText, { color: ROLE_PRESENTATION.baby.color }]}>{calculateAge(currentBabyData?.birthDate || '')}</Text>
                          </View>
                        </View>
                      </Animated.View>
                      {members.filter(m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER).map((m, i) => {
                        const roleKey = m.role === UserRole.GUARDIAN ? 'guardian' : 'viewer';
                        const displayLabel = getMemberDisplayLabel({ role: m.role, relationship: m.relationship });
                        return (
                          <FamilyNode
                            key={`${m.id}_${m.role}_guardian_${i}`}
                            member={m}
                            roleKey={roleKey}
                            index={i + 2}
                            onPress={() => sweetAlert.alert(
                              m.fullName,
                              `${displayLabel}\n${m.email || 'No email'}`,
                            )}
                            isDark={isDark}
                            size={FAMILY_NODE_SIZE * 0.55}
                          />
                        );
                      })}
                    </View>
                  </View>
                </GlassCard>

                <SectionHeader title="Invite to Family" subtitle="Share with someone you trust" icon="person-add-outline" color={DS.success} />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['parent2', 'guardian', 'viewer'] as const).map((role) => {
                    const meta = ROLE_PRESENTATION[role];
                    const inviteLabel =
                      role === 'parent2' ? 'Co-Parent'
                      : role === 'guardian' ? 'Guardian'
                      : 'Viewer';
                    return (
                      <PressableScale key={role} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('FamilySharing' as never); }} activeScale={0.94} style={{ flex: 1 }}>
                        <View style={[styles.inviteCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                          <LinearGradient colors={meta.gradient} style={styles.inviteIcon}>
                            <Ionicons name={meta.icon} size={18} color={DS.white} />
                          </LinearGradient>
                          <Text style={[styles.inviteLabel, { color: isDark ? DS.gray300 : DS.gray700 }]}>{inviteLabel}</Text>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      {/* Image Picker Modal */}
      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Photo" isDark={isDark}>
        <View style={{ padding: 4 }}>
          {[
            { icon: 'images-outline', label: 'Choose from Library', color: DS.primary, onPress: () => { setShowImagePicker(false); setTimeout(handlePickImage, 250); } },
            { icon: 'camera-outline', label: 'Take Photo', color: DS.success, onPress: () => { setShowImagePicker(false); setTimeout(handleTakePhoto, 250); } },
            { icon: 'happy-outline', label: 'Pick Emoji', color: DS.warning, onPress: () => { setShowImagePicker(false); setTimeout(() => setShowEmojiPicker(true), 250); } },
          ].map((opt, i) => (
            <TouchableOpacity key={i} onPress={opt.onPress} style={styles.pickerOption}>
              <View style={[styles.pickerIcon, { backgroundColor: `${opt.color}20` }]}>
                <Ionicons name={opt.icon as any} size={22} color={opt.color} />
              </View>
              <Text style={[styles.pickerLabel, { color: isDark ? DS.white : DS.gray900 }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ActionModal>

      {/* Add Milestone Modal */}
      <ActionModal visible={showAddMilestone} onClose={() => setShowAddMilestone(false)} title="Record Milestone" isDark={isDark}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>
          <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Title</Text>
          <TextInput style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]} value={newMilestone.title} onChangeText={(t) => setNewMilestone(prev => ({ ...prev, title: t }))} placeholder="e.g., First Steps" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} selectionColor={DS.primary} />

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MILESTONE_CATEGORIES.map(cat => {
              const active = newMilestone.category === cat.id;
              return (
                <TouchableOpacity key={cat.id} onPress={() => setNewMilestone(prev => ({ ...prev, category: cat.id as Milestone['category'] }))} style={[styles.catChip, { backgroundColor: active ? `${cat.color}20` : (isDark ? 'rgba(255,255,255,0.06)' : DS.gray100), borderColor: active ? cat.color : 'transparent' }]}>
                  <Text style={[styles.catChipText, { color: active ? cat.color : (isDark ? DS.gray300 : DS.gray700) }]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Description</Text>
          <TextInput style={[styles.input, styles.inputMulti, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]} value={newMilestone.description} onChangeText={(t) => setNewMilestone(prev => ({ ...prev, description: t }))} placeholder="Optional details..." placeholderTextColor={isDark ? DS.gray500 : DS.gray400} multiline />

          <PressableScale onPress={handleAddMilestone} activeScale={0.97} style={{ marginTop: DS.space.md }}>
            <LinearGradient colors={[DS.warning, '#f97316']} style={styles.saveBigBtn}>
              <Text style={styles.saveBigText}>Save Milestone</Text>
            </LinearGradient>
          </PressableScale>
        </ScrollView>
      </ActionModal>

      <EmojiPickerModal visible={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} onSelect={handleEmojiSelect} isDark={isDark} />

      {renderPickerModal()}

      {showDatePicker && (
        <DateTimePicker value={birthDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} maximumDate={new Date()} />
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  capsule: { borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 92, height: 92, borderRadius: 46 },
  avatarRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  avatarInner: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: DS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  capsuleName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  capsuleMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  capsuleStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  capsuleStatItem: { alignItems: 'center' },
  capsuleStatValue: { fontSize: 14, fontWeight: '800' },
  capsuleStatLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  capsuleStatDiv: { width: 1, height: 18 },
  capsuleActions: { flexDirection: 'row', gap: 8, marginTop: DS.space.md },
  actionPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  actionPrimaryText: { fontSize: 13, fontWeight: '700' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  glassCard: { borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  cardIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 11, fontWeight: '700' },

  statTiles: { flexDirection: 'row', gap: 8 },
  statTile: { padding: 12, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 4, ...DS.shadow.sm },
  statTileIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statTileValue: { fontSize: 18, fontWeight: '800' },
  statTileLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  healthIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  kpiPill: { padding: 12, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 4, overflow: 'hidden' },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  dateCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  dateIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  dateValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  dateSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  birthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  birthItem: { flexGrow: 1, flexBasis: 0, padding: 10, borderRadius: 10 },
  birthLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  birthValue: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  addMissingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  addMissingText: { fontSize: 12, fontWeight: '700' },

  emptyCard: { alignItems: 'center', paddingVertical: DS.space['2xl'], paddingHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, gap: 8, ...DS.shadow.sm },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17 },

  activityCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  activityIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 13, fontWeight: '700' },
  activityNotes: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  activityTime: { fontSize: 10, fontWeight: '500', marginTop: 3 },
  activityBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  activityBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  milestoneCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  milestoneIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  milestoneTitle: { fontSize: 14, fontWeight: '700' },
  milestoneCat: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  milestoneCatText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  milestoneDate: { fontSize: 10, fontWeight: '500' },
  milestoneDesc: { fontSize: 11, fontWeight: '500', marginTop: 4, lineHeight: 15 },
  deleteBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  addMilestoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: DS.radius.md, ...DS.shadow.md },
  addMilestoneText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  editPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  editPillText: { fontSize: 11, fontWeight: '700' },
  editBadgeActive: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  editBadgeActiveText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  inputLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 11 },
  inputText: { fontSize: 13, fontWeight: '600' },
  input: { height: 44, borderRadius: 11, paddingHorizontal: 12, fontSize: 14, fontWeight: '600' },
  inputMulti: { height: 76, paddingTop: 12, textAlignVertical: 'top' },
  textArea: { height: 80, borderRadius: 11, paddingHorizontal: 12, paddingTop: 10, fontSize: 13, fontWeight: '500', textAlignVertical: 'top' },

  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1 },
  prefLabel: { fontSize: 13, fontWeight: '600' },
  prefDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  saveBigBtn: { paddingVertical: 14, borderRadius: DS.radius.md, alignItems: 'center' },
  saveBigText: { color: DS.white, fontSize: 14, fontWeight: '700' },

  familyRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: DS.space.md },
  familyNode: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 16, borderWidth: 1, minWidth: 80 },
  familyNodeHighlight: { borderWidth: 2 },
  familyAvatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  familyName: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 3, maxWidth: 80 },
  familyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  familyBadgeText: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  inviteCard: { padding: 12, borderRadius: DS.radius.md, borderWidth: 1, alignItems: 'center', gap: 6 },
  inviteIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inviteLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: DS.radius['2xl'], padding: DS.space.lg, ...DS.shadow.lg, overflow: 'hidden' },
  modalDrag: { alignItems: 'center', paddingVertical: 6 },
  dragIndicator: { width: 36, height: 4, borderRadius: 2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.lg },
  modalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  pickerOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6 },
  pickerIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pickerLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  pickerItemText: { fontSize: 14, fontWeight: '600' },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  emojiBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  catChipText: { fontSize: 12, fontWeight: '700' },
});