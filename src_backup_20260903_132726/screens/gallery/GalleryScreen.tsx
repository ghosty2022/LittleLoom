import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  FlatList,
  Platform,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolate,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  Layout,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { format, isThisMonth, isThisWeek, isToday, isYesterday, parseISO, subDays } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBaby } from '../../context/BabyContext';
import { useMedia } from '../../context/MediaContext';
import { useSecurity } from '../../context/SecurityContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';
import { SafeAvatar } from '../../components/SafeAvatar';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Inspired by Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const GRID = {
  columns: 3,
  spacing: 4,
  get itemSize() { return (SCREEN_W - 32 - (this.columns - 1) * this.spacing) / this.columns; },
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type PhotoType = 'milestone' | 'daily' | 'sleep' | 'feeding' | 'potty' | 'growth' | 'medication' | 'all';
type GalleryTab = 'all' | 'albums' | 'timeline' | 'favorites' | 'vault';
type ViewMode = 'grid' | 'list' | 'masonry';

interface Photo {
  id: string;
  uri: string;
  date: string;
  timestamp: number;
  type: PhotoType;
  caption?: string;
  babyId?: string;
  babyName?: string;
  isPrivate?: boolean;
  isFavorite?: boolean;
  tags?: string[];
  location?: string;
  exif?: { width: number; height: number; size: number; device?: string };
  linkedEntry?: { type: 'milestone' | 'growth' | 'activity'; id: string; title: string };
  faces?: { babyId: string; confidence: number; boundingBox: { x: number; y: number; width: number; height: number } }[];
  mood?: 'happy' | 'neutral' | 'sad' | 'excited' | 'tired' | 'sleepy';
  isScreenshot?: boolean;
  backupStatus?: 'synced' | 'pending' | 'failed';
  source?: 'camera' | 'gallery' | 'auto_import' | 'google_photos' | 'icloud';
  isExplicit?: boolean;
  blurHash?: string;
  folder?: string;
}

interface SmartAlbum {
  id: string;
  title: string;
  icon: string;
  count: number;
  photos: Photo[];
  type: 'smart' | 'baby' | 'activity' | 'date' | 'folder';
  gradient: [string, string];
  coverPhoto?: string;
  description?: string;
}

interface DateGroup {
  date: string;
  label: string;
  photos: Photo[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   STORAGE KEYS
   ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  PHOTOS: '@littleloom_gallery_photos',
  AUTO_IMPORT_SETTINGS: '@littleloom_auto_import_settings',
  SCAN_PROGRESS: '@littleloom_scan_progress',
  VAULT_ENABLED: '@littleloom_vault_enabled',
  GALLERY_VIEW_MODE: '@littleloom_gallery_view_mode',
  GALLERY_TAB: '@littleloom_gallery_tab',
};

/* ═══════════════════════════════════════════════════════════════════════════
   GLASS CARD — Inspired by Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false }: { children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean }) => {
  const theme = useUnifiedTrackerTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[styles.glassCard, active && { borderColor: theme.primary, borderWidth: 2 }, style]}>
      <LinearGradient
        colors={theme.isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Inspired by Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, theme }: { title: string; subtitle?: string; action?: () => void; actionLabel?: string; theme: any }) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
      {subtitle && <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: theme.primary }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </TouchableOpacity>
    )}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   TAB BAR — Inspired by Growth Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = React.memo(({ tabs, activeTab, onChange, theme }: { tabs: { key: GalleryTab; label: string; icon: string }[]; activeTab: GalleryTab; onChange: (t: GalleryTab) => void; theme: any }) => (
  <View style={[styles.tabBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tabItem, isActive && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : '#fff', /* no shadow */ }]}
        >
          <Ionicons name={tab.icon as any} size={16} color={isActive ? theme.primary : theme.text.muted} />
          <Text style={[styles.tabLabel, { color: isActive ? theme.primary : theme.text.muted }, isActive && { fontWeight: '700' }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 1: AI Smart Stacks — Groups similar photos automatically
   ═══════════════════════════════════════════════════════════════════════════ */

interface PhotoStack {
  id: string;
  coverPhoto: Photo;
  photos: Photo[];
  count: number;
  label: string;
  timestamp: number;
}

const SmartStacks = React.memo(({ photos, onOpenStack, theme }: { photos: Photo[]; onOpenStack: (stack: PhotoStack) => void; theme: any }) => {
  const stacks = useMemo((): PhotoStack[] => {
    // Group photos taken within 5 minutes of each other
    const sorted = [...photos].sort((a, b) => b.timestamp - a.timestamp);
    const groups: PhotoStack[] = [];
    let current: Photo[] = [];

    sorted.forEach((photo) => {
      if (current.length === 0) {
        current.push(photo);
      } else {
        const last = current[current.length - 1];
        const diff = Math.abs(photo.timestamp - last.timestamp);
        if (diff < 5 * 60 * 1000) {
          current.push(photo);
        } else {
          if (current.length > 1) {
            groups.push({
              id: `stack_${current[0].id}`,
              coverPhoto: current[0],
              photos: current,
              count: current.length,
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
        coverPhoto: current[0],
        photos: current,
        count: current.length,
        label: format(new Date(current[0].timestamp), 'MMM d, h:mm a'),
        timestamp: current[0].timestamp,
      });
    }

    return groups.slice(0, 6);
  }, [photos]);

  if (stacks.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="Smart Stacks" subtitle={`${stacks.length} burst moments grouped`} theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stacksScroll}>
        {stacks.map((stack, i) => (
          <TouchableOpacity key={stack.id} onPress={() => onOpenStack(stack)} style={styles.stackCard}>
            <View style={styles.stackImages}>
              <Image source={{ uri: stack.coverPhoto.uri }} style={[styles.stackCover, { zIndex: 3 }]} />
              {stack.photos[1] && (
                <Image source={{ uri: stack.photos[1].uri }} style={[styles.stackBack1, { zIndex: 2 }]} />
              )}
              {stack.photos[2] && (
                <Image source={{ uri: stack.photos[2].uri }} style={[styles.stackBack2, { zIndex: 1 }]} />
              )}
            </View>
            <View style={styles.stackOverlay}>
              <View style={styles.stackBadge}>
                <Ionicons name="layers" size={12} color="#fff" />
                <Text style={styles.stackBadgeText}>{stack.count}</Text>
              </View>
            </View>
            <Text style={[styles.stackLabel, { color: theme.text.primary }]} numberOfLines={1}>{stack.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 2: AI Memory Lane — This Day Last Year / Month highlights
   ═══════════════════════════════════════════════════════════════════════════ */

const MemoryLane = React.memo(({ photos, theme, onPress }: { photos: Photo[]; theme: any; onPress: (photo: Photo) => void }) => {
  const memories = useMemo(() => {
    const now = new Date();
    const oneYearAgo = subDays(now, 365);
    const oneMonthAgo = subDays(now, 30);

    const yearAgo = photos.filter(p => {
      const d = new Date(p.timestamp);
      return d.getDate() === oneYearAgo.getDate() && d.getMonth() === oneYearAgo.getMonth();
    });

    const monthAgo = photos.filter(p => {
      const d = new Date(p.timestamp);
      return d.getDate() === oneMonthAgo.getDate() && d.getMonth() === oneMonthAgo.getMonth();
    });

    return [
      ...(yearAgo.length > 0 ? [{ label: 'This Day Last Year', photos: yearAgo.slice(0, 4), emoji: '📅' }] : []),
      ...(monthAgo.length > 0 ? [{ label: 'This Day Last Month', photos: monthAgo.slice(0, 4), emoji: '📆' }] : []),
    ];
  }, [photos]);

  if (memories.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(150).springify()}>
      {memories.map((memory, mi) => (
        <View key={memory.label} style={styles.memorySection}>
          <View style={styles.memoryHeader}>
            <Text style={styles.memoryEmoji}>{memory.emoji}</Text>
            <Text style={[styles.memoryLabel, { color: theme.text.primary }]}>{memory.label}</Text>
          </View>
          <View style={styles.memoryGrid}>
            {memory.photos.map((photo, pi) => (
              <TouchableOpacity key={photo.id} onPress={() => onPress(photo)} style={styles.memoryItem}>
                <Image source={{ uri: photo.uri }} style={styles.memoryImage} />
                {photo.isFavorite && (
                  <View style={styles.memoryHeart}>
                    <Ionicons name="heart" size={14} color="#ef4444" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 3: AI Face Clustering — Group photos by detected faces
   ═══════════════════════════════════════════════════════════════════════════ */

const FaceClusters = React.memo(({ photos, babies, theme, onPress }: { photos: Photo[]; babies: any[]; theme: any; onPress: (babyId: string) => void }) => {
  const clusters = useMemo(() => {
    return babies.map(baby => {
      const babyPhotos = photos.filter(p => p.babyId === baby.id || p.faces?.some(f => f.babyId === baby.id));
      return {
        babyId: baby.id,
        name: baby.name,
        avatar: baby.avatar,
        count: babyPhotos.length,
        recentPhoto: babyPhotos[0],
      };
    }).filter(c => c.count > 0);
  }, [photos, babies]);

  if (clusters.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="Faces" subtitle="Photos organized by person" theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facesScroll}>
        {clusters.map((cluster, i) => (
          <TouchableOpacity key={cluster.babyId} onPress={() => onPress(cluster.babyId)} style={styles.faceCluster}>
            <View style={styles.faceAvatarWrap}>
              {cluster.recentPhoto ? (
                <Image source={{ uri: cluster.recentPhoto.uri }} style={styles.faceAvatar} />
              ) : (
                <SafeAvatar avatar={cluster.avatar} size={64} fallbackIcon="person" borderColor={theme.primary} borderWidth={2} />
              )}
              <View style={styles.faceCountBadge}>
                <Text style={styles.faceCountText}>{cluster.count}</Text>
              </View>
            </View>
            <Text style={[styles.faceName, { color: theme.text.primary }]} numberOfLines={1}>{cluster.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 4: AI Photo Stories — Auto-generated collages from events
   ═══════════════════════════════════════════════════════════════════════════ */

interface PhotoStory {
  id: string;
  title: string;
  coverUri: string;
  photoCount: number;
  dateRange: string;
  gradient: [string, string];
}

const PhotoStories = React.memo(({ photos, theme, onPress }: { photos: Photo[]; theme: any; onPress: (story: PhotoStory) => void }) => {
  const stories = useMemo((): PhotoStory[] => {
    // Group photos by week and create stories
    const weekGroups: Record<string, Photo[]> = {};
    photos.forEach(p => {
      const week = format(new Date(p.timestamp), 'yyyy-ww');
      if (!weekGroups[week]) weekGroups[week] = [];
      weekGroups[week].push(p);
    });

    return Object.entries(weekGroups)
      .filter(([_, ps]) => ps.length >= 3)
      .slice(0, 4)
      .map(([week, ps], i) => {
        const gradients: [string, string][] = [
          ['#667eea', '#764ba2'],
          ['#f093fb', '#f5576c'],
          ['#4facfe', '#00f2fe'],
          ['#43e97b', '#38f9d7'],
        ];
        const sorted = ps.sort((a, b) => b.timestamp - a.timestamp);
        return {
          id: `story_${week}`,
          title: `Week of ${format(new Date(sorted[0].timestamp), 'MMM d')}`,
          coverUri: sorted[0].uri,
          photoCount: ps.length,
          dateRange: `${format(new Date(sorted[sorted.length - 1].timestamp), 'MMM d')} - ${format(new Date(sorted[0].timestamp), 'MMM d')}`,
          gradient: gradients[i % gradients.length],
        };
      });
  }, [photos]);

  if (stories.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader title="Stories" subtitle="Auto-generated moments" theme={theme} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
        {stories.map((story, i) => (
          <TouchableOpacity key={story.id} onPress={() => onPress(story)} style={styles.storyCard}>
            <Image source={{ uri: story.coverUri }} style={styles.storyCover} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.storyGradient} />
            <View style={styles.storyContent}>
              <Text style={styles.storyTitle} numberOfLines={1}>{story.title}</Text>
              <Text style={styles.storyMeta}>{story.dateRange} • {story.photoCount} photos</Text>
            </View>
            <View style={[styles.storyRing, { borderColor: story.gradient[0] }]} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 5: AI Search Suggestions — Smart chips for quick filtering
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartSearchChips = React.memo(({ photos, onFilter, theme }: { photos: Photo[]; onFilter: (filter: string) => void; theme: any }) => {
  const suggestions = useMemo(() => {
    const chips = [
      { label: 'Favorites', icon: 'heart', count: photos.filter(p => p.isFavorite).length, color: '#ef4444' },
      { label: 'Screenshots', icon: 'phone-portrait', count: photos.filter(p => p.isScreenshot).length, color: '#8b5cf6' },
      { label: 'Auto-Imported', icon: 'sync', count: photos.filter(p => p.source === 'auto_import').length, color: '#10b981' },
      { label: 'Milestones', icon: 'trophy', count: photos.filter(p => p.type === 'milestone').length, color: '#f59e0b' },
      { label: 'Camera', icon: 'camera', count: photos.filter(p => p.source === 'camera').length, color: '#6366f1' },
      { label: 'This Week', icon: 'calendar', count: photos.filter(p => isThisWeek(new Date(p.timestamp))).length, color: '#06b6d4' },
    ];
    return chips.filter(c => c.count > 0);
  }, [photos]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
      {suggestions.map((chip, i) => (
        <TouchableOpacity key={chip.label} onPress={() => onFilter(chip.label)} style={[styles.chip, { backgroundColor: `${chip.color}12` }]}>
          <Ionicons name={chip.icon as any} size={14} color={chip.color} />
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
   FEATURE 6: Photo Insights Card — Stats & analytics about gallery
   ═══════════════════════════════════════════════════════════════════════════ */

const PhotoInsights = React.memo(({ photos, theme }: { photos: Photo[]; theme: any }) => {
  const insights = useMemo(() => {
    const total = photos.length;
    const favorites = photos.filter(p => p.isFavorite).length;
    const thisMonth = photos.filter(p => isThisMonth(new Date(p.timestamp))).length;
    const privateCount = photos.filter(p => p.isPrivate).length;
    const sources = new Set(photos.map(p => p.source)).size;

    return [
      { label: 'Total', value: total, icon: 'images', color: '#667eea' },
      { label: 'Favorites', value: favorites, icon: 'heart', color: '#ef4444' },
      { label: 'This Month', value: thisMonth, icon: 'calendar', color: '#10b981' },
      { label: 'Sources', value: sources, icon: 'cloud', color: '#f59e0b' },
    ];
  }, [photos]);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={styles.insightsGrid}>
          {insights.map((item, i) => (
            <View key={item.label} style={styles.insightItem}>
              <View style={[styles.insightIconBg, { backgroundColor: `${item.color}12` }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={[styles.insightValue, { color: theme.text.primary }]}>{item.value}</Text>
              <Text style={[styles.insightLabel, { color: theme.text.muted }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   DATE GROUP HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

const DateGroupHeader = React.memo(({ date, isDark }: { date: string; isDark: boolean }) => {
  const getGroupLabel = () => {
    const photoDate = parseISO(date);
    if (isToday(photoDate)) return 'Today';
    if (isYesterday(photoDate)) return 'Yesterday';
    if (isThisWeek(photoDate)) return 'This Week';
    if (isThisMonth(photoDate)) return 'This Month';
    return format(photoDate, 'MMMM yyyy');
  };

  return (
    <View style={styles.dateGroupHeader}>
      <Text style={[styles.dateGroupText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{getGroupLabel()}</Text>
      <View style={[styles.dateGroupLine, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PHOTO GRID ITEM
   ═══════════════════════════════════════════════════════════════════════════ */

const PhotoGridItem = React.memo(({ item, index, isSelected, isBatchMode, viewMode, onPress, onLongPress }: any) => {
  const theme = useUnifiedTrackerTheme();

  if (viewMode === 'list') {
    return (
      <Animated.View entering={FadeInUp.delay(index * 30).springify()} layout={Layout.springify()}>
        <TouchableOpacity
          style={[styles.listItem, { backgroundColor: theme.isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' }]}
          onPress={() => onPress(item)}
          onLongPress={() => onLongPress(item)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: item.uri }} style={styles.listImage} />
          <View style={styles.listInfo}>
            <Text style={[styles.listDate, { color: theme.text.muted }]}>{format(new Date(item.timestamp), 'MMM d, yyyy')}</Text>
            {item.caption && <Text style={[styles.listCaption, { color: theme.text.primary }]} numberOfLines={1}>{item.caption}</Text>}
            <View style={styles.listMeta}>
              {item.isFavorite && <Ionicons name="heart" size={12} color="#ef4444" />}
              {item.isPrivate && <Ionicons name="lock-closed" size={12} color="#f59e0b" />}
              {item.source === 'auto_import' && <Ionicons name="sync" size={12} color="#8b5cf6" />}
            </View>
          </View>
          {isBatchMode && (
            <View style={[styles.listCheck, isSelected && styles.listCheckSelected]}>
              {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(index * 30).springify()} layout={Layout.springify()}>
      <TouchableOpacity
        style={[styles.gridItem, isSelected && styles.gridItemSelected]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.uri }} style={styles.gridImage} />

        {isBatchMode && (
          <View style={[styles.batchOverlay, isSelected && styles.batchOverlaySelected]}>
            <View style={[styles.batchCircle, isSelected && styles.batchCircleSelected]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </View>
        )}

        <View style={styles.gridBadges}>
          {item.isFavorite && (
            <View style={[styles.gridBadge, { backgroundColor: '#ef4444' }]}>
              <Ionicons name="heart" size={10} color="#fff" />
            </View>
          )}
          {item.isPrivate && (
            <View style={[styles.gridBadge, { backgroundColor: '#f59e0b' }]}>
              <Ionicons name="lock-closed" size={10} color="#fff" />
            </View>
          )}
          {item.backupStatus === 'pending' && (
            <View style={[styles.gridBadge, { backgroundColor: '#3b82f6' }]}>
              <Ionicons name="cloud-upload" size={10} color="#fff" />
            </View>
          )}
        </View>

        {item.mood && (
          <View style={styles.moodBadge}>
            <Text style={styles.moodEmoji}>
              {item.mood === 'happy' ? '😊' : item.mood === 'excited' ? '🤩' : item.mood === 'sleepy' ? '😴' : item.mood === 'sad' ? '😢' : '😐'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH SELECT BAR
   ═══════════════════════════════════════════════════════════════════════════ */

const BatchSelectBar = React.memo(({ selectedCount, onClear, onDelete, onShare, onDownload, isDark }: any) => {
  if (selectedCount === 0) return null;

  return (
    <Animated.View entering={FadeInUp} exiting={FadeInDown} style={[styles.batchBar, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
      <View style={styles.batchInfo}>
        <Text style={[styles.batchCount, { color: isDark ? '#fff' : '#1e293b' }]}>{selectedCount} selected</Text>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.batchClear}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.batchActions}>
        <TouchableOpacity style={styles.batchButton} onPress={onShare}>
          <Ionicons name="share-outline" size={22} color="#667eea" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.batchButton} onPress={onDownload}>
          <Ionicons name="download-outline" size={22} color="#10b981" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.batchButton} onPress={onDelete}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FLOATING CAMERA BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */

const FloatingCameraButton = React.memo(({ onPress, scrollY }: { onPress: () => void; scrollY: Animated.SharedValue<number> }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, 200], [0, 100], Extrapolate.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, 100], [1, 0], Extrapolate.CLAMP),
  }));

  return (
    <Animated.View style={[styles.fabContainer, animatedStyle]}>
      <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.8}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.fabGradient}>
          <Ionicons name="camera" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GalleryScreen({ navigation }: any) {
  const theme = useUnifiedTrackerTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby, babies } = useBaby();
  const { takePhoto } = useMedia();

  const [activeTab, setActiveTab] = useState<GalleryTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showVaultLock, setShowVaultLock] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolate.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolate.CLAMP) }],
  }));

  // ── Load data ──
  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.PHOTOS);
      if (saved) setPhotos(JSON.parse(saved));
      const savedTab = await AsyncStorage.getItem(STORAGE_KEYS.GALLERY_TAB);
      if (savedTab) setActiveTab(savedTab as GalleryTab);
      const savedView = await AsyncStorage.getItem(STORAGE_KEYS.GALLERY_VIEW_MODE);
      if (savedView) setViewMode(savedView as ViewMode);
    };
    load();
  }, []);
 useEffect(() => {
    const importTrackerPhotos = async () => {
      try {
        const trackerEntries = await AsyncStorage.getItem('@littleloom_tracker_entries');
        if (!trackerEntries) return;

        const entries = JSON.parse(trackerEntries);
        const existingUris = new Set(photos.map(p => p.uri));
        const newPhotos: Photo[] = [];

        entries.forEach((entry: any) => {
          if (entry.photoUris && entry.photoUris.length > 0) {
            entry.photoUris.forEach((uri: string) => {
              if (!existingUris.has(uri)) {
                newPhotos.push({
                  id: `tracker_${entry.id}_${Math.random().toString(36).substr(2, 9)}`,
                  uri,
                  date: new Date(entry.timestamp).toISOString(),
                  timestamp: entry.timestamp,
                  type: 'tracker',
                  caption: entry.title || `${entry.trackerName || 'Tracker'} entry`,
                  babyId: entry.babyId,
                  source: 'tracker',
                  isPrivate: false,
                  linkedEntry: {
                    type: 'activity',
                    id: entry.id,
                    title: entry.title || 'Tracker Entry',
                  },
                });
                existingUris.add(uri);
              }
            });
          }
        });

        if (newPhotos.length > 0) {
          setPhotos(prev => [...newPhotos, ...prev]);
        }
      } catch (e) {
        console.error('Failed to import tracker photos:', e);
      }
    };

    importTrackerPhotos();
  }, []);
  
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(photos));
  }, [photos]);

  // ── Filter photos ──
  useEffect(() => {
    let filtered = photos;

    switch (activeTab) {
      case 'favorites':
        filtered = filtered.filter(p => p.isFavorite);
        break;
      case 'vault':
        filtered = filtered.filter(p => p.isPrivate);
        break;
      case 'albums':
        // Show all in album view
        break;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.caption?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q)) ||
        p.date.includes(q) ||
        p.babyName?.toLowerCase().includes(q)
      );
    }

    if (activeTab !== 'vault' && !vaultUnlocked) {
      filtered = filtered.filter(p => !p.isPrivate);
    }

    setFilteredPhotos(filtered);
  }, [photos, activeTab, searchQuery, vaultUnlocked]);

  // ── Group photos ──
  const groupedPhotos = useMemo((): DateGroup[] => {
    const groups: Record<string, Photo[]> = {};
    filteredPhotos.forEach(photo => {
      const key = format(new Date(photo.timestamp), 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(photo);
    });
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, photos]) => ({
        date,
        label: format(parseISO(date), 'EEEE, MMM d'),
        photos,
      }));
  }, [filteredPhotos]);

  // ── Handlers ──
  const handlePhotoPress = useCallback((photo: Photo) => {
    if (isBatchMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPhotos(prev => {
        const next = new Set(prev);
        if (next.has(photo.id)) next.delete(photo.id);
        else next.add(photo.id);
        return next;
      });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Navigate to detail
    }
  }, [isBatchMode]);

  const handlePhotoLongPress = useCallback((photo: Photo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsBatchMode(true);
    setSelectedPhotos(new Set([photo.id]));
  }, []);

  const handleTabChange = useCallback((tab: GalleryTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    AsyncStorage.setItem(STORAGE_KEYS.GALLERY_TAB, tab);
    if (tab === 'vault') {
      setShowVaultLock(true);
    }
  }, []);

  const handleCamera = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await takePhoto();
      if (uri) {
        const newPhoto: Photo = {
          id: `cam_${Date.now()}`,
          uri,
          date: new Date().toISOString(),
          timestamp: Date.now(),
          type: 'daily',
          babyId: currentBaby?.id,
          source: 'camera',
          isPrivate: false,
          backupStatus: 'pending',
        };
        setPhotos(prev => [newPhoto, ...prev]);
      }
    } catch (error) {
      console.error('Camera error:', error);
    }
  }, [takePhoto, currentBaby]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  const tabs = [
    { key: 'all' as GalleryTab, label: 'All', icon: 'grid-outline' },
    { key: 'albums' as GalleryTab, label: 'Albums', icon: 'albums-outline' },
    { key: 'timeline' as GalleryTab, label: 'Timeline', icon: 'time-outline' },
    { key: 'favorites' as GalleryTab, label: 'Loved', icon: 'heart-outline' },
    { key: 'vault' as GalleryTab, label: 'Vault', icon: 'shield-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bgColors[0] }]}>
      <StatusBar barStyle={theme.statusBar} />
      <LinearGradient colors={theme.bgColors} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.blur} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>
          {currentBaby ? `${currentBaby.name}'s Photos` : 'Gallery'}
        </Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.secondary }]}>
          {filteredPhotos.length} photos
        </Text>
      </Animated.View>

      {/* Main Content */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary, theme.secondary]} />
        }
      >
        {/* ── TOP HEADER ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.surface.card }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
              {currentBaby ? `${currentBaby.name}'s Photos` : 'Gallery'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.muted }]}>
              {photos.length} memories captured
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, isBatchMode && { backgroundColor: `${theme.primary}15` }]}
              onPress={() => {
                setIsBatchMode(!isBatchMode);
                if (isBatchMode) setSelectedPhotos(new Set());
              }}
            >
              <Ionicons name={isBatchMode ? 'checkmark-circle' : 'checkbox-outline'} size={22} color={isBatchMode ? theme.primary : theme.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => {
              const next = viewMode === 'grid' ? 'list' : 'grid';
              setViewMode(next);
              AsyncStorage.setItem(STORAGE_KEYS.GALLERY_VIEW_MODE, next);
            }}>
              <Ionicons name={viewMode === 'grid' ? 'list' : 'grid'} size={22} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── SEARCH BAR ── */}
        <Animated.View entering={FadeInUp.delay(50).springify()} style={styles.searchWrap}>
          <View style={[styles.searchBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
            <Ionicons name="search" size={18} color={theme.text.muted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text.primary }]}
              placeholder="Search photos, tags, dates..."
              placeholderTextColor={theme.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── SMART SEARCH CHIPS (Feature 5) ── */}
        <SmartSearchChips photos={photos} onFilter={(f) => setSearchQuery(f)} theme={theme} />

        {/* ── TAB BAR ── */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} theme={theme} />

        {/* ── PHOTO INSIGHTS (Feature 6) ── */}
        {activeTab === 'all' && !searchQuery && <PhotoInsights photos={photos} theme={theme} />}

        {/* ── SMART STACKS (Feature 1) ── */}
        {activeTab === 'all' && !searchQuery && (
          <SmartStacks photos={photos} onOpenStack={(s) => console.log('Open stack', s)} theme={theme} />
        )}

        {/* ── MEMORY LANE (Feature 2) ── */}
        {activeTab === 'all' && !searchQuery && (
          <MemoryLane photos={photos} theme={theme} onPress={(p) => console.log('Memory', p)} />
        )}

        {/* ── FACE CLUSTERS (Feature 3) ── */}
        {activeTab === 'all' && !searchQuery && babies.length > 0 && (
          <FaceClusters photos={photos} babies={babies} theme={theme} onPress={(id) => console.log('Face cluster', id)} />
        )}

        {/* ── PHOTO STORIES (Feature 4) ── */}
        {activeTab === 'all' && !searchQuery && (
          <PhotoStories photos={photos} theme={theme} onPress={(s) => console.log('Story', s)} />
        )}

        {/* ── PHOTO GRID ── */}
        <View style={styles.gridSection}>
          <SectionHeader
            title={activeTab === 'favorites' ? 'Favorites' : activeTab === 'vault' ? 'Private Vault' : 'All Photos'}
            subtitle={`${filteredPhotos.length} photos`}
            theme={theme}
          />

          {viewMode === 'grid' ? (
            <View style={styles.photoGrid}>
              {groupedPhotos.map(group => (
                <View key={group.date}>
                  <DateGroupHeader date={group.date} isDark={theme.isDark} />
                  <View style={styles.gridRow}>
                    {group.photos.map((item, index) => (
                      <View key={item.id} style={{ width: GRID.itemSize, marginBottom: GRID.spacing }}>
                        <PhotoGridItem
                          item={item}
                          index={index}
                          isSelected={selectedPhotos.has(item.id)}
                          isBatchMode={isBatchMode}
                          viewMode={viewMode}
                          onPress={handlePhotoPress}
                          onLongPress={handlePhotoLongPress}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredPhotos.map((item, index) => (
                <PhotoGridItem
                  key={item.id}
                  item={item}
                  index={index}
                  isSelected={selectedPhotos.has(item.id)}
                  isBatchMode={isBatchMode}
                  viewMode={viewMode}
                  onPress={handlePhotoPress}
                  onLongPress={handlePhotoLongPress}
                />
              ))}
            </View>
          )}

          {filteredPhotos.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={64} color={theme.text.muted} />
              <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                {searchQuery ? 'No photos match your search' : 'No photos yet'}
              </Text>
              <TouchableOpacity style={[styles.captureBtn, { backgroundColor: theme.primary }]} onPress={handleCamera}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.captureBtnText}>Capture First Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 100 }} />
      </Animated.ScrollView>

      {/* ── BATCH BAR ── */}
      <BatchSelectBar
        selectedCount={selectedPhotos.size}
        onClear={() => { setSelectedPhotos(new Set()); setIsBatchMode(false); }}
        onDelete={() => {}}
        onShare={() => {}}
        onDownload={() => {}}
        isDark={theme.isDark}
      />

      {/* ── FLOATING CAMERA FAB ── */}
      {!isBatchMode && <FloatingCameraButton onPress={handleCamera} scrollY={scrollY} />}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned with Growth Dashboard DNA
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(100,116,139,0.08)',
  },

  // ── Search ──
  searchWrap: { marginHorizontal: 16, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },

  // ── Chips ──
  chipsScroll: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipLabel: { fontSize: 12, fontWeight: '700' },
  chipCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  chipCountText: { fontSize: 10, fontWeight: '800' },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 4,
    borderRadius: 16,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    /* no shadow */
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
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
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Photo Insights ──
  insightsGrid: {
    flexDirection: 'row',
    padding: DESIGN.spacing.lg,
    gap: DESIGN.spacing.md,
  },
  insightItem: { flex: 1, alignItems: 'center', gap: 6 },
  insightIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightValue: { fontSize: 20, fontWeight: '800' },
  insightLabel: { fontSize: 11, fontWeight: '600' },

  // ── Smart Stacks ──
  stacksScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  stackCard: { width: 140, marginRight: 12 },
  stackImages: { width: 140, height: 140, position: 'relative' },
  stackCover: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 16,
    top: 0,
    left: 0,
  },
  stackBack1: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 16,
    top: 5,
    left: 5,
    opacity: 0.6,
    transform: [{ rotate: '3deg' }],
  },
  stackBack2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 16,
    top: 10,
    left: 10,
    opacity: 0.3,
    transform: [{ rotate: '6deg' }],
  },
  stackOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 10,
  },
  stackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stackBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stackLabel: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  // ── Memory Lane ──
  memorySection: { marginHorizontal: 16, marginBottom: 16 },
  memoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  memoryEmoji: { fontSize: 18 },
  memoryLabel: { fontSize: 16, fontWeight: '800' },
  memoryGrid: { flexDirection: 'row', gap: 8 },
  memoryItem: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  memoryImage: { width: '100%', height: '100%' },
  memoryHeart: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    padding: 4,
  },

  // ── Face Clusters ──
  facesScroll: { paddingHorizontal: 16, gap: 16, paddingBottom: 4 },
  faceCluster: { alignItems: 'center', width: 80 },
  faceAvatarWrap: { position: 'relative', marginBottom: 8 },
  faceAvatar: { width: 64, height: 64, borderRadius: 32 },
  faceCountBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#667eea',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  faceCountText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  faceName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // ── Photo Stories ──
  storiesScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  storyCard: {
    width: 160,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  storyCover: { width: '100%', height: '100%' },
  storyGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  storyContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  storyTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  storyMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500', marginTop: 2 },
  storyRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#667eea',
  },

  // ── Grid Section ──
  gridSection: { marginTop: 8 },
  photoGrid: { paddingHorizontal: 16 },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID.spacing,
  },
  listContainer: { gap: 8, paddingHorizontal: 16 },

  // ── Grid Item ──
  gridItem: {
    width: GRID.itemSize,
    height: GRID.itemSize,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  gridItemSelected: {
    borderWidth: 3,
    borderColor: '#667eea',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  batchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 8,
  },
  batchOverlaySelected: {
    backgroundColor: 'rgba(102,126,234,0.3)',
  },
  batchCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  batchCircleSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  gridBadges: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    gap: 4,
  },
  gridBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: { fontSize: 14 },

  // ── List Item ──
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    gap: 12,
    /* no shadow */
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  listInfo: { flex: 1, gap: 3 },
  listDate: { fontSize: 12, fontWeight: '600' },
  listCaption: { fontSize: 14, fontWeight: '700' },
  listMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  listCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCheckSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },

  // ── Date Group ──
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dateGroupText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 12,
  },
  dateGroupLine: {
    flex: 1,
    height: 1,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  captureBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ── Batch Bar ──
  batchBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    /* no shadow */
    zIndex: 100,
  },
  batchInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  batchCount: { fontSize: 16, fontWeight: '700' },
  batchClear: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  batchActions: { flexDirection: 'row', gap: 12 },
  batchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(100,116,139,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── FAB ──
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
    pointerEvents: 'box-none',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});