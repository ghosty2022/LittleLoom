import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useCommunity, Notification } from '../../context/CommunityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner, CommunitySpinner } from '../../components/UniversalSpinner';

import { AutoHideFlatList } from '../../components/AutoHideScrollWrappers';
import { CommunityColors, CommunitySpacing, CommunityBorderRadius, CommunityShadows } from '../../theme/CommunityTheme';

type NotificationsScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Notifications'>;

const getIcon = (type: string) => {
  switch (type) {
    case 'like': return { name: 'heart', color: CommunityColors.error, bg: CommunityColors.error + '20' };
    case 'comment': return { name: 'chatbubble', color: CommunityColors.primary, bg: CommunityColors.primary + '20' };
    case 'repost': return { name: 'repeat', color: CommunityColors.secondary, bg: CommunityColors.secondary + '20' };
    case 'mention': return { name: 'at', color: CommunityColors.accentDark, bg: CommunityColors.accent + '20' };
    case 'follow': return { name: 'person-add', color: CommunityColors.accent, bg: CommunityColors.accent + '20' };
    case 'message': return { name: 'mail', color: CommunityColors.info, bg: CommunityColors.info + '20' };
    case 'system': return { name: 'information-circle', color: CommunityColors.success, bg: CommunityColors.success + '20' };
    case 'helpful': return { name: 'thumbs-up', color: CommunityColors.primary, bg: CommunityColors.primary + '20' };
    default: return { name: 'notifications', color: CommunityColors.primary, bg: CommunityColors.primary + '20' };
  }
};

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const { notifications, markNotificationRead, markAllNotificationsRead, getUnreadCount } = useCommunity();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mentions' | 'likes'>('all');

  const {
    shouldReduceMotion,
    triggerHaptic,
    spinnerColor,
  } = useCustomization();

  // SweetAlert for all alerts
  const sweetAlert = useSweetAlert();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleMarkAllRead = async () => {
    triggerHaptic('success');
    await markAllNotificationsRead();
    sweetAlert.toast('All Read', 'All notifications marked as read', 'success');
  };

  const handleNotificationPress = async (notification: Notification) => {
    triggerHaptic('light');
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
        navigation.navigate('UserProfile', { userId: notification.user.id });
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
        // Delete action
        console.log('Delete notification:', notification.id);
      },
      () => {
        // Mark read/unread
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
    const icon = getIcon(item.type);

    return (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 30)}>
        <TouchableOpacity 
          style={[styles.notificationItem, !item.read && styles.unreadItem]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.8}
        >
          <View style={styles.notificationLeft}>
            <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
              <Ionicons name={icon.name as any} size={20} color={icon.color} />
            </View>
            <View style={styles.avatarContainer}>
              {/* SafeAvatar for notification user */}
              <SafeAvatar
                avatar={item.user.avatar}
                size={40}
                fallbackIcon="person"
                fallbackColor={CommunityColors.primary}
                borderWidth={1}
                borderColor={CommunityColors.border}
              />
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          </View>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationText}>
              <Text style={styles.userName}>{item.user.displayName}</Text>
              {' '}{item.content}{' '}
              {item.target && <Text style={styles.targetText}>{item.target}</Text>}
            </Text>
            <Text style={styles.notificationTime}>{item.time}</Text>
          </View>
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => handleMoreOptions(item)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={CommunityColors.text.tertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <LinearGradient colors={CommunityColors.background.gradient} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={CommunityColors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={[styles.markRead, unreadCount === 0 && styles.markReadDisabled]}>
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'mentions', 'likes'] as const).map((f) => (
          <TouchableOpacity 
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              filter === f && styles.filterTextActive
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
            {filter === f && <View style={styles.filterIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications List */}
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
            tintColor={spinnerColor} 
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={CommunityColors.text.tertiary} />
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>You are all caught up!</Text>
          </View>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CommunitySpacing.md,
    paddingTop: CommunitySpacing.xl + 20,
    paddingBottom: CommunitySpacing.md,
  },
  backButton: {
    padding: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    backgroundColor: CommunityColors.background.elevated,
    ...CommunityShadows.small,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: CommunityColors.text.primary,
  },
  unreadBadge: {
    backgroundColor: CommunityColors.error,
        borderRadius: CommunityBorderRadius.full,
    paddingHorizontal: CommunitySpacing.sm,
    paddingVertical: 2,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  markRead: {
    fontSize: 14,
    fontWeight: '600',
    color: CommunityColors.primary,
  },
  markReadDisabled: {
    color: CommunityColors.text.tertiary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: CommunitySpacing.md,
    paddingBottom: CommunitySpacing.md,
    gap: CommunitySpacing.sm,
  },
  filterTab: {
    paddingVertical: CommunitySpacing.sm,
    paddingHorizontal: CommunitySpacing.md,
    borderRadius: CommunityBorderRadius.full,
    backgroundColor: CommunityColors.background.elevated,
    position: 'relative',
  },
  filterTabActive: {
    backgroundColor: CommunityColors.primary + '15',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
  },
  filterTextActive: {
    color: CommunityColors.primary,
  },
  filterIndicator: {
    position: 'absolute',
    bottom: -4,
    left: '30%',
    right: '30%',
    height: 3,
    borderRadius: 2,
    backgroundColor: CommunityColors.primary,
  },
  listContainer: {
    padding: CommunitySpacing.md,
    paddingBottom: CommunitySpacing.xl,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: CommunitySpacing.md,
    borderRadius: CommunityBorderRadius.lg,
    backgroundColor: CommunityColors.background.card,
    marginBottom: CommunitySpacing.sm,
    ...CommunityShadows.small,
  },
  unreadItem: {
    backgroundColor: CommunityColors.primary + '08',
    borderLeftWidth: 3,
    borderLeftColor: CommunityColors.primary,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: CommunitySpacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: CommunityBorderRadius.full,
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
    backgroundColor: CommunityColors.error,
    borderWidth: 2,
    borderColor: CommunityColors.background.card,
  },
  notificationContent: {
    flex: 1,
    marginRight: CommunitySpacing.sm,
  },
  notificationText: {
    fontSize: 14,
    color: CommunityColors.text.primary,
    lineHeight: 20,
  },
  userName: {
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  targetText: {
    color: CommunityColors.text.secondary,
    fontStyle: 'italic',
  },
  notificationTime: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    marginTop: 4,
  },
  moreButton: {
    padding: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: CommunitySpacing.xxl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginTop: CommunitySpacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: CommunitySpacing.xs,
  },
});