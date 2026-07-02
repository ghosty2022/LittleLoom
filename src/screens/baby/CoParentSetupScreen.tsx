import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,        // ← ADD THIS
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
import { useFamily } from '../../context/FamilyContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';

import { SafeAvatar } from '../../components/SafeAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Parent2Setup'>;

const SweetAlert = ({ visible, type, title, message, onClose, isDark, themeColor }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => onClose());
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

export default function CoParentSetupScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: () => {}, type: 'default' });

  const { completeSetup, skipSetup } = useAuth();
  const { inviteMember } = useFamily();
  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    shouldReduceMotion,
    triggerHaptic,
    spinnerColor,
  } = useCustomization();

  const dynamicPrimary = themeColors.primary;
  const dynamicSecondary = themeColors.secondary;
  const dynamicGradient = [dynamicPrimary, dynamicSecondary] as [string, string];

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  const handleAddParent = useCallback(async () => {
    if (!fullName.trim() || !email.trim()) {
      showToast('error', 'Missing Info', 'Please enter name and email');
      return;
    }

    triggerHaptic('medium');
    setIsLoading(true);

    try {
      await inviteMember(email.trim(), 'parent2' as any, 'Co-Parent');
      await completeSetup('parent2');

      showToast('success', 'Invitation Sent! 🎉', 'Your co-parent will receive an email');

      setTimeout(() => navigation.replace('BabyOptional'), 1500);
    } catch (error) {
      showToast('error', 'Error', 'Failed to send invitation');
      setIsLoading(false);
    }
  }, [fullName, email, inviteMember, completeSetup, navigation, showToast, triggerHaptic]);

  const handleSkip = useCallback(() => {
    triggerHaptic('light');
    setConfirmModal({
      visible: true,
      title: 'Skip Adding Co-Parent?',
      message: 'You can always add a co-parent later from settings.',
      type: 'default',
      onConfirm: async () => {
        try {
          await skipSetup('parent2');
          showToast('info', 'Skipped', 'You can add a co-parent later');
          setTimeout(() => {
            navigation.replace('BabyOptional');
          }, 500);
        } catch (error) {
          showToast('error', 'Error', 'Could not continue');
        }
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  }, [navigation, skipSetup, showToast, triggerHaptic]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']}
        style={styles.gradient}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <AutoHideAnimatedScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
          >
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

            <AnimatedReanimated.View
              entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)}
              style={styles.formContainer}
            >
              <BlurView intensity={60} style={styles.glassCard}>
                <Text style={[styles.formTitle, isDark && styles.textDark]}>Partner Details</Text>

                <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                  <Ionicons name="person-outline" size={20} color={dynamicPrimary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    placeholder="Full Name"
                    placeholderTextColor={isDark ? '#64748b' : dynamicPrimary + '99'}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    editable={!isLoading}
                    returnKeyType="next"
                  />
                </View>

                <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                  <Ionicons name="mail-outline" size={20} color={dynamicPrimary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    placeholder="Email Address"
                    placeholderTextColor={isDark ? '#64748b' : dynamicPrimary + '99'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                    returnKeyType="next"
                    autoCorrect={false}
                  />
                </View>

                <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                  <Ionicons name="call-outline" size={20} color={dynamicPrimary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isDark && styles.textDark]}
                    placeholder="Phone Number (Optional)"
                    placeholderTextColor={isDark ? '#64748b' : dynamicPrimary + '99'}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleAddParent}
                  />
                </View>

                <View style={styles.infoContainer}>
                  <Ionicons name="information-circle-outline" size={18} color={dynamicPrimary} />
                  <Text style={[styles.infoText, isDark && { color: '#94a3b8' }]}>
                    An invitation will be sent to this email address
                  </Text>
                </View>

                <TouchableOpacity style={styles.addButton} onPress={handleAddParent} disabled={isLoading}>
                  <LinearGradient colors={dynamicGradient} style={styles.addGradient}>
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send" size={20} color="#fff" />
                        <Text style={styles.addText}>Send Invitation</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                  <Text style={[styles.skipText, isDark && { color: '#64748b' }]}>Skip for now</Text>
                </TouchableOpacity>
              </BlurView>
            </AnimatedReanimated.View>
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <SweetAlert
        {...alert}
        onClose={() => setAlert({ ...alert, visible: false })}
        isDark={isDark}
        themeColor={dynamicPrimary}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },

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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32
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

  formContainer: { flex: 1, justifyContent: 'center' },
  glassCard: {
    borderRadius: 24,
    padding: 28,
    backgroundColor: 'rgba(255,255,255,0.8)'
  },
  formTitle: {
    fontSize: 24,
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

  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16
  },
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

  skipButton: {
    alignItems: 'center',
    paddingVertical: 8
  },
  skipText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600'
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },

  avatarLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});
