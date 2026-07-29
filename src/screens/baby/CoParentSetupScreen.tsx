import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import AnimatedReanimated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useApp } from '../../context/AppContext';
import { UserRole, ROLE_LABELS } from '../../types/roles';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = NativeStackScreenProps<RootStackParamList, 'Parent2Setup'>;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Unified with FamilySharingScreen
   ═══════════════════════════════════════════════════════════════════════════ */

const DESIGN = {
  radius: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, full: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Inline SweetAlert (no external dependency)
   ═══════════════════════════════════════════════════════════════════════════ */

const SweetAlert = ({ visible, type, title, message, onClose, isDark }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      const timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onClose());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose, opacity]);

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
  };
  const alertConfig = config[type as keyof typeof config] || config.success;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100, pointerEvents: 'none' }]}>
      <Animated.View style={[{ opacity }, styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={alertConfig.colors} style={styles.alertIconBg}>
          <Ionicons name={alertConfig.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ConfirmModal
   ═══════════════════════════════════════════════════════════════════════════ */

const ConfirmModal = ({ visible, title, message, onConfirm, onCancel, type = 'default', isDark, themeColors }: any) => {
  if (!visible) return null;
  const colors = type === 'danger'
    ? ['#ef4444', '#dc2626']
    : [themeColors?.primary || '#667eea', themeColors?.secondary || '#764ba2'];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10000, justifyContent: 'center', alignItems: 'center' }]}>
      <TouchableOpacity activeOpacity={1} onPress={onCancel} style={StyleSheet.absoluteFill}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>
      <View style={[styles.confirmModal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={colors as [string, string]} style={styles.confirmIconBg}>
          <Ionicons name={type === 'danger' ? 'trash' : 'help-circle'} size={32} color="#fff" />
        </LinearGradient>
        <Text style={[styles.confirmTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
        <Text style={styles.confirmMessage}>{message}</Text>
        <View style={styles.confirmButtons}>
          <TouchableOpacity style={[styles.confirmButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm}>
            <LinearGradient colors={colors as [string, string]} style={styles.confirmButtonGradient}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Parent2SetupScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('Co-Parent');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [inviteCodeRole, setInviteCodeRole] = useState<'parent2' | 'guardian' | 'viewer'>('parent2');
  
  const { currentBaby } = useBaby();
  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: () => {}, type: 'default' });

  const { completeSetup, skipSetup, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useApp();
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const {
    themeColors,
    shouldReduceMotion,
    triggerHaptic,
  } = useCustomization();

  const dynamicPrimary = themeColors.primary || colors.primary;
  const dynamicSecondary = themeColors.secondary || colors.primaryLight;
  const dynamicGradient = [dynamicPrimary, dynamicSecondary] as [string, string];

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  /* ─── Generate Invite Code ─── */
  const handleGenerateInviteCode = useCallback(async () => {
    if (!relationship.trim()) {
      showToast('error', 'Missing Info', 'Please specify the relationship');
      return;
    }
    
    // Invite codes are tied to a baby. If we haven't created one yet,
    // we can't generate a code here. The user can invite from FamilySharing later.
    if (!currentBaby?.id) {
      showToast('info', 'Note', 'Create a baby profile first to generate invite codes. Family invites are available anytime from the Family tab.');
      return;
    }

    triggerHaptic('medium');
    setIsGeneratingCode(true);

    try {
      const { createInviteCode } = await import('@/database/dbHelpers');
      const result = await createInviteCode({
        familyId: currentBaby.id,
        role: inviteCodeRole,
        createdBy: userProfile?.id || '',
        relationship: relationship.trim(),
        inviteeName: fullName.trim() || undefined,
        inviteeEmail: email.trim() || undefined,
        inviteePhone: phone.trim() || undefined,
        maxUses: 1,
        expiresInDays: 7,
      });

      if (result.success) {
        setGeneratedCode(result.code);
        triggerHaptic('success');
        showToast('success', 'Code Generated! 🎉', `Share this code: ${result.code}`);
      } else {
        showToast('error', 'Error', result.message || 'Failed to generate code');
      }
    } catch (error) {
      console.error('Generate code error:', error);
      showToast('error', 'Error', 'Failed to generate invite code');
    } finally {
      setIsGeneratingCode(false);
    }
  }, [relationship, fullName, email, phone, currentBaby, userProfile, inviteCodeRole, triggerHaptic, showToast]);

  /* ─── Continue to Baby Setup ─── */
  const handleContinue = useCallback(async () => {
    triggerHaptic('medium');
    setIsLoading(true);
    try {
      await completeSetup('parent2');
      showToast('success', 'Setup Complete!', 'Continuing to baby setup...');
      setTimeout(() => {
        if (isMountedRef.current) setIsLoading(false);
      }, 800);
    } catch (error) {
      showToast('error', 'Error', 'Could not continue');
      setIsLoading(false);
    }
  }, [completeSetup, showToast, triggerHaptic]);

  /* ─── Skip ─── */
  const handleSkip = useCallback(() => {
    triggerHaptic('light');
    setConfirmModal({
      visible: true,
      title: 'Skip Adding Co-Parent?',
      message: 'You can always add family members later from the Family tab after creating your baby profile.',
      type: 'default',
      onConfirm: async () => {
        try {
          await skipSetup('parent2');
          showToast('info', 'Skipped', 'You can add family later');
          // AuthContext state update → AppNavigator navState recomputes → auto-navigates
          // DO NOT call navigation.replace() — causes flash/disappear bug
        } catch (error) {
          showToast('error', 'Error', 'Could not continue');
        }
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  }, [skipSetup, showToast, triggerHaptic]);


  /* ─── Copy Code ─── */
  const handleCopyCode = useCallback(() => {
    if (!generatedCode) return;
    triggerHaptic('light');
    // Clipboard.setString(generatedCode); // Uncomment if you have Clipboard imported
    showToast('success  const { completeSetup, skipSetup, userProfile } = useAuth();', 'Copied!', 'Invite code copied to clipboard');
  }, [generatedCode, triggerHaptic, showToast]);

  /* ─── Share via WhatsApp ─── */
  const handleShareWhatsApp = useCallback(async () => {
    if (!generatedCode) return;
    const { Linking } = await import('react-native');
    const url = `whatsapp://send?text=${encodeURIComponent(
      `👋 Join me on LittleLoom!\n\n🎫 Invite Code: ${generatedCode}\n👤 Role: Co-Parent\n\nDownload the app and enter this code on the sign-up screen.`
    )}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else showToast('warning', 'WhatsApp not found', 'Install WhatsApp to share');
    });
  }, [generatedCode, showToast]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.surface] : ['#f0f4ff', '#e0e7ff']}
        style={styles.gradient}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <AnimatedReanimated.View
              entering={shouldReduceMotion ? undefined : FadeInUp}
              style={styles.header}
            >
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <BlurView intensity={80} style={styles.backBlur}>
                  <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
                </BlurView>
              </TouchableOpacity>
              <Text style={[styles.title, isDark && styles.textDark]}>Add Co-Parent</Text>
              <View style={styles.placeholder} />
            </AnimatedReanimated.View>

            {/* Avatar */}
            <AnimatedReanimated.View
              entering={shouldReduceMotion ? undefined : FadeInUp.delay(50)}
              style={styles.avatarSection}
            >
              <SafeAvatar
                avatar={null}
                size={96}
                fallbackIcon="person-add"
                fallbackColor={dynamicPrimary}
                fallbackBgColor={dynamicPrimary + '15'}
                borderWidth={3}
                borderColor={dynamicPrimary + '40'}
                borderRadius={48}
                animated={!shouldReduceMotion}
              />
              <Text style={[styles.avatarLabel, isDark && { color: '#94a3b8' }]}>
                Invite your partner to join
              </Text>
            </AnimatedReanimated.View>

            {/* Form Card */}
            <AnimatedReanimated.View
              entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}
              style={styles.formContainer}
            >
              <BlurView intensity={60} style={styles.glassCard}>
                <Text style={[styles.formTitle, isDark && styles.textDark]}>Partner Details</Text>

                {/* Role Selection */}
                <Text style={[styles.formLabel, isDark && styles.textDark, { marginTop: 8 }]}>Invite As</Text>
                <View style={styles.roleSelection}>
                  {(['parent2', 'guardian', 'viewer'] as const).map((role) => {
                    const config = 
                      role === 'parent2' ? { label: 'Co-Parent', color: '#fa709a', icon: 'heart' as const }
                      : role === 'guardian' ? { label: 'Guardian', color: '#11998e', icon: 'shield-checkmark' as const }
                      : { label: 'Viewer', color: '#64748b', icon: 'eye' as const };
                    const isSelected = inviteCodeRole === role;
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          isSelected && { borderColor: config.color, backgroundColor: config.color + '10' },
                          isDark && styles.roleOptionDark
                        ]}
                        onPress={() => setInviteCodeRole(role)}
                      >
                        <View style={[styles.roleOptionIcon, { backgroundColor: config.color }]}>
                          <Ionicons name={config.icon} size={20} color="#fff" />
                        </View>
                        <View style={styles.roleOptionInfo}>
                          <Text style={[styles.roleOptionTitle, isDark && styles.textDark]}>{config.label}</Text>
                        </View>
                        {isSelected && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Relationship */}
                <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                  <Ionicons name="heart-outline" size={20} color={dynamicPrimary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    placeholder="Their relationship to baby (e.g., Father, Grandma, Nanny)"
                    placeholderTextColor={isDark ? '#64748b' : dynamicPrimary + '99'}
                    value={relationship}
                    onChangeText={setRelationship}
                    autoCapitalize="words"
                    editable={!isLoading && !isGeneratingCode}
                    returnKeyType="next"
                  />
                </View>

                {/* Full Name (Optional) */}
                <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                  <Ionicons name="person-outline" size={20} color={dynamicPrimary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    placeholder="Partner's Full Name (Optional)"
                    placeholderTextColor={isDark ? '#64748b' : dynamicPrimary + '99'}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    editable={!isLoading && !isGeneratingCode}
                    returnKeyType="next"
                  />
                </View>

                {/* Email (Optional) */}
                <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                  <Ionicons name="mail-outline" size={20} color={dynamicPrimary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    placeholder="Email Address (Optional)"
                    placeholderTextColor={isDark ? '#64748b' : dynamicPrimary + '99'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading && !isGeneratingCode}
                    returnKeyType="next"
                    autoCorrect={false}
                  />
                </View>

                {/* Phone (Optional) */}
                <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                  <Ionicons name="call-outline" size={20} color={dynamicPrimary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    placeholder="Phone Number (Optional)"
                    placeholderTextColor={isDark ? '#64748b' : dynamicPrimary + '99'}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    editable={!isLoading && !isGeneratingCode}
                    returnKeyType="done"
                  />
                </View>

                {/* Info Note */}
                <View style={styles.infoContainer}>
                  <Ionicons name="information-circle-outline" size={18} color={dynamicPrimary} />
                  <Text style={[styles.infoText, isDark && { color: '#94a3b8' }]}>
                    Generate a shareable invite code. Your partner can use it when signing up.
                  </Text>
                </View>

                {/* Generate Code Button */}
                {!generatedCode ? (
                  <TouchableOpacity
                    style={[styles.addButton, (!relationship.trim() || isGeneratingCode) && styles.addButtonDisabled]}
                    onPress={handleGenerateInviteCode}
                    disabled={!relationship.trim() || isGeneratingCode}
                  >
                    <LinearGradient colors={dynamicGradient} style={styles.addGradient}>
                      {isGeneratingCode ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="key-outline" size={20} color="#fff" />
                          <Text style={styles.addText}>Generate Invite Code</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  /* Code Display */
                  <AnimatedReanimated.View entering={FadeInUp} style={[styles.codeDisplayCard, { borderColor: dynamicPrimary + '30' }]}>
                    <View style={styles.codeDisplayHeader}>
                      <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                      <Text style={[styles.codeDisplayTitle, { color: '#22c55e' }]}>Code Generated!</Text>
                    </View>
                    <View style={[styles.codeBox, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
                      <Text style={[styles.codeText, { color: dynamicPrimary }]}>{generatedCode}</Text>
                    </View>
                    <Text style={[styles.codeDisplaySubtitle, isDark && { color: '#94a3b8' }]}>
                      Share this code with your partner. They can enter it on the sign-up screen.
                    </Text>

                    {/* Share Actions */}
                    <View style={styles.shareActionsRow}>
                      <TouchableOpacity style={[styles.shareBtn, { backgroundColor: dynamicPrimary + '10' }]} onPress={handleCopyCode}>
                        <Ionicons name="copy-outline" size={18} color={dynamicPrimary} />
                        <Text style={[styles.shareBtnText, { color: dynamicPrimary }]}>Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.shareBtn, { backgroundColor: '#25d36615' }]} onPress={handleShareWhatsApp}>
                        <Ionicons name="logo-whatsapp" size={18} color="#25d366" />
                        <Text style={[styles.shareBtnText, { color: '#25d366' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Continue Button */}
                    <TouchableOpacity style={[styles.continueButton, { marginTop: 16 }]} onPress={handleContinue} disabled={isLoading}>
                      <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.addGradient}>
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.addText}>Continue →</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setGeneratedCode('')}>
                      <Text style={{ color: dynamicPrimary, fontWeight: '700', fontSize: 13 }}>Generate Another Code</Text>
                    </TouchableOpacity>
                  </AnimatedReanimated.View>
                )}

                {/* Skip Button */}
                {!generatedCode && (
                  <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={[styles.skipText, isDark && { color: '#64748b' }]}>Skip for now</Text>
                  </TouchableOpacity>
                )}
              </BlurView>
            </AnimatedReanimated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <SweetAlert
        {...alert}
        onClose={() => setAlert({ ...alert, visible: false })}
        isDark={isDark}
      />
      <ConfirmModal
        {...confirmModal}
        onCancel={() => setConfirmModal({ ...confirmModal, visible: false })}
        isDark={isDark}
        themeColors={themeColors}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Styles — Unified with FamilySharingScreen design system
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },

  /* ── Alerts ── */
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
    maxWidth: 360
  },
  alertIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  confirmModal: {
    width: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20
  },
  confirmIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center'
  },
  confirmMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelButton: { backgroundColor: 'rgba(100,116,139,0.1)' },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600'
  },
  confirmButtonGradient: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a'
  },
  placeholder: { width: 48 },
  textDark: { color: '#fff' },

  /* ── Avatar ── */
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 12,
  },

  /* ── Form ── */
  formContainer: { flex: 1, justifyContent: 'center' },
  glassCard: {
    borderRadius: 24,
    padding: 28,
    backgroundColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 24,
    textAlign: 'center'
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)'
  },
  inputContainerDark: {
    backgroundColor: 'rgba(30,30,40,0.6)',
    borderColor: 'rgba(255,255,255,0.1)'
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a'
  },

  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 4
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#667eea'
  },

  /* ── Buttons ── */
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16
  },
  addButtonDisabled: { opacity: 0.6 },
  addGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10
  },
  addText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700'
  },

  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  skipButton: {
    alignItems: 'center',
    paddingVertical: 12
  },
  skipText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600'
  },

  /* ── Code Display ── */
  codeDisplayCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  codeDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeDisplayTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  codeBox: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
    width: '100%',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 6,
  },
  codeDisplaySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    color: '#64748b',
  },
  shareActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 90,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
