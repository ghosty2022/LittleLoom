// hooks/usePhotoCapture.ts
// Complete photo capture hook using expo-image-picker

import { useState, useCallback } from 'react';
import { Alert, Platform, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCustomization } from './useCustomization';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  type?: string;
  fileName?: string;
  fileSize?: number;
}

export interface UsePhotoCaptureOptions {
  maxPhotos?: number;
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  compress?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

const DEFAULT_OPTIONS: UsePhotoCaptureOptions = {
  maxPhotos: 5,
  quality: 0.85,
  allowsEditing: false,
  aspect: [4, 3],
  compress: true,
  maxWidth: 2048,
  maxHeight: 2048,
};

export function usePhotoCapture(options: UsePhotoCaptureOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { triggerHaptic } = useCustomization();

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // ─── Permission Helpers ────────────────────────────────────────

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPermissionDenied(true);
      Alert.alert(
        'Camera Access Needed',
        'Please allow camera access in Settings to take photos for your tracker entries.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }},
        ]
      );
      return false;
    }
    return true;
  }, []);

  const requestLibraryPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermissionDenied(true);
      Alert.alert(
        'Photo Library Access Needed',
        'Please allow photo library access to attach photos to your tracker entries.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }},
        ]
      );
      return false;
    }
    return true;
  }, []);

  // ─── Capture Methods ───────────────────────────────────────────

  const takePhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    if (photos.length >= (opts.maxPhotos || 5)) {
      Alert.alert('Photo Limit', `You can attach up to ${opts.maxPhotos} photos.`);
      return null;
    }

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return null;

    setIsCapturing(true);
    try {
      triggerHaptic('light');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: opts.allowsEditing,
        aspect: opts.aspect,
        quality: opts.quality,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const photo: CapturedPhoto = {
        uri: asset.uri,
        width: asset.width || 0,
        height: asset.height || 0,
        type: asset.type,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      };

      triggerHaptic('success');
      setPhotos(prev => [...prev, photo]);
      return photo;
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [photos.length, opts, requestCameraPermission, triggerHaptic]);

  const pickFromLibrary = useCallback(async (): Promise<CapturedPhoto[]> => {
    if (photos.length >= (opts.maxPhotos || 5)) {
      Alert.alert('Photo Limit', `You can attach up to ${opts.maxPhotos} photos.`);
      return [];
    }

    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return [];

    setIsCapturing(true);
    try {
      triggerHaptic('light');
      const remainingSlots = (opts.maxPhotos || 5) - photos.length;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        allowsEditing: false,
        quality: opts.quality,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      const newPhotos: CapturedPhoto[] = result.assets.map(asset => ({
        uri: asset.uri,
        width: asset.width || 0,
        height: asset.height || 0,
        type: asset.type,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      }));

      triggerHaptic('success');
      setPhotos(prev => [...prev, ...newPhotos]);
      return newPhotos;
    } catch (error) {
      console.error('Library error:', error);
      Alert.alert('Error', 'Failed to select photos. Please try again.');
      return [];
    } finally {
      setIsCapturing(false);
    }
  }, [photos.length, opts, requestLibraryPermission, triggerHaptic]);

  // ─── Photo Management ──────────────────────────────────────────

  const removePhoto = useCallback((index: number) => {
    triggerHaptic('light');
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, [triggerHaptic]);

  const reorderPhotos = useCallback((fromIndex: number, toIndex: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      const [moved] = newPhotos.splice(fromIndex, 1);
      newPhotos.splice(toIndex, 0, moved);
      return newPhotos;
    });
  }, []);

  const clearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  const setPhotosFromUris = useCallback((uris: string[]) => {
    setPhotos(uris.map(uri => ({ uri, width: 0, height: 0 })));
  }, []);

  // ─── Action Sheet Handler ──────────────────────────────────────

  const showPhotoOptions = useCallback(() => {
    Alert.alert(
      'Add Photo',
      'How would you like to add a photo?',
      [
        {
          text: '📷 Take Photo',
          onPress: () => takePhoto(),
        },
        {
          text: '🖼️ Choose from Library',
          onPress: () => pickFromLibrary(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, [takePhoto, pickFromLibrary]);

  return {
    photos,
    photoUris: photos.map(p => p.uri),
    isCapturing,
    permissionDenied,
    takePhoto,
    pickFromLibrary,
    removePhoto,
    reorderPhotos,
    clearPhotos,
    setPhotosFromUris,
    showPhotoOptions,
    setPhotos,
  };
}

export default usePhotoCapture;