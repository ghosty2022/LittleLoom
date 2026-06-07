// src/utils/imageUtils.ts
// UNIFIED Image Utilities — single source of truth for all image operations
// Used by: MediaContext, SafeAvatar, GalleryScreen, Profile screens, etc.

import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// ==================== DIRECTORY CONSTANTS ====================

const BASE_DIR = FileSystem.documentDirectory || '';
export const CACHE_DIR = FileSystem.cacheDirectory + 'littleloom/';
export const PARENT_IMAGES_DIR = BASE_DIR + 'parent_images/';
export const GUARDIAN_IMAGES_DIR = BASE_DIR + 'guardian_images/';
export const BABY_IMAGES_DIR = BASE_DIR + 'baby_images/';
export const MILESTONE_IMAGES_DIR = BASE_DIR + 'milestone_images/';
export const GALLERY_DIR = BASE_DIR + 'gallery/';

export const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
export const DEFAULT_COMPRESSION = 0.8;
export const MAX_IMAGE_DIMENSION = 2048;
export const THUMBNAIL_SIZE = 300;

// ==================== DIRECTORY MANAGEMENT ====================

export async function ensureDirectory(dir: string): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function ensureAllImageDirs(): Promise<void> {
  await Promise.all([
    ensureDirectory(CACHE_DIR),
    ensureDirectory(PARENT_IMAGES_DIR),
    ensureDirectory(GUARDIAN_IMAGES_DIR),
    ensureDirectory(BABY_IMAGES_DIR),
    ensureDirectory(MILESTONE_IMAGES_DIR),
    ensureDirectory(GALLERY_DIR),
  ]);
}

// ==================== PATH HELPERS ====================

export function getParentImagePath(parentId: string): string {
  return `${PARENT_IMAGES_DIR}${parentId}_avatar_${Date.now()}.jpg`;
}

export function getGuardianImagePath(guardianId: string): string {
  return `${GUARDIAN_IMAGES_DIR}${guardianId}_avatar_${Date.now()}.jpg`;
}

export function getBabyImagePath(babyId: string): string {
  return `${BABY_IMAGES_DIR}${babyId}_avatar_${Date.now()}.jpg`;
}

export function getMilestoneImagePath(milestoneId: string): string {
  return `${MILESTONE_IMAGES_DIR}${milestoneId}_${Date.now()}.jpg`;
}

export function getGalleryPath(filename: string): string {
  return `${GALLERY_DIR}${filename}`;
}

export function getCachePath(filename: string): string {
  return `${CACHE_DIR}${filename}`;
}

// ==================== FILE OPERATIONS ====================

export async function copyImage(sourceUri: string, destinationUri: string): Promise<boolean> {
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    return true;
  } catch (copyError) {
    console.log('copyAsync failed, trying downloadAsync fallback:', copyError);
    try {
      await FileSystem.downloadAsync(sourceUri, destinationUri);
      return true;
    } catch (downloadError) {
      console.error('Both copy and download failed:', downloadError);
      return false;
    }
  }
}

export async function deleteImage(uri: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

export async function imageExists(uri: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists;
  } catch {
    return false;
  }
}

export async function getFileSize(uri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
  } catch {
    return 0;
  }
}

export async function readDirectory(dir: string): Promise<string[]> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) return [];
    return await FileSystem.readDirectoryAsync(dir);
  } catch {
    return [];
  }
}

// ==================== IMAGE PICKING ====================

export interface PickImageOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  allowsMultiple?: boolean;
  selectionLimit?: number;
}

export async function pickImage(options?: PickImageOptions): Promise<string | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to photos to continue.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options?.allowsEditing ?? true,
      aspect: options?.aspect ?? [1, 1],
      quality: options?.quality ?? 1,
      allowsMultipleSelection: options?.allowsMultiple ?? false,
      selectionLimit: options?.selectionLimit ?? 10,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert('Error', 'Failed to pick image. Please try again.');
    return null;
  }
}

export async function pickMultipleImages(limit: number = 10): Promise<string[]> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to photos to continue.');
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 1,
    });

    if (!result.canceled && result.assets) {
      return result.assets.map(asset => asset.uri);
    }
    return [];
  } catch (error) {
    console.error('Error picking multiple images:', error);
    return [];
  }
}

export async function takePhoto(options?: PickImageOptions): Promise<string | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access to take photos.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: options?.allowsEditing ?? true,
      aspect: options?.aspect ?? [1, 1],
      quality: options?.quality ?? 1,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    Alert.alert('Error', 'Failed to take photo. Please try again.');
    return null;
  }
}

// ==================== IMAGE PROCESSING ====================

export async function compressImage(uri: string, quality: number = DEFAULT_COMPRESSION): Promise<string> {
  try {
    const manipulated = await manipulateAsync(
      uri,
      [],
      { compress: quality, format: SaveFormat.JPEG }
    );
    return manipulated.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return uri;
  }
}

export async function resizeImage(uri: string, width: number, height?: number): Promise<string> {
  try {
    const dimensions = await getImageDimensions(uri);

    let newWidth = width;
    let newHeight = height || (dimensions.height * width) / dimensions.width;

    if (!height && newHeight > MAX_IMAGE_DIMENSION) {
      newHeight = MAX_IMAGE_DIMENSION;
      newWidth = (dimensions.width * MAX_IMAGE_DIMENSION) / dimensions.height;
    }

    const resizeAction: any = { resize: { width: Math.round(newWidth) } };
    if (height) {
      resizeAction.resize.height = Math.round(newHeight);
    }

    const manipulated = await manipulateAsync(
      uri,
      [resizeAction],
      { compress: DEFAULT_COMPRESSION, format: SaveFormat.JPEG }
    );
    return manipulated.uri;
  } catch (error) {
    console.error('Error resizing image:', error);
    return uri;
  }
}

export async function createThumbnail(uri: string, size: number = THUMBNAIL_SIZE): Promise<string> {
  try {
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: size } }],
      { compress: 0.5, format: SaveFormat.JPEG }
    );
    return manipulated.uri;
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    return uri;
  }
}

export async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 })
    );
  });
}

export async function processImageBatch(
  uris: string[],
  operations: ('compress' | 'thumbnail' | 'resize')[] = ['compress'],
  resizeWidth?: number
): Promise<string[]> {
  const results: string[] = [];

  for (const uri of uris) {
    let processedUri = uri;

    try {
      if (operations.includes('compress')) {
        processedUri = await compressImage(processedUri);
      }
      if (operations.includes('resize') && resizeWidth) {
        processedUri = await resizeImage(processedUri, resizeWidth);
      }
      if (operations.includes('thumbnail')) {
        processedUri = await createThumbnail(processedUri);
      }
      results.push(processedUri);
    } catch (error) {
      console.error('Error processing image in batch:', error);
      results.push(uri);
    }
  }

  return results;
}

// ==================== CACHE MANAGEMENT ====================

export async function cacheImage(uri: string, customFilename?: string): Promise<string> {
  try {
    await ensureDirectory(CACHE_DIR);

    const filename = customFilename || uri.split('/').pop() || `${Date.now()}.jpg`;
    const cacheUri = getCachePath(filename);

    const fileInfo = await FileSystem.getInfoAsync(cacheUri);
    if (fileInfo.exists) {
      return cacheUri;
    }

    await FileSystem.copyAsync({ from: uri, to: cacheUri });
    return cacheUri;
  } catch (error) {
    console.error('Error caching image:', error);
    return uri;
  }
}

export async function getCachedImage(uri: string): Promise<string | null> {
  try {
    const filename = uri.split('/').pop();
    if (!filename) return null;

    const cacheUri = getCachePath(filename);
    const fileInfo = await FileSystem.getInfoAsync(cacheUri);

    return fileInfo.exists ? cacheUri : null;
  } catch {
    return null;
  }
}

export async function clearImageCache(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await ensureDirectory(CACHE_DIR);
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export async function getCacheSize(): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) return 0;

    const files = await readDirectory(CACHE_DIR);
    let totalSize = 0;

    for (const file of files) {
      const size = await getFileSize(getCachePath(file));
      totalSize += size;
    }

    return totalSize;
  } catch {
    return 0;
  }
}

export async function isCacheFull(): Promise<boolean> {
  const size = await getCacheSize();
  return size >= MAX_CACHE_SIZE;
}

// ==================== COMPLETE SAVE FLOWS ====================

export interface SaveImageResult {
  success: boolean;
  uri: string | null;
  error?: string;
}

export async function saveParentImage(parentId: string): Promise<SaveImageResult> {
  try {
    const tempUri = await pickImage();
    if (!tempUri) return { success: false, uri: null, error: 'No image selected' };

    await ensureDirectory(PARENT_IMAGES_DIR);
    const permanentUri = getParentImagePath(parentId);
    const success = await copyImage(tempUri, permanentUri);

    if (success) return { success: true, uri: permanentUri };
    return { success: false, uri: null, error: 'Failed to save image' };
  } catch (error) {
    console.error('Error saving parent image:', error);
    return { success: false, uri: null, error: 'Failed to save profile picture' };
  }
}

export async function saveGuardianImage(guardianId: string): Promise<SaveImageResult> {
  try {
    const tempUri = await pickImage();
    if (!tempUri) return { success: false, uri: null, error: 'No image selected' };

    await ensureDirectory(GUARDIAN_IMAGES_DIR);
    const permanentUri = getGuardianImagePath(guardianId);
    const success = await copyImage(tempUri, permanentUri);

    if (success) return { success: true, uri: permanentUri };
    return { success: false, uri: null, error: 'Failed to save image' };
  } catch (error) {
    console.error('Error saving guardian image:', error);
    return { success: false, uri: null, error: 'Failed to save profile picture' };
  }
}

export async function saveBabyImage(babyId: string): Promise<SaveImageResult> {
  try {
    const tempUri = await pickImage();
    if (!tempUri) return { success: false, uri: null, error: 'No image selected' };

    await ensureDirectory(BABY_IMAGES_DIR);
    const permanentUri = getBabyImagePath(babyId);
    const success = await copyImage(tempUri, permanentUri);

    if (success) return { success: true, uri: permanentUri };
    return { success: false, uri: null, error: 'Failed to save image' };
  } catch (error) {
    console.error('Error saving baby image:', error);
    return { success: false, uri: null, error: 'Failed to save profile picture' };
  }
}

export async function saveGalleryImage(filename: string, sourceUri: string): Promise<SaveImageResult> {
  try {
    await ensureDirectory(GALLERY_DIR);
    const permanentUri = getGalleryPath(filename);
    const success = await copyImage(sourceUri, permanentUri);

    if (success) return { success: true, uri: permanentUri };
    return { success: false, uri: null, error: 'Failed to save to gallery' };
  } catch (error) {
    console.error('Error saving gallery image:', error);
    return { success: false, uri: null, error: 'Failed to save to gallery' };
  }
}

// ==================== MEDIA LIBRARY ====================

export async function saveToPhotoLibrary(uri: string): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to save photos to your library.');
      return false;
    }

    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch (error) {
    console.error('Error saving to library:', error);
    return false;
  }
}

// ==================== VALIDATION ====================

export function isValidImageUri(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  const validPrefixes = [
    'http://', 'https://', 'file://', 'data:image/',
    'asset:', 'content://', 'ph://', 'rni://',
  ];

  if (validPrefixes.some(prefix => trimmed.startsWith(prefix))) return true;

  if (/^\/.+\.(jpg|jpeg|png|gif|webp|bmp|heic|svg)$/i.test(trimmed)) return true;
  if (/^[a-zA-Z]:[\\\/].+\.(jpg|jpeg|png|gif|webp|bmp|heic|svg)$/i.test(trimmed)) return true;

  if (trimmed.startsWith('data:')) return true;
  if (/^\d+$/.test(trimmed)) return true;

  return false;
}

export function isEmoji(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 8) return false;
  const code = value.codePointAt(0) || 0;
  return (
    (code >= 0x1f600 && code <= 0x1f64f) ||
    (code >= 0x1f300 && code <= 0x1f5ff) ||
    (code >= 0x1f680 && code <= 0x1f6ff) ||
    (code >= 0x1f1e0 && code <= 0x1f1ff) ||
    (code >= 0x2600 && code <= 0x26ff) ||
    (code >= 0x2700 && code <= 0x27bf) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    code === 0x2b50 ||
    code === 0x2b55 ||
    code === 0x2764 ||
    code === 0x2763
  );
}

// ==================== NAMESPACE EXPORT ====================

export const ImageUtils = {
  // Directories
  ensureDirectory,
  ensureAllImageDirs,
  CACHE_DIR,
  PARENT_IMAGES_DIR,
  GUARDIAN_IMAGES_DIR,
  BABY_IMAGES_DIR,
  MILESTONE_IMAGES_DIR,
  GALLERY_DIR,

  // Paths
  getParentImagePath,
  getGuardianImagePath,
  getBabyImagePath,
  getMilestoneImagePath,
  getGalleryPath,
  getCachePath,

  // File operations
  copyImage,
  deleteImage,
  imageExists,
  getFileSize,
  readDirectory,

  // Picking
  pickImage,
  pickMultipleImages,
  takePhoto,

  // Processing
  compressImage,
  resizeImage,
  createThumbnail,
  getImageDimensions,
  processImageBatch,

  // Cache
  cacheImage,
  getCachedImage,
  clearImageCache,
  getCacheSize,
  isCacheFull,

  // Save flows
  saveParentImage,
  saveGuardianImage,
  saveBabyImage,
  saveGalleryImage,

  // Library
  saveToPhotoLibrary,

  // Validation
  isValidImageUri,
  isEmoji,
};

export default ImageUtils;