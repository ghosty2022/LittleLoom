// src/screens/RemindersScreen.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Dimensions,
  useColorScheme,
  Platform,
  Alert,
  FlatList,
  TextInput,
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
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, addDays, isSameDay, parseISO, startOfDay, differenceInDays } from 'date-fns';
import { useRoute, useNavigation } from '@react-navigation/native';

// Contexts
import { useBaby } from '../context/BabyContext';
import { useActivity } from '../context/ActivityContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ==================== NOTIFICATION SETUP ====================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ==================== TYPES ====================

interface Reminder {
  id: string;
  title: string;
  time: string;
  emoji: string;
  enabled: boolean;
  repeat: 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'once';
  category: 'potty' | 'feed' | 'sleep' | 'milestone' | 'medication' | 'play' | 'custom';
  babyId?: string;
  babyName?: string;
  notes?: string;
  lastTriggered?: string;
  streakDay?: number;
  isAchievementRelated?: boolean;
  achievementId?: string;
  smartSuggestion?: boolean;
  notificationId?: string;
}

interface SmartSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  emoji: string;
  reason: string;
  optimalTime: string;
  confidence: number;
  basedOn: string;
}

// ==================== INTELLIGENT REMINDER ENGINE ====================

class IntelligentReminderEngine {
  private activities: any[];
  private baby: any;
  private milestones: any[];

  constructor(activities: any[], baby: any, milestones: any[]) {
    this.activities = activities;
    this.baby = baby;
    this.milestones = milestones;
  }

  analyzePatterns(): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    
    if (!this.baby) return suggestions;

    // Analyze potty patterns
    const pottyActivities = this.activities.filter(a => a.type === 'potty' && a.babyId === this.baby.id);
    if (pottyActivities.length > 0) {
      const avgTime = this.calculateAverageTime(pottyActivities);
      const lastPotty = pottyActivities[pottyActivities.length - 1];
      const hoursSinceLastPotty = differenceInDays(new Date(), new Date(lastPotty.timestamp)) * 24;
      
      if (hoursSinceLastPotty > 2) {
        suggestions.push({
          id: 'potty_urgent',
          type: 'potty',
          title: 'Potty Time Soon',
          description: `It's been ${Math.round(hoursSinceLastPotty)} hours since last potty`,
          emoji: '🚽',
          reason: 'Pattern shows regular potty breaks',
          optimalTime: this.formatTime(avgTime),
          confidence: 85,
          basedOn: 'Your baby\'s potty pattern',
        });
      }
    }

    // Analyze sleep patterns
    const sleepActivities = this.activities.filter(a => a.type === 'sleep' && a.babyId === this.baby.id);
    if (sleepActivities.length > 0) {
      const avgBedtime = this.calculateAverageTime(sleepActivities.filter(a => a.data?.type === 'bedtime'));
      if (avgBedtime) {
        suggestions.push({
          id: 'sleep_routine',
          type: 'sleep',
          title: 'Bedtime Routine',
          description: 'Start winding down for better sleep',
          emoji: '😴',
          reason: 'Consistent bedtime improves sleep quality',
          optimalTime: this.formatTime(avgBedtime),
          confidence: 90,
          basedOn: 'Sleep pattern analysis',
        });
      }
    }

    // Analyze feeding patterns
    const feedActivities = this.activities.filter(a => a.type === 'feed' && a.babyId === this.baby.id);
    if (feedActivities.length > 3) {
      const avgInterval = this.calculateAverageInterval(feedActivities);
      const lastFeed = feedActivities[feedActivities.length - 1];
      const hoursSinceLastFeed = differenceInDays(new Date(), new Date(lastFeed.timestamp)) * 24;
      
      if (hoursSinceLastFeed > avgInterval - 0.5) {
        suggestions.push({
          id: 'feed_soon',
          type: 'feed',
          title: 'Feeding Time Approaching',
          description: `Average interval: ${Math.round(avgInterval)} hours`,
          emoji: '🍼',
          reason: 'Regular feeding schedule detected',
          optimalTime: this.formatTime(new Date(Date.now() + 30 * 60000)),
          confidence: 80,
          basedOn: 'Feeding history',
        });
      }
    }

    // Milestone reminders
    const unrecordedMilestones = this.getUnrecordedMilestones();
    if (unrecordedMilestones.length > 0) {
      suggestions.push({
        id: 'milestone_check',
        type: 'milestone',
        title: 'Record Milestone',
        description: `Has ${this.baby.name} reached any new milestones?`,
        emoji: '🌟',
        reason: 'Documenting milestones creates memories',
        optimalTime: '09:00',
        confidence: 75,
        basedOn: `${unrecordedMilestones.length} potential milestones`,
      });
    }

    // Streak protection
    const streak = this.calculateStreak();
    if (streak > 5) {
      suggestions.push({
        id: 'streak_protect',
        type: 'custom',
        title: '🔥 Protect Your Streak!',
        description: `${streak}-day streak! Log an activity today.`,
        emoji: '🔥',
        reason: 'Don\'t break your tracking streak',
        optimalTime: '20:00',
        confidence: 95,
        basedOn: `${streak} day activity streak`,
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateAverageTime(activities: any[]): Date | null {
    if (activities.length === 0) return null;
    const times = activities.map(a => new Date(a.timestamp).getHours() + new Date(a.timestamp).getMinutes() / 60);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const date = new Date();
    date.setHours(Math.floor(avg), Math.round((avg % 1) * 60), 0, 0);
    return date;
  }

  private calculateAverageInterval(activities: any[]): number {
    if (activities.length < 2) return 3;
    let totalDiff = 0;
    for (let i = 1; i < activities.length; i++) {
      const diff = differenceInDays(new Date(activities[i].timestamp), new Date(activities[i-1].timestamp)) * 24;
      totalDiff += diff;
    }
    return totalDiff / (activities.length - 1);
  }

  private formatTime(date: Date | null): string {
    if (!date) return '09:00';
    return format(date, 'HH:mm');
  }

  private getUnrecordedMilestones(): string[] {
    const commonMilestones = [
      'First smile', 'First laugh', 'Rolling over', 'Sitting up', 
      'First words', 'Crawling', 'First steps', 'First tooth'
    ];
    const recorded = this.milestones?.map((m: any) => m.title) || [];
    return commonMilestones.filter(m => !recorded.includes(m));
  }

  private calculateStreak(): number {
    const dailyActivities = this.activities.filter(a => a.babyId === this.baby.id);
    let streak = 0;
    let currentDate = new Date();
    
    while (true) {
      const hasActivity = dailyActivities.some(a => isSameDay(new Date(a.timestamp), currentDate));
      if (hasActivity) {
        streak++;
        currentDate = addDays(currentDate, -1);
      } else {
        break;
      }
    }
    return streak;
  }

  generateOptimalSchedule(): Partial<Reminder>[] {
    const suggestions = this.analyzePatterns();
    return suggestions.map(s => ({
      title: s.title,
      emoji: s.emoji,
      time: s.optimalTime,
      category: s.type as any,
      repeat: 'daily',
      smartSuggestion: true,
      notes: s.reason,
    }));
  }
}

// ==================== STORAGE KEYS ====================

const REMINDERS_STORAGE_KEY = '@littleloom_reminders_v2';
const COMPLETED_REMINDERS_KEY = '@littleloom_completed_reminders';

// ==================== SWEET ALERT COMPONENT ====================

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  emoji?: string;
}

const SweetAlert = ({ visible, type, title, message, emoji, onClose, isDark }: AlertState & { onClose: () => void; isDark: boolean }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(-50);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      translateY.value = withSpring(0, { damping: 15 });
      
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        translateY.value = withTiming(-30, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100, pointerEvents: 'none' }]}>
      <Animated.View style={[style, styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          {emoji ? <Text style={{ fontSize: 28 }}>{emoji}</Text> : <Ionicons name={config.icon as any} size={28} color="#fff" />}
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

// ==================== GLASSMORPHISM CARD ====================

const GlassmorphismCard: React.FC<{ 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  intensity?: number;
}> = ({ children, style, onPress, intensity = 80 }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(40,40,40,0.8)', 'rgba(20,20,20,0.6)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

// ==================== MAIN SCREEN ====================

type RemindersScreenProps = NativeStackScreenProps<RootStackParamList, 'Reminders'>;

export default function RemindersScreen({ navigation, route }: RemindersScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { currentBaby, babies, switchBaby } = useBaby();
  const { entries: activities, getTodayCount } = useActivity();
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'time' | 'date'>('time');
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderCategory, setNewReminderCategory] = useState<Reminder['category']>('custom');
  const [newReminderRepeat, setNewReminderRepeat] = useState<Reminder['repeat']>('daily');
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [activeTab, setActiveTab] = useState<'all' | 'smart' | 'achievements'>('all');
  const [streakData, setStreakData] = useState({ current: 0, atRisk: false, hoursLeft: 0 });

  // Get baby from route params or current
  const baby = useMemo(() => {
    if (route.params?.babyId) {
      return babies.find(b => b.id === route.params?.babyId) || currentBaby;
    }
    return currentBaby;
  }, [route.params?.babyId, babies, currentBaby]);

  // Load reminders and generate smart suggestions
  useEffect(() => {
    loadReminders();
    generateSmartSuggestions();
    checkStreakStatus();
    requestNotificationPermissions();
    
    // Check if coming from achievements with suggestion
    if (route.params?.suggestedType) {
      handleAchievementSuggestion();
    }
  }, [baby, activities]);

  // Listen for notification responses
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'Reminders' || data?.screen === 'Achievements') {
        navigation.navigate(data.screen, data.params || {});
      }
    });
    
    return () => subscription.remove();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Notifications Required',
        'Please enable notifications to receive reminder alerts.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Platform.OS === 'ios' ? undefined : undefined },
        ]
      );
    }
  };

  const loadReminders = async () => {
    try {
      const saved = await AsyncStorage.getItem(REMINDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter by current baby if specified
        const filtered = baby 
          ? parsed.filter((r: Reminder) => !r.babyId || r.babyId === baby.id)
          : parsed;
        setReminders(filtered);
      } else {
        // Default reminders
        setReminders(getDefaultReminders());
      }
    } catch (error) {
      console.warn('Failed to load reminders:', error);
      setReminders(getDefaultReminders());
    }
  };

  const getDefaultReminders = (): Reminder[] => [
    { 
      id: '1', 
      title: 'Potty Time', 
      time: '09:00', 
      emoji: '🚽', 
      enabled: true, 
      repeat: 'daily',
      category: 'potty',
      babyId: baby?.id,
      babyName: baby?.name,
    },
    { 
      id: '2', 
      title: 'Morning Feed', 
      time: '07:00', 
      emoji: '🍼', 
      enabled: true, 
      repeat: 'daily',
      category: 'feed',
      babyId: baby?.id,
      babyName: baby?.name,
    },
    { 
      id: '3', 
      title: 'Nap Time', 
      time: '14:00', 
      emoji: '😴', 
      enabled: false, 
      repeat: 'weekdays',
      category: 'sleep',
      babyId: baby?.id,
      babyName: baby?.name,
    },
    { 
      id: '4', 
      title: 'Bedtime Routine', 
      time: '19:30', 
      emoji: '🌙', 
      enabled: true, 
      repeat: 'daily',
      category: 'sleep',
      babyId: baby?.id,
      babyName: baby?.name,
    },
    { 
      id: '5', 
      title: 'Vitamin D', 
      time: '08:00', 
      emoji: '💊', 
      enabled: true, 
      repeat: 'daily',
      category: 'medication',
      babyId: baby?.id,
      babyName: baby?.name,
    },
  ];

  const saveReminders = async (newReminders: Reminder[]) => {
    try {
      await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(newReminders));
    } catch (error) {
      console.warn('Failed to save reminders:', error);
    }
  };

  const generateSmartSuggestions = () => {
    if (!baby) return;
    const engine = new IntelligentReminderEngine(activities, baby, []);
    const suggestions = engine.analyzePatterns();
    setSmartSuggestions(suggestions);
  };

  const checkStreakStatus = () => {
    if (!baby) return;
    
    const babyActivities = activities.filter(a => a.babyId === baby.id);
    let streak = 0;
    let currentDate = new Date();
    
    while (true) {
      const hasActivity = babyActivities.some(a => isSameDay(new Date(a.timestamp), currentDate));
      if (hasActivity) {
        streak++;
        currentDate = addDays(currentDate, -1);
      } else {
        break;
      }
    }
    
    // Check if streak is at risk (no activity today and it's after 6 PM)
    const todayActivity = babyActivities.some(a => isSameDay(new Date(a.timestamp), new Date()));
    const hour = new Date().getHours();
    const atRisk = !todayActivity && hour >= 18 && streak > 0;
    const hoursLeft = atRisk ? 24 - hour : 0;
    
    setStreakData({ current: streak, atRisk, hoursLeft });
  };

  const handleAchievementSuggestion = () => {
    const { suggestedType, fromAchievement } = route.params || {};
    
    let title = 'Achievement Reminder';
    let emoji = '🎯';
    let category: Reminder['category'] = 'custom';
    
    switch (suggestedType) {
      case 'potty':
        title = 'Potty Training Goal';
        emoji = '🚽';
        category = 'potty';
        break;
      case 'feed':
        title = 'Feeding Goal';
        emoji = '🍼';
        category = 'feed';
        break;
      case 'sleep':
        title = 'Sleep Routine Goal';
        emoji = '😴';
        category = 'sleep';
        break;
      case 'milestone':
        title = 'Record Milestone';
        emoji = '🌟';
        category = 'milestone';
        break;
    }
    
    setNewReminderTitle(title);
    setNewReminderCategory(category);
    setShowAddModal(true);
    
    showToast('info', 'Achievement Reminder', `Set a reminder for: ${title}`, emoji);
  };

  const scheduleNotification = async (reminder: Reminder): Promise<string | undefined> => {
    try {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      const now = new Date();
      const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      
      if (scheduledTime < now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      let trigger: any;
      
      switch (reminder.repeat) {
        case 'daily':
          trigger = { hour: hours, minute: minutes, repeats: true };
          break;
        case 'weekdays':
          trigger = { 
            hour: hours, 
            minute: minutes, 
            repeats: true,
            weekday: [1, 2, 3, 4, 5] 
          };
          break;
        case 'weekends':
          trigger = { 
            hour: hours, 
            minute: minutes, 
            repeats: true,
            weekday: [6, 7] 
          };
          break;
        case 'weekly':
          trigger = { 
            weekday: scheduledTime.getDay() + 1,
            hour: hours, 
            minute: minutes, 
            repeats: true 
          };
          break;
        default:
          trigger = { date: scheduledTime };
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${reminder.emoji} ${reminder.title}`,
          body: reminder.notes || `Time for ${reminder.title.toLowerCase()}!`,
          sound: true,
          badge: 1,
          data: {
            screen: 'Reminders',
            reminderId: reminder.id,
            category: reminder.category,
            babyId: reminder.babyId,
          },
        },
        trigger,
      });
      
      return id;
    } catch (error) {
      console.warn('Failed to schedule notification:', error);
      return undefined;
    }
  };

  const cancelNotification = async (notificationId?: string) => {
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  };

  const toggleReminder = async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    const newEnabled = !reminder.enabled;
    let newNotificationId = reminder.notificationId;

    if (newEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      newNotificationId = await scheduleNotification(reminder);
      showToast('success', 'Reminder Enabled', `You'll be notified at ${reminder.time}`, reminder.emoji);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await cancelNotification(reminder.notificationId);
      showToast('info', 'Reminder Disabled', `You won't receive notifications for ${reminder.title}`);
    }

    const updated = reminders.map(r => 
      r.id === id ? { ...r, enabled: newEnabled, notificationId: newNotificationId } : r
    );
    
    setReminders(updated);
    await saveReminders(updated);
  };

  const addReminder = async () => {
    if (!newReminderTitle.trim()) {
      showToast('error', 'Title Required', 'Please enter a reminder title');
      return;
    }

    const newReminder: Reminder = {
      id: Date.now().toString(),
      title: newReminderTitle,
      time: format(selectedTime, 'HH:mm'),
      emoji: getEmojiForCategory(newReminderCategory),
      enabled: true,
      repeat: newReminderRepeat,
      category: newReminderCategory,
      babyId: baby?.id,
      babyName: baby?.name,
      isAchievementRelated: !!route.params?.fromAchievement,
      achievementId: route.params?.fromAchievement,
    };

    const notificationId = await scheduleNotification(newReminder);
    newReminder.notificationId = notificationId;

    const updated = [...reminders, newReminder];
    setReminders(updated);
    await saveReminders(updated);
    
    setShowAddModal(false);
    setNewReminderTitle('');
    showToast('success', 'Reminder Added', 'Your reminder has been set', newReminder.emoji);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const deleteReminder = async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (reminder?.notificationId) {
      await cancelNotification(reminder.notificationId);
    }
    
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    await saveReminders(updated);
    
    showToast('info', 'Reminder Deleted', 'The reminder has been removed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applySmartSuggestion = async (suggestion: SmartSuggestion) => {
    const [hours, minutes] = suggestion.optimalTime.split(':').map(Number);
    const time = new Date();
    time.setHours(hours, minutes);

    const newReminder: Reminder = {
      id: `smart_${Date.now()}`,
      title: suggestion.title,
      time: suggestion.optimalTime,
      emoji: suggestion.emoji,
      enabled: true,
      repeat: 'daily',
      category: suggestion.type as any,
      babyId: baby?.id,
      babyName: baby?.name,
      smartSuggestion: true,
      notes: suggestion.reason,
    };

    const notificationId = await scheduleNotification(newReminder);
    newReminder.notificationId = notificationId;

    const updated = [...reminders, newReminder];
    setReminders(updated);
    await saveReminders(updated);
    
    showToast('success', 'Smart Reminder Added', `AI scheduled: ${suggestion.title}`, suggestion.emoji);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getEmojiForCategory = (category: Reminder['category']): string => {
    const emojis: Record<string, string> = {
      potty: '🚽',
      feed: '🍼',
      sleep: '😴',
      milestone: '🌟',
      medication: '💊',
      play: '🎮',
      custom: '⏰',
    };
    return emojis[category] || '⏰';
  };

  const showToast = (type: AlertState['type'], title: string, message: string, emoji?: string) => {
    setAlert({ visible: true, type, title, message, emoji });
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSelectedTime(selectedDate);
    }
  };

  const filteredReminders = useMemo(() => {
    switch (activeTab) {
      case 'smart':
        return reminders.filter(r => r.smartSuggestion);
      case 'achievements':
        return reminders.filter(r => r.isAchievementRelated);
      default:
        return reminders;
    }
  }, [reminders, activeTab]);

  const getNextReminder = () => {
    const enabled = reminders.filter(r => r.enabled);
    if (enabled.length === 0) return null;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let next = enabled.find(r => {
      const [h, m] = r.time.split(':').map(Number);
      return h * 60 + m > currentMinutes;
    });
    
    if (!next) {
      next = enabled[0]; // First one tomorrow
    }
    
    return next;
  };

  const nextReminder = getNextReminder();

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#e0e7ff', '#d1d5ff', '#c7b8ff']} 
        style={StyleSheet.absoluteFill} 
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <BlurView intensity={80} style={styles.backBlur}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </BlurView>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.title, isDark && styles.textDark]}>Reminders ⏰</Text>
          {baby && (
            <Text style={styles.babyName}>for {baby.name}</Text>
          )}
        </View>
        
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <BlurView intensity={80} style={styles.addBlur}>
            <Ionicons name="add" size={24} color="#667eea" />
          </BlurView>
        </TouchableOpacity>
      </View>

      <AnimatedScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Streak Warning Card */}
        {streakData.atRisk && (
          <Animated.View entering={FadeInDown.springify()}>
            <GlassmorphismCard style={styles.streakCard} intensity={90}>
              <LinearGradient colors={['#ef4444', '#f87171']} style={styles.streakGradient}>
                <View style={styles.streakHeader}>
                  <Ionicons name="flame" size={32} color="#fff" />
                  <View style={styles.streakTextContainer}>
                    <Text style={styles.streakTitle}>🔥 Streak at Risk!</Text>
                    <Text style={styles.streakSubtitle}>
                      {streakData.hoursLeft} hours left to save your {streakData.current}-day streak
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.streakAction}
                  onPress={() => navigation.navigate('UniversalTracker', { type: 'potty', babyId: baby?.id })}
                >
                  <Text style={styles.streakActionText}>Log Activity Now</Text>
                  <Ionicons name="arrow-forward" size={16} color="#ef4444" />
                </TouchableOpacity>
              </LinearGradient>
            </GlassmorphismCard>
          </Animated.View>
        )}

        {/* Next Reminder Card */}
        {nextReminder && (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <GlassmorphismCard style={styles.nextCard} intensity={90}>
              <View style={styles.nextHeader}>
                <Text style={styles.nextLabel}>Next Reminder</Text>
                <View style={styles.nextBadge}>
                  <Text style={styles.nextBadgeText}>
                    {nextReminder.time}
                  </Text>
                </View>
              </View>
              <View style={styles.nextContent}>
                <Text style={styles.nextEmoji}>{nextReminder.emoji}</Text>
                <View>
                  <Text style={[styles.nextTitle, isDark && styles.textDark]}>{nextReminder.title}</Text>
                  <Text style={styles.nextTime}>
                    {nextReminder.repeat !== 'once' ? `${nextReminder.repeat} • ` : ''}
                    {nextReminder.babyName || 'All babies'}
                  </Text>
                </View>
              </View>
              {!nextReminder.enabled && (
                <View style={styles.disabledBadge}>
                  <Text style={styles.disabledText}>Disabled</Text>
                </View>
              )}
            </GlassmorphismCard>
          </Animated.View>
        )}

        {/* Smart Suggestions Section */}
        {smartSuggestions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="sparkles" size={20} color="#8b5cf6" />
                <Text style={[styles.sectionTitle, isDark && styles.textDark]}>AI Suggestions</Text>
              </View>
              <Text style={styles.sectionSubtitle}>Based on your patterns</Text>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
              {smartSuggestions.map((suggestion, index) => (
                <Animated.View 
                  key={suggestion.id} 
                  entering={FadeInUp.delay(index * 100).springify()}
                  style={styles.suggestionCard}
                >
                  <TouchableOpacity onPress={() => applySmartSuggestion(suggestion)}>
                    <BlurView intensity={70} style={styles.suggestionBlur} tint={isDark ? 'dark' : 'light'}>
                      <View style={styles.suggestionHeader}>
                        <Text style={styles.suggestionEmoji}>{suggestion.emoji}</Text>
                        <View style={[styles.confidenceBadge, { backgroundColor: suggestion.confidence > 85 ? '#22c55e' : '#f59e0b' }]}>
                          <Text style={styles.confidenceText}>{suggestion.confidence}%</Text>
                        </View>
                      </View>
                      <Text style={[styles.suggestionTitle, isDark && styles.textDark]}>{suggestion.title}</Text>
                      <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                      <View style={styles.suggestionFooter}>
                        <Ionicons name="time-outline" size={14} color="#64748b" />
                        <Text style={styles.suggestionTime}>Optimal: {suggestion.optimalTime}</Text>
                      </View>
                      <Text style={styles.suggestionBasedOn}>Based on: {suggestion.basedOn}</Text>
                    </BlurView>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tab Filter */}
        <View style={styles.tabContainer}>
          {['all', 'smart', 'achievements'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[
                styles.tabText, 
                activeTab === tab && styles.tabTextActive
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {tab === 'smart' && smartSuggestions.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{smartSuggestions.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* All Reminders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="list" size={20} color="#667eea" />
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>
                {activeTab === 'all' ? 'All Reminders' : 
                 activeTab === 'smart' ? 'Smart Reminders' : 'Achievement Reminders'}
              </Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {filteredReminders.filter(r => r.enabled).length} active
            </Text>
          </View>

          <GlassmorphismCard style={styles.listContainer} intensity={90}>
            {filteredReminders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No reminders yet</Text>
                <Text style={styles.emptyText}>
                  {activeTab === 'smart' 
                    ? 'AI will suggest reminders based on your patterns'
                    : activeTab === 'achievements'
                    ? 'Set achievement-related reminders to reach your goals'
                    : 'Add your first reminder to get started'}
                </Text>
              </View>
            ) : (
              filteredReminders.map((reminder, index) => (
                <Animated.View key={reminder.id} entering={FadeInUp.delay(index * 50)}>
                  <View style={styles.reminderRow}>
                    <View style={styles.reminderLeft}>
                      <View style={[
                        styles.reminderIcon, 
                        { backgroundColor: reminder.enabled ? `${getCategoryColor(reminder.category)}20` : 'rgba(100,116,139,0.1)' }
                      ]}>
                        <Text style={styles.reminderEmoji}>{reminder.emoji}</Text>
                      </View>
                      <View style={styles.reminderInfo}>
                        <Text style={[
                          styles.reminderTitle,
                          !reminder.enabled && styles.reminderDisabled,
                          isDark && reminder.enabled && styles.textDark
                        ]}>
                          {reminder.title}
                        </Text>
                        <Text style={styles.reminderSub}>
                          {reminder.time} • {reminder.repeat}
                          {reminder.smartSuggestion && ' • 🤖 Smart'}
                          {reminder.isAchievementRelated && ' • 🎯 Achievement'}
                        </Text>
                        {reminder.notes && (
                          <Text style={styles.reminderNotes}>{reminder.notes}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.reminderActions}>
                      <Switch
                        value={reminder.enabled}
                        onValueChange={() => toggleReminder(reminder.id)}
                        trackColor={{ false: '#ddd', true: getCategoryColor(reminder.category) }}
                        thumbColor="#fff"
                      />
                      <TouchableOpacity 
                        style={styles.deleteButton}
                        onPress={() => deleteReminder(reminder.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {index !== filteredReminders.length - 1 && <View style={styles.divider} />}
                </Animated.View>
              ))
            )}
          </GlassmorphismCard>
        </View>

        {/* Achievement Integration Card */}
        <Animated.View entering={FadeInUp.delay(200).springify()}>
          <GlassmorphismCard 
            style={styles.achievementCard} 
            intensity={80}
            onPress={() => navigation.navigate('Achievements', { babyId: baby?.id })}
          >
            <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.achievementGradient}>
              <View style={styles.achievementIconContainer}>
                <Ionicons name="trophy" size={32} color="#fff" />
              </View>
              <View style={styles.achievementTextContainer}>
                <Text style={styles.achievementCardTitle}>Link to Achievements</Text>
                <Text style={styles.achievementCardSubtitle}>
                  Set reminders to help you reach your goals faster
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </GlassmorphismCard>
        </Animated.View>

        <View style={{ height: 40 }} />
      </AnimatedScrollView>

      {/* Add Reminder Modal */}
      {showAddModal && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="auto">
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            onPress={() => setShowAddModal(false)}
            activeOpacity={1}
          >
            <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          
          <Animated.View entering={FadeInUp.springify()} style={[styles.modal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>Add Reminder</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Title</Text>
              <TextInput
                style={[styles.textInput, isDark && styles.textInputDark]}
                value={newReminderTitle}
                onChangeText={setNewReminderTitle}
                placeholder="e.g., Potty Time"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Category</Text>
              <View style={styles.categoryGrid}>
                {(['potty', 'feed', 'sleep', 'milestone', 'medication', 'play', 'custom'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      newReminderCategory === cat && styles.categoryChipActive,
                      { borderColor: getCategoryColor(cat) }
                    ]}
                    onPress={() => setNewReminderCategory(cat)}
                  >
                    <Text style={{ fontSize: 20 }}>{getEmojiForCategory(cat)}</Text>
                    <Text style={[
                      styles.categoryText,
                      newReminderCategory === cat && { color: getCategoryColor(cat), fontWeight: '700' }
                    ]}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Time</Text>
              <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowPicker(true)}>
                <Ionicons name="time-outline" size={24} color="#667eea" />
                <Text style={[styles.timeText, isDark && styles.textDark]}>
                  {format(selectedTime, 'HH:mm')}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, isDark && styles.textDark]}>Repeat</Text>
              <View style={styles.repeatOptions}>
                {(['daily', 'weekdays', 'weekends', 'weekly', 'once'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.repeatChip,
                      newReminderRepeat === opt && styles.repeatChipActive
                    ]}
                    onPress={() => setNewReminderRepeat(opt)}
                  >
                    <Text style={[
                      styles.repeatText,
                      newReminderRepeat === opt && styles.repeatTextActive
                    ]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={addReminder}>
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.saveGradient}>
                  <Text style={styles.saveButtonText}>Set Reminder</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Time Picker */}
      {showPicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
          textColor={isDark ? '#fff' : '#000'}
        />
      )}

      {/* Sweet Alert */}
      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
    </View>
  );
}

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    potty: '#667eea',
    feed: '#fa709a',
    sleep: '#11998e',
    milestone: '#f59e0b',
    medication: '#ef4444',
    play: '#ec4899',
    custom: '#64748b',
  };
  return colors[category] || '#667eea';
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
    paddingBottom: 40,
  },
  textDark: {
    color: '#ffffff',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    zIndex: 100,
  },
  backButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  backBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  babyName: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Streak Card
  streakCard: {
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  streakGradient: {
    padding: 20,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  streakTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  streakSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  streakAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  streakActionText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },

  // Next Card
  nextCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  nextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nextBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  nextBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  nextContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  nextTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  nextTime: {
    fontSize: 16,
    color: '#666',
  },
  disabledBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(100,116,139,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  disabledText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // Smart Suggestions
  suggestionsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  suggestionCard: {
    width: 280,
    marginRight: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  suggestionBlur: {
    padding: 20,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionEmoji: {
    fontSize: 32,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  suggestionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionTime: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  suggestionBasedOn: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // List
  listContainer: {
    borderRadius: 24,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  reminderEmoji: {
    fontSize: 24,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  reminderDisabled: {
    color: '#94a3b8',
  },
  reminderSub: {
    fontSize: 13,
    color: '#64748b',
  },
  reminderNotes: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    fontStyle: 'italic',
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 84,
  },

  // Empty State
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Achievement Card
  achievementCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
  },
  achievementGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  achievementIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  achievementCardTitle: {
    fontSize: 18,
    fontWeight: '800',
        color: '#fff',
  },
  achievementCardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },

  // Glass Card
  glassCard: { 
    borderRadius: 24, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.5)', 
    shadowColor: '#667eea', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 20, 
    elevation: 10 
  },
  glassBorder: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    height: 1, 
    backgroundColor: 'rgba(255,255,255,0.8)' 
  },
  glassContent: { flex: 1 },

  // Modal
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.85,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 20,
  },
  textInputDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'rgba(100,116,139,0.05)',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(100,116,139,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  repeatOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  repeatChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(100,116,139,0.1)',
  },
  repeatChipActive: {
    backgroundColor: '#667eea',
  },
  repeatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  repeatTextActive: {
    color: '#fff',
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Alert
  alertContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 10, 
    minWidth: 300, 
    maxWidth: width - 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  alertTextContainer: { flex: 1 },
  alertTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    marginBottom: 2,
    color: '#1e293b',
  },
  alertMessage: { 
    fontSize: 13, 
    color: '#64748b' 
  },
});