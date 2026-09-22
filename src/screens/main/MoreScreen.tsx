// screens/main/MoreScreen.tsx — MODERN EDITION v3.0
// Unified design language, subtle sync indicator, cleaner hierarchy
// Fixed: stray duplicate callback that broke Babel parsing

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
  Layout,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../utils/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ─── Hooks ──────────────────────────────────────────────────────────
import { useSupabase } from '../../hooks/useSupabase';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useCustomization } from '../../hooks/useCustomization';

// ─── Contexts ──────────────────────────────────────────────────────
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useSecurity } from '../../context/SecurityContext';
import { useActivity } from '../../context/ActivityContext';
import { useUser } from '../../context/UserContext';

// ─── Components ────────────────────────────────────────────────────
import { SafeAvatar, SafeBabyAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { AILearningStatus } from '../../components/AILearningStatus';

// ─── Types ─────────────────────────────────────────────────────────
import type { RootStackParamList } from '../../types/navigation';
import type { FamilyMember } from '../../types/roles';

// ─── Services ─────────────────────────────────────────────────────
import { createBackup } from '../../utils/backupService';

// ─── SweetAlert ────────────────────────────────────────────────────
import { useSweetAlert } from '../../components/SweetAlert';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════════════════
// ANIMATED PRESSABLE
// ═════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════
// CUSTOM MODAL
// ═════════════════════════════════════════════════════════════════════

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

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
      <Animated.View style={[styles.modalOverlay, backdropStyle]}>
        <BlurView
          intensity={isDark ? 60 : 90}
          style={[styles.modalContent, isDark && styles.modalContentDark]}
          tint={isDark ? 'dark' : 'light'}
        >
          <Animated.View style={contentStyle}>
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
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Pressable>
  );
});

// ═════════════════════════════════════════════════════════════════════
// PULSING STATUS DOT — subtle "cloud active" indicator
// ═════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═════════════════════════════════════════════════════════════════════

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
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#999'} />
          </Animated.View>
        </View>
      </View>
    </PressableScale>
  );
});

// ═════════════════════════════════════════════════════════════════════
// MENU ITEM
// ═════════════════════════════════════════════════════════════════════

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

  const iconColor = isDestructive ? '#ef4444' : disabled ? '#999' : color;
  const titleColor = isDestructive
    ? '#ef4444'
    : disabled
    ? '#999'
    : isDark
    ? '#fff'
    : '#1a1a1a';
  const subtitleColor = isDark ? '#888' : '#999';

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
                false: isDark ? '#333' : '#d1d5db',
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
              color={disabled ? '#555' : isDark ? '#666' : '#bbb'}
            />
          ) : value ? (
            <Text style={[styles.menuValue, isDark && styles.textMuted]}>{value}</Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
});

// ═════════════════════════════════════════════════════════════════════
// STAT CARD
// ═════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════
// QUICK ACTION
// ═════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════
// FAMILY MEMBER ITEM
// ═════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════
// BABY SELECTION MODAL
// ═════════════════════════════════════════════════════════════════════

interface BabySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  babies: any[];
  currentBabyId: string | null;
  onSelectBaby: (baby: any) => void;
  isDark: boolean;
  primaryColor: string;
}

const BabySelectionModal = React.memo<BabySelectionModalProps>(({
  visible,
  onClose,
  babies,
  currentBabyId,
  onSelectBaby,
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
                <Ionicons name="close" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
              </View>
            </PressableScale>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalSheetContent}>
            {babies.map((baby) => {
              const isActive = baby.id === currentBabyId;
              return (
                <PressableScale key={baby.id} onPress={() => onSelectBaby(baby)} activeScale={0.98}>
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
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#ccc'} />
                    )}
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </BlurView>
      </Animated.View>
    </View>
  );
});

// ═════════════════════════════════════════════════════════════════════
// AI LEARNING PROGRESS BAR
// ═════════════════════════════════════════════════════════════════════

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
      ? '#10b981'
      : stats.healthScore >= 60
      ? '#f59e0b'
      : stats.healthScore >= 40
      ? '#f97316'
      : '#ef4444';

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
          <View style={[styles.aiLegendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={[styles.aiLegendText, isDark && styles.textMuted]}>
            {stats.partialCount} learning
          </Text>
        </View>
        <View style={styles.aiLegendItem}>
          <View
            style={[
              styles.aiLegendDot,
              { backgroundColor: isDark ? '#444' : '#cbd5e1' },
            ]}
          />
          <Text style={[styles.aiLegendText, isDark && styles.textMuted]}>
            {stats.notStartedCount} pending
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#666' : '#bbb'} />
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

// ═════════════════════════════════════════════════════════════════════
// HERO PROFILE CARD
// ═════════════════════════════════════════════════════════════════════

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
}) => {
  const safeBabies = babies || [];
  const hasMultipleBabies = safeBabies.length > 1;
  const { triggerHaptic, hapticFeedback } = useCustomization();

  const handleBabyPress = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    if (safeBabies.length === 1 && currentBaby) {
      navigation.navigate('EditProfile', { mode: 'baby', babyId: currentBaby.id });
    } else if (safeBabies.length > 1) {
      navigation.navigate('SwitchBaby', { returnTo: 'Main', returnLabel: 'Settings' });
    } else {
      navigation.navigate('CreateBabyProfile');
    }
  }, [safeBabies.length, currentBaby, hapticFeedback, triggerHaptic, navigation]);

  const handleCurrentUserPress = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    const guardianId = userProfile?.id || userProfile?.uid || 'parent1';
    navigation.navigate('EditGuardian', {
      guardianId,
      mode: 'parent2',
      fromChat: false,
    });
  }, [userProfile, hapticFeedback, triggerHaptic, navigation]);

  const handleParent2Press = useCallback(() => {
    if (hapticFeedback) triggerHaptic('light').catch(() => {});
    if (parent2Profile) {
      navigation.navigate('EditGuardian', {
        guardianId: parent2Profile.id,
        mode: 'parent2',
        fromChat: false,
      });
    } else {
      navigation.navigate('CoParentInviteScreen');
    }
  }, [parent2Profile, hapticFeedback, triggerHaptic, navigation]);

  const handleGuardianPress = useCallback(
    (guardian: FamilyMember) => {
      if (hapticFeedback) triggerHaptic('light').catch(() => {});
      navigation.navigate('EditGuardian', {
        guardianId: guardian.id,
        mode: 'guardian',
        fromChat: false,
      });
    },
    [hapticFeedback, triggerHaptic, navigation]
  );

  const handleCommunityProfile = useCallback(() => {
    if (hapticFeedback) triggerHaptic('medium').catch(() => {});
    navigation.navigate('CommunityProfile', { userId: userProfile?.id });
  }, [userProfile, hapticFeedback, triggerHaptic, navigation]);

  return (
    <View style={styles.profileCardWrap}>
      {/* Gradient hero card */}
      <LinearGradient
        colors={
          isDark
            ? [`${primaryColor}30`, `${secondaryColor}18`]
            : [`${primaryColor}15`, `${secondaryColor}08`]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.profileCard, isDark && styles.profileCardDark]}
      >
        {/* User row */}
        <View style={styles.profileTopRow}>
          <PressableScale onPress={handleCurrentUserPress} activeScale={0.92}>
            <SafeAvatar
              avatar={userProfile?.avatar}
              size={68}
              fallbackIcon="person"
              fallbackColor={primaryColor}
              showEditBadge={true}
              borderWidth={3}
              borderColor={isDark ? 'rgba(255,255,255,0.15)' : '#fff'}
            />
          </PressableScale>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.textLight]} numberOfLines={1}>
              {userProfile?.fullName || 'Parent'}
            </Text>
            <Text style={[styles.profileEmail, isDark && styles.textMuted]} numberOfLines={1}>
              {userProfile?.email || 'parent@littleloom.app'}
            </Text>
            {currentBaby && (
              <View style={[styles.babyTag, { backgroundColor: `${secondaryColor}20` }]}>
                <Ionicons name="heart" size={11} color={secondaryColor} />
                <Text style={[styles.babyTagText, { color: secondaryColor }]}>
                  {currentBaby.name} · {currentBaby.age}
                </Text>
              </View>
            )}
          </View>

          <PressableScale onPress={handleCurrentUserPress} activeScale={0.85}>
            <View style={[styles.settingsBtn, isDark && styles.settingsBtnDark]}>
              <Ionicons name="settings-outline" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
            </View>
          </PressableScale>
        </View>

        {/* Community profile link */}
        <PressableScale onPress={handleCommunityProfile} activeScale={0.98}>
          <View
            style={[
              styles.communityLink,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)' },
            ]}
          >
            <View style={[styles.communityIcon, { backgroundColor: `${primaryColor}18` }]}>
              <Ionicons name="globe-outline" size={16} color={primaryColor} />
            </View>
            <View style={styles.communityLinkText}>
              <Text style={[styles.communityLinkTitle, isDark && styles.textLight]}>
                Community Profile
              </Text>
              <Text style={[styles.communityLinkSub, isDark && styles.textMuted]}>
                Edit your public profile & bio
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#666' : '#bbb'} />
          </View>
        </PressableScale>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="time-outline"
            value={stats.entries}
            label="Entries"
            color="#4facfe"
            isDark={isDark}
            onPress={() => navigation.navigate('Timeline')}
          />
          <StatCard
            icon="flame-outline"
            value={stats.streak}
            label="Streak"
            color="#f59e0b"
            isDark={isDark}
            onPress={() => navigation.navigate('Achievements')}
          />
          <StatCard
            icon="trophy-outline"
            value={stats.milestones}
            label="Milestones"
            color={accentColor}
            isDark={isDark}
            onPress={() => navigation.navigate('Achievements', { highlightAchievement: 'milestones' })}
          />
        </View>
      </LinearGradient>

      {/* Family members scroll */}
      <View style={styles.familySection}>
        <Text style={[styles.familySectionTitle, isDark && styles.textMuted]}>
          FAMILY
        </Text>
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
                    borderColor: isDark ? '#1a1a2e' : '#fff',
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
      </View>

      {/* Quick actions */}
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
          onPress={() => navigation.navigate('FamilySharing')}
        />
        <QuickAction
          icon="notifications-outline"
          label="Alerts"
          color="#f59e0b"
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

// ═════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════

function MoreScreen({ navigation, route }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();

  // ─── Contexts ────────────────────────────────────────────────────
  const { signOut, userProfile } = useAuth();
  const { babies, currentBaby, currentBabyId, getBabyStats, loadBabies } = useBaby();
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
  } = useSecurity();
  const { profile: userContextProfile } = useUser();
  const { guardians, parent2: parent2Profile } = useFamily();
  const { entries, loadEntries } = useActivity();
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

  // Mount tracking
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ─── Computed ──────────────────────────────────────────────────
  const isDark = customizationIsDark;
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

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
  const activityStats = {
    entries: entries?.length || 0,
    streak: babyStats.streak || 0,
    milestones: babyStats.milestones || 0,
  };

  const bgColors = useMemo(() => {
    if (isDark) {
      return [
        fullThemeColors?.background || '#0f0f1e',
        fullThemeColors?.surface || '#1a1a2e',
        fullThemeColors?.card || '#16162a',
      ];
    }
    return [
      fullThemeColors?.background || '#f8faff',
      fullThemeColors?.surface || '#ffffff',
      fullThemeColors?.card || '#f0f4ff',
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
        loadEntries?.(),
        refreshBiometricStatus(),
        loadAIStats(),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, loadEntries, refreshBiometricStatus, loadAIStats]);

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
          const backupResult = await createBackup({
            encrypted: false,
            includePhotos: true,
          });
          if (backupResult.success) {
            console.log('✅ Backup created successfully');
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
  }, [isSyncing, sync, triggerHaptic, sweetAlert]);

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
          if (ok) {
            setLocalBiometricEnabled(true);
            await refreshBiometricStatus();
            triggerHaptic('success');
            sweetAlert.success(
              `${biometricTypeName} Enabled`,
              'You can now unlock LittleLoom with biometrics.'
            );
          } else {
            setLocalBiometricEnabled(false);
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
    try {
      const ok = await toggleBiometric(false);
      if (ok) {
        setLocalBiometricEnabled(false);
        await refreshBiometricStatus();
        triggerHaptic('success');
        sweetAlert.success('Biometric Disabled', 'Biometric authentication has been turned off.');
      } else {
        setLocalBiometricEnabled(true);
        sweetAlert.error('Error', 'Could not disable biometric authentication.');
      }
    } catch (error) {
      console.error('Disable biometric error:', error);
      setLocalBiometricEnabled(true);
      sweetAlert.error('Error', 'An error occurred while disabling biometric authentication.');
    }
  }, [toggleBiometric, refreshBiometricStatus, triggerHaptic, sweetAlert]);

  const cancelDisableBiometric = useCallback(() => {
    setShowBiometricModal(false);
    setLocalBiometricEnabled(true);
  }, []);

  const handlePinSetup = useCallback(() => {
    navigation.navigate('SecurityCenter', { mode: 'setup' });
  }, [navigation]);

  const handleLockNow = useCallback(async () => {
    const hasAnySecurity =
      securitySettings.isPinEnabled ||
      (isBiometricEnabled && biometricAvailable) ||
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
    securitySettings.isPinEnabled,
    securitySettings.isAppLockEnabled,
    isBiometricEnabled,
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

  // Sync local biometric state from context
  useEffect(() => {
    setLocalBiometricEnabled(isBiometricEnabled ?? false);
  }, [isBiometricEnabled]);

  // Read from storage on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await readBiometricEnabledFromStorage();
        if (mounted) setLocalBiometricEnabled(stored);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [readBiometricEnabledFromStorage]);

  // Server hydration (once)
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

  // Flush cohort queue on foreground
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

  // Load collaborative learning opt-in
  useEffect(() => {
    import('../../services/ai/CohortPriors')
      .then(({ isCollaborativeLearningEnabled }) => isCollaborativeLearningEnabled())
      .then(setCollaborativeEnabled)
      .catch(() => {});
  }, []);

  // Load AI stats on baby change
  useEffect(() => {
    loadAIStats();
  }, [loadAIStats]);

  // Refresh biometric status on mount
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
        loadEntries?.();
        await refreshBiometricStatus();
        try {
          const stored = await readBiometricEnabledFromStorage();
          setLocalBiometricEnabled(stored);
        } catch {}
        loadAIStats();
      }, 300);

      return () => {
        if (focusLoadTimeout.current) clearTimeout(focusLoadTimeout.current);
      };
    }, [
      loadBabies,
      loadEntries,
      refreshBiometricStatus,
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
              ? `${biometricTypeName} enabled`
              : bioAvailable
              ? `${biometricTypeName} available`
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
                bioEnabled ? 'Enabled' : bioAvailable ? 'Tap to enable' : 'Not Available'
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
              icon="keypad"
              title="PIN Code"
              subtitle={securitySettings.isPinEnabled ? 'Change PIN' : 'Set up PIN'}
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
              color="#f59e0b"
              isDark={isDark}
              showArrow
              disabled={!securitySettings.isAppLockEnabled}
            />
            <MenuItem
              icon="lock-closed-outline"
              title="Lock Now"
              subtitle="Immediately lock the app"
              onPress={handleLockNow}
              color="#ef4444"
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
              subtitle="Manage co-parents and guardians"
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
              color="#f59e0b"
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
          color="#ef4444"
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
              color="#ef4444"
              isDark={isDark}
              showArrow
            />
            <MenuItem
              icon="medical"
              title="Emergency Info"
              subtitle="Quick access to emergency details"
              onPress={() => navigation.navigate('SafetyCorner')}
              color="#f59e0b"
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
  const cloudColor = isSyncing ? '#f59e0b' : cloudActive ? '#10b981' : '#94a3b8';
  const cloudLabel = isSyncing ? 'Syncing…' : cloudActive ? 'Cloud sync active' : 'Offline';

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
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
        {/* ═══ HEADER ═══ */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, isDark && styles.textLight]}>Settings</Text>
            <View style={styles.cloudRow}>
              {isSyncing ? (
                <UniversalSpinner size={10} color={cloudColor} variant="liquid" section="settings" />
              ) : (
                <PulsingDot color={cloudColor} size={7} />
              )}
              <Text style={[styles.cloudText, { color: isDark ? '#888' : '#999' }]}>
                {cloudLabel}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleShare}
              style={[
                styles.headerBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.04)',
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={18} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSync}
              style={[
                styles.headerBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.04)',
                },
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
                    ? '#10b981'
                    : syncStatus === 'error'
                    ? '#ef4444'
                    : isDark
                    ? '#fff'
                    : '#1a1a1a'
                }
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ═══ PROFILE CARD ═══ */}
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
              source={require('../../../assets/logo.png')}
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
                availableMethods.hasBiometric || availableMethods.hasPin ? accent : '#f59e0b'
              }
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color:
                  availableMethods.hasBiometric || availableMethods.hasPin
                    ? accent
                    : '#f59e0b',
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
                <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                <Text style={styles.logoutText}>Sign Out</Text>
                <Ionicons name="chevron-forward" size={18} color="#ef4444" />
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
                  <Ionicons name="close" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
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
                          color={isActive ? primary : isDark ? '#666' : '#999'}
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
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                      )}
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* Baby Selection Modal */}
      <BabySelectionModal
        visible={showBabyModal}
        onClose={() => setShowBabyModal(false)}
        babies={safeBabies}
        currentBabyId={currentBabyId}
        onSelectBaby={handleSelectBabyFromModal}
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
        iconColor="#ef4444"
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
        iconColor="#f59e0b"
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
        iconColor="#f59e0b"
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
    </LinearGradient>
  );
}

// ═════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },

  textLight: { color: '#ffffff' },
  textMuted: { color: '#888' },

  // ─── Header ─────────────────────────────────────────────────────
  header: {
    marginBottom: 20,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.6,
  },
  cloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  cloudText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Profile Card ───────────────────────────────────────────────
  profileCardWrap: {
    borderRadius: 28,
    marginBottom: 20,
  },
  profileCard: {
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  profileCardDark: {
    borderColor: 'rgba(255,255,255,0.06)',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  babyTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  babyTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  communityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
  },
  communityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityLinkText: { flex: 1 },
  communityLinkTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 1,
  },
  communityLinkSub: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
  statCardDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  familySection: { marginTop: 16 },
  familySectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#888',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  familyScroll: {
    paddingRight: 16,
    gap: 12,
    flexDirection: 'row',
  },
  familyMember: {
    alignItems: 'center',
    minWidth: 64,
  },
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
    color: '#1a1a1a',
    fontWeight: '700',
    maxWidth: 70,
    textAlign: 'center',
  },
  familyLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '500',
    marginTop: 1,
  },
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
    borderColor: '#fff',
  },
  babyCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  addBadgeDark: {
    backgroundColor: '#1a1a2e',
    borderColor: 'rgba(255,255,255,0.1)',
  },

  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },

  switchBabyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  switchBabyIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBabyText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  switchBabyBadge: {
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  switchBabyBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // ─── Sections ───────────────────────────────────────────────────
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
    gap: 12,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },

  menuContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
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
  menuTextContainer: {
    flex: 1,
    gap: 2,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuValue: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },

  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  badgeSmall: {
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeTextSmall: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  // ─── App Info ───────────────────────────────────────────────────
  appInfo: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
    gap: 10,
  },
  appLogoFloatWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appLogoImage: {
    width: 100,
    height: 100,
  },
  appVersion: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },

  // ─── Logout ─────────────────────────────────────────────────────
  logoutButton: {
    borderRadius: 18,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },

  // ─── Modal ──────────────────────────────────────────────────────
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalSheetBlur: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalSheetContent: {
    paddingHorizontal: 16,
    gap: 8,
  },

  // ─── Custom Modal Styles ────────────────────────────────────────
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
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  modalContentDark: {
    backgroundColor: 'rgba(26,26,46,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    gap: 14,
  },
  babyOptionDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  babyOptionActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(102,126,234,0.08)',
  },
  babyOptionActiveDark: {
    backgroundColor: 'rgba(102,126,234,0.15)',
  },
  babyOptionInfo: { flex: 1 },
  babyOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  babyOptionMeta: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  activeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Timeout Modal ──────────────────────────────────────────────
  timeoutModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
    overflow: 'hidden',
  },
  timeoutModalDark: {
    backgroundColor: 'rgba(26,26,46,0.95)',
  },
  timeoutModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeoutModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  timeoutModalSubtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
    marginBottom: 16,
  },
  timeoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  timeoutOptionDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  timeoutOptionActive: {
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderWidth: 2,
  },
  timeoutOptionActiveDark: {
    backgroundColor: 'rgba(102,126,234,0.15)',
  },
  timeoutOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeoutOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },

  // ─── AI Learning Progress Bar ───────────────────────────────────
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
  aiProgressCardDark: {
    borderColor: 'rgba(255,255,255,0.06)',
  },
  aiProgressHeader: { marginBottom: 12 },
  aiProgressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiProgressIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiProgressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  aiProgressSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#888',
    marginTop: 2,
  },
  aiScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 52,
  },
  aiScoreValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
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
    marginTop: 10,
  },
  aiLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  aiLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  aiLegendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
  },
});

export default React.memo(MoreScreen);