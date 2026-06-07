// src/screens/community/CommunityOnboardingScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCustomization } from '../../hooks/useCustomization';
import { useCommunity } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { updateSectionState } from '../../hooks/useIntelligentSplash';
import { CommunityColors, CommunityGradients, CommunityBorderRadius, CommunityShadows } from '../../theme/CommunityTheme';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@littleloom_community_onboarding_v3';

interface CommunityOnboardingScreenProps {
  onComplete: () => void;
}

interface TopicRecommendation {
  topicId: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

// ─── FALLBACK TOPICS (defensive) ───
const FALLBACK_TOPICS = [
  { id: 'topic_1', name: 'Getting Pregnant', emoji: '🤰', description: 'Fertility, conception & planning', color: '#fa709a' },
  { id: 'topic_2', name: 'Pregnancy', emoji: '🤱', description: 'Prenatal care & wellness', color: '#667eea' },
  { id: 'topic_3', name: 'Newborn Care', emoji: '👶', description: 'First months essentials', color: '#11998e' },
  { id: 'topic_4', name: 'Baby Milestones', emoji: '📸', description: 'Track development stages', color: '#f59e0b' },
  { id: 'topic_5', name: 'Feeding & Nutrition', emoji: '🍼', description: 'Breastfeeding, formula & solids', color: '#fc5c7d' },
  { id: 'topic_6', name: 'Sleep Training', emoji: '🌙', description: 'Healthy sleep habits', color: '#764ba2' },
  { id: 'topic_7', name: 'Health & Safety', emoji: '🏥', description: 'Pediatric care & first aid', color: '#e53e3e' },
  { id: 'topic_8', name: 'Parenting Tips', emoji: '💡', description: 'Advice from experienced parents', color: '#38b2ac' },
  { id: 'topic_9', name: 'Toddler Life', emoji: '🧒', description: '1-3 years adventures', color: '#ed8936' },
  { id: 'topic_10', name: 'Early Learning', emoji: '📚', description: 'Education & activities', color: '#4299e1' },
];

export default function CommunityOnboardingScreen({ onComplete }: CommunityOnboardingScreenProps) {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [recommendedTopics, setRecommendedTopics] = useState<TopicRecommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const communityCtx = useCommunity();
  const { updateSelectedTopics: updateCommunityTopics, INITIAL_TOPICS: ctxTopics } = communityCtx || {};
  const { updateSelectedTopics: updateUserTopics, profile } = useUser();
  const { settings, themeColors, triggerHaptic } = useCustomization();

  // ─── SAFE TOPICS (fallback if context fails) ───
  const INITIAL_TOPICS = ctxTopics && Array.isArray(ctxTopics) && ctxTopics.length > 0 
    ? ctxTopics 
    : FALLBACK_TOPICS;

  // Generate intelligent recommendations based on user profile
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
          recommendations.push({ topicId: 'topic_1', reason: 'Getting ready?', confidence: 'medium' });
        } else if (ageMonths < 12) {
          recommendations.push({ topicId: 'topic_3', reason: 'Time for solids!', confidence: 'high' });
          recommendations.push({ topicId: 'topic_4', reason: 'Track those firsts', confidence: 'high' });
        } else if (ageMonths < 24) {
          recommendations.push({ topicId: 'topic_9', reason: 'Toddler years ahead', confidence: 'high' });
          recommendations.push({ topicId: 'topic_1', reason: 'Getting ready?', confidence: 'medium' });
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

  // Load previous selections
  useEffect(() => {
    const loadPreviousTopics = async () => {
      try {
        const [onboardingData, communityTopics] = await Promise.all([
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

        if (topics.length === 0 && communityTopics) {
          topics = JSON.parse(communityTopics);
        }

        if (topics.length > 0) {
          setSelectedTopics(topics.slice(0, 5));
        } else if (recommendedTopics.length > 0) {
          const autoSelected = recommendedTopics
            .filter(r => r.confidence === 'high')
            .slice(0, 3)
            .map(r => r.topicId);
          setSelectedTopics(autoSelected);
          setShowRecommendations(true);
        }
      } catch (error) {
        console.error('Error loading previous topics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreviousTopics();
  }, [recommendedTopics]);

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
          Alert.alert(
            'Maximum Topics Reached',
            'You can select up to 5 topics. Remove one to add another.',
            [{ text: 'OK' }]
          );
          return prev;
        }
        return [...prev, topicId];
      }
    });
  };

  const handleComplete = async () => {
    if (selectedTopics.length === 0) {
      Alert.alert(
        'Select Topics',
        'Please select at least 1 topic to personalize your feed.',
        [{ text: 'OK' }]
      );
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
      onComplete();
    } catch (error) {
      console.error('Error saving topics:', error);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    }
  };

  const handleSkip = async () => {
    Alert.alert(
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
              onComplete();
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
      <StatusBar barStyle="light" />
      <LinearGradient colors={CommunityGradients.header} style={StyleSheet.absoluteFill} />

      <AutoHideScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
      </AutoHideScrollView>

      <View style={[styles.bottomBar, isDark && styles.bottomBarDark]}>
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
  scrollContent: { paddingTop: 80, paddingBottom: 160, paddingHorizontal: 20 },
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
    paddingBottom: 40,
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
