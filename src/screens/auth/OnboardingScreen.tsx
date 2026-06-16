import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Extrapolation, interpolate, Layout, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Animated, BackHandler, Button, Dimensions, FlatList, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';;
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const wp = (percentage: number) => (SCREEN_WIDTH * percentage) / 100;
const hp = (percentage: number) => (SCREEN_HEIGHT * percentage) / 100;

const AUTO_ADVANCE_INTERVAL = 5000;
const USER_INACTIVITY_RESUME = 8000;

const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  colors: [string, string];
  darkColors?: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
}

const ONBOARDING_DATA: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to LittleLoom',
    subtitle: "Your all-in-one companion for your baby's complete care journey",
    emoji: '🍼',
    colors: ['#667eea', '#764ba2'],
    darkColors: ['#4c51bf', '#553c9a'],
    icon: 'heart-outline',
  },
  {
    id: '2',
    title: 'Smart Care Tracking',
    subtitle: 'Log feedings, diapers, sleep, and milestones with intelligent reminders',
    emoji: '📊',
    colors: ['#f093fb', '#f5576c'],
    darkColors: ['#d53f8c', '#c53030'],
    icon: 'analytics-outline',
  },
  {
    id: '3',
    title: 'Soothing & Sleep',
    subtitle: 'White noise, lullabies, and sleep tracking for better rest',
    emoji: '🌙',
    colors: ['#4facfe', '#00f2fe'],
    darkColors: ['#2b6cb0', '#0987a0'],
    icon: 'moon-outline',
  },
  {
    id: '4',
    title: 'Family Together',
    subtitle: 'Share updates, coordinate care, and celebrate milestones together',
    emoji: '👨‍👩‍👧‍👦',
    colors: ['#43e97b', '#38f9d7'],
    darkColors: ['#276749', '#319795'],
    icon: 'people-outline',
  },
  {
    id: '5',
    title: 'Ready to Begin?',
    subtitle: "Let's create your baby's profile and start this beautiful journey",
    emoji: '✨',
    colors: ['#fa709a', '#fee140'],
    darkColors: ['#c53030', '#d69e2e'],
    icon: 'sparkles-outline',
  },
];

const SlideItem = React.memo(({ 
  item, 
  index, 
  scrollX, 
  isDark 
}: { 
  item: OnboardingSlide; 
  index: number; 
  scrollX: Animated.SharedValue<number>;
  isDark: boolean;
}) => {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.85, 1, 0.85],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.4, 1, 0.4],
      Extrapolation.CLAMP
    );
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [SCREEN_WIDTH * 0.15, 0, -SCREEN_WIDTH * 0.15],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }, { translateX }],
    };
  });

  const currentColors = isDark && item.darkColors ? item.darkColors : item.colors;

  return (
    <View style={styles.slide}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <LinearGradient
            colors={isDark
              ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']
              : [currentColors[0] + '15', currentColors[1] + '15']
            }
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.iconContainer, { backgroundColor: currentColors[0], shadowColor: currentColors[0] }]}>
              <Ionicons name={item.icon} size={28} color="white" />
            </View>

            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>

            <View style={[styles.decorCircle, { backgroundColor: currentColors[0] + '20', top: 30, left: 30, width: 50, height: 50 }]} />
            <View style={[styles.decorCircle, { backgroundColor: currentColors[1] + '15', bottom: 40, right: 40, width: 70, height: 70 }]} />
            <View style={[styles.decorCircle, { backgroundColor: currentColors[0] + '10', top: '50%', left: '10%', width: 30, height: 30 }]} />
          </LinearGradient>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, isDark && styles.titleDark]}>{item.title}</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>{item.subtitle}</Text>
        </View>
      </Animated.View>
    </View>
  );
});

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const scrollX = useSharedValue(0);
  const slidesRef = useRef<FlatList<OnboardingSlide>>(null);
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = false; // Onboarding always uses light theme for consistency

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onBackPress = () => true; // Block back button
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || isNavigating || !isMounted.current) {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setTimeout(() => {
      if (!isMounted.current || isNavigating) return;

      const nextIndex = currentIndex + 1;
      if (nextIndex < ONBOARDING_DATA.length) {
        slidesRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setCurrentIndex(nextIndex);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      } else {
        setIsAutoPlaying(false);
      }
    }, AUTO_ADVANCE_INTERVAL);

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [currentIndex, isAutoPlaying, isNavigating]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | undefined }> }) => {
    if (viewableItems[0]?.index !== undefined) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
    }
  }).current;

  const viewConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 200,
  }).current;

  const handleComplete = useCallback(async () => {
    if (isNavigating || !isMounted.current) return;

    setIsNavigating(true);
    setIsAutoPlaying(false);

    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);

    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist onboarding state:', e);
    }

    navigation.replace('Login');
  }, [isNavigating, navigation]);

  const handleSkip = useCallback(() => {
    if (isNavigating) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    setIsAutoPlaying(false);
    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);

    slidesRef.current?.scrollToIndex({
      index: ONBOARDING_DATA.length - 1,
      animated: true,
    });
    setCurrentIndex(ONBOARDING_DATA.length - 1);
  }, [isNavigating]);

  const handleManualScroll = useCallback(() => {
    setIsAutoPlaying(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      if (!isNavigating && isMounted.current) setIsAutoPlaying(true);
    }, USER_INACTIVITY_RESUME);
  }, [isNavigating]);

  const handleNext = useCallback(() => {
    if (isNavigating) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    setIsAutoPlaying(false);

    const nextIndex = currentIndex + 1;
    if (nextIndex < ONBOARDING_DATA.length) {
      slidesRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setCurrentIndex(nextIndex);

      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        if (!isNavigating && isMounted.current) setIsAutoPlaying(true);
      }, USER_INACTIVITY_RESUME);
    } else {
      handleComplete();
    }
  }, [currentIndex, isNavigating, handleComplete]);

  const isLastSlide = currentIndex === ONBOARDING_DATA.length - 1;
  const currentSlide = ONBOARDING_DATA[currentIndex];
  const currentColors = currentSlide.colors;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <LinearGradient 
        colors={['#f8faff', '#f0f4ff', '#e8eeff']} 
        style={styles.background} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
      />

      {/* Skip Button */}
      {!isLastSlide && !isNavigating && (
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + hp(2) }]}
          onPress={handleSkip}
          activeOpacity={0.7}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <BlurView intensity={80} style={styles.skipBlur} tint="light">
            <Text style={styles.skipText}>Skip</Text>
          </BlurView>
        </TouchableOpacity>
      )}

      {/* Progress Bar */}
      <View style={[styles.progressContainer, { top: insets.top + hp(2) + 60 }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${((currentIndex + 1) / ONBOARDING_DATA.length) * 100}%`,
            backgroundColor: currentColors[0],
          }]} />
        </View>
      </View>

      {/* Carousel */}
      <View style={styles.carouselContainer}>
        <Animated.FlatList
          data={ONBOARDING_DATA}
          renderItem={({ item, index }) => (
            <SlideItem item={item} index={index} scrollX={scrollX} isDark={isDark} />
          )}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          scrollEnabled={!isNavigating}
          onScroll={scrollHandler}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef as any}
          scrollEventThrottle={16}
          onTouchStart={handleManualScroll}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="center"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        />
      </View>

      {/* Pagination */}
      <View style={styles.paginationContainer}>
        <View style={styles.pagination}>
          {ONBOARDING_DATA.map((_, index) => {
            const isActive = index === currentIndex;
            return (
              <View key={index} style={[styles.dot, {
                width: isActive ? 28 : 8,
                backgroundColor: isActive ? currentColors[0] : '#d1d5db',
                opacity: isActive ? 1 : 0.5,
              }]} />
            );
          })}
        </View>

        <Text style={styles.pageIndicator}>
          {currentIndex + 1}
          <Text style={styles.pageIndicatorTotal}>/ {ONBOARDING_DATA.length}</Text>
        </Text>
      </View>

      {/* Floating Next Button */}
      <TouchableOpacity
        style={[styles.floatingNextButton, { bottom: insets.bottom + hp(3) + 90 }]}
        onPress={isLastSlide ? handleComplete : handleNext}
        activeOpacity={0.8}
        disabled={isNavigating}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <LinearGradient colors={currentColors} style={styles.floatingNextGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name={isLastSlide ? "checkmark" : "arrow-forward"} size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Auto-play indicator */}
      <View style={[styles.autoPlayIndicator, { bottom: insets.bottom + hp(3) + 170 }]}>
        <View style={[styles.pulseDot, {
          backgroundColor: isAutoPlaying ? currentColors[0] : '#666',
          opacity: isAutoPlaying ? 0.8 : 0.3,
        }]} />
        <Text style={styles.autoPlayText}>
          {isAutoPlaying ? 'Auto-playing' : 'Paused'}
        </Text>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + hp(2) }]}>
        <Text style={styles.footerText}>
          Crafted with <Text style={{ color: '#e53e3e' }}>♥</Text> by LittleLoom
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8faff' 
  },
  background: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0 
  },
  skipButton: { 
    position: 'absolute', 
    right: wp(5), 
    zIndex: 10, 
    borderRadius: 24, 
    overflow: 'hidden' 
  },
  skipBlur: { 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 24, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    borderWidth: 1, 
    borderColor: 'rgba(102,126,234,0.2)' 
  },
  skipText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#667eea', 
    letterSpacing: 0.5 
  },
  progressContainer: { 
    position: 'absolute', 
    left: wp(5), 
    right: wp(5), 
    zIndex: 5 
  },
  progressBar: { 
    height: 4, 
    backgroundColor: 'rgba(0,0,0,0.08)', 
    borderRadius: 2, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: '100%', 
    borderRadius: 2,
  },
  carouselContainer: { 
    flex: 1, 
    marginTop: hp(15) 
  },
  slide: { 
    width: SCREEN_WIDTH, 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: wp(6) 
  },
  slideContent: { 
    alignItems: 'center', 
    width: '100%' 
  },
  card: { 
    width: wp(74), 
    height: wp(74), 
    borderRadius: 36, 
    overflow: 'hidden', 
    marginBottom: hp(4), 
    backgroundColor: 'rgba(255,255,255,0.7)', 
    shadowColor: '#667eea', 
    shadowOffset: { width: 0, height: 20 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 40, 
    elevation: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.6)' 
  },
  cardDark: { 
    backgroundColor: 'rgba(20,20,20,0.6)', 
    borderColor: 'rgba(255,255,255,0.08)', 
    shadowColor: '#000', 
    shadowOpacity: 0.5 
  },
  cardGradient: { 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative' 
  },
  iconContainer: { 
    position: 'absolute', 
    top: 28, 
    right: 28, 
    width: 56, 
    height: 56, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 12, 
    elevation: 10, 
    transform: [{ rotate: '-12deg' }], 
    zIndex: 10 
  },
  emojiContainer: { 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 5 
  },
  emoji: { 
    fontSize: wp(26) 
  },
  decorCircle: { 
    position: 'absolute', 
    borderRadius: 100 
  },
  textContainer: { 
    alignItems: 'center', 
    paddingHorizontal: wp(8) 
  },
  title: { 
    fontSize: wp(7.5), 
    fontWeight: '800', 
    color: '#1a1a1a', 
    textAlign: 'center', 
    marginBottom: hp(1.5), 
    letterSpacing: 0.5 
  },
  titleDark: { 
    color: '#ffffff' 
  },
  subtitle: { 
    fontSize: wp(4.2), 
    color: '#666', 
    textAlign: 'center', 
    lineHeight: wp(6), 
    paddingHorizontal: wp(5), 
    fontWeight: '500' 
  },
  subtitleDark: { 
    color: '#a0a0a0' 
  },
  paginationContainer: { 
    alignItems: 'center', 
    marginBottom: hp(2) 
  },
  pagination: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  dot: { 
    height: 8, 
    borderRadius: 4, 
    marginHorizontal: 4,
  },
  pageIndicator: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#667eea' 
  },
  pageIndicatorTotal: { 
    fontWeight: '400', 
    color: '#999' 
  },
  floatingNextButton: { 
    position: 'absolute', 
    right: wp(6), 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    overflow: 'hidden', 
    shadowColor: '#667eea', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 20, 
    elevation: 15, 
    zIndex: 100 
  },
  floatingNextGradient: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  autoPlayIndicator: { 
    position: 'absolute', 
    right: wp(6), 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 99, 
    backgroundColor: 'rgba(0,0,0,0.05)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  pulseDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    marginRight: 8 
  },
  autoPlayText: { 
    fontSize: 12, 
    color: '#666', 
    fontWeight: '600' 
  },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    alignItems: 'center', 
    paddingTop: hp(2) 
  },
  footerText: { 
    fontSize: 12, 
    color: '#999', 
    fontWeight: '500', 
    letterSpacing: 0.5 
  },
});
