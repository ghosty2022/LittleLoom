import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, type CommunityUser } from '../../context/CommunityContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';

type Props = NativeStackScreenProps<CommunityStackParamList, 'Following'>;

const { width: SCREEN_W } = Dimensions.get('window');

const LITTLELOOM_TEAM: CommunityUser = {
  id: 'littleloom_team',
  displayName: 'LittleLoom Team',
  handle: '@littleloom',
  avatar: '🧵',
  isVerified: true,
  bio: 'Welcome to LittleLoom! We are here to help you on your parenting journey.',
  country: 'Global',
  onlineStatus: 'online',
  lastActive: new Date().toISOString(),
  stats: {
    posts: 156,
    followers: 999999,
    following: 0,
    helpful: 4520,
    streakDays: 365,
    lastStreakDate: new Date().toISOString(),
  },
  achievements: ['top_contributor', 'helpful_parent', 'storyteller'],
  isFollowing: true,
};

type SortKey = 'recent' | 'name';
const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'name', label: 'A–Z', icon: 'text-outline' },
];

/* ── The Loom palette ───────────────────────────────────────── */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',
  white: '#ffffff',
  darkBg: '#0c0a09',
  darkCard: '#292524',
  darkSurface: '#1c1917',
  darkBorder: 'rgba(255,255,255,0.06)',
  lightBg: '#fafaf9',
  lightCard: '#ffffff',
  lightBorder: '#e7e5e4',
  gray100: '#f5f5f4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
};

const AuraAvatar = React.memo(
  ({
    user,
    size = 48,
    isDark,
  }: {
    user: CommunityUser;
    size?: number;
    isDark: boolean;
  }) => {
    const isOnline = user.onlineStatus === 'online';
    return (
      <View style={{ width: size + 8, height: size + 8, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={
            isOnline
              ? ['#10b981', '#34d399', '#6ee7b7']
              : isDark
              ? ['rgba(99,102,241,0.35)', 'rgba(236,72,153,0.25)', 'rgba(99,102,241,0.10)']
              : ['rgba(99,102,241,0.28)', 'rgba(236,72,153,0.18)', 'rgba(99,102,241,0.05)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }}
        />
        <View
          style={{
            width: size + 4,
            height: size + 4,
            borderRadius: (size + 4) / 2,
            backgroundColor: isDark ? DS.darkCard : DS.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SafeAvatar
            avatar={user.avatar}
            size={size}
            fallbackIcon="person"
            fallbackColor={DS.primary}
            fallbackBgColor={`${DS.primary}20`}
          />
        </View>
        {isOnline && (
          <View
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 13,
              height: 13,
              borderRadius: 7,
              backgroundColor: DS.success,
              borderWidth: 2,
              borderColor: isDark ? DS.darkCard : DS.white,
            }}
          />
        )}
      </View>
    );
  },
);

const SkeletonRow = React.memo(({ isDark }: { isDark: boolean }) => {
  const bg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const soft = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  return (
    <View
      style={[
        sk.row,
        {
          backgroundColor: isDark ? 'rgba(30,30,45,0.7)' : DS.white,
          borderColor: isDark ? DS.darkBorder : DS.lightBorder,
        },
      ]}
    >
      <View style={[sk.avatar, { backgroundColor: bg }]} />
      <View style={sk.text}>
        <View style={[sk.line, { width: '55%', backgroundColor: bg }]} />
        <View style={[sk.line, { width: '35%', backgroundColor: soft, marginTop: 6 }]} />
        <View style={[sk.line, { width: '70%', backgroundColor: soft, marginTop: 6 }]} />
      </View>
      <View style={[sk.btn, { backgroundColor: bg }]} />
    </View>
  );
});

/* ════════════════════════════════════════════════════════════
   Main
   ════════════════════════════════════════════════════════════ */
export default function FollowingScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const {
    currentUser,
    unfollowUser,
    blockUser,
    isUserBlocked,
    getUserById,
    getFollowing,
  } = useCommunity();

  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();

  const [followingList, setFollowingList] = useState<CommunityUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unfollowLoading, setUnfollowLoading] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  const hasLoadedOnce = useRef(false);
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const isOwnProfile = userId === currentUser?.id;

  const loadFollowing = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const followingIds: string[] = await getFollowing(userId);
      const resolved: CommunityUser[] = [];
      const seen = new Set<string>();

      for (const id of followingIds) {
        if (seen.has(id)) continue;
        seen.add(id);

        if (id === 'littleloom_team') resolved.push(LITTLELOOM_TEAM);
        else if (id === currentUser?.id && currentUser) resolved.push(currentUser);
        else {
          const user = getUserById(id);
          if (user) resolved.push(user);
        }
      }

      if (isMounted.current) setFollowingList(resolved);
    } catch (error) {
      console.error('[FollowingScreen] load error:', error);
      if (isMounted.current) {
        sweetAlert.alert('Load Failed', 'Failed to load following list', 'error');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        hasLoadedOnce.current = true;
      }
    }
  }, [userId, currentUser, getFollowing, getUserById, sweetAlert]);

  useEffect(() => {
    loadFollowing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await loadFollowing(true);
    if (isMounted.current) setRefreshing(false);
  }, [loadFollowing, triggerHaptic]);

  const handleUnfollow = useCallback(
    async (user: CommunityUser) => {
      if (user.id === 'littleloom_team') {
        triggerHaptic('error');
        sweetAlert.alert('Cannot Unfollow', 'You cannot unfollow LittleLoom Team.', 'warning');
        return;
      }
      if (unfollowLoading[user.id]) return;

      setUnfollowLoading((prev) => ({ ...prev, [user.id]: true }));
      triggerHaptic('light');

      try {
        await unfollowUser(user.id);
        if (isMounted.current) {
          setFollowingList((prev) => prev.filter((f) => f.id !== user.id));
        }
        sweetAlert.toast('Unfollowed', `You unfollowed ${user.displayName}`);
      } catch (err) {
        console.error('[FollowingScreen] unfollow error:', err);
        sweetAlert.alert('Action Failed', 'Failed to unfollow user', 'error');
      } finally {
        if (isMounted.current) {
          setUnfollowLoading((prev) => ({ ...prev, [user.id]: false }));
        }
      }
    },
    [unfollowLoading, unfollowUser, sweetAlert, triggerHaptic],
  );

  const handleUserPress = useCallback(
    (id: string) => {
      triggerHaptic('light');
      if (id === currentUser?.id) navigation.navigate('CommunityProfile');
      else navigation.push('CommunityMemberProfile', { userId: id });
    },
    [currentUser?.id, navigation, triggerHaptic],
  );

  const handleMoreOptions = useCallback(
    (user: CommunityUser) => {
      const blocked = isUserBlocked(user.id);
      sweetAlert.confirm(
        user.displayName,
        user.handle,
        () => {
          blockUser(user.id)
            .then(() => {
              sweetAlert.alert(
                blocked ? 'Unblocked' : 'Blocked',
                blocked ? 'User has been unblocked' : 'User blocked',
                'success',
              );
            })
            .catch(() => sweetAlert.alert('Action Failed', 'Failed to block user', 'error'));
        },
        () => {},
        blocked ? 'Unblock' : 'Block',
        'Cancel',
      );
    },
    [blockUser, isUserBlocked, sweetAlert],
  );

  /* Filter + sort */
  const visibleFollowing = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = followingList;

    if (q) {
      list = list.filter(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          f.handle.toLowerCase().includes(q) ||
          (f.bio && f.bio.toLowerCase().includes(q)),
      );
    }

    if (sortKey === 'name') {
      list = [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    return list;
  }, [followingList, searchQuery, sortKey]);

  const renderFollowing = useCallback(
    ({ item, index }: { item: CommunityUser; index: number }) => {
      const blocked = isUserBlocked(item.id);
      const isMe = item.id === currentUser?.id;
      const isTeam = item.id === 'littleloom_team';

      return (
        <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 40).duration(320)}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleUserPress(item.id)}
            onLongPress={() => handleMoreOptions(item)}
            delayLongPress={350}
            style={[
              s.card,
              {
                backgroundColor: isDark ? 'rgba(30,30,45,0.85)' : DS.white,
                borderColor: isDark ? DS.darkBorder : DS.lightBorder,
              },
            ]}
          >
            <AuraAvatar user={item} size={48} isDark={isDark} />

            <View style={s.info}>
              <View style={s.nameRow}>
                <Text
                  style={[s.name, { color: isDark ? DS.white : DS.gray900 }]}
                  numberOfLines={1}
                >
                  {item.displayName}
                </Text>
                {item.isVerified && (
                  <Ionicons name="checkmark-circle" size={14} color={DS.primary} />
                )}
                {isTeam && (
                  <View style={[s.teamBadge, { backgroundColor: `${DS.primary}20` }]}>
                    <Text style={[s.teamBadgeText, { color: DS.primary }]}>TEAM</Text>
                  </View>
                )}
              </View>
              <Text
                style={[s.handle, { color: isDark ? DS.gray400 : DS.gray500 }]}
                numberOfLines={1}
              >
                {item.handle}
              </Text>
              {item.bio ? (
                <Text
                  style={[s.bio, { color: isDark ? DS.gray400 : DS.gray500 }]}
                  numberOfLines={1}
                >
                  {item.bio}
                </Text>
              ) : null}
            </View>

            {isMe ? (
              <View
                style={[
                  s.youBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : `${DS.primary}10`,
                    borderColor: isDark ? DS.darkBorder : `${DS.primary}25`,
                  },
                ]}
              >
                <Text style={[s.youBadgeText, { color: DS.primary }]}>You</Text>
              </View>
            ) : (
              <View style={s.actions}>
                <TouchableOpacity
                  onPress={() => handleUnfollow(item)}
                  disabled={unfollowLoading[item.id] || blocked || isTeam}
                  activeOpacity={0.8}
                  style={[
                    s.unfollowBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100,
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : DS.lightBorder,
                    },
                    isTeam && {
                      backgroundColor: `${DS.primary}12`,
                      borderColor: `${DS.primary}30`,
                    },
                    blocked && {
                      backgroundColor: 'rgba(239,68,68,0.10)',
                      borderColor: 'rgba(239,68,68,0.30)',
                    },
                    unfollowLoading[item.id] && { opacity: 0.55 },
                  ]}
                >
                  {unfollowLoading[item.id] ? (
                    <InlineSpinner size={12} color={DS.gray700} section="community" />
                  ) : (
                    <Text
                      style={[
                        s.unfollowBtnText,
                        { color: isDark ? DS.gray300 : DS.gray700 },
                        isTeam && { color: DS.primary },
                        blocked && { color: DS.danger },
                      ]}
                      numberOfLines={1}
                    >
                      {isTeam ? 'Following' : blocked ? 'Blocked' : 'Unfollow'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    s.moreBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : DS.gray100,
                    },
                  ]}
                  onPress={() => handleMoreOptions(item)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={16}
                    color={isDark ? DS.gray400 : DS.gray500}
                  />
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [
      isDark,
      currentUser?.id,
      isUserBlocked,
      unfollowLoading,
      handleUnfollow,
      handleUserPress,
      handleMoreOptions,
    ],
  );

  const renderEmpty = () => {
    if (loading && !hasLoadedOnce.current) return null;
    return (
      <Animated.View entering={FadeIn.duration(280)} style={s.emptyWrap}>
        <LinearGradient
          colors={isDark ? ['#4c1d95', '#831843'] : ['#e0e7ff', '#fbcfe8']}
          style={s.emptyIcon}
        >
          <Ionicons name="person-add-outline" size={36} color={DS.primary} />
        </LinearGradient>
        <Text style={[s.emptyTitle, { color: isDark ? DS.white : DS.gray800 }]}>
          {searchQuery ? 'No matches' : 'Not following anyone yet'}
        </Text>
        <Text style={[s.emptyText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
          {searchQuery
            ? 'Try a different name or handle.'
            : isOwnProfile
            ? 'Start following parents to build your feed.'
            : "This parent isn't following anyone yet."}
        </Text>
        {isOwnProfile && !searchQuery && (
          <TouchableOpacity
            onPress={() => navigation.navigate('SearchUsers', {})}
            activeOpacity={0.85}
            style={s.exploreBtn}
          >
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.exploreBtnGrad}
            >
              <Ionicons name="compass" size={16} color={DS.white} />
              <Text style={s.exploreBtnText}>Discover Parents</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const showSkeleton = loading && !hasLoadedOnce.current;
  const headerCount = followingList.length;

  return (
    <View style={[s.container, { backgroundColor: isDark ? DS.darkBg : DS.lightBg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient
        colors={
          isDark
            ? ['rgba(236,72,153,0.08)', 'rgba(99,102,241,0.06)', 'transparent']
            : ['rgba(236,72,153,0.05)', 'rgba(99,102,241,0.03)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={s.header}>
        <View style={[s.headerInner, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons
              name="arrow-back"
              size={22}
              color={isDark ? DS.white : DS.gray900}
            />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: isDark ? DS.white : DS.gray900 }]}>
              Following
            </Text>
            <Text style={[s.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>
              {headerCount.toLocaleString()} {headerCount === 1 ? 'account' : 'accounts'}
            </Text>
          </View>
          <View style={s.headerBtn} />
        </View>

        <View style={s.searchWrap}>
          <View
            style={[
              s.searchBar,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white,
                borderColor: isDark ? DS.darkBorder : DS.lightBorder,
              },
            ]}
          >
            <Ionicons name="search" size={16} color={isDark ? DS.gray400 : DS.gray500} />
            <TextInput
              style={[s.searchInput, { color: isDark ? DS.white : DS.gray900 }]}
              placeholder="Search following"
              placeholderTextColor={isDark ? DS.gray500 : DS.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={isDark ? DS.gray400 : DS.gray500} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={s.sortRow}>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  triggerHaptic('light');
                  setSortKey(opt.key);
                }}
                activeOpacity={0.75}
                style={[
                  s.sortPill,
                  {
                    backgroundColor: active
                      ? DS.primary
                      : isDark
                      ? 'rgba(255,255,255,0.04)'
                      : DS.white,
                    borderColor: active
                      ? DS.primary
                      : isDark
                      ? DS.darkBorder
                      : DS.lightBorder,
                  },
                ]}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={12}
                  color={active ? DS.white : isDark ? DS.gray400 : DS.gray500}
                />
                <Text
                  style={[
                    s.sortText,
                    { color: active ? DS.white : isDark ? DS.gray400 : DS.gray500 },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>

      {showSkeleton ? (
        <View style={s.listContainer}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} isDark={isDark} />
          ))}
        </View>
      ) : (
        <FlatList
          data={visibleFollowing}
          renderItem={renderFollowing}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.listContainer,
            { paddingBottom: insets.bottom + 32 },
            visibleFollowing.length === 0 && { flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={DS.primary}
              colors={[DS.primary]}
              progressBackgroundColor={isDark ? DS.darkSurface : DS.white}
            />
          }
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          removeClippedSubviews
          initialNumToRender={12}
          windowSize={7}
          maxToRenderPerBatch={10}
        />
      )}
    </View>
  );
}

const sk = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  text: { flex: 1 },
  line: { height: 10, borderRadius: 5 },
  btn: { width: 82, height: 32, borderRadius: 16 },
});

const s = StyleSheet.create({
  container: { flex: 1 },

  header: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120,120,120,0.10)',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  searchWrap: { paddingHorizontal: 16, paddingTop: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },

  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  listContainer: { padding: 16 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  info: { flex: 1, marginLeft: 12, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  handle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  bio: { fontSize: 12, fontWeight: '500', marginTop: 3 },

  teamBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  teamBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unfollowBtn: {
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unfollowBtnText: { fontSize: 12, fontWeight: '800' },

  moreBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  youBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  youBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
  exploreBtn: {
    marginTop: 20,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  exploreBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  exploreBtnText: { color: DS.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
});