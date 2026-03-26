
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// ==================== TYPES ====================
export type MediaType = 'avatar' | 'photo' | 'document' | 'milestone';
export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface MediaUpload {
  id: string;
  uri: string;
  type: MediaType;
  status: UploadStatus;
  progress: number;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    format?: string;
  };
}

export interface MediaState {
  uploads: MediaUpload[];
  isProcessing: boolean;
  cacheSize: number;
}

interface MediaContextType extends MediaState {
  // Image picking
  pickImage: (options?: ImagePicker.ImagePickerOptions) => Promise<string | null>;
  pickMultipleImages: (limit?: number) => Promise<string[]>;
  takePhoto: () => Promise<string | null>;
  
  // Upload management
  uploadImage: (uri: string, type: MediaType, id: string) => Promise<string>;
  uploadMultiple: (uris: string[], type: MediaType, id: string) => Promise<string[]>;
  cancelUpload: (uploadId: string) => void;
  retryUpload: (uploadId: string) => Promise<void>;
  
  // Image processing
  compressImage: (uri: string, quality?: number) => Promise<string>;
  resizeImage: (uri: string, width: number, height?: number) => Promise<string>;
  createThumbnail: (uri: string) => Promise<string>;
  
  // Cache management
  cacheImage: (uri: string) => Promise<string>;
  getCachedImage: (uri: string) => Promise<string | null>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
  
  // Utilities
  deleteImage: (uri: string) => Promise<boolean>;
  saveToLibrary: (uri: string) => Promise<boolean>;
  getImageDimensions: (uri: string) => Promise<{ width: number; height: number }>;
  
  // Batch operations
  processBatch: (uris: string[], operations: ('compress' | 'thumbnail')[]) => Promise<string[]>;
}

// ==================== CONTEXT ====================
const MediaContext = createContext<MediaContextType | null>(null);

// Constants
const CACHE_DIR = FileSystem.cacheDirectory + 'littleloom/';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_COMPRESSION = 0.8;
const MAX_IMAGE_DIMENSION = 2048;

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MediaState>({
    uploads: [],
    isProcessing: false,
    cacheSize: 0,
  });

  // ==================== HELPER FUNCTIONS ====================
  const ensureCacheDir = async (): Promise<string> => {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
    return CACHE_DIR;
  };

  const generateId = (): string => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const updateUpload = (id: string, updates: Partial<MediaUpload>) => {
    setState(prev => ({
      ...prev,
      uploads: prev.uploads.map(u => u.id === id ? { ...u, ...updates } : u),
    }));
  };

  // ==================== IMAGE PICKING ====================
  const pickImage = useCallback(async (
    options?: ImagePicker.ImagePickerOptions
  ): Promise<string | null> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to photos');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        ...options,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      return null;
    }
  }, []);

  const pickMultipleImages = useCallback(async (limit: number = 10): Promise<string[]> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to photos');
        return [];
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: limit,
        quality: 1,
      });

      if (!result.canceled) {
        return result.assets.map(asset => asset.uri);
      }
      return [];
    } catch (error) {
      console.error('Error picking multiple images:', error);
      return [];
    }
  }, []);

  const takePhoto = useCallback(async (): Promise<string | null> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
      return null;
    }
  }, []);

  // ==================== IMAGE PROCESSING ====================
  const compressImage = useCallback(async (
    uri: string, 
    quality: number = DEFAULT_COMPRESSION
  ): Promise<string> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      const manipulated = await manipulateAsync(
        uri,
        [],
        { compress: quality, format: SaveFormat.JPEG }
      );
      
      setState(prev => ({ ...prev, isProcessing: false }));
      return manipulated.uri;
    } catch (error) {
      setState(prev => ({ ...prev, isProcessing: false }));
      console.error('Error compressing image:', error);
      return uri;
    }
  }, []);

  const resizeImage = useCallback(async (
    uri: string,
    width: number,
    height?: number
  ): Promise<string> => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));
      
      // Get original dimensions
      const dimensions = await getImageDimensions(uri);
      
      // Calculate new dimensions maintaining aspect ratio
      let newWidth = width;
      let newHeight = height || (dimensions.height * width) / dimensions.width;
      
      if (!height && newHeight > MAX_IMAGE_DIMENSION) {
        newHeight = MAX_IMAGE_DIMENSION;
        newWidth = (dimensions.width * MAX_IMAGE_DIMENSION) / dimensions.height;
      }
      
      const manipulated = await manipulateAsync(
        uri,
        [{ resize: { width: newWidth, height: newHeight } }],
        { compress: DEFAULT_COMPRESSION, format: SaveFormat.JPEG }
      );
      
      setState(prev => ({ ...prev, isProcessing: false }));
      return manipulated.uri;
    } catch (error) {
      setState(prev => ({ ...prev, isProcessing: false }));
      console.error('Error resizing image:', error);
      return uri;
    }
  }, []);

  const createThumbnail = useCallback(async (uri: string): Promise<string> => {
    try {
      const manipulated = await manipulateAsync(
        uri,
        [{ resize: { width: 300 } }],
        { compress: 0.5, format: SaveFormat.JPEG }
      );
      return manipulated.uri;
    } catch (error) {
      console.error('Error creating thumbnail:', error);
      return uri;
    }
  }, []);

  const getImageDimensions = useCallback(async (
    uri: string
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve({ width: 0, height: 0 })
      );
    });
  }, []);

  // ==================== UPLOAD MANAGEMENT ====================
  const uploadImage = useCallback(async (
    uri: string,
    type: MediaType,
    id: string
  ): Promise<string> => {
    const uploadId = generateId();
    
    const newUpload: MediaUpload = {
      id: uploadId,
      uri,
      type,
      status: 'uploading',
      progress: 0,
    };
    
    setState(prev => ({
      ...prev,
      uploads: [newUpload, ...prev.uploads],
    }));

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        updateUpload(uploadId, { progress: i });
      }

      // Process and cache the image
      const processedUri = await cacheImage(uri);
      
      updateUpload(uploadId, { 
        status: 'success', 
        progress: 100,
        uri: processedUri 
      });
      
      return processedUri;
    } catch (error) {
      updateUpload(uploadId, { 
        status: 'error', 
        error: 'Upload failed' 
      });
      throw error;
    }
  }, []);

  const uploadMultiple = useCallback(async (
    uris: string[],
    type: MediaType,
    id: string
  ): Promise<string[]> => {
    const results: string[] = [];
    
    for (const uri of uris) {
      try {
        const uploadedUri = await uploadImage(uri, type, id);
        results.push(uploadedUri);
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }
    
    return results;
  }, []);

  const cancelUpload = useCallback((uploadId: string) => {
    updateUpload(uploadId, { status: 'error', error: 'Cancelled by user' });
  }, []);

  const retryUpload = useCallback(async (uploadId: string) => {
    const upload = state.uploads.find(u => u.id === uploadId);
    if (!upload) return;
    
    updateUpload(uploadId, { status: 'uploading', progress: 0, error: undefined });
    
    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        updateUpload(uploadId, { progress: i });
      }
      
      updateUpload(uploadId, { status: 'success', progress: 100 });
    } catch (error) {
      updateUpload(uploadId, { status: 'error', error: 'Retry failed' });
    }
  }, [state.uploads]);

  // ==================== CACHE MANAGEMENT ====================
  const cacheImage = useCallback(async (uri: string): Promise<string> => {
    try {
      await ensureCacheDir();
      
      const filename = uri.split('/').pop() || generateId();
      const cacheUri = CACHE_DIR + filename;
      
      // Check if already cached
      const fileInfo = await FileSystem.getInfoAsync(cacheUri);
      if (fileInfo.exists) {
        return cacheUri;
      }
      
      // Copy to cache
      await FileSystem.copyAsync({ from: uri, to: cacheUri });
      
      // Update cache size
      const size = await getCacheSize();
      setState(prev => ({ ...prev, cacheSize: size }));
      
      return cacheUri;
    } catch (error) {
      console.error('Error caching image:', error);
      return uri;
    }
  }, []);

  const getCachedImage = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const filename = uri.split('/').pop();
      if (!filename) return null;
      
      const cacheUri = CACHE_DIR + filename;
      const fileInfo = await FileSystem.getInfoAsync(cacheUri);
      
      return fileInfo.exists ? cacheUri : null;
    } catch (error) {
      return null;
    }
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
        await ensureCacheDir();
      }
      setState(prev => ({ ...prev, cacheSize: 0 }));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);

  const getCacheSize = useCallback(async (): Promise<number> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) return 0;
      
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      let totalSize = 0;
      
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(CACHE_DIR + file);
        if (fileInfo.exists && 'size' in fileInfo) {
          totalSize += fileInfo.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }, []);

  // ==================== UTILITIES ====================
  const deleteImage = useCallback(async (uri: string): Promise<boolean> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        
        // Update cache size if it was in cache
        if (uri.startsWith(CACHE_DIR)) {
          const size = await getCacheSize();
          setState(prev => ({ ...prev, cacheSize: size }));
        }
      }
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }, []);

  const saveToLibrary = useCallback(async (uri: string): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save photos');
        return false;
      }
      
      await MediaLibrary.saveToLibraryAsync(uri);
      return true;
    } catch (error) {
      console.error('Error saving to library:', error);
      return false;
    }
  }, []);

  // ==================== BATCH OPERATIONS ====================
  const processBatch = useCallback(async (
    uris: string[],
    operations: ('compress' | 'thumbnail')[]
  ): Promise<string[]> => {
    const results: string[] = [];
    
    setState(prev => ({ ...prev, isProcessing: true }));
    
    for (const uri of uris) {
      let processedUri = uri;
      
      try {
        if (operations.includes('compress')) {
          processedUri = await compressImage(processedUri);
        }
        
        if (operations.includes('thumbnail')) {
          processedUri = await createThumbnail(processedUri);
        }
        
        results.push(processedUri);
      } catch (error) {
        results.push(uri);
      }
    }
    
    setState(prev => ({ ...prev, isProcessing: false }));
    return results;
  }, [compressImage, createThumbnail]);

  const value = React.useMemo(() => ({
    ...state,
    pickImage,
    pickMultipleImages,
    takePhoto,
    uploadImage,
    uploadMultiple,
    cancelUpload,
    retryUpload,
    compressImage,
    resizeImage,
    createThumbnail,
    cacheImage,
    getCachedImage,
    clearCache,
    getCacheSize,
    deleteImage,
    saveToLibrary,
    getImageDimensions,
    processBatch,
  }), [
    state,
    pickImage,
    pickMultipleImages,
    takePhoto,
    uploadImage,
    uploadMultiple,
    cancelUpload,
    retryUpload,
    compressImage,
    resizeImage,
    createThumbnail,
    cacheImage,
    getCachedImage,
    clearCache,
    getCacheSize,
    deleteImage,
    saveToLibrary,
    getImageDimensions,
    processBatch,
  ]);

  return (
    <MediaContext.Provider value={value}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) throw new Error('useMedia must be used within MediaProvider');
  return context;
};

export default MediaProvider;
