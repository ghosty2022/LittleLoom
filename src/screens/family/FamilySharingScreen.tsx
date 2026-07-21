import {
  StyleSheet,
  ActivityIndicator,
  Linking,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Modal,
  Image,
  TextInput,
  Switch,
  RefreshControl,
  StatusBar,
  Platform,
  Share,
  ScrollView,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';
import { EmptyState } from '../../components/EmptyState';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeInUp, 
  FadeInDown, 
  FadeIn, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  useAnimatedScrollHandler, 
  interpolate, 
  Extrapolation, 
  Layout,
  FadeInRight,
  FadeInLeft,
  SlideInRight,
} from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

/* Permanent storage for family-member photos (cache URIs get purged by the OS) */
const FAMILY_IMAGES_DIR = FileSystem.documentDirectory + 'family_images/';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { UserRole, FamilyMember, Permission, ROLE_LABELS, ROLE_PERMISSIONS } from '../../types/roles';

import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { useTracker } from '../../context/TrackerContext';
type FamilySharingScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilySharing'>;

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Refined, cohesive, modern system
// ═══════════════════════════════════════════════════════════════════════════

const DESIGN = {
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const AnimatedScrollView = Animated.ScrollView;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

// ═══════════════════════════════════════════════════════════════════════════
// ROLE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_CONFIG: Record<UserRole, {
  label: string;
  color: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  permissions: string[];
  canEdit: boolean;
  canRemove: boolean;
  canPromote: boolean;
  badge: string;
  priority: number;
  maxCount: number;
}> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    icon: 'shield',
    description: 'Full owner access to everything',
    permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data', 'Billing', 'Delete Account'],
    canEdit: true,
    canRemove: false,
    canPromote: false,
    badge: 'Owner',
    priority: 1,
    maxCount: 1,
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    icon: 'heart',
    description: 'Full access to manage family and baby data',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data', 'View Analytics'],
    canEdit: true,
    canRemove: true,
    canPromote: false,
    badge: 'Co-Parent',
    priority: 2,
    maxCount: 1,
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    icon: 'shield-checkmark',
    description: 'Can add entries but cannot delete or manage family',
    permissions: ['Read', 'Write', 'Limited Delete', 'View Timeline', 'Add Photos'],
    canEdit: true,
    canRemove: true,
    canPromote: true,
    badge: 'Guardian',
    priority: 3,
    maxCount: 5,
  },
  [UserRole.VIEWER]: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    description: 'View only access, cannot add or modify data',
    permissions: ['Read Only', 'View Timeline', 'View Photos'],
    canEdit: true,
    canRemove: true,
    canPromote: true,
    badge: 'Viewer',
    priority: 4,
    maxCount: 10,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 1: Family Health Score — Composite wellness indicator
// ═══════════════════════════════════════════════════════════════════════════

interface FamilyHealthScoreProps {
  members: FamilyMember[];
  isDark: boolean;
  themeColors: any;
  shouldReduceMotion: boolean;
}

const FamilyHealthScore: React.FC<FamilyHealthScoreProps> = ({ members, isDark, themeColors, shouldReduceMotion }) => {
  const score = useMemo(() => {
    const activeMembers = members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const totalMembers = members.length || 1;
    const activityScore = Math.round((activeMembers / totalMembers) * 100);
    const engagementScore = Math.min(100, members.length * 15);
    return Math.round((activityScore * 0.6) + (engagementScore * 0.4));
  }, [members]);

  const getScoreColor = (s: number) => {
    if (s >= 80) return '#10b981';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Thriving';
    if (s >= 50) return 'Active';
    return 'Needs Attention';
  };

  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100).springify()}>
      <View style={[styles.healthScoreCard, isDark && styles.healthScoreCardDark]}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.healthScoreContent}>
          <View style={styles.healthScoreLeft}>
            <View style={[styles.healthScoreRing, { borderColor: getScoreColor(score) + '30' }]}>
              <Text style={[styles.healthScoreValue, { color: getScoreColor(score) }]}>{score}</Text>
              <Text style={[styles.healthScoreMax, { color: isDark ? '#94a3b8' : '#64748b' }]}>/100</Text>
            </View>
            <View style={styles.healthScoreLabels}>
              <Text style={[styles.healthScoreLabel, isDark && styles.textDark]}>Family Health</Text>
              <Text style={[styles.healthScoreSub, { color: getScoreColor(score) }]}>{getScoreLabel(score)}</Text>
            </View>
          </View>
          <View style={styles.healthScoreRight}>
            {[
              { label: 'Active', value: members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 24 * 60 * 60 * 1000).length, total: members.length, color: '#10b981' },
              { label: 'This Week', value: members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length, total: members.length, color: '#f59e0b' },
              { label: 'Pending', value: members.filter(m => !m.lastActive).length, total: members.length, color: '#ef4444' },
            ].map((stat, i) => (
              <View key={i} style={styles.healthScoreMini}>
                <View style={styles.healthScoreMiniBarWrap}>
                  <View style={[styles.healthScoreMiniBarBg, { backgroundColor: stat.color + '15' }]}>
                    <View style={[styles.healthScoreMiniBarFill, { width: `${Math.min((stat.value / (stat.total || 1)) * 100, 100)}%`, backgroundColor: stat.color }]} />
                  </View>
                </View>
                <Text style={[styles.healthScoreMiniValue, { color: stat.color }]}>{stat.value}/{stat.total}</Text>
                <Text style={[styles.healthScoreMiniLabel, isDark && styles.textMuted]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 2: Daily Family Goals — Collaborative tracking
// ═══════════════════════════════════════════════════════════════════════════

interface DailyGoal {
  id: string;
  title: string;
  icon: string;
  target: number;
  current: number;
  unit: string;
  color: string;
  participants: string[];
}

const DailyFamilyGoals: React.FC<{
  goals: DailyGoal[];
  isDark: boolean;
  themeColors: any;
  shouldReduceMotion: boolean;
  onToggleGoal: (id: string) => void;
}> = ({ goals, isDark, themeColors, shouldReduceMotion, onToggleGoal }) => {
  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(150).springify()}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Daily Goals</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{goals.filter(g => g.current >= g.target).length} of {goals.length} completed</Text>
        </View>
        <View style={[styles.sectionBadge, { backgroundColor: themeColors.primary + '15' }]}>
          <Text style={[styles.sectionBadgeText, { color: themeColors.primary }]}>{Math.round((goals.filter(g => g.current >= g.target).length / (goals.length || 1)) * 100)}%</Text>
        </View>
      </View>

      <View style={styles.goalsContainer}>
        {goals.map((goal, index) => {
          const progress = Math.min(goal.current / goal.target, 1);
          const isComplete = progress >= 1;

          return (
            <Animated.View
              key={goal.id}
              entering={shouldReduceMotion ? undefined : FadeInRight.delay(index * 80).springify()}
              style={[styles.goalCard, isDark && styles.goalCardDark]}
            >
              <LinearGradient
                colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />

              <TouchableOpacity
                onPress={() => onToggleGoal(goal.id)}
                style={styles.goalContent}
                activeOpacity={0.85}
              >
                <View style={[styles.goalIconBg, { backgroundColor: isComplete ? goal.color + '20' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
                  <Text style={styles.goalIcon}>{goal.icon}</Text>
                  {isComplete && (
                    <View style={[styles.goalCheckmark, { backgroundColor: goal.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>

                <View style={styles.goalInfo}>
                  <Text style={[styles.goalTitle, isDark && styles.textDark]} numberOfLines={1}>{goal.title}</Text>
                  <View style={styles.goalProgressRow}>
                    <View style={[styles.goalProgressBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                      <View style={[styles.goalProgressFill, { width: `${progress * 100}%`, backgroundColor: goal.color }]} />
                    </View>
                    <Text style={[styles.goalProgressText, { color: goal.color }]}>{goal.current}/{goal.target}</Text>
                  </View>
                  <Text style={[styles.goalUnit, isDark && styles.textMuted]}>{goal.unit}</Text>
                </View>

                <View style={styles.goalParticipants}>
                  {goal.participants.slice(0, 3).map((p, i) => (
                    <View key={i} style={[styles.goalParticipantAvatar, { left: i * -8, zIndex: 3 - i, borderColor: isDark ? '#1a1a2e' : '#f8fafc' }]}>
                      <Text style={styles.goalParticipantEmoji}>👤</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 3: Smart Suggestions — AI-driven next actions
// ═══════════════════════════════════════════════════════════════════════════

interface SmartSuggestion {
  id: string;
  type: 'invite' | 'reminder' | 'activity' | 'milestone' | 'health';
  title: string;
  description: string;
  icon: string;
  color: string;
  actionLabel: string;
  priority: 'high' | 'medium' | 'low';
}

const SmartSuggestions: React.FC<{
  suggestions: SmartSuggestion[];
  isDark: boolean;
  themeColors: any;
  shouldReduceMotion: boolean;
  onAction: (suggestion: SmartSuggestion) => void;
}> = ({ suggestions, isDark, themeColors, shouldReduceMotion, onAction }) => {
  if (suggestions.length === 0) return null;

  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200).springify()}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Suggested Next</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>Personalized for your family</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestionsScroll}
        decelerationRate="fast"
        snapToInterval={SCREEN_W * 0.75 + 12}
        snapToAlignment="start"
      >
        {suggestions.map((suggestion, index) => (
          <Animated.View
            key={suggestion.id}
            entering={shouldReduceMotion ? undefined : SlideInRight.delay(index * 100).springify()}
            style={[styles.suggestionCard, isDark && styles.suggestionCardDark]}
          >
            <LinearGradient
              colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={[styles.suggestionPriority, { backgroundColor: suggestion.color }]} />

            <View style={styles.suggestionContent}>
              <View style={[styles.suggestionIconBg, { backgroundColor: suggestion.color + '15' }]}>
                <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
              </View>

              <Text style={[styles.suggestionTitle, isDark && styles.textDark]} numberOfLines={2}>{suggestion.title}</Text>
              <Text style={[styles.suggestionDesc, isDark && styles.textMuted]} numberOfLines={2}>{suggestion.description}</Text>

              <TouchableOpacity
                onPress={() => onAction(suggestion)}
                style={[styles.suggestionActionBtn, { backgroundColor: suggestion.color + '15' }]}
              >
                <Text style={[styles.suggestionActionText, { color: suggestion.color }]}>{suggestion.actionLabel}</Text>
                <Ionicons name="arrow-forward" size={14} color={suggestion.color} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 4: Family Activity Timeline — Rich chronological feed
// ═══════════════════════════════════════════════════════════════════════════

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: number;
  actorName: string;
  actorAvatar?: string;
  actorRole: UserRole;
  metadata?: Record<string, any>;
}

const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; emoji: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty', emoji: '💧' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding', emoji: '🍼' },
  sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep', emoji: '😴' },
  growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth', emoji: '📏' },
  medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication', emoji: '💊' },
  milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone', emoji: '🏆' },
  diaper: { icon: 'layers-outline', color: '#3b82f6', label: 'Diaper', emoji: '👶' },
  note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note', emoji: '📝' },
  login: { icon: 'log-in-outline', color: '#10b981', label: 'Login', emoji: '🔑' },
  permission_change: { icon: 'key-outline', color: '#f59e0b', label: 'Permission', emoji: '🔐' },
  invite_sent: { icon: 'paper-plane-outline', color: '#667eea', label: 'Invite Sent', emoji: '✉️' },
  member_added: { icon: 'person-add-outline', color: '#10b981', label: 'Member Added', emoji: '➕' },
  member_removed: { icon: 'person-remove-outline', color: '#ef4444', label: 'Member Removed', emoji: '➖' },
  profile_update: { icon: 'create-outline', color: '#8b5cf6', label: 'Profile Updated', emoji: '✏️' },
  chat: { icon: 'chatbubble-outline', color: '#ec4899', label: 'Chat', emoji: '💬' },
  baby_added: { icon: 'add-circle-outline', color: '#10b981', label: 'Baby Added', emoji: '👶' },
  photo_uploaded: { icon: 'camera-outline', color: '#ec4899', label: 'Photo', emoji: '📸' },
  default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity', emoji: '•' },
};

const FamilyActivityTimeline: React.FC<{
  events: TimelineEvent[];
  isDark: boolean;
  shouldReduceMotion: boolean;
  onEventPress?: (event: TimelineEvent) => void;
}> = ({ events, isDark, shouldReduceMotion, onEventPress }) => {
  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupByDay = (events: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    events.forEach(event => {
      const date = new Date(event.timestamp);
      const key = date.toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups).map(([date, items]) => ({
      date,
      label: new Date(date).toDateString() === new Date().toDateString() 
        ? 'Today' 
        : new Date(date).toDateString() === new Date(Date.now() - 86400000).toDateString() 
          ? 'Yesterday' 
          : new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      items,
    }));
  };

  const grouped = groupByDay(events.slice(0, 15));

  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(250).springify()}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{events.length} events this week</Text>
        </View>
      </View>

      <View style={styles.timelineContainer}>
        {grouped.map((group, groupIndex) => (
          <View key={group.date}>
            <View style={styles.timelineDayHeader}>
              <View style={[styles.timelineDayLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]} />
              <Text style={[styles.timelineDayLabel, isDark && styles.textMuted]}>{group.label}</Text>
              <View style={[styles.timelineDayLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]} />
            </View>

            {group.items.map((event, eventIndex) => {
              const config = ACTIVITY_CONFIG[event.type] || ACTIVITY_CONFIG.default;
              const isLast = eventIndex === group.items.length - 1 && groupIndex === grouped.length - 1;

              return (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => onEventPress?.(event)}
                  style={styles.timelineItem}
                  activeOpacity={0.7}
                >
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: config.color, borderColor: isDark ? '#1a1a2e' : '#f8fafc' }]} />
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />}
                  </View>

                  <View style={[styles.timelineCard, isDark && styles.timelineCardDark]}>
                    <LinearGradient
                      colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />

                    <View style={styles.timelineCardContent}>
                      <View style={styles.timelineCardHeader}>
                        <View style={[styles.timelineIconBg, { backgroundColor: config.color + '12' }]}>
                          <Text style={styles.timelineEmoji}>{config.emoji}</Text>
                        </View>
                        <View style={styles.timelineCardInfo}>
                          <Text style={[styles.timelineCardTitle, isDark && styles.textDark]} numberOfLines={1}>{event.title}</Text>
                          <Text style={[styles.timelineCardActor, isDark && styles.textMuted]}>
                            by {event.actorName} • {formatTimeAgo(event.timestamp)}
                          </Text>
                        </View>
                        <View style={[styles.timelineTypeBadge, { backgroundColor: config.color + '10' }]}>
                          <Text style={[styles.timelineTypeText, { color: config.color }]}>{config.label}</Text>
                        </View>
                      </View>

                      {event.description && (
                        <Text style={[styles.timelineCardDesc, isDark && styles.textMuted]} numberOfLines={2}>{event.description}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {events.length === 0 && (
          <View style={styles.timelineEmpty}>
            <Ionicons name="time-outline" size={48} color={isDark ? '#555' : '#ccc'} />
            <Text style={[styles.timelineEmptyText, isDark && styles.textMuted]}>No recent activity</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 5: Family Chat Preview — Quick communication hub
// ═══════════════════════════════════════════════════════════════════════════

interface ChatPreview {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  isGroup: boolean;
  participants: number;
}

const FamilyChatPreview: React.FC<{
  chats: ChatPreview[];
  isDark: boolean;
  themeColors: any;
  shouldReduceMotion: boolean;
  onChatPress: (chat: ChatPreview) => void;
  onSeeAll: () => void;
}> = ({ chats, isDark, themeColors, shouldReduceMotion, onChatPress, onSeeAll }) => {
  if (chats.length === 0) return null;

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300).springify()}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Family Chat</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{chats.reduce((sum, c) => sum + c.unreadCount, 0)} unread messages</Text>
        </View>
        <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn}>
          <Text style={[styles.seeAllText, { color: themeColors.primary }]}>See All</Text>
          <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.chatPreviewContainer}>
        {chats.slice(0, 3).map((chat, index) => (
          <TouchableOpacity
            key={chat.id}
            onPress={() => onChatPress(chat)}
            style={[styles.chatPreviewItem, isDark && styles.chatPreviewItemDark]}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={styles.chatPreviewAvatar}>
              {chat.isGroup ? (
                <View style={[styles.chatGroupAvatar, { backgroundColor: themeColors.primary + '20' }]}>
                  <Ionicons name="people" size={20} color={themeColors.primary} />
                </View>
              ) : (
                <View style={[styles.chatUserAvatar, { backgroundColor: themeColors.primary + '20' }]}>
                  <Text style={styles.chatUserAvatarText}>{chat.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {chat.unreadCount > 0 && (
                <View style={[styles.chatUnreadBadge, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.chatUnreadText}>{chat.unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.chatPreviewInfo}>
              <View style={styles.chatPreviewTop}>
                <Text style={[styles.chatPreviewName, isDark && styles.textDark]} numberOfLines={1}>{chat.name}</Text>
                <Text style={[styles.chatPreviewTime, isDark && styles.textMuted]}>{formatTime(chat.timestamp)}</Text>
              </View>
              <Text style={[styles.chatPreviewMessage, isDark && styles.textMuted]} numberOfLines={1}>{chat.lastMessage}</Text>
            </View>

            <Ionicons name="chevron-forward" size={16} color={isDark ? '#555' : '#ccc'} />
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW FEATURE 6: Family Insights & Tips — Contextual intelligence cards
// ═══════════════════════════════════════════════════════════════════════════

interface FamilyInsight {
  id: string;
  category: 'tip' | 'alert' | 'milestone' | 'health' | 'social';
  title: string;
  description: string;
  icon: string;
  color: string;
  action?: { label: string; onPress: () => void };
}

const FamilyInsights: React.FC<{
  insights: FamilyInsight[];
  isDark: boolean;
  themeColors: any;
  shouldReduceMotion: boolean;
}> = ({ insights, isDark, themeColors, shouldReduceMotion }) => {
  if (insights.length === 0) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tip': return '💡';
      case 'alert': return '⚠️';
      case 'milestone': return '🎯';
      case 'health': return '❤️';
      case 'social': return '👥';
      default: return '✨';
    }
  };

  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(350).springify()}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Smart Insights</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>Personalized for your family</Text>
        </View>
      </View>

      <View style={styles.insightsContainer}>
        {insights.map((insight, index) => (
          <Animated.View
            key={insight.id}
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 60).springify()}
            style={[styles.insightItem, isDark && styles.insightItemDark]}
          >
            <LinearGradient
              colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={[styles.insightLeftBorder, { backgroundColor: insight.color }]} />

            <View style={styles.insightContent}>
              <View style={styles.insightHeader}>
                <View style={[styles.insightIconBg, { backgroundColor: insight.color + '12' }]}>
                  <Text style={styles.insightIcon}>{getCategoryIcon(insight.category)}</Text>
                </View>
                <View style={styles.insightHeaderText}>
                  <Text style={[styles.insightTitle, isDark && styles.textDark]} numberOfLines={1}>{insight.title}</Text>
                  <View style={[styles.insightCategoryBadge, { backgroundColor: insight.color + '10' }]}>
                    <Text style={[styles.insightCategoryText, { color: insight.color }]}>{insight.category}</Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.insightDescription, isDark && styles.textMuted]}>{insight.description}</Text>

              {insight.action && (
                <TouchableOpacity onPress={insight.action.onPress} style={[styles.insightActionBtn, { backgroundColor: insight.color + '10' }]}>
                  <Text style={[styles.insightActionText, { color: insight.color }]}>{insight.action.label}</Text>
                  <Ionicons name="arrow-forward" size={12} color={insight.color} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const SafeAvatar: React.FC<{
  avatar?: string | null;
  size?: number;
  fallbackEmoji?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackColor?: string;
}> = ({ avatar, size = 56, fallbackEmoji = '👤', fallbackIcon = 'person', fallbackColor = '#667eea' }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={[fallbackColor + '20', fallbackColor + '40']}
        style={[styles.avatarGradient, { width: size, height: size, borderRadius: size / 2.8 }]}
      >
        {hasImage ? (
          <View style={{ width: size, height: size, borderRadius: size / 2.8, overflow: 'hidden' }}>
            <Image
              source={{ uri: avatar! }}
              style={{ width: size, height: size }}
              resizeMode="cover"
              onError={(e) => console.log('Avatar image error:', e.nativeEvent.error)}
            />
          </View>
        ) : hasEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{avatar}</Text>
        ) : (
          <Ionicons name={fallbackIcon} size={size * 0.4} color={fallbackColor} />
        )}
      </LinearGradient>
    </View>
  );
};

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  showCloseButton?: boolean;
  primaryColor?: string;
}

const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  onClose,
  title,
  children,
  isDark,
  showCloseButton = true,
  primaryColor = '#667eea'
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Animated.View
          entering={FadeInUp.springify()}
          style={[styles.modalContent, isDark && styles.modalContentDark]}
        >
          <LinearGradient
            colors={isDark ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>{title}</Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
            )}
          </View>
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            {children}
          </Animated.ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// REFINED MEMBER CARD
// ═══════════════════════════════════════════════════════════════════════════

interface MemberCardProps {
  member: FamilyMember;
  isCurrentUser: boolean;
  isPrimaryParent: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  index: number;
  isDark: boolean;
  showFamilyChat: boolean;
  onFamilyChatPress?: () => void;
  themeColors: any;
  shouldReduceMotion: boolean;
}

const MemberCard: React.FC<MemberCardProps> = ({
  member,
  isCurrentUser,
  isPrimaryParent,
  onPress,
  onLongPress,
  index,
  isDark,
  showFamilyChat,
  onFamilyChatPress,
  themeColors,
  shouldReduceMotion
}) => {
  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97); };
  const handlePressOut = () => { scale.value = withSpring(1); };
  const isOnline = member.lastActive && new Date(member.lastActive).getTime() > Date.now() - 5 * 60 * 1000;

  return (
    <Animated.View
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 80).springify()}
      layout={shouldReduceMotion ? undefined : Layout.springify()}
      style={styles.memberCardWrapper}
    >
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={500}
          activeOpacity={0.9}
          style={styles.memberCardTouchable}
        >
          <View style={[styles.memberCard, isDark && styles.memberCardDark]}>
            <LinearGradient
              colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={roleConfig.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.roleStrip}
            />
            <View style={styles.memberCardContent}>
              <View style={styles.memberAvatarContainer}>
                <SafeAvatar
                  avatar={member.avatar}
                  size={52}
                  fallbackEmoji={isCurrentUser ? '👑' : (member.role === UserRole.PARENT_2 ? '👨‍👩‍👧‍👦' : '👤')}
                  fallbackIcon={member.role === UserRole.PARENT_1 ? 'shield' : member.role === UserRole.PARENT_2 ? 'heart' : 'person'}
                  fallbackColor={roleConfig.color}
                />
                {isCurrentUser && (
                  <View style={[styles.youBadge, { backgroundColor: themeColors.primary }]}>
                    <Text style={styles.youBadgeText}>YOU</Text>
                  </View>
                )}
                {isOnline && (
                  <View style={[styles.onlineIndicator, { borderColor: isDark ? '#1a1a2e' : '#fff' }]} />
                )}
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={[styles.memberName, isDark && styles.textDark]} numberOfLines={1}>
                    {member.fullName}
                  </Text>
                </View>
                <View style={styles.memberMetaRow}>
                  <LinearGradient
                    colors={roleConfig.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.roleBadgeSmall}
                  >
                    <Ionicons name={roleConfig.icon} size={9} color="#fff" />
                    <Text style={styles.roleBadgeSmallText}>{roleConfig.badge}</Text>
                  </LinearGradient>
                  <Text style={[styles.memberRelationship, isDark && styles.textMuted]}>
                    {member.relationship || 'Family Member'}
                  </Text>
                </View>
                {member.lastActive ? (
                  <Text style={[styles.memberLastActive, isDark && styles.textMuted]}>
                    {isOnline ? 'Active now' : `Active ${new Date(member.lastActive).toLocaleDateString()}`}
                  </Text>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Ionicons name="time-outline" size={11} color="#f59e0b" />
                    <Text style={styles.pendingText}>Pending Invitation</Text>
                  </View>
                )}
              </View>
              <View style={styles.memberActions}>
                {showFamilyChat && onFamilyChatPress && (
                  <TouchableOpacity
                    style={[styles.memberActionBtn, { backgroundColor: '#ec489915' }]}
                    onPress={(e) => { e.stopPropagation(); onFamilyChatPress(); }}
                  >
                    <Ionicons name="chatbubbles" size={16} color="#ec4899" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.memberActionBtn, { backgroundColor: roleConfig.color + '10' }]}
                  onPress={(e) => { e.stopPropagation(); onPress(); }}
                >
                  <Ionicons name="chevron-forward" size={18} color={roleConfig.color} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.permissionPills}>
              {roleConfig.permissions.slice(0, 3).map((perm, i) => (
                <View key={i} style={[styles.permissionPill, { backgroundColor: roleConfig.color + '08' }]}>
                  <Text style={[styles.permissionPillText, { color: roleConfig.color }]}>{perm}</Text>
                </View>
              ))}
              {roleConfig.permissions.length > 3 && (
                <View style={[styles.permissionPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.permissionPillText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    +{roleConfig.permissions.length - 3}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function FamilySharingScreen({ navigation }: FamilySharingScreenProps) {
  const sweetAlert = useSweetAlert();
  const {
    members,
    guardians,
    parent1,
    parent2,
    pendingInvites,
    loadFamily,
    inviteMember,
    removeMember,
    updateGuardianProfile,
    updateParent2Profile,
    resendInvite,
    cancelInvite,
    generateInviteCode,
    getActiveInviteCodes,
    revokeInviteCode,
  } = useFamily();

  const { profile } = useUser();
  const { currentBaby, babies, switchBaby } = useBaby();
  const { userProfile } = useAuth();

  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  const scrollY = useSharedValue(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showBabySelector, setShowBabySelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'activity' | 'analytics'>('members');

  // ── Invite Code State ──
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [inviteCodeRole, setInviteCodeRole] = useState<'parent2' | 'guardian' | 'viewer'>('guardian');
  const [inviteCodeRelationship, setInviteCodeRelationship] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.GUARDIAN);
  const [inviteRelationship, setInviteRelationship] = useState('');

  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    relationship: '',
    avatar: '',
    notificationsEnabled: true,
    customPermissions: [] as string[],
  });

  // ── Demo data for new features (replace with real data sources) ──
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([
    { id: '1', title: 'Track Feeding', icon: '🍼', target: 6, current: 4, unit: 'times today', color: '#f59e0b', participants: ['p1', 'p2'] },
    { id: '2', title: 'Log Sleep', icon: '😴', target: 3, current: 2, unit: 'naps today', color: '#8b5cf6', participants: ['p1'] },
    { id: '3', title: 'Growth Check', icon: '📏', target: 1, current: 0, unit: 'measurement', color: '#10b981', participants: ['p1', 'p2', 'g1'] },
    { id: '4', title: 'Family Photo', icon: '📸', target: 1, current: 1, unit: 'photo today', color: '#ec4899', participants: ['p2'] },
  ]);

  const smartSuggestions: SmartSuggestion[] = [
    { id: '1', type: 'invite', title: 'Invite Grandma to track milestones', description: 'She can help log daily activities and view growth charts.', icon: '👵', color: '#667eea', actionLabel: 'Send Invite', priority: 'medium' },
    { id: '2', type: 'activity', title: 'Schedule tummy time session', description: "Based on baby's age, tummy time is recommended 3x daily.", icon: '👶', color: '#10b981', actionLabel: 'Schedule', priority: 'high' },
    { id: '3', type: 'milestone', title: 'First words milestone approaching', description: 'Baby is showing signs of verbal development. Be ready to record!', icon: '🗣️', color: '#f59e0b', actionLabel: 'Learn More', priority: 'medium' },
    { id: '4', type: 'health', title: 'Vaccination due in 3 days', description: '6-month vaccination appointment should be scheduled soon.', icon: '💉', color: '#ef4444', actionLabel: 'Schedule', priority: 'high' },
  ];
  // Real timeline events — synced with Timeline screen via TrackerContext
  const { entries: trackerEntries } = useTracker();
  
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!trackerEntries || trackerEntries.length === 0) return [];
    return trackerEntries
      .filter((e: any) => e?.timestamp && e?.trackerId)
      .slice(0, 15)
      .map((e: any, i: number) => ({
        id: e.id || `event-${i}`,
        type: e.trackerId || 'note',
        title: e.title || `${e.trackerId?.charAt(0)?.toUpperCase() + e.trackerId?.slice(1) || 'Activity'} logged`,
        description: e.notes || e.details || '',
        timestamp: e.timestamp,
        actorName: e.loggedByName || 'You',
        actorRole: UserRole.PARENT_1,
        metadata: e.data || {},
      }))
      .sort((a: TimelineEvent, b: TimelineEvent) => b.timestamp - a.timestamp);
  }, [trackerEntries]);

  const chatPreviews: ChatPreview[] = [
    { id: '1', name: 'Family Group', lastMessage: "Sarah: Just fed the baby, he's sleeping now 💤", timestamp: Date.now() - 300000, unreadCount: 3, isGroup: true, participants: 4 },
    { id: '2', name: 'Mike', lastMessage: 'Can you pick up diapers on the way home?', timestamp: Date.now() - 1800000, unreadCount: 1, isGroup: false, participants: 2 },
    { id: '3', name: 'Grandma', lastMessage: 'The baby smiled at me today! 🥰', timestamp: Date.now() - 3600000, unreadCount: 0, isGroup: false, participants: 2 },
  ];

  const familyInsights: FamilyInsight[] = [
    { id: '1', category: 'tip', title: 'Optimal feeding window', description: 'Based on patterns, 7:00 AM and 6:30 PM are the best times for solid food introduction.', icon: '💡', color: '#f59e0b', action: { label: 'Set Reminder', onPress: () => {} } },
    { id: '2', category: 'health', title: 'Sleep quality improving', description: 'Average sleep duration increased by 45 minutes this week. Keep the current routine!', icon: '❤️', color: '#10b981' },
    { id: '3', category: 'social', title: 'Family engagement up 23%', description: 'More family members are actively logging activities. Great teamwork!', icon: '👥', color: '#667eea' },
    { id: '4', category: 'alert', title: 'Diaper stock running low', description: 'Based on tracking frequency, you may need diapers in 2 days.', icon: '⚠️', color: '#ef4444', action: { label: 'Add to List', onPress: () => {} } },
  ];

  const currentUserId = useMemo(() => {
    return userProfile?.id || userProfile?.uid || profile?.id || '';
  }, [userProfile, profile]);

  const isPrimaryParent = useMemo(() => {
    if (!currentUserId) return false;
    return parent1?.id === currentUserId || members.some(m =>
      m.role === UserRole.PARENT_1 && (m.id === currentUserId || m.userId === currentUserId)
    );
  }, [parent1, members, currentUserId]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isDark
      ? `rgba(10,10,10,${interpolate(scrollY.value, [0, 60, 120], [0, 0.7, 0.95], Extrapolation.CLAMP)})`
      : `rgba(248,250,252,${interpolate(scrollY.value, [0, 60, 120], [0, 0.7, 0.95], Extrapolation.CLAMP)})`,
    borderBottomColor: isDark
      ? `rgba(255,255,255,${interpolate(scrollY.value, [0, 60, 120], [0, 0.05, 0.1], Extrapolation.CLAMP)})`
      : `rgba(0,0,0,${interpolate(scrollY.value, [0, 60, 120], [0, 0.05, 0.1], Extrapolation.CLAMP)})`,
  }));

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFamily();
    setIsRefreshing(false);
  }, [loadFamily]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      sweetAlert.alert('Error', 'Please enter an email address', 'warning');
      return;
    }
    if (!inviteRelationship.trim()) {
      sweetAlert.alert('Error', 'Please specify the relationship', 'warning');
      return;
    }
    setIsLoading(true);
    triggerHaptic('medium');
    const success = await inviteMember(inviteEmail, inviteRole, inviteRelationship);
    if (success) {
      triggerHaptic('success');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRelationship('');
      sweetAlert.alert('Success', `Invitation sent to ${inviteEmail}`, 'success');
    } else {
      triggerHaptic('error');
    }
    setIsLoading(false);
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;
    if (!editForm.fullName.trim()) {
      sweetAlert.alert('Error', 'Name is required', 'warning');
      return;
    }
    setIsLoading(true);
    triggerHaptic('medium');
    let success = false;
    if (selectedMember.role === UserRole.PARENT_2) {
      success = await updateParent2Profile({
        fullName: editForm.fullName,
        email: editForm.email,
        phoneNumber: editForm.phoneNumber,
        avatar: editForm.avatar,
      });
    } else {
      success = await updateGuardianProfile(selectedMember.id, {
        fullName: editForm.fullName,
        email: editForm.email,
        phoneNumber: editForm.phoneNumber,
        relationship: editForm.relationship,
        avatar: editForm.avatar,
        notificationsEnabled: editForm.notificationsEnabled,
      });
    }
    if (success) {
      triggerHaptic('success');
      setShowEditModal(false);
      sweetAlert.alert('Success', 'Member updated successfully', 'success');
      loadFamily();
    } else {
      triggerHaptic('error');
      sweetAlert.alert('Error', 'Failed to update member', 'warning');
    }
    setIsLoading(false);
  };

  const handleRemoveMember = () => {
    if (!selectedMember) return;
    if (selectedMember.role === UserRole.PARENT_1) {
      sweetAlert.alert('Cannot Remove', 'Primary Parent cannot be removed', 'warning');
      return;
    }
    if (selectedMember.id === currentUserId) {
      sweetAlert.alert('Cannot Remove', 'You cannot remove yourself', 'warning');
      return;
    }
    sweetAlert.confirm(
      'Remove Family Member',
      `Are you sure you want to remove ${selectedMember.fullName}?`,
      () => {
        triggerHaptic('success');
        removeMember(selectedMember.id);
        setShowMemberModal(false);
      },
      () => {},
      'Remove',
      'Cancel',
      true
    );
  };

  const handleChangeRole = async (newRole: UserRole) => {
    if (!selectedMember || !isPrimaryParent) return;
    if (selectedMember.role === UserRole.PARENT_1) {
      sweetAlert.alert('Cannot Change', 'Primary Parent role cannot be changed', 'warning');
      return;
    }
    const currentCount = members.filter(m => m.role === newRole).length;
    const maxAllowed = ROLE_CONFIG[newRole].maxCount;
    if (currentCount >= maxAllowed && newRole !== selectedMember.role) {
      sweetAlert.alert('Role Limit Reached', `You can only have ${maxAllowed} ${ROLE_CONFIG[newRole].label}(s)`, 'warning');
      return;
    }
    sweetAlert.confirm(
      'Change Role',
      `Change ${selectedMember.fullName} to ${ROLE_CONFIG[newRole].label}?`,
      () => {
        triggerHaptic('success');
        setShowRoleModal(false);
      },
      () => {},
      'Change',
      'Cancel',
      false
    );
  };

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      sweetAlert.alert('Permission Required', 'Please allow access to your photo library', 'warning');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      try {
        // Copy from the temporary picker cache into permanent app storage
        const dirInfo = await FileSystem.getInfoAsync(FAMILY_IMAGES_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(FAMILY_IMAGES_DIR, { intermediates: true });
        }
        const permanentUri = `${FAMILY_IMAGES_DIR}${selectedMember?.id || 'member'}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setEditForm(prev => ({ ...prev, avatar: permanentUri }));
        triggerHaptic('light');
      } catch (error) {
        console.error('Failed to save member photo:', error);
        sweetAlert.alert('Error', 'Failed to save photo. Please try again.', 'warning');
      }
    }
  };

  const handleContact = async (type: 'call' | 'email' | 'sms') => {
    if (!selectedMember) return;
    let url = '';
    switch (type) {
      case 'call':
        if (!selectedMember.phoneNumber) { sweetAlert.alert('No Phone', 'No phone number available', 'warning'); return; }
        url = `tel:${selectedMember.phoneNumber.replace(/\s/g, '')}`;
        break;
      case 'email':
        if (!selectedMember.email) { sweetAlert.alert('No Email', 'No email address available', 'warning'); return; }
        url = `mailto:${selectedMember.email}`;
        break;
      case 'sms':
        if (!selectedMember.phoneNumber) { sweetAlert.alert('No Phone', 'No phone number available', 'warning'); return; }
        url = `sms:${selectedMember.phoneNumber.replace(/\s/g, '')}`;
        break;
    }
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) { triggerHaptic('medium'); await Linking.openURL(url); }
  };

  const openMemberDetails = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditForm({
      fullName: member.fullName || '',
      email: member.email || '',
      phoneNumber: member.phoneNumber || '',
      relationship: member.relationship || '',
      avatar: member.avatar || '',
      notificationsEnabled: member.notificationsEnabled ?? true,
      customPermissions: member.permissions ? Object.keys(member.permissions).filter(k => member.permissions[k as keyof Permission]) : [],
    });
    setShowMemberModal(true);
    triggerHaptic('light');
  };

  const openEditModal = () => {
    setShowMemberModal(false);
    setShowEditModal(true);
  };

  const handleFamilyChatPress = (member: FamilyMember) => {
    if (!currentBaby) return;
    navigation.navigate('FamilyChat' as never, {
      memberId: member.id,
      memberName: member.fullName,
      memberAvatar: member.avatar,
      memberRole: member.role,
      babyId: currentBaby.id,
      babyName: currentBaby.name,
    });
  };

  const handleToggleGoal = (goalId: string) => {
    setDailyGoals(prev => prev.map(g => 
      g.id === goalId ? { ...g, current: Math.min(g.current + 1, g.target) } : g
    ));
    triggerHaptic('light');
  };

  // ── Invite Code Handlers ──
  const handleGenerateCode = useCallback(async () => {
    if (!inviteCodeRelationship.trim()) {
      sweetAlert.alert('Missing Info', 'Please specify the relationship (e.g., Grandma, Uncle)', 'warning');
      return;
    }
    setIsGeneratingCode(true);
    triggerHaptic('medium');
    try {
      const result = await generateInviteCode(inviteCodeRole, inviteCodeRelationship.trim());
      if (result.success) {
        setGeneratedCode(result.code);
        triggerHaptic('success');
        sweetAlert.alert('Code Generated!', `Share this code: ${result.code}`, 'success');
        // Refresh active codes
        const codes = await getActiveInviteCodes();
        setActiveCodes(codes);
      } else {
        sweetAlert.alert('Error', result.message, 'warning');
      }
    } catch (error) {
      console.error('Generate code error:', error);
      sweetAlert.alert('Error', 'Failed to generate invite code', 'warning');
    } finally {
      setIsGeneratingCode(false);
    }
  }, [inviteCodeRole, inviteCodeRelationship, generateInviteCode, getActiveInviteCodes, triggerHaptic, sweetAlert]);

  const handleLoadActiveCodes = useCallback(async () => {
    setIsLoadingCodes(true);
    try {
      const codes = await getActiveInviteCodes();
      setActiveCodes(codes);
    } catch (error) {
      console.error('Load codes error:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  }, [getActiveInviteCodes]);

  const handleRevokeCode = useCallback(async (code: string) => {
    sweetAlert.confirm(
      'Revoke Invite Code',
      `Are you sure you want to revoke code ${code}?`,
      async () => {
        const success = await revokeInviteCode(code);
        if (success) {
          triggerHaptic('success');
          sweetAlert.alert('Revoked', 'Invite code has been deactivated', 'success');
          handleLoadActiveCodes();
        } else {
          sweetAlert.alert('Error', 'Failed to revoke code', 'warning');
        }
      },
      () => {},
      'Revoke',
      'Cancel',
      true
    );
  }, [revokeInviteCode, handleLoadActiveCodes, triggerHaptic, sweetAlert]);

  const handleShareCode = useCallback(async (code: string) => {
    try {
      await Share.share({
        message: `Join our family on LittleLoom! Use invite code: ${code}\n\nDownload the app and enter this code on the sign-up screen.`,
        title: 'LittleLoom Family Invite',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  const openInviteCodeModal = useCallback(() => {
    setGeneratedCode('');
    setInviteCodeRelationship('');
    setInviteCodeRole('guardian');
    setShowInviteCodeModal(true);
    handleLoadActiveCodes();
  }, [handleLoadActiveCodes]);

  const handleSuggestionAction = (suggestion: SmartSuggestion) => {
    triggerHaptic('light');
    switch (suggestion.type) {
      case 'invite': setShowInviteModal(true); break;
      case 'activity': navigation.navigate('AddEntry', { trackerId: 'tummy_time' } as never); break;
      case 'milestone': navigation.navigate('MilestoneDetail' as never); break;
      case 'health': navigation.navigate('VaccinationSchedule' as never); break;
    }
  };

  // ── RENDER HEADER ──
  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { paddingTop: insets.top }, headerAnimatedStyle]}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, isDark && styles.headerBtnDark]}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>Family</Text>
          {currentBaby && (
            <TouchableOpacity
              style={[styles.babySelectorChip, { backgroundColor: themeColors.colors[0] }]}
              onPress={() => setShowBabySelector(true)}
            >
              <Text style={[styles.babySelectorText, { color: themeColors.primary }]}>
                {currentBaby.name} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.95)', borderColor: themeColors.primary + '40', borderWidth: 1 }]}
            onPress={openInviteCodeModal}
          >
            <Ionicons name="key-outline" size={18} color={themeColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnAccent, { backgroundColor: themeColors.primary }]}
            onPress={() => setShowInviteModal(true)}
          >
            <Ionicons name="person-add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modern Tab Bar */}
      <View style={[styles.modernTabBar, isDark && styles.modernTabBarDark]}>
        {(['members', 'activity', 'analytics'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.modernTab, activeTab === tab && [styles.modernTabActive, { backgroundColor: themeColors.colors[0] }]]}
            onPress={() => { setActiveTab(tab); triggerHaptic('light'); }}
          >
            <Ionicons 
              name={tab === 'members' ? 'people' : tab === 'activity' ? 'pulse' : 'stats-chart'} 
              size={16} 
              color={activeTab === tab ? themeColors.primary : isDark ? '#94a3b8' : '#64748b'} 
            />
            <Text style={[
              styles.modernTabText,
              activeTab === tab && [styles.modernTabTextActive, { color: themeColors.primary }]
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  // ── RENDER TAB CONTENT ──
  const renderTabContent = () => {
    switch (activeTab) {
      case 'members':
        return (
          <View style={styles.tabContent}>
            {/* NEW FEATURE 1: Family Health Score */}
            <FamilyHealthScore 
              members={members} 
              isDark={isDark} 
              themeColors={themeColors} 
              shouldReduceMotion={shouldReduceMotion} 
            />

            {/* NEW FEATURE 2: Daily Family Goals */}
            <DailyFamilyGoals
              goals={dailyGoals}
              isDark={isDark}
              themeColors={themeColors}
              shouldReduceMotion={shouldReduceMotion}
              onToggleGoal={handleToggleGoal}
            />

            {/* NEW FEATURE 3: Smart Suggestions */}
            <SmartSuggestions
              suggestions={smartSuggestions}
              isDark={isDark}
              themeColors={themeColors}
              shouldReduceMotion={shouldReduceMotion}
              onAction={handleSuggestionAction}
            />

            {/* NEW FEATURE 6: Family Insights */}
            <FamilyInsights
              insights={familyInsights}
              isDark={isDark}
              themeColors={themeColors}
              shouldReduceMotion={shouldReduceMotion}
            />

            {/* Member Sections */}
            {renderMemberSection('Primary Parent', members.filter(m => m.role === UserRole.PARENT_1))}
            {renderMemberSection('Co-Parent', members.filter(m => m.role === UserRole.PARENT_2), 'No co-parent added yet')}
            {renderMemberSection('Guardians', members.filter(m => m.role === UserRole.GUARDIAN), 'No guardians added')}
            {renderMemberSection('Viewers', members.filter(m => m.role === UserRole.VIEWER), 'No viewers added')}

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Pending Invites</Text>
                    <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{pendingInvites.length} awaiting response</Text>
                  </View>
                </View>

                {pendingInvites.map((invite, index) => (
                  <Animated.View
                    key={invite.id}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 100).springify()}
                    layout={shouldReduceMotion ? undefined : Layout.springify()}
                    style={[styles.pendingCard, isDark && styles.pendingCardDark]}
                  >
                    <LinearGradient
                      colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.pendingIcon}>
                      <Ionicons name="mail-outline" size={22} color="#f59e0b" />
                    </View>
                    <View style={styles.pendingInfo}>
                      <Text style={[styles.pendingEmail, isDark && styles.textDark]}>{invite.email}</Text>
                      <Text style={[styles.pendingRole, isDark && styles.textMuted]}>
                        {ROLE_LABELS[invite.role]} • {invite.relationship}
                      </Text>
                      <Text style={[styles.pendingSent, isDark && styles.textMuted]}>
                        Sent {new Date(invite.addedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.pendingActions}>
                      <TouchableOpacity
                        style={[styles.pendingAction, { backgroundColor: themeColors.primary + '10' }]}
                        onPress={() => resendInvite(invite.id)}
                      >
                        <Ionicons name="refresh" size={18} color={themeColors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pendingAction, { backgroundColor: '#ef444410' }]}
                        onPress={() => cancelInvite(invite.id)}
                      >
                        <Ionicons name="close" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Role Limits */}
            <View style={styles.roleLimitsSection}>
              <Text style={[styles.roleLimitsTitle, isDark && styles.textMuted]}>Role Limits</Text>
              <View style={styles.roleLimitsGrid}>
                {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                  const currentCount = members.filter(m => m.role === role).length;
                  const isAtLimit = currentCount >= config.maxCount;

                  return (
                    <View
                      key={role}
                      style={[
                        styles.roleLimitItem,
                        isDark && styles.roleLimitItemDark,
                        isAtLimit && styles.roleLimitItemFull
                      ]}
                    >
                      <LinearGradient
                        colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                      <Text style={[
                        styles.roleLimitValue,
                        { color: isAtLimit ? '#ef4444' : config.color }
                      ]}>
                        {currentCount}/{config.maxCount}
                      </Text>
                      <Text style={[styles.roleLimitLabel, isDark && styles.textMuted]}>{config.badge}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );

      case 'activity':
        return (
          <View style={styles.tabContent}>
            {/* NEW FEATURE 4: Family Activity Timeline */}
            <FamilyActivityTimeline
              events={timelineEvents}
              isDark={isDark}
              shouldReduceMotion={shouldReduceMotion}
            />

            {/* NEW FEATURE 5: Family Chat Preview */}
            <FamilyChatPreview
              chats={chatPreviews}
              isDark={isDark}
              themeColors={themeColors}
              shouldReduceMotion={shouldReduceMotion}
              onChatPress={(chat) => navigation.navigate('FamilyChat', { chatId: chat.id } as never)}
              onSeeAll={() => navigation.navigate('FamilyChatList' as never)}
            />
          </View>
        );

      case 'analytics':
        return (
          <View style={styles.tabContent}>
            <View style={styles.analyticsSection}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Role Distribution</Text>
                  <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>Family composition</Text>
                </View>
              </View>
              <View style={styles.distributionGrid}>
                {Object.entries(ROLE_CONFIG).map(([role, config], idx) => {
                  const count = members.filter(m => m.role === role).length;
                  return (
                    <Animated.View
                      key={role}
                      entering={shouldReduceMotion ? undefined : FadeInUp.delay(idx * 80).springify()}
                      style={[styles.distributionItem, isDark && styles.distributionItemDark]}
                    >
                      <LinearGradient
                        colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                      <Text style={[styles.distributionValue, { color: config.color }]}>{count}</Text>
                      <Text style={[styles.distributionLabel, isDark && styles.textMuted]}>{config.badge}</Text>
                    </Animated.View>
                  );
                })}
              </View>
            </View>

            <View style={styles.analyticsSection}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Member Activity</Text>
                  <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>Last 7 days</Text>
                </View>
              </View>
              {members.map((member, index) => (
                <Animated.View
                  key={member.id}
                  entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 50).springify()}
                  style={[styles.analyticsMemberRow, isDark && styles.analyticsMemberRowDark]}
                >
                  <LinearGradient
                    colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.analyticsMemberInfo}>
                    <Text style={[styles.analyticsMemberName, isDark && styles.textDark]}>
                      {member.fullName}
                    </Text>
                    <Text style={[styles.analyticsMemberRole, isDark && styles.textMuted]}>
                      {ROLE_LABELS[member.role]}
                    </Text>
                  </View>
                  <View style={styles.analyticsMemberStats}>
                    <View style={[styles.activityDot, { backgroundColor: member.lastActive && new Date(member.lastActive).getTime() > Date.now() - 24 * 60 * 60 * 1000 ? '#10b981' : '#94a3b8' }]} />
                    <Text style={[styles.analyticsStat, { color: ROLE_CONFIG[member.role].color }]}>
                      {member.lastActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
        );
    }
  };

  const renderMemberSection = (title: string, data: FamilyMember[], emptyText?: string) => (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{data.length} {data.length === 1 ? 'member' : 'members'}</Text>
        </View>
      </View>

      {data.length === 0 && emptyText ? (
        <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
          <Ionicons name="people-outline" size={32} color={isDark ? '#555' : '#ccc'} />
          <Text style={[styles.emptyStateText, isDark && styles.textMuted]}>{emptyText}</Text>
          {isPrimaryParent && title !== 'Primary Parent' && (
            <TouchableOpacity
              style={[styles.addFirstMemberBtn, { backgroundColor: themeColors.primary }]}
              onPress={() => setShowInviteModal(true)}
            >
              <Text style={styles.addFirstMemberText}>Add First Member</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        data.map((member, index) => (
          <MemberCard
            key={member.id}
            member={member}
            isCurrentUser={member.id === currentUserId || member.userId === currentUserId}
            isPrimaryParent={isPrimaryParent}
            onPress={() => openMemberDetails(member)}
            onLongPress={isPrimaryParent && member.role !== UserRole.PARENT_1 ? () => {
              setSelectedMember(member);
              sweetAlert.confirm(
                'Quick Actions',
                `What would you like to do with ${member.fullName}?`,
                () => {},
                () => {},
                'Cancel',
                'Edit',
                true
              );
            } : undefined}
            index={index}
            isDark={isDark}
            showFamilyChat={!!currentBaby && member.id !== currentUserId}
            onFamilyChatPress={() => handleFamilyChatPress(member)}
            themeColors={themeColors}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))
      )}
    </View>
  );

  if (isLoading && members.length === 0) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.containerDark]}>
        <StatusBar barStyle={isDark ? 'light' : 'dark'} />
        <LinearGradient
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ marginTop: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
          Loading family...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header with Blur */}
      {renderHeader()}

      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 140 + insets.top, paddingBottom: insets.bottom + 30 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        }
      >
        {renderTabContent()}
      </AnimatedScrollView>

      {/* Member Detail Modal */}
      <ActionModal
        visible={showMemberModal}
        onClose={() => {
          setShowMemberModal(false);
          setSelectedMember(null);
        }}
        title={selectedMember?.fullName || 'Member Details'}
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        {selectedMember && (
          <View style={styles.memberDetailContent}>
            <View style={styles.memberDetailHeader}>
              <View style={styles.memberDetailAvatar}>
                <SafeAvatar
                  avatar={selectedMember.avatar}
                  size={100}
                  fallbackEmoji={selectedMember.role === UserRole.PARENT_1 ? '👑' : '👤'}
                  fallbackIcon={selectedMember.role === UserRole.PARENT_1 ? 'shield' : 'person'}
                  fallbackColor={ROLE_CONFIG[selectedMember.role].color}
                />
              </View>
              <LinearGradient
                colors={ROLE_CONFIG[selectedMember.role].gradient}
                style={styles.memberDetailRoleBadge}
              >
                <Ionicons name={ROLE_CONFIG[selectedMember.role].icon} size={14} color="#fff" />
                <Text style={styles.memberDetailRoleText}>{ROLE_CONFIG[selectedMember.role].label}</Text>
              </LinearGradient>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, isDark && styles.textDark]}>Contact Information</Text>

              {selectedMember.email && (
                <TouchableOpacity
                  style={[styles.detailRow, isDark && styles.detailRowDark]}
                  onPress={() => handleContact('email')}
                >
                  <Ionicons name="mail" size={20} color={themeColors.primary} />
                  <Text style={[styles.detailText, isDark && styles.textDark]}>{selectedMember.email}</Text>
                  <Ionicons name="open-outline" size={16} color={isDark ? '#666' : '#999'} />
                </TouchableOpacity>
              )}

              {selectedMember.phoneNumber && (
                <TouchableOpacity
                  style={[styles.detailRow, isDark && styles.detailRowDark]}
                  onPress={() => handleContact('call')}
                >
                  <Ionicons name="call" size={20} color="#10b981" />
                  <Text style={[styles.detailText, isDark && styles.textDark]}>{selectedMember.phoneNumber}</Text>
                  <Ionicons name="open-outline" size={16} color={isDark ? '#666' : '#999'} />
                </TouchableOpacity>
              )}

              <View style={[styles.detailRow, isDark && styles.detailRowDark]}>
                <Ionicons name="people" size={20} color="#f59e0b" />
                <Text style={[styles.detailText, isDark && styles.textDark]}>
                  {selectedMember.relationship || 'Family Member'}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, isDark && styles.textDark]}>Permissions</Text>
              <View style={styles.permissionsList}>
                {ROLE_CONFIG[selectedMember.role].permissions.map((perm, i) => (
                  <View key={i} style={[styles.permissionItem, isDark && styles.permissionItemDark]}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={[styles.permissionText, isDark && styles.textDark]}>{perm}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.detailActions}>
              <TouchableOpacity
                style={styles.detailActionBtn}
                onPress={() => {
                  setShowMemberModal(false);
                  handleFamilyChatPress(selectedMember);
                }}
              >
                <LinearGradient colors={ROLE_CONFIG[selectedMember.role].gradient} style={styles.detailActionGradient}>
                  <Ionicons name="chatbubble" size={20} color="#fff" />
                  <Text style={styles.detailActionText}>Family Chat</Text>
                </LinearGradient>
              </TouchableOpacity>

              {isPrimaryParent && selectedMember.role !== UserRole.PARENT_1 && (
                <>
                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionSecondary, isDark && styles.detailActionSecondaryDark]}
                    onPress={openEditModal}
                  >
                    <Ionicons name="create" size={20} color={themeColors.primary} />
                    <Text style={[styles.detailActionSecondaryText, { color: themeColors.primary }]}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionSecondary, isDark && styles.detailActionSecondaryDark]}
                    onPress={() => {
                      setShowMemberModal(false);
                      setShowRoleModal(true);
                    }}
                  >
                    <Ionicons name="shield" size={20} color="#f59e0b" />
                    <Text style={[styles.detailActionSecondaryText, { color: '#f59e0b' }]}>Change Role</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionDanger]}
                    onPress={handleRemoveMember}
                  >
                    <Ionicons name="trash" size={20} color="#ff4757" />
                    <Text style={styles.detailActionDangerText}>Remove Member</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </ActionModal>

      {/* Edit Member Modal */}
      <ActionModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Member"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.editForm}>
          <TouchableOpacity style={styles.editAvatarContainer} onPress={handleImagePick}>
            {editForm.avatar ? (
              <SafeAvatar
                avatar={editForm.avatar}
                size={100}
                fallbackEmoji="👤"
                fallbackIcon="camera"
                fallbackColor={themeColors.primary}
              />
            ) : (
              <View style={[styles.editAvatarPlaceholder, { backgroundColor: ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color + '20' }]}>
                <Ionicons name="camera" size={32} color={ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color} />
              </View>
            )}
            <View style={[styles.editAvatarOverlay, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Full Name</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.fullName}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, fullName: text }))}
              placeholder="Enter full name"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Email</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.email}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
              placeholder="Enter email address"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Phone Number</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.phoneNumber}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, phoneNumber: text }))}
              placeholder="Enter phone number"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Relationship</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.relationship}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, relationship: text }))}
              placeholder="e.g., Grandma, Uncle, Nanny"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          <View style={[styles.toggleRow, isDark && styles.toggleRowDark]}>
            <View style={styles.toggleInfo}>
              <Ionicons
                name={editForm.notificationsEnabled ? "notifications" : "notifications-off"}
                size={22}
                color={editForm.notificationsEnabled ? themeColors.primary : isDark ? "#555" : "#999"}
              />
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, isDark && styles.textDark]}>Notifications</Text>
                <Text style={[styles.toggleDescription, isDark && styles.textMuted]}>
                  Receive alerts about family activities
                </Text>
              </View>
            </View>
            <Switch
              value={editForm.notificationsEnabled}
              onValueChange={(val) => setEditForm(prev => ({ ...prev, notificationsEnabled: val }))}
              trackColor={{ false: isDark ? '#333' : '#ddd', true: themeColors.primary }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleUpdateMember}
            disabled={isLoading}
          >
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.saveButtonGradient}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Invite Member Modal */}
      <ActionModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Family Member"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.inviteForm}>
          <Text style={[styles.inviteDescription, isDark && styles.textMuted]}>
            Invite someone to join your family and help track {currentBaby?.name || 'your baby'}.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Email Address</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Enter email address"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Relationship to Baby</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={inviteRelationship}
              onChangeText={setInviteRelationship}
              placeholder="e.g., Grandma, Uncle, Babysitter"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          <Text style={[styles.formLabel, isDark && styles.textDark, { marginTop: 8 }]}>Select Role</Text>

          <View style={styles.roleSelection}>
            {[UserRole.PARENT_2, UserRole.GUARDIAN, UserRole.VIEWER].map((role) => {
              const config = ROLE_CONFIG[role];
              const isSelected = inviteRole === role;
              const currentCount = members.filter(m => m.role === role).length;
              const isDisabled = currentCount >= config.maxCount;

              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    isSelected && { borderColor: config.color, backgroundColor: config.color + '10' },
                    isDisabled && styles.roleOptionDisabled,
                    isDark && styles.roleOptionDark
                  ]}
                  onPress={() => !isDisabled && setInviteRole(role)}
                  disabled={isDisabled}
                >
                  <LinearGradient colors={config.gradient} style={styles.roleOptionIcon}>
                    <Ionicons name={config.icon} size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.roleOptionInfo}>
                    <Text style={[styles.roleOptionTitle, isDark && styles.textDark, isDisabled && styles.textDisabled]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.roleOptionDesc, isDark && styles.textMuted, isDisabled && styles.textDisabled]}>
                      {config.description}
                    </Text>
                    <Text style={[styles.roleOptionLimit, { color: isDisabled ? '#ef4444' : config.color }]}>
                      {currentCount}/{config.maxCount} used
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.inviteButton, !inviteEmail.trim() && styles.inviteButtonDisabled]}
            onPress={handleInvite}
            disabled={isLoading || !inviteEmail.trim()}
          >
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.inviteButtonGradient}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.inviteButtonText}>Send Invitation</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Change Role Modal */}
      <ActionModal
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Change Member Role"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.roleChangeContent}>
          <Text style={[styles.roleChangeDescription, isDark && styles.textMuted]}>
            Changing {selectedMember?.fullName}'s role will update their permissions immediately.
          </Text>

          {Object.entries(ROLE_CONFIG)
            .filter(([role]) => role !== UserRole.PARENT_1)
            .map(([role, config]) => {
              const isCurrent = selectedMember?.role === role;
              const currentCount = members.filter(m => m.role === role).length;
              const isAtLimit = !isCurrent && currentCount >= config.maxCount;

              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChangeOption,
                    isCurrent && { borderColor: config.color, backgroundColor: config.color + '15' },
                    isAtLimit && styles.roleChangeOptionDisabled,
                    isDark && styles.roleChangeOptionDark
                  ]}
                  onPress={() => handleChangeRole(role as UserRole)}
                  disabled={isCurrent || isAtLimit}
                >
                  <LinearGradient colors={config.gradient} style={styles.roleChangeIcon}>
                    <Ionicons name={config.icon} size={24} color="#fff" />
                  </LinearGradient>
                  <View style={styles.roleChangeInfo}>
                    <Text style={[styles.roleChangeTitle, isDark && styles.textDark]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.roleChangeDesc, isDark && styles.textMuted]}>
                      {config.description}
                    </Text>
                    <View style={styles.roleChangePerms}>
                      {config.permissions.slice(0, 2).map((perm, i) => (
                        <Text key={i} style={[styles.roleChangePerm, { color: config.color }]}>• {perm}</Text>
                      ))}
                    </View>
                  </View>
                  {isCurrent && <Ionicons name="checkmark" size={24} color={config.color} />}
                </TouchableOpacity>
              );
            })}
        </View>
      </ActionModal>

      {/* Invite Code Modal */}
      <ActionModal
        visible={showInviteCodeModal}
        onClose={() => setShowInviteCodeModal(false)}
        title="Invite Code"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.inviteForm}>
          <Text style={[styles.inviteDescription, isDark && styles.textMuted]}>
            Generate a shareable 6-character code for family members to join instantly.
          </Text>

          {/* Role Selection */}
          <Text style={[styles.formLabel, isDark && styles.textDark, { marginTop: 8 }]}>Select Role</Text>
          <View style={styles.roleSelection}>
            {(['parent2', 'guardian', 'viewer'] as const).map((role) => {
              const config = ROLE_CONFIG[role === 'parent2' ? UserRole.PARENT_2 : role === 'guardian' ? UserRole.GUARDIAN : UserRole.VIEWER];
              const isSelected = inviteCodeRole === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    isSelected && { borderColor: config.color, backgroundColor: config.color + '10' },
                    isDark && styles.roleOptionDark
                  ]}
                  onPress={() => setInviteCodeRole(role)}
                >
                  <LinearGradient colors={config.gradient} style={styles.roleOptionIcon}>
                    <Ionicons name={config.icon} size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.roleOptionInfo}>
                    <Text style={[styles.roleOptionTitle, isDark && styles.textDark]}>{config.label}</Text>
                    <Text style={[styles.roleOptionDesc, isDark && styles.textMuted]}>{config.description}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Relationship Input */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Relationship to Baby</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={inviteCodeRelationship}
              onChangeText={setInviteCodeRelationship}
              placeholder="e.g., Grandma, Uncle, Babysitter"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          {/* Generated Code Display */}
          {generatedCode ? (
            <Animated.View entering={FadeInUp.springify()} style={[styles.codeDisplayCard, { backgroundColor: themeColors.primary + '10', borderColor: themeColors.primary + '30' }]}>
              <View style={styles.codeDisplayHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <Text style={[styles.codeDisplayTitle, { color: '#22c55e' }]}>Code Generated!</Text>
              </View>
              <View style={[styles.codeBox, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
                <Text style={[styles.codeText, { color: themeColors.primary, letterSpacing: 8 }]}>{generatedCode}</Text>
              </View>
              <Text style={[styles.codeDisplaySubtitle, isDark && styles.textMuted]}>
                Share this code with your family member. They can enter it on the sign-up screen.
              </Text>
              <TouchableOpacity
                style={[styles.shareCodeBtn, { backgroundColor: themeColors.primary }]}
                onPress={() => handleShareCode(generatedCode)}
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={styles.shareCodeBtnText}>Share Code</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity
              style={[styles.inviteButton, (!inviteCodeRelationship.trim() || isGeneratingCode) && styles.inviteButtonDisabled]}
              onPress={handleGenerateCode}
              disabled={!inviteCodeRelationship.trim() || isGeneratingCode}
            >
              <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.inviteButtonGradient}>
                {isGeneratingCode ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="key" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.inviteButtonText}>Generate Invite Code</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Active Codes List */}
          {activeCodes.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={[styles.formLabel, isDark && styles.textDark]}>Active Codes</Text>
              {activeCodes.map((code) => (
                <View key={code.code} style={[styles.activeCodeRow, isDark && styles.activeCodeRowDark]}>
                  <View style={styles.activeCodeLeft}>
                    <Text style={[styles.activeCodeText, { color: themeColors.primary, letterSpacing: 4 }]}>{code.code}</Text>
                    <View style={styles.activeCodeMeta}>
                      <Text style={[styles.activeCodeRole, isDark && styles.textMuted]}>
                        {code.role === 'parent2' ? 'Co-Parent' : code.role === 'guardian' ? 'Guardian' : 'Viewer'}
                      </Text>
                      <Text style={[styles.activeCodeExpiry, isDark && styles.textMuted]}>
                        Expires {new Date(code.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.revokeCodeBtn, { backgroundColor: '#ef444415' }]}
                    onPress={() => handleRevokeCode(code.code)}
                  >
                    <Ionicons name="close" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {isLoadingCodes && (
            <View style={{ alignItems: 'center', padding: 20 }}>
              <ActivityIndicator color={themeColors.primary} />
            </View>
          )}
        </View>
      </ActionModal>

      {/* Baby Selector Modal */}
      <ActionModal
        visible={showBabySelector}
        onClose={() => setShowBabySelector(false)}
        title="Select Baby"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.babySelectorContent}>
          {babies.map((baby) => (
            <TouchableOpacity
              key={baby.id}
              style={[
                styles.babyOption,
                currentBaby?.id === baby.id && [styles.babyOptionActive, { borderColor: themeColors.primary, backgroundColor: themeColors.colors[0] }],
                isDark && styles.babyOptionDark
              ]}
              onPress={() => {
                switchBaby(baby.id);
                setShowBabySelector(false);
              }}
            >
              <View style={[styles.babyOptionIcon, { backgroundColor: currentBaby?.id === baby.id ? themeColors.primary : isDark ? '#333' : '#e2e8f0' }]}>
                <Text style={styles.babyOptionEmoji}>👶</Text>
              </View>
              <View style={styles.babyOptionInfo}>
                <Text style={[styles.babyOptionName, isDark && styles.textDark]}>{baby.name}</Text>
                <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                  {new Date(baby.dateOfBirth).toLocaleDateString()} • {baby.gender || 'Baby'}
                </Text>
              </View>
              {currentBaby?.id === baby.id && <Ionicons name="checkmark" size={24} color={themeColors.primary} />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.addBabyOption, isDark && styles.addBabyOptionDark]}
            onPress={() => {
              setShowBabySelector(false);
              navigation.navigate('CreateBabyProfile' as never);
            }}
          >
            <View style={[styles.addBabyIcon, { backgroundColor: themeColors.colors[0] }]}>
              <Ionicons name="add" size={24} color={themeColors.primary} />
            </View>
            <Text style={[styles.addBabyText, isDark && styles.textDark, { color: themeColors.primary }]}>Add New Baby</Text>
          </TouchableOpacity>
        </View>
      </ActionModal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — Completely Redesigned
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  containerDark: {
    backgroundColor: '#0a0a0a'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  textDark: {
    color: '#ffffff'
  },
  textMuted: {
    color: '#94a3b8'
  },
  textDisabled: {
    color: '#64748b',
    opacity: 0.5
  },
  scrollContent: {
    paddingHorizontal: DESIGN.spacing.lg,
  },

  // ── Header ──
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN.spacing.lg,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    /* no shadow */
  },
  headerBtnDark: {
    backgroundColor: 'rgba(40,40,50,0.95)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerBtnAccent: {
    backgroundColor: '#667eea',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  babySelectorChip: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  babySelectorText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Modern Tab Bar ──
  modernTabBar: {
    flexDirection: 'row',
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.md,
    padding: 4,
    borderRadius: DESIGN.radius.lg,
    backgroundColor: 'rgba(0,0,0,0.04)',
    gap: 4,
  },
  modernTabBarDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modernTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modernTabActive: {
    /* no shadow */
  },
  modernTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modernTabTextActive: {
    fontWeight: '700',
  },

  // ── Section Headers ──
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 4,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  sectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Tab Content ──
  tabContent: {
    paddingTop: 8,
  },
  section: {
    marginBottom: 28,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW FEATURE 1: Family Health Score
  // ═══════════════════════════════════════════════════════════════════════════
  healthScoreCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    marginBottom: DESIGN.spacing.xl,
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  healthScoreCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  healthScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  healthScoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  healthScoreRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthScoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  healthScoreMax: {
    fontSize: 12,
    fontWeight: '600',
  },
  healthScoreLabels: {
    gap: 2,
  },
  healthScoreLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  healthScoreSub: {
    fontSize: 13,
    fontWeight: '600',
  },
  healthScoreRight: {
    flex: 1,
    gap: 8,
  },
  healthScoreMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthScoreMiniBarWrap: {
    flex: 1,
  },
  healthScoreMiniBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  healthScoreMiniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  healthScoreMiniValue: {
    fontSize: 12,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
  healthScoreMiniLabel: {
    fontSize: 11,
    fontWeight: '500',
    width: 50,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW FEATURE 2: Daily Family Goals
  // ═══════════════════════════════════════════════════════════════════════════
  goalsContainer: {
    gap: 10,
    marginBottom: DESIGN.spacing.xl,
  },
  goalCard: {
    borderRadius: DESIGN.radius.md,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  goalCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  goalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  goalIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  goalIcon: {
    fontSize: 22,
  },
  goalCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  goalInfo: {
    flex: 1,
    gap: 6,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  goalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalProgressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalProgressText: {
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  goalUnit: {
    fontSize: 11,
    fontWeight: '500',
  },
  goalParticipants: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  goalParticipantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  goalParticipantEmoji: {
    fontSize: 12,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW FEATURE 3: Smart Suggestions
  // ═══════════════════════════════════════════════════════════════════════════
  suggestionsScroll: {
    paddingHorizontal: DESIGN.spacing.lg,
    gap: 12,
    paddingBottom: 4,
  },
  suggestionCard: {
    width: SCREEN_W * 0.75,
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  suggestionCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  suggestionPriority: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  suggestionContent: {
    padding: 18,
    gap: 10,
  },
  suggestionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionIcon: {
    fontSize: 22,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  suggestionDesc: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  suggestionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  suggestionActionText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW FEATURE 4: Family Activity Timeline
  // ═══════════════════════════════════════════════════════════════════════════
  timelineContainer: {
    marginBottom: DESIGN.spacing.xl,
  },
  timelineDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    marginTop: 8,
  },
  timelineDayLine: {
    flex: 1,
    height: 1,
  },
  timelineDayLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
    paddingTop: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    top: 0,
    bottom: -12,
    width: 2,
    left: 11,
  },
  timelineCard: {
    flex: 1,
    borderRadius: DESIGN.radius.md,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timelineCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timelineCardContent: {
    padding: 14,
    gap: 8,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineEmoji: {
    fontSize: 18,
  },
  timelineCardInfo: {
    flex: 1,
    gap: 2,
  },
  timelineCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timelineCardActor: {
    fontSize: 11,
    fontWeight: '500',
  },
  timelineTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timelineTypeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timelineCardDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginLeft: 46,
  },
  timelineEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  timelineEmptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW FEATURE 5: Family Chat Preview
  // ═══════════════════════════════════════════════════════════════════════════
  chatPreviewContainer: {
    gap: 8,
    marginBottom: DESIGN.spacing.xl,
  },
  chatPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: DESIGN.radius.md,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  chatPreviewItemDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chatPreviewAvatar: {
    position: 'relative',
  },
  chatGroupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatUserAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },
  chatUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatUnreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  chatPreviewInfo: {
    flex: 1,
    gap: 4,
  },
  chatPreviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPreviewName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  chatPreviewTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  chatPreviewMessage: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW FEATURE 6: Family Insights
  // ═══════════════════════════════════════════════════════════════════════════
  insightsContainer: {
    gap: 10,
    marginBottom: DESIGN.spacing.xl,
  },
  insightItem: {
    borderRadius: DESIGN.radius.md,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
  },
  insightItemDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  insightLeftBorder: {
    width: 4,
  },
  insightContent: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightIcon: {
    fontSize: 18,
  },
  insightHeaderText: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  insightCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  insightCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightDescription: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  insightActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  insightActionText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Member Card ──
  memberCardWrapper: {
    marginBottom: DESIGN.spacing.md,
    borderRadius: DESIGN.radius.lg,
  },
  memberCardTouchable: {
    width: '100%',
  },
  memberCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    /* no shadow */
  },
  memberCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roleStrip: {
    height: 3,
    width: '100%',
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  memberAvatarContainer: {
    width: 52,
    height: 52,
    borderRadius: DESIGN.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  youBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '900',
  },
  onlineIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  roleBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeSmallText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 3,
  },
  memberRelationship: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  memberLastActive: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 3,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  memberActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
  },
  permissionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  permissionPillText: {
    fontSize: 9,
    fontWeight: '700',
  },

  // ── Pending Cards ──
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DESIGN.radius.md,
    padding: 14,
    marginBottom: DESIGN.spacing.md,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pendingCardDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pendingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f59e0b15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  pendingRole: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  pendingSent: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Role Limits ──
  roleLimitsSection: {
    marginTop: 8,
    marginBottom: 30,
  },
  roleLimitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  roleLimitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleLimitItem: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roleLimitItemDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roleLimitItemFull: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  roleLimitValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  roleLimitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  emptyStateDark: {
    backgroundColor: 'rgba(30,30,35,0.5)',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 8,
  },
  addFirstMemberBtn: {
    marginTop: 12,
    paddingHorizontal: DESIGN.spacing.lg,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addFirstMemberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Analytics ──
  analyticsSection: {
    marginBottom: 24,
  },
  distributionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  distributionItem: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  distributionItemDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  distributionValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  distributionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  analyticsMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    overflow: 'hidden',
    /* no shadow */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  analyticsMemberRowDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  analyticsMemberInfo: {
    flex: 1,
  },
  analyticsMemberName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  analyticsMemberRole: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  analyticsMemberStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  analyticsStat: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Avatar ──
  avatarWrapper: {
    borderRadius: DESIGN.radius.md,
    overflow: 'hidden',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 28,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: DESIGN.radius.xl,
    overflow: 'hidden',
    backgroundColor: '#fff',
    /* no shadow */
  },
  modalContentDark: {
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalScrollContent: {
    padding: 16,
  },

  // ── Member Detail ──
  memberDetailContent: {
    padding: 16,
  },
  memberDetailHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  memberDetailAvatar: {
    marginBottom: 12,
  },
  memberDetailRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  memberDetailRoleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailRowDark: {
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 12,
  },
  permissionsList: {
    gap: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  permissionItemDark: {
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  permissionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailActions: {
    gap: 10,
    marginTop: 10,
  },
  detailActionBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  detailActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  detailActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  detailActionSecondaryDark: {
    backgroundColor: 'rgba(30,30,35,0.5)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  detailActionSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailActionDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff4757',
    backgroundColor: 'rgba(255,71,87,0.05)',
  },
  detailActionDangerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff4757',
  },

  // ── Edit Form ──
  editForm: {
    padding: 16,
  },
  editAvatarContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    color: '#1a1a1a',
    fontWeight: '500',
  },
  formInputDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  toggleRowDark: {
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTextContainer: {
    marginLeft: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  toggleDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // ── Invite Code Display ──
  codeDisplayCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  codeDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeDisplayTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  codeBox: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  codeDisplaySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  shareCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  shareCodeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  activeCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activeCodeRowDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeCodeLeft: {
    flex: 1,
  },
  activeCodeText: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  activeCodeMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  activeCodeRole: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeCodeExpiry: {
    fontSize: 12,
    fontWeight: '500',
  },
  revokeCodeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Invite Form ──
  inviteForm: {
    padding: 16,
  },
  inviteDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  inviteButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inviteButtonDisabled: {
    opacity: 0.7,
  },
  inviteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  roleSelection: {
    gap: 10,
    marginTop: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  roleOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  roleOptionDisabled: {
    opacity: 0.4,
  },
  roleOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleOptionInfo: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  roleOptionDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  roleOptionLimit: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  // ── Role Change ──
  roleChangeContent: {
    padding: 16,
  },
  roleChangeDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  roleChangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  roleChangeOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  roleChangeOptionDisabled: {
    opacity: 0.4,
  },
  roleChangeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleChangeInfo: {
    flex: 1,
  },
  roleChangeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  roleChangeDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  roleChangePerms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  roleChangePerm: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Baby Selector ──
  babySelectorContent: {
    padding: 16,
  },
  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  babyOptionActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(102,126,234,0.05)',
  },
  babyOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  babyOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  babyOptionEmoji: {
    fontSize: 24,
  },
  babyOptionInfo: {
    flex: 1,
  },
  babyOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
  },
  babyOptionMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  addBabyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.1)',
    marginTop: 8,
  },
  addBabyOptionDark: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addBabyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addBabyText: {
    fontSize: 16,
    fontWeight: '700',
  },
});