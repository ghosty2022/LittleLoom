import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
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
import { format } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TabItem {
  name: string;
  shortName: string;
  icon: string;
  activeIcon: string;
  route: string;
  color: string;
  showInCompact?: boolean;
}

const TABS: TabItem[] = [
  { name: 'Home', shortName: 'H', icon: '🏠', activeIcon: '🏡', route: 'Home', color: '#667eea', showInCompact: true },
  { name: 'Community', shortName: 'C', icon: '👥', activeIcon: '👨‍👩‍👧‍👦', route: 'Community', color: '#fa709a', showInCompact: true },
  { name: 'Timeline', shortName: 'T', icon: '📜', activeIcon: '📅', route: 'Timeline', color: '#11998e', showInCompact: true },
  { name: 'Safety', shortName: 'S', icon: '🛡️', activeIcon: '🛡️', route: 'SafetyCorner', color: '#fc5c7d', showInCompact: false },
  { name: 'Settings', shortName: '⚙', icon: '⚙️', activeIcon: '🔧', route: 'Settings', color: '#43e97b', showInCompact: false },
];

const COMPACT_WIDTH = 140;
const EXPANDED_WIDTH = SCREEN_WIDTH - 32;
const TAB_BAR_HEIGHT = 75;
const COMPACT_TAB_BAR_HEIGHT = 60;
const COMPACT_OFFSET_X = -SCREEN_WIDTH + COMPACT_WIDTH + 48;

interface TabButtonProps {
  tab: TabItem;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  isCompact: boolean;
  index: number;
}

const TabButton: React.FC<TabButtonProps> = ({ 
  tab, 
  isActive, 
  onPress, 
  isDark, 
  isCompact,
  index 
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isActive ? 1.2 : isCompact ? 0.9 : 1,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }),
      Animated.spring(translateYAnim, {
        toValue: isActive ? -12 : isCompact && index >= 2 ? -20 : 0,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }),
      Animated.timing(glowAnim, {
        toValue: isActive ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, isCompact, index, scaleAnim, translateYAnim, glowAnim]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  if (isCompact && !tab.showInCompact && !isActive) {
    return (
      <View style={[styles.hiddenTab, { transform: [{ translateY: -30 }] }]}>
        <TouchableOpacity onPress={handlePress} style={styles.hiddenTabButton}>
          <Text style={styles.hiddenTabIcon}>{tab.icon}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[
        styles.tabButton, 
        isCompact && styles.tabButtonCompact,
        isCompact && index >= 2 && styles.tabButtonUpward
      ]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.glow,
          {
            opacity: glowAnim.__getValue(),
            transform: [{ scale: glowAnim.__getValue() === 0 ? 0.5 : 1.2 }],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient 
          colors={[tab.color + '40', tab.color + '10', 'transparent']} 
          style={styles.glowGradient} 
        />
      </View>

      <View 
        style={[
          styles.activeDot,
          { opacity: glowAnim.__getValue(), backgroundColor: tab.color }
        ]} 
        pointerEvents="none"
      />

      <View style={{ 
        transform: [{ scale: scaleAnim.__getValue() }, { translateY: translateYAnim.__getValue() }],
        zIndex: 10,
      }}>
        <Text style={[
          styles.tabEmoji, 
          isCompact && styles.tabEmojiCompact,
          isCompact && index >= 2 && styles.tabEmojiUpward
        ]}>
          {isActive ? tab.activeIcon : tab.icon}
        </Text>
      </View>

      <Text style={[
        styles.tabLabel, 
        isActive && [styles.activeLabel, { color: tab.color }],
        isDark && styles.tabLabelDark,
        isCompact && styles.tabLabelCompact
      ]}>
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
    isTimelineFabVisible,
    currentDate,
    isTimelineScreen,
    showNav 
  } = useNavigationContext();
  
  const activeIndex = state.index;
  const isDark = descriptors[state.routes[activeIndex].key].options.tabBarStyle?.backgroundColor === '#0a0a0a' || false;

  // Use regular state for values that need to trigger re-renders
  const [translateY, setTranslateY] = React.useState(0);
  const [translateX, setTranslateX] = React.useState(0);
  const [width, setWidth] = React.useState(EXPANDED_WIDTH);
  const [height, setHeight] = React.useState(TAB_BAR_HEIGHT);
  const [opacity, setOpacity] = React.useState(1);
  const [fabScale, setFabScale] = React.useState(1);

  // Animate using requestAnimationFrame approach instead of Animated API
  useEffect(() => {
    const targetY = isNavVisible ? 0 : 100;
    const targetX = isNavCompact ? COMPACT_OFFSET_X : 0;
    const targetWidth = isNavCompact ? COMPACT_WIDTH : EXPANDED_WIDTH;
    const targetHeight = isNavCompact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT;
    const targetOpacity = isNavVisible ? 1 : 0;
    
    // Simple interpolation for smooth transition
    const duration = 300;
    const startTime = Date.now();
    const startY = translateY;
    const startX = translateX;
    const startWidth = width;
    const startHeight = height;
    const startOpacity = opacity;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setTranslateY(startY + (targetY - startY) * eased);
      setTranslateX(startX + (targetX - startX) * eased);
      setWidth(startWidth + (targetWidth - startWidth) * eased);
      setHeight(startHeight + (targetHeight - startHeight) * eased);
      setOpacity(startOpacity + (targetOpacity - startOpacity) * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isNavVisible, isNavCompact]);

  // FAB animation
  useEffect(() => {
    const targetScale = isTimelineFabVisible ? 1 : 0;
    const duration = 300;
    const startTime = Date.now();
    const startScale = fabScale;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setFabScale(startScale + (targetScale - startScale) * eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isTimelineFabVisible]);

  const handlePress = useCallback((index: number, route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isNavCompact) {
      showNav();
    }
    
    const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route);
  }, [navigation, isNavCompact, showNav]);

  // Pan responder attached to outer View only
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20) {
          showNav();
        }
      },
    })
  ).current;

  const formattedDate = format(currentDate, 'EEE, MMM d');

  return (
    <>
      {/* Timeline Date Header */}
      {isTimelineScreen && (
        <View 
          style={[
            styles.dateHeader,
            { 
              opacity: opacity,
              transform: [{ translateY: translateY * 0.2 }], // Subtle parallax
            }
          ]}
          pointerEvents="none"
        >
          <BlurView intensity={60} style={styles.dateBlur} tint={isDark ? 'dark' : 'light'}>
            <Text style={[styles.dateText, isDark && styles.dateTextDark]}>
              {formattedDate}
            </Text>
          </BlurView>
        </View>
      )}

      {/* OUTER WRAPPER - Regular View with PanResponder */}
      <View 
        style={[
          styles.outerWrapper,
          { paddingBottom: Math.max(insets.bottom, 12) }
        ]}
        {...panResponder.panHandlers}
      >
        {/* ANIMATED CONTAINER - Regular View with transform styles */}
        <View 
          style={[
            styles.container,
            {
              transform: [
                { translateY: translateY },
                { translateX: translateX }
              ],
              opacity: opacity,
            }
          ]}
        >
          {/* Drag Handle */}
          <TouchableOpacity 
            style={styles.handle}
            onPress={showNav}
            activeOpacity={0.6}
          >
            <View style={[styles.handleBar, isDark && styles.handleBarDark]} />
          </TouchableOpacity>

          {/* Navigation Container with animated width/height */}
          <View style={[
            styles.navContainer,
            { width: width }
          ]}>
            <BlurView 
              intensity={Platform.OS === 'ios' ? 60 : 80} 
              style={[
                styles.glassBackground,
                { height: height },
                isDark && styles.glassBackgroundDark
              ]}
              tint={isDark ? 'dark' : 'light'}
            >
              <LinearGradient
                colors={isDark 
                  ? ['rgba(25,25,25,0.95)', 'rgba(15,15,15,0.8)', 'rgba(10,10,10,0.6)']
                  : ['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
                }
                style={StyleSheet.absoluteFill}
              />
              
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topHighlight}
              />

              <View style={styles.tabsContainer}>
                {TABS.map((tab, index) => (
                  <TabButton
                    key={tab.name}
                    tab={tab}
                    isActive={index === activeIndex}
                    onPress={() => handlePress(index, tab.route)}
                    isDark={isDark}
                    isCompact={isNavCompact}
                    index={index}
                  />
                ))}
              </View>
            </BlurView>

            {/* FAB with scale transform */}
            <View style={[
              styles.fabContainer,
              { transform: [{ scale: fabScale }] }
            ]}>
              <TouchableOpacity 
                style={styles.fab}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AddLog')}
              >
                <LinearGradient 
                  colors={['#11998e', '#38ef7d']} 
                  style={styles.fabGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.fabIcon}>+</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Peek Indicator */}
            {!isNavVisible && (
              <TouchableOpacity 
                style={styles.peekIndicator}
                onPress={showNav}
              >
                <BlurView intensity={80} style={styles.peekBlur} tint={isDark ? 'dark' : 'light'}>
                  <View style={styles.peekDot} />
                </BlurView>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  dateHeader: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 100,
  },
  dateBlur: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  dateTextDark: {
    color: '#ffffff',
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
    width: 40,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  
  handleBarDark: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  navContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  
  glassBackground: {
    borderRadius: 32,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  } as ViewStyle,
  
  glassBackgroundDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
  },
  
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
  },
  
  tabsContainer: { 
    flexDirection: 'row', 
    height: '100%', 
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  } as ViewStyle,
  
  tabButton: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 4,
    paddingHorizontal: 4,
    position: 'relative',
    minWidth: 56,
  } as ViewStyle,
  
  tabButtonCompact: {
    minWidth: 40,
    paddingHorizontal: 2,
  },
  
  tabButtonUpward: {
    marginTop: -15,
  },
  
  hiddenTab: {
    position: 'absolute',
    right: -20,
    top: 0,
  },
  
  hiddenTabButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  hiddenTabIcon: {
    fontSize: 16,
  },
  
  glow: { 
    position: 'absolute', 
    top: -5,
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    alignSelf: 'center',
    zIndex: 0,
  } as ViewStyle,
  
  glowGradient: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 30,
  } as ViewStyle,
  
  activeDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    zIndex: 0,
  },
  
  tabEmoji: { 
    fontSize: 24, 
    marginBottom: 2,
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
    fontSize: 11, 
    fontWeight: '600', 
    color: '#888', 
    textAlign: 'center',
    zIndex: 10,
    marginTop: 2,
  } as TextStyle,
  
  tabLabelDark: {
    color: '#aaa',
  },
  
  tabLabelCompact: {
    fontSize: 9,
    marginTop: 1,
  },
  
  activeLabel: { 
    fontWeight: '700',
  } as TextStyle,
  
  fabContainer: {
    position: 'absolute',
    right: -20,
    top: -25,
    zIndex: 100,
  },
  
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#11998e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  
  fabGradient: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center',
  } as ViewStyle,
  
  fabIcon: { 
    fontSize: 32, 
    color: 'white', 
    fontWeight: '300',
    marginTop: -2,
  } as TextStyle,
  
  peekIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  
  peekBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  peekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
});

export default LiquidGlassNavigation;