// src/screens/community/ChatListScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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
import { useCommunity, Chat } from '../../context/CommunityContext';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

type ChatListScreenProps = NativeStackScreenProps<CommunityStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: ChatListScreenProps) {
  const { chats, currentUser, getUnreadCount } = useCommunity();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const sortedChats = [...chats].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const renderChat = ({ item, index }: { item: Chat; index: number }) => {
    const lastMessage = item.lastMessage;
    const isMyMessage = lastMessage?.senderId === currentUser?.id;
    
    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <TouchableOpacity 
          style={styles.chatItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Chat', { userId: item.participantId });
          }}
          activeOpacity={0.8}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{item.participant.avatar}</Text>
            {item.participant.onlineStatus === 'online' && (
              <View style={styles.onlineDot} />
            )}
          </View>
          
          <View style={styles.chatInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{item.participant.displayName}</Text>
              <Text style={styles.time}>{formatTime(item.updatedAt)}</Text>
            </View>
            
            <View style={styles.messageRow}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {isMyMessage && 'You: '}
                {lastMessage?.type === 'image' ? '📷 Photo' : lastMessage?.content}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
          
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={CommunityColors.text.tertiary} 
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  return (
    <LinearGradient colors={CommunityColors.background.gradient} style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Messages 💬</Text>
        {totalUnread > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={sortedChats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CommunityColors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={CommunityColors.text.tertiary} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              Start chatting with other parents in the community!
            </Text>
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.navigate('CommunityMain')}
            >
              <Text style={styles.exploreText}>Explore Community</Text>
            </TouchableOpacity>
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
    paddingHorizontal: CommunitySpacing.lg,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 12,
  },
  title: { fontSize: 32, fontWeight: '800', color: CommunityColors.text.primary },
  headerBadge: {
    backgroundColor: CommunityColors.error,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: CommunitySpacing.lg, paddingBottom: 100 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...CommunityShadows.sm,
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { fontSize: 48 },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: CommunityColors.success,
    borderWidth: 2,
    borderColor: 'white',
  },
  chatInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: '700', color: CommunityColors.text.primary },
  time: { fontSize: 12, color: CommunityColors.text.tertiary },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: CommunityColors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: { color: 'white', fontSize: 12, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  exploreButton: {
    marginTop: 24,
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  exploreText: { color: 'white', fontSize: 16, fontWeight: '700' },
});