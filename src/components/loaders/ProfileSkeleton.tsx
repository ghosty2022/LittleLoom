
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

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

export const ProfileSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <SkeletonItem width={44} height={44} borderRadius={12} />
        <View style={styles.headerCenter}>
          <SkeletonItem width={140} height={28} borderRadius={8} />
          <SkeletonItem width={100} height={14} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
        <SkeletonItem width={44} height={44} borderRadius={12} />
      </View>

      {/* Profile Card Skeleton */}
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <SkeletonItem width={80} height={80} borderRadius={40} />
          <View style={styles.profileInfo}>
            <SkeletonItem width={120} height={24} borderRadius={8} />
            <SkeletonItem width={80} height={16} borderRadius={6} style={{ marginTop: 8 }} />
            <SkeletonItem width={100} height={14} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <SkeletonItem width={70} height={70} borderRadius={35} />
          <SkeletonItem width={70} height={70} borderRadius={35} />
          <SkeletonItem width={70} height={70} borderRadius={35} />
        </View>

        {/* Milestone Card */}
        <View style={styles.milestoneCard}>
          <SkeletonItem width={48} height={48} borderRadius={12} />
          <View style={styles.milestoneInfo}>
            <SkeletonItem width={100} height={16} borderRadius={6} />
            <SkeletonItem width={140} height={20} borderRadius={8} style={{ marginTop: 6 }} />
            <SkeletonItem width="100%" height={8} borderRadius={4} style={{ marginTop: 10 }} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  skeleton: {
    backgroundColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerCenter: {
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  milestoneInfo: {
    marginLeft: 14,
    flex: 1,
  },
});

export default ProfileSkeleton;



