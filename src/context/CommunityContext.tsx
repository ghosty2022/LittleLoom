import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useAuth } from './AuthContext';
import { useSweetAlert } from '../components/SweetAlert';
import { decode } from 'base64-arraybuffer';

// ─── Types (kept identical to your current public API) ─────────────
export type OnlineStatus = 'online' | 'offline' | 'away';
export type MessageType = 'text' | 'image';
export type PostMood = 'celebrating' | 'support' | 'advice' | 'milestone' | 'venting';

export interface PollOption { id: string; text: string; votes: number; }
export interface Poll { question: string; options: PollOption[]; totalVotes: number; hasVoted: boolean; votedOptionId?: string; }

export interface CommunityUser {
  id: string; displayName: string; handle: string; avatar: string; coverPhoto?: string;
  isVerified: boolean; bio?: string; location?: string; country?: string;
  onlineStatus: OnlineStatus; lastActive: string;
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
  content: string; images?: string[]; likes: number; likedBy: string[]; comments: Comment[];
  commentsCount: number; reposts: number; repostedBy: string[]; shares: number; sharedBy: string[];
  isLiked: boolean; isReposted: boolean; isBookmarked: boolean; bookmarks: number; bookmarkedBy: string[];
  time: string; timestamp: string; isAnonymous?: boolean; helpfulVotes: number; votedHelpfulBy: string[];
  popularityScore: number; viewCount: number; engagementRate: number; lastEngagedAt: string;
  isTrending: boolean; mood?: PostMood; poll?: Poll;
}

export interface Topic {
  id: string; name: string; emoji: string; color: string; members: number; posts: number;
  trending: boolean; description: string; isJoined: boolean; joinedBy: string[];
  engagementScore: number; weeklyGrowth: number; category?: string; subcategory?: string;
}

export interface Notification {
  id: string; type: 'like'|'comment'|'repost'|'mention'|'follow'|'message'|'system'|'helpful';
  userId: string; user: CommunityUser; content: string; target?: string; postId?: string;
  time: string; timestamp: string; read: boolean;
}

export interface FileMetadata { name: string; size?: number; mimeType?: string; uri: string; }
export interface Message {
  id: string; chatId: string; senderId: string; receiverId: string; content: string;
  timestamp: string; read: boolean; type: MessageType; imageUrl?: string; fileMeta?: FileMetadata;
  deliveryStatus?: 'sending'|'sent'|'delivered'|'read'|'failed';
  replyTo?: string; replyToPreview?: string; editedAt?: string;
}
export interface Chat { id: string; participantId: string; participant: CommunityUser; messages: Message[]; lastMessage: Message; unreadCount: number; updatedAt: string; isTyping?: boolean; }
export interface UserActivity { userId: string; lastActive: string; status: OnlineStatus; }
export interface PopularPost { postId: string; score: number; timestamp: string; }

// ─── Static topic data (unchanged) ─────────────────────────────────
export const INITIAL_TOPICS: Topic[] = [
  { id:'topic_health_fever', name:'Fever', emoji:'🌡️', color:'#EE5A24', members:12500, posts:3200, trending:true, description:'Track fever symptoms and temperature', isJoined:false, joinedBy:[], engagementScore:85, weeklyGrowth:12, category:'health', subcategory:'symptoms' },
  { id:'topic_health_allergy', name:'Allergies', emoji:'🤧', color:'#FF6B6B', members:8200, posts:2100, trending:false, description:'Managing allergies and reactions', isJoined:false, joinedBy:[], engagementScore:72, weeklyGrowth:8, category:'health', subcategory:'conditions' },
  { id:'topic_health_teething', name:'Teething', emoji:'🦷', color:'#FF9F43', members:15600, posts:5400, trending:true, description:'Teething symptoms and relief tips', isJoined:false, joinedBy:[], engagementScore:90, weeklyGrowth:17, category:'health', subcategory:'conditions' },
  { id:'topic_health_vaccines', name:'Vaccines', emoji:'💉', color:'#5F27CD', members:9300, posts:2800, trending:false, description:'Immunization schedules and information', isJoined:false, joinedBy:[], engagementScore:78, weeklyGrowth:10, category:'health', subcategory:'medical' },
  { id:'topic_health_doctor', name:'Doctor Visits', emoji:'👨‍⚕️', color:'#00D2D3', members:11200, posts:3600, trending:true, description:'Pediatrician visits and healthcare', isJoined:false, joinedBy:[], engagementScore:82, weeklyGrowth:11, category:'health', subcategory:'medical' },
  { id:'topic_nutrition_breastfeeding', name:'Breastfeeding', emoji:'🤱', color:'#FF9FF3', members:18200, posts:5100, trending:true, description:'Breastfeeding support and tips', isJoined:false, joinedBy:[], engagementScore:92, weeklyGrowth:18, category:'nutrition', subcategory:'feeding' },
  { id:'topic_nutrition_solid_food', name:'Solid Foods', emoji:'🥄', color:'#FF9F43', members:15800, posts:4700, trending:false, description:'Introducing solid foods and BLW', isJoined:false, joinedBy:[], engagementScore:78, weeklyGrowth:8, category:'nutrition', subcategory:'feeding' },
  { id:'topic_nutrition_formula', name:'Formula Feeding', emoji:'🍼', color:'#54A0FF', members:9800, posts:3200, trending:false, description:'Formula feeding guidance and support', isJoined:false, joinedBy:[], engagementScore:70, weeklyGrowth:6, category:'nutrition', subcategory:'feeding' },
  { id:'topic_nutrition_allergens', name:'Allergen Introduction', emoji:'🥜', color:'#EE5A24', members:6400, posts:1500, trending:false, description:'Introducing allergenic foods safely', isJoined:false, joinedBy:[], engagementScore:75, weeklyGrowth:9, category:'nutrition', subcategory:'feeding' },
  { id:'topic_nutrition_water', name:'Hydration', emoji:'💧', color:'#48DBFB', members:7200, posts:1900, trending:false, description:'Keeping your child hydrated', isJoined:false, joinedBy:[], engagementScore:68, weeklyGrowth:4, category:'nutrition', subcategory:'hydration' },
  { id:'topic_sleep_baby', name:'Baby Sleep', emoji:'😴', color:'#5F27CD', members:22400, posts:8900, trending:true, description:'Sleep tips for babies 0-12 months', isJoined:false, joinedBy:[], engagementScore:95, weeklyGrowth:22, category:'sleep', subcategory:'sleep' },
  { id:'topic_sleep_toddler', name:'Toddler Sleep', emoji:'🌙', color:'#341F97', members:15600, posts:5400, trending:true, description:'Sleep strategies for toddlers', isJoined:false, joinedBy:[], engagementScore:90, weeklyGrowth:17, category:'sleep', subcategory:'sleep' },
  { id:'topic_sleep_night_waking', name:'Night Waking', emoji:'🌃', color:'#1DD1A1', members:11200, posts:3800, trending:true, description:'Managing night wakings and sleep regressions', isJoined:false, joinedBy:[], engagementScore:88, weeklyGrowth:15, category:'sleep', subcategory:'sleep' },
  { id:'topic_dev_milestones', name:'Milestones', emoji:'🏆', color:'#FFD700', members:11700, posts:3800, trending:true, description:'Celebrate developmental milestones', isJoined:false, joinedBy:[], engagementScore:88, weeklyGrowth:15, category:'development', subcategory:'milestones' },
  { id:'topic_dev_motor_skills', name:'Motor Skills', emoji:'🏃', color:'#10AC84', members:8500, posts:2100, trending:false, description:'Gross and fine motor skill development', isJoined:false, joinedBy:[], engagementScore:72, weeklyGrowth:7, category:'development', subcategory:'skills' },
  { id:'topic_dev_speech', name:'Speech & Language', emoji:'💬', color:'#54A0FF', members:9800, posts:2800, trending:false, description:'Language development and speech', isJoined:false, joinedBy:[], engagementScore:70, weeklyGrowth:6, category:'development', subcategory:'skills' },
  { id:'topic_dev_social', name:'Social Skills', emoji:'👥', color:'#6C5CE7', members:7200, posts:1900, trending:false, description:'Social development and play', isJoined:false, joinedBy:[], engagementScore:68, weeklyGrowth:4, category:'development', subcategory:'skills' },
  { id:'topic_dev_emotional', name:'Emotional Development', emoji:'❤️', color:'#FF6B6B', members:6400, posts:1500, trending:false, description:'Supporting emotional growth', isJoined:false, joinedBy:[], engagementScore:75, weeklyGrowth:9, category:'development', subcategory:'emotional' },
  { id:'topic_parenting_potty', name:'Potty Training', emoji:'🚽', color:'#1DD1A1', members:12500, posts:3200, trending:true, description:'Tips, tricks, and support for potty training', isJoined:false, joinedBy:[], engagementScore:85, weeklyGrowth:12, category:'parenting', subcategory:'training' },
  { id:'topic_parenting_tantrums', name:'Tantrums', emoji:'😤', color:'#E74C3C', members:15600, posts:5400, trending:true, description:'Navigating toddler tantrums', isJoined:false, joinedBy:[], engagementScore:90, weeklyGrowth:17, category:'parenting', subcategory:'behavior' },
  { id:'topic_parenting_discipline', name:'Positive Discipline', emoji:'🧘', color:'#A29BFE', members:9300, posts:2100, trending:false, description:'Gentle and effective discipline', isJoined:false, joinedBy:[], engagementScore:65, weeklyGrowth:5, category:'parenting', subcategory:'behavior' },
  { id:'topic_parenting_single', name:'Single Parenting', emoji:'💪', color:'#FA709A', members:7200, posts:1900, trending:false, description:'Support and advice for single parents', isJoined:false, joinedBy:[], engagementScore:68, weeklyGrowth:4, category:'parenting', subcategory:'support' },
  { id:'topic_parenting_special_needs', name:'Special Needs', emoji:'🌈', color:'#667EEA', members:6400, posts:1500, trending:false, description:'Resources for special needs parenting', isJoined:false, joinedBy:[], engagementScore:75, weeklyGrowth:9, category:'parenting', subcategory:'support' },
  { id:'topic_tracker_growth', name:'Growth Tracking', emoji:'📏', color:'#10AC84', members:8200, posts:2400, trending:false, description:'Track height, weight, and growth', isJoined:false, joinedBy:[], engagementScore:70, weeklyGrowth:8, category:'health', subcategory:'tracking' },
  { id:'topic_tracker_feeding', name:'Feeding Tracker', emoji:'🍼', color:'#FF9F43', members:14200, posts:4200, trending:true, description:'Track feeds, solids, and nutrition', isJoined:false, joinedBy:[], engagementScore:88, weeklyGrowth:14, category:'nutrition', subcategory:'tracking' },
  { id:'topic_tracker_sleep', name:'Sleep Tracker', emoji:'😴', color:'#5F27CD', members:16800, posts:5100, trending:true, description:'Track sleep patterns and routines', isJoined:false, joinedBy:[], engagementScore:92, weeklyGrowth:16, category:'sleep', subcategory:'tracking' },
  { id:'topic_tracker_diaper', name:'Diaper Tracker', emoji:'👶', color:'#54A0FF', members:11200, posts:2800, trending:false, description:'Track diaper changes and patterns', isJoined:false, joinedBy:[], engagementScore:68, weeklyGrowth:6, category:'health', subcategory:'tracking' },
  { id:'topic_tracker_symptoms', name:'Symptom Tracker', emoji:'😷', color:'#FF6B6B', members:7600, posts:1900, trending:false, description:'Track symptoms and illness', isJoined:false, joinedBy:[], engagementScore:72, weeklyGrowth:9, category:'health', subcategory:'tracking' },
  { id:'topic_lifestyle_screen_time', name:'Screen Time', emoji:'📱', color:'#5F27CD', members:8500, posts:2100, trending:false, description:'Managing screen time for kids', isJoined:false, joinedBy:[], engagementScore:62, weeklyGrowth:7, category:'lifestyle', subcategory:'wellness' },
  { id:'topic_lifestyle_outdoor', name:'Outdoor Play', emoji:'🌳', color:'#1DD1A1', members:7200, posts:1800, trending:false, description:'Outdoor activities and nature play', isJoined:false, joinedBy:[], engagementScore:65, weeklyGrowth:5, category:'lifestyle', subcategory:'activities' },
  { id:'topic_lifestyle_work_life', name:'Work-Life Balance', emoji:'⚖️', color:'#4FACFE', members:11200, posts:3600, trending:true, description:'Juggling career and parenting', isJoined:false, joinedBy:[], engagementScore:82, weeklyGrowth:11, category:'lifestyle', subcategory:'balance' },
  { id:'topic_lifestyle_self_care', name:'Parent Self-Care', emoji:'🧘', color:'#F093FB', members:6800, posts:1600, trending:false, description:'Self-care for parents', isJoined:false, joinedBy:[], engagementScore:60, weeklyGrowth:4, category:'lifestyle', subcategory:'wellness' },
  { id:'topic_community_stories', name:'Parent Stories', emoji:'📖', color:'#6A82FB', members:9800, posts:3200, trending:true, description:'Share your parenting journey', isJoined:false, joinedBy:[], engagementScore:85, weeklyGrowth:13, category:'community', subcategory:'stories' },
  { id:'topic_community_advice', name:'Advice & Tips', emoji:'💡', color:'#F59E0B', members:14200, posts:4800, trending:true, description:'Share and get parenting advice', isJoined:false, joinedBy:[], engagementScore:90, weeklyGrowth:16, category:'community', subcategory:'advice' },
  { id:'topic_community_support', name:'Support Group', emoji:'💙', color:'#3B82F6', members:11200, posts:3400, trending:true, description:'Find support from other parents', isJoined:false, joinedBy:[], engagementScore:88, weeklyGrowth:14, category:'community', subcategory:'support' },
];

export const TOPIC_CATEGORIES = [
  { id:'health', name:'Health & Wellness', emoji:'🏥', description:'Track health, symptoms, and medical care', subcategories:[{id:'symptoms',name:'Symptoms',emoji:'🌡️'},{id:'conditions',name:'Conditions',emoji:'🔴'},{id:'medical',name:'Medical Care',emoji:'🏥'},{id:'tracking',name:'Health Tracking',emoji:'📊'}] },
  { id:'nutrition', name:'Feeding & Nutrition', emoji:'🍽️', description:'Feeding, nutrition, and hydration', subcategories:[{id:'feeding',name:'Feeding',emoji:'🍼'},{id:'hydration',name:'Hydration',emoji:'💧'},{id:'tracking',name:'Feeding Tracking',emoji:'📝'}] },
  { id:'sleep', name:'Sleep', emoji:'😴', description:'Sleep tips, schedules, and tracking', subcategories:[{id:'sleep',name:'Sleep Tips',emoji:'🌙'},{id:'tracking',name:'Sleep Tracking',emoji:'📊'}] },
  { id:'development', name:'Development', emoji:'🧠', description:'Milestones, skills, and growth', subcategories:[{id:'milestones',name:'Milestones',emoji:'🏆'},{id:'skills',name:'Skills',emoji:'💪'},{id:'emotional',name:'Emotional',emoji:'❤️'}] },
  { id:'parenting', name:'Parenting', emoji:'👨‍👩‍👧', description:'Parenting tips, challenges, and support', subcategories:[{id:'training',name:'Training',emoji:'🚽'},{id:'behavior',name:'Behavior',emoji:'😤'},{id:'support',name:'Support',emoji:'💪'}] },
  { id:'lifestyle', name:'Lifestyle', emoji:'🌟', description:'Family lifestyle, balance, and wellness', subcategories:[{id:'wellness',name:'Wellness',emoji:'🧘'},{id:'activities',name:'Activities',emoji:'🎯'},{id:'balance',name:'Balance',emoji:'⚖️'}] },
  { id:'community', name:'Community', emoji:'👥', description:'Connect with other parents', subcategories:[{id:'stories',name:'Stories',emoji:'📖'},{id:'advice',name:'Advice',emoji:'💡'},{id:'support',name:'Support',emoji:'💙'}] },
];

// ─── Helpers ───────────────────────────────────────────────────────
const LITTLELOOM_TEAM: CommunityUser = {
  id: 'littleloom_team', displayName: 'LittleLoom Team', handle: '@littleloom', avatar: '🧸',
  isVerified: true, bio: 'Official LittleLoom support team.', location: 'Global', country: 'Global',
  onlineStatus: 'online', lastActive: new Date().toISOString(),
  stats: { posts: 1, followers: 9999, following: 0, helpful: 999, streakDays: 999, lastStreakDate: new Date().toISOString() },
  achievements: ['top_contributor','rising_star','influencer'], isFollowing: false, followers: [], following: [],
};

const formatTimeAgo = (date: string): string => {
  const diffMs = Date.now() - new Date(date).getTime();
  const s = Math.floor(diffMs / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (s < 60) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return new Date(date).toLocaleDateString();
};

const normalizeImageUri = (uri: string): string => {
  if (!uri) return '';
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
};

const getDateString = (d: Date): string => d.toISOString().split('T')[0];

const calculatePopularityScore = (post: Post): number => {
  const recencyBonus = Math.max(0, 24 - (Date.now() - new Date(post.timestamp).getTime()) / 3.6e6);
  return post.likes + post.commentsCount * 2 + post.reposts * 3 + post.helpfulVotes * 2 + post.viewCount * 0.1 + recencyBonus * 10;
};

const validateTopicIds = (topicIds: string[]): string[] => {
  const valid = new Set(INITIAL_TOPICS.map(t => t.id));
  return (topicIds || []).filter(id => valid.has(id));
};

// ─── Map DB row → app Post (with author hydration) ─────────────────
const mapPostRow = (row: any, author: CommunityUser, likes: string[], bookmarks: string[], reposts: string[], helpful: string[], votedOptionId?: string): Post => {
  const likedBy = Array.isArray(row.liked_by) ? row.liked_by : likes;
  const bookmarkedBy = Array.isArray(row.bookmarked_by) ? row.bookmarked_by : bookmarks;
  const repostedBy = Array.isArray(row.reposted_by) ? row.reposted_by : reposts;
  const votedHelpfulBy = Array.isArray(row.voted_helpful_by) ? row.voted_helpful_by : helpful;

  const poll = row.poll_data ? {
    question: row.poll_data.question || '',
    options: (row.poll_data.options || []).map((o: any) => ({ id: o.id, text: o.text, votes: Number(o.votes) || 0 })),
    totalVotes: (row.poll_data.options || []).reduce((s: number, o: any) => s + (Number(o.votes) || 0), 0),
    hasVoted: !!votedOptionId,
    votedOptionId,
  } : undefined;

  return {
    id: row.id, authorId: row.author_id, author, topic: row.topic_name || (INITIAL_TOPICS.find(t => t.id === row.topic_id)?.name || 'General'),
    topicId: row.topic_id, content: row.content || '', images: Array.isArray(row.images) ? row.images : [],
    likes: Number(row.likes_count) || 0, likedBy, comments: [], commentsCount: Number(row.comments_count) || 0,
    reposts: Number(row.reposts_count) || 0, repostedBy, shares: Number(row.shares_count) || 0, sharedBy: [],
    isLiked: likes.includes(author.id) || false, isReposted: reposts.includes(author.id) || false,
    isBookmarked: bookmarks.includes(author.id) || false, bookmarks: Number(row.bookmarks_count) || 0, bookmarkedBy,
    time: formatTimeAgo(row.created_at), timestamp: row.created_at, isAnonymous: !!row.is_anonymous,
    helpfulVotes: Number(row.helpful_votes) || 0, votedHelpfulBy,
    popularityScore: Number(row.popularity_score) || 0, viewCount: Number(row.view_count) || 0,
    engagementRate: 0, lastEngagedAt: row.updated_at || row.created_at, isTrending: !!row.is_trending,
    mood: row.mood, poll,
  };
};

const mapCommentRow = (row: any, author: CommunityUser, likes: string[], helpful: string[]): Comment => ({
  id: row.id, authorId: row.author_id, author, content: row.content || '',
  likes: Number(row.likes_count) || 0, likedBy: likes, isLiked: likes.includes(author.id),
  time: formatTimeAgo(row.created_at), timestamp: row.created_at, replies: [],
  helpfulVotes: Number(row.helpful_votes) || 0, votedHelpfulBy: helpful,
});

// ─── Context state + API ───────────────────────────────────────────
interface CommunityState {
  posts: Post[];
  topics: Topic[];
  notifications: Notification[];
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
  refreshTopics: () => Promise<Topic[]>;
}

const CommunityContext = createContext<CommunityContextType | null>(null);

// ─── Provider ──────────────────────────────────────────────────────
export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const sweetAlert = useSweetAlert();

  const [state, setState] = useState<CommunityState>({
    posts: [], topics: [], notifications: [], currentUser: null, isLoading: true,
    onlineUsers: [], userActivities: new Map(), blockedUsers: [], selectedTopics: [],
    popularPosts: [], trendingTopics: [], isInitialized: false,
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentUserIdRef.current = userProfile?.id ?? null;
  }, [userProfile?.id]);

  const authorsCache = useRef<Map<string, CommunityUser>>(new Map());
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  type RealtimeChannels = {
  posts?: any;
  comments?: any;
  likes?: any;
  follows?: any;
  notifications?: any;
  messages?: any;
  topics?: any;
};
const channelsRef = useRef<RealtimeChannels>({});
  const refreshFeedRef = useRef<(() => Promise<void>) | null>(null);

  // ───────────────────────────────────────────────────────────
  // AUTHOR LOADING — hydrate a CommunityUser from profiles table
  // ───────────────────────────────────────────────────────────
  const hydrateAuthor = useCallback(async (userId: string): Promise<CommunityUser> => {
    if (userId === 'littleloom_team') return LITTLELOOM_TEAM;
    const cached = authorsCache.current.get(userId);
    if (cached) return cached;
    if (userId === currentUserIdRef.current && stateRef.current.currentUser) {
      return stateRef.current.currentUser;
    }
    let author: CommunityUser = {
      id: userId, displayName: 'Parent', handle: '@parent', avatar: '👤', isVerified: false,
      onlineStatus: 'offline', lastActive: new Date().toISOString(),
      stats: { posts: 0, followers: 0, following: 0, helpful: 0, streakDays: 0, lastStreakDate: new Date().toISOString() },
      achievements: [], isFollowing: false,
    };
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, community_display_name, community_handle, community_username, community_avatar, avatar_url, community_bio, is_verified, community_selected_topics')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        const handleBase = (data.community_handle || '').toString().replace(/^@+/, '')
          || (data.community_username || '').toString()
          || (data.full_name || 'parent').toLowerCase().replace(/\s+/g, '_');
        author = {
          id: data.id,
          displayName: data.community_display_name || data.full_name || 'Parent',
          handle: `@${handleBase}`,
          avatar: data.community_avatar || data.avatar_url || '👤',
          isVerified: !!data.is_verified,
          bio: data.community_bio || '',
          country: 'Unknown',
          onlineStatus: 'offline',
          lastActive: new Date().toISOString(),
          stats: author.stats,
          achievements: [],
          selectedTopics: Array.isArray(data.community_selected_topics) ? data.community_selected_topics : [],
          isFollowing: false,
        };
      }
    } catch (e) { if (__DEV__) console.warn('[Community] hydrateAuthor:', e); }
    authorsCache.current.set(userId, author);
    return author;
  }, []);

  // ───────────────────────────────────────────────────────────
  // LOAD FEED — fetch all posts + comments + user's likes state
  // ───────────────────────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;

    try {
      // 1) Fetch recent posts
      const { data: postRows, error: postErr } = await supabase
        .from('community_posts')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(100);
      if (postErr) { if (__DEV__) console.warn('[Community] feed error:', postErr); return; }

      const rows = postRows || [];
      const postIds = rows.map((r: any) => r.id);

      // 2) Fetch comments for those posts
      const commentsByPost: Record<string, any[]> = {};
      if (postIds.length > 0) {
        const { data: commentRows } = await supabase
          .from('community_comments')
          .select('*')
          .in('post_id', postIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });

        const commentIds = (commentRows || []).map((c: any) => c.id);
        // 3) Fetch comment likes + helpful (scoped to current user's vote flags)
        const [commentLikes, commentHelpful] = await Promise.all([
          commentIds.length > 0 ? supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds) : Promise.resolve({ data: [] }),
          commentIds.length > 0 ? supabase.from('comment_helpful_votes').select('comment_id, user_id').in('comment_id', commentIds) : Promise.resolve({ data: [] }),
        ]);

        const likedComments = new Set<string>();
        const helpfulComments = new Set<string>();
        (commentLikes.data || []).forEach((l: any) => { if (l.user_id === uid) likedComments.add(l.comment_id); });
        (commentHelpful.data || []).forEach((h: any) => { if (h.user_id === uid) helpfulComments.add(h.comment_id); });

        for (const c of commentRows || []) {
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          const author = await hydrateAuthor(c.author_id);
          commentsByPost[c.post_id].push(mapCommentRow(c, author,
            likedComments.has(c.id) ? [uid] : [], helpfulComments.has(c.id) ? [uid] : []
          ));
        }
      }

      // 4) Fetch user's like/repost/bookmark/helpful for each post
      const [likesRes, repostsRes, bookmarksRes, helpfulRes, viewsRes] = await Promise.all([
        supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_reposts').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_bookmarks').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_helpful_votes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_views').select('post_id, user_id').in('post_id', postIds),
      ]);
      const likedPosts = new Set<string>((likesRes.data || []).filter((r: any) => r.user_id === uid).map((r: any) => r.post_id));
      const repostedPosts = new Set<string>((repostsRes.data || []).filter((r: any) => r.user_id === uid).map((r: any) => r.post_id));
      const bookmarkedPosts = new Set<string>((bookmarksRes.data || []).filter((r: any) => r.user_id === uid).map((r: any) => r.post_id));
      const helpfulPosts = new Set<string>((helpfulRes.data || []).filter((r: any) => r.user_id === uid).map((r: any) => r.post_id));

      // 5) Fetch user's poll votes
      const { data: pollVotes } = await supabase.from('poll_votes').select('post_id, option_id').eq('user_id', uid);
      const pollMap: Record<string, string> = {};
      (pollVotes || []).forEach((v: any) => { pollMap[v.post_id] = v.option_id; });

      // 6) Build Post objects
      const posts: Post[] = [];
      for (const row of rows) {
        const author = await hydrateAuthor(row.author_id);
        const post = mapPostRow(row, author,
          likedPosts.has(row.id) ? [uid] : [],
          bookmarkedPosts.has(row.id) ? [uid] : [],
          repostedPosts.has(row.id) ? [uid] : [],
          helpfulPosts.has(row.id) ? [uid] : [],
          pollMap[row.id],
        );
        post.isLiked = likedPosts.has(row.id);
        post.isReposted = repostedPosts.has(row.id);
        post.isBookmarked = bookmarkedPosts.has(row.id);
        post.comments = commentsByPost[row.id] || [];
        posts.push(post);
      }

      // 7) Update state
      setState(prev => ({
        ...prev,
        posts,
        isLoading: false,
        isInitialized: true,
      }));

      // 8) Recompute trending
      const topicScores = new Map<string, number>();
      posts.forEach(p => {
        const score = calculatePopularityScore(p);
        topicScores.set(p.topicId, (topicScores.get(p.topicId) || 0) + score);
      });
      const trendingTopics = Array.from(topicScores.entries()).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id]) => id);
      const popularPosts = posts.map(p => ({ postId: p.id, score: calculatePopularityScore(p), timestamp: p.timestamp }))
        .sort((a,b) => b.score - a.score).slice(0, 20);
      setState(prev => ({ ...prev, trendingTopics, popularPosts }));
    } catch (err) {
      if (__DEV__) console.error('[Community] loadFeed error:', err);
      setState(prev => ({ ...prev, isLoading: false, isInitialized: true }));
    }
  }, [hydrateAuthor]);

  const refreshFeedRefStable = useCallback(async () => { await loadFeed(); }, [loadFeed]);
  useEffect(() => { refreshFeedRef.current = refreshFeedRefStable; }, [refreshFeedRefStable]);

  // ───────────────────────────────────────────────────────────
  // LOAD TOPICS + NOTIFICATIONS + FOLLOWS + BLOCKS
  // ───────────────────────────────────────────────────────────
  const loadTopics = useCallback(async () => {
    try {
      const { data } = await supabase.from('community_topics').select('*');
      const dbTopics = (data || []) as any[];
      const topicMap = new Map(dbTopics.map(t => [t.id, t]));
      const topics = INITIAL_TOPICS.map(t => {
        const db = topicMap.get(t.id);
        return {
          ...t,
          posts: db?.posts || t.posts,
          members: db?.total_likes || 0 || t.members,
          category: db?.category || t.category,
          subcategory: db?.subcategory || t.subcategory,
        };
      });
      const uid = currentUserIdRef.current;
      let joinedIds = new Set<string>();
      if (uid) {
        const { data: joined } = await supabase.from('user_topics').select('topic_id').eq('user_id', uid);
        (joined || []).forEach((j: any) => joinedIds.add(j.topic_id));
      }
      const withJoined = topics.map(t => ({ ...t, isJoined: joinedIds.has(t.id), joinedBy: joinedIds.has(t.id) ? [uid!] : [] }));
      setState(prev => ({ ...prev, topics: withJoined, selectedTopics: Array.from(joinedIds) }));
    } catch (e) { if (__DEV__) console.warn('[Community] loadTopics:', e); }
  }, []);

  const loadNotifications = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    try {
      const { data } = await supabase
        .from('community_notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(100);
      const notifs: Notification[] = [];
      for (const row of data || []) {
        const actor = await hydrateAuthor(row.actor_id);
        notifs.push({
          id: row.id, type: row.type, userId: row.actor_id, user: actor,
          content: row.content, target: row.target, postId: row.post_id,
          time: formatTimeAgo(row.created_at), timestamp: row.created_at, read: !!row.is_read,
        });
      }
      setState(prev => ({ ...prev, notifications: notifs }));
    } catch (e) { if (__DEV__) console.warn('[Community] loadNotifications:', e); }
  }, [hydrateAuthor]);

  const loadFollowsAndBlocks = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    try {
      const [followers, following, blocks] = await Promise.all([
        supabase.from('user_follows').select('follower_id').eq('following_id', uid),
        supabase.from('user_follows').select('following_id').eq('follower_id', uid),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid),
      ]);
      const followerIds = (followers.data || []).map((f: any) => f.follower_id);
      const followingIds = (following.data || []).map((f: any) => f.following_id);
      const blockedIds = (blocks.data || []).map((b: any) => b.blocked_id);
      setState(prev => ({
        ...prev,
        blockedUsers: blockedIds,
        currentUser: prev.currentUser ? {
          ...prev.currentUser,
          followers: followerIds,
          following: followingIds,
          stats: { ...prev.currentUser.stats, followers: followerIds.length, following: followingIds.length },
        } : prev.currentUser,
      }));
    } catch (e) { if (__DEV__) console.warn('[Community] loadFollowsAndBlocks:', e); }
  }, []);

  // ───────────────────────────────────────────────────────────
  // BUILD CURRENT USER from profiles row
  // ───────────────────────────────────────────────────────────
  const syncWithAuthUser = useCallback(async (authProfile: any) => {
    try {
      let persistedIsVerified = false;
      let persistedCover: string | undefined;
      let persistedBio = authProfile.communityBio || '';

      const { data: verificationRow } = await supabase
        .from('profiles')
        .select('is_verified, community_cover, community_bio, community_selected_topics, community_stats')
        .eq('id', authProfile.id)
        .maybeSingle();
      if (verificationRow) {
        persistedIsVerified = verificationRow.is_verified === true;
        persistedCover = verificationRow.community_cover || undefined;
        if (verificationRow.community_bio) persistedBio = verificationRow.community_bio;
      }

      // Selected topics
      const { data: userTopics } = await supabase.from('user_topics').select('topic_id').eq('user_id', authProfile.id);
      const validTopics = validateTopicIds((userTopics || []).map((t: any) => t.topic_id));

      // Followers & following
      const [followersRes, followingRes, blocksRes] = await Promise.all([
        supabase.from('user_follows').select('follower_id').eq('following_id', authProfile.id),
        supabase.from('user_follows').select('following_id').eq('follower_id', authProfile.id),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', authProfile.id),
      ]);
      const followerIds = (followersRes.data || []).map((r: any) => r.follower_id);
      const followingIds = (followingRes.data || []).map((r: any) => r.following_id);
      const blockedIds = (blocksRes.data || []).map((r: any) => r.blocked_id);

      // Persistent stats from profiles.community_stats
      const statsFromDb = verificationRow?.community_stats || {};
      const stats = {
        posts: statsFromDb.posts || stateRef.current.posts.filter(p => p.authorId === authProfile.id).length,
        followers: followerIds.length,
        following: followingIds.length,
        helpful: statsFromDb.helpful || 0,
        streakDays: statsFromDb.streakDays || 0,
        lastStreakDate: statsFromDb.lastStreakDate || new Date().toISOString(),
      };

      const communityUser: CommunityUser = {
        id: authProfile.id,
        displayName: authProfile.communityDisplayName || authProfile.fullName || 'Parent',
        handle: authProfile.communityHandle || `@${(authProfile.fullName || 'parent').toLowerCase().replace(/\s+/g, '_')}`,
        avatar: authProfile.communityAvatar || authProfile.avatar || '👤',
        isVerified: persistedIsVerified,
        coverPhoto: persistedCover,
        bio: persistedBio,
        location: authProfile.location || '',
        country: authProfile.country || 'Unknown',
        onlineStatus: 'online',
        lastActive: new Date().toISOString(),
        stats,
        achievements: [],
        selectedTopics: validTopics,
        followers: followerIds,
        following: followingIds,
      };

      authorsCache.current.set(authProfile.id, communityUser);

      setState(prev => ({
        ...prev,
        currentUser: communityUser,
        selectedTopics: validTopics,
        blockedUsers: blockedIds,
      }));

      // Fire-and-forget presence + streak
      supabase.from('user_activity').upsert({
        user_id: authProfile.id, status: 'online', last_active: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).catch(() => {});
    } catch (err) {
      if (__DEV__) console.error('[Community] syncWithAuthUser:', err);
    }
  }, []);

  // ───────────────────────────────────────────────────────────
  // REALTIME SUBSCRIPTIONS — everyone sees everyone else's data
  // ───────────────────────────────────────────────────────────
  const subscribeRealtime = useCallback(() => {
    // Teardown
    Object.values(channelsRef.current).forEach((c: any) => { try { c?.unsubscribe?.(); } catch {} });
    channelsRef.current = {};

    // 1) POSTS — INSERT/UPDATE/DELETE
    const postsChannel = supabase.channel('community_posts_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, async (payload: any) => {
        if (payload.eventType === 'INSERT') {
          if (payload.new?.is_deleted) return;
          const author = await hydrateAuthor(payload.new.author_id);
          const uid = currentUserIdRef.current;
          const newPost = mapPostRow(payload.new, author, [], [], [], [], undefined);
          setState(prev => {
            if (prev.posts.some(p => p.id === payload.new.id)) return prev;
            return { ...prev, posts: [newPost, ...prev.posts] };
          });
        } else if (payload.eventType === 'UPDATE') {
          setState(prev => ({
            ...prev,
            posts: prev.posts.map(p => {
              if (p.id !== payload.new.id) return p;
              return {
                ...p,
                likes: Number(payload.new.likes_count) || p.likes,
                reposts: Number(payload.new.reposts_count) || p.reposts,
                commentsCount: Number(payload.new.comments_count) || p.commentsCount,
                bookmarks: Number(payload.new.bookmarks_count) || p.bookmarks,
                helpfulVotes: Number(payload.new.helpful_votes) || p.helpfulVotes,
                viewCount: Number(payload.new.view_count) || p.viewCount,
                content: payload.new.content ?? p.content,
                is_deleted: payload.new.is_deleted,
              };
            }).filter(p => !(p as any).is_deleted),
          }));
        } else if (payload.eventType === 'DELETE') {
          setState(prev => ({ ...prev, posts: prev.posts.filter(p => p.id !== payload.old.id) }));
        }
      }).subscribe();
    channelsRef.current.posts = postsChannel;

    // 2) LIKES / REPOSTS / BOOKMARKS / HELPFUL — reflect live count + my state
    const likesChannel = supabase.channel('post_interactions_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, (payload: any) => {
        const uid = currentUserIdRef.current;
        if (payload.eventType === 'INSERT') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.new.post_id
            ? { ...p, likes: p.likes + 1, isLiked: p.isLiked || payload.new.user_id === uid, likedBy: p.likedBy.includes(payload.new.user_id) ? p.likedBy : [...p.likedBy, payload.new.user_id] }
            : p) }));
        } else if (payload.eventType === 'DELETE') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.old.post_id
            ? { ...p, likes: Math.max(0, p.likes - 1), isLiked: payload.old.user_id === uid ? false : p.isLiked, likedBy: p.likedBy.filter(id => id !== payload.old.user_id) }
            : p) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reposts' }, (payload: any) => {
        const uid = currentUserIdRef.current;
        if (payload.eventType === 'INSERT') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.new.post_id
            ? { ...p, reposts: p.reposts + 1, isReposted: p.isReposted || payload.new.user_id === uid }
            : p) }));
        } else if (payload.eventType === 'DELETE') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.old.post_id
            ? { ...p, reposts: Math.max(0, p.reposts - 1), isReposted: payload.old.user_id === uid ? false : p.isReposted }
            : p) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_bookmarks' }, (payload: any) => {
        const uid = currentUserIdRef.current;
        if (payload.eventType === 'INSERT') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.new.post_id
            ? { ...p, bookmarks: p.bookmarks + 1, isBookmarked: p.isBookmarked || payload.new.user_id === uid }
            : p) }));
        } else if (payload.eventType === 'DELETE') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.old.post_id
            ? { ...p, bookmarks: Math.max(0, p.bookmarks - 1), isBookmarked: payload.old.user_id === uid ? false : p.isBookmarked }
            : p) }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_helpful_votes' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.new.post_id
            ? { ...p, helpfulVotes: p.helpfulVotes + 1, votedHelpfulBy: p.votedHelpfulBy.includes(payload.new.user_id) ? p.votedHelpfulBy : [...p.votedHelpfulBy, payload.new.user_id] }
            : p) }));
        } else if (payload.eventType === 'DELETE') {
          setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === payload.old.post_id
            ? { ...p, helpfulVotes: Math.max(0, p.helpfulVotes - 1), votedHelpfulBy: p.votedHelpfulBy.filter(id => id !== payload.old.user_id) }
            : p) }));
        }
      })
      .subscribe();
    channelsRef.current.likes = likesChannel;

    // 3) COMMENTS — full reload of that post's comment list
    const commentsChannel = supabase.channel('comments_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, async (payload: any) => {
        const postId = payload.new?.post_id || payload.old?.post_id;
        if (!postId) return;
        const { data: commentRows } = await supabase
          .from('community_comments').select('*').eq('post_id', postId).eq('is_deleted', false).order('created_at', { ascending: true });
        const uid = currentUserIdRef.current;
        const commentIds = (commentRows || []).map((c: any) => c.id);
        let likedSet = new Set<string>();
        let helpfulSet = new Set<string>();
        if (commentIds.length > 0 && uid) {
          const [l, h] = await Promise.all([
            supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds).eq('user_id', uid),
            supabase.from('comment_helpful_votes').select('comment_id').in('comment_id', commentIds).eq('user_id', uid),
          ]);
          (l.data || []).forEach((r: any) => likedSet.add(r.comment_id));
          (h.data || []).forEach((r: any) => helpfulSet.add(r.comment_id));
        }
        const mapped: Comment[] = [];
        for (const row of commentRows || []) {
          const author = await hydrateAuthor(row.author_id);
          mapped.push(mapCommentRow(row, author, likedSet.has(row.id) ? [uid!] : [], helpfulSet.has(row.id) ? [uid!] : []));
        }
        setState(prev => ({
          ...prev,
          posts: prev.posts.map(p => p.id === postId ? { ...p, comments: mapped, commentsCount: mapped.length } : p),
        }));
      })
      .subscribe();
    channelsRef.current.comments = commentsChannel;

    // 4) FOLLOWS — update isFollowing
    const followsChannel = supabase.channel('follows_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows' }, (payload: any) => {
        const uid = currentUserIdRef.current;
        if (!uid) return;
        const { follower_id, following_id } = payload.new || payload.old;
        if (follower_id === uid || following_id === uid) {
          // Full reload to keep counts accurate
          loadFollowsAndBlocks().then(() => {
            // Update follow flags on all post authors
            setState(prev => {
              const followingSet = new Set(prev.currentUser?.following || []);
              const followersSet = new Set(prev.currentUser?.followers || []);
              return {
                ...prev,
                posts: prev.posts.map(p => ({ ...p, author: { ...p.author, isFollowing: followingSet.has(p.authorId) } })),
              };
            });
          });
        }
      })
      .subscribe();
    channelsRef.current.follows = followsChannel;

    // 5) NOTIFICATIONS
    const notifChannel = supabase.channel('notifications_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_notifications' }, async (payload: any) => {
        const uid = currentUserIdRef.current;
        if (!uid) return;
        const row = payload.new || payload.old;
        if (row?.user_id !== uid) return;
        if (payload.eventType === 'INSERT') {
          const actor = await hydrateAuthor(payload.new.actor_id);
          const n: Notification = {
            id: payload.new.id, type: payload.new.type, userId: payload.new.actor_id, user: actor,
            content: payload.new.content, target: payload.new.target, postId: payload.new.post_id,
            time: 'Just now', timestamp: payload.new.created_at, read: false,
          };
          setState(prev => ({ ...prev, notifications: [n, ...prev.notifications.filter(x => x.id !== n.id)] }));
        } else if (payload.eventType === 'UPDATE') {
          setState(prev => ({ ...prev, notifications: prev.notifications.map(n => n.id === payload.new.id ? { ...n, read: !!payload.new.is_read } : n) }));
        }
      })
      .subscribe();
    channelsRef.current.notifications = notifChannel;

    // 6) TOPICS / USER_TOPICS
    const topicsChannel = supabase.channel('topics_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_topics' }, () => { loadTopics().catch(() => {}); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_topics' }, () => { loadTopics().catch(() => {}); })
      .subscribe();
    channelsRef.current.topics = topicsChannel;
  }, [hydrateAuthor, loadFollowsAndBlocks, loadTopics]);

  // ───────────────────────────────────────────────────────────
  // BOOTSTRAP
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !userProfile) {
      setState(prev => ({ ...prev, currentUser: null, isLoading: false }));
      return;
    }
    (async () => {
      await syncWithAuthUser(userProfile);
      await Promise.all([loadFeed(), loadTopics(), loadNotifications(), loadFollowsAndBlocks()]);
      subscribeRealtime();
    })();
  }, [isAuthenticated, userProfile?.id, authLoading]);

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(channelsRef.current).forEach((c: any) => { try { c?.unsubscribe?.(); } catch {} });
      channelsRef.current = {};
    };
  }, []);

  // ───────────────────────────────────────────────────────────
  // PUBLIC ACTIONS — all go through Supabase
  // ───────────────────────────────────────────────────────────
  const createPost = useCallback(async (content: string, topicId: string, images?: string[], isAnonymous?: boolean, mood?: PostMood, poll?: Poll) => {
    const uid = currentUserIdRef.current;
    if (!uid) { sweetAlert.alert('Sign In Required', 'Please sign in to create posts', 'warning'); return; }
    const topic = stateRef.current.topics.find(t => t.id === topicId);
    if (!topic) { sweetAlert.alert('Error', 'Topic not found', 'warning'); return; }

    // Upload images to storage
    const uploadedImages: string[] = [];
    for (const imgUri of images || []) {
      try {
        if (imgUri.startsWith('http')) { uploadedImages.push(imgUri); continue; }
        const fileData = await FileSystem.readAsStringAsync(imgUri, { encoding: FileSystem.EncodingType.Base64 });
        const path = `posts/${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('media').upload(path, decode(fileData), { contentType: 'image/jpeg', upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
          uploadedImages.push(urlData.publicUrl);
        }
      } catch (e) { if (__DEV__) console.warn('[Community] image upload failed:', e); }
    }

    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const insertRow = {
      id: postId,
      author_id: uid,
      topic_id: topicId,
      content,
      images: uploadedImages,
      is_anonymous: !!isAnonymous,
      mood: mood || null,
      poll_data: poll ? { question: poll.question, options: poll.options.map(o => ({ id: o.id, text: o.text, votes: 0 })) } : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      status: 'published',
    };

    const { error } = await supabase.from('community_posts').insert(insertRow);
    if (error) {
      console.error('[Community] createPost error:', error);
      sweetAlert.alert('Error', 'Failed to create post', 'warning');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Realtime will push the new post to us and others
  }, [sweetAlert]);

  const likePost = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) { sweetAlert.alert('Sign In Required', 'Please sign in to like posts', 'warning'); return; }
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: uid });
    if (error && !error.message.includes('duplicate')) { if (__DEV__) console.warn('[Community] likePost:', error); }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [sweetAlert]);

  const unlikePost = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
  }, []);

  const repostPost = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) { sweetAlert.alert('Sign In Required', 'Please sign in to repost', 'warning'); return; }
    await supabase.from('post_reposts').insert({ post_id: postId, user_id: uid });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [sweetAlert]);

  const unrepostPost = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('post_reposts').delete().eq('post_id', postId).eq('user_id', uid);
  }, []);

  const bookmarkPost = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) { sweetAlert.alert('Sign In Required', 'Please sign in to bookmark', 'warning'); return; }
    const { data: existing } = await supabase.from('post_bookmarks').select('post_id').eq('post_id', postId).eq('user_id', uid).maybeSingle();
    if (existing) await supabase.from('post_bookmarks').delete().eq('post_id', postId).eq('user_id', uid);
    else await supabase.from('post_bookmarks').insert({ post_id: postId, user_id: uid });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [sweetAlert]);

  const sharePost = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    // No dedicated shares table; increment shares_count via rpc if you have one, otherwise skip
    try { await supabase.rpc('increment_share_count', { p_post_id: postId }); } catch {}
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const { error } = await supabase.from('community_posts').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', postId).eq('author_id', uid);
    if (error) sweetAlert.alert('Error', 'Failed to delete post', 'warning');
  }, [sweetAlert]);

  const voteHelpful = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('post_helpful_votes').insert({ post_id: postId, user_id: uid }).then(() => {});
  }, []);

  const addComment = useCallback(async (postId: string, content: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) { sweetAlert.alert('Sign In Required', 'Please sign in to comment', 'warning'); return; }
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from('community_comments').insert({
      id: commentId, post_id: postId, author_id: uid, content, created_at: new Date().toISOString(), is_deleted: false,
    });
    if (error) sweetAlert.alert('Error', 'Failed to comment', 'warning');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [sweetAlert]);

  const likeComment = useCallback(async (postId: string, commentId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const { data: existing } = await supabase.from('comment_likes').select('comment_id').eq('comment_id', commentId).eq('user_id', uid).maybeSingle();
    if (existing) await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', uid);
    else await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: uid });
  }, []);

  const voteCommentHelpful = useCallback(async (postId: string, commentId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('comment_helpful_votes').insert({ comment_id: commentId, user_id: uid }).then(() => {});
  }, []);

  const replyToComment = useCallback(async (postId: string, commentId: string, content: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const replyId = `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from('community_comments').insert({
      id: replyId, post_id: postId, author_id: uid, parent_comment_id: commentId, content, created_at: new Date().toISOString(), is_deleted: false,
    });
  }, []);

  const joinTopic = useCallback(async (topicId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('user_topics').upsert({ user_id: uid, topic_id: topicId }, { onConflict: 'user_id, topic_id' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const leaveTopic = useCallback(async (topicId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('user_topics').delete().eq('user_id', uid).eq('topic_id', topicId);
  }, []);

  const followUser = useCallback(async (userId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid || userId === uid) return;
    await supabase.from('user_follows').insert({ follower_id: uid, following_id: userId }).catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const unfollowUser = useCallback(async (userId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('user_follows').delete().eq('follower_id', uid).eq('following_id', userId);
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const { data: existing } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', uid).eq('blocked_id', userId).maybeSingle();
    if (existing) await supabase.from('user_blocks').delete().eq('blocker_id', uid).eq('blocked_id', userId);
    else await supabase.from('user_blocks').insert({ blocker_id: uid, blocked_id: userId });
    setState(prev => ({ ...prev, blockedUsers: existing ? prev.blockedUsers.filter(id => id !== userId) : [...prev.blockedUsers, userId] }));
  }, []);

  const updateOnlineStatus = useCallback(async (status: OnlineStatus) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('user_activity').upsert({ user_id: uid, status, last_active: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).catch(() => {});
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    await supabase.from('community_notifications').update({ is_read: true }).eq('id', notificationId);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await supabase.from('community_notifications').update({ is_read: true }).eq('user_id', uid).eq('is_read', false);
  }, []);

  const updateSelectedTopics = useCallback(async (topics: string[]) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const valid = validateTopicIds(topics);
    // Wipe + reinsert
    await supabase.from('user_topics').delete().eq('user_id', uid);
    if (valid.length > 0) {
      await supabase.from('user_topics').insert(valid.map(t => ({ user_id: uid, topic_id: t })));
    }
    setState(prev => ({
      ...prev,
      selectedTopics: valid,
      currentUser: prev.currentUser ? { ...prev.currentUser, selectedTopics: valid } : prev.currentUser,
    }));
  }, []);

  const getSelectedTopics = useCallback(() => stateRef.current.selectedTopics, []);

  const checkOnboardingStatus = useCallback(async () => {
    const topics = stateRef.current.selectedTopics;
    return { completed: topics.length > 0, hasTopics: topics.length > 0 };
  }, []);

  const updateCommunityProfile = useCallback(async (updates: Partial<CommunityUser>) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.displayName !== undefined) dbUpdates.community_display_name = updates.displayName;
    if (updates.handle !== undefined) dbUpdates.community_handle = updates.handle;
    if (updates.bio !== undefined) dbUpdates.community_bio = updates.bio;
    if (updates.avatar !== undefined) dbUpdates.community_avatar = updates.avatar;
    if (updates.isVerified !== undefined) dbUpdates.is_verified = updates.isVerified;
    if (updates.coverPhoto !== undefined) dbUpdates.community_cover = updates.coverPhoto;
    await supabase.from('profiles').update(dbUpdates).eq('id', uid);
    setState(prev => ({ ...prev, currentUser: prev.currentUser ? { ...prev.currentUser, ...updates } : prev.currentUser }));
    // Propagate to all cached posts authored by me
    setState(prev => ({
      ...prev,
      posts: prev.posts.map(p => p.authorId === uid
        ? { ...p, author: { ...p.author, ...updates } }
        : p),
    }));
  }, []);

  const updateUserBio = updateCommunityProfile.bind(null, {} as any) as any;
  // (Wrappers)
  const realUpdateBio = useCallback((bio: string) => updateCommunityProfile({ bio }), [updateCommunityProfile]);
  const realUpdateLocation = useCallback((country: string) => updateCommunityProfile({ country }), [updateCommunityProfile]);
  const realUpdateDisplayName = useCallback((newName: string) => updateCommunityProfile({ displayName: newName }), [updateCommunityProfile]);
  const realUpdateAvatar = useCallback((avatarUri: string) => updateCommunityProfile({ avatar: avatarUri }), [updateCommunityProfile]);

  const updateUsername = useCallback(async (newUsername: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return { success: false, message: 'Not authenticated' };
    const trimmed = newUsername.trim().toLowerCase().replace(/^@/, '');
    if (trimmed.length < 3) return { success: false, message: 'Username must be at least 3 characters' };
    if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(trimmed)) return { success: false, message: 'Invalid format' };
    const { data: existing } = await supabase.from('profiles').select('id').eq('community_handle', `@${trimmed}`).maybeSingle();
    if (existing && existing.id !== uid) return { success: false, message: 'Username is already taken' };
    await supabase.from('profiles').update({ community_handle: `@${trimmed}`, community_username: trimmed }).eq('id', uid);
    await updateCommunityProfile({ handle: `@${trimmed}` });
    return { success: true, message: 'Username updated' };
  }, [updateCommunityProfile]);

  // ───────────────────────────────────────────────────────────
  // DMs (kept local for now — use FamilyChat for real-time chat)
  // ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (userId: string, content: string, type: MessageType = 'text', imageUrl?: string, fileMeta?: FileMetadata, replyToId?: string) => {
    // Community DMs use family_messages table — see FamilyChatContext for real-time path
    if (__DEV__) console.warn('[Community] sendMessage — use FamilyChatContext for real-time chat');
  }, []);
  const editMessage = useCallback(async () => {}, []);
  const resendMessage = useCallback(async () => {}, []);
  const deleteMessage = useCallback(async () => {}, []);
  const getChatMessages = useCallback(() => [] as Message[], []);
  const markChatRead = useCallback(async () => {}, []);
  const getOrCreateChat = useCallback(() => undefined as Chat | undefined, []);
  const setTypingStatus = useCallback(() => {}, []);
  const getTypingStatus = useCallback(() => false, []);
  const deleteChat = useCallback(async () => {}, []);

  // ───────────────────────────────────────────────────────────
  // GETTERS
  // ───────────────────────────────────────────────────────────
  const getPostById = useCallback((postId: string) => stateRef.current.posts.find(p => p.id === postId), []);
  const getTopicById = useCallback((topicId: string) => stateRef.current.topics.find(t => t.id === topicId), []);
  const getPostsByTopic = useCallback((topicId: string) => stateRef.current.posts.filter(p => p.topicId === topicId), []);
  const getUserById = useCallback((userId: string) => {
    if (userId === 'littleloom_team') return LITTLELOOM_TEAM;
    if (userId === stateRef.current.currentUser?.id) return stateRef.current.currentUser || undefined;
    const cached = authorsCache.current.get(userId);
    if (cached) return cached;
    return stateRef.current.posts.find(p => p.authorId === userId)?.author;
  }, []);
  const getUserPosts = useCallback((userId: string) => stateRef.current.posts.filter(p => p.authorId === userId), []);
  const isFollowing = useCallback((userId: string) => {
    return stateRef.current.currentUser?.following?.includes(userId) || false;
  }, []);
  const getUserStats = useCallback((userId: string) => getUserById(userId)?.stats, [getUserById]);
  const getUnreadCount = useCallback(() => stateRef.current.notifications.filter(n => !n.read).length, []);
  const isUserBlocked = useCallback((userId: string) => stateRef.current.blockedUsers.includes(userId), []);
  const getCurrentUserProfile = useCallback(() => stateRef.current.currentUser, []);
  const getUserProfile = getCurrentUserProfile;
  const getUserAchievements = useCallback((userId: string) => getUserById(userId)?.achievements || [], [getUserById]);
  const isAuthenticatedCheck = useCallback(() => !!stateRef.current.currentUser, []);

  const getFollowers = useCallback(async (userId: string): Promise<string[]> => {
    const { data } = await supabase.from('user_follows').select('follower_id').eq('following_id', userId);
    return (data || []).map((r: any) => r.follower_id);
  }, []);
  const getFollowing = useCallback(async (userId: string): Promise<string[]> => {
    const { data } = await supabase.from('user_follows').select('following_id').eq('follower_id', userId);
    return (data || []).map((r: any) => r.following_id);
  }, []);
  const getAllUsers = useCallback(() => {
    const map = new Map<string, CommunityUser>();
    map.set('littleloom_team', LITTLELOOM_TEAM);
    if (stateRef.current.currentUser) map.set(stateRef.current.currentUser.id, stateRef.current.currentUser);
    stateRef.current.posts.forEach(p => { if (!map.has(p.authorId)) map.set(p.authorId, p.author); });
    return Array.from(map.values());
  }, []);

  const syncUserProfileAcrossPosts = useCallback(async (userId: string, updates: Partial<CommunityUser>) => {
    setState(prev => ({
      ...prev,
      posts: prev.posts.map(p => p.authorId === userId ? { ...p, author: { ...p.author, ...updates } } : p),
      currentUser: prev.currentUser?.id === userId ? { ...prev.currentUser, ...updates } : prev.currentUser,
    }));
    authorsCache.current.set(userId, { ...(authorsCache.current.get(userId) || {} as CommunityUser), ...updates });
  }, []);

  const getFeedPosts = useCallback(() => {
    const cu = stateRef.current.currentUser;
    const all = [...stateRef.current.posts].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (!cu) return all;
    const topics = cu.selectedTopics || [];
    if (topics.length === 0) return all.filter(p => !stateRef.current.blockedUsers.includes(p.authorId));
    return all.filter(p => {
      if (p.authorId === cu.id) return true;
      if (stateRef.current.blockedUsers.includes(p.authorId)) return false;
      return topics.includes(p.topicId);
    });
  }, []);

  const getPopularPosts = useCallback((limit = 10) => {
    return [...stateRef.current.posts].sort((a,b) => b.popularityScore - a.popularityScore).slice(0, limit);
  }, []);

  const getTrendingTopics = useCallback(() => {
    return stateRef.current.topics.filter(t => t.trending).sort((a,b) => b.engagementScore - a.engagementScore);
  }, []);

  const incrementViewCount = useCallback(async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    try { await supabase.from('post_views').upsert({ post_id: postId, user_id: uid, viewed_at: new Date().toISOString() }, { onConflict: 'post_id, user_id' }); } catch {}
  }, []);

  const getPostRank = useCallback((postId: string) => {
    const sorted = [...stateRef.current.posts].sort((a,b) => b.popularityScore - a.popularityScore);
    return sorted.findIndex(p => p.id === postId) + 1;
  }, []);

  const votePoll = useCallback(async (postId: string, optionId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const { error } = await supabase.from('poll_votes').insert({ post_id: postId, user_id: uid, option_id: optionId });
    if (error && !error.message.includes('duplicate')) return;
    // Re-fetch post row to get updated poll_data (backend should update via trigger; else client recompute)
    const { data: row } = await supabase.from('community_posts').select('poll_data').eq('id', postId).maybeSingle();
    if (row?.poll_data) {
      const updatedPoll = {
        question: row.poll_data.question,
        options: (row.poll_data.options || []).map((o: any) => ({ ...o, votes: Number(o.votes) || 0 })),
        totalVotes: (row.poll_data.options || []).reduce((s: number, o: any) => s + (Number(o.votes) || 0), 0),
        hasVoted: true,
        votedOptionId: optionId,
      };
      setState(prev => ({ ...prev, posts: prev.posts.map(p => p.id === postId ? { ...p, poll: updatedPoll } : p) }));
    }
  }, []);

  const refreshFeed = useCallback(async () => { await loadFeed(); }, [loadFeed]);
  const loadMorePosts = useCallback(async () => { await loadFeed(); }, [loadFeed]);
  const refreshTopics = useCallback(async () => { await loadTopics(); return stateRef.current.topics; }, [loadTopics]);
  const checkAndAwardAchievements = useCallback(async () => [] as string[], []);

  // ───────────────────────────────────────────────────────────
  // MEMOIZED VALUE
  // ───────────────────────────────────────────────────────────
  const value = useMemo<CommunityContextType>(() => ({
    ...state,
    createPost, likePost, unlikePost, repostPost, unrepostPost, bookmarkPost, sharePost, deletePost, getPostById,
    voteHelpful, addComment, likeComment, voteCommentHelpful, replyToComment,
    joinTopic, leaveTopic, getTopicById, getPostsByTopic,
    followUser, unfollowUser, getUserById, getUserPosts, isFollowing,
    updateUserBio: realUpdateBio, updateUserLocation: realUpdateLocation, updateOnlineStatus, getUserStats,
    markNotificationRead, markAllNotificationsRead, getUnreadCount,
    sendMessage, editMessage, resendMessage, deleteMessage, getChatMessages, markChatRead,
    getOrCreateChat, setTypingStatus, getTypingStatus, deleteChat, blockUser, isUserBlocked,
    refreshFeed, loadMorePosts, updateCommunityProfile, getCurrentUserProfile,
    checkAndAwardAchievements, getUserAchievements, checkOnboardingStatus,
    updateSelectedTopics, getSelectedTopics, getFollowers, getFollowing, getAllUsers,
    syncUserProfileAcrossPosts, getFeedPosts, getPopularPosts, getTrendingTopics,
    incrementViewCount, getPostRank, updateUsername,
    updateDisplayName: realUpdateDisplayName, updateAvatar: realUpdateAvatar, updateBio: realUpdateBio,
    getUserProfile, isAuthenticated: isAuthenticatedCheck, votePoll, refreshTopics,
  }), [
    state, createPost, likePost, unlikePost, repostPost, unrepostPost, bookmarkPost, sharePost, deletePost, getPostById,
    voteHelpful, addComment, likeComment, voteCommentHelpful, replyToComment,
    joinTopic, leaveTopic, getTopicById, getPostsByTopic, followUser, unfollowUser, getUserById, getUserPosts, isFollowing,
    realUpdateBio, realUpdateLocation, updateOnlineStatus, getUserStats, markNotificationRead, markAllNotificationsRead, getUnreadCount,
    sendMessage, editMessage, resendMessage, deleteMessage, getChatMessages, markChatRead, getOrCreateChat,
    setTypingStatus, getTypingStatus, deleteChat, blockUser, isUserBlocked, refreshFeed, loadMorePosts,
    updateCommunityProfile, getCurrentUserProfile, checkAndAwardAchievements, getUserAchievements,
    checkOnboardingStatus, updateSelectedTopics, getSelectedTopics, getFollowers, getFollowing, getAllUsers,
    syncUserProfileAcrossPosts, getFeedPosts, getPopularPosts, getTrendingTopics, incrementViewCount,
    getPostRank, updateUsername, realUpdateDisplayName, realUpdateAvatar, isAuthenticatedCheck, votePoll, refreshTopics,
  ]);

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
};

export const useCommunity = () => {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity must be used within CommunityProvider');
  return ctx;
};

export default CommunityProvider;