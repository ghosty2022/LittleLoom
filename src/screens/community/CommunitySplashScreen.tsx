import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  Animated,
  Image,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useCommunity } from '../../context/CommunityContext';
import { getSectionState, updateSectionState } from '../../hooks/useIntelligentSplash';

const { width, height } = Dimensions.get('window');
const littleLoomLogo = require('../../../assets/logo.png');

const SPLASH_COLORS = ['#6366f1', '#8b5cf6', '#ec4899'];
const SPLASH_COLORS_DARK = ['#0c0a09', '#1c1917', '#292524'];

interface CommunitySplashScreenProps {
  onAnimationComplete: () => void;
  userName?: string;
}

interface SplashContent {
  emoji: string;
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
  tip: string;
}

/* ── Compact number formatter for stat values ───────────── */
const formatNumber = (n: number): string => {
  if (n < 1_000) return String(n);
  if (n < 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1_000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
};

export default function CommunitySplashScreen({
  onAnimationComplete,
  userName = 'Parent',
}: CommunitySplashScreenProps) {
  useRouteBasedNavVisibility();
  const insets = useSafeAreaInsets();

  const { darkMode, settings, shouldReduceMotion } = useCustomization();
  const { getSelectedTopics, topics, posts, getAllUsers } = useCommunity();
  const isDark = darkMode ?? false;

  const [splashContent, setSplashContent] = useState<SplashContent | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [reduceMotionSystem, setReduceMotionSystem] = useState(false);

  const mountedRef = useRef(true);
  const completedRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  /* ── Track OS-level reduced motion (in case user hasn't set the app setting) ── */
  useEffect(() => {
    let sub: any;
    (async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (mountedRef.current) setReduceMotionSystem(enabled);
        sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
          if (mountedRef.current) setReduceMotionSystem(v);
        });
      } catch {}
    })();
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const prefersReducedMotion = !!shouldReduceMotion || reduceMotionSystem;

  /* ── Real stats for display ─────────────────────────────── */
  const liveStats = useMemo(() => {
    const topicCount = topics?.length ?? 0;
    const userCount = (() => {
      try {
        return getAllUsers?.().length ?? 0;
      } catch {
        return 0;
      }
    })();
    const postCount = posts?.length ?? 0;
    return { topicCount, userCount, postCount };
  }, [topics?.length, posts?.length, getAllUsers]);

  /* ── Generate content branch ─────────────────────────── */
  useEffect(() => {
    const generate = async () => {
      try {
        const sectionState = await getSectionState('community');
        const selectedTopics = getSelectedTopics();
        const topicCount = selectedTopics.length;
        const hasTopics = topicCount > 0;

        const realTopicDisplay = formatNumber(liveStats.topicCount);
        const realUserDisplay = formatNumber(liveStats.userCount);
        const realPostDisplay = formatNumber(liveStats.postCount);

        let content: SplashContent;

        if (sectionState?.firstTime) {
          content = {
            emoji: '👋',
            title: `Welcome, ${userName}!`,
            subtitle:
              'Discover a supportive community of parents just like you. Share experiences, get advice, and celebrate milestones together.',
            stats: [
              { label: 'Topics', value: realTopicDisplay },
              { label: 'Parents', value: realUserDisplay },
              { label: 'Posts', value: realPostDisplay },
            ],
            tip: '💡 Select your favorite topics to personalize your feed',
          };
        } else if (!hasTopics) {
          content = {
            emoji: '🎯',
            title: 'Personalize Your Feed',
            subtitle:
              "You haven't selected any topics yet. Pick what matters to you for a tailored community experience.",
            stats: [
              { label: 'Available', value: realTopicDisplay },
              { label: 'Selected', value: '0' },
              { label: 'Parents', value: realUserDisplay },
            ],
            tip: '💡 Tap "Get Started" to choose your topics',
          };
        } else if (topicCount < 5) {
          const topicNames = selectedTopics.slice(0, 2).map((id) => {
            const t = topics.find((x) => x.id === id);
            return t?.name || 'topic';
          });
          content = {
            emoji: '🌱',
            title: 'Growing Your Community',
            subtitle: `You have ${topicCount} topic${topicCount === 1 ? '' : 's'} selected${
              topicNames.length > 0 ? ` (${topicNames.join(' & ')})` : ''
            }. Add more to discover even more relevant conversations.`,
            stats: [
              { label: 'Your Topics', value: String(topicCount) },
              { label: 'New Posts', value: realPostDisplay },
              { label: 'Parents', value: realUserDisplay },
            ],
            tip: '💡 Select 5 topics for the best experience',
          };
        } else {
          const topicNames = selectedTopics.slice(0, 3).map((id) => {
            const t = topics.find((x) => x.id === id);
            return t?.name || 'topic';
          });
          content = {
            emoji: '🌟',
            title: 'Welcome Back!',
            subtitle: `Your communities in ${topicNames.join(', ')}${
              selectedTopics.length > 3 ? ' & more' : ''
            } are buzzing with activity.`,
            stats: [
              { label: 'Your Topics', value: String(topicCount) },
              { label: 'New Posts', value: realPostDisplay },
              { label: 'Parents', value: realUserDisplay },
            ],
            tip: '💡 Pull down to refresh your personalized feed',
          };
        }

        if (!mountedRef.current) return;
        setSplashContent(content);
        setIsReady(true);
      } catch (err) {
        if (__DEV__) console.warn('[CommunitySplash] content gen failed:', err);
        if (!mountedRef.current) return;
        setIsReady(true);
      }
    };
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  /* ── Animate in / out ─────────────────────────────────── */
  useEffect(() => {
    if (!isReady || !splashContent) return;

    if (settings?.hapticFeedback && !prefersReducedMotion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -12, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );

    const entranceAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: prefersReducedMotion ? 200 : 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: prefersReducedMotion ? 120 : 600,
        useNativeDriver: true,
      }),
    ]);

    const rotateAnimation = Animated.loop(
      Animated.timing(iconRotateAnim, { toValue: 1, duration: 20000, useNativeDriver: true }),
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    );

    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: prefersReducedMotion ? 300 : 2400,
      useNativeDriver: false,
    });

    const statsEntrance = Animated.timing(statsAnim, {
      toValue: 1,
      duration: prefersReducedMotion ? 150 : 500,
      delay: prefersReducedMotion ? 0 : 400,
      useNativeDriver: true,
    });

    entranceAnimation.start();
    floatAnimation.start();
    if (!prefersReducedMotion) {
      rotateAnimation.start();
      pulseAnimation.start();
    }
    progressAnimation.start();
    statsEntrance.start();

    const timer = setTimeout(async () => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: prefersReducedMotion ? 150 : 380,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.06,
          duration: prefersReducedMotion ? 150 : 380,
          useNativeDriver: true,
        }),
      ]).start(async () => {
        // ── Persist the "seen" flag BEFORE notifying the parent so even if
        //    the app closes mid-transition, the next launch is correct.
        try {
          const existing = await getSectionState('community');
          await updateSectionState('community', {
            ...(existing || {}),
            firstTime: false,
            lastSeenAt: new Date().toISOString(),
          });
        } catch (err) {
          if (__DEV__) console.warn('[CommunitySplash] persist failed:', err);
        }
        if (mountedRef.current && !completedRef.current) {
          completedRef.current = true;
          onAnimationComplete();
        }
      });
    }, prefersReducedMotion ? 1400 : 2800);

    return () => {
      clearTimeout(timer);
      floatAnimation.stop();
      rotateAnimation.stop();
      pulseAnimation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, splashContent, settings?.hapticFeedback, prefersReducedMotion]);

  const spin = iconRotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  /* ── Loading gate ─────────────────────────────────────── */
  if (!isReady || !splashContent) {
    return (
      <View
        style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}
        accessible
        accessibilityLabel="Loading community"
        accessibilityRole="progressbar"
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDark ? '#a8a29e' : '#78716c' }]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={isDark ? SPLASH_COLORS_DARK : SPLASH_COLORS}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Aura bloom */}
        <View style={[styles.auraBloom, isDark && { opacity: 0.35 }]} pointerEvents="none" />
        <View style={[styles.auraBloom2, isDark && { opacity: 0.25 }]} pointerEvents="none" />

        {/* Background rings */}
        {!prefersReducedMotion && (
          <>
            <Animated.View
              style={[
                styles.bgCircle,
                {
                  borderColor: 'rgba(255,255,255,0.06)',
                  transform: [{ rotate: spin }, { scale: pulseAnim }],
                },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.bgCircle2,
                {
                  borderColor: 'rgba(255,255,255,0.04)',
                  transform: [{ rotate: spin }, { scale: pulseAnim }],
                },
              ]}
              pointerEvents="none"
            />
          </>
        )}

        {/* Floating icons */}
        {!prefersReducedMotion && (
          <>
            <Animated.View
              style={[styles.floatingIcon1, { transform: [{ scale: pulseAnim }] }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons name="heart" size={22} color="rgba(255,255,255,0.35)" />
            </Animated.View>
            <Animated.View
              style={[styles.floatingIcon2, { transform: [{ scale: pulseAnim }] }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons name="chatbubble" size={18} color="rgba(255,255,255,0.28)" />
            </Animated.View>
            <Animated.View
              style={[styles.floatingIcon3, { transform: [{ scale: pulseAnim }] }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons name="people" size={26} color="rgba(255,255,255,0.22)" />
            </Animated.View>
          </>
        )}

        {/* Main content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideUpAnim }],
            },
          ]}
          accessible
          accessibilityLabel={`${splashContent.title}. ${splashContent.subtitle}`}
        >
          {/* Logo */}
          <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.08)']}
                style={styles.logoRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={[styles.logoInner, { backgroundColor: 'rgba(255,255,255,0.96)' }]}>
                  <Image
                    source={littleLoomLogo}
                    style={styles.logoImage}
                    resizeMode="contain"
                    accessibilityLabel="LittleLoom logo"
                  />
                </View>
              </LinearGradient>
            </View>
          </Animated.View>

          <Text style={styles.title}>{splashContent.title}</Text>
          <Text style={styles.subtitle}>{splashContent.subtitle}</Text>

          {/* Stats */}
          <Animated.View
            style={[
              styles.statsContainer,
              {
                opacity: statsAnim,
                transform: [
                  {
                    translateY: statsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
            accessibilityRole="summary"
            accessibilityLabel={splashContent.stats
              .map((s) => `${s.value} ${s.label}`)
              .join(', ')}
          >
            {splashContent.stats.map((stat, i) => (
              <React.Fragment key={stat.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                {i < splashContent.stats.length - 1 && (
                  <View style={styles.statDivider} />
                )}
              </React.Fragment>
            ))}
          </Animated.View>

          {/* Tip */}
          <View
            style={styles.tipContainer}
            accessibilityRole="text"
            accessibilityLabel={splashContent.tip}
          >
            <Text style={styles.tipText}>{splashContent.tip}</Text>
          </View>

          {/* Progress */}
          <View
            style={styles.progressContainer}
            accessibilityRole="progressbar"
            accessibilityLabel="Loading your community"
          >
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={['#ffffff', '#fbcfe8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            <Text style={styles.progressText}>Loading your community...</Text>
          </View>
        </Animated.View>

        {/* Bottom branding */}
        <View style={[styles.bottomBranding, { bottom: insets.bottom + 28 }]}>
          <Text style={styles.brandingText}>LittleLoom</Text>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingSubtext}>Community</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, fontWeight: '600' },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  auraBloom: {
    position: 'absolute',
    top: -height * 0.25,
    left: -width * 0.35,
    width: width * 1.3,
    height: width * 1.3,
    borderRadius: width * 0.65,
    backgroundColor: 'rgba(255,255,255,0.15)',
    opacity: 0.6,
  },
  auraBloom2: {
    position: 'absolute',
    bottom: -height * 0.25,
    right: -width * 0.35,
    width: width * 1.1,
    height: width * 1.1,
    borderRadius: width * 0.55,
    backgroundColor: 'rgba(255,255,255,0.10)',
    opacity: 0.5,
  },
  bgCircle: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    borderWidth: 40,
    top: -width * 0.3,
    right: -width * 0.3,
  },
  bgCircle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    borderWidth: 30,
    bottom: -width * 0.2,
    left: -width * 0.2,
  },
  floatingIcon1: { position: 'absolute', top: height * 0.15, left: width * 0.15 },
  floatingIcon2: { position: 'absolute', top: height * 0.25, right: width * 0.2 },
  floatingIcon3: { position: 'absolute', bottom: height * 0.2, left: width * 0.1 },
  content: {
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
    paddingHorizontal: 40,
  },
  logoContainer: { marginBottom: 28 },
  logoRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  logoInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: 80, height: 80 },
  title: {
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: 'center',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.92)',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statItem: { alignItems: 'center', minWidth: 70 },
  statNumber: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 30, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.28)' },
  tipContainer: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tipText: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', color: 'rgba(255,255,255,0.92)' },
  progressContainer: { width: '100%', maxWidth: 280, alignItems: 'center' },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
  progressText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  bottomBranding: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandingText: { fontSize: 15, fontWeight: '800', color: '#fff', opacity: 0.95 },
  brandingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  brandingSubtext: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
});