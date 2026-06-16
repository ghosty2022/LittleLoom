import React, { memo } from 'react';
import { Image as RNImage, ImageProps as RNImageProps, ImageSourcePropType } from 'react-native';

interface OptimizedImageProps extends Omit<RNImageProps, 'source'> {
  source: ImageSourcePropType;
  width?: number;
  height?: number;
  priority?: 'low' | 'normal' | 'high';
  contentFit?: 'cover' | 'contain' | 'stretch' | 'center';
  cachePolicy?: string;
  transition?: any;
}

const OptimizedImage = memo<OptimizedImageProps>(({
  source,
  style,
  width,
  height,
  priority,
  contentFit,
  cachePolicy,
  transition,
  ...props
}) => {
  return (
    <RNImage
      source={source}
      style={[{ width, height }, style]}
      resizeMode={contentFit === 'contain' ? 'contain' : contentFit === 'stretch' ? 'stretch' : contentFit === 'center' ? 'center' : 'cover'}
      {...props}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
