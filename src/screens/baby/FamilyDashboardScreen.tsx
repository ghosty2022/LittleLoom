import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  InteractionManager,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { differenceInMonths, format, formatDistanceToNow } from 'date-fns';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useFamily } from '../../context/FamilyContext';
import { useUser } from '../../context/UserContext';
import { UserRole } from '../../types/roles';
import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../hooks/useTrackerContext';
import OptimizedImage from '../../components/OptimizedImage';

const AnimatedScrollView = Animated.ScrollView;
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

type FamilyDashboardScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura (aligned with Home / Community / More / Timeline / Hub)
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

const HAPTIC_LIGHT = () => {
  try {
    const Haptics = require('expo-haptics');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
};
const HAPTIC_MEDIUM = () => {
  try {
    const Haptics = require('expo-haptics');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════════════════
   ROLE CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
const ROLE_CONFIG: Record<UserRole, {
  label: string; color: string; gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap; badge: string;
}> = {
  [UserRole.PARENT_1]: { label: 'Primary Parent', color: '#667eea', gradient: ['#667eea', '#764ba2'], icon: 'shield', badge: 'Owner' },
  [UserRole.PARENT_2]: { label: 'Co-Parent', color: '#fa709a', gradient: ['#fa709a', '#f5576c'], icon: 'heart', badge: 'Co-Parent' },
  [UserRole.GUARDIAN]: { label: 'Guardian', color: '#11998e', gradient: ['#11998e', '#38ef7d'], icon: 'shield-checkmark', badge: 'Guardian' },
  [UserRole.VIEWER]: { label: 'Viewer', color: '#64748b', gradient: ['#64748b', '#94a3b8'], icon: 'eye', badge: 'Viewer' },
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
   SAFE AVATAR
   ═══════════════════════════════════════════════════════════════════════════ */
const SafeAvatar = memo<{
  avatar?: string | null; gender?: string; size?: number;
  showEditButton?: boolean; onEdit?: () => void;
  fallbackIcon?: keyof typeof Ionicons.glyphMap; fallbackColor?: string;
}>(({ avatar, gender = 'other', size = 56, showEditButton, onEdit, fallbackIcon, fallbackColor }) => {
  const [imageError, setImageError] = useState(false);
  const hasImage = isImageUri(avatar) && !imageError;
  const hasEmoji = isEmoji(avatar);
  const gradientColors = gender === 'boy' ? ['#667eea', '#764ba2']
    : gender === 'girl' ? ['#fa709a', '#fee140'] : ['#11998e', '#38ef7d'];
  const iconName = fallbackIcon || (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'person');
  const color = fallbackColor || (gender === 'boy' ? '#667eea' : gender === 'girl' ? '#fa709a' : '#11998e');

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <LinearGradient
        colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : gradientColors}
        style={{ width: size, height: size, borderRadius: size / 2.8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        {hasImage && avatar ? (
          <OptimizedImage
            source={{ uri: avatar }}
            style={{ width: size, height: size }}
            contentFit="cover"
            cachePolicy="memory-disk"
            onError={() => setImageError(true)}
            transition={200}
          />
        ) : hasEmoji ? (
          <Text style={{ fontSize: size * 0.5 }}>{avatar}</Text>
        ) : (
          <Ionicons name={iconName as any} size={size * 0.4} color={color} />
        )}
      </LinearGradient>
      {showEditButton && onEdit && (
        <TouchableOpacity
          style={{ position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' }}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#667eea', '#764ba2']} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="camera" size={14} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
});

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
   PULSE HEADER — Brilliant, modern, swift (NO heavy hero card)
   Compact glass capsule: animated baby avatar + live family counts + actions
   ═══════════════════════════════════════════════════════════════════════════ */
interface PulseHeaderProps {
  isDark: boolean;
  currentBaby: any;
  babies: any[];
  members: any[];
  todayCount: number;
  streak: number;
  onBack: () => void;
  onBabyPress: () => void;
  onAddPress: () => void;
  onFamilyPress: () => void;
}

const PulseHeader = React.memo<PulseHeaderProps>(({
  isDark, currentBaby, babies, members, todayCount, streak,
  onBack, onBabyPress, onAddPress, onFamilyPress,
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

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)', 'rgba(139,92,246,0.06)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
          <PressableScale onPress={onBabyPress} activeScale={0.94}>
            <View style={styles.pulseAvatarWrap}>
              <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
              <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
                <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                {currentBaby ? (
                  <SafeAvatar avatar={currentBaby.avatar} gender={currentBaby.gender} size={46} />
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
                <Text style={[styles.pulseLiveText, { color: DS.success }]}>{members.length} here</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onBabyPress} activeOpacity={0.7} style={styles.pulseSubRow}>
              <Text style={[styles.pulseBabyName, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>
                {currentBaby?.name || 'Add a baby profile'}
              </Text>
              {babies.length > 1 && <Ionicons name="chevron-down" size={12} color={isDark ? DS.gray500 : DS.gray400} />}
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onFamilyPress} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${DS.primary}12` }]}>
                <Ionicons name="people-outline" size={18} color={DS.primary} />
              </View>
            </PressableScale>
            <PressableScale onPress={onAddPress} activeScale={0.9} haptic="medium">
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add" size={22} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        {/* Avatar stack + stats strip */}
        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.avatarStack}>
            {avatarStack.map((m, i) => (
              <View key={m.id + i} style={[styles.avatarStackItem, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i, borderColor: isDark ? DS.darkCard : DS.white }]}>
                <SafeAvatar avatar={m.avatar} size={28} />
              </View>
            ))}
            {extra > 0 && (
              <View style={[styles.avatarExtra, { marginLeft: -10, backgroundColor: isDark ? DS.darkSurface : DS.gray100, borderColor: isDark ? DS.darkCard : DS.white }]}>
                <Text style={[styles.avatarExtraText, { color: isDark ? DS.gray300 : DS.gray600 }]}>+{extra}</Text>
              </View>
            )}
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{todayCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>today</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{streak}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>streak</Text>
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
  tabs: { key: 'overview' | 'growth'; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: 'overview' | 'growth';
  onChange: (t: 'overview' | 'growth') => void;
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
   FAMILY STATS STRIP
   ═══════════════════════════════════════════════════════════════════════════ */
const FamilyStatsStrip = React.memo(({ members, babies, activities, milestones, isDark }: {
  members: number; babies: number; activities: number; milestones: number; isDark: boolean;
}) => (
  <Animated.View entering={FadeInUp.delay(60).springify()}>
    <View style={[styles.statsStrip, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <LinearGradient colors={[`${DS.primary}10`, `${DS.accent}06`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      {[
        { value: members, label: 'Members', color: DS.primary },
        { value: babies, label: 'Babies', color: DS.accent },
        { value: activities, label: 'Activities', color: DS.success },
        { value: milestones, label: 'Wins', color: DS.warning },
      ].map((stat, i) => (
        <React.Fragment key={stat.label}>
          {i > 0 && <View style={[styles.statsDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
          <View style={styles.statsItem}>
            <Text style={[styles.statsVal, { color: stat.color }]}>{stat.value}</Text>
            <Text style={[styles.statsLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>{stat.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   TODAY AT A GLANCE
   ═══════════════════════════════════════════════════════════════════════════ */
interface TodayGlanceStat {
  key: string; icon: string; label: string; count: number; color: string;
}

const TodayAtGlance = React.memo(({ stats, isDark, onPress }: {
  stats: TodayGlanceStat[]; isDark: boolean; onPress: (key: string) => void;
}) => {
  if (!stats.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Today at a Glance" subtitle={format(new Date(), 'EEEE, MMM d')} icon="today-outline" color={DS.info} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {stats.map((stat) => (
          <PressableScale key={stat.key} onPress={() => onPress(stat.key)} activeScale={0.94}>
            <View style={[styles.glanceCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : `${stat.color}30` }]}>
              <LinearGradient colors={[`${stat.color}10`, `${stat.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.glanceIconBg, { backgroundColor: `${stat.color}18` }]}>
                <Text style={styles.glanceIcon}>{stat.icon}</Text>
              </View>
              <Text style={[styles.glanceCount, { color: stat.color }]}>{stat.count}</Text>
              <Text style={[styles.glanceLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{stat.label}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SUGGESTION OF THE DAY
   ═══════════════════════════════════════════════════════════════════════════ */
const SuggestionCard = React.memo(({ isDark, suggestion, onAction }: {
  isDark: boolean;
  suggestion: { icon: string; title: string; description: string; color: string; actionLabel: string } | null;
  onAction: () => void;
}) => {
  if (!suggestion) return null;
  return (
    <Animated.View entering={FadeInUp.delay(140).springify()}>
      <View style={[styles.suggestionCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={[`${suggestion.color}10`, `${suggestion.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.suggestionRow}>
          <LinearGradient colors={[suggestion.color, suggestion.color + 'AA']} style={styles.suggestionIconBg}>
            <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.suggestionKicker, { color: suggestion.color }]}>SUGGESTION OF THE DAY</Text>
            <Text style={[styles.suggestionTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={2}>{suggestion.title}</Text>
            <Text style={[styles.suggestionDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{suggestion.description}</Text>
          </View>
        </View>
        <PressableScale onPress={onAction} activeScale={0.96}>
          <View style={[styles.suggestionActionBtn, { backgroundColor: `${suggestion.color}15` }]}>
            <Text style={[styles.suggestionActionText, { color: suggestion.color }]}>{suggestion.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={suggestion.color} />
          </View>
        </PressableScale>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVE TODAY
   ═══════════════════════════════════════════════════════════════════════════ */
interface TodayContributor { id: string; name: string; avatar?: string; count: number; }

const ActiveToday = React.memo(({ contributors, isDark, onSeeAll }: {
  contributors: TodayContributor[]; isDark: boolean; onSeeAll: () => void;
}) => {
  if (!contributors.length) return null;
  return (
    <Animated.View entering={FadeInUp.delay(180).springify()}>
      <SectionHeader title="Active Today" subtitle={`${contributors.length} contributor${contributors.length !== 1 ? 's' : ''}`} icon="pulse-outline" color={DS.success} action={onSeeAll} actionLabel="Timeline" />
      <View style={[styles.contribCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        {contributors.map((c, i) => (
          <View key={c.id} style={[styles.contribRow, i > 0 && { borderTopWidth: 1, borderTopColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <SafeAvatar avatar={c.avatar} size={32} />
            <Text style={[styles.contribName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{c.name}</Text>
            <View style={[styles.contribBadge, { backgroundColor: `${DS.primary}15` }]}>
              <Text style={[styles.contribBadgeText, { color: DS.primary }]}>{c.count} {c.count === 1 ? 'entry' : 'entries'}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   BABY CARD — compact info card (replaces hero card)
   ═══════════════════════════════════════════════════════════════════════════ */
const BabyCard = React.memo(({ isDark, baby, streak, onEdit, onGrowth }: {
  isDark: boolean; baby: any; streak: number; onEdit: () => void; onGrowth: () => void;
}) => {
  if (!baby) return null;
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <View style={[styles.babyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={[`${DS.accent}08`, `${DS.primary}04`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.babyRow}>
          <SafeAvatar avatar={baby.avatar} gender={baby.gender} size={56} showEditButton onEdit={onEdit} />
          <View style={{ flex: 1, marginLeft: DS.space.md }}>
            <Text style={[styles.babyName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{baby.name}</Text>
            <Text style={[styles.babyMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {baby.age} • {baby.gender}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {streak > 0 && (
                <View style={[styles.babyTag, { backgroundColor: `${DS.accent}15` }]}>
                  <Ionicons name="flame" size={10} color={DS.accent} />
                  <Text style={[styles.babyTagText, { color: DS.accent }]}>{streak}d streak</Text>
                </View>
              )}
              <PressableScale onPress={onGrowth} activeScale={0.94}>
                <View style={[styles.babyTag, { backgroundColor: `${DS.success}15` }]}>
                  <Ionicons name="trending-up" size={10} color={DS.success} />
                  <Text style={[styles.babyTagText, { color: DS.success }]}>Growth</Text>
                </View>
              </PressableScale>
            </View>
          </View>
          <PressableScale onPress={onEdit} activeScale={0.9}>
            <View style={[styles.babyEditBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="create-outline" size={18} color={DS.primary} />
            </View>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY STACK
   ═══════════════════════════════════════════════════════════════════════════ */
const FamilyStack = React.memo(({ members, isDark, onPress }: {
  members: any[]; isDark: boolean; onPress: () => void;
}) => (
  <Animated.View entering={FadeInUp.delay(260).springify()}>
    <SectionHeader title="Your Family" subtitle={`${members.length} member${members.length !== 1 ? 's' : ''}`} icon="people-outline" color={DS.primary} action={onPress} actionLabel="Manage" />
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.familyStackCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={styles.familyStackRow}>
          {members.slice(0, 5).map((m, i) => {
            const roleCfg = ROLE_CONFIG[m.role] || ROLE_CONFIG[UserRole.VIEWER];
            return (
              <View key={m.id + i} style={[styles.stackAvatar, { marginLeft: i > 0 ? -12 : 0, zIndex: 10 - i, borderColor: isDark ? DS.darkCard : DS.white }]}>
                <SafeAvatar avatar={m.avatar} size={44} fallbackColor={roleCfg.color} />
              </View>
            );
          })}
          {members.length > 5 && (
            <View style={[styles.stackAvatarMore, { marginLeft: -12, backgroundColor: isDark ? DS.darkSurface : DS.gray100, borderColor: isDark ? DS.darkCard : DS.white }]}>
              <Text style={[styles.stackAvatarMoreText, { color: isDark ? DS.gray300 : DS.gray600 }]}>+{members.length - 5}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={18} color={isDark ? DS.gray500 : DS.gray400} />
        </View>
      </View>
    </PressableScale>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */
const QuickActions = React.memo(({ isDark, onNavigate }: {
  isDark: boolean; onNavigate: (screen: string) => void;
}) => {
  const actions = [
    { id: 'timeline', label: 'Timeline', icon: 'time-outline' as const, color: DS.success, screen: 'Timeline' },
    { id: 'achievements', label: 'Milestones', icon: 'trophy-outline' as const, color: DS.warning, screen: 'Achievements' },
    { id: 'growth', label: 'Growth', icon: 'trending-up-outline' as const, color: DS.primary, screen: 'GrowthDashboard' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' as const, color: '#8b5cf6', screen: 'FamilySharing' },
  ];
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: DS.space.lg, marginTop: DS.space.sm }}>
        {actions.map((a) => (
          <PressableScale key={a.id} onPress={() => onNavigate(a.screen)} activeScale={0.94} style={{ flex: 1 }}>
            <View style={[styles.quickAction, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
              <LinearGradient colors={[`${a.color}12`, `${a.color}03`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <View style={[styles.quickActionIcon, { backgroundColor: `${a.color}18` }]}>
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={[styles.quickActionLabel, { color: isDark ? DS.gray300 : DS.gray700 }]}>{a.label}</Text>
            </View>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   GROWTH TAB
   ═══════════════════════════════════════════════════════════════════════════ */
const GrowthTab = React.memo(({ isDark, growthData, onFullChart, onMilestones }: {
  isDark: boolean; growthData: any[]; onFullChart: () => void; onMilestones: () => void;
}) => {
  const heightData = growthData.filter((g) => g.type === 'height');
  const weightData = growthData.filter((g) => g.type === 'weight');
  const latestHeight = heightData[heightData.length - 1];
  const latestWeight = weightData[weightData.length - 1];

  return (
    <View style={{ gap: 12 }}>
      <Animated.View entering={FadeInUp.delay(80).springify()}>
        <View style={[styles.growthCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <LinearGradient colors={[`${DS.primary}10`, `${DS.accent}06`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={styles.growthRow}>
            {[
              { icon: 'resize-outline' as const, gradient: ['#667eea', '#764ba2'] as [string, string], value: latestHeight ? `${latestHeight.value}${latestHeight.unit || 'cm'}` : '--', label: 'Height' },
              { icon: 'scale-outline' as const, gradient: ['#fa709a', '#fee140'] as [string, string], value: latestWeight ? `${latestWeight.value}${latestWeight.unit || 'kg'}` : '--', label: 'Weight' },
              { icon: 'analytics-outline' as const, gradient: ['#11998e', '#38ef7d'] as [string, string], value: `${growthData.length}`, label: 'Records' },
            ].map((stat) => (
              <View key={stat.label} style={styles.growthItem}>
                <LinearGradient colors={stat.gradient} style={styles.growthIcon}>
                  <Ionicons name={stat.icon} size={20} color={DS.white} />
                </LinearGradient>
                <Text style={[styles.growthVal, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{stat.value}</Text>
                <Text style={[styles.growthLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      <PressableScale onPress={onFullChart} activeScale={0.97}>
        <LinearGradient colors={[DS.primary, DS.accent]} style={styles.growthCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="trending-up" size={20} color={DS.white} />
          <Text style={styles.growthCtaText}>Full Growth Charts</Text>
          <Ionicons name="arrow-forward" size={18} color={DS.white} />
        </LinearGradient>
      </PressableScale>

      <PressableScale onPress={onMilestones} activeScale={0.97}>
        <View style={[styles.growthSecondary, { borderColor: `${DS.primary}30`, backgroundColor: `${DS.primary}08` }]}>
          <Ionicons name="trophy-outline" size={20} color={DS.primary} />
          <Text style={[styles.growthSecondaryText, { color: DS.primary }]}>View All Milestones</Text>
          <Ionicons name="chevron-forward" size={18} color={DS.primary} />
        </View>
      </PressableScale>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   ACTION MODAL (for baby selector)
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
export default function FamilyDashboardScreen({ navigation }: FamilyDashboardScreenProps) {
  const systemDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const { userProfile } = useAuth();
  const { profile } = useUser();
  const { babies, currentBaby, currentBabyId, switchBaby, growthData, milestones, activities, loadBabies, getPottyStreak } = useBaby();
  const { members, loadFamily } = useFamily();
  const sweetAlert = useSweetAlert();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? systemDark;

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'growth'>('overview');
  const [showBabySelector, setShowBabySelector] = useState(false);

  const effectiveUser = useMemo(() => userProfile || profile, [userProfile, profile]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    InteractionManager.runAfterInteractions(async () => {
      await Promise.all([loadBabies(), loadFamily()]);
      setRefreshing(false);
    });
  }, [loadBabies, loadFamily]);

  const handleSwitchBaby = useCallback((babyId: string) => {
    if (babyId === currentBabyId) return;
    triggerHaptic('light');
    switchBaby(babyId);
  }, [currentBabyId, switchBaby, triggerHaptic]);

  const handleBabyEdit = useCallback((babyId: string) => {
    navigation.navigate('EditProfile', { mode: 'baby', babyId });
  }, [navigation]);

  const handleNavigateFamily = useCallback(() => navigation.navigate('FamilySharing'), [navigation]);
  const handleNavigateTimeline = useCallback(() => navigation.navigate('Timeline'), [navigation]);
  const handleNavigateAchievements = useCallback(() => navigation.navigate('Achievements'), [navigation]);
  const handleNavigateGrowthChart = useCallback(() => navigation.navigate('GrowthDashboard'), [navigation]);
  const handleNavigateCreateBaby = useCallback(() => navigation.navigate('CreateBabyProfile'), [navigation]);
  const handleNavigateInvite = useCallback(() => navigation.navigate('CoParentInviteScreen'), [navigation]);
  const handleNavigateInsights = useCallback(() => navigation.navigate('Insights'), [navigation]);
  const handleNavigateGallery = useCallback(() => navigation.navigate('Gallery'), [navigation]);

  const { entries: trackerEntries } = useTracker();

  const todayStats = useMemo<TodayGlanceStat[]>(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEntries = trackerEntries.filter((e: any) => e.timestamp >= todayStart.getTime() && !e.isDeleted);
    const countBy = (id: string) => todayEntries.filter((e: any) => e.trackerId === id).length;
    return [
      { key: 'feed', icon: '🍼', label: 'Feeds', count: countBy('feed'), color: '#f59e0b' },
      { key: 'sleep', icon: '😴', label: 'Sleeps', count: countBy('sleep'), color: '#8b5cf6' },
      { key: 'diaper', icon: '🧷', label: 'Diapers', count: countBy('diaper'), color: '#06b6d4' },
      { key: 'potty', icon: '🚽', label: 'Potty', count: countBy('potty'), color: '#10b981' },
      { key: 'medication', icon: '💊', label: 'Meds', count: countBy('medication'), color: '#ef4444' },
    ].filter(s => s.count > 0 || ['feed', 'sleep', 'diaper'].includes(s.key));
  }, [trackerEntries]);

  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return trackerEntries.filter((e: any) => e.timestamp >= start.getTime() && !e.isDeleted).length;
  }, [trackerEntries]);

  const streak = useMemo(() => getPottyStreak(), [getPottyStreak]);

  const suggestionOfTheDay = useMemo(() => {
    if (currentBaby) {
      const ageMonths = differenceInMonths(new Date(), new Date(currentBaby.birthDate || currentBaby.dateOfBirth || new Date()));
      if (ageMonths >= 4 && ageMonths <= 8) {
        return { icon: '👶', title: 'Tummy time matters', description: `At ${ageMonths} months, aim for 3 short tummy-time sessions daily to build core strength.`, color: '#10b981', actionLabel: 'Learn More' };
      }
      if (ageMonths >= 10 && ageMonths <= 14) {
        return { icon: '🗣️', title: 'First words approaching', description: 'Baby is near the age where first words typically emerge. Narrate your day to encourage speech.', color: '#f59e0b', actionLabel: 'Explore Milestones' };
      }
      if (ageMonths < 3) {
        return { icon: '📸', title: 'Capture this stage', description: "Newborn weeks fly by — a quick photo today becomes tomorrow's treasure.", color: '#ec4899', actionLabel: 'Open Gallery' };
      }
    }
    return { icon: '📊', title: 'Check your weekly insights', description: 'See patterns in feeding, sleep, and growth this week.', color: DS.primary, actionLabel: 'View Insights' };
  }, [currentBaby]);

  const todayContributors = useMemo<TodayContributor[]>(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const map = new Map<string, TodayContributor>();
    trackerEntries.forEach((e: any) => {
      if (e.isDeleted || e.timestamp < todayStart.getTime()) return;
      const key = e.loggedBy || e.loggedByName || 'unknown';
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else {
        const memberMatch = members.find((m) => m.userId === e.loggedBy || m.id === e.loggedBy || m.fullName === e.loggedByName);
        map.set(key, { id: key, name: e.loggedByName || memberMatch?.fullName || 'Someone', avatar: memberMatch?.avatar, count: 1 });
      }
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [trackerEntries, members]);

  const handleSuggestionAction = useCallback(() => {
    triggerHaptic('medium');
    if (suggestionOfTheDay.actionLabel === 'View Insights') handleNavigateInsights();
    else if (suggestionOfTheDay.actionLabel === 'Explore Milestones') handleNavigateAchievements();
    else if (suggestionOfTheDay.actionLabel === 'Open Gallery') handleNavigateGallery();
    else sweetAlert.toast('Coming Soon', 'This tip will be actionable soon', 'info');
  }, [suggestionOfTheDay, sweetAlert, triggerHaptic, handleNavigateInsights, handleNavigateAchievements, handleNavigateGallery]);

  const handleTodayStatPress = useCallback((key: string) => {
    triggerHaptic('light');
    navigation.navigate('Timeline', { trackerId: key, filter: 'today' });
  }, [navigation, triggerHaptic]);

  const handleBabyPress = useCallback(() => {
    if (babies.length > 1) setShowBabySelector(true);
    else if (currentBaby) handleBabyEdit(currentBaby.id);
    else handleNavigateCreateBaby();
  }, [babies.length, currentBaby, handleBabyEdit, handleNavigateCreateBaby]);

  const topRibbon = useMemo(() => {
    if (todayContributors.length > 1) return { icon: 'people-outline' as const, color: DS.success, label: 'Teamwork', text: `${todayContributors.length} family members logged today`, onPress: handleNavigateTimeline };
    if (streak > 0) return { icon: 'flame' as const, color: DS.warning, label: 'Streak', text: `${streak}-day tracking streak going strong`, onPress: handleNavigateAchievements };
    return { icon: 'sparkles' as const, color: DS.primary, label: 'Tip', text: 'Log with your family to build better patterns', onPress: handleNavigateTimeline };
  }, [todayContributors.length, streak, handleNavigateTimeline, handleNavigateAchievements]);

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: 'grid-outline' as const },
    { key: 'growth' as const, label: 'Growth', icon: 'trending-up-outline' as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky header (on scroll) */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: HEADER_TOP_PADDING, backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)', borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }, headerAnim]}>
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
          <TouchableOpacity onPress={handleNavigateInvite} style={[styles.headerIconBtn, { backgroundColor: DS.primary }]}>
            <Ionicons name="person-add" size={18} color={DS.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOP_PADDING + 8, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
      >
        {/* Pulse Header — NO hero card */}
        <PulseHeader
          isDark={isDark}
          currentBaby={currentBaby}
          babies={babies}
          members={members}
          todayCount={todayCount}
          streak={streak}
          onBack={() => navigation.goBack()}
          onBabyPress={handleBabyPress}
          onAddPress={() => navigation.navigate('AddEntry' as never)}
          onFamilyPress={handleNavigateFamily}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Tab bar */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={(t) => { triggerHaptic('light'); setActiveTab(t); }} isDark={isDark} />
        </View>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <View style={{ paddingTop: DS.space.md }}>
            <FamilyStatsStrip members={members.length} babies={babies.length} activities={activities.length} milestones={milestones.length} isDark={isDark} />

            <View style={{ marginTop: DS.space.lg }}>
              <TodayAtGlance stats={todayStats} isDark={isDark} onPress={handleTodayStatPress} />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <SuggestionCard isDark={isDark} suggestion={suggestionOfTheDay} onAction={handleSuggestionAction} />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <BabyCard isDark={isDark} baby={currentBaby} streak={streak} onEdit={() => currentBaby && handleBabyEdit(currentBaby.id)} onGrowth={handleNavigateGrowthChart} />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <ActiveToday contributors={todayContributors} isDark={isDark} onSeeAll={handleNavigateTimeline} />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <FamilyStack members={members} isDark={isDark} onPress={handleNavigateFamily} />
            </View>

            <View style={{ marginTop: DS.space.lg }}>
              <QuickActions isDark={isDark} onNavigate={(screen) => navigation.navigate(screen as never)} />
            </View>
          </View>
        )}

        {/* ═══ GROWTH TAB ═══ */}
        {activeTab === 'growth' && (
          <View style={{ paddingTop: DS.space.md }}>
            <GrowthTab isDark={isDark} growthData={growthData} onFullChart={handleNavigateGrowthChart} onMilestones={handleNavigateAchievements} />
          </View>
        )}

        <View style={{ height: 40 }} />
      </AnimatedScrollView>

      {/* Baby Selector Modal */}
      <ActionModal visible={showBabySelector} onClose={() => setShowBabySelector(false)} title="Select Baby" isDark={isDark}>
        <View style={{ gap: 8 }}>
          {babies.map((baby) => {
            const isActive = currentBaby?.id === baby.id;
            return (
              <PressableScale key={baby.id} onPress={() => { handleSwitchBaby(baby.id); setShowBabySelector(false); }} activeScale={0.98}>
                <View style={[styles.babyOption, {
                  backgroundColor: isActive ? `${DS.primary}10` : isDark ? 'rgba(255,255,255,0.03)' : DS.gray50,
                  borderColor: isActive ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                  borderWidth: isActive ? 2 : 1,
                }]}>
                  <View style={[styles.babyOptionIcon, { backgroundColor: isActive ? DS.primary : isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                    <SafeAvatar avatar={baby.avatar} gender={baby.gender} size={36} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.babyOptionName, { color: isDark ? DS.white : DS.gray900 }]}>{baby.name}</Text>
                    <Text style={[styles.babyOptionMeta, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      {baby.dateOfBirth ? new Date(baby.dateOfBirth).toLocaleDateString() : 'Baby'} • {baby.gender || 'Baby'}
                    </Text>
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={22} color={DS.primary} />}
                </View>
              </PressableScale>
            );
          })}
          <PressableScale onPress={() => { setShowBabySelector(false); handleNavigateCreateBaby(); }} activeScale={0.98}>
            <View style={[styles.babyOptionAdd, { borderColor: isDark ? DS.darkBorder : DS.gray300 }]}>
              <View style={[styles.babyOptionIcon, { backgroundColor: `${DS.primary}15` }]}>
                <Ionicons name="add" size={22} color={DS.primary} />
              </View>
              <Text style={[styles.babyOptionName, { color: DS.primary }]}>Add New Baby</Text>
            </View>
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

  /* Sticky header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse header */
  pulseWrap: { marginHorizontal: DS.space.lg, marginTop: DS.space.md, borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md, position: 'relative' },
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
  pulseIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pulseStats: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.space.md, paddingVertical: DS.space.sm, borderRadius: DS.radius.lg, marginTop: DS.space.md, gap: DS.space.sm },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatarStackItem: { borderRadius: 14, borderWidth: 2, overflow: 'hidden', position: 'relative' },
  avatarExtra: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarExtraText: { fontSize: 10, fontWeight: '800' },
  pulseStatDiv: { width: 1, height: 18 },
  pulseStat: { alignItems: 'center' },
  pulseStatVal: { fontSize: 14, fontWeight: '800' },
  pulseStatLbl: { fontSize: 9, fontWeight: '600', marginTop: 1 },

  /* Ribbon */
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  /* Tab bar */
  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: DS.space.lg, marginBottom: DS.space.md, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  /* Stats strip */
  statsStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginHorizontal: DS.space.lg, paddingVertical: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  statsItem: { alignItems: 'center', flex: 1 },
  statsVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  statsLbl: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  statsDiv: { width: 1, height: 26 },

  /* Glance */
  glanceCard: { width: 96, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 4, overflow: 'hidden' },
  glanceIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  glanceIcon: { fontSize: 20 },
  glanceCount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  glanceLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  /* Suggestion */
  suggestionCard: { marginHorizontal: DS.space.lg, padding: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  suggestionRow: { flexDirection: 'row', gap: DS.space.md, marginBottom: DS.space.md },
  suggestionIconBg: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  suggestionIcon: { fontSize: 26 },
  suggestionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 3 },
  suggestionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  suggestionDesc: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  suggestionActionBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  suggestionActionText: { fontSize: 12, fontWeight: '700' },

  /* Baby card */
  babyCard: { marginHorizontal: DS.space.lg, padding: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  babyRow: { flexDirection: 'row', alignItems: 'center' },
  babyName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  babyMeta: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  babyTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  babyTagText: { fontSize: 10, fontWeight: '700' },
  babyEditBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  /* Active today */
  contribCard: { marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md },
  contribName: { flex: 1, fontSize: 13, fontWeight: '700' },
  contribBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  contribBadgeText: { fontSize: 11, fontWeight: '700' },

  /* Family stack */
  familyStackCard: { marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  familyStackRow: { flexDirection: 'row', alignItems: 'center', padding: DS.space.lg },
  stackAvatar: { borderRadius: 22, overflow: 'hidden', borderWidth: 2 },
  stackAvatarMore: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  stackAvatarMoreText: { fontSize: 13, fontWeight: '800' },

  /* Quick actions */
  quickAction: { padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 6, overflow: 'hidden' },
  quickActionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 11, fontWeight: '700' },

  /* Growth */
  growthCard: { marginHorizontal: DS.space.lg, padding: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, overflow: 'hidden', ...DS.shadow.sm },
  growthRow: { flexDirection: 'row', justifyContent: 'space-around' },
  growthItem: { alignItems: 'center', gap: 8 },
  growthIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  growthVal: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  growthLbl: { fontSize: 11, fontWeight: '600' },
  growthCta: { marginHorizontal: DS.space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: DS.radius.md, gap: 10 },
  growthCtaText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  growthSecondary: { marginHorizontal: DS.space.lg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: DS.radius.md, borderWidth: 1 },
  growthSecondaryText: { flex: 1, fontSize: 14, fontWeight: '700' },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 400, maxHeight: '85%', borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: DS.space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)' },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  /* Baby option */
  babyOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: DS.radius.md, gap: DS.space.md },
  babyOptionAdd: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: DS.radius.md, borderWidth: 1.5, borderStyle: 'dashed', gap: DS.space.md },
  babyOptionIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  babyOptionName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  babyOptionMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
});