// src/services/supabaseClient.ts
// ─────────────────────────────────────────────────────────────────────
// ⚠️  BACKWARD-COMPAT RE-EXPORT
//
// This file previously created its own Supabase client. That was one of
// THREE duplicate clients in the codebase, which caused auth and realtime
// bugs across the app.
//
// It now re-exports from the canonical client at src/utils/supabase.ts.
// Existing imports like `import { supabase } from '@/services/supabaseClient'`
// continue to work unchanged.
//
// DO NOT ADD createClient() to this file.
// If you need a new helper, add it to src/utils/supabase.ts.
// ─────────────────────────────────────────────────────────────────────

// ─── The Client (re-exported) ───────────────────────────────────────

export {
  supabase,
  supabase as default,
} from '../utils/supabase';

// ─── Helpers (re-exported) ──────────────────────────────────────────

export {
  checkSupabaseConnection,
  getCurrentSession,
  getCurrentUser,
  getCurrentUserId,
  refreshSessionWithRetry,
  onAuthStateChange,
  signOutWithCleanup,
  getUserProfile,
  upsertUserProfile,
  clearSupabaseLocalState,
} from '../utils/supabase';

// ─── Storage Adapter (re-exported) ──────────────────────────────────

export { supabaseStorage } from '../utils/supabase';

// ─── Type Re-exports ────────────────────────────────────────────────

export type {
  SupabaseClient,
  Session,
  User,
} from '../utils/supabase';

// ─── Community Types (kept for backward compat) ─────────────────────
// These are re-exported here because some older imports did:
//   import type { SupabaseMessage } from '@/services/supabaseClient';

export type {
  // Babies / family
  BabyRow,
  FamilyMemberRow,
  TrackerEntryRow,
  AppSettingsRow,
  ProfileRow,
  InviteCodeRow,
  AIFeaturesRow,

  // Family chat
  SupabaseMessage,
  SupabaseFamilyChat,
  SupabaseTypingStatus,

  // Community
  SupabaseCommunityTopic,
  SupabaseUserTopic,
  SupabaseCommunityPost,
  SupabasePostLike,
  SupabasePostRepost,
  SupabasePostBookmark,
  SupabasePostView,
  SupabaseCommunityComment,
  SupabaseCommentLike,
  SupabaseCommentHelpfulVote,
  SupabasePostHelpfulVote,
  SupabaseUserFollow,
  SupabaseUserBlock,
  SupabaseCommunityNotification,
  SupabaseUserActivity,
  SupabasePollVote,
  SupabaseCommunityProfile,

  // Helpers
  SupabaseStorageAdapter,
  SupabaseAuthResult,
  SupabaseConnectionStatus,
} from '../types/supabase';