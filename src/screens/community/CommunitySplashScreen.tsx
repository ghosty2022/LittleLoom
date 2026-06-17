import React, { useEffect, useRef, useState, useCallback } from 'react';
// import { interpolate } from 'react-native-reanimated';
import { View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar, Platform,
 } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAutoHideNav } from '../../hooks/useAutoHideNav';
import { useCustomization } from '../../hooks/useCustomization';
import { useCommunity } from '../../context/CommunityContext';
import { getSectionState, updateSectionState } from '../../hooks/useIntelligentSplash';
import {
  CommunityColors,
  CommunityGradients,
  CommunityShadows,
  CommunityBorderRadius,
} from '../../theme/CommunityTheme';
const { width, height } = Dimensions.get('window');

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

export default function CommunitySplashScreen({
  onAnimationComplete,
  userName = 'Parent'
}: CommunitySplashScreenProps) {
  useAutoHideNav({ isCommunityScreen: true });

  const { settings, themeColors, shouldReduceMotion } = useCustomization();
  const { currentUser, getSelectedTopics } = useCommunity();

  const [splashContent, setSplashContent] = useState<SplashContent | null>(null);
  const [isReady, setIsReady] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const generateContent = async () => {
      const sectionState = await getSectionState('community');
      const selectedTopics = getSelectedTopics();
      const topicCount = selectedTopics.length;
      const hasTopics = topicCount > 0;

      let content: SplashContent;

      if (sectionState.firstTime) {
        content = {
          emoji: '👋',
          title: `Welcome, ${userName}!`,
          subtitle: 'Discover a supportive community of parents just like you. Share experiences, get advice, and celebrate milestones together.',
          stats: [
            { label: 'Topics', value: '50+' },
            { label: 'Parents', value: '12.5K' },
            { label: 'Countries', value: '80+' },
          ],
          tip: '💡 Select your favorite topics to personalize your feed',
        };
      } else if (!hasTopics) {
        content = {
          emoji: '🎯',
          title: 'Personalize Your Feed',
          subtitle: 'You haven\'t selected any topics yet. Pick what matters to you for a tailored community experience.',
          stats: [
            { label: 'Available', value: '50+' },
            { label: 'Selected', value: '0' },
            { label: 'Trending', value: '12' },
          ],
          tip: '💡 Tap "Get Started" to choose your topics',
        };
      } else if (topicCount < 3) {
        content = {
          emoji: '🌱',
          title: 'Growing Your Community',
          subtitle: `You have ${topicCount} topic${topicCount === 1 ? '' : 's'} selected. Add more to discover even more relevant conversations.`,
          stats: [
            { label: 'Your Topics', value: `${topicCount}` },
            { label: 'New Posts', value: '24' },
            { label: 'Unread', value: '3' },
          ],
          tip: '💡 You can select up to 5 topics for the best experience',
        };
      } else {
        const topicNames = selectedTopics.slice(0, 3).map(t => t.name).join(', ');
        content = {
          emoji: '🌟',
          title: 'Welcome Back!',
          subtitle: `Your communities in ${topicNames}${selectedTopics.length > 3 ? ' & more' : ''} are buzzing with activity.`,
          stats: [
            { label: 'Your Topics', value: `${topicCount}` },
            { label: 'New Posts', value: '24' },
            { label: 'Mentions', value: '2' },
          ],
          tip: '💡 Pull down to refresh your personalized feed',
        };
      }

      setSplashContent(content);
      setIsReady(true);
    };

    generateContent();
  }, [userName, getSelectedTopics]);

  useEffect(() => {
    if (!isReady || !splashContent) return;

    if (settings.hapticFeedback && !shouldReduceMotion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    const entranceAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: shouldReduceMotion ? 200 : 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: shouldReduceMotion ? 100 : 600,
        useNativeDriver: true,
      }),
    ]);

    const rotateAnimation = Animated.loop(
      Animated.timing(iconRotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: shouldReduceMotion ? 500 : 2500,
      useNativeDriver: false,
    });

    const statsEntrance = Animated.timing(statsAnim, {
      toValue: 1,
      duration: shouldReduceMotion ? 200 : 600,
      delay: shouldReduceMotion ? 0 : 400,
      useNativeDriver: true,
    });

    entranceAnimation.start();
    if (!shouldReduceMotion) {
      rotateAnimation.start();
      pulseAnimation.start();
    }
    progressAnimation.start();
    statsEntrance.start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: shouldReduceMotion ? 150 : 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: shouldReduceMotion ? 150 : 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        updateSectionState('community', { firstTime: false });
        onAnimationComplete();
      });
    }, shouldReduceMotion ? 1500 : 2800);

    return () => clearTimeout(timer);
  }, [isReady, splashContent, shouldReduceMotion, settings.hapticFeedback, onAnimationComplete]);

  const spin = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (!isReady || !splashContent) {
    return (
      <View style={[styles.container, { backgroundColor: CommunityColors.background.main }]}>
        <StatusBar barStyle="light-content" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={CommunityGradients.header}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated Background Circles */}
        {!shouldReduceMotion && (
          <>
            <Animated.View
              style={[
                styles.bgCircle,
                { transform: [{ rotate: spin }, { scale: pulseAnim }] }
              ]}
            />
            <Animated.View
              style={[
                styles.bgCircle2,
                { transform: [{ rotate: spin }, { scale: pulseAnim }] }
              ]}
            />
          </>
        )}

        {/* Floating Social Icons */}
        {!shouldReduceMotion && (
          <>
            <Animated.View style={[styles.floatingIcon1, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="heart" size={24} color="rgba(255,255,255,0.3)" />
            </Animated.View>
            <Animated.View style={[styles.floatingIcon2, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="chatbubble" size={20} color="rgba(255,255,255,0.25)" />
            </Animated.View>
            <Animated.View style={[styles.floatingIcon3, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="people" size={28} color="rgba(255,255,255,0.2)" />
            </Animated.View>
          </>
        )}

        {/* Main Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideUpAnim }
              ],
            },
          ]}
        >
          {/* Dynamic Emoji */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.logoRing}
            >
              <View style={styles.logoInner}>
                <Text style={styles.logoEmoji}>{splashContent.emoji}</Text>
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Dynamic Title */}
          <Text style={styles.title}>{splashContent.title}</Text>

          {/* Dynamic Subtitle */}
          <Text style={styles.subtitle}>{splashContent.subtitle}</Text>

          {/* Intelligent Stats */}
          <Animated.View
            style={[
              styles.statsContainer,
              { opacity: statsAnim, transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
            ]}
          >
            {splashContent.stats.map((stat, index) => (
              <React.Fragment key={stat.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                {index < splashContent.stats.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </Animated.View>

          {/* Smart Tip */}
          <View style={styles.tipContainer}>
            <Text style={styles.tipText}>{splashContent.tip}</Text>
          </View>

          {/* Loading Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressWidth }
                ]}
              />
            </View>
            <Text style={styles.progressText}>Loading your community...</Text>
          </View>
        </Animated.View>

        {/* Bottom Branding */}
        <View style={styles.bottomBranding}>
          <Text style={styles.brandingText}>LittleLoom</Text>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingSubtext}>Community</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    borderWidth: 40,
    borderColor: 'rgba(255,255,255,0.05)',
    top: -width * 0.3,
    right: -width * 0.3,
  },
  bgCircle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    borderWidth: 30,
    borderColor: 'rgba(255,255,255,0.03)',
    bottom: -width * 0.2,
    left: -width * 0.2,
  },
  floatingIcon1: {
    position: 'absolute',
    top: height * 0.15,
    left: width * 0.15,
  },
  floatingIcon2: {
    position: 'absolute',
    top: height * 0.25,
    right: width * 0.2,
  },
  floatingIcon3: {
    position: 'absolute',
    bottom: height * 0.2,
    left: width * 0.1,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
    width: '100%',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 32,
    position: 'relative',
  },
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
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  logoInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoEmoji: {
    fontSize: 50,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: CommunityColors.primary,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CommunityColors.success,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },
  tipContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  bottomBranding: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    opacity: 0.9,
  },
  brandingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  brandingSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});
