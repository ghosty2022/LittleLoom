import React, { useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ViewStyle,
  useColorScheme,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationVisibility } from '../context/AppContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const DOCK_HEIGHT = 120; // Height of LiquidGlassNavigation dock
const COMMUNITY_BOTTOM = 20; // Minimal padding when tab bar is hidden

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  scrollable = true,
  refreshControl,
  contentContainerStyle,
  style,
  onScroll,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { handleScroll, isCommunityScreen } = useNavigationVisibility();

  // Track scroll state for velocity computation
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const isAtTopRef = useRef(true);

  const handleScrollEvent = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    const currentY = contentOffset.y;
    const now = Date.now();
    const deltaTime = now - lastTimeRef.current;

    // Compute velocity in pixels per ms (same unit as useTrackedScroll)
    const velocity = deltaTime > 0 ? Math.abs((currentY - lastYRef.current) / deltaTime) : 0;
    const isAtTop = currentY <= 5;
    isAtTopRef.current = isAtTop;

    // Only handle scroll for nav visibility when NOT on community screens
    if (!isCommunityScreen) {
      handleScroll(currentY, velocity, isAtTop);
    }

    // Update refs
    lastYRef.current = currentY;
    lastTimeRef.current = now;

    onScroll?.(event);
  }, [handleScroll, isCommunityScreen, onScroll]);

  // Reset scroll tracking when community screen state changes
  React.useEffect(() => {
    lastYRef.current = 0;
    lastTimeRef.current = Date.now();
    isAtTopRef.current = true;
  }, [isCommunityScreen]);

  // Use minimal bottom padding on community screens (no dock), full padding elsewhere
  const bottomPadding = isCommunityScreen
    ? Math.max(insets.bottom, 12) + COMMUNITY_BOTTOM
    : Math.max(insets.bottom, 12) + DOCK_HEIGHT;

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, isDark && styles.containerDark, style]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
        onScroll={handleScrollEvent}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isDark && styles.containerDark,
        { paddingBottom: bottomPadding },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faff',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  contentContainer: {
    flexGrow: 1,
  },
});

export default ScreenWrapper;