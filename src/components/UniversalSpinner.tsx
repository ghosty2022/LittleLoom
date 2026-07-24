import React, { memo, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  useColorScheme,
  Animated as RNAnimated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  interpolate,
  Extrapolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useCustomization } from '../hooks/useCustomization';

// ─── FIX #1: Remove unused Dimensions ───────────────────────────────────

export type SpinnerSection = 'main' | 'community' | 'auth' | 'settings' | 'tracking';

interface SectionTheme {
  colors: [string, string, string, string];
  spinnerColor: string;
  textColor: string;
  subtextColor: string;
  backgroundOpacity: number;
}

const SECTION_THEMES: Record<SpinnerSection, SectionTheme> = {
  main: {
    colors: ['#667eea', '#764ba2', '#f093fb', '#4facfe'],
    spinnerColor: '#667eea',
    textColor: '#1a1a1a',
    subtextColor: '#64748b',
    backgroundOpacity: 0.3,
  },
  community: {
    colors: ['#f093fb', '#f5576c', '#ffecd2', '#fcb69f'],
    spinnerColor: '#f5576c',
    textColor: '#1a1a1a',
    subtextColor: '#64748b',
    backgroundOpacity: 0.3,
  },
  auth: {
    colors: ['#667eea', '#764ba2', '#43e97b', '#38f9d7'],
    spinnerColor: '#667eea',
    textColor: '#fff',
    subtextColor: 'rgba(255,255,255,0.8)',
    backgroundOpacity: 0.5,
  },
  settings: {
    colors: ['#11998e', '#38ef7d', '#0fd850', '#f9f047'],
    spinnerColor: '#11998e',
    textColor: '#1a1a1a',
    subtextColor: '#64748b',
    backgroundOpacity: 0.3,
  },
  tracking: {
    colors: ['#4facfe', '#00f2fe', '#43e97b', '#fa709a'],
    spinnerColor: '#4facfe',
    textColor: '#1a1a1a',
    subtextColor: '#64748b',
    backgroundOpacity: 0.3,
  },
};

interface ThemeColorsSafe {
  colors?: string[];
  spinnerColor?: string;
  [key: string]: any;
}

// ─── FIX #2: Safe customization hook, replaces all try/catch blocks ─────
const useCustomizationSafe = () => {
  try {
    const c = useCustomization();
    return {
      themeColors: c?.themeColors ?? null,
      shouldReduceMotion: c?.shouldReduceMotion ?? false,
      error: false,
    };
  } catch {
    return { themeColors: null, shouldReduceMotion: false, error: true };
  }
};

const resolveTheme = (
  section: SpinnerSection,
  customColors?: [string, string, string, string],
  themeColors?: ThemeColorsSafe
): SectionTheme => {
  const base = SECTION_THEMES[section] || SECTION_THEMES.main;

  if (customColors && customColors.length >= 2) {
    return { ...base, colors: customColors, spinnerColor: customColors[0] };
  }

  if (section === 'main' && themeColors) {
    const safeColors = Array.isArray(themeColors.colors)
      ? themeColors.colors
      : base.colors;
    return {
      ...base,
      colors: safeColors.slice(0, 4).concat(base.colors).slice(0, 4) as [string, string, string, string],
      spinnerColor: themeColors.spinnerColor || base.spinnerColor,
    };
  }

  return base;
};

// ─── FIX #3: Static size lookup, no function call per render ────────────
const SIZE_MAP = {
  small: { spinner: 40, fontSize: 13, container: 100 },
  medium: { spinner: 56, fontSize: 15, container: 140 },
  large: { spinner: 72, fontSize: 17, container: 180 },
};

// ─── FIX #4: Static variant → component map ─────────────────────────────
const VARIANT_MAP = {
  liquid: 'LiquidDots',
  aurora: 'AuroraRings',
  nebula: 'NebulaOrbit',
} as const;

// ─── ANIMATED SUB-COMPONENTS (memoized) ────────────────────────────────

interface LiquidDotProps {
  index: number;
  totalDots: number;
  progress: AnimatedReanimated.SharedValue<number>;
  colors: [string, string, string, string];
  size: number;
}

const LiquidDot = memo<LiquidDotProps>(({ index, totalDots, progress, colors, size }) => {
  const offset = index / totalDots;
  const color = colors[index % colors.length];

  const dotStyle = useAnimatedStyle(() => {
    const angle = (progress.value + offset) * Math.PI * 2;
    const radius = size * 0.32;
    const x = Math.cos(angle * 1.3) * radius;
    const y = Math.sin(angle * 0.9) * radius * 0.7;
    const scale = interpolate(
      progress.value,
      [0, 0.25, 0.5, 0.75, 1],
      [0.5, 1.3, 0.7, 1.2, 0.5],
      Extrapolate.CLAMP
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.2, 0.5, 0.8, 1],
      [0.3, 1, 0.6, 1, 0.3],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity,
    };
  });

  return (
    <AnimatedReanimated.View
      style={[
        styles.liquidDot,
        {
          backgroundColor: color,
          width: size * 0.18,
          height: size * 0.18,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
        },
        dotStyle,
      ]}
    />
  );
});

const LiquidDots = memo<{
  colors: [string, string, string, string];
  size?: number;
}>(({ colors, size = 60 }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
    return () => cancelAnimation(progress);
  }, []);

  return (
    <View style={[styles.liquidDotsContainer, { width: size, height: size }]}>
      {Array.from({ length: 5 }, (_, i) => (
        <LiquidDot
          key={i}
          index={i}
          totalDots={5}
          progress={progress}
          colors={colors}
          size={size}
        />
      ))}
    </View>
  );
});

const AuroraRing = memo<{ color: string; size: number; delay: number }>(({ color, size, delay }) => {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = delay;
    anim.value = withRepeat(
      withTiming(1 + delay, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    return () => cancelAnimation(anim);
  }, [delay]);

  const ringStyle = useAnimatedStyle(() => {
    const n = anim.value % 1;
    return {
      transform: [{ scale: interpolate(n, [0, 1], [0.2, 1.6], Extrapolate.CLAMP) }],
      opacity: interpolate(n, [0, 0.3, 0.7, 1], [0, 0.7, 0.5, 0], Extrapolate.CLAMP),
      borderWidth: interpolate(n, [0, 0.5, 1], [4, 2, 0.5], Extrapolate.CLAMP),
    };
  });

  return (
    <AnimatedReanimated.View
      style={[
        styles.pulseRing,
        {
          borderColor: color,
          width: size,
          height: size,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        },
        ringStyle,
      ]}
    />
  );
});

const AuroraRings = memo<{
  colors: [string, string, string, string];
  size?: number;
}>(({ colors, size = 56 }) => (
  <View style={[styles.pulseContainer, { width: size, height: size }]}>
    {colors.map((color, i) => (
      <AuroraRing key={i} color={color} size={size} delay={i * 0.25} />
    ))}
    <View style={[styles.pulseCenter, { backgroundColor: colors[0] + '30', width: size * 0.2, height: size * 0.2 }]} />
  </View>
));

const NebulaDot = memo<{
  angle: number;
  color: string;
  size: number;
  orbitRadius: number;
  dotSize: number;
  pulse: AnimatedReanimated.SharedValue<number>;
}>(({ angle, color, size, orbitRadius, dotSize, pulse }) => {
  const rad = (angle * Math.PI) / 180;
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View
      style={{
        position: 'absolute',
        left: size / 2 + Math.cos(rad) * orbitRadius - dotSize / 2,
        top: size / 2 + Math.sin(rad) * orbitRadius - dotSize / 2,
      }}
    >
      <AnimatedReanimated.View
        style={[
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 6,
          },
          dotStyle,
        ]}
      />
    </View>
  );
});

const NebulaOrbit = memo<{
  colors: [string, string, string, string];
  size?: number;
}>(({ colors, size = 56 }) => {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 700 }),
        withTiming(0.85, { duration: 700 })
      ),
      -1,
      true
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(pulse);
    };
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const orbitRadius = size * 0.36;
  const dotSize = size * 0.16;
  const angles = [0, 90, 180, 270];

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <AnimatedReanimated.View style={[containerStyle, { width: size, height: size }]}>
        {angles.map((angle, i) => (
          <NebulaDot
            key={i}
            angle={angle}
            color={colors[i % colors.length]}
            size={size}
            orbitRadius={orbitRadius}
            dotSize={dotSize}
            pulse={pulse}
          />
        ))}
      </AnimatedReanimated.View>
      <View style={[styles.orbitCenter, { backgroundColor: colors[0] + '50', width: dotSize * 1.4, height: dotSize * 1.4 }]} />
    </View>
  );
});

// ─── FIX #5: Static component registry ──────────────────────────────────
const SPINNER_COMPONENTS = {
  liquid: LiquidDots,
  aurora: AuroraRings,
  nebula: NebulaOrbit,
};

// ─── MAIN SPINNER (memoized) ───────────────────────────────────────────

interface UniversalSpinnerProps {
  visible: boolean;
  text?: string;
  subtext?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  blur?: boolean;
  section?: SpinnerSection;
  customColors?: [string, string, string, string];
  showProgress?: boolean;
  progress?: number;
  variant?: keyof typeof SPINNER_COMPONENTS;
}

export const UniversalSpinner = memo<UniversalSpinnerProps>(({
  visible,
  text = 'Loading...',
  subtext,
  size = 'medium',
  overlay = true,
  blur = true,
  section = 'main',
  customColors,
  showProgress = false,
  progress = 0,
  variant = 'liquid',
}) => {
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const { themeColors, shouldReduceMotion } = useCustomizationSafe();

  // ─── FIX #6: Stable Animated.Value, lazy init ────────────────────────
  const fadeAnim = useRef<RNAnimated.Value | null>(null);
  if (!fadeAnim.current) fadeAnim.current = new RNAnimated.Value(0);

  const progressAnim = useRef<RNAnimated.Value | null>(null);
  if (!progressAnim.current) progressAnim.current = new RNAnimated.Value(0);

  const theme = useMemo(
    () => resolveTheme(section, customColors, themeColors || undefined),
    [section, customColors, themeColors]
  );

  // ─── FIX #7: Batch animation, no staggered effects ───────────────────
  useEffect(() => {
    const duration = shouldReduceMotion ? (visible ? 100 : 50) : (visible ? 200 : 150);
    RNAnimated.timing(fadeAnim.current!, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [visible, shouldReduceMotion]);

  useEffect(() => {
    if (!showProgress) return;
    RNAnimated.timing(progressAnim.current!, {
      toValue: Math.max(0, Math.min(1, progress / 100)),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, showProgress]);

  if (!visible) return null;

  const dimensions = SIZE_MAP[size];
  const SpinnerComponent = SPINNER_COMPONENTS[variant];

  const progressWidth = progressAnim.current!.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const darkOverlay = isDark
    ? ['rgba(50,50,50,0.8)', 'rgba(30,30,30,0.6)']
    : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)'];

  const spinnerContent = (
    <RNAnimated.View
      style={[
        styles.spinnerContainer,
        {
          width: dimensions.container,
          height: dimensions.container,
          opacity: fadeAnim.current!,
          borderRadius: dimensions.container / 2,
        },
      ]}
    >
      <BlurView intensity={isDark ? 60 : 90} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <ExpoLinearGradient colors={darkOverlay} style={[StyleSheet.absoluteFill, { borderRadius: dimensions.container / 2 }]} />
      <SpinnerComponent colors={theme.colors} size={dimensions.spinner} />
      {text && (
        <Text style={[styles.text, { fontSize: dimensions.fontSize, color: isDark ? '#fff' : theme.textColor }]} numberOfLines={1}>
          {text}
        </Text>
      )}
      {subtext && (
        <Text style={[styles.subtext, { color: isDark ? '#a0a0a0' : theme.subtextColor }]} numberOfLines={2}>
          {subtext}
        </Text>
      )}
      {showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <RNAnimated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: theme.spinnerColor }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.subtextColor }]}>
            {Math.round(Math.max(0, Math.min(100, progress)))}%
          </Text>
        </View>
      )}
    </RNAnimated.View>
  );

  if (!overlay) return spinnerContent;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: `rgba(0,0,0,${theme.backgroundOpacity})` }]}>
        {blur && <BlurView intensity={isDark ? 80 : 90} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />}
        {spinnerContent}
      </View>
    </Modal>
  );
});

// ─── INLINE SPINNER (memoized) ─────────────────────────────────────────

interface InlineSpinnerProps {
  size?: number;
  color?: string;
  section?: SpinnerSection;
  variant?: keyof typeof SPINNER_COMPONENTS;
}

export const InlineSpinner = memo<InlineSpinnerProps>(({
  size = 20,
  color,
  section = 'main',
  variant = 'liquid',
}) => {
  const { themeColors, shouldReduceMotion } = useCustomizationSafe();

  // ─── FIX #8: Direct lookup, no useMemo overhead ─────────────────────
  const spinnerColor = color
    || (section === 'main' && themeColors?.spinnerColor)
    || SECTION_THEMES[section]?.spinnerColor
    || SECTION_THEMES.main.spinnerColor;

  const colors: [string, string, string, string] = (section === 'main' && themeColors?.colors && Array.isArray(themeColors.colors))
    ? [themeColors.colors[0] || spinnerColor, themeColors.colors[1] || spinnerColor, themeColors.colors[2] || spinnerColor, spinnerColor]
    : (SECTION_THEMES[section]?.colors || SECTION_THEMES.main.colors);

  const SpinnerComponent = SPINNER_COMPONENTS[variant];

  if (shouldReduceMotion) {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <View style={[styles.staticDot, { backgroundColor: spinnerColor, width: size * 0.4, height: size * 0.4 }]} />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <SpinnerComponent colors={colors} size={size} />
    </View>
  );
});

// ─── SECTION SPINNERS (memoized wrappers) ─────────────────────────────

export const CommunitySpinner = memo<Omit<UniversalSpinnerProps, 'section'>>((props) => (
  <UniversalSpinner {...props} section="community" />
));

export const AuthSpinner = memo<Omit<UniversalSpinnerProps, 'section'>>((props) => (
  <UniversalSpinner {...props} section="auth" />
));

export const SettingsSpinner = memo<Omit<UniversalSpinnerProps, 'section'>>((props) => (
  <UniversalSpinner {...props} section="settings" />
));

export const TrackingSpinner = memo<Omit<UniversalSpinnerProps, 'section'>>((props) => (
  <UniversalSpinner {...props} section="tracking" />
));

// ─── SKELETON LOADER (memoized) ───────────────────────────────────────

export const SkeletonLoader = memo<{
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}>(({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const pulseAnim = useRef<RNAnimated.Value | null>(null);
  if (!pulseAnim.current) pulseAnim.current = new RNAnimated.Value(0.5);

  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');
  const { shouldReduceMotion } = useCustomizationSafe();

  useEffect(() => {
    if (shouldReduceMotion) return;
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim.current!, { toValue: 1, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim.current!, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shouldReduceMotion]);

  return (
    <RNAnimated.View
      style={[
        { width, height, borderRadius, backgroundColor: isDark ? '#333' : '#e2e8f0', opacity: shouldReduceMotion ? 0.7 : pulseAnim.current! },
        style,
      ]}
    />
  );
});

// ─── SHIMMER LOADER (memoized) ────────────────────────────────────────

interface ShimmerLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  colors?: [string, string, string];
  duration?: number;
  style?: any;
  section?: SpinnerSection;
}

export const ShimmerLoader = memo<ShimmerLoaderProps>(({
  width = '100%',
  height = 100,
  borderRadius = 16,
  colors,
  duration = 1500,
  style,
  section = 'main',
}) => {
  const { themeColors, shouldReduceMotion } = useCustomizationSafe();

  const numericWidth = typeof width === 'number' ? width : 300;
  const translateX = useSharedValue(-numericWidth);

  const shimmerColors = useMemo(() => {
    if (colors && colors.length >= 3) return colors;
    if (section === 'main' && themeColors?.colors && themeColors.colors.length >= 2) {
      return [themeColors.colors[0], themeColors.colors[1], themeColors.colors[0]] as [string, string, string];
    }
    const base = SECTION_THEMES[section]?.colors || SECTION_THEMES.main.colors;
    return [base[0], base[1], base[0]] as [string, string, string];
  }, [colors, section, themeColors]);

  useEffect(() => {
    if (shouldReduceMotion) return;
    translateX.value = withRepeat(withTiming(numericWidth, { duration }), -1, false);
    return () => cancelAnimation(translateX);
  }, [translateX, numericWidth, duration, shouldReduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.shimmerContainer, { width, height, borderRadius }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: shimmerColors[0] }]} />
      {!shouldReduceMotion && (
        <AnimatedReanimated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <ExpoLinearGradient colors={shimmerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </AnimatedReanimated.View>
      )}
    </View>
  );
});

// ─── FIX #9: Memoized preset components, not inline arrow functions ────

const ShimmerText = memo<{ width?: number; lines?: number; section?: SpinnerSection }>(({ width = 200, lines = 1, section = 'main' }) => (
  <View style={{ gap: 8 }}>
    {Array.from({ length: lines }, (_, i) => (
      <ShimmerLoader key={i} width={width} height={16} borderRadius={8} section={section} />
    ))}
  </View>
));

const ShimmerCard = memo<{ height?: number; section?: SpinnerSection }>(({ height = 120, section = 'main' }) => (
  <ShimmerLoader width="100%" height={height} borderRadius={20} section={section} />
));

const ShimmerCircle = memo<{ size?: number; section?: SpinnerSection }>(({ size = 60, section = 'main' }) => (
  <ShimmerLoader width={size} height={size} borderRadius={size / 2} section={section} />
));

const ShimmerAvatar = memo<{ size?: number; section?: SpinnerSection }>(({ size = 80, section = 'main' }) => (
  <ShimmerLoader width={size} height={size} borderRadius={size / 2} section={section} />
));

const ShimmerList = memo<{ count?: number; height?: number; section?: SpinnerSection }>(({ count = 3, height = 80, section = 'main' }) => (
  <View style={{ gap: 12 }}>
    {Array.from({ length: count }, (_, i) => (
      <ShimmerLoader key={i} width="100%" height={height} borderRadius={16} section={section} />
    ))}
  </View>
));

export const ShimmerPresets = {
  Text: ShimmerText,
  Card: ShimmerCard,
  Circle: ShimmerCircle,
  Avatar: ShimmerAvatar,
  List: ShimmerList,
};

// ─── SCREEN SKELETONS (memoized) ──────────────────────────────────────

const TimelineSkeleton = memo<{ count?: number; section?: SpinnerSection }>(({ count = 3, section = 'main' }) => (
  <View style={skeletonStyles.container}>
    {Array.from({ length: count }, (_, index) => (
      <View key={index} style={skeletonStyles.item}>
        <SkeletonLoader width={100} height={20} borderRadius={8} style={{ marginBottom: 16 }} />
        <View style={skeletonStyles.timelineRow}>
          <View style={skeletonStyles.timeColumn}>
            <SkeletonLoader width={50} height={14} borderRadius={6} />
            <SkeletonLoader width={2} height={60} borderRadius={1} style={{ marginTop: 8, marginLeft: 20 }} />
          </View>
          <View style={skeletonStyles.eventCard}>
            <SkeletonLoader width={48} height={48} borderRadius={14} />
            <View style={skeletonStyles.eventContent}>
              <SkeletonLoader width="60%" height={16} borderRadius={6} />
              <SkeletonLoader width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          </View>
        </View>
      </View>
    ))}
  </View>
));

const ProfileSkeleton = memo<{ section?: SpinnerSection }>(({ section = 'main' }) => (
  <View style={skeletonStyles.container}>
    <View style={skeletonStyles.header}>
      <SkeletonLoader width={44} height={44} borderRadius={12} />
      <View style={skeletonStyles.headerCenter}>
        <SkeletonLoader width={140} height={28} borderRadius={8} />
        <SkeletonLoader width={100} height={14} borderRadius={6} style={{ marginTop: 6 }} />
      </View>
      <SkeletonLoader width={44} height={44} borderRadius={12} />
    </View>
    <View style={skeletonStyles.profileCard}>
      <View style={skeletonStyles.profileHeader}>
        <ShimmerLoader width={80} height={80} borderRadius={40} section={section} />
        <View style={skeletonStyles.profileInfo}>
          <SkeletonLoader width={120} height={24} borderRadius={8} />
          <SkeletonLoader width={80} height={16} borderRadius={6} style={{ marginTop: 8 }} />
          <SkeletonLoader width={100} height={14} borderRadius={6} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={skeletonStyles.statsRow}>
        <ShimmerLoader width={70} height={70} borderRadius={35} section={section} />
        <ShimmerLoader width={70} height={70} borderRadius={35} section={section} />
        <ShimmerLoader width={70} height={70} borderRadius={35} section={section} />
      </View>
    </View>
  </View>
));

const CommunitySkeleton = memo(() => (
  <View style={skeletonStyles.container}>
    <View style={skeletonStyles.header}>
      <ShimmerLoader width={120} height={28} borderRadius={8} section="community" />
      <ShimmerLoader width={44} height={44} borderRadius={22} section="community" />
    </View>
    <ShimmerList count={4} height={120} section="community" />
  </View>
));

export const ScreenSkeletons = {
  Timeline: TimelineSkeleton,
  Profile: ProfileSkeleton,
  Community: CommunitySkeleton,
};

// ─── STYLES ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  spinnerContainer: {
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
  text: { marginTop: 16, fontWeight: '700', textAlign: 'center' },
  subtext: { marginTop: 6, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  progressContainer: { marginTop: 12, width: '80%', alignItems: 'center' },
  progressBar: { width: '100%', height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  shimmerContainer: { overflow: 'hidden' },
  liquidDotsContainer: { justifyContent: 'center', alignItems: 'center' },
  liquidDot: { position: 'absolute', borderRadius: 999 },
  pulseContainer: { justifyContent: 'center', alignItems: 'center' },
  pulseRing: { position: 'absolute', borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  pulseCenter: { borderRadius: 999 },
  orbitCenter: { position: 'absolute', borderRadius: 999 },
  staticDot: { borderRadius: 999 },
});

const skeletonStyles = StyleSheet.create({
  container: { padding: 20 },
  item: { marginBottom: 24 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timeColumn: { width: 70, alignItems: 'flex-start' },
  eventCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
  },
  eventContent: { flex: 1, marginLeft: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerCenter: { alignItems: 'center' },
  profileCard: { backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  profileInfo: { marginLeft: 16, flex: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
});

export default UniversalSpinner;