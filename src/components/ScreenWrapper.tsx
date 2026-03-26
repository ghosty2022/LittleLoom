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
import { useNavigationContext } from '../context/NavigationContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  onScroll?: (event: any) => void;
}

const DOCK_HEIGHT = 100; // Height of LiquidGlassNavigation dock

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
  const { handleScroll } = useNavigationContext();

  const handleScrollEvent = (event: any) => {
    // Pass scroll event to navigation context for dock hide/show
    handleScroll(event);
    // Also call custom onScroll if provided
    onScroll?.(event);
  };

  const bottomPadding = Math.max(insets.bottom, 12) + DOCK_HEIGHT;

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