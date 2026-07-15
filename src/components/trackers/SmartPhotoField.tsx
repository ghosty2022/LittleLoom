// components/trackers/SmartPhotoField.tsx
// Full-featured photo capture field for tracker forms

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { usePhotoCapture, CapturedPhoto } from '../../hooks/usePhotoCapture';
import { FieldConfig } from '../../types/trackers';

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_W - 80) / 3;
const MAX_PHOTOS_DEFAULT = 5;

interface SmartPhotoFieldProps {
  field: FieldConfig;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  trackerColor: string;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  maxPhotos?: number;
}

// ─── Photo Thumbnail ────────────────────────────────────────────

const PhotoThumbnail: React.FC<{
  photo: CapturedPhoto;
  index: number;
  onRemove: (index: number) => void;
  onPress: (index: number) => void;
  trackerColor: string;
  borderRadiusValue: number;
}> = ({ photo, index, onRemove, onPress, trackerColor, borderRadiusValue }) => {
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).springify()}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(index)}
        style={[
          styles.thumbnailContainer,
          { borderRadius: borderRadiusValue },
        ]}
      >
        <Image
          source={{ uri: photo.uri }}
          style={[
            styles.thumbnailImage,
            { borderRadius: borderRadiusValue },
          ]}
          resizeMode="cover"
        />

        {/* Remove button */}
        <TouchableOpacity
          style={[
            styles.removeBtn,
            {
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: borderRadiusValue / 2,
            },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="close" size={14} color="#fff" />
        </TouchableOpacity>

        {/* Photo index badge */}
        <View style={[styles.indexBadge, { backgroundColor: trackerColor }]}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Add Photo Button ───────────────────────────────────────────

const AddPhotoButton: React.FC<{
  onPress: () => void;
  trackerColor: string;
  borderRadiusValue: number;
  disabled?: boolean;
  isLoading?: boolean;
}> = ({ onPress, trackerColor, borderRadiusValue, disabled, isLoading }) => (
  <TouchableOpacity
    style={[
      styles.addButton,
      {
        borderColor: trackerColor,
        borderRadius: borderRadiusValue,
        backgroundColor: `${trackerColor}08`,
        opacity: disabled ? 0.5 : 1,
      },
    ]}
    onPress={onPress}
    disabled={disabled || isLoading}
    activeOpacity={0.8}
  >
    {isLoading ? (
      <ActivityIndicator size="small" color={trackerColor} />
    ) : (
      <>
        <Ionicons name="camera-outline" size={28} color={trackerColor} />
        <Text style={[styles.addButtonText, { color: trackerColor }]}>
          Add Photo
        </Text>
      </>
    )}
  </TouchableOpacity>
);

// ─── Photo Viewer Modal ─────────────────────────────────────────

const PhotoViewerModal: React.FC<{
  visible: boolean;
  photos: CapturedPhoto[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (index: number) => void;
}> = ({ visible, photos, initialIndex, onClose, onDelete }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, visible]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Remove Photo?',
      'This photo will be removed from this entry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onDelete(currentIndex);
            if (photos.length <= 1) {
              onClose();
            } else if (currentIndex >= photos.length - 1) {
              setCurrentIndex(Math.max(0, photos.length - 2));
            }
          },
        },
      ]
    );
  }, [currentIndex, photos.length, onDelete, onClose]);

  if (photos.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.viewerOverlay} onPress={onClose}>
        <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />

        <View style={styles.viewerContent}>
          {/* Top bar */}
          <View style={styles.viewerTopBar}>
            <TouchableOpacity onPress={onClose} style={styles.viewerBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.viewerCounter}>
              {currentIndex + 1} / {photos.length}
            </Text>
            <TouchableOpacity onPress={handleDelete} style={styles.viewerBtn}>
              <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          </View>

          {/* Photo */}
          {photos[currentIndex] && (
            <Image
              source={{ uri: photos[currentIndex].uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.viewerStrip}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {photos.map((photo, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setCurrentIndex(idx)}
                  style={[
                    styles.viewerStripItem,
                    idx === currentIndex && styles.viewerStripItemActive,
                  ]}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.viewerStripImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Pressable>
    </Modal>
  );
};

// ─── Main Component ────────────────────────────────────────────

export const SmartPhotoField: React.FC<SmartPhotoFieldProps> = ({
  field,
  value,
  onChange,
  trackerColor,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  maxPhotos = MAX_PHOTOS_DEFAULT,
}) => {
  const {
    photos,
    isCapturing,
    removePhoto,
    setPhotosFromUris,
    showPhotoOptions,
  } = usePhotoCapture({ maxPhotos });

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Sync external value -> internal photos
  useEffect(() => {
    if (value && value.length > 0) {
      const currentUris = photos.map(p => p.uri);
      const hasChanges = value.length !== currentUris.length || 
        value.some((v, i) => v !== currentUris[i]);
      if (hasChanges) {
        setPhotosFromUris(value);
      }
    } else if (photos.length > 0 && (!value || value.length === 0)) {
      // External cleared us
      setPhotosFromUris([]);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync internal photos -> external value
  useEffect(() => {
    const uris = photos.map(p => p.uri);
    const currentValue = value || [];
    const hasChanges = uris.length !== currentValue.length ||
      uris.some((v, i) => v !== currentValue[i]);
    if (hasChanges) {
      onChange(uris);
    }
  }, [photos]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemove = useCallback((index: number) => {
    removePhoto(index);
  }, [removePhoto]);

  const handleViewPhoto = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const canAddMore = photos.length < maxPhotos;

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={[
        styles.label,
        { color: colors.text, fontSize: 15 * fontSizeMultiplier },
      ]}>
        {field.label}
        {field.required && <Text style={[styles.required, { color: colors.error }]}> *</Text>}
        <Text style={[styles.photoCount, { color: colors.textSecondary }]}>
          {' '}({photos.length}/{maxPhotos})
        </Text>
      </Text>

      {/* Photo Grid */}
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <PhotoThumbnail
            key={`${photo.uri}-${index}`}
            photo={photo}
            index={index}
            onRemove={handleRemove}
            onPress={handleViewPhoto}
            trackerColor={trackerColor}
            borderRadiusValue={borderRadiusValue}
          />
        ))}

        {canAddMore && (
          <AddPhotoButton
            onPress={showPhotoOptions}
            trackerColor={trackerColor}
            borderRadiusValue={borderRadiusValue}
            disabled={isCapturing}
            isLoading={isCapturing}
          />
        )}
      </View>

      {/* Helper text */}
      {photos.length === 0 && (
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Tap to add photos from camera or gallery
        </Text>
      )}

      {/* Photo Viewer */}
      <PhotoViewerModal
        visible={viewerVisible}
        photos={photos}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
        onDelete={(idx) => {
          handleRemove(idx);
          if (photos.length <= 1) {
            setViewerVisible(false);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontWeight: '600',
    marginBottom: 10,
  },
  required: {
    fontWeight: '700',
  },
  photoCount: {
    fontWeight: '500',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbnailContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  indexBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  indexText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  addButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Viewer Modal
  viewerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerContent: {
    flex: 1,
    width: '100%',
    paddingTop: 60,
    paddingBottom: 20,
  },
  viewerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  viewerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerCounter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  viewerImage: {
    flex: 1,
    width: '100%',
  },
  viewerStrip: {
    paddingTop: 16,
    maxHeight: 80,
  },
  viewerStripItem: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  viewerStripItemActive: {
    borderColor: '#fff',
  },
  viewerStripImage: {
    width: '100%',
    height: '100%',
  },
});

export default SmartPhotoField;