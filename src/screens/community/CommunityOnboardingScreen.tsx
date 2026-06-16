import React, { useEffect, useState, useCallback } from 'react';

import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { updateSectionState } from '../../hooks/useIntelligentSplash';
import { useAutoHideNav } from '../../hooks/useAutoHideNav';
import { useCommunity } from '../../context/CommunityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { showAlert } from '@/utils/alert';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@littleloom_community_onboarding_v3';

interface CommunityOnboardingScreenProps {
  navigation?: any;
  route?: any;
  onComplete?: () => void;
}

interface TopicRecommendation {
  topicId: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

const FALLBACK_TOPICS = [
  { id: 'topic_6', name: 'Parenting Hacks', emoji: '💡', description: 'Clever solutions for everyday challenges', color: '#6a82fb' },
  { id: 'topic_2', name: 'Sleep Tips', emoji: '😴', description: 'Better sleep for babies and parents', color: '#11998e' },
  { id: 'topic_5', name: 'Health & Wellness', emoji: '💊', description: 'Keeping your little ones healthy', color: '#fc5c7d' },
  { id: 'topic_3', name: 'Feeding & Nutrition', emoji: '🍼', description: 'From breastfeeding to first foods', color: '#fa709a' },
  { id: 'topic_9', name: 'Toddler Tantrums', emoji: '😤', description: 'Navigating the terrible twos and beyond', color: '#fa709a' },
  { id: 'topic_1', name: 'Potty Training', emoji: '🚽', description: 'Tips, tricks, and support for potty training success', color: '#667eea' },
  { id: 'topic_4', name: 'Milestones', emoji: '🏆', description: 'Celebrate every achievement', color: '#fee140' },
  { id: 'topic_8', name: 'Work-Life Balance', emoji: '⚖️', description: 'Juggling career and parenting', color: '#4facfe' },
  { id: 'topic_10', name: 'Education', emoji: '📚', description: 'Early learning and school prep', color: '#43e97b' },
  { id: 'topic_7', name: 'Baby Names', emoji: '✨', description: 'Find the perfect name for your little one', color: '#f093fb' },
];

export default function CommunityOnboardingScreen({ navigation, route, onComplete }: CommunityOnboardingScreenProps) {
  const sweetAlert = useSweetAlert();
  useAutoHideNav({ isCommunityScreen: true });
  const insets = useSafeAreaInsets();

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [recommendedTopics, setRecommendedTopics] = useState<TopicRecommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSavedData, setHasSavedData] = useState(false);

  const communityCtx = useCommunity();
  const { updateSelectedTopics: updateCommunityTopics, INITIAL_TOPICS: ctxTopics } = communityCtx || {};
  const { updateSelectedTopics: updateUserTopics, profile } = useUser();
  const { settings, themeColors, triggerHaptic } = useCustomization();

  const INITIAL_TOPICS = ctxTopics && Array.isArray(ctxTopics) && ctxTopics.length > 0 
    ? ctxTopics 
    : FALLBACK_TOPICS;

  useEffect(() => {
    const generateRecommendations = async () => {
      const recommendations: TopicRecommendation[] = [];

      const hasBaby = profile?.babies && profile.babies.length > 0;
      const babyAge = profile?.babies?.[0]?.age;

      if (babyAge) {
        const ageMonths = parseInt(babyAge);
        if (ageMonths < 6) {
          recommendations.push({ topicId: 'topic_3', reason: 'Perfect for your newborn', confidence: 'high' });
          recommendations.push({ topicId: 'topic_2', reason: 'Essential early months', confidence: 'high' });
          recommendations.push({ topicId: 'topic_6', reason: 'Getting ready?', confidence: 'medium' });
        } else if (ageMonths < 12) {
          recommendations.push({ topicId: 'topic_3', reason: 'Time for solids!', confidence: 'high' });
          recommendations.push({ topicId: 'topic_4', reason: 'Track those firsts', confidence: 'high' });
        } else if (ageMonths < 24) {
          recommendations.push({ topicId: 'topic_9', reason: 'Toddler years ahead', confidence: 'high' });
          recommendations.push({ topicId: 'topic_1', reason: 'Potty training soon', confidence: 'medium' });
        } else {
          recommendations.push({ topicId: 'topic_9', reason: 'Active toddler days', confidence: 'high' });
          recommendations.push({ topicId: 'topic_10', reason: 'Early learning', confidence: 'medium' });
        }
      }

      recommendations.push({ topicId: 'topic_6', reason: 'Community favorite', confidence: 'high' });
      recommendations.push({ topicId: 'topic_8', reason: 'Popular among parents', confidence: 'medium' });
      recommendations.push({ topicId: 'topic_5', reason: 'Always relevant', confidence: 'high' });

      setRecommendedTopics(recommendations);
    };

    generateRecommendations();
  }, [profile]);

  useEffect(() => {
    const loadPreviousTopics = async () => {
      try {
        const [onboardingData, communityTopics, userTopicsData] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem('@community_selected_topics_v2'),
          AsyncStorage.getItem('@community_selected_topics'),
        ]);

        let topics: string[] = [];
        let savedCompleted = false;

        if (onboardingData) {
          const parsed = JSON.parse(onboardingData);
          if (parsed.selectedTopics?.length > 0) {
            topics = parsed.selectedTopics;
          }
          if (parsed.completed === true) {
            savedCompleted = true;
          }
        }

        if (topics.length === 0 && communityTopics) {
          topics = JSON.parse(communityTopics);
        }

        if (topics.length === 0 && userTopicsData) {
          topics = JSON.parse(userTopicsData);
        }

        if (topics.length > 0) {
          const validTopics = topics.filter(t => INITIAL_TOPICS.some(it => it.id === t));
          setSelectedTopics(validTopics.slice(0, 5));
          setHasSavedData(true);
        } else if (recommendedTopics.length > 0) {
          const autoSelected = recommendedTopics
            .filter(r => r.confidence === 'high')
            .slice(0, 3)
            .map(r => r.topicId);
          const validAutoSelected = autoSelected.filter(id => INITIAL_TOPICS.some(t => t.id === id));
          setSelectedTopics(validAutoSelected);
          setShowRecommendations(true);
        }
      } catch (error) {
        console.error('Error loading previous topics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreviousTopics();
  }, [recommendedTopics, INITIAL_TOPICS]);

  const toggleTopic = (topicId: string) => {
    if (settings.hapticFeedback) {
      triggerHaptic('light');
    }

    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        if (prev.length >= 5) {
          if (settings.hapticFeedback) {
            triggerHaptic('error');
          }
          sweetAlert.alert('Maximum Topics Reached', 'You can select up to 5 topics. Remove one to add another.', 'info');
          return prev;
        }
        return [...prev, topicId];
      }
    });
  };

  const handleComplete = async () => {
    if (selectedTopics.length === 0) {
      sweetAlert.alert('Select Topics', 'Please select at least 1 topic to personalize your feed.', 'info');
      return;
    }

    try {
      const data = { 
        completed: true, 
        selectedTopics,
        timestamp: new Date().toISOString(),
        recommendedUsed: showRecommendations,
      };

      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
      await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(selectedTopics));

      if (updateCommunityTopics) {
        await updateCommunityTopics(selectedTopics);
      }
      if (updateUserTopics) {
        await updateUserTopics(selectedTopics);
      }
      await updateSectionState('community', { onboardingComplete: true, topicSelected: true });

      if (settings.hapticFeedback) {
        triggerHaptic('success');
      }
      
      if (onComplete) {
        onComplete();
      }
      
      if (navigation && navigation.replace) {
        navigation.replace('CommunityMain');
      }
    } catch (error) {
      console.error('Error saving topics:', error);
      sweetAlert.alert('Error', 'Failed to save your preferences. Please try again.', 'warning');
    }
  };

  const handleSkip = async () => {

showAlert(
      'Skip Topic Selection?',
      'Selecting topics helps us show you relevant content. You can always change this later in your profile.',
      [
        { text: 'Select Topics', style: 'cancel' },
        { 
          text: 'Skip Anyway', 
          style: 'destructive',
          onPress: async () => {
            try {
              const data = { 
                completed: true, 
                selectedTopics: [],
                timestamp: new Date().toISOString(),
                skipped: true
              };
              await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
              await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify([]));
              if (updateCommunityTopics) await updateCommunityTopics([]);
              if (updateUserTopics) await updateUserTopics([]);
              await updateSectionState('community', { onboardingComplete: true, topicSelected: false });
              
              if (onComplete) {
                onComplete();
              }
              
              if (navigation && navigation.replace) {
                navigation.replace('CommunityMain');
              }
            } catch (error) {
              console.error('Error skipping onboarding:', error);
            }
          }
        },
      ]
    );
  };

  const isTopicRecommended = (topicId: string) => {
    return recommendedTopics.find(r => r.topicId === topicId);
  };

  const isDark = settings.darkMode;

  const bottomBarHeight = Platform.OS === 'ios' ? 34 : 20;
  const tabBarHeight = 68 + 14 + bottomBarHeight; // pill height + margin + safe area
  const extraPadding = 20; // extra space for comfort

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={CommunityGradients.header} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={CommunityGradients.header} style={StyleSheet.absoluteFill} />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + extraPadding + insets.bottom }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Welcome to Community</Text>
          <Text style={styles.subtitle}>
            Pick up to 5 topics you're interested in to personalize your feed
          </Text>

          <View style={styles.counterContainer}>
            <View style={[styles.counterBar, { width: `${(selectedTopics.length / 5) * 100}%` }]} />
            <Text style={styles.counter}>
              {selectedTopics.length}/5 selected
            </Text>
          </View>

          {showRecommendations && selectedTopics.length > 0 && (
            <Animated.View entering={FadeInDown} style={styles.recommendationBanner}>
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.recommendationText}>
                We pre-selected topics based on your profile
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        <View style={styles.topicsGrid}>
          {INITIAL_TOPICS.map((topic, index) => {
            const isSelected = selectedTopics.includes(topic.id);
            const recommendation = isTopicRecommended(topic.id);
            const isDisabled = selectedTopics.length >= 5 && !isSelected;

            return (
              <Animated.View 
                key={topic.id} 
                entering={FadeInUp.delay(index * 80)}
                style={styles.topicWrapper}
              >
                <TouchableOpacity
                  style={[
                    styles.topicCard,
                    isSelected && styles.topicCardSelected,
                    isDisabled && styles.topicCardDisabled,
                    isDark && styles.topicCardDark,
                  ]}
                  onPress={() => toggleTopic(topic.id)}
                  activeOpacity={0.8}
                  disabled={isDisabled}
                >
                  <LinearGradient
                    colors={isSelected 
                      ? [topic.color + '70', topic.color + '30']
                      : isDark 
                        ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']
                        : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']
                    }
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />

                  {recommendation && !isSelected && (
                    <View style={[styles.recommendationBadge, { backgroundColor: topic.color + '40' }]}>
                      <Ionicons name="star" size={10} color="#fff" />
                      <Text style={styles.recommendationBadgeText}>{recommendation.reason}</Text>
                    </View>
                  )}

                  <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                  <Text style={styles.topicName}>{topic.name}</Text>
                  <Text style={styles.topicDescription} numberOfLines={2}>
                    {topic.description}
                  </Text>

                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={28} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* FIX #3: Bottom spacer to ensure content is scrollable above the fixed bottom bar */}
        <View style={{ height: tabBarHeight + extraPadding }} />
      </ScrollView>

      {/* FIX #3: Fixed bottom bar with proper bottom padding to sit above navigation pill */}
      <View style={[
        styles.bottomBar, 
        isDark && styles.bottomBarDark,
        { paddingBottom: Math.max(insets.bottom, bottomBarHeight) + 10 + tabBarHeight }
      ]}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.continueButton,
            selectedTopics.length === 0 && styles.continueButtonDisabled
          ]}
          onPress={handleComplete}
          disabled={selectedTopics.length === 0}
        >
          <LinearGradient 
            colors={selectedTopics.length > 0 ? CommunityGradients.primary : ['#ccc', '#aaa']}
            style={styles.continueGradient}
          >
            <Text style={styles.continueText}>
              {selectedTopics.length > 0 
                ? `Continue (${selectedTopics.length})` 
                : 'Select at least 1 topic'
              }
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#000' },
  scrollContent: { paddingTop: 60, paddingBottom: 0, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 40 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: 20, lineHeight: 22, marginBottom: 16 },
  counterContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  counterBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  counter: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '700', zIndex: 1 },
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
    gap: 8,
  },
  recommendationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  topicWrapper: { width: (width - 64) / 2 },
  topicCard: {
    borderRadius: CommunityBorderRadius.xl,
    padding: 16,
    minHeight: 160,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    ...CommunityShadows.md,
  },
  topicCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topicCardSelected: {
    borderColor: '#fff',
    ...CommunityShadows.lg,
  },
  topicCardDisabled: {
    opacity: 0.5,
  },
  recommendationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    zIndex: 10,
  },
  recommendationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  topicEmoji: { fontSize: 40, marginBottom: 8 },
  topicName: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  topicDescription: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
  checkmark: { position: 'absolute', top: 12, right: 12 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingHorizontal: 24,
    paddingTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...CommunityShadows.lg,
  },
  bottomBarDark: {
    backgroundColor: 'rgba(20,20,20,0.98)',
  },
  skipButton: { alignItems: 'center', marginBottom: 16 },
  skipText: { fontSize: 15, color: CommunityColors.text.secondary, fontWeight: '600' },
  continueButton: { borderRadius: 16, overflow: 'hidden', ...CommunityShadows.md },
  continueButtonDisabled: { opacity: 0.6 },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
