import React, { useCallback, useEffect, useRef, useState } from 'react';
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

interface TabItem {
  name: string;
  shortName: string;
  icon: string;
  activeIcon: string;
  route: string;
  color: string;
  showInCompact?: boolean;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
}

const TABS: TabItem[] = [
  { name: 'Home', shortName: 'H', icon: '🏠', activeIcon: '🏡', route: 'Home', color: '#667eea', showInCompact: true, hapticStyle: Haptics.ImpactFeedbackStyle.Light },
  { name: 'Community', shortName: 'C', icon: '👥', activeIcon: '👨‍👩‍👧‍👦', route: 'Community', color: '#fa709a', showInCompact: true, hapticStyle: Haptics.ImpactFeedbackStyle.Medium },
  { name: 'Timeline', shortName: 'T', icon: '📜', activeIcon: '📅', route: 'Timeline', color: '#11998e', showInCompact: true, hapticStyle: Haptics.ImpactFeedbackStyle.Light },
  { name: 'Safety', shortName: 'S', icon: '🛡️', activeIcon: '🛡️', route: 'SafetyCorner', color: '#fc5c7d', showInCompact: false, hapticStyle: Haptics.ImpactFeedbackStyle.Heavy },
  { name: 'Settings', shortName: '⚙', icon: '⚙️', activeIcon: '🔧', route: 'Settings', color: '#43e97b', showInCompact: false, hapticStyle: Haptics.ImpactFeedbackStyle.Medium },
];

// PILL DIMENSIONS - Fully rounded, floating above bottom
const EXPANDED_WIDTH = SCREEN_WIDTH - 170;
const COMPACT_WIDTH = 150;
const TAB_BAR_HEIGHT = 158;
const COMPACT_TAB_BAR_HEIGHT = 148;
const COMPACT_OFFSET_X = -SCREEN_WIDTH + COMPACT_WIDTH + 70;

// Bottom positioning - floating above bottom
const BOTTOM_MARGIN = 50;

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  isCompact: boolean;
  index: number;
}

// Get current date formatted for display
const getCurrentDate = () => {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.toLocaleString('default', { month: 'short' }).toUpperCase(),
    weekday: now.toLocaleString('default', { weekday: 'short' }),
  };
};

const TabButton: React.FC<TabButtonProps> = ({ 
  tab, 
  isActive, 
  onPress, 
  isDark, 
  isCompact,
  index 
}) => {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.12 : isCompact ? 0.9 : 1, { damping: 15 });
    translateY.value = withSpring(isActive ? -4 : isCompact && index >= 2 ? -3 : 0, { damping: 15 });
    glowOpacity.value = withSpring(isActive ? 1 : 0, { damping: 15 });
  }, [isActive, isCompact, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
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
          <Text style={styles.hiddenTabIcon}>{tab.icon}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.tabButton, isCompact && styles.tabButtonCompact, isCompact && index >= 2 && styles.tabButtonUpward]} 
      onPress={() => {
        Haptics.impactAsync(tab.hapticStyle || Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.glow, glowStyle]}>
        <LinearGradient 
          colors={[tab.color + '60', tab.color + '20', 'transparent']} 
          style={styles.glowGradient} 
        />
      </Animated.View>

      <Animated.View style={[styles.activeDot, dotStyle, { backgroundColor: tab.color }]} />

      <Animated.View style={[animatedStyle, { zIndex: 10 }]}>
        <Text style={[styles.tabEmoji, isCompact && styles.tabEmojiCompact, isCompact && index >= 2 && styles.tabEmojiUpward]}>
          {isActive ? tab.activeIcon : tab.icon}
        </Text>
      </Animated.View>

      <Text style={[styles.tabLabel, isActive && [styles.activeLabel, { color: tab.color }], isDark && styles.tabLabelDark, isCompact && styles.tabLabelCompact]}>
        {isCompact ? tab.shortName : tab.name}
      </Text>
    </TouchableOpacity>
  );
};

const LiquidGlassNavigation: React.FC<BottomTabBarProps> = ({ 
  state, 
  descriptors, 
  navigation 
}) => {
  const insets = useSafeAreaInsets();
  const { 
    isNavVisible, 
    isNavCompact, 
    showNav,
    hideNav,
    toggleCompact
  } = useNavigationContext();

  const [currentDate, setCurrentDate] = useState(getCurrentDate());

  // Update date at midnight
  useEffect(() => {
    const updateDate = () => setCurrentDate(getCurrentDate());
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(updateDate, msUntilMidnight);
    const interval = setInterval(updateDate, 24 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const activeIndex = state.index;
  const isDark = descriptors[state.routes[activeIndex].key].options.tabBarStyle?.backgroundColor === '#0a0a0a' || false;

  // Check if we're on Timeline screen
  const isTimelineScreen = state.routes[activeIndex].name === 'Timeline';

  // Reanimated shared values
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const width = useSharedValue(EXPANDED_WIDTH);
  const height = useSharedValue(TAB_BAR_HEIGHT);
  const opacity = useSharedValue(1);
  const dateFabScale = useSharedValue(0);

  // Update animations when state changes
  useEffect(() => {
    translateY.value = withSpring(isNavVisible ? 0 : 100, { damping: 15 });
    translateX.value = withSpring(isNavCompact ? COMPACT_OFFSET_X : 0, { damping: 15 });
    width.value = withSpring(isNavCompact ? COMPACT_WIDTH : EXPANDED_WIDTH, { damping: 15 });
    height.value = withSpring(isNavCompact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT, { damping: 15 });
    opacity.value = withSpring(isNavVisible ? 1 : 0, { damping: 15 });

    // Date FAB only shows on Timeline screen
    dateFabScale.value = withSpring(isTimelineScreen && isNavVisible ? 1 : 0, { damping: 12, stiffness: 100 });
  }, [isNavVisible, isNavCompact, isTimelineScreen]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value }
    ],
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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderRelease: (_, gestureState) => {
        const { dy, dx } = gestureState;
        if (dy < -30) {
          runOnJS(showNav)();
          if (isNavCompact) runOnJS(toggleCompact)();
        } else if (dy > 50) {
          runOnJS(hideNav)();
        }
        if (Math.abs(dx) > 50) {
          if ((dx > 0 && isNavCompact) || (dx < 0 && !isNavCompact)) {
            runOnJS(toggleCompact)();
          }
        }
      },
    })
  ).current;

  return (
    <View 
      style={[styles.outerWrapper, { paddingBottom: Math.max(insets.bottom, 12) + BOTTOM_MARGIN }]}
      {...panResponder.panHandlers}
    >
      {/* DATE FAB - Only shows on Timeline screen, acts as Add Log button */}
      {isTimelineScreen && (
        <Animated.View style={[styles.dateFabContainer, dateFabStyle]}>
          <TouchableOpacity 
            style={styles.dateFab}
            onPress={handleAddLog}
            activeOpacity={0.8}
          >
            <BlurView intensity={70} style={styles.dateFabBlur} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={isDark ? ['rgba(30,30,30,0.95)', 'rgba(20,20,20,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.dateFabContent}>
                <Text style={[styles.dateFabDay, isDark && styles.dateFabDayDark]}>{currentDate.day}</Text>
                <Text style={[styles.dateFabMonth, isDark && styles.dateFabMonthDark]}>{currentDate.month}</Text>
              </View>
            </BlurView>
            {/* Add indicator - positioned outside blur */}
            <View style={styles.addIndicator}>
              <Text style={styles.addIndicatorText}>+</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Animated.View style={[styles.container, containerStyle]}>
        <TouchableOpacity 
          style={styles.handle}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            isNavCompact ? showNav() : toggleCompact();
          }}
          activeOpacity={0.6}
        >
          <View style={[styles.handleBar, isDark && styles.handleBarDark]} />
          {isNavCompact && <View style={[styles.handleBar, isDark && styles.handleBarDark, { marginTop: 2, width: 20 }]} />}
        </TouchableOpacity>

        <Animated.View style={[styles.navContainer, navContainerStyle]}>
          <BlurView 
            intensity={Platform.OS === 'ios' ? 50 : 70}
            style={[styles.glassBackground, isDark && styles.glassBackgroundDark]}
            tint={isDark ? 'dark' : 'light'}
          >
            <Animated.View style={[StyleSheet.absoluteFill, glassHeightStyle]}>
              <LinearGradient
                colors={isDark ? ['rgba(25,25,25,0.9)', 'rgba(15,15,15,0.7)', 'rgba(10,10,10,0.5)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.6)']}
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
                />
              ))}
            </View>
          </BlurView>

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

const styles = StyleSheet.create({
  // DATE FAB STYLES - Bottom right, only on Timeline, acts as Add Log
  dateFabContainer: {
    position: 'absolute',
    left: 20,
    bottom: 150, // Above the nav bar
    zIndex: 100,
  },
  dateFab: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'visible', // Allow badge to overflow
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
    paddingTop: 2, // Slight adjustment for visual center
  },
  dateFabDay: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 30,
    textAlign: 'center',
  },
  dateFabDayDark: {
    color: '#ffffff',
  },
  dateFabMonth: {
    fontSize: 11,
    fontWeight: '700',
    color: '#11998e', // Use Timeline color for month
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: -2,
  },
  dateFabMonthDark: {
    color: '#38ef7d',
  },
  // Add indicator badge - positioned at bottom right
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

  // FLOATING ABOVE BOTTOM with margin
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
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  handleBarDark: {
    backgroundColor: 'rgba(255,255,255,0.25)',
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
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  } as ViewStyle,
  glassBackgroundDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
  },
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
  tabLabelDark: {
    color: '#aaa',
  },
  tabLabelCompact: {
    fontSize: 8,
    marginTop: 0,
    fontWeight: '700',
  },
  activeLabel: { 
    fontWeight: '800',
  } as TextStyle,
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
