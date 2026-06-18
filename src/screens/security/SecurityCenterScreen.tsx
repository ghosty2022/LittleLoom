import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated,{  ActivityIndicator, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedRe, {
  FadeInUp,
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSecurity } from '../../context/SecurityContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

type SecurityCenterScreenProps = NativeStackScreenProps<RootStackParamList, 'SecurityCenter'>;
const { width, height } = Dimensions.get('window');

const PIN_LENGTH = 4;
const AUTO_LOCK_OPTIONS = [1, 2, 5, 10, 15, 30];

const SECURITY_QUESTIONS_POOL = [
  "What was your childhood nickname?",
  "What is the name of your first pet?",
  "What was your mother's maiden name?",
  "What is your favorite movie?",
  "What city were you born in?",
  "What is your favorite book?",
  "What was the name of your elementary school?",
  "What is your favorite food?",
  "What was the make of your first car?",
  "What is your father's middle name?",
  "What was your first job?",
  "What is your favorite color?",
];

type Section = 'dashboard' | 'pin' | 'questions' | 'biometric' | 'timeout';
type PinMode = 'create' | 'change' | 'deactivate' | 'verify';
type PinStep = 'input' | 'confirm' | 'success';

interface SecurityQuestion {
  question: string;
  answerHash: string;
}

const ReanimatedView = AnimatedRe.View;

const SecurityCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  status: 'active' | 'inactive' | 'warning' | 'neutral';
  onPress: () => void;
  delay?: number;
  isDark: boolean;
  themeColors: any;
}> = ({ icon, title, subtitle, status, onPress, delay = 0, isDark, themeColors }) => {
  const statusColors = {
    active: { bg: '#10b981', icon: '#10b981', glow: 'rgba(16,185,129,0.3)' },
    inactive: { bg: '#ef4444', icon: '#ef4444', glow: 'rgba(239,68,68,0.3)' },
    warning: { bg: '#f59e0b', icon: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
    neutral: { bg: '#6b7280', icon: '#6b7280', glow: 'rgba(107,114,128,0.3)' },
  };
  const s = statusColors[status];

  return (
    <AnimatedRe.View entering={FadeInUp.delay(delay).duration(600)} layout={Layout.springify()}>
      <TouchableOpacity
        style={[styles.card, isDark && styles.cardDark, { shadowColor: s.glow }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <BlurView intensity={isDark ? 30 : 60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <View style={[styles.cardGlow, { backgroundColor: s.glow }]} />
        <View style={styles.cardContent}>
          <View style={[styles.cardIconWrap, { backgroundColor: s.glow }]}>
            <Ionicons name={icon as any} size={22} color={s.icon} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>{title}</Text>
            <Text style={[styles.cardSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: s.bg + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: s.bg }]} />
            <Text style={[styles.statusText, { color: s.bg }]}>
              {status === 'active' ? 'On' : status === 'inactive' ? 'Off' : status === 'warning' ? 'Setup' : '—'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#475569' : '#94a3b8'} />
        </View>
      </TouchableOpacity>
    </AnimatedRe.View>
  );
};

const SectionHeader: React.FC<{ title: string; isDark: boolean }> = ({ title, isDark }) => (
  <Text style={[styles.sectionHeader, { color: isDark ? '#94a3b8' : '#64748b' }]}>{title}</Text>
);

export default function SecurityCenterScreen({ navigation, route }: SecurityCenterScreenProps) {
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
    clearSecurityQuestions,
    hasSecurityQuestions,
    authenticateWithBiometric,
    availableBiometricTypes,
    getBiometricTypeName,
    clearSecurityState,
    resetUnlockLock,
  } = useSecurity();

  const { userProfile } = useAuth();
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const { toast, error: showError, success: showSuccess, confirm: showConfirm } = useSweetAlert();
  const insets = useSafeAreaInsets();

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

  useEffect(() => {
    resetUnlockLock();
    loadStoredQuestions();
    const unsub = navigation.addListener('focus', () => resetUnlockLock());
    return unsub;
  }, [navigation, resetUnlockLock]);

  useEffect(() => {
    setSelectedTimeout(securitySettings.autoLockTimeout);
  }, [securitySettings.autoLockTimeout]);

  const loadStoredQuestions = async () => {
    try {
      const loaded = await loadSecurityQuestions();
      if (loaded && loaded.length > 0) {
        setStoredQuestions(loaded);
      }
    } catch (e) {
      console.log('No security questions loaded');
    }
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

  const progressValue = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progressValue.value, [0, 1], [0, 100])}%`,
  }));

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
            showSuccess('Verified', 'Now enter your new PIN');
          } else {
            shake();
            setPinInput('');
            showError('Incorrect PIN', 'Please try again');
          }
        } else if (pinStep === 'confirm') {
          if (!pinConfirm) {
            setPinConfirm(completedPin);
            setPinInput('');
            toast('Confirm PIN', 'Re-enter to confirm', 'info');
          } else {
            if (completedPin === pinConfirm) {
              const success = await changePin(pinOld, completedPin);
              if (success) {
                showSuccess('PIN Updated', 'Your PIN has been changed');
                setPinMode('verify');
                setPinStep('success');
              } else {
                shake();
                showError('Failed', 'Could not update PIN');
                resetPinState();
              }
            } else {
              shake();
              setPinInput('');
              setPinConfirm('');
              showError('Mismatch', 'PINs do not match. Try again.');
            }
          }
        }
      } else if (pinMode === 'create') {
        if (pinStep === 'input') {
          setPinConfirm(completedPin);
          setPinStep('confirm');
          setPinInput('');
          toast('Confirm PIN', 'Re-enter your new PIN', 'info');
        } else if (pinStep === 'confirm') {
          if (completedPin === pinConfirm) {
            const success = await setupPin(completedPin);
            if (success) {
              showSuccess('PIN Set', 'Your PIN is now active');
              setPinMode('verify');
              setPinStep('success');
              if (!hasSecurityQuestions()) {
                setTimeout(() => {
                  setActiveSection('questions');
                  setQuestionStep('select');
                }, 1200);
              }
            } else {
              shake();
              showError('Failed', 'Could not set PIN');
              resetPinState();
            }
          } else {
            shake();
            setPinInput('');
            setPinConfirm('');
            showError('Mismatch', 'PINs do not match. Try again.');
          }
        }
      } else if (pinMode === 'deactivate') {
        const valid = await verifyPin(completedPin);
        if (valid) {
          showConfirm(
            'Deactivate PIN?',
            'You will only be able to use biometric unlock. Are you sure?',
            async () => {
              await clearSecurityState();
              showSuccess('PIN Deactivated', 'Biometric is now your only unlock method');
              setActiveSection('dashboard');
            },
            () => {
              setPinMode('verify');
              setPinStep('success');
            }
          );
        } else {
          shake();
          setPinInput('');
          showError('Incorrect PIN', 'Verification failed');
        }
      } else if (pinMode === 'verify') {
        const valid = await verifyPin(completedPin);
        if (valid) {
          showSuccess('Verified', 'PIN is correct');
          setPinStep('success');
          setShowPinHint(true);
        } else {
          shake();
          setPinInput('');
          showError('Incorrect', 'PIN does not match');
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
      showError('Incomplete', 'Select all 3 questions');
      return;
    }
    if (questionAnswers.some(a => a.trim().length < 2)) {
      showError('Incomplete', 'All answers must be at least 2 characters');
      return;
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
        showSuccess('Saved', 'Security questions updated');
        setActiveSection('dashboard');
      } else {
        showError('Failed', 'Could not save questions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndEdit = async () => {
    if (verifyAnswers.some(a => a.trim().length === 0)) {
      showError('Incomplete', 'Answer all questions');
      return;
    }
    setIsLoading(true);
    try {
      const valid = await verifySecurityAnswers(verifyAnswers);
      if (valid) {
        showSuccess('Verified', 'You can now update your questions');
        setQuestionStep('edit');
        setSelectedQuestionIndices(storedQuestions.map((q, i) => SECURITY_QUESTIONS_POOL.indexOf(q.question)));
        setQuestionAnswers(['', '', '']);
      } else {
        shake();
        showError('Incorrect', 'One or more answers are wrong');
        setVerifyAnswers(['', '', '']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBiometric = async () => {
    setBiometricLoading(true);
    try {
      const result = await toggleBiometric(!isBiometricEnabled);
      if (result) {
        showSuccess(
          isBiometricEnabled ? 'Biometric Off' : 'Biometric On',
          isBiometricEnabled ? 'Biometric unlock disabled' : 'Biometric unlock enabled'
        );
      } else {
        showError('Failed', 'Could not change biometric setting');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleTimeoutChange = async (minutes: number) => {
    setSelectedTimeout(minutes);
    await updateAutoLockTimeout(minutes);
    showSuccess('Updated', `Auto-lock set to ${minutes} minute${minutes > 1 ? 's' : ''}`);
  };

  const getSecurityScore = useCallback(() => {
    let score = 0;
    if (securitySettings.isPinEnabled) score += 25;
    if (isBiometricEnabled) score += 25;
    if (securitySettings.hasSecurityQuestions) score += 25;
    if (securitySettings.isAppLockEnabled) score += 25;
    return score;
  }, [securitySettings.isPinEnabled, isBiometricEnabled, securitySettings.hasSecurityQuestions, securitySettings.isAppLockEnabled]);

  const getScoreLabel = useCallback((score: number) => {
    if (score >= 80) return { text: 'Excellent', color: '#10b981' };
    if (score >= 50) return { text: 'Good', color: '#f59e0b' };
    return { text: 'Weak', color: '#ef4444' };
  }, []);

  const score = useMemo(() => getSecurityScore(), [getSecurityScore]);
  const scoreLabel = useMemo(() => getScoreLabel(score), [score, getScoreLabel]);

  const renderDashboard = () => (
    <AnimatedRe.View entering={FadeInUp.duration(500)} style={styles.section}>
      {/* Security Score Card */}
      <View style={[styles.scoreCard, isDark && styles.scoreCardDark]}>
        <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark ? ['rgba(16,185,129,0.1)', 'rgba(59,130,246,0.1)'] : ['rgba(102,126,234,0.15)', 'rgba(118,75,162,0.15)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.scoreHeader}>
          <Text style={[styles.scoreTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
            Security Score
          </Text>
          <View style={[styles.scoreBadge, { backgroundColor: scoreLabel.color + '20' }]}>
            <Text style={[styles.scoreBadgeText, { color: scoreLabel.color }]}>{scoreLabel.text}</Text>
          </View>
        </View>
        <View style={styles.scoreBarContainer}>
          <View style={[styles.scoreBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <AnimatedRe.View style={[styles.scoreBarFill, { backgroundColor: scoreLabel.color }, progressStyle]} />
          </View>
          <Text style={[styles.scorePercent, { color: scoreLabel.color }]}>{score}%</Text>
        </View>
        <Text style={[styles.scoreHint, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {score < 100 ? 'Enable more security features to strengthen protection' : 'Your security is fully configured'}
        </Text>
      </View>

      <SectionHeader title="Authentication Methods" isDark={isDark} />

      <SecurityCard
        icon="lock-closed-outline"
        title="PIN Lock"
        subtitle={securitySettings.isPinEnabled ? 'PIN is active' : 'No PIN set'}
        status={securitySettings.isPinEnabled ? 'active' : 'inactive'}
        onPress={() => {
          setActiveSection('pin');
          if (securitySettings.isPinEnabled) {
            setPinMode('verify');
          } else {
            setPinMode('create');
          }
          setPinStep('input');
          resetPinState();
        }}
        delay={100}
        isDark={isDark}
        themeColors={themeColors}
      />

      <SecurityCard
        icon="finger-print-outline"
        title={getBiometricTypeName()}
        subtitle={
          !isBiometricHardwareAvailable
            ? 'Not available on this device'
            : !isBiometricEnrolled
            ? 'Not enrolled on device'
            : isBiometricEnabled
            ? 'Biometric unlock active'
            : 'Tap to enable'
        }
        status={
          !isBiometricHardwareAvailable || !isBiometricEnrolled
            ? 'neutral'
            : isBiometricEnabled
            ? 'active'
            : 'warning'
        }
        onPress={() => {
          if (!isBiometricHardwareAvailable || !isBiometricEnrolled) {
            showError('Unavailable', 'Biometric authentication is not set up on this device');
            return;
          }
          setActiveSection('biometric');
        }}
        delay={200}
        isDark={isDark}
        themeColors={themeColors}
      />

      <SectionHeader title="Recovery & Settings" isDark={isDark} />

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
        delay={300}
        isDark={isDark}
        themeColors={themeColors}
      />

      <SecurityCard
        icon="time-outline"
        title="Auto-Lock"
        subtitle={`Locks after ${securitySettings.autoLockTimeout} min of inactivity`}
        status="active"
        onPress={() => setActiveSection('timeout')}
        delay={400}
        isDark={isDark}
        themeColors={themeColors}
      />

      <SecurityCard
        icon="shield-checkmark-outline"
        title="App Lock"
        subtitle={securitySettings.isAppLockEnabled ? 'Enabled on app launch' : 'Disabled'}
        status={securitySettings.isAppLockEnabled ? 'active' : 'inactive'}
        onPress={async () => {
          await toggleAppLock(!securitySettings.isAppLockEnabled);
          showSuccess(
            securitySettings.isAppLockEnabled ? 'App Lock Off' : 'App Lock On',
            securitySettings.isAppLockEnabled ? 'App will no longer lock on launch' : 'App will lock when launched'
          );
        }}
        delay={500}
        isDark={isDark}
        themeColors={themeColors}
      />
    </AnimatedRe.View>
  );

  const renderPinSection = () => {
    const isSetup = pinMode === 'create';
    const isChange = pinMode === 'change';
    const isVerify = pinMode === 'verify';
    const isDeactivate = pinMode === 'deactivate';

    const title = isSetup ? 'Create PIN' : isChange ? 'Change PIN' : isDeactivate ? 'Deactivate PIN' : 'Verify PIN';
    const subtitle = isSetup
      ? 'Set a 4-digit PIN for secure access'
      : isChange
      ? pinStep === 'input'
        ? 'Enter your current PIN'
        : 'Enter your new PIN'
      : isDeactivate
      ? 'Enter PIN to confirm deactivation'
      : 'Enter your PIN to view details';

    const stepColor = isSetup ? themeColors.primary : isChange ? '#f59e0b' : isDeactivate ? '#ef4444' : '#10b981';

    return (
      <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
        <View style={styles.pinHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { setActiveSection('dashboard'); resetPinState(); }}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#f1f5f9' : '#1e293b'} />
          </TouchableOpacity>
          <Text style={[styles.pinHeaderTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.pinCard, isDark && styles.pinCardDark]}>
          <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
          <Text style={[styles.pinSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>{subtitle}</Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <View style={styles.pinDots}>
              {[...Array(PIN_LENGTH)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    {
                      borderColor: stepColor,
                      backgroundColor: i < pinInput.length ? stepColor : 'transparent',
                    },
                    isDark && !(i < pinInput.length) && { borderColor: 'rgba(255,255,255,0.3)' },
                  ]}
                />
              ))}
            </View>
          </Animated.View>

          {isLoading && <ActivityIndicator size="small" color={stepColor} style={{ marginTop: 20 }} />}

          {pinStep === 'success' && showPinHint && (
            <AnimatedRe.View entering={FadeInUp.delay(200)} style={styles.hintBox}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={[styles.hintText, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
                PIN verified successfully
              </Text>
            </AnimatedRe.View>
          )}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <TouchableOpacity
              key={digit}
              style={[styles.keypadBtn, isDark && styles.keypadBtnDark]}
              onPress={() => handlePinDigit(digit)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={[styles.keypadBtnText, isDark && styles.keypadBtnTextDark]}>{digit}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.keypadBtn} />
          <TouchableOpacity
            style={[styles.keypadBtn, isDark && styles.keypadBtnDark]}
            onPress={() => handlePinDigit('0')}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={[styles.keypadBtnText, isDark && styles.keypadBtnTextDark]}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.keypadBtn, isDark && styles.keypadBtnDark]}
            onPress={handlePinDelete}
            disabled={pinInput.length === 0 || isLoading}
            activeOpacity={0.7}
          >
            <Ionicons
              name="backspace-outline"
              size={22}
              color={pinInput.length > 0 ? (isDark ? '#f1f5f9' : '#1e293b') : '#cbd5e1'}
            />
          </TouchableOpacity>
        </View>

        {/* Action buttons for verified state */}
        {isVerify && pinStep === 'success' && (
          <AnimatedRe.View entering={FadeInUp.delay(300)} style={styles.pinActions}>
            <TouchableOpacity
              style={[styles.pinActionBtn, { backgroundColor: '#f59e0b' }]}
              onPress={() => {
                setPinMode('change');
                setPinStep('input');
                resetPinState();
              }}
            >
              <Ionicons name="refresh-outline" size={18} color="#fff" />
              <Text style={styles.pinActionText}>Change PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pinActionBtn, { backgroundColor: '#ef4444' }]}
              onPress={() => {
                if (isBiometricEnabled) {
                  setPinMode('deactivate');
                  setPinStep('input');
                  resetPinState();
                } else {
                  showError('Cannot Deactivate', 'Enable biometric unlock first');
                }
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.pinActionText}>Deactivate PIN</Text>
            </TouchableOpacity>
          </AnimatedRe.View>
        )}
      </AnimatedRe.View>
    );
  };

  const renderQuestionsSection = () => (
    <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
      <View style={styles.pinHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveSection('dashboard')}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#f1f5f9' : '#1e293b'} />
        </TouchableOpacity>
        <Text style={[styles.pinHeaderTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
          {questionStep === 'verify' ? 'Verify Identity' : questionStep === 'edit' ? 'Update Questions' : 'Security Questions'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {questionStep === 'verify' && storedQuestions.length > 0 && (
        <View style={styles.questionsContainer}>
          <Text style={[styles.questionsInfo, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            Answer your current questions to make changes
          </Text>
          {storedQuestions.map((sq, index) => (
            <View key={index} style={[styles.questionCard, isDark && styles.questionCardDark]}>
              <Text style={[styles.questionLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Question {index + 1}
              </Text>
              <Text style={[styles.questionText, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>{sq.question}</Text>
              <TextInput
                style={[styles.questionInput, isDark && styles.questionInputDark, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : `${themeColors.primary}40` }]}
                placeholder="Your answer"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : `${themeColors.primary}80`}
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
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleVerifyAndEdit}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Verify & Continue</Text>}
          </TouchableOpacity>
        </View>
      )}

      {(questionStep === 'select' || questionStep === 'edit') && (
        <View style={styles.questionsContainer}>
          <Text style={[styles.questionsInfo, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {questionStep === 'edit' ? 'Update your security questions' : 'Set up 3 questions for account recovery'}
          </Text>
          {[0, 1, 2].map((slot) => (
            <View key={slot} style={[styles.questionCard, isDark && styles.questionCardDark]}>
              <TouchableOpacity
                style={[styles.questionSelector, isDark && styles.questionSelectorDark, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : `${themeColors.primary}40` }]}
                onPress={() => {
                  setActiveQuestionSlot(slot);
                  setShowQuestionPicker(true);
                }}
              >
                <Text
                  style={[styles.questionSelectorText, { color: selectedQuestionIndices[slot] !== -1 ? (isDark ? '#f1f5f9' : '#1e293b') : isDark ? 'rgba(255,255,255,0.4)' : `${themeColors.primary}80` }]}
                  numberOfLines={2}
                >
                  {selectedQuestionIndices[slot] !== -1
                    ? SECURITY_QUESTIONS_POOL[selectedQuestionIndices[slot]]
                    : `Select Question ${slot + 1}`}
                </Text>
                <Ionicons name="chevron-down" size={18} color={themeColors.primary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.questionInput, isDark && styles.questionInputDark, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : `${themeColors.primary}40` }]}
                placeholder={`Answer ${slot + 1}`}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : `${themeColors.primary}80`}
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
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleSaveQuestions}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Save Questions</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Question Picker Modal */}
      <Modal visible={showQuestionPicker} transparent animationType="fade" onRequestClose={() => setShowQuestionPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowQuestionPicker(false)}>
          <View style={[styles.pickerSheet, isDark && styles.pickerSheetDark]}>
            <Text style={[styles.pickerTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
              Select Question {activeQuestionSlot + 1}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
              {SECURITY_QUESTIONS_POOL.filter((_, idx) => !selectedQuestionIndices.includes(idx) || selectedQuestionIndices[activeQuestionSlot] === idx).map((q, idx) => {
                const originalIndex = SECURITY_QUESTIONS_POOL.indexOf(q);
                const isSelected = selectedQuestionIndices[activeQuestionSlot] === originalIndex;
                return (
                  <TouchableOpacity
                    key={originalIndex}
                    style={[styles.pickerItem, isSelected && { backgroundColor: `${themeColors.primary}20` }]}
                    onPress={() => {
                      const next = [...selectedQuestionIndices];
                      next[activeQuestionSlot] = originalIndex;
                      setSelectedQuestionIndices(next);
                      setShowQuestionPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: isDark ? '#f1f5f9' : '#1e293b' }, isSelected && { color: themeColors.primary, fontWeight: '700' }]}>
                      {q}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={themeColors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </AnimatedRe.View>
  );

  const renderBiometricSection = () => {
    const bioName = getBiometricTypeName();
    const bioConfig = availableBiometricTypes[0];

    return (
      <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
        <View style={styles.pinHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setActiveSection('dashboard')}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#f1f5f9' : '#1e293b'} />
          </TouchableOpacity>
          <Text style={[styles.pinHeaderTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>{bioName} Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.bioCard, isDark && styles.bioCardDark]}>
          <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
          <View style={[styles.bioIconCircle, { backgroundColor: bioConfig?.color + '20' || 'rgba(102,126,234,0.2)' }]}>
            <Ionicons name={(bioConfig?.icon || 'finger-print') as any} size={36} color={bioConfig?.color || themeColors.primary} />
          </View>
          <Text style={[styles.bioTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>{bioName}</Text>
          <Text style={[styles.bioDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {bioConfig?.description || 'Use biometric authentication to unlock the app'}
          </Text>

          <View style={styles.bioToggleRow}>
            <Text style={[styles.bioToggleLabel, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
              Enable {bioName} Unlock
            </Text>
            <Switch
              value={isBiometricEnabled}
              onValueChange={handleToggleBiometric}
              disabled={biometricLoading}
              trackColor={{ false: '#d1d5db', true: themeColors.primary + '80' }}
              thumbColor={isBiometricEnabled ? themeColors.primary : '#f9fafb'}
            />
          </View>

          {isBiometricEnabled && securitySettings.isPinEnabled && (
            <AnimatedRe.View entering={FadeInUp.duration(400)} style={styles.bioPriorityBox}>
              <Ionicons name="information-circle-outline" size={18} color={themeColors.primary} />
              <Text style={[styles.bioPriorityText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {bioName} is now your primary unlock method. PIN will be used as fallback.
              </Text>
            </AnimatedRe.View>
          )}

          {isBiometricEnabled && !securitySettings.isPinEnabled && (
            <AnimatedRe.View entering={FadeInUp.duration(400)} style={[styles.bioPriorityBox, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="warning-outline" size={18} color="#f59e0b" />
              <Text style={[styles.bioPriorityText, { color: '#92400e' }]}>
                No fallback method! If {bioName} fails, you may be locked out. Set a PIN for safety.
              </Text>
            </AnimatedRe.View>
          )}
        </View>
      </AnimatedRe.View>
    );
  };

  const renderTimeoutSection = () => (
    <AnimatedRe.View entering={SlideInRight.duration(400)} exiting={SlideOutLeft.duration(300)} style={styles.section}>
      <View style={styles.pinHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveSection('dashboard')}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#f1f5f9' : '#1e293b'} />
        </TouchableOpacity>
        <Text style={[styles.pinHeaderTitle, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>Auto-Lock Timeout</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.timeoutDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
        Automatically lock the app after a period of inactivity
      </Text>

      <View style={styles.timeoutGrid}>
        {AUTO_LOCK_OPTIONS.map((minutes) => (
          <TouchableOpacity
            key={minutes}
            style={[
              styles.timeoutOption,
              selectedTimeout === minutes && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
              isDark && selectedTimeout !== minutes && styles.timeoutOptionDark,
            ]}
            onPress={() => handleTimeoutChange(minutes)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.timeoutOptionText,
                selectedTimeout === minutes && { color: '#fff', fontWeight: '700' },
                isDark && selectedTimeout !== minutes && { color: '#f1f5f9' },
              ]}
            >
              {minutes}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.timeoutPreview, isDark && styles.timeoutPreviewDark]}>
        <Ionicons name="time-outline" size={20} color={themeColors.primary} />
        <Text style={[styles.timeoutPreviewText, { color: isDark ? '#f1f5f9' : '#1e293b' }]}>
          App will lock after <Text style={{ fontWeight: '700', color: themeColors.primary }}>{selectedTimeout} minute{selectedTimeout > 1 ? 's' : ''}</Text> of inactivity
        </Text>
      </View>
    </AnimatedRe.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b', '#0f172a'] : [themeColors.primary, themeColors.secondary, '#f093fb']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeSection === 'dashboard' && renderDashboard()}
          {activeSection === 'pin' && renderPinSection()}
          {activeSection === 'questions' && renderQuestionsSection()}
          {activeSection === 'biometric' && renderBiometricSection()}
          {activeSection === 'timeout' && renderTimeoutSection()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { ...StyleSheet.absoluteFillObject, opacity: 0.15 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20 },
  section: { paddingTop: 8 },
  sectionHeader: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 24, marginBottom: 12, marginLeft: 4 },

  scoreCard: { borderRadius: 24, padding: 24, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  scoreCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  scoreTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  scoreBadgeText: { fontSize: 13, fontWeight: '700' },
  scoreBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scorePercent: { fontSize: 16, fontWeight: '800', minWidth: 40 },
  scoreHint: { fontSize: 13, marginTop: 12, lineHeight: 18 },

  card: { borderRadius: 20, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  cardDark: { borderColor: 'rgba(255,255,255,0.06)' },
  cardGlow: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  cardSubtitle: { fontSize: 13, lineHeight: 18 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  pinHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pinHeaderTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  pinCard: { borderRadius: 28, padding: 32, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  pinCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  pinSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },
  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 12 },
  hintText: { fontSize: 14, fontWeight: '600' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, paddingHorizontal: 20 },
  keypadBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  keypadBtnDark: { backgroundColor: 'rgba(40,40,50,0.9)' },
  keypadBtnText: { fontSize: 26, fontWeight: '600', color: '#1e293b' },
  keypadBtnTextDark: { color: '#f1f5f9' },
  pinActions: { flexDirection: 'row', gap: 12, marginTop: 28, paddingHorizontal: 20 },
  pinActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  pinActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  questionsContainer: { gap: 14 },
  questionsInfo: { fontSize: 14, textAlign: 'center', marginBottom: 8, lineHeight: 20 },
  questionCard: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  questionCardDark: { backgroundColor: 'rgba(30,41,59,0.8)', borderColor: 'rgba(255,255,255,0.06)' },
  questionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  questionText: { fontSize: 15, fontWeight: '600', marginBottom: 10, lineHeight: 20 },
  questionSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, marginBottom: 8 },
  questionSelectorDark: { backgroundColor: 'rgba(30,41,59,0.8)' },
  questionSelectorText: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8, lineHeight: 20 },
  questionInput: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '500', borderWidth: 1, color: '#1e293b' },
  questionInputDark: { backgroundColor: 'rgba(30,41,59,0.8)', color: '#f1f5f9' },
  actionBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: height * 0.6 },
  pickerSheetDark: { backgroundColor: '#1e293b' },
  pickerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  pickerScroll: { maxHeight: 300 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4 },
  pickerItemText: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: 8, lineHeight: 20 },

  bioCard: { borderRadius: 28, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  bioCardDark: { borderColor: 'rgba(255,255,255,0.08)' },
  bioIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  bioTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  bioDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20, paddingHorizontal: 20 },
  bioToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  bioToggleLabel: { fontSize: 16, fontWeight: '600' },
  bioPriorityBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: 14, backgroundColor: 'rgba(102,126,234,0.08)', borderRadius: 14, width: '100%' },
  bioPriorityText: { fontSize: 13, lineHeight: 18, flex: 1 },

  timeoutDesc: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20, paddingHorizontal: 20 },
  timeoutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 24 },
  timeoutOption: { width: (width - 72) / 3, paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'rgba(255,255,255,0.9)' },
  timeoutOptionDark: { backgroundColor: 'rgba(30,41,59,0.8)', borderColor: 'rgba(255,255,255,0.1)' },
  timeoutOptionText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  timeoutPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  timeoutPreviewDark: { backgroundColor: 'rgba(30,41,59,0.8)', borderColor: 'rgba(255,255,255,0.06)' },
  timeoutPreviewText: { fontSize: 14, lineHeight: 20, flex: 1 },
});
