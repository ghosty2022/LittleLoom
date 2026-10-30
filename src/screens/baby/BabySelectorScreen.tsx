import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  Layout,
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

import type { RootStackParamList } from '../../types/navigation';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { LiquidDots } from '../../components/UniversalSpinner';

const { width: SCREEN_W } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

type BabySelectorScreenProps = NativeStackScreenProps<RootStackParamList, 'SwitchBaby'>;

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
const HAPTIC_HEAVY = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE HELPERS (unchanged)
   ═══════════════════════════════════════════════════════════════════════════ */
const VALID_ROOT_SCREENS = new Set<string>([
  'Main', 'Onboarding', 'Login', 'SignUp', 'ForgotPassword',
  'CreateBabyProfile', 'SwitchBaby', 'AddParent', 'UniversalTrackerHub',
  'Timeline', 'GrowthDashboard', 'Achievements', 'TrackerReminders',
  'SafetyCorner', 'Gallery', 'SoundMixer', 'FamilySharing', 'FamilyChatList',
  'HelpCenter', 'ContactSupport', 'Profile', 'EditProfile', 'EditGuardian',
  'VaccinationSchedule', 'Customize', 'SecurityCenter', 'BiometricSetup',
  'BackupRestore', 'LanguageSettings', 'UnitSettings', 'PrivacyPolicy',
  'TermsOfService', 'About', 'EntryDetail', 'Insights', 'CreateCustomTracker',
  'AddEntry', 'FamilyChat', 'SecurityLock', 'CoParentInviteScreen', 'Parent2Setup',
  'BabyOptional', 'InviteCodeScreen',
]);

const TAB_SCREEN_MAP: Record<string, keyof RootStackParamList> = {
  Home: 'Main', Track: 'Main', Grow: 'Main', Connect: 'Main', More: 'Main',
};

const sanitizeRoute = (routeName: string | null | undefined): keyof RootStackParamList => {
  if (!routeName || typeof routeName !== 'string') return 'Main';
  if (VALID_ROOT_SCREENS.has(routeName)) return routeName as keyof RootStackParamList;
  if (TAB_SCREEN_MAP[routeName]) return TAB_SCREEN_MAP[routeName];
  return 'Main';
};
const getReturnTarget = (route: BabySelectorScreenProps['route']): keyof RootStackParamList =>
  sanitizeRoute(route.params?.returnTo);
const getReturnLabel = (route: BabySelectorScreenProps['route']): string => {
  const label = route.params?.returnLabel;
  if (label && typeof label === 'string') return label;
  const raw = route.params?.returnTo;
  if (!raw || typeof raw !== 'string' || raw === 'Main') return 'Home';
  if (TAB_SCREEN_MAP[raw]) return raw;
  return raw;
};

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT
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
const PressableScale = memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean;
  style?: any; activeScale?: number; haptic?: 'light' | 'medium' | 'heavy';
}>(({ children, onPress, disabled, style, activeScale = 0.96, haptic = 'light' }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    if (disabled) return;
    if (haptic === 'light') HAPTIC_LIGHT();
    else if (haptic === 'medium') HAPTIC_MEDIUM();
    else HAPTIC_HEAVY();
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
   PULSE HEADER — Brilliant compact switcher
   ═══════════════════════════════════════════════════════════════════════════ */
interface PulseHeaderProps {
  isDark: boolean;
  babiesCount: number;
  currentBabyId: string | null;
  onBack: () => void;
  onAdd: () => void;
}

const PulseHeader = memo<PulseHeaderProps>(({ isDark, babiesCount, currentBabyId, onBack, onAdd }) => {
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

        {/* Back button */}
        <PressableScale onPress={onBack} activeScale={0.9}>
          <View style={[styles.pulseBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>

        {/* Main row */}
        <View style={styles.pulseRow}>
          <View style={styles.pulseIconWrap}>
            <Animated.View style={[styles.pulseIconGlow, glowStyle]} />
            <Animated.View style={[styles.pulseIconRing, ringStyle]}>
              <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.pulseIconInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <Ionicons name="swap-horizontal" size={24} color={DS.primary} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.pulseTitle}>
                SWITCH BABY
              </GradientText>
              <View style={[styles.pulseLivePill, { backgroundColor: `${DS.success}18` }]}>
                <PulsingDot color={DS.success} size={6} />
                <Text style={[styles.pulseLiveText, { color: DS.success }]}>{babiesCount} here</Text>
              </View>
            </View>
            <Text style={[styles.pulseSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              Choose a profile to continue
            </Text>
          </View>

          <PressableScale onPress={onAdd} activeScale={0.9} haptic="medium">
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="add" size={22} color={DS.white} />
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   BABY CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const BabyCard = memo<{
  baby: any;
  isSelected: boolean;
  isDark: boolean;
  isProcessing: boolean;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onEdit: (id: string) => void;
  index: number;
}>(({ baby, isSelected, isDark, isProcessing, canDelete, onSelect, onDelete, onEdit, index }) => {
  return (
    <Animated.View
      entering={FadeInUp.delay(80 + index * 60).springify()}
      layout={Layout.springify().damping(20)}
      exiting={FadeOutDown.duration(200)}
    >
      <PressableScale onPress={() => onSelect(baby.id)} activeScale={0.98} disabled={isProcessing}>
        <View
          style={[
            styles.babyCard,
            {
              backgroundColor: isDark ? DS.darkCard : DS.white,
              borderColor: isSelected ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={isSelected
              ? [`${DS.primary}15`, `${DS.accent}08`]
              : [`${DS.primary}04`, `${DS.accent}02`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={styles.babyCardContent}>
            {/* Avatar with selection glow */}
            <View style={styles.babyAvatarWrap}>
              {isSelected && (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  style={[styles.babyAvatarGlow, { backgroundColor: `${DS.primary}30` }]}
                />
              )}
              <SafeBabyAvatar avatar={baby.avatar} gender={baby.gender} size={60} />
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={[styles.babyName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                  {baby.name}
                </Text>
                {/* Role badge — makes it obvious which baby this user
                    OWNS vs which they're a guest on. */}
                {baby.role && (
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor:
                          baby.role === 'parent1' ? `${DS.primary}18`
                          : baby.role === 'parent2' ? `${DS.accent}18`
                          : baby.role === 'guardian' ? `${DS.success}18`
                          : `${DS.gray400}18`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        baby.role === 'parent1' ? 'shield'
                        : baby.role === 'parent2' ? 'heart'
                        : baby.role === 'guardian' ? 'shield-checkmark'
                        : 'eye'
                      }
                      size={9}
                      color={
                        baby.role === 'parent1' ? DS.primary
                        : baby.role === 'parent2' ? DS.accent
                        : baby.role === 'guardian' ? DS.success
                        : DS.gray500
                      }
                    />
                    <Text
                      style={[
                        styles.roleBadgeText,
                        {
                          color:
                            baby.role === 'parent1' ? DS.primary
                            : baby.role === 'parent2' ? DS.accent
                            : baby.role === 'guardian' ? DS.success
                            : DS.gray500,
                        },
                      ]}
                    >
                      {baby.role === 'parent1' ? 'Owner'
                        : baby.role === 'parent2' ? 'Co-Parent'
                        : baby.role === 'guardian' ? 'Guardian'
                        : 'Viewer'}
                    </Text>
                  </View>
                )}
                {isSelected && (
                  <View style={[styles.babyActivePill, { backgroundColor: `${DS.success}18` }]}>
                    <Ionicons name="checkmark-circle" size={10} color={DS.success} />
                    <Text style={[styles.babyActiveText, { color: DS.success }]}>Active</Text>
                  </View>
                )}
              </View>
              <View style={styles.babyMetaRow}>
                <Text style={[styles.babyAge, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {baby.age}
                </Text>
                {!!baby.familyLabel && (
                  <>
                    <View style={[styles.babyDot, { backgroundColor: isDark ? DS.gray600 : DS.gray300 }]} />
                    <Ionicons
                      name={baby.role === 'parent1' || baby.role === 'parent2' ? 'home' : 'people'}
                      size={11}
                      color={isDark ? DS.gray500 : DS.gray400}
                    />
                    <Text
                      style={[styles.babyDate, { color: isDark ? DS.gray500 : DS.gray400 }]}
                      numberOfLines={1}
                    >
                      {baby.familyLabel}
                    </Text>
                  </>
                )}
                <View style={[styles.babyDot, { backgroundColor: isDark ? DS.gray600 : DS.gray300 }]} />
                <Text style={styles.babyEmoji}>
                  {baby.gender === 'girl' ? '👧' : baby.gender === 'boy' ? '👦' : '👶'}
                </Text>
                <View style={[styles.babyDot, { backgroundColor: isDark ? DS.gray600 : DS.gray300 }]} />
                <Text style={[styles.babyDate, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                  {baby.birthDate ? new Date(baby.birthDate).toLocaleDateString() : '—'}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.babyActions}>
              <PressableScale onPress={() => onEdit(baby.id)} activeScale={0.9}>
                <View style={[styles.babyActionBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}12` }]}>
                  <Ionicons name="create-outline" size={16} color={DS.primary} />
                </View>
              </PressableScale>
              {canDelete && !isSelected && (
                <PressableScale
                  onPress={() => onDelete(baby.id, baby.name)}
                  activeScale={0.9}
                  haptic="heavy"
                >
                  <View style={[styles.babyActionBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : `${DS.danger}12` }]}>
                    <Ionicons name="trash-outline" size={16} color={DS.danger} />
                  </View>
                </PressableScale>
              )}
              {!isSelected && (
                <View style={[styles.babyActionBtn, { backgroundColor: isDark ? DS.darkSurface : DS.gray100 }]}>
                  <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
                </View>
              )}
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function BabySelectorScreen({ navigation, route }: BabySelectorScreenProps) {
  const sweetAlert = useSweetAlert();
  const { babies, currentBabyId, switchBaby, deleteBaby, loadBabies, isLoading: babyLoading } = useBaby();
  const { userProfile } = useAuth();
  const { parent2 } = useFamily();
  const insets = useSafeAreaInsets();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasNavigated = useRef(false);
  const isMounted = useRef(true);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace(getReturnTarget(route));
  }, [navigation, route]);

  const handleSwitchBaby = useCallback(async (babyId: string) => {
    if (babyId === currentBabyId) { safeGoBack(); return; }
    HAPTIC_MEDIUM();
    setIsProcessing(true);
    setSelectedId(babyId);
    try {
      const success = await switchBaby(babyId);
      if (success) {
        // `switchBaby` already updates `currentBabyId` and broadcasts;
        // a full `loadBabies()` here causes a redundant re-fetch. The
        // baby-change listeners (FamilyContext, FamilyChatContext,
        // TrackerContext) already re-hydrate from the broadcast.
        sweetAlert.success('Switched', 'Baby profile updated');
        setTimeout(() => {
          if (!hasNavigated.current && isMounted.current) {
            hasNavigated.current = true;
            safeGoBack();
          }
        }, 400);
      } else {
        sweetAlert.error('Error', 'Failed to switch baby profile');
        setIsProcessing(false);
        setSelectedId(null);
      }
    } catch {
      sweetAlert.error('Error', 'An unexpected error occurred');
      setIsProcessing(false);
      setSelectedId(null);
    }
  }, [currentBabyId, switchBaby, loadBabies, sweetAlert, safeGoBack]);

  const handleDeleteBaby = useCallback((babyId: string, babyName: string) => {
    if (isProcessing) return;
    if (babies.length <= 1) {
      sweetAlert.alert('Cannot Delete', 'You must have at least one baby profile', 'warning');
      return;
    }
    HAPTIC_HEAVY();
    sweetAlert.confirm(
      'Delete Profile?',
      `Are you sure you want to delete ${babyName}'s profile? This cannot be undone.`,
      async () => {
        setIsProcessing(true);
        try {
          const success = await deleteBaby(babyId);
          if (success) {
            await loadBabies();
            sweetAlert.success('Deleted', `${babyName}'s profile has been removed`);
          } else {
            sweetAlert.error('Error', `Failed to delete ${babyName}'s profile`);
          }
        } catch {
          sweetAlert.error('Error', 'An unexpected error occurred');
        } finally {
          setIsProcessing(false);
        }
      },
      () => {},
      'Delete',
      'Cancel',
      true,
    );
  }, [babies.length, deleteBaby, loadBabies, sweetAlert, isProcessing]);

  const handleAddBaby = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  const handleContinue = useCallback(() => {
    HAPTIC_LIGHT();
    safeGoBack();
  }, [safeGoBack]);

  const handleBackPress = useCallback(() => { safeGoBack(); }, [safeGoBack]);

  const handleEdit = useCallback((babyId: string) => {
    HAPTIC_LIGHT();
    navigation.navigate('EditProfile', { mode: 'baby', babyId });
  }, [navigation]);

  const hasPartner = parent2 !== null && parent2 !== undefined;
  const hasMultipleBabies = babies.length > 1;

  /* ─── Loading ─── */
  if (babyLoading && babies.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient
          colors={isDark ? ['#0c0a09', '#12121e'] : ['#f8faff', '#eef0f5']}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LiquidDots
            colors={[DS.primary, DS.accent, '#f093fb', '#4facfe']}
            size={72}
          />
          <Text style={[styles.loadingText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Loading babies...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky header (on scroll) */}
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            paddingTop: HEADER_TOP_PADDING,
            backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
          },
          headerAnim,
        ]}
      >
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={handleBackPress} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>SWITCH</GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {babies.length} {babies.length === 1 ? 'profile' : 'profiles'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleAddBaby} style={[styles.headerIconBtn, { backgroundColor: DS.primary }]}>
            <Ionicons name="add" size={22} color={DS.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOP_PADDING + 8, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pulse header — NO heavy hero card */}
        <PulseHeader
          isDark={isDark}
          babiesCount={babies.length}
          currentBabyId={currentBabyId}
          onBack={handleBackPress}
          onAdd={handleAddBaby}
        />

        {/* Section label */}
        <Animated.View entering={FadeIn.delay(100)} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
          <Text style={[styles.sectionLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>
            {hasMultipleBabies ? 'CHOOSE A BABY PROFILE' : 'YOUR BABY'}
          </Text>
        </Animated.View>

        {/* Baby list */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.sm, gap: 10 }}>
          {babies.map((baby, index) => (
            <BabyCard
              key={baby.id}
              baby={baby}
              isSelected={baby.id === currentBabyId}
              isDark={isDark}
              isProcessing={isProcessing}
              canDelete={hasMultipleBabies}
              onSelect={handleSwitchBaby}
              onDelete={handleDeleteBaby}
              onEdit={handleEdit}
              index={index}
            />
          ))}
        </View>

        {/* Add new baby card */}
        <Animated.View
          entering={FadeInUp.delay(200 + babies.length * 60).springify()}
          style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}
        >
          <PressableScale onPress={handleAddBaby} activeScale={0.98}>
            <View style={[styles.addBabyCard, {
              borderColor: isDark ? DS.darkBorder : DS.gray300,
              backgroundColor: isDark ? DS.darkCard : DS.white,
            }]}>
              <LinearGradient
                colors={[`${DS.primary}08`, `${DS.accent}04`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <View style={[styles.addBabyIcon, { backgroundColor: `${DS.primary}15` }]}>
                <Ionicons name="add" size={26} color={DS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addBabyTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                  Add New Baby Profile
                </Text>
                <Text style={[styles.addBabySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Track another little one
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={DS.primary} />
            </View>
          </PressableScale>
        </Animated.View>

        {/* Family info footer */}
        <Animated.View
          entering={FadeIn.delay(300 + babies.length * 60)}
          style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}
        >
          <View style={[styles.familyInfo, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          }]}>
            <View style={[styles.familyIconWrap, { backgroundColor: `${DS.primary}15` }]}>
              <Ionicons name="people" size={16} color={DS.primary} />
            </View>
            <Text style={[styles.familyText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {hasPartner
                ? `${userProfile?.fullName || 'Parent'} & ${parent2?.fullName || 'Partner'}`
                : `Managed by ${userProfile?.fullName || 'Parent'}`}
            </Text>
            {hasPartner && (
              <View style={[styles.familyChip, { backgroundColor: `${DS.success}15` }]}>
                <Ionicons name="heart" size={10} color={DS.success} />
                <Text style={[styles.familyChipText, { color: DS.success }]}>Family</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Continue button */}
        <Animated.View
          entering={FadeInUp.delay(400 + babies.length * 60).springify()}
          style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}
        >
          <PressableScale onPress={handleContinue} activeScale={0.97}>
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueText}>Continue to {getReturnLabel(route)}</Text>
              <Ionicons name="arrow-forward" size={20} color={DS.white} />
            </LinearGradient>
          </PressableScale>
        </Animated.View>

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
  loadingText: { marginTop: DS.space.lg, fontSize: 15, fontWeight: '600' },

  /* Sticky header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, height: 48,
  },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
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
  pulseBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseIconWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseIconGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseIconRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseIconInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  pulseLivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pulseLiveText: { fontSize: 10, fontWeight: '700' },
  pulseSub: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  /* Section */
  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase',
  },

  /* Baby card */
  babyCard: {
    borderRadius: DS.radius.lg, overflow: 'hidden', ...DS.shadow.sm,
  },
  babyCardContent: {
    flexDirection: 'row', alignItems: 'center', padding: DS.space.md, gap: DS.space.md,
  },
  babyAvatarWrap: { position: 'relative' },
  babyAvatarGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 40, opacity: 0.3,
  },
  babyName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  babyActivePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  babyActiveText: { fontSize: 9, fontWeight: '800' },
  babyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  babyAge: { fontSize: 12, fontWeight: '600' },
  babyDot: { width: 3, height: 3, borderRadius: 1.5 },
  babyEmoji: { fontSize: 12 },
  babyDate: { fontSize: 11, fontWeight: '500' },
  babyActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  babyActionBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Add baby card */
  addBabyCard: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    padding: DS.space.md, borderRadius: DS.radius.lg,
    borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden',
  },
  addBabyIcon: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  addBabyTitle: { fontSize: 14, fontWeight: '700' },
  addBabySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Family info */
  familyInfo: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.sm,
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  familyIconWrap: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  familyText: { flex: 1, fontSize: 12, fontWeight: '600' },
  familyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  familyChipText: { fontSize: 10, fontWeight: '700' },

  /* Continue */
  continueGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: DS.radius.md, gap: 10,
    ...DS.shadow.md,
  },
  continueText: { color: DS.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
    roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
});