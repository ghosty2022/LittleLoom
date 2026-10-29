// src/context/CommunityContext.tsx  (REPLACE)
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/utils/supabase';
import { useAuth } from './AuthContext';
import { useSweetAlert } from '../components/SweetAlert';
import * as CommunityService from '../services/CommunityService';

/* ─────────────────────────────────────────────────────────────
   TYPES (unchanged public API — every consumer keeps compiling)
   ───────────────────────────────────────────────────────────── */
export type OnlineStatus = 'online' | 'offline' | 'away';
export type MessageType = 'text' | 'image';
export type PostMood = 'celebrating' | 'support' | 'advice' | 'milestone' | 'venting';

export interface PollOption { id: string; text: string; votes: number; }
export interface Poll {
  question: string; options: PollOption[]; totalVotes: number;
  hasVoted: boolean; votedOptionId?: string;
}

export interface CommunityUser {
  id: string; displayName: string; handle: string; avatar: string;
  coverPhoto?: string; isVerified: boolean; bio?: string; location?: string;
  country?: string; onlineStatus: OnlineStatus; lastActive: string;
  stats: { posts: number; followers: number; following: number; helpful: number; streakDays: number; lastStreakDate: string; };
  isFollowing?: boolean; achievements: string[]; selectedTopics?: string[];
  followers?: string[]; following?: string[];
}
export interface Comment {
  id: string; authorId: string; author: CommunityUser; content: string;
  likes: number; likedBy: string[]; isLiked: boolean; time: string; timestamp: string;
  replies?: Comment[]; helpfulVotes: number; votedHelpfulBy: string[];
}
export interface Post {
  id: string; authorId: string; author: CommunityUser; topic: string; topicId: string;
  content: string; images?: string[]; likes: number; likedBy: string[];
  comments: Comment[]; commentsCount: number; reposts: number; repostedBy: string[];
  shares: number; sharedBy: string[]; isLiked: boolean; isReposted: boolean;
  isBookmarked: boolean; bookmarks: number; bookmarkedBy: string[]; time: string;
  timestamp: string; isAnonymous?: boolean; helpfulVotes: number; votedHelpfulBy: string[];
  popularityScore: number; viewCount: number; engagementRate: number;
  lastEngagedAt: string; isTrending: boolean; mood?: PostMood; poll?: Poll;
}
export interface Topic {
  id: string; name: string; emoji: string; color: string; members: number;
  posts: number; trending: boolean; description: string; isJoined: boolean;
  joinedBy: string[]; engagementScore: number; weeklyGrowth: number;
  category?: string; subcategory?: string;
}
export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'repost' | 'mention' | 'follow' | 'message' | 'system' | 'helpful';
  userId: string; user: CommunityUser; content: string; target?: string;
  postId?: string; time: string; timestamp: string; read: boolean;
}

interface CommunityState {
  posts: Post[];
  topics: Topic[];
  notifications: Notification[];
  currentUser: CommunityUser | null;
  isLoading: boolean;
  onlineUsers: string[];
  blockedUsers: string[];
  selectedTopics: string[];
  isInitialized: boolean;
}

interface CommunityContextType extends CommunityState {
  createPost: (content: string, topicId: string, images?: string[], isAnonymous?: boolean, mood?: PostMood, poll?: Poll) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  repostPost: (postId: string) => Promise<void>;
  unrepostPost: (postId: string) => Promise<void>;
  bookmarkPost: (postId: string) => Promise<void>;
  sharePost: (postId: string) => Promise<void>;
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
  updateCommunityProfile: (updates: Partial<CommunityUser> & { isVerified?: boolean; coverPhoto?: string }) => Promise<void>;
  updateOnlineStatus: (status: OnlineStatus) => Promise<void>;
  getUserStats: (userId: string) => CommunityUser['stats'] | undefined;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  getUnreadCount: () => number;
  getFollowers: (userId: string) => Promise<string[]>;
  getFollowing: (userId: string) => Promise<string[]>;
  getAllUsers: () => CommunityUser[];
  getFeedPosts: () => Post[];
  getPopularPosts: (limit?: number) => Post[];
  getTrendingTopics: () => Topic[];
  incrementViewCount: (postId: string) => Promise<void>;
  getPostRank: (postId: string) => number;
  isUserBlocked: (userId: string) => boolean;
  blockUser: (userId: string) => Promise<void>;
  refreshFeed: () => Promise<void>;
  refreshTopics: () => Promise<Topic[]>;
  votePoll: (postId: string, optionId: string) => Promise<void>;
  // chat methods kept but delegate to FamilyChatContext if present. For the
  // community inbox we DO NOT store anything — see FamilyChat.
  isAuthenticated: () => boolean;
  getSelectedTopics: () => string[];
  updateSelectedTopics: (ids: string[]) => Promise<void>;
  checkOnboardingStatus: () => Promise<{ completed: boolean; hasTopics: boolean }>;
  refreshTopicsData: () => Promise<Topic[]>;
  // stubs kept for consumers that call them
  syncUserProfileAcrossPosts: (userId: string, updates: Partial<CommunityUser>) => Promise<void>;
  loadMorePosts: () => Promise<void>;
}

/* ─────────────────────────────────────────────────────────────
   TOPICS — kept in sync with CommunityOnboardingScreen import
   ───────────────────────────────────────────────────────────── */
export const INITIAL_TOPICS: Topic[] = [
  { id: 'topic_health_fever', name: 'Fever', emoji: '🌡️', color: '#EE5A24', members: 0, posts: 0, trending: false, description: 'Track fever symptoms', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'health', subcategory: 'symptoms' },
  { id: 'topic_health_allergy', name: 'Allergies', emoji: '🤧', color: '#FF6B6B', members: 0, posts: 0, trending: false, description: 'Managing allergies', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'health', subcategory: 'conditions' },
  { id: 'topic_health_teething', name: 'Teething', emoji: '🦷', color: '#FF9F43', members: 0, posts: 0, trending: false, description: 'Teething relief', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'health', subcategory: 'conditions' },
  { id: 'topic_health_vaccines', name: 'Vaccines', emoji: '💉', color: '#5F27CD', members: 0, posts: 0, trending: false, description: 'Immunization', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'health', subcategory: 'medical' },
  { id: 'topic_health_doctor', name: 'Doctor Visits', emoji: '👨‍⚕️', color: '#00D2D3', members: 0, posts: 0, trending: false, description: 'Pediatric visits', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'health', subcategory: 'medical' },
  { id: 'topic_nutrition_breastfeeding', name: 'Breastfeeding', emoji: '🤱', color: '#FF9FF3', members: 0, posts: 0, trending: false, description: 'Breastfeeding support', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'nutrition', subcategory: 'feeding' },
  { id: 'topic_nutrition_solid_food', name: 'Solid Foods', emoji: '🥄', color: '#FF9F43', members: 0, posts: 0, trending: false, description: 'Solid foods & BLW', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'nutrition', subcategory: 'feeding' },
  { id: 'topic_nutrition_formula', name: 'Formula', emoji: '🍼', color: '#54A0FF', members: 0, posts: 0, trending: false, description: 'Formula feeding', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'nutrition', subcategory: 'feeding' },
  { id: 'topic_sleep_baby', name: 'Baby Sleep', emoji: '😴', color: '#5F27CD', members: 0, posts: 0, trending: false, description: 'Sleep 0-12 months', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'sleep', subcategory: 'sleep' },
  { id: 'topic_sleep_toddler', name: 'Toddler Sleep', emoji: '🌙', color: '#341F97', members: 0, posts: 0, trending: false, description: 'Sleep strategies', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'sleep', subcategory: 'sleep' },
  { id: 'topic_dev_milestones', name: 'Milestones', emoji: '🏆', color: '#FFD700', members: 0, posts: 0, trending: false, description: 'Celebrate milestones', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'development', subcategory: 'milestones' },
  { id: 'topic_dev_motor_skills', name: 'Motor Skills', emoji: '🏃', color: '#10AC84', members: 0, posts: 0, trending: false, description: 'Motor development', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'development', subcategory: 'skills' },
  { id: 'topic_parenting_potty', name: 'Potty Training', emoji: '🚽', color: '#1DD1A1', members: 0, posts: 0, trending: false, description: 'Potty training tips', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'parenting', subcategory: 'training' },
  { id: 'topic_parenting_tantrums', name: 'Tantrums', emoji: '😤', color: '#E74C3C', members: 0, posts: 0, trending: false, description: 'Toddler tantrums', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'parenting', subcategory: 'behavior' },
  { id: 'topic_community_stories', name: 'Parent Stories', emoji: '📖', color: '#6A82FB', members: 0, posts: 0, trending: false, description: 'Share your journey', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'community', subcategory: 'stories' },
  { id: 'topic_community_advice', name: 'Advice & Tips', emoji: '💡', color: '#F59E0B', members: 0, posts: 0, trending: false, description: 'Parenting advice', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'community', subcategory: 'advice' },
  { id: 'topic_community_support', name: 'Support Group', emoji: '💙', color: '#3B82F6', members: 0, posts: 0, trending: false, description: 'Find support', isJoined: false, joinedBy: [], engagementScore: 0, weeklyGrowth: 0, category: 'community', subcategory: 'support' },
];

export const TOPIC_CATEGORIES = [
  { id: 'health', name: 'Health & Wellness', emoji: '🏥', description: 'Health and medical care', subcategories: [] },
  { id: 'nutrition', name: 'Feeding & Nutrition', emoji: '🍽️', description: 'Feeding and nutrition', subcategories: [] },
  { id: 'sleep', name: 'Sleep', emoji: '😴', description: 'Sleep tips and tracking', subcategories: [] },
  { id: 'development', name: 'Development', emoji: '🧠', description: 'Milestones and growth', subcategories: [] },
  { id: 'parenting', name: 'Parenting', emoji: '👨‍👩‍👧', description: 'Parenting tips', subcategories: [] },
  { id: 'community', name: 'Community', emoji: '👥', description: 'Connect with parents', subcategories: [] },
];

/* ─────────────────────────────────────────────────────────────
   PROVIDER
   ───────────────────────────────────────────────────────────── */
const CommunityContext = createContext<CommunityContextType | null>(null);

export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isAuthenticated: authIsAuth } = useAuth();
  const sweetAlert = useSweetAlert();

  const [state, setState] = useState<CommunityState>({
    posts: [],
    topics: INITIAL_TOPICS,
    notifications: [],
    currentUser: null,
    isLoading: true,
    onlineUsers: [],
    blockedUsers: [],
    selectedTopics: [],
    isInitialized: false,
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentUserIdRef.current = userProfile?.id ?? null;
  }, [userProfile?.id]);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load / refresh ─────────────────────────────────────────── */
  const loadEverything = useCallback(async (opts: { silent?: boolean } = {}) => {
    const meId = currentUserIdRef.current;
    if (!meId) {
      // DO NOT clear posts / isInitialized. We're just waiting for auth
      // hydration — keep whatever we already have and stay in "loading".
      setState((p) => ({ ...p, isLoading: false }));
      return;
    }
    if (!opts.silent) setState((p) => ({ ...p, isLoading: true }));

    const [posts, notifications, blocked, topics] = await Promise.all([
      CommunityService.fetchFeed(meId),
      CommunityService.fetchNotifications(meId),
      CommunityService.fetchBlockedIds(meId),
      CommunityService.fetchTopicStats(),
    ]);

    // enrich: load comments for top 20 posts that have any
    const needComments = posts.filter((p) => p.commentsCount > 0).slice(0, 20);
    await Promise.all(
      needComments.map(async (p) => {
        const cmts = await CommunityService.fetchCommentsForPost(p.id, meId);
        p.comments = cmts;
      }),
    );

    // ── Hydrate selectedTopics from EVERY source and merge ──
    // Priority: DB (profiles.community_selected_topics) > userProfile >
    // scoped AsyncStorage > global AsyncStorage > onboarding blob.
    // A source that returns [] must NEVER overwrite a non-empty value.
    // NOTE: `meId` is already declared at the top of loadEverything — reuse it.
    let persistedTopics: string[] = [];
    if (meId) {
      try {
        const { data: row } = await supabase
          .from('profiles')
          .select('community_selected_topics')
          .eq('id', meId)
          .maybeSingle();
        const dbTopics = Array.isArray(row?.community_selected_topics)
          ? (row!.community_selected_topics as string[])
          : [];
        if (dbTopics.length > 0) persistedTopics = dbTopics;
      } catch {}

      if (persistedTopics.length === 0) {
        try {
          // Scoped reads ONLY. The global key is shared across accounts on the
          // same device and is the root cause of "previous account's topics"
          // bleeding into the new session.
          const [scopedRaw, onboardingRaw] = await Promise.all([
            AsyncStorage.getItem(`@community_selected_topics_v2_${meId}`),
            AsyncStorage.getItem(`@littleloom_community_onboarding_v3_${meId}`),
          ]);
          const parse = (raw: string | null): string[] => {
            if (!raw) return [];
            try {
              const v = JSON.parse(raw);
              return Array.isArray(v) ? v : [];
            } catch {
              return [];
            }
          };
          const scoped = parse(scopedRaw);
          let fromBlob: string[] = [];
          try {
            const blob = onboardingRaw ? JSON.parse(onboardingRaw) : null;
            if (Array.isArray(blob?.selectedTopics)) fromBlob = blob.selectedTopics;
          } catch {}
          persistedTopics = scoped.length > 0 ? scoped
            : fromBlob.length > 0 ? fromBlob
            : [];
        } catch {}
      }
    }

    const me = userProfile
      ? {
          id: userProfile.id,
          displayName: userProfile.communityDisplayName || userProfile.fullName || 'Parent',
          handle: userProfile.communityHandle || '@parent',
          avatar: userProfile.communityAvatar || userProfile.avatar || '👤',
          isVerified: false,
          onlineStatus: 'online' as const,
          lastActive: new Date().toISOString(),
          stats: userProfile.communityStats || { posts: 0, followers: 0, following: 0, helpful: 0, streakDays: 0, lastStreakDate: new Date().toISOString() },
          achievements: [],
          // Merge: prefer persisted → userProfile → existing state.
          // NEVER let an empty source clobber a non-empty one.
          selectedTopics: persistedTopics.length > 0
            ? persistedTopics
            : (userProfile.communitySelectedTopics && userProfile.communitySelectedTopics.length > 0
                ? userProfile.communitySelectedTopics
                : stateRef.current.selectedTopics),
          isFollowing: undefined,
          bio: userProfile.communityBio || '',
        }
      : null;

    // Always hand React a brand-new array so downstream
    // effects (`useEffect([posts,...])`) re-run even when contents look
    // identical.
    const freshPosts = [...posts];
    const freshTopics = [...topics];
    const freshNotifications = [...notifications];
    const freshBlocked = [...blocked];

    if (me && me.id === currentUserIdRef.current) {
      setState((p) => {
        // Merge: if DB/Async gave us nothing but state already has
        // topics, keep them. Never downgrade a populated list to [].
        const mergedTopics =
          (me.selectedTopics && me.selectedTopics.length > 0)
            ? me.selectedTopics
            : (p.selectedTopics.length > 0 ? p.selectedTopics : []);
        return {
          ...p,
          posts: freshPosts,
          topics: freshTopics,
          notifications: freshNotifications,
          blockedUsers: freshBlocked,
          selectedTopics: mergedTopics,
          currentUser: me,
          isLoading: false,
          isInitialized: true,
        };
      });
    } else {
      setState((p) => ({
        ...p,
        posts: freshPosts,
        topics: freshTopics,
        notifications: freshNotifications,
        blockedUsers: freshBlocked,
        isLoading: false,
        isInitialized: true,
      }));
    }
  }, [userProfile]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadEverything({ silent: true }).catch(() => {});
    }, 200);
  }, [loadEverything]);

  /* ── Mount / auth ───────────────────────────────────────────── */
  useEffect(() => {
    loadEverything().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  /* ── REALTIME — one channel for everything ──────────────────── */
  useEffect(() => {
    const meId = currentUserIdRef.current;
    if (!meId) return;

    const channel = supabase.channel(`community-rt-${meId}`, {
      config: { broadcast: { self: false }, presence: { key: meId } },
    });

    const tables = [
      'community_posts',
      'community_comments',
      'post_likes',
      'post_reposts',
      'post_bookmarks',
      'post_helpful_votes',
      'comment_likes',
      'comment_helpful_votes',
      'poll_votes',
      'user_follows',
      'user_blocks',
      'community_notifications',
    ];

    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          // debounce rapid bursts into one refresh
          scheduleRefresh();
        },
      );
    });

    channel.subscribe((status) => {
      if (__DEV__) console.log('[CommunityRT]', status);
    });

    return () => {
      try { supabase.removeChannel(channel); } catch {}
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [userProfile?.id, scheduleRefresh]);

  /* ── Derived getters ────────────────────────────────────────── */
  const getPostById = useCallback((postId: string) => {
    return stateRef.current.posts.find((p) => p.id === postId);
  }, []);

  const getUserById = useCallback((userId: string) => {
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser || undefined;
    // check across posts
    for (const p of stateRef.current.posts) {
      if (p.authorId === userId) return p.author;
    }
    return undefined;
  }, []);

  const getUserPosts = useCallback((userId: string) => {
    return stateRef.current.posts.filter((p) => p.authorId === userId);
  }, []);

  const isFollowing = useCallback((userId: string) => {
    return false; // recomputed below
  }, []);

  // follow set tracked separately
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    const meId = currentUserIdRef.current;
    if (!meId) return;
    CommunityService.fetchFollowedIds(meId).then(setFollowedSet).catch(() => {});
  }, [userProfile?.id, state.posts.length]);

  const isFollowingFinal = useCallback(
    (userId: string) => followedSet.has(userId),
    [followedSet],
  );

  const getAllUsers = useCallback(() => {
    const map = new Map<string, CommunityUser>();
    if (stateRef.current.currentUser) map.set(stateRef.current.currentUser.id, stateRef.current.currentUser);
    for (const p of stateRef.current.posts) {
      if (!map.has(p.authorId)) map.set(p.authorId, p.author);
    }
    return Array.from(map.values());
  }, []);

  const getFeedPosts = useCallback(() => {
    return [...stateRef.current.posts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, []);

  const getPopularPosts = useCallback((limit = 10) => {
    return [...stateRef.current.posts]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);
  }, []);

  const getTrendingTopics = useCallback(() => {
    return stateRef.current.topics
      .filter((t) => t.trending)
      .sort((a, b) => b.engagementScore - a.engagementScore);
  }, []);

  const getPostRank = useCallback((postId: string) => {
    const sorted = [...stateRef.current.posts].sort((a, b) => b.popularityScore - a.popularityScore);
    return sorted.findIndex((p) => p.id === postId) + 1;
  }, []);

  const getUnreadCount = useCallback(() => {
    return stateRef.current.notifications.filter((n) => !n.read).length;
  }, []);

  /* ── WRITE ACTIONS ──────────────────────────────────────────── */
  const createPost: CommunityContextType['createPost'] = useCallback(
    async (content, topicId, images, isAnonymous, mood, poll) => {
      const meId = currentUserIdRef.current;
      if (!meId) { sweetAlert.alert('Sign In Required', 'Please sign in to post', 'warning'); return; }
      const p = await CommunityService.insertPost({
        authorId: meId,
        topicId,
        content,
        images,
        isAnonymous,
        mood,
        poll,
      });
      if (!p) { sweetAlert.error('Error', 'Failed to post'); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // ── INSTANT INSERT: prepend the new post locally so it appears
      // immediately — no network round-trip, no waiting for realtime.
      setState((prev) => {
        const exists = prev.posts.some((x) => x.id === p.id);
        if (exists) return prev;
        const next = [p, ...prev.posts].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        return { ...prev, posts: next };
      });

      // Then reconcile with the server (realtime will also patch).
      loadEverything({ silent: true }).catch(() => {});
    },
    [loadEverything, sweetAlert],
  );

  const likePost = useCallback(async (postId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await CommunityService.toggleLike(postId, meId, true);
    // optimistic
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId ? { ...x, isLiked: true, likes: x.likes + 1 } : x,
      ),
    }));
  }, []);

  const unlikePost = useCallback(async (postId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.toggleLike(postId, meId, false);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId ? { ...x, isLiked: false, likes: Math.max(0, x.likes - 1) } : x,
      ),
    }));
  }, []);

  const repostPost = useCallback(async (postId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await CommunityService.toggleRepost(postId, meId, true);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId ? { ...x, isReposted: true, reposts: x.reposts + 1 } : x,
      ),
    }));
  }, []);

  const unrepostPost = useCallback(async (postId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.toggleRepost(postId, meId, false);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId ? { ...x, isReposted: false, reposts: Math.max(0, x.reposts - 1) } : x,
      ),
    }));
  }, []);

  const bookmarkPost = useCallback(async (postId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const cur = stateRef.current.posts.find((p) => p.id === postId);
    if (!cur) return;
    const next = !cur.isBookmarked;
    await CommunityService.toggleBookmark(postId, meId, next);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId
          ? { ...x, isBookmarked: next, bookmarks: Math.max(0, x.bookmarks + (next ? 1 : -1)) }
          : x,
      ),
    }));
  }, []);

  const sharePost = useCallback(async (postId: string) => {
    // no column for shares; increment view to keep the engagement graph healthy
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.incrementViewRow(postId, meId);
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    const ok = await CommunityService.deletePostRow(postId);
    if (ok) {
      setState((p) => ({ ...p, posts: p.posts.filter((x) => x.id !== postId) }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  const voteHelpful = useCallback(async (postId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    const cur = stateRef.current.posts.find((p) => p.id === postId);
    if (!cur) return;
    const wasVoted = cur.votedHelpfulBy.includes(meId);
    await CommunityService.toggleHelpful(postId, meId, !wasVoted);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId
          ? {
              ...x,
              helpfulVotes: Math.max(0, x.helpfulVotes + (wasVoted ? -1 : 1)),
              votedHelpfulBy: wasVoted
                ? x.votedHelpfulBy.filter((u) => u !== meId)
                : [...x.votedHelpfulBy, meId],
            }
          : x,
      ),
    }));
  }, []);

  const addComment = useCallback(async (postId: string, content: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await CommunityService.insertComment({ postId, authorId: meId, content });
    // refresh comments on this post
    const cmts = await CommunityService.fetchCommentsForPost(postId, meId);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId ? { ...x, comments: cmts, commentsCount: x.commentsCount + 1 } : x,
      ),
    }));
  }, []);

  const replyToComment = useCallback(async (postId: string, commentId: string, content: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.insertComment({ postId, authorId: meId, content, parentCommentId: commentId });
    const cmts = await CommunityService.fetchCommentsForPost(postId, meId);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id === postId ? { ...x, comments: cmts, commentsCount: x.commentsCount + 1 } : x,
      ),
    }));
  }, []);

  const likeComment = useCallback(async (_postId: string, commentId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    const cur = stateRef.current.posts.find((p) => p.comments.some((c) => c.id === commentId));
    if (!cur) return;
    const c = cur.comments.find((x) => x.id === commentId);
    if (!c) return;
    const next = !c.isLiked;
    await CommunityService.toggleCommentLike(commentId, meId, next);
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.id !== cur.id
          ? x
          : {
              ...x,
              comments: x.comments.map((cm) =>
                cm.id !== commentId
                  ? cm
                  : { ...cm, isLiked: next, likes: Math.max(0, cm.likes + (next ? 1 : -1)) },
              ),
            },
      ),
    }));
  }, []);

  const voteCommentHelpful = useCallback(async (_postId: string, commentId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    const cur = stateRef.current.posts.find((p) => p.comments.some((c) => c.id === commentId));
    if (!cur) return;
    const c = cur.comments.find((x) => x.id === commentId);
    if (!c) return;
    const wasVoted = c.votedHelpfulBy.includes(meId);
    await CommunityService.toggleCommentHelpful(commentId, meId, !wasVoted);
  }, []);

  const followUser = useCallback(async (userId: string) => {
    const meId = currentUserIdRef.current; if (!meId || meId === userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await CommunityService.followRow(meId, userId, true);
    setFollowedSet((s) => new Set(s).add(userId));
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.authorId === userId ? { ...x, author: { ...x.author, isFollowing: true } } : x,
      ),
    }));
  }, []);

  const unfollowUser = useCallback(async (userId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.followRow(meId, userId, false);
    setFollowedSet((s) => { const n = new Set(s); n.delete(userId); return n; });
    setState((p) => ({
      ...p,
      posts: p.posts.map((x) =>
        x.authorId === userId ? { ...x, author: { ...x.author, isFollowing: false } } : x,
      ),
    }));
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    const already = stateRef.current.blockedUsers.includes(userId);
    await CommunityService.blockRow(meId, userId, !already);
    if (already) {
      setState((p) => ({ ...p, blockedUsers: p.blockedUsers.filter((u) => u !== userId) }));
    } else {
      setState((p) => ({
        ...p,
        blockedUsers: [...p.blockedUsers, userId],
        posts: p.posts.filter((x) => x.authorId !== userId),
      }));
    }
  }, []);

  const isUserBlocked = useCallback((userId: string) => {
    return stateRef.current.blockedUsers.includes(userId);
  }, []);

  /* Topic membership is stored in user_topics */
  const joinTopic = useCallback(async (topicId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await supabase.from('user_topics').upsert({ user_id: meId, topic_id: topicId }, { onConflict: 'user_id,topic_id' });
    setState((p) => ({
      ...p,
      topics: p.topics.map((t) => (t.id === topicId ? { ...t, isJoined: true, members: t.members + 1 } : t)),
    }));
  }, []);

  const leaveTopic = useCallback(async (topicId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await supabase.from('user_topics').delete().eq('user_id', meId).eq('topic_id', topicId);
    setState((p) => ({
      ...p,
      topics: p.topics.map((t) => (t.id === topicId ? { ...t, isJoined: false, members: Math.max(0, t.members - 1) } : t)),
    }));
  }, []);

  const getTopicById = useCallback((topicId: string) => stateRef.current.topics.find((t) => t.id === topicId), []);
  const getPostsByTopic = useCallback((topicId: string) => stateRef.current.posts.filter((p) => p.topicId === topicId), []);

  const updateUserBio = useCallback(async (bio: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await supabase.from('profiles').update({ community_bio: bio, updated_at: new Date().toISOString() }).eq('id', meId);
  }, []);

  // NEW: mirrors what CommunityProfileScreen expects. Handles ONLY the fields
  // that live on the community profile, and updates state optimistically.
  const updateCommunityProfile = useCallback(async (
    updates: Partial<CommunityUser> & { isVerified?: boolean; coverPhoto?: string },
  ) => {
    const meId = currentUserIdRef.current;
    if (!meId) return;

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.displayName !== undefined) dbUpdates.community_display_name = updates.displayName;
    if (updates.handle !== undefined) dbUpdates.community_handle = updates.handle;
    if (updates.bio !== undefined) dbUpdates.community_bio = updates.bio;
    if (updates.avatar !== undefined) dbUpdates.community_avatar = updates.avatar;
    if (updates.coverPhoto !== undefined) dbUpdates.community_cover = updates.coverPhoto;
    if (updates.country !== undefined || updates.location !== undefined) {
      dbUpdates.country = updates.country ?? updates.location;
    }
    if (updates.isVerified !== undefined) dbUpdates.is_verified = updates.isVerified;
    if (updates.stats !== undefined) dbUpdates.community_stats = updates.stats;

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', meId);
    if (error) {
      if (__DEV__) console.warn('[Community] updateCommunityProfile DB error:', error.message);
      // do NOT throw — the caller may be doing a best-effort background sync
    }

    // Optimistic in-memory patch so every consumer sees the change instantly.
    setState((p) => {
      if (!p.currentUser || p.currentUser.id !== meId) return p;
      const merged: CommunityUser = {
        ...p.currentUser,
        displayName: updates.displayName ?? p.currentUser.displayName,
        handle: updates.handle ?? p.currentUser.handle,
        bio: updates.bio ?? p.currentUser.bio,
        avatar: updates.avatar ?? p.currentUser.avatar,
        coverPhoto: updates.coverPhoto ?? p.currentUser.coverPhoto,
        country: updates.country ?? updates.location ?? p.currentUser.country,
        isVerified: updates.isVerified ?? p.currentUser.isVerified,
        stats: updates.stats ?? p.currentUser.stats,
      };
      return { ...p, currentUser: merged };
    });

    // Also patch every post authored by this user so the feed re-renders.
    syncUserProfileAcrossPosts(meId, {
      displayName: updates.displayName,
      handle: updates.handle,
      bio: updates.bio,
      avatar: updates.avatar,
      coverPhoto: updates.coverPhoto,
      isVerified: updates.isVerified,
    });
  }, []);

  const updateUserLocation = useCallback(async (country: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await supabase.from('profiles').update({ country, updated_at: new Date().toISOString() }).eq('id', meId);
  }, []);

  const updateOnlineStatus = useCallback(async (status: OnlineStatus) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await supabase.from('user_activity').upsert(
      { user_id: meId, status, last_active: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  }, []);

  const getUserStats = useCallback((userId: string) => getUserById(userId)?.stats, [getUserById]);

  const markNotificationRead = useCallback(async (id: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.markNotificationReadRow(id, meId);
    setState((p) => ({ ...p, notifications: p.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.markAllNotificationsReadRow(meId);
    setState((p) => ({ ...p, notifications: p.notifications.map((n) => ({ ...n, read: true })) }));
  }, []);

  const incrementViewCount = useCallback(async (postId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    CommunityService.incrementViewRow(postId, meId).catch(() => {});
  }, []);

  const votePoll = useCallback(async (postId: string, optionId: string) => {
    const meId = currentUserIdRef.current; if (!meId) return;
    await CommunityService.votePollRow(postId, optionId, meId);
    const fresh = await CommunityService.fetchPostById(postId, meId);
    if (fresh) setState((p) => ({ ...p, posts: p.posts.map((x) => (x.id === postId ? fresh : x)) }));
  }, []);

  const getFollowers = useCallback(async (userId: string) => CommunityService.fetchFollowerIds(userId), []);
  const getFollowing = useCallback(async (userId: string) => CommunityService.fetchFollowingIds(userId), []);

  const refreshFeed = useCallback(async () => {
    await loadEverything({ silent: false });
  }, [loadEverything]);

  const refreshTopics = useCallback(async () => {
    const topics = await CommunityService.fetchTopicStats();
    setState((p) => ({ ...p, topics }));
    return topics;
  }, []);

  const getSelectedTopics = useCallback(() => stateRef.current.selectedTopics, []);

  const updateSelectedTopics = useCallback(async (ids: string[]) => {
    const meId = currentUserIdRef.current;
    if (!meId) return;
    const cleanIds = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];

    // 1. Optimistic — update in-memory state FIRST so every consumer
    // (CommunityScreen, ProfileScreen, TopicScreen) sees it instantly.
    setState((p) => ({ ...p, selectedTopics: cleanIds }));

    // 2. Write all persistent locations in parallel.
    const writes: Promise<any>[] = [];

    writes.push(
      Promise.resolve(
        supabase
          .from('profiles')
          .update({
            community_selected_topics: cleanIds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meId)
      ).then(({ error }) => {
        if (error) console.warn('[Community] DB topic save failed:', error.message);
      }),
    );

    writes.push(
      AsyncStorage.setItem(`@community_selected_topics_v2_${meId}`, JSON.stringify(cleanIds))
        .catch((e) => console.warn('[Community] scoped topic save failed:', e)),
    );
    // NOTE: we intentionally DO NOT write the global `@community_selected_topics_v2`
    // key anymore. It is shared across accounts on the same device and leaks
    // the previous account's selection into the next session.

    // Onboarding blob keeps the "completed" flag so the navigator
    // does not re-prompt.
    writes.push(
      (async () => {
        try {
          const existingRaw = await AsyncStorage.getItem(`@littleloom_community_onboarding_v3_${meId}`);
          let existing: any = {};
          try { existing = existingRaw ? JSON.parse(existingRaw) : {}; } catch {}
          await AsyncStorage.setItem(
            `@littleloom_community_onboarding_v3_${meId}`,
            JSON.stringify({
              ...existing,
              completed: true,
              selectedTopics: cleanIds,
              timestamp: new Date().toISOString(),
            }),
          );
        } catch (e) {
          console.warn('[Community] onboarding blob save failed:', e);
        }
      })(),
    );

    await Promise.all(writes);
  }, []);

  const checkOnboardingStatus = useCallback(async () => {
    const ids = stateRef.current.selectedTopics;
    return { completed: ids.length >= 3, hasTopics: ids.length > 0 };
  }, []);

  const syncUserProfileAcrossPosts = useCallback(async (_userId: string, updates: Partial<CommunityUser>) => {
    setState((p) => ({
      ...p,
      posts: p.posts.map((post) =>
        post.authorId === _userId ? { ...post, author: { ...post.author, ...updates } } : post,
      ),
    }));
  }, []);

  const loadMorePosts = useCallback(async () => {
    // basic pagination is handled by realtime + fetchFeed; no-op
  }, []);

  const isAuthenticated = useCallback(() => authIsAuth && !!currentUserIdRef.current, [authIsAuth]);

  /* ── VALUE ──────────────────────────────────────────────────── */
  const value = useMemo<CommunityContextType>(() => ({
    ...state,
    createPost,
    likePost, unlikePost, repostPost, unrepostPost, bookmarkPost, sharePost, deletePost,
    getPostById, voteHelpful, addComment, likeComment, voteCommentHelpful, replyToComment,
    joinTopic, leaveTopic, getTopicById, getPostsByTopic,
    followUser, unfollowUser, getUserById, getUserPosts, isFollowing: isFollowingFinal,
    updateUserBio, updateUserLocation, updateOnlineStatus, updateCommunityProfile, getUserStats,
    markNotificationRead, markAllNotificationsRead, getUnreadCount,
    getFollowers, getFollowing, getAllUsers, getFeedPosts, getPopularPosts, getTrendingTopics,
    incrementViewCount, getPostRank, isUserBlocked, blockUser,
    refreshFeed, refreshTopics, votePoll,
    isAuthenticated, getSelectedTopics, updateSelectedTopics, checkOnboardingStatus,
    refreshTopicsData: refreshTopics,
    syncUserProfileAcrossPosts, loadMorePosts,
  }), [
    state,
    createPost, likePost, unlikePost, repostPost, unrepostPost, bookmarkPost, sharePost, deletePost,
    getPostById, voteHelpful, addComment, likeComment, voteCommentHelpful, replyToComment,
    joinTopic, leaveTopic, getTopicById, getPostsByTopic,
    followUser, unfollowUser, getUserById, getUserPosts, isFollowingFinal,
    updateUserBio, updateUserLocation, updateOnlineStatus, updateCommunityProfile, getUserStats,
    markNotificationRead, markAllNotificationsRead, getUnreadCount,
    getFollowers, getFollowing, getAllUsers, getFeedPosts, getPopularPosts, getTrendingTopics,
    incrementViewCount, getPostRank, isUserBlocked, blockUser,
    refreshFeed, refreshTopics, votePoll,
    isAuthenticated, getSelectedTopics, updateSelectedTopics, checkOnboardingStatus,
    syncUserProfileAcrossPosts, loadMorePosts,
  ]);

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
};

export const useCommunity = (): CommunityContextType => {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity must be used within CommunityProvider');
  return ctx;
};

export default CommunityProvider;