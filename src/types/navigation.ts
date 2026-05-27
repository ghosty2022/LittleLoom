// src/types/navigation.ts

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native'; 

// Baby Profile Type
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
}

// Parent Profile Type
export interface ParentProfile {
  id: string;
  type: 'parent1' | 'parent2' | 'guardian';
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  relationship?: string;
  bio?: string;
}

// ============================================
// USER ROLE ENUM
// ============================================
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

// ============================================
// PERMISSION SYSTEM
// ============================================
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
    read: true,
    write: true,
    delete: true,
    manageFamily: true,
    manageSecurity: true,
    exportData: true,
  },
  [UserRole.PARENT_2]: {
    read: true,
    write: true,
    delete: true,
    manageFamily: true,
    manageSecurity: false,
    exportData: true,
  },
  [UserRole.GUARDIAN]: {
    read: true,
    write: true,
    delete: false,
    manageFamily: false,
    manageSecurity: false,
    exportData: false,
  },
  [UserRole.VIEWER]: {
    read: true,
    write: false,
    delete: false,
    manageFamily: false,
    manageSecurity: false,
    exportData: false,
  },
};

// ============================================
// AUTH CONTEXT TYPES (for reference)
// ============================================

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  role: 'parent1' | 'parent2' | 'guardian';
  createdAt: string;
  preferences?: {
    notifications?: boolean;
    darkMode?: boolean;
    language?: string;
  };
}

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  userToken: string | null;
  userProfile: UserProfile | null;
  onboardingComplete: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;        // For app unlock/security
  isBiometricLoginEnabled: boolean;    // For login screen (persistent)
  setupComplete: boolean;
  hasParent2: boolean | 'skipped';
  hasBaby: boolean | 'skipped';
}

// ============================================
// NAVIGATION TYPES - RENAMED FOR BETTER UX
// ============================================

export type RootStackParamList = {
  // Splash & Onboarding
  Splash: undefined;
  Onboarding: undefined;

  // Auth Flow
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;

  // Setup Flow (Optional Steps)
  Parent2Optional: undefined;
  Parent2Setup: undefined;
  BabyOptional: undefined;

  // Main Features
  CreateBabyProfile: { fromSetup?: boolean } | undefined;
  AddParent: { fromSetup?: boolean } | undefined;
  SwitchBaby: undefined;

  // Main App
  Main: undefined;

  // Universal Activity Tracker
  UniversalTracker: { type?: string; babyId?: string } | undefined;

  // Legacy Individual Trackers
  PottyTracker: { babyId?: string } | undefined;
  FeedTracker: { babyId?: string } | undefined;
  SleepTracker: { babyId?: string } | undefined;

  // Profile Management - ENHANCED
  Profile: { 
    tab?: 'parents' | 'guardians';
    selectedId?: string;
  } | undefined;

  // Gallery
  Gallery: undefined;

  // Modals
  AddLog: { 
    type?: string; 
    babyId?: string; 
    editMode?: boolean; 
    eventId?: string;
  } | undefined;
  
  // ENHANCED: Achievements with baby context
  Achievements: { 
    babyId?: string;
    highlightAchievement?: string;
    openReminderSetup?: boolean;
  } | undefined;
  
  GrowthChart: { babyId?: string } | undefined;
  
  // ENHANCED: Reminders with achievement integration
  Reminders: { 
    fromAchievement?: string;
    suggestedType?: 'potty' | 'feed' | 'sleep' | 'milestone' | 'streak';
    babyId?: string;
  } | undefined;

  // FAMILY SHARING - ENHANCED
  FamilySharing: undefined;
  EditProfile: { 
    mode: 'baby' | 'parent';
    babyId?: string;
    parentId?: string;
  } | undefined;

  // Family Chat - Enhanced with proper params
  FamilyChatList: undefined;
  FamilyChat: { 
    chatId?: string; 
    memberId?: string;
    memberName?: string;  // NEW: Pass member name directly
    memberAvatar?: string;  // NEW: Pass avatar directly
    memberRole?: string;   // NEW: Pass role directly
    familyCode?: string;   // NEW: Pass family code
  } | undefined;

  EditGuardian: {
    guardianId: string;
    mode?: 'guardian' | 'parent2' | 'viewer';  // NEW: Explicit mode
    fromChat?: boolean;  // NEW: Track if coming from chat
  } | undefined;

  SoundMixer: undefined;
  Customize: undefined;
  BabySelector: undefined;

  // Security
  SecurityLock: undefined;
  BiometricSetup: undefined;
  ChangePin: undefined;

  // Safety Corner
  SafetyCorner: undefined;
};

export type CommunityStackParamList = {
  CommunityMain: undefined;
  Topic: { topicId: string };
  CreatePost: { topicId?: string };
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  ChatList: undefined;
  Chat: { userId: string };
  Notifications: undefined;
  EditCommunityProfile: { userId?: string };
  TopicMembers: { topicId: string };
  Followers: { userId: string };
  Following: { userId: string };
  SearchUsers: { 
    initialQuery?: string;  // FIX: Removed space in "initialQ uery"
    filter?: 'all' | 'followers' | 'following' | 'topic';
    topicId?: string;
  };
  BlockedUsers: undefined;
  Report: { 
    type: 'user' | 'post' | 'comment' | 'topic';
    targetId: string;
    targetUserId: string;
  };
};

// ============================================
// RENAMED MAIN TAB PARAM LIST - UX OPTIMIZED
// ============================================
export type MainTabParamList = {
  Home: undefined;
  Track: undefined;
  Grow: undefined;
  Connect: undefined;
  More: undefined;
};

// ============================================
// SCREEN PROPS TYPES
// ============================================

export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

export type CommunityStackScreenProps<T extends keyof CommunityStackParamList> = 
  NativeStackScreenProps<CommunityStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

// Navigation helper types
export type NavigationProp = RootStackScreenProps<keyof RootStackParamList>['navigation'];
export type CommunityNavigationProp = CommunityStackScreenProps<keyof CommunityStackParamList>['navigation'];

// Activity Tracker specific navigation helpers
export type UniversalTrackerNavigationProp = NativeStackScreenProps<RootStackParamList, 'UniversalTracker'>['navigation'];
export type UniversalTrackerRouteProp = RouteProp<RootStackParamList, 'UniversalTracker'>;

// AddLog specific navigation helpers
export type AddLogNavigationProp = NativeStackScreenProps<RootStackParamList, 'AddLog'>['navigation'];
export type AddLogRouteProp = RouteProp<RootStackParamList, 'AddLog'>;

// Family Chat specific navigation helpers
export type FamilyChatNavigationProp = NativeStackScreenProps<RootStackParamList, 'FamilyChat'>['navigation'];
export type FamilyChatRouteProp = RouteProp<RootStackParamList, 'FamilyChat'>;

// Edit Guardian specific navigation helpers
export type EditGuardianNavigationProp = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>['navigation'];
export type EditGuardianRouteProp = RouteProp<RootStackParamList, 'EditGuardian'>;

// Achievements specific navigation helpers
export type AchievementsNavigationProp = NativeStackScreenProps<RootStackParamList, 'Achievements'>['navigation'];
export type AchievementsRouteProp = RouteProp<RootStackParamList, 'Achievements'>;

// Reminders specific navigation helpers
export type RemindersNavigationProp = NativeStackScreenProps<RootStackParamList, 'Reminders'>['navigation'];
export type RemindersRouteProp = RouteProp<RootStackParamList, 'Reminders'>;

// ============================================
// NAVIGATION STATE MACHINE TYPE
// ============================================

export type NavigationState = 
  | 'LOADING'
  | 'ONBOARDING'
  | 'LOGIN'
  | 'SETUP_PARENT2'
  | 'SETUP_BABY'
  | 'SECURITY_LOCK'
  | 'MAIN';
