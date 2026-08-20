// src/screens/community/CommunityOnboardingScreen.tsx
import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  FlatList,
  SafeAreaView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { TOPIC_CATEGORIES, INITIAL_TOPICS, type Topic } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';  // <-- ADD THIS LINE
import { useSweetAlert } from '../../components/SweetAlert';
import { updateSectionState } from '../../hooks/useIntelligentSplash';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@littleloom_community_onboarding_v3';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  expanded: boolean;
}

// ─── Topic Card Component ───
const TopicCard = React.memo(({ 
  topic, 
  isSelected, 
  onPress, 
  isDark = false 
}: { 
  topic: CategoryTopic; 
  isSelected: boolean; 
  onPress: () => void; 
  isDark?: boolean;
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.topicCard,
        isSelected && styles.topicCardSelected,
        { 
          borderColor: isSelected ? topic.color : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
          backgroundColor: isSelected ? `${topic.color}15` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.topicCardContent}>
        <View style={[styles.topicEmojiWrap, { backgroundColor: isSelected ? `${topic.color}25` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
          <Text style={styles.topicEmoji}>{topic.emoji}</Text>
        </View>
        <Text style={[
          styles.topicName, 
          isSelected && { color: topic.color, fontWeight: '700' },
          { color: isDark ? '#e5e7eb' : '#1a1a2e' }
        ]}>
          {topic.name}
        </Text>
        {isSelected && (
          <View style={[styles.topicCheckmark, { backgroundColor: topic.color }]}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ─── Category Header Component ───
const CategoryHeader = React.memo(({ 
  category, 
  selectedCount, 
  totalCount, 
  isExpanded, 
  onPress,
  isDark = false 
}: { 
  category: CategoryWithTopics; 
  selectedCount: number; 
  totalCount: number; 
  isExpanded: boolean; 
  onPress: () => void;
  isDark?: boolean;
}) => {
  return (
    <TouchableOpacity
      style={[styles.categoryHeader, { 
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.categoryHeaderContent}>
        <View style={styles.categoryIconWrap}>
          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
        </View>
        <View style={styles.categoryHeaderInfo}>
          <Text style={[styles.categoryName, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            {category.name}
          </Text>
          <Text style={[styles.categorySubtext, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
            {selectedCount} selected • {totalCount} topics
          </Text>
        </View>
        <View style={styles.categoryHeaderRight}>
          {selectedCount > 0 && (
            <View style={[styles.categorySelectedBadge, { backgroundColor: '#6366f1' }]}>
              <Text style={styles.categorySelectedText}>{selectedCount}</Text>
            </View>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function CommunityOnboardingScreen({ navigation, route, onComplete }: any) {
  const isEditing = route?.params?.editing === true;
  const sweetAlert = useSweetAlert();
  const { settings, triggerHaptic } = useCustomization();
  const { updateSelectedTopics: updateUserTopics } = useUser();
  
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allTopics, setAllTopics] = useState<Topic[]>(INITIAL_TOPICS);
  const [isDark, setIsDark] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Load theme and topics
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load dark mode setting
        const darkMode = settings?.darkMode ?? false;
        setIsDark(darkMode);

        // Load saved topics
        const [onboardingData, selectedData] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem('@community_selected_topics_v2'),
        ]);

        let topics: string[] = [];

        if (onboardingData) {
          const parsed = JSON.parse(onboardingData);
          if (parsed.selectedTopics?.length > 0) {
            topics = parsed.selectedTopics;
          }
        }

        if (topics.length === 0 && selectedData) {
          topics = JSON.parse(selectedData);
        }

        // Validate topics exist
        const validTopics = topics.filter(id => INITIAL_TOPICS.some(t => t.id === id));
        setSelectedTopics(validTopics.slice(0, 5));

        // Auto-expand categories with selected topics or first category
        const expanded = new Set<string>();
        if (validTopics.length > 0) {
          validTopics.forEach(topicId => {
            const topic = INITIAL_TOPICS.find(t => t.id === topicId);
            if (topic && (topic as any).category) {
              expanded.add((topic as any).category);
            }
          });
        } else {
          // Expand first category by default
          const categories = getCategoriesWithTopics(INITIAL_TOPICS);
          if (categories.length > 0) {
            expanded.add(categories[0].id);
          }
        }
        setExpandedCategories(expanded);
      } catch (error) {
        console.error('Error loading topics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Group topics by category
  const getCategoriesWithTopics = useCallback((topics: Topic[]): CategoryWithTopics[] => {
    const grouped = new Map<string, CategoryWithTopics>();

    // Initialize categories
    TOPIC_CATEGORIES.forEach(cat => {
      grouped.set(cat.id, {
        ...cat,
        topics: [],
        expanded: expandedCategories.has(cat.id) || false,
      });
    });

    // Group topics
    topics.forEach(topic => {
      const catId = (topic as any).category || 'community';
      const category = grouped.get(catId);
      if (category) {
        category.topics.push({
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
      .filter(cat => cat.topics.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [expandedCategories]);

  const categoriesWithTopics = useMemo(() => {
    return getCategoriesWithTopics(allTopics);
  }, [allTopics, getCategoriesWithTopics]);

  const toggleCategory = useCallback((categoryId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleTopic = useCallback((topicId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        if (prev.length >= 5) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          sweetAlert.alert(
            'Maximum Topics Reached',
            'You can select up to 5 topics. Remove one to add another.',
            'info'
          );
          return prev;
        }
        return [...prev, topicId];
      }
    });
  }, [sweetAlert]);

  const handleComplete = useCallback(async () => {
    if (selectedTopics.length === 0) {
      sweetAlert.alert('Select Topics', 'Please select at least 1 topic to personalize your feed.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        completed: true,
        selectedTopics,
        timestamp: new Date().toISOString(),
      };

      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
      await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(selectedTopics));

      // Update user topics
      try {
        await updateUserTopics(selectedTopics);
      } catch (e) {
        console.warn('[CommunityOnboarding] Failed to update user topics:', e);
      }
      
      try {
        await updateSectionState('community', { onboardingComplete: true, topicSelected: true });
      } catch (e) {
        console.warn('[CommunityOnboarding] Failed to update section state:', e);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sweetAlert.toast('Topics Selected', `${selectedTopics.length} topics selected!`);

      if (isEditing) {
        navigation?.goBack?.();
        return;
      }

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error saving topics:', error);
      sweetAlert.alert('Error', 'Failed to save your preferences. Please try again.', 'warning');
    } finally {
      setIsSaving(false);
    }
  }, [selectedTopics, isEditing, navigation, onComplete, updateUserTopics, sweetAlert]);

  const handleSkip = useCallback(async () => {
    if (isEditing) return;

    // Auto-select some popular topics
    const autoSelectTopics = categoriesWithTopics
      .flatMap(cat => cat.topics.slice(0, 2))
      .slice(0, 3)
      .map(t => t.id);

    sweetAlert.confirm(
      'Skip Topic Selection?',
      autoSelectTopics.length > 0 
        ? `We recommend selecting at least 1 topic. Would you like us to auto-select ${autoSelectTopics.length} recommended topics for you? You can always change these later.`
        : 'Selecting topics helps us show you relevant content. You can always change this later in your profile.',
      async () => {
        setIsSaving(true);
        try {
          const topicsToSave = autoSelectTopics.length > 0 ? autoSelectTopics : [];
          
          const data = {
            completed: true,
            selectedTopics: topicsToSave,
            timestamp: new Date().toISOString(),
            skipped: topicsToSave.length === 0,
            autoSelected: topicsToSave.length > 0,
          };

          await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
          
          if (topicsToSave.length > 0) {
            await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(topicsToSave));
            await updateUserTopics(topicsToSave);
            sweetAlert.toast('Topics Selected', `${topicsToSave.length} topics were auto-selected for you.`);
          }
          
          await updateSectionState('community', { onboardingComplete: true, topicSelected: topicsToSave.length > 0 });

          if (onComplete) {
            onComplete();
          }
        } catch (error) {
          console.error('Error skipping onboarding:', error);
          sweetAlert.alert('Error', 'Failed to complete onboarding. Please try again.', 'warning');
        } finally {
          setIsSaving(false);
        }
      },
      undefined,
      autoSelectTopics.length > 0 ? 'Auto-select' : 'Skip Anyway',
      'Choose Topics',
      true
    );
  }, [isEditing, onComplete, categoriesWithTopics, updateUserTopics, sweetAlert]);

  const renderCategory = useCallback(({ item }: { item: CategoryWithTopics }) => {
    const isExpanded = expandedCategories.has(item.id);
    const selectedInCategory = item.topics.filter(t => selectedTopics.includes(t.id));
    const totalInCategory = item.topics.length;

    return (
      <View style={[styles.categoryContainer, { 
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }]}>
        <CategoryHeader
          category={item}
          selectedCount={selectedInCategory.length}
          totalCount={totalInCategory}
          isExpanded={isExpanded}
          onPress={() => toggleCategory(item.id)}
          isDark={isDark}
        />

        {isExpanded && (
          <View style={styles.categoryTopicsContainer}>
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
    );
  }, [selectedTopics, expandedCategories, toggleCategory, toggleTopic, isDark]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0c0a09' : '#f5f5f5' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={[styles.loadingText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
          Loading topics...
        </Text>
      </View>
    );
  }

  const hasSelection = selectedTopics.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#f5f5f5' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <SafeAreaView style={[styles.header, { backgroundColor: isDark ? 'rgba(12,10,9,0.95)' : 'rgba(255,255,255,0.95)' }]}>
        <View style={styles.headerContent}>
          {isEditing ? (
            <TouchableOpacity onPress={() => navigation?.goBack?.()} style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a2e'} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
              {isEditing ? 'Edit Topics' : 'Choose Your Topics'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
              {selectedTopics.length} of 5 selected
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
            <View style={[styles.progressFill, { width: `${(selectedTopics.length / 5) * 100}%` }]} />
          </View>
        </View>
      </SafeAreaView>

      {/* Topics List */}
      <FlatList
        ref={flatListRef}
        data={categoriesWithTopics}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* Bottom Bar */}
      <SafeAreaView style={[styles.bottomBar, { 
        backgroundColor: isDark ? 'rgba(12,10,9,0.95)' : 'rgba(255,255,255,0.95)',
        borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }]}>
        <View style={styles.bottomBarContent}>
          {!isEditing && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                Skip
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.continueButton, 
              !hasSelection && styles.continueButtonDisabled,
              { backgroundColor: hasSelection ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') }
            ]}
            onPress={handleComplete}
            disabled={isSaving || !hasSelection}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.continueContent}>
                <Text style={[styles.continueText, { color: hasSelection ? '#fff' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') }]}>
                  {hasSelection ? `Continue (${selectedTopics.length})` : 'Select 1+ topics'}
                </Text>
                {hasSelection && (
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  headerRight: { width: 40 },
  progressContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#6366f1',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },

  // Category
  categoryContainer: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  categoryHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    backgroundColor: 'rgba(99,102,241,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: { fontSize: 22 },
  categoryHeaderInfo: { flex: 1 },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
  },
  categorySubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categorySelectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  categorySelectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Topics
  categoryTopicsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicCard: {
    flex: 1,
    minWidth: (width - 64) / 2 - 4,
    maxWidth: (width - 64) / 2 - 4,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    minHeight: 52,
  },
  topicCardSelected: {
    borderWidth: 2,
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
    fontSize: 13,
    fontWeight: '600',
  },
  topicCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
  },
});