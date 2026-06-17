import React, { useCallback, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { useCommunity } from '../../context/CommunityContext';
import {  Alert, Button, FlatList, Pressable, RefreshControl, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useApp } from '../../context/AppContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { AutoHideFlatList } from '../../components/AutoHideScrollWrappers';

// ═══════════════════════════════════════════════════════════
// UNIFIED LITTLELOOM THEME — matches CommunityScreen exactly
// ═══════════════════════════════════════════════════════════
const LL = {
  primary: '#7c6cf1',
  primaryLight: '#a5b4fc',
  primaryDark: '#6b5ce7',
  primaryGhost: '#7c6cf118',
  accent: '#f472b6',
  accentSoft: '#fbcfe8',
  success: '#34d399',
  warning: '#fbbf24',
  info: '#38bdf8',
  error: '#ef4444',
  white: '#ffffff',
  gray50: '#f8f9ff',
  gray100: '#f0f2ff',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  darkBg: '#0b0f1f',
  darkSurface: '#151b2e',
  darkCard: '#1a2236',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, full: 999 },
  text: {
    xs: { size: 11, line: 14, weight: '500' },
    sm: { size: 13, line: 18, weight: '600' },
    base: { size: 15, line: 22, weight: '400' },
    lg: { size: 16, line: 24, weight: '600' },
    xl: { size: 18, line: 26, weight: '700' },
    '2xl': { size: 22, line: 30, weight: '800' },
  },
  shadow: {
    sm: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 },
  },
};

const NOTIFICATION_ICONS: Record<string, { name: any; color: string; bg: string }> = {
  like:     { name: 'heart',           color: LL.error,    bg: `${LL.error}18` },
  comment:  { name: 'chatbubble',      color: LL.primary,  bg: `${LL.primary}18` },
  repost:   { name: 'repeat',          color: LL.success,  bg: `${LL.success}18` },
  mention:  { name: 'at',              color: LL.warning,  bg: `${LL.warning}18` },
  follow:   { name: 'person-add',      color: LL.info,     bg: `${LL.info}18` },
  message:  { name: 'mail',            color: LL.primary,  bg: `${LL.primary}18` },
  system:   { name: 'information-circle', color: LL.success, bg: `${LL.success}18` },
  helpful:  { name: 'thumbs-up',       color: LL.primary,  bg: `${LL.primary}18` },
};

type NotificationsScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Notifications'>;

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const { notifications, markNotificationRead, markAllNotificationsRead, getUnreadCount } = useCommunity();
  const { isDark } = useApp();
  const sweetAlert = useSweetAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mentions' | 'likes'>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleMarkAllRead = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markAllNotificationsRead();
    sweetAlert.toast('All Read', 'All notifications marked as read', 'success');
  };

  const handleNotificationPress = async (notification: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markNotificationRead(notification.id);

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
        navigation.navigate('CommunityMemberProfile', { userId: notification.user.id });
        break;
      case 'message':
        navigation.navigate('Chat', { userId: notification.user.id });
        break;
      default:
        break;
    }
  };

  const handleMoreOptions = (notification: Notification) => {
    sweetAlert.confirm(
      'Notification Options',
      '',
      () => {
        console.log('Delete notification:', notification.id);
      },
      () => {
        markNotificationRead(notification.id);
      },
      'Delete',
      notification.read ? 'Mark Unread' : 'Mark Read'
    );
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'mentions') return n.type === 'mention' || n.type === 'comment';
    if (filter === 'likes') return n.type === 'like' || n.type === 'helpful';
    return true;
  });

  const unreadCount = getUnreadCount();

  const renderNotification = ({ item, index }: { item: Notification; index: number }) => {
    const icon = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.system;

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 30).duration(400).springify()}
        layout={Layout.springify()}
      >
        <Pressable
          style={[
            styles.notificationItem,
            {
              backgroundColor: isDark ? LL.darkCard : LL.white,
              borderColor: isDark ? LL.darkBorder : LL.gray200,
              borderWidth: 1,
            },
            !item.read && {
              backgroundColor: isDark ? `${LL.primary}10` : `${LL.primary}08`,
              borderLeftWidth: 3,
              borderLeftColor: LL.primary,
            },
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={styles.notificationLeft}>
            <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
              <Ionicons name={icon.name} size={18} color={icon.color} />
            </View>
            <View style={styles.avatarContainer}>
              <SafeAvatar
                avatar={item.user.avatar}
                size={40}
                fallbackIcon="person"
                fallbackColor={LL.primary}
                fallbackBgColor={`${LL.primary}15`}
                borderWidth={0}
              />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          </View>

          <View style={styles.notificationContent}>
            <Text style={[styles.notificationText, { color: isDark ? LL.gray300 : LL.gray700 }]}>
              <Text style={[styles.userName, { color: isDark ? LL.white : LL.gray900 }]}>
                {item.user.displayName}
              </Text>
              {' '}{item.content}{' '}
              {item.target && (
                <Text style={[styles.targetText, { color: isDark ? LL.gray500 : LL.gray400 }]}>
                  {item.target}
                </Text>
              )}
            </Text>
            <Text style={[styles.notificationTime, { color: isDark ? LL.gray500 : LL.gray400 }]}>
              {item.time}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.moreButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray50 }]}
            onPress={() => handleMoreOptions(item)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={isDark ? LL.gray500 : LL.gray400} />
          </TouchableOpacity>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: isDark ? LL.darkSurface : LL.white, borderBottomColor: isDark ? LL.darkBorder : LL.gray200 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? LL.white : LL.gray800} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: isDark ? LL.white : LL.gray900 }]}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: LL.accent }]}>
                <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={handleMarkAllRead} disabled={unreadCount === 0}>
            <Text style={[
              styles.markRead,
              { color: unreadCount > 0 ? LL.primary : isDark ? LL.gray600 : LL.gray300 },
            ]}>
              Mark all
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Filter Tabs ── */}
      <View style={[styles.filterContainer, { backgroundColor: isDark ? LL.darkBg : LL.gray50 }]}>
        {(['all', 'mentions', 'likes'] as const).map((f, i) => (
          <Animated.View key={f} entering={FadeInUp.delay(i * 50).duration(300)}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                {
                  backgroundColor: isDark ? LL.darkSurface : LL.white,
                  borderColor: isDark ? LL.darkBorder : LL.gray200,
                  borderWidth: 1,
                },
                filter === f && {
                  backgroundColor: `${LL.primary}15`,
                  borderColor: `${LL.primary}50`,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[
                styles.filterText,
                { color: isDark ? LL.gray400 : LL.gray500 },
                filter === f && { color: LL.primary, fontWeight: '800' },
              ]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
              {filter === f && <View style={[styles.filterIndicator, { backgroundColor: LL.primary }]} />}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* ── Notifications List ── */}
      <AutoHideFlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LL.primary}
            colors={[LL.primary]}
            progressBackgroundColor={isDark ? LL.darkSurface : LL.white}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={isDark ? [`${LL.primary}20`, `${LL.primaryDark}20`] : [`${LL.primary}15`, `${LL.primaryDark}15`]}
              style={styles.emptyIconBg}
            >
              <Ionicons name="notifications-off-outline" size={40} color={LL.primary} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: isDark ? LL.white : LL.gray800 }]}>
              No notifications
            </Text>
            <Text style={[styles.emptySubtext, { color: isDark ? LL.gray500 : LL.gray400 }]}>
              You are all caught up!
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
    paddingTop: 60,
    paddingBottom: LL.space.md,
    paddingHorizontal: LL.space.lg,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: LL.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
  },
  title: {
    fontSize: LL.text['2xl'].size,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unreadBadge: {
    borderRadius: LL.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: LL.white,
    fontSize: 11,
    fontWeight: '800',
  },
  markRead: {
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },

  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: LL.space.lg,
    paddingBottom: LL.space.md,
    gap: LL.space.sm,
  },
  filterTab: {
    paddingVertical: LL.space.sm,
    paddingHorizontal: LL.space.md,
    borderRadius: LL.radius.full,
    position: 'relative',
  },
  filterText: {
    fontSize: LL.text.sm.size,
    fontWeight: '600',
  },
  filterIndicator: {
    position: 'absolute',
    bottom: -4,
    left: '30%',
    right: '30%',
    height: 3,
    borderRadius: 2,
  },

  listContainer: {
    padding: LL.space.lg,
    paddingBottom: LL.space.xl,
  },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: LL.space.md,
    borderRadius: LL.radius.lg,
    marginBottom: LL.space.sm,
    ...LL.shadow.sm,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: LL.space.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: LL.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    zIndex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: LL.accent,
    borderWidth: 2.5,
    borderColor: isDark => isDark ? LL.darkCard : LL.white,
  },
  notificationContent: {
    flex: 1,
    marginRight: LL.space.sm,
  },
  notificationText: {
    fontSize: LL.text.sm.size,
    lineHeight: 20,
    fontWeight: '500',
  },
  userName: {
    fontWeight: '800',
  },
  targetText: {
    fontStyle: 'italic',
  },
  notificationTime: {
    fontSize: LL.text.xs.size,
    marginTop: 4,
    fontWeight: '500',
  },
  moreButton: {
    padding: LL.space.sm,
    borderRadius: LL.radius.full,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: LL.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LL.space.lg,
  },
  emptyTitle: {
    fontSize: LL.text.xl.size,
    fontWeight: '800',
    marginBottom: LL.space.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: LL.text.base.size,
    textAlign: 'center',
    fontWeight: '500',
  },
});
