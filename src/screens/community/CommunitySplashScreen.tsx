
import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CommunityGradients, CommunityColors, CommunityTypography } from '../../theme/CommunityTheme';

const { width, height } = Dimensions.get('window');

interface CommunitySplashScreenProps {
  onAnimationComplete: () => void;
  userName?: string;
}

export default function CommunitySplashScreen({ 
  onAnimationComplete, 
  userName = 'Parent' 
}: CommunitySplashScreenProps) {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trigger haptic feedback for engagement
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Entrance animations
    const entranceAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
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
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    // Icon rotation
    const rotateAnimation = Animated.loop(
      Animated.timing(iconRotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    );

    // Pulse animation for social icons
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

    // Progress bar animation
    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: false,
    });

    // Run animations
    entranceAnimation.start();
    rotateAnimation.start();
    pulseAnimation.start();
    progressAnimation.start();

    // Exit animation
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationComplete();
      });
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const spin = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Gradient - Sunset Social Theme */}
      <LinearGradient 
        colors={CommunityGradients.header}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated Background Circles */}
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

        {/* Floating Social Icons */}
        <Animated.View style={[styles.floatingIcon1, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="heart" size={24} color="rgba(255,255,255,0.3)" />
        </Animated.View>
        <Animated.View style={[styles.floatingIcon2, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="chatbubble" size={20} color="rgba(255,255,255,0.25)" />
        </Animated.View>
        <Animated.View style={[styles.floatingIcon3, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="people" size={28} color="rgba(255,255,255,0.2)" />
        </Animated.View>

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
          {/* Community Logo Container */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.logoRing}
            >
              <View style={styles.logoInner}>
                <Text style={styles.logoEmoji}>👥</Text>
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                </View>
              </View>
            </LinearGradient>
            
            {/* Connection Lines */}
            <View style={styles.connectionLines}>
              <View style={styles.line1} />
              <View style={styles.line2} />
              <View style={styles.line3} />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Community</Text>
          
          {/* Subtitle with user name */}
          <Text style={styles.subtitle}>
            Welcome back, {userName}!
          </Text>
          
          <Text style={styles.description}>
            Connect with parents worldwide
          </Text>

          {/* Stats Preview */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>12.5K</Text>
              <Text style={styles.statLabel}>Parents</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>2.4K</Text>
              <Text style={styles.statLabel}>Online</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>856</Text>
              <Text style={styles.statLabel}>Topics</Text>
            </View>
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
            <Text style={styles.progressText}>Loading your feed...</Text>
          </View>
        </Animated.View>

        {/* Bottom Branding */}
        <View style={styles.bottomBranding}>
          <Text style={styles.brandingText}>LittleLoom</Text>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingSubtext}>Social</Text>
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
  connectionLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line1: {
    position: 'absolute',
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ rotate: '45deg' }],
    left: -20,
    top: 30,
  },
  line2: {
    position: 'absolute',
    width: 30,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ rotate: '-30deg' }],
    right: -10,
    top: 50,
  },
  line3: {
    position: 'absolute',
    width: 25,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ rotate: '60deg' }],
    right: 0,
    bottom: 30,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    opacity: 0.95,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 32,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 40,
    backdropFilter: 'blur(10px)',
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
