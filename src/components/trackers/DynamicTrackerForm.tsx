// DynamicTrackerForm.tsx — COMPLETE V10
// ═══════════════════════════════════════════════════════════════════════════
// FIXED IN V10:
//   ✓ Added `pain_scale` field type (0–10 slider with emoji anchors)
//   ✓ Added `time` field type with dedicated picker (was broken → text input)
//   ✓ Added `video` field placeholder (no longer silent fallthrough)
//   ✓ `SmartNumberField` respects `field.step` for decimal precision
//   ✓ `SmartQuantityField` uses canonical SOLID_UNITS / LIQUID_UNITS
//   ✓ `updateField` clears sibling fields properly on all cross-field changes
//   ✓ `handleSubmit` duration computation covers ALL duration trackers
//   ✓ `SmartDurationField` supports ongoing for tummy_time / pumping / bath
//   ✓ Fixed TS narrowing on `suggestion.value` (no more `!` where unneeded)
//   ✓ Removed unused imports (SCREEN_W) and dead module-level comment
//   ✓ Inputs disabled while submitting (prevent double-tap edits)
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import SmartPhotoField from './SmartPhotoField';
import {
  UnifiedTrackerConfig,
  FieldConfig,
  FieldOption,
  LIQUID_UNITS as CANONICAL_LIQUID_UNITS,
  SOLID_UNITS as CANONICAL_SOLID_UNITS,
} from '../../types/trackers';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useBaby } from '../../context/BabyContext';
import {
  TrackerProgressiveState,
  ProgressiveSuggestion,
  ProgressiveTrend,
} from '../../hooks/useTrackerProgressive';
import { MOOD_EMOJIS } from './trackerConstants';
import { isFieldVisible } from '../../utils/form';

// ─── Per-tracker default values ────────────────────────────────────────────
// Applied only when no user data or prefill exists for that field.
const TRACKER_DEFAULTS: Record<string, Record<string, unknown>> = {
  mood: { mood: 3 },
  crying: { intensity: 3 },
  sleep: { sleepType: 'nap', status: 'ongoing' },
  feed: { feedType: 'breast' },
  diaper: { type: 'wet' },
  potty: { type: 'pee', successful: true },
  temperature: { unit: 'celsius' },
  medication: { given: true },
  bath: { shampoo: false, soap: true },
  solid_food: { texture: 'puree' },
  water: { vessel: 'sippy' },
  vitamin: { given: true },
  screen_time: { device: 'tv' },
  bedtime: { routineDuration: 1800 }, // 30 min default
  play: { engagement: 3 },
  tummy_time: { tolerance: 3 },
  reading: { engagement: 3 },
};

const getTrackerDefaults = (trackerId: string): Record<string, unknown> =>
  TRACKER_DEFAULTS[trackerId] ?? {};

interface DynamicTrackerFormProps {
  tracker: UnifiedTrackerConfig;
  initialData?: Record<string, unknown>;
  onSubmit: (
    data: Record<string, unknown>,
    options: {
      title?: string;
      notes?: string;
      photoUris?: string[];
      tags?: string[];
      linkedEntryId?: string;
    }
  ) => void;
  onCancel?: () => void;
  progressiveState?: Partial<TrackerProgressiveState>;
  linkedEntryId?: string;
  showInsights?: boolean;
  quickMode?: boolean;
}

const TREND_ICONS = {
  up: 'trending-up-outline',
  down: 'trending-down-outline',
  same: 'remove-outline',
};

// ─── Validation helpers ────────────────────────────────────────────────────
const MAX_FUTURE_MS = 5 * 60 * 1000; // 5 minutes ahead is OK (clock skew)

// ─── Growth value sanity bounds by age (in months) ─────────────────────────
// Based on WHO growth standards + 2 SD margins.
const GROWTH_BOUNDS = {
  weight: (ageMonths: number): { min: number; max: number } => {
    if (ageMonths < 3) return { min: 1.5, max: 9 };
    if (ageMonths < 6) return { min: 3, max: 12 };
    if (ageMonths < 12) return { min: 5, max: 16 };
    if (ageMonths < 24) return { min: 7, max: 20 };
    return { min: 8, max: 30 };
  },
  height: (ageMonths: number): { min: number; max: number } => {
    if (ageMonths < 3) return { min: 35, max: 70 };
    if (ageMonths < 6) return { min: 50, max: 78 };
    if (ageMonths < 12) return { min: 60, max: 90 };
    if (ageMonths < 24) return { min: 70, max: 100 };
    return { min: 75, max: 120 };
  },
  head: (ageMonths: number): { min: number; max: number } => {
    if (ageMonths < 3) return { min: 30, max: 45 };
    if (ageMonths < 6) return { min: 35, max: 48 };
    if (ageMonths < 12) return { min: 38, max: 50 };
    if (ageMonths < 24) return { min: 40, max: 52 };
    return { min: 42, max: 56 };
  },
};

const validateGrowthValue = (
  measurementType: string,
  value: number,
  ageMonths: number,
  unit: string
): string | null => {
  if (!Number.isFinite(value) || value <= 0) return 'Value must be positive';

  const type = measurementType?.toLowerCase();
  if (!['weight', 'height', 'head'].includes(type)) return null;

  // Normalize to metric for bounds check
  let normalizedValue = value;
  if (type === 'weight' && unit === 'lb') normalizedValue = value * 0.453592;
  else if (type === 'weight' && unit === 'oz') normalizedValue = value * 0.0283495;
  else if (type === 'weight' && unit === 'g') normalizedValue = value / 1000;
  else if ((type === 'height' || type === 'head') && unit === 'in')
    normalizedValue = value * 2.54;

  const bounds = GROWTH_BOUNDS[type as 'weight' | 'height' | 'head'](ageMonths);
  if (normalizedValue < bounds.min || normalizedValue > bounds.max) {
    const unitLabel = type === 'weight' ? 'kg' : 'cm';
    return `Value looks unusual for this age (expected ${bounds.min}–${bounds.max} ${unitLabel}). Double-check.`;
  }

  return null;
};

const isFutureTimestamp = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return false;
  return d.getTime() - Date.now() > MAX_FUTURE_MS;
};

// ─── Duration formatter ────────────────────────────────────────────────────
const formatDurationSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const mins = Math.floor(seconds / 60);
  if (mins === 0) return `${seconds}s`;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── Streak badge ──────────────────────────────────────────────────────────
const StreakBadge: React.FC<{
  streak: TrackerProgressiveState['streak'];
  color: string;
}> = ({ streak, color }) => {
  if (!streak || streak.currentStreak === 0) return null;

  const isAtRisk = streak.isAtRisk;

  return (
    <Animated.View
      entering={FadeIn}
      style={[
        styles.streakBadge,
        {
          backgroundColor: isAtRisk ? '#FF6B6B20' : `${color}15`,
          borderColor: isAtRisk ? '#FF6B6B' : color,
        },
      ]}
    >
      <Ionicons
        name={isAtRisk ? 'flame-outline' : 'flame'}
        size={16}
        color={isAtRisk ? '#FF6B6B' : color}
      />
      <Text style={[styles.streakText, { color: isAtRisk ? '#FF6B6B' : color }]}>
        {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
        {isAtRisk ? ' (log soon!)' : ''}
      </Text>
    </Animated.View>
  );
};

// ─── Time context badge ────────────────────────────────────────────────────
const TimeContextBadge: React.FC<{
  timeContext: TrackerProgressiveState['timeContext'] | undefined;
  color: string;
  colors: any;
}> = ({ timeContext, color, colors }) => {
  if (!timeContext || timeContext.usualTimes.length === 0) return null;

  return (
    <View style={[styles.timeContextBadge, { backgroundColor: `${color}10` }]}>
      <Ionicons name="time-outline" size={14} color={color} />
      <Text style={[styles.timeContextText, { color: colors.textSecondary }]}>
        {timeContext.timeOfDay} • Usually {timeContext.usualTimes[0]}
        {timeContext.nextSuggestedTime &&
          ` • Next: ${timeContext.nextSuggestedTime}`}
      </Text>
    </View>
  );
};

// ─── Shared field wrapper ──────────────────────────────────────────────────
const FieldLabel: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  colors: any;
  fontSizeMultiplier: number;
  rightAccessory?: React.ReactNode;
}> = ({
  label,
  required,
  hint,
  colors,
  fontSizeMultiplier,
  rightAccessory,
}) => (
  <View style={styles.labelRow}>
    <View style={styles.labelTextWrap}>
      <Text
        style={[
          styles.label,
          { color: colors.text, fontSize: 15 * fontSizeMultiplier },
        ]}
      >
        {label}
        {required && (
          <Text
            style={[styles.required, { color: colors.error || '#ef4444' }]}
          >
            {' '}
            *
          </Text>
        )}
      </Text>
      {hint ? (
        <Text
          style={[
            styles.labelHint,
            { color: colors.textSecondary, fontSize: 11 * fontSizeMultiplier },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
    {rightAccessory}
  </View>
);

// ─── Smart Multi-Select Field ──────────────────────────────────────────────
const SmartMultiSelectField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  suggestion?: ProgressiveSuggestion;
  yesterdayValue?: unknown;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  error,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  suggestion,
  yesterdayValue,
  editable = true,
}) => {
  const selected = Array.isArray(value) ? value : [];

  const hasSuggestion =
    suggestion !== undefined &&
    suggestion.confidence >= 60 &&
    Array.isArray(suggestion.value) &&
    suggestion.value.length > 0;

  const hasYesterday =
    yesterdayValue !== undefined &&
    Array.isArray(yesterdayValue) &&
    yesterdayValue.length > 0;

  const suggestionArray = useMemo(
    () => (hasSuggestion ? (suggestion!.value as unknown[]) : []),
    [hasSuggestion, suggestion]
  );

  const yesterdayArray = useMemo(
    () => (hasYesterday ? (yesterdayValue as unknown[]) : []),
    [hasYesterday, yesterdayValue]
  );

  const toggleOption = useCallback(
    (optionId: string) => {
      const newSelected = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
      onChange(newSelected);
    },
    [selected, onChange]
  );

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          selected.length > 0 ? (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: `${tracker.color}15` },
              ]}
            >
              <Text style={[styles.countText, { color: tracker.color }]}>
                {selected.length} selected
              </Text>
            </View>
          ) : null
        }
      />

      {(hasSuggestion || hasYesterday) && editable && (
        <View style={styles.suggestionRow}>
          {hasSuggestion && (
            <TouchableOpacity
              onPress={() => onChange(suggestionArray)}
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: `${tracker.color}15`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
            >
              <Text style={styles.suggestionChipEmoji}>✨</Text>
              <Text
                style={[styles.suggestionChipText, { color: tracker.color }]}
              >
                Suggest ({suggestionArray.join(', ')})
              </Text>
            </TouchableOpacity>
          )}
          {hasYesterday && (
            <TouchableOpacity
              onPress={() => onChange(yesterdayArray)}
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: `${colors.textSecondary}15`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.suggestionChipText,
                  { color: colors.textSecondary },
                ]}
              >
                Yesterday ({yesterdayArray.join(', ')})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.optionsWrap}>
        {field.options?.map((option: FieldOption) => {
          const isSelected = selected.includes(option.id);
          const isSuggested = suggestionArray.includes(option.id);

          return (
            <TouchableOpacity
              key={option.id}
              disabled={!editable}
              style={[
                styles.optionChip,
                {
                  backgroundColor: isSelected
                    ? `${tracker.color}20`
                    : isSuggested
                    ? `${tracker.color}08`
                    : colors.surface,
                  borderColor: isSelected
                    ? tracker.color
                    : isSuggested
                    ? `${tracker.color}50`
                    : colors.border,
                  borderRadius: borderRadiusValue,
                  borderWidth: isSuggested ? 2 : 1.5,
                  opacity: !editable ? 0.7 : 1,
                },
              ]}
              onPress={() => toggleOption(option.id)}
            >
              {option.emoji && (
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
              )}
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: isSelected
                      ? tracker.color
                      : isSuggested
                      ? tracker.color
                      : colors.textSecondary,
                  },
                  isSelected && { fontWeight: '600' },
                ]}
              >
                {option.label}
              </Text>
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={tracker.color}
                />
              )}
              {isSuggested && !isSelected && (
                <Text
                  style={[styles.suggestIndicator, { color: tracker.color }]}
                >
                  ✨
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

// ─── Smart Select Field ────────────────────────────────────────────────────
const SmartSelectField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  suggestion?: ProgressiveSuggestion;
  yesterdayValue?: unknown;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  error,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  suggestion,
  yesterdayValue,
  editable = true,
}) => {
  const hasSuggestion =
    suggestion !== undefined &&
    suggestion.confidence >= 60 &&
    suggestion.value !== undefined &&
    suggestion.value !== '' &&
    field.options?.some((o) => o.id === suggestion.value);

  const hasYesterday =
    !hasSuggestion &&
    yesterdayValue !== undefined &&
    yesterdayValue !== '' &&
    field.options?.some((o) => o.id === yesterdayValue);

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      {(hasSuggestion || hasYesterday) && editable && (
        <View style={styles.suggestionRow}>
          {hasSuggestion && (
            <TouchableOpacity
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: `${tracker.color}15`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
              onPress={() => onChange(suggestion!.value)}
            >
              <Text style={styles.suggestionChipEmoji}>✨</Text>
              <Text
                style={[styles.suggestionChipText, { color: tracker.color }]}
              >
                {field.options?.find((o) => o.id === suggestion!.value)
                  ?.label || String(suggestion!.value)}{' '}
                ({suggestion!.confidence}%)
              </Text>
            </TouchableOpacity>
          )}
          {hasYesterday && (
            <TouchableOpacity
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: `${colors.textSecondary}15`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
              onPress={() => onChange(yesterdayValue)}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.suggestionChipText,
                  { color: colors.textSecondary },
                ]}
              >
                Yesterday:{' '}
                {field.options?.find((o) => o.id === yesterdayValue)?.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.optionsRow}>
        {field.options?.map((option: FieldOption) => {
          const isSelected = value === option.id;
          const isSuggested =
            hasSuggestion && suggestion?.value === option.id;

          return (
            <TouchableOpacity
              key={option.id}
              disabled={!editable}
              style={[
                styles.optionChip,
                {
                  backgroundColor: isSelected
                    ? `${tracker.color}20`
                    : isSuggested
                    ? `${tracker.color}08`
                    : colors.surface,
                  borderColor: isSelected
                    ? tracker.color
                    : isSuggested
                    ? `${tracker.color}50`
                    : colors.border,
                  borderRadius: borderRadiusValue,
                  borderWidth: isSuggested ? 2 : 1.5,
                  opacity: !editable ? 0.7 : 1,
                },
              ]}
              onPress={() => onChange(option.id)}
            >
              {option.emoji && (
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
              )}
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: isSelected
                      ? tracker.color
                      : isSuggested
                      ? tracker.color
                      : colors.textSecondary,
                  },
                  isSelected && { fontWeight: '600' },
                ]}
              >
                {option.label}
              </Text>
              {isSuggested && !isSelected && (
                <Text
                  style={[styles.suggestIndicator, { color: tracker.color }]}
                >
                  ✨
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

// ─── Smart Text Field ──────────────────────────────────────────────────────
const SmartTextField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  suggestion?: ProgressiveSuggestion;
  yesterdayValue?: unknown;
  trend?: ProgressiveTrend;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  error,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  suggestion,
  yesterdayValue,
  trend,
  editable = true,
}) => {
  const hasSuggestion =
    suggestion !== undefined &&
    suggestion.confidence >= 60 &&
    suggestion.value !== undefined &&
    suggestion.value !== '';

  const hasYesterday =
    !hasSuggestion &&
    yesterdayValue !== undefined &&
    yesterdayValue !== '';

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          trend && trend.direction !== 'same' ? (
            <View style={styles.trendBadge}>
              <Ionicons
                name={TREND_ICONS[trend.direction]}
                size={14}
                color={
                  trend.direction === 'up' ? colors.success : colors.error
                }
              />
              <Text
                style={[
                  styles.trendText,
                  {
                    color:
                      trend.direction === 'up'
                        ? colors.success
                        : colors.error,
                  },
                ]}
              >
                {trend.deltaLabel}
              </Text>
            </View>
          ) : null
        }
      />

      <TextInput
        editable={editable}
        style={[
          styles.input,
          {
            borderColor: error
              ? colors.error
              : hasSuggestion
              ? tracker.color
              : colors.border,
            borderRadius: borderRadiusValue,
            backgroundColor: error
              ? `${colors.error}10`
              : hasSuggestion
              ? `${tracker.color}05`
              : colors.surface,
            color: colors.text,
            fontSize: 16 * fontSizeMultiplier,
            opacity: !editable ? 0.7 : 1,
          },
        ]}
        placeholder={
          field.placeholder ||
          (hasSuggestion
            ? `${suggestion!.emoji} ${String(suggestion!.value)}`
            : '')
        }
        placeholderTextColor={
          hasSuggestion ? tracker.color : colors.textSecondary
        }
        value={String(value || '')}
        onChangeText={(text) => onChange(text)}
      />

      {field.unit && (
        <Text style={[styles.unit, { color: colors.textSecondary }]}>
          {field.unit}
        </Text>
      )}

      {(hasSuggestion || hasYesterday) && editable && (
        <View style={styles.suggestionRow}>
          {hasSuggestion && (
            <TouchableOpacity
              onPress={() => onChange(suggestion!.value)}
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: `${tracker.color}15`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
            >
              <Text style={styles.suggestionChipEmoji}>
                {suggestion!.emoji}
              </Text>
              <Text
                style={[styles.suggestionChipText, { color: tracker.color }]}
              >
                {suggestion!.label} ({suggestion!.confidence}%)
              </Text>
            </TouchableOpacity>
          )}
          {hasYesterday && (
            <TouchableOpacity
              onPress={() => onChange(yesterdayValue)}
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: `${colors.textSecondary}15`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.suggestionChipText,
                  { color: colors.textSecondary },
                ]}
              >
                Yesterday: {String(yesterdayValue).slice(0, 20)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

// ─── Smart Number Field ────────────────────────────────────────────────────
const SmartNumberField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  suggestion?: ProgressiveSuggestion;
  yesterdayValue?: unknown;
  trend?: ProgressiveTrend;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  error,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  suggestion,
  yesterdayValue,
  trend,
  editable = true,
}) => {
  const quickValues = useMemo(() => {
    const values: { label: string; value: number; emoji?: string }[] = [];
    const suggNum = Number(suggestion?.value);
    const yestNum = Number(yesterdayValue);

    const isValid = (n: number) => Number.isFinite(n) && n > 0 && n < 10000;
    const seenValues = new Set<number>();

    if (
      suggestion !== undefined &&
      suggestion.confidence >= 70 &&
      isValid(suggNum)
    ) {
      values.push({ label: 'Suggested', value: suggNum, emoji: '✨' });
      seenValues.add(suggNum);
    }

    if (isValid(yestNum)) {
      if (!seenValues.has(yestNum)) {
        values.push({ label: 'Yesterday', value: yestNum, emoji: '📅' });
        seenValues.add(yestNum);
      }

      const quarterDown = Math.round(yestNum * 0.75);
      const quarterUp = Math.round(yestNum * 1.25);

      if (
        values.length < 4 &&
        quarterDown > 0 &&
        !seenValues.has(quarterDown)
      ) {
        values.push({ label: '−25%', value: quarterDown });
        seenValues.add(quarterDown);
      }
      if (values.length < 4 && !seenValues.has(quarterUp)) {
        values.push({ label: '+25%', value: quarterUp });
        seenValues.add(quarterUp);
      }
    }

    return values.slice(0, 4);
  }, [suggestion, yesterdayValue]);

  const hasSuggestion =
    suggestion !== undefined &&
    suggestion.confidence >= 60 &&
    suggestion.value !== undefined &&
    suggestion.value !== '';

  // Respect field.step for decimal precision
  const step = Number.isFinite(field.step as any) && Number(field.step) > 0
    ? Number(field.step)
    : 1;
  const decimalPlaces = step < 1 ? String(step).split('.')[1]?.length ?? 0 : 0;

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          trend && trend.direction !== 'same' ? (
            <View style={styles.trendBadge}>
              <Ionicons
                name={TREND_ICONS[trend.direction]}
                size={14}
                color={
                  trend.direction === 'up' ? colors.success : colors.error
                }
              />
              <Text
                style={[
                  styles.trendText,
                  {
                    color:
                      trend.direction === 'up'
                        ? colors.success
                        : colors.error,
                  },
                ]}
              >
                {trend.deltaLabel}
              </Text>
            </View>
          ) : null
        }
      />

      <View
        style={[
          styles.numberRow,
          {
            borderColor: error
              ? colors.error
              : hasSuggestion
              ? tracker.color
              : colors.border,
            borderRadius: borderRadiusValue,
            backgroundColor: error ? `${colors.error}10` : colors.surface,
            opacity: !editable ? 0.7 : 1,
          },
        ]}
      >
        <TextInput
          editable={editable}
          style={[
            styles.numberInput,
            { color: colors.text, fontSize: 16 * fontSizeMultiplier },
          ]}
          keyboardType="numeric"
          placeholder={
            field.placeholder ||
            (hasSuggestion
              ? `${suggestion!.emoji} ${String(suggestion!.value)}`
              : '0')
          }
          placeholderTextColor={
            hasSuggestion ? tracker.color : colors.textSecondary
          }
          value={String(value ?? '')}
          onChangeText={(text) => {
            if (text === '') {
              onChange('');
              return;
            }
            const num = parseFloat(text);
            if (isNaN(num)) {
              onChange(text);
              return;
            }
            if (decimalPlaces > 0) {
              const rounded = parseFloat(num.toFixed(decimalPlaces));
              onChange(rounded);
            } else {
              onChange(Math.round(num));
            }
          }}
        />
        {field.unit && (
          <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>
            {field.unit}
          </Text>
        )}
      </View>

      {quickValues.length > 0 && editable && (
        <View style={styles.quickValuesRow}>
          {quickValues.map((qv, i) => (
            <TouchableOpacity
              key={`${qv.label}-${i}`}
              style={[
                styles.quickValueChip,
                {
                  backgroundColor: `${tracker.color}10`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
              onPress={() => onChange(qv.value)}
            >
              <Text
                style={[styles.quickValueText, { color: tracker.color }]}
              >
                {qv.label}
              </Text>
              <Text
                style={[styles.quickValueNum, { color: tracker.color }]}
              >
                {qv.value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

// ─── Smart Duration Field ──────────────────────────────────────────────────
const SmartDurationField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  suggestion?: ProgressiveSuggestion;
  yesterdayValue?: unknown;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  suggestion,
  yesterdayValue,
  editable = true,
}) => {
  const seconds = Number(value) || 0;

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(seconds);
  const onChangeRef = useRef(onChange);

  secondsRef.current = seconds;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        const next = secondsRef.current + 1;
        secondsRef.current = next;
        onChangeRef.current(next);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const suggestedDuration =
    suggestion?.confidence !== undefined &&
    suggestion.confidence >= 60 &&
    suggestion.value !== undefined
      ? Number(suggestion.value)
      : null;
  const yesterdayDuration =
    yesterdayValue !== undefined && yesterdayValue !== ''
      ? Number(yesterdayValue)
      : null;

  // All trackers whose duration is meaningful for ongoing/completed tracking
  const supportsOngoing = [
    'sleep',
    'feed',
    'dream_feed',
    'nap',
    'pumping',
    'bath',
    'tummy_time',
    'colic',
  ].includes(tracker.id);

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          isTimerRunning ? (
            <View
              style={[
                styles.recordingBadge,
                { backgroundColor: `${tracker.color}20` },
              ]}
            >
              <View
                style={[
                  styles.recordingDot,
                  { backgroundColor: tracker.color },
                ]}
              />
              <Text
                style={[styles.recordingText, { color: tracker.color }]}
              >
                Recording
              </Text>
            </View>
          ) : supportsOngoing && seconds === 0 ? (
            <View
              style={[
                styles.recordingBadge,
                { backgroundColor: `${colors.textSecondary}15` },
              ]}
            >
              <Text
                style={[
                  styles.recordingText,
                  { color: colors.textSecondary },
                ]}
              >
                Optional
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.durationRow}>
        <TouchableOpacity
          disabled={!editable}
          style={[
            styles.durationBtn,
            { backgroundColor: colors.surface, opacity: !editable ? 0.5 : 1 },
          ]}
          onPress={() => onChange(Math.max(0, seconds - 60))}
        >
          <Ionicons name="remove" size={20} color={tracker.color} />
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!editable}
          style={[
            styles.timerToggle,
            {
              backgroundColor: isTimerRunning
                ? `${tracker.color}20`
                : colors.surface,
              borderRadius: borderRadiusValue,
              opacity: !editable ? 0.7 : 1,
            },
          ]}
          onPress={() => setIsTimerRunning(!isTimerRunning)}
        >
          <Ionicons
            name={isTimerRunning ? 'pause' : 'play'}
            size={24}
            color={tracker.color}
          />
          <Text
            style={[
              styles.durationText,
              { color: colors.text, fontSize: 22 * fontSizeMultiplier },
            ]}
          >
            {formatDurationSeconds(seconds)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!editable}
          style={[
            styles.durationBtn,
            { backgroundColor: colors.surface, opacity: !editable ? 0.5 : 1 },
          ]}
          onPress={() => onChange(seconds + 60)}
        >
          <Ionicons name="add" size={20} color={tracker.color} />
        </TouchableOpacity>
      </View>

      <View style={styles.presetRow}>
        {[5, 10, 15, 30, 45, 60].map((mins) => (
          <TouchableOpacity
            key={mins}
            disabled={!editable}
            style={[
              styles.presetChip,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadiusValue / 2,
                opacity: !editable ? 0.5 : 1,
              },
            ]}
            onPress={() => onChange(mins * 60)}
          >
            <Text
              style={[styles.presetText, { color: colors.textSecondary }]}
            >
              {mins}m
            </Text>
          </TouchableOpacity>
        ))}
        {Number.isFinite(suggestedDuration) && suggestedDuration! > 0 && editable && (
          <TouchableOpacity
            style={[
              styles.presetChip,
              {
                backgroundColor: `${tracker.color}15`,
                borderRadius: borderRadiusValue / 2,
              },
            ]}
            onPress={() => onChange(suggestedDuration)}
          >
            <Text style={styles.suggestionChipEmoji}>✨</Text>
            <Text style={[styles.presetText, { color: tracker.color }]}>
              {formatDurationSeconds(suggestedDuration!)}
            </Text>
          </TouchableOpacity>
        )}
        {Number.isFinite(yesterdayDuration) &&
          yesterdayDuration! > 0 &&
          !Number.isFinite(suggestedDuration) &&
          editable && (
            <TouchableOpacity
              style={[
                styles.presetChip,
                {
                  backgroundColor: `${tracker.color}15`,
                  borderRadius: borderRadiusValue / 2,
                },
              ]}
              onPress={() => onChange(yesterdayDuration)}
            >
              <Ionicons name="time-outline" size={12} color={tracker.color} />
              <Text style={[styles.presetText, { color: tracker.color }]}>
                Yesterday ({formatDurationSeconds(yesterdayDuration!)})
              </Text>
            </TouchableOpacity>
          )}
      </View>
    </View>
  );
};

// ─── Smart Mood Field ──────────────────────────────────────────────────────
const SmartMoodField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  suggestion?: ProgressiveSuggestion;
  yesterdayValue?: unknown;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  suggestion,
  yesterdayValue,
  editable = true,
}) => {
  const currentValue = Number(value) || 3;
  const suggestedMood =
    suggestion?.confidence !== undefined && suggestion.confidence >= 60
      ? Number(suggestion.value)
      : null;
  const yesterdayMood = yesterdayValue ? Number(yesterdayValue) : null;

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />
      {yesterdayMood && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            marginBottom: 6,
          }}
        >
          Yesterday: {MOOD_EMOJIS[yesterdayMood - 1]}
        </Text>
      )}
      <View style={styles.moodRow}>
        {MOOD_EMOJIS.map((emoji, index) => {
          const moodValue = index + 1;
          const isSelected = currentValue === moodValue;
          const isSuggested = suggestedMood === moodValue;
          const wasYesterday = yesterdayMood === moodValue;

          return (
            <TouchableOpacity
              key={emoji}
              disabled={!editable}
              style={[
                styles.moodBtn,
                isSelected && {
                  backgroundColor: `${tracker.color}15`,
                  transform: [{ scale: 1.15 }],
                },
                isSuggested &&
                  !isSelected && {
                    borderWidth: 2,
                    borderColor: tracker.color,
                  },
                wasYesterday &&
                  !isSelected &&
                  !isSuggested && {
                    borderWidth: 2,
                    borderColor: `${colors.textSecondary}30`,
                  },
                { borderRadius: borderRadiusValue },
                !editable && { opacity: 0.7 },
              ]}
              onPress={() => onChange(moodValue)}
            >
              <Text
                style={[
                  styles.moodEmoji,
                  isSelected && { fontSize: 40 },
                ]}
              >
                {emoji}
              </Text>
              {isSuggested && !isSelected && (
                <View
                  style={[
                    styles.suggestIndicatorBadge,
                    { backgroundColor: tracker.color },
                  ]}
                >
                  <Text style={styles.suggestIndicatorText}>✨</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── Smart Pain Scale Field (0–10) ─────────────────────────────────────────
const PAIN_EMOJIS = ['😊', '🙂', '😐', '😕', '😣', '😖', '😫', '😭', '😱', '🆘', '🚨'];

const SmartPainScaleField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  editable = true,
}) => {
  const raw = Number(value);
  const currentValue = Number.isFinite(raw)
    ? Math.max(0, Math.min(10, raw))
    : 0;
  const emoji = PAIN_EMOJIS[currentValue] || '😐';

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={`${field.label}: ${currentValue}/10`}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      <View style={styles.painRow}>
        <Text style={styles.painEmoji}>{emoji}</Text>
        <Slider
          disabled={!editable}
          style={styles.slider}
          minimumValue={0}
          maximumValue={10}
          step={1}
          value={currentValue}
          onValueChange={(v) => onChange(Math.round(v))}
          minimumTrackTintColor={tracker.color}
          maximumTrackTintColor={colors.border}
          thumbTintColor={tracker.color}
        />
      </View>

      <View style={styles.painAnchors}>
        <Text style={[styles.painAnchor, { color: colors.textSecondary }]}>
          No pain
        </Text>
        <Text style={[styles.painAnchor, { color: colors.textSecondary }]}>
          Severe
        </Text>
      </View>
    </View>
  );
};

// ─── Smart Temperature Field ───────────────────────────────────────────────
const SmartTemperatureField: React.FC<{
  field: FieldConfig;
  data: Record<string, unknown>;
  updateField: (id: string, value: unknown) => void;
  errors: Record<string, string>;
  fullThemeColors: any;
  tracker: UnifiedTrackerConfig;
  borderRadiusValue: number;
  fontSizeMultiplier: number;
  editable?: boolean;
}> = ({
  field,
  data,
  updateField,
  errors,
  fullThemeColors,
  tracker,
  borderRadiusValue,
  fontSizeMultiplier,
  editable = true,
}) => {
  const unitKey = `${field.id}_unit`;
  const unitOptions = (field as any).unitOptions || [
    { id: 'celsius', label: '°C' },
    { id: 'fahrenheit', label: '°F' },
  ];

  const defaultUnit = useMemo(() => {
    try {
      const locale =
        Intl.NumberFormat().resolvedOptions().locale || 'en-US';
      const region = locale.split('-')[1] || 'US';
      if (
        unitOptions.some((u: any) => u.id === 'fahrenheit') &&
        region === 'US'
      ) {
        return 'fahrenheit';
      }
    } catch {}
    return 'celsius';
  }, [unitOptions]);

  const selectedUnit = (data[unitKey] as string) || defaultUnit;

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={fullThemeColors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      <View
        style={[
          styles.tempRow,
          {
            borderColor: errors[field.id]
              ? fullThemeColors.error || '#ef4444'
              : fullThemeColors.border,
            borderRadius: borderRadiusValue,
            backgroundColor: fullThemeColors.surface,
            opacity: !editable ? 0.7 : 1,
          },
        ]}
      >
        <TextInput
          editable={editable}
          style={[
            styles.tempInput,
            {
              color: fullThemeColors.text,
              fontSize: 16 * fontSizeMultiplier,
            },
          ]}
          keyboardType="decimal-pad"
          placeholder={selectedUnit === 'fahrenheit' ? '98.6' : '36.5'}
          placeholderTextColor={fullThemeColors.textSecondary}
          value={String(data[field.id] ?? '')}
          onChangeText={(text) => {
            const num = parseFloat(text);
            updateField(field.id, isNaN(num) ? text : num);
          }}
        />
        <View
          style={[
            styles.tempUnitToggle,
            {
              backgroundColor: fullThemeColors.border,
              borderRadius: borderRadiusValue / 2,
            },
          ]}
        >
          {unitOptions.map((u: any) => (
            <TouchableOpacity
              key={u.id}
              disabled={!editable}
              style={[
                styles.tempUnitBtn,
                selectedUnit === u.id && {
                  backgroundColor: tracker.color,
                  borderRadius: borderRadiusValue / 3,
                },
              ]}
              onPress={() => updateField(unitKey, u.id)}
            >
              <Text
                style={[
                  styles.tempUnitText,
                  {
                    color:
                      selectedUnit === u.id
                        ? '#fff'
                        : fullThemeColors.textSecondary,
                  },
                ]}
              >
                {u.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {errors[field.id] && (
        <Text
          style={[
            styles.errorText,
            { color: fullThemeColors.error || '#ef4444' },
          ]}
        >
          {errors[field.id]}
        </Text>
      )}
    </View>
  );
};

// ─── Smart Quantity Field ──────────────────────────────────────────────────
const SmartQuantityField: React.FC<{
  field: FieldConfig;
  data: Record<string, unknown>;
  updateField: (id: string, value: unknown) => void;
  errors: Record<string, string>;
  fullThemeColors: any;
  tracker: UnifiedTrackerConfig;
  borderRadiusValue: number;
  fontSizeMultiplier: number;
  editable?: boolean;
}> = ({
  field,
  data,
  updateField,
  errors,
  fullThemeColors,
  tracker,
  borderRadiusValue,
  fontSizeMultiplier,
  editable = true,
}) => {
  const unitKey = `${field.id}_unit`;

  // Solid food gets solid units (g/oz/tbsp/servings/pieces)
  // Anything else gets liquid units (ml/oz)
  const isSolidFood =
    field.id?.toLowerCase().includes('solid') ||
    field.id?.toLowerCase().includes('food') ||
    field.label?.toLowerCase().includes('solid') ||
    field.label?.toLowerCase().includes('eaten');

  const unitOptions =
    (field as any).unitOptions ||
    (isSolidFood ? CANONICAL_SOLID_UNITS : CANONICAL_LIQUID_UNITS);

  // Region-aware default unit
  const defaultUnit = useMemo(() => {
    try {
      const locale =
        Intl.NumberFormat().resolvedOptions().locale || 'en-US';
      const region = locale.split('-')[1] || 'US';
      const isImperialRegion =
        region === 'US' ||
        region === 'GB' ||
        region === 'LR' ||
        region === 'MM';

      if (isSolidFood) {
        if (
          isImperialRegion &&
          unitOptions.some((u: any) => u.id === 'oz')
        ) {
          return 'oz';
        }
        return 'g';
      }

      if (
        isImperialRegion &&
        unitOptions.some((u: any) => u.id === 'oz')
      ) {
        return 'oz';
      }
    } catch {}
    return unitOptions[0].id;
  }, [unitOptions, isSolidFood]);

  const selectedUnit = (data[unitKey] as string) || defaultUnit;

  // Respect field.step for decimal precision
  const step = Number.isFinite(field.step as any) && Number(field.step) > 0
    ? Number(field.step)
    : 1;
  const decimalPlaces = step < 1 ? String(step).split('.')[1]?.length ?? 0 : 0;

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={fullThemeColors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      <View
        style={[
          styles.numberRow,
          {
            borderColor: errors[field.id]
              ? fullThemeColors.error || '#ef4444'
              : fullThemeColors.border,
            borderRadius: borderRadiusValue,
            backgroundColor: errors[field.id]
              ? `${fullThemeColors.error || '#ef4444'}10`
              : fullThemeColors.surface,
            opacity: !editable ? 0.7 : 1,
          },
        ]}
      >
        <TextInput
          editable={editable}
          style={[
            styles.numberInput,
            {
              color: fullThemeColors.text,
              fontSize: 16 * fontSizeMultiplier,
            },
          ]}
          keyboardType="numeric"
          placeholder={field.placeholder || '0'}
          placeholderTextColor={fullThemeColors.textSecondary}
          value={String(data[field.id] ?? '')}
          onChangeText={(text) => {
            if (text === '') {
              updateField(field.id, '');
              return;
            }
            const num = parseFloat(text);
            if (isNaN(num)) {
              updateField(field.id, text);
              return;
            }
            if (decimalPlaces > 0) {
              updateField(field.id, parseFloat(num.toFixed(decimalPlaces)));
            } else {
              updateField(field.id, Math.round(num));
            }
          }}
        />
        <View
          style={[
            styles.tempUnitToggle,
            {
              backgroundColor: fullThemeColors.border,
              borderRadius: borderRadiusValue / 2,
            },
          ]}
        >
          {unitOptions.map((u: any) => (
            <TouchableOpacity
              key={u.id}
              disabled={!editable}
              style={[
                styles.tempUnitBtn,
                selectedUnit === u.id && {
                  backgroundColor: tracker.color,
                  borderRadius: borderRadiusValue / 3,
                },
              ]}
              onPress={() => updateField(unitKey, u.id)}
            >
              <Text
                style={[
                  styles.tempUnitText,
                  {
                    color:
                      selectedUnit === u.id
                        ? '#fff'
                        : fullThemeColors.textSecondary,
                  },
                ]}
              >
                {u.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {errors[field.id] && (
        <Text
          style={[
            styles.errorText,
            { color: fullThemeColors.error || '#ef4444' },
          ]}
        >
          {errors[field.id]}
        </Text>
      )}
    </View>
  );
};

// ─── Smart DateTime Field (with Ongoing support) ───────────────────────────
const SmartDateTimeField: React.FC<{
  field: FieldConfig;
  data: Record<string, unknown>;
  updateField: (id: string, value: unknown) => void;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  isStart: boolean;
  editable?: boolean;
}> = ({
  field,
  data,
  updateField,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  isStart,
  editable = true,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const currentValue = data[field.id];
  const currentDate =
    currentValue && !isNaN(new Date(String(currentValue)).getTime())
      ? new Date(String(currentValue))
      : new Date();
  const hasValue =
    currentValue !== undefined && currentValue !== null && currentValue !== '';
  const otherFieldId = isStart ? 'endTime' : 'startTime';
  const hasOtherValue =
    data[otherFieldId] !== undefined &&
    data[otherFieldId] !== null &&
    data[otherFieldId] !== '';

  const displayText = hasValue
    ? currentDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Set time';

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      <TouchableOpacity
        disabled={!editable}
        style={[
          styles.input,
          {
            borderColor: colors.border,
            borderRadius: borderRadiusValue,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            opacity: !editable ? 0.7 : 1,
          },
        ]}
        onPress={() => setShowPicker(true)}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={colors.textSecondary}
        />
        <Text
          style={{
            color: hasValue ? colors.text : colors.textSecondary,
            flex: 1,
            fontSize: 15,
          }}
        >
          {displayText}
        </Text>
        {hasValue && editable && (
          <TouchableOpacity
            onPress={() => updateField(field.id, undefined)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Ongoing hint: start is set, end is not, and this tracker supports ongoing */}
      {isStart && hasValue && !hasOtherValue && editable && (
        <TouchableOpacity
          style={styles.ongoingHint}
          onPress={() => {
            updateField('endTime', new Date().toISOString());
          }}
        >
          <Ionicons name="time-outline" size={14} color={tracker.color} />
          <Text style={[styles.ongoingHintText, { color: tracker.color }]}>
            Ongoing — tap here to end now
          </Text>
        </TouchableOpacity>
      )}

      {/* Duration display when both start and end are set */}
      {!isStart && hasValue && hasOtherValue && (
        <View style={styles.durationHint}>
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={tracker.color}
          />
          <Text style={[styles.durationHintText, { color: tracker.color }]}>
            Duration:{' '}
            {formatDurationSeconds(
              Math.max(
                0,
                (new Date(String(currentValue)).getTime() -
                  new Date(String(data.startTime)).getTime()) /
                  1000
              )
            )}
          </Text>
        </View>
      )}

      {showPicker && (
        <DateTimePicker
          value={currentDate}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            if (Platform.OS === 'android') setShowPicker(false);
            if (event.type === 'set' && selectedDate) {
              updateField(field.id, selectedDate.toISOString());
            }
          }}
        />
      )}

      {Platform.OS === 'ios' && showPicker && (
        <TouchableOpacity
          style={[styles.pickerDoneBtn, { backgroundColor: tracker.color }]}
          onPress={() => setShowPicker(false)}
        >
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Smart Time Field (HH:mm) ──────────────────────────────────────────────
const SmartTimeField: React.FC<{
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  editable?: boolean;
}> = ({
  field,
  value,
  onChange,
  error,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  editable = true,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  // Parse "HH:mm" into a Date for the picker
  const parsedDate = useMemo(() => {
    const d = new Date();
    if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
      const [hh, mm] = value.split(':').map((x) => parseInt(x, 10));
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        d.setHours(hh, mm, 0, 0);
        return d;
      }
    }
    return d;
  }, [value]);

  const displayText =
    typeof value === 'string' && value.length > 0 ? value : 'Set time';

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && selectedDate) {
      const hh = String(selectedDate.getHours()).padStart(2, '0');
      const mm = String(selectedDate.getMinutes()).padStart(2, '0');
      onChange(`${hh}:${mm}`);
    }
  };

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        hint={field.hint}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      <TouchableOpacity
        disabled={!editable}
        style={[
          styles.input,
          {
            borderColor: error ? colors.error : colors.border,
            borderRadius: borderRadiusValue,
            backgroundColor: error ? `${colors.error}10` : colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            opacity: !editable ? 0.7 : 1,
          },
        ]}
        onPress={() => setShowPicker(true)}
      >
        <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
        <Text
          style={{
            color:
              typeof value === 'string' && value.length > 0
                ? colors.text
                : colors.textSecondary,
            flex: 1,
            fontSize: 15,
          }}
        >
          {displayText}
        </Text>
        {typeof value === 'string' && value.length > 0 && editable && (
          <TouchableOpacity
            onPress={() => onChange('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={parsedDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && showPicker && (
        <TouchableOpacity
          style={[styles.pickerDoneBtn, { backgroundColor: tracker.color }]}
          onPress={() => setShowPicker(false)}
        >
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      )}

      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export const DynamicTrackerForm: React.FC<DynamicTrackerFormProps> = ({
  tracker,
  initialData = {},
  onSubmit,
  onCancel,
  progressiveState,
  linkedEntryId,
  showInsights = true,
  quickMode = false,
}) => {
  const {
    fullThemeColors,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
    triggerHaptic,
  } = useCustomization();
  const { error, info } = useSweetAlert();

  const { currentBaby } = useBaby();

  const currentBabyAgeMonths = useMemo(() => {
    if (!currentBaby?.birthDate) return 0;
    const birth = new Date(currentBaby.birthDate);
    if (isNaN(birth.getTime())) return 0;
    const now = new Date();
    return Math.max(
      0,
      (now.getFullYear() - birth.getFullYear()) * 12 +
        (now.getMonth() - birth.getMonth())
    );
  }, [currentBaby?.birthDate]);

  const {
    prefillData = {},
    suggestions = [],
    streak,
    insights = [],
    correlations = [],
    activeReminders = [],
    trends = {},
    timeContext,
    yesterdayEntries = [],
    todayEntries = [],
  } = progressiveState || {};

  // ─── Medication smart-fill from last entry ──────────────────────────────
  const medicationQuickFill = useMemo(() => {
    if (tracker.id !== 'medication') return null;
    const last = (yesterdayEntries[0] || todayEntries[0]) as any;
    if (!last?.data) return null;
    const { name, dosage, type } = last.data;
    if (!name && !dosage) return null;
    return { name, dosage, type };
  }, [tracker.id, yesterdayEntries, todayEntries]);

  // ─── Initial data ───────────────────────────────────────────────────────
  const [data, setData] = useState<Record<string, unknown>>(() => {
    const defaults = {
      ...(medicationQuickFill || {}),
      ...getTrackerDefaults(tracker.id),
    };
    const merged = { ...defaults, ...prefillData, ...initialData };

    // High-confidence suggestions auto-fill only if nothing is set
    suggestions.forEach((s) => {
      if (
        merged[s.fieldId] === undefined &&
        s.confidence >= 85 &&
        s.value !== undefined &&
        s.value !== null &&
        s.value !== ''
      ) {
        merged[s.fieldId] = s.value;
      }
    });

    return merged;
  });

  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(
    new Set()
  );
  const [dismissedCorrelations, setDismissedCorrelations] = useState<
    Set<string>
  >(new Set());
  const [appliedPrefill, setAppliedPrefill] = useState<Record<
    string,
    unknown
  > | null>(null);

  const userEditedFields = useRef<Set<string>>(new Set());

  // ─── Apply prefill and high-confidence suggestions ──────────────────────
  useEffect(() => {
    setData((prev) => {
      const merged = { ...prefillData, ...initialData };

      suggestions.forEach((s) => {
        if (
          merged[s.fieldId] === undefined &&
          s.confidence >= 85 &&
          s.value !== undefined &&
          s.value !== null &&
          s.value !== ''
        ) {
          merged[s.fieldId] = s.value;
        }
      });

      if (appliedPrefill) {
        Object.entries(appliedPrefill).forEach(([key, value]) => {
          merged[key] = value;
        });
        setAppliedPrefill(null);
      }

      // Restore user edits so live updates don't clobber them
      userEditedFields.current.forEach((key) => {
        if (prev[key] !== undefined) {
          merged[key] = prev[key];
        }
      });

      return merged;
    });
  }, [prefillData, suggestions, initialData, appliedPrefill]);

  // ─── Validation ─────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    tracker.fields.forEach((field) => {
      try {
        if (
          typeof isFieldVisible === 'function' &&
          !isFieldVisible(field)
        ) {
          return;
        }
      } catch {
        // Continue
      }

      const value = data[field.id];

      // Required check
      if (field.required) {
        if (
          value === undefined ||
          value === '' ||
          value === null ||
          (Array.isArray(value) && value.length === 0)
        ) {
          newErrors[field.id] = `${field.label} is required`;
          return;
        }
      }

      // Future-date guard
      if (
        (field.type === 'datetime' ||
          field.type === 'date' ||
          field.type === 'time') &&
        isFutureTimestamp(value)
      ) {
        newErrors[field.id] = `${field.label} can't be in the future`;
        return;
      }

      // Min/max sanity bounds
      if (
        (field.type === 'number' ||
          field.type === 'quantity' ||
          field.type === 'measurement') &&
        typeof value === 'number'
      ) {
        if (Number.isFinite(field.min as any) && value < Number(field.min)) {
          newErrors[field.id] = `${field.label} must be at least ${field.min}`;
        } else if (
          Number.isFinite(field.max as any) &&
          value > Number(field.max)
        ) {
          newErrors[field.id] = `${field.label} must be at most ${field.max}`;
        }
      }

      // Growth-specific sanity bounds
      if (
        tracker.id === 'growth' &&
        field.id === 'value' &&
        typeof value === 'number'
      ) {
        const mType = String(data.measurementType || '');
        const mUnit = String(data.value_unit || data.unit || 'kg');
        const growthErr = validateGrowthValue(
          mType,
          value,
          currentBabyAgeMonths,
          mUnit
        );
        if (growthErr) {
          newErrors[field.id] = growthErr;
        }
      }

      // Temperature sanity
      if (
        tracker.id === 'temperature' &&
        field.id === 'value' &&
        typeof value === 'number'
      ) {
        const unit = String(data.unit || 'celsius');
        const celsius =
          unit === 'fahrenheit' ? ((value - 32) * 5) / 9 : value;
        if (celsius < 34 || celsius > 43) {
          newErrors[field.id] = `Temperature looks unusual (${value}°${
            unit === 'fahrenheit' ? 'F' : 'C'
          }). Double-check before saving.`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [tracker.fields, data, currentBabyAgeMonths, tracker.id]);

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    if (!validate()) {
      triggerHaptic('error');
      error('Validation Error', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('success');

    try {
      // Trim strings, drop empty values, clean arrays
      const finalData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed.length > 0) finalData[k] = trimmed;
        } else if (Array.isArray(v)) {
          const cleaned = v
            .map((item) => (typeof item === 'string' ? item.trim() : item))
            .filter(
              (item) => item !== '' && item !== null && item !== undefined
            );
          if (cleaned.length > 0) finalData[k] = cleaned;
        } else if (v !== undefined && v !== null) {
          finalData[k] = v;
        }
      }

      // ─── Auto-compute duration for duration-trackers ─────────────────
      const DURATION_TRACKERS = [
        'sleep',
        'feed',
        'dream_feed',
        'nap',
        'bath',
        'pumping',
        'tummy_time',
        'colic',
        'daycare',
        'babysitter',
        'screen_time',
      ];
      if (DURATION_TRACKERS.includes(tracker.id)) {
        const hasStart =
          finalData.startTime && String(finalData.startTime).length > 0;
        const hasEnd =
          finalData.endTime && String(finalData.endTime).length > 0;

        if (hasStart && hasEnd) {
          const startMs = new Date(String(finalData.startTime)).getTime();
          const endMs = new Date(String(finalData.endTime)).getTime();
          if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
            const secs = Math.round((endMs - startMs) / 1000);
            if (secs >= 60 && secs <= 86400) {
              finalData.duration = secs;
              finalData.status = 'completed';
            } else {
              delete finalData.duration;
              finalData.status = 'completed';
            }
          } else {
            delete finalData.duration;
            finalData.status = 'completed';
          }
        } else if (hasStart) {
          // Ongoing — no endTime, no duration
          delete finalData.duration;
          finalData.status = 'ongoing';
        } else if (hasEnd) {
          // End only
          delete finalData.duration;
          finalData.status = 'completed';
        }
      }

      const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';
      const cleanTags = selectedTags
        .map((t) => (typeof t === 'string' ? t.trim() : t))
        .filter((t): t is string => typeof t === 'string' && t.length > 0);

      await Promise.resolve(
        onSubmit(finalData, {
          notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
          tags: cleanTags.length > 0 ? cleanTags : undefined,
          photoUris: photoUris.length > 0 ? photoUris : undefined,
          linkedEntryId,
        })
      );
    } catch {
      error('Error', 'Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validate,
    data,
    notes,
    selectedTags,
    photoUris,
    onSubmit,
    triggerHaptic,
    error,
    linkedEntryId,
    isSubmitting,
    tracker.id,
  ]);

  // ─── Field update with cross-field auto-linking ─────────────────────────
  const updateField = useCallback(
    (fieldId: string, value: unknown) => {
      userEditedFields.current.add(fieldId);
      setData((prev) => {
        const next = { ...prev, [fieldId]: value };

        // ── Feed: reset sibling fields when feedType changes ────────────
        if (tracker.id === 'feed' && fieldId === 'feedType') {
          if (value === 'breast') {
            delete next.bottleAmount;
            delete next.bottleAmount_unit;
            delete next.bottleContent;
            delete next.bottleTemp;
            delete next.solidAmount;
            delete next.solidAmount_unit;
            delete next.food;
            delete next.texture;
            delete next.acceptance;
            delete next.waterAmount;
            delete next.vessel;
          } else if (value === 'bottle') {
            delete next.side;
            delete next.breastDuration;
            delete next.letdown;
            delete next.solidAmount;
            delete next.solidAmount_unit;
            delete next.food;
            delete next.texture;
            delete next.acceptance;
            delete next.waterAmount;
            delete next.vessel;
          } else if (value === 'solid') {
            delete next.side;
            delete next.breastDuration;
            delete next.letdown;
            delete next.bottleAmount;
            delete next.bottleAmount_unit;
            delete next.bottleContent;
            delete next.bottleTemp;
            delete next.waterAmount;
            delete next.vessel;
          } else if (value === 'water') {
            delete next.side;
            delete next.breastDuration;
            delete next.letdown;
            delete next.bottleAmount;
            delete next.bottleAmount_unit;
            delete next.bottleContent;
            delete next.bottleTemp;
            delete next.solidAmount;
            delete next.solidAmount_unit;
            delete next.food;
            delete next.texture;
            delete next.acceptance;
          }
        }

        // ── Sleep: reset endTime/duration when status → ongoing ─────────
        if (
          tracker.id === 'sleep' &&
          fieldId === 'status' &&
          value === 'ongoing'
        ) {
          delete next.endTime;
          delete next.duration;
        }

        // ── Diaper: reset stool fields when type → wet/dry ──────────────
        if (tracker.id === 'diaper' && fieldId === 'type') {
          if (value === 'wet' || value === 'dry') {
            delete next.color;
            delete next.consistency;
            delete next.amount;
            delete next.rash;
            delete next.blowout;
            delete next.bleeding;
          }
        }

        // ── Potty: accident → mark unsuccessful automatically ───────────
        if (tracker.id === 'potty' && fieldId === 'type') {
          if (value === 'accident') {
            next.successful = false;
          }
        }

        // ── Growth: reset value + unit when measurementType changes ─────
        if (tracker.id === 'growth' && fieldId === 'measurementType') {
          delete next.value;
          delete next.value_unit;
          delete next.percentile;
        }

        // ── Auto-link start/end times for duration trackers ─────────────
        const durationTrackers = [
          'sleep',
          'feed',
          'dream_feed',
          'nap',
          'bath',
          'pumping',
          'tummy_time',
        ];
        if (durationTrackers.includes(tracker.id)) {
          const hasStart =
            next.startTime && String(next.startTime).length > 0;
          const hasEnd = next.endTime && String(next.endTime).length > 0;

          if (fieldId === 'startTime' || fieldId === 'endTime') {
            if (hasStart && hasEnd) {
              next.status = 'completed';
              const startMs = new Date(String(next.startTime)).getTime();
              const endMs = new Date(String(next.endTime)).getTime();
              if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
                const secs = Math.round((endMs - startMs) / 1000);
                if (secs >= 60 && secs <= 86400) {
                  next.duration = secs;
                } else {
                  delete next.duration;
                }
              } else {
                delete next.duration;
              }
            } else if (hasStart && !hasEnd) {
              next.status = 'ongoing';
              delete next.duration;
            } else if (!hasStart && hasEnd) {
              next.status = 'completed';
              delete next.duration;
            } else {
              delete next.status;
              delete next.duration;
            }
          }
        }

        // ── Auto-calculate BMI for growth ───────────────────────────────
        if (tracker.id === 'growth') {
          const weight = Number(
            next.weight ?? next.weight_kg ?? prev.weight
          );
          const height = Number(
            next.height ?? next.height_cm ?? prev.height
          );
          if (
            Number.isFinite(weight) &&
            Number.isFinite(height) &&
            height > 0
          ) {
            const heightM = height > 3 ? height / 100 : height;
            next.bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));
          }
        }

        return next;
      });

      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    },
    [tracker.id]
  );

  // ─── Apply yesterday data ───────────────────────────────────────────────
  const applyYesterdayData = useCallback(
    (yestData: Record<string, unknown>) => {
      triggerHaptic('light');
      Object.keys(yestData).forEach((key) =>
        userEditedFields.current.add(key)
      );
      setData((prev) => ({ ...prev, ...yestData }));
      info('Applied', "Yesterday's values filled in!");
    },
    [triggerHaptic, info]
  );

  // ─── Suggestion getters ─────────────────────────────────────────────────
  const getFieldSuggestion = useCallback(
    (fieldId: string): ProgressiveSuggestion | undefined => {
      return suggestions.find(
        (s) =>
          s.fieldId === fieldId &&
          s.confidence >= 60 &&
          s.value !== undefined &&
          s.value !== null &&
          s.value !== ''
      );
    },
    [suggestions]
  );

  const getYesterdayValue = useCallback(
    (fieldId: string): unknown => prefillData[fieldId],
    [prefillData]
  );

  const getFieldTrend = useCallback(
    (fieldId: string): ProgressiveTrend | undefined => trends[fieldId],
    [trends]
  );

  // ─── Field renderer ─────────────────────────────────────────────────────
  const renderField = useCallback(
    (field: FieldConfig) => {
      try {
        if (
          typeof isFieldVisible === 'function' &&
          !isFieldVisible(field)
        ) {
          return null;
        }
      } catch {
        // Render anyway
      }

      const suggestion = getFieldSuggestion(field.id);
      const yesterdayValue = getYesterdayValue(field.id);
      const trend = getFieldTrend(field.id);

      const animatedWrapper = (
        children: React.ReactNode,
        key?: string
      ) => (
        <Animated.View
          key={key}
          entering={shouldReduceMotion ? undefined : FadeInUp.delay(50)}
        >
          {children}
        </Animated.View>
      );

      const commonProps = {
        field,
        value: data[field.id],
        onChange: (v: unknown) => updateField(field.id, v),
        error: errors[field.id],
        tracker,
        colors: fullThemeColors,
        fontSizeMultiplier,
        borderRadiusValue,
        suggestion,
        yesterdayValue,
        trend,
        editable: !isSubmitting,
      };

      switch (field.type) {
        case 'datetime':
        case 'date': {
          const DURATION_TRACKERS = [
            'sleep',
            'feed',
            'dream_feed',
            'nap',
            'bath',
            'pumping',
            'tummy_time',
          ];
          if (
            DURATION_TRACKERS.includes(tracker.id) &&
            (field.id === 'startTime' || field.id === 'endTime')
          ) {
            return animatedWrapper(
              <SmartDateTimeField
                field={field}
                data={data}
                updateField={updateField}
                tracker={tracker}
                colors={fullThemeColors}
                fontSizeMultiplier={fontSizeMultiplier}
                borderRadiusValue={borderRadiusValue}
                isStart={field.id === 'startTime'}
                editable={!isSubmitting}
              />,
              field.id
            );
          }
          return animatedWrapper(
            <SmartTextField {...commonProps} />,
            field.id
          );
        }
        case 'time':
          return animatedWrapper(
            <SmartTimeField
              field={field}
              value={data[field.id]}
              onChange={(v) => updateField(field.id, v)}
              error={errors[field.id]}
              tracker={tracker}
              colors={fullThemeColors}
              fontSizeMultiplier={fontSizeMultiplier}
              borderRadiusValue={borderRadiusValue}
              editable={!isSubmitting}
            />,
            field.id
          );
        case 'number':
          return animatedWrapper(
            <SmartNumberField {...commonProps} />,
            field.id
          );
        case 'select':
          return animatedWrapper(
            <SmartSelectField {...commonProps} />,
            field.id
          );
        case 'multiselect':
          return animatedWrapper(
            <SmartMultiSelectField {...commonProps} />,
            field.id
          );
        case 'toggle':
          return animatedWrapper(
            <View
              key={field.id}
              style={[
                styles.toggleContainer,
                { borderBottomColor: fullThemeColors.border },
              ]}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  {
                    color: fullThemeColors.text,
                    fontSize: 15 * fontSizeMultiplier,
                  },
                ]}
              >
                {field.label}
              </Text>
              <Switch
                disabled={isSubmitting}
                value={Boolean(data[field.id])}
                onValueChange={(value) => updateField(field.id, value)}
                trackColor={{
                  false: fullThemeColors.border,
                  true: `${tracker.color}80`,
                }}
                thumbColor={
                  data[field.id]
                    ? tracker.color
                    : fullThemeColors.textSecondary
                }
              />
            </View>,
            field.id
          );
        case 'duration':
          return animatedWrapper(
            <SmartDurationField {...commonProps} />,
            field.id
          );
        case 'rating': {
          const max = field.max || 5;
          const ratingValue = Number(data[field.id]) || 0;
          return animatedWrapper(
            <View key={field.id} style={styles.fieldContainer}>
              <FieldLabel
                label={field.label}
                required={field.required}
                hint={field.hint}
                colors={fullThemeColors}
                fontSizeMultiplier={fontSizeMultiplier}
              />
              <View style={styles.ratingRow}>
                {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
                  <TouchableOpacity
                    key={star}
                    disabled={isSubmitting}
                    onPress={() => updateField(field.id, star)}
                  >
                    <Ionicons
                      name={star <= ratingValue ? 'star' : 'star-outline'}
                      size={32}
                      color={
                        star <= ratingValue
                          ? fullThemeColors.warning
                          : fullThemeColors.border
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>,
            field.id
          );
        }
        case 'textarea':
          return animatedWrapper(
            <View key={field.id} style={styles.fieldContainer}>
              <FieldLabel
                label={field.label}
                required={field.required}
                hint={field.hint}
                colors={fullThemeColors}
                fontSizeMultiplier={fontSizeMultiplier}
              />
              <TextInput
                editable={!isSubmitting}
                style={[
                  styles.input,
                  styles.textarea,
                  {
                    borderColor: errors[field.id]
                      ? fullThemeColors.error || '#ef4444'
                      : fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                    backgroundColor: fullThemeColors.surface,
                    color: fullThemeColors.text,
                    fontSize: 16 * fontSizeMultiplier,
                    minHeight: 100 * fontSizeMultiplier,
                    opacity: isSubmitting ? 0.7 : 1,
                  },
                ]}
                multiline
                numberOfLines={4}
                placeholder={field.placeholder}
                placeholderTextColor={fullThemeColors.textSecondary}
                value={String(data[field.id] || '')}
                onChangeText={(text) => updateField(field.id, text)}
                textAlignVertical="top"
              />
              {errors[field.id] && (
                <Text
                  style={[
                    styles.errorText,
                    { color: fullThemeColors.error || '#ef4444' },
                  ]}
                >
                  {errors[field.id]}
                </Text>
              )}
            </View>,
            field.id
          );
        case 'mood_emoji':
          return animatedWrapper(
            <SmartMoodField {...commonProps} />,
            field.id
          );
        case 'slider': {
          const sliderMin = Number.isFinite(field.min as any)
            ? Number(field.min)
            : 0;
          const sliderMax = Number.isFinite(field.max as any)
            ? Number(field.max)
            : 100;
          const sliderStep =
            Number.isFinite(field.step as any) && Number(field.step) > 0
              ? Number(field.step)
              : 1;
          const rawValue = Number(data[field.id]);
          const sliderValue = Number.isFinite(rawValue)
            ? Math.max(sliderMin, Math.min(sliderMax, rawValue))
            : sliderMin;

          const displayValue =
            sliderStep < 1
              ? sliderValue.toFixed(1)
              : String(Math.round(sliderValue));

          return animatedWrapper(
            <View key={field.id} style={styles.fieldContainer}>
              <FieldLabel
                label={`${field.label}: ${displayValue}${
                  field.unit ? ` ${field.unit}` : ''
                }`}
                required={field.required}
                hint={field.hint}
                colors={fullThemeColors}
                fontSizeMultiplier={fontSizeMultiplier}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    color: fullThemeColors.textSecondary,
                    fontSize: 11,
                  }}
                >
                  {sliderMin}
                  {field.unit ? ` ${field.unit}` : ''}
                </Text>
                <Text
                  style={{
                    color: fullThemeColors.textSecondary,
                    fontSize: 11,
                  }}
                >
                  {sliderMax}
                  {field.unit ? ` ${field.unit}` : ''}
                </Text>
              </View>
              <Slider
                disabled={isSubmitting}
                style={styles.slider}
                minimumValue={sliderMin}
                maximumValue={sliderMax}
                step={sliderStep}
                value={sliderValue}
                onValueChange={(value) => updateField(field.id, value)}
                minimumTrackTintColor={tracker.color}
                maximumTrackTintColor={fullThemeColors.border}
                thumbTintColor={tracker.color}
              />
            </View>,
            field.id
          );
        }
        case 'pain_scale':
          return animatedWrapper(
            <SmartPainScaleField
              field={field}
              value={data[field.id]}
              onChange={(v) => updateField(field.id, v)}
              tracker={tracker}
              colors={fullThemeColors}
              fontSizeMultiplier={fontSizeMultiplier}
              borderRadiusValue={borderRadiusValue}
              editable={!isSubmitting}
            />,
            field.id
          );
        case 'photo':
          return animatedWrapper(
            <SmartPhotoField
              key={field.id}
              label={field.label}
              trackerContext={tracker.id}
              value={photoUris[0]}
              onUrisChange={(uris) => setPhotoUris(uris)}
              maxPhotos={field.max || 4}
              initialPhotoUris={photoUris}
            />,
            field.id
          );
        case 'video':
          // Video capture isn't implemented — show a friendly placeholder
          // instead of silently falling through to a text input.
          return animatedWrapper(
            <View key={field.id} style={styles.fieldContainer}>
              <FieldLabel
                label={field.label}
                required={field.required}
                hint={field.hint}
                colors={fullThemeColors}
                fontSizeMultiplier={fontSizeMultiplier}
              />
              <View
                style={[
                  styles.input,
                  {
                    borderColor: fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                    backgroundColor: fullThemeColors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: 0.6,
                  },
                ]}
              >
                <Ionicons
                  name="videocam-outline"
                  size={18}
                  color={fullThemeColors.textSecondary}
                />
                <Text
                  style={{
                    color: fullThemeColors.textSecondary,
                    fontSize: 14,
                  }}
                >
                  Video capture coming soon
                </Text>
              </View>
            </View>,
            field.id
          );
        case 'temperature':
          return animatedWrapper(
            <SmartTemperatureField
              field={field}
              data={data}
              updateField={updateField}
              errors={errors}
              fullThemeColors={fullThemeColors}
              tracker={tracker}
              borderRadiusValue={borderRadiusValue}
              fontSizeMultiplier={fontSizeMultiplier}
              editable={!isSubmitting}
            />,
            field.id
          );
        case 'quantity':
        case 'measurement':
          return animatedWrapper(
            <SmartQuantityField
              field={field}
              data={data}
              updateField={updateField}
              errors={errors}
              fullThemeColors={fullThemeColors}
              tracker={tracker}
              borderRadiusValue={borderRadiusValue}
              fontSizeMultiplier={fontSizeMultiplier}
              editable={!isSubmitting}
            />,
            field.id
          );
        default:
          return animatedWrapper(
            <SmartTextField {...commonProps} />,
            field.id
          );
      }
    },
    [
      data,
      errors,
      tracker,
      fullThemeColors,
      borderRadiusValue,
      fontSizeMultiplier,
      shouldReduceMotion,
      getFieldSuggestion,
      getYesterdayValue,
      getFieldTrend,
      timeContext,
      updateField,
      photoUris,
      isSubmitting,
    ]
  );

  // ─── Quick mode ─────────────────────────────────────────────────────────
  if (quickMode) {
    return (
      <View
        style={[
          styles.quickContainer,
          { backgroundColor: fullThemeColors.background },
        ]}
      >
        <View
          style={[
            styles.quickHeader,
            { backgroundColor: tracker.gradient[0] + '15' },
          ]}
        >
          <Text style={{ fontSize: 32 }}>{tracker.emoji}</Text>
          <Text
            style={[
              styles.quickTitle,
              {
                color: fullThemeColors.text,
                fontSize: 18 * fontSizeMultiplier,
              },
            ]}
          >
            {tracker.name}
          </Text>
          {streak && <StreakBadge streak={streak} color={tracker.color} />}
          <TimeContextBadge
            timeContext={timeContext}
            color={tracker.color}
            colors={fullThemeColors}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tracker.fields.slice(0, 3).map(renderField)}

          <TouchableOpacity
            style={[
              styles.quickSubmit,
              {
                backgroundColor: tracker.gradient[0],
                borderRadius: borderRadiusValue,
              },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.quickSubmitText}>
              {isSubmitting ? 'Saving...' : `Save ${tracker.emoji}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Full mode ──────────────────────────────────────────────────────────
  const visibleInsights = insights.filter(
    (i) => !dismissedInsights.has(i.id)
  );
  const visibleCorrelations = correlations.filter(
    (c) => !dismissedCorrelations.has(c.id)
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[
          styles.container,
          { backgroundColor: fullThemeColors.background },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: tracker.gradient[0] + '15',
              borderBottomLeftRadius: borderRadiusValue * 1.5,
              borderBottomRightRadius: borderRadiusValue * 1.5,
            },
          ]}
        >
          <Text
            style={[
              styles.headerEmoji,
              { fontSize: 48 * fontSizeMultiplier },
            ]}
          >
            {tracker.emoji}
          </Text>
          <Text
            style={[
              styles.headerTitle,
              {
                color: fullThemeColors.text,
                fontSize: 22 * fontSizeMultiplier,
              },
            ]}
          >
            {tracker.name}
          </Text>
          <Text
            style={[
              styles.headerDesc,
              {
                color: fullThemeColors.textSecondary,
                fontSize: 14 * fontSizeMultiplier,
              },
            ]}
          >
            {tracker.description}
          </Text>

          {streak && <StreakBadge streak={streak} color={tracker.color} />}
          <TimeContextBadge
            timeContext={timeContext}
            color={tracker.color}
            colors={fullThemeColors}
          />

          {linkedEntryId && (
            <View
              style={[
                styles.linkedBadge,
                { backgroundColor: `${tracker.color}20` },
              ]}
            >
              <Ionicons
                name="link-outline"
                size={14}
                color={tracker.color}
              />
              <Text style={[styles.linkedText, { color: tracker.color }]}>
                Linked to previous entry
              </Text>
            </View>
          )}
        </View>

        {/* Correlations */}
        {visibleCorrelations.length > 0 && (
          <View style={styles.correlationsSection}>
            {visibleCorrelations.slice(0, 2).map((correlation) => (
              <Animated.View
                key={correlation.id}
                entering={FadeInUp.springify()}
                style={[
                  styles.correlationBanner,
                  {
                    backgroundColor: `${tracker.color}08`,
                    borderRadius: borderRadiusValue,
                    borderLeftWidth: 3,
                    borderLeftColor: tracker.color,
                  },
                ]}
              >
                <Text style={styles.correlationEmoji}>
                  {correlation.emoji || '🔗'}
                </Text>
                <View style={styles.correlationInfo}>
                  <Text
                    style={[
                      styles.correlationMessage,
                      { color: fullThemeColors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {correlation.message}
                  </Text>
                  <Text
                    style={[
                      styles.correlationMeta,
                      { color: fullThemeColors.textSecondary },
                    ]}
                  >
                    {correlation.trackerEmoji} {correlation.trackerName} •{' '}
                    {correlation.confidence}% match
                  </Text>
                </View>
                <View style={styles.correlationActions}>
                  {correlation.action !== 'none' && (
                    <TouchableOpacity
                      style={[
                        styles.correlationActionBtn,
                        { backgroundColor: tracker.color },
                      ]}
                      onPress={() => {
                        if (correlation.prefillData) {
                          Object.keys(correlation.prefillData).forEach(
                            (key) => userEditedFields.current.add(key)
                          );
                          setData((prev) => ({
                            ...prev,
                            ...correlation.prefillData,
                          }));
                        }
                      }}
                    >
                      <Text style={styles.correlationActionText}>
                        {correlation.action === 'log_now'
                          ? 'Log'
                          : correlation.action === 'prefill'
                          ? 'Apply'
                          : 'View'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() =>
                      setDismissedCorrelations((prev) =>
                        new Set(prev).add(correlation.id)
                      )
                    }
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color={fullThemeColors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Smart Insights */}
        {showInsights && visibleInsights.length > 0 && (
          <View style={styles.insightsSection}>
            {visibleInsights.slice(0, 2).map((insight) => (
              <Animated.View
                key={insight.id}
                entering={FadeInUp.springify()}
                style={[
                  styles.insightCard,
                  {
                    backgroundColor:
                      insight.priority === 'good'
                        ? `${fullThemeColors.success}10`
                        : insight.priority === 'warning'
                        ? `${fullThemeColors.warning}10`
                        : `${fullThemeColors.info}10`,
                    borderRadius: borderRadiusValue,
                  },
                ]}
              >
                <Text style={styles.insightEmoji}>{insight.emoji}</Text>
                <View style={styles.insightContent}>
                  <Text
                    style={[
                      styles.insightTitle,
                      { color: fullThemeColors.text },
                    ]}
                  >
                    {insight.title}
                  </Text>
                  <Text
                    style={[
                      styles.insightDesc,
                      { color: fullThemeColors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {insight.description}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setDismissedInsights((prev) =>
                      new Set(prev).add(insight.id)
                    )
                  }
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={fullThemeColors.textSecondary}
                  />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Yesterday's data */}
        {prefillData && Object.keys(prefillData).length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={[
              styles.yesterdayCard,
              {
                backgroundColor: fullThemeColors.surface,
                borderColor: fullThemeColors.border,
                borderRadius: borderRadiusValue,
                margin: 16,
                marginTop: 0,
                padding: 14,
              },
            ]}
          >
            <View style={styles.yesterdayHeader}>
              <Ionicons
                name="time-outline"
                size={16}
                color={fullThemeColors.textSecondary}
              />
              <Text
                style={[
                  styles.yesterdayTitle,
                  { color: fullThemeColors.textSecondary },
                ]}
              >
                Suggested from Yesterday
              </Text>
              <TouchableOpacity
                onPress={() => applyYesterdayData(prefillData)}
              >
                <Text
                  style={[styles.yesterdayApply, { color: tracker.color }]}
                >
                  Apply All
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.yesterdayData}>
              {Object.entries(prefillData)
                .slice(0, 4)
                .map(([key, value]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.yesterdayChip,
                      {
                        backgroundColor: `${tracker.color}10`,
                        borderRadius: borderRadiusValue / 2,
                      },
                    ]}
                    onPress={() => {
                      userEditedFields.current.add(key);
                      setData((prev) => ({ ...prev, [key]: value }));
                    }}
                  >
                    <Text
                      style={[
                        styles.yesterdayChipText,
                        { color: tracker.color },
                      ]}
                    >
                      {key}:{' '}
                      {String(value).length > 15
                        ? String(value).slice(0, 15) + '...'
                        : String(value)}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </Animated.View>
        )}

        {/* Dynamic fields */}
        <View style={styles.formBody}>
          {tracker.fields.map(renderField)}
        </View>

        {/* Notes */}
        <View style={styles.fieldContainer}>
          <Text
            style={[
              styles.label,
              {
                color: fullThemeColors.text,
                fontSize: 15 * fontSizeMultiplier,
              },
            ]}
          >
            Additional Notes
          </Text>
          <TextInput
            editable={!isSubmitting}
            style={[
              styles.input,
              styles.textarea,
              {
                borderColor: fullThemeColors.border,
                borderRadius: borderRadiusValue,
                backgroundColor: fullThemeColors.surface,
                color: fullThemeColors.text,
                fontSize: 16 * fontSizeMultiplier,
                minHeight: 100 * fontSizeMultiplier,
                opacity: isSubmitting ? 0.7 : 1,
              },
            ]}
            multiline
            numberOfLines={3}
            placeholder="Anything else to note..."
            placeholderTextColor={fullThemeColors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </View>

        {/* Quick tags */}
        {tracker.quickTags?.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text
              style={[
                styles.label,
                {
                  color: fullThemeColors.text,
                  fontSize: 15 * fontSizeMultiplier,
                },
              ]}
            >
              Quick Tags
            </Text>
            <View style={styles.tagsWrap}>
              {tracker.quickTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  disabled={isSubmitting}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selectedTags.includes(tag)
                        ? tracker.color
                        : fullThemeColors.surface,
                      borderColor: selectedTags.includes(tag)
                        ? tracker.color
                        : fullThemeColors.border,
                      borderRadius: borderRadiusValue,
                      opacity: isSubmitting ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    setSelectedTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.tagText,
                      {
                        color: selectedTags.includes(tag)
                          ? '#fff'
                          : fullThemeColors.textSecondary,
                        fontSize: 13 * fontSizeMultiplier,
                      },
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Submit */}
        <View style={styles.buttonRow}>
          {onCancel && (
            <TouchableOpacity
              disabled={isSubmitting}
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: fullThemeColors.surface,
                  borderRadius: borderRadiusValue,
                },
              ]}
              onPress={onCancel}
            >
              <Text
                style={[
                  styles.cancelText,
                  {
                    color: fullThemeColors.textSecondary,
                    fontSize: 16 * fontSizeMultiplier,
                  },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: tracker.gradient[0],
                borderRadius: borderRadiusValue,
                opacity: isSubmitting ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.submitText,
                { fontSize: 16 * fontSizeMultiplier },
              ]}
            >
              {isSubmitting ? 'Saving...' : `Save ${tracker.emoji}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── STYLES ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  headerEmoji: { marginBottom: 8 },
  headerTitle: { fontWeight: '700' },
  headerDesc: { textAlign: 'center', marginTop: 4 },

  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  streakText: { fontSize: 13, fontWeight: '600' },

  timeContextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  timeContextText: { fontSize: 12, fontWeight: '500' },

  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  linkedText: { fontSize: 12, fontWeight: '500' },

  correlationsSection: { padding: 16, paddingBottom: 0, gap: 10 },
  correlationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  correlationEmoji: { fontSize: 24 },
  correlationInfo: { flex: 1 },
  correlationMessage: { fontSize: 14, fontWeight: '500' },
  correlationMeta: { fontSize: 12, marginTop: 2 },
  correlationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  correlationActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  correlationActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  insightsSection: { padding: 16, paddingBottom: 0, gap: 10 },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  insightEmoji: { fontSize: 24 },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontSize: 15, fontWeight: '700' },
  insightDesc: { fontSize: 13, lineHeight: 18 },

  yesterdayCard: {
    margin: 16,
    marginTop: 0,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  yesterdayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yesterdayTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  yesterdayApply: { fontSize: 13, fontWeight: '700' },
  yesterdayData: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yesterdayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  yesterdayChipText: { fontSize: 12, fontWeight: '500' },

  formBody: { padding: 16 },
  fieldContainer: { marginBottom: 20 },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelTextWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  label: { fontWeight: '600' },
  labelHint: { fontWeight: '400' },
  required: { fontWeight: '700' },

  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countText: { fontSize: 11, fontWeight: '700' },

  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trendText: { fontSize: 11, fontWeight: '600' },

  input: {
    borderWidth: 1,
    padding: 14,
    fontWeight: '400',
  },
  textarea: { textAlignVertical: 'top' },
  unit: { position: 'absolute', right: 16, top: 46 },
  errorText: { fontSize: 12, marginTop: 4 },

  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  suggestionChipEmoji: { fontSize: 14 },
  suggestionChipText: { fontSize: 12, fontWeight: '500' },
  suggestIndicator: { fontSize: 12 },
  suggestIndicatorBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestIndicatorText: { fontSize: 10 },

  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingRight: 16,
  },
  numberInput: { flex: 1, padding: 14, fontWeight: '500' },
  unitLabel: { marginLeft: 12, fontWeight: '500' },
  quickValuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickValueChip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
  },
  quickValueText: { fontSize: 11, fontWeight: '600' },
  quickValueNum: { fontSize: 13, fontWeight: '700', marginTop: 2 },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  optionEmoji: { fontSize: 18 },
  optionLabel: { fontSize: 14 },

  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toggleLabel: { fontWeight: '600' },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  durationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  durationText: { fontWeight: '700', minWidth: 100, textAlign: 'center' },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetText: { fontSize: 13 },

  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4 },
  recordingText: { fontSize: 11, fontWeight: '700' },

  ongoingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  ongoingHintText: { fontSize: 12, fontWeight: '600' },
  durationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  durationHintText: { fontSize: 12, fontWeight: '600' },
  pickerDoneBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  pickerDoneText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 4 },

  moodRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  moodBtn: {
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  moodEmoji: { fontSize: 32 },

  painRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  painEmoji: { fontSize: 32 },
  painAnchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  painAnchor: { fontSize: 11, fontWeight: '500' },

  slider: { width: '100%', height: 40, marginTop: 8 },

  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  tempInput: { flex: 1, paddingVertical: 14, fontWeight: '500' },
  tempUnitToggle: { flexDirection: 'row', overflow: 'hidden' },
  tempUnitBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  tempUnitText: { fontSize: 14, fontWeight: '600' },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  tagText: { fontWeight: '500' },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center' },
  cancelText: { fontWeight: '600' },
  submitBtn: {
    flex: 2,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { fontWeight: '700', color: '#fff' },

  quickContainer: { flex: 1 },
  quickHeader: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  quickTitle: { fontWeight: '700' },
  quickSubmit: {
    margin: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  quickSubmitText: { fontWeight: '700', color: '#fff', fontSize: 16 },
});

export default DynamicTrackerForm;