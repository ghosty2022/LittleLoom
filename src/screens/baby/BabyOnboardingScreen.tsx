import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { supabase } from '@/utils/supabase';
import {
  createBabyInDb,
  setCurrentBabyInDb,
  getAllBabiesFromDb,
  getBabyByIdFromDb,
  getAppSetting,
} from '../../database/dbHelpers';

const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;

type Props = NativeStackScreenProps<RootStackParamList, 'BabyOptional'>;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
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

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT
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
        const color = interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo);
        return <Text key={i} style={[style, { color }]}>{l}</Text>;
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PRESSABLE SCALE
   ═══════════════════════════════════════════════════════════════════════════ */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean;
  style?: any; activeScale?: number; haptic?: 'light' | 'medium';
}>(({ children, onPress, disabled, style, activeScale = 0.96, haptic = 'light' }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    if (disabled) return;
    if (haptic === 'light') HAPTIC_LIGHT();
    else HAPTIC_MEDIUM();
    onPress?.();
  };
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={handlePress}
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
   PULSING DOT
   ═══════════════════════════════════════════════════════════════════════════ */
const PulsingDot: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => {
  const pulse = useSharedValue(1);
  const halo = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true);
    halo.value = withRepeat(withSequence(withTiming(1.8, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
  }, [pulse, halo]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    opacity: interpolate(halo.value, [1, 1.8], [0.35, 0]),
  }));
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, haloStyle]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, dotStyle]} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PULSE HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
interface PulseHeaderProps {
  isDark: boolean;
  firstName: string;
  babyCount: number;
  hasBabies: boolean;
  onSkip: () => void;
  onCreate: () => void;
  disabled: boolean;
}

const PulseHeader = React.memo<PulseHeaderProps>(({
  isDark, firstName, babyCount, hasBabies, onSkip, onCreate, disabled,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 12000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.9, { duration: 2000 }), withTiming(0.4, { duration: 2000 })), -1, true);
  }, [pulse, rotate, glow]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)', 'rgba(139,92,246,0.06)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']} style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '38' : '22'}`, 'transparent']} style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.pulseRow}>
          <View style={styles.pulseAvatarWrap}>
            <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
            <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
              <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Text style={{ fontSize: 26 }}>{hasBabies ? '👶' : '✨'}</Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.pulseTitle}>
                {hasBabies ? 'WELCOME BACK' : 'GET STARTED'}
              </GradientText>
              {babyCount > 0 && (
                <View style={[styles.pulseLivePill, { backgroundColor: `${DS.success}18` }]}>
                  <PulsingDot color={DS.success} size={6} />
                  <Text style={[styles.pulseLiveText, { color: DS.success }]}>{babyCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {hasBabies ? `Hi ${firstName}!` : `Hey ${firstName}!`}
            </Text>
            <Text style={[styles.pulseSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {hasBabies ? 'Choose a profile to continue' : 'Add your baby to start tracking'}
            </Text>
          </View>
        </View>

        {/* Action row */}
        <View style={styles.pulseActions}>
          {!hasBabies && (
            <PressableScale onPress={onCreate} activeScale={0.96} haptic="medium" disabled={disabled} style={{ flex: 2 }}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseActionPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="add-circle" size={18} color={DS.white} />
                <Text style={styles.pulseActionPrimaryText}>Create Baby</Text>
              </LinearGradient>
            </PressableScale>
          )}
          <PressableScale onPress={onSkip} activeScale={0.96} disabled={disabled} style={{ flex: 1 }}>
            <View style={[styles.pulseActionSecondary, { borderColor: isDark ? DS.darkBorder : DS.gray300, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white }]}>
              <Text style={[styles.pulseActionSecondaryText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                {hasBabies ? 'Later' : 'Skip'}
              </Text>
            </View>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, badge }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string; badge?: number;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
      )}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {badge !== undefined && badge > 0 && (
      <View style={[styles.sectionBadge, { backgroundColor: color }]}>
        <Text style={styles.sectionBadgeText}>{badge}</Text>
      </View>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   BABY CARD (existing / import)
   ═══════════════════════════════════════════════════════════════════════════ */
interface BabyCardProps {
  baby: any;
  isDark: boolean;
  isActive?: boolean;
  isImport?: boolean;
  isProcessing: boolean;
  onPress: () => void;
  index: number;
}

const BabyCard = React.memo<BabyCardProps>(({
  baby, isDark, isActive, isImport, isProcessing, onPress, index,
}) => {
  const gender = baby.gender === 'male' ? 'boy' : baby.gender === 'female' ? 'girl' : baby.gender || 'other';

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 60).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98} disabled={isProcessing}>
        <View
          style={[
            styles.babyCard,
            {
              backgroundColor: isDark ? DS.darkCard : DS.white,
              borderColor: isActive ? DS.primary : isImport ? `${DS.success}40` : isDark ? DS.darkBorder : DS.gray200,
              borderWidth: isActive ? 2 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={isActive
              ? [`${DS.primary}15`, `${DS.accent}08`]
              : isImport
              ? [`${DS.success}10`, `${DS.success}04`]
              : [`${DS.primary}04`, `${DS.accent}02`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={styles.babyCardContent}>
            <SafeBabyAvatar
              avatar={baby.avatar}
              avatarUrl={baby.avatar_url}
              gender={gender}
              size={56}
            />
            <View style={{ flex: 1, marginLeft: DS.space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.babyName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                  {baby.name}
                </Text>
                {isActive && (
                  <View style={[styles.babyActivePill, { backgroundColor: `${DS.success}18` }]}>
                    <Ionicons name="checkmark-circle" size={9} color={DS.success} />
                    <Text style={[styles.babyActiveText, { color: DS.success }]}>Active</Text>
                  </View>
                )}
                {isImport && (
                  <View style={[styles.babyActivePill, { backgroundColor: `${DS.warning}18` }]}>
                    <Ionicons name="download-outline" size={9} color={DS.warning} />
                    <Text style={[styles.babyActiveText, { color: DS.warning }]}>Import</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.babyMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {baby.age || (baby.date_of_birth ? new Date(baby.date_of_birth).toLocaleDateString() : 'Newborn')}
                {baby.gender ? ` · ${gender === 'boy' ? '👦' : gender === 'girl' ? '👧' : '👶'}` : ''}
              </Text>
            </View>
            {isProcessing ? (
              <ActivityIndicator size="small" color={DS.primary} />
            ) : (
              <View style={[
                styles.babyChevron,
                { backgroundColor: isActive ? DS.primary : isImport ? `${DS.success}15` : isDark ? DS.darkSurface : DS.gray100 },
              ]}>
                <Ionicons
                  name={isImport ? 'download-outline' : isActive ? 'checkmark' : 'chevron-forward'}
                  size={16}
                  color={isActive ? DS.white : isImport ? DS.success : isDark ? DS.gray500 : DS.gray400}
                />
              </View>
            )}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BabyOnboardingScreen({ navigation }: Props) {
  const { babies, currentBabyId, switchBaby, loadBabies, isLoading: babyLoading } = useBaby();
  const { userProfile, skipSetup, completeSetup, wasSetupCompleted } = useAuth();
  const insets = useSafeAreaInsets();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const { toast } = useSweetAlert();

  const [isProcessing, setIsProcessing] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remoteBabies, setRemoteBabies] = useState<any[]>([]);
  const [showImportOption, setShowImportOption] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBabies, setHasBabies] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const isMountedRef = useRef(true);
  const hasCheckedRef = useRef(false);
  const navigationAttemptedRef = useRef(false);
  const loadAttemptedRef = useRef(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAttemptCountRef = useRef(0);
  const MAX_LOAD_ATTEMPTS = 3;
  const isInitializedRef = useRef(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  /* ─── getUserId ─── */
  const getUserId = useCallback(async (): Promise<string | null> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) return userData.user.id;
    } catch {}
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) return sessionData.session.user.id;
    } catch {}
    if (userProfile?.id) return userProfile.id;
    return null;
  }, [userProfile]);

  /* ─── checkAndNavigate (unchanged) ─── */
  const checkAndNavigate = useCallback(async () => {
    if (navigationAttemptedRef.current) return false;
    if (!isMountedRef.current) return false;
    try {
      const userId = await getUserId();
      if (babies && babies.length > 0) {
        const targetId = currentBabyId || babies[0]?.id;
        if (targetId) {
          if (!currentBabyId) await switchBaby(targetId);
          await completeSetup('baby');
          navigationAttemptedRef.current = true;
          navigation.replace('Main');
          return true;
        }
      }
      if (!userId) return false;
      const localBabies = await getAllBabiesFromDb();
      if (localBabies && localBabies.length > 0) {
        const targetId = currentBabyId || localBabies[0]?.id;
        if (targetId) {
          if (!currentBabyId) await switchBaby(targetId);
          await completeSetup('baby');
          navigationAttemptedRef.current = true;
          navigation.replace('Main');
          return true;
        }
      }
      const { data: familyData, error: fmError } = await supabase
        .from('family_members')
        .select('baby_id, role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('deleted_at', null);
      if (!fmError && familyData && familyData.length > 0) {
        const babyIds = familyData.map((fm) => fm.baby_id).filter((id) => id);
        if (babyIds.length > 0) {
          const { data: remoteBabiesData, error: babyError } = await supabase.from('babies').select('*').in('id', babyIds);
          if (!babyError && remoteBabiesData && remoteBabiesData.length > 0) {
            const rolePriority: Record<string, number> = { parent1: 0, parent2: 1, guardian: 2, viewer: 3 };
            const sortedBabies = [...remoteBabiesData].sort((a, b) => {
              const roleA = familyData.find((fm) => fm.baby_id === a.id)?.role || 'viewer';
              const roleB = familyData.find((fm) => fm.baby_id === b.id)?.role || 'viewer';
              return (rolePriority[roleA] ?? 3) - (rolePriority[roleB] ?? 3);
            });
            if (sortedBabies[0]) {
              await switchBaby(sortedBabies[0].id);
              await completeSetup('baby');
              navigationAttemptedRef.current = true;
              navigation.replace('Main');
              return true;
            }
          }
        }
      }
      const { data: inviteData, error: inviteError } = await supabase
        .from('invite_codes')
        .select('family_id, code, role')
        .eq('used_by', userId)
        .eq('used', true)
        .maybeSingle();
      if (!inviteError && inviteData?.family_id) {
        const { data: babyData } = await supabase.from('babies').select('*').eq('id', inviteData.family_id);
        if (babyData && babyData.length > 0) {
          setHasBabies(true);
          setRemoteBabies(babyData);
          await switchBaby(babyData[0].id);
          await completeSetup('baby');
          navigationAttemptedRef.current = true;
          navigation.replace('Main');
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [navigation, completeSetup, babies, switchBaby, currentBabyId, getUserId]);

  /* ─── syncBabiesFromSupabase (unchanged) ─── */
  const syncBabiesFromSupabase = useCallback(async (userId: string): Promise<boolean> => {
    if (syncInProgress) return false;
    setSyncInProgress(true);
    try {
      let allFoundBabies: any[] = [];
      const { data: parent1Data, error: p1Error } = await supabase.from('babies').select('*').eq('parent1_id', userId);
      if (!p1Error && parent1Data && parent1Data.length > 0) allFoundBabies = [...allFoundBabies, ...parent1Data];
      const { data: parent2Data, error: p2Error } = await supabase.from('babies').select('*').eq('parent2_id', userId);
      if (!p2Error && parent2Data && parent2Data.length > 0) {
        const existingIds = new Set(allFoundBabies.map(b => b.id));
        parent2Data.forEach(b => { if (!existingIds.has(b.id)) { allFoundBabies.push(b); existingIds.add(b.id); } });
      }
      const { data: familyData, error: fmError } = await supabase
        .from('family_members').select('baby_id').eq('user_id', userId).eq('status', 'active').is('deleted_at', null);
      if (!fmError && familyData && familyData.length > 0) {
        const babyIds = familyData.map(fm => fm.baby_id).filter(id => id);
        if (babyIds.length > 0) {
          const { data: babyData, error: bError } = await supabase.from('babies').select('*').in('id', babyIds);
          if (!bError && babyData && babyData.length > 0) {
            const existingIds = new Set(allFoundBabies.map(b => b.id));
            babyData.forEach(b => { if (!existingIds.has(b.id)) { allFoundBabies.push(b); existingIds.add(b.id); } });
          }
        }
      }
      if (allFoundBabies.length === 0) {
        const { data: inviteData, error: inviteError } = await supabase
          .from('invite_codes').select('family_id').eq('used_by', userId).eq('used', true).maybeSingle();
        if (!inviteError && inviteData?.family_id) {
          const { data: babyData } = await supabase.from('babies').select('*').eq('id', inviteData.family_id);
          if (babyData && babyData.length > 0) allFoundBabies = babyData;
        }
      }
      if (!allFoundBabies || allFoundBabies.length === 0) {
        setSyncInProgress(false);
        return false;
      }
      let syncedCount = 0;
      for (const baby of allFoundBabies) {
        try {
          const exists = await getBabyByIdFromDb(baby.id);
          if (!exists) {
            await createBabyInDb({
              id: baby.id, name: baby.name, avatar: baby.avatar || undefined,
              dateOfBirth: baby.date_of_birth, gender: baby.gender || undefined,
              bloodType: baby.blood_type || undefined, medicalNotes: baby.medical_notes || undefined,
              parent1Id: baby.parent1_id || undefined, parent2Id: baby.parent2_id || undefined,
            });
            syncedCount++;
          }
        } catch (err) { console.error('[BabyOnboarding] baby sync error:', err); }
      }
      const currentId = await getAppSetting('current_baby_id');
      if (!currentId && allFoundBabies[0]) {
        await setCurrentBabyInDb(allFoundBabies[0].id);
        await switchBaby(allFoundBabies[0].id);
      }
      setSyncInProgress(false);
      return syncedCount > 0 || allFoundBabies.length > 0;
    } catch {
      setSyncInProgress(false);
      return false;
    }
  }, [syncInProgress, switchBaby]);

  /* ─── checkAndSyncBabies (unchanged) ─── */
  const checkAndSyncBabies = useCallback(async () => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    try {
      const userId = await getUserId();
      if (!userId) { setInitialCheckDone(true); return; }
      if (babies && babies.length > 0) {
        setHasBabies(true);
        setRemoteBabies(babies);
        await checkAndNavigate();
        setInitialCheckDone(true);
        return;
      }
      const localBabies = await getAllBabiesFromDb();
      if (localBabies && localBabies.length > 0) {
        setHasBabies(true);
        setRemoteBabies(localBabies);
        await checkAndNavigate();
        setInitialCheckDone(true);
        return;
      }
      const synced = await syncBabiesFromSupabase(userId);
      if (synced) {
        await loadBabies(true);
        const updatedLocalBabies = await getAllBabiesFromDb();
        if (updatedLocalBabies && updatedLocalBabies.length > 0) {
          setHasBabies(true);
          setRemoteBabies(updatedLocalBabies);
          await checkAndNavigate();
        }
      } else {
        try {
          let remoteData: any[] = [];
          const { data: remoteData1, error: error1 } = await supabase.from('babies').select('*').eq('parent1_id', userId);
          if (!error1 && remoteData1 && remoteData1.length > 0) remoteData = remoteData1;
          if (remoteData.length === 0) {
            const { data: remoteData2, error: error2 } = await supabase.from('babies').select('*').eq('parent2_id', userId);
            if (!error2 && remoteData2 && remoteData2.length > 0) remoteData = remoteData2;
          }
          if (remoteData.length === 0) {
            const { data: inviteData } = await supabase
              .from('invite_codes').select('family_id').eq('used_by', userId).eq('used', true).maybeSingle();
            if (inviteData?.family_id) {
              const { data: babyData } = await supabase.from('babies').select('*').eq('id', inviteData.family_id);
              if (babyData && babyData.length > 0) remoteData = babyData;
            }
          }
          if (remoteData && remoteData.length > 0) {
            setRemoteBabies(remoteData);
            setShowImportOption(true);
          }
        } catch {}
      }
      setInitialCheckDone(true);
    } catch {
      setInitialCheckDone(true);
    }
  }, [getUserId, loadBabies, syncBabiesFromSupabase, checkAndNavigate, babies]);

  /* ─── init effect ─── */
  useEffect(() => {
    if (isInitializedRef.current) return;
    isMountedRef.current = true;
    loadAttemptedRef.current = false;
    navigationAttemptedRef.current = false;
    hasCheckedRef.current = false;
    setInitialCheckDone(false);
    setShowImportOption(false);
    setRemoteBabies([]);
    loadAttemptCountRef.current = 0;

    const loadData = async () => {
      if (loadAttemptedRef.current) return;
      if (loadAttemptCountRef.current >= MAX_LOAD_ATTEMPTS) {
        setLocalLoading(false);
        setLoadError('Unable to load after multiple attempts');
        setInitialCheckDone(true);
        return;
      }
      loadAttemptedRef.current = true;
      loadAttemptCountRef.current++;
      try {
        setLocalLoading(true);
        await loadBabies();
        if (!isMountedRef.current) return;
        if (babies && babies.length > 0) {
          setHasBabies(true);
          setRemoteBabies(babies);
          setLocalLoading(false);
          await checkAndNavigate();
          setInitialCheckDone(true);
          isInitializedRef.current = true;
          return;
        }
        const localBabies = await getAllBabiesFromDb();
        if (localBabies && localBabies.length > 0) {
          setHasBabies(true);
          setRemoteBabies(localBabies);
          setLocalLoading(false);
          await checkAndNavigate();
          setInitialCheckDone(true);
          isInitializedRef.current = true;
          return;
        }
        await checkAndSyncBabies();
        setLocalLoading(false);
        setInitialCheckDone(true);
        isInitializedRef.current = true;
        await checkAndNavigate();
      } catch {
        if (isMountedRef.current) {
          setLocalLoading(false);
          setLoadError('Failed to load babies');
          setInitialCheckDone(true);
          isInitializedRef.current = true;
        }
      }
    };

    const timer = setTimeout(loadData, 300);
    loadTimeoutRef.current = timer;

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (loadTimeoutRef.current) { clearTimeout(loadTimeoutRef.current); loadTimeoutRef.current = null; }
    };
  }, [loadBabies, checkAndSyncBabies, checkAndNavigate, babies]);

  /* ─── import baby ─── */
  const handleImportBaby = useCallback(async (baby: any) => {
    triggerHaptic('medium');
    setIsProcessing(true);
    try {
      const existing = await getBabyByIdFromDb(baby.id);
      if (!existing) {
        await createBabyInDb({
          id: baby.id, name: baby.name, avatar: baby.avatar || undefined,
          dateOfBirth: baby.date_of_birth, gender: baby.gender || undefined,
          bloodType: baby.blood_type || undefined, medicalNotes: baby.medical_notes || undefined,
          parent1Id: baby.parent1_id || undefined, parent2Id: baby.parent2_id || undefined,
        });
      }
      await setCurrentBabyInDb(baby.id);
      const switched = await switchBaby(baby.id);
      if (!switched) { toast('Could not import baby. Please try again.', 'error'); return; }
      await completeSetup('baby');
      const { hasParent2 } = await wasSetupCompleted();
      if (hasParent2 === false) {
        toast('Next Step: Invite a co-parent', 'info');
        navigation.replace('CoParentInviteScreen');
      } else {
        await completeSetup('parent2');
        try {
          await AsyncStorage.multiSet([
            ['littleloom_setup_complete', 'true'],
            ['littleloom_onboarding_complete_v3', 'true'],
            ['@littleloom_multi_baby_selected_this_session', 'true'],
          ]);
        } catch {}
        toast(`Welcome back! Imported ${baby.name}'s profile`, 'success');
        navigation.replace('Main');
      }
    } catch {
      toast('Could not import baby profile', 'error');
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [switchBaby, completeSetup, wasSetupCompleted, toast, triggerHaptic, navigation]);

  /* ─── skip ─── */
  const handleSkip = useCallback(async () => {
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await skipSetup('baby');
      const { hasParent2, setupComplete: isSetupComplete } = await wasSetupCompleted();

      // Ensure the setup-complete flag is persisted whenever BOTH
      // steps are now addressed, regardless of which branch we take.
      // Without this, a user who skips baby after skipping parent2
      // could still be routed back into BabyOptional on the next
      // cold boot.
      const p2Addressed = hasParent2 === true || hasParent2 === 'skipped';

      if (isSetupComplete) {
        navigation.replace('Main');
      } else if (hasParent2 === false) {
        toast("Let's set up family sharing", 'info');
        navigation.replace('CoParentInviteScreen');
      } else if (p2Addressed) {
        await completeSetup('parent2');
        // Force-write the setup-complete flag: completeSetup only
        // writes it when BOTH flags are non-null, which is true here.
        try {
          await AsyncStorage.multiSet([
            ['littleloom_setup_complete', 'true'],
            ['littleloom_onboarding_complete_v3', 'true'],
          ]);
        } catch {}
        toast('You can add a baby later from settings', 'info');
        navigation.replace('Main');
      } else {
        toast('You can add a baby later from settings', 'info');
        navigation.replace('Main');
      }
    } catch {
      toast('Could not skip baby setup', 'error');
      try { navigation.replace('Main'); } catch {}
    } finally {
      setIsProcessing(false);
    }
  }, [skipSetup, wasSetupCompleted, completeSetup, toast, triggerHaptic, navigation]);

  const handleCreateBaby = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('CreateBabyProfile');
  }, [navigation, triggerHaptic]);

  /* ─── select existing ─── */
  const handleSelectBaby = useCallback(async (babyId: string) => {
    triggerHaptic('medium');
    setIsProcessing(true);
    try {
      const switched = await switchBaby(babyId);
      if (!switched) { toast('Could not switch baby. Please try again.', 'error'); return; }
      await completeSetup('baby');
      const { hasParent2, setupComplete: isSetupComplete } = await wasSetupCompleted();
      if (isSetupComplete) { navigation.replace('Main'); return; }
      if (hasParent2 === false) { toast('Invite a co-parent to join the family', 'info'); navigation.replace('CoParentInviteScreen'); return; }
      if (hasParent2 === 'skipped') {
        await completeSetup('parent2');
        try {
          await AsyncStorage.multiSet([
            ['littleloom_setup_complete', 'true'],
            ['littleloom_onboarding_complete_v3', 'true'],
            ['@littleloom_multi_baby_selected_this_session', 'true'],
          ]);
        } catch {}
        toast('Baby profile selected', 'success');
        navigation.replace('Main');
        return;
      }
      try {
        await AsyncStorage.multiSet([
          ['littleloom_setup_complete', 'true'],
          ['littleloom_onboarding_complete_v3', 'true'],
          ['@littleloom_multi_baby_selected_this_session', 'true'],
        ]);
      } catch {}
      toast('Baby profile selected', 'success');
      navigation.replace('Main');
    } catch {
      toast('Could not switch baby', 'error');
    } finally {
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [switchBaby, completeSetup, wasSetupCompleted, toast, triggerHaptic, navigation]);

  /* ─── retry ─── */
  const handleRetry = useCallback(async () => {
    setLoadError(null);
    setLocalLoading(true);
    hasCheckedRef.current = false;
    loadAttemptedRef.current = false;
    navigationAttemptedRef.current = false;
    setInitialCheckDone(false);
    setShowImportOption(false);
    setRemoteBabies([]);
    loadAttemptCountRef.current = 0;
    isInitializedRef.current = false;
    try {
      await loadBabies();
      if (isMountedRef.current) {
        if (babies && babies.length > 0) {
          setHasBabies(true); setRemoteBabies(babies); setLocalLoading(false);
          setInitialCheckDone(true); isInitializedRef.current = true;
          await checkAndNavigate(); return;
        }
        const localBabies = await getAllBabiesFromDb();
        if (localBabies && localBabies.length > 0) {
          setHasBabies(true); setRemoteBabies(localBabies); setLocalLoading(false);
          setInitialCheckDone(true); isInitializedRef.current = true;
          await checkAndNavigate(); return;
        }
        await checkAndSyncBabies();
        setLocalLoading(false); setInitialCheckDone(true); isInitializedRef.current = true;
        await checkAndNavigate();
      }
    } catch {
      if (isMountedRef.current) {
        setLoadError('Still unable to load');
        setLocalLoading(false);
        setInitialCheckDone(true);
      }
    }
  }, [loadBabies, checkAndSyncBabies, checkAndNavigate, babies]);

  /* ─── refresh ─── */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hasCheckedRef.current = false;
    navigationAttemptedRef.current = false;
    setInitialCheckDone(false);
    setShowImportOption(false);
    setRemoteBabies([]);
    loadAttemptCountRef.current = 0;
    isInitializedRef.current = false;
    try {
      await loadBabies();
      if (babies && babies.length > 0) {
        setHasBabies(true); setRemoteBabies(babies); await checkAndNavigate();
      } else {
        await checkAndSyncBabies();
      }
      setInitialCheckDone(true);
    } catch {
      setInitialCheckDone(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, babies, checkAndNavigate, checkAndSyncBabies]);

  const showLoading = localLoading || babyLoading || syncInProgress;
  const shouldShowLoading = !initialCheckDone && showLoading;

  /* ─── Error state ─── */
  if (loadError && !shouldShowLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? ['#0c0a09', '#12121e'] : ['#f8faff', '#eef0f5']} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: DS.space['2xl'] }}>
          <View style={[styles.errorIconWrap, { backgroundColor: `${DS.danger}15` }]}>
            <Ionicons name="cloud-offline" size={48} color={DS.danger} />
          </View>
          <Text style={[styles.errorTitle, { color: isDark ? DS.white : DS.gray900 }]}>Oops!</Text>
          <Text style={[styles.errorText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{loadError}</Text>
          <PressableScale onPress={handleRetry} activeScale={0.96}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>Try Again</Text>
            </LinearGradient>
          </PressableScale>
          <TouchableOpacity onPress={handleSkip} style={{ paddingVertical: 12 }}>
            <Text style={[styles.skipText, { color: DS.primary }]}>Continue Without Baby →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ─── Loading state ─── */
  if (shouldShowLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? ['#0c0a09', '#12121e'] : ['#f8faff', '#eef0f5']} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={DS.primary} />
          <Text style={[styles.loadingText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            {syncInProgress ? 'Syncing your babies...' : 'Loading your babies...'}
          </Text>
        </View>
      </View>
    );
  }

  const displayBabies = babies.length > 0 ? babies : remoteBabies;
  const displayHasBabies = hasBabies || babies.length > 0 || remoteBabies.length > 0;
  const firstName = userProfile?.fullName?.split(' ')[0] || 'Parent';

  /* ─── Main render ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky header (on scroll) */}
      <Animated.View style={[styles.stickyHeader, {
        paddingTop: HEADER_TOP_PADDING,
        backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
        borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
      }, headerAnim]}>
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <View style={{ width: 38 }} />
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              {displayHasBabies ? 'WELCOME' : 'ONBOARDING'}
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {displayHasBabies ? `${displayBabies.length} profile${displayBabies.length !== 1 ? 's' : ''}` : 'Step 2 of 3'}
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOP_PADDING + 8, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
      >
        {/* Pulse header */}
        <PulseHeader
          isDark={isDark}
          firstName={firstName}
          babyCount={displayBabies.length}
          hasBabies={displayHasBabies}
          onSkip={handleSkip}
          onCreate={handleCreateBaby}
          disabled={isProcessing}
        />

        {/* Import existing */}
        {showImportOption && remoteBabies.length > 0 && !displayHasBabies && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader
              title="Import Existing Profiles"
              subtitle={`${remoteBabies.length} found on your account`}
              icon="download-outline"
              color={DS.success}
              badge={remoteBabies.length}
            />
            <View style={{ paddingHorizontal: DS.space.lg, gap: 10 }}>
              {remoteBabies.map((baby, index) => (
                <BabyCard
                  key={baby.id}
                  baby={baby}
                  isDark={isDark}
                  isImport
                  isProcessing={isProcessing}
                  onPress={() => handleImportBaby(baby)}
                  index={index}
                />
              ))}
            </View>
          </View>
        )}

        {/* Existing babies */}
        {displayHasBabies && displayBabies.length > 0 && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader
              title="Your Babies"
              subtitle="Tap to select and continue"
              icon="people-outline"
              color={DS.primary}
              badge={displayBabies.length}
            />
            <View style={{ paddingHorizontal: DS.space.lg, gap: 10 }}>
              {displayBabies.map((baby, index) => (
                <BabyCard
                  key={baby.id}
                  baby={baby}
                  isDark={isDark}
                  isActive={currentBabyId === baby.id}
                  isProcessing={isProcessing}
                  onPress={() => handleSelectBaby(baby.id)}
                  index={index}
                />
              ))}

              {/* Add new baby option */}
              <Animated.View entering={FadeInUp.delay(200 + displayBabies.length * 60).springify()}>
                <PressableScale onPress={handleCreateBaby} activeScale={0.98} disabled={isProcessing}>
                  <View style={[styles.addBabyCard, {
                    borderColor: isDark ? DS.darkBorder : DS.gray300,
                    backgroundColor: isDark ? DS.darkCard : DS.white,
                  }]}>
                    <LinearGradient colors={[`${DS.primary}08`, `${DS.accent}04`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                    <View style={[styles.addBabyIcon, { backgroundColor: `${DS.primary}15` }]}>
                      <Ionicons name="add" size={22} color={DS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.addBabyTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                        Add New Baby
                      </Text>
                      <Text style={[styles.addBabySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        Track another little one
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={DS.primary} />
                  </View>
                </PressableScale>
              </Animated.View>
            </View>
          </View>
        )}

        {/* Empty state — no babies, no imports */}
        {!displayHasBabies && remoteBabies.length === 0 && (
          <Animated.View entering={FadeIn.delay(200)} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
            <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <LinearGradient colors={[`${DS.primary}08`, `${DS.accent}04`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.emptyIcon, { backgroundColor: `${DS.primary}15` }]}>
                <Text style={{ fontSize: 36 }}>👶</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                No babies yet
              </Text>
              <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Create your first baby profile to start tracking milestones, feeds, and precious moments.
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Sticky header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, height: 48,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse header */
  pulseWrap: {
    marginHorizontal: DS.space.lg, marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md, position: 'relative',
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  pulseLivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pulseLiveText: { fontSize: 10, fontWeight: '700' },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  pulseSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  pulseActions: { flexDirection: 'row', gap: DS.space.sm, marginTop: DS.space.md },
  pulseActionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: DS.radius.md, gap: 6,
  },
  pulseActionPrimaryText: { color: DS.white, fontSize: 13, fontWeight: '700' },
  pulseActionSecondary: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderRadius: DS.radius.md, borderWidth: 1,
  },
  pulseActionSecondaryText: { fontSize: 13, fontWeight: '700' },

  /* Section */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm,
  },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  sectionBadgeText: { color: DS.white, fontSize: 10, fontWeight: '800' },

  /* Baby card */
  babyCard: { borderRadius: DS.radius.lg, overflow: 'hidden', ...DS.shadow.sm },
  babyCardContent: { flexDirection: 'row', alignItems: 'center', padding: DS.space.md },
  babyName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  babyActivePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  babyActiveText: { fontSize: 9, fontWeight: '800' },
  babyMeta: { fontSize: 11, fontWeight: '500', marginTop: 3 },
  babyChevron: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  /* Add baby card */
  addBabyCard: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg,
    borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden',
  },
  addBabyIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  addBabyTitle: { fontSize: 14, fontWeight: '700' },
  addBabySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Empty */
  emptyCard: {
    borderRadius: DS.radius.lg, padding: DS.space['2xl'], borderWidth: 1,
    alignItems: 'center', overflow: 'hidden', ...DS.shadow.sm,
  },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, paddingHorizontal: DS.space.md },

  /* Error */
  errorIconWrap: { width: 100, height: 100, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.lg },
  errorTitle: { fontSize: 26, fontWeight: '800', marginBottom: 6, letterSpacing: -0.3 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: DS.space.xl },
  errorBtn: { paddingHorizontal: DS.space['2xl'], paddingVertical: 14, borderRadius: DS.radius.md },
  errorBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  skipText: { fontSize: 14, fontWeight: '600' },

  /* Loading */
  loadingText: { marginTop: DS.space.lg, fontSize: 14, fontWeight: '600' },
});