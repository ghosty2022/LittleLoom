import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const wp = (p: number) => (SCREEN_W * p) / 100;

const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  white: '#ffffff',
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 40, elevation: 12 },
  },
};

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
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const dotsAnim = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  const checkOnboardingAndNavigate = useCallback(async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      if (hasSeenOnboarding === 'true') {
        if (onNavigateToLogin) onNavigateToLogin();
        else if (navigation?.replace) navigation.replace('Login');
      } else {
        if (onNavigateToOnboarding) onNavigateToOnboarding();
        else if (navigation?.replace) navigation.replace('Onboarding');
      }
    } catch {
      if (onNavigateToLogin) onNavigateToLogin();
      else if (navigation?.replace) navigation.replace('Login');
    }
  }, [navigation, onNavigateToOnboarding, onNavigateToLogin]);

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    // Aura ring rotation
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 12000, useNativeDriver: true }),
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.9, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ]),
    ).start();

    // Icon pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]),
    ).start();

    // Logo float
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    ).start();

    // Bottom dots shimmer loop
    const shimmer = Animated.loop(
      Animated.stagger(220, [
        Animated.sequence([
          Animated.timing(dotsAnim[0], { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dotsAnim[0], { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotsAnim[1], { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dotsAnim[1], { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotsAnim[2], { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dotsAnim[2], { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ]),
      ]),
    );
    shimmer.start();

    // Light haptic on appearance
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const timer = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.06, duration: 380, useNativeDriver: true }),
      ]).start(() => {
        if (onAnimationComplete) onAnimationComplete();
        else checkOnboardingAndNavigate();
      });
    }, 2600);

    return () => {
      clearTimeout(timer);
      shimmer.stop();
    };
  }, [navigation, onAnimationComplete, checkOnboardingAndNavigate, fadeAnim, scaleAnim, slideAnim, rotateAnim, pulseAnim, floatAnim, glowAnim, dotsAnim]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Aura glows */}
      <LinearGradient
        colors={['rgba(255,255,255,0.28)', 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.20)', 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Floating background icons */}
      <Animated.View style={[styles.floatingIcon1, { transform: [{ scale: pulseAnim }] }]} pointerEvents="none">
        <Ionicons name="heart" size={20} color="rgba(255,255,255,0.32)" />
      </Animated.View>
      <Animated.View style={[styles.floatingIcon2, { transform: [{ scale: pulseAnim }] }]} pointerEvents="none">
        <Ionicons name="sparkles" size={18} color="rgba(255,255,255,0.26)" />
      </Animated.View>
      <Animated.View style={[styles.floatingIcon3, { transform: [{ scale: pulseAnim }] }]} pointerEvents="none">
        <Ionicons name="star" size={16} color="rgba(255,255,255,0.2)" />
      </Animated.View>

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: slideAnim }] },
        ]}
      >
        {/* Pulsing logo with aura ring */}
        <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
          <View style={styles.logoWrap}>
            <Animated.View style={[styles.logoGlow, { opacity: glowAnim, transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.logoRing, { transform: [{ rotate: spin }] }]}>
              <LinearGradient
                colors={['#ffffff', '#fbcfe8', '#ffffff', '#c7d2fe', '#ffffff']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <View style={styles.logoInner}>
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Animated.View>

        {/* Brand */}
        <Text style={styles.brandName}>LittleLoom</Text>

        <View style={styles.taglineChip}>
          <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.9)" />
          <Text style={styles.tagline}>Little Threads. Big Memories.</Text>
        </View>

        {/* Loading shimmer dots */}
        <View style={styles.dotsRow}>
          {dotsAnim.map((v, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.2] }) }] }]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Footer credit */}
      <Animated.View style={[styles.footer, { bottom: insets.bottom + 32, opacity: fadeAnim }]}>
        <Text style={styles.footerText}>
          Crafted with <Text style={{ color: '#ff6b81' }}>♥</Text> by Refresh
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  auraGlowTopLeft: {
    position: 'absolute', top: -SCREEN_H * 0.25, left: -SCREEN_W * 0.35,
    width: SCREEN_W * 1.3, height: SCREEN_W * 1.3, borderRadius: SCREEN_W * 0.65, opacity: 0.6,
  },
  auraGlowBottomRight: {
    position: 'absolute', bottom: -SCREEN_H * 0.25, right: -SCREEN_W * 0.35,
    width: SCREEN_W * 1.1, height: SCREEN_W * 1.1, borderRadius: SCREEN_W * 0.55, opacity: 0.5,
  },

  floatingIcon1: { position: 'absolute', top: SCREEN_H * 0.16, left: SCREEN_W * 0.14 },
  floatingIcon2: { position: 'absolute', top: SCREEN_H * 0.22, right: SCREEN_W * 0.18 },
  floatingIcon3: { position: 'absolute', bottom: SCREEN_H * 0.24, left: SCREEN_W * 0.2 },

  content: { alignItems: 'center', zIndex: 10, paddingHorizontal: 32 },

  logoWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 28, position: 'relative' },
  logoGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.25)' },
  logoRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, overflow: 'hidden', opacity: 0.7 },
  logoInner: {
    width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoImage: { width: 88, height: 88 },

  brandName: {
    fontSize: wp(9.5), fontWeight: '900', color: DS.white,
    letterSpacing: 2, marginBottom: 10, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },

  taglineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 32,
  },
  tagline: { fontSize: wp(3.6), color: 'rgba(255,255,255,0.95)', fontWeight: '600', letterSpacing: 0.4 },

  dotsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: DS.white },

  footer: { position: 'absolute', alignItems: 'center' },
  footerText: { fontSize: wp(3.2), color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 0.4 },
});