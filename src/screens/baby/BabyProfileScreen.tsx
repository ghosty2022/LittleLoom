// src/screens/BabyFamilyCenterScreen.tsx
// ─────────────────────────────────────────────────────────────────────
// Baby profile + family center. Reads from BabyContext (profile) and
// TrackerContext (recent activity). Single source of truth — no mock data.
// ─────────────────────────────────────────────────────────────────────

import {
  StyleSheet,
  ActionSheetIOS,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  Text,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

import type { RootStackParamList } from '../../types/navigation';
import { useFamily } from '../../context/FamilyContext';
import { useBaby } from '../../context/BabyContext';
import type { Milestone } from '../../context/BabyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useTracker } from '../../hooks/useTrackerContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useCustomization } from '../../hooks/useCustomization';
import { supabase } from '@/utils/supabase';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DELIVERY_TYPES = ['Vaginal', 'C-Section', 'VBAC', 'Other'];
const BIRTH_ATTENDANTS = ['Obstetrician', 'Midwife', 'Family Doctor', 'Doula', 'Other'];
const FEEDING_PLANS = ['Breastfeeding', 'Formula', 'Combination', 'Pumping'];

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] as [string, string] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#06b6d4', gradient: ['#06b6d4', '#10b981'] as [string, string] },
];

const MILESTONE_CATEGORIES = [
  { id: 'physical', label: 'Physical', icon: 'walk-outline', color: '#6366f1' },
  { id: 'cognitive', label: 'Cognitive', icon: 'bulb-outline', color: '#f59e0b' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#10b981' },
  { id: 'language', label: 'Language', icon: 'chatbubble-outline', color: '#8b5cf6' },
  { id: 'emotional', label: 'Emotional', icon: 'heart-outline', color: '#ef4444' },
];

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👼', '🤱', '🍼', '🧸', '🎈', '🌟', '🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🦄', '🌈', '⭐', '🔆'];

// ─── TRACKER META ────────────────────────────────────────────────────
const TRACKER_META: Record<string, { emoji: string; color: string; label: string }> = {
  feed:        { emoji: '🍼', color: '#fa709a', label: 'Feeding' },
  sleep:       { emoji: '🌙', color: '#11998e', label: 'Sleep' },
  diaper:      { emoji: '👶', color: '#8B5CF6', label: 'Diaper' },
  potty:       { emoji: '💧', color: '#667eea', label: 'Potty' },
  growth:      { emoji: '📏', color: '#43e97b', label: 'Growth' },
  milestone:   { emoji: '🏆', color: '#ffd700', label: 'Milestone' },
  medication:  { emoji: '💊', color: '#ff6b6b', label: 'Medication' },
  temperature: { emoji: '🌡️', color: '#ef4444', label: 'Temperature' },
  symptom:     { emoji: '🤒', color: '#f97316', label: 'Symptom' },
  vaccine:     { emoji: '💉', color: '#3b82f6', label: 'Vaccine' },
  pumping:     { emoji: '🤱', color: '#ec4899', label: 'Pumping' },
  bath:        { emoji: '🛁', color: '#3b82f6', label: 'Bath' },
  tummy_time:  { emoji: '🤸', color: '#10b981', label: 'Tummy Time' },
  reading:     { emoji: '📚', color: '#6366f1', label: 'Reading' },
  walk:        { emoji: '🚶', color: '#0ea5e9', label: 'Walk' },
  note:        { emoji: '📝', color: '#64748b', label: 'Note' },
  mood:        { emoji: '😊', color: '#f59e0b', label: 'Mood' },
  default:     { emoji: '•',  color: '#94a3b8', label: 'Activity' },
};

type BabyFamilyCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;
type ProfileTab = 'overview' | 'milestones' | 'health' | 'danger';

// ─── HELPER: DB ↔ form enum conversion ───────────────────────────────────
// DB stores snake_case ("c_section", "family_doctor"); form shows Title Case.
const dbToFormEnum = (value?: string | null): string => {
  if (!value) return '';
  return value
    .split('_')
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
};

const formEnumToDb = (value?: string | null): string | null => {
  if (!value) return null;
  return value.toLowerCase().replace(/[\s-]+/g, '_');
};

// Safe string coercion for numeric fields (DB returns numbers).
const numToStr = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  return String(v);
};

// ─── UPLOAD IMAGE TO SUPABASE ────────────────────────────────────────────
const uploadImageToSupabase = async (localUri: string, babyId: string): Promise<string | null> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${babyId}_${Date.now()}.${fileExt}`;
    const filePath = `baby_avatars/${fileName}`;

    const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const { error } = await supabase.storage
      .from('baby_avatars')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[BabyProfile] Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('baby_avatars')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('[BabyProfile] Upload to Supabase error:', error);
    return null;
  }
};

// ─── HELPERS ────────────────────────────────────────────────────────────
const isImageUri = (value: string | undefined | null | any[]): boolean => {
  if (!value) return false;
  if (Array.isArray(value)) value = value.length > 0 ? value[0] : null;
  if (!value || typeof value !== 'string') return false;
  return (
    value.startsWith('http') ||
    value.startsWith('file://') ||
    value.startsWith('data:') ||
    value.startsWith('ph://') ||
    value.startsWith('assets-library://')
  );
};

const isEmoji = (value: string | undefined | null | any[]): boolean => {
  if (!value) return false;
  if (Array.isArray(value)) value = value.length > 0 ? value[0] : null;
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

const safeDiffMonths = (a: Date | string, b: Date | string): number => {
  try {
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    return Math.max(0, differenceInMonths(da, db));
  } catch { return 0; }
};

const safeDiffDays = (a: Date | string, b: Date | string): number => {
  try {
    const da = a instanceof Date ? a : new Date(a);
    const db = b instanceof Date ? b : new Date(b);
    return differenceInDays(da, db);
  } catch { return 0; }
};

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────

const SectionHeader = React.memo(({ title, subtitle, action, actionLabel, isDark, colors }: {
  title: string; subtitle?: string; action?: () => void; actionLabel?: string;
  isDark?: boolean; colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel || 'See All'}</Text>
          <Ionicons name="chevron-forward" size={14} color="#6366f1" />
        </TouchableOpacity>
      )}
    </View>
  );
});

const TabBar = React.memo(({ tabs, activeTab, onChange, isDark, colors }: {
  tabs: { key: ProfileTab; label: string; icon: string }[];
  activeTab: ProfileTab;
  onChange: (t: ProfileTab) => void;
  isDark?: boolean;
  colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const isDanger = tab.key === 'danger';
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[
              styles.tabItem,
              isActive && {
                backgroundColor: isDanger ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
              },
              isDanger && isActive && { borderColor: '#ef4444', borderWidth: 1 },
            ]}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={isActive ? (isDanger ? '#ef4444' : '#6366f1') : '#94a3b8'}
            />
            <Text style={[
              styles.tabLabel,
              { color: isActive ? (isDanger ? '#ef4444' : '#6366f1') : '#94a3b8' },
              isActive && { fontWeight: '700' },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const GlassCard = React.memo(({ children, style, onPress, active = false, delay = 0, isDark = true, colors }: {
  children: React.ReactNode; style?: any; onPress?: () => void; active?: boolean;
  delay?: number; isDark?: boolean; colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).springify()}
      style={[styles.glassCard, active && { borderColor: colors?.primary || '#6366f1', borderWidth: 2 }, style]}
    >
      <Wrapper onPress={onPress} activeOpacity={onPress ? 0.85 : 1} style={{ flex: 1 }}>
        <LinearGradient
          colors={isDark ? ['rgba(45,45,60,0.85)', 'rgba(35,35,50,0.65)'] : ['rgba(255,255,255,0.92)', 'rgba(248,250,255,0.85)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Animated.View>
  );
});

const SafeBabyAvatar = React.memo(({ avatar, gender = 'other', size = 72, showEditButton = false, onEdit, isDark, colors }: any) => {
  const normalizedAvatar = useMemo(() => {
    if (!avatar) return null;
    if (Array.isArray(avatar)) return avatar.length > 0 ? avatar[0] : null;
    if (typeof avatar === 'string') return avatar;
    return null;
  }, [avatar]);

  const hasImage = isImageUri(normalizedAvatar);
  const hasEmoji = isEmoji(normalizedAvatar);
  const genderOption = GENDER_OPTIONS.find(g => g.value === gender);
  const gradientColors = genderOption?.gradient || ['#6366f1', '#8b5cf6'];

  const imageSource = useMemo(() => {
    if (!normalizedAvatar) return null;
    if (
      typeof normalizedAvatar === 'string' &&
      (normalizedAvatar.startsWith('http') ||
        normalizedAvatar.startsWith('file://') ||
        normalizedAvatar.startsWith('ph://') ||
        normalizedAvatar.startsWith('assets-library://'))
    ) {
      return { uri: normalizedAvatar };
    }
    return null;
  }, [normalizedAvatar]);

  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);

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
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{normalizedAvatar}</Text>
        ) : (
          <Ionicons name={(genderOption?.icon as any) || 'ellipse'} size={size * 0.4} color="#fff" />
        )}
      </LinearGradient>
      {showEditButton && onEdit && (
        <TouchableOpacity
          style={[styles.editAvatarBtn, { bottom: -4, right: -4 }]}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.editAvatarGradient}>
            <Ionicons name="camera" size={14} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
});

const KpiPill = React.memo(({ icon, value, label, color, onPress, isDark, colors }: any) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.kpiPill}>
      <LinearGradient
        colors={[`${color}15`, `${color}05`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.kpiPillIconBg, { backgroundColor: `${color}15` }]}>
        <Text style={styles.kpiPillEmoji}>{icon}</Text>
      </View>
      <View style={styles.kpiPillBody}>
        <Text style={[styles.kpiPillValue, { color }]}>{value}</Text>
        <Text style={styles.kpiPillLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
});

const PickerModal = React.memo(({ visible, onClose, onSelect, options, selectedValue, title, isDark, colors }: {
  visible: boolean; onClose: () => void; onSelect: (value: string) => void;
  options: string[]; selectedValue: string; title: string; isDark?: boolean; colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={[styles.modalContent, { maxHeight: '60%' }]}>
          <LinearGradient
            colors={isDark ? ['rgba(45,45,60,0.98)', 'rgba(35,35,50,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalDragHandle}>
            <View style={styles.dragIndicator} />
          </View>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {options.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.pickerItem,
                  selectedValue === item && { backgroundColor: 'rgba(99,102,241,0.1)' },
                ]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[
                  styles.pickerItemText,
                  { color: isDark ? '#fff' : '#1e293b' },
                  selectedValue === item && { color: '#6366f1', fontWeight: '700' },
                ]}>
                  {item}
                </Text>
                {selectedValue === item && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

const EmojiPickerModal = React.memo(({ visible, onClose, onSelect, isDark, colors }: {
  visible: boolean; onClose: () => void; onSelect: (emoji: string) => void;
  isDark?: boolean; colors?: any;
}) => {
  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.emojiPickerOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <BlurView intensity={95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify()} style={styles.emojiPickerSheet}>
          <LinearGradient
            colors={isDark ? ['rgba(45,45,60,0.98)', 'rgba(35,35,50,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalDragHandle}>
            <View style={styles.dragIndicator} />
          </View>
          <View style={styles.emojiPickerHeader}>
            <Text style={[styles.emojiPickerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Pick an Emoji</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}
                onPress={() => {
                  onSelect(emoji);
                  onClose();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={styles.emojiButtonText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────
export default function BabyFamilyCenterScreen({ navigation, route }: BabyFamilyCenterScreenProps) {
  const { mode = 'baby', babyId: routeBabyId } = route.params || { mode: 'baby' };
  const { isDark, colors: appColors } = useApp();
  const { fullThemeColors } = useCustomization();
  const themeColors = appColors || fullThemeColors;
  const styles = useMemo(() => getStyles(isDark, themeColors), [isDark, themeColors]);
  const { userProfile } = useAuth();
  const { profile } = useUser();
  const sweetAlert = useSweetAlert();
  const {
    babies,
    updateBaby,
    currentBaby,
    loadBabies,
    deleteBaby,
    milestones,
    calculateAge,
  } = useBaby();
  const { entries: trackerEntries, refreshEntries } = useTracker();
  const { members, loadFamily } = useFamily();

  const isBabyMode = mode === 'baby';

  // ─── REFS ──────────────────────────────────────────────────────────────
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneForId = useRef<string | null>(null);

  // ─── COMPUTED CURRENT BABY (prefer fresh `babies` entry) ──────────────
  const currentBabyData = useMemo(() => {
    if (!isBabyMode) return null;
    const id = routeBabyId || currentBaby?.id;
    if (!id) return null;
    // Prefer the freshest copy from `babies` (updates after loadBabies),
    // then fall back to `currentBaby` (may lag by a render).
    return babies.find(b => b.id === id) || currentBaby || null;
  }, [isBabyMode, routeBabyId, babies, currentBaby]);

  // ─── STATE ──────────────────────────────────────────────────────────────
  const [babyName, setBabyName] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(2);
  const [selectedGender, setSelectedGender] = useState('boy');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [babyPhoto, setBabyPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // ─── Health / Birth state ───────────────────────────────────────────────
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [pediatrician, setPediatrician] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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
  const [birthTime, setBirthTime] = useState('');

  const [pickerState, setPickerState] = useState<{
    visible: boolean;
    type: 'bloodType' | 'deliveryType' | 'birthAttendant' | 'feedingPlan' | null;
  }>({ visible: false, type: null });

  // ─── Refs ──────────────────────────────────────────────────────────────
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });

  // ─── LOAD DATA FROM BABY (single source of truth) ─────────────────────
  // Handles every combination of types the DB might return: numbers,
  // strings, null, snake_case enums from the DB. Normalizes everything
  // into the form-friendly shape.
  const loadDataFromBaby = useCallback((baby: any) => {
    if (!baby) return;

    setBabyName(baby.name || '');
    setSelectedSkin(typeof baby.skinTone === 'number' ? baby.skinTone : 2);
    setSelectedGender(baby.gender || 'boy');
    setBirthDate(baby.birthDate ? new Date(baby.birthDate) : new Date());
    setBabyPhoto(baby.avatar || baby.avatar_url || null);

    setBloodType(baby.bloodType || '');
    setAllergies(Array.isArray(baby.allergies) ? baby.allergies.join(', ') : (baby.allergies || ''));
    setMedicalNotes(baby.medicalNotes || '');
    setWeight(numToStr(baby.weight));
    setHeight(numToStr(baby.height));
    setEmergencyContact(baby.emergencyContact || '');
    setPediatrician(baby.pediatrician || '');
    setNotificationsEnabled(baby.notificationsEnabled !== false);

    setBirthWeight(numToStr(baby.birthWeight));
    setBirthHeight(numToStr(baby.birthHeight));
    setBirthHeadCircumference(numToStr(baby.birthHeadCircumference));
    setGestationalWeeks(numToStr(baby.gestationalWeeks));
    setApgar1Min(numToStr(baby.apgar1Min));
    setApgar5Min(numToStr(baby.apgar5Min));
    setDeliveryType(dbToFormEnum(baby.deliveryType));
    setBirthAttendant(dbToFormEnum(baby.birthAttendant));
    setBirthPlace(baby.birthPlace || '');
    setMultipleBirth(baby.multipleBirth === true);
    setBirthOrder(numToStr(baby.birthOrder));
    setFeedingPlan(baby.feedingPlan ? dbToFormEnum(baby.feedingPlan) : '');
    setBirthTime(baby.birthTime || '');

    setIsEditing(false);
  }, []);

  // ─── REFRESH BABY DATA (lightweight) ───────────────────────────────────
  const refreshBabyDataLight = useCallback(async () => {
    if (isLoadingRef.current) return;
    const targetId = currentBabyData?.id || routeBabyId || currentBaby?.id;
    if (!targetId) return;

    isLoadingRef.current = true;
    try {
      await loadBabies(true);
      await refreshEntries();
      await loadFamily();

      // Read the fresh baby from the source list, not a captured closure.
      // `loadBabies(true)` updates the provider state; but since this
      // callback closes over the old `babies` array, we instead re-read
      // via a short-lived async read from Supabase — cheap and always
      // correct.
      const { data: fresh } = await supabase
        .from('babies')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (fresh && isMountedRef.current) {
        // Map minimally to the shape loadDataFromBaby expects
        loadDataFromBaby({
          id: fresh.id,
          name: fresh.name,
          skinTone: fresh.skin_tone ?? 2,
          gender:
            fresh.gender === 'male'
              ? 'boy'
              : fresh.gender === 'female'
              ? 'girl'
              : 'other',
          birthDate: fresh.date_of_birth,
          avatar: fresh.avatar || fresh.avatar_url || null,
          avatar_url: fresh.avatar_url || fresh.avatar || null,
          bloodType: fresh.blood_type,
          allergies: fresh.allergies,
          medicalNotes: fresh.medical_notes,
          weight: fresh.current_weight_kg,
          height: fresh.current_height_cm,
          emergencyContact: fresh.emergency_contact,
          pediatrician: fresh.pediatrician,
          notificationsEnabled: fresh.notifications_enabled !== false,
          birthWeight: fresh.birth_weight_kg,
          birthHeight: fresh.birth_height_cm,
          birthHeadCircumference: fresh.birth_head_circumference,
          gestationalWeeks: fresh.gestational_weeks,
          apgar1Min: fresh.apgar_1min,
          apgar5Min: fresh.apgar_5min,
          deliveryType: fresh.delivery_type,
          birthAttendant: fresh.birth_attendant,
          birthPlace: fresh.birth_place,
          multipleBirth: fresh.multiple_birth,
          birthOrder: fresh.birth_order,
          feedingPlan: fresh.feeding_plan,
          birthTime: fresh.birth_time,
        });
      }
    } catch (error) {
      console.error('Error refreshing baby data:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [currentBabyData?.id, routeBabyId, currentBaby?.id, loadBabies, refreshEntries, loadFamily, loadDataFromBaby]);

  // ─── LOAD FULL DATA ────────────────────────────────────────────────────
  const loadFullData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      await loadBabies(true);
      await loadFamily();
      await refreshEntries();

      if (currentBabyData && isMountedRef.current) {
        loadDataFromBaby(currentBabyData);
      }
    } catch (error) {
      console.error('Error loading full data:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadBabies, loadFamily, refreshEntries, currentBabyData, loadDataFromBaby]);

  // ─── INITIAL LOAD (per baby) ───────────────────────────────────────────
  useEffect(() => {
    if (!currentBabyData) return;
    if (initialLoadDoneForId.current === currentBabyData.id) return;
    initialLoadDoneForId.current = currentBabyData.id;
    loadDataFromBaby(currentBabyData);
  }, [currentBabyData, loadDataFromBaby]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // ─── FOCUS EFFECT ──────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (currentBabyData && !isLoadingRef.current) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          refreshBabyDataLight();
        }, 300);
      }
      return () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      };
    }, [currentBabyData, refreshBabyDataLight])
  );

  // ─── IMAGE HANDLING ────────────────────────────────────────────────────
  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    try {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch (error) {
      console.warn('[BabyProfile] ensureDirExists error:', error);
    }
  };

  const getPermanentImagePath = (targetBabyId: string) => {
    const dir = FileSystem.documentDirectory + 'baby_images/';
    return `${dir}${targetBabyId}_avatar_${Date.now()}.jpg`;
  };

  const persistPickedImage = async (sourceUri: string, targetBabyId: string): Promise<string | null> => {
    try {
      await ensureDirExists();
      const permanentUri = getPermanentImagePath(targetBabyId);

      if (sourceUri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(permanentUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (sourceUri.startsWith('data:')) {
        const base64Data = sourceUri.split(',')[1];
        if (base64Data) {
          await FileSystem.writeAsStringAsync(permanentUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        } else {
          throw new Error('Invalid data URI');
        }
      } else {
        await FileSystem.copyAsync({ from: sourceUri, to: permanentUri });
      }

      const fileInfo = await FileSystem.getInfoAsync(permanentUri);
      if (!fileInfo.exists) return null;
      return permanentUri;
    } catch (error) {
      console.error('[persistPickedImage] Failed:', error);
      return null;
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      sweetAlert.error('Permission Required', 'Please allow access to your camera.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setIsUploading(true);
        const targetBabyId = currentBabyData?.id || 'temp';
        const permanentUri = await persistPickedImage(result.assets[0].uri, targetBabyId);
        if (permanentUri) {
          setBabyPhoto(permanentUri);
          setIsEditing(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          sweetAlert.success('Photo Ready!', 'Tap Save Changes to apply.');
        } else {
          sweetAlert.error('Error', 'Failed to save photo');
        }
        setIsUploading(false);
      }
    } catch (error) {
      console.error('[BabyProfile] handleTakePhoto error:', error);
      setIsUploading(false);
      sweetAlert.error('Error', 'Failed to save photo');
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      sweetAlert.error('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setIsUploading(true);
        const targetBabyId = currentBabyData?.id || 'temp';
        const permanentUri = await persistPickedImage(result.assets[0].uri, targetBabyId);
        if (permanentUri) {
          setBabyPhoto(permanentUri);
          setIsEditing(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          sweetAlert.success('Photo Ready!', 'Tap Save Changes to apply.');
        } else {
          sweetAlert.error('Error', 'Failed to save photo');
        }
        setIsUploading(false);
      }
    } catch (error) {
      console.error('[BabyProfile] handlePickImage error:', error);
      setIsUploading(false);
      sweetAlert.error('Error', 'Failed to save photo');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setBabyPhoto(emoji);
    setIsEditing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sweetAlert.success('Avatar Updated!', 'Tap Save Changes to apply.');
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library', 'Pick Emoji'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) handleTakePhoto();
          else if (buttonIndex === 2) handlePickImage();
          else if (buttonIndex === 3) setShowEmojiPicker(true);
        }
      );
    } else {
      setShowImagePicker(true);
    }
  };

  // ─── SAVE HANDLING ─────────────────────────────────────────────────────
  const checkForChanges = useCallback(() => {
    if (!currentBabyData) return [];
    const changes: string[] = [];
    const b: any = currentBabyData;

    // Compare against normalized current values
    const currentWeight = numToStr(b.weight);
    const currentHeight = numToStr(b.height);
    const currentBirthWeight = numToStr(b.birthWeight);
    const currentBirthHeight = numToStr(b.birthHeight);
    const currentBirthHead = numToStr(b.birthHeadCircumference);
    const currentGestWeeks = numToStr(b.gestationalWeeks);
    const currentApgar1 = numToStr(b.apgar1Min);
    const currentApgar5 = numToStr(b.apgar5Min);
    const currentBirthOrder = numToStr(b.birthOrder);
    const currentAllergies = Array.isArray(b.allergies) ? b.allergies.join(', ') : (b.allergies || '');

    if (babyName !== (b.name || '')) changes.push('Name');
    if (selectedGender !== (b.gender || 'boy')) changes.push('Gender');
    if (babyPhoto !== (b.avatar || b.avatar_url || null)) changes.push('Profile photo');
    if (bloodType !== (b.bloodType || '')) changes.push('Blood type');
    if (allergies !== currentAllergies) changes.push('Allergies');
    if (medicalNotes !== (b.medicalNotes || '')) changes.push('Medical notes');
    if (weight !== currentWeight) changes.push('Weight');
    if (height !== currentHeight) changes.push('Height');
    if (emergencyContact !== (b.emergencyContact || '')) changes.push('Emergency contact');
    if (pediatrician !== (b.pediatrician || '')) changes.push('Pediatrician');
    if (birthWeight !== currentBirthWeight) changes.push('Birth weight');
    if (birthHeight !== currentBirthHeight) changes.push('Birth height');
    if (birthHeadCircumference !== currentBirthHead) changes.push('Head circumference');
    if (gestationalWeeks !== currentGestWeeks) changes.push('Gestational weeks');
    if (apgar1Min !== currentApgar1) changes.push('Apgar 1min');
    if (apgar5Min !== currentApgar5) changes.push('Apgar 5min');
    if (deliveryType !== dbToFormEnum(b.deliveryType)) changes.push('Delivery type');
    if (birthAttendant !== dbToFormEnum(b.birthAttendant)) changes.push('Birth attendant');
    if (birthPlace !== (b.birthPlace || '')) changes.push('Birth place');
    if (multipleBirth !== (b.multipleBirth === true)) changes.push('Multiple birth');
    if (birthOrder !== currentBirthOrder) changes.push('Birth order');
    if (feedingPlan !== dbToFormEnum(b.feedingPlan)) changes.push('Feeding plan');
    if (birthTime !== (b.birthTime || '')) changes.push('Birth time');
    if (notificationsEnabled !== (b.notificationsEnabled !== false)) changes.push('Notifications');

    return changes;
  }, [
    currentBabyData,
    babyName, selectedGender, babyPhoto, bloodType, allergies, medicalNotes,
    weight, height, emergencyContact, pediatrician,
    birthWeight, birthHeight, birthHeadCircumference, gestationalWeeks,
    apgar1Min, apgar5Min, deliveryType, birthAttendant, birthPlace,
    multipleBirth, birthOrder, feedingPlan, birthTime, notificationsEnabled,
  ]);

  const handleSavePress = () => {
    const changes = checkForChanges();
    if (changes.length === 0) {
      sweetAlert.toast('No Changes', 'No modifications detected');
      return;
    }
    sweetAlert.confirm(
      'Save Changes?',
      `You are about to update:\n${changes.join('\n')}`,
      async () => { await handleSave(); },
      () => {},
      'Save',
      'Cancel'
    );
  };

  const handleSave = async () => {
    try {
      if (!currentBabyData) return;
      setIsSaving(true);

      const currentAvatar = currentBabyData.avatar || currentBabyData.avatar_url || '';
      let avatarUrl = currentBabyData.avatar_url || currentBabyData.avatar || '';
      let avatarUpdated = false;

      if (
        babyPhoto &&
        babyPhoto !== currentAvatar &&
        (babyPhoto.startsWith('file://') ||
          babyPhoto.startsWith('content://') ||
          babyPhoto.startsWith('http'))
      ) {
        if (babyPhoto.startsWith('http')) {
          avatarUrl = babyPhoto;
          avatarUpdated = true;
        } else {
          try {
            const uploadedUrl = await uploadImageToSupabase(babyPhoto, currentBabyData.id);
            if (uploadedUrl) {
              avatarUrl = uploadedUrl;
              avatarUpdated = true;
            } else {
              const permanentUri = await persistPickedImage(babyPhoto, currentBabyData.id);
              if (permanentUri) {
                avatarUrl = permanentUri;
                avatarUpdated = true;
              }
            }
          } catch {
            const permanentUri = await persistPickedImage(babyPhoto, currentBabyData.id);
            if (permanentUri) {
              avatarUrl = permanentUri;
              avatarUpdated = true;
            }
          }
        }
      } else if (
        babyPhoto &&
        !babyPhoto.startsWith('file://') &&
        !babyPhoto.startsWith('content://') &&
        !babyPhoto.startsWith('http')
      ) {
        avatarUrl = babyPhoto;
        avatarUpdated = true;
      }

      const babyUpdates: any = {
        name: babyName,
        skinTone: selectedSkin,
        gender: selectedGender,
        birthDate: birthDate.toISOString(),
        bloodType: bloodType || null,
        allergies: allergies
          ? allergies.split(',').map(a => a.trim()).filter(Boolean)
          : [],
        medicalNotes: medicalNotes || null,
        weight: weight || null,
        height: height || null,
        emergencyContact: emergencyContact || null,
        pediatrician: pediatrician || null,
        notificationsEnabled: notificationsEnabled,
        birthWeight: birthWeight || null,
        birthHeight: birthHeight || null,
        birthHeadCircumference: birthHeadCircumference || null,
        gestationalWeeks: gestationalWeeks || null,
        apgar1Min: apgar1Min || null,
        apgar5Min: apgar5Min || null,
        deliveryType: formEnumToDb(deliveryType),
        birthAttendant: formEnumToDb(birthAttendant),
        birthPlace: birthPlace || null,
        multipleBirth: multipleBirth,
        birthOrder: birthOrder || null,
        feedingPlan: feedingPlan ? feedingPlan.toLowerCase() : null,
        birthTime: birthTime || null,
        lastUpdated: new Date().toISOString(),
      };

      if (avatarUpdated) {
        babyUpdates.avatar = avatarUrl;
        babyUpdates.avatar_url = avatarUrl;
      }

      await updateBaby(currentBabyData.id, babyUpdates);
      setIsEditing(false);

      if (avatarUpdated) setBabyPhoto(avatarUrl);

      await refreshBabyDataLight();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sweetAlert.success('Profile Saved!', `${babyName}'s profile has been updated.`);
    } catch (error) {
      console.error('[BabyProfile] Save error:', error);
      sweetAlert.error('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── MILESTONE HANDLING ────────────────────────────────────────────────
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    category: 'physical' as Milestone['category'],
    description: '',
    achievedAt: new Date().toISOString().split('T')[0],
  });

  const handleAddMilestone = async () => {
    if (!currentBabyData || !newMilestone.title) return;
    // Write via useTracker so it lands in the same table other screens read.
    const { addEntry } = require('../../hooks/useTrackerContext').useTracker;
    void addEntry; // placeholder; we use tracker below
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
      sweetAlert.success('Milestone Recorded!', 'Another amazing achievement!');
      await refreshBabyDataLight();
    } else {
      sweetAlert.error('Error', 'Could not save milestone');
    }
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    sweetAlert.confirm(
      'Delete Milestone',
      'Are you sure you want to delete this milestone?',
      async () => {
        await deleteMilestone(milestoneId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        sweetAlert.success('Deleted', 'Milestone has been removed.');
        await refreshBabyDataLight();
      },
      () => {},
      'Delete',
      'Cancel'
    );
  };

  // ─── DELETE BABY ────────────────────────────────────────────────────────
  const { verifyPassword } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBaby = useCallback(() => {
    if (isDeleting) return;

    sweetAlert.confirm(
      'Delete Profile?',
      `⚠️ This will permanently delete ${currentBabyData?.name}'s profile and all associated data. This action cannot be undone.`,
      () => {
        sweetAlert.hide();
        setTimeout(() => {
          sweetAlert.securePrompt(
            'Confirm Password',
            `Enter your password to permanently delete ${currentBabyData?.name}'s profile:`,
            async (password: string) => {
              if (!password) {
                sweetAlert.error('Error', 'Password is required');
                setIsDeleting(false);
                return;
              }
              if (isDeleting) return;
              setIsDeleting(true);
              try {
                const isValid = await verifyPassword(password);
                if (!isValid) {
                  sweetAlert.error('Error', 'Incorrect password. Please try again.');
                  setIsDeleting(false);
                  return;
                }
                if (currentBabyData) {
                  await deleteBaby(currentBabyData.id);
                  sweetAlert.success('Profile Deleted', `${currentBabyData.name}'s profile has been removed.`);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setIsDeleting(false);
                  setTimeout(() => navigation.goBack(), 1500);
                }
              } catch {
                sweetAlert.error('Error', 'Failed to delete profile');
                setIsDeleting(false);
              }
            },
            () => { setIsDeleting(false); },
            'Delete',
            'Cancel'
          );
        }, 300);
      },
      () => { setIsDeleting(false); },
      'Delete',
      'Cancel'
    );
  }, [currentBabyData, deleteBaby, navigation, sweetAlert, verifyPassword, isDeleting]);

  // ─── DATE PICKER ──────────────────────────────────────────────────────
  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
      setIsEditing(true);
    }
  };

  // ─── TAB CHANGE ────────────────────────────────────────────────────────
  const handleTabChange = useCallback((tab: ProfileTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ─── REFRESH ────────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFullData();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadFullData]);

  // ─── COMPUTED: RECENT ACTIVITY ─────────────────────────────────────────
  // Match on `babyId` only. Fall back to current baby's id if entry has
  // no babyId, so we never show an empty list when data exists.
  const recentActivities = useMemo(() => {
    if (!currentBabyData?.id) return [];
    const id = currentBabyData.id;
    return trackerEntries
      .filter((e: any) => {
        if (!e || e.isDeleted) return false;
        const entryBabyId = e.babyId || e.baby_id;
        if (!entryBabyId) return false;
        return String(entryBabyId) === String(id);
      })
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 30);
  }, [trackerEntries, currentBabyData?.id]);

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

  const genderOption = GENDER_OPTIONS.find(g => g.value === selectedGender);
  const ageDisplay = calculateAge(currentBabyData?.birthDate || new Date().toISOString());

  // ─── TABS ───────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'overview' as ProfileTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'milestones' as ProfileTab, label: 'Milestones', icon: 'trophy-outline' },
    { key: 'health' as ProfileTab, label: 'Health', icon: 'medical-outline' },
    { key: 'danger' as ProfileTab, label: 'Danger', icon: 'warning-outline' },
  ];

  // ─── RENDER PICKER ─────────────────────────────────────────────────────
  const renderPickerModal = () => {
    const type = pickerState.type;
    if (!type || !pickerState.visible) return null;

    let options: string[] = [];
    let title = '';
    let value = '';

    switch (type) {
      case 'bloodType': options = BLOOD_TYPES; title = 'Select Blood Type'; value = bloodType; break;
      case 'deliveryType': options = DELIVERY_TYPES; title = 'Select Delivery Type'; value = deliveryType; break;
      case 'birthAttendant': options = BIRTH_ATTENDANTS; title = 'Select Birth Attendant'; value = birthAttendant; break;
      case 'feedingPlan': options = FEEDING_PLANS; title = 'Select Feeding Plan'; value = feedingPlan; break;
    }

    return (
      <PickerModal
        visible={true}
        onClose={() => setPickerState({ visible: false, type: null })}
        onSelect={(val) => {
          switch (type) {
            case 'bloodType': setBloodType(val); break;
            case 'deliveryType': setDeliveryType(val); break;
            case 'birthAttendant': setBirthAttendant(val); break;
            case 'feedingPlan': setFeedingPlan(val); break;
          }
          setIsEditing(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        options={options}
        selectedValue={value}
        title={title}
        isDark={isDark}
        colors={themeColors}
      />
    );
  };

  // ─── LOADING ───────────────────────────────────────────────────────────
  if (!currentBabyData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.background }]} />
        <UniversalSpinner visible={true} text="Loading profile..." size="medium" overlay={false} section="main" />
      </View>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.background }]} />

      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Text style={styles.stickyTitle}>{currentBabyData.name}</Text>
        <Text style={styles.stickySubtitle}>{ageDisplay} • {genderOption?.label}</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={['#6366f1', '#8b5cf6']}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            style={[styles.editToggleBtn, isEditing && { backgroundColor: 'rgba(99,102,241,0.3)' }]}
          >
            <Ionicons
              name={isEditing ? 'close' : 'create-outline'}
              size={20}
              color={isEditing ? '#6366f1' : '#fff'}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile hero */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.profileHero}>
          <View style={styles.avatarSection}>
            <SafeBabyAvatar
              avatar={babyPhoto}
              gender={selectedGender}
              size={100}
              showEditButton
              onEdit={showPhotoOptions}
              isDark={isDark}
              colors={themeColors}
            />
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentBabyData.name}</Text>
            <Text style={styles.profileMeta}>{ageDisplay} • {genderOption?.label}</Text>
            <View style={styles.profileTags}>
              <View style={[styles.profileTag, {
                backgroundColor: `${medicalNotes || allergies ? '#f59e0b' : '#10b981'}20`,
              }]}>
                <Ionicons
                  name={medicalNotes || allergies ? 'medical-outline' : 'checkmark-circle'}
                  size={12}
                  color={medicalNotes || allergies ? '#f59e0b' : '#10b981'}
                />
                <Text style={[styles.profileTagText, {
                  color: medicalNotes || allergies ? '#f59e0b' : '#10b981',
                }]}>
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
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.dockContainer}>
          <View style={styles.dock}>
            {[
              { icon: '📏', label: 'Measure', color: '#6366f1' },
              { icon: '🍼', label: 'Feed', color: '#f59e0b' },
              { icon: '😴', label: 'Sleep', color: '#3b82f6' },
              { icon: '💊', label: 'Med', color: '#ef4444' },
              { icon: '🌟', label: 'Milestone', color: '#10b981' },
            ].map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.dockItem}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const screenMap: Record<string, string> = {
                    Measure: 'GrowthDashboard',
                    Feed: 'AddEntry',
                    Sleep: 'AddEntry',
                    Med: 'AddEntry',
                    Milestone: 'AddEntry',
                  };
                  const paramsMap: Record<string, any> = {
                    Feed: { trackerId: 'feed' },
                    Sleep: { trackerId: 'sleep' },
                    Med: { trackerId: 'medication' },
                    Milestone: { trackerId: 'milestone' },
                  };
                  navigation.navigate(screenMap[action.label] as never, paramsMap[action.label] as never);
                }}
              >
                <LinearGradient colors={[action.color, action.color + 'cc']} style={styles.dockGradient}>
                  <Text style={styles.dockIcon}>{action.icon}</Text>
                </LinearGradient>
                <Text style={styles.dockLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} isDark={isDark} colors={themeColors} />

        {/* ─── OVERVIEW ──────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            <View style={styles.kpiPillRow}>
              <KpiPill icon="🔥" value={babyStats?.streak || 0} label="Day Streak" color="#f59e0b" isDark={isDark} colors={themeColors} />
              <KpiPill icon="🌟" value={babyStats?.milestones || 0} label="Milestones" color="#ec4899" isDark={isDark} colors={themeColors} />
              <KpiPill icon="📝" value={babyStats?.entries || 0} label="Entries" color="#6366f1" isDark={isDark} colors={themeColors} />
            </View>

            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.birthDateCard}>
              <Ionicons name="calendar-outline" size={20} color="#6366f1" />
              <View style={styles.birthDateContent}>
                <Text style={styles.birthDateLabel}>Birth Date</Text>
                <Text style={styles.birthDateValue}>{format(birthDate, 'MMMM d, yyyy')}</Text>
                {birthTime ? <Text style={styles.birthTimeText}>🕐 {birthTime}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>

            {/* Birth details card */}
            <Animated.View entering={FadeInUp.delay(250).springify()}>
              <SectionHeader title="Birth Details" subtitle="Information from birth" isDark={isDark} colors={themeColors} />
              <GlassCard isDark={isDark} colors={themeColors}>
                <View style={styles.birthDetailsGrid}>
                  {[
                    { label: 'Birth Weight', value: birthWeight, suffix: ' kg' },
                    { label: 'Birth Height', value: birthHeight, suffix: ' cm' },
                    { label: 'Head Circumference', value: birthHeadCircumference, suffix: ' cm' },
                    { label: 'Gestational Weeks', value: gestationalWeeks, suffix: ' weeks' },
                    { label: 'Apgar (1 min)', value: apgar1Min, suffix: '' },
                    { label: 'Apgar (5 min)', value: apgar5Min, suffix: '' },
                    { label: 'Delivery Type', value: deliveryType, suffix: '' },
                    { label: 'Birth Attendant', value: birthAttendant, suffix: '' },
                    { label: 'Birth Place', value: birthPlace, suffix: '' },
                    { label: 'Feeding Plan', value: feedingPlan, suffix: '' },
                    { label: 'Blood Type', value: bloodType, suffix: '' },
                    { label: 'Birth Order', value: birthOrder, suffix: '' },
                    { label: 'Multiple Birth', value: multipleBirth ? 'Yes' : (birthOrder ? 'No' : ''), suffix: '' },
                  ].map((item, index) => {
                    const hasValue =
                      item.value !== undefined &&
                      item.value !== null &&
                      String(item.value).trim() !== '';
                    return (
                      <View key={index} style={[styles.birthDetailItem, !hasValue && styles.birthDetailItemEmpty]}>
                        <Text style={styles.birthDetailLabel}>{item.label}</Text>
                        <Text style={[styles.birthDetailValue, !hasValue && styles.birthDetailValueEmpty]}>
                          {hasValue ? `${item.value}${item.suffix}` : '— Not recorded —'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {(!birthWeight && !birthHeight && !birthHeadCircumference &&
                  !gestationalWeeks && !apgar1Min && !deliveryType &&
                  !feedingPlan && !bloodType) && (
                  <View style={styles.emptyBirthDetails}>
                    <Text style={styles.emptyBirthDetailsText}>No birth details recorded yet</Text>
                    <Text style={styles.emptyBirthDetailsSubtext}>Tap the Health tab to add birth information</Text>
                  </View>
                )}
                {(!birthWeight || !birthHeight || !birthHeadCircumference) && (
                  <TouchableOpacity
                    style={[styles.addBirthDetailsBtn, { backgroundColor: 'rgba(99,102,241,0.1)' }]}
                    onPress={() => { setActiveTab('health'); setIsEditing(true); }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#6366f1" />
                    <Text style={styles.addBirthDetailsText}>Add Missing Birth Details</Text>
                  </TouchableOpacity>
                )}
              </GlassCard>
            </Animated.View>

            {/* Recent activity — from TrackerContext */}
            <Animated.View entering={FadeInUp.delay(500).springify()}>
              <SectionHeader
                title="Recent Activity"
                subtitle={`${recentActivities.length} entries`}
                action={() => navigation.navigate('Timeline' as never, { babyId: currentBabyData?.id } as never)}
                actionLabel="See All"
                isDark={isDark}
                colors={themeColors}
              />
              {recentActivities.length === 0 ? (
                <GlassCard style={styles.emptyCard} isDark={isDark} colors={themeColors}>
                  <View style={styles.emptyStateIcon}>
                    <Ionicons name="time-outline" size={32} color="#6366f1" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
                  <Text style={styles.emptyText}>Start tracking your baby's daily activities to see them here.</Text>
                </GlassCard>
              ) : (
                <View style={styles.activitiesList}>
                  {recentActivities.slice(0, 8).map((activity: any, index: number) => {
                    const trackerId = String(
                      activity.trackerId || activity.tracker_id || activity.type || 'note'
                    );
                    const meta = TRACKER_META[trackerId] || TRACKER_META.default;
                    const ts = Number(activity.timestamp) || Date.now();
                    return (
                      <GlassCard
                        key={activity.id || index}
                        style={styles.activityCard}
                        delay={index * 40}
                        isDark={isDark}
                        colors={themeColors}
                      >
                        <View style={styles.activityRow}>
                          <View style={[styles.activityIcon, { backgroundColor: `${meta.color}18` }]}>
                            <Text style={styles.activityEmoji}>{meta.emoji}</Text>
                          </View>
                          <View style={styles.activityContent}>
                            <Text style={styles.activityTitle}>
                              {activity.title || meta.label}
                            </Text>
                            {activity.notes ? (
                              <Text style={styles.activityDetails} numberOfLines={2}>
                                {activity.notes}
                              </Text>
                            ) : null}
                            <Text style={styles.activityTime}>
                              {format(new Date(ts), 'MMM d, h:mm a')}
                            </Text>
                          </View>
                        </View>
                      </GlassCard>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </>
        )}

        {/* ─── MILESTONES ──────────────────────────────────────────── */}
        {activeTab === 'milestones' && (
          <>
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
                  <GlassCard
                    key={milestone.id}
                    style={styles.milestoneCard}
                    delay={index * 100}
                    isDark={isDark}
                    colors={themeColors}
                  >
                    <View style={styles.milestoneRow}>
                      <View style={[styles.milestoneIcon, { backgroundColor: `${category?.color || '#6366f1'}20` }]}>
                        <Ionicons
                          name={(category?.icon as any) || 'star'}
                          size={24}
                          color={category?.color || '#6366f1'}
                        />
                      </View>
                      <View style={styles.milestoneContent}>
                        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                        <Text style={[styles.milestoneCategory, { color: category?.color || '#6366f1' }]}>
                          {category?.label}
                        </Text>
                        <Text style={styles.milestoneDate}>
                          {format(new Date(milestone.achievedAt), 'MMM d, yyyy')}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => handleDeleteMilestone(milestone.id)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    {milestone.description ? (
                      <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                    ) : null}
                  </GlassCard>
                );
              })
            ) : (
              <GlassCard style={styles.emptyCard} delay={100} isDark={isDark} colors={themeColors}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="trophy-outline" size={32} color="#f59e0b" />
                </View>
                <Text style={styles.emptyStateTitle}>No Milestones Yet</Text>
                <Text style={styles.emptyText}>
                  Record your baby's first smile, steps, words, and more!
                </Text>
              </GlassCard>
            )}
          </>
        )}

        {/* ─── HEALTH ──────────────────────────────────────────────── */}
        {activeTab === 'health' && (
          <>
            <GlassCard style={styles.formCard} delay={100} isDark={isDark} colors={themeColors}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Health Information</Text>
                {!isEditing ? (
                  <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
                    <Ionicons name="create-outline" size={20} color="#6366f1" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.editingBadge}>
                    <Text style={styles.editingBadgeText}>Editing</Text>
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Blood Type</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, !isEditing && styles.inputDisabled]}
                  onPress={() => isEditing && setPickerState({ visible: true, type: 'bloodType' })}
                  disabled={!isEditing}
                >
                  <Ionicons name="water-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <Text style={[styles.inputFieldText, !bloodType && styles.placeholderText]}>
                    {bloodType || 'Select blood type'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={isEditing ? '#6366f1' : '#64748b'} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Allergies (comma separated)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="warning-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={allergies}
                    onChangeText={(text) => { setAllergies(text); setIsEditing(true); }}
                    placeholder="e.g., Peanuts, Dairy"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="fitness-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={weight}
                    onChangeText={(text) => { setWeight(text); setIsEditing(true); }}
                    placeholder="e.g., 4.2"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="resize-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={height}
                    onChangeText={(text) => { setHeight(text); setIsEditing(true); }}
                    placeholder="e.g., 58"
                    keyboardType="decimal-pad"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Medical Notes</Text>
                <TextInput
                  style={[styles.textArea, !isEditing && styles.inputDisabled]}
                  value={medicalNotes}
                  onChangeText={(text) => { setMedicalNotes(text); setIsEditing(true); }}
                  placeholder="Any important medical information..."
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#666"
                  editable={isEditing}
                  selectionColor="#6366f1"
                />
              </View>
            </GlassCard>

            <GlassCard style={styles.formCard} delay={150} isDark={isDark} colors={themeColors}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Birth Details</Text>
                {!isEditing ? (
                  <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
                    <Ionicons name="create-outline" size={20} color="#6366f1" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.editingBadge}>
                    <Text style={styles.editingBadgeText}>Editing</Text>
                  </View>
                )}
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.halfWidth, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Birth Weight (kg)</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="scale-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={birthWeight}
                      onChangeText={(text) => { setBirthWeight(text); setIsEditing(true); }}
                      placeholder="3.2"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
                <View style={[styles.halfWidth, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Birth Height (cm)</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="resize-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={birthHeight}
                      onChangeText={(text) => { setBirthHeight(text); setIsEditing(true); }}
                      placeholder="48"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.halfWidth, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Head Circumference (cm)</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="aperture-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={birthHeadCircumference}
                      onChangeText={(text) => { setBirthHeadCircumference(text); setIsEditing(true); }}
                      placeholder="33"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
                <View style={[styles.halfWidth, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Gestational Weeks</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="calendar-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={gestationalWeeks}
                      onChangeText={(text) => { setGestationalWeeks(text); setIsEditing(true); }}
                      placeholder="40"
                      keyboardType="number-pad"
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.halfWidth, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Apgar 1 min</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="pulse-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={apgar1Min}
                      onChangeText={(text) => { setApgar1Min(text); setIsEditing(true); }}
                      placeholder="8"
                      keyboardType="number-pad"
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
                <View style={[styles.halfWidth, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Apgar 5 min</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="pulse-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={apgar5Min}
                      onChangeText={(text) => { setApgar5Min(text); setIsEditing(true); }}
                      placeholder="9"
                      keyboardType="number-pad"
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.halfWidth, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Delivery Type</Text>
                  <TouchableOpacity
                    style={[styles.inputContainer, !isEditing && styles.inputDisabled]}
                    onPress={() => isEditing && setPickerState({ visible: true, type: 'deliveryType' })}
                    disabled={!isEditing}
                  >
                    <Ionicons name="medkit-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <Text style={[styles.inputFieldText, !deliveryType && styles.placeholderText]}>
                      {deliveryType || 'Select delivery type'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={isEditing ? '#6366f1' : '#64748b'} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.halfWidth, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Birth Attendant</Text>
                  <TouchableOpacity
                    style={[styles.inputContainer, !isEditing && styles.inputDisabled]}
                    onPress={() => isEditing && setPickerState({ visible: true, type: 'birthAttendant' })}
                    disabled={!isEditing}
                  >
                    <Ionicons name="people-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <Text style={[styles.inputFieldText, !birthAttendant && styles.placeholderText]}>
                      {birthAttendant || 'Select attendant'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={isEditing ? '#6366f1' : '#64748b'} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.halfWidth, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Birth Place</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="location-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={birthPlace}
                      onChangeText={(text) => { setBirthPlace(text); setIsEditing(true); }}
                      placeholder="Hospital, Home, etc."
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
                <View style={[styles.halfWidth, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Feeding Plan</Text>
                  <TouchableOpacity
                    style={[styles.inputContainer, !isEditing && styles.inputDisabled]}
                    onPress={() => isEditing && setPickerState({ visible: true, type: 'feedingPlan' })}
                    disabled={!isEditing}
                  >
                    <Ionicons name="nutrition-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <Text style={[styles.inputFieldText, !feedingPlan && styles.placeholderText]}>
                      {feedingPlan || 'Select feeding plan'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={isEditing ? '#6366f1' : '#64748b'} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.rowContainer}>
                <View style={[styles.halfWidth, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Birth Order</Text>
                  <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                    <Ionicons name="list-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      value={birthOrder}
                      onChangeText={(text) => { setBirthOrder(text); setIsEditing(true); }}
                      placeholder="1"
                      keyboardType="number-pad"
                      placeholderTextColor="#666"
                      editable={isEditing}
                      selectionColor="#6366f1"
                    />
                  </View>
                </View>
                <View style={[styles.halfWidth, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Multiple Birth</Text>
                  <View style={[styles.multipleBirthContainer, !isEditing && styles.inputDisabled]}>
                    <TouchableOpacity
                      style={[
                        styles.multipleBirthButton,
                        multipleBirth === true && {
                          borderColor: '#6366f1',
                          backgroundColor: 'rgba(99,102,241,0.15)',
                        },
                      ]}
                      onPress={() => { if (isEditing) { setMultipleBirth(true); setIsEditing(true); } }}
                      disabled={!isEditing}
                    >
                      <Text style={[styles.multipleBirthText, multipleBirth === true && { color: '#6366f1', fontWeight: '700' }]}>
                        Yes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.multipleBirthButton,
                        multipleBirth === false && {
                          borderColor: '#6366f1',
                          backgroundColor: 'rgba(99,102,241,0.15)',
                        },
                      ]}
                      onPress={() => { if (isEditing) { setMultipleBirth(false); setIsEditing(true); } }}
                      disabled={!isEditing}
                    >
                      <Text style={[styles.multipleBirthText, multipleBirth === false && { color: '#6366f1', fontWeight: '700' }]}>
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Birth Time</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="time-outline" size={20} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={birthTime}
                    onChangeText={(text) => { setBirthTime(text); setIsEditing(true); }}
                    placeholder="3:30 PM"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.formCard} delay={200} isDark={isDark} colors={themeColors}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Emergency & Pediatrician</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Emergency Contact</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="call-outline" size={20} color="#ef4444" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={emergencyContact}
                    onChangeText={(text) => { setEmergencyContact(text); setIsEditing(true); }}
                    placeholder="e.g., +1 (555) 123-4567"
                    keyboardType="phone-pad"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pediatrician</Text>
                <View style={[styles.inputContainer, !isEditing && styles.inputDisabled]}>
                  <Ionicons name="medical-outline" size={20} color="#10b981" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={pediatrician}
                    onChangeText={(text) => { setPediatrician(text); setIsEditing(true); }}
                    placeholder="Dr. Smith - City Children's Hospital"
                    placeholderTextColor="#666"
                    editable={isEditing}
                    selectionColor="#6366f1"
                  />
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.formCard} delay={300} isDark={isDark} colors={themeColors}>
              <View style={styles.sectionHeaderWithEdit}>
                <Text style={styles.sectionLabel}>Preferences</Text>
              </View>

              <View style={styles.preferenceRow}>
                <View style={styles.preferenceInfo}>
                  <Ionicons name="notifications-outline" size={22} color="#6366f1" />
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceTitle}>Notifications</Text>
                    <Text style={styles.preferenceDesc}>Receive milestone & health reminders</Text>
                  </View>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => { setNotificationsEnabled(value); setIsEditing(true); }}
                  trackColor={{ false: '#334155', true: '#6366f1' }}
                  thumbColor="#fff"
                  disabled={!isEditing}
                />
              </View>
            </GlassCard>

            {isEditing && (
              <TouchableOpacity onPress={handleSavePress} style={styles.saveButton}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.saveButtonGradient}>
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ─── DANGER ──────────────────────────────────────────────── */}
        {activeTab === 'danger' && (
          <Animated.View entering={FadeInUp} style={styles.tabPanel}>
            <GlassCard style={styles.dangerCard} delay={100} isDark={isDark} colors={themeColors}>
              <View style={styles.dangerIconContainer}>
                <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.dangerIcon}>
                  <Ionicons name="warning" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <Text style={styles.dangerDescription}>
                Permanently delete {currentBabyData?.name}'s profile and all associated data. This action cannot be undone.
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
            </GlassCard>
            <View style={styles.dangerNote}>
              <Ionicons name="information-circle" size={14} color="#94a3b8" />
              <Text style={styles.dangerNoteText}>Consider exporting data before deletion</Text>
            </View>
          </Animated.View>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* Saving overlay */}
      <UniversalSpinner
        visible={isSaving}
        text="Saving changes..."
        size="medium"
        overlay={true}
        blur={true}
        section="main"
      />

      {/* Image picker modal */}
      <Modal
        visible={showImagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImagePicker(false)}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowImagePicker(false)} activeOpacity={1} />
          <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
            <LinearGradient
              colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalDragHandle}><View style={styles.dragIndicator} /></View>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Change Profile Photo</Text>
              <TouchableOpacity onPress={() => setShowImagePicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>
            <View style={styles.imagePickerOptions}>
              <TouchableOpacity style={styles.imagePickerOption} onPress={handlePickImage}>
                <View style={[styles.imagePickerIcon, { backgroundColor: '#6366f120' }]}>
                  <Ionicons name="images-outline" size={28} color="#6366f1" />
                </View>
                <Text style={styles.imagePickerLabel}>Choose from Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imagePickerOption} onPress={handleTakePhoto}>
                <View style={[styles.imagePickerIcon, { backgroundColor: '#10b98120' }]}>
                  <Ionicons name="camera-outline" size={28} color="#10b981" />
                </View>
                <Text style={styles.imagePickerLabel}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.imagePickerOption}
                onPress={() => { setShowImagePicker(false); setShowEmojiPicker(true); }}
              >
                <View style={[styles.imagePickerIcon, { backgroundColor: '#f59e0b20' }]}>
                  <Ionicons name="happy-outline" size={28} color="#f59e0b" />
                </View>
                <Text style={styles.imagePickerLabel}>Pick Emoji</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Add milestone modal */}
      <Modal
        visible={showAddMilestone}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMilestone(false)}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowAddMilestone(false)} activeOpacity={1} />
          <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
            <LinearGradient
              colors={isDark ? ['rgba(45,45,60,0.95)', 'rgba(35,35,50,0.9)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,255,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalDragHandle}><View style={styles.dragIndicator} /></View>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Record Milestone</Text>
              <TouchableOpacity onPress={() => setShowAddMilestone(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Title
                </Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 52,
                    color: themeColors.text,
                    fontWeight: '600',
                    fontSize: 16,
                  }}
                  value={newMilestone.title}
                  onChangeText={(text) => setNewMilestone(prev => ({ ...prev, title: text }))}
                  placeholder="e.g., First Steps"
                  placeholderTextColor="#666"
                />
              </View>
              <View>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Category
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {MILESTONE_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setNewMilestone(prev => ({ ...prev, category: cat.id as Milestone['category'] }))}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: newMilestone.category === cat.id
                          ? `${cat.color}20`
                          : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        borderWidth: 1,
                        borderColor: newMilestone.category === cat.id ? cat.color : 'transparent',
                      }}
                    >
                      <Text style={{ color: newMilestone.category === cat.id ? cat.color : themeColors.text, fontWeight: '700', fontSize: 13 }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Description
                </Text>
                <TextInput
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    height: 80,
                    color: themeColors.text,
                    fontWeight: '500',
                    fontSize: 16,
                    textAlignVertical: 'top',
                  }}
                  value={newMilestone.description}
                  onChangeText={(text) => setNewMilestone(prev => ({ ...prev, description: text }))}
                  placeholder="Optional details..."
                  placeholderTextColor="#666"
                  multiline
                />
              </View>
              <TouchableOpacity onPress={handleAddMilestone} style={{ borderRadius: 14, overflow: 'hidden', marginTop: 8 }}>
                <LinearGradient colors={['#f59e0b', '#f97316']} style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Save Milestone</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={handleEmojiSelect}
        isDark={isDark}
        colors={themeColors}
      />

      {renderPickerModal()}

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
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────
const getStyles = (isDarkMode: boolean, colors: any) => {
  if (!colors) colors = {};
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background || '#0f0f1a' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: { flexGrow: 1, paddingBottom: 24, minHeight: SCREEN_H },
    stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
    stickyTitle: { fontSize: 17, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    stickySubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || 'rgba(255,255,255,0.7)', marginTop: 2 },
    topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16, marginTop: 8 },
    backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
    editToggleBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
    profileHero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 16, marginBottom: 20 },
    avatarSection: { position: 'relative' },
    uploadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 33,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInfo: { flex: 1, gap: 4 },
    profileName: { fontSize: 24, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.5 },
    profileMeta: { fontSize: 14, fontWeight: '500', color: colors.textSecondary || '#94a3b8' },
    profileTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
    profileTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
    profileTagText: { fontSize: 12, fontWeight: '700' },
    editingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
    avatarWrapper: { position: 'relative' },
    avatarGradient: { alignItems: 'center', justifyContent: 'center' },
    avatarEmoji: {},
    editAvatarBtn: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.background || '#1a1a2e',
    },
    editAvatarGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    birthDateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 14,
      borderRadius: 16,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    birthDateContent: { flex: 1 },
    birthDateLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary || '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    birthDateValue: { fontSize: 15, fontWeight: '600', color: colors.text || '#fff', marginTop: 2 },
    birthTimeText: { fontSize: 13, color: colors.textSecondary || '#94a3b8', marginTop: 2 },
    birthDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
    birthDetailItem: {
      flex: 1,
      minWidth: '30%',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 10,
      padding: 10,
    },
    birthDetailItemEmpty: { opacity: 0.6 },
    birthDetailLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary || '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3 },
    birthDetailValue: { fontSize: 13, fontWeight: '600', color: colors.text || '#fff', marginTop: 2 },
    birthDetailValueEmpty: { color: colors.textMuted || '#64748b', fontStyle: 'italic', fontWeight: '400', fontSize: 12 },
    emptyBirthDetails: { padding: 20, alignItems: 'center' },
    emptyBirthDetailsText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary || '#94a3b8' },
    emptyBirthDetailsSubtext: { fontSize: 13, color: colors.textMuted || '#64748b', marginTop: 4 },
    addBirthDetailsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
    },
    addBirthDetailsText: { fontSize: 13, fontWeight: '600', color: '#6366f1' },
    dockContainer: { marginHorizontal: 16, marginBottom: 20 },
    dock: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
    dockItem: { alignItems: 'center', gap: 6, flex: 1 },
    dockGradient: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    dockIcon: { fontSize: 24 },
    dockLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary || '#94a3b8' },
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 4,
      borderRadius: 16,
      gap: 2,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
    tabLabel: { fontSize: 12, fontWeight: '600' },
    glassCard: {
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border || 'rgba(255,255,255,0.06)',
      marginHorizontal: 16,
      marginBottom: 12,
    },
    glassBorder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    glassContent: { flex: 1 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginHorizontal: 16,
      marginBottom: 10,
      marginTop: 6,
    },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    sectionSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textSecondary || '#94a3b8', marginTop: 2 },
    sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    sectionActionText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
    kpiPillRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
    kpiPill: { flex: 1, borderRadius: 20, overflow: 'hidden', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    kpiPillIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    kpiPillEmoji: { fontSize: 18 },
    kpiPillBody: { flex: 1 },
    kpiPillValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
    kpiPillLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary || '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    activitiesList: { gap: 8, marginHorizontal: 0 },
    activityCard: { padding: 0 },
    activityRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    activityIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    activityEmoji: { fontSize: 18 },
    activityContent: { flex: 1, gap: 1 },
    activityTitle: { fontSize: 14, fontWeight: '700', color: colors.text || '#fff' },
    activityDetails: { fontSize: 12, color: colors.textSecondary || '#94a3b8', lineHeight: 16 },
    activityTime: { fontSize: 11, color: colors.textMuted || '#64748b', fontWeight: '500' },
    emptyCard: { padding: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden' },
    emptyStateIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: 'rgba(99,102,241,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyStateTitle: { fontSize: 16, fontWeight: '700', color: colors.text || '#fff', textAlign: 'center', marginBottom: 6 },
    emptyText: { fontSize: 13, color: colors.textMuted || '#64748b', textAlign: 'center', lineHeight: 18 },
    addMilestoneBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 8, marginHorizontal: 16 },
    addMilestoneGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
    addMilestoneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    milestoneCard: { padding: 0, marginBottom: 10, borderRadius: 16 },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    milestoneIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    milestoneContent: { flex: 1 },
    milestoneTitle: { fontSize: 15, fontWeight: '700', color: colors.text || '#fff', marginBottom: 2 },
    milestoneCategory: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', marginBottom: 2 },
    milestoneDate: { fontSize: 12, color: colors.textSecondary || '#94a3b8', fontWeight: '500' },
    milestoneDescription: {
      fontSize: 13,
      color: colors.textMuted || '#64748b',
      marginTop: 8,
      lineHeight: 18,
      fontWeight: '500',
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    deleteEntryBtn: {
      padding: 6,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(239,68,68,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    formCard: { padding: 0, marginBottom: 12 },
    sectionHeaderWithEdit: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      marginBottom: 12,
    },
    sectionLabel: { fontSize: 18, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    editIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(99,102,241,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    editingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    inputGroup: { marginBottom: 14, paddingHorizontal: 16 },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary || '#94a3b8',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 48,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    },
    inputDisabled: { opacity: 0.5 },
    inputIcon: { marginRight: 10 },
    inputField: { flex: 1, fontSize: 15, color: colors.text || '#fff', fontWeight: '500', paddingVertical: 8 },
    inputFieldText: { flex: 1, fontSize: 15, color: colors.text || '#fff', fontWeight: '500' },
    placeholderText: { color: colors.textMuted || '#64748b', fontWeight: '400' },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
      paddingTop: 14,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text || '#fff',
      fontWeight: '500',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      marginHorizontal: 16,
    },
    rowContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
    halfWidth: { flex: 1 },
    multipleBirthContainer: { flexDirection: 'row', gap: 8, marginTop: 2 },
    multipleBirthButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
    },
    multipleBirthText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary || '#94a3b8' },
    preferenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    preferenceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    preferenceText: { gap: 1 },
    preferenceTitle: { fontSize: 15, fontWeight: '700', color: colors.text || '#fff' },
    preferenceDesc: { fontSize: 12, color: colors.textSecondary || '#94a3b8', fontWeight: '500' },
    saveButton: { marginHorizontal: 16, marginTop: 8, marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
    saveButtonGradient: { paddingVertical: 14, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    dangerCard: { padding: 20, alignItems: 'center', borderColor: '#ef4444', borderWidth: 2, borderRadius: 20 },
    dangerIconContainer: { marginBottom: 12 },
    dangerIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    dangerTitle: { fontSize: 20, fontWeight: '800', color: '#ef4444', marginBottom: 6 },
    dangerDescription: {
      fontSize: 14,
      color: colors.textSecondary || '#94a3b8',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 16,
    },
    dangerStats: { flexDirection: 'row', gap: 16, marginBottom: 18 },
    dangerStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dangerStatText: { fontSize: 13, color: colors.textSecondary || '#94a3b8', fontWeight: '500' },
    deleteButton: { width: '100%', borderRadius: 14, overflow: 'hidden' },
    deleteGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
    deleteButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    dangerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 4 },
    dangerNoteText: { fontSize: 12, color: colors.textSecondary || '#94a3b8' },
    tabPanel: { marginTop: 4, gap: 12 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    modalContent: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 20, overflow: 'hidden' },
    modalDragHandle: { width: '100%', alignItems: 'center', paddingVertical: 4 },
    dragIndicator: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text || '#fff', letterSpacing: -0.3 },
    modalClose: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagePickerOptions: { padding: 4 },
    imagePickerOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 4 },
    imagePickerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    imagePickerLabel: { fontSize: 15, fontWeight: '600', color: colors.text || '#fff', flex: 1 },
    pickerList: { paddingVertical: 4 },
    pickerItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    },
    pickerItemText: { fontSize: 15, fontWeight: '500' },
    emojiPickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    emojiPickerSheet: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      padding: 16,
      paddingBottom: 32,
      overflow: 'hidden',
    },
    emojiPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    emojiPickerTitle: { fontSize: 17, fontWeight: '800', color: colors.text || '#fff' },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
    emojiButton: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    emojiButtonText: { fontSize: 26 },
  });
};