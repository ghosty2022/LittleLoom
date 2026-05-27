// src/screens/community/CommunityOnboardingScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';
import { INITIAL_TOPICS, useCommunity } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@littleloom_community_onboarding_v3';

interface CommunityOnboardingScreenProps {
  onComplete: () => void;
}

export default function CommunityOnboardingScreen({ onComplete }: CommunityOnboardingScreenProps) {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const { updateSelectedTopics: updateCommunityTopics } = useCommunity();
  const { updateSelectedTopics: updateUserTopics } = useUser();

  // Load previously selected topics if any
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
        }
      } catch (error) {
        console.error('Error loading previous topics:', error);
      }
    };

    loadPreviousTopics();
  }, []);

  const toggleTopic = (topicId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        if (prev.length >= 5) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      // Save to all storage keys for sync
      const data = { 
        completed: true, 
        selectedTopics,
        timestamp: new Date().toISOString()
      };

      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
      await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify(selectedTopics));

      // Update both contexts
      await updateCommunityTopics(selectedTopics);
      await updateUserTopics(selectedTopics);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
              await updateCommunityTopics([]);
              await updateUserTopics([]);
              onComplete();
            } catch (error) {
              console.error('Error skipping onboarding:', error);
            }
          }
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={CommunityGradients.header} style={StyleSheet.absoluteFill} />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Welcome to Community</Text>
          <Text style={styles.subtitle}>
            Pick up to 5 topics you're interested in to personalize your feed
          </Text>
          <Text style={styles.counter}>
            {selectedTopics.length}/5 selected
          </Text>
        </Animated.View>

        <View style={styles.topicsGrid}>
          {INITIAL_TOPICS.map((topic, index) => (
            <Animated.View 
              key={topic.id} 
              entering={FadeInUp.delay(index * 80)}
              style={styles.topicWrapper}
            >
              <TouchableOpacity
                style={[
                  styles.topicCard,
                  selectedTopics.includes(topic.id) && styles.topicCardSelected,
                  selectedTopics.length >= 5 && !selectedTopics.includes(topic.id) && styles.topicCardDisabled,
                ]}
                onPress={() => toggleTopic(topic.id)}
                activeOpacity={0.8}
                disabled={selectedTopics.length >= 5 && !selectedTopics.includes(topic.id)}
              >
                <LinearGradient
                  colors={selectedTopics.includes(topic.id) 
                    ? [topic.color + '70', topic.color + '30']
                    : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']
                  }
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                <Text style={styles.topicName}>{topic.name}</Text>
                <Text style={styles.topicDescription} numberOfLines={2}>
                  {topic.description}
                </Text>

                {selectedTopics.includes(topic.id) && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={28} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
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
  scrollContent: { paddingTop: 80, paddingBottom: 160, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 40 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: 20, lineHeight: 22, marginBottom: 8 },
  counter: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
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
  topicCardSelected: {
    borderColor: '#fff',
    ...CommunityShadows.lg,
  },
  topicCardDisabled: {
    opacity: 0.5,
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