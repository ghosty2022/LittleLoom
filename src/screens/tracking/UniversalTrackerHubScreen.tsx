// UniversalTrackerHubScreen.tsx — REDESIGNED with Better UI Hierarchy

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import {
  format,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  startOfDay,
} from 'date-fns';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks';
import { useBaby, type BabyProfile } from '../../context/BabyContext';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimelinePicker } from '../../components/trackers/TimelinePicker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

const SHADOW = {
  none: { shadowOpacity: 0, elevation: 0 },
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 24, elevation: 6 },
};

type HubNavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
  emotional: '#ec4899',
  physical: '#06b6d4',
  nutrition: '#f97316',
  safety: '#dc2626',
  schedule: '#3b82f6',
  parental: '#84cc16',
  travel: '#0ea5e9',
  special_needs: '#a855f7',
  household: '#64748b',
  custom: '#667eea',
};

const safeStr = (val: unknown, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  return String(val);
};

const getBabyAge = (birthDate?: string | Date) => {
  if (!birthDate) return { display: 'Unknown', shortDisplay: '?', months: 0 };
  const birth = new Date(birthDate);
  const now = new Date();
  if (isNaN(birth.getTime())) return { display: 'Invalid', shortDisplay: '?', months: 0 };
  const years = differenceInYears(now, birth);
  const months = differenceInMonths(now, birth) % 12;
  const days = differenceInDays(now, birth) % 30;
  let display: string;
  if (years > 0) display = `${years}y ${months}m`;
  else if (months > 0) display = `${months}m ${days}d`;
  else display = `${days} days`;
  return { display, shortDisplay: months > 0 ? `${months}m` : `${days}d`, months: years * 12 + months };
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// ─── THEME ──────────────────────────────────────────────────────────────

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

const SectionHeader = React.memo(({ 
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
});
SectionHeader.displayName = 'SectionHeader';

// ─── BABY SWITCHER PILL ──────────────────────────────────────────────────

const BabySwitcherPill = React.memo(({ baby, onPress }: { baby: BabyProfile | null; onPress: () => void }) => {
  const { isDark } = useCustomization();
  const age = useMemo(() => getBabyAge(baby?.birthDate), [baby?.birthDate]);

  if (!baby) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.babyPill}>
        <LinearGradient colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
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
      <LinearGradient colors={isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <SafeBabyAvatar avatar={baby?.avatar} gender={baby?.gender} size={36} showBadge={false} />
      <View style={styles.babyPillText}>
        <Text style={[styles.babyPillName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>{safeStr(baby?.name, 'Baby')}</Text>
        <Text style={[styles.babyPillAge, { color: isDark ? '#94a3b8' : '#64748b' }]}>{age.shortDisplay}</Text>
      </View>
      <Ionicons name="chevron-down" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
    </TouchableOpacity>
  );
});
BabySwitcherPill.displayName = 'BabySwitcherPill';

// ─── QUICK LOG STRIP ─────────────────────────────────────────────────────

const QuickLogStrip = React.memo(({ onQuickLog }: { onQuickLog: (trackerId: string, subActionId: string) => void }) => {
  const theme = useHubTheme();

  const shortcuts = [
    { trackerId: 'feed', subActionId: 'breast_left', label: 'Feed L', icon: 'arrow-back-outline' as const, color: '#f472b6' },
    { trackerId: 'feed', subActionId: 'breast_right', label: 'Feed R', icon: 'arrow-forward-outline' as const, color: '#f472b6' },
    { trackerId: 'sleep', subActionId: 'nap', label: 'Nap', icon: 'sunny-outline' as const, color: '#10b981' },
    { trackerId: 'diaper', subActionId: 'wet', label: 'Wet', icon: 'water-outline' as const, color: '#3b82f6' },
    { trackerId: 'diaper', subActionId: 'dirty', label: 'Dirty', icon: 'flame-outline' as const, color: '#8B4513' },
    { trackerId: 'pumping', subActionId: 'both', label: 'Pump', icon: 'swap-horizontal-outline' as const, color: '#ec4899' },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Quick Log" subtitle="One-tap actions" icon="flash-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLogScroll}>
        {shortcuts.map((shortcut) => (
          <TouchableOpacity 
            key={`${shortcut.trackerId}-${shortcut.subActionId}`} 
            onPress={() => {
              HAPTIC_LIGHT();
              onQuickLog(shortcut.trackerId, shortcut.subActionId);
            }} 
            style={[styles.quickLogChip, { borderColor: `${shortcut.color}25` }]} 
            activeOpacity={0.85}
          >
            <LinearGradient colors={[`${shortcut.color}10`, `${shortcut.color}03`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Ionicons name={shortcut.icon} size={18} color={shortcut.color} />
            <Text style={[styles.quickLogLabel, { color: shortcut.color }]}>{shortcut.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
QuickLogStrip.displayName = 'QuickLogStrip';

// ─── TRACKER CARDS GRID ──────────────────────────────────────────────────

const TrackerCardsGrid = React.memo(({ 
  trackerCards, pinnedIds, hiddenIds, onTrackerPress, onCustomPress, onPinToggle, onBrowseAll, onShowHidden,
}: { 
  trackerCards: any[]; pinnedIds: string[]; hiddenIds: string[];
  onTrackerPress: (id: string, hasSub: boolean) => void; onCustomPress: () => void;
  onPinToggle: (id: string) => void; onBrowseAll: () => void; onShowHidden: () => void;
}) => {
  const theme = useHubTheme();

  const visibleTrackers = useMemo(() => trackerCards.filter(t => !hiddenIds.includes(t.id)), [trackerCards, hiddenIds]);
  const pinned = useMemo(() => visibleTrackers.filter(t => pinnedIds.includes(t.id)), [visibleTrackers, pinnedIds]);
  const hasHidden = hiddenIds.length > 0;
  const categories = useMemo(() => {
    const cats = [...new Set(visibleTrackers.map(t => t.category))];
    return cats.filter(c => visibleTrackers.some(t => t.category === c && !pinnedIds.includes(t.id)));
  }, [visibleTrackers, pinnedIds]);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader 
        title="Trackers" 
        subtitle={`${visibleTrackers.length} active${hasHidden ? `, ${hiddenIds.length} hidden` : ''}`} 
        icon="grid-outline" 
        action={onBrowseAll} 
        actionLabel="Browse All" 
      />

      {/* Hidden Trackers Banner */}
      {hasHidden && (
        <TouchableOpacity 
          onPress={onShowHidden} 
          style={[styles.hiddenBanner, { backgroundColor: `${theme.primary}10`, borderRadius: RADIUS.md }]}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-off-outline" size={16} color={theme.primary} />
          <Text style={[styles.hiddenBannerText, { color: theme.primary }]}>
            {hiddenIds.length} tracker{hiddenIds.length > 1 ? 's' : ''} hidden — tap to manage
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </TouchableOpacity>
      )}

      {pinned.length > 0 && (
        <View style={{ marginBottom: SPACING.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: SPACING.lg, marginBottom: 10 }}>
            <Ionicons name="pin" size={14} color={theme.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pinned</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackerScroll}>
            {pinned.map((tracker) => (
              <TouchableOpacity 
                key={tracker.id} 
                onPress={() => onTrackerPress(tracker.id, tracker.hasSubActions)} 
                onLongPress={() => onPinToggle(tracker.id)} 
                style={styles.trackerFabCard} 
                activeOpacity={0.85}
              >
                <LinearGradient colors={tracker.gradient} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.lg }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={styles.trackerFabContent}>
                  <Text style={styles.trackerFabEmoji}>{tracker.emoji}</Text>
                  <Text style={styles.trackerFabTitle}>{tracker.title}</Text>
                  <View style={styles.trackerFabMeta}>
                    <Text style={styles.trackerFabCount}>{tracker.count} logs</Text>
                  </View>
                </View>
                <View style={[styles.trackerFabArrow, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Ionicons name="pin" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {categories.map(cat => {
        const catTrackers = visibleTrackers.filter(t => t.category === cat && !pinnedIds.includes(t.id));
        if (catTrackers.length === 0) return null;
        return (
          <View key={cat} style={styles.trackerCategorySection}>
            <View style={styles.trackerCategoryHeader}>
              <View style={[styles.trackerCategoryDot, { backgroundColor: CATEGORY_COLORS[cat] || theme.primary }]} />
              <Text style={[styles.trackerCategoryLabel, { color: theme.text.muted }]}>{cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackerScroll}>
              {catTrackers.map((tracker) => (
                <TouchableOpacity 
                  key={tracker.id} 
                  onPress={() => onTrackerPress(tracker.id, tracker.hasSubActions)} 
                  onLongPress={() => onPinToggle(tracker.id)} 
                  style={styles.trackerFabCard} 
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={tracker.gradient} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.lg }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  <View style={styles.trackerFabContent}>
                    <Text style={styles.trackerFabEmoji}>{tracker.emoji}</Text>
                    <Text style={styles.trackerFabTitle}>{tracker.title}</Text>
                    <View style={styles.trackerFabMeta}>
                      <Text style={styles.trackerFabCount}>{tracker.count} logs</Text>
                    </View>
                  </View>
                  <View style={styles.trackerFabArrow}>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      })}

      <TouchableOpacity onPress={onCustomPress} style={[styles.customTrackerBtn, { borderColor: theme.surface.border }]} activeOpacity={0.8}>
        <LinearGradient colors={[`${theme.primary}10`, `${theme.primary}04`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={[styles.customTrackerIcon, { backgroundColor: `${theme.primary}15` }]}>
          <Ionicons name="add" size={22} color={theme.primary} />
        </View>
        <Text style={[styles.customTrackerText, { color: theme.primary }]}>Create Custom Tracker</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});
TrackerCardsGrid.displayName = 'TrackerCardsGrid';

// ─── HIDDEN TRACKERS MODAL ──────────────────────────────────────────────

const HiddenTrackersModal = React.memo(({
  visible,
  hiddenTrackers,
  onClose,
  onUnhide,
  theme,
}: {
  visible: boolean;
  hiddenTrackers: any[];
  onClose: () => void;
  onUnhide: (id: string) => void;
  theme: any;
}) => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) { 
      scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 }); 
      opacity.value = withTiming(1, { duration: 280 }); 
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
        <Animated.View style={[styles.hiddenModalContent, animStyle, { backgroundColor: theme.isDark ? '#1a1a2e' : '#ffffff' }]}>
          <View style={styles.hiddenModalHeader}>
            <Text style={[styles.hiddenModalTitle, { color: theme.text.primary }]}>Hidden Trackers</Text>
            <Text style={[styles.hiddenModalSubtitle, { color: theme.text.secondary }]}>
              {hiddenTrackers.length} tracker{hiddenTrackers.length > 1 ? 's' : ''} hidden
            </Text>
            <TouchableOpacity style={styles.hiddenModalClose} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.hiddenModalList} showsVerticalScrollIndicator={false}>
            {hiddenTrackers.length === 0 ? (
              <View style={styles.hiddenEmptyState}>
                <Ionicons name="eye-off-outline" size={48} color={theme.text.muted} />
                <Text style={[styles.hiddenEmptyText, { color: theme.text.secondary }]}>No hidden trackers</Text>
              </View>
            ) : (
              hiddenTrackers.map((tracker) => (
                <View key={tracker.id} style={[styles.hiddenTrackerItem, { borderBottomColor: theme.surface.border }]}>
                  <View style={styles.hiddenTrackerLeft}>
                    <Text style={styles.hiddenTrackerEmoji}>{tracker.emoji}</Text>
                    <View>
                      <Text style={[styles.hiddenTrackerName, { color: theme.text.primary }]}>{tracker.title}</Text>
                      <Text style={[styles.hiddenTrackerDesc, { color: theme.text.muted }]}>{tracker.category}</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => onUnhide(tracker.id)} 
                    style={[styles.hiddenUnhideBtn, { backgroundColor: `${theme.primary}15` }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye-outline" size={16} color={theme.primary} />
                    <Text style={[styles.hiddenUnhideText, { color: theme.primary }]}>Unhide</Text>
                  </TouchableOpacity>
                </View>
              ))
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

// ─── TRACKER ACTION MODAL ───────────────────────────────────────────────

const TrackerActionModal = React.memo(({
  visible, trackerId, onClose, onSelect,
}: {
  visible: boolean; trackerId: string | null; onClose: () => void;
  onSelect: (trackerId: string, subAction: TrackerSubAction) => void;
}) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const theme = useHubTheme();
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 }); opacity.value = withTiming(1, { duration: 280 }); } 
    else { scale.value = withTiming(0.95, { duration: 200 }); opacity.value = withTiming(0, { duration: 200 }); }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  if (!visible || !trackerId) return null;

  const config = TRACKER_CONFIGS[trackerId] || {
    emoji: '📋', color: '#667eea', gradient: ['#667eea', '#764ba2'] as [string, string],
    description: 'Track activity', category: 'essential',
    subActions: [{ id: 'default', label: 'Add Entry', icon: 'add-circle-outline' as const, color: '#667eea' }],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.modalContent, animStyle, { borderRadius: Math.max(28, borderRadiusValue * 2.5), backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff'), shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40, elevation: 20 }]} onStartShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
          <View style={styles.modalDragHandle}>
            <View style={[styles.modalDragPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' }]} />
          </View>
          <LinearGradient colors={config.gradient} style={[styles.modalHeader, { borderTopLeftRadius: Math.max(28, borderRadiusValue * 2.5), borderTopRightRadius: Math.max(28, borderRadiusValue * 2.5) }]}>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalEmoji}>{config.emoji}</Text>
              <Text style={styles.modalTitle}>{trackerId.charAt(0).toUpperCase() + trackerId.slice(1)}</Text>
              <Text style={styles.modalDescription}>{config.description}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
          <View style={[styles.modalBody, { backgroundColor: fullThemeColors?.surface || (isDark ? '#1e1e2e' : '#ffffff') }]}>
            <Text style={[styles.modalSectionTitle, { color: fullThemeColors?.textSecondary || '#64748b' }]}>WHAT WOULD YOU LIKE TO LOG?</Text>
            <View style={styles.subActionsGrid}>
              {config.subActions.map((action, index) => (
                <Animated.View key={action.id} entering={FadeInUp.delay(index * 60).springify()} style={{ width: '50%', padding: 6 }}>
                  <TouchableOpacity style={[styles.subActionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)', borderColor: `${action.color}40`, borderRadius: Math.max(16, borderRadiusValue), borderWidth: 1.5 }]} onPress={() => onSelect(trackerId, action)} activeOpacity={0.8}>
                    <View style={[styles.subActionIcon, { backgroundColor: `${action.color}12` }]}>
                      <Ionicons name={action.icon} size={28} color={action.color} />
                    </View>
                    <Text style={[styles.subActionLabel, { color: fullThemeColors?.text || (isDark ? '#fff' : '#1a1a1a') }]}>{action.label}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});
TrackerActionModal.displayName = 'TrackerActionModal';

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────

export default function UniversalTrackerHubScreen() {
  const navigation = useNavigation<HubNavigationProp>();
  const insets = useSafeAreaInsets();
  const { fullThemeColors, themeColors, isDark, borderRadiusValue } = useCustomization();
  const tracker = useTracker();
  const { entries, getEntries, trackers } = tracker;
  const { currentBaby, babies, isLoading: babyLoading, loadBabies, refreshCurrentBaby } = useBaby();
  const { success: showSuccess, error: showError, confirm: showConfirm } = useSweetAlert();

  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showBabyRequiredModal, setShowBabyRequiredModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTimelinePicker, setShowTimelinePicker] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [pinnedTrackerIds, setPinnedTrackerIds] = useState<string[]>([]);
  const [hiddenTrackerIds, setHiddenTrackerIds] = useState<string[]>([]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const currentBabyRef = useRef(currentBaby);
  currentBabyRef.current = currentBaby;

  const theme = useHubTheme();

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!babyLoading && !currentBaby && isMountedRef.current) {
      const timer = setTimeout(() => setShowBabyRequiredModal(true), 400);
      return () => clearTimeout(timer);
    }
  }, [babyLoading, currentBaby]);

  // ─── Load pinned/hidden from storage ─────────────────────────────────
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const init = async () => {
      setIsRefreshing(true);
      try {
        await loadBabies();
        const [pinned, hidden] = await Promise.all([
          AsyncStorage.getItem('@littleloom_pinned_trackers'),
          AsyncStorage.getItem('@littleloom_hidden_trackers'),
        ]);
        if (pinned) setPinnedTrackerIds(JSON.parse(pinned));
        if (hidden) setHiddenTrackerIds(JSON.parse(hidden));
      } catch (err) {
        if (isMountedRef.current) showError('Error', 'Failed to load baby profiles');
      } finally {
        if (isMountedRef.current) setIsRefreshing(false);
      }
    };
    init();
  }, []);

  // ─── Persist pinned/hidden ──────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.setItem('@littleloom_pinned_trackers', JSON.stringify(pinnedTrackerIds)).catch(() => {});
  }, [pinnedTrackerIds]);

  useEffect(() => {
    AsyncStorage.setItem('@littleloom_hidden_trackers', JSON.stringify(hiddenTrackerIds)).catch(() => {});
  }, [hiddenTrackerIds]);

  useEffect(() => {
    const tick = async () => {
      if (currentBabyRef.current && isMountedRef.current) await refreshCurrentBaby();
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [refreshCurrentBaby]);

  const today = useMemo(() => startOfDay(new Date()).getTime(), []);

  const todayCount = useMemo(() => {
    if (!currentBaby) return 0;
    return entries.filter((e: any) => e?.timestamp >= today).length;
  }, [entries, today, currentBaby]);

  const trackerCards = useMemo(() => {
    if (!currentBaby) return [];
    const sourceTrackers = trackers?.length > 0
      ? trackers
      : Object.keys(TRACKER_CONFIGS).map(id => ({
          id, name: id.charAt(0).toUpperCase() + id.slice(1),
          emoji: TRACKER_CONFIGS[id].emoji, color: TRACKER_CONFIGS[id].color,
          gradient: TRACKER_CONFIGS[id].gradient, category: TRACKER_CONFIGS[id].category,
        }));

    return sourceTrackers.map((tracker: any) => {
      const id = tracker.id;
      const config = TRACKER_CONFIGS[id];
      const entriesForTracker = getEntries(id);
      const lastEntry = entriesForTracker[0];
      return {
        id, title: tracker.name || tracker.title || id.charAt(0).toUpperCase() + id.slice(1),
        emoji: tracker.emoji || config?.emoji || '📋',
        color: tracker.color || config?.color || '#667eea',
        gradient: (tracker.gradient || config?.gradient || ['#667eea', '#764ba2']) as [string, string],
        category: config?.category || 'essential',
        count: entriesForTracker.length,
        lastEntry: lastEntry ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        hasSubActions: !!config?.subActions?.length,
      };
    });
  }, [trackers, getEntries]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleTrackerPress = useCallback((trackerId: string, hasSubActions: boolean) => {
    HAPTIC_LIGHT();
    if (hasSubActions) { setSelectedTrackerId(trackerId); setShowActionModal(true); } 
    else { navigation.navigate('AddEntry', { trackerId }); }
  }, [navigation]);

  const handleSubActionSelect = useCallback((trackerId: string, action: TrackerSubAction) => {
    HAPTIC_MEDIUM();
    setShowActionModal(false);
    setTimeout(() => navigation.navigate('AddEntry', { trackerId, presetData: action.presetData }), 100);
  }, [navigation]);

  const handleQuickLog = useCallback((trackerId: string, subActionId: string) => {
    const config = TRACKER_CONFIGS[trackerId];
    const action = config?.subActions.find(a => a.id === subActionId);
    if (action) handleSubActionSelect(trackerId, action);
  }, [handleSubActionSelect]);

  const handleSwitchBaby = useCallback(() => {
    HAPTIC_LIGHT();
    if (babies.length > 1) {
      navigation.navigate('SwitchBaby', { returnTo: 'UniversalTrackerHub', returnLabel: 'Tracker Hub' });
    } else {
      showConfirm('Switch Baby Profile', 'You only have one baby profile. Would you like to add another?',
        () => navigation.navigate('CreateBabyProfile'), () => {}, 'Add New', 'Cancel');
    }
  }, [babies.length, navigation, showConfirm]);

  const handleViewTimeline = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('Timeline'); }, [navigation]);
  const handleCreateCustom = useCallback(() => { HAPTIC_MEDIUM(); navigation.navigate('CreateCustomTracker'); }, [navigation]);
  const handleBrowseAll = useCallback(() => { HAPTIC_LIGHT(); navigation.navigate('AllTrackers'); }, [navigation]);

  const handlePinToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setPinnedTrackerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleUnhideTracker = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenTrackerIds(prev => prev.filter(x => x !== id));
    showSuccess('Tracker Unhidden', 'The tracker has been restored to your list.');
  }, [showSuccess]);

  const handleShowHidden = useCallback(() => {
    HAPTIC_LIGHT();
    setShowHiddenModal(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await loadBabies(); await refreshCurrentBaby(); } catch (e) { console.warn('Refresh failed', e); } finally { setIsRefreshing(false); }
  }, [loadBabies, refreshCurrentBaby]);

  const hiddenTrackers = useMemo(() => {
    return trackerCards.filter(t => hiddenTrackerIds.includes(t.id));
  }, [trackerCards, hiddenTrackerIds]);

  // ─── RENDER ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors?.background || '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient colors={isDark ? [fullThemeColors?.background || '#0a0a1a', fullThemeColors?.surface || '#12122a'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: fullThemeColors?.text || '#1a1a1a' }]}>{safeStr(currentBaby?.name, 'Baby')}'s Hub</Text>
        <Text style={[styles.stickySubtitle, { color: fullThemeColors?.textSecondary || '#64748b' }]}>{format(new Date(), 'EEEE, MMM d')}</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={themeColors?.primary || '#667eea'} colors={[themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2']} />}
      >
        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <BabySwitcherPill baby={currentBaby} onPress={handleSwitchBaby} />
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]} 
              onPress={handleViewTimeline} 
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={22} color={fullThemeColors?.textSecondary || '#64748b'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.addBtn, { backgroundColor: themeColors?.primary || '#667eea' }]} 
              onPress={handleCreateCustom}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── QUICK LOG ─────────────────────────────────────────────────── */}
        <QuickLogStrip onQuickLog={handleQuickLog} />

        {/* ─── TRACKERS ──────────────────────────────────────────────────── */}
        <TrackerCardsGrid 
          trackerCards={trackerCards} 
          pinnedIds={pinnedTrackerIds} 
          hiddenIds={hiddenTrackerIds} 
          onTrackerPress={handleTrackerPress} 
          onCustomPress={handleCreateCustom} 
          onPinToggle={handlePinToggle} 
          onBrowseAll={handleBrowseAll}
          onShowHidden={handleShowHidden}
        />

        {/* ─── QUICK LINKS ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.xl }}>
          <SectionHeader title="Quick Links" icon="link-outline" />
          <View style={styles.quickLinksGrid}>
            {[
              { label: 'Growth', icon: 'trending-up-outline', screen: 'GrowthDashboard' as const, color: '#43e97b' },
              { label: 'Gallery', icon: 'images-outline', screen: 'Gallery' as const, color: '#10b981' },
              { label: 'Family', icon: 'people-outline', screen: 'FamilySharing' as const, color: '#8b5cf6' },
              { label: 'Report', icon: 'document-text-outline', screen: 'PediatricianPDFExport' as const, color: '#ef4444' },
              { label: 'Settings', icon: 'settings-outline', screen: 'BackupRestore' as const, color: '#64748b' },
            ].map((link) => (
              <TouchableOpacity 
                key={link.label} 
                onPress={() => { HAPTIC_LIGHT(); navigation.navigate(link.screen); }} 
                style={[styles.quickLinkBtn, { borderColor: `${link.color}25` }]} 
                activeOpacity={0.8}
              >
                <LinearGradient colors={[`${link.color}08`, `${link.color}02`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <Ionicons name={link.icon as any} size={20} color={link.color} />
                <Text style={[styles.quickLinkText, { color: link.color }]}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: insets.bottom + 20 }} />
      </Animated.ScrollView>

      {/* ─── MODALS ──────────────────────────────────────────────────────── */}
      <TrackerActionModal visible={showActionModal} trackerId={selectedTrackerId} onClose={() => setShowActionModal(false)} onSelect={handleSubActionSelect} />

      <HiddenTrackersModal 
        visible={showHiddenModal} 
        hiddenTrackers={hiddenTrackers} 
        onClose={() => setShowHiddenModal(false)} 
        onUnhide={handleUnhideTracker}
        theme={theme}
      />

      {/* ─── BABY REQUIRED MODAL ───────────────────────────────────────── */}
      <Modal visible={showBabyRequiredModal} transparent animationType="fade" onRequestClose={() => setShowBabyRequiredModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowBabyRequiredModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={styles.modalIconWrap}>
              <LinearGradient colors={[(themeColors?.secondary || '#fa709a'), (themeColors?.primary || '#667eea')]} style={styles.modalIconGradient}>
                <Ionicons name="people-outline" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={[styles.modalTitle, { color: fullThemeColors?.text || '#1a1a1a' }]}>Baby Profile Needed</Text>
            <Text style={[styles.modalDesc, { color: fullThemeColors?.textSecondary || '#64748b' }]}>Create a baby profile to start tracking activities and unlock all features.</Text>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: themeColors?.primary || '#667eea' }]} onPress={() => { setShowBabyRequiredModal(false); navigation.navigate('CreateBabyProfile'); }}>
              <Text style={styles.modalPrimaryBtnText}>Create Baby Profile</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setShowBabyRequiredModal(false)}>
              <Text style={[styles.modalSecondaryBtnText, { color: fullThemeColors?.textMuted || '#94a3b8' }]}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Glass Card ──────────────────────────────────────────────────────
  glassCard: { 
    borderRadius: RADIUS.lg, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg 
  },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  // ── Section Header ──────────────────────────────────────────────────
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.md, 
    marginTop: SPACING.md 
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionHeaderIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Sticky Header ──────────────────────────────────────────────────
  stickyHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 100, 
    alignItems: 'center', 
    paddingHorizontal: SPACING.xl, 
    paddingBottom: SPACING.sm 
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ─────────────────────────────────────────────────────
  topHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.lg 
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: { width: 40, height: 40, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },

  // ── Baby Pill ──────────────────────────────────────────────────────
  babyPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: SPACING.md, 
    paddingVertical: 10, 
    borderRadius: RADIUS.full, 
    alignSelf: 'flex-start', 
    gap: 10, 
    overflow: 'hidden', 
    borderWidth: StyleSheet.hairlineWidth, 
    borderColor: 'rgba(102,126,234,0.15)', 
    flex: 1 
  },
  babyPillText: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 },
  babyPillName: { fontSize: 15, fontWeight: '700', maxWidth: 140 },
  babyPillAge: { fontSize: 12, fontWeight: '600' },
  babyPillNoBabyIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // ── Quick Log ──────────────────────────────────────────────────────
  quickLogScroll: { paddingHorizontal: SPACING.lg, gap: 8, paddingBottom: 4 },
  quickLogChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: SPACING.md, 
    paddingVertical: 10, 
    borderRadius: RADIUS.md, 
    borderWidth: 1.5, 
    overflow: 'hidden' 
  },
  quickLogLabel: { fontWeight: '700', fontSize: 12 },

  // ── Tracker Cards ──────────────────────────────────────────────────
  trackerCategorySection: { marginBottom: SPACING.lg },
  trackerCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.xl, marginBottom: 10 },
  trackerCategoryDot: { width: 6, height: 6, borderRadius: 3 },
  trackerCategoryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  trackerScroll: { paddingHorizontal: SPACING.lg, gap: 10, paddingBottom: 4 },
  trackerFabCard: { width: 140, height: 120, padding: SPACING.md, borderRadius: RADIUS.lg, overflow: 'hidden' },
  trackerFabContent: { flex: 1, justifyContent: 'flex-end' },
  trackerFabEmoji: { fontSize: 28, marginBottom: 6 },
  trackerFabTitle: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  trackerFabMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  trackerFabCount: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  trackerFabLast: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  trackerFabArrow: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  
  // ── Custom Tracker ──────────────────────────────────────────────────
  customTrackerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md, 
    borderRadius: RADIUS.lg, 
    gap: 8, 
    borderWidth: 1.5, 
    borderStyle: 'dashed', 
    overflow: 'hidden' 
  },
  customTrackerIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  customTrackerText: { fontSize: 13, fontWeight: '700' },

  // ── Hidden Banner ──────────────────────────────────────────────────
  hiddenBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: SPACING.md, 
    paddingVertical: SPACING.sm, 
    marginHorizontal: SPACING.lg, 
    marginBottom: SPACING.md,
    gap: 8 
  },
  hiddenBannerText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // ── Quick Links ────────────────────────────────────────────────────
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickLinkBtn: { width: (SCREEN_WIDTH - 56) / 2, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', gap: 6, borderWidth: 1.5, overflow: 'hidden' },
  quickLinkText: { fontSize: 13, fontWeight: '700' },

  // ── Hidden Trackers Modal ──────────────────────────────────────────
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
  hiddenTrackerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  hiddenTrackerEmoji: { fontSize: 24 },
  hiddenTrackerName: { fontSize: 14, fontWeight: '700' },
  hiddenTrackerDesc: { fontSize: 12, fontWeight: '500' },
  hiddenUnhideBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm },
  hiddenUnhideText: { fontSize: 13, fontWeight: '600' },
  hiddenModalDone: { margin: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center' },
  hiddenModalDoneText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hiddenEmptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  hiddenEmptyText: { fontSize: 16, fontWeight: '500' },

  // ── Action Modal ──────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: SCREEN_WIDTH - 40, maxHeight: SCREEN_HEIGHT * 0.7, overflow: 'hidden' },
  modalDragHandle: { paddingVertical: 12, alignItems: 'center' },
  modalDragPill: { width: 40, height: 5, borderRadius: 3 },
  modalHeader: { padding: 20, paddingTop: 24, alignItems: 'center' },
  modalHeaderContent: { alignItems: 'center' },
  modalEmoji: { fontSize: 44, marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalDescription: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 3 },
  modalCloseBtn: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 14 },
  modalSectionTitle: { fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 2, fontSize: 12 },
  subActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  subActionCard: { alignItems: 'center', padding: 12, gap: 8, borderWidth: 1.5 },
  subActionIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  subActionLabel: { fontWeight: '700', textAlign: 'center', fontSize: 13 },

  // ── Baby Required Modal ────────────────────────────────────────────
  modalIconWrap: { marginBottom: SPACING.lg },
  modalIconGradient: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 16, borderRadius: 18, gap: 8, marginBottom: 12 },
  modalPrimaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSecondaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryBtnText: { fontSize: 15, fontWeight: '600' },
});