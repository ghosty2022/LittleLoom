// src/screens/tracking/TimelineScreen.tsx
// MODERNIZED: SafeAvatar, SweetAlert, full useCustomization integration
// Glassmorphism, sticky header, filters — all preserved and enhanced

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
} from 'react-native-reanimated';
import { format, isSameDay } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useTracker } from '../../context/TrackerContext';
import { TrackerEntry, TrackerConfig } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

const { width } = Dimensions.get('window');

type TimelineScreenRouteProp = RouteProp<RootStackParamList, 'Timeline'>;
type TimelineScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Filter Config (modernized with theme colors) ───
const FILTERS: { id: string; label: string; icon: string; color: string; gradient: [string, string] }[] = [
  { id: 'all', label: 'All', icon: 'grid-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { id: 'potty', label: 'Potty', icon: 'water-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { id: 'feed', label: 'Feed', icon: 'nutrition-outline', color: '#fa709a', gradient: ['#fa709a', '#f5576c'] },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
  { id: 'growth', label: 'Growth', icon: 'trending-up-outline', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'milestone', label: 'Milestone', icon: 'trophy-outline', color: '#ffd700', gradient: ['#ffd700', '#ffaa00'] },
  { id: 'medication', label: 'Health', icon: 'medical-outline', color: '#ff6b6b', gradient: ['#ff6b6b', '#ee5a5a'] },
];

// ─── Glassmorphism Card (modernized) ───
const GlassmorphismCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  intensity?: number;
  gradient?: [string, string];
}> = ({ children, style, onPress, intensity = 80, gradient }) => {
  const { fullThemeColors, isDark } = useCustomization();
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={gradient || (isDark
          ? [fullThemeColors.glassBg, fullThemeColors.glassBg]
          : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)'])}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { borderColor: fullThemeColors.glassBorder }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

// ─── Event Card (modernized with SafeAvatar) ───
const EventCard: React.FC<{
  entry: TrackerEntry;
  tracker: TrackerConfig;
  isLast: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  delay: number;
}> = ({ entry, tracker, isLast, onPress, onEdit, onDelete, delay }) => {
  const { fullThemeColors, isDark, borderRadiusValue } = useCustomization();
  const time = format(entry.timestamp, 'h:mm a');

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()}>
      <View style={styles.eventRow}>
        <View style={styles.timeColumn}>
          <Text style={[styles.timeText, { color: tracker.gradient[0] }]}>{time}</Text>
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: `${tracker.gradient[0]}30` }]} />}
        </View>

        <TouchableOpacity style={styles.eventCardContainer} onPress={onPress} activeOpacity={0.9}>
          <GlassmorphismCard style={[styles.eventCard, { borderRadius: borderRadiusValue }]} intensity={60}>
            <View style={[styles.eventIconContainer, { backgroundColor: `${tracker.gradient[0]}15` }]}>
              <Text style={styles.eventIcon}>{tracker.emoji}</Text>
            </View>

            <View style={styles.eventContent}>
              <Text style={[styles.eventTitle, { color: fullThemeColors.text }]}>{entry.title}</Text>
              {entry.notes && (
                <Text style={[styles.eventSubtitle, { color: fullThemeColors.textSecondary }]} numberOfLines={2}>
                  {entry.notes}
                </Text>
              )}
              <View style={styles.eventMeta}>
                <Text style={[styles.eventTime, { color: fullThemeColors.textSecondary }]}>
                  {format(entry.timestamp, 'MMM d, h:mm a')}
                </Text>
                {entry.loggedByName && (
                  <Text style={[styles.eventAuthor, { color: fullThemeColors.textSecondary }]}>
                    by {entry.loggedByName}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.eventActions}>
              <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={18} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
                <Ionicons name="trash-outline" size={18} color={fullThemeColors.error} />
              </TouchableOpacity>
            </View>
          </GlassmorphismCard>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── Filter Chip (modernized) ───
const FilterChip: React.FC<{
  filter: typeof FILTERS[0];
  isSelected: boolean;
  onPress: () => void;
  index: number;
}> = ({ filter, isSelected, onPress, index }) => {
  const { borderRadiusValue, fullThemeColors } = useCustomization();

  return (
    <AnimatedTouchableOpacity
      entering={FadeIn.delay(index * 50)}
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          borderRadius: borderRadiusValue,
          backgroundColor: isSelected ? filter.color : fullThemeColors.glassBg,
          borderColor: isSelected ? filter.color : fullThemeColors.border,
          transform: isSelected ? [{ scale: 1.05 }] : undefined,
        },
      ]}
    >
      <Ionicons
        name={filter.icon as any}
        size={16}
        color={isSelected ? '#fff' : filter.color}
        style={styles.filterIcon}
      />
      <Text style={[styles.filterText, isSelected && { color: '#fff', fontWeight: '700' }]}>
        {filter.label}
      </Text>
    </AnimatedTouchableOpacity>
  );
};

// ─── Sticky Header (modernized with SafeAvatar) ───
const StickyHeader: React.FC<{
  scrollY: any;
  babyName: string;
  babyAvatar?: string;
  stats: { today: number; total: number; milestones: number };
  onBack: () => void;
  onSearch: () => void;
  showSearch: boolean;
  insets: any;
}> = ({ scrollY, babyName, babyAvatar, stats, onBack, onSearch, showSearch, insets }) => {
  const { themeColors, fullThemeColors, isDark, borderRadiusValue } = useCustomization();

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 100], [-20, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  const todayDate = format(new Date(), 'MMM d');

  return (
    <View style={[styles.stickyHeaderContainer, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[`${themeColors.primary}33`, `${themeColors.secondary}1a`, 'transparent']}
        style={styles.headerGradient}
      />

      <View style={styles.headerContent}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <BlurView intensity={isDark ? 40 : 80} style={[styles.backBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="arrow-back" size={24} color={fullThemeColors.text} />
          </BlurView>
        </TouchableOpacity>

        <Animated.View style={[styles.headerCenter, titleAnimatedStyle]}>
          <SafeAvatar
            avatar={babyAvatar}
            size={36}
            fallbackIcon="person"
            borderColor={fullThemeColors.border}
            borderWidth={2}
            animated={false}
          />
          <Text style={[styles.headerTitleLarge, { color: fullThemeColors.text }]}>🗓️ {todayDate}</Text>
          <Text style={[styles.headerSubtitle, { color: fullThemeColors.textSecondary }]}>
            {babyName} • {stats.today} today • {stats.milestones} 🏆
          </Text>
        </Animated.View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={onSearch} style={styles.headerActionBtn} activeOpacity={0.7}>
            <BlurView intensity={isDark ? 40 : 80} style={[styles.actionBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
              <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={fullThemeColors.text} />
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.stickyTitleContainer, headerAnimatedStyle, { top: insets.top + 8 }]}>
        <BlurView intensity={isDark ? 40 : 90} style={[styles.stickyBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
          <Text style={[styles.stickyTitle, { color: fullThemeColors.text }]}>🗓️ Timeline</Text>
          <Text style={[styles.stickySubtitle, { color: fullThemeColors.textSecondary }]}>
            {stats.today} entries • {stats.milestones} milestones
          </Text>
        </BlurView>
      </Animated.View>
    </View>
  );
};

export default function TimelineScreen() {
  const navigation = useNavigation<TimelineScreenNavigationProp>();
  const route = useRoute<TimelineScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const {
    fullThemeColors,
    themeColors,
    isDark,
    triggerHaptic,
    borderRadiusValue,
    shouldReduceMotion,
    fontSizeMultiplier,
  } = useCustomization();
  const { entries, isLoading, refreshEntries, deleteEntry, getTracker, getEntries, currentBaby } = useTracker();
  const { success, error, confirm } = useSweetAlert();

  const scrollY = useSharedValue(0);

  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (route.params?.filter) setSelectedFilter(route.params.filter);
  }, [route.params]);

  const allEntries = useMemo(() => {
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }, [entries]);

  const groupedEvents = useMemo(() => {
    let filtered = allEntries;

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(e => e.trackerId === selectedFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.notes?.toLowerCase().includes(query) ||
        e.trackerId.toLowerCase().includes(query)
      );
    }

    const groups: { title: string; date: Date; events: TrackerEntry[] }[] = [];
    let currentGroup: typeof groups[0] | null = null;

    filtered.forEach(event => {
      const eventDate = new Date(event.timestamp);
      if (!currentGroup || !isSameDay(currentGroup.date, eventDate)) {
        currentGroup = { title: getDateTitle(event.timestamp), date: eventDate, events: [] };
        groups.push(currentGroup);
      }
      currentGroup.events.push(event);
    });

    return groups;
  }, [allEntries, selectedFilter, searchQuery]);

  const getDateTitle = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) return 'Today';
    if (date >= yesterday) return 'Yesterday';
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 7) return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()] ?? 'Unknown';
    return format(date, 'MMM d, yyyy');
  };

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    return {
      today: allEntries.filter(e => e.timestamp >= todayStart).length,
      total: allEntries.length,
      milestones: getEntries('milestone').length,
    };
  }, [allEntries, getEntries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshEntries();
    setRefreshing(false);
  }, [refreshEntries]);

  const handleEditEvent = useCallback((entry: TrackerEntry) => {
    triggerHaptic('light');
    navigation.navigate('AddLog', { editMode: true, eventId: entry.id, trackerId: entry.trackerId });
  }, [navigation, triggerHaptic]);

  const handleDeleteEvent = useCallback((entry: TrackerEntry) => {
    triggerHaptic('warning');
    confirm(
      'Delete Entry',
      `Are you sure you want to delete "${entry.title}"? This cannot be undone.`,
      async () => {
        await deleteEntry(entry.id);
        triggerHaptic('success');
        success('Deleted', 'Entry has been removed');
      },
      () => triggerHaptic('light'),
      'Delete',
      'Cancel'
    );
  }, [deleteEntry, triggerHaptic, confirm, success]);

  const handleEventPress = useCallback((entry: TrackerEntry) => {
    navigation.navigate('AddLog', { viewMode: true, eventId: entry.id, trackerId: entry.trackerId });
  }, [navigation]);

  const handleAddLog = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('Track');
  }, [navigation, triggerHaptic]);

  const handleScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient colors={isDark ? [fullThemeColors.background, fullThemeColors.surface] : ['#f8fafc', '#e2e8f0']} style={styles.loadingGradient}>
          <SafeAvatar
            avatar={currentBaby?.avatar}
            size={64}
            fallbackIcon="person"
            borderColor={themeColors.primary}
            borderWidth={3}
            animated
          />
          <Text style={[styles.loadingText, { color: themeColors.primary, fontSize: 32 * fontSizeMultiplier }]}>LittleLoom</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1, { backgroundColor: themeColors.primary }]} />
            <View style={[styles.dot, styles.dot2, { backgroundColor: themeColors.secondary }]} />
            <View style={[styles.dot, styles.dot3, { backgroundColor: themeColors.accent }]} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={isDark ? [fullThemeColors.background, fullThemeColors.surface] : ['#f8fafc', '#e2e8f0', '#dbeafe']}
        style={styles.backgroundGradient}
      />

      <StickyHeader
        scrollY={scrollY}
        babyName={currentBaby?.name || 'Baby'}
        babyAvatar={currentBaby?.avatar}
        stats={stats}
        onBack={() => navigation.goBack()}
        onSearch={() => setShowSearch(!showSearch)}
        showSearch={showSearch}
        insets={insets}
      />

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary, themeColors.secondary]}
            progressViewOffset={insets.top + 140}
          />
        }
      >
        {/* Search Bar */}
        {showSearch && (
          <Animated.View entering={FadeInDown} style={styles.searchContainer}>
            <BlurView intensity={isDark ? 40 : 90} style={[styles.searchBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
              <Ionicons name="search" size={20} color={fullThemeColors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]}
                placeholder="Search entries..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={fullThemeColors.textSecondary}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={fullThemeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        )}

        {/* Stats Overview */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.statsContainer}>
          <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={[styles.statCard, styles.primaryStatCard, { borderRadius: borderRadiusValue }]}>
              <Text style={styles.primaryStatEmoji}>📊</Text>
              <Text style={[styles.primaryStatNumber, { fontSize: 36 * fontSizeMultiplier }]}>{stats.today}</Text>
              <Text style={styles.primaryStatLabel}>Today</Text>
            </LinearGradient>

            <GlassmorphismCard style={[styles.statCard, styles.secondaryStatCard, { borderRadius: borderRadiusValue }]}>
              <Text style={styles.secondaryStatEmoji}>📁</Text>
              <Text style={[styles.secondaryStatNumber, { color: fullThemeColors.text, fontSize: 24 * fontSizeMultiplier }]}>{stats.total}</Text>
              <Text style={[styles.secondaryStatLabel, { color: fullThemeColors.textSecondary }]}>Total</Text>
            </GlassmorphismCard>

            <GlassmorphismCard style={[styles.statCard, styles.secondaryStatCard, { borderRadius: borderRadiusValue }]}>
              <Text style={styles.secondaryStatEmoji}>🏆</Text>
              <Text style={[styles.secondaryStatNumber, { color: fullThemeColors.warning, fontSize: 24 * fontSizeMultiplier }]}>{stats.milestones}</Text>
              <Text style={[styles.secondaryStatLabel, { color: fullThemeColors.textSecondary }]}>Milestones</Text>
            </GlassmorphismCard>
          </AutoHideScrollView>
        </Animated.View>

        {/* Filters */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.filterContainer}>
          <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activitySelector}>
            {FILTERS.map((filter, index) => (
              <FilterChip
                key={filter.id}
                filter={filter}
                isSelected={selectedFilter === filter.id}
                onPress={() => { triggerHaptic('light'); setSelectedFilter(filter.id); }}
                index={index}
              />
            ))}
          </AutoHideScrollView>
        </Animated.View>

        {/* Quick Add */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.quickAddContainer}>
          <Text style={[styles.quickAddTitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>Quick Add:</Text>
          <View style={styles.quickAddButtons}>
            <TouchableOpacity
              style={[styles.quickAddBtn, { backgroundColor: `${fullThemeColors.warning}15`, borderRadius: borderRadiusValue }]}
              onPress={() => navigation.navigate('AddLog', { trackerId: 'milestone' })}
            >
              <Ionicons name="trophy" size={18} color={fullThemeColors.warning} />
              <Text style={[styles.quickAddText, { color: fullThemeColors.warning }]}>Milestone</Text>
            </TouchableOpacity>
            {['potty', 'feed', 'sleep'].map(type => {
              const filter = FILTERS.find(f => f.id === type);
              if (!filter) return null;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.quickAddBtn, { backgroundColor: `${filter.color}15`, borderRadius: borderRadiusValue }]}
                  onPress={() => navigation.navigate('AddLog', { trackerId: type })}
                >
                  <Ionicons name={filter.icon as any} size={18} color={filter.color} />
                  <Text style={[styles.quickAddText, { color: filter.color }]}>{filter.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Timeline */}
        <View style={styles.timelineContainer}>
          {groupedEvents.length === 0 ? (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(400)} style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: fullThemeColors.glassBg }]}>
                <Ionicons name="document-text-outline" size={64} color={fullThemeColors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>
                {searchQuery ? 'No matches found' : 'No entries yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: fullThemeColors.textSecondary, fontSize: 15 * fontSizeMultiplier }]}>
                {searchQuery ? 'Try adjusting your search or filters' : "Start tracking by tapping the + button"}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={[styles.emptyButton, { shadowColor: themeColors.primary, borderRadius: borderRadiusValue }]}
                  onPress={handleAddLog}
                >
                  <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.emptyButtonGradient}>
                    <Text style={[styles.emptyButtonText, { fontSize: 16 * fontSizeMultiplier }]}>Add First Entry</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </Animated.View>
          ) : (
            groupedEvents.map((group, groupIndex) => (
              <View key={group.title} style={styles.daySection}>
                <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(groupIndex * 100)}>
                  <View style={styles.dateHeaderContainer}>
                    <Text style={[styles.dateHeader, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>{group.title}</Text>
                    <View style={[styles.dateBadge, { backgroundColor: `${themeColors.primary}20` }]}>
                      <Text style={[styles.dateBadgeText, { color: themeColors.primary }]}>{group.events.length}</Text>
                    </View>
                  </View>

                  <View style={styles.eventsContainer}>
                    {group.events.map((event, eventIndex) => {
                      const tracker = getTracker(event.trackerId);
                      if (!tracker) return null;
                      return (
                        <EventCard
                          key={event.id}
                          entry={event}
                          tracker={tracker}
                          isLast={eventIndex === group.events.length - 1}
                          onPress={() => handleEventPress(event)}
                          onEdit={() => handleEditEvent(event)}
                          onDelete={() => handleDeleteEvent(event)}
                          delay={groupIndex * 100 + eventIndex * 50}
                        />
                      );
                    })}
                  </View>
                </Animated.View>
              </View>
            ))
          )}
          <View style={{ height: insets.bottom + 100 }} />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Modernized Styles ───
const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 32, fontWeight: '800', marginTop: 12 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  stickyHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backButton: { width: 48, height: 48, overflow: 'hidden', zIndex: 10 },
  backBlur: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', flex: 1, marginHorizontal: 10, gap: 4 },
  headerTitleLarge: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: { width: 48, height: 48, overflow: 'hidden', zIndex: 10 },
  actionBlur: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },

  stickyTitleContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 80 },
  stickyBlur: { paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', minWidth: 200 },
  stickyTitle: { fontSize: 18, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '600' },

  glassCard: { overflow: 'hidden', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  glassContent: { flex: 1 },

  searchContainer: { marginHorizontal: 20, marginBottom: 16, marginTop: 8 },
  searchBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  searchInput: { flex: 1, marginLeft: 10, paddingVertical: 12 },

  statsContainer: { marginBottom: 16 },
  statsContent: { paddingHorizontal: 20, gap: 12 },
  statCard: { padding: 16, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  primaryStatCard: { width: 140, height: 140 },
  primaryStatEmoji: { fontSize: 32 },
  primaryStatNumber: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  primaryStatLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  secondaryStatCard: { width: 100, height: 140, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  secondaryStatEmoji: { fontSize: 24 },
  secondaryStatNumber: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  secondaryStatLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  filterContainer: { marginBottom: 16 },
  activitySelector: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  filterIcon: { marginRight: 2 },
  filterText: { fontSize: 14, fontWeight: '600' },

  quickAddContainer: { paddingHorizontal: 20, marginBottom: 16 },
  quickAddTitle: { fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickAddButtons: { flexDirection: 'row', gap: 10 },
  quickAddBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  quickAddText: { fontSize: 14, fontWeight: '600' },

  timelineContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  daySection: { marginBottom: 24 },
  dateHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 4 },
  dateHeader: { fontWeight: '800', letterSpacing: -0.3 },
  dateBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 10 },
  dateBadgeText: { fontSize: 12, fontWeight: '700' },
  eventsContainer: { gap: 12 },

  eventRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timeColumn: { width: 70, alignItems: 'flex-start', paddingTop: 16 },
  timeText: { fontSize: 13, fontWeight: '700' },
  timelineLine: { width: 2, height: 80, marginLeft: 20, marginTop: 8, borderRadius: 1 },
  eventCardContainer: { flex: 1 },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'transparent', borderWidth: 1, overflow: 'hidden' },
  eventIconContainer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  eventIcon: { fontSize: 24 },
  eventContent: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  eventSubtitle: { fontSize: 13, marginBottom: 6, lineHeight: 18 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTime: { fontSize: 11, fontWeight: '500' },
  eventAuthor: { fontSize: 11, fontWeight: '500' },
  eventActions: { flexDirection: 'row', gap: 4 },
  actionButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontWeight: '800', marginBottom: 8 },
  emptySubtitle: { textAlign: 'center', marginBottom: 24, paddingHorizontal: 40, lineHeight: 22 },
  emptyButton: { overflow: 'hidden', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  emptyButtonGradient: { paddingHorizontal: 28, paddingVertical: 16 },
  emptyButtonText: { color: '#fff', fontWeight: '700' },

  scrollContent: { paddingTop: 140 },
});