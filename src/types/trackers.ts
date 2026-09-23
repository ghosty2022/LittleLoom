// src/types/trackers.ts
// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL TYPES for the tracker system.
//
// This file is the single source of truth for:
//   • TrackerCategory, FieldType, FieldConfig, FieldOption
//   • Unit option sets (LIQUID, SOLID, WEIGHT, LENGTH, TEMPERATURE)
//   • TrackerEntry, UnifiedTrackerConfig, TrackerInsight, TrackerStreak
//   • ReminderRule, ProgressiveTrackerState
//   • DEFAULT_TRACKER_IDS (must stay in sync with config/defaultTrackers.ts)
//
// NOTE: `ActivityType` is imported from BabyContext for backward compat
// with legacy code, but new code must use `TrackerEntry.trackerId` instead.
// ═══════════════════════════════════════════════════════════════════════════

import { ActivityType as LegacyActivityType } from '../context/BabyContext';

// ─── CATEGORIES ────────────────────────────────────────────────────────────
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
  | 'household'
  | 'custom';

// ─── FIELD TYPES ───────────────────────────────────────────────────────────
// Every field type the DynamicTrackerForm knows how to render.
// Adding a new type here REQUIRES a corresponding case in DynamicTrackerForm.
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
  | 'quantity'
  | 'slider'
  | 'mood_emoji'
  | 'pain_scale';     // 0–10 numeric scale (rendered as slider with emoji anchors)

// ─── UNIT OPTION SETS ──────────────────────────────────────────────────────
// Shared across defaultTrackers.ts so unit definitions never drift.

export interface UnitOption {
  id: string;
  label: string;
}

/** Liquid measurements — ml is the universal default, oz for US/UK. */
export const LIQUID_UNITS: UnitOption[] = [
  { id: 'ml', label: 'ml' },
  { id: 'oz', label: 'oz' },
  { id: 'cups', label: 'cups' },
];

/** Solid food measurements — g is universal, oz/tbsp/servings for US. */
export const SOLID_UNITS: UnitOption[] = [
  { id: 'g', label: 'g' },
  { id: 'oz', label: 'oz' },
  { id: 'tbsp', label: 'tbsp' },
  { id: 'tsp', label: 'tsp' },
  { id: 'servings', label: 'servings' },
  { id: 'pieces', label: 'pieces' },
];

/** Weight measurements — kg universal, lb for US/UK. */
export const WEIGHT_UNITS: UnitOption[] = [
  { id: 'kg', label: 'kg' },
  { id: 'lb', label: 'lb' },
  { id: 'g', label: 'g' },
  { id: 'oz', label: 'oz' },
];

/** Length/height measurements — cm universal, in for US/UK. */
export const LENGTH_UNITS: UnitOption[] = [
  { id: 'cm', label: 'cm' },
  { id: 'in', label: 'in' },
  { id: 'mm', label: 'mm' },
];

/** Temperature units. */
export const TEMPERATURE_UNITS: UnitOption[] = [
  { id: 'celsius', label: '°C' },
  { id: 'fahrenheit', label: '°F' },
];

// ─── FIELD OPTIONS ─────────────────────────────────────────────────────────
export interface FieldOption {
  id: string;
  label: string;
  emoji?: string;
  icon?: string;
  color?: string;

  /**
   * Optional triggers — used by the AI engine to react to specific selections.
   * e.g., selecting "Fever" can alert the parent or schedule a follow-up.
   */
  triggers?: {
    alertParent?: boolean;
    scheduleFollowUp?: { hours: number; message: string };
    linkToTracker?: string; // e.g., selecting "Fever" links to Temperature tracker
  };
}

// ─── FIELD CONFIG ──────────────────────────────────────────────────────────
export interface FieldConfig {
  id: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  placeholder?: string;
  required?: boolean;
  unit?: string;
  unitOptions?: UnitOption[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;

  /** Conditional visibility — only show this field when the condition holds. */
  showIf?: {
    field: string;
    equals?: string | boolean | number;
    notEquals?: string | boolean | number;
    contains?: string;
  };

  /**
   * Progressive enhancement metadata — lets the form decide whether to:
   *   - suggest values based on history
   *   - carry forward yesterday's value
   *   - show a trend arrow next to the field
   *   - use time-of-day-based suggestions
   */
  progressive?: {
    suggestFromHistory?: boolean;
    carryForward?: boolean;
    showTrend?: boolean;
    timeBasedSuggestions?: boolean;
  };

  /**
   * Optional hint shown next to the field label (e.g., "Optional").
   * Rendered as small gray text. Never used for required fields.
   */
  hint?: string;
}

// ─── REMINDER RULES ────────────────────────────────────────────────────────
export interface ReminderRule {
  id: string;
  trackerId: string;
  fieldId?: string;
  type:
    | 'fixed_time'
    | 'interval'
    | 'pattern'
    | 'conditional'
    | 'streak'
    | 'correlation'
    | 'milestone';

  time?: string;
  intervalHours?: number;
  daysOfWeek?: number[];

  condition?: {
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
    value: string | number | boolean;
    then: {
      remindIn: number;
      message: string;
      priority: 'low' | 'normal' | 'high' | 'urgent';
    };
  };

  smartSnooze?: boolean;
  escalateToPartner?: boolean;
  requireConfirmation?: boolean;

  title: string;
  body: string;
  emoji: string;
  actionButtons?: {
    id: string;
    label: string;
    action: 'log_now' | 'snooze' | 'skip' | 'edit_schedule';
    style: 'default' | 'destructive';
  }[];

  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── TRACKER ENTRY ─────────────────────────────────────────────────────────
export interface TrackerEntry {
  id: string;
  babyId: string;
  trackerId: string;
  timestamp: number;
  title: string;
  data: Record<string, unknown>;

  loggedBy: string;
  loggedByName: string;
  loggedByRole: 'parent1' | 'parent2' | 'guardian';

  notes?: string;
  photoUris?: string[];
  videoUri?: string;
  voiceMemoUri?: string;
  tags?: string[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };

  linkedEntries?: {
    entryId: string;
    trackerId: string;
    relation: 'caused_by' | 'leads_to' | 'related' | 'reminder_for';
    description?: string;
  }[];

  streakInfo?: {
    currentStreak: number;
    longestStreak: number;
    streakType: 'daily' | 'weekly' | 'custom';
    nextDue?: number;
  };

  timeContext?: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday?: boolean;
  };

  notificationId?: string;
  reminderScheduled?: boolean;
  reminderRuleId?: string;
  syncedAt?: string;
  editedBy?: string;
  editedAt?: number;
  isDeleted?: boolean;
}

// ─── UNIFIED TRACKER CONFIG ────────────────────────────────────────────────
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
  isCustom: boolean;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  permissions: {
    familyRoles: ('parent1' | 'parent2' | 'guardian')[];
    allowGuardiansCreate: boolean;
    allowGuardiansEditOwn: boolean;
    allowGuardiansDeleteOwn: boolean;
  };

  progressive?: {
    supportsStreaks?: boolean;
    streakGoal?: number;
    supportsChaining?: boolean;
    chainDescription?: string;
    smartSuggestions?: {
      enabled: boolean;
      suggestTime?: boolean;
      suggestAmount?: boolean;
      suggestFromPartner?: boolean;
    };
    reminderRules?: ReminderRule[];
    correlations?: {
      watchTrackerId: string;
      watchField: string;
      when: 'before' | 'after' | 'same_day';
      suggestLog: boolean;
      message: string;
    }[];
  };

  templates?: {
    id: string;
    name: string;
    emoji: string;
    data: Record<string, unknown>;
    isDefault?: boolean;
  }[];
}

// ─── TRACKER INSIGHT ───────────────────────────────────────────────────────
export interface TrackerInsight {
  id: string;
  trackerId: string;
  type: 'pattern' | 'anomaly' | 'milestone' | 'suggestion' | 'correlation';
  title: string;
  description: string;
  emoji: string;
  priority: 'info' | 'good' | 'warning' | 'alert';

  dataPoints?: {
    date: number;
    value: number | string;
    entryId: string;
  }[];

  action?: {
    type: 'log_now' | 'view_history' | 'set_reminder' | 'share' | 'none';
    trackerId?: string;
    prefillData?: Record<string, unknown>;
    message?: string;
  };

  generatedAt: number;
  expiresAt?: number;
  dismissedAt?: number;
  confidence: number;
}

// ─── TRACKER STREAK ────────────────────────────────────────────────────────
export interface TrackerStreak {
  trackerId: string;
  currentStreak: number;
  longestStreak: number;
  lastLoggedAt: number;
  nextDueAt?: number;
  isAtRisk: boolean;
  goalProgress?: number;
}

// ─── STORAGE KEYS ──────────────────────────────────────────────────────────
export const TRACKER_STORAGE_KEYS = {
  CUSTOM_TRACKERS: '@littleloom_custom_trackers_v2',
  TRACKER_SETTINGS: '@littleloom_tracker_settings_v2',
  LAST_TRACKER: '@littleloom_last_tracker_id',
  ENTRIES_PREFIX: (babyId: string) => `@littleloom_entries_${babyId}`,
  ENTRIES_INDEX: (babyId: string) => `@littleloom_entries_index_${babyId}`,
  REMINDERS: '@littleloom_reminders_v2',
  STREAKS: (babyId: string) => `@littleloom_streaks_${babyId}`,
  INSIGHTS: (babyId: string) => `@littleloom_insights_${babyId}`,
  TEMPLATES: (trackerId: string) => `@littleloom_templates_${trackerId}`,
  HISTORY_PATTERNS: (babyId: string) => `@littleloom_patterns_${babyId}`,
  CHAINS: (babyId: string) => `@littleloom_chains_${babyId}`,
} as const;

// ─── CANONICAL BUILT-IN TRACKER IDS ────────────────────────────────────────
// MUST stay in sync with DEFAULT_TRACKERS in config/defaultTrackers.ts.
// If they drift, isCustomTracker() will misclassify built-ins as custom.
export const DEFAULT_TRACKER_IDS = [
  // Essential
  'feed', 'sleep', 'diaper', 'potty', 'bath', 'pumping',
  // Health
  'growth', 'temperature', 'medication', 'symptom',
  'vaccine', 'doctor_visit', 'teething', 'allergy',
  'skin_condition',
  // Development
  'milestone', 'tummy_time', 'play', 'reading', 'speech',
  // Emotional
  'mood', 'crying',
  // Physical care
  'nail_care', 'oral_hygiene', 'sunscreen', 'skin_care',
  // Nutrition
  'solid_food', 'water', 'vitamin', 'allergen_intro',
  // Safety
  'accident', 'car_seat', 'babyproofing',
  // Schedule
  'bedtime', 'screen_time',
  // Parental
  'note', 'photo', 'journal',
  // Travel
  'trip', 'daycare', 'babysitter',
  // Special needs
  'reflux', 'colic', 'constipation', 'diarrhea',
  // Household
  'supply_inventory', 'expenses', 'cleaning',
  // Legacy aliases — kept so old entries still resolve correctly
  'nap', 'dream_feed', 'breastfeeding', 'injury', 'eczema',
] as const;

export type DefaultTrackerId = typeof DEFAULT_TRACKER_IDS[number];

export type TrackerActivityType = LegacyActivityType | `custom_${string}`;

export const isCustomTracker = (id: string): boolean =>
  id.startsWith('custom_') ||
  !DEFAULT_TRACKER_IDS.includes(id as DefaultTrackerId);

// ─── PROGRESSIVE TRACKER STATE ─────────────────────────────────────────────
export interface ProgressiveTrackerState {
  todayEntries: TrackerEntry[];
  yesterdayEntries: TrackerEntry[];
  streaks: TrackerStreak[];
  insights: TrackerInsight[];
  pendingReminders: ReminderRule[];
  recentTemplates: { trackerId: string; templateId: string; usedAt: number }[];
  detectedPatterns: {
    id: string;
    description: string;
    confidence: number;
    entries: string[];
  }[];
}