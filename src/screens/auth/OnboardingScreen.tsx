// src/screens/auth/OnboardingScreen.tsx - MODERN UI VERSION
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  FlatList,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

const slides = [
  {
    id: '1',
    title: 'Welcome to LittleLoom',
    subtitle: 'Your companion for every precious milestone.',
    emoji: '🧵',
    gradient: ['#667eea', '#764ba2'],
    description: 'Track, connect, and celebrate your parenting journey in one beautiful app.',
  },
  {
    id: '2',
    title: 'Baby Profiles',
    subtitle: 'Beautiful profiles for your little ones.',
    emoji: '👶',
    gradient: ['#f093fb', '#f5576c'],
    description: 'Track growth, milestones, and precious memories in one place.',
    features: ['Growth Charts', 'Milestones', 'Photo Gallery'],
  },
  {
    id: '3',
    title: 'Smart Tracking',
    subtitle: 'Effortless monitoring of every moment.',
    emoji: '📊',
    gradient: ['#4facfe', '#00f2fe'],
    description: 'Feeds, sleep, potty, medication — logged with a single tap.',
    features: ['One-Tap Log', 'Smart Insights', 'Streaks'],
  },
  {
    id: '4',
    title: 'Family Sharing',
    subtitle: 'Invite loved ones to share the journey.',
    emoji: '👨‍👩‍👧',
    gradient: ['#43e97b', '#38f9d7'],
    description: 'Parents, guardians, and viewers — everyone stays in the loop.',
    features: ['Invite Codes', 'Role Permissions', 'Real-time Sync'],
  },
  {
    id: '5',
    title: 'Begin the Journey',
    subtitle: "Create your baby's profile and start today.",
    emoji: '✨',
    gradient: ['#667eea', '#764ba2'],
    description: "Let's make parenting a little easier, together.",
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
        if (seen === 'true') {
          if (navigation && navigation.replace) {
            navigation.replace('Login');
          }
          return;
        }
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    };
    checkOnboarding();
  }, [navigation]);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flatListRef.current?.scrollToIndex({
      index: slides.length - 1,
      animated: true,
    });
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.multiSet([
        [ONBOARDING_SEEN_KEY, 'true'],
        [ONBOARDING_COMPLETE_KEY, 'true'],
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('Failed to save onboarding state:', e);
    }
    
    if (navigation && navigation.replace) {
      navigation.replace('Login');
    }
  };

  const renderItem = ({ item, index }: any) => {
    const isLast = index === slides.length - 1;
    const currentGradient = item.gradient || ['#667eea', '#764ba2'];

    return (
      <View style={styles.slide}>
        <LinearGradient
          colors={currentGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        {/* Background Decorations */}
        <View style={styles.decorationCircle1} />
        <View style={styles.decorationCircle2} />
        <View style={styles.decorationCircle3} />

        <View style={styles.contentContainer}>
          <View style={styles.emojiContainer}>
            <BlurView intensity={30} style={styles.emojiBlur} tint="light">
              <Text style={styles.emoji}>{item.emoji}</Text>
            </BlurView>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>

          {item.features && (
            <View style={styles.featuresContainer}>
              {item.features.map((feature: string, i: number) => (
                <View key={i} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          )}

          {isLast && (
            <View style={styles.getStartedContainer}>
              <Text style={styles.getStartedText}>
                Join thousands of parents already using LittleLoom
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const isLastSlide = currentIndex === slides.length - 1;
  const currentSlide = slides[currentIndex];
  const currentGradient = currentSlide?.gradient || ['#667eea', '#764ba2'];

  const dotOpacity = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH * (slides.length - 1)],
    outputRange: [1, 1],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Preparing your experience...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Fixed Footer - Overlays on top */}
      <View style={styles.footerContainer}>
        {/* Skip Button */}
        {!isLastSlide && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [
                (index - 1) * SCREEN_WIDTH,
                index * SCREEN_WIDTH,
                (index + 1) * SCREEN_WIDTH,
              ],
              outputRange: [8, 28, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [
                (index - 1) * SCREEN_WIDTH,
                index * SCREEN_WIDTH,
                (index + 1) * SCREEN_WIDTH,
              ],
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });
            const dotColor = scrollX.interpolate({
              inputRange: [
                (index - 1) * SCREEN_WIDTH,
                index * SCREEN_WIDTH,
                (index + 1) * SCREEN_WIDTH,
              ],
              outputRange: ['rgba(255,255,255,0.4)', '#ffffff', 'rgba(255,255,255,0.4)'],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: dotColor,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor: isLastSlide ? '#ffffff' : 'rgba(255,255,255,0.2)',
              borderColor: isLastSlide ? 'transparent' : 'rgba(255,255,255,0.3)',
            },
          ]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.nextButtonText,
              { color: isLastSlide ? currentGradient[0] : '#ffffff' },
            ]}
          >
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={isLastSlide ? 'checkmark' : 'arrow-forward'}
            size={20}
            color={isLastSlide ? currentGradient[0] : '#ffffff'}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  decorationCircle1: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  decorationCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  decorationCircle3: {
    position: 'absolute',
    top: '40%',
    right: -80,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  emojiContainer: {
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  emojiBlur: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  emoji: {
    fontSize: 56,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0,0,0,0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  featureText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  getStartedContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  getStartedText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});