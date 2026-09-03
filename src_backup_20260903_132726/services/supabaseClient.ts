import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Ensure we have a valid client
if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
  console.warn('⚠️ Supabase URL not configured. Please set EXPO_PUBLIC_SUPABASE_URL in .env');
}

if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn('⚠️ Supabase Anon Key not configured. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseMessage = {
  id: string;
  sync_id: string;
  device_id: string;
  version: number;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_avatar?: string;
  receiver_id?: string;
  content: string;
  type: string;
  image_url?: string;
  file_url?: string;
  voice_url?: string;
  file_metadata?: any;
  timestamp: string;
  read: boolean;
  read_by: string[];
  family_code: string;
  reactions: any[];
  reply_to?: string;
  reply_to_preview?: string;
  is_edited: boolean;
  edited_at?: string;
  delivery_status: string;
  created_at?: string;
};

// ============================================================================
// COMMUNITY TYPES FOR SUPABASE
// ============================================================================

export type SupabaseCommunityTopic = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  created_at?: string;
  updated_at?: string;
};

export type SupabaseUserTopic = {
  user_id: string;
  topic_id: string;
  joined_at?: string;
};

export type SupabaseCommunityPost = {
  id: string;
  author_id: string;
  topic_id: string;
  content: string;
  images: string[];
  is_anonymous: boolean;
  mood?: string;
  poll_data?: any;
  likes_count: number;
  reposts_count: number;
  comments_count: number;
  bookmarks_count: number;
  helpful_votes: number;
  popularity_score: number;
  view_count: number;
  is_trending: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SupabasePostLike = {
  post_id: string;
  user_id: string;
  created_at?: string;
};

export type SupabasePostRepost = {
  post_id: string;
  user_id: string;
  created_at?: string;
};

export type SupabasePostBookmark = {
  post_id: string;
  user_id: string;
  created_at?: string;
};

export type SupabasePostView = {
  post_id: string;
  user_id: string;
  viewed_at?: string;
};

export type SupabaseCommunityComment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id?: string;
  content: string;
  likes_count: number;
  helpful_votes: number;
  created_at?: string;
  updated_at?: string;
};

export type SupabaseCommentLike = {
  comment_id: string;
  user_id: string;
  created_at?: string;
};

export type SupabaseCommentHelpfulVote = {
  comment_id: string;
  user_id: string;
  created_at?: string;
};

export type SupabasePostHelpfulVote = {
  post_id: string;
  user_id: string;
  created_at?: string;
};

export type SupabaseUserFollow = {
  follower_id: string;
  following_id: string;
  created_at?: string;
};

export type SupabaseUserBlock = {
  blocker_id: string;
  blocked_id: string;
  created_at?: string;
};

export type SupabaseCommunityNotification = {
  id: string;
  user_id: string;
  type: string;
  actor_id: string;
  post_id?: string;
  comment_id?: string;
  content: string;
  target?: string;
  is_read: boolean;
  created_at?: string;
};

export type SupabaseUserActivity = {
  user_id: string;
  status: string;
  last_active?: string;
  updated_at?: string;
};

export type SupabasePollVote = {
  post_id: string;
  user_id: string;
  option_id: string;
  voted_at?: string;
};