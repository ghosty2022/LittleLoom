import React, { useCallback, useEffect, useState } from 'react';

import { useCommunity, CommunityUser } from '../../context/CommunityContext';
import { Dimensions, FlatList, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner, CommunitySpinner } from '../../components/UniversalSpinner';

import {
  CommunityColors,
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows,
} from '../../theme/CommunityTheme';

type FollowingScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Following'>;

const { width } = Dimensions.get('window');

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

export default function FollowingScreen({ navigation, route }: FollowingScreenProps) {
  const { userId } = route.params;
  const { currentUser, unfollowUser, blockUser, isUserBlocked, getUserById, getFollowing } = useCommunity();

  const {
    shouldReduceMotion,
    triggerHaptic,
    spinnerColor,
  } = useCustomization();

  const sweetAlert = useSweetAlert();

  const [followingList, setFollowingList] = useState<CommunityUser[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<CommunityUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unfollowLoading, setUnfollowLoading] = useState<Record<string, boolean>>({});

  const isOwnProfile = userId === currentUser?.id;

  const loadFollowing = useCallback(async () => {
    setLoading(true);
    try {
      const followingIds: string[] = await getFollowing(userId);
      const resolved: CommunityUser[] = [];
      const seen = new Set<string>();

      for (const id of followingIds) {
        if (seen.has(id)) continue;
        seen.add(id);

        if (id === 'littleloom_team') {
          resolved.push(LITTLELOOM_TEAM);
        } else if (id === currentUser?.id && currentUser) {
          resolved.push(currentUser);
        } else {
          const user = getUserById(id);
          if (user) resolved.push(user);
        }
      }

      setFollowingList(resolved);
      setFilteredFollowing(resolved);
    } catch (error) {
      console.error('Error loading following:', error);
      sweetAlert.alert('Load Failed', 'Failed to load following list', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser, getFollowing, getUserById, sweetAlert]);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFollowing(followingList);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = followingList.filter(f => 
        f.displayName.toLowerCase().includes(query) ||
        f.handle.toLowerCase().includes(query) ||
        (f.bio && f.bio.toLowerCase().includes(query))
      );
      setFilteredFollowing(filtered);
    }
  }, [searchQuery, followingList]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowing();
    setRefreshing(false);
  };

  const handleUnfollow = async (user: CommunityUser) => {
    if (user.id === 'littleloom_team') {
      triggerHaptic('error');
      sweetAlert.alert('Cannot Unfollow', 'Cannot unfollow LittleLoom Team', 'error');
      return;
    }

    if (unfollowLoading[user.id]) return;

    setUnfollowLoading(prev => ({ ...prev, [user.id]: true }));
    triggerHaptic('light');

    try {
      await unfollowUser(user.id);

      if (isOwnProfile) {
        setFollowingList(prev => prev.filter(f => f.id !== user.id));
        setFilteredFollowing(prev => prev.filter(f => f.id !== user.id));
      } else {
        setFollowingList(prev => prev.map(f => 
          f.id === user.id ? { ...f, isFollowing: false } : f
        ));
        setFilteredFollowing(prev => prev.map(f => 
          f.id === user.id ? { ...f, isFollowing: false } : f
        ));
      }

      sweetAlert.alert('Unfollowed', `You unfollowed ${user.displayName}`, 'success');
    } catch (error) {
      console.error('Unfollow error:', error);
      sweetAlert.alert('Action Failed', 'Failed to unfollow user', 'error');
    } finally {
      setUnfollowLoading(prev => ({ ...prev, [user.id]: false }));
    }
  };

  const handleUserPress = (followingId: string) => {
    if (followingId === currentUser?.id) {
      navigation.goBack();
    } else {
      navigation.push('CommunityMemberProfile', { userId: followingId });
    }
  };

  const handleMoreOptions = (user: CommunityUser) => {
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
              'success'
            );
          })
          .catch(() => {
            sweetAlert.alert('Action Failed', 'Failed to block user', 'error');
          });
      },
      () => {},
      blocked ? 'Unblock' : 'Block',
      'Cancel'
    );
  };

  const renderFollowing = ({ item, index }: { item: CommunityUser; index: number }) => {
    const blocked = isUserBlocked(item.id);
    const isMe = item.id === currentUser?.id;
    const isTeam = item.id === 'littleloom_team';

    return (
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 30)}>
        <TouchableOpacity 
          style={styles.userCard}
          onPress={() => handleUserPress(item.id)}
          activeOpacity={0.8}
        >
          <View style={styles.avatarContainer}>
            <SafeAvatar
              avatar={item.avatar}
              size={44}
              fallbackIcon="person"
              fallbackColor={CommunityColors.primary}
              fallbackBgColor={CommunityColors.primary + '20'}
              borderWidth={2}
              borderColor={item.onlineStatus === 'online' ? CommunityColors.success : '#fff'}
            />
            {item.onlineStatus === 'online' && (
              <View style={styles.onlineDot} />
            )}
          </View>

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {item.displayName}
              </Text>
              {item.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={CommunityColors.primary} />
              )}
              {isTeam && (
                <View style={styles.teamBadge}>
                  <Text style={styles.teamBadgeText}>Team</Text>
                </View>
              )}
            </View>
            <Text style={styles.handle} numberOfLines={1}>{item.handle}</Text>
            {item.bio && (
              <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>
            )}
          </View>

          {!isMe && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  blocked && styles.blockedBtn,
                  unfollowLoading[item.id] && styles.loadingBtn,
                  isTeam && styles.teamBtn
                ]}
                onPress={() => handleUnfollow(item)}
                disabled={unfollowLoading[item.id] || blocked || isTeam}
              >
                {unfollowLoading[item.id] ? (
                  <InlineSpinner size={14} color={CommunityColors.text.primary} section="community" />
                ) : (
                  <Text style={[
                    styles.followBtnText,
                    blocked && styles.blockedBtnText,
                    isTeam && styles.teamBtnText
                  ]}>
                    {isTeam ? 'Following' : blocked ? 'Blocked' : 'Unfollow'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreBtn}
                onPress={() => handleMoreOptions(item)}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={CommunityColors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )}

          {isMe && (
            <View style={styles.youBadge}>
              <Text style={styles.youText}>You</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="person-add-outline" size={64} color={CommunityColors.text.tertiary} />
      <Text style={styles.emptyTitle}>Not following anyone yet</Text>
      <Text style={styles.emptyText}>
        {isOwnProfile 
          ? "Start following people to see their posts in your feed."
          : "This user isn't following anyone yet."
        }
      </Text>
      {isOwnProfile && (
        <TouchableOpacity 
          style={styles.exploreBtn}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.exploreText}>Explore Community</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <LinearGradient colors={CommunityColors.background.gradient} style={[styles.container]}>
      <StatusBar barStyle="dark-content" />

      <CommunitySpinner
        visible={loading && followingList.length === 0}
        text="Loading..."
        size="medium"
        overlay={false}
        variant="liquid"
      />

      <BlurView intensity={95} style={styles.header} tint="light">
        <LinearGradient 
          colors={['rgba(255,255,255,0.98)', 'rgba(255,250,250,0.95)']} 
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={CommunityColors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Following</Text>
          <Text style={styles.headerSubtitle}>{followingList.length.toLocaleString()}</Text>
        </View>

        <View style={styles.headerButton} />
      </BlurView>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color={CommunityColors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search following"
            placeholderTextColor={CommunityColors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={CommunityColors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredFollowing}
        renderItem={renderFollowing}
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
        ListEmptyComponent={!loading ? renderEmpty : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingHorizontal: CommunitySpacing.md,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.divider,
    overflow: 'hidden',
  },
  headerButton: { padding: 8, width: 40 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: CommunityColors.text.primary },
  headerSubtitle: { fontSize: 13, color: CommunityColors.text.secondary, marginTop: 2 },
  searchContainer: {
    paddingHorizontal: CommunitySpacing.lg,
    paddingVertical: 12,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: CommunityColors.text.primary,
    paddingVertical: 2,
  },
  listContainer: { paddingHorizontal: CommunitySpacing.lg, paddingBottom: 40 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatarContainer: { 
    position: 'relative', 
    marginRight: 12 
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CommunityColors.success,
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  displayName: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: CommunityColors.text.primary 
  },
  teamBadge: {
    backgroundColor: CommunityColors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  teamBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: CommunityColors.primary,
  },
  handle: { 
    fontSize: 13, 
    color: CommunityColors.text.secondary, 
    marginTop: 1 
  },
  bio: { 
    fontSize: 12, 
    color: CommunityColors.text.tertiary, 
    marginTop: 2 
  },
  actions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  followBtn: {
    backgroundColor: CommunityColors.background.card,
    borderWidth: 1,
    borderColor: CommunityColors.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  teamBtn: {
    backgroundColor: CommunityColors.primary + '15',
    borderColor: CommunityColors.primary + '30',
  },
  blockedBtn: {
    backgroundColor: CommunityColors.error + '15',
    borderColor: CommunityColors.error,
  },
  loadingBtn: { opacity: 0.6 },
  followBtnText: { 
    color: CommunityColors.text.primary, 
    fontSize: 13, 
    fontWeight: '700' 
  },
  teamBtnText: {
    color: CommunityColors.primary,
  },
  blockedBtnText: { 
    color: CommunityColors.error 
  },
  moreBtn: { padding: 4 },
  youBadge: {
    backgroundColor: CommunityColors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  youText: { 
    color: CommunityColors.primary, 
    fontSize: 12, 
    fontWeight: '700' 
  },
  separator: {
    height: 1,
    backgroundColor: CommunityColors.divider,
    marginLeft: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { 
    fontSize: 16, 
    color: CommunityColors.text.secondary 
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
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
  },
  exploreBtn: {
    marginTop: 24,
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  exploreText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '700' 
  },
});