/**
 * src/components/FamilyUI.tsx
 *
 * Shared building blocks for the two family screens:
 *   • FamilyDashboardScreen  → "Family Overview"  (read-only snapshot)
 *   • FamilySharingScreen    → "Manage Family"    (members, roles, invites)
 *
 * Everything that used to be copy-pasted in both screens lives here once.
 */
import React, { memo, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
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
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { format } from 'date-fns';

import OptimizedImage from './OptimizedImage';
import { UserRole } from '../types/roles';

export type IconName = keyof typeof Ionicons.glyphMap;

/* ─────────────────────────── Layout constants ─────────────────────────── */
export const HEADER_TOP_PADDING =
  Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;
export const HEADER_TOTAL_HEIGHT = HEADER_TOP_PADDING + 52;

/* ─────────────────────────── Design tokens ─────────────────────────── */
export const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
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
  darkBorder: 'rgba(255,255,255,0.08)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

/** One place that answers "what colour is text / card / border right now?" */
export const theme = (isDark: boolean) => ({
  title: isDark ? DS.white : DS.gray900,
  body: isDark ? DS.gray300 : DS.gray700,
  muted: isDark ? DS.gray400 : DS.gray500,
  faint: isDark ? DS.gray500 : DS.gray400,
  card: isDark ? DS.darkCard : DS.white,
  surface: isDark ? DS.darkSurface : DS.gray100,
  border: isDark ? DS.darkBorder : DS.gray200,
  chip: isDark ? 'rgba(255,255,255,0.07)' : DS.gray100,
  screenGradient: (isDark
    ? ['#0c0a09', '#12121e', '#0c0a09']
    : ['#f8faff', '#eef0f5', '#e4e8f0']) as [string, string, string],
});

/* ─────────────────────────── Role config ─────────────────────────── */
export const ROLE_CONFIG: Record<
  UserRole,
  { label: string; color: string; gradient: [string, string]; icon: IconName }
> = {
  [UserRole.PARENT_1]: { label: 'Primary Parent', color: '#667eea', gradient: ['#667eea', '#764ba2'], icon: 'shield' },
  [UserRole.PARENT_2]: { label: 'Co-Parent', color: '#fa709a', gradient: ['#fa709a', '#f5576c'], icon: 'heart' },
  [UserRole.GUARDIAN]: { label: 'Guardian', color: '#11998e', gradient: ['#11998e', '#38ef7d'], icon: 'shield-checkmark' },
  [UserRole.VIEWER]: { label: 'Viewer', color: '#64748b', gradient: ['#64748b', '#94a3b8'], icon: 'eye' },
};

/* ─────────────────────────── Helpers ─────────────────────────── */
export const HAPTIC_LIGHT = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
export const HAPTIC_MEDIUM = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

export const isImageUri = (v?: string | null): boolean =>
  !!v && typeof v === 'string' && (v.startsWith('http') || v.startsWith('file://') || v.startsWith('data:'));

export const isEmoji = (v?: string | null): boolean =>
  !!v && typeof v === 'string' && v.length <= 4 && /\p{Emoji}/u.test(v);

export const formatRelative = (ts: number): string => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return format(new Date(ts), 'MMM d');
};

export const isActiveWithin = (member: any, ms: number): boolean =>
  !!member?.lastActive && Date.now() - new Date(member.lastActive).getTime() < ms;

export const isPendingMember = (member: any): boolean =>
  !member?.lastActive || member?.status === 'pending';

/** Params for EditGuardian — the single per-person profile screen. */
export const memberEditParams = (member: any) => ({
  guardianId: member?.userId || member?.id,
  mode:
    member?.role === UserRole.PARENT_2
      ? 'parent2'
      : member?.role === UserRole.VIEWER
      ? 'viewer'
      : 'guardian',
  fromChat: false,
  fromFamily: true,
});

/* ─────────────────────────── PressableScale ─────────────────────────── */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const PressableScale = memo(
  ({
    children,
    onPress,
    disabled,
    style,
    activeScale = 0.96,
    haptic = 'light',
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    style?: any;
    activeScale?: number;
    haptic?: 'light' | 'medium';
  }) => {
    const scale = useSharedValue(1);
    const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <AnimatedTouchable
        style={[style, anim]}
        onPress={() => {
          if (disabled) return;
          haptic === 'medium' ? HAPTIC_MEDIUM() : HAPTIC_LIGHT();
          onPress?.();
        }}
        onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
        activeOpacity={disabled ? 1 : 0.85}
        disabled={disabled}
      >
        {children}
      </AnimatedTouchable>
    );
  },
);

/* ─────────────────────────── Card ─────────────────────────── */
export const Card = ({
  isDark,
  children,
  style,
  tint,
}: {
  isDark: boolean;
  children: React.ReactNode;
  style?: any;
  tint?: string;
}) => {
  const t = theme(isDark);
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {tint ? (
        <LinearGradient
          colors={[`${tint}12`, `${tint}03`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
};

/* ─────────────────────────── SafeAvatar ─────────────────────────── */
export const SafeAvatar = memo(
  ({
    avatar,
    gender,
    size = 44,
    fallbackColor,
    fallbackIcon,
  }: {
    avatar?: string | null;
    gender?: string;
    size?: number;
    fallbackColor?: string;
    fallbackIcon?: IconName;
  }) => {
    const [imageError, setImageError] = useState(false);
    useEffect(() => setImageError(false), [avatar]);

    const hasImage = isImageUri(avatar) && !imageError;
    const hasEmoji = !hasImage && isEmoji(avatar);
    const base =
      fallbackColor ||
      (gender === 'boy' ? '#667eea' : gender === 'girl' ? '#fa709a' : DS.primary);
    const icon: IconName =
      fallbackIcon || (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'person');

    return (
      <View style={{ width: size, height: size, borderRadius: size / 2.8, overflow: 'hidden' }}>
        <LinearGradient
          colors={[`${base}25`, `${base}45`]}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {hasImage ? (
            <OptimizedImage
              source={{ uri: avatar as string }}
              style={{ width: size, height: size }}
              contentFit="cover"
              cachePolicy="memory-disk"
              onError={() => setImageError(true)}
              transition={200}
            />
          ) : hasEmoji ? (
            <Text style={{ fontSize: size * 0.5 }}>{avatar}</Text>
          ) : (
            <Ionicons name={icon} size={size * 0.45} color={base} />
          )}
        </LinearGradient>
      </View>
    );
  },
);

/* ─────────────────────────── SectionHeader ─────────────────────────── */
export const SectionHeader = memo(
  ({
    isDark,
    title,
    subtitle,
    icon,
    color = DS.primary,
    action,
    actionLabel,
  }: {
    isDark: boolean;
    title: string;
    subtitle?: string;
    icon?: IconName;
    color?: string;
    action?: () => void;
    actionLabel?: string;
  }) => {
    const t = theme(isDark);
    return (
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, flex: 1 }}>
          {icon ? (
            <View style={[styles.sectionIcon, { backgroundColor: `${color}1c` }]}>
              <Ionicons name={icon} size={15} color={color} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: t.title }]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[styles.sectionSub, { color: t.muted }]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        {action ? (
          <TouchableOpacity
            onPress={action}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
          >
            <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See all'}</Text>
            <Ionicons name="chevron-forward" size={13} color={color} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  },
);

/* ─────────────────────────── Header ─────────────────────────── */
export const HeaderButton = ({
  icon,
  onPress,
  isDark,
  filled,
  color,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  isDark: boolean;
  filled?: boolean;
  color?: string;
  label?: string;
}) => {
  const t = theme(isDark);
  const tint = color || (isDark ? DS.white : DS.gray800);
  return (
    <TouchableOpacity
      onPress={() => { HAPTIC_LIGHT(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label || icon}
      style={[
        styles.headerBtn,
        { backgroundColor: filled ? DS.primary : t.chip },
      ]}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={19} color={filled ? DS.white : tint} />
    </TouchableOpacity>
  );
};

/** Single fixed top bar used by BOTH screens (no duplicate back buttons). */
export const ScreenHeader = ({
  isDark,
  title,
  subtitle,
  onBack,
  right,
}: {
  isDark: boolean;
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) => {
  const t = theme(isDark);
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: HEADER_TOP_PADDING,
          backgroundColor: isDark ? 'rgba(12,10,9,0.9)' : 'rgba(255,255,255,0.9)',
          borderBottomColor: t.border,
        },
      ]}
    >
      <BlurView intensity={isDark ? 80 : 90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={styles.headerInner}>
        <View style={styles.headerSideLeft}>
          <HeaderButton icon="arrow-back" onPress={onBack} isDark={isDark} label="Back" />
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: t.title }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.headerSub, { color: t.muted }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerSideRight}>{right}</View>
      </View>
    </View>
  );
};

/* ─────────────────────────── Tabs ─────────────────────────── */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  isDark,
}: {
  tabs: { key: T; label: string; icon: IconName; badge?: number }[];
  active: T;
  onChange: (k: T) => void;
  isDark: boolean;
}) {
  const t = theme(isDark);
  return (
    <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.07)' }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const color = isActive ? DS.primary : t.muted;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => { HAPTIC_LIGHT(); onChange(tab.key); }}
            style={[
              styles.tabItem,
              isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm },
            ]}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons name={tab.icon} size={15} color={color} />
            <Text style={[styles.tabLabel, { color }, isActive && { fontWeight: '800' }]}>{tab.label}</Text>
            {tab.badge ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge > 9 ? '9+' : tab.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */
export const EmptyState = ({
  isDark,
  icon,
  title,
  text,
  ctaLabel,
  onCta,
  color = DS.primary,
}: {
  isDark: boolean;
  icon: IconName;
  title: string;
  text?: string;
  ctaLabel?: string;
  onCta?: () => void;
  color?: string;
}) => {
  const t = theme(isDark);
  return (
    <Card isDark={isDark} style={{ alignItems: 'center', paddingVertical: DS.space['2xl'], paddingHorizontal: DS.space.lg }}>
      <View style={[styles.emptyIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.emptyTitle, { color: t.title }]}>{title}</Text>
      {text ? <Text style={[styles.emptyText, { color: t.muted }]}>{text}</Text> : null}
      {ctaLabel && onCta ? (
        <PressableScale onPress={onCta} activeScale={0.96} haptic="medium">
          <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.emptyBtnText}>{ctaLabel}</Text>
          </LinearGradient>
        </PressableScale>
      ) : null}
    </Card>
  );
};

/* ─────────────────────────── Bottom sheet modal ─────────────────────────── */
export const SheetModal = ({
  visible,
  onClose,
  title,
  subtitle,
  isDark,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  isDark: boolean;
  children: React.ReactNode;
}) => {
  const t = theme(isDark);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <BlurView intensity={isDark ? 60 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </TouchableOpacity>
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: t.title }]}>{title}</Text>
              {subtitle ? <Text style={[styles.sectionSub, { color: t.muted }]}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.sheetClose, { backgroundColor: t.chip }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: DS.space.lg }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ─────────────────────────── Styles ─────────────────────────── */
const styles = StyleSheet.create({
  card: {
    marginHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg,
    padding: DS.space.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...DS.shadow.sm,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    marginTop: DS.space.sm,
  },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  sectionAction: { fontSize: 12, fontWeight: '700' },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    height: 48,
  },
  headerSideLeft: { width: 84, alignItems: 'flex-start' },
  headerSideRight: { width: 84, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: DS.space.lg,
    padding: 4,
    borderRadius: DS.radius.full,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: DS.radius.full,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: DS.white, fontSize: 9, fontWeight: '800' },

  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  emptyText: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17 },
  emptyBtn: { marginTop: DS.space.md, paddingHorizontal: DS.space.xl, paddingVertical: 10, borderRadius: DS.radius.sm },
  emptyBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '80%', borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DS.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: DS.space.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sheetClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
