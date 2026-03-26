// src/screens/EditProfileScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  Dimensions,
  Modal,
  Platform,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, { FadeInUp, FadeInDown, useSharedValue, useAnimatedStyle, interpolate, Extrapolate, useAnimatedScrollHandler } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

// Contexts - FIXED: Added useActivity import
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useBaby, GrowthMeasurement, Milestone } from '../context/BabyContext';
import { useFamily, FamilyMember } from '../context/FamilyContext';
import { useActivity, ActivityEntry } from '../context/ActivityContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Constants
const SKIN_TONES = [
  { color: '#f5d0c5', label: 'Light' },
  { color: '#e8c4b8', label: 'Fair' },
  { color: '#d4a574', label: 'Medium' },
  { color: '#a67c52', label: 'Tan' },
  { color: '#6b4423', label: 'Dark' },
];

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#fa709a', gradient: ['#fa709a', '#fee140'] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
];

const GROWTH_COLORS = {
  height: '#667eea',
  weight: '#fa709a',
  head: '#11998e',
  temperature: '#f093fb',
};

const UNITS = {
  height: ['cm', 'in'],
  weight: ['kg', 'lbs', 'oz'],
  head: ['cm', 'in'],
  temperature: ['°C', '°F'],
};

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#667eea' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#f97316' },
];

// Activity type configuration for icons and colors
const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; emoji: string }> = {
  potty: { icon: 'water-outline', color: '#8b5cf6', emoji: '🚽' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', emoji: '🍼' },
  sleep: { icon: 'moon-outline', color: '#3b82f6', emoji: '😴' },
  growth: { icon: 'trending-up-outline', color: '#10b981', emoji: '📏' },
  medication: { icon: 'medical-outline', color: '#ef4444', emoji: '💊' },
  milestone: { icon: 'trophy-outline', color: '#f97316', emoji: '🌟' },
  diaper: { icon: 'layers-outline', color: '#06b6d4', emoji: '🧷' },
  note: { icon: 'document-text-outline', color: '#6b7280', emoji: '📝' },
};

type EditProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

// ==================== SAFE BABY AVATAR COMPONENT ====================

const SafeBabyAvatar: React.FC<{
  avatar?: string | null;
  gender?: string;
  size?: number;
  showEditButton?: boolean;
  onEdit?: () => void;
}> = ({ avatar, gender = 'other', size = 130, showEditButton = false, onEdit }) => {
  const isEmoji = avatar && 
    typeof avatar === 'string' && 
    avatar.length <= 4 && 
    /\p{Emoji}/u.test(avatar);
  
  const isImageUri = avatar && 
    typeof avatar === 'string' && 
    (avatar.startsWith('http') || avatar.startsWith('file://') || avatar.startsWith('data:'));

  const genderOption = GENDER_OPTIONS.find(g => g.value === gender);
  const gradientColors = genderOption?.gradient || ['#667eea', '#764ba2'];

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={gradientColors}
        style={[
          styles.avatarGradient, 
          { width: size, height: size, borderRadius: size / 2 }
        ]}
      >
        {isEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>
            {avatar}
          </Text>
        ) : isImageUri ? (
          <Image 
            source={{ uri: avatar }} 
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        ) : (
          <Ionicons 
            name={genderOption?.icon as any || 'ellipse'} 
            size={size * 0.4} 
            color="#fff" 
          />
        )}
      </LinearGradient>
      
      {showEditButton && onEdit && (
        <TouchableOpacity 
          style={[styles.editAvatarBtn, { bottom: 4, right: 4 }]}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.editAvatarGradient}
          >
            <Ionicons name="camera" size={16} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ==================== GLASS CARD COMPONENT - EXACTLY LIKE PROFILESCREEN ====================

const GlassCard: React.FC<{ 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  intensity?: number;
  delay?: number;
}> = ({ children, style, onPress, intensity = 85, delay = 0 }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;
  
  return (
    <Animated.View entering={FadeInUp.delay(delay)} style={[styles.glassCard, style]}>
      <Wrapper onPress={onPress} activeOpacity={0.85} style={{ flex: 1 }}>
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.glassBorder, isDark && styles.glassBorderDark]} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
};

// ==================== STAT BADGE COMPONENT ====================

const StatBadge: React.FC<{ icon: string; value: number | string; label: string; color: string }> = ({ 
  icon, value, label, color 
}) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: `${color}20` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ==================== ACTIVITY ITEM COMPONENT ====================

const ActivityItem: React.FC<{ activity: ActivityEntry; isDark: boolean }> = ({ activity, isDark }) => {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note;
  
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: `${config.color}15` }]}>
        <Text style={styles.activityEmoji}>{config.emoji}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityTitle, isDark && styles.textDark]} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.activityTime}>
          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
        </Text>
      </View>
    </View>
  );
};

// ==================== FAMILY AVATAR STACK COMPONENT ====================

const FamilyAvatarStack: React.FC<{ 
  members: FamilyMember[]; 
  maxDisplay?: number;
  onPress: () => void;
}> = ({ members, maxDisplay = 4, onPress }) => {
  const displayMembers = members.slice(0, maxDisplay);
  const remaining = members.length - maxDisplay;
  
  const roleColors: Record<string, string[]> = {
    'parent1': ['#667eea', '#764ba2'],
    'parent2': ['#fa709a', '#fee140'],
    'guardian': ['#11998e', '#38ef7d'],
    'viewer': ['#64748b', '#94a3b8'],
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.avatarStackContainer}>
      <View style={styles.avatarStack}>
        {displayMembers.map((member, index) => (
          <LinearGradient
            key={member.id}
            colors={roleColors[member.role] || roleColors['viewer']}
            style={[styles.stackAvatar, { marginLeft: index > 0 ? -12 : 0, zIndex: maxDisplay - index }]}
          >
            <Text style={styles.stackAvatarText}>{member.fullName.charAt(0)}</Text>
          </LinearGradient>
        ))}
        {remaining > 0 && (
          <View style={[styles.stackAvatar, styles.stackAvatarMore, { marginLeft: -12, zIndex: 0 }]}>
            <Text style={styles.stackAvatarMoreText}>+{remaining}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#667eea" />
    </TouchableOpacity>
  );
};

// ==================== MAIN COMPONENT ====================

export default function EditProfileScreen({ navigation, route }: EditProfileScreenProps) {
  const { mode = 'baby', babyId } = route.params || { mode: 'baby' };
  
  const { userProfile } = useAuth();
  const { profile } = useUser();
  const { 
    babies, 
    updateBaby, 
    currentBaby,
    currentBabyId,
    addGrowthMeasurement,
    getGrowthData,
    getLatestMeasurements,
    deleteGrowthMeasurement,
    addMilestone,
    getMilestones,
    deleteMilestone,
    getBabyStats,
    getPottyStreak,
    loadBabies,
    switchBaby,
    deleteBaby,
    growthData,
    milestones,
    activities: babyActivities,
  } = useBaby();
  
  // FIXED: Added useActivity hook for proper activity data
  const { 
    entries: allActivities, 
    getRecentTimelineEvents,
    getEntriesByBaby,
    getDateTitle,
  } = useActivity();
  
  const { 
    members, 
    loadFamily, 
    parent1, 
    parent2, 
    guardians,
    removeMember,
  } = useFamily();
  
  const isBabyMode = mode === 'baby';
  
  // FIXED: Properly get current baby data
  const currentBabyData = useMemo(() => {
    if (!isBabyMode) return null;
    if (babyId) {
      return babies.find(b => b.id === babyId) || currentBaby;
    }
    return currentBaby;
  }, [isBabyMode, babyId, babies, currentBaby]);

  // Form states
  const [babyName, setBabyName] = useState(currentBabyData?.name || '');
  const [selectedSkin, setSelectedSkin] = useState(currentBabyData?.skinTone || 2);
  const [selectedGender, setSelectedGender] = useState(currentBabyData?.gender || 'boy');
  const [birthDate, setBirthDate] = useState(currentBabyData ? new Date(currentBabyData.birthDate) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [babyPhoto, setBabyPhoto] = useState<string | null>(currentBabyData?.avatar || null);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'growth' | 'milestones' | 'health'>('overview');
  
  // Health info
  const [bloodType, setBloodType] = useState(currentBabyData?.bloodType || '');
  const [allergies, setAllergies] = useState(currentBabyData?.allergies?.join(', ') || '');
  const [medicalNotes, setMedicalNotes] = useState(currentBabyData?.medicalNotes || '');

  // Growth chart state
  const [activeGrowthTab, setActiveGrowthTab] = useState<'height' | 'weight' | 'head'>('height');
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [newMeasurement, setNewMeasurement] = useState({
    value: '',
    unit: 'cm',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Milestone state
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    category: 'physical' as Milestone['category'],
    description: '',
    achievedAt: new Date().toISOString().split('T')[0],
  });

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [1, 0], Extrapolate.CLAMP),
  }));

  // FIXED: Update form states when baby data changes
  useEffect(() => {
    if (currentBabyData) {
      setBabyName(currentBabyData.name || '');
      setSelectedSkin(currentBabyData.skinTone || 2);
      setSelectedGender(currentBabyData.gender || 'boy');
      setBirthDate(new Date(currentBabyData.birthDate));
      setBabyPhoto(currentBabyData.avatar || null);
      setBloodType(currentBabyData.bloodType || '');
      setAllergies(currentBabyData.allergies?.join(', ') || '');
      setMedicalNotes(currentBabyData.medicalNotes || '');
    }
  }, [currentBabyData?.id]);

  // Update unit when tab changes
  useEffect(() => {
    const defaultUnits = {
      height: 'cm',
      weight: 'kg',
      head: 'cm',
      temperature: '°C',
    };
    setNewMeasurement(prev => ({ ...prev, unit: defaultUnits[activeGrowthTab] }));
  }, [activeGrowthTab]);

  // FIXED: Refresh data with proper loading
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadBabies(),
      loadFamily(),
    ]);
    setRefreshing(false);
  }, [loadBabies, loadFamily]);

  // ==================== PHOTO UPLOAD ====================

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        setBabyPhoto(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        setBabyPhoto(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      setIsUploading(false);
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Change Photo',
      'Choose a photo source',
      [
        { text: 'Camera', onPress: handleTakePhoto },
        { text: 'Photo Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ==================== DATA MEMOS - FIXED ====================

  // FIXED: Get activities from useActivity context instead of baby context
  const recentActivities = useMemo(() => {
    if (!currentBabyData?.id) return [];
    // Get activities for current baby from ActivityContext
    const babyActivities = getEntriesByBaby(currentBabyData.id);
    return babyActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [allActivities, currentBabyData?.id, getEntriesByBaby]);

  const latestMeasurements = useMemo(() => {
    if (!currentBabyData?.id) return { height: null, weight: null, head: null, temperature: null };
    // Get measurements from growthData filtered by current baby
    const babyGrowth = growthData.filter(g => g.babyId === currentBabyData.id);
    const types = ['height', 'weight', 'head', 'temperature'] as const;
    const latest: Record<string, GrowthMeasurement | null> = {};
    
    types.forEach(type => {
      const typeData = babyGrowth
        .filter(m => m.type === type)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      latest[type] = typeData[0] || null;
    });
    
    return latest;
  }, [growthData, currentBabyData?.id]);

  const babyMilestones = useMemo(() => {
    if (!currentBabyData?.id) return [];
    return milestones
      .filter(m => m.babyId === currentBabyData.id)
      .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }, [milestones, currentBabyData?.id]);

  const babyStats = useMemo(() => {
    if (!currentBabyData) return null;
    return {
      streak: currentBabyData.streak || 0,
      milestones: babyMilestones.length,
      photos: currentBabyData.photos || 0,
      entries: recentActivities.length,
    };
  }, [currentBabyData, babyMilestones.length, recentActivities.length]);

  // FIXED: Get family members for current baby's family
  const familyMembers = useMemo(() => {
    const membersList: FamilyMember[] = [];
    
    // Add Parent 1 (current user)
    if (userProfile) {
      membersList.push({
        id: userProfile.id,
        userId: userProfile.id,
        fullName: userProfile.fullName,
        email: userProfile.email,
        avatar: userProfile.avatar,
        role: 'parent1',
        relationship: 'Parent',
        permissions: { read: true, write: true, delete: true, manageFamily: true, manageSecurity: true, exportData: true },
        addedAt: currentBabyData?.createdAt || new Date().toISOString(),
        addedBy: userProfile.id,
        canBeRemoved: false,
        phoneNumber: userProfile.phoneNumber,
        notificationsEnabled: true,
      });
    }
    
    // Add Parent 2 if exists
    if (parent2) {
      membersList.push(parent2);
    }
    
    // Add guardians
    if (guardians && guardians.length > 0) {
      membersList.push(...guardians);
    }
    
    return membersList;
  }, [userProfile, parent2, guardians, currentBabyData?.createdAt]);

  // ==================== CHART DATA ====================

  const getChartData = useCallback(() => {
    if (!currentBabyData?.id) return getDefaultGrowthData(activeGrowthTab);
    
    const babyGrowth = growthData.filter(g => g.babyId === currentBabyData.id && g.type === activeGrowthTab);
    if (babyGrowth.length === 0) {
      return getDefaultGrowthData(activeGrowthTab);
    }
    
    const sorted = [...babyGrowth].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7);
    
    return {
      labels: sorted.map(d => {
        const date = new Date(d.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [{
        data: sorted.map(d => d.value),
        color: () => GROWTH_COLORS[activeGrowthTab],
      }],
    };
  }, [growthData, activeGrowthTab, currentBabyData?.id]);

  const getDefaultGrowthData = (type: 'height' | 'weight' | 'head') => {
    const defaults = {
      height: {
        labels: ['0m', '3m', '6m', '9m', '12m', '15m', '18m'],
        datasets: [{ data: [50, 61, 67, 72, 76, 79, 82], color: () => GROWTH_COLORS.height }],
      },
      weight: {
        labels: ['0m', '3m', '6m', '9m', '12m', '15m', '18m'],
        datasets: [{ data: [3.5, 6.0, 7.8, 8.9, 9.8, 10.5, 11.2], color: () => GROWTH_COLORS.weight }],
      },
      head: {
        labels: ['0m', '3m', '6m', '9m', '12m', '15m', '18m'],
        datasets: [{ data: [35, 40, 43, 45, 47, 48, 49], color: () => GROWTH_COLORS.head }],
      },
    };
    return defaults[type];
  };

  const formatMeasurementValue = (measurement: GrowthMeasurement | null) => {
    if (!measurement) return '--';
    return `${measurement.value} ${measurement.unit}`;
  };

  const calculateChange = (type: 'height' | 'weight' | 'head') => {
    if (!currentBabyData?.id) return null;
    const babyGrowth = growthData.filter(g => g.babyId === currentBabyData.id && g.type === type);
    if (babyGrowth.length < 2) return null;
    
    const sorted = [...babyGrowth].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0];
    const previous = sorted[1];
    const change = latest.value - previous.value;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)} ${latest.unit}`;
  };

  // ==================== SAVE HANDLERS ====================

  const handleSave = async () => {
    try {
      if (!currentBabyData) return;

      const babyUpdates: any = {
        name: babyName,
        skinTone: selectedSkin,
        gender: selectedGender,
        birthDate: birthDate.toISOString(),
        avatar: babyPhoto,
        bloodType,
        allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
        medicalNotes,
        lastUpdated: new Date().toISOString(),
      };

      await updateBaby(currentBabyData.id, babyUpdates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Baby profile updated successfully!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleAddMeasurement = async () => {
    if (!currentBabyData || !newMeasurement.value) return;

    const success = await addGrowthMeasurement({
      babyId: currentBabyData.id,
      type: activeGrowthTab,
      value: parseFloat(newMeasurement.value),
      unit: newMeasurement.unit as any,
      date: newMeasurement.date,
      notes: newMeasurement.notes,
      recordedBy: userProfile?.id || '',
    });

    if (success) {
      setShowAddMeasurement(false);
      setNewMeasurement({
        value: '',
        unit: activeGrowthTab === 'weight' ? 'kg' : 'cm',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleAddMilestone = async () => {
    if (!currentBabyData || !newMilestone.title) return;

    const success = await addMilestone({
      babyId: currentBabyData.id,
      title: newMilestone.title,
      category: newMilestone.category,
      description: newMilestone.description,
      achievedAt: newMilestone.achievedAt,
    });

    if (success) {
      setShowAddMilestone(false);
      setNewMilestone({
        title: '',
        category: 'physical',
        description: '',
        achievedAt: new Date().toISOString().split('T')[0],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleDeleteMeasurement = (measurementId: string) => {
    Alert.alert(
      'Delete Measurement',
      'Are you sure you want to delete this measurement?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteGrowthMeasurement(measurementId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      ]
    );
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    Alert.alert(
      'Delete Milestone',
      'Are you sure you want to delete this milestone?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteMilestone(milestoneId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      ]
    );
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const chartConfig = {
    backgroundGradientFrom: 'rgba(255,255,255,0)',
    backgroundGradientTo: 'rgba(255,255,255,0)',
    color: () => GROWTH_COLORS[activeGrowthTab],
    strokeWidth: 3,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
    propsForLabels: { fontSize: 12, fontWeight: '600', color: isDark ? '#fff' : '#333' },
    propsForDots: { r: '6', strokeWidth: '2', stroke: '#fff' },
  };

  // ==================== RENDER SECTIONS - FIXED STYLING ====================

  const renderHeader = () => (
    <Animated.View style={[styles.header, headerOpacity, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>
          {currentBabyData?.name || 'Baby Profile'}
        </Text>
        
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderTabs = () => (
    <View style={[styles.tabBar, { top: insets.top + 70 }]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(30,30,40,0.98)', 'rgba(20,20,30,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tabContainer}>
        {[
          { id: 'overview', icon: 'grid-outline', label: 'Overview' },
          { id: 'growth', icon: 'trending-up-outline', label: 'Growth' },
          { id: 'milestones', icon: 'trophy-outline', label: 'Milestones' },
          { id: 'health', icon: 'medical-outline', label: 'Health' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id as typeof activeTab);
              }}
            >
              <View style={[styles.tabBg, isActive && { backgroundColor: isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)' }]}>
                <Ionicons 
                  name={tab.icon as any} 
                  size={18} 
                  color={isActive ? '#667eea' : isDark ? '#94a3b8' : '#64748b'} 
                />
                <Text style={[
                  styles.tabLabel, 
                  isActive && styles.tabLabelActive,
                  isDark && !isActive && styles.textMuted
                ]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderPhotoSection = () => {
    return (
      <View style={styles.photoSection}>
        <SafeBabyAvatar 
          avatar={babyPhoto}
          gender={selectedGender}
          size={130}
          showEditButton
          onEdit={showImagePickerOptions}
        />
        
        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
        
        <Text style={[styles.photoHint, isDark && styles.textMuted]}>Tap to change photo</Text>
      </View>
    );
  };

  const renderQuickStats = () => (
    <GlassCard style={styles.statsCard} delay={100}>
      <View style={styles.statsRow}>
        <StatBadge icon="🔥" value={getPottyStreak()} label="Day Streak" color="#fa709a" />
        <StatBadge icon="🌟" value={babyStats?.milestones || 0} label="Milestones" color="#f59e0b" />
        <StatBadge icon="📸" value={babyStats?.photos || 0} label="Photos" color="#8b5cf6" />
      </View>
      
      {(latestMeasurements.height || latestMeasurements.weight) && (
        <View style={styles.quickMeasurements}>
          {latestMeasurements.height && (
            <View style={styles.quickStat}>
              <Ionicons name="resize-outline" size={18} color="#667eea" />
              <Text style={[styles.quickStatValue, isDark && styles.textDark]}>
                {formatMeasurementValue(latestMeasurements.height)}
              </Text>
              <Text style={styles.quickStatLabel}>Height</Text>
            </View>
          )}
          {latestMeasurements.weight && (
            <View style={styles.quickStat}>
              <Ionicons name="scale-outline" size={18} color="#fa709a" />
              <Text style={[styles.quickStatValue, isDark && styles.textDark]}>
                {formatMeasurementValue(latestMeasurements.weight)}
              </Text>
              <Text style={styles.quickStatLabel}>Weight</Text>
            </View>
          )}
        </View>
      )}
    </GlassCard>
  );

  const renderBasicInfoForm = () => (
    <GlassCard style={styles.formCard} delay={200}>
      <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Basic Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Baby's Name</Text>
        <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
          <Ionicons name="heart-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={babyName}
            onChangeText={setBabyName}
            placeholder="Enter name"
            placeholderTextColor={isDark ? '#666' : '#999'}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Birth Date</Text>
        <TouchableOpacity 
          style={[styles.inputContainer, isDark && styles.inputContainerDark]}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <Text style={[styles.input, isDark && styles.inputDark]}>
            {birthDate.toLocaleDateString()}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Gender</Text>
        <View style={styles.genderContainer}>
          {GENDER_OPTIONS.map((gender) => (
            <TouchableOpacity
              key={gender.value}
              style={[
                styles.genderButton,
                selectedGender === gender.value && { 
                  borderColor: gender.color, 
                  backgroundColor: isDark ? `${gender.color}25` : `${gender.color}12` 
                },
                isDark && styles.genderButtonDark,
              ]}
              onPress={() => setSelectedGender(gender.value as any)}
            >
              <Ionicons 
                name={gender.icon as any} 
                size={28} 
                color={selectedGender === gender.value ? gender.color : isDark ? '#94a3b8' : '#64748b'} 
              />
              <Text style={[
                styles.genderText,
                selectedGender === gender.value && { color: gender.color, fontWeight: '700' },
                isDark && styles.genderTextDark,
              ]}>
                {gender.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Skin Tone</Text>
        <View style={styles.skinContainer}>
          {SKIN_TONES.map((skin, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.skinButton, 
                selectedSkin === index && styles.skinButtonActive,
                { backgroundColor: skin.color }
              ]}
              onPress={() => setSelectedSkin(index)}
            >
              {selectedSkin === index && (
                <Ionicons name="checkmark" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </GlassCard>
  );

  // ==================== GROWTH TAB - FIXED ====================

  const renderGrowthPreview = () => {
    const chartData = getChartData();
    const hasRealData = growthData.filter(g => g.babyId === currentBabyData?.id && g.type === activeGrowthTab).length > 0;
    
    return (
      <Animated.View entering={FadeInUp} style={styles.tabPanel}>
        {/* Summary Cards - Fixed spacing and styling */}
        <View style={styles.growthSummaryRow}>
          <GlassCard style={styles.growthSummaryCard} intensity={95} delay={100}>
            <View style={[styles.growthIconBg, { backgroundColor: `${GROWTH_COLORS.height}18` }]}>
              <Ionicons name="resize-outline" size={26} color={GROWTH_COLORS.height} />
            </View>
            <Text style={[styles.growthValue, isDark && styles.textDark]}>
              {formatMeasurementValue(latestMeasurements.height)}
            </Text>
            <Text style={styles.growthLabel}>Height</Text>
            {calculateChange('height') && (
              <Text style={[styles.growthChange, { color: '#11998e' }]}>
                {calculateChange('height')}
              </Text>
            )}
          </GlassCard>
          
          <GlassCard style={styles.growthSummaryCard} intensity={95} delay={200}>
            <View style={[styles.growthIconBg, { backgroundColor: `${GROWTH_COLORS.weight}18` }]}>
              <Ionicons name="scale-outline" size={26} color={GROWTH_COLORS.weight} />
            </View>
            <Text style={[styles.growthValue, isDark && styles.textDark]}>
              {formatMeasurementValue(latestMeasurements.weight)}
            </Text>
            <Text style={styles.growthLabel}>Weight</Text>
            {calculateChange('weight') && (
              <Text style={[styles.growthChange, { color: '#11998e' }]}>
                {calculateChange('weight')}
              </Text>
            )}
          </GlassCard>
          
          <GlassCard style={styles.growthSummaryCard} intensity={95} delay={300}>
            <View style={[styles.growthIconBg, { backgroundColor: `${GROWTH_COLORS.head}18` }]}>
              <Ionicons name="analytics-outline" size={26} color={GROWTH_COLORS.head} />
            </View>
            <Text style={[styles.growthValue, isDark && styles.textDark]}>
              {formatMeasurementValue(latestMeasurements.head)}
            </Text>
            <Text style={styles.growthLabel}>Head</Text>
            {calculateChange('head') && (
              <Text style={[styles.growthChange, { color: '#11998e' }]}>
                {calculateChange('head')}
              </Text>
            )}
          </GlassCard>
        </View>

        {/* Growth Chart Preview */}
        <GlassCard style={styles.chartCard} intensity={95} delay={400}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, isDark && styles.textDark]}>Growth Overview</Text>
            <TouchableOpacity 
              style={styles.viewFullChartBtn}
              onPress={() => navigation.navigate('GrowthChart', { babyId: currentBabyData?.id })}
            >
              <Text style={styles.viewFullChartText}>View Full Chart</Text>
              <Ionicons name="arrow-forward" size={16} color="#667eea" />
            </TouchableOpacity>
          </View>
          
          <LineChart
            data={chartData}
            width={width - 88}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withVerticalLines={false}
            withHorizontalLines={true}
            withHorizontalLabels={true}
            withVerticalLabels={true}
            withDots={true}
            withShadow={false}
          />
          
          {!hasRealData && (
            <View style={styles.sampleDataOverlay}>
              <Text style={[styles.sampleDataText, isDark && styles.textMuted]}>
                Sample data - add measurements to see real growth
              </Text>
            </View>
          )}
        </GlassCard>

        {/* Add Measurement Button */}
        <TouchableOpacity 
          style={styles.addMeasurementBtn}
          onPress={() => setShowAddMeasurement(true)}
        >
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addMeasurementGradient}>
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.addMeasurementText}>Add Measurement</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Recent Entries */}
        <Text style={[styles.measurementsTitle, isDark && styles.textDark]}>
          Recent Measurements
        </Text>
        
        {(() => {
          const babyGrowth = growthData.filter(g => g.babyId === currentBabyData?.id && g.type === activeGrowthTab);
          if (babyGrowth.length === 0) {
            return (
              <GlassCard style={styles.emptyCard} intensity={90} delay={500}>
                <Ionicons name="analytics-outline" size={56} color={isDark ? '#475569' : '#cbd5e1'} />
                <Text style={[styles.emptyText, isDark && styles.textMuted]}>
                  No measurements yet. Add your first!
                </Text>
              </GlassCard>
            );
          }
          return babyGrowth
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map((entry, index) => (
            <GlassCard key={entry.id} style={styles.entryCard} intensity={90} delay={500 + index * 100}>
              <View style={styles.entryRow}>
                <View style={[styles.entryIconBg, { backgroundColor: `${GROWTH_COLORS[entry.type]}18` }]}>
                  <Ionicons 
                    name={entry.type === 'height' ? 'resize-outline' : entry.type === 'weight' ? 'scale-outline' : 'analytics-outline'} 
                    size={24} 
                    color={GROWTH_COLORS[entry.type]} 
                  />
                </View>
                <View style={styles.entryContent}>
                  <Text style={[styles.entryType, isDark && styles.textDark]}>
                    {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                  </Text>
                  <Text style={[styles.entryDate, isDark && styles.textMuted]}>
                    {format(new Date(entry.date), 'MMM d, yyyy')}
                  </Text>
                </View>
                <View style={styles.entryValues}>
                  <Text style={styles.entryValue}>
                    {entry.value} {entry.unit}
                  </Text>
                  {entry.notes && (
                    <Text style={styles.entryNotes} numberOfLines={1}>
                      {entry.notes}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteMeasurement(entry.id)} style={styles.deleteEntryBtn}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </GlassCard>
          ));
        })()}
      </Animated.View>
    );
  };

  // ==================== MILESTONES TAB - FIXED ====================

  const renderMilestones = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <TouchableOpacity 
        style={styles.addMilestoneBtn}
        onPress={() => setShowAddMilestone(true)}
      >
        <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.addMilestoneGradient}>
          <Ionicons name="trophy" size={22} color="#fff" />
          <Text style={styles.addMilestoneText}>Record Milestone</Text>
        </LinearGradient>
      </TouchableOpacity>

      {babyMilestones.length === 0 ? (
        <GlassCard style={styles.emptyCard} intensity={90} delay={100}>
          <Ionicons name="trophy-outline" size={56} color={isDark ? '#475569' : '#cbd5e1'} />
          <Text style={[styles.emptyText, isDark && styles.textMuted]}>
            No milestones recorded yet. Celebrate your baby's achievements!
          </Text>
        </GlassCard>
      ) : (
        babyMilestones.map((milestone, index) => {
          const category = MILESTONE_CATEGORIES.find(c => c.id === milestone.category);
          return (
            <GlassCard key={milestone.id} style={styles.milestoneCard} intensity={90} delay={100 + index * 100}>
              <View style={styles.milestoneRow}>
                <LinearGradient 
                  colors={[category?.color || '#667eea', `${category?.color}90` || '#764ba2']} 
                  style={styles.milestoneIcon}
                >
                  <Ionicons name={category?.icon as any || 'star'} size={22} color="#fff" />
                </LinearGradient>
                <View style={styles.milestoneContent}>
                  <Text style={[styles.milestoneTitle, isDark && styles.textDark]} numberOfLines={1}>
                    {milestone.title}
                  </Text>
                  <Text style={[styles.milestoneCategory, { color: category?.color }]}>
                    {category?.label}
                  </Text>
                  <Text style={[styles.milestoneDate, isDark && styles.textMuted]}>
                    {format(new Date(milestone.achievedAt), 'MMM d, yyyy')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteMilestone(milestone.id)} style={styles.deleteEntryBtn}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {milestone.description && (
                <Text style={[styles.milestoneDescription, isDark && styles.textMuted]}>
                  {milestone.description}
                </Text>
              )}
            </GlassCard>
          );
        })
      )}
    </Animated.View>
  );

  // ==================== HEALTH TAB - FIXED NAVIGATION ====================

  const renderHealthForm = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.formCard} delay={100}>
        <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Health Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Blood Type</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="water-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={bloodType}
              onChangeText={setBloodType}
              placeholder="e.g., O+"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Allergies (comma separated)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="warning-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g., Peanuts, Dairy"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Medical Notes</Text>
          <TextInput
            style={[
              styles.textArea,
              isDark && styles.textAreaDark,
            ]}
            value={medicalNotes}
            onChangeText={setMedicalNotes}
            placeholder="Any important medical information..."
            multiline
            numberOfLines={4}
            placeholderTextColor={isDark ? '#666' : '#999'}
          />
        </View>
      </GlassCard>

      {/* Quick Links - FIXED: Updated navigation targets */}
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Quick Actions</Text>
      
      <GlassCard style={styles.actionCard} delay={200} onPress={() => navigation.navigate('UniversalTracker', { type: 'medication' })}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#ef444418' }]}>
            <Ionicons name="medical-outline" size={26} color="#ef4444" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Medications</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>Track medications & dosages</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>

      <GlassCard style={styles.actionCard} delay={300} onPress={() => navigation.navigate('UniversalTracker', { type: 'sleep' })}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#3b82f618' }]}>
            <Ionicons name="moon-outline" size={26} color="#3b82f6" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Sleep Tracking</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>Monitor sleep patterns</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>

      <GlassCard style={styles.actionCard} delay={400} onPress={() => navigation.navigate('UniversalTracker', { type: 'feed' })}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#f59e0b18' }]}>
            <Ionicons name="restaurant-outline" size={26} color="#f59e0b" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Feeding Log</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>Record meals & nutrition</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>

      <GlassCard style={styles.actionCard} delay={500} onPress={() => navigation.navigate('UniversalTracker', { type: 'potty' })}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#8b5cf618' }]}>
            <Ionicons name="water-outline" size={26} color="#8b5cf6" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Potty Training</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>Track potty habits & streaks</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>
    </Animated.View>
  );

  // ==================== OVERVIEW TAB - FIXED ====================

  const renderOverview = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      {renderPhotoSection()}
      {renderQuickStats()}
      {renderBasicInfoForm()}
      
      {/* Growth Preview Link */}
      <GlassCard style={styles.growthPreviewCard} delay={250} onPress={() => setActiveTab('growth')}>
        <View style={styles.growthPreviewRow}>
          <View style={[styles.growthPreviewIconBg, { backgroundColor: '#667eea18' }]}>
            <Ionicons name="trending-up-outline" size={28} color="#667eea" />
          </View>
          <View style={styles.growthPreviewContent}>
            <Text style={[styles.growthPreviewTitle, isDark && styles.textDark]}>Growth Tracking</Text>
            <Text style={[styles.growthPreviewSubtitle, isDark && styles.textMuted]}>
              {growthData.filter(g => g.babyId === currentBabyData?.id).length} measurements recorded
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>

      {/* Family Members - FIXED: Using computed familyMembers */}
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Family</Text>
      <GlassCard style={styles.familyCard} delay={300} onPress={() => navigation.navigate('FamilySharing')}>
        <View style={styles.familyRow}>
          <View style={styles.familyAvatars}>
            {familyMembers.slice(0, 3).map((member, index) => (
              <LinearGradient
                key={member.id}
                colors={member.role === 'parent1' ? ['#667eea', '#764ba2'] : member.role === 'parent2' ? ['#fa709a', '#fee140'] : ['#11998e', '#38ef7d']}
                style={[styles.familyAvatar, { marginLeft: index > 0 ? -10 : 0 }]}
              >
                <Text style={styles.familyAvatarText}>{member.fullName.charAt(0)}</Text>
              </LinearGradient>
            ))}
            {familyMembers.length > 3 && (
              <View style={[styles.familyAvatar, styles.familyAvatarMore, { marginLeft: -10 }]}>
                <Text style={styles.familyAvatarMoreText}>+{familyMembers.length - 3}</Text>
              </View>
            )}
          </View>
          <View style={styles.familyContent}>
            <Text style={[styles.familyTitle, isDark && styles.textDark]}>Family Members</Text>
            <Text style={[styles.familySubtitle, isDark && styles.textMuted]}>{familyMembers.length} people</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>

      {/* Recent Activity - FIXED: Using activities from useActivity */}
      {recentActivities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Timeline')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.activityCard} intensity={90} delay={400}>
            {recentActivities.slice(0, 3).map((activity) => (
              <ActivityItem key={activity.id} activity={activity} isDark={isDark} />
            ))}
          </GlassCard>
        </View>
      )}
    </Animated.View>
  );

  // ==================== MODALS - FIXED CENTERED MODAL ====================

  const renderAddMeasurementModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showAddMeasurement}
      onRequestClose={() => setShowAddMeasurement(false)}
    >
      <View style={styles.centeredModalOverlay}>
        <BlurView intensity={100} style={styles.centeredModalContent} tint={isDark ? 'dark' : 'light'}>
          <LinearGradient
            colors={isDark ? ['rgba(45,45,55,0.95)', 'rgba(25,25,35,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.centeredModalHeader}>
            <Text style={[styles.centeredModalTitle, isDark && styles.textDark]}>
              Add {activeGrowthTab.charAt(0).toUpperCase() + activeGrowthTab.slice(1)}
            </Text>
            <TouchableOpacity onPress={() => setShowAddMeasurement(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.centeredModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Value</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.modalInput, isDark && styles.modalInputDark, { flex: 2, marginRight: 12 }]}
                  value={newMeasurement.value}
                  onChangeText={(text) => setNewMeasurement(prev => ({ ...prev, value: text }))}
                  placeholder="0.0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={isDark ? '#666' : '#999'}
                />
                <View style={[styles.unitSelector, isDark && styles.unitSelectorDark]}>
                  {UNITS[activeGrowthTab].map(unit => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitOption,
                        newMeasurement.unit === unit && styles.unitOptionActive
                      ]}
                      onPress={() => setNewMeasurement(prev => ({ ...prev, unit }))}
                    >
                      <Text style={[
                        styles.unitText,
                        newMeasurement.unit === unit && styles.unitTextActive
                      ]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Date</Text>
              <TouchableOpacity 
                style={[styles.inputContainer, isDark && styles.inputContainerDark]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#667eea" />
                <Text style={[styles.input, isDark && styles.inputDark, { marginLeft: 12 }]}>
                  {newMeasurement.date}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Notes (Optional)</Text>
              <TextInput
                style={[styles.modalInput, isDark && styles.modalInputDark, { height: 90, textAlignVertical: 'top' }]}
                value={newMeasurement.notes}
                onChangeText={(text) => setNewMeasurement(prev => ({ ...prev, notes: text }))}
                placeholder="Add any notes..."
                multiline
                placeholderTextColor={isDark ? '#666' : '#999'}
              />
            </View>

            <TouchableOpacity style={styles.modalAddButton} onPress={handleAddMeasurement}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.modalAddButtonGradient}>
                <Text style={styles.modalAddButtonText}>Add Measurement</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );

  const renderAddMilestoneModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showAddMilestone}
      onRequestClose={() => setShowAddMilestone(false)}
    >
      <View style={styles.centeredModalOverlay}>
        <BlurView intensity={100} style={styles.centeredModalContent} tint={isDark ? 'dark' : 'light'}>
          <LinearGradient
            colors={isDark ? ['rgba(45,45,55,0.95)', 'rgba(25,25,35,0.85)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.centeredModalHeader}>
            <Text style={[styles.centeredModalTitle, isDark && styles.textDark]}>Record Milestone</Text>
            <TouchableOpacity onPress={() => setShowAddMilestone(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.centeredModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Title</Text>
              <TextInput
                style={[styles.modalInput, isDark && styles.modalInputDark]}
                value={newMilestone.title}
                onChangeText={(text) => setNewMilestone(prev => ({ ...prev, title: text }))}
                placeholder="e.g., First Steps"
                placeholderTextColor={isDark ? '#666' : '#999'}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Category</Text>
              <View style={styles.categoryContainer}>
                {MILESTONE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryButton,
                      newMilestone.category === cat.id && { 
                        backgroundColor: isDark ? `${cat.color}30` : `${cat.color}18`, 
                        borderColor: cat.color 
                      },
                      isDark && styles.categoryButtonDark,
                    ]}
                    onPress={() => setNewMilestone(prev => ({ ...prev, category: cat.id as any }))}
                  >
                    <Ionicons name={cat.icon as any} size={20} color={newMilestone.category === cat.id ? cat.color : isDark ? '#94a3b8' : '#64748b'} />
                    <Text style={[
                      styles.categoryText,
                      newMilestone.category === cat.id && { color: cat.color, fontWeight: '700' },
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Date Achieved</Text>
              <TouchableOpacity 
                style={[styles.inputContainer, isDark && styles.inputContainerDark]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#667eea" />
                <Text style={[styles.input, isDark && styles.inputDark, { marginLeft: 12 }]}>
                  {newMilestone.achievedAt}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalInput, isDark && styles.modalInputDark, { height: 90, textAlignVertical: 'top' }]}
                value={newMilestone.description}
                onChangeText={(text) => setNewMilestone(prev => ({ ...prev, description: text }))}
                placeholder="Add details about this milestone..."
                multiline
                placeholderTextColor={isDark ? '#666' : '#999'}
              />
            </View>

            <TouchableOpacity style={styles.modalAddButton} onPress={handleAddMilestone}>
              <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.modalAddButtonGradient}>
                <Text style={styles.modalAddButtonText}>Record Milestone</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );

  // ==================== MAIN RENDER ====================

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} 
        style={styles.bg} 
      />

      {renderHeader()}
      {renderTabs()}

      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140, paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'growth' && renderGrowthPreview()}
        {activeTab === 'milestones' && renderMilestones()}
        {activeTab === 'health' && renderHealthForm()}
        
        {/* Delete Button */}
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => Alert.alert(
            'Delete Profile',
            `Are you sure you want to delete ${currentBabyData?.name}'s profile? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                  if (currentBabyData) {
                    await deleteBaby(currentBabyData.id);
                    navigation.goBack();
                  }
                }
              }
            ]
          )}
        >
          <Text style={styles.deleteText}>Delete Baby Profile</Text>
        </TouchableOpacity>
      </AnimatedScrollView>

      {renderAddMeasurementModal()}
      {renderAddMilestoneModal()}
    </View>
  );
}

// ==================== STYLES - EXACTLY MATCHING PROFILESCREEN ====================

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { paddingHorizontal: 16 },
  
  // Header - EXACTLY like ProfileScreen
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(102,126,234,0.12)',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#667eea',
  },

  // Tab Bar - EXACTLY like ProfileScreen
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1 },
  tabBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '700',
  },

  // Glass Card - EXACTLY like ProfileScreen
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  glassBorderDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  glassContent: { flex: 1 },

  // Safe Baby Avatar
  avatarWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {},
  editAvatarBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editAvatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Photo Section
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // Stats - EXACTLY like ProfileScreen
  statsCard: { padding: 0 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
  },
  statBadge: { alignItems: 'center', gap: 6 },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 22,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickMeasurements: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingTop: 16,
    paddingBottom: 20,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.08)',
  },
  quickStat: { alignItems: 'center', gap: 6 },
  quickStatValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },

  // Form
  formCard: { padding: 0 },
  sectionLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 24,
    marginTop: 4,
    letterSpacing: -0.3,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputGroup: { marginBottom: 20, paddingHorizontal: 20 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  inputContainerDark: { 
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputIcon: { marginRight: 14 },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#1e293b',
    fontWeight: '600',
  },
  inputDark: { color: '#ffffff' },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
    paddingTop: 18,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 18,
    paddingHorizontal: 18,
    fontSize: 17,
    color: '#1e293b',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  textAreaDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    color: '#ffffff',
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Gender
  genderContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  genderButton: {
    flex: 1,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  genderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 10,
  },
  genderTextDark: { color: '#94a3b8' },

  // Skin
  skinContainer: { flexDirection: 'row', gap: 14, justifyContent: 'center', paddingHorizontal: 20 },
  skinButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  skinButtonActive: { borderColor: '#fff', transform: [{ scale: 1.1 }] },

  // Tab Panel
  tabPanel: { marginTop: 12, gap: 16 },

  // Growth Preview Card
  growthPreviewCard: { padding: 0 },
  growthPreviewRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  growthPreviewIconBg: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  growthPreviewContent: { flex: 1 },
  growthPreviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  growthPreviewSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 14,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // Family Card
  familyCard: { padding: 0 },
  familyRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  familyAvatars: { flexDirection: 'row', marginRight: 16 },
  familyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  familyAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  familyAvatarMore: {
    backgroundColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyAvatarMoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  familyContent: { flex: 1 },
  familyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 3,
  },
  familySubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // Activity - EXACTLY like ProfileScreen
  activityCard: { padding: 16 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.08)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityEmoji: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // Family Avatar Stack
  avatarStackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stackAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stackAvatarMore: {
    backgroundColor: '#64748b',
  },
  stackAvatarMoreText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Growth Tab - FIXED STYLING
  growthSummaryRow: { 
    flexDirection: 'row', 
    gap: 12,
  },
  growthSummaryCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  growthIconBg: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  growthValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 4,
  },
  growthLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  growthChange: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },

  chartCard: { padding: 20 },
  chart: { borderRadius: 20, marginLeft: -10 },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  viewFullChartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  viewFullChartText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#667eea',
  },
  sampleDataOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  sampleDataText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  addMeasurementBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addMeasurementGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  addMeasurementText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  measurementsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    marginTop: 12,
    letterSpacing: -0.3,
  },

  emptyCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },

  entryCard: { padding: 0 },
  entryRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  entryIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  entryContent: { flex: 1 },
  entryType: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  entryDate: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  entryValues: { alignItems: 'flex-end', marginRight: 14 },
  entryValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#667eea',
  },
  entryNotes: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 3,
    maxWidth: 110,
    fontWeight: '500',
  },
  deleteEntryBtn: { padding: 6 },

  // Milestones
  addMilestoneBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addMilestoneGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  addMilestoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  milestoneCard: { padding: 0, marginBottom: 12 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  milestoneIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  milestoneContent: { flex: 1 },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 3,
  },
  milestoneCategory: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 3,
  },
  milestoneDate: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  milestoneDescription: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 10,
    lineHeight: 20,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Health Tab
  actionCard: { padding: 0, marginBottom: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  actionIconBg: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionContent: { flex: 1 },
  actionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // Modal - FIXED CENTERED MODAL
  centeredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredModalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  centeredModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  centeredModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredModalBody: { 
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalInput: {
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 18,
    padding: 18,
    fontSize: 17,
    color: '#1e293b',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  modalInputDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    color: '#ffffff',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  unitSelectorDark: { 
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  unitOption: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
  },
  unitOptionActive: { backgroundColor: '#667eea' },
  unitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  unitTextActive: { color: '#ffffff' },

  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryButtonDark: { backgroundColor: 'rgba(30,30,40,0.5)' },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  modalAddButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 12,
  },
  modalAddButtonGradient: {
    padding: 20,
    alignItems: 'center',
  },
  modalAddButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },

  // Delete
  deleteButton: {
    marginTop: 32,
    marginBottom: 50,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
});