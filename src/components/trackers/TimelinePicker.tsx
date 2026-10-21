import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Dimensions, Platform, UIManager, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp, FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withRepeat, withSequence, interpolate, Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../hooks/useTrackerContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UnifiedTrackerConfig, TrackerCategory } from '../../types/trackers';
import { RootStackParamList } from '../../types/navigation';
import { CATEGORY_CONFIG } from './trackerConstants';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
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

if (
  Platform.OS === 'android' &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function' &&
  !(global as any).nativeFabricUIManager
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({
  children, style, colors = ['#667eea', '#764ba2', '#f093fb'],
}: {
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
        return (
          <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>
            {l}
          </Text>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Pulse Header (compact for picker)
   ═══════════════════════════════════════════════════════════════════════════ */

const PickerPulse = React.memo(({
  isDark, currentBabyName, currentBabyAvatar, trackerCount, favCount,
  showSearch, onToggleSearch, onClose, primaryColor,
}: {
  isDark: boolean;
  currentBabyName?: string;
  currentBabyAvatar?: string;
  trackerCount: number;
  favCount: number;
  showSearch: boolean;
  onToggleSearch: () => void;
  onClose: () => void;
  primaryColor: string;
}) => {
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

  return (
    <View style={styles.pickerPulseWrap}>
      <LinearGradient
        colors={isDark
          ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)', 'rgba(139,92,246,0.05)']
          : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']}
        style={styles.pickerGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
      <LinearGradient colors={[`${DS.accent}${isDark ? '35' : '22'}`, 'transparent']}
        style={styles.pickerGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

      <View style={styles.pickerPulseRow}>
        {/* Avatar with animated ring */}
        <View style={styles.pickerAvatarWrap}>
          <Animated.View style={[styles.pickerAvatarGlow, { backgroundColor: `${primaryColor}35` }, glowStyle]} />
          <Animated.View style={[styles.pickerAvatarRing, ringStyle]}>
            <LinearGradient
              colors={[primaryColor, DS.accent, DS.warning, primaryColor]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <View style={[styles.pickerAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
            <SafeAvatar avatar={currentBabyAvatar} size={40} fallbackIcon="person" borderWidth={0} animated={false} />
          </View>
        </View>

        {/* Title */}
        <View style={{ flex: 1 }}>
          <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.pickerTitle}>
            LOG ENTRY
          </GradientText>
          <View style={styles.pickerSubRow}>
            <View style={[styles.pickerLiveDot, { backgroundColor: DS.success }]} />
            <Text style={[styles.pickerSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {currentBabyName ? `For ${currentBabyName}` : 'Select tracker'} · {trackerCount} available
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.pickerActions}>
          <TouchableOpacity
            onPress={() => { HAPTIC_LIGHT(); onToggleSearch(); }}
            style={[styles.pickerIconBtn, {
              backgroundColor: showSearch ? `${primaryColor}20` : isDark ? 'rgba(255,255,255,0.06)' : DS.gray100,
            }]}
          >
            <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={showSearch ? primaryColor : isDark ? DS.gray300 : DS.gray600} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { HAPTIC_LIGHT(); onClose(); }}
            style={[styles.pickerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats strip */}
      <View style={[styles.pickerStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
        <View style={styles.pickerStat}>
          <Text style={[styles.pickerStatVal, { color: primaryColor }]}>{trackerCount}</Text>
          <Text style={[styles.pickerStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>trackers</Text>
        </View>
        <View style={[styles.pickerStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
        <View style={styles.pickerStat}>
          <Text style={[styles.pickerStatVal, { color: DS.warning }]}>{favCount}</Text>
          <Text style={[styles.pickerStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>favorites</Text>
        </View>
        <View style={[styles.pickerStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
        <View style={styles.pickerStat}>
          <Text style={[styles.pickerStatVal, { color: DS.success }]}>
            {Object.keys(CATEGORY_CONFIG).length}
          </Text>
          <Text style={[styles.pickerStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>categories</Text>
        </View>
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Insight Ribbon
   ═══════════════════════════════════════════════════════════════════════════ */

const PickerRibbon = React.memo(({
  isDark, icon, color, label, text,
}: {
  isDark: boolean; icon: keyof typeof Ionicons.glyphMap; color: string;
  label: string; text: string;
}) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <View style={[styles.ribbon, {
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white,
      borderColor: isDark ? DS.darkBorder : DS.gray200,
    }]}>
      <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
        <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={1}>{text}</Text>
      </View>
    </View>
  </Animated.View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Category Section (Reanimated chevron)
   ═══════════════════════════════════════════════════════════════════════════ */

const CategorySection: React.FC<{
  category: TrackerCategory;
  trackers: UnifiedTrackerConfig[];
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTracker: (tracker: UnifiedTrackerConfig) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  searchQuery: string;
  customization: ReturnType<typeof useCustomization>;
}> = ({ category, trackers, isExpanded, onToggle, onSelectTracker, isFavorite, onToggleFavorite, searchQuery, customization }) => {
  if (trackers.length === 0) return null;

  const config = CATEGORY_CONFIG[category];
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier, shouldReduceMotion } = customization;

  const rotation = useSharedValue(isExpanded || !!searchQuery ? 1 : 0);
  useEffect(() => {
    rotation.value = withTiming((isExpanded || !!searchQuery) ? 1 : 0, { duration: 250 });
  }, [isExpanded, searchQuery, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={styles.categorySection}>
      <TouchableOpacity
        style={[styles.categoryHeader, {
          backgroundColor: fullThemeColors.glassBg,
          borderRadius: borderRadiusValue,
          borderColor: fullThemeColors.border,
        }]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={[styles.categoryIcon, { backgroundColor: `${config.color}20` }]}>
          <Text style={styles.categoryIconEmoji}>{config.emoji}</Text>
        </View>
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryLabel, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
            {config.label}
          </Text>
          <Text style={[styles.categoryCount, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
            {config.description} • {trackers.length} tracker{trackers.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={20} color={fullThemeColors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      {(isExpanded || !!searchQuery) && (
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.duration(200)} style={styles.trackersGrid}>
          {trackers.map((tracker, index) => {
            const fav = isFavorite(tracker.id);
            return (
              <Animated.View
                key={tracker.id}
                entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 30)}
                style={{ width: '50%', padding: 4 }}
              >
                <TouchableOpacity
                  style={[styles.trackerCard, {
                    backgroundColor: fullThemeColors.surface,
                    borderRadius: borderRadiusValue,
                    borderColor: fav ? `${DS.warning}50` : fullThemeColors.border,
                    borderWidth: fav ? 1.5 : 1,
                    ...Platform.select({
                      ios: { shadowColor: fav ? DS.warning : '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: fav ? 0.12 : 0.06, shadowRadius: 8 },
                      android: { elevation: fav ? 3 : 2 },
                    }),
                  }]}
                  onPress={() => onSelectTracker(tracker)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={tracker.gradient}
                    style={[styles.trackerGradient, { borderRadius: borderRadiusValue }]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.trackerCardContent}>
                      <View style={styles.trackerEmojiRow}>
                        <Text style={styles.trackerEmoji}>{tracker.emoji}</Text>
                        <TouchableOpacity
                          style={styles.favoriteBtn}
                          onPress={(e) => { e.stopPropagation(); onToggleFavorite(tracker.id); }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name={fav ? 'star' : 'star-outline'}
                            size={16}
                            color={fav ? '#fdcb6e' : 'rgba(255,255,255,0.6)'}
                          />
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.trackerName, { fontSize: 14 * fontSizeMultiplier }]} numberOfLines={1}>
                        {tracker.name}
                      </Text>
                      <Text style={[styles.trackerDesc, { fontSize: 11 * fontSizeMultiplier }]} numberOfLines={2}>
                        {tracker.description}
                      </Text>
                      {tracker.isCustom && (
                        <View style={styles.customBadge}>
                          <Text style={styles.customBadgeText}>Custom</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      )}
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TimelinePicker
   ═══════════════════════════════════════════════════════════════════════════ */

interface TimelinePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (trackerId: string) => void;
  currentBabyName?: string;
  currentBabyAvatar?: string;
}

export const TimelinePicker: React.FC<TimelinePickerProps> = ({
  visible, onClose, onSelect, currentBabyName, currentBabyAvatar,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const customization = useCustomization();
  const {
    fullThemeColors, themeColors, isDark, borderRadiusValue,
    fontSizeMultiplier, shouldReduceMotion, triggerHaptic,
  } = customization;

  const { trackers } = useTracker();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<TrackerCategory>>(
    new Set(['essential', 'custom'])
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentTrackers, setRecentTrackers] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const searchHeight = useSharedValue(0);
  const searchOpacity = useSharedValue(0);

  useEffect(() => {
    if (showSearch) {
      searchHeight.value = withSpring(60, { damping: 18, stiffness: 220 });
      searchOpacity.value = withTiming(1, { duration: 200 });
      setTimeout(() => searchInputRef.current?.focus(), 250);
    } else {
      searchHeight.value = withTiming(0, { duration: 200 });
      searchOpacity.value = withTiming(0, { duration: 200 });
      Keyboard.dismiss();
      setSearchQuery('');
    }
  }, [showSearch, searchHeight, searchOpacity]);

  const searchAnimatedStyle = useAnimatedStyle(() => ({
    height: searchHeight.value,
    opacity: searchOpacity.value,
    overflow: 'hidden',
  }));

  const filteredTrackers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return trackers;
    return trackers.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.quickTags.some(tag => tag.toLowerCase().includes(q))
    );
  }, [trackers, searchQuery]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<TrackerCategory, UnifiedTrackerConfig[]> = {} as any;
    filteredTrackers.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTrackers]);

  const sortedCategories = useMemo(() =>
    (Object.keys(groupedByCategory) as TrackerCategory[]).sort(
      (a, b) => CATEGORY_CONFIG[a].priority - CATEGORY_CONFIG[b].priority
    ), [groupedByCategory]);

  const favoriteTrackers = useMemo(
    () => trackers.filter(t => favorites.has(t.id)),
    [trackers, favorites]
  );
  const recentTrackerObjects = useMemo(() =>
    recentTrackers.map(id => trackers.find(t => t.id === id)).filter(Boolean) as UnifiedTrackerConfig[],
    [recentTrackers, trackers]
  );

  const toggleCategory = useCallback((cat: TrackerCategory) => {
    triggerHaptic('light');
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, [triggerHaptic]);

  const toggleFavorite = useCallback((id: string) => {
    triggerHaptic('light');
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [triggerHaptic]);

  const handleSelectTracker = useCallback((tracker: UnifiedTrackerConfig) => {
    triggerHaptic('medium');
    setRecentTrackers(prev => [tracker.id, ...prev.filter(id => id !== tracker.id)].slice(0, 5));
    onSelect(tracker.id);
  }, [triggerHaptic, onSelect]);

  const handleCreateCustom = useCallback(() => {
    triggerHaptic('medium');
    onClose();
    navigation.navigate('CreateCustomTracker');
  }, [triggerHaptic, onClose, navigation]);

  const expandAll = useCallback(() => {
    triggerHaptic('light');
    setExpandedCategories(new Set(sortedCategories));
  }, [sortedCategories, triggerHaptic]);

  const collapseAll = useCallback(() => {
    triggerHaptic('light');
    setExpandedCategories(new Set());
  }, [triggerHaptic]);

  const primary = themeColors?.primary || DS.primary;

  /* Insight ribbon — contextual */
  const ribbon = useMemo(() => {
    if (searchQuery) {
      return {
        icon: 'search-outline' as const,
        color: DS.info,
        label: 'Search',
        text: `${filteredTrackers.length} match${filteredTrackers.length !== 1 ? 'es' : ''} for "${searchQuery}"`,
      };
    }
    if (favorites.size === 0 && trackers.length > 0) {
      return {
        icon: 'star-outline' as const,
        color: DS.warning,
        label: 'Tip',
        text: 'Tap ⭐ on any tracker to pin it for quick access',
      };
    }
    if (favorites.size > 0) {
      return {
        icon: 'star' as const,
        color: DS.warning,
        label: 'Favorites',
        text: `${favorites.size} pinned tracker${favorites.size !== 1 ? 's' : ''} appear first`,
      };
    }
    return {
      icon: 'sparkles-outline' as const,
      color: primary,
      label: 'Ready',
      text: 'Select a tracker to log an entry',
    };
  }, [searchQuery, filteredTrackers.length, favorites.size, trackers.length, primary]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <BlurView intensity={isDark ? 60 : 80} style={styles.blurView} tint={isDark ? 'dark' : 'light'}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeInUp.springify().damping(15)}
          style={[styles.modalContainer, {
            backgroundColor: fullThemeColors.background,
            borderRadius: borderRadiusValue * 2,
            borderColor: fullThemeColors.border,
          }]}
        >
          {/* PULSE HEADER */}
          <PickerPulse
            isDark={isDark}
            currentBabyName={currentBabyName}
            currentBabyAvatar={currentBabyAvatar}
            trackerCount={trackers.length}
            favCount={favorites.size}
            showSearch={showSearch}
            onToggleSearch={() => setShowSearch(v => !v)}
            onClose={onClose}
            primaryColor={primary}
          />

          {/* INSIGHT RIBBON */}
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <PickerRibbon isDark={isDark} {...ribbon} />
          </View>

          {/* Search bar (animated) */}
          <Animated.View style={[searchAnimatedStyle, { paddingHorizontal: 16, marginTop: 8 }]}>
            <View style={[styles.searchContainer, {
              backgroundColor: fullThemeColors.surface,
              borderRadius: borderRadiusValue,
            }]}>
              <Ionicons name="search" size={18} color={fullThemeColors.textSecondary} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]}
                placeholder="Search trackers..."
                placeholderTextColor={fullThemeColors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={fullThemeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Quick actions */}
          {!showSearch && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: `${primary}15`, borderRadius: borderRadiusValue }]}
                onPress={expandAll}
              >
                <Ionicons name="expand" size={14} color={primary} />
                <Text style={[styles.quickActionText, { color: primary, fontSize: 12 * fontSizeMultiplier }]}>
                  Expand All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]}
                onPress={collapseAll}
              >
                <Ionicons name="contract" size={14} color={fullThemeColors.textSecondary} />
                <Text style={[styles.quickActionText, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
                  Collapse
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: `${CATEGORY_CONFIG.custom.color}15`, borderRadius: borderRadiusValue }]}
                onPress={handleCreateCustom}
              >
                <Ionicons name="add-circle" size={14} color={CATEGORY_CONFIG.custom.color} />
                <Text style={[styles.quickActionText, { color: CATEGORY_CONFIG.custom.color, fontSize: 12 * fontSizeMultiplier }]}>
                  New
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Recent */}
            {recentTrackerObjects.length > 0 && !searchQuery && (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
                  RECENT
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
                  {recentTrackerObjects.map((tracker, idx) => (
                    <Animated.View key={tracker.id} entering={shouldReduceMotion ? undefined : FadeInUp.delay(idx * 50)}>
                      <TouchableOpacity
                        style={[styles.recentChip, {
                          backgroundColor: fullThemeColors.surface,
                          borderColor: fullThemeColors.border,
                          borderRadius: borderRadiusValue,
                        }]}
                        onPress={() => handleSelectTracker(tracker)}
                      >
                        <LinearGradient
                          colors={tracker.gradient}
                          style={[styles.recentChipGradient, { borderRadius: borderRadiusValue }]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.recentChipEmoji}>{tracker.emoji}</Text>
                          <Text style={[styles.recentChipText, { fontSize: 13 * fontSizeMultiplier }]} numberOfLines={1}>
                            {tracker.name}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {/* Favorites */}
            {favoriteTrackers.length > 0 && !searchQuery && (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="star" size={14} color={DS.warning} />
                  <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
                    FAVORITES
                  </Text>
                  <View style={[styles.favBadge, { backgroundColor: `${DS.warning}18` }]}>
                    <Text style={[styles.favBadgeText, { color: DS.warning }]}>{favoriteTrackers.length}</Text>
                  </View>
                </View>
                <View style={styles.favoritesGrid}>
                  {favoriteTrackers.map((tracker, idx) => (
                    <Animated.View key={tracker.id} entering={shouldReduceMotion ? undefined : FadeInUp.delay(idx * 50)} style={{ width: '50%', padding: 4 }}>
                      <TouchableOpacity
                        style={[styles.favoriteCard, {
                          backgroundColor: fullThemeColors.surface,
                          borderColor: `${DS.warning}40`,
                          borderRadius: borderRadiusValue,
                          borderWidth: 1.5,
                        }]}
                        onPress={() => handleSelectTracker(tracker)}
                      >
                        <LinearGradient
                          colors={tracker.gradient}
                          style={[styles.favoriteGradient, { borderRadius: borderRadiusValue }]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        >
                          <Text style={styles.favoriteEmoji}>{tracker.emoji}</Text>
                          <Text style={[styles.favoriteName, { fontSize: 14 * fontSizeMultiplier }]} numberOfLines={1}>
                            {tracker.name}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Categories */}
            <View style={styles.categoriesContainer}>
              {searchQuery && filteredTrackers.length === 0 ? (
                <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.emptySearch}>
                  <Ionicons name="search-outline" size={48} color={fullThemeColors.textSecondary} />
                  <Text style={[styles.emptySearchText, { color: fullThemeColors.textSecondary, fontSize: 16 * fontSizeMultiplier }]}>
                    No trackers found for "{searchQuery}"
                  </Text>
                  <TouchableOpacity
                    style={[styles.createFromSearchBtn, { backgroundColor: `${CATEGORY_CONFIG.custom.color}20`, borderRadius: borderRadiusValue }]}
                    onPress={handleCreateCustom}
                  >
                    <Ionicons name="add-circle" size={18} color={CATEGORY_CONFIG.custom.color} />
                    <Text style={[styles.createFromSearchText, { color: CATEGORY_CONFIG.custom.color, fontSize: 14 * fontSizeMultiplier }]}>
                      Create "{searchQuery}" tracker
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                sortedCategories.map(category => (
                  <CategorySection
                    key={category}
                    category={category}
                    trackers={groupedByCategory[category] || []}
                    isExpanded={expandedCategories.has(category)}
                    onToggle={() => toggleCategory(category)}
                    onSelectTracker={handleSelectTracker}
                    isFavorite={id => favorites.has(id)}
                    onToggleFavorite={toggleFavorite}
                    searchQuery={searchQuery}
                    customization={customization}
                  />
                ))
              )}
            </View>
            <View style={styles.bottomSpacing} />
          </ScrollView>

          {/* Floating create button */}
          <View style={styles.floatingFooter}>
            <LinearGradient
              colors={['transparent', fullThemeColors.background]}
              style={styles.footerGradient}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={[styles.createTrackerBtn, {
                backgroundColor: CATEGORY_CONFIG.custom.color,
                borderRadius: borderRadiusValue,
                shadowColor: CATEGORY_CONFIG.custom.color,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }]}
              onPress={handleCreateCustom}
              activeOpacity={0.9}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={[styles.createTrackerText, { fontSize: 16 * fontSizeMultiplier }]}>
                Create Custom Tracker
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </BlurView>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, justifyContent: 'flex-end' },
  blurView: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.88,
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 20 },
    }),
  },

  /* Picker pulse */
  pickerPulseWrap: {
    padding: DS.space.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  pickerGlowL: { position: 'absolute', top: -80, left: -60, width: 200, height: 200, borderRadius: 100, opacity: 0.9 },
  pickerGlowR: { position: 'absolute', top: -70, right: -70, width: 180, height: 180, borderRadius: 90, opacity: 0.8 },
  pickerPulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pickerAvatarWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pickerAvatarGlow: { position: 'absolute', width: 58, height: 58, borderRadius: 29 },
  pickerAvatarRing: { position: 'absolute', width: 54, height: 54, borderRadius: 27, overflow: 'hidden' },
  pickerAvatarInner: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pickerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  pickerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  pickerLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pickerSubText: { fontSize: 11.5, fontWeight: '500', flex: 1 },
  pickerActions: { flexDirection: 'row', gap: 6 },
  pickerIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pickerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.md,
  },
  pickerStat: { alignItems: 'center', flex: 1 },
  pickerStatVal: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  pickerStatLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pickerStatDiv: { width: 1, height: 22 },

  /* Ribbon */
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  ribbonIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  /* Search */
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  searchInput: { flex: 1, fontWeight: '500', padding: 0 },

  /* Quick actions */
  quickActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginTop: 12,
  },
  quickActionBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  quickActionText: { fontWeight: '600' },

  /* Scroll content */
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  /* Section */
  section: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  favBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  favBadgeText: { fontSize: 9, fontWeight: '800' },

  /* Recent */
  recentScroll: { paddingRight: 16, gap: 8 },
  recentChip: { borderWidth: 1, overflow: 'hidden', minWidth: 120 },
  recentChipGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  recentChipEmoji: { fontSize: 20 },
  recentChipText: { color: '#fff', fontWeight: '700' },

  /* Favorites */
  favoritesGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  favoriteCard: { overflow: 'hidden' },
  favoriteGradient: { padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 80 },
  favoriteEmoji: { fontSize: 32, marginBottom: 6 },
  favoriteName: { color: '#fff', fontWeight: '700', textAlign: 'center' },

  /* Categories */
  categoriesContainer: { gap: 8 },
  categorySection: { marginBottom: 4 },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1,
  },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  categoryIconEmoji: { fontSize: 18 },
  categoryInfo: { flex: 1 },
  categoryLabel: { fontWeight: '700' },
  categoryCount: { marginTop: 2, fontWeight: '500' },

  /* Tracker grid */
  trackersGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 8, paddingLeft: 8 },
  trackerCard: { overflow: 'hidden' },
  trackerGradient: { padding: 12, minHeight: 100 },
  trackerCardContent: { flex: 1 },
  trackerEmojiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trackerEmoji: { fontSize: 28 },
  favoriteBtn: { padding: 4 },
  trackerName: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  trackerDesc: { color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
  customBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    alignSelf: 'flex-start', marginTop: 6,
  },
  customBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  /* Empty search */
  emptySearch: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptySearchText: { fontWeight: '600', textAlign: 'center' },
  createFromSearchBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, gap: 8,
  },
  createFromSearchText: { fontWeight: '700' },

  /* Footer */
  floatingFooter: {
    position: 'relative', paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16, paddingTop: 8,
  },
  footerGradient: { position: 'absolute', top: -40, left: 0, right: 0, height: 60 },
  createTrackerBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 16, gap: 8,
  },
  createTrackerText: { color: '#fff', fontWeight: '700' },
  bottomSpacing: { height: 20 },
});

export default TimelinePicker;