import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Dimensions, LayoutAnimation, Platform, UIManager, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withTiming, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCustomization } from '../../hooks/useCustomization';
import { useTracker } from '../../context/TrackerContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UnifiedTrackerConfig, TrackerCategory } from '../../types/trackers';
import { RootStackParamList } from '../../types/navigation';
  CATEGORY_CONFIG,
  TRACKER_PICKER_KEYS,
} from './trackerConstants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TimelinePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (trackerId: string) => void;
  currentBabyName?: string;
  currentBabyAvatar?: string;
}

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

  return (
    <Animated.View layout={shouldReduceMotion ? undefined : Layout.springify()} style={styles.categorySection}>
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
        <View style={styles.categoryRight}>
          {isExpanded && searchQuery === '' ? (
            <TouchableOpacity style={styles.collapseHint} onPress={(e) => { e.stopPropagation(); onToggle(); }}>
              <Ionicons name="chevron-up" size={20} color={fullThemeColors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down" size={20} color={fullThemeColors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.duration(200)} style={styles.trackersGrid}>
          {trackers.map((tracker, index) => (
            <Animated.View
              key={tracker.id}
              entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 30)}
              style={{ width: '50%', padding: 4 }}
            >
              <TouchableOpacity
                style={[styles.trackerCard, {
                  backgroundColor: fullThemeColors.surface,
                  borderRadius: borderRadiusValue,
                  borderColor: fullThemeColors.border,
                  ...Platform.select({
                    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
                    android: { elevation: 2 },
                  }),
                }]}
                onPress={() => onSelectTracker(tracker)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={tracker.gradient}
                  style={[styles.trackerGradient, { borderRadius: borderRadiusValue }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
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
                          name={isFavorite(tracker.id) ? 'star' : 'star-outline'}
                          size={16}
                          color={isFavorite(tracker.id) ? '#fdcb6e' : 'rgba(255,255,255,0.6)'}
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
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
};

export const TimelinePicker: React.FC<TimelinePickerProps> = ({
  visible, onClose, onSelect, currentBabyName, currentBabyAvatar,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const customization = useCustomization();
  const { fullThemeColors, themeColors, isDark, borderRadiusValue, fontSizeMultiplier, shouldReduceMotion, triggerHaptic } = customization;
  const { trackers } = useTracker();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<TrackerCategory>>(new Set(['essential', 'custom']));
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentTrackers, setRecentTrackers] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const searchHeight = useSharedValue(0);
  const searchOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
  }, [visible]);

  useEffect(() => {
    if (showSearch) {
      searchHeight.value = withTiming(60, { duration: 200 });
      searchOpacity.value = withTiming(1, { duration: 200 });
      setTimeout(() => searchInputRef.current?.focus(), 250);
    } else {
      searchHeight.value = withTiming(0, { duration: 200 });
      searchOpacity.value = withTiming(0, { duration: 200 });
      Keyboard.dismiss();
      setSearchQuery('');
    }
  }, [showSearch]);

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

  const favoriteTrackers = useMemo(() => trackers.filter(t => favorites.has(t.id)), [trackers, favorites]);
  const recentTrackerObjects = useMemo(() =>
    recentTrackers.map(id => trackers.find(t => t.id === id)).filter(Boolean) as UnifiedTrackerConfig[],
  [recentTrackers, trackers]);

  const toggleCategory = useCallback((cat: TrackerCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories(new Set(sortedCategories));
  }, [sortedCategories, triggerHaptic]);

  const collapseAll = useCallback(() => {
    triggerHaptic('light');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories(new Set());
  }, [triggerHaptic]);

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <SafeAvatar avatar={currentBabyAvatar} size={40} fallbackIcon="person" borderColor={themeColors.primary} borderWidth={2} animated={false} />
                <View style={styles.headerText}>
                  <Text style={[styles.headerTitle, { color: fullThemeColors.text, fontSize: 20 * fontSizeMultiplier }]}>
                    What are you logging?
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
                    {currentBabyName ? `For ${currentBabyName}` : 'Select a tracker'}
                  </Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]} onPress={() => { triggerHaptic('light'); setShowSearch(!showSearch); }}>
                  <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={fullThemeColors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]} onPress={onClose}>
                  <Ionicons name="close" size={22} color={fullThemeColors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search */}
            <Animated.View style={searchAnimatedStyle}>
              <View style={[styles.searchContainer, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue }]}>
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

            {/* Quick Actions */}
            {!showSearch && (
              <View style={styles.quickActions}>
                <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: `${themeColors.primary}15`, borderRadius: borderRadiusValue }]} onPress={expandAll}>
                  <Ionicons name="expand" size={14} color={themeColors.primary} />
                  <Text style={[styles.quickActionText, { color: themeColors.primary, fontSize: 12 * fontSizeMultiplier }]}>Expand All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]} onPress={collapseAll}>
                  <Ionicons name="contract" size={14} color={fullThemeColors.textSecondary} />
                  <Text style={[styles.quickActionText, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>Collapse</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: `${CATEGORY_CONFIG.custom.color}15`, borderRadius: borderRadiusValue }]} onPress={handleCreateCustom}>
                  <Ionicons name="add-circle" size={14} color={CATEGORY_CONFIG.custom.color} />
                  <Text style={[styles.quickActionText, { color: CATEGORY_CONFIG.custom.color, fontSize: 12 * fontSizeMultiplier }]}>New Tracker</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Content */}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            {/* Recent */}
            {recentTrackerObjects.length > 0 && !searchQuery && (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
                  <Ionicons name="time-outline" size={14} color={fullThemeColors.textSecondary} /> RECENT
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
                  {recentTrackerObjects.map((tracker, idx) => (
                    <Animated.View key={tracker.id} entering={shouldReduceMotion ? undefined : FadeInUp.delay(idx * 50)}>
                      <TouchableOpacity style={[styles.recentChip, { backgroundColor: fullThemeColors.surface, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]} onPress={() => handleSelectTracker(tracker)}>
                        <LinearGradient colors={tracker.gradient} style={[styles.recentChipGradient, { borderRadius: borderRadiusValue }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                          <Text style={styles.recentChipEmoji}>{tracker.emoji}</Text>
                          <Text style={[styles.recentChipText, { fontSize: 13 * fontSizeMultiplier }]} numberOfLines={1}>{tracker.name}</Text>
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
                <Text style={[styles.sectionTitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
                  <Ionicons name="star" size={14} color="#fdcb6e" /> FAVORITES
                </Text>
                <View style={styles.favoritesGrid}>
                  {favoriteTrackers.map((tracker, idx) => (
                    <Animated.View key={tracker.id} entering={shouldReduceMotion ? undefined : FadeInUp.delay(idx * 50)} style={{ width: '50%', padding: 4 }}>
                      <TouchableOpacity style={[styles.favoriteCard, { backgroundColor: fullThemeColors.surface, borderColor: '#fdcb6e40', borderRadius: borderRadiusValue, borderWidth: 1.5 }]} onPress={() => handleSelectTracker(tracker)}>
                        <LinearGradient colors={tracker.gradient} style={[styles.favoriteGradient, { borderRadius: borderRadiusValue }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Text style={styles.favoriteEmoji}>{tracker.emoji}</Text>
                          <Text style={[styles.favoriteName, { fontSize: 14 * fontSizeMultiplier }]} numberOfLines={1}>{tracker.name}</Text>
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
                  <TouchableOpacity style={[styles.createFromSearchBtn, { backgroundColor: `${CATEGORY_CONFIG.custom.color}20`, borderRadius: borderRadiusValue }]} onPress={handleCreateCustom}>
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
                    isExpanded={searchQuery ? true : expandedCategories.has(category)}
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

          {/* Floating Create Button */}
          <View style={styles.floatingFooter}>
            <LinearGradient colors={['transparent', fullThemeColors.background]} style={styles.footerGradient} pointerEvents="none" />
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
              <Text style={[styles.createTrackerText, { fontSize: 16 * fontSizeMultiplier }]}>Create Custom Tracker</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, justifyContent: 'flex-end' },
  blurView: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  modalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 20 },
    }),
  },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerText: { flex: 1 },
  headerTitle: { fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { marginTop: 2, fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, gap: 10 },
  searchInput: { flex: 1, fontWeight: '500', padding: 0 },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  quickActionText: { fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  section: { marginBottom: 20 },
  sectionTitle: { fontWeight: '700', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  recentScroll: { paddingRight: 16, gap: 8 },
  recentChip: { borderWidth: 1, overflow: 'hidden', minWidth: 120 },
  recentChipGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  recentChipEmoji: { fontSize: 20 },
  recentChipText: { color: '#fff', fontWeight: '700' },
  favoritesGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  favoriteCard: { overflow: 'hidden', borderWidth: 1 },
  favoriteGradient: { padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 80 },
  favoriteEmoji: { fontSize: 32, marginBottom: 6 },
  favoriteName: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  categoriesContainer: { gap: 8 },
  categorySection: { marginBottom: 4 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1 },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  categoryIconEmoji: { fontSize: 18 },
  categoryInfo: { flex: 1 },
  categoryLabel: { fontWeight: '700' },
  categoryCount: { marginTop: 2, fontWeight: '500' },
  categoryRight: { flexDirection: 'row', alignItems: 'center' },
  collapseHint: { padding: 4 },
  trackersGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 8, paddingLeft: 8 },
  trackerCard: { overflow: 'hidden', borderWidth: 1 },
  trackerGradient: { padding: 12, minHeight: 100 },
  trackerCardContent: { flex: 1 },
  trackerEmojiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trackerEmoji: { fontSize: 28 },
  favoriteBtn: { padding: 4 },
  trackerName: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  trackerDesc: { color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
  customBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 6 },
  customBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptySearch: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptySearchText: { fontWeight: '600', textAlign: 'center' },
  createFromSearchBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  createFromSearchText: { fontWeight: '700' },
  floatingFooter: { position: 'relative', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 24 : 16, paddingTop: 8 },
  footerGradient: { position: 'absolute', top: -40, left: 0, right: 0, height: 60 },
  createTrackerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  createTrackerText: { color: '#fff', fontWeight: '700' },
  bottomSpacing: { height: 20 },
});

export default TimelinePicker;
