// SafetyCornerScreen.tsx — MODERN v6.0
// NO SHADOWS — Clean flat design
// Full Supabase SQL integration
// Complete functional features

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
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
  FadeInDown,
  Layout,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../types/navigation';

import {
  useSafety,
  type EmergencyContact,
  type SafetyTopic,
  type SafetyChecklist,
  type DoctorReport,
} from '../../context/SafetyContext';
import { useBaby } from '../../context/BabyContext';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeAvatar, SafeBabyAvatar, SafeParentAvatar } from '../../components/SafeAvatar';
import { supabase } from '@/utils/supabase';

/* ═══════════════════════════════════════════════════════════════════════════
   INTELLIGENCE HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */
import { usePredictiveReminders } from '@/hooks/usePredictiveReminders';
import { useGrowthIntelligence } from '@/hooks/useGrowthIntelligence';
import { useTimelineCorrelations } from '@/hooks/useTimelineCorrelations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SafetyCornerScreenProps = BottomTabScreenProps<MainTabParamList, 'SafetyCorner'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — NO SHADOWS — Clean flat design
   ═══════════════════════════════════════════════════════════════════════════ */

const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxxl: 48,
};

const RADIUS = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

// NO SHADOWS — all shadow opacity set to 0
const SHADOW = {
  none: { shadowOpacity: 0, elevation: 0 },
  xs: { shadowOpacity: 0, elevation: 0 },
  sm: { shadowOpacity: 0, elevation: 0 },
  md: { shadowOpacity: 0, elevation: 0 },
  lg: { shadowOpacity: 0, elevation: 0 },
  xl: { shadowOpacity: 0, elevation: 0 },
};

type SafetyTab = 'overview' | 'emergency' | 'topics' | 'checklists' | 'reports' | 'intelligence';

/* ═══════════════════════════════════════════════════════════════════════════
   THEME HOOK — Unified with TrackerHub
   ═══════════════════════════════════════════════════════════════════════════ */

const useHubTheme = () => {
  const { isDark, colors, fullThemeColors } = useCustomization();

  return useMemo(() => ({
    primary: colors?.primary || '#667eea',
    secondary: colors?.secondary || '#764ba2',
    isDark: !!isDark,
    bgColors: isDark ? ['#0a0a1a', '#12122a'] : ['#f8faff', '#eef2ff'],
    statusBar: isDark ? 'light-content' : 'dark-content' as const,
    blur: isDark ? 'dark' : 'light' as const,
    text: {
      primary: fullThemeColors?.text || (isDark ? '#ffffff' : '#1a1a1a'),
      secondary: fullThemeColors?.textSecondary || (isDark ? '#94a3b8' : '#64748b'),
      muted: fullThemeColors?.textMuted || (isDark ? '#64748b' : '#94a3b8'),
    },
    surface: {
      bg: fullThemeColors?.surface || (isDark ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.9)'),
      card: fullThemeColors?.card || (isDark ? 'rgba(45,45,60,0.6)' : 'rgba(255,255,255,0.85)'),
      border: fullThemeColors?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
    },
  }), [isDark, colors, fullThemeColors]);
};

// ─── EMERGENCY NUMBERS BY LOCATION ────────────────────────────────────────

interface EmergencyNumber {
  country: string;
  code: string;
  emergency: string;
  police: string;
  ambulance: string;
  fire: string;
  poison?: string;
  sos?: string;
}

const EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { country: 'US', code: '+1', emergency: '911', police: '911', ambulance: '911', fire: '911', poison: '1-800-222-1222' },
  { country: 'UK', code: '+44', emergency: '999', police: '999', ambulance: '999', fire: '999' },
  { country: 'CA', code: '+1', emergency: '911', police: '911', ambulance: '911', fire: '911' },
  { country: 'AU', code: '+61', emergency: '000', police: '000', ambulance: '000', fire: '000' },
  { country: 'NZ', code: '+64', emergency: '111', police: '111', ambulance: '111', fire: '111' },
  { country: 'IN', code: '+91', emergency: '112', police: '100', ambulance: '102', fire: '101' },
  { country: 'DE', code: '+49', emergency: '112', police: '110', ambulance: '112', fire: '112' },
  { country: 'FR', code: '+33', emergency: '112', police: '17', ambulance: '15', fire: '18' },
  { country: 'ES', code: '+34', emergency: '112', police: '091', ambulance: '061', fire: '080' },
  { country: 'IT', code: '+39', emergency: '112', police: '113', ambulance: '118', fire: '115' },
  { country: 'JP', code: '+81', emergency: '119', police: '110', ambulance: '119', fire: '119' },
  { country: 'BR', code: '+55', emergency: '190', police: '190', ambulance: '192', fire: '193' },
  { country: 'MX', code: '+52', emergency: '911', police: '911', ambulance: '911', fire: '911' },
  { country: 'ZA', code: '+27', emergency: '10111', police: '10111', ambulance: '10177', fire: '10111' },
  { country: 'NG', code: '+234', emergency: '112', police: '199', ambulance: '112', fire: '112' },
  { country: 'KE', code: '+254', emergency: '112', police: '999', ambulance: '999', fire: '999' },
  { country: 'PH', code: '+63', emergency: '911', police: '117', ambulance: '911', fire: '911' },
  { country: 'SG', code: '+65', emergency: '995', police: '999', ambulance: '995', fire: '995' },
  { country: 'AE', code: '+971', emergency: '999', police: '999', ambulance: '998', fire: '997' },
  { country: 'SA', code: '+966', emergency: '911', police: '999', ambulance: '997', fire: '998' },
  { country: 'EG', code: '+20', emergency: '122', police: '122', ambulance: '123', fire: '180' },
  { country: 'PK', code: '+92', emergency: '15', police: '15', ambulance: '115', fire: '16' },
  { country: 'BD', code: '+880', emergency: '999', police: '999', ambulance: '999', fire: '999' },
  { country: 'ID', code: '+62', emergency: '112', police: '110', ambulance: '118', fire: '113' },
  { country: 'TH', code: '+66', emergency: '191', police: '191', ambulance: '1669', fire: '199' },
  { country: 'VN', code: '+84', emergency: '113', police: '113', ambulance: '115', fire: '114' },
  { country: 'MY', code: '+60', emergency: '999', police: '999', ambulance: '999', fire: '999' },
  { country: 'KR', code: '+82', emergency: '119', police: '112', ambulance: '119', fire: '119' },
  { country: 'IL', code: '+972', emergency: '100', police: '100', ambulance: '101', fire: '102' },
  { country: 'TR', code: '+90', emergency: '112', police: '155', ambulance: '112', fire: '110' },
  { country: 'PL', code: '+48', emergency: '112', police: '997', ambulance: '999', fire: '998' },
];

// ─── GLASS CARD — NO SHADOWS ─────────────────────────────────────────────

const GlassCard = memo(({ children, style, onPress, active = false }: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  active?: boolean;
}) => {
  const theme = useHubTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper 
      onPress={onPress} 
      activeOpacity={onPress ? 0.85 : 1} 
      style={[
        styles.glassCard,
        active && { borderColor: theme.primary, borderWidth: 2 },
        style
      ]}
    >
      <LinearGradient
        colors={theme.isDark 
          ? ['rgba(45,45,60,0.9)', 'rgba(35,35,50,0.7)'] 
          : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glassBorder, { 
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' 
      }]} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADER — Matches TrackerHub
   ═══════════════════════════════════════════════════════════════════════════ */

const SectionHeader = memo(({ 
  title, 
  subtitle, 
  action, 
  actionLabel,
  icon,
}: { 
  title: string; 
  subtitle?: string; 
  action?: () => void; 
  actionLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) => {
  const theme = useHubTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && (
          <View style={[styles.sectionHeaderIcon, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name={icon} size={16} color={theme.primary} />
          </View>
        )}
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action} style={styles.sectionAction} activeOpacity={0.7}>
          <Text style={[styles.sectionActionText, { color: theme.primary }]}>
            {actionLabel || 'See All'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   TAB BAR — NO SHADOWS
   ═══════════════════════════════════════════════════════════════════════════ */

const TabBar = memo(({ tabs, activeTab, onChange }: { 
  tabs: { key: SafetyTab; label: string; icon: keyof typeof Ionicons.glyphMap }[]; 
  activeTab: SafetyTab; 
  onChange: (t: SafetyTab) => void;
}) => {
  const theme = useHubTheme();
  return (
    <View style={[styles.tabBar, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[
              styles.tabItem,
              isActive && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : '#fff' }
            ]}
          >
            <Ionicons name={tab.icon} size={16} color={isActive ? theme.primary : theme.text.muted} />
            <Text style={[
              styles.tabLabel,
              { color: isActive ? theme.primary : theme.text.muted },
              isActive && { fontWeight: '700' }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ─── MODAL COMPONENTS ───────────────────────────────────────────────────────

const ContactModal = memo(({ visible, onClose, onAdd, theme }: { 
  visible: boolean; 
  onClose: () => void; 
  onAdd: (contact: Omit<EmergencyContact, 'id'>) => void;
  theme: any;
}) => {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState<EmergencyType>('family');
  const [relation, setRelation] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !number.trim()) {
      Alert.alert('Missing Info', 'Please enter both name and phone number.');
      return;
    }
    onAdd({
      label: name.trim(),
      number: number.trim(),
      type,
      icon: type === 'emergency' ? 'call' : type === 'medical' ? 'medical' : 'person',
      color: type === 'emergency' ? '#ef4444' : type === 'medical' ? '#3b82f6' : '#10b981',
      relation: relation.trim() || undefined,
    });
    setName('');
    setNumber('');
    setRelation('');
    onClose();
  };

  const contactTypes = [
    { id: 'family', label: 'Family', icon: 'people' },
    { id: 'emergency', label: 'Emergency', icon: 'alert-circle' },
    { id: 'medical', label: 'Medical', icon: 'medical' },
    { id: 'custom', label: 'Custom', icon: 'person' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: theme.isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Add Contact</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="close" size={20} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Name</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: theme.text.primary,
                  borderColor: theme.surface.border,
                }]}
                placeholder="e.g., Mom, Dr. Smith"
                placeholderTextColor={theme.text.muted}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Phone Number</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: theme.text.primary,
                  borderColor: theme.surface.border,
                }]}
                placeholder="e.g., 555-123-4567"
                placeholderTextColor={theme.text.muted}
                value={number}
                onChangeText={setNumber}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Type</Text>
              <View style={styles.contactTypeGrid}>
                {contactTypes.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.contactTypeChip,
                      { 
                        backgroundColor: type === t.id ? theme.primary : 'transparent',
                        borderColor: type === t.id ? theme.primary : theme.surface.border,
                      }
                    ]}
                    onPress={() => setType(t.id as EmergencyType)}
                  >
                    <Ionicons name={t.icon as any} size={16} color={type === t.id ? '#fff' : theme.text.secondary} />
                    <Text style={[styles.contactTypeText, { color: type === t.id ? '#fff' : theme.text.secondary }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Relationship (Optional)</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: theme.text.primary,
                  borderColor: theme.surface.border,
                }]}
                placeholder="e.g., Mother, Pediatrician"
                placeholderTextColor={theme.text.muted}
                value={relation}
                onChangeText={setRelation}
              />
            </View>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]} onPress={handleAdd}>
              <Text style={styles.modalPrimaryBtnText}>Add Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const ChecklistModal = memo(({ visible, checklist, onClose, onToggleItem, theme }: { 
  visible: boolean; 
  checklist: SafetyChecklist | null; 
  onClose: () => void; 
  onToggleItem: (checklistId: string, itemId: string) => void;
  theme: any;
}) => {
  if (!checklist) return null;

  const completed = checklist.items.filter(i => i.completed).length;
  const total = checklist.items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: theme.isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{checklist.title}</Text>
              <Text style={[styles.modalSubtitle, { color: theme.text.muted }]}>{progress}% complete • {completed}/{total} items</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="close" size={20} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarBg, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
            </View>
          </View>
          <ScrollView style={styles.checklistScroll} showsVerticalScrollIndicator={false}>
            {checklist.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.checklistItemRow,
                  { 
                    borderBottomColor: theme.surface.border,
                    backgroundColor: item.completed ? (theme.isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)') : 'transparent',
                  }
                ]}
                onPress={() => onToggleItem(checklist.id, item.id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checklistCheckbox,
                  { 
                    borderColor: item.completed ? '#10b981' : theme.text.muted,
                    backgroundColor: item.completed ? '#10b981' : 'transparent',
                  }
                ]}>
                  {item.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={styles.checklistItemTextWrap}>
                  <Text style={[
                    styles.checklistItemText,
                    { 
                      color: item.completed ? theme.text.muted : theme.text.primary,
                      textDecorationLine: item.completed ? 'line-through' : 'none',
                    }
                  ]}>
                    {item.text}
                  </Text>
                  {item.critical && (
                    <View style={[styles.criticalBadge, { backgroundColor: '#ef444415' }]}>
                      <Text style={styles.criticalBadgeText}>Critical</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const ReportModal = memo(({ visible, onClose, onUpload, reports, onDelete, theme }: { 
  visible: boolean; 
  onClose: () => void; 
  onUpload: () => void;
  reports: DoctorReport[];
  onDelete: (id: string) => void;
  theme: any;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: theme.isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Doctor Reports</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="close" size={20} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TouchableOpacity style={[styles.uploadReportBtn, { borderColor: theme.primary, backgroundColor: `${theme.primary}08` }]} onPress={onUpload}>
              <Ionicons name="cloud-upload" size={24} color={theme.primary} />
              <Text style={[styles.uploadReportText, { color: theme.primary }]}>Upload New Report</Text>
            </TouchableOpacity>
            {reports.length === 0 ? (
              <View style={styles.emptyReports}>
                <Ionicons name="document-text-outline" size={48} color={theme.text.muted} />
                <Text style={[styles.emptyReportsText, { color: theme.text.muted }]}>No reports uploaded yet</Text>
              </View>
            ) : (
              <ScrollView style={styles.reportsList} showsVerticalScrollIndicator={false}>
                {reports.map((report) => (
                  <View key={report.id} style={[styles.reportItem, { borderBottomColor: theme.surface.border }]}>
                    <View style={styles.reportInfo}>
                      <Ionicons name="document-text" size={24} color={theme.primary} />
                      <View style={styles.reportDetails}>
                        <Text style={[styles.reportName, { color: theme.text.primary }]} numberOfLines={1}>{report.name}</Text>
                        <Text style={[styles.reportMeta, { color: theme.text.muted }]}>
                          {new Date(report.uploadedAt).toLocaleDateString()} • 
                          {report.status === 'approved' ? ' ✅ Approved' : report.status === 'reviewed' ? ' 📋 Reviewed' : ' ⏳ Pending'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => onDelete(report.id)} style={styles.reportDelete}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
});

const ReminderModal = memo(({ visible, onClose, onSchedule, theme }: { 
  visible: boolean; 
  onClose: () => void; 
  onSchedule: (title: string, body: string, date: Date) => void;
  theme: any;
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(new Date());

  const handleSchedule = () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a reminder title.');
      return;
    }
    onSchedule(title.trim(), body.trim() || 'Safety reminder', date);
    setTitle('');
    setBody('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: theme.isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Schedule Reminder</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="close" size={20} color={theme.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Title</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: theme.text.primary,
                  borderColor: theme.surface.border,
                }]}
                placeholder="e.g., Check babyproofing"
                placeholderTextColor={theme.text.muted}
                value={title}
                onChangeText={setTitle}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline, { 
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: theme.text.primary,
                  borderColor: theme.surface.border,
                }]}
                placeholder="What do you want to remember?"
                placeholderTextColor={theme.text.muted}
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>Date & Time</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: theme.text.primary,
                  borderColor: theme.surface.border,
                }]}
                value={date.toLocaleString()}
                editable={false}
              />
            </View>
            <TouchableOpacity style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]} onPress={handleSchedule}>
              <Text style={styles.modalPrimaryBtnText}>Schedule Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SafetyCornerScreen({ navigation }: SafetyCornerScreenProps) {
  const theme = useHubTheme();
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const { triggerHaptic, borderRadiusValue, shouldReduceMotion, fontSizeMultiplier } = useCustomization();
  const sweetAlert = useSweetAlert();
  const { user } = useAuth();

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
    markTopicCompleted,
    addCustomEmergencyContact,
    removeCustomContact,
    checklists,
    toggleChecklistItem,
    addDoctorReport,
    getDoctorReports,
    deleteDoctorReport,
    scheduleSafetyReminder,
    loadSafetyData,
    importDeviceContacts,
    getLocalEmergencyNumbers,
    currentLocation,
    refreshLocation,
  } = useSafety();

  const { growthIndex } = useGrowthIntelligence();
  const { correlations: timelineCorrelations } = useTimelineCorrelations();
  const { reminders: predictiveReminders } = usePredictiveReminders();

  const [activeTab, setActiveTab] = useState<SafetyTab>('overview');
  const [selectedTopic, setSelectedTopic] = useState<SafetyTopic | null>(null);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<SafetyChecklist | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<DoctorReport[]>([]);
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumber | null>(null);

  // ─── Load emergency numbers based on location ────────────────────────────

  useEffect(() => {
    const loadEmergencyNumbers = async () => {
      const numbers = await getLocalEmergencyNumbers();
      if (numbers && numbers.length > 0) {
        // Find the first emergency contact
        const emergency = numbers.find(n => n.type === 'emergency');
        if (emergency) {
          setEmergencyNumbers({
            country: 'Local',
            code: '',
            emergency: emergency.number,
            police: numbers.find(n => n.type === 'police')?.number || emergency.number,
            ambulance: numbers.find(n => n.type === 'ambulance')?.number || emergency.number,
            fire: numbers.find(n => n.type === 'fire')?.number || emergency.number,
            poison: numbers.find(n => n.type === 'poison')?.number || '1-800-222-1222',
          });
        }
      }
    };
    loadEmergencyNumbers();
  }, [getLocalEmergencyNumbers]);

  // ─── Load data ───────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadSafetyData();
      setReports(getDoctorReports());
    }, [loadSafetyData, getDoctorReports])
  );

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [0, 1], Extrapolate.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 80], [-10, 0], Extrapolate.CLAMP) }],
  }));

  const safetyScore = useMemo(() => getSafetyScore(), [getSafetyScore]);
  const completedCount = useMemo(() => topics.filter((t: SafetyTopic) => t.completedAt).length, [topics]);

  const handleTabChange = useCallback((tab: SafetyTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleTopicPress = useCallback((topic: SafetyTopic) => {
    setSelectedTopic(topic);
    setShowTopicModal(true);
    markTipAsViewed(topic.id);
    triggerHaptic('light');
  }, [markTipAsViewed, triggerHaptic]);

  const handleSOS = useCallback(() => {
    sweetAlert.confirm(
      'SOS Emergency',
      `This will call ${emergencyNumbers?.emergency || '911'} and alert your emergency contacts with your location. Are you sure?`,
      () => {
        Vibration.vibrate([0, 500, 200, 500]);
        triggerSOS();
        sweetAlert.success('SOS Triggered', `Emergency services (${emergencyNumbers?.emergency || '911'}) have been contacted.`);
      },
      () => {},
      `Call ${emergencyNumbers?.emergency || '911'}`,
      'Cancel'
    );
  }, [triggerSOS, sweetAlert, emergencyNumbers]);

  const handleAddContact = useCallback(async (contact: Omit<EmergencyContact, 'id'>) => {
    await addCustomEmergencyContact(contact);
    triggerHaptic('success');
    sweetAlert.success('Contact Added', `${contact.label} has been added to your emergency contacts.`);
  }, [addCustomEmergencyContact, triggerHaptic, sweetAlert]);

  const handleImportContacts = useCallback(async () => {
    await importDeviceContacts();
  }, [importDeviceContacts]);

  const handleToggleChecklistItem = useCallback((checklistId: string, itemId: string) => {
    toggleChecklistItem(checklistId, itemId);
    triggerHaptic('light');
  }, [toggleChecklistItem, triggerHaptic]);

  const handleChecklistPress = useCallback((checklist: SafetyChecklist) => {
    setSelectedChecklist(checklist);
    setShowChecklistModal(true);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const handleUploadReport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const report = {
        name: asset.name || 'Report',
        uri: asset.uri,
        mimeType: asset.mimeType || 'application/pdf',
        size: asset.size || 0,
        status: 'pending' as const,
      };

      await addDoctorReport(report);
      setReports(getDoctorReports());
      triggerHaptic('success');
      sweetAlert.success('Uploaded', 'Report uploaded successfully.');
    } catch (error) {
      sweetAlert.alert('Error', 'Failed to upload report.');
    }
  }, [addDoctorReport, getDoctorReports, triggerHaptic, sweetAlert]);

  const handleDeleteReport = useCallback(async (id: string) => {
    sweetAlert.confirm(
      'Delete Report',
      'Are you sure you want to delete this report?',
      async () => {
        await deleteDoctorReport(id);
        setReports(getDoctorReports());
        triggerHaptic('success');
      },
      () => {},
      'Delete',
      'Cancel'
    );
  }, [deleteDoctorReport, getDoctorReports, triggerHaptic, sweetAlert]);

  const handleScheduleReminder = useCallback(async (title: string, body: string, date: Date) => {
    await scheduleSafetyReminder(title, body, date);
    triggerHaptic('success');
    sweetAlert.success('Reminder Set', `"${title}" scheduled for ${date.toLocaleString()}`);
  }, [scheduleSafetyReminder, triggerHaptic, sweetAlert]);

  const handleShareLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        sweetAlert.alert('Location Required', 'Please enable location services.');
        return;
      }
      await shareLocationWithEmergency();
      setLocationSharing(true);
      triggerHaptic('success');
      sweetAlert.success('Location Shared', 'Your location has been shared with emergency contacts.');
    } catch (error) {
      sweetAlert.alert('Error', 'Could not share location.');
    }
  }, [shareLocationWithEmergency, triggerHaptic, sweetAlert]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSafetyData();
    setReports(getDoctorReports());
    await refreshLocation();
    setRefreshing(false);
  }, [loadSafetyData, getDoctorReports, refreshLocation]);

  const tabs = [
    { key: 'overview' as SafetyTab, label: 'Overview', icon: 'grid-outline' },
    { key: 'emergency' as SafetyTab, label: 'Emergency', icon: 'alert-circle-outline' },
    { key: 'topics' as SafetyTab, label: 'Topics', icon: 'shield-checkmark-outline' },
    { key: 'checklists' as SafetyTab, label: 'Checklists', icon: 'list-outline' },
    { key: 'intelligence' as SafetyTab, label: 'Intelligence', icon: 'sparkles-outline' },
    { key: 'reports' as SafetyTab, label: 'Reports', icon: 'document-text-outline' },
  ];

  const quickActions = [
    { icon: 'people', label: 'Add Contact', color: '#6366f1', onPress: () => setShowContactModal(true) },
    { icon: 'download', label: 'Import Contacts', color: '#10b981', onPress: handleImportContacts },
    { icon: 'notifications', label: 'Reminder', color: '#f59e0b', onPress: () => setShowReminderModal(true) },
    { icon: 'location', label: 'Share Location', color: '#3b82f6', onPress: handleShareLocation },
    { icon: 'medical', label: 'Hospitals', color: '#ef4444', onPress: findNearbyHospitals },
  ];

  const bgColors = theme.isDark
    ? [theme.bgColors?.[0] || '#0a0a0a', '#1a1a2e']
    : [theme.bgColors?.[0] || '#f8fafc', '#e2e8f0'];

  return (
    <View style={[styles.container, { backgroundColor: bgColors[0] }]}>
      <StatusBar barStyle={theme.statusBar} />
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, headerOpacity]}>
        <BlurView intensity={theme.isDark ? 40 : 80} tint={theme.blur} style={StyleSheet.absoluteFill} />
        <Text style={[styles.stickyTitle, { color: theme.text.primary }]}>Safety Corner</Text>
        <Text style={[styles.stickySubtitle, { color: theme.text.secondary }]}>{safetyScore}% Safety Score</Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary, theme.secondary]} />
        }
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.topHeader}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text.secondary} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>Safety Corner</Text>
            <Text style={[styles.headerSubtitle, { color: theme.text.muted }]}>
              {currentBaby ? `Protecting ${currentBaby.name}` : 'Your family safety hub'}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={() => setShowContactModal(true)} 
            style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name="person-add" size={22} color={theme.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setShowReportModal(true)} 
            style={[styles.headerIconBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name="document-text" size={22} color={theme.text.secondary} />
          </TouchableOpacity>
        </Animated.View>

        <TabBar tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

        {activeTab === 'overview' && (
          <>
            <GlassCard>
              <View style={styles.scoreRingWrap}>
                <View style={[styles.scoreRingOuter, { 
                  borderColor: safetyScore >= 80 ? '#10b98125' : safetyScore >= 50 ? '#f59e0b25' : '#ef444425' 
                }]}>
                  <View style={[styles.scoreRingInner, { 
                    borderColor: safetyScore >= 80 ? '#10b981' : safetyScore >= 50 ? '#f59e0b' : '#ef4444' 
                  }]}>
                    <Text style={[styles.scoreValue, { 
                      color: safetyScore >= 80 ? '#10b981' : safetyScore >= 50 ? '#f59e0b' : '#ef4444' 
                    }]}>{safetyScore}</Text>
                    <Text style={[styles.scoreMax, { color: theme.text.muted }]}>/100</Text>
                  </View>
                </View>
                <View style={styles.scoreLabels}>
                  <Text style={[styles.scoreLabel, { color: theme.text.primary }]}>Safety Score</Text>
                  <Text style={[styles.scoreSublabel, { 
                    color: safetyScore >= 80 ? '#10b981' : safetyScore >= 50 ? '#f59e0b' : '#ef4444' 
                  }]}>
                    {safetyScore >= 80 ? 'Excellent' : safetyScore >= 50 ? 'Good' : 'Needs Attention'}
                  </Text>
                  <View style={styles.scoreBreakdown}>
                    {[
                      { label: 'Topics', value: Math.round((completedCount / Math.max(topics.length, 1)) * 100), color: '#6366f1' },
                      { label: 'Checklists', value: Math.round(checklists.reduce((acc, c) => acc + c.progress, 0) / Math.max(checklists.length, 1)), color: '#10b981' },
                      { label: 'Streak', value: Math.min(streakDays * 5, 100), color: '#f59e0b' },
                    ].map(s => (
                      <View key={s.label} style={styles.scoreMini}>
                        <View style={[styles.scoreMiniBarBg, { backgroundColor: `${s.color}12` }]}>
                          <View style={[styles.scoreMiniBarFill, { width: `${s.value}%`, backgroundColor: s.color }]} />
                        </View>
                        <Text style={[styles.scoreMiniLabel, { color: theme.text.muted }]}>{s.label}</Text>
                        <Text style={[styles.scoreMiniValue, { color: s.color }]}>{s.value}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </GlassCard>

            <View style={styles.kpiGrid}>
              {[
                { title: 'Completed', value: completedCount, icon: 'checkmark-circle', color: '#10b981', size: 'large' },
                { title: 'Streak', value: streakDays, icon: 'flame', color: '#f59e0b', size: 'large' },
                { title: 'Topics', value: topics.length, icon: 'shield', color: '#6366f1', size: 'normal' },
                { title: 'Contacts', value: emergencyContacts.length, icon: 'people', color: '#ec4899', size: 'normal' },
              ].map((kpi, i) => (
                <Animated.View key={kpi.title} entering={FadeInUp.delay(120 + i * 80).springify()} style={[styles.kpiGridItem, kpi.size === 'large' ? styles.kpiGridItemLarge : styles.kpiGridItemNormal]}>
                  <GlassCard style={{ marginBottom: 0, height: '100%', justifyContent: 'center' }}>
                    <View style={styles.kpiInner}>
                      <View style={styles.kpiTop}>
                        <View style={[styles.kpiIconBg, { backgroundColor: `${kpi.color}12` }]}>
                          <Ionicons name={kpi.icon as any} size={20} color={kpi.color} />
                        </View>
                      </View>
                      <View style={styles.kpiBody}>
                        <Text style={[styles.kpiValue, { color: theme.text.primary, fontSize: kpi.size === 'large' ? 32 : 24 }]}>{kpi.value}</Text>
                        <Text style={[styles.kpiTitle, { color: theme.text.secondary }]}>{kpi.title}</Text>
                      </View>
                    </View>
                  </GlassCard>
                </Animated.View>
              ))}
            </View>

            <GlassCard>
              <View style={styles.streakWrap}>
                <View style={styles.streakLeft}>
                  <View style={styles.streakIconBg}>
                    <Text style={styles.streakEmoji}>🔥</Text>
                  </View>
                  <View>
                    <Text style={[styles.streakTitle, { color: theme.text.primary }]}>{streakDays}-Day Streak</Text>
                    <Text style={[styles.streakSub, { color: theme.text.muted }]}>Keep checking safety daily</Text>
                  </View>
                </View>
                <View style={styles.streakFlames}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Ionicons key={i} name="flame" size={16} color={i < Math.min(streakDays, 7) ? '#f59e0b' : theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
                  ))}
                </View>
              </View>
            </GlassCard>

            <SectionHeader title="Quick Actions" icon="flash-outline" />
            <View style={styles.quickActionsWrap}>
              {quickActions.map((action, i) => (
                <TouchableOpacity key={i} onPress={action.onPress} style={[styles.quickActionPill, { backgroundColor: `${action.color}10` }]}>
                  <Ionicons name={action.icon as any} size={18} color={action.color} />
                  <Text style={[styles.quickActionLabel, { color: action.color }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <GlassCard>
              <View style={styles.locationWrap}>
                <View style={[styles.locationDot, { backgroundColor: locationSharing ? '#10b981' : '#ef4444' }]}>
                  <View style={[styles.locationPulse, { backgroundColor: locationSharing ? '#10b98130' : '#ef444430' }]} />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={[styles.locationTitle, { color: theme.text.primary }]}>
                    {locationSharing ? 'Location Sharing Active' : 'Location Sharing Off'}
                  </Text>
                  <Text style={[styles.locationDesc, { color: theme.text.muted }]}>
                    {locationSharing ? 'Emergency contacts can see your location' : 'Enable for emergency response'}
                  </Text>
                </View>
                <Switch
                  value={locationSharing}
                  onValueChange={handleShareLocation}
                  trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                  thumbColor="#fff"
                />
              </View>
            </GlassCard>

            <View style={styles.section}>
              <SectionHeader 
                title="Recent Topics" 
                subtitle={`${completedCount} completed`} 
                action={() => setActiveTab('topics')} 
                icon="shield-checkmark-outline"
              />
              {topics.slice(0, 3).map((topic, i) => (
                <Animated.View key={topic.id} entering={FadeInUp.delay(i * 60).springify()}>
                  <TouchableOpacity onPress={() => handleTopicPress(topic)} style={[styles.topicListItem, { 
                    borderColor: theme.surface.border,
                    backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)',
                  }]}>
                    <View style={[styles.topicListIcon, { backgroundColor: `${topic.color}12` }]}>
                      <Ionicons name={topic.icon as any} size={20} color={topic.color} />
                    </View>
                    <View style={styles.topicListInfo}>
                      <Text style={[styles.topicListTitle, { color: theme.text.primary }]}>{topic.title}</Text>
                      <Text style={[styles.topicListDesc, { color: theme.text.muted }]} numberOfLines={1}>{topic.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            {growthIndex && (
              <View style={styles.section}>
                <SectionHeader 
                  title="Baby Health" 
                  subtitle="From Growth Intelligence" 
                  icon="trending-up-outline"
                />
                <GlassCard onPress={() => navigation.navigate('GrowthDashboard')}>
                  <View style={styles.growthHeader}>
                    <View style={styles.growthTitleRow}>
                      <Text style={styles.growthEmoji}>📊</Text>
                      <Text style={[styles.growthTitle, { color: theme.text.primary }]}>Growth Intelligence</Text>
                    </View>
                    <View style={[styles.compositeBadge, { backgroundColor: `${growthIndex.compositeIndex >= 80 ? '#10b981' : growthIndex.compositeIndex >= 60 ? '#f59e0b' : '#ef4444'}20` }]}>
                      <Text style={[styles.compositeText, { color: growthIndex.compositeIndex >= 80 ? '#10b981' : growthIndex.compositeIndex >= 60 ? '#f59e0b' : '#ef4444' }]}>
                        {growthIndex.compositeIndex || 0}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.scoresGrid}>
                    {[
                      { label: 'Nutrition', score: growthIndex.nutritionScore?.value || 0, icon: '🍎', color: '#FF9F43' },
                      { label: 'Rest', score: growthIndex.restScore?.value || 0, icon: '😴', color: '#5F27CD' },
                      { label: 'Physical', score: growthIndex.physicalScore?.value || 0, icon: '💪', color: '#10AC84' },
                      { label: 'Cognitive', score: growthIndex.cognitiveScore?.value || 0, icon: '🧠', color: '#FFD700' },
                    ].map((item) => (
                      <View key={item.label} style={styles.scoreItem}>
                        <Text style={styles.scoreEmoji}>{item.icon}</Text>
                        <View style={styles.scoreBarContainer}>
                          <View style={[styles.scoreBar, { width: `${Math.min(item.score, 100)}%`, backgroundColor: item.color }]} />
                        </View>
                        <Text style={[styles.scoreValue, { color: theme.text.primary }]}>{item.score}</Text>
                        <Text style={[styles.scoreLabel, { color: theme.text.muted }]}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              </View>
            )}
          </>
        )}

        {activeTab === 'emergency' && (
          <>
            <SectionHeader title="Emergency" subtitle="One-tap access to help" icon="alert-circle-outline" />

            <TouchableOpacity onPress={handleSOS} activeOpacity={0.8} style={styles.sosButton}>
              <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.sosGradient}>
                <Ionicons name="alert" size={32} color="#fff" />
                <Text style={styles.sosText}>SOS EMERGENCY</Text>
                <Text style={styles.sosSub}>Tap to call {emergencyNumbers?.emergency || '911'} & alert family</Text>
              </LinearGradient>
            </TouchableOpacity>

            <GlassCard>
              <View style={styles.emergencyNumbersWrap}>
                <Text style={[styles.emergencyNumbersTitle, { color: theme.text.secondary }]}>
                  Emergency Numbers • {emergencyNumbers?.country || 'Local'}
                </Text>
                <View style={styles.emergencyNumbersGrid}>
                  {[
                    { label: 'Emergency', number: emergencyNumbers?.emergency || '911', color: '#ef4444', icon: 'alert-circle' },
                    { label: 'Police', number: emergencyNumbers?.police || '911', color: '#3b82f6', icon: 'shield' },
                    { label: 'Ambulance', number: emergencyNumbers?.ambulance || '911', color: '#10b981', icon: 'medical' },
                    { label: 'Fire', number: emergencyNumbers?.fire || '911', color: '#f59e0b', icon: 'flame' },
                    emergencyNumbers?.poison ? { label: 'Poison Control', number: emergencyNumbers.poison, color: '#8b5cf6', icon: 'warning' } : null,
                  ].filter(Boolean).map((item) => (
                    <TouchableOpacity 
                      key={item!.label} 
                      style={[styles.emergencyNumberBtn, { backgroundColor: `${item!.color}12` }]} 
                      onPress={() => callEmergency(item!.number, item!.label, 'emergency')}
                    >
                      <Ionicons name={item!.icon as any} size={20} color={item!.color} />
                      <View style={styles.emergencyNumberInfo}>
                        <Text style={[styles.emergencyNumberLabel, { color: theme.text.primary }]}>{item!.label}</Text>
                        <Text style={[styles.emergencyNumberValue, { color: item!.color }]}>{item!.number}</Text>
                      </View>
                      <Ionicons name="call" size={18} color={item!.color} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </GlassCard>

            <SectionHeader 
              title="Emergency Contacts" 
              subtitle={`${emergencyContacts.filter(c => c.type === 'emergency' || c.type === 'family').length} contacts`}
              action={() => setShowContactModal(true)}
              actionLabel="Add"
              icon="people-outline"
            />

            {emergencyContacts.filter(c => c.type === 'emergency' || c.type === 'family').map((contact) => (
              <GlassCard key={contact.id}>
                <View style={styles.contactRow}>
                  <View style={[styles.contactAvatar, { backgroundColor: `${contact.color}15` }]}>
                    <Ionicons name={contact.icon as any} size={22} color={contact.color} />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: theme.text.primary }]}>{contact.label}</Text>
                    <Text style={[styles.contactNumber, { color: theme.text.muted }]}>{contact.number}</Text>
                    {contact.relation && (
                      <Text style={[styles.contactRelation, { color: theme.text.muted }]}>{contact.relation}</Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={[styles.contactCallBtn, { backgroundColor: `${contact.color}15` }]} 
                    onPress={() => callEmergency(contact.number, contact.label, contact.type)}
                  >
                    <Ionicons name="call" size={18} color={contact.color} />
                  </TouchableOpacity>
                  {!contact.isDefault && (
                    <TouchableOpacity 
                      style={styles.contactDeleteBtn} 
                      onPress={() => {
                        sweetAlert.confirm(
                          'Remove Contact',
                          `Remove "${contact.label}" from emergency contacts?`,
                          () => removeCustomContact(contact.id),
                          () => {},
                          'Remove',
                          'Cancel'
                        );
                      }}
                    >
                      <Ionicons name="close" size={16} color={theme.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </GlassCard>
            ))}

            <SectionHeader title="Location Services" icon="location-outline" />
            
            <GlassCard>
              <TouchableOpacity style={styles.locationActionRow} onPress={handleShareLocation}>
                <View style={[styles.locationActionIcon, { backgroundColor: '#f59e0b15' }]}>
                  <Ionicons name="share-outline" size={20} color="#f59e0b" />
                </View>
                <View style={styles.locationActionInfo}>
                  <Text style={[styles.locationActionTitle, { color: theme.text.primary }]}>Share Location</Text>
                  <Text style={[styles.locationActionDesc, { color: theme.text.muted }]}>Send your current location to contacts</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            </GlassCard>

            <GlassCard>
              <TouchableOpacity style={styles.locationActionRow} onPress={findNearbyHospitals}>
                <View style={[styles.locationActionIcon, { backgroundColor: '#ef444415' }]}>
                  <Ionicons name="medical" size={20} color="#ef4444" />
                </View>
                <View style={styles.locationActionInfo}>
                  <Text style={[styles.locationActionTitle, { color: theme.text.primary }]}>Find Nearby Hospitals</Text>
                  <Text style={[styles.locationActionDesc, { color: theme.text.muted }]}>Locate the closest medical facilities</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            </GlassCard>

            <GlassCard>
              <TouchableOpacity style={styles.locationActionRow} onPress={findNearbyPediatricians}>
                <View style={[styles.locationActionIcon, { backgroundColor: '#6366f115' }]}>
                  <Ionicons name="person" size={20} color="#6366f1" />
                </View>
                <View style={styles.locationActionInfo}>
                  <Text style={[styles.locationActionTitle, { color: theme.text.primary }]}>Find Pediatricians</Text>
                  <Text style={[styles.locationActionDesc, { color: theme.text.muted }]}>Locate pediatricians near you</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            </GlassCard>
          </>
        )}

        {activeTab === 'topics' && (
          <View style={styles.topicGrid}>
            {topics.map((topic, i) => {
              const isCompleted = !!topic.completedAt;
              return (
                <Animated.View key={topic.id} entering={FadeInUp.delay(i * 60).springify()} style={styles.topicGridItem}>
                  <TouchableOpacity onPress={() => handleTopicPress(topic)} style={[styles.topicCard, {
                    borderColor: theme.surface.border,
                    backgroundColor: isCompleted ? (theme.isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)') : (theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)'),
                  }]}>
                    <View style={styles.topicCardInner}>
                      <View style={[styles.topicIconBg, { backgroundColor: `${topic.color}12` }]}>
                        <Ionicons name={topic.icon as any} size={24} color={topic.color} />
                        {isCompleted && (
                          <View style={styles.topicCompletedBadge}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.topicTitle, { color: theme.text.primary }]} numberOfLines={2}>{topic.title}</Text>
                      <Text style={[styles.topicCategory, { color: topic.color }]}>{topic.category}</Text>
                      {topic.completedAt && (
                        <View style={[styles.topicDoneBadge, { backgroundColor: `${topic.color}12` }]}>
                          <Text style={[styles.topicDoneText, { color: topic.color }]}>Completed</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        )}

        {activeTab === 'checklists' && (
          <View style={styles.section}>
            <SectionHeader 
              title="Safety Checklists" 
              subtitle={`${checklists.length} checklists available`} 
              icon="list-outline"
            />
            {checklists.map((checklist, i) => (
              <Animated.View key={checklist.id} entering={FadeInUp.delay(i * 60).springify()}>
                <TouchableOpacity onPress={() => handleChecklistPress(checklist)} style={[styles.checklistRow, {
                  borderColor: theme.surface.border,
                  backgroundColor: theme.isDark ? 'rgba(45,45,60,0.5)' : 'rgba(255,255,255,0.75)',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                }]}>
                  <View style={[styles.checklistIcon, { backgroundColor: `${theme.primary}12` }]}>
                    <Ionicons name="list" size={22} color={theme.primary} />
                  </View>
                  <View style={styles.checklistInfo}>
                    <Text style={[styles.checklistTitle, { color: theme.text.primary }]}>{checklist.title}</Text>
                    <Text style={[styles.checklistMeta, { color: theme.text.muted }]}>{checklist.category} • {checklist.items.filter(i => i.completed).length}/{checklist.items.length} items</Text>
                    <View style={styles.checklistBarBg}>
                      <View style={[styles.checklistBarFill, { width: `${checklist.progress}%`, backgroundColor: theme.primary }]} />
                    </View>
                  </View>
                  <Text style={[styles.checklistPercent, { color: theme.primary }]}>{checklist.progress}%</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}

        {activeTab === 'intelligence' && (
          <>
            <GlassCard>
              <View style={styles.predictorHeader}>
                <View style={[styles.predictorIconBg, { backgroundColor: `${theme.primary}15` }]}>
                  <Ionicons name="sparkles" size={20} color={theme.primary} />
                </View>
                <View style={styles.predictorTitleWrap}>
                  <Text style={[styles.predictorTitle, { color: theme.text.primary }]}>Safety Intelligence</Text>
                  <Text style={[styles.predictorSubtitle, { color: theme.text.muted }]}>AI-powered safety monitoring</Text>
                </View>
              </View>
              <View style={styles.predictorList}>
                {[
                  { 
                    pattern: checklists.some(c => c.progress < 100) ? 'Checklists Pending' : 'All Checklists Complete',
                    confidence: 95,
                    basedOn: `${checklists.filter(c => c.progress < 100).length} incomplete`,
                    emoji: checklists.some(c => c.progress < 100) ? '⚠️' : '✅',
                    color: checklists.some(c => c.progress < 100) ? '#ef4444' : '#10b981',
                  },
                  {
                    pattern: topics.filter(t => !t.completedAt).length > 0 ? 'Topics to Review' : 'All Topics Completed',
                    confidence: 88,
                    basedOn: `${topics.filter(t => !t.completedAt).length} pending`,
                    emoji: topics.filter(t => !t.completedAt).length > 0 ? '📋' : '📚',
                    color: topics.filter(t => !t.completedAt).length > 0 ? '#f59e0b' : '#6366f1',
                  },
                  {
                    pattern: 'Weekly Safety Review',
                    confidence: 72,
                    basedOn: 'Habit pattern',
                    emoji: '📅',
                    color: '#8b5cf6',
                  },
                ].map((pred, i) => (
                  <View key={i} style={[styles.predictorItem, i < 2 && { borderBottomWidth: 1, borderBottomColor: theme.surface.border }]}>
                    <View style={styles.predictorLeft}>
                      <Text style={styles.predictorEmoji}>{pred.emoji}</Text>
                      <View>
                        <Text style={[styles.predictorMilestone, { color: theme.text.primary }]}>{pred.pattern}</Text>
                        <Text style={[styles.predictorCategory, { color: theme.text.muted }]}>{pred.basedOn}</Text>
                      </View>
                    </View>
                    <View style={styles.predictorRight}>
                      <View style={styles.predictorBarBg}>
                        <View style={[styles.predictorBarFill, { width: `${pred.confidence}%`, backgroundColor: pred.confidence > 70 ? '#10b981' : pred.confidence > 50 ? '#f59e0b' : '#ef4444' }]} />
                      </View>
                      <Text style={[styles.predictorConfidence, { color: theme.text.secondary }]}>{pred.confidence}% confidence</Text>
                    </View>
                  </View>
                ))}
              </View>
            </GlassCard>

            {growthIndex && (
              <GlassCard onPress={() => navigation.navigate('GrowthDashboard')}>
                <View style={styles.growthHeader}>
                  <View style={styles.growthTitleRow}>
                    <Text style={styles.growthEmoji}>📊</Text>
                    <Text style={[styles.growthTitle, { color: theme.text.primary }]}>Growth Intelligence</Text>
                  </View>
                  <View style={[styles.compositeBadge, { backgroundColor: `${growthIndex.compositeIndex >= 80 ? '#10b981' : growthIndex.compositeIndex >= 60 ? '#f59e0b' : '#ef4444'}20` }]}>
                    <Text style={[styles.compositeText, { color: growthIndex.compositeIndex >= 80 ? '#10b981' : growthIndex.compositeIndex >= 60 ? '#f59e0b' : '#ef4444' }]}>
                      {growthIndex.compositeIndex || 0}
                    </Text>
                  </View>
                </View>
                <View style={styles.scoresGrid}>
                  {[
                    { label: 'Nutrition', score: growthIndex.nutritionScore?.value || 0, icon: '🍎', color: '#FF9F43' },
                    { label: 'Rest', score: growthIndex.restScore?.value || 0, icon: '😴', color: '#5F27CD' },
                    { label: 'Physical', score: growthIndex.physicalScore?.value || 0, icon: '💪', color: '#10AC84' },
                    { label: 'Cognitive', score: growthIndex.cognitiveScore?.value || 0, icon: '🧠', color: '#FFD700' },
                  ].map((item) => (
                    <View key={item.label} style={styles.scoreItem}>
                      <Text style={styles.scoreEmoji}>{item.icon}</Text>
                      <View style={styles.scoreBarContainer}>
                        <View style={[styles.scoreBar, { width: `${Math.min(item.score, 100)}%`, backgroundColor: item.color }]} />
                      </View>
                      <Text style={[styles.scoreValue, { color: theme.text.primary }]}>{item.score}</Text>
                      <Text style={[styles.scoreLabel, { color: theme.text.muted }]}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            )}
          </>
        )}

        {activeTab === 'reports' && (
          <View style={styles.section}>
            <SectionHeader 
              title="Doctor Reports" 
              subtitle={`${reports.length} reports`} 
              icon="document-text-outline"
            />

            <TouchableOpacity style={[styles.uploadBtn, { borderColor: theme.primary, backgroundColor: `${theme.primary}08` }]} onPress={handleUploadReport}>
              <Ionicons name="cloud-upload" size={24} color={theme.primary} />
              <Text style={[styles.uploadText, { color: theme.primary }]}>Upload Report</Text>
            </TouchableOpacity>

            {reports.length === 0 ? (
              <View style={styles.emptyReports}>
                <Ionicons name="document-text-outline" size={48} color={theme.text.muted} />
                <Text style={[styles.emptyReportsText, { color: theme.text.muted }]}>No reports yet</Text>
              </View>
            ) : (
              reports.map((report) => (
                <GlassCard key={report.id}>
                  <View style={styles.reportItem}>
                    <View style={styles.reportInfo}>
                      <Ionicons name="document-text" size={24} color={theme.primary} />
                      <View style={styles.reportDetails}>
                        <Text style={[styles.reportName, { color: theme.text.primary }]} numberOfLines={1}>{report.name}</Text>
                        <Text style={[styles.reportMeta, { color: theme.text.muted }]}>
                          {new Date(report.uploadedAt).toLocaleDateString()} • 
                          {report.status === 'approved' ? ' ✅ Approved' : report.status === 'reviewed' ? ' 📋 Reviewed' : ' ⏳ Pending'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteReport(report.id)} style={styles.reportDelete}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </Animated.ScrollView>

      {/* ── MODALS ── */}
      <Modal visible={showTopicModal} transparent animationType="fade" onRequestClose={() => setShowTopicModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTopicModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: theme.isDark ? 'rgba(26,26,42,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{selectedTopic?.title || 'Topic'}</Text>
              <TouchableOpacity onPress={() => setShowTopicModal(false)} style={[styles.modalClose, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Ionicons name="close" size={20} color={theme.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {selectedTopic && (
                <>
                  <View style={[styles.topicDetailIcon, { backgroundColor: `${selectedTopic.color}12` }]}>
                    <Ionicons name={selectedTopic.icon as any} size={32} color={selectedTopic.color} />
                  </View>
                  <Text style={[styles.topicDetailDesc, { color: theme.text.muted }]}>{selectedTopic.description}</Text>
                  <View style={styles.tipsList}>
                    {selectedTopic.tips.map((tip, i) => (
                      <View key={i} style={styles.tipRow}>
                        <View style={[styles.tipBullet, { backgroundColor: selectedTopic.color }]}>
                          <Text style={styles.tipNumber}>{i + 1}</Text>
                        </View>
                        <Text style={[styles.tipText, { color: theme.text.secondary }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                  {selectedTopic.emergencyNumbers?.map((num, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={[styles.emergencyCallBtn, { backgroundColor: selectedTopic.color }]} 
                      onPress={() => callEmergency(num.number, num.label, 'emergency')}
                    >
                      <Ionicons name="call" size={18} color="#fff" />
                      <Text style={styles.emergencyCallText}>Call {num.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    style={[styles.completeBtn, { backgroundColor: selectedTopic.completedAt ? theme.text.muted : theme.primary }]} 
                    onPress={() => {
                      if (selectedTopic.completedAt) {
                        sweetAlert.alert('Already Completed', 'This topic has already been marked as completed.');
                      } else {
                        markTopicCompleted(selectedTopic.id);
                        setShowTopicModal(false);
                        sweetAlert.success('Completed!', 'Topic marked as completed.');
                      }
                    }}
                  >
                    <Ionicons name={selectedTopic.completedAt ? 'checkmark-circle' : 'checkmark-circle-outline'} size={20} color="#fff" />
                    <Text style={styles.completeBtnText}>
                      {selectedTopic.completedAt ? 'Completed' : 'Mark as Completed'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ContactModal 
        visible={showContactModal} 
        onClose={() => setShowContactModal(false)} 
        onAdd={handleAddContact}
        theme={theme}
      />

      <ChecklistModal
        visible={showChecklistModal}
        checklist={selectedChecklist}
        onClose={() => setShowChecklistModal(false)}
        onToggleItem={handleToggleChecklistItem}
        theme={theme}
      />

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onUpload={handleUploadReport}
        reports={reports}
        onDelete={handleDeleteReport}
        theme={theme}
      />

      <ReminderModal
        visible={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onSchedule={handleScheduleReminder}
        theme={theme}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — NO SHADOWS — Clean flat design
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stickyTitle: { fontSize: 17, fontWeight: '800' },
  stickySubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  glassContent: { flex: 1 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 13, fontWeight: '700' },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 4,
    borderRadius: 16,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  kpiGridItem: { marginBottom: 0 },
  kpiGridItemLarge: { width: (SCREEN_W - 56) / 2, height: 140 },
  kpiGridItemNormal: { width: (SCREEN_W - 56) / 2, height: 120 },
  kpiInner: { flex: 1, justifyContent: 'space-between', padding: 4 },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kpiIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiBody: { gap: 2, marginTop: 8 },
  kpiValue: { fontWeight: '800', letterSpacing: -0.5 },
  kpiTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  scoreRingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  scoreRingOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRingInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  scoreMax: { fontSize: 12, fontWeight: '600' },
  scoreLabels: { flex: 1, gap: 6 },
  scoreLabel: { fontSize: 16, fontWeight: '800' },
  scoreSublabel: { fontSize: 13, fontWeight: '700' },
  scoreBreakdown: { gap: 6, marginTop: 4 },
  scoreMini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreMiniBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreMiniBarFill: { height: '100%', borderRadius: 2 },
  scoreMiniLabel: { fontSize: 11, fontWeight: '600', width: 60 },
  scoreMiniValue: { fontSize: 11, fontWeight: '700', width: 24, textAlign: 'right' },

  sosButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sosGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  sosText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  sosSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },

  emergencyNumbersWrap: { padding: 16 },
  emergencyNumbersTitle: { fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  emergencyNumbersGrid: { gap: 8 },
  emergencyNumberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  emergencyNumberInfo: { flex: 1 },
  emergencyNumberLabel: { fontSize: 14, fontWeight: '600' },
  emergencyNumberValue: { fontSize: 16, fontWeight: '800' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700' },
  contactNumber: { fontSize: 13, fontWeight: '500', marginTop: 1 },
  contactRelation: { fontSize: 12, fontWeight: '500', marginTop: 1, opacity: 0.7 },
  contactCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  locationActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  locationActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationActionInfo: { flex: 1 },
  locationActionTitle: { fontSize: 15, fontWeight: '700' },
  locationActionDesc: { fontSize: 12, fontWeight: '500', marginTop: 1, opacity: 0.7 },

  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  locationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationPulse: {
    width: 28,
    height: 28,
    borderRadius: 14,
    position: 'absolute',
  },
  locationInfo: { flex: 1 },
  locationTitle: { fontSize: 15, fontWeight: '700' },
  locationDesc: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  streakWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  streakIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f59e0b12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakEmoji: { fontSize: 24 },
  streakTitle: { fontSize: 16, fontWeight: '800' },
  streakSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  streakFlames: { flexDirection: 'row', gap: 4 },

  quickActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    flex: 1,
    minWidth: (SCREEN_W - 64) / 2,
  },
  quickActionLabel: { fontSize: 13, fontWeight: '700' },

  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 16,
  },
  topicGridItem: { width: (SCREEN_W - 56) / 2 },
  topicCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    minHeight: 140,
  },
  topicCardInner: { gap: 8 },
  topicIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topicCompletedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  topicTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  topicCategory: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  topicDoneBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topicDoneText: { fontSize: 10, fontWeight: '700' },

  topicListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  topicListIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicListInfo: { flex: 1, gap: 2 },
  topicListTitle: { fontSize: 15, fontWeight: '700' },
  topicListDesc: { fontSize: 12, fontWeight: '500' },

  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
  },
  checklistIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistInfo: { flex: 1, gap: 4 },
  checklistTitle: { fontSize: 15, fontWeight: '700' },
  checklistMeta: { fontSize: 12, fontWeight: '500' },
  checklistBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  checklistBarFill: { height: '100%', borderRadius: 2 },
  checklistPercent: { fontSize: 14, fontWeight: '800', width: 40, textAlign: 'right' },

  checklistScroll: { maxHeight: SCREEN_H * 0.5 },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 12,
  },
  checklistCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistItemTextWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  checklistItemText: { fontSize: 15, fontWeight: '500', flex: 1 },
  criticalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  criticalBadgeText: { fontSize: 10, fontWeight: '700', color: '#ef4444' },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  uploadText: { fontSize: 16, fontWeight: '700' },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  reportInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  reportDetails: { flex: 1 },
  reportName: { fontSize: 14, fontWeight: '600' },
  reportMeta: { fontSize: 12, fontWeight: '500', marginTop: 1, opacity: 0.7 },
  reportDelete: { padding: 4 },

  uploadReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  uploadReportText: { fontSize: 15, fontWeight: '700' },
  reportsList: { maxHeight: SCREEN_H * 0.5 },

  emptyReports: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyReportsText: { fontSize: 15, fontWeight: '500' },

  predictorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },
  predictorIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  predictorTitleWrap: { flex: 1 },
  predictorTitle: { fontSize: 16, fontWeight: '800' },
  predictorSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  predictorList: { paddingHorizontal: 16, paddingBottom: 16 },
  predictorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  predictorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  predictorEmoji: { fontSize: 22 },
  predictorMilestone: { fontSize: 14, fontWeight: '700' },
  predictorCategory: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  predictorRight: { alignItems: 'flex-end', gap: 4 },
  predictorBarBg: { width: 60, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  predictorBarFill: { height: '100%', borderRadius: 2 },
  predictorConfidence: { fontSize: 10, fontWeight: '600' },

  growthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  growthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  growthEmoji: { fontSize: 24 },
  growthTitle: { fontSize: 16, fontWeight: '800' },
  compositeBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  compositeText: { fontSize: 16, fontWeight: '800' },
  scoresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  scoreItem: { width: '47%', gap: 4 },
  scoreEmoji: { fontSize: 20 },
  scoreBarContainer: { height: 4, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' },
  scoreBar: { height: '100%', borderRadius: 2 },
  scoreValue: { fontSize: 16, fontWeight: '800' },
  scoreLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, opacity: 0.7 },

  section: { marginBottom: SPACING.xl },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '100%', maxWidth: 400, maxHeight: SCREEN_H * 0.85, borderRadius: 28, overflow: 'hidden' },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.3)', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  modalClose: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalBody: { paddingHorizontal: 20, paddingBottom: 20 },
  modalScroll: { paddingHorizontal: 20, paddingBottom: 20 },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1,
  },
  inputMultiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  modalPrimaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  contactTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contactTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  contactTypeText: { fontSize: 13, fontWeight: '600' },

  progressBarWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  topicDetailIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  topicDetailDesc: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  tipsList: { gap: 12, marginBottom: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tipBullet: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  tipNumber: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tipText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 10,
  },
  emergencyCallText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 4,
  },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});