import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useCommunity } from '../../context/CommunityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';

type NotificationsScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Notifications'>;

/* ── The Loom palette ─────────────────────────────────────── */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

const NOTIFICATION_ICONS: Record<string, { name: any; color: string; bg: string }> = {
  like: { name: 'heart', color: DS.danger, bg: `${DS.danger}18` },
  comment: { name: 'chatbubble', color: DS.primary, bg: `${DS.primary}18` },
  repost: { name: 'repeat', color: DS.success, bg: `${DS.success}18` },
  mention: { name: 'at', color: DS.warning, bg: `${DS.warning}18` },
  follow: { name: 'person-add', color: DS.info, bg: `${DS.info}18` },
  message: { name: 'mail', color: DS.primary, bg: `${DS.primary}18` },
  system: { name: 'information-circle', color: DS.success, bg: `${DS.success}18` },
  helpful: { name: 'thumbs-up', color: DS.primary, bg: `${DS.primary}18` },
  security: { name: 'shield-checkmark', color: DS.primary, bg: `${DS.primary}18` },
};

type Filter = 'all' | 'mentions' | 'likes' | 'security';
const FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'mentions', label: 'Mentions', icon: 'at-outline' },
  { key: 'likes', label: 'Likes', icon: 'heart-outline' },
  { key: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
];

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
  } = useCommunity();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);

  const unreadCount = getUnreadCount();

  const filteredNotifications = useMemo(() => {
    if (filter === 'mentions')
      return notifications.filter((n) => n.type === 'mention' || n.type === 'comment');
    if (filter === 'likes')
      return notifications.filter((n) => n.type === 'like' || n.type === 'helpful');
    if (filter === 'security')
      return notifications.filter((n) => n.type === 'security' || n.type === 'system');
    return notifications;
  }, [notifications, filter]);

  const sections = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: Record<string, any[]> = { Today: [], Yesterday: [], 'This Week': [], Older: [] };

    filteredNotifications.forEach((n) => {
      const d = new Date(n.timestamp);
      if (d.toDateString() === today.toDateString()) groups.Today.push(n);
      else if (d.toDateString() === yesterday.toDateString()) groups.Yesterday.push(n);
      else if (d > weekAgo) groups['This Week'].push(n);
      else groups.Older.push(n);
    });

    return Object.entries(groups)
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({ title, data }));
  }, [filteredNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    // Nothing to fetch — notifications are in-memory. Just re-settle.
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  }, [triggerHaptic]);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markAllNotificationsRead();
    sweetAlert.toast('All Read', 'All notifications marked as read', 'success');
  };

  const handleNotificationPress = async (notification: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markNotificationRead(notification.id);
    setSelectedNotification(notification.id);

    const targetUserId = notification.user?.id || notification.userId;

    switch (notification.type) {
      case 'like':
      case 'comment':
      case 'repost':
      case 'helpful':
        if (notification.postId) {
          navigation.navigate('PostDetail', { postId: notification.postId });
        }
        break;
      case 'follow':
      case 'mention':
        if (targetUserId) {
          navigation.navigate('CommunityMemberProfile', { userId: targetUserId });
        }
        break;
      case 'message':
        if (targetUserId) {
          navigation.navigate('Chat', { chatId: targetUserId } as any);
        }
        break;
      case 'security':
        navigation.navigate('CommunityVerification' as any);
        break;
      case 'system':
        sweetAlert.alert('System Notification', notification.content, 'info');
        break;
      default:
        break;
    }
  };

  const handleMoreOptions = (notification: any) => {
    setSelectedNotification(notification.id);
    sweetAlert.confirm(
      'Notification',
      notification.content,
      () => {
        markNotificationRead(notification.id);
        sweetAlert.toast('Marked Read', 'Notification marked as read', 'success');
      },
      () => {},
      notification.read ? 'OK' : 'Mark Read',
      'Cancel',
    );
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const icon = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.system;
    const isSelected = selectedNotification === item.id;
    const isUnread = !item.read;

    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 30).duration(320)}>
        <Pressable
          onPress={() => handleNotificationPress(item)}
          onLongPress={() => handleMoreOptions(item)}
          delayLongPress={450}
          style={[
            styles.notificationRow,
            {
              backgroundColor: isDark ? DS.darkCard : DS.white,
              borderColor: isDark ? DS.darkBorder : DS.lightBorder,
            },
            isUnread && {
              backgroundColor: isDark ? `${DS.primary}14` : `${DS.primary}08`,
              borderColor: isDark ? `${DS.primary}40` : `${DS.primary}30`,
            },
            isSelected && { borderColor: DS.primary, borderWidth: 2 },
          ]}
        >
          <View style={styles.notificationLeft}>
            <View style={[styles.iconChip, { backgroundColor: icon.bg }]}>
              <Ionicons name={icon.name} size={16} color={icon.color} />
            </View>
            <View style={styles.avatarWrap}>
              {isUnread && (
                <LinearGradient
                  colors={[DS.primary, DS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarAura}
                />
              )}
              <View style={[styles.avatarInner, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
                <SafeAvatar
                  avatar={item.user?.avatar || item.actorAvatar}
                  size={36}
                  fallbackIcon="person"
                  fallbackColor={DS.primary}
                  fallbackBgColor={`${DS.primary}20`}
                />
              </View>
              {isUnread && (
                <View style={[styles.unreadDot, { borderColor: isDark ? DS.darkCard : DS.white }]} />
              )}
            </View>
          </View>

          <View style={styles.notificationContent}>
            <Text style={[styles.notificationText, { color: isDark ? DS.gray300 : DS.gray700 }]}>
              <Text style={[styles.userName, { color: isDark ? DS.white : DS.gray900 }]}>
                {item.user?.displayName || 'System'}
              </Text>{' '}
              {item.content}{' '}
              {item.target && (
                <Text style={[styles.targetText, { color: isDark ? DS.gray500 : DS.gray500 }]}>
                  "{item.target}"
                </Text>
              )}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.timeText, { color: isDark ? DS.gray500 : DS.gray500 }]}>
                {item.time}
              </Text>
              {item.type && (
                <View style={[styles.typeBadge, { backgroundColor: icon.bg }]}>
                  <Text style={[styles.typeBadgeText, { color: icon.color }]}>{item.type}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.moreBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.gray100 },
            ]}
            onPress={() => handleMoreOptions(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={isDark ? DS.gray400 : DS.gray500} />
          </TouchableOpacity>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Aura bg */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)', 'transparent']
            : ['rgba(99,102,241,0.06)', 'rgba(236,72,153,0.03)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
            borderBottomColor: isDark ? DS.darkBorder : DS.lightBorder,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}
          >
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray900} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: isDark ? DS.white : DS.gray900 }]}>Notifications</Text>
            {unreadCount > 0 && (
              <LinearGradient
                colors={[DS.accent, DS.accentLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badgePill}
              >
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </LinearGradient>
            )}
          </View>

          <TouchableOpacity onPress={handleMarkAllRead} disabled={unreadCount === 0} hitSlop={8}>
            <Text
              style={[
                styles.markAllText,
                { color: unreadCount > 0 ? DS.primary : isDark ? DS.gray600 : DS.gray400 },
              ]}
            >
              Mark all
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => {
                  triggerHaptic('light');
                  setFilter(f.key);
                }}
                activeOpacity={0.75}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active
                      ? DS.primary
                      : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : DS.white,
                    borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.lightBorder,
                  },
                ]}
              >
                <Ionicons
                  name={f.icon as any}
                  size={12}
                  color={active ? DS.white : isDark ? DS.gray400 : DS.gray500}
                />
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? DS.white : isDark ? DS.gray400 : DS.gray500 },
                    active && { fontWeight: '800' },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={[styles.sectionHeaderText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {section.title}
            </Text>
            {section.title === 'Today' && unreadCount > 0 && (
              <View style={[styles.sectionUnreadPill, { backgroundColor: `${DS.primary}18` }]}>
                <Text style={[styles.sectionUnreadText, { color: DS.primary }]}>
                  {unreadCount} new
                </Text>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={DS.primary}
            colors={[DS.primary]}
            progressBackgroundColor={isDark ? DS.darkSurface : DS.white}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)']
                  : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)']
              }
              style={styles.emptyIconBg}
            >
              <Ionicons name="notifications-off-outline" size={40} color={DS.primary} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: isDark ? DS.white : DS.gray800 }]}>
              No notifications
            </Text>
            <Text style={[styles.emptySubtext, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {filter === 'security'
                ? 'You have no security notifications'
                : 'You are all caught up!'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.sm,
    paddingBottom: DS.space.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  badgePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  badgeText: { color: DS.white, fontSize: 11, fontWeight: '800' },
  markAllText: { fontSize: 13, fontWeight: '700' },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.md,
    flexWrap: 'wrap',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterText: { fontSize: 11.5, fontWeight: '600' },

  listContainer: { padding: DS.space.lg },

  sectionHeaderWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionUnreadPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  sectionUnreadText: { fontSize: 10, fontWeight: '800' },

  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: DS.radius.lg,
    marginBottom: 8,
    borderWidth: 1,
    ...DS.shadow.sm,
  },
  notificationLeft: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -6,
    zIndex: 1,
  },
  avatarWrap: { position: 'relative', width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  avatarAura: { position: 'absolute', width: 42, height: 42, borderRadius: 21 },
  avatarInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: DS.accent,
    borderWidth: 2.5,
  },
  notificationContent: { flex: 1, marginRight: 8 },
  notificationText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  userName: { fontWeight: '800' },
  targetText: { fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  timeText: { fontSize: 11, fontWeight: '500' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  moreBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: DS.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: DS.space.lg,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptySubtext: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
});