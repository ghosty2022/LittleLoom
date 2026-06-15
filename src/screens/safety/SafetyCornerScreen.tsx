import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Share,
  Platform,
  Modal,
  Vibration,
  StatusBar,
  ScrollView,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
  FadeInUp,
  FadeIn,
  Layout,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../types/navigation';

import { useSafety } from '../../context/SafetyContext';
import type { EmergencyContact, SafetyTopic, SafetyChecklist } from '../../context/SafetyContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type SafetyCornerScreenProps = BottomTabScreenProps<MainTabParamList, 'SafetyCorner'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — Centralized theme-aware constants
   ═══════════════════════════════════════════════════════════════ */
const TOKENS = {
  emergency: {
    primary: '#ff4757',
    secondary: '#ff6b81',
    gradient: ['#ff4757', '#ff6348'] as const,
    glow: 'rgba(255,71,87,0.15)',
  },
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#3b82f6',
  spring: { damping: 15, mass: 1, stiffness: 150 },
  fadeDuration: 400,
  staggerDelay: 100,
} as const;

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS SETUP — SDK 52+ compliant
   ═══════════════════════════════════════════════════════════════ */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/* ═══════════════════════════════════════════════════════════════
   HOOK: useSafetyTheme — Extracted theme logic
   ═══════════════════════════════════════════════════════════════ */
const useSafetyTheme = () => {
  const { themeColors, isDark, triggerHaptic, hapticFeedback } = useCustomization();

  const colors = useMemo(() => ({
    text: isDark ? '#ffffff' : '#1a1a2e',
    textDark: '#ffffff',
    muted: '#6b7280',
    mutedDark: '#a0a0b0',
    card: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    bgLight: ['#f8faff', '#f0f4ff', '#e8eeff'] as const,
    bgDark: ['#0f0f1e', '#1a1a2e', '#16213e'] as const,
    primary: themeColors?.primary || '#667eea',
    secondary: themeColors?.secondary || '#764ba2',
    accent: themeColors?.accent || '#43e97b',
  }), [isDark, themeColors]);

  const getCategoryColor = useCallback((category: SafetyTopic['category']) => {
    switch (category) {
      case 'emergency': return TOKENS.emergency.primary;
      case 'prevention': return colors.accent;
      case 'daily': return colors.primary;
      default: return colors.primary;
    }
  }, [colors]);

  const getCategoryGradient = useCallback((category: SafetyTopic['category']) => {
    switch (category) {
      case 'emergency': return TOKENS.emergency.gradient;
      case 'prevention': return [colors.accent, '#38f9d7'] as const;
      case 'daily': return [colors.primary, colors.secondary] as const;
      default: return [colors.primary, colors.secondary] as const;
    }
  }, [colors]);

  return {
    isDark,
    colors,
    getCategoryColor,
    getCategoryGradient,
    triggerHaptic,
    hapticFeedback,
    themeColors,
  };
};

/* ═══════════════════════════════════════════════════════════════
   HOOK: useNotificationPermission — Consolidated permission handling
   ═══════════════════════════════════════════════════════════════ */
const useNotificationPermission = () => {
  const [granted, setGranted] = useState(false);
  const { error: showError } = useSweetAlert();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (mounted) setGranted(status === 'granted');
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (mounted) setGranted(newStatus === 'granted');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const ensurePermission = useCallback(async () => {
    if (granted) return true;
    const { status } = await Notifications.requestPermissionsAsync();
    const ok = status === 'granted';
    setGranted(ok);
    if (!ok) {
      showError('Permission Required', 'Please enable notifications in Settings to use reminders.');
      if (Platform.OS === 'ios') Linking.openURL('app-settings:');
      else Linking.openSettings();
    }
    return ok;
  }, [granted, showError]);

  return { granted, ensurePermission };
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: PressableScale — Reanimated v3 spring press
   ═══════════════════════════════════════════════════════════════ */
interface PressableScaleProps {
  children: React.ReactNode;
  onPress: () => void;
  onPressIn?: () => void;
  style?: any;
  activeScale?: number;
  hapticType?: 'light' | 'medium' | 'heavy' | 'success';
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'checkbox';
}

const PressableScale = memo<PressableScaleProps>(({
  children,
  onPress,
  onPressIn,
  style,
  activeScale = 0.96,
  hapticType = 'light',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
}) => {
  const { triggerHaptic, hapticFeedback } = useCustomization();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(activeScale, { duration: 80 });
    onPressIn?.();
  }, [activeScale, onPressIn, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, TOKENS.spring);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (hapticFeedback) triggerHaptic(hapticType).catch(() => {});
    onPress();
  }, [disabled, hapticFeedback, triggerHaptic, hapticType, onPress]);

  return (
    <Animated.View style={[style, animatedStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={disabled ? 1 : 0.8}
        disabled={disabled}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});

PressableScale.displayName = 'PressableScale';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: SafetyCard — Memoized with reanimated entry
   ═══════════════════════════════════════════════════════════════ */
interface SafetyCardProps {
  topic: SafetyTopic;
  index: number;
  onPress: () => void;
  onPressIn?: () => void;
}

const SafetyCard = memo<SafetyCardProps>(({ topic, index, onPress, onPressIn }) => {
  const { isDark, colors, getCategoryColor, triggerHaptic } = useSafetyTheme();
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * TOKENS.staggerDelay;
    translateY.value = withTiming(0, { duration: TOKENS.fadeDuration, delay });
    opacity.value = withTiming(1, { duration: TOKENS.fadeDuration, delay });
  }, [index, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const borderLeftColor = getCategoryColor(topic.category);
  const isEmergency = topic.category === 'emergency';
  const isCompleted = !!topic.completedAt;

  const handlePressIn = useCallback(() => {
    triggerHaptic('light');
    onPressIn?.();
  }, [triggerHaptic, onPressIn]);

  return (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
      <PressableScale
        onPress={onPress}
        onPressIn={handlePressIn}
        style={[
          styles.safetyCard,
          isDark && { backgroundColor: colors.card, borderColor: colors.cardBorder },
          { borderLeftColor, borderLeftWidth: 4 },
          isEmergency && styles.emergencyGlow,
          isCompleted && styles.completedCard,
        ]}
        accessibilityLabel={`${topic.title} safety topic`}
        accessibilityHint={`Tap to view ${topic.category} safety tips`}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${topic.color}15` }]}>
          <Ionicons
            name={topic.icon as keyof typeof Ionicons.glyphMap}
            size={24}
            color={topic.color}
          />
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {topic.title}
            </Text>
            {isEmergency && (
              <View style={[styles.emergencyBadge, { backgroundColor: topic.color }]}>
                <Text style={styles.emergencyText}>SOS</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardDescription, { color: isDark ? colors.mutedDark : colors.muted }]} numberOfLines={2}>
            {topic.description}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isDark ? colors.mutedDark : colors.muted}
        />
      </PressableScale>
    </Animated.View>
  );
});

SafetyCard.displayName = 'SafetyCard';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: EmergencyButton — With pulse animation
   ═══════════════════════════════════════════════════════════════ */
interface EmergencyButtonProps {
  contact: EmergencyContact;
  onPress: () => void;
  isSOS?: boolean;
  style?: any;
}

const EmergencyButton = memo<EmergencyButtonProps>(({ contact, onPress, isSOS, style }) => {
  const { isDark, colors } = useSafetyTheme();
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (!isSOS && contact.type !== 'emergency') return;
    pulseAnim.value = withSequence(
      withTiming(1.08, { duration: 800 }),
      withTiming(1, { duration: 800 })
    );
  }, [isSOS, contact.type, pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const iconName = isSOS ? 'alert' : (contact.icon as keyof typeof Ionicons.glyphMap);
  const iconSize = isSOS ? 32 : 24;
  const textColor = isSOS ? TOKENS.emergency.primary : contact.color;
  const gradientColors = isSOS
    ? ['#ff475720', '#ff475705']
    : [`${contact.color}20`, `${contact.color}05`];

  return (
    <Animated.View style={[pulseStyle, style]}>
      <PressableScale
        onPress={onPress}
        style={[
          styles.emergencyBtn,
          isDark && styles.emergencyBtnDark,
          isSOS && styles.sosButton,
          { borderColor: isSOS ? TOKENS.emergency.primary : contact.color },
        ]}
        hapticType={isSOS ? 'heavy' : 'medium'}
        accessibilityLabel={isSOS ? 'SOS Emergency button' : `Call ${contact.label}`}
        accessibilityHint={isSOS ? 'Triggers emergency protocol' : `Dials ${contact.number || 'not set'}`}
      >
        <LinearGradient colors={gradientColors as [string, string]} style={styles.emergencyBtnGradient}>
          <Ionicons name={iconName} size={iconSize} color={textColor} />
          <Text style={[styles.emergencyBtnText, { color: textColor, fontSize: isSOS ? 16 : 13 }]}>
            {isSOS ? 'SOS EMERGENCY' : contact.label}
          </Text>
          {!isSOS && contact.number && (
            <Text style={[styles.emergencyBtnNumber, { color: isDark ? colors.mutedDark : colors.muted }]}>
              {contact.number}
            </Text>
          )}
        </LinearGradient>
      </PressableScale>
    </Animated.View>
  );
});

EmergencyButton.displayName = 'EmergencyButton';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: QuickActionCard
   ═══════════════════════════════════════════════════════════════ */
interface QuickActionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradient: readonly [string, string];
  iconColor: string;
  onPress: () => void;
}

const QuickActionCard = memo<QuickActionCardProps>(({ icon, label, gradient, iconColor, onPress }) => {
  const { isDark, colors } = useSafetyTheme();

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.quickActionCard, isDark && { backgroundColor: colors.card }]}
      accessibilityLabel={label}
    >
      <LinearGradient colors={gradient as [string, string]} style={styles.quickActionGradient}>
        <Ionicons name={icon} size={24} color={iconColor} />
        <Text style={[styles.quickActionText, { color: colors.text }]}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
});

QuickActionCard.displayName = 'QuickActionCard';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: StatCard
   ═══════════════════════════════════════════════════════════════ */
interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string | number;
  label: string;
  onPress?: () => void;
}

const StatCard = memo<StatCardProps>(({ icon, iconColor, value, label, onPress }) => {
  const { isDark, colors } = useSafetyTheme();

  return (
    <PressableScale
      onPress={onPress || (() => {})}
      style={[styles.statItem, isDark && { backgroundColor: colors.card }]}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: isDark ? colors.mutedDark : colors.muted }]}>{label}</Text>
    </PressableScale>
  );
});

StatCard.displayName = 'StatCard';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: FilterChip
   ═══════════════════════════════════════════════════════════════ */
interface FilterChipProps {
  label: string;
  active: boolean;
  category: 'all' | 'emergency' | 'prevention' | 'daily';
  onPress: () => void;
}

const FilterChip = memo<FilterChipProps>(({ label, active, category, onPress }) => {
  const { getCategoryColor, colors } = useSafetyTheme();
  const activeColor = category === 'all' ? colors.primary : getCategoryColor(category);

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        active && { backgroundColor: activeColor },
      ]}
      onPress={onPress}
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: active }}
      accessibilityRole="button"
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

FilterChip.displayName = 'FilterChip';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: UnifiedBottomModal — Reusable modal shell
   ═══════════════════════════════════════════════════════════════ */
interface UnifiedBottomModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxHeight?: number;
  showHandle?: boolean;
}

const UnifiedBottomModal = memo<UnifiedBottomModalProps>(({
  visible,
  onClose,
  title,
  children,
  maxHeight = SCREEN_H * 0.85,
  showHandle = true,
}) => {
  const { isDark, colors } = useSafetyTheme();
  const translateY = useSharedValue(SCREEN_H);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SCREEN_H, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.modalBackdrop, backdropStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[
          styles.unifiedModalSheet,
          sheetStyle,
          { maxHeight },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <BlurView
          intensity={isDark ? 60 : 90}
          style={styles.unifiedModalBlur}
          tint={isDark ? 'dark' : 'light'}
        >
          {showHandle && <View style={styles.modalHandle} />}
          <View style={styles.unifiedModalHeader}>
            <Text style={[styles.unifiedModalTitle, { color: colors.text }]}>{title}</Text>
            <PressableScale onPress={onClose} hapticType="light" activeScale={0.85}>
              <View style={[styles.modalCloseBtn, isDark && styles.modalCloseBtnDark]}>
                <Ionicons name="close" size={22} color={colors.text} />
              </View>
            </PressableScale>
          </View>
          {children}
        </BlurView>
      </Animated.View>
    </View>
  );
});

UnifiedBottomModal.displayName = 'UnifiedBottomModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: ContactImportModal — Inside UnifiedBottomModal
   ═══════════════════════════════════════════════════════════════ */
interface ContactImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (contacts: EmergencyContact[]) => void;
}

const ContactImportModal = memo<ContactImportModalProps>(({ visible, onClose, onImport }) => {
  const { isDark, colors, themeColors } = useSafetyTheme();
  const [deviceContacts, setDeviceContacts] = useState<Contacts.Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { success, error: showError } = useSweetAlert();

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);
    Contacts.requestPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') {
        showError('Permission Denied', 'Please allow access to contacts.');
        if (mounted) onClose();
        return;
      }
      return Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
    }).then(result => {
      if (!mounted || !result) return;
      const valid = result.data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);
      setDeviceContacts(valid);
    }).catch(() => {
      showError('Error', 'Failed to load contacts.');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [visible, onClose, showError]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    const imported: EmergencyContact[] = [];
    deviceContacts.forEach(contact => {
      if (selectedContacts.has(contact.id)) {
        imported.push({
          id: `imported_${contact.id}_${Date.now()}`,
          label: contact.name || 'Unknown',
          number: contact.phoneNumbers?.[0]?.number || '',
          type: 'family',
          icon: 'person',
          color: themeColors?.primary || '#667eea',
          relation: 'Imported',
        });
      }
    });
    onImport(imported);
    success('Contacts Imported', `Successfully imported ${imported.length} contacts.`);
    onClose();
    setSelectedContacts(new Set());
  }, [deviceContacts, selectedContacts, onImport, onClose, success, themeColors]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return deviceContacts;
    const q = searchQuery.toLowerCase();
    return deviceContacts.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phoneNumbers?.some(p => p.number?.includes(q))
    );
  }, [deviceContacts, searchQuery]);

  return (
    <UnifiedBottomModal visible={visible} onClose={onClose} title="Import Contacts" maxHeight={SCREEN_H * 0.9}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={isDark ? colors.mutedDark : colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search contacts..."
          placeholderTextColor={isDark ? colors.mutedDark : colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.modalLoading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.modalLoadingText, { color: isDark ? colors.mutedDark : colors.muted }]}>
            Loading contacts...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalScrollContent}
          style={{ maxHeight: SCREEN_H * 0.5 }}
        >
          {filteredContacts.map(contact => {
            const isSelected = selectedContacts.has(contact.id);
            const phone = contact.phoneNumbers?.[0]?.number || 'No number';
            return (
              <TouchableOpacity
                key={contact.id}
                style={[
                  styles.contactItem,
                  isSelected && { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
                ]}
                onPress={() => toggleSelection(contact.id)}
              >
                <View style={[styles.contactAvatar, { backgroundColor: `${colors.primary}20` }]}>
                  <Text style={[styles.contactAvatarText, { color: colors.primary }]}>
                    {contact.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{contact.name || 'Unknown'}</Text>
                  <Text style={[styles.contactPhone, { color: isDark ? colors.mutedDark : colors.muted }]}>{phone}</Text>
                </View>
                <View style={[
                  styles.checkbox,
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.importButton, { backgroundColor: colors.primary, opacity: selectedContacts.size === 0 ? 0.5 : 1 }]}
        onPress={handleImport}
        disabled={selectedContacts.size === 0}
      >
        <Text style={styles.importButtonText}>
          Import {selectedContacts.size > 0 ? `${selectedContacts.size} ` : ''}Contact{selectedContacts.size !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    </UnifiedBottomModal>
  );
});

ContactImportModal.displayName = 'ContactImportModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: ReminderModal — SDK 52+ API with proper trigger types
   ═══════════════════════════════════════════════════════════════ */
interface ReminderModalProps {
  visible: boolean;
  onClose: () => void;
}

const ReminderModal = memo<ReminderModalProps>(({ visible, onClose }) => {
  const { isDark, colors } = useSafetyTheme();
  const { ensurePermission } = useNotificationPermission();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hours, setHours] = useState('1');
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useSweetAlert();

  const scheduleReminder = useCallback(async () => {
    if (!title.trim()) {
      showError('Missing Title', 'Please enter a reminder title.');
      return;
    }

    const hasPermission = await ensurePermission();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const triggerDate = new Date(Date.now() + parseInt(hours || '1') * 60 * 60 * 1000);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 ${title}`,
          body: body || 'Safety reminder from LittleLoom',
          sound: true,
          priority: Notifications.AndroidImportance.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      success('Reminder Set', `You'll be reminded in ${hours} hour${parseInt(hours) !== 1 ? 's' : ''}.`);
      setTitle('');
      setBody('');
      setHours('1');
      onClose();
    } catch (err) {
      showError('Error', 'Failed to schedule reminder.');
    } finally {
      setLoading(false);
    }
  }, [title, body, hours, onClose, success, showError, ensurePermission]);

  const hourOptions = ['1', '2', '4', '8', '24', '48'];

  return (
    <UnifiedBottomModal visible={visible} onClose={onClose} title="Safety Reminder">
      <Text style={[styles.inputLabel, { color: isDark ? colors.mutedDark : colors.muted }]}>Reminder Title</Text>
      <TextInput
        style={[styles.textInput, { color: colors.text, borderColor: isDark ? '#333' : '#e2e8f0' }]}
        placeholder="e.g., Check car seat installation"
        placeholderTextColor={isDark ? colors.mutedDark : colors.muted}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={[styles.inputLabel, { color: isDark ? colors.mutedDark : colors.muted }]}>Details (optional)</Text>
      <TextInput
        style={[styles.textInput, { color: colors.text, borderColor: isDark ? '#333' : '#e2e8f0', height: 80 }]}
        placeholder="Additional details..."
        placeholderTextColor={isDark ? colors.mutedDark : colors.muted}
        value={body}
        onChangeText={setBody}
        multiline
      />

      <Text style={[styles.inputLabel, { color: isDark ? colors.mutedDark : colors.muted }]}>Remind me in</Text>
      <View style={styles.hoursRow}>
        {hourOptions.map(h => (
          <TouchableOpacity
            key={h}
            style={[
              styles.hourChip,
              hours === h && { backgroundColor: colors.primary },
            ]}
            onPress={() => setHours(h)}
          >
            <Text style={[styles.hourChipText, hours === h && { color: '#fff' }]}>{h}h</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.importButton, { backgroundColor: colors.primary, marginTop: 20, opacity: loading ? 0.7 : 1 }]}
        onPress={scheduleReminder}
        disabled={loading}
      >
        <Text style={styles.importButtonText}>{loading ? 'Scheduling...' : 'Set Reminder'}</Text>
      </TouchableOpacity>
    </UnifiedBottomModal>
  );
});

ReminderModal.displayName = 'ReminderModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: DoctorReportModal
   ═══════════════════════════════════════════════════════════════ */
interface DoctorReport {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'reviewed';
}

interface DoctorReportModalProps {
  visible: boolean;
  onClose: () => void;
}

const DoctorReportModal = memo<DoctorReportModalProps>(({ visible, onClose }) => {
  const { isDark, colors } = useSafetyTheme();
  const [reports, setReports] = useState<DoctorReport[]>([]);
  const { success, error: showError, confirm } = useSweetAlert();

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const newReport: DoctorReport = {
          id: `report_${Date.now()}`,
          name: asset.name || 'Unknown Report',
          uri: asset.uri,
          mimeType: asset.mimeType || 'application/pdf',
          size: asset.size || 0,
          uploadedAt: new Date().toISOString(),
          status: 'pending',
        };
        setReports(prev => [newReport, ...prev]);
        success('Report Added', 'Doctor report uploaded and is pending review.');
      }
    } catch {
      showError('Error', 'Failed to pick document.');
    }
  }, [success, showError]);

  const approveReport = useCallback((reportId: string) => {
    confirm(
      'Approve Report',
      'Mark this doctor report as reviewed and approved?',
      () => {
        setReports(prev => prev.map(r =>
          r.id === reportId ? { ...r, status: 'approved', approvedBy: 'You' } : r
        ));
        success('Report Approved', 'The report has been marked as reviewed.');
      },
      () => {},
      'Approve',
      'Cancel'
    );
  }, [confirm, success]);

  return (
    <UnifiedBottomModal visible={visible} onClose={onClose} title="Doctor Reports" maxHeight={SCREEN_H * 0.9}>
      <TouchableOpacity
        style={[styles.addReportButton, { borderColor: colors.primary }]}
        onPress={pickDocument}
      >
        <Ionicons name="document-attach" size={20} color={colors.primary} />
        <Text style={[styles.addReportText, { color: colors.primary }]}>Upload PDF Report</Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: SCREEN_H * 0.5 }}
        contentContainerStyle={styles.modalScrollContent}
      >
        {reports.map(item => (
          <View key={item.id} style={[styles.reportItem, isDark && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
            <View style={[styles.reportIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
            </View>
            <View style={styles.reportInfo}>
              <Text style={[styles.reportName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.reportMeta, { color: isDark ? colors.mutedDark : colors.muted }]}>
                {item.size > 0 ? `${(item.size / 1024).toFixed(1)} KB` : 'Size unknown'} • {new Date(item.uploadedAt).toLocaleDateString()}
              </Text>
              <View style={styles.reportStatusRow}>
                <View style={[
                  styles.statusBadge,
                  item.status === 'approved' && { backgroundColor: '#22c55e20' },
                  item.status === 'pending' && { backgroundColor: '#f59e0b20' },
                ]}>
                  <Text style={[
                    styles.statusText,
                    item.status === 'approved' && { color: TOKENS.success },
                    item.status === 'pending' && { color: TOKENS.warning },
                  ]}>
                    {item.status === 'approved' ? `✓ Approved by ${item.approvedBy}` : item.status}
                  </Text>
                </View>
              </View>
            </View>
            {item.status !== 'approved' && (
              <TouchableOpacity
                style={[styles.approveBtn, { backgroundColor: colors.primary }]}
                onPress={() => approveReport(item.id)}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {reports.length === 0 && (
          <View style={styles.emptyReports}>
            <Ionicons name="documents-outline" size={48} color={isDark ? colors.mutedDark : colors.muted} />
            <Text style={[styles.emptyReportsText, { color: isDark ? colors.mutedDark : colors.muted }]}>
              No reports yet. Upload a PDF to get started.
            </Text>
          </View>
        )}
      </ScrollView>
    </UnifiedBottomModal>
  );
});

DoctorReportModal.displayName = 'DoctorReportModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: ChecklistModal
   ═══════════════════════════════════════════════════════════════ */
const ChecklistModal = memo<{ visible: boolean; onClose: () => void }>(({ visible, onClose }) => {
  const { isDark, colors } = useSafetyTheme();
  const { checklists, toggleChecklistItem, triggerHaptic } = useSafety();
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const { success } = useSweetAlert();

  useEffect(() => {
    if (visible && checklists.length > 0 && !activeChecklistId) {
      setActiveChecklistId(checklists[0].id);
    }
  }, [visible, checklists, activeChecklistId]);

  const activeChecklist = useMemo(() =>
    checklists.find(cl => cl.id === activeChecklistId) || checklists[0] || null,
    [checklists, activeChecklistId]
  );

  const handleToggle = useCallback((itemId: string) => {
    if (!activeChecklist) return;
    toggleChecklistItem(activeChecklist.id, itemId);
    triggerHaptic('light');
    const checklist = checklists.find(c => c.id === activeChecklist.id);
    if (checklist?.items.every(item => item.completed)) {
      success('Checklist Complete!', `You've completed the ${checklist.title}. Great job!`);
    }
  }, [activeChecklist, toggleChecklistItem, triggerHaptic, checklists, success]);

  if (!activeChecklist) return null;

  return (
    <UnifiedBottomModal visible={visible} onClose={onClose} title="Safety Checklist" maxHeight={SCREEN_H * 0.85}>
      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.checklistTabs}
      >
        {checklists.map(cl => (
          <TouchableOpacity
            key={cl.id}
            style={[
              styles.checklistTab,
              activeChecklistId === cl.id && { backgroundColor: colors.accent },
            ]}
            onPress={() => setActiveChecklistId(cl.id)}
          >
            <Text style={[
              styles.checklistTabText,
              activeChecklistId === cl.id && styles.checklistTabTextActive,
            ]}>
              {cl.category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Progress */}
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: `${activeChecklist.progress}%`, backgroundColor: colors.accent },
          ]}
        />
      </View>
      <Text style={[styles.progressText, { color: colors.text }]}>
        {activeChecklist.progress}% Complete
      </Text>

      {/* Items */}
      <ScrollView style={{ maxHeight: SCREEN_H * 0.4 }} showsVerticalScrollIndicator={false}>
        {activeChecklist.items.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.checklistItem}
            onPress={() => handleToggle(item.id)}
            accessibilityLabel={`${item.text}${item.completed ? ', completed' : ''}${item.critical ? ', critical' : ''}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.completed }}
          >
            <View style={[
              styles.checkbox,
              item.completed && { backgroundColor: colors.accent, borderColor: colors.accent },
              item.critical && !item.completed && { borderColor: TOKENS.emergency.primary },
            ]}>
              {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={[
              styles.checklistItemText,
              { color: colors.text },
              item.completed && styles.checklistItemCompleted,
              item.critical && !item.completed && { color: TOKENS.emergency.primary },
            ]}>
              {item.text}
              {item.critical && <Text style={styles.criticalTag}> CRITICAL</Text>}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.resetChecklistBtn, { borderColor: isDark ? '#444' : '#e2e8f0' }]}
        onPress={() => {
          activeChecklist.items.forEach(item => {
            if (item.completed) toggleChecklistItem(activeChecklist.id, item.id);
          });
          success('Checklist Reset', 'All items have been reset.');
        }}
      >
        <Ionicons name="refresh" size={16} color={isDark ? colors.mutedDark : colors.muted} />
        <Text style={[styles.resetChecklistText, { color: isDark ? colors.mutedDark : colors.muted }]}>Reset Checklist</Text>
      </TouchableOpacity>
    </UnifiedBottomModal>
  );
});

ChecklistModal.displayName = 'ChecklistModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: TopicDetailModal
   ═══════════════════════════════════════════════════════════════ */
interface TopicModalProps {
  visible: boolean;
  topic: SafetyTopic | null;
  currentBaby: { name: string; age: string; avatar?: string | null; gender?: string } | null;
  onClose: () => void;
  onComplete: (topicId: string) => void;
  onCallEmergency: (number: string, label: string, type: string) => void;
}

const TopicDetailModal = memo<TopicModalProps>(({
  visible,
  topic,
  currentBaby,
  onClose,
  onComplete,
  onCallEmergency,
}) => {
  const { isDark, colors, triggerHaptic } = useSafetyTheme();
  const { success } = useSweetAlert();

  const handleComplete = useCallback(() => {
    if (!topic) return;
    onComplete(topic.id);
    triggerHaptic('success');
    success('Topic Completed!', `You've completed "${topic.title}". Your safety score has improved!`);
    onClose();
  }, [topic, onComplete, triggerHaptic, onClose, success]);

  const handleShare = useCallback(() => {
    if (!topic) return;
    Share.share({ message: `${topic.title}\n\n${topic.tips.join('\n')}` });
  }, [topic]);

  if (!topic) return null;

  return (
    <UnifiedBottomModal visible={visible} onClose={onClose} title="" maxHeight={SCREEN_H * 0.92}>
      <AutoHideScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.topicScrollContent}>
        <View style={styles.modalHeader}>
          <View style={[styles.modalIconContainer, { backgroundColor: `${topic.color}15` }]}>
            <Ionicons name={topic.icon as keyof typeof Ionicons.glyphMap} size={28} color={topic.color} />
          </View>
        </View>

        <Text style={[styles.modalTitle, { color: colors.text }]}>{topic.title}</Text>
        <Text style={[styles.modalDescription, { color: isDark ? colors.mutedDark : colors.muted }]}>
          {topic.description}
        </Text>

        {currentBaby && (
          <View style={[styles.babyBanner, isDark && { backgroundColor: 'rgba(250,112,154,0.2)' }]}>
            <SafeBabyAvatar avatar={currentBaby.avatar || null} gender={currentBaby.gender || 'other'} size={40} />
            <Text style={[styles.babyBannerText, isDark && { color: '#fc5c7d' }]}>
              Tips for {currentBaby.name} ({currentBaby.age})
            </Text>
          </View>
        )}

        <View style={styles.tipsContainer}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>Key Safety Tips</Text>
          {topic.tips.map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <View style={[styles.tipBullet, { backgroundColor: topic.color }]}>
                <Text style={styles.tipNumber}>{index + 1}</Text>
              </View>
              <Text style={[styles.tipText, { color: isDark ? '#d1d5db' : '#4b5563' }]}>{tip}</Text>
            </View>
          ))}
        </View>

        {topic.emergencyNumbers && topic.emergencyNumbers.length > 0 && (
          <View style={styles.emergencyActionsContainer}>
            <Text style={[styles.emergencyActionsTitle, { color: colors.text }]}>Emergency Actions</Text>
            {topic.emergencyNumbers.map((num, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.emergencyActionBtn, { backgroundColor: topic.color }]}
                onPress={() => onCallEmergency(num.number, num.label, 'emergency')}
                accessibilityLabel={`Call ${num.label}`}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.emergencyActionText}>Call {num.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: colors.accent }]}
          onPress={handleComplete}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.completeBtnText}>Mark as Completed</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : colors.primary} />
          <Text style={[styles.shareText, isDark && { color: '#a0a0b0' }]}>Share Tips</Text>
        </TouchableOpacity>
      </AutoHideScrollView>
    </UnifiedBottomModal>
  );
});

TopicDetailModal.displayName = 'TopicDetailModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: SafetyPill
   ═══════════════════════════════════════════════════════════════ */
interface SafetyPillProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

const SafetyPill = memo<SafetyPillProps>(({ icon, label, color, onPress }) => (
  <PressableScale onPress={onPress} style={[styles.pill, { backgroundColor: `${color}15` }]} activeScale={0.95}>
    <Ionicons name={icon} size={16} color={color} />
    <Text style={[styles.pillText, { color }]}>{label}</Text>
  </PressableScale>
));

SafetyPill.displayName = 'SafetyPill';

/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN — Clean, feature-driven layout
   ═══════════════════════════════════════════════════════════════ */
export default function SafetyCornerScreen({ navigation }: SafetyCornerScreenProps) {
  const [selectedTopic, setSelectedTopic] = useState<SafetyTopic | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [checklistVisible, setChecklistVisible] = useState(false);
  const [contactImportVisible, setContactImportVisible] = useState(false);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'emergency' | 'prevention' | 'daily'>('all');

  const {
    topics,
    emergencyContacts,
    callEmergency,
    triggerSOS,
    findNearbyHospitals,
    findNearbyPediatricians,
    shareLocationWithEmergency,
    markTipAsViewed,
    getSafetyScore,
    streakDays,
    currentLocation,
    markTopicCompleted,
    importFamilyContacts,
    addCustomEmergencyContact,
  } = useSafety();

  const { currentBaby } = useBaby();
  const { guardians, parent2 } = useFamily();
  const { userProfile: authProfile } = useAuth();
  const { isDark, colors, getCategoryColor, triggerHaptic } = useSafetyTheme();
  const { success, confirm } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolate.CLAMP),
  }));

  useEffect(() => {
    const familyMembers: any[] = [];
    if (authProfile?.phoneNumber) familyMembers.push({ ...authProfile, relationship: 'Parent (You)', role: 'parent1' });
    if (parent2?.phoneNumber) familyMembers.push({ ...parent2, relationship: 'Co-Parent', role: 'parent2' });
    if (guardians?.length) familyMembers.push(...guardians);
    if (familyMembers.length > 0) importFamilyContacts(familyMembers);
  }, [authProfile, parent2, guardians, importFamilyContacts]);

  const safetyScore = useMemo(() => getSafetyScore(), [getSafetyScore]);
  const completedCount = useMemo(() => topics.filter((t: SafetyTopic) => t.completedAt).length, [topics]);
  const filteredTopics = useMemo(() => topics.filter((t: SafetyTopic) => activeCategory === 'all' || t.category === activeCategory), [topics, activeCategory]);
  const defaultContacts = useMemo(() => emergencyContacts.filter((c: EmergencyContact) => c.isDefault), [emergencyContacts]);
  const familyContacts = useMemo(() => emergencyContacts.filter((c: EmergencyContact) => c.type === 'family'), [emergencyContacts]);

  const babyInfo = useMemo(() => {
    if (!currentBaby) return null;
    return { name: currentBaby.name, age: currentBaby.age, avatar: currentBaby.avatar, gender: currentBaby.gender };
  }, [currentBaby]);

  const scoreColor = useMemo(() => {
    if (safetyScore > 80) return TOKENS.success;
    if (safetyScore > 50) return TOKENS.warning;
    return TOKENS.emergency.primary;
  }, [safetyScore]);

  const handleTopicPress = useCallback(async (topic: SafetyTopic) => {
    setSelectedTopic(topic);
    setModalVisible(true);
    await markTipAsViewed(topic.id);
    triggerHaptic('light');
  }, [markTipAsViewed, triggerHaptic]);

  const handleSOS = useCallback(() => {
    confirm(
      'SOS Emergency',
      'This will call 911 and alert your emergency contacts with your location. Are you sure?',
      () => {
        Vibration.vibrate([0, 500, 200, 500]);
        triggerSOS();
        success('SOS Triggered', 'Emergency services have been contacted.');
      },
      () => {},
      'Call 911',
      'Cancel'
    );
  }, [triggerSOS, confirm, success]);

  const handleCategoryChange = useCallback((cat: typeof activeCategory) => {
    setActiveCategory(cat);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleCompleteTopic = useCallback((topicId: string) => markTopicCompleted(topicId), [markTopicCompleted]);
  const handleCloseModal = useCallback(() => setModalVisible(false), []);
  const handleCloseChecklist = useCallback(() => setChecklistVisible(false), []);

  const handleImportContacts = useCallback((imported: EmergencyContact[]) => {
    imported.forEach(contact => {
      addCustomEmergencyContact({
        label: contact.label,
        number: contact.number,
        type: 'family',
        icon: 'person',
        color: colors.primary,
        relation: contact.relation,
      });
    });
  }, [addCustomEmergencyContact, colors.primary]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

{/* Floating Header */}
<Animated.View style={[styles.floatingHeader, headerOpacity, { paddingTop: insets.top }]}>
  <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
  <View style={styles.floatingHeaderContent}>
    <Text style={[styles.floatingHeaderText, { color: colors.text }]}>Safety Corner</Text>
    {streakDays > 0 && (
      <View style={styles.streakBadge}>
        <Ionicons name="flame" size={14} color="#ff9500" />
        <Text style={styles.streakText}>{streakDays} day streak</Text>
      </View>
    )}
  </View>
</Animated.View>

      {/* Main Content */}
      <LinearGradient colors={isDark ? colors.bgDark : colors.bgLight} style={[styles.gradient, { paddingTop: insets.top }]}>
        <AutoHideScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {/* Hero */}
          <Animated.View entering={FadeInUp.duration(500)} style={styles.heroSection}>
            <View style={styles.heroIconContainer}>
              <LinearGradient colors={TOKENS.emergency.gradient} style={styles.heroIconGradient}>
                <Ionicons name="shield-checkmark" size={40} color="#fff" />
              </LinearGradient>
              <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
                <Text style={styles.scoreText}>{safetyScore}%</Text>
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Safety Corner</Text>
            <Text style={[styles.heroSubtitle, { color: isDark ? colors.mutedDark : colors.muted }]}>
              {babyInfo ? `Protecting ${babyInfo.name} (${babyInfo.age})` : 'Your family safety hub'}
            </Text>

            {babyInfo && (
              <View style={styles.babyAvatarSection}>
                <SafeBabyAvatar avatar={babyInfo.avatar || null} gender={babyInfo.gender || 'other'} size={60} />
                <Text style={[styles.babyAvatarLabel, { color: isDark ? colors.mutedDark : colors.muted }]}>{babyInfo.name}</Text>
              </View>
            )}

            <View style={styles.quickStats}>
              <StatCard icon="checkmark-circle" iconColor={colors.accent} value={completedCount} label="Completed" />
              <StatCard icon="flame" iconColor="#ff9500" value={streakDays} label="Day Streak" />
              <StatCard icon="list" iconColor={colors.primary} value="Check" label="List" onPress={() => setChecklistVisible(true)} />
            </View>
          </Animated.View>

          {/* SOS */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.sosSection}>
            <EmergencyButton
              contact={{ id: 'sos', label: 'SOS', number: '911', type: 'emergency', icon: 'alert', color: TOKENS.emergency.primary }}
              onPress={handleSOS}
              isSOS
            />
            <Text style={[styles.sosDisclaimer, { color: isDark ? colors.mutedDark : colors.muted }]}>
              Press in life-threatening emergencies only. Calls 911 and alerts family.
            </Text>
          </Animated.View>

          {/* Quick Actions Bar */}
          <Animated.View entering={FadeInUp.delay(150)} style={styles.quickActionsBar}>
            <PressableScale
              onPress={() => setContactImportVisible(true)}
              style={[styles.quickBarBtn, { backgroundColor: `${colors.primary}15` }]}
              activeScale={0.95}
            >
              <Ionicons name="people" size={20} color={colors.primary} />
              <Text style={[styles.quickBarText, { color: colors.primary }]}>Import Contacts</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setReminderVisible(true)}
              style={[styles.quickBarBtn, { backgroundColor: `${colors.accent}15` }]}
              activeScale={0.95}
            >
              <Ionicons name="notifications" size={20} color={colors.accent} />
              <Text style={[styles.quickBarText, { color: colors.accent }]}>Set Reminder</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setReportVisible(true)}
              style={[styles.quickBarBtn, { backgroundColor: `${TOKENS.info}15` }]}
              activeScale={0.95}
            >
              <Ionicons name="document-text" size={20} color={TOKENS.info} />
              <Text style={[styles.quickBarText, { color: TOKENS.info }]}>Reports</Text>
            </PressableScale>
          </Animated.View>

          {/* Emergency Contacts */}
          <Animated.View entering={FadeInUp.delay(200)} style={styles.emergencySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: TOKENS.emergency.secondary }]}>EMERGENCY CONTACTS</Text>
              <TouchableOpacity onPress={() => setContactImportVisible(true)}>
                <Text style={[styles.importLink, { color: colors.primary }]}>+ Import</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.emergencyGrid}>
              {defaultContacts.map(contact => (
                <EmergencyButton
                  key={contact.id}
                  contact={contact}
                  onPress={() => callEmergency(contact.number, contact.label, contact.type)}
                />
              ))}
            </View>

            {familyContacts.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.familyContactsScroll} contentContainerStyle={styles.familyContactsContent}>
                {familyContacts.map(contact => (
                  <TouchableOpacity
                    key={contact.id}
                    style={[styles.familyChip, isDark && styles.familyChipDark]}
                    onPress={() => callEmergency(contact.number, contact.label, 'family')}
                  >
                    {contact.avatar ? (
                      <SafeParentAvatar avatar={contact.avatar} name={contact.label} size={28} />
                    ) : (
                      <Ionicons name={contact.icon as keyof typeof Ionicons.glyphMap} size={16} color={contact.color} />
                    )}
                    <Text style={[styles.familyChipText, { color: colors.text }]}>{contact.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Animated.View>

          {/* Filter */}
          <Animated.View entering={FadeInUp.delay(250)} style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
              {(['all', 'emergency', 'prevention', 'daily'] as const).map(cat => (
                <FilterChip
                  key={cat}
                  label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  active={activeCategory === cat}
                  category={cat}
                  onPress={() => handleCategoryChange(cat)}
                />
              ))}
            </ScrollView>
          </Animated.View>

          {/* Safety Topics */}
          <Animated.View entering={FadeInUp.delay(300)} layout={Layout.springify()} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Safety Topics</Text>
            {filteredTopics.map((topic, index) => (
              <SafetyCard
                key={topic.id}
                topic={topic}
                index={index}
                onPress={() => handleTopicPress(topic)}
              />
            ))}
            {filteredTopics.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={48} color={isDark ? colors.mutedDark : colors.muted} />
                <Text style={[styles.emptyText, { color: isDark ? colors.mutedDark : colors.muted }]}>No topics in this category</Text>
              </View>
            )}
          </Animated.View>

          {/* Location */}
          {currentLocation && (
            <BlurView intensity={isDark ? 20 : 60} style={styles.locationCard} tint={isDark ? 'dark' : 'light'}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <Text style={[styles.locationText, { color: isDark ? colors.mutedDark : colors.muted }]}>
                Location active • Ready for emergency sharing
              </Text>
            </BlurView>
          )}

          {/* Quick Actions Grid */}
          <Animated.View entering={FadeInUp.delay(350)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <QuickActionCard
                icon="call"
                label="Call 911"
                gradient={[`${TOKENS.emergency.primary}20`, `${TOKENS.emergency.primary}05`]}
                iconColor={TOKENS.emergency.primary}
                onPress={() => callEmergency('911', 'Emergency', 'emergency')}
              />
              <QuickActionCard
                icon="location"
                label="Hospitals"
                gradient={['#11998e20', '#11998e05']}
                iconColor="#11998e"
                onPress={findNearbyHospitals}
              />
              <QuickActionCard
                icon="medical"
                label="Pediatrician"
                gradient={[`${colors.primary}20`, `${colors.primary}05`]}
                iconColor={colors.primary}
                onPress={findNearbyPediatricians}
              />
              <QuickActionCard
                icon="share"
                label="Share Loc"
                gradient={[`${colors.accent}20`, `${colors.accent}05`]}
                iconColor={colors.accent}
                onPress={() => shareLocationWithEmergency()}
              />
            </View>
          </Animated.View>

          {/* Safety Pills */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Safety Pills</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
              <SafetyPill icon="medical" label="CPR Guide" color={TOKENS.emergency.primary} onPress={() => {}} />
              <SafetyPill icon="warning" label="Choking" color={TOKENS.warning} onPress={() => {}} />
              <SafetyPill icon="water" label="Water Safety" color={TOKENS.info} onPress={() => {}} />
              <SafetyPill icon="sunny" label="Sun Safety" color={colors.accent} onPress={() => {}} />
              <SafetyPill icon="bed" label="Safe Sleep" color={colors.primary} onPress={() => {}} />
            </ScrollView>
          </Animated.View>

          {/* Disclaimer */}
          <BlurView intensity={isDark ? 20 : 60} style={styles.disclaimer} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="information-circle" size={20} color={isDark ? colors.mutedDark : colors.muted} />
            <Text style={[styles.disclaimerText, isDark && { color: '#888' }]}>
              This information is for educational purposes only. In case of emergency, always call 911 immediately.
            </Text>
          </BlurView>
        </AutoHideScrollView>
      </LinearGradient>

      {/* Modals */}
      <ChecklistModal visible={checklistVisible} onClose={handleCloseChecklist} />
      <TopicDetailModal
        visible={modalVisible}
        topic={selectedTopic}
        currentBaby={babyInfo}
        onClose={handleCloseModal}
        onComplete={handleCompleteTopic}
        onCallEmergency={callEmergency}
      />
      <ContactImportModal visible={contactImportVisible} onClose={() => setContactImportVisible(false)} onImport={handleImportContacts} />
      <ReminderModal visible={reminderVisible} onClose={() => setReminderVisible(false)} />
      <DoctorReportModal visible={reportVisible} onClose={() => setReportVisible(false)} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES — Consolidated and organized
   ═══════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },

  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: Platform.OS === 'ios' ? 100 : 80,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  floatingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingHeaderText: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: { fontSize: 12, fontWeight: '600', color: '#ff9500' },

  content: { paddingHorizontal: 20 },

  heroSection: { alignItems: 'center', marginTop: 20, marginBottom: 24 },
  heroIconContainer: { position: 'relative', marginBottom: 16 },
  heroIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  scoreBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  scoreText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#1a1a2e', marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  babyAvatarSection: { alignItems: 'center', marginTop: 16, marginBottom: 8, gap: 8 },
  babyAvatarLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280' },

  quickStats: { flexDirection: 'row', gap: 16, marginTop: 20 },
  statItem: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  sosSection: { marginBottom: 24, alignItems: 'center' },
  sosDisclaimer: { fontSize: 11, color: '#999', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },

  quickActionsBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 10 },
  quickBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    gap: 6,
  },
  quickBarText: { fontSize: 12, fontWeight: '700' },

  emergencySection: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  importLink: { fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#ff4757', letterSpacing: 1 },
  emergencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  emergencyBtn: {
    width: (SCREEN_W - 50) / 2,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sosButton: { width: SCREEN_W - 40, borderWidth: 2, borderRadius: 20 },
  emergencyBtnDark: { borderColor: 'rgba(255,255,255,0.1)' },
  emergencyBtnGradient: { padding: 16, alignItems: 'center', gap: 6 },
  emergencyBtnText: { fontSize: 13, fontWeight: '700' },
  emergencyBtnNumber: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  familyContactsScroll: { marginTop: 12 },
  familyContactsContent: { paddingRight: 20 },
  familyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  familyChipDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
  familyChipText: { fontSize: 12, fontWeight: '600', color: '#1a1a2e' },

  filterContainer: { marginBottom: 20 },
  filterContent: { paddingRight: 20, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  filterChipActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#fff' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15, color: '#6b7280', fontWeight: '500' },

  cardContainer: { marginBottom: 10 },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  emergencyGlow: {
    shadowColor: '#ff4757',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  completedCard: {
    opacity: 0.8,
    borderLeftColor: '#43e97b',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  completedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#43e97b',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardContent: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginRight: 8,
    flex: 1,
  },
  emergencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emergencyText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },

  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionCard: {
    width: (SCREEN_W - 50) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
  },

  pillsContainer: {
    paddingRight: 20,
    gap: 10,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },

  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  unifiedModalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  unifiedModalBlur: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  unifiedModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  unifiedModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    marginHorizontal: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    marginHorizontal: 16,
  },
  hoursRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginHorizontal: 16,
  },
  hourChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  hourChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },

  addReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  addReportText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reportName: {
    fontSize: 15,
    fontWeight: '600',
  },
  reportMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  reportStatusRow: {
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  approveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyReports: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyReportsText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  topicScrollContent: {
    padding: 24,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 22,
  },

  babyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250,112,154,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  babyBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fa709a',
  },

  tipsContainer: { marginBottom: 24 },
  tipsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  tipBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    minWidth: 24,
  },
  tipNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },

  emergencyActionsContainer: { marginBottom: 24 },
  emergencyActionsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  emergencyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 8,
  },
  emergencyActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  completeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
  },

  checklistTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  checklistTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  checklistTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  checklistTabTextActive: { color: '#fff' },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginBottom: 8,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  checklistItemText: {
    flex: 1,
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 20,
  },
  checklistItemCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  criticalTag: {
    color: '#ff4757',
    fontWeight: '700',
    fontSize: 11,
  },
  resetChecklistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    marginHorizontal: 16,
    gap: 6,
  },
  resetChecklistText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
