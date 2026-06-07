// src/screens/SafetyCornerScreen.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  Share,
  Platform,
  Modal,
  Vibration,
  StatusBar,
  Animated,
  ScrollView,
  FlatList,
  Switch,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../types/navigation';

import { useSafety } from '../../context/SafetyContext';
import type { EmergencyContact, SafetyTopic, SafetyChecklist } from '../../context/SafetyContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type SafetyCornerScreenProps = BottomTabScreenProps<MainTabParamList, 'SafetyCorner'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════
   THEME & DESIGN TOKENS — Uses customization theme colors
   ═══════════════════════════════════════════════════════════════ */
const createTheme = (themeColors: { primary: string; secondary: string; accent: string }) => ({
  emergency: {
    primary: '#ff4757',
    secondary: '#ff6b81',
    gradient: ['#ff4757', '#ff6348'] as const,
    glow: 'rgba(255,71,87,0.15)',
  },
  prevention: {
    primary: themeColors.accent || '#43e97b',
    secondary: '#38f9d7',
    gradient: [themeColors.accent || '#43e97b', '#38f9d7'] as const,
    glow: `rgba(${parseInt((themeColors.accent || '#43e97b').slice(1, 3), 16)}, ${parseInt((themeColors.accent || '#43e97b').slice(3, 5), 16)}, ${parseInt((themeColors.accent || '#43e97b').slice(5, 7), 16)}, 0.15)`,
  },
  daily: {
    primary: themeColors.primary || '#667eea',
    secondary: themeColors.secondary || '#764ba2',
    gradient: [themeColors.primary || '#667eea', themeColors.secondary || '#764ba2'] as const,
    glow: `rgba(${parseInt((themeColors.primary || '#667eea').slice(1, 3), 16)}, ${parseInt((themeColors.primary || '#667eea').slice(3, 5), 16)}, ${parseInt((themeColors.primary || '#667eea').slice(5, 7), 16)}, 0.15)`,
  },
  warning: '#f39c12',
  success: themeColors.accent || '#43e97b',
  info: '#17a2b8',
} as const);

const SPRING = { damping: 15, mass: 1, stiffness: 150 };
const FADE_DURATION = 400;
const STAGGER_DELAY = 100;

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
   UTILITY: Get category color safely
   ═══════════════════════════════════════════════════════════════ */
const getCategoryColor = (category: SafetyTopic['category'], themeColors: { primary: string; secondary: string; accent: string }) => {
  const THEME = createTheme(themeColors);
  switch (category) {
    case 'emergency': return THEME.emergency.primary;
    case 'prevention': return THEME.prevention.primary;
    case 'daily': return THEME.daily.primary;
    default: return THEME.daily.primary;
  }
};

const getCategoryGradient = (category: SafetyTopic['category'], themeColors: { primary: string; secondary: string; accent: string }) => {
  const THEME = createTheme(themeColors);
  switch (category) {
    case 'emergency': return THEME.emergency.gradient;
    case 'prevention': return THEME.prevention.gradient;
    case 'daily': return THEME.daily.gradient;
    default: return THEME.daily.gradient;
  }
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Animated Pressable Card Wrapper
   ═══════════════════════════════════════════════════════════════ */
interface PressableCardProps {
  children: React.ReactNode;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  style?: any;
  activeOpacity?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link';
}

const PressableCard = memo<PressableCardProps>(({
  children,
  onPress,
  onPressIn,
  onPressOut,
  style,
  activeOpacity = 0.8,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, ...SPRING }).start();
    onPressIn?.();
  }, [onPressIn, scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...SPRING }).start();
    onPressOut?.();
  }, [onPressOut, scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={activeOpacity}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});

PressableCard.displayName = 'PressableCard';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Safety Card (Memoized) — Uses customization theming
   ═══════════════════════════════════════════════════════════════ */
interface SafetyCardProps {
  topic: SafetyTopic;
  isDark: boolean;
  onPress: () => void;
  index: number;
  themeColors: { primary: string; secondary: string; accent: string };
  colors: {
    card: string;
    cardDark: string;
    text: string;
    textDark: string;
    muted: string;
    mutedDark: string;
  };
}

const SafetyCard = memo<SafetyCardProps>(({
  topic,
  isDark,
  onPress,
  index,
  themeColors,
  colors,
}) => {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { triggerHaptic } = useCustomization();

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: FADE_DURATION,
        delay: index * STAGGER_DELAY,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION,
        delay: index * STAGGER_DELAY,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [index, translateY, opacity]);

  const borderLeftColor = getCategoryColor(topic.category, themeColors);
  const isEmergency = topic.category === 'emergency';
  const isCompleted = !!topic.completedAt;

  const handlePressIn = useCallback(() => {
    triggerHaptic('light');
  }, [triggerHaptic]);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <PressableCard
        onPress={onPress}
        onPressIn={handlePressIn}
        style={[
          styles.safetyCard,
          isDark && styles.safetyCardDark,
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
            <Text style={[styles.cardTitle, isDark && { color: colors.textDark }]} numberOfLines={1}>
              {topic.title}
            </Text>
            {isEmergency && (
              <View style={[styles.emergencyBadge, { backgroundColor: topic.color }]}>
                <Text style={styles.emergencyText}>SOS</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.cardDescription, isDark && { color: colors.mutedDark }]}
            numberOfLines={2}
          >
            {topic.description}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isDark ? colors.mutedDark : colors.muted}
        />
      </PressableCard>
    </Animated.View>
  );
});

SafetyCard.displayName = 'SafetyCard';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Emergency Button (Memoized) — Uses customization theming
   ═══════════════════════════════════════════════════════════════ */
interface EmergencyButtonProps {
  contact: EmergencyContact;
  isDark: boolean;
  onPress: () => void;
  isSOS?: boolean;
  colors: { muted: string; mutedDark: string };
  themeColors: { primary: string; secondary: string; accent: string };
}

const EmergencyButton = memo<EmergencyButtonProps>(({
  contact,
  isDark,
  onPress,
  isSOS,
  colors,
  themeColors,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isSOS && contact.type !== 'emergency') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isSOS, contact.type, pulseAnim]);

  const iconName = isSOS ? 'alert' : (contact.icon as keyof typeof Ionicons.glyphMap);
  const iconSize = isSOS ? 32 : 24;
  const textColor = isSOS ? '#ff4757' : contact.color;
  const gradientColors = isSOS
    ? [`#ff475730`, `#ff475710`]
    : [`${contact.color}20`, `${contact.color}05`];

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <PressableCard
        onPress={onPress}
        style={[
          styles.emergencyBtn,
          isDark && styles.emergencyBtnDark,
          isSOS && styles.sosButton,
          { borderColor: isSOS ? '#ff4757' : contact.color },
        ]}
        accessibilityLabel={isSOS ? 'SOS Emergency button' : `Call ${contact.label}`}
        accessibilityHint={isSOS ? 'Triggers emergency protocol' : `Dials ${contact.number || 'not set'}`}
        accessibilityRole="button"
      >
        <LinearGradient colors={gradientColors as [string, string]} style={styles.emergencyBtnGradient}>
          <Ionicons name={iconName} size={iconSize} color={textColor} />
          <Text style={[styles.emergencyBtnText, { color: textColor, fontSize: isSOS ? 16 : 13 }]}>
            {isSOS ? 'SOS EMERGENCY' : contact.label}
          </Text>
          {!isSOS && contact.number && (
            <Text style={[styles.emergencyBtnNumber, isDark && { color: colors.mutedDark }]}>
              {contact.number}
            </Text>
          )}
        </LinearGradient>
      </PressableCard>
    </Animated.View>
  );
});

EmergencyButton.displayName = 'EmergencyButton';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Quick Action Card (Memoized) — Uses customization theming
   ═══════════════════════════════════════════════════════════════ */
interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradient: readonly [string, string];
  iconColor: string;
  isDark: boolean;
  onPress: () => void;
  colors: { text: string; textDark: string };
}

const QuickActionCard = memo<QuickActionProps>(({
  icon,
  label,
  gradient,
  iconColor,
  isDark,
  onPress,
  colors,
}) => (
  <PressableCard
    onPress={onPress}
    style={[styles.quickActionCard, isDark && styles.quickActionCardDark]}
    accessibilityLabel={label}
  >
    <LinearGradient colors={gradient as [string, string]} style={styles.quickActionGradient}>
      <Ionicons name={icon} size={24} color={iconColor} />
      <Text style={[styles.quickActionText, isDark && { color: colors.textDark }]}>
        {label}
      </Text>
    </LinearGradient>
  </PressableCard>
));

QuickActionCard.displayName = 'QuickActionCard';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Contact Import Modal
   ═══════════════════════════════════════════════════════════════ */
interface ContactImportModalProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  onImport: (contacts: EmergencyContact[]) => void;
  themeColors: { primary: string; secondary: string; accent: string };
}

const ContactImportModal = memo<ContactImportModalProps>(({
  visible,
  onClose,
  isDark,
  onImport,
  themeColors,
}) => {
  const [deviceContacts, setDeviceContacts] = useState<Contacts.Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { success, error: showError } = useSweetAlert();

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission Denied', 'Please allow access to contacts to import emergency contacts.');
        onClose();
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // Filter contacts with phone numbers
      const validContacts = data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);
      setDeviceContacts(validContacts);
    } catch (err) {
      showError('Error', 'Failed to load contacts from device.');
    } finally {
      setLoading(false);
    }
  }, [onClose, showError]);

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible, loadContacts]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    const imported: EmergencyContact[] = [];
    deviceContacts.forEach(contact => {
      if (selectedContacts.has(contact.id)) {
        const phone = contact.phoneNumbers?.[0]?.number || '';
        imported.push({
          id: `imported_${contact.id}_${Date.now()}`,
          label: contact.name || 'Unknown',
          number: phone,
          type: 'family',
          icon: 'person',
          color: themeColors.primary,
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
    const query = searchQuery.toLowerCase();
    return deviceContacts.filter(c => 
      c.name?.toLowerCase().includes(query) ||
      c.phoneNumbers?.some(p => p.number?.includes(query))
    );
  }, [deviceContacts, searchQuery]);

  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? '#a0a0b0' : '#6b7280';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.importModalContainer, { backgroundColor: bgColor }]}>
          <View style={styles.importModalHeader}>
            <Text style={[styles.importModalTitle, { color: textColor }]}>
              Import Contacts
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={mutedColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search contacts..."
              placeholderTextColor={mutedColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loading ? (
            <UniversalSpinner visible={true} text="Loading contacts..." section="main" size="small" overlay={false} />
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedContacts.has(item.id);
                const phone = item.phoneNumbers?.[0]?.number || 'No number';
                return (
                  <TouchableOpacity
                    style={[
                      styles.contactItem,
                      isSelected && { backgroundColor: `${themeColors.primary}15`, borderColor: themeColors.primary },
                    ]}
                    onPress={() => toggleSelection(item.id)}
                  >
                    <View style={[styles.contactAvatar, { backgroundColor: `${themeColors.primary}20` }]}>
                      <Text style={[styles.contactAvatarText, { color: themeColors.primary }]}>
                        {item.name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactName, { color: textColor }]}>{item.name || 'Unknown'}</Text>
                      <Text style={[styles.contactPhone, { color: mutedColor }]}>{phone}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }
                    ]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              style={styles.contactList}
            />
          )}

          <TouchableOpacity
            style={[styles.importButton, { backgroundColor: themeColors.primary }]}
            onPress={handleImport}
            disabled={selectedContacts.size === 0}
          >
            <Text style={styles.importButtonText}>
              Import {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

ContactImportModal.displayName = 'ContactImportModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Reminder Modal
   ═══════════════════════════════════════════════════════════════ */
interface ReminderModalProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
}

const ReminderModal = memo<ReminderModalProps>(({
  visible,
  onClose,
  isDark,
  themeColors,
}) => {
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

    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission Denied', 'Notification permissions are required for reminders.');
        return;
      }

      const trigger = new Date(Date.now() + parseInt(hours || '1') * 60 * 60 * 1000);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 ${title}`,
          body: body || 'Safety reminder from LittleLoom',
          sound: true,
          priority: Notifications.AndroidImportance.HIGH,
          badge: 1,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        } as any,
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
  }, [title, body, hours, onClose, success, showError]);

  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? '#a0a0b0' : '#6b7280';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.reminderModalContainer, { backgroundColor: bgColor }]}>
          <View style={styles.importModalHeader}>
            <Text style={[styles.importModalTitle, { color: textColor }]}>Safety Reminder</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: mutedColor }]}>Reminder Title</Text>
          <TextInput
            style={[styles.textInput, { color: textColor, borderColor: isDark ? '#333' : '#e2e8f0' }]}
            placeholder="e.g., Check car seat installation"
            placeholderTextColor={mutedColor}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.inputLabel, { color: mutedColor }]}>Details (optional)</Text>
          <TextInput
            style={[styles.textInput, { color: textColor, borderColor: isDark ? '#333' : '#e2e8f0', height: 80 }]}
            placeholder="Additional details..."
            placeholderTextColor={mutedColor}
            value={body}
            onChangeText={setBody}
            multiline
          />

          <Text style={[styles.inputLabel, { color: mutedColor }]}>Remind me in (hours)</Text>
          <View style={styles.hoursRow}>
            {['1', '2', '4', '8', '24', '48'].map(h => (
              <TouchableOpacity
                key={h}
                style={[
                  styles.hourChip,
                  hours === h && { backgroundColor: themeColors.primary },
                ]}
                onPress={() => setHours(h)}
              >
                <Text style={[styles.hourChipText, hours === h && { color: '#fff' }]}>
                  {h}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.importButton, { backgroundColor: themeColors.primary, marginTop: 20 }]}
            onPress={scheduleReminder}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.importButtonText}>Scheduling...</Text>
            ) : (
              <Text style={styles.importButtonText}>Set Reminder</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

ReminderModal.displayName = 'ReminderModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Doctor Report Modal
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
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
}

const DoctorReportModal = memo<DoctorReportModalProps>(({
  visible,
  onClose,
  isDark,
  themeColors,
}) => {
  const [reports, setReports] = useState<DoctorReport[]>([]);
  const { success, error: showError, confirm } = useSweetAlert();

  useEffect(() => {
    // Load from AsyncStorage or context
    const loadReports = async () => {
      // This would typically come from a context or API
      // For now, we'll use local state
    };
    if (visible) loadReports();
  }, [visible]);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
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
        success('Report Added', 'Doctor report has been uploaded and is pending review.');
      }
    } catch (err) {
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

  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? '#a0a0b0' : '#6b7280';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.reportModalContainer, { backgroundColor: bgColor }]}>
          <View style={styles.importModalHeader}>
            <Text style={[styles.importModalTitle, { color: textColor }]}>Doctor Reports</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.addReportButton, { borderColor: themeColors.primary }]}
            onPress={pickDocument}
          >
            <Ionicons name="document-attach" size={20} color={themeColors.primary} />
            <Text style={[styles.addReportText, { color: themeColors.primary }]}>Upload PDF Report</Text>
          </TouchableOpacity>

          <FlatList
            data={reports}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.reportItem, isDark && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <View style={[styles.reportIcon, { backgroundColor: `${themeColors.primary}15` }]}>
                  <Ionicons name="document-text" size={24} color={themeColors.primary} />
                </View>
                <View style={styles.reportInfo}>
                  <Text style={[styles.reportName, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.reportMeta, { color: mutedColor }]}>
                    {item.size > 0 ? `${(item.size / 1024).toFixed(1)} KB` : 'Size unknown'} • {new Date(item.uploadedAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.reportStatusRow}>
                    <View style={[
                      styles.statusBadge,
                      item.status === 'approved' && { backgroundColor: '#22c55e20' },
                      item.status === 'pending' && { backgroundColor: '#f59e0b20' },
                      item.status === 'reviewed' && { backgroundColor: '#3b82f620' },
                    ]}>
                      <Text style={[
                        styles.statusText,
                        item.status === 'approved' && { color: '#22c55e' },
                        item.status === 'pending' && { color: '#f59e0b' },
                        item.status === 'reviewed' && { color: '#3b82f6' },
                      ]}>
                        {item.status === 'approved' ? `✓ Approved by ${item.approvedBy}` : item.status}
                      </Text>
                    </View>
                  </View>
                </View>
                {item.status !== 'approved' && (
                  <TouchableOpacity
                    style={[styles.approveBtn, { backgroundColor: themeColors.primary }]}
                    onPress={() => approveReport(item.id)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyReports}>
                <Ionicons name="documents-outline" size={48} color={mutedColor} />
                <Text style={[styles.emptyReportsText, { color: mutedColor }]}>
                  No reports yet. Upload a PDF to get started.
                </Text>
              </View>
            }
            style={styles.reportList}
          />
        </View>
      </View>
    </Modal>
  );
});

DoctorReportModal.displayName = 'DoctorReportModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Checklist Modal — FIXED & WORKING
   ═══════════════════════════════════════════════════════════════ */
interface ChecklistModalProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
}

const ChecklistModal = memo<ChecklistModalProps>(({ visible, onClose, isDark, themeColors }) => {
  const { checklists, toggleChecklistItem, triggerHaptic } = useSafety();
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const { success } = useSweetAlert();

  // FIX: Initialize active checklist properly
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
    
    // Check if all items completed
    const checklist = checklists.find(c => c.id === activeChecklist.id);
    if (checklist) {
      const allCompleted = checklist.items.every(item => item.completed);
      if (allCompleted) {
        success('Checklist Complete!', `You've completed the ${checklist.title}. Great job!`);
      }
    }
  }, [activeChecklist, toggleChecklistItem, triggerHaptic, checklists, success]);

  const accentColor = themeColors.accent || '#43e97b';
  const emergencyColor = '#ff4757';
  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? '#a0a0b0' : '#6b7280';

  if (!activeChecklist) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.checklistContainer, { backgroundColor: bgColor }]}>
          <View style={styles.checklistHeader}>
            <Text style={[styles.checklistTitle, { color: textColor }]}>
              Safety Checklist
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} accessibilityLabel="Close checklist">
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.checklistTabs}
          >
            {checklists.map((cl) => (
              <TouchableOpacity
                key={cl.id}
                style={[
                  styles.checklistTab,
                  activeChecklistId === cl.id && { backgroundColor: accentColor },
                ]}
                onPress={() => setActiveChecklistId(cl.id)}
              >
                <Text
                  style={[
                    styles.checklistTabText,
                    activeChecklistId === cl.id && styles.checklistTabTextActive,
                  ]}
                >
                  {cl.category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${activeChecklist.progress}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: textColor }]}>
            {activeChecklist.progress}% Complete
          </Text>

          {/* Checklist Items */}
          <ScrollView style={styles.checklistContent} showsVerticalScrollIndicator={false}>
            {activeChecklist.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.checklistItem}
                onPress={() => handleToggle(item.id)}
                accessibilityLabel={`${item.text}${item.completed ? ', completed' : ''}${item.critical ? ', critical' : ''}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.completed }}
              >
                <View
                  style={[
                    styles.checkbox,
                    item.completed && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                    item.critical && !item.completed && { borderColor: emergencyColor },
                  ]}
                >
                  {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text
                  style={[
                    styles.checklistItemText,
                    { color: textColor },
                    item.completed && styles.checklistItemCompleted,
                    item.critical && !item.completed && { color: emergencyColor },
                  ]}
                >
                  {item.text}
                  {item.critical && <Text style={styles.criticalTag}> CRITICAL</Text>}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.resetChecklistBtn, { borderColor: isDark ? '#444' : '#e2e8f0' }]}
            onPress={() => {
              // Reset all items in current checklist
              activeChecklist.items.forEach(item => {
                if (item.completed) {
                  toggleChecklistItem(activeChecklist.id, item.id);
                }
              });
              success('Checklist Reset', 'All items have been reset.');
            }}
          >
            <Ionicons name="refresh" size={16} color={mutedColor} />
            <Text style={[styles.resetChecklistText, { color: mutedColor }]}>Reset Checklist</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

ChecklistModal.displayName = 'ChecklistModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Topic Detail Modal — Uses SafeBabyAvatar & customization theming
   ═══════════════════════════════════════════════════════════════ */
interface TopicModalProps {
  visible: boolean;
  topic: SafetyTopic | null;
  isDark: boolean;
  themeColors: { primary: string; secondary: string; accent: string };
  colors: {
    text: string;
    textDark: string;
    muted: string;
    mutedDark: string;
  };
  currentBaby: { name: string; age: string; avatar?: string | null; gender?: string } | null;
  onClose: () => void;
  onComplete: (topicId: string) => void;
  onCallEmergency: (number: string, label: string, type: string) => void;
}

const TopicDetailModal = memo<TopicModalProps>(({
  visible,
  topic,
  isDark,
  themeColors,
  colors,
  currentBaby,
  onClose,
  onComplete,
  onCallEmergency,
}) => {
  const { triggerHaptic } = useCustomization();
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
    Share.share({
      message: `${topic.title}\n\n${topic.tips.join('\n')}`,
    });
  }, [topic]);

  if (!topic) return null;

  const accentColor = themeColors.accent || '#43e97b';
  const bgColor = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a2e';
  const mutedColor = isDark ? '#a0a0b0' : '#6b7280';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContainer, { backgroundColor: bgColor }]}>
          <View style={styles.modalHandle} />

          <AutoHideScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: `${topic.color}15` }]}>
                <Ionicons
                  name={topic.icon as keyof typeof Ionicons.glyphMap}
                  size={28}
                  color={topic.color}
                />
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close topic details"
              >
                <BlurView intensity={80} style={styles.closeBtnBlur}>
                  <Ionicons name="close" size={20} color={textColor} />
                </BlurView>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalTitle, { color: textColor }]}>
              {topic.title}
            </Text>
            <Text style={[styles.modalDescription, { color: mutedColor }]}>
              {topic.description}
            </Text>

            {currentBaby && (
              <View style={[styles.babyBanner, isDark && { backgroundColor: 'rgba(250,112,154,0.2)' }]}>
                <SafeBabyAvatar 
                  avatar={currentBaby.avatar || null} 
                  gender={currentBaby.gender || 'other'} 
                  size={40} 
                />
                <Text style={[styles.babyBannerText, isDark && { color: '#fc5c7d' }]}>
                  Tips for {currentBaby.name} ({currentBaby.age})
                </Text>
              </View>
            )}

            <View style={styles.tipsContainer}>
              <Text style={[styles.tipsTitle, { color: textColor }]}>
                Key Safety Tips
              </Text>
              {topic.tips.map((tip: string, index: number) => (
                <View key={index} style={styles.tipItem}>
                  <View style={[styles.tipBullet, { backgroundColor: topic.color }]}>
                    <Text style={styles.tipNumber}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.tipText, { color: isDark ? '#d1d5db' : '#4b5563' }]}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>

            {topic.emergencyNumbers && topic.emergencyNumbers.length > 0 && (
              <View style={styles.emergencyActionsContainer}>
                <Text style={[styles.emergencyActionsTitle, { color: textColor }]}>
                  Emergency Actions
                </Text>
                {topic.emergencyNumbers.map((num, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.emergencyActionBtn, { backgroundColor: topic.color }]}
                    onPress={() => onCallEmergency(num.number, num.label, 'emergency')}
                    accessibilityLabel={`Call ${num.label}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="call" size={20} color="#fff" />
                    <Text style={styles.emergencyActionText}>Call {num.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.completeBtn, { backgroundColor: accentColor }]}
              onPress={handleComplete}
              accessibilityLabel="Mark topic as completed"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.completeBtnText}>Mark as Completed</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} accessibilityLabel="Share safety tips">
              <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : themeColors.primary} />
              <Text style={[styles.shareText, isDark && { color: '#a0a0b0' }]}>Share Tips</Text>
            </TouchableOpacity>
          </AutoHideScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

TopicDetailModal.displayName = 'TopicDetailModal';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Stat Card — Uses customization theming
   ═══════════════════════════════════════════════════════════════ */
interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string | number;
  label: string;
  isDark: boolean;
  onPress?: () => void;
  colors: { text: string; textDark: string; muted: string; mutedDark: string };
}

const StatCard = memo<StatCardProps>(({
  icon,
  iconColor,
  value,
  label,
  isDark,
  onPress,
  colors,
}) => (
  <PressableCard
    onPress={onPress || (() => {})}
    style={[styles.statItem, isDark && styles.statItemDark]}
    accessibilityLabel={`${label}: ${value}`}
  >
    <Ionicons name={icon} size={20} color={iconColor} />
    <Text style={[styles.statValue, isDark && { color: colors.textDark }]}>{value}</Text>
    <Text style={[styles.statLabel, isDark && { color: colors.mutedDark }]}>{label}</Text>
  </PressableCard>
));

StatCard.displayName = 'StatCard';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT: Filter Chip — Uses customization theming
   ═══════════════════════════════════════════════════════════════ */
interface FilterChipProps {
  label: string;
  active: boolean;
  category: 'all' | 'emergency' | 'prevention' | 'daily';
  onPress: () => void;
  themeColors: { primary: string; secondary: string; accent: string };
}

const FilterChip = memo<FilterChipProps>(({ label, active, category, onPress, themeColors }) => {
  const activeColor = useMemo(() => {
    const THEME = createTheme(themeColors);
    switch (category) {
      case 'emergency': return THEME.emergency.primary;
      case 'prevention': return THEME.prevention.primary;
      case 'daily': return THEME.daily.primary;
      default: return themeColors.primary || '#667eea';
    }
  }, [category, themeColors]);

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        active && styles.filterChipActive,
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
   MAIN SCREEN COMPONENT — Complete Rewrite with All Features
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
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const { success, error: showError, confirm } = useSweetAlert();

  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  /* ── Theme from customization ── */
  const THEME = useMemo(() => createTheme(themeColors), [themeColors]);

  /* ── Memoized color palette using themeColors ── */
  const colors = useMemo(() => ({
    text: '#1a1a2e',
    textDark: '#ffffff',
    muted: '#6b7280',
    mutedDark: '#a0a0b0',
    card: '#ffffff',
    cardDark: 'rgba(255,255,255,0.05)',
    bgLight: ['#f8faff', '#f0f4ff', '#e8eeff'] as const,
    bgDark: ['#0f0f1e', '#1a1a2e', '#16213e'] as const,
  }), []);

  /* ── Import family contacts on mount ── */
  useEffect(() => {
    const familyMembers: any[] = [];
    if (authProfile?.phoneNumber) {
      familyMembers.push({ ...authProfile, relationship: 'Parent (You)', role: 'parent1' });
    }
    if (parent2?.phoneNumber) {
      familyMembers.push({ ...parent2, relationship: 'Co-Parent', role: 'parent2' });
    }
    if (guardians?.length) {
      familyMembers.push(...guardians);
    }
    if (familyMembers.length > 0) {
      importFamilyContacts(familyMembers);
    }
  }, [authProfile, parent2, guardians, importFamilyContacts]);

  /* ── Request notification permissions on mount ── */
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  /* ── Memoized computations ── */
  const safetyScore = useMemo(() => getSafetyScore(), [getSafetyScore]);

  const completedCount = useMemo(
    () => topics.filter((t: SafetyTopic) => t.completedAt).length,
    [topics]
  );

  const filteredTopics = useMemo(
    () => topics.filter((t: SafetyTopic) => (activeCategory === 'all' ? true : t.category === activeCategory)),
    [topics, activeCategory]
  );

  const defaultContacts = useMemo(
    () => emergencyContacts.filter((c: EmergencyContact) => c.isDefault),
    [emergencyContacts]
  );

  const familyContacts = useMemo(
    () => emergencyContacts.filter((c: EmergencyContact) => c.type === 'family'),
    [emergencyContacts]
  );

  const babyInfo = useMemo(() => {
    if (!currentBaby) return null;
    return { 
      name: currentBaby.name, 
      age: currentBaby.age,
      avatar: currentBaby.avatar,
      gender: currentBaby.gender 
    };
  }, [currentBaby]);

  /* ── Callbacks ── */
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

  const handleCategoryChange = useCallback((cat: 'all' | 'emergency' | 'prevention' | 'daily') => {
    setActiveCategory(cat);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleCompleteTopic = useCallback((topicId: string) => {
    markTopicCompleted(topicId);
  }, [markTopicCompleted]);

  const handleCloseModal = useCallback(() => setModalVisible(false), []);
  const handleCloseChecklist = useCallback(() => setChecklistVisible(false), []);

  /* ── Handle imported contacts ── */
  const handleImportContacts = useCallback((imported: EmergencyContact[]) => {
    imported.forEach(contact => {
      addCustomEmergencyContact({
        label: contact.label,
        number: contact.number,
        type: 'family',
        icon: 'person',
        color: themeColors.primary,
        relation: contact.relation,
      });
    });
  }, [addCustomEmergencyContact, themeColors]);

  /* ── Animated header opacity ── */
  const headerOpacity = useMemo(
    () => scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: 'clamp' }),
    [scrollY]
  );

  /* ── Scroll handler (memoized) ── */
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY]
  );

  /* ── Score color (memoized) using themeColors ── */
  const scoreColor = useMemo(() => {
    if (safetyScore > 80) return THEME.success;
    if (safetyScore > 50) return THEME.warning;
    return THEME.emergency.primary;
  }, [safetyScore, THEME]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Floating Header */}
      <Animated.View
        style={[
          styles.floatingHeader,
          { opacity: headerOpacity, paddingTop: insets.top },
        ]}
      >
        <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <View style={styles.floatingHeaderContent}>
          <Text style={[styles.floatingHeaderText, isDark && { color: colors.textDark }]}>
            Safety Corner
          </Text>
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Hero Section with SafeBabyAvatar */}
          <View style={styles.heroSection}>
            <View style={styles.heroIconContainer}>
              <LinearGradient colors={THEME.emergency.gradient} style={styles.heroIconGradient}>
                <Ionicons name="shield-checkmark" size={40} color="#fff" />
              </LinearGradient>
              <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
                <Text style={styles.scoreText}>{safetyScore}%</Text>
              </View>
            </View>
            <Text style={[styles.heroTitle, isDark && { color: colors.textDark }]}>
              Safety Corner
            </Text>
            <Text style={[styles.heroSubtitle, isDark && { color: colors.mutedDark }]}>
              {babyInfo
                ? `Protecting ${babyInfo.name} (${babyInfo.age})`
                : 'Your family safety hub'}
            </Text>

            {/* Baby Avatar Display */}
            {babyInfo && (
              <View style={styles.babyAvatarSection}>
                <SafeBabyAvatar 
                  avatar={babyInfo.avatar || null} 
                  gender={babyInfo.gender || 'other'} 
                  size={60} 
                />
                <Text style={[styles.babyAvatarLabel, isDark && { color: colors.mutedDark }]}>
                  {babyInfo.name}
                </Text>
              </View>
            )}

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <StatCard
                icon="checkmark-circle"
                iconColor={THEME.prevention.primary}
                value={completedCount}
                label="Completed"
                isDark={isDark}
                colors={colors}
              />
              <StatCard
                icon="flame"
                iconColor="#ff9500"
                value={streakDays}
                label="Day Streak"
                isDark={isDark}
                colors={colors}
              />
              <StatCard
                icon="list"
                iconColor={THEME.daily.primary}
                value="Check"
                label="List"
                isDark={isDark}
                onPress={() => setChecklistVisible(true)}
                colors={colors}
              />
            </View>
          </View>

          {/* SOS Emergency Button */}
          <View style={styles.sosSection}>
            <EmergencyButton
              contact={{
                id: 'sos',
                label: 'SOS',
                number: '911',
                type: 'emergency',
                icon: 'alert',
                color: THEME.emergency.primary,
              }}
              isDark={isDark}
              onPress={handleSOS}
              isSOS
              colors={colors}
              themeColors={themeColors}
            />
            <Text style={[styles.sosDisclaimer, isDark && { color: colors.mutedDark }]}>
              Press in life-threatening emergencies only. Calls 911 and alerts family.
            </Text>
          </View>

          {/* NEW: Quick Actions Bar */}
          <View style={styles.quickActionsBar}>
            <TouchableOpacity
              style={[styles.quickBarBtn, { backgroundColor: `${themeColors.primary}15` }]}
              onPress={() => setContactImportVisible(true)}
            >
              <Ionicons name="people" size={20} color={themeColors.primary} />
              <Text style={[styles.quickBarText, { color: themeColors.primary }]}>Import Contacts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBarBtn, { backgroundColor: `${themeColors.accent}15` }]}
              onPress={() => setReminderVisible(true)}
            >
              <Ionicons name="notifications" size={20} color={themeColors.accent} />
              <Text style={[styles.quickBarText, { color: themeColors.accent }]}>Set Reminder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBarBtn, { backgroundColor: `${THEME.info}15` }]}
              onPress={() => setReportVisible(true)}
            >
              <Ionicons name="document-text" size={20} color={THEME.info} />
              <Text style={[styles.quickBarText, { color: THEME.info }]}>Reports</Text>
            </TouchableOpacity>
          </View>

          {/* Emergency Contacts */}
          <View style={styles.emergencySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: THEME.emergency.secondary }]}>
                EMERGENCY CONTACTS
              </Text>
              <TouchableOpacity onPress={() => setContactImportVisible(true)}>
                <Text style={[styles.importLink, { color: themeColors.primary }]}>+ Import</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.emergencyGrid}>
              {defaultContacts.map((contact: EmergencyContact) => (
                <EmergencyButton
                  key={contact.id}
                  contact={contact}
                  isDark={isDark}
                  onPress={() => callEmergency(contact.number, contact.label, contact.type)}
                  colors={colors}
                  themeColors={themeColors}
                />
              ))}
            </View>

            {/* Family Contacts with SafeParentAvatar */}
            {familyContacts.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.familyContactsScroll}
                contentContainerStyle={styles.familyContactsContent}
              >
                {familyContacts.map((contact: EmergencyContact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={[styles.familyChip, isDark && styles.familyChipDark]}
                    onPress={() => callEmergency(contact.number, contact.label, 'family')}
                    accessibilityLabel={`Call ${contact.label}`}
                  >
                    {contact.avatar ? (
                      <SafeParentAvatar 
                        avatar={contact.avatar} 
                        name={contact.label} 
                        size={28} 
                      />
                    ) : (
                      <Ionicons
                        name={contact.icon as keyof typeof Ionicons.glyphMap}
                        size={16}
                        color={contact.color}
                      />
                    )}
                    <Text style={[styles.familyChipText, isDark && { color: colors.textDark }]}>
                      {contact.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Category Filter */}
          <View style={styles.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {(['all', 'emergency', 'prevention', 'daily'] as const).map((cat) => (
                <FilterChip
                  key={cat}
                  label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  active={activeCategory === cat}
                  category={cat}
                  onPress={() => handleCategoryChange(cat)}
                  themeColors={themeColors}
                />
              ))}
            </ScrollView>
          </View>

          {/* Safety Topics */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.textDark }]}>
              Safety Topics
            </Text>
            {filteredTopics.map((topic: SafetyTopic, index: number) => (
              <SafetyCard
                key={topic.id}
                topic={topic}
                isDark={isDark}
                onPress={() => handleTopicPress(topic)}
                index={index}
                themeColors={themeColors}
                colors={colors}
              />
            ))}
            {filteredTopics.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, isDark && { color: colors.mutedDark }]}>
                  No topics in this category
                </Text>
              </View>
            )}
          </View>

          {/* Location Services */}
          {currentLocation && (
            <BlurView intensity={isDark ? 20 : 60} style={styles.locationCard} tint={isDark ? 'dark' : 'light'}>
              <Ionicons name="location" size={20} color={themeColors.primary} />
              <Text style={[styles.locationText, isDark && { color: colors.mutedDark }]}>
                Location active • Ready for emergency sharing
              </Text>
            </BlurView>
          )}

          {/* Quick Actions using themeColors */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.textDark }]}>
              Quick Actions
            </Text>
            <View style={styles.quickActionsGrid}>
              <QuickActionCard
                icon="call"
                label="Call 911"
                gradient={[`${THEME.emergency.primary}20`, `${THEME.emergency.primary}05`]}
                iconColor={THEME.emergency.primary}
                isDark={isDark}
                onPress={() => callEmergency('911', 'Emergency', 'emergency')}
                colors={colors}
              />
              <QuickActionCard
                icon="location"
                label="Hospitals"
                gradient={['#11998e20', '#11998e05']}
                iconColor="#11998e"
                isDark={isDark}
                onPress={findNearbyHospitals}
                colors={colors}
              />
              <QuickActionCard
                icon="medical"
                label="Pediatrician"
                gradient={[`${themeColors.primary}20`, `${themeColors.primary}05`]}
                iconColor={themeColors.primary}
                isDark={isDark}
                onPress={findNearbyPediatricians}
                colors={colors}
              />
              <QuickActionCard
                icon="share"
                label="Share Loc"
                gradient={[`${themeColors.accent}20`, `${themeColors.accent}05`]}
                iconColor={themeColors.accent}
                isDark={isDark}
                onPress={() => shareLocationWithEmergency()}
                colors={colors}
              />
            </View>
          </View>

          {/* NEW: Safety Pills / Quick Tips */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.textDark }]}>
              Quick Safety Pills
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
              <TouchableOpacity style={[styles.pill, { backgroundColor: `${THEME.emergency.primary}15` }]}>
                <Ionicons name="medical" size={16} color={THEME.emergency.primary} />
                <Text style={[styles.pillText, { color: THEME.emergency.primary }]}>CPR Guide</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pill, { backgroundColor: `${THEME.warning}15` }]}>
                <Ionicons name="warning" size={16} color={THEME.warning} />
                <Text style={[styles.pillText, { color: THEME.warning }]}>Choking</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pill, { backgroundColor: `${THEME.info}15` }]}>
                <Ionicons name="water" size={16} color={THEME.info} />
                <Text style={[styles.pillText, { color: THEME.info }]}>Water Safety</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pill, { backgroundColor: `${themeColors.accent}15` }]}>
                <Ionicons name="sunny" size={16} color={themeColors.accent} />
                <Text style={[styles.pillText, { color: themeColors.accent }]}>Sun Safety</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pill, { backgroundColor: `${themeColors.primary}15` }]}>
                <Ionicons name="bed" size={16} color={themeColors.primary} />
                <Text style={[styles.pillText, { color: themeColors.primary }]}>Safe Sleep</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

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
      <ChecklistModal 
        visible={checklistVisible} 
        onClose={handleCloseChecklist} 
        isDark={isDark} 
        themeColors={themeColors} 
      />

      <TopicDetailModal
        visible={modalVisible}
        topic={selectedTopic}
        isDark={isDark}
        themeColors={themeColors}
        colors={colors}
        currentBaby={babyInfo}
        onClose={handleCloseModal}
        onComplete={handleCompleteTopic}
        onCallEmergency={callEmergency}
      />

      <ContactImportModal
        visible={contactImportVisible}
        onClose={() => setContactImportVisible(false)}
        isDark={isDark}
        onImport={handleImportContacts}
        themeColors={themeColors}
      />

      <ReminderModal
        visible={reminderVisible}
        onClose={() => setReminderVisible(false)}
        isDark={isDark}
        themeColors={themeColors}
      />

      <DoctorReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        isDark={isDark}
        themeColors={themeColors}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES — Extended with new modal styles
   ═══════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },

  // Floating Header
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

  // Content
  content: { paddingHorizontal: 20 },

  // Hero Section
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
  heroSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // Baby Avatar Section
  babyAvatarSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  babyAvatarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
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
  statItemDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

    // SOS Section
  sosSection: { marginBottom: 24, alignItems: 'center' },
  sosDisclaimer: { 
    fontSize: 11, 
    color: '#999', 
    marginTop: 8, 
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Quick Actions Bar (NEW)
  quickActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 10,
  },
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
  quickBarText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Emergency Section
  emergencySection: { marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  importLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff4757',
    letterSpacing: 1,
  },
  emergencyGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },

  // Emergency Button
  emergencyBtn: {
    width: (SCREEN_W - 50) / 2,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sosButton: {
    width: SCREEN_W - 40,
    borderWidth: 2,
    borderRadius: 20,
  },
  emergencyBtnDark: { 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  emergencyBtnGradient: { 
    padding: 16, 
    alignItems: 'center', 
    gap: 6 
  },
  emergencyBtnText: { 
    fontSize: 13, 
    fontWeight: '700' 
  },
  emergencyBtnNumber: { 
    fontSize: 11, 
    color: '#6b7280', 
    fontWeight: '500' 
  },

  // Family Contacts
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
  familyChipDark: { 
    backgroundColor: 'rgba(255,255,255,0.05)' 
  },
  familyChipText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#1a1a2e' 
  },

  // Filter
  filterContainer: { marginBottom: 20 },
  filterContent: { 
    paddingRight: 20, 
    gap: 8 
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterChipActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterChipText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#6b7280' 
  },
  filterChipTextActive: { 
    color: '#fff' 
  },

  // Section
  section: { marginBottom: 24 },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1a1a2e', 
    marginBottom: 12 
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: { 
    fontSize: 15, 
    color: '#6b7280', 
    fontWeight: '500' 
  },

  // Safety Card
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
  },
  safetyCardDark: { 
    backgroundColor: 'rgba(255,255,255,0.05)' 
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

  // Location Card
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

  // Quick Actions Grid
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
  quickActionCardDark: { 
    backgroundColor: 'rgba(255,255,255,0.05)' 
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

  // Safety Pills (NEW)
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

  // Disclaimer
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

  // Modal Overlay
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  // Import Modal
  importModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_H * 0.85,
    padding: 24,
    paddingTop: 12,
  },
  importModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  importModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  contactList: {
    maxHeight: SCREEN_H * 0.5,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
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
    marginTop: 16,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Reminder Modal
  reminderModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  hoursRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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

  // Report Modal
  reportModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_H * 0.85,
    padding: 24,
    paddingTop: 12,
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
    marginBottom: 16,
  },
  addReportText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reportList: {
    maxHeight: SCREEN_H * 0.5,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
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

  // Topic Detail Modal
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_H * 0.9,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalScrollContent: {
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
  modalCloseBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeBtnBlur: {
    width: 36,
    height: 36,
    borderRadius: 16,
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

  // Baby Banner
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

  // Tips
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

  // Emergency Actions
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

  // Complete Button
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

  // Share Button
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

  // Checklist Modal
  checklistContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_H * 0.8,
    padding: 24,
    paddingTop: 12,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  checklistTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  checklistTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingRight: 20,
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
  checklistTabTextActive: { 
    color: '#fff' 
  },
  checklistContent: { 
    maxHeight: SCREEN_H * 0.45 
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginBottom: 8,
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
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
    gap: 6,
  },
  resetChecklistText: {
    fontSize: 14,
    fontWeight: '600',
  },
});