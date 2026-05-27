// src/screens/ChangePinScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useColorScheme,
  BackHandler,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSecurity } from '../context/SecurityContext';
import type { RootStackParamList } from '../types/navigation';

type ChangePinScreenProps = NativeStackScreenProps<RootStackParamList, 'ChangePin'>;
const { width } = Dimensions.get('window');

const PIN_LENGTH = 4;
type PinStep = 'current' | 'new' | 'confirm';

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const SweetAlert = ({ visible, type, title, message, onClose, isDark }: AlertState & { onClose: () => void; isDark: boolean }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 12, useNativeDriver: true }),
      ]).start();
      
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.8, duration: 300, useNativeDriver: true }),
        ]).start(() => onClose());
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle', bg: isDark ? '#1a1a2e' : '#fff' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning', bg: isDark ? '#1a1a2e' : '#fff' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100, pointerEvents: 'none' }]}>
      <Animated.View style={[{ opacity, transform: [{ scale }] }, styles.alertContainer, { backgroundColor: config.bg }]}>
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

export default function ChangePinScreen({ navigation }: ChangePinScreenProps) {
  const [step, setStep] = useState<PinStep>('new');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [displayPin, setDisplayPin] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  
  const { settings: securitySettings, setupPin, verifyPin, changePin, resetUnlockLock } = useSecurity();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // CRITICAL FIX: Reset stuck locks on mount and focus so the PIN flow never inherits a stale locked state
  useEffect(() => {
    resetUnlockLock();
    
    const unsubscribe = navigation.addListener('focus', () => {
      resetUnlockLock();
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

  useEffect(() => {
    if (securitySettings.isPinEnabled) {
      setStep('current');
    } else {
      setStep('new');
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDismiss();
      return true;
    });
    return () => backHandler.remove();
  }, [securitySettings.isPinEnabled]);

  const showToast = (type: AlertState['type'], title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  };

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleDismiss = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Settings' });
    }
  };

  const handlePinPress = (digit: string) => {
    if (displayPin.length < PIN_LENGTH && !isLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newDisplayPin = displayPin + digit;
      setDisplayPin(newDisplayPin);
      
      if (newDisplayPin.length === PIN_LENGTH) {
        setTimeout(() => handlePinComplete(newDisplayPin), 150);
      }
    }
  };

  const handlePinComplete = async (completedPin: string) => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      switch (step) {
        case 'current':
          const isValid = await verifyPin(completedPin);
          if (isValid) {
            setCurrentPin(completedPin);
            setStep('new');
            setDisplayPin('');
            showToast('success', 'Verified', 'Enter your new PIN');
          } else {
            shake();
            setDisplayPin('');
            showToast('error', 'Incorrect PIN', 'Please try again');
          }
          break;

        case 'new':
          setNewPin(completedPin);
          setStep('confirm');
          setDisplayPin('');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;

        case 'confirm':
          if (completedPin === newPin) {
            setConfirmPin(completedPin);
            let success;
            if (securitySettings.isPinEnabled) {
              success = await changePin(currentPin, newPin);
            } else {
              success = await setupPin(newPin);
            }
            
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showToast('success', 'Success!', 'PIN has been set successfully');
              setTimeout(handleDismiss, 1500);
            } else {
              shake();
              showToast('error', 'Error', 'Failed to set PIN');
              setStep(securitySettings.isPinEnabled ? 'current' : 'new');
              setDisplayPin('');
            }
          } else {
            shake();
            setDisplayPin('');
            showToast('error', 'PIN Mismatch', 'PINs do not match. Try again.');
            setStep('new');
          }
          break;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (displayPin.length > 0 && !isLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDisplayPin(displayPin.slice(0, -1));
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'current': return 'Enter Current PIN';
      case 'new': return securitySettings.isPinEnabled ? 'Create New PIN' : 'Create PIN';
      case 'confirm': return 'Confirm New PIN';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'current': return 'Verify your identity to continue';
      case 'new': return 'Choose a secure 4-digit PIN';
      case 'confirm': return 'Re-enter your PIN to confirm';
    }
  };

  const getStepColor = () => {
    switch (step) {
      case 'current': return '#667eea';
      case 'new': return '#11998e';
      case 'confirm': return '#f59e0b';
    }
  };

  const renderPinDots = () => {
    return (
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <View style={styles.pinContainer}>
          {[...Array(PIN_LENGTH)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.pinDot,
                { 
                  borderColor: getStepColor(),
                  backgroundColor: i < displayPin.length ? getStepColor() : 'transparent'
                },
                isDark && !i < displayPin.length && { borderColor: 'rgba(255,255,255,0.3)' }
              ]}
            />
          ))}
        </View>
      </Animated.View>
    );
  };

  const keypadRows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'delete']
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <LinearGradient 
        colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']} 
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.backButton, isDark && styles.backButtonDark]} 
            onPress={handleDismiss}
          >
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#667eea'} />
          </TouchableOpacity>
        </View>

        {/* Main Glass Card */}
        <View style={styles.mainContainer}>
          <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
            <LinearGradient
              colors={isDark ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            
            {/* Step Indicator */}
            <View style={styles.stepIndicator}>
              {['current', 'new', 'confirm'].map((s, i) => {
                const stepIndex = step === 'current' ? 0 : step === 'new' ? 1 : 2;
                const isActive = i <= stepIndex;
                return (
                  <View key={s} style={styles.stepRow}>
                    <View 
                      style={[
                        styles.stepDot,
                        isActive && { backgroundColor: getStepColor() },
                        !isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                      ]} 
                    />
                    {i < 2 && (
                      <View 
                        style={[
                          styles.stepLine,
                          i < stepIndex && { backgroundColor: getStepColor() },
                          i >= stepIndex && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                        ]} 
                      />
                    )}
                  </View>
                );
              })}
            </View>

            <Text style={[styles.title, { color: isDark ? '#fff' : '#1e293b' }]}>
              {getStepTitle()}
            </Text>
            
            <Text style={[styles.subtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              {getStepSubtitle()}
            </Text>

            {renderPinDots()}

            {isLoading && (
              <ActivityIndicator 
                size="small" 
                color={getStepColor()} 
                style={styles.loadingIndicator}
              />
            )}
          </BlurView>

          {/* Keypad */}
          <View style={styles.keypadContainer}>
            {keypadRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) => {
                  if (key === '') {
                    return <View key="empty" style={styles.keypadButtonPlaceholder} />;
                  }
                  
                  if (key === 'delete') {
                    return (
                      <TouchableOpacity
                        key={key}
                        style={styles.keypadButton}
                        onPress={handleDelete}
                        disabled={displayPin.length === 0 || isLoading}
                      >
                        <Ionicons 
                          name="backspace-outline" 
                          size={24} 
                          color={displayPin.length > 0 ? (isDark ? '#fff' : '#1e293b') : '#cbd5e1'} 
                        />
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.keypadButton,
                        isDark && styles.keypadButtonDark,
                        isLoading && styles.keypadButtonDisabled
                      ]}
                      onPress={() => handlePinPress(key)}
                      activeOpacity={0.7}
                      disabled={isLoading}
                    >
                      <Text style={[
                        styles.keypadText,
                        isDark && styles.keypadTextDark,
                      ]}>
                        {key}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: { 
    flex: 1, 
    paddingHorizontal: 24,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginBottom: 20 
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
  
  // Alert
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

  mainContainer: {
    flex: 1,
    alignItems: 'center',
  },
  glassCard: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
    marginBottom: 30,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 8,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: { 
    fontSize: 16, 
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    height: 24,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 320,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  keypadButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  keypadButtonDark: {
    backgroundColor: 'rgba(40,40,50,0.9)',
  },
  keypadButtonDisabled: {
    opacity: 0.5,
  },
  keypadButtonPlaceholder: {
    width: 76,
    height: 76,
  },
  keypadText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1e293b',
  },
  keypadTextDark: {
    color: '#fff',
  },
});