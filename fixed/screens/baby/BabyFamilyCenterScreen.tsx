import { StyleSheet,ActionSheetIOS, ActivityIndicator , Dimensions ,Image, Modal ,RefreshControl, ScrollView, Switch, TextInput, TouchableOpacity ,useColorScheme, View, Platform, StatusBar, Text } from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { FamilyMember, useFamily } from '../../context/FamilyContext';
import { Milestone, useBaby } from '../../context/BabyContext';
import { showConfirmModal, showErrorModal, showSuccessModal } from '../../utils/modal';
import { useActivity } from '../../context/ActivityContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import Animated, {

  FadeInUp,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

// ─── SHARED DESIGN TOKENS ───────────────────────────────────────────
const DESIGN = {
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    full: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  },
  tab: {
    height: 44,
    pillRadius: 12,
    activeBg: 'rgba(102,126,234,0.12)',
    inactiveBg: 'transparent',
    gap: 6,
    padding: 4,
  },
  card: {
    radius: 20,
    padding: 16,
    borderColorLight: 'rgba(255,255,255,0.4)',
    borderColorDark: 'rgba(255,255,255,0.08)',
    bgLight: ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)'],
    bgDark: ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'],
  }
};

const { width, height } = Dimensions.get('window');

// --- Helpers ---
const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:') || value.startsWith('ph://') || value.startsWith('assets-library://');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

// --- Constants ---
const SKIN_TONES = [
  { color: '#F5D5C5', label: 'Fair' },
  { color: '#E8C4A0', label: 'Light' },
  { color: '#D4A574', label: 'Medium' },
  { color: '#C68642', label: 'Tan' },
  { color: '#8D5524', label: 'Brown' },
  { color: '#5C3A21', label: 'Dark' },
  { color: '#3D2314', label: 'Deep' },
  { color: '#E0AC69', label: 'Olive' },
  { color: '#CD853F', label: 'Bronze' },
  { color: '#A0522D', label: 'Chestnut' },
  { color: '#F4C2C2', label: 'Rose Fair' },
  { color: '#D2691E', label: 'Amber' },
];

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#fa709a', gradient: ['#fa709a', '#fee140'] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
];

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#667eea' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#f97316' },
];

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

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

// --- Types ---
type BabyFamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

// --- Components ---

const GlassmorphismCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  intensity?: number;
  delay?: number;
}> = ({ children, style, onPress, intensity = 80, delay = 0 }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View entering={FadeInUp.delay(delay)} layout={Layout.springify()} style={[styles.glassCard, style]}>
      <Wrapper onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
};

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

const SafeBabyAvatar: React.FC<{
  avatar?: string | null;
  gender?: string;
  size?: number;
  showEditButton?: boolean;
  onEdit?: () => void;
}> = ({ avatar, gender = 'other', size = 72, showEditButton = false, onEdit }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  const genderOption = GENDER_OPTIONS.find(g => g.value === gender);
  const gradientColors = genderOption?.gradient || ['#667eea', '#764ba2'];

  const imageSource = useMemo(() => {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('file://') || avatar.startsWith('ph://') || avatar.startsWith('assets-library://')) {
      return { uri: avatar };
    }
    return null;
  }, [avatar]);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : gradientColors}
        style={[styles.avatarGradient, { width: size, height: size, borderRadius: size * 0.33 }]}
      >
        {hasImage && imageSource ? (
          <View style={{ width: size, height: size, borderRadius: size * 0.33, overflow: 'hidden' }}>
            <Image source={imageSource} style={{ width: size, height: size }} resizeMode="cover" />
          </View>
        ) : hasEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{avatar}</Text>
        ) : (
          <Ionicons name={genderOption?.icon as any || 'ellipse'} size={size * 0.4} color="#fff" />
        )}
      </LinearGradient>
      {showEditButton && onEdit && (
        <TouchableOpacity style={[styles.editAvatarBtn, { bottom: -4, right: -4 }]} onPress={onEdit} activeOpacity={0.8}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.editAvatarGradient}>
            <Ionicons name="camera" size={14} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

// --- Main Screen ---

export default function BabyFamilyCenterScreen({ navigation, route }: BabyFamilyCenterScreenProps) {
  const { mode = 'baby', babyId } = route.params || { mode: 'baby' };
  const { userProfile } = useAuth();
  const { profile } = useUser();
  const {
    babies, updateBaby, currentBaby, currentBabyId, addMilestone, deleteMilestone,
    loadBabies, switchBaby, deleteBaby, milestones, calculateAge,
  } = useBaby();
  const { entries: allActivities, getEntriesByBaby } = useActivity();
  const { members, loadFamily, parent2, guardians } = useFamily();

  const isBabyMode = mode === 'baby';
  const currentBabyData = useMemo(() => {
    if (!isBabyMode) return null;
    if (babyId) return babies.find(b => b.id === babyId) || currentBaby;
    return currentBaby;
  }, [isBabyMode, babyId, babies, currentBaby]);

  // --- State ---
  const [babyName, setBabyName] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(2);
  const [selectedGender, setSelectedGender] = useState('boy');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [babyPhoto, setBabyPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'health' | 'danger'>('overview');

  // Medical & Extended Fields
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [pediatrician, setPediatrician] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // UI State
  const [showBabySwitcher, setShowBabySwitcher] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: '', category: 'physical' as Milestone['category'], description: '', achievedAt: new Date().toISOString().split('T')[0],
  });

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);
  
  // Animated header values
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolate.CLAMP),
  }));

  const stickyHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [80, 140], [0, 1], Extrapolate.CLAMP),
  }));

  const stickyHeaderTranslate = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [80, 140], [-10, 0], Extrapolate.CLAMP),
    }],
  }));

  const [pendingChanges, setPendingChanges] = useState<string[]>([]);
  // --- Emoji Picker State ---
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // --- Init Data ---
  useEffect(() => {
    if (currentBabyData) {
      setBabyName(currentBabyData.name || '');
      setSelectedSkin(typeof currentBabyData.skinTone === 'number' ? currentBabyData.skinTone : 2);
      setSelectedGender(currentBabyData.gender || 'boy');
      setBirthDate(new Date(currentBabyData.birthDate));
      setBabyPhoto(currentBabyData.avatar || null);
      
      setBloodType(currentBabyData.bloodType || '');
      setAllergies(currentBabyData.allergies?.join(', ') || '');
      setMedicalNotes(currentBabyData.medicalNotes || '');
      setWeight(currentBabyData.weight || '');
      setHeight(currentBabyData.height || '');
      
      setEmergencyContact(currentBabyData.emergencyContact || '');
      setPediatrician(currentBabyData.pediatrician || '');
      setNotificationsEnabled(currentBabyData.notificationsEnabled !== false);

      setIsEditing(false);
    }
  }, [currentBabyData?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBabies(), loadFamily()]);
    setRefreshing(false);
  }, [loadBabies, loadFamily]);

  // --- Image Handling ---
  const getPermanentImagePath = (babyId: string, isAvatar: boolean = true) => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    return `${dir}${babyId}_${isAvatar ? 'avatar' : 'photo'}_${Date.now()}.jpg`;
  };

  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showErrorModal({ title: 'Permission Required', message: 'Please allow access to your camera.' });
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri);
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) {
      setIsUploading(false);
      showErrorModal({ title: 'Error', message: 'Failed to save photo' });
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showErrorModal({ title: 'Permission Required', message: 'Please allow access to your photo library.' });
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const permanentUri = getPermanentImagePath(currentBabyData?.id || 'temp');
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: permanentUri });
        setBabyPhoto(permanentUri);
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        showSuccessModal({ title: 'Photo Saved!', message: 'Profile picture updated.' });
      }
    } catch (error) {
      setIsUploading(false);
      showErrorModal({ title: 'Error', message: 'Failed to save photo' });
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setBabyPhoto(emoji);
    setIsEditing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccessModal({ title: 'Avatar Updated!', message: 'Emoji avatar saved.' });
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Pick Emoji'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleTakePhoto();
          else if (buttonIndex === 2) handlePickImage();
          else if (buttonIndex === 3) setShowEmojiPicker(true);
        }
      );
    } else {
      // For Android, use showConfirmModal instead of sweetAlert.confirm
      showConfirmModal({
        title: 'Change Photo',
        message: 'Choose an option',
        onConfirm: () => handlePickImage(),
        onCancel: () => {},
      });
    }
  };

  // --- Derived Data ---
  const recentActivities = useMemo(() => {
    if (!currentBabyData?.id) return [];
    return getEntriesByBaby(currentBabyData.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [allActivities, currentBabyData?.id, getEntriesByBaby]);

  const babyMilestones = useMemo(() => {
    if (!currentBabyData?.id) return [];
    return milestones.filter(m => m.babyId === currentBabyData.id).sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
  }, [milestones, currentBabyData?.id]);

  const babyStats = useMemo(() => {
    if (!currentBabyData) return null;
    return { streak: currentBabyData.streak || 0, milestones: babyMilestones.length, photos: currentBabyData.photos || 0, entries: recentActivities.length };
  }, [currentBabyData, babyMilestones.length, recentActivities.length]);

  const familyMembers = useMemo(() => {
    const membersList: FamilyMember[] = [];
    if (userProfile) {
      membersList.push({ id: userProfile.id, userId: userProfile.id, fullName: userProfile.fullName, email: userProfile.email, avatar: userProfile.avatar, role: 'parent1', relationship: 'Parent', permissions: { read: true, write: true, delete: true, manageFamily: true, manageSecurity: true, exportData: true }, addedAt: currentBabyData?.createdAt || new Date().toISOString(), addedBy: userProfile.id, canBeRemoved: false, phoneNumber: userProfile.phoneNumber, notificationsEnabled: true });
    }
    if (parent2) membersList.push(parent2);
    if (guardians && guardians.length > 0) membersList.push(...guardians);
    return membersList;
  }, [userProfile, parent2, guardians, currentBabyData?.createdAt]);

  // --- Change Detection & Save ---
  const checkForChanges = useCallback(() => {
    if (!currentBabyData) return [];
    const changes: string[] = [];
    if (babyName !== currentBabyData.name) changes.push(`Name: ${babyName}`);
    if (selectedGender !== currentBabyData.gender) changes.push(`Gender: ${GENDER_OPTIONS.find(g => g.value === selectedGender)?.label}`);
    if (babyPhoto !== currentBabyData.avatar) changes.push('Profile Photo');
    if (bloodType !== (currentBabyData.bloodType || '')) changes.push(`Blood Type: ${bloodType}`);
    if (allergies !== (currentBabyData.allergies?.join(', ') || '')) changes.push('Allergies updated');
    if (medicalNotes !== (currentBabyData.medicalNotes || '')) changes.push('Medical Notes updated');
    if (weight !== (currentBabyData.weight || '')) changes.push('Weight updated');
    if (height !== (currentBabyData.height || '')) changes.push('Height updated');
    if (emergencyContact !== (currentBabyData.emergencyContact || '')) changes.push('Emergency Contact updated');
    if (pediatrician !== (currentBabyData.pediatrician || '')) changes.push('Pediatrician updated');
    return changes;
  }, [currentBabyData, babyName, selectedGender, babyPhoto, bloodType, allergies, medicalNotes, weight, height, emergencyContact, pediatrician]);

  const handleSavePress = () => {
    const changes = checkForChanges();
    if (changes.length === 0) {
      showErrorModal({ title: 'No Changes', message: 'No modifications detected.' });
      return;
    }
    setPendingChanges(changes);
    
    showConfirmModal({
      title: 'Save Changes?',
      message: `You are about to update:\n${changes.join('\n')}`,
      onConfirm: handleSave,
      onCancel: () => {},
    });
  };

  const handleSave = async () => {
    try {
      if (!currentBabyData) return;
      setIsSaving(true);
      const babyUpdates: any = {
        name: babyName,
        skinTone: selectedSkin,
        gender: selectedGender,
        birthDate: birthDate.toISOString(),
        avatar: babyPhoto,
        bloodType,
        allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
        medicalNotes,
        weight,
        height,
        emergencyContact,
        pediatrician,
        notificationsEnabled,
        lastUpdated: new Date().toISOString(),
      };
      await updateBaby(currentBabyData.id, babyUpdates);
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessModal({ title: 'Profile Saved!', message: `${babyName}'s profile has been updated successfully.` });
    } catch (error) {
      showErrorModal({ title: 'Error', message: 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Milestones ---
  const handleAddMilestone = async () => {
    if (!currentBabyData || !newMilestone.title) return;
    const success = await addMilestone({ babyId: currentBabyData.id, title: newMilestone.title, category: newMilestone.category, description: newMilestone.description, achievedAt: newMilestone.achievedAt });
    if (success) {
      setShowAddMilestone(false);
      setNewMilestone({ title: '', category: 'physical', description: '', achievedAt: new Date().toISOString().split('T')[0] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessModal({ title: 'Milestone Recorded!', message: 'Another amazing achievement!' });
    }
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    showConfirmModal({
      title: 'Delete Milestone',
      message: 'Are you sure you want to delete this milestone?',
      onConfirm: async () => {
        await deleteMilestone(milestoneId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showSuccessModal({ title: 'Deleted', message: 'Milestone has been removed.' });
      },
    });
  };

  const handleDeleteBaby = async () => {
    showConfirmModal({
      title: 'Delete Profile?',
      message: `This will permanently delete ${currentBabyData?.name}'s profile and all associated data. This action cannot be undone.`,
      onConfirm: async () => {
        if (currentBabyData) {
          await deleteBaby(currentBabyData.id);
          showSuccessModal({ title: 'Profile Deleted', message: 'Baby profile has been removed.' });
          setTimeout(() => navigation.goBack(), 1500);
        }
      },
    });
  };

  const handleSwitchBaby = async (newBabyId: string) => {
    if (newBabyId === currentBabyId) return;
    if (isEditing) {
      showConfirmModal({
        title: 'Unsaved Changes',
        message: 'Switching babies will discard your changes. Continue?',
        onConfirm: async () => {
          await switchBaby(newBabyId);
          setIsEditing(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      });
    } else {
      await switchBaby(newBabyId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) { setBirthDate(selectedDate); setIsEditing(true); }
  };

  // --- Scroll Handler ---
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });
  // --- Emoji Picker Modal ---
  const EmojiPicker = () => {
    if (!showEmojiPicker) return null;
    return (
      <View style={styles.emojiPickerOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowEmojiPicker(false)} />
        <View style={[styles.emojiPickerSheet, isDark && styles.emojiPickerSheetDark]}>
          <View style={styles.emojiPickerHeader}>
            <Text style={[styles.emojiPickerTitle, isDark && styles.textDark]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiButton}
                onPress={() => {
                  handleEmojiSelect(emoji);
                  setShowEmojiPicker(false);
                }}
              >
                <Text style={styles.emojiButtonText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // --- RENDER SECTIONS ---

  // Single clean sticky header (Timeline pattern)
  const renderStickyHeader = () => {
    return (
      <Animated.View style={[styles.stickyHeader, stickyHeaderOpacity, stickyHeaderTranslate]}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark
            ? ['rgba(20,20,30,0.95)', 'rgba(10,10,20,0.85)']
            : ['rgba(255,255,255,0.95)', 'rgba(248,250,252,0.9)']
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.stickyHeaderContent, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>

          <View style={styles.stickyHeaderCenter}>
            <SafeBabyAvatar avatar={babyPhoto} gender={selectedGender} size={32} />
            <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]} numberOfLines={1}>
              {currentBabyData?.name || 'Baby Profile'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSavePress}
            style={[styles.saveBtn, (!isEditing || isSaving) && styles.saveBtnDisabled]}
            disabled={!isEditing || isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.saveBtnText, !isEditing && styles.saveBtnTextDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // Profile hero card (scrolls away, no overlap with tabs)
  const renderProfileHero = () => {
    if (!currentBabyData) return null;
    const genderOption = GENDER_OPTIONS.find(g => g.value === selectedGender);
    
    return (
      <Animated.View entering={FadeInUp} style={[styles.profileHero, { marginTop: insets.top + 60 }]}>
        <View style={styles.profileHeroContent}>
          <View style={styles.avatarSection}>
            <SafeBabyAvatar 
              avatar={babyPhoto} 
              gender={selectedGender} 
              size={100} 
              showEditButton 
              onEdit={showPhotoOptions} 
            />
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.textDark]}>{currentBabyData.name}</Text>
            <Text style={styles.profileMeta}>
              {currentBabyData.age || calculateAge(currentBabyData.birthDate)} • {genderOption?.label}
            </Text>
            <View style={styles.profileTags}>
              <View style={[styles.profileTag, { backgroundColor: `${medicalNotes || allergies ? '#f59e0b' : '#10b981'}20` }]}>
                <Ionicons name={medicalNotes || allergies ? 'medical-outline' : 'checkmark-circle'} size={12} color={medicalNotes || allergies ? '#f59e0b' : '#10b981'} />
                <Text style={[styles.profileTagText, { color: medicalNotes || allergies ? '#f59e0b' : '#10b981' }]}>
                  {medicalNotes || allergies ? 'Monitor' : 'Healthy'}
                </Text>
              </View>
              {isEditing && (
                <View style={[styles.profileTag, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <View style={styles.editingDot} />
                  <Text style={[styles.profileTagText, { color: '#f59e0b' }]}>Editing</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.editToggleBtn} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? "close" : "create-outline"} size={20} color="#667eea" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        {[
          { id: 'overview', icon: 'grid-outline', label: 'Overview' },
          { id: 'milestones', icon: 'trophy-outline', label: 'Milestones' },
          { id: 'health', icon: 'medical-outline', label: 'Health' },
          { id: 'danger', icon: 'warning-outline', label: 'Danger', color: '#ef4444' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const isDanger = tab.id === 'danger';
          return (
            <TouchableOpacity 
              key={tab.id} 
              style={styles.tab} 
              onPress={() => { 
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                setActiveTab(tab.id as typeof activeTab); 
              }}
            >
              <View style={[
                styles.tabBg, 
                isActive && { 
                  backgroundColor: isDanger ? 'rgba(239,68,68,0.15)' : (isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)') 
                },
                isDanger && isActive && { borderColor: '#ef4444', borderWidth: 1 }
              ]}>
                <Ionicons 
                  name={tab.icon as any} 
                  size={18} 
                  color={isActive ? (isDanger ? '#ef4444' : '#667eea') : (isDark ? '#94a3b8' : '#64748b')} 
                />
                <Text style={[
                  styles.tabLabel, 
                  isActive && (isDanger ? styles.tabLabelDanger : styles.tabLabelActive), 
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

  const renderQuickStats = () => (
    <GlassmorphismCard style={styles.statsCard} intensity={80} delay={100}>
      <View style={styles.statsRow}>
        <StatBadge icon="🔥" value={babyStats?.streak || 0} label="Day Streak" color="#fa709a" />
        <StatBadge icon="🌟" value={babyStats?.milestones || 0} label="Milestones" color="#f59e0b" />
        <StatBadge icon="📸" value={babyStats?.photos || 0} label="Photos" color="#8b5cf6" />
      </View>
    </GlassmorphismCard>
  );

  const renderBasicInfoForm = () => (
    <GlassmorphismCard style={styles.formCard} intensity={90} delay={200}>
      <View style={styles.sectionHeaderWithEdit}>
        <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Basic Information</Text>
        {!isEditing ? (
          <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
            <Ionicons name="create-outline" size={20} color="#667eea" />
          </TouchableOpacity>
        ) : (
          <View style={styles.editingBadge}>
            <Text style={styles.editingBadgeText}>Editing</Text>
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Baby's Name</Text>
        <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
          <Ionicons name="heart-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <TextInput 
            style={[styles.input, isDark && styles.inputDark]} 
            value={babyName} 
            onChangeText={(text) => { setBabyName(text); setIsEditing(true); }} 
            placeholder="Enter name" 
            placeholderTextColor={isDark ? '#666' : '#999'} 
            editable={isEditing} 
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Birth Date</Text>
        <TouchableOpacity
          style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}
          onPress={() => isEditing && setShowDatePicker(true)}
          disabled={!isEditing}
        >
          <Ionicons name="calendar-outline" size={20} color="#667eea" style={styles.inputIcon} />
          <Text style={[styles.input, isDark && styles.inputDark]}>
            {birthDate.toLocaleDateString()}
          </Text>
          {isEditing && <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />}
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
                !isEditing && styles.genderButtonDisabled,
              ]}
              onPress={() => isEditing && setSelectedGender(gender.value as any)}
              disabled={!isEditing}
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
                { backgroundColor: skin.color },
                !isEditing && styles.skinButtonDisabled,
              ]}
              onPress={() => isEditing && setSelectedSkin(index)}
              disabled={!isEditing}
              accessibilityLabel={skin.label}
            >
              {selectedSkin === index && (
                <Ionicons name="checkmark" size={22} color={index > 5 ? '#fff' : '#000'} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.skinToneLabel, isDark && styles.textMuted]}>
          {SKIN_TONES[selectedSkin]?.label || 'Select tone'}
        </Text>
      </View>
    </GlassmorphismCard>
  );

  const renderOverview = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      {renderQuickStats()}
      {renderBasicInfoForm()}
      
      {/* Family Section */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="people" size={20} color="#667eea" />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Family</Text>
        </View>
        <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('FamilySettings' as never as never)}>
          <Text style={styles.seeAllText}>Manage</Text>
          <Ionicons name="chevron-forward" size={16} color="#667eea" />
        </TouchableOpacity>
      </View>

      <GlassmorphismCard style={styles.familyCard} intensity={85} delay={300}>
        <View style={styles.familyRow}>
          <View style={styles.familyAvatars}>
            {familyMembers.slice(0, 3).map((member, idx) => (
              <View key={member.id} style={[styles.familyAvatar, { marginLeft: idx > 0 ? -12 : 0, zIndex: 3 - idx, backgroundColor: member.avatar ? 'transparent' : '#667eea' }]}>
                {member.avatar ? (
                  <Image source={{ uri: member.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <Text style={styles.familyAvatarText}>{member.fullName?.charAt(0) || '?'}</Text>
                )}
              </View>
            ))}
            {familyMembers.length > 3 && (
              <View style={[styles.familyAvatar, styles.familyAvatarMore, { marginLeft: -12 }]}>
                <Text style={styles.familyAvatarMoreText}>+{familyMembers.length - 3}</Text>
              </View>
            )}
          </View>
          <View style={styles.familyContent}>
            <Text style={[styles.familyTitle, isDark && styles.textDark]}>{familyMembers.length} Family Members</Text>
            <Text style={styles.familySubtitle}>Manage access & permissions</Text>
          </View>
        </View>
        {babies.length > 1 && (
          <TouchableOpacity style={styles.switchBabyRow} onPress={() => setShowBabySwitcher(true)}>
            <Ionicons name="swap-horizontal" size={18} color="#667eea" />
            <Text style={styles.switchBabyText}>Switch Baby Profile</Text>
          </TouchableOpacity>
        )}
      </GlassmorphismCard>

      {/* Recent Activity */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="time" size={20} color="#667eea" />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
        </View>
        <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('Timeline' as never as never, { babyId: currentBabyData?.id } as never)}>
          <Text style={styles.seeAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color="#667eea" />
        </TouchableOpacity>
      </View>

      {recentActivities.length > 0 ? (
        recentActivities.map((activity, index) => {
          const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note;
          return (
            <GlassmorphismCard key={activity.id || index} style={styles.activityItemCard} intensity={80} delay={400 + index * 50}>
              <View style={[styles.activityIcon, { backgroundColor: `${config.color}18` }]}>
                <Text style={styles.activityEmoji}>{config.emoji}</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, isDark && styles.textDark]}>{activity.title || activity.type}</Text>
                <Text style={styles.activityTime}>
                  {format(activity.timestamp, 'MMM d, h:mm a')}
                </Text>
                {activity.details && (
                  <Text style={styles.activityDetails}>{activity.details}</Text>
                )}
              </View>
              <View style={styles.activityArrow}>
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#667eea' : '#764ba2'} />
              </View>
            </GlassmorphismCard>
          );
        })
      ) : (
        <GlassmorphismCard style={styles.emptyCard} intensity={80} delay={400}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="document-text-outline" size={32} color="#667eea" />
          </View>
          <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
          <Text style={styles.emptyText}>Start tracking your baby's daily activities to see them here.</Text>
        </GlassmorphismCard>
      )}

      <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate('Timeline' as never as never, { babyId: currentBabyData?.id } as never)}>
        <Text style={styles.viewAllText}>View Full Timeline</Text>
        <Ionicons name="arrow-forward" size={18} color="#667eea" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderMilestones = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <TouchableOpacity style={styles.addMilestoneBtn} onPress={() => setShowAddMilestone(true)}>
        <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.addMilestoneGradient}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addMilestoneText}>Record New Milestone</Text>
        </LinearGradient>
      </TouchableOpacity>

      {babyMilestones.length > 0 ? (
        babyMilestones.map((milestone, index) => {
          const category = MILESTONE_CATEGORIES.find(c => c.id === milestone.category);
          return (
            <GlassmorphismCard key={milestone.id} style={styles.milestoneCard} intensity={85} delay={index * 100}>
              <View style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, { backgroundColor: `${category?.color || '#667eea'}20` }]}>
                  <Ionicons name={category?.icon as any || 'star'} size={24} color={category?.color || '#667eea'} />
                </View>
                <View style={styles.milestoneContent}>
                  <Text style={[styles.milestoneTitle, isDark && styles.textDark]}>{milestone.title}</Text>
                  <Text style={[styles.milestoneCategory, { color: category?.color || '#667eea' }]}>{category?.label}</Text>
                  <Text style={styles.milestoneDate}>
                    {format(new Date(milestone.achievedAt), 'MMM d, yyyy')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => handleDeleteMilestone(milestone.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {milestone.description && (
                <Text style={styles.milestoneDescription}>{milestone.description}</Text>
              )}
            </GlassmorphismCard>
          );
        })
      ) : (
        <GlassmorphismCard style={styles.emptyCard} intensity={80} delay={100}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="trophy-outline" size={32} color="#f59e0b" />
          </View>
          <Text style={styles.emptyStateTitle}>No Milestones Yet</Text>
          <Text style={styles.emptyText}>Record your baby's first smile, steps, words, and more!</Text>
        </GlassmorphismCard>
      )}
    </Animated.View>
  );

  const renderHealthForm = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassmorphismCard style={styles.formCard} intensity={90} delay={100}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Health Information</Text>
          {!isEditing ? (
            <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={20} color="#667eea" />
            </TouchableOpacity>
          ) : (
            <View style={styles.editingBadge}>
              <Text style={styles.editingBadgeText}>Editing</Text>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Blood Type</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="water-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={bloodType}
              onChangeText={(text) => { setBloodType(text); setIsEditing(true); }}
              placeholder="e.g., O+"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Allergies (comma separated)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="warning-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={allergies}
              onChangeText={(text) => { setAllergies(text); setIsEditing(true); }}
              placeholder="e.g., Peanuts, Dairy"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Weight (kg)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="fitness-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={weight}
              onChangeText={(text) => { setWeight(text); setIsEditing(true); }}
              placeholder="e.g., 4.2"
              keyboardType="decimal-pad"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Height (cm)</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="resize-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={height}
              onChangeText={(text) => { setHeight(text); setIsEditing(true); }}
              placeholder="e.g., 58"
              keyboardType="decimal-pad"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Medical Notes</Text>
          <TextInput
            style={[
              styles.textArea,
              isDark && styles.textAreaDark,
              !isEditing && styles.inputDisabled,
            ]}
            value={medicalNotes}
            onChangeText={(text) => { setMedicalNotes(text); setIsEditing(true); }}
            placeholder="Any important medical information..."
            multiline
            numberOfLines={4}
            placeholderTextColor={isDark ? '#666' : '#999'}
            editable={isEditing}
          />
        </View>
      </GlassmorphismCard>

      <GlassmorphismCard style={styles.formCard} intensity={90} delay={200}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Emergency & Pediatrician</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Emergency Contact</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="call-outline" size={20} color="#ef4444" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={emergencyContact}
              onChangeText={(text) => { setEmergencyContact(text); setIsEditing(true); }}
              placeholder="e.g., +1 (555) 123-4567"
              keyboardType="phone-pad"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDark && styles.textMuted]}>Pediatrician</Text>
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark, !isEditing && styles.inputDisabled]}>
            <Ionicons name="medical-outline" size={20} color="#10b981" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              value={pediatrician}
              onChangeText={(text) => { setPediatrician(text); setIsEditing(true); }}
              placeholder="Dr. Smith - City Children's Hospital"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>
      </GlassmorphismCard>

      <GlassmorphismCard style={styles.formCard} intensity={90} delay={300}>
        <View style={styles.sectionHeaderWithEdit}>
          <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Preferences</Text>
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="notifications-outline" size={22} color="#667eea" />
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, isDark && styles.textDark]}>Notifications</Text>
              <Text style={[styles.preferenceDesc, isDark && styles.textMuted]}>Receive milestone & health reminders</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(value) => { setNotificationsEnabled(value); setIsEditing(true); }}
            trackColor={{ false: '#cbd5e1', true: '#667eea' }}
            thumbColor="#fff"
            disabled={!isEditing}
          />
        </View>
      </GlassmorphismCard>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="apps" size={20} color="#667eea" />
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Quick Actions</Text>
        </View>
      </View>

      <GlassmorphismCard style={styles.actionCard} intensity={80} delay={400} onPress={() => navigation.navigate('Timeline' as never as never, { type: 'medication' } as never)}>
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
      </GlassmorphismCard>

      <GlassmorphismCard style={styles.actionCard} intensity={80} delay={500} onPress={() => navigation.navigate('Timeline' as never as never, { type: 'sleep' } as never)}>
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
      </GlassmorphismCard>

      <GlassmorphismCard style={styles.actionCard} intensity={80} delay={600} onPress={() => navigation.navigate('Timeline' as never as never, { type: 'feed' } as never)}>
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
      </GlassmorphismCard>

      <GlassmorphismCard style={styles.actionCard} intensity={80} delay={700} onPress={() => navigation.navigate('GrowthDashboard' as never as never, { babyId: currentBabyData?.id } as never)}>
        <View style={styles.actionRow}>
          <View style={[styles.actionIconBg, { backgroundColor: '#10b98118' }]}>
            <Ionicons name="trending-up-outline" size={26} color="#10b981" />
          </View>
          <View style={styles.actionContent}>
            <Text style={[styles.actionTitle, isDark && styles.textDark]}>Growth Charts</Text>
            <Text style={[styles.actionSubtitle, isDark && styles.textMuted]}>View detailed growth analytics</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassmorphismCard>
    </Animated.View>
  );

  const renderDangerZone = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassmorphismCard style={styles.dangerCard} intensity={90} delay={100}>
        <View style={styles.dangerIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
            <Ionicons name="warning" size={32} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerDescription}>
          Permanently delete {currentBabyData?.name}'s profile and all associated data. 
          This action cannot be undone.
        </Text>

        <View style={styles.dangerStats}>
          <View style={styles.dangerStat}>
            <Ionicons name="images-outline" size={20} color="#94a3b8" />
            <Text style={styles.dangerStatText}>{babyStats?.photos || 0} Photos</Text>
          </View>
          <View style={styles.dangerStat}>
            <Ionicons name="trophy-outline" size={20} color="#94a3b8" />
            <Text style={styles.dangerStatText}>{babyStats?.milestones || 0} Milestones</Text>
          </View>
          <View style={styles.dangerStat}>
            <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
            <Text style={styles.dangerStatText}>{babyStats?.entries || 0} Entries</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteBaby}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.deleteGradient}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Delete Baby Profile</Text>
          </LinearGradient>
        </TouchableOpacity>
      </GlassmorphismCard>

      <View style={styles.dangerNote}>
        <Ionicons name="information-circle" size={14} color="#94a3b8" />
        <Text style={styles.dangerNoteText}>Consider exporting data before deletion</Text>
      </View>
    </Animated.View>
  );

  // --- Main Render ---

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.bg} />

      {renderStickyHeader()}

      <AutoHideAnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {renderProfileHero()}
        {renderTabs()}

        <View style={{ paddingHorizontal: 16 }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'milestones' && renderMilestones()}
          {activeTab === 'health' && renderHealthForm()}
          {activeTab === 'danger' && renderDangerZone()}
        </View>
         </Animated.ScrollView>

      <EmojiPicker />
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { flexGrow: 1 },

  // Sticky Header (Timeline pattern - clean, no overlap)
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN.spacing.lg,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.spacing.md,
  },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
    maxWidth: 180,
  },
  saveBtn: {
    paddingHorizontal: DESIGN.spacing.lg,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#667eea',
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(100,116,139,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  saveBtnTextDisabled: {
    color: '#64748b',
  },

  // Profile Hero (scrolls with content, no absolute positioning)
  profileHero: {
    paddingHorizontal: DESIGN.spacing.xl,
    paddingBottom: 20,
  },
  profileHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarSection: {
    position: 'relative',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  profileMeta: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  profileTags: {
    flexDirection: 'row',
    marginTop: 8,
    gap: DESIGN.spacing.md,
    flexWrap: 'wrap',
  },
  profileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  profileTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  editToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab Bar (inside scroll view, no absolute positioning)
  tabBarContainer: {
    paddingHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: DESIGN.radius.lg,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBarDark: {
    backgroundColor: 'rgba(30,30,40,0.8)',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  tabLabelDanger: {
    color: '#ef4444',
    fontWeight: '700',
  },

  // GlassCard
  
  // === UNIFIED GLASS CARD ===
  glassCard: {
    borderRadius: DESIGN.card.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DESIGN.card.borderColorLight,
    ...DESIGN.shadow.lg,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassCardDark: {
    borderColor: DESIGN.card.borderColorDark,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  glassContent: {
    padding: DESIGN.card.padding,
  },


  // Avatar
  avatarWrapper: {
    position: 'relative',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarEmoji: {},
  editAvatarBtn: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
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

  // Stats
  statsCard: { padding: 0, marginBottom: 16 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.1)',
  },
  statBadge: {
    alignItems: 'center',
    gap: 6,
  },
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

  // Form Card
  formCard: {
    padding: 0,
    marginBottom: DESIGN.spacing.lg,
  },
  sectionHeaderWithEdit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DESIGN.spacing.xl,
    paddingTop: 20,
    marginBottom: DESIGN.spacing.lg,
  },
  sectionLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  editIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editingBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  inputGroup: { marginBottom: DESIGN.spacing.xl, paddingHorizontal: 20 },
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
    borderRadius: DESIGN.radius.lg,
    paddingHorizontal: 18,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  inputContainerDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputDisabled: {
    opacity: 0.6,
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
    borderRadius: DESIGN.radius.lg,
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

  genderContainer: { flexDirection: 'row', gap: DESIGN.spacing.lg, paddingHorizontal: 20 },
  genderButton: {
    flex: 1,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderRadius: DESIGN.radius.xl,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  genderButtonDisabled: { opacity: 0.5 },
  genderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 10,
  },
  genderTextDark: { color: '#94a3b8' },

  skinContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN.spacing.lg,
    justifyContent: 'center',
    paddingHorizontal: DESIGN.spacing.xl,
  },
  skinButton: {
    width: 48,
    height: 48,
    borderRadius: DESIGN.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skinButtonActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  skinButtonDisabled: { opacity: 0.5 },
  skinToneLabel: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  tabPanel: { marginTop: 4, gap: 16 },

  // Section Headers
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
    marginBottom: DESIGN.spacing.md,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN.spacing.md,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
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

  switchBabyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: DESIGN.radius.lg,
    marginTop: 8,
    gap: DESIGN.spacing.md,
  },
  switchBabyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
  },

  // Activity
  activityItemCard: {
    marginVertical: 6,
    padding: 14,
    borderRadius: DESIGN.radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: DESIGN.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityEmoji: { fontSize: 24 },
  activityContent: { flex: 1 },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  activityDetails: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activityArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN.spacing.md,
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },

  // Milestones
  addMilestoneBtn: {
    borderRadius: DESIGN.radius.lg,
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
    gap: DESIGN.spacing.md,
  },
  addMilestoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN.radius.xl,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DESIGN.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },

  milestoneCard: {
    padding: 0,
    marginBottom: DESIGN.spacing.md,
    borderRadius: DESIGN.radius.xl,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  milestoneIcon: {
    width: 50,
    height: 50,
    borderRadius: DESIGN.radius.lg,
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
  milestoneDate: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  milestoneDescription: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 10,
    lineHeight: 20,
    fontWeight: '500',
    paddingHorizontal: DESIGN.spacing.lg,
    paddingBottom: 16,
  },
  deleteEntryBtn: {
    padding: 6,
    width: 36,
    height: 36,
    borderRadius: DESIGN.radius.lg,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Action Cards
  actionCard: {
    padding: 0,
    marginBottom: DESIGN.spacing.md,
    borderRadius: DESIGN.radius.xl,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  actionIconBg: {
    width: 54,
    height: 54,
    borderRadius: DESIGN.radius.lg,
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

  // Danger Zone
  dangerCard: {
    padding: 24,
    alignItems: 'center',
    borderColor: '#ef4444',
    borderWidth: 2,
    borderRadius: DESIGN.radius.xl,
  },
  dangerIconContainer: { marginBottom: 16 },
  dangerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 8,
  },
  dangerDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: DESIGN.spacing.xl,
  },
  dangerStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  dangerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dangerStatText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  deleteButton: {
    width: '100%',
    borderRadius: DESIGN.radius.lg,
    overflow: 'hidden',
  },
  deleteGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: DESIGN.spacing.md,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  dangerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  dangerNoteText: {
    fontSize: 13,
    color: '#94a3b8',
  },

  // Preferences
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DESIGN.spacing.xl,
    paddingVertical: 16,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  preferenceText: { gap: 2 },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  preferenceDesc: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },

  // Emoji Picker (simple modal styles)
  emojiPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  emojiPickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  emojiPickerSheetDark: {
    backgroundColor: '#1a1a2e',
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DESIGN.spacing.xl,
  },
  emojiPickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: DESIGN.spacing.lg,
  },
  emojiButton: {
    width: 64,
    height: 64,
    borderRadius: DESIGN.radius.xl,
    backgroundColor: 'rgba(100,116,139,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonText: { fontSize: 32 },
});