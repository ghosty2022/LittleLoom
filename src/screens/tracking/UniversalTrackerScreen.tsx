// src/screens/tracking/UniversalTrackerScreen.tsx
// MODERNIZED: SafeAvatar, SweetAlert, full useCustomization integration
// Unified per-tracker view with glassmorphism, sticky header, stats, timeline

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { format, isToday, isSameWeek, differenceInDays } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useTracker } from '../../context/TrackerContext';
import { TrackerConfig, TrackerEntry } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

const { width } = Dimensions.get('window');

type UniversalTrackerRouteProp = RouteProp<RootStackParamList, 'UniversalTracker'>;
type UniversalTrackerNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Entry Card (modernized with SafeAvatar) ───
const EntryCard: React.FC<{
  entry: TrackerEntry;
  tracker: TrackerConfig;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  delay: number;
}> = ({ entry, tracker, isLast, onEdit, onDelete, delay }) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();
  const time = format(new Date(entry.timestamp), 'h:mm a');

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()}>
      <View style={styles.entryRow}>
        <View style={styles.timeColumn}>
          <Text style={[styles.timeText, { color: tracker.gradient[0] }]}>{time}</Text>
          {!isLast && (
            <View style={[styles.timelineLine, { backgroundColor: `${tracker.gradient[0]}30` }]} />
          )}
        </View>

        <TouchableOpacity style={styles.entryCardContainer} activeOpacity={0.9}>
          <BlurView
            intensity={40}
            style={[styles.entryCard, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${tracker.gradient[0]}15`, borderRadius: borderRadiusValue / 2 }]}>
              <Text style={styles.typeEmoji}>{tracker.emoji}</Text>
            </View>

            <View style={styles.entryContent}>
              <Text style={[styles.entryTitle, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{entry.title}</Text>
              {entry.notes && (
                <Text style={[styles.entrySubtitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]} numberOfLines={2}>
                  {entry.notes}
                </Text>
              )}
              <Text style={[styles.timestampText, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
                {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
                {entry.loggedByName && ` • by ${entry.loggedByName}`}
              </Text>
            </View>

            <View style={styles.entryActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue / 3 }]}
                onPress={onEdit}
              >
                <Ionicons name="create-outline" size={18} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue / 3 }]}
                onPress={onDelete}
              >
                <Ionicons name="trash-outline" size={18} color={fullThemeColors.error} />
              </TouchableOpacity>
            </View>
          </BlurView>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── Sticky Header (modernized with SafeAvatar) ───
const StickyHeader: React.FC<{
  scrollY: any;
  tracker: TrackerConfig;
  babyName: string;
  babyAvatar?: string;
  stats: any;
  onBack: () => void;
  onAdd: () => void;
  onManageTrackers: () => void;
}> = ({ scrollY, tracker, babyName, babyAvatar, stats, onBack, onAdd, onManageTrackers }) => {
  const { fullThemeColors, themeColors, isDark, borderRadiusValue, fontSizeMultiplier } = useCustomization();

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 100], [-20, 0], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }] };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 60], [1, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  return (
    <View style={styles.stickyHeaderContainer}>
      <LinearGradient
        colors={isDark
          ? [tracker.gradient[0] + '15', tracker.gradient[1] + '08', fullThemeColors.background]
          : [tracker.gradient[0] + '20', tracker.gradient[1] + '10', fullThemeColors.background]
        }
        style={styles.headerGradient}
      />

      <View style={styles.headerContent}>
        <TouchableOpacity onPress={onBack} style={[styles.backButton, { borderRadius: borderRadiusValue }]}>
          <BlurView intensity={isDark ? 40 : 80} style={[styles.backBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="arrow-back" size={24} color={fullThemeColors.text} />
          </BlurView>
        </TouchableOpacity>

        <Animated.View style={[styles.headerCenter, titleAnimatedStyle]}>
          <SafeAvatar
            avatar={babyAvatar}
            size={36}
            fallbackIcon="person"
            borderColor={tracker.gradient[0]}
            borderWidth={2}
            animated={false}
          />
          <Text style={[styles.headerTitleLarge, { color: fullThemeColors.text, fontSize: 24 * fontSizeMultiplier }]}>
            {tracker.emoji} {tracker.name}
          </Text>
          <Text style={[styles.headerSubtitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
            {babyName} • {stats.primary?.value || 0} today
          </Text>
        </Animated.View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={onManageTrackers} style={[styles.headerActionBtn, { borderRadius: borderRadiusValue }]}>
            <BlurView intensity={isDark ? 40 : 80} style={[styles.actionBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
              <Ionicons name="grid-outline" size={22} color={fullThemeColors.text} />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAdd} style={[styles.headerActionBtn, { borderRadius: borderRadiusValue }]}>
            <LinearGradient colors={tracker.gradient} style={[styles.addButtonSmall, { borderRadius: borderRadiusValue }]}>
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.stickyTitleContainer, headerAnimatedStyle]}>
        <BlurView intensity={isDark ? 40 : 90} style={[styles.stickyBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
          <Text style={[styles.stickyTitle, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>
            {tracker.emoji} {tracker.name}
          </Text>
          <Text style={[styles.stickySubtitle, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
            {stats.primary?.value || 0} {stats.primary?.label || 'entries'}
          </Text>
        </BlurView>
      </Animated.View>
    </View>
  );
};

export default function UniversalTrackerScreen() {
  const navigation = useNavigation<UniversalTrackerNavigationProp>();
  const route = useRoute<UniversalTrackerRouteProp>();
  const insets = useSafeAreaInsets();

  const {
    fullThemeColors,
    themeColors,
    isDark,
    hapticFeedback,
    reduceMotion,
    triggerHaptic,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
  } = useCustomization();
  const { success, confirm, error } = useSweetAlert();

  const {
    trackers,
    getTracker,
    getEntries,
    deleteEntry,
    refreshEntries,
    isLoading,
    currentBaby,
  } = useTracker();

  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const trackerId = route.params?.type || 'potty';
  const tracker = getTracker(trackerId) || trackers[0];

  // Load entries
  useEffect(() => {
    refreshEntries();
  }, [trackerId, refreshEntries]);

  const allEntries = useMemo(() => {
    return getEntries(trackerId);
  }, [trackerId, getEntries]);

  const filteredEntries = useMemo(() => {
    let filtered = allEntries;
    const now = new Date();

    if (selectedTimeRange === 'today') {
      filtered = filtered.filter(e => isToday(new Date(e.timestamp)));
    } else if (selectedTimeRange === 'week') {
      filtered = filtered.filter(e => isSameWeek(new Date(e.timestamp), now, { weekStartsOn: 1 }));
    } else if (selectedTimeRange === 'month') {
      filtered = filtered.filter(e => differenceInDays(now, new Date(e.timestamp)) <= 30);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [allEntries, selectedTimeRange]);

  const groupedEntries = useMemo(() => {
    const groups: { title: string; date: Date; entries: TrackerEntry[] }[] = [];
    let currentGroup: typeof groups[0] | null = null;

    filteredEntries.forEach(entry => {
      const entryDate = new Date(entry.timestamp);
      const dateKey = format(entryDate, 'yyyy-MM-dd');

      if (!currentGroup || format(currentGroup.date, 'yyyy-MM-dd') !== dateKey) {
        currentGroup = {
          title: getDateTitle(entry.timestamp),
          date: entryDate,
          entries: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.entries.push(entry);
    });

    return groups;
  }, [filteredEntries]);

  const getDateTitle = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date >= today) return 'Today';
    if (date >= yesterday) return 'Yesterday';

    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 7) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return daysOfWeek[date.getDay()] ?? 'Unknown';
    }

    return format(date, 'MMM d, yyyy');
  };

  // Stats
  const stats = useMemo(() => {
    const today = allEntries.filter(e => isToday(new Date(e.timestamp)));
    const week = allEntries.filter(e => isSameWeek(new Date(e.timestamp), new Date(), { weekStartsOn: 1 }));

    const primary = {
      label: 'Today',
      value: today.length,
      emoji: tracker?.emoji || '📊',
      color: tracker?.gradient[0] || themeColors.primary,
    };

    const secondary = [
      { label: 'This Week', value: week.length, emoji: '📅' },
      { label: 'Total', value: allEntries.length, emoji: '📊' },
      { label: 'Rate', value: `${allEntries.length > 0 ? Math.round((today.length / allEntries.length) * 100) : 0}%`, emoji: '📈' },
    ];

    return { primary, secondary };
  }, [allEntries, tracker, themeColors.primary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshEntries();
    setRefreshing(false);
  }, [refreshEntries]);

  const handleAdd = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('AddLog', { trackerId: tracker.id });
  }, [navigation, tracker, triggerHaptic]);

  const handleEdit = useCallback((entry: TrackerEntry) => {
    triggerHaptic('light');
    navigation.navigate('AddLog', { editMode: true, eventId: entry.id, trackerId: tracker.id });
  }, [navigation, tracker, triggerHaptic]);

  const handleDelete = useCallback((entry: TrackerEntry) => {
    triggerHaptic('warning');
    confirm(
      'Delete Entry',
      `Delete this ${tracker.name.toLowerCase()} entry? This cannot be undone.`,
      async () => {
        await deleteEntry(entry.id);
        triggerHaptic('success');
        success('Deleted', `${tracker.name} entry removed.`);
      },
      () => triggerHaptic('light'),
      'Delete',
      'Cancel'
    );
  }, [deleteEntry, tracker, triggerHaptic, confirm, success]);

  const handleScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <View style={styles.loadingContainer}>
          <SafeAvatar
            avatar={currentBaby?.avatar}
            size={64}
            fallbackIcon="person"
            borderColor={themeColors.primary}
            borderWidth={3}
            animated
          />
          <Text style={[styles.loadingText, { color: fullThemeColors.textSecondary, fontSize: 16 * fontSizeMultiplier }]}>Loading entries...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
      <StickyHeader
        scrollY={scrollY}
        tracker={tracker}
        babyName={currentBaby?.name || 'Baby'}
        babyAvatar={currentBaby?.avatar}
        stats={stats}
        onBack={() => navigation.goBack()}
        onAdd={handleAdd}
        onManageTrackers={() => navigation.navigate('Track')}
      />

      <AutoHideScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tracker.gradient[0]}
            progressViewOffset={insets.top + 140}
          />
        }
      >
        {/* Stats */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.statsContainer}>
          <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
            <LinearGradient colors={tracker.gradient} style={[styles.statCard, styles.primaryStatCard, { borderRadius: borderRadiusValue }]}>
              <Text style={styles.primaryStatEmoji}>{stats.primary?.emoji}</Text>
              <Text style={[styles.primaryStatNumber, { fontSize: 36 * fontSizeMultiplier }]}>{stats.primary?.value}</Text>
              <Text style={styles.primaryStatLabel}>{stats.primary?.label}</Text>
            </LinearGradient>

            {stats.secondary?.map((stat: any, idx: number) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  styles.secondaryStatCard,
                  { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue },
                ]}
              >
                <Text style={styles.secondaryStatEmoji}>{stat.emoji}</Text>
                <Text style={[styles.secondaryStatNumber, { color: stat.color || fullThemeColors.text, fontSize: 24 * fontSizeMultiplier }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.secondaryStatLabel, { color: fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </AutoHideScrollView>
        </Animated.View>

        {/* Time Range Filter */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.filterContainer}>
          <View style={[styles.timeRangeTabs, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}>
            {(['today', 'week', 'month', 'all'] as const).map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeTab,
                  { borderRadius: borderRadiusValue / 1.5 },
                  selectedTimeRange === range && { backgroundColor: tracker.gradient[0] },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setSelectedTimeRange(range);
                }}
              >
                <Text
                  style={[
                    styles.timeTabText,
                    { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier },
                    selectedTimeRange === range && { color: '#fff', fontWeight: '700' },
                  ]}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Timeline */}
        <View style={styles.timelineContainer}>
          {groupedEntries.length === 0 ? (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue * 3 }]}>
                <Text style={styles.emptyEmoji}>{tracker.emoji}</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>
                No {tracker.name.toLowerCase()} entries yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: fullThemeColors.textSecondary, fontSize: 15 * fontSizeMultiplier }]}>
                Start tracking {currentBaby?.name || 'your baby'}'s {tracker.name.toLowerCase()} by tapping the + button
              </Text>
              <TouchableOpacity style={[styles.emptyButton, { borderRadius: borderRadiusValue }]} onPress={handleAdd}>
                <LinearGradient colors={tracker.gradient} style={[styles.emptyButtonGradient, { borderRadius: borderRadiusValue }]}>
                  <Text style={[styles.emptyButtonText, { fontSize: 16 * fontSizeMultiplier }]}>Add First Entry</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            groupedEntries.map((group, groupIndex) => (
              <View key={`${group.title}-${groupIndex}`} style={styles.daySection}>
                <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(groupIndex * 100)}>
                  <View style={styles.dateHeaderContainer}>
                    <Text style={[styles.dateHeader, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>
                      {group.title}
                    </Text>
                    <View style={[styles.dateBadge, { backgroundColor: `${tracker.gradient[0]}20`, borderRadius: borderRadiusValue / 2 }]}>
                      <Text style={[styles.dateBadgeText, { color: tracker.gradient[0] }]}>{group.entries.length}</Text>
                    </View>
                  </View>

                  <View style={styles.entriesContainer}>
                    {group.entries.map((entry, entryIndex) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        tracker={tracker}
                        isLast={entryIndex === group.entries.length - 1}
                        onEdit={() => handleEdit(entry)}
                        onDelete={() => handleDelete(entry)}
                        delay={groupIndex * 100 + entryIndex * 50}
                      />
                    ))}
                  </View>
                </Animated.View>
              </View>
            ))
          )}
          <View style={styles.bottomPadding} />
        </View>
      </AutoHideScrollView>
    </View>
  );
}

// ─── Modernized Styles ───
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 140 },
  stickyHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: Platform.OS === 'ios' ? 50 : 40 },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backButton: { overflow: 'hidden' },
  backBlur: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', flex: 1, marginHorizontal: 10, gap: 6 },
  headerTitleLarge: { fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontWeight: '500' },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: { overflow: 'hidden' },
  actionBlur: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addButtonSmall: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stickyTitleContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 40, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 80 },
  stickyBlur: { paddingHorizontal: 20, paddingVertical: 8, alignItems: 'center' },
  stickyTitle: { fontWeight: '800' },
  stickySubtitle: { fontWeight: '600' },

  statsContainer: { marginBottom: 16 },
  statsContent: { paddingHorizontal: 20, gap: 12 },
  statCard: { padding: 16, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  primaryStatCard: { width: 140, height: 140 },
  primaryStatEmoji: { fontSize: 32 },
  primaryStatNumber: { fontWeight: '800', color: '#fff', letterSpacing: -1 },
  primaryStatLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  secondaryStatCard: { width: 100, height: 140, borderWidth: 1 },
  secondaryStatEmoji: { fontSize: 24 },
  secondaryStatNumber: { fontWeight: '800', letterSpacing: -0.5 },
  secondaryStatLabel: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  filterContainer: { paddingHorizontal: 20, marginBottom: 12 },
  timeRangeTabs: { flexDirection: 'row', padding: 4, borderWidth: 1 },
  timeTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  timeTabText: { fontWeight: '600' },

  timelineContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  daySection: { marginBottom: 24 },
  dateHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: 4 },
  dateHeader: { fontWeight: '800', letterSpacing: -0.3 },
  dateBadge: { paddingHorizontal: 8, paddingVertical: 2, marginLeft: 10 },
  dateBadgeText: { fontSize: 12, fontWeight: '700' },
  entriesContainer: { gap: 12 },

  entryRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timeColumn: { width: 70, alignItems: 'flex-start', paddingTop: 16 },
  timeText: { fontSize: 13, fontWeight: '700' },
  timelineLine: { width: 2, height: 80, marginLeft: 20, marginTop: 8, borderRadius: 1 },
  entryCardContainer: { flex: 1 },
  entryCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  iconContainer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  typeEmoji: { fontSize: 28 },
  entryContent: { flex: 1 },
  entryTitle: { fontWeight: '700', marginBottom: 4 },
  entrySubtitle: { marginBottom: 4, lineHeight: 18 },
  timestampText: { fontWeight: '500' },
  entryActions: { flexDirection: 'row', gap: 4 },
  actionButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconContainer: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontWeight: '800', marginBottom: 8 },
  emptySubtitle: { textAlign: 'center', marginBottom: 24, paddingHorizontal: 40, lineHeight: 22 },
  emptyButton: { overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  emptyButtonGradient: { paddingHorizontal: 28, paddingVertical: 16 },
  emptyButtonText: { color: '#fff', fontWeight: '700' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontWeight: '500' },
  bottomPadding: { height: 40 },
});