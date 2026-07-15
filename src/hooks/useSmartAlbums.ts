// src/hooks/useSmartAlbums.ts
import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import { Photo } from '../database';

export interface SmartAlbum {
  id: string;
  title: string;
  type: string;
  icon: string;
  gradient: [string, string];
  photoCount: number;
  coverPhoto?: Photo;
}

export function useSmartAlbums() {
  const { photoRepo, isReady } = useDatabase();
  const [albums, setAlbums] = useState<SmartAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlbums = useCallback(async () => {
    if (!isReady) return;
    
    setIsLoading(true);
    try {
      const dbAlbums = await photoRepo.query<SmartAlbum>(
        `SELECT * FROM "smart_albums" WHERE "isSystem" = 1 ORDER BY "sortOrder" ASC`
      );

      // Get photo counts and cover photos
      const enriched = await Promise.all(
        dbAlbums.map(async (album) => {
          const photos = await photoRepo.findByAlbum(album.id, { limit: 1 });
          const count = await photoRepo.count(
            album.id === 'album_all' ? {} :
            album.id === 'album_favorites' ? { isFavorite: true } :
            album.id === 'album_screenshots' ? { isScreenshot: true } :
            album.id === 'album_auto_import' ? { source: 'auto_import' } :
            album.id === 'album_vault' ? { isPrivate: true } :
            album.id === 'album_milestones' ? { type: 'milestone' } :
            {}
          );

          return {
            ...album,
            photoCount: count,
            coverPhoto: photos[0],
            gradient: JSON.parse(album.gradient as any) as [string, string],
          };
        })
      );

      setAlbums(enriched);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, photoRepo]);

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