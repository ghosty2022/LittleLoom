// src/screens/baby/CoParentInviteScreen.tsx - COMPLETE FIXED VERSION
// FIX: Shows ALL codes with status, includes modal with code details, partial sign-up recovery
// FIX: Displays email, phone, and name used during partial sign-up

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useApp } from '../../context/AppContext';
import { useFamily } from '../../context/FamilyContext';
import QRCode from 'react-native-qrcode-svg';

type Props = NativeStackScreenProps<RootStackParamList, 'CoParentInviteScreen'>;
const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   ROLE CONFIGURATION
   ═══════════════════════════════════════════════════════════════════════════ */

type RoleKey = 'parent2' | 'guardian' | 'viewer';

const ROLE_META: Record<RoleKey, {
  label: string;
  color: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  placeholder: string;
  permissions: string[];
}> = {
  parent2: {
    label: 'Co-Parent',
    color: '#ec4899',
    gradient: ['#ec4899', '#f43f5e'],
    icon: 'heart',
    description: 'Full access to manage baby data, family settings, and exports',
    placeholder: 'e.g., Father, Mother, Partner',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'],
  },
  guardian: {
    label: 'Guardian',
    color: '#10b981',
    gradient: ['#10b981', '#34d399'],
    icon: 'shield-checkmark',
    description: 'Can log activities and view data, but cannot manage family',
    placeholder: 'e.g., Grandma, Nanny, Uncle',
    permissions: ['Read', 'Write', 'Limited Delete', 'View Timeline', 'Add Photos'],
  },
  viewer: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    description: 'View-only access to timeline, photos, and growth charts',
    placeholder: 'e.g., Aunt, Family Friend',
    permissions: ['Read Only', 'View Timeline', 'View Photos'],
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  active: { label: 'Active', color: '#22c55e', icon: 'checkmark-circle' },
  used: { label: 'Used', color: '#64748b', icon: 'checkmark-done-circle' },
  partial: { label: 'Partial', color: '#f59e0b', icon: 'warning' },
  revoked: { label: 'Revoked', color: '#ef4444', icon: 'close-circle' },
  expired: { label: 'Expired', color: '#f59e0b', icon: 'time' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE TOAST
   ═══════════════════════════════════════════════════════════════════════════ */

const Toast = ({ message, type, visible, onHide }: {
  message: string; type: 'success' | 'error' | 'info';
  visible: boolean; onHide: () => void;
}) => {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      RNAnimated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      const t = setTimeout(() => {
        RNAnimated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(onHide);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [visible, onHide, opacity]);
  if (!visible) return null;

  const colors = {
    success: { bg: '#10b981', icon: 'checkmark-circle' },
    error: { bg: '#ef4444', icon: 'alert-circle' },
    info: { bg: '#3b82f6', icon: 'information-circle' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="none">
      <RNAnimated.View style={[styles.toast, { opacity, backgroundColor: colors.bg }]}>
        <Ionicons name={colors.icon as any} size={18} color="#fff" />
        <Text style={styles.toastText}>{message}</Text>
      </RNAnimated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CODE DETAILS MODAL - Enhanced with Partial Sign-Up Info
   ═══════════════════════════════════════════════════════════════════════════ */

function CodeDetailsModal({ 
  code, 
  visible, 
  onClose,
  isDark,
  primaryColor,
  onResendPartial,
}: { 
  code: any; 
  visible: boolean; 
  onClose: () => void;
  isDark: boolean;
  primaryColor: string;
  onResendPartial?: (code: string) => void;
}) {
  if (!code) return null;

  const statusConfig = STATUS_CONFIG[code.status] || STATUS_CONFIG.active;
  const roleMeta = ROLE_META[code.role as RoleKey];
  const isPartial = code.status === 'partial';

  // ─── Extract partial signup info ──────────────────────────────────────
  const partialEmail = code.used_by_email || null;
  const partialPhone = code.used_by_phone || null;
  const partialName = code.used_by_name || null;
  const partialUserId = code.used_by || null;
  const partialUsedAt = code.used_at || null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, isDark && styles.modalContentDark]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>Invite Code Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {/* Code Display */}
            <View style={[styles.modalCodeDisplay, { borderColor: isPartial ? '#f59e0b30' : primaryColor + '30' }]}>
              <Text style={[styles.modalCodeText, { color: isPartial ? '#f59e0b' : primaryColor }]}>{code.code}</Text>
              <View style={[styles.modalStatusBadge, { backgroundColor: statusConfig.color + '15' }]}>
                <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
                <Text style={[styles.modalStatusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>

            {/* Partial Sign-up Warning with Full User Info */}
            {isPartial && (
              <View style={[styles.partialModalWarning, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b30' }]}>
                <Ionicons name="warning" size={18} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partialModalWarningText, { color: '#f59e0b' }]}>
                    ⚠️ Partial Sign-up Detected
                  </Text>
                  
                  {/* ─── User Info Section ─── */}
                  <View style={styles.partialUserInfo}>
                    <Text style={[styles.partialUserInfoLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      User Information Provided:
                    </Text>
                    
                    {partialName && (
                      <View style={styles.partialInfoRow}>
                        <Ionicons name="person-outline" size={14} color="#f59e0b" />
                        <Text style={[styles.partialInfoText, { color: isDark ? '#e2e8f0' : '#1a1a1a' }]}>
                          Name: <Text style={{ fontWeight: '700' }}>{partialName}</Text>
                        </Text>
                      </View>
                    )}
                    
                    {partialEmail && (
                      <View style={styles.partialInfoRow}>
                        <Ionicons name="mail-outline" size={14} color="#f59e0b" />
                        <Text style={[styles.partialInfoText, { color: isDark ? '#e2e8f0' : '#1a1a1a' }]}>
                          Email: <Text style={{ fontWeight: '700' }}>{partialEmail}</Text>
                        </Text>
                      </View>
                    )}
                    
                    {partialPhone && (
                      <View style={styles.partialInfoRow}>
                        <Ionicons name="call-outline" size={14} color="#f59e0b" />
                        <Text style={[styles.partialInfoText, { color: isDark ? '#e2e8f0' : '#1a1a1a' }]}>
                          Phone: <Text style={{ fontWeight: '700' }}>{partialPhone}</Text>
                        </Text>
                      </View>
                    )}
                    
                    {partialUserId && (
                      <View style={styles.partialInfoRow}>
                        <Ionicons name="person-circle-outline" size={14} color="#f59e0b" />
                        <Text style={[styles.partialInfoText, { color: isDark ? '#e2e8f0' : '#1a1a1a' }]}>
                          User ID: <Text style={{ fontWeight: '500', fontSize: 11 }}>{partialUserId.substring(0, 12)}...</Text>
                        </Text>
                      </View>
                    )}
                    
                    {partialUsedAt && (
                      <View style={styles.partialInfoRow}>
                        <Ionicons name="calendar-outline" size={14} color="#f59e0b" />
                        <Text style={[styles.partialInfoText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                          Started: {new Date(partialUsedAt).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={[styles.partialModalSubtext, { color: isDark ? '#94a3b8' : '#64748b', marginTop: 8 }]}>
                    This person started sign-up but didn't complete it. 
                    {partialEmail ? ` Contact them at ${partialEmail} to help them finish.` : ' Resend the invite to help them complete registration.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Details Grid */}
            <View style={styles.modalDetailsGrid}>
              <DetailItem label="Role" value={roleMeta?.label || code.role} icon={roleMeta?.icon || 'person'} isDark={isDark} />
              <DetailItem label="Relationship" value={code.relationship || 'Not specified'} icon="heart" isDark={isDark} />
              <DetailItem label="Created" value={new Date(code.created_at).toLocaleDateString()} icon="calendar" isDark={isDark} />
              <DetailItem label="Expires" value={new Date(code.expiresAt).toLocaleDateString()} icon="time" isDark={isDark} />
              {code.used_by && !isPartial && (
                <DetailItem label="Used By" value={code.used_by || 'Unknown'} icon="person" isDark={isDark} />
              )}
              {code.used_by_email && !isPartial && (
                <DetailItem label="Used Email" value={code.used_by_email} icon="mail" isDark={isDark} />
              )}
              {code.used_by_phone && !isPartial && (
                <DetailItem label="Used Phone" value={code.used_by_phone} icon="call" isDark={isDark} />
              )}
              {code.used_at && (
                <DetailItem label="Used At" value={new Date(code.used_at).toLocaleString()} icon="calendar" isDark={isDark} />
              )}
            </View>

            {/* QR Code */}
            <View style={styles.modalQrSection}>
              <Text style={[styles.modalSectionLabel, isDark && { color: '#94a3b8' }]}>QR Code</Text>
              <View style={[styles.modalQrWrap, isDark && styles.modalQrWrapDark]}>
                <QRCode
                  value={code.code}
                  size={120}
                  color={isDark ? '#ffffff' : '#1a1a1a'}
                  backgroundColor={isDark ? '#1a1a2e' : '#ffffff'}
                  logo={require('../../../assets/icon.png')}
                  logoSize={24}
                  logoBackgroundColor={isDark ? '#1a1a2e' : '#ffffff'}
                />
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: primaryColor + '15' }]}
                onPress={() => {
                  Clipboard.setStringAsync(code.code);
                  onClose();
                }}
              >
                <Ionicons name="copy-outline" size={20} color={primaryColor} />
                <Text style={[styles.modalActionText, { color: primaryColor }]}>Copy Code</Text>
              </TouchableOpacity>
              {isPartial && onResendPartial && (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#f59e0b15' }]}
                  onPress={() => {
                    onResendPartial(code.code);
                    onClose();
                  }}
                >
                  <Ionicons name="refresh-outline" size={20} color="#f59e0b" />
                  <Text style={[styles.modalActionText, { color: '#f59e0b' }]}>Resend</Text>
                </TouchableOpacity>
              )}
              {(code.status === 'active' || code.status === 'partial') && (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#ef444415' }]}
                  onPress={() => {
                    let message = code.status === 'partial' 
                      ? `📱 You started signing up for LittleLoom but didn't finish.\n\n🎫 Code: ${code.code}\n🔗 https://littleloom.app/join?code=${code.code}`
                      : `👋 Join me on LittleLoom! Use code: ${code.code}\n🔗 https://littleloom.app/join?code=${code.code}`;
                    
                    // Add partial user info to the message if available
                    if (isPartial) {
                      if (partialEmail) message += `\n\n📧 Your email: ${partialEmail}`;
                      if (partialPhone) message += `\n📱 Your phone: ${partialPhone}`;
                      if (partialName) message += `\n👤 Your name: ${partialName}`;
                      message += `\n\nComplete your registration to join the family! 🎉`;
                    }
                    
                    Share.share({ message });
                    onClose();
                  }}
                >
                  <Ionicons name="share-outline" size={20} color="#ef4444" />
                  <Text style={[styles.modalActionText, { color: '#ef4444' }]}>Share</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailItem({ label, value, icon, isDark }: { label: string; value: string; icon: string; isDark: boolean }) {
  return (
    <View style={[styles.detailItem, isDark && styles.detailItemDark]}>
      <Ionicons name={icon as any} size={16} color="#667eea" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, isDark && { color: '#94a3b8' }]}>{label}</Text>
        <Text style={[styles.detailValue, isDark && styles.textDark]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN — Unified Invite Flow
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CoParentInviteScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useApp();
  const { themeColors, shouldReduceMotion, triggerHaptic, avatar } = useCustomization();
  const { userProfile, skipSetup, completeSetup, setupComplete } = useAuth();
  const { currentBaby } = useBaby();
  const { 
    generateInviteCode, 
    getActiveInviteCodes, 
    revokeInviteCode,
    getPartialSignupInfo,
    recoverPartialSignup,
  } = useFamily();

  const dynamicPrimary = themeColors.primary || colors.primary;
  const dynamicSecondary = themeColors.secondary || colors.primaryLight;
  const dynamicGradient = [dynamicPrimary, dynamicSecondary] as [string, string];

  // ── State ──
  const [role, setRole] = useState<RoleKey>('parent2');
  const [relationship, setRelationship] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as const });
  
  // ── Modal State ──
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const isOnboarding = useMemo(() => !setupComplete, [setupComplete]);

  // ── Animated rings ──
  const ringProgress = useSharedValue(0);

  useEffect(() => {
    if (!shouldReduceMotion) {
      ringProgress.value = withRepeat(withTiming(1, { duration: 3000 }), -1, false);
    }
    return () => {
      ringProgress.value = 0;
    };
  }, [shouldReduceMotion]);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ringProgress.value, [0, 0.5, 1], [0.4, 0.2, 0]),
    transform: [{ scale: interpolate(ringProgress.value, [0, 1], [1, 1.6]) }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ringProgress.value, [0, 0.5, 1], [0.3, 0.15, 0]),
    transform: [{ scale: interpolate(ringProgress.value, [0, 1], [1, 1.4]) }],
  }));

  // ── Success checkmark animation ──
  const checkScale = useSharedValue(0);
  const checkRotate = useSharedValue(0);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }, { rotate: `${checkRotate.value}deg` }],
  }));
  const triggerSuccessAnim = useCallback(() => {
    checkScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 10, stiffness: 200 }),
      withTiming(1, { duration: 200 })
    );
    checkRotate.value = withSequence(withTiming(-180, { duration: 0 }), withSpring(0, { damping: 12, stiffness: 150 }));
  }, [checkScale, checkRotate]);

  // ── Load active codes on mount ──
  useEffect(() => {
    loadActiveCodes();
  }, []);

  const loadActiveCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const codes = await getActiveInviteCodes();
      if (codes) {
        // Sort: partial first (needs attention), then active, then others
        const sorted = codes.sort((a, b) => {
          const priority: Record<string, number> = { partial: 0, active: 1, used: 2, expired: 3, revoked: 4 };
          const priorityA = priority[a.status] ?? 5;
          const priorityB = priority[b.status] ?? 5;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return b.created_at - a.created_at;
        });
        setActiveCodes(sorted);
      }
    } catch (e) { console.error(e); }
    finally { setIsLoadingCodes(false); }
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const validate = () => {
    if (!relationship.trim()) { showToast('Please enter their relationship to the baby', 'error'); return false; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Please enter a valid email', 'error'); return false;
    }
    return true;
  };

  // ─── Generate code with proper 6-character format ─────────────
  const handleGenerate = useCallback(async () => {
    if (!validate()) return;
    if (!currentBaby?.id) {
      showToast('Add a baby profile first to generate invites', 'info');
      navigation.navigate('CreateBabyProfile' as never);
      return;
    }
    triggerHaptic('medium');
    setIsGenerating(true);

    try {
      const result = await generateInviteCode(role, relationship.trim(), fullName.trim() || undefined, email.trim() || undefined, phone.trim() || undefined);

      if (result.success && result.code) {
        const code = result.code.padStart(6, '0').slice(0, 6);
        setGeneratedCode(code);
        triggerHaptic('success');
        triggerSuccessAnim();
        showToast('Invite code generated!');
        await loadActiveCodes();
      } else {
        showToast(result.message || 'Failed to generate code', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Something went wrong', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [relationship, fullName, email, phone, currentBaby, userProfile, role, triggerHaptic, showToast, triggerSuccessAnim, generateInviteCode]);
  
  // ─── Handle Share ──────────────────────────────────────────────────────
  const handleShare = useCallback(async (method: 'copy' | 'whatsapp' | 'sms' | 'email' | 'native') => {
    if (!generatedCode) return;
    const roleLabel = ROLE_META[role].label;
    const babyName = currentBaby?.name || 'our baby';
    const message = `👋 Join me on LittleLoom!\n\n👶 Baby: ${babyName}\n🎫 Code: ${generatedCode}\n👤 Role: ${roleLabel}\n\nDownload the app and enter this code on the sign-up screen.`;
    const url = `https://littleloom.app/join?code=${generatedCode}`;
    triggerHaptic('light');

    switch (method) {
      case 'copy':
        await Clipboard.setStringAsync(`${message}\n${url}`);
        showToast('Copied to clipboard'); break;
      case 'whatsapp':
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message + '\n' + url)}`)
          .catch(() => showToast('WhatsApp not installed', 'error')); break;
      case 'sms':
        Linking.openURL(`sms:?body=${encodeURIComponent(message)}`)
          .catch(() => showToast('SMS not available', 'error')); break;
      case 'email':
        Linking.openURL(`mailto:?subject=${encodeURIComponent(`LittleLoom Invite - ${babyName}`)}&body=${encodeURIComponent(message + '\n\n' + url)}`)
          .catch(() => showToast('Email not available', 'error')); break;
      case 'native':
        await Share.share({ message, title: `Invite to LittleLoom - ${babyName}` }); break;
    }
  }, [generatedCode, role, currentBaby, triggerHaptic, showToast]);

  // ─── Handle Revoke ────────────────────────────────────────────────────
  const handleRevoke = useCallback(async (code: string) => {
    const success = await revokeInviteCode(code);
    if (success) {
      showToast('Code revoked');
      await loadActiveCodes();
      if (generatedCode === code) setGeneratedCode('');
    } else {
      showToast('Could not revoke code', 'error');
    }
  }, [revokeInviteCode, generatedCode, showToast]);

  // ─── Handle Resend Partial ────────────────────────────────────────────
  const handleResendPartial = useCallback(async (code: string) => {
    try {
      // Get partial info
      const partialInfo = await getPartialSignupInfo(code);
      if (!partialInfo.exists) {
        showToast('No partial signup found for this code', 'error');
        return;
      }

      // Generate share message with ALL partial info
      const roleLabel = ROLE_META[role]?.label || 'Family Member';
      const babyName = currentBaby?.name || 'our baby';
      
      let message = `📱 You started signing up for LittleLoom but didn't finish!\n\n`;
      message += `👶 Baby: ${babyName}\n`;
      message += `🎫 Code: ${code}\n`;
      message += `👤 Role: ${roleLabel}\n\n`;
      message += `🔗 Continue here: https://littleloom.app/join?code=${code}\n\n`;
      
      // ─── Include ALL user info ──────────────────────────────────────
      if (partialInfo.name) {
        message += `👤 Your name: ${partialInfo.name}\n`;
      }
      if (partialInfo.email) {
        message += `📧 Your email: ${partialInfo.email}\n`;
      }
      if (partialInfo.phone) {
        message += `📱 Your phone: ${partialInfo.phone}\n`;
      }
      
      message += `\nComplete your registration to join the family! 🎉`;
      
      await Share.share({ message, title: 'Complete Your Sign-Up' });
      showToast('Share sent with all user info!');
    } catch (error) {
      console.error('Error resending partial:', error);
      showToast('Could not resend invite', 'error');
    }
  }, [currentBaby, role, getPartialSignupInfo, showToast]);

  const handleSkip = useCallback(async () => {
    triggerHaptic('light');
    setIsLoading(true);
    try {
      await skipSetup('parent2');
      showToast('Skipped for now - you can add later in Family settings', 'info');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' as never }],
      });
    } catch (error) {
      console.error('handleSkip error:', error);
      showToast('Could not skip', 'error');
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' as never }],
        });
      } catch (e) {
        console.error('Fallback navigation failed:', e);
        navigation.replace('Main' as never);
      }
    } finally {
      setIsLoading(false);
    }
  }, [skipSetup, triggerHaptic, showToast, navigation]);

  const handleContinue = useCallback(async () => {
    triggerHaptic('medium');
    setIsLoading(true);
    try {
      await completeSetup('parent2');
      showToast('Setup complete! Welcome to the family', 'success');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' as never }],
      });
    } catch (error) {
      console.error('handleContinue error:', error);
      showToast('Could not save progress', 'error');
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' as never }],
        });
      } catch (e) {
        console.error('Fallback navigation failed:', e);
        navigation.replace('Main' as never);
      }
    } finally {
      setIsLoading(false);
    }
  }, [completeSetup, triggerHaptic, showToast, navigation]);

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main' as never);
  };

  const handleCodePress = (code: any) => {
    setSelectedCode(code);
    setModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    return STATUS_CONFIG[status]?.color || '#64748b';
  };

  const getStatusLabel = (status: string) => {
    return STATUS_CONFIG[status]?.label || status;
  };

  // ─── Render Status Badge ──────────────────────────────────────────────
  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status];
    if (!config) return null;
    return (
      <View style={[styles.activeStatusBadge, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon} size={12} color={config.color} />
        <Text style={[styles.activeStatusText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  };

  // ─── Render Partial User Info in List ─────────────────────────────────
  const renderPartialUserInfo = (code: any) => {
    const parts: string[] = [];
    if (code.used_by_name) parts.push(`👤 ${code.used_by_name}`);
    if (code.used_by_email) parts.push(`📧 ${code.used_by_email}`);
    if (code.used_by_phone) parts.push(`📱 ${code.used_by_phone}`);
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.surface] : ['#f8faff', '#eef2ff']}
        style={styles.gradient}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Header ── */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.headerRow}>
              <TouchableOpacity style={[styles.backBtn, isDark && styles.backBtnDark]} onPress={handleBack}>
                <BlurView intensity={60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                <Ionicons name={isOnboarding ? 'close' : 'arrow-back'} size={22} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, isDark && styles.textDark]}>
                {isOnboarding ? 'Invite Co-Parent' : 'Invite Family'}
              </Text>
              <View style={{ width: 46 }} />
            </Animated.View>

            {/* ── Hero ── */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(80)} style={styles.hero}>
              <View style={styles.avatarWrapper}>
                <Animated.View style={[styles.pulseRing, ring1Style, { borderColor: dynamicPrimary }]} />
                <Animated.View style={[styles.pulseRing, ring2Style, { borderColor: dynamicSecondary }]} />
                <View style={[styles.iconContainer, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }, { borderColor: dynamicPrimary + '40' }]}>
                  <SafeAvatar
                    avatar={avatar}
                    size={68}
                    fallbackIcon="people"
                    fallbackColor={dynamicPrimary}
                    fallbackBgColor={dynamicPrimary + '15'}
                    borderWidth={2}
                    borderColor={dynamicPrimary + '50'}
                    animated={!shouldReduceMotion}
                  />
                </View>
                <View style={[styles.badge, { backgroundColor: dynamicPrimary }]}>
                  <Ionicons name="add" size={14} color="#fff" />
                </View>
              </View>
              <Text style={[styles.heroTitle, isDark && styles.textDark]}>
                {isOnboarding ? 'Invite Your Partner' : 'Invite Family Member'}
              </Text>
              <Text style={[styles.heroSubtitle, isDark && { color: '#94a3b8' }]}>
                {currentBaby
                  ? `Share the journey of raising ${currentBaby.name} together`
                  : 'Share the journey of raising your little one together'}
              </Text>
            </Animated.View>

            {/* ── No baby yet: link to creation screen ── */}
            {!currentBaby && (
              <Animated.View
                entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}
                style={[
                  styles.infoPill,
                  {
                    backgroundColor: dynamicPrimary + '12',
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: dynamicPrimary + '30',
                  },
                ]}
              >
                <Ionicons name="information-circle" size={18} color={dynamicPrimary} />
                <Text style={[styles.infoPillText, isDark && { color: '#94a3b8' }]}>
                  Add your baby's profile first — invite codes need a baby to link to.
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('CreateBabyProfile' as never)}>
                  <Text style={{ color: dynamicPrimary, fontWeight: '800', fontSize: 12 }}>Add Baby</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ── Role Selection ── */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(120)} style={styles.section}>
              <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>Select their role</Text>
              <View style={styles.roleCards}>
                {(Object.keys(ROLE_META) as RoleKey[]).map((r) => {
                  const meta = ROLE_META[r];
                  const active = role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      activeOpacity={0.85}
                      onPress={() => { setRole(r); triggerHaptic('light'); }}
                      style={[
                        styles.roleCard,
                        active && { borderColor: meta.color, backgroundColor: meta.color + '08' },
                        isDark && styles.roleCardDark,
                      ]}
                    >
                      <LinearGradient colors={meta.gradient} style={styles.roleCardIcon}>
                        <Ionicons name={meta.icon} size={20} color="#fff" />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleCardTitle, isDark && styles.textDark]}>{meta.label}</Text>
                        <Text style={[styles.roleCardDesc, isDark && { color: '#94a3b8' }]} numberOfLines={2}>
                          {meta.description}
                        </Text>
                      </View>
                      <View style={[styles.roleCheck, active && { backgroundColor: meta.color, borderColor: meta.color }]}>
                        {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>

            {/* ── Details Form ── */}
            {!generatedCode && (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(160)} style={styles.section}>
                <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>Their details</Text>
                <View style={[styles.formCard, isDark && styles.formCardDark]}>
                  <BlurView intensity={isDark ? 30 : 70} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />

                  <InputRow icon="heart-outline" placeholder={ROLE_META[role].placeholder} value={relationship} onChangeText={setRelationship} themeColor={dynamicPrimary} isDark={isDark} />
                  <InputRow icon="person-outline" placeholder="Full Name (optional)" value={fullName} onChangeText={setFullName} themeColor={dynamicPrimary} isDark={isDark} />
                  <InputRow icon="mail-outline" placeholder="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" themeColor={dynamicPrimary} isDark={isDark} />
                  <InputRow icon="call-outline" placeholder="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" themeColor={dynamicPrimary} isDark={isDark} />

                  <View style={styles.infoPill}>
                    <Ionicons name="shield-checkmark" size={16} color={dynamicPrimary} />
                    <Text style={[styles.infoPillText, isDark && { color: '#94a3b8' }]}>
                      They'll use this code when signing up. Expires in 7 days and can only be used once.
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── Generate / Success ── */}
            {generatedCode ? (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.springify()} style={styles.section}>
                <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>Invite ready</Text>
                <View style={[styles.codeCard, isDark && styles.codeCardDark]}>
                  <BlurView intensity={isDark ? 30 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />

                  <Animated.View style={[styles.checkBurst, checkStyle]}>
                    <LinearGradient colors={['#10b981', '#34d399']} style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={32} color="#fff" />
                    </LinearGradient>
                  </Animated.View>

                  <Text style={[styles.codeLabel, isDark && { color: '#94a3b8' }]}>INVITE CODE</Text>
                  <Text style={[styles.codeText, { color: dynamicPrimary }]}>{generatedCode}</Text>

                  <View style={[styles.qrWrap, isDark && styles.qrWrapDark]}>
                    <TouchableOpacity 
                      onPress={() => handleShare('native')}
                      activeOpacity={0.8}
                    >
                      <QRCode
                        value={generatedCode}
                        size={130}
                        color={isDark ? '#ffffff' : '#1a1a1a'}
                        backgroundColor={isDark ? '#1a1a2e' : '#ffffff'}
                        logo={require('../../../assets/icon.png')}
                        logoSize={24}
                        logoBackgroundColor={isDark ? '#1a1a2e' : '#ffffff'}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.codeSub, isDark && { color: '#94a3b8' }]}>
                    Valid for 7 days • One-time use • {ROLE_META[role].label}
                  </Text>

                  <View style={styles.shareGrid}>
                    <ShareButton icon="copy-outline" label="Copy" color="#667eea" onPress={() => handleShare('copy')} />
                    <ShareButton icon="logo-whatsapp" label="WhatsApp" color="#25d366" onPress={() => handleShare('whatsapp')} />
                    <ShareButton icon="chatbubble-outline" label="SMS" color="#3b82f6" onPress={() => handleShare('sms')} />
                    <ShareButton icon="mail-outline" label="Email" color="#ef4444" onPress={() => handleShare('email')} />
                    <ShareButton icon="share-outline" label="More" color="#64748b" onPress={() => handleShare('native')} />
                  </View>

                  <TouchableOpacity style={styles.resetBtn} onPress={() => setGeneratedCode('')}>
                    <Text style={[styles.resetText, { color: dynamicPrimary }]}>Generate Another Code</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)}>
                <TouchableOpacity
                  style={[styles.generateBtn, (!relationship.trim() || isGenerating) && styles.generateBtnDisabled, { shadowColor: dynamicPrimary }]}
                  onPress={handleGenerate}
                  disabled={!relationship.trim() || isGenerating}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={dynamicGradient} style={styles.generateGradient}>
                    {isGenerating ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Ionicons name="key" size={20} color="#fff" />
                        <Text style={styles.generateText}>Generate Invite Code</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ─── Active Codes List ── */}
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(240)} style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>
                  All Codes ({activeCodes.length})
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={loadActiveCodes} disabled={isLoadingCodes} style={{ padding: 4 }}>
                    <Ionicons name="refresh" size={18} color={dynamicPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {isLoadingCodes ? (
                <View style={{ alignItems: 'center', padding: 20 }}>
                  <ActivityIndicator color={dynamicPrimary} />
                </View>
              ) : activeCodes.length === 0 ? (
                <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
                  <Ionicons name="key-outline" size={32} color={isDark ? '#64748b' : '#94a3b8'} />
                  <Text style={[styles.emptyStateText, isDark && { color: '#94a3b8' }]}>
                    No invite codes generated yet
                  </Text>
                  <Text style={[styles.emptyStateSub, isDark && { color: '#64748b' }]}>
                    Generate your first invite code above
                  </Text>
                </View>
              ) : (
                activeCodes.map((code, index) => {
                  const statusConfig = STATUS_CONFIG[code.status] || STATUS_CONFIG.active;
                  const roleMeta = ROLE_META[code.role as RoleKey];
                  const isPartial = code.status === 'partial';
                  const partialUserInfo = renderPartialUserInfo(code);
                  
                  return (
                    <Animated.View
                      key={code.code}
                      entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 60)}
                      style={[
                        styles.activeCodeRow, 
                        isDark && styles.activeCodeRowDark,
                        isPartial && styles.activeCodeRowPartial,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.activeCodeTouchable}
                        onPress={() => handleCodePress(code)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.activeCodeMain}>
                          <View style={[styles.activeDot, { backgroundColor: getStatusColor(code.status) }]} />
                          <View style={{ flex: 1 }}>
                            <View style={styles.activeCodeHeader}>
                              <Text style={[styles.activeCodeText, isDark && styles.textDark, { letterSpacing: 2 }]}>
                                {code.code}
                              </Text>
                              {renderStatusBadge(code.status)}
                            </View>
                            <Text style={[styles.activeCodeMeta, isDark && { color: '#94a3b8' }]}>
                              {roleMeta?.label || code.role} • {code.relationship || 'Family'}
                              {code.status === 'used' && code.used_by && ` • Used by: ${code.used_by}`}
                            </Text>
                            
                            {/* ─── Display Partial User Info ─── */}
                            {isPartial && partialUserInfo && (
                              <Text style={[styles.activeCodeUserInfo, { color: '#f59e0b' }]}>
                                {partialUserInfo}
                              </Text>
                            )}
                            
                            {isPartial && (
                              <Text style={[styles.activeCodePartial, { color: '#f59e0b' }]}>
                                ⚠️ Partial sign-up - user didn't complete registration
                              </Text>
                            )}
                            {code.status === 'active' && (
                              <Text style={[styles.activeCodeExpiry, { color: '#f59e0b' }]}>
                                Expires: {new Date(code.expiresAt).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748b' : '#94a3b8'} />
                        </View>
                      </TouchableOpacity>
                      
                      <View style={styles.activeCodeActions}>
                        {isPartial && (
                          <TouchableOpacity 
                            style={[styles.resendBtnSmall, { backgroundColor: '#f59e0b15' }]} 
                            onPress={() => handleResendPartial(code.code)}
                          >
                            <Ionicons name="refresh-outline" size={16} color="#f59e0b" />
                          </TouchableOpacity>
                        )}
                        {code.status === 'active' && (
                          <TouchableOpacity 
                            style={[styles.revokeBtnSmall, { backgroundColor: '#ef444415' }]} 
                            onPress={() => handleRevoke(code.code)}
                          >
                            <Ionicons name="close" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </Animated.View>

            {/* ── Footer Actions ── */}
            <View style={styles.footerActions}>
              {isOnboarding ? (
                <>
                  {!generatedCode && (
                    <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                      <Text style={[styles.skipText, isDark && { color: '#64748b' }]}>Skip for now</Text>
                      <Text style={[styles.skipSub, isDark && { color: '#475569' }]}>You can always add later in Family settings</Text>
                    </TouchableOpacity>
                  )}
                  {generatedCode && (
                    <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} disabled={isLoading}>
                      <LinearGradient colors={['#10b981', '#059669']} style={styles.continueGradient}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : (
                          <Text style={styles.continueText}>Continue to Dashboard →</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity style={styles.doneBtn} onPress={handleBack}>
                  <Text style={[styles.doneText, isDark && { color: '#94a3b8' }]}>Done</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Signed-in info */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, isDark && { color: '#64748b' }]}>
                Signed in as {userProfile?.fullName}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <Toast {...toast} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

      {/* ── Code Details Modal ── */}
      <CodeDetailsModal
        code={selectedCode}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedCode(null);
        }}
        isDark={isDark}
        primaryColor={dynamicPrimary}
        onResendPartial={handleResendPartial}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const InputRow = ({ icon, placeholder, value, onChangeText, themeColor, isDark, keyboardType, autoCapitalize }: any) => (
  <View style={[styles.inputRow, isDark && styles.inputRowDark]}>
    <Ionicons name={icon} size={18} color={themeColor} style={{ marginRight: 10, opacity: 0.8 }} />
    <TextInput
      style={[styles.input, isDark && styles.textDark]}
      placeholder={placeholder}
      placeholderTextColor={isDark ? '#64748b' : themeColor + '80'}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize || 'words'}
    />
  </View>
);

const ShareButton = ({ icon, label, color, onPress }: any) => (
  <TouchableOpacity style={styles.shareBtn} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.shareIconBg, { backgroundColor: color + '12' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.shareLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22 },
  textDark: { color: '#fff' },

  /* Toast */
  toast: {
    position: 'absolute', top: 60, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 10, zIndex: 999,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Header */
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  backBtn: {
    width: 46, height: 46, borderRadius: 14, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  backBtnDark: { backgroundColor: 'rgba(40,40,50,0.6)', borderColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.3 },

  /* Hero */
  hero: { alignItems: 'center', marginBottom: 28 },
  avatarWrapper: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  pulseRing: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 1.5 },
  iconContainer: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(102,126,234,0.08)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(102,126,234,0.25)',
  },
  badge: {
    position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff',
  },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', letterSpacing: -0.8, marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, maxWidth: 300, fontWeight: '500' },

  /* Sections */
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: '#64748b', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 12, marginLeft: 4,
  },

  /* Role Cards */
  roleCards: { gap: 10 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1.5, borderColor: 'transparent',
  },
  roleCardDark: { backgroundColor: 'rgba(30,30,40,0.4)' },
  roleCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleCardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.2, marginBottom: 2 },
  roleCardDesc: { fontSize: 12, fontWeight: '500', color: '#94a3b8', lineHeight: 17 },
  roleCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },

  /* Form */
  formCard: {
    borderRadius: 24, padding: 20, backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden', gap: 12,
  },
  formCardDark: { backgroundColor: 'rgba(30,30,40,0.3)', borderColor: 'rgba(255,255,255,0.05)' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 14, paddingHorizontal: 14, height: 54, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  inputRowDark: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 4 },
  infoPillText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#64748b', lineHeight: 17 },

  /* Generate */
  generateBtn: {
    borderRadius: 18, overflow: 'hidden', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10, marginTop: 4,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, gap: 10 },
  generateText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },

  /* Success / Code */
  codeCard: {
    borderRadius: 28, padding: 26, backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', gap: 12, overflow: 'hidden',
  },
  codeCardDark: { backgroundColor: 'rgba(30,30,40,0.4)', borderColor: 'rgba(255,255,255,0.06)' },
  checkBurst: { marginBottom: 2 },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12,
  },
  codeLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 2, marginTop: 4 },
  codeText: { fontSize: 34, fontWeight: '900', letterSpacing: 8, textAlign: 'center' },
  qrWrap: { 
    padding: 12, 
    borderRadius: 16, 
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.06)', 
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrapDark: { 
    backgroundColor: '#1a1a2e', 
    borderColor: 'rgba(255,255,255,0.08)' 
  },
  codeSub: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8, width: '100%' },
  shareBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
  shareIconBg: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shareLabel: { fontSize: 11, fontWeight: '700' },
  resetBtn: { marginTop: 8, padding: 8 },
  resetText: { fontSize: 13, fontWeight: '800' },

  /* Active Codes List */
  activeCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderRadius: 14,
  },
  activeCodeRowPartial: {
    backgroundColor: 'rgba(245,158,11,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
  },
  activeCodeTouchable: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  activeCodeRowDark: { 
    backgroundColor: 'rgba(255,255,255,0.03)' 
  },
  activeCodeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4,
    flexShrink: 0,
  },
  activeCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  activeCodeText: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#1a1a1a',
    letterSpacing: 2,
  },
  activeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  activeCodeMeta: { 
    fontSize: 12, 
    fontWeight: '500', 
    color: '#94a3b8',
    marginTop: 2,
  },
  activeCodeUserInfo: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  activeCodePartial: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  activeCodeExpiry: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  activeCodeActions: {
    flexDirection: 'row',
    gap: 4,
  },
  revokeBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resendBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  emptyStateDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 8,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 2,
  },

  /* Footer Actions */
  footerActions: { marginTop: 8, marginBottom: 16, gap: 12 },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: '#94a3b8', fontSize: 15, fontWeight: '700' },
  skipSub: { color: '#cbd5e1', fontSize: 12, fontWeight: '500', marginTop: 4 },
  continueBtn: {
    borderRadius: 18, overflow: 'hidden', shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  continueGradient: { paddingVertical: 16, alignItems: 'center' },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  doneBtn: { alignItems: 'center', paddingVertical: 12 },
  doneText: { color: '#94a3b8', fontSize: 15, fontWeight: '700' },

  /* Footer */
  footer: { alignItems: 'center', marginTop: 4, marginBottom: 20 },
  footerText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  /* ─── Modal Styles ─── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalContentDark: {
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalCodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    backgroundColor: 'rgba(102,126,234,0.03)',
    marginBottom: 16,
  },
  modalCodeText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalDetailsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  detailItemDark: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalQrSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
  },
  modalQrWrap: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalQrWrapDark: {
    backgroundColor: '#1a1a2e',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* ─── Partial Modal Warning ─── */
  partialModalWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  partialModalWarningText: {
    fontSize: 14,
    fontWeight: '700',
  },
  partialModalSubtext: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  partialUserInfo: {
    marginTop: 8,
    paddingLeft: 4,
  },
  partialUserInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  partialInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  partialInfoText: {
    fontSize: 13,
    fontWeight: '500',
  },
});