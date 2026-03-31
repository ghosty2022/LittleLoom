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
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, { 
  FadeInUp, 
  FadeInDown, 
  useSharedValue, 
  useAnimatedStyle, 
  interpolate, 
  Extrapolate, 
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  runOnJS,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { format, formatDistanceToNow, parseISO, differenceInMonths, differenceInYears, differenceInDays } from 'date-fns';

import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useBaby, GrowthMeasurement, Milestone, ActivityEntry } from '../context/BabyContext';
import { useFamily, FamilyMember } from '../context/FamilyContext';
import { useActivity } from '../context/ActivityContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ==================== DIVERSE SKIN TONES - INCLUSIVE PALETTE ====================
const SKIN_TONES = [
  { color: '#F5D5C5', label: 'Fair', undertone: 'warm' },
  { color: '#E8C4A0', label: 'Light', undertone: 'neutral' },
  { color: '#D4A574', label: 'Medium', undertone: 'warm' },
  { color: '#C68642', label: 'Tan', undertone: 'golden' },
  { color: '#8D5524', label: 'Brown', undertone: 'rich' },
  { color: '#5C3A21', label: 'Dark', undertone: 'deep' },
  { color: '#3D2314', label: 'Deep', undertone: 'ebony' },
  { color: '#E0AC69', label: 'Olive', undertone: 'mediterranean' },
  { color: '#CD853F', label: 'Bronze', undertone: 'copper' },
  { color: '#A0522D', label: 'Chestnut', undertone: 'warm' },
  { color: '#F4C2C2', label: 'Rose Fair', undertone: 'cool' },
  { color: '#D2691E', label: 'Amber', undertone: 'golden' },
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

// Baby health status calculation
const getHealthStatus = (baby: any) => {
  if (!baby) return { status: 'Unknown', color: '#94a3b8', icon: 'help-circle' };
  
  const hasAllergies = baby.allergies && baby.allergies.length > 0;
  const hasMedicalNotes = baby.medicalNotes && baby.medicalNotes.length > 10;
  const hasBloodType = baby.bloodType && baby.bloodType.length > 0;
  
  if (hasAllergies || hasMedicalNotes) {
    return { status: 'Monitor', color: '#f59e0b', icon: 'medical-outline' };
  }
  if (hasBloodType) {
    return { status: 'Healthy', color: '#10b981', icon: 'checkmark-circle' };
  }
  return { status: 'No Data', color: '#64748b', icon: 'information-circle' };
};

type EditProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

// ==================== SWEET ALERT COMPONENT ====================
interface SweetAlertProps {
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}

const SweetAlert: React.FC<SweetAlertProps> = ({ visible, type, title, message, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const colors = {
    success: { bg: ['#10b981', '#059669'], icon: 'checkmark-circle' },
    error: { bg: ['#ef4444', '#dc2626'], icon: 'close-circle' },
    warning: { bg: ['#f59e0b', '#d97706'], icon: 'warning' },
    info: { bg: ['#3b82f6', '#2563eb'], icon: 'information-circle' },
  };

  const theme = colors[type];

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withTiming(1, { duration: 200 });
      
      const timer = setTimeout(() => {
        scale.value = withSpring(0);
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(onClose)();
        });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, animatedStyle]}>
        <LinearGradient colors={theme.bg} style={styles.alertGradient}>
          <Ionicons name={theme.icon as any} size={56} color="#fff" />
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

// ==================== CENTERED MODAL COMPONENT (NEW) ====================
interface CenteredModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxHeight?: number;
}

const CenteredModal: React.FC<CenteredModalProps> = ({ visible, onClose, title, children, maxHeight = height * 0.7 }) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(50, { duration: 200 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.centeredModalOverlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        
        <Animated.View style={[styles.centeredModalContainer, modalStyle, { maxHeight }]}>
          <BlurView intensity={98} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.centeredModalHandle} />
          
          <View style={styles.centeredModalHeader}>
            <Text style={styles.centeredModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.centeredModalContent}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ==================== PHOTO OPTIONS MODAL (UPDATED TO CENTERED) ====================
const PhotoOptionsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onEmoji: () => void;
}> = ({ visible, onClose, onCamera, onGallery, onEmoji }) => {
  return (
    <CenteredModal visible={visible} onClose={onClose} title="Change Photo">
      <Text style={styles.modalSubtitle}>Choose how you want to update the profile picture</Text>
      
      <View style={styles.photoOptionsGrid}>
        <TouchableOpacity style={styles.photoOption} onPress={onCamera}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.photoOptionIcon}>
            <Ionicons name="camera" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.photoOptionLabel}>Camera</Text>
          <Text style={styles.photoOptionSubtext}>Take a photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.photoOption} onPress={onGallery}>
          <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.photoOptionIcon}>
            <Ionicons name="images" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.photoOptionLabel}>Gallery</Text>
          <Text style={styles.photoOptionSubtext}>Choose existing</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.photoOption} onPress={onEmoji}>
          <LinearGradient colors={['#10b981', '#059669']} style={styles.photoOptionIcon}>
            <Text style={styles.emojiIcon}>😊</Text>
          </LinearGradient>
          <Text style={styles.photoOptionLabel}>Emoji</Text>
          <Text style={styles.photoOptionSubtext}>Use an avatar</Text>
        </TouchableOpacity>
      </View>
    </CenteredModal>
  );
};

// ==================== EMOJI PICKER MODAL (UPDATED TO CENTERED) ====================
const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

const EmojiPickerModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}> = ({ visible, onClose, onSelect }) => {
  return (
    <CenteredModal visible={visible} onClose={onClose} title="Choose Avatar" maxHeight={height * 0.6}>
      <View style={styles.emojiGrid}>
        {EMOJI_OPTIONS.map((emoji, index) => (
          <TouchableOpacity
            key={index}
            style={styles.emojiButton}
            onPress={() => {
              onSelect(emoji);
              onClose();
            }}
          >
            <Text style={styles.emojiButtonText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </CenteredModal>
  );
};

// ==================== CONFIRM DELETE MODAL (UPDATED TO CENTERED) ====================
const ConfirmDeleteModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  babyName: string;
}> = ({ visible, onClose, onConfirm, babyName }) => {
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(1);
  
  const resetAndClose = () => {
    setConfirmText('');
    setStep(1);
    onClose();
  };

  const handleConfirm = () => {
    if (step === 1) {
      setStep(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      if (confirmText.toLowerCase() === babyName.toLowerCase()) {
        onConfirm();
        resetAndClose();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  return (
    <CenteredModal visible={visible} onClose={resetAndClose} title="Delete Profile?" maxHeight={height * 0.5}>
      <View style={styles.deleteModalContent}>
        <View style={styles.confirmIconContainer}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.confirmIconGradient}>
            <Ionicons name="trash" size={32} color="#fff" />
          </LinearGradient>
        </View>
        
        {step === 1 ? (
          <>
            <Text style={styles.confirmTitle}>Are you sure?</Text>
            <Text style={styles.confirmMessage}>
              This will permanently delete {babyName}'s profile and all associated data. This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose}>
                <Text style={styles.cancelBtnText}>Keep Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={handleConfirm}>
                <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.deleteConfirmGradient}>
                  <Text style={styles.deleteConfirmText}>I Understand</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.confirmTitle}>Type to Confirm</Text>
            <Text style={styles.confirmMessage}>
              Please type <Text style={styles.boldText}>{babyName}</Text> to confirm deletion:
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Enter baby name"
              autoFocus
            />
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetAndClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteConfirmBtn, confirmText.toLowerCase() !== babyName.toLowerCase() && styles.disabledBtn]} 
                onPress={handleConfirm}
              >
                <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.deleteConfirmGradient}>
                  <Text style={styles.deleteConfirmText}>Delete Forever</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </CenteredModal>
  );
};

// ==================== SAVE CONFIRMATION MODAL (NEW) ====================
const SaveConfirmationModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  changes: string[];
}> = ({ visible, onClose, onConfirm, changes }) => {
  return (
    <CenteredModal visible={visible} onClose={onClose} title="Save Changes?" maxHeight={height * 0.5}>
      <Text style={styles.modalSubtitle}>You are about to update the following:</Text>
      <View style={styles.changesList}>
        {changes.map((change, index) => (
          <View key={index} style={styles.changeItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.changeText}>{change}</Text>
          </View>
        ))}
      </View>
      <View style={styles.confirmButtons}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Review</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirm}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.saveConfirmGradient}>
            <Text style={styles.saveConfirmText}>Save Changes</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </CenteredModal>
  );
};

// ==================== BABY SWITCHER MODAL (NEW) ====================
const BabySwitcherModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  babies: any[];
  currentBabyId: string | null;
  onSwitch: (babyId: string) => void;
  onAddNew: () => void;
}> = ({ visible, onClose, babies, currentBabyId, onSwitch, onAddNew }) => {
  return (
    <CenteredModal visible={visible} onClose={onClose} title="Switch Baby" maxHeight={height * 0.7}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {babies.map((baby, index) => (
          <TouchableOpacity
            key={baby.id}
            style={[
              styles.babySwitchItem,
              baby.id === currentBabyId && styles.babySwitchItemActive
            ]}
            onPress={() => {
              onSwitch(baby.id);
              onClose();
            }}
          >
            <LinearGradient
              colors={baby.gender === 'boy' ? ['#667eea', '#764ba2'] : baby.gender === 'girl' ? ['#fa709a', '#fee140'] : ['#11998e', '#38ef7d']}
              style={styles.babySwitchAvatar}
            >
              <Text style={styles.babySwitchEmoji}>{baby.avatar || '👶'}</Text>
            </LinearGradient>
            <View style={styles.babySwitchInfo}>
              <Text style={styles.babySwitchName}>{baby.name}</Text>
              <Text style={styles.babySwitchAge}>{baby.age}</Text>
            </View>
            {baby.id === currentBabyId && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
            <Ionicons 
              name={baby.id === currentBabyId ? "checkmark-circle" : "chevron-forward"} 
              size={24} 
              color={baby.id === currentBabyId ? '#10b981' : '#cbd5e1'} 
            />
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity style={styles.addBabyButton} onPress={onAddNew}>
          <LinearGradient colors={['#667eea20', '#764ba220']} style={styles.addBabyGradient}>
            <Ionicons name="add-circle" size={32} color="#667eea" />
            <Text style={styles.addBabyText}>Add New Baby</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </CenteredModal>
  );
};

// ==================== GLASS CARD COMPONENT ====================
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

// ==================== ACTIVITY ITEM COMPONENT (HOMESCREEN STYLE) ====================
const ActivityItem: React.FC<{ activity: ActivityEntry; isDark: boolean; index: number }> = ({ activity, isDark, index }) => {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.note;
  
  return (
    <Animated.View entering={FadeInUp.delay(index * 80)} layout={Layout.springify()}>
      <GlassCard style={styles.activityItemCard} intensity={60}>
        <View style={[styles.activityIcon, { backgroundColor: `${config.color}20` }]}>
          <Text style={styles.activityEmoji}>{config.emoji}</Text>
        </View>
        <View style={styles.activityContent}>
          <Text style={[styles.activityTitle, isDark && styles.textDark]} numberOfLines={1}>
            {activity.title}
          </Text>
          <Text style={styles.activityTime}>
            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
          </Text>
          {activity.details && (
            <Text style={styles.activityDetails} numberOfLines={1}>{activity.details}</Text>
          )}
        </View>
        <View style={styles.activityArrow}>
          <Ionicons name="chevron-forward" size={18} color="#667eea" />
        </View>
      </GlassCard>
    </Animated.View>
  );
};

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
    addMilestone,
    getMilestones,
    deleteMilestone,
    loadBabies,
    switchBaby,
    deleteBaby,
    milestones,
    calculateAge,
  } = useBaby();
  
  const { 
    entries: allActivities, 
    getEntriesByBaby,
  } = useActivity();
  
  const { 
    members, 
    loadFamily, 
    parent2, 
    guardians,
  } = useFamily();
  
  const isBabyMode = mode === 'baby';
  
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
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'health' | 'danger'>('overview');
  
  // Health info
  const [bloodType, setBloodType] = useState(currentBabyData?.bloodType || '');
  const [allergies, setAllergies] = useState(currentBabyData?.allergies?.join(', ') || '');
  const [medicalNotes, setMedicalNotes] = useState(currentBabyData?.medicalNotes || '');

  // Modal states
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showBabySwitcher, setShowBabySwitcher] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
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

  // Track changes for confirmation
  const [pendingChanges, setPendingChanges] = useState<string[]>([]);

  // Update form states when baby data changes
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
      setIsEditing(false);
    }
  }, [currentBabyData?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadBabies(),
      loadFamily(),
    ]);
    setRefreshing(false);
  }, [loadBabies, loadFamily]);

  // ==================== PHOTO HANDLERS ====================
  const handleTakePhoto = async () => {
    setShowPhotoModal(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Permission Required',
        message: 'Please allow access to your camera.',
      });
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
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        setAlert({
          visible: true,
          type: 'success',
          title: 'Photo Updated!',
          message: 'Profile picture has been changed.',
        });
      }
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to take photo',
      });
      setIsUploading(false);
    }
  };

  const handlePickImage = async () => {
    setShowPhotoModal(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Permission Required',
        message: 'Please allow access to your photo library.',
      });
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
        setIsEditing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsUploading(false);
        setAlert({
          visible: true,
          type: 'success',
          title: 'Photo Updated!',
          message: 'Profile picture has been changed.',
        });
      }
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to pick image',
      });
      setIsUploading(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setBabyPhoto(emoji);
    setIsEditing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAlert({
      visible: true,
      type: 'success',
      title: 'Avatar Updated!',
      message: 'Profile picture has been changed.',
    });
  };

  // ==================== DATA MEMOS ====================
  const recentActivities = useMemo(() => {
    if (!currentBabyData?.id) return [];
    const babyActivities = getEntriesByBaby(currentBabyData.id);
    return babyActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [allActivities, currentBabyData?.id, getEntriesByBaby]);

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

  const healthStatus = useMemo(() => getHealthStatus(currentBabyData), [currentBabyData]);

  const familyMembers = useMemo(() => {
    const membersList: FamilyMember[] = [];
    
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
    
    if (parent2) membersList.push(parent2);
    if (guardians && guardians.length > 0) membersList.push(...guardians);
    
    return membersList;
  }, [userProfile, parent2, guardians, currentBabyData?.createdAt]);

  // ==================== SAVE HANDLERS ====================
  const checkForChanges = useCallback(() => {
    if (!currentBabyData) return [];
    const changes: string[] = [];
    
    if (babyName !== currentBabyData.name) changes.push(`Name: ${babyName}`);
    if (selectedGender !== currentBabyData.gender) changes.push(`Gender: ${GENDER_OPTIONS.find(g => g.value === selectedGender)?.label}`);
    if (babyPhoto !== currentBabyData.avatar) changes.push('Profile Photo');
    if (bloodType !== (currentBabyData.bloodType || '')) changes.push(`Blood Type: ${bloodType}`);
    if (allergies !== (currentBabyData.allergies?.join(', ') || '')) changes.push('Allergies updated');
    
    return changes;
  }, [currentBabyData, babyName, selectedGender, babyPhoto, bloodType, allergies]);

  const handleSavePress = () => {
    const changes = checkForChanges();
    if (changes.length === 0) {
      setAlert({
        visible: true,
        type: 'info',
        title: 'No Changes',
        message: 'No modifications detected.',
      });
      return;
    }
    setPendingChanges(changes);
    setShowSaveConfirm(true);
  };

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
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlert({
        visible: true,
        type: 'success',
        title: 'Profile Saved!',
        message: `${babyName}'s profile has been updated successfully.`,
      });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (error) {
      setAlert({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Failed to update profile',
      });
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
      setAlert({
        visible: true,
        type: 'success',
        title: 'Milestone Recorded!',
        message: 'Another amazing achievement! 🌟',
      });
    }
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
            setAlert({
              visible: true,
              type: 'success',
              title: 'Deleted',
              message: 'Milestone has been removed.',
            });
          }
        }
      ]
    );
  };

  const handleDeleteBaby = async () => {
    if (currentBabyData) {
      await deleteBaby(currentBabyData.id);
      setAlert({
        visible: true,
        type: 'success',
        title: 'Profile Deleted',
        message: 'Baby profile has been removed.',
      });
      setTimeout(() => navigation.goBack(), 1500);
    }
  };

  const handleSwitchBaby = async (newBabyId: string) => {
    if (newBabyId === currentBabyId) return;
    
    if (isEditing) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Switching babies will discard them. Continue?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Switch',
            style: 'destructive',
            onPress: async () => {
              await switchBaby(newBabyId);
              setIsEditing(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        ]
      );
    } else {
      await switchBaby(newBabyId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
      setIsEditing(true);
    }
  };

  // ==================== RENDER SECTIONS ====================
  const renderStickyHeader = () => {
    const headerOpacity = useAnimatedStyle(() => ({
      opacity: interpolate(scrollY.value, [0, 60], [0, 1], Extrapolate.CLAMP),
      transform: [{
        translateY: interpolate(scrollY.value, [0, 100], [-20, 0], Extrapolate.CLAMP)
      }]
    }));

    return (
      <Animated.View style={[styles.stickyHeader, headerOpacity, { paddingTop: insets.top + 10 }]}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['rgba(20,20,30,0.98)', 'rgba(10,10,20,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,252,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.stickyHeaderContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.stickyHeaderBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          
          <View style={styles.stickyHeaderCenter}>
            <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]}>
              {currentBabyData?.name || 'Baby Profile'}
            </Text>
            {isEditing && <View style={styles.editingIndicator} />}
          </View>
          
          <TouchableOpacity 
            onPress={handleSavePress} 
            style={[styles.stickySaveBtn, !isEditing && styles.stickySaveBtnDisabled]}
            disabled={!isEditing}
          >
            <Text style={[styles.stickySaveText, !isEditing && styles.stickySaveTextDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={[styles.tabBar, { top: insets.top + 60 }]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(30,30,40,0.98)', 'rgba(20,20,30,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tabContainer}>
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
                  backgroundColor: isDanger 
                    ? 'rgba(239,68,68,0.15)' 
                    : (isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)') 
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

  const renderPhotoSection = () => (
    <View style={styles.photoSection}>
      <SafeBabyAvatar 
        avatar={babyPhoto}
        gender={selectedGender}
        size={140}
        showEditButton
        onEdit={() => setShowPhotoModal(true)}
      />
      
      {isUploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
      
      <TouchableOpacity onPress={() => setShowPhotoModal(true)} style={styles.changePhotoBtn}>
        <Text style={styles.changePhotoText}>Change Photo</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.galleryLink}
        onPress={() => navigation.navigate('Gallery')}
      >
        <Ionicons name="images-outline" size={16} color="#667eea" />
        <Text style={styles.galleryLinkText}>View Full Gallery</Text>
        <Ionicons name="chevron-forward" size={14} color="#667eea" />
      </TouchableOpacity>
    </View>
  );

  const renderBabyInfoHeader = () => {
    if (!currentBabyData) return null;
    
    return (
      <GlassCard style={styles.babyInfoCard} delay={50}>
        <View style={styles.babyInfoRow}>
          <View style={styles.babyInfoItem}>
            <Text style={styles.babyInfoLabel}>Age</Text>
            <Text style={[styles.babyInfoValue, isDark && styles.textDark]}>
              {currentBabyData.age || calculateAge(currentBabyData.birthDate)}
            </Text>
          </View>
          <View style={styles.babyInfoDivider} />
          <View style={styles.babyInfoItem}>
            <Text style={styles.babyInfoLabel}>Gender</Text>
            <Text style={[styles.babyInfoValue, isDark && styles.textDark]}>
              {GENDER_OPTIONS.find(g => g.value === selectedGender)?.label}
            </Text>
          </View>
          <View style={styles.babyInfoDivider} />
          <View style={styles.babyInfoItem}>
            <Text style={styles.babyInfoLabel}>Health</Text>
            <View style={[styles.healthBadge, { backgroundColor: `${healthStatus.color}20` }]}>
              <Ionicons name={healthStatus.icon as any} size={14} color={healthStatus.color} />
              <Text style={[styles.healthText, { color: healthStatus.color }]}>
                {healthStatus.status}
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>
    );
  };

  const renderQuickStats = () => (
    <GlassCard style={styles.statsCard} delay={100}>
      <View style={styles.statsRow}>
        <StatBadge icon="🔥" value={babyStats?.streak || 0} label="Day Streak" color="#fa709a" />
        <StatBadge icon="🌟" value={babyStats?.milestones || 0} label="Milestones" color="#f59e0b" />
        <StatBadge icon="📸" value={babyStats?.photos || 0} label="Photos" color="#8b5cf6" />
      </View>
    </GlassCard>
  );

  const renderBasicInfoForm = () => (
    <GlassCard style={styles.formCard} delay={200}>
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
            onChangeText={(text) => {
              setBabyName(text);
              setIsEditing(true);
            }}
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
    </GlassCard>
  );

  // ==================== MILESTONES TAB ====================
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

  // ==================== HEALTH TAB ====================
  const renderHealthForm = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.formCard} delay={100}>
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
              onChangeText={(text) => {
                setBloodType(text);
                setIsEditing(true);
              }}
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
              onChangeText={(text) => {
                setAllergies(text);
                setIsEditing(true);
              }}
              placeholder="e.g., Peanuts, Dairy"
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
            onChangeText={(text) => {
              setMedicalNotes(text);
              setIsEditing(true);
            }}
            placeholder="Any important medical information..."
            multiline
            numberOfLines={4}
            placeholderTextColor={isDark ? '#666' : '#999'}
            editable={isEditing}
          />
        </View>
      </GlassCard>

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

      <GlassCard style={styles.actionCard} delay={500} onPress={() => navigation.navigate('GrowthChart', { babyId: currentBabyData?.id })}>
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
      </GlassCard>
    </Animated.View>
  );

  // ==================== DANGER TAB (DELETE ONLY) ====================
  const renderDangerZone = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.dangerCard} delay={100}>
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
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => setShowDeleteModal(true)}
        >
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.deleteGradient}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Delete Baby Profile</Text>
          </LinearGradient>
        </TouchableOpacity>
      </GlassCard>
      
      <Text style={styles.dangerNote}>
        <Ionicons name="information-circle" size={14} color="#94a3b8" />
        {' '}Consider exporting data before deletion
      </Text>
    </Animated.View>
  );

  // ==================== OVERVIEW TAB ====================
  const renderOverview = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      {renderPhotoSection()}
      {renderBabyInfoHeader()}
      {renderQuickStats()}
      {renderBasicInfoForm()}
      
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

      {/* Baby Switcher Quick Access */}
      {babies.length > 1 && (
        <TouchableOpacity 
          style={styles.switchBabyRow}
          onPress={() => setShowBabySwitcher(true)}
        >
          <Ionicons name="swap-horizontal" size={20} color="#667eea" />
          <Text style={styles.switchBabyText}>Switch to another baby</Text>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>
      )}

      {recentActivities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Timeline')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentActivities.map((activity, index) => (
            <ActivityItem 
              key={activity.id} 
              activity={activity} 
              isDark={isDark} 
              index={index}
            />
          ))}
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('Timeline')}
          >
            <Text style={styles.viewAllText}>View All in Timeline</Text>
            <Ionicons name="arrow-forward" size={16} color="#667eea" />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  // ==================== ADD MILESTONE MODAL (CENTERED) ====================
  const renderAddMilestoneModal = () => (
    <CenteredModal 
      visible={showAddMilestone} 
      onClose={() => setShowAddMilestone(false)} 
      title="Record Milestone"
      maxHeight={height * 0.8}
    >
      <View style={styles.modalForm}>
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
      </View>
    </CenteredModal>
  );

  // ==================== MAIN RENDER ====================
  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} 
        style={styles.bg} 
      />

      <SweetAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert(prev => ({ ...prev, visible: false }))}
      />

      <PhotoOptionsModal
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onCamera={handleTakePhoto}
        onGallery={handlePickImage}
        onEmoji={() => {
          setShowPhotoModal(false);
          setShowEmojiModal(true);
        }}
      />

      <EmojiPickerModal
        visible={showEmojiModal}
        onClose={() => setShowEmojiModal(false)}
        onSelect={handleEmojiSelect}
      />

      <ConfirmDeleteModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteBaby}
        babyName={currentBabyData?.name || 'this baby'}
      />

      <SaveConfirmationModal
        visible={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={() => {
          setShowSaveConfirm(false);
          handleSave();
        }}
        changes={pendingChanges}
      />

      <BabySwitcherModal
        visible={showBabySwitcher}
        onClose={() => setShowBabySwitcher(false)}
        babies={babies}
        currentBabyId={currentBabyId}
        onSwitch={handleSwitchBaby}
        onAddNew={() => {
          setShowBabySwitcher(false);
          navigation.navigate('CreateBabyProfile');
        }}
      />

      {renderStickyHeader()}
      {renderTabs()}

      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 140, paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'milestones' && renderMilestones()}
        {activeTab === 'health' && renderHealthForm()}
        {activeTab === 'danger' && renderDangerZone()}
      </AnimatedScrollView>

      {renderAddMilestoneModal()}
    </View>
  );
}
// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { paddingHorizontal: 16 },
  
  // Sticky Header (FIXED - Now shows content underneath properly)
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    backgroundColor: 'transparent', // Allow content to show through initially
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
  },
  stickyHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stickyHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  editingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  stickySaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.15)',
  },
  stickySaveBtnDisabled: {
    backgroundColor: 'rgba(100,116,139,0.08)',
  },
  stickySaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },
  stickySaveTextDisabled: {
    color: '#94a3b8',
  },

  // Centered Modal (NEW)
  centeredModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  centeredModalContainer: {
    width: width - 40,
    maxHeight: height * 0.8,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  centeredModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  centeredModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  centeredModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredModalContent: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },

  // SweetAlert
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alertContainer: {
    width: width * 0.8,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  alertGradient: {
    padding: 32,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Photo Options Modal
  photoOptionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  photoOption: {
    alignItems: 'center',
    flex: 1,
  },
  photoOptionIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  photoOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  photoOptionSubtext: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emojiIcon: {
    fontSize: 32,
  },

  // Emoji Modal
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  emojiButton: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(100,116,139,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonText: {
    fontSize: 32,
  },

  // Confirm Delete Modal
  deleteModalContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  confirmIconContainer: {
    marginBottom: 16,
  },
  confirmIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  boldText: {
    fontWeight: '700',
    color: '#1e293b',
  },
  confirmInput: {
    width: '100%',
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(100,116,139,0.08)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  deleteConfirmBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  deleteConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  disabledBtn: {
    opacity: 0.5,
  },

  // Save Confirmation Modal
  changesList: {
    marginBottom: 20,
    gap: 8,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 10,
  },
  changeText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  saveConfirmGradient: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Baby Switcher Modal
  babySwitchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(100,116,139,0.05)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  babySwitchItemActive: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.08)',
  },
  babySwitchAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  babySwitchEmoji: {
    fontSize: 26,
  },
  babySwitchInfo: {
    flex: 1,
  },
  babySwitchName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  babySwitchAge: {
    fontSize: 13,
    color: '#64748b',
  },
  currentBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  addBabyButton: {
    marginTop: 10,
  },
  addBabyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
    gap: 10,
  },
  addBabyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },

  // Tab Bar
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

  // Glass Card
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

  // Avatar
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 20,
    marginTop: 8,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  changePhotoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#667eea',
  },
  galleryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(102,126,234,0.06)',
    borderRadius: 20,
  },
  galleryLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // Baby Info Header (NEW)
  babyInfoCard: { 
    padding: 0,
    marginBottom: 16,
  },
  babyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  babyInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  babyInfoDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(100,116,139,0.2)',
  },
  babyInfoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  babyInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Stats
  statsCard: { padding: 0 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
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

  // Form
  formCard: { padding: 0 },
  sectionHeaderWithEdit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 16,
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
  genderButtonDisabled: {
    opacity: 0.5,
  },
  genderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 10,
  },
  genderTextDark: { color: '#94a3b8' },

  // Skin
  skinContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    justifyContent: 'center', 
    paddingHorizontal: 20 
  },
  skinButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  skinButtonDisabled: {
    opacity: 0.5,
  },
  skinToneLabel: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  // Tab Panel
  tabPanel: { marginTop: 12, gap: 16 },

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

  // Switch Baby
  switchBabyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
  },
  switchBabyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
  },

  // Activity (HomeScreen Style)
  section: {
    marginBottom: 8,
  },
  activityItemCard: { 
    marginVertical: 6, 
    padding: 14, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  activityIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14 
  },
  activityEmoji: { 
    fontSize: 24 
  },
  activityContent: { 
    flex: 1 
  },
  activityTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#1e293b', 
    marginBottom: 2 
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
    justifyContent: 'center' 
  },
  viewAllButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },

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
  deleteEntryBtn: { padding: 6 },

  // Empty State
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

  // Danger Zone
  dangerCard: {
    padding: 24,
    alignItems: 'center',
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  dangerIconContainer: {
    marginBottom: 16,
  },
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
    marginBottom: 20,
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
    borderRadius: 16,
    overflow: 'hidden',
  },
  deleteGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
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
    fontSize: 13,
    color: '#94a3b8',
  },

  // Modal Form
  modalForm: {
    gap: 16,
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

  // Section spacing
  section: {
    marginBottom: 8,
  },
});