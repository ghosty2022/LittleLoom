import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Baby, TimelineEvent, SoundItem } from '../types';

interface BabyState {
  // Baby Profile
  baby: Baby;
  updateBaby: (updates: Partial<Baby>) => void;
  
  // Timeline
  timeline: TimelineEvent[];
  addEvent: (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => void;
  removeEvent: (id: string) => void;
  clearTimeline: () => void;
  
  // Sounds
  sounds: SoundItem[];
  updateSoundStatus: (id: string, status: Partial<SoundItem>) => void;
  stopAllSounds: () => void;
  
  // UI State
  nextPottyTime: number;
  updateNextPottyTime: (minutes: number) => void;
  
  // Hydration
  isHydrated: boolean;
  setHydrated: (value: boolean) => void;
  
  // Actions
  resetStreak: () => void;
  incrementStreak: () => void;
  resetStore: () => void;
}

const INITIAL_BABY: Baby = {
  id: '1',
  name: 'Emma',
  age: '18 months',
  skinIndex: 2,
  streak: 12,
  nextMilestone: 'First Steps',
  milestoneProgress: 75,
};

const INITIAL_TIMELINE: TimelineEvent[] = [
  { id: '1', icon: '🎉', title: 'Potty Success!', time: 'Just now', type: 'potty', timestamp: Date.now() },
  { id: '2', icon: '🍼', title: 'Bottle Feed', time: '2 hours ago', type: 'feed', timestamp: Date.now() - 7200000 },
  { id: '3', icon: '😴', title: 'Nap Time', time: '4 hours ago', type: 'sleep', timestamp: Date.now() - 14400000 },
];

const INITIAL_SOUNDS: SoundItem[] = [
  { id: '1', name: 'Lullaby', emoji: '🌙', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', color: ['#667eea', '#764ba2'], volume: 1 },
  { id: '2', name: 'Gentle Rain', emoji: '🌧️', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', color: ['#11998e', '#38ef7d'], volume: 1 },
  { id: '3', name: 'Baby Giggles', emoji: '😆', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', color: ['#fc5c7d', '#6a82fb'], volume: 1 },
  { id: '4', name: 'Sweet Coos', emoji: '🍼', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', color: ['#fa709a', '#fee140'], volume: 1 },
];

const initialState = {
  baby: INITIAL_BABY,
  timeline: INITIAL_TIMELINE,
  sounds: INITIAL_SOUNDS,
  nextPottyTime: 45,
  isHydrated: false,
};

export const useBabyStore = create<BabyState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      updateBaby: (updates) => set((state) => ({
        baby: { ...state.baby, ...updates }
      })),
      
      addEvent: (event) => set((state) => ({
        timeline: [
          { ...event, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() },
          ...state.timeline
        ].slice(0, 100) // Keep only last 100 events
      })),
      
      removeEvent: (id) => set((state) => ({
        timeline: state.timeline.filter(e => e.id !== id)
      })),
      
      clearTimeline: () => set({ timeline: [] }),
      
      updateSoundStatus: (id, status) => set((state) => ({
        sounds: state.sounds.map(s => 
          s.id === id ? { ...s, ...status } : s
        )
      })),
      
      stopAllSounds: () => set((state) => ({
        sounds: state.sounds.map(s => ({ ...s, isPlaying: false, position: 0 }))
      })),
      
      updateNextPottyTime: (minutes) => set({ nextPottyTime: minutes }),
      
      setHydrated: (value) => set({ isHydrated: value }),
      
      resetStreak: () => set((state) => ({
        baby: { ...state.baby, streak: 0 }
      })),
      
      incrementStreak: () => set((state) => ({
        baby: { ...state.baby, streak: state.baby.streak + 1 }
      })),
      
      resetStore: () => set(initialState),
    }),
    {
      name: 'baby-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        baby: state.baby, 
        timeline: state.timeline,
        sounds: state.sounds.map(({ isPlaying, ...rest }) => rest), // Don't persist playing state
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);