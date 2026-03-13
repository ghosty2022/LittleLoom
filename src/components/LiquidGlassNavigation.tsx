import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MainTabParamList } from '../types';

const { width } = Dimensions.get('window');

interface TabItem {
  name: keyof MainTabParamList;
  emoji: string;
  route: keyof MainTabParamList;
}

interface LiquidGlassNavigationProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const TABS: TabItem[] = [
  { name: 'Home', emoji: '🏠', route: 'Home' },
  { name: 'Community', emoji: '👥', route: 'Community' },
  { name: 'Timeline', emoji: '📜', route: 'Timeline' },
  { name: 'Customize', emoji: '🎨', route: 'Customize' },
  { name: 'Settings', emoji: '⚙️', route: 'Settings' },
];

const GLOW_SIZE = 60;

const TabButton = ({ 
  tab, 
  index, 
  isActive, 
  onPress 
}: { 
  tab: TabItem; 
  index: number; 
  isActive: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(isActive ? -8 : 0, { damping: 12, stiffness: 200 });
    glowOpacity.value = withTiming(isActive ? 1 : 0, { duration: 300 });
  }, [isActive, translateY, glowOpacity]);

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(0.9, { damping: 15 });
    })
    .onEnd(() => {
      runOnJS(onPress)();
    })
    .onFinalize(() => {
      scale.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(
      glowOpacity.value,
      [0, 1],
      [0.5, 1.2],
      Extrapolation.CLAMP
    ) }],
  }));

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[styles.tabButton, animatedStyle]}>
        <Animated.View style={[styles.glow, glowStyle]}>
          <LinearGradient
            colors={['#667eea40', '#764ba220', 'transparent']}
            style={styles.glowGradient}
          />
        </Animated.View>
        
        <Animated.View style={[styles.activeBackground, { opacity: glowOpacity.value }]}>
          <BlurView intensity={80} style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['#667eea30', '#764ba220']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
        </Animated.View>

        <Text style={[styles.tabEmoji, isActive && styles.activeEmoji]}>
          {tab.emoji}
        </Text>
        <Text style={[styles.tabLabel, isActive && styles.activeLabel]}>
          {tab.name}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
};

export default function LiquidGlassNavigation({ state, navigation }: LiquidGlassNavigationProps) {
  const insets = useSafeAreaInsets();
  const activeIndex = state.index;

  const handlePress = useCallback((index: number, route: keyof MainTabParamList) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const event = navigation.emit({
      type: 'tabPress',
      target: route,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(route);
    }
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 60 : 100} style={styles.glassBackground}>
        <LinearGradient
          colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.tabsContainer}>
          {TABS.map((tab, index) => (
            <TabButton
              key={tab.name}
              tab={tab}
              index={index}
              isActive={index === activeIndex}
              onPress={() => handlePress(index, tab.route)}
            />
          ))}
        </View>

        <View style={styles.liquidBorder}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.8)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.borderGradient}
          />
        </View>
      </BlurView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <BlurView intensity={100} style={styles.fabBlur}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.fabGradient}>
            <Text style={styles.fabText}>+</Text>
          </LinearGradient>
        </BlurView>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glassBackground: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 32,
    overflow: 'hidden',
    height: 90,
    width: width - 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: '100%',
    paddingTop: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  glow: {
    position: 'absolute',
    top: 0,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    alignSelf: 'center',
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: GLOW_SIZE / 2,
  },
  activeBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    margin: 4,
  },
  tabEmoji: { fontSize: 24, marginBottom: 4 },
  activeEmoji: { fontSize: 28 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#666' },
  activeLabel: { color: '#667eea', fontWeight: '700' },
  liquidBorder: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    overflow: 'hidden',
  },
  borderGradient: { width: '100%', height: '100%' },
  fab: {
    position: 'absolute',
    right: 32,
    top: -25,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  fabBlur: { width: '100%', height: '100%' },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { fontSize: 32, color: 'white', fontWeight: '300', marginTop: -4 },
});