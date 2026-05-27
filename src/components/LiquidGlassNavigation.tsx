// src/components/LiquidGlassNavigation.tsx
import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  ViewStyle,
  TextStyle,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigationContext } from '../context/NavigationContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TABS
// ============================================

interface TabItem {
  name: string;
  shortName: string;
  icon: string;
  activeIcon: string;
  route: string;
  color: string;
  showInCompact?: boolean;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  description?: string;
}

const TABS: TabItem[] = [
  { name: 'Home', shortName: 'H', icon: '🏠', activeIcon: '🏡', route: 'Home', color: '#667eea', showInCompact: true, hapticStyle: Haptics.ImpactFeedbackStyle.Light, description: 'Dashboard' },
  { name: 'Track', shortName: 'T', icon: '⏱️', activeIcon: '✓', route: 'Track', color: '#11998e', showInCompact: true, hapticStyle: Haptics.ImpactFeedbackStyle.Medium, description: 'Daily Tracking' },
  { name: 'Grow', shortName: 'G', icon: '🌱', activeIcon: '🌳', route: 'Grow', color: '#fa709a', showInCompact: true, hapticStyle: Haptics.ImpactFeedbackStyle.Medium, description: 'Growth & Milestones' },
  { name: 'Connect', shortName: 'C', icon: '💬', activeIcon: '👨‍👩‍👧‍👦', route: 'Connect', color: '#f59e0b', showInCompact: false, hapticStyle: Haptics.ImpactFeedbackStyle.Light, description: 'Community' },
  { name: 'More', shortName: '•••', icon: '⚙️', activeIcon: '🔧', route: 'More', color: '#64748b', showInCompact: false, hapticStyle: Haptics.ImpactFeedbackStyle.Light, description: 'Settings' },
];

// Dimensions
const EXPANDED_WIDTH = SCREEN_WIDTH - 170;
const COMPACT_WIDTH = 150;
const TAB_BAR_HEIGHT = 158;
const COMPACT_TAB_BAR_HEIGHT = 148;
const COMPACT_OFFSET_X = -SCREEN_WIDTH + COMPACT_WIDTH + 70;
const BOTTOM_MARGIN = 50;
const HIDDEN_TRANSLATE_Y = 200;

// Date helper
const getCurrentDate = () => {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.toLocaleString('default', { month: 'short' }).toUpperCase(),
  };
};

// ============================================
// TAB BUTTON
// ============================================

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  isCompact: boolean;
  index: number;
  colors: any;
}

const TabButton: React.FC<TabButtonProps> = ({ tab, isActive, onPress, isDark, isCompact, index, colors }) => {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.12 : isCompact ? 0.9 : 1, { damping: 15 });
    translateY.value = withSpring(isActive ? -4 : isCompact && index >= 2 ? -3 : 0, { damping: 15 });
    glowOpacity.value = withSpring(isActive ? 1 : 0, { damping: 15 });
  }, [isActive, isCompact, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.5, 1.2], Extrapolation.CLAMP) }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowOpacity.value }],
  }));

  if (isCompact && !tab.showInCompact && !isActive) {
    return (
      <View style={[styles.hiddenTab, { transform: [{ translateY: -8 }] }]}>
        <TouchableOpacity onPress={onPress} style={styles.hiddenTabButton} activeOpacity={0.7}>
          <Text style={[styles.hiddenTabIcon, { color: colors.text }]}>{tab.icon}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.tabButton, isCompact && styles.tabButtonCompact, isCompact && index >= 2 && styles.tabButtonUpward]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.glow, glowStyle]}>
        <LinearGradient colors={[tab.color + '60', tab.color + '20', 'transparent']} style={styles.glowGradient} />
      </Animated.View>
      <Animated.View style={[styles.activeDot, dotStyle, { backgroundColor: tab.color }]} />
      <Animated.View style={[animatedStyle, { zIndex: 10 }]}>
        <Text style={[styles.tabEmoji, isCompact && styles.tabEmojiCompact, isCompact && index >= 2 && styles.tabEmojiUpward]}>
          {isActive ? tab.activeIcon : tab.icon}
        </Text>
      </Animated.View>
      <Text style={[
        styles.tabLabel,
        isActive && [styles.activeLabel, { color: tab.color }],
        isDark && { color: colors.textSecondary },
        isCompact && styles.tabLabelCompact,
        isActive && isDark && { color: tab.color }
      ]}>
        {isCompact ? tab.shortName : tab.name}
      </Text>
    </TouchableOpacity>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const LiquidGlassNavigation: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    isNavVisible,
    isNavCompact,
    showNav,
    hideNav,
    toggleCompact,
    isCommunityScreen,
    forceShowNav,
    isDark,
    colors,
  } = useNavigationContext();

  const [currentDate, setCurrentDate] = useState(getCurrentDate());

  // Update date at midnight
  useEffect(() => {
    const updateDate = () => setCurrentDate(getCurrentDate());
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeout = setTimeout(updateDate, tomorrow.getTime() - now.getTime());
    const interval = setInterval(updateDate, 24 * 60 * 60 * 1000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, []);

  const activeIndex = state.index;

  const isTrackScreen = state.routes[activeIndex].name === 'Track';

  // Animated values
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const width = useSharedValue(EXPANDED_WIDTH);
  const height = useSharedValue(TAB_BAR_HEIGHT);
  const opacity = useSharedValue(1);
  const dateFabScale = useSharedValue(0);

  // Track previous states for animation decisions
  const prevVisible = useRef(true);
  const prevCompact = useRef(false);

  // Update animations
  useEffect(() => {
    // Community screen: completely hide
    if (isCommunityScreen) {
      translateY.value = withSpring(HIDDEN_TRANSLATE_Y, { damping: 15, stiffness: 100 });
      opacity.value = withSpring(0, { damping: 15 });
      dateFabScale.value = withSpring(0, { damping: 15 });
      prevVisible.current = false;
      return;
    }

    // Normal screen: respond to visibility
    if (isNavVisible !== prevVisible.current) {
      prevVisible.current = isNavVisible;
      if (isNavVisible) {
        translateY.value = withSpring(0, { damping: 15, stiffness: 120 });
        opacity.value = withSpring(1, { damping: 15 });
      } else {
        translateY.value = withSpring(120, { damping: 15, stiffness: 100 });
        opacity.value = withSpring(0, { damping: 15 });
      }
    }

    // Compact mode (only when visible)
    if (isNavVisible && isNavCompact !== prevCompact.current) {
      prevCompact.current = isNavCompact;
      translateX.value = withSpring(isNavCompact ? COMPACT_OFFSET_X : 0, { damping: 15 });
      width.value = withSpring(isNavCompact ? COMPACT_WIDTH : EXPANDED_WIDTH, { damping: 15 });
      height.value = withSpring(isNavCompact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT, { damping: 15 });
    }

    // Date FAB
    dateFabScale.value = withSpring(isTrackScreen && isNavVisible ? 1 : 0, { damping: 12, stiffness: 100 });
  }, [isNavVisible, isNavCompact, isTrackScreen, isCommunityScreen]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const navContainerStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  const glassHeightStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const dateFabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dateFabScale.value }],
    opacity: dateFabScale.value,
  }));

  const handlePress = useCallback((index: number, route: string, tab: TabItem) => {
    Haptics.impactAsync(tab.hapticStyle || Haptics.ImpactFeedbackStyle.Light);
    if (isNavCompact) showNav();
    const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route);
  }, [navigation, isNavCompact, showNav]);

  const handleAddLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddLog');
  }, [navigation]);

  // ============================================
  // PAN RESPONDER
  // ============================================
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { dy } = gestureState;

        if (dy < -40) {
          runOnJS(showNav)();
          if (isNavCompact) runOnJS(toggleCompact)();
        } else if (dy > 50) {
          runOnJS(hideNav)();
        } else if (Math.abs(gestureState.dx) > 60) {
          if ((gestureState.dx > 0 && isNavCompact) || (gestureState.dx < 0 && !isNavCompact)) {
            runOnJS(toggleCompact)();
          }
        }
      },
    })
  ).current;

  // Don't render on community screens
  if (isCommunityScreen) return null;

  return (
    <View
      style={[styles.outerWrapper, { paddingBottom: Math.max(insets.bottom, 12) + BOTTOM_MARGIN }]}
      {...panResponder.panHandlers}
    >
      {/* DATE FAB */}
      {isTrackScreen && (
        <Animated.View style={[styles.dateFabContainer, dateFabStyle]}>
          <TouchableOpacity style={styles.dateFab} onPress={handleAddLog} activeOpacity={0.8}>
            <BlurView intensity={70} style={styles.dateFabBlur} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={isDark ? ['rgba(30,30,30,0.95)', 'rgba(20,20,20,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.dateFabContent}>
                <Text style={[styles.dateFabDay, isDark && { color: colors.text }]}>{currentDate.day}</Text>
                <Text style={[styles.dateFabMonth, isDark && { color: colors.success }]}>{currentDate.month}</Text>
              </View>
            </BlurView>
            <View style={styles.addIndicator}>
              <Text style={styles.addIndicatorText}>+</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Animated.View style={[styles.container, containerStyle]}>
        {/* Handle bar */}
        <TouchableOpacity
          style={styles.handle}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            isNavCompact ? showNav() : toggleCompact();
          }}
          activeOpacity={0.6}
        >
          <View style={[styles.handleBar, { backgroundColor: colors.handleBar }]} />
          {isNavCompact && <View style={[styles.handleBar, { backgroundColor: colors.handleBar, marginTop: 2, width: 20 }]} />}
        </TouchableOpacity>

        <Animated.View style={[styles.navContainer, navContainerStyle]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 70}
            style={[
              styles.glassBackground,
              {
                borderColor: colors.glassBorder,
                shadowColor: colors.shadowColor,
              }
            ]}
            tint={isDark ? 'dark' : 'light'}
          >
            <Animated.View style={[StyleSheet.absoluteFill, glassHeightStyle]}>
              <LinearGradient
                colors={isDark
                  ? ['rgba(25,25,25,0.9)', 'rgba(15,15,15,0.7)', 'rgba(10,10,10,0.5)']
                  : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.6)']}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['transparent', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topHighlight}
              />
            </Animated.View>

            <View style={[styles.tabsContainer, isNavCompact && styles.tabsContainerCompact]}>
              {TABS.map((tab, index) => (
                <TabButton
                  key={tab.name}
                  tab={tab}
                  isActive={index === activeIndex}
                  onPress={() => handlePress(index, tab.route, tab)}
                  isDark={isDark}
                  isCompact={isNavCompact}
                  index={index}
                  colors={colors}
                />
              ))}
            </View>
          </BlurView>

          {/* Peek indicator when hidden */}
          {!isNavVisible && (
            <TouchableOpacity style={styles.peekIndicator} onPress={showNav} activeOpacity={0.8}>
              <BlurView intensity={80} style={styles.peekBlur} tint={isDark ? 'dark' : 'light'}>
                <View style={[styles.peekDot, { backgroundColor: TABS[activeIndex].color }]} />
              </BlurView>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  dateFabContainer: {
    position: 'absolute',
    left: 20,
    bottom: 150,
    zIndex: 100,
  },
  dateFab: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 12,
  },
  dateFabBlur: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateFabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  dateFabDay: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 30,
    textAlign: 'center',
  },
  dateFabMonth: {
    fontSize: 11,
    fontWeight: '700',
    color: '#11998e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: -2,
  },
  addIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#11998e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#11998e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  addIndicatorText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '700',
    marginTop: -1,
  },
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
  handle: {
    width: 50,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  handleBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  navContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  glassBackground: {
    borderRadius: 100,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  } as ViewStyle,
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: '100%',
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  } as ViewStyle,
  tabsContainerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    position: 'relative',
    minWidth: 50,
  } as ViewStyle,
  tabButtonCompact: {
    minWidth: 38,
    paddingHorizontal: 2,
  },
  tabButtonUpward: {
    marginTop: -3,
  },
  hiddenTab: {
    position: 'absolute',
    right: -10,
    top: 0,
  },
  hiddenTabButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hiddenTabIcon: {
    fontSize: 14,
  },
  glow: {
    position: 'absolute',
    top: -3,
    width: 45,
    height: 45,
    borderRadius: 22,
    alignSelf: 'center',
    zIndex: 0,
  } as ViewStyle,
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  } as ViewStyle,
  activeDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    zIndex: 0,
  },
  tabEmoji: {
    fontSize: 18,
    marginBottom: 0,
    textAlign: 'center',
    zIndex: 10,
  } as TextStyle,
  tabEmojiCompact: {
    fontSize: 20,
  },
  tabEmojiUpward: {
    fontSize: 22,
    marginBottom: 0,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
    zIndex: 10,
    marginTop: 0,
  } as TextStyle,
  activeLabel: {
    fontWeight: '800',
  } as TextStyle,
  tabLabelCompact: {
    fontSize: 8,
    marginTop: 0,
    fontWeight: '700',
  },
  peekIndicator: {
    position: 'absolute',
    bottom: -55,
    right: 20,
  },
  peekBlur: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default LiquidGlassNavigation;