import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  format,
  isThisMonth,
  isThisWeek,
  isToday,
  isYesterday,
  parseISO,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../hooks/useTrackerContext';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useVaultUnlock } from '../../hooks/useVaultUnlock';
import type { RootStackParamList } from '../../types/navigation';
import { UnifiedPhoto } from '../../types/photos';
import {
  loadPhotoMetadata,
  saveFavorites,
  savePrivates,
  saveCaptions,
  saveLocalPhotos,
  buildUnifiedGallery,
  buildLocalCapturePhoto,
  toggleInSet,
  PhotoMetadata,
} from '../../services/photoService';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
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

const GRID = {
  columns: 3,
  spacing: 4,
  get itemSize() {
    return (SCREEN_W - 32 - (this.columns - 1) * this.spacing) / this.columns;
  },
};

const STORAGE_KEYS = {
  FAVORITES: '@littleloom_gallery_favorites_v2',
  PRIVATE: '@littleloom_gallery_private_v2',
  TAGS: '@littleloom_gallery_tags_v2',
  CAPTIONS: '@littleloom_gallery_captions_v2',
  VIEW_MODE: '@littleloom_gallery_view_mode_v2',
  GALLERY_TAB: '@littleloom_gallery_tab_v2',
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const HAPTIC_HEAVY = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type GalleryTab = 'all' | 'albums' | 'timeline' | 'favorites' | 'vault';
type ViewMode = 'grid' | 'list';
type GalleryPhoto = UnifiedPhoto;

interface DateGroup {
  date: string;
  label: string;
  photos: GalleryPhoto[];
}

interface PhotoStack {
  id: string;
  coverPhoto: GalleryPhoto;
  photos: GalleryPhoto[];
  count: number;
  label: string;
  timestamp: number;
}

interface PhotoStory {
  id: string;
  title: string;
  coverUri: string;
  photoCount: number;
  dateRange: string;
  gradient: [string, string];
}

interface SmartAlbum {
  id: string;
  title: string;
  icon: string;
  emoji: string;
  count: number;
  gradient: [string, string];
  filter: (photo: GalleryPhoto) => boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES
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

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel, isDark }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; color?: string;
  action?: () => void; actionLabel?: string; isDark: boolean;
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>{subtitle}</Text>}
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
   Gallery Pulse — compact animated header (no top header row)
   ═══════════════════════════════════════════════════════════════════════════ */

const GalleryPulse = React.memo<{
  isDark: boolean;
  currentBaby: any;
  stats: { photos: number; favorites: number; albums: number; vaultCount: number };
  vaultUnlocked: boolean;
  isBatchMode: boolean;
  viewMode: ViewMode;
  onAvatarPress: () => void;
  onCameraPress: () => void;
  onToggleViewMode: () => void;
  onToggleBatch: () => void;
}>(({
  isDark, currentBaby, stats, vaultUnlocked, isBatchMode, viewMode,
  onAvatarPress, onCameraPress, onToggleViewMode, onToggleBatch,
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

  const statusColor = isBatchMode ? DS.warning : stats.photos > 0 ? DS.success : DS.primary;
  const statusLabel = isBatchMode
    ? 'Selecting photos'
    : stats.photos === 0
    ? 'Tap camera to capture your first memory'
    : `${stats.photos} memor${stats.photos === 1 ? 'y' : 'ies'}${vaultUnlocked ? ' · vault unlocked' : ''}`;

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
                {currentBaby?.avatar ? (
                  <Image source={{ uri: currentBaby.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <Ionicons name="images" size={22} color={DS.primary} />
                )}
              </View>
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {currentBaby ? `${currentBaby.name}'s Gallery` : 'Gallery'}
              </Text>
              {vaultUnlocked && (
                <View style={[styles.pulseAgePill, { backgroundColor: `${DS.success}20` }]}>
                  <Ionicons name="lock-open" size={9} color={DS.success} />
                  <Text style={[styles.pulseAgeText, { color: DS.success }]}>Unlocked</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={[styles.pulseLiveDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.pulseSubText, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressableScale onPress={onToggleViewMode} activeScale={0.9}>
              <View style={[styles.pulseIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons
                  name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
                  size={18}
                  color={isDark ? DS.gray300 : DS.gray600}
                />
              </View>
            </PressableScale>
            <PressableScale onPress={onToggleBatch} activeScale={0.9}>
              <View style={[
                styles.pulseIconBtn,
                {
                  backgroundColor: isBatchMode ? `${DS.primary}20` : isDark ? 'rgba(255,255,255,0.06)' : DS.gray100,
                },
              ]}>
                <Ionicons
                  name={isBatchMode ? 'checkmark-circle' : 'checkbox-outline'}
                  size={18}
                  color={isBatchMode ? DS.primary : isDark ? DS.gray300 : DS.gray600}
                />
              </View>
            </PressableScale>
            <PressableScale onPress={onCameraPress} activeScale={0.9}>
              <LinearGradient colors={[DS.primary, DS.accent]} style={styles.pulseAddBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="camera" size={20} color={DS.white} />
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        <View style={[styles.pulseStats, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)' }]}>
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.primary }]}>{stats.photos}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>photos</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.danger }]}>{stats.favorites}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>loved</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: DS.warning }]}>{stats.albums}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>albums</Text>
          </View>
          <View style={[styles.pulseStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
          <View style={styles.pulseStat}>
            <Text style={[styles.pulseStatVal, { color: stats.vaultCount > 0 ? DS.success : DS.gray400 }]}>{stats.vaultCount}</Text>
            <Text style={[styles.pulseStatLbl, { color: isDark ? DS.gray400 : DS.gray500 }]}>vault</Text>
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
   Tab Bar
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: {
  tabs: { key: GalleryTab; label: string; icon: string }[];
  activeTab: GalleryTab;
  onChange: (t: GalleryTab) => void;
  isDark: boolean;
}) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tabItem, isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]}
          activeOpacity={0.85}
        >
          <Ionicons name={tab.icon as any} size={15} color={isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500} />
          <Text style={[styles.tabLabel, { color: isActive ? DS.primary : isDark ? DS.gray400 : DS.gray500 }, isActive && { fontWeight: '700' }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Search Chips
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartSearchChips = React.memo(({ photos, onFilter }: {
  photos: GalleryPhoto[]; onFilter: (f: string) => void;
}) => {
  const chips = useMemo(() => {
    if (photos.length === 0) return [];
    const thisWeek = photos.filter((p) => isThisWeek(new Date(p.timestamp))).length;
    const thisMonth = photos.filter((p) => isThisMonth(new Date(p.timestamp))).length;
    const favorites = photos.filter((p) => p.isFavorite).length;
    const milestones = photos.filter((p) => p.type === 'milestone').length;
    const fromTracker = photos.filter((p) => p.source === 'tracker').length;
    return [
      { label: 'Favorites', icon: 'heart', count: favorites, color: DS.danger },
      { label: 'This Week', icon: 'calendar', count: thisWeek, color: DS.info },
      { label: 'This Month', icon: 'calendar-outline', count: thisMonth, color: DS.success },
      { label: 'Milestones', icon: 'trophy', count: milestones, color: DS.warning },
      { label: 'From Trackers', icon: 'link', count: fromTracker, color: '#8b5cf6' },
    ].filter((c) => c.count > 0);
  }, [photos]);

  if (chips.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 4 }}>
      {chips.map((chip) => (
        <TouchableOpacity
          key={chip.label}
          onPress={() => onFilter(chip.label)}
          style={[styles.chip, { backgroundColor: `${chip.color}12`, borderColor: `${chip.color}30` }]}
          activeOpacity={0.85}
        >
          <Ionicons name={chip.icon as any} size={13} color={chip.color} />
          <Text style={[styles.chipLabel, { color: chip.color }]}>{chip.label}</Text>
          <View style={[styles.chipCount, { backgroundColor: `${chip.color}20` }]}>
            <Text style={[styles.chipCountText, { color: chip.color }]}>{chip.count}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Stacks
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartStacks = React.memo(({ photos, onOpenStack, isDark }: {
  photos: GalleryPhoto[]; onOpenStack: (s: PhotoStack) => void; isDark: boolean;
}) => {
  const stacks = useMemo((): PhotoStack[] => {
    if (photos.length < 4) return [];
    const sorted = [...photos].sort((a, b) => b.timestamp - a.timestamp);
    const groups: PhotoStack[] = [];
    let current: GalleryPhoto[] = [];

    sorted.forEach((photo) => {
      if (current.length === 0) current.push(photo);
      else {
        const last = current[current.length - 1];
        const diff = Math.abs(photo.timestamp - last.timestamp);
        if (diff < 5 * 60 * 1000) current.push(photo);
        else {
          if (current.length > 1) {
            groups.push({
              id: `stack_${current[0].id}`,
              coverPhoto: current[0], photos: current, count: current.length,
              label: format(new Date(current[0].timestamp), 'MMM d, h:mm a'),
              timestamp: current[0].timestamp,
            });
          }
          current = [photo];
        }
      }
    });

    if (current.length > 1) {
      groups.push({
        id: `stack_${current[0].id}`,
        coverPhoto: current[0], photos: current, count: current.length,
        label: format(new Date(current[0].timestamp), 'MMM d, h:mm a'),
        timestamp: current[0].timestamp,
      });
    }
    return groups.slice(0, 6);
  }, [photos]);

  if (stacks.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader
        title="Burst Moments"
        subtitle={`${stacks.length} moment${stacks.length !== 1 ? 's' : ''} grouped`}
        icon="layers-outline"
        color={DS.primary}
        isDark={isDark}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 12, paddingVertical: 4 }}>
        {stacks.map((stack) => (
          <PressableScale key={stack.id} onPress={() => onOpenStack(stack)} activeScale={0.94}>
            <View style={{ width: 140 }}>
              <View style={{ width: 140, height: 140, position: 'relative' }}>
                {stack.photos[2] && (
                  <Image source={{ uri: stack.photos[2].uri }} style={[styles.stackBack2]} />
                )}
                {stack.photos[1] && (
                  <Image source={{ uri: stack.photos[1].uri }} style={[styles.stackBack1]} />
                )}
                <Image source={{ uri: stack.coverPhoto.uri }} style={[styles.stackCover]} />
                <View style={styles.stackOverlay}>
                  <View style={styles.stackBadge}>
                    <Ionicons name="layers" size={12} color={DS.white} />
                    <Text style={styles.stackBadgeText}>{stack.count}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.stackLabel, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {stack.label}
              </Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Memory Lane
   ═══════════════════════════════════════════════════════════════════════════ */

const MemoryLane = React.memo(({ photos, isDark, onPress }: {
  photos: GalleryPhoto[]; isDark: boolean; onPress: (p: GalleryPhoto) => void;
}) => {
  const memories = useMemo(() => {
    if (photos.length === 0) return [];
    const now = new Date();
    const matches: { label: string; emoji: string; photos: GalleryPhoto[] }[] = [];

    const findMatching = (targetDate: Date) => photos.filter((p) => {
      const d = new Date(p.timestamp);
      return d.getDate() === targetDate.getDate() && d.getMonth() === targetDate.getMonth();
    });

    const oneWeekAgo = findMatching(subDays(now, 7));
    const oneMonthAgo = findMatching(subMonths(now, 1));
    const oneYearAgo = findMatching(subYears(now, 1));

    if (oneWeekAgo.length > 0) matches.push({ label: 'This Day Last Week', emoji: '📅', photos: oneWeekAgo.slice(0, 4) });
    if (oneMonthAgo.length > 0) matches.push({ label: 'This Day Last Month', emoji: '📆', photos: oneMonthAgo.slice(0, 4) });
    if (oneYearAgo.length > 0) matches.push({ label: 'This Day Last Year', emoji: '✨', photos: oneYearAgo.slice(0, 4) });

    return matches;
  }, [photos]);

  if (memories.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      {memories.map((memory) => (
        <View key={memory.label} style={{ marginBottom: DS.space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: DS.space.lg }}>
            <Text style={{ fontSize: 18 }}>{memory.emoji}</Text>
            <Text style={[styles.memoryLabel, { color: isDark ? DS.white : DS.gray900 }]}>{memory.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: DS.space.lg }}>
            {memory.photos.map((photo) => (
              <PressableScale key={photo.id} onPress={() => onPress(photo)} activeScale={0.94} style={{ flex: 1 }}>
                <View style={styles.memoryItem}>
                  <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} />
                  {photo.isFavorite && (
                    <View style={styles.memoryHeart}>
                      <Ionicons name="heart" size={12} color={DS.danger} />
                    </View>
                  )}
                </View>
              </PressableScale>
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Face Clusters
   ═══════════════════════════════════════════════════════════════════════════ */

const FaceClusters = React.memo(({ photos, babies, isDark, onPress }: {
  photos: GalleryPhoto[]; babies: any[]; isDark: boolean; onPress: (id: string) => void;
}) => {
  const clusters = useMemo(() => babies.map((baby) => {
    const babyPhotos = photos.filter((p) => p.babyId === baby.id);
    return {
      babyId: baby.id,
      name: baby.name,
      avatar: baby.avatar,
      gender: baby.gender,
      count: babyPhotos.length,
      recentPhoto: babyPhotos[0],
    };
  }).filter((c) => c.count > 0), [photos, babies]);

  if (clusters.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="By Baby" subtitle="Photos organized by person" icon="people-outline" color={DS.accent} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 16, paddingVertical: 4 }}>
        {clusters.map((cluster) => (
          <PressableScale key={cluster.babyId} onPress={() => onPress(cluster.babyId)} activeScale={0.94}>
            <View style={{ alignItems: 'center', width: 80 }}>
              <View style={{ position: 'relative', marginBottom: 8 }}>
                {cluster.recentPhoto ? (
                  <Image source={{ uri: cluster.recentPhoto.uri }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                ) : (
                  <SafeAvatar avatar={cluster.avatar} gender={cluster.gender} size={64} fallbackIcon="person" borderColor={DS.primary} borderWidth={2} />
                )}
                <View style={styles.faceCountBadge}>
                  <Text style={styles.faceCountText}>{cluster.count}</Text>
                </View>
              </View>
              <Text style={[styles.faceName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {cluster.name}
              </Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Albums
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartAlbums = React.memo(({ photos, isDark, onPress }: {
  photos: GalleryPhoto[]; isDark: boolean; onPress: (id: string) => void;
}) => {
  const albums = useMemo((): SmartAlbum[] => {
    const defs: SmartAlbum[] = [
      { id: 'milestone', title: 'Milestones', icon: 'trophy', emoji: '🏆', count: 0, gradient: ['#FFD700', '#FFA502'], filter: (p) => p.type === 'milestone' },
      { id: 'sleep', title: 'Sleep', icon: 'moon', emoji: '😴', count: 0, gradient: ['#5F27CD', '#341F97'], filter: (p) => p.type === 'sleep' },
      { id: 'feed', title: 'Feeding', icon: 'restaurant', emoji: '🍼', count: 0, gradient: ['#FF9F43', '#FF6B6B'], filter: (p) => p.type === 'feed' },
      { id: 'growth', title: 'Growth', icon: 'trending-up', emoji: '📏', count: 0, gradient: ['#10AC84', '#1DD1A1'], filter: (p) => p.type === 'growth' },
      { id: 'potty', title: 'Potty', icon: 'happy', emoji: '🚽', count: 0, gradient: ['#1DD1A1', '#10AC84'], filter: (p) => p.type === 'potty' },
      { id: 'medication', title: 'Health', icon: 'medkit', emoji: '💊', count: 0, gradient: ['#FF6B6B', '#EE5A24'], filter: (p) => p.type === 'medication' },
    ];
    return defs.map((album) => ({ ...album, count: photos.filter(album.filter).length })).filter((a) => a.count > 0);
  }, [photos]);

  if (albums.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(220).springify()}>
      <SectionHeader title="Albums" subtitle="Photos by activity type" icon="albums-outline" color={DS.warning} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 10, paddingVertical: 4 }}>
        {albums.map((album) => (
          <PressableScale key={album.id} onPress={() => onPress(album.id)} activeScale={0.94}>
            <LinearGradient colors={album.gradient} style={styles.albumCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.albumEmoji}>{album.emoji}</Text>
              <Text style={styles.albumTitle}>{album.title}</Text>
              <Text style={styles.albumCount}>{album.count}</Text>
            </LinearGradient>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Photo Stories
   ═══════════════════════════════════════════════════════════════════════════ */

const PhotoStories = React.memo(({ photos, isDark, onPress }: {
  photos: GalleryPhoto[]; isDark: boolean; onPress: (s: PhotoStory) => void;
}) => {
  const stories = useMemo((): PhotoStory[] => {
    if (photos.length < 3) return [];
    const weekGroups: Record<string, GalleryPhoto[]> = {};
    photos.forEach((p) => {
      const week = format(new Date(p.timestamp), 'yyyy-ww');
      if (!weekGroups[week]) weekGroups[week] = [];
      weekGroups[week].push(p);
    });
    const GRADIENTS: [string, string][] = [
      ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'],
    ];
    return Object.entries(weekGroups)
      .filter(([, ps]) => ps.length >= 3)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4)
      .map(([week, ps], i) => {
        const sorted = [...ps].sort((a, b) => b.timestamp - a.timestamp);
        return {
          id: `story_${week}`,
          title: `Week of ${format(new Date(sorted[0].timestamp), 'MMM d')}`,
          coverUri: sorted[0].uri,
          photoCount: ps.length,
          dateRange: `${format(new Date(sorted[sorted.length - 1].timestamp), 'MMM d')} - ${format(new Date(sorted[0].timestamp), 'MMM d')}`,
          gradient: GRADIENTS[i % GRADIENTS.length],
        };
      });
  }, [photos]);

  if (stories.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Weekly Stories" subtitle="Auto-generated collections" icon="film-outline" color={DS.success} isDark={isDark} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 12, paddingVertical: 4 }}>
        {stories.map((story) => (
          <PressableScale key={story.id} onPress={() => onPress(story)} activeScale={0.94}>
            <View style={styles.storyCard}>
              <Image source={{ uri: story.coverUri }} style={styles.storyCover} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.storyGradient} />
              <View style={styles.storyContent}>
                <Text style={styles.storyTitle} numberOfLines={1}>{story.title}</Text>
                <Text style={styles.storyMeta}>{story.dateRange} • {story.photoCount} photos</Text>
              </View>
              <View style={[styles.storyRing, { borderColor: story.gradient[0] }]} />
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Photo Grid Item
   ═══════════════════════════════════════════════════════════════════════════ */

const PhotoGridItem = React.memo(({
  item, isSelected, isBatchMode, viewMode, onPress, onLongPress, isDark,
}: {
  item: GalleryPhoto; isSelected: boolean; isBatchMode: boolean;
  viewMode: ViewMode; onPress: (p: GalleryPhoto) => void;
  onLongPress: (p: GalleryPhoto) => void; isDark: boolean;
}) => {
  if (viewMode === 'list') {
    return (
      <PressableScale onPress={() => onPress(item)} activeScale={0.98}>
        <View style={[styles.listItem, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <Image source={{ uri: item.uri }} style={styles.listImage} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.listDate, { color: isDark ? DS.gray500 : DS.gray400 }]}>
              {format(new Date(item.timestamp), 'MMM d, yyyy • h:mm a')}
            </Text>
            {item.caption ? (
              <Text style={[styles.listCaption, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{item.caption}</Text>
            ) : item.linkedEntry ? (
              <Text style={[styles.listCaption, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{item.linkedEntry.title}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
              {item.isFavorite && <Ionicons name="heart" size={12} color={DS.danger} />}
              {item.isPrivate && <Ionicons name="lock-closed" size={12} color={DS.warning} />}
              {item.source === 'tracker' && <Ionicons name="link" size={12} color="#8b5cf6" />}
              {item.babyName && (
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? DS.gray500 : DS.gray400 }}>{item.babyName}</Text>
              )}
            </View>
          </View>
          {isBatchMode && (
            <View style={[styles.listCheck, isSelected && styles.listCheckSelected]}>
              {isSelected && <Ionicons name="checkmark" size={16} color={DS.white} />}
            </View>
          )}
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={() => onPress(item)} activeScale={0.94}>
      <View style={[styles.gridItem, isSelected && styles.gridItemSelected]}>
        <Image source={{ uri: item.uri }} style={styles.gridImage} />

        {isBatchMode && (
          <View style={[styles.batchOverlay, isSelected && styles.batchOverlaySelected]}>
            <View style={[styles.batchCircle, isSelected && styles.batchCircleSelected]}>
              {isSelected && <Ionicons name="checkmark" size={14} color={DS.white} />}
            </View>
          </View>
        )}

        {item.aiTags && item.aiTags.length > 0 && (
          <View style={styles.gridAiBadge}>
            <Ionicons name="sparkles" size={8} color={DS.white} />
          </View>
        )}

        <View style={{ position: 'absolute', top: 6, left: 6, flexDirection: 'row', gap: 4 }}>
          {item.isFavorite && (
            <View style={[styles.gridBadge, { backgroundColor: DS.danger }]}>
              <Ionicons name="heart" size={10} color={DS.white} />
            </View>
          )}
          {item.isPrivate && (
            <View style={[styles.gridBadge, { backgroundColor: DS.warning }]}>
              <Ionicons name="lock-closed" size={10} color={DS.white} />
            </View>
          )}
          {item.source === 'tracker' && (
            <View style={[styles.gridBadge, { backgroundColor: '#8b5cf6' }]}>
              <Ionicons name="link" size={10} color={DS.white} />
            </View>
          )}
        </View>
      </View>
    </PressableScale>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Batch Select Bar
   ═══════════════════════════════════════════════════════════════════════════ */

const BatchSelectBar = React.memo(({
  selectedCount, onClear, onDelete, onShare, onFavorite, isDark,
}: {
  selectedCount: number; onClear: () => void; onDelete: () => void;
  onShare: () => void; onFavorite: () => void; isDark: boolean;
}) => {
  if (selectedCount === 0) return null;
  return (
    <Animated.View entering={FadeInUp} style={[styles.batchBar, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={[styles.batchCount, { color: isDark ? DS.white : DS.gray900 }]}>{selectedCount} selected</Text>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.batchClear}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={styles.batchButton} onPress={onFavorite}>
          <Ionicons name="heart-outline" size={20} color={DS.danger} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.batchButton} onPress={onShare}>
          <Ionicons name="share-outline" size={20} color={DS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.batchButton} onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={DS.danger} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Photo Detail Modal
   ═══════════════════════════════════════════════════════════════════════════ */

const PhotoDetailModal = React.memo(({
  visible, photo, onClose, onToggleFavorite, onTogglePrivate, onDelete, onEditCaption, onNavigateToEntry,
}: {
  visible: boolean; photo: GalleryPhoto | null; onClose: () => void;
  onToggleFavorite: (id: string) => void; onTogglePrivate: (id: string) => void;
  onDelete: (id: string) => void; onEditCaption: (id: string, c: string) => void;
  onNavigateToEntry: (id: string) => void;
}) => {
  const [showCaptionEditor, setShowCaptionEditor] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');

  useEffect(() => { if (photo) setCaptionDraft(photo.caption || ''); }, [photo]);
  if (!visible || !photo) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.detailOverlay}>
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.detailContent}>
          <TouchableOpacity style={styles.detailClose} onPress={onClose}>
            <Ionicons name="close" size={26} color={DS.white} />
          </TouchableOpacity>

          <Image source={{ uri: photo.uri }} style={styles.detailImage} resizeMode="contain" />

          <View style={styles.detailFooter}>
            <Text style={styles.detailDate}>
              {format(new Date(photo.timestamp), 'EEEE, MMMM d, yyyy • h:mm a')}
            </Text>
            {photo.caption && <Text style={styles.detailCaption}>{photo.caption}</Text>}
            {photo.linkedEntry && (
              <TouchableOpacity style={styles.detailLinkedBtn} onPress={() => onNavigateToEntry(photo.linkedEntry!.entryId)}>
                <Ionicons name="link-outline" size={14} color={DS.white} />
                <Text style={styles.detailLinkedText}>{photo.linkedEntry.title}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.detailActions}>
              <TouchableOpacity style={styles.detailAction} onPress={() => onToggleFavorite(photo.id)}>
                <Ionicons name={photo.isFavorite ? 'heart' : 'heart-outline'} size={24} color={photo.isFavorite ? DS.danger : DS.white} />
                <Text style={styles.detailActionText}>{photo.isFavorite ? 'Loved' : 'Love'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailAction} onPress={() => setShowCaptionEditor(true)}>
                <Ionicons name="create-outline" size={24} color={DS.white} />
                <Text style={styles.detailActionText}>Caption</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailAction} onPress={() => onTogglePrivate(photo.id)}>
                <Ionicons name={photo.isPrivate ? 'lock-closed' : 'lock-open-outline'} size={24} color={photo.isPrivate ? DS.warning : DS.white} />
                <Text style={styles.detailActionText}>{photo.isPrivate ? 'Private' : 'Lock'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailAction} onPress={() => onDelete(photo.id)}>
                <Ionicons name="trash-outline" size={24} color={DS.danger} />
                <Text style={styles.detailActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {showCaptionEditor && (
          <View style={styles.captionEditorOverlay}>
            <View style={styles.captionEditorCard}>
              <Text style={styles.captionEditorTitle}>Edit Caption</Text>
              <TextInput
                style={styles.captionEditorInput}
                value={captionDraft}
                onChangeText={setCaptionDraft}
                placeholder="Add a caption..."
                placeholderTextColor={DS.gray400}
                multiline
                autoFocus
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <TouchableOpacity onPress={() => setShowCaptionEditor(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: DS.gray500, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { onEditCaption(photo.id, captionDraft); setShowCaptionEditor(false); }}
                  style={{ backgroundColor: DS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ color: DS.white, fontSize: 14, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

type GalleryNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function GalleryScreen() {
  const navigation = useNavigation<GalleryNavProp>();
  const theme = useUnifiedTrackerTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby, babies } = useBaby();
  const { entries, refreshEntries } = useTracker();
  const isDark = theme.isDark;

  let syncedPhotos: UnifiedPhoto[] = [];
  try {
    const syncCtx = require('../../context/PhotoSyncContext').usePhotoSync?.();
    if (syncCtx && typeof syncCtx.getUnifiedPhotos === 'function') {
      syncedPhotos = syncCtx.getUnifiedPhotos();
    }
  } catch { syncedPhotos = []; }

  const { takePhoto, pickMultipleImages } = useMedia();
  const { alert: sweetAlert } = useSweetAlert();
  const {
    isUnlocked: vaultUnlocked, unlock: unlockVault, lock: lockVault,
    isAuthenticating: vaultAuthenticating, hasAnySecurity, refreshSecurityStatus: refreshVaultSecurity,
  } = useVaultUnlock();

  const [activeTab, setActiveTab] = useState<GalleryTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [activeAlbumFilter, setActiveAlbumFilter] = useState<string | null>(null);
  const [activeBabyFilter, setActiveBabyFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiTagFilter, setAiTagFilter] = useState<string | null>(null);

  const [meta, setMeta] = useState<PhotoMetadata>(() => ({
    favorites: new Set(), privates: new Set(), captions: {}, tags: {}, localPhotos: [],
  }));

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolate.CLAMP),
  }));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (activeTab === 'vault' && !vaultUnlocked) {
        unlockVault('Unlock Private Vault').then(() => {});
      }
    });
    return unsubscribe;
  }, [navigation, activeTab, vaultUnlocked, unlockVault, hasAnySecurity]);

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await loadPhotoMetadata();
        setMeta(loaded);
        const [viewStr, tabStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.VIEW_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.GALLERY_TAB),
        ]);
        if (viewStr === 'list' || viewStr === 'grid') setViewMode(viewStr);
        if (tabStr) setActiveTab(tabStr as GalleryTab);
      } catch (e) {
        if (__DEV__) console.warn('[Gallery] Load error:', e);
      } finally { setIsLoading(false); }
    };
    load();
  }, []);

  useEffect(() => { saveFavorites(meta.favorites); }, [meta.favorites]);
  useEffect(() => { savePrivates(meta.privates); }, [meta.privates]);
  useEffect(() => { saveCaptions(meta.captions); }, [meta.captions]);
  useEffect(() => { saveLocalPhotos(meta.localPhotos); }, [meta.localPhotos]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.VIEW_MODE, viewMode).catch(() => {}); }, [viewMode]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.GALLERY_TAB, activeTab).catch(() => {}); }, [activeTab]);

  const babyMap = useMemo(() => {
    const map = new Map<string, any>();
    babies.forEach((b: any) => map.set(b.id, b));
    return map;
  }, [babies]);

  const enrichedPhotos = useMemo((): UnifiedPhoto[] => {
    const nameMap = new Map<string, string>();
    babyMap.forEach((baby, id) => nameMap.set(id, baby.name));
    const trackerPhotos = buildUnifiedGallery(entries, meta, nameMap);
    const seen = new Set(trackerPhotos.map((p) => p.uri));
    const merged = [...trackerPhotos];
    for (const sp of syncedPhotos) {
      if (sp.uri && !seen.has(sp.uri)) { seen.add(sp.uri); merged.push(sp); }
    }
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, meta, babyMap, syncedPhotos]);

  const filteredPhotos = useMemo(() => {
    let list = enrichedPhotos;
    if (activeTab === 'vault') {
      if (!vaultUnlocked) return [];
      list = list.filter((p) => p.isPrivate);
    } else {
      list = list.filter((p) => !p.isPrivate);
    }
    if (activeTab === 'favorites') list = list.filter((p) => p.isFavorite);
    if (activeAlbumFilter) list = list.filter((p) => p.type === activeAlbumFilter);
    if (activeBabyFilter) list = list.filter((p) => p.babyId === activeBabyFilter);
    if (aiTagFilter) {
      const needle = aiTagFilter.toLowerCase();
      list = list.filter((p) => (p.aiTags ?? []).some((t) => t.toLowerCase().includes(needle)));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase().trim();
      if (q === 'favorites') list = list.filter((p) => p.isFavorite);
      else if (q === 'this week') list = list.filter((p) => isThisWeek(new Date(p.timestamp)));
      else if (q === 'this month') list = list.filter((p) => isThisMonth(new Date(p.timestamp)));
      else if (q === 'milestones') list = list.filter((p) => p.type === 'milestone');
      else if (q === 'from trackers') list = list.filter((p) => p.source === 'tracker');
      else {
        list = list.filter((p) => {
          const haystack = [p.caption, p.babyName, p.linkedEntry?.title, p.linkedEntry?.notes, ...(p.tags || [])]
            .filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(q);
        });
      }
    }
    return list;
  }, [enrichedPhotos, activeTab, activeAlbumFilter, activeBabyFilter, debouncedSearch, vaultUnlocked, aiTagFilter]);

  const groupedPhotos = useMemo((): DateGroup[] => {
    const groups: Record<string, GalleryPhoto[]> = {};
    filteredPhotos.forEach((photo) => {
      const key = format(new Date(photo.timestamp), 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(photo);
    });
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, photos]) => ({ date, label: format(parseISO(date), 'EEEE, MMM d'), photos }));
  }, [filteredPhotos]);

  const pulseStats = useMemo(() => ({
    photos: enrichedPhotos.length,
    favorites: enrichedPhotos.filter(p => p.isFavorite).length,
    albums: ['milestone', 'sleep', 'feed', 'growth', 'potty', 'medication'].filter(t => enrichedPhotos.some(p => p.type === t)).length,
    vaultCount: enrichedPhotos.filter(p => p.isPrivate).length,
  }), [enrichedPhotos]);

  const topRibbon = useMemo(() => {
    if (pulseStats.photos === 0) {
      return {
        icon: 'camera-outline' as const,
        color: DS.primary,
        label: 'Get started',
        text: 'Capture your first memory — tap the camera button',
      };
    }
    if (activeTab === 'vault' && !vaultUnlocked) {
      return {
        icon: 'lock-closed-outline' as const,
        color: DS.warning,
        label: 'Vault locked',
        text: 'Tap to unlock your private photos',
      };
    }
    if (pulseStats.favorites > 0 && activeTab === 'all') {
      return {
        icon: 'heart-outline' as const,
        color: DS.danger,
        label: 'Loved memories',
        text: `${pulseStats.favorites} favorite${pulseStats.favorites === 1 ? '' : 's'} waiting for you`,
        onPress: () => setActiveTab('favorites'),
      };
    }
    return {
      icon: 'sparkles-outline' as const,
      color: DS.accent,
      label: 'Browse',
      text: `${pulseStats.photos} memories across ${pulseStats.albums} albums`,
    };
  }, [pulseStats, activeTab, vaultUnlocked]);

  const handlePhotoPress = useCallback((photo: GalleryPhoto) => {
    if (isBatchMode) {
      HAPTIC_LIGHT();
      setSelectedPhotos((prev) => {
        const next = new Set(prev);
        if (next.has(photo.id)) next.delete(photo.id);
        else next.add(photo.id);
        return next;
      });
    } else {
      HAPTIC_LIGHT();
      setSelectedPhoto(photo);
      setShowDetail(true);
    }
  }, [isBatchMode]);

  const handlePhotoLongPress = useCallback((photo: GalleryPhoto) => {
    HAPTIC_HEAVY();
    setIsBatchMode(true);
    setSelectedPhotos(new Set([photo.id]));
  }, []);

  const handleTabChange = useCallback(async (tab: GalleryTab) => {
    HAPTIC_LIGHT();
    if (tab !== 'vault' && vaultUnlocked) lockVault();
    if (tab === 'vault' && !vaultUnlocked) {
      await refreshVaultSecurity();
      const unlocked = await unlockVault('Unlock Private Vault');
      if (unlocked) {
        setActiveTab(tab);
        setActiveAlbumFilter(null);
        setActiveBabyFilter(null);
        return;
      }
      if (hasAnySecurity) { navigation.navigate('VaultLock' as never); return; }
      sweetAlert('Vault Locked', 'Enable biometrics or set a PIN in Settings → Security to use the private vault.', 'info');
      return;
    }
    setActiveTab(tab);
    setActiveAlbumFilter(null);
    setActiveBabyFilter(null);
  }, [vaultUnlocked, lockVault, unlockVault, refreshVaultSecurity, hasAnySecurity, sweetAlert, navigation]);

  useEffect(() => {
    if (activeTab !== 'vault' && vaultUnlocked) lockVault();
  }, [activeTab, vaultUnlocked, lockVault]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { refreshVaultSecurity(); });
    return unsubscribe;
  }, [navigation, refreshVaultSecurity]);

  const handleCamera = useCallback(async () => {
    try {
      HAPTIC_MEDIUM();
      const uri = await takePhoto();
      if (uri) {
        const newPhoto = buildLocalCapturePhoto(uri, currentBaby?.id, 'camera');
        setMeta((prev) => ({ ...prev, localPhotos: [newPhoto, ...prev.localPhotos] }));
        HAPTIC_SUCCESS();
      }
    } catch (e) {
      sweetAlert('Camera Error', 'Could not capture photo.', 'error');
    }
  }, [takePhoto, currentBaby, sweetAlert]);

  const handleImportPhotos = useCallback(async () => {
    try {
      HAPTIC_LIGHT();
      const uris = await pickMultipleImages(20);
      if (!uris || uris.length === 0) return;
      const newPhotos = uris.map((uri, i) => ({
        ...buildLocalCapturePhoto(uri, currentBaby?.id, 'gallery'),
        timestamp: Date.now() - i * 1000,
      }));
      setMeta((prev) => ({ ...prev, localPhotos: [...newPhotos, ...prev.localPhotos] }));
      HAPTIC_SUCCESS();
    } catch (e) {
      if (__DEV__) console.warn('[Gallery] Import error:', e);
    }
  }, [pickMultipleImages, currentBaby]);

  const handleToggleFavorite = useCallback((photoId: string) => {
    HAPTIC_LIGHT();
    setMeta((prev) => ({ ...prev, favorites: toggleInSet(prev.favorites, photoId) }));
  }, []);

  const handleTogglePrivate = useCallback((photoId: string) => {
    HAPTIC_LIGHT();
    const isCurrentlyPrivate = meta.privates.has(photoId);
    if (!isCurrentlyPrivate && !hasAnySecurity) {
      sweetAlert('Security Required', 'Set up biometrics or a PIN in Settings → Security before marking photos as private.', 'warning', () => {
        navigation.navigate('SecurityCenter' as never);
      });
      return;
    }
    setMeta((prev) => ({ ...prev, privates: toggleInSet(prev.privates, photoId) }));
  }, [meta.privates, hasAnySecurity, sweetAlert, navigation]);

  const handleDeletePhoto = useCallback((photoId: string) => {
    sweetAlert('Delete Photo?', 'This will remove it from the gallery. The tracker entry stays intact.', 'warning', () => {
      setMeta((prev) => {
        const nextFavorites = new Set(prev.favorites);
        const nextPrivates = new Set(prev.privates);
        nextFavorites.delete(photoId);
        nextPrivates.delete(photoId);
        const nextCaptions = { ...prev.captions };
        delete nextCaptions[photoId];
        const nextTags = { ...prev.tags };
        delete nextTags[photoId];
        return {
          ...prev,
          localPhotos: prev.localPhotos.filter((p) => p.id !== photoId),
          favorites: nextFavorites, privates: nextPrivates, captions: nextCaptions, tags: nextTags,
        };
      });
      setShowDetail(false);
      HAPTIC_SUCCESS();
    });
  }, [sweetAlert]);

  const handleEditCaption = useCallback((photoId: string, caption: string) => {
    setMeta((prev) => ({ ...prev, captions: { ...prev.captions, [photoId]: caption } }));
    HAPTIC_LIGHT();
  }, []);

  const handleNavigateToEntry = useCallback((entryId: string) => {
    setShowDetail(false);
    navigation.navigate('EntryDetail' as any, { entryId });
  }, [navigation]);

  const handleAlbumPress = useCallback((albumId: string) => {
    HAPTIC_LIGHT();
    setActiveAlbumFilter(albumId);
    setSearchQuery('');
  }, []);

  const handleBabyPress = useCallback((babyId: string) => {
    HAPTIC_LIGHT();
    setActiveBabyFilter(babyId);
    setSearchQuery('');
  }, []);

  const handleStackOpen = useCallback((stack: PhotoStack) => {
    HAPTIC_LIGHT();
    if (stack.photos[0]) { setSelectedPhoto(stack.photos[0]); setShowDetail(true); }
  }, []);

  const handleStoryOpen = useCallback((story: PhotoStory) => {
    HAPTIC_LIGHT();
    setActiveAlbumFilter(null);
    setSearchQuery('');
    sweetAlert(story.title, `${story.photoCount} photos from ${story.dateRange}`, 'info');
  }, [sweetAlert]);

  const handleBatchShare = useCallback(async () => {
    try {
      const uris = Array.from(selectedPhotos).map((id) => enrichedPhotos.find((p) => p.id === id)?.uri).filter(Boolean) as string[];
      if (uris.length === 0) return;
      await Share.share(uris.length === 1 ? { url: uris[0] } : { message: `Sharing ${uris.length} photos from LittleLoom`, url: uris[0] });
      HAPTIC_LIGHT();
    } catch (e) { if (__DEV__) console.warn('[Gallery] Share error:', e); }
  }, [selectedPhotos, enrichedPhotos]);

  const handleBatchDelete = useCallback(() => {
    if (selectedPhotos.size === 0) return;
    sweetAlert('Delete Photos?', `Remove ${selectedPhotos.size} photo${selectedPhotos.size !== 1 ? 's' : ''}?`, 'warning', () => {
      setMeta((prev) => {
        const nextFavorites = new Set(prev.favorites);
        const nextPrivates = new Set(prev.privates);
        const nextCaptions = { ...prev.captions };
        const nextTags = { ...prev.tags };
        selectedPhotos.forEach((id) => {
          nextFavorites.delete(id);
          nextPrivates.delete(id);
          delete nextCaptions[id];
          delete nextTags[id];
        });
        return {
          ...prev,
          localPhotos: prev.localPhotos.filter((p) => !selectedPhotos.has(p.id)),
          favorites: nextFavorites, privates: nextPrivates, captions: nextCaptions, tags: nextTags,
        };
      });
      setSelectedPhotos(new Set());
      setIsBatchMode(false);
      HAPTIC_SUCCESS();
    });
  }, [selectedPhotos, sweetAlert]);

  const handleBatchFavorite = useCallback(() => {
    if (selectedPhotos.size === 0) return;
    setMeta((prev) => {
      const next = new Set(prev.favorites);
      const allFav = Array.from(selectedPhotos).every((id) => next.has(id));
      selectedPhotos.forEach((id) => { if (allFav) next.delete(id); else next.add(id); });
      return { ...prev, favorites: next };
    });
    HAPTIC_LIGHT();
  }, [selectedPhotos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshEntries(); } catch {}
    setRefreshing(false);
  }, [refreshEntries]);

  const tabs: { key: GalleryTab; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'grid-outline' },
    { key: 'albums', label: 'Albums', icon: 'albums-outline' },
    { key: 'timeline', label: 'Timeline', icon: 'time-outline' },
    { key: 'favorites', label: 'Loved', icon: 'heart-outline' },
    { key: 'vault', label: 'Vault', icon: 'shield-outline' },
  ];

  const showHeroSections = activeTab === 'all' && !debouncedSearch && !activeAlbumFilter && !activeBabyFilter;

  /* ─── RENDER ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header */}
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>
              GALLERY
            </GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {currentBaby?.name || 'Memories'} · {filteredPhotos.length} photos
            </Text>
          </View>
          <TouchableOpacity onPress={handleImportPhotos} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_TOTAL_HEIGHT + 12, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} progressViewOffset={HEADER_TOTAL_HEIGHT} />}
      >
        {/* Pulse */}
        <GalleryPulse
          isDark={isDark}
          currentBaby={currentBaby}
          stats={pulseStats}
          vaultUnlocked={vaultUnlocked}
          isBatchMode={isBatchMode}
          viewMode={viewMode}
          onAvatarPress={() => navigation.navigate('Profile' as never)}
          onCameraPress={handleCamera}
          onToggleViewMode={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          onToggleBatch={() => { setIsBatchMode(!isBatchMode); if (isBatchMode) setSelectedPhotos(new Set()); }}
        />

        {/* Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <AuraRibbon isDark={isDark} {...topRibbon} onPress={topRibbon.onPress} />
        </View>

        {/* Search */}
        <Animated.View entering={FadeInUp.delay(60).springify()} style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            <Ionicons name="search" size={18} color={isDark ? DS.gray500 : DS.gray400} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? DS.white : DS.gray900 }]}
              placeholder="Search photos, captions, tags..."
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={isDark ? DS.gray500 : DS.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Active filters */}
        {(activeAlbumFilter || activeBabyFilter) && (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.sm }}>
            <View style={[styles.activeFilterChip, { backgroundColor: `${DS.primary}15`, alignSelf: 'flex-start' }]}>
              <Ionicons name="filter" size={12} color={DS.primary} />
              <Text style={[styles.activeFilterText, { color: DS.primary }]}>
                {activeAlbumFilter ? `Album: ${activeAlbumFilter}` : `Baby: ${babyMap.get(activeBabyFilter!)?.name || 'Unknown'}`}
              </Text>
              <TouchableOpacity onPress={() => { setActiveAlbumFilter(null); setActiveBabyFilter(null); }}>
                <Ionicons name="close-circle" size={14} color={DS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* AI tag chips */}
        {(() => {
          const tagCounts = new Map<string, number>();
          enrichedPhotos.forEach((p) => (p.aiTags ?? []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
          const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
          if (topTags.length === 0) return null;
          return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DS.space.lg, gap: 8, paddingVertical: 8 }}>
              {aiTagFilter && (
                <TouchableOpacity style={[styles.chip, { backgroundColor: `${DS.danger}15`, borderColor: `${DS.danger}30` }]} onPress={() => setAiTagFilter(null)}>
                  <Ionicons name="close-circle" size={13} color={DS.danger} />
                  <Text style={[styles.chipLabel, { color: DS.danger }]}>{aiTagFilter}</Text>
                </TouchableOpacity>
              )}
              {topTags.map(([tag, count]) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, { backgroundColor: `${DS.primary}12`, borderColor: `${DS.primary}30` }]}
                  onPress={() => setAiTagFilter(tag === aiTagFilter ? null : tag)}
                >
                  <Ionicons name="sparkles" size={12} color={DS.primary} />
                  <Text style={[styles.chipLabel, { color: DS.primary }]}>{tag}</Text>
                  <View style={[styles.chipCount, { backgroundColor: `${DS.primary}20` }]}>
                    <Text style={[styles.chipCountText, { color: DS.primary }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          );
        })()}

        {/* Smart chips */}
        <View style={{ marginTop: DS.space.sm }}>
          <SmartSearchChips photos={enrichedPhotos} onFilter={setSearchQuery} />
        </View>

        {/* Tabs */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {isLoading && (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={DS.primary} />
            <Text style={{ fontSize: 13, fontWeight: '500', color: isDark ? DS.gray400 : DS.gray500 }}>Loading gallery...</Text>
          </View>
        )}

        {/* Hero sections */}
        {!isLoading && showHeroSections && (
          <>
            {pulseStats.photos > 0 && (
              <View style={{ marginTop: DS.space.lg }}>
                <SmartStacks photos={enrichedPhotos} onOpenStack={handleStackOpen} isDark={isDark} />
              </View>
            )}
            {pulseStats.photos > 0 && (
              <View style={{ marginTop: DS.space.lg }}>
                <SmartAlbums photos={enrichedPhotos} isDark={isDark} onPress={handleAlbumPress} />
              </View>
            )}
            {pulseStats.photos > 0 && (
              <View style={{ marginTop: DS.space.lg }}>
                <MemoryLane photos={enrichedPhotos} isDark={isDark} onPress={(p) => { setSelectedPhoto(p); setShowDetail(true); }} />
              </View>
            )}
            {babies.length > 1 && (
              <View style={{ marginTop: DS.space.lg }}>
                <FaceClusters photos={enrichedPhotos} babies={babies} isDark={isDark} onPress={handleBabyPress} />
              </View>
            )}
            {pulseStats.photos > 0 && (
              <View style={{ marginTop: DS.space.lg }}>
                <PhotoStories photos={enrichedPhotos} isDark={isDark} onPress={handleStoryOpen} />
              </View>
            )}
          </>
        )}

        {/* Photo grid */}
        {!isLoading && (
          <View style={{ marginTop: DS.space.lg }}>
            <SectionHeader
              title={
                activeTab === 'favorites' ? 'Favorites'
                : activeTab === 'vault' ? 'Private Vault'
                : activeAlbumFilter ? `${activeAlbumFilter.charAt(0).toUpperCase()}${activeAlbumFilter.slice(1)}`
                : activeBabyFilter ? babyMap.get(activeBabyFilter)?.name || 'Baby'
                : 'All Photos'
              }
              subtitle={`${filteredPhotos.length} photo${filteredPhotos.length !== 1 ? 's' : ''}`}
              icon={activeTab === 'vault' ? 'lock-closed-outline' : 'images-outline'}
              color={activeTab === 'vault' ? DS.warning : DS.primary}
              isDark={isDark}
            />

            {activeTab === 'vault' && !vaultUnlocked ? (
              <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.emptyIcon, { backgroundColor: `${DS.warning}15` }]}>
                  <Ionicons name="lock-closed" size={36} color={DS.warning} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>Vault is locked</Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Unlock to view your private photos</Text>
                <PressableScale
                  onPress={async () => {
                    await refreshVaultSecurity();
                    const ok = await unlockVault('Unlock Private Vault');
                    if (!ok && hasAnySecurity) navigation.navigate('VaultLock' as never);
                  }}
                  disabled={vaultAuthenticating}
                  activeScale={0.97}
                >
                  <LinearGradient colors={[DS.warning, '#d97706']} style={styles.emptyBtn}>
                    {vaultAuthenticating ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Ionicons name="lock-open-outline" size={18} color={DS.white} />
                        <Text style={styles.emptyBtnText}>Unlock Vault</Text>
                      </>
                    )}
                  </LinearGradient>
                </PressableScale>
              </View>
            ) : filteredPhotos.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 }]}>
                  <Ionicons name="images-outline" size={36} color={isDark ? DS.gray500 : DS.gray400} />
                </View>
                <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                  {debouncedSearch ? 'No matches found'
                    : activeTab === 'vault' ? 'Your vault is empty'
                    : activeTab === 'favorites' ? 'No favorites yet'
                    : 'No photos yet'}
                </Text>
                <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {debouncedSearch ? 'Try different keywords'
                    : activeTab === 'vault' ? 'Private photos will appear here'
                    : activeTab === 'favorites' ? 'Tap ❤️ on any photo to save it'
                    : 'Tap the camera to get started'}
                </Text>
                {!debouncedSearch && activeTab !== 'vault' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: DS.space.md }}>
                    <PressableScale onPress={handleCamera} activeScale={0.96}>
                      <LinearGradient colors={[DS.primary, DS.accent]} style={styles.emptyBtn}>
                        <Ionicons name="camera" size={16} color={DS.white} />
                        <Text style={styles.emptyBtnText}>Take Photo</Text>
                      </LinearGradient>
                    </PressableScale>
                    <PressableScale onPress={handleImportPhotos} activeScale={0.96}>
                      <View style={[styles.emptyBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                        <Ionicons name="images" size={16} color={DS.primary} />
                        <Text style={[styles.emptyBtnText, { color: DS.primary }]}>Import</Text>
                      </View>
                    </PressableScale>
                  </View>
                )}
              </View>
            ) : viewMode === 'grid' ? (
              <View style={{ paddingHorizontal: DS.space.lg }}>
                {groupedPhotos.map((group) => (
                  <View key={group.date} style={{ marginTop: DS.space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={[styles.dateGroupText, { color: isDark ? DS.gray400 : DS.gray500 }]}>{group.label}</Text>
                      <View style={[styles.dateGroupLine, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID.spacing }}>
                      {group.photos.map((item) => (
                        <View key={item.id} style={{ width: GRID.itemSize, height: GRID.itemSize }}>
                          <PhotoGridItem
                            item={item}
                            isSelected={selectedPhotos.has(item.id)}
                            isBatchMode={isBatchMode}
                            viewMode={viewMode}
                            onPress={handlePhotoPress}
                            onLongPress={handlePhotoLongPress}
                            isDark={isDark}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ paddingHorizontal: DS.space.lg, gap: 8 }}>
                {filteredPhotos.map((item) => (
                  <PhotoGridItem
                    key={item.id}
                    item={item}
                    isSelected={selectedPhotos.has(item.id)}
                    isBatchMode={isBatchMode}
                    viewMode={viewMode}
                    onPress={handlePhotoPress}
                    onLongPress={handlePhotoLongPress}
                    isDark={isDark}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Batch bar */}
      <BatchSelectBar
        selectedCount={selectedPhotos.size}
        onClear={() => { setSelectedPhotos(new Set()); setIsBatchMode(false); }}
        onDelete={handleBatchDelete}
        onShare={handleBatchShare}
        onFavorite={handleBatchFavorite}
        isDark={isDark}
      />

      {/* FAB */}
      {!isBatchMode && pulseStats.photos > 0 && (
        <Animated.View entering={FadeIn.delay(300)} style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
          <PressableScale onPress={handleCamera} activeScale={0.92}>
            <LinearGradient colors={[DS.primary, DS.accent]} style={styles.fab}>
              <Ionicons name="camera" size={26} color={DS.white} />
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      )}

      {/* Detail modal */}
      <PhotoDetailModal
        visible={showDetail}
        photo={selectedPhoto}
        onClose={() => setShowDetail(false)}
        onToggleFavorite={handleToggleFavorite}
        onTogglePrivate={handleTogglePrivate}
        onDelete={handleDeletePhoto}
        onEditCaption={handleEditCaption}
        onNavigateToEntry={handleNavigateToEntry}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: DS.space.md },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.space.lg, height: 48 },
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
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  pulseAgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  pulseAgeText: { fontSize: 10, fontWeight: '700' },
  pulseLiveDot: { width: 6, height: 6, borderRadius: 3 },
  pulseSubText: { fontSize: 12, fontWeight: '500', flex: 1 },
  pulseIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pulseAddBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
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

  /* Search */
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },

  /* Chips */
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.full, borderWidth: 1 },
  chipLabel: { fontSize: 12, fontWeight: '700' },
  chipCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
  chipCountText: { fontSize: 10, fontWeight: '800' },

  /* Active filter */
  activeFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.full },
  activeFilterText: { fontSize: 12, fontWeight: '600' },

  /* Tabs */
  tabBar: {
    flexDirection: 'row', marginHorizontal: DS.space.lg,
    padding: 4, borderRadius: DS.radius.full, gap: 2,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 9, borderRadius: DS.radius.full,
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  /* Stacks */
  stackCover: { position: 'absolute', width: 130, height: 130, borderRadius: 16, top: 0, left: 0 },
  stackBack1: { position: 'absolute', width: 130, height: 130, borderRadius: 16, top: 5, left: 5, opacity: 0.6, transform: [{ rotate: '3deg' }] },
  stackBack2: { position: 'absolute', width: 130, height: 130, borderRadius: 16, top: 10, left: 10, opacity: 0.3, transform: [{ rotate: '6deg' }] },
  stackOverlay: { position: 'absolute', bottom: 10, right: 10 },
  stackBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  stackBadgeText: { color: DS.white, fontSize: 11, fontWeight: '700' },
  stackLabel: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  /* Memory */
  memoryLabel: { fontSize: 14, fontWeight: '800' },
  memoryItem: { aspectRatio: 1, borderRadius: DS.radius.md, overflow: 'hidden' },
  memoryHeart: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: 4,
  },

  /* Faces */
  faceCountBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: DS.primary, borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: DS.white,
  },
  faceCountText: { color: DS.white, fontSize: 10, fontWeight: '800' },
  faceName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

  /* Albums */
  albumCard: { width: 110, height: 130, borderRadius: DS.radius.lg, padding: 14, justifyContent: 'space-between' },
  albumEmoji: { fontSize: 28 },
  albumTitle: { color: DS.white, fontSize: 13, fontWeight: '700' },
  albumCount: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },

  /* Stories */
  storyCard: { width: 160, height: 200, borderRadius: DS.radius.lg, overflow: 'hidden', position: 'relative' },
  storyCover: { width: '100%', height: '100%' },
  storyGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  storyContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  storyTitle: { color: DS.white, fontSize: 14, fontWeight: '700' },
  storyMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500', marginTop: 2 },
  storyRing: { position: 'absolute', top: 8, left: 8, width: 36, height: 36, borderRadius: 18, borderWidth: 3 },

  /* Date group */
  dateGroupText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 12 },
  dateGroupLine: { flex: 1, height: 1 },

  /* Grid */
  gridItem: { width: '100%', height: '100%', borderRadius: DS.radius.sm, overflow: 'hidden', position: 'relative' },
  gridItemSelected: { borderWidth: 3, borderColor: DS.primary },
  gridImage: { width: '100%', height: '100%' },
  batchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 6,
  },
  batchOverlaySelected: { backgroundColor: 'rgba(99,102,241,0.3)' },
  batchCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: DS.white, backgroundColor: 'transparent' },
  batchCircleSelected: { backgroundColor: DS.primary, borderColor: DS.primary },
  gridBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  gridAiBadge: {
    position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center',
  },

  /* List */
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: DS.radius.md, gap: 12, borderWidth: 1 },
  listImage: { width: 72, height: 72, borderRadius: DS.radius.md },
  listDate: { fontSize: 11, fontWeight: '600' },
  listCaption: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  listCheck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: DS.gray300, justifyContent: 'center', alignItems: 'center' },
  listCheckSelected: { backgroundColor: DS.primary, borderColor: DS.primary },

  /* Empty */
  emptyState: {
    alignItems: 'center', paddingVertical: DS.space['3xl'], paddingHorizontal: DS.space.lg,
    marginHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: DS.radius.md,
  },
  emptyBtnText: { color: DS.white, fontSize: 13, fontWeight: '700' },

  /* Batch bar */
  batchBar: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    borderRadius: DS.radius.lg, padding: 12, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...DS.shadow.lg, zIndex: 100,
  },
  batchCount: { fontSize: 14, fontWeight: '700' },
  batchClear: { fontSize: 13, color: DS.danger, fontWeight: '600' },
  batchButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(100,116,139,0.1)', justifyContent: 'center', alignItems: 'center' },

  /* FAB */
  fabContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 99 },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', ...DS.shadow.lg },

  /* Detail modal */
  detailOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.9)' },
  detailContent: { flex: 1, width: '100%', paddingTop: 60 },
  detailClose: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  detailImage: { width: '100%', height: '60%' },
  detailFooter: { padding: 20, gap: 8 },
  detailDate: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  detailCaption: { color: DS.white, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  detailLinkedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.3)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginTop: 6,
  },
  detailLinkedText: { color: DS.white, fontSize: 12, fontWeight: '600' },
  detailActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 20, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  detailAction: { alignItems: 'center', gap: 4 },
  detailActionText: { color: DS.white, fontSize: 11, fontWeight: '600' },

  /* Caption editor */
  captionEditorOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  captionEditorCard: { width: '100%', maxWidth: 380, backgroundColor: DS.white, borderRadius: 20, padding: 20 },
  captionEditorTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12, color: DS.gray900 },
  captionEditorInput: {
    borderWidth: 1, borderColor: DS.gray200, borderRadius: 12,
    padding: 12, fontSize: 15, minHeight: 80, color: DS.gray900, textAlignVertical: 'top',
  },
});