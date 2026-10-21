import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import Animated, { FadeInUp, FadeInDown, SlideInRight } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../context/AuthContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';

type ForgotPasswordScreenProps = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;
const { width } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════════ */

const AURA = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
};

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({
  children, style, colors = ['#ffffff', '#fbcfe8', '#c7d2fe'],
}: {
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return (
          <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>
            {l}
          </Text>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false);

  // PIN-based recovery state
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [recoveryViaPin, setRecoveryViaPin] = useState(false);
  const { resetUnlockLock, settings: securitySettings, rehydratePinStatus } = useSecurity();
  const { forgotPassword, resetPasswordWithPin } = useAuth();
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const { toast, error: showError, success: showSuccess, info: showInfo } = useSweetAlert();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    resetUnlockLock();
    const unsubscribe = navigation.addListener('focus', () => resetUnlockLock());
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  useEffect(() => {
    const checkSecurityStatus = async () => {
      // Re-read PIN hash directly from SecureStore so we never show stale
      // "no PIN set up" when the user just created one.
      const pinSet = await rehydratePinStatus().catch(() => securitySettings.isPinEnabled);
      setHasPin(!!pinSet);

      try {
        const questionsStr = await AsyncStorage.getItem('littleloom_security_questions');
        setHasSecurityQuestions(!!questionsStr);
      } catch {
        setHasSecurityQuestions(false);
      }
    };
    checkSecurityStatus();
  }, [securitySettings.isPinEnabled, rehydratePinStatus]);

  // ── Email recovery (now actually hits Supabase) ────────────────────
  const handleReset = async () => {
    if (!email) {
      showError('Missing Email', 'Please enter your email address');
      triggerHaptic('error');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setSent(true);
        showSuccess('Email Sent!', result.message || 'Check your inbox for reset instructions');
      } else {
        showError('Reset Failed', result.message);
      }
    } catch {
      showError('Reset Failed', 'Could not send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── PIN-based recovery ─────────────────────────────────────────────
  const handlePinModeEnter = () => {
    if (!hasPin) {
      showInfo('No PIN Set', 'This device has no PIN yet. Use email recovery instead.');
      return;
    }
    setPinMode(true);
  };

  const handlePinReset = async () => {
    if (!email) {
      showError('Missing Email', 'Enter the account email you are recovering');
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      showError('Invalid PIN', 'PIN must be 4-6 digits');
      return;
    }
    if (newPassword.length < 8) {
      showError('Weak Password', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');
    try {
      const result = await resetPasswordWithPin(email, pin, newPassword);
      if (result.success) {
        showSuccess('Password Reset', result.message);
        // Track that this was a PIN recovery so the success screen
        // shows the right copy (no email was sent).
        setRecoveryViaPin(true);
        setSent(true);
      } else {
        showError('Recovery Failed', result.message);
      }
    } catch {
      showError('Recovery Failed', 'Could not reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Aura gradient */}
      <LinearGradient
        colors={isDark
          ? ['#0c0a09', '#1a1428', '#0c0a09']
          : ['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Aura glows */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown} style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, isDark && styles.backButtonDark]}
              onPress={() => (pinMode ? setPinMode(false) : navigation.goBack())}
            >
              <Ionicons name="chevron-back" size={24} color={isDark ? AURA.white : AURA.primary} />
            </TouchableOpacity>
          </Animated.View>

          {!sent ? (
            <Animated.View entering={FadeInUp.delay(200)}>
              <View style={styles.titleContainer}>
                <View style={styles.logoFloatWrap}>
                  <View style={styles.logoGlow} />
                  <Image
                    source={require('../../../assets/logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <GradientText colors={['#ffffff', '#fbcfe8', '#c7d2fe']} style={styles.logoText}>
                  LittleLoom
                </GradientText>
                <Text style={styles.logoTagline}>
                  {pinMode ? 'PIN Recovery' : 'Account Recovery'}
                </Text>
              </View>

              <View style={styles.formContainer}>
                <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
                  <LinearGradient
                    colors={
                      isDark
                        ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                        : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']
                    }
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />

                  {/* ── PIN RECOVERY MODE ─────────────────────────────── */}
                  {pinMode ? (
                    <>
                      <View style={styles.recoverySection}>
                        <View style={styles.sectionHeader}>
                          <Ionicons name="keypad-outline" size={24} color={AURA.accent} />
                          <Text style={[styles.sectionTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                            Recover with PIN
                          </Text>
                        </View>
                        <Text style={[styles.sectionDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          Verify your identity with the PIN you set up on this device.
                        </Text>

                        <View style={[
                          styles.inputContainer,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                          },
                        ]}>
                          <Ionicons name="mail-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                            placeholder="Account email"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!isLoading}
                          />
                        </View>

                        <View style={[
                          styles.inputContainer,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(236,72,153,0.06)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(236,72,153,0.15)',
                          },
                        ]}>
                          <Ionicons name="keypad-outline" size={20} color={AURA.accent} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.input, { color: isDark ? AURA.white : AURA.gray900, letterSpacing: 6 }]}
                            placeholder="4-6 digit PIN"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(236,72,153,0.5)'}
                            value={pin}
                            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 6))}
                            keyboardType="number-pad"
                            maxLength={6}
                            secureTextEntry
                            editable={!isLoading}
                          />
                        </View>

                        <View style={[
                          styles.inputContainer,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                          },
                        ]}>
                          <Ionicons name="lock-closed-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                            placeholder="New password (min 8 chars)"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showPwd}
                            editable={!isLoading}
                          />
                          <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{ padding: 4 }}>
                            <Ionicons name={showPwd ? 'eye-outline' : 'eye-off-outline'} size={20} color={AURA.primary} />
                          </TouchableOpacity>
                        </View>

                        <View style={[
                          styles.inputContainer,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                          },
                        ]}>
                          <Ionicons name="shield-checkmark-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                            placeholder="Confirm new password"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPwd}
                            editable={!isLoading}
                          />
                        </View>

                        <TouchableOpacity
                          style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                          onPress={handlePinReset}
                          disabled={isLoading}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={[AURA.primary, AURA.accent]}
                            style={styles.resetGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            {isLoading ? (
                              <ActivityIndicator color={AURA.white} size="small" />
                            ) : (
                              <Text style={styles.resetText}>Recover Account</Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setPinMode(false)}
                          style={{ marginTop: 16, alignItems: 'center' }}
                        >
                          <Text style={{ color: isDark ? AURA.primaryLight : AURA.primary, fontWeight: '700' }}>
                            Use email recovery instead
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      {/* ── EMAIL RECOVERY ──────────────────────────────── */}
                      <View style={styles.recoverySection}>
                        <View style={styles.sectionHeader}>
                          <Ionicons name="mail-outline" size={24} color={AURA.primary} />
                          <Text style={[styles.sectionTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                            Email Recovery
                          </Text>
                        </View>
                        <Text style={[styles.sectionDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          Reset your password via email
                        </Text>

                        <View style={[
                          styles.inputContainer,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                          },
                        ]}>
                          <Ionicons name="mail-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                            placeholder="Email address"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
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
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={[AURA.primary, AURA.accent]}
                            style={styles.resetGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            {isLoading ? (
                              <ActivityIndicator color={AURA.white} size="small" />
                            ) : (
                              <Text style={styles.resetText}>Send Reset Link</Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>OR</Text>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                      </View>

                      {/* ── PIN RECOVERY ENTRYPOINT ─────────────────────── */}
                      <View style={styles.recoverySection}>
                        <View style={styles.sectionHeader}>
                          <Ionicons name="keypad-outline" size={24} color={AURA.accent} />
                          <Text style={[styles.sectionTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                            PIN Recovery
                          </Text>
                        </View>
                        <Text style={[styles.sectionDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          {hasPin
                            ? 'Recover your account using the PIN set on this device'
                            : 'No PIN is set up on this device — use email recovery'}
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.pinResetButton,
                            !hasPin && styles.pinResetButtonDisabled,
                            { borderColor: hasPin ? `${AURA.accent}4D` : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') },
                          ]}
                          onPress={handlePinModeEnter}
                          disabled={!hasPin || isLoading}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={hasPin ? [AURA.primary, AURA.accent] : ['#94a3b8', '#64748b']}
                            style={styles.pinResetGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Ionicons name="key-outline" size={18} color={AURA.white} style={{ marginRight: 8 }} />
                            <Text style={styles.pinResetText}>Recover with PIN</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </BlurView>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={SlideInRight} style={styles.successContainer}>
              <BlurView intensity={isDark ? 40 : 80} style={styles.successCard} tint={isDark ? 'dark' : 'light'}>
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                      : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']
                  }
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />

                <View style={styles.successIconContainer}>
                  <LinearGradient colors={[AURA.success, '#059669']} style={styles.successIconBg}>
                    <Ionicons name="mail-open-outline" size={40} color={AURA.white} />
                  </LinearGradient>
                </View>

                <Text style={[styles.successTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                  {recoveryViaPin ? 'Password Reset!' : 'Check Your Email!'}
                </Text>
                {recoveryViaPin ? (
                  <Text style={[styles.successText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                    Your password has been changed.{'\n'}
                    Sign in with your new password to continue.
                  </Text>
                ) : (
                  <Text style={[styles.successText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                    We've sent recovery instructions to{'\n'}
                    <Text style={[styles.successEmail, { color: isDark ? AURA.primaryLight : AURA.primary }]}>{email}</Text>
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.backToLogin, {
                    borderColor: isDark ? `${AURA.primaryLight}4D` : `${AURA.primary}4D`,
                    backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                  }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={[styles.backToLoginText, { color: isDark ? AURA.primaryLight : AURA.primary }]}>
                    Back to Login
                  </Text>
                </TouchableOpacity>
              </BlurView>
            </Animated.View>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },

  auraGlowTopLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  auraGlowBottomRight: {
    position: 'absolute',
    bottom: -140,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
  },

  header: { marginTop: 20, marginBottom: 20 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  backButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },

  titleContainer: { alignItems: 'center', marginBottom: 30 },
  logoFloatWrap: {
    width: Math.min(width * 0.28, 120),
    height: Math.min(width * 0.28, 120),
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: '100%', height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoImage: {
    width: Math.min(width * 0.25, 100),
    height: Math.min(width * 0.25, 100),
  },
  logoText: {
    fontSize: 28, fontWeight: '800', letterSpacing: 1,
    marginBottom: 4, textAlign: 'center',
  },
  logoTagline: {
    fontSize: 14, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', paddingHorizontal: 20, lineHeight: 22,
    fontWeight: '500',
  },

  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  glassCard: {
    borderRadius: 28, padding: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },

  recoverySection: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionDesc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },

  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, paddingHorizontal: 16, height: 54,
    borderWidth: 1, marginBottom: 14,
  },
  inputContainerDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },

  resetButton: { borderRadius: 16, overflow: 'hidden' },
  resetButtonDisabled: { opacity: 0.6 },
  resetGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  resetText: {
    color: AURA.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.4,
  },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(99,102,241,0.2)' },
  dividerText: { fontSize: 13, fontWeight: '700', marginHorizontal: 16 },

  pinResetButton: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  pinResetButtonDisabled: { opacity: 0.5 },
  pinResetGradient: {
    paddingVertical: 15, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  pinResetText: {
    color: AURA.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.4,
  },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  successCard: {
    width: '100%', maxWidth: 400, borderRadius: 28, padding: 32,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
  },
  successIconContainer: { marginBottom: 24 },
  successIconBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: AURA.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  successTitle: {
    fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center',
  },
  successText: {
    fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28,
  },
  successEmail: { fontWeight: '800' },
  backToLogin: {
    paddingVertical: 15, paddingHorizontal: 32,
    borderRadius: 16, borderWidth: 1,
  },
  backToLoginText: { fontSize: 16, fontWeight: '800' },
});