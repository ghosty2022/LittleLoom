import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Root Stack Navigator
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CreateBabyProfile: undefined;
  Main: undefined;
  AddLog: { type?: string } | undefined;
  Achievements: undefined;
  GrowthChart: undefined;
  Reminders: undefined;
  FamilySharing: undefined;
  EditProfile: undefined;
  SoundMixer: undefined;
};

// Community Stack Navigator
export type CommunityStackParamList = {
  CommunityMain: undefined;
  Topic: { topicId: string };
  CreatePost: { topicId?: string };
  PostDetail: { postId: string };
  Chat: { userId: string };
  UserProfile: { userId: string };
  Notifications: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Community: undefined;
  Timeline: undefined;
  Customize: undefined;
  Settings: undefined;
};

// Screen Props Types
export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

export type CommunityStackScreenProps<T extends keyof CommunityStackParamList> = 
  NativeStackScreenProps<CommunityStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  BottomTabScreenProps<MainTabParamList, T>;

// Baby Types
export interface Baby {
  id: string;
  name: string;
  age: string;
  skinIndex: number;
  streak: number;
  nextMilestone: string;
  milestoneProgress: number;
  avatar?: string;
  birthDate?: Date;
  weight?: number;
  height?: number;
}

export interface TimelineEvent {
  id: string;
  icon: string;
  title: string;
  time: string;
  type: 'potty' | 'feed' | 'sleep' | 'diaper' | 'milestone' | 'growth';
  timestamp: number;
  notes?: string;
  imageUrl?: string;
}

export interface SoundItem {
  id: string;
  name: string;
  emoji: string;
  uri: string;
  color: [string, string];
  isPlaying?: boolean;
  position?: number;
  duration?: number;
  volume?: number;
}

export interface QuickAction {
  id: string;
  label: string;
  emoji: string;
  color: [string, string];
  description?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  progress: number;
  total: number;
  isUnlocked: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  time: Date;
  type: 'feeding' | 'sleep' | 'potty' | 'medication' | 'custom';
  isEnabled: boolean;
  repeat?: 'daily' | 'weekly' | 'none';
}