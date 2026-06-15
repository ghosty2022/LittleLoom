import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';

import {
  pickImage,
  pickMultipleImages,
  takePhoto,
  compressImage,
  resizeImage,
  createThumbnail,
  getImageDimensions,
  cacheImage,
  getCachedImage,
  clearImageCache,
  getCacheSize,
  deleteImage,
  saveToPhotoLibrary,
  processImageBatch,
  ensureDirectory,
  CACHE_DIR,
  imageExists,
  getFileSize,
  readDirectory,
  isValidImageUri,
  type PickImageOptions,
  type SaveImageResult,
} from '../utils/imageUtils';

export type MediaType = 'avatar' | 'photo' | 'document' | 'milestone' | 'gallery';
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
  pickImage: (options?: PickImageOptions) => Promise<string | null>;
  pickMultipleImages: (limit?: number) => Promise<string[]>;
  takePhoto: () => Promise<string | null>;

  uploadImage: (uri: string, type: MediaType, id: string) => Promise<string>;
  uploadMultiple: (uris: string[], type: MediaType, id: string) => Promise<string[]>;
  cancelUpload: (uploadId: string) => void;
  retryUpload: (uploadId: string) => Promise<void>;

  compressImage: (uri: string, quality?: number) => Promise<string>;
  resizeImage: (uri: string, width: number, height?: number) => Promise<string>;
  createThumbnail: (uri: string) => Promise<string>;

  cacheImage: (uri: string) => Promise<string>;
  getCachedImage: (uri: string) => Promise<string | null>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;

  deleteImage: (uri: string) => Promise<boolean>;
  saveToLibrary: (uri: string) => Promise<boolean>;
  getImageDimensions: (uri: string) => Promise<{ width: number; height: number }>;

  processBatch: (uris: string[], operations: ('compress' | 'thumbnail')[]) => Promise<string[]>;

  isValidImageUri: (uri: string | undefined | null) => boolean;
}

const MediaContext = createContext<MediaContextType | null>(null);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MediaState>({
    uploads: [],
    isProcessing: false,
    cacheSize: 0,
  });

  const generateId = (): string => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const updateUpload = (id: string, updates: Partial<MediaUpload>) => {
    setState(prev => ({
      ...prev,
      uploads: prev.uploads.map(u => u.id === id ? { ...u, ...updates } : u),
    }));
  };

  const handlePickImage = useCallback(async (options?: PickImageOptions): Promise<string | null> => {
    return await pickImage(options);
  }, []);

  const handlePickMultiple = useCallback(async (limit: number = 10): Promise<string[]> => {
    return await pickMultipleImages(limit);
  }, []);

  const handleTakePhoto = useCallback(async (): Promise<string | null> => {
    return await takePhoto();
  }, []);

  const handleCompress = useCallback(async (uri: string, quality?: number): Promise<string> => {
    setState(prev => ({ ...prev, isProcessing: true }));
    const result = await compressImage(uri, quality);
    setState(prev => ({ ...prev, isProcessing: false }));
    return result;
  }, []);

  const handleResize = useCallback(async (uri: string, width: number, height?: number): Promise<string> => {
    setState(prev => ({ ...prev, isProcessing: true }));
    const result = await resizeImage(uri, width, height);
    setState(prev => ({ ...prev, isProcessing: false }));
    return result;
  }, []);

  const handleThumbnail = useCallback(async (uri: string): Promise<string> => {
    return await createThumbnail(uri);
  }, []);

  const uploadImage = useCallback(async (uri: string, type: MediaType, id: string): Promise<string> => {
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
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        updateUpload(uploadId, { progress: i });
      }

      const processedUri = await cacheImage(uri);

      const dims = await getImageDimensions(uri);
      const size = await getFileSize(uri);

      updateUpload(uploadId, {
        status: 'success',
        progress: 100,
        uri: processedUri,
        metadata: {
          width: dims.width,
          height: dims.height,
          size,
          format: 'jpeg',
        },
      });

      return processedUri;
    } catch (error) {
      updateUpload(uploadId, {
        status: 'error',
        error: 'Upload failed',
      });
      throw error;
    }
  }, []);

  const uploadMultiple = useCallback(async (uris: string[], type: MediaType, id: string): Promise<string[]> => {
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
  }, [uploadImage]);

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

  const handleCacheImage = useCallback(async (uri: string): Promise<string> => {
    const result = await cacheImage(uri);
    const size = await getCacheSize();
    setState(prev => ({ ...prev, cacheSize: size }));
    return result;
  }, []);

  const handleGetCached = useCallback(async (uri: string): Promise<string | null> => {
    return await getCachedImage(uri);
  }, []);

  const handleClearCache = useCallback(async (): Promise<void> => {
    await clearImageCache();
    setState(prev => ({ ...prev, cacheSize: 0 }));
  }, []);

  const handleGetCacheSize = useCallback(async (): Promise<number> => {
    const size = await getCacheSize();
    setState(prev => ({ ...prev, cacheSize: size }));
    return size;
  }, []);

  const handleDeleteImage = useCallback(async (uri: string): Promise<boolean> => {
    const success = await deleteImage(uri);
    if (success && uri.startsWith(CACHE_DIR)) {
      const size = await getCacheSize();
      setState(prev => ({ ...prev, cacheSize: size }));
    }
    return success;
  }, []);

  const handleSaveToLibrary = useCallback(async (uri: string): Promise<boolean> => {
    return await saveToPhotoLibrary(uri);
  }, []);

  const handleGetDimensions = useCallback(async (uri: string): Promise<{ width: number; height: number }> => {
    return await getImageDimensions(uri);
  }, []);

  const handleProcessBatch = useCallback(async (
    uris: string[],
    operations: ('compress' | 'thumbnail')[]
  ): Promise<string[]> => {
    setState(prev => ({ ...prev, isProcessing: true }));
    const results = await processImageBatch(uris, operations);
    setState(prev => ({ ...prev, isProcessing: false }));
    return results;
  }, []);

  const handleIsValidUri = useCallback((uri: string | undefined | null): boolean => {
    return isValidImageUri(uri);
  }, []);

  const value = useMemo(() => ({
    ...state,
    pickImage: handlePickImage,
    pickMultipleImages: handlePickMultiple,
    takePhoto: handleTakePhoto,
    uploadImage,
    uploadMultiple,
    cancelUpload,
    retryUpload,
    compressImage: handleCompress,
    resizeImage: handleResize,
    createThumbnail: handleThumbnail,
    cacheImage: handleCacheImage,
    getCachedImage: handleGetCached,
    clearCache: handleClearCache,
    getCacheSize: handleGetCacheSize,
    deleteImage: handleDeleteImage,
    saveToLibrary: handleSaveToLibrary,
    getImageDimensions: handleGetDimensions,
    processBatch: handleProcessBatch,
    isValidImageUri: handleIsValidUri,
  }), [
    state,
    handlePickImage,
    handlePickMultiple,
    handleTakePhoto,
    uploadImage,
    uploadMultiple,
    cancelUpload,
    retryUpload,
    handleCompress,
    handleResize,
    handleThumbnail,
    handleCacheImage,
    handleGetCached,
    handleClearCache,
    handleGetCacheSize,
    handleDeleteImage,
    handleSaveToLibrary,
    handleGetDimensions,
    handleProcessBatch,
    handleIsValidUri,
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
