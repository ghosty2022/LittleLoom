// src/components/trackers/DynamicTrackerForm.tsx
// MODERNIZED: SweetAlert, SafeAvatar, full useCustomization integration
// Renders ANY tracker (default or custom) based on its schema — no per-tracker components needed

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Animated, { FadeInUp } from 'react-native-reanimated';

import {
  UnifiedTrackerConfig,
  FieldConfig,
  FieldOption,
  FieldType,
} from '../../types/trackers';
import { useTracker } from '../../context/TrackerContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar, SafeBabyAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

interface DynamicTrackerFormProps {
  tracker: UnifiedTrackerConfig;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>, options: {
    title?: string;
    notes?: string;
    photoUris?: string[];
    tags?: string[];
  }) => void;
  onCancel?: () => void;
}

const MOOD_EMOJIS = ['😭', '😟', '😐', '🙂', '😄'];

export const DynamicTrackerForm: React.FC<DynamicTrackerFormProps> = ({
  tracker,
  initialData = {},
  onSubmit,
  onCancel,
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
  const { success, error } = useSweetAlert();
  const { currentBaby } = useTracker();

  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  // Check conditional visibility
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

  // Validate all visible required fields
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

  const handleSubmit = useCallback(() => {
    if (!validate()) {
      triggerHaptic('error');
      error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    triggerHaptic('success');
    onSubmit(data, {
      notes: notes || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      photoUris: photoUris.length > 0 ? photoUris : undefined,
    });
  }, [validate, data, notes, selectedTags, photoUris, onSubmit, triggerHaptic, error]);

  const updateField = useCallback((fieldId: string, value: unknown) => {
    setData(prev => ({ ...prev, [fieldId]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  // ─── Theme-aware input styles ───
  const inputStyle = useMemo(() => ({
    borderWidth: 1,
    borderColor: fullThemeColors.border,
    borderRadius: borderRadiusValue,
    padding: 14,
    fontSize: 16 * fontSizeMultiplier,
    backgroundColor: fullThemeColors.surface,
    color: fullThemeColors.text,
  }), [fullThemeColors, borderRadiusValue, fontSizeMultiplier]);

  const inputErrorStyle = useMemo(() => ({
    borderColor: fullThemeColors.error,
    backgroundColor: fullThemeColors.error + '15',
  }), [fullThemeColors.error]);

  // ─── Field Renderers (modernized with theme) ───
  const renderTextField = (field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {field.required && <Text style={[styles.required, { color: fullThemeColors.error }]}> *</Text>}
      </Text>
      <TextInput
        style={[inputStyle, errors[field.id] && inputErrorStyle]}
        placeholder={field.placeholder}
        placeholderTextColor={fullThemeColors.textSecondary}
        value={String(data[field.id] || '')}
        onChangeText={text => updateField(field.id, text)}
      />
      {field.unit && <Text style={[styles.unit, { color: fullThemeColors.textSecondary }]}>{field.unit}</Text>}
      {errors[field.id] && <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{errors[field.id]}</Text>}
    </View>
  );

  const renderNumberField = (field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {field.required && <Text style={[styles.required, { color: fullThemeColors.error }]}> *</Text>}
      </Text>
      <View style={[styles.numberRow, { borderColor: errors[field.id] ? fullThemeColors.error : fullThemeColors.border, borderRadius: borderRadiusValue, backgroundColor: fullThemeColors.surface }]}>
        <TextInput
          style={[styles.numberInput, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]}
          keyboardType="numeric"
          placeholder={field.placeholder || '0'}
          placeholderTextColor={fullThemeColors.textSecondary}
          value={String(data[field.id] || '')}
          onChangeText={text => {
            const num = parseFloat(text);
            updateField(field.id, isNaN(num) ? text : num);
          }}
        />
        {field.unit && <Text style={[styles.unitLabel, { color: fullThemeColors.textSecondary }]}>{field.unit}</Text>}
      </View>
      {errors[field.id] && <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{errors[field.id]}</Text>}
    </View>
  );

  const renderSelectField = (field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {field.required && <Text style={[styles.required, { color: fullThemeColors.error }]}> *</Text>}
      </Text>
      <View style={styles.optionsRow}>
        {field.options?.map((option: FieldOption) => {
          const isSelected = data[field.id] === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionChip,
                {
                  backgroundColor: isSelected ? `${tracker.color}20` : fullThemeColors.surface,
                  borderColor: isSelected ? tracker.color : fullThemeColors.border,
                  borderRadius: borderRadiusValue,
                },
              ]}
              onPress={() => {
                triggerHaptic('light');
                updateField(field.id, option.id);
              }}
            >
              {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
              <Text style={[
                styles.optionLabel,
                { color: isSelected ? tracker.color : fullThemeColors.textSecondary },
                isSelected && { fontWeight: '600' },
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {errors[field.id] && <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{errors[field.id]}</Text>}
    </View>
  );

  const renderMultiselectField = (field: FieldConfig) => {
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
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: isSelected ? `${tracker.color}20` : fullThemeColors.surface,
                    borderColor: isSelected ? tracker.color : fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  const newSelected = isSelected
                    ? selected.filter(id => id !== option.id)
                    : [...selected, option.id];
                  updateField(field.id, newSelected);
                }}
              >
                {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                <Text style={[
                  styles.optionLabel,
                  { color: isSelected ? tracker.color : fullThemeColors.textSecondary },
                  isSelected && { fontWeight: '600' },
                ]}>
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
  };

  const renderToggleField = (field: FieldConfig) => (
    <View key={field.id} style={[styles.toggleContainer, { borderBottomColor: fullThemeColors.border }]}>
      <Text style={[styles.toggleLabel, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
      <Switch
        value={Boolean(data[field.id])}
        onValueChange={value => {
          triggerHaptic('light');
          updateField(field.id, value);
        }}
        trackColor={{ false: fullThemeColors.border, true: `${tracker.color}80` }}
        thumbColor={data[field.id] ? tracker.color : fullThemeColors.textSecondary}
      />
    </View>
  );

  const renderDurationField = (field: FieldConfig) => {
    const minutes = Math.floor((Number(data[field.id]) || 0) / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
        <View style={styles.durationRow}>
          <TouchableOpacity
            style={[styles.durationBtn, { backgroundColor: fullThemeColors.surface }]}
            onPress={() => {
              const current = Number(data[field.id]) || 0;
              updateField(field.id, Math.max(0, current - 300));
              triggerHaptic('light');
            }}
          >
            <Ionicons name="remove" size={20} color={tracker.color} />
          </TouchableOpacity>
          <Text style={[styles.durationText, { color: fullThemeColors.text, fontSize: 24 * fontSizeMultiplier }]}>
            {hours > 0 ? `${hours}h ` : ''}{mins}m
          </Text>
          <TouchableOpacity
            style={[styles.durationBtn, { backgroundColor: fullThemeColors.surface }]}
            onPress={() => {
              const current = Number(data[field.id]) || 0;
              updateField(field.id, current + 300);
              triggerHaptic('light');
            }}
          >
            <Ionicons name="add" size={20} color={tracker.color} />
          </TouchableOpacity>
        </View>
        <View style={styles.presetRow}>
          {[5, 10, 15, 30, 45, 60].map(mins => (
            <TouchableOpacity
              key={mins}
              style={[styles.presetChip, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue / 2 }]}
              onPress={() => {
                updateField(field.id, mins * 60);
                triggerHaptic('light');
              }}
            >
              <Text style={[styles.presetText, { color: fullThemeColors.textSecondary }]}>{mins}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderRatingField = (field: FieldConfig) => {
    const max = field.max || 5;
    const value = Number(data[field.id]) || 0;
    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
        <View style={styles.ratingRow}>
          {Array.from({ length: max }, (_, i) => i + 1).map(star => (
            <TouchableOpacity
              key={star}
              onPress={() => {
                triggerHaptic('light');
                updateField(field.id, star);
              }}
            >
              <Ionicons
                name={star <= value ? 'star' : 'star-outline'}
                size={32}
                color={star <= value ? fullThemeColors.warning : fullThemeColors.border}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderTextareaField = (field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
      <TextInput
        style={[inputStyle, styles.textarea, errors[field.id] && inputErrorStyle, { minHeight: 100 * fontSizeMultiplier }]}
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
  );

  const renderMoodField = (field: FieldConfig) => {
    const value = Number(data[field.id]) || 3;
    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
        <View style={styles.moodRow}>
          {MOOD_EMOJIS.map((emoji, index) => {
            const moodValue = index + 1;
            const isSelected = value === moodValue;
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.moodBtn,
                  isSelected && { backgroundColor: `${tracker.color}15`, transform: [{ scale: 1.2 }] },
                  { borderRadius: borderRadiusValue },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  updateField(field.id, moodValue);
                }}
              >
                <Text style={[styles.moodEmoji, isSelected && { fontSize: 40 }]}>
                  {emoji}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSliderField = (field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}: {String(data[field.id] || field.min || 0)}
        {field.unit}
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
  );

  const renderPhotoField = (field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
      <TouchableOpacity style={[styles.photoUpload, { borderColor: fullThemeColors.border, borderRadius: borderRadiusValue, backgroundColor: fullThemeColors.surface }]}>
        <Ionicons name="camera-outline" size={32} color={tracker.color} />
        <Text style={[styles.photoText, { color: fullThemeColors.textSecondary }]}>Tap to add photo</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTemperatureField = (field: FieldConfig) => (
    <View key={field.id} style={styles.fieldContainer}>
      <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
        {field.label}
        {field.required && <Text style={[styles.required, { color: fullThemeColors.error }]}> *</Text>}
      </Text>
      <View style={[styles.tempRow, { borderColor: errors[field.id] ? fullThemeColors.error : fullThemeColors.border, borderRadius: borderRadiusValue, backgroundColor: fullThemeColors.surface }]}>
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
              style={[
                styles.tempUnitBtn,
                data[`${field.id}_unit`] === unit && { backgroundColor: tracker.color, borderRadius: borderRadiusValue / 3 },
              ]}
              onPress={() => updateField(`${field.id}_unit`, unit)}
            >
              <Text style={[
                styles.tempUnitText,
                { color: data[`${field.id}_unit`] === unit ? '#fff' : fullThemeColors.textSecondary },
              ]}>
                {unit === 'celsius' ? '°C' : '°F'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {errors[field.id] && <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{errors[field.id]}</Text>}
    </View>
  );

  // ─── Field Router ───
  const renderField = useCallback((field: FieldConfig) => {
    if (!isFieldVisible(field)) return null;

    const animatedWrapper = (children: React.ReactNode) => (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50)}>
        {children}
      </Animated.View>
    );

    switch (field.type) {
      case 'text': return animatedWrapper(renderTextField(field));
      case 'number': return animatedWrapper(renderNumberField(field));
      case 'select': return animatedWrapper(renderSelectField(field));
      case 'multiselect': return animatedWrapper(renderMultiselectField(field));
      case 'toggle': return animatedWrapper(renderToggleField(field));
      case 'duration': return animatedWrapper(renderDurationField(field));
      case 'rating': return animatedWrapper(renderRatingField(field));
      case 'textarea': return animatedWrapper(renderTextareaField(field));
      case 'mood_emoji': return animatedWrapper(renderMoodField(field));
      case 'slider': return animatedWrapper(renderSliderField(field));
      case 'photo': return animatedWrapper(renderPhotoField(field));
      case 'temperature': return animatedWrapper(renderTemperatureField(field));
      default: return animatedWrapper(renderTextField(field));
    }
  }, [data, errors, isFieldVisible, tracker.color, fullThemeColors, borderRadiusValue, fontSizeMultiplier, shouldReduceMotion]);

  // ─── Quick Tags ───
  const toggleTag = useCallback((tag: string) => {
    triggerHaptic('light');
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, [triggerHaptic]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: fullThemeColors.background }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with SafeAvatar */}
        <View style={[styles.header, { backgroundColor: tracker.gradient[0] + '15', borderBottomLeftRadius: borderRadiusValue * 1.5, borderBottomRightRadius: borderRadiusValue * 1.5 }]}>
          <SafeAvatar
            avatar={currentBaby?.avatar}
            size={48}
            fallbackIcon="person"
            borderColor={tracker.gradient[0]}
            borderWidth={2}
            animated={false}
          />
          <Text style={[styles.headerEmoji, { fontSize: 48 * fontSizeMultiplier }]}>{tracker.emoji}</Text>
          <Text style={[styles.headerTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>{tracker.name}</Text>
          <Text style={[styles.headerDesc, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>{tracker.description}</Text>
        </View>

        {/* Dynamic Fields */}
        <View style={styles.formBody}>
          {tracker.fields.map(renderField)}
        </View>

        {/* Notes */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>Additional Notes</Text>
          <TextInput
            style={[inputStyle, styles.textarea, { minHeight: 100 * fontSizeMultiplier }]}
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
        {tracker.quickTags.length > 0 && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>Quick Tags</Text>
            <View style={styles.tagsWrap}>
              {tracker.quickTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selectedTags.includes(tag) ? tracker.color : fullThemeColors.surface,
                      borderColor: selectedTags.includes(tag) ? tracker.color : fullThemeColors.border,
                      borderRadius: borderRadiusValue,
                    },
                  ]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[
                    styles.tagText,
                    { color: selectedTags.includes(tag) ? '#fff' : fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier },
                  ]}>
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
            style={[styles.submitBtn, { backgroundColor: tracker.gradient[0], borderRadius: borderRadiusValue }]}
            onPress={handleSubmit}
          >
            <Text style={[styles.submitText, { fontSize: 16 * fontSizeMultiplier }]}>Save {tracker.emoji}</Text>
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
  formBody: { padding: 16 },
  fieldContainer: { marginBottom: 20 },
  label: { fontWeight: '600', marginBottom: 8 },
  required: { fontWeight: '700' },
  unit: { position: 'absolute', right: 16, top: 46 },
  errorText: { fontSize: 12, marginTop: 4 },
  numberRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingRight: 16 },
  numberInput: { flex: 1, padding: 14, fontWeight: '500' },
  unitLabel: { marginLeft: 12, fontWeight: '500' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
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
    gap: 20,
  },
  durationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: { fontWeight: '700', minWidth: 80, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6 },
  presetText: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  textarea: { textAlignVertical: 'top' },
  moodRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  moodBtn: { padding: 12, alignItems: 'center' },
  moodEmoji: { fontSize: 32 },
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
});

export default DynamicTrackerForm;