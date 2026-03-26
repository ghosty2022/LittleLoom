// src/screens/UniversalAddLogScreen.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  FadeInDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useActivity, ActivityEntry, ActivityType } from '../context/ActivityContext';
import { useBaby } from '../context/BabyContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');

// ==================== FIELD CONFIGURATION TYPES ====================

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
  | 'date' 
  | 'time'
  | 'temperature'
  | 'measurement';

export interface FieldOption {
  id: string;
  label: string;
  emoji?: string;
  icon?: string;
  color?: string;
}

export interface FieldConfig {
  id: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  placeholder?: string;
  required?: boolean;
  showIf?: (data: any) => boolean;
  max?: number;
  min?: number;
  unit?: string;
  step?: number;
  defaultValue?: any;
}

export interface LogTypeConfig {
  id: ActivityType;
  name: string;
  emoji: string;
  icon: string;
  color: string;
  gradient: [string, string];
  fields: FieldConfig[];
  quickTags: string[];
  description: string;
  isCustom?: boolean;
  createdAt?: number;
}

// ==================== DEFAULT LOG TYPES ====================

const DEFAULT_LOG_TYPES: Record<string, LogTypeConfig> = {
  potty: {
    id: 'potty',
    name: 'Potty',
    emoji: '🚽',
    icon: 'water-outline',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    description: 'Track bathroom visits and potty training progress',
    fields: [
      { 
        id: 'pottyType', 
        label: 'Type', 
        type: 'select', 
        required: true,
        options: [
          { id: 'pee', label: 'Pee', emoji: '💧', color: '#3b82f6' },
          { id: 'poop', label: 'Poop', emoji: '💩', color: '#8b5cf6' },
          { id: 'both', label: 'Both', emoji: '💧💩', color: '#06b6d4' },
          { id: 'accident', label: 'Accident', emoji: '⚠️', color: '#ef4444' },
          { id: 'attempt', label: 'Attempt', emoji: '⏰', color: '#f59e0b' },
        ]
      },
      { 
        id: 'location', 
        label: 'Location', 
        type: 'select',
        options: [
          { id: 'potty', label: 'Potty Chair', icon: 'body-outline' },
          { id: 'toilet', label: 'Toilet', icon: 'man-outline' },
          { id: 'floor', label: 'Floor', icon: 'map-outline' },
          { id: 'diaper', label: 'Diaper', icon: 'shirt-outline' },
          { id: 'bed', label: 'Bed', icon: 'bed-outline' },
        ]
      },
      { id: 'successful', label: 'Successful', type: 'toggle', defaultValue: true },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any details about the visit...' },
    ],
    quickTags: ['Self-initiated', 'With help', 'Dry night', 'Accident', 'Success', 'No success', 'Before bed', 'After meal'],
  },

  feed: {
    id: 'feed',
    name: 'Feed',
    emoji: '🍼',
    icon: 'nutrition-outline',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    description: 'Track breastfeeding, bottles, and solid foods',
    fields: [
      { 
        id: 'feedType', 
        label: 'Feed Type', 
        type: 'select', 
        required: true,
        options: [
          { id: 'breast', label: 'Breast', emoji: '🤱', color: '#ec4899' },
          { id: 'bottle', label: 'Bottle', emoji: '🍼', color: '#3b82f6' },
          { id: 'solid', label: 'Solid Food', emoji: '🥄', color: '#f59e0b' },
          { id: 'snack', label: 'Snack', emoji: '🍎', color: '#10b981' },
          { id: 'water', label: 'Water', emoji: '💧', color: '#06b6d4' },
        ]
      },
      { 
        id: 'amount', 
        label: 'Amount', 
        type: 'number', 
        placeholder: 'Amount',
        unit: 'oz/ml',
        showIf: (data) => ['bottle', 'water'].includes(data.feedType)
      },
      { 
        id: 'duration', 
        label: 'Duration', 
        type: 'duration',
        showIf: (data) => ['breast', 'bottle'].includes(data.feedType)
      },
      { 
        id: 'side', 
        label: 'Side', 
        type: 'select',
        options: [
          { id: 'left', label: 'Left', emoji: '⬅️' },
          { id: 'right', label: 'Right', emoji: '➡️' },
          { id: 'both', label: 'Both', emoji: '↔️' },
        ],
        showIf: (data) => data.feedType === 'breast'
      },
      { 
        id: 'food', 
        label: 'Food Items', 
        type: 'text', 
        placeholder: 'What did they eat?',
        showIf: (data) => ['solid', 'snack'].includes(data.feedType)
      },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any reactions or preferences...' },
    ],
    quickTags: ['Liked it', 'Disliked', 'Allergic reaction', 'Spit up', 'Finished all', 'Left some', 'Hungry', 'Not interested'],
  },

  sleep: {
    id: 'sleep',
    name: 'Sleep',
    emoji: '😴',
    icon: 'moon-outline',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    description: 'Track naps and nighttime sleep',
    fields: [
      { 
        id: 'sleepType', 
        label: 'Sleep Type', 
        type: 'select', 
        required: true,
        options: [
          { id: 'nap', label: 'Nap', emoji: '☀️', color: '#f59e0b' },
          { id: 'night', label: 'Night Sleep', emoji: '🌙', color: '#6366f1' },
          { id: 'wake', label: 'Wake Window', emoji: '👀', color: '#10b981' },
        ]
      },
      { id: 'duration', label: 'Duration', type: 'duration', required: true },
      { 
        id: 'quality', 
        label: 'Sleep Quality', 
        type: 'rating', 
        max: 5,
        defaultValue: 3
      },
      { 
        id: 'location', 
        label: 'Location', 
        type: 'select',
        options: [
          { id: 'crib', label: 'Crib', icon: 'bed-outline' },
          { id: 'bed', label: 'Parent Bed', icon: 'people-outline' },
          { id: 'stroller', label: 'Stroller', icon: 'walk-outline' },
          { id: 'car', label: 'Car', icon: 'car-outline' },
          { id: 'carrier', label: 'Carrier', icon: 'body-outline' },
          { id: 'arms', label: 'In Arms', icon: 'hand-left-outline' },
        ]
      },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'How did they sleep?' },
    ],
    quickTags: ['Self-soothed', 'Needed rocking', 'Woke up crying', 'Peaceful', 'Short nap', 'Long nap', 'Easy bedtime', 'Fought sleep'],
  },

  growth: {
    id: 'growth',
    name: 'Growth',
    emoji: '📏',
    icon: 'trending-up-outline',
    color: '#43e97b',
    gradient: ['#43e97b', '#38f9d7'],
    description: 'Track height, weight, and head circumference',
    fields: [
      { 
        id: 'measurementType', 
        label: 'Measurement Type', 
        type: 'select', 
        required: true,
        options: [
          { id: 'weight', label: 'Weight', emoji: '⚖️', color: '#f59e0b' },
          { id: 'height', label: 'Height', emoji: '📏', color: '#3b82f6' },
          { id: 'head', label: 'Head Circumference', emoji: '🧠', color: '#ec4899' },
          { id: 'temperature', label: 'Temperature', emoji: '🌡️', color: '#ef4444' },
        ]
      },
      { 
        id: 'value', 
        label: 'Value', 
        type: 'number', 
        required: true,
        step: 0.1
      },
      { 
        id: 'unit', 
        label: 'Unit', 
        type: 'select',
        options: [
          { id: 'kg', label: 'kg' },
          { id: 'lb', label: 'lb' },
          { id: 'oz', label: 'oz' },
          { id: 'cm', label: 'cm' },
          { id: 'in', label: 'in' },
          { id: 'celsius', label: '°C' },
          { id: 'fahrenheit', label: '°F' },
        ]
      },
      { 
        id: 'percentile', 
        label: 'Percentile', 
        type: 'number', 
        placeholder: 'Optional',
        min: 0, 
        max: 100 
      },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any observations...' },
    ],
    quickTags: ['Doctor visit', 'Home measurement', 'New milestone', 'Concern', 'Normal range', 'Above average', 'Below average'],
  },

  medication: {
    id: 'medication',
    name: 'Medication',
    emoji: '💊',
    icon: 'medical-outline',
    color: '#ff6b6b',
    gradient: ['#ff6b6b', '#ee5a5a'],
    description: 'Track medicines, vitamins, and vaccines',
    fields: [
      { 
        id: 'medName', 
        label: 'Medicine Name', 
        type: 'text', 
        required: true, 
        placeholder: 'e.g., Tylenol, Vitamin D' 
      },
      { 
        id: 'dosage', 
        label: 'Dosage', 
        type: 'text', 
        required: true, 
        placeholder: 'e.g., 5ml, 1 tablet' 
      },
      { 
        id: 'medType', 
        label: 'Type', 
        type: 'select',
        options: [
          { id: 'fever', label: 'Fever/Pain', emoji: '🤒', color: '#ef4444' },
          { id: 'vitamin', label: 'Vitamin', emoji: '💊', color: '#f59e0b' },
          { id: 'antibiotic', label: 'Antibiotic', emoji: '🔬', color: '#3b82f6' },
          { id: 'allergy', label: 'Allergy', emoji: '🤧', color: '#10b981' },
          { id: 'vaccine', label: 'Vaccine', emoji: '💉', color: '#8b5cf6' },
          { id: 'other', label: 'Other', emoji: '📋', color: '#6b7280' },
        ]
      },
      { id: 'reason', label: 'Reason', type: 'text', placeholder: 'Why was this given?' },
      { 
        id: 'givenBy', 
        label: 'Given By', 
        type: 'select',
        options: [
          { id: 'parent1', label: 'Parent 1' },
          { id: 'parent2', label: 'Parent 2' },
          { id: 'doctor', label: 'Doctor' },
          { id: 'grandparent', label: 'Grandparent' },
          { id: 'other', label: 'Other' },
        ]
      },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any reactions or notes...' },
    ],
    quickTags: ['No reaction', 'Mild reaction', 'Slept after', 'Fussy after', 'Took easily', 'Refused at first', 'With food', 'Empty stomach'],
  },

  milestone: {
    id: 'milestone',
    name: 'Milestone',
    emoji: '🏆',
    icon: 'trophy-outline',
    color: '#ffd700',
    gradient: ['#ffd700', '#ffaa00'],
    description: 'Celebrate achievements and firsts',
    fields: [
      { 
        id: 'milestoneType', 
        label: 'Category', 
        type: 'select', 
        required: true,
        options: [
          { id: 'motor', label: 'Motor Skills', emoji: '🏃', color: '#3b82f6' },
          { id: 'cognitive', label: 'Cognitive', emoji: '🧠', color: '#8b5cf6' },
          { id: 'social', label: 'Social', emoji: '👋', color: '#f59e0b' },
          { id: 'language', label: 'Language', emoji: '🗣️', color: '#ec4899' },
          { id: 'emotional', label: 'Emotional', emoji: '❤️', color: '#ef4444' },
          { id: 'other', label: 'Other', emoji: '✨', color: '#10b981' },
        ]
      },
      { 
        id: 'title', 
        label: 'Milestone', 
        type: 'text', 
        required: true, 
        placeholder: 'What did they do?' 
      },
      { id: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe what happened...' },
      { id: 'firstTime', label: 'First Time', type: 'toggle', defaultValue: true },
      { id: 'photo', label: 'Add Photo', type: 'photo' },
    ],
    quickTags: ['First time', 'Practicing', 'Mastered', 'Surprised us', 'Early', 'Right on time', 'With help', 'Independent'],
  },

  diaper: {
    id: 'diaper',
    name: 'Diaper',
    emoji: '🧷',
    icon: 'shirt-outline',
    color: '#fc5c7d',
    gradient: ['#fc5c7d', '#fd79a8'],
    description: 'Track diaper changes and contents',
    fields: [
      { 
        id: 'diaperType', 
        label: 'Type', 
        type: 'select', 
        required: true,
        options: [
          { id: 'wet', label: 'Wet', emoji: '💧', color: '#3b82f6' },
          { id: 'dirty', label: 'Dirty', emoji: '💩', color: '#8b5cf6' },
          { id: 'both', label: 'Both', emoji: '💧💩', color: '#06b6d4' },
          { id: 'dry', label: 'Dry', emoji: '✓', color: '#10b981' },
          { id: 'blowout', label: 'Blowout', emoji: '💥', color: '#ef4444' },
        ]
      },
      { id: 'rash', label: 'Rash Present', type: 'toggle' },
      { 
        id: 'cream', 
        label: 'Cream Applied', 
        type: 'select',
        options: [
          { id: 'none', label: 'None' },
          { id: 'zinc', label: 'Zinc Oxide', emoji: '🧴' },
          { id: 'petroleum', label: 'Petroleum Jelly', emoji: '🛢️' },
          { id: 'antifungal', label: 'Antifungal', emoji: '🔬' },
          { id: 'other', label: 'Other', emoji: '📋' },
        ]
      },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Color, consistency, any concerns...' },
    ],
    quickTags: ['Normal', 'Loose stool', 'Constipated', 'Teething', 'New food', 'Redness', 'Irritated skin', 'Cleared up'],
  },

  temperature: {
    id: 'temperature',
    name: 'Temperature',
    emoji: '🌡️',
    icon: 'thermometer-outline',
    color: '#ef4444',
    gradient: ['#ef4444', '#dc2626'],
    description: 'Track fever and body temperature',
    fields: [
      { 
        id: 'tempValue', 
        label: 'Temperature', 
        type: 'number', 
        required: true,
        step: 0.1,
        placeholder: '36.5'
      },
      { 
        id: 'tempUnit', 
        label: 'Unit', 
        type: 'select',
        options: [
          { id: 'celsius', label: '°C Celsius' },
          { id: 'fahrenheit', label: '°F Fahrenheit' },
        ],
        defaultValue: 'celsius'
      },
      { 
        id: 'method', 
        label: 'Measurement Method', 
        type: 'select',
        options: [
          { id: 'oral', label: 'Oral', icon: 'mouth-outline' },
          { id: 'ear', label: 'Ear', icon: 'ear-outline' },
          { id: 'forehead', label: 'Forehead', icon: 'scan-outline' },
          { id: 'armpit', label: 'Armpit', icon: 'body-outline' },
          { id: 'rectal', label: 'Rectal', icon: 'thermometer-outline' },
        ]
      },
      { 
        id: 'symptoms', 
        label: 'Symptoms', 
        type: 'multiselect',
        options: [
          { id: 'fussy', label: 'Fussy', emoji: '😢' },
          { id: 'lethargic', label: 'Lethargic', emoji: '😴' },
          { id: 'eating_less', label: 'Eating Less', emoji: '🍼' },
          { id: 'sleeping_more', label: 'Sleeping More', emoji: '🛏️' },
          { id: 'rash', label: 'Rash', emoji: '🔴' },
          { id: 'cough', label: 'Cough', emoji: '😷' },
          { id: 'none', label: 'None', emoji: '✅' },
        ]
      },
      { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'How are they acting? Any other symptoms?' },
    ],
    quickTags: ['Fever', 'Normal temp', 'Teething', 'After vaccine', 'Before bed', 'Woke up hot', 'Medicine given', 'Doctor called'],
  },

  note: {
    id: 'note',
    name: 'Note',
    emoji: '📝',
    icon: 'document-text-outline',
    color: '#94a3b8',
    gradient: ['#94a3b8', '#64748b'],
    description: 'General notes and observations',
    fields: [
      { 
        id: 'title', 
        label: 'Title', 
        type: 'text', 
        required: true, 
        placeholder: 'What is this about?' 
      },
      { id: 'content', label: 'Content', type: 'textarea', placeholder: 'Write your note here...' },
      { 
        id: 'mood', 
        label: 'Mood', 
        type: 'select',
        options: [
          { id: 'happy', label: 'Happy', emoji: '😊', color: '#f59e0b' },
          { id: 'neutral', label: 'Neutral', emoji: '😐', color: '#94a3b8' },
          { id: 'sad', label: 'Sad', emoji: '😢', color: '#3b82f6' },
          { id: 'excited', label: 'Excited', emoji: '🤩', color: '#ec4899' },
          { id: 'tired', label: 'Tired', emoji: '😴', color: '#8b5cf6' },
          { id: 'sick', label: 'Sick', emoji: '🤒', color: '#ef4444' },
        ]
      },
      { id: 'photo', label: 'Attach Photo', type: 'photo' },
    ],
    quickTags: ['Cute moment', 'Funny', 'Concern', 'Question for doctor', 'New skill', 'Bad day', 'Great day', 'Routine'],
  },
};

// ==================== CUSTOM TRACKER STORAGE ====================

const CUSTOM_TRACKERS_KEY = '@littleloom_custom_log_types';

// ==================== COMPONENTS ====================

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: any;
  logType: LogTypeConfig;
  babyName: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  data,
  logType,
  babyName,
}) => {
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

  const formatValue = (key: string, value: any) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  const previewData = Object.entries(data).filter(([key, value]) => {
    if (['id', 'timestamp', 'babyId', 'loggedBy', 'loggedByName', 'type', 'title', 'details'].includes(key)) return false;
    return formatValue(key, value) !== null;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContent, animatedStyle]}>
          <LinearGradient
            colors={['#ffffff', '#f8fafc']}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: `${logType.color}20` }]}>
                <Text style={styles.modalIcon}>{logType.emoji}</Text>
              </View>
              <Text style={styles.modalTitle}>Confirm {logType.name}</Text>
              <Text style={styles.modalSubtitle}>For {babyName}</Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.previewCard}>
                <Text style={styles.previewTime}>
                  {format(data.timestamp || Date.now(), 'MMM d, yyyy • h:mm a')}
                </Text>
                
                {data.title && (
                  <Text style={styles.previewTitle}>{data.title}</Text>
                )}
                
                {data.details && (
                  <Text style={styles.previewDetails}>{data.details}</Text>
                )}

                {previewData.length > 0 && (
                  <View style={styles.previewFields}>
                    {previewData.map(([key, value]) => (
                      <View key={key} style={styles.previewField}>
                        <Text style={styles.previewFieldLabel}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Text>
                        <Text style={styles.previewFieldValue}>{formatValue(key, value)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {data.notes && (
                  <View style={styles.previewNotes}>
                    <Ionicons name="chatbubble-outline" size={16} color="#64748b" />
                    <Text style={styles.previewNotesText}>{data.notes}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={onConfirm} style={styles.confirmButton}>
                <LinearGradient
                  colors={logType.gradient}
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

interface CustomTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (tracker: LogTypeConfig) => void;
}

const CustomTrackerModal: React.FC<CustomTrackerModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📊');
  const [selectedColor, setSelectedColor] = useState('#667eea');
  const [step, setStep] = useState(1);

  const colors = [
    '#667eea', '#fa709a', '#11998e', '#43e97b', '#ff6b6b',
    '#ffd700', '#fc5c7d', '#94a3b8', '#a855f7', '#ec4899',
    '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
    '#6366f1', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
  ];

  const handleSave = () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const newTracker: LogTypeConfig = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      emoji: emoji || '📊',
      icon: 'analytics-outline',
      color: selectedColor,
      gradient: [selectedColor, selectedColor],
      description: `Custom tracker for ${name.trim()}`,
      fields: [
        { id: 'value', label: 'Value', type: 'text', required: true },
        { id: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional details...' },
      ],
      quickTags: ['Regular', 'Important', 'Follow up'],
      isCustom: true,
      createdAt: Date.now(),
    };

    onSave(newTracker);
    reset();
  };

  const reset = () => {
    setName('');
    setEmoji('📊');
    setSelectedColor('#667eea');
    setStep(1);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <BlurView intensity={95} style={styles.customModalContent}>
          <View style={styles.customModalHeader}>
            <Text style={styles.customModalTitle}>Create Custom Tracker</Text>
            <TouchableOpacity onPress={onClose} style={styles.customModalClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tracker Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Brushing Teeth, Reading Time..."
                value={name}
                onChangeText={setName}
                maxLength={30}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Emoji Icon</Text>
              <TextInput
                style={[styles.textInput, styles.emojiInput]}
                placeholder="📊"
                maxLength={2}
                value={emoji}
                onChangeText={setEmoji}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Color Theme</Text>
              <View style={styles.colorGrid}>
                {colors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedColor(color);
                    }}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.createButton} onPress={handleSave}>
              <LinearGradient
                colors={[selectedColor, selectedColor]}
                style={styles.createGradient}
              >
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.createButtonText}>Create Tracker</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ==================== MAIN SCREEN ====================

type UniversalAddLogRouteProp = RouteProp<RootStackParamList, 'AddLog'>;
type UniversalAddLogNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function UniversalAddLogScreen() {
  const navigation = useNavigation<UniversalAddLogNavigationProp>();
  const route = useRoute<UniversalAddLogRouteProp>();
  
  const { addEntry, updateEntry, getEntryById } = useActivity();
  const { currentBaby } = useBaby();
  const { userProfile } = useAuth();

  const [logTypes, setLogTypes] = useState<Record<string, LogTypeConfig>>(DEFAULT_LOG_TYPES);
  const [selectedType, setSelectedType] = useState<ActivityType>(route.params?.type || 'potty');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Load custom trackers
  useEffect(() => {
    loadCustomTrackers();
  }, []);

  // Handle edit mode
  useEffect(() => {
    if (route.params?.editMode && route.params?.eventId) {
      const entry = getEntryById(route.params.eventId);
      if (entry) {
        setIsEditMode(true);
        setEditEntryId(entry.id);
        setSelectedType(entry.type);
        setDate(new Date(entry.timestamp));
        setFormData(entry);
        if (entry.tags) setSelectedTags(entry.tags);
      }
    }
  }, [route.params]);

  const loadCustomTrackers = async () => {
    try {
      const stored = await AsyncStorage.getItem(CUSTOM_TRACKERS_KEY);
      if (stored) {
        const custom = JSON.parse(stored);
        setLogTypes(prev => ({ ...prev, ...custom }));
      }
    } catch (e) {
      console.error('Failed to load custom trackers', e);
    }
  };

  const saveCustomTracker = async (tracker: LogTypeConfig) => {
    try {
      const stored = await AsyncStorage.getItem(CUSTOM_TRACKERS_KEY);
      const custom = stored ? JSON.parse(stored) : {};
      custom[tracker.id] = tracker;
      await AsyncStorage.setItem(CUSTOM_TRACKERS_KEY, JSON.stringify(custom));
      
      setLogTypes(prev => ({ ...prev, [tracker.id]: tracker }));
      setSelectedType(tracker.id);
      setShowCustomModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Failed to save custom tracker', e);
    }
  };

  const currentConfig = logTypes[selectedType] || logTypes['potty'];

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear errors when user makes changes
    if (errors.length > 0) setErrors([]);
  };

  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    
    currentConfig.fields.forEach(field => {
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
    const data = formData;
    
    switch (selectedType) {
      case 'potty':
        const pottyType = currentConfig.fields.find(f => f.id === 'pottyType')?.options?.find(o => o.id === data.pottyType);
        return `${pottyType?.label || 'Potty'} ${data.successful ? '✓' : ''}`;
      
      case 'feed':
        const feedType = currentConfig.fields.find(f => f.id === 'feedType')?.options?.find(o => o.id === data.feedType);
        return `${feedType?.label || 'Feed'}${data.amount ? ` (${data.amount})` : ''}`;
      
      case 'sleep':
        const sleepType = currentConfig.fields.find(f => f.id === 'sleepType')?.options?.find(o => o.id === data.sleepType);
        return `${sleepType?.label || 'Sleep'}${data.duration ? ` • ${data.duration}` : ''}`;
      
      case 'growth':
        const measureType = currentConfig.fields.find(f => f.id === 'measurementType')?.options?.find(o => o.id === data.measurementType);
        return `${measureType?.label || 'Measurement'}: ${data.value || ''}${data.unit || ''}`;
      
      case 'medication':
        return `${data.medName || 'Medicine'} ${data.dosage || ''}`;
      
      case 'milestone':
        return `🌟 ${data.title || 'New Milestone'}`;
      
      case 'diaper':
        const diaperType = currentConfig.fields.find(f => f.id === 'diaperType')?.options?.find(o => o.id === data.diaperType);
        return `${diaperType?.label || 'Diaper'} Change`;
      
      case 'temperature':
        return `🌡️ ${data.tempValue || ''}${data.tempUnit === 'fahrenheit' ? '°F' : '°C'}`;
      
      case 'note':
        return data.title || 'Note';
      
      default:
        return `${currentConfig.emoji} ${currentConfig.name}`;
    }
  };

  const buildDetails = (): string => {
    const details: string[] = [];
    const data = formData;

    currentConfig.fields.forEach(field => {
      if (field.id === 'notes' || field.id === 'description' || field.id === 'content') return;
      
      const value = data[field.id];
      if (value === undefined || value === null || value === '') return;
      
      if (field.showIf && !field.showIf(data)) return;

      if (field.type === 'toggle') {
        if (value) details.push(field.label);
      } else if (field.type === 'select') {
        const option = field.options?.find(o => o.id === value);
        if (option) details.push(`${field.label}: ${option.label}`);
      } else if (field.type === 'multiselect') {
        const labels = value.map((v: string) => field.options?.find(o => o.id === v)?.label).filter(Boolean);
        if (labels.length) details.push(`${field.label}: ${labels.join(', ')}`);
      } else if (field.type === 'rating') {
        details.push(`${field.label}: ${'⭐'.repeat(value)}`);
      } else if (field.type === 'duration') {
        details.push(`${field.label}: ${value}`);
      } else {
        details.push(`${field.label}: ${value}${field.unit ? field.unit : ''}`);
      }
    });

    return details.join(' • ');
  };

  const handleSave = () => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const entryData = {
      ...formData,
      type: selectedType,
      title: buildTitle(),
      details: buildDetails(),
      timestamp: date.getTime(),
      babyId: currentBaby?.id || '',
      loggedBy: userProfile?.id || 'unknown',
      loggedByName: userProfile?.fullName?.split(' ')[0] || 'Parent',
      tags: selectedTags,
      icon: currentConfig.emoji,
    };

    setShowConfirmation(true);
  };

  const confirmSave = async () => {
    try {
      const entryData = {
        ...formData,
        type: selectedType,
        title: buildTitle(),
        details: buildDetails(),
        timestamp: date.getTime(),
        babyId: currentBaby?.id || '',
        loggedBy: userProfile?.id || 'unknown',
        loggedByName: userProfile?.fullName?.split(' ')[0] || 'Parent',
        tags: selectedTags,
        icon: currentConfig.emoji,
      };

      if (isEditMode && editEntryId) {
        await updateEntry(editEntryId, entryData);
      } else {
        await addEntry(entryData);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfirmation(false);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save entry:', error);
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    }
  };

  const renderField = (field: FieldConfig) => {
    // Check conditional visibility
    if (field.showIf && !field.showIf(formData)) {
      return null;
    }

    const value = formData[field.id] ?? field.defaultValue;

    switch (field.type) {
      case 'text':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && <Text style={styles.required}> *</Text>}</Text>
            <TextInput
              style={[styles.textInput, errors.some(e => e.includes(field.label)) && styles.inputError]}
              placeholder={field.placeholder}
              value={value || ''}
              onChangeText={(text) => handleFieldChange(field.id, text)}
            />
          </Animated.View>
        );

      case 'number':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && <Text style={styles.required}> *</Text>}</Text>
            <View style={styles.numberInputContainer}>
              <TextInput
                style={[styles.numberInput, errors.some(e => e.includes(field.label)) && styles.inputError]}
                placeholder={field.placeholder}
                value={value?.toString() || ''}
                onChangeText={(text) => handleFieldChange(field.id, parseFloat(text) || text)}
                keyboardType="decimal-pad"
              />
              {field.unit && <Text style={styles.unitLabel}>{field.unit}</Text>}
            </View>
          </Animated.View>
        );

      case 'textarea':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={[styles.textareaInput, errors.some(e => e.includes(field.label)) && styles.inputError]}
              placeholder={field.placeholder}
              value={value || ''}
              onChangeText={(text) => handleFieldChange(field.id, text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>
        );

      case 'select':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && <Text style={styles.required}> *</Text>}</Text>
            <View style={styles.optionsContainer}>
              {field.options?.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    value === option.id && { 
                      backgroundColor: `${currentConfig.color}20`,
                      borderColor: currentConfig.color,
                      borderWidth: 2
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleFieldChange(field.id, option.id);
                  }}
                >
                  {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                  {option.icon && (
                    <Ionicons 
                      name={option.icon as any} 
                      size={20} 
                      color={value === option.id ? currentConfig.color : '#64748b'} 
                    />
                  )}
                  <Text style={[
                    styles.optionLabel,
                    value === option.id && { color: currentConfig.color, fontWeight: '700' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );

      case 'multiselect':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && <Text style={styles.required}> *</Text>}</Text>
            <View style={styles.optionsContainer}>
              {field.options?.map((option) => {
                const isSelected = (value || []).includes(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton,
                      isSelected && { 
                        backgroundColor: `${currentConfig.color}20`,
                        borderColor: currentConfig.color,
                        borderWidth: 2
                      }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const current = value || [];
                      const updated = isSelected
                        ? current.filter((v: string) => v !== option.id)
                        : [...current, option.id];
                      handleFieldChange(field.id, updated);
                    }}
                  >
                    {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                    <Text style={[
                      styles.optionLabel,
                      isSelected && { color: currentConfig.color, fontWeight: '700' }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        );

      case 'toggle':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <View style={styles.toggleContainer}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Switch
                value={value || false}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleFieldChange(field.id, val);
                }}
                trackColor={{ false: '#e2e8f0', true: `${currentConfig.color}50` }}
                thumbColor={value ? currentConfig.color : '#fff'}
              />
            </View>
          </Animated.View>
        );

      case 'duration':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && <Text style={styles.required}> *</Text>}</Text>
            <View style={styles.durationContainer}>
              {['5m', '10m', '15m', '20m', '30m', '45m', '1h', '1.5h', '2h', '3h+'].map((dur) => (
                <TouchableOpacity
                  key={dur}
                  style={[
                    styles.durationButton,
                    value === dur && { backgroundColor: currentConfig.color }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleFieldChange(field.id, dur);
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
          </Animated.View>
        );

      case 'rating':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleFieldChange(field.id, star);
                  }}
                >
                  <Ionicons
                    name={star <= (value || 0) ? "star" : "star-outline"}
                    size={36}
                    color={star <= (value || 0) ? '#ffd700' : '#e2e8f0'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );

      case 'temperature':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && <Text style={styles.required}> *</Text>}</Text>
            <View style={styles.tempContainer}>
              <View style={styles.tempInputWrapper}>
                <TextInput
                  style={[styles.tempInput, errors.some(e => e.includes(field.label)) && styles.inputError]}
                  placeholder="36.5"
                  value={value?.toString() || ''}
                  onChangeText={(text) => handleFieldChange(field.id, parseFloat(text) || text)}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.tempUnit}>°C / °F</Text>
              </View>
              <View style={styles.tempScale}>
                <View style={styles.tempIndicator}>
                  <View style={[styles.tempBar, { backgroundColor: value > 38 || value > 100.4 ? '#ef4444' : value > 37.5 || value > 99.5 ? '#f59e0b' : '#10b981' }]} />
                </View>
                <View style={styles.tempLabels}>
                  <Text style={styles.tempLabel}>Normal</Text>
                  <Text style={styles.tempLabel}>High</Text>
                  <Text style={styles.tempLabel}>Fever</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 'photo':
        return (
          <Animated.View entering={FadeInUp.delay(100)} key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TouchableOpacity style={styles.photoButton}>
              <Ionicons name="camera-outline" size={28} color={currentConfig.color} />
              <Text style={styles.photoButtonText}>Add Photo</Text>
              <Text style={styles.photoHint}>Tap to capture or select</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <LinearGradient 
      colors={[currentConfig.gradient[0] + '15', currentConfig.gradient[1] + '10', '#ffffff']} 
      style={styles.container}
    >
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown} style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.closeButton}
            >
              <BlurView intensity={80} style={styles.closeBlur}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </BlurView>
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {isEditMode ? 'Edit' : 'Add'} {currentConfig.name}
              </Text>
              <Text style={styles.headerSubtitle}>{currentBaby?.name || 'Baby'}</Text>
            </View>

            <TouchableOpacity 
              onPress={handleSave} 
              style={styles.saveButton}
            >
              <LinearGradient
                colors={currentConfig.gradient}
                style={styles.saveGradient}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Type Selector */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.typeSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Log Type</Text>
              <TouchableOpacity 
                onPress={() => setShowCustomModal(true)}
                style={styles.addTypeButton}
              >
                <Ionicons name="add-circle" size={20} color={currentConfig.color} />
                <Text style={[styles.addTypeText, { color: currentConfig.color }]}>Custom</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typesContainer}
            >
              {Object.values(logTypes).map((type, index) => (
                <AnimatedTouchableOpacity
                  entering={FadeIn.delay(index * 50)}
                  key={type.id}
                  style={[
                    styles.typeCard,
                    selectedType === type.id && { 
                      borderColor: type.color,
                      backgroundColor: `${type.color}20`,
                      transform: [{ scale: 1.05 }]
                    }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedType(type.id);
                    setFormData({});
                    setSelectedTags([]);
                  }}
                >
                  <Text style={styles.typeEmoji}>{type.emoji}</Text>
                  <Text style={[
                    styles.typeLabel,
                    selectedType === type.id && { color: type.color, fontWeight: '700' }
                  ]}>
                    {type.name}
                  </Text>
                  {type.isCustom && (
                    <View style={[styles.customBadge, { backgroundColor: type.color }]}>
                      <Text style={styles.customBadgeText}>★</Text>
                    </View>
                  )}
                </AnimatedTouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Date/Time */}
          <Animated.View entering={FadeInUp.delay(150)} style={styles.timeSection}>
            <Text style={styles.sectionLabel}>When</Text>
            <TouchableOpacity 
              style={styles.timeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={[styles.timeIconContainer, { backgroundColor: `${currentConfig.color}15` }]}>
                <Ionicons name="time-outline" size={22} color={currentConfig.color} />
              </View>
              <View style={styles.timeTextContainer}>
                <Text style={styles.timeMainText}>
                  {isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEE, MMM d')}
                </Text>
                <Text style={styles.timeSubText}>{format(date, 'h:mm a')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="datetime"
                display="spinner"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}
          </Animated.View>

          {/* Error Display */}
          {errors.length > 0 && (
            <Animated.View entering={FadeInDown} style={styles.errorsContainer}>
              {errors.map((error, idx) => (
                <View key={idx} style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Dynamic Fields */}
          <View style={styles.fieldsSection}>
            {currentConfig.fields.map(renderField)}
          </View>

          {/* Quick Tags */}
          <Animated.View entering={FadeInUp.delay(300)} style={styles.tagsSection}>
            <Text style={styles.sectionLabel}>Quick Tags</Text>
            <View style={styles.tagsContainer}>
              {currentConfig.quickTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    selectedTags.includes(tag) && { 
                      backgroundColor: `${currentConfig.color}30`,
                      borderColor: currentConfig.color,
                    }
                  ]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[
                    styles.tagText,
                    selectedTags.includes(tag) && { color: currentConfig.color, fontWeight: '700' }
                  ]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Bottom Padding */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={confirmSave}
        data={{
          ...formData,
          timestamp: date.getTime(),
          notes: formData.notes,
        }}
        logType={currentConfig}
        babyName={currentBaby?.name || 'Baby'}
      />

      {/* Custom Tracker Modal */}
      <CustomTrackerModal
        visible={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={saveCustomTracker}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  closeButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeBlur: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  saveGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },

  // Type Selector
  typeSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  addTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  typesContainer: {
    gap: 10,
    paddingBottom: 8,
  },
  typeCard: {
    width: 85,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typeEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  customBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '800',
  },

  // Time Section
  timeSection: {
    marginBottom: 24,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  timeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  timeTextContainer: {
    flex: 1,
  },
  timeMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  timeSubText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },

  // Errors
  errorsContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
  },

  // Fields
  fieldsSection: {
    gap: 4,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: '#ef4444',
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingRight: 16,
  },
  numberInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  unitLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  textareaInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: 'rgba(255,255,255,0.8)',
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Options
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  optionEmoji: {
    fontSize: 20,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  // Duration
  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  // Rating
  ratingContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },

  // Temperature
  tempContainer: {
    gap: 12,
  },
  tempInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 16,
  },
  tempInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  tempUnit: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  tempScale: {
    gap: 8,
  },
  tempIndicator: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tempBar: {
    height: '100%',
    width: '33%',
    borderRadius: 4,
  },
  tempLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tempLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // Photo
  photoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
    gap: 8,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  photoHint: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // Tags
  tagsSection: {
    marginTop: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  tagText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },

  // Bottom
  bottomPadding: {
    height: 100,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalIcon: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  modalBody: {
    maxHeight: 300,
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  previewTime: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  previewDetails: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 20,
  },
  previewFields: {
    gap: 8,
    marginTop: 8,
  },
  previewField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  previewFieldLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  previewFieldValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  previewNotes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  previewNotesText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Custom Modal
  customModalContent: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  customModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  customModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
  },
  customModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  emojiInput: {
    fontSize: 32,
    textAlign: 'center',
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
  createButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  createGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});