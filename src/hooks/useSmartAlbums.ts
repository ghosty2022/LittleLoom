// src/hooks/useSmartAlbums.ts
import { useState, useEffect, useCallback } from 'react';
import { db } from '../database/db';
import { photos, smartAlbums } from '../database/schema';
import { eq, count, sql } from 'drizzle-orm';

export interface SmartAlbumWithCount {
  id: string;
  title: string;
  type: string;
  icon: string | null;
  gradient: [string, string] | null;
  photoCount: number;
  coverPhotoUri?: string;
}

export function useSmartAlbums() {
  const [albums, setAlbums] = useState<SmartAlbumWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlbums = useCallback(async () => {
    setIsLoading(true);
    try {
      const dbAlbums = await db.select().from(smartAlbums)
        .where(eq(smartAlbums.isSystem, true))
        .orderBy(smartAlbums.sortOrder);

      const enriched = await Promise.all(
        dbAlbums.map(async (album) => {
          let photoCount = 0;
          let coverPhotoUri: string | undefined;

          // Count photos based on album filter
          if (album.id === 'album_all') {
            const result = await db.select({ count: count() }).from(photos);
            photoCount = result[0]?.count || 0;
          } else if (album.id === 'album_favorites') {
            const result = await db.select({ count: count() }).from(photos)
              .where(eq(photos.isFavorite, true));
            photoCount = result[0]?.count || 0;
          } else if (album.id === 'album_screenshots') {
            const result = await db.select({ count: count() }).from(photos)
              .where(eq(photos.isScreenshot, true));
            photoCount = result[0]?.count || 0;
          } else if (album.id === 'album_auto_import') {
            const result = await db.select({ count: count() }).from(photos)
              .where(eq(photos.source, 'auto_import'));
            photoCount = result[0]?.count || 0;
          } else if (album.id === 'album_vault') {
            const result = await db.select({ count: count() }).from(photos)
              .where(eq(photos.isPrivate, true));
            photoCount = result[0]?.count || 0;
          } else if (album.id === 'album_milestones') {
            const result = await db.select({ count: count() }).from(photos)
              .where(eq(photos.type, 'milestone'));
            photoCount = result[0]?.count || 0;
          }

          // Get cover photo
          if (photoCount > 0) {
            const cover = await db.select({ uri: photos.uri }).from(photos)
              .orderBy(sql`${photos.timestamp} DESC`)
              .limit(1);
            coverPhotoUri = cover[0]?.uri;
          }

          return {
            ...album,
            photoCount,
            coverPhotoUri,
            gradient: album.gradient as [string, string] | null,
          };
        })
      );

      setAlbums(enriched);
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
