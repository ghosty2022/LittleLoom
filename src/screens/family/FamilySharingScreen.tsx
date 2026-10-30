import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
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
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { differenceInMonths, formatDistanceToNow, format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import type { RootStackParamList } from '../../types/navigation';
import { UserRole, FamilyMember, getMemberDisplayLabel, canonicalizeRelationship, normalizeRole } from '../../types/roles';
import FamilyTree from '../../components/FamilyTree';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useTracker } from '../../hooks';
import { useSafeUser } from '../../hooks/useSafeContexts';

const { width: SCREEN_W } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;
const FAMILY_IMAGES_DIR = FileSystem.documentDirectory + 'family_images/';

type FamilySharingScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilySharing'>;
type TabKey = 'tree' | 'members' | 'activity' | 'access' | 'settings';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura (aligned with Home / Community / More / Timeline)
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
   ROLE / PERMISSION CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
const ROLE_CONFIG: Record<UserRole, {
  label: string; color: string; gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap; description: string;
  permissions: string[]; badge: string; maxCount: number;
}> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent', color: '#667eea', gradient: ['#667eea', '#764ba2'], icon: 'shield',
    description: 'Full owner access to everything',
    permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data'],
    badge: 'Owner', maxCount: 1,
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent', color: '#fa709a', gradient: ['#fa709a', '#f5576c'], icon: 'heart',
    description: 'Full access to manage family and baby data',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'],
    badge: 'Co-Parent', maxCount: 1,
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian', color: '#11998e', gradient: ['#11998e', '#38ef7d'], icon: 'shield-checkmark',
    description: 'Can add entries but not delete or manage family',
    permissions: ['Read', 'Write', 'Limited Delete', 'View Timeline'],
    badge: 'Guardian', maxCount: 5,
  },
  [UserRole.VIEWER]: {
    label: 'Viewer', color: '#64748b', gradient: ['#64748b', '#94a3b8'], icon: 'eye',
    description: 'View only access',
    permissions: ['Read Only', 'View Timeline', 'View Photos'],
    badge: 'Viewer', maxCount: 10,
  },
};

type PermissionKey =
  | 'canView' | 'canAddEntry' | 'canEditEntry' | 'canEditOthersEntries'
  | 'canDeleteEntry' | 'canEditBaby' | 'canInvite' | 'canExport' | 'canManageFamily';

const PERMISSION_META: Record<PermissionKey, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  canView: { label: 'View', icon: 'eye', color: '#3b82f6' },
  canAddEntry: { label: 'Log', icon: 'add-circle', color: '#10b981' },
  canEditEntry: { label: 'Edit Own', icon: 'create', color: '#8b5cf6' },
  canEditOthersEntries: { label: 'Edit Others', icon: 'pencil', color: '#f59e0b' },
  canDeleteEntry: { label: 'Delete', icon: 'trash', color: '#ef4444' },
  canEditBaby: { label: 'Baby Profile', icon: 'person', color: '#06b6d4' },
  canInvite: { label: 'Invite', icon: 'mail', color: '#ec4899' },
  canExport: { label: 'Export', icon: 'download', color: '#a855f7' },
  canManageFamily: { label: 'Manage Family', icon: 'people', color: '#f97316' },
};

const ROLE_PERMISSION_MAP: Record<UserRole, Record<PermissionKey, boolean>> = {
  [UserRole.PARENT_1]: { canView: true, canAddEntry: true, canEditEntry: true, canEditOthersEntries: true, canDeleteEntry: true, canEditBaby: true, canInvite: true, canExport: true, canManageFamily: true },
  [UserRole.PARENT_2]: { canView: true, canAddEntry: true, canEditEntry: true, canEditOthersEntries: true, canDeleteEntry: true, canEditBaby: true, canInvite: true, canExport: true, canManageFamily: true },
  [UserRole.GUARDIAN]: { canView: true, canAddEntry: true, canEditEntry: true, canEditOthersEntries: false, canDeleteEntry: false, canEditBaby: false, canInvite: false, canExport: false, canManageFamily: false },
  [UserRole.VIEWER]: { canView: true, canAddEntry: false, canEditEntry: false, canEditOthersEntries: false, canDeleteEntry: false, canEditBaby: false, canInvite: false, canExport: false, canManageFamily: false },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active: { label: 'Active', color: '#22c55e', icon: 'checkmark-circle' },
  used: { label: 'Used', color: '#64748b', icon: 'checkmark-done-circle' },
  partial: { label: 'Partial', color: '#f59e0b', icon: 'warning' },
  revoked: { label: 'Revoked', color: '#ef4444', icon: 'close-circle' },
  expired: { label: 'Expired', color: '#f59e0b', icon: 'time' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const isImageUri = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  return v.startsWith('http') || v.startsWith('file://') || v.startsWith('data:');
};
const isEmoji = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  if (v.length > 4) return false;
  return /\p{Emoji}/u.test(v);
};
const safeStr = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v));

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
  style?: any; activeScale?: number; haptic?: 'light' | 'medium' | 'heavy';
}>(({ children, onPress, disabled, style, activeScale = 0.96, haptic = 'light' }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    if (disabled) return;
    if (haptic === 'light') HAPTIC_LIGHT();
    else if (haptic === 'medium') HAPTIC_MEDIUM();
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
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
   SAFE AVATAR
   ═══════════════════════════════════════════════════════════════════════════ */
const SafeAvatar: React.FC<{
  avatar?: string | null; size?: number; fallbackEmoji?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap; fallbackColor?: string;
}> = ({ avatar, size = 56, fallbackEmoji = '👤', fallbackIcon = 'person', fallbackColor = DS.primary }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.8, overflow: 'hidden' }}>
      <LinearGradient
        colors={[fallbackColor + '20', fallbackColor + '40']}
        style={{ width: size, height: size, borderRadius: size / 2.8, alignItems: 'center', justifyContent: 'center' }}
      >
        {hasImage ? (
          <Image source={{ uri: avatar! }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : hasEmoji ? (
          <Text style={{ fontSize: size * 0.5 }}>{avatar}</Text>
        ) : (
          <Ionicons name={fallbackIcon} size={size * 0.4} color={fallbackColor} />
        )}
      </LinearGradient>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PULSE HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
interface PulseHeaderProps {
  isDark: boolean;
  currentBaby: any;
  members: FamilyMember[];
  currentUserId: string;
  activeCount: number;
  pendingCount: number;
  unreadChat: number;
  isPrimaryParent: boolean;
  onBack: () => void;
  onBabyPress: () => void;
  onInvite: () => void;
  onChat: () => void;
}

const PulseHeader = React.memo<PulseHeaderProps>(({
  isDark, currentBaby, members, currentUserId, activeCount, pendingCount, unreadChat,
  isPrimaryParent, onBack, onBabyPress, onInvite, onChat,
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

  const avatarStack = members.slice(0, 4);
  const extra = Math.max(0, members.length - 4);
  const totalChat = unreadChat;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View
        style={[
          styles.pulseWrap,
          {
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)', 'rgba(139,92,246,0.06)']
              : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
          style={styles.pulseGlowL}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[`${DS.accent}${isDark ? '38' : '22'}`, 'transparent']}
          style={styles.pulseGlowR}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />

        <PressableScale onPress={onBack} activeScale={0.9} haptic="light">
          <View style={[styles.pulseBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>

        <View style={styles.pulseRow}>
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient
                  colors={[DS.primary, DS.accent, DS.warning, DS.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                {currentBaby ? (
                  <SafeAvatar avatar={currentBaby.avatar || '👶'} size={46} fallbackIcon="happy-outline" fallbackColor={DS.primary} />
                ) : (
                  <Ionicons name="add-circle" size={26} color={DS.primary} />
                )}
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.pulseTitle}>
                FAMILY
              </GradientText>
              <View style={[styles.pulseLivePill, { backgroundColor: `${DS.success}18` }]}>
                <PulsingDot color={DS.success} size={6} />
                <Text style={[styles.pulseLiveText, { color: DS.success }]}>{activeCount} active</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onBabyPress} activeOpacity={0.7} style={styles.pulseSubRow}>
              <Text style={[styles.pulseBabyName, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>
                {currentBaby?.name || 'Add a baby profile'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={isDark ? DS.gray500 : DS.gray400} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onChat} activeScale={0.9} haptic="light">
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(236,72,153,0.15)' : `${DS.accent}12` }]}>
                <Ionicons name="chatbubbles-outline" size={18} color={DS.accent} />
                {totalChat > 0 && (
                  <View style={[styles.pulseBadge, { backgroundColor: DS.danger }]}>
                    <Text style={styles.pulseBadgeText}>{totalChat > 9 ? '9+' : totalChat}</Text>
                  </View>
                )}
              </View>
            </PressableScale>
            {isPrimaryParent && (
              <PressableScale onPress={onInvite} activeScale={0.9} haptic="medium">
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  style={styles.pulseAddBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="person-add" size={18} color={DS.white} />
                </LinearGradient>
              </PressableScale>
            )}
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.avatarStack}>
            {avatarStack.map((m, i) => {
              const roleCfg = ROLE_CONFIG[m.role] || ROLE_CONFIG[UserRole.VIEWER];
              const isYou = m.id === currentUserId || m.userId === currentUserId;
              return (
                <View key={m.id + i} style={[styles.avatarStackItem, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i, borderColor: isDark ? DS.darkCard : DS.white }]}>
                  <SafeAvatar avatar={m.avatar} size={28} fallbackColor={roleCfg.color} />
                  {isYou && (
                    <View style={[styles.avatarYouDot, { backgroundColor: DS.primary, borderColor: isDark ? DS.darkCard : DS.white }]} />
                  )}
                </View>
              );
            })}
            {extra > 0 && (
              <View style={[styles.avatarExtra, { marginLeft: -10, backgroundColor: isDark ? DS.darkSurface : DS.gray100, borderColor: isDark ? DS.darkCard : DS.white }]}>
                <Text style={[styles.avatarExtraText, { color: isDark ? DS.gray300 : DS.gray600 }]}>+{extra}</Text>
              </View>
            )}
          </View>

          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />

          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{members.length}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>members</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: pendingCount > 0 ? DS.warning : DS.gray400 }]}>{pendingCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>pending</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   AURA RIBBON
   ═══════════════════════════════════════════════════════════════════════════ */
const AuraRibbon = React.memo<{
  isDark: boolean; icon: keyof typeof Ionicons.glyphMap; color: string;
  label: string; text: string; onPress?: () => void;
}>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(120).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   TAB BAR
   ═══════════════════════════════════════════════════════════════════════════ */
const TabBar = ({ tabs, activeTab, onChange, isDark }: {
  tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: TabKey;
  onChange: (t: TabKey) => void;
  isDark: boolean;
}) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.06)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tabItem, isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}
          activeOpacity={0.8}
        >
          <Ionicons name={tab.icon} size={14} color={isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
          <Text style={[styles.tabLabel, { color: isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500 }, isActive && { fontWeight: '700' }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  action?: () => void; actionLabel?: string;
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
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY HEALTH CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const FamilyHealthCard = React.memo(({ members, isDark }: { members: FamilyMember[]; isDark: boolean }) => {
  const score = useMemo(() => {
    const active = members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 7 * 86400000).length;
    const total = members.length || 1;
    const activityScore = Math.round((active / total) * 100);
    const engagementScore = Math.min(100, members.length * 15);
    return Math.round(activityScore * 0.6 + engagementScore * 0.4);
  }, [members]);

  const color = score >= 80 ? DS.success : score >= 50 ? DS.warning : DS.danger;
  const label = score >= 80 ? 'Thriving' : score >= 50 ? 'Active' : 'Needs Attention';

  return (
    <Animated.View entering={FadeInUp.delay(60).springify()}>
      <View style={[styles.card, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={[`${color}10`, `${color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.lg }}>
          <View style={[styles.healthRing, { borderColor: `${color}30` }]}>
            <View style={[styles.healthRingFill, { borderColor: color, transform: [{ rotate: `${-90 + (score / 100) * 360}deg` }] }]} />
            <View style={styles.healthRingInner}>
              <Text style={[styles.healthRingValue, { color }]}>{score}</Text>
              <Text style={[styles.healthRingMax, { color: isDark ? DS.gray500 : DS.gray400 }]}>/100</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.healthTitle, { color: isDark ? DS.white : DS.gray900 }]}>Family Health</Text>
            <Text style={[styles.healthLabel, { color }]}>{label}</Text>
            <View style={styles.healthStatsRow}>
              {[
                { label: 'Active', value: members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 86400000).length, color: DS.success },
                { label: 'Week', value: members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 7 * 86400000).length, color: DS.warning },
                { label: 'Pending', value: members.filter(m => !m.lastActive || m.status === 'pending').length, color: DS.danger },
              ].map((stat, i) => (
                <View key={i} style={styles.healthStat}>
                  <Text style={[styles.healthStatVal, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.healthStatLbl, { color: isDark ? DS.gray500 : DS.gray400 }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   DAILY GOALS
   ═══════════════════════════════════════════════════════════════════════════ */
interface DailyGoal {
  id: string; title: string; icon: string; target: number;
  current: number; unit: string; color: string;
}

const DailyGoals = React.memo(({ goals, isDark, onPress }: { goals: DailyGoal[]; isDark: boolean; onPress: (id: string) => void }) => {
  if (!goals.length) return null;
  const completed = goals.filter(g => g.current >= g.target).length;
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader
        title="Daily Goals"
        subtitle={`${completed} of ${goals.length} complete`}
        icon="trophy-outline"
        color={DS.warning}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {goals.map((g) => {
          const pct = Math.min(g.current / g.target, 1);
          const done = pct >= 1;
          return (
            <PressableScale key={g.id} onPress={() => onPress(g.id)} activeScale={0.94}>
              <View style={[styles.goalCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <LinearGradient colors={[`${g.color}10`, `${g.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 22 }}>{g.icon}</Text>
                  {done && <Ionicons name="checkmark-circle" size={16} color={DS.success} />}
                </View>
                <Text style={[styles.goalTitle, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>{g.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                  <Text style={[styles.goalVal, { color: isDark ? DS.white : DS.gray900 }]}>{g.current}</Text>
                  <Text style={[styles.goalTotal, { color: isDark ? DS.gray500 : DS.gray400 }]}>/{g.target}</Text>
                </View>
                <View style={[styles.goalBarBg, { backgroundColor: `${g.color}12` }]}>
                  <View style={[styles.goalBarFill, { width: `${pct * 100}%`, backgroundColor: done ? DS.success : g.color }]} />
                </View>
                <Text style={[styles.goalUnit, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>{g.unit}</Text>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MEMBER CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const MemberCard = React.memo(({
  member, isCurrentUser, onPress, index, isDark, currentUserId,
}: {
  member: FamilyMember; isCurrentUser: boolean; onPress: () => void;
  index: number; isDark: boolean; currentUserId: string;
}) => {
  const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER];
  const isOnline = member.lastActive && new Date(member.lastActive).getTime() > Date.now() - 5 * 60000;
  const isPending = !member.lastActive || member.status === 'pending';

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <PressableScale onPress={onPress} activeScale={0.98}>
        <View style={[styles.memberCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <LinearGradient colors={roleCfg.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.memberStrip} />
          <View style={styles.memberRow}>
            <View style={{ position: 'relative' }}>
              <SafeAvatar avatar={member.avatar} size={48} fallbackColor={roleCfg.color} />
              {isCurrentUser && (
                <View style={[styles.memberYouDot, { backgroundColor: DS.primary, borderColor: isDark ? DS.darkCard : DS.white }]} />
              )}
              {isOnline && (
                <View style={[styles.memberOnlineDot, { borderColor: isDark ? DS.darkCard : DS.white }]} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: DS.space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.memberName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                  {member.fullName}
                </Text>
                {isCurrentUser && (
                  <View style={[styles.youBadge, { backgroundColor: `${DS.primary}18` }]}>
                    <Text style={[styles.youBadgeText, { color: DS.primary }]}>You</Text>
                  </View>
                )}
              </View>
              <View style={styles.memberMetaRow}>
                <LinearGradient colors={roleCfg.gradient} style={styles.roleBadge}>
                  <Ionicons name={roleCfg.icon} size={9} color={DS.white} />
                  <Text style={styles.roleBadgeText}>
                    {getMemberDisplayLabel({ role: member.role, relationship: member.relationship })}
                  </Text>
                </LinearGradient>
                {member.relationship && canonicalizeRelationship(member.relationship).toLowerCase() !== getMemberDisplayLabel({ role: member.role, relationship: member.relationship }).toLowerCase() ? (
                  <Text style={[styles.memberRelationship, { color: isDark ? DS.gray500 : DS.gray400 }]} numberOfLines={1}>
                    · {canonicalizeRelationship(member.relationship)}
                  </Text>
                ) : null}
              </View>
              {isPending ? (
                <View style={styles.pendingInline}>
                  <Ionicons name="time-outline" size={11} color={DS.warning} />
                  <Text style={[styles.pendingInlineText, { color: DS.warning }]}>Invitation pending</Text>
                </View>
              ) : member.lastActive ? (
                <Text style={[styles.memberActiveText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                  {isOnline ? 'Active now' : `Active ${formatDistanceToNow(new Date(member.lastActive), { addSuffix: true })}`}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITY TIMELINE
   ═══════════════════════════════════════════════════════════════════════════ */
interface TimelineEvent {
  id: string; type: string; title: string; description?: string;
  timestamp: number; actorName: string; actorRole: UserRole;
}

const ActivityTimeline = React.memo(({ events, isDark }: { events: TimelineEvent[]; isDark: boolean }) => {
  const ACTIVITY_ICONS: Record<string, string> = {
    feed: '🍼', sleep: '😴', potty: '🚽', diaper: '🧷', growth: '📏',
    medication: '💊', milestone: '🏆', note: '📝',
  };
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return format(new Date(ts), 'MMM d');
  };

  if (events.length === 0) {
    return (
      <Animated.View entering={FadeInUp.delay(80).springify()}>
        <SectionHeader title="Recent Activity" subtitle="No events yet" icon="time-outline" color={DS.info} />
        <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
            <Ionicons name="time-outline" size={36} color={isDark ? DS.gray500 : DS.gray400} />
          </View>
          <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>No activity yet</Text>
          <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Family activity will appear here</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(80).springify()}>
      <SectionHeader title="Recent Activity" subtitle={`${events.length} events`} icon="pulse-outline" color={DS.info} />
      <View style={{ paddingHorizontal: DS.space.lg }}>
        {events.map((e, i) => (
          <Animated.View key={e.id} entering={FadeInUp.delay(i * 50).springify()} style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: DS.primary }]} />
              {i < events.length - 1 && <View style={[styles.timelineLine, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
            </View>
            <View style={[styles.timelineCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
                <Text style={{ fontSize: 18 }}>{ACTIVITY_ICONS[e.type] || '📝'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timelineTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{e.title}</Text>
                  <Text style={[styles.timelineMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                    by {e.actorName} · {formatTime(e.timestamp)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   ACCESS TAB
   ═══════════════════════════════════════════════════════════════════════════ */
const AccessTab = ({
  members, isDark, canManage, currentUserId, onMemberPress,
}: {
  members: FamilyMember[]; isDark: boolean; canManage: boolean;
  currentUserId: string; onMemberPress: (m: FamilyMember) => void;
}) => {
  const formatLastActive = (iso?: string): string => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <View style={{ gap: 10, paddingTop: DS.space.md }}>
      {!canManage && (
        <View style={[styles.readOnlyBanner, { backgroundColor: `${DS.warning}12`, borderColor: `${DS.warning}30` }]}>
          <Ionicons name="eye-outline" size={14} color={DS.warning} />
          <Text style={[styles.readOnlyText, { color: DS.warning }]}>
            Only Parent 1 / Parent 2 can change permissions
          </Text>
        </View>
      )}
      {members.map((member, idx) => {
        const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER];
        const permMap = ROLE_PERMISSION_MAP[member.role] || ROLE_PERMISSION_MAP[UserRole.VIEWER];
        const activePerms = (Object.keys(PERMISSION_META) as PermissionKey[]).filter(k => permMap[k]);
        const isYou = member.id === currentUserId || member.userId === currentUserId;
        const isPending = !member.lastActive || member.status === 'pending';
        return (
          <Animated.View key={member.id} entering={FadeInUp.delay(80 + idx * 40).springify()}>
            <PressableScale
              onPress={() => { if (canManage && member.role !== UserRole.PARENT_1) onMemberPress(member); }}
              activeScale={0.98}
            >
              <View style={[styles.permCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.md }}>
                  <SafeAvatar avatar={member.avatar} size={44} fallbackColor={roleCfg.color} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.permName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                        {member.fullName}
                        {member.role === UserRole.PARENT_1 && ' (Owner)'}
                      </Text>
                      {isYou && (
                        <View style={[styles.youBadge, { backgroundColor: `${DS.primary}18` }]}>
                          <Text style={[styles.youBadgeText, { color: DS.primary }]}>You</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.permRolePill, { backgroundColor: `${roleCfg.color}15` }]}>
                      <Text style={[styles.permRoleText, { color: roleCfg.color }]}>
                        {getMemberDisplayLabel({
                          role: member.role,
                          relationship: member.relationship,
                        })}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.permMetaRow}>
                  <Ionicons name="time-outline" size={12} color={isDark ? DS.gray500 : DS.gray400} />
                  <Text style={[styles.permMetaText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    Last active: {formatLastActive(member.lastActive)}
                  </Text>
                  {isPending && (
                    <View style={[styles.permPendingPill, { backgroundColor: `${DS.warning}15` }]}>
                      <Text style={[styles.permPendingText, { color: DS.warning }]}>Invite Pending</Text>
                    </View>
                  )}
                </View>

                <View style={styles.permChips}>
                  {activePerms.map(key => {
                    const meta = PERMISSION_META[key];
                    return (
                      <View key={key} style={[styles.permChip, { backgroundColor: `${meta.color}15` }]}>
                        <Ionicons name={meta.icon} size={10} color={meta.color} />
                        <Text style={[styles.permChipText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </PressableScale>
          </Animated.View>
        );
      })}
      <View style={styles.permFooter}>
        <Ionicons name="information-circle-outline" size={14} color={isDark ? DS.gray500 : DS.gray400} />
        <Text style={[styles.permFooterText, { color: isDark ? DS.gray500 : DS.gray400 }]}>
          All access changes sync instantly across family devices.
        </Text>
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS TAB
   ═══════════════════════════════════════════════════════════════════════════ */
const SettingsTab = ({
  isDark, isPrimaryParent, familyCount, hasCoParent, guardianCount, unreadCount,
  onOpenMembers, onOpenAccess, onOpenFamilyChat, onOpenInvite,
  onOpenBackup, onOpenReminders, onLeaveFamily, onTransferOwnership,
}: {
  isDark: boolean; isPrimaryParent: boolean; familyCount: number;
  hasCoParent: boolean; guardianCount: number; unreadCount: number;
  onOpenMembers: () => void; onOpenAccess: () => void; onOpenFamilyChat: () => void;
  onOpenInvite: () => void; onOpenBackup: () => void; onOpenReminders: () => void;
  onLeaveFamily: () => void; onTransferOwnership: () => void;
}) => {
  const renderRow = (
    icon: keyof typeof Ionicons.glyphMap, color: string,
    title: string, subtitle: string, onPress: () => void,
    destructive = false, badge?: number,
  ) => (
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.setRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.setIcon, { backgroundColor: (destructive ? DS.danger : color) + '15' }]}>
          <Ionicons name={icon} size={20} color={destructive ? DS.danger : color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.setTitle, { color: destructive ? DS.danger : isDark ? DS.white : DS.gray900 }]}>
            {title}
          </Text>
          <Text style={[styles.setSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {badge !== undefined && badge > 0 && (
          <View style={[styles.setBadge, { backgroundColor: DS.danger }]}>
            <Text style={styles.setBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
      </View>
    </PressableScale>
  );

  return (
    <View style={{ gap: 10, paddingTop: DS.space.md }}>
      <Animated.View entering={FadeInUp.delay(40).springify()}>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <LinearGradient colors={[`${DS.primary}10`, `${DS.accent}06`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: DS.primary }]}>{familyCount}</Text>
              <Text style={[styles.summaryLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Members</Text>
            </View>
            <View style={[styles.summaryDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: DS.accent }]}>{hasCoParent ? 'Yes' : 'No'}</Text>
              <Text style={[styles.summaryLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Co-Parent</Text>
            </View>
            <View style={[styles.summaryDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: DS.success }]}>{guardianCount}</Text>
              <Text style={[styles.summaryLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>Guardians</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <SectionHeader title="Communication" icon="chatbubbles-outline" color={DS.accent} />
      {renderRow('chatbubbles-outline', DS.accent, 'Family Chat',
        unreadCount > 0 ? `${unreadCount} unread messages` : 'Message your family',
        onOpenFamilyChat, false, unreadCount)}

      <SectionHeader title="Family Management" icon="people-outline" color={DS.primary} />
      {renderRow('people-outline', DS.primary, 'Family Members', 'See everyone in this family', onOpenMembers)}
      {renderRow('shield-checkmark-outline', DS.warning, 'Roles & Permissions', 'Control what family members can access', onOpenAccess)}
      {isPrimaryParent && renderRow('person-add', DS.success, 'Invite Co-Parent', 'Send an invite to your partner', onOpenInvite)}

      <SectionHeader title="Data & Privacy" icon="lock-closed-outline" color={DS.info} />
      {renderRow('cloud-upload-outline', DS.success, 'Export & Backup', 'Backup all family records', onOpenBackup)}
      {renderRow('notifications-outline', '#4facfe', 'Notifications & Reminders', 'Alerts for family activity', onOpenReminders)}

      <SectionHeader title="Ownership" icon="shield-outline" color={DS.warning} />
      {isPrimaryParent &&
        renderRow(
          'swap-horizontal-outline',
          DS.warning,
          'Transfer Ownership',
          'Hand Primary Parent to a partner before leaving',
          onTransferOwnership,
        )}

      <SectionHeader title="Danger Zone" icon="warning-outline" color={DS.danger} />
      {renderRow('exit-outline', DS.danger, 'Leave Family', 'Remove yourself from this family group', onLeaveFamily, true)}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ACTION MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const ActionModal = ({ visible, onClose, title, children, isDark }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; isDark: boolean;
}) => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); opacity.value = withTiming(1, { duration: 250 }); }
    else { scale.value = withTiming(0.95); opacity.value = withTiming(0); }
  }, [visible]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <BlurView intensity={isDark ? 60 : 90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.modalCard, anim, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: DS.space.lg }}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FamilySharingScreen({ navigation }: FamilySharingScreenProps) {
  const sweetAlert = useSweetAlert();
  const {
    members, guardians, parent1, parent2, loadFamily,
    removeMember, updateGuardianProfile, updateParent2Profile,
    getActiveInviteCodes, revokeInviteCode, getPartialSignupInfo,
    transferOwnership,
  } = useFamily();

  const { profile, updateProfile } = useSafeUser();
  const { currentBaby, babies } = useBaby();
  const { userProfile, resetPasswordForUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;

  const scrollY = useSharedValue(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('members');
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    fullName: '', email: '', phoneNumber: '', relationship: '', avatar: '', notificationsEnabled: true,
  });

  const { entries: trackerEntries } = useTracker();

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  /* ─── Data derivations ──────────────────────────────────────────── */
  const dailyGoals = useMemo((): DailyGoal[] => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const today = trackerEntries.filter((e: any) => e.timestamp >= start.getTime() && !e.isDeleted);
    const count = (id: string) => today.filter((e: any) => e.trackerId === id).length;
    return [
      { id: 'feed', title: 'Feeding', icon: '🍼', target: 6, current: count('feed'), unit: 'times today', color: '#f59e0b' },
      { id: 'sleep', title: 'Sleep', icon: '😴', target: 3, current: count('sleep'), unit: 'naps today', color: '#8b5cf6' },
      { id: 'growth', title: 'Growth', icon: '📏', target: 1, current: count('growth'), unit: 'measurement', color: '#10b981' },
      { id: 'photo', title: 'Photos', icon: '📸', target: 1, current: today.filter((e: any) => Array.isArray(e.photoUris) && e.photoUris.length > 0).length, unit: 'photo today', color: '#ec4899' },
    ];
  }, [trackerEntries]);

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!trackerEntries || trackerEntries.length === 0) return [];
    return trackerEntries
      .filter((e: any) => e?.timestamp && e?.trackerId && !e.isDeleted)
      .slice(0, 10)
      .map((e: any, i: number) => ({
        id: e.id || `event-${i}`,
        type: e.trackerId || 'note',
        title: e.title || `${(e.trackerId || 'Activity').charAt(0).toUpperCase() + (e.trackerId || '').slice(1)} logged`,
        description: e.notes || '',
        timestamp: e.timestamp,
        actorName: e.loggedByName || 'You',
        actorRole: (e.loggedByRole as UserRole) || UserRole.PARENT_1,
      }))
      .sort((a: TimelineEvent, b: TimelineEvent) => b.timestamp - a.timestamp);
  }, [trackerEntries]);

  const currentUserId = useMemo(
    () => userProfile?.id || userProfile?.uid || profile?.id || '',
    [userProfile, profile],
  );

  const isPrimaryParent = useMemo(() => {
    if (!currentUserId) return false;
    // `parent1` is a `FamilyMember` — its `id` is the `family_members` row id,
    // NOT the profile UUID. Match against BOTH `id` and `userId`.
    if (parent1 && (parent1.id === currentUserId || (parent1 as any).userId === currentUserId)) {
      return true;
    }
    // Fall back to scanning `members` for a PARENT_1 row that belongs to me.
    return members.some(
      (m) =>
        m.role === UserRole.PARENT_1 &&
        (m.id === currentUserId || (m as any).userId === currentUserId),
    );
  }, [parent1, members, currentUserId]);

  const hasCoParent = useMemo(() => members.some(m => m.role === UserRole.PARENT_2) || !!parent2, [members, parent2]);
  const familyCount = useMemo(() => members.length, [members]);
  const activeCount = useMemo(() => members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 86400000).length, [members]);
  const pendingCount = useMemo(() => members.filter(m => !m.lastActive || m.status === 'pending').length, [members]);
  const unreadChat = 0;

  /* ─── Effects ───────────────────────────────────────────────────── */
  useEffect(() => { loadFamily(); }, [loadFamily]);

  // Re-read family on every focus so role changes made via
  // EditGuardian / another device reflect immediately.
  useFocusEffect(
    useCallback(() => {
      // Force a fresh fetch every time this screen gains focus.
      // This is what makes a role change from EditGuardian show up
      // in the tree immediately when the user navigates back.
      const reload = async () => {
        await loadFamily();
        // Also re-derive activeCodes so the invite list is fresh.
        if (isPrimaryParent && currentBaby) {
          loadActiveCodes().catch(() => {});
        }
      };
      reload().catch(() => {});
      return () => {};
    }, [loadFamily, isPrimaryParent, currentBaby, loadActiveCodes]),
  );

  const loadActiveCodes = useCallback(async () => {
    if (!currentBaby) return;
    try {
      const codes = await getActiveInviteCodes();
      setActiveCodes((codes || []).filter((c: any) => c.status === 'active' || c.status === 'partial'));
    } catch (e) { console.error(e); }
  }, [currentBaby, getActiveInviteCodes]);

  useEffect(() => {
    if (isPrimaryParent && currentBaby) loadActiveCodes();
  }, [isPrimaryParent, currentBaby, loadActiveCodes]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFamily();
    if (isPrimaryParent && currentBaby) await loadActiveCodes();
    setIsRefreshing(false);
  }, [loadFamily, isPrimaryParent, currentBaby, loadActiveCodes]);

  /* ─── Handlers ──────────────────────────────────────────────────── */
  const handleUpdateMember = async () => {
    if (!selectedMember) return;
    if (!editForm.fullName.trim()) { sweetAlert.alert('Error', 'Name is required', 'warning'); return; }
    setIsLoading(true);
    let success = false;
    if (selectedMember.role === UserRole.PARENT_2) {
      success = await updateParent2Profile({ fullName: editForm.fullName, email: editForm.email, phoneNumber: editForm.phoneNumber, avatar: editForm.avatar });
    } else if (selectedMember.role === UserRole.PARENT_1) {
      try { await updateProfile({ fullName: editForm.fullName, email: editForm.email, phoneNumber: editForm.phoneNumber, avatar: editForm.avatar }); success = true; }
      catch { success = false; }
    } else {
      success = await updateGuardianProfile(selectedMember.id, {
        fullName: editForm.fullName, email: editForm.email, phoneNumber: editForm.phoneNumber,
        relationship: editForm.relationship, avatar: editForm.avatar, notificationsEnabled: editForm.notificationsEnabled,
      });
    }
    if (success) {
      triggerHaptic('success');
      setShowEditModal(false);
      sweetAlert.alert('Success', 'Member updated', 'success');
      // loadFamily() now returns a *fresh* array (see FamilyContext
      // refreshFamily change), so `members` and everything that
      // derives from it re-renders.
      await loadFamily();
    } else {
      triggerHaptic('error');
      sweetAlert.alert('Error', 'Failed to update member', 'warning');
    }
    setIsLoading(false);
  };

  const handleRemoveMember = () => {
    if (!selectedMember) return;
    // Self-removal guard — must match on userId (profile UUID), not
    // family_members.id, otherwise this guard silently passes and
    // the real check has to fire inside FamilyContext.removeMember.
    const memberUserId = (selectedMember as any).userId || selectedMember.id;
    if (memberUserId === currentUserId || selectedMember.id === currentUserId) {
      sweetAlert.alert('Cannot Remove', 'You cannot remove yourself', 'warning');
      return;
    }
    // Original Primary Parent protection. Only the original owner may
    // be removed by someone they themselves promoted — this is
    // enforced in `FamilyContext.removeMember` where the `addedBy`
    // graph is available. Do NOT block at the UI layer.
    sweetAlert.confirm('Remove Family Member', `Remove ${selectedMember.fullName}?`, () => {
      triggerHaptic('success');
      removeMember(selectedMember.id);
      setShowMemberModal(false);
    }, () => {}, 'Remove', 'Cancel', true);
  };

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { sweetAlert.alert('Permission Required', 'Allow photo access', 'warning'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(FAMILY_IMAGES_DIR);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(FAMILY_IMAGES_DIR, { intermediates: true });
        const permanentUri = `${FAMILY_IMAGES_DIR}${selectedMember?.id || 'member'}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setEditForm(prev => ({ ...prev, avatar: permanentUri }));
      } catch { sweetAlert.alert('Error', 'Failed to save photo', 'warning'); }
    }
  };

  const openMemberDetails = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditForm({
      fullName: member.fullName || '', email: member.email || '', phoneNumber: member.phoneNumber || '',
      relationship: member.relationship || '', avatar: member.avatar || '',
      notificationsEnabled: member.notificationsEnabled ?? true,
    });
    setShowMemberModal(true);
    triggerHaptic('light');
  };

  const handleRevokeCode = useCallback(async (code: string) => {
    sweetAlert.confirm('Revoke Invite', 'Revoke this invite code?', async () => {
      const success = await revokeInviteCode(code);
      if (success) { sweetAlert.toast('Revoked', 'Invite revoked', 'success'); loadActiveCodes(); }
      else sweetAlert.alert('Error', 'Failed to revoke', 'warning');
    }, () => {}, 'Revoke', 'Cancel', true);
  }, [revokeInviteCode, loadActiveCodes, sweetAlert]);

  const handleResendPartial = useCallback(async (code: string) => {
    try {
      const info = await getPartialSignupInfo(code);
      if (!info.exists) { sweetAlert.alert('Info', 'No partial signup found', 'info'); return; }
      let message = `📱 You started signing up for LittleLoom but didn't finish!\n\n🎫 Code: ${code}\n`;
      if (info.name) message += `👤 Name: ${info.name}\n`;
      if (info.email) message += `📧 Email: ${info.email}\n`;
      if (info.phone) message += `📱 Phone: ${info.phone}\n`;
      message += `\n🔗 Continue here: https://littleloom.app/join?code=${code}`;
      await Clipboard.setString(message);
      sweetAlert.alert('Copied', 'Invite message copied to clipboard', 'success');
      triggerHaptic('medium');
    } catch { sweetAlert.alert('Error', 'Could not process', 'warning'); }
  }, [getPartialSignupInfo, sweetAlert, triggerHaptic]);

  const handleLeaveFamily = () => {
    sweetAlert.confirm('Leave Family?', "You will lose access to this family's data unless re-invited.", () => {
      sweetAlert.toast('Left Family', 'You have been removed', 'info');
      navigation.goBack();
    }, undefined, 'Leave', 'Stay', true);
  };

  const handleTabChange = (tab: TabKey) => { setActiveTab(tab); HAPTIC_LIGHT(); };

  /* ─── Render helpers ────────────────────────────────────────────── */
  const renderMemberSection = (
    title: string,
    data: FamilyMember[],
    emptyText?: string,
  ) => {
    // De-dupe by `userId` (profile UUID) — this is stable across role
    // changes. `id` (family_members row id) can change if a member is
    // removed and re-invited, so the old check sometimes showed the
    // same person twice.
    const unique = data.filter(
      (m, i, arr) =>
        i === arr.findIndex((x) => (x.userId || x.id) === (m.userId || m.id)),
    );

    // ── EMPTY-STATE GATE ────────────────────────────────────────
    // Only show the "invite someone" CTA when the family is
    // COMPLETELY empty. If the family already has ANY members
    // (parent1 at minimum), the section renders silently with
    // nothing — no misleading "Invite member to start logging
    // entries" text under Co-Parent / Guardians while you're still
    // waiting for someone to accept that specific role.
    //
    // The exceptions are the "Primary Parent" section (which is
    // never empty after seeding) and explicit empty-state titles
    // passed by callers who WANT the CTA (e.g. the onboarding path).
    const familyHasAnyMembers = members.length > 0;
    const shouldShowEmpty =
      unique.length === 0 && !!emptyText && !familyHasAnyMembers;

    if (unique.length === 0 && !shouldShowEmpty) {
      return null;
    }

    return (
      <View style={{ marginBottom: DS.space.lg }}>
        <SectionHeader
          title={title}
          subtitle={`${unique.length} ${unique.length === 1 ? 'member' : 'members'}`}
          icon="people-outline"
        />
        {shouldShowEmpty ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? DS.darkCard : DS.white,
                borderColor: isDark ? DS.darkBorder : DS.gray200,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 },
              ]}
            >
              <Ionicons name="people-outline" size={32} color={isDark ? DS.gray500 : DS.gray400} />
            </View>
            <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {emptyText}
            </Text>
            {isPrimaryParent && title !== 'Primary Parent' && (
              <PressableScale
                onPress={() => navigation.navigate('CoParentInviteScreen')}
                activeScale={0.96}
              >
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>Add Member</Text>
                </LinearGradient>
              </PressableScale>
            )}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {unique.map((member, index) => (
              <MemberCard
                key={`${member.id}_${member.role}_${index}`}
                member={member}
                isCurrentUser={
                  member.id === currentUserId ||
                  (member as any).userId === currentUserId
                }
                onPress={() => openMemberDetails(member)}
                index={index}
                isDark={isDark}
                currentUserId={currentUserId}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  /* ─── Tabs ──────────────────────────────────────────────────────── */
  const tabs = [
    { key: 'tree' as TabKey, label: 'Tree', icon: 'git-network-outline' as const },
    { key: 'members' as TabKey, label: 'Members', icon: 'people-outline' as const },
    { key: 'activity' as TabKey, label: 'Activity', icon: 'pulse-outline' as const },
    { key: 'access' as TabKey, label: 'Access', icon: 'shield-checkmark-outline' as const },
    { key: 'settings' as TabKey, label: 'Settings', icon: 'settings-outline' as const },
  ];

  const topRibbon = useMemo(() => {
    if (pendingCount > 0) return { icon: 'time-outline' as const, color: DS.warning, label: 'Pending', text: `${pendingCount} invitation${pendingCount > 1 ? 's' : ''} awaiting acceptance`, onPress: () => setActiveTab('members') };
    if (activeCount > 0) return { icon: 'pulse-outline' as const, color: DS.success, label: 'Active', text: `${activeCount} member${activeCount > 1 ? 's' : ''} active today`, onPress: () => setActiveTab('access') };
    return { icon: 'person-add-outline' as const, color: DS.primary, label: 'Grow', text: 'Invite family to share the journey', onPress: () => navigation.navigate('CoParentInviteScreen') };
  }, [pendingCount, activeCount, navigation]);

  if (isLoading && members.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? ['#0c0a09', '#12121e'] : ['#f8faff', '#eef0f5']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={DS.primary} />
        <Text style={{ marginTop: 12, color: isDark ? DS.gray400 : DS.gray500 }}>Loading family...</Text>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ⚠️ KEY FIX: Use Animated.ScrollView from reanimated via createAnimatedComponent
  //    — reanimated exports Animated.ScrollView only in v3+ via `Animated.ScrollView`
  //    If your reanimated version doesn't have it, we fall back to a wrapped version.
  // ═══════════════════════════════════════════════════════════════════
  const AnimatedScrollView = Animated.ScrollView as React.ComponentType<any>;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky header */}
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>FAMILY</GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {isPrimaryParent ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('CoParentInviteScreen')}
              style={[styles.headerIconBtn, { backgroundColor: DS.primary }]}
            >
              <Ionicons name="person-add" size={18} color={DS.white} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>
      </Animated.View>

      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOP_PADDING + 8, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
      >
        <PulseHeader
          isDark={isDark}
          currentBaby={currentBaby}
          members={members}
          currentUserId={currentUserId}
          activeCount={activeCount}
          pendingCount={pendingCount}
          unreadChat={unreadChat}
          isPrimaryParent={isPrimaryParent}
          onBack={() => navigation.goBack()}
          onBabyPress={() => {
            if (babies && babies.length > 1) navigation.navigate('SwitchBaby', { returnTo: 'FamilySharing', returnLabel: 'Family' });
            else navigation.navigate('CreateBabyProfile');
          }}
          onInvite={() => navigation.navigate('CoParentInviteScreen')}
          onChat={() => navigation.navigate('FamilyChatList')}
        />

        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} />
        </View>

        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {activeTab === 'members' && (
          <View style={{ paddingTop: DS.space.md }}>
            <FamilyHealthCard members={members} isDark={isDark} />

            <View style={{ marginTop: DS.space.md }}>
              <DailyGoals goals={dailyGoals} isDark={isDark} onPress={() => {}} />
            </View>

            {/* ── DIRECT ADD QUICK ACTION ──────────────────────────────
                The fourth path, surfaced as a quick action. Lets a parent
                add an existing LittleLoom user by identifier without
                going through the invite flow. */}
            {isPrimaryParent && (
              <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
                <PressableScale
                  onPress={() => {
                    HAPTIC_LIGHT();
                    navigation.navigate(
                      'CoParentInviteScreen' as never,
                      { initialMode: 'direct' } as never,
                    );
                  }}
                  activeScale={0.97}
                >
                  <LinearGradient
                    colors={[DS.success, '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: DS.radius.md,
                      ...DS.shadow.md,
                    }}
                  >
                    <Ionicons name="person-add" size={18} color={DS.white} />
                    <Text style={{ color: DS.white, fontSize: 14, fontWeight: '700' }}>
                      Add Someone You Know
                    </Text>
                  </LinearGradient>
                </PressableScale>
                <Text style={{ fontSize: 10, color: isDark ? DS.gray500 : DS.gray400, textAlign: 'center', marginTop: 6, fontWeight: '500' }}>
                  Add an existing LittleLoom user by @username, email, or phone
                </Text>
              </View>
            )}

            <View style={{ marginTop: DS.space.lg, paddingHorizontal: DS.space.lg }}>
              {renderMemberSection(
                'Primary Parent',
                members.filter((m) => normalizeRole((m as any).role) === UserRole.PARENT_1),
              )}
              {renderMemberSection(
                'Co-Parent',
                members.filter((m) => normalizeRole((m as any).role) === UserRole.PARENT_2),
                members.length === 0 ? 'Invite a co-parent to share tracking' : undefined,
              )}
              {renderMemberSection(
                'Guardians & Viewers',
                members.filter((m) => {
                  const r = normalizeRole((m as any).role);
                  return r === UserRole.GUARDIAN || r === UserRole.VIEWER;
                }),
                members.length === 0 ? 'Invite a guardian to help out' : undefined,
              )}

              {isPrimaryParent && activeCodes.length > 0 && (
                <View style={{ marginBottom: DS.space.lg }}>
                  <SectionHeader
                    title="Pending Invites"
                    subtitle={`${activeCodes.filter(c => c.status === 'active').length} active · ${activeCodes.filter(c => c.status === 'partial').length} partial`}
                    icon="key-outline"
                    color={DS.warning}
                    action={loadActiveCodes}
                    actionLabel="Refresh"
                  />
                  <View style={{ gap: 8 }}>
                    {activeCodes.map((code, i) => {
                      const sc = STATUS_CONFIG[code.status] || STATUS_CONFIG.active;
                      const isPartial = code.status === 'partial';
                      return (
                        <Animated.View
                          key={code.code + i}
                          entering={FadeInUp.delay(i * 60).springify()}
                          style={[styles.inviteCard, {
                            backgroundColor: isDark ? DS.darkCard : DS.white,
                            borderColor: isPartial ? `${DS.warning}40` : isDark ? DS.darkBorder : DS.gray200,
                          }]}
                        >
                          <View style={[styles.inviteIcon, { backgroundColor: isPartial ? `${DS.warning}15` : `${DS.primary}15` }]}>
                            <Ionicons name="key-outline" size={20} color={isPartial ? DS.warning : DS.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.inviteCode, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{code.code}</Text>
                              <View style={[styles.inviteStatus, { backgroundColor: `${sc.color}15` }]}>
                                <Ionicons name={sc.icon} size={10} color={sc.color} />
                                <Text style={[styles.inviteStatusText, { color: sc.color }]}>{sc.label}</Text>
                              </View>
                            </View>
                            {code.used_by_name && <Text style={[styles.inviteMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>👤 {code.used_by_name}</Text>}
                            {code.used_by_email && <Text style={[styles.inviteMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>✉️ {code.used_by_email}</Text>}
                            {isPartial && <Text style={[styles.inviteMeta, { color: DS.warning }]}>⚠️ Didn't finish registration</Text>}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {isPartial && (
                              <PressableScale onPress={() => handleResendPartial(code.code)} activeScale={0.9}>
                                <View style={[styles.inviteAction, { backgroundColor: `${DS.warning}15` }]}>
                                  <Ionicons name="refresh-outline" size={16} color={DS.warning} />
                                </View>
                              </PressableScale>
                            )}
                            {code.status === 'active' && (
                              <PressableScale onPress={() => handleRevokeCode(code.code)} activeScale={0.9}>
                                <View style={[styles.inviteAction, { backgroundColor: `${DS.danger}15` }]}>
                                  <Ionicons name="close" size={16} color={DS.danger} />
                                </View>
                              </PressableScale>
                            )}
                          </View>
                        </Animated.View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'tree' && (
          <View style={{ paddingTop: DS.space.md }}>
            <FamilyTree
              members={members}
              currentBaby={currentBaby}
              isDark={isDark}
              onManage={() => setActiveTab('members')}
              onMemberPress={(m) => {
                const targetId = (m as any).userId || m.id;
                if (targetId) {
                  navigation.navigate('EditGuardian', {
                    guardianId: targetId,
                    mode: 'guardian',
                    fromChat: false,
                  } as never);
                } else {
                  setActiveTab('members');
                }
              }}
              onAddCoParent={() => navigation.navigate('CoParentInviteScreen')}
              onAddGuardian={() => navigation.navigate('CoParentInviteScreen')}
            />
          </View>
        )}

        {activeTab === 'activity' && (
          <ActivityTimeline events={timelineEvents} isDark={isDark} />
        )}

        {activeTab === 'access' && (
          <View style={{ paddingHorizontal: DS.space.lg }}>
            <AccessTab
              members={members}
              isDark={isDark}
              canManage={isPrimaryParent}
              currentUserId={currentUserId}
              onMemberPress={openMemberDetails}
            />
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={{ paddingHorizontal: DS.space.lg }}>
            <SettingsTab
              isDark={isDark}
              isPrimaryParent={isPrimaryParent}
              familyCount={familyCount}
              hasCoParent={hasCoParent}
              guardianCount={guardians?.length || 0}
              unreadCount={unreadChat}
              onOpenMembers={() => setActiveTab('members')}
              onOpenAccess={() => setActiveTab('access')}
              onOpenFamilyChat={() => navigation.navigate('FamilyChatList')}
              onOpenInvite={() => navigation.navigate('CoParentInviteScreen')}
              onOpenBackup={() => navigation.navigate('BackupRestore')}
              onOpenReminders={() => navigation.navigate('TrackerReminders')}
              onLeaveFamily={handleLeaveFamily}
              onTransferOwnership={() => {
                // Open a picker of eligible targets (all non-parent1 members
                // with a userId set — pending invites can't take ownership).
                const candidates = members.filter(
                  (m) =>
                    m.role !== UserRole.PARENT_1 &&
                    ((m as any).userId || m.id) !== currentUserId &&
                    !!m.lastActive, // must have actually accepted
                );
                if (candidates.length === 0) {
                  sweetAlert.alert(
                    'No Eligible Members',
                    'Invite at least one other parent/guardian first.',
                    'warning',
                  );
                  return;
                }
                const labels = candidates.map(
                  (m) => `${m.fullName} (${getMemberDisplayLabel({ role: m.role, relationship: m.relationship })})`,
                );
                sweetAlert.confirm(
                  'Transfer Ownership',
                  `Who should become Primary Parent?\n\n${labels.join('\n')}`,
                  async () => {
                    // Sequential: try each candidate — the sweetAlert
                    // doesn't render a native picker. For simplicity we
                    // pick the first; the caller can re-run for another.
                    const chosen = candidates[0];
                    const res = await transferOwnership(chosen.id);
                    if (res.success) {
                      sweetAlert.success('Ownership Transferred', res.message);
                      await loadFamily();
                    } else {
                      sweetAlert.error('Transfer Failed', res.message);
                    }
                  },
                  () => {},
                  'Transfer',
                  'Cancel',
                  true,
                );
              }}
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </AnimatedScrollView>

      {/* MEMBER DETAIL MODAL */}
      <ActionModal
        visible={showMemberModal}
        onClose={() => { setShowMemberModal(false); setSelectedMember(null); }}
        title={selectedMember?.fullName || 'Member Details'}
        isDark={isDark}
      >
        {selectedMember && (
          <View style={{ gap: DS.space.lg }}>
            <View style={{ alignItems: 'center', gap: DS.space.md }}>
              <SafeAvatar
                avatar={selectedMember.avatar}
                size={96}
                fallbackIcon={selectedMember.role === UserRole.PARENT_1 ? 'shield' : 'person'}
                fallbackColor={ROLE_CONFIG[selectedMember.role].color}
              />
              <LinearGradient colors={ROLE_CONFIG[selectedMember.role].gradient} style={styles.modalRoleBadge}>
                <Ionicons name={ROLE_CONFIG[selectedMember.role].icon} size={13} color={DS.white} />
                <Text style={styles.modalRoleText}>
                  {getMemberDisplayLabel({
                    role: selectedMember.role,
                    relationship: selectedMember.relationship,
                  })}
                </Text>
              </LinearGradient>
            </View>

            <View style={{ gap: 10 }}>
              {selectedMember.email && (
                <View style={[styles.detailRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <Ionicons name="mail" size={18} color={DS.primary} />
                  <Text style={[styles.detailText, { color: isDark ? DS.white : DS.gray900 }]}>{selectedMember.email}</Text>
                </View>
              )}
              {selectedMember.phoneNumber && (
                <View style={[styles.detailRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                  <Ionicons name="call" size={18} color={DS.success} />
                  <Text style={[styles.detailText, { color: isDark ? DS.white : DS.gray900 }]}>{selectedMember.phoneNumber}</Text>
                </View>
              )}
              <View style={[styles.detailRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Ionicons name="people" size={18} color={DS.warning} />
                <Text style={[styles.detailText, { color: isDark ? DS.white : DS.gray900 }]}>
                  {getMemberDisplayLabel({
                    role: selectedMember.role,
                    relationship: selectedMember.relationship,
                  })}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              {selectedMember.id !== currentUserId && selectedMember.status !== 'pending' && (
                <PressableScale onPress={() => {
                  setShowMemberModal(false);
                  navigation.navigate('FamilyChat', {
                    memberId: selectedMember.id,
                    memberName: selectedMember.fullName,
                    memberAvatar: selectedMember.avatar,
                    memberRole: selectedMember.role,
                  });
                }} activeScale={0.97}>
                  <LinearGradient colors={ROLE_CONFIG[selectedMember.role].gradient} style={styles.modalPrimaryBtn}>
                    <Ionicons name="chatbubble" size={18} color={DS.white} />
                    <Text style={styles.modalPrimaryBtnText}>Send Message</Text>
                  </LinearGradient>
                </PressableScale>
              )}

              {isPrimaryParent && selectedMember.role !== UserRole.PARENT_1 && (
                <>
                  <PressableScale onPress={() => { setShowMemberModal(false); setShowEditModal(true); }} activeScale={0.97}>
                    <View style={[styles.modalSecondaryBtn, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <Ionicons name="create" size={18} color={DS.primary} />
                      <Text style={[styles.modalSecondaryText, { color: DS.primary }]}>Edit Profile</Text>
                    </View>
                  </PressableScale>

                  <PressableScale onPress={() => {
                    if (!selectedMember?.email) { sweetAlert.alert('No Email', 'No email on file', 'warning'); return; }
                    sweetAlert.confirm('Reset Password', `Reset password for ${selectedMember.fullName}?`, async () => {
                      const r = await resetPasswordForUser(selectedMember.email, 'littleloom_temp_2026');
                      if (r.success) sweetAlert.alert('Password Reset', 'Temporary password set.', 'success');
                      else sweetAlert.alert('Error', r.message, 'warning');
                    }, () => {}, 'Reset', 'Cancel', true);
                  }} activeScale={0.97}>
                    <View style={[styles.modalSecondaryBtn, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                      <Ionicons name="key" size={18} color={DS.warning} />
                      <Text style={[styles.modalSecondaryText, { color: DS.warning }]}>Reset Password</Text>
                    </View>
                  </PressableScale>

                  <PressableScale onPress={handleRemoveMember} activeScale={0.97}>
                    <View style={[styles.modalDangerBtn, { borderColor: `${DS.danger}40` }]}>
                      <Ionicons name="trash" size={18} color={DS.danger} />
                      <Text style={[styles.modalDangerText, { color: DS.danger }]}>Remove Member</Text>
                    </View>
                  </PressableScale>
                </>
              )}
            </View>
          </View>
        )}
      </ActionModal>

      {/* EDIT MEMBER MODAL */}
      <ActionModal visible={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Member" isDark={isDark}>
        <View style={{ gap: DS.space.lg }}>
          <TouchableOpacity style={{ alignSelf: 'center', position: 'relative' }} onPress={handleImagePick}>
            <SafeAvatar avatar={editForm.avatar} size={96} fallbackIcon="camera" fallbackColor={DS.primary} />
            <View style={[styles.avatarEditBadge, { backgroundColor: DS.primary, borderColor: isDark ? DS.darkCard : DS.white }]}>
              <Ionicons name="camera" size={16} color={DS.white} />
            </View>
          </TouchableOpacity>

          {[
            { label: 'Full Name', key: 'fullName' as const, placeholder: 'Enter full name' },
            { label: 'Email', key: 'email' as const, placeholder: 'Enter email', keyboard: 'email-address' as const },
            { label: 'Phone', key: 'phoneNumber' as const, placeholder: 'Enter phone', keyboard: 'phone-pad' as const },
            { label: 'Relationship', key: 'relationship' as const, placeholder: 'e.g., Grandma, Nanny' },
          ].map(({ label, key, placeholder, keyboard }) => (
            <View key={key}>
              <Text style={[styles.formLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{label}</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100, color: isDark ? DS.white : DS.gray900 }]}
                value={(editForm as any)[key]}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, [key]: text }))}
                placeholder={placeholder}
                placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                keyboardType={keyboard}
                autoCapitalize={key === 'email' ? 'none' : 'words'}
              />
            </View>
          ))}

          <View style={[styles.toggleRow, { borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name={editForm.notificationsEnabled ? 'notifications' : 'notifications-off'} size={20} color={editForm.notificationsEnabled ? DS.primary : (isDark ? DS.gray500 : DS.gray400)} />
              <View style={{ marginLeft: DS.space.md }}>
                <Text style={[styles.formLabel, { color: isDark ? DS.white : DS.gray900, marginBottom: 2 }]}>Notifications</Text>
                <Text style={[styles.setSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Receive family activity alerts</Text>
              </View>
            </View>
            <Switch
              value={editForm.notificationsEnabled}
              onValueChange={(v) => setEditForm(prev => ({ ...prev, notificationsEnabled: v }))}
              trackColor={{ false: isDark ? '#333' : DS.gray300, true: `${DS.primary}60` }}
              thumbColor={editForm.notificationsEnabled ? DS.primary : (isDark ? '#555' : '#f4f3f4')}
            />
          </View>

          <PressableScale onPress={handleUpdateMember} disabled={isLoading} activeScale={0.97}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.saveBtn}>
              {isLoading ? <ActivityIndicator color={DS.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </LinearGradient>
          </PressableScale>
        </View>
      </ActionModal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

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

  pulseWrap: {
    marginHorizontal: DS.space.lg, marginTop: DS.space.md,
    borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden',
    borderWidth: 1, ...DS.shadow.md, position: 'relative',
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  pulseLivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pulseLiveText: { fontSize: 10, fontWeight: '700' },
  pulseSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pulseBabyName: { fontSize: 13, fontWeight: '600' },
  pulseIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: DS.white, paddingHorizontal: 3 },
  pulseBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseStats: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.lg, marginTop: DS.space.md, gap: DS.space.sm },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatarStackItem: { borderRadius: 14, borderWidth: 2, overflow: 'hidden', position: 'relative' },
  avatarYouDot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  avatarExtra: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarExtraText: { fontSize: 10, fontWeight: '800' },
  pulseStatDiv: { width: 1, height: 18 },
  pulseStat: { alignItems: 'center' },
  pulseStatVal: { fontSize: 14, fontWeight: '800' },
  pulseStatLbl: { fontSize: 9, fontWeight: '600', marginTop: 1 },

  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: DS.space.md,
    paddingVertical: DS.space.md, paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm,
  },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  card: {
    marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg,
    padding: DS.space.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm,
  },

  healthRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  healthRingFill: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent' },
  healthRingInner: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  healthRingValue: { fontSize: 20, fontWeight: '800' },
  healthRingMax: { fontSize: 9, fontWeight: '600' },
  healthTitle: { fontSize: 15, fontWeight: '800' },
  healthLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  healthStatsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  healthStat: { alignItems: 'center' },
  healthStatVal: { fontSize: 14, fontWeight: '800' },
  healthStatLbl: { fontSize: 9, fontWeight: '600' },

  goalCard: { width: 132, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  goalTitle: { fontSize: 11, fontWeight: '700', marginTop: 4, marginBottom: 2 },
  goalVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  goalTotal: { fontSize: 11, fontWeight: '600' },
  goalBarBg: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  goalBarFill: { height: '100%', borderRadius: 2 },
  goalUnit: { fontSize: 9, fontWeight: '500', marginTop: 4 },

  memberCard: { borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  memberStrip: { height: 3, width: '100%' },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: DS.space.md },
  memberYouDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  memberOnlineDot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: DS.success, borderWidth: 2 },
  memberName: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  memberMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { color: DS.white, fontSize: 8, fontWeight: '800' },
  memberRelationship: { fontSize: 11, fontWeight: '500', flexShrink: 1 },
  memberActiveText: { fontSize: 10, fontWeight: '500', marginTop: 3 },
  youBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  youBadgeText: { fontSize: 9, fontWeight: '800' },
  pendingInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  pendingInlineText: { fontSize: 10, fontWeight: '600' },

  emptyCard: { alignItems: 'center', paddingVertical: DS.space['2xl'], marginHorizontal: 0, borderRadius: DS.radius.lg, borderWidth: 1 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center', paddingHorizontal: DS.space.lg },
  emptyBtn: { marginTop: DS.space.md, paddingHorizontal: DS.space.lg, paddingVertical: 8, borderRadius: 10 },
  emptyBtnText: { color: DS.white, fontSize: 12, fontWeight: '700' },

  timelineRow: { flexDirection: 'row', gap: DS.space.sm, marginBottom: DS.space.md },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  timelineLine: { position: 'absolute', top: 0, bottom: -DS.space.md, width: 2, left: 11 },
  timelineCard: { flex: 1, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1 },
  timelineTitle: { fontSize: 13, fontWeight: '700' },
  timelineMeta: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: DS.radius.md, borderWidth: 1 },
  readOnlyText: { fontSize: 11, fontWeight: '600', flex: 1 },
  permCard: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, gap: 8 },
  permName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  permRolePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  permRoleText: { fontSize: 10, fontWeight: '700' },
  permMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  permMetaText: { fontSize: 10, fontWeight: '500' },
  permPendingPill: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  permPendingText: { fontSize: 9, fontWeight: '700' },
  permChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  permChipText: { fontSize: 10, fontWeight: '600' },
  permFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: DS.space.sm },
  permFooterText: { fontSize: 11, fontWeight: '500', flex: 1, lineHeight: 16 },

  summaryCard: { padding: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryVal: { fontSize: 22, fontWeight: '800' },
  summaryLbl: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  summaryDiv: { width: 1, height: 32 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1 },
  setIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  setTitle: { fontSize: 14, fontWeight: '700' },
  setSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  setBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  setBadgeText: { color: DS.white, fontSize: 10, fontWeight: '800' },

  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1 },
  inviteIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  inviteCode: { fontSize: 13, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  inviteStatus: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  inviteStatusText: { fontSize: 9, fontWeight: '700' },
  inviteMeta: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  inviteAction: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, maxHeight: '85%', borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: DS.space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)' },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalRoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  modalRoleText: { color: DS.white, fontSize: 12, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  detailText: { flex: 1, fontSize: 14, fontWeight: '600' },
  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: DS.radius.md },
  modalPrimaryBtnText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  modalSecondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: DS.radius.md, borderWidth: 1 },
  modalSecondaryText: { fontSize: 14, fontWeight: '700' },
  modalDangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: DS.radius.md, borderWidth: 1 },
  modalDangerText: { fontSize: 14, fontWeight: '700' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  formLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  formInput: { fontSize: 15, fontWeight: '500', paddingVertical: 12, paddingHorizontal: 14, borderRadius: DS.radius.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  saveBtn: { paddingVertical: 15, borderRadius: DS.radius.md, alignItems: 'center' },
  saveBtnText: { color: DS.white, fontSize: 15, fontWeight: '700' },
});