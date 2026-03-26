// src/screens/community/NotificationsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Notification } from '../../context/CommunityContext';

type NotificationsScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Notifications'>;

const getIcon = (type: string) => {
  switch (type) {
    case 'like': return { name: 'heart', color: '#fc5c7d', bg: '#fc5c7d20' };
    case 'comment': return { name: 'chatbubble', color: '#667eea', bg: '#667eea20' };
    case 'repost': return { name: 'repeat', color: '#11998e', bg: '#11998e20' };
    case 'mention': return { name: 'at', color: '#fa709a', bg: '#fa709a20' };
    case 'follow': return { name: 'person-add', color: '#fee140', bg: '#fee14020' };
    case 'message': return { name: 'mail', color: '#6a82fb', bg: '#6a82fb20' };
    case 'system': return { name: 'information-circle', color: '#43e97b', bg: '#43e97b20' };
    case 'helpful': return { name: 'thumbs-up', color: '#667eea', bg: '#667eea20' };
    default: return { name: 'notifications', color: '#667eea', bg: '#667eea20' };
  }
};

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const { notifications, markNotificationRead, markAllNotificationsRead, getUnreadCount } = useCommunity();
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
        navigation.navigate('UserProfile', { userId: notification.user.id });
        break;
      case 'message':
        navigation.navigate('Chat', { userId: notification.user.id });
        break;
      default:
        break;
    }
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
      <Animated.View entering={FadeInUp.delay(index * 30)}>
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
              <Text style={styles.userAvatar}>{item.user.avatar}</Text>
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
            onPress={() => {
              Alert.alert('Options', '', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete') },
                { text: item.read ? 'Mark Unread' : 'Mark Read', onPress: () => markNotificationRead(item.id) },
              ]);
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Notifications 🔔</Text>
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
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
          </View>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  unreadBadge: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadText: { color: 'white', fontSize: 12, fontWeight: '600' },
  markRead: { fontSize: 14, color: '#667eea', fontWeight: '600' },
  markReadDisabled: { color: '#999' },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 24,
  },
  filterTab: { paddingVertical: 8, position: 'relative' },
  filterTabActive: {},
  filterText: { fontSize: 16, fontWeight: '600', color: '#999' },
  filterTextActive: { color: '#1a1a1a' },
  filterIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  listContainer: { paddingHorizontal: 24, paddingBottom: 100 },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  unreadItem: {
    backgroundColor: 'rgba(102,126,234,0.05)',
    marginHorizontal: -24,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  notificationLeft: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarContainer: { position: 'relative' },
  userAvatar: { fontSize: 40 },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#667eea',
    borderWidth: 2,
    borderColor: 'white',
  },
  notificationContent: { flex: 1 },
  notificationText: { fontSize: 15, color: '#333', lineHeight: 20, marginBottom: 4 },
  userName: { fontWeight: '700', color: '#1a1a1a' },
  targetText: { fontWeight: '600', color: '#667eea' },
  notificationTime: { fontSize: 13, color: '#999' },
  moreButton: { padding: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#bbb', marginTop: 4 },
});