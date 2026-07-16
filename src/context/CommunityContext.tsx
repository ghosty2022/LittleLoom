import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native'; // <-- add this line
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppSetting, setAppSetting, deleteAppSetting } from '@/database/dbHelpers';
import { useAuth } from './AuthContext';
import { useSweetAlert } from '../components/SweetAlert';
import { showAlert } from '@/utils/alert';

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
  POPULAR_POSTS: '@community_popular_posts_v2',
  TRENDING_TOPICS: '@community_trending_topics_v2',
  USER_ACTIVITY_LOG: '@community_user_activity_log_v2',
};

export type OnlineStatus = 'online' | 'offline' | 'away';

export type MessageType = 'text' | 'image';

export type PostMood = 'celebrating' | 'support' | 'advice' | 'milestone' | 'venting';

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  question: string;
  options: PollOption[];
  totalVotes: number;
  hasVoted: boolean;
  votedOptionId?: string;
}

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
  followers?: string[];
  following?: string[];
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
  popularityScore: number;
  viewCount: number;
  engagementRate: number;
  lastEngagedAt: string;
  isTrending: boolean;
  mood?: PostMood;
  poll?: Poll;
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
  engagementScore: number;
  weeklyGrowth: number;
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

export interface FileMetadata {
  name: string;
  size?: number;
  mimeType?: string;
  uri: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: MessageType;
  imageUrl?: string;
  fileMeta?: FileMetadata;
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: string;
  replyToPreview?: string;
  editedAt?: string;
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

export interface PopularPost {
  postId: string;
  score: number;
  timestamp: string;
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
  popularPosts: PopularPost[];
  trendingTopics: string[];
  isInitialized: boolean;
}

interface CommunityContextType extends CommunityState {
  createPost: (content: string, topicId: string, images?: string[], isAnonymous?: boolean, mood?: PostMood, poll?: Poll) => Promise<void>;
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
  sendMessage: (userId: string, content: string, type?: MessageType, imageUrl?: string, fileMeta?: FileMetadata, replyToId?: string) => Promise<void>;
  editMessage: (userId: string, messageId: string, newContent: string) => Promise<void>;
  resendMessage: (userId: string, messageId: string) => Promise<void>;
  deleteMessage: (userId: string, messageId: string) => Promise<void>;
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
  checkOnboardingStatus: () => Promise<{ completed: boolean; hasTopics: boolean }>;
  updateSelectedTopics: (topics: string[]) => Promise<void>;
  getSelectedTopics: () => string[];
  getFollowers: (userId: string) => Promise<string[]>;
  getFollowing: (userId: string) => Promise<string[]>;
  getAllUsers: () => CommunityUser[];
  syncUserProfileAcrossPosts: (userId: string, profileUpdates: Partial<CommunityUser>) => Promise<void>;
  getFeedPosts: () => Post[];
  getPopularPosts: (limit?: number) => Post[];
  getTrendingTopics: () => Topic[];
  incrementViewCount: (postId: string) => Promise<void>;
  getPostRank: (postId: string) => number;
  updateUsername: (newUsername: string) => Promise<{ success: boolean; message: string }>;
  updateDisplayName: (newName: string) => Promise<void>;
  updateAvatar: (avatarUri: string) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  getUserProfile: () => CommunityUser | null;
  isAuthenticated: () => boolean;
  votePoll: (postId: string, optionId: string) => Promise<void>;
}

const CommunityContext = createContext<CommunityContextType | null>(null);

export const INITIAL_TOPICS: Topic[] = [
  { id: 'topic_1', name: 'Potty Training', emoji: '🚽', color: '#667eea', members: 12500, posts: 3200, trending: true, description: 'Tips, tricks, and support for potty training success', isJoined: false, joinedBy: [], engagementScore: 85, weeklyGrowth: 12 },
  { id: 'topic_2', name: 'Sleep Tips', emoji: '😴', color: '#11998e', members: 18200, posts: 5100, trending: true, description: 'Better sleep for babies and parents', isJoined: false, joinedBy: [], engagementScore: 92, weeklyGrowth: 18 },
  { id: 'topic_3', name: 'Feeding & Nutrition', emoji: '🍼', color: '#fa709a', members: 15800, posts: 4700, trending: false, description: 'From breastfeeding to first foods', isJoined: false, joinedBy: [], engagementScore: 78, weeklyGrowth: 8 },
  { id: 'topic_4', name: 'Milestones', emoji: '🏆', color: '#fee140', members: 9300, posts: 2100, trending: false, description: 'Celebrate every achievement', isJoined: false, joinedBy: [], engagementScore: 65, weeklyGrowth: 5 },
  { id: 'topic_5', name: 'Health & Wellness', emoji: '💊', color: '#fc5c7d', members: 11700, posts: 3800, trending: true, description: 'Keeping your little ones healthy', isJoined: false, joinedBy: [], engagementScore: 88, weeklyGrowth: 15 },
  { id: 'topic_6', name: 'Parenting Hacks', emoji: '💡', color: '#6a82fb', members: 22400, posts: 8900, trending: true, description: 'Clever solutions for everyday challenges', isJoined: false, joinedBy: [], engagementScore: 95, weeklyGrowth: 22 },
  { id: 'topic_7', name: 'Baby Names', emoji: '✨', color: '#f093fb', members: 8500, posts: 4200, trending: false, description: 'Find the perfect name for your little one', isJoined: false, joinedBy: [], engagementScore: 72, weeklyGrowth: 7 },
  { id: 'topic_8', name: 'Work-Life Balance', emoji: '⚖️', color: '#4facfe', members: 11200, posts: 3600, trending: true, description: 'Juggling career and parenting', isJoined: false, joinedBy: [], engagementScore: 82, weeklyGrowth: 11 },
  { id: 'topic_9', name: 'Toddler Tantrums', emoji: '😤', color: '#fa709a', members: 15600, posts: 5400, trending: true, description: 'Navigating the terrible twos and beyond', isJoined: false, joinedBy: [], engagementScore: 90, weeklyGrowth: 17 },
  { id: 'topic_10', name: 'Education', emoji: '📚', color: '#43e97b', members: 9800, posts: 2800, trending: false, description: 'Early learning and school prep', isJoined: false, joinedBy: [], engagementScore: 70, weeklyGrowth: 6 },
  { id: 'topic_11', name: 'Single Parenting', emoji: '💪', color: '#fa709a', members: 7200, posts: 1900, trending: false, description: 'Support and advice for single parents', isJoined: false, joinedBy: [], engagementScore: 68, weeklyGrowth: 4 },
  { id: 'topic_12', name: 'Special Needs', emoji: '🌈', color: '#667eea', members: 6400, posts: 1500, trending: false, description: 'Resources and community for special needs parenting', isJoined: false, joinedBy: [], engagementScore: 75, weeklyGrowth: 9 },
];

const ACHIEVEMENTS = {
  FIRST_POST: { id: 'first_post', emoji: '📝', name: 'First Steps', description: 'Made your first post' },
  HELPFUL_PARENT: { id: 'helpful_parent', emoji: '💙', name: 'Helpful Parent', description: 'Received 50+ likes' },
  TOP_CONTRIBUTOR: { id: 'top_contributor', emoji: '🏆', name: 'Top Contributor', description: '100+ helpful posts' },
  STREAK_7: { id: 'streak_7', emoji: '🔥', name: '7 Day Streak', description: 'Active for 7 days' },
  STREAK_30: { id: 'streak_30', emoji: '🔥', name: '30 Day Streak', description: 'Active for 30 days' },
  RISING_STAR: { id: 'rising_star', emoji: '⭐', name: 'Rising Star', description: 'Gained 1000 followers' },
  STORYTELLER: { id: 'storyteller', emoji: '📖', name: 'Storyteller', description: '50+ posts shared' },
  SOCIAL_BUTTERFLY: { id: 'social_butterfly', emoji: '🦋', name: 'Social Butterfly', description: 'Following 100+ users' },
  TRENDSETTER: { id: 'trendsetter', emoji: '🚀', name: 'Trendsetter', description: 'Post reached 100+ reshares' },
  INFLUENCER: { id: 'influencer', emoji: '👑', name: 'Influencer', description: '10K+ total engagement' },
};

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
  achievements: ['top_contributor', 'rising_star', 'influencer'],
  isFollowing: false,
  followers: [],
  following: [],
};

const MOOD_CONFIG: Record<PostMood, { emoji: string; label: string; color: string; bgColor: string }> = {
  celebrating: { emoji: '🎉', label: 'Celebrating', color: '#f59e0b', bgColor: '#f59e0b15' },
  support: { emoji: '💙', label: 'Support', color: '#3b82f6', bgColor: '#3b82f615' },
  advice: { emoji: '💡', label: 'Advice', color: '#8b5cf6', bgColor: '#8b5cf615' },
  milestone: { emoji: '🏆', label: 'Milestone', color: '#10b981', bgColor: '#10b98115' },
  venting: { emoji: '💨', label: 'Venting', color: '#ef4444', bgColor: '#ef444415' },
};

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
    popularityScore: 9999,
    viewCount: 15000,
    engagementRate: 0.85,
    lastEngagedAt: timestamp,
    isTrending: true,
  };
};

const normalizeImageUri = (uri: string): string => {
  if (!uri) return '';
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
};

const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const calculatePopularityScore = (post: Post): number => {
  const likesWeight = 1;
  const commentsWeight = 2;
  const repostsWeight = 3;
  const helpfulWeight = 2;
  const viewsWeight = 0.1;
  const recencyBonus = Math.max(0, 24 - (Date.now() - new Date(post.timestamp).getTime()) / (1000 * 60 * 60));
  
  return (
    post.likes * likesWeight +
    post.commentsCount * commentsWeight +
    post.reposts * repostsWeight +
    post.helpfulVotes * helpfulWeight +
    post.viewCount * viewsWeight +
    recencyBonus * 10
  );
};

const validateTopicIds = (topicIds: string[]): string[] => {
  const validTopicIds = new Set(INITIAL_TOPICS.map(t => t.id));
  return topicIds.filter(id => validTopicIds.has(id));
};

export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const sweetAlert = useSweetAlert(); 

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
    popularPosts: [],
    trendingTopics: [],
    isInitialized: false,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const stateRef = useRef(state);
  const persistQueue = useRef<Set<string>>(new Set());
  const isPersisting = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    loadPersistedData();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    const syncInterval = setInterval(processPersistQueue, 5000);
    const trendingInterval = setInterval(updateTrendingData, 300000);

    return () => {
      subscription.remove();
      clearInterval(syncInterval);
      clearInterval(trendingInterval);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    
    if (isAuthenticated && userProfile) {
      syncWithAuthUser(userProfile);
    } else if (!isAuthenticated && state.currentUser) {
      setState(prev => ({
        ...prev,
        currentUser: prev.currentUser ? {
          ...prev.currentUser,
          onlineStatus: 'offline'
        } : null
      }));
    }
  }, [isAuthenticated, userProfile, authLoading]);

  const syncWithAuthUser = async (authProfile: any) => {
    try {
      const savedTopicsKey = `${STORAGE_KEYS.SELECTED_TOPICS}_${authProfile.id}`;
      const savedTopicsData = await getAppSetting(savedTopicsKey);
      const savedTopics = savedTopicsData ? JSON.parse(savedTopicsData) : [];
      
      const globalTopicsData = await getAppSetting(STORAGE_KEYS.SELECTED_TOPICS);
      const globalTopics = globalTopicsData ? JSON.parse(globalTopicsData) : [];
      
      const mergedTopics = savedTopics.length > 0 ? savedTopics : (authProfile.communitySelectedTopics || globalTopics);
      
      const validTopics = validateTopicIds(mergedTopics);

      const existingStats = await getAppSetting(`${STORAGE_KEYS.USER_STATS}_${authProfile.id}`);
      const parsedStats = existingStats ? JSON.parse(existingStats) : null;

      const communityUser: CommunityUser = {
        id: authProfile.id,
        displayName: authProfile.communityDisplayName || authProfile.fullName || 'Parent',
        handle: authProfile.communityHandle || `@${(authProfile.fullName || 'parent').toLowerCase().replace(/\s+/g, '_')}`,
        avatar: authProfile.communityAvatar || authProfile.avatar || '👤',
        isVerified: false,
        bio: authProfile.communityBio || '',
        location: '',
        country: 'Unknown',
        onlineStatus: 'online',
        lastActive: new Date().toISOString(),
        stats: parsedStats || {
          posts: 0,
          followers: 1,
          following: 1,
          helpful: 0,
          streakDays: 0,
          lastStreakDate: new Date().toISOString(),
        },
        achievements: [],
        selectedTopics: validTopics,
        followers: ['littleloom_team'],
        following: ['littleloom_team'],
      };

      setState(prev => ({
        ...prev,
        currentUser: communityUser,
        selectedTopics: validTopics,
      }));

      if (!communityUser.following?.includes('littleloom_team')) {
        const updatedFollowing = ['littleloom_team', ...(communityUser.following || [])];
        await setAppSetting(
          `${STORAGE_KEYS.USER_FOLLOWING}_${authProfile.id}`,
          JSON.stringify(updatedFollowing)
        );
      }

      await updateOnlineStatus('online');
      await checkStreak();
    } catch (error) {
      console.error('Error syncing with auth user:', error);
    }
  };

  const updateTrendingData = () => {
    setState(prev => {
      const topicScores = new Map<string, number>();
      prev.posts.forEach(post => {
        const score = calculatePopularityScore(post);
        const current = topicScores.get(post.topicId) || 0;
        topicScores.set(post.topicId, current + score);
      });

      const trendingTopics = Array.from(topicScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      const popularPosts = prev.posts
        .map(post => ({
          postId: post.id,
          score: calculatePopularityScore(post),
          timestamp: post.timestamp,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      return {
        ...prev,
        trendingTopics,
        popularPosts,
      };
    });
  };

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
        promises.push(setAppSetting(STORAGE_KEYS.SELECTED_TOPICS, JSON.stringify(currentState.selectedTopics)));
        if (currentState.currentUser?.id) {
          promises.push(setAppSetting(
            `${STORAGE_KEYS.SELECTED_TOPICS}_${currentState.currentUser.id}`,
            JSON.stringify(currentState.selectedTopics)
          ));
        }
      }
      if (keysToPersist.includes('popularPosts')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.POPULAR_POSTS, JSON.stringify(currentState.popularPosts)));
      }
      if (keysToPersist.includes('trendingTopics')) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.TRENDING_TOPICS, JSON.stringify(currentState.trendingTopics)));
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

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      await updateOnlineStatus('online');
      await checkStreak();
    } else if (nextAppState === 'background') {
      await updateOnlineStatus('away');
      await processPersistQueue();
    }
  };

  const loadPersistedData = async () => {
    try {
      const currentUserId = userProfile?.id;

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
        popularPostsData,
        trendingTopicsData,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.POSTS),
        AsyncStorage.getItem(STORAGE_KEYS.TOPICS),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
        AsyncStorage.getItem(STORAGE_KEYS.BLOCKED_USERS),
        currentUserId 
          ? getAppSetting(`${STORAGE_KEYS.SELECTED_TOPICS}_${currentUserId}`)
          : Promise.resolve(null),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
        AsyncStorage.getItem(STORAGE_KEYS.LIKES),
        AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKS),
        AsyncStorage.getItem(STORAGE_KEYS.REPOSTS),
        AsyncStorage.getItem(STORAGE_KEYS.POPULAR_POSTS),
        AsyncStorage.getItem(STORAGE_KEYS.TRENDING_TOPICS),
      ]);

      const globalTopicsData = await getAppSetting(STORAGE_KEYS.SELECTED_TOPICS);

      let loadedPosts: Post[] = postsData ? JSON.parse(postsData) : [];
      const loadedTopics = topicsData ? JSON.parse(topicsData) : INITIAL_TOPICS;
      
      let loadedSelectedTopics: string[] = selectedTopicsData 
        ? JSON.parse(selectedTopicsData) 
        : (globalTopicsData ? JSON.parse(globalTopicsData) : []);
        
      const loadedPopularPosts = popularPostsData ? JSON.parse(popularPostsData) : [];
      const loadedTrendingTopics = trendingTopicsData ? JSON.parse(trendingTopicsData) : [];

      const likedPosts: string[] = likesData ? JSON.parse(likesData) : [];
      const bookmarkedPosts: string[] = bookmarksData ? JSON.parse(bookmarksData) : [];
      const repostedPosts: string[] = repostsData ? JSON.parse(repostsData) : [];

      if (loadedPosts.length > 0) {
        loadedPosts = loadedPosts.map(post => ({
          ...post,
          isLiked: likedPosts.includes(post.id),
          isBookmarked: bookmarkedPosts.includes(post.id),
          isReposted: repostedPosts.includes(post.id),
        }));
      }

      if (onboardingData) {
        const parsedOnboarding = JSON.parse(onboardingData);
        if (loadedSelectedTopics.length === 0 && parsedOnboarding.selectedTopics?.length > 0) {
          loadedSelectedTopics = parsedOnboarding.selectedTopics;
        }
      }

      loadedSelectedTopics = validateTopicIds(loadedSelectedTopics);

      if (loadedPosts.length === 0) {
        loadedPosts = [createDefaultPost()];
        await AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(loadedPosts));
      }

      setIsInitialized(true);
      
      setState(prev => ({
        ...prev,
        posts: loadedPosts,
        topics: loadedTopics,
        notifications: notificationsData ? JSON.parse(notificationsData) : [],
        chats: chatsData ? JSON.parse(chatsData) : [],
        blockedUsers: blockedUsersData ? JSON.parse(blockedUsersData) : [],
        selectedTopics: loadedSelectedTopics,
        popularPosts: loadedPopularPosts,
        trendingTopics: loadedTrendingTopics,
        isInitialized: true,
        isLoading: false,
      }));

      updateTrendingData();
    } catch (error) {
      console.error('Error loading persisted data:', error);
      setIsInitialized(true);
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        isInitialized: true,
      }));
    }
  };

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

    await setAppSetting(`${STORAGE_KEYS.USER_STATS}_${stateRef.current.currentUser.id}`, JSON.stringify(updatedStats));

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, stats: updatedStats } : null,
    }));

    if (newStreak === 7) await awardAchievement('streak_7');
    if (newStreak === 30) await awardAchievement('streak_30');
  };

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
      console.log(`Achievement unlocked: ${achievement.emoji} ${achievement.name}`);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const syncUserProfileAcrossPosts = useCallback(async (userId: string, profileUpdates: Partial<CommunityUser>) => {
    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.authorId === userId) {
          return {
            ...post,
            author: { ...post.author, ...profileUpdates },
          };
        }
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

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);

      return {
        ...prev,
        posts: updatedPosts,
        currentUser: updatedCurrentUser,
      };
    });
  }, []);

  const createPost = useCallback(async (content: string, topicId: string, images?: string[], isAnonymous?: boolean, mood?: PostMood, poll?: Poll) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to create posts', 'warning');
      return;
    }

    const topic = stateRef.current.topics.find(t => t.id === topicId);
    if (!topic) {
      sweetAlert.alert('Error', 'Topic not found', 'warning');
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();

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
      popularityScore: 0,
      viewCount: 0,
      engagementRate: 0,
      lastEngagedAt: timestamp,
      isTrending: false,
      mood,
      poll: poll ? { ...poll, totalVotes: 0, hasVoted: false } : undefined,
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

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(updatedTopics)).catch(console.error);
      setAppSetting(`${STORAGE_KEYS.USER_STATS}_${currentUser.id}`, JSON.stringify(updatedStats)).catch(console.error);

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
    console.log('Post created successfully!');
  }, []);

  const votePoll = useCallback(async (postId: string, optionId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to vote', 'warning');
      return;
    }

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && post.poll && !post.poll.hasVoted) {
          const updatedOptions = post.poll.options.map(opt => 
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          );
          const totalVotes = updatedOptions.reduce((sum, opt) => sum + opt.votes, 0);
          
          return {
            ...post,
            poll: {
              ...post.poll,
              options: updatedOptions,
              totalVotes,
              hasVoted: true,
              votedOptionId: optionId,
            },
            lastEngagedAt: new Date().toISOString(),
            popularityScore: calculatePopularityScore({
              ...post,
              poll: {
                ...post.poll,
                options: updatedOptions,
                totalVotes,
                hasVoted: true,
                votedOptionId: optionId,
              },
            }),
          };
        }
        return post;
      });

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      queuePersist('popularPosts');

      return { ...prev, posts: updatedPosts };
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const likePost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to like posts', 'warning');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setState(prev => {
      let newNotification: Notification | null = null;
      let targetPost: Post | null = null;

      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          targetPost = post;
          const isNowLiked = !post.likedBy.includes(currentUser.id);
          
          if (isNowLiked) {
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
            
            const updatedPost = {
              ...post,
              isLiked: true,
              likes: post.likes + 1,
              likedBy: [...post.likedBy, currentUser.id],
              lastEngagedAt: new Date().toISOString(),
              popularityScore: calculatePopularityScore({ ...post, likes: post.likes + 1 }),
            };
            return updatedPost;
          } else {
            return {
              ...post,
              isLiked: false,
              likes: Math.max(0, post.likes - 1),
              likedBy: post.likedBy.filter(id => id !== currentUser.id),
              lastEngagedAt: new Date().toISOString(),
              popularityScore: calculatePopularityScore({ ...post, likes: post.likes - 1 }),
            };
          }
        }
        return post;
      });

      const updatedNotifications = newNotification 
        ? [newNotification, ...prev.notifications] 
        : prev.notifications;

      const allLikedPosts = updatedPosts.filter(p => p.isLiked).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(allLikedPosts)).catch(console.error);
      
      if (newNotification) {
        AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      }
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      queuePersist('popularPosts');

      return { ...prev, posts: updatedPosts, notifications: updatedNotifications };
    });
  }, []);

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
            lastEngagedAt: new Date().toISOString(),
            popularityScore: calculatePopularityScore({ ...post, likes: post.likes - 1 }),
          };
        }
        return post;
      });

      const allLikedPosts = updatedPosts.filter(p => p.isLiked).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(allLikedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      queuePersist('popularPosts');

      return { ...prev, posts: updatedPosts };
    });
  }, []);

  const repostPost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to repost', 'warning');
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

          const updatedPost = {
            ...post,
            isReposted: true,
            reposts: post.reposts + 1,
            repostedBy: [...post.repostedBy, currentUser.id],
            lastEngagedAt: new Date().toISOString(),
            popularityScore: calculatePopularityScore({ ...post, reposts: post.reposts + 1 }),
          };
          return updatedPost;
        }
        return post;
      });

      const updatedNotifications = newNotification 
        ? [newNotification, ...prev.notifications] 
        : prev.notifications;

      const allRepostedPosts = updatedPosts.filter(p => p.isReposted).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.REPOSTS, JSON.stringify(allRepostedPosts)).catch(console.error);
      
      if (newNotification) {
        AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      }
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      queuePersist('popularPosts');

      const repostedPost = updatedPosts.find(p => p.id === postId);
      if (repostedPost && repostedPost.reposts >= 100) {
        awardAchievement('trendsetter');
      }

      return { ...prev, posts: updatedPosts, notifications: updatedNotifications };
    });
  }, []);

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
            lastEngagedAt: new Date().toISOString(),
            popularityScore: calculatePopularityScore({ ...post, reposts: post.reposts - 1 }),
          };
        }
        return post;
      });

      const allRepostedPosts = updatedPosts.filter(p => p.isReposted).map(p => p.id);
      AsyncStorage.setItem(STORAGE_KEYS.REPOSTS, JSON.stringify(allRepostedPosts)).catch(console.error);
      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      queuePersist('popularPosts');

      return { ...prev, posts: updatedPosts };
    });
  }, []);

  const bookmarkPost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to bookmark', 'warning');
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

  const voteHelpful = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && !post.votedHelpfulBy.includes(currentUser.id)) {
          const updatedPost = {
            ...post,
            helpfulVotes: post.helpfulVotes + 1,
            votedHelpfulBy: [...post.votedHelpfulBy, currentUser.id],
            lastEngagedAt: new Date().toISOString(),
            popularityScore: calculatePopularityScore({ ...post, helpfulVotes: post.helpfulVotes + 1 }),
          };
          return updatedPost;
        }
        return post;
      });

      AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
      queuePersist('popularPosts');

      const totalHelpful = updatedPosts
        .filter(p => p.authorId === currentUser.id)
        .reduce((sum, p) => sum + p.helpfulVotes, 0);
      if (totalHelpful >= 50) awardAchievement('helpful_parent');
      if (totalHelpful >= 100) awardAchievement('top_contributor');

      return { ...prev, posts: updatedPosts };
    });
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to delete posts', 'warning');
      return;
    }

    const post = stateRef.current.posts.find(p => p.id === postId);
    if (!post) {
      sweetAlert.alert('Error', 'Post not found', 'error');
      return;
    }

    if (post.authorId !== currentUser.id) {
      sweetAlert.alert('Unauthorized', 'You can only delete your own posts', 'warning');
      return;
    }

    sweetAlert.confirm(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      async () => {
        setState(prev => {
          const updatedPosts = prev.posts.filter(p => p.id !== postId);
          const updatedTopics = prev.topics.map(t => 
            t.id === post.topicId 
              ? { ...t, posts: Math.max(0, t.posts - 1) }
              : t
          );

          const updatedStats = {
            ...currentUser.stats,
            posts: Math.max(0, currentUser.stats.posts - 1),
          };

          AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(updatedPosts)).catch(console.error);
          AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(updatedTopics)).catch(console.error);
          setAppSetting(`${STORAGE_KEYS.USER_STATS}_${currentUser.id}`, JSON.stringify(updatedStats)).catch(console.error);

          return {
            ...prev,
            posts: updatedPosts,
            topics: updatedTopics,
            currentUser: { ...currentUser, stats: updatedStats },
          };
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('Post deleted successfully');
      },
      undefined,
      'Delete',
      'Cancel',
      true
    );
  }, []);

  const getPostById = useCallback((postId: string) => {
    return stateRef.current.posts.find(post => post.id === postId);
  }, []);

  const addComment = useCallback(async (postId: string, content: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to comment', 'warning');
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

          const updatedPost = {
            ...post,
            comments: [...post.comments, newComment],
            commentsCount: post.commentsCount + 1,
            lastEngagedAt: new Date().toISOString(),
            popularityScore: calculatePopularityScore({ ...post, commentsCount: post.commentsCount + 1 }),
          };
          return updatedPost;
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
      queuePersist('popularPosts');

      return { ...prev, posts: updatedPosts, notifications: updatedNotifications };
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

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

  const joinTopic = useCallback(async (topicId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to join topics', 'warning');
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

  const getTopicById = useCallback((topicId: string) => {
    return stateRef.current.topics.find(topic => topic.id === topicId);
  }, []);

  const getPostsByTopic = useCallback((topicId: string) => {
    return stateRef.current.posts.filter(post => post.topicId === topicId);
  }, []);

  const followUser = useCallback(async (userId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser || userId === currentUser.id) {
      sweetAlert.alert('Error', 'Cannot follow yourself', 'warning');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const followersKey = `${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`;
    const followingKey = `${STORAGE_KEYS.USER_FOLLOWING}_${currentUser.id}`;

    const existingFollowers = await AsyncStorage.getItem(followersKey);
    const followers = existingFollowers ? JSON.parse(existingFollowers) : [];
    if (!followers.includes(currentUser.id)) {
      followers.push(currentUser.id);
      await AsyncStorage.setItem(followersKey, JSON.stringify(followers));
    }

    const existingFollowing = await AsyncStorage.getItem(followingKey);
    const following = existingFollowing ? JSON.parse(existingFollowing) : [];
    if (!following.includes(userId)) {
      following.push(userId);
      await setAppSetting(followingKey, JSON.stringify(following));
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

  const unfollowUser = useCallback(async (userId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    const followersKey = `${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`;
    const followingKey = `${STORAGE_KEYS.USER_FOLLOWING}_${currentUser.id}`;

    const existingFollowers = await AsyncStorage.getItem(followersKey);
    const followers = existingFollowers ? JSON.parse(existingFollowers) : [];
    const updatedFollowers = followers.filter((id: string) => id !== currentUser.id);
    await setAppSetting(followersKey, JSON.stringify(updatedFollowers));

    const existingFollowing = await AsyncStorage.getItem(followingKey);
    const following = existingFollowing ? JSON.parse(existingFollowing) : [];
    const updatedFollowing = following.filter((id: string) => id !== userId);
    await setAppSetting(followingKey, JSON.stringify(updatedFollowing));

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

  const getUserById = useCallback((userId: string) => {
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser;
    if (userId === 'littleloom_team') return LITTLELOOM_TEAM;
    const post = stateRef.current.posts.find(p => p.authorId === userId);
    if (post) return post.author;
    return undefined;
  }, []);

  const getUserPosts = useCallback((userId: string) => {
    return stateRef.current.posts.filter(post => post.authorId === userId);
  }, []);

  const isFollowing = useCallback((userId: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return false;
    return currentUser.following?.includes(userId) || false;
  }, []);

  const getFollowers = useCallback(async (userId: string): Promise<string[]> => {
    try {
      const followersKey = `${STORAGE_KEYS.USER_FOLLOWERS}_${userId}`;
      const existingFollowers = await getAppSetting(followersKey);
      if (existingFollowers) {
        return JSON.parse(existingFollowers);
      }
      if (userId === stateRef.current.currentUser?.id) {
        return ['littleloom_team'];
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const getFollowing = useCallback(async (userId: string): Promise<string[]> => {
    try {
      const followingKey = `${STORAGE_KEYS.USER_FOLLOWING}_${userId}`;
      const existingFollowing = await getAppSetting(followingKey);
      if (existingFollowing) {
        return JSON.parse(existingFollowing);
      }
      return [];
    } catch {
      return [];
    }
  }, []);

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

  const updateUserBio = useCallback(async (bio: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, bio },
    }));
  }, []);

  const updateUserLocation = useCallback(async (country: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, country },
    }));
  }, []);

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

  const getUserStats = useCallback((userId: string) => {
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser.stats;
    const user = getUserById(userId);
    return user?.stats;
  }, [getUserById]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setState(prev => {
      const updatedNotifications = prev.notifications.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      return { ...prev, notifications: updatedNotifications };
    });
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setState(prev => {
      const updatedNotifications = prev.notifications.map(notif => ({ ...notif, read: true }));
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifications)).catch(console.error);
      return { ...prev, notifications: updatedNotifications };
    });
  }, []);

  const getUnreadCount = useCallback(() => {
    return stateRef.current.notifications.filter(n => !n.read).length;
  }, []);

  const sendMessage = useCallback(async (userId: string, content: string, type: MessageType = 'text', imageUrl?: string, fileMeta?: FileMetadata, replyToId?: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to send messages', 'warning');
      return;
    }

    if (stateRef.current.blockedUsers.includes(userId)) {
      sweetAlert.alert('Blocked', 'You have blocked this user. Unblock to send messages.', 'warning');
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
      fileMeta,
      deliveryStatus: 'sent',
      replyTo: replyToId,
      replyToPreview: replyToId
        ? stateRef.current.chats.find(c => c.participantId === userId)?.messages.find(m => m.id === replyToId)?.content.substring(0, 60)
        : undefined,
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

  const editMessage = useCallback(async (userId: string, messageId: string, newContent: string) => {
    setState(prev => {
      const updatedChats = prev.chats.map(chat =>
        chat.participantId === userId
          ? {
              ...chat,
              messages: chat.messages.map(m =>
                m.id === messageId ? { ...m, content: newContent, editedAt: new Date().toISOString() } : m
              ),
              lastMessage: chat.lastMessage.id === messageId
                ? { ...chat.lastMessage, content: newContent, editedAt: new Date().toISOString() }
                : chat.lastMessage,
            }
          : chat
      );
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      return { ...prev, chats: updatedChats };
    });
  }, []);

  const resendMessage = useCallback(async (userId: string, messageId: string) => {
    setState(prev => {
      const updatedChats = prev.chats.map(chat =>
        chat.participantId === userId
          ? {
              ...chat,
              messages: chat.messages.map(m =>
                m.id === messageId ? { ...m, deliveryStatus: 'sent' as const, timestamp: new Date().toISOString() } : m
              ),
            }
          : chat
      );
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      return { ...prev, chats: updatedChats };
    });
  }, []);

  const deleteMessage = useCallback(async (userId: string, messageId: string) => {
    setState(prev => {
      const updatedChats = prev.chats.map(chat =>
        chat.participantId === userId
          ? { ...chat, messages: chat.messages.filter(m => m.id !== messageId) }
          : chat
      );
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      return { ...prev, chats: updatedChats };
    });
  }, []);

  const getChatMessages = useCallback((userId: string): Message[] => {
    const chat = stateRef.current.chats.find(c => c.participantId === userId);
    return chat?.messages || [];
  }, []);

  const markChatRead = useCallback(async (userId: string) => {
    setState(prev => {
      const updatedChats = prev.chats.map(chat => 
        chat.participantId === userId ? { ...chat, unreadCount: 0 } : chat
      );
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      return { ...prev, chats: updatedChats };
    });
  }, []);

  const getOrCreateChat = useCallback((userId: string) => {
    return stateRef.current.chats.find(c => c.participantId === userId);
  }, []);

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

  const getTypingStatus = useCallback((userId: string) => {
    const chat = stateRef.current.chats.find(c => c.participantId === userId);
    return chat?.isTyping || false;
  }, []);

  const deleteChat = useCallback(async (userId: string) => {
    setState(prev => {
      const updatedChats = prev.chats.filter(chat => chat.participantId !== userId);
      AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedChats)).catch(console.error);
      return { ...prev, chats: updatedChats };
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    setState(prev => {
      const isBlocked = prev.blockedUsers.includes(userId);
      let updatedBlockedUsers: string[];

      if (isBlocked) {
        updatedBlockedUsers = prev.blockedUsers.filter(id => id !== userId);
        console.log('User unblocked');
      } else {
        updatedBlockedUsers = [...prev.blockedUsers, userId];
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        console.log('User blocked');
      }

      AsyncStorage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(updatedBlockedUsers)).catch(console.error);
      return { ...prev, blockedUsers: updatedBlockedUsers };
    });
  }, []);

  const isUserBlocked = useCallback((userId: string) => {
    return stateRef.current.blockedUsers.includes(userId);
  }, []);

  const refreshFeed = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await new Promise(resolve => setTimeout(resolve, 1500));
    await loadPersistedData();
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  const loadMorePosts = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, []);

  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityUser>) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, ...updates },
    }));

    if (updates.displayName || updates.handle || updates.avatar || updates.bio) {
      await syncUserProfileAcrossPosts(currentUser.id, updates);
    }
  }, [syncUserProfileAcrossPosts]);

  const getCurrentUserProfile = useCallback(() => {
    return stateRef.current.currentUser;
  }, []);

  const checkAndAwardAchievements = useCallback(async (): Promise<string[]> => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return [];
    const newAchievements: string[] = [];

    const checks = [
      { id: 'helpful_parent', condition: currentUser.stats.helpful >= 50 },
      { id: 'top_contributor', condition: currentUser.stats.helpful >= 100 },
      { id: 'rising_star', condition: currentUser.stats.followers >= 1000 },
      { id: 'influencer', condition: (currentUser.stats.followers + currentUser.stats.following + currentUser.stats.posts) >= 10000 },
    ];

    for (const check of checks) {
      if (check.condition && !currentUser.achievements.includes(check.id)) {
        await awardAchievement(check.id);
        newAchievements.push(check.id);
      }
    }

    return newAchievements;
  }, []);

  const getUserAchievements = useCallback((userId: string): string[] => {
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser.achievements;
    const user = getUserById(userId);
    return user?.achievements || [];
  }, [getUserById]);

  const checkOnboardingStatus = useCallback(async (): Promise<{ completed: boolean; hasTopics: boolean }> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
      if (data) {
        const parsed = JSON.parse(data);
        const completed = parsed.completed === true;
        
        const rawTopics = parsed.selectedTopics || [];
        const validTopics = validateTopicIds(rawTopics);
        const hasTopics = validTopics.length > 0;
        
        const isTrulyComplete = completed && (hasTopics || parsed.skipped === true);
        
        return { completed: isTrulyComplete, hasTopics };
      }
      return { completed: false, hasTopics: false };
    } catch {
      return { completed: false, hasTopics: false };
    }
  }, []);

  const updateSelectedTopics = useCallback(async (topics: string[]) => {
    const validTopics = validateTopicIds(topics);
    
    if (validTopics.length > 5) {
      sweetAlert.alert('Limit Reached', 'You can select up to 5 topics only.', 'warning');
      return;
    }

    const currentUser = stateRef.current.currentUser;

    await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_TOPICS, JSON.stringify(validTopics));

    if (currentUser?.id) {
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.SELECTED_TOPICS}_${currentUser.id}`,
        JSON.stringify(validTopics)
      );
    }

    const onboardingData = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
    if (onboardingData) {
      const parsed = JSON.parse(onboardingData);
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify({
        ...parsed,
        selectedTopics: validTopics,
        completed: true,
      }));
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify({
        completed: true,
        selectedTopics: validTopics,
        timestamp: new Date().toISOString(),
      }));
    }

    setState(prev => ({
      ...prev,
      selectedTopics: validTopics,
      currentUser: prev.currentUser ? { ...prev.currentUser, selectedTopics: validTopics } : null,
    }));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    console.log('Topics updated successfully!');
  }, []);

  const getSelectedTopics = useCallback((): string[] => {
    const rawTopics = stateRef.current.selectedTopics || [];
    return validateTopicIds(rawTopics);
  }, []);

  const getFeedPosts = useCallback((): Post[] => {
    const currentUser = stateRef.current.currentUser;
    const allPosts = stateRef.current.posts;
    
    if (!currentUser) return allPosts;

    const userTopics = currentUser.selectedTopics || [];
    
    if (userTopics.length === 0) {
      return allPosts.filter(post => !stateRef.current.blockedUsers.includes(post.authorId));
    }

    return allPosts.filter(post => {
      if (post.authorId === currentUser.id) return true;
      if (stateRef.current.blockedUsers.includes(post.authorId)) return false;
      return userTopics.includes(post.topicId);
    });
  }, []);

  const getPopularPosts = useCallback((limit: number = 10): Post[] => {
    return [...stateRef.current.posts]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);
  }, []);

  const getTrendingTopics = useCallback((): Topic[] => {
    return stateRef.current.topics
      .filter(t => t.trending)
      .sort((a, b) => b.engagementScore - a.engagementScore);
  }, []);

  const incrementViewCount = useCallback(async (postId: string) => {
    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            viewCount: post.viewCount + 1,
            popularityScore: calculatePopularityScore({ ...post, viewCount: post.viewCount + 1 }),
          };
        }
        return post;
      });
      return { ...prev, posts: updatedPosts };
    });
  }, []);

  const getPostRank = useCallback((postId: string): number => {
    const sorted = [...stateRef.current.posts].sort((a, b) => b.popularityScore - a.popularityScore);
    return sorted.findIndex(p => p.id === postId) + 1;
  }, []);

  const updateUsername = useCallback(async (newUsername: string): Promise<{ success: boolean; message: string }> => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return { success: false, message: 'Not authenticated' };

    const trimmed = newUsername.trim().toLowerCase().replace(/^@/, '');
    
    if (trimmed.length < 3) return { success: false, message: 'Username must be at least 3 characters' };
    if (trimmed.length > 30) return { success: false, message: 'Username must be less than 30 characters' };
    
    const validPattern = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
    if (!validPattern.test(trimmed)) {
      return { success: false, message: 'Must start with a letter. Only letters, numbers, underscores, and dots allowed.' };
    }

    const newHandle = `@${trimmed}`;
    
    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, handle: newHandle } : null,
    }));

    await syncUserProfileAcrossPosts(currentUser.id, { handle: newHandle });

    return { success: true, message: 'Username updated successfully' };
  }, [syncUserProfileAcrossPosts]);

  const updateDisplayName = useCallback(async (newName: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    const trimmed = newName.trim();
    if (!trimmed) return;

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, displayName: trimmed } : null,
    }));

    await syncUserProfileAcrossPosts(currentUser.id, { displayName: trimmed });
  }, [syncUserProfileAcrossPosts]);

  const updateAvatar = useCallback(async (avatarUri: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    const normalized = normalizeImageUri(avatarUri);

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, avatar: normalized } : null,
    }));

    await syncUserProfileAcrossPosts(currentUser.id, { avatar: normalized });
  }, [syncUserProfileAcrossPosts]);

  const updateBio = useCallback(async (bio: string) => {
    const currentUser = stateRef.current.currentUser;
    if (!currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, bio: bio.trim() } : null,
    }));

    await syncUserProfileAcrossPosts(currentUser.id, { bio: bio.trim() });
  }, [syncUserProfileAcrossPosts]);

  const getUserProfile = useCallback(() => {
    return stateRef.current.currentUser;
  }, []);

  const checkIsAuthenticated = useCallback(() => {
    return !!stateRef.current.currentUser;
  }, []);

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
    editMessage,
    resendMessage,
    deleteMessage,
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
    getPopularPosts,
    getTrendingTopics,
    incrementViewCount,
    getPostRank,
    updateUsername,
    updateDisplayName,
    updateAvatar,
    updateBio,
    getUserProfile,
    isAuthenticated: checkIsAuthenticated,
    votePoll,
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
    editMessage,
    resendMessage,
    deleteMessage,
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
    getPopularPosts,
    getTrendingTopics,
    incrementViewCount,
    getPostRank,
    updateUsername,
    updateDisplayName,
    updateAvatar,
    updateBio,
    getUserProfile,
    checkIsAuthenticated,
    votePoll,
  ]);

  return (
    <CommunityContext.Provider value={value}>
      {children}
    </CommunityContext.Provider>
  );
}

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (!context) throw new Error('useCommunity must be used within CommunityProvider');
  return context;
};

export default CommunityProvider;
