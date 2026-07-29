import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
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

const AUTO_ADVANCE_INTERVAL = 5000;
const USER_INACTIVITY_RESUME = 8000;

const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

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

/* ------------------------------------------------------------------ */
/*  Animated Outline Components                                        */
/* ------------------------------------------------------------------ */

const RotatingGradientBorder = ({ colors, isDark }: { colors: [string, string]; isDark: boolean }) => {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.rotatingBorderContainer, animatedStyle]}>
      <LinearGradient
        colors={[colors[0] + '60', colors[1] + '60', colors[0] + '60']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

const PulsingCorners = ({ color }: { color: string }) => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1000, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.4], [0.8, 0.3], Extrapolation.CLAMP),
  }));

  const cornerPositions = [
    { top: -4, left: -4 },
    { top: -4, right: -4 },
    { bottom: -4, left: -4 },
    { bottom: -4, right: -4 },
  ];

  return (
    <>
      {cornerPositions.map((pos, i) => (
        <Animated.View
          key={i}
          style={[
            styles.cornerDot,
            { backgroundColor: color },
            pos,
            animatedStyle,
          ]}
        />
      ))}
    </>
  );
};

const DashedBorder = ({ color }: { color: string }) => {
  const dashOffset = useSharedValue(0);
  useEffect(() => {
    dashOffset.value = withRepeat(
      withTiming(20, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.sin(dashOffset.value * 0.3),
      [-1, 1],
      [0.3, 0.7],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.dashedBorder,
        { borderColor: color + '40' },
        animatedStyle,
      ]}
    />
  );
};

const FloatingOrbs = ({ colors }: { colors: [string, string] }) => {
  const orbs = useMemo(
    () => [
      { delay: 0, x: wp(60), y: hp(15), size: 6, duration: 4000 },
      { delay: 800, x: wp(15), y: hp(25), size: 4, duration: 3500 },
      { delay: 1600, x: wp(70), y: hp(35), size: 5, duration: 4500 },
      { delay: 2400, x: wp(25), y: hp(10), size: 3, duration: 3800 },
      { delay: 1200, x: wp(50), y: hp(40), size: 4, duration: 4200 },
    ],
    []
  );

  return (
    <>
      {orbs.map((orb, i) => {
        const orbAnim = useSharedValue(0);
        useEffect(() => {
          orbAnim.value = withDelay(
            orb.delay,
            withRepeat(
              withTiming(1, { duration: orb.duration, easing: Easing.inOut(Easing.sin) }),
              -1,
              true
            )
          );
        }, []);

        const animatedStyle = useAnimatedStyle(() => ({
          transform: [
            {
              translateY: interpolate(
                orbAnim.value,
                [0, 1],
                [0, -15],
                Extrapolation.CLAMP
              ),
            },
            {
              translateX: interpolate(
                orbAnim.value,
                [0, 1],
                [0, 8 * (i % 2 === 0 ? 1 : -1)],
                Extrapolation.CLAMP
              ),
            },
          ],
          opacity: interpolate(
            orbAnim.value,
            [0, 0.5, 1],
            [0.4, 0.9, 0.4],
            Extrapolation.CLAMP
          ),
        }));

        return (
          <Animated.View
            key={i}
            style={[
              styles.floatingOrb,
              {
                width: orb.size,
                height: orb.size,
                backgroundColor: i % 2 === 0 ? colors[0] : colors[1],
                left: orb.x,
                top: orb.y,
              },
              animatedStyle,
            ]}
          />
        );
      })}
    </>
  );
};

const FeatureChips = ({ features, color }: { features: string[]; color: string }) => {
  return (
    <View style={styles.featureChipsContainer}>
      {features.map((feature, i) => (
        <View
          key={i}
          style={[
            styles.featureChip,
            {
              backgroundColor: color + '18',
              borderColor: color + '30',
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={12} color={color} />
          <Text style={[styles.featureChipText, { color }]}>{feature}</Text>
        </View>
      ))}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Slide Item                                                         */
/* ------------------------------------------------------------------ */

const SlideItem = React.memo(({
  item,
  index,
  scrollX,
  isDark,
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
    'worklet';
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.82, 1, 0.82],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.35, 1, 0.35],
      Extrapolation.CLAMP
    );
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [SCREEN_WIDTH * 0.18, 0, -SCREEN_WIDTH * 0.18],
      Extrapolation.CLAMP
    );
    const rotateY = interpolate(
      scrollX.value,
      inputRange,
      [15, 0, -15],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [
        { perspective: 1000 },
        { scale },
        { translateX },
        { rotateY: `${rotateY}deg` },
      ],
    };
  });

  const currentColors = isDark && item.darkColors ? item.darkColors : item.colors;
  const isLogoSlide = index === 0;

  // Logo-only first slide
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
        {/* Multi-layer animated card */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          {/* Layer 1: Rotating gradient border */}
          <RotatingGradientBorder colors={currentColors} isDark={isDark} />

          {/* Layer 2: Pulsing corner dots */}
          <PulsingCorners color={currentColors[0]} />

          {/* Layer 3: Animated dashed border */}
          <DashedBorder color={currentColors[1]} />

          {/* Layer 4: Floating orbs */}
          <FloatingOrbs colors={currentColors} />

          {/* Card content */}
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']
                : [currentColors[0] + '12', currentColors[1] + '12']
            }
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Accent badge */}
            <View
              style={[
                styles.accentIconContainer,
                { backgroundColor: currentColors[0] },
              ]}
            >
              <Ionicons name={item.icon} size={20} color="white" />
            </View>

            {/* Hero icon */}
            <View
              style={[
                styles.heroIconContainer,
                { borderColor: currentColors[0] + '45' },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={wp(14)}
                color={currentColors[0]}
              />
            </View>

            {/* Decorative circles */}
            <View
              style={[
                styles.decorCircle,
                {
                  backgroundColor: currentColors[0] + '18',
                  top: 25,
                  left: 25,
                  width: 45,
                  height: 45,
                },
              ]}
            />
            <View
              style={[
                styles.decorCircle,
                {
                  backgroundColor: currentColors[1] + '12',
                  bottom: 35,
                  right: 35,
                  width: 65,
                  height: 65,
                },
              ]}
            />
            <View
              style={[
                styles.decorCircle,
                {
                  backgroundColor: currentColors[0] + '08',
                  top: '55%',
                  left: '12%',
                  width: 25,
                  height: 25,
                },
              ]}
            />
          </LinearGradient>
        </View>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, isDark && styles.titleDark]}>
            {item.title}
          </Text>
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

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isCheckingSeen, setIsCheckingSeen] = useState(true);

  const scrollX = useSharedValue(0);
  const logoFloat = useSharedValue(0);
  const slidesRef = useRef<FlatList<OnboardingSlide>>(null);
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;

  // Check AsyncStorage on mount. If onboarding already seen, skip immediately.
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const [complete, seen] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
          AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
        ]);

        if (isMounted.current) {
          if (complete === 'true' || seen === 'true') {
            navigation.replace('Login');
            return;
          }
          setIsCheckingSeen(false);
        }
      } catch (e) {
        console.warn('Failed to check onboarding status:', e);
        if (isMounted.current) setIsCheckingSeen(false);
      }
    };

    checkOnboardingStatus();
  }, [navigation]);

  useEffect(() => {
    logoFloat.value = withRepeat(
      withTiming(-10, { duration: 2200 }),
      -1,
      true
    );
    return () => {
      isMounted.current = false;
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onBackPress = () => true;
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || isNavigating || !isMounted.current || isCheckingSeen) {
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
  }, [currentIndex, isAutoPlaying, isNavigating, isCheckingSeen]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollX.value = event.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | undefined }> }) => {
      if (viewableItems[0]?.index !== undefined) {
        const newIndex = viewableItems[0].index;
        if (newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
      }
    }
  ).current;

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

  const flatListProps = useMemo(
    () => ({
      data: ONBOARDING_DATA,
      keyExtractor: (item: OnboardingSlide) => item.id,
      horizontal: true,
      showsHorizontalScrollIndicator: false,
      pagingEnabled: true,
      bounces: false,
      scrollEnabled: !isNavigating,
      onScroll: scrollHandler,
      onViewableItemsChanged: onViewableItemsChanged,
      viewabilityConfig: viewConfig,
      scrollEventThrottle: 16,
      onTouchStart: handleManualScroll,
      getItemLayout: (_: any, index: number) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
      }),
      decelerationRate: 'fast' as const,
      snapToInterval: SCREEN_WIDTH,
      snapToAlignment: 'center' as const,
      maintainVisibleContentPosition: { minIndexForVisible: 0 },
      maxToRenderPerBatch: 3,
      windowSize: 3,
      initialNumToRender: 3,
      removeClippedSubviews: true,
    }),
    [isNavigating, scrollHandler, onViewableItemsChanged, viewConfig, handleManualScroll]
  );

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

  const logoFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoFloat.value }],
  }));

  const isLastSlide = currentIndex === ONBOARDING_DATA.length - 1;
  const currentSlide = ONBOARDING_DATA[currentIndex];
  const currentColors = currentSlide.colors;
  const isFirstSlide = currentIndex === 0;

  if (isCheckingSeen) {
    return (
      <SafeAreaView
        style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['#0f172a', '#1e293b', '#334155']
              : ['#667eea', '#764ba2', '#f093fb']
          }
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>
          Loading...
        </Text>
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
        colors={
          isDark
            ? ['#0f172a', '#1e293b', '#334155']
            : ['#667eea', '#764ba2', '#f093fb']
        }
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Brand Logo Header — HIDDEN on first slide */}
      {!isFirstSlide && (
        <View
          style={[styles.brandHeader, { top: insets.top + hp(1.5) }]}
        >
          <Animated.View style={logoFloatStyle}>
            <View style={styles.logoFloatWrap}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
          <Text style={styles.brandTitle}>LittleLoom</Text>
          <Text style={styles.brandSubtitle}>By Refresh</Text>
        </View>
      )}

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
      <View
        style={[
          styles.progressContainer,
          { top: insets.top + hp(2) + (isFirstSlide ? 0 : 100) },
        ]}
      >
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentIndex + 1) / ONBOARDING_DATA.length) * 100}%`,
                backgroundColor: currentColors[0],
              },
            ]}
          />
        </View>
      </View>

      {/* Carousel */}
      <View
        style={[
          styles.carouselContainer,
          { marginTop: insets.top + (isFirstSlide ? hp(8) : hp(14)) },
        ]}
      >
        <Animated.FlatList
          {...flatListProps}
          renderItem={({
            item,
            index,
          }: {
            item: OnboardingSlide;
            index: number;
          }) => <SlideItem item={item} index={index} scrollX={scrollX} isDark={isDark} />}
          ref={slidesRef as any}
        />
      </View>

      {/* Pagination */}
      <View style={styles.paginationContainer}>
        <View style={styles.pagination}>
          {ONBOARDING_DATA.map((_, index) => {
            const isActive = index === currentIndex;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: isActive ? 28 : 8,
                    backgroundColor: isActive ? currentColors[0] : '#d1d5db',
                    opacity: isActive ? 1 : 0.5,
                  },
                ]}
              />
            );
          })}
        </View>

        <Text style={styles.pageIndicator}>
          {currentIndex + 1}
          <Text style={styles.pageIndicatorTotal}>
            / {ONBOARDING_DATA.length}
          </Text>
        </Text>
      </View>

      {/* Floating Next Button */}
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

      {/* Auto-play indicator */}
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

      {/* Footer */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + hp(3) }]}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  brandHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  logoFloatWrap: {
    width: wp(22),
    height: wp(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: wp(20),
    height: wp(20),
  },
  brandTitle: {
    fontSize: wp(4.5),
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  brandSubtitle: {
    fontSize: wp(3),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  skipButton: {
    position: 'absolute',
    right: wp(5),
    zIndex: 10,
    borderRadius: 24,
    overflow: 'hidden',
  },
  skipBlur: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressContainer: {
    position: 'absolute',
    left: wp(5),
    right: wp(5),
    zIndex: 5,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  carouselContainer: {
    flex: 1,
    marginTop: hp(12),
    marginBottom: hp(2),
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(6),
  },
  slideContent: {
    alignItems: 'center',
    width: '100%',
  },

  /* ---- Logo-only first slide ---- */
  logoOnlyContainer: {
    width: wp(70),
    height: wp(70),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(5),
  },
  logoOnlyImage: {
    width: wp(55),
    height: wp(55),
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    width: wp(60),
    height: wp(60),
    borderRadius: wp(30),
    backgroundColor: 'rgba(102,126,234,0.15)',
    transform: [{ scale: 1.2 }],
    zIndex: 1,
  },

  /* ---- Multi-layer card ---- */
  card: {
    width: wp(76),
    height: wp(76),
    borderRadius: wp(20),
    overflow: 'hidden',
    marginBottom: hp(3.5),
    backgroundColor: 'rgba(255,255,255,0.75)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDark: {
    backgroundColor: 'rgba(28,28,35,0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
  },
  cardGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: wp(20),
  },

  /* ---- Animated outlines ---- */
  rotatingBorderContainer: {
    position: 'absolute',
    width: wp(80),
    height: wp(80),
    borderRadius: wp(22),
    overflow: 'hidden',
    opacity: 0.6,
    zIndex: 0,
  },
  cornerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
  },
  dashedBorder: {
    position: 'absolute',
    width: wp(74),
    height: wp(74),
    borderRadius: wp(18),
    borderWidth: 1.5,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  floatingOrb: {
    position: 'absolute',
    borderRadius: 100,
    zIndex: 1,
  },

  /* ---- Card internals ---- */
  accentIconContainer: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-12deg' }],
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  heroIconContainer: {
    width: wp(28),
    height: wp(28),
    borderRadius: wp(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp(2),
    backgroundColor: 'transparent',
    borderWidth: 2,
    zIndex: 5,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 100,
    zIndex: 1,
  },

  /* ---- Text ---- */
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: wp(6),
  },
  title: {
    fontSize: wp(7.2),
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: hp(1.2),
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  titleDark: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: wp(4.2),
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: wp(6),
    paddingHorizontal: wp(4),
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitleDark: {
    color: '#ffffff',
  },
  description: {
    fontSize: wp(3.6),
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    lineHeight: wp(5.4),
    paddingHorizontal: wp(6),
    marginTop: hp(1),
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  descriptionDark: {
    color: 'rgba(255,255,255,0.95)',
  },

  /* ---- Feature chips ---- */
  featureChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: hp(1.8),
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  featureChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ---- Pagination ---- */
  paginationContainer: {
    alignItems: 'center',
    marginBottom: hp(1.5),
    paddingVertical: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pageIndicatorTotal: {
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
  },

  /* ---- Floating next ---- */
  floatingNextButton: {
    position: 'absolute',
    right: wp(6),
    bottom: hp(3) + 80,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 100,
  },
  floatingNextGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- Auto-play ---- */
  autoPlayIndicator: {
    position: 'absolute',
    right: wp(6),
    bottom: hp(3) + 148,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 99,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  autoPlayText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: hp(1),
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: hp(1),
    paddingBottom: hp(1),
    zIndex: 50,
  },
});