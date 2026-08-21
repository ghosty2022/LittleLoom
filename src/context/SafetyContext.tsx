// src/context/SafetyContext.tsx
// Full Supabase-compatible safety features

import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  createContext,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { Linking, Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useSweetAlert } from '../components/SweetAlert';
import { getAppSetting, setAppSetting, deleteAppSetting } from '@/database/dbHelpers';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'littleloom_safety_data_v2';
const EMERGENCY_LOG_KEY = 'littleloom_emergency_logs_v2';
const STREAK_KEY = 'littleloom_safety_streak_v2';
const DOCTOR_REPORTS_KEY = 'littleloom_doctor_reports_v2';
const MAX_TOPICS_SELECTED = 5;

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS SETUP
   ═══════════════════════════════════════════════════════════════ */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
export type EmergencyType = 'emergency' | 'medical' | 'poison' | 'custom' | 'family';
export type SafetyCategory = 'emergency' | 'prevention' | 'daily';
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
export type FirstAidType = 'cpr' | 'choking' | 'burns' | 'bleeding' | 'allergic';

export interface SafetyTopic {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  category: SafetyCategory;
  tips: string[];
  emergencyNumbers?: { label: string; number: string }[];
  videoUrl?: string;
  isExpanded?: boolean;
  completedAt?: string;
}

export interface EmergencyContact {
  id: string;
  label: string;
  number: string;
  type: EmergencyType;
  icon: string;
  color: string;
  relation?: string;
  isDefault?: boolean;
  avatar?: string;
}

export interface EmergencyLog {
  id: string;
  type: 'call' | 'location_share' | 'sos' | 'first_aid';
  timestamp: string;
  details: string;
  location?: { latitude: number; longitude: number };
  resolved: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  critical: boolean;
}

export interface SafetyChecklist {
  id: string;
  title: string;
  items: ChecklistItem[];
  category: 'home' | 'car' | 'sleep' | 'feeding';
  progress: number;
}

export interface SafetyLocation {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  timestamp: string;
}

export interface DoctorReport {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'reviewed';
}

interface SafetyState {
  topics: SafetyTopic[];
  emergencyContacts: EmergencyContact[];
  emergencyLogs: EmergencyLog[];
  checklists: SafetyChecklist[];
  recentTipsViewed: string[];
  isLoading: boolean;
  lastEmergencyCall: Date | null;
  isLocationAvailable: boolean;
  currentLocation: SafetyLocation | null;
  isTrackingLocation: boolean;
  safetyScore: number;
  streakDays: number;
  lastActiveDate: string | null;
  doctorReports: DoctorReport[];
}

interface SafetyContextType extends SafetyState {
  loadSafetyData: () => Promise<void>;
  resetSafetyData: () => Promise<void>;

  callEmergency: (number: string, label: string, type?: EmergencyType) => Promise<void>;
  triggerSOS: () => Promise<void>;
  findNearbyHospitals: () => Promise<void>;
  findNearbyPediatricians: () => Promise<void>;
  shareLocationWithEmergency: (contactNumber?: string) => Promise<void>;

  startLocationTracking: () => Promise<void>;
  stopLocationTracking: () => void;
  getCurrentAddress: () => Promise<string | null>;
  refreshLocation: () => Promise<SafetyLocation | null>;

  toggleTopicExpanded: (topicId: string) => void;
  markTopicCompleted: (topicId: string) => Promise<void>;
  markTopicIncomplete: (topicId: string) => Promise<void>;
  getTopicById: (id: string) => SafetyTopic | undefined;
  getTopicsByCategory: (category: SafetyCategory) => SafetyTopic[];
  searchTopics: (query: string) => SafetyTopic[];

  addCustomEmergencyContact: (contact: Omit<EmergencyContact, 'id'>) => Promise<void>;
  removeCustomContact: (id: string) => Promise<void>;
  updateEmergencyContact: (id: string, updates: Partial<EmergencyContact>) => Promise<void>;
  importFamilyContacts: (familyMembers: Array<{
    phoneNumber?: string;
    fullName?: string;
    relationship?: string;
    role?: string;
    avatar?: string;
  }>) => Promise<void>;
  importDeviceContacts: (contacts: EmergencyContact[]) => Promise<void>;

  toggleChecklistItem: (checklistId: string, itemId: string) => Promise<void>;
  getChecklistProgress: (category: string) => number;
  resetChecklist: (checklistId: string) => Promise<void>;

  markTipAsViewed: (topicId: string) => Promise<void>;
  getSafetyScore: () => number;
  getSafetyLevel: () => 'excellent' | 'good' | 'fair' | 'poor';

  getEmergencyLogs: () => EmergencyLog[];
  addEmergencyLog: (log: Omit<EmergencyLog, 'id' | 'timestamp'>) => Promise<void>;
  resolveEmergencyLog: (logId: string) => Promise<void>;
  clearEmergencyLogs: () => Promise<void>;

  triggerHaptic: (type: HapticType) => void;

  getFirstAidSteps: (type: FirstAidType) => string[];

  addDoctorReport: (report: Omit<DoctorReport, 'id' | 'uploadedAt'>) => Promise<void>;
  approveDoctorReport: (reportId: string, approvedBy: string) => Promise<void>;
  getDoctorReports: () => DoctorReport[];
  deleteDoctorReport: (reportId: string) => Promise<void>;

  scheduleSafetyReminder: (title: string, body: string, triggerDate: Date) => Promise<string | null>;
  cancelSafetyReminder: (identifier: string) => Promise<void>;
}

/* ═══════════════════════════════════════════════════════════════
   DEFAULT DATA
   ═══════════════════════════════════════════════════════════════ */

// ... (defaultTopics, defaultEmergencyContacts, defaultChecklists remain the same as in your original)
// Keeping this brief - use your original data

const defaultTopics: SafetyTopic[] = [
  // ... your original topics
];

const defaultEmergencyContacts: EmergencyContact[] = [
  // ... your original contacts
];

const defaultChecklists: SafetyChecklist[] = [
  // ... your original checklists
];

/* ═══════════════════════════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════════════════════════ */
const SafetyContext = createContext<SafetyContextType | null>(null);

/* ═══════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════ */
export const SafetyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SafetyState>({
    topics: defaultTopics.map((t) => ({ ...t, isExpanded: false })),
    emergencyContacts: defaultEmergencyContacts,
    emergencyLogs: [],
    checklists: defaultChecklists,
    recentTipsViewed: [],
    isLoading: false,
    lastEmergencyCall: null,
    isLocationAvailable: true,
    currentLocation: null,
    isTrackingLocation: false,
    safetyScore: 0,
    streakDays: 0,
    lastActiveDate: null,
    doctorReports: [],
  });

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isMounted = useRef(true);
  const sweetAlert = useSweetAlert();

  /* ── Lifecycle ── */
  useEffect(() => {
    isMounted.current = true;
    loadSafetyData();
    return () => {
      isMounted.current = false;
      stopLocationTracking();
    };
  }, []);

  /* ── Persistence ── */
  useEffect(() => {
    const persist = async () => {
      try {
        const data = JSON.stringify({
          emergencyContacts: state.emergencyContacts,
          recentTipsViewed: state.recentTipsViewed,
          checklists: state.checklists,
          lastEmergencyCall: state.lastEmergencyCall,
          doctorReports: state.doctorReports,
        });
        await setAppSetting(STORAGE_KEY, data);
      } catch (error) {
        console.error('[SafetyContext] Failed to save safety data:', error);
      }
    };
    persist();
  }, [state.emergencyContacts, state.recentTipsViewed, state.checklists, state.lastEmergencyCall, state.doctorReports]);

  useEffect(() => {
    const persistLogs = async () => {
      try {
        const data = JSON.stringify(state.emergencyLogs);
        await setAppSetting(EMERGENCY_LOG_KEY, data);
      } catch (error) {
        console.error('[SafetyContext] Failed to save emergency logs:', error);
      }
    };
    persistLogs();
  }, [state.emergencyLogs]);

  /* ── Load data ── */
  const loadSafetyData = useCallback(async () => {
    try {
      const [stored, logsStored, streakStored, reportsStored] = await Promise.all([
        getAppSetting(STORAGE_KEY),
        getAppSetting(EMERGENCY_LOG_KEY),
        getAppSetting(STREAK_KEY),
        getAppSetting(DOCTOR_REPORTS_KEY),
      ]);

      const updates: Partial<SafetyState> = {};

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          updates.emergencyContacts = parsed.emergencyContacts || defaultEmergencyContacts;
          updates.recentTipsViewed = parsed.recentTipsViewed || [];
          updates.checklists = parsed.checklists || defaultChecklists;
          updates.lastEmergencyCall = parsed.lastEmergencyCall ? new Date(parsed.lastEmergencyCall) : null;
          updates.doctorReports = parsed.doctorReports || [];
        } catch (e) {
          console.warn('[SafetyContext] Failed to parse stored data');
        }
      }

      if (logsStored) {
        try {
          updates.emergencyLogs = JSON.parse(logsStored);
        } catch (e) {
          updates.emergencyLogs = [];
        }
      }

      if (streakStored) {
        try {
          const { streakDays, lastActiveDate } = JSON.parse(streakStored);
          updates.streakDays = streakDays || 0;
          updates.lastActiveDate = lastActiveDate || null;
        } catch (e) {
          updates.streakDays = 0;
          updates.lastActiveDate = null;
        }
      }

      if (reportsStored) {
        try {
          updates.doctorReports = JSON.parse(reportsStored);
        } catch (e) {
          updates.doctorReports = [];
        }
      }

      if (isMounted.current) {
        setState((prev) => ({ ...prev, ...updates }));
      }
    } catch (error) {
      console.error('[SafetyContext] Failed to load safety data:', error);
    }
  }, []);

  /* ── Reset all data ── */
  const resetSafetyData = useCallback(async () => {
    try {
      await deleteAppSetting(STORAGE_KEY);
      await deleteAppSetting(EMERGENCY_LOG_KEY);
      await deleteAppSetting(STREAK_KEY);
      await deleteAppSetting(DOCTOR_REPORTS_KEY);
      setState({
        topics: defaultTopics.map((t) => ({ ...t, isExpanded: false })),
        emergencyContacts: defaultEmergencyContacts,
        emergencyLogs: [],
        checklists: defaultChecklists,
        recentTipsViewed: [],
        isLoading: false,
        lastEmergencyCall: null,
        isLocationAvailable: true,
        currentLocation: null,
        isTrackingLocation: false,
        safetyScore: 0,
        streakDays: 0,
        lastActiveDate: null,
        doctorReports: [],
      });
    } catch (error) {
      console.error('[SafetyContext] Failed to reset safety data:', error);
    }
  }, []);

  /* ── Location helpers ── */
  const checkLocationAvailability = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (isMounted.current) {
        setState((prev) => ({ ...prev, isLocationAvailable: status === 'granted' }));
      }
      return status === 'granted';
    } catch (error) {
      if (isMounted.current) {
        setState((prev) => ({ ...prev, isLocationAvailable: false }));
      }
      return false;
    }
  }, []);

  const refreshLocation = useCallback(async (): Promise<SafetyLocation | null> => {
    const hasPermission = await checkLocationAvailability();
    if (!hasPermission) return null;

    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const location: SafetyLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
        timestamp: new Date().toISOString(),
      };

      if (isMounted.current) {
        setState((prev) => ({ ...prev, currentLocation: location }));
      }
      return location;
    } catch (error) {
      console.error('[SafetyContext] Failed to get location:', error);
      return null;
    }
  }, [checkLocationAvailability]);

  /* ── Haptics ── */
  const triggerHaptic = useCallback((type: HapticType) => {
    try {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (e) {
      Vibration.vibrate(type === 'error' ? [0, 500] : [0, 50]);
    }
  }, []);

  /* ── Emergency call ── */
  const callEmergency = useCallback(
    async (number: string, label: string, type: EmergencyType = 'emergency') => {
      if (!number) {
        sweetAlert.alert('No Number Set', 'Please configure your number first.');
        return;
      }

      triggerHaptic('warning');

      sweetAlert.confirm(
        `Call ${label}?`,
        `Are you sure you want to call ${number}?`,
        async () => {
          try {
            await Linking.openURL(`tel:${number.replace(/\\D/g, '')}`);

            const newLog: EmergencyLog = {
              id: Date.now().toString(),
              type: 'call',
              timestamp: new Date().toISOString(),
              details: `Called ${label} (${number})`,
              location: state.currentLocation
                ? {
                    latitude: state.currentLocation.latitude,
                    longitude: state.currentLocation.longitude,
                  }
                : undefined,
              resolved: false,
            };

            if (isMounted.current) {
              setState((prev) => ({
                ...prev,
                lastEmergencyCall: new Date(),
                emergencyLogs: [newLog, ...prev.emergencyLogs],
              }));
            }

            triggerHaptic('error');
          } catch (error) {
            sweetAlert.alert('Error', 'Could not initiate call. Please dial manually.');
          }
        },
        () => {},
        'Call',
        'Cancel'
      );
    },
    [state.currentLocation, triggerHaptic]
  );

  /* ── SOS trigger ── */
  const triggerSOS = useCallback(async () => {
    triggerHaptic('error');
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

    sweetAlert.confirm(
      'SOS EMERGENCY',
      'This will call Emergency Services and share your location with family contacts. Continue?',
      async () => {
        let location = state.currentLocation;
        if (!location) {
          location = await refreshLocation();
        }

        try {
          await Linking.openURL('tel:911');
        } catch (e) {
          console.error('[SafetyContext] Failed to dial 911:', e);
        }

        const familyContacts = state.emergencyContacts.filter((c) => c.type === 'family' && c.number);
        for (const contact of familyContacts) {
          try {
            const message = `EMERGENCY SOS from LittleLoom\\nI triggered an emergency at:\\nhttps://maps.google.com/?q=${location?.latitude},${location?.longitude}`;
            await Linking.openURL(`sms:${contact.number}?body=${encodeURIComponent(message)}`);
          } catch (e) {
            console.error(`[SafetyContext] Failed to SMS ${contact.label}:`, e);
          }
        }

        const newLog: EmergencyLog = {
          id: Date.now().toString(),
          type: 'sos',
          timestamp: new Date().toISOString(),
          details: 'SOS triggered - 911 called and location shared',
          location: location
            ? { latitude: location.latitude, longitude: location.longitude }
            : undefined,
          resolved: false,
        };

        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            emergencyLogs: [newLog, ...prev.emergencyLogs],
          }));
        }
      },
      () => {},
      'SOS - CALL 911',
      'Cancel'
    );
  }, [state.currentLocation, state.emergencyContacts, refreshLocation, triggerHaptic]);

  /* ── Other methods ── */
  // ... (findNearbyHospitals, findNearbyPediatricians, shareLocationWithEmergency,
  // startLocationTracking, stopLocationTracking, getCurrentAddress,
  // toggleTopicExpanded, markTopicCompleted, markTopicIncomplete,
  // getTopicById, getTopicsByCategory, searchTopics,
  // addCustomEmergencyContact, removeCustomContact, updateEmergencyContact,
  // importFamilyContacts, importDeviceContacts,
  // toggleChecklistItem, getChecklistProgress, resetChecklist,
  // markTipAsViewed, getSafetyScore, getSafetyLevel,
  // getEmergencyLogs, addEmergencyLog, resolveEmergencyLog, clearEmergencyLogs,
  // getFirstAidSteps,
  // addDoctorReport, approveDoctorReport, getDoctorReports, deleteDoctorReport,
  // scheduleSafetyReminder, cancelSafetyReminder)
  //
  // These remain the same as your original implementation

  /* ═══════════════════════════════════════════════════════════════
     MEMOIZED VALUE
     ═══════════════════════════════════════════════════════════════ */
  const value = useMemo<SafetyContextType>(
    () => ({
      ...state,
      loadSafetyData,
      resetSafetyData,
      callEmergency,
      triggerSOS,
      findNearbyHospitals,
      findNearbyPediatricians,
      shareLocationWithEmergency,
      startLocationTracking,
      stopLocationTracking,
      getCurrentAddress,
      refreshLocation,
      toggleTopicExpanded,
      markTopicCompleted,
      markTopicIncomplete,
      getTopicById,
      getTopicsByCategory,
      searchTopics,
      addCustomEmergencyContact,
      removeCustomContact,
      updateEmergencyContact,
      importFamilyContacts,
      importDeviceContacts,
      toggleChecklistItem,
      getChecklistProgress,
      resetChecklist,
      markTipAsViewed,
      getSafetyScore,
      getSafetyLevel,
      getEmergencyLogs,
      addEmergencyLog,
      resolveEmergencyLog,
      clearEmergencyLogs,
      triggerHaptic,
      getFirstAidSteps,
      addDoctorReport,
      approveDoctorReport,
      getDoctorReports,
      deleteDoctorReport,
      scheduleSafetyReminder,
      cancelSafetyReminder,
    }),
    [
      state,
      loadSafetyData,
      resetSafetyData,
      callEmergency,
      triggerSOS,
      findNearbyHospitals,
      findNearbyPediatricians,
      shareLocationWithEmergency,
      startLocationTracking,
      stopLocationTracking,
      getCurrentAddress,
      refreshLocation,
      toggleTopicExpanded,
      markTopicCompleted,
      markTopicIncomplete,
      getTopicById,
      getTopicsByCategory,
      searchTopics,
      addCustomEmergencyContact,
      removeCustomContact,
      updateEmergencyContact,
      importFamilyContacts,
      importDeviceContacts,
      toggleChecklistItem,
      getChecklistProgress,
      resetChecklist,
      markTipAsViewed,
      getSafetyScore,
      getSafetyLevel,
      getEmergencyLogs,
      addEmergencyLog,
      resolveEmergencyLog,
      clearEmergencyLogs,
      triggerHaptic,
      getFirstAidSteps,
      addDoctorReport,
      approveDoctorReport,
      getDoctorReports,
      deleteDoctorReport,
      scheduleSafetyReminder,
      cancelSafetyReminder,
    ]
  );

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
};

/* ═══════════════════════════════════════════════════════════════
   HOOK
   ═══════════════════════════════════════════════════════════════ */
export const useSafety = (): SafetyContextType => {
  const context = useContext(SafetyContext);
  if (!context) throw new Error('useSafety must be used within SafetyProvider');
  return context;
};

export { SafetyContext };
export default SafetyProvider;