import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
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

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isValidPhone = (v: string) => /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(v.trim());
const isValidUsername = (v: string) => v.trim().length >= 3 && /^[a-zA-Z0-9_.]+$/.test(v.trim());

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const [mode, setMode] = useState<'email' | 'pin'>('email');
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [recoveryViaPin, setRecoveryViaPin] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false);

  // PIN fields
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const {
    resetUnlockLock,
    settings: securitySettings,
    rehydratePinStatus,
  } = useSecurity();
  const {
    forgotPassword,
    resetPasswordWithPin,
    findUserByEmail,
    findUserByEmailOrUsernameOrPhone,
  } = useAuth();
  const { darkMode: isDark, triggerHaptic } = useCustomization();
  const { error: showError, success: showSuccess, info: showInfo } = useSweetAlert();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    resetUnlockLock();
    const unsubscribe = navigation.addListener('focus', () => resetUnlockLock());
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  useEffect(() => {
    (async () => {
      const pinSet = await rehydratePinStatus().catch(() => securitySettings.isPinEnabled);
      setHasPin(!!pinSet);
      try {
        const questionsStr = await AsyncStorage.getItem('littleloom_security_questions');
        setHasSecurityQuestions(!!questionsStr);
      } catch {
        setHasSecurityQuestions(false);
      }
    })();
  }, [securitySettings.isPinEnabled, rehydratePinStatus]);

  /* ─── Email (or phone / username) recovery ──────────────────────── */
  const handleEmailReset = async () => {
    if (!identifier.trim()) {
      showError('Missing Info', 'Enter your email, phone number, or username');
      triggerHaptic('error');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');
    try {
      let resolvedEmail = identifier.trim();
      let isEmail = isValidEmail(resolvedEmail);

      if (!isEmail) {
        // Resolve phone / username → email first
        const resolved = await findUserByEmailOrUsernameOrPhone(identifier.trim());
        if (!resolved?.email) {
          showError('Account Not Found', 'No account matches that email, username, or phone number.');
          triggerHaptic('error');
          return;
        }
        resolvedEmail = resolved.email;
        isEmail = true;
      }

      const result = await forgotPassword(resolvedEmail);
      if (result.success) {
        setSentEmail(resolvedEmail);
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

  /* ─── PIN reset (also does recent-password check) ───────────────── */
  const handlePinReset = async () => {
    if (!identifier.trim()) {
      showError('Missing Info', 'Enter your account email or username');
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

    // Reject reuse of the last 3 passwords (checked inside resetPasswordWithPin,
    // but we short-circuit here to give a cleaner message).
    try {
      const recent = await AsyncStorage.getItem('@littleloom_recent_pw_hashes');
      if (recent) {
        const hashes: string[] = JSON.parse(recent);
        const Crypto = require('expo-crypto');
        const newHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          newPassword + 'littleloom_pw_salt_v1',
        );
        if (hashes.includes(newHash)) {
          showError('Password Recently Used', 'Choose a password you haven\'t used in the last 3 changes.');
          triggerHaptic('error');
          return;
        }
      }
    } catch {}

    setIsLoading(true);
    triggerHaptic('medium');
    try {
      let resolvedEmail = identifier.trim();
      if (!isValidEmail(resolvedEmail)) {
        const resolved = await findUserByEmailOrUsernameOrPhone(identifier.trim());
        if (!resolved?.email) {
          showError('Account Not Found', 'No account matches that email or username.');
          return;
        }
        resolvedEmail = resolved.email;
      }

      const result = await resetPasswordWithPin(resolvedEmail, pin, newPassword);
      if (result.success) {
        setSentEmail(resolvedEmail);
        setRecoveryViaPin(true);
        setSent(true);
        showSuccess('Password Reset', result.message);
      } else {
        showError('Recovery Failed', result.message);
      }
    } catch {
      showError('Recovery Failed', 'Could not reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const enterPinMode = () => {
    if (!hasPin) {
      showInfo('No PIN Set', 'This device has no PIN yet. Use email recovery instead.');
      return;
    }
    setMode('pin');
  };

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={isDark ? ['#0c0a09', '#1a1428', '#0c0a09'] : ['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <LinearGradient colors={['rgba(255,255,255,0.22)', 'transparent']} style={styles.auraGlowTopLeft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
      <LinearGradient colors={['rgba(255,255,255,0.14)', 'transparent']} style={styles.auraGlowBottomRight} start={{ x: 1, y: 1 }} end={{ x: 0, y: 0 }} pointerEvents="none" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <Animated.ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown} style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, isDark && styles.backButtonDark]}
              onPress={() => (mode === 'pin' ? setMode('email') : navigation.goBack())}
            >
              <Ionicons name="chevron-back" size={24} color={isDark ? AURA.white : AURA.primary} />
            </TouchableOpacity>
          </Animated.View>

          {!sent ? (
            <Animated.View entering={FadeInUp.delay(200)}>
              <View style={styles.titleContainer}>
                <View style={styles.logoFloatWrap}>
                  <View style={styles.logoGlow} />
                  <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
                </View>
                <GradientText colors={['#ffffff', '#fbcfe8', '#c7d2fe']} style={styles.logoText}>
                  LittleLoom
                </GradientText>
                <Text style={styles.logoTagline}>
                  {mode === 'pin' ? 'PIN Recovery' : 'Account Recovery'}
                </Text>
              </View>

              <View style={styles.formContainer}>
                <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
                  <LinearGradient
                    colors={isDark
                      ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                      : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />

                  {/* Tab switcher */}
                  <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.08)' }]}>
                    <TouchableOpacity
                      style={[styles.tabButton, mode === 'email' && { backgroundColor: AURA.primary }]}
                      onPress={() => setMode('email')}
                      disabled={isLoading}
                    >
                      <Ionicons name="mail-outline" size={16} color={mode === 'email' ? AURA.white : (isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500)} />
                      <Text style={[styles.tabText, { color: mode === 'email' ? AURA.white : (isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500) }]}>Email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tabButton, mode === 'pin' && { backgroundColor: AURA.accent }]}
                      onPress={enterPinMode}
                      disabled={isLoading}
                    >
                      <Ionicons name="keypad-outline" size={16} color={mode === 'pin' ? AURA.white : (isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500)} />
                      <Text style={[styles.tabText, { color: mode === 'pin' ? AURA.white : (isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500) }]}>PIN</Text>
                    </TouchableOpacity>
                  </View>

                  {mode === 'email' ? (
                    <>
                      <Text style={[styles.sectionTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>Reset via Email</Text>
                      <Text style={[styles.sectionDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                        Enter the email, phone number, or username on your account — we'll email you a reset link.
                      </Text>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="person-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Email, phone, or username"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={identifier}
                          onChangeText={setIdentifier}
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isLoading}
                          keyboardType="default"
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                        onPress={handleEmailReset}
                        disabled={isLoading}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={[AURA.primary, AURA.accent]} style={styles.resetGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          {isLoading ? <ActivityIndicator color={AURA.white} size="small" /> : <Text style={styles.resetText}>Send Reset Link</Text>}
                        </LinearGradient>
                      </TouchableOpacity>

                      {hasSecurityQuestions && (
                        <View style={[styles.hintBanner, { backgroundColor: `${AURA.info}15` }]}>
                          <Ionicons name="information-circle-outline" size={18} color={AURA.info} />
                          <Text style={[styles.hintBannerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                            Security questions are set up on this device — you can use those from the lock screen if you're signed in.
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={[styles.sectionTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>Recover with PIN</Text>
                      <Text style={[styles.sectionDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                        Verify your identity with the PIN set on this device. You can't reuse one of your last 3 passwords.
                      </Text>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="person-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Email or username"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={identifier}
                          onChangeText={setIdentifier}
                          autoCapitalize="none"
                          editable={!isLoading}
                        />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(236,72,153,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(236,72,153,0.15)',
                      }]}>
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

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="lock-closed-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="New password (min 8)"
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

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Confirm password"
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
                        <LinearGradient colors={[AURA.primary, AURA.accent]} style={styles.resetGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          {isLoading ? <ActivityIndicator color={AURA.white} size="small" /> : <Text style={styles.resetText}>Reset Password</Text>}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={[styles.hintBanner, { backgroundColor: `${AURA.warning}15` }]}>
                        <Ionicons name="warning-outline" size={18} color={AURA.warning} />
                        <Text style={[styles.hintBannerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          For your security, you can't reuse one of your last 3 passwords.
                        </Text>
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
                  colors={isDark
                    ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                    : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />

                <View style={styles.successIconContainer}>
                  <LinearGradient colors={[AURA.success, '#059669']} style={styles.successIconBg}>
                    <Ionicons name="checkmark-circle-outline" size={40} color={AURA.white} />
                  </LinearGradient>
                </View>

                <Text style={[styles.successTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                  {recoveryViaPin ? 'Password Reset!' : 'Check Your Email!'}
                </Text>
                {recoveryViaPin ? (
                  <Text style={[styles.successText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                    Your password has been changed.{'\n'}Sign in with your new password to continue.
                  </Text>
                ) : (
                  <Text style={[styles.successText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                    We've sent recovery instructions to{'\n'}
                    <Text style={[styles.successEmail, { color: isDark ? AURA.primaryLight : AURA.primary }]}>{sentEmail}</Text>
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.backToLogin, {
                    borderColor: isDark ? `${AURA.primaryLight}4D` : `${AURA.primary}4D`,
                    backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                  }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={[styles.backToLoginText, { color: isDark ? AURA.primaryLight : AURA.primary }]}>Back to Login</Text>
                </TouchableOpacity>
              </BlurView>
            </Animated.View>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  auraGlowTopLeft: { position: 'absolute', top: -120, left: -100, width: 340, height: 340, borderRadius: 170 },
  auraGlowBottomRight: { position: 'absolute', bottom: -140, right: -120, width: 360, height: 360, borderRadius: 180 },

  header: { marginTop: 20, marginBottom: 20 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  backButtonDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' },

  titleContainer: { alignItems: 'center', marginBottom: 28 },
  logoFloatWrap: {
    width: Math.min(width * 0.28, 120), height: Math.min(width * 0.28, 120),
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative',
  },
  logoGlow: { position: 'absolute', width: '100%', height: '100%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  logoImage: { width: Math.min(width * 0.25, 100), height: Math.min(width * 0.25, 100) },
  logoText: { fontSize: 28, fontWeight: '800', letterSpacing: 1, marginBottom: 4, textAlign: 'center' },
  logoTagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: 20, lineHeight: 22, fontWeight: '500' },

  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  glassCard: { borderRadius: 28, padding: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

  tabContainer: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 18 },
  tabButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  tabText: { fontSize: 13, fontWeight: '700' },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  sectionDesc: { fontSize: 13, lineHeight: 19, marginBottom: 16 },

  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, paddingHorizontal: 16, height: 54,
    borderWidth: 1, marginBottom: 14,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },

  resetButton: { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  resetButtonDisabled: { opacity: 0.6 },
  resetGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: AURA.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  hintBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 12, marginTop: 14,
  },
  hintBannerText: { flex: 1, fontSize: 12, lineHeight: 17 },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  successCard: {
    width: '100%', maxWidth: 400, borderRadius: 28, padding: 32,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
  },
  successIconContainer: { marginBottom: 24 },
  successIconBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: AURA.success, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  successTitle: { fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  successText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  successEmail: { fontWeight: '800' },
  backToLogin: { paddingVertical: 15, paddingHorizontal: 32, borderRadius: 16, borderWidth: 1 },
  backToLoginText: { fontSize: 16, fontWeight: '800' },
});