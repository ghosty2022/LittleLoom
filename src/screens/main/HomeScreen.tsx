import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCustomization } from '../../hooks/useCustomization';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {  ActivityIndicator, AlertAnimated, Button, Dimensions, FlatList, Image, ImageBackground, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Polyline } from 'react-native-svg';

import { useBaby } from '../../context/BabyContext';
import { useActivity } from '../../context/ActivityContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCommunity } from '../../context/CommunityContext';
import { useAudio, SOUND_TRACKS } from '../../context/AudioContext';
import { useMedia } from '../../context/MediaContext';

import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';;
import { useSweetAlert } from '../../components/SweetAlert';
// REMOVED: useTrackedScroll — causes conflicts with useAnimatedScrollHandler
// Animated scroll handler returns an object, not a function

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

const { width, height } = Dimensions.get('window');

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  gradient: [string, string];
  screen: keyof RootStackParamList;
  params?: Record<string, any>;
}

interface FeatureCard {
  id: string;
  label: string;
  icon: string;
  color: string;
  screen: keyof RootStackParamList;
  params?: Record<string, any>;
  badge?: string;
  usageCount: number;
}

interface SmartNotification {
  id: string;
  type: 'vaccine' | 'milestone' | 'reminder' | 'growth' | 'streak' | 'tip';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;
  message: string;
  actionScreen?: keyof RootStackParamList;
  actionParams?: Record<string, any>;
  actionLabel?: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  timestamp: number;
  dismissed?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

// Helper: generate full theme colors from theme settings
const getFullThemeColors = (theme: string, appearance: string, isDarkMode: boolean) => {
  // Default fallback colors - customize as needed
  return {
    background: isDarkMode ? '#0a0a0a' : '#f8fafc',
    surface: isDarkMode ? '#1a1a2e' : '#ffffff',
    text: isDarkMode ? '#ffffff' : '#1e293b',
    border: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    glassBg: isDarkMode ? 'rgba(26,26,46,0.95)' : 'rgba(255,255,255,0.95)',
    shadow: '#000',
    error: '#ef4444',
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION MAP — FIXED: All routes point to correct screens
   ═══════════════════════════════════════════════════════════════════════════ */
const NAVIGATION_MAP: Record<string, { screen: keyof RootStackParamList; params?: Record<string, any> }> = {
  'Main': { screen: 'Main', params: {} },
  'Connect': { screen: 'Main', params: { screen: 'Connect' } },
  'Settings': { screen: 'Customize', params: {} },
  'More': { screen: 'Main', params: { screen: 'More' } },
  'UniversalTracker': { screen: 'UniversalTrackerHub', params: {} },
  'Grow': { screen: 'GrowthDashboard', params: {} },
  'Achievements': { screen: 'Achievements', params: {} },
  'Reminders': { screen: 'TrackerReminders', params: {} },
  'SafetyCorner': { screen: 'SafetyCorner', params: {} },
  'Gallery': { screen: 'Gallery', params: {} },
  'SoundMixer': { screen: 'SoundMixer', params: {} },
  'FamilySharing': { screen: 'FamilySharing', params: {} },
  'FamilyChatList': { screen: 'FamilyChatList', params: {} },
  'HelpCenter': { screen: 'HelpCenter', params: {} },
  'ContactSupport': { screen: 'ContactSupport', params: {} },
  'Profile': { screen: 'Profile', params: {} },
  'SwitchBaby': { screen: 'SwitchBaby', params: {} },
  'CreateBabyProfile': { screen: 'CreateBabyProfile', params: {} },
  'EditProfile': { screen: 'EditProfile', params: {} },
  'VaccinationSchedule': { screen: 'VaccinationSchedule', params: {} },
  'Timeline': { screen: 'Timeline', params: {} },
};

const getGridColumns = () => {
  if (width >= 768) return 6;
  if (width >= 414) return 5;
  return 4;
};

const GRID_COLUMNS = getGridColumns();

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { id: 'potty', label: 'Potty', icon: '🚽', color: '#667eea', gradient: ['#667eea', '#764ba2'], screen: 'UniversalTrackerHub', params: { type: 'potty' } },
  { id: 'feed', label: 'Feed', icon: '🍼', color: '#fa709a', gradient: ['#fa709a', '#fee140'], screen: 'UniversalTrackerHub', params: { type: 'feed' } },
  { id: 'sleep', label: 'Sleep', icon: '😴', color: '#11998e', gradient: ['#11998e', '#38ef7d'], screen: 'UniversalTrackerHub', params: { type: 'sleep' } },
  { id: 'diaper', label: 'Diaper', icon: '🧷', color: '#fc5c7d', gradient: ['#fc5c7d', '#6a82fb'], screen: 'UniversalTrackerHub', params: { type: 'diaper' } },
  { id: 'growth', label: 'Growth', icon: '📏', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'], screen: 'GrowthDashboard', params: {} },
  { id: 'milestone', label: 'Milestone', icon: '🌟', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], screen: 'Achievements', params: {} },
  { id: 'medication', label: 'Meds', icon: '💊', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'UniversalTrackerHub', params: { type: 'medication' } },
  { id: 'note', label: 'Note', icon: '📝', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'UniversalTrackerHub', params: { type: 'note' } },
];

const AVAILABLE_ACTIONS: QuickAction[] = [
  { id: 'pump', label: 'Pump', icon: '🤱', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], screen: 'UniversalTrackerHub', params: { type: 'pump' } },
  { id: 'bath', label: 'Bath', icon: '🛁', color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'], screen: 'UniversalTrackerHub', params: { type: 'bath' } },
  { id: 'sun', label: 'Sun', icon: '☀️', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], screen: 'UniversalTrackerHub', params: { type: 'sun' } },
  { id: 'play', label: 'Play', icon: '🎮', color: '#ec4899', gradient: ['#ec4899', '#f472b6'], screen: 'UniversalTrackerHub', params: { type: 'play' } },
  { id: 'walk', label: 'Walk', icon: '🚶', color: '#10b981', gradient: ['#10b981', '#34d399'], screen: 'UniversalTrackerHub', params: { type: 'walk' } },
  { id: 'family_chat', label: 'Family Chat', icon: '💬', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'], screen: 'FamilyChatList', params: {} },
  { id: 'family_center', label: 'Family', icon: '👨‍👩‍👧', color: '#f97316', gradient: ['#f97316', '#fb923c'], screen: 'FamilySharing', params: {} },
  { id: 'reminders', label: 'Reminders', icon: '⏰', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'TrackerReminders', params: {} },
  { id: 'safety', label: 'Safety', icon: '🛡️', color: '#dc2626', gradient: ['#dc2626', '#ef4444'], screen: 'SafetyCorner', params: {} },
  { id: 'gallery', label: 'Gallery', icon: '🖼️', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], screen: 'Gallery', params: {} },
  { id: 'sound', label: 'Sounds', icon: '🎵', color: '#1DB954', gradient: ['#1DB954', '#1ed760'], screen: 'SoundMixer', params: {} },
  { id: 'settings', label: 'Settings', icon: '⚙️', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'Customize', params: {} },
  { id: 'vaccine', label: 'Vaccines', icon: '💉', color: '#e11d48', gradient: ['#e11d48', '#fb7185'], screen: 'VaccinationSchedule', params: {} },
];

const DEFAULT_FEATURE_CARDS: FeatureCard[] = [
  { id: 'reminders', label: 'Reminders', icon: 'alarm-outline', color: '#f59e0b', screen: 'TrackerReminders', badge: '3', usageCount: 0 },
  { id: 'achievements', label: 'Milestones', icon: 'trophy-outline', color: '#ec4899', screen: 'Achievements', usageCount: 0 },
  { id: 'growth', label: 'Growth', icon: 'trending-up-outline', color: '#10b981', screen: 'GrowthDashboard', usageCount: 0 },
  { id: 'family', label: 'Family', icon: 'people-outline', color: '#3b82f6', screen: 'FamilySharing', usageCount: 0 },
  { id: 'safety', label: 'Safety', icon: 'shield-checkmark-outline', color: '#ef4444', screen: 'SafetyCorner', usageCount: 0 },
  { id: 'gallery', label: 'Gallery', icon: 'images-outline', color: '#8b5cf6', screen: 'Gallery', badge: 'New', usageCount: 0 },
  { id: 'chat', label: 'Family Chat', icon: 'chatbubbles-outline', color: '#06b6d4', screen: 'FamilyChatList', badge: 'Live', usageCount: 0 },
  { id: 'sound', label: 'Sound Mixer', icon: 'musical-notes-outline', color: '#1DB954', screen: 'SoundMixer', usageCount: 0 },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', color: '#64748b', screen: 'Customize', usageCount: 0 },
  { id: 'community', label: 'Community', icon: 'globe-outline', color: '#667eea', screen: 'Main', params: { screen: 'Connect' }, badge: 'Hot', usageCount: 0 },
  { id: 'vaccine', label: 'Vaccines', icon: 'medical-outline', color: '#e11d48', screen: 'VaccinationSchedule', usageCount: 0 },
  { id: 'help', label: 'Help Center', icon: 'help-buoy-outline', color: '#4facfe', screen: 'HelpCenter', usageCount: 0 },
];

/* ═══════════════════════════════════════════════════════════════════════════
   MINI SPARKLINE COMPONENT — SVG-based trend line for cards
   ═══════════════════════════════════════════════════════════════════════════ */
const MiniSparkline: React.FC<{
  data: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fillOpacity?: number;
}> = ({ data, color, width: w = 80, height: h = 32, strokeWidth = 2, fillOpacity = 0.15 }) => {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((val - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <SvgLinearGradient id={`sparkline-fill-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Polyline
        points={areaPoints}
        fill={`url(#sparkline-fill-${color.replace('#', '')})`}
        stroke="none"
      />
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r={3}
        fill={color}
      />
    </Svg>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   GLASSMORPHISM CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const GlassmorphismCard: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void; intensity?: number }> = ({ children, style, onPress, intensity = 80 }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient colors={isDark ? ['rgba(40,40,40,0.8)', 'rgba(20,20,20,0.6)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CIRCULAR PROGRESS
   ═══════════════════════════════════════════════════════════════════════════ */
const CircularProgress: React.FC<{ progress: number; value: string; label: string; color: string; onPress?: () => void; size?: number }> = ({ progress, value, label, color, onPress, size = 60 }) => {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <TouchableOpacity style={[styles.progressItem, { width: size + 20 }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.progressSvgContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} />
              <Stop offset="100%" stopColor={color + '80'} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={`url(#grad-${label})`} strokeWidth="6" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        <Text style={[styles.progressValue, { color, fontSize: size * 0.25 }]}>{value}</Text>
      </View>
      <Text style={[styles.progressLabel, { fontSize: size * 0.18 }]}>{label}</Text>
    </TouchableOpacity>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SMART NOTIFICATION PANEL — Urgent pushes, vaccines, reminders
   ═══════════════════════════════════════════════════════════════════════════ */
const SmartNotificationPanel: React.FC<{
  notifications: SmartNotification[];
  onDismiss: (id: string) => void;
  onAction: (notif: SmartNotification) => void;
  isDark: boolean;
}> = ({ notifications, onDismiss, onAction, isDark }) => {
  const [expanded, setExpanded] = useState(false);
  const urgentCount = notifications.filter(n => n.priority === 'urgent' && !n.dismissed).length;

  if (notifications.length === 0) return null;

  const visibleNotifs = expanded
    ? notifications.filter(n => !n.dismissed)
    : notifications.filter(n => !n.dismissed).slice(0, 2);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'alert-circle';
      case 'high': return 'warning';
      case 'normal': return 'information-circle';
      default: return 'time';
    }
  };

  return (
    <View style={styles.notificationPanel}>
      <View style={styles.notificationPanelHeader}>
        <View style={styles.notificationPanelTitleRow}>
          <Ionicons name="notifications-outline" size={18} color={isDark ? '#fff' : '#1e293b'} />
          <Text style={[styles.notificationPanelTitle, isDark && styles.textDark]}>Smart Alerts</Text>
          {urgentCount > 0 && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentBadgeText}>{urgentCount}</Text>
            </View>
          )}
        </View>
        {notifications.filter(n => !n.dismissed).length > 2 && (
          <TouchableOpacity onPress={() => setExpanded(!expanded)}>
            <Text style={[styles.expandText, { color: '#667eea' }]}>
              {expanded ? 'Show Less' : `+${notifications.filter(n => !n.dismissed).length - 2} more`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {visibleNotifs.map((notif, index) => (
        <Animated.View key={notif.id} entering={FadeInUp.delay(index * 60)}>
          <TouchableOpacity
            style={[
              styles.smartNotificationCard,
              {
                backgroundColor: notif.bgColor + (isDark ? '25' : '15'),
                borderLeftColor: notif.iconColor,
                borderLeftWidth: 3,
              },
            ]}
            onPress={() => onAction(notif)}
            activeOpacity={0.8}
          >
            <View style={[styles.smartNotifIcon, { backgroundColor: notif.iconColor + '20' }]}>
              <Ionicons name={getPriorityIcon(notif.priority) as any} size={18} color={notif.iconColor} />
            </View>
            <View style={styles.smartNotifContent}>
              <Text style={[styles.smartNotifTitle, isDark && styles.textDark]}>{notif.title}</Text>
              <Text style={styles.smartNotifMessage} numberOfLines={2}>{notif.message}</Text>
              <View style={styles.smartNotifMeta}>
                <Text style={styles.smartNotifTime}>{formatDistanceToNow(notif.timestamp, { addSuffix: true })}</Text>
                {notif.actionLabel && (
                  <View style={[styles.smartNotifActionBadge, { backgroundColor: notif.iconColor + '20' }]}>
                    <Text style={[styles.smartNotifActionText, { color: notif.iconColor }]}>{notif.actionLabel}</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => onDismiss(notif.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-outline" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TREND CARD — Mini sparkline with stat for dashboard sections
   ═══════════════════════════════════════════════════════════════════════════ */
const TrendCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  trendData: number[];
  color: string;
  icon: string;
  onPress: () => void;
  isDark: boolean;
  trendLabel?: string;
  trendUp?: boolean;
}> = ({ title, value, subtitle, trendData, color, icon, onPress, isDark, trendLabel, trendUp }) => {
  const trendColor = trendUp !== undefined ? (trendUp ? '#10b981' : '#ef4444') : color;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.trendCard, { backgroundColor: isDark ? 'rgba(40,40,40,0.6)' : 'rgba(255,255,255,0.85)' }]}>
      <View style={styles.trendCardHeader}>
        <View style={[styles.trendIconWrap, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        {trendLabel && (
          <View style={[styles.trendBadge, { backgroundColor: trendColor + '15' }]}>
            <Ionicons name={trendUp ? 'trending-up-outline' : 'trending-down-outline'} size={12} color={trendColor} />
            <Text style={[styles.trendBadgeText, { color: trendColor }]}>{trendLabel}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.trendValue, isDark && styles.textDark]}>{value}</Text>
      <Text style={styles.trendSubtitle}>{subtitle}</Text>
      <View style={styles.trendChartWrap}>
        <MiniSparkline data={trendData} color={color} width={120} height={36} />
      </View>
    </TouchableOpacity>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFICATION CHOOSER MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const NotificationChooserModal = ({ visible, onClose, onSelect, isDark }: { visible: boolean; onClose: () => void; onSelect: (type: 'app' | 'community') => void; isDark: boolean }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(-20);
  useEffect(() => {
    if (visible) { opacity.value = withTiming(1, { duration: 200 }); scale.value = withSpring(1, { damping: 20 }); translateY.value = withSpring(0, { damping: 20 }); }
    else { opacity.value = withTiming(0, { duration: 150 }); scale.value = withTiming(0.9, { duration: 150 }); translateY.value = withTiming(-20, { duration: 150 }); }
  }, [visible]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { translateY: translateY.value }] }));
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10001 }]} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }, backdropStyle]}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={[styles.notificationModal, modalStyle, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <View style={styles.notificationHandle} />
        <Text style={[styles.notificationTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Notifications</Text>
        <TouchableOpacity style={styles.notificationOption} onPress={() => { onSelect('app'); onClose(); }}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.notificationIcon}><Ionicons name="notifications-outline" size={18} color="#fff" /></LinearGradient>
          <View style={styles.notificationTextContainer}>
            <Text style={[styles.notificationOptionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>App</Text>
            <Text style={styles.notificationOptionSubtitle}>Reminders & alerts</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={16} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.notificationOption} onPress={() => { onSelect('community'); onClose(); }}>
          <LinearGradient colors={['#ec4899', '#f472b6']} style={styles.notificationIcon}><Ionicons name="people-outline" size={18} color="#fff" /></LinearGradient>
          <View style={styles.notificationTextContainer}>
            <Text style={[styles.notificationOptionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Community</Text>
            <Text style={styles.notificationOptionSubtitle}>Likes & mentions</Text>
          </View>
          <View style={styles.badgeContainer}><View style={styles.badge}><Text style={styles.badgeText}>5</Text></View><Ionicons name="chevron-forward-outline" size={16} color="#64748b" /></View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ADD ACTION MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const AddActionModal = ({ visible, onClose, onAdd, isDark, existingActions }: { visible: boolean; onClose: () => void; onAdd: (action: QuickAction) => void; isDark: boolean; existingActions: QuickAction[] }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  useEffect(() => {
    if (visible) { opacity.value = withTiming(1, { duration: 200 }); scale.value = withSpring(1, { damping: 20 }); }
    else { opacity.value = withTiming(0, { duration: 200 }); scale.value = withTiming(0.9, { duration: 200 }); }
  }, [visible]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handleAdd = (action: QuickAction) => { if (existingActions.find(a => a.id === action.id)) return; onAdd(action); };
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10002 }]} pointerEvents="auto">
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }, backdropStyle]}>
          <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={[styles.centeredModal, modalStyle, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <View style={styles.centeredModalHeader}>
          <View>
            <Text style={[styles.centeredModalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Add Quick Action</Text>
            <Text style={styles.centeredModalSubtitle}>Choose an action to add to your grid</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.centeredModalClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-outline" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.centeredModalGrid}>
          {AVAILABLE_ACTIONS.map((action, index) => {
            const isExisting = !!existingActions.find(a => a.id === action.id);
            return (
              <Animated.View key={action.id} entering={FadeInUp.delay(index * 50)} style={styles.centeredModalItem}>
                <TouchableOpacity style={[styles.centeredModalItemButton, isExisting && styles.centeredModalItemDisabled]} onPress={() => handleAdd(action)} disabled={isExisting} activeOpacity={isExisting ? 1 : 0.7}>
                  <LinearGradient colors={action.gradient} style={[styles.centeredModalItemGradient, isExisting && { opacity: 0.4 }]}>
                    <Text style={styles.centeredModalItemIcon}>{action.icon}</Text>
                    {isExisting && <View style={styles.centeredModalItemCheck}><Ionicons name="checkmark" size={16} color="#fff" /></View>}
                  </LinearGradient>
                  <Text style={[styles.centeredModalItemLabel, isDark && { color: '#fff' }, isExisting && { color: '#94a3b8' }]}>{action.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DRAGGABLE GRID — Improved with actual drag-and-drop via long press
   ═══════════════════════════════════════════════════════════════════════════ */
const DraggableGrid: React.FC<{
  items: QuickAction[];
  onPress: (item: QuickAction) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onReorder: (newItems: QuickAction[]) => void;
  columns: number;
  isDark: boolean;
}> = ({ items, onPress, onRemove, onAdd, onReorder, columns, isDark }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<QuickAction[]>(items);
  const dragStartIndex = useRef<number>(-1);

  useEffect(() => { setLocalItems(items); }, [items]);

  const totalMargin = 20; const gap = 10;
  const availableWidth = width - totalMargin;
  const itemWidth = (availableWidth - (columns - 1) * gap) / columns;

  const toggleEditMode = () => { setIsEditMode(!isEditMode); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };

  const handleDragStart = (index: number) => {
    if (!isEditMode) return;
    dragStartIndex.current = index;
    setDraggingId(localItems[index].id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleDragEnd = (index: number) => {
    if (!isEditMode || draggingId === null) return;
    const fromIndex = dragStartIndex.current;
    if (fromIndex === -1 || fromIndex === index) { setDraggingId(null); return; }
    const newItems = [...localItems];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(index, 0, removed);
    setLocalItems(newItems); onReorder(newItems); setDraggingId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View>
      <View style={styles.gridHeader}>
        <Text style={[styles.gridHint, isDark && { color: '#94a3b8' }]}>
          {isEditMode ? 'Drag to reorder • Tap X to remove' : `Hold to customize (${columns} cols)`}
        </Text>
        {isEditMode && (
          <TouchableOpacity onPress={toggleEditMode} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.gridContainer, { gap }]}>
        {localItems.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeInUp.delay(index * 50)}
            layout={Layout.springify()}
            style={[
              styles.gridItem,
              { width: itemWidth },
              draggingId === item.id && { zIndex: 1000, transform: [{ scale: 1.05 }] },
            ]}
          >
            <TouchableOpacity
              onPress={() => isEditMode ? undefined : onPress(item)}
              onLongPress={toggleEditMode}
              delayLongPress={400}
              onPressIn={() => handleDragStart(index)}
              onPressOut={() => handleDragEnd(index)}
              style={styles.gridItemTouchable}
              activeOpacity={isEditMode ? 1 : 0.8}
            >
              <LinearGradient colors={item.gradient} style={[styles.gridItemGradient, isEditMode && styles.gridItemGradientEdit]}>
                <Text style={styles.gridItemIcon}>{item.icon}</Text>
                {isEditMode && (
                  <TouchableOpacity
                    style={styles.removeBadge}
                    onPress={(e) => { e.stopPropagation(); onRemove(item.id); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                )}
              </LinearGradient>
              <Text style={[styles.gridItemLabel, isDark && { color: '#fff' }]}>{item.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
        <TouchableOpacity style={[styles.gridItem, { width: itemWidth }]} onPress={onAdd}>
          <View style={[styles.addItemGradient, isDark && { borderColor: '#475569', backgroundColor: 'rgba(71,85,105,0.2)' }]}>
            <Ionicons name="add-outline" size={28} color="#667eea" />
          </View>
          <Text style={[styles.gridItemLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SORTABLE FEATURE GRID — Improved drag-and-drop
   ═══════════════════════════════════════════════════════════════════════════ */
const SortableFeatureGrid: React.FC<{
  items: FeatureCard[];
  onPress: (item: FeatureCard) => void;
  onReorder: (newItems: FeatureCard[]) => void;
  isDark: boolean;
  onUsageIncrement: (id: string) => void;
}> = ({ items, onPress, onReorder, isDark, onUsageIncrement }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [localItems, setLocalItems] = useState<FeatureCard[]>(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartIndex = useRef<number>(-1);

  useEffect(() => { setLocalItems(items); }, [items]);

  const gap = 12; const margin = 20;
  const availableWidth = width - (margin * 2);
  const itemWidth = (availableWidth - gap) / 2;

  const toggleEditMode = () => { setIsEditMode(!isEditMode); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };

  const handlePress = (item: FeatureCard) => { if (isEditMode) return; onUsageIncrement(item.id); onPress(item); };

  const handleDragStart = (index: number) => {
    if (!isEditMode) return;
    dragStartIndex.current = index;
    setDraggingId(localItems[index].id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleDragEnd = (index: number) => {
    if (!isEditMode || draggingId === null) return;
    const fromIndex = dragStartIndex.current;
    if (fromIndex === -1 || fromIndex === index) { setDraggingId(null); return; }
    const newItems = [...localItems];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(index, 0, removed);
    setLocalItems(newItems); onReorder(newItems); setDraggingId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderItem = (item: FeatureCard, index: number) => {
    const isDragging = draggingId === item.id;
    return (
      <Animated.View
        key={item.id}
        entering={FadeInUp.delay(index * 60)}
        layout={Layout.springify()}
        style={[
          styles.featureCardWrapper2Col,
          { width: itemWidth },
          isDragging && { zIndex: 1000, transform: [{ scale: 1.05 }] },
        ]}
      >
        <TouchableOpacity
          onPress={() => handlePress(item)}
          onLongPress={toggleEditMode}
          delayLongPress={400}
          activeOpacity={0.8}
          style={styles.featureCard2Col}
          onPressIn={() => handleDragStart(index)}
          onPressOut={() => handleDragEnd(index)}
        >
          <LinearGradient
            colors={[`${item.color}15`, `${item.color}05`]}
            style={[
              styles.featureGradient2Col,
              { borderColor: `${item.color}30` },
              isEditMode && styles.featureGradientEdit,
            ]}
          >
            <View style={[styles.featureIcon2Col, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon as any} size={22} color="#fff" />
            </View>
            <Text style={[styles.featureLabel2Col, isDark && { color: '#fff' }]}>{item.label}</Text>
            {item.badge && (
              <View style={[styles.featureBadge2Col, { backgroundColor: item.color }]}>
                <Text style={styles.featureBadgeText2Col}>{item.badge}</Text>
              </View>
            )}
            {isEditMode && (
              <View style={styles.dragHandle}>
                <Ionicons name="reorder-three-outline" size={20} color="#64748b" />
              </View>
            )}
            <Ionicons name="chevron-forward-outline" size={18} color={item.color} style={styles.featureArrow2Col} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View>
      <View style={styles.gridHeader}>
        <Text style={[styles.gridHint, isDark && { color: '#94a3b8' }]}>
          {isEditMode ? 'Drag to reorder layout' : 'Hold to customize layout'}
        </Text>
        {isEditMode && (
          <TouchableOpacity onPress={toggleEditMode} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.featuresGrid2Col, { gap, paddingHorizontal: margin }]}>
        {localItems.map((item, index) => renderItem(item, index))}
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAGINATED ACTIVITY LIST — FIXED: Proper Ionicons icons instead of emoji
   ═══════════════════════════════════════════════════════════════════════════ */
const PaginatedActivityList: React.FC<{
  activities: any[];
  isDark: boolean;
  navigation: any;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}> = ({ activities, isDark, navigation, onLoadMore, hasMore, isLoading }) => {
  const [displayCount, setDisplayCount] = useState(5);
  const displayedActivities = activities.slice(0, displayCount);
  const canLoadMore = displayCount < activities.length;

  const handleLoadMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplayCount(prev => Math.min(prev + 5, activities.length));
    onLoadMore();
  };

  // FIXED: Activity icon mapping from tracker type to Ionicons icon
  const getActivityIcon = (type?: string): string => {
    const iconMap: Record<string, string> = {
      potty: 'water-outline',
      feed: 'nutrition-outline',
      sleep: 'moon-outline',
      diaper: 'shirt-outline',
      growth: 'trending-up-outline',
      milestone: 'trophy-outline',
      medication: 'medical-outline',
      note: 'document-text-outline',
      pump: 'swap-horizontal-outline',
      bath: 'water-outline',
      play: 'game-controller-outline',
      walk: 'walk-outline',
      temperature: 'thermometer-outline',
      symptom: 'pulse-outline',
      reading: 'book-outline',
      tummy_time: 'fitness-outline',
      mood: 'happy-outline',
    };
    return iconMap[type || ''] || 'ellipse-outline';
  };

  const getActivityColor = (type?: string): string => {
    const colorMap: Record<string, string> = {
      potty: '#667eea',
      feed: '#fa709a',
      sleep: '#11998e',
      diaper: '#fc5c7d',
      growth: '#43e97b',
      milestone: '#f59e0b',
      medication: '#ef4444',
      note: '#64748b',
      pump: '#8b5cf6',
      bath: '#3b82f6',
      play: '#ec4899',
      walk: '#10b981',
    };
    return colorMap[type || ''] || '#667eea';
  };

  if (activities.length === 0) {
    return (
      <GlassmorphismCard style={styles.emptyState} intensity={60}>
        <View style={styles.emptyStateIcon}>
          <Ionicons name="document-text-outline" size={32} color="#667eea" />
        </View>
        <Text style={styles.emptyStateTitle}>No activities yet</Text>
        <Text style={styles.emptyStateText}>Tap a quick action above to log your first activity!</Text>
      </GlassmorphismCard>
    );
  }

  return (
    <View>
      {displayedActivities.map((item, index) => {
        const iconName = getActivityIcon(item?.type);
        const iconColor = getActivityColor(item?.type);
        return (
          <Animated.View key={item.id || `activity-${index}`} entering={FadeInUp.delay(index * 80)} layout={Layout.springify()}>
            <TouchableOpacity onPress={() => navigation.navigate('Timeline', { type: item.type })} activeOpacity={0.8}>
              <GlassmorphismCard style={styles.activityItem} intensity={60}>
                <View style={[styles.activityIcon, { backgroundColor: `${iconColor}20` }]}>
                  <Ionicons name={iconName as any} size={22} color={iconColor} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, isDark && styles.textDark]}>{item.title || 'Activity'}</Text>
                  <Text style={styles.activityTime}>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</Text>
                  {item.details && <Text style={styles.activityDetails} numberOfLines={1}>{item.details}</Text>}
                </View>
                <View style={styles.activityArrow}>
                  <Ionicons name="chevron-forward-outline" size={18} color="#667eea" />
                </View>
              </GlassmorphismCard>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {(canLoadMore || isLoading) && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore} disabled={!!isLoading}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'}>
            <LinearGradient colors={isDark ? ['rgba(40,40,40,0.6)', 'rgba(20,20,20,0.4)'] : ['rgba(255,255,255,0.6)', 'rgba(248,250,252,0.4)']} style={StyleSheet.absoluteFill} />
          </BlurView>
          <View style={styles.loadMoreContent}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#667eea" />
            ) : (
              <>
                <Text style={[styles.loadMoreText, isDark && styles.textDark]}>
                  Load More ({activities.length - displayCount} remaining)
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#667eea" />
              </>
            )}
          </View>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate('Timeline', { type: 'all' })}>
        <Text style={styles.viewAllText}>View All Activity</Text>
        <Ionicons name="arrow-forward-outline" size={16} color="#667eea" />
      </TouchableOpacity>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SOUND MIXER SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
const SoundMixerSection: React.FC<{ onPress: () => void; isDark: boolean }> = ({ onPress, isDark }) => {
  const { playTrack, currentTrack, isPlaying, togglePlayback } = useAudio();
  const handlePlayTrack = (track: typeof SOUND_TRACKS[0]) => {
    if (currentTrack?.id === track.id) togglePlayback();
    else playTrack(track);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.soundMixerContainer}>
        <View style={styles.soundMixerHeader}>
          <View style={styles.soundMixerTitle}>
            <Ionicons name="musical-notes-outline" size={24} color="#1DB954" />
            <Text style={styles.soundMixerTitleText}>Sound Mixer</Text>
          </View>
          <View style={styles.soundMixerControls}>
            <Text style={styles.nowPlaying}>{currentTrack && isPlaying ? currentTrack.title : 'Tap to play'}</Text>
            <TouchableOpacity
              style={[styles.playAllButton, isPlaying && styles.playAllButtonActive]}
              onPress={(e) => { e.stopPropagation(); if (!currentTrack) playTrack(SOUND_TRACKS[0]); else togglePlayback(); }}
            >
              <Ionicons name={isPlaying ? "pause-outline" : "play-outline"} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={SOUND_TRACKS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingRight: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.trackCard} onPress={(e) => { e.stopPropagation(); handlePlayTrack(item); }}>
              <ImageBackground source={{ uri: item.image }} style={styles.trackImage} imageStyle={{ borderRadius: 8 }}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.trackOverlay}>
                  <View style={[styles.trackPlayButton, currentTrack?.id === item.id && isPlaying && styles.trackPlayButtonActive]}>
                    <Ionicons name={currentTrack?.id === item.id && isPlaying ? "pause-outline" : "play-outline"} size={16} color="#fff" />
                  </View>
                </LinearGradient>
                {currentTrack?.id === item.id && isPlaying && (
                  <View style={styles.playingIndicator}>
                    <View style={styles.bar} /><View style={[styles.bar, styles.barMiddle]} /><View style={styles.bar} />
                  </View>
                )}
              </ImageBackground>
              <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.trackArtist}>{item.artist}</Text>
              <Text style={styles.trackDuration}>{item.duration}</Text>
            </TouchableOpacity>
          )}
        />
      </LinearGradient>
    </TouchableOpacity>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   THEME TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface FullThemeColors {
  background?: string;
  surface?: string;
  text?: string;
  border?: string;
  glassBg?: string;
  shadow?: string;
  error?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STICKY APP HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
interface StickyAppHeaderProps {
  isDark: boolean;
  currentBaby: any;
  onNotificationPress: () => void;
  onLockPress: () => void;
  onProfilePress: () => void;
  onBabyPress: () => void;
  onAddBabyPress: () => void;
  unreadCount: number;
  scrollY: Animated.SharedValue<number>;  // <-- CHANGED: scrollY drives header animation
  onSafetyCornerPress: () => void;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderRadius: number;
  fontSizeMultiplier: number;
  useGradients: boolean;
  useBlur: boolean;
  showShadows: boolean;
  compactSpacing: boolean;
  fullTheme: FullThemeColors;
}
// ✅ FIXED — all props properly destructured
const StickyAppHeader: React.FC<StickyAppHeaderProps> = ({
  isDark,
  currentBaby,
  onNotificationPress,
  onLockPress,
  onProfilePress,
  onBabyPress,
  onAddBabyPress,
  unreadCount,
  scrollY,
  onSafetyCornerPress,  // <-- FIXED: now properly destructured
  primaryColor,
  secondaryColor,
  accentColor,
  borderRadius,
  fontSizeMultiplier,
  useGradients,
  useBlur,
  showShadows,
  compactSpacing,
  fullTheme,
}) => {

  // Derive header visibility directly from scrollY using useAnimatedStyle
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const currentY = scrollY.value;
    
    // Simple threshold-based visibility: hide when scrolled past 80px, show when near top
    // Using interpolate for smooth transition
    const translateY = interpolate(
      currentY,
      [0, 80, 140],
      [0, 0, -140],
      Extrapolate.CLAMP
    );
    const opacity = interpolate(
      currentY,
      [0, 80, 140],
      [1, 1, 0],
      Extrapolate.CLAMP
    );
    
    return { transform: [{ translateY }], opacity };
  });

  const headerPaddingTop = Platform.OS === 'ios' ? (compactSpacing ? 44 : 52) : (compactSpacing ? 28 : 36);
  const headerPaddingBottom = compactSpacing ? 8 : 12;
  const iconSize = Math.round(22 * fontSizeMultiplier);
  const titleSize = Math.round(20 * fontSizeMultiplier);
  const badgeSize = Math.round(18 * fontSizeMultiplier);
  const avatarSize = Math.round(40 * fontSizeMultiplier);
  const safetyIconSize = Math.round(16 * fontSizeMultiplier);

  const headerBg = isDark ? (fullTheme?.glassBg || 'rgba(26,26,46,0.95)') : (fullTheme?.glassBg || 'rgba(255,255,255,0.95)');
  const borderColor = isDark ? (fullTheme?.border || 'rgba(255,255,255,0.08)') : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? (fullTheme?.text || '#ffffff') : (fullTheme?.text || '#1e293b');

  return (
    <Animated.View
      style={[
        styles.stickyHeaderContainer,
        headerAnimatedStyle,
        {
          paddingTop: headerPaddingTop,
          paddingBottom: headerPaddingBottom,
          backgroundColor: useBlur ? 'transparent' : headerBg,
          borderBottomColor: borderColor,
          borderBottomWidth: 1,
          ...(showShadows ? {
            shadowColor: fullTheme?.shadow || '#000',
            shadowOffset: { width: 0, height: compactSpacing ? 1 : 2 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: compactSpacing ? 4 : 8,
            elevation: compactSpacing ? 3 : 5,
          } : {}),
        },
      ]}
    >
      {useBlur && <BlurView intensity={isDark ? 90 : 95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />}
      {useGradients && (
        <LinearGradient
          colors={isDark
            ? [fullTheme?.surface || 'rgba(20,20,30,0.7)', fullTheme?.background || 'rgba(10,10,20,0.5)']
            : [fullTheme?.surface || 'rgba(255,255,255,0.7)', fullTheme?.background || 'rgba(248,250,252,0.5)']
          }
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={[styles.stickyHeaderContent, { height: compactSpacing ? 44 : 50 }]}>
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity
            style={[styles.safetyCornerBtn, {
              borderRadius,
              backgroundColor: `${fullTheme?.error || '#dc2626'}12`,
              borderColor: `${fullTheme?.error || '#dc2626'}20`,
              paddingHorizontal: compactSpacing ? 8 : 10,
              paddingVertical: compactSpacing ? 4 : 6,
            }]}
            onPress={onSafetyCornerPress}
          >
            <LinearGradient
              colors={useGradients ? [fullTheme?.error || '#dc2626', fullTheme?.error || '#ef4444'] : [fullTheme?.error || '#dc2626', fullTheme?.error || '#dc2626']}
              style={[styles.safetyCornerGradient, { width: safetyIconSize + 16, height: safetyIconSize + 16, borderRadius: (safetyIconSize + 16) / 2 }]}
            >
              <Ionicons name="shield-half-outline" size={safetyIconSize} color="#fff" />
            </LinearGradient>
            <View style={[styles.safetyCornerBadge, { borderRadius: borderRadius / 2 }]}>
              <Text style={[styles.safetyCornerBadgeText, { fontSize: Math.round(10 * fontSizeMultiplier) }]}>Safe</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.stickyHeaderCenter}>
          <Text style={[styles.stickyHeaderTitle, { color: textColor, fontSize: titleSize, letterSpacing: -0.5 }]}>LittleLoom</Text>
          <View style={[styles.stickyHeaderUnderline, { backgroundColor: primaryColor, width: Math.round(32 * fontSizeMultiplier), height: Math.max(3, Math.round(4 * fontSizeMultiplier)), borderRadius: Math.max(1, Math.round(2 * fontSizeMultiplier)), marginTop: compactSpacing ? 2 : 4 }]} />
        </View>

        <View style={styles.stickyHeaderRight}>
          <TouchableOpacity
            style={[styles.stickyHeaderIconBtn, { width: avatarSize + 2, height: avatarSize + 2, borderRadius: (avatarSize + 2) / 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(100,116,139,0.1)' }]}
            onPress={onNotificationPress}
          >
            <Ionicons name="notifications-outline" size={iconSize} color={isDark ? '#fff' : primaryColor} />
            {unreadCount > 0 && (
              <View style={[styles.stickyHeaderBadge, { minWidth: badgeSize, height: badgeSize, borderRadius: badgeSize / 2, backgroundColor: fullTheme?.error || '#ef4444' }]}>
                <Text style={[styles.stickyHeaderBadgeText, { fontSize: Math.round(10 * fontSizeMultiplier) }]}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {currentBaby ? (
            <TouchableOpacity style={[styles.stickyHeaderBaby, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} onPress={onBabyPress}>
              <SafeBabyAvatar avatar={currentBaby.avatar} gender={currentBaby.gender} size={avatarSize} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.stickyHeaderIconBtn, { width: avatarSize + 2, height: avatarSize + 2, borderRadius: (avatarSize + 2) / 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(100,116,139,0.1)' }]} onPress={onAddBabyPress}>
              <Ionicons name="add-circle-outline" size={iconSize + 2} color={primaryColor} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.stickyHeaderLockBtn} onPress={onLockPress}>
            <LinearGradient
              colors={useGradients ? [fullTheme?.error || '#ff6b6b', '#ee5a5a'] : [fullTheme?.error || '#ff6b6b', fullTheme?.error || '#ff6b6b']}
              style={[styles.stickyHeaderLockGradient, { width: avatarSize - 4, height: avatarSize - 4, borderRadius: (avatarSize - 4) / 2 }]}
            >
              <Ionicons name="lock-closed-outline" size={Math.round(14 * fontSizeMultiplier)} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HOMESCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function HomeScreen({ navigation }: HomeScreenProps) {
  const colorScheme = useColorScheme();

  const {
    settings,
    themeColors,
    darkMode,
    triggerHaptic,
    fontSizeMultiplier,
    borderRadiusValue,
    shouldReduceMotion,
  } = useCustomization();

  const isDark = darkMode ?? (colorScheme === 'dark');
  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const fullThemeColors = useMemo(() =>
    getFullThemeColors(settings.theme, settings.appearance, colorScheme === 'dark'),
    [settings.theme, settings.appearance, colorScheme]
  );

  const scrollY = useSharedValue(0);
  // REMOVED: headerVisible — now derived from scrollY in StickyAppHeader

  const { userProfile, signOut, isLoading: authLoading } = useAuth();
  const { currentBaby, loadBabies, getPottyStreak } = useBaby();
  const { entries: activities, getRecentTimelineEvents, getTodayCount, loadEntries: loadActivities, isLoading: activitiesLoading } = useActivity();
  const { lockApp } = useSecurity();
  const { getUnreadCount } = useCommunity();
  const media = useMedia();

  const { success, error, confirm, toast } = useSweetAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quickActions, setQuickActions] = useState<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
  const [featureCards, setFeatureCards] = useState<FeatureCard[]>(DEFAULT_FEATURE_CARDS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [columns, setColumns] = useState(GRID_COLUMNS);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);

  // Smart notifications state
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);

  /* ── Load saved data ── */
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedQuickActions = await AsyncStorage.getItem('@littleloom_quick_actions');
        if (savedQuickActions) {
          const parsed = JSON.parse(savedQuickActions);
          if (Array.isArray(parsed) && parsed.length > 0) setQuickActions(parsed);
        }
        const savedFeatureCards = await AsyncStorage.getItem('@littleloom_feature_cards');
        if (savedFeatureCards) {
          const parsed = JSON.parse(savedFeatureCards);
          if (Array.isArray(parsed) && parsed.length > 0) setFeatureCards(parsed);
        }
        const savedNotifs = await AsyncStorage.getItem('@littleloom_smart_notifications');
        if (savedNotifs) {
          const parsed = JSON.parse(savedNotifs);
          if (Array.isArray(parsed)) setSmartNotifications(parsed);
        }
      } catch (err) {
        console.warn('Failed to load saved layout:', err);
      }
    };
    loadSavedData();
  }, []);

  useEffect(() => { AsyncStorage.setItem('@littleloom_quick_actions', JSON.stringify(quickActions)).catch(() => {}); }, [quickActions]);
  useEffect(() => { AsyncStorage.setItem('@littleloom_feature_cards', JSON.stringify(featureCards)).catch(() => {}); }, [featureCards]);
  useEffect(() => { AsyncStorage.setItem('@littleloom_smart_notifications', JSON.stringify(smartNotifications)).catch(() => {}); }, [smartNotifications]);

  /* ── Generate smart notifications based on baby data ── */
  useEffect(() => {
    if (!currentBaby) return;
    const now = Date.now();
    const birthDate = currentBaby.birthDate ? new Date(currentBaby.birthDate) : null;
    const ageInDays = birthDate ? Math.floor((now - birthDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const notifications: SmartNotification[] = [];

    if (ageInDays >= 60 && ageInDays <= 75) {
      notifications.push({
        id: 'vaccine-dtap-1',
        type: 'vaccine',
        priority: 'urgent',
        title: 'DTaP Vaccine Due',
        message: `First DTaP dose is due for ${currentBaby.name}. Schedule within the next 2 weeks.`,
        actionScreen: 'VaccinationSchedule',
        actionLabel: 'View Schedule',
        icon: 'medical',
        iconColor: '#e11d48',
        bgColor: '#e11d48',
        timestamp: now,
      });
    }

    if (ageInDays >= 180 && ageInDays <= 190) {
      notifications.push({
        id: 'growth-6mo',
        type: 'growth',
        priority: 'high',
        title: '6-Month Growth Check',
        message: `Time to log ${currentBaby.name}'s 6-month growth measurements.`,
        actionScreen: 'GrowthDashboard',
        actionLabel: 'Log Growth',
        icon: 'trending-up',
        iconColor: '#10b981',
        bgColor: '#10b981',
        timestamp: now,
      });
    }

    const pottyStreak = getPottyStreak();
    if (pottyStreak > 0 && pottyStreak % 7 === 0) {
      notifications.push({
        id: `streak-${pottyStreak}`,
        type: 'streak',
        priority: 'normal',
        title: `${pottyStreak} Day Streak!`,
        message: `Amazing! You've kept a ${pottyStreak}-day tracking streak going.`,
        icon: 'flame',
        iconColor: '#f59e0b',
        bgColor: '#f59e0b',
        timestamp: now,
      });
    }

    const tips = [
      { title: 'Hydration Tip', message: 'Remember to track water intake for better feeding insights.', icon: 'water', color: '#3b82f6' },
      { title: 'Sleep Insight', message: 'Consistent bedtime routines improve sleep quality by 40%.', icon: 'moon', color: '#8b5cf6' },
      { title: 'Tummy Time', message: 'Aim for 30+ minutes of tummy time today for motor development.', icon: 'fitness', color: '#10b981' },
    ];
    const todayTip = tips[Math.floor(now / (1000 * 60 * 60 * 24)) % tips.length];
    notifications.push({
      id: `tip-${Math.floor(now / (1000 * 60 * 60 * 24))}`,
      type: 'tip',
      priority: 'low',
      title: todayTip.title,
      message: todayTip.message,
      icon: todayTip.icon,
      iconColor: todayTip.color,
      bgColor: todayTip.color,
      timestamp: now,
    });

    setSmartNotifications(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newNotifs = notifications.filter(n => !existingIds.has(n.id));
      return [...prev.filter(p => !p.dismissed), ...newNotifs].slice(-10);
    });
  }, [currentBaby?.id, currentBaby?.birthDate, currentBaby?.name, getPottyStreak]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const dimensionListener = Dimensions.addEventListener('change', () => setColumns(getGridColumns()));
    return () => { clearInterval(timer); dimensionListener?.remove(); };
  }, []);

  useEffect(() => {
    loadBabies();
    loadActivities();
  }, [loadBabies, loadActivities]);


  // Scroll handler for header animation only
  // NOTE: useTrackedScroll is NOT used here because useAnimatedScrollHandler
  // returns an animated event object, not a function, causing TypeError
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
     'worklet';
       'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });
  const navigateToScreen = useCallback((screenName: string, params?: Record<string, any>) => {
    const navConfig = NAVIGATION_MAP[screenName];
    if (!navConfig) {
      console.warn(`Navigation target "${screenName}" not found`);
      return;
    }
    if (navConfig.params?.screen) {
      navigation.navigate(navConfig.screen as any, {
        screen: navConfig.params.screen,
        params: { ...navConfig.params.params, ...params },
      });
    } else {
      navigation.navigate(navConfig.screen as any, { ...navConfig.params, ...params });
    }
  }, [navigation]);


  const handleNotificationPress = useCallback(() => {
    triggerHaptic('light');
    setShowNotificationChooser(true);
  }, [triggerHaptic]);

  const handleNotificationSelect = useCallback((type: 'app' | 'community') => {
    if (type === 'app') navigateToScreen('Reminders');
    else navigateToScreen('Connect');
  }, [navigateToScreen]);

  const handleSafetyCornerPress = useCallback(() => {
    triggerHaptic('medium');
    navigateToScreen('SafetyCorner');
  }, [navigateToScreen, triggerHaptic]);

  const handleCommunityPress = useCallback(() => {
    triggerHaptic('light');
    navigateToScreen('Connect');
  }, [navigateToScreen, triggerHaptic]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadBabies(), loadActivities()]);
      success('Refreshed!', 'Your dashboard is up to date.');
    } catch (err) {
      error('Refresh Failed', 'Could not update dashboard data.');
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, loadActivities, success, error]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    triggerHaptic('medium');
    const noBabyRequired = ['note', 'settings', 'family_chat', 'family_center', 'reminders', 'safety', 'gallery', 'sound'];
    if (!currentBaby && !noBabyRequired.includes(action.id)) {
      error('No Baby Profile', 'Please create a baby profile first.');
      return;
    }
    navigateToScreen(action.screen, action.params);
    success(`${action.label} Logged`, 'Activity recorded successfully!');
  }, [currentBaby, navigateToScreen, success, error, triggerHaptic]);

  const handleRemoveAction = useCallback((id: string) => {
    confirm(
      'Remove Action',
      'Are you sure you want to remove this quick action?',
      () => {
        setQuickActions(prev => prev.filter(a => a.id !== id));
        success('Action Removed', 'Quick action removed from grid.');
      },
      undefined,
      'Remove',
      'Keep'
    );
  }, [confirm, success]);

  const handleAddAction = useCallback((action: QuickAction) => {
    if (quickActions.find(a => a.id === action.id)) {
      error('Already Exists', 'This action is already in your quick actions.');
      return;
    }
    const newAction = {
      ...action,
      screen: action.screen || 'UniversalTrackerHub',
      params: action.params || { type: action.id },
    };
    setQuickActions(prev => [...prev, newAction]);
    setShowAddModal(false);
    success('Action Added!', `${action.label} has been added to your quick actions.`);
  }, [quickActions, success, error]);

  const handleQuickActionsReorder = useCallback((newItems: QuickAction[]) => {
    setQuickActions(newItems);
  }, []);

  const handleFeatureUsage = useCallback((id: string) => {
    setFeatureCards(prev => {
      const newItems = prev.map(item =>
        item.id === id ? { ...item, usageCount: item.usageCount + 1 } : item
      );
      return [...newItems].sort((a, b) => b.usageCount - a.usageCount);
    });
  }, []);

  const handleFeatureReorder = useCallback((newItems: FeatureCard[]) => {
    setFeatureCards(newItems);
  }, []);

  const handleFeaturePress = useCallback((item: FeatureCard) => {
    triggerHaptic('light');
    navigateToScreen(item.screen, item.params);
  }, [navigateToScreen, triggerHaptic]);

  const handleLockPress = useCallback(async () => {
    triggerHaptic('heavy');
    await lockApp();
    toast('App Locked', 'LittleLoom has been secured.', 'info');
  }, [lockApp, toast, triggerHaptic]);

  const handleSignOut = useCallback(() => {
    confirm(
      'Sign Out',
      'Are you sure you want to sign out of LittleLoom?',
      () => {
        toast('Goodbye!', 'See you next time!', 'info');
        setTimeout(signOut, 1000);
      },
      undefined,
      'Sign Out',
      'Stay'
    );
  }, [confirm, toast, signOut]);

  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => setIsLoadingMore(false), 500);
  }, []);

  const handleSmartNotifDismiss = useCallback((id: string) => {
    setSmartNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  }, []);

  const handleSmartNotifAction = useCallback((notif: SmartNotification) => {
    triggerHaptic('light');
    if (notif.actionScreen) {
      navigateToScreen(notif.actionScreen as string, notif.actionParams);
    }
  }, [navigateToScreen, triggerHaptic]);

  const generateTrendData = useCallback((base: number, variance: number = 0.3): number[] => {
    return Array.from({ length: 7 }, (_, i) => {
      const dayOffset = 6 - i;
      return Math.max(0, Math.round(base * (1 + (Math.random() - 0.5) * variance)));
    });
  }, []);

  const stats = useMemo(() => {
    if (!currentBaby) return [];
    const todaySleepCount = getTodayCount('sleep', currentBaby.id);
    const todayFeedCount = getTodayCount('feed', currentBaby.id);
    const pottyStreak = getPottyStreak();
    return [
      { label: 'Sleep', value: Math.min(todaySleepCount, 5).toString(), progress: Math.min((todaySleepCount / 3) * 100, 100), color: primary },
      { label: 'Feeds', value: todayFeedCount.toString(), progress: Math.min((todayFeedCount / 6) * 100, 100), color: secondary },
      { label: 'Streak', value: `${pottyStreak}d`, progress: Math.min((pottyStreak / 7) * 100, 100), color: accent },
    ];
  }, [currentBaby, getTodayCount, getPottyStreak, primary, secondary, accent]);

  const sleepTrend = useMemo(() => generateTrendData(currentBaby ? getTodayCount('sleep', currentBaby.id) : 0), [currentBaby, getTodayCount, generateTrendData]);
  const feedTrend = useMemo(() => generateTrendData(currentBaby ? getTodayCount('feed', currentBaby.id) : 0), [currentBaby, getTodayCount, generateTrendData]);
  const growthTrend = useMemo(() => [2.5, 2.8, 3.1, 3.4, 3.6, 3.9, 4.2], []);

  const allTimelineEvents = useMemo(() => {
    if (!currentBaby) return [];
    return getRecentTimelineEvents(50, currentBaby.id);
  }, [currentBaby, getRecentTimelineEvents, activities]);

  const unreadCommunityCount = useMemo(() => getUnreadCount(), [getUnreadCount]);

  const activeSmartNotifications = useMemo(() =>
    smartNotifications.filter(n => !n.dismissed).sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    [smartNotifications]
  );

  const bgColors = isDark
    ? [fullThemeColors?.background || '#0a0a0a', '#1a1a2e', '#16213e']
    : [fullThemeColors?.background || '#f8fafc', '#e2e8f0', '#dbeafe'];

  const scrollTopPadding = Platform.OS === 'ios'
    ? (settings.compactSpacing ? 120 : 140)
    : (settings.compactSpacing ? 110 : 125);

  if (authLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={[primary, '#764ba2', secondary]} style={styles.loadingGradient}>
          <Text style={[styles.loadingText, { fontSize: Math.round(32 * fontSizeMultiplier) }]}>LittleLoom</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (activitiesLoading && activities.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={bgColors} style={styles.backgroundGradient} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <LinearGradient colors={bgColors} style={styles.backgroundGradient} />

      <StickyAppHeader
        isDark={isDark}
        currentBaby={currentBaby}
        onNotificationPress={handleNotificationPress}
        onLockPress={handleLockPress}
        onProfilePress={() => navigateToScreen('Profile')}
        onBabyPress={() => navigateToScreen('SwitchBaby')}
        onAddBabyPress={() => navigateToScreen('CreateBabyProfile')}
        unreadCount={unreadCommunityCount}
        scrollY={scrollY}  // <-- ADDED: pass scrollY for header animation
        onSafetyCornerPress={handleSafetyCornerPress}
        primaryColor={primary}
        secondaryColor={secondary}
        accentColor={accent}
        borderRadius={borderRadiusValue}
        fontSizeMultiplier={fontSizeMultiplier}
        useGradients={settings.useGradients}
        useBlur={settings.useBlur}
        showShadows={settings.showShadows}
        compactSpacing={settings.compactSpacing}
        fullTheme={fullThemeColors}
      />

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: scrollTopPadding }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
            colors={[primary, secondary]}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        // scrollY drives header animation via StickyAppHeader
      >
        {/* Parent Card */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.springify()}>
          <GlassmorphismCard style={[styles.parentCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]} intensity={90}>
            <View style={[styles.parentHeader, { padding: settings.compactSpacing ? 16 : 20 }]}>
              <SafeParentAvatar
                avatar={userProfile?.avatar}
                name={userProfile?.fullName || 'Parent'}
                size={Math.round(70 * fontSizeMultiplier)}
                onPress={() => navigateToScreen('Profile')}
                showEditBadge={true}
              />
              <View style={styles.parentInfo}>
                <Text style={[styles.greetingText, isDark && styles.textDark, { fontSize: Math.round(13 * fontSizeMultiplier) }]}>{greeting}</Text>
                <Text style={[styles.parentName, isDark && styles.textDark, { fontSize: Math.round(22 * fontSizeMultiplier) }]}>{userProfile?.fullName || 'Parent'}</Text>
                <View style={styles.parentMeta}>
                  <View style={[styles.verifiedBadge, { borderRadius: borderRadiusValue / 2 }]}>
                    <Ionicons name="shield-checkmark-outline" size={Math.round(12 * fontSizeMultiplier)} color={accent} />
                    <Text style={[styles.verifiedText, { color: accent, fontSize: Math.round(11 * fontSizeMultiplier) }]}>Verified</Text>
                  </View>
                  <Text style={[styles.timeText, { fontSize: Math.round(11 * fontSizeMultiplier) }]}>{format(currentTime, 'EEEE, MMM d')}</Text>
                </View>
              </View>
              <View style={styles.parentQuickLinks}>
                <TouchableOpacity style={[styles.parentQuickLink, { backgroundColor: `${primary}15`, borderRadius: borderRadiusValue - 10 }]} onPress={() => navigateToScreen('Achievements')}>
                  <Ionicons name="ribbon-outline" size={Math.round(18 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.parentQuickLink, { backgroundColor: `${secondary}15`, borderRadius: borderRadiusValue - 10 }]} onPress={handleCommunityPress}>
                  <Ionicons name="sparkles-outline" size={Math.round(18 * fontSizeMultiplier)} color={secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </GlassmorphismCard>
        </Animated.View>

        {/* Smart Notification Panel */}
        {activeSmartNotifications.length > 0 && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50).springify()}>
            <SmartNotificationPanel
              notifications={activeSmartNotifications}
              onDismiss={handleSmartNotifDismiss}
              onAction={handleSmartNotifAction}
              isDark={isDark}
            />
          </Animated.View>
        )}

        {/* Baby Card */}
        {currentBaby ? (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100).springify()}>
            <GlassmorphismCard style={[styles.babyCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]} intensity={95}>
              <View style={[styles.babyHeader, { paddingHorizontal: settings.compactSpacing ? 16 : 20, paddingTop: settings.compactSpacing ? 12 : 16 }]}>
                <TouchableOpacity style={styles.babySelector} onPress={() => navigateToScreen('SwitchBaby')}>
                  <Text style={[styles.babySelectorLabel, { fontSize: Math.round(12 * fontSizeMultiplier) }]}>Current Baby</Text>
                  <Ionicons name="chevron-down-outline" size={Math.round(14 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editButton, { borderRadius: borderRadiusValue / 2 }]} onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}>
                  <Ionicons name="create-outline" size={Math.round(18 * fontSizeMultiplier)} color={primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.babyMainInfo, { padding: settings.compactSpacing ? 16 : 20 }]}>
                <SafeBabyAvatar
                  avatar={currentBaby.avatar}
                  gender={currentBaby.gender}
                  size={Math.round(80 * fontSizeMultiplier)}
                  onPress={() => navigateToScreen('EditProfile', { mode: 'baby', babyId: currentBaby.id })}
                  showBadge={true}
                />
                <View style={styles.babyDetails}>
                  <Text style={[styles.babyName, isDark && styles.textDark, { fontSize: Math.round(24 * fontSizeMultiplier) }]}>{currentBaby.name}</Text>
                  <Text style={[styles.babyAge, { fontSize: Math.round(14 * fontSizeMultiplier) }]}>{currentBaby.age}</Text>
                  <View style={styles.babyStatus}>
                    <Ionicons name="pulse-outline" size={Math.round(12 * fontSizeMultiplier)} color={accent} />
                    <Text style={[styles.babyStatusText, { color: accent, fontSize: Math.round(13 * fontSizeMultiplier) }]}>Healthy & Active</Text>
                  </View>
                </View>
                <LinearGradient colors={[secondary, '#fee140']} style={[styles.streakBadge, { borderRadius: borderRadiusValue }]}>
                  <Ionicons name="flame-outline" size={Math.round(14 * fontSizeMultiplier)} color="#fff" />
                  <Text style={[styles.streakText, { fontSize: Math.round(12 * fontSizeMultiplier) }]}>{getPottyStreak()}d</Text>
                </LinearGradient>
              </View>
              <View style={[styles.statsRow, { paddingVertical: settings.compactSpacing ? 12 : 16, paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
                {stats.map((stat) => (
                  <CircularProgress key={stat.label} progress={stat.progress} value={stat.value} label={stat.label} color={stat.color} size={Math.round(65 * fontSizeMultiplier)} />
                ))}
              </View>
            </GlassmorphismCard>
          </Animated.View>
        ) : (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100).springify()}>
            <TouchableOpacity onPress={() => navigateToScreen('CreateBabyProfile')}>
              <GlassmorphismCard style={[styles.noBabyCard, { borderRadius: borderRadiusValue, marginHorizontal: settings.compactSpacing ? 16 : 20 }]} intensity={90}>
                <LinearGradient colors={[primary, '#764ba2']} style={[styles.noBabyGradient, { borderRadius: borderRadiusValue }]}>
                  <Text style={[styles.noBabyEmoji, { fontSize: Math.round(56 * fontSizeMultiplier) }]}>👶</Text>
                  <Text style={[styles.noBabyTitle, { fontSize: Math.round(22 * fontSizeMultiplier) }]}>Welcome to LittleLoom!</Text>
                  <Text style={[styles.noBabyText, { fontSize: Math.round(14 * fontSizeMultiplier) }]}>Create your first baby profile to start tracking</Text>
                  <View style={[styles.noBabyButton, { borderRadius: borderRadiusValue - 8 }]}>
                    <Text style={[styles.noBabyButtonText, { fontSize: Math.round(15 * fontSizeMultiplier) }]}>Get Started</Text>
                    <Ionicons name="arrow-forward-outline" size={Math.round(16 * fontSizeMultiplier)} color={primary} />
                  </View>
                </LinearGradient>
              </GlassmorphismCard>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Trend Cards Row */}
        {currentBaby && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(150).springify()}>
            <View style={[styles.trendCardsRow, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
              <TrendCard
                title="Sleep"
                value={stats[0]?.value || '0'}
                subtitle="This week"
                trendData={sleepTrend}
                color={primary}
                icon="moon-outline"
                onPress={() => navigateToScreen('UniversalTrackerHub', { type: 'sleep' })}
                isDark={isDark}
                trendLabel="+12%"
                trendUp={true}
              />
              <TrendCard
                title="Feeds"
                value={stats[1]?.value || '0'}
                subtitle="This week"
                trendData={feedTrend}
                color={secondary}
                icon="nutrition-outline"
                onPress={() => navigateToScreen('UniversalTrackerHub', { type: 'feed' })}
                isDark={isDark}
                trendLabel="+5%"
                trendUp={true}
              />
              <TrendCard
                title="Growth"
                value="4.2kg"
                subtitle="Weight gain"
                trendData={growthTrend}
                color={accent}
                icon="trending-up-outline"
                onPress={() => navigateToScreen('GrowthDashboard')}
                isDark={isDark}
                trendLabel="+8%"
                trendUp={true}
              />
            </View>
          </Animated.View>
        )}

        {/* Sound Mixer */}
        <View style={[styles.section, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="musical-notes-outline" size={Math.round(20 * fontSizeMultiplier)} color="#1DB954" />
              <Text style={[styles.sectionTitle, isDark && styles.textDark, { fontSize: Math.round(18 * fontSizeMultiplier) }]}>Sound Mixer</Text>
            </View>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('SoundMixer')}>
              <Text style={[styles.seeAllText, { color: primary, fontSize: Math.round(14 * fontSizeMultiplier) }]}>Full Mixer</Text>
              <Ionicons name="arrow-forward-outline" size={Math.round(14 * fontSizeMultiplier)} color={primary} />
            </TouchableOpacity>
          </View>
          <SoundMixerSection onPress={() => navigateToScreen('SoundMixer')} isDark={isDark} />
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, styles.sectionHeaderPadded, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid-outline" size={Math.round(20 * fontSizeMultiplier)} color={primary} />
              <Text style={[styles.sectionTitle, isDark && styles.textDark, { fontSize: Math.round(18 * fontSizeMultiplier) }]}>Quick Actions</Text>
            </View>
          </View>
          <View style={styles.gridWrapper}>
            <DraggableGrid
              items={quickActions}
              onPress={handleQuickAction}
              onRemove={handleRemoveAction}
              onAdd={() => setShowAddModal(true)}
              onReorder={handleQuickActionsReorder}
              columns={columns}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Features */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, styles.sectionHeaderPadded, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="apps-outline" size={Math.round(20 * fontSizeMultiplier)} color="#f59e0b" />
              <Text style={[styles.sectionTitle, isDark && styles.textDark, { fontSize: Math.round(18 * fontSizeMultiplier) }]}>Tools & Features</Text>
            </View>
          </View>
          <SortableFeatureGrid
            items={featureCards}
            onPress={handleFeaturePress}
            onReorder={handleFeatureReorder}
            onUsageIncrement={handleFeatureUsage}
            isDark={isDark}
          />
        </View>

        {/* Activity */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, styles.sectionHeaderPadded, { paddingHorizontal: settings.compactSpacing ? 16 : 20 }]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time-outline" size={Math.round(20 * fontSizeMultiplier)} color={secondary} />
              <Text style={[styles.sectionTitle, isDark && styles.textDark, { fontSize: Math.round(18 * fontSizeMultiplier) }]}>Recent Activity</Text>
            </View>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => navigateToScreen('Timeline', { type: 'all' })}>
              <Text style={[styles.seeAllText, { color: primary, fontSize: Math.round(14 * fontSizeMultiplier) }]}>View All</Text>
              <Ionicons name="arrow-forward-outline" size={Math.round(14 * fontSizeMultiplier)} color={primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.activityWrapper}>
            <PaginatedActivityList
              activities={allTimelineEvents}
              isDark={isDark}
              navigation={navigation}
              onLoadMore={handleLoadMore}
              hasMore={allTimelineEvents.length > 5}
              isLoading={isLoadingMore}
            />
          </View>
        </View>

        <View style={{ height: settings.compactSpacing ? 100 : 140 }} />
      </Animated.ScrollView>

      <AddActionModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAction}
        isDark={isDark}
        existingActions={quickActions}
      />
      <NotificationChooserModal
        visible={showNotificationChooser}
        onClose={() => setShowNotificationChooser(false)}
        onSelect={handleNotificationSelect}
        isDark={isDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── Trend Cards ── */
  trendCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
  },
  trendCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  trendCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trendValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  trendSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 8,
  },
  trendChartWrap: {
    alignItems: 'flex-end',
  },

  /* ── Smart Notification Panel ── */
  notificationPanel: {
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 4,
  },
  notificationPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  notificationPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationPanelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  urgentBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  urgentBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  expandText: {
    fontSize: 13,
    fontWeight: '600',
  },
  smartNotificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  smartNotifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  smartNotifContent: {
    flex: 1,
  },
  smartNotifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  smartNotifMessage: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  smartNotifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  smartNotifTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  smartNotifActionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  smartNotifActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 4,
  },

  /* ── Modals ── */
  centeredModal: { position: 'absolute', top: height * 0.15, left: 20, right: 20, maxHeight: height * 0.7, borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  centeredModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  centeredModalTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  centeredModalSubtitle: { fontSize: 14, color: '#64748b' },
  centeredModalClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },
  centeredModalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', paddingBottom: 20 },
  centeredModalItem: { width: (width - 88) / 3 },
  centeredModalItemButton: { alignItems: 'center' },
  centeredModalItemGradient: { width: '100%', aspectRatio: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, position: 'relative' },
  centeredModalItemIcon: { fontSize: 32 },
  centeredModalItemLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
  centeredModalItemDisabled: { opacity: 0.6 },
  centeredModalItemCheck: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#43e97b', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },

  notificationModal: { position: 'absolute', top: Platform.OS === 'ios' ? 110 : 80, right: 16, width: 280, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  notificationHandle: { width: 32, height: 4, backgroundColor: 'rgba(100,116,139,0.3)', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  notificationTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  notificationOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginBottom: 8, backgroundColor: 'rgba(100,116,139,0.05)' },
  notificationIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notificationTextContainer: { flex: 1 },
  notificationOptionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 1 },
  notificationOptionSubtitle: { fontSize: 12, color: '#64748b' },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  scrollContent: { paddingBottom: 30 },
  textDark: { color: '#ffffff' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontWeight: '800', color: '#fff', marginBottom: 20 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  stickyHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: 16 },
  stickyHeaderContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stickyHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stickyHeaderCenter: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  stickyHeaderTitle: { fontWeight: '900', letterSpacing: -0.5 },
  stickyHeaderUnderline: { alignSelf: 'center' },
  stickyHeaderRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  stickyHeaderIconBtn: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  stickyHeaderBadge: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  stickyHeaderBadgeText: { color: 'white', fontWeight: 'bold' },
  stickyHeaderBaby: { overflow: 'hidden' },
  stickyHeaderLockBtn: { marginLeft: 4 },
  stickyHeaderLockGradient: { alignItems: 'center', justifyContent: 'center' },
  safetyCornerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  safetyCornerGradient: { alignItems: 'center', justifyContent: 'center' },
  safetyCornerBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  safetyCornerBadgeText: { fontWeight: '800', letterSpacing: 0.5 },

  glassCard: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  glassContent: { flex: 1 },

  parentCard: { marginBottom: 16, marginTop: 20 },
  parentHeader: { flexDirection: 'row', alignItems: 'center' },
  parentInfo: { flex: 1, marginLeft: 16 },
  greetingText: { color: '#64748b', fontWeight: '500', marginBottom: 2 },
  parentName: { fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  parentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(67,233,123,0.1)', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  verifiedText: { color: '#43e97b', fontWeight: '600' },
  timeText: { color: '#94a3b8' },
  parentQuickLinks: { flexDirection: 'row', gap: 8 },
  parentQuickLink: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  babyCard: { marginBottom: 20 },
  babyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  babySelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  babySelectorLabel: { color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  editButton: { width: 36, height: 36, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },
  babyMainInfo: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  babyDetails: { flex: 1, marginLeft: 16 },
  babyName: { fontWeight: '800', color: '#1e293b', letterSpacing: -0.5 },
  babyAge: { color: '#64748b', marginTop: 2, fontWeight: '500' },
  babyStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  babyStatusText: { color: '#43e97b', fontWeight: '600' },
  streakBadge: { position: 'absolute', top: 20, right: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { color: '#fff', fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(100,116,139,0.1)' },
  progressItem: { alignItems: 'center' },
  progressSvgContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  progressValue: { position: 'absolute', fontWeight: '800' },
  progressLabel: { color: '#64748b', marginTop: 6, fontWeight: '600' },

  noBabyCard: { marginBottom: 20, overflow: 'hidden', marginTop: 20 },
  noBabyGradient: { padding: 32, alignItems: 'center' },
  noBabyEmoji: { marginBottom: 16 },
  noBabyTitle: { fontWeight: '800', color: '#fff', marginBottom: 8 },
  noBabyText: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 20 },
  noBabyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, gap: 8 },
  noBabyButtonText: { color: '#667eea', fontWeight: '700' },

  section: { marginTop: 8 },
  sectionFullWidth: { marginTop: 8, width: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 24 },
  sectionHeaderPadded: {},
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontWeight: '600', color: '#667eea' },

  soundMixerContainer: { borderRadius: 24, padding: 16, marginBottom: 8, marginHorizontal: 20 },
  soundMixerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  soundMixerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soundMixerTitleText: { color: '#fff', fontWeight: '700' },
  soundMixerControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowPlaying: { color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  playAllButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  playAllButtonActive: { backgroundColor: '#f59e0b' },
  trackCard: { width: 130, marginRight: 12 },
  trackImage: { width: 130, height: 130, borderRadius: 8, marginBottom: 8 },
  trackOverlay: { flex: 1, justifyContent: 'flex-end', padding: 8, borderRadius: 8 },
  trackPlayButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  trackPlayButtonActive: { backgroundColor: '#f59e0b' },
  trackTitle: { color: '#fff', fontWeight: '600', marginBottom: 2 },
  trackArtist: { color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  trackDuration: { color: 'rgba(255,255,255,0.4)' },
  playingIndicator: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 },
  bar: { width: 3, height: 12, backgroundColor: '#1DB954', borderRadius: 1 },
  barMiddle: { height: 18 },

  gridWrapper: { paddingHorizontal: 10 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 10 },
  gridHint: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  doneButton: { backgroundColor: '#667eea', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  doneButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', width: '100%' },
  gridItem: { alignItems: 'center', marginBottom: 12 },
  gridItemTouchable: { alignItems: 'center', width: '100%' },
  gridItemGradient: { width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, position: 'relative' },
  gridItemGradientEdit: { borderWidth: 2, borderColor: '#fff', transform: [{ scale: 0.95 }] },
  gridItemIcon: { fontSize: 28 },
  gridItemLabel: { fontSize: 11, color: '#1e293b', fontWeight: '600', marginTop: 6, textAlign: 'center' },
  removeBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', zIndex: 10 },
  addItemGradient: { width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,116,139,0.1)', borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed' },

  featuresGrid2Col: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  featureCardWrapper2Col: { marginBottom: 12 },
  featureCard2Col: { borderRadius: 20, overflow: 'hidden', width: '100%' },
  featureGradient2Col: { padding: 16, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', flexDirection: 'row', gap: 12, position: 'relative' },
  featureGradientEdit: { borderWidth: 2, borderColor: '#667eea', borderStyle: 'dashed' },
  featureIcon2Col: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  featureLabel2Col: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  featureBadge2Col: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, minWidth: 32, alignItems: 'center' },
  featureBadgeText2Col: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  featureArrow2Col: { marginLeft: 'auto', opacity: 0.6 },
  dragHandle: { position: 'absolute', right: 8, top: '50%', marginTop: -10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },

  activityWrapper: { paddingHorizontal: 20 },
  emptyState: { padding: 32, alignItems: 'center', borderRadius: 24 },
  emptyStateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  emptyStateText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  activityItem: { marginVertical: 6, padding: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  activityIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  activityTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  activityDetails: { fontSize: 12, color: '#64748b', marginTop: 2 },
  activityArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(102,126,234,0.1)', alignItems: 'center', justifyContent: 'center' },

  loadMoreButton: { marginTop: 16, borderRadius: 16, overflow: 'hidden', height: 50 },
  loadMoreContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  viewAllButton: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  viewAllText: { fontSize: 14, fontWeight: '700', color: '#667eea' },
});