import React, { useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Alert, FlatList, Image, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Chat } from '../../context/CommunityContext';
import { useApp } from '../../context/AppContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar } from '../../components/SafeAvatar';
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

type ChatListScreenProps = NativeStackScreenProps<CommunityStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: ChatListScreenProps) {
  const { chats, currentUser } = useCommunity();
  const { isDark } = useApp();
  const sweetAlert = useSweetAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const sortedChats = [...chats].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // 🔍 SEARCH: Filter chats by participant name
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return sortedChats;
    const q = searchQuery.toLowerCase();
    return sortedChats.filter(c => 
      c.participant.displayName.toLowerCase().includes(q) ||
      (c.lastMessage?.content || '').toLowerCase().includes(q)
    );
  }, [sortedChats, searchQuery]);

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

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

  const renderChat = ({ item, index }: { item: Chat; index: number }) => {
    const lastMessage = item.lastMessage;
    const isMyMessage = lastMessage?.senderId === currentUser?.id;

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(400).springify()}>
        <TouchableOpacity
          style={[
            styles.chatItem,
            {
              backgroundColor: isDark ? LL.darkCard : LL.white,
              borderColor: isDark ? LL.darkBorder : LL.gray200,
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
            <SafeAvatar
              avatar={item.participant.avatar}
              size={52}
              fallbackIcon="person"
              fallbackColor={LL.primary}
              fallbackBgColor={`${LL.primary}15`}
              borderWidth={item.participant.onlineStatus === 'online' ? 2 : 0}
              borderColor={LL.success}
            />
            {item.participant.onlineStatus === 'online' && (
              <View style={[styles.onlineDot, { backgroundColor: LL.success, borderColor: isDark ? LL.darkCard : LL.white }]} />
            )}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: isDark ? LL.white : LL.gray800 }]}>
                {item.participant.displayName}
              </Text>
              <Text style={[styles.time, { color: isDark ? LL.gray500 : LL.gray400 }]}>
                {formatTime(item.updatedAt)}
              </Text>
            </View>

            <View style={styles.messageRow}>
              <Text style={[styles.lastMessage, { color: isDark ? LL.gray400 : LL.gray500 }]} numberOfLines={1}>
                {isMyMessage && <Text style={{ color: isDark ? LL.gray500 : LL.gray400 }}>You: </Text>}
                {lastMessage?.type === 'image' ? '📷 Photo' : lastMessage?.content}
              </Text>
              {item.unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: LL.accent }]}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color={isDark ? LL.gray600 : LL.gray300} />
        </TouchableOpacity>
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
            {isSearching ? (
              <View style={[styles.searchInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}>
                <Ionicons name="search" size={16} color={LL.gray400} />
                <TextInput
                  style={[styles.searchInput, { color: isDark ? LL.white : LL.gray900 }]}
                  placeholder="Search chats..."
                  placeholderTextColor={LL.gray400}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={LL.gray400} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={[styles.title, { color: isDark ? LL.white : LL.gray900 }]}>Messages</Text>
                {totalUnread > 0 && (
                  <View style={[styles.headerBadge, { backgroundColor: LL.accent }]}>
                    <Text style={styles.headerBadgeText}>{totalUnread}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
            onPress={() => {
              if (isSearching) {
                setIsSearching(false);
                setSearchQuery('');
              } else {
                setIsSearching(true);
              }
            }}
          >
            <Ionicons name={isSearching ? "close" : "search"} size={22} color={isDark ? LL.white : LL.gray800} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Chat List ── */}
      <AutoHideFlatList
        data={filteredChats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
              <Ionicons name={searchQuery ? "search-outline" : "chatbubbles-outline"} size={40} color={LL.primary} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: isDark ? LL.white : LL.gray800 }]}>
              {searchQuery ? 'No chats found' : 'No messages yet'}
            </Text>
            <Text style={[styles.emptyText, { color: isDark ? LL.gray400 : LL.gray500 }]}>
              {searchQuery ? 'Try a different search term' : 'Start chatting with other parents in the community!'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('CommunityMain')} activeOpacity={0.85}>
                <LinearGradient colors={[LL.primary, LL.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.exploreBtnGrad}>
                  <Text style={styles.exploreText}>Explore Community</Text>
                  <Ionicons name="arrow-forward" size={14} color={LL.white} />
                </LinearGradient>
              </TouchableOpacity>
            )}
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LL.space.sm,
    marginHorizontal: LL.space.md,
  },
  title: {
    fontSize: LL.text['2xl'].size,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerBadge: {
    borderRadius: LL.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: LL.white,
    fontSize: 11,
    fontWeight: '800',
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.full,
    paddingHorizontal: LL.space.md,
    paddingVertical: LL.space.sm,
    gap: LL.space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: LL.text.base.size,
    paddingVertical: 2,
  },

  list: {
    paddingHorizontal: LL.space.lg,
    paddingBottom: 100,
    paddingTop: LL.space.sm,
  },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.lg,
    padding: LL.space.lg,
    marginBottom: LL.space.md,
    ...LL.shadow.sm,
  },
  avatarContainer: { position: 'relative', marginRight: LL.space.md },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  chatInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LL.space.xs,
  },
  name: {
    fontSize: LL.text.base.size,
    fontWeight: '700',
  },
  time: {
    fontSize: LL.text.xs.size,
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: LL.text.sm.size,
    flex: 1,
    marginRight: LL.space.sm,
    fontWeight: '500',
  },
  unreadBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: LL.white,
    fontSize: 11,
    fontWeight: '800',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: LL.space['2xl'],
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
  emptyText: {
    fontSize: LL.text.base.size,
    textAlign: 'center',
    marginBottom: LL.space.xl,
    lineHeight: 22,
    fontWeight: '500',
  },
  exploreBtn: {
    borderRadius: LL.radius.full,
    overflow: 'hidden',
  },
  exploreBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.xl,
    paddingVertical: LL.space.md,
  },
  exploreText: {
    color: LL.white,
    fontSize: LL.text.sm.size,
    fontWeight: '700',
  },
});
