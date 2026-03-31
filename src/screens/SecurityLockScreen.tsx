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
  AppState,
  ActivityIndicator,
  Platform,
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

// Modern, refined color palette
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

// Modern Biometric Icon Component
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
      {isFace && (
        <View style={styles.faceScanLine}>
          <Animated.View style={styles.scanLine} />
        </View>
      )}
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
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pinProgress] = useState(new Animated.Value(0));
  
  const { signOut } = useAuth();
  const { 
    unlockApp, 
    settings: securitySettings, 
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    authenticateWithBiometric,
    getAvailableAuthMethods,
  } = useSecurity();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? COLORS.dark : COLORS.light;
  const insets = useSafeAreaInsets();
  
  const availableMethods = getAvailableAuthMethods();
  const hasBiometric = availableMethods.hasBiometric;
  const hasPin = availableMethods.hasPin;

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

  // Auto-prompt biometric with proper dependencies
  useEffect(() => {
    if (!securitySettings.isBiometricEnabled) return;
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (pin.length > 0) return;
    if (isLockedOut) return;

    const timer = setTimeout(() => {
      setShowBiometricPrompt(true);
      handleBiometricAuth();
    }, 600);

    return () => clearTimeout(timer);
  }, [
    securitySettings.isBiometricEnabled,
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    isLockedOut
    // Intentionally not including pin.length to avoid re-triggering when typing
  ]);

  // Re-check biometric on foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !isLockedOut && !isLoading && pin.length === 0) {
        if (securitySettings.isBiometricEnabled && hasBiometric) {
          setTimeout(() => handleBiometricAuth(), 300);
        }
      }
    });
    
    return () => subscription.remove();
  }, [securitySettings.isBiometricEnabled, hasBiometric, isLockedOut, isLoading]);

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
    if (isLockedOut) return;
    
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
      setIsLoading(false);
    }
  }, [unlockApp, shake, attempts, isLockedOut, handleLockout]);

  const handleNumberPress = useCallback((num: string) => {
    if (pin.length < PIN_LENGTH && !isLoading && !isLockedOut) {
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

  const handleBiometricAuth = useCallback(async () => {
    if (!isBiometricHardwareAvailable || !isBiometricEnrolled) return;
    if (!securitySettings.isBiometricEnabled) return;
    if (isLockedOut || isLoading) return;
    if (!showBiometricPrompt) return;

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await authenticateWithBiometric(`Unlock with ${biometricType}`);
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await unlockApp('biometric');
      } else {
        if (result.error === 'user_cancel') {
          // User cancelled - don't treat as error, just allow PIN entry
          return;
        }
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        if (result.error === 'not_enrolled' || result.error === 'not_available') {
          Alert.alert('Biometric Unavailable', 'Please use your PIN to unlock.');
        }
      }
    } catch (error) {
      console.error('Biometric error:', error);
    } finally {
      setIsLoading(false);
      setShowBiometricPrompt(false);
    }
  }, [
    isBiometricHardwareAvailable,
    isBiometricEnrolled,
    securitySettings.isBiometricEnabled,
    isLockedOut,
    isLoading,
    authenticateWithBiometric,
    biometricType,
    unlockApp,
    showBiometricPrompt
  ]);

  // Modern PIN Dots with animation
  const renderPinDots = () => (
    <Animated.View 
      style={[
        styles.pinContainer, 
        { transform: [{ translateX: shakeAnim }] }
      ]}
    >
      {Array.from({ length: PIN_LENGTH }).map((_, index) => {
        const isFilled = index < pin.length;
        const isCurrent = index === pin.length;
        
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
                (isLoading || isLockedOut) && styles.keypadButtonDisabled
              ]}
              onPress={() => handleNumberPress(key)}
              disabled={isLoading || isLockedOut}
              activeOpacity={0.7}
            >
              <Text style={[styles.keypadButtonText, { color: colors.text }]}>
                {key}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* Biometric Button */}
          <TouchableOpacity
            style={[
              styles.keypadButton,
              styles.keypadButtonSpecial,
              (isLoading || isLockedOut || !hasBiometric) && styles.keypadButtonDisabled
            ]}
            onPress={handleBiometricAuth}
            disabled={isLoading || isLockedOut || !hasBiometric}
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
          
          {/* Zero */}
          <TouchableOpacity
            style={[
              styles.keypadButton,
              { backgroundColor: colors.surfaceHighlight },
              (isLoading || isLockedOut) && styles.keypadButtonDisabled
            ]}
            onPress={() => handleNumberPress('0')}
            disabled={isLoading || isLockedOut}
            activeOpacity={0.7}
          >
            <Text style={[styles.keypadButtonText, { color: colors.text }]}>0</Text>
          </TouchableOpacity>
          
          {/* Delete */}
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
          
          {/* Header Section */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
              <Ionicons name="lock-closed" size={32} color={colors.primary} />
            </View>
            
            <Text style={[styles.title, { color: colors.text }]}>
              Welcome Back
            </Text>
            
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {hasBiometric && hasPin 
                ? `Use ${biometricType} or enter PIN`
                : hasPin 
                  ? 'Enter your PIN to continue'
                  : `Use ${biometricType} to unlock`
              }
            </Text>

            {/* Attempts Warning */}
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

          {/* Biometric Section (if enabled) */}
          {hasBiometric && !isLockedOut && (
            <View style={styles.biometricSection}>
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <BiometricIcon 
                  type={biometricType} 
                  size={100} 
                  color={colors.primary}
                  isDark={isDark}
                />
                <Text style={[styles.biometricLabel, { color: colors.primary }]}>
                  Tap to unlock
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PIN Section */}
          {hasPin && (
            <View style={styles.pinSection}>
              {renderPinDots()}
              
              {/* Loading Indicator */}
              {isLoading && (
                <ActivityIndicator 
                  size="small" 
                  color={colors.primary} 
                  style={styles.loadingIndicator}
                />
              )}
              
              {/* Keypad */}
              {renderKeypad()}
            </View>
          )}

          {/* Footer */}
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
  
  // Header
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

  // Biometric Section
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
  faceScanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 50,
  },
  scanLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#6366F1',
    opacity: 0.6,
  },
  biometricLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },

  // PIN Section
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

  // Keypad
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

  // Footer
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