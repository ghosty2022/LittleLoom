// src/types/photos.ts
// Photo-specific types

export type PhotoType = 
  | 'milestone' 
  | 'daily' 
  | 'sleep' 
  | 'feeding' 
  | 'potty' 
  | 'growth' 
  | 'medication' 
  | 'tracker' 
  | 'auto_import';

export type PhotoSource = 
  | 'camera' 
  | 'gallery' 
  | 'auto_import' 
  | 'google_photos' 
  | 'icloud' 
  | 'tracker';

export type BackupStatus = 'synced' | 'pending' | 'failed';
export type SyncStatus = 'synced' | 'pending' | 'conflict';

export type BabyMood = 'happy' | 'neutral' | 'sad' | 'excited' | 'tired' | 'sleepy';

export interface PhotoFace {
  babyId: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PhotoExif {
  width?: number;
  height?: number;
  size?: number;
  device?: string;
  iso?: number;
  aperture?: string;
  focalLength?: string;
  exposure?: string;
  orientation?: number;
}

export interface LinkedEntry {
  type: 'milestone' | 'growth' | 'activity';
  id: string;
  title: string;
}