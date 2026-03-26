import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ShimmerLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  colors?: [string, string, string];
  duration?: number;
  style?: any;
}

export const ShimmerLoader: React.FC<ShimmerLoaderProps> = ({
  width = '100%',
  height = 100,
  borderRadius = 16,
  colors = ['#e2e8f0', '#f1f5f9', '#e2e8f0'],
  duration = 1500,
  style,
}) => {
  const translateX = useSharedValue(-width);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withTiming(width as number, { duration }),
      -1,
      false
    );
  }, [translateX, width, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={[styles.container, { width, height, borderRadius }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }]} />
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

// Preset shimmer layouts
export const ShimmerPresets = {
  Text: ({ width = 200, lines = 1 }: { width?: number; lines?: number }) => (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerLoader key={i} width={width} height={16} borderRadius={8} />
      ))}
    </View>
  ),
  
  Card: ({ height = 120 }: { height?: number }) => (
    <ShimmerLoader width="100%" height={height} borderRadius={20} />
  ),
  
  Circle: ({ size = 60 }: { size?: number }) => (
    <ShimmerLoader width={size} height={size} borderRadius={size / 2} />
  ),
  
  Avatar: ({ size = 80 }: { size?: number }) => (
    <ShimmerLoader width={size} height={size} borderRadius={size / 2} />
  ),
  
  List: ({ count = 3, height = 80 }: { count?: number; height?: number }) => (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerLoader key={i} width="100%" height={height} borderRadius={16} />
      ))}
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default ShimmerLoader;