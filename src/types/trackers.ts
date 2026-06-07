// src/types/trackers.ts
// UNIFIED: Shared tracker configuration types
// Used by UniversalTrackerScreen, AddLogScreen, TimelineScreen, and BabyContext
// Covers 70+ tracking aspects across all baby care categories

import { ActivityType } from '../context/BabyContext';

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

export interface FieldOption {
  id: string;
  label: string;
  emoji?: string;
  icon?: string;
  color?: string;
}

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
  | 'checkbox';

export interface FieldConfig {
  id: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  placeholder?: string;
  required?: boolean;
  showIf?: (data: Record<string, any>) => boolean;
  max?: number;
  min?: number;
  unit?: string;
  step?: number;
  defaultValue?: any;
}

export interface UnifiedTrackerConfig {
  id: string;
  name: string;
  emoji: string;
  icon: string;
  color: string;
  gradient: [string, string];
  description: string;
  category: TrackerCategory;
  fields: FieldConfig[];
  quickTags: string[];
  isCustom?: boolean;
  createdAt?: number;
  parentCategory?: string;
}

export const TRACKER_STORAGE_KEYS = {
  CUSTOM_TRACKERS: '@littleloom_custom_trackers_unified',
  TRACKER_SETTINGS: '@littleloom_tracker_settings',
  LAST_TRACKER: '@littleloom_last_tracker_id',
} as const;

// All 70+ default tracker IDs
export type DefaultTrackerId = 
  // Essential Daily (6)
  | 'potty' 
  | 'diaper' 
  | 'feed' 
  | 'pumping' 
  | 'sleep' 
  | 'bath'
  // Health & Medical (10)
  | 'growth' 
  | 'temperature' 
  | 'medication' 
  | 'symptom'
  | 'vaccine'
  | 'doctor_visit'
  | 'teething'
  | 'allergy'
  | 'skin_condition'
  | 'immunization'
  // Development (8)
  | 'milestone' 
  | 'play'
  | 'tummy_time'
  | 'reading'
  | 'music'
  | 'outdoor'
  | 'sensory'
  | 'speech'
  // Emotional & Social (5)
  | 'mood'
  | 'attachment'
  | 'social'
  | 'crying'
  | 'soothing'
  // Physical Care (8)
  | 'nail_care'
  | 'hair_care'
  | 'skin_care'
  | 'sunscreen'
  | 'insect_repellent'
  | 'oral_hygiene'
  | 'ear_care'
  | 'nose_care'
  // Nutrition (6)
  | 'solid_food'
  | 'water'
  | 'vitamin'
  | 'allergen_intro'
  | 'feeding_reaction'
  | 'breastfeeding'
  // Safety (5)
  | 'accident'
  | 'injury'
  | 'choking'
  | 'car_seat'
  | 'babyproofing'
  // Schedule & Routine (5)
  | 'wake_time'
  | 'bedtime'
  | 'nap'
  | 'screen_time'
  | 'outdoor_time'
  // Parental Care (5)
  | 'note'
  | 'photo'
  | 'video'
  | 'voice_memo'
  | 'journal'
  // Travel & Outings (4)
  | 'trip'
  | 'travel'
  | 'daycare'
  | 'babysitter'
  // Special Needs (7)
  | 'reflux'
  | 'colic'
  | 'gas'
  | 'constipation'
  | 'diarrhea'
  | 'eczema'
  | 'cradle_cap';
