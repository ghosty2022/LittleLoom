

















export {
  supabase,
  supabase as default,
} from '../utils/supabase';



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



export { supabaseStorage } from '../utils/supabase';



export type {
  SupabaseClient,
  Session,
  User,
} from '../utils/supabase';





export type {
  
  BabyRow,
  FamilyMemberRow,
  TrackerEntryRow,
  AppSettingsRow,
  ProfileRow,
  InviteCodeRow,
  AIFeaturesRow,

  
  SupabaseMessage,
  SupabaseFamilyChat,
  SupabaseTypingStatus,

  
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

  
  SupabaseStorageAdapter,
  SupabaseAuthResult,
  SupabaseConnectionStatus,
} from '../types/supabase';