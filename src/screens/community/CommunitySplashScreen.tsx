import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRouteBasedNavVisibility } from '../../hooks/useRouteBasedNavVisibility';
import { useCustomization } from '../../hooks/useCustomization';
import { useCommunity } from '../../context/CommunityContext';
import { getSectionState, updateSectionState } from '../../hooks/useIntelligentSplash';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
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
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const ringRotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const dotsAnim = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  /* Track OS reduce motion */
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
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const prefersReducedMotion = !!shouldReduceMotion || reduceMotionSystem;

  const liveStats = useMemo(() => {
    const topicCount = topics?.length ?? 0;
    const userCount = (() => { try { return getAllUsers?.().length ?? 0; } catch { return 0; } })();
    const postCount = posts?.length ?? 0;
    return { topicCount, userCount, postCount };
  }, [topics?.length, posts?.length, getAllUsers]);

  /* Generate content */
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
            subtitle: 'Discover a supportive community of parents just like you. Share experiences, get advice, and celebrate milestones together.',
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
            subtitle: "You haven't selected any topics yet. Pick what matters to you for a tailored community experience.",
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
            subtitle: `You have ${topicCount} topic${topicCount === 1 ? '' : 's'} selected${topicNames.length > 0 ? ` (${topicNames.join(' & ')})` : ''}. Add more to discover even more relevant conversations.`,
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
            subtitle: `Your communities in ${topicNames.join(', ')}${selectedTopics.length > 3 ? ' & more' : ''} are buzzing with activity.`,
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

  /* Animate */
  useEffect(() => {
    if (!isReady || !splashContent) return;

    if (settings?.hapticFeedback && !prefersReducedMotion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );

    const entranceAnimation = Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: prefersReducedMotion ? 200 : 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(slideUpAnim, { toValue: 0, duration: prefersReducedMotion ? 120 : 600, useNativeDriver: true }),
    ]);

    const rotateAnimation = Animated.loop(
      Animated.timing(ringRotateAnim, { toValue: 1, duration: 14000, useNativeDriver: true }),
    );

    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.9, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
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

    const dotsLoop = Animated.loop(
      Animated.stagger(200, [
        Animated.sequence([
          Animated.timing(dotsAnim[0], { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(dotsAnim[0], { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotsAnim[1], { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(dotsAnim[1], { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotsAnim[2], { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(dotsAnim[2], { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    );

    entranceAnimation.start();
    floatAnimation.start();
    if (!prefersReducedMotion) {
      rotateAnimation.start();
      glowAnimation.start();
      dotsLoop.start();
    }
    progressAnimation.start();
    statsEntrance.start();

    const timer = setTimeout(async () => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: prefersReducedMotion ? 150 : 380, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.06, duration: prefersReducedMotion ? 150 : 380, useNativeDriver: true }),
      ]).start(async () => {
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
      glowAnimation.stop();
      dotsLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, splashContent, settings?.hapticFeedback, prefersReducedMotion]);

  const spin = ringRotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  /* Loading gate */
  if (!isReady || !splashContent) {
    return (
      <View
        style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}
        accessible accessibilityLabel="Loading community" accessibilityRole="progressbar"
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={styles.loadingContainer}>
          <View style={styles.dotsRow}>
            {dotsAnim.map((v, i) => (
              <Animated.View
                key={i}
                style={[styles.loadingDot, {
                  opacity: v,
                  backgroundColor: isDark ? '#818cf8' : '#6366f1',
                }]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0c0a09' : '#fafaf9' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={isDark ? SPLASH_COLORS_DARK : SPLASH_COLORS} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {/* Aura glows */}
        <LinearGradient
          colors={['rgba(255,255,255,0.25)', 'transparent']}
          style={styles.auraGlowTopLeft}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'transparent']}
          style={styles.auraGlowBottomRight}
          start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />

        {/* Floating icons */}
        {!prefersReducedMotion && (
          <>
            <Animated.View style={[styles.floatingIcon1, { transform: [{ scale: glowAnim.interpolate({ inputRange: [0.4, 0.9], outputRange: [0.95, 1.1] }) }] }]} pointerEvents="none">
              <Ionicons name="heart" size={22} color="rgba(255,255,255,0.32)" />
            </Animated.View>
            <Animated.View style={[styles.floatingIcon2, { transform: [{ scale: glowAnim.interpolate({ inputRange: [0.4, 0.9], outputRange: [1.1, 0.95] }) }] }]} pointerEvents="none">
              <Ionicons name="chatbubble" size={18} color="rgba(255,255,255,0.26)" />
            </Animated.View>
            <Animated.View style={[styles.floatingIcon3, { transform: [{ scale: glowAnim.interpolate({ inputRange: [0.4, 0.9], outputRange: [0.95, 1.1] }) }] }]} pointerEvents="none">
              <Ionicons name="people" size={24} color="rgba(255,255,255,0.22)" />
            </Animated.View>
          </>
        )}

        {/* Main */}
        <Animated.View
          style={[styles.content, {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateY: slideUpAnim }],
          }]}
          accessible
          accessibilityLabel={`${splashContent.title}. ${splashContent.subtitle}`}
        >
          {/* Logo with aura ring */}
          <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
            <View style={styles.logoWrap}>
              <Animated.View style={[styles.logoGlow, { opacity: glowAnim, transform: [{ scale: glowAnim.interpolate({ inputRange: [0.4, 0.9], outputRange: [1, 1.08] }) }] }]} />
              {!prefersReducedMotion && (
                <Animated.View style={[styles.logoRing, { transform: [{ rotate: spin }] }]}>
                  <LinearGradient
                    colors={['#ffffff', '#fbcfe8', '#ffffff', '#c7d2fe', '#ffffff']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              )}
              <View style={styles.logoInner}>
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                <Image source={littleLoomLogo} style={styles.logoImage} resizeMode="contain" accessibilityLabel="LittleLoom logo" />
              </View>
            </View>
          </Animated.View>

          {/* Emoji + title chip */}
          <View style={styles.titleRow}>
            <Text style={styles.titleEmoji}>{splashContent.emoji}</Text>
            <Text style={styles.title}>{splashContent.title}</Text>
          </View>
          <Text style={styles.subtitle}>{splashContent.subtitle}</Text>

          {/* Stats card */}
          <Animated.View
            style={[styles.statsCard, {
              opacity: statsAnim,
              transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }]}
            accessibilityRole="summary"
            accessibilityLabel={splashContent.stats.map((s) => `${s.value} ${s.label}`).join(', ')}
          >
            <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
            {splashContent.stats.map((stat, i) => (
              <React.Fragment key={stat.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                {i < splashContent.stats.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </Animated.View>

          {/* Tip chip */}
          <View style={styles.tipChip} accessibilityRole="text" accessibilityLabel={splashContent.tip}>
            <Text style={styles.tipText}>{splashContent.tip}</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressWrap} accessibilityRole="progressbar" accessibilityLabel="Loading your community">
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                <LinearGradient colors={['#ffffff', '#fbcfe8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
            <View style={styles.progressFooter}>
              <View style={styles.dotsRow}>
                {dotsAnim.map((v, i) => (
                  <Animated.View key={i} style={[styles.progressDot, { opacity: v }]} />
                ))}
              </View>
              <Text style={styles.progressText}>Loading your community...</Text>
            </View>
          </View>
        </Animated.View>

        {/* Bottom branding */}
        <View style={[styles.bottomBranding, { bottom: insets.bottom + 24 }]}>
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
  dotsRow: { flexDirection: 'row', gap: 6 },
  loadingDot: { width: 8, height: 8, borderRadius: 4 },

  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },

  auraGlowTopLeft: {
    position: 'absolute', top: -SCREEN_H * 0.25, left: -SCREEN_W * 0.35,
    width: SCREEN_W * 1.3, height: SCREEN_W * 1.3, borderRadius: SCREEN_W * 0.65, opacity: 0.6,
  },
  auraGlowBottomRight: {
    position: 'absolute', bottom: -SCREEN_H * 0.25, right: -SCREEN_W * 0.35,
    width: SCREEN_W * 1.1, height: SCREEN_W * 1.1, borderRadius: SCREEN_W * 0.55, opacity: 0.5,
  },

  floatingIcon1: { position: 'absolute', top: SCREEN_H * 0.16, left: SCREEN_W * 0.12 },
  floatingIcon2: { position: 'absolute', top: SCREEN_H * 0.24, right: SCREEN_W * 0.16 },
  floatingIcon3: { position: 'absolute', bottom: SCREEN_H * 0.2, left: SCREEN_W * 0.1 },

  content: { alignItems: 'center', zIndex: 10, width: '100%', paddingHorizontal: 32 },

  logoWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative' },
  logoGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.25)' },
  logoRing: { position: 'absolute', width: 128, height: 128, borderRadius: 64, overflow: 'hidden', opacity: 0.7 },
  logoInner: {
    width: 106, height: 106, borderRadius: 53, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoImage: { width: 80, height: 80 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  titleEmoji: { fontSize: 26 },
  title: {
    fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center',
    color: '#fff', textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 14, textAlign: 'center', marginBottom: 22, lineHeight: 21,
    paddingHorizontal: 12, fontWeight: '500', color: 'rgba(255,255,255,0.9)',
  },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22, paddingVertical: 14, paddingHorizontal: 22,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  statItem: { alignItems: 'center', minWidth: 66 },
  statNumber: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, marginHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.28)' },

  tipChip: {
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9,
    marginBottom: 22, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)',
  },
  tipText: { fontSize: 12, fontWeight: '600', textAlign: 'center', color: 'rgba(255,255,255,0.92)' },

  progressWrap: { width: '100%', maxWidth: 280, alignItems: 'center' },
  progressTrack: {
    width: '100%', height: 4, borderRadius: 2, overflow: 'hidden',
    marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.22)',
  },
  progressFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
  progressFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#ffffff' },
  progressText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  bottomBranding: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandingText: { fontSize: 14, fontWeight: '800', color: '#fff', opacity: 0.95 },
  brandingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  brandingSubtext: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
});