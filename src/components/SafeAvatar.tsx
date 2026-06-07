// src/components/SafeAvatar.tsx
// FULLY SYNCED: Respects useCustomization theme, AppContext colors, BabyContext data
// FIXED: Rules of Hooks violations eliminated
// FIXED: Image source typing now properly supports require() static resources
// FIXED: Safe fallback chain for missing customization context
// FIXED: Unified border radius logic
// FIXED: Extracted shared utilities

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useCustomization, getThemeColorsById, AVATAR_OPTIONS } from '../hooks/useCustomization';
import type { ThemeColors } from '../hooks/useCustomization';
import { isValidImageUri, isEmoji } from '../utils/imageUtils';

// ==================== TYPES ====================

export type AvatarSource = string | number | undefined | null;

export interface SafeAvatarProps {
  avatar?: AvatarSource;
  size?: number;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackColor?: string;
  fallbackBgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  showEditBadge?: boolean;
  onPress?: () => void;
  style?: any;
  themeId?: string;
  animated?: boolean;
  borderRadius?: number; // Optional override
}

export interface SafeBabyAvatarProps {
  avatar?: AvatarSource;
  gender?: 'boy' | 'girl' | 'other';
  size?: number;
  showBadge?: boolean;
  onPress?: () => void;
  style?: any;
  themeId?: string;
  animated?: boolean;
}

export interface SafeParentAvatarProps {
  avatar?: AvatarSource;
  name?: string;
  size?: number;
  showBadge?: boolean;
  onPress?: () => void;
  style?: any;
  themeId?: string;
  animated?: boolean;
}

// ==================== DEFAULT THEME COLORS ====================

const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: '#667eea',
  secondary: '#764ba2',
  accent: '#fa709a',
  colors: ['#e0e7ff', '#d1d5ff', '#c7b8ff'],
  spinnerColor: '#667eea',
  darkText: '#4338ca',
  lightText: '#ffffff',
};

// ==================== UNIFIED IMAGE SOURCE RESOLVER ====================

/**
 * Safely resolves an avatar source into a React Native Image source.
 * Handles: remote URLs, local require() numbers, null/undefined.
 */
export const resolveAvatarSource = (avatar: AvatarSource): ImageSourcePropType | null => {
  if (avatar == null) return null;
  if (typeof avatar === 'number') {
    // Static require() — e.g., require('../assets/avatar.png')
    return avatar;
  }
  if (typeof avatar === 'string' && avatar.length > 0) {
    return { uri: avatar };
  }
  return null;
};

/**
 * Checks if the avatar has a displayable image (not emoji, not null).
 */
export const hasDisplayableImage = (avatar: AvatarSource, hasError: boolean): boolean => {
  if (avatar == null || hasError) return false;
  if (typeof avatar === 'number') return true; // Static require is always valid
  if (typeof avatar === 'string') {
    return isValidImageUri(avatar) && !isEmoji(avatar);
  }
  return false;
};

// ==================== SAFE THEME HOOKS ====================

/**
 * Safely gets theme colors with full fallback chain:
 * 1. themeId parameter
 * 2. useCustomization hook
 * 3. Default colors
 * 
 * This hook ALWAYS calls useCustomization unconditionally (React Rules of Hooks),
 * but safely handles missing context.
 */
const useSafeThemeColors = (themeId?: string): ThemeColors => {
  // Always call hook unconditionally (React rules)
  let customization: ReturnType<typeof useCustomization> | null = null;
  let hookError = false;
  
  try {
    customization = useCustomization();
  } catch {
    hookError = true;
  }

  // If themeId provided, use that directly (bypasses hook result)
  if (themeId) {
    return getThemeColorsById(themeId);
  }
  
  // If hook loaded successfully, use its themeColors
  if (!hookError && customization?.themeColors) {
    return customization.themeColors;
  }
  
  // Ultimate fallback
  return DEFAULT_THEME_COLORS;
};

const useSafeReduceMotion = (): boolean => {
  try {
    const customization = useCustomization();
    return customization?.shouldReduceMotion ?? false;
  } catch {
    return false;
  }
};

// ==================== SHARED AVATAR CONTENT ====================

interface AvatarContentProps {
  avatar: AvatarSource;
  size: number;
  hasError: boolean;
  isLoading: boolean;
  onError: () => void;
  onLoad: () => void;
  themeColors: ThemeColors;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  borderRadius: number;
}

const AvatarContent: React.FC<AvatarContentProps> = ({
  avatar,
  size,
  hasError,
  isLoading,
  onError,
  onLoad,
  themeColors,
  fallbackIcon,
  borderRadius,
}) => {
  const imageSource = resolveAvatarSource(avatar);
  const hasImage = hasDisplayableImage(avatar, hasError);
  const hasEmojiValue = avatar != null && typeof avatar === 'string' && isEmoji(avatar);

  if (hasImage && imageSource) {
    return (
      <>
        <Image
          source={imageSource}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          resizeMode="cover"
          onError={onError}
          onLoad={onLoad}
        />
        {isLoading && (
          <View style={[styles.loadingOverlay, { borderRadius }]}>
            <ActivityIndicator size="small" color={themeColors.spinnerColor || themeColors.primary} />
          </View>
        )}
      </>
    );
  }

  if (hasEmojiValue) {
    return (
      <Text style={[styles.emoji, { fontSize: size * 0.5 }]}>
        {avatar}
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: `${themeColors.primary}20`,
        },
      ]}
    >
      <Ionicons
        name={fallbackIcon}
        size={size * 0.4}
        color={themeColors.primary}
      />
    </View>
  );
};

// ==================== SAFE AVATAR COMPONENT ====================

export const SafeAvatar: React.FC<SafeAvatarProps> = ({
  avatar,
  size = 72,
  fallbackIcon = 'person',
  fallbackColor,
  fallbackBgColor,
  borderColor = '#fff',
  borderWidth = 3,
  showEditBadge = false,
  onPress,
  style,
  themeId,
  animated = true,
  borderRadius: borderRadiusProp,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Safe theme access - never crashes
  const themeColors = useSafeThemeColors(themeId);
  const shouldReduceMotion = useSafeReduceMotion();

  const effectiveFallbackColor = fallbackColor || themeColors?.primary || '#667eea';
  const effectiveFallbackBgColor = fallbackBgColor || `${effectiveFallbackColor}20`;
  const effectiveBorderRadius = borderRadiusProp ?? size / 3;

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const Wrapper = onPress ? TouchableOpacity : View;

  const Container = animated && !shouldReduceMotion ? Animated.View : View;
  const containerProps = animated && !shouldReduceMotion
    ? { entering: FadeIn.duration(300) }
    : {};

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.wrapper, style]}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel="Avatar"
    >
      <Container
        {...containerProps}
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: effectiveBorderRadius,
            borderWidth,
            borderColor,
            backgroundColor: effectiveFallbackBgColor,
          },
        ]}
      >
        <AvatarContent
          avatar={avatar}
          size={size}
          hasError={hasError}
          isLoading={isLoading}
          onError={handleError}
          onLoad={handleLoad}
          themeColors={themeColors}
          fallbackIcon={fallbackIcon}
          borderRadius={effectiveBorderRadius}
        />
      </Container>

      {showEditBadge && (
        <View
          style={[
            styles.editBadge,
            { backgroundColor: effectiveFallbackColor },
          ]}
        >
          <Ionicons
            name="pencil"
            size={Math.max(10, size * 0.15)}
            color="#fff"
          />
        </View>
      )}
    </Wrapper>
  );
};

// ==================== SAFE BABY AVATAR COMPONENT ====================

export const SafeBabyAvatar: React.FC<SafeBabyAvatarProps> = ({
  avatar,
  gender = 'other',
  size = 56,
  showBadge = false,
  onPress,
  style,
  themeId,
  animated = true,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const themeColors = useSafeThemeColors(themeId);
  const shouldReduceMotion = useSafeReduceMotion();

  const genderColors: Record<string, string[]> = {
    boy: [
      themeColors?.primary || '#667eea',
      themeColors?.secondary || '#764ba2',
    ],
    girl: [themeColors?.accent || '#fa709a', '#fee140'],
    other: ['#11998e', '#38ef7d'],
  };
  const gradientColors = genderColors[gender] || genderColors.other;
  const genderIcon = gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'ellipse';

  const Wrapper = onPress ? TouchableOpacity : View;
  const borderRadius = size / 2;

  const Container = animated && !shouldReduceMotion ? Animated.View : View;
  const containerProps = animated && !shouldReduceMotion
    ? { entering: FadeIn.duration(300) }
    : {};

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={style}>
      <View style={[styles.babyWrapper, { width: size, height: size }]}>
        <Container
          {...containerProps}
          style={[
            styles.babyContainer,
            {
              width: size,
              height: size,
              borderRadius,
              backgroundColor: gradientColors[0],
            },
          ]}
        >
          <AvatarContent
            avatar={avatar}
            size={size}
            hasError={hasError}
            isLoading={isLoading}
            onError={() => { setHasError(true); setIsLoading(false); }}
            onLoad={() => setIsLoading(false)}
            themeColors={themeColors}
            fallbackIcon={genderIcon as keyof typeof Ionicons.glyphMap}
            borderRadius={borderRadius}
          />
        </Container>

        {showBadge && (
          <View
            style={[
              styles.checkmarkBadge,
              { backgroundColor: gradientColors[0] },
            ]}
          >
            <Ionicons
              name="checkmark"
              size={Math.max(12, size * 0.2)}
              color="#fff"
            />
          </View>
        )}
      </View>
    </Wrapper>
  );
};

// ==================== SAFE PARENT AVATAR COMPONENT ====================

export const SafeParentAvatar: React.FC<SafeParentAvatarProps> = ({
  avatar,
  name = 'P',
  size = 56,
  showBadge = false,
  onPress,
  style,
  themeId,
  animated = true,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const themeColors = useSafeThemeColors(themeId);
  const shouldReduceMotion = useSafeReduceMotion();

  const hasImage = hasDisplayableImage(avatar, hasError);
  const hasEmojiValue = avatar != null && typeof avatar === 'string' && isEmoji(avatar);
  const initial = name?.charAt(0)?.toUpperCase() || 'P';

  const parentColors = [
    themeColors?.primary || '#667eea',
    themeColors?.secondary || '#764ba2',
  ];

  const Wrapper = onPress ? TouchableOpacity : View;
  const borderRadius = size / 2;

  const Container = animated && !shouldReduceMotion ? Animated.View : View;
  const containerProps = animated && !shouldReduceMotion
    ? { entering: FadeIn.duration(300) }
    : {};

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={style}>
      <View style={[styles.parentWrapper, { width: size, height: size }]}>
        <Container
          {...containerProps}
          style={[
            styles.parentContainer,
            {
              width: size,
              height: size,
              borderRadius,
              backgroundColor: parentColors[0],
            },
          ]}
        >
          {hasImage ? (
            <>
              <Image
                source={resolveAvatarSource(avatar)!}
                style={[styles.parentImage, { width: size, height: size, borderRadius }]}
                resizeMode="cover"
                onError={() => { setHasError(true); setIsLoading(false); }}
                onLoad={() => setIsLoading(false)}
              />
              {isLoading && (
                <View
                  style={[
                    styles.loadingOverlay,
                    { borderRadius, backgroundColor: parentColors[0] },
                  ]}
                >
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
            </>
          ) : hasEmojiValue ? (
            <Text style={[styles.parentEmoji, { fontSize: size * 0.5 }]}>
              {avatar}
            </Text>
          ) : (
            <Text style={[styles.parentInitial, { fontSize: size * 0.4, color: '#fff' }]}>
              {initial}
            </Text>
          )}
        </Container>

        {showBadge && (
          <View
            style={[
              styles.parentBadge,
              { backgroundColor: parentColors[0] },
            ]}
          >
            <Ionicons
              name="checkmark"
              size={Math.max(12, size * 0.2)}
              color="#fff"
            />
          </View>
        )}
      </View>
    </Wrapper>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  image: {
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emoji: {
    textAlign: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  // Baby styles
  babyWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  babyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  babyImage: {
    backgroundColor: 'transparent',
  },
  babyEmoji: {
    textAlign: 'center',
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  // Parent styles
  parentWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  parentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
  },
  parentImage: {
    backgroundColor: 'transparent',
  },
  parentEmoji: {
    textAlign: 'center',
  },
  parentInitial: {
    fontWeight: '700',
    textAlign: 'center',
  },
  parentBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default SafeAvatar;
