// src/types/database.ts
// Re-export all database types for convenience

export type {
  Photo,
  PhotoFilter,
  DateGroup,
} from '../database/repositories/PhotoRepository';

export type {
  TrackerEntry,
  TrackerStats,
  TimeRange,
} from '../database/repositories/TrackerRepository';

export type {
  Baby,
} from '../database/repositories/BabyRepository';

export type {
  QueryOptions,
  PaginatedResult,
} from '../database/repositories/BaseRepository';