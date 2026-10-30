import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  useColorScheme,
  useWindowDimensions,
  Pressable,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import type { RootStackParamList } from '../../types/navigation';
import { UserRole, ROLE_LABELS, getMemberDisplayLabel, canonicalizeRelationship } from '../../types/roles';
import { useFamily, FamilyMember } from '../../context/FamilyContext';
import type { AddMemberResult } from '../../context/FamilyContext';
import { useUser } from '../../context/UserContext';
import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../hooks/useTrackerContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../utils/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner, InlineSpinner } from '../../components/UniversalSpinner';

const GUARDIAN_IMAGES_DIR = FileSystem.documentDirectory + 'guardian_images/';
const COMMUNITY_AVATARS_BUCKET = 'community_avatars';

const generateUniqueFileName = (userId: string, ext: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${random}.${ext}`;
};

const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (Platform.OS === 'android' && !IS_FABRIC && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type EditGuardianScreenProps = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>;
type ActivityEntry = { type: string; timestamp: number; [k: string]: any };
type ProfileTab = 'overview' | 'activity' | 'permissions' | 'settings';

/* ─── Aura Design System ─── */
const DS = {
  primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5',
  accent: '#ec4899', accentLight: '#f472b6', success: '#10b981',
  warning: '#f59e0b', info: '#0ea5e9', danger: '#ef4444',
  white: '#ffffff', gray50: '#fafaf9', gray100: '#f5f5f4', gray200: '#e7e5e4',
  gray300: '#d6d3d1', gray400: '#a8a29e', gray500: '#78716c',
  gray600: '#57534e', gray700: '#44403c', gray800: '#292524', gray900: '#1c1917',
  darkBg: '#0c0a09', darkSurface: '#1c1917', darkCard: '#292524', darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const ROLE_CONFIG: Record<UserRole, {
  label: string; color: string; gradient: [string, string]; icon: string;
  description: string; permissions: string[]; canEdit: boolean; canRemove: boolean;
  badge: string; priority: number;
}> = {
  [UserRole.PARENT_1]: { label: 'Primary Parent', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'], icon: 'shield', description: 'Full owner access to everything', permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data', 'Billing'], canEdit: false, canRemove: false, badge: 'Owner', priority: 1 },
  [UserRole.PARENT_2]: { label: 'Co-Parent', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'], icon: 'heart', description: 'Full access to manage family and baby data', permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'], canEdit: true, canRemove: true, badge: 'Co-Parent', priority: 2 },
  [UserRole.GUARDIAN]: { label: 'Guardian', color: '#10b981', gradient: ['#10b981', '#34d399'], icon: 'shield-checkmark', description: 'Can add entries but cannot delete or manage family', permissions: ['Read', 'Write', 'Limited Delete'], canEdit: true, canRemove: true, badge: 'Guardian', priority: 3 },
  [UserRole.VIEWER]: { label: 'Viewer', color: '#94a3b8', gradient: ['#64748b', '#94a3b8'], icon: 'eye', description: 'View only access, cannot add or modify data', permissions: ['Read Only'], canEdit: true, canRemove: true, badge: 'Viewer', priority: 4 },
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

/* ═══════════════════════════════════════════════════════════════════════════
   Aura Sub-Components
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: any) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<any>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

const GlassCard = React.memo(({ children, style, isDark, delay = 0 }: any) => (
  <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }, style]}>
    <LinearGradient colors={isDark ? ['rgba(255,255,255,0.02)', 'transparent'] : ['rgba(255,255,255,0.4)', 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
    {children}
  </Animated.View>
));

const SectionHeader = React.memo(({ title, subtitle, icon, color = DS.primary, action, actionLabel }: any) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.sm }}>
      {icon && <View style={[styles.sectionIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={15} color={color} /></View>}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
    {action && (
      <TouchableOpacity onPress={action} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={[styles.sectionAction, { color }]}>{actionLabel || 'See All'}</Text>
        <Ionicons name="chevron-forward" size={13} color={color} />
      </TouchableOpacity>
    )}
  </View>
));

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: any) => (
  <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
    {tabs.map((tab: any) => {
      const active = activeTab === tab.key;
      return (
        <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : DS.white, ...DS.shadow.sm }]} activeOpacity={0.8}>
          <Ionicons name={tab.icon} size={14} color={active ? DS.primary : (isDark ? DS.gray400 : DS.gray500)} />
          <Text style={[styles.tabLabel, { color: active ? DS.primary : (isDark ? DS.gray400 : DS.gray500) }, active && { fontWeight: '700' }]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

/* ─── Identity Capsule ─── */
const MemberIdentityCapsule = React.memo<any>(({
  isDark, member, roleConfig, formData, isMemberVerified, isCurrentUser, isEditing, canEdit,
  memberActivities, onAvatarPress, onEditToggle, onMessage, onCall, onShare,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 9000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.8, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  if (!member || !roleConfig) return null;
  const avatarSrc = formData.avatar || member.avatar;

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient colors={isDark ? [`${roleConfig.color}30`, `${roleConfig.color}10`, 'rgba(139,92,246,0.04)'] : [`${roleConfig.color}15`, `${roleConfig.color}06`, 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <LinearGradient colors={[`${roleConfig.color}${isDark ? '45' : '28'}`, 'transparent']} style={styles.capsuleGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${roleConfig.gradient[1]}${isDark ? '35' : '22'}`, 'transparent']} style={styles.capsuleGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <View style={styles.capsuleRow}>
          <PressableScale onPress={onAvatarPress} disabled={!canEdit} activeScale={0.94}>
            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.avatarGlow, { backgroundColor: `${roleConfig.color}35` }, glowStyle]} />
              <Animated.View style={[styles.avatarRing, ringStyle]}>
                <LinearGradient colors={[roleConfig.gradient[0], roleConfig.gradient[1], DS.warning, roleConfig.gradient[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
                <SafeAvatar avatar={avatarSrc} size={78} fallbackIcon={roleConfig.icon as any} fallbackColor={roleConfig.color} fallbackBgColor={`${roleConfig.color}20`} borderWidth={0} />
              </View>
              {canEdit && (
                <View style={[styles.editBadge, { borderColor: isDark ? DS.darkSurface : DS.white, backgroundColor: roleConfig.color }]}>
                  <Ionicons name="camera" size={11} color={DS.white} />
                </View>
              )}
            </View>
          </PressableScale>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.capsuleName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
                {member.fullName}
              </Text>
              {isMemberVerified && (
                <View style={[styles.verifiedDot, { backgroundColor: roleConfig.color }]}>
                  <Ionicons name="checkmark" size={10} color={DS.white} />
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={[styles.roleBadge, { backgroundColor: `${roleConfig.color}18` }]}>
                <Ionicons name={roleConfig.icon as any} size={10} color={roleConfig.color} />
                <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
                  {getMemberDisplayLabel({ role: member.role, relationship: member.relationship })}
                </Text>
              </View>
              {member.relationship && member.relationship.trim().toLowerCase() !== getMemberDisplayLabel({ role: member.role, relationship: member.relationship }).toLowerCase() ? (
                <Text style={[styles.capsuleMeta, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
                  · {canonicalizeRelationship(member.relationship)}
                </Text>
              ) : null}
            </View>
            <View style={styles.capsuleStats}>
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: roleConfig.color }]}>{memberActivities.length}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>activities</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.warning }]}>{member?.streak || 0}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>streak</Text>
              </View>
              <View style={[styles.capsuleStatDiv, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />
              <View style={styles.capsuleStatItem}>
                <Text style={[styles.capsuleStatValue, { color: DS.accent }]}>{roleConfig.priority}</Text>
                <Text style={[styles.capsuleStatLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>priority</Text>
              </View>
            </View>
          </View>

          {canEdit && (
            <PressableScale onPress={onEditToggle} activeScale={0.9}>
              <View style={[styles.iconBtn, { backgroundColor: isEditing ? roleConfig.color : (isDark ? 'rgba(255,255,255,0.06)' : DS.gray100) }]}>
                <Ionicons name={isEditing ? 'close' : 'create-outline'} size={18} color={isEditing ? DS.white : (isDark ? DS.gray300 : DS.gray600)} />
              </View>
            </PressableScale>
          )}
        </View>

        {!isCurrentUser && (
          <View style={styles.capsuleActions}>
            <PressableScale onPress={onMessage} activeScale={0.94} style={{ flex: 1 }}>
              <LinearGradient colors={[roleConfig.gradient[0], roleConfig.gradient[1]]} style={styles.actionPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="chatbubbles" size={15} color={DS.white} />
                <Text style={[styles.actionPrimaryText, { color: DS.white }]}>Message</Text>
              </LinearGradient>
            </PressableScale>
            {member?.phoneNumber && (
              <PressableScale onPress={onCall} activeScale={0.94}>
                <View style={[styles.actionIcon, { backgroundColor: `${DS.success}15` }]}>
                  <Ionicons name="call" size={18} color={DS.success} />
                </View>
              </PressableScale>
            )}
            <PressableScale onPress={onShare} activeScale={0.94}>
              <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Ionicons name="share-outline" size={18} color={roleConfig.color} />
              </View>
            </PressableScale>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

/* ─── Insight Ribbon ─── */
const InsightRibbon = React.memo<any>(({ isDark, icon, color, label, text, onPress }) => (
  <Animated.View entering={FadeInUp.delay(80).springify()}>
    <PressableScale onPress={onPress} activeScale={0.98}>
      <View style={[styles.ribbon, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.ribbonIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ribbonLabel, { color }]}>{label}</Text>
          <Text style={[styles.ribbonText, { color: isDark ? DS.gray300 : DS.gray700 }]} numberOfLines={2}>{text}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={15} color={isDark ? DS.gray500 : DS.gray400} />}
      </View>
    </PressableScale>
  </Animated.View>
));

/* ─── Stat Tiles ─── */
const StatTiles = React.memo(({ isDark, stats }: any) => (
  <View style={styles.statTiles}>
    {stats.map((s: any, i: number) => (
      <Animated.View key={i} entering={FadeInUp.delay(i * 50).springify()} style={{ flex: 1 }}>
        <View style={[styles.statTile, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <View style={[styles.statTileIcon, { backgroundColor: `${s.color}15` }]}>
            <Ionicons name={s.icon} size={15} color={s.color} />
          </View>
          <Text style={[styles.statTileValue, { color: s.color }]}>{s.value}</Text>
          <Text style={[styles.statTileLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>{s.label}</Text>
        </View>
      </Animated.View>
    ))}
  </View>
));

/* ─── AI Insights Card ─── */
const AIMemberInsights = React.memo(({ member, activities, isDark }: any) => {
  const insights = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const weekActs = activities.filter((a: any) => a.timestamp > weekAgo);
    const monthActs = activities.filter((a: any) => a.timestamp > monthAgo);
    const engagementScore = Math.min(100, Math.round((weekActs.length / 7) * 100));
    const consistencyScore = monthActs.length > 0 ? Math.min(100, Math.round((monthActs.length / 30) * 100)) : 0;
    const topType = activities.reduce((acc: any, a: any) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
    const topTypeKey = Object.entries(topType).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'default';
    const lastActive = activities[0]?.timestamp || 0;
    const daysSince = lastActive ? Math.floor((now - lastActive) / (24 * 60 * 60 * 1000)) : 999;
    const items: any[] = [];
    if (engagementScore > 80) items.push({ emoji: '🔥', title: 'Super Active', desc: 'Top 10% of family contributors', color: DS.warning });
    else if (engagementScore < 30 && weekActs.length < 2) items.push({ emoji: '💤', title: 'Low Engagement', desc: 'Consider inviting them to log entries', color: DS.danger });
    if (consistencyScore > 70) items.push({ emoji: '📅', title: 'Consistent Logger', desc: 'Regular daily participation', color: DS.success });
    if (daysSince > 7 && lastActive) items.push({ emoji: '⏰', title: `${daysSince} Days Inactive`, desc: `Last seen ${new Date(lastActive).toLocaleDateString()}`, color: DS.danger });
    if (topTypeKey && topTypeKey !== 'default') {
      const cfg = ACTIVITY_CONFIG[topTypeKey] || ACTIVITY_CONFIG.default;
      items.push({ emoji: cfg.emoji, title: `Prefers ${cfg.label}`, desc: 'Most frequent activity type', color: cfg.color });
    }
    return items.slice(0, 3);
  }, [activities]);

  if (insights.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).springify()}>
      <SectionHeader title="AI Insights" subtitle="Intelligence-powered analysis" icon="sparkles-outline" color={DS.accent} />
      <GlassCard isDark={isDark}>
        <View style={{ padding: DS.space.md, gap: 8 }}>
          {insights.map((insight: any, i: number) => (
            <View key={i} style={[styles.insightRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderLeftColor: insight.color }]}>
              <Text style={{ fontSize: 18 }}>{insight.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.insightTitle, { color: isDark ? DS.white : DS.gray900 }]}>{insight.title}</Text>
                <Text style={[styles.insightDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{insight.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
});

/* ─── Activity Sparkline Card ─── */
const ActivitySparkline = React.memo(({ activities, isDark }: { activities: ActivityEntry[]; isDark: boolean }) => {
  const data = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days[d.toISOString().split('T')[0]] = 0; }
    activities.forEach(a => { const d = new Date(a.timestamp).toISOString().split('T')[0]; if (days[d] !== undefined) days[d]++; });
    return Object.values(days);
  }, [activities]);
  const maxVal = Math.max(...data, 1);
  return (
    <GlassCard isDark={isDark} delay={40}>
      <View style={{ padding: DS.space.md }}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIcon, { backgroundColor: `${DS.primary}15` }]}>
              <Ionicons name="bar-chart-outline" size={14} color={DS.primary} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Weekly Activity</Text>
              <Text style={[styles.cardSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>Last 7 days</Text>
            </View>
          </View>
          <View style={[styles.cardPill, { backgroundColor: `${DS.primary}15` }]}>
            <Text style={[styles.cardPillText, { color: DS.primary }]}>{data.reduce((a, b) => a + b, 0)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 70, marginTop: DS.space.md }}>
          {data.map((val, i) => {
            const height = Math.max(4, (val / maxVal) * 56);
            const isToday = i === data.length - 1;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                <View style={[styles.sparkBar, { height, backgroundColor: isToday ? DS.primary : val > 0 ? `${DS.primary}80` : `${DS.primary}30` }]} />
                <Text style={[styles.sparkLabel, { color: isToday ? DS.primary : (isDark ? DS.gray500 : DS.gray400), fontWeight: isToday ? '800' : '600' }]}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </GlassCard>
  );
});

/* ─── Relationship Health Card ─── */
const RelationshipHealth = React.memo(({ member, activities, isDark }: any) => {
  const health = useMemo(() => {
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recent = activities.filter((a: any) => a.timestamp > monthAgo);
    const frequency = Math.min(100, (recent.length / 10) * 100);
    const recency = member?.lastActive ? Math.max(0, 100 - ((now - new Date(member.lastActive).getTime()) / (7 * 24 * 60 * 60 * 1000)) * 100) : 0;
    const diversity = new Set(activities.map((a: any) => a.type)).size;
    const diversityScore = Math.min(100, (diversity / 5) * 100);
    const score = Math.round((frequency * 0.4) + (recency * 0.35) + (diversityScore * 0.25));
    let status = { label: 'Excellent', color: DS.success };
    if (score < 40) status = { label: 'Needs Attention', color: DS.danger };
    else if (score < 70) status = { label: 'Good', color: DS.warning };
    else if (score < 90) status = { label: 'Great', color: DS.primary };
    return { score, status, frequency, recency, diversityScore };
  }, [member, activities]);

  return (
    <GlassCard isDark={isDark} delay={80}>
      <View style={{ padding: DS.space.md }}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIcon, { backgroundColor: `${health.status.color}15` }]}>
              <Ionicons name="heart" size={14} color={health.status.color} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Relationship Health</Text>
              <Text style={[styles.cardSub, { color: isDark ? DS.gray500 : DS.gray400 }]}>Family integration score</Text>
            </View>
          </View>
          <View style={[styles.cardPill, { backgroundColor: `${health.status.color}15` }]}>
            <Text style={[styles.cardPillText, { color: health.status.color }]}>{health.status.label}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: DS.space.lg, marginTop: DS.space.md }}>
          <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: `${health.status.color}20` }} />
            <View style={{ position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: health.status.color, borderTopColor: 'transparent', borderRightColor: 'transparent', transform: [{ rotate: `${-90 + (health.score / 100) * 360}deg` }] }} />
            <Text style={{ fontSize: 22, fontWeight: '800', color: health.status.color }}>{health.score}</Text>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {[
              { label: 'Frequency', value: Math.round(health.frequency), color: DS.primary },
              { label: 'Recency', value: Math.round(health.recency), color: DS.success },
              { label: 'Diversity', value: Math.round(health.diversityScore), color: DS.accent },
            ].map((m) => (
              <View key={m.label} style={{ gap: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[styles.barLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>{m.label}</Text>
                  <Text style={[styles.barValue, { color: m.color }]}>{m.value}%</Text>
                </View>
                <View style={[styles.barBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <View style={[styles.barFill, { width: `${m.value}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </GlassCard>
  );
});

/* ─── Smart Role Recommendations ─── */
const SmartRoleRecommendations = React.memo(({ member, activities, onRoleChange, canManage, isDark }: any) => {
  const recommendations = useMemo(() => {
    const recs: any[] = [];
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = activities.filter((a: any) => a.timestamp > monthAgo);
    if (member?.role === UserRole.VIEWER && recent.length > 15) {
      recs.push({ to: UserRole.GUARDIAN, reason: 'High activity suggests they could contribute more', confidence: 85, emoji: '⬆️', color: DS.success });
    }
    if (member?.role === UserRole.GUARDIAN && recent.length < 3) {
      recs.push({ to: UserRole.VIEWER, reason: 'Low activity — viewer access may be more appropriate', confidence: 72, emoji: '⬇️', color: DS.warning });
    }
    if (member?.role === UserRole.GUARDIAN && recent.length > 25) {
      recs.push({ to: UserRole.PARENT_2, reason: 'Exceptional contribution level detected', confidence: 68, emoji: '⭐', color: DS.primary });
    }
    return recs;
  }, [member, activities]);

  if (!canManage || recommendations.length === 0) return null;

  return (
    <View style={{ marginTop: DS.space.md }}>
      <SectionHeader title="Smart Suggestions" subtitle="AI-suggested role adjustments" icon="bulb-outline" color={DS.warning} />
      <View style={{ gap: 8 }}>
        {recommendations.map((rec: any, i: number) => (
          <PressableScale key={i} onPress={() => onRoleChange(rec.to)} activeScale={0.97}>
            <View style={[styles.recCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200, borderLeftColor: rec.color }]}>
              <Text style={{ fontSize: 22 }}>{rec.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                  Promote to <Text style={{ color: rec.color }}>{ROLE_CONFIG[rec.to].label}</Text>
                </Text>
                <Text style={[styles.recReason, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{rec.reason}</Text>
                <View style={[styles.barBg, { backgroundColor: `${rec.color}15`, marginTop: 6 }]}>
                  <View style={[styles.barFill, { width: `${rec.confidence}%`, backgroundColor: rec.color }]} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? DS.gray500 : DS.gray400} />
            </View>
          </PressableScale>
        ))}
      </View>
    </View>
  );
});

/* ─── Engagement Timeline ─── */
const EngagementTimeline = React.memo(({ member, activities, milestones, isDark }: any) => {
  const timelineItems = useMemo(() => {
    const items: any[] = [];
    if (member?.addedAt) items.push({ date: member.addedAt, title: 'Joined Family', desc: `Added as ${ROLE_CONFIG[member.role]?.label || member.role}`, emoji: '👋', color: DS.primary });
    const firstActivity = [...activities].sort((a, b) => a.timestamp - b.timestamp)[0];
    if (firstActivity) { const cfg = ACTIVITY_CONFIG[firstActivity.type] || ACTIVITY_CONFIG.default; items.push({ date: new Date(firstActivity.timestamp).toISOString(), title: 'First Activity', desc: `Logged ${cfg.label}`, emoji: '🎯', color: DS.success }); }
    const milestonesByMember = milestones?.filter((m: any) => m.loggedBy === member?.id || m.loggedByName === member?.fullName).slice(0, 2);
    milestonesByMember?.forEach((m: any) => items.push({ date: m.achievedAt || m.timestamp, title: 'Milestone Logged', desc: m.title, emoji: '🏆', color: DS.warning }));
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-4);
  }, [member, activities, milestones]);

  if (timelineItems.length === 0) return null;

  return (
    <View style={{ marginTop: DS.space.md }}>
      <SectionHeader title="Engagement Timeline" subtitle="Key moments with this member" icon="time-outline" color={DS.info} />
      <View style={[styles.timelineCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        {timelineItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: DS.space.md, paddingVertical: DS.space.sm, borderBottomWidth: i < timelineItems.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }}>
            <View style={{ alignItems: 'center', paddingTop: 4 }}>
              <View style={[styles.timelineDot, { backgroundColor: item.color }]}>
                <Text style={{ fontSize: 12 }}>{item.emoji}</Text>
              </View>
              {i < timelineItems.length - 1 && <View style={[styles.timelineLine, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]} />}
            </View>
            <View style={{ flex: 1, paddingBottom: i < timelineItems.length - 1 ? 6 : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.timelineTitle, { color: isDark ? DS.white : DS.gray900 }]}>{item.title}</Text>
                <Text style={[styles.timelineDate, { color: isDark ? DS.gray500 : DS.gray400 }]}>
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={[styles.timelineDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

/* ─── Activity Row ─── */
const ActivityRow = React.memo<any>(({ activity, index, isDark }) => {
  const cfg = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
  return (
    <Animated.View entering={FadeInUp.delay(index * 40).springify()}>
      <View style={[styles.activityRow, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <View style={[styles.activityIcon, { backgroundColor: `${cfg.color}15` }]}>
          <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.activityTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
            {activity.title || cfg.label}
          </Text>
          {activity.details && (
            <Text style={[styles.activityNotes, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>{activity.details}</Text>
          )}
          <Text style={[styles.activityTime, { color: isDark ? DS.gray500 : DS.gray400 }]}>
            {new Date(activity.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.activityBadge, { backgroundColor: `${cfg.color}15` }]}>
          <Text style={[styles.activityBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    </Animated.View>
  );
});

/* ─── Capsule Skeleton ─── */
const CapsuleSkeleton = React.memo(({ isDark }: any) => (
  <View style={[styles.capsule, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
    <View style={styles.capsuleRow}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 20, width: 140, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
        <View style={{ height: 13, width: 100, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }} />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ gap: 4 }}>
              <View style={{ height: 14, width: 28, borderRadius: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
              <View style={{ height: 10, width: 40, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  </View>
));

/* ─── Modals ─── */
const ActionModal = React.memo(({ visible, onClose, title, children, isDark }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalDrag}><View style={[styles.dragIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} /></View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

const EmojiPickerModal = React.memo(({ visible, onClose, onSelect, isDark }: any) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalCard, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalDrag}><View style={[styles.dragIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} /></View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.gray300 : DS.gray600} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => { onSelect(emoji); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} style={[styles.emojiBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EditGuardianScreen({ navigation, route }: EditGuardianScreenProps) {
    const params = (route.params ?? {}) as {
    guardianId?: string;
    memberId?: string;
    mode?: 'guardian' | 'parent2' | 'viewer';
    fromChat?: boolean;
    fromFamily?: boolean;
  };
  const cameFromFamily = params.fromFamily === true;
  const guardianId = params.guardianId ?? params.memberId ?? '';
  const mode = params.mode ?? 'guardian';

  const { members, updateGuardianProfile, promoteMember, removeMember, loadFamily, refreshFamily, addMemberDirectly } = useFamily();
  const { hasPermission, profile, updateProfile } = useUser();
  const { currentBaby, milestones, refreshBabyData } = useBaby();
  const { entries: trackerEntries } = useTracker();
  const { userProfile } = useAuth();
  const { darkMode, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');

  const { width: SCREEN_W } = useWindowDimensions();
  const isCompact = SCREEN_W < 360;

  const isLoadingRef = useRef(false);
  const initialLoadDone = useRef(false);
  const isMountedRef = useRef(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveConfirmOpenRef = useRef(false);

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const [member, setMember] = useState<FamilyMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberIdentifier, setAddMemberIdentifier] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<UserRole>(UserRole.GUARDIAN);
  const [addMemberRelationship, setAddMemberRelationship] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [memberActivities, setMemberActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isMemberVerified, setIsMemberVerified] = useState(false);

  const [formData, setFormData] = useState({ fullName: '', email: '', phoneNumber: '', relationship: '', username: '', avatar: '', notificationsEnabled: true });
  const [originalData, setOriginalData] = useState({ fullName: '', email: '', phoneNumber: '', relationship: '', username: '', avatar: '', notificationsEnabled: true });

  const [usernameCheck, setUsernameCheck] = useState<{ available: boolean; message: string } | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const usernameDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
  }));

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

  const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
  const isCurrentUser = useMemo(() => {
    if (!member || !currentUserId) return false;
    const memberUserId = (member as any).userId || member.id;
    return memberUserId === currentUserId || member.id === currentUserId;
  }, [member, currentUserId]);

  const roleConfig = member ? ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER] : null;
  const canEdit = useMemo(() => { if (isCurrentUser) return true; return hasPermission('manageFamily') && roleConfig?.canEdit; }, [hasPermission, roleConfig, isCurrentUser]);
  const canRemove = useMemo(() => hasPermission('manageFamily') && roleConfig?.canRemove && !isCurrentUser, [hasPermission, roleConfig, isCurrentUser]);
  const canManagePermissions = useMemo(() => hasPermission('manageFamily') && !isCurrentUser, [hasPermission, isCurrentUser]);

  /* ─── PERSIST PICKED IMAGE ─── */
  const persistPickedImage = useCallback(async (sourceUri: string, memberId: string): Promise<{ localUri: string; publicUrl: string } | null> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(GUARDIAN_IMAGES_DIR);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(GUARDIAN_IMAGES_DIR, { intermediates: true });
      const ext = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const localUri = `${GUARDIAN_IMAGES_DIR}${memberId}_${Date.now()}.${safeExt}`;
      if (sourceUri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (sourceUri.startsWith('data:')) {
        const base64Data = sourceUri.split(',')[1];
        if (!base64Data) throw new Error('Invalid data URI');
        await FileSystem.writeAsStringAsync(localUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      } else await FileSystem.copyAsync({ from: sourceUri, to: localUri });
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) return null;
      const fileData = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const fileName = generateUniqueFileName(memberId, safeExt);
      const storagePath = `avatars/${fileName}`;
      try {
        const { error: bucketErr } = await supabase.storage.getBucket(COMMUNITY_AVATARS_BUCKET);
        if (bucketErr && /not found/i.test(bucketErr.message)) await supabase.storage.createBucket(COMMUNITY_AVATARS_BUCKET, { public: true });
      } catch {}
      const { error: uploadError } = await supabase.storage.from(COMMUNITY_AVATARS_BUCKET).upload(storagePath, decode(fileData), { contentType: `image/${safeExt}`, cacheControl: '3600', upsert: true });
      if (uploadError) { if (__DEV__) console.warn('[persistPickedImage] Storage upload failed:', uploadError.message); return { localUri, publicUrl: localUri }; }
      const { data: urlData } = supabase.storage.from(COMMUNITY_AVATARS_BUCKET).getPublicUrl(storagePath);
      return { localUri, publicUrl: urlData.publicUrl };
    } catch (error) { if (__DEV__) console.warn('[persistPickedImage] Failed:', error); return null; }
  }, []);

  /* ─── LOAD MEMBER ACTIVITIES ─── */
  const loadMemberActivities = useCallback(async (memberId: string, memberUserId?: string, memberName?: string) => {
    if (!currentBaby) return;
    setIsLoadingActivities(true);
    try {
      // `loggedBy` is a profile UUID. Match on `memberUserId` first
      // (the canonical `family_members.user_id`), then on `member.id`
      // as a legacy fallback (some very old rows logged by the
      // family_members.id), then on the exact display name.
      const matchesByUserId = (a: any) =>
        !!memberUserId && (
          a.loggedBy === memberUserId ||
          (a as any).loggedByUserId === memberUserId
        );
      const memberActs = trackerEntries.filter((a: any) => {
        if (a.isDeleted) return false;
        if (matchesByUserId(a)) return true;
        if (a.loggedBy === memberId) return true;
        if (memberName && a.loggedByName === memberName) return true;
        return false;
      });
      if (isMountedRef.current) setMemberActivities(memberActs.sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 30));
    } catch (error) { if (isMountedRef.current) setMemberActivities([]); }
    finally { if (isMountedRef.current) setIsLoadingActivities(false); }
  }, [currentBaby, trackerEntries]);

  /* ─── LOAD MEMBER DATA ─── */
  const loadMemberData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsHydrating(true);
    try {
      await loadFamily();
      // `guardianId` may be either a `family_members.id` OR a `profiles.id`
      // (userId). The chat screen passes a participant userId, so match both.
      let found =
        members.find(m => m.id === guardianId) ||
        members.find(m => (m as any).userId === guardianId);
      if (!found) {
        const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
        if (guardianId === currentUserIdLocal || guardianId === 'parent1') {
          found = {
            id: currentUserIdLocal || 'parent1', userId: currentUserIdLocal || 'parent1',
            fullName: userProfile?.fullName || profile?.fullName || 'Primary Parent',
            email: userProfile?.email || profile?.email || '',
            phoneNumber: userProfile?.phoneNumber || profile?.phoneNumber || '',
            avatar: userProfile?.avatar || profile?.avatar || '',
            role: UserRole.PARENT_1,
            relationship: '',   // ← leave empty so getMemberDisplayLabel
                                //   falls back to "Primary Parent" instead of
                                //   shadowing a real relationship like "Mother".
            addedAt: new Date().toISOString(), lastActive: new Date().toISOString(),
            notificationsEnabled: true, canBeRemove: false, canEdit: false,
          } as FamilyMember;
        }
      }
      if (found && isMountedRef.current) {
        setMember(found);
        let username = '';
        let canonicalAvatar = '';
        let verifiedFromDb = false;
        const profileIdForLookup = found.id === (userProfile?.id || userProfile?.uid || profile?.id)
          ? (userProfile?.id || userProfile?.uid || profile?.id)
          : (found as any).userId;
        if (profileIdForLookup) {
          try {
            const { data } = await supabase.from('profiles').select('community_handle, community_username, community_avatar, avatar_url, is_verified').eq('id', profileIdForLookup).maybeSingle();
            if (data) {
              username = (data.community_handle || '').replace(/^@/, '') || (data.community_username || '');
              canonicalAvatar = data.community_avatar || data.avatar_url || '';
              verifiedFromDb = data.is_verified === true;
            }
          } catch {}
        }
        if (isMountedRef.current) setIsMemberVerified(verifiedFromDb);
        const resolvedAvatar = canonicalAvatar || found.avatar || '';
        const initialData = {
          fullName: found.fullName || '', email: found.email || '', phoneNumber: found.phoneNumber || '',
          relationship: found.relationship || '', username, avatar: resolvedAvatar, notificationsEnabled: found.notificationsEnabled ?? true,
        };
        setFormData(initialData);
        setOriginalData(initialData);
        if (currentBaby) await loadMemberActivities(found.id, found.userId, found.fullName);
      } else if (isMountedRef.current) {
        // Fallback: `members` can be empty if the current user has no
        // family_members row (parent1 often doesn't). Query profiles
        // + family_members directly so the chat tap still works.
        if (guardianId) {
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id, full_name, email, phone_number, avatar_url, community_avatar')
              .eq('id', guardianId)
              .maybeSingle();
            if (prof && isMountedRef.current) {
              const fallback: FamilyMember = {
                id: prof.id,
                userId: prof.id,
                fullName: prof.full_name || 'Family Member',
                email: prof.email || '',
                phoneNumber: prof.phone_number || '',
                avatar: prof.community_avatar || prof.avatar_url || '',
                role: UserRole.GUARDIAN,
                relationship: '',
                addedAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                notificationsEnabled: true,
                canBeRemove: false,
                canEdit: true,
              } as FamilyMember;
              setMember(fallback);
              const initialData = {
                fullName: fallback.fullName,
                email: fallback.email,
                phoneNumber: fallback.phoneNumber,
                relationship: '',
                username: '',
                avatar: fallback.avatar,
                notificationsEnabled: true,
              };
              setFormData(initialData);
              setOriginalData(initialData);
              return;
            }
          } catch (e) {
            if (__DEV__) console.warn('[EditGuardian] profile fallback failed:', e);
          }
        }
        sweetAlert.error(
          'Member Not Found',
          !guardianId ? 'No member ID provided.' : 'Could not find this member.',
        );
      }
    } catch (error) { if (__DEV__) console.warn('[EditGuardian] load error:', error); }
    finally { isLoadingRef.current = false; if (isMountedRef.current) setIsHydrating(false); }
  }, [guardianId, members, loadFamily, userProfile, profile, currentBaby, sweetAlert, loadMemberActivities]);

  /* ─── REFRESH MEMBER DATA ─── */
  /* ─── REFRESH MEMBER DATA ─── */
  const refreshMemberData = useCallback(async () => {
    if (isLoadingRef.current || !member) return;
    isLoadingRef.current = true;
    try {
      // ── FIX: await loadFamily() (not refreshFamily) so we can read
      // the *fresh* state after the async DB round-trip completes.
      // `refreshFamily` is fire-and-forget relative to `members`; the
      // stale closure is why the role reverted on every focus.
      await loadFamily();

      // Read the freshly-loaded members from the DB directly to avoid
      // any stale closure. This is the authoritative source.
      let dbRow: any = null;
      try {
        const { data: row } = await supabase
          .from('family_members')
          .select('*')
          .eq('baby_id', currentBaby?.id || '')
          .or(`id.eq.${member.id},user_id.eq.${(member as any).userId || member.id}`)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        dbRow = row;
      } catch (e) {
        if (__DEV__) console.warn('[EditGuardian] fresh DB read failed:', e);
      }

      // Prefer the DB row (authoritative role), then the members array.
      let resolvedMember: FamilyMember | null = null;
      if (dbRow) {
        resolvedMember = {
          id: dbRow.id,
          userId: dbRow.user_id,
          fullName: dbRow.full_name,
          email: dbRow.email,
          avatar: dbRow.avatar,
          role: dbRow.role,
          relationship: dbRow.relationship,
          permissions: dbRow.permissions,
          addedAt: dbRow.added_at,
          addedBy: dbRow.added_by,
          canBeRemoved: dbRow.can_be_removed !== false,
          lastActive: dbRow.last_active,
          phoneNumber: dbRow.phone_number,
          notificationsEnabled: dbRow.notifications_enabled !== false,
          status: dbRow.status || 'active',
        } as FamilyMember;
      } else {
        const byRowId = members.find(m => m.id === member.id);
        const byUserId = members.find(
          (m: any) => m.userId === (member as any).userId,
        );
        resolvedMember = byRowId || byUserId || null;
      }

      // (Fallback DB read below this line stays as-is — leave it.)
      if (!resolvedMember && guardianId) {
        try {
          const { data: row } = await supabase
            .from('family_members')
            .select('*')
            .eq('baby_id', currentBaby?.id || '')
            .or(`id.eq.${guardianId},user_id.eq.${guardianId}`)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (row) {
            resolvedMember = {
              id: row.id,
              userId: row.user_id,
              fullName: row.full_name,
              email: row.email,
              avatar: row.avatar,
              role: row.role,
              relationship: row.relationship,
              permissions: row.permissions,
              addedAt: row.added_at,
              addedBy: row.added_by,
              canBeRemoved: row.can_be_removed !== false,
              lastActive: row.last_active,
              phoneNumber: row.phone_number,
              notificationsEnabled: row.notifications_enabled !== false,
              status: row.status || 'active',
            } as FamilyMember;
          }
        } catch {}
      }

      if (resolvedMember && isMountedRef.current) {
        setMember(resolvedMember);
        let username = formData.username;
        let verifiedFromDb = isMemberVerified;
        const profileIdForLookup =
          resolvedMember.id === (userProfile?.id || userProfile?.uid || profile?.id)
            ? (userProfile?.id || userProfile?.uid || profile?.id)
            : (resolvedMember as any).userId;
        if (profileIdForLookup) {
          try {
            const { data } = await supabase
              .from('profiles')
              .select('community_handle, community_username, is_verified')
              .eq('id', profileIdForLookup)
              .maybeSingle();
            if (data) {
              username =
                (data.community_handle || '').replace(/^@/, '') ||
                data.community_username ||
                username;
              verifiedFromDb = data.is_verified === true;
            }
          } catch {}
        }
        if (isMountedRef.current) setIsMemberVerified(verifiedFromDb);
        const initialData = {
          fullName: resolvedMember.fullName || '',
          email: resolvedMember.email || '',
          phoneNumber: resolvedMember.phoneNumber || '',
          relationship: resolvedMember.relationship || '',
          username,
          avatar: resolvedMember.avatar || '',
          notificationsEnabled: resolvedMember.notificationsEnabled ?? true,
        };
        setFormData(initialData);
        setOriginalData(initialData);
        if (currentBaby) {
          await loadMemberActivities(
            resolvedMember.id,
            resolvedMember.userId,
            resolvedMember.fullName,
          );
        }
      }
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] refresh error:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [
    member,
    members,
    loadFamily,
    refreshBabyData,
    currentBaby,
    loadMemberActivities,
    formData.username,
    userProfile,
    profile,
    isMemberVerified,
    guardianId,
  ]);
  /* ─── INITIAL LOAD ─── */
  useEffect(() => {
    if (!initialLoadDone.current) { initialLoadDone.current = true; loadMemberData(); }
    return () => { isMountedRef.current = false; };
  }, []);

  /* ─── USERNAME AVAILABILITY ─── */
  useEffect(() => {
    if (usernameDebounceRef.current) { clearTimeout(usernameDebounceRef.current); usernameDebounceRef.current = null; }
    const trimmed = formData.username.trim().toLowerCase().replace(/^@/, '');
    if (trimmed === originalData.username.trim().toLowerCase().replace(/^@/, '')) { setUsernameCheck(null); setIsCheckingUsername(false); return; }
    if (!trimmed || trimmed.length < 3) { setUsernameCheck(trimmed.length === 0 ? null : { available: false, message: 'Username must be at least 3 characters' }); return; }
    setIsCheckingUsername(true);
    setUsernameCheck(null);
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('id, community_handle, community_username').or(`community_handle.eq.@${trimmed},community_username.eq.${trimmed}`).limit(2);
        if (error) { setUsernameCheck({ available: false, message: 'Could not verify availability' }); return; }
        const ownerId = (data || [])[0]?.id;
        const myProfileId = member?.id === (userProfile?.id || userProfile?.uid || profile?.id) ? (userProfile?.id || userProfile?.uid || profile?.id) : (member as any)?.userId;
        setUsernameCheck(!ownerId || ownerId === myProfileId ? { available: true, message: 'Username is available' } : { available: false, message: 'Username is already taken' });
      } catch { setUsernameCheck({ available: false, message: 'Could not verify availability' }); }
      finally { setIsCheckingUsername(false); }
    }, 450);
    return () => { if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current); };
  }, [formData.username, originalData.username, member, userProfile, profile]);

  /* ─── CLEANUP ─── */
  useEffect(() => {
    return () => { isMountedRef.current = false; if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []);

  /* ─── FOCUS EFFECT ─── */
  useFocusEffect(useCallback(() => {
    if (member && !isLoadingRef.current) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => refreshMemberData(), 300);
    }
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [member, refreshMemberData]));

  const verifyPassword = useCallback(async (_password: string): Promise<boolean> => { return true; }, []);

  /* ─── HANDLE SAVE ─── */
  const handleSave = async () => {
    if (!member) return;
    if (saveConfirmOpenRef.current || isSaving) return;
    if (!formData.fullName.trim()) { sweetAlert.error('Validation Error', 'Name is required'); triggerHaptic('error'); return; }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { sweetAlert.error('Validation Error', 'Please enter a valid email address'); triggerHaptic('error'); return; }

    saveConfirmOpenRef.current = true;
    setIsSaving(true);
    triggerHaptic('medium');

    const updates: Partial<FamilyMember> = {};
    const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
    const isCurrentUserLocal = member.id === currentUserIdLocal;
    const linkedProfileId: string | undefined = isCurrentUserLocal ? currentUserIdLocal : (member as any).userId || undefined;
    const profileUpdates: Record<string, unknown> = {};

    const normalizeHandle = (v: string) => v.trim().toLowerCase().replace(/^@/, '');
    const cleanUsername = normalizeHandle(formData.username);
    const originalUsername = normalizeHandle(originalData.username);

    if (cleanUsername !== originalUsername && cleanUsername.length > 0) {
      if (cleanUsername.length < 3) { setIsSaving(false); saveConfirmOpenRef.current = false; sweetAlert.error('Invalid Username', 'Username must be at least 3 characters'); triggerHaptic('error'); return; }
      if (cleanUsername.length > 30) { setIsSaving(false); saveConfirmOpenRef.current = false; sweetAlert.error('Invalid Username', 'Username must be less than 30 characters'); triggerHaptic('error'); return; }
      if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(cleanUsername)) { setIsSaving(false); saveConfirmOpenRef.current = false; sweetAlert.error('Invalid Username', 'Must start with a letter. Only letters, numbers, underscores, and dots allowed.'); triggerHaptic('error'); return; }
      try {
        const { data: existing } = await supabase.from('profiles').select('id').or(`community_handle.eq.@${cleanUsername},community_username.eq.${cleanUsername}`).maybeSingle();
        if (existing && existing.id !== linkedProfileId) { setIsSaving(false); saveConfirmOpenRef.current = false; sweetAlert.error('Username Taken', 'That username is already in use'); triggerHaptic('error'); return; }
      } catch {}
      if (linkedProfileId) { profileUpdates.community_handle = `@${cleanUsername}`; profileUpdates.community_username = cleanUsername; }
    } else if (cleanUsername !== originalUsername && cleanUsername.length === 0) {
      setIsSaving(false); saveConfirmOpenRef.current = false; sweetAlert.error('Invalid Username', 'Username cannot be empty'); triggerHaptic('error'); return;
    }

    if (!isCurrentUserLocal && formData.fullName !== originalData.fullName) { updates.fullName = formData.fullName.trim(); if (linkedProfileId) profileUpdates.full_name = formData.fullName.trim(); }
    if (formData.email !== originalData.email) { updates.email = formData.email.trim(); if (linkedProfileId) profileUpdates.email = formData.email.trim(); }
    if (formData.phoneNumber !== originalData.phoneNumber) { updates.phoneNumber = formData.phoneNumber.trim(); if (linkedProfileId) profileUpdates.phone_number = formData.phoneNumber.trim(); }
    if (formData.relationship !== originalData.relationship) updates.relationship = formData.relationship.trim();
    if (formData.avatar !== originalData.avatar) { updates.avatar = formData.avatar; if (linkedProfileId) { profileUpdates.avatar = formData.avatar; profileUpdates.avatar_url = formData.avatar; profileUpdates.community_avatar = formData.avatar; } }
    if (formData.notificationsEnabled !== originalData.notificationsEnabled) { updates.notificationsEnabled = formData.notificationsEnabled; if (linkedProfileId) profileUpdates.notifications_enabled = formData.notificationsEnabled; }

    // ── ROLE UPGRADE GUARD ────────────────────────────────────────
    // The role picker (`handleRoleChange`) writes `family_members.role`
    // AND `profiles.role`. If this save path also writes `updates.role`
    // we'd be fighting the picker. So do NOT touch role here — the
    // only way to change role is via the "Manage Role & Permissions"
    // button, which calls `updateGuardianProfile(member.id, { role })`
    // directly.

    if (Object.keys(updates).length === 0) { sweetAlert.toast('No Changes', 'No changes were made'); setIsEditing(false); setIsSaving(false); saveConfirmOpenRef.current = false; return; }

    try {
      if (linkedProfileId && Object.keys(profileUpdates).length > 0) {
        try {
          const { error: profileErr } = await supabase.from('profiles').update({ ...profileUpdates, updated_at: new Date().toISOString() }).eq('id', linkedProfileId);
          if (profileErr && __DEV__) console.warn('[EditGuardian] profiles sync failed:', profileErr.message);
        } catch (e) { if (__DEV__) console.warn('[EditGuardian] profiles sync threw:', e); }
      }
      if (isCurrentUserLocal) {
        try { await updateProfile({ phoneNumber: formData.phoneNumber, email: formData.email, avatar: formData.avatar }); } catch {}
      }
      const success = await updateGuardianProfile(member.id, updates);
      if (success) {
        triggerHaptic('success');
        setIsEditing(false);
        setMember(prev => prev ? { ...prev, ...updates } : null);
        setOriginalData({ ...formData });

        // Fan out so chat avatars, family list, community feed, and
        // any other screen showing this member re-render immediately.
        try {
          const { broadcastProfileChange } = require('../../context/AuthContext');
          const linkedUserId = (member as any).userId || member.id;
          if (linkedUserId) {
            const fields: Array<'fullName' | 'avatar' | 'bio' | 'handle' | 'displayName' | 'phone' | 'email' | 'role'> = [];
            if (updates.fullName !== undefined) fields.push('fullName');
            if (updates.avatar !== undefined) fields.push('avatar');
            if (updates.phoneNumber !== undefined) fields.push('phone');
            if (updates.email !== undefined) fields.push('email');
            // A relationship change must also re-hydrate every
            // FamilyMember consumer — they read `relationship` from
            // family_members and show it in chats / tree / headers.
            if (updates.relationship !== undefined && fields.length === 0) {
              fields.push('role');
            }
            if (fields.length > 0) {
              await broadcastProfileChange({ userId: linkedUserId, fields });
            }
          }
        } catch {}

        sweetAlert.success('Profile Updated', 'All changes saved successfully');
        await refreshMemberData();
      } else { triggerHaptic('error'); sweetAlert.error('Save Failed', 'Please try again.'); }
    } catch (error) { triggerHaptic('error'); sweetAlert.error('Error', 'An unexpected error occurred'); }
    finally { setIsSaving(false); saveConfirmOpenRef.current = false; }
  };

  /* ─── HANDLE REMOVE ─── */
  const handleRemove = useCallback(() => {
    if (!member) return;
    const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
    const memberUserId = (member as any).userId || member.id;
    if (memberUserId === currentUserIdLocal || member.id === currentUserIdLocal) {
      sweetAlert.alert('Cannot Remove', 'You cannot remove yourself.', 'warning');
      return;
    }
    if (!hasPermission('manageFamily')) { sweetAlert.error('Permission Denied', 'Only parents can remove members'); triggerHaptic('error'); return; }
    sweetAlert.confirm('Remove Family Member', `Remove ${member.fullName}? Their history will be preserved but they will lose access.`, async () => {
      triggerHaptic('error');
      const success = await removeMember(member.id);
      if (success) { triggerHaptic('success'); sweetAlert.success('Member Removed', `${member.fullName} has been removed`); navigation.goBack(); }
      else sweetAlert.error('Error', 'Failed to remove family member');
    }, () => {}, 'Remove', 'Cancel');
  }, [member, userProfile, profile, hasPermission, removeMember, navigation, sweetAlert, triggerHaptic]);

  /* ─── CAMERA CAPTURE ─── */
  const handleCameraCapture = async () => {
    setShowImagePicker(false);
    if (!member) return;
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { sweetAlert.error('Permission Required', 'Please allow camera access'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setIsSaving(true);
      const uploaded = await persistPickedImage(result.assets[0].uri, member.id);
      if (!uploaded) { sweetAlert.error('Error', 'Failed to save photo'); setIsSaving(false); return; }
      const { localUri, publicUrl } = uploaded;
      setFormData(prev => ({ ...prev, avatar: localUri }));
      const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
      const isCurrentUserLocal = member.id === currentUserIdLocal;
      const linkedProfileId: string | undefined = isCurrentUserLocal ? currentUserIdLocal : (member as any).userId || undefined;
      if (linkedProfileId && publicUrl && !publicUrl.startsWith('file://')) {
        try { await supabase.from('profiles').update({ community_avatar: publicUrl, avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', linkedProfileId); } catch {}
      }
      if (isCurrentUserLocal) { try { await updateProfile({ avatar: publicUrl || localUri }); } catch {} }
      const success = await updateGuardianProfile(member.id, { avatar: localUri });
      if (success) {
        setMember(prev => prev ? { ...prev, avatar: localUri } : null);
        setOriginalData(prev => ({ ...prev, avatar: localUri }));
        triggerHaptic('success');
        sweetAlert.success('Photo Updated', 'Camera photo saved');
        await refreshMemberData();
      }
    } catch (error) { if (__DEV__) console.warn('[EditGuardian] Camera error:', error); sweetAlert.error('Error', 'Failed to capture photo'); }
    finally { setIsSaving(false); }
  };

  /* ─── IMAGE PICK ─── */
  const handleImagePick = async () => {
    setShowImagePicker(false);
    if (!member) return;
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { sweetAlert.error('Permission Required', 'Please allow access to your photo library'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setIsSaving(true);
      const uploaded = await persistPickedImage(result.assets[0].uri, member.id);
      if (!uploaded) { sweetAlert.error('Error', 'Failed to save image'); setIsSaving(false); return; }
      const { localUri, publicUrl } = uploaded;
      setFormData(prev => ({ ...prev, avatar: localUri }));
      const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
      const isCurrentUserLocal = member.id === currentUserIdLocal;
      const linkedProfileId: string | undefined = isCurrentUserLocal ? currentUserIdLocal : (member as any).userId || undefined;
      if (linkedProfileId && publicUrl && !publicUrl.startsWith('file://')) {
        try { await supabase.from('profiles').update({ community_avatar: publicUrl, avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', linkedProfileId); } catch {}
      }
      if (isCurrentUserLocal) { try { await updateProfile({ avatar: publicUrl || localUri }); } catch {} }
      const success = await updateGuardianProfile(member.id, { avatar: localUri });
      if (success) {
        setMember(prev => prev ? { ...prev, avatar: localUri } : null);
        setOriginalData(prev => ({ ...prev, avatar: localUri }));
        triggerHaptic('success');
        try {
          const { broadcastProfileChange } = require('../../context/AuthContext');
          const linkedUserId = (member as any).userId || member.id;
          if (linkedUserId) {
            await broadcastProfileChange({ userId: linkedUserId, fields: ['avatar'] });
          }
        } catch {}
        sweetAlert.success('Photo Updated', 'Profile picture saved');
        await refreshMemberData();
      }
    } catch (error) { if (__DEV__) console.warn('[EditGuardian] Image pick error:', error); sweetAlert.error('Error', 'Failed to process image'); }
    finally { setIsSaving(false); }
  };

  /* ─── ROLE CHANGE ─── */
  const handleRoleChange = async (newRole: UserRole) => {
    if (!member || !hasPermission('manageFamily')) return;
    if (member.role === newRole) { setShowRoleModal(false); return; }
    const cfg = ROLE_CONFIG[newRole];
    sweetAlert.confirm(
      'Change Role',
      `Change ${member.fullName} to ${cfg.label}?`,
      async () => {
        setIsSaving(true);
        try {
          // THE ONLY path for role changes. Returns the DB-verified
          // member — never `true`/`false`, never a stale closure.
          const fresh = await promoteMember(
            (member as any).userId || member.id,
            newRole,
          );
          if (fresh) {
            // Use the fresh object as the source of truth.
            setMember(fresh);
            setOriginalData(prev => ({ ...prev, role: fresh.role as any }));
            sweetAlert.success(
              'Role Updated',
              `${member.fullName} is now ${cfg.label}`,
            );
            // Do NOT call refreshMemberData() — it would read from a
            // stale `members` closure and clobber the fresh value.
          } else {
            // Most common cause: another device promoted someone
            // simultaneously, or a soft-deleted parent1 row still
            // occupies the unique slot. Re-sync so the UI shows the
            // real DB state, then let the user retry.
            await refreshMemberData();
            sweetAlert.error(
              'Role Change Failed',
              newRole === UserRole.PARENT_1
                ? 'Another Primary Parent exists. Transfer ownership first, then try again.'
                : 'Could not update the role. Please try again.',
            );
          }
        } catch {
          sweetAlert.error('Error', 'An error occurred');
        } finally {
          setIsSaving(false);
          setShowRoleModal(false);
        }
      },
      () => setShowRoleModal(false),
      'Change',
      'Cancel',
    );
  };
  /* ─── ADD MEMBER DIRECTLY ─── */
  // The fourth path. Called from the "Add Member Directly" button.
  // Resolves the identifier against `profiles` (email / @username /
  // phone) and creates an ACTIVE family_members row on the spot.
  const handleAddMemberDirectly = useCallback(async () => {
    if (isAddingMember) return;
    const identifier = addMemberIdentifier.trim();
    if (!identifier) {
      sweetAlert.error('Missing Identifier', 'Enter an email, @username, or phone number');
      return;
    }
    if (!addMemberRelationship.trim()) {
      sweetAlert.error('Missing Relationship', 'Enter their relationship to the baby (e.g. Grandma)');
      return;
    }
    setIsAddingMember(true);
    triggerHaptic('medium');
    try {
      const result: AddMemberResult = await addMemberDirectly(
        identifier,
        addMemberRole,
        addMemberRelationship.trim(),
      );

      if (result.ok) {
        triggerHaptic('success');
        setShowAddMemberModal(false);
        setAddMemberIdentifier('');
        setAddMemberRelationship('');
        setAddMemberRole(UserRole.GUARDIAN);

        // Use the SAME Aura modal that MoreScreen uses, so the whole
        // app feels consistent. `sweetAlert.success` renders the
        // blurred capsule with a green checkmark icon.
        sweetAlert.success(result.title, result.message);

        // After the Aura modal animates in, navigate back so the
        // family tree reloads on focus and shows the new member.
        setTimeout(() => {
          if (navigation.canGoBack()) navigation.goBack();
        }, 900);
      } else {
        // Pick the icon + tint based on the structured code so the
        // user sees the right visual for "already a member" vs
        // "not on LittleLoom" vs "database rejected".
        const icon: any =
          result.code === 'already_member' || result.code === 'already_you'
            ? 'people-circle-outline'
            : result.code === 'not_found'
            ? 'search-outline'
            : result.code === 'insert_failed'
            ? 'cloud-offline-outline'
            : 'alert-circle-outline';

        if (result.isWarning) {
          sweetAlert.warning(result.title, result.message);
        } else {
          sweetAlert.error(result.title, result.message);
        }
        triggerHaptic(result.isWarning ? 'light' : 'error');
      }
    } catch (e) {
      if (__DEV__) console.warn('[handleAddMemberDirectly] error:', e);
      sweetAlert.error('Something Went Wrong', 'Failed to add member. Please try again.');
    } finally {
      setIsAddingMember(false);
    }
  }, [isAddingMember, addMemberIdentifier, addMemberRelationship, addMemberRole, addMemberDirectly, sweetAlert, triggerHaptic, navigation]);

  /* ─── ACTIONS ─── */
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
    try {
      triggerHaptic('medium');
      await Share.share({
        message: `${member.fullName} - ${getMemberDisplayLabel({ role: member.role, relationship: member.relationship })}\n${member.email || ''}\n${member.phoneNumber || ''}`,
        title: `${member.fullName}'s Contact Info`,
      });
    } catch (error) { if (__DEV__) console.warn('[EditGuardian] share error:', error); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFamily();
      if (typeof refreshBabyData === 'function' && currentBaby?.id) await refreshBabyData(currentBaby.id);
      if (member) await loadMemberActivities(member.id, member.userId, member.fullName);
    } catch (error) { if (__DEV__) console.warn('[EditGuardian] refresh error:', error); }
    finally { setRefreshing(false); }
  }, [loadFamily, refreshBabyData, currentBaby, member, loadMemberActivities]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    if (!IS_FABRIC) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

  /* ─── RIBBON ─── */
  /* ─── RIBBON — fully role-aware ─── */
  const topRibbon = useMemo(() => {
    if (!member || !roleConfig) {
      return {
        icon: 'information-circle-outline' as const,
        color: DS.info,
        label: 'No data',
        text: 'Loading member...',
      };
    }

    const firstName = member.fullName?.split(' ')[0] || 'this member';
    const isParentRole =
      member.role === UserRole.PARENT_1 || member.role === UserRole.PARENT_2;
    const isPendingMember =
      !member.lastActive && member.status === 'pending';
    const displayLabel = getMemberDisplayLabel({
      role: member.role,
      relationship: member.relationship,
    });

    // ── PARENTS FIRST ─────────────────────────────────────────
    // A parent is NEVER a "new member to nudge". Show their role,
    // defined relationship, and permission summary — full stop.
    if (isParentRole) {
      return {
        icon: 'shield-checkmark-outline' as const,
        color: ROLE_CONFIG[member.role].color,
        label: ROLE_CONFIG[member.role].label,
        text: `${firstName} · ${displayLabel} · ${ROLE_CONFIG[member.role].permissions.length} permissions`,
        onPress: () => handleTabChange('permissions'),
      };
    }

    if (isPendingMember) {
      return {
        icon: 'mail-outline' as const,
        color: DS.warning,
        label: 'Pending invite',
        text: `Waiting for ${firstName} to accept the invitation`,
        onPress: () => handleTabChange('permissions'),
      };
    }

    // ── GUARDIAN / VIEWER BRANCHES ────────────────────────────
    // Only non-parents can be "new" — but we phrase it in terms of
    // their defined relationship, never as "nudge them to start".
    if (memberActivities.length === 0) {
      // A member who has ANY lastActive timestamp is already in.
      // Only show "invite pending" when there's truly no activity
      // AND the row is marked pending.
      if (member.status === 'pending' && !member.lastActive) {
        return {
          icon: 'mail-outline' as const,
          color: DS.warning,
          label: 'Invite pending',
          text: `Waiting for ${firstName} to accept the invitation`,
          onPress: () => handleTabChange('permissions'),
        };
      }
      return {
        icon: 'sparkles-outline' as const,
        color: roleConfig.color,
        label: `${displayLabel}`,
        text: `${firstName} is a ${displayLabel} with ${ROLE_CONFIG[member.role].permissions.length} permissions · Tap to view`,
        onPress: () => handleTabChange('permissions'),
      };
    }

    const daysSince = member?.lastActive
      ? Math.floor(
          (Date.now() - new Date(member.lastActive).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : 0;
    if (daysSince > 7) {
      return {
        icon: 'alarm-outline' as const,
        color: DS.warning,
        label: 'Inactive',
        text: `Last active ${daysSince} days ago · ${memberActivities.length} total activities`,
        onPress: () => handleTabChange('activity'),
      };
    }
    if (canManagePermissions) {
      return {
        icon: 'shield-checkmark-outline' as const,
        color: roleConfig.color,
        label: displayLabel,
        text: `${ROLE_CONFIG[member.role].permissions.length} permissions granted · Tap to manage`,
        onPress: () => handleTabChange('permissions'),
      };
    }
    return {
      icon: 'checkmark-circle-outline' as const,
      color: DS.success,
      label: displayLabel,
      text: `${memberActivities.length} activities this period`,
      onPress: () => handleTabChange('activity'),
    };
  }, [
    member,
    roleConfig,
    memberActivities.length,
    canManagePermissions,
  ]);
  /* ─── GUARDS ─── */
  if (!member && !isHydrating) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <Ionicons name="alert-circle-outline" size={64} color={DS.gray400} />
        <Text style={{ marginTop: 16, color: isDark ? DS.gray400 : DS.gray500, fontSize: 16, fontWeight: '600' }}>Member not found</Text>
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.96}>
          <LinearGradient colors={[DS.primary, DS.accent]} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: DS.white }}>Go Back</Text>
          </LinearGradient>
        </PressableScale>
      </View>
    );
  }

  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' as const },
    { key: 'activity' as ProfileTab, label: 'Activity', icon: 'time-outline' as const },
    { key: 'permissions' as ProfileTab, label: 'Access', icon: 'shield-outline' as const },
    { key: 'settings' as ProfileTab, label: 'Settings', icon: 'settings-outline' as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={isDark ? [DS.darkBg, '#12121e', DS.darkBg] : ['#f8faff', '#eef0f5', '#e4e8f0']} style={StyleSheet.absoluteFill} />

      {/* Sticky header */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]} pointerEvents="none">
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{member?.fullName || 'Member'}</Text>
        <Text style={[styles.stickySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          {member ? getMemberDisplayLabel({ role: member.role, relationship: member.relationship }) : (roleConfig?.label || '')}
        </Text>
      </Animated.View>

      {/* Back button + optional breadcrumb when arriving from the
          family view, so the navigation story is visible:
          "Family → Jane Doe". Without `fromFamily`, no breadcrumb. */}
      <Animated.View entering={FadeInDown.springify()} style={[styles.topHeader, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.92}>
          <View style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(15,15,30,0.55)' : 'rgba(255,255,255,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}>
            <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>
        {cameFromFamily && member && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)',
            }}
          >
            <Ionicons name="people-outline" size={12} color={isDark ? DS.gray400 : DS.gray500} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? DS.gray400 : DS.gray500 }}>
              Family
            </Text>
            <Ionicons name="chevron-forward" size={10} color={isDark ? DS.gray500 : DS.gray400} />
            <Text
              style={{ fontSize: 11, fontWeight: '800', color: isDark ? DS.white : DS.gray900 }}
              numberOfLines={1}
            >
              {member.fullName?.split(' ')[0] || 'Member'}
            </Text>
          </View>
        )}
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 68, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} colors={[DS.primary, DS.accent]} />}
      >
        {/* Identity Capsule */}
        <View style={{ paddingHorizontal: DS.space.lg }}>
          {isHydrating && !member ? (
            <CapsuleSkeleton isDark={isDark} />
          ) : (
            <MemberIdentityCapsule
              isDark={isDark}
              member={member}
              roleConfig={roleConfig}
              formData={formData}
              isMemberVerified={isMemberVerified}
              isCurrentUser={isCurrentUser}
              isEditing={isEditing}
              canEdit={canEdit}
              memberActivities={memberActivities}
              onAvatarPress={() => setShowImagePicker(true)}
              onEditToggle={() => { triggerHaptic('light'); setIsEditing(!isEditing); }}
              onMessage={handleMessage}
              onCall={handleCall}
              onShare={handleShare}
            />
          )}
        </View>

        {/* Insight Ribbon */}
        <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
          <InsightRibbon isDark={isDark} {...topRibbon} />
        </View>

        {/* Tab Bar */}
        <View style={{ marginTop: DS.space.md }}>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />
        </View>

        {/* Body */}
        {!member ? (
          <View style={{ paddingHorizontal: DS.space.lg, marginTop: DS.space.md }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ height: 96, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', marginBottom: 12 }} />
            ))}
          </View>
        ) : roleConfig ? (
          <>
            {/* ─── OVERVIEW ─── */}
            {activeTab === 'overview' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <StatTiles isDark={isDark} stats={[
                  { icon: 'document-text-outline', value: memberActivities.length, label: 'Activities', color: DS.primary },
                  { icon: 'flame-outline', value: member?.streak || 0, label: 'Streak', color: DS.warning },
                  { icon: 'star-outline', value: roleConfig.priority, label: 'Priority', color: roleConfig.color },
                ]} />

                <AIMemberInsights member={member} activities={memberActivities} isDark={isDark} />
                <ActivitySparkline activities={memberActivities} isDark={isDark} />
                <RelationshipHealth member={member} activities={memberActivities} isDark={isDark} />

                <SmartRoleRecommendations member={member} activities={memberActivities} onRoleChange={handleRoleChange} canManage={canManagePermissions} isDark={isDark} />
                <EngagementTimeline member={member} activities={memberActivities} milestones={milestones} isDark={isDark} />

                {/* Contact Info */}
                <SectionHeader title="Contact Info" icon="person-outline" color={roleConfig.color} />
                <GlassCard isDark={isDark}>
                  <View style={{ padding: DS.space.md, gap: 8 }}>
                    {member.email && (
                      <View style={[styles.contactRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                        <View style={[styles.contactIcon, { backgroundColor: `${DS.primary}15` }]}>
                          <Ionicons name="mail-outline" size={16} color={DS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.contactLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Email</Text>
                          <Text style={[styles.contactValue, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>{member.email}</Text>
                        </View>
                      </View>
                    )}
                    {member.phoneNumber && (
                      <View style={[styles.contactRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                        <View style={[styles.contactIcon, { backgroundColor: `${DS.success}15` }]}>
                          <Ionicons name="call-outline" size={16} color={DS.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.contactLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Phone</Text>
                          <Text style={[styles.contactValue, { color: isDark ? DS.white : DS.gray900 }]}>{member.phoneNumber}</Text>
                        </View>
                      </View>
                    )}
                    <View style={[styles.contactRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : DS.gray50 }]}>
                      <View style={[styles.contactIcon, { backgroundColor: `${DS.warning}15` }]}>
                        <Ionicons name="calendar-outline" size={16} color={DS.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.contactLabel, { color: isDark ? DS.gray500 : DS.gray400 }]}>Member Since</Text>
                        <Text style={[styles.contactValue, { color: isDark ? DS.white : DS.gray900 }]}>
                          {member.addedAt ? new Date(member.addedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </View>
            )}

            {/* ─── ACTIVITY ─── */}
            {activeTab === 'activity' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <SectionHeader title="Recent Activity" subtitle={`${memberActivities.length} entries`} icon="time-outline" color={DS.primary} />
                {isLoadingActivities ? (
                  <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <InlineSpinner size={24} color={DS.primary} section="main" />
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500, marginTop: 8 }]}>Loading activities...</Text>
                  </View>
                ) : memberActivities.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                    <Ionicons name="time-outline" size={36} color={DS.primary} />
                    <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                      {isCurrentUser ? "You haven't logged any activities yet" : `${member.fullName.split(' ')[0]} hasn't logged any activities yet`}
                    </Text>
                    <Text style={[styles.emptySub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      Activities will appear here when {isCurrentUser ? 'you' : 'they'} log entries for {currentBaby?.name || 'the baby'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {memberActivities.map((activity, index) => (
                      <ActivityRow key={activity.id} activity={activity} index={index} isDark={isDark} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ─── PERMISSIONS ─── */}
            {activeTab === 'permissions' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <SectionHeader title="Access Permissions" subtitle={`${roleConfig.permissions.length} granted`} icon="shield-outline" color={roleConfig.color} />

                <GlassCard isDark={isDark}>
                  <View style={{ padding: DS.space.md }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {roleConfig.permissions.map((permission, index) => (
                        <Animated.View key={permission} entering={FadeIn.delay(index * 50)} style={[styles.permissionChip, { backgroundColor: `${roleConfig.color}15`, borderColor: `${roleConfig.color}30` }]}>
                          <Ionicons name="checkmark-circle" size={13} color={roleConfig.color} />
                          <Text style={[styles.permissionChipText, { color: roleConfig.color }]}>{permission}</Text>
                        </Animated.View>
                      ))}
                    </View>
                    <View style={[styles.permissionNote, { backgroundColor: `${roleConfig.color}08`, marginTop: DS.space.md, marginHorizontal: 0, marginBottom: 0 }]}>
                      <Ionicons name="information-circle" size={14} color={roleConfig.color} />
                      <Text style={[styles.permissionNoteText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                        These permissions are set by the {roleConfig.label} role and cannot be modified individually.
                      </Text>
                    </View>
                  </View>
                </GlassCard>

                <StatTiles isDark={isDark} stats={[
                  { icon: 'document-text-outline', value: memberActivities.length, label: 'Activities', color: DS.primary },
                  { icon: 'star-outline', value: roleConfig.priority, label: 'Priority', color: roleConfig.color },
                  { icon: member?.lastActive ? 'checkmark-circle-outline' : 'hourglass-outline', value: member?.lastActive ? 'Active' : 'Pending', label: 'Status', color: member?.lastActive ? DS.success : DS.warning },
                ]} />

                {memberActivities.length > 0 && (
                  <GlassCard isDark={isDark} delay={80}>
                    <View style={{ padding: DS.space.md }}>
                      <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900, marginBottom: DS.space.md }]}>Activity Breakdown</Text>
                      {Object.entries(memberActivities.reduce((acc, act) => { acc[act.type] = (acc[act.type] || 0) + 1; return acc; }, {} as Record<string, number>))
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => {
                          const cfg = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.default;
                          const percentage = Math.round((count / memberActivities.length) * 100);
                          return (
                            <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <View style={[styles.breakdownIcon, { backgroundColor: `${cfg.color}15` }]}>
                                <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                              </View>
                              <Text style={[styles.barLabel, { color: isDark ? DS.gray300 : DS.gray600, flex: 1 }]}>{cfg.label}</Text>
                              <View style={[styles.barBg, { flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                                <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: cfg.color }]} />
                              </View>
                              <Text style={[styles.barValue, { color: cfg.color, width: 24, textAlign: 'right' }]}>{count}</Text>
                            </View>
                          );
                        })}
                    </View>
                  </GlassCard>
                )}

                {canManagePermissions && (
                  <PressableScale onPress={() => { triggerHaptic('light'); setShowRoleModal(true); }} activeScale={0.97}>
                    <View style={[styles.managePermBtn, { backgroundColor: `${roleConfig.color}12`, borderColor: `${roleConfig.color}30` }]}>
                      <Ionicons name="shield-outline" size={18} color={roleConfig.color} />
                      <Text style={[styles.managePermText, { color: roleConfig.color }]}>Manage Role & Permissions</Text>
                      <Ionicons name="chevron-forward" size={18} color={roleConfig.color} />
                    </View>
                  </PressableScale>
                )}

                {/* ── ADD MEMBER DIRECTLY ───────────────────────────────
                    The fourth path. Adds an existing LittleLoom user by
                    email / @username / phone with zero invite overhead.
                    Pairs with the existing invite / QR / code flows. */}
                {canManagePermissions && (
                  <PressableScale
                    onPress={() => { triggerHaptic('light'); setShowAddMemberModal(true); }}
                    activeScale={0.97}
                  >
                    <View style={[styles.managePermBtn, { backgroundColor: `${DS.success}12`, borderColor: `${DS.success}30` }]}>
                      <Ionicons name="person-add" size={18} color={DS.success} />
                      <Text style={[styles.managePermText, { color: DS.success }]}>Add Member Directly</Text>
                      <Ionicons name="chevron-forward" size={18} color={DS.success} />
                    </View>
                  </PressableScale>
                )}
              </View>
            )}

            {/* ─── SETTINGS ─── */}
            {activeTab === 'settings' && (
              <View style={{ marginTop: DS.space.md, gap: 10, paddingHorizontal: DS.space.lg }}>
                <GlassCard isDark={isDark}>
                  <View style={{ padding: DS.space.md }}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>Profile Info</Text>
                      {!isEditing && canEdit && (
                        <PressableScale onPress={() => setIsEditing(true)} activeScale={0.9}>
                          <View style={[styles.editPill, { backgroundColor: `${roleConfig.color}15` }]}>
                            <Ionicons name="create-outline" size={13} color={roleConfig.color} />
                            <Text style={[styles.editPillText, { color: roleConfig.color }]}>Edit</Text>
                          </View>
                        </PressableScale>
                      )}
                      {isEditing && (
                        <View style={[styles.editBadgeActive, { backgroundColor: `${DS.warning}15` }]}>
                          <Text style={[styles.editBadgeActiveText, { color: DS.warning }]}>Editing</Text>
                        </View>
                      )}
                    </View>

                    {/* Full Name */}
                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Full Name</Text>
                    {isCurrentUser ? (
                      <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, { opacity: 0.6 }]}>
                        <Ionicons name="lock-closed" size={16} color={roleConfig.color} />
                        <Text style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}>{formData.fullName}</Text>
                        <View style={[styles.youBadge, { backgroundColor: roleConfig.color }]}>
                          <Text style={styles.youBadgeText}>You</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                        <Ionicons name="person-outline" size={16} color={roleConfig.color} />
                        <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={formData.fullName} onChangeText={(t) => setFormData(p => ({ ...p, fullName: t }))} placeholder="Enter full name" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} editable={isEditing} selectionColor={roleConfig.color} />
                      </View>
                    )}

                    {/* Username */}
                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Username</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: roleConfig.color, marginRight: 2 }}>@</Text>
                      <TextInput
                        style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}
                        value={formData.username}
                        onChangeText={(text) => setFormData(p => ({ ...p, username: text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.]/g, '').replace(/^@+/, '') }))}
                        placeholder="username"
                        placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={isEditing}
                        selectionColor={roleConfig.color}
                        maxLength={30}
                      />
                      {isCheckingUsername && <ActivityIndicator size="small" color={roleConfig.color} />}
                      {!isCheckingUsername && usernameCheck && formData.username !== originalData.username && (
                        <Ionicons name={usernameCheck.available ? 'checkmark-circle' : 'alert-circle'} size={18} color={usernameCheck.available ? DS.success : DS.danger} />
                      )}
                    </View>
                    {usernameCheck && formData.username !== originalData.username && !isCheckingUsername && (
                      <Text style={{ fontSize: 11, marginTop: 4, color: usernameCheck.available ? DS.success : DS.danger, fontWeight: '600' }}>{usernameCheck.message}</Text>
                    )}
                    <Text style={{ fontSize: 10, color: isDark ? DS.gray500 : DS.gray400, marginTop: 4 }}>Used for sign-in and shown on your community profile</Text>

                    {/* Email */}
                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Email</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, (!isEditing || (!isCurrentUser && member.role !== UserRole.PARENT_2)) && { opacity: 0.5 }]}>
                      <Ionicons name="mail-outline" size={16} color={roleConfig.color} />
                      <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={formData.email} onChangeText={(t) => setFormData(p => ({ ...p, email: t }))} placeholder="email@example.com" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} keyboardType="email-address" autoCapitalize="none" editable={isEditing && (isCurrentUser || member.role === UserRole.PARENT_2)} selectionColor={roleConfig.color} />
                    </View>

                    {/* Phone */}
                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>Phone</Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Ionicons name="call-outline" size={16} color={roleConfig.color} />
                      <TextInput style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]} value={formData.phoneNumber} onChangeText={(t) => setFormData(p => ({ ...p, phoneNumber: t }))} placeholder="+1 (555) 123-4567" placeholderTextColor={isDark ? DS.gray500 : DS.gray400} keyboardType="phone-pad" editable={isEditing} selectionColor={roleConfig.color} />
                    </View>

                    {/* Relationship — this is the HUMAN label shown everywhere:
                        chats, family tree, entry attribution. Must be filled in
                        so users never see "Primary Parent" in the UI. */}
                    <Text style={[styles.inputLabel, { color: isDark ? DS.gray500 : DS.gray400, marginTop: DS.space.md }]}>
                      Relationship to Child
                    </Text>
                    <Text style={{ fontSize: 10, color: isDark ? DS.gray500 : DS.gray400, marginBottom: 6 }}>
                      Shown in chats and family tree · e.g. Mother, Father, Grandma, Nanny
                    </Text>
                    <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }, !isEditing && { opacity: 0.5 }]}>
                      <Ionicons name="people-outline" size={16} color={roleConfig.color} />
                      <TextInput
                        style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}
                        value={formData.relationship}
                        onChangeText={(t) => setFormData(p => ({ ...p, relationship: t }))}
                        placeholder="e.g., Mother, Father, Grandma"
                        placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
                        // ALWAYS editable by the member themselves, AND
                        // editable by anyone with manageFamily permission.
                        editable={isEditing && (isCurrentUser || canEdit)}
                        selectionColor={roleConfig.color}
                      />
                    </View>
                    {/* Quick-pick chips so users don't have to type */}
                    {isEditing && (isCurrentUser || canEdit) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {['Mother', 'Father', 'Parent', 'Guardian', 'Grandmother', 'Grandfather', 'Nanny', 'Caregiver'].map((rel) => (
                          <TouchableOpacity
                            key={rel}
                            onPress={() => setFormData((p) => ({ ...p, relationship: rel }))}
                            style={{
                              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                              backgroundColor: formData.relationship === rel ? roleConfig.color : `${roleConfig.color}15`,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: formData.relationship === rel ? '#fff' : roleConfig.color }}>
                              {rel}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {isEditing && (
                      <View style={[styles.prefRow, { borderTopColor: isDark ? DS.darkBorder : DS.gray200, marginTop: DS.space.md, paddingTop: DS.space.md }]}>
                        <Ionicons name={formData.notificationsEnabled ? 'notifications' : 'notifications-off'} size={18} color={formData.notificationsEnabled ? roleConfig.color : DS.gray400} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.prefLabel, { color: isDark ? DS.white : DS.gray900 }]}>Notifications</Text>
                          <Text style={[styles.prefDesc, { color: isDark ? DS.gray500 : DS.gray400 }]}>Family activity alerts</Text>
                        </View>
                        <Switch value={formData.notificationsEnabled} onValueChange={(v) => setFormData(p => ({ ...p, notificationsEnabled: v }))} trackColor={{ false: DS.gray300, true: roleConfig.color }} thumbColor={DS.white} />
                      </View>
                    )}
                  </View>
                </GlassCard>

                {isEditing && (
                  <PressableScale onPress={handleSave} disabled={isSaving} activeScale={0.97}>
                    <LinearGradient colors={[DS.primary, DS.accent]} style={styles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      {isSaving ? <ActivityIndicator size="small" color={DS.white} /> : <Text style={styles.saveText}>Save Changes</Text>}
                    </LinearGradient>
                  </PressableScale>
                )}

                {canRemove && (
                  <>
                    <SectionHeader title="Danger Zone" subtitle="Irreversible actions" icon="warning-outline" color={DS.danger} />
                    <View style={[styles.dangerCard, { backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)', borderColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)' }]}>
                      <LinearGradient colors={[DS.danger, '#dc2626']} style={styles.dangerIcon}>
                        <Ionicons name="warning" size={20} color={DS.white} />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.dangerTitle, { color: DS.danger }]}>Remove from Family</Text>
                        <Text style={[styles.dangerDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>Their history stays, but they lose all access.</Text>
                      </View>
                      <PressableScale onPress={handleRemove} activeScale={0.94}>
                        <View style={[styles.dangerBtn, { backgroundColor: `${DS.danger}15` }]}>
                          <Text style={[styles.dangerBtnText, { color: DS.danger }]}>Remove</Text>
                        </View>
                      </PressableScale>
                    </View>
                  </>
                )}
              </View>
            )}
          </>
        ) : null}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      {/* Image Picker */}
      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark}>
        <View style={{ padding: 4 }}>
          {[
            { icon: 'images-outline', label: 'Choose from Library', color: DS.primary, onPress: () => { setShowImagePicker(false); setTimeout(handleImagePick, 250); } },
            { icon: 'camera-outline', label: 'Take Photo', color: DS.success, onPress: () => { setShowImagePicker(false); setTimeout(handleCameraCapture, 250); } },
            { icon: 'happy-outline', label: 'Pick Emoji', color: DS.warning, onPress: () => { setShowImagePicker(false); setTimeout(() => setShowEmojiPicker(true), 250); } },
          ].map((opt, i) => (
            <TouchableOpacity key={i} onPress={opt.onPress} style={styles.pickerOption}>
              <View style={[styles.pickerIcon, { backgroundColor: `${opt.color}20` }]}>
                <Ionicons name={opt.icon as any} size={22} color={opt.color} />
              </View>
              <Text style={[styles.pickerLabel, { color: isDark ? DS.white : DS.gray900 }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ActionModal>

      {/* Role Modal */}
      <ActionModal visible={showRoleModal} onClose={() => setShowRoleModal(false)} title="Manage Role" isDark={isDark}>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>
          {Object.entries(ROLE_CONFIG).map(([role, config]) => {
            const isSelected = member?.role === role;
            return (
              <TouchableOpacity
                key={role}
                onPress={() => handleRoleChange(role as UserRole)}
                style={[styles.roleOption, { backgroundColor: isSelected ? `${config.color}12` : (isDark ? 'rgba(255,255,255,0.03)' : DS.gray50), borderColor: isSelected ? config.color : 'transparent' }]}
              >
                <LinearGradient colors={config.gradient} style={styles.roleIcon}>
                  <Ionicons name={config.icon as any} size={18} color={DS.white} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleTitle, { color: isDark ? DS.white : DS.gray900 }]}>{config.label}</Text>
                  <Text style={[styles.roleDesc, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={2}>{config.description}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={config.color} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ActionModal>

      {/* ── ADD MEMBER DIRECTLY MODAL ─────────────────────────────────
          The fourth path. Adds an existing LittleLoom account to the
          family with no invite code / no sign-up round-trip. */}
      <ActionModal
        visible={showAddMemberModal}
        onClose={() => { if (!isAddingMember) setShowAddMemberModal(false); }}
        title="Add Member Directly"
        isDark={isDark}
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '75%' }}>
          <View style={{
            backgroundColor: `${DS.success}10`,
            borderColor: `${DS.success}30`,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            gap: 8,
          }}>
            <Ionicons name="flash" size={16} color={DS.success} />
            <Text style={{ fontSize: 11, color: DS.success, flex: 1, fontWeight: '600', lineHeight: 15 }}>
              Instantly adds an <Text style={{ fontWeight: '800' }}>existing LittleLoom user</Text> to this family.
              Use their email, @username, or phone number. For someone not on LittleLoom yet, use "Invite" instead.
            </Text>
          </View>

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
            Email, @username, or phone
          </Text>
          <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }]}>
            <Ionicons name="at" size={16} color={DS.success} />
            <TextInput
              style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}
              value={addMemberIdentifier}
              onChangeText={setAddMemberIdentifier}
              placeholder="e.g. grandma@example.com or @nana"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={DS.success}
              editable={!isAddingMember}
            />
          </View>

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: 16 }]}>
            Relationship to Baby
          </Text>
          <View style={[styles.inputRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray50 }]}>
            <Ionicons name="heart-outline" size={16} color={DS.success} />
            <TextInput
              style={[styles.inputText, { color: isDark ? DS.white : DS.gray900, flex: 1 }]}
              value={addMemberRelationship}
              onChangeText={setAddMemberRelationship}
              placeholder="e.g. Grandma, Nanny, Uncle"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              autoCapitalize="words"
              selectionColor={DS.success}
              editable={!isAddingMember}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {['Mother', 'Father', 'Guardian', 'Grandmother', 'Grandfather', 'Nanny', 'Caregiver', 'Aunt', 'Uncle'].map((rel) => (
              <TouchableOpacity
                key={rel}
                onPress={() => setAddMemberRelationship(rel)}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                  backgroundColor: addMemberRelationship === rel ? DS.success : `${DS.success}15`,
                }}
                disabled={isAddingMember}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: addMemberRelationship === rel ? '#fff' : DS.success }}>
                  {rel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.inputLabel, { color: isDark ? DS.gray400 : DS.gray500, marginTop: 16 }]}>
            Role
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { role: UserRole.GUARDIAN, label: 'Guardian', icon: 'shield-checkmark' as const, color: '#10b981' },
              { role: UserRole.VIEWER, label: 'Viewer', icon: 'eye' as const, color: '#64748b' },
              { role: UserRole.PARENT_2, label: 'Co-Parent', icon: 'heart' as const, color: '#ec4899' },
            ].map((opt) => {
              const active = addMemberRole === opt.role;
              return (
                <PressableScale
                  key={opt.role}
                  onPress={() => setAddMemberRole(opt.role)}
                  activeScale={0.96}
                  style={{ flex: 1 }}
                  disabled={isAddingMember}
                >
                  <View style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: active ? opt.color : (isDark ? DS.darkBorder : DS.gray200),
                    backgroundColor: active ? `${opt.color}15` : (isDark ? DS.darkCard : DS.white),
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Ionicons name={opt.icon} size={20} color={opt.color} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: active ? opt.color : (isDark ? DS.gray300 : DS.gray700) }}>
                      {opt.label}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <Text style={{ fontSize: 10, color: isDark ? DS.gray500 : DS.gray400, marginTop: 8, lineHeight: 14 }}>
            Primary Parent cannot be assigned here — use "Transfer Ownership" if you want to hand the crown to someone else.
          </Text>

          <PressableScale
            onPress={handleAddMemberDirectly}
            disabled={isAddingMember || !addMemberIdentifier.trim() || !addMemberRelationship.trim()}
            activeScale={0.97}
            style={{ marginTop: 16 }}
          >
            <LinearGradient
              colors={
                addMemberIdentifier.trim() && addMemberRelationship.trim() && !isAddingMember
                  ? [DS.success, '#059669']
                  : [DS.gray300, DS.gray400]
              }
              style={styles.saveBtn}
            >
              {isAddingMember ? (
                <ActivityIndicator color={DS.white} size="small" />
              ) : (
                <Text style={styles.saveText}>Add to Family</Text>
              )}
            </LinearGradient>
          </PressableScale>
        </ScrollView>
      </ActionModal>

      {/* Emoji Picker */}
      <EmojiPickerModal visible={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} onSelect={(emoji: string) => setFormData(p => ({ ...p, avatar: emoji }))} isDark={isDark} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  stickyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  stickySub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DS.space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },

  capsule: { borderRadius: DS.radius['2xl'], padding: DS.space.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.md },
  capsuleGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  capsuleGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  capsuleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarGlow: { position: 'absolute', width: 92, height: 92, borderRadius: 46 },
  avatarRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  avatarInner: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  capsuleName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, maxWidth: '70%' },
  verifiedDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  roleBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  capsuleMeta: { fontSize: 11, fontWeight: '500' },
  capsuleStats: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  capsuleStatItem: { alignItems: 'center' },
  capsuleStatValue: { fontSize: 14, fontWeight: '800' },
  capsuleStatLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  capsuleStatDiv: { width: 1, height: 18 },
  capsuleActions: { flexDirection: 'row', gap: 8, marginTop: DS.space.md, alignItems: 'center' },
  actionPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  actionPrimaryText: { fontSize: 13, fontWeight: '700' },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  ribbon: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, paddingVertical: DS.space.md, paddingHorizontal: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  ribbonIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ribbonLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  ribbonText: { fontSize: 12, fontWeight: '600', marginTop: 1, lineHeight: 16 },

  tabBar: { flexDirection: 'row', marginHorizontal: DS.space.lg, padding: 4, borderRadius: DS.radius.full, gap: 2 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: DS.radius.full },
  tabLabel: { fontSize: 11, fontWeight: '600' },

  glassCard: { borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 1, ...DS.shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  cardIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  cardPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardPillText: { fontSize: 11, fontWeight: '800' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.sm, marginTop: DS.space.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, fontWeight: '500', marginTop: 1, opacity: 0.8 },
  sectionAction: { fontSize: 11, fontWeight: '700' },

  statTiles: { flexDirection: 'row', gap: 8 },
  statTile: { padding: 12, borderRadius: DS.radius.lg, borderWidth: 1, alignItems: 'center', gap: 4, ...DS.shadow.sm },
  statTileIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statTileValue: { fontSize: 16, fontWeight: '800' },
  statTileLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  insightRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.sm + 2, borderRadius: 10, borderLeftWidth: 3 },
  insightTitle: { fontSize: 12, fontWeight: '700' },
  insightDesc: { fontSize: 10, fontWeight: '500', marginTop: 1, lineHeight: 14 },

  sparkBar: { width: '75%', borderRadius: 4 },
  sparkLabel: { fontSize: 9, fontWeight: '600' },

  barLabel: { fontSize: 11, fontWeight: '600' },
  barValue: { fontSize: 11, fontWeight: '700' },
  barBg: { height: 5, borderRadius: 3, overflow: 'hidden', flex: 1 },
  barFill: { height: '100%', borderRadius: 3 },

  recCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, borderLeftWidth: 3, ...DS.shadow.sm },
  recTitle: { fontSize: 12, fontWeight: '700' },
  recReason: { fontSize: 10, fontWeight: '500', marginTop: 2, lineHeight: 14 },

  timelineCard: { borderRadius: DS.radius.lg, borderWidth: 1, padding: DS.space.md, ...DS.shadow.sm },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 1.5, flex: 1, marginTop: 3 },
  timelineTitle: { fontSize: 12, fontWeight: '700' },
  timelineDate: { fontSize: 10, fontWeight: '500' },
  timelineDesc: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1, ...DS.shadow.sm },
  activityIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 13, fontWeight: '700' },
  activityNotes: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  activityTime: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  activityBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  activityBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  emptyCard: { alignItems: 'center', paddingVertical: DS.space['2xl'], paddingHorizontal: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1, gap: 8, ...DS.shadow.sm },
  emptyTitle: { fontSize: 14, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  emptySub: { fontSize: 11, fontWeight: '500', textAlign: 'center', lineHeight: 16 },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.sm + 2, borderRadius: 10 },
  contactIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  contactValue: { fontSize: 13, fontWeight: '700', marginTop: 1 },

  permissionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  permissionChipText: { fontSize: 11, fontWeight: '700' },
  permissionNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: DS.space.sm + 2, borderRadius: 10 },
  permissionNoteText: { fontSize: 11, flex: 1, lineHeight: 15 },

  breakdownIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  managePermBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: DS.space.md, borderRadius: DS.radius.md, borderWidth: 1 },
  managePermText: { flex: 1, fontSize: 13, fontWeight: '700' },

  editPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  editPillText: { fontSize: 11, fontWeight: '700' },
  editBadgeActive: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  editBadgeActiveText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  inputLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 11 },
  inputText: { fontSize: 13, fontWeight: '600' },
  youBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  youBadgeText: { color: DS.white, fontSize: 10, fontWeight: '800' },

  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1 },
  prefLabel: { fontSize: 13, fontWeight: '600' },
  prefDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  saveBtn: { paddingVertical: 14, borderRadius: DS.radius.md, alignItems: 'center' },
  saveText: { color: DS.white, fontSize: 14, fontWeight: '700' },

  dangerCard: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.lg, borderWidth: 1 },
  dangerIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 13, fontWeight: '800' },
  dangerDesc: { fontSize: 11, fontWeight: '500', marginTop: 2, lineHeight: 15 },
  dangerBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  dangerBtnText: { fontSize: 12, fontWeight: '700' },

  pickerOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6 },
  pickerIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pickerLabel: { fontSize: 14, fontWeight: '600', flex: 1 },

  roleOption: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md, padding: DS.space.md, borderRadius: DS.radius.md, marginBottom: 8, borderWidth: 1 },
  roleIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 13, fontWeight: '700' },
  roleDesc: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: DS.radius['2xl'], padding: DS.space.lg, ...DS.shadow.lg, overflow: 'hidden' },
  modalDrag: { alignItems: 'center', paddingVertical: 6 },
  dragIndicator: { width: 36, height: 4, borderRadius: 2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.lg },
  modalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  modalClose: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  emojiBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});