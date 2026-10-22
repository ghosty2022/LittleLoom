import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  FlatList,
  Platform,
  UIManager,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useCommunity, TOPIC_CATEGORIES, INITIAL_TOPICS, type Topic } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { updateSectionState } from '../../hooks/useIntelligentSplash';

const { width: SCREEN_W } = Dimensions.get('window');
const ONBOARDING_KEY = '@littleloom_community_onboarding_v3';
const SELECTED_TOPICS_KEY = '@community_selected_topics_v2';
const MIN_TOPICS = 5;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ── The Loom palette ─────────────────────────────────────── */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
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
  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

interface CategoryTopic {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  category: string;
  subcategory: string;
}

interface CategoryWithTopics {
  id: string;
  name: string;
  emoji: string;
  description: string;
  subcategories: { id: string; name: string; emoji: string }[];
  topics: CategoryTopic[];
}

/* ── Topic card ───────────────────────────────────────────── */
const TopicCard = React.memo(
  ({
    topic,
    isSelected,
    onPress,
    isDark,
  }: {
    topic: CategoryTopic;
    isSelected: boolean;
    onPress: () => void;
    isDark: boolean;
  }) => (
    <TouchableOpacity
      style={[
        s.topicCard,
        {
          borderColor: isSelected
            ? topic.color
            : isDark
            ? 'rgba(255,255,255,0.06)'
            : DS.lightBorder,
          backgroundColor: isSelected
            ? `${topic.color}15`
            : isDark
            ? 'rgba(255,255,255,0.03)'
            : DS.white,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {isSelected && (
        <LinearGradient
          colors={[`${topic.color}22`, `${topic.color}05`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View style={s.topicCardContent}>
        <View
          style={[
            s.topicEmojiWrap,
            {
              backgroundColor: isSelected
                ? `${topic.color}25`
                : isDark
                ? 'rgba(255,255,255,0.05)'
                : DS.gray100,
            },
          ]}
        >
          <Text style={s.topicEmoji}>{topic.emoji}</Text>
        </View>
        <Text
          style={[
            s.topicName,
            { color: isSelected ? topic.color : isDark ? DS.gray200 : DS.gray800 },
            isSelected && { fontWeight: '800' },
          ]}
          numberOfLines={1}
        >
          {topic.name}
        </Text>
        {isSelected && (
          <View style={[s.topicCheckmark, { backgroundColor: topic.color }]}>
            <Ionicons name="checkmark" size={11} color={DS.white} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  ),
);

/* ── Category header ─────────────────────────────────────── */
const CategoryHeader = React.memo(
  ({
    category,
    selectedCount,
    totalCount,
    isExpanded,
    onPress,
    isDark,
  }: {
    category: CategoryWithTopics;
    selectedCount: number;
    totalCount: number;
    isExpanded: boolean;
    onPress: () => void;
    isDark: boolean;
  }) => (
    <TouchableOpacity
      style={[
        s.categoryHeader,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white,
          borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={s.categoryHeaderContent}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.20)', 'rgba(236,72,153,0.10)']
              : ['rgba(99,102,241,0.12)', 'rgba(236,72,153,0.06)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.categoryIconWrap}
        >
          <Text style={s.categoryEmoji}>{category.emoji}</Text>
        </LinearGradient>
        <View style={s.categoryHeaderInfo}>
          <Text style={[s.categoryName, { color: isDark ? DS.white : DS.gray900 }]}>
            {category.name}
          </Text>
          <Text
            style={[
              s.categorySubtext,
              { color: isDark ? DS.gray400 : DS.gray500 },
            ]}
          >
            {selectedCount} selected · {totalCount} topics
          </Text>
        </View>
        <View style={s.categoryHeaderRight}>
          {selectedCount > 0 && (
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.categorySelectedBadge}
            >
              <Text style={s.categorySelectedText}>{selectedCount}</Text>
            </LinearGradient>
          )}
          <View
            style={[
              s.chevronWrap,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100,
              },
            ]}
          >
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={isDark ? DS.gray400 : DS.gray600}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ),
);

/* ═══════════════════════════════════════════════════════════
   Main
   ═══════════════════════════════════════════════════════════ */
export default function CommunityOnboardingScreen({ navigation, route, onComplete }: any) {
  const isEditing = route?.params?.editing === true;
  const sweetAlert = useSweetAlert();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const { updateSelectedTopics: updateUserTopics } = useUser();
  const { currentUser } = useCommunity();
  const insets = useSafeAreaInsets();

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allTopics] = useState<Topic[]>(INITIAL_TOPICS);

  const flatListRef = useRef<FlatList>(null);
  const progressWidth = useSharedValue(0);

  /* ── Load saved state ─────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const userId = currentUser?.id;
        const scopedKey = userId ? `${SELECTED_TOPICS_KEY}_${userId}` : SELECTED_TOPICS_KEY;
        const [onboardingData, selectedData] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(scopedKey),
        ]);

        let topics: string[] = [];
        if (onboardingData) {
          try {
            const parsed = JSON.parse(onboardingData);
            if (Array.isArray(parsed?.selectedTopics) && parsed.selectedTopics.length > 0) {
              topics = parsed.selectedTopics;
            }
          } catch {}
        }
        if (topics.length === 0 && selectedData) {
          try {
            const parsed = JSON.parse(selectedData);
            if (Array.isArray(parsed)) topics = parsed;
          } catch {}
        }

        const valid = topics.filter((id) => INITIAL_TOPICS.some((t) => t.id === id));
        setSelectedTopics(valid);

        const expanded = new Set<string>();
        if (valid.length > 0) {
          valid.forEach((id) => {
            const topic = INITIAL_TOPICS.find((t) => t.id === id);
            if (topic && (topic as any).category) expanded.add((topic as any).category);
          });
        } else {
          const categories = groupByCategory(INITIAL_TOPICS);
          if (categories.length > 0) expanded.add(categories[0].id);
        }
        // If we found nothing (empty topic list), expand every category so the
        // user isn't presented with a fully-collapsed list on first run.
        if (expanded.size === 0) {
          groupByCategory(INITIAL_TOPICS).forEach((c) => expanded.add(c.id));
        }
        setExpandedCategories(expanded);
      } catch (err) {
        console.error('[CommunityOnboarding] load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentUser?.id]);

  /* ── Group topics into categories (stable) ───────────────── */
  const groupByCategory = useCallback((topics: Topic[]): CategoryWithTopics[] => {
    const grouped = new Map<string, CategoryWithTopics>();
    TOPIC_CATEGORIES.forEach((cat) => {
      grouped.set(cat.id, { ...cat, topics: [] });
    });
    topics.forEach((topic) => {
      const catId = (topic as any).category || 'community';
      const cat = grouped.get(catId);
      if (cat) {
        cat.topics.push({
          id: topic.id,
          name: topic.name,
          emoji: topic.emoji,
          color: topic.color,
          description: topic.description,
          category: catId,
          subcategory: (topic as any).subcategory || '',
        });
      }
    });
    return Array.from(grouped.values())
      .filter((c) => c.topics.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const categoriesWithTopics = useMemo(
    () => groupByCategory(allTopics),
    [allTopics, groupByCategory],
  );

  // Fallback expander: if the category list ever becomes non-empty while
  // nothing is expanded (e.g. because topics arrived after the initial
  // load effect ran), auto-expand the first category so the user sees
  // tappable topic cards immediately.
  useEffect(() => {
    if (isLoading) return;
    if (expandedCategories.size > 0) return;
    if (categoriesWithTopics.length === 0) return;
    setExpandedCategories(new Set([categoriesWithTopics[0].id]));
  }, [categoriesWithTopics, expandedCategories.size, isLoading]);

  /* ── Animate progress ─────────────────────────────────────── */
  useEffect(() => {
    const target = Math.min((selectedTopics.length / MIN_TOPICS) * 100, 100);
    progressWidth.value = withTiming(target, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [selectedTopics.length, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const hasMinimum = selectedTopics.length >= MIN_TOPICS;
  const displayCount = selectedTopics.length;

  /* ── Toggles ─────────────────────────────────────────────── */
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleTopic = useCallback((topicId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    );
  }, []);

  /* ── Persist ─────────────────────────────────────────────── */
  const persist = useCallback(
    async (topicsToSave: string[], extra: Record<string, any> = {}) => {
      const userId = currentUser?.id;
      if (!userId) {
        throw new Error('No authenticated user — cannot persist topic selection');
      }

      const scopedKey = `${SELECTED_TOPICS_KEY}_${userId}`;
      const payload = {
        completed: true,
        selectedTopics: topicsToSave,
        timestamp: new Date().toISOString(),
        ...extra,
      };

      // Write every key the rest of the app reads, atomically-ish.
      await Promise.all([
        AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(payload)),
        AsyncStorage.setItem(SELECTED_TOPICS_KEY, JSON.stringify(topicsToSave)),
        AsyncStorage.setItem(scopedKey, JSON.stringify(topicsToSave)),
      ]);

      try {
        await updateUserTopics(topicsToSave);
      } catch (err) {
        console.warn('[CommunityOnboarding] updateUserTopics:', err);
      }
      try {
        await updateSectionState('community', { onboardingComplete: true, topicSelected: true });
      } catch (err) {
        console.warn('[CommunityOnboarding] updateSectionState:', err);
      }
      try {
        const { refreshTopics } = require('../../context/CommunityContext');
        await refreshTopics();
      } catch (err) {
        console.warn('[CommunityOnboarding] refreshTopics:', err);
      }
    },
    [currentUser?.id, updateUserTopics],
  );

  const handleComplete = useCallback(async () => {
    if (!currentUser?.id) {
      sweetAlert.alert('Not Signed In', 'Please sign in to save your topics.', 'warning');
      return;
    }
    if (selectedTopics.length < MIN_TOPICS) {
      sweetAlert.alert(
        'Select More Topics',
        `Please select at least ${MIN_TOPICS} topics to personalize your feed. You've selected ${selectedTopics.length}.`,
        'info',
      );
      return;
    }
    setIsSaving(true);
    try {
      await persist(selectedTopics);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sweetAlert.toast('Topics Selected', `${selectedTopics.length} topics selected!`);

      if (isEditing) {
        if (navigation?.canGoBack?.()) navigation.goBack();
        return;
      }
      const done = onComplete ?? route?.params?.onComplete;
      if (typeof done === 'function') {
        await done(selectedTopics);
      } else {
        console.warn('[CommunityOnboarding] No onComplete handler — falling back to navigator reset');
        navigation?.reset?.({ index: 0, routes: [{ name: 'CommunityMain' as never }] });
      }
    } catch (err) {
      console.error('[CommunityOnboarding] complete error:', err);
      sweetAlert.alert('Error', 'Failed to save your preferences. Please try again.', 'warning');
    } finally {
      setIsSaving(false);
    }
  }, [selectedTopics, isEditing, navigation, onComplete, persist, sweetAlert]);

  const handleSkip = useCallback(() => {
    if (isEditing) return;
    if (!currentUser?.id) {
      sweetAlert.alert('Not Signed In', 'Please sign in to save your topics.', 'warning');
      return;
    }

    // Auto-pick 2 topics from the first categories, then top up.
    const prefilled = categoriesWithTopics
      .flatMap((cat) => cat.topics.slice(0, 2))
      .slice(0, MIN_TOPICS)
      .map((t) => t.id);

    let topicsToSave = [...prefilled];
    if (topicsToSave.length < MIN_TOPICS) {
      const all = categoriesWithTopics.flatMap((cat) => cat.topics);
      const remaining = all.filter((t) => !topicsToSave.includes(t.id));
      const needed = MIN_TOPICS - topicsToSave.length;
      topicsToSave = [...topicsToSave, ...remaining.slice(0, needed).map((t) => t.id)];
    }

    sweetAlert.confirm(
      'Auto-select Topics?',
      `We'll pick ${topicsToSave.length} recommended topics to get you started. You can always change these later.`,
      async () => {
        setIsSaving(true);
        try {
          await persist(topicsToSave, { autoSelected: true });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          sweetAlert.toast('Topics Selected', `${topicsToSave.length} topics auto-selected.`);

          const done = onComplete ?? route?.params?.onComplete;
          if (typeof done === 'function') {
            await done(topicsToSave);
          } else {
            navigation?.reset?.({ index: 0, routes: [{ name: 'CommunityMain' as never }] });
          }
        } catch (err) {
          console.error('[CommunityOnboarding] skip error:', err);
          sweetAlert.alert('Error', 'Failed to complete onboarding. Please try again.', 'warning');
        } finally {
          setIsSaving(false);
        }
      },
      () => {},
      'Auto-select',
      'Choose Manually',
    );
  }, [isEditing, categoriesWithTopics, onComplete, persist, sweetAlert]);

  /* ── Render row ─────────────────────────────────────────── */
  const renderCategory = useCallback(
    ({ item, index }: { item: CategoryWithTopics; index: number }) => {
      const isExpanded = expandedCategories.has(item.id);
      const selectedInCategory = item.topics.filter((t) => selectedTopics.includes(t.id));

      return (
        <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 50).duration(320)}>
          <View
            style={[
              s.categoryContainer,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : DS.white,
                borderColor: isDark ? DS.darkBorder : DS.lightBorder,
              },
            ]}
          >
            <CategoryHeader
              category={item}
              selectedCount={selectedInCategory.length}
              totalCount={item.topics.length}
              isExpanded={isExpanded}
              onPress={() => toggleCategory(item.id)}
              isDark={isDark}
            />

            {isExpanded && (
              <View style={s.categoryTopicsContainer}>
                {item.topics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    isSelected={selectedTopics.includes(topic.id)}
                    onPress={() => toggleTopic(topic.id)}
                    isDark={isDark}
                  />
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      );
    },
    [selectedTopics, expandedCategories, toggleCategory, toggleTopic, isDark],
  );

  /* ── Loading state ──────────────────────────────────────── */
  if (isLoading) {
    return (
      <View style={[s.container, s.centered, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)', 'transparent']
              : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
          }
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={DS.primary} />
        <Text style={[s.loadingText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          Loading topics...
        </Text>
      </View>
    );
  }

  /* ── Main render ────────────────────────────────────────── */
  return (
    <View style={[s.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Aura bg */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)', 'transparent']
            : ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      {/* Header */}
      <View
        style={[
          s.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder,
          },
        ]}
      >
        <View style={s.headerContent}>
          {isEditing && navigation?.canGoBack?.() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                s.backButton,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray900} />
            </TouchableOpacity>
          ) : (
            <View style={s.backButtonPlaceholder} />
          )}
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: isDark ? DS.white : DS.gray900 }]}>
              {isEditing ? 'Edit Topics' : 'Choose Your Topics'}
            </Text>
            <Text style={[s.headerSubtitle, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {displayCount} selected {displayCount < MIN_TOPICS ? `· min ${MIN_TOPICS}` : ''}
            </Text>
          </View>
          <View style={s.backButtonPlaceholder} />
        </View>

        {/* Progress */}
        <View style={s.progressContainer}>
          <View
            style={[
              s.progressBar,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray200 },
            ]}
          >
            <Animated.View style={[s.progressFill, progressStyle]}>
              <LinearGradient
                colors={hasMinimum ? [DS.success, '#34d399'] : [DS.primary, DS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <Text
            style={[
              s.progressLabel,
              {
                color: hasMinimum
                  ? DS.success
                  : isDark
                  ? DS.gray400
                  : DS.gray500,
              },
            ]}
          >
            {hasMinimum ? '✓ Minimum reached' : `${MIN_TOPICS - displayCount} more needed`}
          </Text>
        </View>
      </View>

      {/* Categories list */}
      <FlatList
        ref={flatListRef}
        data={categoriesWithTopics}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          s.listContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="albums-outline" size={40} color={isDark ? DS.gray600 : DS.gray300} />
            <Text style={{ marginTop: 12, color: isDark ? DS.gray400 : DS.gray500, fontWeight: '600' }}>
              No topics available
            </Text>
          </View>
        }
      />

      {/* Bottom bar */}
      <View
        style={[
          s.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 16),
            backgroundColor: isDark ? 'rgba(12,10,9,0.95)' : 'rgba(255,255,255,0.95)',
            borderTopColor: isDark ? DS.darkBorder : DS.lightBorder,
          },
        ]}
      >
        <View style={s.bottomBarContent}>
          {!isEditing && displayCount === 0 && (
            <TouchableOpacity onPress={handleSkip} style={s.skipButton} disabled={isSaving}>
              <Text style={[s.skipText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                Auto-select
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.continueButton, (!hasMinimum || isSaving) && s.continueButtonDisabled]}
            onPress={handleComplete}
            disabled={isSaving || !hasMinimum}
            activeOpacity={0.85}
          >
            {hasMinimum ? (
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.continueGradient}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={DS.white} />
                ) : (
                  <View style={s.continueContent}>
                    <Text style={s.continueText}>
                      {isEditing ? `Save (${displayCount})` : `Continue (${displayCount})`}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={DS.white} />
                  </View>
                )}
              </LinearGradient>
            ) : (
              <View
                style={[
                  s.continueGradient,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100,
                  },
                ]}
              >
                <Text
                  style={[
                    s.continueText,
                    { color: isDark ? DS.gray500 : DS.gray500 },
                  ]}
                >
                  Select {MIN_TOPICS - displayCount} more
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, fontWeight: '600', marginTop: 12 },

  /* Header */
  header: {
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.sm,
    paddingBottom: DS.space.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: { width: 40 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: DS.space.sm },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  progressContainer: {
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'right',
  },

  /* List */
  listContent: {
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.md,
  },

  /* Category */
  categoryContainer: {
    marginBottom: DS.space.md,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  categoryHeader: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  categoryHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: { fontSize: 20 },
  categoryHeaderInfo: { flex: 1 },
  categoryName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  categorySubtext: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categorySelectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  categorySelectedText: { fontSize: 11, fontWeight: '800', color: DS.white },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Topic cards */
  categoryTopicsContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    flex: 1,
    minWidth: (SCREEN_W - 76) / 2,
    maxWidth: (SCREEN_W - 76) / 2,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1.5,
    minHeight: 50,
    overflow: 'hidden',
  },
  topicCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicEmojiWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicEmoji: { fontSize: 16 },
  topicName: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
  },
  topicCheckmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    gap: 12,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  skipText: { fontSize: 14, fontWeight: '700' },
  continueButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    ...DS.shadow.sm,
  },
  continueButtonDisabled: { opacity: 0.7 },
  continueGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueText: {
    fontSize: 15,
    fontWeight: '800',
    color: DS.white,
  },
});