import { ActivityType as LegacyActivityType } from '../context/BabyContext';


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
  | 'mood_emoji'
  | 'progress_bar'      // Visual progress (e.g., bottle emptying)
  | 'timer'             // Active timer that runs while logging
  | 'interval'          // "Every X hours" for recurring things
  | 'pair'              // Start/End time pair with auto-duration
  | 'repeat_schedule';  // "Mon, Wed, Fri at 8am" pattern

export interface FieldOption {
  id: string;
  label: string;
  emoji?: string;
  icon?: string;
  color?: string;
  triggers?: {
    alertParent?: boolean;
    scheduleFollowUp?: { hours: number; message: string };
    linkToTracker?: string;  // e.g., selecting "Fever" links to Temperature tracker
  };
}

export interface FieldConfig {
  id: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  placeholder?: string;
  required?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
  showIf?: {
    field: string;
    equals?: string | boolean | number;
    notEquals?: string | boolean | number;
    contains?: string;
  };
  progressive?: {
    suggestFromHistory?: boolean;
    carryForward?: boolean;
    showTrend?: boolean;
    timeBasedSuggestions?: boolean;
  };
}


export interface ReminderRule {
  id: string;
  trackerId: string;
  fieldId?: string;           // Which field triggered this (e.g., "nextDose")
  type: 'fixed_time' |        // "Every day at 8am"
    'interval' |              // "Every 6 hours after last log"
    'pattern' |               // "Mon/Wed/Fri"
    'conditional' |           // "If temperature > 38°C, remind in 2h"
    'streak' |                // "You've logged 5 days, keep it up!"
    'correlation' |           // "Baby fussy after feed? Log next feed carefully"
    'milestone';              // "First tooth? Time for dental check!"

  time?: string;              // "08:00" for fixed_time
  intervalHours?: number;     // For interval-based
  daysOfWeek?: number[];      // [1,3,5] for Mon/Wed/Fri

  condition?: {
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
    value: string | number | boolean;
    then: {
      remindIn: number;       // minutes
      message: string;
      priority: 'low' | 'normal' | 'high' | 'urgent';
    };
  };

  smartSnooze?: boolean;      // If parent is busy, auto-snooze 15min
  escalateToPartner?: boolean; // If missed 2x, notify other parent
  requireConfirmation?: boolean; // Must tap "Given" not just dismiss

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
    streakGoal?: number;  // e.g., "7 days of tummy time"

    supportsChaining?: boolean;
    chainDescription?: string;  // e.g., "Link feed → diaper → sleep"

    smartSuggestions?: {
      enabled: boolean;
      suggestTime?: boolean;     // "Usually feed at 8am, it's 7:45"
      suggestAmount?: boolean;   // "Yesterday: 120ml, suggest same"
      suggestFromPartner?: boolean; // "Other parent gave 150ml at 6am"
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

  confidence: number;  // 0-1, increases with more data
}

export interface TrackerStreak {
  trackerId: string;
  currentStreak: number;
  longestStreak: number;
  lastLoggedAt: number;
  nextDueAt?: number;
  isAtRisk: boolean;  // Haven't logged today and it's getting late
  goalProgress?: number;  // e.g., 5/7 days
}


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


export const DEFAULT_TRACKER_IDS = [
  'potty', 'diaper', 'feed', 'pumping', 'sleep', 'bath',
  'growth', 'temperature', 'medication', 'symptom',
  'vaccine', 'doctor_visit', 'teething', 'allergy',
  'skin_condition', 'immunization',
  'milestone', 'play', 'tummy_time', 'reading',
  'music', 'outdoor', 'sensory', 'speech',
  'mood', 'attachment', 'social', 'crying', 'soothing',
  'nail_care', 'hair_care', 'skin_care', 'sunscreen',
  'insect_repellent', 'oral_hygiene', 'ear_care', 'nose_care',
  'solid_food', 'water', 'vitamin', 'allergen_intro',
  'feeding_reaction', 'breastfeeding',
  'accident', 'injury', 'choking', 'car_seat', 'babyproofing',
  'wake_time', 'bedtime', 'nap', 'screen_time', 'outdoor_time',
  'note', 'photo', 'video', 'voice_memo', 'journal',
  'trip', 'travel', 'daycare', 'babysitter',
  'reflux', 'colic', 'gas', 'constipation',
  'diarrhea', 'eczema', 'cradle_cap',
] as const;

export type DefaultTrackerId = typeof DEFAULT_TRACKER_IDS[number];

export type TrackerActivityType = LegacyActivityType | `custom_${string}`;

export const isCustomTracker = (id: string): boolean =>
  id.startsWith('custom_') || !DEFAULT_TRACKER_IDS.includes(id as DefaultTrackerId);


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
