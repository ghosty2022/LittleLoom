import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { 
  useAnimatedProps, 
  withSpring,
  useSharedValue,
  useEffect,
  FadeIn 
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  value: number;
  delay?: number;
}

export const CircularProgress = memo<CircularProgressProps>(({
  progress,
  size = 70,
  strokeWidth = 8,
  color = '#667eea',
  label,
  value,
  delay = 0,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      animatedProgress.value = withSpring(progress / 100, {
        damping: 20,
        stiffness: 90,
      });
    }, delay);
    
    return () => clearTimeout(timer);
  }, [progress, delay]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <Animated.View entering={FadeIn.delay(delay)} style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
      <Text style={styles.valueText}>{value}%</Text>
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
});