// AllTrackersScreen.tsx — UNIFIED HEADER v6.4
// Matches header style from GrowthDashboard, EnhancedTimeline, and UniversalTrackerHub
// Proper scroll behavior: top header fades out on scroll with transparency
// Long press to pin/unpin like Hub screen
// Hidden trackers modal with unhide functionality

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StatusBar,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInUp, 
  FadeInDown,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTracker } from '../../hooks';
import { useCustomization } from '../../hooks/useCustomization';
import { useBaby } from '../../context/BabyContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { DEFAULT_TRACKERS } from '../../config/defaultTrackers';
import { differenceInMonths } from 'date-fns';
import { useSweetAlert } from '../../components/SweetAlert';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

const SHADOW = {
  none: { shadowOpacity: 0, elevation: 0 },
  xs: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 24, elevation: 6 },
};

interface TrackerSubAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  presetData?: Record<string, unknown>;
}

interface TrackerConfig {
  emoji: string;
  color: string;
  gradient: [string, string];
  description: string;
  category: 'essential' | 'health' | 'development' | 'care';
  subActions: TrackerSubAction[];
}

const TRACKER_CONFIGS: Record<string, TrackerConfig> = {
  feed: {
    emoji: '🍼',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    description: 'Feeding sessions',
    category: 'essential',
    subActions: [
      { id: 'breast_left', label: 'Left Breast', icon: 'arrow-back-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'left' } },
      { id: 'breast_right', label: 'Right Breast', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { feedType: 'breast', side: 'right' } },
      { id: 'breast_both', label: 'Both Sides', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { feedType: 'breast', side: 'both' } },
      { id: 'bottle', label: 'Bottle', icon: 'beaker-outline', color: '#3b82f6', presetData: { feedType: 'bottle' } },
      { id: 'solid', label: 'Solid Food', icon: 'restaurant-outline', color: '#f59e0b', presetData: { feedType: 'solid' } },
    ],
  },
  sleep: {
    emoji: '🌙',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    description: 'Sleep tracking',
    category: 'essential',
    subActions: [
      { id: 'nap', label: 'Start Nap', icon: 'sunny-outline', color: '#10b981', presetData: { sleepType: 'nap', status: 'started' } },
      { id: 'bedtime', label: 'Bedtime', icon: 'moon-outline', color: '#6366f1', presetData: { sleepType: 'night', status: 'started' } },
      { id: 'end', label: 'End Sleep', icon: 'alarm-outline', color: '#f59e0b', presetData: { status: 'ended' } },
    ],
  },
  diaper: {
    emoji: '👶',
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#A78BFA'],
    description: 'Diaper changes',
    category: 'essential',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet' } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty' } },
      { id: 'both', label: 'Both', icon: 'water', color: '#8B5CF6', presetData: { type: 'both' } },
      { id: 'dry', label: 'Dry', icon: 'checkmark-circle-outline', color: '#10b981', presetData: { type: 'dry' } },
    ],
  },
  potty: {
    emoji: '💧',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    description: 'Potty training',
    category: 'development',
    subActions: [
      { id: 'wet', label: 'Wet', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'wet', successful: true } },
      { id: 'dirty', label: 'Dirty', icon: 'flame-outline', color: '#8B4513', presetData: { type: 'dirty', successful: true } },
      { id: 'both', label: 'Both', icon: 'water', color: '#667eea', presetData: { type: 'both', successful: true } },
      { id: 'dry', label: 'Dry Attempt', icon: 'close-circle-outline', color: '#94a3b8', presetData: { type: 'dry', successful: false } },
    ],
  },
  growth: {
    emoji: '📏',
    color: '#43e97b',
    gradient: ['#43e97b', '#38f9d7'],
    description: 'Growth measurements',
    category: 'health',
    subActions: [
      { id: 'weight', label: 'Weight', icon: 'scale-outline', color: '#10b981', presetData: { measurementType: 'weight' } },
      { id: 'height', label: 'Height', icon: 'resize-outline', color: '#3b82f6', presetData: { measurementType: 'height' } },
      { id: 'head', label: 'Head', icon: 'ellipse-outline', color: '#f59e0b', presetData: { measurementType: 'head' } },
    ],
  },
  milestone: {
    emoji: '🏆',
    color: '#ffd700',
    gradient: ['#ffd700', '#ffaa00'],
    description: 'Development milestones',
    category: 'development',
    subActions: [
      { id: 'physical', label: 'Physical', icon: 'body-outline', color: '#f59e0b', presetData: { category: 'physical' } },
      { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#8b5cf6', presetData: { category: 'cognitive' } },
      { id: 'social', label: 'Social', icon: 'people-outline', color: '#ec4899', presetData: { category: 'social' } },
      { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#3b82f6', presetData: { category: 'language' } },
    ],
  },
  medication: {
    emoji: '💊',
    color: '#ff6b6b',
    gradient: ['#ff6b6b', '#ee5a5a'],
    description: 'Health & medication',
    category: 'health',
    subActions: [
      { id: 'medicine', label: 'Medicine', icon: 'medical-outline', color: '#ef4444', presetData: { type: 'medicine' } },
      { id: 'temperature', label: 'Temperature', icon: 'thermometer-outline', color: '#f59e0b', presetData: { type: 'temperature' } },
      { id: 'symptom', label: 'Symptom', icon: 'alert-circle-outline', color: '#8b5cf6', presetData: { type: 'symptom' } },
      { id: 'vaccine', label: 'Vaccination', icon: 'shield-checkmark-outline', color: '#10b981', presetData: { type: 'vaccine' } },
    ],
  },
  pumping: {
    emoji: '🤱',
    color: '#ec4899',
    gradient: ['#ec4899', '#f472b6'],
    description: 'Pumping sessions',
    category: 'care',
    subActions: [
      { id: 'left', label: 'Left', icon: 'arrow-back-outline', color: '#f472b6', presetData: { side: 'left' } },
      { id: 'right', label: 'Right', icon: 'arrow-forward-outline', color: '#f472b6', presetData: { side: 'right' } },
      { id: 'both', label: 'Both', icon: 'swap-horizontal-outline', color: '#ec4899', presetData: { side: 'both' } },
    ],
  },
  bath: {
    emoji: '🛁',
    color: '#3b82f6',
    gradient: ['#3b82f6', '#60a5fa'],
    description: 'Bath time',
    category: 'care',
    subActions: [
      { id: 'bath', label: 'Log Bath', icon: 'water-outline', color: '#3b82f6', presetData: { type: 'bath' } },
      { id: 'sponge', label: 'Sponge Bath', icon: 'cloud-outline', color: '#93c5fd', presetData: { type: 'sponge' } },
    ],
  },
  tummy_time: {
    emoji: '🤸',
    color: '#10b981',
    gradient: ['#10b981', '#34d399'],
    description: 'Tummy time',
    category: 'development',
    subActions: [
      { id: 'tummy_time', label: 'Log Tummy Time', icon: 'fitness-outline', color: '#10b981', presetData: { type: 'tummy_time' } },
    ],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// ─── SAFE HELPERS ──────────────────────────────────────────────────────────

const safeStr = (val: unknown, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  return String(val);
};

const safeNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return fallback;
  return num;
};

const getBabyAge = (birthDate?: string | Date) => {
  if (!birthDate) return { display: 'Unknown', shortDisplay: '?', months: 0 };
  const birth = new Date(birthDate);
  const now = new Date();
  if (isNaN(birth.getTime())) return { display: 'Invalid', shortDisplay: '?', months: 0 };
  const months = differenceInMonths(now, birth);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  let display: string;
  if (years > 0) display = `${years}y ${remainingMonths}m`;
  else if (months > 0) display = `${months}m`;
  else display = 'Newborn';
  return { display, shortDisplay: months > 0 ? `${months}m` : 'Newborn', months };
};

// ─── THEME HOOK ──────────────────────────────────────────────────────────

const useHubTheme = () => {
  const { isDark, colors, fullThemeColors } = useCustomization();
  return useMemo(() => ({
    primary: colors?.primary || '#667eea',
    secondary: colors?.secondary || '#764ba2',
    isDark: !!isDark,
    bgColors: isDark ? ['#0a0a1a', '#12122a'] : ['#f8faff', '#eef2ff'],
    statusBar: isDark ? 'light-content' : 'dark-content' as const,
    blur: isDark ? 'dark' : 'light' as const,
    text: {
      primary: fullThemeColors?.text || (isDark ? '#ffffff' : '#1a1a1a'),
      secondary: fullThemeColors?.textSecondary || (isDark ? '#94a3b8' : '#64748b'),
      muted: fullThemeColors?.textMuted || (isDark ? '#64748b' : '#94a3b8'),
    },
    surface: {
      bg: fullThemeColors?.surface || (isDark ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.9)'),
      card: fullThemeColors?.card || (isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)'),
      border: fullThemeColors?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    },
    borderRadius: fullThemeColors?.borderRadius || 12,
  }), [isDark, colors, fullThemeColors]);
};

// ─── GLASS CARD ──────────────────────────────────────────────────────────

const GlassCard = React.memo(({ 
  children, 
  style, 
  onPress, 
  active = false,
  shadow = 'md',
}: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean;
  shadow?: keyof typeof SHADOW;
}) => {
  const theme = useHubTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper 
      onPress={onPress} 
      activeOpacity={onPress ? 0.85 : 1} 
      style={[
        styles.glassCard,
        SHADOW[shadow],
        active && { borderColor: theme.primary, borderWidth: 2 },
        style
      ]}
    >
      <LinearGradient
        colors={theme.isDark 
          ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] 
          : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { 
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' 
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});
GlassCard.displayName = 'GlassCard';

// ─── SECTION HEADER ──────────────────────────────────────────────────────

const SectionHeader = ({ 
  title, 
  subtitle, 
  action, 
  actionLabel,
  icon,
}: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) => {
  const theme = useHubTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && (
          <View style={[styles.sectionHeaderIcon, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name={icon} size={16} color={theme.primary} />
          </View>
        )}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction} activeOpacity={0.7}>
          <Text style={[styles.sectionActionText, { color: theme.primary }]}>
            {actionLabel || 'See All'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── SUB ACTION SHEET ──────────────────────────────────────────────────────

const SubActionSheet = React.memo(({
  visible,
  trackerId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  trackerId: string | null;
  onClose: () => void;
  onSelect: (trackerId: string, action: TrackerSubAction) => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const theme = useHubTheme();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) { 
      scale.value = withSpring(1, { damping: 15, stiffness: 200 }); 
      opacity.value = withTiming(1, { duration: 250 }); 
    } else { 
      scale.value = withTiming(0.95, { duration: 200 }); 
      opacity.value = withTiming(0, { duration: 200 }); 
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ 
    transform: [{ scale: scale.value }], 
    opacity: opacity.value 
  }));

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'] as [string, string],
    description: 'Track activity',
    category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: '#667eea' }],
  };

  return (
    <View style={[styles.sheetOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View 
        style={[
          styles.sheetContent,
          animStyle,
          {
            backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff'),
            borderRadius: Math.max(28, borderRadiusValue * 2.5),
          }
        ]}
      >
        <View style={styles.sheetHandle}>
          <View style={[styles.sheetHandlePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
        </View>

        <LinearGradient
          colors={config.gradient}
          style={[styles.sheetHeader, {
            borderTopLeftRadius: Math.max(28, borderRadiusValue * 2.5),
            borderTopRightRadius: Math.max(28, borderRadiusValue * 2.5),
          }]}
        >
          <Text style={styles.sheetEmoji}>{config.emoji}</Text>
          <Text style={styles.sheetTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
          <Text style={styles.sheetDesc}>{config.description}</Text>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={[styles.sheetBody, { backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff') }]}>
          <Text style={[styles.sheetSectionTitle, { color: theme.text.muted }]}>
            SELECT AN OPTION
          </Text>
          <View style={styles.subActionsGrid}>
            {config.subActions.map((action, index) => (
              <Animated.View
                key={action.id}
                entering={FadeInUp.delay(index * 50).springify()}
                style={{ width: '50%', padding: 6 }}
              >
                <TouchableOpacity
                  style={[
                    styles.subActionCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                      borderColor: `${action.color}35`,
                      borderRadius: Math.max(16, borderRadiusValue),
                    }
                  ]}
                  onPress={() => onSelect(trackerId, action)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.subActionIcon, { backgroundColor: `${action.color}12` }]}>
                    <Ionicons name={action.icon} size={26} color={action.color} />
                  </View>
                  <Text style={[styles.subActionLabel, { color: theme.text.primary }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
});
SubActionSheet.displayName = 'SubActionSheet';

// ─── HIDDEN TRACKERS MODAL ──────────────────────────────────────────────

const HiddenTrackersModal = React.memo(({
  visible,
  hiddenTrackers,
  onClose,
  onUnhide,
  onPinToggle,
  pinnedIds,
}: {
  visible: boolean;
  hiddenTrackers: any[];
  onClose: () => void;
  onUnhide: (id: string) => void;
  onPinToggle: (id: string) => void;
  pinnedIds: string[];
}) => {
  const { isDark, fullThemeColors } = useCustomization();
  const theme = useHubTheme();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) { 
      scale.value = withSpring(1, { damping: 15, stiffness: 200 }); 
      opacity.value = withTiming(1, { duration: 250 }); 
    } else { 
      scale.value = withTiming(0.95, { duration: 200 }); 
      opacity.value = withTiming(0, { duration: 200 }); 
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ 
    transform: [{ scale: scale.value }], 
    opacity: opacity.value 
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.hiddenModalContent, animStyle, { backgroundColor: fullThemeColors?.surface || (isDark ? '#1a1a2e' : '#ffffff') }]}>
          <View style={styles.hiddenModalHeader}>
            <Text style={[styles.hiddenModalTitle, { color: theme.text.primary }]}>Hidden Trackers</Text>
            <Text style={[styles.hiddenModalSubtitle, { color: theme.text.secondary }]}>
              {hiddenTrackers.length} tracker{hiddenTrackers.length > 1 ? 's' : ''} hidden
            </Text>
            <TouchableOpacity style={styles.hiddenModalClose} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.hiddenModalList} showsVerticalScrollIndicator={false}>
            {hiddenTrackers.length === 0 ? (
              <View style={styles.hiddenEmptyState}>
                <Ionicons name="eye-off-outline" size={48} color={theme.text.muted} />
                <Text style={[styles.hiddenEmptyText, { color: theme.text.secondary }]}>No hidden trackers</Text>
                <Text style={[styles.hiddenEmptySub, { color: theme.text.muted }]}>Trackers you hide will appear here</Text>
              </View>
            ) : (
              hiddenTrackers.map((tracker) => {
                const isPinned = pinnedIds.includes(tracker.id);
                return (
                  <View key={tracker.id} style={[styles.hiddenTrackerItem, { borderBottomColor: theme.surface.border }]}>
                    <View style={styles.hiddenTrackerLeft}>
                      <View style={[styles.hiddenTrackerIcon, { backgroundColor: `${tracker.color}12` }]}>
                        <Text style={styles.hiddenTrackerEmoji}>{tracker.emoji}</Text>
                      </View>
                      <View>
                        <Text style={[styles.hiddenTrackerName, { color: theme.text.primary }]}>{tracker.title}</Text>
                        <Text style={[styles.hiddenTrackerDesc, { color: theme.text.muted }]}>{tracker.category} • {tracker.count} logs</Text>
                      </View>
                    </View>
                    <View style={styles.hiddenTrackerActions}>
                      <TouchableOpacity 
                        onPress={() => { HAPTIC_LIGHT(); onPinToggle(tracker.id); }} 
                        style={[styles.hiddenActionBtn, { backgroundColor: isPinned ? `${theme.primary}15` : 'transparent' }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={16} color={isPinned ? theme.primary : theme.text.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => { HAPTIC_MEDIUM(); onUnhide(tracker.id); }} 
                        style={[styles.hiddenUnhideBtn, { backgroundColor: `${theme.primary}15` }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="eye-outline" size={16} color={theme.primary} />
                        <Text style={[styles.hiddenUnhideText, { color: theme.primary }]}>Unhide</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity 
            onPress={onClose} 
            style={[styles.hiddenModalDone, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.hiddenModalDoneText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
});
HiddenTrackersModal.displayName = 'HiddenTrackersModal';

type AllTrackersNavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── BABY SWITCHER PILL ──────────────────────────────────────────────────

const BabySwitcherPill = React.memo(({ baby, onPress }: { baby: any; onPress: () => void }) => {
  const { isDark } = useCustomization();
  const age = useMemo(() => getBabyAge(baby?.birthDate), [baby?.birthDate]);
  const theme = useHubTheme();

  if (!baby) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.babyPill}>
        <LinearGradient
          colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.babyPillNoBabyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(102,126,234,0.1)' }]}>
          <Ionicons name="add-circle" size={28} color={isDark ? '#a3bffa' : '#667eea'} />
        </View>
        <View style={styles.babyPillText}>
          <Text style={[styles.babyPillName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>Add Baby</Text>
          <Text style={[styles.babyPillAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>Tap to create profile</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.babyPill}>
      <LinearGradient
        colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAvatar avatar={baby.avatar} gender={baby.gender} size={36} showBadge={false} />
      <View style={styles.babyPillText}>
        <Text style={[styles.babyPillName, { color: theme.text.primary }]} numberOfLines={1}>{safeStr(baby.name, 'Baby')}</Text>
        <Text style={[styles.babyPillAge, { color: theme.text.secondary }]}>{age.shortDisplay}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={theme.text.muted} />
    </TouchableOpacity>
  );
});
BabySwitcherPill.displayName = 'BabySwitcherPill';

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────

export default function AllTrackersScreen() {
  const navigation = useNavigation<AllTrackersNavProp>();
  const insets = useSafeAreaInsets();
  const { isDark, fullThemeColors, colors, borderRadiusValue, triggerHaptic, shouldReduceMotion } = useCustomization();
  
  const { entries, getEntries, trackers, refreshEntries, isLoading } = useTracker();
  const babyHook = useBaby();
  const { currentBaby = null, isLoading: babyLoading = false, refreshCurrentBaby = () => {}, loadBabies = () => {} } = babyHook || {};
  const { success: showSuccess } = useSweetAlert();
  
  const theme = useHubTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ─── SCROLL ANIMATION ──────────────────────────────────────────────────
  const scrollY = useSharedValue(0);
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  // Top header: stays visible at top, fades out on scroll
  const topHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 60, 120],
      [1, 0.8, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 120],
      [0, -30],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollY.value,
      [0, 120],
      [1, 0.95],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Sticky header: fades in on scroll
  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 60, 120],
      [0, 0.4, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 120],
      [-20, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // ─── LOAD PINNED/HIDDEN ──────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('@littleloom_pinned_trackers'),
      AsyncStorage.getItem('@littleloom_hidden_trackers'),
    ]).then(([pinned, hidden]) => {
      if (pinned) setPinnedIds(JSON.parse(pinned));
      if (hidden) setHiddenIds(JSON.parse(hidden));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_pinned_trackers', JSON.stringify(pinnedIds)).catch(() => {});
  }, [pinnedIds]);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_hidden_trackers', JSON.stringify(hiddenIds)).catch(() => {});
  }, [hiddenIds]);

  useFocusEffect(
    useCallback(() => {
      if (typeof refreshEntries === 'function') refreshEntries();
      if (typeof refreshCurrentBaby === 'function') refreshCurrentBaby();
      if (typeof loadBabies === 'function') loadBabies();
    }, [refreshEntries, refreshCurrentBaby, loadBabies])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof refreshEntries === 'function') await refreshEntries();
      if (typeof refreshCurrentBaby === 'function') await refreshCurrentBaby();
      if (typeof loadBabies === 'function') await loadBabies();
    } catch (error) {
      console.warn('Refresh error:', error);
    }
    setRefreshing(false);
  }, [refreshEntries, refreshCurrentBaby, loadBabies]);

  const trackerCards = useMemo(() => {
    if (!currentBaby) return [];
    const sourceTrackers = trackers?.length > 0 ? trackers : DEFAULT_TRACKERS;
    
    return sourceTrackers.map((tracker: any) => {
      const id = tracker.id;
      const entriesForTracker = typeof getEntries === 'function' ? getEntries(id) : [];
      const lastEntry = entriesForTracker && entriesForTracker.length > 0 ? entriesForTracker[0] : null;
      const config = TRACKER_CONFIGS[id];
      
      return {
        id,
        title: tracker.name || tracker.title || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: tracker.emoji || config?.emoji || '📋',
        color: tracker.color || config?.color || '#667eea',
        gradient: tracker.gradient || config?.gradient || ['#667eea', '#764ba2'],
        category: tracker.category || config?.category || 'essential',
        count: entriesForTracker ? entriesForTracker.length : 0,
        lastEntry: lastEntry && lastEntry.timestamp
          ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
        hasSubActions: !!(tracker.subActions && tracker.subActions.length > 0) || !!(config?.subActions && config.subActions.length > 0),
      };
    });
  }, [trackers, getEntries, currentBaby]);

  const categories = useMemo(() => {
    const cats = [...new Set(trackerCards.map(t => t.category))];
    return cats.sort();
  }, [trackerCards]);

  const filtered = useMemo(() => {
    let res = trackerCards;
    if (activeCategory) res = res.filter((t: any) => t.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter((t: any) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return res;
  }, [trackerCards, activeCategory, searchQuery]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.count - a.count;
    });
  }, [filtered, pinnedIds]);

  const visibleTrackers = useMemo(() => {
    return sortedFiltered.filter(t => !hiddenIds.includes(t.id));
  }, [sortedFiltered, hiddenIds]);

  const hiddenTrackers = useMemo(() => {
    return trackerCards.filter(t => hiddenIds.includes(t.id));
  }, [trackerCards, hiddenIds]);

  const hasHidden = hiddenIds.length > 0;

  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) {
      setSelectedTrackerId(trackerId);
      setShowSubSheet(true);
    } else {
      navigation.navigate('AddEntry', { trackerId });
    }
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowSubSheet(false);
    const cleanPreset = action.presetData ? JSON.parse(JSON.stringify(action.presetData)) : undefined;
    setTimeout(() => {
      navigation.navigate('AddEntry', { trackerId, presetData: cleanPreset });
    }, 200);
  }, [navigation]);

  const handlePinToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (pinnedIds.includes(id)) {
      showSuccess('Unpinned', 'Tracker removed from pinned');
    } else {
      showSuccess('Pinned', 'Tracker pinned for quick access');
    }
  }, [pinnedIds, showSuccess]);

  const handleHideToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (!hiddenIds.includes(id)) {
      showSuccess('Hidden', 'Tracker hidden from view');
    } else {
      showSuccess('Unhidden', 'Tracker restored to view');
    }
  }, [hiddenIds, showSuccess]);

  const handleUnhideTracker = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenIds(prev => prev.filter(x => x !== id));
    showSuccess('Tracker Unhidden', 'The tracker has been restored to your list.');
  }, [showSuccess]);

  const handleCustomPress = useCallback(() => {
    HAPTIC_MEDIUM();
    navigation.navigate('CreateCustomTracker');
  }, [navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSwitchBaby = useCallback(() => {
    HAPTIC_LIGHT();
    navigation.navigate('SwitchBaby', { returnTo: 'AllTrackers', returnLabel: 'All Trackers' });
  }, [navigation]);

  const handleShowHidden = useCallback(() => {
    HAPTIC_LIGHT();
    setShowHiddenModal(true);
  }, []);

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.statusBar} />
      
      <LinearGradient colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={StyleSheet.absoluteFill} />

      {/* ─── STICKY HEADER (fades in on scroll) ───────────────────────── */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, stickyHeaderStyle]}>
        <BlurView intensity={theme.isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={theme.blur} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>All Trackers</Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.secondary }]}>
          {visibleTrackers.length} trackers • {entries ? entries.length : 0} logs
        </Text>
      </Animated.View>

      {/* ─── TOP HEADER — transparent, fades out on scroll ────────────── */}
      <Animated.View 
        style={[
          styles.topHeader, 
          { paddingTop: insets.top + 12 },
          topHeaderStyle
        ]}
      >
        <TouchableOpacity 
          onPress={handleBack} 
          style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text.secondary} />
        </TouchableOpacity>

        <BabySwitcherPill baby={currentBaby} onPress={handleSwitchBaby} />

        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setSearchQuery(prev => prev ? '' : 'search')} 
            style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
            activeOpacity={0.8}
          >
            <Ionicons name={searchQuery ? 'close' : 'search'} size={22} color={theme.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleCustomPress} 
            style={[styles.addBtn, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={theme.primary} 
            colors={[theme.primary, theme.secondary]} 
            progressViewOffset={insets.top + 100}
          />
        }
      >
        {/* Search Bar */}
        {searchQuery && (
          <Animated.View entering={FadeInUp.delay(50)} style={styles.searchContainer}>
            <BlurView intensity={theme.isDark ? 40 : 90} style={[styles.searchBlur, { borderRadius: theme.borderRadius }]} tint={theme.blur}>
              <Ionicons name="search" size={20} color={theme.text.secondary} />
              <TextInput 
                style={[styles.searchInput, { color: theme.text.primary }]} 
                placeholder="Search trackers..." 
                value={searchQuery} 
                onChangeText={setSearchQuery} 
                placeholderTextColor={theme.text.secondary} 
                autoFocus 
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={theme.text.secondary} />
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        )}

        {/* Stats */}
        {trackerCards.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.statsContainer}>
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
              <View style={[styles.kpiCard, { borderRadius: theme.borderRadius, borderColor: `${theme.primary}30`, backgroundColor: theme.isDark ? 'rgba(45,45,60,0.4)' : 'rgba(102,126,234,0.06)' }]}>
                <View style={styles.kpiTop}>
                  <Ionicons name="albums-outline" size={18} color={theme.primary} />
                </View>
                <Text style={[styles.kpiValue, { color: theme.text.primary }]}>{trackerCards.length}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text.muted }]}>Total</Text>
                <Text style={[styles.kpiSub, { color: theme.text.secondary }]}>{visibleTrackers.length} visible</Text>
              </View>

              <View style={[styles.kpiCard, { borderRadius: theme.borderRadius, borderColor: `${theme.secondary}30`, backgroundColor: theme.isDark ? 'rgba(45,45,60,0.4)' : 'rgba(250,112,154,0.06)' }]}>
                <View style={styles.kpiTop}>
                  <Ionicons name="pulse-outline" size={18} color={theme.secondary} />
                </View>
                <Text style={[styles.kpiValue, { color: theme.text.primary }]}>{entries ? entries.length : 0}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text.muted }]}>Total Logs</Text>
                <Text style={[styles.kpiSub, { color: theme.text.secondary }]}>All time</Text>
              </View>

              <View style={[styles.kpiCard, { borderRadius: theme.borderRadius, borderColor: 'rgba(245,158,11,0.3)', backgroundColor: theme.isDark ? 'rgba(45,45,60,0.4)' : 'rgba(245,158,11,0.06)' }]}>
                <View style={styles.kpiTop}>
                  <Ionicons name="pin-outline" size={18} color="#f59e0b" />
                </View>
                <Text style={[styles.kpiValue, { color: theme.text.primary }]}>{pinnedIds.length}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text.muted }]}>Pinned</Text>
                <Text style={[styles.kpiSub, { color: theme.text.secondary }]}>Quick access</Text>
              </View>

              <View style={[styles.kpiCard, { borderRadius: theme.borderRadius, borderColor: 'rgba(16,185,129,0.3)', backgroundColor: theme.isDark ? 'rgba(45,45,60,0.4)' : 'rgba(16,185,129,0.06)' }]}>
                <View style={styles.kpiTop}>
                  <Ionicons name="apps-outline" size={18} color="#10b981" />
                </View>
                <Text style={[styles.kpiValue, { color: theme.text.primary }]}>{categories.length}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text.muted }]}>Categories</Text>
                <Text style={[styles.kpiSub, { color: theme.text.secondary }]}>{hasHidden ? `${hiddenIds.length} hidden` : 'All visible'}</Text>
              </View>
            </Animated.ScrollView>
          </Animated.View>
        )}

        {/* Hidden Trackers Banner */}
        {hasHidden && (
          <Animated.View entering={FadeInUp.delay(120).springify()}>
            <TouchableOpacity 
              onPress={handleShowHidden} 
              style={[styles.hiddenBanner, { backgroundColor: `${theme.primary}10`, borderRadius: RADIUS.md, marginHorizontal: SPACING.lg, marginBottom: SPACING.md }]}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-off-outline" size={18} color={theme.primary} />
              <Text style={[styles.hiddenBannerText, { color: theme.primary }]}>
                {hiddenIds.length} tracker{hiddenIds.length > 1 ? 's' : ''} hidden
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.primary} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Category Filter */}
        {categories.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(150)}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.categoryScroll}
            >
              <TouchableOpacity
                onPress={() => setActiveCategory(null)}
                style={[
                  styles.categoryChip, 
                  activeCategory === null && { backgroundColor: theme.primary }
                ]}
              >
                <Text style={[styles.categoryText, activeCategory === null && { color: '#fff' }]}>All</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  style={[
                    styles.categoryChip,
                    activeCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] || theme.primary }
                  ]}
                >
                  <Text style={[styles.categoryText, activeCategory === cat && { color: '#fff' }]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Tracker Grid */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.grid}>
          {visibleTrackers.length > 0 ? (
            visibleTrackers.map((tracker: any, index: number) => {
              const isPinned = pinnedIds.includes(tracker.id);
              
              return (
                <Animated.View
                  key={tracker.id}
                  entering={FadeInUp.delay(index * 40).springify()}
                  style={styles.gridItem}
                >
                  <TouchableOpacity
                    onPress={() => handleTrackerPress(tracker.id, tracker.hasSubActions)}
                    onLongPress={() => handlePinToggle(tracker.id)}
                    delayLongPress={500}
                    activeOpacity={0.85}
                    style={{ flex: 1 }}
                  >
                    <GlassCard shadow="md" style={[styles.trackerCard, isPinned && { borderColor: theme.primary, borderWidth: 2 }]}>
                      <View style={[styles.trackerCardTop, { justifyContent: 'space-between' }]}>
                        <View style={[styles.trackerCardIcon, { backgroundColor: `${tracker.color}12` }]}>
                          <Text style={{ fontSize: 24 }}>{tracker.emoji}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <TouchableOpacity
                            onPress={() => handlePinToggle(tracker.id)}
                            style={[styles.actionBtn, isPinned && { backgroundColor: `${theme.primary}12` }]}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={16} color={isPinned ? theme.primary : theme.text.muted} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleHideToggle(tracker.id)}
                            style={styles.actionBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="eye-off-outline" size={16} color={theme.text.muted} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.trackerCardTitle, { color: theme.text.primary }]} numberOfLines={1}>
                        {tracker.title}
                      </Text>
                      <Text style={[styles.trackerCardDesc, { color: theme.text.muted }]} numberOfLines={1}>
                        {TRACKER_CONFIGS[tracker.id]?.description || tracker.category}
                      </Text>
                      <View style={styles.trackerCardMeta}>
                        <Text style={[styles.trackerCardCount, { color: tracker.color }]}>
                          {tracker.count} logs
                        </Text>
                        {tracker.lastEntry && (
                          <Text style={[styles.trackerCardLast, { color: theme.text.muted }]}>
                            Last {tracker.lastEntry}
                          </Text>
                        )}
                      </View>
                      {isPinned && (
                        <View style={[styles.pinBadge, { backgroundColor: theme.primary }]}>
                          <Ionicons name="pin" size={10} color="#fff" />
                        </View>
                      )}
                      <View style={styles.trackerCardLongPressHint}>
                        <Text style={[styles.trackerCardLongPressText, { color: theme.text.muted }]}>Long press to pin</Text>
                      </View>
                    </GlassCard>
                  </TouchableOpacity>
                </Animated.View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.surface.card }]}>
                <Ionicons name="search-outline" size={64} color={theme.text.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                {searchQuery ? 'No matches found' : 'No trackers available'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
                {searchQuery ? 'Try adjusting your search' : 'Create your first tracker to get started'}
              </Text>
              <TouchableOpacity
                onPress={handleCustomPress}
                style={[styles.emptyCreateBtn, { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyCreateBtnText}>Create Tracker</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Create Custom Tracker Button */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <TouchableOpacity
            onPress={handleCustomPress}
            style={[styles.customBtn, { borderColor: theme.surface.border, marginHorizontal: SPACING.lg, marginTop: SPACING.md }]}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[`${theme.primary}08`, `${theme.primary}02`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.customIcon, { backgroundColor: `${theme.primary}12` }]}>
              <Ionicons name="add" size={22} color={theme.primary} />
            </View>
            <Text style={[styles.customText, { color: theme.primary }]}>Create Custom Tracker</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* Sub Action Sheet */}
      {showSubSheet && (
        <SubActionSheet
          visible={showSubSheet}
          trackerId={selectedTrackerId}
          onClose={() => setShowSubSheet(false)}
          onSelect={handleSubActionSelect}
        />
      )}

      {/* Hidden Trackers Modal */}
      <HiddenTrackersModal
        visible={showHiddenModal}
        hiddenTrackers={hiddenTrackers}
        onClose={() => setShowHiddenModal(false)}
        onUnhide={handleUnhideTracker}
        onPinToggle={handlePinToggle}
        pinnedIds={pinnedIds}
      />
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
    paddingTop: 8,
    pointerEvents: 'none',
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500' },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  babyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
    gap: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(102,126,234,0.15)',
    flex: 1,
  },
  babyPillText: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 },
  babyPillName: { fontSize: 15, fontWeight: '700', maxWidth: 140 },
  babyPillAge: { fontSize: 12, fontWeight: '600' },
  babyPillNoBabyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // ── Glass Card ──
  glassCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Search ──
  searchContainer: { marginHorizontal: 20, marginBottom: 16, marginTop: 8 },
  searchBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, overflow: 'hidden' },
  searchInput: { flex: 1, marginLeft: 10, paddingVertical: 12, fontSize: 15 },

  // ── Stats ──
  statsContainer: { marginBottom: 16 },
  statsContent: { paddingHorizontal: 20, gap: 10 },
  kpiCard: { width: 120, padding: 14, borderWidth: 1, borderRadius: 16 },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1, marginBottom: 2 },
  kpiLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiSub: { fontSize: 10, fontWeight: '500', marginTop: 2 },

  // ── Hidden Banner ──
  hiddenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  hiddenBannerText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // ── Category Filter ──
  categoryScroll: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
    paddingBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(120,120,140,0.08)',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },

  // ── Grid ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: 10,
    marginTop: SPACING.md,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 56) / 2,
  },

  // ── Tracker Card ──
  trackerCard: {
    padding: SPACING.md,
    minHeight: 140,
    position: 'relative',
  },
  trackerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackerCardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  trackerCardDesc: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  trackerCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  trackerCardCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  trackerCardLast: {
    fontSize: 10,
    fontWeight: '600',
  },
  pinBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackerCardLongPressHint: {
    marginTop: 6,
    alignItems: 'center',
  },
  trackerCardLongPressText: {
    fontSize: 9,
    fontWeight: '500',
    opacity: 0.5,
  },

  // ── Custom Button ──
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  customIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customText: { fontSize: 13, fontWeight: '700' },

  // ── Empty State ──
  emptyState: { alignItems: 'center', padding: 40, width: '100%' },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontWeight: '800', marginBottom: 8, textAlign: 'center', fontSize: 22 },
  emptySubtitle: { fontWeight: '500', textAlign: 'center', lineHeight: 22, fontSize: 15, marginBottom: 20 },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  emptyCreateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Sub Action Sheet ──
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 24,
    zIndex: 200,
  },
  sheetContent: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.65,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  sheetHandle: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  sheetHandlePill: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  sheetHeader: {
    padding: 20,
    paddingTop: 28,
    alignItems: 'center',
  },
  sheetEmoji: { fontSize: 40, marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sheetDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 3 },
  sheetCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: { padding: 14 },
  sheetSectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 2,
    fontSize: 12,
  },
  subActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  subActionCard: {
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderWidth: 1.5,
  },
  subActionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subActionLabel: { fontWeight: '700', textAlign: 'center', fontSize: 13 },

  // ── Hidden Trackers Modal ──
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  hiddenModalContent: { 
    width: SCREEN_WIDTH - 40, 
    maxHeight: SCREEN_HEIGHT * 0.75, 
    borderRadius: 28, 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 20 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 40, 
    elevation: 20 
  },
  hiddenModalHeader: { padding: SPACING.lg, alignItems: 'center', position: 'relative' },
  hiddenModalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  hiddenModalSubtitle: { fontSize: 14, fontWeight: '500' },
  hiddenModalClose: { position: 'absolute', top: SPACING.md, right: SPACING.md, padding: 4 },
  hiddenModalList: { paddingHorizontal: SPACING.lg, maxHeight: 400 },
  hiddenTrackerItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: SPACING.md, 
    borderBottomWidth: 1 
  },
  hiddenTrackerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  hiddenTrackerIcon: { width: 40, height: 40, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  hiddenTrackerEmoji: { fontSize: 20 },
  hiddenTrackerName: { fontSize: 14, fontWeight: '700' },
  hiddenTrackerDesc: { fontSize: 12, fontWeight: '500' },
  hiddenTrackerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hiddenActionBtn: { padding: 8, borderRadius: RADIUS.xs },
  hiddenUnhideBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm },
  hiddenUnhideText: { fontSize: 13, fontWeight: '600' },
  hiddenModalDone: { margin: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
  hiddenModalDoneText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hiddenEmptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  hiddenEmptyText: { fontSize: 16, fontWeight: '500' },
  hiddenEmptySub: { fontSize: 13, fontWeight: '500' },
});