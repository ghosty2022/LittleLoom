// src/types/supabase.ts
// ─────────────────────────────────────────────────────────────────────
// Central Supabase type definitions.
// Pure types only — no runtime code. Safe to import from anywhere.
// ─────────────────────────────────────────────────────────────────────

// ─── Database Table Types ────────────────────────────────────────────

export type BabyRow = {
  id: string;
  name: string;
  avatar: string | null;
  avatar_url: string | null;
  date_of_birth: string;
  gender: string | null;
  blood_type: string | null;
  medical_notes: string | null;
  parent1_id: string;
  parent2_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  birth_time: string | null;
  birth_weight_kg: number | null;
  birth_height_cm: number | null;
  birth_head_circumference: number | null;
  delivery_type: 'vaginal' | 'c_section' | 'c-section' | 'vbac' | 'other' | null;
  gestational_weeks: number | null;
  apgar_1min: number | null;
  apgar_5min: number | null;
  birth_place: string | null;
  birth_attendant: 'obstetrician' | 'midwife' | 'family_doctor' | 'doula' | 'other' | null;
  multiple_birth: boolean | null;
  birth_order: number | null;
  feeding_plan: 'breastfeeding' | 'formula' | 'combination' | 'pumping' | null;
  allergies: string[] | null;
  current_weight_kg: number | null;
  current_height_cm: number | null;
  skin_tone: number | null;
  streak: number | null;
  milestones_count: number | null;
  photos_count: number | null;
  emergency_contact: string | null;
  pediatrician: string | null;
  notifications_enabled: boolean | null;
  parent_id: string | null;
  notes: string | null;
};

export type FamilyMemberRow = {
  id: string;
  baby_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  avatar: string | null;
  role: 'parent1' | 'parent2' | 'guardian' | 'viewer' | string;
  relationship: string | null;
  permissions: Record<string, boolean>;
  added_at: string;
  added_by: string;
  can_be_removed: boolean;
  last_active: string | null;
  phone_number: string | null;
  notifications_enabled: boolean;
  status: 'pending' | 'active' | 'inactive' | string;
  updated_at: string;
  is_deleted: boolean | null;
  deleted_at: string | null;
};

export type TrackerEntryRow = {
  id: string;
  baby_id: string | null;
  tracker_type: 'feed' | 'sleep' | 'potty' | 'milestone' | 'custom' | 'growth' | 'medication' | string;
  tracker_id: string | null;
  timestamp: string;
  data: Record<string, unknown>;
  notes: string | null;
  photo_uris: string[] | null;
  tags: string[] | null;
  created_by: string | null;
  created_by_name: string | null;
  created_by_role: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean | null;
  title: string | null;
  logged_by: string | null;
  logged_by_name: string | null;
  logged_by_role: string | null;
  deleted_at: string | null;
  notification_id: string | null;
  reminder_scheduled: boolean | null;
  synced_at: string | null;
  edited_by: string | null;
  edited_at: string | null;
};

export type AppSettingsRow = {
  key: string;
  value: string;
  user_id: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  avatar: string | null;
  avatar_url: string | null;
  email: string;
  phone_number: string | null;
  role: 'parent1' | 'parent2' | 'guardian' | 'parent' | 'admin' | 'guest' | null;
  created_at: string;
  updated_at: string;
  preferences: Record<string, unknown> | null;
  community_username: string | null;
  community_handle: string | null;
  community_bio: string | null;
  community_avatar: string | null;
  community_display_name: string | null;
  community_stats: Record<string, unknown> | null;
  community_selected_topics: string[] | null;
  is_verified: boolean | null;
  verification_date: string | null;
  is_public: boolean | null;
  allow_messages: boolean | null;
  show_activity_status: boolean | null;
  notifications_enabled: boolean | null;
  last_active: string | null;
  email_confirmed: boolean | null;
  two_factor_enabled: boolean | null;
  is_active: boolean | null;
  last_seen_at: string | null;
  username: string | null;
  babies_count: number | null;
  security_score: number | null;
  last_security_check: string | null;
  last_login_ip: string | null;
  device_info: Record<string, unknown> | null;
  login_history: unknown[] | null;
  failed_login_attempts: number | null;
  locked_until: string | null;
  admin_role: string | null;
};

export type InviteCodeRow = {
  code: string;
  family_id: string;
  baby_name: string | null;
  baby_dob: string | null;
  baby_gender: string | null;
  creator_id: string;
  creator_name: string | null;
  role: 'parent2' | 'guardian' | 'viewer';
  relationship: string | null;
  created_at: number;
  expires_in_days: number;
  used: boolean;
  used_by: string | null;
  used_at: number | null;
  revoked: boolean;
  used_by_email: string | null;
  used_by_phone: string | null;
  used_by_name: string | null;
  signup_completed: boolean | null;
  partial_signup_at: number | null;
  updated_at: number | null;
};

export type AIFeaturesRow = {
  id: string;
  baby_id: string;
  feature_date: string;
  feed_count: number | null;
  feed_total_ml: number | null;
  feed_avg_interval_minutes: number | null;
  sleep_total_minutes: number | null;
  sleep_nap_count: number | null;
  sleep_consistency_score: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  weight_percentile: number | null;
  weight_velocity_kg_per_week: number | null;
  temperature_max: number | null;
  symptom_count: number | null;
  routine_consistency_score: number | null;
  parent_engagement_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

// ─── Family Chat Types ──────────────────────────────────────────────

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
  file_metadata?: unknown;
  timestamp: string;
  read: boolean;
  read_by: string[];
  family_code: string;
  reactions: unknown[];
  reply_to?: string;
  reply_to_preview?: string;
  is_edited: boolean;
  edited_at?: string;
  delivery_status: string;
  created_at?: string;
};

export type SupabaseFamilyChat = {
  id: string;
  type: 'group' | 'direct';
  name: string;
  participants: string[];
  participant_roles: Record<string, string>;
  participant_names: Record<string, string>;
  participant_avatars: Record<string, string>;
  last_message_id?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  avatar?: string;
  is_muted: boolean;
  family_code: string;
  is_pinned: boolean;
  background_image?: string;
};

export type SupabaseTypingStatus = {
  user_id: string;
  chat_id: string;
  family_code: string;
  is_typing: boolean;
  timestamp: string;
};

// ─── Community Types ────────────────────────────────────────────────

export type SupabaseCommunityTopic = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  category?: string;
  subcategory?: string;
  category_order?: number;
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
  poll_data?: unknown;
  likes_count: number;
  reposts_count: number;
  comments_count: number;
  bookmarks_count: number;
  helpful_votes: number;
  popularity_score: number;
  view_count: number;
  is_trending: boolean;
  is_deleted?: boolean;
  status?: string;
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
  is_deleted?: boolean;
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

export type SupabaseCommunityProfile = {
  id: string;
  user_id: string;
  display_name: string;
  username?: string | null;
  handle?: string | null;
  bio?: string | null;
  avatar?: string | null;
  cover_photo?: string | null;
  location?: string | null;
  country?: string | null;
  is_verified: boolean | null;
  is_public: boolean | null;
  allow_messages: boolean | null;
  show_activity_status: boolean | null;
  notifications_enabled: boolean | null;
  join_date?: string;
  updated_at?: string;
  username_updated_at?: string | null;
  username_history?: unknown[] | null;
  stats?: Record<string, unknown> | null;
  achievements?: string[] | null;
  preferences?: Record<string, unknown> | null;
  created_at?: string;
  verification_date?: string | null;
  verification_method?: string | null;
  security_score?: number | null;
  last_security_check?: string | null;
  avatar_url?: string | null;
};

// ─── Safe Storage Interface ─────────────────────────────────────────

export interface SupabaseStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// ─── Auth Types ─────────────────────────────────────────────────────

export interface SupabaseAuthResult {
  success: boolean;
  message?: string;
  userId?: string;
}

export interface SupabaseConnectionStatus {
  connected: boolean;
  message: string;
  error?: string;
}

// ─── Re-exports (convenience) ───────────────────────────────────────

export type { Session, User } from '@supabase/supabase-js';