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
import Animated, { 
  FadeInUp, 
  FadeIn,
} from 'react-native-reanimated';

  UnifiedTrackerConfig,
  FieldConfig,
  FieldOption,
} from '../../types/trackers';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
  TrackerProgressiveState, 
  ProgressiveSuggestion,
  ProgressiveTrend,
} from '../../hooks/useTrackerProgressive';

const { width: SCREEN_W } = Dimensions.get('window');

interface DynamicTrackerFormProps {
  tracker: UnifiedTrackerConfig;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>, options: {
    title?: string;
    notes?: string;
    photoUris?: string[];
    tags?: string[];
    linkedEntryId?: string;
  }) => void;
  onCancel?: () => void;
  
  progressiveState?: Partial<TrackerProgressiveState>;
  
  linkedEntryId?: string;
  showInsights?: boolean;
  quickMode?: boolean;
}

const MOOD_EMOJIS = ['😭', '😟', '😐', '🙂', '😄'];
const TREND_ICONS = { up: 'trending-up-outline', down: 'trending-down-outline', same: 'remove-outline' };

const StreakBadge: React.FC<{ streak: TrackerProgressiveState['streak']; color: string }> = ({ streak, color }) => {
  if (!streak || streak.currentStreak === 0) return null;
  
  const isAtRisk = streak.isAtRisk;
  
  return (
    <Animated.View entering={FadeIn} style={[styles.streakBadge, { 
      backgroundColor: isAtRisk ? '#FF6B6B20' : `${color}15`,
      borderColor: isAtRisk ? '#FF6B6B' : color,
    }]}>
      <Ionicons name={isAtRisk ? 'flame-outline' : 'flame'} size={16} color={isAtRisk ? '#FF6B6B' : color} />
      <Text style={[styles.streakText, { color: isAtRisk ? '#FF6B6B' : color }]}>
        {streak.currentStreak} day{streak.currentStreak !== 1 ? 's' : ''}
        {isAtRisk ? ' (log soon!)' : ''}
      </Text>
    </Animated.View>
  );
};

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
        {timeContext.nextSuggestedTime && ` • Suggest: ${timeContext.nextSuggestedTime}`}
      </Text>
    </View>
  );
};

const InsightCard: React.FC<{
  insight: TrackerProgressiveState['insights'][0];
  onAction: () => void;
  onDismiss: () => void;
  colors: any;
  borderRadiusValue: number;
}> = ({ insight, onAction, onDismiss, colors, borderRadiusValue }) => {
  const priorityColors = {
    info: colors.info,
    good: colors.success,
    warning: colors.warning,
    alert: colors.error,
  };
  
  const bgColors = {
    info: `${colors.info}10`,
    good: `${colors.success}10`,
    warning: `${colors.warning}10`,
    alert: `${colors.error}10`,
  };
  
  return (
    <Animated.View entering={FadeInUp} style={[styles.insightCard, { 
      backgroundColor: bgColors[insight.priority as keyof typeof bgColors] || bgColors.info,
      borderColor: priorityColors[insight.priority as keyof typeof priorityColors] || colors.info,
      borderRadius: borderRadiusValue,
    }]}>
      <Text style={styles.insightEmoji}>{insight.emoji}</Text>
      <View style={styles.insightContent}>
        <Text style={[styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
        <Text style={[styles.insightDesc, { color: colors.textSecondary }]} numberOfLines={2}>
          {insight.description}
        </Text>
        {insight.action && insight.action.type !== 'none' && (
          <TouchableOpacity onPress={onAction} style={styles.insightAction}>
            <Text style={[styles.insightActionText, { color: priorityColors[insight.priority as keyof typeof priorityColors] || colors.info }]}>
              {insight.action.message || 'Take Action'} →
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.insightDismiss}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const CorrelationBanner: React.FC<{
  correlation: TrackerProgressiveState['correlations'][0];
  onAction: () => void;
  onDismiss: () => void;
  colors: any;
  borderRadiusValue: number;
}> = ({ correlation, onAction, onDismiss, colors, borderRadiusValue }) => {
  return (
    <Animated.View entering={FadeInUp} style={[styles.correlationBanner, { 
      backgroundColor: `${colors.info}08`,
      borderRadius: borderRadiusValue,
      borderLeftWidth: 3,
      borderLeftColor: colors.info,
    }]}>
      <Text style={styles.correlationEmoji}>{correlation.emoji}</Text>
      <View style={styles.correlationInfo}>
        <Text style={[styles.correlationMessage, { color: colors.text }]} numberOfLines={2}>
          {correlation.message}
        </Text>
        <Text style={[styles.correlationMeta, { color: colors.textSecondary }]}>
          {correlation.trackerEmoji} {correlation.trackerName} • {correlation.confidence}% match
        </Text>
      </View>
      <View style={styles.correlationActions}>
        {correlation.action !== 'none' && (
          <TouchableOpacity 
            style={[styles.correlationActionBtn, { backgroundColor: colors.info }]}
            onPress={onAction}
          >
            <Text style={styles.correlationActionText}>
              {correlation.action === 'log_now' ? 'Log' : correlation.action === 'prefill' ? 'Apply' : 'View'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDismiss} style={styles.correlationDismiss}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const YesterdayPreview: React.FC<{
  prefillData: Record<string, unknown>;
  onApply: (data: Record<string, unknown>) => void;
  tracker: UnifiedTrackerConfig;
  colors: any;
  borderRadiusValue: number;
}> = ({ prefillData, onApply, tracker, colors, borderRadiusValue }) => {
  if (!prefillData || Object.keys(prefillData).length === 0) return null;
  
  return (
    <Animated.View entering={FadeInUp.delay(100)} style={[styles.yesterdayCard, { 
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: borderRadiusValue,
    }]}>
      <View style={styles.yesterdayHeader}>
        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.yesterdayTitle, { color: colors.textSecondary }]}>
          Suggested from Yesterday
        </Text>
        <TouchableOpacity onPress={() => onApply(prefillData)}>
          <Text style={[styles.yesterdayApply, { color: tracker.color }]}>Apply All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.yesterdayData}>
        {Object.entries(prefillData).slice(0, 4).map(([key, value]) => (
          <TouchableOpacity 
            key={key}
            style={[styles.yesterdayChip, { backgroundColor: `${tracker.color}10`, borderRadius: borderRadiusValue / 2 }]}
            onPress={() => onApply({ [key]: value })}
          >
            <Text style={[styles.yesterdayChipText, { color: tracker.color }]}>
              {key}: {String(value).length > 15 ? String(value).slice(0, 15) + '...' : String(value)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

interface SmartFieldProps {
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
  timeContext?: TrackerProgressiveState['timeContext'];
}

const SmartTextField: React.FC<SmartFieldProps> = ({
  field, value, onChange, error, tracker, colors, fontSizeMultiplier, borderRadiusValue,
  suggestion, yesterdayValue, trend,
}) => {
  const hasSuggestion = suggestion !== undefined && suggestion.value !== '';
  const hasYesterday = yesterdayValue !== undefined && yesterdayValue !== '';
  
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text, fontSize: 15 * fontSizeMultiplier }]}>
          {field.label}
          {field.required && <Text style={[styles.required, { color: colors.error }]}> *</Text>}
        </Text>
        {trend && trend.direction !== 'same' && (
          <View style={styles.trendBadge}>
            <Ionicons 
              name={TREND_ICONS[trend.direction]} 
              size={14} 
              color={trend.direction === 'up' ? colors.success : colors.error} 
            />
            <Text style={[styles.trendText, { color: trend.direction === 'up' ? colors.success : colors.error }]}>
              {trend.deltaLabel}
            </Text>
          </View>
        )}
      </View>
      
      <TextInput
        style={[styles.input, {
          borderColor: error ? colors.error : hasSuggestion ? tracker.color : colors.border,
          borderRadius: borderRadiusValue,
          backgroundColor: error ? `${colors.error}10` : hasSuggestion ? `${tracker.color}05` : colors.surface,
          color: colors.text,
          fontSize: 16 * fontSizeMultiplier,
        }]}
        placeholder={field.placeholder || (hasSuggestion ? `${suggestion.emoji} ${suggestion.label}: ${String(suggestion.value)}` : '')}
        placeholderTextColor={hasSuggestion ? tracker.color : colors.textSecondary}
        value={String(value || '')}
        onChangeText={text => onChange(text)}
      />
      
      {field.unit && <Text style={[styles.unit, { color: colors.textSecondary }]}>{field.unit}</Text>}
      
      <View style={styles.suggestionRow}>
        {hasSuggestion && (
          <TouchableOpacity onPress={() => onChange(suggestion.value)} style={[styles.suggestionChip, { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 }]}>
            <Text style={styles.suggestionChipEmoji}>{suggestion.emoji}</Text>
            <Text style={[styles.suggestionChipText, { color: tracker.color }]}>
              {suggestion.label} ({suggestion.confidence}%)
            </Text>
          </TouchableOpacity>
        )}
        {hasYesterday && (
          <TouchableOpacity onPress={() => onChange(yesterdayValue)} style={[styles.suggestionChip, { backgroundColor: `${colors.textSecondary}15`, borderRadius: borderRadiusValue / 2 }]}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.suggestionChipText, { color: colors.textSecondary }]}>
              Yesterday: {String(yesterdayValue).slice(0, 20)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

const SmartNumberField: React.FC<SmartFieldProps> = ({
  field, value, onChange, error, tracker, colors, fontSizeMultiplier, borderRadiusValue,
  suggestion, yesterdayValue, trend,
}) => {
  const [quickValues, setQuickValues] = useState<number[]>([]);
  
  useEffect(() => {
    const values: number[] = [];
    if (suggestion?.value !== undefined && !isNaN(Number(suggestion.value))) {
      values.push(Number(suggestion.value));
    }
    if (yesterdayValue !== undefined && !isNaN(Number(yesterdayValue))) {
      const yest = Number(yesterdayValue);
      values.push(yest, yest * 0.75, yest * 1.25, yest * 0.5, yest * 1.5);
    }
    setQuickValues(values.filter(v => v > 0 && !isNaN(v)).slice(0, 4));
  }, [yesterdayValue, suggestion]);
  
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text, fontSize: 15 * fontSizeMultiplier }]}>
          {field.label}
          {field.required && <Text style={[styles.required, { color: colors.error }]}> *</Text>}
        </Text>
        {trend && trend.direction !== 'same' && (
          <View style={styles.trendBadge}>
            <Ionicons 
              name={TREND_ICONS[trend.direction]} 
              size={14} 
              color={trend.direction === 'up' ? colors.success : colors.error} 
            />
            <Text style={[styles.trendText, { color: trend.direction === 'up' ? colors.success : colors.error }]}>
              {trend.deltaLabel}
            </Text>
          </View>
        )}
      </View>
      
      <View style={[styles.numberRow, { 
        borderColor: error ? colors.error : suggestion ? tracker.color : colors.border,
        borderRadius: borderRadiusValue,
        backgroundColor: error ? `${colors.error}10` : colors.surface,
      }]}>
        <TextInput
          style={[styles.numberInput, { color: colors.text, fontSize: 16 * fontSizeMultiplier }]}
          keyboardType="numeric"
          placeholder={field.placeholder || (suggestion ? `${suggestion.emoji} ${String(suggestion.value)}` : '0')}
          placeholderTextColor={suggestion ? tracker.color : colors.textSecondary}
          value={String(value || '')}
          onChangeText={text => {
            const num = parseFloat(text);
            onChange(isNaN(num) ? text : num);
          }}
        />
        {field.unit && <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>{field.unit}</Text>}
      </View>
      
      {quickValues.length > 0 && (
        <View style={styles.quickValuesRow}>
          {quickValues.map((qv, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.quickValueChip, { backgroundColor: `${tracker.color}10`, borderRadius: borderRadiusValue / 2 }]}
              onPress={() => onChange(Math.round(qv * 10) / 10)}
            >
              <Text style={[styles.quickValueText, { color: tracker.color }]}>
                {i === 0 && suggestion?.value === qv ? 'Suggest' : i === 0 ? 'Same' : i === 1 ? '-25%' : i === 2 ? '+25%' : i === 3 ? '½' : '1½'}
              </Text>
              <Text style={[styles.quickValueNum, { color: tracker.color }]}>
                {Math.round(qv * 10) / 10}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

const SmartSelectField: React.FC<SmartFieldProps> = ({
  field, value, onChange, error, tracker, colors, fontSizeMultiplier, borderRadiusValue,
  suggestion, yesterdayValue,
}) => {
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, { color: colors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {field.required && <Text style={[styles.required, { color: colors.error }]}> *</Text>}
      </Text>
      
      {suggestion && field.options?.find(o => o.id === suggestion.value) && (
        <TouchableOpacity
          style={[styles.yesterdaySelect, { backgroundColor: `${tracker.color}10`, borderRadius: borderRadiusValue }]}
          onPress={() => onChange(suggestion.value)}
        >
          <Text style={styles.suggestionChipEmoji}>{suggestion.emoji}</Text>
          <Text style={[styles.yesterdaySelectText, { color: tracker.color }]}>
            Suggested: {field.options.find(o => o.id === suggestion.value)?.label || String(suggestion.value)} ({suggestion.confidence}%)
          </Text>
        </TouchableOpacity>
      )}
      
      {yesterdayValue && !suggestion && (
        <TouchableOpacity
          style={[styles.yesterdaySelect, { backgroundColor: `${colors.textSecondary}10`, borderRadius: borderRadiusValue }]}
          onPress={() => onChange(yesterdayValue)}
        >
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.yesterdaySelectText, { color: colors.textSecondary }]}>
            Yesterday: {field.options?.find(o => o.id === yesterdayValue)?.label || String(yesterdayValue)}
          </Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.optionsRow}>
        {field.options?.map((option: FieldOption) => {
          const isSelected = value === option.id;
          const isSuggested = suggestion?.value === option.id;
          
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionChip,
                {
                  backgroundColor: isSelected ? `${tracker.color}20` : isSuggested ? `${tracker.color}08` : colors.surface,
                  borderColor: isSelected ? tracker.color : isSuggested ? `${tracker.color}50` : colors.border,
                  borderRadius: borderRadiusValue,
                  borderWidth: isSuggested ? 2 : 1.5,
                },
              ]}
              onPress={() => onChange(option.id)}
            >
              {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
              <Text style={[
                styles.optionLabel,
                { color: isSelected ? tracker.color : isSuggested ? tracker.color : colors.textSecondary },
                isSelected && { fontWeight: '600' },
              ]}>
                {option.label}
              </Text>
              {isSuggested && <Text style={[styles.suggestIndicator, { color: tracker.color }]}>✨</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
};

const SmartDurationField: React.FC<SmartFieldProps> = ({
  field, value, onChange, tracker, colors, fontSizeMultiplier, borderRadiusValue,
  suggestion, yesterdayValue,
}) => {
  const seconds = Number(value) || 0;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = seconds % 60;
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(seconds);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          const next = prev + 1;
          onChange(next);
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, onChange]);
  
  const suggestedDuration = suggestion?.value ? Number(suggestion.value) : null;
  const yesterdayDuration = yesterdayValue ? Number(yesterdayValue) : null;
  
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, { color: colors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {isTimerRunning && <Text style={{ color: tracker.color }}> ● Recording</Text>}
      </Text>
      
      <View style={styles.durationRow}>
        <TouchableOpacity
          style={[styles.durationBtn, { backgroundColor: colors.surface }]}
          onPress={() => onChange(Math.max(0, seconds - 60))}
        >
          <Ionicons name="remove" size={20} color={tracker.color} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.timerToggle, { backgroundColor: isTimerRunning ? `${tracker.color}20` : colors.surface }]}
          onPress={() => setIsTimerRunning(!isTimerRunning)}
        >
          <Ionicons name={isTimerRunning ? "pause" : "play"} size={24} color={tracker.color} />
          <Text style={[styles.durationText, { color: colors.text, fontSize: 24 * fontSizeMultiplier }]}>
            {hours > 0 ? `${hours}h ` : ''}{mins}m {secs > 0 ? `${secs}s` : ''}
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
        {[5, 10, 15, 30, 45, 60].map(mins => (
          <TouchableOpacity
            key={mins}
            style={[styles.presetChip, { backgroundColor: colors.surface, borderRadius: borderRadiusValue / 2 }]}
            onPress={() => onChange(mins * 60)}
          >
            <Text style={[styles.presetText, { color: colors.textSecondary }]}>{mins}m</Text>
          </TouchableOpacity>
        ))}
        {suggestedDuration && (
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 }]}
            onPress={() => onChange(suggestedDuration)}
          >
            <Text style={styles.suggestionChipEmoji}>✨</Text>
            <Text style={[styles.presetText, { color: tracker.color }]}>
              Suggest ({Math.floor(suggestedDuration / 60)}m)
            </Text>
          </TouchableOpacity>
        )}
        {yesterdayDuration && !suggestedDuration && (
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: `${tracker.color}15`, borderRadius: borderRadiusValue / 2 }]}
            onPress={() => onChange(yesterdayDuration)}
          >
            <Ionicons name="time-outline" size={12} color={tracker.color} />
            <Text style={[styles.presetText, { color: tracker.color }]}>
              Yesterday ({Math.floor(yesterdayDuration / 60)}m)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const SmartMoodField: React.FC<SmartFieldProps> = ({
  field, value, onChange, tracker, colors, fontSizeMultiplier, borderRadiusValue,
  suggestion, yesterdayValue,
}) => {
  const currentValue = Number(value) || 3;
  const suggestedMood = suggestion?.value ? Number(suggestion.value) : null;
  const yesterdayMood = yesterdayValue ? Number(yesterdayValue) : null;
  
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, { color: colors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {yesterdayMood && (
          <Text style={{ color: colors.textSecondary }}> (Yesterday: {MOOD_EMOJIS[yesterdayMood - 1]})</Text>
        )}
      </Text>
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
                isSelected && { backgroundColor: `${tracker.color}15`, transform: [{ scale: 1.2 }] },
                isSuggested && !isSelected && { borderWidth: 2, borderColor: tracker.color },
                wasYesterday && !isSelected && !isSuggested && { borderWidth: 2, borderColor: `${colors.textSecondary}30` },
                { borderRadius: borderRadiusValue },
              ]}
              onPress={() => onChange(moodValue)}
            >
              <Text style={[styles.moodEmoji, isSelected && { fontSize: 40 }]}>
                {emoji}
              </Text>
              {isSuggested && !isSelected && (
                <View style={[styles.suggestIndicatorBadge, { backgroundColor: tracker.color }]}>
                  <Text style={styles.suggestIndicatorText}>✨</Text>
                </View>
              )}
              {wasYesterday && !isSelected && !isSuggested && (
                <View style={styles.yesterdayIndicator}>
                  <Ionicons name="time-outline" size={10} color={colors.textSecondary} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

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

  const [data, setData] = useState<Record<string, unknown>>(() => {
    const merged = { ...prefillData, ...initialData };
    suggestions.forEach(s => {
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

  useEffect(() => {
    setData(prev => {
      const merged = { ...prefillData, ...initialData };
      
      suggestions.forEach(s => {
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

      userEditedFields.current.forEach(key => {
        if (prev[key] !== undefined) {
          merged[key] = prev[key];
        }
      });

      return merged;
    });
  }, [prefillData, suggestions, initialData, appliedPrefill]);

  const isFieldVisible = useCallback((field: FieldConfig): boolean => {
    if (!field.showIf) return true;
    const { field: targetField, equals, notEquals, contains } = field.showIf;
    const targetValue = data[targetField];
    if (equals !== undefined) return targetValue === equals;
    if (notEquals !== undefined) return targetValue !== notEquals;
    if (contains !== undefined) {
      return Array.isArray(targetValue) && targetValue.includes(contains);
    }
    return true;
  }, [data]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    tracker.fields.forEach(field => {
      if (!isFieldVisible(field)) return;
      if (field.required) {
        const value = data[field.id];
        if (value === undefined || value === '' || value === null || 
            (Array.isArray(value) && value.length === 0)) {
          newErrors[field.id] = `${field.label} is required`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [tracker.fields, data, isFieldVisible]);

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
      onSubmit(data, {
        notes: notes || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        photoUris: photoUris.length > 0 ? photoUris : undefined,
        linkedEntryId,
      });
      
      success('Saved!', `${tracker.emoji} ${tracker.name} logged successfully.`);
    } catch (err) {
      error('Error', 'Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, data, notes, selectedTags, photoUris, onSubmit, triggerHaptic, error, success, tracker, isSubmitting, linkedEntryId]);

  const updateField = useCallback((fieldId: string, value: unknown) => {
    userEditedFields.current.add(fieldId);
    setData(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const applyYesterdayData = useCallback((yestData: Record<string, unknown>) => {
    triggerHaptic('light');
    Object.keys(yestData).forEach(key => userEditedFields.current.add(key));
    setData(prev => ({ ...prev, ...yestData }));
    info('Applied', "Yesterday's values filled in!");
  }, [triggerHaptic, info]);

  const toggleTag = useCallback((tag: string) => {
    triggerHaptic('light');
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, [triggerHaptic]);

  const getFieldSuggestion = useCallback((fieldId: string): ProgressiveSuggestion | undefined => {
    return suggestions.find(s => s.fieldId === fieldId);
  }, [suggestions]);

  const getYesterdayValue = useCallback((fieldId: string): unknown => {
    return prefillData[fieldId];
  }, [prefillData]);

  const getFieldTrend = useCallback((fieldId: string): ProgressiveTrend | undefined => {
    return trends[fieldId];
  }, [trends]);

  const renderMultiselectField = useCallback((field: FieldConfig) => {
    const selected = (data[field.id] as string[]) || [];
    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
          {field.label}
          {field.required && <Text style={[styles.required, { color: fullThemeColors.error }]}> *</Text>}
        </Text>
        <View style={styles.optionsWrap}>
          {field.options?.map((option: FieldOption) => {
            const isSelected = selected.includes(option.id);
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionChip, {
                  backgroundColor: isSelected ? `${tracker.color}20` : fullThemeColors.surface,
                  borderColor: isSelected ? tracker.color : fullThemeColors.border,
                  borderRadius: borderRadiusValue,
                }]}
                onPress={() => {
                  triggerHaptic('light');
                  const newSelected = isSelected
                    ? selected.filter(id => id !== option.id)
                    : [...selected, option.id];
                  updateField(field.id, newSelected);
                }}
              >
                {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                <Text style={[styles.optionLabel, { color: isSelected ? tracker.color : fullThemeColors.textSecondary }, isSelected && { fontWeight: '600' }]}>
                  {option.label}
                </Text>
                {isSelected && <Ionicons name="checkmark-circle" size={16} color={tracker.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
        {errors[field.id] && <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{errors[field.id]}</Text>}
      </View>
    );
  }, [data, errors, tracker.color, fullThemeColors, borderRadiusValue, fontSizeMultiplier, triggerHaptic, updateField]);

  const renderToggleField = useCallback((field: FieldConfig) => (
    <View key={field.id} style={[styles.toggleContainer, { borderBottomColor: fullThemeColors.border }]}>
      <Text style={[styles.toggleLabel, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
      <Switch
        value={Boolean(data[field.id])}
        onValueChange={value => updateField(field.id, value)}
        trackColor={{ false: fullThemeColors.border, true: `${tracker.color}80` }}
        thumbColor={data[field.id] ? tracker.color : fullThemeColors.textSecondary}
      />
    </View>
  ), [data, fullThemeColors, tracker.color, fontSizeMultiplier, updateField]);

  const renderRatingField = useCallback((field: FieldConfig) => {
    const max = field.max || 5;
    const value = Number(data[field.id]) || 0;
    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
        <View style={styles.ratingRow}>
          {Array.from({ length: max }, (_, i) => i + 1).map(star => (
            <TouchableOpacity key={star} onPress={() => updateField(field.id, star)}>
              <Ionicons name={star <= value ? 'star' : 'star-outline'} size={32} color={star <= value ? fullThemeColors.warning : fullThemeColors.border} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [data, fullThemeColors, fontSizeMultiplier, updateField]);

  const renderTextareaField = useCallback((field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
      <TextInput
        style={[styles.input, styles.textarea, { 
          borderColor: errors[field.id] ? fullThemeColors.error : fullThemeColors.border,
          borderRadius: borderRadiusValue,
          backgroundColor: errors[field.id] ? `${fullThemeColors.error}10` : fullThemeColors.surface,
          color: fullThemeColors.text,
          fontSize: 16 * fontSizeMultiplier,
          minHeight: 100 * fontSizeMultiplier,
        }]}
        multiline
        numberOfLines={4}
        placeholder={field.placeholder}
        placeholderTextColor={fullThemeColors.textSecondary}
        value={String(data[field.id] || '')}
        onChangeText={text => updateField(field.id, text)}
        textAlignVertical="top"
      />
      {errors[field.id] && <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{errors[field.id]}</Text>}
    </View>
  ), [data, errors, fullThemeColors, borderRadiusValue, fontSizeMultiplier, updateField]);

  const renderSliderField = useCallback((field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}: {String(data[field.id] || field.min || 0)}{field.unit}
      </Text>
      <Slider
        style={styles.slider}
        minimumValue={field.min || 0}
        maximumValue={field.max || 100}
        step={field.step || 1}
        value={Number(data[field.id]) || field.min || 0}
        onValueChange={value => updateField(field.id, value)}
        minimumTrackTintColor={tracker.color}
        maximumTrackTintColor={fullThemeColors.border}
        thumbTintColor={tracker.color}
      />
    </View>
  ), [data, fullThemeColors, tracker.color, fontSizeMultiplier, updateField]);

  const renderPhotoField = useCallback((field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
      <TouchableOpacity style={[styles.photoUpload, { borderColor: fullThemeColors.border, borderRadius: borderRadiusValue, backgroundColor: fullThemeColors.surface }]}>
        <Ionicons name="camera-outline" size={32} color={tracker.color} />
        <Text style={[styles.photoText, { color: fullThemeColors.textSecondary }]}>Tap to add photo</Text>
      </TouchableOpacity>
    </View>
  ), [fullThemeColors, tracker.color, borderRadiusValue, fontSizeMultiplier]);

  const renderTemperatureField = useCallback((field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {field.required && <Text style={[styles.required, { color: fullThemeColors.error }]}> *</Text>}
      </Text>
      <View style={[styles.tempRow, { 
        borderColor: errors[field.id] ? fullThemeColors.error : fullThemeColors.border,
        borderRadius: borderRadiusValue,
        backgroundColor: fullThemeColors.surface,
      }]}>
        <TextInput
          style={[styles.tempInput, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]}
          keyboardType="decimal-pad"
          placeholder="36.5"
          placeholderTextColor={fullThemeColors.textSecondary}
          value={String(data[field.id] || '')}
          onChangeText={text => updateField(field.id, parseFloat(text))}
        />
        <View style={[styles.tempUnitToggle, { backgroundColor: fullThemeColors.border, borderRadius: borderRadiusValue / 2 }]}>
          {['celsius', 'fahrenheit'].map(unit => (
            <TouchableOpacity
              key={unit}
              style={[styles.tempUnitBtn, data[`${field.id}_unit`] === unit && { backgroundColor: tracker.color, borderRadius: borderRadiusValue / 3 }]}
              onPress={() => updateField(`${field.id}_unit`, unit)}
            >
              <Text style={[styles.tempUnitText, { color: data[`${field.id}_unit`] === unit ? '#fff' : fullThemeColors.textSecondary }]}>
                {unit === 'celsius' ? '°C' : '°F'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {errors[field.id] && <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{errors[field.id]}</Text>}
    </View>
  ), [data, errors, fullThemeColors, tracker.color, borderRadiusValue, fontSizeMultiplier, updateField]);

  const renderField = useCallback((field: FieldConfig) => {
    if (!isFieldVisible(field)) return null;
    
    const suggestion = getFieldSuggestion(field.id);
    const yesterdayValue = getYesterdayValue(field.id);
    const trend = getFieldTrend(field.id);
    
    const commonProps: SmartFieldProps = {
      field,
      value: data[field.id],
      onChange: (v) => updateField(field.id, v),
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
    
    const animatedWrapper = (children: React.ReactNode) => (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50)}>
        {children}
      </Animated.View>
    );
    
    switch (field.type) {
      case 'text': return animatedWrapper(<SmartTextField {...commonProps} />);
      case 'number': return animatedWrapper(<SmartNumberField {...commonProps} />);
      case 'select': return animatedWrapper(<SmartSelectField {...commonProps} />);
      case 'multiselect': return animatedWrapper(renderMultiselectField(field));
      case 'toggle': return animatedWrapper(renderToggleField(field));
      case 'duration': return animatedWrapper(<SmartDurationField {...commonProps} />);
      case 'rating': return animatedWrapper(renderRatingField(field));
      case 'textarea': return animatedWrapper(renderTextareaField(field));
      case 'mood_emoji': return animatedWrapper(<SmartMoodField {...commonProps} />);
      case 'slider': return animatedWrapper(renderSliderField(field));
      case 'photo': return animatedWrapper(renderPhotoField(field));
      case 'temperature': return animatedWrapper(renderTemperatureField(field));
      default: return animatedWrapper(<SmartTextField {...commonProps} />);
    }
  }, [data, errors, isFieldVisible, tracker, fullThemeColors, borderRadiusValue, fontSizeMultiplier, shouldReduceMotion, getFieldSuggestion, getYesterdayValue, getFieldTrend, timeContext, updateField, renderMultiselectField, renderToggleField, renderRatingField, renderTextareaField, renderSliderField, renderPhotoField, renderTemperatureField]);

  const visibleInsights = insights.filter(i => !dismissedInsights.has(i.id));
  const visibleCorrelations = correlations.filter(c => !dismissedCorrelations.has(c.id));

  if (quickMode) {
    return (
      <View style={[styles.quickContainer, { backgroundColor: fullThemeColors.background }]}>
        <View style={[styles.quickHeader, { backgroundColor: tracker.gradient[0] + '15' }]}>
          <Text style={{ fontSize: 32 }}>{tracker.emoji}</Text>
          <Text style={[styles.quickTitle, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>
            {tracker.name}
          </Text>
          {streak && <StreakBadge streak={streak} color={tracker.color} />}
          <TimeContextBadge timeContext={timeContext} color={tracker.color} colors={fullThemeColors} />
        </View>
        
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tracker.fields.slice(0, 3).map(renderField)}
          
          <TouchableOpacity
            style={[styles.quickSubmit, { backgroundColor: tracker.gradient[0], borderRadius: borderRadiusValue }]}
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: fullThemeColors.background }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: tracker.gradient[0] + '15', 
          borderBottomLeftRadius: borderRadiusValue * 1.5, 
          borderBottomRightRadius: borderRadiusValue * 1.5 
        }]}>
          <Text style={[styles.headerEmoji, { fontSize: 48 * fontSizeMultiplier }]}>{tracker.emoji}</Text>
          <Text style={[styles.headerTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>{tracker.name}</Text>
          <Text style={[styles.headerDesc, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>{tracker.description}</Text>
          
          {/* Streak badge */}
          {streak && <StreakBadge streak={streak} color={tracker.color} />}
          
          {/* Time context */}
          <TimeContextBadge timeContext={timeContext} color={tracker.color} colors={fullThemeColors} />
          
          {/* Linked entry indicator */}
          {linkedEntryId && (
            <View style={[styles.linkedBadge, { backgroundColor: `${tracker.color}20` }]}>
              <Ionicons name="link-outline" size={14} color={tracker.color} />
              <Text style={[styles.linkedText, { color: tracker.color }]}>Linked to previous entry</Text>
            </View>
          )}
        </View>
        
        {/* Active Correlation Banners */}
        {visibleCorrelations.length > 0 && (
          <View style={styles.correlationsSection}>
            {visibleCorrelations.slice(0, 2).map(correlation => (
              <CorrelationBanner
                key={correlation.id}
                correlation={correlation}
                colors={fullThemeColors}
                borderRadiusValue={borderRadiusValue}
                onAction={() => {
                  if (correlation.prefillData) {
                    Object.keys(correlation.prefillData).forEach(key => userEditedFields.current.add(key));
                    setData(prev => ({ ...prev, ...correlation.prefillData }));
                  }
                }}
                onDismiss={() => setDismissedCorrelations(prev => new Set(prev).add(correlation.id))}
              />
            ))}
          </View>
        )}
        
        {/* Smart Insights */}
        {showInsights && visibleInsights.length > 0 && (
          <View style={styles.insightsSection}>
            {visibleInsights.slice(0, 2).map(insight => (
              <InsightCard
                key={insight.id}
                insight={insight}
                colors={fullThemeColors}
                borderRadiusValue={borderRadiusValue}
                onAction={() => {}}
                onDismiss={() => setDismissedInsights(prev => new Set(prev).add(insight.id))}
              />
            ))}
          </View>
        )}
        
        {/* Yesterday's Data / Prefill */}
        {prefillData && Object.keys(prefillData).length > 0 && (
          <YesterdayPreview
            tracker={tracker}
            prefillData={prefillData}
            onApply={applyYesterdayData}
            colors={fullThemeColors}
            borderRadiusValue={borderRadiusValue}
          />
        )}
        
        {/* Dynamic Fields */}
        <View style={styles.formBody}>
          {tracker.fields.map(renderField)}
        </View>
        
        {/* Notes */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textarea, { 
              borderColor: fullThemeColors.border,
              borderRadius: borderRadiusValue,
              backgroundColor: fullThemeColors.surface,
              color: fullThemeColors.text,
              fontSize: 16 * fontSizeMultiplier,
              minHeight: 100 * fontSizeMultiplier,
            }]}
            multiline
            numberOfLines={3}
            placeholder="Anything else to note..."
            placeholderTextColor={fullThemeColors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </View>
        
        {/* Quick Tags */}
        {tracker.quickTags?.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>Quick Tags</Text>
            <View style={styles.tagsWrap}>
              {tracker.quickTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, {
                    backgroundColor: selectedTags.includes(tag) ? tracker.color : fullThemeColors.surface,
                    borderColor: selectedTags.includes(tag) ? tracker.color : fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                  }]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, { color: selectedTags.includes(tag) ? '#fff' : fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
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
              style={[styles.cancelBtn, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelText, { color: fullThemeColors.textSecondary, fontSize: 16 * fontSizeMultiplier }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.submitBtn, { 
              backgroundColor: tracker.gradient[0], 
              borderRadius: borderRadiusValue,
              opacity: isSubmitting ? 0.7 : 1,
            }]}
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
    gap: 12,
    padding: 14,
    borderRadius: 16,
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
  correlationDismiss: { padding: 4 },
  
  insightsSection: { padding: 16, paddingBottom: 0, gap: 10 },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  insightEmoji: { fontSize: 24 },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontSize: 15, fontWeight: '700' },
  insightDesc: { fontSize: 13, lineHeight: 18 },
  insightAction: { marginTop: 4 },
  insightActionText: { fontSize: 13, fontWeight: '600' },
  insightDismiss: { padding: 4 },
  
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
  yesterdaySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  yesterdaySelectText: { fontSize: 13, fontWeight: '500' },
  
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  durationText: { fontWeight: '700', minWidth: 80, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6 },
  presetText: { fontSize: 13 },
  
  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  
  moodRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  moodBtn: { 
    padding: 12, 
    alignItems: 'center',
    position: 'relative',
  },
  moodEmoji: { fontSize: 32 },
  yesterdayIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
    padding: 2,
  },
  
  slider: { width: '100%', height: 40, marginTop: 8 },
  
  photoUpload: {
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: { marginTop: 8, fontSize: 14 },
  
  tempRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, paddingHorizontal: 16 },
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
