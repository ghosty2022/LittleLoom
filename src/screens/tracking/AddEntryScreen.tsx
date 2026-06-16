// AddEntryScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import { , ActivityIndicator, Alert, Animated, Button, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, type TextStyle, type ViewStyle, View } from 'react-native';;
import { LinearGradient } from 'expo-linear-gradient';
import { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  format,
  isToday,
  isYesterday,
  subDays,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useTracker } from '../../context/TrackerContext';
import { UnifiedTrackerConfig } from '../../types/trackers';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { TimelinePicker } from '../../components/trackers/TimelinePicker';
import { DynamicTrackerForm } from '../../components/trackers/DynamicTrackerForm';
import { useTrackerProgressive } from '../../hooks/useTrackerProgressive';
import type {
  ProgressiveCorrelation,
  ProgressiveReminder,
} from '../../hooks/useTrackerProgressive';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type AddEntryRouteProp = RouteProp<RootStackParamList, 'AddEntry'>;
type AddEntryNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface YesterdayEntry {
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
  notes?: string;
  tags?: string[];
  title?: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const SPRING_CONFIG = { damping: 15, stiffness: 300 };
const MODAL_BACKDROP_OPACITY = 0.5;
const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS (Stable references)
// ═══════════════════════════════════════════════════════════════

const formatFieldValue = (key: string, value: unknown): string | null => {
  'worklet';
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? null : value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const getEntryFields = (entry: YesterdayEntry) => {
  return Object.entries(entry.data || {}).filter(([k, v]) => {
    if (['id', 'timestamp', 'babyId', 'type', 'title', 'icon', 'photoUris'].includes(k)) return false;
    return formatFieldValue(k, v) !== null;
  });
};

const shouldFilterField = (k: string) =>
  ['id', 'timestamp', 'babyId', 'type', 'title', 'icon', 'photoUris'].includes(k);

// ═══════════════════════════════════════════════════════════════
// MEMOIZED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: Record<string, unknown>;
  tracker: UnifiedTrackerConfig;
  babyName: string;
  babyAvatar?: string;
  date: Date;
  notes?: string;
  tags: string[];
}

const ConfirmModal = memo<ConfirmModalProps>(({
  visible, onClose, onConfirm, data, tracker, babyName, babyAvatar, date, notes, tags,
}) => {
  const { fullThemeColors, borderRadiusValue, fontSizeMultiplier } = useCustomization();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const preview = useMemo(() =>
    Object.entries(data).filter(([k, v]) => {
      if (shouldFilterField(k)) return false;
      return formatFieldValue(k, v) !== null;
    }),
    [data]
  );

  const handleConfirm = useCallback(() => {
    HAPTIC_SUCCESS();
    onConfirm();
  }, [onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={[styles.modalOverlay, { backgroundColor: `rgba(0,0,0,${MODAL_BACKDROP_OPACITY})` }]}
        onPress={onClose}
      >
        <Animated.View
          style={[styles.modalContent, animStyle, { borderRadius: borderRadiusValue * 2 }]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={[fullThemeColors.surface, fullThemeColors.background]}
            style={[styles.modalGradient, { borderRadius: borderRadiusValue * 2 }]}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: `${tracker.gradient[0]}20`, borderRadius: borderRadiusValue }]}>
                <Text style={styles.modalIcon}>{tracker.emoji}</Text>
              </View>
              <Text style={[styles.modalTitle, { color: fullThemeColors.text, fontSize: 22 * fontSizeMultiplier }]}>
                Confirm {tracker.name}
              </Text>
              <View style={styles.modalBabyRow}>
                <SafeAvatar avatar={babyAvatar} size={28} fallbackIcon="person" borderWidth={0} animated={false} />
                <Text style={[styles.modalSubtitle, { color: fullThemeColors.textSecondary }]}>
                  For {babyName}
                </Text>
              </View>
            </View>

            <Animated.ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.previewCard, {
                backgroundColor: fullThemeColors.glassBg,
                borderColor: fullThemeColors.border,
                borderRadius: borderRadiusValue,
              }]}>
                <Text style={[styles.previewTime, { color: fullThemeColors.textSecondary }]}>
                  {format(date, 'MMM d, yyyy • h:mm a')}
                </Text>
                {(data.photoUris as string[])?.length > 0 && (
                  <View style={[styles.previewPhotoContainer, { borderRadius: borderRadiusValue }]} />
                )}
                <Text style={[styles.previewTitle, { color: fullThemeColors.text, fontSize: 18 * fontSizeMultiplier }]}>
                  {tracker.emoji} {tracker.name}
                </Text>
                {notes && <Text style={[styles.previewDetails, { color: fullThemeColors.textSecondary }]}>{notes}</Text>}
                {preview.length > 0 && (
                  <View style={styles.previewFields}>
                    {preview.map(([k, v]) => (
                      <View key={k} style={styles.previewField}>
                        <Text style={[styles.previewFieldLabel, { color: fullThemeColors.textSecondary }]}>
                          {k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                        </Text>
                        <Text style={[styles.previewFieldValue, { color: fullThemeColors.text }]}>{formatFieldValue(k, v)}</Text>
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
            </Animated.ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.cancelButton, { borderRadius: borderRadiusValue }]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Edit entry"
              >
                <Text style={[styles.cancelButtonText, { color: fullThemeColors.textSecondary }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                style={[styles.confirmButton, { borderRadius: borderRadiusValue }]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Save entry"
              >
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
      </Pressable>
    </Modal>
  );
});
ConfirmModal.displayName = 'ConfirmModal';

// ─── Yesterday Entries Modal ─────────────────────────────────────

interface YesterdayEntriesModalProps {
  visible: boolean;
  onClose: () => void;
  entries: YesterdayEntry[];
  tracker: UnifiedTrackerConfig;
  onCopyEntry: (entry: YesterdayEntry) => void;
  colors: Record<string, string>;
  borderRadiusValue: number;
  fontSizeMultiplier: number;
}

const YesterdayEntriesModal = memo<YesterdayEntriesModalProps>(({
  visible, onClose, entries, tracker, onCopyEntry, colors, borderRadiusValue, fontSizeMultiplier,
}) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleCopy = useCallback((entry: YesterdayEntry) => {
    HAPTIC_MEDIUM();
    onCopyEntry(entry);
    onClose();
  }, [onCopyEntry, onClose]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={[styles.yesterdayModalOverlay, { backgroundColor: `rgba(0,0,0,${MODAL_BACKDROP_OPACITY})` }]}
        onPress={onClose}
      >
        <Animated.View
          style={[styles.yesterdayModalContent, animStyle, { borderRadius: borderRadiusValue * 2 }]}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={[colors.surface, colors.background]}
            style={[styles.yesterdayModalGradient, { borderRadius: borderRadiusValue * 2 }]}
          >
            <View style={styles.yesterdayModalHeader}>
              <View style={[styles.yesterdayModalIconContainer, {
                backgroundColor: `${tracker.gradient[0]}20`,
                borderRadius: borderRadiusValue,
              }]}>
                <Ionicons name="calendar-outline" size={28} color={tracker.gradient[0]} />
              </View>
              <Text style={[styles.yesterdayModalTitle, { color: colors.text, fontSize: 20 * fontSizeMultiplier }]}>
                Yesterday's {tracker.name}
              </Text>
              <Text style={[styles.yesterdayModalSubtitle, { color: colors.textSecondary }]}>
                {entries.length} record{entries.length !== 1 ? 's' : ''} from yesterday
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.yesterdayCloseBtn, { borderRadius: borderRadiusValue }]}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <BlurView intensity={40} style={[styles.yesterdayCloseBlur, { borderRadius: borderRadiusValue }]} tint="dark">
                  <Ionicons name="close" size={22} color={colors.text} />
                </BlurView>
              </TouchableOpacity>
            </View>

            <Animated.ScrollView
              style={styles.yesterdayScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.yesterdayScrollContent}
            >
              {entries.map((entry, index) => {
                const fields = getEntryFields(entry);
                const entryDate = new Date(entry.timestamp);

                return (
                  <Animated.View
                    key={entry.id}
                    entering={FadeInUp.delay(index * 80).springify()}
                    style={[styles.yesterdayEntryCard, {
                      backgroundColor: colors.glassBg,
                      borderColor: colors.border,
                      borderRadius: borderRadiusValue,
                      borderWidth: 1,
                    }]}
                  >
                    <View style={styles.yesterdayEntryHeader}>
                      <View style={[styles.yesterdayTimeBadge, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                        <Ionicons name="time-outline" size={14} color={tracker.gradient[0]} />
                        <Text style={[styles.yesterdayTimeText, { color: tracker.gradient[0] }]}>
                          {format(entryDate, 'h:mm a')}
                        </Text>
                      </View>
                      {entry.title && (
                        <Text style={[styles.yesterdayEntryTitle, { color: colors.text }]} numberOfLines={1}>
                          {entry.title}
                        </Text>
                      )}
                    </View>

                    {fields.length > 0 && (
                      <View style={styles.yesterdayFieldsContainer}>
                        {fields.map(([key, value]) => (
                          <View key={key} style={styles.yesterdayFieldRow}>
                            <Text style={[styles.yesterdayFieldLabel, { color: colors.textSecondary }]}>
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                            </Text>
                            <Text style={[styles.yesterdayFieldValue, { color: colors.text }]}>
                              {formatFieldValue(key, value)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {entry.notes && (
                      <View style={[styles.yesterdayNotesContainer, { borderTopColor: `${colors.border}40` }]}>
                        <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.yesterdayNotesText, { color: colors.textSecondary }]}>
                          {entry.notes}
                        </Text>
                      </View>
                    )}

                    {entry.tags && entry.tags.length > 0 && (
                      <View style={styles.yesterdayTagsContainer}>
                        {entry.tags.map((tag, idx) => (
                          <View key={idx} style={[styles.yesterdayTag, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                            <Text style={[styles.yesterdayTagText, { color: tracker.gradient[0] }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.yesterdayCopyBtn, {
                        backgroundColor: tracker.gradient[0],
                        borderRadius: borderRadiusValue,
                      }]}
                      onPress={() => handleCopy(entry)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Copy ${tracker.name} entry from ${format(entryDate, 'h:mm a')}`}
                    >
                      <Ionicons name="copy-outline" size={16} color="#fff" />
                      <Text style={styles.yesterdayCopyBtnText}>Copy to Today</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>

            <View style={styles.yesterdayModalFooter}>
              <TouchableOpacity
                style={[styles.yesterdayDoneBtn, {
                  borderRadius: borderRadiusValue,
                  borderColor: colors.border,
                }]}
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={[styles.yesterdayDoneBtnText, { color: colors.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});
YesterdayEntriesModal.displayName = 'YesterdayEntriesModal';

// ─── Streak Banner ───────────────────────────────────────────────

interface StreakBannerProps {
  currentStreak: number;
  isAtRisk: boolean;
  hoursUntilBreak: number;
  streakMessage: string;
  trackerColor: string;
  colors: Record<string, string>;
  borderRadiusValue: number;
  onLogNow: () => void;
}

const StreakBanner = memo<StreakBannerProps>(({
  currentStreak, isAtRisk, streakMessage, trackerColor, colors, borderRadiusValue, onLogNow,
}) => {
  if (currentStreak === 0) return null;

  return (
    <Animated.View entering={FadeInUp.springify()} style={[styles.streakBanner, {
      backgroundColor: isAtRisk ? 'rgba(255,107,107,0.08)' : `${trackerColor}12`,
      borderColor: isAtRisk ? 'rgba(255,107,107,0.2)' : `${trackerColor}30`,
      borderRadius: borderRadiusValue,
      borderWidth: 1,
    }]}>
      <View style={styles.streakIconContainer}>
        <Ionicons
          name={isAtRisk ? 'flame-outline' : 'flame'}
          size={24}
          color={isAtRisk ? '#FF6B6B' : trackerColor}
        />
      </View>
      <View style={styles.streakTextContainer}>
        <Text style={[styles.streakCount, { color: isAtRisk ? '#FF6B6B' : trackerColor }]}>
          {currentStreak} day{currentStreak !== 1 ? 's' : ''}
        </Text>
        <Text style={[styles.streakMessage, { color: colors.textSecondary }]} numberOfLines={1}>
          {streakMessage}
        </Text>
      </View>
      {isAtRisk && (
        <TouchableOpacity
          style={[styles.streakActionBtn, { backgroundColor: '#FF6B6B' }]}
          onPress={onLogNow}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Log now to save streak"
        >
          <Text style={styles.streakActionText}>Log Now</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});
StreakBanner.displayName = 'StreakBanner';

// ─── Time Context Chip ───────────────────────────────────────────

interface TimeContextChipProps {
  timeContext: { timeOfDay: string; usualTimes: string[]; nextSuggestedTime?: string } | undefined;
  trackerColor: string;
  colors: Record<string, string>;
  borderRadiusValue: number;
}

const TimeContextChip = memo<TimeContextChipProps>(({
  timeContext, trackerColor, colors, borderRadiusValue,
}) => {
  if (!timeContext || timeContext.usualTimes.length === 0) return null;

  return (
    <View style={[styles.timeContextChip, {
      backgroundColor: `${trackerColor}10`,
      borderRadius: borderRadiusValue,
    }]}>
      <Ionicons name="time-outline" size={14} color={trackerColor} />
      <Text style={[styles.timeContextText, { color: colors.textSecondary }]} numberOfLines={1}>
        {timeContext.timeOfDay} • Usually {timeContext.usualTimes[0]}
        {timeContext.nextSuggestedTime && ` • Next: ${timeContext.nextSuggestedTime}`}
      </Text>
    </View>
  );
});
TimeContextChip.displayName = 'TimeContextChip';

// ─── Correlation Alert ───────────────────────────────────────────

interface CorrelationAlertProps {
  correlation: ProgressiveCorrelation;
  trackerColor: string;
  colors: Record<string, string>;
  borderRadiusValue: number;
  onAction: () => void;
  onDismiss: () => void;
}

const CorrelationAlert = memo<CorrelationAlertProps>(({
  correlation, trackerColor, colors, borderRadiusValue, onAction, onDismiss,
}) => (
  <Animated.View entering={FadeInUp.springify()} style={[styles.correlationAlert, {
    backgroundColor: `${trackerColor}08`,
    borderRadius: borderRadiusValue,
    borderLeftWidth: 3,
    borderLeftColor: trackerColor,
  }]}>
    <View style={styles.correlationIconContainer}>
      <Text style={styles.correlationEmoji}>{correlation.emoji}</Text>
    </View>
    <View style={styles.correlationTextContainer}>
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
          style={[styles.correlationActionBtn, { backgroundColor: trackerColor }]}
          onPress={onAction}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.correlationActionText}>
            {correlation.action === 'log_now' ? 'Log' : correlation.action === 'prefill' ? 'Apply' : 'View'}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onDismiss}
        style={styles.correlationDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss correlation"
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  </Animated.View>
));
CorrelationAlert.displayName = 'CorrelationAlert';

// ─── Reminder Pill ───────────────────────────────────────────────

interface ReminderPillProps {
  reminder: ProgressiveReminder;
  trackerColor: string;
  colors: Record<string, string>;
  borderRadiusValue: number;
  onAction: (action: string) => void;
}

const ReminderPill = memo<ReminderPillProps>(({
  reminder, trackerColor, colors, borderRadiusValue, onAction,
}) => {
  const isUrgent = reminder.priority === 'urgent' || reminder.priority === 'high';

  return (
    <View style={[styles.reminderPill, {
      backgroundColor: isUrgent ? 'rgba(255,107,107,0.08)' : `${trackerColor}08`,
      borderRadius: borderRadiusValue,
      borderLeftWidth: 3,
      borderLeftColor: isUrgent ? '#FF6B6B' : trackerColor,
    }]}>
      <Text style={styles.reminderEmoji}>{reminder.emoji}</Text>
      <View style={styles.reminderTextContainer}>
        <Text style={[styles.reminderTitle, { color: colors.text }]} numberOfLines={1}>
          {reminder.title}
        </Text>
        <Text style={[styles.reminderBody, { color: colors.textSecondary }]} numberOfLines={1}>
          {reminder.body}
        </Text>
      </View>
      {reminder.actionButtons?.map(btn => (
        <TouchableOpacity
          key={btn.id}
          style={[styles.reminderActionBtn, {
            backgroundColor: btn.action === 'log_now' ? trackerColor : colors.surface,
            borderRadius: borderRadiusValue / 2,
          }]}
          onPress={() => onAction(btn.action)}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={[
            styles.reminderActionText,
            { color: btn.action === 'log_now' ? '#fff' : colors.text }
          ]}>
            {btn.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});
ReminderPill.displayName = 'ReminderPill';

// ─── Date Picker Modal ───────────────────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  date: Date;
  mode: 'date' | 'time';
  onChange: (event: any, selectedDate?: Date) => void;
  onClose: () => void;
  themeColors: Record<string, string>;
  fullThemeColors: Record<string, string>;
  borderRadiusValue: number;
}

const DatePickerModal = memo<DatePickerModalProps>(({
  visible, date, mode, onChange, onClose, themeColors, fullThemeColors, borderRadiusValue,
}) => (
  <Modal transparent animationType="slide" visible={visible} statusBarTranslucent>
    <Pressable
      style={[styles.pickerModalOverlay, { backgroundColor: `rgba(0,0,0,${MODAL_BACKDROP_OPACITY})` }]}
      onPress={onClose}
    >
      <View
        style={[styles.pickerModalContent, {
          backgroundColor: fullThemeColors.surface,
          borderRadius: borderRadiusValue * 2,
        }]}
        onStartShouldSetResponder={() => true}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <View style={[styles.pickerHeader, { borderBottomColor: fullThemeColors.border }]}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text style={[styles.pickerDoneButton, { color: themeColors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>
        <DateTimePicker
          value={date}
          mode={mode}
          display="spinner"
          onChange={onChange}
          textColor={fullThemeColors.text}
        />
      </View>
    </Pressable>
  </Modal>
));
DatePickerModal.displayName = 'DatePickerModal';

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════

export default function AddEntryScreen() {
  const navigation = useNavigation<AddEntryNavigationProp>();
  const route = useRoute<AddEntryRouteProp>();
  const insets = useSafeAreaInsets();
  const theme = useUnifiedTrackerTheme();

  const {
    fullThemeColors,
    themeColors,
    isDark,
    triggerHaptic,
    borderRadiusValue,
    fontSizeMultiplier,
    shouldReduceMotion,
  } = useCustomization();
  const { success, error } = useSweetAlert();
  const { getTracker, addEntry, getEntries, currentBaby } = useTracker();

  // ─── State ─────────────────────────────────────────────────────
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(
    route.params?.trackerId || null
  );
  const [showPicker, setShowPicker] = useState(!route.params?.trackerId);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showYesterdayModal, setShowYesterdayModal] = useState(false);
  const [yesterdayEntries, setYesterdayEntries] = useState<YesterdayEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Progressive intelligence
  const progressive = useTrackerProgressive(selectedTrackerId || '');

  const {
    prefillData,
    suggestions,
    streak,
    isAtRisk,
    hoursUntilBreak,
    streakMessage,
    insights,
    correlations,
    activeReminders,
    hasUrgentReminders,
    templates,
    trends,
    timeContext,
    refresh: refreshProgressive,
  } = progressive;

  const [dismissedCorrelations, setDismissedCorrelations] = useState<Set<string>>(new Set());
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const [appliedCorrelationPrefill, setAppliedCorrelationPrefill] = useState<Record<string, unknown> | null>(null);

  // Form state
  const [pendingData, setPendingData] = useState<Record<string, unknown>>(() => {
    const preset = route.params?.presetData;
    return { ...progressive.prefillData, ...preset };
  });

  const [pendingOptions, setPendingOptions] = useState<{
    notes?: string;
    tags?: string[];
    photoUris?: string[];
  }>({});

  // Refs for stable callbacks
  const dateRef = useRef(date);
  dateRef.current = date;

  // ─── Derived State (Memoized) ──────────────────────────────────
  const tracker = useMemo(() =>
    selectedTrackerId ? getTracker(selectedTrackerId) : undefined,
    [selectedTrackerId, getTracker]
  );

  const editEntryId = useMemo(() =>
    route.params?.editMode ? route.params?.eventId : undefined,
    [route.params?.editMode, route.params?.eventId]
  );

  const recentEntries = useMemo(() =>
    tracker ? getEntries(tracker.id, 3) : [],
    [tracker, getEntries]
  );

  const visibleCorrelations = useMemo(() =>
    correlations.filter(c => !dismissedCorrelations.has(c.id)),
    [correlations, dismissedCorrelations]
  );

  const visibleReminders = useMemo(() =>
    activeReminders.filter(r => !dismissedReminders.has(r.id)),
    [activeReminders, dismissedReminders]
  );

  const hasYesterdayEntries = yesterdayEntries.length > 0;

  // ─── Effects ─────────────────────────────────────────────────────

  // Refresh progressive data when tracker changes
  useEffect(() => {
    if (selectedTrackerId) {
      refreshProgressive();
    }
  }, [selectedTrackerId, refreshProgressive]);

  // Load yesterday's entries
  useEffect(() => {
    if (!tracker || editEntryId) return;

    const yesterday = subDays(new Date(), 1);
    const yesterdayStart = startOfDay(yesterday).getTime();
    const yesterdayEnd = endOfDay(yesterday).getTime();

    const filtered = getEntries(tracker.id)
      .filter(entry => {
        const entryTime = entry.timestamp;
        return entryTime >= yesterdayStart && entryTime <= yesterdayEnd;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        data: entry.data || {},
        notes: entry.notes,
        tags: entry.tags,
        title: entry.title,
      }));

    setYesterdayEntries(filtered);
  }, [tracker, getEntries, editEntryId]);

  // Apply prefill data and suggestions
  useEffect(() => {
    if (!tracker) return;

    setPendingData(prev => {
      const newData = { ...prev };
      let hasChanges = false;

      Object.entries(prefillData).forEach(([key, value]) => {
        if (newData[key] === undefined && value !== undefined && value !== '') {
          newData[key] = value;
          hasChanges = true;
        }
      });

      suggestions.forEach(s => {
        if (newData[s.fieldId] === undefined && s.confidence >= 80) {
          newData[s.fieldId] = s.value;
          hasChanges = true;
        }
      });

      if (appliedCorrelationPrefill) {
        Object.entries(appliedCorrelationPrefill).forEach(([key, value]) => {
          newData[key] = value;
          hasChanges = true;
        });
        setAppliedCorrelationPrefill(null);
      }

      return hasChanges ? newData : prev;
    });
  }, [prefillData, suggestions, appliedCorrelationPrefill, tracker]);

  // Load edit data
  useEffect(() => {
    if (!editEntryId || !tracker) return;

    const entry = getEntries(tracker.id).find(e => e.id === editEntryId);
    if (entry) {
      setDate(new Date(entry.timestamp));
      setPendingData(entry.data || {});
      setPendingOptions({
        notes: entry.notes,
        tags: entry.tags,
        photoUris: entry.photoUris,
      });
    }
  }, [editEntryId, tracker, getEntries]);

  // ─── Callbacks (Stable) ────────────────────────────────────────

  const handleCopyYesterdayEntry = useCallback((entry: YesterdayEntry) => {
    HAPTIC_SUCCESS();
    const copiedData = { ...entry.data };
    const now = new Date();
    setDate(now);
    setPendingData(copiedData);

    if (entry.notes || entry.tags) {
      setPendingOptions(prev => ({
        ...prev,
        notes: entry.notes || prev.notes,
        tags: entry.tags || prev.tags,
      }));
    }

    success('Copied!', `Yesterday's ${tracker?.name || 'entry'} data loaded. Time set to now.`);
  }, [success, tracker?.name]);

  const showAndroidPicker = useCallback((mode: 'date' | 'time') => {
    try {
      DateTimePickerAndroid.open({
        value: dateRef.current,
        mode,
        is24Hour: false,
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            const d = new Date(dateRef.current);
            if (mode === 'date') {
              d.setFullYear(selectedDate.getFullYear());
              d.setMonth(selectedDate.getMonth());
              d.setDate(selectedDate.getDate());
              setDate(d);
              setTimeout(() => showAndroidPicker('time'), 300);
            } else {
              d.setHours(selectedDate.getHours());
              d.setMinutes(selectedDate.getMinutes());
              setDate(d);
            }
          }
        },
      });
    } catch {
      error('Error', 'Could not open date picker.');
    }
  }, [error]);

  const handleDatePress = useCallback(() => {
    HAPTIC_LIGHT();
    if (Platform.OS === 'android') {
      showAndroidPicker('date');
    } else {
      setShowDatePicker(true);
    }
  }, [showAndroidPicker]);

  const handleTimePress = useCallback(() => {
    HAPTIC_LIGHT();
    if (Platform.OS === 'android') {
      showAndroidPicker('time');
    } else {
      setShowTimePicker(true);
    }
  }, [showAndroidPicker]);

  const onDateChange = useCallback((_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
    if (selectedDate) setDate(selectedDate);
  }, []);

  const buildTitle = useCallback((data: Record<string, unknown>): string => {
    if (!tracker) return 'Entry';
    const d = data;
    switch (tracker.id) {
      case 'potty': return `${d.type || 'Potty'} ${d.successful ? '✓' : ''}`;
      case 'feed': return `${d.feedType || 'Feed'}${d.amount ? ` (${d.amount})` : ''}`;
      case 'sleep': return `${d.sleepType || 'Sleep'}${d.duration ? ` • ${d.duration}` : ''}`;
      case 'growth': return `${d.measurementType || 'Measurement'}: ${d.value || ''}${d.unit || ''}`;
      case 'medication': return `${d.name || 'Medicine'} ${d.dosage || ''}`;
      case 'milestone': return `🌟 ${d.title || 'New Milestone'}`;
      case 'diaper': return `${d.type || 'Diaper'} Change`;
      case 'temperature': return `🌡️ ${d.value || ''}${d.unit === 'fahrenheit' ? '°F' : '°C'}`;
      case 'note': return (d.title as string) || 'Note';
      default: return `${tracker.emoji} ${tracker.name}`;
    }
  }, [tracker]);

  const handleFormSubmit = useCallback((data: Record<string, unknown>, options: {
    title?: string;
    notes?: string;
    photoUris?: string[];
    tags?: string[];
  }) => {
    setPendingData(data);
    setPendingOptions(options);
    setShowConfirm(true);
  }, []);

  const confirmSave = useCallback(async () => {
    if (!tracker) return;
    try {
      const entry = await addEntry(tracker.id, pendingData, {
        title: buildTitle(pendingData),
        notes: pendingOptions.notes,
        tags: pendingOptions.tags,
        photoUris: pendingOptions.photoUris,
      });
      if (entry) {
        triggerHaptic('success');
        setShowConfirm(false);
        success('Saved!', `${tracker.name} entry added successfully.`);
        navigation.goBack();
      }
    } catch {
      error('Error', 'Failed to save entry. Please try again.');
    }
  }, [tracker, pendingData, pendingOptions, addEntry, triggerHaptic, success, error, navigation, buildTitle]);

  const handleTrackerSelect = useCallback((trackerId: string) => {
    setSelectedTrackerId(trackerId);
    setShowPicker(false);
    setPendingOptions({});
    setErrors([]);
    setDismissedCorrelations(new Set());
    setDismissedReminders(new Set());
    setAppliedCorrelationPrefill(null);
    setShowYesterdayModal(false);
    setYesterdayEntries([]);
  }, []);

  const handlePickerClose = useCallback(() => {
    if (!selectedTrackerId) {
      navigation.goBack();
    } else {
      setShowPicker(false);
    }
  }, [selectedTrackerId, navigation]);

  const handleCorrelationAction = useCallback((correlation: ProgressiveCorrelation) => {
    HAPTIC_LIGHT();
    if (correlation.prefillData) {
      setAppliedCorrelationPrefill(correlation.prefillData);
    }
  }, []);

  const handleReminderAction = useCallback((action: string) => {
    if (action === 'log_now') {
      // Scroll to form or trigger form focus
    }
  }, []);

  const handleDismissCorrelation = useCallback((id: string) => {
    setDismissedCorrelations(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleDismissReminder = useCallback((id: string) => {
    setDismissedReminders(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // ─── Render ──────────────────────────────────────────────────────

  if (showPicker) {
    return (
      <View style={[styles.container, { backgroundColor: fullThemeColors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <TimelinePicker
          visible={showPicker}
          onClose={handlePickerClose}
          onSelect={handleTrackerSelect}
          currentBabyName={currentBaby?.name}
          currentBabyAvatar={currentBaby?.avatar}
        />
      </View>
    );
  }

  if (!tracker) {
    return (
      <View style={[styles.container, {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: fullThemeColors.background,
      }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Ionicons name="alert-circle-outline" size={48} color={fullThemeColors.textSecondary} />
        <Text style={[styles.errorText, {
          color: fullThemeColors.textSecondary,
          fontSize: 18 * fontSizeMultiplier,
          marginTop: 12,
        }]}>
          Tracker not found
        </Text>
      </View>
    );
  }

  const gradientColors: [string, string, string] = [
    tracker.gradient[0] + '15',
    tracker.gradient[1] + '10',
    fullThemeColors.background,
  ];

  const progressiveState = useMemo(() => ({
    prefillData,
    suggestions,
    streak,
    insights,
    correlations,
    activeReminders,
    templates,
    trends,
    timeContext,
    yesterdayEntries: [],
    todayEntries: [],
  }), [prefillData, suggestions, streak, insights, correlations, activeReminders, templates, trends, timeContext]);

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <AutoHideScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header */}
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInDown.springify()}
            style={styles.header}
          >
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.closeButton, { borderRadius: borderRadiusValue }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <BlurView
                intensity={isDark ? 40 : 80}
                style={[styles.closeBlur, { borderRadius: borderRadiusValue }]}
                tint={isDark ? 'dark' : 'light'}
              >
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
              <Text style={[styles.headerTitle, {
                color: fullThemeColors.text,
                fontSize: 20 * fontSizeMultiplier,
              }]}>
                {editEntryId ? 'Edit' : 'Add'} {tracker.name}
              </Text>
              <Text style={[styles.headerSubtitle, { color: fullThemeColors.textSecondary }]}>
                {currentBaby?.name || 'Baby'}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.changeBtn, { borderRadius: borderRadiusValue }]}
                onPress={() => { HAPTIC_LIGHT(); setShowPicker(true); }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Change tracker"
              >
                <BlurView
                  intensity={isDark ? 40 : 80}
                  style={[styles.changeBlur, { borderRadius: borderRadiusValue }]}
                  tint={isDark ? 'dark' : 'light'}
                >
                  <Ionicons name="swap-horizontal" size={20} color={fullThemeColors.text} />
                </BlurView>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Progressive Intelligence Section */}
          {streak && streak.currentStreak > 0 && (
            <StreakBanner
              currentStreak={streak.currentStreak}
              isAtRisk={isAtRisk}
              hoursUntilBreak={hoursUntilBreak}
              streakMessage={streakMessage}
              trackerColor={tracker.gradient[0]}
              colors={fullThemeColors}
              borderRadiusValue={borderRadiusValue}
              onLogNow={() => {/* Scroll to form */}}
            />
          )}

          <TimeContextChip
            timeContext={timeContext}
            trackerColor={tracker.gradient[0]}
            colors={fullThemeColors}
            borderRadiusValue={borderRadiusValue}
          />

          {hasUrgentReminders && visibleReminders.some(r => r.priority === 'urgent' || r.priority === 'high') && (
            <Animated.View
              entering={FadeInUp.springify()}
              style={[styles.urgentBanner, {
                backgroundColor: 'rgba(255,107,107,0.08)',
                borderRadius: borderRadiusValue,
              }]}
            >
              <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
              <Text style={[styles.urgentText, { color: '#FF6B6B' }]}>
                {visibleReminders.filter(r => r.priority === 'urgent' || r.priority === 'high').length} urgent reminder(s)
              </Text>
            </Animated.View>
          )}

          {visibleReminders.length > 0 && (
            <View style={styles.remindersSection}>
              {visibleReminders.slice(0, 2).map(reminder => (
                <ReminderPill
                  key={reminder.id}
                  reminder={reminder}
                  trackerColor={tracker.gradient[0]}
                  colors={fullThemeColors}
                  borderRadiusValue={borderRadiusValue}
                  onAction={handleReminderAction}
                />
              ))}
            </View>
          )}

          {visibleCorrelations.length > 0 && (
            <View style={styles.correlationsSection}>
              {visibleCorrelations.slice(0, 2).map(correlation => (
                <CorrelationAlert
                  key={correlation.id}
                  correlation={correlation}
                  trackerColor={tracker.gradient[0]}
                  colors={fullThemeColors}
                  borderRadiusValue={borderRadiusValue}
                  onAction={() => handleCorrelationAction(correlation)}
                  onDismiss={() => handleDismissCorrelation(correlation.id)}
                />
              ))}
            </View>
          )}

          {/* Yesterday's Entries Banner */}
          {hasYesterdayEntries && !editEntryId && (
            <Animated.View
              entering={FadeInUp.springify()}
              style={[styles.yesterdayBanner, {
                backgroundColor: `${tracker.gradient[0]}10`,
                borderColor: `${tracker.gradient[0]}30`,
                borderRadius: borderRadiusValue,
                borderWidth: 1,
              }]}
            >
              <View style={styles.yesterdayBannerIconContainer}>
                <Ionicons name="calendar-outline" size={22} color={tracker.gradient[0]} />
              </View>
              <View style={styles.yesterdayBannerTextContainer}>
                <Text style={[styles.yesterdayBannerTitle, { color: tracker.gradient[0] }]}>
                  Yesterday's Records
                </Text>
                <Text style={[styles.yesterdayBannerSubtitle, { color: fullThemeColors.textSecondary }]}>
                  {yesterdayEntries.length} {tracker.name.toLowerCase()} entr{yesterdayEntries.length !== 1 ? 'ies' : 'y'} recorded
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.yesterdayBannerBtn, {
                  backgroundColor: tracker.gradient[0],
                  borderRadius: borderRadiusValue,
                }]}
                onPress={() => { HAPTIC_LIGHT(); setShowYesterdayModal(true); }}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.yesterdayBannerBtnText}>View</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Recent entries */}
          {recentEntries.length > 0 && !editEntryId && (
            <Animated.View
              entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}
              style={styles.recentSection}
            >
              <Text style={[styles.recentTitle, {
                color: fullThemeColors.textSecondary,
                fontSize: 13 * fontSizeMultiplier,
              }]}>
                Recent {tracker.name}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {recentEntries.map(entry => (
                  <View key={entry.id} style={[styles.recentCard, {
                    backgroundColor: fullThemeColors.glassBg,
                    borderColor: fullThemeColors.border,
                    borderRadius: borderRadiusValue,
                  }]}>
                    <Text style={styles.recentEmoji}>{tracker.emoji}</Text>
                    <Text style={[styles.recentTime, { color: fullThemeColors.textSecondary }]}>
                      {format(new Date(entry.timestamp), 'h:mm a')}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Date/Time Section */}
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(100).springify()}
            style={styles.timeSection}
          >
            <Text style={[styles.sectionLabel, {
              color: fullThemeColors.text,
              fontSize: 16 * fontSizeMultiplier,
            }]}>
              When
            </Text>
            <View style={styles.timeButtonsContainer}>
              <TouchableOpacity
                style={[styles.timeButton, {
                  backgroundColor: fullThemeColors.glassBg,
                  borderColor: fullThemeColors.border,
                  borderRadius: borderRadiusValue,
                }]}
                onPress={handleDatePress}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Select date"
              >
                <View style={[styles.timeIconContainer, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                  <Ionicons name="calendar-outline" size={22} color={tracker.gradient[0]} />
                </View>
                <View style={styles.timeTextContainer}>
                  <Text style={[styles.timeMainText, {
                    color: fullThemeColors.text,
                    fontSize: 15 * fontSizeMultiplier,
                  }]}>
                    {isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'EEE, MMM d')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timeButton, {
                  backgroundColor: fullThemeColors.glassBg,
                  borderColor: fullThemeColors.border,
                  borderRadius: borderRadiusValue,
                }]}
                onPress={handleTimePress}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Select time"
              >
                <View style={[styles.timeIconContainer, { backgroundColor: `${tracker.gradient[0]}15` }]}>
                  <Ionicons name="time-outline" size={22} color={tracker.gradient[0]} />
                </View>
                <View style={styles.timeTextContainer}>
                  <Text style={[styles.timeMainText, {
                    color: fullThemeColors.text,
                    fontSize: 15 * fontSizeMultiplier,
                  }]}>
                    {format(date, 'h:mm a')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={fullThemeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* iOS Pickers */}
            {Platform.OS === 'ios' && (
              <>
                <DatePickerModal
                  visible={showDatePicker}
                  date={date}
                  mode="date"
                  onChange={onDateChange}
                  onClose={() => setShowDatePicker(false)}
                  themeColors={themeColors}
                  fullThemeColors={fullThemeColors}
                  borderRadiusValue={borderRadiusValue}
                />
                <DatePickerModal
                  visible={showTimePicker}
                  date={date}
                  mode="time"
                  onChange={onDateChange}
                  onClose={() => setShowTimePicker(false)}
                  themeColors={themeColors}
                  fullThemeColors={fullThemeColors}
                  borderRadiusValue={borderRadiusValue}
                />
              </>
            )}
          </Animated.View>

          {/* Errors */}
          {errors.length > 0 && (
            <Animated.View
              entering={shouldReduceMotion ? undefined : FadeInDown.springify()}
              style={[styles.errorsContainer, {
                backgroundColor: `${fullThemeColors.error}15`,
                borderLeftColor: fullThemeColors.error,
                borderRadius: borderRadiusValue,
              }]}
            >
              {errors.map((err, idx) => (
                <View key={idx} style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={fullThemeColors.error} />
                  <Text style={[styles.errorText, { color: fullThemeColors.error }]}>{err}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Form */}
          <View style={styles.formWrapper}>
            <DynamicTrackerForm
              tracker={tracker}
              initialData={pendingData}
              progressiveState={progressiveState}
              onSubmit={handleFormSubmit}
              onCancel={() => navigation.goBack()}
            />
          </View>

          <View style={styles.bottomPadding} />
        </AutoHideScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <ConfirmModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSave}
        data={{ ...pendingData, photoUris: pendingOptions.photoUris }}
        tracker={tracker}
        babyName={currentBaby?.name || 'Baby'}
        babyAvatar={currentBaby?.avatar}
        date={date}
        notes={pendingOptions.notes}
        tags={pendingOptions.tags || []}
      />

      <YesterdayEntriesModal
        visible={showYesterdayModal}
        onClose={() => setShowYesterdayModal(false)}
        entries={yesterdayEntries}
        tracker={tracker}
        onCopyEntry={handleCopyYesterdayEntry}
        colors={fullThemeColors}
        borderRadiusValue={borderRadiusValue}
        fontSizeMultiplier={fontSizeMultiplier}
      />
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 8,
  },
  closeButton: { overflow: 'hidden' },
  closeBlur: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', gap: 6 },
  headerTitle: { fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  changeBtn: { overflow: 'hidden' },
  changeBlur: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Streak Banner
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  streakIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTextContainer: { flex: 1 },
  streakCount: { fontSize: 16, fontWeight: '700' },
  streakMessage: { fontSize: 12, marginTop: 2 },
  streakActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  streakActionText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // Time Context
  timeContextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  timeContextText: { fontSize: 12, fontWeight: '500' },

  // Urgent Banner
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
  },
  urgentText: { fontSize: 13, fontWeight: '600' },

  // Reminders
  remindersSection: { gap: 10, marginBottom: 16 },
  reminderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  reminderEmoji: { fontSize: 20 },
  reminderTextContainer: { flex: 1 },
  reminderTitle: { fontSize: 14, fontWeight: '600' },
  reminderBody: { fontSize: 12, marginTop: 2 },
  reminderActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reminderActionText: { fontSize: 12, fontWeight: '600' },

  // Correlations
  correlationsSection: { gap: 10, marginBottom: 16 },
  correlationAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  correlationIconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correlationEmoji: { fontSize: 24 },
  correlationTextContainer: { flex: 1 },
  correlationMessage: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  correlationMeta: { fontSize: 11, marginTop: 2 },
  correlationActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  correlationActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  correlationActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  correlationDismiss: { padding: 4 },

  // Yesterday Banner
  yesterdayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  yesterdayBannerIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesterdayBannerTextContainer: { flex: 1 },
  yesterdayBannerTitle: { fontSize: 15, fontWeight: '700' },
  yesterdayBannerSubtitle: { fontSize: 12, marginTop: 2 },
  yesterdayBannerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  yesterdayBannerBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // Yesterday Modal
  yesterdayModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  yesterdayModalContent: {
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
  },
  yesterdayModalGradient: { padding: 0 },
  yesterdayModalHeader: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    position: 'relative',
  },
  yesterdayModalIconContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  yesterdayModalTitle: { fontWeight: '800', marginBottom: 4 },
  yesterdayModalSubtitle: { fontSize: 14, fontWeight: '500' },
  yesterdayCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    overflow: 'hidden',
  },
  yesterdayCloseBlur: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesterdayScrollView: { maxHeight: 400 },
  yesterdayScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  yesterdayEntryCard: { padding: 16, marginBottom: 4 },
  yesterdayEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  yesterdayTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  yesterdayTimeText: { fontSize: 13, fontWeight: '700' },
  yesterdayEntryTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  yesterdayFieldsContainer: { gap: 8, marginBottom: 12 },
  yesterdayFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  yesterdayFieldLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  yesterdayFieldValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  yesterdayNotesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    marginBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  yesterdayNotesText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  yesterdayTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  yesterdayTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  yesterdayTagText: { fontSize: 12, fontWeight: '600' },
  yesterdayCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
  },
  yesterdayCopyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  yesterdayModalFooter: { padding: 20, paddingTop: 12 },
  yesterdayDoneBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  yesterdayDoneBtnText: { fontSize: 16, fontWeight: '700' },

  // Recent
  recentSection: { marginBottom: 20 },
  recentTitle: {
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentCard: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentEmoji: { fontSize: 28 },
  recentTime: { fontSize: 12, marginTop: 4, fontWeight: '600' },

  // Time Section
  timeSection: { marginBottom: 24 },
  sectionLabel: { fontWeight: '700', letterSpacing: -0.3, marginBottom: 12 },
  timeButtonsContainer: { flexDirection: 'row', gap: 12 },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timeIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeTextContainer: { flex: 1 },
  timeMainText: { fontWeight: '700' },

  // Pickers
  pickerModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerModalContent: { paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  pickerHeader: {
    alignItems: 'flex-end',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerDoneButton: { fontSize: 16, fontWeight: '600' },

  // Errors
  errorsContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  errorText: { fontSize: 13, fontWeight: '500' },

  // Form
  formWrapper: { marginTop: 8 },
  bottomPadding: { height: 100 },

  // Confirm Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
  },
  modalGradient: { padding: 24 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalIconContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalIcon: { fontSize: 32 },
  modalTitle: { fontWeight: '800', marginBottom: 4 },
  modalBabyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalSubtitle: { fontSize: 14, fontWeight: '500' },
  modalBody: { maxHeight: 300 },
  previewCard: { padding: 20, borderWidth: StyleSheet.hairlineWidth },
  previewTime: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewPhotoContainer: { overflow: 'hidden', marginBottom: 12, height: 120 },
  previewTitle: { fontWeight: '800', marginBottom: 8 },
  previewDetails: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  previewFields: { gap: 8, marginTop: 8 },
  previewField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  previewFieldLabel: { fontSize: 13, fontWeight: '500' },
  previewFieldValue: { fontSize: 13, fontWeight: '600' },
  previewNotes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  previewNotesText: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelButton: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '700' },
  confirmButton: { flex: 2, overflow: 'hidden' },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});