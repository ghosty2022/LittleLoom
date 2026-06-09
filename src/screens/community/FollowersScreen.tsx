import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';

import { useCommunity, CommunityUser } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useSweetAlert } from '../../components/SweetAlert';
import { InlineSpinner, CommunitySpinner } from '../../components/UniversalSpinner';

import { AutoHideFlatList } from '../../components/AutoHideScrollWrappers';
import { CommunityColors, CommunitySpacing, CommunityBorderRadius, CommunityShadows } from '../../theme/CommunityTheme';

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

const generateDemoFollowers = (count: number, baseId: string): CommunityUser[] => {
  const names = [
    'Sarah Johnson', 'Mike Chen', 'Emma Wilson', 'David Park', 'Lisa Brown',
    'James Miller', 'Anna Garcia', 'Robert Taylor', 'Jennifer Lee', 'Chris Davis',
    'Maria Rodriguez', 'Kevin White', 'Amanda Martinez', 'Daniel Anderson', 'Rachel Kim',
    'Thomas Wright', 'Laura Thompson', 'Ryan Jackson', 'Sophie Clark', 'Alex Turner',
    'Nina Patel', 'Jordan Brooks', 'Maya Singh', 'Leo Fernandez', 'Zoe Mitchell',
    'Ethan Cooper', 'Chloe Adams', 'Lucas Rivera', 'Isabella Nguyen', 'Mason Phillips',
  ];

  const avatars = ['👩', '👨', '👧', '👦', '👵', '👴', '👱‍♀️', '👱‍♂️', '🧑', '👳‍♀️', '👳‍♂️', '👲', '👮‍♀️', '👮‍♂️', '👷‍♀️', '👷‍♂️', '💂‍♀️', '💂‍♂️', '🕵️‍♀️', '🕵️‍♂️', '👩‍⚕️', '👨‍⚕️', '👩‍🌾', '👨‍🌾', '👩‍🍳', '👨‍🍳', '👩‍🎓', '👨‍🎓', '👩‍🎤', '👨‍🎤'];

  const bios = [
    'Proud parent of two 👶👶',
    'First-time mom sharing my journey',
    'Dad blogger & coffee enthusiast ☕',
    'Parenting tips & toddler life 🧸',
    'Working mom, making it work 💪',
    'Stay-at-home dad adventures',
    'Newborn photographer & mom 📸',
    'Twin mom, double the love 💕',
    'Homeschooling parent 🎓',
    'Organic living & parenting 🌱',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `follower_${baseId}_${i}`,
    displayName: names[i % names.length],
    handle: `@${names[i % names.length].toLowerCase().replace(/\s+/g, '_')}_${Math.floor(Math.random() * 999)}`,
    avatar: avatars[i % avatars.length],
    isVerified: i % 7 === 0,
    bio: bios[i % bios.length],
    country: ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'India'][i % 8],
    onlineStatus: i % 3 === 0 ? 'online' : i % 5 === 0 ? 'away' : 'offline',
    lastActive: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
    stats: {
      posts: Math.floor(Math.random() * 500),
      followers: Math.floor(Math.random() * 5000),
      following: Math.floor(Math.random() * 1000),
      helpful: Math.floor(Math.random() * 200),
      streakDays: Math.floor(Math.random() * 60),
      lastStreakDate: new Date().toISOString(),
    },
    achievements: [],
    isFollowing: i % 4 === 0,
  }));
};

export default function FollowersScreen({ navigation, route }: FollowersScreenProps) {
  const { userId } = route.params;
  const { currentUser, followUser, unfollowUser, isFollowing, blockUser, isUserBlocked, getUserById, getFollowers } = useCommunity();
  const { profile } = useUser();
  
  // SweetAlert for all alerts
  const sweetAlert = useSweetAlert();

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
      await new Promise(resolve => setTimeout(resolve, 600));

      let demoFollowers = [LITTLELOOM_TEAM];

      let actualFollowers: string[] = [];
      try {
        actualFollowers = await getFollowers(userId);
      } catch (e) {
        console.log('Could not load persisted followers:', e);
      }

      const targetUser = getUserById(userId);
      const count = targetUser?.stats?.followers || Math.floor(Math.random() * 50) + 10;

      const additionalFollowers = generateDemoFollowers(Math.min(count, 30), userId);

      demoFollowers = [...demoFollowers, ...additionalFollowers];
      const seen = new Set<string>();
      const uniqueFollowers = demoFollowers.filter((user) => {
        if (seen.has(user.id)) return false;
        seen.add(user.id);
        return true;
      });

      setFollowers(uniqueFollowers);
      setFilteredFollowers(uniqueFollowers);
    } catch (error) {
      console.error('Error loading followers:', error);
      sweetAlert.error('Load Failed', 'Failed to load followers list');
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
      navigation.push('UserProfile', { userId: followerId });
    }
  };

  const handleMoreOptions = (follower: CommunityUser) => {
    const isBlocked = isUserBlocked(follower.id);

    sweetAlert.confirm(
      follower.displayName,
      follower.handle,
      () => {
        // Block/Unblock action
        blockUser(follower.id)
          .then(() => {
            sweetAlert.success(
              isBlocked ? 'Unblocked' : 'Blocked',
              isBlocked ? 'User has been unblocked' : 'You will no longer see their content.'
            );
          })
          .catch(() => {
            sweetAlert.error('Action Failed', 'Failed to block user');
          });
      },
      () => {}, // Cancel
      isBlocked ? 'Unblock' : 'Block',
      'Cancel'
    );
  };

  const renderFollower = ({ item, index }: { item: CommunityUser; index: number }) => {
    const following = isFollowing(item.id);
    const blocked = isUserBlocked(item.id);
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
            {/* REPLACED: RenderAvatar → SafeAvatar */}
            <SafeAvatar
              avatar={item.avatar}
              size={44}
              fallbackIcon="person"
              fallbackColor={CommunityColors.primary}
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

      {/* Loading Spinner */}
      <CommunitySpinner
        visible={loading && followers.length === 0}
        text="Loading followers..."
        size="medium"
        overlay={false}
        variant="liquid"
      />

      {/* Header */}
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

      {/* Search Bar */}
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

      {/* Followers List */}
      <AutoHideFlatList
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