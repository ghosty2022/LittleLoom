import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Share,
  Platform,
  Linking,
  Pressable,
  FlatList,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
  FadeInUp,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  Layout,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../utils/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Hooks
import { useSupabase } from '../../hooks/useSupabase';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useCustomization } from '../../hooks/useCustomization';

// Contexts
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useSecurity } from '../../context/SecurityContext';
import { useActivity } from '../../context/ActivityContext';
import { useTracker } from '../../hooks/useTrackerContext';
import { useUser } from '../../context/UserContext';
import { useApp } from '../../context/AppContext';
import { useCommunity } from '../../context/CommunityContext';
import { useFamilyChat } from '../../context/FamilyChatContext';
import { useAudio } from '../../context/AudioContext';

// Components
import { SafeAvatar, SafeBabyAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { AILearningStatus } from '../../components/AILearningStatus';
import { useSweetAlert } from '../../components/SweetAlert';

// Types
import type { RootStackParamList } from '../../types/navigation';
import type { FamilyMember } from '../../types/roles';

// Services
import backupService, { createBackup } from '../../utils/backupService';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const littleLoomLogo = require('../../../assets/logo.png');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aligned with Community Screen
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  // Primary palette
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

  // Grays
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

  // Dark mode
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',

  // Spacing
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56 },

  // Radius
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },

  // Shadows
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(
  ({
    children,
    style,
    colors = ['#667eea', '#764ba2', '#f093fb'],
    ...props
  }: {
    children: React.ReactNode;
    style?: any;
    colors?: string[];
    [k: string]: any;
  }) => {
    const raw = typeof children === 'string' ? children : String(children ?? '');
    const letters = raw.split('');

    const interpolateColor = (c1: string, c2: string, t: number) => {
      const r1 = parseInt(c1.slice(1, 3), 16);
      const g1 = parseInt(c1.slice(3, 5), 16);
      const b1 = parseInt(c1.slice(5, 7), 16);
      const r2 = parseInt(c2.slice(1, 3), 16);
      const g2 = parseInt(c2.slice(3, 5), 16);
      const b2 = parseInt(c2.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {letters.map((letter, index) => {
          const position = index / Math.max(letters.length - 1, 1);
          const colorIndex = position * (colors.length - 1);
          const lowerIndex = Math.floor(colorIndex);
          const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
          const fraction = colorIndex - lowerIndex;
          const startColor = colors[lowerIndex] || colors[0];
          const endColor = colors[upperIndex] || colors[colors.length - 1];
          const color = interpolateColor(startColor, endColor, fraction);
          return (
            <Text key={index} style={[style, { color }]} {...props}>
              {letter}
            </Text>
          );
        })}
      </View>
    );
  },
);

/* ═══════════════════════════════════════════════════════════════════════════
   PRESSABLE SCALE (springy touch feedback)
   ═══════════════════════════════════════════════════════════════════════════ */

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: any;
  activeScale?: number;
  hapticType?: 'light' | 'medium' | 'heavy' | 'success';
}

const PressableScale = React.memo<PressableScaleProps>(({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  activeScale = 0.96,
  hapticType = 'light',
}) => {
  const scale = useSharedValue(1);
  const { triggerHaptic, hapticFeedback } = useCustomization();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(activeScale, { duration: 80 });
  }, [activeScale, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (hapticFeedback) triggerHaptic(hapticType).catch(() => {});
    onPress?.();
  }, [disabled, hapticFeedback, triggerHaptic, hapticType, onPress]);

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOM MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: string;
  iconColor?: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  isDark: boolean;
  primaryColor: string;
}

const CustomModal = React.memo<CustomModalProps>(({
  visible,
  onClose,
  title,
  message,
  icon = 'information-circle',
  iconColor,
  primaryAction,
  secondaryAction,
  isDark,
  primaryColor,
}) => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.8, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, scale, opacity]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  // Shared inner content — rendered in both branches so we don't duplicate JSX.
  const modalBody = (
    <>
      <View
        style={[
          styles.modalIconWrap,
          { backgroundColor: `${iconColor || primaryColor}15` },
        ]}
      >
        <Ionicons name={icon as any} size={32} color={iconColor || primaryColor} />
      </View>

      <Text style={[styles.modalTitle, isDark && styles.textLight]}>{title}</Text>
      <Text style={[styles.modalDesc, isDark && styles.textMuted]}>{message}</Text>

      <View style={styles.modalButtons}>
        {secondaryAction && (
          <TouchableOpacity
            style={[
              styles.modalSecondaryBtn,
              { borderColor: `${primaryColor}30`, borderWidth: 1 },
            ]}
            onPress={() => {
              secondaryAction.onPress();
              onClose();
            }}
          >
            <Text style={[styles.modalSecondaryBtnText, { color: primaryColor }]}>
              {secondaryAction.label}
            </Text>
          </TouchableOpacity>
        )}
        {primaryAction && (
          <TouchableOpacity
            style={[styles.modalPrimaryBtn, { backgroundColor: primaryColor }]}
            onPress={() => {
              primaryAction.onPress();
              onClose();
            }}
          >
            <Text style={styles.modalPrimaryBtnText}>{primaryAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
      <Animated.View style={[styles.modalOverlay, backdropStyle]}>
        {/* On Android, BlurView renders a sharp opaque rectangle that ignores
            borderRadius + overflow:hidden. Use a plain View there so the
            rounded corners are actually respected. On iOS keep the blur. */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 60 : 90}
            style={[styles.modalContent, isDark && styles.modalContentDark]}
            tint={isDark ? 'dark' : 'light'}
          >
            <Animated.View style={contentStyle}>{modalBody}</Animated.View>
          </BlurView>
        ) : (
          <Animated.View
            style={[
              styles.modalContent,
              styles.modalContentAndroid,
              isDark && styles.modalContentDark,
              contentStyle,
            ]}
          >
            {modalBody}
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PULSING DOT
   ═══════════════════════════════════════════════════════════════════════════ */

const PulsingDot: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => {
  const pulse = useSharedValue(1);
  const halo = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );
    halo.value = withRepeat(
      withSequence(withTiming(1.8, { duration: 1400 }), withTiming(1, { duration: 1400 })),
      -1,
      true
    );
  }, [pulse, halo]);

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    opacity: interpolate(halo.value, [1, 1.8], [0.35, 0]),
  }));

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          dotStyle,
        ]}
      />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AURA HERO BANNER — Matches Community Screen
   ═══════════════════════════════════════════════════════════════════════════ */

interface AuraSettingsBannerProps {
  isDark: boolean;
  userProfile: any;
  currentBaby: any;
  stats: { entries: number; streak: number; milestones: number };
  cloudActive: boolean;
  cloudColor: string;
  cloudLabel: string;
  isSyncing: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  onShare: () => void;
  onSync: () => void;
  onProfilePress: () => void;
  onCommunityPress: () => void;
  onTimelinePress: () => void;
  onAchievementsPress: () => void;
  onMilestonesPress: () => void;
}

const AuraSettingsBanner = React.memo<AuraSettingsBannerProps>(({
  isDark,
  userProfile,
  currentBaby,
  stats,
  cloudActive,
  cloudColor,
  cloudLabel,
  isSyncing,
  syncStatus,
  onShare,
  onSync,
  onProfilePress,
  onCommunityPress,
  onTimelinePress,
  onAchievementsPress,
  onMilestonesPress,
}) => {
  return (
    <View
      style={[
        styles.heroBanner,
        {
          backgroundColor: isDark ? DS.darkCard : DS.white,
          borderColor: isDark ? DS.darkBorder : DS.gray200,
          borderWidth: 1,
        },
      ]}
    >
      {/* Base gradient */}
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
      {/* Aura glows */}
      <LinearGradient
        colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`${DS.accent}${isDark ? '38' : '22'}`, 'transparent']}
        style={styles.auraGlowTopRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      <View style={styles.heroContent}>
        {/* Title row */}
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.heroTitle}>
              SETTINGS
            </GradientText>
            <View style={styles.cloudRow}>
              {isSyncing ? (
                <UniversalSpinner size={10} color={cloudColor} variant="liquid" section="settings" />
              ) : (
                <PulsingDot color={cloudColor} size={7} />
              )}
              <Text style={[styles.cloudText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                {cloudLabel}
              </Text>
            </View>
          </View>
          <View style={styles.heroActionsTop}>
            <TouchableOpacity
              onPress={onShare}
              style={[
                styles.headerIconBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={18} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSync}
              style={[
                styles.headerIconBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 },
              ]}
              disabled={isSyncing}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  syncStatus === 'success'
                    ? 'checkmark-circle'
                    : syncStatus === 'error'
                    ? 'alert-circle'
                    : 'cloud-upload-outline'
                }
                size={18}
                color={
                  syncStatus === 'success'
                    ? DS.success
                    : syncStatus === 'error'
                    ? DS.danger
                    : isDark
                    ? DS.white
                    : DS.gray800
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* User row */}
        <View style={styles.heroUserRow}>
          <PressableScale onPress={onProfilePress} activeScale={0.92}>
            <SafeAvatar
              avatar={userProfile?.avatar}
              size={60}
              fallbackIcon="person"
              fallbackColor={DS.primary}
              showEditBadge={true}
              borderWidth={2.5}
              borderColor={isDark ? 'rgba(255,255,255,0.15)' : DS.white}
            />
          </PressableScale>
          <View style={styles.heroUserInfo}>
            <Text style={[styles.heroUserName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {userProfile?.fullName || 'Parent'}
            </Text>
            <Text style={[styles.heroUserEmail, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {userProfile?.email || 'parent@littleloom.app'}
            </Text>
            {currentBaby && (
              <View style={[styles.babyTagPill, { backgroundColor: isDark ? `${DS.accent}20` : `${DS.accent}12` }]}>
                <Ionicons name="heart" size={10} color={DS.accent} />
                <Text style={[styles.babyTagPillText, { color: DS.accent }]} numberOfLines={1}>
                  {currentBaby.name} · {currentBaby.age}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Community profile link */}
        <PressableScale onPress={onCommunityPress} activeScale={0.98}>
          <View
            style={[
              styles.communityLinkRow,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)' },
            ]}
          >
            <View style={[styles.communityLinkIcon, { backgroundColor: `${DS.primary}18` }]}>
              <Ionicons name="globe-outline" size={16} color={DS.primary} />
            </View>
            <View style={styles.communityLinkText}>
              <Text style={[styles.communityLinkTitle, { color: isDark ? DS.white : DS.gray800 }]}>
                Community Profile
              </Text>
              <Text style={[styles.communityLinkSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Edit your public profile & bio
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
          </View>
        </PressableScale>

        {/* Stats strip */}
        <View
          style={[
            styles.heroStats,
            { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' },
          ]}
        >
          <TouchableOpacity style={styles.heroStat} onPress={onTimelinePress} activeOpacity={0.7}>
            <Text style={[styles.heroStatValue, { color: DS.info }]}>{stats.entries}</Text>
            <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Entries</Text>
          </TouchableOpacity>
          <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <TouchableOpacity style={styles.heroStat} onPress={onAchievementsPress} activeOpacity={0.7}>
            <Text style={[styles.heroStatValue, { color: DS.warning }]}>{stats.streak}</Text>
            <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Streak</Text>
          </TouchableOpacity>
          <View style={[styles.heroStatDivider, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <TouchableOpacity style={styles.heroStat} onPress={onMilestonesPress} activeOpacity={0.7}>
            <Text style={[styles.heroStatValue, { color: DS.success }]}>{stats.milestones}</Text>
            <Text style={[styles.heroStatLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Milestones</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Pill-style with Chevron
   ═══════════════════════════════════════════════════════════════════════════ */

interface SectionHeaderProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  color: string;
  isDark: boolean;
  isExpanded: boolean;
  onPress: () => void;
  badge?: number | string;
  rightAction?: React.ReactNode;
}

const SectionHeader = React.memo<SectionHeaderProps>(({
  icon,
  title,
  subtitle,
  color,
  isDark,
  isExpanded,
  onPress,
  badge,
  rightAction,
}) => {
  const rotation = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(isExpanded ? 1 : 0, { duration: 250 });
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(rotation.value, [0, 1], [0, 90], Extrapolate.CLAMP)}deg`,
      },
    ],
  }));

  return (
    <PressableScale onPress={onPress} hapticType="light">
      <View style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIconWrap, { backgroundColor: `${color}18` }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>{title}</Text>
            {subtitle && (
              <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{subtitle}</Text>
            )}
          </View>
        </View>
        <View style={styles.sectionHeaderRight}>
          {badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          {rightAction}
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-forward" size={18} color={isDark ? DS.gray500 : DS.gray400} />
          </Animated.View>
        </View>
      </View>
    </PressableScale>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MENU ITEM
   ═══════════════════════════════════════════════════════════════════════════ */

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  isEnabled?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  color: string;
  isDark: boolean;
  showArrow?: boolean;
  disabled?: boolean;
  isDestructive?: boolean;
  badge?: number | string;
  isLast?: boolean;
  loading?: boolean;
}

const MenuItem = React.memo<MenuItemProps>(({
  icon,
  title,
  subtitle,
  value,
  isEnabled,
  onToggle,
  onPress,
  color,
  isDark,
  showArrow = false,
  disabled = false,
  isDestructive = false,
  badge,
  isLast = false,
  loading = false,
}) => {
  const { hapticFeedback, triggerHaptic } = useCustomization();

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (onToggle) {
      if (hapticFeedback) triggerHaptic('light').catch(() => {});
      onToggle(!isEnabled);
    } else if (onPress) {
      if (hapticFeedback) triggerHaptic('light').catch(() => {});
      onPress();
    }
  }, [disabled, loading, onToggle, onPress, isEnabled, hapticFeedback, triggerHaptic]);

  const iconColor = isDestructive ? DS.danger : disabled ? DS.gray400 : color;
  const titleColor = isDestructive
    ? DS.danger
    : disabled
    ? DS.gray400
    : isDark
    ? DS.white
    : DS.gray900;
  const subtitleColor = isDark ? DS.gray400 : DS.gray500;

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled || loading}
      activeScale={0.98}
      style={!isLast ? styles.menuItemBorder : undefined}
    >
      <View style={[styles.menuItem, (disabled || loading) && styles.menuItemDisabled]}>
        <View
          style={[
            styles.menuIconWrap,
            {
              backgroundColor: isDestructive ? 'rgba(239,68,68,0.12)' : `${color}12`,
            },
          ]}
        >
          {loading ? (
            <UniversalSpinner size={18} color={color} variant="liquid" section="settings" />
          ) : (
            <Ionicons name={icon} size={20} color={iconColor} />
          )}
        </View>

        <View style={styles.menuTextContainer}>
          <View style={styles.menuTitleRow}>
            <Text style={[styles.menuTitle, { color: titleColor }]} numberOfLines={1}>
              {title}
            </Text>
            {badge !== undefined && (
              <View style={[styles.badgeSmall, { backgroundColor: color }]}>
                <Text style={styles.badgeTextSmall}>{badge}</Text>
              </View>
            )}
          </View>
          {(subtitle || value) && (
            <Text style={[styles.menuSubtitle, { color: subtitleColor }]} numberOfLines={1}>
              {value || subtitle}
            </Text>
          )}
        </View>

        <View style={styles.menuRight}>
          {onToggle ? (
            <Switch
              value={isEnabled}
              onValueChange={
                disabled || loading
                  ? undefined
                  : (val) => {
                      if (hapticFeedback) triggerHaptic('light').catch(() => {});
                      onToggle(val);
                    }
              }
              trackColor={{
                false: isDark ? '#333' : DS.gray300,
                true: `${color}50`,
              }}
              thumbColor={isEnabled ? color : isDark ? '#555' : '#f4f3f4'}
              disabled={disabled || loading}
              style={styles.switch}
            />
          ) : showArrow ? (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={disabled ? DS.gray400 : isDark ? DS.gray500 : DS.gray300}
            />
          ) : value ? (
            <Text style={[styles.menuValue, isDark && styles.textMuted]}>{value}</Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════════════════ */

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  color: string;
  isDark: boolean;
  onPress?: () => void;
}

const StatCard = React.memo<StatCardProps>(
  ({ icon, value, label, color, isDark, onPress }) => (
    <PressableScale onPress={onPress} activeScale={0.95} style={{ flex: 1 }}>
      <BlurView
        intensity={isDark ? 40 : 80}
        style={[styles.statCard, isDark && styles.statCardDark]}
        tint={isDark ? 'dark' : 'light'}
      >
        <View style={[styles.statIconWrap, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.statValue, isDark && styles.textLight]}>{value}</Text>
        <Text style={[styles.statLabel, isDark && styles.textMuted]}>{label}</Text>
      </BlurView>
    </PressableScale>
  )
);

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK ACTION
   ═══════════════════════════════════════════════════════════════════════════ */

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  isDark: boolean;
  onPress: () => void;
}

const QuickAction = React.memo<QuickActionProps>(
  ({ icon, label, color, isDark, onPress }) => (
    <PressableScale onPress={onPress} activeScale={0.9} style={styles.quickAction}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.quickActionLabel, isDark && styles.textMuted]}>{label}</Text>
    </PressableScale>
  )
);

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY MEMBER ITEM
   ═══════════════════════════════════════════════════════════════════════════ */

interface FamilyMemberProps {
  avatar?: string | number;
  name: string;
  label: string;
  color: string;
  isDark: boolean;
  onPress: () => void;
  badge?: React.ReactNode;
  isBaby?: boolean;
  gender?: 'boy' | 'girl' | 'other';
}

const FamilyMemberItem = React.memo<FamilyMemberProps>(({
  avatar,
  name,
  label,
  color,
  isDark,
  onPress,
  badge,
  isBaby = false,
  gender = 'other',
}) => (
  <PressableScale onPress={onPress} activeScale={0.92} style={styles.familyMember}>
    <View style={[styles.familyAvatarWrap, { borderColor: `${color}40` }]}>
      {isBaby ? (
        <SafeBabyAvatar avatar={avatar} gender={gender} size={48} showBadge={false} />
      ) : (
        <SafeAvatar
          avatar={avatar}
          size={48}
          fallbackIcon="person"
          fallbackColor={color}
          borderWidth={0}
        />
      )}
      {badge}
    </View>
    <Text style={[styles.familyName, isDark && styles.textLight]} numberOfLines={1}>
      {name}
    </Text>
    <Text style={[styles.familyLabel, isDark && styles.textMuted]}>{label}</Text>
  </PressableScale>
));

/* ═══════════════════════════════════════════════════════════════════════════
   BABY SELECTION MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

interface BabySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  babies: any[];
  currentBabyId: string | null;
  onSelectBaby: (baby: any) => void;
  onEditBaby: (baby: any) => void;
  isDark: boolean;
  primaryColor: string;
}

const BabySelectionModal = React.memo<BabySelectionModalProps>(({
  visible,
  onClose,
  babies,
  currentBabyId,
  onSelectBaby,
  onEditBaby,
  isDark,
  primaryColor,
}) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.modalBackdrop, backdropStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[styles.modalSheet, sheetStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 60 : 90}
            style={styles.modalSheetBlur}
            tint={isDark ? 'dark' : 'light'}
          >
          <View style={styles.modalHandle} />
          <View style={styles.modalSheetHeader}>
            <Text style={[styles.modalSheetTitle, isDark && styles.textLight]}>
              Select Baby Profile
            </Text>
            <PressableScale onPress={onClose} hapticType="light">
              <View style={[styles.modalCloseBtn, isDark && styles.modalCloseBtnDark]}>
                <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray900} />
              </View>
            </PressableScale>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalSheetContent}>
            {babies.map((baby) => {
              const isActive = baby.id === currentBabyId;
              return (
                <View key={baby.id} style={styles.babyOptionRow}>
                  <PressableScale
                    onPress={() => onSelectBaby(baby)}
                    activeScale={0.98}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={[
                        styles.babyOption,
                        isDark && styles.babyOptionDark,
                        isActive && [styles.babyOptionActive, { borderColor: primaryColor }],
                        isActive && isDark && styles.babyOptionActiveDark,
                      ]}
                    >
                      <SafeBabyAvatar avatar={baby.avatar} gender={baby.gender} size={52} />
                      <View style={styles.babyOptionInfo}>
                        <Text
                          style={[
                            styles.babyOptionName,
                            isDark && styles.textLight,
                            isActive && { color: primaryColor },
                          ]}
                        >
                          {baby.name}
                        </Text>
                        <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                          {baby.age || 'Age unknown'} · {baby.gender || 'Unknown'}
                        </Text>
                      </View>
                      {isActive ? (
                        <View style={[styles.activeCheck, { backgroundColor: primaryColor }]}>
                          <Ionicons name="checkmark" size={16} color={DS.white} />
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={isDark ? DS.gray500 : DS.gray300} />
                      )}
                    </View>
                  </PressableScale>

                  {/* Edit profile button — "the second option" */}
                  <PressableScale
                    onPress={() => onEditBaby(baby)}
                    activeScale={0.9}
                    hapticType="light"
                  >
                    <View
                      style={[
                        styles.babyEditBtn,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                      ]}
                    >
                      <Ionicons name="create-outline" size={18} color={primaryColor} />
                    </View>
                  </PressableScale>
                </View>
              );
            })}
          </ScrollView>
        </BlurView>
        ) : (
          <View style={[styles.modalSheetBlur, styles.modalSheetBlurAndroid, isDark && styles.modalSheetBlurAndroidDark]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalSheetHeader}>
              <Text style={[styles.modalSheetTitle, isDark && styles.textLight]}>
                Select Baby Profile
              </Text>
              <PressableScale onPress={onClose} hapticType="light">
                <View style={[styles.modalCloseBtn, isDark && styles.modalCloseBtnDark]}>
                  <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray900} />
                </View>
              </PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalSheetContent}>
              {babies.map((baby) => {
                const isActive = baby.id === currentBabyId;
                return (
                  <View key={baby.id} style={styles.babyOptionRow}>
                    <PressableScale
                      onPress={() => onSelectBaby(baby)}
                      activeScale={0.98}
                      style={{ flex: 1 }}
                    >
                      <View
                        style={[
                          styles.babyOption,
                          isDark && styles.babyOptionDark,
                          isActive && [styles.babyOptionActive, { borderColor: primaryColor }],
                          isActive && isDark && styles.babyOptionActiveDark,
                        ]}
                      >
                        <SafeBabyAvatar avatar={baby.avatar} gender={baby.gender} size={52} />
                        <View style={styles.babyOptionInfo}>
                          <Text
                            style={[
                              styles.babyOptionName,
                              isDark && styles.textLight,
                              isActive && { color: primaryColor },
                            ]}
                          >
                            {baby.name}
                          </Text>
                          <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                            {baby.age || 'Age unknown'} · {baby.gender || 'Unknown'}
                          </Text>
                        </View>
                        {isActive ? (
                          <View style={[styles.activeCheck, { backgroundColor: primaryColor }]}>
                            <Ionicons name="checkmark" size={16} color={DS.white} />
                          </View>
                        ) : (
                          <Ionicons name="chevron-forward" size={18} color={isDark ? DS.gray500 : DS.gray300} />
                        )}
                      </View>
                    </PressableScale>

                    <PressableScale
                      onPress={() => onEditBaby(baby)}
                      activeScale={0.9}
                      hapticType="light"
                    >
                      <View
                        style={[
                          styles.babyEditBtn,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                        ]}
                      >
                        <Ionicons name="create-outline" size={18} color={primaryColor} />
                      </View>
                    </PressableScale>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   AI LEARNING PROGRESS BAR
   ═══════════════════════════════════════════════════════════════════════════ */

interface AILearningProgressBarProps {
  stats: {
    totalSamples: number;
    learnedCount: number;
    partialCount: number;
    notStartedCount: number;
    healthScore: number;
  };
  isDark: boolean;
  primaryColor: string;
  onPress?: () => void;
}

const AILearningProgressBar = React.memo<AILearningProgressBarProps>(({
  stats,
  isDark,
  primaryColor,
  onPress,
}) => {
  const TOTAL_METRICS =
    stats.learnedCount + stats.partialCount + stats.notStartedCount || 14;

  const learnedPct = (stats.learnedCount / TOTAL_METRICS) * 100;
  const partialPct = (stats.partialCount / TOTAL_METRICS) * 100;

  const scoreColor =
    stats.healthScore >= 80
      ? DS.success
      : stats.healthScore >= 60
      ? DS.warning
      : stats.healthScore >= 40
      ? '#f97316'
      : DS.danger;

  const scoreLabel =
    stats.healthScore >= 80
      ? 'Excellent'
      : stats.healthScore >= 60
      ? 'Good'
      : stats.healthScore >= 40
      ? 'Fair'
      : 'Getting Started';

  const body = (
    <BlurView
      intensity={isDark ? 30 : 70}
      style={[styles.aiProgressCard, isDark && styles.aiProgressCardDark]}
      tint={isDark ? 'dark' : 'light'}
    >
      <View style={styles.aiProgressHeader}>
        <View style={styles.aiProgressTitleRow}>
          <View style={[styles.aiProgressIcon, { backgroundColor: `${scoreColor}18` }]}>
            <Ionicons name="sparkles" size={16} color={scoreColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.aiProgressTitle, isDark && styles.textLight]} numberOfLines={1}>
              AI Learning Progress
            </Text>
            <Text style={[styles.aiProgressSubtitle, isDark && styles.textMuted]} numberOfLines={1}>
              {stats.totalSamples === 0
                ? 'Start logging to train your AI'
                : `${stats.totalSamples} samples · ${stats.learnedCount}/${TOTAL_METRICS} metrics learned`}
            </Text>
          </View>
          <View style={[styles.aiScoreBadge, { backgroundColor: `${scoreColor}18` }]}>
            <Text style={[styles.aiScoreValue, { color: scoreColor }]}>{stats.healthScore}</Text>
            <Text style={[styles.aiScoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.aiProgressTrack,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
        ]}
      >
        <View
          style={[
            styles.aiProgressFillPartial,
            { width: `${partialPct}%`, backgroundColor: '#f59e0b60' },
          ]}
        />
        <View
          style={[
            styles.aiProgressFillLearned,
            { width: `${learnedPct}%`, backgroundColor: scoreColor },
          ]}
        />
      </View>

      <View style={styles.aiProgressLegend}>
        <View style={styles.aiLegendItem}>
          <View style={[styles.aiLegendDot, { backgroundColor: scoreColor }]} />
          <Text style={[styles.aiLegendText, isDark && styles.textMuted]}>
            {stats.learnedCount} learned
          </Text>
        </View>
        <View style={styles.aiLegendItem}>
          <View style={[styles.aiLegendDot, { backgroundColor: DS.warning }]} />
          <Text style={[styles.aiLegendText, isDark && styles.textMuted]}>
            {stats.partialCount} learning
          </Text>
        </View>
        <View style={styles.aiLegendItem}>
          <View
            style={[
              styles.aiLegendDot,
              { backgroundColor: isDark ? DS.gray700 : '#cbd5e1' },
            ]}
          />
          <Text style={[styles.aiLegendText, isDark && styles.textMuted]}>
            {stats.notStartedCount} pending
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray300} />
      </View>
    </BlurView>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} activeScale={0.98} hapticType="light">
        {body}
      </PressableScale>
    );
  }
  return body;
});

/* ═══════════════════════════════════════════════════════════════════════════
   PROFILE HEADER (Family Scroll)
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProfileHeaderProps {
  navigation: any;
  isDark: boolean;
  userProfile: any;
  babies: any[];
  currentBaby: any;
  currentBabyId: string | null;
  parent2Profile: FamilyMember | null;
  guardians: FamilyMember[];
  stats: { entries: number; streak: number; milestones: number };
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  /** All family members for the current baby. Used to resolve my
   *  effective role for the "You" chip. */
  members?: any[];
}

const ProfileHeader = React.memo<ProfileHeaderProps>(({
  navigation,
  isDark,
  userProfile,
  babies,
  currentBaby,
  parent2Profile,
  guardians,
  stats,
  primaryColor,
  secondaryColor,
  accentColor,
  members = [],
}) => {
  const safeBabies = babies || [];
  const hasMultipleBabies = safeBabies.length > 1;
  const { triggerHaptic, hapticFeedback } = useCustomization();

  const handleBabyPress = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    // Tap on the baby chip = "show me THIS baby's profile", not
    // "switch babies". The SwitchBaby affordance lives on the
    // dedicated "Switch Active Baby" row below and in the sticky
    // header avatar. Baby chips always open the editor for the
    // current baby so the interaction is predictable.
    const targetBaby = currentBaby || (safeBabies.length > 0 ? safeBabies[0] : null);
    if (targetBaby?.id) {
      navigation.navigate('EditProfile', { mode: 'baby', babyId: targetBaby.id });
      return;
    }
    navigation.navigate('CreateBabyProfile');
  }, [safeBabies, currentBaby, hapticFeedback, triggerHaptic, navigation]);

  const handleCurrentUserPress = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    const meId = userProfile?.id || userProfile?.uid;
    if (!meId) {
      // Auth hasn't hydrated — fall back to the dashboard.
      navigation.navigate('Main');
      return;
    }

    // Resolve MY role for the CURRENT baby so a Parent1-on-Baby-A /
    // Guardian-on-Baby-B user lands on the right editor. Mirrors
    // HomeScreen.handleEditMyProfile.
    const myMemberRow =
      members.find((m: any) => m.userId === meId) ||
      members.find((m: any) => m.id === meId) ||
      null;
    const rawRole = String(myMemberRow?.role || '').toLowerCase();
    const myRoleForBaby: string =
      rawRole ||
      (currentBaby?.parent1Id === meId
        ? 'parent1'
        : currentBaby?.parent2Id === meId
        ? 'parent2'
        : 'guardian');

    // Three-way edit mode so viewers/guardians land in the right
    // guard level in EditGuardianScreen (which distinguishes
    // 'guardian' and 'viewer' internally).
    const editMode: 'parent2' | 'guardian' | 'viewer' =
      myRoleForBaby === 'parent1' || myRoleForBaby === 'parent2'
        ? 'parent2'
        : myRoleForBaby === 'viewer'
        ? 'viewer'
        : 'guardian';

    // Always open YOUR OWN profile — pass the profile UUID so the
    // guard logic inside EditGuardianScreen recognises it's the
    // current user and enables self-editing.
    navigation.navigate('EditGuardian', {
      guardianId: meId,
      mode: editMode,
      fromChat: false,
      fromFamily: true,
    });
  }, [
    userProfile,
    hapticFeedback,
    triggerHaptic,
    navigation,
    members,
    currentBaby?.parent1Id,
    currentBaby?.parent2Id,
  ]);

  const handleParent2Press = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    if (parent2Profile) {
      // Prefer `userId` (profile UUID) over `id` (family_members row id)
      // because EditGuardianScreen resolves members by `userId` first.
      // Falling back to `id` keeps legacy / orphaned rows reachable.
      const targetId =
        (parent2Profile as any).userId || parent2Profile.id;
      navigation.navigate('EditGuardian', {
        guardianId: targetId,
        mode: 'parent2',
        fromChat: false,
        fromFamily: true,
      });
    } else {
      navigation.navigate('CoParentInviteScreen');
    }
  }, [parent2Profile, hapticFeedback, triggerHaptic, navigation]);

  const handleGuardianPress = useCallback(
    (guardian: FamilyMember) => {
      if (hapticFeedback) triggerHaptic('light').catch(() => {});
      // `EditGuardianScreen` looks members up by `userId` first, then
      // `id`. Pass `userId` when available so the profile screen
      // always resolves to the correct person, even if their
      // `family_members.id` has been re-created by a re-invite.
      const targetId = (guardian as any).userId || guardian.id;
      if (!targetId) {
        // No identifier at all — fall back to the family view.
        navigation.navigate('FamilySharing');
        return;
      }
      navigation.navigate('EditGuardian', {
        guardianId: targetId,
        mode: 'guardian',
        fromChat: false,
        fromFamily: true,
      });
    },
    [hapticFeedback, triggerHaptic, navigation]
  );

  return (
    <View style={styles.familySection}>
      <View style={styles.familySectionHeader}>
        <Text style={[styles.familySectionTitle, isDark && styles.textMuted]}>FAMILY</Text>
        <View style={[styles.familyCountBadge, { backgroundColor: `${primaryColor}15` }]}>
          <Text style={[styles.familyCountText, { color: primaryColor }]}>
            {safeBabies.length + (parent2Profile ? 1 : 0) + (guardians?.length || 0)}
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.familyScroll}
      >
        <FamilyMemberItem
          avatar={userProfile?.avatar}
          name="You"
          label="Parent"
          color={primaryColor}
          isDark={isDark}
          onPress={handleCurrentUserPress}
          badge={
            <View
              style={[
                styles.onlineIndicator,
                {
                  backgroundColor: accentColor,
                  borderColor: isDark ? DS.darkSurface : DS.white,
                },
              ]}
            />
          }
        />

        <FamilyMemberItem
          avatar={currentBaby?.avatar}
          name={currentBaby?.name || 'Baby'}
          label="Baby"
          color={secondaryColor}
          isDark={isDark}
          onPress={handleBabyPress}
          isBaby={true}
          gender={currentBaby?.gender}
          badge={
            hasMultipleBabies ? (
              <View style={[styles.babyCountBadge, { backgroundColor: primaryColor }]}>
                <Text style={styles.babyCountText}>{safeBabies.length}</Text>
              </View>
            ) : undefined
          }
        />

        {parent2Profile && (
          <FamilyMemberItem
            avatar={parent2Profile?.avatar}
            name={parent2Profile?.fullName || 'Co-Parent'}
            label="Co-Parent"
            color="#11998e"
            isDark={isDark}
            onPress={handleParent2Press}
          />
        )}

        {guardians?.map((guardian, index) => (
          <FamilyMemberItem
            key={guardian.id || index}
            avatar={guardian?.avatar}
            name={guardian.fullName || 'Guardian'}
            label="Guardian"
            color="#9b59b6"
            isDark={isDark}
            onPress={() => handleGuardianPress(guardian)}
          />
        ))}

        <FamilyMemberItem
          avatar={undefined}
          name="Add"
          label="Member"
          color={primaryColor}
          isDark={isDark}
          onPress={() => navigation.navigate('FamilySharing')}
          badge={
            <View style={[styles.addBadge, isDark && styles.addBadgeDark]}>
              <Ionicons name="add" size={16} color={primaryColor} />
            </View>
          }
        />
      </ScrollView>

      {/* Quick actions row */}
      <View style={styles.quickActionsRow}>
        <QuickAction
          icon="person-outline"
          label="Profile"
          color={primaryColor}
          isDark={isDark}
          onPress={handleCurrentUserPress}
        />
        <QuickAction
          icon="heart-outline"
          label="Baby"
          color={secondaryColor}
          isDark={isDark}
          onPress={handleBabyPress}
        />
        <QuickAction
          icon="people-outline"
          label="Family"
          color="#11998e"
          isDark={isDark}
          // Quick action from the MoreScreen profile row → the family
          // OVERVIEW (Profile / FamilyDashboard). Not the management hub.
          onPress={() => navigation.navigate('Profile')}
        />
        <QuickAction
          icon="notifications-outline"
          label="Alerts"
          color={DS.warning}
          isDark={isDark}
          onPress={() => navigation.navigate('TrackerReminders')}
        />
      </View>

      {/* Switch baby */}
      {hasMultipleBabies && (
        <PressableScale
          onPress={() =>
            navigation.navigate('SwitchBaby', { returnTo: 'Main', returnLabel: 'Settings' })
          }
          activeScale={0.98}
        >
          <View style={styles.switchBabyRow}>
            <View style={[styles.switchBabyIcon, { backgroundColor: `${primaryColor}12` }]}>
              <Ionicons name="swap-horizontal" size={16} color={primaryColor} />
            </View>
            <Text style={[styles.switchBabyText, { color: primaryColor }]}>
              Switch Active Baby
            </Text>
            <View style={[styles.switchBabyBadge, { backgroundColor: primaryColor }]}>
              <Text style={styles.switchBabyBadgeText}>{safeBabies.length}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={primaryColor} />
          </View>
        </PressableScale>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function MoreScreen({ navigation, route }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();

  // ─── Contexts ────────────────────────────────────────────────────
  const { signOut, userProfile } = useAuth();
  const { babies, currentBaby, currentBabyId, getBabyStats, loadBabies, switchBaby } = useBaby();
  const {
    settings: securitySettings,
    isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    toggleBiometric,
    toggleAppLock,
    updateAutoLockTimeout,
    lockApp,
    getAvailableAuthMethods,
    getBiometricTypeName,
    getBiometricIcon,
    refreshBiometricStatus,
    readBiometricEnabledFromStorage,
    rehydratePinStatus,
  } = useSecurity();
  const { profile: userContextProfile } = useUser();
  const { guardians, parent2: parent2Profile, members: familyMembersAll } = useFamily();
  const { entries, loadEntries } = useActivity();
  const tracker = useTracker();
  const refreshTrackerEntries = tracker?.refreshEntries;
  const {
    themeColors,
    fullThemeColors,
    isDark: customizationIsDark,
    triggerHaptic,
    hapticFeedback,
  } = useCustomization();

  const { isConnected } = useSupabase();
  const { sync, isSyncing, getQueueStatus } = useOfflineSync();
  const sweetAlert = useSweetAlert();

  // ─── State ──────────────────────────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['security', 'preferences', 'family'])
  );
  const [showBabyModal, setShowBabyModal] = useState(false);
  const [collaborativeEnabled, setCollaborativeEnabled] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const [aiStats, setAiStats] = useState<{
    totalSamples: number;
    learnedCount: number;
    partialCount: number;
    notStartedCount: number;
    healthScore: number;
  }>({
    totalSamples: 0,
    learnedCount: 0,
    partialCount: 0,
    notStartedCount: 0,
    healthScore: 0,
  });

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>(null);
  const [localBiometricEnabled, setLocalBiometricEnabled] = useState<boolean>(false);

  // ─── Refs ──────────────────────────────────────────────────────
  const scrollY = useSharedValue(0);
  const isMounted = useRef(true);
  const focusLoadTimeout = useRef<NodeJS.Timeout | null>(null);
  const biometricToggleLockRef = useRef(false);
  const hasHydratedFromServerRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ─── Computed ──────────────────────────────────────────────────
  const isDark = customizationIsDark;
  const primary = themeColors?.primary || DS.primary;
  const secondary = themeColors?.secondary || DS.accent;
  const accent = themeColors?.accent || DS.success;

  const safeBabies = babies || [];
  const availableMethods = getAvailableAuthMethods();
  const biometricTypeName = getBiometricTypeName();
  const biometricIcon = getBiometricIcon();

  const bioEnabled = localBiometricEnabled;
  const hasHardware = isBiometricHardwareAvailable || false;
  const isEnrolled = isBiometricEnrolled || false;
  const biometricAvailable = hasHardware && isEnrolled;

  const babyStats = currentBaby
    ? getBabyStats()
    : { streak: 0, milestones: 0, photos: 0, entries: 0 };

  // `entries` from ActivityContext is already baby-scoped (see FIX #3),
  // so this length is guaranteed to belong to the current baby.
  // `streak` and `milestones` now come from the real `BabyProfile`
  // fields, not the old hardcoded-zero `getBabyStats` stub.
  const activityStats = useMemo(() => ({
    entries: Array.isArray(entries) ? entries.length : 0,
    streak: babyStats.streak || 0,
    milestones: babyStats.milestones || 0,
  }), [entries, babyStats.streak, babyStats.milestones]);

  const bgColors = useMemo(() => {
    if (isDark) {
      return [
        fullThemeColors?.background || DS.darkBg,
        '#0c0c18',
        '#12121e',
      ];
    }
    return [
      fullThemeColors?.background || DS.gray50,
      '#eef0f5',
      '#e4e8f0',
    ];
  }, [isDark, fullThemeColors]);

  // ─── Load AI stats ─────────────────────────────────────────────
  const loadAIStats = useCallback(async () => {
    if (!currentBaby?.id) return;
    try {
      const { getAllLearnedRanges } = await import('../../services/ai/BayesianEngine');

      const METRICS = [
        'temperature_c', 'feeding_ml', 'feed_interval_min',
        'sleep_duration_min', 'sleep_interval_min', 'diaper_interval_min',
        'weight_kg', 'height_cm', 'head_cm', 'mood_score',
        'heart_rate_bpm', 'blood_oxygen', 'poop_interval_hr', 'wake_window_min',
      ] as const;

      const LEARNED = 15;
      const PARTIAL = 5;

      const ranges = await getAllLearnedRanges(currentBaby.id, METRICS as any);

      let totalSamples = 0;
      let learnedCount = 0;
      let partialCount = 0;
      let notStartedCount = 0;
      let confidenceSum = 0;

      ranges.forEach((r) => {
        const n = r?.samples || 0;
        totalSamples += n;
        confidenceSum += r?.confidence || 0;
        if (n >= LEARNED) learnedCount++;
        else if (n >= PARTIAL) partialCount++;
        else notStartedCount++;
      });

      const avgConfidence = ranges.length > 0 ? confidenceSum / ranges.length : 0;
      const learningProgress = (learnedCount / METRICS.length) * 60;
      const confidenceScore = avgConfidence * 30;
      const sampleScore = Math.min(10, (totalSamples / 200) * 10);
      const healthScore = Math.round(learningProgress + confidenceScore + sampleScore);

      if (isMounted.current) {
        setAiStats({
          totalSamples,
          learnedCount,
          partialCount,
          notStartedCount,
          healthScore,
        });
      }
    } catch (err) {
      if (__DEV__) console.warn('[MoreScreen] loadAIStats failed:', err);
    }
  }, [currentBaby?.id]);

  // ─── Helpers ───────────────────────────────────────────────────
  const formatTimeout = useCallback((minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, []);

  const handleAutoLockTimeout = useCallback(() => {
    if (!securitySettings.isAppLockEnabled) {
      sweetAlert.warning('Enable App Lock First', 'Turn on Auto-Lock App to set a timeout');
      return;
    }
    setShowTimeoutModal(true);
  }, [securitySettings.isAppLockEnabled, sweetAlert]);

  const toggleSection = useCallback(
    (section: string) => {
      if (hapticFeedback) triggerHaptic('light').catch(() => {});
      setExpandedSections((prev) => {
        const next = new Set(prev);
        if (next.has(section)) next.delete(section);
        else next.add(section);
        return next;
      });
    },
    [hapticFeedback, triggerHaptic]
  );

  // ─── Handlers ──────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadBabies(),
        // Refresh entries through the TRACKER, not the BabyContext stub.
        // The tracker's refresh is the one that actually re-queries
        // Supabase with the current baby_id filter — meaning a user
        // switching between accounts or babies will only ever see the
        // active baby's entries.
        refreshTrackerEntries?.().catch(() => {}),
        refreshBiometricStatus(),
        loadAIStats(),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, refreshTrackerEntries, refreshBiometricStatus, loadAIStats]);

  const handleLogout = useCallback(async () => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setShowLogoutModal(false);
    try {
      triggerHaptic('medium');
      await AsyncStorage.setItem('littleloom_security_lock', 'false');
      await AsyncStorage.multiRemove([
        'littleloom_nav_state_v4',
        '@littleloom_nav_state_v4',
        'littleloom_last_auth_state',
        'littleloom_security_lock',
      ]);
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as never }],
      });
      sweetAlert.success('Signed Out', 'You have been signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' as never }],
        });
      } catch (navError) {
        console.error('Navigation reset error:', navError);
      }
      sweetAlert.error('Error', 'Failed to sign out. Please try again.');
    }
  }, [signOut, triggerHaptic, navigation, sweetAlert]);

  const handleSync = useCallback(async () => {
    if (isSyncing) {
      sweetAlert.info('Sync in Progress', 'Please wait for the current sync to complete.');
      return;
    }

    setSyncStatus('syncing');
    try {
      const result = await sync();
      if (result.success) {
        setSyncStatus('success');
        triggerHaptic('success');

        try {
          const uid = userProfile?.id;
          if (uid) {
            backupService.setUserId(uid);
            const backupResult = await createBackup({
              encrypted: false,
              includePhotos: true,
            });
            if (backupResult.success) {
              console.log('✅ Backup created successfully:', backupResult.filePath);
            } else {
              console.warn('⚠️ Backup failed:', backupResult.error);
            }
          }
        } catch (backupError) {
          console.warn('Backup creation error (non-critical):', backupError);
        }

        sweetAlert.success('✅ Synced!', 'Your data is now in sync with the cloud');
      } else {
        setSyncStatus('error');
        sweetAlert.warning('⚠️ Sync Issue', 'Some items failed to sync. They will be retried.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      sweetAlert.error('❌ Sync Failed', 'Could not sync data. Please try again.');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [isSyncing, sync, triggerHaptic, sweetAlert, userProfile?.id]);

  // ─── Biometric toggle ──────────────────────────────────────────
  const handleBiometricToggle = useCallback(
    async (enabled: boolean) => {
      if (biometricToggleLockRef.current) return;
      biometricToggleLockRef.current = true;

      try {
        if (enabled) {
          let hasHardwareNow = false;
          let isEnrolledNow = false;
          try {
            const LocalAuth = require('expo-local-authentication');
            hasHardwareNow = await LocalAuth.hasHardwareAsync();
            isEnrolledNow = await LocalAuth.isEnrolledAsync();
          } catch {}

          if (!hasHardwareNow) {
            setLocalBiometricEnabled(false);
            sweetAlert.warning(
              'Biometric Not Available',
              'This device does not support biometric authentication. You can use PIN instead.'
            );
            return;
          }

          if (!isEnrolledNow) {
            setLocalBiometricEnabled(false);
            sweetAlert.confirm(
              'Biometric Not Enrolled',
              'No fingerprints or Face ID are enrolled on this device. Set them up in device settings, then come back.',
              () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('App-Prefs:Face ID & Passcode');
                } else {
                  Linking.openSettings();
                }
              },
              () => {},
              'Open Settings',
              'Cancel',
              false
            );
            return;
          }

          const ok = await toggleBiometric(true);
          const storedAfter = await readBiometricEnabledFromStorage();
          if (ok && storedAfter) {
            setLocalBiometricEnabled(true);
            await refreshBiometricStatus();
            triggerHaptic('success');
            sweetAlert.success(
              `${biometricTypeName} Enabled`,
              'You can now unlock LittleLoom with biometrics.'
            );
          } else {
            setLocalBiometricEnabled(storedAfter);
          }
        } else {
          setShowBiometricModal(true);
        }
      } catch (err) {
        console.error('[MoreScreen] handleBiometricToggle error:', err);
        try {
          const stored = await readBiometricEnabledFromStorage();
          setLocalBiometricEnabled(stored);
        } catch {
          setLocalBiometricEnabled(false);
        }
        sweetAlert.error('Error', 'Could not update biometric setting.');
      } finally {
        setTimeout(() => {
          biometricToggleLockRef.current = false;
        }, 500);
      }
    },
    [
      toggleBiometric,
      refreshBiometricStatus,
      biometricTypeName,
      triggerHaptic,
      sweetAlert,
      readBiometricEnabledFromStorage,
    ]
  );

  const confirmDisableBiometric = useCallback(async () => {
    setShowBiometricModal(false);
    if (biometricToggleLockRef.current) {
      return;
    }
    biometricToggleLockRef.current = true;

    try {
      const ok = await toggleBiometric(false);
      const storedAfter = await readBiometricEnabledFromStorage();

      if (ok && !storedAfter) {
        setLocalBiometricEnabled(false);
        await refreshBiometricStatus();
        triggerHaptic('success');
        sweetAlert.success('Biometric Disabled', 'Biometric authentication has been turned off.');
      } else {
        setLocalBiometricEnabled(storedAfter);
        if (storedAfter) {
          sweetAlert.error('Error', 'Could not disable biometric authentication.');
        } else {
          triggerHaptic('success');
          sweetAlert.success('Biometric Disabled', 'Biometric authentication has been turned off.');
        }
      }
    } catch (error) {
      console.error('Disable biometric error:', error);
      try {
        const stored = await readBiometricEnabledFromStorage();
        setLocalBiometricEnabled(stored);
      } catch {
        setLocalBiometricEnabled(false);
      }
      sweetAlert.error('Error', 'An error occurred while disabling biometric authentication.');
    } finally {
      setTimeout(() => { biometricToggleLockRef.current = false; }, 500);
    }
  }, [
    toggleBiometric,
    refreshBiometricStatus,
    triggerHaptic,
    sweetAlert,
    readBiometricEnabledFromStorage,
  ]);

  const cancelDisableBiometric = useCallback(async () => {
    setShowBiometricModal(false);
    try {
      const stored = await readBiometricEnabledFromStorage();
      setLocalBiometricEnabled(stored);
    } catch {
      setLocalBiometricEnabled(isBiometricEnabled ?? false);
    }
  }, [readBiometricEnabledFromStorage, isBiometricEnabled]);

  const handlePinSetup = useCallback(() => {
    navigation.navigate('SecurityCenter', { mode: 'setup' });
  }, [navigation]);

  const handleLockNow = useCallback(async () => {
    const hasPinFresh = await rehydratePinStatus();
    const storedBio = await readBiometricEnabledFromStorage();

    const hasAnySecurity =
      hasPinFresh ||
      (storedBio && biometricAvailable) ||
      securitySettings.isAppLockEnabled;

    if (!hasAnySecurity) {
      setShowSecurityModal(true);
      return;
    }

    try {
      await lockApp();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sweetAlert.success('🔒 App Locked', 'LittleLoom has been secured.');
      navigation.navigate('SecurityLock');
    } catch (error) {
      console.error('Lock error:', error);
      sweetAlert.error('Error', 'Could not lock the app. Please try again.');
    }
  }, [
    rehydratePinStatus,
    readBiometricEnabledFromStorage,
    securitySettings.isAppLockEnabled,
    biometricAvailable,
    lockApp,
    navigation,
    sweetAlert,
  ]);

  const handleSelectTimeout = useCallback(
    async (minutes: number) => {
      setShowTimeoutModal(false);
      try {
        await updateAutoLockTimeout(minutes);
        sweetAlert.success('Timeout Updated', `Auto-lock set to ${formatTimeout(minutes)}`);
      } catch (err) {
        sweetAlert.error('Update Failed', 'Could not update auto-lock timeout.');
      }
    },
    [updateAutoLockTimeout, formatTimeout, sweetAlert]
  );

  const handleSelectBabyFromModal = useCallback(
    async (baby: any) => {
      setShowBabyModal(false);
      // Only switch if it's a different baby
      if (baby.id !== currentBabyId) {
        try {
          await switchBaby(baby.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
          console.error('[MoreScreen] switchBaby failed:', err);
          sweetAlert.error('Switch Failed', 'Could not switch to the selected baby.');
        }
      }
    },
    [currentBabyId, switchBaby, sweetAlert]
  );

  const handleEditBabyFromModal = useCallback(
    (baby: any) => {
      setShowBabyModal(false);
      navigation.navigate('EditProfile', { mode: 'baby', babyId: baby.id });
    },
    [navigation]
  );

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out LittleLoom - the best baby tracking app! 🍼\n\nI've been tracking ${currentBaby?.name || 'my baby'}'s milestones and activities. Join me!`,
        title: 'LittleLoom Baby Tracker',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [currentBaby]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ─── Effects ───────────────────────────────────────────────────

  const prevCtxBioRef = useRef(isBiometricEnabled);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (biometricToggleLockRef.current) return;
      try {
        const stored = await readBiometricEnabledFromStorage();
        if (mounted && !biometricToggleLockRef.current) {
          setLocalBiometricEnabled(stored);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [readBiometricEnabledFromStorage, isBiometricEnabled]);

  useEffect(() => {
    if (prevCtxBioRef.current === isBiometricEnabled) return;
    prevCtxBioRef.current = isBiometricEnabled;

    if (biometricToggleLockRef.current) return;

    (async () => {
      try {
        const stored = await readBiometricEnabledFromStorage();
        if (!biometricToggleLockRef.current) {
          setLocalBiometricEnabled(stored);
        }
      } catch {}
    })();
  }, [isBiometricEnabled, readBiometricEnabledFromStorage]);

  useEffect(() => {
    if (hasHydratedFromServerRef.current) return;
    hasHydratedFromServerRef.current = true;

    (async () => {
      try {
        const userId = userProfile?.id;
        if (!userId) return;
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'biometric_enabled')
          .eq('user_id', userId)
          .maybeSingle();
        if (data?.value === 'true' || data?.value === 'false') {
          const serverValue = data.value === 'true';
          if (!biometricToggleLockRef.current) {
            setLocalBiometricEnabled(serverValue);
          }
        }
      } catch {}
    })();
  }, [userProfile?.id]);

  useEffect(() => {
    const { AppState } = require('react-native');
    const sub = AppState.addEventListener('change', async (state: string) => {
      if (state === 'active') {
        try {
          const { flushCohortQueue, getCohortQueueSize } = await import(
            '../../services/ai/CohortOfflineQueue'
          );
          if ((await getCohortQueueSize()) > 0) {
            await flushCohortQueue();
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    import('../../services/ai/CohortPriors')
      .then(({ isCollaborativeLearningEnabled }) => isCollaborativeLearningEnabled())
      .then(setCollaborativeEnabled)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAIStats();
  }, [loadAIStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshBiometricStatus().catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [refreshBiometricStatus]);

  useFocusEffect(
    useCallback(() => {
      if (focusLoadTimeout.current) clearTimeout(focusLoadTimeout.current);
      focusLoadTimeout.current = setTimeout(async () => {
        loadBabies();
        // Prefer the tracker's entry refresh (it's baby-scoped and
        // re-queries Supabase with `baby_id = current`). Fall back to
        // the legacy `loadEntries` no-op if the tracker isn't mounted.
        if (typeof refreshTrackerEntries === 'function') {
          refreshTrackerEntries().catch(() => {});
        } else {
          loadEntries?.();
        }
        await Promise.all([
          refreshBiometricStatus(),
          rehydratePinStatus(),
        ]);
        if (!biometricToggleLockRef.current) {
          try {
            const stored = await readBiometricEnabledFromStorage();
            setLocalBiometricEnabled(stored);
          } catch {}
        }
        loadAIStats();
      }, 300);

      return () => {
        if (focusLoadTimeout.current) clearTimeout(focusLoadTimeout.current);
      };
    }, [
      loadBabies,
      loadEntries,
      refreshTrackerEntries,
      refreshBiometricStatus,
      rehydratePinStatus,
      readBiometricEnabledFromStorage,
      loadAIStats,
    ])
  );

  useEffect(() => {
    if (route.params?.babySwitched) {
      loadBabies();
      navigation.setParams({ babySwitched: undefined });
    }
  }, [route.params?.babySwitched, loadBabies, navigation]);

  // ═══════════════════════════════════════════════════════════════
  // SECTION RENDERERS
  // ═══════════════════════════════════════════════════════════════

  const renderSecuritySection = useCallback(() => {
    const isExpanded = expandedSections.has('security');
    const bioAvailable = biometricAvailable;

    return (
      <Animated.View
        entering={FadeInUp.delay(100)}
        layout={Layout.springify()}
        style={styles.section}
      >
        <SectionHeader
          icon="shield-checkmark"
          title="Security & Privacy"
          subtitle={
            bioEnabled
              ? `${biometricTypeName} unlock is ON`
              : bioAvailable
              ? `${biometricTypeName} available — tap to enable`
              : 'Protect your data'
          }
          color={primary}
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('security')}
        />
        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon={biometricIcon as any}
              title={`${biometricTypeName} Unlock`}
              subtitle={
                bioEnabled
                  ? 'Enabled'
                  : bioAvailable
                  ? 'Tap to enable'
                  : 'Not Available'
              }
              isEnabled={bioEnabled}
              onToggle={(val) => {
                if (!bioAvailable && !bioEnabled) {
                  sweetAlert.warning(
                    'Biometric Not Available',
                    'Set up biometrics in your device settings first.'
                  );
                  return;
                }
                handleBiometricToggle(val);
              }}
              color={primary}
              isDark={isDark}
            />
            <MenuItem
              icon="key-outline"
              title="Unlock Methods"
              subtitle={
                securitySettings.isPinEnabled
                  ? 'PIN active · manage locks'
                  : 'Set up PIN or biometrics'
              }
              onPress={handlePinSetup}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="lock-closed"
              title="Auto-Lock App"
              subtitle={
                securitySettings.isAppLockEnabled
                  ? `After ${formatTimeout(securitySettings.autoLockTimeout)}`
                  : 'Disabled'
              }
              isEnabled={securitySettings.isAppLockEnabled}
              onToggle={async (val) => {
                try {
                  if (val && !securitySettings.isPinEnabled && !bioEnabled) {
                    sweetAlert.warning(
                      'Set Up Security First',
                      'Enable a PIN or biometric lock before turning on auto-lock.'
                    );
                    return;
                  }
                  await toggleAppLock(val);
                  triggerHaptic(val ? 'success' : 'light');
                } catch (err) {
                  console.error('[MoreScreen] toggleAppLock failed:', err);
                  sweetAlert.error('Error', 'Could not update auto-lock.');
                }
              }}
              color={accent}
              isDark={isDark}
            />
            <MenuItem
              icon="time"
              title="Lock Timeout"
              value={formatTimeout(securitySettings.autoLockTimeout)}
              onPress={handleAutoLockTimeout}
              color={DS.warning}
              isDark={isDark}
              showArrow
              disabled={!securitySettings.isAppLockEnabled}
            />
            <MenuItem
              icon="lock-closed-outline"
              title="Lock Now"
              subtitle="Immediately lock the app"
              onPress={handleLockNow}
              color={DS.danger}
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [
    expandedSections,
    securitySettings,
    biometricTypeName,
    biometricIcon,
    biometricAvailable,
    bioEnabled,
    isBiometricEnabled,
    primary,
    secondary,
    accent,
    isDark,
    toggleSection,
    handleBiometricToggle,
    handlePinSetup,
    toggleAppLock,
    formatTimeout,
    handleAutoLockTimeout,
    handleLockNow,
    sweetAlert,
    triggerHaptic,
  ]);

  const renderPreferencesSection = useCallback(() => {
    const isExpanded = expandedSections.has('preferences');
    return (
      <Animated.View
        entering={FadeInUp.delay(150)}
        layout={Layout.springify()}
        style={styles.section}
      >
        <SectionHeader
          icon="options"
          title="Preferences"
          subtitle="AI learning, notifications, themes"
          color="#11998e"
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('preferences')}
        />
        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <AILearningStatus />
            <AILearningProgressBar
              stats={aiStats}
              isDark={isDark}
              primaryColor={primary}
              onPress={() => {
                triggerHaptic('light');
                navigation.navigate('AIManagement');
              }}
            />
            <MenuItem
              icon="sparkles-outline"
              title="AI Learning Management"
              subtitle="View what the AI has learned · manage privacy"
              onPress={() => navigation.navigate('AIManagement')}
              color="#8b5cf6"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="people-circle-outline"
              title="Collaborative AI Learning"
              subtitle={
                collaborativeEnabled
                  ? 'Sharing anonymized patterns with other families'
                  : 'Off — your data stays on this device'
              }
              isEnabled={collaborativeEnabled}
              onToggle={async (val) => {
                try {
                  const { setCollaborativeLearningEnabled } = await import(
                    '@/services/ai/CohortPriors'
                  );
                  await setCollaborativeLearningEnabled(val);
                  setCollaborativeEnabled(val);
                  triggerHaptic(val ? 'success' : 'light');

                  if (val && currentBaby?.id) {
                    const { bootstrapAI } = await import('@/services/ai/bootstrap');
                    bootstrapAI(currentBaby.id, true).catch((err) => {
                      if (__DEV__)
                        console.warn('[MoreScreen] bootstrapAI after toggle failed:', err);
                    });
                    sweetAlert.success(
                      'Collaborative AI Enabled',
                      'Thanks for contributing. Your anonymized patterns will help other families.'
                    );
                  } else if (!val) {
                    sweetAlert.info(
                      'Collaborative AI Disabled',
                      'Your patterns are no longer being shared.'
                    );
                  }
                } catch (err) {
                  console.error('[MoreScreen] Failed to toggle collaborative learning:', err);
                  sweetAlert.error('Error', 'Could not update the setting. Please try again.');
                  setCollaborativeEnabled(!val);
                }
              }}
              color="#8b5cf6"
              isDark={isDark}
            />
            <MenuItem
              icon="notifications"
              title="Notifications"
              subtitle="Manage push notifications"
              onPress={() => navigation.navigate('TrackerReminders')}
              color="#4facfe"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="color-palette"
              title="Customize App"
              subtitle="Themes, avatars, appearance"
              onPress={() => navigation.navigate('Customize')}
              color="#9b59b6"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="language"
              title="Language"
              value="English (US)"
              onPress={() => navigation.navigate('LanguageSettings')}
              color="#fa8231"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="bar-chart"
              title="Units"
              value="Metric (kg, cm)"
              onPress={() => navigation.navigate('UnitSettings')}
              color="#5f27cd"
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [
    expandedSections,
    isDark,
    toggleSection,
    navigation,
    aiStats,
    primary,
    triggerHaptic,
    collaborativeEnabled,
    currentBaby,
    sweetAlert,
  ]);

  const renderFamilySection = useCallback(() => {
    const isExpanded = expandedSections.has('family');
    const queueStatus = getQueueStatus();
    return (
      <Animated.View
        entering={FadeInUp.delay(200)}
        layout={Layout.springify()}
        style={styles.section}
      >
        <SectionHeader
          icon="people"
          title="Family & Sharing"
          subtitle={`${guardians?.length || 0} guardians connected`}
          color={secondary}
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('family')}
          badge={guardians?.length || undefined}
        />
        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="people-outline"
              title="Family Dashboard"
              subtitle="Overview of everyone in the family"
              // "Family Dashboard" is the OVERVIEW screen (`Profile`).
              // Per-person taps inside that screen go to EditGuardian.
              // Invite / tree / transfer actions live in FamilySharing —
              // which is reachable from the dashboard's "Manage" affordance
              // and from the standalone menu item below.
              onPress={() => navigation.navigate('Profile')}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="settings-outline"
              title="Manage Family"
              subtitle="Invites, roles, and family tree"
              onPress={() => navigation.navigate('FamilySharing')}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="person-add"
              title="Invite Co-Parent"
              subtitle="Generate an invite code for family members"
              onPress={() => navigation.navigate('CoParentInviteScreen')}
              color="#11998e"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="share-outline"
              title="Export Data"
              subtitle="Backup and restore your data"
              onPress={() => navigation.navigate('BackupRestore')}
              color={accent}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="cloud-upload"
              title="Sync with Cloud"
              subtitle={isConnected ? `${queueStatus.pending} pending` : 'Offline mode'}
              onPress={handleSync}
              color="#3b82f6"
              isDark={isDark}
              loading={isSyncing}
              value={
                syncStatus === 'success'
                  ? '✓ Synced'
                  : syncStatus === 'error'
                  ? '✗ Failed'
                  : isConnected
                  ? `🔄 ${queueStatus.pending}`
                  : '📴 Offline'
              }
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [
    expandedSections,
    guardians,
    secondary,
    accent,
    isDark,
    toggleSection,
    navigation,
    isConnected,
    isSyncing,
    syncStatus,
    handleSync,
    getQueueStatus,
  ]);

  const renderTrackingSection = useCallback(() => {
    const isExpanded = expandedSections.has('tracking');
    return (
      <Animated.View
        entering={FadeInUp.delay(250)}
        layout={Layout.springify()}
        style={styles.section}
      >
        <SectionHeader
          icon="analytics"
          title="Tracking & Insights"
          subtitle="Growth, achievements, history"
          color="#4facfe"
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('tracking')}
        />
        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="trophy-outline"
              title="Achievements"
              subtitle="View your parenting milestones"
              onPress={() => navigation.navigate('Achievements')}
              color={DS.warning}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="trending-up"
              title="Growth Charts"
              subtitle="Track height, weight, and more"
              onPress={() => navigation.navigate('GrowthDashboard')}
              color={accent}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="calendar-outline"
              title="Activity History"
              subtitle="View complete timeline"
              onPress={() => navigation.navigate('Timeline')}
              color={primary}
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, primary, accent, isDark, toggleSection, navigation]);

  const renderSafetySection = useCallback(() => {
    const isExpanded = expandedSections.has('safety');
    return (
      <Animated.View
        entering={FadeInUp.delay(300)}
        layout={Layout.springify()}
        style={styles.section}
      >
        <SectionHeader
          icon="shield-half"
          title="Safety"
          subtitle="Emergency contacts & first aid"
          color={DS.danger}
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('safety')}
        />
        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="shield-checkmark"
              title="Safety Corner"
              subtitle="Emergency contacts, first aid & safety tips"
              onPress={() => navigation.navigate('SafetyCorner')}
              color={DS.danger}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="medical"
              title="Emergency Info"
              subtitle="Quick access to emergency details"
              onPress={() => navigation.navigate('SafetyCorner')}
              color={DS.warning}
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, isDark, toggleSection, navigation]);

  const renderSupportSection = useCallback(() => {
    const isExpanded = expandedSections.has('support');
    return (
      <Animated.View
        entering={FadeInUp.delay(350)}
        layout={Layout.springify()}
        style={styles.section}
      >
        <SectionHeader
          icon="help-circle"
          title="Support & About"
          subtitle="Help, privacy, app info"
          color="#9b59b6"
          isDark={isDark}
          isExpanded={isExpanded}
          onPress={() => toggleSection('support')}
        />
        {isExpanded && (
          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="help-buoy"
              title="Help Center"
              subtitle="FAQs and tutorials"
              onPress={() => navigation.navigate('HelpCenter')}
              color="#4facfe"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="chatbubble-ellipses"
              title="Contact Support"
              subtitle="Get help from our team"
              onPress={() => navigation.navigate('ContactSupport')}
              color={secondary}
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="document-text"
              title="Privacy Policy"
              subtitle="Read our privacy terms"
              onPress={() => navigation.navigate('PrivacyPolicy')}
              color="#11998e"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="information-circle"
              title="About LittleLoom"
              subtitle="Version 1.0.0 · Build 2024.06"
              onPress={() => navigation.navigate('About')}
              color="#5f27cd"
              isDark={isDark}
              showArrow
              isLast
            />
          </BlurView>
        )}
      </Animated.View>
    );
  }, [expandedSections, secondary, isDark, toggleSection, navigation]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  const cloudActive = isConnected && !isSyncing;
  const cloudColor = isSyncing ? DS.warning : cloudActive ? DS.success : '#94a3b8';
  const cloudLabel = isSyncing ? 'Syncing…' : cloudActive ? 'Cloud sync active' : 'Offline';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors} style={styles.backgroundGradient} />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: HEADER_TOP_PADDING + 8,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primary}
            colors={[primary]}
          />
        }
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* ═══ AURA HERO BANNER ═══ */}
        <AuraSettingsBanner
          isDark={isDark}
          userProfile={userProfile || userContextProfile}
          currentBaby={currentBaby}
          stats={activityStats}
          cloudActive={cloudActive}
          cloudColor={cloudColor}
          cloudLabel={cloudLabel}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onShare={handleShare}
          onSync={handleSync}
          onProfilePress={() => {
            const guardianId = userProfile?.id || userProfile?.uid || 'parent1';
            navigation.navigate('EditGuardian', {
              guardianId,
              mode: 'parent2',
              fromChat: false,
              fromFamily: true,
            });
          }}
          onCommunityPress={() => navigation.navigate('CommunityProfile', { userId: userProfile?.id })}
          onTimelinePress={() => navigation.navigate('Timeline')}
          onAchievementsPress={() => navigation.navigate('Achievements')}
          onMilestonesPress={() => navigation.navigate('Achievements', { highlightAchievement: 'milestones' })}
        />

        {/* ═══ FAMILY SCROLL + QUICK ACTIONS ═══ */}
        <Animated.View entering={FadeInUp.delay(50).duration(500)}>
          <ProfileHeader
            navigation={navigation}
            isDark={isDark}
            userProfile={userProfile || userContextProfile}
            babies={safeBabies}
            currentBaby={currentBaby}
            currentBabyId={currentBabyId}
            parent2Profile={parent2Profile}
            guardians={guardians || []}
            stats={activityStats}
            primaryColor={primary}
            secondaryColor={secondary}
            accentColor={accent}
            // Used by ProfileHeader to resolve MY effective role for
            // the current baby (see `handleCurrentUserPress`).
            members={familyMembersAll || []}
          />
        </Animated.View>

        {/* ═══ SECTIONS ═══ */}
        {renderSecuritySection()}
        {renderPreferencesSection()}
        {renderFamilySection()}
        {renderTrackingSection()}
        {renderSafetySection()}
        {renderSupportSection()}

        {/* ═══ APP INFO ═══ */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.appInfo}>
          <View style={styles.appLogoFloatWrap}>
            <Image
              source={littleLoomLogo}
              style={styles.appLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.appVersion, isDark && styles.textMuted]}>
            LittleLoom v1.0.0
          </Text>
          <View
            style={[
              styles.securityBadge,
              {
                backgroundColor:
                  availableMethods.hasBiometric || availableMethods.hasPin
                    ? `${accent}15`
                    : 'rgba(245,158,11,0.15)',
              },
            ]}
          >
            <Ionicons
              name={
                availableMethods.hasBiometric || availableMethods.hasPin
                  ? 'lock-closed'
                  : 'lock-open'
              }
              size={13}
              color={
                availableMethods.hasBiometric || availableMethods.hasPin ? accent : DS.warning
              }
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color:
                  availableMethods.hasBiometric || availableMethods.hasPin
                    ? accent
                    : DS.warning,
              }}
            >
              {availableMethods.hasBiometric || availableMethods.hasPin
                ? 'Secured'
                : 'Standard Security'}
            </Text>
          </View>
        </Animated.View>

        {/* ═══ LOGOUT ═══ */}
        <Animated.View entering={FadeInUp.delay(450)}>
          <PressableScale onPress={handleLogout} activeScale={0.97} hapticType="medium">
            <LinearGradient
              colors={['rgba(239,68,68,0.08)', 'rgba(239,68,68,0.03)']}
              style={styles.logoutButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.logoutContent}>
                <Ionicons name="log-out-outline" size={22} color={DS.danger} />
                <Text style={styles.logoutText}>Sign Out</Text>
                <Ionicons name="chevron-forward" size={18} color={DS.danger} />
              </View>
            </LinearGradient>
          </PressableScale>
        </Animated.View>

        <View style={{ height: 30 }} />
      </Animated.ScrollView>

      {/* ═══ MODALS ═══ */}

      {/* Timeout Modal */}
      <Modal
        visible={showTimeoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeoutModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={isDark ? 60 : 90}
              style={[styles.timeoutModal, isDark && styles.timeoutModalDark]}
              tint={isDark ? 'dark' : 'light'}
            >
            <View style={styles.timeoutModalHeader}>
              <Text style={[styles.timeoutModalTitle, isDark && styles.textLight]}>
                Auto-Lock Timeout
              </Text>
              <PressableScale onPress={() => setShowTimeoutModal(false)} hapticType="light">
                <View style={[styles.modalCloseBtn, isDark && styles.modalCloseBtnDark]}>
                  <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray900} />
                </View>
              </PressableScale>
            </View>
            <Text style={[styles.timeoutModalSubtitle, isDark && styles.textMuted]}>
              Select when to automatically lock the app
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: '1 minute', value: 1 },
                { label: '2 minutes', value: 2 },
                { label: '5 minutes', value: 5 },
                { label: '10 minutes', value: 10 },
                { label: '15 minutes', value: 15 },
                { label: '30 minutes', value: 30 },
                { label: '1 hour', value: 60 },
              ].map((option) => {
                const isActive = securitySettings.autoLockTimeout === option.value;
                return (
                  <PressableScale
                    key={option.value}
                    onPress={() => handleSelectTimeout(option.value)}
                    activeScale={0.98}
                  >
                    <View
                      style={[
                        styles.timeoutOption,
                        isDark && styles.timeoutOptionDark,
                        isActive && [styles.timeoutOptionActive, { borderColor: primary }],
                        isActive && isDark && styles.timeoutOptionActiveDark,
                      ]}
                    >
                      <View
                        style={[
                          styles.timeoutOptionIcon,
                          { backgroundColor: isActive ? `${primary}18` : 'transparent' },
                        ]}
                      >
                        <Ionicons
                          name={isActive ? 'time' : 'time-outline'}
                          size={20}
                          color={isActive ? primary : isDark ? DS.gray500 : DS.gray400}
                        />
                      </View>
                      <Text
                        style={[
                          styles.timeoutOptionLabel,
                          isDark && styles.textLight,
                          isActive && { color: primary, fontWeight: '800' },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {isActive && (
                        <View style={[styles.activeCheck, { backgroundColor: primary }]}>
                          <Ionicons name="checkmark" size={14} color={DS.white} />
                        </View>
                      )}
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
            </BlurView>
          ) : (
            <View
              style={[
                styles.timeoutModal,
                styles.timeoutModalAndroid,
                isDark && styles.timeoutModalDark,
                isDark && styles.timeoutModalAndroidDark,
              ]}
            >
              <View style={styles.timeoutModalHeader}>
                <Text style={[styles.timeoutModalTitle, isDark && styles.textLight]}>
                  Auto-Lock Timeout
                </Text>
                <PressableScale onPress={() => setShowTimeoutModal(false)} hapticType="light">
                  <View style={[styles.modalCloseBtn, isDark && styles.modalCloseBtnDark]}>
                    <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray900} />
                  </View>
                </PressableScale>
              </View>
              <Text style={[styles.timeoutModalSubtitle, isDark && styles.textMuted]}>
                Select when to automatically lock the app
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {[
                  { label: '1 minute', value: 1 },
                  { label: '2 minutes', value: 2 },
                  { label: '5 minutes', value: 5 },
                  { label: '10 minutes', value: 10 },
                  { label: '15 minutes', value: 15 },
                  { label: '30 minutes', value: 30 },
                  { label: '1 hour', value: 60 },
                ].map((option) => {
                  const isActive = securitySettings.autoLockTimeout === option.value;
                  return (
                    <PressableScale
                      key={option.value}
                      onPress={() => handleSelectTimeout(option.value)}
                      activeScale={0.98}
                    >
                      <View
                        style={[
                          styles.timeoutOption,
                          isDark && styles.timeoutOptionDark,
                          isActive && [styles.timeoutOptionActive, { borderColor: primary }],
                          isActive && isDark && styles.timeoutOptionActiveDark,
                        ]}
                      >
                        <View
                          style={[
                            styles.timeoutOptionIcon,
                            { backgroundColor: isActive ? `${primary}18` : 'transparent' },
                          ]}
                        >
                          <Ionicons
                            name={isActive ? 'time' : 'time-outline'}
                            size={20}
                            color={isActive ? primary : isDark ? DS.gray500 : DS.gray400}
                          />
                        </View>
                        <Text
                          style={[
                            styles.timeoutOptionLabel,
                            isDark && styles.textLight,
                            isActive && { color: primary, fontWeight: '800' },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isActive && (
                          <View style={[styles.activeCheck, { backgroundColor: primary }]}>
                            <Ionicons name="checkmark" size={14} color={DS.white} />
                          </View>
                        )}
                      </View>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Baby Selection Modal */}
      <BabySelectionModal
        visible={showBabyModal}
        onClose={() => setShowBabyModal(false)}
        babies={safeBabies}
        currentBabyId={currentBabyId}
        onSelectBaby={handleSelectBabyFromModal}
        onEditBaby={handleEditBabyFromModal}
        isDark={isDark}
        primaryColor={primary}
      />

      {/* Logout Confirmation */}
      <CustomModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Sign Out"
        message="Are you sure you want to sign out? You will need to sign in again to access your account."
        icon="log-out-outline"
        iconColor={DS.danger}
        isDark={isDark}
        primaryColor={primary}
        primaryAction={{ label: 'Sign Out', onPress: confirmLogout }}
        secondaryAction={{ label: 'Cancel', onPress: () => setShowLogoutModal(false) }}
      />

      {/* Disable Biometric Confirmation */}
      <CustomModal
        visible={showBiometricModal}
        onClose={cancelDisableBiometric}
        title="Disable Biometric?"
        message={`Are you sure you want to disable ${biometricTypeName}? You'll need to use your PIN or re-enable biometrics later.`}
        icon={biometricIcon as any}
        iconColor={DS.warning}
        isDark={isDark}
        primaryColor={primary}
        primaryAction={{ label: 'Disable', onPress: confirmDisableBiometric }}
        secondaryAction={{ label: 'Cancel', onPress: cancelDisableBiometric }}
      />

      {/* No Security Modal */}
      <CustomModal
        visible={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        title="No Security Enabled"
        message="You haven't set up a PIN or biometric lock yet. You can still lock the app, but anyone can unlock it."
        icon="shield-outline"
        iconColor={DS.warning}
        isDark={isDark}
        primaryColor={primary}
        primaryAction={{
          label: 'Set Up Security',
          onPress: () => {
            navigation.navigate('SecurityCenter', { mode: 'setup' });
          },
        }}
        secondaryAction={{
          label: 'Lock Anyway',
          onPress: async () => {
            await lockApp(true);
            sweetAlert.info('🔒 App Locked', 'Locked without security. Tap unlock to enter.');
            navigation.navigate('SecurityLock');
          },
        }}
      />

      {/* Generic Modal */}
      {modalConfig && (
        <CustomModal
          visible={true}
          onClose={() => setModalConfig(null)}
          title={modalConfig.title}
          message={modalConfig.message}
          icon={modalConfig.icon || 'information-circle'}
          iconColor={modalConfig.iconColor || primary}
          isDark={isDark}
          primaryColor={primary}
          primaryAction={modalConfig.primaryAction}
          secondaryAction={modalConfig.secondaryAction}
        />
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFill },
  content: { paddingHorizontal: DS.space.lg },

  textLight: { color: DS.white },
  textMuted: { color: DS.gray400 },

  /* ── Aura Hero Banner ── */
  heroBanner: {
    marginTop: DS.space.md,
    marginBottom: DS.space.lg,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    overflow: 'hidden',
    ...DS.shadow.md,
  },
  auraGlowTopLeft: {
    position: 'absolute',
    top: -70,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.9,
  },
  auraGlowTopRight: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.8,
  },
  heroContent: { zIndex: 1 },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: DS.space.md },
  heroTitle: { fontSize: 26, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  cloudRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cloudText: { fontSize: 12, fontWeight: '600' },
  heroActionsTop: { flexDirection: 'row', gap: DS.space.sm },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  heroUserInfo: { flex: 1 },
  heroUserName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 2 },
  heroUserEmail: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  babyTagPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  babyTagPillText: { fontSize: 12, fontWeight: '700' },
  communityLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  communityLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityLinkText: { flex: 1 },
  communityLinkTitle: { fontSize: 14, fontWeight: '700', marginBottom: 1 },
  communityLinkSub: { fontSize: 12, fontWeight: '500' },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg,
  },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatValue: { fontSize: 20, fontWeight: '800' },
  heroStatLabel: { fontSize: 11, fontWeight: '600' },
  heroStatDivider: { width: 1, height: 24 },

  /* ── Family Section ── */
  familySection: { marginBottom: DS.space.lg },
  familySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DS.space.md,
    paddingHorizontal: 4,
  },
  familySectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  familyCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  familyCountText: { fontSize: 11, fontWeight: '800' },
  familyScroll: { gap: DS.space.md, paddingRight: DS.space.lg, flexDirection: 'row' },
  familyMember: { alignItems: 'center', minWidth: 64 },
  familyAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  familyName: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 70,
    textAlign: 'center',
  },
  familyLabel: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  babyCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: DS.white,
  },
  babyCountText: { color: DS.white, fontSize: 9, fontWeight: '800' },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: DS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  addBadgeDark: {
    backgroundColor: DS.darkSurface,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: DS.space.lg,
    marginTop: DS.space.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  quickAction: { alignItems: 'center', gap: 6 },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 11, fontWeight: '600' },

  switchBabyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: DS.space.md,
    paddingTop: DS.space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: DS.space.md,
  },
  switchBabyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBabyText: { flex: 1, fontSize: 14, fontWeight: '700' },
  switchBabyBadge: {
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  switchBabyBadgeText: { color: DS.white, fontSize: 11, fontWeight: '800' },

  /* ── Sections ── */
  section: { marginBottom: 4 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  sectionHeaderDark: {},
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: DS.space.md,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500' },

  menuContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: DS.space.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: DS.space.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  menuItemDisabled: { opacity: 0.5 },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContainer: { flex: 1, gap: 2 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  menuTitle: { fontSize: 14, fontWeight: '600' },
  menuSubtitle: { fontSize: 12, fontWeight: '500' },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menuValue: { fontSize: 13, fontWeight: '600' },
  switch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },

  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: DS.white, fontSize: 11, fontWeight: '800' },
  badgeSmall: {
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeTextSmall: { color: DS.white, fontSize: 9, fontWeight: '800' },

  /* ── App Info ── */
  appInfo: {
    alignItems: 'center',
    marginTop: DS.space['2xl'],
    marginBottom: DS.space.xl,
    gap: 10,
  },
  appLogoFloatWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appLogoImage: { width: 100, height: 100 },
  appVersion: { fontSize: 13, fontWeight: '600' },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },

  /* ── Logout ── */
  logoutButton: {
    borderRadius: 18,
    marginTop: DS.space.sm,
    marginBottom: DS.space.lg,
    overflow: 'hidden',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: DS.danger },

  /* ── Modal Base ── */
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: DS.radius['2xl'],
    padding: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden', // ← forces BlurView corners to clip on iOS
    ...DS.shadow.lg,
  },
  modalContentDark: {
    backgroundColor: 'rgba(26,26,46,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  // Android BlurView fallback: solid rounded card that mimics the iOS
  // blurred-glass look without the sharp rectangular artifact.
  modalContentAndroid: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: DS.radius['2xl'],
    overflow: 'hidden',
  },
  modalContentAndroidDark: {
    backgroundColor: 'rgba(26,26,46,0.98)',
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: DS.space.sm,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: DS.space['2xl'],
    paddingHorizontal: DS.space.sm,
  },
  modalButtons: { flexDirection: 'row', gap: DS.space.md, width: '100%' },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: { color: DS.white, fontSize: 16, fontWeight: '700' },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalSecondaryBtnText: { fontSize: 15, fontWeight: '600' },

  /* ── Bottom Sheet ── */
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: DS.radius['3xl'] || 32,
    borderTopRightRadius: DS.radius['3xl'] || 32,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalSheetBlur: {
    paddingTop: DS.space.md,
    paddingBottom: DS.space['2xl'],
  },
  modalSheetBlurAndroid: {
    paddingTop: DS.space.md,
    paddingBottom: DS.space['2xl'],
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: DS.radius['3xl'] || 32,
    borderTopRightRadius: DS.radius['3xl'] || 32,
  },
  modalSheetBlurAndroidDark: {
    backgroundColor: 'rgba(26,26,46,0.98)',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.3)',
    alignSelf: 'center',
    marginBottom: DS.space.lg,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.xl,
    paddingBottom: DS.space.lg,
  },
  modalSheetTitle: { fontSize: 20, fontWeight: '800' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  modalSheetContent: { paddingHorizontal: DS.space.lg, gap: DS.space.sm },

  babyOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginBottom: DS.space.sm,
  },
  babyEditBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    gap: DS.space.md,
  },
  babyOptionDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  babyOptionActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(102,126,234,0.08)',
  },
  babyOptionActiveDark: { backgroundColor: 'rgba(102,126,234,0.15)' },
  babyOptionInfo: { flex: 1 },
  babyOptionName: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  babyOptionMeta: { fontSize: 13, fontWeight: '500' },
  activeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Timeout Modal ── */
  timeoutModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: DS.radius['2xl'],
    padding: DS.space.xl,
    maxHeight: SCREEN_HEIGHT * 0.6,
    ...DS.shadow.lg,
    overflow: 'hidden',
  },
  timeoutModalDark: { backgroundColor: 'rgba(26,26,46,0.95)' },
  timeoutModalAndroid: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: DS.radius['2xl'],
    overflow: 'hidden',
  },
  timeoutModalAndroidDark: {
    backgroundColor: 'rgba(26,26,46,0.98)',
  },
  timeoutModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DS.space.sm,
  },
  timeoutModalTitle: { fontSize: 20, fontWeight: '800' },
  timeoutModalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: DS.space.lg,
  },
  timeoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginBottom: DS.space.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: DS.space.md,
  },
  timeoutOptionDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  timeoutOptionActive: {
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderWidth: 2,
  },
  timeoutOptionActiveDark: { backgroundColor: 'rgba(102,126,234,0.15)' },
  timeoutOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeoutOptionLabel: { flex: 1, fontSize: 15, fontWeight: '600' },

  /* ── AI Progress Bar ── */
  aiProgressCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 6,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  aiProgressCardDark: { borderColor: 'rgba(255,255,255,0.06)' },
  aiProgressHeader: { marginBottom: DS.space.md },
  aiProgressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiProgressIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiProgressTitle: { fontSize: 14, fontWeight: '700' },
  aiProgressSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  aiScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 52,
  },
  aiScoreValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  aiScoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  aiProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  aiProgressFillLearned: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
  },
  aiProgressFillPartial: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  aiProgressLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: DS.space.sm,
  },
  aiLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiLegendDot: { width: 7, height: 7, borderRadius: 4 },
  aiLegendText: { fontSize: 11, fontWeight: '600' },
});

export default React.memo(MoreScreen);