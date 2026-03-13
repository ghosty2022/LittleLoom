import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const NOTIFICATIONS = [
  {
    id: '1',
    type: 'like',
    user: { name: 'Jessica T.', avatar: '👩' },
    content: 'liked your post',
    target: '"Potty training success!"',
    time: '2m ago',
    read: false,
  },
  {
    id: '2',
    type: 'comment',
    user: { name: 'Mike D.', avatar: '👨' },
    content: 'commented on your post',
    target: '"Sleep tips for 18mo"',
    time: '15m ago',
    read: false,
  },
  {
    id: '3',
    type: 'repost',
    user: { name: 'Sarah M.', avatar: '👩‍⚕️' },
    content: 'reposted your thread',
    target: '"First steps milestone"',
    time: '1h ago',
    read: true,
  },
  {
    id: '4',
    type: 'mention',
    user: { name: 'Tom B.', avatar: '👨‍💼' },
    content: 'mentioned you in',
    target: '"Potty Training Support Group"',
    time: '3h ago',
    read: true,
  },
  {
    id: '5',
    type: 'follow',
    user: { name: 'Emma W.', avatar: '👩‍🍳' },
    content: 'started following you',
    target: '',
    time: '5h ago',
    read: true,
  },
  {
    id: '6',
    type: 'system',
    user: { name: 'LittleLoom', avatar: '🍼' },
    content: 'Your weekly summary is ready',
    target: 'View insights',
    time: '1d ago',
    read: true,
  },
];

const getIcon = (type: string) => {
  switch (type) {
    case 'like': return { name: 'heart', color: '#fc5c7d' };
    case 'comment': return { name: 'chatbubble', color: '#667eea' };
    case 'repost': return { name: 'repeat', color: '#11998e' };
    case 'mention': return { name: 'at', color: '#fa709a' };
    case 'follow': return { name: 'person-add', color: '#fee140' };
    case 'system': return { name: 'information-circle', color: '#6a82fb' };
    default: return { name: 'notifications', color: '#667eea' };
  };
};

export default function NotificationsScreen({ navigation }: any) {
  const renderNotification = ({ item }: { item: typeof NOTIFICATIONS[0] }) => {
    const icon = getIcon(item.type);
    
    return (
      <TouchableOpacity style={[
        styles.notificationItem,
        !item.read && styles.unreadItem
      ]}>
        <View style={styles.notificationLeft}>
          <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
            <Ionicons name={icon.name as any} size={20} color={icon.color} />
          </View>
          <View style={styles.avatarContainer}>
            <Text style={styles.userAvatar}>{item.user.avatar}</Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>
            <Text style={styles.userName}>{item.user.name}</Text>
            {' '}{item.content}{' '}
            {item.target && <Text style={styles.targetText}>{item.target}</Text>}
          </Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
      </TouchableOpacity>
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
        <Text style={styles.title}>Notifications 🔔</Text>
        <TouchableOpacity>
          <Text style={styles.markRead}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['All', 'Mentions', 'Likes'].map((filter, index) => (
          <TouchableOpacity 
            key={filter}
            style={[styles.filterTab, index === 0 && styles.filterTabActive]}
          >
            <Text style={[
              styles.filterText,
              index === 0 && styles.filterTextActive
            ]}>
              {filter}
            </Text>
            {index === 0 && <View style={styles.filterIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications List */}
      <FlatList
        data={NOTIFICATIONS}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  markRead: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 24,
  },
  filterTab: {
    paddingVertical: 8,
    position: 'relative',
  },
  filterTabActive: {},
  filterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  filterTextActive: {
    color: '#1a1a1a',
  },
  filterIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  unreadItem: {
    backgroundColor: 'rgba(102,126,234,0.05)',
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    fontSize: 40,
  },
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
  notificationContent: {
    flex: 1,
    paddingTop: 4,
  },
  notificationText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  userName: {
    fontWeight: '700',
    color: '#1a1a1a',
  },
  targetText: {
    fontWeight: '600',
    color: '#667eea',
  },
  notificationTime: {
    fontSize: 13,
    color: '#999',
  },
});