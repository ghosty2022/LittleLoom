// src/utils/imageUtils.ts
// ✅ Use the legacy API
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

// Safely get directories with fallbacks
const getDocumentDir = (): string => {
  try {
    return FileSystem.documentDirectory || '';
  } catch {
    return '';
  }
};

const getCacheDir = (): string => {
  try {
    return FileSystem.cacheDirectory || '';
  } catch {
    return '';
  }
};

const DOC_DIR = getDocumentDir();
const CACHE_DIR_ROOT = getCacheDir();

export const CACHE_DIR = CACHE_DIR_ROOT ? `${CACHE_DIR_ROOT}littleloom/` : 'littleloom/';
export const PARENT_IMAGES_DIR = DOC_DIR ? `${DOC_DIR}parent_images/` : 'parent_images/';
export const GUARDIAN_IMAGES_DIR = DOC_DIR ? `${DOC_DIR}guardian_images/` : 'guardian_images/';
export const BABY_IMAGES_DIR = DOC_DIR ? `${DOC_DIR}baby_images/` : 'baby_images/';
export const MILESTONE_IMAGES_DIR = DOC_DIR ? `${DOC_DIR}milestone_images/` : 'milestone_images/';
export const GALLERY_DIR = DOC_DIR ? `${DOC_DIR}gallery/` : 'gallery/';

export const MAX_CACHE_SIZE = 100 * 1024 * 1024;
export const DEFAULT_COMPRESSION = 0.8;
export const MAX_IMAGE_DIMENSION = 2048;
export const THUMBNAIL_SIZE = 300;

// ─── SWEETALERT FALLBACK ────────────────────────────────────────────────────

type SweetAlertType = {
  alert: (title: string, message: string, type?: 'warning' | 'error' | 'success' | 'info') => void;
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
  toast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
};

let sweetAlertInstance: SweetAlertType | null = null;

export const setSweetAlert = (instance: SweetAlertType) => {
  sweetAlertInstance = instance;
};

const showAlert = (title: string, message: string, type: 'warning' | 'error' | 'success' | 'info' = 'warning') => {
  if (sweetAlertInstance) {
    sweetAlertInstance.alert(title, message, type);
  } else {
    Alert.alert(title, message);
  }
};

const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  if (sweetAlertInstance) {
    sweetAlertInstance.toast(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
};

// ─── DIRECTORY HELPERS ──────────────────────────────────────────────────────

export async function ensureDirectory(dir: string): Promise<void> {
  if (!dir || dir.length === 0) {
    console.warn('Attempted to ensure directory with empty path');
    return;
  }
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.code === 'EEXIST') {
      return;
    }
    console.error('Error ensuring directory:', error);
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

// ─── PATH HELPERS ───────────────────────────────────────────────────────────

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

// ─── FILE OPERATIONS ────────────────────────────────────────────────────────

export async function copyImage(sourceUri: string, destinationUri: string): Promise<boolean> {
  if (!sourceUri || !destinationUri) {
    return false;
  }
  
  try {
    const destPath = destinationUri.substring(0, destinationUri.lastIndexOf('/'));
    await ensureDirectory(destPath);
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    return true;
  } catch (error) {
    console.error('Error copying image:', error);
    return false;
  }
}

export async function deleteImage(uri: string): Promise<boolean> {
  if (!uri) return false;
  
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
  if (!uri) return false;
  
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists;
  } catch {
    return false;
  }
}

export async function getFileSize(uri: string): Promise<number> {
  if (!uri) return 0;
  
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
  } catch {
    return 0;
  }
}

export async function readDirectory(dir: string): Promise<string[]> {
  if (!dir) return [];
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) return [];
    return await FileSystem.readDirectoryAsync(dir);
  } catch {
    return [];
  }
}

// ─── IMAGE PICKER ──────────────────────────────────────────────────────────

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
      showAlert('Permission Required', 'Please allow access to photos to continue.', 'warning');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
    showAlert('Error', 'Failed to pick image. Please try again.', 'warning');
    return null;
  }
}

export async function pickMultipleImages(limit: number = 10): Promise<string[]> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Required', 'Please allow access to photos to continue.', 'warning');
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      showAlert('Permission Required', 'Please allow camera access to take photos.', 'warning');
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
    showAlert('Error', 'Failed to take photo. Please try again.', 'warning');
    return null;
  }
}

// ─── IMAGE PROCESSING ─────────────────────────────────────────────────────

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

// ─── CACHING ──────────────────────────────────────────────────────────────

export async function cacheImage(uri: string, customFilename?: string): Promise<string> {
  if (!uri) return '';
  
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
  if (!uri) return null;
  
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

// ─── SAVE IMAGE HELPERS ────────────────────────────────────────────────────

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

export async function saveToPhotoLibrary(uri: string): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Required', 'Please allow access to save photos to your library.', 'warning');
      return false;
    }

    await MediaLibrary.saveToLibraryAsync(uri);
    showToast('Image saved to gallery', 'success');
    return true;
  } catch (error) {
    console.error('Error saving to library:', error);
    return false;
  }
}

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────

export function normalizeStringValue(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return normalizeStringValue(value[0]);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

export function isValidImageUri(value: string | undefined | null | unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return isValidImageUri(value[0]);
  }
  if (typeof value !== 'string') return false;

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

export function isEmoji(value: string | undefined | null | unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return isEmoji(value[0]);
  }
  if (typeof value !== 'string') return false;

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

export function getAvatarDisplayValue(value: unknown): string | null {
  const normalized = normalizeStringValue(value);
  if (!normalized) return null;
  return normalized;
}

export function isDisplayableEmoji(value: unknown): boolean {
  const displayValue = getAvatarDisplayValue(value);
  if (!displayValue) return false;
  return isEmoji(displayValue);
}

// ─── EXPORT ──────────────────────────────────────────────────────────────

export const ImageUtils = {
  ensureDirectory,
  ensureAllImageDirs,
  CACHE_DIR,
  PARENT_IMAGES_DIR,
  GUARDIAN_IMAGES_DIR,
  BABY_IMAGES_DIR,
  MILESTONE_IMAGES_DIR,
  GALLERY_DIR,

  getParentImagePath,
  getGuardianImagePath,
  getBabyImagePath,
  getMilestoneImagePath,
  getGalleryPath,
  getCachePath,

  copyImage,
  deleteImage,
  imageExists,
  getFileSize,
  readDirectory,

  pickImage,
  pickMultipleImages,
  takePhoto,

  compressImage,
  resizeImage,
  createThumbnail,
  getImageDimensions,
  processImageBatch,

  cacheImage,
  getCachedImage,
  clearImageCache,
  getCacheSize,
  isCacheFull,

  saveParentImage,
  saveGuardianImage,
  saveBabyImage,
  saveGalleryImage,
  saveToPhotoLibrary,

  isValidImageUri,
  isEmoji,
  normalizeStringValue,
  getAvatarDisplayValue,
  isDisplayableEmoji,
  
  setSweetAlert,
};

export default ImageUtils;