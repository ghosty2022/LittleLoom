import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { useCustomization } from '../../hooks/useCustomization';
import { useTrackerProgressive } from '../../hooks';
import { useBaby } from '../../context/BabyContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { DEFAULT_TRACKERS, getDefaultTrackerIds } from '../../config/defaultTrackers';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── DESIGN TOKENS — Unified with TrackerHub ──────────────────────────────

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

const SHADOW = {
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
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
};

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#10b981',
  health: '#ef4444',
  development: '#f59e0b',
  care: '#8b5cf6',
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// ─── THEME HOOK — Unified with TrackerHub ──────────────────────────────────

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

// ─── GLASS CARD — Matches EnhancedTimelineScreen ──────────────────────────

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

// ─── SECTION HEADER — Matches EnhancedTimelineScreen ──────────────────────

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
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <Animated.View 
        entering={FadeInUp.springify().damping(15).stiffness(200)}
        style={[
          styles.sheetContent,
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

type AllTrackersNavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────

export default function AllTrackersScreen() {
  const navigation = useNavigation<AllTrackersNavProp>();
  const insets = useSafeAreaInsets();
  const { isDark, fullThemeColors, colors, borderRadiusValue, triggerHaptic, shouldReduceMotion } = useCustomization();
  
  // Safely use hooks with fallbacks
  const trackerHook = useTrackerProgressive();
  const { entries = [], getEntries = () => [], trackers = [], isLoading = false, refreshEntries = () => {} } = trackerHook || {};
  
  const babyHook = useBaby();
  const { currentBaby = null, isLoading: babyLoading = false, refreshCurrentBaby = () => {}, loadBabies = () => {} } = babyHook || {};
  
  const theme = useHubTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load pinned/hidden from storage
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

  // Refresh data on focus - with safe checks
  useFocusEffect(
    useCallback(() => {
      if (typeof refreshEntries === 'function') {
        refreshEntries();
      }
      if (typeof refreshCurrentBaby === 'function') {
        refreshCurrentBaby();
      }
      if (typeof loadBabies === 'function') {
        loadBabies();
      }
    }, [refreshEntries, refreshCurrentBaby, loadBabies])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof refreshEntries === 'function') {
        await refreshEntries();
      }
      if (typeof refreshCurrentBaby === 'function') {
        await refreshCurrentBaby();
      }
      if (typeof loadBabies === 'function') {
        await loadBabies();
      }
    } catch (error) {
      console.warn('Refresh error:', error);
    }
    setRefreshing(false);
  }, [refreshEntries, refreshCurrentBaby, loadBabies]);

  // ─── FIXED: Build tracker cards from ALL available trackers ──────────────
  const trackerCards = useMemo(() => {
    if (!currentBaby) return [];
    
    // Get all tracker IDs from DEFAULT_TRACKERS config
    const allTrackerIds = DEFAULT_TRACKERS.map(t => t.id);
    
    // Build cards for ALL trackers, not just ones with entries
    return allTrackerIds.map((id) => {
      const config = TRACKER_CONFIGS[id];
      // If config doesn't exist, skip this tracker
      if (!config) return null;
      
      const entriesForTracker = typeof getEntries === 'function' ? getEntries(id) : [];
      const lastEntry = entriesForTracker && entriesForTracker.length > 0 ? entriesForTracker[0] : null;
      
      return {
        id,
        title: id.charAt(0).toUpperCase() + id.slice(1),
        emoji: config.emoji,
        color: config.color,
        gradient: config.gradient,
        category: config.category,
        count: entriesForTracker ? entriesForTracker.length : 0,
        lastEntry: lastEntry && lastEntry.timestamp
          ? new Date(lastEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
        hasSubActions: !!(config.subActions && config.subActions.length > 0),
      };
    }).filter(Boolean) as any[];
  }, [getEntries, currentBaby]);

  const categories = useMemo(() => {
    const cats = [...new Set(trackerCards.map(t => t.category))];
    return cats.sort();
  }, [trackerCards]);

  const filtered = useMemo(() => {
    let res = trackerCards.filter((t: any) => !hiddenIds.includes(t.id));
    if (activeCategory) res = res.filter((t: any) => t.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter((t: any) =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (TRACKER_CONFIGS[t.id]?.description || '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [trackerCards, activeCategory, searchQuery, hiddenIds]);

  // Sort pinned first, then by count (with 0 count trackers at the end)
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      // If both pinned or both not pinned, sort by count (higher first)
      return b.count - a.count;
    });
  }, [filtered, pinnedIds]);

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
  }, []);

  const handleHideToggle = useCallback((id: string) => {
    HAPTIC_LIGHT();
    setHiddenIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleCustomPress = useCallback(() => {
    HAPTIC_MEDIUM();
    navigation.navigate('CreateCustomTracker');
  }, [navigation]);

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.statusBar} />
      
      <LinearGradient colors={theme.isDark ? [theme.bgColors[0], theme.bgColors[1]] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={StyleSheet.absoluteFill} />

      {/* Header - Like EnhancedTimelineScreen */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient colors={[`${theme.primary}15`, `${theme.secondary}08`, 'transparent']} style={styles.headerGradient} />
        
        {/* Top Row - Like TrackerHub */}
        <View style={styles.topHeader}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text.secondary} />
          </TouchableOpacity>

          {/* Baby Switcher Pill - Like TrackerHub */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('SwitchBaby', { returnTo: 'AllTrackers', returnLabel: 'All Trackers' })} 
            style={styles.babyPill}
          >
            <LinearGradient
              colors={theme.isDark ? ['#2a2a4a', '#1a1a3e'] : ['#f0f4ff', '#e8eeff']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {currentBaby ? (
              <>
                <SafeAvatar avatar={currentBaby.avatar} gender={currentBaby.gender} size={36} fallbackIcon="happy-outline" fallbackColor={theme.primary} />
                <View style={styles.babyPillText}>
                  <Text style={[styles.babyPillName, { color: theme.text.primary }]} numberOfLines={1}>{currentBaby.name}</Text>
                  <Text style={[styles.babyPillAge, { color: theme.text.secondary }]}>
                    {(() => {
                      if (!currentBaby.birthDate) return '—';
                      const diff = new Date().getTime() - new Date(currentBaby.birthDate).getTime();
                      const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
                      return `${months}mo`;
                    })()}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={theme.text.muted} />
              </>
            ) : (
              <>
                <View style={[styles.babyPillNoBabyIcon, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(102,126,234,0.1)' }]}>
                  <Ionicons name="add-circle" size={28} color={theme.isDark ? '#a3bffa' : '#667eea'} />
                </View>
                <View style={styles.babyPillText}>
                  <Text style={[styles.babyPillName, { color: theme.isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>Add Baby</Text>
                  <Text style={[styles.babyPillAge, { color: theme.isDark ? '#94a3b8' : '#64748b' }]}>Tap to create profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setSearchQuery(searchQuery ? '' : '')} 
            style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name={searchQuery ? 'close' : 'search'} size={22} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={theme.primary} 
            colors={[theme.primary, theme.secondary]} 
            progressViewOffset={insets.top + 120}
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

        {/* Stats Overview - Like EnhancedTimelineScreen */}
        {trackerCards.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.statsContainer}>
            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
              <View style={[styles.kpiCard, { borderRadius: theme.borderRadius, borderColor: `${theme.primary}30`, backgroundColor: theme.isDark ? 'rgba(45,45,60,0.4)' : 'rgba(102,126,234,0.06)' }]}>
                <View style={styles.kpiTop}>
                  <Ionicons name="albums-outline" size={18} color={theme.primary} />
                </View>
                <Text style={[styles.kpiValue, { color: theme.text.primary }]}>{trackerCards.length}</Text>
                <Text style={[styles.kpiLabel, { color: theme.text.muted }]}>Trackers</Text>
                <Text style={[styles.kpiSub, { color: theme.text.secondary }]}>{hiddenIds.length} hidden</Text>
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
                <Text style={[styles.kpiSub, { color: theme.text.secondary }]}>Filter by type</Text>
              </View>
            </Animated.ScrollView>
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
          {sortedFiltered.length > 0 ? (
            sortedFiltered.map((tracker: any, index: number) => {
              const isPinned = pinnedIds.includes(tracker.id);
              const isHidden = hiddenIds.includes(tracker.id);
              if (isHidden) return null;
              
              return (
                <Animated.View
                  key={tracker.id}
                  entering={FadeInUp.delay(index * 40).springify()}
                  style={styles.gridItem}
                >
                  <TouchableOpacity
                    onPress={() => handleTrackerPress(tracker.id, tracker.hasSubActions)}
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
            </View>
          )}
        </Animated.View>

        {/* Create Custom Tracker Button */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <TouchableOpacity
            onPress={handleCustomPress}
            style={[styles.customBtn, { borderColor: theme.surface.border, marginHorizontal: SPACING.lg, marginTop: SPACING.md }]}
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
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
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

  // ── Scroll Content ──
  scrollContent: { paddingBottom: 20 },

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
  emptySubtitle: { fontWeight: '500', textAlign: 'center', lineHeight: 22, fontSize: 15 },

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
});