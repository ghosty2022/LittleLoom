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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import type { RootStackParamList } from '../../types/navigation';
import { UserRole, ROLE_LABELS } from '../../types/roles';
import { useFamily, FamilyMember } from '../../context/FamilyContext';
import { useUser } from '../../context/UserContext';
import { useBaby } from '../../context/BabyContext';
import { useTracker } from '../../hooks/useTrackerContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../utils/supabase';

import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

/* Permanent storage for guardian/member photos */
const GUARDIAN_IMAGES_DIR = FileSystem.documentDirectory + 'guardian_images/';

/* Shared storage bucket — same one CommunityProfileScreen writes to. */
const COMMUNITY_AVATARS_BUCKET = 'community_avatars';

/* Matches CommunityProfileScreen's generateUniqueFileName so path
   convention stays consistent across the app. */
const generateUniqueFileName = (userId: string, ext: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}_${timestamp}_${random}.${ext}`;
};

import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner, InlineSpinner } from '../../components/UniversalSpinner';

// Fabric detection — LayoutAnimation is a no-op there and logs a warning.
const IS_FABRIC =
  (global as any).nativeFabricUIManager != null ||
  typeof (global as any).RN$Bridgeless !== 'undefined' ||
  typeof (global as any).__turboModuleProxy !== 'undefined';

if (
  Platform.OS === 'android' &&
  !IS_FABRIC &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type EditGuardianScreenProps = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>;

/* Lightweight local shape for what ActivitySparkline consumes. */
type ActivityEntry = { type: string; timestamp: number; [k: string]: any };

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
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
    label: 'Viewer', color: '#94a3b8', gradient: ['#64748b', '#94a3b8'], icon: 'eye',
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
   DYNAMIC STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const getDynamicStyles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#08080f' : '#f4f6fa' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },

  // ── Sticky Header ──
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800', color: isDark ? '#fff' : '#1e293b', letterSpacing: -0.3 },
  stickySubtitle: { fontSize: 12, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 },

  // ── Top Header ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },

  // ── Glassy FABs (matches CommunityProfileScreen) ──
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  editToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  editToggleBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },

  // ── Profile Hero ──
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 22, fontWeight: '800', color: isDark ? '#fff' : '#1e293b', letterSpacing: -0.5 },
  profileMeta: { fontSize: 14, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b' },
  profileTags: { flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  profileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  profileTagText: { fontSize: 12, fontWeight: '700' },
  editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },

  // ── Quick Actions Dock ──
  dockContainer: { marginHorizontal: 16, marginBottom: 20 },
  dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  dockItem: { alignItems: 'center', gap: 6, flex: 1 },
  dockGradient: {
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockLabel: { fontSize: 11, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' },

  // ── Tab Bar ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 4,
    borderRadius: 16,
    gap: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
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

  // ── Glass Card ──
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  glassContent: { flex: 1 },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: isDark ? '#fff' : '#1e293b', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },

  // ── KPI Pills ──
  kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  kpiPill: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kpiPillIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  kpiPillEmoji: { fontSize: 20 },
  kpiPillBody: { flex: 1 },
  kpiPillValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  kpiPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: isDark ? '#94a3b8' : '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── AI Insights ──
  insightsList: { marginHorizontal: 0, gap: 8, marginBottom: 16 },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)',
    borderLeftWidth: 3,
  },
  insightIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightEmoji: { fontSize: 20 },
  insightContent: { flex: 1, gap: 3 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insightTitle: { fontSize: 14, fontWeight: '700', color: isDark ? '#fff' : '#1e293b' },
  insightDesc: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b' },
  insightActionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
  insightActionText: { fontSize: 11, fontWeight: '700' },
  insightPriority: { width: 4, height: 36, borderRadius: 2 },

  // ── Sparkline ──
  sparklineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  sparklineTitle: { fontSize: 16, fontWeight: '800', color: isDark ? '#fff' : '#1e293b' },
  sparklineSubtitle: { fontSize: 12, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 },
  sparklineTotal: { alignItems: 'flex-end' },
  sparklineTotalValue: { fontSize: 24, fontWeight: '800', color: '#6366f1' },
  sparklineTotalLabel: { fontSize: 11, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' },
  sparklineChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    height: 100,
  },
  sparklineBar: { width: 8, borderRadius: 4 },
  sparklineDay: { fontSize: 10, fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8' },

  // ── Health Score ──
  healthContainer: { flexDirection: 'row', padding: 16, gap: 16 },
  healthLeft: { flex: 1, gap: 4 },
  healthTitle: { fontSize: 16, fontWeight: '800', color: isDark ? '#fff' : '#1e293b' },
  healthSubtitle: { fontSize: 12, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b', marginBottom: 8 },
  healthMetrics: { flexDirection: 'row', gap: 16, marginTop: 4 },
  healthMetric: { alignItems: 'center', gap: 2 },
  healthMetricValue: { fontSize: 18, fontWeight: '800', color: isDark ? '#fff' : '#1e293b' },
  healthMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: isDark ? '#64748b' : '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  healthRingContainer: { justifyContent: 'center', alignItems: 'center' },
  healthRing: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  healthRingBg: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  healthRingFill: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  healthRingEmoji: { fontSize: 16 },
  healthRingScore: { fontSize: 20, fontWeight: '800' },
  healthRingLabel: { fontSize: 9, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b' },

  // ── Smart Recommendations ──
  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)',
    borderLeftWidth: 3,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  recIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recEmoji: { fontSize: 20 },
  recContent: { flex: 1, marginHorizontal: 12, gap: 4 },
  recTitle: { fontSize: 14, fontWeight: '700', color: isDark ? '#fff' : '#1e293b' },
  recReason: { fontSize: 12, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b' },
  recConfidence: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  recBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  recBarFill: { height: '100%', borderRadius: 2 },
  recConfidenceText: { fontSize: 10, fontWeight: '700' },

  // ── Timeline ──
  timelineContainer: { marginHorizontal: 16, gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { width: 24, alignItems: 'center', paddingTop: 16 },
  timelineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    left: 11,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: isDark ? '#fff' : '#1e293b',
    zIndex: 1,
  },
  timelineCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.75)',
    marginBottom: 12,
  },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  timelineEmoji: { fontSize: 20 },
  timelineMeta: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: isDark ? '#fff' : '#1e293b' },
  timelineDate: { fontSize: 11, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b', marginTop: 1 },
  timelineDesc: { fontSize: 12, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b', lineHeight: 17 },

  // ── Contact Info ──
  contactList: { padding: 8 },
  contactItem: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  contactIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  contactBody: { flex: 1, gap: 2 },
  contactLabel: { fontSize: 12, fontWeight: '500', color: isDark ? '#94a3b8' : '#64748b' },
  contactValue: { fontSize: 15, fontWeight: '600', color: isDark ? '#fff' : '#1e293b' },

  // ── Activity Tab ──
  activitiesList: { gap: 8, marginHorizontal: 0 },
  activityCard: { padding: 0 },
  activityRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  activityIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activityEmoji: { fontSize: 20 },
  activityContent: { flex: 1, gap: 2 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: isDark ? '#fff' : '#1e293b' },
  activityDetails: { fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2, lineHeight: 18 },
  activityTime: { fontSize: 12, color: isDark ? '#64748b' : '#94a3b8', marginTop: 4, fontWeight: '500' },
  activityTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  activityTypeText: { fontSize: 11, fontWeight: '700' },

  // ── Empty States ──
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: { fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#1e293b', textAlign: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center', lineHeight: 20 },

  // ── Permissions ──
  permissionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  permissionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  permissionChipText: { fontSize: 13, fontWeight: '600' },
  permissionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.08)',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  permissionNoteText: { fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', flex: 1, lineHeight: 18 },

  // ── Stats Grid ──
  statsGrid: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', justifyContent: 'center' },
  statCardValue: { fontSize: 24, fontWeight: '800', color: isDark ? '#fff' : '#1e293b' },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: isDark ? '#94a3b8' : '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // ── Activity Breakdown ──
  activityBreakdown: { marginTop: 16, marginHorizontal: 16 },
  breakdownTitle: { fontSize: 16, fontWeight: '800', color: isDark ? '#fff' : '#1e293b', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  breakdownLabel: { fontSize: 14, fontWeight: '600', color: isDark ? '#fff' : '#1e293b' },
  breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownBar: { width: 80, height: 6, borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 3 },
  breakdownCount: { fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'right' },

  // ── Manage Permissions Button ──
  managePermissionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  managePermissionsText: { fontSize: 15, fontWeight: '700', flex: 1, marginLeft: 12 },

  // ── Settings / Inputs ──
  inputGroup: { marginBottom: 16, paddingHorizontal: 16 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: isDark ? '#94a3b8' : '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  inputDisabled: { opacity: 0.5 },
  inputIcon: { marginRight: 12 },
  inputField: { flex: 1, fontSize: 16, color: isDark ? '#fff' : '#1e293b', fontWeight: '600' },
  inputText: { flex: 1, fontSize: 16, color: isDark ? '#fff' : '#1e293b', fontWeight: '600' },
  flexInput: { flex: 1 },
  ownedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
  ownedBadgeText: { color: isDark ? '#fff' : '#1e293b', fontSize: 11, fontWeight: '700' },

  // ── Preferences ──
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  preferenceText: { gap: 2 },
  preferenceTitle: { fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#1e293b' },
  preferenceDesc: { fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' },

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
  dangerDesc: { fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', lineHeight: 17 },
  dangerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ef444420' },
  dangerBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },

  // ── Modals ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    backgroundColor: isDark ? '#1e1e2e' : '#ffffff',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: isDark ? '#fff' : '#1e293b', letterSpacing: -0.3 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Image Picker ──
  imagePickerOptions: { padding: 8 },
  imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8 },
  imagePickerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  imagePickerLabel: { fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#1e293b', flex: 1 },

  // ── Role Modal ──
  roleOptions: { padding: 8 },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleOptionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  roleOptionInfo: { flex: 1 },
  roleOptionTitle: { fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#1e293b', marginBottom: 2 },
  roleOptionDesc: { fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' },

  // ── Emoji Picker ──
  emojiPickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  emojiPickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: isDark ? '#1e1e2e' : '#ffffff',
  },
  emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  emojiPickerTitle: { fontSize: 18, fontWeight: '800', color: isDark ? '#fff' : '#1a1a2e' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  emojiButton: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emojiButtonText: { fontSize: 28 },

  // ── Retry ──
  retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Drag Handle ──
  modalDragHandle: { alignItems: 'center', paddingVertical: 10 },
  dragIndicator: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
});

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0, isDark }: {
  children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean; delay?: number; isDark: boolean;
}) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={[styles.glassCard, active && { borderColor: '#6366f1', borderWidth: 2 }, style]}>
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string; isDark: boolean;
}) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
  return (
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
  );
});

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark }: {
  tabs: { key: ProfileTab; label: string; icon: string }[];
  activeTab: ProfileTab; onChange: (t: ProfileTab) => void; isDark: boolean;
}) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={[styles.tabItem, isActive && { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
            <Ionicons name={tab.icon as any} size={16} color={isActive ? '#6366f1' : '#94a3b8'} />
            <Text style={[styles.tabLabel, { color: isActive ? '#6366f1' : '#94a3b8' }, isActive && { fontWeight: '700' }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const KpiPill = React.memo(({ icon, value, label, color, onPress, isDark }: any) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
  return (
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
  );
});

/* ── Skeleton placeholder for the hero (no blocking spinner) ───────────── */
const HeroSkeleton = React.memo(({ isDark, avatarSize }: { isDark: boolean; avatarSize: number }) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
  const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const barSoft = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  return (
    <View style={styles.profileHero}>
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: barBg,
          borderWidth: 3,
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        }}
      />
      <View style={styles.profileInfo}>
        <View style={{ height: 22, width: 150, borderRadius: 8, backgroundColor: barBg, marginBottom: 8 }} />
        <View style={{ height: 12, width: 120, borderRadius: 6, backgroundColor: barSoft, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ height: 22, width: 80, borderRadius: 10, backgroundColor: barSoft }} />
          <View style={{ height: 22, width: 60, borderRadius: 10, backgroundColor: barSoft }} />
        </View>
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   FEATURE 1: AI Member Insights
   ═══════════════════════════════════════════════════════════════════════════ */

const AIMemberInsights = React.memo(({ member, activities, isDark }: any) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
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
      <SectionHeader title="AI Insights" subtitle="Intelligence-powered analysis" isDark={isDark} />
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
   FEATURE 2: Activity Sparkline
   ═══════════════════════════════════════════════════════════════════════════ */

const ActivitySparkline = React.memo(({ activities, isDark }: { activities: ActivityEntry[]; isDark: boolean }) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
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
      <GlassCard isDark={isDark}>
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
   FEATURE 3: Relationship Health
   ═══════════════════════════════════════════════════════════════════════════ */

const RelationshipHealth = React.memo(({ member, activities, isDark }: any) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
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
      <GlassCard isDark={isDark}>
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
   FEATURE 4: Smart Role Recommendations
   ═══════════════════════════════════════════════════════════════════════════ */

const SmartRoleRecommendations = React.memo(({ member, activities, onRoleChange, canManage, isDark }: any) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
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
      <SectionHeader title="Smart Recommendations" subtitle="AI-suggested role adjustments" isDark={isDark} />
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
   FEATURE 5: Engagement Timeline
   ═══════════════════════════════════════════════════════════════════════════ */

const EngagementTimeline = React.memo(({ member, activities, milestones, isDark }: any) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
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
      <SectionHeader title="Engagement Timeline" subtitle="Key moments with this member" isDark={isDark} />
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
   FEATURE 6: Quick Actions Dock
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActionsDock = React.memo(({ member, isCurrentUser, onMessage, onCall, onShare, onEdit, isDark, iconSize }: any) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
  return (
    <Animated.View entering={FadeInUp.delay(450).springify()} style={styles.dockContainer}>
      <View style={styles.dock}>
        {!isCurrentUser && (
          <TouchableOpacity onPress={onMessage} style={styles.dockItem}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={[styles.dockGradient, { width: iconSize, height: iconSize }]}>
              <Ionicons name="chatbubble" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.dockLabel}>Message</Text>
          </TouchableOpacity>
        )}
        {!isCurrentUser && member?.phoneNumber && (
          <TouchableOpacity onPress={onCall} style={styles.dockItem}>
            <LinearGradient colors={['#10b981', '#34d399']} style={[styles.dockGradient, { width: iconSize, height: iconSize }]}>
              <Ionicons name="call" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.dockLabel}>Call</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onShare} style={styles.dockItem}>
          <View style={[styles.dockGradient, { width: iconSize, height: iconSize, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </View>
          <Text style={styles.dockLabel}>Share</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════════════════════════════════════ */

const ActionModal = React.memo(({ visible, onClose, title, children, isDark }: any) => {
  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent]}>
          <View style={styles.modalDragHandle}>
            <View style={styles.dragIndicator} />
          </View>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
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
  const params = (route.params ?? {}) as {
    guardianId?: string;
    memberId?: string;
    mode?: 'guardian' | 'parent2' | 'viewer';
    fromChat?: boolean;
  };
  const guardianId = params.guardianId ?? params.memberId ?? '';
  const mode = params.mode ?? 'guardian';
  const fromChat = params.fromChat ?? false;

  const { members, updateGuardianProfile, removeMember, loadFamily, refreshFamily } = useFamily();
  const { hasPermission, profile, updateProfile } = useUser();
  const { currentBaby, milestones, refreshBabyData } = useBaby();
  const { entries: trackerEntries } = useTracker();
  const { userProfile } = useAuth();
  const { darkMode, triggerHaptic } = useCustomization();
  const sweetAlert = useSweetAlert();
  const colorScheme = useColorScheme();
  const isDark = darkMode ?? (colorScheme === 'dark');

  // ── Responsive dims ─────────────────────────────────────────────────
  const { width: SCREEN_W } = useWindowDimensions();
  const isCompact = SCREEN_W < 360;
  const isTablet = SCREEN_W >= 768;
  const AVATAR_SIZE = isTablet ? 128 : Math.max(88, Math.min(108, SCREEN_W * 0.26));
  const DOCK_ICON_SIZE = isCompact ? 44 : 52;

  // ─── REFS ──────────────────────────────────────────────────────────────
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
  // NEW: never gate the screen on this — only the hero shows a skeleton.
  const [isHydrating, setIsHydrating] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [memberActivities, setMemberActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  // NEW: DB-authoritative verification flag (matches CommunityProfileScreen).
  const [isMemberVerified, setIsMemberVerified] = useState(false);

  const [formData, setFormData] = useState({ fullName: '', email: '', phoneNumber: '', relationship: '', username: '', avatar: '', notificationsEnabled: true });
  const [originalData, setOriginalData] = useState({ fullName: '', email: '', phoneNumber: '', relationship: '', username: '', avatar: '', notificationsEnabled: true });

  const [usernameCheck, setUsernameCheck] = useState<{ available: boolean; message: string } | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const usernameDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

  const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
  const isCurrentUser = member?.id === currentUserId;

  const roleConfig = member ? ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER] : null;
  const canEdit = useMemo(() => { if (isCurrentUser) return true; return hasPermission('manageFamily') && roleConfig?.canEdit; }, [hasPermission, roleConfig, isCurrentUser]);
  const canRemove = useMemo(() => hasPermission('manageFamily') && roleConfig?.canRemove && !isCurrentUser, [hasPermission, roleConfig, isCurrentUser]);
  const canManagePermissions = useMemo(() => hasPermission('manageFamily') && !isCurrentUser, [hasPermission, isCurrentUser]);

  const styles = useMemo(() => getDynamicStyles(isDark), [isDark]);

  // ─── PERSIST PICKED IMAGE ─────────────────────────────────────────────
  const persistPickedImage = useCallback(
    async (sourceUri: string, memberId: string): Promise<{ localUri: string; publicUrl: string } | null> => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(GUARDIAN_IMAGES_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(GUARDIAN_IMAGES_DIR, { intermediates: true });
        }

        const ext = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
        const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
        const localUri = `${GUARDIAN_IMAGES_DIR}${memberId}_${Date.now()}.${safeExt}`;

        if (sourceUri.startsWith('content://')) {
          const base64 = await FileSystem.readAsStringAsync(sourceUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(localUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else if (sourceUri.startsWith('data:')) {
          const base64Data = sourceUri.split(',')[1];
          if (!base64Data) throw new Error('Invalid data URI');
          await FileSystem.writeAsStringAsync(localUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          await FileSystem.copyAsync({ from: sourceUri, to: localUri });
        }

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) {
          if (__DEV__) console.warn('[persistPickedImage] Local file missing after write:', localUri);
          return null;
        }

        const fileData = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileName = generateUniqueFileName(memberId, safeExt);
        const storagePath = `avatars/${fileName}`;

        try {
          const { error: bucketErr } = await supabase.storage.getBucket(COMMUNITY_AVATARS_BUCKET);
          if (bucketErr && /not found/i.test(bucketErr.message)) {
            await supabase.storage.createBucket(COMMUNITY_AVATARS_BUCKET, { public: true });
          }
        } catch {}

        const { error: uploadError } = await supabase.storage
          .from(COMMUNITY_AVATARS_BUCKET)
          .upload(storagePath, decode(fileData), {
            contentType: `image/${safeExt}`,
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          if (__DEV__) console.warn('[persistPickedImage] Storage upload failed:', uploadError.message);
          return { localUri, publicUrl: localUri };
        }

        const { data: urlData } = supabase.storage
          .from(COMMUNITY_AVATARS_BUCKET)
          .getPublicUrl(storagePath);

        const publicUrl = urlData.publicUrl;
        if (__DEV__) console.log('[persistPickedImage] Uploaded to community_avatars:', publicUrl);

        return { localUri, publicUrl };
      } catch (error) {
        if (__DEV__) console.warn('[persistPickedImage] Failed:', error);
        return null;
      }
    },
    [],
  );

  // ─── LOAD MEMBER ACTIVITIES ───────────────────────────────────────────
  const loadMemberActivities = useCallback(async (memberId: string, memberUserId?: string, memberName?: string) => {
    if (!currentBaby) return;
    setIsLoadingActivities(true);
    try {
      const memberActs = trackerEntries.filter((a: any) => {
        if (a.isDeleted) return false;
        if (a.loggedBy === memberId) return true;
        if (memberUserId && a.loggedBy === memberUserId) return true;
        if (memberName && a.loggedByName === memberName) return true;
        return false;
      });
      if (isMountedRef.current) {
        setMemberActivities(memberActs.sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 30));
      }
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] activities load error:', error);
      if (isMountedRef.current) setMemberActivities([]);
    } finally {
      if (isMountedRef.current) setIsLoadingActivities(false);
    }
  }, [currentBaby, trackerEntries]);

  // ─── LOAD MEMBER DATA ─────────────────────────────────────────────────
  const loadMemberData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsHydrating(true);

    try {
      await loadFamily();

      let found = members.find(m => m.id === guardianId);
      if (!found) {
        const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
        if (guardianId === currentUserIdLocal || guardianId === 'parent1') {
          found = {
            id: currentUserIdLocal || 'parent1', userId: currentUserIdLocal || 'parent1',
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
      if (found && isMountedRef.current) {
        setMember(found);

        let username = '';
        let canonicalAvatar = '';
        let verifiedFromDb = false;
        const profileIdForLookup =
          found.id === (userProfile?.id || userProfile?.uid || profile?.id)
            ? (userProfile?.id || userProfile?.uid || profile?.id)
            : (found as any).userId;

        if (profileIdForLookup) {
          try {
            const { data } = await supabase
              .from('profiles')
              .select('community_handle, community_username, community_avatar, avatar_url, is_verified')
              .eq('id', profileIdForLookup)
              .maybeSingle();
            if (data) {
              username = (data.community_handle || '').replace(/^@/, '')
                || (data.community_username || '');
              canonicalAvatar = data.community_avatar || data.avatar_url || '';
              verifiedFromDb = data.is_verified === true;
            }
          } catch (e) {
            if (__DEV__) console.warn('[EditGuardian] profile lookup failed:', e);
          }
        }

        if (isMountedRef.current) {
          setIsMemberVerified(verifiedFromDb);
        }

        const resolvedAvatar = canonicalAvatar || found.avatar || '';

        const initialData = {
          fullName: found.fullName || '',
          email: found.email || '',
          phoneNumber: found.phoneNumber || '',
          relationship: found.relationship || '',
          username,
          avatar: resolvedAvatar,
          notificationsEnabled: found.notificationsEnabled ?? true,
        };
        setFormData(initialData);
        setOriginalData(initialData);
        if (currentBaby) await loadMemberActivities(found.id, found.userId, found.fullName);
      } else if (isMountedRef.current) {
        const reason = !guardianId
          ? 'No member ID was provided to this screen.'
          : 'The requested family member could not be found.';
        if (__DEV__) console.warn('[EditGuardian] Member lookup failed:', guardianId);
        sweetAlert.error('Member Not Found', reason);
      }
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] load member error:', error);
    } finally {
      isLoadingRef.current = false;
      if (isMountedRef.current) {
        setIsHydrating(false);
      }
    }
  }, [guardianId, members, loadFamily, userProfile, profile, currentBaby, sweetAlert, loadMemberActivities]);

  // ─── REFRESH MEMBER DATA ─────────────────────────────────────────────
  const refreshMemberData = useCallback(async () => {
    if (isLoadingRef.current || !member) return;
    isLoadingRef.current = true;

    try {
      if (typeof refreshFamily === 'function') {
        await refreshFamily();
      }

      if (typeof refreshBabyData === 'function' && currentBaby?.id) {
        await refreshBabyData(currentBaby.id);
      }

      const updatedMember = members.find(m => m.id === member.id);
      if (updatedMember && isMountedRef.current) {
        setMember(updatedMember);

        let username = formData.username;
        let verifiedFromDb = isMemberVerified;
        const profileIdForLookup =
          updatedMember.id === (userProfile?.id || userProfile?.uid || profile?.id)
            ? (userProfile?.id || userProfile?.uid || profile?.id)
            : (updatedMember as any).userId;

        if (profileIdForLookup) {
          try {
            const { data } = await supabase
              .from('profiles')
              .select('community_handle, community_username, is_verified')
              .eq('id', profileIdForLookup)
              .maybeSingle();
            if (data) {
              username = (data.community_handle || '').replace(/^@/, '')
                || (data.community_username || '')
                || username;
              verifiedFromDb = data.is_verified === true;
            }
          } catch {}
        }

        if (isMountedRef.current) {
          setIsMemberVerified(verifiedFromDb);
        }

        const initialData = {
          fullName: updatedMember.fullName || '',
          email: updatedMember.email || '',
          phoneNumber: updatedMember.phoneNumber || '',
          relationship: updatedMember.relationship || '',
          username,
          avatar: updatedMember.avatar || '',
          notificationsEnabled: updatedMember.notificationsEnabled ?? true,
        };
        setFormData(initialData);
        setOriginalData(initialData);
        if (currentBaby) await loadMemberActivities(updatedMember.id, updatedMember.userId, updatedMember.fullName);
      }
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] refresh error:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [member, members, refreshFamily, refreshBabyData, currentBaby, loadMemberActivities, formData.username, userProfile, profile, isMemberVerified]);

  // ─── INITIAL LOAD ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadMemberData();
    }
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── USERNAME AVAILABILITY ────────────────────────────────────────────
  useEffect(() => {
    if (usernameDebounceRef.current) {
      clearTimeout(usernameDebounceRef.current);
      usernameDebounceRef.current = null;
    }

    const trimmed = formData.username.trim().toLowerCase().replace(/^@/, '');

    if (trimmed === originalData.username.trim().toLowerCase().replace(/^@/, '')) {
      setUsernameCheck(null);
      setIsCheckingUsername(false);
      return;
    }

    if (!trimmed || trimmed.length < 3) {
      setUsernameCheck(
        trimmed.length === 0
          ? null
          : { available: false, message: 'Username must be at least 3 characters' }
      );
      return;
    }

    setIsCheckingUsername(true);
    setUsernameCheck(null);

    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, community_handle, community_username')
          .or(`community_handle.eq.@${trimmed},community_username.eq.${trimmed}`)
          .limit(2);

        if (error) {
          setUsernameCheck({ available: false, message: 'Could not verify availability' });
          return;
        }

        const ownerId = (data || [])[0]?.id;
        const myProfileId =
          member?.id === (userProfile?.id || userProfile?.uid || profile?.id)
            ? (userProfile?.id || userProfile?.uid || profile?.id)
            : (member as any)?.userId;

        if (!ownerId || ownerId === myProfileId) {
          setUsernameCheck({ available: true, message: 'Username is available' });
        } else {
          setUsernameCheck({ available: false, message: 'Username is already taken' });
        }
      } catch {
        setUsernameCheck({ available: false, message: 'Could not verify availability' });
      } finally {
        setIsCheckingUsername(false);
      }
    }, 450);

    return () => {
      if (usernameDebounceRef.current) {
        clearTimeout(usernameDebounceRef.current);
        usernameDebounceRef.current = null;
      }
    };
  }, [formData.username, originalData.username, member, userProfile, profile]);

  // ─── CLEANUP ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  // ─── FOCUS EFFECT ─────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (member && !isLoadingRef.current) {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
        refreshTimerRef.current = setTimeout(() => {
          refreshMemberData();
        }, 300);
      }
      return () => {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }, [member, refreshMemberData])
  );

  // ─── VERIFY PASSWORD ──────────────────────────────────────────────────
  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    try {
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] password verify error:', error);
      return false;
    }
  }, []);

  // ─── HANDLE SAVE ──────────────────────────────────────────────────────
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

    const linkedProfileId: string | undefined = isCurrentUserLocal
      ? currentUserIdLocal
      : (member as any).userId || undefined;

    const profileUpdates: Record<string, unknown> = {};

    const normalizeHandle = (v: string) => v.trim().toLowerCase().replace(/^@/, '');
    const cleanUsername = normalizeHandle(formData.username);
    const originalUsername = normalizeHandle(originalData.username);

    if (cleanUsername !== originalUsername && cleanUsername.length > 0) {
      if (cleanUsername.length < 3) {
        setIsSaving(false); saveConfirmOpenRef.current = false;
        sweetAlert.error('Invalid Username', 'Username must be at least 3 characters');
        triggerHaptic('error');
        return;
      }
      if (cleanUsername.length > 30) {
        setIsSaving(false); saveConfirmOpenRef.current = false;
        sweetAlert.error('Invalid Username', 'Username must be less than 30 characters');
        triggerHaptic('error');
        return;
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(cleanUsername)) {
        setIsSaving(false); saveConfirmOpenRef.current = false;
        sweetAlert.error(
          'Invalid Username',
          'Must start with a letter. Only letters, numbers, underscores, and dots allowed.'
        );
        triggerHaptic('error');
        return;
      }

      try {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .or(`community_handle.eq.@${cleanUsername},community_username.eq.${cleanUsername}`)
          .maybeSingle();

        if (existing && existing.id !== linkedProfileId) {
          setIsSaving(false); saveConfirmOpenRef.current = false;
          sweetAlert.error('Username Taken', 'That username is already in use');
          triggerHaptic('error');
          return;
        }
      } catch {}

      if (linkedProfileId) {
        profileUpdates.community_handle = `@${cleanUsername}`;
        profileUpdates.community_username = cleanUsername;
      }
    } else if (cleanUsername !== originalUsername && cleanUsername.length === 0) {
      setIsSaving(false); saveConfirmOpenRef.current = false;
      sweetAlert.error('Invalid Username', 'Username cannot be empty');
      triggerHaptic('error');
      return;
    }

    if (!isCurrentUserLocal && formData.fullName !== originalData.fullName) {
      updates.fullName = formData.fullName.trim();
      if (linkedProfileId) profileUpdates.full_name = formData.fullName.trim();
    }
    if (formData.email !== originalData.email) {
      updates.email = formData.email.trim();
      if (linkedProfileId) profileUpdates.email = formData.email.trim();
    }
    if (formData.phoneNumber !== originalData.phoneNumber) {
      updates.phoneNumber = formData.phoneNumber.trim();
      if (linkedProfileId) profileUpdates.phone_number = formData.phoneNumber.trim();
    }
    if (formData.relationship !== originalData.relationship) {
      updates.relationship = formData.relationship.trim();
    }
    if (formData.avatar !== originalData.avatar) {
      updates.avatar = formData.avatar;
      if (linkedProfileId) {
        profileUpdates.avatar = formData.avatar;
        profileUpdates.avatar_url = formData.avatar;
        profileUpdates.community_avatar = formData.avatar;
      }
    }
    if (formData.notificationsEnabled !== originalData.notificationsEnabled) {
      updates.notificationsEnabled = formData.notificationsEnabled;
      if (linkedProfileId) profileUpdates.notifications_enabled = formData.notificationsEnabled;
    }

    if (Object.keys(updates).length === 0) {
      sweetAlert.toast('No Changes', 'No changes were made');
      setIsEditing(false);
      setIsSaving(false);
      saveConfirmOpenRef.current = false;
      return;
    }

    try {
      if (linkedProfileId && Object.keys(profileUpdates).length > 0) {
        try {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({ ...profileUpdates, updated_at: new Date().toISOString() })
            .eq('id', linkedProfileId);

          if (profileErr) {
            if (__DEV__) console.warn('[EditGuardian] profiles sync failed:', profileErr.message);
            if (profileUpdates.email) {
              sweetAlert.error(
                'Email Not Updated',
                'Could not update the login email. The family record was updated, but sign-in may still use the old email.'
              );
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[EditGuardian] profiles sync threw:', e);
        }
      }

      if (isCurrentUserLocal) {
        try {
          await updateProfile({
            phoneNumber: formData.phoneNumber,
            email: formData.email,
            avatar: formData.avatar,
          });
        } catch (e) {
          if (__DEV__) console.warn('[EditGuardian] userContext sync failed:', e);
        }
      }

      const success = await updateGuardianProfile(member.id, updates);
      if (success) {
        triggerHaptic('success');
        setIsEditing(false);
        setMember(prev => prev ? { ...prev, ...updates } : null);
        setOriginalData({ ...formData });

        sweetAlert.success('Profile Updated', 'All changes saved successfully');
        await refreshMemberData();
      } else {
        triggerHaptic('error');
        sweetAlert.error('Save Failed', 'Please try again.');
      }
    } catch (error) {
      triggerHaptic('error');
      sweetAlert.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
      saveConfirmOpenRef.current = false;
    }
  };

  // ─── HANDLE REMOVE ────────────────────────────────────────────────────
  const handleRemove = useCallback(() => {
    if (!member) return;
    const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
    if (member.id === currentUserIdLocal) {
      sweetAlert.alert('Cannot Remove', 'You cannot remove yourself.', 'warning');
      return;
    }
    if (!hasPermission('manageFamily')) {
      sweetAlert.error('Permission Denied', 'Only parents can remove members');
      triggerHaptic('error');
      return;
    }

    sweetAlert.confirm(
      'Remove Family Member',
      `Remove ${member.fullName}? Their history will be preserved but they will lose access.`,
      async () => {
        triggerHaptic('error');
        const success = await removeMember(member.id);
        if (success) {
          triggerHaptic('success');
          sweetAlert.success('Member Removed', `${member.fullName} has been removed`);
          navigation.goBack();
        } else {
          sweetAlert.error('Error', 'Failed to remove family member');
        }
      },
      () => {},
      'Remove',
      'Cancel'
    );
  }, [member, userProfile, profile, hasPermission, removeMember, navigation, sweetAlert, triggerHaptic]);

  // ─── HANDLE CAMERA CAPTURE ────────────────────────────────────────────
  const handleCameraCapture = async () => {
    setShowImagePicker(false);
    if (!member) {
      sweetAlert.error('Error', 'No member selected');
      return;
    }
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.error('Permission Required', 'Please allow camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      const uploaded = await persistPickedImage(rawUri, member.id);
      if (!uploaded) {
        sweetAlert.error('Error', 'Failed to save photo');
        setIsSaving(false);
        return;
      }
      const { localUri, publicUrl } = uploaded;

      setFormData(prev => ({ ...prev, avatar: localUri }));

      const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
      const isCurrentUserLocal = member.id === currentUserIdLocal;
      const linkedProfileId: string | undefined = isCurrentUserLocal
        ? currentUserIdLocal
        : (member as any).userId || undefined;

      if (linkedProfileId && publicUrl && !publicUrl.startsWith('file://')) {
        try {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({
              community_avatar: publicUrl,
              avatar_url: publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', linkedProfileId);
          if (profileErr) {
            if (__DEV__) console.warn('[EditGuardian] profiles avatar sync failed:', profileErr.message);
          }
        } catch (e) {
          if (__DEV__) console.warn('[EditGuardian] profiles avatar sync threw:', e);
        }
      }

      if (isCurrentUserLocal) {
        try {
          await updateProfile({ avatar: publicUrl || localUri });
        } catch (e) {}
      }

      const success = await updateGuardianProfile(member.id, { avatar: localUri });
      if (success) {
        setMember(prev => prev ? { ...prev, avatar: localUri } : null);
        setOriginalData(prev => ({ ...prev, avatar: localUri }));
        triggerHaptic('success');
        sweetAlert.success('Photo Updated', 'Camera photo saved');
        await refreshMemberData();
      }
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] Camera error:', error);
      sweetAlert.error('Error', 'Failed to capture photo');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── HANDLE IMAGE PICK ────────────────────────────────────────────────
  const handleImagePick = async () => {
    setShowImagePicker(false);
    if (!member) {
      sweetAlert.error('Error', 'No member selected');
      return;
    }
    try {
      triggerHaptic('light');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.error('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setIsSaving(true);
      const rawUri = result.assets[0].uri;
      const uploaded = await persistPickedImage(rawUri, member.id);
      if (!uploaded) {
        sweetAlert.error('Error', 'Failed to save image to app storage');
        setIsSaving(false);
        return;
      }
      const { localUri, publicUrl } = uploaded;

      setFormData(prev => ({ ...prev, avatar: localUri }));

      const currentUserIdLocal = userProfile?.id || userProfile?.uid || profile?.id;
      const isCurrentUserLocal = member.id === currentUserIdLocal;
      const linkedProfileId: string | undefined = isCurrentUserLocal
        ? currentUserIdLocal
        : (member as any).userId || undefined;

      if (linkedProfileId && publicUrl && !publicUrl.startsWith('file://')) {
        try {
          const { error: profileErr } = await supabase
            .from('profiles')
            .update({
              community_avatar: publicUrl,
              avatar_url: publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', linkedProfileId);
          if (profileErr) {
            if (__DEV__) console.warn('[EditGuardian] profiles avatar sync failed:', profileErr.message);
          }
        } catch (e) {
          if (__DEV__) console.warn('[EditGuardian] profiles avatar sync threw:', e);
        }
      }

      if (isCurrentUserLocal) {
        try {
          await updateProfile({ avatar: publicUrl || localUri });
        } catch (e) {}
      }

      const success = await updateGuardianProfile(member.id, { avatar: localUri });
      if (success) {
        setMember(prev => prev ? { ...prev, avatar: localUri } : null);
        setOriginalData(prev => ({ ...prev, avatar: localUri }));
        triggerHaptic('success');
        sweetAlert.success('Photo Updated', 'Profile picture saved');
        await refreshMemberData();
      } else {
        sweetAlert.error('Save Failed', 'Image saved but family record update failed');
      }
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] Image pick error:', error);
      sweetAlert.error('Error', 'Failed to process image');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── ROLE CHANGE ──────────────────────────────────────────────────────
  const handleRoleChange = async (newRole: UserRole) => {
    if (!member || !hasPermission('manageFamily')) return;
    if (member.role === newRole) { setShowRoleModal(false); return; }
    const roleConfigLocal = ROLE_CONFIG[newRole];
    sweetAlert.confirm('Change Role', `Change ${member.fullName} to ${roleConfigLocal.label}?`, async () => {
      setIsSaving(true);
      try {
        const success = await updateGuardianProfile(member.id, { role: newRole });
        if (success) {
          setMember(prev => prev ? { ...prev, role: newRole } : null);
          sweetAlert.success('Role Updated', `${member.fullName} is now a ${roleConfigLocal.label}`);
          await refreshMemberData();
        } else sweetAlert.error('Error', 'Failed to update role');
      } catch (error) {
        sweetAlert.error('Error', 'An error occurred');
      }
      setIsSaving(false); setShowRoleModal(false);
    }, () => setShowRoleModal(false), 'Change', 'Cancel');
  };

  // ─── CALL / MESSAGE / SHARE ───────────────────────────────────────────
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
        message: `${member.fullName} - ${ROLE_LABELS[member.role] || member.role}\n${member.email || ''}\n${member.phoneNumber || ''}`,
        title: `${member.fullName}'s Contact Info`,
      });
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] share error:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFamily();
      if (typeof refreshBabyData === 'function' && currentBaby?.id) {
        await refreshBabyData(currentBaby.id);
      }
      if (member) await loadMemberActivities(member.id, member.userId, member.fullName);
    } catch (error) {
      if (__DEV__) console.warn('[EditGuardian] refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadFamily, refreshBabyData, currentBaby, member, loadMemberActivities]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    if (!IS_FABRIC) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

  // ─── GUARDS ───────────────────────────────────────────────────────────
  // "Member not found" ONLY after hydration completes. No flash while loading.
  if (!member && !isHydrating) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#08080f' : '#f4f6fa' }]} />
        <Ionicons name="alert-circle-outline" size={64} color="#64748b" />
        <Text style={{ marginTop: 16, color: isDark ? '#94a3b8' : '#64748b', fontSize: 16, fontWeight: '600' }}>Member not found</Text>
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#08080f' : '#f4f6fa' }]} />

      {/* Sticky header — pointerEvents none so it never steals touches */}
      <Animated.View
        style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}
        pointerEvents="none"
      >
        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyTitle}>{member?.fullName || 'Member'}</Text>
        <Text style={styles.stickySubtitle}>{roleConfig?.label || ''}</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" colors={['#6366f1', '#8b5cf6']} />
        }
      >
        {/* Header row — single edit toggle */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {canEdit && member && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                setIsEditing(!isEditing);
              }}
              style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={isEditing ? 'close' : 'create-outline'} size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Profile hero — skeleton on first frame, real content once hydrated */}
        {isHydrating && !member ? (
          <HeroSkeleton isDark={isDark} avatarSize={AVATAR_SIZE} />
        ) : member && roleConfig ? (
          <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => canEdit && setShowImagePicker(true)} disabled={!canEdit}>
              <SafeAvatar
                avatar={formData.avatar || member.avatar}
                size={AVATAR_SIZE}
                fallbackIcon={roleConfig.icon as any}
                fallbackColor={roleConfig.color}
                fallbackBgColor={`${roleConfig.color}20`}
                borderColor={roleConfig.color}
                borderWidth={3}
                showEditBadge={canEdit}
                animated={true}
              />
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.profileName} numberOfLines={1}>{member.fullName}</Text>
                {isMemberVerified && (
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#6366f1',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
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
        ) : null}

        {/* Quick actions dock */}
        {member && (
          <QuickActionsDock
            member={member}
            isCurrentUser={isCurrentUser}
            onMessage={handleMessage}
            onCall={handleCall}
            onShare={handleShare}
            onEdit={() => setIsEditing(true)}
            isDark={isDark}
            iconSize={DOCK_ICON_SIZE}
          />
        )}

        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} />

        {/* Body — 3-card skeleton while hydrating, real tabs once ready */}
        {!member ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  height: 96,
                  borderRadius: 20,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  marginBottom: 12,
                }}
              />
            ))}
          </View>
        ) : roleConfig ? (
          <>
            {/* ── OVERVIEW ──────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <>
                <View style={styles.kpiPillRow}>
                  <KpiPill icon="📊" value={memberActivities.length} label="Activities" color="#6366f1" isDark={isDark} />
                  <KpiPill icon="🔥" value={member?.streak || 0} label="Day Streak" color="#f59e0b" isDark={isDark} />
                  <KpiPill icon="⭐" value={roleConfig.priority} label="Priority" color={roleConfig.color} isDark={isDark} />
                </View>
                <AIMemberInsights member={member} activities={memberActivities} isDark={isDark} />
                <ActivitySparkline activities={memberActivities} isDark={isDark} />
                <RelationshipHealth member={member} activities={memberActivities} isDark={isDark} />
                <SmartRoleRecommendations member={member} activities={memberActivities} onRoleChange={handleRoleChange} canManage={canManagePermissions} isDark={isDark} />
                <EngagementTimeline member={member} activities={memberActivities} milestones={milestones} isDark={isDark} />
                <Animated.View entering={FadeInUp.delay(500).springify()}>
                  <SectionHeader title="Contact Info" isDark={isDark} />
                  <GlassCard isDark={isDark}>
                    <View style={styles.contactList}>
                      {member.email && (
                        <View style={styles.contactItem}>
                          <View style={[styles.contactIcon, { backgroundColor: '#6366f115' }]}>
                            <Ionicons name="mail-outline" size={18} color="#6366f1" />
                          </View>
                          <View style={styles.contactBody}>
                            <Text style={styles.contactLabel}>Email</Text>
                            <Text style={styles.contactValue} numberOfLines={1}>{member.email}</Text>
                          </View>
                        </View>
                      )}
                      {member.phoneNumber && (
                        <View style={styles.contactItem}>
                          <View style={[styles.contactIcon, { backgroundColor: '#10b98115' }]}>
                            <Ionicons name="call-outline" size={18} color="#10b981" />
                          </View>
                          <View style={styles.contactBody}>
                            <Text style={styles.contactLabel}>Phone</Text>
                            <Text style={styles.contactValue}>{member.phoneNumber}</Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.contactItem}>
                        <View style={[styles.contactIcon, { backgroundColor: '#f59e0b15' }]}>
                          <Ionicons name="calendar-outline" size={18} color="#f59e0b" />
                        </View>
                        <View style={styles.contactBody}>
                          <Text style={styles.contactLabel}>Member Since</Text>
                          <Text style={styles.contactValue}>
                            {member.addedAt
                              ? new Date(member.addedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                              : 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </GlassCard>
                </Animated.View>
              </>
            )}

            {/* ── ACTIVITY ─────────────────────────────────────────────── */}
            {activeTab === 'activity' && (
              <>
                <SectionHeader title="Recent Activity" subtitle={`${memberActivities.length} entries`} isDark={isDark} />
                {isLoadingActivities ? (
                  <GlassCard style={styles.emptyCard} isDark={isDark}>
                    <View style={styles.emptyStateIcon}>
                      <InlineSpinner size={24} color="#6366f1" section="main" />
                    </View>
                    <Text style={styles.emptyStateTitle}>Loading activities...</Text>
                  </GlassCard>
                ) : memberActivities.length === 0 ? (
                  <GlassCard style={styles.emptyCard} isDark={isDark}>
                    <View style={styles.emptyStateIcon}>
                      <Ionicons name="time-outline" size={32} color="#6366f1" />
                    </View>
                    <Text style={styles.emptyStateTitle}>
                      {isCurrentUser
                        ? "You haven't recorded any activities yet"
                        : `${member.fullName} hasn't recorded any activities yet`}
                    </Text>
                    <Text style={styles.emptyText}>
                      Activities will appear here when {isCurrentUser ? 'you' : 'they'} log entries for {currentBaby?.name || 'the baby'}
                    </Text>
                  </GlassCard>
                ) : (
                  <View style={styles.activitiesList}>
                    {memberActivities.map((activity, index) => {
                      const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
                      return (
                        <Animated.View key={activity.id} entering={FadeInUp.delay(index * 60).springify()}>
                          <GlassCard style={styles.activityCard} delay={index * 60} isDark={isDark}>
                            <View style={styles.activityRow}>
                              <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}>
                                <Text style={styles.activityEmoji}>{config.emoji}</Text>
                              </View>
                              <View style={styles.activityContent}>
                                <Text style={styles.activityTitle}>{activity.title || config.label}</Text>
                                {activity.details && (
                                  <Text style={styles.activityDetails} numberOfLines={2}>{activity.details}</Text>
                                )}
                                <Text style={styles.activityTime}>
                                  {new Date(activity.timestamp).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                              </View>
                              <View style={[styles.activityTypeBadge, { backgroundColor: `${config.color}15` }]}>
                                <Text style={[styles.activityTypeText, { color: config.color }]}>{config.label}</Text>
                              </View>
                            </View>
                          </GlassCard>
                        </Animated.View>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* ── PERMISSIONS ──────────────────────────────────────────── */}
            {activeTab === 'permissions' && (
              <>
                <SectionHeader title="Access Permissions" subtitle={`${roleConfig.permissions.length} permissions`} isDark={isDark} />
                <GlassCard isDark={isDark}>
                  <View style={styles.permissionGrid}>
                    {roleConfig.permissions.map((permission, index) => (
                      <Animated.View
                        key={permission}
                        entering={FadeIn.delay(index * 50)}
                        style={[styles.permissionChip, { backgroundColor: `${roleConfig.color}15`, borderColor: `${roleConfig.color}30` }]}
                      >
                        <Ionicons name="checkmark-circle" size={14} color={roleConfig.color} />
                        <Text style={[styles.permissionChipText, { color: roleConfig.color }]}>{permission}</Text>
                      </Animated.View>
                    ))}
                  </View>
                  <View style={styles.permissionNote}>
                    <Ionicons name="information-circle" size={16} color={roleConfig.color} />
                    <Text style={styles.permissionNoteText}>
                      These permissions are set by the {roleConfig.label} role and cannot be modified individually.
                    </Text>
                  </View>
                </GlassCard>
                <View style={styles.statsGrid}>
                  <LinearGradient colors={roleConfig.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
                    <Text style={styles.statCardValue}>{memberActivities.length}</Text>
                    <Text style={styles.statCardLabel}>Activities</Text>
                  </LinearGradient>
                  <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Text style={[styles.statCardValue, { color: roleConfig.color }]}>{roleConfig.priority}</Text>
                    <Text style={[styles.statCardLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Role Priority</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Text style={[styles.statCardValue, { color: member?.lastActive ? '#10b981' : '#f59e0b' }]}>
                      {member?.lastActive ? 'Active' : 'Pending'}
                    </Text>
                    <Text style={[styles.statCardLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Status</Text>
                  </View>
                </View>
                {memberActivities.length > 0 && (
                  <View style={styles.activityBreakdown}>
                    <Text style={styles.breakdownTitle}>Activity Breakdown</Text>
                    {Object.entries(memberActivities.reduce((acc, act) => { acc[act.type] = (acc[act.type] || 0) + 1; return acc; }, {} as Record<string, number>))
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => {
                        const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.default;
                        const percentage = Math.round((count / memberActivities.length) * 100);
                        return (
                          <View key={type} style={styles.breakdownRow}>
                            <View style={styles.breakdownLeft}>
                              <View style={[styles.breakdownIcon, { backgroundColor: `${config.color}20` }]}>
                                <Ionicons name={config.icon as any} size={14} color={config.color} />
                              </View>
                              <Text style={styles.breakdownLabel}>{config.label}</Text>
                            </View>
                            <View style={styles.breakdownRight}>
                              <View style={[styles.breakdownBar, { backgroundColor: `${config.color}15` }]}>
                                <View style={[styles.breakdownFill, { backgroundColor: config.color, width: `${percentage}%` }]} />
                              </View>
                              <Text style={[styles.breakdownCount, { color: config.color }]}>{count}</Text>
                            </View>
                          </View>
                        );
                      })}
                  </View>
                )}
                {canManagePermissions && (
                  <TouchableOpacity
                    style={[styles.managePermissionsBtn, { backgroundColor: `${roleConfig.color}15` }]}
                    onPress={() => {
                      triggerHaptic('light');
                      setShowRoleModal(true);
                    }}
                  >
                    <Ionicons name="shield-outline" size={20} color={roleConfig.color} />
                    <Text style={[styles.managePermissionsText, { color: roleConfig.color }]}>Manage Role & Permissions</Text>
                    <Ionicons name="chevron-forward" size={20} color={roleConfig.color} />
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ── SETTINGS ─────────────────────────────────────────────── */}
            {activeTab === 'settings' && (
              <>
                <SectionHeader title="Edit Profile" isDark={isDark} />
                <GlassCard isDark={isDark}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    {isCurrentUser ? (
                      <View style={[styles.inputContainer, styles.inputDisabled]}>
                        <Ionicons name="lock-closed" size={20} color="#6366f1" style={styles.inputIcon} />
                        <Text style={styles.inputText}>{formData.fullName}</Text>
                        <View style={[styles.ownedBadge, { backgroundColor: '#6366f1' }]}>
                          <Text style={styles.ownedBadgeText}>You</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                        <Ionicons name="person-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.inputField, styles.flexInput]}
                          value={formData.fullName}
                          onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                          placeholder="Enter full name"
                          placeholderTextColor="#666"
                          editable={isEditing}
                          selectionColor="#6366f1"
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Username</Text>
                    <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#6366f1', marginRight: 6 }}>@</Text>
                      <TextInput
                        style={[styles.inputField, styles.flexInput]}
                        value={formData.username}
                        onChangeText={(text) => {
                          const cleaned = text
                            .toLowerCase()
                            .replace(/\s+/g, '_')
                            .replace(/[^a-z0-9_.]/g, '')
                            .replace(/^@+/, '');
                          setFormData(prev => ({ ...prev, username: cleaned }));
                        }}
                        placeholder="username"
                        placeholderTextColor="#666"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={isEditing}
                        selectionColor="#6366f1"
                        maxLength={30}
                      />
                      {isCheckingUsername && (
                        <ActivityIndicator size="small" color="#6366f1" style={{ marginLeft: 8 }} />
                      )}
                      {!isCheckingUsername && usernameCheck && formData.username !== originalData.username && (
                        <Ionicons
                          name={usernameCheck.available ? 'checkmark-circle' : 'alert-circle'}
                          size={20}
                          color={usernameCheck.available ? '#10b981' : '#ef4444'}
                        />
                      )}
                    </View>
                    {usernameCheck && formData.username !== originalData.username && !isCheckingUsername && (
                      <Text style={{
                        fontSize: 11,
                        marginTop: 4,
                        marginLeft: 4,
                        color: usernameCheck.available ? '#10b981' : '#ef4444',
                        fontWeight: '600',
                      }}>
                        {usernameCheck.message}
                      </Text>
                    )}
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, marginLeft: 4 }}>
                      This is the username you use to sign in. Also shown on your community profile.
                    </Text>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <View style={[styles.inputContainer, (!isEditing || (!isCurrentUser && member.role !== UserRole.PARENT_2)) && styles.inputDisabled]}>
                      <Ionicons name="mail-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.inputField, styles.flexInput]}
                        value={formData.email}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                        placeholder="Enter email address"
                        placeholderTextColor="#666"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={isEditing && (isCurrentUser || member.role === UserRole.PARENT_2)}
                        selectionColor="#6366f1"
                      />
                    </View>
                    {!isCurrentUser && member.role !== UserRole.PARENT_2 && (
                      <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, marginLeft: 4 }}>
                        Only the account owner can change their login email.
                      </Text>
                    )}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                      <Ionicons name="call-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.inputField, styles.flexInput]}
                        value={formData.phoneNumber}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
                        placeholder="Enter phone number"
                        placeholderTextColor="#666"
                        keyboardType="phone-pad"
                        editable={isEditing}
                        selectionColor="#6366f1"
                      />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Relationship</Text>
                    <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                      <Ionicons name="people-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.inputField, styles.flexInput]}
                        value={formData.relationship}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, relationship: text }))}
                        placeholder="e.g., Grandma, Uncle, Nanny"
                        placeholderTextColor="#666"
                        editable={isEditing}
                        selectionColor="#6366f1"
                      />
                    </View>
                  </View>
                  {isEditing && (
                    <View style={styles.preferenceRow}>
                      <View style={styles.preferenceInfo}>
                        <Ionicons name={formData.notificationsEnabled ? 'notifications' : 'notifications-off'} size={22} color={formData.notificationsEnabled ? '#6366f1' : '#94a3b8'} />
                        <View style={styles.preferenceText}>
                          <Text style={styles.preferenceTitle}>Notifications</Text>
                          <Text style={styles.preferenceDesc}>Receive alerts about family activities</Text>
                        </View>
                      </View>
                      <Switch
                        value={formData.notificationsEnabled}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, notificationsEnabled: val }))}
                        trackColor={{ false: '#334155', true: '#6366f1' }}
                        thumbColor="#fff"
                      />
                    </View>
                  )}
                  {isEditing && (
                    <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={isSaving}>
                      <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.saveButtonGradient}>
                        {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </GlassCard>

                {canRemove && (
                  <Animated.View entering={FadeInUp.delay(300).springify()}>
                    <SectionHeader title="Danger Zone" subtitle="Irreversible actions" isDark={isDark} />
                    <GlassCard isDark={isDark}>
                      <View style={styles.dangerContent}>
                        <View style={styles.dangerIconWrap}>
                          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
                            <Ionicons name="warning" size={24} color="#fff" />
                          </LinearGradient>
                        </View>
                        <View style={styles.dangerText}>
                          <Text style={styles.dangerTitle}>Remove from Family</Text>
                          <Text style={styles.dangerDesc}>
                            Their activity history will be preserved, but they will lose access to all family data. This cannot be undone.
                          </Text>
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
          </>
        ) : null}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      <UniversalSpinner visible={isSaving} text="Saving changes..." size="medium" overlay={true} blur={true} section="main" />

      <ActionModal visible={showImagePicker} onClose={() => setShowImagePicker(false)} title="Change Profile Photo" isDark={isDark}>
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleImagePick}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#6366f120' }]}>
              <Ionicons name="images-outline" size={28} color="#6366f1" />
            </View>
            <Text style={styles.imagePickerLabel}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={handleCameraCapture}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#10b98120' }]}>
              <Ionicons name="camera-outline" size={28} color="#10b981" />
            </View>
            <Text style={styles.imagePickerLabel}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}>
            <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="happy-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={styles.imagePickerLabel}>Pick Emoji</Text>
          </TouchableOpacity>
        </View>
      </ActionModal>

      <ActionModal visible={showRoleModal} onClose={() => setShowRoleModal(false)} title="Manage Role" isDark={isDark}>
        <View style={styles.roleOptions}>
          {Object.entries(ROLE_CONFIG).map(([role, config]) => (
            <TouchableOpacity
              key={role}
              style={[styles.roleOption, member?.role === role && { backgroundColor: `${config.color}15`, borderColor: config.color }]}
              onPress={() => handleRoleChange(role as UserRole)}
            >
              <LinearGradient colors={config.gradient} style={styles.roleOptionIcon}>
                <Ionicons name={config.icon as any} size={20} color="#fff" />
              </LinearGradient>
              <View style={styles.roleOptionInfo}>
                <Text style={styles.roleOptionTitle}>{config.label}</Text>
                <Text style={styles.roleOptionDesc}>{config.description}</Text>
              </View>
              {member?.role === role && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
            </TouchableOpacity>
          ))}
        </View>
      </ActionModal>

      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmojiPicker(false)}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={styles.emojiPickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} activeOpacity={1} />
          <Animated.View entering={FadeInUp.springify()} style={[styles.emojiPickerSheet]}>
            <View style={styles.modalDragHandle}>
              <View style={styles.dragIndicator} />
            </View>
            <View style={styles.emojiPickerHeader}>
              <Text style={styles.emojiPickerTitle}>Pick an Emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a2e'} />
              </TouchableOpacity>
            </View>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, avatar: emoji }));
                    setShowEmojiPicker(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                >
                  <Text style={styles.emojiButtonText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}