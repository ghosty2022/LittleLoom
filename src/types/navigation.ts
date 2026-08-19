// src/types/navigation.ts (Updated with all new screens)
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

// ─── Base Types ─────────────────────────────────────────────────────────

export interface BabyProfile {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: 'boy' | 'girl' | 'other';
  photo?: string;
  weight?: number;
  height?: number;
  allergies?: string[];
  notes?: string;
  avatar?: string;
  age?: string;
  userId?: string;
  familyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParentProfile {
  id: string;
  type: 'parent1' | 'parent2' | 'guardian';
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  relationship?: string;
  bio?: string;
  userId?: string;
  familyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum UserRole {
  PARENT_1 = 'parent1',
  PARENT_2 = 'parent2',
  GUARDIAN = 'guardian',
  VIEWER = 'viewer',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PARENT_1]: 'Primary Parent',
  [UserRole.PARENT_2]: 'Co-Parent',
  [UserRole.GUARDIAN]: 'Guardian',
  [UserRole.VIEWER]: 'Viewer',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.PARENT_1]: '#667eea',
  [UserRole.PARENT_2]: '#fa709a',
  [UserRole.GUARDIAN]: '#11998e',
  [UserRole.VIEWER]: '#64748b',
};

export interface Permission {
  read: boolean;
  write: boolean;
  delete: boolean;
  manageFamily: boolean;
  manageSecurity: boolean;
  exportData: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  [UserRole.PARENT_1]: {
    read: true, write: true, delete: true, manageFamily: true, manageSecurity: true, exportData: true,
  },
  [UserRole.PARENT_2]: {
    read: true, write: true, delete: true, manageFamily: true, manageSecurity: false, exportData: true,
  },
  [UserRole.GUARDIAN]: {
    read: true, write: true, delete: false, manageFamily: false, manageSecurity: false, exportData: false,
  },
  [UserRole.VIEWER]: {
    read: true, write: false, delete: false, manageFamily: false, manageSecurity: false, exportData: false,
  },
};

// ─── Supabase & Community Types ──────────────────────────────────────

export interface CommunityMemberProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  role: 'parent1' | 'parent2' | 'guardian';
  createdAt: string;
  updatedAt?: string;
  bio?: string;
  location?: string;
  isVerified?: boolean;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  preferences?: {
    notifications?: boolean;
    darkMode?: boolean;
    language?: string;
    theme?: string;
    fontSize?: string;
    hapticFeedback?: boolean;
    reduceMotion?: boolean;
    privacy?: 'public' | 'family' | 'private';
    unitSystem?: 'metric' | 'imperial';
  };
}

export interface FamilyMember {
  id: string;
  babyId: string;
  userId: string;
  role: 'parent1' | 'parent2' | 'guardian' | 'viewer';
  fullName: string;
  email: string;
  avatar?: string;
  phone?: string;
  relationship?: string;
  permissions: Permission;
  joinedAt: string;
  isActive: boolean;
}

export interface SyncStatus {
  lastSync: string | null;
  pendingUploads: number;
  pendingDownloads: number;
  isSyncing: boolean;
  error?: string;
}

export interface OfflineQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: string;
  retries: number;
}

// ─── Auth Types ──────────────────────────────────────────────────────

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  userToken: string | null;
  userProfile: CommunityMemberProfile | null;
  onboardingComplete: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  isBiometricLoginEnabled: boolean;
  setupComplete: boolean;
  hasParent2: boolean | 'skipped';
  hasBaby: boolean | 'skipped';
  sessionExpiry?: string;
  refreshToken?: string;
}

// ─── Root Stack Navigation ──────────────────────────────────────────

export type RootStackParamList = {
  // ── Auth Flow ──
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;

  // ── Setup Flow ──
  CoParentInviteScreen: { fromSetup?: boolean } | undefined;
  BabyOptional: undefined;
  CreateBabyProfile: { fromSetup?: boolean } | undefined;

  // ── Main Tab ──
  Main: undefined;

  // ── Baby Management ──
  SwitchBaby: { returnTo?: keyof RootStackParamList; returnLabel?: string } | undefined;
  BabyProfileScreen: { babyId: string } | undefined;
  EditProfile: {
    mode: 'baby' | 'parent';
    babyId?: string;
    parentId?: string;
  } | undefined;

  // ── Tracking ──
  UniversalTrackerHub: undefined;
  AllTrackers: undefined;
  Timeline: { trackerId?: string; type?: string; babyId?: string; filter?: string } | undefined;
  AddEntry: {
    trackerId?: string;
    type?: string;
    babyId?: string;
    editMode?: boolean;
    eventId?: string;
    viewMode?: boolean;
    presetData?: Record<string, unknown>;
  } | undefined;
  EntryDetail: { entryId: string; trackerId?: string };
  CreateCustomTracker: undefined;

  // ── Trackers ──
  PottyTracker: { babyId?: string; trackerId?: string } | undefined;
  FeedTracker: { babyId?: string; trackerId?: string } | undefined;
  SleepTracker: { babyId?: string; trackerId?: string } | undefined;

  // ── Growth & Health ──
  GrowthDashboard: { babyId?: string } | undefined;
  VaccinationSchedule: {
    babyId?: string;
    birthDate?: string;
  } | undefined;
  PediatricianPDFExport: { babyId?: string } | undefined;

  // ── Achievements ──
  Achievements: {
    babyId?: string;
    highlightAchievement?: string;
    openReminderSetup?: boolean;
  } | undefined;

  // ── Insights ──
  Insights: { babyId?: string; timeframe?: 'week' | 'month' | 'year' } | undefined;

  // ── Reminders ──
  TrackerReminders: {
    fromAchievement?: string;
    suggestedType?: 'potty' | 'feed' | 'sleep' | 'milestone' | 'streak';
    babyId?: string;
  } | undefined;

  // ── Family ──
  FamilySharing: { openInvite?: boolean } | undefined;
  FamilySettings: undefined;
  FamilyDashboard: { babyId?: string } | undefined;
  FamilyChatList: undefined;
  FamilyChat: {
    chatId?: string;
    memberId?: string;
    memberName?: string;
    memberAvatar?: string;
    memberRole?: string;
    familyCode?: string;
  } | undefined;
  EditGuardian: {
    guardianId: string;
    mode?: 'guardian' | 'parent2' | 'viewer';
    fromChat?: boolean;
  } | undefined;

  // ── Gallery & Media ──
  Gallery: { babyId?: string } | undefined;
  SoundMixer: undefined;

  // ── Security ──
  SecurityLock: { redirectTo?: string } | undefined;
  BiometricSetup: { mode?: 'setup' | 'change' } | undefined;
  SecurityCenter: {
    mode?: 'setup' | 'change' | 'forgot' | 'reset';
    fromForgotPassword?: boolean;
  } | undefined;

  // ── Safety ──
  SafetyCorner: undefined;

  // ── Settings ──
  Customize: undefined;
  LanguageSettings: undefined;
  UnitSettings: undefined;
  BackupRestore: undefined;

  // ── Support ──
  HelpCenter: undefined;
  ContactSupport: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  About: undefined;

  // ── Profile ──
  Profile: {
    userId?: string;
    tab?: 'parents' | 'guardians';
    selectedId?: string;
  } | undefined;

  // ── More / Settings ──
  More: undefined;
  SyncSettings: undefined;

  // ── Community (Supabase-powered) ──
  CommunityMain: undefined;
  CommunityProfile: { userId?: string } | undefined;
  CommunityMemberProfile: { userId: string };
  CommunityOnboarding: { onComplete?: () => void; editing?: boolean } | undefined;
  CommunityVerification: undefined;
  Topic: { topicId: string };
  TopicMembers: { topicId: string };
  CreatePost: { topicId?: string; initialContent?: string };
  PostDetail: { postId: string };
  ChatList: undefined;
  Chat: { userId: string };
  Notifications: undefined;
  Followers: { userId: string };
  Following: { userId: string };
  SearchUsers: {
    initialQuery?: string;
    filter?: 'all' | 'followers' | 'following' | 'topic';
    topicId?: string;
  };
  BlockedUsers: undefined;
  Report: {
    type: 'user' | 'post' | 'comment' | 'topic';
    targetId: string;
    targetUserId?: string;
    postId?: string;
  };
};

// ─── Community Stack ─────────────────────────────────────────────────

export type CommunityStackParamList = {
  CommunitySplash: undefined;
  CommunityOnboarding: { onComplete?: () => void; editing?: boolean } | undefined;
  CommunityMain: undefined;
  Topic: { topicId: string };
  CreatePost: { topicId?: string; initialContent?: string };
  PostDetail: { postId: string };
  CommunityMemberProfile: { userId: string };
  ChatList: undefined;
  Chat: { userId: string };
  Notifications: undefined;
  CommunityProfile: { userId?: string } | undefined;
  CommunityVerification: undefined;
  TopicMembers: { topicId: string };
  Followers: { userId: string };
  Following: { userId: string };
  SearchUsers: {
    initialQuery?: string;
    filter?: 'all' | 'followers' | 'following' | 'topic';
    topicId?: string;
  };
  BlockedUsers: undefined;
  Report: {
    type: 'user' | 'post' | 'comment' | 'topic';
    targetId: string;
    targetUserId?: string;
    postId?: string;
  };
};

// ─── Main Tab ────────────────────────────────────────────────────────

export type MainTabParamList = {
  Home: undefined;
  Track: undefined;
  Timeline: undefined;
  Grow: undefined;
  Connect: undefined;
};

// ─── Screen Props ──────────────────────────────────────────────────

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type CommunityStackScreenProps<T extends keyof CommunityStackParamList> =
  NativeStackScreenProps<CommunityStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// ─── Navigation Props ──────────────────────────────────────────────

export type NavigationProp = RootStackScreenProps<keyof RootStackParamList>['navigation'];
export type CommunityNavigationProp = CommunityStackScreenProps<keyof CommunityStackParamList>['navigation'];

// ─── Specific Screen Props ─────────────────────────────────────────

export type TimelineNavigationProp = NativeStackScreenProps<RootStackParamList, 'Timeline'>['navigation'];
export type TimelineRouteProp = RouteProp<RootStackParamList, 'Timeline'>;

export type UniversalTrackerHubNavigationProp = NativeStackScreenProps<RootStackParamList, 'UniversalTrackerHub'>['navigation'];

export type AddEntryNavigationProp = NativeStackScreenProps<RootStackParamList, 'AddEntry'>['navigation'];
export type AddEntryRouteProp = RouteProp<RootStackParamList, 'AddEntry'>;

export type FamilyChatNavigationProp = NativeStackScreenProps<RootStackParamList, 'FamilyChat'>['navigation'];
export type FamilyChatRouteProp = RouteProp<RootStackParamList, 'FamilyChat'>;

export type EditGuardianNavigationProp = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>['navigation'];
export type EditGuardianRouteProp = RouteProp<RootStackParamList, 'EditGuardian'>;

export type AchievementsNavigationProp = NativeStackScreenProps<RootStackParamList, 'Achievements'>['navigation'];
export type AchievementsRouteProp = RouteProp<RootStackParamList, 'Achievements'>;

export type TrackerRemindersNavigationProp = NativeStackScreenProps<RootStackParamList, 'TrackerReminders'>['navigation'];
export type TrackerRemindersRouteProp = RouteProp<RootStackParamList, 'TrackerReminders'>;

export type CreateCustomTrackerNavigationProp = NativeStackScreenProps<RootStackParamList, 'CreateCustomTracker'>['navigation'];

export type InsightsNavigationProp = NativeStackScreenProps<RootStackParamList, 'Insights'>['navigation'];
export type InsightsRouteProp = RouteProp<RootStackParamList, 'Insights'>;

export type EntryDetailNavigationProp = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>['navigation'];
export type EntryDetailRouteProp = RouteProp<RootStackParamList, 'EntryDetail'>;

export type CommunityProfileNavigationProp = NativeStackScreenProps<CommunityStackParamList, 'CommunityProfile'>['navigation'];
export type CommunityProfileRouteProp = RouteProp<CommunityStackParamList, 'CommunityProfile'>;

export type CommunityMemberProfileNavigationProp = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>['navigation'];
export type CommunityMemberProfileRouteProp = RouteProp<CommunityStackParamList, 'CommunityMemberProfile'>;

// ─── Navigation State ──────────────────────────────────────────────

export type NavigationState =
  | 'LOADING'
  | 'ONBOARDING'
  | 'LOGIN'
  | 'SETUP_PARENT2'
  | 'SETUP_BABY'
  | 'SECURITY_LOCK'
  | 'MAIN';

// ─── Params for deep linking ──────────────────────────────────────

export interface DeepLinkParams {
  screen: keyof RootStackParamList;
  params?: Record<string, any>;
}

// ─── Navigation Theme ──────────────────────────────────────────────

export interface NavigationTheme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
  };
}

// ─── Route Types for Navigation Helpers ──────────────────────────

export type MainTabRoute = keyof MainTabParamList;
export type RootStackRoute = keyof RootStackParamList;
export type CommunityStackRoute = keyof CommunityStackParamList;

// ─── Navigation Utilities ──────────────────────────────────────────

export const isRootStackScreen = (name: string): name is RootStackRoute => {
  const rootScreens: RootStackRoute[] = [
    'Splash', 'Onboarding', 'Login', 'SignUp', 'ForgotPassword',
    'CoParentInviteScreen', 'BabyOptional', 'CreateBabyProfile',
    'SwitchBaby', 'Main', 'UniversalTrackerHub', 'AllTrackers',
    'Timeline', 'AddEntry', 'EntryDetail', 'CreateCustomTracker',
    'PottyTracker', 'FeedTracker', 'SleepTracker', 'GrowthDashboard',
    'VaccinationSchedule', 'PediatricianPDFExport', 'Achievements',
    'Insights', 'TrackerReminders', 'FamilySharing', 'FamilySettings',
    'FamilyDashboard', 'FamilyChatList', 'FamilyChat', 'EditGuardian',
    'Gallery', 'SoundMixer', 'SecurityLock', 'BiometricSetup',
    'SecurityCenter', 'SafetyCorner', 'Customize', 'LanguageSettings',
    'UnitSettings', 'BackupRestore', 'HelpCenter', 'ContactSupport',
    'PrivacyPolicy', 'TermsOfService', 'About', 'Profile', 'More',
    'SyncSettings', 'CommunityMain', 'CommunityProfile',
    'CommunityMemberProfile', 'CommunityOnboarding', 'CommunityVerification',
    'Topic', 'TopicMembers', 'CreatePost', 'PostDetail', 'ChatList',
    'Chat', 'Notifications', 'Followers', 'Following', 'SearchUsers',
    'BlockedUsers', 'Report', 'BabyProfileScreen', 'EditProfile',
  ];
  return rootScreens.includes(name as RootStackRoute);
};

export const isMainTabScreen = (name: string): name is MainTabRoute => {
  const tabScreens: MainTabRoute[] = ['Home', 'Track', 'Timeline', 'Grow', 'Connect'];
  return tabScreens.includes(name as MainTabRoute);
};