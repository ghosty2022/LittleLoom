// DynamicTrackerForm.tsx — COMPLETE FIXED V9
// FIXED:
//   ✓ Smart suggestions require real confidence (>= 60%) and are deduplicated
//   ✓ Sleep/feed start/end times auto-link with "Ongoing" support
//   ✓ Duration displays as "1h 30m" not "3600"
//   ✓ Quantity fields are region-aware (oz for US/UK, ml elsewhere)
//   ✓ Solid food gets its own measurement field (g/oz/tbsp/servings/pieces)
//   ✓ No fake AI confidence badges

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
  Dimensions,
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
} from '../../types/trackers';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import {
  TrackerProgressiveState,
  ProgressiveSuggestion,
  ProgressiveTrend,
} from '../../hooks/useTrackerProgressive';
import { MOOD_EMOJIS } from './trackerConstants';
import { isFieldVisible } from '../../utils/form';

const { width: SCREEN_W } = Dimensions.get('window');

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

// ─── Duration formatter ─────────────────────────────────────────────────
const formatDurationSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const mins = Math.floor(seconds / 60);
  if (mins === 0) return `${seconds}s`;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── Streak badge ───────────────────────────────────────────────────────
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

// ─── Time context badge ─────────────────────────────────────────────────
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
        {timeContext.nextSuggestedTime && ` • Next: ${timeContext.nextSuggestedTime}`}
      </Text>
    </View>
  );
};

// ─── Shared field wrapper ───────────────────────────────────────────────
const FieldLabel: React.FC<{
  label: string;
  required?: boolean;
  colors: any;
  fontSizeMultiplier: number;
  rightAccessory?: React.ReactNode;
}> = ({ label, required, colors, fontSizeMultiplier, rightAccessory }) => (
  <View style={styles.labelRow}>
    <Text style={[styles.label, { color: colors.text, fontSize: 15 * fontSizeMultiplier }]}>
      {label}
      {required && (
        <Text style={[styles.required, { color: colors.error || '#ef4444' }]}> *</Text>
      )}
    </Text>
    {rightAccessory}
  </View>
);

// ─── Smart Multi-Select Field ───────────────────────────────────────────
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
}) => {
  const selected = Array.isArray(value) ? value : [];

  // Only surface suggestions with real confidence
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
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          selected.length > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: `${tracker.color}15` }]}>
              <Text style={[styles.countText, { color: tracker.color }]}>
                {selected.length} selected
              </Text>
            </View>
          ) : null
        }
      />

      {(hasSuggestion || hasYesterday) && (
        <View style={styles.suggestionRow}>
          {hasSuggestion && (
            <TouchableOpacity
              onPress={() => onChange(suggestionArray)}
              style={[
                styles.suggestionChip,
                { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 },
              ]}
            >
              <Text style={styles.suggestionChipEmoji}>✨</Text>
              <Text style={[styles.suggestionChipText, { color: tracker.color }]}>
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
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.suggestionChipText, { color: colors.textSecondary }]}>
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
                },
              ]}
              onPress={() => toggleOption(option.id)}
            >
              {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
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
                <Ionicons name="checkmark-circle" size={16} color={tracker.color} />
              )}
              {isSuggested && !isSelected && (
                <Text style={[styles.suggestIndicator, { color: tracker.color }]}>✨</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

// ─── Smart Select Field ─────────────────────────────────────────────────
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
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      {(hasSuggestion || hasYesterday) && (
        <View style={styles.suggestionRow}>
          {hasSuggestion && (
            <TouchableOpacity
              style={[
                styles.suggestionChip,
                { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 },
              ]}
              onPress={() => onChange(suggestion!.value)}
            >
              <Text style={styles.suggestionChipEmoji}>✨</Text>
              <Text style={[styles.suggestionChipText, { color: tracker.color }]}>
                {field.options?.find((o) => o.id === suggestion!.value)?.label ||
                  String(suggestion!.value)}{' '}
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
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.suggestionChipText, { color: colors.textSecondary }]}>
                Yesterday: {field.options?.find((o) => o.id === yesterdayValue)?.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.optionsRow}>
        {field.options?.map((option: FieldOption) => {
          const isSelected = value === option.id;
          const isSuggested = hasSuggestion && suggestion?.value === option.id;

          return (
            <TouchableOpacity
              key={option.id}
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
                },
              ]}
              onPress={() => onChange(option.id)}
            >
              {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
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
                <Text style={[styles.suggestIndicator, { color: tracker.color }]}>✨</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

// ─── Smart Text Field ───────────────────────────────────────────────────
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
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          trend && trend.direction !== 'same' ? (
            <View style={styles.trendBadge}>
              <Ionicons
                name={TREND_ICONS[trend.direction]}
                size={14}
                color={trend.direction === 'up' ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.trendText,
                  { color: trend.direction === 'up' ? colors.success : colors.error },
                ]}
              >
                {trend.deltaLabel}
              </Text>
            </View>
          ) : null
        }
      />

      <TextInput
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
          },
        ]}
        placeholder={
          field.placeholder ||
          (hasSuggestion ? `${suggestion!.emoji} ${String(suggestion!.value)}` : '')
        }
        placeholderTextColor={hasSuggestion ? tracker.color : colors.textSecondary}
        value={String(value || '')}
        onChangeText={(text) => onChange(text)}
      />

      {field.unit && (
        <Text style={[styles.unit, { color: colors.textSecondary }]}>{field.unit}</Text>
      )}

      {(hasSuggestion || hasYesterday) && (
        <View style={styles.suggestionRow}>
          {hasSuggestion && (
            <TouchableOpacity
              onPress={() => onChange(suggestion!.value)}
              style={[
                styles.suggestionChip,
                { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 },
              ]}
            >
              <Text style={styles.suggestionChipEmoji}>{suggestion!.emoji}</Text>
              <Text style={[styles.suggestionChipText, { color: tracker.color }]}>
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
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.suggestionChipText, { color: colors.textSecondary }]}>
                Yesterday: {String(yesterdayValue).slice(0, 20)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

// ─── Smart Number Field ─────────────────────────────────────────────────
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
}) => {
  const quickValues = useMemo(() => {
    const values: { label: string; value: number }[] = [];
    const suggNum = Number(suggestion?.value);
    const yestNum = Number(yesterdayValue);

    if (
      suggestion !== undefined &&
      suggestion.confidence >= 60 &&
      Number.isFinite(suggNum) &&
      suggNum > 0
    ) {
      values.push({ label: 'Suggest', value: suggNum });
    }
    if (Number.isFinite(yestNum) && yestNum > 0) {
      values.push({ label: 'Same', value: yestNum });
      if (values.length < 4) values.push({ label: '-25%', value: Math.round(yestNum * 0.75) });
      if (values.length < 4) values.push({ label: '+25%', value: Math.round(yestNum * 1.25) });
    }
    return values.slice(0, 4);
  }, [suggestion, yesterdayValue]);

  const hasSuggestion =
    suggestion !== undefined &&
    suggestion.confidence >= 60 &&
    suggestion.value !== undefined &&
    suggestion.value !== '';

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          trend && trend.direction !== 'same' ? (
            <View style={styles.trendBadge}>
              <Ionicons
                name={TREND_ICONS[trend.direction]}
                size={14}
                color={trend.direction === 'up' ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.trendText,
                  { color: trend.direction === 'up' ? colors.success : colors.error },
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
          },
        ]}
      >
        <TextInput
          style={[styles.numberInput, { color: colors.text, fontSize: 16 * fontSizeMultiplier }]}
          keyboardType="numeric"
          placeholder={
            field.placeholder ||
            (hasSuggestion ? `${suggestion!.emoji} ${String(suggestion!.value)}` : '0')
          }
          placeholderTextColor={hasSuggestion ? tracker.color : colors.textSecondary}
          value={String(value || '')}
          onChangeText={(text) => {
            if (text === '') {
              onChange('');
              return;
            }
            const num = parseFloat(text);
            onChange(isNaN(num) ? text : num);
          }}
        />
        {field.unit && (
          <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>
            {field.unit}
          </Text>
        )}
      </View>

      {quickValues.length > 0 && (
        <View style={styles.quickValuesRow}>
          {quickValues.map((qv, i) => (
            <TouchableOpacity
              key={`${qv.label}-${i}`}
              style={[
                styles.quickValueChip,
                { backgroundColor: `${tracker.color}10`, borderRadius: borderRadiusValue / 2 },
              ]}
              onPress={() => onChange(qv.value)}
            >
              <Text style={[styles.quickValueText, { color: tracker.color }]}>
                {qv.label}
              </Text>
              <Text style={[styles.quickValueNum, { color: tracker.color }]}>{qv.value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

// ─── Smart Duration Field ───────────────────────────────────────────────
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
    yesterdayValue !== undefined && yesterdayValue !== '' ? Number(yesterdayValue) : null;

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
        rightAccessory={
          isTimerRunning ? (
            <View style={[styles.recordingBadge, { backgroundColor: `${tracker.color}20` }]}>
              <View style={[styles.recordingDot, { backgroundColor: tracker.color }]} />
              <Text style={[styles.recordingText, { color: tracker.color }]}>Recording</Text>
            </View>
          ) : null
        }
      />

      <View style={styles.durationRow}>
        <TouchableOpacity
          style={[styles.durationBtn, { backgroundColor: colors.surface }]}
          onPress={() => onChange(Math.max(0, seconds - 60))}
        >
          <Ionicons name="remove" size={20} color={tracker.color} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.timerToggle,
            {
              backgroundColor: isTimerRunning ? `${tracker.color}20` : colors.surface,
              borderRadius: borderRadiusValue,
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
          style={[styles.durationBtn, { backgroundColor: colors.surface }]}
          onPress={() => onChange(seconds + 60)}
        >
          <Ionicons name="add" size={20} color={tracker.color} />
        </TouchableOpacity>
      </View>

      <View style={styles.presetRow}>
        {[5, 10, 15, 30, 45, 60].map((mins) => (
          <TouchableOpacity
            key={mins}
            style={[
              styles.presetChip,
              { backgroundColor: colors.surface, borderRadius: borderRadiusValue / 2 },
            ]}
            onPress={() => onChange(mins * 60)}
          >
            <Text style={[styles.presetText, { color: colors.textSecondary }]}>{mins}m</Text>
          </TouchableOpacity>
        ))}
        {Number.isFinite(suggestedDuration) && suggestedDuration! > 0 && (
          <TouchableOpacity
            style={[
              styles.presetChip,
              { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 },
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
          !Number.isFinite(suggestedDuration) && (
            <TouchableOpacity
              style={[
                styles.presetChip,
                { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 },
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

// ─── Smart Mood Field ───────────────────────────────────────────────────
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
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />
      {yesterdayMood && (
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
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
              style={[
                styles.moodBtn,
                isSelected && {
                  backgroundColor: `${tracker.color}15`,
                  transform: [{ scale: 1.15 }],
                },
                isSuggested &&
                  !isSelected && { borderWidth: 2, borderColor: tracker.color },
                wasYesterday &&
                  !isSelected &&
                  !isSuggested && {
                    borderWidth: 2,
                    borderColor: `${colors.textSecondary}30`,
                  },
                { borderRadius: borderRadiusValue },
              ]}
              onPress={() => onChange(moodValue)}
            >
              <Text style={[styles.moodEmoji, isSelected && { fontSize: 40 }]}>{emoji}</Text>
              {isSuggested && !isSelected && (
                <View
                  style={[styles.suggestIndicatorBadge, { backgroundColor: tracker.color }]}
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

// ─── Smart Temperature Field ────────────────────────────────────────────
const SmartTemperatureField: React.FC<{
  field: FieldConfig;
  data: Record<string, unknown>;
  updateField: (id: string, value: unknown) => void;
  errors: Record<string, string>;
  fullThemeColors: any;
  tracker: UnifiedTrackerConfig;
  borderRadiusValue: number;
  fontSizeMultiplier: number;
}> = ({
  field,
  data,
  updateField,
  errors,
  fullThemeColors,
  tracker,
  borderRadiusValue,
  fontSizeMultiplier,
}) => {
  const unitKey = `${field.id}_unit`;
  const unitOptions = (field as any).unitOptions || [
    { id: 'celsius', label: '°C' },
    { id: 'fahrenheit', label: '°F' },
  ];

  // Region-aware default: US defaults to °F, everywhere else °C
  const defaultUnit = useMemo(() => {
    try {
      const locale = Intl.NumberFormat().resolvedOptions().locale || 'en-US';
      const region = locale.split('-')[1] || 'US';
      if (unitOptions.some((u: any) => u.id === 'fahrenheit') && region === 'US') {
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
          },
        ]}
      >
        <TextInput
          style={[
            styles.tempInput,
            { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
          ]}
          keyboardType="decimal-pad"
          placeholder={selectedUnit === 'fahrenheit' ? '98.6' : '36.5'}
          placeholderTextColor={fullThemeColors.textSecondary}
          value={String(data[field.id] || '')}
          onChangeText={(text) => {
            const num = parseFloat(text);
            updateField(field.id, isNaN(num) ? text : num);
          }}
        />
        <View
          style={[
            styles.tempUnitToggle,
            { backgroundColor: fullThemeColors.border, borderRadius: borderRadiusValue / 2 },
          ]}
        >
          {unitOptions.map((u: any) => (
            <TouchableOpacity
              key={u.id}
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
                    color: selectedUnit === u.id ? '#fff' : fullThemeColors.textSecondary,
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
        <Text style={[styles.errorText, { color: fullThemeColors.error || '#ef4444' }]}>
          {errors[field.id]}
        </Text>
      )}
    </View>
  );
};

// ─── Smart Quantity Field ───────────────────────────────────────────────
const SmartQuantityField: React.FC<{
  field: FieldConfig;
  data: Record<string, unknown>;
  updateField: (id: string, value: unknown) => void;
  errors: Record<string, string>;
  fullThemeColors: any;
  tracker: UnifiedTrackerConfig;
  borderRadiusValue: number;
  fontSizeMultiplier: number;
}> = ({
  field,
  data,
  updateField,
  errors,
  fullThemeColors,
  tracker,
  borderRadiusValue,
  fontSizeMultiplier,
}) => {
  const unitKey = `${field.id}_unit`;
  // Smart unit detection: solid food gets solid units, liquids get liquid units
  const isSolidFood = 
    field.id?.toLowerCase().includes('solid') ||
    field.id?.toLowerCase().includes('food') ||
    field.label?.toLowerCase().includes('solid') ||
    field.label?.toLowerCase().includes('eaten');

  const defaultSolidUnits = [
    { id: 'g', label: 'g' },
    { id: 'oz', label: 'oz' },
    { id: 'tbsp', label: 'tbsp' },
    { id: 'servings', label: 'servings' },
    { id: 'pieces', label: 'pieces' },
  ];

  const defaultLiquidUnits = [
    { id: 'ml', label: 'ml' },
    { id: 'oz', label: 'oz' },
  ];

  const unitOptions = (field as any).unitOptions || 
    (isSolidFood ? defaultSolidUnits : defaultLiquidUnits);

  // Region-aware default unit
  const defaultUnit = useMemo(() => {
    try {
      const locale = Intl.NumberFormat().resolvedOptions().locale || 'en-US';
      const region = locale.split('-')[1] || 'US';
      const isImperialRegion = region === 'US' || region === 'GB' || region === 'LR' || region === 'MM';
      
      // For solid food, prefer grams as universal default; oz only in imperial regions
      if (isSolidFood) {
        if (isImperialRegion && unitOptions.some((u: any) => u.id === 'oz')) {
          return 'oz';
        }
        return 'g';
      }
      
      // For liquids, use oz in imperial regions, ml elsewhere
      if (isImperialRegion && unitOptions.some((u: any) => u.id === 'oz')) {
        return 'oz';
      }
    } catch {}
    return unitOptions[0].id;
  }, [unitOptions, isSolidFood]);

  const selectedUnit = (data[unitKey] as string) || defaultUnit;

  return (
    <View style={styles.fieldContainer}>
      <FieldLabel
        label={field.label}
        required={field.required}
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
          },
        ]}
      >
        <TextInput
          style={[
            styles.numberInput,
            { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier },
          ]}
          keyboardType="numeric"
          placeholder={field.placeholder || '0'}
          placeholderTextColor={fullThemeColors.textSecondary}
          value={String(data[field.id] || '')}
          onChangeText={(text) => {
            if (text === '') {
              updateField(field.id, '');
              return;
            }
            const num = parseFloat(text);
            updateField(field.id, isNaN(num) ? text : num);
          }}
        />
        <View
          style={[
            styles.tempUnitToggle,
            { backgroundColor: fullThemeColors.border, borderRadius: borderRadiusValue / 2 },
          ]}
        >
          {unitOptions.map((u: any) => (
            <TouchableOpacity
              key={u.id}
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
                    color: selectedUnit === u.id ? '#fff' : fullThemeColors.textSecondary,
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
        <Text style={[styles.errorText, { color: fullThemeColors.error || '#ef4444' }]}>
          {errors[field.id]}
        </Text>
      )}
    </View>
  );
};

// ─── Smart DateTime Field (with Ongoing support) ────────────────────────
const SmartDateTimeField: React.FC<{
  field: FieldConfig;
  data: Record<string, unknown>;
  updateField: (id: string, value: unknown) => void;
  tracker: UnifiedTrackerConfig;
  colors: any;
  fontSizeMultiplier: number;
  borderRadiusValue: number;
  isStart: boolean;
}> = ({
  field,
  data,
  updateField,
  tracker,
  colors,
  fontSizeMultiplier,
  borderRadiusValue,
  isStart,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const currentValue = data[field.id];
  const currentDate = currentValue ? new Date(String(currentValue)) : new Date();
  const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== '';
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
        colors={colors}
        fontSizeMultiplier={fontSizeMultiplier}
      />

      <TouchableOpacity
        style={[
          styles.input,
          {
            borderColor: colors.border,
            borderRadius: borderRadiusValue,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          },
        ]}
        onPress={() => setShowPicker(true)}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        <Text
          style={{
            color: hasValue ? colors.text : colors.textSecondary,
            flex: 1,
            fontSize: 15,
          }}
        >
          {displayText}
        </Text>
        {hasValue && (
          <TouchableOpacity
            onPress={() => updateField(field.id, undefined)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Ongoing hint when start is set but end is not */}
      {isStart && hasValue && !hasOtherValue && (
        <TouchableOpacity
          style={styles.ongoingHint}
          onPress={() => {
            // Set endTime to now to complete the session
            updateField('endTime', new Date().toISOString());
          }}
        >
          <Ionicons name="time-outline" size={14} color={tracker.color} />
          <Text style={[styles.ongoingHintText, { color: tracker.color }]}>
            Ongoing — tap here to end now
          </Text>
        </TouchableOpacity>
      )}

      {/* Show duration if both start and end are set */}
      {!isStart && hasValue && hasOtherValue && (
        <View style={styles.durationHint}>
          <Ionicons name="checkmark-circle" size={14} color={tracker.color} />
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

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────
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
    themeColors,
    isDark,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
    triggerHaptic,
  } = useCustomization();
  const { success, error, info } = useSweetAlert();

  const {
    prefillData = {},
    suggestions = [],
    streak,
    insights = [],
    correlations = [],
    activeReminders = [],
    templates = [],
    trends = {},
    timeContext,
    yesterdayEntries = [],
    todayEntries = [],
  } = progressiveState || {};

  // Initial data seeded with suggestions (confidence >= 70 for auto-fill)
  const [data, setData] = useState<Record<string, unknown>>(() => {
    const merged = { ...prefillData, ...initialData };
    suggestions.forEach((s) => {
      if (merged[s.fieldId] === undefined && s.confidence >= 70) {
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
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [dismissedCorrelations, setDismissedCorrelations] = useState<Set<string>>(new Set());
  const [appliedPrefill, setAppliedPrefill] = useState<Record<string, unknown> | null>(null);

  const userEditedFields = useRef<Set<string>>(new Set());

  // ─── Apply prefill and suggestions ─────────────────────────────────
  useEffect(() => {
    setData((prev) => {
      const merged = { ...prefillData, ...initialData };

      suggestions.forEach((s) => {
        if (merged[s.fieldId] === undefined && s.confidence >= 70) {
          merged[s.fieldId] = s.value;
        }
      });

      if (appliedPrefill) {
        Object.entries(appliedPrefill).forEach(([key, value]) => {
          merged[key] = value;
        });
        setAppliedPrefill(null);
      }

      userEditedFields.current.forEach((key) => {
        if (prev[key] !== undefined) {
          merged[key] = prev[key];
        }
      });

      return merged;
    });
  }, [prefillData, suggestions, initialData, appliedPrefill]);

  // ─── Validation ─────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    tracker.fields.forEach((field) => {
      try {
        if (typeof isFieldVisible === 'function' && !isFieldVisible(field)) return;
      } catch {
        // Continue
      }
      if (field.required) {
        const value = data[field.id];
        if (
          value === undefined ||
          value === '' ||
          value === null ||
          (Array.isArray(value) && value.length === 0)
        ) {
          newErrors[field.id] = `${field.label} is required`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [tracker.fields, data]);

  // ─── Submit ─────────────────────────────────────────────────────────
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
      // Compute final data with derived fields (e.g., duration from start/end)
      const finalData = { ...data };

      // Auto-compute duration for sleep/feed if both start and end are set
      if (
        (tracker.id === 'sleep' || tracker.id === 'feed') &&
        finalData.startTime &&
        finalData.endTime
      ) {
        const startMs = new Date(String(finalData.startTime)).getTime();
        const endMs = new Date(String(finalData.endTime)).getTime();
        if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
          finalData.duration = Math.round((endMs - startMs) / 1000);
        }
      }

      await Promise.resolve(
        onSubmit(finalData, {
          notes: notes || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          photoUris: photoUris.length > 0 ? photoUris : undefined,
          linkedEntryId,
        })
      );
    } catch (err) {
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

  // ─── Field update with cross-field auto-linking ─────────────────────
  const updateField = useCallback(
    (fieldId: string, value: unknown) => {
      userEditedFields.current.add(fieldId);
      setData((prev) => {
        const next = { ...prev, [fieldId]: value };

        // ── Auto-link sleep/feed start/end times ─────────────────────
        if (tracker.id === 'sleep' || tracker.id === 'feed') {
          if (fieldId === 'startTime' && value && !prev.endTime) {
            // Leave endTime undefined → "ongoing"
            next.status = 'ongoing';
          }
          if (fieldId === 'endTime' && value) {
            next.status = 'completed';
            if (next.startTime) {
              const startMs = new Date(String(next.startTime)).getTime();
              const endMs = new Date(String(value)).getTime();
              if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
                next.duration = Math.round((endMs - startMs) / 1000);
              }
            }
          }
        }

        // ── Auto-calculate BMI for growth ─────────────────────────────
        if (tracker.id === 'growth') {
          const weight = Number(next.weight ?? next.weight_kg ?? prev.weight);
          const height = Number(next.height ?? next.height_cm ?? prev.height);
          if (Number.isFinite(weight) && Number.isFinite(height) && height > 0) {
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

  // ─── Apply yesterday data ───────────────────────────────────────────
  const applyYesterdayData = useCallback(
    (yestData: Record<string, unknown>) => {
      triggerHaptic('light');
      Object.keys(yestData).forEach((key) => userEditedFields.current.add(key));
      setData((prev) => ({ ...prev, ...yestData }));
      info('Applied', "Yesterday's values filled in!");
    },
    [triggerHaptic, info]
  );

  // ─── Suggestion / yesterday getters ─────────────────────────────────
  const getFieldSuggestion = useCallback(
    (fieldId: string): ProgressiveSuggestion | undefined => {
      // Require confidence >= 60 to surface a suggestion
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

  // ─── Field renderer ─────────────────────────────────────────────────
  const renderField = useCallback(
    (field: FieldConfig) => {
      try {
        if (typeof isFieldVisible === 'function' && !isFieldVisible(field)) return null;
      } catch {
        // Render anyway
      }

      const suggestion = getFieldSuggestion(field.id);
      const yesterdayValue = getYesterdayValue(field.id);
      const trend = getFieldTrend(field.id);

      const animatedWrapper = (children: React.ReactNode, key?: string) => (
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
        timeContext,
      };

      switch (field.type) {
        case 'datetime':
        case 'date': {
          // Special handling for sleep/feed start/end times
          if (
            (tracker.id === 'sleep' || tracker.id === 'feed') &&
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
              />,
              field.id
            );
          }
          return animatedWrapper(<SmartTextField {...commonProps} />, field.id);
        }
        case 'time':
          return animatedWrapper(<SmartTextField {...commonProps} />, field.id);
        case 'number':
          return animatedWrapper(<SmartNumberField {...commonProps} />, field.id);
        case 'select':
          return animatedWrapper(<SmartSelectField {...commonProps} />, field.id);
        case 'multiselect':
          return animatedWrapper(<SmartMultiSelectField {...commonProps} />, field.id);
        case 'toggle':
          return animatedWrapper(
            <View
              key={field.id}
              style={[styles.toggleContainer, { borderBottomColor: fullThemeColors.border }]}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                ]}
              >
                {field.label}
              </Text>
              <Switch
                value={Boolean(data[field.id])}
                onValueChange={(value) => updateField(field.id, value)}
                trackColor={{ false: fullThemeColors.border, true: `${tracker.color}80` }}
                thumbColor={data[field.id] ? tracker.color : fullThemeColors.textSecondary}
              />
            </View>,
            field.id
          );
        case 'duration':
          return animatedWrapper(<SmartDurationField {...commonProps} />, field.id);
        case 'rating': {
          const max = field.max || 5;
          const ratingValue = Number(data[field.id]) || 0;
          return animatedWrapper(
            <View key={field.id} style={styles.fieldContainer}>
              <Text
                style={[
                  styles.label,
                  { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                ]}
              >
                {field.label}
              </Text>
              <View style={styles.ratingRow}>
                {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => updateField(field.id, star)}
                  >
                    <Ionicons
                      name={star <= ratingValue ? 'star' : 'star-outline'}
                      size={32}
                      color={star <= ratingValue ? fullThemeColors.warning : fullThemeColors.border}
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
              <Text
                style={[
                  styles.label,
                  { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                ]}
              >
                {field.label}
                {field.required && (
                  <Text style={{ color: fullThemeColors.error || '#ef4444' }}> *</Text>
                )}
              </Text>
              <TextInput
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
                  style={[styles.errorText, { color: fullThemeColors.error || '#ef4444' }]}
                >
                  {errors[field.id]}
                </Text>
              )}
            </View>,
            field.id
          );
        case 'mood_emoji':
          return animatedWrapper(<SmartMoodField {...commonProps} />, field.id);
        case 'slider':
          return animatedWrapper(
            <View key={field.id} style={styles.fieldContainer}>
              <Text
                style={[
                  styles.label,
                  { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
                ]}
              >
                {field.label}: {String(data[field.id] || field.min || 0)}
                {field.unit}
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={field.min || 0}
                maximumValue={field.max || 100}
                step={field.step || 1}
                value={Number(data[field.id]) || field.min || 0}
                onValueChange={(value) => updateField(field.id, value)}
                minimumTrackTintColor={tracker.color}
                maximumTrackTintColor={fullThemeColors.border}
                thumbTintColor={tracker.color}
              />
            </View>,
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
            />,
            field.id
          );
        default:
          return animatedWrapper(<SmartTextField {...commonProps} />, field.id);
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
    ]
  );

  // ─── Quick mode ─────────────────────────────────────────────────────
  if (quickMode) {
    return (
      <View style={[styles.quickContainer, { backgroundColor: fullThemeColors.background }]}>
        <View style={[styles.quickHeader, { backgroundColor: tracker.gradient[0] + '15' }]}>
          <Text style={{ fontSize: 32 }}>{tracker.emoji}</Text>
          <Text
            style={[
              styles.quickTitle,
              { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier },
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

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tracker.fields.slice(0, 3).map(renderField)}

          <TouchableOpacity
            style={[
              styles.quickSubmit,
              { backgroundColor: tracker.gradient[0], borderRadius: borderRadiusValue },
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

  // ─── Full mode ──────────────────────────────────────────────────────
  const visibleInsights = insights.filter((i) => !dismissedInsights.has(i.id));
  const visibleCorrelations = correlations.filter((c) => !dismissedCorrelations.has(c.id));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: fullThemeColors.background }]}
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
          <Text style={[styles.headerEmoji, { fontSize: 48 * fontSizeMultiplier }]}>
            {tracker.emoji}
          </Text>
          <Text
            style={[
              styles.headerTitle,
              { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier },
            ]}
          >
            {tracker.name}
          </Text>
          <Text
            style={[
              styles.headerDesc,
              { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier },
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
            <View style={[styles.linkedBadge, { backgroundColor: `${tracker.color}20` }]}>
              <Ionicons name="link-outline" size={14} color={tracker.color} />
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
                <Text style={styles.correlationEmoji}>{correlation.emoji || '🔗'}</Text>
                <View style={styles.correlationInfo}>
                  <Text
                    style={[styles.correlationMessage, { color: fullThemeColors.text }]}
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
                          Object.keys(correlation.prefillData).forEach((key) =>
                            userEditedFields.current.add(key)
                          );
                          setData((prev) => ({ ...prev, ...correlation.prefillData }));
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
                      setDismissedCorrelations((prev) => new Set(prev).add(correlation.id))
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
                  <Text style={[styles.insightTitle, { color: fullThemeColors.text }]}>
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
                    setDismissedInsights((prev) => new Set(prev).add(insight.id))
                  }
                >
                  <Ionicons name="close" size={18} color={fullThemeColors.textSecondary} />
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
                style={[styles.yesterdayTitle, { color: fullThemeColors.textSecondary }]}
              >
                Suggested from Yesterday
              </Text>
              <TouchableOpacity onPress={() => applyYesterdayData(prefillData)}>
                <Text style={[styles.yesterdayApply, { color: tracker.color }]}>
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
                    <Text style={[styles.yesterdayChipText, { color: tracker.color }]}>
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
        <View style={styles.formBody}>{tracker.fields.map(renderField)}</View>

        {/* Notes */}
        <View style={styles.fieldContainer}>
          <Text
            style={[
              styles.label,
              { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
            ]}
          >
            Additional Notes
          </Text>
          <TextInput
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
                { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier },
              ]}
            >
              Quick Tags
            </Text>
            <View style={styles.tagsWrap}>
              {tracker.quickTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
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
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    setSelectedTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
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
              style={[
                styles.cancelBtn,
                { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue },
              ]}
              onPress={onCancel}
            >
              <Text
                style={[
                  styles.cancelText,
                  { color: fullThemeColors.textSecondary, fontSize: 16 * fontSizeMultiplier },
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
            <Text style={[styles.submitText, { fontSize: 16 * fontSizeMultiplier }]}>
              {isSubmitting ? 'Saving...' : `Save ${tracker.emoji}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── STYLES ─────────────────────────────────────────────────────────────
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
  label: { fontWeight: '600' },
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

  numberRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingRight: 16 },
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
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
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