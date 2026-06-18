import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,           // ← ADD THIS
  StatusBar,
  StyleSheet,
  Switch,          // ← ADD THIS
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,  // ← ADD THIS
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  FadeInRight,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { UserRole, ROLE_LABELS } from '../../types/roles';
import { useFamily, FamilyMember } from '../../context/FamilyContext';
import { useUser } from '../../context/UserContext';
import { useBaby, ActivityEntry } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useMedia } from '../../context/MediaContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner, InlineSpinner } from '../../components/UniversalSpinner';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';

type EditGuardianScreenProps = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>;

// ─── SHARED DESIGN TOKENS ───────────────────────────────────────────
// ─── REDESIGNED DESIGN TOKENS ───────────────────────────────────────────
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
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const AnimatedScrollView = Animated.ScrollView;
const { width, height } = Dimensions.get('window');

// --- Constants ---
const ROLE_CONFIG: Record<UserRole, {
  label: string;
  color: string;
  gradient: [string, string];
  icon: string;
  description: string;
  permissions: string[];
  canEdit: boolean;
  canRemove: boolean;
  badge: string;
  priority: number;
}> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    icon: 'shield',
    description: 'Full owner access to everything',
    permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data', 'Billing'],
    canEdit: false,
    canRemove: false,
    badge: 'Owner',
    priority: 1,
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    icon: 'heart',
    description: 'Full access to manage family and baby data',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'],
    canEdit: true,
    canRemove: true,
    badge: 'Co-Parent',
    priority: 2,
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    icon: 'shield-checkmark',
    description: 'Can add entries but cannot delete or manage family',
    permissions: ['Read', 'Write', 'Limited Delete'],
    canEdit: true,
    canRemove: true,
    badge: 'Guardian',
    priority: 3,
  },
  [UserRole.VIEWER]: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    description: 'View only access, cannot add or modify data',
    permissions: ['Read Only'],
    canEdit: true,
    canRemove: true,
    badge: 'Viewer',
    priority: 4,
  },
};

const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; label: string; emoji: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty', emoji: '🚽' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding', emoji: '🍼' },
  sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep', emoji: '😴' },
  growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth', emoji: '📏' },
  medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication', emoji: '💊' },
  milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone', emoji: '🌟' },
  diaper: { icon: 'layers-outline', color: '#3b82f6', label: 'Diaper', emoji: '🧷' },
  note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note', emoji: '📝' },
  default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity', emoji: '✨' },
};

const EMOJI_OPTIONS = ['👤', '👩', '👨', '👵', '👴', '👶', '👧', '👦', '🧑', '👮', '👩‍⚕️', '👨‍⚕️', '👩‍🏫', '👨‍🏫', '👩‍🍳', '👨‍🍳', '👩‍⚖️', '👨‍⚖️', '👩‍🌾', '👨‍🌾'];

// --- Components ---

const GlassCard = memo(({ children, style, onPress, active = false }: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean 
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={[
      styles.glassCard,
      active && { borderColor: '#667eea', borderWidth: 2 },
      style
    ]}>
      <LinearGradient
        colors={isDark 
          ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] 
          : ['rgba(255,255,255,0.92)', 'rgba(250,250,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { 
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)' 
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View entering={FadeInUp.delay(delay)} layout={Layout.springify()} style={[styles.glassCard, style]}>
      <Wrapper onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
};

const StatBadge: React.FC<{ icon: string; value: number | string; label: string; color: string }> = ({
  icon, value, label, color
}) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: `${color}20` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}> = ({ visible, onClose, title, children, isDark }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Animated.View entering={FadeInUp} style={[styles.modalContent, isDark && styles.modalContentDark]}>
          <LinearGradient
            colors={isDark ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1a1a1a' }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const ActivityCard: React.FC<{
  activity: ActivityEntry;
  isDark: boolean;
  index: number;
  reduceMotion: boolean;
}> = ({ activity, isDark, index, reduceMotion }) => {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
  return (
    <GlassmorphismCard style={styles.activityItemCard} intensity={85} delay={index * 50}>
      <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}>
        <Text style={styles.activityEmoji}>{config.emoji}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityTitle, isDark && styles.textDark]}>{activity.title || config.label}</Text>
        {activity.details && <Text style={styles.activityDetails} numberOfLines={2}>{activity.details}</Text>}
        <Text style={styles.activityTime}>
          {new Date(activity.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View style={[styles.activityTypeBadge, { backgroundColor: `${config.color}15` }]}>
        <Text style={[styles.activityTypeText, { color: config.color }]}>{config.label}</Text>
      </View>
    </GlassmorphismCard>
  );
};

const PermissionGrid: React.FC<{
  permissions: string[];
  roleColor: string;
  isDark: boolean;
  reduceMotion: boolean;
}> = ({ permissions, roleColor, isDark, reduceMotion }) => {
  return (
    <View style={styles.permissionGrid}>
      {permissions.map((permission, index) => (
        <Animated.View
          key={permission}
          entering={reduceMotion ? undefined : FadeIn.delay(index * 50)}
          style={[styles.permissionChip, { backgroundColor: `${roleColor}15`, borderColor: `${roleColor}30` }]}
        >
          <Ionicons name="checkmark-circle" size={14} color={roleColor} />
          <Text style={[styles.permissionChipText, { color: roleColor }]}>{permission}</Text>
        </Animated.View>
      ))}
    </View>
  );
};

const SectionHeader = memo(({ title, subtitle, action, actionLabel }: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction}>
          <Text style={[styles.sectionActionText, { color: '#667eea' }]}>{actionLabel || 'See All'}</Text>
          <Ionicons name="chevron-forward" size={14} color="#667eea" />
        </TouchableOpacity>
      )}
    </View>
  );
});


const ProfileTabBar = memo(({ tabs, activeTab, onChange }: { 
  tabs: { key: string; label: string; icon: string }[]; 
  activeTab: string; 
  onChange: (t: string) => void;
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.tabBar, { 
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' 
    }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[
              styles.tabItem,
              isActive && { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#fff',
                ...DESIGN.shadow.sm 
              }
            ]}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={16} 
              color={isActive ? '#667eea' : (isDark ? '#94a3b8' : '#64748b')} 
            />
            <Text style={[
              styles.tabLabel,
              { color: isActive ? '#667eea' : (isDark ? '#94a3b8' : '#64748b') },
              isActive && { fontWeight: '700' }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});


const AIHealthCompanion = memo(({ member, isDark }: { member: FamilyMember | null; isDark: boolean }) => {
  const [healthScore, setHealthScore] = useState(85);
  const [tips, setTips] = useState([
    { icon: '💧', text: 'Stay hydrated - drink 8 glasses today', priority: 'high' },
    { icon: '😴', text: 'You slept 7.2h avg - aim for 8h', priority: 'medium' },
    { icon: '🚶', text: '3,240 steps - try a family walk', priority: 'low' },
  ]);

  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <GlassCard>
        <View style={styles.aiCompanionHeader}>
          <View style={[styles.aiCompanionIconBg, { backgroundColor: '#667eea15' }]}>
            <Ionicons name="sparkles" size={20} color="#667eea" />
          </View>
          <View style={styles.aiCompanionTitleWrap}>
            <Text style={[styles.aiCompanionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
              AI Health Companion
            </Text>
            <Text style={[styles.aiCompanionSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Personalized for {member?.fullName || 'you'}
            </Text>
          </View>
          <View style={[styles.healthScoreRing, { borderColor: `${healthScore > 70 ? '#10b981' : '#f59e0b'}30` }]}>
            <Text style={[styles.healthScoreValue, { color: healthScore > 70 ? '#10b981' : '#f59e0b' }]}>
              {healthScore}
            </Text>
          </View>
        </View>

        <View style={styles.tipsList}>
          {tips.map((tip, i) => (
            <View key={i} style={[styles.tipItem, i < tips.length - 1 && { 
              borderBottomWidth: 1, 
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' 
            }]}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={[styles.tipText, { color: isDark ? '#e2e8f0' : '#334155' }]}>{tip.text}</Text>
              <View style={[styles.tipPriorityBadge, { 
                backgroundColor: tip.priority === 'high' ? '#ef444415' : tip.priority === 'medium' ? '#f59e0b15' : '#10b98115' 
              }]}>
                <Text style={[styles.tipPriorityText, { 
                  color: tip.priority === 'high' ? '#ef4444' : tip.priority === 'medium' ? '#f59e0b' : '#10b981' 
                }]}>
                  {tip.priority}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});


const SmartActivityTimeline = memo(({ activities, isDark, reduceMotion }: { 
  activities: ActivityEntry[]; 
  isDark: boolean; 
  reduceMotion: boolean;
}) => {
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    activities.forEach(act => {
      const date = new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(act);
    });
    return Object.entries(groups).slice(0, 3);
  }, [activities]);

  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <SectionHeader 
        title="Activity Timeline" 
        subtitle={`${activities.length} recent activities`}
        action={() => {}}
        actionLabel="View All"
      />

      <View style={styles.timelineContainer}>
        {groupedActivities.map(([date, acts], groupIndex) => (
          <View key={date} style={styles.timelineGroup}>
            <View style={styles.timelineDateHeader}>
              <View style={[styles.timelineDot, { backgroundColor: '#667eea' }]} />
              <Text style={[styles.timelineDate, { color: isDark ? '#94a3b8' : '#64748b' }]}>{date}</Text>
              <View style={[styles.timelineLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
            </View>

            {acts.map((act, i) => {
              const config = ACTIVITY_CONFIG[act.type] || ACTIVITY_CONFIG.default;
              return (
                <Animated.View 
                  key={act.id} 
                  entering={reduceMotion ? undefined : FadeInRight.delay(i * 60).springify()}
                  style={styles.timelineItem}
                >
                  <View style={[styles.timelineItemIcon, { backgroundColor: `${config.color}15` }]}>
                    <Text style={styles.timelineItemEmoji}>{config.emoji}</Text>
                  </View>
                  <View style={styles.timelineItemContent}>
                    <Text style={[styles.timelineItemTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                      {act.title || config.label}
                    </Text>
                    <Text style={[styles.timelineItemTime, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {new Date(act.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.timelineItemBadge, { backgroundColor: `${config.color}12` }]}>
                    <Text style={[styles.timelineItemBadgeText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    </Animated.View>
  );
});


const FamilyConnectionMap = memo(({ member, members, isDark }: { 
  member: FamilyMember | null; 
  members: FamilyMember[]; 
  isDark: boolean;
}) => {
  const connections = useMemo(() => {
    return members
      .filter(m => m.id !== member?.id)
      .map(m => ({
        ...m,
        connectionStrength: Math.floor(Math.random() * 40) + 60, // Simulated
        lastInteraction: `${Math.floor(Math.random() * 7) + 1}d ago`,
      }));
  }, [members, member]);

  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <SectionHeader 
        title="Family Connections" 
        subtitle={`${connections.length} connected members`}
      />

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.connectionsScroll}
      >
        {connections.map((conn, i) => {
          const roleConfig = ROLE_CONFIG[conn.role] || ROLE_CONFIG[UserRole.VIEWER];
          return (
            <TouchableOpacity key={conn.id} style={[styles.connectionCard, { 
              backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)' 
            }]}>
              <LinearGradient
                colors={[`${roleConfig.color}15`, `${roleConfig.color}05`]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <SafeAvatar 
                avatar={conn.avatar} 
                size={48} 
                fallbackIcon={roleConfig.icon as any} 
                fallbackColor={roleConfig.color}
                borderColor={roleConfig.color}
                borderWidth={2}
              />
              <Text style={[styles.connectionName, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
                {conn.fullName}
              </Text>
              <Text style={[styles.connectionRole, { color: roleConfig.color }]}>{roleConfig.label}</Text>

              <View style={styles.connectionStrengthBar}>
                <View style={[styles.connectionStrengthBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
                  <View style={[styles.connectionStrengthFill, { 
                    width: `${conn.connectionStrength}%`, 
                    backgroundColor: conn.connectionStrength > 80 ? '#10b981' : conn.connectionStrength > 50 ? '#f59e0b' : '#ef4444' 
                  }]} />
                </View>
                <Text style={[styles.connectionStrengthText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {conn.connectionStrength}% connected
                </Text>
              </View>

              <Text style={[styles.lastInteraction, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                Last: {conn.lastInteraction}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});


const AchievementBadgeSystem = memo(({ member, isDark }: { 
  member: FamilyMember | null; 
  isDark: boolean;
}) => {
  const achievements = useMemo(() => [
    { id: '1', icon: '🏆', title: 'Super Parent', desc: 'Logged 30+ activities', color: '#f59e0b', unlocked: true },
    { id: '2', icon: '🔥', title: 'Streak Master', desc: '7-day activity streak', color: '#ef4444', unlocked: true },
    { id: '3', icon: '💚', title: 'Health Guardian', desc: 'Tracked all vitals', color: '#10b981', unlocked: true },
    { id: '4', icon: '📸', title: 'Memory Keeper', desc: 'Added 50+ photos', color: '#6366f1', unlocked: false },
    { id: '5', icon: '🤝', title: 'Team Player', desc: 'Coordinated with 3+ family', color: '#ec4899', unlocked: false },
    { id: '6', icon: '⭐', title: 'Milestone Hero', desc: 'Recorded 10 milestones', color: '#8b5cf6', unlocked: false },
  ], []);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader 
        title="Achievements" 
        subtitle={`${unlockedCount}/${achievements.length} unlocked`}
        action={() => {}}
        actionLabel="View All"
      />

      <View style={styles.achievementsGrid}>
        {achievements.map((badge, i) => (
          <TouchableOpacity 
            key={badge.id} 
            style={[styles.achievementCard, { 
              backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
              opacity: badge.unlocked ? 1 : 0.5,
            }]}
          >
            <View style={[styles.achievementIconBg, { 
              backgroundColor: badge.unlocked ? `${badge.color}20` : 'rgba(100,116,139,0.08)' 
            }]}>
              <Text style={[styles.achievementIcon, { opacity: badge.unlocked ? 1 : 0.4 }]}>{badge.icon}</Text>
            </View>
            <Text style={[styles.achievementTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
              {badge.title}
            </Text>
            <Text style={[styles.achievementDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
              {badge.desc}
            </Text>
            {!badge.unlocked && (
              <View style={styles.achievementLock}>
                <Ionicons name="lock-closed" size={14} color={isDark ? '#64748b' : '#94a3b8'} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});


const PersonalizedInsightsFeed = memo(({ member, isDark, reduceMotion }: { 
  member: FamilyMember | null; 
  isDark: boolean; 
  reduceMotion: boolean;
}) => {
  const insights = useMemo(() => [
    { 
      id: '1', 
      type: 'pattern', 
      title: 'Activity Pattern Detected', 
      desc: `${member?.fullName || 'You'} are most active between 9-11 AM. Consider scheduling important tasks then.`,
      emoji: '📊',
      color: '#6366f1',
      priority: 'medium'
    },
    { 
      id: '2', 
      type: 'suggestion', 
      title: 'Family Time Suggestion', 
      desc: 'Weekend family activity: Try a nature walk or park visit. Great for bonding and physical health.',
      emoji: '🌳',
      color: '#10b981',
      priority: 'low'
    },
    { 
      id: '3', 
      type: 'alert', 
      title: 'Health Reminder', 
      desc: 'It has been 5 days since the last growth measurement. Consider updating measurements.',
      emoji: '⏰',
      color: '#f59e0b',
      priority: 'high'
    },
    { 
      id: '4', 
      type: 'milestone', 
      title: 'Upcoming Milestone', 
      desc: 'Baby is approaching the 6-month mark. Prepare for solid food introduction.',
      emoji: '🍼',
      color: '#ec4899',
      priority: 'medium'
    },
  ], [member]);

  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader 
        title="Smart Insights" 
        subtitle={`${insights.filter(i => i.priority === 'high').length} need attention`}
      />

      {insights.map((insight, i) => (
        <Animated.View 
          key={insight.id}
          entering={reduceMotion ? undefined : FadeInUp.delay(i * 60).springify()}
        >
          <TouchableOpacity style={[styles.insightCard, { 
            backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)',
            borderLeftWidth: 3,
            borderLeftColor: insight.color,
          }]}>
            <View style={styles.insightRow}>
              <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
                <Text style={styles.insightEmoji}>{insight.emoji}</Text>
              </View>
              <View style={styles.insightContent}>
                <View style={styles.insightHeader}>
                  <Text style={[styles.insightTitle, { color: isDark ? '#fff' : '#1e293b' }]} numberOfLines={1}>
                    {insight.title}
                  </Text>
                  <View style={[styles.insightPriorityDot, { backgroundColor: insight.color }]} />
                </View>
                <Text style={[styles.insightDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>
                  {insight.desc}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748b' : '#94a3b8'} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.View>
  );
});


const QuickActionShortcuts = memo(({ member, isDark, onAction }: { 
  member: FamilyMember | null; 
  isDark: boolean;
  onAction: (action: string) => void;
}) => {
  const actions = useMemo(() => [
    { id: 'message', icon: 'chatbubble', label: 'Message', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
    { id: 'call', icon: 'call', label: 'Call', color: '#10b981', gradient: ['#10b981', '#34d399'] },
    { id: 'share', icon: 'share', label: 'Share', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] },
    { id: 'edit', icon: 'create', label: 'Edit', color: '#ec4899', gradient: ['#ec4899', '#f472b6'] },
    { id: 'role', icon: 'shield', label: 'Role', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'] },
    { id: 'remove', icon: 'trash', label: 'Remove', color: '#ef4444', gradient: ['#ef4444', '#f87171'] },
  ], []);

  return (
    <Animated.View entering={FadeInUp.delay(450).springify()}>
      <SectionHeader title="Quick Actions" subtitle="Tap to perform" />

      <View style={styles.quickActionsGrid}>
        {actions.map((action, i) => (
          <TouchableOpacity 
            key={action.id}
            onPress={() => onAction(action.id)}
            style={styles.quickActionItem}
          >
            <LinearGradient 
              colors={action.gradient as [string, string]} 
              style={styles.quickActionGradient}
            >
              <Ionicons name={action.icon as any} size={22} color="#fff" />
            </LinearGradient>
            <Text style={[styles.quickActionLabel, { color: isDark ? '#e2e8f0' : '#334155' }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});


// --- Main Screen ---

export default function EditGuardianScreen({ navigation, route }: EditGuardianScreenProps) {
  const { guardianId, mode = 'guardian', fromChat = false } = route.params;
  const { members, guardians, updateGuardianProfile, removeMember, loadFamily } = useFamily();
  const { hasPermission, profile, updateProfile } = useUser();
  const { currentBaby, babies, getRecentActivities } = useBaby();
  const { userProfile } = useAuth();
  const { themeColors, shouldReduceMotion, triggerHaptic, fullThemeColors } = useCustomization();
  const { pickImage, compressImage, cacheImage, deleteImage } = useMedia();
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  // --- State ---
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'activity' | 'permissions' | 'danger'>('info');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [memberActivities, setMemberActivities] = useState<ActivityEntry[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '', email: '', phoneNumber: '', relationship: '', avatar: '',
    notificationsEnabled: true, darkMode: false,
  });

  const [originalData, setOriginalData] = useState({
    fullName: '', email: '', phoneNumber: '', relationship: '', avatar: '',
    notificationsEnabled: true,
  });

  const dynamicPrimaryColor = themeColors.primary;
  const dynamicGradient = [themeColors.primary, themeColors.secondary] as [string, string];

  // Animated header
  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], Extrapolate.CLAMP),
  }));
  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [80, 140], [-10, 0], Extrapolate.CLAMP) }],
  }));

  // --- Effects ---
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  useEffect(() => {
    const findMember = async () => {
      setIsLoading(true);
      let found = members.find(m => m.id === guardianId);
      if (!found) {
        const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
        if (guardianId === currentUserId || guardianId === 'parent1') {
          found = {
            id: currentUserId || 'parent1', userId: currentUserId || 'parent1',
            fullName: userProfile?.fullName || profile?.fullName || 'Primary Parent',
            email: userProfile?.email || profile?.email || '',
            phoneNumber: userProfile?.phoneNumber || profile?.phoneNumber || '',
            avatar: userProfile?.avatar || profile?.avatar || '',
            role: UserRole.PARENT_1, relationship: 'Parent',
            addedAt: new Date().toISOString(), lastActive: new Date().toISOString(),
            notificationsEnabled: true, canBeRemove: false, canEdit: false,
          } as FamilyMember;
        }
      }
      if (found) {
        setMember(found);
        const initialData = {
          fullName: found.fullName || '', email: found.email || '',
          phoneNumber: found.phoneNumber || '', relationship: found.relationship || '',
          avatar: found.avatar || '', notificationsEnabled: found.notificationsEnabled ?? true, darkMode: false,
        };
        setFormData(initialData);
        setOriginalData(initialData);
        if (currentBaby) await loadMemberActivities(found.id, found.userId);
      } else {
        sweetAlert.error('Member Not Found', 'The requested family member could not be found.');
      }
      setIsLoading(false);
    };
    findMember();
  }, [members, guardianId, currentBaby, userProfile, profile, sweetAlert]);

  const loadMemberActivities = useCallback(async (memberId: string, memberUserId?: string) => {
    if (!currentBaby) return;
    setIsLoadingActivities(true);
    try {
      const allActivities = getRecentActivities(50);
      const memberActs = allActivities.filter(a => {
        if (a.loggedBy === memberId) return true;
        if (memberUserId && a.loggedBy === memberUserId) return true;
        if (member && a.loggedByName === member.fullName) return true;
        return false;
      });
      setMemberActivities(memberActs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20));
    } catch (error) {
      console.error('Error loading member activities:', error);
      setMemberActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [currentBaby, getRecentActivities, member]);

  // --- Handlers ---
  const handleSave = async () => {
    if (!member) return;
    if (!formData.fullName.trim()) { sweetAlert.error('Validation Error', 'Name is required'); triggerHaptic('error'); return; }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      sweetAlert.error('Validation Error', 'Please enter a valid email address'); triggerHaptic('error'); return;
    }
    setIsSaving(true); triggerHaptic('medium');
    const updates: Partial<FamilyMember> = {};
    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    const isCurrentUser = member.id === currentUserId;
    if (!isCurrentUser && formData.fullName !== originalData.fullName) updates.fullName = formData.fullName.trim();
    if (formData.email !== originalData.email) updates.email = formData.email.trim();
    if (formData.phoneNumber !== originalData.phoneNumber) updates.phoneNumber = formData.phoneNumber.trim();
    if (formData.relationship !== originalData.relationship) updates.relationship = formData.relationship.trim();
    if (formData.avatar !== originalData.avatar) updates.avatar = formData.avatar;
    if (formData.notificationsEnabled !== originalData.notificationsEnabled) updates.notificationsEnabled = formData.notificationsEnabled;
    if (Object.keys(updates).length === 0) {
      sweetAlert.toast('No Changes', 'No changes were made'); setIsEditing(false); setIsSaving(false); return;
    }
    try {
      if (isCurrentUser) {
        try { await updateProfile({ phoneNumber: formData.phoneNumber, email: formData.email, avatar: formData.avatar }); }
        catch (err) { console.log('UserContext update failed'); }
      }
      const success = await updateGuardianProfile(member.id, updates);
      if (success) {
        triggerHaptic('success'); setIsEditing(false);
        setMember(prev => prev ? { ...prev, ...updates } : null);
        setOriginalData({ fullName: formData.fullName, email: formData.email, phoneNumber: formData.phoneNumber, relationship: formData.relationship, avatar: formData.avatar, notificationsEnabled: formData.notificationsEnabled });
        sweetAlert.success('Profile Updated', 'All changes saved successfully');
      } else { triggerHaptic('error'); sweetAlert.error('Save Failed', 'Please try again.'); }
    } catch (error) { triggerHaptic('error'); sweetAlert.error('Error', 'An unexpected error occurred'); }
    setIsSaving(false);
  };

  const handleRemove = () => {
    if (!member) return;
    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    if (member.id === currentUserId) { sweetAlert.alert('Cannot Remove', 'You cannot remove yourself.', 'warning'); return; }
    if (!hasPermission('manageFamily')) { sweetAlert.error('Permission Denied', 'Only parents can remove members'); triggerHaptic('error'); return; }
    sweetAlert.confirm('Remove Family Member', `Remove ${member.fullName}? Their history will be preserved but they will lose access.`,
      async () => {
        triggerHaptic('error'); const success = await removeMember(member.id);
        if (success) { triggerHaptic('success'); sweetAlert.success('Member Removed', `${member.fullName} has been removed`); navigation.goBack(); }
        else sweetAlert.error('Error', 'Failed to remove family member');
      }, () => {}, 'Remove', 'Cancel'
    );
  };

  const handleImagePick = async () => {
    setShowImagePicker(false);
    try {
      triggerHaptic('light');
      const uri = await pickImage({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!uri) { sweetAlert.toast('No Image Selected', 'You did not select an image'); return; }
      setIsSaving(true);
      let processedUri = uri;
      try { processedUri = await compressImage(uri, 0.8); } catch (e) {}
      try { processedUri = await cacheImage(processedUri); } catch (e) {}
      setFormData(prev => ({ ...prev, avatar: processedUri }));
      if (!isEditing && member) {
        const success = await updateGuardianProfile(member.id, { avatar: processedUri });
        if (success) { setMember(prev => prev ? { ...prev, avatar: processedUri } : null); setOriginalData(prev => ({ ...prev, avatar: processedUri })); sweetAlert.success('Photo Updated', 'Profile picture updated'); }
      }
      triggerHaptic('success');
    } catch (error) { sweetAlert.error('Error', 'Failed to process image'); }
    finally { setIsSaving(false); }
  };

  const handleTakePhoto = async () => {
    setShowImagePicker(false);
    try { triggerHaptic('light'); const uri = await pickImage({ allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (uri) setFormData(prev => ({ ...prev, avatar: uri })); }
    catch (error) { sweetAlert.error('Error', 'Failed to take photo'); }
  };

  const handleRemoveAvatar = async () => {
    setShowImagePicker(false);
    if (!formData.avatar) return;
    sweetAlert.confirm('Remove Photo', 'Remove profile picture?', async () => {
      if (formData.avatar) { try { await deleteImage(formData.avatar); } catch (e) {} }
      setFormData(prev => ({ ...prev, avatar: '' }));
      if (!isEditing && member) { await updateGuardianProfile(member.id, { avatar: '' }); setMember(prev => prev ? { ...prev, avatar: '' } : null); }
      sweetAlert.success('Photo Removed', 'Profile picture removed');
    }, () => {}, 'Remove', 'Cancel');
  };

  const handleEmojiSelect = (emoji: string) => {
    setFormData(prev => ({ ...prev, avatar: emoji }));
    setShowEmojiPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!isEditing && member) {
      updateGuardianProfile(member.id, { avatar: emoji }).then(success => {
        if (success) { setMember(prev => prev ? { ...prev, avatar: emoji } : null); setOriginalData(prev => ({ ...prev, avatar: emoji })); }
      });
    }
  };

  const handleCall = async () => {
    if (!member?.phoneNumber) { sweetAlert.alert('No Phone Number', 'No phone number on file.', 'warning'); return; }
    const phoneUrl = `tel:${member.phoneNumber.replace(/\s/g, '')}`;
    if (await Linking.canOpenURL(phoneUrl)) { triggerHaptic('medium'); await Linking.openURL(phoneUrl); } else sweetAlert.error('Error', 'Cannot open phone app');
    setShowContactModal(false);
  };

  const handleEmail = async () => {
    if (!member?.email) { sweetAlert.alert('No Email', 'No email on file.', 'warning'); return; }
    const emailUrl = `mailto:${member.email}`;
    if (await Linking.canOpenURL(emailUrl)) { triggerHaptic('medium'); await Linking.openURL(emailUrl); } else sweetAlert.error('Error', 'Cannot open email app');
    setShowContactModal(false);
  };

  const handleMessage = async () => {
    if (!member?.phoneNumber) { sweetAlert.alert('No Phone Number', 'No phone number for messaging.', 'warning'); return; }
    const smsUrl = `sms:${member.phoneNumber.replace(/\s/g, '')}`;
    if (await Linking.canOpenURL(smsUrl)) { triggerHaptic('medium'); await Linking.openURL(smsUrl); } else sweetAlert.error('Error', 'Cannot open messaging app');
    setShowContactModal(false);
  };

  const handleShareContact = async () => {
    if (!member) return;
    try { triggerHaptic('medium'); await Share.share({ message: `${member.fullName} - ${ROLE_LABELS[member.role] || member.role}\n${member.email || ''}\n${member.phoneNumber || ''}`, title: `${member.fullName}'s Contact Info` }); }
    catch (error) { console.error('Error sharing contact:', error); }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    if (!member || !hasPermission('manageFamily')) return;
    if (member.role === newRole) { setShowRoleModal(false); return; }
    const roleConfig = ROLE_CONFIG[newRole];
    sweetAlert.confirm('Change Role', `Change ${member.fullName} to ${roleConfig.label}?`, async () => {
      setIsSaving(true);
      try { const success = await updateGuardianProfile(member.id, { role: newRole }); if (success) { setMember(prev => prev ? { ...prev, role: newRole } : null); sweetAlert.success('Role Updated', `${member.fullName} is now a ${roleConfig.label}`); } else sweetAlert.error('Error', 'Failed to update role'); }
      catch (error) { sweetAlert.error('Error', 'An error occurred'); }
      setIsSaving(false); setShowRoleModal(false);
    }, () => setShowRoleModal(false), 'Change', 'Cancel');
  };

  // --- Derived Values ---
  const getRoleConfig = () => { if (!member) return null; return ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER]; };
  const roleConfig = getRoleConfig();
  const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
  const isCurrentUser = member?.id === currentUserId;
  const canEdit = useMemo(() => { if (isCurrentUser) return true; return hasPermission('manageFamily') && roleConfig?.canEdit; }, [hasPermission, roleConfig, isCurrentUser]);
  const canRemove = useMemo(() => hasPermission('manageFamily') && roleConfig?.canRemove && !isCurrentUser, [hasPermission, roleConfig, isCurrentUser]);
  const canManagePermissions = useMemo(() => hasPermission('manageFamily') && !isCurrentUser, [hasPermission, isCurrentUser]);
  const hasChanges = useMemo(() => formData.fullName !== originalData.fullName || formData.email !== originalData.email || formData.phoneNumber !== originalData.phoneNumber || formData.relationship !== originalData.relationship || formData.avatar !== originalData.avatar || formData.notificationsEnabled !== originalData.notificationsEnabled, [formData, originalData]);

  // --- Scroll Handler ---
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (event) => { 'worklet';
      scrollY.value = event.contentOffset.y; } });

  // --- Emoji Picker ---
  const EmojiPicker = () => {
    if (!showEmojiPicker) return null;
    return (
      <View style={styles.emojiPickerOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
        <View style={[styles.emojiPickerSheet, isDark && styles.emojiPickerSheetDark]}>
          <View style={styles.emojiPickerHeader}>
            <Text style={[styles.emojiPickerTitle, isDark && styles.textDark]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => handleEmojiSelect(emoji)}>
                <Text style={styles.emojiButtonText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // --- RENDER SECTIONS ---

  const renderStickyHeader = () => (
    <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient colors={isDark ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)'] : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        <View style={styles.stickyHeaderCenter}>
          <SafeAvatar avatar={formData.avatar || member?.avatar} size={32} fallbackIcon={roleConfig?.icon as any || 'person'} fallbackColor={roleConfig?.color || '#667eea'} animated={false} />
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>{member?.fullName || 'Family Member'}</Text>
        </View>
        <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)} style={[styles.saveBtn, (!canEdit || isSaving) && styles.saveBtnDisabled]} disabled={!canEdit || isSaving} activeOpacity={0.8}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>{isEditing ? 'Save' : 'Edit'}</Text>}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderProfileHero = () => {
    if (!member || !roleConfig) return null;
    return (
      <Animated.View entering={FadeInUp} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => canEdit && setShowImagePicker(true)} disabled={!canEdit}>
              <SafeAvatar avatar={formData.avatar || member.avatar} size={100} fallbackIcon={roleConfig.icon as any} fallbackColor={roleConfig.color} fallbackBgColor={`${roleConfig.color}20`} borderColor={roleConfig.color} borderWidth={3} showEditBadge={canEdit} onPress={() => canEdit && setShowImagePicker(true)} animated={!shouldReduceMotion} />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.textDark]}>{member.fullName}</Text>
            <Text style={styles.profileMeta}>{roleConfig.label} - {member.relationship || 'Family Member'}</Text>
            <View style={styles.profileTags}>
              <View style={[styles.profileTag, { backgroundColor: `${roleConfig.color}20` }]}>
                <Ionicons name={roleConfig.icon as any} size={12} color={roleConfig.color} />
                <Text style={[styles.profileTagText, { color: roleConfig.color }]}>{roleConfig.badge}</Text>
              </View>
              {isEditing && (
                <View style={[styles.profileTag, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <View style={styles.editingDot} />
                  <Text style={[styles.profileTagText, { color: '#f59e0b' }]}>Editing</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.editToggleBtn} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        {[
          { id: 'info', icon: 'person-outline', label: 'Info' },
          { id: 'activity', icon: 'time-outline', label: 'Activity' },
          { id: 'permissions', icon: 'shield-outline', label: 'Access' },
          { id: 'danger', icon: 'warning-outline', label: 'Danger', color: '#ef4444' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const isDanger = tab.id === 'danger';
          return (
            <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab.id as typeof activeTab); }}>
              <View style={[styles.tabBg, isActive && { backgroundColor: isDanger ? 'rgba(239,68,68,0.15)' : (isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)') }, isDanger && isActive && { borderColor: '#ef4444', borderWidth: 1 }]}>
                <Ionicons name={tab.icon as any} size={18} color={isActive ? (isDanger ? '#ef4444' : '#667eea') : (isDark ? '#94a3b8' : '#64748b')} />
                <Text style={[styles.tabLabel, isActive && (isDanger ? styles.tabLabelDanger : styles.tabLabelActive), isDark && !isActive && styles.textMuted]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderQuickStats = () => (
    <GlassmorphismCard style={styles.statsCard} intensity={80} delay={100}>
      <View style={styles.statsRow}>
        <StatBadge icon="📊" value={memberActivities.length} label="Activities" color="#667eea" />
        <StatBadge icon="🔥" value={member?.streak || 0} label="Day Streak" color="#fa709a" />
        <StatBadge icon="⭐" value={roleConfig?.priority || 0} label="Priority" color={roleConfig?.color || '#667eea'} />
      </View>
    </GlassmorphismCard>
  );

  const renderInfoTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      {renderQuickStats()}
      <GlassmorphismCard style={styles.formCard} intensity={90} delay={200}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Contact Information</Text>
          {!isEditing ? (
            <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}><Ionicons name="create-outline" size={20} color="#667eea" /></TouchableOpacity>
          ) : (
            <View style={styles.editingBadge}><Text style={styles.editingBadgeText}>Editing</Text></View>
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Full Name</Text>
          {isCurrentUser ? (
            <View style={[styles.inputContainer, isDark && styles.inputContainerDark, styles.inputDisabled]}>
              <Ionicons name="lock-closed" size={20} color="#667eea" style={styles.inputIcon} />
              <Text style={[styles.input, isDark && styles.inputDark]}>{formData.fullName}</Text>
              <View style={[styles.ownedBadge, { backgroundColor: dynamicPrimaryColor }]}><Text style={styles.ownedBadgeText}>You</Text></View>
            </View>
          ) : (
            <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
              <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput style={[styles.input, styles.flexInput, isDark && styles.inputDark]} value={formData.fullName} onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))} placeholder="Enter full name" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} selectionColor={themeColors.primary} />
            </View>
          )}
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Email</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput style={[styles.input, styles.flexInput, isDark && styles.inputDark]} value={formData.email} onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))} placeholder="Enter email address" placeholderTextColor={isDark ? '#666' : '#999'} keyboardType="email-address" autoCapitalize="none" editable={isEditing} selectionColor={themeColors.primary} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Phone Number</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="call-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput style={[styles.input, styles.flexInput, isDark && styles.inputDark]} value={formData.phoneNumber} onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))} placeholder="Enter phone number" placeholderTextColor={isDark ? '#666' : '#999'} keyboardType="phone-pad" editable={isEditing} selectionColor={themeColors.primary} />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Relationship</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="people-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput style={[styles.input, styles.flexInput, isDark && styles.inputDark]} value={formData.relationship} onChangeText={(text) => setFormData(prev => ({ ...prev, relationship: text }))} placeholder="e.g., Grandma, Uncle, Nanny" placeholderTextColor={isDark ? '#666' : '#999'} editable={isEditing} selectionColor={themeColors.primary} />
          </View>
        </View>
        {isEditing && (
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <Ionicons name={formData.notificationsEnabled ? "notifications" : "notifications-off"} size={22} color={formData.notificationsEnabled ? dynamicPrimaryColor : (isDark ? '#94a3b8' : '#64748b')} />
              <View style={styles.preferenceText}>
                <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Notifications</Text>
                <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Receive alerts about family activities</Text>
              </View>
            </View>
            <Switch value={formData.notificationsEnabled} onValueChange={(val) => setFormData(prev => ({ ...prev, notificationsEnabled: val }))} trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: dynamicPrimaryColor }} thumbColor="#fff" />
          </View>
        )}
      </GlassmorphismCard>

      <GlassmorphismCard style={styles.formCard} intensity={90} delay={300}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Activity Summary</Text>
        </View>
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, { backgroundColor: `${dynamicPrimaryColor}20` }]}><Ionicons name="time-outline" size={20} color={dynamicPrimaryColor} /></View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Last Active</Text>
            <Text style={[styles.infoValue, isDark && styles.textDark]}>{member?.lastActive ? new Date(member.lastActive).toLocaleString() : 'Never logged in'}</Text>
          </View>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, { backgroundColor: '#10b98120' }]}><Ionicons name="calendar-outline" size={20} color="#10b981" /></View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Added On</Text>
            <Text style={[styles.infoValue, isDark && styles.textDark]}>{member?.addedAt ? new Date(member.addedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}</Text>
          </View>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, { backgroundColor: '#f59e0b20' }]}><Ionicons name="shield-checkmark-outline" size={20} color="#f59e0b" /></View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Security Status</Text>
            <View style={styles.securityStatus}><View style={[styles.statusDot, { backgroundColor: '#10b981' }]} /><Text style={[styles.infoValue, isDark && styles.textDark]}>Verified Account</Text></View>
          </View>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, { backgroundColor: `${roleConfig?.color || '#667eea'}20` }]}><Ionicons name={roleConfig?.icon as any || 'shield'} size={20} color={roleConfig?.color || '#667eea'} /></View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Role Assignment</Text>
            <Text style={[styles.infoValue, { color: roleConfig?.color || '#667eea' }]}>{roleConfig?.label || 'Unknown'}</Text>
          </View>
        </View>
      </GlassmorphismCard>

      {!isEditing && (
        <View style={styles.quickActionsRow}>
          {!isCurrentUser && (
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('FamilyChat' as never, { memberId: member?.id, memberName: member?.fullName, memberAvatar: member?.avatar, memberRole: member?.role })}>
              <LinearGradient colors={roleConfig?.gradient || dynamicGradient} style={styles.quickActionGradient}><Ionicons name="chatbubble" size={20} color="#fff" /><Text style={styles.quickActionText}>Message</Text></LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowContactModal(true)}>
            <View style={[styles.quickActionGradient, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}><Ionicons name={isCurrentUser ? "person" : "call"} size={20} color={isDark ? '#fff' : '#1a1a1a'} /><Text style={[styles.quickActionText, { color: isDark ? '#fff' : '#1a1a1a' }]}>{isCurrentUser ? 'Your Info' : 'Contact'}</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={handleShareContact}>
            <View style={[styles.quickActionGradient, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}><Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#1a1a1a'} /></View>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderActivityTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}><Ionicons name="time" size={20} color="#667eea" /><Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activities</Text></View>
        <View style={[styles.badge, { backgroundColor: `${roleConfig?.color || '#667eea'}20` }]}><Text style={[styles.badgeText, { color: roleConfig?.color || '#667eea' }]}>{memberActivities.length} entries</Text></View>
      </View>
      {isLoadingActivities ? (
        <GlassmorphismCard style={styles.emptyCard} intensity={80} delay={100}>
          <View style={styles.emptyStateIcon}><InlineSpinner size={24} color={themeColors.spinnerColor} section="main" /></View>
          <Text style={styles.emptyStateTitle}>Loading activities...</Text>
        </GlassmorphismCard>
      ) : memberActivities.length === 0 ? (
        <GlassmorphismCard style={styles.emptyCard} intensity={80} delay={100}>
          <View style={styles.emptyStateIcon}><Ionicons name="time-outline" size={32} color="#667eea" /></View>
          <Text style={[styles.emptyStateTitle, isDark && styles.textDark]}>{isCurrentUser ? "You haven't recorded any activities yet" : `${member?.fullName} hasn't recorded any activities yet`}</Text>
          <Text style={styles.emptyText}>Activities will appear here when {isCurrentUser ? 'you' : 'they'} log entries for {currentBaby?.name || 'the baby'}</Text>
        </GlassmorphismCard>
      ) : (
        <View style={styles.activitiesList}>
          {memberActivities.map((activity, index) => (
            <ActivityCard key={activity.id} activity={activity} isDark={isDark} index={index} reduceMotion={shouldReduceMotion} />
          ))}
        </View>
      )}
    </Animated.View>
  );

  const renderPermissionsTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}><Ionicons name="shield" size={20} color="#667eea" /><Text style={[styles.sectionTitle, isDark && styles.textDark]}>Access Permissions</Text></View>
      </View>
      <GlassmorphismCard style={styles.permissionsCard} intensity={90} delay={100}>
        <PermissionGrid permissions={roleConfig?.permissions || []} roleColor={roleConfig?.color || '#667eea'} isDark={isDark} reduceMotion={shouldReduceMotion} />
        <View style={styles.permissionNote}>
          <Ionicons name="information-circle" size={16} color={roleConfig?.color || '#667eea'} />
          <Text style={[styles.permissionNoteText, isDark && styles.textMuted]}>These permissions are set by the {roleConfig?.label} role and cannot be modified individually.</Text>
        </View>
      </GlassmorphismCard>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}><Ionicons name="stats-chart" size={20} color="#667eea" /><Text style={[styles.sectionTitle, isDark && styles.textDark]}>Activity Stats</Text></View>
      </View>
      <View style={styles.statsGrid}>
        <LinearGradient colors={roleConfig?.gradient || ['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
          <Text style={styles.statValue}>{memberActivities.length}</Text><Text style={styles.statLabel}>Activities</Text>
        </LinearGradient>
        <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
          <Text style={[styles.statValue, { color: roleConfig?.color || '#667eea' }]}>{roleConfig?.priority || 0}</Text><Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Role Priority</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
          <Text style={[styles.statValue, { color: member?.lastActive ? '#10b981' : '#f59e0b' }]}>{member?.lastActive ? 'Active' : 'Pending'}</Text><Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Status</Text>
        </View>
      </View>

      {memberActivities.length > 0 && (
        <View style={styles.activityBreakdown}>
          <Text style={[styles.breakdownTitle, isDark && styles.textDark]}>Activity Breakdown</Text>
          {Object.entries(memberActivities.reduce((acc, act) => { acc[act.type] = (acc[act.type] || 0) + 1; return acc; }, {} as Record<string, number>))
            .sort(([, a], [, b]) => b - a).map(([type, count]) => {
              const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.default;
              const percentage = Math.round((count / memberActivities.length) * 100);
              return (
                <View key={type} style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}><View style={[styles.breakdownIcon, { backgroundColor: `${config.color}20` }]}><Ionicons name={config.icon as any} size={14} color={config.color} /></View><Text style={[styles.breakdownLabel, isDark && styles.textDark]}>{config.label}</Text></View>
                  <View style={styles.breakdownRight}><View style={[styles.breakdownBar, { backgroundColor: `${config.color}15` }]}><View style={[styles.breakdownFill, { backgroundColor: config.color, width: `${percentage}%` }]} /></View><Text style={[styles.breakdownCount, { color: config.color }]}>{count}</Text></View>
                </View>
              );
            })}
        </View>
      )}

      {canManagePermissions && (
        <TouchableOpacity style={[styles.managePermissionsBtn, { backgroundColor: `${roleConfig?.color || '#667eea'}15` }]} onPress={() => { triggerHaptic('light'); setShowRoleModal(true); }}>
          <Ionicons name="shield-outline" size={20} color={roleConfig?.color || '#667eea'} />
          <Text style={[styles.managePermissionsText, { color: roleConfig?.color || '#667eea' }]}>Manage Role & Permissions</Text>
          <Ionicons name="chevron-forward" size={20} color={roleConfig?.color || '#667eea'} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  const renderDangerTab = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassmorphismCard style={styles.dangerCard} intensity={90} delay={100}>
        <View style={styles.dangerIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}><Ionicons name="warning" size={32} color="#fff" /></LinearGradient>
        </View>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerDescription}>Permanently remove {member?.fullName} from the family. Their activity history will be preserved, but they will lose access to all family data. This action cannot be undone.</Text>
        <View style={styles.dangerStats}>
          <View style={styles.dangerStat}><Ionicons name="document-text-outline" size={20} color="#94a3b8" /><Text style={styles.dangerStatText}>{memberActivities.length} Activities</Text></View>
          <View style={styles.dangerStat}><Ionicons name="time-outline" size={20} color="#94a3b8" /><Text style={styles.dangerStatText}>{member?.lastActive ? 'Recently Active' : 'Never Active'}</Text></View>
        </View>
        {canRemove && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleRemove}>
            <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.deleteGradient}><Ionicons name="trash-outline" size={20} color="#fff" /><Text style={styles.deleteButtonText}>Remove from Family</Text></LinearGradient>
          </TouchableOpacity>
        )}
      </GlassmorphismCard>
      <View style={styles.dangerNote}><Ionicons name="information-circle" size={14} color="#94a3b8" /><Text style={styles.dangerNoteText}>Consider notifying the member before removal</Text></View>
    </Animated.View>
  );

  // --- Main Render ---
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!member || !roleConfig) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' }]}>
        <Ionicons name="alert-circle-outline" size={64} color={isDark ? '#94a3b8' : '#64748b'} />
        <Text style={{ marginTop: 16, color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, fontWeight: '600' }}>Member not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.bg} />
      {renderStickyHeader()}
      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        {renderTabs()}
        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'info' && renderInfoTab()}
          {activeTab === 'activity' && renderActivityTab()}
          {activeTab === 'permissions' && renderPermissionsTab()}
          {activeTab === 'danger' && renderDangerTab()}
        </View>
      </AnimatedScrollView>

      {/* Modals */}
      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark}>
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleImagePick}>
            <View style={[styles.imagePickerIcon, { backgroundColor: `${themeColors.primary}20` }]}><Ionicons name="images-outline" size={28} color={themeColors.primary} /></View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
            <View style={[styles.imagePickerIcon, { backgroundColor: `${themeColors.accent}20` }]}><Ionicons name="camera-outline" size={28} color={themeColors.accent} /></View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}><Ionicons name="happy-outline" size={28} color="#f59e0b" /></View>
            <Text style={[styles.imagePickerLabel, isDark && styles.textDark]}>Pick Emoji</Text>
          </TouchableOpacity>
          {(formData.avatar || member.avatar) && (
            <TouchableOpacity style={styles.imagePickerOption} onPress={handleRemoveAvatar}>
              <View style={[styles.imagePickerIcon, { backgroundColor: '#ff475720' }]}><Ionicons name="trash-outline" size={28} color="#ff4757" /></View>
              <Text style={[styles.imagePickerLabel, { color: '#ff4757' }]}>Remove Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </ActionModal>

      <ActionModal visible={showContactModal} onClose={() => setShowContactModal(false)} title={isCurrentUser ? 'Your Contact Info' : `Contact ${member.fullName}`} isDark={isDark}>
        <View style={styles.contactOptions}>
          {member.phoneNumber && (
            <>
              <TouchableOpacity style={styles.contactOption} onPress={handleCall}><View style={[styles.contactIcon, { backgroundColor: '#10b98120' }]}><Ionicons name="call" size={24} color="#10b981" /></View><View style={styles.contactInfo}><Text style={[styles.contactLabel, isDark && styles.textDark]}>{isCurrentUser ? 'Call Your Number' : 'Phone Call'}</Text><Text style={[styles.contactValue, isDark && styles.textMuted]}>{member.phoneNumber}</Text></View><Ionicons name="chevron-forward" size={20} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
              <TouchableOpacity style={styles.contactOption} onPress={handleMessage}><View style={[styles.contactIcon, { backgroundColor: `${themeColors.primary}20` }]}><Ionicons name="chatbubble" size={24} color={themeColors.primary} /></View><View style={styles.contactInfo}><Text style={[styles.contactLabel, isDark && styles.textDark]}>{isCurrentUser ? 'Message Your Number' : 'Send Message'}</Text><Text style={[styles.contactValue, isDark && styles.textMuted]}>SMS/Text</Text></View><Ionicons name="chevron-forward" size={20} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
            </>
          )}
          {member.email && <TouchableOpacity style={styles.contactOption} onPress={handleEmail}><View style={[styles.contactIcon, { backgroundColor: '#f59e0b20' }]}><Ionicons name="mail" size={24} color="#f59e0b" /></View><View style={styles.contactInfo}><Text style={[styles.contactLabel, isDark && styles.textDark]}>Email</Text><Text style={[styles.contactValue, isDark && styles.textMuted]}>{member.email}</Text></View><Ionicons name="chevron-forward" size={20} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>}
          <TouchableOpacity style={styles.contactOption} onPress={handleShareContact}><View style={[styles.contactIcon, { backgroundColor: '#ec489920' }]}><Ionicons name="share" size={24} color="#ec4899" /></View><View style={styles.contactInfo}><Text style={[styles.contactLabel, isDark && styles.textDark]}>Share Contact</Text><Text style={[styles.contactValue, isDark && styles.textMuted]}>Export contact info</Text></View><Ionicons name="chevron-forward" size={20} color={isDark ? '#94a3b8' : '#64748b'} /></TouchableOpacity>
        </View>
      </ActionModal>

      <ActionModal visible={showRoleModal} onClose={() => setShowRoleModal(false)} title="Manage Role" isDark={isDark}>
        <View style={styles.roleOptions}>
          {Object.entries(ROLE_CONFIG).map(([role, config]) => (
            <TouchableOpacity key={role} style={[styles.roleOption, member.role === role && { backgroundColor: `${config.color}15`, borderColor: config.color }]} onPress={() => handleRoleChange(role as UserRole)}>
              <LinearGradient colors={config.gradient} style={styles.roleOptionIcon}><Ionicons name={config.icon as any} size={20} color="#fff" /></LinearGradient>
              <View style={styles.roleOptionInfo}><Text style={[styles.roleOptionTitle, isDark && styles.textDark]}>{config.label}</Text><Text style={[styles.roleOptionDesc, isDark && styles.textMuted]}>{config.description}</Text></View>
              {member.role === role && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
            </TouchableOpacity>
          ))}
        </View>
      </ActionModal>

      <EmojiPicker />
    </View>
  );
}

// --- Styles ---
// ─── REDESIGNED STYLES ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  centered: { justifyContent: 'center', alignItems: 'center' },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // ── Glass Card ──
  glassCard: {
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...DESIGN.shadow.md,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 4,
    borderRadius: 16,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Profile Hero (Redesigned) ──
  profileHero: {
    paddingHorizontal: DESIGN.spacing.xl,
    paddingBottom: 24,
    alignItems: 'center',
  },
  profileHeroCard: {
    width: '100%',
    borderRadius: DESIGN.radius.xl,
    padding: 24,
    alignItems: 'center',
    ...DESIGN.shadow.lg,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  profileTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  profileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  profileTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  profileStatsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 24,
  },
  profileStat: {
    alignItems: 'center',
    gap: 4,
  },
  profileStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── AI Health Companion ──
  aiCompanionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },
  aiCompanionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiCompanionTitleWrap: { flex: 1 },
  aiCompanionTitle: { fontSize: 16, fontWeight: '800' },
  aiCompanionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  healthScoreRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthScoreValue: { fontSize: 16, fontWeight: '800' },
  tipsList: { paddingHorizontal: 16, paddingBottom: 16, gap: 0 },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  tipIcon: { fontSize: 20, width: 28 },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  tipPriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tipPriorityText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // ── Smart Activity Timeline ──
  timelineContainer: { marginHorizontal: 16, gap: 16 },
  timelineGroup: { gap: 8 },
  timelineDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  timelineDate: { fontSize: 13, fontWeight: '700' },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 20,
    bottom: -16,
    width: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginLeft: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  timelineItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineItemEmoji: { fontSize: 18 },
  timelineItemContent: { flex: 1, gap: 2 },
  timelineItemTitle: { fontSize: 14, fontWeight: '700' },
  timelineItemTime: { fontSize: 12, fontWeight: '500' },
  timelineItemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timelineItemBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── Family Connection Map ──
  connectionsScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  connectionCard: {
    width: 160,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    ...DESIGN.shadow.sm,
    overflow: 'hidden',
  },
  connectionName: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  connectionRole: { fontSize: 11, fontWeight: '700' },
  connectionStrengthBar: { width: '100%', gap: 4, marginTop: 4 },
  connectionStrengthBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  connectionStrengthFill: { height: '100%', borderRadius: 2 },
  connectionStrengthText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  lastInteraction: { fontSize: 10, fontWeight: '500' },

  // ── Achievement Badge System ──
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 10,
  },
  achievementCard: {
    width: (Dimensions.get('window').width - 56) / 3,
    aspectRatio: 0.85,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...DESIGN.shadow.sm,
    overflow: 'hidden',
  },
  achievementIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementIcon: { fontSize: 24 },
  achievementTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  achievementDesc: { fontSize: 10, fontWeight: '500', textAlign: 'center', lineHeight: 14 },
  achievementLock: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // ── Personalized Insights Feed ──
  insightCard: {
    padding: 14,
    marginBottom: 8,
    borderRadius: 16,
    marginHorizontal: 16,
    ...DESIGN.shadow.sm,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightTitle: { fontSize: 14, fontWeight: '700' },
  insightPriorityDot: { width: 8, height: 8, borderRadius: 4 },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500' },

  // ── Quick Action Shortcuts ──
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    gap: 10,
  },
  quickActionItem: {
    width: (Dimensions.get('window').width - 56) / 3,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...DESIGN.shadow.md,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '600' },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN.spacing.lg,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: DESIGN.radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    maxWidth: 180,
  },
  saveBtn: {
    paddingHorizontal: DESIGN.spacing.lg,
    paddingVertical: 8,
    borderRadius: DESIGN.radius.md,
    backgroundColor: '#667eea',
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: 'rgba(100,116,139,0.2)' },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  saveBtnTextDisabled: { color: '#94a3b8' },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: DESIGN.radius.xl,
    overflow: 'hidden',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: DESIGN.radius.md,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Retry ──
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Tab Panel ──
  tabPanel: { paddingBottom: 20 },
});
