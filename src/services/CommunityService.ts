// src/services/CommunityService.ts
// ─────────────────────────────────────────────────────────────
// Supabase data layer for The Loom (community).
// EVERY read/write here goes to Supabase. Nothing is stored in
// AsyncStorage except an offline safety cache of the last feed.
// ─────────────────────────────────────────────────────────────
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Post,
  Comment,
  Topic,
  Notification,
  Poll,
  PostMood,
  CommunityUser,
} from '@/context/CommunityContext';
import { INITIAL_TOPICS } from '@/context/CommunityContext';

const FEED_CACHE_KEY = '@littleloom_community_feed_cache_v3';
const FEED_CACHE_TTL = 1000 * 60 * 5; // 5 min — fallback only, not primary

/* ─────────────────────────────────────────────────────────────
   ROW → CLIENT MAPPING
   ───────────────────────────────────────────────────────────── */
const mapProfileToCommunityUser = (row: any): CommunityUser => ({
  id: row.id,
  displayName: row.community_display_name || row.full_name || 'Parent',
  handle: row.community_handle || row.username || '@parent',
  avatar: row.community_avatar || row.avatar_url || row.avatar || '👤',
  coverPhoto: row.community_cover || undefined,
  isVerified: row.is_verified === true,
  bio: row.community_bio || '',
  // `profiles` has no `country` column. The geography lives on
  // `community_profiles.country` (a separate table we don't join here).
  // Consumers that need it must fetch it separately. On plain `profiles`
  // selects both of these will always be `''`.
  //
  // If/when a `profiles.country` column is added, the fallback chains
  // below will pick it up automatically.
  location: row.location || row.country || '',
  country: row.location || row.country || '',
  onlineStatus: (row.online_status as any) || 'offline',
  lastActive: row.last_active || new Date().toISOString(),
  stats: row.community_stats || { posts: 0, followers: 0, following: 0, helpful: 0, streakDays: 0, lastStreakDate: new Date().toISOString() },
  // `profiles` has no `community_achievements` column — the achievements
  // array lives on `community_profiles.achievements`. Reads through plain
  // `profiles` selects always fall back to an empty array. If you start
  // joining `community_profiles`, map that column explicitly.
  achievements: Array.isArray(row.community_achievements)
    ? row.community_achievements
    : [],
  selectedTopics: row.community_selected_topics || [],
  isFollowing: undefined,
});

const mapPostRow = (row: any, meId: string | null, followedIds: Set<string>): Post => {
  const topic = INITIAL_TOPICS.find((t) => t.id === row.topic_id);
  const author = mapProfileToCommunityUser(row.author || {});
  return {
    id: row.id,
    authorId: row.author_id,
    author: { ...author, isFollowing: followedIds.has(row.author_id) },
    topic: topic?.name || row.topic_id,
    topicId: row.topic_id,
    content: row.content || '',
    images: row.images || [],
    likes: row.likes_count || 0,
    likedBy: [],
    comments: [],
    commentsCount: row.comments_count || 0,
    reposts: row.reposts_count || 0,
    repostedBy: [],
    shares: 0,
    sharedBy: [],
    isLiked: !!meId && row.__is_liked === true,
    isReposted: !!meId && row.__is_reposted === true,
    isBookmarked: !!meId && row.__is_bookmarked === true,
    bookmarks: row.bookmarks_count || 0,
    bookmarkedBy: [],
    time: relativeTime(row.created_at),
    timestamp: row.created_at,
    isAnonymous: !!row.is_anonymous,
    helpfulVotes: row.helpful_votes || 0,
    votedHelpfulBy: [],
    popularityScore: row.popularity_score || 0,
    viewCount: row.view_count || 0,
    engagementRate: 0,
    lastEngagedAt: row.updated_at || row.created_at,
    isTrending: !!row.is_trending,
    mood: row.mood as PostMood | undefined,
    poll: row.poll_data
      ? { ...row.poll_data, totalVotes: row.poll_data.totalVotes || 0 }
      : undefined,
  };
};

const mapCommentRow = (row: any): Comment => ({
  id: row.id,
  authorId: row.author_id,
  author: mapProfileToCommunityUser(row.author || {}),
  content: row.content || '',
  likes: row.likes_count || 0,
  likedBy: [],
  isLiked: row.__is_liked === true,
  time: relativeTime(row.created_at),
  timestamp: row.created_at,
  replies: [],
  helpfulVotes: row.helpful_votes || 0,
  votedHelpfulBy: [],
});

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 60) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

/* ─────────────────────────────────────────────────────────────
   READ HELPERS
   ───────────────────────────────────────────────────────────── */

/**
 * Fetch the feed. Includes:
 *   • all non-deleted posts
 *   • author joined from `profiles`
 *   • per-user flags computed with a second small query
 * Respects blocks (both directions), so a blocked user's posts vanish.
 */
export const fetchFeed = async (
  meId: string,
  opts: { limit?: number; before?: string; topicId?: string } = {},
): Promise<Post[]> => {
  const limit = opts.limit ?? 30;

  // 1) blocked users (I blocked them OR they blocked me)
  const { data: blocks } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${meId},blocked_id.eq.${meId}`);
  const blockedIds = new Set<string>();
  (blocks || []).forEach((b: any) => {
    blockedIds.add(b.blocker_id === meId ? b.blocked_id : b.blocker_id);
  });

  // 2) posts + author
  let q = supabase
    .from('community_posts')
    .select(
      `id, author_id, topic_id, content, images, is_anonymous, mood, poll_data,
       likes_count, reposts_count, comments_count, bookmarks_count, helpful_votes,
       popularity_score, view_count, is_trending, created_at, updated_at,
       author:profiles!community_posts_author_id_fkey(id, full_name, community_display_name, community_handle, username, community_avatar, avatar_url, community_bio, community_cover, is_verified, community_stats, community_selected_topics)`,
    )
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.topicId) q = q.eq('topic_id', opts.topicId);
  if (opts.before) q = q.lt('created_at', opts.before);

  const { data: rows, error } = await q;
  if (error) {
    console.warn('[CommunityService] fetchFeed error:', error.message);
    // fallback to cache
    try {
      const cached = await AsyncStorage.getItem(FEED_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < FEED_CACHE_TTL) return parsed.posts as Post[];
      }
    } catch {}
    return [];
  }

  const safeRows = (rows || []).filter(
    (r: any) => !blockedIds.has(r.author_id),
  );

  // 3) which do I like / repost / bookmark?
  const ids = safeRows.map((r: any) => r.id);
  if (ids.length === 0) return [];

  const [likes, reposts, bookmarks] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('user_id', meId).in('post_id', ids),
    supabase.from('post_reposts').select('post_id').eq('user_id', meId).in('post_id', ids),
    supabase.from('post_bookmarks').select('post_id').eq('user_id', meId).in('post_id', ids),
  ]);
  const likedSet = new Set((likes.data || []).map((r) => r.post_id));
  const repostedSet = new Set((reposts.data || []).map((r) => r.post_id));
  const bookmarkedSet = new Set((bookmarks.data || []).map((r) => r.post_id));

  // 4) who do I follow?
  const { data: follows } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', meId);
  const followedSet = new Set((follows || []).map((f) => f.following_id));

  const posts = safeRows.map((r: any) =>
    mapPostRow(
      {
        ...r,
        __is_liked: likedSet.has(r.id),
        __is_reposted: repostedSet.has(r.id),
        __is_bookmarked: bookmarkedSet.has(r.id),
      },
      meId,
      followedSet,
    ),
  );

  // cache for cold start
  AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ ts: Date.now(), posts })).catch(() => {});

  return posts;
};

export const fetchPostById = async (postId: string, meId: string): Promise<Post | null> => {
  const { data, error } = await supabase
    .from('community_posts')
    .select(
      `id, author_id, topic_id, content, images, is_anonymous, mood, poll_data,
       likes_count, reposts_count, comments_count, bookmarks_count, helpful_votes,
       popularity_score, view_count, is_trending, created_at, updated_at,
       author:profiles!community_posts_author_id_fkey(id, full_name, community_display_name, community_handle, username, community_avatar, avatar_url, community_bio, community_cover, is_verified, community_stats, community_selected_topics)`,
    )
    .eq('id', postId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error || !data) return null;

  const [likes, reposts, bookmarks, follows] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('user_id', meId).eq('post_id', postId).maybeSingle(),
    supabase.from('post_reposts').select('post_id').eq('user_id', meId).eq('post_id', postId).maybeSingle(),
    supabase.from('post_bookmarks').select('post_id').eq('user_id', meId).eq('post_id', postId).maybeSingle(),
    supabase.from('user_follows').select('following_id').eq('follower_id', meId),
  ]);
  const followedSet = new Set((follows.data || []).map((f) => f.following_id));

  return mapPostRow(
    {
      ...data,
      __is_liked: !!likes.data,
      __is_reposted: !!reposts.data,
      __is_bookmarked: !!bookmarks.data,
    },
    meId,
    followedSet,
  );
};

export const fetchCommentsForPost = async (postId: string, meId: string): Promise<Comment[]> => {
  const { data, error } = await supabase
    .from('community_comments')
    .select(
      `id, post_id, author_id, parent_comment_id, content, likes_count, helpful_votes,
       created_at, updated_at, is_deleted,
       author:profiles!community_comments_author_id_fkey(id, full_name, community_display_name, community_handle, username, community_avatar, avatar_url, community_bio, is_verified, community_stats, community_selected_topics)`,
    )
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[CommunityService] fetchCommentsForPost:', error.message);
    return [];
  }

  const ids = (data || []).map((r: any) => r.id);
  if (ids.length === 0) return [];

  const liked = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', meId)
    .in('comment_id', ids);
  const likedSet = new Set((liked.data || []).map((r) => r.comment_id));

  const topLevel: Comment[] = [];
  const byId = new Map<string, Comment>();
  (data || []).forEach((r: any) => {
    const c = mapCommentRow({ ...r, __is_liked: likedSet.has(r.id) });
    byId.set(c.id, c);
    if (!r.parent_comment_id) topLevel.push(c);
  });
  (data || []).forEach((r: any) => {
    if (r.parent_comment_id && byId.has(r.parent_comment_id)) {
      const parent = byId.get(r.parent_comment_id)!;
      parent.replies = [...(parent.replies || []), byId.get(r.id)!];
    }
  });
  return topLevel;
};

export const fetchNotifications = async (meId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('community_notifications')
    .select(
      `id, type, actor_id, post_id, comment_id, content, target, is_read, created_at,
       actor:profiles!community_notifications_actor_id_fkey(id, full_name, community_display_name, community_handle, username, community_avatar, avatar_url, is_verified, community_stats)`,
    )
    .eq('user_id', meId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    type: r.type,
    userId: r.actor_id,
    user: mapProfileToCommunityUser(r.actor || {}),
    content: r.content,
    target: r.target || undefined,
    postId: r.post_id || undefined,
    time: relativeTime(r.created_at),
    timestamp: r.created_at,
    read: !!r.is_read,
  }));
};

export const fetchFollowedIds = async (meId: string): Promise<Set<string>> => {
  const { data } = await supabase.from('user_follows').select('following_id').eq('follower_id', meId);
  return new Set((data || []).map((r) => r.following_id));
};

export const fetchFollowerIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase.from('user_follows').select('follower_id').eq('following_id', userId);
  return (data || []).map((r) => r.follower_id);
};

export const fetchFollowingIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase.from('user_follows').select('following_id').eq('follower_id', userId);
  return (data || []).map((r) => r.following_id);
};

/* ─────────────────────────────────────────────────────────────
   WRITE HELPERS — all RLS-scoped
   ───────────────────────────────────────────────────────────── */

export const insertPost = async (params: {
  authorId: string;
  topicId: string;
  content: string;
  images?: string[];
  isAnonymous?: boolean;
  mood?: PostMood;
  poll?: Poll;
}): Promise<Post | null> => {
  const id = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const { error } = await supabase.from('community_posts').insert({
    id,
    author_id: params.authorId,
    topic_id: params.topicId,
    content: params.content,
    images: params.images || [],
    is_anonymous: params.isAnonymous || false,
    mood: params.mood || null,
    poll_data: params.poll
      ? { ...params.poll, totalVotes: 0, hasVoted: false, votedOptionId: null }
      : null,
  });
  if (error) {
    console.warn('[CommunityService] insertPost:', error.message);
    return null;
  }
  return fetchPostById(id, params.authorId);
};

export const deletePostRow = async (postId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('community_posts')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', postId);
  return !error;
};

export const toggleLike = async (postId: string, meId: string, like: boolean): Promise<void> => {
  if (like) {
    await supabase.from('post_likes').upsert({ post_id: postId, user_id: meId }, { onConflict: 'post_id,user_id' });
  } else {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', meId);
  }
};

export const toggleRepost = async (postId: string, meId: string, repost: boolean): Promise<void> => {
  if (repost) {
    await supabase.from('post_reposts').upsert({ post_id: postId, user_id: meId }, { onConflict: 'post_id,user_id' });
  } else {
    await supabase.from('post_reposts').delete().eq('post_id', postId).eq('user_id', meId);
  }
};

export const toggleBookmark = async (postId: string, meId: string, bookmarked: boolean): Promise<void> => {
  if (bookmarked) {
    await supabase.from('post_bookmarks').upsert({ post_id: postId, user_id: meId }, { onConflict: 'post_id,user_id' });
  } else {
    await supabase.from('post_bookmarks').delete().eq('post_id', postId).eq('user_id', meId);
  }
};

export const toggleHelpful = async (postId: string, meId: string, helpful: boolean): Promise<void> => {
  if (helpful) {
    await supabase.from('post_helpful_votes').upsert({ post_id: postId, user_id: meId }, { onConflict: 'post_id,user_id' });
  } else {
    await supabase.from('post_helpful_votes').delete().eq('post_id', postId).eq('user_id', meId);
  }
};

export const insertComment = async (params: {
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
}): Promise<void> => {
  const id = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await supabase.from('community_comments').insert({
    id,
    post_id: params.postId,
    author_id: params.authorId,
    parent_comment_id: params.parentCommentId || null,
    content: params.content,
  });
};

export const toggleCommentLike = async (commentId: string, meId: string, like: boolean): Promise<void> => {
  if (like) {
    await supabase.from('comment_likes').upsert({ comment_id: commentId, user_id: meId }, { onConflict: 'comment_id,user_id' });
  } else {
    await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', meId);
  }
};

export const toggleCommentHelpful = async (commentId: string, meId: string, helpful: boolean): Promise<void> => {
  if (helpful) {
    await supabase.from('comment_helpful_votes').upsert({ comment_id: commentId, user_id: meId }, { onConflict: 'comment_id,user_id' });
  } else {
    await supabase.from('comment_helpful_votes').delete().eq('comment_id', commentId).eq('user_id', meId);
  }
};

export const followRow = async (meId: string, targetId: string, follow: boolean): Promise<void> => {
  if (meId === targetId) return;
  if (follow) {
    await supabase.from('user_follows').upsert({ follower_id: meId, following_id: targetId }, { onConflict: 'follower_id,following_id' });
  } else {
    await supabase.from('user_follows').delete().eq('follower_id', meId).eq('following_id', targetId);
  }
};

export const blockRow = async (meId: string, targetId: string, block: boolean): Promise<void> => {
  if (block) {
    await supabase.from('user_blocks').upsert({ blocker_id: meId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' });
    // also unfollow both directions
    await followRow(meId, targetId, false);
    await supabase.from('user_follows').delete().eq('follower_id', targetId).eq('following_id', meId);
  } else {
    await supabase.from('user_blocks').delete().eq('blocker_id', meId).eq('blocked_id', targetId);
  }
};

export const fetchBlockedIds = async (meId: string): Promise<string[]> => {
  const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', meId);
  return (data || []).map((r) => r.blocked_id);
};

export const markNotificationReadRow = async (notifId: string, meId: string): Promise<void> => {
  await supabase.from('community_notifications').update({ is_read: true }).eq('id', notifId).eq('user_id', meId);
};

export const markAllNotificationsReadRow = async (meId: string): Promise<void> => {
  await supabase.from('community_notifications').update({ is_read: true }).eq('user_id', meId).eq('is_read', false);
};

export const votePollRow = async (postId: string, optionId: string, meId: string): Promise<void> => {
  // one vote per user
  const { data: existing } = await supabase
    .from('poll_votes')
    .select('option_id')
    .eq('post_id', postId)
    .eq('user_id', meId)
    .maybeSingle();
  if (existing) return;
  await supabase.from('poll_votes').insert({ post_id: postId, user_id: meId, option_id: optionId });
};

export const incrementViewRow = async (postId: string, meId: string): Promise<void> => {
  await supabase
    .from('post_views')
    .upsert({ post_id: postId, user_id: meId }, { onConflict: 'post_id,user_id' });
};

export const fetchTopicStats = async (): Promise<Topic[]> => {
  // 1) Try the RPC (fast, single round-trip, aggregates in the DB).
  const { data, error } = await supabase.rpc('get_topic_stats');
  if (!error && data && data.length > 0) {
    const postMap = new Map<string, number>();
    const memberMap = new Map<string, number>();
    data.forEach((r: any) => {
      postMap.set(r.topic_id, Number(r.post_count) || 0);
      memberMap.set(r.topic_id, Number(r.member_count) || 0);
    });
    return INITIAL_TOPICS.map((t) => ({
      ...t,
      posts: Math.max(t.posts, postMap.get(t.id) || 0),
      members: Math.max(t.members, memberMap.get(t.id) || 0),
    }));
  }

  // 2) Fallback: compute counts client-side from actual rows. This is
  // fine because the topic list is small (17 topics) and the post count
  // query returns only the topic_id column.
  try {
    const [postsRes, topicsRes] = await Promise.all([
      supabase
        .from('community_posts')
        .select('topic_id')
        .eq('is_deleted', false),
      supabase
        .from('user_topics')
        .select('topic_id'),
    ]);
    const postCounts = new Map<string, number>();
    (postsRes.data || []).forEach((r: any) => {
      postCounts.set(r.topic_id, (postCounts.get(r.topic_id) || 0) + 1);
    });
    const memberCounts = new Map<string, number>();
    (topicsRes.data || []).forEach((r: any) => {
      memberCounts.set(r.topic_id, (memberCounts.get(r.topic_id) || 0) + 1);
    });
    return INITIAL_TOPICS.map((t) => ({
      ...t,
      posts: postCounts.get(t.id) || t.posts || 0,
      members: memberCounts.get(t.id) || t.members || 0,
    }));
  } catch {
    return INITIAL_TOPICS;
  }
};

export const fetchUserProfileById = async (userId: string): Promise<CommunityUser | null> => {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, community_display_name, community_handle, username, community_avatar, avatar_url, community_bio, community_cover, is_verified, community_stats, community_selected_topics')
    .eq('id', userId)
    .maybeSingle();
  return data ? mapProfileToCommunityUser(data) : null;
};

export const fetchUserPosts = async (userId: string, meId: string): Promise<Post[]> => {
  const { data } = await supabase
    .from('community_posts')
    .select(
      `id, author_id, topic_id, content, images, is_anonymous, mood, poll_data,
       likes_count, reposts_count, comments_count, bookmarks_count, helpful_votes,
       popularity_score, view_count, is_trending, created_at, updated_at,
       author:profiles!community_posts_author_id_fkey(id, full_name, community_display_name, community_handle, username, community_avatar, avatar_url, community_bio, community_cover, is_verified, community_stats, community_selected_topics)`,
    )
    .eq('author_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (!data) return [];
  const followedSet = await fetchFollowedIds(meId);
  return data.map((r: any) => mapPostRow(r, meId, followedSet));
};

/* ─────────────────────────────────────────────────────────────
   SEARCH (users) — used by Followers / Following / Search screens
   ───────────────────────────────────────────────────────────── */
export const searchUsers = async (query: string, meId: string): Promise<CommunityUser[]> => {
  const q = query.trim();
  if (!q) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, community_display_name, community_handle, username, community_avatar, avatar_url, community_bio, community_cover, is_verified, community_stats, community_selected_topics')
    .or(`community_handle.ilike.%${q}%,community_display_name.ilike.%${q}%,full_name.ilike.%${q}%,username.ilike.%${q}%`)
    .neq('id', meId)
    .limit(30);
  return (data || []).map(mapProfileToCommunityUser);
};