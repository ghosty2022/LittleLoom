import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native'; 

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

export interface CommunityMemberProfile {
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
  userProfile: CommunityMemberProfile | null;
  onboardingComplete: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  isBiometricLoginEnabled: boolean;
  setupComplete: boolean;
  hasParent2: boolean | 'skipped';
  hasBaby: boolean | 'skipped';
}

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Parent2Optional: undefined;
  Parent2Setup: undefined;
  BabyOptional: undefined;
  CreateBabyProfile: { fromSetup?: boolean } | undefined;
  AddParent: { fromSetup?: boolean } | undefined;
  SwitchBaby: undefined;
  Main: undefined;

  UniversalTrackerHub: undefined;

  Timeline: { trackerId?: string; type?: string; babyId?: string; filter?: string } | undefined;

  PottyTracker: { babyId?: string; trackerId?: string } | undefined;
  FeedTracker: { babyId?: string; trackerId?: string } | undefined;
  SleepTracker: { babyId?: string; trackerId?: string } | undefined;

  CreateCustomTracker: undefined;

  Profile: { 
    tab?: 'parents' | 'guardians';
    selectedId?: string;
  } | undefined;
  Gallery: undefined;

  AddEntry: { 
    trackerId?: string;
    type?: string; 
    babyId?: string; 
    editMode?: boolean; 
    eventId?: string;
    viewMode?: boolean;
    presetData?: Record<string, unknown>;
  } | undefined;

  Achievements: { 
    babyId?: string;
    highlightAchievement?: string;
    openReminderSetup?: boolean;
  } | undefined;

  GrowthDashboard: { babyId?: string } | undefined;

  VaccinationSchedule: { 
    babyId?: string; 
    birthDate?: string;
  } | undefined;

  TrackerReminders: { 
    fromAchievement?: string;
    suggestedType?: 'potty' | 'feed' | 'sleep' | 'milestone' | 'streak';
    babyId?: string;
  } | undefined;

  FamilySharing: undefined;
  EditProfile: { 
    mode: 'baby' | 'parent';
    babyId?: string;
    parentId?: string;
  } | undefined;
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
  SoundMixer: undefined;
  Customize: undefined;
  BabySelector: undefined;
  SecurityLock: undefined;
  BiometricSetup: undefined;
  SecurityCenter: {
    mode?: 'setup' | 'change' | 'forgot' | 'reset';
    fromForgotPassword?: boolean;
  } | undefined;
  SafetyCorner: undefined;
  BackupRestore: undefined;
  HelpCenter: undefined;
  ContactSupport: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  About: undefined;
  LanguageSettings: undefined;
  UnitSettings: undefined;
};

export type CommunityStackParamList = {
  CommunitySplash: undefined;
  CommunityOnboarding: { onComplete?: () => void } | undefined;
  CommunityMain: undefined;
  Topic: { topicId: string };
  CreatePost: { topicId?: string };
  PostDetail: { postId: string };
  
  // RENAMED: Was UserProfile - now for viewing OTHER community members
  CommunityMemberProfile: { userId: string };
  
  ChatList: undefined;
  Chat: { userId: string };
  Notifications: undefined;
  
  // RENAMED: Was EditCommunityProfile - now for viewing/editing SELF profile
  CommunityProfile: { userId?: string } | undefined;
  
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
  
  // DEPRECATED ROUTES (keep for backward compatibility during migration)
  // UserProfile: { userId: string }; // Use CommunityMemberProfile instead
  // EditCommunityProfile: undefined; // Use CommunityProfile instead
};

export type MainTabParamList = {
  Home: undefined;
  Track: undefined;
  Grow: undefined;
  Connect: undefined;
  More: undefined;
  SafetyCorner: undefined;  
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

export type CommunityStackScreenProps<T extends keyof CommunityStackParamList> = 
  NativeStackScreenProps<CommunityStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type NavigationProp = RootStackScreenProps<keyof RootStackParamList>['navigation'];
export type CommunityNavigationProp = CommunityStackScreenProps<keyof CommunityStackParamList>['navigation'];

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

// NEW: Community Profile screen types
export type CommunityProfileNavigationProp = NativeStackScreenProps<CommunityStackParamList, 'CommunityProfile'>['navigation'];
export type CommunityProfileRouteProp = RouteProp<CommunityStackParamList, 'CommunityProfile'>;

// NEW: Community Member Profile screen types
export type CommunityMemberProfileNavigationProp = NativeStackScreenProps<CommunityStackParamList, 'CommunityMemberProfile'>['navigation'];
export type CommunityMemberProfileRouteProp = RouteProp<CommunityStackParamList, 'CommunityMemberProfile'>;

export type NavigationState = 
  | 'LOADING'
  | 'ONBOARDING'
  | 'LOGIN'
  | 'SETUP_PARENT2'
  | 'SETUP_BABY'
  | 'SECURITY_LOCK'
  | 'MAIN';
