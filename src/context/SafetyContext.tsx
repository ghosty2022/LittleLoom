// src/context/SafetyContext.tsx
import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useEffect, 
  useRef,
  useMemo,
  ReactNode 
} from 'react';
import { Alert, Linking, Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

const STORAGE_KEY = 'littleloom_safety_data';
const EMERGENCY_LOG_KEY = 'littleloom_emergency_logs';

export interface SafetyTopic {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  category: 'emergency' | 'prevention' | 'daily';
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
  type: 'emergency' | 'medical' | 'poison' | 'custom' | 'family';
  icon: string;
  color: string;
  relation?: string;
  isDefault?: boolean;
}

export interface EmergencyLog {
  id: string;
  type: 'call' | 'location_share' | 'sos' | 'first_aid';
  timestamp: string;
  details: string;
  location?: { latitude: number; longitude: number };
  resolved: boolean;
}

export interface SafetyChecklist {
  id: string;
  title: string;
  items: { id: string; text: string; completed: boolean; critical: boolean }[];
  category: 'home' | 'car' | 'sleep' | 'feeding';
  progress: number;
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
  currentLocation: { latitude: number; longitude: number; address?: string } | null;
  isTrackingLocation: boolean;
  safetyScore: number;
  streakDays: number;
  lastActiveDate: string | null;
}

interface SafetyContextType extends SafetyState {
  loadSafetyData: () => Promise<void>;
  callEmergency: (number: string, label: string, type?: 'emergency' | 'medical' | 'custom') => Promise<void>;
  triggerSOS: () => Promise<void>;
  findNearbyHospitals: () => Promise<void>;
  findNearbyPediatricians: () => Promise<void>;
  shareLocationWithEmergency: (contactNumber?: string) => Promise<void>;
  startLocationTracking: () => Promise<void>;
  stopLocationTracking: () => void;
  getCurrentAddress: () => Promise<string | null>;
  toggleTopicExpanded: (topicId: string) => void;
  markTopicCompleted: (topicId: string) => Promise<void>;
  getTopicById: (id: string) => SafetyTopic | undefined;
  getEmergencyTopics: () => SafetyTopic[];
  getPreventionTopics: () => SafetyTopic[];
  getDailyTopics: () => SafetyTopic[];
  addCustomEmergencyContact: (contact: Omit<EmergencyContact, 'id'>) => Promise<void>;
  removeCustomContact: (id: string) => Promise<void>;
  updateEmergencyContact: (id: string, updates: Partial<EmergencyContact>) => Promise<void>;
  importFamilyContacts: (familyMembers: any[]) => Promise<void>;
  toggleChecklistItem: (checklistId: string, itemId: string) => Promise<void>;
  getChecklistProgress: (category: string) => number;
  markTipAsViewed: (topicId: string) => Promise<void>;
  getSafetyScore: () => number;
  getEmergencyLogs: () => EmergencyLog[];
  addEmergencyLog: (log: Omit<EmergencyLog, 'id' | 'timestamp'>) => Promise<void>;
  resolveEmergencyLog: (logId: string) => Promise<void>;
  triggerHaptic: (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
  getFirstAidSteps: (type: 'cpr' | 'choking' | 'burns' | 'bleeding' | 'allergic') => string[];
}

const defaultTopics: SafetyTopic[] = [
  {
    id: 'first_aid',
    icon: 'medical',
    title: 'First Aid Basics',
    description: 'Essential first aid knowledge for parents',
    color: '#ff4757',
    category: 'emergency',
    tips: [
      'Keep a well-stocked first aid kit at home',
      'Learn infant CPR and choking relief',
      'Know the signs of fever and when to call a doctor',
      'Keep emergency numbers posted on the fridge',
      'Learn how to treat burns, cuts, and bruises',
    ],
    emergencyNumbers: [
      { label: 'Emergency', number: '911' },
      { label: 'Poison Control', number: '1-800-222-1222' },
    ],
  },
  {
    id: 'sleep_safety',
    icon: 'bed',
    title: 'Safe Sleep',
    description: 'Creating a safe sleep environment',
    color: '#667eea',
    category: 'prevention',
    tips: [
      'Always place baby on their back to sleep',
      'Use a firm mattress with fitted sheet only',
      'Keep crib empty - no toys, blankets, or bumpers',
      'Room-share for the first 6-12 months',
      'Avoid overheating - dress baby appropriately',
    ],
  },
  {
    id: 'babyproofing',
    icon: 'home',
    title: 'Babyproofing Home',
    description: 'Making your home safe for exploration',
    color: '#43e97b',
    category: 'prevention',
    tips: [
      'Install safety gates at stairs and doorways',
      'Secure furniture to walls to prevent tipping',
      'Cover electrical outlets with safety plugs',
      'Store cleaning supplies and medications out of reach',
      'Use corner guards on sharp furniture edges',
    ],
  },
  {
    id: 'feeding_safety',
    icon: 'restaurant',
    title: 'Feeding Safety',
    description: 'Safe eating practices and choking prevention',
    color: '#fa709a',
    category: 'daily',
    tips: [
      'Always supervise during meal times',
      'Cut food into small, manageable pieces',
      'Avoid hard, round foods until age 3',
      'Learn infant choking first aid (back blows)',
      'Keep baby upright for 30 minutes after feeding',
    ],
  },
  {
    id: 'car_safety',
    icon: 'car',
    title: 'Car Seat Safety',
    description: 'Proper car seat installation and use',
    color: '#11998e',
    category: 'daily',
    tips: [
      'Use rear-facing seat until at least age 2',
      'Ensure harness straps are at or below shoulders',
      'Chest clip should be at armpit level',
      'Install seat tightly - less than 1 inch of movement',
      'Never leave baby alone in the car',
    ],
  },
  {
    id: 'emergency',
    icon: 'warning',
    title: 'Emergency Contacts',
    description: 'Important numbers and when to call',
    color: '#fc5c7d',
    category: 'emergency',
    tips: [
      'Pediatrician: [Add your number]',
      'Poison Control: 1-800-222-1222',
      'Emergency: 911',
      'Nearest ER: [Add address]',
      'Call 911 for: trouble breathing, unresponsiveness, severe bleeding',
    ],
    emergencyNumbers: [
      { label: 'Emergency', number: '911' },
      { label: 'Poison Control', number: '1-800-222-1222' },
    ],
  },
  {
    id: 'cpr_guide',
    icon: 'fitness',
    title: 'Infant CPR Guide',
    description: 'Step-by-step infant CPR instructions',
    color: '#e74c3c',
    category: 'emergency',
    tips: [
      'Check responsiveness - tap and shout',
      'Call 911 immediately if no response',
      'Place baby on firm, flat surface',
      'Give 30 gentle chest compressions (1.5 inches deep)',
      'Give 2 rescue breaths, covering mouth and nose',
      'Continue until help arrives or baby responds',
    ],
    emergencyNumbers: [{ label: 'Emergency', number: '911' }],
  },
  {
    id: 'choking',
    icon: 'alert-circle',
    title: 'Choking Response',
    description: 'What to do if baby is choking',
    color: '#dc3545',
    category: 'emergency',
    tips: [
      'Call 911 immediately if baby cannot breathe',
      'For infants under 1: 5 back slaps followed by 5 chest thrusts',
      'Alternate back slaps and chest thrusts until object is dislodged',
      'Do NOT perform blind finger sweeps',
      'Start CPR if baby becomes unresponsive',
    ],
    emergencyNumbers: [{ label: 'Emergency', number: '911' }],
  },
  {
    id: 'water_safety',
    icon: 'water',
    title: 'Water Safety',
    description: 'Keeping baby safe around water',
    color: '#17a2b8',
    category: 'prevention',
    tips: [
      'Never leave baby unattended near water, even for a second',
      'Empty bathtubs, buckets, and containers immediately after use',
      'Keep toilet lids closed and use toilet locks',
      'Stay within arm\'s reach during bath time',
      'Learn infant CPR - drowning can happen silently',
    ],
  },
  {
    id: 'allergic_reaction',
    icon: 'medical-outline',
    title: 'Allergic Reactions',
    description: 'Recognizing and responding to allergies',
    color: '#f39c12',
    category: 'emergency',
    tips: [
      'Watch for hives, swelling, or difficulty breathing',
      'Call 911 for severe reactions (anaphylaxis)',
      'Keep antihistamines on hand for mild reactions',
      'Know your baby\'s allergy triggers',
      'Have an emergency action plan from your pediatrician',
    ],
    emergencyNumbers: [{ label: 'Emergency', number: '911' }],
  },
];

const defaultEmergencyContacts: EmergencyContact[] = [
  { id: '1', label: 'Emergency', number: '911', type: 'emergency', icon: 'call', color: '#ff4757', isDefault: true },
  { id: '2', label: 'Poison Control', number: '1-800-222-1222', type: 'poison', icon: 'medical', color: '#667eea', isDefault: true },
  { id: '3', label: 'Pediatrician', number: '', type: 'medical', icon: 'person', color: '#43e97b', isDefault: true },
];

const defaultChecklists: SafetyChecklist[] = [
  {
    id: 'home_safety',
    title: 'Home Safety Check',
    category: 'home',
    progress: 0,
    items: [
      { id: 'h1', text: 'Install smoke & carbon monoxide detectors', completed: false, critical: true },
      { id: 'h2', text: 'Secure furniture to walls', completed: false, critical: true },
      { id: 'h3', text: 'Cover electrical outlets', completed: false, critical: true },
      { id: 'h4', text: 'Install safety gates at stairs', completed: false, critical: false },
      { id: 'h5', text: 'Lock away cleaning supplies', completed: false, critical: true },
      { id: 'h6', text: 'Remove small objects from reach', completed: false, critical: true },
    ],
  },
  {
    id: 'car_safety',
    title: 'Car Safety Check',
    category: 'car',
    progress: 0,
    items: [
      { id: 'c1', text: 'Rear-facing car seat installed correctly', completed: false, critical: true },
      { id: 'c2', text: 'Harness straps at correct height', completed: false, critical: true },
      { id: 'c3', text: 'Chest clip at armpit level', completed: false, critical: true },
      { id: 'c4', text: 'Seat moves less than 1 inch', completed: false, critical: true },
      { id: 'c5', text: 'Emergency supplies in trunk', completed: false, critical: false },
    ],
  },
  {
    id: 'sleep_safety',
    title: 'Sleep Safety Check',
    category: 'sleep',
    progress: 0,
    items: [
      { id: 's1', text: 'Firm mattress with fitted sheet', completed: false, critical: true },
      { id: 's2', text: 'No toys, blankets, or bumpers in crib', completed: false, critical: true },
      { id: 's3', text: 'Baby sleeps on back', completed: false, critical: true },
      { id: 's4', text: 'Room temperature comfortable', completed: false, critical: false },
      { id: 's5', text: 'Baby monitor working', completed: false, critical: false },
    ],
  },
];

const SafetyContext = createContext<SafetyContextType | null>(null);

export const SafetyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SafetyState>({
    topics: defaultTopics.map(t => ({ ...t, isExpanded: false })),
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
  });

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const loadSafetyData = useCallback(async () => {
    try {
      const [stored, logsStored, streakStored] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(EMERGENCY_LOG_KEY),
        AsyncStorage.getItem('littleloom_safety_streak'),
      ]);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          emergencyContacts: parsed.emergencyContacts || defaultEmergencyContacts,
          recentTipsViewed: parsed.recentTipsViewed || [],
          checklists: parsed.checklists || defaultChecklists,
          lastEmergencyCall: parsed.lastEmergencyCall ? new Date(parsed.lastEmergencyCall) : null,
        }));
      }
      
      if (logsStored) {
        setState(prev => ({ ...prev, emergencyLogs: JSON.parse(logsStored) }));
      }
      
      if (streakStored) {
        const { streakDays, lastActiveDate } = JSON.parse(streakStored);
        setState(prev => ({ ...prev, streakDays, lastActiveDate }));
      }
    } catch (error) {
      console.error('Failed to load safety data:', error);
    }
  }, []);

  useEffect(() => {
    loadSafetyData();
    checkLocationAvailability();
  }, [loadSafetyData]);

  useEffect(() => {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
          emergencyContacts: state.emergencyContacts,
          recentTipsViewed: state.recentTipsViewed,
          checklists: state.checklists,
          lastEmergencyCall: state.lastEmergencyCall,
        }));
      } catch (error) {
        console.error('Failed to save safety data:', error);
      }
    };
    persist();
  }, [state.emergencyContacts, state.recentTipsViewed, state.checklists, state.lastEmergencyCall]);

  useEffect(() => {
    const persistLogs = async () => {
      try {
        await AsyncStorage.setItem(EMERGENCY_LOG_KEY, JSON.stringify(state.emergencyLogs));
      } catch (error) {
        console.error('Failed to save emergency logs:', error);
      }
    };
    persistLogs();
  }, [state.emergencyLogs]);

  const checkLocationAvailability = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setState(prev => ({ ...prev, isLocationAvailable: status === 'granted' }));
    } catch (error) {
      setState(prev => ({ ...prev, isLocationAvailable: false }));
    }
  };

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
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

  const callEmergency = useCallback(async (number: string, label: string, type: 'emergency' | 'medical' | 'custom' = 'emergency') => {
    if (!number) {
      Alert.alert(
        'No Number Set',
        `Please configure your ${label} number first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    triggerHaptic('warning');

    Alert.alert(
      `Call ${label}?`,
      `Are you sure you want to call ${number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          style: 'destructive',
          onPress: async () => {
            try {
              await Linking.openURL(`tel:${number.replace(/\D/g, '')}`);
              
              const newLog: EmergencyLog = {
                id: Date.now().toString(),
                type: 'call',
                timestamp: new Date().toISOString(),
                details: `Called ${label} (${number})`,
                location: state.currentLocation || undefined,
                resolved: false,
              };
              
              setState(prev => ({
                ...prev,
                lastEmergencyCall: new Date(),
                emergencyLogs: [newLog, ...prev.emergencyLogs],
              }));
              
              triggerHaptic('error');
            } catch (error) {
              Alert.alert('Error', 'Could not initiate call. Please dial manually.');
            }
          },
        },
      ]
    );
  }, [state.currentLocation, triggerHaptic]);

  const triggerSOS = useCallback(async () => {
    triggerHaptic('error');
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    
    Alert.alert(
      'SOS EMERGENCY',
      'This will call Emergency Services and share your location with family contacts. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SOS - CALL 911',
          style: 'destructive',
          onPress: async () => {
            let location = state.currentLocation;
            if (!location) {
              try {
                const { coords } = await Location.getCurrentPositionAsync({});
                location = { latitude: coords.latitude, longitude: coords.longitude };
              } catch (e) {}
            }
            
            await Linking.openURL('tel:911');
            
            const familyContacts = state.emergencyContacts.filter(c => c.type === 'family' && c.number);
            for (const contact of familyContacts) {
              const message = `EMERGENCY SOS from LittleLoom\nI triggered an emergency at:\nhttps://maps.google.com/?q=${location?.latitude},${location?.longitude}`;
              await Linking.openURL(`sms:${contact.number}?body=${encodeURIComponent(message)}`);
            }
            
            const newLog: EmergencyLog = {
              id: Date.now().toString(),
              type: 'sos',
              timestamp: new Date().toISOString(),
              details: 'SOS triggered - 911 called and location shared',
              location: location || undefined,
              resolved: false,
            };
            
            setState(prev => ({
              ...prev,
              emergencyLogs: [newLog, ...prev.emergencyLogs],
            }));
          },
        },
      ]
    );
  }, [state.currentLocation, state.emergencyContacts, triggerHaptic]);

  const getCurrentAddress = useCallback(async (): Promise<string | null> => {
    try {
      if (!state.currentLocation) return null;
      const [address] = await Location.reverseGeocodeAsync(state.currentLocation);
      return `${address.street}, ${address.city}, ${address.region}`;
    } catch (e) {
      return null;
    }
  }, [state.currentLocation]);

  const findNearbyHospitals = useCallback(async () => {
    triggerHaptic('medium');
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location to find nearby hospitals.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setState(prev => ({ ...prev, currentLocation: coords }));

      const url = Platform.select({
        ios: `maps:?q=hospital+near+me&near=${coords.latitude},${coords.longitude}`,
        android: `geo:${coords.latitude},${coords.longitude}?q=hospital`,
      });

      if (url) {
        await Linking.openURL(url);
        
        const newLog: EmergencyLog = {
          id: Date.now().toString(),
          type: 'first_aid',
          timestamp: new Date().toISOString(),
          details: 'Searched for nearby hospitals',
          location: coords,
          resolved: true,
        };
        
        setState(prev => ({
          ...prev,
          emergencyLogs: [newLog, ...prev.emergencyLogs],
        }));
      }
    } catch (error) {
      Alert.alert(
        'Find Hospitals',
        'Open maps to search for hospitals?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Maps', 
            onPress: () => Linking.openURL('https://maps.google.com/?q=hospital+near+me')
          }
        ]
      );
    }
  }, [triggerHaptic]);

  const findNearbyPediatricians = useCallback(async () => {
    triggerHaptic('medium');
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const url = Platform.select({
        ios: `maps:?q=pediatrician+near+me&near=${location.coords.latitude},${location.coords.longitude}`,
        android: `geo:${location.coords.latitude},${location.coords.longitude}?q=pediatrician`,
      });

      if (url) await Linking.openURL(url);
    } catch (error) {
      Linking.openURL('https://maps.google.com/?q=pediatrician+near+me');
    }
  }, [triggerHaptic]);

  const shareLocationWithEmergency = useCallback(async (contactNumber?: string) => {
    triggerHaptic('medium');
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location sharing.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setState(prev => ({ ...prev, currentLocation: coords }));
      
      const address = await getCurrentAddress();
      const message = `LittleLoom Emergency Location Share\n\nI'm at: ${address || 'Current Location'}\nhttps://maps.google.com/?q=${coords.latitude},${coords.longitude}\n\nSent via LittleLoom Safety Corner`;
      
      if (contactNumber) {
        await Linking.openURL(`sms:${contactNumber}?body=${encodeURIComponent(message)}`);
      } else {
        await Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
      }
      
      const newLog: EmergencyLog = {
        id: Date.now().toString(),
        type: 'location_share',
        timestamp: new Date().toISOString(),
        details: `Location shared${contactNumber ? ' with contact' : ''}`,
        location: coords,
        resolved: true,
      };
      
      setState(prev => ({
        ...prev,
        emergencyLogs: [newLog, ...prev.emergencyLogs],
      }));
      
      triggerHaptic('success');
    } catch (error) {
      Alert.alert('Error', 'Could not share location.');
    }
  }, [getCurrentAddress, triggerHaptic]);

  const startLocationTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (location) => {
          setState(prev => ({
            ...prev,
            currentLocation: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
          }));
        }
      );
      
      setState(prev => ({ ...prev, isTrackingLocation: true }));
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  }, []);

  const stopLocationTracking = useCallback(() => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    setState(prev => ({ ...prev, isTrackingLocation: false }));
  }, []);

  const toggleTopicExpanded = useCallback((topicId: string) => {
    setState(prev => ({
      ...prev,
      topics: prev.topics.map(t =>
        t.id === topicId ? { ...t, isExpanded: !t.isExpanded } : t
      ),
    }));
  }, []);

  const markTopicCompleted = useCallback(async (topicId: string) => {
    setState(prev => ({
      ...prev,
      topics: prev.topics.map(t =>
        t.id === topicId ? { ...t, completedAt: new Date().toISOString() } : t
      ),
    }));
    triggerHaptic('success');
  }, [triggerHaptic]);

  const getTopicById = useCallback((id: string) => {
    return state.topics.find(t => t.id === id);
  }, [state.topics]);

  const getEmergencyTopics = useCallback(() => {
    return state.topics.filter(t => t.category === 'emergency');
  }, [state.topics]);

  const getPreventionTopics = useCallback(() => {
    return state.topics.filter(t => t.category === 'prevention');
  }, [state.topics]);

  const getDailyTopics = useCallback(() => {
    return state.topics.filter(t => t.category === 'daily');
  }, [state.topics]);

  const addCustomEmergencyContact = useCallback(async (contact: Omit<EmergencyContact, 'id'>) => {
    const newContact: EmergencyContact = {
      ...contact,
      id: Date.now().toString(),
    };
    setState(prev => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, newContact],
    }));
    triggerHaptic('success');
  }, [triggerHaptic]);

  const removeCustomContact = useCallback(async (id: string) => {
    setState(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter(c => c.id !== id),
    }));
  }, []);

  const updateEmergencyContact = useCallback(async (id: string, updates: Partial<EmergencyContact>) => {
    setState(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  }, []);

  const importFamilyContacts = useCallback(async (familyMembers: any[]) => {
    const newContacts: EmergencyContact[] = familyMembers
      .filter(m => m.phoneNumber)
      .map((m, idx) => ({
        id: `family_${idx}_${Date.now()}`,
        label: m.fullName || m.relationship || 'Family',
        number: m.phoneNumber,
        type: 'family',
        icon: m.role === 'parent2' ? 'people' : 'shield-checkmark',
        color: m.role === 'parent2' ? '#11998e' : '#fc5c7d',
        relation: m.relationship,
      }));
    
    setState(prev => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts.filter(c => c.type !== 'family'), ...newContacts],
    }));
  }, []);

  const toggleChecklistItem = useCallback(async (checklistId: string, itemId: string) => {
    setState(prev => {
      const newChecklists = prev.checklists.map(cl => {
        if (cl.id !== checklistId) return cl;
        
        const newItems = cl.items.map(item =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        
        const completed = newItems.filter(i => i.completed).length;
        const progress = Math.round((completed / newItems.length) * 100);
        
        return { ...cl, items: newItems, progress };
      });
      
      return { ...prev, checklists: newChecklists };
    });
    
    triggerHaptic('light');
  }, [triggerHaptic]);

  const getChecklistProgress = useCallback((category: string) => {
    const checklist = state.checklists.find(c => c.category === category);
    return checklist?.progress || 0;
  }, [state.checklists]);

  const markTipAsViewed = useCallback(async (topicId: string) => {
    if (!state.recentTipsViewed.includes(topicId)) {
      setState(prev => ({
        ...prev,
        recentTipsViewed: [...prev.recentTipsViewed, topicId],
      }));
      
      const today = new Date().toDateString();
      if (state.lastActiveDate !== today) {
        const newStreak = state.lastActiveDate === new Date(Date.now() - 86400000).toDateString() 
          ? state.streakDays + 1 
          : 1;
        
        setState(prev => ({
          ...prev,
          streakDays: newStreak,
          lastActiveDate: today,
        }));
        
        await AsyncStorage.setItem('littleloom_safety_streak', JSON.stringify({
          streakDays: newStreak,
          lastActiveDate: today,
        }));
      }
    }
  }, [state.recentTipsViewed, state.streakDays, state.lastActiveDate]);

  const getSafetyScore = useCallback(() => {
    const viewedCount = state.recentTipsViewed.length;
    const totalTopics = state.topics.length;
    const checklistProgress = state.checklists.reduce((acc, cl) => acc + cl.progress, 0) / state.checklists.length;
    const baseScore = Math.round((viewedCount / totalTopics) * 50 + (checklistProgress / 100) * 50);
    return Math.min(100, baseScore + (state.streakDays > 0 ? 5 : 0));
  }, [state.recentTipsViewed, state.topics.length, state.checklists, state.streakDays]);

  const getEmergencyLogs = useCallback(() => {
    return state.emergencyLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [state.emergencyLogs]);

  const addEmergencyLog = useCallback(async (log: Omit<EmergencyLog, 'id' | 'timestamp'>) => {
    const newLog: EmergencyLog = {
      ...log,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    
    setState(prev => ({
      ...prev,
      emergencyLogs: [newLog, ...prev.emergencyLogs],
    }));
  }, []);

  const resolveEmergencyLog = useCallback(async (logId: string) => {
    setState(prev => ({
      ...prev,
      emergencyLogs: prev.emergencyLogs.map(log =>
        log.id === logId ? { ...log, resolved: true } : log
      ),
    }));
    triggerHaptic('success');
  }, [triggerHaptic]);

  const getFirstAidSteps = useCallback((type: 'cpr' | 'choking' | 'burns' | 'bleeding' | 'allergic') => {
    const steps: Record<string, string[]> = {
      cpr: [
        'Check scene safety',
        'Check responsiveness - tap and shout',
        'Call 911 or send someone to call',
        'Open airway - head tilt, chin lift',
        'Check breathing for no more than 10 seconds',
        'Give 30 compressions (1.5 inches deep, 2 per second)',
        'Give 2 rescue breaths',
        'Continue cycles until help arrives',
      ],
      choking: [
        'Verify choking (cannot cough, speak, or breathe)',
        'Call 911 immediately',
        'For infant under 1: Position head down',
        'Give 5 firm back slaps between shoulder blades',
        'Turn over, give 5 chest thrusts (2 fingers, center of chest)',
        'Repeat back slaps and chest thrusts until object dislodged',
        'If unresponsive, start CPR',
      ],
      burns: [
        'Remove from source of heat',
        'Cool burn under cool running water for 10-20 minutes',
        'Remove tight items before swelling occurs',
        'Cover with sterile gauze or clean cloth',
        'Do NOT apply ice, butter, or creams',
        'Seek medical help for burns larger than 3 inches',
      ],
      bleeding: [
        'Apply direct pressure with clean cloth',
        'Elevate wound above heart if possible',
        'Add more layers if blood soaks through',
        'Apply pressure to pressure point if needed',
        'Call 911 if bleeding is severe or won\'t stop',
        'Monitor for shock (pale, clammy, rapid breathing)',
      ],
      allergic: [
        'Recognize symptoms: hives, swelling, breathing difficulty',
        'Call 911 for severe reactions',
        'Use epinephrine auto-injector if available',
        'Keep person lying down with legs elevated',
        'Monitor breathing until help arrives',
        'Be prepared to perform CPR if needed',
      ],
    };
    return steps[type] || [];
  }, []);

  // FIXED: Changed from React.useMemo to useMemo (imported directly)
  const value = useMemo(() => ({
    ...state,
    loadSafetyData,
    callEmergency,
    triggerSOS,
    findNearbyHospitals,
    findNearbyPediatricians,
    shareLocationWithEmergency,
    startLocationTracking,
    stopLocationTracking,
    getCurrentAddress,
    toggleTopicExpanded,
    markTopicCompleted,
    getTopicById,
    getEmergencyTopics,
    getPreventionTopics,
    getDailyTopics,
    addCustomEmergencyContact,
    removeCustomContact,
    updateEmergencyContact,
    importFamilyContacts,
    toggleChecklistItem,
    getChecklistProgress,
    markTipAsViewed,
    getSafetyScore,
    getEmergencyLogs,
    addEmergencyLog,
    resolveEmergencyLog,
    triggerHaptic,
    getFirstAidSteps,
  }), [
    state,
    loadSafetyData,
    callEmergency,
    triggerSOS,
    findNearbyHospitals,
    findNearbyPediatricians,
    shareLocationWithEmergency,
    startLocationTracking,
    stopLocationTracking,
    getCurrentAddress,
    toggleTopicExpanded,
    markTopicCompleted,
    getTopicById,
    getEmergencyTopics,
    getPreventionTopics,
    getDailyTopics,
    addCustomEmergencyContact,
    removeCustomContact,
    updateEmergencyContact,
    importFamilyContacts,
    toggleChecklistItem,
    getChecklistProgress,
    markTipAsViewed,
    getSafetyScore,
    getEmergencyLogs,
    addEmergencyLog,
    resolveEmergencyLog,
    triggerHaptic,
    getFirstAidSteps,
  ]);

  return (
    <SafetyContext.Provider value={value}>
      {children}
    </SafetyContext.Provider>
  );
};

export const useSafety = () => {
  const context = useContext(SafetyContext);
  if (!context) throw new Error('useSafety must be used within SafetyProvider');
  return context;
};

export { SafetyContext };
export default SafetyProvider;