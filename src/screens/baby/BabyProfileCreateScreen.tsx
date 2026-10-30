import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '@/utils/supabase';
import { useSweetAlert } from '../../components/SweetAlert';
import { useBaby } from '../../context/BabyContext';
import { setAppSetting, getAllBabiesFromDb } from '../../database/dbHelpers';
import { useCustomization } from '../../hooks/useCustomization';
import type { RootStackParamList } from '../../types/navigation';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = (() => {
  const { Dimensions } = require('react-native');
  return Dimensions.get('window');
})();
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;
const BABY_IMAGES_DIR = FileSystem.documentDirectory + 'baby_images/';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */
const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_MEDIUM = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const DELIVERY_TYPES = ['Vaginal', 'C-Section', 'VBAC', 'Other'];
const BIRTH_ATTENDANTS = ['Obstetrician', 'Midwife', 'Family Doctor', 'Doula', 'Other'];
const FEEDING_PLANS = ['Breastfeeding', 'Formula', 'Combination', 'Pumping'];

const SKIN_TONES = [
  { id: 0, emoji: '👶', color: '#F5D0C5', label: 'Light' },
  { id: 1, emoji: '👶🏻', color: '#F5D0C5', label: 'Fair' },
  { id: 2, emoji: '👶🏼', color: '#E8C4A0', label: 'Medium' },
  { id: 3, emoji: '👶🏽', color: '#D4A373', label: 'Tan' },
  { id: 4, emoji: '👶🏾', color: '#A67C52', label: 'Brown' },
  { id: 5, emoji: '👶🏿', color: '#6B4423', label: 'Dark' },
];

const AVATAR_OPTIONS = ['👶', '🍼', '🧸', '🎀', '👼', '🤱', '👨‍🍼', '👩‍🍼', '🌟', '💖'];

const TERM_EXPLANATIONS: Record<string, { label: string; explanation: string; emoji: string }> = {
  'Apgar Score': { label: 'Apgar Score', emoji: '🫀', explanation: 'A quick test given at 1 and 5 minutes after birth. Scores 0-10 based on Appearance, Pulse, Grimace, Activity, and Respiration. 7+ is normal.' },
  'Gestational Weeks': { label: 'Gestational Weeks', emoji: '📅', explanation: 'Weeks your baby was in the womb. Full-term is 39-40 weeks. Before 37 weeks is premature.' },
  'Birth Weight': { label: 'Birth Weight', emoji: '⚖️', explanation: "Your baby's weight at birth. Average is 2.5-4.5 kg (5.5-10 lbs). Helps track growth patterns." },
  'Birth Height': { label: 'Birth Height', emoji: '📏', explanation: "Your baby's length at birth. Average is 45-55 cm (18-22 inches)." },
  'Head Circumference': { label: 'Head Circumference', emoji: '🧠', explanation: "Measurement around your baby's head. Average is 32-37 cm (12.5-14.5 inches). Tracks brain development." },
  'Delivery Type': { label: 'Delivery Type', emoji: '🏥', explanation: 'How your baby was born: Vaginal (natural birth), C-Section (surgical), VBAC (vaginal birth after C-section), or Other.' },
  'Birth Attendant': { label: 'Birth Attendant', emoji: '👩‍⚕️', explanation: 'The healthcare professional who helped deliver your baby.' },
  'Feeding Plan': { label: 'Feeding Plan', emoji: '🍼', explanation: 'How you plan to feed your baby: Breastfeeding, Formula, Combination, or Pumping.' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SAFE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const isImageUri = (v: string | undefined | null): boolean => {
  if (!v || typeof v !== 'string') return false;
  return v.startsWith('http') || v.startsWith('file://') || v.startsWith('data:') || v.startsWith('ph://');
};

const uploadImageToSupabase = async (localUri: string, babyId: string): Promise<string | null> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${babyId}_${Date.now()}.${fileExt}`;
    const filePath = `baby_avatars/${fileName}`;
    const { decode } = require('base64-arraybuffer');
    const { error } = await supabase.storage.from('baby_avatars').upload(filePath, decode(base64), { contentType: `image/${fileExt}`, cacheControl: '3600', upsert: false });
    if (error) return null;
    const { data: urlData } = supabase.storage.from('baby_avatars').getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch { return null; }
};

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(BABY_IMAGES_DIR);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(BABY_IMAGES_DIR, { intermediates: true });
};

const copyImageToPermanent = async (tempUri: string, babyId: string, prefix = 'avatar'): Promise<string> => {
  await ensureDirExists();
  const permanentUri = `${BABY_IMAGES_DIR}${babyId}_${prefix}_${Date.now()}.jpg`;
  try {
    if (tempUri.startsWith('content://')) {
      const base64 = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(permanentUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    } else if (tempUri.startsWith('data:')) {
      const base64Data = tempUri.split(',')[1];
      if (base64Data) await FileSystem.writeAsStringAsync(permanentUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      else throw new Error('Invalid data URI');
    } else {
      await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
    }
    return permanentUri;
  } catch (error) {
    console.error('Failed to copy image:', error);
    throw error;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   GRADIENT TEXT
   ═══════════════════════════════════════════════════════════════════════════ */
const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        const color = interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo);
        return <Text key={i} style={[style, { color }]}>{l}</Text>;
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PRESSABLE SCALE
   ═══════════════════════════════════════════════════════════════════════════ */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean;
  style?: any; activeScale?: number; haptic?: 'light' | 'medium';
}>(({ children, onPress, disabled, style, activeScale = 0.96, haptic = 'light' }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    if (disabled) return;
    if (haptic === 'light') HAPTIC_LIGHT();
    else HAPTIC_MEDIUM();
    onPress?.();
  };
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={handlePress}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PULSING DOT
   ═══════════════════════════════════════════════════════════════════════════ */
const PulsingDot: React.FC<{ color: string; size?: number }> = ({ color, size = 8 }) => {
  const pulse = useSharedValue(1);
  const halo = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 900 }), withTiming(1, { duration: 900 })), -1, true);
    halo.value = withRepeat(withSequence(withTiming(1.8, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
  }, [pulse, halo]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: halo.value }],
    opacity: interpolate(halo.value, [1, 1.8], [0.35, 0]),
  }));
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, haloStyle]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, dotStyle]} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PULSE HEADER — compact preview at top
   ═══════════════════════════════════════════════════════════════════════════ */
interface PulseHeaderProps {
  isDark: boolean;
  avatar: string;
  gender: 'boy' | 'girl' | 'other';
  name: string;
  ageDisplay: string;
  currentStep: number;
  parentName?: string;
  onBack: () => void;
}

const PulseHeader = React.memo<PulseHeaderProps>(({
  isDark, avatar, gender, name, ageDisplay, currentStep, parentName, onBack,
}) => {
  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1, true);
    rotate.value = withRepeat(withTiming(360, { duration: 12000 }), -1, false);
    glow.value = withRepeat(withSequence(withTiming(0.9, { duration: 2000 }), withTiming(0.4, { duration: 2000 })), -1, true);
  }, [pulse, rotate, glow]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()}>
      <View style={[styles.pulseWrap, { backgroundColor: isDark ? DS.darkCard : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)', 'rgba(139,92,246,0.06)']
            : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.06)', 'rgba(139,92,246,0.03)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${DS.primary}${isDark ? '45' : '28'}`, 'transparent']} style={styles.pulseGlowL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <LinearGradient colors={[`${DS.accent}${isDark ? '38' : '22'}`, 'transparent']} style={styles.pulseGlowR} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} pointerEvents="none" />

        <PressableScale onPress={onBack} activeScale={0.9}>
          <View style={[styles.pulseBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </View>
        </PressableScale>

        <View style={styles.pulseRow}>
          <View style={styles.pulseAvatarWrap}>
            <Animated.View style={[styles.pulseAvatarGlow, glowStyle]} />
            <Animated.View style={[styles.pulseAvatarRing, ringStyle]}>
              <LinearGradient colors={[DS.primary, DS.accent, DS.warning, DS.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.pulseAvatarInner, { backgroundColor: isDark ? DS.darkSurface : DS.white }]}>
              <SafeBabyAvatar avatar={avatar} gender={gender} size={46} />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.pulseTitle}>
                NEW PROFILE
              </GradientText>
              <View style={[styles.pulseLivePill, { backgroundColor: `${DS.primary}18` }]}>
                <PulsingDot color={DS.primary} size={6} />
                <Text style={[styles.pulseLiveText, { color: DS.primary }]}>{currentStep}/2</Text>
              </View>
            </View>
            <Text style={[styles.pulseName, { color: isDark ? DS.white : DS.gray900 }]} numberOfLines={1}>
              {name.trim() || 'Baby Name'}
            </Text>
            <Text style={[styles.pulseSub, { color: isDark ? DS.gray400 : DS.gray500 }]} numberOfLines={1}>
              {ageDisplay}{parentName ? ` · ${parentName}` : ''}
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View style={[styles.pulseProgress, { backgroundColor: isDark ? DS.darkBorder : DS.gray200 }]}>
          <Animated.View style={[styles.pulseProgressFill, { width: currentStep === 1 ? '50%' : '100%' }]}>
            <LinearGradient colors={[DS.primary, DS.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PICKER MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const PickerModal = React.memo(({
  visible, onClose, onSelect, options, selectedValue, title, isDark,
}: {
  visible: boolean; onClose: () => void; onSelect: (v: string) => void;
  options: string[]; selectedValue: string; title: string; isDark: boolean;
}) => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (visible) { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); opacity.value = withTiming(1, { duration: 250 }); }
    else { scale.value = withTiming(0.95); opacity.value = withTiming(0); }
  }, [visible]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <PressableScale onPress={onClose} activeScale={1} haptic="light">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        </PressableScale>
        <Animated.View style={[styles.modalCard, anim, { backgroundColor: isDark ? DS.darkCard : DS.white }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? DS.white : DS.gray900 }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
              <Ionicons name="close" size={20} color={isDark ? DS.white : DS.gray800} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map((item) => {
              const active = selectedValue === item;
              return (
                <PressableScale key={item} onPress={() => { onSelect(item); onClose(); }} activeScale={0.98}>
                  <View style={[styles.pickerItem, active && { backgroundColor: `${DS.primary}10` }]}>
                    <Text style={[styles.pickerItemText, { color: active ? DS.primary : isDark ? DS.white : DS.gray800 }, active && { fontWeight: '700' }]}>
                      {item}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={DS.primary} />}
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TERM TOOLTIP
   ═══════════════════════════════════════════════════════════════════════════ */
const TermTooltip = ({ term, isDark }: { term: string; isDark: boolean }) => {
  const [show, setShow] = useState(false);
  const info = TERM_EXPLANATIONS[term];
  if (!info) return null;
  return (
    <View style={{ marginLeft: 4, position: 'relative', zIndex: 10 }}>
      <TouchableOpacity onPress={() => setShow(!show)} style={{ padding: 2 }} activeOpacity={0.7}>
        <Ionicons name="information-circle-outline" size={18} color={DS.primary} />
      </TouchableOpacity>
      {show && (
        <>
          <TouchableOpacity style={{ position: 'absolute', top: -200, left: -200, right: -200, bottom: -200, zIndex: 999 }} activeOpacity={1} onPress={() => setShow(false)} />
          <View style={[styles.tooltipCard, { backgroundColor: isDark ? DS.darkSurface : DS.white, ...DS.shadow.lg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 18 }}>{info.emoji}</Text>
              <Text style={[styles.tooltipTitle, { color: isDark ? DS.white : DS.gray900 }]}>{info.label}</Text>
            </View>
            <Text style={[styles.tooltipText, { color: isDark ? DS.gray400 : DS.gray600 }]}>{info.explanation}</Text>
            <TouchableOpacity onPress={() => setShow(false)} style={{ marginTop: 10, alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: DS.primary }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AURA FIELD WRAPPER
   ═══════════════════════════════════════════════════════════════════════════ */
const FieldLabel = ({ label, required, tooltip, isDark }: { label: string; required?: boolean; tooltip?: string; isDark: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
    <Text style={[styles.label, { color: isDark ? DS.white : DS.gray900 }]}>{label}</Text>
    {required && <Text style={{ color: DS.danger, marginLeft: 2, fontWeight: '700' }}>*</Text>}
    {tooltip && <TermTooltip term={tooltip} isDark={isDark} />}
  </View>
);

const InputBox = React.memo(({ icon, isDark, children, style }: {
  icon: keyof typeof Ionicons.glyphMap; isDark: boolean; children: React.ReactNode; style?: any;
}) => (
  <View style={[styles.inputBox, {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white,
    borderColor: isDark ? DS.darkBorder : DS.gray200,
  }, style]}>
    <Ionicons name={icon} size={18} color={DS.primary} style={{ marginRight: 10 }} />
    {children}
  </View>
));

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */
type BabyProfileCreateScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateBabyProfile'>;

export default function BabyProfileCreateScreen({ navigation }: BabyProfileCreateScreenProps) {
  const insets = useSafeAreaInsets();
  const { darkMode, triggerHaptic } = useCustomization();
  const isDark = darkMode ?? false;
  const { userProfile, completeSetup, wasSetupCompleted } = useAuth();
  const { createBaby, updateBaby, calculateAge, loadBabies, switchBaby, babies } = useBaby();
  const { toast } = useSweetAlert();

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
  const [creatorRelationship, setCreatorRelationship] = useState<'Father' | 'Mother' | 'Guardian'>('Mother');
  const [pickerState, setPickerState] = useState<{
    visible: boolean;
    type: 'bloodType' | 'deliveryType' | 'birthAttendant' | 'feedingPlan' | null;
  }>({ visible: false, type: null });

  const imagePickerLock = useRef(false);
  const isCreatingRef = useRef(false);
  const isMounted = useRef(true);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const navigationAttemptedRef = useRef(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });
  const headerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const ageDisplay = useMemo(() => calculateAge(birthDate.toISOString()), [birthDate, calculateAge]);

  useEffect(() => {
    isMounted.current = true;
    navigationAttemptedRef.current = false;
    return () => { isMounted.current = false; imagePickerLock.current = false; };
  }, []);

  const onDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate && event.type !== 'dismissed') {
      setBirthDate(selectedDate);
      triggerHaptic('light');
    }
  }, [triggerHaptic]);

  const pickImage = useCallback(async () => {
    if (imagePickerLock.current) return;
    imagePickerLock.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatar(result.assets[0].uri);
        setShowAvatarPicker(false);
        triggerHaptic('medium');
      }
    } catch { toast('Failed to pick image', 'error'); }
    finally { imagePickerLock.current = false; }
  }, [toast, triggerHaptic]);

  const takePhoto = useCallback(async () => {
    if (imagePickerLock.current) return;
    imagePickerLock.current = true;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { toast('Please allow camera access in settings', 'warning'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatar(result.assets[0].uri);
        setShowAvatarPicker(false);
        triggerHaptic('medium');
      }
    } catch { toast('Failed to take photo', 'error'); }
    finally { imagePickerLock.current = false; }
  }, [toast, triggerHaptic]);

  const validateStep1 = useCallback((): boolean => {
    const t = name.trim();
    if (!t) { toast("Please enter your baby's name", 'warning'); return false; }
    if (t.length < 2) { toast('Name must be at least 2 characters', 'warning'); return false; }
    if (t.length > 50) { toast('Name must be 50 characters or less', 'warning'); return false; }
    return true;
  }, [name, toast]);

  const validateStep2 = useCallback((): boolean => {
    if (weight.trim()) {
      const w = parseFloat(weight.trim());
      if (isNaN(w) || w <= 0 || w > 60) { toast('Please enter a valid weight (0.1–60 kg)', 'warning'); return false; }
    }
    if (height.trim()) {
      const h = parseFloat(height.trim());
      if (isNaN(h) || h < 20 || h > 220) { toast('Please enter a valid height (20–220 cm)', 'warning'); return false; }
    }
    if (birthWeight.trim()) {
      const bw = parseFloat(birthWeight.trim());
      if (isNaN(bw) || bw <= 0 || bw > 10) { toast('Please enter a valid birth weight (0.1–10 kg)', 'warning'); return false; }
    }
    if (gestationalWeeks.trim()) {
      const gw = parseInt(gestationalWeeks.trim());
      if (isNaN(gw) || gw < 22 || gw > 44) { toast('Please enter valid gestational weeks (22-44)', 'warning'); return false; }
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
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('BabyOptional');
    }
  }, [currentStep, navigation, triggerHaptic]);

  const safeNavigate = useCallback((screen: string, params?: any) => {
    if (navigationAttemptedRef.current) return;
    navigationAttemptedRef.current = true;
    setTimeout(() => {
      try { navigation.replace(screen as any, params); }
      catch {
        try { navigation.reset({ index: 0, routes: [{ name: screen as any, params }] }); }
        catch {}
      }
    }, 300);
  }, [navigation]);

  const handleCreateProfile = useCallback(async (_andContinue = false) => {
    if (isCreatingRef.current) { toast('A profile is already being created', 'warning'); return; }
    if (!validateStep1() || !validateStep2()) return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { toast('Please sign in again to create a baby profile', 'error'); safeNavigate('Login'); return; }
    const userId = user.id;

    const trimmedName = name.trim();
    const birthIso = birthDate.toISOString();

    const duplicate = babies.find(b => b.name.toLowerCase() === trimmedName.toLowerCase() && b.birthDate === birthIso);
    if (duplicate) {
      toast('A baby with this name and birth date already exists. Using existing profile.', 'info');
      try {
        await switchBaby(duplicate.id);
        await completeSetup('baby');
        const { hasParent2 } = await wasSetupCompleted();
        if (hasParent2 === false) safeNavigate('CoParentInviteScreen');
        else safeNavigate('Main');
      } catch (e) {
        if (__DEV__) console.warn('[BabyProfileCreate] duplicate path failed:', e);
        toast('Could not open existing profile. Please try again.', 'error');
      } finally {
        // Guarantee the spinner clears even on the duplicate path.
        isCreatingRef.current = false;
        if (isMounted.current) setIsLoading(false);
      }
      return;
    }

    isCreatingRef.current = true;
    setIsLoading(true);
    triggerHaptic('medium');

    // Safety net: if anything inside the try block hangs (network,
    // Supabase RLS retry, image upload stall), force-clear the
    // spinner after 45 s so the user isn't trapped on a loading
    // screen. The normal finally still clears it earlier on success.
    const spinnerSafetyTimer = setTimeout(() => {
      if (isMounted.current) {
        console.warn('[BabyProfileCreate] Spinner safety timeout fired — clearing');
        setIsLoading(false);
        isCreatingRef.current = false;
      }
    }, 45000);

    let babyId: string | null = null;

    try {
      const hasCustomImage = isImageUri(avatar);
      const avatarToSave = hasCustomImage ? '👶' : avatar;
      const babyData: any = {
        name: trimmedName, birthDate: birthIso, gender, skinTone, avatar: avatarToSave,
        weight: weight.trim() || undefined, height: height.trim() || undefined,
        bloodType: bloodType.trim().toUpperCase() || undefined,
        allergies: allergies.trim() ? allergies.split(',').map(a => a.trim()).filter(Boolean) : undefined,
        medicalNotes: medicalNotes.trim() || undefined,
        parent1Id: userId, parent2Id: undefined,
        birthWeight: birthWeight.trim() || undefined,
        birthHeight: birthHeight.trim() || undefined,
        birthHeadCircumference: birthHeadCircumference.trim() || undefined,
        gestationalWeeks: gestationalWeeks.trim() || undefined,
        apgar1Min: apgar1Min.trim() || undefined,
        apgar5Min: apgar5Min.trim() || undefined,
        deliveryType: deliveryType ? deliveryType.toLowerCase().replace(/-/g, '_') : undefined,
        birthAttendant: birthAttendant ? birthAttendant.toLowerCase().replace(/ /g, '_') : undefined,
        birthPlace: birthPlace.trim() || undefined,
        multipleBirth, birthOrder: birthOrder.trim() || undefined,
        feedingPlan: feedingPlan ? feedingPlan.toLowerCase() : undefined,
        birthTime: birthTime.trim() || undefined,
      };

      babyId = await createBaby(babyData);
      if (!babyId) { toast('Failed to create profile. Please try again.', 'error'); return; }

      if (hasCustomImage && babyId) {
        try {
          const uploadedUrl = await uploadImageToSupabase(avatar, babyId);
          let finalAvatarUrl = avatar;
          if (uploadedUrl) finalAvatarUrl = uploadedUrl;
          else {
            const perm = await copyImageToPermanent(avatar, babyId, 'avatar');
            if (perm) finalAvatarUrl = perm;
          }
          if (finalAvatarUrl) {
            await updateBaby(babyId, { avatar: finalAvatarUrl, avatar_url: finalAvatarUrl });
            setAvatar(finalAvatarUrl);
            toast('Profile photo saved!', 'success');
          }
        } catch { toast('Profile created but image could not be saved', 'warning'); }
      }

      toast(`${trimmedName}'s profile created! 🎉`, 'success');

      // Mark this session as "baby already chosen" so AppNavigator's
      // multi-baby guard doesn't re-prompt the user to SwitchBaby
      // immediately after they just created a baby.
      try {
        await AsyncStorage.setItem(
          '@littleloom_multi_baby_selected_this_session',
          'true',
        );
      } catch {}

      try {
        await AsyncStorage.removeItem('@littleloom_babies_cache');
        await AsyncStorage.removeItem('@littleloom_current_baby_id');
        await loadBabies(true);
        const refreshedBabies = await getAllBabiesFromDb();
        const found = refreshedBabies.find(b => b.id === babyId);
        if (!found) { toast('Profile created but not found. Please try again.', 'error'); return; }
        try { await switchBaby(babyId); }
        catch { await setAppSetting('current_baby_id', babyId); }
        await completeSetup('baby');
        const { hasParent2, setupComplete } = await wasSetupCompleted();
        if (setupComplete) safeNavigate('Main');
        else if (hasParent2 === false) safeNavigate('CoParentInviteScreen');
        else if (hasParent2 === 'skipped') { await completeSetup('parent2'); safeNavigate('Main'); }
        else safeNavigate('Main');
      } catch {
        toast('Could not finalize setup. Please try again.', 'error');
        try { safeNavigate('Main'); } catch {}
      }
    } catch { toast('An unexpected error occurred. Please try again.', 'error'); }
    finally {
      clearTimeout(spinnerSafetyTimer);
      isCreatingRef.current = false;
      if (isMounted.current) setIsLoading(false);
    }
  }, [
    name, birthDate, birthTime, gender, skinTone, avatar, weight, height, bloodType, allergies,
    medicalNotes, birthWeight, birthHeight, birthHeadCircumference, gestationalWeeks, apgar1Min,
    apgar5Min, deliveryType, birthAttendant, birthPlace, multipleBirth, birthOrder, feedingPlan,
    babies, createBaby, updateBaby, loadBabies, validateStep1, validateStep2, toast, triggerHaptic,
    switchBaby, wasSetupCompleted, completeSetup, safeNavigate,
  ]);

  /* ─── Date Picker ─── */
  const renderDatePicker = () => {
    if (!showDatePicker) return null;
    if (Platform.OS === 'ios') {
      return (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: isDark ? DS.darkCard : DS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: isDark ? DS.darkBorder : DS.gray200 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: DS.gray500 }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? DS.white : DS.gray900 }}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: DS.primary }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={birthDate} mode="date" display="spinner" onChange={onDateChange} maximumDate={new Date()} minimumDate={new Date(1950, 0, 1)} textColor={isDark ? DS.white : undefined} />
            </View>
          </View>
        </Modal>
      );
    }
    return <DateTimePicker value={birthDate} mode="date" display="default" onChange={onDateChange} maximumDate={new Date()} minimumDate={new Date(1950, 0, 1)} />;
  };

  /* ─── Step 1 ─── */
  const renderStep1 = () => (
    <Animated.View entering={FadeInDown.delay(100)} style={{ gap: DS.space.lg }}>
      {/* Name */}
      <View>
        <FieldLabel label="Baby's Name" required isDark={isDark} />
        <InputBox icon="person-outline" isDark={isDark}>
          <TextInput
            ref={nameInputRef}
            style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
            value={name}
            onChangeText={setName}
            placeholder="Enter baby's name"
            placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
            autoFocus
            maxLength={50}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </InputBox>
      </View>

      {/* Birth date & time */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Birth Date" required isDark={isDark} />
          <PressableScale onPress={() => setShowDatePicker(true)} activeScale={0.98}>
            <InputBox icon="calendar-outline" isDark={isDark}>
              <Text style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}>
                {birthDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </InputBox>
          </PressableScale>
          {renderDatePicker()}
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Birth Time" isDark={isDark} />
          <InputBox icon="time-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={birthTime}
              onChangeText={setBirthTime}
              placeholder="e.g., 3:30 PM"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
            />
          </InputBox>
        </View>
      </View>

      {/* Age chip */}
      <View style={{ alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: `${DS.primary}15` }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: DS.primary }}>
          {ageDisplay} {ageDisplay !== 'Not born yet' ? 'old' : ''}
        </Text>
      </View>

      {/* Relationship */}
      <View>
        <FieldLabel label="You are the baby's" required isDark={isDark} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['Mother', 'Father', 'Guardian'] as const).map(r => {
            const active = creatorRelationship === r;
            return (
              <PressableScale key={r} onPress={() => { setCreatorRelationship(r); triggerHaptic('light'); }} activeScale={0.96} style={{ flex: 1 }}>
                <View style={[styles.choiceBtn, {
                  backgroundColor: active ? `${DS.primary}15` : isDark ? 'rgba(255,255,255,0.03)' : DS.gray50,
                  borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                  borderWidth: active ? 2 : 1,
                }]}>
                  <Text style={{ fontSize: 26, marginBottom: 4 }}>{r === 'Mother' ? '👩' : r === 'Father' ? '👨' : '🛡️'}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? DS.primary : (isDark ? DS.gray400 : DS.gray600) }}>{r}</Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Gender */}
      <View>
        <FieldLabel label="Gender" isDark={isDark} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['boy', 'girl', 'other'] as const).map(g => {
            const active = gender === g;
            return (
              <PressableScale key={g} onPress={() => { setGender(g); triggerHaptic('light'); }} activeScale={0.96} style={{ flex: 1 }}>
                <View style={[styles.choiceBtn, {
                  backgroundColor: active ? `${DS.primary}15` : isDark ? 'rgba(255,255,255,0.03)' : DS.gray50,
                  borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                  borderWidth: active ? 2 : 1,
                }]}>
                  <Text style={{ fontSize: 26, marginBottom: 4 }}>{g === 'boy' ? '👦' : g === 'girl' ? '👧' : '👶'}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? DS.primary : (isDark ? DS.gray400 : DS.gray600) }}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Skin tone */}
      <View>
        <FieldLabel label="Skin Tone" isDark={isDark} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
          {SKIN_TONES.map(tone => {
            const active = skinTone === tone.id;
            return (
              <PressableScale key={tone.id} onPress={() => { setSkinTone(tone.id); setAvatar(tone.emoji); triggerHaptic('light'); }} activeScale={0.94} style={{ flex: 1 }}>
                <View style={[styles.skinToneBtn, {
                  borderColor: active ? DS.primary : 'transparent',
                  borderWidth: 2,
                  backgroundColor: active ? `${DS.primary}15` : (isDark ? 'rgba(255,255,255,0.03)' : 'transparent'),
                }]}>
                  <Text style={{ fontSize: 26 }}>{tone.emoji}</Text>
                  {active && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: isDark ? DS.darkCard : DS.white, borderRadius: 8 }}>
                      <Ionicons name="checkmark-circle" size={14} color={DS.primary} />
                    </View>
                  )}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Avatar */}
      <View>
        <FieldLabel label="Avatar" isDark={isDark} />
        <PressableScale onPress={() => setShowAvatarPicker(v => !v)} activeScale={0.98}>
          <View style={[styles.avatarSelector, {
            backgroundColor: isDark ? DS.darkCard : DS.white,
            borderColor: isDark ? DS.darkBorder : DS.gray200,
          }]}>
            <SafeBabyAvatar avatar={avatar} gender={gender} size={80} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: DS.primary, marginTop: 8 }}>
              {showAvatarPicker ? 'Tap to close' : 'Tap to change'}
            </Text>
          </View>
        </PressableScale>

        {showAvatarPicker && (
          <Animated.View entering={FadeIn} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, justifyContent: 'center' }}>
            {AVATAR_OPTIONS.map(emoji => {
              const active = avatar === emoji;
              return (
                <PressableScale key={emoji} onPress={() => { setAvatar(emoji); setShowAvatarPicker(false); triggerHaptic('light'); }} activeScale={0.92}>
                  <View style={[styles.avatarOption, {
                    backgroundColor: active ? `${DS.primary}15` : (isDark ? 'rgba(255,255,255,0.05)' : DS.white),
                    borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                    borderWidth: active ? 2 : 1,
                  }]}>
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </View>
                </PressableScale>
              );
            })}
            <PressableScale onPress={takePhoto} activeScale={0.92}>
              <View style={[styles.avatarOption, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Ionicons name="camera-outline" size={24} color={DS.primary} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: DS.primary, marginTop: 2 }}>Camera</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={pickImage} activeScale={0.92}>
              <View style={[styles.avatarOption, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Ionicons name="images-outline" size={24} color={DS.primary} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: DS.primary, marginTop: 2 }}>Gallery</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      </View>

      <Text style={[styles.stepIndicator, { color: isDark ? DS.gray500 : DS.gray400 }]}>Step 1 of 2 · Basic Info</Text>
    </Animated.View>
  );

  /* ─── Step 2 ─── */
  const renderStep2 = () => (
    <Animated.View entering={FadeInDown.delay(100)} style={{ gap: DS.space.lg }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: DS.primary, marginBottom: -4 }}>
        ✨ Health & Birth Details
      </Text>
      <Text style={{ fontSize: 11, fontStyle: 'italic', color: isDark ? DS.gray500 : DS.gray400, marginTop: -8 }}>
        Tap ℹ️ icons for explanations
      </Text>

      {/* Current measurements */}
      <View style={styles.sectionHeader}>
        <Ionicons name="fitness-outline" size={16} color={DS.primary} />
        <Text style={[styles.sectionHeaderText, { color: isDark ? DS.white : DS.gray900 }]}>Current Measurements</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Weight (kg)" isDark={isDark} />
          <InputBox icon="scale-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={weight}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, '');
                const parts = cleaned.split('.');
                setWeight(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned);
              }}
              placeholder="e.g., 3.5"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </InputBox>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Height (cm)" isDark={isDark} />
          <InputBox icon="resize-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={height}
              onChangeText={(t) => setHeight(t.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="e.g., 50"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="number-pad"
              maxLength={3}
            />
          </InputBox>
        </View>
      </View>

      {/* Birth details */}
      <View style={styles.sectionHeader}>
        <Ionicons name="medical-outline" size={16} color={DS.primary} />
        <Text style={[styles.sectionHeaderText, { color: isDark ? DS.white : DS.gray900 }]}>Birth Details</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Birth Weight (kg)" tooltip="Birth Weight" isDark={isDark} />
          <InputBox icon="scale-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={birthWeight}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, '');
                const parts = cleaned.split('.');
                setBirthWeight(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned);
              }}
              placeholder="e.g., 3.2"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </InputBox>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Birth Height (cm)" tooltip="Birth Height" isDark={isDark} />
          <InputBox icon="resize-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={birthHeight}
              onChangeText={(t) => setBirthHeight(t.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="e.g., 48"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="number-pad"
              maxLength={3}
            />
          </InputBox>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Head (cm)" tooltip="Head Circumference" isDark={isDark} />
          <InputBox icon="aperture-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={birthHeadCircumference}
              onChangeText={(t) => setBirthHeadCircumference(t.replace(/[^0-9.]/g, '').slice(0, 5))}
              placeholder="e.g., 33"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </InputBox>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Weeks" tooltip="Gestational Weeks" isDark={isDark} />
          <InputBox icon="calendar-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={gestationalWeeks}
              onChangeText={(t) => setGestationalWeeks(t.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="e.g., 40"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="number-pad"
              maxLength={2}
            />
          </InputBox>
        </View>
      </View>

      {/* Apgar */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Apgar 1min" tooltip="Apgar Score" isDark={isDark} />
          <InputBox icon="pulse-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={apgar1Min}
              onChangeText={(t) => setApgar1Min(t.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="e.g., 8"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="number-pad"
              maxLength={2}
            />
          </InputBox>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Apgar 5min" tooltip="Apgar Score" isDark={isDark} />
          <InputBox icon="pulse-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={apgar5Min}
              onChangeText={(t) => setApgar5Min(t.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="e.g., 9"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="number-pad"
              maxLength={2}
            />
          </InputBox>
        </View>
      </View>

      {/* Delivery & attendant */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Delivery" tooltip="Delivery Type" isDark={isDark} />
          <PressableScale onPress={() => setPickerState({ visible: true, type: 'deliveryType' })} activeScale={0.98}>
            <InputBox icon="medkit-outline" isDark={isDark}>
              <Text style={[styles.input, { color: deliveryType ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray600 : DS.gray400) }]} numberOfLines={1}>
                {deliveryType || 'Select'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={isDark ? DS.gray500 : DS.gray400} />
            </InputBox>
          </PressableScale>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Attendant" tooltip="Birth Attendant" isDark={isDark} />
          <PressableScale onPress={() => setPickerState({ visible: true, type: 'birthAttendant' })} activeScale={0.98}>
            <InputBox icon="people-outline" isDark={isDark}>
              <Text style={[styles.input, { color: birthAttendant ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray600 : DS.gray400) }]} numberOfLines={1}>
                {birthAttendant || 'Select'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={isDark ? DS.gray500 : DS.gray400} />
            </InputBox>
          </PressableScale>
        </View>
      </View>

      {/* Birth place & multiple */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Birth Place" isDark={isDark} />
          <InputBox icon="location-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={birthPlace}
              onChangeText={setBirthPlace}
              placeholder="e.g., Hospital"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
            />
          </InputBox>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Multiple Birth?" isDark={isDark} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[true, false].map(v => {
              const active = multipleBirth === v;
              return (
                <PressableScale key={String(v)} onPress={() => { setMultipleBirth(v); triggerHaptic('light'); }} activeScale={0.96} style={{ flex: 1 }}>
                  <View style={[styles.toggleBtn, {
                    backgroundColor: active ? `${DS.primary}15` : isDark ? 'rgba(255,255,255,0.03)' : DS.gray50,
                    borderColor: active ? DS.primary : isDark ? DS.darkBorder : DS.gray200,
                    borderWidth: active ? 2 : 1,
                  }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: active ? DS.primary : (isDark ? DS.gray400 : DS.gray600) }}>
                      {v ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      </View>

      {/* Birth order & feeding */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Birth Order" isDark={isDark} />
          <InputBox icon="list-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={birthOrder}
              onChangeText={(t) => setBirthOrder(t.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="e.g., 1"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
              keyboardType="number-pad"
              maxLength={2}
            />
          </InputBox>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Feeding Plan" tooltip="Feeding Plan" isDark={isDark} />
          <PressableScale onPress={() => setPickerState({ visible: true, type: 'feedingPlan' })} activeScale={0.98}>
            <InputBox icon="nutrition-outline" isDark={isDark}>
              <Text style={[styles.input, { color: feedingPlan ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray600 : DS.gray400) }]} numberOfLines={1}>
                {feedingPlan || 'Select'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={isDark ? DS.gray500 : DS.gray400} />
            </InputBox>
          </PressableScale>
        </View>
      </View>

      {/* Medical */}
      <View style={styles.sectionHeader}>
        <Ionicons name="heart-outline" size={16} color={DS.primary} />
        <Text style={[styles.sectionHeaderText, { color: isDark ? DS.white : DS.gray900 }]}>Medical Information</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Blood Type" isDark={isDark} />
          <PressableScale onPress={() => setPickerState({ visible: true, type: 'bloodType' })} activeScale={0.98}>
            <InputBox icon="water-outline" isDark={isDark}>
              <Text style={[styles.input, { color: bloodType ? (isDark ? DS.white : DS.gray900) : (isDark ? DS.gray600 : DS.gray400) }]} numberOfLines={1}>
                {bloodType || 'Select'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={isDark ? DS.gray500 : DS.gray400} />
            </InputBox>
          </PressableScale>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Allergies" isDark={isDark} />
          <InputBox icon="warning-outline" isDark={isDark}>
            <TextInput
              style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="peanuts, dairy"
              placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
            />
          </InputBox>
        </View>
      </View>

      <View>
        <FieldLabel label="Medical Notes" isDark={isDark} />
        <View style={[styles.inputBox, styles.textAreaBox, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : DS.white,
          borderColor: isDark ? DS.darkBorder : DS.gray200,
        }]}>
          <TextInput
            style={[styles.input, styles.textArea, { color: isDark ? DS.white : DS.gray900 }]}
            value={medicalNotes}
            onChangeText={setMedicalNotes}
            placeholder="Any important medical information..."
            placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
          />
        </View>
        <Text style={{ fontSize: 10, color: isDark ? DS.gray500 : DS.gray400, textAlign: 'right', marginTop: 4 }}>
          {medicalNotes.length}/500
        </Text>
      </View>

      <Text style={[styles.stepIndicator, { color: isDark ? DS.gray500 : DS.gray400 }]}>Step 2 of 2 · Health Details</Text>
    </Animated.View>
  );

  /* ─── Picker Modal renderer ─── */
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
        visible
        onClose={() => setPickerState({ visible: false, type: null })}
        onSelect={(val) => {
          switch (type) {
            case 'bloodType': setBloodType(val); break;
            case 'deliveryType': setDeliveryType(val); break;
            case 'birthAttendant': setBirthAttendant(val); break;
            case 'feedingPlan': setFeedingPlan(val); break;
          }
          triggerHaptic('light');
        }}
        options={options}
        selectedValue={value}
        title={title}
        isDark={isDark}
      />
    );
  };

  /* ─── Main render ─── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky header (on scroll) */}
      <Animated.View style={[styles.stickyHeader, {
        paddingTop: HEADER_TOP_PADDING,
        backgroundColor: isDark ? 'rgba(12,10,9,0.92)' : 'rgba(255,255,255,0.92)',
        borderBottomColor: isDark ? DS.darkBorder : DS.gray200,
      }, headerAnim]}>
        <BlurView intensity={isDark ? 90 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={handleBack} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.gray100 }]}>
            <Ionicons name="arrow-back" size={20} color={isDark ? DS.white : DS.gray800} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.headerTitle}>NEW BABY</GradientText>
            <Text style={[styles.headerSub, { color: isDark ? DS.gray400 : DS.gray500 }]}>Step {currentStep} of 2</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Animated.ScrollView
          ref={scrollViewRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: HEADER_TOP_PADDING + 8, paddingBottom: insets.bottom + 160, paddingHorizontal: DS.space.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Pulse header */}
          <PulseHeader
            isDark={isDark}
            avatar={avatar}
            gender={gender}
            name={name}
            ageDisplay={ageDisplay}
            currentStep={currentStep}
            parentName={userProfile?.fullName?.split(' ')[0]}
            onBack={handleBack}
          />

          <View style={{ marginTop: DS.space.lg }}>
            {currentStep === 1 ? renderStep1() : renderStep2()}
          </View>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>

        {/* Bottom actions */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: DS.space.lg, paddingTop: 10, paddingBottom: insets.bottom + 20 }}>
          <View style={[styles.bottomBlur, { backgroundColor: isDark ? 'rgba(28,25,23,0.95)' : 'rgba(255,255,255,0.95)', borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
            {currentStep === 1 ? (
              <PressableScale onPress={handleNext} activeScale={0.97} haptic="medium">
                <LinearGradient colors={[DS.primary, DS.accent]} style={styles.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.primaryBtnText}>Next Step</Text>
                  <Ionicons name="arrow-forward" size={20} color={DS.white} />
                </LinearGradient>
              </PressableScale>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <PressableScale onPress={() => setCurrentStep(1)} disabled={isLoading} activeScale={0.97}>
                  <View style={[styles.backBtn, { borderColor: isDark ? DS.darkBorder : DS.gray300 }]}>
                    <Text style={[styles.backBtnText, { color: DS.primary }]}>Back</Text>
                  </View>
                </PressableScale>

                <PressableScale onPress={() => handleCreateProfile(false)} disabled={isLoading} activeScale={0.97} style={{ flex: 1 }}>
                  <LinearGradient colors={[DS.primary, DS.accent]} style={styles.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {isLoading ? <ActivityIndicator color={DS.white} /> : (
                      <>
                        <Ionicons name="add-circle" size={18} color={DS.white} />
                        <Text style={styles.primaryBtnText}>Add Another</Text>
                      </>
                    )}
                  </LinearGradient>
                </PressableScale>

                <PressableScale onPress={() => handleCreateProfile(true)} disabled={isLoading} activeScale={0.97} style={{ flex: 1 }}>
                  <LinearGradient colors={[DS.success, '#059669']} style={styles.primaryBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {isLoading ? <ActivityIndicator color={DS.white} /> : (
                      <>
                        <Text style={styles.primaryBtnText}>Create</Text>
                        <Ionicons name="checkmark" size={18} color={DS.white} />
                      </>
                    )}
                  </LinearGradient>
                </PressableScale>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {renderPickerModal()}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Sticky header */
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: DS.space.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg, height: 48,
  },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: -2 },

  /* Pulse header */
  pulseWrap: {
    marginTop: DS.space.md, borderRadius: DS.radius['2xl'], padding: DS.space.lg,
    overflow: 'hidden', borderWidth: 1, ...DS.shadow.md, position: 'relative',
  },
  pulseGlowL: { position: 'absolute', top: -80, left: -60, width: 220, height: 220, borderRadius: 110, opacity: 0.9 },
  pulseGlowR: { position: 'absolute', top: -70, right: -70, width: 200, height: 200, borderRadius: 100, opacity: 0.8 },
  pulseBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: DS.space.md },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.md },
  pulseAvatarWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pulseAvatarGlow: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: `${DS.primary}35` },
  pulseAvatarRing: { position: 'absolute', width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  pulseAvatarInner: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pulseTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  pulseLivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pulseLiveText: { fontSize: 10, fontWeight: '700' },
  pulseName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  pulseSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  pulseProgress: { height: 4, borderRadius: 2, marginTop: DS.space.md, overflow: 'hidden' },
  pulseProgressFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },

  /* Labels */
  label: { fontSize: 13, fontWeight: '700' },
  stepIndicator: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: DS.space.sm },

  /* Input */
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: DS.radius.md, borderWidth: 1, paddingHorizontal: 14, height: 48,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '500' },
  textAreaBox: { height: 90, alignItems: 'flex-start', paddingTop: 12 },
  textArea: { height: 70, textAlignVertical: 'top' },

  /* Choice buttons */
  choiceBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: DS.radius.md,
  },
  skinToneBtn: {
    alignItems: 'center', padding: 5, borderRadius: DS.radius.md, position: 'relative',
  },
  toggleBtn: {
    alignItems: 'center', paddingVertical: 14, borderRadius: DS.radius.md,
  },

  /* Avatar */
  avatarSelector: {
    alignItems: 'center', padding: DS.space.lg, borderRadius: DS.radius.lg, borderWidth: 1,
  },
  avatarOption: {
    width: 62, height: 62, borderRadius: DS.radius.md, alignItems: 'center', justifyContent: 'center',
  },

  /* Section */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: DS.space.sm },
  sectionHeaderText: { fontSize: 14, fontWeight: '700' },

  /* Bottom action */
  bottomBlur: { borderRadius: DS.radius.lg, borderWidth: 1, padding: 10, overflow: 'hidden' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: DS.radius.md, gap: 8,
  },
  primaryBtnText: { color: DS.white, fontSize: 15, fontWeight: '700' },
  backBtn: {
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: DS.radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 14, fontWeight: '700' },

  /* Picker modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 400, maxHeight: '70%', borderRadius: DS.radius['2xl'], overflow: 'hidden', ...DS.shadow.lg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: DS.space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.08)',
  },
  pickerItemText: { fontSize: 14, fontWeight: '500' },

  /* Tooltip */
  tooltipCard: {
    position: 'absolute', top: -8, right: 0, width: Math.min(280, SCREEN_W - 80),
    padding: 14, borderRadius: DS.radius.md, borderWidth: 1, borderColor: `${DS.primary}30`, zIndex: 1000,
  },
  tooltipTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  tooltipText: { fontSize: 12, lineHeight: 18 },
});