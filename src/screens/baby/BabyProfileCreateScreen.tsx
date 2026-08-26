// src/screens/baby/BabyProfileCreateScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '@/utils/supabase';
import { useSweetAlert } from '../../hooks/useSweetAlert';
import { useBaby } from '../../context/BabyContext';
import { getBabyByIdFromDb, setAppSetting, getAllBabiesFromDb } from '../../database/dbHelpers';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { SafeBabyAvatar } from '../../components/SafeAvatar';

const { width } = Dimensions.get('window');
const BABY_IMAGES_DIR = FileSystem.documentDirectory + 'baby_images/';

// ─── CONSTANTS ────────────────────────────────────────────────────────────
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DELIVERY_TYPES = ['Vaginal', 'C-Section', 'VBAC', 'Other'];
const BIRTH_ATTENDANTS = ['Obstetrician', 'Midwife', 'Family Doctor', 'Doula', 'Other'];
const FEEDING_PLANS = ['Breastfeeding', 'Formula', 'Combination', 'Pumping'];

// ─── TERM EXPLANATIONS ──────────────────────────────────────────────────
const TERM_EXPLANATIONS: Record<string, { label: string; explanation: string; emoji: string }> = {
  'Apgar Score': {
    label: 'Apgar Score',
    explanation: 'A quick test given at 1 and 5 minutes after birth. Scores 0-10 based on Appearance, Pulse, Grimace, Activity, and Respiration. 7+ is normal.',
    emoji: '🫀'
  },
  'Gestational Weeks': {
    label: 'Gestational Weeks',
    explanation: 'Weeks your baby was in the womb. Full-term is 39-40 weeks. Before 37 weeks is premature.',
    emoji: '📅'
  },
  'Birth Weight': {
    label: 'Birth Weight',
    explanation: 'Your baby\'s weight at birth. Average is 2.5-4.5 kg (5.5-10 lbs). Helps track growth patterns.',
    emoji: '⚖️'
  },
  'Birth Height': {
    label: 'Birth Height',
    explanation: 'Your baby\'s length at birth. Average is 45-55 cm (18-22 inches).',
    emoji: '📏'
  },
  'Head Circumference': {
    label: 'Head Circumference',
    explanation: 'Measurement around your baby\'s head. Average is 32-37 cm (12.5-14.5 inches). Tracks brain development.',
    emoji: '🧠'
  },
  'Delivery Type': {
    label: 'Delivery Type',
    explanation: 'How your baby was born: Vaginal (natural birth), C-Section (surgical), VBAC (vaginal birth after C-section), or Other.',
    emoji: '🏥'
  },
  'Birth Attendant': {
    label: 'Birth Attendant',
    explanation: 'The healthcare professional who helped deliver your baby. Can be an Obstetrician, Midwife, Family Doctor, or Doula.',
    emoji: '👩‍⚕️'
  },
  'Feeding Plan': {
    label: 'Feeding Plan',
    explanation: 'How you plan to feed your baby: Breastfeeding (breast milk), Formula (infant formula), Combination (both), or Pumping (expressed milk).',
    emoji: '🍼'
  },
};

const SKIN_TONES = [
  { id: 0, emoji: '👶', color: '#F5D0C5', label: 'Light' },
  { id: 1, emoji: '👶🏻', color: '#F5D0C5', label: 'Fair' },
  { id: 2, emoji: '👶🏼', color: '#E8C4A0', label: 'Medium' },
  { id: 3, emoji: '👶🏽', color: '#D4A373', label: 'Tan' },
  { id: 4, emoji: '👶🏾', color: '#A67C52', label: 'Brown' },
  { id: 5, emoji: '👶🏿', color: '#6B4423', label: 'Dark' },
];

const AVATAR_OPTIONS = ['👶', '🍼', '🧸', '🎀', '👼', '🤱', '👨‍🍼', '👩‍🍼', '🌟', '💖'];

// ─── HELPERS ──────────────────────────────────────────────────────────────
const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(BABY_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BABY_IMAGES_DIR, { intermediates: true });
  }
};

const getPermanentImagePath = (babyId: string, prefix: string = 'avatar') => {
  return `${BABY_IMAGES_DIR}${babyId}_${prefix}_${Date.now()}.jpg`;
};

const copyImageToPermanent = async (
  tempUri: string,
  babyId: string,
  prefix: string = 'avatar'
): Promise<string> => {
  await ensureDirExists();
  const permanentUri = getPermanentImagePath(babyId, prefix);

  try {
    if (tempUri.startsWith('content://')) {
      const base64 = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(permanentUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    } else if (tempUri.startsWith('data:')) {
      const base64Data = tempUri.split(',')[1];
      if (base64Data) {
        await FileSystem.writeAsStringAsync(permanentUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        throw new Error('Invalid data URI');
      }
    } else {
      await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
    }

    const fileInfo = await FileSystem.getInfoAsync(permanentUri);
    if (!fileInfo.exists) {
      throw new Error('File copy verification failed');
    }
    return permanentUri;
  } catch (error) {
    console.error('Failed to copy image:', error);
    throw error;
  }
};

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

type BabyProfileCreateScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateBabyProfile'>;

// ─── TERM EXPLANATION TOOLTIP ──────────────────────────────────────────
const TermTooltip = ({ term, isDark }: { term: string; isDark: boolean }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const info = TERM_EXPLANATIONS[term];
  if (!info) return null;

  return (
    <View style={styles.tooltipWrapper}>
      <TouchableOpacity
        onPress={() => setShowTooltip(!showTooltip)}
        style={styles.tooltipTrigger}
        activeOpacity={0.7}
      >
        <Ionicons name="information-circle-outline" size={20} color={isDark ? '#6366f1' : '#6366f1'} />
      </TouchableOpacity>
      {showTooltip && (
        <View style={[
          styles.tooltipContainer,
          { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
          Platform.OS === 'ios' ? styles.tooltipShadow : styles.tooltipShadowAndroid
        ]}>
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipEmoji}>{info.emoji}</Text>
            <Text style={[styles.tooltipTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
              {info.label}
            </Text>
          </View>
          <Text style={[styles.tooltipText, { color: isDark ? '#94a3b8' : '#475569' }]}>
            {info.explanation}
          </Text>
          <TouchableOpacity
            onPress={() => setShowTooltip(false)}
            style={styles.tooltipCloseBtn}
          >
            <Text style={[styles.tooltipCloseText, { color: '#6366f1' }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── COMPONENT ────────────────────────────────────────────────────────────
export default function BabyProfileCreateScreen({ navigation }: BabyProfileCreateScreenProps) {
  const insets = useSafeAreaInsets();
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();
  const { userProfile, completeSetup, isAuthenticated, wasSetupCompleted } = useAuth();
  const { createBaby, updateBaby, calculateAge, loadBabies, switchBaby, babies } = useBaby();
  const { toast, error: showError, success: showSuccess } = useSweetAlert();

  // ─── STATE ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [birthTime, setBirthTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'boy' | 'girl' | 'other'>('boy');
  const [skinTone, setSkinTone] = useState(0);
  const [avatar, setAvatar] = useState<string>('👶');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [birthWeight, setBirthWeight] = useState('');
  const [birthHeight, setBirthHeight] = useState('');
  const [birthHeadCircumference, setBirthHeadCircumference] = useState('');
  const [gestationalWeeks, setGestationalWeeks] = useState('');
  const [apgar1Min, setApgar1Min] = useState('');
  const [apgar5Min, setApgar5Min] = useState('');
  const [deliveryType, setDeliveryType] = useState('');
  const [birthAttendant, setBirthAttendant] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [multipleBirth, setMultipleBirth] = useState(false);
  const [birthOrder, setBirthOrder] = useState('');
  const [feedingPlan, setFeedingPlan] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPicker, setShowPicker] = useState<{
    type: 'bloodType' | 'deliveryType' | 'birthAttendant' | 'feedingPlan' | null;
  }>({ type: null });
  const [creatorRelationship, setCreatorRelationship] = useState<'Father' | 'Mother' | 'Guardian'>('Mother');
  const [showTermTooltip, setShowTermTooltip] = useState<string | null>(null);

  const imagePickerLock = useRef(false);
  const isCreatingRef = useRef(false);
  const isMounted = useRef(true);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);

  const ageDisplay = useMemo(() => calculateAge(birthDate.toISOString()), [birthDate, calculateAge]);

  const gradientColors = useMemo<[string, string, string]>(() => {
    if (isDark) return ['#0a0a0a', '#1a1a2e', '#16213e'];
    const c = themeColors.colors;
    if (Array.isArray(c) && c.length >= 2) {
      return [c[0], c[1], c[2] ?? c[1]];
    }
    return ['#667eea', '#764ba2', '#f093fb'];
  }, [isDark, themeColors]);

  const statusBarStyle = useMemo(() => (isDark ? 'light-content' : 'dark-content'), [isDark]);

  // ─── LIFECYCLE ──────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      imagePickerLock.current = false;
    };
  }, []);

  // ─── HANDLERS ──────────────────────────────────────────────────────────
  const onDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      if (selectedDate && event.type !== 'dismissed') {
        setBirthDate(selectedDate);
        triggerHaptic('light');
      }
    },
    [triggerHaptic]
  );

  const confirmDateIOS = useCallback(() => setShowDatePicker(false), []);
  const cancelDateIOS = useCallback(() => setShowDatePicker(false), []);

  const pickImage = useCallback(async () => {
    if (imagePickerLock.current) return;
    imagePickerLock.current = true;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setAvatar(result.assets[0].uri);
        setShowAvatarPicker(false);
        triggerHaptic('medium');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      toast('Failed to pick image', 'error');
    } finally {
      imagePickerLock.current = false;
    }
  }, [toast, triggerHaptic]);

  const takePhoto = useCallback(async () => {
    if (imagePickerLock.current) return;
    imagePickerLock.current = true;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        toast('Please allow camera access in settings', 'warning');
        imagePickerLock.current = false;
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setAvatar(result.assets[0].uri);
        setShowAvatarPicker(false);
        triggerHaptic('medium');
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast('Failed to take photo', 'error');
    } finally {
      imagePickerLock.current = false;
    }
  }, [toast, triggerHaptic]);

  const validateStep1 = useCallback((): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Please enter your baby's name", 'warning');
      return false;
    }
    if (trimmed.length < 2) {
      toast('Name must be at least 2 characters', 'warning');
      return false;
    }
    if (trimmed.length > 50) {
      toast('Name must be 50 characters or less', 'warning');
      return false;
    }
    return true;
  }, [name, toast]);

  const validateStep2 = useCallback((): boolean => {
    if (weight.trim()) {
      const w = parseFloat(weight.trim());
      if (isNaN(w) || w <= 0 || w > 60) {
        toast('Please enter a valid weight (0.1–60 kg)', 'warning');
        return false;
      }
    }
    if (height.trim()) {
      const h = parseFloat(height.trim());
      if (isNaN(h) || h < 20 || h > 220) {
        toast('Please enter a valid height (20–220 cm)', 'warning');
        return false;
      }
    }
    if (birthWeight.trim()) {
      const bw = parseFloat(birthWeight.trim());
      if (isNaN(bw) || bw <= 0 || bw > 10) {
        toast('Please enter a valid birth weight (0.1–10 kg)', 'warning');
        return false;
      }
    }
    if (gestationalWeeks.trim()) {
      const gw = parseInt(gestationalWeeks.trim());
      if (isNaN(gw) || gw < 22 || gw > 44) {
        toast('Please enter valid gestational weeks (22-44)', 'warning');
        return false;
      }
    }
    return true;
  }, [weight, height, birthWeight, gestationalWeeks, toast]);

  const handleNext = useCallback(() => {
    triggerHaptic('light');
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [currentStep, validateStep1, triggerHaptic]);

  const handleBack = useCallback(() => {
    triggerHaptic('light');
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('BabyOptional');
      }
    }
  }, [currentStep, navigation, triggerHaptic]);

  const handleCreateProfile = useCallback(async (andContinue = false) => {
    if (isCreatingRef.current) {
      toast('A profile is already being created', 'warning');
      return;
    }
    if (!validateStep1() || !validateStep2()) return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[BabyProfile] Auth check - user:', user?.id);

    if (userError || !user) {
      toast('Please sign in again to create a baby profile', 'error');
      navigation.replace('Login');
      return;
    }

    const userId = user.id;
    console.log('[BabyProfile] Creating baby with parent1Id (from session):', userId);

    const trimmedName = name.trim();
    const birthIso = birthDate.toISOString();
    
    const duplicate = babies.find(b => b.name === trimmedName && b.birthDate === birthIso);
    if (duplicate) {
      toast('A baby with this name and birth date already exists', 'warning');
      return;
    }

    isCreatingRef.current = true;
    setIsLoading(true);
    triggerHaptic('medium');

    let babyId: string | null = null;

    try {
      const hasCustomImage = isImageUri(avatar);
      const avatarToSave = hasCustomImage ? '👶' : avatar;

      const babyData: any = {
        name: trimmedName,
        birthDate: birthIso,
        gender,
        skinTone,
        avatar: avatarToSave,
        weight: weight.trim() || undefined,
        height: height.trim() || undefined,
        bloodType: bloodType.trim().toUpperCase() || undefined,
        allergies: allergies.trim() ? allergies.split(',').map((a) => a.trim()).filter(Boolean) : undefined,
        medicalNotes: medicalNotes.trim() || undefined,
        parent1Id: userId,
        parent2Id: undefined,
        birthWeight: birthWeight.trim() || undefined,
        birthHeight: birthHeight.trim() || undefined,
        birthHeadCircumference: birthHeadCircumference.trim() || undefined,
        gestationalWeeks: gestationalWeeks.trim() || undefined,
        apgar1Min: apgar1Min.trim() || undefined,
        apgar5Min: apgar5Min.trim() || undefined,
        deliveryType: deliveryType || undefined,
        birthAttendant: birthAttendant || undefined,
        birthPlace: birthPlace.trim() || undefined,
        multipleBirth: multipleBirth,
        birthOrder: birthOrder.trim() || undefined,
        feedingPlan: feedingPlan || undefined,
        birthTime: birthTime.trim() || undefined,
      };

      console.log('[BabyProfile] Creating baby with data:', babyData);
      
      babyId = await createBaby(babyData);

      if (!babyId) {
        if (isMounted.current) {
          toast('Failed to create profile. Please try again.', 'error');
        }
        isCreatingRef.current = false;
        setIsLoading(false);
        return;
      }

      console.log('[BabyProfile] Baby created with ID:', babyId);

      if (hasCustomImage && babyId) {
        try {
          const permanentUri = await copyImageToPermanent(avatar, babyId, 'avatar');
          await updateBaby(babyId, { avatar: permanentUri });
          if (isMounted.current) {
            toast('Profile photo saved!', 'success');
          }
        } catch (imgError) {
          console.warn('Failed to persist baby image:', imgError);
          if (isMounted.current) {
            toast('Profile created but image could not be saved', 'warning');
          }
        }
      }

      if (isMounted.current) {
        toast(`${trimmedName}'s profile created! 🎉`, 'success');
      }

      if (!isMounted.current) {
        isCreatingRef.current = false;
        setIsLoading(false);
        return;
      }

      try {
        await loadBabies();
        console.log('[BabyProfile] Babies reloaded');

        const persisted = await getBabyByIdFromDb(babyId);
        console.log('[BabyProfile] Verified baby in DB:', persisted);

        if (!persisted) {
          console.error('CRITICAL: Baby profile was not persisted to the database!');
          if (isMounted.current) {
            toast('Profile could not be saved. Please try again.', 'error');
          }
          isCreatingRef.current = false;
          setIsLoading(false);
          return;
        }

        try {
          await switchBaby(babyId);
          console.log('[BabyProfile] Switched to new baby');
        } catch (switchErr) {
          console.warn('Failed to auto-switch to new baby:', switchErr);
        }

        if (andContinue) {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            const { hasParent2 } = await wasSetupCompleted();
            if (hasParent2 === false) {
              navigation.replace('CoParentInviteScreen');
            } else {
              navigation.replace('Main');
            }
          }
        } else {
          setName('');
          setBirthDate(new Date());
          setBirthTime('');
          setGender('boy');
          setSkinTone(0);
          setAvatar('👶');
          setWeight('');
          setHeight('');
          setBloodType('');
          setAllergies('');
          setMedicalNotes('');
          setBirthWeight('');
          setBirthHeight('');
          setBirthHeadCircumference('');
          setGestationalWeeks('');
          setApgar1Min('');
          setApgar5Min('');
          setDeliveryType('');
          setBirthAttendant('');
          setBirthPlace('');
          setMultipleBirth(false);
          setBirthOrder('');
          setFeedingPlan('');
          setCurrentStep(1);
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          if (isMounted.current) {
            toast('Baby added! Ready for another?', 'success');
          }
        }
      } catch (navError) {
        console.error('Post-create error:', navError);
        if (isMounted.current) {
          toast('Could not finalize setup', 'error');
        }
      }
    } catch (error) {
      console.error('Create baby error:', error);
      if (isMounted.current) {
        toast('An unexpected error occurred. Please try again.', 'error');
      }
    } finally {
      isCreatingRef.current = false;
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    name,
    birthDate,
    birthTime,
    gender,
    skinTone,
    avatar,
    weight,
    height,
    bloodType,
    allergies,
    medicalNotes,
    birthWeight,
    birthHeight,
    birthHeadCircumference,
    gestationalWeeks,
    apgar1Min,
    apgar5Min,
    deliveryType,
    birthAttendant,
    birthPlace,
    multipleBirth,
    birthOrder,
    feedingPlan,
    babies,
    createBaby,
    updateBaby,
    loadBabies,
    navigation,
    validateStep1,
    validateStep2,
    toast,
    triggerHaptic,
    switchBaby,
    wasSetupCompleted,
    userProfile,
  ]);

  // ─── RENDER PICKER MODAL ──────────────────────────────────────────────
  const renderPickerModal = (
    title: string,
    options: string[],
    selectedValue: string,
    onSelect: (value: string) => void,
    isVisible: boolean,
    onClose: () => void
  ) => (
    <Modal
      transparent
      animationType="slide"
      visible={isVisible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pickerItem,
                  selectedValue === item && { backgroundColor: themeColors.primary + '20' },
                ]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                  triggerHaptic('light');
                }}
              >
                <Text style={[
                  styles.pickerItemText,
                  isDark && styles.textDark,
                  selectedValue === item && { color: themeColors.primary, fontWeight: '700' }
                ]}>
                  {item}
                </Text>
                {selectedValue === item && (
                  <Ionicons name="checkmark-circle" size={24} color={themeColors.primary} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.pickerList}
          />
        </View>
      </Pressable>
    </Modal>
  );

  const renderDatePicker = () => {
    if (!showDatePicker) return null;

    if (Platform.OS === 'ios') {
      return (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={styles.iosPickerOverlay}>
            <View style={[styles.iosPickerContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={cancelDateIOS}>
                  <Text style={[styles.iosPickerButton, { color: '#8e8e93' }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.iosPickerTitle, { color: isDark ? '#fff' : '#000' }]}>Select Date</Text>
                <TouchableOpacity onPress={confirmDateIOS}>
                  <Text style={[styles.iosPickerButton, { color: themeColors.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={birthDate}
                mode="date"
                display="spinner"
                onChange={onDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1950, 0, 1)}
                textColor={isDark ? '#fff' : undefined}
              />
            </View>
          </View>
        </Modal>
      );
    }

    return (
      <DateTimePicker
        value={birthDate}
        mode="date"
        display="default"
        onChange={onDateChange}
        maximumDate={new Date()}
        minimumDate={new Date(1950, 0, 1)}
      />
    );
  };

  // ─── RENDER FIELD WITH TOOLTIP ──────────────────────────────────────
  const renderFieldWithTooltip = (label: string, field: React.ReactNode, termKey: string) => (
    <View style={styles.fieldWithTooltip}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.label, isDark && styles.textDark]}>{label}</Text>
        <TermTooltip term={termKey} isDark={isDark} />
      </View>
      {field}
    </View>
  );

  // ─── RENDER STEPS ──────────────────────────────────────────────────────
  const renderStep1 = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.delay(100)} style={styles.stepContainer}>
      {/* Baby Name */}
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, isDark && styles.textDark]}>Baby's Name</Text>
          <Text style={styles.required}>*</Text>
        </View>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
          <Ionicons name="person-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
          <TextInput
            ref={nameInputRef}
            style={[styles.input, isDark && styles.textDark]}
            value={name}
            onChangeText={setName}
            placeholder="Enter baby's name"
            placeholderTextColor={isDark ? '#64748b' : '#999'}
            autoFocus
            maxLength={50}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>
      </View>

      {/* Birth Date & Time */}
      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, isDark && styles.textDark]}>Birth Date</Text>
            <Text style={styles.required}>*</Text>
          </View>
          <TouchableOpacity
            style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <Text style={[styles.input, isDark && styles.textDark]}>
              {birthDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          {renderDatePicker()}
        </View>

        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Birth Time</Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
            <Ionicons name="time-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              value={birthTime}
              onChangeText={setBirthTime}
              placeholder="e.g., 3:30 PM"
              placeholderTextColor={isDark ? '#64748b' : '#999'}
            />
          </View>
        </View>
      </View>

      {/* Age Display */}
      <View style={[styles.ageChip, { backgroundColor: themeColors.primary + '15' }]}>
        <Text style={[styles.ageChipText, { color: themeColors.primary }]}>
          {ageDisplay} {ageDisplay !== 'Not born yet' ? 'old' : ''}
        </Text>
      </View>

      {/* Relationship */}
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, isDark && styles.textDark]}>You are the baby's</Text>
          <Text style={styles.required}>*</Text>
        </View>
        <View style={styles.relationshipContainer}>
          {(['Mother', 'Father', 'Guardian'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[
                styles.relationshipButton,
                creatorRelationship === r && {
                  borderColor: themeColors.primary,
                  backgroundColor: themeColors.primary + '15',
                },
                isDark && styles.relationshipButtonDark,
              ]}
              onPress={() => { setCreatorRelationship(r); triggerHaptic('light'); }}
              activeOpacity={0.7}
            >
              <Text style={styles.relationshipEmoji}>
                {r === 'Mother' ? '👩' : r === 'Father' ? '👨' : '🛡️'}
              </Text>
              <Text style={[
                styles.relationshipText,
                creatorRelationship === r && { color: themeColors.primary, fontWeight: '700' },
                isDark && styles.textDark,
              ]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Gender */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Gender</Text>
        <View style={styles.genderContainer}>
          {(['boy', 'girl', 'other'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderButton,
                gender === g && {
                  borderColor: themeColors.primary,
                  backgroundColor: themeColors.primary + '15',
                },
                isDark && styles.genderButtonDark,
              ]}
              onPress={() => { setGender(g); triggerHaptic('light'); }}
              activeOpacity={0.7}
            >
              <Text style={styles.genderEmoji}>{g === 'boy' ? '👦' : g === 'girl' ? '👧' : '👶'}</Text>
              <Text style={[
                styles.genderText,
                gender === g && { color: themeColors.primary, fontWeight: '700' },
                isDark && styles.textDark,
              ]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Skin Tone */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Skin Tone</Text>
        <View style={styles.skinToneContainer}>
          {SKIN_TONES.map((tone) => (
            <TouchableOpacity
              key={tone.id}
              style={[
                styles.skinToneButton,
                skinTone === tone.id && {
                  borderColor: themeColors.primary,
                  backgroundColor: themeColors.primary + '15',
                },
                isDark && styles.skinToneButtonDark,
              ]}
              onPress={() => { setSkinTone(tone.id); setAvatar(tone.emoji); triggerHaptic('light'); }}
              activeOpacity={0.7}
            >
              <Text style={styles.skinToneEmoji}>{tone.emoji}</Text>
              {skinTone === tone.id && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={14} color={themeColors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Avatar */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Avatar</Text>
        <TouchableOpacity
          style={[styles.avatarSelector, isDark && styles.avatarSelectorDark]}
          onPress={() => setShowAvatarPicker((v) => !v)}
          activeOpacity={0.8}
        >
          <SafeBabyAvatar avatar={avatar} gender={gender} size={80} />
          <Text style={[styles.changeAvatarText, { color: themeColors.primary }]}>
            {showAvatarPicker ? 'Tap to close' : 'Tap to change'}
          </Text>
        </TouchableOpacity>

        {showAvatarPicker && (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeIn} style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.avatarOption,
                  avatar === emoji && {
                    borderColor: themeColors.primary,
                    backgroundColor: themeColors.primary + '15',
                  },
                ]}
                onPress={() => { setAvatar(emoji); setShowAvatarPicker(false); triggerHaptic('light'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.avatarOption} onPress={takePhoto} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={24} color={themeColors.primary} />
              <Text style={[styles.avatarOptionLabel, { color: themeColors.primary }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarOption} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="images-outline" size={24} color={themeColors.primary} />
              <Text style={[styles.avatarOptionLabel, { color: themeColors.primary }]}>Gallery</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <Text style={[styles.stepIndicator, isDark && { color: '#94a3b8' }]}>1 of 2 • Basic Info</Text>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.delay(100)} style={styles.stepContainer}>
      <Text style={[styles.sectionSubtitle, { color: themeColors.primary }]}>
        ✨ Health & Birth Details
      </Text>
      <Text style={[styles.sectionHint, isDark && { color: '#94a3b8' }]}>
        Tap the ℹ️ icons for explanations
      </Text>

      {/* Current Measurements */}
      <View style={styles.sectionHeader}>
        <Ionicons name="fitness-outline" size={18} color={themeColors.primary} />
        <Text style={[styles.sectionHeaderText, isDark && styles.textDark]}>Current Measurements</Text>
      </View>

      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Weight (kg)</Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
            <Ionicons name="scale-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              value={weight}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, '');
                const parts = cleaned.split('.');
                const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
                setWeight(formatted);
              }}
              placeholder="e.g., 3.5"
              placeholderTextColor={isDark ? '#64748b' : '#999'}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </View>
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Height (cm)</Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
            <Ionicons name="resize-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              value={height}
              onChangeText={(text) => setHeight(text.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="e.g., 50"
              placeholderTextColor={isDark ? '#64748b' : '#999'}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        </View>
      </View>

      {/* Birth Details */}
      <View style={styles.sectionHeader}>
        <Ionicons name="medical-outline" size={18} color={themeColors.primary} />
        <Text style={[styles.sectionHeaderText, isDark && styles.textDark]}>Birth Details</Text>
      </View>

      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          {renderFieldWithTooltip(
            'Birth Weight (kg)',
            <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
              <Ionicons name="scale-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textDark]}
                value={birthWeight}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
                  setBirthWeight(formatted);
                }}
                placeholder="e.g., 3.2"
                placeholderTextColor={isDark ? '#64748b' : '#999'}
                keyboardType="decimal-pad"
                maxLength={5}
              />
            </View>,
            'Birth Weight'
          )}
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          {renderFieldWithTooltip(
            'Birth Height (cm)',
            <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
              <Ionicons name="resize-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textDark]}
                value={birthHeight}
                onChangeText={(text) => setBirthHeight(text.replace(/[^0-9]/g, '').slice(0, 3))}
                placeholder="e.g., 48"
                placeholderTextColor={isDark ? '#64748b' : '#999'}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>,
            'Birth Height'
          )}
        </View>
      </View>

      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          {renderFieldWithTooltip(
            'Head Circumference (cm)',
            <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
              <Ionicons name="aperture-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textDark]}
                value={birthHeadCircumference}
                onChangeText={(text) => setBirthHeadCircumference(text.replace(/[^0-9.]/g, '').slice(0, 5))}
                placeholder="e.g., 33"
                placeholderTextColor={isDark ? '#64748b' : '#999'}
                keyboardType="decimal-pad"
                maxLength={5}
              />
            </View>,
            'Head Circumference'
          )}
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          {renderFieldWithTooltip(
            'Gestational Weeks',
            <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
              <Ionicons name="calendar-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textDark]}
                value={gestationalWeeks}
                onChangeText={(text) => setGestationalWeeks(text.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="e.g., 40"
                placeholderTextColor={isDark ? '#64748b' : '#999'}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>,
            'Gestational Weeks'
          )}
        </View>
      </View>

      {/* Apgar Scores */}
      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          {renderFieldWithTooltip(
            'Apgar 1 min',
            <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
              <Ionicons name="pulse-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textDark]}
                value={apgar1Min}
                onChangeText={(text) => setApgar1Min(text.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="e.g., 8"
                placeholderTextColor={isDark ? '#64748b' : '#999'}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>,
            'Apgar Score'
          )}
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          {renderFieldWithTooltip(
            'Apgar 5 min',
            <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
              <Ionicons name="pulse-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, isDark && styles.textDark]}
                value={apgar5Min}
                onChangeText={(text) => setApgar5Min(text.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="e.g., 9"
                placeholderTextColor={isDark ? '#64748b' : '#999'}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>,
            'Apgar Score'
          )}
        </View>
      </View>

      {/* Delivery & Attendant */}
      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          {renderFieldWithTooltip(
            'Delivery Type',
            <TouchableOpacity
              style={[styles.inputWrapper, styles.pickerWrapper, isDark && styles.inputWrapperDark]}
              onPress={() => setShowPicker({ type: 'deliveryType' })}
              activeOpacity={0.7}
            >
              <Ionicons name="medkit-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <Text style={[styles.input, isDark && styles.textDark, !deliveryType && { color: isDark ? '#64748b' : '#999' }]}>
                {deliveryType || 'Select delivery type'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={isDark ? '#64748b' : '#999'} />
            </TouchableOpacity>,
            'Delivery Type'
          )}
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          {renderFieldWithTooltip(
            'Birth Attendant',
            <TouchableOpacity
              style={[styles.inputWrapper, styles.pickerWrapper, isDark && styles.inputWrapperDark]}
              onPress={() => setShowPicker({ type: 'birthAttendant' })}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <Text style={[styles.input, isDark && styles.textDark, !birthAttendant && { color: isDark ? '#64748b' : '#999' }]}>
                {birthAttendant || 'Select attendant'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={isDark ? '#64748b' : '#999'} />
            </TouchableOpacity>,
            'Birth Attendant'
          )}
        </View>
      </View>

      {/* Birth Place & Multiple Birth */}
      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Birth Place</Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
            <Ionicons name="location-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              value={birthPlace}
              onChangeText={setBirthPlace}
              placeholder="e.g., Hospital, Home"
              placeholderTextColor={isDark ? '#64748b' : '#999'}
            />
          </View>
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8, justifyContent: 'flex-end' }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Multiple Birth?</Text>
          <View style={styles.multipleBirthContainer}>
            <TouchableOpacity
              style={[
                styles.multipleBirthButton,
                multipleBirth === true && {
                  borderColor: themeColors.primary,
                  backgroundColor: themeColors.primary + '15',
                },
              ]}
              onPress={() => { setMultipleBirth(true); triggerHaptic('light'); }}
            >
              <Text style={[styles.multipleBirthText, multipleBirth === true && { color: themeColors.primary, fontWeight: '700' }]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.multipleBirthButton,
                multipleBirth === false && {
                  borderColor: themeColors.primary,
                  backgroundColor: themeColors.primary + '15',
                },
              ]}
              onPress={() => { setMultipleBirth(false); triggerHaptic('light'); }}
            >
              <Text style={[styles.multipleBirthText, multipleBirth === false && { color: themeColors.primary, fontWeight: '700' }]}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Birth Order & Feeding Plan */}
      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Birth Order</Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
            <Ionicons name="list-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              value={birthOrder}
              onChangeText={(text) => setBirthOrder(text.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="e.g., 1"
              placeholderTextColor={isDark ? '#64748b' : '#999'}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          {renderFieldWithTooltip(
            'Feeding Plan',
            <TouchableOpacity
              style={[styles.inputWrapper, styles.pickerWrapper, isDark && styles.inputWrapperDark]}
              onPress={() => setShowPicker({ type: 'feedingPlan' })}
              activeOpacity={0.7}
            >
              <Ionicons name="nutrition-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
              <Text style={[styles.input, isDark && styles.textDark, !feedingPlan && { color: isDark ? '#64748b' : '#999' }]}>
                {feedingPlan || 'Select feeding plan'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={isDark ? '#64748b' : '#999'} />
            </TouchableOpacity>,
            'Feeding Plan'
          )}
        </View>
      </View>

      {/* Blood Type & Allergies */}
      <View style={styles.sectionHeader}>
        <Ionicons name="heart-outline" size={18} color={themeColors.primary} />
        <Text style={[styles.sectionHeaderText, isDark && styles.textDark]}>Medical Information</Text>
      </View>

      <View style={styles.rowContainer}>
        <View style={[styles.halfWidth, { marginRight: 8 }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Blood Type</Text>
          <TouchableOpacity
            style={[styles.inputWrapper, styles.pickerWrapper, isDark && styles.inputWrapperDark]}
            onPress={() => setShowPicker({ type: 'bloodType' })}
            activeOpacity={0.7}
          >
            <Ionicons name="water-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <Text style={[styles.input, isDark && styles.textDark, !bloodType && { color: isDark ? '#64748b' : '#999' }]}>
              {bloodType || 'Select blood type'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={isDark ? '#64748b' : '#999'} />
          </TouchableOpacity>
        </View>
        <View style={[styles.halfWidth, { marginLeft: 8 }]}>
          <Text style={[styles.label, isDark && styles.textDark]}>Allergies (comma separated)</Text>
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
            <Ionicons name="warning-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, isDark && styles.textDark]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g., peanuts, dairy"
              placeholderTextColor={isDark ? '#64748b' : '#999'}
            />
          </View>
        </View>
      </View>

      {/* Medical Notes */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Medical Notes</Text>
        <View style={[styles.inputWrapper, styles.textAreaWrapper, isDark && styles.inputWrapperDark]}>
          <TextInput
            style={[styles.input, styles.textArea, isDark && styles.textDark]}
            value={medicalNotes}
            onChangeText={setMedicalNotes}
            placeholder="Any important medical information..."
            placeholderTextColor={isDark ? '#64748b' : '#999'}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
          />
        </View>
        <Text style={styles.charCount}>{medicalNotes.length}/500</Text>
      </View>

      <Text style={[styles.stepIndicator, isDark && { color: '#94a3b8' }]}>2 of 2 • Health Details</Text>
    </Animated.View>
  );

  // ─── MAIN RENDER ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
                <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint={isDark ? 'dark' : 'light'} style={styles.backBlur}>
                  <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </BlurView>
              </TouchableOpacity>

              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, isDark && styles.textDark]}>
                  {userProfile?.fullName?.split(' ')[0] ? `Hey ${userProfile.fullName.split(' ')[0]}! 👋` : 'Create Profile'}
                </Text>
                <Text style={[styles.headerSubtitle, isDark && { color: '#94a3b8' }]}>
                  Step {currentStep} of 2
                </Text>
              </View>
              <View style={styles.placeholder} />
            </Animated.View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: currentStep === 1 ? '50%' : '100%', backgroundColor: themeColors.primary }]} />
            </View>

            {/* Preview Card */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown.delay(50)}>
              <BlurView intensity={Platform.OS === 'ios' ? 90 : 100} tint={isDark ? 'dark' : 'light'} style={styles.previewCard}>
                <SafeBabyAvatar avatar={avatar} gender={gender} size={72} />
                <View style={styles.previewInfo}>
                  <Text style={[styles.previewName, isDark && styles.textDark]}>
                    {name.trim() || 'Baby Name'}
                  </Text>
                  <Text style={[styles.previewDetails, isDark && { color: '#94a3b8' }]}>
                    {ageDisplay} • {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </Text>
                  {userProfile?.fullName && (
                    <Text style={[styles.previewParent, { color: themeColors.primary }]}>
                      👤 {userProfile.fullName}
                    </Text>
                  )}
                </View>
              </BlurView>
            </Animated.View>

            {currentStep === 1 ? renderStep1() : renderStep2()}

            <View style={{ height: 40 }} />
          </Animated.ScrollView>

          {/* Bottom Actions */}
          <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
            <BlurView intensity={Platform.OS === 'ios' ? 90 : 100} tint={isDark ? 'dark' : 'light'} style={styles.bottomBlur}>
              {currentStep === 1 ? (
                <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[themeColors.primary, themeColors.secondary || themeColors.colors?.[1] || '#764ba2']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.buttonText}>Next Step</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.backStepButton}
                    onPress={() => setCurrentStep(1)}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.backStepText, { color: themeColors.primary }]}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.createButton, { flex: 1.5 }, isLoading && styles.buttonDisabled]}
                    onPress={() => handleCreateProfile(false)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[themeColors.primary, themeColors.secondary || themeColors.colors?.[1] || '#764ba2']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="add-circle" size={20} color="#fff" />
                          <Text style={styles.buttonText}>Add Another</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.createButton, { flex: 1.5 }, isLoading && styles.buttonDisabled]}
                    onPress={() => handleCreateProfile(true)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#10b981', '#059669']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.buttonText}>Create</Text>
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>

      {/* Picker Modals */}
      {renderPickerModal('Select Blood Type', BLOOD_TYPES, bloodType, setBloodType, showPicker.type === 'bloodType', () => setShowPicker({ type: null }))}
      {renderPickerModal('Select Delivery Type', DELIVERY_TYPES, deliveryType, setDeliveryType, showPicker.type === 'deliveryType', () => setShowPicker({ type: null }))}
      {renderPickerModal('Select Birth Attendant', BIRTH_ATTENDANTS, birthAttendant, setBirthAttendant, showPicker.type === 'birthAttendant', () => setShowPicker({ type: null }))}
      {renderPickerModal('Select Feeding Plan', FEEDING_PLANS, feedingPlan, setFeedingPlan, showPicker.type === 'feedingPlan', () => setShowPicker({ type: null }))}
    </View>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  iosPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  iosPickerButton: { fontSize: 16, fontWeight: '600' },
  iosPickerTitle: { fontSize: 16, fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  placeholder: { width: 44 },
  textDark: { color: '#fff' },

  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(102,126,234,0.2)',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 2 },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  previewInfo: { flex: 1, marginLeft: 16 },
  previewName: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  previewDetails: { fontSize: 13, color: '#666', marginBottom: 2 },
  previewParent: { fontSize: 12, fontWeight: '600' },

  stepContainer: { gap: 18 },
  stepIndicator: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 8 },

  inputGroup: { marginBottom: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  required: { color: '#ef4444', fontSize: 14, fontWeight: '700', marginLeft: 2 },
  sectionSubtitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  sectionHint: { fontSize: 12, marginBottom: 12, fontStyle: 'italic' },

  rowContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  halfWidth: { flex: 1 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  textAreaWrapper: { height: 100, alignItems: 'flex-start', paddingTop: 12 },
  textArea: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#999', textAlign: 'right', marginTop: 2, marginRight: 4 },

  pickerWrapper: { justifyContent: 'space-between' },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.08)',
  },
  pickerItemText: { fontSize: 16, fontWeight: '500', color: '#1a1a1a' },
  pickerList: { paddingHorizontal: 16, paddingTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  ageChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'center',
    marginVertical: 4,
  },
  ageChipText: { fontSize: 14, fontWeight: '600' },

  relationshipContainer: { flexDirection: 'row', gap: 10 },
  relationshipButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  relationshipButtonDark: { backgroundColor: 'rgba(30,30,40,0.3)' },
  relationshipEmoji: { fontSize: 28, marginBottom: 4 },
  relationshipText: { fontSize: 13, color: '#666', fontWeight: '600' },

  genderContainer: { flexDirection: 'row', gap: 10 },
  genderButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonDark: { backgroundColor: 'rgba(30,30,40,0.3)' },
  genderEmoji: { fontSize: 28, marginBottom: 4 },
  genderText: { fontSize: 13, color: '#666', fontWeight: '600' },

  skinToneContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  skinToneButton: {
    alignItems: 'center',
    padding: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  skinToneButtonDark: { backgroundColor: 'rgba(30,30,40,0.3)' },
  skinToneEmoji: { fontSize: 28 },
  checkmark: { position: 'absolute', bottom: -2, right: -2, backgroundColor: 'white', borderRadius: 8 },

  avatarSelector: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  avatarSelectorDark: {
    backgroundColor: 'rgba(30,30,40,0.5)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  changeAvatarText: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionEmoji: { fontSize: 28 },
  avatarOptionLabel: { fontSize: 10, marginTop: 2, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeaderText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },

  multipleBirthContainer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  multipleBirthButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.15)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  multipleBirthText: { fontSize: 14, fontWeight: '600', color: '#666' },

  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  bottomBlur: { borderRadius: 20, overflow: 'hidden', padding: 12 },
  nextButton: { borderRadius: 14, overflow: 'hidden' },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  backStepButton: {
    flex: 1,
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  backStepText: { fontSize: 15, fontWeight: '600' },
  createButton: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.5 },

  // ─── TOOLTIP STYLES ──────────────────────────────────────────────────
  fieldWithTooltip: { flex: 1 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  
  tooltipWrapper: {
    position: 'relative',
    marginLeft: 4,
    zIndex: 10,
  },
  tooltipTrigger: {
    padding: 2,
  },
  tooltipContainer: {
    position: 'absolute',
    top: -8,
    left: 24,
    width: Math.min(280, width - 60),
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
    zIndex: 1000,
  },
  tooltipShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  tooltipShadowAndroid: {
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  tooltipEmoji: {
    fontSize: 18,
  },
  tooltipTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  tooltipText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  tooltipCloseBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  tooltipCloseText: {
    fontSize: 14,
    fontWeight: '700',
  },
});