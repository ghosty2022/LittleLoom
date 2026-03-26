// src/context/BabyContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import * as Haptics from 'expo-haptics';

// ==================== STORAGE KEYS ====================
const STORAGE_KEYS = {
  BABIES: '@littleloom_babies',
  CURRENT_BABY: '@littleloom_current_baby',
  HAS_SKIPPED_BABY: '@littleloom_has_skipped_baby',
  GROWTH_DATA: (babyId: string) => `@littleloom_growth_${babyId}`,
  MILESTONES: (babyId: string) => `@littleloom_milestones_${babyId}`,
  SLEEP_LOGS: (babyId: string) => `@littleloom_sleep_${babyId}`,
  FEEDING_LOGS: (babyId: string) => `@littleloom_feeding_${babyId}`,
  POTTY_LOGS: (babyId: string) => `@littleloom_potty_${babyId}`,
  MEDICATION_LOGS: (babyId: string) => `@littleloom_medication_${babyId}`,
  ACTIVITIES: (babyId: string) => `@littleloom_activities_${babyId}`,
};

// ==================== TYPES ====================
export type Gender = 'boy' | 'girl' | 'other';
export type ActivityType = 'potty' | 'feed' | 'sleep' | 'growth' | 'medication' | 'milestone' | 'diaper' | 'note';

export interface BabyProfile {
  id: string;
  name: string;
  birthDate: string;
  age: string;
  gender: Gender;
  skinTone: number;
  avatar: string;
  parent1Id: string;
  parent2Id?: string;
  guardianIds?: string[];
  weight?: string;
  height?: string;
  bloodType?: string;
  allergies?: string[];
  medicalNotes?: string;
  streak: number;
  milestones: number;
  photos: number;
  createdAt: string;
  lastUpdated?: string;
}

export interface GrowthMeasurement {
  id: string;
  babyId: string;
  type: 'height' | 'weight' | 'head' | 'temperature';
  value: number;
  unit: 'kg' | 'lb' | 'oz' | 'cm' | 'in';
  date: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  babyId: string;
  title: string;
  description: string;
  category: 'physical' | 'cognitive' | 'social' | 'language' | 'emotional';
  achievedAt: string;
  imageUrl?: string;
  notes?: string;
}

export interface SleepLog {
  id: string;
  babyId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  location: 'crib' | 'stroller' | 'car' | 'carrier' | 'bed' | 'other';
  notes?: string;
  createdAt: string;
}

export interface FeedingLog {
  id: string;
  babyId: string;
  type: 'breast' | 'bottle' | 'solid' | 'snack' | 'water';
  startTime: string;
  duration?: number;
  amount?: number;
  unit?: 'ml' | 'oz';
  food?: string;
  notes?: string;
  createdAt: string;
}

export interface PottyLog {
  id: string;
  babyId: string;
  type: 'pee' | 'poop' | 'both' | 'accident' | 'attempt';
  location: 'potty' | 'toilet' | 'floor' | 'diaper';
  successful: boolean;
  timestamp: string;
  notes?: string;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  babyId: string;
  medicationName: string;
  dosage: string;
  reason?: string;
  givenBy: string;
  timestamp: string;
  notes?: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  babyId: string;
  type: ActivityType;
  timestamp: number;
  title: string;
  details?: string;
  icon?: string;
  loggedBy: string;
  loggedByName: string;
  pottyType?: PottyLog['type'];
  feedType?: FeedingLog['type'];
  sleepType?: SleepLog['type'];
  amount?: string;
  duration?: string;
  measurementType?: GrowthMeasurement['type'];
  value?: string;
  unit?: string;
  milestoneTitle?: string;
  medicationName?: string;
  notes?: string;
  photo?: string;
}

interface BabyState {
  isLoading: boolean;
  babies: BabyProfile[];
  currentBabyId: string | null;
  currentBaby: BabyProfile | null;
  hasSkippedBaby: boolean;
  growthData: GrowthMeasurement[];
  milestones: Milestone[];
  sleepLogs: SleepLog[];
  feedingLogs: FeedingLog[];
  pottyLogs: PottyLog[];
  medicationLogs: MedicationLog[];
  activities: ActivityEntry[];
}

interface BabyContextType extends BabyState {
  loadBabies: () => Promise<void>;
  createBaby: (data: Omit<BabyProfile, 'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated'>) => Promise<boolean>;
  updateBaby: (id: string, updates: Partial<BabyProfile>) => Promise<void>;
  deleteBaby: (id: string) => Promise<boolean>;
  switchBaby: (id: string) => Promise<void>;
  refreshCurrentBaby: () => Promise<void>;
  skipBaby: () => Promise<void>;
  clearSkipBaby: () => Promise<void>;
  calculateAge: (birthDate: string) => string;
  getBabyAge: (babyId?: string) => string;
  addGrowthMeasurement: (measurement: Omit<GrowthMeasurement, 'id' | 'createdAt'>) => Promise<boolean>;
  getGrowthData: (type?: GrowthMeasurement['type']) => GrowthMeasurement[];
  getLatestMeasurements: () => Record<string, GrowthMeasurement | null>;
  deleteGrowthMeasurement: (id: string) => Promise<boolean>;
  addMilestone: (milestone: Omit<Milestone, 'id'>) => Promise<boolean>;
  getMilestones: (category?: Milestone['category']) => Milestone[];
  deleteMilestone: (id: string) => Promise<boolean>;
  addSleepLog: (log: Omit<SleepLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getSleepLogs: (days?: number) => SleepLog[];
  endSleepSession: (logId: string, endTime: string) => Promise<boolean>;
  getTodaySleepCount: () => number;
  addFeedingLog: (log: Omit<FeedingLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getFeedingLogs: (days?: number) => FeedingLog[];
  getTodayFeedCount: () => number;
  addPottyLog: (log: Omit<PottyLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getPottyLogs: (days?: number) => PottyLog[];
  getPottyStreak: () => number;
  getTodayPottyCount: () => number;
  getPottySuccessRate: () => number;
  addMedicationLog: (log: Omit<MedicationLog, 'id' | 'createdAt'>) => Promise<boolean>;
  getMedicationLogs: (days?: number) => MedicationLog[];
  addActivity: (entry: Omit<ActivityEntry, 'id'>) => Promise<void>;
  getRecentActivities: (limit?: number) => ActivityEntry[];
  getActivitiesByType: (type: ActivityType) => ActivityEntry[];
  deleteActivity: (id: string) => Promise<void>;
  getBabyStats: () => { streak: number; milestones: number; photos: number; entries: number };
  updateBabyStats: (updates: Partial<BabyProfile>) => Promise<void>;
}

// ==================== CONTEXT ====================
const BabyContext = createContext<BabyContextType | null>(null);

// ==================== PROVIDER ====================
export const BabyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, userProfile } = useAuth();
  
  const [state, setState] = useState<BabyState>({
    isLoading: false,
    babies: [],
    currentBabyId: null,
    currentBaby: null,
    hasSkippedBaby: false,
    growthData: [],
    milestones: [],
    sleepLogs: [],
    feedingLogs: [],
    pottyLogs: [],
    medicationLogs: [],
    activities: [],
  });

  const ageIntervalRef = useRef<NodeJS.Timeout>();

  // ==================== AGE CALCULATION ====================
  const calculateAge = useCallback((birthDate: string): string => {
    const birth = new Date(birthDate);
    const now = new Date();
    const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30.44);
    const years = Math.floor(months / 12);

    if (days < 1) return 'Newborn';
    if (days < 14) return `${days} days`;
    if (months < 1) return `${Math.floor(days / 7)} weeks`;
    if (months < 12) return `${months} months`;
    if (years < 2) return `${years}y ${months % 12}m`;
    return `${years} years`;
  }, []);

  const getBabyAge = useCallback((babyId?: string): string => {
    const id = babyId || state.currentBabyId;
    if (!id) return '';
    const baby = state.babies.find(b => b.id === id);
    return baby?.age || '';
  }, [state.babies, state.currentBabyId]);

  // ==================== LOAD ALL BABY DATA ====================
  const loadAllBabyData = useCallback(async (babyId: string) => {
    try {
      const [
        growthStr,
        milestonesStr,
        sleepStr,
        feedingStr,
        pottyStr,
        medicationStr,
        activitiesStr,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GROWTH_DATA(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.MILESTONES(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.SLEEP_LOGS(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.FEEDING_LOGS(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.POTTY_LOGS(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.MEDICATION_LOGS(babyId)),
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVITIES(babyId)),
      ]);

      setState(prev => ({
        ...prev,
        growthData: growthStr ? JSON.parse(growthStr) : [],
        milestones: milestonesStr ? JSON.parse(milestonesStr) : [],
        sleepLogs: sleepStr ? JSON.parse(sleepStr) : [],
        feedingLogs: feedingStr ? JSON.parse(feedingStr) : [],
        pottyLogs: pottyStr ? JSON.parse(pottyStr) : [],
        medicationLogs: medicationStr ? JSON.parse(medicationStr) : [],
        activities: activitiesStr ? JSON.parse(activitiesStr) : [],
      }));
    } catch (error) {
      console.error('Error loading baby data:', error);
    }
  }, []);

  // ==================== LOAD BABIES ====================
  const loadBabies = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const [babiesStr, currentId, hasSkipped] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.BABIES),
        AsyncStorage.getItem(STORAGE_KEYS.CURRENT_BABY),
        AsyncStorage.getItem(STORAGE_KEYS.HAS_SKIPPED_BABY),
      ]);

      let babies: BabyProfile[] = [];
      
      if (babiesStr) {
        babies = JSON.parse(babiesStr);
        babies = babies.map(b => ({
          ...b,
          age: calculateAge(b.birthDate),
        }));
      }

      const effectiveCurrentId = currentId || babies[0]?.id || null;
      
      if (effectiveCurrentId && !currentId && babies.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, effectiveCurrentId);
      }

      const currentBaby = babies.find(b => b.id === effectiveCurrentId) || babies[0] || null;

      setState(prev => ({
        ...prev,
        isLoading: false,
        babies,
        currentBabyId: effectiveCurrentId,
        currentBaby,
        hasSkippedBaby: hasSkipped === 'true',
      }));

      if (effectiveCurrentId) {
        await loadAllBabyData(effectiveCurrentId);
      }
    } catch (error) {
      console.error('Error loading babies:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isAuthenticated, calculateAge, loadAllBabyData]);

  // Load babies when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadBabies();
    }
  }, [isAuthenticated, loadBabies]);

  // Update ages periodically
  useEffect(() => {
    if (state.babies.length > 0) {
      const updateAges = () => {
        setState(prev => ({
          ...prev,
          babies: prev.babies.map(b => ({
            ...b,
            age: calculateAge(b.birthDate),
          })),
        }));
      };
      
      updateAges();
      ageIntervalRef.current = setInterval(updateAges, 60000);
    }
    return () => clearInterval(ageIntervalRef.current);
  }, [state.babies.length, calculateAge]);

  // ==================== SKIP BABY ====================
  const skipBaby = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAS_SKIPPED_BABY, 'true');
      setState(prev => ({ ...prev, hasSkippedBaby: true }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error skipping baby:', error);
    }
  }, []);

  const clearSkipBaby = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.HAS_SKIPPED_BABY);
      setState(prev => ({ ...prev, hasSkippedBaby: false }));
    } catch (error) {
      console.error('Error clearing skip baby:', error);
    }
  }, []);

  // ==================== BABY CRUD ====================
  const createBaby = useCallback(async (
    data: Omit<BabyProfile, 'id' | 'streak' | 'milestones' | 'photos' | 'createdAt' | 'age' | 'lastUpdated'>
  ): Promise<boolean> => {
    if (!userProfile) {
      Alert.alert('Error', 'You must be logged in to create a baby profile');
      return false;
    }
    
    try {
      const now = new Date().toISOString();
      const newBaby: BabyProfile = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        parent1Id: userProfile.id,
        streak: 0,
        milestones: 0,
        photos: 0,
        createdAt: now,
        lastUpdated: now,
        age: calculateAge(data.birthDate),
      };

      const updatedBabies = [...state.babies, newBaby];
      await AsyncStorage.setItem(STORAGE_KEYS.BABIES, JSON.stringify(updatedBabies));

      const newCurrentId = state.babies.length === 0 ? newBaby.id : state.currentBabyId;
      if (newCurrentId && newCurrentId !== state.currentBabyId) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, newCurrentId);
      }

      await clearSkipBaby();

      setState(prev => ({
        ...prev,
        babies: updatedBabies,
        currentBabyId: newCurrentId || newBaby.id,
        currentBaby: newCurrentId === newBaby.id ? newBaby : prev.currentBaby,
      }));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to create baby profile');
      return false;
    }
  }, [userProfile, state.babies, state.currentBabyId, calculateAge, clearSkipBaby]);

  const updateBaby = useCallback(async (id: string, updates: Partial<BabyProfile>) => {
    try {
      const updated = state.babies.map(b => {
        if (b.id === id) {
          const updatedBaby = { 
            ...b, 
            ...updates,
            lastUpdated: new Date().toISOString(),
          };
          if (updates.birthDate) {
            updatedBaby.age = calculateAge(updates.birthDate);
          }
          return updatedBaby;
        }
        return b;
      });

      await AsyncStorage.setItem(STORAGE_KEYS.BABIES, JSON.stringify(updated));
      
      setState(prev => ({
        ...prev,
        babies: updated,
        currentBaby: prev.currentBaby?.id === id 
          ? updated.find(b => b.id === id) || null 
          : prev.currentBaby,
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update baby profile');
    }
  }, [state.babies, calculateAge]);

  const deleteBaby = useCallback(async (id: string) => {
    try {
      const filtered = state.babies.filter(b => b.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.BABIES, JSON.stringify(filtered));

      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.GROWTH_DATA(id)),
        AsyncStorage.removeItem(STORAGE_KEYS.MILESTONES(id)),
        AsyncStorage.removeItem(STORAGE_KEYS.SLEEP_LOGS(id)),
        AsyncStorage.removeItem(STORAGE_KEYS.FEEDING_LOGS(id)),
        AsyncStorage.removeItem(STORAGE_KEYS.POTTY_LOGS(id)),
        AsyncStorage.removeItem(STORAGE_KEYS.MEDICATION_LOGS(id)),
        AsyncStorage.removeItem(STORAGE_KEYS.ACTIVITIES(id)),
      ]);

      let newCurrentId = state.currentBabyId;
      if (state.currentBabyId === id) {
        newCurrentId = filtered[0]?.id || null;
        if (newCurrentId) {
          await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, newCurrentId);
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_BABY);
        }
      }

      const newCurrentBaby = filtered.find(b => b.id === newCurrentId) || null;

      setState(prev => ({
        ...prev,
        babies: filtered,
        currentBabyId: newCurrentId,
        currentBaby: newCurrentBaby,
        growthData: newCurrentId ? prev.growthData : [],
        milestones: newCurrentId ? prev.milestones : [],
        sleepLogs: newCurrentId ? prev.sleepLogs : [],
        feedingLogs: newCurrentId ? prev.feedingLogs : [],
        pottyLogs: newCurrentId ? prev.pottyLogs : [],
        medicationLogs: newCurrentId ? prev.medicationLogs : [],
        activities: newCurrentId ? prev.activities : [],
      }));
      
      if (newCurrentId) {
        await loadAllBabyData(newCurrentId);
      }
      
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to delete baby profile');
      return false;
    }
  }, [state.babies, state.currentBabyId, loadAllBabyData]);

  const switchBaby = useCallback(async (id: string) => {
    const baby = state.babies.find(b => b.id === id);
    if (!baby) return;
    
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_BABY, id);
    await loadAllBabyData(id);
    
    setState(prev => ({ 
      ...prev, 
      currentBabyId: id, 
      currentBaby: baby,
    }));
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [state.babies, loadAllBabyData]);

  const refreshCurrentBaby = useCallback(async () => {
    await loadBabies();
  }, [loadBabies]);

  // ==================== GROWTH TRACKING ====================
  const addGrowthMeasurement = useCallback(async (
    measurement: Omit<GrowthMeasurement, 'id' | 'createdAt'>
  ): Promise<boolean> => {
    try {
      const newMeasurement: GrowthMeasurement = {
        ...measurement,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
      };

      const key = STORAGE_KEYS.GROWTH_DATA(measurement.babyId);
      const existing = await AsyncStorage.getItem(key);
      const measurements: GrowthMeasurement[] = existing ? JSON.parse(existing) : [];
      measurements.push(newMeasurement);
      
      await AsyncStorage.setItem(key, JSON.stringify(measurements));

      if (measurement.babyId === state.currentBabyId) {
        setState(prev => ({ ...prev, growthData: measurements }));
      }

      const baby = state.babies.find(b => b.id === measurement.babyId);
      if (baby) {
        const updates: Partial<BabyProfile> = {};
        if (measurement.type === 'height') updates.height = `${measurement.value} ${measurement.unit}`;
        if (measurement.type === 'weight') updates.weight = `${measurement.value} ${measurement.unit}`;
        await updateBaby(measurement.babyId, updates);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to save measurement');
      return false;
    }
  }, [state.currentBabyId, state.babies, updateBaby]);

  const getGrowthData = useCallback((type?: GrowthMeasurement['type']) => {
    let data = state.growthData;
    if (type) {
      data = data.filter(m => m.type === type);
    }
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [state.growthData]);

  const getLatestMeasurements = useCallback(() => {
    const types = ['height', 'weight', 'head', 'temperature'] as const;
    const latest: Record<string, GrowthMeasurement | null> = {};
    
    types.forEach(type => {
      const typeData = state.growthData
        .filter(m => m.type === type)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      latest[type] = typeData[0] || null;
    });
    
    return latest;
  }, [state.growthData]);

  const deleteGrowthMeasurement = useCallback(async (id: string) => {
    try {
      if (!state.currentBabyId) return false;
      
      const key = STORAGE_KEYS.GROWTH_DATA(state.currentBabyId);
      const filtered = state.growthData.filter(m => m.id !== id);
      
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
      setState(prev => ({ ...prev, growthData: filtered }));
      
      return true;
    } catch (error) {
      return false;
    }
  }, [state.currentBabyId, state.growthData]);

  // ==================== MILESTONES ====================
  const addMilestone = useCallback(async (milestone: Omit<Milestone, 'id'>): Promise<boolean> => {
    try {
      const newMilestone: Milestone = {
        ...milestone,
        id: Math.random().toString(36).substr(2, 9),
      };

      const key = STORAGE_KEYS.MILESTONES(milestone.babyId);
      const existing = await AsyncStorage.getItem(key);
      const milestones: Milestone[] = existing ? JSON.parse(existing) : [];
      milestones.push(newMilestone);
      
      await AsyncStorage.setItem(key, JSON.stringify(milestones));

      if (milestone.babyId === state.currentBabyId) {
        setState(prev => ({ ...prev, milestones }));
      }

      const baby = state.babies.find(b => b.id === milestone.babyId);
      if (baby) {
        await updateBaby(milestone.babyId, { milestones: baby.milestones + 1 });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to save milestone');
      return false;
    }
  }, [state.currentBabyId, state.babies, updateBaby]);

  const getMilestones = useCallback((category?: Milestone['category']) => {
    let data = state.milestones;
    if (category) {
      data = data.filter(m => m.category === category);
    }
    return data.sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }, [state.milestones]);

  const deleteMilestone = useCallback(async (id: string) => {
    try {
      if (!state.currentBabyId) return false;
      
      const key = STORAGE_KEYS.MILESTONES(state.currentBabyId);
      const filtered = state.milestones.filter(m => m.id !== id);
      
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
      setState(prev => ({ ...prev, milestones: filtered }));
      
      return true;
    } catch (error) {
      return false;
    }
  }, [state.currentBabyId, state.milestones]);

  // ==================== SLEEP TRACKING ====================
  const addSleepLog = useCallback(async (log: Omit<SleepLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newLog: SleepLog = {
        ...log,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
      };

      const key = STORAGE_KEYS.SLEEP_LOGS(log.babyId);
      const existing = await AsyncStorage.getItem(key);
      const logs: SleepLog[] = existing ? JSON.parse(existing) : [];
      logs.push(newLog);
      
      await AsyncStorage.setItem(key, JSON.stringify(logs));

      if (log.babyId === state.currentBabyId) {
        setState(prev => ({ ...prev, sleepLogs: logs }));
      }

      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to save sleep log');
      return false;
    }
  }, [state.currentBabyId]);

  const getSleepLogs = useCallback((days: number = 7) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return state.sleepLogs
      .filter(log => new Date(log.startTime) >= cutoff)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [state.sleepLogs]);

  const endSleepSession = useCallback(async (logId: string, endTime: string) => {
    try {
      if (!state.currentBabyId) return false;
      
      const key = STORAGE_KEYS.SLEEP_LOGS(state.currentBabyId);
      const updated = state.sleepLogs.map(log => {
        if (log.id === logId) {
          const start = new Date(log.startTime);
          const end = new Date(endTime);
          const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
          return { ...log, endTime, duration };
        }
        return log;
      });
      
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      setState(prev => ({ ...prev, sleepLogs: updated }));
      
      return true;
    } catch (error) {
      return false;
    }
  }, [state.currentBabyId, state.sleepLogs]);

  const getTodaySleepCount = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return state.sleepLogs.filter(log => {
      const logDate = new Date(log.startTime);
      return logDate >= today;
    }).length;
  }, [state.sleepLogs]);

  // ==================== FEEDING TRACKING ====================
  const addFeedingLog = useCallback(async (log: Omit<FeedingLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newLog: FeedingLog = {
        ...log,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
      };

      const key = STORAGE_KEYS.FEEDING_LOGS(log.babyId);
      const existing = await AsyncStorage.getItem(key);
      const logs: FeedingLog[] = existing ? JSON.parse(existing) : [];
      logs.push(newLog);
      
      await AsyncStorage.setItem(key, JSON.stringify(logs));

      if (log.babyId === state.currentBabyId) {
        setState(prev => ({ ...prev, feedingLogs: logs }));
      }

      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to save feeding log');
      return false;
    }
  }, [state.currentBabyId]);

  const getFeedingLogs = useCallback((days: number = 7) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return state.feedingLogs
      .filter(log => new Date(log.startTime) >= cutoff)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [state.feedingLogs]);

  const getTodayFeedCount = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return state.feedingLogs.filter(log => {
      const logDate = new Date(log.startTime);
      return logDate >= today;
    }).length;
  }, [state.feedingLogs]);

  // ==================== POTTY TRACKING ====================
  const addPottyLog = useCallback(async (log: Omit<PottyLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newLog: PottyLog = {
        ...log,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
      };

      const key = STORAGE_KEYS.POTTY_LOGS(log.babyId);
      const existing = await AsyncStorage.getItem(key);
      const logs: PottyLog[] = existing ? JSON.parse(existing) : [];
      logs.push(newLog);
      
      await AsyncStorage.setItem(key, JSON.stringify(logs));

      if (log.babyId === state.currentBabyId) {
        setState(prev => ({ ...prev, pottyLogs: logs }));
      }

      if (log.successful) {
        const streak = calculatePottyStreak([...logs]);
        await updateBaby(log.babyId, { streak });
      }

      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to save potty log');
      return false;
    }
  }, [state.currentBabyId, updateBaby]);

  const getPottyLogs = useCallback((days: number = 7) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return state.pottyLogs
      .filter(log => new Date(log.timestamp) >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.pottyLogs]);

  const calculatePottyStreak = (logs: PottyLog[]): number => {
    if (logs.length === 0) return 0;
    
    const successfulDays = new Set<string>();
    logs.forEach(log => {
      if (log.successful) {
        const date = new Date(log.timestamp).toISOString().split('T')[0];
        successfulDays.add(date);
      }
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateKey = checkDate.toISOString().split('T')[0];

      if (successfulDays.has(dateKey)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  };

  const getPottyStreak = useCallback(() => {
    return calculatePottyStreak(state.pottyLogs);
  }, [state.pottyLogs]);

  const getTodayPottyCount = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return state.pottyLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= today;
    }).length;
  }, [state.pottyLogs]);

  const getPottySuccessRate = useCallback(() => {
    if (state.pottyLogs.length === 0) return 0;
    const successful = state.pottyLogs.filter(log => log.successful).length;
    return Math.round((successful / state.pottyLogs.length) * 100);
  }, [state.pottyLogs]);

  // ==================== MEDICATION TRACKING ====================
  const addMedicationLog = useCallback(async (log: Omit<MedicationLog, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newLog: MedicationLog = {
        ...log,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
      };

      const key = STORAGE_KEYS.MEDICATION_LOGS(log.babyId);
      const existing = await AsyncStorage.getItem(key);
      const logs: MedicationLog[] = existing ? JSON.parse(existing) : [];
      logs.push(newLog);
      
      await AsyncStorage.setItem(key, JSON.stringify(logs));

      if (log.babyId === state.currentBabyId) {
        setState(prev => ({ ...prev, medicationLogs: logs }));
      }

      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to save medication log');
      return false;
    }
  }, [state.currentBabyId]);

  const getMedicationLogs = useCallback((days: number = 30) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return state.medicationLogs
      .filter(log => new Date(log.timestamp) >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.medicationLogs]);

  // ==================== ACTIVITY TIMELINE ====================
  const addActivity = useCallback(async (entry: Omit<ActivityEntry, 'id'>) => {
    try {
      const newEntry: ActivityEntry = {
        ...entry,
        id: Math.random().toString(36).substr(2, 9),
      };

      const key = STORAGE_KEYS.ACTIVITIES(entry.babyId);
      const existing = await AsyncStorage.getItem(key);
      const activities: ActivityEntry[] = existing ? JSON.parse(existing) : [];
      activities.unshift(newEntry);
      
      await AsyncStorage.setItem(key, JSON.stringify(activities));

      if (entry.babyId === state.currentBabyId) {
        setState(prev => ({ ...prev, activities }));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to add activity:', error);
    }
  }, [state.currentBabyId]);

  const getRecentActivities = useCallback((limit: number = 10) => {
    return state.activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }, [state.activities]);

  const getActivitiesByType = useCallback((type: ActivityType) => {
    return state.activities
      .filter(a => a.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [state.activities]);

  const deleteActivity = useCallback(async (id: string) => {
    try {
      if (!state.currentBabyId) return;
      
      const key = STORAGE_KEYS.ACTIVITIES(state.currentBabyId);
      const filtered = state.activities.filter(a => a.id !== id);
      
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
      setState(prev => ({ ...prev, activities: filtered }));
    } catch (error) {
      console.error('Failed to delete activity:', error);
    }
  }, [state.currentBabyId, state.activities]);

  // ==================== STATS ====================
  const getBabyStats = useCallback(() => {
    return {
      streak: state.currentBaby?.streak || 0,
      milestones: state.currentBaby?.milestones || 0,
      photos: state.currentBaby?.photos || 0,
      entries: state.activities.length,
    };
  }, [state.currentBaby, state.activities]);

  const updateBabyStats = useCallback(async (updates: Partial<BabyProfile>) => {
    if (!state.currentBaby) return;
    await updateBaby(state.currentBaby.id, updates);
  }, [state.currentBaby, updateBaby]);

  // ==================== CONTEXT VALUE ====================
  const value: BabyContextType = {
    ...state,
    loadBabies,
    createBaby,
    updateBaby,
    deleteBaby,
    switchBaby,
    refreshCurrentBaby,
    skipBaby,
    clearSkipBaby,
    calculateAge,
    getBabyAge,
    addGrowthMeasurement,
    getGrowthData,
    getLatestMeasurements,
    deleteGrowthMeasurement,
    addMilestone,
    getMilestones,
    deleteMilestone,
    addSleepLog,
    getSleepLogs,
    endSleepSession,
    getTodaySleepCount,
    addFeedingLog,
    getFeedingLogs,
    getTodayFeedCount,
    addPottyLog,
    getPottyLogs,
    getPottyStreak,
    getTodayPottyCount,
    getPottySuccessRate,
    addMedicationLog,
    getMedicationLogs,
    addActivity,
    getRecentActivities,
    getActivitiesByType,
    deleteActivity,
    getBabyStats,
    updateBabyStats,
  };

  return (
    <BabyContext.Provider value={value}>
      {children}
    </BabyContext.Provider>
  );
};

export const useBaby = () => {
  const context = useContext(BabyContext);
  if (!context) throw new Error('useBaby must be used within BabyProvider');
  return context;
};

export default BabyProvider;