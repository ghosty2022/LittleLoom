// src/context/CommunityContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useUser } from './UserContext';
import { showSuccessModal, showErrorModal, showConfirmModal } from '../utils/modal';
import UniversalSpinner from '../components/UniversalSpinner';

// Storage Keys
const STORAGE_KEYS = {
  POSTS: '@community_posts',
  TOPICS: '@community_topics',
  LIKES: '@community_likes',
  BOOKMARKS: '@community_bookmarks',
  REPOSTS: '@community_reposts',
  FOLLOWS: '@community_follows',
  COMMENTS: '@community_comments',
  MESSAGES: '@community_messages',
  NOTIFICATIONS: '@community_notifications',
  USER_STATS: '@community_user_stats',
  LAST_SYNC: '@community_last_sync',
};

// Types
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
}

interface CommunityContextType extends CommunityState {
  // Post operations
  createPost: (content: string, topicId: string, images?: string[], isAnonymous?: boolean) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  repostPost: (postId: string) => Promise<void>;
  unrepostPost: (postId: string) => Promise<void>;
  bookmarkPost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  getPostById: (postId: string) => Post | undefined;
  voteHelpful: (postId: string) => Promise<void>;
  
  // Comment operations
  addComment: (postId: string, content: string) => Promise<void>;
  likeComment: (postId: string, commentId: string) => Promise<void>;
  voteCommentHelpful: (postId: string, commentId: string) => Promise<void>;
  replyToComment: (postId: string, commentId: string, content: string) => Promise<void>;
  
  // Topic operations
  joinTopic: (topicId: string) => Promise<void>;
  leaveTopic: (topicId: string) => Promise<void>;
  getTopicById: (topicId: string) => Topic | undefined;
  getPostsByTopic: (topicId: string) => Post[];
  
  // User operations
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  getUserById: (userId: string) => CommunityUser | undefined;
  getUserPosts: (userId: string) => Post[];
  isFollowing: (userId: string) => boolean;
  updateUserBio: (bio: string) => Promise<void>;
  updateUserLocation: (country: string) => Promise<void>;
  updateOnlineStatus: (status: OnlineStatus) => Promise<void>;
  getUserStats: (userId: string) => CommunityUser['stats'] | undefined;
  
  // Notification operations
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  getUnreadCount: () => number;
  
  // Chat operations
  sendMessage: (userId: string, content: string, type?: 'text' | 'image', imageUrl?: string) => Promise<void>;
  getChatMessages: (userId: string) => Message[];
  markChatRead: (userId: string) => Promise<void>;
  getOrCreateChat: (userId: string) => Chat | undefined;
  setTypingStatus: (userId: string, isTyping: boolean) => void;
  getTypingStatus: (userId: string) => boolean;
  
  // Feed operations
  refreshFeed: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  
  // Profile operations
  updateCommunityProfile: (updates: Partial<CommunityUser>) => Promise<void>;
  getCurrentUserProfile: () => CommunityUser | null;
  
  // Achievements
  checkAndAwardAchievements: () => Promise<string[]>;
  getUserAchievements: (userId: string) => string[];
}

const CommunityContext = createContext<CommunityContextType | null>(null);

// Initial topics data
const INITIAL_TOPICS: Topic[] = [
  { 
    id: 'topic_1', 
    name: 'Potty Training', 
    emoji: '🚽', 
    color: '#667eea', 
    members: 12500, 
    posts: 3200, 
    trending: true, 
    description: 'Tips, tricks, and support for potty training success', 
    isJoined: false,
    joinedBy: [],
  },
  { 
    id: 'topic_2', 
    name: 'Sleep Tips', 
    emoji: '😴', 
    color: '#11998e', 
    members: 18200, 
    posts: 5100, 
    trending: true, 
    description: 'Better sleep for babies and parents', 
    isJoined: false,
    joinedBy: [],
  },
  { 
    id: 'topic_3', 
    name: 'Feeding & Nutrition', 
    emoji: '🍼', 
    color: '#fa709a', 
    members: 15800, 
    posts: 4700, 
    trending: false, 
    description: 'From breastfeeding to first foods', 
    isJoined: false,
    joinedBy: [],
  },
  { 
    id: 'topic_4', 
    name: 'Milestones', 
    emoji: '🏆', 
    color: '#fee140', 
    members: 9300, 
    posts: 2100, 
    trending: false, 
    description: 'Celebrate every achievement', 
    isJoined: false,
    joinedBy: [],
  },
  { 
    id: 'topic_5', 
    name: 'Health & Wellness', 
    emoji: '💊', 
    color: '#fc5c7d', 
    members: 11700, 
    posts: 3800, 
    trending: true, 
    description: 'Keeping your little ones healthy', 
    isJoined: false,
    joinedBy: [],
  },
  { 
    id: 'topic_6', 
    name: 'Parenting Hacks', 
    emoji: '💡', 
    color: '#6a82fb', 
    members: 22400, 
    posts: 8900, 
    trending: true, 
    description: 'Clever solutions for everyday challenges', 
    isJoined: false,
    joinedBy: [],
  },
];

// Achievement definitions
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
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Load persisted data
  useEffect(() => {
    loadPersistedData();
    
    // Set up app state listener for online status
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Set up periodic sync
    const syncInterval = setInterval(syncData, 30000); // Sync every 30 seconds
    
    return () => {
      subscription.remove();
      clearInterval(syncInterval);
    };
  }, []);

  // Initialize current user when profile loads
  useEffect(() => {
    if (profile && communityProfile && isInitialized) {
      initializeCurrentUser();
    }
  }, [profile, communityProfile, isInitialized]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      await updateOnlineStatus('online');
      await checkStreak();
    } else if (nextAppState === 'background') {
      await updateOnlineStatus('away');
    }
  };

  const loadPersistedData = async () => {
    try {
      const [
        postsData,
        topicsData,
        notificationsData,
        chatsData,
        userStatsData,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.POSTS),
        AsyncStorage.getItem(STORAGE_KEYS.TOPICS),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
        AsyncStorage.getItem(STORAGE_KEYS.USER_STATS),
      ]);

      const loadedTopics = topicsData ? JSON.parse(topicsData) : INITIAL_TOPICS;
      
      setState(prev => ({
        ...prev,
        posts: postsData ? JSON.parse(postsData) : [],
        topics: loadedTopics,
        notifications: notificationsData ? JSON.parse(notificationsData) : [],
        chats: chatsData ? JSON.parse(chatsData) : [],
        isLoading: false,
      }));
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error loading persisted data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      setIsInitialized(true);
    }
  };

  const persistData = async (key: string, data: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error persisting data to ${key}:`, error);
    }
  };

  const syncData = async () => {
    // Batch persist all data
    await Promise.all([
      persistData(STORAGE_KEYS.POSTS, state.posts),
      persistData(STORAGE_KEYS.TOPICS, state.topics),
      persistData(STORAGE_KEYS.NOTIFICATIONS, state.notifications),
      persistData(STORAGE_KEYS.MESSAGES, state.chats),
    ]);
  };

  const initializeCurrentUser = async () => {
    if (!profile || !communityProfile) return;

    const existingStats = await AsyncStorage.getItem(`${STORAGE_KEYS.USER_STATS}_${profile.id}`);
    const parsedStats = existingStats ? JSON.parse(existingStats) : null;

    const currentUser: CommunityUser = {
      id: profile.id,
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
        followers: 0,
        following: 0,
        helpful: 0,
        streakDays: 0,
        lastStreakDate: new Date().toISOString(),
      },
      achievements: communityProfile.badges?.map(b => b.id) || [],
    };

    setState(prev => ({ ...prev, currentUser }));
    await updateOnlineStatus('online');
    await checkStreak();
  };

  const checkStreak = async () => {
    if (!state.currentUser) return;
    
    const today = new Date().toDateString();
    const lastDate = new Date(state.currentUser.stats.lastStreakDate).toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (lastDate === today) return; // Already checked today
    
    let newStreak = state.currentUser.stats.streakDays;
    if (lastDate === yesterday) {
      newStreak += 1; // Continue streak
    } else {
      newStreak = 1; // Reset streak
    }

    const updatedStats = {
      ...state.currentUser.stats,
      streakDays: newStreak,
      lastStreakDate: new Date().toISOString(),
    };

    await persistData(`${STORAGE_KEYS.USER_STATS}_${state.currentUser.id}`, updatedStats);
    
    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, stats: updatedStats } : null,
    }));

    // Check streak achievements
    if (newStreak === 7) await awardAchievement('streak_7');
    if (newStreak === 30) await awardAchievement('streak_30');
  };

  const awardAchievement = async (achievementId: string) => {
    if (!state.currentUser) return;
    
    if (state.currentUser.achievements.includes(achievementId)) return;
    
    const newAchievements = [...state.currentUser.achievements, achievementId];
    
    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, achievements: newAchievements } : null,
    }));

    // Show success modal
    const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId);
    if (achievement) {
      showSuccessModal({
        title: 'Achievement Unlocked! 🎉',
        message: `${achievement.emoji} ${achievement.name}\n${achievement.description}`,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const createPost = useCallback(async (content: string, topicId: string, images?: string[], isAnonymous?: boolean) => {
    if (!state.currentUser) {
      showErrorModal({ message: 'Please sign in to create posts' });
      return;
    }

    const topic = state.topics.find(t => t.id === topicId);
    if (!topic) {
      showErrorModal({ message: 'Topic not found' });
      return;
    }

    const newPost: Post = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      authorId: state.currentUser.id,
      author: isAnonymous 
        ? { ...state.currentUser, displayName: 'Anonymous', avatar: '🎭', handle: '@anonymous' } 
        : state.currentUser,
      topic: topic.name,
      topicId,
      content,
      images,
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
      timestamp: new Date().toISOString(),
      isAnonymous,
      helpfulVotes: 0,
      votedHelpfulBy: [],
    };

    setState(prev => {
      const updatedPosts = [newPost, ...prev.posts];
      const updatedTopics = prev.topics.map(t => 
        t.id === topicId 
          ? { ...t, posts: t.posts + 1, joinedBy: t.joinedBy.includes(state.currentUser!.id) ? t.joinedBy : [...t.joinedBy, state.currentUser!.id] }
          : t
      );

      // Update user stats
      const updatedStats = {
        ...prev.currentUser!.stats,
        posts: prev.currentUser!.stats.posts + 1,
      };

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      persistData(STORAGE_KEYS.TOPICS, updatedTopics);
      persistData(`${STORAGE_KEYS.USER_STATS}_${state.currentUser!.id}`, updatedStats);

      return {
        ...prev,
        posts: updatedPosts,
        topics: updatedTopics,
        currentUser: { ...prev.currentUser!, stats: updatedStats },
      };
    });

    // Check achievements
    const postCount = state.posts.filter(p => p.authorId === state.currentUser!.id).length + 1;
    if (postCount === 1) await awardAchievement('first_post');
    if (postCount === 50) await awardAchievement('storyteller');

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessModal({ message: 'Post created successfully!' });
  }, [state.currentUser, state.topics, state.posts]);

  const likePost = useCallback(async (postId: string) => {
    if (!state.currentUser) {
      showErrorModal({ message: 'Please sign in to like posts' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && !post.likedBy.includes(state.currentUser!.id)) {
          const updatedPost = {
            ...post,
            isLiked: true,
            likes: post.likes + 1,
            likedBy: [...post.likedBy, state.currentUser!.id],
          };
          
          // Create notification for post author
          if (post.authorId !== state.currentUser!.id) {
            const notification: Notification = {
              id: `notif_${Date.now()}`,
              type: 'like',
              userId: state.currentUser!.id,
              user: state.currentUser!,
              content: 'liked your post',
              target: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : ''),
              postId: post.id,
              time: 'Just now',
              timestamp: new Date().toISOString(),
              read: false,
            };
            
            const updatedNotifications = [notification, ...prev.notifications];
            persistData(STORAGE_KEYS.NOTIFICATIONS, updatedNotifications);
            
            return { ...prev, posts: updatedPosts, notifications: updatedNotifications };
          }
          
          return updatedPost;
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const unlikePost = useCallback(async (postId: string) => {
    if (!state.currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && post.likedBy.includes(state.currentUser!.id)) {
          return {
            ...post,
            isLiked: false,
            likes: Math.max(0, post.likes - 1),
            likedBy: post.likedBy.filter(id => id !== state.currentUser!.id),
          };
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const repostPost = useCallback(async (postId: string) => {
    if (!state.currentUser) {
      showErrorModal({ message: 'Please sign in to repost' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && !post.repostedBy.includes(state.currentUser!.id)) {
          return {
            ...post,
            isReposted: true,
            reposts: post.reposts + 1,
            repostedBy: [...post.repostedBy, state.currentUser!.id],
          };
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const unrepostPost = useCallback(async (postId: string) => {
    if (!state.currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && post.repostedBy.includes(state.currentUser!.id)) {
          return {
            ...post,
            isReposted: false,
            reposts: Math.max(0, post.reposts - 1),
            repostedBy: post.repostedBy.filter(id => id !== state.currentUser!.id),
          };
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const bookmarkPost = useCallback(async (postId: string) => {
    if (!state.currentUser) {
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

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const voteHelpful = useCallback(async (postId: string) => {
    if (!state.currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId && !post.votedHelpfulBy.includes(state.currentUser!.id)) {
          return {
            ...post,
            helpfulVotes: post.helpfulVotes + 1,
            votedHelpfulBy: [...post.votedHelpfulBy, state.currentUser!.id],
          };
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const deletePost = useCallback(async (postId: string) => {
    showConfirmModal({
      title: 'Delete Post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      onConfirm: () => {
        setState(prev => {
          const updatedPosts = prev.posts.filter(post => post.id !== postId);
          persistData(STORAGE_KEYS.POSTS, updatedPosts);
          return { ...prev, posts: updatedPosts };
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccessModal({ message: 'Post deleted successfully' });
      },
    });
  }, []);

  const getPostById = useCallback((postId: string) => {
    return state.posts.find(post => post.id === postId);
  }, [state.posts]);

  const addComment = useCallback(async (postId: string, content: string) => {
    if (!state.currentUser) {
      showErrorModal({ message: 'Please sign in to comment' });
      return;
    }

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      authorId: state.currentUser.id,
      author: state.currentUser,
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
            comments: [...post.comments, newComment],
            commentsCount: post.commentsCount + 1,
          };
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [state.currentUser]);

  const likeComment = useCallback(async (postId: string, commentId: string) => {
    if (!state.currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map(comment => {
              if (comment.id === commentId) {
                const isLiked = comment.likedBy.includes(state.currentUser!.id);
                return {
                  ...comment,
                  isLiked: !isLiked,
                  likes: isLiked ? comment.likes - 1 : comment.likes + 1,
                  likedBy: isLiked 
                    ? comment.likedBy.filter(id => id !== state.currentUser!.id)
                    : [...comment.likedBy, state.currentUser!.id],
                };
              }
              return comment;
            }),
          };
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const voteCommentHelpful = useCallback(async (postId: string, commentId: string) => {
    if (!state.currentUser) return;

    setState(prev => {
      const updatedPosts = prev.posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map(comment => {
              if (comment.id === commentId && !comment.votedHelpfulBy.includes(state.currentUser!.id)) {
                return {
                  ...comment,
                  helpfulVotes: comment.helpfulVotes + 1,
                  votedHelpfulBy: [...comment.votedHelpfulBy, state.currentUser!.id],
                };
              }
              return comment;
            }),
          };
        }
        return post;
      });

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const replyToComment = useCallback(async (postId: string, commentId: string, content: string) => {
    if (!state.currentUser) return;

    const newReply: Comment = {
      id: `reply_${Date.now()}`,
      authorId: state.currentUser.id,
      author: state.currentUser,
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

      persistData(STORAGE_KEYS.POSTS, updatedPosts);
      return { ...prev, posts: updatedPosts };
    });
  }, [state.currentUser]);

  const joinTopic = useCallback(async (topicId: string) => {
    if (!state.currentUser) {
      showErrorModal({ message: 'Please sign in to join topics' });
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setState(prev => {
      const updatedTopics = prev.topics.map(topic => {
        if (topic.id === topicId && !topic.joinedBy.includes(state.currentUser!.id)) {
          return {
            ...topic,
            isJoined: true,
            members: topic.members + 1,
            joinedBy: [...topic.joinedBy, state.currentUser!.id],
          };
        }
        return topic;
      });

      persistData(STORAGE_KEYS.TOPICS, updatedTopics);
      return { ...prev, topics: updatedTopics };
    });
  }, [state.currentUser]);

  const leaveTopic = useCallback(async (topicId: string) => {
    if (!state.currentUser) return;

    setState(prev => {
      const updatedTopics = prev.topics.map(topic => {
        if (topic.id === topicId && topic.joinedBy.includes(state.currentUser!.id)) {
          return {
            ...topic,
            isJoined: false,
            members: Math.max(0, topic.members - 1),
            joinedBy: topic.joinedBy.filter(id => id !== state.currentUser!.id),
          };
        }
        return topic;
      });

      persistData(STORAGE_KEYS.TOPICS, updatedTopics);
      return { ...prev, topics: updatedTopics };
    });
  }, [state.currentUser]);

  const getTopicById = useCallback((topicId: string) => {
    return state.topics.find(topic => topic.id === topicId);
  }, [state.topics]);

  const getPostsByTopic = useCallback((topicId: string) => {
    return state.posts.filter(post => post.topicId === topicId);
  }, [state.posts]);

  const followUser = useCallback(async (userId: string) => {
    if (!state.currentUser || userId === state.currentUser.id) {
      showErrorModal({ message: 'Cannot follow yourself' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setState(prev => {
      // Update target user's followers
      const updatedPosts = prev.posts.map(post => {
        if (post.authorId === userId) {
          return {
            ...post,
            author: {
              ...post.author,
              isFollowing: true,
              stats: {
                ...post.author.stats,
                followers: post.author.stats.followers + 1,
              },
            },
          };
        }
        return post;
      });

      // Update current user's following count
      const updatedCurrentUser = {
        ...prev.currentUser!,
        stats: {
          ...prev.currentUser!.stats,
          following: prev.currentUser!.stats.following + 1,
        },
      };

      persistData(`${STORAGE_KEYS.USER_STATS}_${userId}`, updatedPosts.find(p => p.authorId === userId)?.author.stats);
      persistData(`${STORAGE_KEYS.USER_STATS}_${state.currentUser!.id}`, updatedCurrentUser.stats);

      return {
        ...prev,
        posts: updatedPosts,
        currentUser: updatedCurrentUser,
      };
    });

    // Check social butterfly achievement
    if (state.currentUser.stats.following + 1 >= 100) {
      await awardAchievement('social_butterfly');
    }

    // Create notification
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      type: 'follow',
      userId: state.currentUser.id,
      user: state.currentUser,
      content: 'started following you',
      time: 'Just now',
      timestamp: new Date().toISOString(),
      read: false,
    };

    setState(prev => {
      const updatedNotifications = [notification, ...prev.notifications];
      persistData(STORAGE_KEYS.NOTIFICATIONS, updatedNotifications);
      return { ...prev, notifications: updatedNotifications };
    });
  }, [state.currentUser]);

  const unfollowUser = useCallback(async (userId: string) => {
    if (!state.currentUser) return;

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
                followers: Math.max(0, post.author.stats.followers - 1),
              },
            },
          };
        }
        return post;
      });

      const updatedCurrentUser = {
        ...prev.currentUser!,
        stats: {
          ...prev.currentUser!.stats,
          following: Math.max(0, prev.currentUser!.stats.following - 1),
        },
      };

      return {
        ...prev,
        posts: updatedPosts,
        currentUser: updatedCurrentUser,
      };
    });
  }, [state.currentUser]);

  const getUserById = useCallback((userId: string) => {
    if (userId === state.currentUser?.id) return state.currentUser;
    // Find user from posts
    const post = state.posts.find(p => p.authorId === userId);
    if (post) return post.author;
    return undefined;
  }, [state.currentUser, state.posts]);

  const getUserPosts = useCallback((userId: string) => {
    return state.posts.filter(post => post.authorId === userId);
  }, [state.posts]);

  const isFollowing = useCallback((userId: string) => {
    const user = getUserById(userId);
    return user?.isFollowing || false;
  }, [getUserById]);

  const updateUserBio = useCallback(async (bio: string) => {
    if (!state.currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, bio },
    }));

    await updateUserCommunityProfile({ bio });
  }, [state.currentUser, updateUserCommunityProfile]);

  const updateUserLocation = useCallback(async (country: string) => {
    if (!state.currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, country },
    }));
  }, [state.currentUser]);

  const updateOnlineStatus = useCallback(async (status: OnlineStatus) => {
    if (!state.currentUser) return;

    const updatedActivity: UserActivity = {
      userId: state.currentUser.id,
      lastActive: new Date().toISOString(),
      status,
    };

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, onlineStatus: status, lastActive: updatedActivity.lastActive },
      userActivities: new Map(prev.userActivities).set(state.currentUser!.id, updatedActivity),
    }));
  }, [state.currentUser]);

  const getUserStats = useCallback((userId: string) => {
    if (userId === state.currentUser?.id) return state.currentUser.stats;
    const user = getUserById(userId);
    return user?.stats;
  }, [state.currentUser, getUserById]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setState(prev => {
      const updatedNotifications = prev.notifications.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      persistData(STORAGE_KEYS.NOTIFICATIONS, updatedNotifications);
      return { ...prev, notifications: updatedNotifications };
    });
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setState(prev => {
      const updatedNotifications = prev.notifications.map(notif => ({ ...notif, read: true }));
      persistData(STORAGE_KEYS.NOTIFICATIONS, updatedNotifications);
      return { ...prev, notifications: updatedNotifications };
    });
  }, []);

  const getUnreadCount = useCallback(() => {
    return state.notifications.filter(n => !n.read).length;
  }, [state.notifications]);

  const sendMessage = useCallback(async (userId: string, content: string, type: 'text' | 'image' = 'text', imageUrl?: string) => {
    if (!state.currentUser) {
      showErrorModal({ message: 'Please sign in to send messages' });
      return;
    }

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      chatId: `chat_${[state.currentUser.id, userId].sort().join('_')}`,
      senderId: state.currentUser.id,
      receiverId: userId,
      content,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      imageUrl,
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

      persistData(STORAGE_KEYS.MESSAGES, updatedChats);
      return { ...prev, chats: updatedChats };
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Create notification for receiver
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      type: 'message',
      userId: state.currentUser.id,
      user: state.currentUser,
      content: 'sent you a message',
      target: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
      time: 'Just now',
      timestamp: new Date().toISOString(),
      read: false,
    };

    setState(prev => {
      const updatedNotifications = [notification, ...prev.notifications];
      persistData(STORAGE_KEYS.NOTIFICATIONS, updatedNotifications);
      return { ...prev, notifications: updatedNotifications };
    });
  }, [state.currentUser, getUserById]);

  const getChatMessages = useCallback((userId: string): Message[] => {
    const chat = state.chats.find(c => c.participantId === userId);
    return chat?.messages || [];
  }, [state.chats]);

  const markChatRead = useCallback(async (userId: string) => {
    setState(prev => {
      const updatedChats = prev.chats.map(chat => 
        chat.participantId === userId ? { ...chat, unreadCount: 0 } : chat
      );
      persistData(STORAGE_KEYS.MESSAGES, updatedChats);
      return { ...prev, chats: updatedChats };
    });
  }, []);

  const getOrCreateChat = useCallback((userId: string) => {
    return state.chats.find(c => c.participantId === userId);
  }, [state.chats]);

  const setTypingStatus = useCallback((userId: string, isTyping: boolean) => {
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(chat => 
        chat.participantId === userId ? { ...chat, isTyping } : chat
      ),
    }));

    // Clear existing timeout
    const existingTimeout = typingTimeouts.current.get(userId);
    if (existingTimeout) clearTimeout(existingTimeout);

    // Set new timeout to clear typing status
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
    const chat = state.chats.find(c => c.participantId === userId);
    return chat?.isTyping || false;
  }, [state.chats]);

  const refreshFeed = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await new Promise(resolve => setTimeout(resolve, 1500));
    await loadPersistedData();
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  const loadMorePosts = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Implement pagination logic here
  }, []);

  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityUser>) => {
    if (!state.currentUser) return;

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, ...updates },
    }));

    // Sync with UserContext
    if (updates.bio) await updateUserCommunityProfile({ bio: updates.bio });
  }, [state.currentUser, updateUserCommunityProfile]);

  const getCurrentUserProfile = useCallback(() => {
    return state.currentUser;
  }, [state.currentUser]);

  const checkAndAwardAchievements = useCallback(async (): Promise<string[]> => {
    if (!state.currentUser) return [];
    const newAchievements: string[] = [];
    
    // Check all achievements
    const checks = [
      { id: 'helpful_parent', condition: state.currentUser.stats.helpful >= 50 },
      { id: 'top_contributor', condition: state.currentUser.stats.helpful >= 100 },
      { id: 'rising_star', condition: state.currentUser.stats.followers >= 1000 },
    ];

    for (const check of checks) {
      if (check.condition && !state.currentUser.achievements.includes(check.id)) {
        await awardAchievement(check.id);
        newAchievements.push(check.id);
      }
    }

    return newAchievements;
  }, [state.currentUser]);

  const getUserAchievements = useCallback((userId: string): string[] => {
    if (userId === state.currentUser?.id) return state.currentUser.achievements;
    const user = getUserById(userId);
    return user?.achievements || [];
  }, [state.currentUser, getUserById]);

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
    refreshFeed,
    loadMorePosts,
    updateCommunityProfile,
    getCurrentUserProfile,
    checkAndAwardAchievements,
    getUserAchievements,
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
    refreshFeed,
    loadMorePosts,
    updateCommunityProfile,
    getCurrentUserProfile,
    checkAndAwardAchievements,
    getUserAchievements,
  ]);

  if (state.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <UniversalSpinner size={48} color="#667eea" />
      </View>
    );
  }

  return (
    <CommunityContext.Provider value={value}>
      {children}
    </CommunityContext.Provider>
  );
};

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (!context) throw new Error('useCommunity must be used within CommunityProvider');
  return context;
};

export default CommunityProvider;