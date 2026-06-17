import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
  withRepeat,
  withDelay,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';

import { useCustomization } from '../hooks/useCustomization';
import { useNavigationVisibility, useTheme } from '../context/AppContext';  // ← ADD THIS LINE
import { HomeIcon, TrackIcon, GrowIcon, ConnectIcon, MoreIcon, AddLogIcon } from './TabIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabItem {
  name: string;
  shortName: string;
  route: string;
  color: string;
  hapticStyle: Haptics.ImpactFeedbackStyle;
  description: string;
  Icon: React.FC<any>;
}

const TABS: TabItem[] = [
  { 
    name: 'Home', 
    shortName: 'Home', 
    route: 'Home', 
    color: '#667eea', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Light, 
    description: 'Dashboard',
    Icon: HomeIcon,
  },
  { 
    name: 'Track', 
    shortName: 'Track', 
    route: 'Track', 
    color: '#11998e', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Medium, 
    description: 'Daily Tracking',
    Icon: TrackIcon,
  },
  { 
    name: 'Grow', 
    shortName: 'Grow', 
    route: 'Grow', 
    color: '#fa709a', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Medium, 
    description: 'Growth & Milestones',
    Icon: GrowIcon,
  },
  { 
    name: 'Connect', 
    shortName: 'Connect', 
    route: 'Connect', 
    color: '#f59e0b', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Light, 
    description: 'Community',
    Icon: ConnectIcon,
  },
  { 
    name: 'More', 
    shortName: 'More', 
    route: 'More', 
    color: '#64748b', 
    hapticStyle: Haptics.ImpactFeedbackStyle.Light, 
    description: 'Settings',
    Icon: MoreIcon,
  },
];

const TAB_VISIBLE_ROUTES = new Set(['Home', 'Track', 'Grow', 'Connect', 'More']);

const HIDDEN_TAB_ROUTES = new Set([
  'SwitchBaby', 'EditProfile', 'EditGuardian', 'Gallery', 'FamilyChatList', 'FamilyChat',
  'AddLog', 'Achievements', 'Grow', 'Reminders', 'FamilySharing', 'SoundMixer', 'Customize',
  'BiometricSetup', 'SecurityCenter', 'SecurityLock',
  'BackupRestore', 'HelpCenter', 'ContactSupport', 'PrivacyPolicy', 'TermsOfService', 'About',
  'LanguageSettings', 'UnitSettings', 'SafetyCorner',
  'UniversalTracker', 'PottyTracker', 'FeedTracker', 'SleepTracker',
  'Profile', 'CreateBabyProfile', 'AddParent',
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail', 'CommunityMemberProfile', 'Chat', 'ChatList',
  'Notifications', 'CommunityProfile', 'TopicMembers', 'Followers', 'Following', 'SearchUsers',
  'BlockedUsers', 'Report',
  'CommunitySplash', 'CommunityOnboarding',
]);

const PILL_WIDTH = Math.min(SCREEN_WIDTH - 60, 340);
const PILL_HEIGHT = 68;
const BOTTOM_MARGIN = 10;
const HIDDEN_TRANSLATE_Y = 160;

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  colors: any;
  customization: ReturnType<typeof useCustomization>;
  index: number;
}

const TabButton: React.FC<TabButtonProps> = ({ 
  tab, isActive, onPress, isDark, colors, customization, index 
}) => {
  const scale = useSharedValue(1);
  const glowScale = useSharedValue(0);
  const labelOpacity = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const themeColor = useMemo(() => {
    return customization.themeColors?.primary || tab.color;
  }, [customization.themeColors, tab.color]);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.1 : 1, { 
      damping: 18, 
      stiffness: 320,
      mass: 0.5,
    });
    glowScale.value = withSpring(isActive ? 1 : 0, { 
      damping: 18, 
      stiffness: 320,
      mass: 0.5,
    });
    labelOpacity.value = withTiming(isActive ? 1 : 0.7, { duration: 200 });
    indicatorWidth.value = withSpring(isActive ? 1 : 0, {
      damping: 20,
      stiffness: 300,
      mass: 0.6,
    });
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pressScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowScale.value, [0, 1], [0, 0.1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(glowScale.value, [0, 1], [0.5, 1.5], Extrapolation.CLAMP) }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(indicatorWidth.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scaleX: interpolate(indicatorWidth.value, [0, 1], [0.2, 1], Extrapolation.CLAMP) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: interpolate(labelOpacity.value, [0.7, 1], [2, 0], Extrapolation.CLAMP) }],
  }));

  const inactiveColor = isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(100, 116, 139, 0.5)';
  const activeLabelColor = isDark ? '#f8fafc' : '#1e293b';

  const handlePressIn = useCallback(() => {
    pressScale.value = withTiming(0.88, { duration: 80 });
  }, []);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  }, []);

  return (
    <Pressable
      style={styles.tabButton}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={tab.name}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {/* Ambient glow behind active icon — softer */}
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <View style={[styles.glowDot, { backgroundColor: themeColor }]} />
      </Animated.View>

      {/* Active indicator pill */}
      <Animated.View 
        style={[
          styles.activeIndicator, 
          indicatorStyle, 
          { backgroundColor: themeColor }
        ]} 
      />

      {/* Icon container with subtle background when active */}
      <Animated.View style={[styles.iconContainer, animatedIconStyle, isActive && {
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
      }]}>
        <tab.Icon 
          size={22} 
          color={isActive ? themeColor : inactiveColor} 
          active={isActive}
          strokeWidth={isActive ? 2.2 : 1.5}
        />
      </Animated.View>

      {/* Label with refined typography */}
      <Animated.Text style={[
        styles.tabLabel,
        { color: isActive ? activeLabelColor : inactiveColor },
        isActive && styles.activeLabel,
        labelStyle,
      ]}>
        {tab.name}
      </Animated.Text>
    </Pressable>
  );
};

const OrbitingDots: React.FC<{ isDark: boolean }> = React.memo(({ isDark }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const dotColors = isDark 
    ? ['rgba(102,126,234,0.2)', 'rgba(17,153,142,0.2)', 'rgba(250,112,154,0.2)', 'rgba(245,158,11,0.2)']
    : ['rgba(102,126,234,0.13)', 'rgba(17,153,142,0.13)', 'rgba(250,112,154,0.13)', 'rgba(245,158,11,0.13)'];

  const angles = [0, 90, 180, 270];
  const orbitRadius = 28;
  const dotSize = 2.5;

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, containerStyle]}>
        {angles.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: PILL_WIDTH / 2 + Math.cos(rad) * orbitRadius - dotSize / 2,
                top: PILL_HEIGHT / 2 + Math.sin(rad) * orbitRadius - dotSize / 2,
              }}
            >
              <View
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: dotColors[i],
                }}
              />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
});

const FloatingParticles: React.FC<{ isDark: boolean }> = React.memo(({ isDark }) => {
  const particles = useMemo(() => [
    { x: 0.15, y: 0.3, size: 2, delay: 0, speed: 4000 },
    { x: 0.75, y: 0.6, size: 1.5, delay: 1200, speed: 5000 },
    { x: 0.45, y: 0.8, size: 2.5, delay: 2400, speed: 6000 },
    { x: 0.85, y: 0.25, size: 1.8, delay: 800, speed: 4500 },
    { x: 0.25, y: 0.55, size: 1.2, delay: 1800, speed: 5500 },
  ], []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <FloatingParticle key={i} {...p} isDark={isDark} />
      ))}
    </View>
  );
});

const FloatingParticle: React.FC<{
  x: number; y: number; size: number; delay: number; speed: number; isDark: boolean;
}> = React.memo(({ x, y, size, delay, speed, isDark }) => {
  const floatY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    floatY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-6, { duration: speed, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: speed, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
    opacity: interpolate(opacity.value, [0, 1], [0, isDark ? 0.15 : 0.1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x * PILL_WIDTH,
          top: y * PILL_HEIGHT,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.3)',
        },
        style,
      ]}
    />
  );
});

const ActiveColorWash: React.FC<{ activeIndex: number; isDark: boolean }> = React.memo(({ activeIndex, isDark }) => {
  const washOpacity = useSharedValue(0);
  const tabColors = ['rgba(102,126,234,', 'rgba(17,153,142,', 'rgba(250,112,154,', 'rgba(245,158,11,', 'rgba(100,116,139,'];

  useEffect(() => {
    washOpacity.value = withTiming(1, { duration: 400 });
  }, [activeIndex]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(washOpacity.value, [0, 1], [0, isDark ? 0.04 : 0.03], Extrapolation.CLAMP),
  }));

  const segmentWidth = PILL_WIDTH / TABS.length;
  const left = activeIndex * segmentWidth;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top: 0,
          width: segmentWidth,
          height: PILL_HEIGHT,
          backgroundColor: tabColors[activeIndex] + '1)',
          borderRadius: PILL_HEIGHT / 2,
        },
        washStyle,
      ]}
      pointerEvents="none"
    />
  );
});

const LiquidGlassNavigation: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
const { isNavVisible, isCommunityScreen } = useNavigationVisibility();
const { isDark, colors } = useTheme();
const customization = useCustomization();
  const activeIndex = state.index;
  const activeRouteName = state.routes[activeIndex]?.name;

  const shouldHideCompletely = useMemo(() => {
    if (activeRouteName === 'Connect') {
      const connectRoute = state.routes[activeIndex];
      
      const connectDescriptor = descriptors[connectRoute?.key];
      if (connectDescriptor?.state) {
        const nestedState = connectDescriptor.state;
        const communityRoute = nestedState.routes?.[nestedState.index ?? 0];
        if (communityRoute && HIDDEN_TAB_ROUTES.has(communityRoute.name)) {
          return true;
        }
      }
      
      if (connectRoute?.state) {
        const nestedState = connectRoute.state as any;
        const communityRoute = nestedState.routes?.[nestedState.index ?? 0];
        if (communityRoute && HIDDEN_TAB_ROUTES.has(communityRoute.name)) {
          return true;
        }
      }
      
      return isCommunityScreen;
    }
    
    if (activeRouteName && !TAB_VISIBLE_ROUTES.has(activeRouteName)) {
      return true;
    }
    
    return isCommunityScreen;
  }, [activeRouteName, state, descriptors, activeIndex, isCommunityScreen]);

  const isTrackScreen = activeRouteName === 'Track';

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const pillScale = useSharedValue(1);

  const prevVisible = useRef(true);
  const prevHidden = useRef(false);

  useEffect(() => {
    if (shouldHideCompletely) {
      translateY.value = withTiming(HIDDEN_TRANSLATE_Y, { 
        duration: 380,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      });
      opacity.value = withTiming(0, { duration: 280 });
      scale.value = withTiming(0.9, { duration: 320 });
      pillScale.value = withTiming(0.93, { duration: 320 });
      prevHidden.current = true;
      prevVisible.current = false;
      return;
    }

    if (prevHidden.current && !shouldHideCompletely) {
      prevHidden.current = false;
      translateY.value = withSpring(0, { 
        damping: 20, 
        stiffness: 300,
        mass: 0.6,
      });
      opacity.value = withTiming(1, { duration: 320 });
      scale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
      pillScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
    }

    if (isNavVisible !== prevVisible.current && !shouldHideCompletely) {
      prevVisible.current = isNavVisible;
      if (isNavVisible) {
        translateY.value = withSpring(0, { 
          damping: 20, 
          stiffness: 300,
          mass: 0.6,
        });
        opacity.value = withTiming(1, { duration: 280 });
        scale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
        pillScale.value = withSpring(1, { damping: 20, stiffness: 300, mass: 0.6 });
      } else {
        translateY.value = withSpring(HIDDEN_TRANSLATE_Y, { 
          damping: 22, 
          stiffness: 280,
          mass: 0.6,
        });
        opacity.value = withTiming(0.4, { duration: 280 });
        scale.value = withTiming(0.95, { duration: 280 });
        pillScale.value = withTiming(0.98, { duration: 280 });
      }
    }
  }, [isNavVisible, shouldHideCompletely]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pillScale.value }],
  }));

  const handlePress = useCallback((index: number, route: string, tab: TabItem) => {
    Haptics.impactAsync(tab.hapticStyle);
    const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route);
  }, [navigation]);

  const handleAddLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddEntry');
  }, [navigation]);

  if (shouldHideCompletely) {
    return null;
  }

  const pillBackground = isDark 
    ? 'rgba(22, 22, 26, 0.88)' 
    : 'rgba(255, 255, 255, 0.92)';
  const pillBorder = isDark 
    ? 'rgba(255, 255, 255, 0.06)' 
    : 'rgba(0, 0, 0, 0.04)';
  const pillBorderTop = isDark 
    ? 'rgba(255, 255, 255, 0.1)' 
    : 'rgba(255, 255, 255, 0.7)';
  const highlightTop = isDark 
    ? 'rgba(255, 255, 255, 0.05)' 
    : 'rgba(255, 255, 255, 0.85)';

  const gradientColors = isDark
    ? ['rgba(102,126,234,0.22)', 'rgba(118,75,162,0.16)', 'rgba(240,147,251,0.1)', 'rgba(79,172,254,0.16)']
    : ['rgba(102,126,234,0.15)', 'rgba(118,75,162,0.1)', 'rgba(240,147,251,0.06)', 'rgba(79,172,254,0.1)'];

  return (
    <View
      style={[
        styles.outerWrapper, 
        { paddingBottom: Math.max(insets.bottom, 10) + BOTTOM_MARGIN }
      ]}
      pointerEvents="box-none"
    >
      {/* Add Log FAB — only on Track screen */}
      {isTrackScreen && (
        <TouchableOpacity 
          style={styles.addLogFab} 
          onPress={handleAddLog}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add new log"
        >
          <BlurView intensity={60} style={styles.addLogBlur} tint={isDark ? 'dark' : 'light'}>
            <LinearGradient
              colors={isDark 
                ? ['rgba(45, 45, 52, 0.95)', 'rgba(30, 30, 38, 0.92)'] 
                : ['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 252, 0.96)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.addLogInnerRing}>
              <AddLogIcon size={20} color="#11998e" />
            </View>
          </BlurView>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.container, containerStyle]}>
        {/* Ambient glow REMOVED — pill now floats cleanly */}

        <Animated.View style={[styles.pillContainer, pillStyle, { 
          backgroundColor: pillBackground,
          borderColor: pillBorder,
        }]}>

          {/* ===== SOFT GRADIENT BORDER AROUND PILL ===== */}
          {/* Top gradient edge */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBorderTop}
          />
          {/* Left gradient edge */}
          <LinearGradient
            colors={gradientColors.slice(0, 2)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientBorderLeft}
          />
          {/* Right gradient edge */}
          <LinearGradient
            colors={gradientColors.slice(2, 4)}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientBorderRight}
          />

          {/* Outer border highlight (top edge) — refined */}
          <View style={[styles.outerBorderTop, { borderColor: pillBorderTop }]} />

          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 80}
            style={styles.blurBackground}
            tint={isDark ? 'dark' : 'light'}
          >
            {/* ===== ACTIVE TAB COLOR WASH ===== */}
            <ActiveColorWash activeIndex={activeIndex} isDark={isDark} />

            {/* ===== FLOATING PARTICLES ===== */}
            <FloatingParticles isDark={isDark} />

            {/* ===== SUBTLE ORBITING DOTS INSIDE PILL ===== */}
            <OrbitingDots isDark={isDark} />

            {/* Inner top highlight for glass depth */}
            <LinearGradient
              colors={[highlightTop, 'transparent']}
              style={styles.topHighlight}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            {/* Subtle inner border line */}
            <View style={[styles.innerBorder, { 
              borderColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'
            }]} />

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              {TABS.map((tab, index) => (
                <TabButton
                  key={tab.name}
                  tab={tab}
                  isActive={index === activeIndex}
                  onPress={() => handlePress(index, tab.route, tab)}
                  isDark={isDark}
                  colors={colors}
                  customization={customization}
                  index={index}
                />
              ))}
            </View>
          </BlurView>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

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
    borderWidth: 1,
    position: 'relative',
  } as ViewStyle,

  gradientBorderTop: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1.5,
    borderRadius: 1,
    zIndex: 4,
    opacity: 0.6,
  },
  gradientBorderLeft: {
    position: 'absolute',
    top: 8,
    left: 0,
    width: 1.5,
    bottom: 8,
    borderRadius: 1,
    zIndex: 4,
    opacity: 0.35,
  },
  gradientBorderRight: {
    position: 'absolute',
    top: 8,
    right: 0,
    width: 1.5,
    bottom: 8,
    borderRadius: 1,
    zIndex: 4,
    opacity: 0.35,
  },

  outerBorderTop: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    borderTopWidth: 0.8,
    borderRadius: 1,
    zIndex: 3,
    opacity: 0.7,
  },
  blurBackground: {
    flex: 1,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22,
    zIndex: 1,
  },
  innerBorder: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: (PILL_HEIGHT - 12) / 2,
    borderWidth: 0.8,
    zIndex: 2,
    pointerEvents: 'none',
  },
  tabsContainer: {
    flexDirection: 'row',
    height: '100%',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    zIndex: 2,
    gap: 2,
  } as ViewStyle,
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    position: 'relative',
    minWidth: 56,
    height: '100%',
    borderRadius: 14,
  } as ViewStyle,
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  glowContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -26,
    borderRadius: 22,
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  glowDot: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    opacity: 0.12,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 8,
    width: 18,
    height: 3.5,
    borderRadius: 2,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
    letterSpacing: 0.3,
    lineHeight: 14,
  } as TextStyle,
  activeLabel: {
    fontWeight: '700',
    letterSpacing: 0.1,
  } as TextStyle,
  addLogFab: {
    position: 'absolute',
    right: 22,
    bottom: PILL_HEIGHT + 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 1000,
  },
  addLogBlur: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addLogInnerRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(17, 153, 142, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LiquidGlassNavigation;
