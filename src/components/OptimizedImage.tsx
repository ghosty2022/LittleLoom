import React, { memo, useCallback, useState } from 'react';
import {
  Image as RNImage,
  ImageProps as RNImageProps,
  ImageSourcePropType,
  View,
  ActivityIndicator,
  StyleProp,
  ImageStyle,
} from 'react-native';

interface OptimizedImageProps extends Omit<RNImageProps, 'source'> {
  source: ImageSourcePropType;
  width?: number;
  height?: number;
  showPlaceholder?: boolean;
  placeholderColor?: string;
  containerStyle?: StyleProp<ImageStyle>;
}

const OptimizedImage = memo<OptimizedImageProps>(({
  source,
  style,
  width,
  height,
  showPlaceholder = false,
  placeholderColor = '#e2e8f0',
  containerStyle,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  const dimensions = width !== undefined && height !== undefined
    ? { width, height }
    : {};

  if (hasError) {
    return (
      <View style={[
        { backgroundColor: placeholderColor, justifyContent: 'center', alignItems: 'center' },
        dimensions,
        containerStyle,
      ]} />
    );
  }

  return (
    <View style={[{ position: 'relative', overflow: 'hidden' }, dimensions, containerStyle]}>
      <RNImage
        source={source}
        style={[dimensions, style]}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      {showPlaceholder && isLoading && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: placeholderColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
    </View>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;