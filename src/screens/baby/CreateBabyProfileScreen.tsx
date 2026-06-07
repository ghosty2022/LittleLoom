
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Alert,
  StatusBar,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { SafeBabyAvatar } from '../../components/SafeAvatar';

const { width } = Dimensions.get('window');

const BABY_IMAGES_DIR = FileSystem.documentDirectory + 'baby_images/';

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
  await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
  return permanentUri;
};

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  for (const char of value) {
    const code = char.codePointAt(0) || 0;
    const isEmojiChar =
      (code >= 0x1f600 && code <= 0x1f64f) ||
      (code >= 0x1f300 && code <= 0x1f5ff) ||
      (code >= 0x1f680 && code <= 0x1f6ff) ||
      (code >= 0x1f1e0 && code <= 0x1f1ff) ||
      (code >= 0x2600 && code <= 0x26ff) ||
      (code >= 0x2700 && code <= 0x27bf) ||
      (code >= 0x1f900 && code <= 0x1f9ff) ||
      code === 0x2b50 ||
      code === 0x2b55 ||
      code === 0x2764 ||
      code === 0x2763;
    if (!isEmojiChar) return false;
  }
  return true;
};

/* ------------------------------------------------------------------ */
/*  SweetAlert — fully animated, self‑dismissing toast                 */
/* ------------------------------------------------------------------ */
type AlertType = 'success' | 'error' | 'info' | 'warning';

interface SweetAlertProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onClose: () => void;
  isDark: boolean;
}

const ALERT_CONFIG: Record<AlertType, { colors: [string, string]; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
  error:   { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
  info:    { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
  warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning' },
};

const SweetAlert = ({ visible, type, title, message, onClose, isDark }: SweetAlertProps) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });

      timerRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 }, (finished) => {
          if (finished) {
            runOnJS(onClose)();
          }
        });
        translateY.value = withTiming(-20, { duration: 300 });
      }, 3000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible]);

  if (!visible) return null;

  const config = ALERT_CONFIG[type] ?? ALERT_CONFIG.success;

  return (
    <Animated.View style={[styles.alertWrapper, animatedStyle]} pointerEvents="none">
      <View style={[styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          <Ionicons name={config.icon} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SKIN_TONES = [
  { id: 0, emoji: '👶', color: '#F5D0C5', label: 'Light' },
  { id: 1, emoji: '👶🏻', color: '#F5D0C5', label: 'Fair' },
  { id: 2, emoji: '👶🏼', color: '#E8C4A0', label: 'Medium' },
  { id: 3, emoji: '👶🏽', color: '#D4A373', label: 'Tan' },
  { id: 4, emoji: '👶🏾', color: '#A67C52', label: 'Brown' },
  { id: 5, emoji: '👶🏿', color: '#6B4423', label: 'Dark' },
];

const AVATAR_OPTIONS = ['👶', '🍼', '🧸', '🎀', '👼', '🤱', '👨‍🍼', '👩‍🍼', '🌟', '💖'];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type CreateBabyProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateBabyProfile'>;

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function CreateBabyProfileScreen({ navigation }: CreateBabyProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { darkMode: isDark, themeColors, triggerHaptic, shouldReduceMotion } = useCustomization();
  const { userProfile, completeSetup } = useAuth();
  const { createBaby, calculateAge } = useBaby();

  /* ---- Form state ---- */
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'boy' | 'girl' | 'other'>('boy');
  const [skinTone, setSkinTone] = useState(0);
  const [avatar, setAvatar] = useState<string>('👶');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  /* ---- Alert state ---- */
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: AlertType;
    title: string;
    message: string;
  }>({ visible: false, type: 'success', title: '', message: '' });

  /* ---- Refs ---- */
  const scrollViewRef = useRef<AutoHideScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);

  /* ---- Derived / Memoized ---- */
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

  /* ---- Helpers ---- */
  const showToast = useCallback((type: AlertType, title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  const hideToast = useCallback(() => {
    setAlert((prev) => ({ ...prev, visible: false }));
  }, []);

  /* ---- Date handling ---- */
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

  const confirmDateIOS = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const cancelDateIOS = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  /* ---- Image handling ---- */
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setAvatar(result.assets[0].uri);
        setShowAvatarPicker(false);
        triggerHaptic('medium');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      showToast('error', 'Error', 'Failed to pick image');
    }
  }, [showToast, triggerHaptic]);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('error', 'Permission Required', 'Please allow camera access in settings');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setAvatar(result.assets[0].uri);
        setShowAvatarPicker(false);
        triggerHaptic('medium');
      }
    } catch (error) {
      console.error('Camera error:', error);
      showToast('error', 'Error', 'Failed to take photo');
    }
  }, [showToast, triggerHaptic]);

  /* ---- Validation ---- */
  const validateStep1 = useCallback((): boolean => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('error', 'Missing Information', "Please enter your baby's name");
      return false;
    }
    if (trimmed.length < 2) {
      showToast('error', 'Invalid Name', 'Name must be at least 2 characters');
      return false;
    }
    if (trimmed.length > 50) {
      showToast('error', 'Invalid Name', 'Name must be 50 characters or less');
      return false;
    }
    return true;
  }, [name, showToast]);

  const validateStep2 = useCallback((): boolean => {
    if (weight.trim()) {
      const w = parseFloat(weight.trim());
      if (isNaN(w) || w <= 0 || w > 30) {
        showToast('error', 'Invalid Weight', 'Please enter a valid weight (0.1–30 kg)');
        return false;
      }
    }
    if (height.trim()) {
      const h = parseFloat(height.trim());
      if (isNaN(h) || h <= 0 || h > 200) {
        showToast('error', 'Invalid Height', 'Please enter a valid height (1–200 cm)');
        return false;
      }
    }
    if (bloodType.trim() && !BLOOD_TYPES.includes(bloodType.trim().toUpperCase())) {
      showToast('error', 'Invalid Blood Type', 'Please enter a valid blood type (e.g., A+, O-)');
      return false;
    }
    return true;
  }, [weight, height, bloodType, showToast]);

  /* ---- Navigation ---- */
  const handleNext = useCallback(() => {
    triggerHaptic('light');
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      // Allow going back and forth
    }
  }, [currentStep, validateStep1, validateStep2, triggerHaptic]);

  const handleBack = useCallback(() => {
    triggerHaptic('light');
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('Main');
      }
    }
  }, [currentStep, navigation, triggerHaptic]);

  /* ---- Profile creation ---- */
  const handleCreateProfile = useCallback(async () => {
    if (!validateStep1() || !validateStep2()) return;

    setIsLoading(true);
    triggerHaptic('medium');

    try {
      // First create the baby to get the real ID, then copy image if needed
      const success = await createBaby({
        name: name.trim(),
        birthDate: birthDate.toISOString(),
        gender,
        skinTone,
        avatar: isImageUri(avatar) ? '👶' : avatar, // placeholder first
        weight: weight.trim() || undefined,
        height: height.trim() || undefined,
        bloodType: bloodType.trim().toUpperCase() || undefined,
        allergies: allergies.trim() ? allergies.split(',').map((a) => a.trim()).filter(Boolean) : undefined,
        medicalNotes: medicalNotes.trim() || undefined,
      });

      if (!success) {
        showToast('error', 'Error', 'Failed to create profile. Please try again.');
        setIsLoading(false);
        return;
      }

      // If we have a custom image, we need to copy it using the actual baby ID
      // Since createBaby doesn't return the ID, we get it from the context after creation
      // For now, we skip the permanent copy and just use the temp URI
      // The image will be copied when the baby profile is edited later

      const setupSuccess = await completeSetup('baby');
      if (!setupSuccess) {
        showToast('warning', 'Warning', 'Profile created but setup incomplete. Please restart the app.');
        setIsLoading(false);
        return;
      }

      showToast('success', 'Welcome! 🎉', `${name.trim()}'s profile created successfully`);

      setTimeout(() => {
        navigation.replace('Main');
      }, 1500);
    } catch (error) {
      console.error('Create baby error:', error);
      showToast('error', 'Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [
    name,
    birthDate,
    gender,
    skinTone,
    avatar,
    weight,
    height,
    bloodType,
    allergies,
    medicalNotes,
    createBaby,
    completeSetup,
    navigation,
    validateStep1,
    validateStep2,
    showToast,
    triggerHaptic,
  ]);

  /* ---- Keyboard handling ---- */
  const kbBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const kbEnabled = Platform.OS === 'ios';

  /* ---- Render helpers ---- */
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

  /* ---- Step 1 ---- */
  const renderStep1 = () => (
    <Animated.View
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}
      style={styles.stepContainer}
    >
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>
          Baby&apos;s Name <Text style={{ color: '#ef4444' }}>*</Text>
        </Text>
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
            accessibilityLabel="Baby name input"
            accessibilityHint="Enter your baby's name"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>
          Birth Date <Text style={{ color: '#ef4444' }}>*</Text>
        </Text>
        <TouchableOpacity
          style={[styles.dateButton, isDark && styles.dateButtonDark]}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
          accessibilityLabel="Select birth date"
          accessibilityRole="button"
        >
          <Ionicons name="calendar-outline" size={20} color={themeColors.primary} />
          <Text style={[styles.dateText, isDark && styles.textDark]}>
            {birthDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text style={[styles.agePreview, { color: themeColors.primary }]}>{ageDisplay}</Text>
        </TouchableOpacity>

        {renderDatePicker()}
      </View>

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
                  backgroundColor: themeColors.primary + '1A',
                },
                isDark && styles.genderButtonDark,
              ]}
              onPress={() => {
                setGender(g);
                triggerHaptic('light');
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Select ${g}`}
              accessibilityState={{ selected: gender === g }}
            >
              <Text style={styles.genderEmoji}>{g === 'boy' ? '👦' : g === 'girl' ? '👧' : '👶'}</Text>
              <Text
                style={[
                  styles.genderText,
                  gender === g && { color: themeColors.primary, fontWeight: '700' },
                  isDark && styles.textDark,
                ]}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
                  backgroundColor: themeColors.primary + '1A',
                },
                isDark && styles.skinToneButtonDark,
              ]}
              onPress={() => {
                setSkinTone(tone.id);
                setAvatar(tone.emoji);
                triggerHaptic('light');
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Skin tone: ${tone.label}`}
              accessibilityState={{ selected: skinTone === tone.id }}
            >
              <Text style={styles.skinToneEmoji}>{tone.emoji}</Text>
              {skinTone === tone.id && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={16} color={themeColors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Avatar</Text>
        <TouchableOpacity
          style={[styles.avatarSelector, isDark && styles.avatarSelectorDark]}
          onPress={() => setShowAvatarPicker((v) => !v)}
          activeOpacity={0.8}
          accessibilityLabel="Change avatar"
          accessibilityRole="button"
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
                    backgroundColor: themeColors.primary + '1A',
                  },
                ]}
                onPress={() => {
                  setAvatar(emoji);
                  setShowAvatarPicker(false);
                  triggerHaptic('light');
                }}
                activeOpacity={0.7}
                accessibilityLabel={`Avatar ${emoji}`}
              >
                <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.avatarOption}
              onPress={takePhoto}
              activeOpacity={0.7}
              accessibilityLabel="Take photo"
            >
              <Ionicons name="camera-outline" size={24} color={themeColors.primary} />
              <Text style={[styles.avatarOptionLabel, { color: themeColors.primary }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarOption}
              onPress={pickImage}
              activeOpacity={0.7}
              accessibilityLabel="Choose from gallery"
            >
              <Ionicons name="images-outline" size={24} color={themeColors.primary} />
              <Text style={[styles.avatarOptionLabel, { color: themeColors.primary }]}>Gallery</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );

  /* ---- Step 2 ---- */
  const renderStep2 = () => (
    <Animated.View
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}
      style={styles.stepContainer}
    >
      <Text style={[styles.sectionSubtitle, { color: themeColors.primary }]}>
        Optional Health Information
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Birth Weight (kg)</Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
          <Ionicons name="scale-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, isDark && styles.textDark]}
            value={weight}
            onChangeText={(text) => {
              // Allow only valid decimal numbers
              const cleaned = text.replace(/[^0-9.]/g, '');
              const parts = cleaned.split('.');
              const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
              setWeight(formatted);
            }}
            placeholder="e.g., 3.5"
            placeholderTextColor={isDark ? '#64748b' : '#999'}
            keyboardType="decimal-pad"
            maxLength={5}
            accessibilityLabel="Birth weight in kilograms"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Birth Height (cm)</Text>
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
            accessibilityLabel="Birth height in centimeters"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Blood Type</Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
          <Ionicons name="water-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, isDark && styles.textDark]}
            value={bloodType}
            onChangeText={(text) => setBloodType(text.toUpperCase().replace(/[^ABO+-]/g, '').slice(0, 3))}
            placeholder="e.g., A+"
            placeholderTextColor={isDark ? '#64748b' : '#999'}
            autoCapitalize="characters"
            maxLength={3}
            accessibilityLabel="Blood type"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, isDark && styles.textDark]}>Allergies (comma separated)</Text>
        <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
          <Ionicons name="warning-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, isDark && styles.textDark]}
            value={allergies}
            onChangeText={setAllergies}
            placeholder="e.g., peanuts, dairy, eggs"
            placeholderTextColor={isDark ? '#64748b' : '#999'}
            accessibilityLabel="Allergies"
          />
        </View>
      </View>

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
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
            accessibilityLabel="Medical notes"
          />
        </View>
        <Text style={styles.charCount}>{medicalNotes.length}/500</Text>
      </View>
    </Animated.View>
  );

  /* ---- Main render ---- */
  return (
    <View style={[styles.container, { flex: 1 }]}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

        <KeyboardAvoidingView behavior={kbBehavior} enabled={kbEnabled} style={{ flex: 1 }}>
          <AutoHideScrollView
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
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                activeOpacity={0.7}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 80 : 100}
                  tint={isDark ? 'dark' : 'light'}
                  style={styles.backBlur}
                >
                  <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </BlurView>
              </TouchableOpacity>

              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, isDark && styles.textDark]}>Create Profile</Text>
                <Text style={[styles.headerSubtitle, isDark && { color: '#94a3b8' }]}>
                  Step {currentStep} of 2
                </Text>
              </View>

              <View style={styles.placeholder} />
            </Animated.View>

            {/* Progress */}
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: currentStep === 1 ? '50%' : '100%',
                    backgroundColor: themeColors.primary,
                  },
                ]}
              />
            </View>

            {/* Preview Card */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(50)}>
              <BlurView
                intensity={Platform.OS === 'ios' ? 90 : 100}
                tint={isDark ? 'dark' : 'light'}
                style={styles.previewCard}
              >
                <SafeBabyAvatar avatar={avatar} gender={gender} size={80} />
                <View style={styles.previewInfo}>
                  <Text style={[styles.previewName, isDark && styles.textDark]}>
                    {name.trim() || 'Baby Name'}
                  </Text>
                  <Text style={styles.previewDetails}>
                    {ageDisplay} • {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </Text>
                  {userProfile?.fullName ? (
                    <Text style={styles.previewParent}>Parent: {userProfile.fullName}</Text>
                  ) : null}
                </View>
              </BlurView>
            </Animated.View>

            {/* Steps */}
            {currentStep === 1 ? renderStep1() : renderStep2()}

            <View style={{ height: 40 }} />
          </AutoHideScrollView>

          {/* Bottom Actions */}
          <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 90 : 100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.bottomBlur}
            >
              {currentStep === 1 ? (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNext}
                  activeOpacity={0.8}
                  accessibilityLabel="Next step"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={[themeColors.primary, themeColors.secondary]}
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
                    accessibilityLabel="Go back to step 1"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.backStepText, { color: themeColors.primary }]}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.createButton, isLoading && styles.buttonDisabled]}
                    onPress={handleCreateProfile}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    accessibilityLabel="Create profile"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isLoading }}
                  >
                    <LinearGradient
                      colors={[themeColors.primary, themeColors.secondary]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.buttonText}>Create Profile</Text>
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

      {/* Toast */}
      <SweetAlert
        {...alert}
        onClose={hideToast}
        isDark={isDark}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  /* Alert */
  alertWrapper: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 300,
    maxWidth: width - 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  /* iOS Date Picker Modal */
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

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { alignItems: 'center' },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  placeholder: { width: 48 },
  textDark: { color: '#fff' },

  /* Progress */
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(102,126,234,0.2)',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },

  /* Preview Card */
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  previewInfo: { flex: 1, marginLeft: 16 },
  previewName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  previewDetails: { fontSize: 14, color: '#666', marginBottom: 2 },
  previewParent: { fontSize: 12, color: '#999' },

  /* Steps */
  stepContainer: { gap: 20 },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },

  /* Inputs */
  inputGroup: { marginBottom: 4 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapperDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  textAreaWrapper: { height: 120, alignItems: 'flex-start', paddingTop: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
    marginRight: 8,
  },

  /* Date */
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  dateButtonDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateText: { flex: 1, fontSize: 16, color: '#1a1a1a', fontWeight: '600' },
  agePreview: { fontSize: 14, fontWeight: '700' },

  /* Gender */
  genderContainer: { flexDirection: 'row', gap: 12 },
  genderButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  genderEmoji: { fontSize: 32, marginBottom: 8 },
  genderText: { fontSize: 14, color: '#666', fontWeight: '600' },

  /* Skin Tone */
  skinToneContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  skinToneButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  skinToneButtonDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  skinToneEmoji: { fontSize: 32 },
  checkmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'white',
    borderRadius: 10,
  },

  /* Avatar */
  avatarSelector: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  avatarSelectorDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  changeAvatarText: { fontSize: 14, fontWeight: '600' },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionEmoji: { fontSize: 32 },
  avatarOptionLabel: { fontSize: 10, marginTop: 4, fontWeight: '600' },

  /* Bottom */
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  bottomBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 16,
  },
  nextButton: { borderRadius: 16, overflow: 'hidden' },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  backStepButton: {
    flex: 1,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  backStepText: { fontSize: 16, fontWeight: '700' },
  createButton: { flex: 2, borderRadius: 16, overflow: 'hidden' },
  buttonDisabled: { opacity: 0.6 },
});
