import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, StatusBar  } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Chat } from '../../context/CommunityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { AutoHideFlatList } from '../../components/AutoHideScrollWrappers';
import { CommunitySpacing, CommunityBorderRadius, CommunityShadows } from '../../theme/CommunityTheme';

type ChatListScreenProps = NativeStackScreenProps<CommunityStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: ChatListScreenProps) {
  const { chats, currentUser } = useCommunity();
  const { themeColors, darkMode } = useCustomization();
  const [refreshing, setRefreshing] = useState(false);

  const theme = useMemo(() => {
    const isDark = darkMode;
    return {
      primary: themeColors.primary,
      secondary: themeColors.secondary,
      accent: themeColors.accent,
      background: {
        gradient: themeColors.colors,
        card: isDark ? '#1e1e2e' : '#ffffff',
        elevated: isDark ? '#2a2a3c' : '#f8faff',
        main: isDark ? '#0f0f1e' : '#f8faff',
      },
      text: {
        primary: isDark ? '#ffffff' : '#1a1a1a',
        secondary: isDark ? '#a0a0a0' : '#666666',
        tertiary: isDark ? '#666666' : '#999999',
      },
      error: '#ff4757',
      success: '#43e97b',
      info: '#4facfe',
      divider: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    };
  }, [themeColors, darkMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const sortedChats = [...chats].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const renderChat = ({ item, index }: { item: Chat; index: number }) => {
    const lastMessage = item.lastMessage;
    const isMyMessage = lastMessage?.senderId === currentUser?.id;

    return (
      <Animated.View entering={FadeInUp.delay(index * 50)}>
        <TouchableOpacity
          style={[
            styles.chatItem,
            {
              backgroundColor: theme.background.card,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Chat', { userId: item.participantId });
          }}
          activeOpacity={0.8}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{item.participant.avatar}</Text>
            {item.participant.onlineStatus === 'online' && (
              <View
                style={[
                  styles.onlineDot,
                  {
                    backgroundColor: theme.success,
                    borderColor: theme.background.card,
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: theme.text.primary }]}>
                {item.participant.displayName}
              </Text>
              <Text style={[styles.time, { color: theme.text.tertiary }]}>
                {formatTime(item.updatedAt)}
              </Text>
            </View>

            <View style={styles.messageRow}>
              <Text
                style={[styles.lastMessage, { color: theme.text.secondary }]}
                numberOfLines={1}
              >
                {isMyMessage && 'You: '}
                {lastMessage?.type === 'image'
                  ? '📷 Photo'
                  : lastMessage?.content}
              </Text>
              {item.unreadCount > 0 && (
                <View
                  style={[
                    styles.unreadBadge,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.text.tertiary}
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

    if (days === 0)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  return (
    <LinearGradient
      colors={theme.background.gradient}
      style={styles.container}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          Messages 💬
        </Text>
        {totalUnread > 0 && (
          <View style={[styles.headerBadge, { backgroundColor: theme.error }]}>
            <Text style={styles.headerBadgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      <AutoHideFlatList
        data={sortedChats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={theme.text.tertiary}
            />
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              No messages yet
            </Text>
            <Text
              style={[styles.emptyText, { color: theme.text.secondary }]}
            >
              Start chatting with other parents in the community!
            </Text>
            <TouchableOpacity
              style={[
                styles.exploreButton,
                { backgroundColor: theme.primary },
              ]}
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
  title: { fontSize: 32, fontWeight: '800' },
  headerBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: CommunitySpacing.lg, paddingBottom: 100 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderWidth: 2,
  },
  chatInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: '700' },
  time: { fontSize: 12 },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
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
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  exploreButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  exploreText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
