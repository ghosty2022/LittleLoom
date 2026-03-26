import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Switch,
  Animated as RNAnimated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday, isSameWeek, startOfDay, subDays, parseISO, differenceInDays } from 'date-fns';

import { useActivity, ActivityEntry, ActivityType } from '../context/ActivityContext';
import { useBaby } from '../context/BabyContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export interface CustomTracker {
  id: string;
  name: string;
  emoji: string;
  icon: string;
  color: string;
  gradient: [string, string];
  fields: FieldConfig[];
  stats: string[];
  isCustom: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FieldConfig {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle' | 'duration' | 'rating' | 'textarea' | 'photo' | 'date' | 'time';
  options?: { id: string; label: string; emoji?: string; icon?: string }[];
  placeholder?: string;
  required?: boolean;
  showIf?: (data: any) => boolean;
  max?: number;
  min?: number;
  unit?: string;
}

// FIXED: Replaced invalid "chair-outline" with valid "body-outline"
const DEFAULT_TRACKERS: Record<string, CustomTracker> = {
  potty: {
    id: 'potty',
    name: 'Potty',
    emoji: '🚽',
    icon: 'water-outline',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'pottyType', label: 'Type', type: 'select', options: [
        { id: 'pee', label: 'Pee', emoji: '💧' },
        { id: 'poop', label: 'Poop', emoji: '💩' },
        { id: 'both', label: 'Both', emoji: '💧💩' },
        { id: 'accident', label: 'Accident', emoji: '⚠️' },
        { id: 'attempt', label: 'Attempt', emoji: '⏰' },
      ]},
      { id: 'location', label: 'Location', type: 'select', options: [
        { id: 'potty', label: 'Potty Chair', icon: 'body-outline' }, // FIXED: was 'chair-outline'
        { id: 'toilet', label: 'Toilet', icon: 'man-outline' },
        { id: 'floor', label: 'Floor', icon: 'map-outline' },
        { id: 'diaper', label: 'Diaper', icon: 'shirt-outline' },
      ]},
      { id: 'successful', label: 'Successful', type: 'toggle' },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any details...' },
    ],
    stats: ['successRate', 'streak', 'todayCount', 'accidents'],
  },

  feed: {
    id: 'feed',
    name: 'Feed',
    emoji: '🍼',
    icon: 'nutrition-outline',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'feedType', label: 'Type', type: 'select', options: [
        { id: 'breast', label: 'Breast', emoji: '🤱' },
        { id: 'bottle', label: 'Bottle', emoji: '🍼' },
        { id: 'solid', label: 'Solid Food', emoji: '🥄' },
        { id: 'snack', label: 'Snack', emoji: '🍎' },
      ]},
      { id: 'amount', label: 'Amount', type: 'number', placeholder: 'Amount', unit: 'oz/ml' },
      { id: 'duration', label: 'Duration', type: 'duration', placeholder: 'How long?' },
      { id: 'side', label: 'Side', type: 'select', options: [
        { id: 'left', label: 'Left' },
        { id: 'right', label: 'Right' },
        { id: 'both', label: 'Both' },
      ], showIf: (data) => data.feedType === 'breast' },
      { id: 'food', label: 'Food', type: 'text', placeholder: 'What did they eat?', showIf: (data) => data.feedType === 'solid' || data.feedType === 'snack' },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any reactions or preferences...' },
    ],
    stats: ['todayCount', 'totalAmount', 'lastFeed', 'dailyAverage'],
  },

  sleep: {
    id: 'sleep',
    name: 'Sleep',
    emoji: '😴',
    icon: 'moon-outline',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'sleepType', label: 'Type', type: 'select', options: [
        { id: 'nap', label: 'Nap', emoji: '☀️' },
        { id: 'night', label: 'Night Sleep', emoji: '🌙' },
        { id: 'wake', label: 'Wake Window', emoji: '👀' },
      ]},
      { id: 'duration', label: 'Duration', type: 'duration', required: true },
      { id: 'quality', label: 'Sleep Quality', type: 'rating', max: 5 },
      { id: 'location', label: 'Location', type: 'select', options: [
        { id: 'crib', label: 'Crib' },
        { id: 'bed', label: 'Parent Bed' },
        { id: 'stroller', label: 'Stroller' },
        { id: 'car', label: 'Car' },
        { id: 'carrier', label: 'Carrier' },
      ]},
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'How did they sleep?' },
    ],
    stats: ['todayCount', 'totalDuration', 'averageDuration', 'nightSleep'],
  },

  growth: {
    id: 'growth',
    name: 'Growth',
    emoji: '📏',
    icon: 'trending-up-outline',
    color: '#43e97b',
    gradient: ['#43e97b', '#38f9d7'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'measurementType', label: 'Type', type: 'select', options: [
        { id: 'weight', label: 'Weight', emoji: '⚖️' },
        { id: 'height', label: 'Height', emoji: '📏' },
        { id: 'head', label: 'Head Circumference', emoji: '🧠' },
      ]},
      { id: 'value', label: 'Value', type: 'number', required: true },
      { id: 'unit', label: 'Unit', type: 'select', options: [
        { id: 'kg', label: 'kg' },
        { id: 'lb', label: 'lb' },
        { id: 'oz', label: 'oz' },
        { id: 'cm', label: 'cm' },
        { id: 'in', label: 'in' },
      ]},
      { id: 'percentile', label: 'Percentile', type: 'number', placeholder: 'Optional percentile', min: 0, max: 100 },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any observations...' },
    ],
    stats: ['lastMeasurement', 'growthRate', 'percentile'],
  },

  medication: {
    id: 'medication',
    name: 'Medication',
    emoji: '💊',
    icon: 'medical-outline',
    color: '#ff6b6b',
    gradient: ['#ff6b6b', '#ee5a5a'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'medName', label: 'Medicine Name', type: 'text', required: true, placeholder: 'Medicine name' },
      { id: 'dosage', label: 'Dosage', type: 'text', required: true, placeholder: 'e.g., 5ml, 1 tablet' },
      { id: 'reason', label: 'Reason', type: 'text', placeholder: 'Why was this given?' },
      { id: 'givenBy', label: 'Given By', type: 'select', options: [
        { id: 'parent1', label: 'Parent 1' },
        { id: 'parent2', label: 'Parent 2' },
        { id: 'doctor', label: 'Doctor' },
        { id: 'other', label: 'Other' },
      ]},
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any reactions or notes...' },
    ],
    stats: ['todayCount', 'lastGiven', 'totalDoses'],
  },

  milestone: {
    id: 'milestone',
    name: 'Milestone',
    emoji: '🌟',
    icon: 'trophy-outline',
    color: '#ffd700',
    gradient: ['#ffd700', '#ffaa00'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'milestoneType', label: 'Category', type: 'select', options: [
        { id: 'motor', label: 'Motor Skills', emoji: '🏃' },
        { id: 'cognitive', label: 'Cognitive', emoji: '🧠' },
        { id: 'social', label: 'Social', emoji: '👋' },
        { id: 'language', label: 'Language', emoji: '🗣️' },
        { id: 'other', label: 'Other', emoji: '✨' },
      ]},
      { id: 'title', label: 'Milestone', type: 'text', required: true, placeholder: 'What did they do?' },
      { id: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe what happened...' },
      { id: 'firstTime', label: 'First Time', type: 'toggle' },
      { id: 'photo', label: 'Add Photo', type: 'photo' },
    ],
    stats: ['totalMilestones', 'thisMonth', 'byCategory'],
  },

  diaper: {
    id: 'diaper',
    name: 'Diaper',
    emoji: '🧷',
    icon: 'shirt-outline',
    color: '#fc5c7d',
    gradient: ['#fc5c7d', '#fd79a8'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'diaperType', label: 'Type', type: 'select', options: [
        { id: 'wet', label: 'Wet', emoji: '💧' },
        { id: 'dirty', label: 'Dirty', emoji: '💩' },
        { id: 'both', label: 'Both', emoji: '💧💩' },
        { id: 'dry', label: 'Dry', emoji: '✓' },
      ]},
      { id: 'rash', label: 'Rash?', type: 'toggle' },
      { id: 'cream', label: 'Cream Applied', type: 'select', options: [
        { id: 'none', label: 'None' },
        { id: 'zinc', label: 'Zinc Oxide' },
        { id: 'petroleum', label: 'Petroleum Jelly' },
        { id: 'other', label: 'Other' },
      ]},
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any observations...' },
    ],
    stats: ['todayCount', 'rashCount', 'lastChange'],
  },

  note: {
    id: 'note',
    name: 'Note',
    emoji: '📝',
    icon: 'document-text-outline',
    color: '#94a3b8',
    gradient: ['#94a3b8', '#64748b'],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      { id: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Note title' },
      { id: 'content', label: 'Content', type: 'textarea', placeholder: 'Write your note here...' },
      { id: 'mood', label: 'Mood', type: 'select', options: [
        { id: 'happy', label: 'Happy', emoji: '😊' },
        { id: 'neutral', label: 'Neutral', emoji: '😐' },
        { id: 'sad', label: 'Sad', emoji: '😢' },
        { id: 'excited', label: 'Excited', emoji: '🤩' },
        { id: 'tired', label: 'Tired', emoji: '😴' },
      ]},
      { id: 'photo', label: 'Attach Photo', type: 'photo' },
    ],
    stats: ['totalNotes', 'thisWeek'],
  },
};

interface GroupedEntries {
  title: string;
  date: Date;
  entries: ActivityEntry[];
}

type UniversalTrackerRouteProp = RouteProp<RootStackParamList, 'UniversalTracker'>;
type UniversalTrackerNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CustomTrackerManager: React.FC<{
  visible: boolean;
  onClose: () => void;
  customTrackers: CustomTracker[];
  onAddTracker: (tracker: Omit<CustomTracker, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onEditTracker: (tracker: CustomTracker) => void;
  onDeleteTracker: (id: string) => void;
}> = ({ visible, onClose, customTrackers, onAddTracker, onEditTracker, onDeleteTracker }) => {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editingTracker, setEditingTracker] = useState<CustomTracker | null>(null);
  const [formData, setFormData] = useState<Partial<CustomTracker>>({
    name: '',
    emoji: '📊',
    icon: 'analytics-outline',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    fields: [],
    isCustom: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      emoji: '📊',
      icon: 'analytics-outline',
      color: '#667eea',
      gradient: ['#667eea', '#764ba2'],
      fields: [],
      isCustom: true,
    });
    setEditingTracker(null);
    setMode('list');
  };

  const handleSave = () => {
    if (!formData.name) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (editingTracker) {
      onEditTracker({ ...editingTracker, ...formData as CustomTracker, updatedAt: Date.now() });
    } else {
      onAddTracker(formData as Omit<CustomTracker, 'id' | 'createdAt' | 'updatedAt'>);
    }
    resetForm();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const colorOptions = [
    '#667eea', '#fa709a', '#11998e', '#43e97b', '#ff6b6b',
    '#ffd700', '#fc5c7d', '#94a3b8', '#a855f7', '#ec4899',
    '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  ];

  // FIXED: Only valid Ionicons names (removed 'chair-outline')
  const iconOptions = [
    'analytics-outline', 'heart-outline', 'star-outline', 'sunny-outline',
    'moon-outline', 'water-outline', 'fitness-outline', 'medical-outline',
    'happy-outline', 'book-outline', 'camera-outline', 'musical-notes-outline',
    'game-controller-outline', 'airplane-outline', 'bicycle-outline',
    'body-outline', 'man-outline', 'woman-outline', 'accessibility-outline',
    'flask-outline', 'restaurant-outline', 'pizza-outline', 'layers-outline',
  ];

  if (mode === 'edit') {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={95} style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTracker ? '✏️ Edit Tracker' : '➕ New Tracker'}
              </Text>
              <TouchableOpacity onPress={() => { resetForm(); onClose(); }} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Tracker Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Temperature, Vaccines..."
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Emoji</Text>
                <TextInput
                  style={[styles.textInput, { fontSize: 24 }]}
                  placeholder="📊"
                  maxLength={2}
                  value={formData.emoji}
                  onChangeText={(text) => setFormData({ ...formData, emoji: text })}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Color Theme</Text>
                <View style={styles.colorGrid}>
                  {colorOptions.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        formData.color === color && styles.colorOptionSelected
                      ]}
                      onPress={() => setFormData({ ...formData, color, gradient: [color, color] })}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Icon</Text>
                <View style={styles.iconGrid}>
                  {iconOptions.map((icon) => (
                    <TouchableOpacity
                      key={icon}
                      style={[
                        styles.iconOption,
                        formData.icon === icon && { backgroundColor: formData.color, borderColor: formData.color }
                      ]}
                      onPress={() => setFormData({ ...formData, icon })}
                    >
                      <Ionicons name={icon as any} size={24} color={formData.icon === icon ? '#fff' : '#64748b'} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <LinearGradient colors={formData.gradient || ['#667eea', '#764ba2']} style={styles.saveGradient}>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                  <Text style={styles.saveText}>Save Tracker</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, { marginTop: 12 }]} 
                onPress={() => setMode('list')}
              >
                <View style={[styles.saveGradient, { backgroundColor: '#e2e8f0' }]}>
                  <Text style={[styles.saveText, { color: '#64748b' }]}>Cancel</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </BlurView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <BlurView intensity={95} style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🎨 Custom Trackers</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.addTrackerButton}
            onPress={() => setMode('edit')}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addTrackerGradient}>
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.addTrackerText}>Create New Tracker</Text>
            </LinearGradient>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {customTrackers.map((tracker) => (
              <View key={tracker.id} style={styles.trackerListItem}>
                <View style={[styles.trackerIcon, { backgroundColor: `${tracker.color}20` }]}>
                  <Text style={{ fontSize: 24 }}>{tracker.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackerName}>{tracker.name}</Text>
                  <Text style={styles.trackerMeta}>Custom • {tracker.fields.length} fields</Text>
                </View>
                <View style={styles.trackerActions}>
                  <TouchableOpacity 
                    style={styles.trackerActionBtn}
                    onPress={() => { setEditingTracker(tracker); setFormData(tracker); setMode('edit'); }}
                  >
                    <Ionicons name="create-outline" size={20} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.trackerActionBtn, { backgroundColor: '#fef2f2' }]}
                    onPress={() => {
                      Alert.alert(
                        'Delete Tracker',
                        `Delete "${tracker.name}"? This won't delete existing entries.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => onDeleteTracker(tracker.id) }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {customTrackers.length === 0 && (
              <View style={styles.emptyCustomTrackers}>
                <Text style={styles.emptyCustomTrackersText}>No custom trackers yet</Text>
                <Text style={styles.emptyCustomTrackersSub}>Create your own tracking categories!</Text>
              </View>
            )}
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
};

const QuickAddModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (entry: Partial<ActivityEntry>) => void;
  tracker: CustomTracker;
  babyName: string;
}> = ({ visible, onClose, onSave, tracker, babyName }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setFormData({});
      setErrors([]);
    }
  }, [visible, tracker.id]);

  const validate = () => {
    const newErrors: string[] = [];
    tracker.fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors.push(`${field.label} is required`);
      }
    });
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const title = buildTitle(tracker, formData);
    const details = buildDetails(tracker, formData);

    onSave({
      type: tracker.id as ActivityType,
      title,
      details,
      icon: tracker.emoji,
      ...formData,
    });
    onClose();
  };

  const buildTitle = (config: CustomTracker, data: any) => {
    switch (config.id) {
      case 'potty':
        return `${data.pottyType?.charAt(0).toUpperCase() + data.pottyType?.slice(1)} - ${data.location}`;
      case 'feed':
        return `${data.feedType === 'breast' ? 'Breastfed' : data.feedType === 'bottle' ? 'Bottle' : 'Solid Food'}${data.amount ? ` (${data.amount}oz)` : ''}`;
      case 'sleep':
        return `${data.sleepType === 'nap' ? 'Nap' : 'Night Sleep'} (${data.duration})`;
      case 'growth':
        return `${data.measurementType?.charAt(0).toUpperCase() + data.measurementType?.slice(1)}: ${data.value}${data.unit}`;
      case 'medication':
        return `${data.medName} ${data.dosage}`;
      case 'milestone':
        return `🌟 ${data.title}`;
      case 'diaper':
        return `${data.diaperType?.charAt(0).toUpperCase() + data.diaperType?.slice(1)} Diaper`;
      case 'note':
        return data.title;
      default:
        return `${config.emoji} ${config.name}`;
    }
  };

  const buildDetails = (config: CustomTracker, data: any) => {
    const details: string[] = [];
    config.fields.forEach(field => {
      if (data[field.id] && field.id !== 'title' && field.id !== 'medName') {
        if (field.type === 'toggle') {
          if (data[field.id]) details.push(field.label);
        } else if (field.type === 'select') {
          const option = field.options?.find(o => o.id === data[field.id]);
          if (option) details.push(`${field.label}: ${option.label}`);
        } else if (field.id !== 'notes' && field.id !== 'description' && field.id !== 'content') {
          details.push(`${field.label}: ${data[field.id]}${field.unit ? field.unit : ''}`);
        }
      }
    });
    if (data.notes || data.description || data.content) {
      details.push(data.notes || data.description || data.content);
    }
    return details.join(' • ') || undefined;
  };

  const renderField = (field: FieldConfig) => {
    if (field.showIf && !field.showIf(formData)) return null;
    const value = formData[field.id];

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && ' *'}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={field.placeholder}
              value={value || ''}
              onChangeText={(text) => setFormData({ ...formData, [field.id]: text })}
              keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
            />
          </View>
        );

      case 'textarea':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && ' *'}</Text>
            <TextInput
              style={[styles.textInput, styles.textareaInput]}
              placeholder={field.placeholder}
              value={value || ''}
              onChangeText={(text) => setFormData({ ...formData, [field.id]: text })}
              multiline
              numberOfLines={4}
            />
          </View>
        );

      case 'select':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && ' *'}</Text>
            <View style={styles.optionsGrid}>
              {field.options?.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    value === option.id && { 
                      backgroundColor: `${tracker.color}20`,
                      borderColor: tracker.color,
                      borderWidth: 2
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFormData({ ...formData, [field.id]: option.id });
                  }}
                >
                  {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                  {option.icon && <Ionicons name={option.icon as any} size={20} color={value === option.id ? tracker.color : '#64748b'} />}
                  <Text style={[
                    styles.optionLabel,
                    value === option.id && { color: tracker.color, fontWeight: '700' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'toggle':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <View style={styles.toggleContainer}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Switch
                value={value || false}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFormData({ ...formData, [field.id]: val });
                }}
                trackColor={{ false: '#e2e8f0', true: `${tracker.color}50` }}
                thumbColor={value ? tracker.color : '#fff'}
              />
            </View>
          </View>
        );

      case 'duration':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && ' *'}</Text>
            <View style={styles.durationContainer}>
              {['15m', '30m', '45m', '1h', '1.5h', '2h', '3h+'].map((dur) => (
                <TouchableOpacity
                  key={dur}
                  style={[
                    styles.durationButton,
                    value === dur && { backgroundColor: tracker.color }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFormData({ ...formData, [field.id]: dur });
                  }}
                >
                  <Text style={[
                    styles.durationText,
                    value === dur && { color: '#fff', fontWeight: '700' }
                  ]}>
                    {dur}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'rating':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFormData({ ...formData, [field.id]: star });
                  }}
                >
                  <Ionicons
                    name={star <= (value || 0) ? "star" : "star-outline"}
                    size={32}
                    color={star <= (value || 0) ? '#ffd700' : '#e2e8f0'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'photo':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TouchableOpacity style={styles.photoButton}>
              <Ionicons name="camera-outline" size={24} color={tracker.color} />
              <Text style={styles.photoButtonText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <BlurView intensity={95} style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{tracker.emoji} {tracker.name}</Text>
              <Text style={styles.modalSubtitle}>For {babyName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {errors.length > 0 && (
            <View style={styles.errorsContainer}>
              {errors.map((error, idx) => (
                <Text key={idx} style={styles.errorText}>• {error}</Text>
              ))}
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            {tracker.fields.map(renderField)}

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <LinearGradient
                colors={tracker.gradient}
                style={styles.saveGradient}
              >
                <Ionicons name="checkmark" size={24} color="#fff" />
                <Text style={styles.saveText}>Save {tracker.name}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const EntryCard: React.FC<{
  entry: ActivityEntry;
  tracker: CustomTracker;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  delay: number;
}> = ({ entry, tracker, isLast, onEdit, onDelete, delay }) => {
  const time = format(new Date(entry.timestamp), 'h:mm a');

  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).springify()}
      layout={Layout.springify()}
    >
      <View style={styles.entryRow}>
        <View style={styles.timeColumn}>
          <Text style={[styles.timeText, { color: tracker.color }]}>{time}</Text>
          {!isLast && (
            <View style={[styles.timelineLine, { backgroundColor: `${tracker.color}30` }]} />
          )}
        </View>

        <TouchableOpacity style={styles.entryCardContainer} activeOpacity={0.9}>
          <BlurView intensity={70} style={styles.entryCard}>
            <View style={[styles.iconContainer, { backgroundColor: `${tracker.color}15` }]}>
              <Text style={styles.typeEmoji}>{entry.icon || tracker.emoji}</Text>
            </View>

            <View style={styles.entryContent}>
              <Text style={styles.entryTitle}>{entry.title}</Text>
              {entry.details && (
                <Text style={styles.entrySubtitle} numberOfLines={2}>{entry.details}</Text>
              )}
              <Text style={styles.timestampText}>
                {format(new Date(entry.timestamp), 'MMM d, h:mm a')}
                {entry.loggedByName && ` • by ${entry.loggedByName}`}
              </Text>
            </View>

            <View style={styles.entryActions}>
              <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={18} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const StickyHeader: React.FC<{
  scrollY: any;
  tracker: CustomTracker;
  babyName: string;
  stats: any;
  onBack: () => void;
  onAdd: () => void;
  onManageTrackers: () => void;
}> = ({ scrollY, tracker, babyName, stats, onBack, onAdd, onManageTrackers }) => {
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [-20, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const titleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 60],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <View style={styles.stickyHeaderContainer}>
      <LinearGradient
        colors={[tracker.gradient[0] + '20', tracker.gradient[1] + '10', '#fff']}
        style={styles.headerGradient}
      />
      
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <BlurView intensity={80} style={styles.backBlur}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </BlurView>
        </TouchableOpacity>

        <Animated.View style={[styles.headerCenter, titleAnimatedStyle]}>
          <Text style={styles.headerTitleLarge}>{tracker.emoji} {tracker.name}</Text>
          <Text style={styles.headerSubtitle}>{babyName} • {stats.primary?.value || 0} today</Text>
        </Animated.View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={onManageTrackers} style={styles.headerActionBtn}>
            <BlurView intensity={80} style={styles.actionBlur}>
              <Ionicons name="grid-outline" size={22} color="#1e293b" />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAdd} style={styles.headerActionBtn}>
            <LinearGradient colors={tracker.gradient} style={styles.addButtonSmall}>
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.stickyTitleContainer, headerAnimatedStyle]}>
        <BlurView intensity={90} style={styles.stickyBlur}>
          <Text style={styles.stickyTitle}>{tracker.emoji} {tracker.name}</Text>
          <Text style={styles.stickySubtitle}>{stats.primary?.value || 0} {stats.primary?.label || 'entries'}</Text>
        </BlurView>
      </Animated.View>
    </View>
  );
};

export default function UniversalTrackerScreen() {
  const navigation = useNavigation<UniversalTrackerNavigationProp>();
  const route = useRoute<UniversalTrackerRouteProp>();

  // FIXED: Destructure getDateTitle from useActivity hook
  const { entries, isLoading, loadEntries, deleteEntry, addEntry, getDateTitle } = useActivity();
  const { currentBaby } = useBaby();
  const { userProfile } = useAuth();

  const scrollY = useSharedValue(0);
  
  const [trackers, setTrackers] = useState<Record<string, CustomTracker>>(DEFAULT_TRACKERS);
  const [customTrackersList, setCustomTrackersList] = useState<CustomTracker[]>([]);
  const [currentTrackerId, setCurrentTrackerId] = useState<string>(route.params?.type || 'potty');
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showTrackerManager, setShowTrackerManager] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const currentTracker = trackers[currentTrackerId] || Object.values(trackers)[0];

  useEffect(() => {
    const loadCustomTrackers = async () => {
      try {
        const stored = await AsyncStorage.getItem('@littleloom_custom_trackers');
        if (stored) {
          const parsed = JSON.parse(stored);
          setCustomTrackersList(parsed);
          const customMap: Record<string, CustomTracker> = {};
          parsed.forEach((t: CustomTracker) => {
            customMap[t.id] = t;
          });
          setTrackers({ ...DEFAULT_TRACKERS, ...customMap });
        }
      } catch (e) {
        console.error('Failed to load custom trackers', e);
      }
    };
    loadCustomTrackers();
  }, []);

  const saveCustomTrackers = async (list: CustomTracker[]) => {
    try {
      await AsyncStorage.setItem('@littleloom_custom_trackers', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save custom trackers', e);
    }
  };

  const handleAddTracker = (tracker: Omit<CustomTracker, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTracker: CustomTracker = {
      ...tracker,
      id: `custom_${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...customTrackersList, newTracker];
    setCustomTrackersList(updated);
    setTrackers({ ...trackers, [newTracker.id]: newTracker });
    saveCustomTrackers(updated);
    setCurrentTrackerId(newTracker.id);
  };

  const handleEditTracker = (tracker: CustomTracker) => {
    const updated = customTrackersList.map(t => t.id === tracker.id ? tracker : t);
    setCustomTrackersList(updated);
    setTrackers({ ...trackers, [tracker.id]: tracker });
    saveCustomTrackers(updated);
  };

  const handleDeleteTracker = (id: string) => {
    const updated = customTrackersList.filter(t => t.id !== id);
    setCustomTrackersList(updated);
    const newTrackers = { ...trackers };
    delete newTrackers[id];
    setTrackers(newTrackers);
    saveCustomTrackers(updated);
    if (currentTrackerId === id) {
      setCurrentTrackerId('potty');
    }
  };

  const calculateStats = useCallback((trackerId: string, allEntries: ActivityEntry[]) => {
    const typeEntries = allEntries.filter(e => e.type === trackerId);
    const today = typeEntries.filter(e => isToday(new Date(e.timestamp)));
    const week = typeEntries.filter(e => isSameWeek(new Date(e.timestamp), new Date(), { weekStartsOn: 1 }));

    switch (trackerId) {
      case 'potty':
        return {
          primary: { label: 'Success Today', value: today.filter(e => e.successful).length, emoji: '🎯', color: '#22c55e' },
          secondary: [
            { label: 'Success Rate', value: `${typeEntries.length ? Math.round((typeEntries.filter(e => e.successful).length / typeEntries.length) * 100) : 0}%`, emoji: '📈' },
            { label: 'Streak', value: calculateStreak(typeEntries), emoji: '🔥' },
            { label: 'Accidents', value: today.filter(e => e.pottyType === 'accident').length, emoji: '⚠️', color: '#ef4444' },
          ]
        };

      case 'feed':
        const todayAmount = today.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        return {
          primary: { label: 'Feeds Today', value: today.length, emoji: '🍼', color: '#fa709a' },
          secondary: [
            { label: 'Total Amount', value: `${todayAmount}oz`, emoji: '📊' },
            { label: 'Last Feed', value: typeEntries[0] ? format(new Date(typeEntries[0].timestamp), 'h:mm a') : '-', emoji: '⏰' },
            { label: 'Daily Avg', value: `${Math.round(week.length / 7 * 10) / 10}`, emoji: '📉' },
          ]
        };

      case 'sleep':
        return {
          primary: { label: 'Sleeps Today', value: today.length, emoji: '😴', color: '#11998e' },
          secondary: [
            { label: 'Total Duration', value: calculateTotalDuration(today), emoji: '⏱️' },
            { label: 'Avg Duration', value: calculateAvgDuration(today), emoji: '📊' },
            { label: 'Night Sleep', value: today.filter(e => e.sleepType === 'night').length, emoji: '🌙' },
          ]
        };

      case 'growth':
        return {
          primary: { label: 'Measurements', value: typeEntries.length, emoji: '📏', color: '#43e97b' },
          secondary: [
            { label: 'Last Record', value: typeEntries[0] ? format(new Date(typeEntries[0].timestamp), 'MMM d') : '-', emoji: '📅' },
            { label: 'This Month', value: typeEntries.filter(e => differenceInDays(new Date(), new Date(e.timestamp)) <= 30).length, emoji: '📈' },
            { label: 'Types', value: [...new Set(typeEntries.map(e => e.measurementType))].length, emoji: '📊' },
          ]
        };

      case 'medication':
        return {
          primary: { label: 'Doses Today', value: today.length, emoji: '💊', color: '#ff6b6b' },
          secondary: [
            { label: 'Last Given', value: typeEntries[0] ? format(new Date(typeEntries[0].timestamp), 'h:mm a') : '-', emoji: '⏰' },
            { label: 'This Week', value: week.length, emoji: '📅' },
            { label: 'Total', value: typeEntries.length, emoji: '📊' },
          ]
        };

      case 'milestone':
        return {
          primary: { label: 'Milestones', value: typeEntries.length, emoji: '🌟', color: '#ffd700' },
          secondary: [
            { label: 'This Month', value: typeEntries.filter(e => differenceInDays(new Date(), new Date(e.timestamp)) <= 30).length, emoji: '📅' },
            { label: 'Firsts', value: typeEntries.filter(e => e.firstTime).length, emoji: '🎉' },
            { label: 'Categories', value: [...new Set(typeEntries.map(e => e.milestoneType))].length, emoji: '📂' },
          ]
        };

      default:
        return {
          primary: { label: 'Entries Today', value: today.length, emoji: currentTracker?.emoji || '📊', color: currentTracker?.color || '#667eea' },
          secondary: [
            { label: 'This Week', value: week.length, emoji: '📅' },
            { label: 'Total', value: typeEntries.length, emoji: '📊' },
            { label: 'Rate', value: `${typeEntries.length > 0 ? Math.round((today.length / typeEntries.length) * 100) : 0}%`, emoji: '📈' },
          ]
        };
    }
  }, [currentTracker]);

  const calculateStreak = (entries: ActivityEntry[]) => {
    let streak = 0;
    const today = startOfDay(new Date());

    for (let i = 0; i < 30; i++) {
      const checkDate = subDays(today, i);
      const hasSuccess = entries.some(e => 
        isSameDay(new Date(e.timestamp), checkDate) && e.successful
      );
      if (hasSuccess) streak++;
      else if (i > 0) break;
    }
    return streak;
  };

  const calculateTotalDuration = (entries: ActivityEntry[]) => {
    let totalMinutes = 0;
    entries.forEach(e => {
      const match = e.duration?.match(/(\d+)h?\s*(\d*)m?/);
      if (match) {
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        totalMinutes += hours * 60 + minutes;
      }
    });
    return totalMinutes > 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`;
  };

  const calculateAvgDuration = (entries: ActivityEntry[]) => {
    if (entries.length === 0) return '-';
    return `${Math.round(entries.length * 45 / entries.length)}m avg`;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return format(date1, 'yyyy-MM-dd') === format(date2, 'yyyy-MM-dd');
  };

  const filteredEntries = useMemo(() => {
    let filtered = entries.filter(e => e.type === currentTrackerId);
    const now = new Date();

    if (selectedTimeRange === 'today') {
      filtered = filtered.filter(e => isToday(new Date(e.timestamp)));
    } else if (selectedTimeRange === 'week') {
      filtered = filtered.filter(e => isSameWeek(new Date(e.timestamp), now, { weekStartsOn: 1 }));
    } else if (selectedTimeRange === 'month') {
      filtered = filtered.filter(e => differenceInDays(now, new Date(e.timestamp)) <= 30);
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries, currentTrackerId, selectedTimeRange]);

  // FIXED: Using getDateTitle from context instead of local undefined function
  const groupedEntries = useMemo(() => {
    const groups: GroupedEntries[] = [];
    let currentGroup: GroupedEntries | null = null;

    filteredEntries.forEach(entry => {
      const entryDate = new Date(entry.timestamp);

      if (!currentGroup || !isSameDay(currentGroup.date, entryDate)) {
        currentGroup = {
          title: getDateTitle(entry.timestamp), // FIXED: Now using context function
          date: entryDate,
          entries: []
        };
        groups.push(currentGroup);
      }
      currentGroup.entries.push(entry);
    });

    return groups;
  }, [filteredEntries, getDateTitle]);

  const stats = useMemo(() => {
    return calculateStats(currentTrackerId, entries);
  }, [currentTrackerId, entries, calculateStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }, [loadEntries]);

  const handleQuickAdd = useCallback((entryData: Partial<ActivityEntry>) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    addEntry({
      ...entryData,
      type: currentTrackerId as ActivityType,
      babyId: currentBaby?.id || '',
      timestamp: Date.now(),
      loggedBy: userProfile?.id || 'unknown',
      loggedByName: userProfile?.fullName?.split(' ')[0] || 'Parent',
    });
  }, [addEntry, currentTrackerId, currentBaby, userProfile]);

  const handleEdit = useCallback((entry: ActivityEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AddLog', { 
      editMode: true, 
      eventId: entry.id,
      type: currentTrackerId
    });
  }, [navigation, currentTrackerId]);

  const handleDelete = useCallback((entry: ActivityEntry) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Entry',
      `Delete this ${currentTracker.name.toLowerCase()} entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entry.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      ]
    );
  }, [deleteEntry, currentTracker]);

  const switchTracker = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentTrackerId(id);
  };

  const handleScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  if (isLoading && !refreshing) {
    return (
      <LinearGradient colors={[currentTracker.gradient[0] + '10', currentTracker.gradient[1] + '10', '#fff']} style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading entries...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <StickyHeader
        scrollY={scrollY}
        tracker={currentTracker}
        babyName={currentBaby?.name || 'Baby'}
        stats={stats}
        onBack={() => navigation.goBack()}
        onAdd={() => setShowQuickAdd(true)}
        onManageTrackers={() => setShowTrackerManager(true)}
      />

      <RNAnimated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={currentTracker.color}
            progressViewOffset={120}
          />
        }
      >
        <Animated.View entering={FadeInUp.delay(100)} style={styles.activitySelectorContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.activitySelector}
          >
            {Object.values(trackers).map((tracker) => {
              const isActive = tracker.id === currentTrackerId;
              return (
                <TouchableOpacity
                  key={tracker.id}
                  style={[
                    styles.activityTab, 
                    isActive && { 
                      backgroundColor: tracker.color, 
                      borderColor: tracker.color,
                      transform: [{ scale: 1.05 }]
                    }
                  ]}
                  onPress={() => switchTracker(tracker.id)}
                >
                  <Text style={styles.activityEmoji}>{tracker.emoji}</Text>
                  <Text style={[
                    styles.activityLabel, 
                    isActive && { color: '#fff', fontWeight: '700' }
                  ]}>
                    {tracker.name}
                  </Text>
                  {tracker.isCustom && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>★</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
            <LinearGradient colors={currentTracker.gradient} style={[styles.statCard, styles.primaryStatCard]}>
              <Text style={styles.primaryStatEmoji}>{stats.primary?.emoji || currentTracker.emoji}</Text>
              <Text style={styles.primaryStatNumber}>{stats.primary?.value || 0}</Text>
              <Text style={styles.primaryStatLabel}>{stats.primary?.label || 'Entries'}</Text>
            </LinearGradient>

            {stats.secondary?.map((stat: any, idx: number) => (
              <View key={idx} style={[styles.statCard, styles.secondaryStatCard]}>
                <Text style={styles.secondaryStatEmoji}>{stat.emoji}</Text>
                <Text style={[styles.secondaryStatNumber, stat.color && { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.secondaryStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300)} style={styles.filterContainer}>
          <View style={styles.timeRangeTabs}>
            {(['today', 'week', 'month', 'all'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeTab, 
                  selectedTimeRange === range && { backgroundColor: currentTracker.color }
                ]}
                onPress={() => { 
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                  setSelectedTimeRange(range); 
                }}
              >
                <Text style={[
                  styles.timeTabText, 
                  selectedTimeRange === range && { color: '#fff', fontWeight: '700' }
                ]}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <View style={styles.timelineContainer}>
          {groupedEntries.length === 0 ? (
            <Animated.View entering={FadeInUp.delay(400)} style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyEmoji}>{currentTracker.emoji}</Text>
              </View>
              <Text style={styles.emptyTitle}>No {currentTracker.name.toLowerCase()} entries yet</Text>
              <Text style={styles.emptySubtitle}>
                Start tracking {currentBaby?.name || 'your baby'}'s {currentTracker.name.toLowerCase()} by tapping the + button
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => setShowQuickAdd(true)}>
                <LinearGradient colors={currentTracker.gradient} style={styles.emptyButtonGradient}>
                  <Text style={styles.emptyButtonText}>Add First Entry</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            groupedEntries.map((group, groupIndex) => (
              <View key={group.title} style={styles.daySection}>
                <Animated.View entering={FadeInUp.delay(groupIndex * 100)}>
                  <View style={styles.dateHeaderContainer}>
                    <Text style={styles.dateHeader}>{group.title}</Text>
                    <View style={[styles.dateBadge, { backgroundColor: `${currentTracker.color}20` }]}>
                      <Text style={[styles.dateBadgeText, { color: currentTracker.color }]}>{group.entries.length}</Text>
                    </View>
                  </View>

                  <View style={styles.entriesContainer}>
                    {group.entries.map((entry, entryIndex) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        tracker={currentTracker}
                        isLast={entryIndex === group.entries.length - 1}
                        onEdit={() => handleEdit(entry)}
                        onDelete={() => handleDelete(entry)}
                        delay={groupIndex * 100 + entryIndex * 50}
                      />
                    ))}
                  </View>
                </Animated.View>
              </View>
            ))
          )}
          <View style={styles.bottomPadding} />
        </View>
      </RNAnimated.ScrollView>

      <QuickAddModal
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSave={handleQuickAdd}
        tracker={currentTracker}
        babyName={currentBaby?.name || 'Baby'}
      />

      <CustomTrackerManager
        visible={showTrackerManager}
        onClose={() => setShowTrackerManager(false)}
        customTrackers={customTrackersList}
        onAddTracker={handleAddTracker}
        onEditTracker={handleEditTracker}
        onDeleteTracker={handleDeleteTracker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  scrollContent: {
    paddingTop: 140,
  },
  stickyHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: { 
    borderRadius: 16, 
    overflow: 'hidden' 
  },
  backBlur: { 
    width: 44, 
    height: 44, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  headerCenter: { 
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitleLarge: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.5 
  },
  headerSubtitle: { 
    fontSize: 13, 
    color: '#64748b', 
    marginTop: 2, 
    fontWeight: '500' 
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionBlur: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  addButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyTitleContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 80,
  },
  stickyBlur: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  stickyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  stickySubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  activitySelectorContainer: {
    marginBottom: 16,
  },
  activitySelector: { 
    paddingHorizontal: 20, 
    paddingBottom: 8,
    gap: 10 
  },
  activityTab: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.8)', 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.05)', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activityEmoji: { 
    fontSize: 20 
  },
  activityLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#64748b' 
  },
  customBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ffd700',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '800',
  },
  statsContainer: { 
    marginBottom: 16 
  },
  statsContent: { 
    paddingHorizontal: 20, 
    gap: 12 
  },
  statCard: { 
    borderRadius: 20, 
    padding: 16, 
    justifyContent: 'space-between', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 4 
  },
  primaryStatCard: { 
    width: 140, 
    height: 140 
  },
  primaryStatEmoji: { 
    fontSize: 32 
  },
  primaryStatNumber: { 
    fontSize: 36, 
    fontWeight: '800', 
    color: '#fff', 
    letterSpacing: -1 
  },
  primaryStatLabel: { 
    fontSize: 13, 
    color: 'rgba(255,255,255,0.9)', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  secondaryStatCard: { 
    width: 100, 
    height: 140, 
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  secondaryStatEmoji: { 
    fontSize: 24 
  },
  secondaryStatNumber: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.5 
  },
  secondaryStatLabel: { 
    fontSize: 11, 
    color: '#64748b', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  filterContainer: { 
    paddingHorizontal: 20, 
    marginBottom: 12 
  },
  timeRangeTabs: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.8)', 
    borderRadius: 12, 
    padding: 4, 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.05)' 
  },
  timeTab: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  timeTabText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#64748b' 
  },
  timelineContainer: { 
    paddingHorizontal: 20, 
    paddingBottom: 100 
  },
  daySection: { 
    marginBottom: 24 
  },
  dateHeaderContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16, 
    marginLeft: 4 
  },
  dateHeader: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.3 
  },
  dateBadge: { 
    borderRadius: 10, 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    marginLeft: 10 
  },
  dateBadgeText: { 
    fontSize: 12, 
    fontWeight: '700' 
  },
  entriesContainer: { 
    gap: 12 
  },
  entryRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start' 
  },
  timeColumn: { 
    width: 70, 
    alignItems: 'flex-start', 
    paddingTop: 16 
  },
  timeText: { 
    fontSize: 13, 
    fontWeight: '700' 
  },
  timelineLine: { 
    width: 2, 
    height: 80, 
    marginLeft: 20, 
    marginTop: 8, 
    borderRadius: 1 
  },
  entryCardContainer: { 
    flex: 1 
  },
  entryCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.05)', 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14 
  },
  typeEmoji: { 
    fontSize: 28 
  },
  entryContent: { 
    flex: 1 
  },
  entryTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#1e293b', 
    marginBottom: 4 
  },
  entrySubtitle: { 
    fontSize: 13, 
    color: '#64748b', 
    marginBottom: 4, 
    lineHeight: 18 
  },
  timestampText: { 
    fontSize: 11, 
    color: '#94a3b8', 
    fontWeight: '500' 
  },
  entryActions: { 
    flexDirection: 'row', 
    gap: 4 
  },
  actionButton: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: 'rgba(255,255,255,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 60 
  },
  emptyIconContainer: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: 'rgba(255,255,255,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyEmoji: { 
    fontSize: 64 
  },
  emptyTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#1e293b', 
    marginBottom: 8 
  },
  emptySubtitle: { 
    fontSize: 15, 
    color: '#94a3b8', 
    textAlign: 'center', 
    marginBottom: 24, 
    paddingHorizontal: 40, 
    lineHeight: 22 
  },
  emptyButton: { 
    borderRadius: 16, 
    overflow: 'hidden', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 6 
  },
  emptyButtonGradient: { 
    paddingHorizontal: 28, 
    paddingVertical: 16 
  },
  emptyButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: 'rgba(255,255,255,0.98)', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    paddingBottom: 40, 
    maxHeight: '90%' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 4 
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1e293b' 
  },
  modalSubtitle: { 
    fontSize: 14, 
    color: '#64748b', 
    marginTop: 4, 
    fontWeight: '500' 
  },
  modalClose: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(0,0,0,0.05)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  errorsContainer: { 
    backgroundColor: '#fef2f2', 
    borderRadius: 12, 
    padding: 12, 
    marginVertical: 16, 
    borderLeftWidth: 4, 
    borderLeftColor: '#ef4444' 
  },
  errorText: { 
    color: '#ef4444', 
    fontSize: 13, 
    fontWeight: '500' 
  },
  modalScroll: { 
    maxHeight: 500 
  },
  fieldContainer: { 
    marginBottom: 16 
  },
  fieldLabel: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#1e293b', 
    marginBottom: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  textInput: { 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.1)', 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 15, 
    color: '#1e293b', 
    backgroundColor: 'rgba(255,255,255,0.6)' 
  },
  textareaInput: { 
    minHeight: 80, 
    textAlignVertical: 'top' 
  },
  optionsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },
  optionButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.6)', 
    borderWidth: 2, 
    borderColor: 'transparent', 
    gap: 6 
  },
  optionEmoji: { 
    fontSize: 20 
  },
  optionLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#64748b' 
  },
  toggleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 14, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.6)' 
  },
  durationContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  durationButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.6)', 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.05)' 
  },
  durationText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#64748b' 
  },
  ratingContainer: { 
    flexDirection: 'row', 
    gap: 8 
  },
  photoButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    padding: 16, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.6)', 
    borderWidth: 2, 
    borderColor: 'rgba(0,0,0,0.1)', 
    borderStyle: 'dashed' 
  },
  photoButtonText: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#64748b' 
  },
  saveButton: { 
    marginTop: 24, 
    borderRadius: 16, 
    overflow: 'hidden', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 12, 
    elevation: 6 
  },
  saveGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    paddingVertical: 16 
  },
  saveText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  loadingContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  loadingText: { 
    fontSize: 16, 
    color: '#64748b', 
    fontWeight: '500' 
  },
  bottomPadding: { 
    height: 40 
  },
  addTrackerButton: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  addTrackerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  addTrackerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  trackerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  trackerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  trackerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  trackerMeta: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  trackerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  trackerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  emptyCustomTrackers: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCustomTrackersText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  emptyCustomTrackersSub: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#1e293b',
    transform: [{ scale: 1.1 }],
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
});

export { DEFAULT_TRACKERS };
export type { CustomTracker, FieldConfig };