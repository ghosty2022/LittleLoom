
import React, { useEffect, useRef, useCallback } from 'react';
import { interpolate } from 'react-native-reanimated';
import { View,
  Text,
  StyleSheet, Dimensions,
  Image,
 } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const wp = (p: number) => (SCREEN_WIDTH * p) / 100;

const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

interface SplashScreenProps {
  navigation?: any;
  onAnimationComplete?: () => void;
  onNavigateToOnboarding?: () => void;
  onNavigateToLogin?: () => void;
}

export default function SplashScreen({
  navigation,
  onAnimationComplete,
  onNavigateToOnboarding,
  onNavigateToLogin,
}: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const checkOnboardingAndNavigate = useCallback(async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);

      if (hasSeenOnboarding === 'true') {
        if (onNavigateToLogin) {
          onNavigateToLogin();
        } else if (navigation?.replace) {
          navigation.replace('Login');
        }
      } else {
        if (onNavigateToOnboarding) {
          onNavigateToOnboarding();
        } else if (navigation?.replace) {
          navigation.replace('Onboarding');
        }
      }
    } catch (error) {
      console.warn('Error checking onboarding status:', error);
      if (onNavigateToLogin) {
        onNavigateToLogin();
      } else if (navigation?.replace) {
        navigation.replace('Login');
      }
    }
  }, [navigation, onNavigateToOnboarding, onNavigateToLogin]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        } else {
          checkOnboardingAndNavigate();
        }
      });
    }, 3500);

    return () => clearTimeout(timer);
  }, [navigation, onAnimationComplete, checkOnboardingAndNavigate]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar style="light" />

      {/* Animated background circles */}
      <Animated.View
        style={[
          styles.gradientCircle,
          { transform: [{ rotate: spin }, { scale: pulseAnim }] }
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.15)', 'transparent']}
          style={styles.circleGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ],
          },
        ]}
      >
        {/* Logo Container */}
        <View style={styles.logoContainer}>
          <View style={styles.logoRing}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.logoRingGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Brand Name */}
        <Text style={styles.brandName}>LittleLoom</Text>
        <Text style={styles.tagline}>Gentle Care, Happy Baby</Text>

        {/* TPM Solutions Credit */}
        <View style={styles.developerContainer}>
          <View style={styles.developerLine} />
          <Text style={styles.developerText}>by TPM Solutions</Text>
          <View style={styles.developerLine} />
        </View>
      </Animated.View>

      {/* Bottom decorative elements */}
      <View style={styles.bottomDecor}>
        <View style={[styles.dot, styles.dot1]} />
        <View style={[styles.dot, styles.dot2]} />
        <View style={[styles.dot, styles.dot3]} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientCircle: {
    position: 'absolute',
    width: wp(120),
    height: wp(120),
    borderRadius: wp(60),
  },
  circleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: wp(60),
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    width: wp(35),
    height: wp(35),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  logoRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: wp(17.5),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  logoRingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: wp(17.5),
  },
  logoImage: {
    width: wp(20),
    height: wp(20),
    zIndex: 10,
  },
  brandName: {
    fontSize: wp(9),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: wp(4),
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginBottom: 40,
    letterSpacing: 1,
  },
  developerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  developerLine: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  developerText: {
    fontSize: wp(3),
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bottomDecor: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dot1: {
    opacity: 1,
    transform: [{ scale: 1.2 }],
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.3,
  },
});
