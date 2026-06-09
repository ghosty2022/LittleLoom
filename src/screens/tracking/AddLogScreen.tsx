// src/screens/tracking/AddLogScreen.tsx
// MODERNIZED: SweetAlert, SafeAvatar, full useCustomization integration
// Universal dynamic form — glassmorphism, gradients, haptics preserved

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  Modal,
  Dimensions,
  Image,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useTracker } from '../../context/TrackerContext';
import { TrackerConfig, TrackerField, TrackerFieldType } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

type AddLogRouteProp = RouteProp<RootStackParamList, 'AddLog'>;
type AddLogNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// ─── Confirmation Modal (modernized with SafeAvatar) ───
interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: Record<string, unknown>;
  tracker: TrackerConfig;
  babyName: string;
  babyAvatar?: string;
  date: Date;
  notes?: string;
  tags: string[];
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible, onClose, onConfirm, data, tracker, babyName, babyAvatar, date, notes, tags,
}) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withSpring(1);
    } else {
      scale.value = 0.8;
      opacity.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const formatValue = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const previewData = Object.entries(data).filter(([key, value]) => {
    if (['id', 'timestamp', 'babyId', 'type', 'title', 'icon', 'photoUris'].includes(key)) return false;
    return formatValue(key, value) !== null;
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: fullThemeColors.shadow + '80' }]}>
        <Animated.View style={[styles.modalContent, animatedStyle, { borderRadius: borderRadiusValue * 2 }]}>
          <LinearGradient colors={[fullThemeColors.surface, fullThemeColors.background]} style={[styles.modalGradient, { borderRadius: borderRadiusValue * 2 }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: `${tracker.gradient[0]}20`, borderRadius: borderRadiusValue }]}>
                <Text style={styles.modalIcon}>{tracker.emoji}</Text>
              </View>
              <Text style={[styles.modalTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>
                Confirm {tracker.name}
              </Text>
              <View style={styles.modalBabyRow}>
                <SafeAvatar avatar={babyAvatar} size={28} fallbackIcon="person" borderWidth={0} animated={false} />
                <Text style={[styles.modalSubtitle, { color: fullThemeColors.textSecondary }]}>For {babyName}</Text>
              </View>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.previewCard, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}>
                <Text style={[styles.previewTime, { color: fullThemeColors.textSecondary }]}>
                  {format(date, 'MMM d, yyyy • h:mm a')}
                </Text>

                {data.photoUris && Array.isArray(data.photoUris) && (data.photoUris as string[]).length > 0 && (
                  <View style={[styles.previewPhotoContainer, { borderRadius: borderRadiusValue }]}>
                    <Image source={{ uri: (data.photoUris as string[])[0] }} style={styles.previewPhoto} resizeMode="cover" />
                  </View>
                )}

                <Text style={[styles.previewTitle, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>
                  {tracker.emoji} {tracker.name}
                </Text>

                {notes && <Text style={[styles.previewDetails, { color: fullThemeColors.textSecondary }]}>{notes}</Text>}

                {previewData.length > 0 && (
                  <View style={styles.previewFields}>
                    {previewData.map(([key, value]) => (
                      <View key={key} style={styles.previewField}>
                        <Text style={[styles.previewFieldLabel, { color: fullThemeColors.textSecondary }]}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Text>
                        <Text style={[styles.previewFieldValue, { color: fullThemeColors.text }]}>{formatValue(key, value)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {tags.length > 0 && (
                  <View style={styles.previewNotes}>
                    <Ionicons name="pricetag-outline" size={16} color={fullThemeColors.textSecondary} />
                    <Text style={[styles.previewNotesText, { color: fullThemeColors.textSecondary }]}>{tags.join(', ')}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={onClose} style={[styles.cancelButton, { borderRadius: borderRadiusValue }]}>
                <Text style={[styles.cancelButtonText, { color: fullThemeColors.textSecondary }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onConfirm} style={[styles.confirmButton, { borderRadius: borderRadiusValue }]}>
                <LinearGradient
                  colors={tracker.gradient}
                  style={styles.confirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Save Entry</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ───
export default function AddLogScreen() {
  const navigation = useNavigation<AddLogNavigationProp>();
  const route = useRoute<AddLogRouteProp>();
  const insets = useSafeAreaInsets();

  const {
    fullThemeColors,
    themeColors,
    isDark,
    hapticFeedback,
    reduceMotion,
    triggerHaptic,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
  } = useCustomization();
  const { getTracker, addEntry, getEntries, currentBaby } = useTracker();
  const { success, error } = useSweetAlert();

  const trackerId = route.params?.trackerId || 'potty';
  const editEntryId = route.params?.editMode ? route.params?.eventId : undefined;
  const viewMode = route.params?.viewMode;

  const tracker = getTracker(trackerId);

  // Form state
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  // Load edit data
  useEffect(() => {
    if (editEntryId) {
      const entry = getEntries(trackerId).find(e => e.id === editEntryId);
      if (entry) {
        setFormData(entry.data || {});
        setDate(new Date(entry.timestamp));
        setNotes(entry.notes || '');
        setSelectedTags(entry.tags || []);
        setPhotoUris(entry.photoUris || []);
      }
    }
  }, [editEntryId, trackerId, getEntries]);

  const recentEntries = useMemo(() => {
    return tracker ? getEntries(trackerId, 3) : [];
  }, [tracker, trackerId, getEntries]);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors.length > 0) setErrors([]);
  };

  const toggleTag = (tag: string) => {
    if (hapticFeedback) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const showAndroidPicker = useCallback((mode: 'date' | 'time') => {
    try {
      DateTimePickerAndroid.open({
        value: date,
        mode,
        is24Hour: false,
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            const currentDate = new Date(date);
            if (mode === 'date') {
              currentDate.setFullYear(selectedDate.getFullYear());
              currentDate.setMonth(selectedDate.getMonth());
              currentDate.setDate(selectedDate.getDate());
              setDate(currentDate);
              setTimeout(() => showAndroidPicker('time'), 300);
            } else {
              currentDate.setHours(selectedDate.getHours());
              currentDate.setMinutes(selectedDate.getMinutes());
              setDate(currentDate);
            }
          }
        },
      });
    } catch {
      error('Error', 'Could not open date picker.');
    }
  }, [date, error]);

  const handleDatePress = () => {
    triggerHaptic('light');
    if (Platform.OS === 'android') {
      showAndroidPicker('date');
    } else {
      setShowDatePicker(true);
    }
  };

  const handleTimePress = () => {
    triggerHaptic('light');
    if (Platform.OS === 'android') {
      showAndroidPicker('time');
    } else {
      setShowTimePicker(true);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
    if (selectedDate) setDate(selectedDate);
  };

  const handlePhotoPick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      error('Permission needed', 'Please allow access to photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setPhotoUris(prev => [...prev, result.assets[0].uri]);
      triggerHaptic('success');
    }
  };

  const handleCameraCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      error('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setPhotoUris(prev => [...prev, result.assets[0].uri]);
      triggerHaptic('success');
    }
  };

  const validateForm = (): boolean => {
    if (!tracker) return false;
    const newErrors: string[] = [];
    tracker.fields.forEach(field => {
      if (field.required) {
        const value = formData[field.id];
        const shouldShow = !field.showIf || field.showIf(formData);
        if (shouldShow && (value === undefined || value === null || value === '')) {
          newErrors.push(`${field.label} is required`);
        }
      }
    });
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const buildTitle = (): string => {
    if (!tracker) return 'Entry';
    const data = formData;
    switch (tracker.id) {
      case 'potty': return `${data.type || 'Potty'} ${data.successful ? '✓' : ''}`;
      case 'feed': return `${data.feedType || 'Feed'}${data.amount ? ` (${data.amount})` : ''}`;
      case 'sleep': return `${data.sleepType || 'Sleep'}${data.duration ? ` • ${data.duration}` : ''}`;
      case 'growth': return `${data.measurementType || 'Measurement'}: ${data.value || ''}${data.unit || ''}`;
      case 'medication': return `${data.name || 'Medicine'} ${data.dosage || ''}`;
      case 'milestone': return `🌟 ${data.title || 'New Milestone'}`;
      case 'diaper': return `${data.type || 'Diaper'} Change`;
      case 'temperature': return `🌡️ ${data.value || ''}${data.unit === 'fahrenheit' ? '°F' : '°C'}`;
      case 'note': return data.title || 'Note';
      default: return `${tracker.emoji} ${tracker.name}`;
    }
  };

  const handleSave = () => {
    if (!validateForm()) {
      triggerHaptic('error');
      error('Validation Error', 'Please fill in all required fields.');
      return;
    }
    setShowConfirmation(true);
  };

  const confirmSave = async () => {
    try {
      const entry = await addEntry(trackerId, formData, {
        title: buildTitle(),
        notes,
        tags: selectedTags,
        photoUris: photoUris.length > 0 ? photoUris : undefined,
        timestamp: date.getTime(),
      });

      if (entry) {
        triggerHaptic('success');
        setShowConfirmation(false);
        success('Saved!', `${tracker?.name} entry added successfully.`);
        navigation.goBack();
      }
    } catch {
      error('Error', 'Failed to save entry. Please try again.');
    }
  };

  // ─── Render Field (modernized with theme integration) ───
  const renderField = (field: TrackerField) => {
    if (!tracker) return null;
    if (field.showIf && !field.showIf(formData)) return null;

    const value = formData[field.id] ?? field.defaultValue;
    const hasError = errors.some(e => e.includes(field.label));

    const fieldContainer = (children: React.ReactNode) => (
      <Animated.View
        entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}
        key={field.id}
        style={styles.fieldContainer}
      >
        <Text style={[styles.fieldLabel, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]}>
          {field.label}
          {field.required && <Text style={[styles.required, { color: fullThemeColors.error }]}> *</Text>}
        </Text>
        {children}
      </Animated.View>
    );

    const inputStyle = [
      styles.textInput,
      {
        borderColor: hasError ? fullThemeColors.error : fullThemeColors.border,
        backgroundColor: fullThemeColors.surface,
        color: fullThemeColors.text,
        borderRadius: borderRadiusValue,
        fontSize: 16 * fontSizeMultiplier,
      },
      hasError && { backgroundColor: fullThemeColors.error + '15' },
    ];

    switch (field.type) {
      case 'text':
        return fieldContainer(
          <TextInput
            style={inputStyle}
            placeholder={field.placeholder}
            placeholderTextColor={fullThemeColors.textSecondary}
            value={value as string || ''}
            onChangeText={text => handleFieldChange(field.id, text)}
          />
        );

      case 'number':
        return fieldContainer(
          <View style={[styles.numberInputContainer, { borderColor: hasError ? fullThemeColors.error : fullThemeColors.border, backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue }]}>
            <TextInput
              style={[styles.numberInput, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]}
              placeholder={field.placeholder}
              placeholderTextColor={fullThemeColors.textSecondary}
              value={value?.toString() || ''}
              onChangeText={text => handleFieldChange(field.id, parseFloat(text) || text)}
              keyboardType="decimal-pad"
            />
            {field.unit && <Text style={[styles.unitLabel, { color: fullThemeColors.textSecondary }]}>{field.unit}</Text>}
          </View>
        );

      case 'textarea':
        return fieldContainer(
          <TextInput
            style={[inputStyle, styles.textareaInput, { minHeight: 100 * fontSizeMultiplier }]}
            placeholder={field.placeholder}
            placeholderTextColor={fullThemeColors.textSecondary}
            value={value as string || ''}
            onChangeText={text => handleFieldChange(field.id, text)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        );

      case 'select':
        return fieldContainer(
          <View style={styles.optionsContainer}>
            {field.options?.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: fullThemeColors.surface,
                    borderColor: value === option.id ? tracker.gradient[0] : fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                  },
                  value === option.id && { backgroundColor: `${tracker.gradient[0]}20`, borderWidth: 2 },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  handleFieldChange(field.id, option.id);
                }}
              >
                {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                {option.icon && (
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={value === option.id ? tracker.gradient[0] : fullThemeColors.textSecondary}
                  />
                )}
                <Text
                  style={[
                    styles.optionLabel,
                    { color: value === option.id ? tracker.gradient[0] : fullThemeColors.textSecondary },
                    value === option.id && { fontWeight: '700' },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'multiselect':
        return fieldContainer(
          <View style={styles.optionsContainer}>
            {field.options?.map(option => {
              const isSelected = (value as string[] || []).includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: fullThemeColors.surface,
                      borderColor: isSelected ? tracker.gradient[0] : fullThemeColors.border,
                      borderRadius: borderRadiusValue,
                    },
                    isSelected && { backgroundColor: `${tracker.gradient[0]}20`, borderWidth: 2 },
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    const current = (value as string[]) || [];
                    const updated = isSelected
                      ? current.filter(v => v !== option.id)
                      : [...current, option.id];
                    handleFieldChange(field.id, updated);
                  }}
                >
                  {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? tracker.gradient[0] : fullThemeColors.textSecondary },
                      isSelected && { fontWeight: '700' },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );

      case 'toggle':
        return fieldContainer(
          <View style={[styles.toggleContainer, { backgroundColor: fullThemeColors.surface, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}>
            <Switch
              value={value as boolean || false}
              onValueChange={val => {
                triggerHaptic('light');
                handleFieldChange(field.id, val);
              }}
              trackColor={{ false: fullThemeColors.border, true: `${tracker.gradient[0]}50` }}
              thumbColor={value ? tracker.gradient[0] : fullThemeColors.textSecondary}
            />
          </View>
        );

      case 'duration':
        return fieldContainer(
          <View style={styles.durationContainer}>
            {['5m', '10m', '15m', '20m', '30m', '45m', '1h', '1.5h', '2h', '3h+'].map(dur => (
              <TouchableOpacity
                key={dur}
                style={[
                  styles.durationButton,
                  {
                    backgroundColor: value === dur ? tracker.gradient[0] : fullThemeColors.surface,
                    borderColor: fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                  },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  handleFieldChange(field.id, dur);
                }}
              >
                <Text
                  style={[
                    styles.durationText,
                    { color: value === dur ? '#fff' : fullThemeColors.textSecondary },
                    value === dur && { fontWeight: '700' },
                  ]}
                >
                  {dur}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'rating':
        return fieldContainer(
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => {
                  triggerHaptic('light');
                  handleFieldChange(field.id, star);
                }}
              >
                <Ionicons
                  name={star <= (value as number || 0) ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= (value as number || 0) ? fullThemeColors.warning : fullThemeColors.border}
                />
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'temperature':
        return fieldContainer(
          <View style={styles.tempContainer}>
            <View style={[styles.tempInputWrapper, { borderColor: hasError ? fullThemeColors.error : fullThemeColors.border, backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue }]}>
              <TextInput
                style={[styles.tempInput, { color: fullThemeColors.text, fontSize: 24 * fontSizeMultiplier }]}
                placeholder="36.5"
                placeholderTextColor={fullThemeColors.textSecondary}
                value={value?.toString() || ''}
                onChangeText={text => handleFieldChange(field.id, parseFloat(text) || text)}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.tempUnit, { color: fullThemeColors.textSecondary }]}>°C / °F</Text>
            </View>
          </View>
        );

      case 'photo':
        return fieldContainer(
          <View>
            {photoUris.length > 0 ? (
              <View style={[styles.photoPreviewContainer, { borderRadius: borderRadiusValue }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {photoUris.map((uri, idx) => (
                    <View key={idx} style={styles.photoWrapper}>
                      <Image source={{ uri }} style={[styles.photoPreview, { borderRadius: borderRadiusValue }]} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => setPhotoUris(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Ionicons name="close-circle" size={24} color={fullThemeColors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.photoOverlay}>
                  <TouchableOpacity style={[styles.photoActionBtn, { borderRadius: borderRadiusValue / 2 }]} onPress={handlePhotoPick}>
                    <Ionicons name="image-outline" size={20} color="#fff" />
                    <Text style={styles.photoActionText}>Add More</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.photoActionBtn, { borderRadius: borderRadiusValue / 2 }]} onPress={handleCameraCapture}>
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                    <Text style={styles.photoActionText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.photoButtonsRow}>
                <TouchableOpacity
                  style={[styles.photoButtonHalf, { borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}
                  onPress={handleCameraCapture}
                >
                  <Ionicons name="camera-outline" size={24} color={tracker.gradient[0]} />
                  <Text style={[styles.photoButtonText, { color: fullThemeColors.textSecondary }]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoButtonHalf, { borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}
                  onPress={handlePhotoPick}
                >
                  <Ionicons name="images-outline" size={24} color={tracker.gradient[0]} />
                  <Text style={[styles.photoButtonText, { color: fullThemeColors.textSecondary }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (!tracker) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: fullThemeColors.background }]}>
        <Text style={[styles.errorText, { color: fullThemeColors.textSecondary, fontSize: 18 * fontSizeMultiplier }]}>Tracker not found</Text>
      </View>
    );
  }

  const gradientColors: [string, string, string] = [
    tracker.gradient[0] + '15',
    tracker.gradient[1] + '10',
    fullThemeColors.background,
  ];

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <AutoHideScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with SafeAvatar */}
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown} style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.closeButton, { borderRadius: borderRadiusValue }]}>
              <BlurView intensity={isDark ? 40 : 80} style={[styles.closeBlur, { borderRadius: borderRadiusValue }]} tint={isDark ? 'dark' : 'light'}>
                <Ionicons name="close" size={24} color={fullThemeColors.text} />
              </BlurView>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <SafeAvatar
                avatar={currentBaby?.avatar}
                size={40}
                fallbackIcon="person"
                borderColor={tracker.gradient[0]}
                borderWidth={2}
                animated={false}
              />
              <Text style={[styles.headerTitle, { color: fullThemeColors.text, fontSize: 20 * fontSizeMultiplier }]}>
                {editEntryId ? 'Edit' : 'Add'} {tracker.name}
              </Text>
              <Text style={[styles.headerSubtitle, { color: fullThemeColors.textSecondary }]}>{currentBaby?.name || 'Baby'}</Text>
            </View>

            <TouchableOpacity onPress={handleSave} style={[styles.saveButton, { borderRadius: borderRadiusValue }]}>
              <LinearGradient colors={tracker.gradient} style={[styles.saveGradient, { borderRadius: borderRadiusValue }]}>
                <Text style={[styles.saveButtonText, { fontSize: 16 * fontSizeMultiplier }]}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Recent entries context */}
          {recentEntries.length > 0 && !editEntryId && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50)} style={styles.recentSection}>
              <Text style={[styles.recentTitle, { color: fullThemeColors.textSecondary, fontSize: 13 * fontSizeMultiplier }]}>
                Recent {tracker.name}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {recentEntries.map(entry => (
                  <View
                    key={entry.id}
                    style={[styles.recentCard, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}
                  >
                    <Text style={styles.recentEmoji}>{tracker.emoji}</Text>
                    <Text style={[styles.recentTime, { color: fullThemeColors.textSecondary }]}>
                      {format(new Date(entry.timestamp), 'h:mm a')}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Date/Time */}
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.timeSection}>
            <Text style={[styles.sectionLabel, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]}>When</Text>
            <View style={styles.timeButtonsContainer}>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}
                onPress={handleDatePress}
              >
                <View style={[styles.timeIconContainer, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                  <Ionicons name="calendar-outline" size={22} color={tracker.gradient[0]} />
                </View>
                <View style={styles.timeTextContainer}>
                  <Text style={[styles.timeMainText, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
                    {isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEE, MMM d')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: fullThemeColors.glassBg, borderColor: fullThemeColors.border, borderRadius: borderRadiusValue }]}
                onPress={handleTimePress}
              >
                <View style={[styles.timeIconContainer, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                  <Ionicons name="time-outline" size={22} color={tracker.gradient[0]} />
                </View>
                <View style={styles.timeTextContainer}>
                  <Text style={[styles.timeMainText, { color: fullThemeColors.text, fontSize: 15 * fontSizeMultiplier }]}>
                    {format(date, 'h:mm a')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* iOS Pickers */}
            {Platform.OS === 'ios' && showDatePicker && (
              <Modal transparent animationType="slide" visible={showDatePicker}>
                <View style={[styles.pickerModalOverlay, { backgroundColor: fullThemeColors.shadow + '80' }]}>
                  <View style={[styles.pickerModalContent, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue * 2 }]}>
                    <View style={[styles.pickerHeader, { borderBottomColor: fullThemeColors.border }]}>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Text style={[styles.pickerDoneButton, { color: themeColors.primary }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker value={date} mode="date" display="spinner" onChange={onDateChange} textColor={fullThemeColors.text} />
                  </View>
                </View>
              </Modal>
            )}

            {Platform.OS === 'ios' && showTimePicker && (
              <Modal transparent animationType="slide" visible={showTimePicker}>
                <View style={[styles.pickerModalOverlay, { backgroundColor: fullThemeColors.shadow + '80' }]}>
                  <View style={[styles.pickerModalContent, { backgroundColor: fullThemeColors.surface, borderRadius: borderRadiusValue * 2 }]}>
                    <View style={[styles.pickerHeader, { borderBottomColor: fullThemeColors.border }]}>
                      <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                        <Text style={[styles.pickerDoneButton, { color: themeColors.primary }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker value={date} mode="time" display="spinner" onChange={onDateChange} textColor={fullThemeColors.text} />
                  </View>
                </View>
              </Modal>
            )}
          </Animated.View>

          {/* Errors */}
          {errors.length > 0 && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown} style={[styles.errorsContainer, { backgroundColor: fullThemeColors.error + '15', borderLeftColor: fullThemeColors.error, borderRadius: borderRadiusValue }]}>
              {errors.map((err, idx) => (
                <View key={idx} style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={fullThemeColors.error} />
                  <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{err}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Dynamic Fields */}
          <View style={styles.fieldsSection}>
            {tracker.fields.map(renderField)}
          </View>

          {/* Notes */}
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: fullThemeColors.text, fontSize: 14 * fontSizeMultiplier }]}>Notes</Text>
            <TextInput
              style={[styles.textareaInput, { borderColor: fullThemeColors.border, backgroundColor: fullThemeColors.surface, color: fullThemeColors.text, borderRadius: borderRadiusValue, fontSize: 16 * fontSizeMultiplier }]}
              placeholder="Any additional details..."
              placeholderTextColor={fullThemeColors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Quick Tags */}
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(250)} style={styles.tagsSection}>
            <Text style={[styles.sectionLabel, { color: fullThemeColors.text, fontSize: 16 * fontSizeMultiplier }]}>Quick Tags</Text>
            <View style={styles.tagsContainer}>
              {tracker.quickTags?.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: selectedTags.includes(tag) ? `${tracker.gradient[0]}30` : fullThemeColors.glassBg,
                      borderColor: selectedTags.includes(tag) ? tracker.gradient[0] : fullThemeColors.border,
                      borderRadius: borderRadiusValue,
                    },
                  ]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text
                    style={[
                      styles.tagText,
                      { color: selectedTags.includes(tag) ? tracker.gradient[0] : fullThemeColors.textSecondary },
                      selectedTags.includes(tag) && { fontWeight: '700' },
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <View style={styles.bottomPadding} />
        </AutoHideScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={confirmSave}
        data={{ ...formData, photoUris }}
        tracker={tracker}
        babyName={currentBaby?.name || 'Baby'}
        babyAvatar={currentBaby?.avatar}
        date={date}
        notes={notes}
        tags={selectedTags}
      />
    </LinearGradient>
  );
}

// ─── Modernized Styles ───
const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingTop: 8 },
  closeButton: { overflow: 'hidden' },
  closeBlur: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 6 },
  headerTitle: { fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '500' },
  saveButton: { overflow: 'hidden', elevation: 5 },
  saveGradient: { paddingHorizontal: 20, paddingVertical: 12 },
  saveButtonText: { color: 'white', fontWeight: '700' },

  recentSection: { marginBottom: 20 },
  recentTitle: { fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  recentCard: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1 },
  recentEmoji: { fontSize: 28 },
  recentTime: { fontSize: 12, marginTop: 4, fontWeight: '600' },

  timeSection: { marginBottom: 24 },
  sectionLabel: { fontWeight: '700', letterSpacing: -0.3, marginBottom: 12 },
  timeButtonsContainer: { flexDirection: 'row', gap: 12 },
  timeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  timeIconContainer: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  timeTextContainer: { flex: 1 },
  timeMainText: { fontWeight: '700' },

  pickerModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerModalContent: { paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  pickerHeader: { alignItems: 'flex-end', padding: 16, borderBottomWidth: 1 },
  pickerDoneButton: { fontSize: 16, fontWeight: '600' },

  errorsContainer: { borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  errorText: { fontSize: 13, fontWeight: '500' },

  fieldsSection: { gap: 4 },
  fieldContainer: { marginBottom: 16 },
  fieldLabel: { fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { fontWeight: '700' },
  textInput: { borderWidth: 1, padding: 16, fontWeight: '500' },
  textareaInput: { minHeight: 100, textAlignVertical: 'top' },
  numberInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingRight: 16 },
  numberInput: { flex: 1, padding: 16, fontWeight: '500' },
  unitLabel: { fontSize: 14, fontWeight: '600' },

  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  optionEmoji: { fontSize: 20 },
  optionLabel: { fontSize: 14, fontWeight: '600' },

  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderWidth: 1 },

  durationContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationButton: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
  durationText: { fontSize: 14, fontWeight: '600' },

  ratingContainer: { flexDirection: 'row', gap: 12, paddingVertical: 8 },

  tempContainer: { gap: 12 },
  tempInputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 16 },
  tempInput: { flex: 1, paddingVertical: 16, fontWeight: '700' },
  tempUnit: { fontSize: 16, fontWeight: '600' },

  photoButtonsRow: { flexDirection: 'row', gap: 12 },
  photoButtonHalf: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, borderWidth: 2, borderStyle: 'dashed', gap: 8 },
  photoPreviewContainer: { overflow: 'hidden', position: 'relative' },
  photoWrapper: { position: 'relative', marginRight: 12 },
  photoPreview: { width: 120, height: 120 },
  photoRemoveBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12 },
  photoOverlay: { flexDirection: 'row', padding: 12, gap: 12 },
  photoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  photoActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  photoButtonText: { fontSize: 14, fontWeight: '600' },

  tagsSection: { marginTop: 8 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  tagText: { fontSize: 13, fontWeight: '500' },

  bottomPadding: { height: 100 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxHeight: '80%', overflow: 'hidden', elevation: 20 },
  modalGradient: { padding: 24 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalIconContainer: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalIcon: { fontSize: 32 },
  modalTitle: { fontWeight: '800', marginBottom: 4 },
  modalBabyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalSubtitle: { fontSize: 14, fontWeight: '500' },
  modalBody: { maxHeight: 300 },
  previewCard: { padding: 20, borderWidth: 1 },
  previewTime: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewPhotoContainer: { overflow: 'hidden', marginBottom: 12, height: 120 },
  previewPhoto: { width: '100%', height: '100%' },
  previewTitle: { fontWeight: '800', marginBottom: 8 },
  previewDetails: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  previewFields: { gap: 8, marginTop: 8 },
  previewField: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  previewFieldLabel: { fontSize: 13, fontWeight: '500' },
  previewFieldValue: { fontSize: 13, fontWeight: '600' },
  previewNotes: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  previewNotesText: { flex: 1, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelButton: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '700' },
  confirmButton: { flex: 2, overflow: 'hidden' },
  confirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});