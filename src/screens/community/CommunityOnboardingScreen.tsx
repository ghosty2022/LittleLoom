// src/screens/community/CommunityOnboardingScreen.tsx - COMPLETE REPLACEMENT

import {
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  Button,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { updateSectionState } from '../../hooks/useIntelligentSplash';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCommunity } from '../../context/CommunityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import {
  CommunityColors,
  CommunityGradients,
  CommunityShadows,
  CommunityBorderRadius,
} from '../../theme/CommunityTheme';

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

// ─── EXPANDED TOPICS from Tracker Categories ───
const EXPANDED_TOPICS = [
  // Existing topics
  { id: 'topic_1', name: 'Potty Training', emoji: '🚽', description: 'Tips, tricks, and support for potty training success', color: '#667eea' },
  { id: 'topic_2', name: 'Sleep Tips', emoji: '😴', description: 'Better sleep for babies and parents', color: '#11998e' },
  { id: 'topic_3', name: 'Feeding & Nutrition', emoji: '🍼', description: 'From breastfeeding to first foods', color: '#fa709a' },
  { id: 'topic_4', name: 'Milestones', emoji: '🏆', description: 'Celebrate every achievement', color: '#fee140' },
  { id: 'topic_5', name: 'Health & Wellness', emoji: '💊', description: 'Keeping your little ones healthy', color: '#fc5c7d' },
  { id: 'topic_6', name: 'Parenting Hacks', emoji: '💡', description: 'Clever solutions for everyday challenges', color: '#6a82fb' },
  { id: 'topic_7', name: 'Baby Names', emoji: '✨', description: 'Find the perfect name for your little one', color: '#f093fb' },
  { id: 'topic_8', name: 'Work-Life Balance', emoji: '⚖️', description: 'Juggling career and parenting', color: '#4facfe' },
  { id: 'topic_9', name: 'Toddler Tantrums', emoji: '😤', description: 'Navigating the terrible twos and beyond', color: '#fa709a' },
  { id: 'topic_10', name: 'Education', emoji: '📚', description: 'Early learning and school prep', color: '#43e97b' },
  { id: 'topic_11', name: 'Single Parenting', emoji: '💪', description: 'Support and advice for single parents', color: '#fa709a' },
  { id: 'topic_12', name: 'Special Needs', emoji: '🌈', description: 'Resources and community for special needs parenting', color: '#667eea' },
  
  // ─── NEW TOPICS from Tracker Categories ───
  // Health
  { id: 'topic_13', name: 'Vaccines & Immunizations', emoji: '💉', description: 'Track and discuss vaccine schedules', color: '#5F27CD' },
  { id: 'topic_14', name: 'Allergies', emoji: '🤧', description: 'Managing food and environmental allergies', color: '#EE5A24' },
  { id: 'topic_15', name: 'Teething', emoji: '🦷', description: 'Tips for teething relief and care', color: '#FF6B6B' },
  { id: 'topic_16', name: 'Skin Care', emoji: '🧴', description: 'Eczema, rashes, and baby skin health', color: '#F368E0' },
  
  // Development
  { id: 'topic_17', name: 'Speech & Language', emoji: '💬', description: 'Supporting communication development', color: '#54A0FF' },
  { id: 'topic_18', name: 'Play & Activities', emoji: '🧸', description: 'Educational play ideas for all ages', color: '#FF6B6B' },
  { id: 'topic_19', name: 'Sensory Play', emoji: '👋', description: 'Sensory activities and development', color: '#FF9F43' },
  { id: 'topic_20', name: 'Motor Skills', emoji: '🏃', description: 'Gross and fine motor development', color: '#1DD1A1' },
  
  // Emotional
  { id: 'topic_21', name: 'Tantrums & Emotions', emoji: '😤', description: 'Managing big feelings and behaviors', color: '#E74C3C' },
  { id: 'topic_22', name: 'Social Skills', emoji: '👥', description: 'Building friendships and social confidence', color: '#54A0FF' },
  { id: 'topic_23', name: 'Sibling Dynamics', emoji: '👶', description: 'Navigating sibling relationships', color: '#FF9FF3' },
  
  // Safety
  { id: 'topic_24', name: 'Home Safety', emoji: '🛡️', description: 'Babyproofing and child safety tips', color: '#1DD1A1' },
  { id: 'topic_25', name: 'Car Seat Safety', emoji: '🚗', description: 'Car seat installation and best practices', color: '#5F27CD' },
  { id: 'topic_26', name: 'Swim & Water Safety', emoji: '🏊', description: 'Water safety for all ages', color: '#00CEC9' },
  
  // Nutrition
  { id: 'topic_27', name: 'Introducing Solids', emoji: '🥄', description: 'First foods and baby-led weaning', color: '#FF9F43' },
  { id: 'topic_28', name: 'Allergen Introduction', emoji: '🥜', description: 'Safe introduction of allergenic foods', color: '#EE5A24' },
  { id: 'topic_29', name: 'Picky Eating', emoji: '🙅', description: 'Strategies for picky eaters', color: '#FDCB6E' },
  
  // Parental
  { id: 'topic_30', name: 'Postpartum Support', emoji: '💜', description: 'Recovery and mental health for parents', color: '#9B59B6' },
  { id: 'topic_31', name: 'Self-Care for Parents', emoji: '🧘', description: 'Finding balance and self-compassion', color: '#00B894' },
  { id: 'topic_32', name: 'Partner Communication', emoji: '💕', description: 'Strengthening your partnership', color: '#FF6B6B' },
  
  // Travel & Outdoors
  { id: 'topic_33', name: 'Travel with Kids', emoji: '✈️', description: 'Tips for family travel adventures', color: '#54A0FF' },
  { id: 'topic_34', name: 'Outdoor Activities', emoji: '🌳', description: 'Nature exploration and outdoor play', color: '#1DD1A1' },
  
  // Special Needs
  { id: 'topic_35', name: 'Therapy & Support', emoji: '🧩', description: 'PT, OT, ST, and therapy resources', color: '#A29BFE' },
  { id: 'topic_36', name: 'Reflux & Colic', emoji: '😣', description: 'Managing reflux, colic, and gas', color: '#FF6B6B' },
  
  // School & Learning
  { id: 'topic_37', name: 'Preschool & Early Ed', emoji: '🎒', description: 'Preparing for school and early learning', color: '#6C5CE7' },
  { id: 'topic_38', name: 'Homeschool Support', emoji: '🏠', description: 'Resources for homeschooling families', color: '#FDCB6E' },
  
  // Household
  { id: 'topic_39', name: 'Baby Gear & Products', emoji: '🛒', description: 'Reviews and recommendations for baby products', color: '#8E44AD' },
  { id: 'topic_40', name: 'Budgeting & Finances', emoji: '💰', description: 'Financial planning for growing families', color: '#F39C12' },
];

// These are all the topic IDs from EXPANDED_TOPICS
const ALL_TOPIC_IDS = EXPANDED_TOPICS.map(t => t.id);

export default function CommunityOnboardingScreen({ navigation, route, onComplete }: CommunityOnboardingScreenProps) {
  const isEditing = route?.params?.editing === true;
  const sweetAlert = useSweetAlert();
  useRouteBasedNavVisibility();
  const insets = useSafeAreaInsets();

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [recommendedTopics, setRecommendedTopics] = useState<TopicRecommendation[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [wasSkipped, setWasSkipped] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const communityCtx = useCommunity();
  const { updateSelectedTopics: updateCommunityTopics, INITIAL_TOPICS: ctxTopics } = communityCtx || {};
  const { updateSelectedTopics: updateUserTopics, profile } = useUser();
  const { settings, themeColors, triggerHaptic } = useCustomization();

  // Use expanded topics from our list, fallback to context topics
  const INITIAL_TOPICS = useMemo(() => {
    if (ctxTopics && Array.isArray(ctxTopics) && ctxTopics.length > 0) {
      // Merge with expanded topics to include all
      const merged = [...ctxTopics];
      EXPANDED_TOPICS.forEach(t => {
        if (!merged.some(m => m.id === t.id)) {
          merged.push(t);
        }
      });
      return merged;
    }
    return EXPANDED_TOPICS;
  }, [ctxTopics]);

  // Filter topics based on search
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return INITIAL_TOPICS;
    const query = searchQuery.toLowerCase().trim();
    return INITIAL_TOPICS.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.emoji === query ||
      t.id.toLowerCase().includes(query)
    );
  }, [INITIAL_TOPICS, searchQuery]);

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

      // Add recommendations based on tracker categories
      recommendations.push({ topicId: 'topic_6', reason: 'Community favorite', confidence: 'high' });
      recommendations.push({ topicId: 'topic_8', reason: 'Popular among parents', confidence: 'medium' });
      recommendations.push({ topicId: 'topic_5', reason: 'Always relevant', confidence: 'high' });
      recommendations.push({ topicId: 'topic_27', reason: 'Starting solids?', confidence: 'high' });
      recommendations.push({ topicId: 'topic_30', reason: 'You deserve support', confidence: 'medium' });

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
          if (parsed.skipped === true) {
            setWasSkipped(true);
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
      setIsLoading(true);
      
      // Save to local storage
      const data = { 
        completed: true, 
        selectedTopics,
        timestamp: new Date().toISOString(),
        recommendedUsed: showRecommendations,
      };

      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
      await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(selectedTopics));

      // Update context - this will also sync to Supabase via the context's updateSelectedTopics
      if (updateCommunityTopics) {
        await updateCommunityTopics(selectedTopics);
      }
      if (updateUserTopics) {
        await updateUserTopics(selectedTopics);
      }
      
      // Update splash state
      await updateSectionState('community', { onboardingComplete: true, topicSelected: true });

      if (settings.hapticFeedback) {
        triggerHaptic('success');
      }
      
      // Handle navigation based on context
      if (isEditing) {
        navigation?.goBack?.();
        return;
      }
      
      if (onComplete) {
        onComplete();
      } else {
        // Navigate to community main
        navigation?.navigate?.('CommunityMain');
      }
    } catch (error) {
      console.error('Error saving topics:', error);
      sweetAlert.alert('Error', 'Failed to save your preferences. Please try again.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    if (isEditing) return;
    
    // Auto-select some topics instead of skipping
    const autoSelectTopics = recommendedTopics
      .filter(r => r.confidence === 'high')
      .slice(0, 3)
      .map(r => r.topicId)
      .filter(id => INITIAL_TOPICS.some(t => t.id === id));

    sweetAlert.confirm(
      'Skip Topic Selection?',
      autoSelectTopics.length > 0 
        ? `We recommend selecting at least 3 topics. Would you like us to auto-select ${autoSelectTopics.length} recommended topics for you? You can always change these later.`
        : 'Selecting topics helps us show you relevant content. You can always change this later in your profile.',
      async () => {
        try {
          setIsLoading(true);
          
          const topicsToSave = autoSelectTopics.length > 0 ? autoSelectTopics : [];
          
          const data = { 
            completed: true, 
            selectedTopics: topicsToSave,
            timestamp: new Date().toISOString(),
            skipped: topicsToSave.length === 0,
            autoSelected: topicsToSave.length > 0
          };
          
          await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
          await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(topicsToSave));
          
          if (updateCommunityTopics) {
            await updateCommunityTopics(topicsToSave);
          }
          if (updateUserTopics) {
            await updateUserTopics(topicsToSave);
          }
          await updateSectionState('community', { onboardingComplete: true, topicSelected: topicsToSave.length > 0 });
          
          if (topicsToSave.length > 0) {
            sweetAlert.toast('Topics Selected', `${topicsToSave.length} topics were auto-selected for you.`, 'info');
          }
          
          if (onComplete) {
            onComplete();
          } else {
            navigation?.navigate?.('CommunityMain');
          }
        } catch (error) {
          console.error('Error skipping onboarding:', error);
          sweetAlert.alert('Error', 'Failed to complete onboarding. Please try again.', 'warning');
        } finally {
          setIsLoading(false);
        }
      },
      undefined,
      autoSelectTopics.length > 0 ? 'Auto-select' : 'Skip Anyway',
      'Choose Topics',
      true
    );
  };

  const isTopicRecommended = (topicId: string) => {
    return recommendedTopics.find(r => r.topicId === topicId);
  };

  const isDark = settings?.darkMode ?? false;

  const bottomBarHeight = Platform.OS === 'ios' ? 34 : 20;
  const tabBarHeight = 68 + 14 + bottomBarHeight;
  const extraPadding = 20;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={CommunityGradients.header} style={StyleSheet.absoluteFill} />
        <View style={{ alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ marginTop: 16, fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
            Personalizing your experience...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
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
          <Text style={styles.title}>{isEditing ? 'Your Topics' : 'Welcome to Community'}</Text>
          <Text style={styles.subtitle}>
            {isEditing 
              ? 'Update the topics you want to see in your feed. Pick up to 5.'
              : `Pick up to 5 topics you're interested in from ${INITIAL_TOPICS.length}+ topics`}
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

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search topics..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Topic Count */}
          <Text style={styles.topicCount}>
            {filteredTopics.length} topics available
          </Text>
        </Animated.View>

        <View style={styles.topicsGrid}>
          {filteredTopics.map((topic, index) => {
            const isSelected = selectedTopics.includes(topic.id);
            const recommendation = isTopicRecommended(topic.id);
            const isDisabled = selectedTopics.length >= 5 && !isSelected;

            return (
              <Animated.View 
                key={topic.id} 
                entering={FadeInUp.delay(index * 60)}
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

        <View style={{ height: tabBarHeight + extraPadding }} />
      </ScrollView>

      {/* Fixed bottom bar */}
      <View style={[
        styles.bottomBar, 
        isDark && styles.bottomBarDark,
        { paddingBottom: Math.max(insets.bottom, bottomBarHeight) + 10 }
      ]}>
        {!isEditing && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}

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

// ─── TextInput Styles ───
const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#000' },
  scrollContent: { paddingTop: 60, paddingBottom: 0, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 24 },
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
    width: '100%',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  topicCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
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
  topicEmoji: { fontSize: 36, marginBottom: 8 },
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
    paddingTop: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...CommunityShadows.lg,
  },
  bottomBarDark: {
    backgroundColor: 'rgba(20,20,20,0.98)',
  },
  skipButton: { alignItems: 'center', marginBottom: 12 },
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