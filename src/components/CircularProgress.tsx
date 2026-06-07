// src/components/CircularProgress.tsx
import React, { memo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { 
  useAnimatedProps, 
  withSpring, 
  useSharedValue, 
  withTiming,
  FadeIn,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useCustomization } from '../hooks/useCustomization';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  value: number;
  delay?: number;
  showPercentage?: boolean;
  section?: 'main' | 'community' | 'tracking' | 'auth' | 'settings';
  trackColor?: string;
  showGlow?: boolean;
  onComplete?: () => void;
}

export const CircularProgress = memo<CircularProgressProps>(({
  progress,
  size = 70,
  strokeWidth = 8,
  color,
  label,
  value,
  delay = 0,
  showPercentage = true,
  section = 'main',
  trackColor,
  showGlow = true,
  onComplete,
}) => {
  const { themeColors, shouldReduceMotion, isDark } = useCustomization();
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const animatedProgress = useSharedValue(0);

  // 🎨 Smart color resolution with fallbacks
  const progressColor = color || 
    (section === 'main' && themeColors?.primary) || 
    (section === 'community' && '#f5576c') ||
    (section === 'tracking' && '#4facfe') ||
    (section === 'auth' && '#667eea') ||
    (section === 'settings' && '#11998e') ||
    '#667eea';

  const trackBgColor = trackColor || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)');

  // ✅ Fixed: Proper animation with completion callback
  useEffect(() => {
    const targetProgress = Math.min(Math.max(progress, 0), 100) / 100;
    
    const timer = setTimeout(() => {
      if (shouldReduceMotion) {
        animatedProgress.value = targetProgress;
        onComplete?.();
      } else {
        animatedProgress.value = withSpring(targetProgress, {
          damping: 20,
          stiffness: 90,
          mass: 1,
        }, (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [progress, delay, shouldReduceMotion, onComplete]);

  // ✅ Fixed: Animated props for SVG
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  // Glow effect style
  const glowStyle = showGlow ? {
    shadowColor: progressColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  } : {};

  return (
    <Animated.View 
      entering={shouldReduceMotion ? undefined : FadeIn.delay(delay).duration(500)} 
      style={[styles.container, glowStyle]}
    >
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackBgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress Arc */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      
      {showPercentage && (
        <Animated.View style={styles.valueContainer}>
          <Text style={[styles.valueText, { color: progressColor }]}>
            {value}%
          </Text>
        </Animated.View>
      )}
      
      <Text style={[
        styles.label, 
        { color: isDark ? '#94a3b8' : '#64748b' }
      ]}>
        {label}
      </Text>
    </Animated.View>
  );
});

CircularProgress.displayName = 'CircularProgress';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    transform: [{ rotate: '-90deg' }],
  },
  valueContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CircularProgress;