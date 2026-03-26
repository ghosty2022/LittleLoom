// src/components/UniversalSpinner.tsx
// Modern Glassmorphism Loading Spinner for LittleLoom
// Usage: <UniversalSpinner visible={isLoading} text="Loading..." />

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UniversalSpinnerProps {
  visible: boolean;
  text?: string;
  subtext?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  blur?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const UniversalSpinner: React.FC<UniversalSpinnerProps> = ({
  visible,
  text = 'Loading...',
  subtext,
  size = 'medium',
  overlay = true,
  blur = true,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Continuous rotation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, rotateAnim, pulseAnim, fadeAnim]);

  const getSize = () => {
    switch (size) {
      case 'small': return { container: 100, spinner: 40, stroke: 3 };
      case 'large': return { container: 180, spinner: 80, stroke: 5 };
      default: return { container: 140, spinner: 60, stroke: 4 };
    }
  };

  const dimensions = getSize();

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  const Spinner = () => (
    <Animated.View 
      style={[
        styles.spinnerContainer,
        { 
          width: dimensions.container,
          height: dimensions.container,
          opacity: fadeAnim,
          transform: [{ scale: pulseAnim }],
        },
        isDark && styles.spinnerContainerDark
      ]}
    >
      {/* Glassmorphism background */}
      <BlurView 
        intensity={isDark ? 60 : 90} 
        style={StyleSheet.absoluteFill} 
        tint={isDark ? 'dark' : 'light'}
      />
      <ExpoLinearGradient
        colors={isDark 
          ? ['rgba(50,50,50,0.8)', 'rgba(30,30,30,0.6)']
          : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']
        }
        style={[StyleSheet.absoluteFill, { borderRadius: dimensions.container / 2 }]}
      />

      {/* Animated Spinner */}
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={dimensions.spinner} height={dimensions.spinner} viewBox="0 0 60 60">
          <Defs>
            <LinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#667eea" />
              <Stop offset="100%" stopColor="#764ba2" />
            </LinearGradient>
          </Defs>
          
          {/* Background circle */}
          <Circle
            cx="30"
            cy="30"
            r="26"
            stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
            strokeWidth={dimensions.stroke}
            fill="none"
          />
          {/* Animated arc */}
          <AnimatedCircle
            cx="30"
            cy="30"
            r="26"
            stroke="url(#gradient)"
            strokeWidth={dimensions.stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="120"
            strokeDashoffset="60"
          />
        </Svg>
      </Animated.View>

      {/* Text */}
      {text && (
        <Text style={[styles.text, isDark && styles.textDark]} numberOfLines={1}>
          {text}
        </Text>
      )}
      {subtext && (
        <Text style={[styles.subtext, isDark && styles.subtextDark]} numberOfLines={2}>
          {subtext}
        </Text>
      )}
    </Animated.View>
  );

  if (overlay) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          {blur && (
            <BlurView 
              intensity={isDark ? 80 : 90} 
              style={StyleSheet.absoluteFill} 
              tint={isDark ? 'dark' : 'light'}
            />
          )}
          <Spinner />
        </View>
      </Modal>
    );
  }

  return <Spinner />;
};

// Inline spinner for buttons/inputs
export const InlineSpinner: React.FC<{ size?: number; color?: string }> = ({ 
  size = 20, 
  color = '#667eea' 
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ).start();
  }, [rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="30"
          strokeDashoffset="10"
        />
      </Svg>
    </Animated.View>
  );
};

// Skeleton loader component
export const SkeletonLoader: React.FC<{ 
  width?: number | string; 
  height?: number; 
  borderRadius?: number;
  style?: any;
}> = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  style 
}) => {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? '#333' : '#e2e8f0',
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  spinnerContainer: {
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  spinnerContainerDark: {
    shadowColor: '#000',
  },
  text: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  textDark: {
    color: '#ffffff',
  },
  subtext: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  subtextDark: {
    color: '#a0a0a0',
  },
});

export default UniversalSpinner;