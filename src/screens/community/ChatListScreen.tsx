import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity } from '../../context/CommunityContext';
import { useFamilyChat, FamilyChat, FamilyMessage } from '../../context/FamilyChatContext';
import { useAuth, subscribeToProfileChanges } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { SafeAvatar } from '../../components/SafeAvatar';

type ChatListScreenProps = NativeStackScreenProps<CommunityStackParamList, 'ChatList'>;

/* ── The Loom tokens ──────────────────────────────────────── */
const LL = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  error: '#ef4444',

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

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

export default function ChatListScreen({ navigation }: ChatListScreenProps) {
  // ── Auth FIRST so `userProfile` is a stable dependency target
  //    for the `chats` useMemo below. ──────────────────────────
  const { userProfile } = useAuth();
  const currentUserId = userProfile?.id || '';

  const { getUserById } = useCommunity();
  const {
    messages,
    isChatHidden,
    deleteChat,
    subscribeToChatMessages,
  } = useFamilyChat() as any;

  // ── Live role badge cache (Parent 1 / Co-Parent / Guardian / Viewer) ──
  // Re-queried from `profiles.role` on every profile-change event.
  const roleLabelsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const refreshRoles = async () => {
      const unique = new Set<string>();
      chats.forEach((c) => {
        const other = c.participants.find((p) => p !== currentUserId);
        if (other) unique.add(other);
      });
      const { getUserRole } = useCommunity() as any;
      if (typeof getUserRole !== 'function') return;
      for (const uid of unique) {
        const role = await getUserRole(uid);
        roleLabelsRef.current[uid] =
          role === 'parent1' ? 'Primary Parent'
          : role === 'parent2' ? 'Co-Parent'
          : role === 'guardian' ? 'Guardian'
          : role === 'viewer' ? 'Viewer'
          : '';
      }
      requestAnimationFrame(() => setListTick((n) => n + 1));
    };
    refreshRoles();
    const unsub = subscribeToProfileChanges(() => refreshRoles());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdsKey]);
  // Community DMs live in the shared family_messages table keyed by
  // the direct chat id "direct_<idA>_<idB>". Build the list from
  // whatever direct chats the current user has.
  const chats: FamilyChat[] = useMemo(() => {
    const meId = userProfile?.id;
    if (!meId) return [];
    const out: FamilyChat[] = [];
    const allMsgs = (messages ?? {}) as Record<string, FamilyMessage[]>;
    Object.keys(allMsgs).forEach((chatKey) => {
      if (!chatKey.startsWith('direct_')) return;
      // Deleted-for-me chats must never reappear.
      if (isChatHidden(chatKey)) return;
      const parts = chatKey.replace('direct_', '').split('_');
      if (!parts.includes(meId)) return;
      const otherId = parts.find((p) => p !== meId);
      if (!otherId) return;
      const msgs = allMsgs[chatKey] ?? [];
      const last = msgs[msgs.length - 1];
      out.push({
        id: chatKey,
        type: 'direct',
        name: getUserById(otherId)?.displayName || 'Conversation',
        participants: parts,
        unreadCount: msgs.filter((m) => !m.readBy?.includes(meId)).length,
        createdAt: msgs[0]?.timestamp || new Date().toISOString(),
        updatedAt: last?.timestamp || new Date().toISOString(),
        isMuted: false,
        familyCode: '',
        lastMessage: last,
      } as any);
    });
    return out.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [messages, userProfile?.id, getUserById, isChatHidden]);
  // Real-time: refresh the list whenever any direct chat receives a
  // message. Also re-runs after a delete so a hidden chat disappears
  // immediately even if a stray broadcast arrives.
  const [listTick, setListTick] = useState(0);
  const chatIdsKey = useMemo(
    () => chats.map(c => c.id).sort().join('|'),
    [chats],
  );
  useEffect(() => {
    if (!subscribeToChatMessages) return;
    const unsubs: Array<() => void> = [];
    chats.forEach((c) => {
      unsubs.push(
        subscribeToChatMessages(c.id, () => {
          requestAnimationFrame(() => setListTick(n => n + 1));
        }),
      );
    });
    return () => { unsubs.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdsKey, subscribeToChatMessages]);

  const refresh = undefined;

  const { isDark } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // Bumped whenever any profile changes — forces `getUserById` lookups
  // above to re-render, which refreshes participant avatars/names.
  const [, setProfileTick] = useState(0);

  useEffect(() => {
    if (!currentUserId) return;
    const unsub = subscribeToProfileChanges((payload) => {
      // Only react to changes for users actually in one of my chats.
      setProfileTick((n) => n + 1);
    });
    return unsub;
  }, [currentUserId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof refresh === 'function') await refresh();
      else await new Promise((r) => setTimeout(r, 600));
    } catch {}
    setRefreshing(false);
  }, [refresh]);

  const sortedChats = useMemo(() => {
    return [...chats]
      .filter((c: FamilyChat) => c.type === 'direct')
      .filter((c: FamilyChat) => !isChatHidden(c.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, isChatHidden, listTick]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return sortedChats;
    const q = searchQuery.toLowerCase();
    return sortedChats.filter((c: FamilyChat) => {
      const otherId = c.participants.find((p) => p !== currentUserId);
      const participant = otherId ? getUserById(otherId) : null;
      const name = participant?.displayName || c.name || '';
      return (
        name.toLowerCase().includes(q) ||
        (c.lastMessage?.content || '').toLowerCase().includes(q)
      );
    });
  }, [sortedChats, searchQuery, currentUserId, getUserById]);

  const totalUnread = useMemo(
    () => chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0),
    [chats],
  );

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

  const renderChat = ({ item, index }: { item: FamilyChat; index: number }) => {
    const lastMessage = item.lastMessage;
    const otherId = item.participants.find((p) => p !== currentUserId);
    const participant = otherId ? getUserById(otherId) : null;
    const isMyMessage = lastMessage?.senderId === currentUserId;
    const isOnline = participant?.onlineStatus === 'online';
    const liveRoleBadge = otherId ? (roleLabelsRef.current[otherId] || '') : '';

    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 40).duration(320)}>
        <TouchableOpacity
          style={[
            styles.chatItem,
            {
              backgroundColor: isDark ? LL.darkCard : LL.white,
              borderColor: isDark ? LL.darkBorder : LL.lightBorder,
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (otherId) navigation.navigate('Chat', { chatId: otherId } as any);
          }}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // Simple confirm + delete. Uses `deleteChat` from FamilyChatContext
            // which hides the chat per-user AND physically deletes the
            // direct-chat row + messages.
            const proceed = () => {
              deleteChat(item.id);
            };
            // Reuse native Alert rather than SweetAlert here so the
            // long-press flow stays snappy and doesn't need extra state.
            const { Alert } = require('react-native');
            Alert.alert(
              'Delete Conversation',
              `Delete your conversation with ${participant?.displayName || item.name}? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: proceed },
              ],
            );
          }}
          activeOpacity={0.85}
        >
          {/* Aura avatar */}
          <View style={styles.avatarContainer}>
            {isOnline && (
              <LinearGradient
                colors={[LL.success, '#34d399', '#6ee7b7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarAura}
              />
            )}
            <View
              style={[
                styles.avatarInner,
                { backgroundColor: isDark ? LL.darkCard : LL.white },
              ]}
            >
              <SafeAvatar
                avatar={participant?.avatar}
                size={48}
                fallbackIcon="person"
                fallbackColor={LL.primary}
                fallbackBgColor={`${LL.primary}20`}
              />
            </View>
            {isOnline && (
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: LL.success, borderColor: isDark ? LL.darkCard : LL.white },
                ]}
              />
            )}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, { color: isDark ? LL.white : LL.gray900 }]}
                numberOfLines={1}
              >
                {participant?.displayName || item.name || 'Conversation'}
              </Text>
              {!!liveRoleBadge && (
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor:
                        liveRoleBadge === 'Primary Parent' ? `${LL.primary}18`
                        : liveRoleBadge === 'Co-Parent' ? `${LL.accent}18`
                        : liveRoleBadge === 'Guardian' ? `${LL.success}18`
                        : `${LL.gray400}18`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBadgeText,
                      {
                        color:
                          liveRoleBadge === 'Primary Parent' ? LL.primary
                          : liveRoleBadge === 'Co-Parent' ? LL.accent
                          : liveRoleBadge === 'Guardian' ? LL.success
                          : LL.gray400,
                      },
                    ]}
                  >
                    {liveRoleBadge}
                  </Text>
                </View>
              )}
              <Text style={[styles.time, { color: isDark ? LL.gray500 : LL.gray500 }]}>
                {formatTime(item.updatedAt)}
              </Text>
            </View>

            <View style={styles.messageRow}>
              <Text
                style={[styles.lastMessage, { color: isDark ? LL.gray400 : LL.gray500 }]}
                numberOfLines={1}
              >
                {isMyMessage && (
                  <Text style={{ color: isDark ? LL.gray500 : LL.gray500 }}>You: </Text>
                )}
                {lastMessage?.type === 'image'
                  ? '📷 Photo'
                  : lastMessage?.type === 'file'
                  ? '📎 File'
                  : lastMessage?.content || 'Say hello 👋'}
              </Text>
              {item.unreadCount > 0 && (
                <LinearGradient
                  colors={[LL.accent, LL.accentLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.unreadBadge}
                >
                  <Text style={styles.unreadText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={isDark ? LL.gray600 : LL.gray300} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Aura bg */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'transparent']
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
            backgroundColor: isDark ? LL.darkSurface : LL.white,
            borderBottomColor: isDark ? LL.darkBorder : LL.lightBorder,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.backBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 },
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={isDark ? LL.white : LL.gray900} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {isSearching ? (
              <View
                style={[
                  styles.searchInner,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 },
                ]}
              >
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
                <Text style={[styles.title, { color: isDark ? LL.white : LL.gray900 }]}>
                  Messages
                </Text>
                {totalUnread > 0 && (
                  <LinearGradient
                    colors={[LL.accent, LL.accentLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerBadge}
                  >
                    <Text style={styles.headerBadgeText}>
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </Text>
                  </LinearGradient>
                )}
              </>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.backBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 },
            ]}
            onPress={() => {
              if (isSearching) {
                setIsSearching(false);
                setSearchQuery('');
              } else {
                setIsSearching(true);
              }
            }}
          >
            <Ionicons name={isSearching ? 'close' : 'search'} size={20} color={isDark ? LL.white : LL.gray900} />
          </TouchableOpacity>

          {/* Cross-link: jump to the family-chat list */}
          <TouchableOpacity
            style={[
              styles.backBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100, marginLeft: 8 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const rootNav = (navigation as any).getParent?.()?.getParent?.() ?? navigation;
              rootNav.navigate('FamilyChatList');
            }}
            accessibilityLabel="Open family chats"
          >
            <Ionicons name="people" size={20} color={LL.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        updateCellsBatchingPeriod={40}
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
              colors={
                isDark
                  ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)']
                  : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)']
              }
              style={styles.emptyIconBg}
            >
              <Ionicons
                name={searchQuery ? 'search-outline' : 'chatbubbles-outline'}
                size={40}
                color={LL.primary}
              />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: isDark ? LL.white : LL.gray800 }]}>
              {searchQuery ? 'No chats found' : 'No messages yet'}
            </Text>
            <Text style={[styles.emptyText, { color: isDark ? LL.gray400 : LL.gray500 }]}>
              {searchQuery
                ? 'Try a different search term'
                : 'Start chatting with other parents in the community!'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => navigation.popToTop()}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[LL.primary, LL.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.exploreBtnGrad}
                >
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

/* ═══════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingTop: 60,
    paddingBottom: LL.space.md,
    paddingHorizontal: LL.space.lg,
    borderBottomWidth: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerBadge: {
    borderRadius: LL.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  headerBadgeText: { color: LL.white, fontSize: 11, fontWeight: '800' },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.full,
    paddingHorizontal: LL.space.md,
    paddingVertical: LL.space.sm,
    gap: LL.space.sm,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },

  list: { paddingHorizontal: LL.space.lg, paddingBottom: 100, paddingTop: LL.space.sm },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.xl,
    padding: LL.space.lg,
    marginBottom: LL.space.md,
    borderWidth: 1,
    ...LL.shadow.sm,
  },
  avatarContainer: { position: 'relative', marginRight: LL.space.md },
  avatarAura: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  name: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1, flex: 1, marginRight: 8 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  time: { fontSize: 11, fontWeight: '500' },
  messageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 13, flex: 1, marginRight: LL.space.sm, fontWeight: '500' },
  unreadBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: { color: LL.white, fontSize: 11, fontWeight: '800' },

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
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: LL.space.sm, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', marginBottom: LL.space.xl, lineHeight: 22, fontWeight: '500' },
  exploreBtn: { borderRadius: LL.radius.full, overflow: 'hidden', ...LL.shadow.sm },
  exploreBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
    paddingHorizontal: LL.space.xl,
    paddingVertical: LL.space.md,
  },
  exploreText: { color: LL.white, fontSize: 13, fontWeight: '800' },
});