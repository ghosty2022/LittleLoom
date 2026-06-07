import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ViewStyle,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationVisibility } from '../context/AppContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  onScroll?: (event: any) => void;
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

  const handleScrollEvent = (event: any) => {
    // Only handle scroll for nav visibility when NOT on community screens
    if (!isCommunityScreen) {
      handleScroll(event.nativeEvent.contentOffset.y, 0, event.nativeEvent.contentOffset.y <= 0);
    }
    onScroll?.(event);
  };

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
