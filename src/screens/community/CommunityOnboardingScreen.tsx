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
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCommunity, TOPIC_CATEGORIES, INITIAL_TOPICS, Topic } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
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

export default function CommunityOnboardingScreen({ navigation, route, onComplete }: any) {
  const isEditing = route?.params?.editing === true;
  const sweetAlert = useSweetAlert();
  const { settings, themeColors, triggerHaptic } = useCustomization();
  const { updateSelectedTopics: updateCommunityTopics, INITIAL_TOPICS: ctxTopics, getSelectedTopics } = useCommunity();
  const { updateSelectedTopics: updateUserTopics, profile } = useUser();

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Use topics from context or fallback
  const allTopics = useMemo(() => {
    return ctxTopics && Array.isArray(ctxTopics) && ctxTopics.length > 0
      ? ctxTopics
      : INITIAL_TOPICS;
  }, [ctxTopics]);

  // Group topics by category
  const categoriesWithTopics = useMemo((): CategoryWithTopics[] => {
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
    allTopics.forEach(topic => {
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
  }, [allTopics, expandedCategories]);

  // Load saved topics
  useEffect(() => {
    const loadTopics = async () => {
      try {
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

        // Also check context for selected topics
        if (topics.length === 0) {
          const contextTopics = getSelectedTopics();
          if (contextTopics.length > 0) {
            topics = contextTopics;
          }
        }

        // Validate topics exist
        const validTopics = topics.filter(id => allTopics.some(t => t.id === id));
        setSelectedTopics(validTopics.slice(0, 5));

        // Auto-expand categories with selected topics
        const expanded = new Set<string>();
        validTopics.forEach(topicId => {
          const topic = allTopics.find(t => t.id === topicId);
          if (topic && (topic as any).category) {
            expanded.add((topic as any).category);
          }
        });
        
        // If no topics selected, expand first category
        if (validTopics.length === 0 && categoriesWithTopics.length > 0) {
          expanded.add(categoriesWithTopics[0].id);
        }
        
        setExpandedCategories(expanded);
      } catch (error) {
        console.error('Error loading topics:', error);
        // Expand first category on error
        if (categoriesWithTopics.length > 0) {
          setExpandedCategories(new Set([categoriesWithTopics[0].id]));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTopics();
  }, [allTopics, categoriesWithTopics, getSelectedTopics]);

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
    triggerHaptic('light');
  }, [triggerHaptic]);

  const toggleTopic = useCallback((topicId: string) => {
    triggerHaptic('light');

    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        if (prev.length >= 5) {
          triggerHaptic('error');
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
  }, [triggerHaptic, sweetAlert]);

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

      // Update contexts
      await updateCommunityTopics(selectedTopics);
      await updateUserTopics(selectedTopics);
      await updateSectionState('community', { onboardingComplete: true, topicSelected: true });

      triggerHaptic('success');
      sweetAlert.toast('Topics Selected', `${selectedTopics.length} topics selected!`, 'success');

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
  }, [selectedTopics, isEditing, navigation, onComplete, updateCommunityTopics, updateUserTopics, triggerHaptic, sweetAlert]);

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
            await updateCommunityTopics(topicsToSave);
            await updateUserTopics(topicsToSave);
            sweetAlert.toast('Topics Selected', `${topicsToSave.length} topics were auto-selected for you.`, 'info');
          }
          
          await updateSectionState('community', { onboardingComplete: true, topicSelected: topicsToSave.length > 0 });

          if (onComplete) {
            onComplete();
          }
        } catch (error) {
          console.error('Error skipping onboarding:', error);
          sweetAlert.alert('Error', 'Failed to complete onboarding. Please try again.', 'warning');
        }
      },
      undefined,
      autoSelectTopics.length > 0 ? 'Auto-select' : 'Skip Anyway',
      'Choose Topics',
      true
    );
  }, [isEditing, onComplete, categoriesWithTopics, updateCommunityTopics, updateUserTopics, sweetAlert]);

  const renderCategory = useCallback(({ item, index }: { item: CategoryWithTopics; index: number }) => {
    const isExpanded = expandedCategories.has(item.id);
    const selectedInCategory = item.topics.filter(t => selectedTopics.includes(t.id));
    const totalInCategory = item.topics.length;

    return (
      <View style={styles.categoryContainer}>
        {/* Category Header */}
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(item.id)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.categoryHeaderContent}>
            <View style={styles.categoryIconWrap}>
              <Text style={styles.categoryEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.categoryHeaderInfo}>
              <Text style={styles.categoryName}>{item.name}</Text>
              <Text style={styles.categorySubtext}>
                {selectedInCategory.length} selected • {totalInCategory} topics
              </Text>
            </View>
            <View style={styles.categoryHeaderRight}>
              {selectedInCategory.length > 0 && (
                <View style={styles.categorySelectedBadge}>
                  <Text style={styles.categorySelectedText}>{selectedInCategory.length}</Text>
                </View>
              )}
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="rgba(255,255,255,0.6)"
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Category Topics - Expanded */}
        {isExpanded && (
          <View style={styles.categoryTopicsContainer}>
            {item.topics.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id);
              return (
                <TouchableOpacity
                  key={topic.id}
                  style={[
                    styles.topicCard,
                    isSelected && styles.topicCardSelected,
                    { borderColor: isSelected ? topic.color : 'rgba(255,255,255,0.08)' },
                  ]}
                  onPress={() => toggleTopic(topic.id)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={isSelected
                      ? [topic.color + '40', topic.color + '20']
                      : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']
                    }
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.topicCardContent}>
                    <View style={styles.topicEmojiWrap}>
                      <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                    </View>
                    <Text style={[styles.topicName, isSelected && { color: topic.color }]}>
                      {topic.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.topicCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color={topic.color} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  }, [selectedTopics, expandedCategories, toggleCategory, toggleTopic]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient colors={['#0f0f1e', '#1a1a2e', '#2d1b4e']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading topics...</Text>
      </View>
    );
  }

  const hasSelection = selectedTopics.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#0f0f1e', '#1a1a2e', '#2d1b4e']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          {isEditing ? (
            <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isEditing ? 'Edit Topics' : 'Choose Your Topics'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {selectedTopics.length} of 5 selected
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      />

      {/* Bottom Bar */}
      <SafeAreaView style={styles.bottomBar}>
        <View style={styles.bottomBarContent}>
          {!isEditing && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.continueButton, !hasSelection && styles.continueButtonDisabled]}
            onPress={handleComplete}
            disabled={isSaving || !hasSelection}
          >
            <LinearGradient
              colors={hasSelection ? ['#6366f1', '#8b5cf6'] : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.continueText}>
                    {hasSelection ? `Continue (${selectedTopics.length})` : 'Select 1+ topics'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </LinearGradient>
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
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backButtonPlaceholder: {
    width: 40,
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerRight: { width: 40 },
  progressContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#6366f1',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  categoryContainer: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: { fontSize: 22 },
  categoryHeaderInfo: { flex: 1 },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  categorySubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categorySelectedBadge: {
    backgroundColor: '#6366f1',
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
    overflow: 'hidden',
    minHeight: 56,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicEmoji: { fontSize: 16 },
  topicName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  topicCheckmark: {
    marginLeft: 'auto',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,15,30,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
    color: 'rgba(255,255,255,0.5)',
  },
  continueButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});