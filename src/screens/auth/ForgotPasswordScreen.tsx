import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInDown, SlideInRight } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ForgotPasswordScreenProps = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const SweetAlert = ({ visible, type, title, message, isDark }: AlertState & { isDark: boolean }) => {
  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100, pointerEvents: 'none' }]}>
      <Animated.View entering={FadeInDown} style={[styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [hasPin, setHasPin] = useState(false);
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false);

  const { resetUnlockLock, settings: securitySettings } = useSecurity();
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    resetUnlockLock();

    const unsubscribe = navigation.addListener('focus', () => {
      resetUnlockLock();
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  // Check if PIN and security questions are set up
  useEffect(() => {
    const checkSecurityStatus = async () => {
      const pinSet = securitySettings.isPinEnabled;
      setHasPin(pinSet);

      try {
        const questionsStr = await AsyncStorage.getItem('littleloom_security_questions');
        setHasSecurityQuestions(!!questionsStr);
      } catch (error) {
        setHasSecurityQuestions(false);
      }
    };
    checkSecurityStatus();
  }, [securitySettings.isPinEnabled]);

  const showToast = (type: AlertState['type'], title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
    setTimeout(() => setAlert(prev => ({ ...prev, visible: false })), 3000);
  };

  const handleReset = async () => {
    if (!email) {
      showToast('error', 'Missing Email', 'Please enter your email address');
      triggerHaptic('error');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    setTimeout(() => {
      setIsLoading(false);
      setSent(true);
      showToast('success', 'Email Sent!', 'Check your inbox for reset instructions');
    }, 1500);
  };

  const handlePinReset = () => {
    if (!hasPin) {
      showToast('info', 'No PIN Set', 'You have not set up a PIN yet');
      return;
    }
    if (!hasSecurityQuestions) {
      showToast('warning', 'No Recovery Set', 'Security questions not configured. Set them up first.');
      return;
    }

    // Navigate to SecurityCenter in forgot mode
    navigation.navigate('SecurityCenter', { 
      mode: 'forgot',
      fromForgotPassword: true 
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />

      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : [themeColors.primary, themeColors.secondary, '#f093fb']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <AutoHideScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown} style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, isDark && styles.backButtonDark]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={isDark ? '#fff' : themeColors.primary} />
            </TouchableOpacity>
          </Animated.View>

          {!sent ? (
            <Animated.View entering={FadeInUp.delay(200)}>
              <View style={styles.titleContainer}>
                <View style={[styles.iconCircle, isDark && styles.iconCircleDark]}>
                  <Ionicons name="lock-open-outline" size={32} color={themeColors.primary} />
                </View>
                <Text style={styles.title}>Account Recovery</Text>
                <Text style={styles.subtitle}>
                  Choose how you want to recover your account
                </Text>
              </View>

              <View style={styles.formContainer}>
                <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
                  <LinearGradient
                    colors={isDark ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Email Recovery Section */}
                  <View style={styles.recoverySection}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="mail-outline" size={24} color={themeColors.primary} />
                      <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                        Email Recovery
                      </Text>
                    </View>
                    <Text style={[styles.sectionDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      Reset your password via email
                    </Text>

                    <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                      <Ionicons name="mail-outline" size={20} color={themeColors.primary} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                        placeholder="Email address"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : `${themeColors.primary}99`}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!isLoading}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                      onPress={handleReset}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[themeColors.primary, themeColors.secondary]}
                        style={styles.resetGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <Text style={styles.resetText}>Send Reset Link</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Divider */}
                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                    <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>OR</Text>
                    <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                  </View>

                  {/* PIN Recovery Section */}
                  <View style={styles.recoverySection}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="keypad-outline" size={24} color={themeColors.secondary} />
                      <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
                        PIN Recovery
                      </Text>
                    </View>
                    <Text style={[styles.sectionDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {hasPin 
                        ? hasSecurityQuestions 
                          ? 'Reset your PIN using security questions'
                          : 'Security questions not set up — set them in Settings'
                        : 'No PIN set up yet'}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.pinResetButton,
                        (!hasPin || !hasSecurityQuestions) && styles.pinResetButtonDisabled,
                        { borderColor: `${themeColors.secondary}4D` },
                      ]}
                      onPress={handlePinReset}
                      disabled={!hasPin || !hasSecurityQuestions}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={hasPin && hasSecurityQuestions ? [themeColors.secondary, themeColors.accent] : ['#94a3b8', '#64748b']}
                        style={styles.pinResetGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name="key-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.pinResetText}>Reset PIN</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </BlurView>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={SlideInRight} style={styles.successContainer}>
              <BlurView intensity={isDark ? 40 : 80} style={styles.successCard} tint={isDark ? 'dark' : 'light'}>
                <LinearGradient
                  colors={isDark ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.successIconContainer}>
                  <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.successIconBg}>
                    <Ionicons name="mail-open-outline" size={40} color="#fff" />
                  </LinearGradient>
                </View>

                <Text style={[styles.successTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Check Your Email!</Text>
                <Text style={styles.successText}>
                  We've sent password reset instructions to{"\n"}
                  <Text style={[styles.successEmail, { color: themeColors.primary }]}>{email}</Text>
                </Text>

                <TouchableOpacity
                  style={[styles.backToLogin, { borderColor: `${themeColors.primary}4D` }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={[styles.backToLoginText, { color: themeColors.primary }]}>Back to Login</Text>
                </TouchableOpacity>
              </BlurView>
            </Animated.View>
          )}
        </AutoHideScrollView>
      </KeyboardAvoidingView>

      <SweetAlert {...alert} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { ...StyleSheet.absoluteFillObject },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  header: {
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonDark: {
    backgroundColor: 'rgba(30,41,59,0.8)',
  },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  iconCircleDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },

  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCard: {
    borderRadius: 28,
    padding: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },

  // Recovery sections
  recoverySection: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
    marginBottom: 16,
  },
  inputContainerDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  resetButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  resetText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 16,
  },

  // PIN Reset Button
  pinResetButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  pinResetButtonDisabled: {
    opacity: 0.5,
  },
  pinResetGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pinResetText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  successCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    padding: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#11998e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  successEmail: {
    fontWeight: '700',
  },
  backToLogin: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  backToLoginText: {
    fontSize: 16,
    fontWeight: '700',
  },
});