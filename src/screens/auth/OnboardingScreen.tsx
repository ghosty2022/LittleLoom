import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useCustomization } from '../../hooks/useCustomization';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const wp = (percentage: number) => (SCREEN_WIDTH * percentage) / 100;
const hp = (percentage: number) => (SCREEN_HEIGHT * percentage) / 100;

const AUTO_ADVANCE_INTERVAL = 6000;
const USER_INACTIVITY_RESUME = 10000;
const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

// ─── OPTIMIZED TYPES ──────────────────────────────────────────────
interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  colors: [string, string];
  darkColors?: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  featureList?: string[];
}

// ─── MEMOIZED DATA ──────────────────────────────────────────────
const ONBOARDING_DATA: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to LittleLoom',
    subtitle: 'Your companion for every precious milestone.',
    description: 'Track, connect, and celebrate your parenting journey.',
    emoji: '',
    colors: ['#667eea', '#764ba2'],
    darkColors: ['#4c51bf', '#553c9a'],
    icon: 'heart-outline',
  },
  {
    id: '2',
    title: 'Baby Profiles',
    subtitle: 'Create beautiful profiles for your little ones.',
    description: 'Track growth, milestones, and precious memories in one place.',
    emoji: '👶',
    colors: ['#fa709a', '#fee140'],
    darkColors: ['#c53030', '#d69e2e'],
    icon: 'person-circle-outline',
    featureList: ['Growth Charts', 'Milestones', 'Photos'],
  },
  {
    id: '3',
    title: 'Smart Tracking',
    subtitle: 'Effortless monitoring of every moment.',
    description: 'Feeds, sleep, potty, medication — logged with a single tap.',
    emoji: '⏱️',
    colors: ['#667eea', '#764ba2'],
    darkColors: ['#4c51bf', '#553c9a'],
    icon: 'analytics-outline',
    featureList: ['One-Tap Log', 'Smart Insights', 'Streaks'],
  },
  {
    id: '4',
    title: 'Restful Nights',
    subtitle: 'Gentle sounds and smart sleep insights.',
    description: 'Analyze sleep patterns and build better bedtime routines.',
    emoji: '🌙',
    colors: ['#4facfe', '#00f2fe'],
    darkColors: ['#2b6cb0', '#0987a0'],
    icon: 'moon-outline',
    featureList: ['Sleep Analysis', 'White Noise', 'Night Mode'],
  },
  {
    id: '5',
    title: 'Family Sharing',
    subtitle: 'Invite loved ones to share the journey.',
    description: 'Parents, guardians, and viewers — everyone stays in the loop.',
    emoji: '👨‍👩‍👧',
    colors: ['#43e97b', '#38f9d7'],
    darkColors: ['#276749', '#319795'],
    icon: 'people-outline',
    featureList: ['Invite Codes', 'Role Permissions', 'Real-time Sync'],
  },
  {
    id: '6',
    title: 'Community',
    subtitle: 'Connect with parents worldwide.',
    description: 'Ask questions, share wins, and get advice without judgment.',
    emoji: '💬',
    colors: ['#f093fb', '#f5576c'],
    darkColors: ['#d53f8c', '#c53030'],
    icon: 'chatbubbles-outline',
    featureList: ['Topics', 'Anonymous Posts', 'Achievements'],
  },
  {
    id: '7',
    title: 'Milestones',
    subtitle: 'Celebrate every first.',
    description: 'From first steps to first words — never miss a moment.',
    emoji: '🏆',
    colors: ['#fa709a', '#fee140'],
    darkColors: ['#c53030', '#d69e2e'],
    icon: 'trophy-outline',
    featureList: ['Photo Memories', 'Timeline', 'Share'],
  },
  {
    id: '8',
    title: 'Safe & Secure',
    subtitle: 'Your data stays private.',
    description: 'Biometric lock, encrypted storage, and local-first design.',
    emoji: '🔒',
    colors: ['#667eea', '#764ba2'],
    darkColors: ['#4c51bf', '#553c9a'],
    icon: 'shield-checkmark-outline',
    featureList: ['Biometric Auth', 'Encrypted', 'Local Backup'],
  },
  {
    id: '9',
    title: 'Begin the Journey',
    subtitle: "Create your baby's profile and start today.",
    description: "Let's make parenting a little easier, together.",
    emoji: '✨',
    colors: ['#43e97b', '#38f9d7'],
    darkColors: ['#276749', '#319795'],
    icon: 'sparkles-outline',
  },
];

const TOTAL_SLIDES = ONBOARDING_DATA.length;

// ─── OPTIMIZED DECORATIONS ──────────────────────────────────────

const RotatingGradientBorder = React.memo(({ colors, globalTime }: any) => {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${globalTime.value * 360}deg` }],
  }));

  return (
    <Animated.View style={[styles.rotatingBorderContainer, style]}>
      <LinearGradient
        colors={[`${colors[0]}60`, `${colors[1]}60`, `${colors[0]}60`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
});

const PulsingCorners = React.memo(({ color, globalTime }: any) => {
  const style = useAnimatedStyle(() => {
    const s = 1 + 0.3 * Math.sin(globalTime.value * Math.PI * 4);
    const o = 0.6 + 0.4 * Math.abs(Math.sin(globalTime.value * Math.PI * 4));
    return { transform: [{ scale: s }], opacity: o };
  });

  const positions = useMemo(
    () => [
      { top: -3, left: -3 },
      { top: -3, right: -3 },
      { bottom: -3, left: -3 },
      { bottom: -3, right: -3 },
    ],
    []
  );

  return (
    <>
      {positions.map((pos, i) => (
        <Animated.View
          key={i}
          style={[styles.cornerDot, { backgroundColor: color }, pos, style]}
        />
      ))}
    </>
  );
});

const FloatingOrbs = React.memo(({ colors, globalTime }: any) => {
  const orbs = useMemo<Array<any>>(
    () => [
      { phase: 0, x: wp(60), y: hp(18), size: 5, color: colors[0], index: 0 },
      { phase: 2.5, x: wp(18), y: hp(28), size: 3.5, color: colors[1], index: 1 },
      { phase: 5, x: wp(66), y: hp(38), size: 4, color: colors[0], index: 2 },
    ],
    [colors]
  );

  return (
    <>
      {orbs.map((orb) => (
        <Animated.View
          key={orb.index}
          style={[
            styles.floatingOrb,
            {
              width: orb.size,
              height: orb.size,
              backgroundColor: orb.color,
              left: orb.x,
              top: orb.y,
            },
            useAnimatedStyle(() => ({
              transform: [
                {
                  translateY: Math.sin(globalTime.value * Math.PI * 4 + orb.phase) * 10,
                },
                {
                  translateX:
                    Math.cos(globalTime.value * Math.PI * 2.8 + orb.phase) * 5 *
                    (orb.index % 2 === 0 ? 1 : -1),
                },
              ],
              opacity: 0.4 + 0.4 * Math.sin(globalTime.value * Math.PI * 4 + orb.phase),
            })),
          ]}
        />
      ))}
    </>
  );
});

// ─── FEATURE CHIPS ──────────────────────────────────────────────
const FeatureChips = React.memo(({ features, color }: any) => (
  <View style={styles.featureChipsContainer}>
    {features.map((feature: string, i: number) => (
      <View
        key={i}
        style={[
          styles.featureChip,
          { backgroundColor: `${color}18`, borderColor: `${color}30` },
        ]}
      >
        <Ionicons name="checkmark-circle" size={11} color={color} />
        <Text style={[styles.featureChipText, { color }]}>{feature}</Text>
      </View>
    ))}
  </View>
));

// ─── PAGINATION DOT ─────────────────────────────────────────────
const PaginationDot = React.memo(({ index, scrollX }: any) => {
  const style = useAnimatedStyle(() => {
    const input = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    return {
      width: interpolate(scrollX.value, input, [6, 24, 6], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, input, [0.3, 1, 0.3], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
});

// ─── SLIDE ITEM ──────────────────────────────────────────────────
const SlideItem = React.memo(({ item, index, scrollX, isDark, globalTime }: any) => {
  const inputRange = useMemo(
    () => [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ],
    [index]
  );

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

    return { opacity, transform: [{ scale }, { translateX }] };
  });

  const currentColors = isDark && item.darkColors ? item.darkColors : item.colors;
  const isLogoSlide = index === 0;

  if (isLogoSlide) {
    return (
      <View style={styles.slide}>
        <Animated.View style={[styles.slideContent, animatedStyle]}>
          <View style={styles.logoOnlyContainer}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoOnlyImage}
              resizeMode="contain"
            />
            <View style={styles.logoGlow} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, isDark && styles.titleDark, { fontSize: wp(8) }]}>
              {item.title}
            </Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark, { fontSize: wp(4.5) }]}>
              {item.subtitle}
            </Text>
            <Text style={[styles.description, isDark && styles.descriptionDark]}>
              {item.description}
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.slide}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <RotatingGradientBorder colors={currentColors} globalTime={globalTime} />
          <PulsingCorners color={currentColors[0]} globalTime={globalTime} />
          <FloatingOrbs colors={currentColors} globalTime={globalTime} />

          <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
                : [`${currentColors[0]}10`, `${currentColors[1]}10`]
            }
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.accentIconContainer, { backgroundColor: currentColors[0] }]}>
              <Ionicons name={item.icon} size={18} color="white" />
            </View>

            <View
              style={[
                styles.heroIconContainer,
                { borderColor: `${currentColors[0]}40` },
              ]}
            >
              <Ionicons name={item.icon} size={wp(14)} color={currentColors[0]} />
            </View>
          </LinearGradient>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, isDark && styles.titleDark]}>{item.title}</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            {item.subtitle}
          </Text>
          <Text style={[styles.description, isDark && styles.descriptionDark]}>
            {item.description}
          </Text>
          {item.featureList && (
            <FeatureChips features={item.featureList} color={currentColors[0]} />
          )}
        </View>
      </Animated.View>
    </View>
  );
});

// ─── MAIN SCREEN ─────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isCheckingSeen, setIsCheckingSeen] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const scrollX = useSharedValue(0);
  const globalTime = useSharedValue(0);
  const isAutoPlayingSV = useSharedValue(true);
  const isNavigatingSV = useSharedValue(false);

  const slidesRef = useRef<FlatList<OnboardingSlide>>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();
  const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;

  // ─── GLOBAL TIME DRIVER ──────────────────────────────────────
  useEffect(() => {
    globalTime.value = withTiming(1, { duration: 10000, easing: Easing.linear });
    const interval = setInterval(() => {
      globalTime.value = withTiming(globalTime.value + 1, { 
        duration: 10000, 
        easing: Easing.linear 
      });
    }, 10000);

    return () => {
      clearInterval(interval);
      cancelAnimation(globalTime);
    };
  }, []);

  // ─── CHECK STORAGE ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const checkOnboardingStatus = async () => {
      try {
        const [complete, seen] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
          AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
        ]);
        if (!cancelled) {
          if (complete === 'true' || seen === 'true') {
            // ✅ FIXED: Use setTimeout to ensure navigation is ready
            setTimeout(() => {
              if (navigation && navigation.replace) {
                navigation.replace('Login');
              }
            }, 100);
            return;
          }
          setIsCheckingSeen(false);
          // ✅ Mark as ready after check completes
          setTimeout(() => setIsReady(true), 100);
        }
      } catch (e) {
        console.warn('Failed to check onboarding status:', e);
        if (!cancelled) {
          setIsCheckingSeen(false);
          setTimeout(() => setIsReady(true), 100);
        }
      }
    };
    checkOnboardingStatus();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  // ─── BACK HANDLER ─────────────────────────────────────────────
  useEffect(() => {
    const onBackPress = () => true;
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, []);

  // ─── SYNC SHARED VALUES ──────────────────────────────────────
  useEffect(() => {
    isAutoPlayingSV.value = isAutoPlaying;
  }, [isAutoPlaying]);

  useEffect(() => {
    isNavigatingSV.value = isNavigating;
  }, [isNavigating]);

  // ─── AUTO-PLAY ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAutoPlaying || isNavigating || isCheckingSeen || !isReady) {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setTimeout(() => {
      if (isNavigatingSV.value) return;
      const nextIndex = currentIndex + 1;
      if (nextIndex < TOTAL_SLIDES) {
        slidesRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      } else {
        setIsAutoPlaying(false);
      }
    }, AUTO_ADVANCE_INTERVAL);

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [currentIndex, isAutoPlaying, isNavigating, isCheckingSeen, isReady]);

  // ─── SCROLL HANDLER ──────────────────────────────────────────
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // ─── INDEX REACTION ───────────────────────────────────────────
  useAnimatedReaction(
    () => Math.round(scrollX.value / SCREEN_WIDTH),
    (nextIndex, prevIndex) => {
      if (nextIndex !== prevIndex && nextIndex >= 0 && nextIndex < TOTAL_SLIDES) {
        runOnJS(setCurrentIndex)(nextIndex);
        if (Platform.OS !== 'web') {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    []
  );

  // ─── HANDLERS ─────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    setIsAutoPlaying(false);
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    try {
      await AsyncStorage.multiSet([
        [ONBOARDING_SEEN_KEY, 'true'],
        [ONBOARDING_COMPLETE_KEY, 'true'],
      ]);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist onboarding state:', e);
    }
    
    // ✅ FIXED: Use setTimeout to ensure navigation is ready
    setTimeout(() => {
      if (navigation && navigation.replace) {
        navigation.replace('Login');
      }
    }, 100);
  }, [isNavigating, navigation]);

  const handleSkip = useCallback(() => {
    if (isNavigating) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsAutoPlaying(false);
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    slidesRef.current?.scrollToIndex({ index: TOTAL_SLIDES - 1, animated: true });
  }, [isNavigating]);

  const handleManualScroll = useCallback(() => {
    setIsAutoPlaying(false);
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    resumeTimerRef.current = setTimeout(() => {
      if (!isNavigatingSV.value) {
        setIsAutoPlaying(true);
      }
    }, USER_INACTIVITY_RESUME);
  }, []);

  const handleNext = useCallback(() => {
    if (isNavigating) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsAutoPlaying(false);
    const nextIndex = currentIndex + 1;
    if (nextIndex < TOTAL_SLIDES) {
      slidesRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      resumeTimerRef.current = setTimeout(() => {
        if (!isNavigatingSV.value) {
          setIsAutoPlaying(true);
        }
      }, USER_INACTIVITY_RESUME);
    } else {
      handleComplete();
    }
  }, [currentIndex, isNavigating, handleComplete]);

  // ─── RENDER ITEM ──────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: OnboardingSlide; index: number }) => (
      <SlideItem
        item={item}
        index={index}
        scrollX={scrollX}
        isDark={isDark}
        globalTime={globalTime}
      />
    ),
    [scrollX, isDark, globalTime]
  );

  // ─── KEY EXTRACTOR ────────────────────────────────────────────
  const keyExtractor = useCallback((item: OnboardingSlide) => item.id, []);

  // ─── PROGRESS STYLE ───────────────────────────────────────────
  const progressStyle = useAnimatedStyle(() => ({
    width: `${((currentIndex + 1) / TOTAL_SLIDES) * 100}%`,
  }));

  // ─── DERIVED ──────────────────────────────────────────────────
  const isLastSlide = currentIndex === TOTAL_SLIDES - 1;
  const currentSlide = ONBOARDING_DATA[currentIndex];
  const currentColors = currentSlide?.colors || ['#667eea', '#764ba2'];
  const isFirstSlide = currentIndex === 0;

  // ✅ FIXED: Show loading until ready
  if (isCheckingSeen || !isReady) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <LinearGradient
          colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* ─── HEADER ────────────────────────────────────────────── */}
      {!isFirstSlide && (
        <View style={[styles.brandHeader, { top: insets.top + hp(1.5) }]}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>LittleLoom</Text>
          <Text style={styles.brandSubtitle}>By Refresh</Text>
        </View>
      )}

      {/* ─── SKIP BUTTON ───────────────────────────────────────── */}
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

      {/* ─── PROGRESS ──────────────────────────────────────────── */}
      <View style={[styles.progressContainer, { top: insets.top + hp(2) + (isFirstSlide ? 0 : 90) }]}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: currentColors[0] },
              progressStyle,
            ]}
          />
        </View>
      </View>

      {/* ─── CAROUSEL ──────────────────────────────────────────── */}
      <View
        style={[
          styles.carouselContainer,
          { marginTop: insets.top + (isFirstSlide ? hp(8) : hp(12)) },
        ]}
      >
        <Animated.FlatList
          data={ONBOARDING_DATA}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          scrollEnabled={!isNavigating}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onTouchStart={handleManualScroll}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="center"
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={renderItem}
          ref={slidesRef}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              slidesRef.current?.scrollToIndex({ index: info.index, animated: true });
            }, 100);
          }}
        />
      </View>

      {/* ─── PAGINATION ────────────────────────────────────────── */}
      <View style={styles.paginationContainer}>
        <View style={styles.pagination}>
          {ONBOARDING_DATA.map((_, index) => (
            <PaginationDot key={index} index={index} scrollX={scrollX} />
          ))}
        </View>
        <Text style={styles.pageIndicator}>
          {currentIndex + 1}
          <Text style={styles.pageIndicatorTotal}>/{TOTAL_SLIDES}</Text>
        </Text>
      </View>

      {/* ─── NEXT BUTTON ───────────────────────────────────────── */}
      <TouchableOpacity
        style={[
          styles.floatingNextButton,
          { bottom: insets.bottom + hp(3) + 72 },
        ]}
        onPress={isLastSlide ? handleComplete : handleNext}
        activeOpacity={0.8}
        disabled={isNavigating}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <LinearGradient
          colors={currentColors}
          style={styles.floatingNextGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons
            name={isLastSlide ? 'checkmark' : 'arrow-forward'}
            size={28}
            color="white"
          />
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── AUTO-PLAY INDICATOR ───────────────────────────────── */}
      <View
        style={[
          styles.autoPlayIndicator,
          { bottom: insets.bottom + hp(3) + 142 },
        ]}
      >
        <View
          style={[
            styles.pulseDot,
            {
              backgroundColor: isAutoPlaying ? currentColors[0] : '#666',
              opacity: isAutoPlaying ? 0.8 : 0.3,
            },
          ]}
        />
        <Text style={styles.autoPlayText}>
          {isAutoPlaying ? 'Auto-playing' : 'Paused'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#fff', fontWeight: '600' },

  brandHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  logoImage: { width: wp(18), height: wp(18) },
  brandTitle: {
    fontSize: wp(4.5),
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  brandSubtitle: {
    fontSize: wp(2.8),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

  skipButton: {
    position: 'absolute',
    right: wp(5),
    zIndex: 10,
    borderRadius: 24,
    overflow: 'hidden',
  },
  skipBlur: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  progressContainer: {
    position: 'absolute',
    left: wp(5),
    right: wp(5),
    zIndex: 5,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },

  carouselContainer: {
    flex: 1,
    marginBottom: hp(2),
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(6),
  },
  slideContent: { alignItems: 'center', width: '100%' },

  logoOnlyContainer: {
    width: wp(65),
    height: wp(65),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(4),
  },
  logoOnlyImage: { width: wp(50), height: wp(50), zIndex: 2 },
  logoGlow: {
    position: 'absolute',
    width: wp(55),
    height: wp(55),
    borderRadius: wp(27.5),
    backgroundColor: 'rgba(102,126,234,0.12)',
    transform: [{ scale: 1.2 }],
    zIndex: 1,
  },

  card: {
    width: wp(74),
    height: wp(74),
    borderRadius: wp(18),
    overflow: 'hidden',
    marginBottom: hp(3),
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDark: {
    backgroundColor: 'rgba(28,28,35,0.4)',
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
  },
  cardGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: wp(18),
  },

  rotatingBorderContainer: {
    position: 'absolute',
    width: wp(78),
    height: wp(78),
    borderRadius: wp(20),
    overflow: 'hidden',
    opacity: 0.5,
    zIndex: 0,
  },
  cornerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  floatingOrb: { position: 'absolute', borderRadius: 100, zIndex: 1 },

  accentIconContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-12deg' }],
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroIconContainer: {
    width: wp(26),
    height: wp(26),
    borderRadius: wp(13),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
    backgroundColor: 'transparent',
    borderWidth: 2,
    zIndex: 5,
  },

  textContainer: { alignItems: 'center', paddingHorizontal: wp(6) },
  title: {
    fontSize: wp(7),
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: hp(1),
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  titleDark: { color: '#ffffff' },
  subtitle: {
    fontSize: wp(4),
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: wp(5.5),
    paddingHorizontal: wp(4),
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitleDark: { color: '#ffffff' },
  description: {
    fontSize: wp(3.4),
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: wp(5),
    paddingHorizontal: wp(6),
    marginTop: hp(0.8),
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  descriptionDark: { color: 'rgba(255,255,255,0.9)' },

  featureChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: hp(1.5),
    gap: 6,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
  },
  featureChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  paginationContainer: {
    alignItems: 'center',
    marginBottom: hp(1),
    paddingVertical: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: '#fff',
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pageIndicatorTotal: {
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },

  floatingNextButton: {
    position: 'absolute',
    right: wp(6),
    bottom: hp(3) + 80,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 100,
  },
  floatingNextGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  autoPlayIndicator: {
    position: 'absolute',
    right: wp(6),
    bottom: hp(3) + 148,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  autoPlayText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
});