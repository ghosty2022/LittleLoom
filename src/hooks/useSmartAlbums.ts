// src/hooks/useSmartAlbums.ts

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface SmartAlbumWithCount {
  id: string;
  title: string;
  type: string;
  icon: string | null;
  gradient: [string, string] | null;
  photoCount: number;
  coverPhotoUri?: string;
}

// Smart album definitions
const SMART_ALBUMS = [
  { id: 'album_all', title: 'All Photos', type: 'system', icon: '📸', gradient: ['#667eea', '#764ba2'] },
  { id: 'album_favorites', title: 'Favorites', type: 'system', icon: '⭐', gradient: ['#f59e0b', '#f97316'] },
  { id: 'album_screenshots', title: 'Screenshots', type: 'system', icon: '📱', gradient: ['#3b82f6', '#8b5cf6'] },
  { id: 'album_auto_import', title: 'Auto Import', type: 'system', icon: '📥', gradient: ['#10b981', '#06b6d4'] },
  { id: 'album_vault', title: 'Vault', type: 'system', icon: '🔒', gradient: ['#ef4444', '#ec4899'] },
  { id: 'album_milestones', title: 'Milestones', type: 'system', icon: '🏆', gradient: ['#f59e0b', '#f472b6'] },
];

export function useSmartAlbums() {
  const [albums, setAlbums] = useState<SmartAlbumWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlbums = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch photos from Supabase
      const { data: photos, error } = await supabase
        .from('tracker_entries')
        .select('id, photo_uris, data, is_favorite, is_private, type, timestamp')
        .not('photo_uris', 'is', null)
        .order('timestamp', { ascending: false });

      if (error) {
        console.warn('[useSmartAlbums] Error fetching photos:', error.message);
        setAlbums([]);
        return;
      }

      // Count photos by album
      const counts: Record<string, number> = {};
      const coverPhotos: Record<string, string> = {};

      SMART_ALBUMS.forEach(album => {
        counts[album.id] = 0;
      });

      // Process photos
      photos?.forEach(photo => {
        const photoData = typeof photo.data === 'string' ? JSON.parse(photo.data) : photo.data || {};
        const uris = typeof photo.photo_uris === 'string' ? JSON.parse(photo.photo_uris) : photo.photo_uris;
        const firstUri = Array.isArray(uris) ? uris[0] : null;

        // All photos
        counts.album_all = (counts.album_all || 0) + 1;
        if (firstUri && !coverPhotos.album_all) coverPhotos.album_all = firstUri;

        // Favorites
        if (photo.is_favorite || photoData.isFavorite) {
          counts.album_favorites = (counts.album_favorites || 0) + 1;
          if (firstUri && !coverPhotos.album_favorites) coverPhotos.album_favorites = firstUri;
        }

        // Screenshots
        if (photo.is_screenshot || photoData.isScreenshot) {
          counts.album_screenshots = (counts.album_screenshots || 0) + 1;
          if (firstUri && !coverPhotos.album_screenshots) coverPhotos.album_screenshots = firstUri;
        }

        // Auto import
        if (photo.source === 'auto_import' || photoData.source === 'auto_import') {
          counts.album_auto_import = (counts.album_auto_import || 0) + 1;
          if (firstUri && !coverPhotos.album_auto_import) coverPhotos.album_auto_import = firstUri;
        }

        // Vault (private)
        if (photo.is_private || photoData.isPrivate) {
          counts.album_vault = (counts.album_vault || 0) + 1;
          if (firstUri && !coverPhotos.album_vault) coverPhotos.album_vault = firstUri;
        }

        // Milestones
        if (photo.type === 'milestone' || photoData.type === 'milestone') {
          counts.album_milestones = (counts.album_milestones || 0) + 1;
          if (firstUri && !coverPhotos.album_milestones) coverPhotos.album_milestones = firstUri;
        }
      });

      // Build albums with counts
      const enriched = SMART_ALBUMS.map(album => ({
        ...album,
        photoCount: counts[album.id] || 0,
        coverPhotoUri: coverPhotos[album.id],
        gradient: album.gradient as [string, string] | null,
      }));

      setAlbums(enriched);
    } catch (error) {
      console.error('[useSmartAlbums] Failed to load albums:', error);
      setAlbums([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  return {
    albums,
    isLoading,
    refresh: loadAlbums,
  };
}

export default useSmartAlbums;