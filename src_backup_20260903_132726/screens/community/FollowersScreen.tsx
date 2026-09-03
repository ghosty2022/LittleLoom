import React, { useCallback, useEffect, useState } from 'react';

import { useCommunity } from '../../context/CommunityContext';
import { Dimensions, FlatList, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useUser } from '../../context/UserContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner, CommunitySpinner } from '../../components/UniversalSpinner';

import {
  CommunityColors,
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows,
} from '../../theme/CommunityTheme';

type FollowersScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Followers'>;

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

export default function FollowersScreen({ navigation, route }: FollowersScreenProps) {
  const { userId } = route.params;
  const { currentUser, followUser, unfollowUser, isFollowing, blockUser, isUserBlocked, getUserById, getFollowers } = useCommunity();
  const { profile } = useUser();
  const sweetAlert = useSweetAlert();

  // Guard against undefined functions
  const safeIsUserBlocked = useCallback((userId: string) => {
    return isUserBlocked ? isUserBlocked(userId) : false;
  }, [isUserBlocked]);

  const [followers, setFollowers] = useState<CommunityUser[]>([]);
  const [filteredFollowers, setFilteredFollowers] = useState<CommunityUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  const isOwnProfile = userId === currentUser?.id;

  const loadFollowers = useCallback(async () => {
    setLoading(true);
    try {
      const followerIds: string[] = await getFollowers(userId);
      const resolved: CommunityUser[] = [];
      const seen = new Set<string>();

      for (const id of followerIds) {
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

      setFollowers(resolved);
      setFilteredFollowers(resolved);
    } catch (error) {
      console.error('Error loading followers:', error);
      sweetAlert.alert('Load Failed', 'Failed to load followers list', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser, getFollowers, getUserById, sweetAlert]);

  useEffect(() => {
    loadFollowers();
  }, [loadFollowers]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFollowers(followers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = followers.filter(f => 
        f.displayName.toLowerCase().includes(query) ||
        f.handle.toLowerCase().includes(query) ||
        (f.bio && f.bio.toLowerCase().includes(query))
      );
      setFilteredFollowers(filtered);
    }
  }, [searchQuery, followers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFollowers();
    setRefreshing(false);
  };

  const handleFollowToggle = async (follower: CommunityUser) => {
    if (followLoading[follower.id]) return;

    setFollowLoading(prev => ({ ...prev, [follower.id]: true }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const currentlyFollowing = isFollowing(follower.id);

      if (currentlyFollowing) {
        await unfollowUser(follower.id);
      } else {
        await followUser(follower.id);
      }

      setFollowers(prev => prev.map(f => 
        f.id === follower.id 
          ? { ...f, isFollowing: !currentlyFollowing }
          : f
      ));
      setFilteredFollowers(prev => prev.map(f => 
        f.id === follower.id 
          ? { ...f, isFollowing: !currentlyFollowing }
          : f
      ));
    } catch (error) {
      console.error('Follow toggle error:', error);
      sweetAlert.error('Action Failed', 'Failed to update follow status');
    } finally {
      setFollowLoading(prev => ({ ...prev, [follower.id]: false }));
    }
  };

  const handleUserPress = (followerId: string) => {
    if (followerId === currentUser?.id) {
      navigation.goBack();
    } else {
      navigation.push('CommunityMemberProfile', { userId: followerId });
    }
  };

  const handleMoreOptions = (follower: CommunityUser) => {
    const isBlocked = safeIsUserBlocked(follower.id);

    sweetAlert.confirm(
      follower.displayName,
      follower.handle,
      () => {
        blockUser(follower.id)
          .then(() => {
            sweetAlert.alert(
              isBlocked ? 'Unblocked' : 'Blocked',
              isBlocked ? 'User has been unblocked' : 'You will no longer see their content.',
              'success'
            );
          })
          .catch(() => {
            sweetAlert.error('Action Failed', 'Failed to block user');
          });
      },
      () => {},
      isBlocked ? 'Unblock' : 'Block',
      'Cancel'
    );
  };

  const renderFollower = ({ item, index }: { item: CommunityUser; index: number }) => {
    const following = isFollowing(item.id);
    const blocked = safeIsUserBlocked(item.id);
    const isMe = item.id === currentUser?.id;
    const isTeam = item.id === 'littleloom_team';

    return (
      <Animated.View entering={FadeInUp.delay(index * 30)}>
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
                  following && styles.followingBtn,
                  blocked && styles.blockedBtn,
                  followLoading[item.id] && styles.loadingBtn
                ]}
                onPress={() => handleFollowToggle(item)}
                disabled={followLoading[item.id] || blocked}
              >
                {followLoading[item.id] ? (
                  <InlineSpinner size={14} color={following ? CommunityColors.text.primary : '#fff'} section="community" />
                ) : (
                  <Text style={[
                    styles.followBtnText,
                    following && styles.followingBtnText,
                    blocked && styles.blockedBtnText
                  ]}>
                    {blocked ? 'Blocked' : following ? 'Following' : 'Follow'}
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
      <Ionicons name="people-outline" size={64} color={CommunityColors.text.tertiary} />
      <Text style={styles.emptyTitle}>No followers yet</Text>
      <Text style={styles.emptyText}>
        When people follow this account, they will appear here.
      </Text>
    </View>
  );

  return (
    <LinearGradient colors={CommunityColors.background.gradient} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <CommunitySpinner
        visible={loading && followers.length === 0}
        text="Loading followers..."
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
          <Text style={styles.headerTitle}>Followers</Text>
          <Text style={styles.headerSubtitle}>{followers.length.toLocaleString()}</Text>
        </View>

        <View style={styles.headerButton} />
      </BlurView>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color={CommunityColors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search followers"
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
        data={filteredFollowers}
        renderItem={renderFollower}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CommunityColors.primary} />
        }
        ListEmptyComponent={!loading ? renderEmpty : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    overflow: 'hidden',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CommunityColors.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: CommunityBorderRadius.full,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    gap: CommunitySpacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: CommunityColors.text.primary,
    paddingVertical: 4,
  },
  listContainer: {
    padding: CommunitySpacing.md,
    paddingBottom: CommunitySpacing.xxl,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: CommunitySpacing.md,
    backgroundColor: CommunityColors.background.card,
    borderRadius: CommunityBorderRadius.lg,
    ...CommunityShadows.small,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: CommunitySpacing.md,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: CommunityColors.success,
    borderWidth: 2,
    borderColor: CommunityColors.background.card,
  },
  userInfo: {
    flex: 1,
    marginRight: CommunitySpacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.xs,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: CommunityColors.text.primary,
    flexShrink: 1,
  },
  teamBadge: {
    backgroundColor: CommunityColors.primary,
    borderRadius: CommunityBorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  teamBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  handle: {
    fontSize: 13,
    color: CommunityColors.text.tertiary,
    marginTop: 2,
  },
  bio: {
    fontSize: 12,
    color: CommunityColors.text.secondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CommunitySpacing.sm,
  },
  followBtn: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    minWidth: 80,
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: CommunityColors.background.elevated,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  blockedBtn: {
    backgroundColor: CommunityColors.error + '15',
    borderColor: CommunityColors.error,
  },
  loadingBtn: {
    opacity: 0.6,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  followingBtnText: {
    color: CommunityColors.text.primary,
  },
  blockedBtnText: {
    color: CommunityColors.error,
  },
  moreBtn: {
    padding: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
  },
  youBadge: {
    backgroundColor: CommunityColors.background.elevated,
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: CommunitySpacing.sm,
    borderRadius: CommunityBorderRadius.full,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  youText: {
    fontSize: 13,
    fontWeight: '600',
    color: CommunityColors.text.secondary,
  },
  separator: {
    height: CommunitySpacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: CommunityColors.text.tertiary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: CommunitySpacing.xxl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginTop: CommunitySpacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: CommunitySpacing.sm,
    textAlign: 'center',
    paddingHorizontal: CommunitySpacing.xl,
  },
});