// src/screens/TimelineScreen.tsx
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
  useColorScheme,
  Platform,
  Modal,
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
  interpolate,
  Extrapolation,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isSameDay, isToday, isYesterday, isSameWeek, differenceInDays } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActivity, ActivityEntry, ActivityType, getDateTitle } from '../context/ActivityContext';
import { useBaby, Milestone } from '../context/BabyContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');

const FILTERS: { id: ActivityType | 'all' | 'milestone'; label: string; icon: string; color: string; gradient: [string, string] }[] = [
  { id: 'all', label: 'All', icon: 'grid-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { id: 'potty', label: 'Potty', icon: 'water-outline', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { id: 'feed', label: 'Feed', icon: 'nutrition-outline', color: '#fa709a', gradient: ['#fa709a', '#f5576c'] },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
  { id: 'growth', label: 'Growth', icon: 'trending-up-outline', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'milestone', label: 'Milestone', icon: 'trophy-outline', color: '#ffd700', gradient: ['#ffd700', '#ffaa00'] },
  { id: 'medication', label: 'Health', icon: 'medical-outline', color: '#ff6b6b', gradient: ['#ff6b6b', '#ee5a5a'] },
];

interface GroupedEvents {
  title: string;
  date: Date;
  events: ActivityEntry[];
}

type TimelineScreenRouteProp = RouteProp<RootStackParamList, 'Timeline'>;
type TimelineScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// ==================== SWEET ALERT COMPONENT ====================

const SweetAlertTimeline: React.FC<{
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}> = ({ visible, type, title, message, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withSpring(1);
      const timer = setTimeout(() => {
        scale.value = withSpring(0);
        opacity.value = withSpring(0, {}, () => runOnJS(onClose)());
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, animatedStyle]}>
        <LinearGradient
          colors={[colors[type], `${colors[type]}dd`]}
          style={styles.alertGradient}
        >
          <Ionicons 
            name={type === 'success' ? 'checkmark-circle' : type === 'error' ? 'close-circle' : type === 'warning' ? 'warning' : 'information-circle'} 
            size={56} 
            color="#fff" 
          />
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertDismiss} onPress={onClose}>
            <Text style={styles.alertDismissText}>Tap to dismiss</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

// ==================== ADD MILESTONE MODAL ====================

const AddMilestoneModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (milestone: Partial<Milestone>) => void;
}> = ({ visible, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'motor' | 'cognitive' | 'social' | 'language' | 'emotional' | 'other'>('motor');
  const [isFirstTime, setIsFirstTime] = useState(true);

  const categories = [
    { id: 'motor', label: 'Motor Skills', emoji: '🏃', color: '#3b82f6' },
    { id: 'cognitive', label: 'Cognitive', emoji: '🧠', color: '#8b5cf6' },
    { id: 'social', label: 'Social', emoji: '👋', color: '#f59e0b' },
    { id: 'language', label: 'Language', emoji: '🗣️', color: '#ec4899' },
    { id: 'emotional', label: 'Emotional', emoji: '❤️', color: '#ef4444' },
    { id: 'other', label: 'Other', emoji: '✨', color: '#10b981' },
  ] as const;

  const handleSave = () => {
    if (!title.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      category,
      isFirstTime,
      achievedAt: new Date().toISOString(),
    });

    // Reset
    setTitle('');
    setDescription('');
    setCategory('motor');
    setIsFirstTime(true);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.milestoneModalOverlay}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeInUp.springify()} style={styles.milestoneModalContent}>
          <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']} style={StyleSheet.absoluteFill} />
          
          <View style={styles.milestoneModalHeader}>
            <View style={styles.milestoneIconBg}>
              <Text style={styles.milestoneIcon}>🏆</Text>
            </View>
            <Text style={styles.milestoneModalTitle}>Record Milestone</Text>
            <TouchableOpacity onPress={onClose} style={styles.milestoneModalClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.milestoneForm}>
            <View style={styles.milestoneField}>
              <Text style={styles.milestoneLabel}>What did they achieve? *</Text>
              <TextInput
                style={styles.milestoneInput}
                placeholder="e.g., First steps, First word, Rolled over..."
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>

            <View style={styles.milestoneField}>
              <Text style={styles.milestoneLabel}>Category</Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      category === cat.id && { backgroundColor: `${cat.color}20`, borderColor: cat.color }
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCategory(cat.id);
                    }}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.categoryLabel, category === cat.id && { color: cat.color, fontWeight: '700' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.milestoneField}>
              <Text style={styles.milestoneLabel}>Details (optional)</Text>
              <TextInput
                style={[styles.milestoneInput, styles.milestoneTextarea]}
                placeholder="Describe what happened, how they reacted..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={styles.firstTimeToggle}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsFirstTime(!isFirstTime);
              }}
            >
              <View style={[styles.toggleCheckbox, isFirstTime && styles.toggleCheckboxActive]}>
                {isFirstTime && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.toggleLabel}>This is the first time! 🌟</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.milestoneSaveBtn} onPress={handleSave}>
              <LinearGradient colors={['#ffd700', '#ffaa00']} style={styles.milestoneSaveGradient}>
                <Ionicons name="trophy" size={20} color="#fff" />
                <Text style={styles.milestoneSaveText}>Record Milestone</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ==================== GLASSMORPHISM CARD COMPONENT ====================

const GlassmorphismCard: React.FC<{ 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  intensity?: number;
  gradient?: [string, string];
}> = ({ children, style, onPress, intensity = 80, gradient }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={gradient || (isDark ? ['rgba(40,40,40,0.8)', 'rgba(20,20,20,0.6)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)'])}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

// ==================== EVENT CARD COMPONENT ====================

const EventCard: React.FC<{
  event: ActivityEntry;
  isLast: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  delay: number;
}> = ({ event, isLast, onPress, onEdit, onDelete, delay }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getEventColor = (type: string) => {
    const filter = FILTERS.find(f => f.id === type);
    return filter?.color || '#667eea';
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      potty: '🚽',
      feed: '🍼',
      sleep: '😴',
      diaper: '🧷',
      growth: '📏',
      milestone: '🌟',
      medication: '💊',
      note: '📝',
    };
    return icons[type] || '📝';
  };

  const color = getEventColor(event.type);
  const time = format(event.timestamp, 'h:mm a');

  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).springify()}
      layout={Layout.springify()}
    >
      <View style={styles.eventRow}>
        {/* Timeline Column */}
        <View style={styles.timeColumn}>
          <Text style={[styles.timeText, { color }]}>{time}</Text>
          {!isLast && (
            <View style={[styles.timelineLine, { backgroundColor: `${color}30` }]} />
          )}
        </View>

        {/* Event Card */}
        <TouchableOpacity 
          style={styles.eventCardContainer}
          onPress={onPress}
          activeOpacity={0.9}
        >
          <GlassmorphismCard style={styles.eventCard} intensity={60}>
            <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
              <Text style={styles.eventIcon}>{event.icon || getEventIcon(event.type)}</Text>
            </View>
            
            <View style={styles.eventContent}>
              <Text style={[styles.eventTitle, isDark && styles.textDark]}>{event.title}</Text>
              {event.details && (
                <Text style={styles.eventSubtitle} numberOfLines={2}>{event.details}</Text>
              )}
              <View style={styles.eventMeta}>
                <Text style={styles.eventTime}>
                  {format(event.timestamp, 'MMM d, h:mm a')}
                </Text>
                {event.loggedByName && (
                  <Text style={styles.eventAuthor}>by {event.loggedByName}</Text>
                )}
              </View>
            </View>

            {/* Action Menu */}
            <View style={styles.eventActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={onEdit}
              >
                <Ionicons name="create-outline" size={18} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={onDelete}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </GlassmorphismCard>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ==================== FILTER CHIP COMPONENT ====================

const FilterChip: React.FC<{
  filter: typeof FILTERS[0];
  isSelected: boolean;
  onPress: () => void;
  index: number;
}> = ({ filter, isSelected, onPress, index }) => {
  return (
    <AnimatedTouchableOpacity
      entering={FadeIn.delay(index * 50)}
      onPress={onPress}
      style={[
        styles.filterChip,
        isSelected && { 
          backgroundColor: filter.color,
          borderColor: filter.color,
          transform: [{ scale: 1.05 }]
        }
      ]}
    >
      <Ionicons 
        name={filter.icon as any} 
        size={16} 
        color={isSelected ? '#fff' : filter.color} 
        style={styles.filterIcon}
      />
      <Text style={[
        styles.filterText,
        isSelected && { color: '#fff', fontWeight: '700' }
      ]}>
        {filter.label}
      </Text>
    </AnimatedTouchableOpacity>
  );
};

// ==================== STICKY HEADER COMPONENT ====================

const StickyHeader: React.FC<{
  scrollY: any;
  babyName: string;
  stats: { today: number; total: number; milestones: number };
  onBack: () => void;
  onAdd: () => void;
  onSearch: () => void;
  onAddMilestone: () => void;
  showSearch: boolean;
  insets: any;
}> = ({ scrollY, babyName, stats, onBack, onAdd, onSearch, onAddMilestone, showSearch, insets }) => {
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
    return { opacity, transform: [{ translateY }] };
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
    <View style={[styles.stickyHeaderContainer, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.1)', 'transparent']}
        style={styles.headerGradient}
      />
      
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <BlurView intensity={80} style={styles.backBlur} tint="light">
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </BlurView>
        </TouchableOpacity>

        <Animated.View style={[styles.headerCenter, titleAnimatedStyle]}>
          <Text style={styles.headerTitleLarge}>📅 Timeline</Text>
          <Text style={styles.headerSubtitle}>{babyName} • {stats.today} today • {stats.milestones} 🏆</Text>
        </Animated.View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={onSearch} style={styles.headerActionBtn}>
            <BlurView intensity={80} style={styles.actionBlur} tint="light">
              <Ionicons name={showSearch ? "close" : "search"} size={22} color="#1e293b" />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAddMilestone} style={styles.headerActionBtn}>
            <BlurView intensity={80} style={styles.actionBlur} tint="light">
              <Ionicons name="trophy" size={22} color="#f59e0b" />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAdd} style={styles.headerActionBtn}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addButtonSmall}>
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.stickyTitleContainer, headerAnimatedStyle, { top: insets.top }]}>
        <BlurView intensity={90} style={styles.stickyBlur} tint="light">
          <Text style={styles.stickyTitle}>📅 Timeline</Text>
          <Text style={styles.stickySubtitle}>{stats.today} entries • {stats.milestones} milestones</Text>
        </BlurView>
      </Animated.View>
    </View>
  );
};

// ==================== MILESTONE CARD COMPONENT ====================

const MilestoneCard: React.FC<{
  milestone: Milestone;
  onPress: () => void;
  delay: number;
}> = ({ milestone, onPress, delay }) => {
  const categoryColors: Record<string, string> = {
    motor: '#3b82f6',
    cognitive: '#8b5cf6',
    social: '#f59e0b',
    language: '#ec4899',
    emotional: '#ef4444',
    other: '#10b981',
  };

  const categoryEmojis: Record<string, string> = {
    motor: '🏃',
    cognitive: '🧠',
    social: '👋',
    language: '🗣️',
    emotional: '❤️',
    other: '✨',
  };

  const color = categoryColors[milestone.category || 'other'] || '#10b981';
  const emoji = categoryEmojis[milestone.category || 'other'] || '✨';

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <GlassmorphismCard style={styles.milestoneCard}>
          <View style={[styles.milestoneCardIconBg, { backgroundColor: `${color}15` }]}>
            <Text style={styles.milestoneCardIcon}>{emoji}</Text>
          </View>
          <View style={styles.milestoneCardContent}>
            <Text style={styles.milestoneCardTitle}>{milestone.title}</Text>
            {milestone.description && (
              <Text style={styles.milestoneCardDesc} numberOfLines={2}>{milestone.description}</Text>
            )}
            <View style={styles.milestoneCardMeta}>
              <Text style={styles.milestoneCardDate}>
                {format(new Date(milestone.achievedAt), 'MMM d, yyyy')}
              </Text>
              {milestone.isFirstTime && (
                <View style={styles.firstTimeBadge}>
                  <Text style={styles.firstTimeText}>🌟 First Time</Text>
                </View>
              )}
            </View>
          </View>
        </GlassmorphismCard>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== MAIN TIMELINE SCREEN ====================

export default function TimelineScreen() {
  const navigation = useNavigation<TimelineScreenNavigationProp>();
  const route = useRoute<TimelineScreenRouteProp>();
  
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { 
    entries, 
    isLoading, 
    loadEntries, 
    deleteEntry,
    getDateTitle,
    addEntry,
  } = useActivity();
  
  const { 
    currentBaby, 
    milestones, 
    addMilestone, 
    deleteMilestone 
  } = useBaby();
  
  const { userProfile } = useAuth();

  const scrollY = useSharedValue(0);
  
  const [selectedFilter, setSelectedFilter] = useState<ActivityType | 'all' | 'milestone'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  
  // Alert state
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Handle route params
  useEffect(() => {
    if (route.params?.filter) {
      setSelectedFilter(route.params.filter as ActivityType | 'all' | 'milestone');
    }
  }, [route.params]);

  // Convert milestones to activity entries for display
  const milestoneEntries: ActivityEntry[] = useMemo(() => {
    return milestones.map(m => ({
      id: m.id,
      type: 'milestone' as ActivityType,
      title: `🏆 ${m.title}`,
      details: m.description,
      timestamp: new Date(m.achievedAt).getTime(),
      babyId: currentBaby?.id || '',
      loggedBy: m.recordedBy || 'Parent',
      loggedByName: m.recordedByName || 'Parent',
      icon: '🌟',
      tags: m.isFirstTime ? ['first_time'] : [],
      category: m.category,
    }));
  }, [milestones, currentBaby]);

  // Combine regular entries with milestone entries
  const allEntries = useMemo(() => {
    return [...entries, ...milestoneEntries].sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, milestoneEntries]);

  const groupedEvents = useMemo(() => {
    let filtered = allEntries;

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(e => e.type === selectedFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(query) ||
        e.details?.toLowerCase().includes(query) ||
        e.type.toLowerCase().includes(query)
      );
    }

    const groups: GroupedEvents[] = [];
    let currentGroup: GroupedEvents | null = null;

    filtered.forEach(event => {
      const eventDate = new Date(event.timestamp);
      
      if (!currentGroup || !isSameDay(currentGroup.date, eventDate)) {
        currentGroup = {
          title: getDateTitle(event.timestamp),
          date: eventDate,
          events: []
        };
        groups.push(currentGroup);
      }
      currentGroup.events.push(event);
    });

    return groups;
  }, [allEntries, selectedFilter, searchQuery, getDateTitle]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    
    return {
      today: allEntries.filter(e => new Date(e.timestamp).getTime() >= todayStart).length,
      total: allEntries.length,
      milestones: milestones.length,
    };
  }, [allEntries, milestones]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }, [loadEntries]);

  const handleAddLog = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddLog', { type: selectedFilter !== 'all' && selectedFilter !== 'milestone' ? selectedFilter : undefined });
  }, [navigation, selectedFilter]);

  const handleAddMilestone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowMilestoneModal(true);
  }, []);

  const handleSaveMilestone = useCallback(async (milestoneData: Partial<Milestone>) => {
    if (!currentBaby) return;
    
    const success = await addMilestone({
      ...milestoneData,
      babyId: currentBaby.id,
    });

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlert({
        visible: true,
        type: 'success',
        title: 'Milestone Recorded! 🏆',
        message: `"${milestoneData.title}" has been added to ${currentBaby.name}'s achievements.`,
      });
    } else {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to save milestone. Please try again.',
      });
    }
  }, [currentBaby, addMilestone]);

  const handleEditEvent = useCallback((event: ActivityEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (event.type === 'milestone') {
      // Find the milestone and edit it
      const milestone = milestones.find(m => m.id === event.id);
      if (milestone) {
        Alert.alert(
          'Edit Milestone',
          'Milestone editing coming soon!',
          [{ text: 'OK' }]
        );
      }
    } else {
      navigation.navigate('AddLog', { 
        editMode: true, 
        eventId: event.id,
        type: event.type 
      });
    }
  }, [navigation, milestones]);

  const handleDeleteEvent = useCallback((event: ActivityEntry) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            if (event.type === 'milestone') {
              await deleteMilestone(event.id);
            } else {
              await deleteEntry(event.id);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setAlert({
              visible: true,
              type: 'success',
              title: 'Deleted',
              message: 'Entry has been removed',
            });
          }
        },
      ]
    );
  }, [deleteEntry, deleteMilestone]);

  const handleEventPress = useCallback((event: ActivityEntry) => {
    if (event.type === 'milestone') {
      // Show milestone details
      Alert.alert(
        event.title,
        event.details || 'No additional details',
        [{ text: 'Awesome!', style: 'default' }]
      );
    } else {
      navigation.navigate('AddLog', { 
        viewMode: true,
        eventId: event.id,
        type: event.type 
      });
    }
  }, [navigation]);

  const handleQuickAdd = useCallback((type: ActivityType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddLog', { type });
  }, [navigation]);

  const handleScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={styles.loadingGradient}>
          <Text style={styles.loadingText}>LittleLoom</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* SweetAlert */}
      <SweetAlertTimeline
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert(prev => ({ ...prev, visible: false }))}
      />
      
      {/* Background gradient */}
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.backgroundGradient} />

      {/* Sticky Header */}
      <StickyHeader
        scrollY={scrollY}
        babyName={currentBaby?.name || 'Baby'}
        stats={stats}
        onBack={() => navigation.goBack()}
        onAdd={handleAddLog}
        onSearch={() => setShowSearch(!showSearch)}
        onAddMilestone={handleAddMilestone}
        showSearch={showSearch}
        insets={insets}
      />

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#667eea" 
            colors={['#667eea', '#764ba2']}
            progressViewOffset={insets.top + 140}
          />
        }
      >
        {/* Search Bar */}
        {showSearch && (
          <Animated.View entering={FadeInDown} style={styles.searchContainer}>
            <BlurView intensity={90} style={styles.searchBlur} tint={isDark ? 'dark' : 'light'}>
              <Ionicons name="search" size={20} color={isDark ? '#64748b' : '#94a3b8'} />
              <TextInput
                style={[styles.searchInput, isDark && styles.textDark]}
                placeholder="Search entries..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={isDark ? '#64748b' : '#94a3b8'} />
                </TouchableOpacity>
              )}
            </BlurView>
          </Animated.View>
        )}

        {/* Stats Overview */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.statsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContent}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.statCard, styles.primaryStatCard]}>
              <Text style={styles.primaryStatEmoji}>📊</Text>
              <Text style={styles.primaryStatNumber}>{stats.today}</Text>
              <Text style={styles.primaryStatLabel}>Today</Text>
            </LinearGradient>
            
            <GlassmorphismCard style={[styles.statCard, styles.secondaryStatCard]}>
              <Text style={styles.secondaryStatEmoji}>📁</Text>
              <Text style={styles.secondaryStatNumber}>{stats.total}</Text>
              <Text style={styles.secondaryStatLabel}>Total</Text>
            </GlassmorphismCard>
            
            <GlassmorphismCard style={[styles.statCard, styles.secondaryStatCard]}>
              <Text style={styles.secondaryStatEmoji}>🏆</Text>
              <Text style={[styles.secondaryStatNumber, { color: '#f59e0b' }]}>
                {stats.milestones}
              </Text>
              <Text style={styles.secondaryStatLabel}>Milestones</Text>
            </GlassmorphismCard>
            
            {FILTERS.filter(f => f.id !== 'all' && f.id !== 'milestone').slice(0, 3).map(filter => {
              const count = entries.filter(e => e.type === filter.id).length;
              return (
                <GlassmorphismCard key={filter.id} style={[styles.statCard, styles.secondaryStatCard]}>
                  <Text style={styles.secondaryStatEmoji}>
                    {filter.id === 'potty' ? '🚽' : 
                     filter.id === 'feed' ? '🍼' : 
                     filter.id === 'sleep' ? '😴' : '📋'}
                  </Text>
                  <Text style={[styles.secondaryStatNumber, { color: filter.color }]}>
                    {count}
                  </Text>
                  <Text style={styles.secondaryStatLabel}>{filter.label}</Text>
                </GlassmorphismCard>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Filters */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activitySelector}
          >
            {FILTERS.map((filter, index) => (
              <FilterChip
                key={filter.id}
                filter={filter}
                isSelected={selectedFilter === filter.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedFilter(filter.id);
                }}
                index={index}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Quick Add Buttons */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.quickAddContainer}>
          <Text style={[styles.quickAddTitle, isDark && styles.textDark]}>Quick Add:</Text>
          <View style={styles.quickAddButtons}>
            <TouchableOpacity
              style={[styles.quickAddBtn, { backgroundColor: '#ffd70015' }]}
              onPress={handleAddMilestone}
            >
              <Ionicons name="trophy" size={18} color="#f59e0b" />
              <Text style={[styles.quickAddText, { color: '#f59e0b' }]}>Milestone</Text>
            </TouchableOpacity>
            
            {['potty', 'feed', 'sleep'].map((type) => {
              const filter = FILTERS.find(f => f.id === type);
              if (!filter) return null;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.quickAddBtn, { backgroundColor: `${filter.color}15` }]}
                  onPress={() => handleQuickAdd(type as ActivityType)}
                >
                  <Ionicons name={filter.icon as any} size={18} color={filter.color} />
                  <Text style={[styles.quickAddText, { color: filter.color }]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Milestones Section (when filter is 'milestone' or 'all') */}
        {(selectedFilter === 'milestone' || selectedFilter === 'all') && milestones.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>🏆 Recent Milestones</Text>
              {selectedFilter !== 'milestone' && (
                <TouchableOpacity onPress={() => setSelectedFilter('milestone')}>
                  <Text style={styles.seeAll}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.milestonesScroll}>
              {milestones
                .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
                .slice(0, 5)
                .map((milestone, index) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    onPress={() => handleEventPress(milestoneEntries.find(e => e.id === milestone.id)!)}
                    delay={index * 100}
                  />
                ))}
            </ScrollView>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timelineContainer}>
          {groupedEvents.length === 0 ? (
            <Animated.View entering={FadeInUp.delay(400)} style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="document-text-outline" size={64} color={isDark ? '#475569' : '#cbd5e1'} />
              </View>
              <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
                {searchQuery ? 'No matches found' : 'No entries yet'}
              </Text>
              <Text style={[styles.emptySubtitle, isDark && { color: '#64748b' }]}>
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : "Start tracking your baby's activities by tapping the + button"
                }
              </Text>
              {!searchQuery && (
                <TouchableOpacity style={styles.emptyButton} onPress={handleAddLog}>
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.emptyButtonGradient}
                  >
                    <Text style={styles.emptyButtonText}>Add First Entry</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </Animated.View>
          ) : (
            groupedEvents.map((group, groupIndex) => (
              <View key={group.title} style={styles.daySection}>
                <Animated.View entering={FadeInUp.delay(groupIndex * 100)}>
                  <View style={styles.dateHeaderContainer}>
                    <Text style={[styles.dateHeader, isDark && styles.textDark]}>{group.title}</Text>
                    <View style={[styles.dateBadge, { backgroundColor: '#667eea20' }]}>
                      <Text style={[styles.dateBadgeText, { color: '#667eea' }]}>{group.events.length}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.eventsContainer}>
                    {group.events.map((event, eventIndex) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        isLast={eventIndex === group.events.length - 1}
                        onPress={() => handleEventPress(event)}
                        onEdit={() => handleEditEvent(event)}
                        onDelete={() => handleDeleteEvent(event)}
                        delay={groupIndex * 100 + eventIndex * 50}
                      />
                    ))}
                  </View>
                </Animated.View>
              </View>
            ))
          )}
          
          <View style={{ height: insets.bottom + 40 }} />
        </View>
      </Animated.ScrollView>

      {/* Add Milestone Modal */}
      <AddMilestoneModal
        visible={showMilestoneModal}
        onClose={() => setShowMilestoneModal(false)}
        onSave={handleSaveMilestone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Base
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  textDark: { color: '#ffffff' },
  
  // SweetAlert
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alertContainer: {
    width: width * 0.85,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  alertGradient: {
    padding: 28,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  alertDismiss: {
    marginTop: 8,
  },
  alertDismissText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  // Milestone Modal
  milestoneModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  milestoneModalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: height * 0.8,
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
  },
  milestoneModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  milestoneIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  milestoneIcon: {
    fontSize: 32,
  },
  milestoneModalTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
  },
  milestoneModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneForm: {
    maxHeight: height * 0.6,
  },
  milestoneField: {
    marginBottom: 20,
  },
  milestoneLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  milestoneInput: {
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(100,116,139,0.08)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  milestoneTextarea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  firstTimeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 4,
  },
  toggleCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toggleCheckboxActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  milestoneSaveBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  milestoneSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  milestoneSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Milestone Card
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginRight: 12,
    width: 280,
  },
  milestoneCardIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  milestoneCardIcon: {
    fontSize: 24,
  },
  milestoneCardContent: {
    flex: 1,
  },
  milestoneCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  milestoneCardDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 18,
  },
  milestoneCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneCardDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  firstTimeBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  firstTimeText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '700',
  },
  milestonesScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 32, fontWeight: '800', color: '#667eea', marginBottom: 20 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#667eea' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  // Sticky Header
  stickyHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
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

  // Search
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 10,
    paddingVertical: 12,
  },
  
  // Stats
  statsContainer: {
    marginBottom: 16,
  },
  statsContent: {
    paddingHorizontal: 20,
    gap: 12,
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

  // Filters
  filterContainer: {
    marginBottom: 16,
  },
  activitySelector: { 
    paddingHorizontal: 20, 
    paddingBottom: 8,
    gap: 10 
  },
  filterChip: { 
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
  filterIcon: {
    marginRight: 2,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  
  // Quick Add
  quickAddContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quickAddTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickAddButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  quickAddText: {
    fontSize: 14,
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
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  
  // Timeline
  timelineContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  daySection: {
    marginBottom: 24,
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 4,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  dateBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 10,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  eventsContainer: {
    gap: 12,
  },
  
  // Event Card
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeColumn: {
    width: 70,
    alignItems: 'flex-start',
    paddingTop: 16,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineLine: {
    width: 2,
    height: 80,
    marginLeft: 20,
    marginTop: 8,
    borderRadius: 1,
  },
  eventCardContainer: {
    flex: 1,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  eventIcon: {
    fontSize: 24,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  eventSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
    lineHeight: 18,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  eventAuthor: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  eventActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyButtonGradient: {
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Scroll Content
  scrollContent: {
    paddingTop: 140,
  },
});