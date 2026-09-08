// src/screens/auth/OnboardingScreen.tsx - SMOOTH & WELCOMING VERSION
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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

const slides = [
  {
    id: '1',
    title: 'Welcome to LittleLoom',
    subtitle: 'Your gentle companion for every precious milestone.',
    emoji: '🧵',
    gradient: ['#667eea', '#764ba2', '#a78bfa'],
    description: 'Track, connect, and celebrate your parenting journey in one beautiful space.',
  },
  {
    id: '2',
    title: 'Baby Profiles',
    subtitle: 'Beautiful profiles for your little ones.',
    emoji: '👶',
    gradient: ['#f093fb', '#f5576c', '#fb7185'],
    description: 'Track growth, milestones, and precious memories in one place.',
    features: ['Growth Charts', 'Milestones', 'Photo Gallery'],
  },
  {
    id: '3',
    title: 'Smart Tracking',
    subtitle: 'Effortless monitoring of every moment.',
    emoji: '📊',
    gradient: ['#4facfe', '#00f2fe', '#38bdf8'],
    description: 'Feeds, sleep, potty, medication — logged with a single tap.',
    features: ['One-Tap Log', 'Smart Insights', 'Streaks'],
  },
  {
    id: '4',
    title: 'Family Sharing',
    subtitle: 'Invite loved ones to share the journey.',
    emoji: '👨‍👩‍👧',
    gradient: ['#43e97b', '#38f9d7', '#34d399'],
    description: 'Parents, guardians, and viewers — everyone stays in the loop.',
    features: ['Invite Codes', 'Role Permissions', 'Real-time Sync'],
  },
  {
    id: '5',
    title: 'Begin Your Journey',
    subtitle: "Create your baby's profile and start today.",
    emoji: '✨',
    gradient: ['#667eea', '#764ba2', '#a78bfa'],
    description: "Let's make parenting a little easier, together.",
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const [isScrolling, setIsScrolling] = useState(false);

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
    handleComplete();
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

    return (
      <View style={styles.slide}>
        <LinearGradient
          colors={item.gradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Floating Elements */}
        <Animated.View style={[styles.floatingCircle, styles.floatingCircle1]} />
        <Animated.View style={[styles.floatingCircle, styles.floatingCircle2]} />
        <Animated.View style={[styles.floatingCircle, styles.floatingCircle3]} />

        <View style={styles.contentContainer}>
          {/* Emoji with subtle animation */}
          <View style={styles.emojiWrapper}>
            <Animated.Text style={styles.emoji}>{item.emoji}</Animated.Text>
            <View style={styles.emojiRing} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>

          {item.features && (
            <View style={styles.featuresContainer}>
              {item.features.map((feature: string, i: number) => (
                <View key={i} style={styles.featurePill}>
                  <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
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
    setIsScrolling(false);
  };

  const onScrollBeginDrag = () => {
    setIsScrolling(true);
  };

  const isLastSlide = currentIndex === slides.length - 1;

  // Animated pagination dot width
  const getDotWidth = (index: number) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    return scrollX.interpolate({
      inputRange,
      outputRange: [8, 28, 8],
      extrapolate: 'clamp',
    });
  };

  const getDotOpacity = (index: number) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    return scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });
  };

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

      {/* Skip Button - Top Right */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Progress Indicator - Top Left */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {slides.length}
        </Text>
      </View>

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
        onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={16}
        decelerationRate={Platform.OS === 'ios' ? 0.92 : 0.85}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        bounces={false}
      />

      {/* Bottom Section */}
      <View style={styles.bottomContainer}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => {
            const dotWidth = getDotWidth(index);
            const dotOpacity = getDotOpacity(index);
            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Next / Get Started Button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            isLastSlide && styles.getStartedButton,
          ]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isLastSlide ? ['#ffffff', '#ffffff'] : ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
            style={styles.nextButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[
              styles.nextButtonText,
              isLastSlide && styles.getStartedText,
            ]}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
            {!isLastSlide && (
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            )}
            {isLastSlide && (
              <Ionicons name="checkmark" size={20} color="#667eea" />
            )}
          </LinearGradient>
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
    letterSpacing: 0.5,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    paddingBottom: 140,
  },
  floatingCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  floatingCircle1: {
    width: 200,
    height: 200,
    top: -60,
    right: -40,
  },
  floatingCircle2: {
    width: 150,
    height: 150,
    bottom: 100,
    left: -60,
  },
  floatingCircle3: {
    width: 100,
    height: 100,
    top: '30%',
    right: -30,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  emojiWrapper: {
    marginBottom: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
    textShadowColor: 'rgba(0,0,0,0.08)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  emojiRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    top: -10,
    left: -10,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    lineHeight: 42,
    textShadowColor: 'rgba(0,0,0,0.08)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
    textShadowColor: 'rgba(0,0,0,0.03)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  featureText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingBottom: 48,
    backgroundColor: 'transparent',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 24,
    zIndex: 10,
  },
  progressText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  nextButton: {
    borderRadius: 56,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  getStartedButton: {
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  getStartedText: {
    color: '#667eea',
  },
});