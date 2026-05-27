// src/screens/SecurityLockScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useSecurity } from '../context/SecurityContext';
import type { RootStackParamList } from '../types/navigation';

type SecurityLockScreenProps = NativeStackScreenProps<RootStackParamList, 'SecurityLock'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

const COLORS = {
  light: {
    background: ['#F8F9FE', '#EEF2FF'],
    primary: '#6366F1',
    primaryLight: '#818CF8',
    text: '#1E293B',
    textSecondary: '#64748B',
    surface: '#FFFFFF',
    surfaceHighlight: '#F1F5F9',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    border: '#E2E8F0',
  },
  dark: {
    background: ['#0F172A', '#1E293B'],
    primary: '#818CF8',
    primaryLight: '#A5B4FC',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
    error: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    border: '#334155',
  },
};

const BiometricIcon = ({ 
  type, 
  size = 80, 
  color,
  isDark 
}: { 
  type: string; 
  size?: number; 
  color: string;
  isDark: boolean;
}) => {
  const isFace = type.includes('Face') || type === 'Face ID';
  return (
    <View style={[styles.biometricIconContainer, { width: size, height: size }]}>
      <LinearGradient
        colors={isDark ? ['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)'] : ['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.02)']}
        style={[styles.biometricIconBg, { width: size, height: size }]}
      >
        <Ionicons 
          name={isFace ? 'scan-outline' : 'finger-print'} 
          size={size * 0.5} 
          color={color} 
        />
      </LinearGradient>
    </View>
  );
};

export default function SecurityLockScreen({ navigation }: SecurityLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [pinProgress] = useState(new Animated.Value(0));
  
  const { signOut } = useAuth();
  const { 
    unlockApp, 
    settings: securitySettings, 
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    getAvailableAuthMethods,
    resetUnlockLock,
  } = useSecurity();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? COLORS.dark : COLORS.light;
  const insets = useSafeAreaInsets();
  
  const availableMethods = getAvailableAuthMethods();
  const hasBiometric = availableMethods.hasBiometric;
  const hasPin = availableMethods.hasPin;

  const isMounted = useRef(true);
  const autoPromptTimer = useRef<NodeJS.Timeout | null>(null);
  const unlockInProgress = useRef(false);
  // CRITICAL FIX: Reset hasAutoPrompted on every mount
  const hasAutoPrompted = useRef(false);
  const handleBiometricAuthRef = useRef<(() => Promise<void>) | null>(null);
  // CRITICAL FIX: Track last unlock attempt to prevent rapid-fire
  const lastUnlockAttemptRef = useRef<number>(0);

  // CRITICAL FIX: Reset all locks on mount and cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    // Reset any stuck locks from previous sessions
    resetUnlockLock();
    hasAutoPrompted.current = false;
    unlockInProgress.current = false;
    lastUnlockAttemptRef.current = 0;
    
    return () => {
      isMounted.current = false;
      hasAutoPrompted.current = false;
      if (autoPromptTimer.current) {
        clearTimeout(autoPromptTimer.current);
      }
    };
  }, [resetUnlockLock]);

  // Animate PIN progress
  useEffect(() => {
    Animated.spring(pinProgress, {
      toValue: pin.length,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [pin]);

  // Detect biometric type
  useEffect(() => {
    const detectBiometricType = async () => {
      try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('Iris Scan');
        }
      } catch (error) {
        console.error('Error detecting biometric type:', error);
      }
    };
    detectBiometricType();
  }, []);

  // CRITICAL FIX: Auto-prompt with proper guards and reset capability
  useEffect(() => {
    if (!securitySettings.isBiometricEnabled) return;
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (isLockedOut) return;
    if (hasAutoPrompted.current) return;
    if (unlockInProgress.current) return;

    autoPromptTimer.current = setTimeout(() => {
      if (
        isMounted.current && 
        !unlockInProgress.current && 
        !isLockedOut && 
        !hasAutoPrompted.current &&
        handleBiometricAuthRef.current
      ) {
        hasAutoPrompted.current = true;
        handleBiometricAuthRef.current();
      }
    }, 600);

    return () => {
      if (autoPromptTimer.current) {
        clearTimeout(autoPromptTimer.current);
      }
    };
  }, [
    securitySettings.isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    isLockedOut,
  ]);

  // CRITICAL FIX: Listen for focus events to reset auto-prompt when returning to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      hasAutoPrompted.current = false;
      unlockInProgress.current = false;
      resetUnlockLock();
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  // CRITICAL FIX: Listen for app coming from background to re-prompt biometric
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !isLockedOut && !unlockInProgress.current) {
        // Reset auto-prompt when coming from background so biometric fires again
        hasAutoPrompted.current = false;
      }
    });
    return () => subscription.remove();
  }, [isLockedOut]);

  const shake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleLockout = useCallback(() => {
    setIsLockedOut(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      'Too Many Attempts',
      'For security purposes, you need to sign out and sign in again.',
      [{ 
        text: 'Sign Out', 
        onPress: () => signOut(),
        style: 'destructive'
      }]
    );
  }, [signOut]);

  const handlePinComplete = useCallback(async (completedPin: string) => {
    if (isLockedOut || unlockInProgress.current) return;
    
    unlockInProgress.current = true;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const success = await unlockApp('pin', completedPin);
      
      if (!success) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        shake();
        setPin('');
        
        if (newAttempts >= MAX_ATTEMPTS) {
          handleLockout();
        } else {
          const remaining = MAX_ATTEMPTS - newAttempts;
          if (remaining <= 2) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setTimeout(() => {
              Alert.alert('Incorrect PIN', `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
            }, 200);
          }
        }
      } else {
        setAttempts(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      shake();
      setPin('');
    } finally {
      unlockInProgress.current = false;
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [unlockApp, shake, attempts, isLockedOut, handleLockout]);

  const handleNumberPress = useCallback((num: string) => {
    if (pin.length < PIN_LENGTH && !isLoading && !isLockedOut && !unlockInProgress.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === PIN_LENGTH) {
        setTimeout(() => handlePinComplete(newPin), 150);
      }
    }
  }, [pin, isLoading, isLockedOut, handlePinComplete]);

  const handleDelete = useCallback(() => {
    if (pin.length > 0 && !isLoading && !isLockedOut) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin(prev => prev.slice(0, -1));
    }
  }, [pin.length, isLoading, isLockedOut]);

  // CRITICAL FIX: Throttle biometric attempts and clear locks before attempting
  const handleBiometricAuth = useCallback(async () => {
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (!securitySettings.isBiometricEnabled) return;
    if (isLockedOut || isLoading || unlockInProgress.current) return;

    // Throttle: prevent attempts within 1.5 seconds of each other
    const now = Date.now();
    if (now - lastUnlockAttemptRef.current < 1500) {
      console.log('⏸️ Biometric attempt throttled');
      return;
    }
    lastUnlockAttemptRef.current = now;

    // CRITICAL FIX: Clear any stuck locks before attempting
    resetUnlockLock();
    unlockInProgress.current = true;
    setIsLoading(true);
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await unlockApp('biometric');
      
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // AppNavigator automatically navigates away when isSecurityLocked becomes false
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        // Small shake to indicate failure but stay on screen
        shake();
      }
    } catch (error) {
      console.error('Biometric error:', error);
    } finally {
      unlockInProgress.current = false;
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    securitySettings.isBiometricEnabled,
    isLockedOut,
    unlockApp,
    resetUnlockLock,
    shake,
  ]);

  // Keep ref synced so the mount auto-prompt always calls the latest handler
  useEffect(() => {
    handleBiometricAuthRef.current = handleBiometricAuth;
  }, [handleBiometricAuth]);

  const renderPinDots = () => (
    <Animated.View 
      style={[
        styles.pinContainer, 
        { transform: [{ translateX: shakeAnim }] }
      ]}
    >
      {Array.from({ length: PIN_LENGTH }).map((_, index) => {
        const isFilled = index < pin.length;
        return (
          <Animated.View
            key={index}
            style={[
              styles.pinDot,
              {
                backgroundColor: isFilled ? colors.primary : 'transparent',
                borderColor: isFilled ? colors.primary : colors.border,
                transform: [{
                  scale: pinProgress.interpolate({
                    inputRange: [index - 0.5, index, index + 0.5],
                    outputRange: [1, 1.3, 1],
                    extrapolate: 'clamp'
                  })
                }]
              }
            ]}
          />
        );
      })}
    </Animated.View>
  );

  const renderKeypad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return (
      <View style={styles.keypadContainer}>
        <View style={styles.keypadGrid}>
          {keys.map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.keypadButton,
                { backgroundColor: colors.surfaceHighlight },
                (isLoading || isLockedOut || unlockInProgress.current) && styles.keypadButtonDisabled
              ]}
              onPress={() => handleNumberPress(key)}
              disabled={isLoading || isLockedOut || unlockInProgress.current}
              activeOpacity={0.7}
            >
              <Text style={[styles.keypadButtonText, { color: colors.text }]}>{key}</Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (isLoading || isLockedOut || !hasBiometric || unlockInProgress.current) && styles.keypadButtonDisabled
            ]}
            onPress={handleBiometricAuth}
            disabled={isLoading || isLockedOut || !hasBiometric || unlockInProgress.current}
          >
            {hasBiometric ? (
              <Ionicons 
                name={biometricType.includes('Face') ? 'scan-outline' : 'finger-print'} 
                size={28} 
                color={colors.primary} 
              />
            ) : (
              <View style={{ width: 28 }} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.keypadButton,
              { backgroundColor: colors.surfaceHighlight },
              (isLoading || isLockedOut || unlockInProgress.current) && styles.keypadButtonDisabled
            ]}
            onPress={() => handleNumberPress('0')}
            disabled={isLoading || isLockedOut || unlockInProgress.current}
            activeOpacity={0.7}
          >
            <Text style={[styles.keypadButtonText, { color: colors.text }]}>0</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (pin.length === 0 || isLoading || isLockedOut) && styles.keypadButtonDisabled
            ]}
            onPress={handleDelete}
            disabled={pin.length === 0 || isLoading || isLockedOut}
          >
            <Ionicons 
              name="backspace-outline" 
              size={24} 
              color={pin.length > 0 ? colors.textSecondary : colors.border} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <LinearGradient
        colors={colors.background as [string, string]}
        style={styles.gradient}
      >
        <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
          
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
              <Ionicons name="lock-closed" size={32} color={colors.primary} />
            </View>
            
            <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
            
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {hasBiometric && hasPin 
                ? `Use ${biometricType} or enter PIN`
                : hasPin 
                  ? 'Enter your PIN to continue'
                  : `Use ${biometricType} to unlock`
              }
            </Text>

            {attempts > 0 && !isLockedOut && (
              <View style={[styles.attemptsBadge, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.attemptsText, { color: colors.warning }]}>
                  {MAX_ATTEMPTS - attempts} attempts remaining
                </Text>
              </View>
            )}
            
            {isLockedOut && (
              <View style={[styles.attemptsBadge, { backgroundColor: colors.error + '20' }]}>
                <Text style={[styles.attemptsText, { color: colors.error }]}>Locked Out</Text>
              </View>
            )}
          </View>

          {hasBiometric && !isLockedOut && (
            <View style={styles.biometricSection}>
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
                disabled={isLoading || unlockInProgress.current}
                activeOpacity={0.8}
              >
                <BiometricIcon 
                  type={biometricType} 
                  size={100} 
                  color={colors.primary}
                  isDark={isDark}
                />
                <Text style={[styles.biometricLabel, { color: colors.primary }]}>
                  {isLoading ? 'Authenticating...' : 'Tap to unlock'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {hasPin && (
            <View style={styles.pinSection}>
              {renderPinDots()}
              {isLoading && (
                <ActivityIndicator 
                  size="small" 
                  color={colors.primary} 
                  style={styles.loadingIndicator}
                />
              )}
              {renderKeypad()}
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.emergencyButton}
              onPress={() => {
                Alert.alert(
                  'Sign Out',
                  'Are you sure you want to sign out?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Sign Out', 
                      style: 'destructive',
                      onPress: () => signOut()
                    }
                  ]
                );
              }}
            >
              <Text style={[styles.emergencyText, { color: colors.error }]}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  attemptsBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  attemptsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  biometricSection: {
    alignItems: 'center',
    marginBottom: 40,
    height: 140,
    justifyContent: 'center',
  },
  biometricButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  biometricIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricIconBg: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  biometricLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  pinSection: {
    flex: 1,
    alignItems: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
    height: 24,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  loadingIndicator: {
    marginBottom: 20,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  keypadButton: {
    width: (SCREEN_WIDTH - 80) / 3,
    height: (SCREEN_WIDTH - 80) / 3,
    maxWidth: 90,
    maxHeight: 90,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  keypadButtonSpecial: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  keypadButtonDisabled: {
    opacity: 0.3,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 20,
    alignItems: 'center',
  },
  emergencyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emergencyText: {
    fontSize: 15,
    fontWeight: '600',
  },
});