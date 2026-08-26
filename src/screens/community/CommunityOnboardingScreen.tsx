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
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { updateSectionState } from '../../hooks/useIntelligentSplash';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@littleloom_community_onboarding_v3';
const MIN_TOPICS = 5;

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
          borderColor: isSelected ? topic.color : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
          backgroundColor: isSelected ? `${topic.color}12` : 'transparent',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.topicCardContent}>
        <View style={[styles.topicEmojiWrap, { 
          backgroundColor: isSelected ? `${topic.color}20` : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
        }]}>
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
            <Ionicons name="checkmark" size={10} color="#fff" />
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

        const validTopics = topics.filter(id => INITIAL_TOPICS.some(t => t.id === id));
        setSelectedTopics(validTopics);

        const expanded = new Set<string>();
        if (validTopics.length > 0) {
          validTopics.forEach(topicId => {
            const topic = INITIAL_TOPICS.find(t => t.id === topicId);
            if (topic && (topic as any).category) {
              expanded.add((topic as any).category);
            }
          });
        } else {
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

  const getCategoriesWithTopics = useCallback((topics: Topic[]): CategoryWithTopics[] => {
    const grouped = new Map<string, CategoryWithTopics>();

    TOPIC_CATEGORIES.forEach(cat => {
      grouped.set(cat.id, {
        ...cat,
        topics: [],
        expanded: expandedCategories.has(cat.id) || false,
      });
    });

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
        // No maximum limit - allow selecting as many as they want
        return [...prev, topicId];
      }
    });
  }, []);

const handleComplete = useCallback(async () => {
  // Check minimum 5 topics
  if (selectedTopics.length < MIN_TOPICS) {
    sweetAlert.alert(
      'Select More Topics', 
      `Please select at least ${MIN_TOPICS} topics to personalize your feed. You've selected ${selectedTopics.length}.`,
      'info'
    );
    return;
  }

  setIsSaving(true);
  try {
    const data = {
      completed: true,
      selectedTopics,
      timestamp: new Date().toISOString(),
    };

    // Save to AsyncStorage
    await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
    await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(selectedTopics));
    
    // Also save user-specific topics
    if (currentUser?.id) {
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.SELECTED_TOPICS}_${currentUser.id}`,
        JSON.stringify(selectedTopics)
      );
    }

    // Update UserContext
    try {
      await updateUserTopics(selectedTopics);
    } catch (e) {
      console.warn('[CommunityOnboarding] Failed to update user topics:', e);
    }
    
    // Update section state
    try {
      await updateSectionState('community', { onboardingComplete: true, topicSelected: true });
    } catch (e) {
      console.warn('[CommunityOnboarding] Failed to update section state:', e);
    }

    // Force refresh topics in context
    try {
      const { refreshTopics } = require('../../context/CommunityContext');
      await refreshTopics();
    } catch (e) {
      console.warn('[CommunityOnboarding] Failed to refresh topics:', e);
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
}, [selectedTopics, isEditing, navigation, onComplete, updateUserTopics, sweetAlert, currentUser]);
  const handleSkip = useCallback(async () => {
    if (isEditing) return;

    // Auto-select 3 topics (minimum 5, so we'll auto-select 5)
    const autoSelectTopics = categoriesWithTopics
      .flatMap(cat => cat.topics.slice(0, 2))
      .slice(0, 5)
      .map(t => t.id);

    // Ensure we have at least MIN_TOPICS
    let topicsToSave = [...autoSelectTopics];
    if (topicsToSave.length < MIN_TOPICS) {
      // Add more topics from the first category
      const allTopics = categoriesWithTopics.flatMap(cat => cat.topics);
      const remaining = allTopics.filter(t => !topicsToSave.includes(t.id));
      const needed = MIN_TOPICS - topicsToSave.length;
      topicsToSave = [...topicsToSave, ...remaining.slice(0, needed).map(t => t.id)];
    }

    sweetAlert.confirm(
      'Skip Topic Selection?',
      `We'll auto-select ${topicsToSave.length} recommended topics for you. You can always change these later.`,
      async () => {
        setIsSaving(true);
        try {
          const data = {
            completed: true,
            selectedTopics: topicsToSave,
            timestamp: new Date().toISOString(),
            skipped: false,
            autoSelected: true,
          };

          await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
          await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(topicsToSave));
          await updateUserTopics(topicsToSave);
          await updateSectionState('community', { onboardingComplete: true, topicSelected: true });

          sweetAlert.toast('Topics Selected', `${topicsToSave.length} topics were auto-selected for you.`);

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
      'Auto-select',
      'Choose Manually',
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

  const hasMinimum = selectedTopics.length >= MIN_TOPICS;
  const displayCount = selectedTopics.length;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#f5f5f5' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <SafeAreaView style={[styles.header, { 
        backgroundColor: isDark ? 'rgba(12,10,9,0.95)' : 'rgba(255,255,255,0.95)',
        borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      }]}>
        <View style={styles.headerContent}>
          {isEditing ? (
            <TouchableOpacity onPress={() => navigation?.goBack?.()} style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
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
              {displayCount} selected {displayCount < MIN_TOPICS ? `(min ${MIN_TOPICS})` : ''}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }]}>
            <View style={[
              styles.progressFill, 
              { 
                width: `${Math.min((displayCount / MIN_TOPICS) * 100, 100)}%`,
                backgroundColor: hasMinimum ? '#10b981' : '#6366f1',
              }
            ]} />
          </View>
          <Text style={[styles.progressLabel, { 
            color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            color: hasMinimum ? '#10b981' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'),
          }]}>
            {hasMinimum ? '✓ Minimum reached' : `${MIN_TOPICS - displayCount} more needed`}
          </Text>
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
        borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      }]}>
        <View style={styles.bottomBarContent}>
          {!isEditing && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
                Auto-select
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.continueButton, 
              !hasMinimum && styles.continueButtonDisabled,
              { backgroundColor: hasMinimum ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }
            ]}
            onPress={handleComplete}
            disabled={isSaving || !hasMinimum}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.continueContent}>
                <Text style={[styles.continueText, { 
                  color: hasMinimum ? '#fff' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)') 
                }]}>
                  {hasMinimum ? `Continue (${displayCount})` : `Select ${MIN_TOPICS - displayCount} more`}
                </Text>
                {hasMinimum && (
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
  progressContainer: { 
    paddingHorizontal: 16, 
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'right',
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
    backgroundColor: 'rgba(99,102,241,0.06)',
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
    minHeight: 48,
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
    width: 18,
    height: 18,
    borderRadius: 9,
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