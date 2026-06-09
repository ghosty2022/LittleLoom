// src/components/trackers/CreateCustomTrackerScreen.tsx
// MODERNIZED: SweetAlert, SafeAvatar, full useCustomization integration
// Parents & Guardians can create their own trackers — no coding required

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import {
  TrackerCategory,
  FieldConfig,
  FieldType,
  FieldOption,
} from '../../types/trackers';
import { useTracker } from '../../context/TrackerContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

const CATEGORIES: { id: TrackerCategory; emoji: string; label: string }[] = [
  { id: 'essential', emoji: '⭐', label: 'Essential Daily' },
  { id: 'health', emoji: '🏥', label: 'Health' },
  { id: 'development', emoji: '🧠', label: 'Development' },
  { id: 'emotional', emoji: '❤️', label: 'Emotional' },
  { id: 'physical', emoji: '💅', label: 'Physical Care' },
  { id: 'nutrition', emoji: '🍎', label: 'Nutrition' },
  { id: 'safety', emoji: '🛡️', label: 'Safety' },
  { id: 'schedule', emoji: '⏰', label: 'Schedule' },
  { id: 'parental', emoji: '👨‍👩‍👧', label: 'Parental' },
  { id: 'travel', emoji: '✈️', label: 'Travel' },
  { id: 'special_needs', emoji: '♿', label: 'Special Needs' },
  { id: 'custom', emoji: '✨', label: 'Custom Category' },
];

const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Short Text', icon: 'text-outline' },
  { type: 'textarea', label: 'Long Text', icon: 'reader-outline' },
  { type: 'number', label: 'Number', icon: 'calculator-outline' },
  { type: 'select', label: 'Single Choice', icon: 'radio-button-on-outline' },
  { type: 'multiselect', label: 'Multiple Choice', icon: 'checkbox-outline' },
  { type: 'toggle', label: 'Yes/No Toggle', icon: 'toggle-outline' },
  { type: 'duration', label: 'Duration', icon: 'time-outline' },
  { type: 'rating', label: 'Star Rating', icon: 'star-outline' },
  { type: 'slider', label: 'Slider', icon: 'options-outline' },
  { type: 'temperature', label: 'Temperature', icon: 'thermometer-outline' },
  { type: 'photo', label: 'Photo', icon: 'camera-outline' },
  { type: 'mood_emoji', label: 'Mood Emoji', icon: 'happy-outline' },
];

export const CreateCustomTrackerScreen: React.FC = () => {
  const navigation = useNavigation();
  const { createCustomTracker, currentBaby } = useTracker();
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
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [category, setCategory] = useState<TrackerCategory>('custom');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [quickTags, setQuickTags] = useState('');

  // Field builder state
  const [showFieldBuilder, setShowFieldBuilder] = useState(false);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldUnit, setFieldUnit] = useState('');
  const [optionsText, setOptionsText] = useState('');

  const emojis = ['📝', '💊', '🍼', '😴', '🛁', '📏', '🌡️', '💩', '🤱', '🏆', '🎵', '📚', '🌳', '👋', '💬', '❤️', '😭', '😌', '💅', '🦷', '👂', '👃', '🥄', '💧', '✈️', '🚗', '🏫', '👤', '😣', '😰', '💨', '🔴', '🎯', '🎨', '🧩', '⚽', '🎸', '📸', '🎥', '🎙️', '⭐', '🔥', '❄️', '💎', '🌈', '🍀', '🦋', '🦄', '🚀', '💡'];

  const addField = useCallback(() => {
    if (!fieldLabel.trim()) {
      error('Missing Label', 'Please enter a field label');
      return;
    }

    let options: FieldOption[] | undefined;
    if ((fieldType === 'select' || fieldType === 'multiselect') && optionsText.trim()) {
      options = optionsText.split(',').map((opt, i) => ({
        id: `opt_${i}_${Date.now()}`,
        label: opt.trim(),
      }));
    }

    const newField: FieldConfig = {
      id: `field_${fields.length}_${Date.now()}`,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      ...(fieldUnit && { unit: fieldUnit }),
      ...(options && { options }),
    };

    setFields(prev => [...prev, newField]);
    setFieldLabel('');
    setFieldRequired(false);
    setFieldUnit('');
    setOptionsText('');
    setShowFieldBuilder(false);
    triggerHaptic('success');
    success('Field Added', `"${newField.label}" added to your tracker`);
  }, [fieldLabel, fieldType, fieldRequired, fieldUnit, optionsText, fields.length, error, success, triggerHaptic]);

  const removeField = useCallback((index: number) => {
    triggerHaptic('light');
    setFields(prev => prev.filter((_, i) => i !== index));
  }, [triggerHaptic]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      error('Missing Name', 'Please enter a tracker name');
      return;
    }
    if (fields.length === 0) {
      error('No Fields', 'Add at least one field to your tracker');
      return;
    }

    const tags = quickTags.split(',').map(t => t.trim()).filter(Boolean);
    
    const tracker = await createCustomTracker(
      name.trim(),
      emoji,
      category,
      fields,
      {
        description: description.trim() || undefined,
        quickTags: tags.length > 0 ? tags : undefined,
      }
    );

    if (tracker) {
      triggerHaptic('success');
      success('Success!', `Your tracker "${tracker.name}" is ready to use.`);
      navigation.goBack();
    }
  }, [name, emoji, category, description, fields, quickTags, createCustomTracker, navigation, error, success, triggerHaptic]);

  const inputStyle = {
    borderWidth: 1,
    borderColor: fullThemeColors.border,
    borderRadius: borderRadiusValue,
    padding: 14,
    fontSize: 16 * fontSizeMultiplier,
    backgroundColor: fullThemeColors.surface,
    color: fullThemeColors.text,
  };

  const renderStep1 = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp}>
      <Text style={[styles.stepTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>Step 1: Basic Info</Text>
      
      <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>Tracker Name *</Text>
      <TextInput
        style={inputStyle}
        placeholder="e.g., Physical Therapy"
        placeholderTextColor={fullThemeColors.textSecondary}
        value={name}
        onChangeText={setName}
      />

      <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier, marginTop: 16 }]}>Choose an Emoji</Text>
      <View style={styles.emojiGrid}>
        {emojis.map(e => (
          <TouchableOpacity
            key={e}
            style={[
              styles.emojiBtn,
              {
                backgroundColor: emoji === e ? `${themeColors.primary}20` : fullThemeColors.surface,
                borderColor: emoji === e ? themeColors.primary : fullThemeColors.border,
                borderRadius: borderRadiusValue,
              },
            ]}
            onPress={() => {
              triggerHaptic('light');
              setEmoji(e);
            }}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier, marginTop: 16 }]}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryBtn,
              {
                backgroundColor: category === cat.id ? `${themeColors.primary}15` : fullThemeColors.surface,
                borderColor: category === cat.id ? themeColors.primary : fullThemeColors.border,
                borderRadius: borderRadiusValue,
              },
            ]}
            onPress={() => {
              triggerHaptic('light');
              setCategory(cat.id);
            }}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[
              styles.categoryText,
              { color: category === cat.id ? themeColors.primary : fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier },
              category === cat.id && { fontWeight: '600' },
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier, marginTop: 16 }]}>Description (optional)</Text>
      <TextInput
        style={[inputStyle, styles.textarea, { minHeight: 80 * fontSizeMultiplier }]}
        placeholder="What will you track?"
        placeholderTextColor={fullThemeColors.textSecondary}
        multiline
        value={description}
        onChangeText={setDescription}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: themeColors.primary, borderRadius: borderRadiusValue, marginTop: 24 }]}
        onPress={() => {
          triggerHaptic('medium');
          setStep(2);
        }}
      >
        <Text style={[styles.nextText, { fontSize: 16 * fontSizeMultiplier }]}>Next: Build Fields →</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp}>
      <Text style={[styles.stepTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>Step 2: Build Fields</Text>
      <Text style={[styles.hint, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>Add the fields you want to fill in each time</Text>

      {/* Existing fields */}
      {fields.map((field, index) => (
        <View
          key={field.id}
          style={[
            styles.fieldCard,
            { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue, borderColor: fullThemeColors.border, borderWidth: 1 },
          ]}
        >
          <View style={styles.fieldHeader}>
            <View>
              <Text style={[styles.fieldLabel, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>{field.label}</Text>
              <Text style={[styles.fieldType, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
                {field.type} {field.required && '• Required'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removeField(index)}
              style={[styles.removeFieldBtn, { backgroundColor: fullThemeColors.error + '15', borderRadius: borderRadiusValue / 2 }]}
            >
              <Ionicons name="trash-outline" size={20} color={fullThemeColors.error} />
            </TouchableOpacity>
          </View>
          {field.options && (
            <Text style={[styles.fieldOptions, { color: fullThemeColors.textSecondary, fontSize: 12 * fontSizeMultiplier }]}>
              Options: {field.options.map(o => o.label).join(', ')}
            </Text>
          )}
        </View>
      ))}

      {/* Add field button */}
      {!showFieldBuilder ? (
        <TouchableOpacity
          style={[styles.addFieldBtn, { borderColor: `${themeColors.primary}30`, borderRadius: borderRadiusValue }]}
          onPress={() => {
            triggerHaptic('light');
            setShowFieldBuilder(true);
          }}
        >
          <Ionicons name="add-circle" size={24} color={themeColors.primary} />
          <Text style={[styles.addFieldText, { color: themeColors.primary, fontSize: 16 * fontSizeMultiplier }]}>Add Field</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.fieldBuilder, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue, borderColor: fullThemeColors.border, borderWidth: 1 }]}>
          <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>Field Label *</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g., Exercise Type"
            placeholderTextColor={fullThemeColors.textSecondary}
            value={fieldLabel}
            onChangeText={setFieldLabel}
          />

          <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier, marginTop: 16 }]}>Field Type</Text>
          <View style={styles.typeGrid}>
            {FIELD_TYPES.map(ft => (
              <TouchableOpacity
                key={ft.type}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: fieldType === ft.type ? `${themeColors.primary}15` : fullThemeColors.glassBg,
                    borderColor: fieldType === ft.type ? themeColors.primary : fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setFieldType(ft.type);
                }}
              >
                <Ionicons name={ft.icon as any} size={20} color={fieldType === ft.type ? themeColors.primary : fullThemeColors.textSecondary} />
                <Text style={[
                  styles.typeText,
                  { color: fieldType === ft.type ? themeColors.primary : fullThemeColors.textSecondary, fontSize: 11 * fontSizeMultiplier },
                  fieldType === ft.type && { fontWeight: '600' },
                ]}>
                  {ft.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(fieldType === 'select' || fieldType === 'multiselect') && (
            <>
              <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier, marginTop: 16 }]}>Options (comma-separated)</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g., Stretching, Strengthening, Massage"
                placeholderTextColor={fullThemeColors.textSecondary}
                value={optionsText}
                onChangeText={setOptionsText}
              />
            </>
          )}

          {(fieldType === 'number') && (
            <>
              <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier, marginTop: 16 }]}>Unit (optional)</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g., reps, min, lbs"
                placeholderTextColor={fullThemeColors.textSecondary}
                value={fieldUnit}
                onChangeText={setFieldUnit}
              />
            </>
          )}

          <View style={styles.toggleRow}>
            <Text style={{ color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }}>Required field?</Text>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                { backgroundColor: fieldRequired ? themeColors.primary : fullThemeColors.border, borderRadius: borderRadiusValue / 2 },
              ]}
              onPress={() => {
                triggerHaptic('light');
                setFieldRequired(!fieldRequired);
              }}
            >
              <Ionicons name={fieldRequired ? 'checkmark' : 'close'} size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.builderActions}>
            <TouchableOpacity
              style={[styles.cancelBuilderBtn, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]}
              onPress={() => setShowFieldBuilder(false)}
            >
              <Text style={[styles.cancelBuilderText, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBuilderBtn, { backgroundColor: themeColors.primary, borderRadius: borderRadiusValue }]}
              onPress={addField}
            >
              <Text style={[styles.addBuilderText, { color: '#fff', fontSize: 14 * fontSizeMultiplier }]}>Add Field</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.stepNav}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]}
          onPress={() => {
            triggerHaptic('light');
            setStep(1);
          }}
        >
          <Text style={[styles.backText, { color: fullThemeColors.textSecondary, fontSize: 16 * fontSizeMultiplier }]}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: themeColors.primary, borderRadius: borderRadiusValue }]}
          onPress={() => {
            triggerHaptic('medium');
            setStep(3);
          }}
        >
          <Text style={[styles.nextText, { color: '#fff', fontSize: 16 * fontSizeMultiplier }]}>Next: Finalize →</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp}>
      <Text style={[styles.stepTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>Step 3: Finalize</Text>

      <Text style={[styles.label, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>Quick Tags (comma-separated)</Text>
      <TextInput
        style={inputStyle}
        placeholder="e.g., Good session, Struggled, Milestone"
        placeholderTextColor={fullThemeColors.textSecondary}
        value={quickTags}
        onChangeText={setQuickTags}
      />

      {/* Preview */}
      <View style={[styles.previewCard, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue, borderColor: fullThemeColors.border, borderWidth: 1 }]}>
        <Text style={[styles.previewTitle, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>Preview</Text>
        <View style={styles.previewHeader}>
          <SafeAvatar
            avatar={currentBaby?.avatar}
            size={40}
            fallbackIcon="person"
            borderColor={themeColors.primary}
            borderWidth={2}
            animated={false}
          />
          <View>
            <Text style={[styles.previewName, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>{name || 'Untitled Tracker'}</Text>
            <Text style={[styles.previewCategory, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
              {CATEGORIES.find(c => c.id === category)?.label}
            </Text>
          </View>
        </View>
        <Text style={[styles.previewFields, { color: fullThemeColors.textSecondary, fontSize: 14 * fontSizeMultiplier }]}>
          {fields.length} fields configured
        </Text>
      </View>

      <View style={styles.stepNav}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: fullThemeColors.glassBg, borderRadius: borderRadiusValue }]}
          onPress={() => {
            triggerHaptic('light');
            setStep(2);
          }}
        >
          <Text style={[styles.backText, { color: fullThemeColors.textSecondary, fontSize: 16 * fontSizeMultiplier }]}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.createBtn,
            { backgroundColor: name.trim() ? themeColors.primary : fullThemeColors.border, borderRadius: borderRadiusValue },
          ]}
          onPress={handleCreate}
          disabled={!name.trim()}
        >
          <Text style={[styles.createText, { color: '#fff', fontSize: 16 * fontSizeMultiplier }]}>✨ Create Tracker</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: fullThemeColors.background }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with SafeAvatar */}
        <View style={[styles.header, { backgroundColor: themeColors.primary }]}>
          <SafeAvatar
            avatar={currentBaby?.avatar}
            size={48}
            fallbackIcon="person"
            borderColor="#ffffff80"
            borderWidth={2}
            animated={false}
          />
          <Text style={[styles.headerTitle, { color: '#fff', fontSize: 28 * fontSizeMultiplier }]}>Create Custom Tracker</Text>
          <Text style={[styles.headerSubtitle, { color: '#ffffff80', fontSize: 16 * fontSizeMultiplier }]}>
            Build a tracker for anything you need
          </Text>
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map(s => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor: step >= s ? themeColors.primary : fullThemeColors.border,
                  width: step >= s ? 24 : 10,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.content}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 60, alignItems: 'center', gap: 12 },
  headerTitle: { fontWeight: '800' },
  headerSubtitle: { marginTop: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  progressDot: { height: 10, borderRadius: 5 },
  content: { padding: 20, paddingBottom: 40 },
  stepTitle: { fontWeight: '700', marginBottom: 16 },
  hint: { marginBottom: 20 },
  label: { fontWeight: '600', marginBottom: 8, marginTop: 16 },
  textarea: { textAlignVertical: 'top' },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  emojiText: { fontSize: 24 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  categoryEmoji: { fontSize: 16 },
  categoryText: { fontWeight: '500' },
  nextBtn: { padding: 16, alignItems: 'center' },
  nextText: { color: '#fff', fontWeight: '700' },
  fieldCard: {
    padding: 14,
    marginBottom: 10,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: { fontWeight: '600' },
  fieldType: { marginTop: 2 },
  fieldOptions: { marginTop: 6, fontStyle: 'italic' },
  removeFieldBtn: { padding: 6 },
  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  addFieldText: { fontWeight: '600' },
  fieldBuilder: {
    padding: 16,
    marginBottom: 16,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1.5,
    gap: 4,
  },
  typeText: { textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBuilderBtn: { flex: 1, padding: 14, alignItems: 'center' },
  cancelBuilderText: { fontWeight: '600' },
  addBuilderBtn: { flex: 1, padding: 14, alignItems: 'center' },
  addBuilderText: { color: '#fff', fontWeight: '700' },
  stepNav: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  backBtn: { flex: 1, padding: 16, alignItems: 'center' },
  backText: { fontWeight: '600' },
  createBtn: { flex: 2, padding: 16, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.5 },
  createText: { color: '#fff', fontWeight: '700' },
  previewCard: {
    padding: 20,
    marginTop: 16,
  },
  previewTitle: { fontWeight: '600', marginBottom: 12 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewName: { fontWeight: '700' },
  previewCategory: { marginTop: 2 },
  previewFields: { marginTop: 12 },
});

export default CreateCustomTrackerScreen;
