import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const wp = (p: number) => (SCREEN_WIDTH * p) / 100;

interface SplashScreenProps {
  navigation?: any;
  onAnimationComplete?: () => void;
}

export default function SplashScreen({ navigation, onAnimationComplete }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animations
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

    // Rotating gradient animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Pulsing animation
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

    // Exit animation after delay
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
        // Call the callback or navigate if navigation is available
        if (onAnimationComplete) {
          onAnimationComplete();
        } else if (navigation && navigation.replace) {
          navigation.replace('Onboarding');
        }
        // If neither is available, just let it fade out and the parent will handle it
      });
    }, 3500);

    return () => clearTimeout(timer);
  }, [navigation, onAnimationComplete]);

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
          <Text style={styles.logoEmoji}>🍼</Text>
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
  logoEmoji: {
    fontSize: wp(18),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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