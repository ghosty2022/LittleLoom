import React, { useEffect, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;

const ONBOARDING_COMPLETE_KEY = '@littleloom_onboarding_complete_v3';
const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray800: '#292524',
  gray900: '#1c1917',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   SLIDES
   ═══════════════════════════════════════════════════════════════════════════ */
const SLIDES = [
  {
    id: '1',
    title: 'Welcome to LittleLoom',
    subtitle: 'Your gentle companion for every precious milestone.',
    emoji: '🧵',
    gradient: ['#6366f1', '#8b5cf6', '#ec4899'] as [string, string, string],
    description: 'Track, connect, and celebrate your parenting journey in one beautiful space.',
    features: ['Beautiful Design', 'Thoughtful Features', 'Made with Love'],
  },
  {
    id: '2',
    title: 'Baby Profiles',
    subtitle: 'Beautiful profiles for your little ones.',
    emoji: '👶',
    gradient: ['#ec4899', '#f472b6', '#fb923c'] as [string, string, string],
    description: 'Track growth, milestones, and precious memories in one place.',
    features: ['Growth Charts', 'Milestones', 'Photo Gallery'],
  },
  {
    id: '3',
    title: 'Smart Tracking',
    subtitle: 'Effortless monitoring of every moment.',
    emoji: '📊',
    gradient: ['#0ea5e9', '#38bdf8', '#22d3ee'] as [string, string, string],
    description: 'Feeds, sleep, potty, medication — logged with a single tap.',
    features: ['One-Tap Log', 'Smart Insights', 'Streaks'],
  },
  {
    id: '4',
    title: 'Family Sharing',
    subtitle: 'Invite loved ones to share the journey.',
    emoji: '👨‍👩‍👧',
    gradient: ['#10b981', '#34d399', '#22c55e'] as [string, string, string],
    description: 'Parents, guardians, and viewers — everyone stays in the loop.',
    features: ['Invite Codes', 'Role Permissions', 'Real-time Sync'],
  },
  {
    id: '5',
    title: 'Begin Your Journey',
    subtitle: "Create your baby's profile and start today.",
    emoji: '✨',
    gradient: ['#6366f1', '#8b5cf6', '#ec4899'] as [string, string, string],
    description: "Let's make parenting a little easier, together.",
    features: ['Free Forever', 'Private & Secure', 'Made for Families'],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT
   ═══════════════════════════════════════════════════════════════════════════ */
const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        const color = interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo);
        return <Text key={i} style={[style, { color }]}>{l}</Text>;
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PRESSABLE SCALE
   ═══════════════════════════════════════════════════════════════════════════ */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean;
  style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    if (disabled) return;
    HAPTIC_LIGHT();
    onPress?.();
  };
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={handlePress}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PULSING DOT
   ═══════════════════════════════════════════════════════════════════════════ */
const PulsingDot: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => {
  const pulse = useSharedValue(1);
  const halo = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true);
    halo.value = withRepeat(withSequence(withTiming(1.8, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
  }, [pulse, halo]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    opacity: interpolate(halo.value, [1, 1.8], [0.35, 0]),
  }));
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, haloStyle]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, dotStyle]} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING SLIDE
   ═══════════════════════════════════════════════════════════════════════════ */
interface SlideProps {
  item: typeof SLIDES[0];
  index: number;
}

const OnboardingSlide = React.memo<SlideProps>(({ item, index }) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1800 }), withTiming(1, { duration: 1800 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 16000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.85, { duration: 2400 }), withTiming(0.4, { duration: 2400 })), -1, true);
  }, [pulse, rotate, glow]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.slide}>
      <LinearGradient colors={item.gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

      {/* Aura glows */}
      <LinearGradient
        colors={[`${item.gradient[0]}AA`, 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`${item.gradient[2]}AA`, 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Floating glass circles */}
      <View style={[styles.floatingCircle, styles.floatingCircle1]} />
      <View style={[styles.floatingCircle, styles.floatingCircle2]} />
      <View style={[styles.floatingCircle, styles.floatingCircle3]} />

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Emoji with pulse ring */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.emojiWrap}>
          <Animated.View style={[styles.emojiGlow, glowStyle]} />
          <Animated.View style={[styles.emojiRing, ringStyle]}>
            <LinearGradient
              colors={[item.gradient[0], item.gradient[1], item.gradient[2], item.gradient[0]]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <View style={styles.emojiInner}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
        </Animated.View>

        {/* Title + subtitle + description */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Animated.View>

        {/* Feature pills */}
        {item.features && (
          <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.featuresRow}>
            {item.features.map((feature: string, i: number) => (
              <View key={i} style={styles.featurePill}>
                <Ionicons name="checkmark-circle" size={14} color={DS.white} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </Animated.View>
        )}
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
        if (seen === 'true') {
          if (navigation && navigation.replace) navigation.replace('Login');
          return;
        }
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    checkOnboarding();
  }, [navigation]);

  const handleNext = () => {
    HAPTIC_LIGHT();
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    HAPTIC_LIGHT();
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.multiSet([
        [ONBOARDING_SEEN_KEY, 'true'],
        [ONBOARDING_COMPLETE_KEY, 'true'],
      ]);
      HAPTIC_SUCCESS();
    } catch {}
    if (navigation && navigation.replace) navigation.replace('Login');
  };

  const onMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setCurrentIndex(index);
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  /* Dot interpolation */
  const getDotWidth = (index: number) => {
    return scrollX.interpolate({
      inputRange: [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W],
      outputRange: [8, 28, 8],
      extrapolate: 'clamp',
    });
  };
  const getDotOpacity = (index: number) => {
    return scrollX.interpolate({
      inputRange: [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W],
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });
  };

  /* Loading */
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: DS.gray900 }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={['#0c0a09', '#12121e']} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <PulsingDot color={DS.primary} size={12} />
          <Text style={styles.loadingText}>Preparing your experience...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Progress pill top-left */}
      <View style={[styles.progressWrap, { top: HEADER_TOP_PADDING }]}>
        <BlurView intensity={40} tint="light" style={styles.progressBlur}>
          <PulsingDot color={DS.white} size={5} />
          <Text style={styles.progressText}>
            {currentIndex + 1} / {SLIDES.length}
          </Text>
        </BlurView>
      </View>

      {/* Skip pill top-right */}
      <PressableScale onPress={handleSkip} activeScale={0.94}>
        <View style={[styles.skipWrap, { top: HEADER_TOP_PADDING }]}>
          <BlurView intensity={40} tint="light" style={styles.skipBlur}>
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.85)" />
          </BlurView>
        </View>
      </PressableScale>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => <OnboardingSlide item={item} index={index} />}
        keyExtractor={(item) => item.id}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        decelerationRate={Platform.OS === 'ios' ? 0.92 : 0.85}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        bounces={false}
      />

      {/* Bottom section */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 32 }]}>
        {/* Pagination dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => {
            const dotWidth = getDotWidth(index);
            const dotOpacity = getDotOpacity(index);
            return (
              <RNAnimated.View
                key={index}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
              />
            );
          })}
        </View>

        {/* Primary action button */}
        <PressableScale onPress={handleNext} activeScale={0.97}>
          <View style={styles.ctaWrap}>
            {isLastSlide ? (
              <LinearGradient
                colors={[DS.white, DS.white]}
                style={styles.ctaGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.ctaText, { color: DS.primary }]}>Get Started</Text>
                <View style={[styles.ctaIconWrap, { backgroundColor: `${DS.primary}15` }]}>
                  <Ionicons name="arrow-forward" size={18} color={DS.primary} />
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.ctaGradient, styles.ctaGradientGlass]}>
                <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
                <Text style={styles.ctaText}>Next</Text>
                <View style={[styles.ctaIconWrap, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Ionicons name="arrow-forward" size={18} color={DS.white} />
                </View>
              </View>
            )}
          </View>
        </PressableScale>

        {/* Subtle footer */}
        <Text style={styles.footerText}>
          {isLastSlide ? 'By continuing, you agree to our Terms & Privacy' : 'Swipe to explore more'}
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.primary },

  /* Slide */
  slide: { width: SCREEN_W, flex: 1 },
  auraGlowTopLeft: {
    position: 'absolute', top: -120, left: -120,
    width: 340, height: 340, borderRadius: 170, opacity: 0.35,
  },
  auraGlowBottomRight: {
    position: 'absolute', bottom: -140, right: -120,
    width: 320, height: 320, borderRadius: 160, opacity: 0.3,
  },
  floatingCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.04)' },
  floatingCircle1: { width: 220, height: 220, top: -70, right: -50 },
  floatingCircle2: { width: 160, height: 160, bottom: 120, left: -60 },
  floatingCircle3: { width: 100, height: 100, top: '32%', right: -30, backgroundColor: 'rgba(255,255,255,0.02)' },

  /* Content */
  contentContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, paddingTop: 100, paddingBottom: 200,
  },

  /* Emoji pulse */
  emojiWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 32, position: 'relative' },
  emojiGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.18)' },
  emojiRing: { position: 'absolute', width: 130, height: 130, borderRadius: 65, overflow: 'hidden', opacity: 0.6 },
  emojiInner: {
    width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  emoji: { fontSize: 60, textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 12 },

  /* Text */
  textContainer: { alignItems: 'center', marginBottom: 20 },
  title: {
    fontSize: 34, fontWeight: '800', color: DS.white, textAlign: 'center',
    marginBottom: 12, letterSpacing: -0.8, lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.92)',
    textAlign: 'center', marginBottom: 10, letterSpacing: 0.2, lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  description: {
    fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center',
    lineHeight: 21, paddingHorizontal: 4,
    textShadowColor: 'rgba(0,0,0,0.06)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  /* Feature pills */
  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 },
  featurePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  featureText: { fontSize: 11, fontWeight: '700', color: DS.white, letterSpacing: 0.2 },

  /* Progress / Skip */
  progressWrap: { position: 'absolute', left: 20, zIndex: 100, borderRadius: 20, overflow: 'hidden' },
  progressBlur: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
  },
  progressText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  skipWrap: { position: 'absolute', right: 20, zIndex: 100, borderRadius: 20, overflow: 'hidden' },
  skipBlur: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
  },
  skipText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },

  /* Bottom */
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 20 },
  dot: { height: 4, borderRadius: 2, backgroundColor: DS.white },

  ctaWrap: { borderRadius: 56, overflow: 'hidden', ...DS.shadow.lg },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingLeft: 24, paddingRight: 8, gap: 12,
  },
  ctaGradientGlass: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: DS.white, letterSpacing: 0.3 },
  ctaIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  footerText: { marginTop: 16, textAlign: 'center', fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },

  /* Loading */
  loadingText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
});