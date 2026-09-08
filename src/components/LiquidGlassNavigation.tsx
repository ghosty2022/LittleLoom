// src/components/LiquidGlassNavigation.tsx
import React, { useCallback, useEffect, useMemo, memo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  ViewStyle,
  TextStyle,
  Pressable,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouteBasedNavVisibility } from '../hooks/useRouteBasedNavVisibility';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── CONSTANTS ──────────────────────────────────────────────────────
const PILL_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);
const PILL_HEIGHT = 60;
const BOTTOM_MARGIN = 10;
const HIDDEN_TRANSLATE_Y = 120;
const TAB_COUNT = 5;
const SEGMENT_WIDTH = PILL_WIDTH / TAB_COUNT;

// ─── ICON COMPONENTS (memoized) ───────────────────────────────────
const icons = {
  Home: (props: any) => <Ionicons name="home-outline" size={22} {...props} />,
  HomeActive: (props: any) => <Ionicons name="home" size={22} {...props} />,
  Track: (props: any) => <Ionicons name="flash-outline" size={22} {...props} />,
  TrackActive: (props: any) => <Ionicons name="flash" size={22} {...props} />,
  Timeline: (props: any) => <Ionicons name="albums-outline" size={22} {...props} />,
  TimelineActive: (props: any) => <Ionicons name="albums" size={22} {...props} />,
  Grow: (props: any) => <Ionicons name="trending-up-outline" size={22} {...props} />,
  GrowActive: (props: any) => <Ionicons name="trending-up" size={22} {...props} />,
  Connect: (props: any) => <Ionicons name="planet-outline" size={22} {...props} />,
  ConnectActive: (props: any) => <Ionicons name="planet" size={22} {...props} />,
  AddLog: (props: any) => <Ionicons name="add-outline" size={18} {...props} />,
};

// ─── TAB CONFIG ────────────────────────────────────────────────────
const TABS = [
  { 
    name: 'Home', 
    route: 'Home', 
    color: '#667eea', 
    gradient: ['#667eea', '#764ba2'] as const,
    haptic: Haptics.ImpactFeedbackStyle.Light, 
    Icon: icons.Home,
    IconActive: icons.HomeActive,
  },
  { 
    name: 'Track', 
    route: 'Track', 
    color: '#11998e', 
    gradient: ['#11998e', '#38ef7d'] as const,
    haptic: Haptics.ImpactFeedbackStyle.Medium, 
    Icon: icons.Track,
    IconActive: icons.TrackActive,
  },
  { 
    name: 'Timeline', 
    route: 'Timeline', 
    color: '#8b5cf6', 
    gradient: ['#8b5cf6', '#a78bfa'] as const,
    haptic: Haptics.ImpactFeedbackStyle.Light, 
    Icon: icons.Timeline,
    IconActive: icons.TimelineActive,
  },
  { 
    name: 'Grow', 
    route: 'Grow', 
    color: '#fa709a', 
    gradient: ['#fa709a', '#fee140'] as const,
    haptic: Haptics.ImpactFeedbackStyle.Medium, 
    Icon: icons.Grow,
    IconActive: icons.GrowActive,
  },
  { 
    name: 'Connect', 
    route: 'Connect', 
    color: '#f59e0b', 
    gradient: ['#f59e0b', '#f97316'] as const,
    haptic: Haptics.ImpactFeedbackStyle.Light, 
    Icon: icons.Connect,
    IconActive: icons.ConnectActive,
  },
];

// ─── DATE DISPLAY ─────────────────────────────────────────────────
const DateDisplay = memo(({ isDark }: { isDark: boolean }) => {
  const [dateStr, setDateStr] = React.useState('');

  useEffect(() => {
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setDateStr(`${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`);
  }, []);

  return (
    <Text style={[styles.dateText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }]}>
      {dateStr}
    </Text>
  );
});

// ─── TAB BUTTON (optimized) ──────────────────────────────────────
const TabButton = memo(({ 
  tab, 
  isActive, 
  onPress, 
  isDark,
  index,
  activeIndex,
}: {
  tab: typeof TABS[0];
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  index: number;
  activeIndex: number;
}) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const labelOpacity = useSharedValue(0.35);
  const rotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  // Update animations more efficiently
  useEffect(() => {
    scale.value = withSpring(isActive ? 1.08 : 1, { damping: 20, stiffness: 600, mass: 0.2 });
    glowOpacity.value = withTiming(isActive ? 0.25 : 0, { duration: 250 });
    iconScale.value = withSpring(isActive ? 1.15 : 1, { damping: 18, stiffness: 550, mass: 0.2 });
    labelOpacity.value = withTiming(isActive ? 1 : 0.35, { duration: 250 });
    
    // Subtle rotation on active
    rotation.value = withSpring(isActive ? 0 : 0, { damping: 15, stiffness: 400 });
    
    // Pulse animation when becoming active
    if (isActive) {
      pulseScale.value = withSpring(1.2, { damping: 12, stiffness: 300, mass: 0.3 });
      setTimeout(() => {
        pulseScale.value = withSpring(1, { damping: 15, stiffness: 400, mass: 0.3 });
      }, 200);
    }
  }, [isActive]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 0.25], [0.8, 1]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const inactiveColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.35)';
  const activeLabelColor = isDark ? '#f8fafc' : '#1e293b';

  // Determine which icon to show
  const IconComponent = isActive ? tab.IconActive : tab.Icon;

  return (
    <Pressable
      style={styles.tabButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <LinearGradient
          colors={tab.gradient}
          style={styles.glowDot}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Floating particles effect for active tab */}
      {isActive && (
        <Animated.View style={[styles.particleContainer, pulseStyle]}>
          {[0, 1, 2, 3].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                {
                  backgroundColor: tab.color,
                  top: -10 - i * 4,
                  left: -8 + i * 12,
                  opacity: 0.3 - i * 0.05,
                  transform: [
                    { scale: 0.6 + i * 0.1 },
                    { translateY: -5 - i * 2 },
                  ],
                },
              ]}
            />
          ))}
        </Animated.View>
      )}

      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <IconComponent color={isActive ? tab.color : inactiveColor} />
      </Animated.View>

      <Animated.Text
        style={[
          styles.tabLabel,
          { color: isActive ? activeLabelColor : inactiveColor },
          isActive && styles.activeLabel,
          labelStyle,
        ]}
        numberOfLines={1}
      >
        {tab.name}
      </Animated.Text>
    </Pressable>
  );
});

// ─── ACTIVE COLOR WASH ──────────────────────────────────────────
const ActiveColorWash = memo(({ activeIndex, isDark }: { activeIndex: number; isDark: boolean }) => {
  const washOpacity = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    washOpacity.value = withTiming(1, { duration: 350 });
    translateX.value = withSpring(0, { damping: 25, stiffness: 400 });
  }, [activeIndex]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(washOpacity.value, [0, 1], [0, isDark ? 0.1 : 0.07], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(washOpacity.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) },
      { translateX: translateX.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: activeIndex * SEGMENT_WIDTH,
          top: 4,
          width: SEGMENT_WIDTH,
          height: PILL_HEIGHT - 8,
          borderRadius: (PILL_HEIGHT - 8) / 2,
        },
        washStyle,
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[...TABS[activeIndex].gradient.map(c => c + '30'), 'transparent'] as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </Animated.View>
  );
});

// ─── SLIDING INDICATOR ──────────────────────────────────────────
const SlidingIndicator = memo(({ activeIndex, isDark }: { activeIndex: number; isDark: boolean }) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(activeIndex * SEGMENT_WIDTH, {
      damping: 30,
      stiffness: 500,
      mass: 0.5,
    });
  }, [activeIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.slidingIndicator,
        indicatorStyle,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        },
      ]}
      pointerEvents="none"
    />
  );
});

// ─── MAIN COMPONENT ─────────────────────────────────────────────
const LiquidGlassNavigation: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const activeIndex = state.index;
  const activeRouteName = state.routes[activeIndex]?.name;

  // ─── VISIBILITY ──────────────────────────────────────────────
  const { isVisible, isFullyHidden } = useRouteBasedNavVisibility();

  // ─── ANIMATED VALUES ──────────────────────────────────────────
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const pillScale = useSharedValue(1);
  const borderGlow = useSharedValue(0);

  // ─── UPDATE ANIMATIONS ────────────────────────────────────────
  useEffect(() => {
    if (isFullyHidden) {
      translateY.value = withTiming(HIDDEN_TRANSLATE_Y, { 
        duration: 250,
        easing: Easing.out(Easing.ease),
      });
      opacity.value = withTiming(0, { duration: 200 });
      pillScale.value = withTiming(0.92, { duration: 250 });
      borderGlow.value = withTiming(0, { duration: 200 });
    } else {
      translateY.value = withSpring(0, { damping: 25, stiffness: 500, mass: 0.4 });
      opacity.value = withTiming(1, { duration: 200 });
      pillScale.value = withSpring(1, { damping: 25, stiffness: 500, mass: 0.4 });
      borderGlow.value = withTiming(1, { duration: 300 });
    }
  }, [isFullyHidden]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: pillScale.value }],
    opacity: opacity.value,
  }));

  const borderGlowStyle = useAnimatedStyle(() => ({
    opacity: borderGlow.value,
  }));

  // ─── HANDLERS ──────────────────────────────────────────────────
  const handlePress = useCallback((route: string, tab: typeof TABS[0]) => {
    Haptics.impactAsync(tab.haptic);
    const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route);
  }, [navigation]);

  const handleAddLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddEntry');
  }, [navigation]);

  // ─── THEME ─────────────────────────────────────────────────────
  const pillBackground = isDark ? 'rgba(18, 18, 24, 0.92)' : 'rgba(255, 255, 255, 0.94)';

  return (
    <View
      style={[styles.outerWrapper, { paddingBottom: Math.max(insets.bottom, 6) + BOTTOM_MARGIN }]}
      pointerEvents="box-none"
    >
      {/* ─── ADD LOG FAB ──────────────────────────────────────── */}
      {activeRouteName === 'Track' && isVisible && (
        <TouchableOpacity 
          style={styles.addLogFab} 
          onPress={handleAddLog}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add new log"
        >
          <Animated.View style={[styles.addLogContainer, { 
            backgroundColor: isDark ? 'rgba(18,18,24,0.85)' : 'rgba(255,255,255,0.9)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }]}>
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
            <LinearGradient
              colors={isDark ? ['rgba(17,153,142,0.2)', 'rgba(56,239,125,0.1)'] : ['rgba(17,153,142,0.1)', 'rgba(56,239,125,0.05)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.addLogContent}>
              <View style={styles.addLogIconRing}>
                <icons.AddLog color="#11998e" />
              </View>
              <View style={styles.addLogTextContainer}>
                <Text style={[styles.addLogLabel, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
                  Log
                </Text>
                <DateDisplay isDark={isDark} />
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* ─── MAIN PILL NAV ────────────────────────────────────── */}
      <Animated.View style={[styles.container, containerStyle]}>
        <View style={[styles.pillContainer, { backgroundColor: pillBackground }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 70}
            style={StyleSheet.absoluteFill}
            tint={isDark ? 'dark' : 'light'}
          />
          
          <SlidingIndicator activeIndex={activeIndex} isDark={isDark} />
          <ActiveColorWash activeIndex={activeIndex} isDark={isDark} />

          <LinearGradient
            colors={[isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)', 'transparent']}
            style={styles.topHighlight}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          {/* Animated border glow */}
          <Animated.View style={[styles.pillBorderGlow, borderGlowStyle]}>
            <LinearGradient
              colors={isDark ? 
                ['rgba(255,255,255,0)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)'] :
                ['rgba(0,0,0,0)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0)']
              }
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>

          {/* Subtle border */}
          <View style={[styles.pillBorder, { 
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
          }]} />

          <View style={styles.tabsContainer}>
            {TABS.map((tab, index) => (
              <TabButton
                key={tab.name}
                tab={tab}
                isActive={index === activeIndex}
                onPress={() => handlePress(tab.route, tab)}
                isDark={isDark}
                index={index}
                activeIndex={activeIndex}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

// ─── STYLES ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 999,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },
  pillContainer: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  } as ViewStyle,
  pillBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    zIndex: 1,
    pointerEvents: 'none',
  },
  pillBorderGlow: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: PILL_HEIGHT / 2 + 1,
    zIndex: 0,
    pointerEvents: 'none',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    zIndex: 2,
  } as ViewStyle,
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    position: 'relative',
    height: '100%',
    borderRadius: 12,
  } as ViewStyle,
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -28,
    borderRadius: 24,
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  glowDot: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    opacity: 0.18,
  },
  slidingIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: SEGMENT_WIDTH - 8,
    height: PILL_HEIGHT - 8,
    borderRadius: (PILL_HEIGHT - 8) / 2,
    zIndex: 0,
  },
  particleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 12,
    marginTop: 1,
  } as TextStyle,
  activeLabel: {
    fontWeight: '700',
  } as TextStyle,
  addLogFab: {
    position: 'absolute',
    right: 16,
    bottom: PILL_HEIGHT + 16,
    zIndex: 1000,
  },
  addLogContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    minWidth: 100,
    minHeight: 44,
  },
  addLogContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addLogIconRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 153, 142, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLogTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  addLogLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 15,
  },
  dateText: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 12,
    marginTop: 0.5,
  },
});

export default LiquidGlassNavigation;