
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  BackHandler,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { AutoHideFlatList } from '../../components/AutoHideScrollWrappers';
import type { RootStackParamList } from '../../types/navigation';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const wp = (percentage: number) => (SCREEN_WIDTH * percentage) / 100;
const hp = (percentage: number) => (SCREEN_HEIGHT * percentage) / 100;

const AUTO_ADVANCE_INTERVAL = 5000;
const USER_INACTIVITY_RESUME = 10000;
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v2';

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  colors: [string, string];
  darkColors?: [string, string];
  icon: string;
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

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [progressWidth, setProgressWidth] = useState(20);

  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();
  const { markOnboardingSeen } = useAuth();

  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList<OnboardingSlide>>(null);
  const insets = useSafeAreaInsets();

  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);

  // Prevent memory leaks and double navigation
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  useEffect(() => {
    const newWidth = ((currentIndex + 1) / ONBOARDING_DATA.length) * 100;
    setProgressWidth(newWidth);
  }, [currentIndex]);

  useEffect(() => {
    if (shouldReduceMotion) {
      pulseAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    if (isAutoPlaying) {
      pulse.start();
    } else {
      pulse.stop();
      pulseAnim.setValue(1);
    }

    return () => pulse.stop();
  }, [isAutoPlaying, shouldReduceMotion]);

  // Better auto-play with cleanup
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
        handleNavigateToLogin();
      }
    }, AUTO_ADVANCE_INTERVAL);

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [currentIndex, isAutoPlaying, isNavigating]);

  const viewableItemsChanged = useRef(({
    viewableItems,
  }: {
    viewableItems: Array<{ index: number | undefined }>;
  }) => {
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

  const handleNavigateToLogin = useCallback(async () => {
    if (isNavigating || !isMounted.current) return;

    setIsNavigating(true);
    setIsAutoPlaying(false);

    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);

    triggerHaptic('medium');

    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
      await markOnboardingSeen();
    } catch (e) {
      console.warn('Failed to mark onboarding seen:', e);
    }

    // Smooth fade-out before navigation
    navigation.replace('Login');
  }, [isNavigating, navigation, markOnboardingSeen, triggerHaptic]);

  const scrollToNext = useCallback(() => {
    if (isNavigating) return;

    triggerHaptic('light');
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
      handleNavigateToLogin();
    }
  }, [currentIndex, isNavigating, handleNavigateToLogin, triggerHaptic]);

  const skipToEnd = useCallback(() => {
    triggerHaptic('light');
    setIsAutoPlaying(false);
    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    handleNavigateToLogin();
  }, [handleNavigateToLogin, triggerHaptic]);

  const handleManualScroll = useCallback(() => {
    setIsAutoPlaying(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      if (!isNavigating && isMounted.current) setIsAutoPlaying(true);
    }, USER_INACTIVITY_RESUME);
  }, [isNavigating]);

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });

    const translateX = scrollX.interpolate({
      inputRange,
      outputRange: [SCREEN_WIDTH * 0.2, 0, -SCREEN_WIDTH * 0.2],
      extrapolate: 'clamp',
    });

    const rotateZ = scrollX.interpolate({
      inputRange,
      outputRange: ['8deg', '0deg', '-8deg'],
      extrapolate: 'clamp',
    });

    const currentColors = isDark && item.darkColors ? item.darkColors : item.colors;

    return (
      <View style={styles.slide}>
        <Animated.View
          style={[styles.slideContent, {
            opacity,
            transform: [
              { scale },
              { translateX },
              { rotateZ },
            ],
          }]}
        >
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
                <Ionicons name={item.icon as any} size={28} color="white" />
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
  };

  const currentSlide = ONBOARDING_DATA[currentIndex];
  const isLastSlide = currentIndex === ONBOARDING_DATA.length - 1;
  const currentColors = isDark && currentSlide.darkColors ? currentSlide.darkColors : currentSlide.colors;
  const backgroundColors: [string, string, string] = isDark
    ? ['#000000', '#050505', '#0a0a0a']
    : ['#f8faff', '#f0f4ff', '#e8eeff'];

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <LinearGradient colors={backgroundColors} style={styles.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

      {!isLastSlide && !isNavigating && (
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + hp(2) }]}
          onPress={skipToEnd}
          activeOpacity={0.7}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <BlurView intensity={isDark ? 40 : 80} style={[styles.skipBlur, isDark && styles.skipBlurDark]} tint={isDark ? 'dark' : 'light'}>
            <Text style={[styles.skipText, isDark && styles.skipTextDark]}>Skip</Text>
          </BlurView>
        </TouchableOpacity>
      )}

      <View style={[styles.progressContainer, { top: insets.top + hp(2) + 60 }]}>
        <View style={[styles.progressBar, isDark && styles.progressBarDark]}>
          <Animated.View style={[styles.progressFill, {
            width: `${progressWidth}%`,
            backgroundColor: currentColors[0],
          }]} />
        </View>
      </View>

      <View style={styles.carouselContainer}>
        <AutoHideFlatList
          data={ONBOARDING_DATA}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          scrollEnabled={!isNavigating}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          onViewableItemsChanged={viewableItemsChanged}
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

      <View style={styles.paginationContainer}>
        <View style={styles.pagination}>
          {ONBOARDING_DATA.map((_, index) => {
            const isActive = index === currentIndex;
            return (
              <View key={index} style={[styles.dot, {
                width: isActive ? 28 : 8,
                transform: [{ scale: isActive ? 1.3 : 0.8 }],
                opacity: isActive ? 1 : 0.3,
                backgroundColor: isActive ? currentColors[0] : isDark ? '#333' : '#d1d5db',
              }]} />
            );
          })}
        </View>

        <Text style={[styles.pageIndicator, isDark && styles.pageIndicatorDark]}>
          {currentIndex + 1}
          <Text style={[styles.pageIndicatorTotal, isDark && styles.pageIndicatorTotalDark]}>/ {ONBOARDING_DATA.length}</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.floatingNextButton, { bottom: insets.bottom + hp(3) + 90 }]}
        onPress={scrollToNext}
        activeOpacity={0.8}
        disabled={isNavigating}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <LinearGradient colors={currentColors} style={styles.floatingNextGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Animated.View style={{ transform: [{ scale: isLastSlide ? 1.1 : 1 }] }}>
            <Ionicons name={isLastSlide ? "checkmark" : "arrow-forward"} size={28} color="white" />
          </Animated.View>
        </LinearGradient>
      </TouchableOpacity>

      <View style={[styles.autoPlayIndicator, { bottom: insets.bottom + hp(3) + 170 }]}>
        <Animated.View style={[styles.pulseDot, {
          backgroundColor: isAutoPlaying ? currentColors[0] : '#666',
          transform: [{ scale: pulseAnim }],
          opacity: isAutoPlaying ? 0.8 : 0.3,
        }]} />
        <Text style={[styles.autoPlayText, isDark && styles.autoPlayTextDark]}>
          {isAutoPlaying ? 'Auto-playing' : 'Paused'}
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + hp(2) }]}>
        <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
          Crafted with <Text style={{ color: '#e53e3e' }}>♥</Text> by LittleLoom
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  containerDark: { backgroundColor: '#000000' },
  background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  skipButton: { position: 'absolute', right: wp(5), zIndex: 10, borderRadius: 24, overflow: 'hidden' },
  skipBlur: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(102,126,234,0.2)' },
  skipBlurDark: { backgroundColor: 'rgba(30,30,30,0.6)', borderColor: 'rgba(255,255,255,0.1)' },
  skipText: { fontSize: 14, fontWeight: '700', color: '#667eea', letterSpacing: 0.5 },
  skipTextDark: { color: '#a3bffa' },
  progressContainer: { position: 'absolute', left: wp(5), right: wp(5), zIndex: 5 },
  progressBar: { height: 4, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressBarDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  progressFill: { height: '100%', borderRadius: 2 },
  carouselContainer: { flex: 1, marginTop: hp(15) },
  slide: { width: SCREEN_WIDTH, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: wp(6) },
  slideContent: { alignItems: 'center', width: '100%' },
  card: { width: wp(74), height: wp(74), borderRadius: 36, overflow: 'hidden', marginBottom: hp(4), backgroundColor: 'rgba(255,255,255,0.7)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40, elevation: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  cardDark: { backgroundColor: 'rgba(20,20,20,0.6)', borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOpacity: 0.5 },
  cardGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  iconContainer: { position: 'absolute', top: 28, right: 28, width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10, transform: [{ rotate: '-12deg' }], zIndex: 10 },
  emojiContainer: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  emoji: { fontSize: wp(26) },
  decorCircle: { position: 'absolute', borderRadius: 100 },
  textContainer: { alignItems: 'center', paddingHorizontal: wp(8) },
  title: { fontSize: wp(7.5), fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: hp(1.5), letterSpacing: 0.5 },
  titleDark: { color: '#ffffff' },
  subtitle: { fontSize: wp(4.2), color: '#666', textAlign: 'center', lineHeight: wp(6), paddingHorizontal: wp(5), fontWeight: '500' },
  subtitleDark: { color: '#a0a0a0' },
  paginationContainer: { alignItems: 'center', marginBottom: hp(2) },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  pageIndicator: { fontSize: 14, fontWeight: '700', color: '#667eea' },
  pageIndicatorDark: { color: '#a3bffa' },
  pageIndicatorTotal: { fontWeight: '400', color: '#999' },
  pageIndicatorTotalDark: { color: '#666' },
  floatingNextButton: { position: 'absolute', right: wp(6), width: 70, height: 70, borderRadius: 35, overflow: 'hidden', shadowColor: '#667eea', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 15, zIndex: 100 },
  floatingNextGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  autoPlayIndicator: { position: 'absolute', right: wp(6), flexDirection: 'row', alignItems: 'center', zIndex: 99, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  autoPlayText: { fontSize: 12, color: '#666', fontWeight: '600' },
  autoPlayTextDark: { color: '#888' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: hp(2) },
  footerText: { fontSize: 12, color: '#999', fontWeight: '500', letterSpacing: 0.5 },
  footerTextDark: { color: '#666' },
});
