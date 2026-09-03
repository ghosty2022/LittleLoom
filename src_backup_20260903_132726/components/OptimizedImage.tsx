import React, { memo, useCallback, useState } from 'react';
import { Image as RNImage, ImageProps as RNImageProps, ImageSourcePropType, View, ActivityIndicator } from 'react-native';

interface OptimizedImageProps extends Omit<RNImageProps, 'source'> {
  source: ImageSourcePropType;
  width?: number;
  height?: number;
  priority?: 'low' | 'normal' | 'high';
  contentFit?: 'cover' | 'contain' | 'stretch' | 'center';
  cachePolicy?: string;
  transition?: any;
  /** Show placeholder while loading */
  showPlaceholder?: boolean;
  placeholderColor?: string;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image fails */
  onError?: () => void;
}

// ─── FIX #1: Static resizeMode map, no string manipulation per render ──
const RESIZE_MODE_MAP: Record<string, RNImageProps['resizeMode']> = {
  contain: 'contain',
  stretch: 'stretch',
  center: 'center',
  cover: 'cover',
};

const OptimizedImage = memo<OptimizedImageProps>(({
  source,
  style,
  width,
  height,
  priority,
  contentFit = 'cover',
  cachePolicy,
  transition,
  showPlaceholder = false,
  placeholderColor = '#e2e8f0',
  onLoad: onLoadProp,
  onError: onErrorProp,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoadProp?.();
  }, [onLoadProp]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onErrorProp?.();
  }, [onErrorProp]);

  const resizeMode = RESIZE_MODE_MAP[contentFit] ?? 'cover';

  // ─── FIX #2: Memoized style array, no new object per render ─────────
  const imageStyle = React.useMemo(() => {
    const baseStyle: any = { width, height };
    if (style) {
      return [baseStyle, style];
    }
    return baseStyle;
  }, [width, height, style]);

  if (hasError) {
    return (
      <View style={[{ width, height, backgroundColor: placeholderColor, justifyContent: 'center', alignItems: 'center' }, style]}>
        {/* Optional: error icon or retry button */}
      </View>
    );
  }

  return (
    <>
      <RNImage
        source={source}
        style={imageStyle}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={handleError}
        fadeDuration={transition ? 300 : 0}
        {...props}
      />
      {showPlaceholder && isLoading && (
        <View style={[{ position: 'absolute', width, height, backgroundColor: placeholderColor, justifyContent: 'center', alignItems: 'center' }, style]}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
    </>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;