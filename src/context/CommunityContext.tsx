// src/context/CommunityContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useUser } from './UserContext';
import { showSuccessModal, showErrorModal, showConfirmModal } from '../utils/modal';
import UniversalSpinner from '../components/UniversalSpinner';

// ─── Storage Keys ───────────────────────────────────────────────
const STORAGE_KEYS = {
  POSTS: '@community_posts_v2',
  TOPICS: '@community_topics_v2',
  LIKES: '@community_likes_v2',
  BOOKMARKS: '@community_bookmarks_v2',
  REPOSTS: '@community_reposts_v2',
  FOLLOWS: '@community_follows_v2',
  COMMENTS: '@community_comments_v2',
  MESSAGES: '@community_messages_v2',
  NOTIFICATIONS: '@community_notifications_v2',
  USER_STATS: '@community_user_stats_v2',
  LAST_SYNC: '@community_last_sync_v2',
  BLOCKED_USERS: '@community_blocked_users_v2',
  ONBOARDING: '@littleloom_community_onboarding_v3',
  SELECTED_TOPICS: '@community_selected_topics_v2',
  USER_FOLLOWERS: '@community_user_followers_v2',
  USER_FOLLOWING: '@community_user_following_v2',
  USER_PROFILES: '@community_user_profiles_v2',
  INTERACTIONS_VERSION: '@community_interactions_version',
};

// ─── Types ────────────────────────────────────────────────────
export type OnlineStatus = 'online' | 'offline' | 'away';

export interface CommunityUser {
  id: string;
  displayName: string;
  handle: string;
  avatar: string;
  isVerified: boolean;
  bio?: string;
  location?: string;
  country?: string;
  onlineStatus: OnlineStatus;
  lastActive: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
    helpful: number;
    streakDays: number;
    lastStreakDate: string;
  };
  isFollowing?: boolean;
  achievements: string[];
  selectedTopics?: string[];
  followers?: string[];  // NEW: Track follower IDs
  following?: string[];  // NEW: Track following IDs
}

export interface Comment {
  id: string;
  authorId: string;
  author: CommunityUser;
  content: string;
  likes: number;
  likedBy: string[];
  isLiked: boolean;
  time: string;
  timestamp: string;
  replies?: Comment[];
  helpfulVotes: number;
  votedHelpfulBy: string[];
}

export interface Post {
  id: string;
  authorId: string;
  author: CommunityUser;
  topic: string;
  topicId: string;
  content: string;
  images?: string[];
  likes: number;
  likedBy: string[];
  comments: Comment[];
  commentsCount: number;
  reposts: number;
  repostedBy: string[];
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
  time: string;
  timestamp: string;
  isAnonymous?: boolean;
  helpfulVotes: number;
  votedHelpfulBy: string[];
}

export interface Topic {
  id: string;
  name: string;
  emoji: string;
  color: string;
  members: number;
  posts: number;
  trending: boolean;
  description: string;
  isJoined: boolean;
  joinedBy: string[];
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'repost' | 'mention' | 'follow' | 'message' | 'system' | 'helpful';
  userId: string;
  user: CommunityUser;
  content: string;
  target?: string;
  postId?: string;
  time: string;
  timestamp: string;
  read: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'text' | 'image';
  imageUrl?: string;
}

export interface Chat {
  id: string;
  participantId: string;
  participant: CommunityUser;
  messages: Message[];
  lastMessage: Message;
  unreadCount: number;
  updatedAt: string;
  isTyping?: boolean;
}

export interface UserActivity {
  userId: string;
  lastActive: string;
  status: OnlineStatus;
}

interface CommunityState {
  posts: Post[];
  topics: Topic[];
  notifications: Notification[];
  chats: Chat[];
  currentUser: CommunityUser | null;
  isLoading: boolean;
  onlineUsers: string[];
  userActivities: Map<string, UserActivity>;
  blockedUsers: string[];
  selectedTopics: string[];
}

interface CommunityContextType extends CommunityState {
  createPost: (content: string, topicId: string, images?: string[], isAnonymous?: boolean) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  repostPost: (postId: string) => Promise<void>;
  unrepostPost: (postId: string) => Promise<void>;
  bookmarkPost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  getPostById: (postId: string) => Post | undefined;
  voteHelpful: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<void>;
  likeComment: (postId: string, commentId: string) => Promise<void>;
  voteCommentHelpful: (postId: string, commentId: string) => Promise<void>;
  replyToComment: (postId: string, commentId: string, content: string) => Promise<void>;
  joinTopic: (topicId: string) => Promise<void>;
  leaveTopic: (topicId: string) => Promise<void>;
  getTopicById: (topicId: string) => Topic | undefined;
  getPostsByTopic: (topicId: string) => Post[];
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  getUserById: (userId: string) => CommunityUser | undefined;
  getUserPosts: (userId: string) => Post[];
  isFollowing: (userId: string) => boolean;
  updateUserBio: (bio: string) => Promise<void>;
  updateUserLocation: (country: string) => Promise<void>;
  updateOnlineStatus: (status: OnlineStatus) => Promise<void>;
  getUserStats: (userId: string) => CommunityUser['stats'] | undefined;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  getUnreadCount: () => number;
  sendMessage: (userId: string, content: string, type?: 'text' | 'image', imageUrl?: string) => Promise<void>;
  getChatMessages: (userId: string) => Message[];
  markChatRead: (userId: string) => Promise<void>;
  getOrCreateChat: (userId: string) => Chat | undefined;
  setTypingStatus: (userId: string, isTyping: boolean) => void;
  getTypingStatus: (userId: string) => boolean;
  deleteChat: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  isUserBlocked: (userId: string) => boolean;
  refreshFeed: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  updateCommunityProfile: (updates: Partial<CommunityUser>) => Promise<void>;
  getCurrentUserProfile: () => CommunityUser | null;
  checkAndAwardAchievements: () => Promise<string[]>;
  getUserAchievements: (userId: string) => string[];
  checkOnboardingStatus: () => Promise<boolean>;
  updateSelectedTopics: (topics: string[]) => Promise<void>;
  getSelectedTopics: () => string[];
  getFollowers: (userId: string) => Promise<string[]>;
  getFollowing: (userId: string) => Promise<string[]>;
  getAllUsers: () => CommunityUser[];
  syncUserProfileAcrossPosts: (userId: string, profileUpdates: Partial<CommunityUser>) => Promise<void>;
  getFeedPosts: () => Post[];  // NEW: Get personalized feed
}

const CommunityContext = createContext<CommunityContextType | null>(null);

// ─── Initial Topics ───────────────────────────────────────────
export const INITIAL_TOPICS: Topic[] = [
  { id: 'topic_1', name: 'Potty Training', emoji: '🚽', color: '#667eea', members: 12500, posts: 3200, trending: true, description: 'Tips, tricks, and support for potty training success', isJoined: false, joinedBy: [] },
  { id: 'topic_2', name: 'Sleep Tips', emoji: '😴', color: '#11998e', members: 18200, posts: 5100, trending: true, description: 'Better sleep for babies and parents', isJoined: false, joinedBy: [] },
  { id: 'topic_3', name: 'Feeding & Nutrition', emoji: '🍼', color: '#fa709a', members: 15800, posts: 4700, trending: false, description: 'From breastfeeding to first foods', isJoined: false, joinedBy: [] },
  { id: 'topic_4', name: 'Milestones', emoji: '🏆', color: '#fee140', members: 9300, posts: 2100, trending: false, description: 'Celebrate every achievement', isJoined: false, joinedBy: [] },
  { id: 'topic_5', name: 'Health & Wellness', emoji: '💊', color: '#fc5c7d', members: 11700, posts: 3800, trending: true, description: 'Keeping your little ones healthy', isJoined: false, joinedBy: [] },
  { id: 'topic_6', name: 'Parenting Hacks', emoji: '💡', color: '#6a82fb', members: 22400, posts: 8900, trending: true, description: 'Clever solutions for everyday challenges', isJoined: false, joinedBy: [] },
  { id: 'topic_7', name: 'Baby Names', emoji: '✨', color: '#f093fb', members: 8500, posts: 4200, trending: false, description: 'Find the perfect name for your little one', isJoined: false, joinedBy: [] },
  { id: 'topic_8', name: 'Work-Life Balance', emoji: '⚖️', color: '#4facfe', members: 11200, posts: 3600, trending: true, description: 'Juggling career and parenting', isJoined: false, joinedBy: [] },
  { id: 'topic_9', name: 'Toddler Tantrums', emoji: '😤', color: '#fa709a', members: 15600, posts: 5400, trending: true, description: 'Navigating the terrible twos and beyond', isJoined: false, joinedBy: [] },
  { id: 'topic_10', name: 'Education', emoji: '📚', color: '#43e97b', members: 9800, posts: 2800, trending: false, description: 'Early learning and school prep', isJoined: false, joinedBy: [] },
  { id: 'topic_11', name: 'Single Parenting', emoji: '💪', color: '#fa709a', members: 7200, posts: 1900, trending: false, description: 'Support and advice for single parents', isJoined: false, joinedBy: [] },
  { id: 'topic_12', name: 'Special Needs', emoji: '🌈', color: '#667eea', members: 6400, posts: 1500, trending: false, description: 'Resources and community for special needs parenting', isJoined: false, joinedBy: [] },
];

// ─── Achievements ─────────────────────────────────────────────
const ACHIEVEMENTS = {
  FIRST_POST: { id: 'first_post', emoji: '📝', name: 'First Steps', description: 'Made your first post' },
  HELPFUL_PARENT: { id: 'helpful_parent', emoji: '💙', name: 'Helpful Parent', description: 'Received 50+ likes' },
  TOP_CONTRIBUTOR: { id: 'top_contributor', emoji: '🏆', name: 'Top Contributor', description: '100+ helpful posts' },
  STREAK_7: { id: 'streak_7', emoji: '🔥', name: '7 Day Streak', description: 'Active for 7 days' },
  STREAK_30: { id: 'streak_30', emoji: '🔥', name: '30 Day Streak', description: 'Active for 30 days' },
  RISING_STAR: { id: 'rising_star', emoji: '⭐', name: 'Rising Star', description: 'Gained 1000 followers' },
  STORYTELLER: { id: 'storyteller', emoji: '📖', name: 'Storyteller', description: '50+ posts shared' },
  SOCIAL_BUTTERFLY: { id: 'social_butterfly', emoji: '🦋', name: 'Social Butterfly', description: 'Following 100+ users' },
};

// ─── LittleLoom Team User ─────────────────────────────────────
const LITTLELOOM_TEAM: CommunityUser = {
  id: 'littleloom_team',
  displayName: 'LittleLoom Team',
  handle: '@littleloom',
  avatar: '🧸',
  isVerified: true,
  bio: 'Official LittleLoom support team. Here to help you on your parenting journey!',
  location: 'Global',
  country: 'Global',
  onlineStatus: 'online',
  lastActive: new Date().toISOString(),
  stats: { posts: 1, followers: 9999, following: 0, helpful: 999, streakDays: 999, lastStreakDate: new Date().toISOString() },
  achievements: ['top_contributor', 'rising_star'],
  isFollowing: false,
  followers: [],
  following: [],
};

// ─── Helpers ──────────────────────────────────────────────────
const formatTimeAgo = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return then.toLocaleDateString();
};

const createDefaultPost = (): Post => {
  const now = new Date();
  const timestamp = now.toISOString();

  return {
    id: 'post_welcome_default',
    authorId: LITTLELOOM_TEAM.id,
    author: LITTLELOOM_TEAM,
    topic: 'Parenting Hacks',
    topicId: 'topic_6',
    content: `👋 Welcome to LittleLoom Community! 

This is a safe space for parents to connect, share experiences, and support each other.

🌟 Getting Started:
• Join topics that interest you
• Share your parenting journey  
• Ask questions — no judgment here!
• Celebrate milestones together

💡 Tip: Tap the + button to create your first post and introduce yourself!

We're so glad you're here. 💙`,
    images: [],
    likes: 1247,
    likedBy: [],
    comments: [],
    commentsCount: 0,
    reposts: 342,
    repostedBy: [],
    isLiked: false,
    isReposted: false,
    isBookmarked: false,
    time: formatTimeAgo(timestamp),
    timestamp,
    isAnonymous: false,
    helpfulVotes: 856,
    votedHelpfulBy: [],
  };
};

// ─── Normalize file:// URIs ───────────────────────────────────
const normalizeImageUri = (uri: string): string => {
  if (!uri) return '';
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
};

// ─── Get Date String (for streaks) ───────────────────────────
const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// ═══════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════
export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, communityProfile, updateCommunityProfile: updateUserCommunityProfile } = useUser();

  const [state, setState] = useState<CommunityState>({
    posts: [],
    topics: [],
    notifications: [],
    chats: [],
    currentUser: null,
    isLoading: true,
    onlineUsers: [],
    userActivities: new Map(),
    blockedUsers: [],
    selectedTopics: [],
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Refs for latest state to use in async operations
  const stateRef = useRef(state);
  const persistQueue = useRef<Set<string>>(new Set());
  const isPersisting = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ─── Load Persisted Data ────────────────────────────────────
  useEffect(() => {
    loadPersistedData();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    const syncInterval = setInterval(processPersistQueue, 5000); // Batch save every 5s

    return () => {
      subscription.remove();
      clearInterval(syncInterval);
    };
  }, []);

  // ─── Initialize Current User ─────────────────────────────────
  useEffect(() => {
    if (profile && communityProfile && isInitialized) {
      initializeCurrentUser();
    }
  }, [profile, communityProfile, isInitialized]);

  // ─── Sync Profile Changes ───────────────────────────────────
  useEffect(() => {
    if (state.currentUser?.id && communityProfile) {
      const hasChanges = 
        communityProfile.displayName !== state.currentUser.displayName ||
        communityProfile.handle !== state.currentUser.handle ||
        communityProfile.avatar !== state.currentUser.avatar ||
        communityProfile.bio !== state.currentUser.bio;

      if (hasChanges) {
        syncUserProfileAcrossPosts(state.currentUser.id, {
          displayName: communityProfile.displayName,
          handle: communityProfile.handle,
          avatar: communityProfile.avatar,
          bio: communityProfile.bio,
        });
      }
    }
  }, [communityProfile?.displayName, communityProfile?.handle, communityProfile?.avatar, communityProfile?.bio]);

  // ─── Persist Queue Processor ─────────────────────────────────
  const processPersistQueue = async () => {
    if (isPersisting.current || persistQueue.current.size === 0) return;
    isPersisting.current = true;

    const currentState = stateRef.current;
    const keysToPersist = Array.from(persistQueue.current);
    persistQueue.current.clear();

    try {
      const promises: Promise<void>[] = [];

      if (keysToPersist.includes('posts')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(currentState.posts)));
      }
      if (keysToPersist.includes('topics')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(currentState.topics)));
      }
      if (keysToPersist.includes('notifications')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(currentState.notifications)));
      }
      if (keysToPersist.includes('chats')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(currentState.chats)));
      }
      if (keysToPersist.includes('blockedUsers')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(currentState.blockedUsers)));
      }
      if (keysToPersist.includes('selectedTopics')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.SELECTED_TOPICS, JSON.stringify(currentState.selectedTopics)));
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error batch persisting:', error);
    } finally {
      isPersisting.current = false;
    }
  };

  const queuePersist = (key: string) => {
    persistQueue.current.add(key);
  };

  // ─── App State Handler ──────────────────────────────────────
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      await updateOnlineStatus('online');
      await checkStreak();
    } else if (nextAppState === 'background') {
      await updateOnlineStatus('away');
      await processPersistQueue(); // Force save on background
    }
  };

  // ─── Load All Persisted Data ────────────────────────────────
  const loadPersistedData = async () => {
    try {
      const [
        postsData,
        topicsData,
        notificationsData,
        chatsData,
        blockedUsersData,
        selectedTopicsData,
        onboardingData,
        likesData,
        bookmarksData,
        repostsData,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.POSTS),
        AsyncStorage.getItem(STORAGE_KEYS.TOPICS),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
        AsyncStorage.getItem(STORAGE_KEYS.BLOCKED_USERS),
        AsyncStorage.getItem(STORAGE_KEYS.SELECTED_TOPICS),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
        AsyncStorage.getItem(STORAGE_KEYS.LIKES),
        AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKS),
        AsyncStorage.getItem(STORAGE_KEYS.REPOSTS),
      ]);

      let loadedPosts: Post[] = postsData ? JSON.parse(postsData) : [];
      const loadedTopics = topicsData ? JSON.parse(topicsData) : INITIAL_TOPICS;
      let loadedSelectedTopics: string[] = selectedTopicsData ? JSON.parse(selectedTopicsData) : [];

      // Restore interactions (likes, bookmarks, reposts)
      const likedPosts: string[] = likesData ? JSON.parse(likesData) : [];
      const bookmarkedPosts: string[] = bookmarksData ? JSON.parse(bookmarksData) : [];
      const repostedPosts: string[] = repostsData ? JSON.parse(repostsData) : [];

      // Apply interaction states to posts
      if (loadedPosts.length > 0) {
        loadedPosts = loadedPosts.map(post => ({
          ...post,
          isLiked: likedPosts.includes(post.id),
          isBookmarked: bookmarkedPosts.includes(post.id),
          isReposted: repostedPosts.includes(post.id),
        }));
      }

      // If onboarding was completed with topics, use those
      if (onboardingData) {
        const parsedOnboarding = JSON.parse(onboardingData);
        if (parsedOnboarding.selectedTopics?.length > 0) {
          loadedSelectedTopics = parsedOnboarding.selectedTopics;
        }
      }

      // Inject default welcome post if feed is empty
      if (loadedPosts.length === 0) {
        loadedPosts = [createDefaultPost()];
        await AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(loadedPosts));
      }

      setState(prev => ({
        ...prev,
        posts: loadedPosts,
        topics: loadedTopics,
        notifications: notificationsData ? JSON.parse(notificationsData) : [],
        chats: chatsData ? JSON.parse(chatsData) : [],
        blockedUsers: blockedUsersData ? JSON.parse(blockedUsersData) : [],
        selectedTopics: loadedSelectedTopics,
        isLoading: false,
      }));

      setIsInitialized(true);
    } catch (error) {
      console.error('Error loading persisted data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      setIsInitialized(true);
    }
  };

  // ─── Initialize Current User ────────────────────────────────
  const initializeCurrentUser = async () => {
    if (!profile || !communityProfile) return;

    const userId = profile.id;

    const [
      existingStats,
      existingSelectedTopics,
      existingFollowers,
      existingFollowing,
    ] = await Promise.all([
      AsyncStorage.getItem(`${STORAGE_KEYS.USER_STATS}_${userId}`),
      AsyncStorage.getItem(`${STORAGE_KEYS.SELECTED_TOPICS}_${userId}`),
      AsyncStorage.getItem(`${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`),
      AsyncStorage.getItem(`${STORAGE_KEYS.USER_FOLLOWING}_${userId}`),
    ]);

    const parsedStats = existingStats ? JSON.parse(existingStats) : null;
    const parsedSelectedTopics = existingSelectedTopics ? JSON.parse(existingSelectedTopics) : [];
    const parsedFollowers = existingFollowers ? JSON.parse(existingFollowers) : ['littleloom_team'];
    const parsedFollowing = existingFollowing ? JSON.parse(existingFollowing) : [];

    const currentUser: CommunityUser = {
      id: userId,
      displayName: communityProfile.displayName || profile.fullName,
      handle: communityProfile.handle || `@${profile.fullName.toLowerCase().replace(/\s+/g, '_')}`,
      avatar: profile.avatar || '👤',
      isVerified: communityProfile.isVerified || false,
      bio: communityProfile.bio || '',
      location: communityProfile.location,
      country: communityProfile.country || 'Unknown',
      onlineStatus: 'online',
      lastActive: new Date().toISOString(),
      stats: parsedStats || {
        posts: 0,
        followers: parsedFollowers.length,
        following: parsedFollowing.length,
        helpful: 0,
        streakDays: 0,
        lastStreakDate: new Date().toISOString(),
      },
      achievements: communityProfile.badges?.map(b => b.id) || [],
      selectedTopics: parsedSelectedTopics.length > 0 ? parsedSelectedTopics : communityProfile.preferences?.selectedTopics || [],
      followers: parsedFollowers,
      following: parsedFollowing,
    };

    setState(prev => ({ ...prev, currentUser, selectedTopics: currentUser.selectedTopics || [] }));

    // Ensure LittleLoom Team is a follower for new users
    if (!parsedFollowers.includes('littleloom_team')) {
      const updatedFollowers = ['littleloom_team', ...parsedFollowers.filter((id: string) => id !== 'littleloom_team')];
      await AsyncStorage.setItem(`${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`, JSON.stringify(updatedFollowers));
    }

    await updateOnlineStatus('online');
    await checkStreak();
  };

  // ─── Check Streak ───────────────────────────────────────────
  const checkStreak = async () => {
    if (!stateRef.current.currentUser) return;

    const today = getDateString(new Date());
    const lastDate = getDateString(new Date(stateRef.current.currentUser.stats.lastStreakDate));
    const yesterday = getDateString(new Date(Date.now() - 86400000));

    if (lastDate === today) return;

    let newStreak = stateRef.current.currentUser.stats.streakDays;
    if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    const updatedStats = {
      ...stateRef.current.currentUser.stats,
      streakDays: newStreak,
      lastStreakDate: new Date().toISOString(),
    };

    await AsyncStorage.setItem(`${STORAGE_KEYS.USER_STATS}_${stateRef.current.currentUser.id}`, JSON.stringify(updatedStats));

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, stats: updatedStats } : null,
    }));

    if (newStreak === 7) await awardAchievement('streak_7');
    if (newStreak === 30) await awardAchievement('streak_30');
  };

  // ─── Award Achievement ──────────────────────────────────────
  const awardAchievement = async (achievementId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;
    if (currentUser.achievements.includes(achievementId)) return;

    const newAchievements = [...currentUser.achievements, achievementId];

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, achievements: newAchievements } : null,
    }));

    const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId);
    if (achievement) {
      showSuccessModal({
        title: 'Achievement Unlocked! 🎉',
        message: `${achievement.emoji} ${achievement.name}\n${achievement.description}`,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ─── Sync User Profile Across Posts ─────────────────────────
  const syncUserProfileAcrossPosts = useCallback(async (userId: string, profileUpdates: Partial<CommunityUser>) => {
    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.authorId === userId) {
          return {
            ...post,
            author: { ...post.author, ...profileUpdates },
          };
        }
        // Update comments by this user
        const updatedComments = post.comments.map(comment => {
          if (comment.authorId === userId) {
            return { ...comment, author: { ...comment.author, ...profileUpdates } };
          }
          if (comment.replies) {
            const updatedReplies = comment.replies.map(reply => 
              reply.authorId === userId ? { ...reply, author: { ...reply.author, ...profileUpdates } } : reply
            );
            return { ...comment, replies: updatedReplies };
          }
          return comment;
        });
        return { ...post, comments: updatedComments };
      });

      const updatedCurrentUser = prev.currentUser?.id === userId 
        ? { ...prev.currentUser, ...profileUpdates }
        : prev.currentUser;

      // Persist updated posts
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);

      return {
        ...prev,
        posts: updatedPosts,
        currentUser: updatedCurrentUser,
      };
    });
  }, []);

  // ─── Create Post ────────────────────────────────────────────
  const createPost = useCallback(async (content: string, topicId: string, images?: string[], isAnonymous?: boolean) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to create posts' });
      return;
    }

    const topic = stateRef.current.topics.find(t => t.id === topicId);
    if (!topic) {
      showErrorModal({ message: 'Topic not found' });
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();

    // Normalize image URIs
    const normalizedImages = images?.map(img => normalizeImageUri(img)) || [];

    const newPost: Post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      authorId: currentUser.id,
      author: isAnonymous 
        ? { ...currentUser, displayName: 'Anonymous', avatar: '🎭', handle: '@anonymous' } 
        : currentUser,
      topic: topic.name,
      topicId,
      content,
      images: normalizedImages,
      likes: 0,
      likedBy: [],
      comments: [],
      commentsCount: 0,
      reposts: 0,
      repostedBy: [],
      isLiked: false,
      isReposted: false,
      isBookmarked: false,
      time: 'Just now',
      timestamp,
      isAnonymous,
      helpfulVotes: 0,
      votedHelpfulBy: [],
    };

    setState(prev => {
      const updatedPosts = [newPost, ...prev.posts];
      const updatedTopics = prev.topics.map(t => 
        t.id === topicId 
          ? { ...t, posts: t.posts + 1, joinedBy: t.joinedBy.includes(currentUser.id) ? t.joinedBy : [...t.joinedBy, currentUser.id] }
          : t
      );

      const updatedStats = {
        ...currentUser.stats,
        posts: currentUser.stats.posts + 1,
      };

      // Persist immediately for posts
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(updatedTopics)).catch(console.error);
      AsyncStorage.setItem(`${STORAGE_KEYS.USER_STATS}_${currentUser.id}`, JSON.stringify(updatedStats)).catch(console.error);

      return {
        ...prev,
        posts: updatedPosts,
        topics: updatedTopics,
        currentUser: { ...currentUser, stats: updatedStats },
      };
    });

    const postCount = stateRef.current.posts.filter(p => p.authorId === currentUser.id).length + 1;
    if (postCount === 1) await awardAchievement('first_post');
    if (postCount === 50) await awardAchievement('storyteller');

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessModal({ message: 'Post created successfully!' });
  }, []);

  // ─── Like Post ──────────────────────────────────────────────
  const likePost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to like posts' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setState(prev => {
      let newNotification: Notification | null = null;
      let targetPost: Post | null = null;
      let updatedLikedPosts: string[] = [];

      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          targetPost = post;
          const isNowLiked = !post.likedBy.includes(currentUser.id);
          
          if (isNowLiked) {
            // Like
            if (post.authorId !== currentUser.id) {
              newNotification = {
                id: `notif_${Date.now()}`,
                type: 'like',
                userId: currentUser.id,
                user: currentUser,
                content: 'liked your post',
                target: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
                postId: post.id,
                time: 'Just now',
                timestamp: new Date().toISOString(),
                read: false,
              };
            }
            updatedLikedPosts = [...(prev.posts.find(p => p.id === postId)?.likedBy || []), currentUser.id];
            
            return {
              ...post,
              isLiked: true,
              likes: post.likes + 1,
              likedBy: [...post.likedBy, currentUser.id],
            };
          } else {
            // Unlike (shouldn't happen via likePost, but handle anyway)
            updatedLikedPosts = post.likedBy.filter(id => id !== currentUser.id);
            return {
              ...post,
              isLiked: false,
              likes: Math.max(0, post.likes - 1),
              likedBy: post.likedBy.filter(id => id !== currentUser.id),
            };
          }
        }
        return post;
      });

      const updatedNotifications = newNotification 
        ? [newNotification, ...prev.notifications] 
        : prev.notifications;

      // Persist likes list
      const allLikedPosts = Array.from(new Set([
        ...updatedPosts.filter(p => p.isLiked).map(p => p.id),
      ]));
      AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(allLikedPosts)).catch(console.error);
      
      if (newNotification) {
        AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      }
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);

      return { ...prev, posts: updatedPosts, notifications: updatedNotifications };
    });
  }, []);

  // ─── Unlike Post ────────────────────────────────────────────
  const unlikePost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && post.likedBy.includes(currentUser.id)) {
          return {
            ...post,
            isLiked: false,
            likes: Math.max(0, post.likes - 1),
            likedBy: post.likedBy.filter(id => id !== currentUser.id),
          };
        }
        return post;
      });

      // Persist likes list
      const allLikedPosts = updatedPosts.filter(p => p.isLiked).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(allLikedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);

      return { ...prev, posts: updatedPosts };
    });
  }, []);

  // ─── Repost Post ────────────────────────────────────────────
  const repostPost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to repost' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setState(prev => {
      let newNotification: Notification | null = null;

      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && !post.repostedBy.includes(currentUser.id)) {
          if (post.authorId !== currentUser.id) {
            newNotification = {
              id: `notif_${Date.now()}`,
              type: 'repost',
              userId: currentUser.id,
              user: currentUser,
              content: 'reposted your post',
              target: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
              postId: post.id,
              time: 'Just now',
              timestamp: new Date().toISOString(),
              read: false,
            };
          }

          return {
            ...post,
            isReposted: true,
            reposts: post.reposts + 1,
            repostedBy: [...post.repostedBy, currentUser.id],
          };
        }
        return post;
      });

      const updatedNotifications = newNotification 
        ? [newNotification, ...prev.notifications] 
        : prev.notifications;

      // Persist reposts list
      const allRepostedPosts = updatedPosts.filter(p => p.isReposted).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.REPOSTS, JSON.stringify(allRepostedPosts)).catch(console.error);
      
      if (newNotification) {
        AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      }
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);

      return { ...prev, posts: updatedPosts, notifications: updatedNotifications };
    });
  }, []);

  // ─── Unrepost Post ──────────────────────────────────────────
  const unrepostPost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && post.repostedBy.includes(currentUser.id)) {
          return {
            ...post,
            isReposted: false,
            reposts: Math.max(0, post.reposts - 1),
            repostedBy: post.repostedBy.filter(id => id !== currentUser.id),
          };
        }
        return post;
      });

      const allRepostedPosts = updatedPosts.filter(p => p.isReposted).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.REPOSTS, JSON.stringify(allRepostedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);

      return { ...prev, posts: updatedPosts };
    });
  }, []);

  // ─── Bookmark Post ──────────────────────────────────────────
  const bookmarkPost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to bookmark' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          return { ...post, isBookmarked: !post.isBookmarked };
        }
        return post;
      });

      const allBookmarkedPosts = updatedPosts.filter(p => p.isBookmarked).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(allBookmarkedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);

      return { ...prev, posts: updatedPosts };
    });
  }, []);

  // ─── Vote Helpful ───────────────────────────────────────────
  const voteHelpful = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && !post.votedHelpfulBy.includes(currentUser.id)) {
          return {
            ...post,
            helpfulVotes: post.helpfulVotes + 1,
            votedHelpfulBy: [...post.votedHelpfulBy, currentUser.id],
          };
        }
        return post;
      });

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      return { ...prev, posts: updatedPosts };
    });
  }, []);

  // ─── Delete Post ────────────────────────────────────────────
  const deletePost = useCallback(async (postId: string) => {
    showConfirmModal({
      title: 'Delete Post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      onConfirm: () => {
        setState(prev => {
          const updatedPosts = prev.posts.filter(post => post.id !== postId);
          AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
          return { ...prev, posts: updatedPosts };
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccessModal({ message: 'Post deleted successfully' });
      },
    });
  }, []);

  // ─── Get Post By ID ─────────────────────────────────────────
  const getPostById = useCallback((postId: string) => {
    return stateRef.current.posts.find(post => post.id === postId);
  }, []);

  // ─── Add Comment ──────────────────────────────────────────────
  const addComment = useCallback(async (postId: string, content: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to comment' });
      return;
    }

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      authorId: currentUser.id,
      author: currentUser,
      content,
      likes: 0,
      likedBy: [],
      isLiked: false,
      time: 'Just now',
      timestamp: new Date().toISOString(),
      replies: [],
      helpfulVotes: 0,
      votedHelpfulBy: [],
    };

    setState(prev => {
      let newNotification: Notification | null = null;

      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          if (post.authorId !== currentUser.id) {
            newNotification = {
              id: `notif_${Date.now()}`,
              type: 'comment',
              userId: currentUser.id,
              user: currentUser,
              content: 'commented on your post',
              target: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
              postId: post.id,
              time: 'Just now',
              timestamp: new Date().toISOString(),
              read: false,
            };
          }

          return {
            ...post,
            comments: [...post.comments, newComment],
            commentsCount: post.commentsCount + 1,
          };
        }
        return post;
      });

      const updatedNotifications = newNotification 
        ? [newNotification, ...prev.notifications] 
        : prev.notifications;

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      if (newNotification) {
        AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      }

      return { ...prev, posts: updatedPosts, notifications: updatedNotifications };
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // ─── Like Comment ───────────────────────────────────────────
  const likeComment = useCallback(async (postId: string, commentId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map(comment => {
              if (comment.id === commentId) {
                const isLiked = comment.likedBy.includes(currentUser.id);
                return {
                  ...comment,
                  isLiked: !isLiked,
                  likes: isLiked ? comment.likes - 1 : comment.likes + 1,
                  likedBy: isLiked 
                    ? comment.likedBy.filter(id => id !== currentUser.id)
                    : [...comment.likedBy, currentUser.id],
                };
              }
              return comment;
            }),
          };
        }
        return post;
      });

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      return { ...prev, posts: updatedPosts };
    });
  }, []);

  // ─── Vote Comment Helpful ───────────────────────────────────
  const voteCommentHelpful = useCallback(async (postId: string, commentId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map(comment => {
              if (comment.id === commentId && !comment.votedHelpfulBy.includes(currentUser.id)) {
                return {
                  ...comment,
                  helpfulVotes: comment.helpfulVotes + 1,
                  votedHelpfulBy: [...comment.votedHelpfulBy, currentUser.id],
                };
              }
              return comment;
            }),
          };
        }
        return post;
      });

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      return { ...prev, posts: updatedPosts };
    });
  }, []);

  // ─── Reply To Comment ───────────────────────────────────────
  const replyToComment = useCallback(async (postId: string, commentId: string, content: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    const newReply: Comment = {
      id: `reply_${Date.now()}`,
      authorId: currentUser.id,
      author: currentUser,
      content,
      likes: 0,
      likedBy: [],
      isLiked: false,
      time: 'Just now',
      timestamp: new Date().toISOString(),
      replies: [],
      helpfulVotes: 0,
      votedHelpfulBy: [],
    };

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map(comment => {
              if (comment.id === commentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), newReply],
                };
              }
              return comment;
            }),
            commentsCount: post.commentsCount + 1,
          };
        }
        return post;
      });

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      return { ...prev, posts: updatedPosts };
    });
  }, []);

  // ─── Join Topic ─────────────────────────────────────────────
  const joinTopic = useCallback(async (topicId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to join topics' });
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setState(prev => {
      const updatedTopics = prev.topics.map(topic => {
        if (topic.id === topicId && !topic.joinedBy.includes(currentUser.id)) {
          return {
            ...topic,
            isJoined: true,
            members: topic.members + 1,
            joinedBy: [...topic.joinedBy, currentUser.id],
          };
        }
        return topic;
      });

      AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(updatedTopics)).catch(console.error);
      return { ...prev, topics: updatedTopics };
    });
  }, []);

  // ─── Leave Topic ────────────────────────────────────────────
  const leaveTopic = useCallback(async (topicId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => {
      const updatedTopics = prev.topics.map(topic => {
        if (topic.id === topicId && topic.joinedBy.includes(currentUser.id)) {
          return {
            ...topic,
            isJoined: false,
            members: Math.max(0, topic.members - 1),
            joinedBy: topic.joinedBy.filter(id => id !== currentUser.id),
          };
        }
        return topic;
      });

      AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(updatedTopics)).catch(console.error);
      return { ...prev, topics: updatedTopics };
    });
  }, []);

  // ─── Get Topic By ID ────────────────────────────────────────
  const getTopicById = useCallback((topicId: string) => {
    return stateRef.current.topics.find(topic => topic.id === topicId);
  }, []);

  // ─── Get Posts By Topic ─────────────────────────────────────
  const getPostsByTopic = useCallback((topicId: string) => {
    return stateRef.current.posts.filter(post => post.topicId === topicId);
  }, []);

  // ─── Follow User ────────────────────────────────────────────
  const followUser = useCallback(async (userId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser || userId === currentUser.id) {
      showErrorModal({ message: 'Cannot follow yourself' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const followersKey = `${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`;
    const followingKey = `${STORAGE_KEYS.USER_FOLLOWING}_${currentUser.id}`;

    // Update target user's followers
    const existingFollowers = await AsyncStorage.getItem(followersKey);
    const followers = existingFollowers ? JSON.parse(existingFollowers) : [];
    if (!followers.includes(currentUser.id)) {
      followers.push(currentUser.id);
      await AsyncStorage.setItem(followersKey, JSON.stringify(followers));
    }

    // Update current user's following
    const existingFollowing = await AsyncStorage.getItem(followingKey);
    const following = existingFollowing ? JSON.parse(existingFollowing) : [];
    if (!following.includes(userId)) {
      following.push(userId);
      await AsyncStorage.setItem(followingKey, JSON.stringify(following));
    }

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.authorId === userId) {
          return {
            ...post,
            author: {
              ...post.author,
              isFollowing: true,
              stats: {
                ...post.author.stats,
                followers: (post.author.stats.followers || 0) + 1,
              },
            },
          };
        }
        return post;
      });

      const updatedCurrentUser = {
        ...currentUser,
        stats: {
          ...currentUser.stats,
          following: currentUser.stats.following + 1,
        },
        following: [...(currentUser.following || []), userId],
      };

      const notification: Notification = {
        id: `notif_${Date.now()}`,
        type: 'follow',
        userId: currentUser.id,
        user: currentUser,
        content: 'started following you',
        time: 'Just now',
        timestamp: new Date().toISOString(),
        read: false,
      };

      const updatedNotifications = [notification, ...prev.notifications];

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      AsyncStorage.setItem(`${STORAGE_KEYS.USER_STATS}_${currentUser.id}`, JSON.stringify(updatedCurrentUser.stats)).catch(console.error);

      return {
        ...prev,
        posts: updatedPosts,
        currentUser: updatedCurrentUser,
        notifications: updatedNotifications,
      };
    });

    if (currentUser.stats.following + 1 >= 100) {
      await awardAchievement('social_butterfly');
    }
  }, []);

  // ─── Unfollow User ──────────────────────────────────────────
  const unfollowUser = useCallback(async (userId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    const followersKey = `${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`;
    const followingKey = `${STORAGE_KEYS.USER_FOLLOWING}_${currentUser.id}`;

    // Update target user's followers
    const existingFollowers = await AsyncStorage.getItem(followersKey);
    const followers = existingFollowers ? JSON.parse(existingFollowers) : [];
    const updatedFollowers = followers.filter((id: string) => id !== currentUser.id);
    await AsyncStorage.setItem(followersKey, JSON.stringify(updatedFollowers));

    // Update current user's following
    const existingFollowing = await AsyncStorage.getItem(followingKey);
    const following = existingFollowing ? JSON.parse(existingFollowing) : [];
    const updatedFollowing = following.filter((id: string) => id !== userId);
    await AsyncStorage.setItem(followingKey, JSON.stringify(updatedFollowing));

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.authorId === userId) {
          return {
            ...post,
            author: {
              ...post.author,
              isFollowing: false,
              stats: {
                ...post.author.stats,
                followers: Math.max(0, (post.author.stats.followers || 0) - 1),
              },
            },
          };
        }
        return post;
      });

      const updatedCurrentUser = {
        ...currentUser,
        stats: {
          ...currentUser.stats,
          following: Math.max(0, currentUser.stats.following - 1),
        },
        following: (currentUser.following || []).filter(id => id !== userId),
      };

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      AsyncStorage.setItem(`${STORAGE_KEYS.USER_STATS}_${currentUser.id}`, JSON.stringify(updatedCurrentUser.stats)).catch(console.error);

      return {
        ...prev,
        posts: updatedPosts,
        currentUser: updatedCurrentUser,
      };
    });
  }, []);

  // ─── Get User By ID ─────────────────────────────────────────
  const getUserById = useCallback((userId: string) => {
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser;
    if (userId === 'littleloom_team') return LITTLELOOM_TEAM;
    const post = stateRef.current.posts.find(p => p.authorId === userId);
    if (post) return post.author;
    return undefined;
  }, []);

  // ─── Get User Posts ─────────────────────────────────────────
  const getUserPosts = useCallback((userId: string) => {
    return stateRef.current.posts.filter(post => post.authorId === userId);
  }, []);

  // ─── Is Following ───────────────────────────────────────────
  const isFollowing = useCallback((userId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return false;
    return currentUser.following?.includes(userId) || false;
  }, []);

  // ─── Get Followers ──────────────────────────────────────────
  const getFollowers = useCallback(async (userId: string): Promise<string[]> => {
    try {
      const followersKey = `${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`;
      const existingFollowers = await AsyncStorage.getItem(followersKey);
      if (existingFollowers) {
        return JSON.parse(existingFollowers);
      }
      // Default: LittleLoom Team follows everyone
      if (userId === stateRef.current.currentUser?.id) {
        return ['littleloom_team'];
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  // ─── Get Following ──────────────────────────────────────────
  const getFollowing = useCallback(async (userId: string): Promise<string[]> => {
    try {
      const followingKey = `${STORAGE_KEYS.USER_FOLLOWING}_${userId}`;
      const existingFollowing = await AsyncStorage.getItem(followingKey);
      if (existingFollowing) {
        return JSON.parse(existingFollowing);
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  // ─── Get All Users ──────────────────────────────────────────
  const getAllUsers = useCallback((): CommunityUser[] => {
    const users = new Map<string, CommunityUser>();
    users.set('littleloom_team', LITTLELOOM_TEAM);
    if (stateRef.current.currentUser) {
      users.set(stateRef.current.currentUser.id, stateRef.current.currentUser);
    }
    stateRef.current.posts.forEach(post => {
      if (!users.has(post.authorId)) {
        users.set(post.authorId, post.author);
      }
    });
    return Array.from(users.values());
  }, []);

  // ─── Update User Bio ────────────────────────────────────────
  const updateUserBio = useCallback(async (bio: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, bio },
    }));

    await updateUserCommunityProfile({ bio });
  }, [updateUserCommunityProfile]);

  // ─── Update User Location ───────────────────────────────────
  const updateUserLocation = useCallback(async (country: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, country },
    }));
  }, []);

  // ─── Update Online Status ───────────────────────────────────
  const updateOnlineStatus = useCallback(async (status: OnlineStatus) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    const updatedActivity: UserActivity = {
      userId: currentUser.id,
      lastActive: new Date().toISOString(),
      status,
    };

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, onlineStatus: status, lastActive: updatedActivity.lastActive },
      userActivities: new Map(prev.userActivities).set(currentUser.id, updatedActivity),
    }));
  }, []);

  // ─── Get User Stats ─────────────────────────────────────────
  const getUserStats = useCallback((userId: string) => {
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser.stats;
    const user = getUserById(userId);
    return user?.stats;
  }, [getUserById]);

  // ─── Mark Notification Read ─────────────────────────────────
  const markNotificationRead = useCallback(async (notificationId: string) => {
    setState(prev => {
      const updatedNotifications = prev.notifications.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      return { ...prev, notifications: updatedNotifications };
    });
  }, []);

  // ─── Mark All Notifications Read ────────────────────────────
  const markAllNotificationsRead = useCallback(async () => {
    setState(prev => {
      const updatedNotifications = prev.notifications.map(notif => ({ ...notif, read: true }));
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      return { ...prev, notifications: updatedNotifications };
    });
  }, []);

  // ─── Get Unread Count ─────────────────────────────────────
  const getUnreadCount = useCallback(() => {
    return stateRef.current.notifications.filter(n => !n.read).length;
  }, []);

  // ─── Send Message ───────────────────────────────────────────
  const sendMessage = useCallback(async (userId: string, content: string, type: 'text' | 'image' = 'text', imageUrl?: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to send messages' });
      return;
    }

    if (stateRef.current.blockedUsers.includes(userId)) {
      showErrorModal({ message: 'You have blocked this user. Unblock to send messages.' });
      return;
    }

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      chatId: `chat_${[currentUser.id, userId].sort().join('_')}`,
      senderId: currentUser.id,
      receiverId: userId,
      content,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      imageUrl: imageUrl ? normalizeImageUri(imageUrl) : undefined,
    };

    setState(prev => {
      const existingChat = prev.chats.find(c => c.participantId === userId);
      let updatedChats: Chat[];

      if (existingChat) {
        updatedChats = prev.chats.map(chat => 
          chat.id === existingChat.id 
            ? { 
                ...chat, 
                messages: [...chat.messages, newMessage],
                lastMessage: newMessage, 
                updatedAt: newMessage.timestamp,
              }
            : chat
        );
      } else {
        const participant = getUserById(userId);
        if (!participant) return prev;

        const newChat: Chat = {
          id: `chat_${Date.now()}`,
          participantId: userId,
          participant,
          messages: [newMessage],
          lastMessage: newMessage,
          unreadCount: 0,
          updatedAt: newMessage.timestamp,
        };
        updatedChats = [newChat, ...prev.chats];
      }

      const notification: Notification = {
        id: `notif_${Date.now()}`,
        type: 'message',
        userId: currentUser.id,
        user: currentUser,
        content: 'sent you a message',
        target: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
        time: 'Just now',
        timestamp: new Date().toISOString(),
        read: false,
      };

      const updatedNotifications = [notification, ...prev.notifications];

      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);

      return { ...prev, chats: updatedChats, notifications: updatedNotifications };
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [getUserById]);

  // ─── Get Chat Messages ──────────────────────────────────────
  const getChatMessages = useCallback((userId: string): Message[] => {
    const chat = stateRef.current.chats.find(c => c.participantId === userId);
    return chat?.messages || [];
  }, []);

  // ─── Mark Chat Read ─────────────────────────────────────────
  const markChatRead = useCallback(async (userId: string) => {
    setState(prev => {
      const updatedChats = prev.chats.map(chat => 
        chat.participantId === userId ? { ...chat, unreadCount: 0 } : chat
      );
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      return { ...prev, chats: updatedChats };
    });
  }, []);

  // ─── Get Or Create Chat ─────────────────────────────────────
  const getOrCreateChat = useCallback((userId: string) => {
    return stateRef.current.chats.find(c => c.participantId === userId);
  }, []);

  // ─── Set Typing Status ──────────────────────────────────────
  const setTypingStatus = useCallback((userId: string, isTyping: boolean) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(chat => 
        chat.participantId === userId ? { ...chat, isTyping } : chat
      ),
    }));

    const existingTimeout = typingTimeouts.current.get(userId);
    if (existingTimeout) clearTimeout(existingTimeout);

    if (isTyping) {
      const timeout = setTimeout(() => {
        setState(prev => ({
          ...prev,
          chats: prev.chats.map(chat => 
            chat.participantId === userId ? { ...chat, isTyping: false } : chat
          ),
        }));
      }, 3000);
      typingTimeouts.current.set(userId, timeout);
    }
  }, []);

  // ─── Get Typing Status ──────────────────────────────────────
  const getTypingStatus = useCallback((userId: string) => {
    const chat = stateRef.current.chats.find(c => c.participantId === userId);
    return chat?.isTyping || false;
  }, []);

  // ─── Delete Chat ────────────────────────────────────────────
  const deleteChat = useCallback(async (userId: string) => {
    setState(prev => {
      const updatedChats = prev.chats.filter(chat => chat.participantId !== userId);
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      return { ...prev, chats: updatedChats };
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // ─── Block User ─────────────────────────────────────────────
  const blockUser = useCallback(async (userId: string) => {
    setState(prev => {
      const isBlocked = prev.blockedUsers.includes(userId);
      let updatedBlockedUsers: string[];

      if (isBlocked) {
        updatedBlockedUsers = prev.blockedUsers.filter(id => id !== userId);
        showSuccessModal({ message: 'User unblocked' });
      } else {
        updatedBlockedUsers = [...prev.blockedUsers, userId];
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showSuccessModal({ message: 'User blocked' });
      }

      AsyncStorage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(updatedBlockedUsers)).catch(console.error);
      return { ...prev, blockedUsers: updatedBlockedUsers };
    });
  }, []);

  // ─── Is User Blocked ────────────────────────────────────────
  const isUserBlocked = useCallback((userId: string) => {
    return stateRef.current.blockedUsers.includes(userId);
  }, []);

  // ─── Refresh Feed ───────────────────────────────────────────
  const refreshFeed = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await new Promise(resolve => setTimeout(resolve, 1500));
    await loadPersistedData();
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  // ─── Load More Posts ────────────────────────────────────────
  const loadMorePosts = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, []);

  // ─── Update Community Profile ───────────────────────────────
  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityUser>) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, ...updates },
    }));

    if (updates.bio) await updateUserCommunityProfile({ bio: updates.bio });

    // Sync to all posts by this user
    if (updates.displayName || updates.handle || updates.avatar || updates.bio) {
      await syncUserProfileAcrossPosts(currentUser.id, updates);
    }
  }, [updateUserCommunityProfile, syncUserProfileAcrossPosts]);

  // ─── Get Current User Profile ───────────────────────────────
  const getCurrentUserProfile = useCallback(() => {
    return stateRef.current.currentUser;
  }, []);

  // ─── Check And Award Achievements ───────────────────────────
  const checkAndAwardAchievements = useCallback(async (): Promise<string[]> => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return [];
    const newAchievements: string[] = [];

    const checks = [
      { id: 'helpful_parent', condition: currentUser.stats.helpful >= 50 },
      { id: 'top_contributor', condition: currentUser.stats.helpful >= 100 },
      { id: 'rising_star', condition: currentUser.stats.followers >= 1000 },
    ];

    for (const check of checks) {
      if (check.condition && !currentUser.achievements.includes(check.id)) {
        await awardAchievement(check.id);
        newAchievements.push(check.id);
      }
    }

    return newAchievements;
  }, []);

  // ─── Get User Achievements ──────────────────────────────────
  const getUserAchievements = useCallback((userId: string): string[] => {
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser.achievements;
    const user = getUserById(userId);
    return user?.achievements || [];
  }, [getUserById]);

  // ─── Check Onboarding Status ──────────────────────────────────
  const checkOnboardingStatus = useCallback(async (): Promise<boolean> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.completed === true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // ─── Update Selected Topics ─────────────────────────────────
  const updateSelectedTopics = useCallback(async (topics: string[]) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    // Enforce max 5 topics
    if (topics.length > 5) {
      showErrorModal({ message: 'You can select up to 5 topics only.' });
      return;
    }

    await AsyncStorage.setItem(`${STORAGE_KEYS.SELECTED_TOPICS}_${currentUser.id}`, JSON.stringify(topics));
    await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_TOPICS, JSON.stringify(topics));

    // Also update onboarding data to keep in sync
    const onboardingData = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
    if (onboardingData) {
      const parsed = JSON.parse(onboardingData);
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify({
        ...parsed,
        selectedTopics: topics,
      }));
    }

    setState(prev => ({
      ...prev,
      selectedTopics: topics,
      currentUser: prev.currentUser ? { ...prev.currentUser, selectedTopics: topics } : null,
    }));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccessModal({ message: 'Topics updated successfully!' });
  }, []);

  // ─── Get Selected Topics ────────────────────────────────────
  const getSelectedTopics = useCallback((): string[] => {
    return stateRef.current.selectedTopics || [];
  }, []);

  // ─── Get Feed Posts (NEW: Personalized by selected topics) ──
  const getFeedPosts = useCallback((): Post[] => {
    const currentUser = stateRef.current.currentUser;
    const allPosts = stateRef.current.posts;
    
    if (!currentUser) return allPosts;

    // If user has selected topics, filter posts to those topics + their own posts
    const userTopics = currentUser.selectedTopics || [];
    
    if (userTopics.length === 0) {
      // No topics selected, show all posts except blocked users
      return allPosts.filter(post => !stateRef.current.blockedUsers.includes(post.authorId));
    }

    // Filter to posts from selected topics OR user's own posts
    return allPosts.filter(post => {
      if (post.authorId === currentUser.id) return true; // Always show own posts
      if (stateRef.current.blockedUsers.includes(post.authorId)) return false; // Hide blocked
      return userTopics.includes(post.topicId);
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // VALUE MEMOIZATION
  // ═══════════════════════════════════════════════════════════════
  const value = React.useMemo(() => ({
    ...state,
    createPost,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    bookmarkPost,
    deletePost,
    getPostById,
    voteHelpful,
    addComment,
    likeComment,
    voteCommentHelpful,
    replyToComment,
    joinTopic,
    leaveTopic,
    getTopicById,
    getPostsByTopic,
    followUser,
    unfollowUser,
    getUserById,
    getUserPosts,
    isFollowing,
    updateUserBio,
    updateUserLocation,
    updateOnlineStatus,
    getUserStats,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    sendMessage,
    getChatMessages,
    markChatRead,
    getOrCreateChat,
    setTypingStatus,
    getTypingStatus,
    deleteChat,
    blockUser,
    isUserBlocked,
    refreshFeed,
    loadMorePosts,
    updateCommunityProfile,
    getCurrentUserProfile,
    checkAndAwardAchievements,
    getUserAchievements,
    checkOnboardingStatus,
    updateSelectedTopics,
    getSelectedTopics,
    getFollowers,
    getFollowing,
    getAllUsers,
    syncUserProfileAcrossPosts,
    getFeedPosts,  // NEW
  }), [
    state,
    createPost,
    likePost,
    unlikePost,
    repostPost,
    unrepostPost,
    bookmarkPost,
    deletePost,
    getPostById,
    voteHelpful,
    addComment,
    likeComment,
    voteCommentHelpful,
    replyToComment,
    joinTopic,
    leaveTopic,
    getTopicById,
    getPostsByTopic,
    followUser,
    unfollowUser,
    getUserById,
    getUserPosts,
    isFollowing,
    updateUserBio,
    updateUserLocation,
    updateOnlineStatus,
    getUserStats,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    sendMessage,
    getChatMessages,
    markChatRead,
    getOrCreateChat,
    setTypingStatus,
    getTypingStatus,
    deleteChat,
    blockUser,
    isUserBlocked,
    refreshFeed,
    loadMorePosts,
    updateCommunityProfile,
    getCurrentUserProfile,
    checkAndAwardAchievements,
    getUserAchievements,
    checkOnboardingStatus,
    updateSelectedTopics,
    getSelectedTopics,
    getFollowers,
    getFollowing,
    getAllUsers,
    syncUserProfileAcrossPosts,
    getFeedPosts,
  ]);

  return (
    <CommunityContext.Provider value={value}>
      {state.isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <UniversalSpinner size={48} color="#667eea" />
        </View>
      ) : (
        children
      )}
    </CommunityContext.Provider>
  );
};

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (!context) throw new Error('useCommunity must be used within CommunityProvider');
  return context;
};

export default CommunityProvider;