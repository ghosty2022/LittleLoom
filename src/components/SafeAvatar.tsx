// src/components/SafeAvatar.tsx - FIXED VERSION
import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageSourcePropType,
  ImageStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { isValidImageUri, isEmoji } from '../utils/imageUtils';

export type AvatarSource = string | number | undefined | null;

export interface ThemeColorSet {
  primary: string;
  secondary: string;
  accent: string;
  spinnerColor: string;
}

const DEFAULT_THEME_COLORS: ThemeColorSet = {
  primary: '#667eea',
  secondary: '#764ba2',
  accent: '#fa709a',
  spinnerColor: '#667eea',
};

export interface SafeAvatarProps {
  avatar?: AvatarSource;
  avatarUrl?: string;
  size?: number;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackColor?: string;
  fallbackBgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  showEditBadge?: boolean;
  onPress?: () => void;
  style?: any;
  animated?: boolean;
  borderRadius?: number;
  imageSource?: ImageSourcePropType;
  themeColors?: ThemeColorSet;
  reduceMotion?: boolean;
}

export interface SafeBabyAvatarProps {
  avatar?: AvatarSource;
  avatarUrl?: string;
  gender?: 'boy' | 'girl' | 'other';
  size?: number;
  showBadge?: boolean;
  onPress?: () => void;
  style?: any;
  animated?: boolean;
  themeColors?: ThemeColorSet;
  reduceMotion?: boolean;
}

export interface SafeParentAvatarProps {
  avatar?: AvatarSource;
  name?: string;
  size?: number;
  showBadge?: boolean;
  onPress?: () => void;
  style?: any;
  animated?: boolean;
  themeColors?: ThemeColorSet;
  reduceMotion?: boolean;
}

/**
 * Safely resolves an avatar source into a React Native Image source.
 * Handles: remote URLs, local file:// URIs, data: URIs, static require() numbers, null/undefined.
 * FIXED: Properly handles arrays by converting to string or returning null.
 */
export const resolveAvatarSource = (avatar: AvatarSource): ImageSourcePropType | null => {
  // Handle null/undefined
  if (avatar == null) return null;
  
  // Handle arrays - extract first element or return null
  if (Array.isArray(avatar)) {
    // If array is empty, return null
    if (avatar.length === 0) return null;
    // Use the first element of the array
    const firstElement = avatar[0];
    // Recursively resolve the first element
    return resolveAvatarSource(firstElement);
  }
  
  // Handle numbers (require() assets)
  if (typeof avatar === 'number') {
    return avatar;
  }
  
  // Handle strings
  if (typeof avatar === 'string' && avatar.length > 0) {
    // Check if it's an emoji - these are not images
    if (isEmoji(avatar)) return null;
    
    // File URI
    if (avatar.startsWith('file://')) {
      return { uri: avatar };
    }
    // Content URI (Android content provider)
    if (avatar.startsWith('content://')) {
      return { uri: avatar };
    }
    // Data URI (base64)
    if (avatar.startsWith('data:')) {
      return { uri: avatar };
    }
    // Remote HTTP/HTTPS URL
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return { uri: avatar, cache: 'force-cache' };
    }
    // Absolute file path
    if (avatar.startsWith('/')) {
      return { uri: `file://${avatar}` };
    }
    // Supabase storage URL (might be missing protocol)
    if (avatar.includes('supabase.co')) {
      // Add protocol if missing
      if (!avatar.startsWith('http')) {
        return { uri: `https://${avatar}`, cache: 'force-cache' };
      }
      return { uri: avatar, cache: 'force-cache' };
    }
    // Any other string - assume it's a URI
    return { uri: avatar };
  }
  
  return null;
};

/**
 * Normalizes avatar value to a string or null.
 * FIXED: Ensures we always have a consistent type.
 */
export const normalizeAvatar = (avatar: AvatarSource): string | null => {
  if (avatar == null) return null;
  if (Array.isArray(avatar)) {
    if (avatar.length === 0) return null;
    // If first element is a string, return it
    if (typeof avatar[0] === 'string') return avatar[0];
    return null;
  }
  if (typeof avatar === 'string') return avatar;
  return null;
};

/**
 * Checks if the avatar has a displayable image (not emoji, not null).
 * FIXED: Handles arrays properly.
 */
export const hasDisplayableImage = (avatar: AvatarSource, hasError: boolean): boolean => {
  if (avatar == null || hasError) return false;
  
  // Handle arrays
  if (Array.isArray(avatar)) {
    if (avatar.length === 0) return false;
    // Check the first element
    return hasDisplayableImage(avatar[0], hasError);
  }
  
  if (typeof avatar === 'number') return true;
  if (typeof avatar === 'string') {
    if (isEmoji(avatar)) return false;
    const isValid = /^((file|content|https?):\/\/|data:image\/)/.test(avatar) || 
                    avatar.startsWith('/') ||
                    avatar.includes('supabase.co/storage/v1/object/public/') ||
                    /^[a-zA-Z0-9_\-]+\.[a-zA-Z]+$/.test(avatar);
    return isValid;
  }
  return false;
};

/**
 * Gets the display value for avatar (emoji or initial).
 * FIXED: Handles arrays properly.
 */
export const getAvatarDisplayValue = (avatar: AvatarSource): string | null => {
  if (avatar == null) return null;
  if (Array.isArray(avatar)) {
    if (avatar.length === 0) return null;
    return getAvatarDisplayValue(avatar[0]);
  }
  if (typeof avatar === 'string') return avatar;
  return null;
};

interface AvatarContentProps {
  avatar: AvatarSource;
  size: number;
  hasError: boolean;
  isLoading: boolean;
  onError: () => void;
  onLoad: () => void;
  themeColors: ThemeColorSet;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  borderRadius: number;
  imageSource?: ImageSourcePropType;
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
  imageSource,
}) => {
  // Normalize avatar to a consistent value
  const normalizedAvatar = useMemo(() => normalizeAvatar(avatar), [avatar]);
  
  if (imageSource) {
    return (
      <>
        <Image
          source={imageSource}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          resizeMode="contain"
          onError={onError}
          onLoad={onLoad}
          accessible={true}
          accessibilityLabel="Avatar image"
        />
        {isLoading && (
          <View style={[styles.loadingOverlay, { borderRadius }]}>
            <ActivityIndicator size="small" color={themeColors.spinnerColor || themeColors.primary} />
          </View>
        )}
      </>
    );
  }

  const imageSourceResolved = resolveAvatarSource(normalizedAvatar);
  const hasImage = hasDisplayableImage(normalizedAvatar, hasError);
  const displayValue = getAvatarDisplayValue(normalizedAvatar);
  const hasEmojiValue = displayValue != null && isEmoji(displayValue);

  if (hasImage && imageSourceResolved) {
    const sourceWithCache = typeof normalizedAvatar === 'string' && normalizedAvatar.startsWith('http')
      ? { uri: normalizedAvatar, cache: 'force-cache' }
      : imageSourceResolved;
      
    return (
      <>
        <Image
          source={sourceWithCache}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          resizeMode="cover"
          onError={onError}
          onLoad={onLoad}
          accessible={true}
          accessibilityLabel="Avatar image"
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
        {displayValue}
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

export const SafeAvatar: React.FC<SafeAvatarProps> = ({
  avatar,
  avatarUrl,
  size = 72,
  fallbackIcon = 'person',
  fallbackColor,
  fallbackBgColor,
  borderColor = '#fff',
  borderWidth = 3,
  showEditBadge = false,
  onPress,
  style,
  animated = true,
  borderRadius: borderRadiusProp,
  imageSource,
  themeColors: propThemeColors,
  reduceMotion,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const themeColors = propThemeColors || DEFAULT_THEME_COLORS;
  const shouldReduceMotion = reduceMotion ?? false;

  // Use avatarUrl if provided, otherwise use avatar
  // FIXED: Normalize both sources to handle arrays
  const effectiveAvatar = useMemo(() => {
    if (avatarUrl != null) return normalizeAvatar(avatarUrl);
    return normalizeAvatar(avatar);
  }, [avatarUrl, avatar]);

  const effectiveFallbackColor = fallbackColor || themeColors.primary;
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
          avatar={effectiveAvatar}
          size={size}
          hasError={hasError}
          isLoading={isLoading}
          onError={handleError}
          onLoad={handleLoad}
          themeColors={themeColors}
          fallbackIcon={fallbackIcon}
          borderRadius={effectiveBorderRadius}
          imageSource={imageSource}
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

export const SafeBabyAvatar: React.FC<SafeBabyAvatarProps> = ({
  avatar,
  avatarUrl,
  gender = 'other',
  size = 56,
  showBadge = false,
  onPress,
  style,
  animated = true,
  themeColors: propThemeColors,
  reduceMotion,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const themeColors = propThemeColors || DEFAULT_THEME_COLORS;
  const shouldReduceMotion = reduceMotion ?? false;

  // FIXED: Normalize both sources to handle arrays
  const effectiveAvatar = useMemo(() => {
    if (avatarUrl != null) return normalizeAvatar(avatarUrl);
    return normalizeAvatar(avatar);
  }, [avatarUrl, avatar]);

  const genderColors: Record<string, string[]> = {
    boy: [themeColors.primary, themeColors.secondary],
    girl: [themeColors.accent, '#fee140'],
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
            avatar={effectiveAvatar}
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

export const SafeParentAvatar: React.FC<SafeParentAvatarProps> = ({
  avatar,
  name = 'P',
  size = 56,
  showBadge = false,
  onPress,
  style,
  animated = true,
  themeColors: propThemeColors,
  reduceMotion,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const themeColors = propThemeColors || DEFAULT_THEME_COLORS;
  const shouldReduceMotion = reduceMotion ?? false;

  // FIXED: Normalize avatar to handle arrays
  const effectiveAvatar = useMemo(() => normalizeAvatar(avatar), [avatar]);
  
  const hasImage = hasDisplayableImage(effectiveAvatar, hasError);
  const displayValue = getAvatarDisplayValue(effectiveAvatar);
  const hasEmojiValue = displayValue != null && isEmoji(displayValue);
  const initial = name?.charAt(0)?.toUpperCase() || 'P';

  const parentColors = [themeColors.primary, themeColors.secondary];

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
                source={resolveAvatarSource(effectiveAvatar)!}
                style={[styles.parentImage, { width: size, height: size, borderRadius }]}
                resizeMode="cover"
                onError={() => { setHasError(true); setIsLoading(false); }}
                onLoad={() => setIsLoading(false)}
                accessible={true}
                accessibilityLabel="Parent avatar image"
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
              {displayValue}
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