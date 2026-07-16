import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

/* Permanent storage for guardian/member photos (cache URIs get purged by the OS) */
const GUARDIAN_IMAGES_DIR = FileSystem.documentDirectory + 'guardian_images/';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner, InlineSpinner } from '../../components/UniversalSpinner';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type EditGuardianScreenProps = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Borrowed from GrowthDashboardScreen, refined
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  },
};

const ROLE_CONFIG: Record<UserRole, {
  label: string; color: string; gradient: [string, string]; icon: string;
  description: string; permissions: string[]; canEdit: boolean; canRemove: boolean;
  badge: string; priority: number;
}> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'], icon: 'shield',
    description: 'Full owner access to everything', permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data', 'Billing'],
    canEdit: false, canRemove: false, badge: 'Owner', priority: 1,
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'], icon: 'heart',
    description: 'Full access to manage family and baby data', permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'],
    canEdit: true, canRemove: true, badge: 'Co-Parent', priority: 2,
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian', color: '#10b981', gradient: ['#10b981', '#34d399'], icon: 'shield-checkmark',
    description: 'Can add entries but cannot delete or manage family', permissions: ['Read', 'Write', 'Limited Delete'],
    canEdit: true, canRemove: true, badge: 'Guardian', priority: 3,
  },
  [UserRole.VIEWER]: {
    label: 'Viewer', color: '#64748b', gradient: ['#64748b', '#94a3b8'], icon: 'eye',
    description: 'View only access, cannot add or modify data', permissions: ['Read Only'],
    canEdit: true, canRemove: true, badge: 'Viewer', priority: 4,
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

type ProfileTab = 'overview' | 'activity' | 'permissions' | 'settings';


/* ═══════════════════════════════════════════════════════════════════════════
   REFINED SUB-COMPONENTS — Borrowing GrowthDashboard patterns
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0 }: {
  children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean; delay?: number;
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: '#6366f1', borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string;
}) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={14} color="#6366f1" />
      </TouchableOpacity>
    )}
  </View>
));
const TabBar = React.memo(({ tabs, activeTab, onChange }: {
  tabs: { key: ProfileTab; label: string; icon: string }[];
  activeTab: ProfileTab; onChange: (t: ProfileTab) => void;
}) => (
  <View style={styles.tabBar}>
    {tabs.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, isActive && { backgroundColor: 'rgba(99,102,241,0.15)', ...DESIGN.shadow.sm }]}>
          <Ionicons name={tab.icon as any} size={16} color={isActive ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.tabLabel, { color: isActive ? '#6366f1' : '#94a3b8' }, isActive && { fontWeight: '700' }]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

const KpiPill = React.memo(({ icon, value, label, color, onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.kpiPill}>
    <LinearGradient colors={[`${color}15`, `${color}05`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    <View style={[styles.kpiPillIconBg, { backgroundColor: `${color}15` }]}>
      <Text style={styles.kpiPillEmoji}>{icon}</Text>
    </View>
    <View style={styles.kpiPillBody}>
      <Text style={[styles.kpiPillValue, { color }]}>{value}</Text>
      <Text style={styles.kpiPillLabel}>{label}</Text>
    </View>
  </TouchableOpacity>
));


/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 1: AI Member Insights Card
   ═══════════════════════════════════════════════════════════════════════════ */

const AIMemberInsights = React.memo(({ member, activities }: any) => {
  const insights = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const weekActs = activities.filter((a: any) => a.timestamp > weekAgo);
    const monthActs = activities.filter((a: any) => a.timestamp > monthAgo);
    const engagementScore = Math.min(100, Math.round((weekActs.length / 7) * 100));
    const consistencyScore = monthActs.length > 0 ? Math.min(100, Math.round((monthActs.length / 30) * 100)) : 0;
    const topType = activities.reduce((acc: any, a: any) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
    const topTypeKey = Object.entries(topType).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'default';
    const lastActive = activities[0]?.timestamp || 0;
    const daysSince = lastActive ? Math.floor((now - lastActive) / (24 * 60 * 60 * 1000)) : 999;
    const items = [];
    if (engagementScore > 80) items.push({ emoji: '🔥', title: 'Super Active', desc: 'Top 10% of family contributors', color: '#f59e0b', priority: 'high' });
    else if (engagementScore < 30) items.push({ emoji: '💤', title: 'Low Engagement', desc: 'Consider inviting to log entries', color: '#ef4444', priority: 'high', action: 'Send Reminder' });
    if (consistencyScore > 70) items.push({ emoji: '📅', title: 'Consistent Logger', desc: 'Regular daily participation', color: '#10b981', priority: 'medium' });
    if (daysSince > 7) items.push({ emoji: '⏰', title: `${daysSince} Days Inactive`, desc: `Last seen ${new Date(lastActive).toLocaleDateString()}`, color: '#ef4444', priority: 'high' });
    if (topTypeKey && topTypeKey !== 'default') {
      const config = ACTIVITY_CONFIG[topTypeKey] || ACTIVITY_CONFIG.default;
      items.push({ emoji: config.emoji, title: `Prefers ${config.label}`, desc: 'Most frequent activity type', color: config.color, priority: 'low' });
    }
    return items.slice(0, 3);
  }, [activities]);
  if (insights.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()}>
      <SectionHeader title="AI Insights" subtitle="Intelligence-powered analysis" />
      <View style={styles.insightsList}>
        {insights.map((insight: any, i: number) => (
          <TouchableOpacity key={i} activeOpacity={0.85} style={[styles.insightRow, { borderLeftColor: insight.color }]}>
            <View style={[styles.insightIconBg, { backgroundColor: `${insight.color}12` }]}>
              <Text style={styles.insightEmoji}>{insight.emoji}</Text>
            </View>
            <View style={styles.insightContent}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                {insight.action && (
                  <View style={[styles.insightActionBadge, { backgroundColor: `${insight.color}15` }]}>
                    <Text style={[styles.insightActionText, { color: insight.color }]}>{insight.action}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.insightDesc}>{insight.desc}</Text>
            </View>
            <View style={[styles.insightPriority, { backgroundColor: insight.color }]} />
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 2: Activity Velocity Sparkline
   ═══════════════════════════════════════════════════════════════════════════ */

const ActivitySparkline = React.memo(({ activities }: { activities: ActivityEntry[] }) => {
  const data = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days[d.toISOString().split('T')[0]] = 0; }
    activities.forEach(a => { const d = new Date(a.timestamp).toISOString().split('T')[0]; if (days[d] !== undefined) days[d]++; });
    return Object.values(days);
  }, [activities]);
  const maxVal = Math.max(...data, 1);
  return (
    <Animated.View entering={FadeInUp.delay(250).springify()}>
      <GlassCard>
        <View style={styles.sparklineHeader}>
          <View>
            <Text style={styles.sparklineTitle}>Activity This Week</Text>
            <Text style={styles.sparklineSubtitle}>Daily entry count</Text>
          </View>
          <View style={styles.sparklineTotal}>
            <Text style={styles.sparklineTotalValue}>{data.reduce((a, b) => a + b, 0)}</Text>
            <Text style={styles.sparklineTotalLabel}>entries</Text>
          </View>
        </View>
        <View style={styles.sparklineChart}>
          {data.map((val, i) => {
            const height = Math.max(4, (val / maxVal) * 60);
            const isToday = i === data.length - 1;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.sparklineBar, { height, backgroundColor: isToday ? '#6366f1' : val > 0 ? '#8b5cf6' : '#334155' }]} />
                <Text style={[styles.sparklineDay, isToday && { color: '#6366f1', fontWeight: '700' }]}>{['M','T','W','T','F','S','S'][i]}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 3: Relationship Health Score
   ═══════════════════════════════════════════════════════════════════════════ */

const RelationshipHealth = React.memo(({ member, activities }: any) => {
  const health = useMemo(() => {
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recent = activities.filter((a: any) => a.timestamp > monthAgo);
    const frequency = Math.min(100, (recent.length / 10) * 100);
    const recency = member?.lastActive ? Math.max(0, 100 - ((now - new Date(member.lastActive).getTime()) / (7 * 24 * 60 * 60 * 1000)) * 100) : 0;
    const diversity = new Set(activities.map((a: any) => a.type)).size;
    const diversityScore = Math.min(100, (diversity / 5) * 100);
    const score = Math.round((frequency * 0.4) + (recency * 0.35) + (diversityScore * 0.25));
    let status = { label: 'Excellent', color: '#10b981', emoji: '💚' };
    if (score < 40) status = { label: 'Needs Attention', color: '#ef4444', emoji: '⚠️' };
    else if (score < 70) status = { label: 'Good', color: '#f59e0b', emoji: '💛' };
    else if (score < 90) status = { label: 'Great', color: '#6366f1', emoji: '💙' };
    return { score, status, frequency, recency, diversityScore };
  }, [member, activities]);
  return (
    <Animated.View entering={FadeInUp.delay(300).springify()}>
      <GlassCard>
        <View style={styles.healthContainer}>
          <View style={styles.healthLeft}>
            <Text style={styles.healthTitle}>Relationship Health</Text>
            <Text style={styles.healthSubtitle}>Family integration score</Text>
            <View style={styles.healthMetrics}>
              <View style={styles.healthMetric}><Text style={styles.healthMetricValue}>{Math.round(health.frequency)}%</Text><Text style={styles.healthMetricLabel}>Frequency</Text></View>
              <View style={styles.healthMetric}><Text style={styles.healthMetricValue}>{Math.round(health.recency)}%</Text><Text style={styles.healthMetricLabel}>Recency</Text></View>
              <View style={styles.healthMetric}><Text style={styles.healthMetricValue}>{Math.round(health.diversityScore)}%</Text><Text style={styles.healthMetricLabel}>Diversity</Text></View>
            </View>
          </View>
          <View style={styles.healthRingContainer}>
            <View style={styles.healthRing}>
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.healthRingEmoji}>{health.status.emoji}</Text>
                <Text style={[styles.healthRingScore, { color: health.status.color }]}>{health.score}</Text>
                <Text style={styles.healthRingLabel}>{health.status.label}</Text>
              </View>
              <View style={[styles.healthRingBg, { borderColor: 'rgba(255,255,255,0.06)' }]} />
              <View style={[styles.healthRingFill, { borderColor: health.status.color, transform: [{ rotate: `${(health.score / 100) * 360}deg` }] }]} />
            </View>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
});


/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 4: Smart Role Recommendations
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartRoleRecommendations = React.memo(({ member, activities, onRoleChange, canManage }: any) => {
  const recommendations = useMemo(() => {
    const recs = [];
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recent = activities.filter((a: any) => a.timestamp > monthAgo);
    if (member?.role === UserRole.VIEWER && recent.length > 15) {
      recs.push({ from: UserRole.VIEWER, to: UserRole.GUARDIAN, reason: 'High activity suggests they could contribute more', confidence: 85, emoji: '⬆️', color: '#10b981' });
    }
    if (member?.role === UserRole.GUARDIAN && recent.length < 3) {
      recs.push({ from: UserRole.GUARDIAN, to: UserRole.VIEWER, reason: 'Low activity, viewer access may be more appropriate', confidence: 72, emoji: '⬇️', color: '#f59e0b' });
    }
    if (member?.role === UserRole.GUARDIAN && recent.length > 25) {
      recs.push({ from: UserRole.GUARDIAN, to: UserRole.PARENT_2, reason: 'Exceptional contribution level detected', confidence: 68, emoji: '⭐', color: '#6366f1' });
    }
    return recs;
  }, [member, activities]);
  if (!canManage || recommendations.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(350).springify()}>
      <SectionHeader title="Smart Recommendations" subtitle="AI-suggested role adjustments" />
      {recommendations.map((rec: any, i: number) => (
        <TouchableOpacity key={i} onPress={() => onRoleChange(rec.to)} activeOpacity={0.85} style={[styles.recCard, { borderLeftColor: rec.color }]}>
          <View style={[styles.recIconBg, { backgroundColor: `${rec.color}12` }]}>
            <Text style={styles.recEmoji}>{rec.emoji}</Text>
          </View>
          <View style={styles.recContent}>
            <Text style={styles.recTitle}>Promote to <Text style={{ color: rec.color }}>{ROLE_CONFIG[rec.to].label}</Text></Text>
            <Text style={styles.recReason}>{rec.reason}</Text>
            <View style={styles.recConfidence}>
              <View style={[styles.recBarBg, { backgroundColor: `${rec.color}15` }]}>
                <View style={[styles.recBarFill, { width: `${rec.confidence}%`, backgroundColor: rec.color }]} />
              </View>
              <Text style={[styles.recConfidenceText, { color: rec.color }]}>{rec.confidence}% match</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748b" />
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 5: Engagement Timeline
   ═══════════════════════════════════════════════════════════════════════════ */

const EngagementTimeline = React.memo(({ member, activities, milestones }: any) => {
  const timelineItems = useMemo(() => {
    const items = [];
    if (member?.addedAt) items.push({ date: member.addedAt, title: 'Joined Family', desc: `Added as ${ROLE_CONFIG[member.role]?.label || member.role}`, emoji: '👋', color: '#6366f1', type: 'join' });
    const firstActivity = [...activities].sort((a, b) => a.timestamp - b.timestamp)[0];
    if (firstActivity) { const config = ACTIVITY_CONFIG[firstActivity.type] || ACTIVITY_CONFIG.default; items.push({ date: new Date(firstActivity.timestamp).toISOString(), title: 'First Activity', desc: `Logged ${config.label}`, emoji: '🎯', color: '#10b981', type: 'first' }); }
    const milestonesByMember = milestones?.filter((m: any) => m.loggedBy === member?.id || m.loggedByName === member?.fullName).slice(0, 2);
    milestonesByMember?.forEach((m: any) => items.push({ date: m.achievedAt || m.timestamp, title: 'Milestone Logged', desc: m.title, emoji: '🏆', color: '#f59e0b', type: 'milestone' }));
    const streakStart = member?.streak?.startedAt;
    if (streakStart) items.push({ date: streakStart, title: 'Streak Started', desc: `${member.streak?.currentStreak || 0} day streak`, emoji: '🔥', color: '#ef4444', type: 'streak' });
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-4);
  }, [member, activities, milestones]);
  if (timelineItems.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.delay(400).springify()}>
      <SectionHeader title="Engagement Timeline" subtitle="Key moments with this member" />
      <View style={styles.timelineContainer}>
        {timelineItems.map((item, i) => (
          <View key={i} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineLine, i === 0 && { top: '50%' }, i === timelineItems.length - 1 && { bottom: '50%' }]} />
              <View style={[styles.timelineDot, { backgroundColor: item.color, borderColor: item.color }]} />
            </View>
            <View style={styles.timelineCard}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineEmoji}>{item.emoji}</Text>
                <View style={styles.timelineMeta}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineDate}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
              </View>
              <Text style={styles.timelineDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEW FEATURE 6: Quick Actions Dock
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActionsDock = React.memo(({ member, isCurrentUser, onMessage, onCall, onShare, onEdit }: any) => {
  return (
    <Animated.View entering={FadeInUp.delay(450).springify()} style={styles.dockContainer}>
      <View style={styles.dock}>
        {!isCurrentUser && (
          <TouchableOpacity onPress={onMessage} style={styles.dockItem}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.dockGradient}>
              <Ionicons name="chatbubble" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.dockLabel}>Message</Text>
          </TouchableOpacity>
        )}
        {!isCurrentUser && member?.phoneNumber && (
          <TouchableOpacity onPress={onCall} style={styles.dockItem}>
            <LinearGradient colors={['#10b981', '#34d399']} style={styles.dockGradient}>
              <Ionicons name="call" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.dockLabel}>Call</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onShare} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </View>
          <Text style={styles.dockLabel}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={styles.dockItem}>
          <View style={[styles.dockGradient, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </View>
          <Text style={styles.dockLabel}>Edit</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════════════════════════════════════ */

const ActionModal = React.memo(({ visible, onClose, title, children }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
          <LinearGradient colors={['rgba(50,50,70,0.95)', 'rgba(40,40,60,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EditGuardianScreen({ navigation, route }: EditGuardianScreenProps) {
  const { guardianId, mode = 'guardian', fromChat = false } = route.params;
  const { members, updateGuardianProfile, removeMember, loadFamily } = useFamily();
  const { hasPermission, profile, updateProfile } = useUser();
  const { currentBaby, getRecentActivities, milestones } = useBaby();
  const { userProfile } = useAuth();
  const { triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const [member, setMember] = useState<FamilyMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [memberActivities, setMemberActivities] = useState<ActivityEntry[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const [formData, setFormData] = useState({ fullName: '', email: '', phoneNumber: '', relationship: '', avatar: '', notificationsEnabled: true });
  const [originalData, setOriginalData] = useState({ fullName: '', email: '', phoneNumber: '', relationship: '', avatar: '', notificationsEnabled: true });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

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
        const initialData = { fullName: found.fullName || '', email: found.email || '', phoneNumber: found.phoneNumber || '', relationship: found.relationship || '', avatar: found.avatar || '', notificationsEnabled: found.notificationsEnabled ?? true };
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
      const allActivities = getRecentActivities(100);
      const memberActs = allActivities.filter(a => {
        if (a.loggedBy === memberId) return true;
        if (memberUserId && a.loggedBy === memberUserId) return true;
        if (member && a.loggedByName === member.fullName) return true;
        return false;
      });
      setMemberActivities(memberActs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30));
    } catch (error) { console.error('Error loading member activities:', error); setMemberActivities([]); }
    finally { setIsLoadingActivities(false); }
  }, [currentBaby, getRecentActivities, member]);

  const handleSave = async () => {
    if (!member) return;
    if (!formData.fullName.trim()) { sweetAlert.error('Validation Error', 'Name is required'); triggerHaptic('error'); return; }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { sweetAlert.error('Validation Error', 'Please enter a valid email address'); triggerHaptic('error'); return; }
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
    if (Object.keys(updates).length === 0) { sweetAlert.toast('No Changes', 'No changes were made'); setIsEditing(false); setIsSaving(false); return; }
    try {
      if (isCurrentUser) { try { await updateProfile({ phoneNumber: formData.phoneNumber, email: formData.email, avatar: formData.avatar }); } catch (err) {} }
      const success = await updateGuardianProfile(member.id, updates);
      if (success) { triggerHaptic('success'); setIsEditing(false); setMember(prev => prev ? { ...prev, ...updates } : null); setOriginalData({ ...formData }); sweetAlert.success('Profile Updated', 'All changes saved successfully'); }
      else { triggerHaptic('error'); sweetAlert.error('Save Failed', 'Please try again.'); }
    } catch (error) { triggerHaptic('error'); sweetAlert.error('Error', 'An unexpected error occurred'); }
    setIsSaving(false);
  };

  const handleRemove = () => {
    if (!member) return;
    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    if (member.id === currentUserId) { sweetAlert.alert('Cannot Remove', 'You cannot remove yourself.', 'warning'); return; }
    if (!hasPermission('manageFamily')) { sweetAlert.error('Permission Denied', 'Only parents can remove members'); triggerHaptic('error'); return; }
    sweetAlert.confirm('Remove Family Member', `Remove ${member.fullName}? Their history will be preserved but they will lose access.`, async () => {
      triggerHaptic('error'); const success = await removeMember(member.id);
      if (success) { triggerHaptic('success'); sweetAlert.success('Member Removed', `${member.fullName} has been removed`); navigation.goBack(); }
      else sweetAlert.error('Error', 'Failed to remove family member');
    }, () => {}, 'Remove', 'Cancel');
  };

  const handleImagePick = async () => {
    setShowImagePicker(false);
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { sweetAlert.error('Permission Required', 'Please allow access to your photo library'); return; }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setIsSaving(true);
      // Copy from the temporary picker cache into permanent app storage
      const dirInfo = await FileSystem.getInfoAsync(GUARDIAN_IMAGES_DIR);
      if (!dirInfo.exists) { await FileSystem.makeDirectoryAsync(GUARDIAN_IMAGES_DIR, { intermediates: true }); }
      const processedUri = `${GUARDIAN_IMAGES_DIR}${member?.id || 'member'}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: processedUri });

      setFormData(prev => ({ ...prev, avatar: processedUri }));
      if (!isEditing && member) {
        const success = await updateGuardianProfile(member.id, { avatar: processedUri });
        if (success) { setMember(prev => prev ? { ...prev, avatar: processedUri } : null); setOriginalData(prev => ({ ...prev, avatar: processedUri })); sweetAlert.success('Photo Updated', 'Profile picture updated'); }
      }
      triggerHaptic('success');
    } catch (error) { sweetAlert.error('Error', 'Failed to process image'); }
    finally { setIsSaving(false); }
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

  const handleCall = async () => {
    if (!member?.phoneNumber) { sweetAlert.alert('No Phone Number', 'No phone number on file.', 'warning'); return; }
    const phoneUrl = `tel:${member.phoneNumber.replace(/\s/g, '')}`;
    if (await Linking.canOpenURL(phoneUrl)) { triggerHaptic('medium'); await Linking.openURL(phoneUrl); }
  };

  const handleMessage = () => {
    if (!member) return;
    navigation.navigate('FamilyChat' as never, { memberId: member.id, memberName: member.fullName, memberAvatar: member.avatar, memberRole: member.role });
  };

  const handleShare = async () => {
    if (!member) return;
    try { triggerHaptic('medium'); await Share.share({ message: `${member.fullName} - ${ROLE_LABELS[member.role] || member.role}\n${member.email || ''}\n${member.phoneNumber || ''}`, title: `${member.fullName}'s Contact Info` }); }
    catch (error) { console.error('Error sharing contact:', error); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFamily();
    if (member && currentBaby) await loadMemberActivities(member.id, member.userId);
    setRefreshing(false);
  }, [loadFamily, member, currentBaby, loadMemberActivities]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const roleConfig = member ? ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER] : null;
  const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
  const isCurrentUser = member?.id === currentUserId;
  const canEdit = useMemo(() => { if (isCurrentUser) return true; return hasPermission('manageFamily') && roleConfig?.canEdit; }, [hasPermission, roleConfig, isCurrentUser]);
  const canRemove = useMemo(() => hasPermission('manageFamily') && roleConfig?.canRemove && !isCurrentUser, [hasPermission, roleConfig, isCurrentUser]);
  const canManagePermissions = useMemo(() => hasPermission('manageFamily') && !isCurrentUser, [hasPermission, isCurrentUser]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  if (!member || !roleConfig) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
        <Ionicons name="alert-circle-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: '#94a3b8', fontSize: 16, fontWeight: '600' }}>Member not found</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#6366f1' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'activity' as ProfileTab, label: 'Activity', icon: 'time-outline' },
    { key: 'permissions' as ProfileTab, label: 'Access', icon: 'shield-outline' },
    { key: 'settings' as ProfileTab, label: 'Settings', icon: 'settings-outline' },
  ];


  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0a0a0a', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyTitle}>{member.fullName}</Text>
        <Text style={styles.stickySubtitle}>{roleConfig.label}</Text>
      </Animated.View>

      {/* Main Scroll */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#6366f1', '#8b5cf6']} />}
      >
        {/* Top Header Row */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={[styles.editToggleBtn, isEditing && { backgroundColor: 'rgba(99,102,241,0.3)' }]}>
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color={isEditing ? '#6366f1' : '#fff'} />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Hero */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => canEdit && setShowImagePicker(true)} disabled={!canEdit}>
            <SafeAvatar avatar={formData.avatar || member.avatar} size={100} fallbackIcon={roleConfig.icon as any} fallbackColor={roleConfig.color} fallbackBgColor={`${roleConfig.color}20`} borderColor={roleConfig.color} borderWidth={3} showEditBadge={canEdit} animated={true} />
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{member.fullName}</Text>
            <Text style={styles.profileMeta}>{roleConfig.label} • {member.relationship || 'Family Member'}</Text>
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
        </Animated.View>

        {/* Quick Actions Dock */}
        <QuickActionsDock member={member} isCurrentUser={isCurrentUser} onMessage={handleMessage} onCall={handleCall} onShare={handleShare} onEdit={() => setIsEditing(true)} />

        {/* Tab Bar */}
        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            <View style={styles.kpiPillRow}>
              <KpiPill icon="📊" value={memberActivities.length} label="Activities" color="#6366f1" />
              <KpiPill icon="🔥" value={member?.streak || 0} label="Day Streak" color="#f59e0b" />
              <KpiPill icon="⭐" value={roleConfig.priority} label="Priority" color={roleConfig.color} />
            </View>
            <AIMemberInsights member={member} activities={memberActivities} />
            <ActivitySparkline activities={memberActivities} />
            <RelationshipHealth member={member} activities={memberActivities} />
            <SmartRoleRecommendations member={member} activities={memberActivities} onRoleChange={handleRoleChange} canManage={canManagePermissions} />
            <EngagementTimeline member={member} activities={memberActivities} milestones={milestones} />
            <Animated.View entering={FadeInUp.delay(500).springify()}>
              <SectionHeader title="Contact Info" />
              <GlassCard>
                <View style={styles.contactList}>
                  {member.email && (
                    <View style={styles.contactItem}>
                      <View style={[styles.contactIcon, { backgroundColor: '#6366f115' }]}><Ionicons name="mail-outline" size={18} color="#6366f1" /></View>
                      <View style={styles.contactBody}><Text style={styles.contactLabel}>Email</Text><Text style={styles.contactValue}>{member.email}</Text></View>
                    </View>
                  )}
                  {member.phoneNumber && (
                    <View style={styles.contactItem}>
                      <View style={[styles.contactIcon, { backgroundColor: '#10b98115' }]}><Ionicons name="call-outline" size={18} color="#10b981" /></View>
                      <View style={styles.contactBody}><Text style={styles.contactLabel}>Phone</Text><Text style={styles.contactValue}>{member.phoneNumber}</Text></View>
                    </View>
                  )}
                  <View style={styles.contactItem}>
                    <View style={[styles.contactIcon, { backgroundColor: '#f59e0b15' }]}><Ionicons name="calendar-outline" size={18} color="#f59e0b" /></View>
                    <View style={styles.contactBody}><Text style={styles.contactLabel}>Member Since</Text><Text style={styles.contactValue}>{member.addedAt ? new Date(member.addedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}</Text></View>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          </>
        )}

        {/* TAB: ACTIVITY */}
        {activeTab === 'activity' && (
          <>
            <SectionHeader title="Recent Activity" subtitle={`${memberActivities.length} entries`} />
            {isLoadingActivities ? (
              <GlassCard style={styles.emptyCard}>
                <View style={styles.emptyStateIcon}><InlineSpinner size={24} color="#6366f1" section="main" /></View>
                <Text style={styles.emptyStateTitle}>Loading activities...</Text>
              </GlassCard>
            ) : memberActivities.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <View style={styles.emptyStateIcon}><Ionicons name="time-outline" size={32} color="#6366f1" /></View>
                <Text style={styles.emptyStateTitle}>{isCurrentUser ? "You haven't recorded any activities yet" : `${member.fullName} hasn't recorded any activities yet`}</Text>
                <Text style={styles.emptyText}>Activities will appear here when {isCurrentUser ? 'you' : 'they'} log entries for {currentBaby?.name || 'the baby'}</Text>
              </GlassCard>
            ) : (
              <View style={styles.activitiesList}>
                {memberActivities.map((activity, index) => {
                  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
                  return (
                    <Animated.View key={activity.id} entering={FadeInUp.delay(index * 60).springify()}>
                      <GlassCard style={styles.activityCard} delay={index * 60}>
                        <View style={styles.activityRow}>
                          <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}><Text style={styles.activityEmoji}>{config.emoji}</Text></View>
                          <View style={styles.activityContent}>
                            <Text style={styles.activityTitle}>{activity.title || config.label}</Text>
                            {activity.details && <Text style={styles.activityDetails} numberOfLines={2}>{activity.details}</Text>}
                            <Text style={styles.activityTime}>{new Date(activity.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                          <View style={[styles.activityTypeBadge, { backgroundColor: `${config.color}15` }]}><Text style={[styles.activityTypeText, { color: config.color }]}>{config.label}</Text></View>
                        </View>
                      </GlassCard>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* TAB: PERMISSIONS */}
        {activeTab === 'permissions' && (
          <>
            <SectionHeader title="Access Permissions" subtitle={`${roleConfig.permissions.length} permissions`} />
            <GlassCard>
              <View style={styles.permissionGrid}>
                {roleConfig.permissions.map((permission, index) => (
                  <Animated.View key={permission} entering={FadeIn.delay(index * 50)} style={[styles.permissionChip, { backgroundColor: `${roleConfig.color}15`, borderColor: `${roleConfig.color}30` }]}>
                    <Ionicons name="checkmark-circle" size={14} color={roleConfig.color} />
                    <Text style={[styles.permissionChipText, { color: roleConfig.color }]}>{permission}</Text>
                  </Animated.View>
                ))}
              </View>
              <View style={styles.permissionNote}>
                <Ionicons name="information-circle" size={16} color={roleConfig.color} />
                <Text style={styles.permissionNoteText}>These permissions are set by the {roleConfig.label} role and cannot be modified individually.</Text>
              </View>
            </GlassCard>
            <View style={styles.statsGrid}>
              <LinearGradient colors={roleConfig.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
                <Text style={styles.statCardValue}>{memberActivities.length}</Text><Text style={styles.statCardLabel}>Activities</Text>
              </LinearGradient>
              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.statCardValue, { color: roleConfig.color }]}>{roleConfig.priority}</Text><Text style={[styles.statCardLabel, { color: '#94a3b8' }]}>Role Priority</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.statCardValue, { color: member?.lastActive ? '#10b981' : '#f59e0b' }]}>{member?.lastActive ? 'Active' : 'Pending'}</Text><Text style={[styles.statCardLabel, { color: '#94a3b8' }]}>Status</Text>
              </View>
            </View>
            {memberActivities.length > 0 && (
              <View style={styles.activityBreakdown}>
                <Text style={styles.breakdownTitle}>Activity Breakdown</Text>
                {Object.entries(memberActivities.reduce((acc, act) => { acc[act.type] = (acc[act.type] || 0) + 1; return acc; }, {} as Record<string, number>))
                  .sort(([, a], [, b]) => b - a).map(([type, count]) => {
                    const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.default;
                    const percentage = Math.round((count / memberActivities.length) * 100);
                    return (
                      <View key={type} style={styles.breakdownRow}>
                        <View style={styles.breakdownLeft}><View style={[styles.breakdownIcon, { backgroundColor: `${config.color}20` }]}><Ionicons name={config.icon as any} size={14} color={config.color} /></View><Text style={styles.breakdownLabel}>{config.label}</Text></View>
                        <View style={styles.breakdownRight}><View style={[styles.breakdownBar, { backgroundColor: `${config.color}15` }]}><View style={[styles.breakdownFill, { backgroundColor: config.color, width: `${percentage}%` }]} /></View><Text style={[styles.breakdownCount, { color: config.color }]}>{count}</Text></View>
                      </View>
                    );
                  })}
              </View>
            )}
            {canManagePermissions && (
              <TouchableOpacity style={[styles.managePermissionsBtn, { backgroundColor: `${roleConfig.color}15` }]} onPress={() => { triggerHaptic('light'); setShowRoleModal(true); }}>
                <Ionicons name="shield-outline" size={20} color={roleConfig.color} />
                <Text style={[styles.managePermissionsText, { color: roleConfig.color }]}>Manage Role & Permissions</Text>
                <Ionicons name="chevron-forward" size={20} color={roleConfig.color} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'settings' && (
          <>
            <SectionHeader title="Edit Profile" />
            <GlassCard>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                {isCurrentUser ? (
                  <View style={[styles.inputContainer, styles.inputDisabled]}>
                    <Ionicons name="lock-closed" size={20} color="#6366f1" style={styles.inputIcon} />
                    <Text style={styles.inputText}>{formData.fullName}</Text>
                    <View style={[styles.ownedBadge, { backgroundColor: '#6366f1' }]}><Text style={styles.ownedBadgeText}>You</Text></View>
                  </View>
                ) : (
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="person-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput style={[styles.inputField, styles.flexInput]} value={formData.fullName} onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))} placeholder="Enter full name" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                  </View>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="mail-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={formData.email} onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))} placeholder="Enter email address" placeholderTextColor="#666" keyboardType="email-address" autoCapitalize="none" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="call-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={formData.phoneNumber} onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))} placeholder="Enter phone number" placeholderTextColor="#666" keyboardType="phone-pad" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Relationship</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="people-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput style={[styles.inputField, styles.flexInput]} value={formData.relationship} onChangeText={(text) => setFormData(prev => ({ ...prev, relationship: text }))} placeholder="e.g., Grandma, Uncle, Nanny" placeholderTextColor="#666" editable={isEditing} selectionColor="#6366f1" />
                </View>
              </View>
              {isEditing && (
                <View style={styles.preferenceRow}>
                  <View style={styles.preferenceInfo}>
                    <Ionicons name={formData.notificationsEnabled ? "notifications" : "notifications-off"} size={22} color={formData.notificationsEnabled ? "#6366f1" : "#94a3b8"} />
                    <View style={styles.preferenceText}>
                      <Text style={styles.preferenceTitle}>Notifications</Text>
                      <Text style={styles.preferenceDesc}>Receive alerts about family activities</Text>
                    </View>
                  </View>
                  <Switch value={formData.notificationsEnabled} onValueChange={(val) => setFormData(prev => ({ ...prev, notificationsEnabled: val }))} trackColor={{ false: '#334155', true: '#6366f1' }} thumbColor="#fff" />
                </View>
              )}
              {isEditing && (
                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                  <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.saveButtonGradient}>
                    {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </GlassCard>

            {/* Danger Zone - subtle, at bottom */}
            {canRemove && (
              <Animated.View entering={FadeInUp.delay(300).springify()}>
                <SectionHeader title="Danger Zone" subtitle="Irreversible actions" />
                <GlassCard>
                  <View style={styles.dangerContent}>
                    <View style={styles.dangerIconWrap}>
                      <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
                        <Ionicons name="warning" size={24} color="#fff" />
                      </LinearGradient>
                    </View>
                    <View style={styles.dangerText}>
                      <Text style={styles.dangerTitle}>Remove from Family</Text>
                      <Text style={styles.dangerDesc}>Their activity history will be preserved, but they will lose access to all family data. This cannot be undone.</Text>
                    </View>
                    <TouchableOpacity onPress={handleRemove} style={styles.dangerBtn}>
                      <Text style={styles.dangerBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              </Animated.View>
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* Modals */}
      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo">
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleImagePick}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#6366f120' }]}><Ionicons name="images-outline" size={28} color="#6366f1" /></View>
            <Text style={styles.imagePickerLabel}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}><Ionicons name="happy-outline" size={28} color="#f59e0b" /></View>
            <Text style={styles.imagePickerLabel}>Pick Emoji</Text>
          </TouchableOpacity>
        </View>
      </ActionModal>

      <ActionModal visible={showRoleModal} onClose={() => setShowRoleModal(false)} title="Manage Role">
        <View style={styles.roleOptions}>
          {Object.entries(ROLE_CONFIG).map(([role, config]) => (
            <TouchableOpacity key={role} style={[styles.roleOption, member.role === role && { backgroundColor: `${config.color}15`, borderColor: config.color }]} onPress={() => handleRoleChange(role as UserRole)}>
              <LinearGradient colors={config.gradient} style={styles.roleOptionIcon}><Ionicons name={config.icon as any} size={20} color="#fff" /></LinearGradient>
              <View style={styles.roleOptionInfo}><Text style={styles.roleOptionTitle}>{config.label}</Text><Text style={styles.roleOptionDesc}>{config.description}</Text></View>
              {member.role === role && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
            </TouchableOpacity>
          ))}
        </View>
      </ActionModal>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <View style={styles.emojiPickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
          <View style={styles.emojiPickerSheet}>
            <View style={styles.emojiPickerHeader}>
              <Text style={styles.emojiPickerTitle}>Pick an Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => { setFormData(prev => ({ ...prev, avatar: emoji })); setShowEmojiPicker(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — Completely Redesigned to match GrowthDashboard quality
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 24 },

  // ── Sticky Header ──
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },

  // ── Top Header ──
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  editToggleBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },

  // ── Profile Hero ──
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 16, marginBottom: 20 },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  profileMeta: { fontSize: 14, fontWeight: '500', color: '#94a3b8' },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
  profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },

  // ── Quick Actions Dock ──
  dockContainer: { marginHorizontal: 16, marginBottom: 20 },
  dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  dockItem: { alignItems: 'center', gap: 6, flex: 1 },
  dockGradient: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...DESIGN.shadow.md },
  dockLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  // ── Tab Bar ──
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, padding: 4, borderRadius: 16, gap: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  // ── Glass Card ──
  glassCard: { borderRadius: DESIGN.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...DESIGN.shadow.md, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

  // ── KPI Pills ──
  kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  kpiPill: { flex: 1, borderRadius: 20, overflow: 'hidden', padding: 14, ...DESIGN.shadow.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 20 },
  kpiPillBody: { flex: 1 },
  kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiPillLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── AI Insights ──
  insightsList: { marginHorizontal: 16, gap: 8, marginBottom: 16 },
  insightRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', borderLeftWidth: 3, ...DESIGN.shadow.sm },
  insightIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#94a3b8' },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
  insightActionText: { fontSize: 11, fontWeight: '700' },
  insightPriority: { width: 4, height: 36, borderRadius: 2 },

  // ── Sparkline ──
  sparklineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  sparklineTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sparklineSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
  sparklineTotal: { alignItems: 'flex-end' },
  sparklineTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  sparklineTotalLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  sparklineChart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, height: 100 },
  sparklineBar: { width: 8, borderRadius: 4 },
  sparklineDay: { fontSize: 10, fontWeight: '600', color: '#64748b' },

  // ── Health Score ──
  healthContainer: { flexDirection: 'row', padding: 16, gap: 16 },
  healthLeft: { flex: 1, gap: 4 },
  healthTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  healthSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginBottom: 8 },
  healthMetrics: { flexDirection: 'row', gap: 16, marginTop: 4 },
  healthMetric: { alignItems: 'center', gap: 2 },
  healthMetricValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  healthMetricLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  healthRingContainer: { justifyContent: 'center', alignItems: 'center' },
  healthRing: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  healthRingBg: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'rgba(255,255,255,0.06)' },
  healthRingFill: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderTopColor: 'transparent', borderRightColor: 'transparent', borderLeftColor: 'transparent' },
  healthRingEmoji: { fontSize: 16 },
  healthRingScore: { fontSize: 20, fontWeight: '800' },
  healthRingLabel: { fontSize: 9, fontWeight: '600', color: '#94a3b8' },

  // ── Smart Recommendations ──
  recCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', borderLeftWidth: 3, marginHorizontal: 16, marginBottom: 8, ...DESIGN.shadow.sm },
  recIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recEmoji: { fontSize: 20 },
  recContent: { flex: 1, marginHorizontal: 12, gap: 4 },
  recTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  recReason: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  recConfidence: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  recBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  recBarFill: { height: '100%', borderRadius: 2 },
  recConfidenceText: { fontSize: 10, fontWeight: '700' },

  // ── Timeline ──
  timelineContainer: { marginHorizontal: 16, gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineLine: { position: 'absolute', top: 0, bottom: 0, width: 2, left: 11, backgroundColor: 'rgba(255,255,255,0.06)' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', zIndex: 1 },
  timelineCard: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: 'rgba(45,45,60,0.6)', marginBottom: 12, ...DESIGN.shadow.sm },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  timelineEmoji: { fontSize: 20 },
  timelineMeta: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  timelineDate: { fontSize: 11, fontWeight: '500', color: '#94a3b8', marginTop: 1 },
  timelineDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8', lineHeight: 17 },

  // ── Contact Info ──
  contactList: { padding: 8 },
  contactItem: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  contactIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  contactBody: { flex: 1, gap: 2 },
  contactLabel: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  contactValue: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // ── Activity Tab ──
  activitiesList: { gap: 8, marginHorizontal: 16 },
  activityCard: { padding: 0 },
  activityRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  activityIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activityEmoji: { fontSize: 20 },
  activityContent: { flex: 1, gap: 2 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  activityDetails: { fontSize: 13, color: '#94a3b8', marginTop: 2, lineHeight: 18 },
  activityTime: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '500' },
  activityTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  activityTypeText: { fontSize: 11, fontWeight: '700' },

  // ── Empty States ──
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  // ── Permissions ──
  permissionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  permissionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 6 },
  permissionChipText: { fontSize: 13, fontWeight: '600' },
  permissionNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.08)', marginHorizontal: 16, marginBottom: 16 },
  permissionNoteText: { fontSize: 13, color: '#94a3b8', flex: 1, lineHeight: 18 },

  // ── Stats Grid ──
  statsGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', justifyContent: 'center', ...DESIGN.shadow.md },
  statCardValue: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statCardLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

  // ── Activity Breakdown ──
  activityBreakdown: { marginTop: 16, marginHorizontal: 16 },
  breakdownTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownBar: { width: 80, height: 6, borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 3 },
  breakdownCount: { fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'right' },

  // ── Manage Permissions Button ──
  managePermissionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, marginHorizontal: 16, marginTop: 8, ...DESIGN.shadow.sm },
  managePermissionsText: { fontSize: 15, fontWeight: '700', flex: 1, marginLeft: 12 },

  // ── Settings / Inputs ──
  inputGroup: { marginBottom: 16, paddingHorizontal: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  inputDisabled: { opacity: 0.5 },
  inputIcon: { marginRight: 12 },
  inputField: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '600' },
  inputText: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '600' },
  flexInput: { flex: 1 },
  ownedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
  ownedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Preferences ──
  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  preferenceText: { gap: 2 },
  preferenceTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  preferenceDesc: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // ── Save Button ──
  saveButton: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  saveButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Danger Zone ──
  dangerContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  dangerIconWrap: {},
  dangerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dangerText: { flex: 1, gap: 2 },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  dangerDesc: { fontSize: 12, color: '#94a3b8', lineHeight: 17 },
  dangerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ef444420' },
  dangerBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: DESIGN.radius.xl, padding: DESIGN.spacing.xxl, overflow: 'hidden', ...DESIGN.shadow.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },

  // ── Image Picker ──
  imagePickerOptions: { padding: 8 },
  imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
  imagePickerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  imagePickerLabel: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },

  // ── Role Modal ──
  roleOptions: { padding: 8 },
  roleOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  roleOptionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  roleOptionInfo: { flex: 1 },
  roleOptionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  roleOptionDesc: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  // ── Emoji Picker ──
  emojiPickerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 200 },
  emojiPickerSheet: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },

  // ── Retry ──
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});