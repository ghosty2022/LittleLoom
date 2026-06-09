// src/types/trackers.ts
// UNIFIED: Single source of truth for ALL trackers — default + custom
// Eliminates ActivityEntry field explosion by using dynamic schema-driven data
// Syncs across BabyContext, FamilyContext, and any screen

import { ActivityType as LegacyActivityType } from '../context/BabyContext';

// ─── Categories ───
export type TrackerCategory =
  | 'essential'
  | 'health'
  | 'development'
  | 'emotional'
  | 'physical'
  | 'nutrition'
  | 'safety'
  | 'schedule'
  | 'parental'
  | 'travel'
  | 'special_needs'
  | 'custom';

// ─── Field System (the magic: no more hardcoded ActivityEntry fields) ───
export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'toggle'
  | 'duration'
  | 'rating'
  | 'textarea'
  | 'photo'
  | 'video'
  | 'date'
  | 'time'
  | 'datetime'
  | 'temperature'
  | 'measurement'
  | 'counter'
  | 'slider'
  | 'checkbox'
  | 'mood_emoji'; // Special: shows 5 emoji faces

export interface FieldOption {
  id: string;
  label: string;
  emoji?: string;
  icon?: string;
  color?: string;
}

export interface FieldConfig {
  id: string;                    // e.g., "amount", "quality", "location"
  label: string;                 // Display label
  type: FieldType;
  options?: FieldOption[];       // For select/multiselect
  placeholder?: string;
  required?: boolean;
  unit?: string;                 // e.g., "ml", "°C", "min"
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
  // Conditional visibility: show this field only if condition met
  showIf?: {
    field: string;               // Other field id to check
    equals?: string | boolean | number;
    notEquals?: string | boolean | number;
    contains?: string;         // For multiselect
  };
}

// ─── Unified Tracker Config ───
export interface UnifiedTrackerConfig {
  id: string;                    // Matches ActivityType: 'feed', 'sleep', 'custom_xyz'
  name: string;                  // "Feeding", "Sleep", "My Custom Tracker"
  emoji: string;
  icon: string;                  // Ionicons name
  color: string;                 // Primary brand color
  gradient: [string, string];    // Card gradient
  description: string;
  category: TrackerCategory;
  fields: FieldConfig[];         // Dynamic schema — NO hardcoded fields!
  quickTags: string[];           // Suggested tags for quick entry
  isCustom: boolean;
  createdBy?: string;            // userId who created it (null = system)
  createdAt: number;
  updatedAt: number;
  // Permissions: who can use/modify this tracker
  permissions: {
    familyRoles: ('parent1' | 'parent2' | 'guardian')[];
    allowGuardiansCreate: boolean; // Can guardians create entries?
    allowGuardiansEditOwn: boolean;
    allowGuardiansDeleteOwn: boolean;
  };
}

// ─── Tracker Entry (replaces bloated ActivityEntry) ───
// All tracker data lives in `data` — schema-validated at runtime
export interface TrackerEntry {
  id: string;
  babyId: string;
  trackerId: string;             // Links to UnifiedTrackerConfig.id
  timestamp: number;
  title: string;                 // Auto-generated or user-edited
  data: Record<string, unknown>; // Dynamic: { amount: 120, unit: 'ml', side: 'left' }
  // Metadata
  loggedBy: string;              // userId
  loggedByName: string;            // Display name at time of log
  loggedByRole: 'parent1' | 'parent2' | 'guardian';
  notes?: string;
  photoUris?: string[];          // Multiple photos
  videoUri?: string;
  voiceMemoUri?: string;
  tags?: string[];
  // Location (optional)
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  // Sync & reminders
  notificationId?: string;
  reminderScheduled?: boolean;
  syncedAt?: string;
  // Family collaboration
  editedBy?: string;             // If edited by someone else
  editedAt?: number;
  isDeleted?: boolean;           // Soft delete for sync
}

// ─── Storage Keys ───
export const TRACKER_STORAGE_KEYS = {
  CUSTOM_TRACKERS: '@littleloom_custom_trackers_v2',
  TRACKER_SETTINGS: '@littleloom_tracker_settings_v2',
  LAST_TRACKER: '@littleloom_last_tracker_id',
  ENTRIES_PREFIX: (babyId: string) => `@littleloom_entries_${babyId}`,
  ENTRIES_INDEX: (babyId: string) => `@littleloom_entries_index_${babyId}`,
} as const;

// ─── Default Tracker IDs (70+ built-in) ───
export const DEFAULT_TRACKER_IDS = [
  // Essential Daily (6)
  'potty', 'diaper', 'feed', 'pumping', 'sleep', 'bath',
  // Health & Medical (10)
  'growth', 'temperature', 'medication', 'symptom',
  'vaccine', 'doctor_visit', 'teething', 'allergy',
  'skin_condition', 'immunization',
  // Development (8)
  'milestone', 'play', 'tummy_time', 'reading',
  'music', 'outdoor', 'sensory', 'speech',
  // Emotional & Social (5)
  'mood', 'attachment', 'social', 'crying', 'soothing',
  // Physical Care (8)
  'nail_care', 'hair_care', 'skin_care', 'sunscreen',
  'insect_repellent', 'oral_hygiene', 'ear_care', 'nose_care',
  // Nutrition (6)
  'solid_food', 'water', 'vitamin', 'allergen_intro',
  'feeding_reaction', 'breastfeeding',
  // Safety (5)
  'accident', 'injury', 'choking', 'car_seat', 'babyproofing',
  // Schedule & Routine (5)
  'wake_time', 'bedtime', 'nap', 'screen_time', 'outdoor_time',
  // Parental Care (5)
  'note', 'photo', 'video', 'voice_memo', 'journal',
  // Travel & Outings (4)
  'trip', 'travel', 'daycare', 'babysitter',
  // Special Needs (7)
  'reflux', 'colic', 'gas', 'constipation',
  'diarrhea', 'eczema', 'cradle_cap',
] as const;

export type DefaultTrackerId = typeof DEFAULT_TRACKER_IDS[number];

// ─── Legacy Bridge Type ───
// For gradual migration from old ActivityType
export type TrackerActivityType = LegacyActivityType | `custom_${string}`;

// ─── Helper: Check if a tracker ID is custom ───
export const isCustomTracker = (id: string): boolean =>
  id.startsWith('custom_') || !DEFAULT_TRACKER_IDS.includes(id as DefaultTrackerId);