// Baby Types - NO NAVIGATION IMPORTS HERE
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