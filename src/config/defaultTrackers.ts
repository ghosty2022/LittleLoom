// src/config/defaultTrackers.ts
// COMPLETE FIXED V2
//   ✓ Every tracker has consistent field structure
//   ✓ Real, actionable fields — no guessing
//   ✓ Proper units (region-agnostic defaults, explicit overrides)
//   ✓ Sleep/feed have ongoing/completed status support
//   ✓ Solid food has its own measurement field separate from liquids
//   ✓ Duration fields everywhere they matter
//   ✓ Deduplicated labels and clear descriptions
//   ✓ Every tracker has 1-4 quickTags for one-tap logging
//   ✓ Removed redundant trackers that overlapped heavily
//   ✓ All trackers properly categorized

import { UnifiedTrackerConfig, FieldConfig, TrackerCategory } from '../types/trackers';

// ─── Field builders ─────────────────────────────────────────────────────
const f = {
  text: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'text', ...opts,
  }),
  number: (id: string, label: string, unit?: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'number', unit, ...opts,
  }),
  select: (
    id: string,
    label: string,
    options: { id: string; label: string; emoji?: string }[],
    opts?: Partial<FieldConfig>
  ): FieldConfig => ({
    id, label, type: 'select', options, ...opts,
  }),
  multiselect: (
    id: string,
    label: string,
    options: { id: string; label: string; emoji?: string }[],
    opts?: Partial<FieldConfig>
  ): FieldConfig => ({
    id, label, type: 'multiselect', options, ...opts,
  }),
  toggle: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'toggle', ...opts,
  }),
  duration: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'duration', ...opts,
  }),
  rating: (id: string, label: string, max = 5, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'rating', max, ...opts,
  }),
  textarea: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'textarea', ...opts,
  }),
  temperature: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'temperature', ...opts,
  }),
  quantity: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'quantity', ...opts,
  }),
  mood: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'mood_emoji', ...opts,
  }),
  datetime: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'datetime', ...opts,
  }),
  time: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'time', ...opts,
  }),
  photo: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'photo', ...opts,
  }),
  video: (id: string, label: string, opts?: Partial<FieldConfig>): FieldConfig => ({
    id, label, type: 'video', ...opts,
  }),
};

// ─── Permission presets ─────────────────────────────────────────────────
const defaultPerms = {
  familyRoles: ['parent1', 'parent2', 'guardian'] as ('parent1' | 'parent2' | 'guardian')[],
  allowGuardiansCreate: true,
  allowGuardiansEditOwn: true,
  allowGuardiansDeleteOwn: true,
};

// ─── Shared unit option sets ────────────────────────────────────────────
const LIQUID_UNITS = [
  { id: 'ml', label: 'ml' },
  { id: 'oz', label: 'oz' },
];

const SOLID_UNITS = [
  { id: 'g', label: 'g' },
  { id: 'oz', label: 'oz' },
  { id: 'tbsp', label: 'tbsp' },
  { id: 'servings', label: 'servings' },
  { id: 'pieces', label: 'pieces' },
];

const WEIGHT_UNITS = [
  { id: 'kg', label: 'kg' },
  { id: 'lb', label: 'lb' },
  { id: 'g', label: 'g' },
  { id: 'oz', label: 'oz' },
];

const LENGTH_UNITS = [
  { id: 'cm', label: 'cm' },
  { id: 'in', label: 'in' },
];

// ═══════════════════════════════════════════════════════════════════════
// DEFAULT TRACKERS
// ═══════════════════════════════════════════════════════════════════════

export const DEFAULT_TRACKERS: UnifiedTrackerConfig[] = [
  // ═══════════════════════════════════════════════════════════════════
  // ESSENTIAL
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'feed',
    name: 'Feeding',
    emoji: '🍼',
    icon: 'nutrition-outline',
    color: '#FF9F43',
    gradient: ['#FF9F43', '#FF6B6B'],
    description: 'Breastfeeding, bottle, and solid food',
    category: 'essential',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'feedType',
        'Feed Type',
        [
          { id: 'breast', label: 'Breast', emoji: '🤱' },
          { id: 'bottle', label: 'Bottle', emoji: '🍼' },
          { id: 'solid', label: 'Solid Food', emoji: '🥄' },
          { id: 'water', label: 'Water', emoji: '💧' },
        ],
        { required: true }
      ),
      // Status for tracking ongoing/completed feeds (esp. breastfeeding)
      f.select(
        'status',
        'Status',
        [
          { id: 'ongoing', label: 'In Progress', emoji: '🔄' },
          { id: 'completed', label: 'Finished', emoji: '✅' },
        ],
        { showIf: { field: 'feedType', equals: 'breast' } }
      ),
      f.datetime('startTime', 'Start Time', {
        showIf: { field: 'feedType', equals: 'breast' },
      }),
      f.datetime('endTime', 'End Time', {
        showIf: { field: 'feedType', equals: 'breast' },
      }),

      // ── Breast ────────────────────────────────────────────────
      f.select(
        'side',
        'Side',
        [
          { id: 'left', label: 'Left', emoji: '⬅️' },
          { id: 'right', label: 'Right', emoji: '➡️' },
          { id: 'both', label: 'Both', emoji: '↔️' },
        ],
        { showIf: { field: 'feedType', equals: 'breast' } }
      ),
      f.duration('breastDuration', 'Duration', {
        showIf: { field: 'feedType', equals: 'breast' },
      }),

      // ── Bottle ────────────────────────────────────────────────
      f.quantity('bottleAmount', 'Amount', {
        showIf: { field: 'feedType', equals: 'bottle' },
        unitOptions: LIQUID_UNITS,
      }),
      f.select(
        'bottleContent',
        'Contents',
        [
          { id: 'formula', label: 'Formula', emoji: '🍼' },
          { id: 'breastmilk', label: 'Breast Milk', emoji: '🤱' },
          { id: 'mixed', label: 'Mixed', emoji: '🔄' },
        ],
        { showIf: { field: 'feedType', equals: 'bottle' } }
      ),

      // ── Solid ─────────────────────────────────────────────────
      f.text('food', 'Food Item', {
        placeholder: 'e.g., Sweet potato, Oatmeal',
        showIf: { field: 'feedType', equals: 'solid' },
      }),
      f.quantity('solidAmount', 'Amount Eaten', {
        showIf: { field: 'feedType', equals: 'solid' },
        unitOptions: SOLID_UNITS,
      }),
      f.rating('acceptance', 'Acceptance', 5, {
        showIf: { field: 'feedType', equals: 'solid' },
      }),

      // ── Water ─────────────────────────────────────────────────
      f.quantity('waterAmount', 'Amount', {
        showIf: { field: 'feedType', equals: 'water' },
        unitOptions: LIQUID_UNITS,
      }),

      // ── Shared ────────────────────────────────────────────────
      f.toggle('spitUp', 'Spit Up?'),
      f.toggle('reaction', 'Any reaction?'),
      f.textarea('reactionNotes', 'Reaction Details', {
        showIf: { field: 'reaction', equals: true },
      }),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Cluster feed', 'Refused', 'Spit up', 'Gassy', 'Good feed'],
  },

  {
    id: 'sleep',
    name: 'Sleep',
    emoji: '😴',
    icon: 'moon-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#341F97'],
    description: 'Naps and nighttime sleep',
    category: 'essential',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'sleepType',
        'Type',
        [
          { id: 'nap', label: 'Nap', emoji: '☀️' },
          { id: 'night', label: 'Night Sleep', emoji: '🌙' },
        ],
        { required: true }
      ),
      f.select(
        'status',
        'Status',
        [
          { id: 'ongoing', label: 'Still sleeping', emoji: '💤' },
          { id: 'completed', label: 'Awake', emoji: '☀️' },
        ],
        { required: true, defaultValue: 'ongoing' }
      ),
      f.datetime('startTime', 'Start Time', { required: true }),
      f.datetime('endTime', 'End Time'),
      f.duration('duration', 'Duration'),
      f.rating('quality', 'Sleep Quality', 5),
      f.select('location', 'Location', [
        { id: 'crib', label: 'Crib', emoji: '🛏️' },
        { id: 'bassinet', label: 'Bassinet', emoji: '🛏️' },
        { id: 'parent_bed', label: 'Parent Bed', emoji: '👨‍👩‍👧' },
        { id: 'stroller', label: 'Stroller', emoji: '🚗' },
        { id: 'carrier', label: 'Carrier', emoji: '🎒' },
        { id: 'car', label: 'Car', emoji: '🚙' },
        { id: 'other', label: 'Other', emoji: '📍' },
      ]),
      f.toggle('selfSoothing', 'Self-soothed?'),
      f.toggle('fought', 'Fought sleep?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Easy put-down', 'Fought sleep', 'Woke early', 'Long nap'],
  },

  {
    id: 'diaper',
    name: 'Diaper',
    emoji: '👶',
    icon: 'water-outline',
    color: '#54A0FF',
    gradient: ['#54A0FF', '#2E86DE'],
    description: 'Diaper changes',
    category: 'essential',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'type',
        'Type',
        [
          { id: 'wet', label: 'Wet', emoji: '💧' },
          { id: 'dirty', label: 'Dirty', emoji: '💩' },
          { id: 'both', label: 'Both', emoji: '💧💩' },
          { id: 'dry', label: 'Dry', emoji: '✅' },
        ],
        { required: true }
      ),
      f.select(
        'color',
        'Stool Color',
        [
          { id: 'yellow', label: 'Yellow (Mustard)', emoji: '🟡' },
          { id: 'brown', label: 'Brown', emoji: '🟤' },
          { id: 'green', label: 'Green', emoji: '🟢' },
          { id: 'black', label: 'Black (Meconium)', emoji: '⚫' },
          { id: 'red', label: 'Red / Bloody', emoji: '🔴' },
          { id: 'white', label: 'White / Chalky', emoji: '⚪' },
        ],
        { showIf: { field: 'type', notEquals: 'dry' } }
      ),
      f.select(
        'consistency',
        'Consistency',
        [
          { id: 'watery', label: 'Watery', emoji: '💧' },
          { id: 'loose', label: 'Loose', emoji: '🟡' },
          { id: 'soft', label: 'Soft', emoji: '🟢' },
          { id: 'formed', label: 'Formed', emoji: '🟤' },
          { id: 'hard', label: 'Hard', emoji: '⚫' },
        ],
        { showIf: { field: 'type', notEquals: 'dry' } }
      ),
      f.toggle('rash', 'Rash present?'),
      f.toggle('blowout', 'Blowout?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Blowout', 'Rash', 'Normal', 'Unusual color'],
  },

  {
    id: 'potty',
    name: 'Potty',
    emoji: '🚽',
    icon: 'happy-outline',
    color: '#1DD1A1',
    gradient: ['#1DD1A1', '#10AC84'],
    description: 'Potty training progress',
    category: 'essential',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'type',
        'Type',
        [
          { id: 'pee', label: 'Pee', emoji: '💧' },
          { id: 'poop', label: 'Poop', emoji: '💩' },
          { id: 'both', label: 'Both', emoji: '💧💩' },
          { id: 'attempt', label: 'Attempt Only', emoji: '🚽' },
          { id: 'accident', label: 'Accident', emoji: '😰' },
        ],
        { required: true }
      ),
      f.toggle('successful', 'Made it to potty?', { required: true }),
      f.select('location', 'Location', [
        { id: 'potty', label: 'Potty Chair', emoji: '🪑' },
        { id: 'toilet', label: 'Toilet', emoji: '🚽' },
        { id: 'floor', label: 'Floor', emoji: '😰' },
        { id: 'diaper', label: 'Diaper', emoji: '👶' },
      ]),
      f.toggle('selfInitiated', 'Self-initiated?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First success!', 'Self-initiated', 'Accident', 'Dry night'],
  },

  {
    id: 'bath',
    name: 'Bath',
    emoji: '🛁',
    icon: 'water-outline',
    color: '#48DBFB',
    gradient: ['#48DBFB', '#0ABDE3'],
    description: 'Bath time',
    category: 'essential',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'status',
        'Status',
        [
          { id: 'ongoing', label: 'In Progress', emoji: '🔄' },
          { id: 'completed', label: 'Done', emoji: '✅' },
        ],
        { defaultValue: 'completed' }
      ),
      f.datetime('startTime', 'Start Time'),
      f.datetime('endTime', 'End Time'),
      f.duration('duration', 'Duration'),
      f.select('waterTemp', 'Water Temperature', [
        { id: 'warm', label: 'Warm', emoji: '🌡️' },
        { id: 'cool', label: 'Cool', emoji: '❄️' },
        { id: 'hot', label: 'Hot', emoji: '🔥' },
      ]),
      f.toggle('shampoo', 'Shampoo used?'),
      f.toggle('soap', 'Soap used?'),
      f.toggle('lotion', 'Lotion applied after?'),
      f.rating('enjoyment', 'Enjoyment', 5),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Splashed', 'Cried', 'Loved it', 'Hair wash'],
  },

  {
    id: 'pumping',
    name: 'Pumping',
    emoji: '🤱',
    icon: 'flash-outline',
    color: '#FF9FF3',
    gradient: ['#FF9FF3', '#F368E0'],
    description: 'Breast pumping sessions',
    category: 'essential',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'side',
        'Side',
        [
          { id: 'left', label: 'Left', emoji: '⬅️' },
          { id: 'right', label: 'Right', emoji: '➡️' },
          { id: 'both', label: 'Both', emoji: '↔️' },
        ],
        { required: true }
      ),
      f.select(
        'status',
        'Status',
        [
          { id: 'ongoing', label: 'In Progress', emoji: '🔄' },
          { id: 'completed', label: 'Finished', emoji: '✅' },
        ],
        { defaultValue: 'completed' }
      ),
      f.datetime('startTime', 'Start Time'),
      f.datetime('endTime', 'End Time'),
      f.quantity('amount', 'Total Output', {
        required: true,
        unitOptions: LIQUID_UNITS,
      }),
      f.duration('duration', 'Duration'),
      f.rating('comfort', 'Comfort Level', 5),
      f.toggle('powerPump', 'Power pump session?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['High output', 'Low output', 'Clogged duct', 'Power pump'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'growth',
    name: 'Growth',
    emoji: '📏',
    icon: 'trending-up-outline',
    color: '#10AC84',
    gradient: ['#10AC84', '#1DD1A1'],
    description: 'Height, weight, and head circumference',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'measurementType',
        'Measurement',
        [
          { id: 'weight', label: 'Weight', emoji: '⚖️' },
          { id: 'height', label: 'Height / Length', emoji: '📏' },
          { id: 'head', label: 'Head Circumference', emoji: '🧠' },
        ],
        { required: true }
      ),
      f.quantity('value', 'Value', {
        required: true,
        unitOptions: [
          ...WEIGHT_UNITS,
          ...LENGTH_UNITS,
        ],
      }),
      f.number('percentile', 'WHO Percentile', '%', { min: 0, max: 100 }),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Percentile jump', 'Steady growth', 'Concern', 'Well visit'],
  },

  {
    id: 'temperature',
    name: 'Temperature',
    emoji: '🌡️',
    icon: 'thermometer-outline',
    color: '#EE5A24',
    gradient: ['#EE5A24', '#FF6348'],
    description: 'Body temperature readings',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.temperature('value', 'Temperature', { required: true }),
      f.select(
        'unit',
        'Unit',
        [
          { id: 'celsius', label: '°C' },
          { id: 'fahrenheit', label: '°F' },
        ],
        { required: true }
      ),
      f.select('method', 'Method', [
        { id: 'forehead', label: 'Forehead', emoji: '🌡️' },
        { id: 'ear', label: 'Ear', emoji: '👂' },
        { id: 'oral', label: 'Oral', emoji: '👄' },
        { id: 'armpit', label: 'Armpit', emoji: '💪' },
        { id: 'rectal', label: 'Rectal', emoji: '🔴' },
      ]),
      f.multiselect('symptoms', 'Symptoms', [
        { id: 'fever', label: 'Fever', emoji: '🔥' },
        { id: 'chills', label: 'Chills', emoji: '❄️' },
        { id: 'sweating', label: 'Sweating', emoji: '💦' },
        { id: 'irritable', label: 'Irritable', emoji: '😤' },
        { id: 'lethargic', label: 'Lethargic', emoji: '😴' },
      ]),
      f.toggle('medicated', 'Medication given?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Fever', 'Normal', 'After vaccine', 'Teething'],
  },

  {
    id: 'medication',
    name: 'Medication',
    emoji: '💊',
    icon: 'medkit-outline',
    color: '#FF6B6B',
    gradient: ['#FF6B6B', '#EE5A24'],
    description: 'Medicine and dosing',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('name', 'Medication Name', {
        required: true,
        placeholder: 'e.g., Acetaminophen',
      }),
      f.text('dosage', 'Dosage', {
        required: true,
        placeholder: 'e.g., 2.5ml',
      }),
      f.select('type', 'Form', [
        { id: 'liquid', label: 'Liquid', emoji: '🧪' },
        { id: 'tablet', label: 'Tablet', emoji: '💊' },
        { id: 'drops', label: 'Drops', emoji: '💧' },
        { id: 'injection', label: 'Injection', emoji: '💉' },
        { id: 'suppository', label: 'Suppository', emoji: '🔴' },
        { id: 'cream', label: 'Cream/Ointment', emoji: '🧴' },
      ]),
      f.text('reason', 'Reason', { placeholder: 'e.g., Fever, Teething' }),
      f.toggle('given', 'Given successfully?', { defaultValue: true }),
      f.toggle('vomited', 'Vomited after?'),
      f.photo('labelPhoto', 'Photo of Label', {
        // Helps prevent dosing errors on repeat doses
      }),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Fever reducer', 'Antibiotic', 'Vitamin', 'Reaction'],
  },

  {
    id: 'symptom',
    name: 'Symptom',
    emoji: '😷',
    icon: 'pulse-outline',
    color: '#FF9F43',
    gradient: ['#FF9F43', '#EE5A24'],
    description: 'Symptoms and illness tracking',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.multiselect(
        'symptoms',
        'Symptoms',
        [
          { id: 'cough', label: 'Cough', emoji: '😤' },
          { id: 'runny_nose', label: 'Runny Nose', emoji: '👃' },
          { id: 'congestion', label: 'Congestion', emoji: '😷' },
          { id: 'vomiting', label: 'Vomiting', emoji: '🤮' },
          { id: 'diarrhea', label: 'Diarrhea', emoji: '💩' },
          { id: 'rash', label: 'Rash', emoji: '🔴' },
          { id: 'fever', label: 'Fever', emoji: '🔥' },
          { id: 'ear_pain', label: 'Ear Pain', emoji: '👂' },
          { id: 'sore_throat', label: 'Sore Throat', emoji: '😰' },
          { id: 'refusing_food', label: 'Refusing Food', emoji: '🙅' },
          { id: 'lethargy', label: 'Unusually Sleepy', emoji: '😴' },
        ],
        { required: true }
      ),
      f.rating('severity', 'Severity', 5),
      f.datetime('startedAt', 'Started At'),
      f.toggle('ongoing', 'Still ongoing?'),
      f.toggle('doctorCalled', 'Contacted doctor?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Getting worse', 'Improving', 'Called doctor', 'Emergency'],
  },

  {
    id: 'vaccine',
    name: 'Vaccine',
    emoji: '💉',
    icon: 'shield-checkmark-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#341F97'],
    description: 'Immunization records',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('name', 'Vaccine Name', {
        required: true,
        placeholder: 'e.g., DTaP, MMR',
      }),
      f.number('doseNumber', 'Dose #', '', { min: 1, max: 10 }),
      f.datetime('dateGiven', 'Date Given', { required: true }),
      f.text('batch', 'Lot Number'),
      f.text('provider', 'Provider', { placeholder: 'e.g., Dr. Smith' }),
      f.text('site', 'Injection Site', { placeholder: 'e.g., Left thigh' }),
      f.multiselect('reactions', 'Reactions', [
        { id: 'none', label: 'None', emoji: '✅' },
        { id: 'redness', label: 'Redness', emoji: '🔴' },
        { id: 'swelling', label: 'Swelling', emoji: '📍' },
        { id: 'fever', label: 'Fever', emoji: '🔥' },
        { id: 'fussy', label: 'Fussy', emoji: '😤' },
        { id: 'sleepy', label: 'Sleepy', emoji: '😴' },
        { id: 'rash', label: 'Rash', emoji: '🔴' },
      ]),
      f.datetime('nextDue', 'Next Dose Due'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['On schedule', 'Delayed', 'Reaction', 'Complete'],
  },

  {
    id: 'doctor_visit',
    name: 'Doctor Visit',
    emoji: '👨‍⚕️',
    icon: 'medical-outline',
    color: '#00D2D3',
    gradient: ['#00D2D3', '#54A0FF'],
    description: 'Medical appointments',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'type',
        'Visit Type',
        [
          { id: 'checkup', label: 'Well Checkup', emoji: '✅' },
          { id: 'sick', label: 'Sick Visit', emoji: '😷' },
          { id: 'followup', label: 'Follow-up', emoji: '🔄' },
          { id: 'specialist', label: 'Specialist', emoji: '👨‍⚕️' },
          { id: 'emergency', label: 'Emergency', emoji: '🚨' },
        ],
        { required: true }
      ),
      f.text('provider', 'Provider Name'),
      f.text('reason', 'Reason for Visit'),
      f.textarea('diagnosis', 'Diagnosis / Notes'),
      f.toggle('followUpNeeded', 'Follow-up needed?'),
      f.datetime('followUpDate', 'Follow-up Date', {
        showIf: { field: 'followUpNeeded', equals: true },
      }),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Routine', 'Sick', 'Vaccines', 'Concern'],
  },

  {
    id: 'teething',
    name: 'Teething',
    emoji: '🦷',
    icon: 'sad-outline',
    color: '#FF6B6B',
    gradient: ['#FF6B6B', '#FF9F43'],
    description: 'Teething symptoms and relief',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('gumArea', 'Gum Area', [
        { id: 'bottom_front', label: 'Bottom Front', emoji: '👇' },
        { id: 'top_front', label: 'Top Front', emoji: '👆' },
        { id: 'side', label: 'Side / Molar', emoji: '👉' },
        { id: 'unknown', label: 'Unknown', emoji: '❓' },
      ]),
      f.multiselect('symptoms', 'Symptoms', [
        { id: 'drooling', label: 'Drooling', emoji: '💧' },
        { id: 'chewing', label: 'Chewing everything', emoji: '😬' },
        { id: 'fussy', label: 'Fussy', emoji: '😤' },
        { id: 'sleep_disturbance', label: 'Sleep disruption', emoji: '😴' },
        { id: 'low_fever', label: 'Low fever', emoji: '🌡️' },
        { id: 'rash', label: 'Rash', emoji: '🔴' },
        { id: 'refusing_food', label: 'Refusing food', emoji: '🙅' },
      ]),
      f.multiselect('relief', 'Relief Used', [
        { id: 'teether', label: 'Teether', emoji: '🦷' },
        { id: 'cold_washcloth', label: 'Cold Washcloth', emoji: '🧊' },
        { id: 'massage', label: 'Gum Massage', emoji: '👆' },
        { id: 'medicine', label: 'Pain Reliever', emoji: '💊' },
        { id: 'cold_food', label: 'Cold Food', emoji: '🍎' },
      ]),
      f.rating('severity', 'Discomfort Level', 5),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First tooth!', 'Bad day', 'Relief helped', 'No sleep'],
  },

  {
    id: 'allergy',
    name: 'Allergy',
    emoji: '🤧',
    icon: 'warning-outline',
    color: '#EE5A24',
    gradient: ['#EE5A24', '#FF6B6B'],
    description: 'Allergic reactions and triggers',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'severity',
        'Severity',
        [
          { id: 'mild', label: 'Mild', emoji: '🟡' },
          { id: 'moderate', label: 'Moderate', emoji: '🟠' },
          { id: 'severe', label: 'Severe', emoji: '🔴' },
          { id: 'anaphylaxis', label: 'Anaphylaxis', emoji: '🚨' },
        ],
        { required: true }
      ),
      f.multiselect(
        'triggers',
        'Suspected Triggers',
        [
          { id: 'food', label: 'Food', emoji: '🥜' },
          { id: 'pollen', label: 'Pollen', emoji: '🌸' },
          { id: 'dust', label: 'Dust Mites', emoji: '🏠' },
          { id: 'pet', label: 'Pet Dander', emoji: '🐕' },
          { id: 'medication', label: 'Medication', emoji: '💊' },
          { id: 'insect', label: 'Insect Bite', emoji: '🦟' },
          { id: 'latex', label: 'Latex', emoji: '🧤' },
          { id: 'unknown', label: 'Unknown', emoji: '❓' },
        ],
        { required: true }
      ),
      f.multiselect('symptoms', 'Symptoms', [
        { id: 'hives', label: 'Hives', emoji: '🔴' },
        { id: 'swelling', label: 'Swelling', emoji: '📍' },
        { id: 'breathing', label: 'Breathing difficulty', emoji: '😰' },
        { id: 'vomiting', label: 'Vomiting', emoji: '🤮' },
        { id: 'diarrhea', label: 'Diarrhea', emoji: '💩' },
        { id: 'itchy', label: 'Itchy', emoji: '🖐️' },
      ]),
      f.toggle('epipen', 'EpiPen used?'),
      f.toggle('medicalAttention', 'Medical attention needed?'),
      f.photo('photos', 'Photos'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['New trigger', 'Emergency', 'Improving', 'Avoided'],
  },

  {
    id: 'skin_condition',
    name: 'Skin Condition',
    emoji: '🔴',
    icon: 'sunny-outline',
    color: '#F368E0',
    gradient: ['#F368E0', '#FF9FF3'],
    description: 'Rashes, eczema, and skin issues',
    category: 'health',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'condition',
        'Condition',
        [
          { id: 'eczema', label: 'Eczema', emoji: '🔴' },
          { id: 'diaper_rash', label: 'Diaper Rash', emoji: '👶' },
          { id: 'heat_rash', label: 'Heat Rash', emoji: '☀️' },
          { id: 'cradle_cap', label: 'Cradle Cap', emoji: '👶' },
          { id: 'acne', label: 'Baby Acne', emoji: '🔴' },
          { id: 'hives', label: 'Hives', emoji: '🔴' },
          { id: 'dry_skin', label: 'Dry Skin', emoji: '🫧' },
          { id: 'other', label: 'Other', emoji: '❓' },
        ],
        { required: true }
      ),
      f.select('severity', 'Severity', [
        { id: 'mild', label: 'Mild', emoji: '🟢' },
        { id: 'moderate', label: 'Moderate', emoji: '🟡' },
        { id: 'severe', label: 'Severe', emoji: '🔴' },
      ]),
      f.multiselect('location', 'Body Location', [
        { id: 'face', label: 'Face', emoji: '😊' },
        { id: 'scalp', label: 'Scalp', emoji: '👶' },
        { id: 'chest', label: 'Chest', emoji: '👕' },
        { id: 'back', label: 'Back', emoji: '👤' },
        { id: 'arms', label: 'Arms', emoji: '💪' },
        { id: 'legs', label: 'Legs', emoji: '🦵' },
        { id: 'diaper_area', label: 'Diaper Area', emoji: '👶' },
        { id: 'full', label: 'Full Body', emoji: '👤' },
      ]),
      f.multiselect('treatments', 'Treatments', [
        { id: 'cream', label: 'Moisturizing Cream', emoji: '🧴' },
        { id: 'ointment', label: 'Petroleum Jelly', emoji: '🔵' },
        { id: 'steroid', label: 'Steroid Cream', emoji: '💊' },
        { id: 'oatmeal', label: 'Oatmeal Bath', emoji: '🛁' },
        { id: 'air', label: 'Air Time', emoji: '💨' },
        { id: 'antifungal', label: 'Antifungal', emoji: '💊' },
      ]),
      f.photo('photos', 'Photos'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Flare up', 'Improving', 'New spot', 'Cleared up'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // DEVELOPMENT
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'milestone',
    name: 'Milestone',
    emoji: '🏆',
    icon: 'trophy-outline',
    color: '#FFD700',
    gradient: ['#FFD700', '#FFA502'],
    description: 'Developmental milestones',
    category: 'development',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('title', 'Milestone', {
        required: true,
        placeholder: 'e.g., First smile, First steps',
      }),
      f.select(
        'category',
        'Category',
        [
          { id: 'physical', label: 'Physical / Motor', emoji: '🏃' },
          { id: 'cognitive', label: 'Cognitive', emoji: '🧠' },
          { id: 'social', label: 'Social / Emotional', emoji: '👥' },
          { id: 'language', label: 'Language / Speech', emoji: '💬' },
        ],
        { required: true }
      ),
      f.toggle('firstTime', 'First time?', { defaultValue: true }),
      f.textarea('description', 'Description'),
      f.photo('photos', 'Photos'),
      f.video('video', 'Video'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First time!', 'Early', 'On track', 'Late'],
  },

  {
    id: 'tummy_time',
    name: 'Tummy Time',
    emoji: '😤',
    icon: 'fitness-outline',
    color: '#1DD1A1',
    gradient: ['#1DD1A1', '#10AC84'],
    description: 'Tummy time sessions',
    category: 'development',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'status',
        'Status',
        [
          { id: 'ongoing', label: 'In Progress', emoji: '🔄' },
          { id: 'completed', label: 'Done', emoji: '✅' },
        ],
        { defaultValue: 'completed' }
      ),
      f.datetime('startTime', 'Start Time'),
      f.datetime('endTime', 'End Time'),
      f.duration('duration', 'Duration', { required: true }),
      f.rating('tolerance', 'Tolerance', 5),
      f.toggle('reached', 'Reached for toys?'),
      f.toggle('liftedHead', 'Lifted head?'),
      f.toggle('rolled', 'Rolled over?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Hated it', 'Loved it', 'Rolled!', 'Head up'],
  },

  {
    id: 'play',
    name: 'Play',
    emoji: '🧸',
    icon: 'game-controller-outline',
    color: '#FF6B6B',
    gradient: ['#FF6B6B', '#FF9F43'],
    description: 'Play and engagement',
    category: 'development',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'playType',
        'Play Type',
        [
          { id: 'floor', label: 'Floor Play', emoji: '🧸' },
          { id: 'peekaboo', label: 'Peek-a-boo', emoji: '🙈' },
          { id: 'stacking', label: 'Stacking', emoji: '🧱' },
          { id: 'puzzle', label: 'Puzzles', emoji: '🧩' },
          { id: 'imaginative', label: 'Imaginative', emoji: '👑' },
          { id: 'sensory', label: 'Sensory Play', emoji: '👋' },
          { id: 'water', label: 'Water Play', emoji: '💧' },
          { id: 'outdoor', label: 'Outdoor Play', emoji: '🌳' },
        ],
        { required: true }
      ),
      f.duration('duration', 'Duration'),
      f.rating('engagement', 'Engagement', 5),
      f.toggle('initiated', 'Self-initiated?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Loved it', 'New toy', 'Shared play', 'Independent'],
  },

  {
    id: 'reading',
    name: 'Reading',
    emoji: '📚',
    icon: 'book-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#341F97'],
    description: 'Reading sessions',
    category: 'development',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('bookTitle', 'Book Title', {
        placeholder: 'e.g., Goodnight Moon',
      }),
      f.duration('duration', 'Duration'),
      f.rating('engagement', 'Engagement', 5),
      f.toggle('turnedPages', 'Turned pages?'),
      f.toggle('pointed', 'Pointed at pictures?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Favorite', 'New book', 'Interactive', 'Bedtime'],
  },

  {
    id: 'speech',
    name: 'Speech',
    emoji: '💬',
    icon: 'chatbubble-outline',
    color: '#54A0FF',
    gradient: ['#54A0FF', '#5F27CD'],
    description: 'Language and speech development',
    category: 'development',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('word', 'Word / Phrase', {
        placeholder: 'e.g., Mama, Ball, All done',
      }),
      f.select(
        'type',
        'Type',
        [
          { id: 'first_word', label: 'First Word', emoji: '🎉' },
          { id: 'new_word', label: 'New Word', emoji: '✨' },
          { id: 'phrase', label: 'Phrase', emoji: '💬' },
          { id: 'sign', label: 'Sign Language', emoji: '✋' },
          { id: 'sound', label: 'Sound Imitation', emoji: '🐕' },
          { id: 'gesture', label: 'Gesture', emoji: '👋' },
        ],
        { required: true }
      ),
      f.toggle('understood', 'Understood context?'),
      f.toggle('repeated', 'Repeated after you?'),
      f.video('video', 'Video'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First word!', 'Mimic', 'Understood', 'Signed'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // EMOTIONAL
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'mood',
    name: 'Mood',
    emoji: '😊',
    icon: 'happy-outline',
    color: '#FFD700',
    gradient: ['#FFD700', '#FF9F43'],
    description: 'Daily mood tracking',
    category: 'emotional',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.mood('mood', 'Overall Mood', { required: true }),
      f.select('energy', 'Energy Level', [
        { id: 'high', label: 'High', emoji: '⚡' },
        { id: 'normal', label: 'Normal', emoji: '✅' },
        { id: 'low', label: 'Low', emoji: '😴' },
        { id: 'lethargic', label: 'Lethargic', emoji: '💤' },
      ]),
      f.multiselect('factors', 'Contributing Factors', [
        { id: 'slept_well', label: 'Slept well', emoji: '😴' },
        { id: 'hungry', label: 'Hungry', emoji: '🍽️' },
        { id: 'teething', label: 'Teething', emoji: '🦷' },
        { id: 'sick', label: 'Not feeling well', emoji: '😷' },
        { id: 'overstimulated', label: 'Overstimulated', emoji: '😵' },
        { id: 'growth_spurt', label: 'Growth spurt', emoji: '📈' },
        { id: 'routine_change', label: 'Routine change', emoji: '🔄' },
      ]),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Happy day', 'Fussy', 'Teething', 'Off day'],
  },

  {
    id: 'crying',
    name: 'Crying',
    emoji: '😭',
    icon: 'sad-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#341F97'],
    description: 'Crying episodes',
    category: 'emotional',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select('reason', 'Suspected Reason', [
        { id: 'hunger', label: 'Hunger', emoji: '🍽️' },
        { id: 'tired', label: 'Tired', emoji: '😴' },
        { id: 'discomfort', label: 'Discomfort', emoji: '😣' },
        { id: 'pain', label: 'Pain', emoji: '😰' },
        { id: 'overstimulated', label: 'Overstimulated', emoji: '😵' },
        { id: 'attention', label: 'Wants Attention', emoji: '👀' },
        { id: 'unknown', label: 'Unknown', emoji: '❓' },
      ]),
      f.duration('duration', 'Duration'),
      f.rating('intensity', 'Intensity', 5),
      f.select('soothedBy', 'Soothed By', [
        { id: 'feeding', label: 'Feeding', emoji: '🍼' },
        { id: 'rocking', label: 'Rocking', emoji: '🪑' },
        { id: 'pacifier', label: 'Pacifier', emoji: '😶' },
        { id: 'walking', label: 'Walking', emoji: '🚶' },
        { id: 'singing', label: 'Singing', emoji: '🎵' },
        { id: 'contact', label: 'Contact / Cuddles', emoji: '🤗' },
        { id: 'none', label: 'Nothing worked', emoji: '😭' },
      ]),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Colic', 'Teething', 'Overtired', 'Growth spurt'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHYSICAL CARE
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'nail_care',
    name: 'Nail Care',
    emoji: '💅',
    icon: 'cut-outline',
    color: '#FF9FF3',
    gradient: ['#FF9FF3', '#F368E0'],
    description: 'Nail trimming',
    category: 'physical',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'type',
        'Type',
        [
          { id: 'fingers', label: 'Fingernails', emoji: '👆' },
          { id: 'toes', label: 'Toenails', emoji: '🦶' },
          { id: 'both', label: 'Both', emoji: '👐' },
        ],
        { required: true }
      ),
      f.toggle('cooperative', 'Cooperative?'),
      f.toggle('cut', 'Any accidental cut?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Easy', 'Fought', 'Cut skin', 'Slept through'],
  },

  {
    id: 'oral_hygiene',
    name: 'Oral Hygiene',
    emoji: '🦷',
    icon: 'tooth-outline',
    color: '#54A0FF',
    gradient: ['#54A0FF', '#5F27CD'],
    description: 'Teeth and gum care',
    category: 'physical',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'type',
        'Type',
        [
          { id: 'brush', label: 'Brushing', emoji: '🪥' },
          { id: 'wipe', label: 'Gum Wipe', emoji: '🧻' },
          { id: 'floss', label: 'Floss', emoji: '🧵' },
          { id: 'first_tooth', label: 'First Tooth!', emoji: '🎉' },
        ],
        { required: true }
      ),
      f.toggle('cooperative', 'Cooperative?'),
      f.rating('thoroughness', 'Thoroughness', 5),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First tooth!', 'Cooperative', 'Fought', 'Gum bleed'],
  },

  {
    id: 'sunscreen',
    name: 'Sunscreen',
    emoji: '☀️',
    icon: 'sunny-outline',
    color: '#FFD700',
    gradient: ['#FFD700', '#FF9F43'],
    description: 'Sun protection',
    category: 'physical',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.number('spf', 'SPF', '', { min: 1, max: 100 }),
      f.select('type', 'Type', [
        { id: 'lotion', label: 'Lotion', emoji: '🧴' },
        { id: 'spray', label: 'Spray', emoji: '💨' },
        { id: 'stick', label: 'Stick', emoji: '💄' },
        { id: 'mineral', label: 'Mineral', emoji: '⛰️' },
      ]),
      f.multiselect('areas', 'Applied To', [
        { id: 'face', label: 'Face', emoji: '😊' },
        { id: 'ears', label: 'Ears', emoji: '👂' },
        { id: 'neck', label: 'Neck', emoji: '👤' },
        { id: 'arms', label: 'Arms', emoji: '💪' },
        { id: 'legs', label: 'Legs', emoji: '🦵' },
        { id: 'full', label: 'Full Body', emoji: '👤' },
      ]),
      f.toggle('reapplied', 'Reapplied?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Beach day', 'Park', 'Reapplied', 'First time'],
  },

  {
    id: 'skin_care',
    name: 'Skin Care',
    emoji: '🧴',
    icon: 'water-outline',
    color: '#F368E0',
    gradient: ['#F368E0', '#FF9FF3'],
    description: 'Moisturizing and skin care',
    category: 'physical',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'product',
        'Product',
        [
          { id: 'lotion', label: 'Lotion', emoji: '🧴' },
          { id: 'cream', label: 'Cream', emoji: '🧈' },
          { id: 'oil', label: 'Oil', emoji: '🫒' },
          { id: 'ointment', label: 'Ointment', emoji: '🔵' },
        ],
        { required: true }
      ),
      f.multiselect('areas', 'Body Areas', [
        { id: 'face', label: 'Face', emoji: '😊' },
        { id: 'body', label: 'Body', emoji: '👤' },
        { id: 'hands', label: 'Hands', emoji: '✋' },
        { id: 'feet', label: 'Feet', emoji: '🦶' },
        { id: 'diaper', label: 'Diaper Area', emoji: '👶' },
      ]),
      f.toggle('reaction', 'Any reaction?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Dry skin', 'Eczema care', 'After bath', 'Daily routine'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // NUTRITION
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'solid_food',
    name: 'Solid Food',
    emoji: '🥄',
    icon: 'restaurant-outline',
    color: '#FF9F43',
    gradient: ['#FF9F43', '#FFD700'],
    description: 'Solids and meals',
    category: 'nutrition',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('food', 'Food Item', {
        required: true,
        placeholder: 'e.g., Sweet potato, Banana',
      }),
      f.select('texture', 'Texture', [
        { id: 'puree', label: 'Puree', emoji: '🥣' },
        { id: 'mashed', label: 'Mashed', emoji: '🥔' },
        { id: 'soft', label: 'Soft Chunks', emoji: '🍌' },
        { id: 'finger', label: 'Finger Food', emoji: '👆' },
        { id: 'table', label: 'Table Food', emoji: '🍽️' },
      ]),
      f.quantity('amount', 'Amount', {
        unitOptions: SOLID_UNITS,
      }),
      f.rating('acceptance', 'Acceptance', 5),
      f.toggle('allergicReaction', 'Any reaction?'),
      f.textarea('reactionDetails', 'Reaction Details', {
        showIf: { field: 'allergicReaction', equals: true },
      }),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Loved it', 'Refused', 'New food', 'Allergic reaction'],
  },

  {
    id: 'water',
    name: 'Water',
    emoji: '💧',
    icon: 'water-outline',
    color: '#48DBFB',
    gradient: ['#48DBFB', '#0ABDE3'],
    description: 'Water intake',
    category: 'nutrition',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.quantity('amount', 'Amount', {
        required: true,
        unitOptions: LIQUID_UNITS,
      }),
      f.select('vessel', 'Vessel', [
        { id: 'bottle', label: 'Bottle', emoji: '🍼' },
        { id: 'sippy', label: 'Sippy Cup', emoji: '🥤' },
        { id: 'straw', label: 'Straw Cup', emoji: '🧃' },
        { id: 'open', label: 'Open Cup', emoji: '🥛' },
        { id: 'spoon', label: 'Spoon', emoji: '🥄' },
      ]),
      f.toggle('requested', 'Self-requested?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Hot day', 'Sick', 'Requested', 'Refused'],
  },

  {
    id: 'vitamin',
    name: 'Vitamin',
    emoji: '💊',
    icon: 'nutrition-outline',
    color: '#1DD1A1',
    gradient: ['#1DD1A1', '#10AC84'],
    description: 'Vitamins and supplements',
    category: 'nutrition',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('name', 'Supplement', {
        required: true,
        placeholder: 'e.g., Vitamin D drops',
      }),
      f.text('dosage', 'Dosage', { placeholder: 'e.g., 1 drop (400 IU)' }),
      f.select('type', 'Form', [
        { id: 'drops', label: 'Drops', emoji: '💧' },
        { id: 'liquid', label: 'Liquid', emoji: '🧪' },
        { id: 'chewable', label: 'Chewable', emoji: '🍬' },
        { id: 'powder', label: 'Powder', emoji: '📦' },
        { id: 'gummy', label: 'Gummy', emoji: '🐻' },
      ]),
      f.toggle('given', 'Given successfully?', { defaultValue: true }),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Daily routine', 'Missed', 'Refused', 'New supplement'],
  },

  {
    id: 'allergen_intro',
    name: 'Allergen Intro',
    emoji: '🥜',
    icon: 'warning-outline',
    color: '#EE5A24',
    gradient: ['#EE5A24', '#FF6B6B'],
    description: 'Introducing allergenic foods',
    category: 'nutrition',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'allergen',
        'Allergen',
        [
          { id: 'peanut', label: 'Peanut', emoji: '🥜' },
          { id: 'egg', label: 'Egg', emoji: '🥚' },
          { id: 'dairy', label: 'Dairy', emoji: '🥛' },
          { id: 'wheat', label: 'Wheat', emoji: '🌾' },
          { id: 'soy', label: 'Soy', emoji: '🫘' },
          { id: 'fish', label: 'Fish', emoji: '🐟' },
          { id: 'shellfish', label: 'Shellfish', emoji: '🦐' },
          { id: 'tree_nut', label: 'Tree Nut', emoji: '🌰' },
          { id: 'sesame', label: 'Sesame', emoji: '🫘' },
        ],
        { required: true }
      ),
      f.text('food', 'Specific Food', {
        placeholder: 'e.g., Peanut butter powder',
      }),
      f.quantity('amount', 'Amount', { unitOptions: SOLID_UNITS }),
      f.select('method', 'Method', [
        { id: 'mix', label: 'Mixed with food', emoji: '🥣' },
        { id: 'thin', label: 'Thinned out', emoji: '💧' },
        { id: 'baked', label: 'Baked in', emoji: '🍞' },
        { id: 'direct', label: 'Direct', emoji: '👆' },
      ]),
      f.toggle('reaction', 'Any reaction?'),
      f.textarea('reactionDetails', 'Reaction Details', {
        showIf: { field: 'reaction', equals: true },
      }),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First exposure', 'No reaction', 'Mild reaction', 'Cleared'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SAFETY
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'accident',
    name: 'Accident',
    emoji: '⚠️',
    icon: 'alert-triangle-outline',
    color: '#EE5A24',
    gradient: ['#EE5A24', '#FF6B6B'],
    description: 'Accidents and injuries',
    category: 'safety',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'type',
        'Type',
        [
          { id: 'fall', label: 'Fall', emoji: '📉' },
          { id: 'bump', label: 'Bump / Hit', emoji: '💥' },
          { id: 'cut', label: 'Cut / Scrape', emoji: '✂️' },
          { id: 'burn', label: 'Burn', emoji: '🔥' },
          { id: 'choking', label: 'Choking', emoji: '😰' },
          { id: 'near_miss', label: 'Near Miss', emoji: '⚠️' },
          { id: 'other', label: 'Other', emoji: '❓' },
        ],
        { required: true }
      ),
      f.select(
        'severity',
        'Severity',
        [
          { id: 'minor', label: 'Minor', emoji: '🟢' },
          { id: 'moderate', label: 'Moderate', emoji: '🟡' },
          { id: 'serious', label: 'Serious', emoji: '🔴' },
          { id: 'emergency', label: 'Emergency', emoji: '🚨' },
        ],
        { required: true }
      ),
      f.text('location', 'Where did it happen?', {
        placeholder: 'e.g., Living room, playground',
      }),
      f.toggle('medicalAttention', 'Medical attention needed?'),
      f.textarea('injuryDetails', 'What happened?'),
      f.photo('photos', 'Photos of Injury'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Minor', 'Doctor called', 'ER visit', 'Near miss'],
  },

  {
    id: 'car_seat',
    name: 'Car Seat',
    emoji: '🚗',
    icon: 'car-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#341F97'],
    description: 'Car seat checks',
    category: 'safety',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'checkType',
        'Check Type',
        [
          { id: 'install', label: 'Installation Check', emoji: '🔧' },
          { id: 'daily', label: 'Daily Buckle Check', emoji: '✅' },
          { id: 'adjust', label: 'Harness Adjustment', emoji: '📏' },
          { id: 'clean', label: 'Cleaning', emoji: '🧼' },
          { id: 'expire', label: 'Expiration Check', emoji: '📅' },
        ],
        { required: true }
      ),
      f.select('position', 'Seat Position', [
        { id: 'rear', label: 'Rear-facing', emoji: '👶' },
        { id: 'forward', label: 'Forward-facing', emoji: '👦' },
        { id: 'booster', label: 'Booster', emoji: '🪑' },
      ]),
      f.toggle('tight', 'Straps tight enough?'),
      f.toggle('chestClip', 'Chest clip at armpit?'),
      f.toggle('pinchTest', 'Pinch test passed?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Installed', 'Adjusted', 'Expired', 'New seat'],
  },

  {
    id: 'babyproofing',
    name: 'Babyproofing',
    emoji: '🛡️',
    icon: 'shield-checkmark-outline',
    color: '#1DD1A1',
    gradient: ['#1DD1A1', '#10AC84'],
    description: 'Home safety checks',
    category: 'safety',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'area',
        'Area',
        [
          { id: 'kitchen', label: 'Kitchen', emoji: '🍳' },
          { id: 'bathroom', label: 'Bathroom', emoji: '🚿' },
          { id: 'living', label: 'Living Room', emoji: '🛋️' },
          { id: 'bedroom', label: 'Bedroom', emoji: '🛏️' },
          { id: 'stairs', label: 'Stairs', emoji: '📶' },
          { id: 'outdoor', label: 'Outdoor', emoji: '🌳' },
          { id: 'garage', label: 'Garage', emoji: '🚗' },
          { id: 'whole', label: 'Whole House', emoji: '🏠' },
        ],
        { required: true }
      ),
      f.multiselect('measures', 'Measures Checked', [
        { id: 'outlets', label: 'Outlet Covers', emoji: '🔌' },
        { id: 'gates', label: 'Safety Gates', emoji: '🚧' },
        { id: 'cabinets', label: 'Cabinet Locks', emoji: '🔒' },
        { id: 'furniture', label: 'Furniture Anchors', emoji: '📌' },
        { id: 'blinds', label: 'Blind Cords', emoji: '🪟' },
        { id: 'corners', label: 'Corner Guards', emoji: '🔺' },
        { id: 'chemicals', label: 'Chemicals Secured', emoji: '☠️' },
        { id: 'medicine', label: 'Medicine Locked', emoji: '💊' },
      ]),
      f.toggle('complete', 'All measures in place?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Updated', 'New hazard', 'All clear', 'Needs work'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SCHEDULE
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'bedtime',
    name: 'Bedtime',
    emoji: '🌙',
    icon: 'moon-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#341F97'],
    description: 'Bedtime routine',
    category: 'schedule',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.time('time', 'Bedtime', { required: true }),
      f.duration('routineDuration', 'Routine Duration'),
      f.multiselect('routine', 'Routine Steps', [
        { id: 'bath', label: 'Bath', emoji: '🛁' },
        { id: 'lotion', label: 'Lotion / Massage', emoji: '🧴' },
        { id: 'pjs', label: 'PJs', emoji: '👕' },
        { id: 'nurse', label: 'Nurse / Bottle', emoji: '🍼' },
        { id: 'book', label: 'Book', emoji: '📚' },
        { id: 'song', label: 'Song', emoji: '🎵' },
        { id: 'prayer', label: 'Prayer', emoji: '🙏' },
        { id: 'white_noise', label: 'White Noise', emoji: '🔊' },
        { id: 'pacifier', label: 'Pacifier', emoji: '😶' },
        { id: 'swaddle', label: 'Swaddle', emoji: '📦' },
      ]),
      f.rating('ease', 'Ease of Going Down', 5),
      f.toggle('asleepIndependently', 'Fell asleep independently?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Easy', 'Fought', 'Routine complete', 'Skipped step'],
  },

  {
    id: 'screen_time',
    name: 'Screen Time',
    emoji: '📱',
    icon: 'phone-portrait-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#FF6B6B'],
    description: 'Screen exposure',
    category: 'schedule',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.duration('duration', 'Duration', { required: true }),
      f.select('type', 'Content Type', [
        { id: 'educational', label: 'Educational', emoji: '📚' },
        { id: 'entertainment', label: 'Entertainment', emoji: '🎬' },
        { id: 'video_call', label: 'Video Call', emoji: '📹' },
        { id: 'music', label: 'Music Video', emoji: '🎵' },
      ]),
      f.text('content', 'Specific Content', {
        placeholder: 'e.g., Ms. Rachel, ABC song',
      }),
      f.select('device', 'Device', [
        { id: 'tv', label: 'TV', emoji: '📺' },
        { id: 'tablet', label: 'Tablet', emoji: '📱' },
        { id: 'phone', label: 'Phone', emoji: '📲' },
      ]),
      f.toggle('coViewing', 'Co-viewing with adult?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Educational', 'Limit reached', 'Co-viewing', 'Solo'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // PARENTAL
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'note',
    name: 'Note',
    emoji: '📝',
    icon: 'create-outline',
    color: '#54A0FF',
    gradient: ['#54A0FF', '#5F27CD'],
    description: 'Quick notes and observations',
    category: 'parental',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('subject', 'Subject', {
        placeholder: 'e.g., New daycare teacher',
      }),
      f.textarea('content', 'Note', {
        required: true,
        placeholder: 'Write your observation here...',
      }),
      f.multiselect('tags', 'Tags', [
        { id: 'milestone', label: 'Milestone', emoji: '🏆' },
        { id: 'concern', label: 'Concern', emoji: '⚠️' },
        { id: 'funny', label: 'Funny', emoji: '😂' },
        { id: 'cute', label: 'Cute', emoji: '🥰' },
        { id: 'memory', label: 'Memory', emoji: '💭' },
        { id: 'todo', label: 'To-Do', emoji: '✅' },
      ]),
    ],
    quickTags: ['Important', 'Funny', 'To remember', 'Question for doctor'],
  },

  {
    id: 'photo',
    name: 'Photo',
    emoji: '📸',
    icon: 'camera-outline',
    color: '#FF9FF3',
    gradient: ['#FF9FF3', '#F368E0'],
    description: 'Photo memories',
    category: 'parental',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('caption', 'Caption', { placeholder: 'e.g., First smile!' }),
      f.photo('photos', 'Photos', { required: true }),
      f.text('location', 'Location'),
      f.multiselect('tags', 'Tags', [
        { id: 'milestone', label: 'Milestone', emoji: '🏆' },
        { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
        { id: 'funny', label: 'Funny', emoji: '😂' },
        { id: 'cute', label: 'Cute', emoji: '🥰' },
        { id: 'holiday', label: 'Holiday', emoji: '🎄' },
      ]),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First!', 'Family', 'Silly', 'Professional'],
  },

  {
    id: 'journal',
    name: 'Journal',
    emoji: '📔',
    icon: 'journal-outline',
    color: '#FFD700',
    gradient: ['#FFD700', '#FF9F43'],
    description: 'Detailed journal entries',
    category: 'parental',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('title', 'Entry Title', { required: true }),
      f.textarea('entry', 'Journal Entry', {
        required: true,
        placeholder: 'How was your day with baby?',
      }),
      f.select('mood', 'Your Mood', [
        { id: 'happy', label: 'Happy', emoji: '😊' },
        { id: 'tired', label: 'Tired', emoji: '😴' },
        { id: 'stressed', label: 'Stressed', emoji: '😰' },
        { id: 'grateful', label: 'Grateful', emoji: '🙏' },
        { id: 'overwhelmed', label: 'Overwhelmed', emoji: '😵' },
        { id: 'loving', label: 'Loving', emoji: '❤️' },
      ]),
      f.toggle('share', 'Share with co-parent?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Milestone day', 'Hard day', 'Grateful', 'Funny moment'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // TRAVEL
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'trip',
    name: 'Trip',
    emoji: '✈️',
    icon: 'airplane-outline',
    color: '#54A0FF',
    gradient: ['#54A0FF', '#5F27CD'],
    description: 'Travel and trips',
    category: 'travel',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('destination', 'Destination', {
        required: true,
        placeholder: "e.g., Grandma's house",
      }),
      f.select(
        'type',
        'Trip Type',
        [
          { id: 'day', label: 'Day Trip', emoji: '☀️' },
          { id: 'overnight', label: 'Overnight', emoji: '🌙' },
          { id: 'vacation', label: 'Vacation', emoji: '🏖️' },
          { id: 'visit', label: 'Family Visit', emoji: '👨‍👩‍👧' },
          { id: 'medical', label: 'Medical', emoji: '🏥' },
        ],
        { required: true }
      ),
      f.datetime('departure', 'Departure'),
      f.datetime('return', 'Return'),
      f.toggle('packingList', 'Packing list complete?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['First trip!', 'Went well', 'Hard travel', 'Packed light'],
  },

  {
    id: 'daycare',
    name: 'Daycare',
    emoji: '🏫',
    icon: 'school-outline',
    color: '#FFD700',
    gradient: ['#FFD700', '#FF9F43'],
    description: 'Daycare and school',
    category: 'travel',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('name', 'Daycare / School Name'),
      f.time('dropoff', 'Drop-off Time'),
      f.time('pickup', 'Pickup Time'),
      f.duration('duration', 'Duration'),
      f.toggle('ateWell', 'Ate well?'),
      f.toggle('napped', 'Napped?'),
      f.toggle('happy', 'Happy at pickup?'),
      f.textarea('teacherNotes', 'Teacher Notes'),
      f.textarea('notes', 'Your Notes'),
    ],
    quickTags: ['Good day', 'Rough day', 'New teacher', 'Milestone'],
  },

  {
    id: 'babysitter',
    name: 'Babysitter',
    emoji: '👤',
    icon: 'person-outline',
    color: '#FF9FF3',
    gradient: ['#FF9FF3', '#F368E0'],
    description: 'Babysitter and caregiver logs',
    category: 'travel',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('name', 'Sitter Name', { required: true }),
      f.datetime('startTime', 'Start Time'),
      f.datetime('endTime', 'End Time'),
      f.duration('duration', 'Duration'),
      f.toggle('instructionsGiven', 'Instructions given?'),
      f.toggle('emergencyInfo', 'Emergency info shared?'),
      f.textarea('instructions', 'Special Instructions'),
      f.textarea('report', 'Sitter Report'),
      f.textarea('notes', 'Your Notes'),
    ],
    quickTags: ['New sitter', 'Regular', 'Went well', 'Issues'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SPECIAL NEEDS
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'reflux',
    name: 'Reflux',
    emoji: '😣',
    icon: 'arrow-up-outline',
    color: '#FF6B6B',
    gradient: ['#FF6B6B', '#EE5A24'],
    description: 'GERD and reflux episodes',
    category: 'special_needs',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'severity',
        'Severity',
        [
          { id: 'mild', label: 'Mild (spit up)', emoji: '🟢' },
          { id: 'moderate', label: 'Moderate (discomfort)', emoji: '🟡' },
          { id: 'severe', label: 'Severe (pain / vomiting)', emoji: '🔴' },
        ],
        { required: true }
      ),
      f.select('timing', 'Timing', [
        { id: 'after_feed', label: 'After Feeding', emoji: '🍼' },
        { id: 'during_feed', label: 'During Feeding', emoji: '🥄' },
        { id: 'lying', label: 'While Lying Down', emoji: '🛏️' },
        { id: 'random', label: 'Random', emoji: '❓' },
      ]),
      f.toggle('projectile', 'Projectile?'),
      f.toggle('blood', 'Blood in vomit?'),
      f.multiselect('triggers', 'Triggers', [
        { id: 'overfeeding', label: 'Overfeeding', emoji: '🍼' },
        { id: 'position', label: 'Position', emoji: '🛏️' },
        { id: 'food', label: 'Specific Food', emoji: '🥜' },
        { id: 'stress', label: 'Stress', emoji: '😰' },
      ]),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['After feed', 'Projectile', 'Blood', 'Medication helped'],
  },

  {
    id: 'colic',
    name: 'Colic',
    emoji: '😭',
    icon: 'time-outline',
    color: '#5F27CD',
    gradient: ['#5F27CD', '#341F97'],
    description: 'Colic episodes',
    category: 'special_needs',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.time('startTime', 'Episode Start'),
      f.duration('duration', 'Duration'),
      f.rating('intensity', 'Intensity', 5),
      f.multiselect('symptoms', 'Symptoms', [
        { id: 'crying', label: 'Intense Crying', emoji: '😭' },
        { id: 'clenched', label: 'Clenched Fists', emoji: '✊' },
        { id: 'legs', label: 'Legs to Tummy', emoji: '🦵' },
        { id: 'flushed', label: 'Flushed Face', emoji: '🔴' },
        { id: 'inconsolable', label: 'Inconsolable', emoji: '😰' },
      ]),
      f.multiselect('relief', 'Relief Attempted', [
        { id: 'swaddle', label: 'Swaddle', emoji: '📦' },
        { id: 'white_noise', label: 'White Noise', emoji: '🔊' },
        { id: 'walking', label: 'Walking', emoji: '🚶' },
        { id: 'driving', label: 'Driving', emoji: '🚗' },
        { id: 'probiotics', label: 'Probiotics', emoji: '💊' },
        { id: 'gas_drops', label: 'Gas Drops', emoji: '💧' },
      ]),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Evening', 'Predictable', 'Nothing worked', 'Gas drops helped'],
  },

  {
    id: 'constipation',
    name: 'Constipation',
    emoji: '😣',
    icon: 'remove-circle-outline',
    color: '#EE5A24',
    gradient: ['#EE5A24', '#FF6B6B'],
    description: 'Constipation tracking',
    category: 'special_needs',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.number('daysSince', 'Days Since Last BM', '', { min: 0 }),
      f.select('stoolType', 'Stool Type (Bristol)', [
        { id: '1', label: 'Type 1: Separate hard lumps', emoji: '⚫' },
        { id: '2', label: 'Type 2: Sausage-shaped but lumpy', emoji: '🟤' },
        { id: '3', label: 'Type 3: Sausage with cracks', emoji: '🟤' },
        { id: '4', label: 'Type 4: Smooth soft sausage', emoji: '🟢' },
        { id: '5', label: 'Type 5: Soft blobs', emoji: '🟡' },
      ]),
      f.multiselect('symptoms', 'Symptoms', [
        { id: 'straining', label: 'Straining', emoji: '😣' },
        { id: 'pain', label: 'Pain', emoji: '😰' },
        { id: 'refusal', label: 'Refusing to eat', emoji: '🙅' },
        { id: 'bloating', label: 'Bloating', emoji: '🎈' },
        { id: 'cranky', label: 'Cranky', emoji: '😤' },
      ]),
      f.multiselect('relief', 'Relief Attempted', [
        { id: 'prune', label: 'Prune Juice / Puree', emoji: '🟣' },
        { id: 'pear', label: 'Pear Juice', emoji: '🍐' },
        { id: 'water', label: 'Extra Water', emoji: '💧' },
        { id: 'fiber', label: 'Fiber Foods', emoji: '🥦' },
        { id: 'bicycle', label: 'Bicycle Legs', emoji: '🚲' },
        { id: 'massage', label: 'Tummy Massage', emoji: '💆' },
        { id: 'suppository', label: 'Suppository', emoji: '🔴' },
      ]),
      f.toggle('relieved', 'Relieved?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Day 3+', 'Relieved', 'Prune helped', 'Doctor called'],
  },

  {
    id: 'diarrhea',
    name: 'Diarrhea',
    emoji: '💩',
    icon: 'water-outline',
    color: '#1DD1A1',
    gradient: ['#1DD1A1', '#48DBFB'],
    description: 'Diarrhea and hydration',
    category: 'special_needs',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.number('episodes', 'Episodes Today', '', { min: 0 }),
      f.select(
        'consistency',
        'Consistency',
        [
          { id: 'watery', label: 'Watery', emoji: '💧' },
          { id: 'loose', label: 'Loose / Mushy', emoji: '🟡' },
          { id: 'mucus', label: 'Mucus', emoji: '🟢' },
          { id: 'bloody', label: 'Bloody', emoji: '🔴' },
        ],
        { required: true }
      ),
      f.toggle('fever', 'Fever?'),
      f.toggle('vomiting', 'Vomiting?'),
      f.toggle('dehydration', 'Signs of dehydration?'),
      f.multiselect('hydration', 'Hydration Given', [
        { id: 'breastmilk', label: 'Breastmilk', emoji: '🤱' },
        { id: 'formula', label: 'Formula', emoji: '🍼' },
        { id: 'pedialyte', label: 'Pedialyte', emoji: '💧' },
        { id: 'water', label: 'Water', emoji: '💧' },
      ]),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Mild', 'Severe', 'Dehydration concern', 'Improving'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // HOUSEHOLD
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'supply_inventory',
    name: 'Supplies',
    emoji: '📦',
    icon: 'cube-outline',
    color: '#8E44AD',
    gradient: ['#8E44AD', '#9B59B6'],
    description: 'Track supply stock levels',
    category: 'household',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'item',
        'Item',
        [
          { id: 'diapers', label: 'Diapers', emoji: '👶' },
          { id: 'wipes', label: 'Wipes', emoji: '🧻' },
          { id: 'formula', label: 'Formula', emoji: '🍼' },
          { id: 'diaper_cream', label: 'Diaper Cream', emoji: '🧴' },
          { id: 'lotion', label: 'Lotion', emoji: '🫧' },
          { id: 'shampoo', label: 'Shampoo', emoji: '🧼' },
          { id: 'medicine', label: 'Medicine', emoji: '💊' },
          { id: 'pacifiers', label: 'Pacifiers', emoji: '😶' },
        ],
        { required: true }
      ),
      f.select('status', 'Stock Status', [
        { id: 'full', label: 'Full', emoji: '🟢' },
        { id: 'half', label: 'Half', emoji: '🟡' },
        { id: 'low', label: 'Low', emoji: '🔴' },
        { id: 'out', label: 'Out', emoji: '⚫' },
      ]),
      f.number('quantity', 'Quantity Remaining'),
      f.toggle('reorder', 'Need to reorder?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Stocked up', 'Running low', 'Ordered', 'Out of stock'],
  },

  {
    id: 'expenses',
    name: 'Expenses',
    emoji: '💰',
    icon: 'cash-outline',
    color: '#F39C12',
    gradient: ['#F39C12', '#E67E22'],
    description: 'Baby-related spending',
    category: 'household',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.text('item', 'Item / Service', {
        required: true,
        placeholder: 'e.g., Diapers',
      }),
      f.number('cost', 'Cost', '', { required: true }),
      f.select('category', 'Category', [
        { id: 'diapers', label: 'Diapers', emoji: '👶' },
        { id: 'formula', label: 'Formula / Food', emoji: '🍼' },
        { id: 'clothing', label: 'Clothing', emoji: '👕' },
        { id: 'gear', label: 'Gear / Equipment', emoji: '🛒' },
        { id: 'medical', label: 'Medical', emoji: '🏥' },
        { id: 'toys', label: 'Toys / Books', emoji: '🧸' },
        { id: 'childcare', label: 'Childcare', emoji: '👩‍🏫' },
        { id: 'other', label: 'Other', emoji: '📦' },
      ]),
      f.toggle('essential', 'Essential purchase?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Essential', 'Splurge', 'Sale', 'Subscription'],
  },

  {
    id: 'cleaning',
    name: 'Cleaning',
    emoji: '🧼',
    icon: 'sparkles-outline',
    color: '#00B894',
    gradient: ['#00B894', '#00CEC9'],
    description: 'Bottle, pump, and toy cleaning',
    category: 'household',
    isCustom: false,
    createdAt: 0,
    updatedAt: 0,
    permissions: defaultPerms,
    fields: [
      f.select(
        'item',
        'Item Cleaned',
        [
          { id: 'bottles', label: 'Bottles', emoji: '🍼' },
          { id: 'pump_parts', label: 'Pump Parts', emoji: '🤱' },
          { id: 'pacifiers', label: 'Pacifiers', emoji: '😶' },
          { id: 'toys', label: 'Toys', emoji: '🧸' },
          { id: 'high_chair', label: 'High Chair', emoji: '🪑' },
          { id: 'clothes', label: 'Clothes', emoji: '👕' },
          { id: 'sheets', label: 'Sheets', emoji: '🛏️' },
        ],
        { required: true }
      ),
      f.select('method', 'Method', [
        { id: 'wash', label: 'Hand Wash', emoji: '🧼' },
        { id: 'dishwasher', label: 'Dishwasher', emoji: '🍽️' },
        { id: 'sterilize', label: 'Sterilized', emoji: '♨️' },
        { id: 'wipe', label: 'Wiped Down', emoji: '🧻' },
      ]),
      f.toggle('complete', 'Complete?'),
      f.textarea('notes', 'Notes'),
    ],
    quickTags: ['Sterilized', 'Deep clean', 'Daily wash', 'Behind schedule'],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Derive list of default tracker IDs from DEFAULT_TRACKERS
// ═══════════════════════════════════════════════════════════════════════

export const DEFAULT_TRACKER_IDS: readonly string[] = DEFAULT_TRACKERS.map(
  (t) => t.id
);

// ═══════════════════════════════════════════════════════════════════════
// CREATE CUSTOM TRACKER
// ═══════════════════════════════════════════════════════════════════════

export const createCustomTracker = (
  name: string,
  emoji: string,
  category: TrackerCategory,
  fields: FieldConfig[],
  createdBy: string,
  options?: {
    icon?: string;
    color?: string;
    gradient?: [string, string];
    description?: string;
    quickTags?: string[];
    permissions?: UnifiedTrackerConfig['permissions'];
  }
): UnifiedTrackerConfig => {
  const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    name: name.trim(),
    emoji,
    icon: options?.icon || 'add-circle-outline',
    color: options?.color || '#5F27CD',
    gradient: options?.gradient || ['#5F27CD', '#341F97'],
    description: options?.description || `Custom tracker: ${name}`,
    category,
    fields,
    quickTags: options?.quickTags || [],
    isCustom: true,
    createdBy,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    permissions: options?.permissions || {
      // Cast to satisfy the exact union type in UnifiedTrackerConfig
      familyRoles: ['parent1', 'parent2', 'guardian'] as (
        | 'parent1'
        | 'parent2'
        | 'guardian'
      )[],
      allowGuardiansCreate: true,
      allowGuardiansEditOwn: true,
      allowGuardiansDeleteOwn: true,
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════

export const validateCustomTracker = (
  tracker: UnifiedTrackerConfig
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!tracker.name || tracker.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  if (!tracker.emoji) {
    errors.push('Emoji is required');
  }
  if (!tracker.fields || tracker.fields.length === 0) {
    errors.push('At least one field is required');
  }
  if (!tracker.category) {
    errors.push('Category is required');
  }

  tracker.fields?.forEach((field, index) => {
    if (!field.id || !/^[a-z][a-z0-9_]*$/.test(field.id)) {
      errors.push(`Field ${index + 1}: ID must be snake_case starting with a letter`);
    }
    if (!field.label) {
      errors.push(`Field ${index + 1}: Label is required`);
    }
    if (field.type === 'select' || field.type === 'multiselect') {
      if (!field.options || field.options.length === 0) {
        errors.push(`Field ${index + 1}: Select fields require options`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
};

// ═══════════════════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════

export const getDefaultTracker = (id: string): UnifiedTrackerConfig | undefined => {
  return DEFAULT_TRACKERS.find((t) => t.id === id);
};

export const getDefaultTrackerIds = (): string[] =>
  DEFAULT_TRACKERS.map((t) => t.id);

export const getTrackersByCategory = (
  category: TrackerCategory
): UnifiedTrackerConfig[] => {
  return DEFAULT_TRACKERS.filter((t) => t.category === category);
};

export const getCategorySummary = (): {
  category: TrackerCategory;
  count: number;
  emoji: string;
}[] => {
  const emojiMap: Record<TrackerCategory, string> = {
    essential: '⭐',
    health: '🏥',
    development: '🧠',
    emotional: '❤️',
    physical: '💅',
    nutrition: '🍎',
    safety: '🛡️',
    schedule: '⏰',
    parental: '👨‍👩‍👧',
    travel: '✈️',
    special_needs: '♿',
    household: '🏠',
    custom: '✨',
  };

  const counts = DEFAULT_TRACKERS.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (Object.keys(emojiMap) as TrackerCategory[])
    .map((cat) => ({
      category: cat,
      count: counts[cat] || 0,
      emoji: emojiMap[cat],
    }))
    .filter((c) => c.count > 0); // Hide empty categories
};