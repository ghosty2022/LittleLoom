import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  Dimensions,
  Modal,
  Pressable,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useApp } from '../../context/AppContext';
import { useFamily } from '../../context/FamilyContext';
import type { AddMemberResult } from '../../context/FamilyContext';
import { UserRole } from '../../types/roles';
import { useSweetAlert } from '../../components/SweetAlert';
import QRCode from 'react-native-qrcode-svg';

type Props = NativeStackScreenProps<RootStackParamList, 'CoParentInviteScreen'>;
const { width: SCREEN_W } = Dimensions.get('window');

const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (Platform.OS === 'android' && !IS_FABRIC && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM
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
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const HAPTIC_WARNING = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   ROLE CONFIGURATION
   ═══════════════════════════════════════════════════════════════════════════ */

type RoleKey = 'parent2' | 'guardian' | 'viewer';

const ROLE_META: Record<RoleKey, {
  label: string;
  color: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  placeholder: string;
  permissions: string[];
}> = {
  parent2: {
    label: 'Co-Parent',
    color: '#ec4899',
    gradient: ['#ec4899', '#f43f5e'],
    icon: 'heart',
    description: 'Full access to manage baby data, family settings, and exports',
    placeholder: 'e.g., Father, Mother, Partner',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'],
  },
  guardian: {
    label: 'Guardian',
    color: '#10b981',
    gradient: ['#10b981', '#34d399'],
    icon: 'shield-checkmark',
    description: 'Can log activities and view data, but cannot manage family',
    placeholder: 'e.g., Grandma, Nanny, Uncle',
    permissions: ['Read', 'Write', 'Limited Delete', 'View Timeline', 'Add Photos'],
  },
  viewer: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    description: 'View-only access to timeline, photos, and growth charts',
    placeholder: 'e.g., Aunt, Family Friend',
    permissions: ['Read Only', 'View Timeline', 'View Photos'],
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active: { label: 'Active', color: '#22c55e', icon: 'checkmark-circle' },
  used: { label: 'Used', color: '#64748b', icon: 'checkmark-done-circle' },
  partial: { label: 'Partial', color: '#f59e0b', icon: 'warning' },
  revoked: { label: 'Revoked', color: '#ef4444', icon: 'close-circle' },
  expired: { label: 'Expired', color: '#f59e0b', icon: 'time' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText + PressableScale
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

/* ═══════════════════════════════════════════════════════════════════════════
   Toast
   ═══════════════════════════════════════════════════════════════════════════ */

const Toast = ({ message, type, visible, onHide }: {
  message: string; type: 'success' | 'error' | 'info';
  visible: boolean; onHide: () => void;
}) => {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      RNAnimated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      const t = setTimeout(() => {
        RNAnimated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(onHide);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [visible, onHide, opacity]);
  if (!visible) return null;

  const colors = {
    success: { bg: '#10b981', icon: 'checkmark-circle' },
    error: { bg: '#ef4444', icon: 'alert-circle' },
    info: { bg: '#3b82f6', icon: 'information-circle' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999, alignItems: 'center', paddingTop: HEADER_TOTAL_HEIGHT + 12 }]} pointerEvents="none">
      <RNAnimated.View style={[styles.toast, { opacity, backgroundColor: colors.bg }]}>
        <Ionicons name={colors.icon as any} size={18} color="#fff" />
        <Text style={styles.toastText}>{message}</Text>
      </RNAnimated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Section Header
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   Invite Pulse Header — compact animated status capsule (no hero card)
   ═══════════════════════════════════════════════════════════════════════════ */

const InvitePulse = React.memo<{
  isDark: boolean;
  avatar: any;
  baby: any;
  userProfile: any;
  stats: { total: number; active: number; partial: number; used: number };
  onAvatarPress: () => void;
  onBabyPress: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}>(({ isDark, avatar, baby, userProfile, stats, onAvatarPress, onBabyPress, onRefresh, refreshing }) => {
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

  const hasAttention = stats.partial > 0;
  const statusColor = stats.active > 0 ? DS.success : stats.total > 0 ? DS.warning : DS.primary;
  const statusLabel =
    hasAttention
      ? `${stats.partial} need${stats.partial === 1 ? 's' : ''} help`
      : stats.active > 0
      ? `${stats.active} active invite${stats.active === 1 ? '' : 's'}`
      : stats.total > 0
      ? 'No active codes'
      : 'Ready to invite';

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
          <PressableScale onPress={onAvatarPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                <SafeAvatar
                  avatar={avatar}
                  size={44}
                  fallbackIcon="people"
                  fallbackColor={DS.primary}
                  borderWidth={0}
                />
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {baby?.name ? `Invite for ${baby.name}` : 'Invite your family'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: hasAttention ? DS.warning : statusColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onBabyPress} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name={baby ? 'swap-horizontal-outline' : 'add-outline'} size={18} color={isDark ? DS.gray300 : DS.gray600} />
              </View>
            </PressableScale>
            <PressableScale onPress={onRefresh} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                {refreshing
                  ? <ActivityIndicator size="small" color={DS.primary} />
                  : <Ionicons name="refresh-outline" size={18} color={isDark ? DS.gray300 : DS.gray600} />}
              </View>
            </PressableScale>
          </View>
        </View>

        {/* Segmented stats */}
        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{stats.total}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>total</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.success }]}>{stats.active}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>active</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: stats.partial > 0 ? DS.warning : DS.gray400 }]}>{stats.partial}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>partial</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.gray500 }]}>{stats.used}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>used</Text>
          </View>
        </View>
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
   Role Selector — animated gradient pills
   ═══════════════════════════════════════════════════════════════════════════ */

const RoleSelector = React.memo<{
  selected: RoleKey;
  onSelect: (r: RoleKey) => void;
  isDark: boolean;
}>(({ selected, onSelect, isDark }) => (
  <Animated.View entering={FadeInUp.delay(120).springify()}>
    <SectionHeader title="Role" subtitle="What can they do?" icon="shield-outline" color={DS.primary} />
    <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
      {(Object.keys(ROLE_META) as RoleKey[]).map((r) => {
        const meta = ROLE_META[r];
        const active = selected === r;
        return (
          <PressableScale key={r} onPress={() => onSelect(r)} activeScale={0.98}>
            <View
              style={[
                styles.roleCard,
                {
                  backgroundColor: active
                    ? isDark ? `${meta.color}20` : `${meta.color}10`
                    : isDark ? DS.darkCard : DS.white,
                  borderColor: active ? `${meta.color}60` : isDark ? DS.darkBorder : DS.gray200,
                  borderWidth: active ? 2 : 1,
                },
              ]}
            >
              <LinearGradient colors={meta.gradient} style={styles.roleIcon}>
                <Ionicons name={meta.icon} size={18} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleTitle, { color: isDark ? DS.white : DS.gray900 }]}>{meta.label}</Text>
                <Text style={[styles.roleDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>
                  {meta.description}
                </Text>
              </View>
              <View
                style={[
                  styles.roleCheck,
                  active && { backgroundColor: meta.color, borderColor: meta.color },
                  !active && { borderColor: isDark ? DS.gray600 : DS.gray300 },
                ]}
              >
                {active && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </View>
          </PressableScale>
        );
      })}
    </View>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Input Row
   ═══════════════════════════════════════════════════════════════════════════ */

const InputRow = ({ icon, placeholder, value, onChangeText, themeColor, isDark, keyboardType, autoCapitalize, label }: any) => (
  <View style={{ marginBottom: 10 }}>
    {label && <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{label}</Text>}
    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <Ionicons name={icon} size={18} color={themeColor} style={{ opacity: 0.85 }} />
      <TextInput
        style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
        placeholder={placeholder}
        placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'words'}
        returnKeyType="next"
      />
    </View>
  </View>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Success Capsule — compact generated-code display (no giant block)
   ═══════════════════════════════════════════════════════════════════════════ */

const SuccessCapsule = React.memo<{
  code: string;
  role: RoleKey;
  babyName?: string;
  isDark: boolean;
  onCopy: () => void;
  onShare: (method: 'whatsapp' | 'sms' | 'email' | 'native') => void;
  onRegenerate: () => void;
  onDone: () => void;
}>(({ code, role, babyName, isDark, onCopy, onShare, onRegenerate, onDone }) => {
  const checkScale = useSharedValue(0);
  const checkRotate = useSharedValue(0);
  const ringPulse = useSharedValue(1);

  useEffect(() => {
    checkScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.15, { damping: 10, stiffness: 200 }),
      withTiming(1, { duration: 200 })
    );
    checkRotate.value = withSequence(
      withTiming(-180, { duration: 0 }),
      withSpring(0, { damping: 12, stiffness: 150 })
    );
    ringPulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1600 }), withTiming(1, { duration: 1600 })),
      -1,
      true
    );
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }, { rotate: `${checkRotate.value}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringPulse.value }] }));

  const meta = ROLE_META[role];

  return (
    <Animated.View entering={FadeInUp.springify()}>
      <View style={[styles.successCapsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: `${meta.color}40` }]}>
        <LinearGradient
          colors={isDark ? [`${meta.color}20`, 'transparent'] : [`${meta.color}12`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />

        {/* Success indicator row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[styles.successGlow, { backgroundColor: `${meta.color}30` }, ringStyle]} />
            <Animated.View style={[styles.successCheck, checkStyle, { backgroundColor: meta.color }]}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </Animated.View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.successTitle, { color: isDark ? DS.white : DS.gray900 }]}>
              Invite ready
            </Text>
            <Text style={[styles.successSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {meta.label}{babyName ? ` · ${babyName}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onDone} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color={isDark ? DS.gray500 : DS.gray400} />
          </TouchableOpacity>
        </View>

        {/* Code + QR row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.codeLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>INVITE CODE</Text>
            <Text style={[styles.codeText, { color: meta.color }]} numberOfLines={1}>{code}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Ionicons name="time-outline" size={11} color={isDark ? DS.gray500 : DS.gray400} />
              <Text style={[styles.codeMeta, { color: isDark ? DS.gray500 : DS.gray400 }]}>7d · one-time use</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => onShare('native')} activeOpacity={0.85}>
            <View style={[styles.qrBox, { backgroundColor: isDark ? DS.darkSurface : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <QRCode
                value={code}
                size={72}
                color={isDark ? '#ffffff' : '#1a1a1a'}
                backgroundColor={isDark ? '#1c1917' : '#ffffff'}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Share row */}
        <View style={styles.shareRow}>
          {([
            { id: 'copy', icon: 'copy-outline', label: 'Copy', color: DS.primary, onPress: onCopy },
            { id: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25d366', onPress: () => onShare('whatsapp') },
            { id: 'sms', icon: 'chatbubble-outline', label: 'SMS', color: '#3b82f6', onPress: () => onShare('sms') },
            { id: 'email', icon: 'mail-outline', label: 'Email', color: '#ef4444', onPress: () => onShare('email') },
            { id: 'more', icon: 'share-outline', label: 'More', color: DS.gray500, onPress: () => onShare('native') },
          ] as const).map((s) => (
            <PressableScale key={s.id} onPress={s.onPress} activeScale={0.92} style={{ flex: 1 }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.shareBtnIcon, { backgroundColor: `${s.color}12` }]}>
                  <Ionicons name={s.icon as any} size={18} color={s.color} />
                </View>
                <Text style={[styles.shareBtnLabel, { color: s.color }]} numberOfLines={1}>{s.label}</Text>
              </View>
            </PressableScale>
          ))}
        </View>

        {/* Regenerate */}
        <TouchableOpacity onPress={onRegenerate} style={styles.regenerateBtn}>
          <Ionicons name="add-circle-outline" size={14} color={meta.color} />
          <Text style={[styles.regenerateText, { color: meta.color }]}>Generate another code</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Code Row — compact ribbon-style list item
   ═══════════════════════════════════════════════════════════════════════════ */

const CodeRow = React.memo<{
  code: any;
  index: number;
  isDark: boolean;
  onPress: (code: any) => void;
  onResendPartial: (code: string) => void;
  onRevoke: (code: string) => void;
}>(({ code, index, isDark, onPress, onResendPartial, onRevoke }) => {
  const status = STATUS_CONFIG[code.status] || STATUS_CONFIG.active;
  const roleMeta = ROLE_META[code.role as RoleKey];
  const isPartial = code.status === 'partial';
  const isActive = code.status === 'active';

  const partialParts: string[] = [];
  if (code.used_by_name) partialParts.push(code.used_by_name);
  if (code.used_by_email) partialParts.push(code.used_by_email);
  if (code.used_by_phone) partialParts.push(code.used_by_phone);

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <PressableScale onPress={() => onPress(code)} activeScale={0.98}>
        <View
          style={[
            styles.codeRow,
            {
              backgroundColor: isDark ? DS.darkCard : DS.white,
              borderColor: isPartial ? `${DS.warning}40` : isDark ? DS.darkBorder : DS.gray200,
              borderLeftColor: status.color,
              borderLeftWidth: 3,
            },
          ]}
        >
          <View style={styles.codeRowMain}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.codeRowCode, { color: isDark ? DS.white : DS.gray900 }]}>{code.code}</Text>
                <View style={[styles.statusPill, { backgroundColor: `${status.color}15` }]}>
                  <Ionicons name={status.icon} size={10} color={status.color} />
                  <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <Text style={[styles.codeRowMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {roleMeta?.label || code.role}{code.relationship ? ` · ${code.relationship}` : ''}
              </Text>
              {isPartial && partialParts.length > 0 && (
                <Text style={[styles.codeRowPartialInfo, { color: DS.warning }]} numberOfLines={1}>
                  {partialParts.join(' · ')}
                </Text>
              )}
              {isActive && (
                <Text style={[styles.codeRowExpiry, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                  Expires {new Date(code.expiresAt).toLocaleDateString()}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? DS.gray600 : DS.gray300} />
          </View>

          {(isPartial || isActive) && (
            <View style={styles.codeRowActions}>
              {isPartial && (
                <PressableScale onPress={() => onResendPartial(code.code)} activeScale={0.94}>
                  <View style={[styles.codeActionBtn, { backgroundColor: `${DS.warning}15` }]}>
                    <Ionicons name="refresh-outline" size={14} color={DS.warning} />
                    <Text style={[styles.codeActionText, { color: DS.warning }]}>Resend</Text>
                  </View>
                </PressableScale>
              )}
              {isActive && (
                <PressableScale onPress={() => onRevoke(code.code)} activeScale={0.94}>
                  <View style={[styles.codeActionBtn, { backgroundColor: `${DS.danger}12` }]}>
                    <Ionicons name="close-outline" size={14} color={DS.danger} />
                    <Text style={[styles.codeActionText, { color: DS.danger }]}>Revoke</Text>
                  </View>
                </PressableScale>
              )}
            </View>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Code Details Modal — preserved with all partial-signup logic
   ═══════════════════════════════════════════════════════════════════════════ */

function DetailItem({ label, value, icon, isDark }: { label: string; value: string; icon: string; isDark: boolean }) {
  return (
    <View style={[styles.detailItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }]}>
      <Ionicons name={icon as any} size={16} color={DS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: isDark ? DS.white : DS.gray900 }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const CodeDetailsModal = React.memo(({
  code, visible, onClose, isDark, primaryColor, onResendPartial,
}: {
  code: any; visible: boolean; onClose: () => void;
  isDark: boolean; primaryColor: string; onResendPartial?: (code: string) => void;
}) => {
  if (!code) return null;
  const statusConfig = STATUS_CONFIG[code.status] || STATUS_CONFIG.active;
  const roleMeta = ROLE_META[code.role as RoleKey];
  const isPartial = code.status === 'partial';

  const partialEmail = code.used_by_email || null;
  const partialPhone = code.used_by_phone || null;
  const partialName = code.used_by_name || null;
  const partialUserId = code.used_by || null;
  const partialUsedAt = code.used_at || null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Invite Details</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={isDark ? DS.gray400 : DS.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            {/* Code display */}
            <View style={[styles.modalCodeBlock, { borderColor: isPartial ? `${DS.warning}40` : `${primaryColor}40` }]}>
              <LinearGradient
                colors={isPartial ? [`${DS.warning}15`, 'transparent'] : [`${primaryColor}15`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <Text style={[styles.modalCodeText, { color: isPartial ? DS.warning : primaryColor }]}>{code.code}</Text>
              <View style={[styles.statusPill, { backgroundColor: `${statusConfig.color}15` }]}>
                <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                <Text style={[styles.statusPillText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>

            {/* Partial warning with user info */}
            {isPartial && (
              <View style={[styles.partialWarnBox, { backgroundColor: `${DS.warning}10`, borderColor: `${DS.warning}30` }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="warning" size={16} color={DS.warning} />
                  <Text style={[styles.partialWarnTitle, { color: DS.warning }]}>Partial sign-up detected</Text>
                </View>
                <Text style={[styles.partialWarnLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>User information provided:</Text>
                {partialName && (
                  <View style={styles.partialInfoRow}>
                    <Ionicons name="person-outline" size={13} color={DS.warning} />
                    <Text style={[styles.partialInfoText, { color: isDark ? DS.gray200 : DS.gray800 }]}>{partialName}</Text>
                  </View>
                )}
                {partialEmail && (
                  <View style={styles.partialInfoRow}>
                    <Ionicons name="mail-outline" size={13} color={DS.warning} />
                    <Text style={[styles.partialInfoText, { color: isDark ? DS.gray200 : DS.gray800 }]}>{partialEmail}</Text>
                  </View>
                )}
                {partialPhone && (
                  <View style={styles.partialInfoRow}>
                    <Ionicons name="call-outline" size={13} color={DS.warning} />
                    <Text style={[styles.partialInfoText, { color: isDark ? DS.gray200 : DS.gray800 }]}>{partialPhone}</Text>
                  </View>
                )}
                {partialUserId && (
                  <View style={styles.partialInfoRow}>
                    <Ionicons name="person-circle-outline" size={13} color={DS.warning} />
                    <Text style={[styles.partialInfoText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      ID: {partialUserId.substring(0, 12)}…
                    </Text>
                  </View>
                )}
                {partialUsedAt && (
                  <View style={styles.partialInfoRow}>
                    <Ionicons name="calendar-outline" size={13} color={DS.warning} />
                    <Text style={[styles.partialInfoText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      Started {new Date(partialUsedAt).toLocaleString()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.partialWarnFoot, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {partialEmail
                    ? `Contact them at ${partialEmail} to help them finish.`
                    : 'Resend the invite to help them complete registration.'}
                </Text>
              </View>
            )}

            {/* Details grid */}
            <View style={styles.detailsGrid}>
              <DetailItem label="Role" value={roleMeta?.label || code.role} icon={roleMeta?.icon || 'person'} isDark={isDark} />
              <DetailItem label="Relationship" value={code.relationship || 'Not specified'} icon="heart" isDark={isDark} />
              <DetailItem label="Created" value={new Date(code.created_at).toLocaleDateString()} icon="calendar" isDark={isDark} />
              <DetailItem label="Expires" value={new Date(code.expiresAt).toLocaleDateString()} icon="time" isDark={isDark} />
              {code.used_by && !isPartial && (
                <DetailItem label="Used By" value={code.used_by} icon="person" isDark={isDark} />
              )}
              {code.used_at && (
                <DetailItem label="Used At" value={new Date(code.used_at).toLocaleString()} icon="calendar" isDark={isDark} />
              )}
            </View>

            {/* QR */}
            <View style={{ alignItems: 'center', marginVertical: 14 }}>
              <View style={[styles.modalQrBox, { backgroundColor: isDark ? DS.darkSurface : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <QRCode
                  value={code.code}
                  size={110}
                  color={isDark ? '#ffffff' : '#1a1a1a'}
                  backgroundColor={isDark ? '#1c1917' : '#ffffff'}
                />
              </View>
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <PressableScale
                onPress={() => { Clipboard.setStringAsync(code.code); onClose(); }}
                activeScale={0.96}
                style={{ flex: 1 }}
              >
                <View style={[styles.modalActionBtn, { backgroundColor: `${primaryColor}15` }]}>
                  <Ionicons name="copy-outline" size={18} color={primaryColor} />
                  <Text style={[styles.modalActionText, { color: primaryColor }]}>Copy</Text>
                </View>
              </PressableScale>
              {isPartial && onResendPartial && (
                <PressableScale
                  onPress={() => { onResendPartial(code.code); onClose(); }}
                  activeScale={0.96}
                  style={{ flex: 1 }}
                >
                  <View style={[styles.modalActionBtn, { backgroundColor: `${DS.warning}15` }]}>
                    <Ionicons name="refresh-outline" size={18} color={DS.warning} />
                    <Text style={[styles.modalActionText, { color: DS.warning }]}>Resend</Text>
                  </View>
                </PressableScale>
              )}
              {(code.status === 'active' || code.status === 'partial') && (
                <PressableScale
                  onPress={() => {
                    const lines: string[] = [];
                    lines.push(isPartial
                      ? `📱 You started signing up for LittleLoom but didn't finish!`
                      : `👋 Join me on LittleLoom!`);
                    lines.push(`🎫 Code: ${code.code}`);
                    lines.push(`🔗 https://littleloom.app/join?code=${code.code}`);
                    if (isPartial) {
                      if (partialEmail) lines.push(`📧 Your email: ${partialEmail}`);
                      if (partialPhone) lines.push(`📱 Your phone: ${partialPhone}`);
                      if (partialName) lines.push(`👤 Your name: ${partialName}`);
                      lines.push(``, `Complete your registration to join the family! 🎉`);
                    }
                    Share.share({ message: lines.join('\n') });
                    onClose();
                  }}
                  activeScale={0.96}
                  style={{ flex: 1 }}
                >
                  <View style={[styles.modalActionBtn, { backgroundColor: `${DS.danger}12` }]}>
                    <Ionicons name="share-outline" size={18} color={DS.danger} />
                    <Text style={[styles.modalActionText, { color: DS.danger }]}>Share</Text>
                  </View>
                </PressableScale>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CoParentInviteScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useApp();
  const initialMode = (route.params as any)?.initialMode as 'invite' | 'direct' | undefined;
  const { themeColors, triggerHaptic, avatar } = useCustomization();
  const { userProfile, skipSetup, completeSetup, setupComplete } = useAuth();
  const { currentBaby, babies } = useBaby();
  const {
    generateInviteCode,
    getActiveInviteCodes,
    revokeInviteCode,
    getPartialSignupInfo,
    addMemberDirectly,
  } = useFamily();
  const sweetAlert = useSweetAlert();

  const primary = themeColors?.primary || colors?.primary || DS.primary;
  const secondary = themeColors?.secondary || colors?.primaryLight || DS.accent;

  // Mode: 'invite' (code flow) or 'direct' (add existing account).
  // Defaults from the route param so other screens can deep-link
  // straight into the "Add Known Person" flow.
  const [inviteMode, setInviteMode] = useState<'invite' | 'direct'>(
    initialMode === 'direct' ? 'direct' : 'invite',
  );
  const [directIdentifier, setDirectIdentifier] = useState('');
  const [isAddingDirect, setIsAddingDirect] = useState(false);

  const [role, setRole] = useState<RoleKey>('parent2');
  const [relationship, setRelationship] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as const });
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const isOnboarding = useMemo(() => !setupComplete, [setupComplete]);

  useEffect(() => { loadActiveCodes(); }, []);

  const loadActiveCodes = useCallback(async () => {
    setIsLoadingCodes(true);
    try {
      const codes = await getActiveInviteCodes();
      if (codes) {
        const priority: Record<string, number> = { partial: 0, active: 1, used: 2, expired: 3, revoked: 4 };
        setActiveCodes([...codes].sort((a, b) => {
          const pa = priority[a.status] ?? 5, pb = priority[b.status] ?? 5;
          if (pa !== pb) return pa - pb;
          return b.created_at - a.created_at;
        }));
      }
    } catch (e) { if (__DEV__) console.warn('[CoParentInvite] loadActiveCodes', e); }
    finally { setIsLoadingCodes(false); }
  }, [getActiveInviteCodes]);

  const stats = useMemo(() => {
    return {
      total: activeCodes.length,
      active: activeCodes.filter(c => c.status === 'active').length,
      partial: activeCodes.filter(c => c.status === 'partial').length,
      used: activeCodes.filter(c => c.status === 'used').length,
    };
  }, [activeCodes]);

  const topRibbon = useMemo(() => {
    if (stats.partial > 0) {
      return {
        icon: 'warning-outline' as const,
        color: DS.warning,
        label: 'Needs attention',
        text: `${stats.partial} invite${stats.partial === 1 ? '' : 's'} started but didn't finish — resend to help`,
        onPress: () => {
          const partial = activeCodes.find(c => c.status === 'partial');
          if (partial) { setSelectedCode(partial); setModalVisible(true); }
        },
      };
    }
    if (stats.active > 0) {
      return {
        icon: 'checkmark-circle-outline' as const,
        color: DS.success,
        label: 'Invites active',
        text: `${stats.active} code${stats.active === 1 ? '' : 's'} waiting to be used · share or wait`,
      };
    }
    if (!currentBaby) {
      return {
        icon: 'information-circle-outline' as const,
        color: DS.info,
        label: 'Baby profile needed',
        text: `Invite codes link to a baby. Add one first to get started`,
        onPress: () => navigation.navigate('CreateBabyProfile' as never),
      };
    }
    return {
      icon: 'sparkles-outline' as const,
      color: DS.primary,
      label: 'Ready to invite',
      text: `Pick a role, enter their relationship, and generate a one-time code`,
    };
  }, [stats, activeCodes, currentBaby, navigation]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const validate = useCallback(() => {
    if (!relationship.trim()) { showToast('Please enter their relationship to the baby', 'error'); return false; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Please enter a valid email', 'error'); return false;
    }
    return true;
  }, [relationship, email, showToast]);

  const handleGenerate = useCallback(async () => {
    if (!validate()) return;
    if (!currentBaby?.id) {
      showToast('Add a baby profile first to generate invites', 'info');
      navigation.navigate('CreateBabyProfile' as never);
      return;
    }
    HAPTIC_MEDIUM();
    setIsGenerating(true);
    try {
      const result = await generateInviteCode(
        role,
        relationship.trim(),
        fullName.trim() || undefined,
        email.trim() || undefined,
        phone.trim() || undefined,
      );
      if (result.success && result.code) {
        const code = result.code.padStart(6, '0').slice(0, 6);
        setGeneratedCode(code);
        HAPTIC_SUCCESS();
        showToast('Invite code generated!');
        await loadActiveCodes();
        // The invitee will be auto-added to the family group chat AND
        // get a direct chat with you the moment they sign up.
        // No extra action needed here — but if we want to surface that:
        // (removed in favour of a permanent ribbon on the success card)
      } else {
        showToast(result.message || 'Failed to generate code', 'error');
      }
    } catch (e) {
      if (__DEV__) console.warn('[CoParentInvite] generate', e);
      showToast('Something went wrong', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [validate, currentBaby, generateInviteCode, role, relationship, fullName, email, phone, loadActiveCodes, showToast, navigation]);

  // ── DIRECT ADD HANDLER ─────────────────────────────────────────────
  // The fourth path from the invite screen. Resolves an existing
  // LittleLoom account and adds them as an active member on the spot.
  const handleAddDirect = useCallback(async () => {
    if (isAddingDirect) return;
    if (!directIdentifier.trim()) {
      showToast('Enter an email, @username, or phone', 'error');
      return;
    }
    if (!relationship.trim()) {
      showToast('Enter their relationship to the baby', 'error');
      return;
    }
    if (!currentBaby?.id) {
      showToast('Add a baby profile first', 'info');
      navigation.navigate('CreateBabyProfile' as never);
      return;
    }
    HAPTIC_MEDIUM();
    setIsAddingDirect(true);
    try {
      const userRoleEnum =
        role === 'parent2' ? UserRole.PARENT_2
        : role === 'guardian' ? UserRole.GUARDIAN
        : UserRole.VIEWER;
      const result: AddMemberResult = await addMemberDirectly(
        directIdentifier.trim(),
        userRoleEnum,
        relationship.trim(),
      );

      if (result.ok) {
        HAPTIC_SUCCESS();
        // Use the SAME Aura success modal used throughout the app.
        // This replaces the tiny toast with a proper success capsule
        // that matches MoreScreen / EditGuardian.
        sweetAlert.success(result.title, result.message);
        setDirectIdentifier('');
        setRelationship('');
        setRole('guardian');
        await loadActiveCodes();
      } else {
        if (result.isWarning) {
          sweetAlert.warning(result.title, result.message);
        } else {
          sweetAlert.error(result.title, result.message);
        }
        HAPTIC_WARNING();
      }
    } catch (e) {
      if (__DEV__) console.warn('[CoParentInvite] addDirect', e);
      sweetAlert.error('Something Went Wrong', 'Could not add member. Please try again.');
    } finally {
      setIsAddingDirect(false);
    }
  }, [
    isAddingDirect,
    directIdentifier,
    relationship,
    role,
    currentBaby,
    addMemberDirectly,
    loadActiveCodes,
    showToast,
    sweetAlert,
    navigation,
  ]);
  
  const handleShare = useCallback(async (method: 'copy' | 'whatsapp' | 'sms' | 'email' | 'native', codeOverride?: string) => {
    const code = codeOverride || generatedCode;
    if (!code) return;
    const roleLabel = ROLE_META[role].label;
    const babyName = currentBaby?.name || 'our baby';
    const message = `👋 Join me on LittleLoom!\n\n👶 Baby: ${babyName}\n🎫 Code: ${code}\n👤 Role: ${roleLabel}\n\nDownload the app and enter this code on the sign-up screen.`;
    const url = `https://littleloom.app/join?code=${code}`;
    HAPTIC_LIGHT();

    try {
      switch (method) {
        case 'copy':
          await Clipboard.setStringAsync(`${message}\n${url}`);
          showToast('Copied to clipboard');
          break;
        case 'whatsapp':
          await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message + '\n' + url)}`);
          break;
        case 'sms':
          await Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
          break;
        case 'email':
          await Linking.openURL(`mailto:?subject=${encodeURIComponent(`LittleLoom Invite - ${babyName}`)}&body=${encodeURIComponent(message + '\n\n' + url)}`);
          break;
        case 'native':
          await Share.share({ message, title: `Invite to LittleLoom - ${babyName}` });
          break;
      }
    } catch {
      showToast('Could not open app', 'error');
    }
  }, [generatedCode, role, currentBaby, showToast]);

  const handleRevoke = useCallback(async (code: string) => {
    sweetAlert.confirm(
      'Revoke code?',
      'This code will stop working immediately. The person won\'t be able to use it.',
      async () => {
        const success = await revokeInviteCode(code);
        if (success) {
          showToast('Code revoked');
          await loadActiveCodes();
          if (generatedCode === code) setGeneratedCode('');
        } else {
          showToast('Could not revoke code', 'error');
        }
      },
      () => {},
      'Revoke',
      'Cancel',
      true,
    );
  }, [revokeInviteCode, generatedCode, showToast, loadActiveCodes, sweetAlert]);

  const handleResendPartial = useCallback(async (code: string) => {
    try {
      const partialInfo = await getPartialSignupInfo(code);
      if (!partialInfo.exists) { showToast('No partial signup found for this code', 'error'); return; }

      const roleLabel = ROLE_META[role]?.label || 'Family Member';
      const babyName = currentBaby?.name || 'our baby';
      const lines = [
        `📱 You started signing up for LittleLoom but didn't finish!`,
        ``,
        `👶 Baby: ${babyName}`,
        `🎫 Code: ${code}`,
        `👤 Role: ${roleLabel}`,
        ``,
        `🔗 Continue here: https://littleloom.app/join?code=${code}`,
      ];
      if (partialInfo.name) lines.push(``, `👤 Your name: ${partialInfo.name}`);
      if (partialInfo.email) lines.push(`📧 Your email: ${partialInfo.email}`);
      if (partialInfo.phone) lines.push(`📱 Your phone: ${partialInfo.phone}`);
      lines.push(``, `Complete your registration to join the family! 🎉`);

      await Share.share({ message: lines.join('\n'), title: 'Complete Your Sign-Up' });
      showToast('Share sent with all user info!');
    } catch (e) {
      if (__DEV__) console.warn('[CoParentInvite] resendPartial', e);
      showToast('Could not resend invite', 'error');
    }
  }, [currentBaby, role, getPartialSignupInfo, showToast]);

  const handleSkip = useCallback(async () => {
    HAPTIC_LIGHT();
    setIsLoading(true);
    try {
      await skipSetup('parent2');
      // Mark onboarding complete so cold-boot / re-login routes
      // straight to Main (the family dashboard is reachable, invites
      // can be sent from FamilySharing).
      try {
        await AsyncStorage.multiSet([
          ['littleloom_setup_complete', 'true'],
          ['littleloom_onboarding_complete_v3', 'true'],
        ]);
      } catch {}
      showToast('Skipped for now - you can add later in Family settings', 'info');
      navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
    } catch {
      showToast('Could not skip', 'error');
      navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
    } finally {
      setIsLoading(false);
    }
  }, [skipSetup, showToast, navigation]);

  const handleContinue = useCallback(async () => {
    HAPTIC_MEDIUM();
    setIsLoading(true);
    try {
      await completeSetup('parent2');
      // `completeSetup` already writes `littleloom_parent2_completed`
      // and, if baby is also done, `littleloom_setup_complete`.
      // We belt-and-suspenders the setup + onboarding flags here in
      // case this screen was reached without going through the full
      // flow (e.g. deep link, restored nav state).
      try {
        await AsyncStorage.multiSet([
          ['littleloom_setup_complete', 'true'],
          ['littleloom_onboarding_complete_v3', 'true'],
        ]);
      } catch {}
      showToast('Setup complete! Welcome to the family', 'success');
      navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
    } catch {
      showToast('Could not save progress', 'error');
      navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
    } finally {
      setIsLoading(false);
    }
  }, [completeSetup, showToast, navigation]);

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main' as never);
  };

  const openCode = (code: any) => {
    HAPTIC_LIGHT();
    setSelectedCode(code);
    setModalVisible(true);
  };

  const bgColors = isDark
    ? [DS.darkBg, '#12121e', DS.darkBg]
    : ['#f8faff', '#eef0f5', '#e4e8f0'];

  /* ─── RENDER ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors as any} style={StyleSheet.absoluteFill} />

      {/* ═══ STICKY HEADER ═══ */}
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
            onPress={handleBack}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name={isOnboarding ? 'close' : 'arrow-back'} size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              INVITE
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {isOnboarding ? 'Co-parent setup' : 'Family sharing'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('FamilySharing' as never)}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="people-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ═══ MAIN SCROLL ═══ */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pulse Header */}
        <InvitePulse
          isDark={isDark}
          avatar={avatar}
          baby={currentBaby}
          userProfile={userProfile}
          stats={stats}
          onAvatarPress={() => navigation.navigate('Profile' as never)}
          onBabyPress={() => {
            if (!currentBaby) navigation.navigate('CreateBabyProfile' as never);
            else if (babies && babies.length > 1) navigation.navigate('SwitchBaby' as never, { returnTo: 'CoParentInviteScreen' } as never);
            else navigation.navigate('EditProfile' as never, { mode: 'baby', babyId: currentBaby.id } as never);
          }}
          onRefresh={loadActiveCodes}
          refreshing={isLoadingCodes}
        />

        {/* Aura Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* ═══ MODE TOGGLE ═══════════════════════════════════════════
            Two ways to grow the family:
              • Invite  — share a code with anyone, they sign up
              • Add     — instantly link an EXISTING LittleLoom user
            This is the "fourth path" surfaced where users already are. */}
        <Animated.View entering={FadeInUp.delay(100).springify()}>
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
            <View style={[
              styles.modeSwitch,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100,
                borderColor: isDark ? DS.darkBorder : DS.gray200,
              },
            ]}>
              <TouchableOpacity
                onPress={() => { HAPTIC_LIGHT(); setInviteMode('invite'); }}
                activeOpacity={0.85}
                style={[
                  styles.modeTab,
                  inviteMode === 'invite' && {
                    backgroundColor: isDark ? DS.darkSurface : DS.white,
                    ...DS.shadow.sm,
                  },
                ]}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={16}
                  color={inviteMode === 'invite' ? primary : (isDark ? DS.gray400 : DS.gray500)}
                />
                <Text style={[
                  styles.modeTabText,
                  {
                    color: inviteMode === 'invite' ? primary : (isDark ? DS.gray400 : DS.gray500),
                    fontWeight: inviteMode === 'invite' ? '800' : '600',
                  },
                ]}>
                  Invite via Code
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { HAPTIC_LIGHT(); setInviteMode('direct'); }}
                activeOpacity={0.85}
                style={[
                  styles.modeTab,
                  inviteMode === 'direct' && {
                    backgroundColor: isDark ? DS.darkSurface : DS.white,
                    ...DS.shadow.sm,
                  },
                ]}
              >
                <Ionicons
                  name="flash-outline"
                  size={16}
                  color={inviteMode === 'direct' ? DS.success : (isDark ? DS.gray400 : DS.gray500)}
                />
                <Text style={[
                  styles.modeTabText,
                  {
                    color: inviteMode === 'direct' ? DS.success : (isDark ? DS.gray400 : DS.gray500),
                    fontWeight: inviteMode === 'direct' ? '800' : '600',
                  },
                ]}>
                  Add Known Person
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Role Selection */}
        <View style={{ marginTop: DS.space.lg }}>
          <RoleSelector selected={role} onSelect={setRole} isDark={isDark} />
        </View>

        {/* ═══ DIRECT ADD FORM (mode='direct') ═══════════════════════
            Shown when the parent already knows the person's account.
            Bypasses the invite-code flow entirely and creates an
            ACTIVE membership row on the spot. */}
        {inviteMode === 'direct' && !generatedCode && (
          <Animated.View entering={FadeInUp.delay(160).springify()} style={{ marginTop: DS.space.lg }}>
            <SectionHeader
              title="Who to add"
              subtitle="They already have a LittleLoom account"
              icon="person-add-outline"
              color={DS.success}
            />
            <View style={{ paddingHorizontal: DS.space.lg }}>
              <View style={[
                styles.formCard,
                {
                  backgroundColor: isDark ? DS.darkCard : DS.white,
                  borderColor: isDark ? DS.darkBorder : DS.gray200,
                },
              ]}>
                <View style={{
                  flexDirection: 'row',
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: `${DS.success}10`,
                  borderWidth: 1,
                  borderColor: `${DS.success}25`,
                  marginBottom: 12,
                }}>
                  <Ionicons name="flash" size={14} color={DS.success} />
                  <Text style={{ flex: 1, fontSize: 11, color: DS.success, fontWeight: '600', lineHeight: 15 }}>
                    Requires an existing LittleLoom account. For new people, use <Text style={{ fontWeight: '800' }}>Invite via Code</Text>.
                  </Text>
                </View>

                <InputRow
                  icon="at"
                  label="Email, @username, or phone *"
                  placeholder="e.g. grandma@example.com or @nana"
                  value={directIdentifier}
                  onChangeText={setDirectIdentifier}
                  themeColor={DS.success}
                  isDark={isDark}
                  autoCapitalize="none"
                />
                <InputRow
                  icon="heart-outline"
                  label="Relationship *"
                  placeholder={ROLE_META[role].placeholder}
                  value={relationship}
                  onChangeText={setRelationship}
                  themeColor={DS.success}
                  isDark={isDark}
                />

                <View style={[styles.permPill, { backgroundColor: `${DS.success}10` }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={DS.success} />
                  <Text style={[styles.permPillText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                    {ROLE_META[role].permissions.join(' · ')}
                  </Text>
                </View>
              </View>
            </View>

            <Animated.View entering={FadeInUp.delay(220).springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              <PressableScale
                onPress={handleAddDirect}
                disabled={!directIdentifier.trim() || !relationship.trim() || isAddingDirect}
                activeScale={0.97}
              >
                <LinearGradient
                  colors={
                    directIdentifier.trim() && relationship.trim() && !isAddingDirect
                      ? [DS.success, '#059669']
                      : [DS.gray300, DS.gray400]
                  }
                  style={styles.generateBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isAddingDirect ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={20} color="#fff" />
                      <Text style={styles.generateBtnText}>Add to Family Now</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
              <Text style={[styles.generateHint, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                They join instantly · No sign-up needed
              </Text>
            </Animated.View>
          </Animated.View>
        )}

        {/* Form / Success — INVITE MODE, FORM STATE */}
        {inviteMode === 'invite' && !generatedCode && (
          <Animated.View entering={FadeInUp.delay(160).springify()} style={{ marginTop: DS.space.lg }}>
            <SectionHeader title="Details" subtitle="Who are you inviting?" icon="person-outline" color={secondary} />
            <View style={{ paddingHorizontal: DS.space.lg }}>
              <View style={[styles.formCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <InputRow
                  icon="heart-outline"
                  label="Relationship *"
                  placeholder={ROLE_META[role].placeholder}
                  value={relationship}
                  onChangeText={setRelationship}
                  themeColor={primary}
                  isDark={isDark}
                />
                <InputRow
                  icon="person-outline"
                  label="Full name"
                  placeholder="Optional"
                  value={fullName}
                  onChangeText={setFullName}
                  themeColor={primary}
                  isDark={isDark}
                />
                <InputRow
                  icon="mail-outline"
                  label="Email"
                  placeholder="Optional — for reminders"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  themeColor={primary}
                  isDark={isDark}
                />
                <InputRow
                  icon="call-outline"
                  label="Phone"
                  placeholder="Optional"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  themeColor={primary}
                  isDark={isDark}
                />

                <View style={[styles.permPill, { backgroundColor: `${primary}10` }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={primary} />
                  <Text style={[styles.permPillText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
                    {ROLE_META[role].permissions.join(' · ')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Generate button */}
            <Animated.View entering={FadeInUp.delay(220).springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
              <PressableScale
                onPress={handleGenerate}
                disabled={!relationship.trim() || isGenerating}
                activeScale={0.97}
              >
                <LinearGradient
                  colors={relationship.trim() && !isGenerating ? [primary, secondary] : [DS.gray300, DS.gray400]}
                  style={styles.generateBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  {isGenerating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="key" size={20} color="#fff" />
                      <Text style={styles.generateBtnText}>Generate Invite Code</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
              <Text style={[styles.generateHint, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                One-time use · expires in 7 days
              </Text>
            </Animated.View>
          </Animated.View>
        )}

        {/* Form / Success — INVITE MODE, SUCCESS STATE */}
        {inviteMode === 'invite' && !!generatedCode && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.lg }}>
            <SuccessCapsule
              code={generatedCode}
              role={role}
              babyName={currentBaby?.name}
              isDark={isDark}
              onCopy={() => handleShare('copy')}
              onShare={(m) => handleShare(m as any)}
              onRegenerate={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setGeneratedCode('');
              }}
              onDone={() => setGeneratedCode('')}
            />
            {/* Clarify what happens on signup so inviters trust the flow */}
            <Animated.View entering={FadeInUp.delay(200).springify()} style={{ marginTop: 10 }}>
              <View style={[styles.whatHappens, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50,
                borderColor: isDark ? DS.darkBorder : DS.gray200,
              }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="sparkles" size={14} color={primary} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    When they sign up
                  </Text>
                </View>
                {[
                  { icon: 'people', text: 'Auto-added to your family group chat' },
                  { icon: 'chatbubble-ellipses', text: 'Direct chat with you created' },
                  { icon: 'shield-checkmark', text: `Joined as ${ROLE_META[role].label}` },
                  { icon: 'checkmark-done', text: 'Can log activities immediately' },
                ].map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
                    <Ionicons name={row.icon as any} size={12} color={isDark ? DS.gray400 : DS.gray500} />
                    <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? DS.gray400 : DS.gray500, flex: 1 }}>
                      {row.text}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        )}

        {/* Codes list */}
        <View style={{ marginTop: DS.space.lg }}>
          <SectionHeader
            title="All Codes"
            subtitle={`${activeCodes.length} total`}
            icon="key-outline"
            color={primary}
            action={loadActiveCodes}
            actionLabel="Refresh"
          />
          <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
            {isLoadingCodes ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <ActivityIndicator color={primary} />
              </View>
            ) : activeCodes.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <Ionicons name="key-outline" size={32} color={isDark ? DS.gray500 : DS.gray400} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No codes yet</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Generate your first invite above
                </Text>
              </View>
            ) : (
              activeCodes.map((code, index) => (
                <CodeRow
                  key={code.code}
                  code={code}
                  index={index}
                  isDark={isDark}
                  onPress={openCode}
                  onResendPartial={handleResendPartial}
                  onRevoke={handleRevoke}
                />
              ))
            )}
          </View>
        </View>

        {/* Footer actions */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.xl }}>
          {isOnboarding ? (
            <>
              {!generatedCode && (
                <PressableScale onPress={handleSkip} activeScale={0.97}>
                  <View style={[styles.secondaryBtn, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <Text style={[styles.secondaryBtnText, { color: isDark ? DS.gray400 : DS.gray600 }]}>
                      Skip for now
                    </Text>
                  </View>
                </PressableScale>
              )}
              {generatedCode && (
                <PressableScale onPress={handleContinue} disabled={isLoading} activeScale={0.97}>
                  <LinearGradient colors={[DS.success, '#059669']} style={styles.primaryBtn}>
                    {isLoading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={styles.primaryBtnText}>Continue to Dashboard</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </PressableScale>
              )}
              <Text style={[styles.footerHint, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                You can always invite more people later in Family settings
              </Text>
            </>
          ) : (
            <PressableScale onPress={handleBack} activeScale={0.97}>
              <View style={[styles.secondaryBtn, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Text style={[styles.secondaryBtnText, { color: isDark ? DS.gray300 : DS.gray700 }]}>Done</Text>
              </View>
            </PressableScale>
          )}
        </View>

        {/* Signed-in info */}
        <View style={{ alignItems: 'center', marginTop: DS.space.lg, marginBottom: DS.space.lg }}>
          <Text style={[styles.footerText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
            Signed in as {userProfile?.fullName || 'Parent'}
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </Animated.ScrollView>

      {/* Toast */}
      <Toast {...toast} onHide={() => setToast(p => ({ ...p, visible: false }))} />

      {/* Details modal */}
      <CodeDetailsModal
        code={selectedCode}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setSelectedCode(null); }}
        isDark={isDark}
        primaryColor={primary}
        onResendPartial={handleResendPartial}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Mode switch (Invite vs Add) */
  modeSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: DS.radius.full,
    borderWidth: 1,
    gap: 2,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: DS.radius.full,
  },
  modeTabText: {
    fontSize: 12,
  },

  /* Toast */
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 10,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: DS.space.md,
  },
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
  pulseAvatarInner: {
    width: 54, height: 54, borderRadius: 27, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '75%' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
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

  /* Role */
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: DS.radius.lg,
  },
  roleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  roleDesc: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  roleCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },

  /* Form */
  formCard: {
    padding: DS.space.md, borderRadius: DS.radius.xl, borderWidth: 1,
    ...DS.shadow.sm,
  },
  inputLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, paddingHorizontal: 14, borderRadius: DS.radius.md, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '600' },
  permPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: DS.radius.sm,
    marginTop: 8,
  },
  permPillText: { fontSize: 11, fontWeight: '600', flex: 1 },

  /* Generate */
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: DS.radius.lg,
    ...DS.shadow.md,
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  generateHint: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: 8 },

  /* Success capsule */
  successCapsule: {
    padding: DS.space.lg, borderRadius: DS.radius['2xl'], borderWidth: 1.5,
    overflow: 'hidden', ...DS.shadow.md,
  },
  successGlow: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
  },
  successCheck: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  successSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  codeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  codeText: { fontSize: 30, fontWeight: '900', letterSpacing: 5, marginVertical: 4 },
  codeMeta: { fontSize: 11, fontWeight: '500' },
  qrBox: {
    padding: 6, borderRadius: DS.radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  shareRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: DS.space.lg, paddingTop: DS.space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.15)',
  },
  shareBtnIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shareBtnLabel: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  regenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: DS.space.sm,
  },
  regenerateText: { fontSize: 12, fontWeight: '700' },

  /* Codes list */
  codeRow: {
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
    ...DS.shadow.sm,
  },
  codeRowMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeRowCode: { fontSize: 17, fontWeight: '800', letterSpacing: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  statusPillText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  codeRowMeta: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  codeRowPartialInfo: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  codeRowExpiry: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  codeRowActions: {
    flexDirection: 'row', gap: 8, marginTop: DS.space.sm,
    paddingTop: DS.space.sm, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  codeActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.radius.sm,
  },
  codeActionText: { fontSize: 11, fontWeight: '700' },

  /* Empty */
  emptyState: {
    paddingVertical: DS.space['3xl'], alignItems: 'center',
    borderRadius: DS.radius.lg, borderWidth: 1,
  },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  /* Buttons */
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: DS.radius.lg, ...DS.shadow.md,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  footerHint: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: DS.space.sm },

  footerText: { fontSize: 11, fontWeight: '500' },
  whatHappens: {
    padding: DS.space.md,
    borderRadius: DS.radius.md,
    borderWidth: 1,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 420, borderRadius: DS.radius['2xl'],
    padding: DS.space.lg, ...DS.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: DS.space.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalCodeBlock: {
    padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    overflow: 'hidden', marginBottom: DS.space.md,
  },
  modalCodeText: { fontSize: 26, fontWeight: '900', letterSpacing: 4 },
  partialWarnBox: {
    padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1,
    marginBottom: DS.space.md, gap: 6,
  },
  partialWarnTitle: { fontSize: 13, fontWeight: '800' },
  partialWarnLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4, marginBottom: 2 },
  partialInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  partialInfoText: { fontSize: 12, fontWeight: '600', flex: 1 },
  partialWarnFoot: { fontSize: 11, fontWeight: '500', lineHeight: 15, marginTop: 6, fontStyle: 'italic' },
  detailsGrid: { gap: 6, marginBottom: DS.space.sm },
  detailItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: DS.radius.sm,
  },
  detailLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  modalQrBox: {
    padding: 10, borderRadius: DS.radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  modalActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 11, borderRadius: DS.radius.md,
  },
  modalActionText: { fontSize: 12, fontWeight: '700' },
});