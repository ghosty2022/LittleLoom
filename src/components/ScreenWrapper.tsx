// src/components/ScreenWrapper.tsx
import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationState } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../context/AppContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  forceHideTabBar?: boolean;
  extraBottomPadding?: number;
}

const DOCK_HEIGHT = 72;
const SAFE_BOTTOM = 8;

// Routes where tab bar is hidden — add bottom padding accordingly
const HIDDEN_TAB_BAR_ROUTES = new Set([
  'SecurityLock', 'BiometricSetup',
  'CommunitySplash', 'CommunityOnboarding',
  'Track', 'Grow', 'Connect', 'More', // These hide tab bar when entering
  // All sub-screens are also hidden but they're not in main tabs
]);

// Main tabs where nav always stays visible (only Home)
const ALWAYS_VISIBLE_ROUTES = new Set(['Home']);

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  scrollable = true,
  refreshControl,
  contentContainerStyle,
  style,
  onScroll,
  scrollEventThrottle = 16,
  forceHideTabBar = false,
  extraBottomPadding = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || route.name;
    }
    return route.name;
  });

  const isHidden = HIDDEN_TAB_BAR_ROUTES.has(routeName) || forceHideTabBar;
  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  // Calculate bottom padding:
  // - Hidden routes: just safe area bottom
  // - Home: safe area + dock height
  // - Other tabs (when tab bar shows briefly): same as hidden since they hide on enter
  // Actually, the tab bar handles its own visibility. We just need to ensure content isn't cut off.
  // For Home: add dock height. For others: just safe area since tab bar hides.
  
  const bottomPadding = isAlwaysVisible && !forceHideTabBar
    ? Math.max(insets.bottom, SAFE_BOTTOM) + DOCK_HEIGHT + extraBottomPadding
    : Math.max(insets.bottom, SAFE_BOTTOM) + extraBottomPadding;

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }, style]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        overScrollMode="never"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: bottomPadding }, style]}>
      {children}
    </View>
  );
};

export const AnimatedScreenWrapper: React.FC<ScreenWrapperProps> = (props) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const routeName = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) {
      const nested = route.state as any;
      return nested.routes?.[nested.index ?? 0]?.name || route.name;
    }
    return route.name;
  });

  const isAlwaysVisible = ALWAYS_VISIBLE_ROUTES.has(routeName);

  const bottomPadding = isAlwaysVisible && !props.forceHideTabBar
    ? Math.max(insets.bottom, SAFE_BOTTOM) + DOCK_HEIGHT + (props.extraBottomPadding || 0)
    : Math.max(insets.bottom, SAFE_BOTTOM) + (props.extraBottomPadding || 0);

  return (
    <Animated.ScrollView
      style={[styles.container, { backgroundColor: colors.background }, props.style]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: bottomPadding },
        props.contentContainerStyle,
      ]}
      onScroll={props.onScroll}
      scrollEventThrottle={props.scrollEventThrottle || 16}
      refreshControl={props.refreshControl}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {props.children}
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flexGrow: 1 },
});

export default ScreenWrapper;