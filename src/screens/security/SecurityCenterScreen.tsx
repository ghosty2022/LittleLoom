import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AnimatedRe, {
  FadeInUp,
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSecurity } from '../../context/SecurityContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

type SecurityCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'SecurityCenter'>;
const { width, height } = Dimensions.get('window');

const PIN_LENGTH = 4;
const AUTO_LOCK_OPTIONS = [1, 2, 5, 10, 15, 30, 60];

const formatTimeout = (minutes: number): string =>
  minutes < 60 ? `${minutes}m` : '1h';
const formatTimeoutLabel = (minutes: number): string =>
  minutes < 60 ? `${minutes} minute${minutes > 1 ? 's' : ''}` : '1 hour';

const SECURITY_QUESTIONS_POOL = [
  'What was your childhood nickname?',
  'What is the name of your first pet?',
  "What was your mother's maiden name?",
  'What is your favorite movie?',
  'What city were you born in?',
  'What is your favorite book?',
  'What was the name of your elementary school?',
  'What is your favorite food?',
  'What was the make of your first car?',
  "What is your father's middle name?",
  'What was your first job?',
  'What is your favorite color?',
];

type Section = 'dashboard' | 'pin' | 'questions' | 'biometric' | 'timeout' | 'pin-reset-success';
type PinMode = 'create' | 'change' | 'deactivate' | 'verify';
type PinStep = 'input' | 'confirm' | 'success';

interface SecurityQuestion {
  question: string;
  answerHash: string;
}

const ReanimatedView = AnimatedRe.View;

const AURA = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
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
};

const GradientText = React.memo(({
  children, style, colors = ['#667eea', '#764ba2', '#f093fb'],
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

const SecurityCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  status: 'active' | 'inactive' | 'warning' | 'neutral';
  onPress: () => void;
  delay?: number;
  isDark: boolean;
}> = ({ icon, title, subtitle, status, onPress, delay = 0, isDark }) => {
  const statusColors = {
    active: { bg: AURA.success, icon: AURA.success, glow: 'rgba(16,185,129,0.25)' },
    inactive: { bg: AURA.danger, icon: AURA.danger, glow: 'rgba(239,68,68,0.25)' },
    warning: { bg: AURA.warning, icon: AURA.warning, glow: 'rgba(245,158,11,0.25)' },
    neutral: { bg: AURA.gray500, icon: AURA.gray500, glow: 'rgba(107,114,128,0.25)' },
  };
  const s = statusColors[status];

  return (
    <AnimatedRe.View entering={FadeInUp.delay(delay).duration(500).springify()} layout={Layout.springify()}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isDark ? AURA.darkCard : AURA.white,
            borderColor: isDark ? AURA.darkBorder : AURA.gray200,
            shadowColor: s.glow,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[`${s.bg}08`, `${s.bg}02`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.cardContent}>
          <View style={[styles.cardIconWrap, { backgroundColor: `${s.bg}18` }]}>
            <Ionicons name={icon as any} size={22} color={s.icon} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>{title}</Text>
            <Text style={[styles.cardSubtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${s.bg}15` }]}>
            <View style={[styles.statusDot, { backgroundColor: s.bg }]} />
            <Text style={[styles.statusText, { color: s.bg }]}>
              {status === 'active' ? 'On' : status === 'inactive' ? 'Off' : status === 'warning' ? 'Setup' : '—'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDark ? AURA.gray500 : AURA.gray400} />
        </View>
      </TouchableOpacity>
    </AnimatedRe.View>
  );
};

const SectionHeader: React.FC<{ title: string; icon?: keyof typeof Ionicons.glyphMap; isDark: boolean }> = ({
  title, icon, isDark,
}) => (
  <View style={styles.sectionHeaderRow}>
    {icon && (
      <View style={[styles.sectionIcon, { backgroundColor: `${AURA.primary}12` }]}>
        <Ionicons name={icon} size={14} color={AURA.primary} />
      </View>
    )}
    <Text style={[styles.sectionHeader, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
      {title}
    </Text>
  </View>
);

const ScoreRing = React.memo(({ score, color, size = 90 }: { score: number; color: string; size?: number }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(score, { duration: 900, easing: Easing.out(Easing.ease) });
  }, [score]);
  const strokeWidth = 6;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: strokeWidth, borderColor: `${color}20` }]} />
      <View style={{
        width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth,
        borderColor: color, borderTopColor: 'transparent',
        borderRightColor: progress.value > 25 ? color : 'transparent',
        borderBottomColor: progress.value > 50 ? color : 'transparent',
        borderLeftColor: progress.value > 75 ? color : 'transparent',
        transform: [{ rotate: '-45deg' }],
      }} />
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color }}>{score}</Text>
        <Text style={{ fontSize: 9, fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          score
        </Text>
      </View>
    </View>
  );
});

export default function SecurityCenterScreen({ navigation, route }: SecurityCenterScreenProps) {
  const { mode, fromForgotPassword } = route.params || {};
  const {
    settings: securitySettings,
    isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    setupPin,
    verifyPin,
    changePin,
    toggleBiometric,
    toggleAppLock,
    updateAutoLockTimeout,
    saveSecurityQuestions,
    verifySecurityAnswers,
    loadSecurityQuestions,
    checkHasSecurityQuestions,
    getBiometricTypeName,
    clearPinOnly,
    resetUnlockLock,
    refreshBiometricStatus,
    readBiometricEnabledFromStorage,
  } = useSecurity();

  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const insets = useSafeAreaInsets();
  const sweetAlert = useSweetAlert();

  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [storedQuestions, setStoredQuestions] = useState<SecurityQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [pinMode, setPinMode] = useState<PinMode>('create');
  const [pinStep, setPinStep] = useState<PinStep>('input');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinOld, setPinOld] = useState('');
  const [showPinHint, setShowPinHint] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<number[]>([-1, -1, -1]);
  const [questionAnswers, setQuestionAnswers] = useState(['', '', '']);
  const [verifyAnswers, setVerifyAnswers] = useState(['', '', '']);
  const [questionStep, setQuestionStep] = useState<'select' | 'verify' | 'edit'>('select');
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [activeQuestionSlot, setActiveQuestionSlot] = useState(0);

  const [biometricLoading, setBiometricLoading] = useState(false);
  const [selectedTimeout, setSelectedTimeout] = useState(securitySettings.autoLockTimeout);

  // ── SINGLE SOURCE OF TRUTH for biometric enabled state ──────────────
  // Read from AsyncStorage on every focus. Do NOT trust context state
  // — it goes stale after BiometricSetupScreen writes to storage.
  const [bioStorageEnabled, setBioStorageEnabled] = useState<boolean>(false);
  const [bioHardwareNow, setBioHardwareNow] = useState<boolean>(isBiometricHardwareAvailable);
  const [bioEnrolledNow, setBioEnrolledNow] = useState<boolean>(isBiometricEnrolled);

  const isMounted = useRef(true);
  const biometricToggleInFlightRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Refresh biometric truth from storage + hardware.
  const refreshBioTruth = useCallback(async () => {
    try {
      const enabled = await readBiometricEnabledFromStorage();
      if (isMounted.current) setBioStorageEnabled(enabled);
    } catch { /* noop */ }

    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      let enrolled = has ? await LocalAuthentication.isEnrolledAsync() : false;
      if (has && !enrolled && Platform.OS === 'android') {
        // Android fallback: a prompt appearing proves biometric is set up.
        try {
          const testAuth = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Verify biometric setup',
            disableDeviceFallback: true,
            cancelLabel: 'Cancel',
          });
          if (testAuth.success || testAuth.error === 'user_cancel' || testAuth.error === 'system_cancel') {
            enrolled = true;
          }
        } catch { /* noop */ }
      }
      if (isMounted.current) {
        setBioHardwareNow(has);
        setBioEnrolledNow(enrolled);
      }
      // Also nudge the context so downstream screens agree.
      refreshBiometricStatus().catch(() => {});
    } catch { /* noop */ }
  }, [readBiometricEnabledFromStorage, refreshBiometricStatus]);

  // Focus effect — runs on EVERY focus, not just mount.
  useFocusEffect(
    useCallback(() => {
      resetUnlockLock();
      loadStoredQuestions();
      refreshBioTruth();
    }, [resetUnlockLock, refreshBioTruth]),
  );

  useEffect(() => {
    if (mode === 'reset' && fromForgotPassword) {
      setActiveSection('pin');
      setPinMode('create');
      setPinStep('input');
      resetPinState();
    }
  }, [mode, fromForgotPassword]);

  useEffect(() => {
    setSelectedTimeout(securitySettings.autoLockTimeout);
  }, [securitySettings.autoLockTimeout]);

  const loadStoredQuestions = async () => {
    try {
      const loaded = await loadSecurityQuestions();
      if (loaded && loaded.length > 0) setStoredQuestions(loaded);
    } catch { /* noop */ }
  };

  const shake = useCallback(() => {
    triggerHaptic('error');
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [triggerHaptic, shakeAnim]);

  const handlePinDigit = (digit: string) => {
    if (isLoading) return;
    if (pinInput.length < PIN_LENGTH) {
      triggerHaptic('light');
      const next = pinInput + digit;
      setPinInput(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => processPinComplete(next), 200);
      }
    }
  };

  const processPinComplete = async (completedPin: string) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (pinMode === 'change') {
        if (pinStep === 'input') {
          const valid = await verifyPin(completedPin);
          if (valid) {
            setPinOld(completedPin);
            setPinStep('confirm');
            setPinInput('');
            sweetAlert.success('Verified', 'Now enter your new PIN');
          } else {
            shake(); setPinInput('');
            sweetAlert.error('Incorrect PIN', 'Please try again');
          }
        } else if (pinStep === 'confirm') {
          if (!pinConfirm) {
            setPinConfirm(completedPin);
            setPinInput('');
            sweetAlert.info('Confirm PIN', 'Re-enter to confirm');
          } else if (completedPin === pinConfirm) {
            const success = await changePin(pinOld, completedPin);
            if (success) {
              sweetAlert.success('PIN Updated', 'Your PIN has been changed');
              setPinMode('verify');
              setPinStep('success');
            } else {
              shake(); sweetAlert.error('Failed', 'Could not update PIN');
              resetPinState();
            }
          } else {
            shake(); setPinInput(''); setPinConfirm('');
            sweetAlert.error('Mismatch', 'PINs do not match. Try again.');
          }
        }
      } else if (pinMode === 'create') {
        if (pinStep === 'input') {
          setPinConfirm(completedPin);
          setPinStep('confirm');
          setPinInput('');
          sweetAlert.info('Confirm PIN', 'Re-enter your new PIN');
        } else if (pinStep === 'confirm') {
          if (completedPin === pinConfirm) {
            const success = await setupPin(completedPin);
            if (success) {
              sweetAlert.success('PIN Set', 'Your PIN is now active');
              setPinMode('verify');
              setPinStep('success');

              // If this was a reset triggered from the lock screen's Forgot PIN,
              // show a clean success sheet instead of auto-navigating.
              if (mode === 'reset' && fromForgotPassword) {
                setActiveSection('pin-reset-success');
                return;
              }

              if (!checkHasSecurityQuestions()) {
                setTimeout(() => {
                  setActiveSection('questions');
                  setQuestionStep('select');
                }, 1200);
              }
            } else {
              shake(); sweetAlert.error('Failed', 'Could not set PIN');
              resetPinState();
            }
          } else {
            shake(); setPinInput(''); setPinConfirm('');
            sweetAlert.error('Mismatch', 'PINs do not match. Try again.');
          }
        }
      } else if (pinMode === 'deactivate') {
        const valid = await verifyPin(completedPin);
        if (valid) {
          sweetAlert.confirm(
            'Deactivate PIN?',
            'You will only be able to use biometric unlock. Are you sure?',
            async () => {
              await clearPinOnly();
              sweetAlert.success('PIN Deactivated', 'Biometric is now your only unlock method');
              setActiveSection('dashboard');
            },
            () => { setPinMode('verify'); setPinStep('success'); },
            'Deactivate', 'Cancel', true,
          );
        } else {
          shake(); setPinInput('');
          sweetAlert.error('Incorrect PIN', 'Verification failed');
        }
      } else if (pinMode === 'verify') {
        const valid = await verifyPin(completedPin);
        if (valid) {
          sweetAlert.success('Verified', 'PIN is correct');
          setPinStep('success');
          setShowPinHint(true);
        } else {
          shake(); setPinInput('');
          sweetAlert.error('Incorrect', 'PIN does not match');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetPinState = () => {
    setPinInput('');
    setPinConfirm('');
    setPinOld('');
    setPinStep('input');
    setShowPinHint(false);
  };

  const handlePinDelete = () => {
    if (pinInput.length > 0 && !isLoading) {
      triggerHaptic('light');
      setPinInput(pinInput.slice(0, -1));
    }
  };

  const handleSaveQuestions = async () => {
    if (selectedQuestionIndices.some(q => q === -1)) {
      sweetAlert.warning('Incomplete', 'Select all 3 questions'); return;
    }
    if (questionAnswers.some(a => a.trim().length < 2)) {
      sweetAlert.warning('Incomplete', 'All answers must be at least 2 characters'); return;
    }
    setIsLoading(true);
    try {
      const questionsData = selectedQuestionIndices.map((qIndex, i) => ({
        question: SECURITY_QUESTIONS_POOL[qIndex],
        answer: questionAnswers[i],
      }));
      const success = await saveSecurityQuestions(questionsData);
      if (success) {
        setStoredQuestions(await loadSecurityQuestions());
        sweetAlert.success('Saved', 'Security questions updated');
        setActiveSection('dashboard');
      } else {
        sweetAlert.error('Failed', 'Could not save questions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndEdit = async () => {
    if (verifyAnswers.some(a => a.trim().length === 0)) {
      sweetAlert.warning('Incomplete', 'Answer all questions'); return;
    }
    setIsLoading(true);
    try {
      const valid = await verifySecurityAnswers(verifyAnswers);
      if (valid) {
        sweetAlert.success('Verified', 'You can now update your questions');
        setQuestionStep('edit');
        setSelectedQuestionIndices(storedQuestions.map((q) => SECURITY_QUESTIONS_POOL.indexOf(q.question)));
        setQuestionAnswers(['', '', '']);
      } else {
        shake(); sweetAlert.error('Incorrect', 'One or more answers are wrong');
        setVerifyAnswers(['', '', '']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToBiometricSetup = useCallback(() => {
    navigation.navigate('BiometricSetup');
  }, [navigation]);

  const handleToggleBiometric = useCallback(async (targetValue?: boolean) => {
    if (biometricToggleInFlightRef.current || biometricLoading) return;
    biometricToggleInFlightRef.current = true;

    const newState = typeof targetValue === 'boolean' ? targetValue : !bioStorageEnabled;

    if (newState) {
      let hasHardwareNow = false;
      let enrolledNow = false;
      try {
        hasHardwareNow = await LocalAuthentication.hasHardwareAsync();
        enrolledNow = await LocalAuthentication.isEnrolledAsync();
        if (!enrolledNow && hasHardwareNow && Platform.OS === 'android') {
          try {
            const testAuth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Verify biometric setup',
              disableDeviceFallback: true,
              cancelLabel: 'Cancel',
            });
            if (testAuth.success || testAuth.error === 'user_cancel' || testAuth.error === 'system_cancel') {
              enrolledNow = true;
            }
          } catch { /* noop */ }
        }
      } catch { /* noop */ }

      if (!hasHardwareNow) {
        sweetAlert.warning('Biometric Not Available', 'This device does not support biometric authentication.');
        biometricToggleInFlightRef.current = false;
        return;
      }
      if (!enrolledNow) {
        sweetAlert.confirm(
          'Set Up Biometrics',
          'Please set up biometrics in your device settings first, or continue to setup.',
          () => navigateToBiometricSetup(),
          undefined, 'Go to Setup', 'Cancel', false,
        );
        biometricToggleInFlightRef.current = false;
        return;
      }
    }

    setBiometricLoading(true);
    try {
      const result = await toggleBiometric(newState);
      const storedAfter = await readBiometricEnabledFromStorage();
      if (isMounted.current) setBioStorageEnabled(storedAfter);

      if (result && storedAfter === newState) {
        await refreshBioTruth();
        sweetAlert.success(
          newState ? 'Biometric On' : 'Biometric Off',
          newState ? `${getBiometricTypeName()} unlock enabled` : `${getBiometricTypeName()} unlock disabled`,
        );
      } else if (!result) {
        sweetAlert.error('Failed', 'Could not change biometric setting. Please ensure biometrics are set up in your device settings.');
      }
    } catch (error) {
      console.error('Biometric toggle error:', error);
      const stored = await readBiometricEnabledFromStorage().catch(() => false);
      if (isMounted.current) setBioStorageEnabled(stored);
      sweetAlert.error('Error', 'An error occurred while changing biometric settings.');
    } finally {
      setBiometricLoading(false);
      setTimeout(() => { biometricToggleInFlightRef.current = false; }, 300);
    }
  }, [toggleBiometric, refreshBioTruth, readBiometricEnabledFromStorage, sweetAlert, biometricLoading, navigateToBiometricSetup, getBiometricTypeName, bioStorageEnabled]);

  const handleTimeoutChange = async (minutes: number) => {
    setSelectedTimeout(minutes);
    await updateAutoLockTimeout(minutes);
    sweetAlert.success('Updated', `Auto-lock set to ${formatTimeoutLabel(minutes)}`);
  };

  const getSecurityScore = useCallback(() => {
    let score = 0;
    if (securitySettings.isPinEnabled) score += 25;
    if (bioStorageEnabled) score += 25;
    if (securitySettings.hasSecurityQuestions) score += 25;
    if (securitySettings.isAppLockEnabled) score += 25;
    return score;
  }, [securitySettings.isPinEnabled, bioStorageEnabled, securitySettings.hasSecurityQuestions, securitySettings.isAppLockEnabled]);

  const getScoreLabel = useCallback((score: number) => {
    if (score >= 80) return { text: 'Excellent', color: AURA.success };
    if (score >= 50) return { text: 'Good', color: AURA.warning };
    return { text: 'Weak', color: AURA.danger };
  }, []);

  const score = useMemo(() => getSecurityScore(), [getSecurityScore]);
  const scoreLabel = useMemo(() => getScoreLabel(score), [score, getScoreLabel]);

  const renderDashboard = () => (
    <AnimatedRe.View entering={FadeInUp.duration(500)} style={styles.section}>
      <View style={[styles.scoreCard, {
        backgroundColor: isDark ? AURA.darkCard : AURA.white,
        borderColor: isDark ? AURA.darkBorder : AURA.gray200,
      }]}>
        <LinearGradient
          colors={isDark ? ['rgba(99,102,241,0.18)', 'rgba(236,72,153,0.08)'] : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.04)']}
          style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient colors={[`${AURA.primary}30`, 'transparent']} style={styles.scoreGlow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" />
        <View style={styles.scoreContent}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scoreTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>Security Score</Text>
            <View style={[styles.scoreBadge, { backgroundColor: `${scoreLabel.color}18`, marginTop: 8 }]}>
              <View style={[styles.scoreDot, { backgroundColor: scoreLabel.color }]} />
              <Text style={[styles.scoreBadgeText, { color: scoreLabel.color }]}>{scoreLabel.text}</Text>
            </View>
            <Text style={[styles.scoreHint, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
              {score < 100 ? 'Enable more features to strengthen protection' : 'Your security is fully configured'}
            </Text>
            <View style={styles.scoreBarWrap}>
              <View style={[styles.scoreBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : AURA.gray100 }]}>
                <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: scoreLabel.color }]} />
              </View>
            </View>
          </View>
          <View style={{ marginLeft: 16 }}>
            <ScoreRing score={score} color={scoreLabel.color} size={88} />
          </View>
        </View>
      </View>

      <SectionHeader title="UNLOCK METHODS" icon="key-outline" isDark={isDark} />

      <SecurityCard
        icon="lock-closed-outline"
        title="PIN Code"
        subtitle={securitySettings.isPinEnabled ? 'PIN is active' : 'No PIN set — tap to create'}
        status={securitySettings.isPinEnabled ? 'active' : 'inactive'}
        onPress={() => {
          setActiveSection('pin');
          setPinMode(securitySettings.isPinEnabled ? 'verify' : 'create');
          setPinStep('input');
          resetPinState();
        }}
        delay={100} isDark={isDark}
      />

      <SecurityCard
        icon="finger-print-outline"
        title={getBiometricTypeName()}
        subtitle={
          !bioHardwareNow ? 'Not available on this device'
            : !bioEnrolledNow ? 'Not enrolled on device'
            : bioStorageEnabled ? `${getBiometricTypeName()} unlock active`
            : 'Tap to enable'
        }
        status={
          !bioHardwareNow || !bioEnrolledNow ? 'neutral'
            : bioStorageEnabled ? 'active' : 'warning'
        }
        onPress={() => {
          if (!bioHardwareNow) {
            sweetAlert.warning('Not Available', 'This device does not support biometric authentication.');
            return;
          }
          if (!bioEnrolledNow) {
            sweetAlert.confirm(
              'Set Up Biometrics',
              'Please set up biometrics in your device settings first.',
              () => navigateToBiometricSetup(),
              undefined, 'Go to Setup', 'Cancel', false,
            );
            return;
          }
          setActiveSection('biometric');
        }}
        delay={200} isDark={isDark}
      />

      <SectionHeader title="RECOVERY & SETTINGS" icon="shield-outline" isDark={isDark} />

      <SecurityCard
        icon="help-circle-outline"
        title="Security Questions"
        subtitle={
          securitySettings.hasSecurityQuestions
            ? `${storedQuestions.length} questions set`
            : 'Not configured — recommended for recovery'
        }
        status={securitySettings.hasSecurityQuestions ? 'active' : 'warning'}
        onPress={() => {
          setActiveSection('questions');
          if (securitySettings.hasSecurityQuestions) {
            setQuestionStep('verify');
            setVerifyAnswers(['', '', '']);
          } else {
            setQuestionStep('select');
            setSelectedQuestionIndices([-1, -1, -1]);
            setQuestionAnswers(['', '', '']);
          }
        }}
        delay={300} isDark={isDark}
      />

      <SecurityCard
        icon="time-outline"
        title="Auto-Lock"
        subtitle={`Locks after ${formatTimeoutLabel(securitySettings.autoLockTimeout)} of inactivity`}
        status="active"
        onPress={() => setActiveSection('timeout')}
        delay={400} isDark={isDark}
      />

      <SecurityCard
        icon="shield-checkmark-outline"
        title="App Lock"
        subtitle={securitySettings.isAppLockEnabled ? 'Enabled on app launch' : 'Disabled'}
        status={securitySettings.isAppLockEnabled ? 'active' : 'inactive'}
        onPress={async () => {
          try {
            const newValue = !securitySettings.isAppLockEnabled;
            await toggleAppLock(newValue);
            triggerHaptic(newValue ? 'success' : 'light');
            sweetAlert.success(
              newValue ? 'App Lock On' : 'App Lock Off',
              newValue ? 'App will lock when launched' : 'App will no longer lock on launch',
            );
          } catch (err) {
            console.error('[SecurityCenter] toggleAppLock failed:', err);
            sweetAlert.error('Error', 'Could not update App Lock.');
          }
        }}
        delay={500} isDark={isDark}
      />
    </AnimatedRe.View>
  );

  const renderPinSection = () => {
    const isSetup = pinMode === 'create';
    const isChange = pinMode === 'change';
    const isVerify = pinMode === 'verify';
    const isDeactivate = pinMode === 'deactivate';
    const isReset = mode === 'reset' && fromForgotPassword;

    const title = isSetup
      ? (isReset ? 'Set New PIN' : 'Create PIN')
      : isChange ? 'Change PIN'
      : isDeactivate ? 'Deactivate PIN'
      : 'Verify PIN';
    const subtitle = isSetup
      ? (isReset ? 'Choose a new 4-digit PIN to secure your account' : 'Set a 4-digit PIN for secure access')
      : isChange
      ? pinStep === 'input' ? 'Enter your current PIN' : 'Enter your new PIN'
      : isDeactivate ? 'Enter PIN to confirm deactivation'
      : 'Enter your PIN to view details';
    const stepColor = isSetup ? AURA.primary : isChange ? AURA.warning : isDeactivate ? AURA.danger : AURA.success;

    return (
      <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
        <View style={styles.pinHeader}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : AURA.gray100 }]}
            onPress={() => {
              if (isReset) {
                // In reset flow, going back means abandoning PIN reset.
                // Return to lock screen so they can try again.
                navigation.replace('SecurityLock' as never);
                return;
              }
              setActiveSection('dashboard');
              resetPinState();
            }}
          >
            <Ionicons name="arrow-back" size={22} color={isDark ? AURA.white : AURA.gray800} />
          </TouchableOpacity>
          <Text style={[styles.pinHeaderTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.pinCard, {
          backgroundColor: isDark ? AURA.darkCard : AURA.white,
          borderColor: isDark ? AURA.darkBorder : AURA.gray200,
        }]}>
          <LinearGradient colors={[`${stepColor}10`, `${stepColor}02`, 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <Text style={[styles.pinSubtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>{subtitle}</Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <View style={styles.pinDots}>
              {[...Array(PIN_LENGTH)].map((_, i) => {
                const filled = i < pinInput.length;
                return (
                  <View key={i} style={styles.pinDotWrap}>
                    {filled && (
                      <LinearGradient colors={[stepColor, stepColor + 'CC']} style={styles.pinDotGlow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                    )}
                    <View style={[styles.pinDot, {
                      borderColor: stepColor,
                      backgroundColor: filled ? stepColor : 'transparent',
                    }, isDark && !filled && { borderColor: 'rgba(255,255,255,0.3)' }]} />
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {isLoading && <ActivityIndicator size="small" color={stepColor} style={{ marginTop: 20 }} />}

          {pinStep === 'success' && showPinHint && (
            <AnimatedRe.View entering={FadeInUp.delay(200)} style={styles.hintBox}>
              <Ionicons name="checkmark-circle" size={20} color={AURA.success} />
              <Text style={[styles.hintText, { color: isDark ? AURA.white : AURA.gray900 }]}>PIN verified successfully</Text>
            </AnimatedRe.View>
          )}
        </View>

        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <TouchableOpacity
              key={digit}
              style={[styles.keypadBtn, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : AURA.white,
                borderColor: isDark ? AURA.darkBorder : AURA.gray200,
              }]}
              onPress={() => handlePinDigit(digit)}
              disabled={isLoading}
              activeOpacity={0.75}
            >
              <Text style={[styles.keypadBtnText, { color: isDark ? AURA.white : AURA.gray900 }]}>{digit}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.keypadBtn} />
          <TouchableOpacity
            style={[styles.keypadBtn, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : AURA.white,
              borderColor: isDark ? AURA.darkBorder : AURA.gray200,
            }]}
            onPress={() => handlePinDigit('0')} disabled={isLoading} activeOpacity={0.75}
          >
            <Text style={[styles.keypadBtnText, { color: isDark ? AURA.white : AURA.gray900 }]}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.keypadBtn, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : AURA.white,
              borderColor: isDark ? AURA.darkBorder : AURA.gray200,
            }]}
            onPress={handlePinDelete}
            disabled={pinInput.length === 0 || isLoading}
            activeOpacity={0.75}
          >
            <Ionicons name="backspace-outline" size={22} color={pinInput.length > 0 ? (isDark ? AURA.white : AURA.gray900) : AURA.gray400} />
          </TouchableOpacity>
        </View>

        {isVerify && pinStep === 'success' && (
          <AnimatedRe.View entering={FadeInUp.delay(300)} style={styles.pinActions}>
            <TouchableOpacity
              style={[styles.pinActionBtn, { backgroundColor: AURA.warning }]}
              onPress={() => { setPinMode('change'); setPinStep('input'); resetPinState(); }}
            >
              <Ionicons name="refresh-outline" size={18} color={AURA.white} />
              <Text style={styles.pinActionText}>Change PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pinActionBtn, { backgroundColor: AURA.danger }]}
              onPress={() => {
                if (bioStorageEnabled) {
                  setPinMode('deactivate'); setPinStep('input'); resetPinState();
                } else {
                  sweetAlert.warning('Cannot Deactivate', 'Enable biometric unlock first');
                }
              }}
            >
              <Ionicons name="trash-outline" size={18} color={AURA.white} />
              <Text style={styles.pinActionText}>Deactivate PIN</Text>
            </TouchableOpacity>
          </AnimatedRe.View>
        )}
      </AnimatedRe.View>
    );
  };

  const renderPinResetSuccess = () => (
    <AnimatedRe.View entering={FadeInUp.duration(400)} style={styles.successSection}>
      <View style={[styles.successCard, {
        backgroundColor: isDark ? AURA.darkCard : AURA.white,
        borderColor: isDark ? AURA.darkBorder : AURA.gray200,
      }]}>
        <LinearGradient
          colors={isDark ? ['rgba(16,185,129,0.18)', 'rgba(16,185,129,0.04)'] : ['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.02)']}
          style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <View style={[styles.successIconWrap, { backgroundColor: `${AURA.success}18` }]}>
          <Ionicons name="checkmark-circle" size={54} color={AURA.success} />
        </View>
        <Text style={[styles.successTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
          PIN Updated
        </Text>
        <Text style={[styles.successText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
          Your new PIN is now active. You can unlock LittleLoom with it anytime.
        </Text>
        <TouchableOpacity
          style={styles.successBtn}
          onPress={() => {
            navigation.reset({ index: 0, routes: [{ name: 'Main' as never }] });
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[AURA.primary, AURA.accent]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
          <Ionicons name="home-outline" size={18} color={AURA.white} />
          <Text style={styles.successBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </AnimatedRe.View>
  );

  const renderQuestionsSection = () => (
    <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
      <View style={styles.pinHeader}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : AURA.gray100 }]}
          onPress={() => setActiveSection('dashboard')}
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? AURA.white : AURA.gray800} />
        </TouchableOpacity>
        <Text style={[styles.pinHeaderTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
          {questionStep === 'verify' ? 'Verify Identity' : questionStep === 'edit' ? 'Update Questions' : 'Security Questions'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {questionStep === 'verify' && storedQuestions.length > 0 && (
        <View style={styles.questionsContainer}>
          <Text style={[styles.questionsInfo, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
            Answer your current questions to make changes
          </Text>
          {storedQuestions.map((sq, index) => (
            <View key={index} style={[styles.questionCard, {
              backgroundColor: isDark ? AURA.darkCard : AURA.white,
              borderColor: isDark ? AURA.darkBorder : AURA.gray200,
            }]}>
              <Text style={[styles.questionLabel, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>Question {index + 1}</Text>
              <Text style={[styles.questionText, { color: isDark ? AURA.white : AURA.gray900 }]}>{sq.question}</Text>
              <TextInput
                style={[styles.questionInput, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : AURA.gray50,
                  color: isDark ? AURA.white : AURA.gray900,
                  borderColor: isDark ? AURA.darkBorder : AURA.gray200,
                }]}
                placeholder="Your answer"
                placeholderTextColor={isDark ? AURA.gray500 : AURA.gray400}
                value={verifyAnswers[index]}
                onChangeText={(text) => {
                  const next = [...verifyAnswers];
                  next[index] = text;
                  setVerifyAnswers(next);
                }}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.actionBtn} onPress={handleVerifyAndEdit} disabled={isLoading}>
            <LinearGradient colors={[AURA.primary, AURA.accent]} style={styles.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {isLoading ? <ActivityIndicator color={AURA.white} /> : <Text style={styles.actionBtnText}>Verify & Continue</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {(questionStep === 'select' || questionStep === 'edit') && (
        <View style={styles.questionsContainer}>
          <Text style={[styles.questionsInfo, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
            {questionStep === 'edit' ? 'Update your security questions' : 'Set up 3 questions for account recovery'}
          </Text>
          {[0, 1, 2].map((slot) => (
            <View key={slot} style={[styles.questionCard, {
              backgroundColor: isDark ? AURA.darkCard : AURA.white,
              borderColor: isDark ? AURA.darkBorder : AURA.gray200,
            }]}>
              <TouchableOpacity
                style={[styles.questionSelector, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : AURA.gray50,
                  borderColor: isDark ? AURA.darkBorder : AURA.gray200,
                }]}
                onPress={() => { setActiveQuestionSlot(slot); setShowQuestionPicker(true); }}
              >
                <Text
                  style={[styles.questionSelectorText, {
                    color: selectedQuestionIndices[slot] !== -1
                      ? (isDark ? AURA.white : AURA.gray900)
                      : (isDark ? AURA.gray500 : AURA.gray400),
                  }]}
                  numberOfLines={2}
                >
                  {selectedQuestionIndices[slot] !== -1
                    ? SECURITY_QUESTIONS_POOL[selectedQuestionIndices[slot]]
                    : `Select Question ${slot + 1}`}
                </Text>
                <Ionicons name="chevron-down" size={18} color={AURA.primary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.questionInput, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : AURA.gray50,
                  color: isDark ? AURA.white : AURA.gray900,
                  borderColor: isDark ? AURA.darkBorder : AURA.gray200,
                }]}
                placeholder={`Answer ${slot + 1}`}
                placeholderTextColor={isDark ? AURA.gray500 : AURA.gray400}
                value={questionAnswers[slot]}
                onChangeText={(text) => {
                  const next = [...questionAnswers];
                  next[slot] = text;
                  setQuestionAnswers(next);
                }}
                autoCapitalize="none"
                editable={selectedQuestionIndices[slot] !== -1 && !isLoading}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.actionBtn} onPress={handleSaveQuestions} disabled={isLoading}>
            <LinearGradient colors={[AURA.primary, AURA.accent]} style={styles.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {isLoading ? <ActivityIndicator color={AURA.white} /> : <Text style={styles.actionBtnText}>Save Questions</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showQuestionPicker} transparent animationType="fade" onRequestClose={() => setShowQuestionPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowQuestionPicker(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: isDark ? AURA.darkCard : AURA.white }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <Text style={[styles.pickerTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
              Select Question {activeQuestionSlot + 1}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
              {SECURITY_QUESTIONS_POOL
                .filter((_, idx) => !selectedQuestionIndices.includes(idx) || selectedQuestionIndices[activeQuestionSlot] === idx)
                .map((q) => {
                  const originalIndex = SECURITY_QUESTIONS_POOL.indexOf(q);
                  const isSelected = selectedQuestionIndices[activeQuestionSlot] === originalIndex;
                  return (
                    <TouchableOpacity
                      key={originalIndex}
                      style={[styles.pickerItem, isSelected && { backgroundColor: `${AURA.primary}15` }]}
                      onPress={() => {
                        const next = [...selectedQuestionIndices];
                        next[activeQuestionSlot] = originalIndex;
                        setSelectedQuestionIndices(next);
                        setShowQuestionPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerItemText, { color: isDark ? AURA.white : AURA.gray900 }, isSelected && { color: AURA.primary, fontWeight: '700' }]}>
                        {q}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={20} color={AURA.primary} />}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AnimatedRe.View>
  );

  const renderBiometricSection = () => {
    const bioName = getBiometricTypeName();
    const bioEnabled = bioStorageEnabled;
    const hasHardware = bioHardwareNow;
    const enrolled = bioEnrolledNow;

    return (
      <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
        <View style={styles.pinHeader}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : AURA.gray100 }]}
            onPress={() => setActiveSection('dashboard')}
          >
            <Ionicons name="arrow-back" size={22} color={isDark ? AURA.white : AURA.gray800} />
          </TouchableOpacity>
          <Text style={[styles.pinHeaderTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>{bioName} Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.bioCard, {
          backgroundColor: isDark ? AURA.darkCard : AURA.white,
          borderColor: isDark ? AURA.darkBorder : AURA.gray200,
        }]}>
          <LinearGradient colors={[`${AURA.primary}10`, `${AURA.accent}04`, 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

          <View style={[styles.bioIconCircle, { backgroundColor: `${AURA.primary}18` }]}>
            <Ionicons name="finger-print" size={36} color={AURA.primary} />
          </View>
          <Text style={[styles.bioTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>{bioName}</Text>
          <Text style={[styles.bioDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
            Use biometric authentication to unlock the app
          </Text>

          {!hasHardware ? (
            <View style={[styles.bioStatusBanner, { backgroundColor: `${AURA.danger}15` }]}>
              <Ionicons name="alert-circle" size={16} color={AURA.danger} />
              <Text style={[styles.bioStatusBannerText, { color: AURA.danger }]}>Biometric hardware not available</Text>
            </View>
          ) : !enrolled ? (
            <TouchableOpacity style={styles.bioStatusBanner} onPress={navigateToBiometricSetup}>
              <View style={[styles.bioStatusBanner, { backgroundColor: `${AURA.warning}15` }]}>
                <Ionicons name="alert-circle" size={16} color={AURA.warning} />
                <Text style={[styles.bioStatusBannerText, { color: AURA.warning, flex: 1 }]}>Set up in device settings first</Text>
                <Ionicons name="arrow-forward" size={14} color={AURA.warning} />
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={[styles.bioToggleRow, { borderTopColor: isDark ? AURA.darkBorder : AURA.gray200 }]}>
            <Text style={[styles.bioToggleLabel, { color: isDark ? AURA.white : AURA.gray900 }]}>Enable {bioName} Unlock</Text>
            <Switch
              value={bioEnabled}
              onValueChange={(value) => { triggerHaptic('light'); handleToggleBiometric(value); }}
              disabled={biometricLoading || !hasHardware}
              trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : AURA.gray300, true: `${AURA.primary}80` }}
              thumbColor={bioEnabled ? AURA.primary : AURA.white}
            />
          </View>

          {biometricLoading && (
            <View style={styles.bioLoadingContainer}>
              <ActivityIndicator size="small" color={AURA.primary} />
              <Text style={[styles.bioLoadingText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                {bioEnabled ? 'Disabling...' : 'Enabling...'}
              </Text>
            </View>
          )}

          {bioEnabled && securitySettings.isPinEnabled && (
            <AnimatedRe.View entering={FadeInUp.duration(400)} style={[styles.bioPriorityBox, { backgroundColor: `${AURA.primary}10` }]}>
              <Ionicons name="information-circle-outline" size={16} color={AURA.primary} />
              <Text style={[styles.bioPriorityText, { color: isDark ? AURA.gray300 : AURA.gray700 }]}>
                {bioName} is now your primary unlock method. PIN is fallback.
              </Text>
            </AnimatedRe.View>
          )}

          {bioEnabled && !securitySettings.isPinEnabled && (
            <AnimatedRe.View entering={FadeInUp.duration(400)} style={[styles.bioPriorityBox, { backgroundColor: `${AURA.warning}15` }]}>
              <Ionicons name="warning-outline" size={16} color={AURA.warning} />
              <Text style={[styles.bioPriorityText, { color: AURA.warning }]}>
                No fallback method! Set a PIN for safety.
              </Text>
            </AnimatedRe.View>
          )}

          {!bioEnabled && hasHardware && (
            <TouchableOpacity style={styles.bioSetupBtn} onPress={() => handleToggleBiometric(true)} activeOpacity={0.85}>
              <LinearGradient colors={[AURA.primary, AURA.accent]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Ionicons name="finger-print" size={18} color={AURA.white} />
              <Text style={styles.bioSetupBtnText}>Enable {bioName}</Text>
            </TouchableOpacity>
          )}

          {!hasHardware && (
            <View style={[styles.bioSetupBtn, { backgroundColor: AURA.gray500 }]}>
              <Text style={styles.bioSetupBtnText}>Device Not Supported</Text>
            </View>
          )}
        </View>
      </AnimatedRe.View>
    );
  };

  const renderTimeoutSection = () => (
    <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
      <View style={styles.pinHeader}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : AURA.gray100 }]}
          onPress={() => setActiveSection('dashboard')}
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? AURA.white : AURA.gray800} />
        </TouchableOpacity>
        <Text style={[styles.pinHeaderTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>Auto-Lock Timeout</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.timeoutDesc, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
        Automatically lock the app after a period of inactivity
      </Text>

      <View style={styles.timeoutGrid}>
        {AUTO_LOCK_OPTIONS.map((minutes) => {
          const active = selectedTimeout === minutes;
          return (
            <TouchableOpacity
              key={minutes}
              style={[styles.timeoutOption, {
                backgroundColor: active ? AURA.primary : (isDark ? AURA.darkCard : AURA.white),
                borderColor: active ? AURA.primary : (isDark ? AURA.darkBorder : AURA.gray200),
              }]}
              onPress={() => handleTimeoutChange(minutes)}
              activeOpacity={0.8}
            >
              <Text style={[styles.timeoutOptionText, {
                color: active ? AURA.white : (isDark ? AURA.white : AURA.gray900),
                fontWeight: active ? '800' : '600',
              }]}>
                {formatTimeout(minutes)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.timeoutPreview, {
        backgroundColor: isDark ? AURA.darkCard : AURA.white,
        borderColor: isDark ? AURA.darkBorder : AURA.gray200,
      }]}>
        <View style={[styles.timeoutIcon, { backgroundColor: `${AURA.primary}15` }]}>
          <Ionicons name="time-outline" size={18} color={AURA.primary} />
        </View>
        <Text style={[styles.timeoutPreviewText, { color: isDark ? AURA.gray300 : AURA.gray700 }]}>
          App will lock after{' '}
          <Text style={{ fontWeight: '800', color: AURA.primary }}>{formatTimeoutLabel(selectedTimeout)}</Text>{' '}
          of inactivity
        </Text>
      </View>
    </AnimatedRe.View>
  );

  const bgColors = isDark
    ? [AURA.darkBg, '#12121e', AURA.darkBg]
    : ['#f8faff', '#eef0f5', '#e4e8f0'];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : AURA.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      <LinearGradient
        colors={[`${AURA.primary}${isDark ? '28' : '14'}`, 'transparent']}
        style={styles.auraGlowTopLeft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none"
      />
      <LinearGradient
        colors={[`${AURA.accent}${isDark ? '24' : '12'}`, 'transparent']}
        style={styles.auraGlowBottomRight} start={{ x: 1, y: 1 }} end={{ x: 0, y: 0 }} pointerEvents="none"
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeSection === 'dashboard' && (
            <AnimatedRe.View entering={FadeInDown.duration(500).springify()} style={styles.dashHeader}>
              <GradientText colors={['#667eea', '#764ba2', '#f093fb']} style={styles.dashTitle}>SECURITY</GradientText>
              <Text style={[styles.dashSubtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                Unlock methods, recovery & app lock
              </Text>
            </AnimatedRe.View>
          )}

          {activeSection === 'dashboard' && renderDashboard()}
          {activeSection === 'pin' && renderPinSection()}
          {activeSection === 'pin-reset-success' && renderPinResetSuccess()}
          {activeSection === 'questions' && renderQuestionsSection()}
          {activeSection === 'biometric' && renderBiometricSection()}
          {activeSection === 'timeout' && renderTimeoutSection()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20 },

  auraGlowTopLeft: {
    position: 'absolute', top: -120, left: -100,
    width: 340, height: 340, borderRadius: 170,
  },
  auraGlowBottomRight: {
    position: 'absolute', bottom: -140, right: -120,
    width: 360, height: 360, borderRadius: 180,
  },

  section: { paddingTop: 8 },

  dashHeader: { alignItems: 'center', marginBottom: 20, marginTop: 4 },
  dashTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 1.4 },
  dashSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 4 },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, marginBottom: 12, marginLeft: 4,
  },
  sectionIcon: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },

  scoreCard: {
    borderRadius: 24, padding: 18, marginBottom: 8, overflow: 'hidden', borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: AURA.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20 },
      android: { elevation: 5 },
    }),
  },
  scoreGlow: { position: 'absolute', top: -60, left: -40, width: 180, height: 180, borderRadius: 90 },
  scoreContent: { flexDirection: 'row', alignItems: 'center', zIndex: 1 },
  scoreTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  scoreBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start',
  },
  scoreDot: { width: 6, height: 6, borderRadius: 3 },
  scoreBadgeText: { fontSize: 12, fontWeight: '700' },
  scoreHint: { fontSize: 12, marginTop: 10, lineHeight: 17 },
  scoreBarWrap: { marginTop: 10 },
  scoreBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },

  card: {
    borderRadius: 18, marginBottom: 10, overflow: 'hidden', borderWidth: 1,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.10, shadowRadius: 18 },
      android: { elevation: 4 },
    }),
  },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardIconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 12, lineHeight: 17 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginRight: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  pinHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, paddingTop: 8,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pinHeaderTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  pinCard: {
    borderRadius: 24, padding: 28, alignItems: 'center',
    marginBottom: 20, borderWidth: 1, overflow: 'hidden',
  },
  pinSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  pinDotWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pinDotGlow: { position: 'absolute', width: 24, height: 24, borderRadius: 12, opacity: 0.4 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },

  hintBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: `${AURA.success}15`, borderRadius: 12,
  },
  hintText: { fontSize: 13, fontWeight: '600' },

  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, paddingHorizontal: 20 },
  keypadBtn: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  keypadBtnText: { fontSize: 24, fontWeight: '700' },

  pinActions: { flexDirection: 'row', gap: 12, marginTop: 24, paddingHorizontal: 20 },
  pinActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 14,
  },
  pinActionText: { color: AURA.white, fontSize: 14, fontWeight: '700' },

  questionsContainer: { gap: 12 },
  questionsInfo: { fontSize: 13, textAlign: 'center', marginBottom: 6, lineHeight: 19 },
  questionCard: { borderRadius: 18, padding: 16, borderWidth: 1 },
  questionLabel: {
    fontSize: 10, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 6,
  },
  questionText: { fontSize: 14, fontWeight: '600', marginBottom: 10, lineHeight: 20 },
  questionSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, marginBottom: 8,
  },
  questionSelectorText: { fontSize: 13, fontWeight: '500', flex: 1, marginRight: 8, lineHeight: 19 },
  questionInput: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontWeight: '500', borderWidth: 1,
  },
  actionBtn: {
    borderRadius: 16, marginTop: 8, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: AURA.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
  },
  actionBtnGrad: { alignItems: 'center', paddingVertical: 15 },
  actionBtnText: { color: AURA.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, maxHeight: height * 0.65 },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: AURA.gray400, alignSelf: 'center', marginBottom: 14, opacity: 0.5,
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  pickerScroll: { maxHeight: 320 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4,
  },
  pickerItemText: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8, lineHeight: 19 },

  bioCard: { borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, overflow: 'hidden' },
  bioIconCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  bioTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  bioDesc: { fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 19, paddingHorizontal: 16 },
  bioStatusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    marginBottom: 14, width: '100%',
  },
  bioStatusBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },
  bioToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingVertical: 12, borderTopWidth: 1,
  },
  bioToggleLabel: { fontSize: 15, fontWeight: '600' },
  bioLoadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  bioLoadingText: { fontSize: 13, fontWeight: '500' },
  bioPriorityBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 14, padding: 12, borderRadius: 12, width: '100%',
  },
  bioPriorityText: { fontSize: 12, lineHeight: 17, flex: 1, fontWeight: '500' },
  bioSetupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24,
    marginTop: 14, width: '100%', overflow: 'hidden',
  },
  bioSetupBtnText: { color: AURA.white, fontSize: 14, fontWeight: '700' },

  timeoutDesc: { fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 19, paddingHorizontal: 20 },
  timeoutGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, justifyContent: 'center', marginBottom: 20,
  },
  timeoutOption: {
    width: (width - 72) / 3, paddingVertical: 15,
    borderRadius: 14, alignItems: 'center', borderWidth: 1.5,
  },
  timeoutOptionText: { fontSize: 15, fontWeight: '600' },
  timeoutPreview: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 16, borderRadius: 16, borderWidth: 1,
  },
  timeoutIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  timeoutPreviewText: { fontSize: 13, lineHeight: 19, flex: 1 },

  // ── PIN reset success ───────────────────────────────────────────
  successSection: { paddingTop: 40, alignItems: 'center' },
  successCard: {
    borderRadius: 28, padding: 32, alignItems: 'center',
    width: '100%', borderWidth: 1, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: AURA.success, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.20, shadowRadius: 24 },
      android: { elevation: 10 },
    }),
  },
  successIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  successTitle: { fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  successText: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 28, paddingHorizontal: 8 },
  successBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 28,
    overflow: 'hidden', width: '100%',
  },
  successBtnText: { color: AURA.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});