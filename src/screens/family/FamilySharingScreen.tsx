// src/screens/family/FamilySharingScreen.tsx
// SINGLE SOURCE OF TRUTH for family management, permissions, and settings.
// Absorbs: SecureAccessListScreen, FamilySettingsScreen.
// Tabs: Members | Activity | Permissions | Settings
// ─────────────────────────────────────────────────────────────────────

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
  ScrollView,
  Clipboard,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInMonths, formatDistanceToNow } from 'date-fns';
import { BlurView } from 'expo-blur';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  Layout,
  FadeInRight,
  SlideInRight,
} from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { UserRole, FamilyMember, ROLE_LABELS } from '../../types/roles';

import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useTracker } from '../../hooks';
import { useSafeUser } from '../../hooks/useSafeContexts';

const FAMILY_IMAGES_DIR = FileSystem.documentDirectory + 'family_images/';

type FamilySharingScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilySharing'>;

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

const AnimatedScrollView = Animated.ScrollView;
const { width: SCREEN_W } = Dimensions.get('window');

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
  badge: string;
  maxCount: number;
}> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent', color: '#667eea', gradient: ['#667eea', '#764ba2'], icon: 'shield',
    description: 'Full owner access to everything',
    permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data'],
    badge: 'Owner', maxCount: 1,
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent', color: '#fa709a', gradient: ['#fa709a', '#f5576c'], icon: 'heart',
    description: 'Full access to manage family and baby data',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'],
    badge: 'Co-Parent', maxCount: 1,
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian', color: '#11998e', gradient: ['#11998e', '#38ef7d'], icon: 'shield-checkmark',
    description: 'Can add entries but not delete or manage family',
    permissions: ['Read', 'Write', 'Limited Delete', 'View Timeline'],
    badge: 'Guardian', maxCount: 5,
  },
  [UserRole.VIEWER]: {
    label: 'Viewer', color: '#64748b', gradient: ['#64748b', '#94a3b8'], icon: 'eye',
    description: 'View only access',
    permissions: ['Read Only', 'View Timeline', 'View Photos'],
    badge: 'Viewer', maxCount: 10,
  },
};

// ── Granular permission meta (from SecureAccessListScreen) ──────────
type PermissionKey =
  | 'canView' | 'canAddEntry' | 'canEditEntry' | 'canEditOthersEntries'
  | 'canDeleteEntry' | 'canEditBaby' | 'canInvite' | 'canExport' | 'canManageFamily';

const PERMISSION_META: Record<PermissionKey, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  canView: { label: 'View', icon: 'eye', color: '#3b82f6' },
  canAddEntry: { label: 'Log', icon: 'add-circle', color: '#10b981' },
  canEditEntry: { label: 'Edit Own', icon: 'create', color: '#8b5cf6' },
  canEditOthersEntries: { label: 'Edit Others', icon: 'pencil', color: '#f59e0b' },
  canDeleteEntry: { label: 'Delete', icon: 'trash', color: '#ef4444' },
  canEditBaby: { label: 'Baby Profile', icon: 'person', color: '#06b6d4' },
  canInvite: { label: 'Invite', icon: 'mail', color: '#ec4899' },
  canExport: { label: 'Export', icon: 'download', color: '#a855f7' },
  canManageFamily: { label: 'Manage Family', icon: 'people', color: '#f97316' },
};

// ── Full permission map per role (what the SecureAccessListScreen used) ──
const ROLE_PERMISSION_MAP: Record<UserRole, Record<PermissionKey, boolean>> = {
  [UserRole.PARENT_1]: {
    canView: true, canAddEntry: true, canEditEntry: true, canEditOthersEntries: true,
    canDeleteEntry: true, canEditBaby: true, canInvite: true, canExport: true, canManageFamily: true,
  },
  [UserRole.PARENT_2]: {
    canView: true, canAddEntry: true, canEditEntry: true, canEditOthersEntries: true,
    canDeleteEntry: true, canEditBaby: true, canInvite: true, canExport: true, canManageFamily: true,
  },
  [UserRole.GUARDIAN]: {
    canView: true, canAddEntry: true, canEditEntry: true, canEditOthersEntries: false,
    canDeleteEntry: false, canEditBaby: false, canInvite: false, canExport: false, canManageFamily: false,
  },
  [UserRole.VIEWER]: {
    canView: true, canAddEntry: false, canEditEntry: false, canEditOthersEntries: false,
    canDeleteEntry: false, canEditBaby: false, canInvite: false, canExport: false, canManageFamily: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CONFIG FOR INVITE CODES
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active: { label: 'Active', color: '#22c55e', icon: 'checkmark-circle' },
  used: { label: 'Used ✓', color: '#64748b', icon: 'checkmark-done-circle' },
  partial: { label: 'Partial', color: '#f59e0b', icon: 'warning' },
  revoked: { label: 'Revoked', color: '#ef4444', icon: 'close-circle' },
  expired: { label: 'Expired', color: '#f59e0b', icon: 'time' },
};

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY HEALTH SCORE
// ═══════════════════════════════════════════════════════════════════════════

const FamilyHealthScore: React.FC<{
  members: FamilyMember[];
  isDark: boolean;
  themeColors: any;
  shouldReduceMotion: boolean;
}> = ({ members, isDark, themeColors, shouldReduceMotion }) => {
  const score = useMemo(() => {
    const activeMembers = members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length;
    const totalMembers = members.length || 1;
    const activityScore = Math.round((activeMembers / totalMembers) * 100);
    const engagementScore = Math.min(100, members.length * 15);
    return Math.round((activityScore * 0.6) + (engagementScore * 0.4));
  }, [members]);

  const getScoreColor = (s: number) => (s >= 80 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444');
  const getScoreLabel = (s: number) => (s >= 80 ? 'Thriving' : s >= 50 ? 'Active' : 'Needs Attention');

  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100).springify()}>
      <View style={[styles.healthScoreCard, isDark && styles.healthScoreCardDark]}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
          style={StyleSheet.absoluteFill}
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
              { label: 'Pending', value: members.filter(m => !m.lastActive || m.status === 'pending').length, total: members.length, color: '#ef4444' },
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
// DAILY FAMILY GOALS
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
}> = ({ goals, isDark, themeColors, shouldReduceMotion, onToggleGoal }) => (
  <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(150).springify()}>
    <View style={styles.sectionHeaderRow}>
      <View>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Daily Goals</Text>
        <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
          {goals.filter(g => g.current >= g.target).length} of {goals.length} completed
        </Text>
      </View>
      <View style={[styles.sectionBadge, { backgroundColor: themeColors.primary + '15' }]}>
        <Text style={[styles.sectionBadgeText, { color: themeColors.primary }]}>
          {Math.round((goals.filter(g => g.current >= g.target).length / (goals.length || 1)) * 100)}%
        </Text>
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
            />
            <TouchableOpacity onPress={() => onToggleGoal(goal.id)} style={styles.goalContent} activeOpacity={0.85}>
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
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  </Animated.View>
);

// ═══════════════════════════════════════════════════════════════════════════
// SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════

interface SmartSuggestion {
  id: string;
  type: 'invite' | 'reminder' | 'activity' | 'milestone' | 'health';
  title: string;
  description: string;
  icon: string;
  color: string;
  actionLabel: string;
}

const SmartSuggestions: React.FC<{
  suggestions: SmartSuggestion[];
  isDark: boolean;
  shouldReduceMotion: boolean;
  onAction: (suggestion: SmartSuggestion) => void;
}> = ({ suggestions, isDark, shouldReduceMotion, onAction }) => {
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
            />
            <View style={[styles.suggestionPriority, { backgroundColor: suggestion.color }]} />
            <View style={styles.suggestionContent}>
              <View style={[styles.suggestionIconBg, { backgroundColor: suggestion.color + '15' }]}>
                <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
              </View>
              <Text style={[styles.suggestionTitle, isDark && styles.textDark]} numberOfLines={2}>{suggestion.title}</Text>
              <Text style={[styles.suggestionDesc, isDark && styles.textMuted]} numberOfLines={2}>{suggestion.description}</Text>
              <TouchableOpacity onPress={() => onAction(suggestion)} style={[styles.suggestionActionBtn, { backgroundColor: suggestion.color + '15' }]}>
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
// FAMILY ACTIVITY TIMELINE
// ═══════════════════════════════════════════════════════════════════════════

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: number;
  actorName: string;
  actorRole: UserRole;
}

const FamilyActivityTimeline: React.FC<{
  events: TimelineEvent[];
  isDark: boolean;
  shouldReduceMotion: boolean;
}> = ({ events, isDark, shouldReduceMotion }) => {
  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const ACTIVITY_ICONS: Record<string, string> = {
    feed: '🍼', sleep: '😴', potty: '🚽', diaper: '🧷', growth: '📏',
    medication: '💊', milestone: '🏆', note: '📝',
  };

  return (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(250).springify()}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
          <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>{events.length} events</Text>
        </View>
      </View>
      <View style={styles.timelineContainer}>
        {events.map((event, i) => (
          <View key={event.id} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: '#667eea', borderColor: isDark ? '#1a1a2e' : '#f8fafc' }]} />
              {i < events.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
              )}
            </View>
            <View style={[styles.timelineCard, isDark && styles.timelineCardDark]}>
              <LinearGradient
                colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.timelineCardContent}>
                <View style={styles.timelineCardHeader}>
                  <Text style={styles.timelineEmoji}>{ACTIVITY_ICONS[event.type] || '📝'}</Text>
                  <Text style={[styles.timelineCardTitle, isDark && styles.textDark]} numberOfLines={1}>{event.title}</Text>
                </View>
                <Text style={[styles.timelineCardActor, isDark && styles.textMuted]}>
                  by {event.actorName} • {formatTimeAgo(event.timestamp)}
                </Text>
              </View>
            </View>
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
// FAMILY INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

interface FamilyInsight {
  id: string;
  category: 'tip' | 'alert' | 'milestone' | 'health' | 'social';
  title: string;
  description: string;
  color: string;
}

const FamilyInsights: React.FC<{
  insights: FamilyInsight[];
  isDark: boolean;
  shouldReduceMotion: boolean;
}> = ({ insights, isDark, shouldReduceMotion }) => {
  if (insights.length === 0) return null;
  const icon = (c: string) => ({ tip: '💡', alert: '⚠️', milestone: '🎯', health: '❤️', social: '👥' }[c] || '✨');
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
            />
            <View style={[styles.insightLeftBorder, { backgroundColor: insight.color }]} />
            <View style={styles.insightContent}>
              <View style={styles.insightHeader}>
                <View style={[styles.insightIconBg, { backgroundColor: insight.color + '12' }]}>
                  <Text style={styles.insightIcon}>{icon(insight.category)}</Text>
                </View>
                <View style={styles.insightHeaderText}>
                  <Text style={[styles.insightTitle, isDark && styles.textDark]} numberOfLines={1}>{insight.title}</Text>
                </View>
              </View>
              <Text style={[styles.insightDescription, isDark && styles.textMuted]}>{insight.description}</Text>
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
            <Image source={{ uri: avatar! }} style={{ width: size, height: size }} resizeMode="cover" />
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
}

const ActionModal: React.FC<ActionModalProps> = ({ visible, onClose, title, children, isDark }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.modalOverlay}>
      <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, isDark && styles.modalContentDark]}>
        <LinearGradient
          colors={isDark ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, isDark && styles.textDark]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
        </View>
        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
          {children}
        </Animated.ScrollView>
      </Animated.View>
    </View>
  </Modal>
);

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER CARD
// ═══════════════════════════════════════════════════════════════════════════

const MemberCard: React.FC<{
  member: FamilyMember;
  isCurrentUser: boolean;
  onPress: () => void;
  index: number;
  isDark: boolean;
  themeColors: any;
  shouldReduceMotion: boolean;
}> = ({ member, isCurrentUser, onPress, index, isDark, themeColors, shouldReduceMotion }) => {
  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER];
  const isOnline = member.lastActive && new Date(member.lastActive).getTime() > Date.now() - 5 * 60 * 1000;
  const isPending = !member.lastActive || member.status === 'pending';

  return (
    <Animated.View
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 80).springify()}
      layout={shouldReduceMotion ? undefined : Layout.springify()}
      style={styles.memberCardWrapper}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <View style={[styles.memberCard, isDark && styles.memberCardDark, isPending && styles.memberCardPending]}>
          <LinearGradient
            colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient colors={roleConfig.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.roleStrip} />
          <View style={styles.memberCardContent}>
            <View style={styles.memberAvatarContainer}>
              <SafeAvatar
                avatar={member.avatar}
                size={52}
                fallbackIcon={member.role === UserRole.PARENT_1 ? 'shield' : member.role === UserRole.PARENT_2 ? 'heart' : 'person'}
                fallbackColor={roleConfig.color}
              />
              {isCurrentUser && (
                <View style={[styles.youBadge, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.youBadgeText}>YOU</Text>
                </View>
              )}
              {isOnline && <View style={[styles.onlineIndicator, { borderColor: isDark ? '#1a1a2e' : '#fff' }]} />}
              {isPending && <View style={[styles.pendingIndicator, { borderColor: isDark ? '#1a1a2e' : '#fff' }]} />}
            </View>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, isDark && styles.textDark]} numberOfLines={1}>{member.fullName}</Text>
              <View style={styles.memberMetaRow}>
                <LinearGradient colors={roleConfig.gradient} style={styles.roleBadgeSmall}>
                  <Ionicons name={roleConfig.icon} size={9} color="#fff" />
                  <Text style={styles.roleBadgeSmallText}>{roleConfig.badge}</Text>
                </LinearGradient>
                <Text style={[styles.memberRelationship, isDark && styles.textMuted]}>
                  {member.relationship || 'Family Member'}
                </Text>
              </View>
              {isPending ? (
                <View style={styles.pendingBadge}>
                  <Ionicons name="time-outline" size={11} color="#f59e0b" />
                  <Text style={styles.pendingText}>Pending Invitation</Text>
                </View>
              ) : member.lastActive ? (
                <View style={styles.memberStateRow}>
                  <View style={[styles.stateDot, { backgroundColor: isOnline ? '#10b981' : '#94a3b8' }]} />
                  <Text style={[styles.memberLastActive, isDark && styles.textMuted]}>
                    {isOnline ? 'Active now' : `Active ${formatDistanceToNow(new Date(member.lastActive), { addSuffix: true })}`}
                  </Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={roleConfig.color} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSIONS TAB — FULLY ABSORBS SecureAccessListScreen
// ═══════════════════════════════════════════════════════════════════════════

const PermissionsTab: React.FC<{
  members: FamilyMember[];
  isDark: boolean;
  themeColors: any;
  canManage: boolean;
  currentUserId: string;
  onMemberPress: (m: FamilyMember) => void;
  shouldReduceMotion: boolean;
}> = ({ members, isDark, themeColors, canManage, currentUserId, onMemberPress, shouldReduceMotion }) => {
  const formatLastActive = (iso?: string): string => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <View style={styles.tabContent}>
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
        <LinearGradient
          colors={[themeColors.colors[0], themeColors.colors[1]]}
          style={styles.permissionsHeaderCard}
        >
          <View style={styles.permissionsHeaderTop}>
            <View style={[styles.permissionsHeaderIcon, { backgroundColor: themeColors.primary + '20' }]}>
              <Ionicons name="shield-checkmark" size={24} color={themeColors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.permissionsHeaderTitle, isDark && styles.textDark]}>Who can access</Text>
              <Text style={[styles.permissionsHeaderSubtitle, isDark && styles.textMuted]}>
                {members.length} {members.length === 1 ? 'person has' : 'people have'} access
              </Text>
            </View>
          </View>
          {!canManage && (
            <View style={styles.readOnlyBanner}>
              <Ionicons name="eye-outline" size={14} color="#f59e0b" />
              <Text style={styles.readOnlyText}>
                You can view this list, but only Parent 1 / Parent 2 can change permissions
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {members.map((member, idx) => {
        const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER];
        const permMap = ROLE_PERMISSION_MAP[member.role] || ROLE_PERMISSION_MAP[UserRole.VIEWER];
        const activePerms = (Object.keys(PERMISSION_META) as PermissionKey[]).filter(k => permMap[k]);
        const isYou = member.id === currentUserId || member.userId === currentUserId;
        const isPending = !member.lastActive || member.status === 'pending';

        return (
          <Animated.View
            key={member.id}
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(80 + idx * 40).springify()}
          >
            <TouchableOpacity
              activeOpacity={canManage && member.role !== UserRole.PARENT_1 ? 0.85 : 1}
              onPress={() => {
                if (!canManage) return;
                if (member.role === UserRole.PARENT_1) return;
                onMemberPress(member);
              }}
              style={[styles.permissionCard, isDark && styles.permissionCardDark]}
            >
              <LinearGradient
                colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.permissionCardHeader}>
                <SafeAvatar avatar={member.avatar} size={44} fallbackColor={roleCfg.color} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.permissionCardName, isDark && styles.textDark]} numberOfLines={1}>
                      {member.fullName}
                      {member.role === UserRole.PARENT_1 && ' (Owner)'}
                    </Text>
                    {isYou && (
                      <View style={[styles.permissionYouBadge, { backgroundColor: themeColors.primary + '20' }]}>
                        <Text style={[styles.permissionYouText, { color: themeColors.primary }]}>You</Text>
                      </View>
                    )}
                  </View>
                  {member.email ? (
                    <Text style={[styles.permissionEmail, isDark && styles.textMuted]} numberOfLines={1}>
                      {member.email}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.permissionRolePill, { backgroundColor: roleCfg.color + '18' }]}>
                  <Text style={[styles.permissionRoleText, { color: roleCfg.color }]}>{roleCfg.badge}</Text>
                </View>
              </View>

              <View style={styles.permissionMetaRow}>
                <Ionicons name="time-outline" size={12} color={isDark ? '#64748b' : '#94a3b8'} />
                <Text style={[styles.permissionMetaText, isDark && styles.textMuted]}>
                  Last active: {formatLastActive(member.lastActive)}
                </Text>
                {isPending && (
                  <View style={styles.permissionPendingPill}>
                    <Text style={styles.permissionPendingText}>Invite Pending</Text>
                  </View>
                )}
              </View>

              <View style={styles.permissionChipsWrap}>
                {activePerms.length === 0 ? (
                  <Text style={[styles.permissionNoPerms, isDark && styles.textMuted]}>No permissions</Text>
                ) : (
                  activePerms.map(key => {
                    const meta = PERMISSION_META[key];
                    return (
                      <View key={key} style={[styles.permissionChip, { backgroundColor: meta.color + '15' }]}>
                        <Ionicons name={meta.icon} size={11} color={meta.color} />
                        <Text style={[styles.permissionChipText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      <View style={styles.permissionsFooter}>
        <Ionicons name="information-circle-outline" size={14} color={isDark ? '#64748b' : '#94a3b8'} />
        <Text style={[styles.permissionsFooterText, isDark && styles.textMuted]}>
          All access changes sync instantly across family devices.
        </Text>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS TAB — FULLY ABSORBS FamilySettingsScreen
// ═══════════════════════════════════════════════════════════════════════════

const SettingsTab: React.FC<{
  isDark: boolean;
  themeColors: any;
  isPrimaryParent: boolean;
  familyCount: number;
  hasCoParent: boolean;
  guardianCount: number;
  onNavigateFamilySharing: () => void;
  onNavigateInvite: () => void;
  onNavigateBackup: () => void;
  onNavigateReminders: () => void;
  onLeaveFamily: () => void;
  shouldReduceMotion: boolean;
}> = ({
  isDark, themeColors, isPrimaryParent,
  familyCount, hasCoParent, guardianCount,
  onNavigateFamilySharing, onNavigateInvite,
  onNavigateBackup, onNavigateReminders, onLeaveFamily,
  shouldReduceMotion,
}) => {
  const renderRow = (
    icon: keyof typeof Ionicons.glyphMap,
    iconColor: string,
    title: string,
    subtitle: string,
    onPress: () => void,
    destructive = false,
  ) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.settingsRow, isDark && styles.settingsRowDark]}
    >
      <LinearGradient
        colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.settingsIconBg, { backgroundColor: (destructive ? '#ef4444' : iconColor) + '15' }]}>
        <Ionicons name={icon} size={20} color={destructive ? '#ef4444' : iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingsRowTitle, isDark && styles.textDark, destructive && { color: '#ef4444' }]}>
          {title}
        </Text>
        <Text style={[styles.settingsRowSubtitle, isDark && styles.textMuted]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748b' : '#94a3b8'} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.tabContent}>
      {/* Summary card (from FamilySettingsScreen) */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
        <LinearGradient
          colors={[themeColors.colors[0], themeColors.colors[1]]}
          style={styles.settingsSummaryCard}
        >
          <View style={styles.settingsSummaryRow}>
            <View style={styles.settingsSummaryItem}>
              <Text style={[styles.settingsSummaryValue, { color: themeColors.primary }]}>{familyCount}</Text>
              <Text style={[styles.settingsSummaryLabel, isDark && styles.textMuted]}>Members</Text>
            </View>
            <View style={[styles.settingsSummaryDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
            <View style={styles.settingsSummaryItem}>
              <Text style={[styles.settingsSummaryValue, { color: '#fa709a' }]}>{hasCoParent ? 'Yes' : 'No'}</Text>
              <Text style={[styles.settingsSummaryLabel, isDark && styles.textMuted]}>Co-Parent</Text>
            </View>
            <View style={[styles.settingsSummaryDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
            <View style={styles.settingsSummaryItem}>
              <Text style={[styles.settingsSummaryValue, { color: '#10b981' }]}>{guardianCount}</Text>
              <Text style={[styles.settingsSummaryLabel, isDark && styles.textMuted]}>Guardians</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Family Management */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100).springify()}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Family Management</Text>
            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>Manage your household</Text>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          {renderRow('people-outline', themeColors.primary, 'Family Members', 'View and manage family members', onNavigateFamilySharing)}
          {isPrimaryParent && renderRow('person-add', '#11998e', 'Invite Co-Parent', 'Send an invite to your partner', onNavigateInvite)}
          {renderRow('shield-checkmark-outline', '#f59e0b', 'Permissions', 'Control what family members can access', () => {
            // Switch to Permissions tab instead of navigating
            onNavigateFamilySharing();
          })}
        </View>
      </Animated.View>

      {/* Data & Privacy */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(150).springify()}>
        <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
          <View>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Data & Privacy</Text>
            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>Family data controls</Text>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          {renderRow('share-outline', '#10b981', 'Export Family Data', 'Backup all family records', onNavigateBackup)}
          {renderRow('notifications-outline', '#4facfe', 'Family Notifications', 'Alerts for family activity', onNavigateReminders)}
        </View>
      </Animated.View>

      {/* Danger Zone */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200).springify()}>
        <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
          <View>
            <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Danger Zone</Text>
            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>Destructive actions</Text>
          </View>
        </View>
        {renderRow(
          'exit-outline',
          '#ef4444',
          'Leave Family',
          'Remove yourself from this family group',
          onLeaveFamily,
          true,
        )}
      </Animated.View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function FamilySharingScreen({ navigation }: FamilySharingScreenProps) {
  const sweetAlert = useSweetAlert();
  const {
    members, guardians, parent1, parent2,
    loadFamily, removeMember, updateGuardianProfile, updateParent2Profile,
    getActiveInviteCodes, revokeInviteCode, getPartialSignupInfo,
  } = useFamily();

  const { profile, updateProfile } = useSafeUser();
  const { currentBaby } = useBaby();
  const { userProfile, resetPasswordForUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();

  const scrollY = useSharedValue(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'activity' | 'permissions' | 'settings'>('members');
  const [activeCodes, setActiveCodes] = useState<any[]>([]);

  const [editForm, setEditForm] = useState({
    fullName: '', email: '', phoneNumber: '', relationship: '', avatar: '', notificationsEnabled: true,
  });

  const { entries: trackerEntries } = useTracker();

  // ─── Data derivations ────────────────────────────────────────────
  const dailyGoals = useMemo((): DailyGoal[] => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEntries = trackerEntries.filter((e: any) => e.timestamp >= todayStart.getTime() && !e.isDeleted);
    const count = (id: string) => todayEntries.filter((e: any) => e.trackerId === id).length;
    return [
      { id: 'feed', title: 'Track Feeding', icon: '🍼', target: 6, current: count('feed'), unit: 'times today', color: '#f59e0b', participants: [] },
      { id: 'sleep', title: 'Log Sleep', icon: '😴', target: 3, current: count('sleep'), unit: 'naps today', color: '#8b5cf6', participants: [] },
      { id: 'growth', title: 'Growth Check', icon: '📏', target: 1, current: count('growth'), unit: 'measurement', color: '#10b981', participants: [] },
      { id: 'photo', title: 'Family Photo', icon: '📸', target: 1, current: todayEntries.filter((e: any) => Array.isArray(e.photoUris) && e.photoUris.length > 0).length, unit: 'photo today', color: '#ec4899', participants: [] },
    ];
  }, [trackerEntries]);

  const smartSuggestions = useMemo((): SmartSuggestion[] => {
    const out: SmartSuggestion[] = [];
    if (guardians.length === 0) {
      out.push({ id: 'invite-guardian', type: 'invite', title: 'Invite a Guardian', description: 'Add a grandparent or caregiver.', icon: '👵', color: '#667eea', actionLabel: 'Send Invite' });
    }
    if (currentBaby) {
      const ageMonths = differenceInMonths(new Date(), new Date((currentBaby as any).birthDate || (currentBaby as any).dateOfBirth));
      if (ageMonths >= 4 && ageMonths <= 8) {
        out.push({ id: 'tummy-time', type: 'activity', title: 'Schedule tummy time', description: `At ${ageMonths} months, tummy time helps core strength.`, icon: '👶', color: '#10b981', actionLabel: 'Schedule' });
      }
    }
    return out.slice(0, 3);
  }, [guardians.length, currentBaby]);

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!trackerEntries || trackerEntries.length === 0) return [];
    return trackerEntries
      .filter((e: any) => e?.timestamp && e?.trackerId && !e.isDeleted)
      .slice(0, 10)
      .map((e: any, i: number) => ({
        id: e.id || `event-${i}`,
        type: e.trackerId || 'note',
        title: e.title || `${e.trackerId?.charAt(0)?.toUpperCase() + e.trackerId?.slice(1) || 'Activity'} logged`,
        description: e.notes || '',
        timestamp: e.timestamp,
        actorName: e.loggedByName || 'You',
        actorRole: (e.loggedByRole as UserRole) || UserRole.PARENT_1,
      }))
      .sort((a: TimelineEvent, b: TimelineEvent) => b.timestamp - a.timestamp);
  }, [trackerEntries]);

  const familyInsights = useMemo((): FamilyInsight[] => {
    const out: FamilyInsight[] = [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekEntries = trackerEntries.filter((e: any) => e.timestamp >= weekAgo && !e.isDeleted);
    const sleeps = weekEntries.filter((e: any) => e.trackerId === 'sleep');
    if (sleeps.length >= 3) {
      const avg = sleeps.reduce((s: number, e: any) => s + (e.data?.duration || 0), 0) / sleeps.length / 60;
      if (avg > 0) out.push({ id: 'sleep-quality', category: 'health', title: 'Sleep tracking active', description: `Avg ${avg.toFixed(0)}m across ${sleeps.length} sessions.`, color: '#10b981' });
    }
    const activeMembers = members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > weekAgo);
    if (activeMembers.length > 1) {
      out.push({ id: 'engagement', category: 'social', title: `${activeMembers.length} active members`, description: 'Great teamwork this week!', color: '#667eea' });
    }
    return out.slice(0, 3);
  }, [trackerEntries, members]);

  const currentUserId = useMemo(
    () => userProfile?.id || userProfile?.uid || profile?.id || '',
    [userProfile, profile],
  );

  const isPrimaryParent = useMemo(() => {
    if (!currentUserId) return false;
    return parent1?.id === currentUserId || userProfile?.role === 'parent1' || profile?.role === 'parent1' ||
      members.some(m => m.role === UserRole.PARENT_1 && (m.id === currentUserId || m.userId === currentUserId));
  }, [parent1, members, currentUserId, userProfile, profile]);

  const hasCoParent = useMemo(
    () => members.some(m => m.role === UserRole.PARENT_2) || !!parent2,
    [members, parent2],
  );

  const familyCount = useMemo(
    () => members.length + (currentBaby ? 1 : 0),
    [members, currentBaby],
  );

  // ─── Effects ─────────────────────────────────────────────────────
  useEffect(() => { loadFamily(); }, [loadFamily]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { 'worklet'; scrollY.value = event.contentOffset.y; },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isDark
      ? `rgba(10,10,10,${interpolate(scrollY.value, [0, 60, 120], [0, 0.7, 0.95], Extrapolation.CLAMP)})`
      : `rgba(248,250,252,${interpolate(scrollY.value, [0, 60, 120], [0, 0.7, 0.95], Extrapolation.CLAMP)})`,
    borderBottomColor: isDark
      ? `rgba(255,255,255,${interpolate(scrollY.value, [0, 60, 120], [0, 0.05, 0.1], Extrapolation.CLAMP)})`
      : `rgba(0,0,0,${interpolate(scrollY.value, [0, 60, 120], [0, 0.05, 0.1], Extrapolation.CLAMP)})`,
  }));

  const loadActiveCodes = useCallback(async () => {
    if (!currentBaby) return;
    try {
      const codes = await getActiveInviteCodes();
      setActiveCodes((codes || []).filter((c: any) => c.status === 'active' || c.status === 'partial'));
    } catch (e) { console.error(e); }
  }, [currentBaby, getActiveInviteCodes]);

  useEffect(() => {
    if (isPrimaryParent && currentBaby) loadActiveCodes();
  }, [isPrimaryParent, currentBaby, loadActiveCodes]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFamily();
    if (isPrimaryParent && currentBaby) await loadActiveCodes();
    setIsRefreshing(false);
  }, [loadFamily, isPrimaryParent, currentBaby, loadActiveCodes]);

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleUpdateMember = async () => {
    if (!selectedMember) return;
    if (!editForm.fullName.trim()) { sweetAlert.alert('Error', 'Name is required', 'warning'); return; }
    setIsLoading(true);
    let success = false;
    if (selectedMember.role === UserRole.PARENT_2) {
      success = await updateParent2Profile({
        fullName: editForm.fullName, email: editForm.email,
        phoneNumber: editForm.phoneNumber, avatar: editForm.avatar,
      });
    } else if (selectedMember.role === UserRole.PARENT_1) {
      try {
        await updateProfile({
          fullName: editForm.fullName, email: editForm.email,
          phoneNumber: editForm.phoneNumber, avatar: editForm.avatar,
        });
        success = true;
      } catch { success = false; }
    } else {
      success = await updateGuardianProfile(selectedMember.id, {
        fullName: editForm.fullName, email: editForm.email, phoneNumber: editForm.phoneNumber,
        relationship: editForm.relationship, avatar: editForm.avatar,
        notificationsEnabled: editForm.notificationsEnabled,
      });
    }
    if (success) {
      triggerHaptic('success');
      setShowEditModal(false);
      sweetAlert.alert('Success', 'Member updated', 'success');
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
      `Remove ${selectedMember.fullName}?`,
      () => {
        triggerHaptic('success');
        removeMember(selectedMember.id);
        setShowMemberModal(false);
      },
      () => {},
      'Remove', 'Cancel', true,
    );
  };

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { sweetAlert.alert('Permission Required', 'Allow photo access', 'warning'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(FAMILY_IMAGES_DIR);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(FAMILY_IMAGES_DIR, { intermediates: true });
        const permanentUri = `${FAMILY_IMAGES_DIR}${selectedMember?.id || 'member'}_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setEditForm(prev => ({ ...prev, avatar: permanentUri }));
      } catch (error) { sweetAlert.alert('Error', 'Failed to save photo', 'warning'); }
    }
  };

  const openMemberDetails = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditForm({
      fullName: member.fullName || '', email: member.email || '', phoneNumber: member.phoneNumber || '',
      relationship: member.relationship || '', avatar: member.avatar || '',
      notificationsEnabled: member.notificationsEnabled ?? true,
    });
    setShowMemberModal(true);
    triggerHaptic('light');
  };

  const handleToggleGoal = (goalId: string) => {
    triggerHaptic('light');
  };

  const handleSuggestionAction = (suggestion: SmartSuggestion) => {
    triggerHaptic('medium');
    if (suggestion.type === 'invite') navigation.navigate('CoParentInviteScreen');
    else sweetAlert.toast('Coming Soon', 'Will be available soon', 'info');
  };

  const handleRevokeCode = useCallback(async (code: string) => {
    sweetAlert.confirm('Revoke Invite', 'Revoke this invite code?', async () => {
      const success = await revokeInviteCode(code);
      if (success) { sweetAlert.toast('Revoked', 'Invite revoked', 'success'); loadActiveCodes(); }
      else sweetAlert.alert('Error', 'Failed to revoke', 'warning');
    }, () => {}, 'Revoke', 'Cancel', true);
  }, [revokeInviteCode, loadActiveCodes, sweetAlert]);

  const handleResendPartial = useCallback(async (code: string) => {
    try {
      const info = await getPartialSignupInfo(code);
      if (!info.exists) { sweetAlert.alert('Info', 'No partial signup found', 'info'); return; }
      let message = `📱 You started signing up for LittleLoom but didn't finish!\n\n🎫 Code: ${code}\n`;
      if (info.name) message += `👤 Name: ${info.name}\n`;
      if (info.email) message += `📧 Email: ${info.email}\n`;
      if (info.phone) message += `📱 Phone: ${info.phone}\n`;
      message += `\n🔗 Continue here: https://littleloom.app/join?code=${code}`;
      await Clipboard.setString(message);
      sweetAlert.alert('Copied', 'Invite message copied to clipboard', 'success');
      triggerHaptic('medium');
    } catch { sweetAlert.alert('Error', 'Could not process', 'warning'); }
  }, [getPartialSignupInfo, sweetAlert, triggerHaptic]);

  const handleLeaveFamily = () => {
    sweetAlert.confirm(
      'Leave Family?',
      'You will lose access to this family\'s data unless re-invited.',
      () => {
        sweetAlert.toast('Left Family', 'You have been removed', 'info');
        navigation.goBack();
      },
      undefined, 'Leave', 'Stay', true,
    );
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    triggerHaptic('light');
  };

  // ─── Header ──────────────────────────────────────────────────────
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
              onPress={() => navigation.navigate('SwitchBaby', { returnTo: 'FamilySharing', returnLabel: 'Family' })}
            >
              <Text style={[styles.babySelectorText, { color: themeColors.primary }]}>
                {currentBaby.name} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {isPrimaryParent ? (
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnAccent, { backgroundColor: themeColors.primary }]}
            onPress={() => navigation.navigate('CoParentInviteScreen')}
          >
            <Ionicons name="person-add" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* 4-tab bar */}
      <View style={[styles.modernTabBar, isDark && styles.modernTabBarDark]}>
        {(['members', 'activity', 'permissions', 'settings'] as const).map((tab) => {
          const icons: Record<typeof tab, keyof typeof Ionicons.glyphMap> = {
            members: 'people', activity: 'pulse', permissions: 'shield-checkmark', settings: 'settings',
          };
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.modernTab, isActive && [styles.modernTabActive, { backgroundColor: themeColors.colors[0] }]]}
              onPress={() => handleTabChange(tab)}
            >
              <Ionicons
                name={icons[tab]}
                size={15}
                color={isActive ? themeColors.primary : isDark ? '#94a3b8' : '#64748b'}
              />
              <Text
                style={[
                  styles.modernTabText,
                  isActive && [styles.modernTabTextActive, { color: themeColors.primary }],
                ]}
                numberOfLines={1}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );

  // ─── Members tab ─────────────────────────────────────────────────
  const renderMembersTab = () => (
    <View style={styles.tabContent}>
      <FamilyHealthScore members={members} isDark={isDark} themeColors={themeColors} shouldReduceMotion={shouldReduceMotion} />
      <DailyFamilyGoals goals={dailyGoals} isDark={isDark} themeColors={themeColors} shouldReduceMotion={shouldReduceMotion} onToggleGoal={handleToggleGoal} />
      <SmartSuggestions suggestions={smartSuggestions} isDark={isDark} shouldReduceMotion={shouldReduceMotion} onAction={handleSuggestionAction} />
      <FamilyInsights insights={familyInsights} isDark={isDark} shouldReduceMotion={shouldReduceMotion} />

      {renderMemberSection('Primary Parent', members.filter(m => m.role === UserRole.PARENT_1))}
      {renderMemberSection('Co-Parent', members.filter(m => m.role === UserRole.PARENT_2), 'No co-parent added yet')}
      {renderMemberSection('Guardians & Viewers', members.filter(m => m.role === UserRole.GUARDIAN || m.role === UserRole.VIEWER), 'No guardians added')}

      {isPrimaryParent && activeCodes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Pending Invites</Text>
              <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
                {activeCodes.filter(c => c.status === 'active').length} active • {activeCodes.filter(c => c.status === 'partial').length} partial
              </Text>
            </View>
            <TouchableOpacity onPress={loadActiveCodes}>
              <Ionicons name="refresh" size={18} color={themeColors.primary} />
            </TouchableOpacity>
          </View>
          {activeCodes.map((code, i) => {
            const sc = STATUS_CONFIG[code.status] || STATUS_CONFIG.active;
            const isPartial = code.status === 'partial';
            return (
              <Animated.View
                key={code.code + i}
                entering={shouldReduceMotion ? undefined : FadeInUp.delay(i * 60).springify()}
                style={[styles.pendingCard, isDark && styles.pendingCardDark, isPartial && styles.pendingCardPartial]}
              >
                <LinearGradient
                  colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.92)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.pendingIcon}>
                  <Ionicons name="key-outline" size={22} color={isPartial ? '#f59e0b' : themeColors.primary} />
                </View>
                <View style={styles.pendingInfo}>
                  <View style={styles.pendingHeaderRow}>
                    <Text style={[styles.pendingEmail, isDark && styles.textDark, { fontSize: 13, fontFamily: 'monospace' }]} numberOfLines={1}>
                      {code.code}
                    </Text>
                    <View style={[styles.pendingStatusBadge, { backgroundColor: sc.color + '15' }]}>
                      <Ionicons name={sc.icon} size={10} color={sc.color} />
                      <Text style={[styles.pendingStatusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                  {code.used_by_name && <Text style={[styles.pendingSent, isDark && styles.textMuted]}>👤 {code.used_by_name}</Text>}
                  {code.used_by_email && <Text style={[styles.pendingSent, isDark && styles.textMuted]}>✉️ {code.used_by_email}</Text>}
                  {isPartial && <Text style={[styles.pendingPartialText, { color: '#f59e0b' }]}>⚠️ Partial — didn't finish registration</Text>}
                </View>
                <View style={styles.pendingActions}>
                  {isPartial && (
                    <TouchableOpacity
                      style={[styles.pendingAction, { backgroundColor: '#f59e0b15' }]}
                      onPress={() => handleResendPartial(code.code)}
                    >
                      <Ionicons name="refresh-outline" size={18} color="#f59e0b" />
                    </TouchableOpacity>
                  )}
                  {code.status === 'active' && (
                    <TouchableOpacity
                      style={[styles.pendingAction, { backgroundColor: '#ef444410' }]}
                      onPress={() => handleRevokeCode(code.code)}
                    >
                      <Ionicons name="close" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderMemberSection = (title: string, data: FamilyMember[], emptyText?: string) => {
    const unique = data.filter((m, i, arr) => i === arr.findIndex(x => x.id === m.id));
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
            <Text style={[styles.sectionSubtitle, isDark && styles.textMuted]}>
              {unique.length} {unique.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
        {unique.length === 0 && emptyText ? (
          <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
            <Ionicons name="people-outline" size={32} color={isDark ? '#555' : '#ccc'} />
            <Text style={[styles.emptyStateText, isDark && styles.textMuted]}>{emptyText}</Text>
            {isPrimaryParent && title !== 'Primary Parent' && (
              <TouchableOpacity
                style={[styles.addFirstMemberBtn, { backgroundColor: themeColors.primary }]}
                onPress={() => navigation.navigate('CoParentInviteScreen')}
              >
                <Text style={styles.addFirstMemberText}>Add Member</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          unique.map((member, index) => (
            <MemberCard
              key={member.id + index}
              member={member}
              isCurrentUser={member.id === currentUserId || member.userId === currentUserId}
              onPress={() => openMemberDetails(member)}
              index={index}
              isDark={isDark}
              themeColors={themeColors}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))
        )}
      </View>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────
  if (isLoading && members.length === 0) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.containerDark]}>
        <StatusBar barStyle={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ marginTop: 12, color: isDark ? '#94a3b8' : '#64748b' }}>Loading family...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={StyleSheet.absoluteFill} />

      {renderHeader()}

      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 140 + insets.top, paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={themeColors.primary} colors={[themeColors.primary]} />
        }
      >
        {activeTab === 'members' && renderMembersTab()}
        {activeTab === 'activity' && (
          <View style={styles.tabContent}>
            <FamilyActivityTimeline events={timelineEvents} isDark={isDark} shouldReduceMotion={shouldReduceMotion} />
          </View>
        )}
        {activeTab === 'permissions' && (
          <PermissionsTab
            members={members}
            isDark={isDark}
            themeColors={themeColors}
            canManage={isPrimaryParent}
            currentUserId={currentUserId}
            onMemberPress={(m) => openMemberDetails(m)}
            shouldReduceMotion={shouldReduceMotion}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            isDark={isDark}
            themeColors={themeColors}
            isPrimaryParent={isPrimaryParent}
            familyCount={familyCount}
            hasCoParent={hasCoParent}
            guardianCount={guardians?.length || 0}
            onNavigateFamilySharing={() => setActiveTab('members')}
            onNavigateInvite={() => navigation.navigate('CoParentInviteScreen')}
            onNavigateBackup={() => navigation.navigate('BackupRestore')}
            onNavigateReminders={() => navigation.navigate('TrackerReminders')}
            onLeaveFamily={handleLeaveFamily}
            shouldReduceMotion={shouldReduceMotion}
          />
        )}
      </AnimatedScrollView>

      {/* Member Detail Modal */}
      <ActionModal
        visible={showMemberModal}
        onClose={() => { setShowMemberModal(false); setSelectedMember(null); }}
        title={selectedMember?.fullName || 'Member Details'}
        isDark={isDark}
      >
        {selectedMember && (
          <View style={styles.memberDetailContent}>
            <View style={styles.memberDetailHeader}>
              <SafeAvatar
                avatar={selectedMember.avatar}
                size={100}
                fallbackIcon={selectedMember.role === UserRole.PARENT_1 ? 'shield' : 'person'}
                fallbackColor={ROLE_CONFIG[selectedMember.role].color}
              />
              <LinearGradient colors={ROLE_CONFIG[selectedMember.role].gradient} style={styles.memberDetailRoleBadge}>
                <Ionicons name={ROLE_CONFIG[selectedMember.role].icon} size={14} color="#fff" />
                <Text style={styles.memberDetailRoleText}>{ROLE_CONFIG[selectedMember.role].label}</Text>
              </LinearGradient>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, isDark && styles.textDark]}>Contact</Text>
              {selectedMember.email && (
                <View style={[styles.detailRow, isDark && styles.detailRowDark]}>
                  <Ionicons name="mail" size={18} color={themeColors.primary} />
                  <Text style={[styles.detailText, isDark && styles.textDark]}>{selectedMember.email}</Text>
                </View>
              )}
              {selectedMember.phoneNumber && (
                <View style={[styles.detailRow, isDark && styles.detailRowDark]}>
                  <Ionicons name="call" size={18} color="#10b981" />
                  <Text style={[styles.detailText, isDark && styles.textDark]}>{selectedMember.phoneNumber}</Text>
                </View>
              )}
              <View style={[styles.detailRow, isDark && styles.detailRowDark]}>
                <Ionicons name="people" size={18} color="#f59e0b" />
                <Text style={[styles.detailText, isDark && styles.textDark]}>
                  {selectedMember.relationship || 'Family Member'}
                </Text>
              </View>
            </View>

            <View style={styles.detailActions}>
              {isPrimaryParent && selectedMember.role !== UserRole.PARENT_1 && (
                <>
                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionSecondary, isDark && styles.detailActionSecondaryDark]}
                    onPress={() => { setShowMemberModal(false); setShowEditModal(true); }}
                  >
                    <Ionicons name="create" size={20} color={themeColors.primary} />
                    <Text style={[styles.detailActionSecondaryText, { color: themeColors.primary }]}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionSecondary, isDark && styles.detailActionSecondaryDark]}
                    onPress={() => {
                      if (!selectedMember?.email) { sweetAlert.alert('No Email', 'No email on file', 'warning'); return; }
                      sweetAlert.confirm('Reset Password', `Reset password for ${selectedMember.fullName}?`, async () => {
                        const r = await resetPasswordForUser(selectedMember.email, 'littleloom_temp_2026');
                        if (r.success) sweetAlert.alert('Password Reset', 'Temporary password set.', 'success');
                        else sweetAlert.alert('Error', r.message, 'warning');
                      }, () => {}, 'Reset', 'Cancel', true);
                    }}
                  >
                    <Ionicons name="key" size={20} color="#f59e0b" />
                    <Text style={[styles.detailActionSecondaryText, { color: '#f59e0b' }]}>Reset Password</Text>
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
      >
        <View style={styles.editForm}>
          <TouchableOpacity style={styles.editAvatarContainer} onPress={handleImagePick}>
            {editForm.avatar ? (
              <SafeAvatar avatar={editForm.avatar} size={100} fallbackIcon="camera" fallbackColor={themeColors.primary} />
            ) : (
              <View style={[styles.editAvatarPlaceholder, { backgroundColor: ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color + '20' }]}>
                <Ionicons name="camera" size={32} color={ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color} />
              </View>
            )}
            <View style={[styles.editAvatarOverlay, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          {[
            { label: 'Full Name', key: 'fullName' as const, placeholder: 'Enter full name' },
            { label: 'Email', key: 'email' as const, placeholder: 'Enter email', keyboard: 'email-address' as const },
            { label: 'Phone', key: 'phoneNumber' as const, placeholder: 'Enter phone', keyboard: 'phone-pad' as const },
            { label: 'Relationship', key: 'relationship' as const, placeholder: 'e.g., Grandma, Nanny' },
          ].map(({ label, key, placeholder, keyboard }) => (
            <View key={key} style={styles.formGroup}>
              <Text style={[styles.formLabel, isDark && styles.textDark]}>{label}</Text>
              <TextInput
                style={[styles.formInput, isDark && styles.formInputDark]}
                value={(editForm as any)[key]}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, [key]: text }))}
                placeholder={placeholder}
                placeholderTextColor={isDark ? '#666' : '#999'}
                keyboardType={keyboard}
                autoCapitalize={key === 'email' ? 'none' : 'words'}
              />
            </View>
          ))}

          <View style={[styles.toggleRow, isDark && styles.toggleRowDark]}>
            <View style={styles.toggleInfo}>
              <Ionicons
                name={editForm.notificationsEnabled ? 'notifications' : 'notifications-off'}
                size={22}
                color={editForm.notificationsEnabled ? themeColors.primary : isDark ? '#555' : '#999'}
              />
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, isDark && styles.textDark]}>Notifications</Text>
                <Text style={[styles.toggleDescription, isDark && styles.textMuted]}>Receive family activity alerts</Text>
              </View>
            </View>
            <Switch
              value={editForm.notificationsEnabled}
              onValueChange={(v) => setEditForm(prev => ({ ...prev, notificationsEnabled: v }))}
              trackColor={{ false: isDark ? '#333' : '#ddd', true: themeColors.primary }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleUpdateMember} disabled={isLoading}>
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.saveButtonGradient}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ActionModal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  containerDark: { backgroundColor: '#0a0a0a' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { paddingHorizontal: DESIGN.spacing.lg },

  // ── Header ──
  headerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DESIGN.spacing.lg, paddingBottom: 8,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  headerBtnDark: { backgroundColor: 'rgba(40,40,50,0.95)', borderColor: 'rgba(255,255,255,0.08)' },
  headerBtnAccent: { backgroundColor: '#667eea' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.3 },
  babySelectorChip: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  babySelectorText: { fontSize: 12, fontWeight: '700' },

  // ── Modern Tab Bar (4 tabs) ──
  modernTabBar: {
    flexDirection: 'row', marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.md,
    padding: 4, borderRadius: DESIGN.radius.lg, backgroundColor: 'rgba(0,0,0,0.04)', gap: 2,
  },
  modernTabBarDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
  modernTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 10, borderRadius: 12,
  },
  modernTabActive: {},
  modernTabText: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  modernTabTextActive: { fontWeight: '700' },

  // ── Section Headers ──
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginHorizontal: 4, marginBottom: 12, marginTop: 8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.4 },
  sectionSubtitle: { fontSize: 13, fontWeight: '500', color: '#64748b', marginTop: 2 },
  sectionBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  sectionBadgeText: { fontSize: 14, fontWeight: '800' },

  tabContent: { paddingTop: 8 },
  section: { marginBottom: 28 },

  // ── Health Score ──
  healthScoreCard: {
    borderRadius: DESIGN.radius.lg, overflow: 'hidden', marginBottom: DESIGN.spacing.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  healthScoreCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  healthScoreContent: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 16 },
  healthScoreLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  healthScoreRing: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  healthScoreValue: { fontSize: 24, fontWeight: '800' },
  healthScoreMax: { fontSize: 12, fontWeight: '600' },
  healthScoreLabels: { gap: 2 },
  healthScoreLabel: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  healthScoreSub: { fontSize: 13, fontWeight: '600' },
  healthScoreRight: { flex: 1, gap: 8 },
  healthScoreMini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  healthScoreMiniBarWrap: { flex: 1 },
  healthScoreMiniBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  healthScoreMiniBarFill: { height: '100%', borderRadius: 3 },
  healthScoreMiniValue: { fontSize: 12, fontWeight: '700', width: 32, textAlign: 'right' },
  healthScoreMiniLabel: { fontSize: 11, fontWeight: '500', width: 50 },

  // ── Goals ──
  goalsContainer: { gap: 10, marginBottom: DESIGN.spacing.xl },
  goalCard: { borderRadius: DESIGN.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  goalCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  goalContent: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  goalIconBg: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  goalIcon: { fontSize: 22 },
  goalCheckmark: {
    position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff',
  },
  goalInfo: { flex: 1, gap: 6 },
  goalTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  goalProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalProgressBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  goalProgressFill: { height: '100%', borderRadius: 3 },
  goalProgressText: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
  goalUnit: { fontSize: 11, fontWeight: '500' },

  // ── Suggestions ──
  suggestionsScroll: { paddingHorizontal: DESIGN.spacing.lg, gap: 12, paddingBottom: 4 },
  suggestionCard: {
    width: SCREEN_W * 0.75, borderRadius: DESIGN.radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  suggestionCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  suggestionPriority: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%' },
  suggestionContent: { padding: 18, gap: 10 },
  suggestionIconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  suggestionIcon: { fontSize: 22 },
  suggestionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, lineHeight: 22 },
  suggestionDesc: { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  suggestionActionBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 4,
  },
  suggestionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Timeline ──
  timelineContainer: { marginBottom: DESIGN.spacing.xl },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1 },
  timelineLine: { position: 'absolute', top: 0, bottom: -12, width: 2, left: 11 },
  timelineCard: {
    flex: 1, borderRadius: DESIGN.radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  timelineCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  timelineCardContent: { padding: 14, gap: 6 },
  timelineCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineEmoji: { fontSize: 16 },
  timelineCardTitle: { flex: 1, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  timelineCardActor: { fontSize: 11, fontWeight: '500' },
  timelineEmpty: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  timelineEmptyText: { fontSize: 14, fontWeight: '500', marginTop: 8 },

  // ── Insights ──
  insightsContainer: { gap: 10, marginBottom: DESIGN.spacing.xl },
  insightItem: {
    borderRadius: DESIGN.radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row',
  },
  insightItemDark: { borderColor: 'rgba(255,255,255,0.08)' },
  insightLeftBorder: { width: 4 },
  insightContent: { flex: 1, padding: 14, gap: 8 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  insightIcon: { fontSize: 18 },
  insightHeaderText: { flex: 1, gap: 2 },
  insightTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  insightDescription: { fontSize: 13, fontWeight: '500', lineHeight: 19 },

  // ── Member Card ──
  memberCardWrapper: { marginBottom: DESIGN.spacing.md, borderRadius: DESIGN.radius.lg },
  memberCard: {
    borderRadius: DESIGN.radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  memberCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  memberCardPending: { borderColor: 'rgba(245,158,11,0.3)' },
  roleStrip: { height: 3, width: '100%' },
  memberCardContent: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  memberAvatarContainer: {
    width: 52, height: 52, borderRadius: DESIGN.radius.md,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  youBadge: {
    position: 'absolute', bottom: -4, right: -4, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 6, borderWidth: 2, borderColor: '#fff',
  },
  youBadgeText: { color: '#fff', fontSize: 7, fontWeight: '900' },
  onlineIndicator: {
    position: 'absolute', top: -2, right: -2, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2,
  },
  pendingIndicator: {
    position: 'absolute', top: -2, right: -2, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#f59e0b', borderWidth: 2,
  },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.2 },
  memberMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  roleBadgeSmall: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  roleBadgeSmallText: { color: '#fff', fontSize: 9, fontWeight: '800', marginLeft: 3 },
  memberRelationship: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  memberLastActive: { fontSize: 11, fontWeight: '500', color: '#94a3b8', marginTop: 3 },
  memberStateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  pendingText: { fontSize: 11, fontWeight: '600', color: '#f59e0b' },

  // ── Pending Invites ──
  pendingCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: DESIGN.radius.md,
    padding: 14, marginBottom: DESIGN.spacing.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pendingCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  pendingCardPartial: { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.05)' },
  pendingIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#f59e0b15',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  pendingInfo: { flex: 1 },
  pendingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingEmail: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.2 },
  pendingStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  pendingStatusText: { fontSize: 9, fontWeight: '700' },
  pendingSent: { fontSize: 11, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  pendingPartialText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: 8 },
  pendingAction: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center', justifyContent: 'center', padding: 24, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  emptyStateDark: { backgroundColor: 'rgba(30,30,35,0.5)' },
  emptyStateText: { fontSize: 14, fontWeight: '500', color: '#64748b', marginTop: 8 },
  addFirstMemberBtn: { marginTop: 12, paddingHorizontal: DESIGN.spacing.lg, paddingVertical: 8, borderRadius: 10 },
  addFirstMemberText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Permissions Tab ──
  permissionsHeaderCard: {
    borderRadius: DESIGN.radius.lg, padding: 16, marginBottom: 16,
  },
  permissionsHeaderTop: { flexDirection: 'row', alignItems: 'center' },
  permissionsHeaderIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  permissionsHeaderTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  permissionsHeaderSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  readOnlyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#f59e0b10',
  },
  readOnlyText: { color: '#f59e0b', fontSize: 11, fontWeight: '600', flex: 1 },

  permissionCard: {
    borderRadius: DESIGN.radius.lg, overflow: 'hidden', padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  permissionCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  permissionCardHeader: { flexDirection: 'row', alignItems: 'center' },
  permissionCardName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  permissionEmail: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  permissionYouBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  permissionYouText: { fontSize: 10, fontWeight: '800' },
  permissionRolePill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginLeft: 6,
  },
  permissionRoleText: { fontSize: 11, fontWeight: '700' },
  permissionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  permissionMetaText: { fontSize: 11, fontWeight: '500', color: '#94a3b8' },
  permissionPendingPill: {
    marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: '#f59e0b20',
  },
  permissionPendingText: { fontSize: 10, fontWeight: '700', color: '#f59e0b' },
  permissionChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  permissionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  permissionChipText: { fontSize: 11, fontWeight: '600' },
  permissionNoPerms: { fontSize: 11, fontStyle: 'italic', color: '#94a3b8' },
  permissionsFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 4,
  },
  permissionsFooterText: { fontSize: 11, fontWeight: '500', flex: 1, lineHeight: 16, color: '#94a3b8' },

  // ── Settings Tab ──
  settingsSummaryCard: {
    borderRadius: DESIGN.radius.lg, padding: 18, marginBottom: 16,
  },
  settingsSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  settingsSummaryItem: { alignItems: 'center', flex: 1 },
  settingsSummaryValue: { fontSize: 22, fontWeight: '800' },
  settingsSummaryLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 4 },
  settingsSummaryDivider: { width: 1, height: 36 },

  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: DESIGN.radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  settingsRowDark: { borderColor: 'rgba(255,255,255,0.08)' },
  settingsIconBg: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsRowTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  settingsRowSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },

  // ── Avatar ──
  avatarWrapper: { borderRadius: DESIGN.radius.md, overflow: 'hidden' },
  avatarGradient: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarEmoji: { fontSize: 28 },

  // ── Modal ──
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 20,
  },
  modalContent: {
    width: '90%', maxHeight: '85%', borderRadius: DESIGN.radius.xl,
    overflow: 'hidden', backgroundColor: '#fff',
  },
  modalContentDark: { backgroundColor: '#1a1a2e' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalScrollContent: { padding: 16 },

  // ── Member Detail ──
  memberDetailContent: { padding: 16 },
  memberDetailHeader: { alignItems: 'center', marginBottom: 20 },
  memberDetailRoleBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginTop: 12,
  },
  memberDetailRoleText: { color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  detailSection: { marginBottom: 20 },
  detailSectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#1a1a1a',
    marginBottom: 10, letterSpacing: -0.3,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailRowDark: { borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginLeft: 12 },
  detailActions: { gap: 10, marginTop: 10 },
  detailActionBtn: { borderRadius: 12, overflow: 'hidden' },
  detailActionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)', backgroundColor: 'rgba(255,255,255,0.5)',
  },
  detailActionSecondaryDark: {
    backgroundColor: 'rgba(30,30,35,0.5)', borderColor: 'rgba(255,255,255,0.08)',
  },
  detailActionSecondaryText: { fontSize: 15, fontWeight: '700' },
  detailActionDanger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8, borderRadius: 12, borderWidth: 1,
    borderColor: '#ff4757', backgroundColor: 'rgba(255,71,87,0.05)',
  },
  detailActionDangerText: { fontSize: 15, fontWeight: '700', color: '#ff4757' },

  // ── Edit Form ──
  editForm: { padding: 16 },
  editAvatarContainer: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  editAvatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  editAvatarOverlay: {
    position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff',
  },
  formGroup: { marginBottom: 16 },
  formLabel: {
    fontSize: 13, fontWeight: '700', color: '#1a1a1a',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  formInput: {
    fontSize: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)', color: '#1a1a1a', fontWeight: '500',
  },
  formInputDark: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  toggleRowDark: { borderBottomColor: 'rgba(255,255,255,0.05)' },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  toggleTextContainer: { marginLeft: 12 },
  toggleLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  toggleDescription: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  saveButton: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
  saveButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});