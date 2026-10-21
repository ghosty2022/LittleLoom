import React, { useEffect, useState, useCallback } from 'react';
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
import Animated, {
  FadeInUp,
  FadeInDown,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../context/AuthContext';
import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';

type ForgotPasswordScreenProps = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : STATUS_BAR_HEIGHT + 14;

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DESIGN SYSTEM — shared across all auth screens
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

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText
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
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PressableScale
   ═══════════════════════════════════════════════════════════════════════════ */
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.96 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) onPress?.(); }}
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
   AURA LOGO MARK — animated gradient ring + glow (no hero card)
   ═══════════════════════════════════════════════════════════════════════════ */
const AuraLogo = React.memo(({ size = 96, imageSource }: { size?: number; imageSource: any }) => {
  const rotate = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    rotate.value = withRepeat(withTiming(360, { duration: 12000 }), -1, false);
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1800 }), withTiming(1, { duration: 1800 })),
      -1, true
    );
  }, [rotate, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [1, 1.08], [0.35, 0.55], Extrapolation.CLAMP), transform: [{ scale: pulse.value }] }));

  return (
    <View style={{ width: size + 32, height: size + 32, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glowStyle]}>
        <LinearGradient
          colors={['#6366f1', '#ec4899', '#f59e0b', '#6366f1']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: size + 16, height: size + 16, borderRadius: (size + 16) / 2, opacity: 0.35 }}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, ringStyle]}>
        <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderWidth: 2, borderColor: 'transparent', borderTopColor: '#6366f1', borderRightColor: '#ec4899' }} />
      </Animated.View>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', ...DS.shadow.lg }}>
        <Image source={imageSource} style={{ width: size * 0.72, height: size * 0.72 }} resizeMode="contain" />
      </View>
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   AURORA BACKGROUND DOTS — subtle motion, no hero
   ═══════════════════════════════════════════════════════════════════════════ */
const AuroraDots = React.memo(({ isDark }: { isDark: boolean }) => {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 20000 }), -1, true);
  }, [drift]);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(drift.value, [0, 1], [0, -30], Extrapolation.CLAMP) }],
    opacity: interpolate(drift.value, [0, 1], [0.3, 0.6], Extrapolation.CLAMP),
  }));
  const positions = [
    { x: 0.08, y: 0.15, size: 60, color: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)' },
    { x: 0.85, y: 0.22, size: 80, color: isDark ? 'rgba(236,72,153,0.20)' : 'rgba(236,72,153,0.10)' },
    { x: 0.15, y: 0.75, size: 90, color: isDark ? 'rgba(139,92,246,0.20)' : 'rgba(139,92,246,0.10)' },
    { x: 0.75, y: 0.85, size: 70, color: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.08)' },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {positions.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            {
              position: 'absolute',
              left: SCREEN_W * p.x - p.size / 2,
              top: SCREEN_H * p.y - p.size / 2,
              width: p.size, height: p.size, borderRadius: p.size / 2,
              backgroundColor: p.color,
            },
            dotStyle,
          ]}
        />
      ))}
    </View>
  );
});

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasSecurityQuestions, setHasSecurityQuestions] = useState(false);
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

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { 'worklet'; scrollY.value = e.contentOffset.y; } });

  useEffect(() => {
    resetUnlockLock();
    const unsubscribe = navigation.addListener('focus', () => resetUnlockLock());
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  useEffect(() => {
    const checkSecurityStatus = async () => {
      const pinSet = await rehydratePinStatus().catch(() => securitySettings.isPinEnabled);
      setHasPin(!!pinSet);
      try {
        const questionsStr = await AsyncStorage.getItem('littleloom_security_questions');
        setHasSecurityQuestions(!!questionsStr);
      } catch { setHasSecurityQuestions(false); }
    };
    checkSecurityStatus();
  }, [securitySettings.isPinEnabled, rehydratePinStatus]);

  const handleReset = async () => {
    if (!email) { showError('Missing Email', 'Please enter your email address'); triggerHaptic('error'); return; }
    setIsLoading(true); triggerHaptic('medium');
    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setSent(true);
        showSuccess('Email Sent!', result.message || 'Check your inbox for reset instructions');
      } else { showError('Reset Failed', result.message); }
    } catch { showError('Reset Failed', 'Could not send reset email. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const handlePinModeEnter = () => {
    if (!hasPin) { showInfo('No PIN Set', 'This device has no PIN yet. Use email recovery instead.'); return; }
    setPinMode(true);
  };

  const handlePinReset = async () => {
    if (!email) { showError('Missing Email', 'Enter the account email you are recovering'); return; }
    if (pin.length < 4 || pin.length > 6) { showError('Invalid PIN', 'PIN must be 4-6 digits'); return; }
    if (newPassword.length < 8) { showError('Weak Password', 'New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { showError('Password Mismatch', 'Passwords do not match'); return; }
    setIsLoading(true); triggerHaptic('medium');
    try {
      const result = await resetPasswordWithPin(email, pin, newPassword);
      if (result.success) {
        showSuccess('Password Reset', result.message);
        setRecoveryViaPin(true);
        setSent(true);
      } else { showError('Recovery Failed', result.message); }
    } catch { showError('Recovery Failed', 'Could not reset password. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const bgColors = isDark ? ['#0c0a09', '#12121e', '#0c0a09'] : ['#f8faff', '#eef0f5', '#e4e8f0'];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DS.darkBg : DS.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
      <AuroraDots isDark={isDark} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_TOP_PADDING + 20, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <Animated.View entering={FadeInDown.duration(300)}>
            <PressableScale onPress={() => (pinMode ? setPinMode(false) : navigation.goBack())} activeScale={0.92}>
              <View style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : DS.white, borderColor: isDark ? DS.darkBorder : DS.gray200 }]}>
                <Ionicons name="chevron-back" size={22} color={isDark ? DS.white : DS.gray800} />
              </View>
            </PressableScale>
          </Animated.View>

          {!sent ? (
            <Animated.View entering={FadeInUp.duration(500).springify()}>
              {/* Logo mark */}
              <View style={styles.logoSection}>
                <AuraLogo imageSource={require('../../../assets/logo.png')} size={88} />
                <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.brandTitle}>
                  LittleLoom
                </GradientText>
                <Text style={[styles.brandTagline, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  {pinMode ? 'Secure PIN recovery' : 'Account recovery'}
                </Text>
              </View>

              {/* Mode switch pill (email / pin) */}
              {!pinMode && (
                <View style={[styles.tabPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <View style={[styles.tabPillActive, { backgroundColor: isDark ? DS.darkCard : DS.white, ...DS.shadow.sm }]}>
                    <Ionicons name="mail-outline" size={14} color={themeColors.primary} />
                    <Text style={[styles.tabPillText, { color: themeColors.primary }]}>Email</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.tabPillItem}
                    onPress={handlePinModeEnter}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="keypad-outline" size={14} color={isDark ? DS.gray400 : DS.gray500} />
                    <Text style={[styles.tabPillText, { color: isDark ? DS.gray400 : DS.gray500 }]}>PIN</Text>
                  </TouchableOpacity>
                </View>
              )}

              {pinMode && (
                <View style={[styles.pinModeBanner, { backgroundColor: `${themeColors.secondary}10`, borderColor: `${themeColors.secondary}30` }]}>
                  <Ionicons name="shield-checkmark" size={16} color={themeColors.secondary} />
                  <Text style={[styles.pinModeText, { color: themeColors.secondary }]}>PIN-based recovery active</Text>
                  <TouchableOpacity onPress={() => setPinMode(false)} style={{ marginLeft: 'auto', padding: 4 }}>
                    <Ionicons name="close" size={16} color={themeColors.secondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Glass form card */}
              <View style={styles.card}>
                <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
                  <LinearGradient
                    colors={isDark ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />

                  {/* Header inside card */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIconWrap, { backgroundColor: pinMode ? `${themeColors.secondary}18` : `${themeColors.primary}18` }]}>
                      <Ionicons
                        name={pinMode ? 'keypad-outline' : 'mail-outline'}
                        size={22}
                        color={pinMode ? themeColors.secondary : themeColors.primary}
                      />
                    </View>
                    <Text style={[styles.cardTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                      {pinMode ? 'Recover with PIN' : 'Reset your password'}
                    </Text>
                    <Text style={[styles.cardDesc, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      {pinMode
                        ? 'Verify your identity with the PIN you set up on this device.'
                        : 'Enter the email linked to your LittleLoom account.'}
                    </Text>
                  </View>

                  {/* Email field */}
                  <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                    {pinMode ? 'Account email' : 'Email address'}
                  </Text>
                  <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                    <Ionicons name="mail-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                      placeholder="you@example.com"
                      placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                  </View>

                  {pinMode && (
                    <>
                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>4–6 digit PIN</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="keypad-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900, letterSpacing: 6 }]}
                          placeholder="••••"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={pin}
                          onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 6))}
                          keyboardType="number-pad"
                          maxLength={6}
                          secureTextEntry
                          editable={!isLoading}
                        />
                      </View>

                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>New password</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="lock-closed-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder="Min. 8 characters"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry={!showPwd}
                          editable={!isLoading}
                        />
                        <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{ padding: 4 }}>
                          <Ionicons name={showPwd ? 'eye-outline' : 'eye-off-outline'} size={18} color={isDark ? DS.gray400 : DS.gray500} />
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.fieldLabel, { color: isDark ? DS.gray400 : DS.gray500 }]}>Confirm password</Text>
                      <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={isDark ? DS.gray400 : DS.gray500} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? DS.white : DS.gray900 }]}
                          placeholder="Re-enter password"
                          placeholderTextColor={isDark ? DS.gray600 : DS.gray400}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry={!showPwd}
                          editable={!isLoading}
                        />
                      </View>
                    </>
                  )}

                  {/* Submit */}
                  <PressableScale onPress={pinMode ? handlePinReset : handleReset} disabled={isLoading} activeScale={0.97} style={{ marginTop: DS.space.md }}>
                    <LinearGradient
                      colors={pinMode ? [themeColors.secondary, themeColors.primary] : [themeColors.primary, themeColors.secondary]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.submitBtn}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={DS.white} size="small" />
                      ) : (
                        <>
                          <Ionicons name={pinMode ? 'key-outline' : 'paper-plane-outline'} size={18} color={DS.white} />
                          <Text style={styles.submitText}>{pinMode ? 'Recover Account' : 'Send Reset Link'}</Text>
                        </>
                      )}
                    </LinearGradient>
                  </PressableScale>

                  {/* Footer link */}
                  <TouchableOpacity onPress={() => (pinMode ? setPinMode(false) : handlePinModeEnter())} style={styles.switchLink} disabled={isLoading}>
                    <Text style={[styles.switchLinkText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                      {pinMode ? 'Use email recovery instead' : hasPin ? 'Try PIN recovery instead' : ''}
                    </Text>
                    {!pinMode && hasPin && (
                      <Text style={[styles.switchLinkAccent, { color: themeColors.primary }]}>PIN recovery</Text>
                    )}
                  </TouchableOpacity>
                </BlurView>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={SlideInRight.duration(500)} style={styles.successSection}>
              <AuraLogo imageSource={require('../../../assets/logo.png')} size={80} />
              <View style={styles.successIconCircle}>
                <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.successIconGradient}>
                  <Ionicons name={recoveryViaPin ? 'checkmark-circle' : 'mail-open-outline'} size={36} color={DS.white} />
                </LinearGradient>
              </View>
              <Text style={[styles.successTitle, { color: isDark ? DS.white : DS.gray900 }]}>
                {recoveryViaPin ? 'Password Reset!' : 'Check Your Email'}
              </Text>
              {recoveryViaPin ? (
                <Text style={[styles.successText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  Your password has been changed.{'\n'}Sign in with your new password to continue.
                </Text>
              ) : (
                <Text style={[styles.successText, { color: isDark ? DS.gray400 : DS.gray500 }]}>
                  We've sent recovery instructions to{'\n'}
                  <Text style={{ color: themeColors.primary, fontWeight: '700' }}>{email}</Text>
                </Text>
              )}
              <PressableScale onPress={() => navigation.navigate('Login')} activeScale={0.97} style={{ width: '100%', marginTop: DS.space.lg }}>
                <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.submitBtn}>
                  <Ionicons name="arrow-back" size={18} color={DS.white} />
                  <Text style={styles.submitText}>Back to Login</Text>
                </LinearGradient>
              </PressableScale>
            </Animated.View>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, ...DS.shadow.sm,
  },
  logoSection: { alignItems: 'center', marginTop: DS.space.lg, marginBottom: DS.space.lg },
  brandTitle: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, marginTop: DS.space.sm },
  brandTagline: { fontSize: 13, fontWeight: '500', marginTop: 2 },

  tabPill: {
    flexDirection: 'row', borderRadius: DS.radius.full, padding: 4, marginBottom: DS.space.lg,
    alignSelf: 'center', gap: 4,
  },
  tabPillActive: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: DS.radius.full,
  },
  tabPillItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: DS.radius.full,
  },
  tabPillText: { fontSize: 12, fontWeight: '700' },

  pinModeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: DS.radius.md,
    borderWidth: 1, marginBottom: DS.space.md,
  },
  pinModeText: { fontSize: 12, fontWeight: '600' },

  card: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  glassCard: {
    borderRadius: DS.radius['2xl'], padding: DS.space.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', ...DS.shadow.lg,
  },
  cardHeader: { alignItems: 'center', marginBottom: DS.space.lg },
  cardIconWrap: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.space.sm,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  cardDesc: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },

  fieldLabel: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 6, marginTop: DS.space.sm,
  },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.08)', borderRadius: DS.radius.md,
    paddingHorizontal: 14, height: 52, borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)', marginBottom: DS.space.xs,
  },
  inputContainerDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: DS.radius.md,
  },
  submitText: { color: DS.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  switchLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: DS.space.lg, paddingVertical: 4,
  },
  switchLinkText: { fontSize: 12, fontWeight: '500' },
  switchLinkAccent: { fontSize: 12, fontWeight: '700' },

  successSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: DS.space['2xl'] },
  successIconCircle: { marginTop: DS.space.lg, marginBottom: DS.space.md },
  successIconGradient: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    ...DS.shadow.lg,
  },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  successText: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: DS.space.lg, paddingHorizontal: 20 },
});