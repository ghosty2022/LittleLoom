import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

interface TimelineSkeletonProps {
  count?: number;
}

const SkeletonItem: React.FC<{
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}> = ({ width: w, height, borderRadius = 8, style }) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        withRepeat(
          withSequence(
            withTiming(0.3, { duration: 800 }),
            withTiming(0.7, { duration: 800 })
          ),
          -1,
          true
        ),
        [0.3, 0.7],
        [0.3, 0.7],
        Extrapolate.CLAMP
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: w, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
};

export const TimelineSkeleton: React.FC<TimelineSkeletonProps> = ({ count = 3 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.item}>
          {/* Date Header */}
          <SkeletonItem width={100} height={20} borderRadius={8} style={{ marginBottom: 16 }} />
          
          {/* Timeline Items */}
          <View style={styles.timelineRow}>
            {/* Time Column */}
            <View style={styles.timeColumn}>
              <SkeletonItem width={50} height={14} borderRadius={6} />
              <SkeletonItem width={2} height={60} borderRadius={1} style={{ marginTop: 8, marginLeft: 20 }} />
            </View>
            
            {/* Event Card */}
            <View style={styles.eventCard}>
              <SkeletonItem width={48} height={48} borderRadius={14} />
              <View style={styles.eventContent}>
                <SkeletonItem width="60%" height={16} borderRadius={6} />
                <SkeletonItem width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
              </View>
            </View>
          </View>
          
          {/* Second item in group */}
          <View style={[styles.timelineRow, { marginTop: 12 }]}>
            <View style={styles.timeColumn}>
              <SkeletonItem width={50} height={14} borderRadius={6} />
              <SkeletonItem width={2} height={60} borderRadius={1} style={{ marginTop: 8, marginLeft: 20 }} />
            </View>
            <View style={styles.eventCard}>
              <SkeletonItem width={48} height={48} borderRadius={14} />
              <View style={styles.eventContent}>
                <SkeletonItem width="70%" height={16} borderRadius={6} />
                <SkeletonItem width="50%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  skeleton: {
    backgroundColor: '#e2e8f0',
  },
  item: {
    marginBottom: 24,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeColumn: {
    width: 70,
    alignItems: 'flex-start',
  },
  eventCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  eventContent: {
    flex: 1,
    marginLeft: 14,
  },
});

export default TimelineSkeleton;