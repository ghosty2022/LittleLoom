// src/screens/ChangePinScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  useColorScheme,
  BackHandler,
  ActivityIndicator,
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

const PIN_LENGTH = 4;

type PinStep = 'current' | 'new' | 'confirm';

// Modern color palette
const COLORS = {
  primary: { light: '#667eea', dark: '#a3bffa' },
  success: { light: '#43e97b', dark: '#51cf66' },
  danger: { light: '#ff4757', dark: '#ff6b6b' },
  text: { light: '#1a1a1a', dark: '#ffffff' },
  subtext: { light: '#666', dark: '#a0a0a0' },
};

export default function ChangePinScreen({ navigation }: ChangePinScreenProps) {
  const [step, setStep] = useState<PinStep>('new');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [displayPin, setDisplayPin] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    settings: securitySettings, 
    setupPin, 
    verifyPin, 
    changePin 
  } = useSecurity();
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

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

  const shake = () => {
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
        setTimeout(() => handlePinComplete(newDisplayPin), 100);
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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            shake();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setDisplayPin('');
            Alert.alert('Incorrect PIN', 'Please try again');
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
              Alert.alert(
                'Success',
                'PIN has been set successfully',
                [{ text: 'OK', onPress: handleDismiss }]
              );
            } else {
              shake();
              Alert.alert('Error', 'Failed to set PIN');
              setStep(securitySettings.isPinEnabled ? 'current' : 'new');
              setDisplayPin('');
            }
          } else {
            shake();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setDisplayPin('');
            Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
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
      case 'new': return securitySettings.isPinEnabled ? 'Enter New PIN' : 'Create PIN';
      case 'confirm': return 'Confirm New PIN';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'current': return 'Verify your identity';
      case 'new': return 'Choose a 4-digit PIN';
      case 'confirm': return 'Enter the same PIN again';
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
                i < displayPin.length && styles.pinDotFilled,
                isDark && styles.pinDotDark,
                i < displayPin.length && isDark && styles.pinDotFilledDark,
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
    <LinearGradient 
      colors={isDark ? ['#0f0f1e', '#1a1a2e', '#16213e'] : ['#f8faff', '#f0f4ff', '#e8eeff']} 
      style={styles.container}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleDismiss}>
            <BlurView intensity={80} style={[styles.backBlur, isDark && styles.backBlurDark]}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : COLORS.primary.light} />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Glass Card */}
        <BlurView 
          intensity={isDark ? 60 : 90} 
          style={styles.glassCard} 
          tint={isDark ? 'dark' : 'light'}
        >
          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            {[1, 2, 3].map((s, i) => {
              const stepIndex = step === 'current' ? 0 : step === 'new' ? 1 : 2;
              return (
                <View 
                  key={s} 
                  style={[
                    styles.stepDot,
                    i <= stepIndex && styles.stepDotActive,
                    isDark && styles.stepDotDark,
                    i <= stepIndex && isDark && styles.stepDotActiveDark,
                  ]} 
                />
              );
            })}
          </View>

          <Text style={[styles.title, isDark && styles.titleDark]}>
            {getStepTitle()}
          </Text>
          
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            {getStepSubtitle()}
          </Text>

          {/* PIN Display */}
          {renderPinDots()}

          {/* Loading */}
          {isLoading && (
            <ActivityIndicator 
              size="small" 
              color={isDark ? COLORS.primary.dark : COLORS.primary.light} 
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
                  return <View key="empty" style={styles.keypadButton} />;
                }
                
                if (key === 'delete') {
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.keypadButton, styles.deleteButton]}
                      onPress={handleDelete}
                      disabled={displayPin.length === 0 || isLoading}
                    >
                      <Ionicons 
                        name="backspace-outline" 
                        size={24} 
                        color={displayPin.length > 0 ? (isDark ? '#fff' : COLORS.text.light) : '#999'} 
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
                      isLoading && styles.keypadTextDisabled
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    width: '100%',
    marginBottom: 20 
  },
  backButton: { 
    borderRadius: 16, 
    overflow: 'hidden' 
  },
  backBlur: { 
    padding: 12, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  backBlurDark: { 
    backgroundColor: 'rgba(30,30,40,0.8)', 
    borderColor: 'rgba(255,255,255,0.1)' 
  },
  glassCard: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 30,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(102,126,234,0.3)',
  },
  stepDotActive: {
    backgroundColor: COLORS.primary.light,
  },
  stepDotDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepDotActiveDark: {
    backgroundColor: COLORS.primary.dark,
  },
  title: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: COLORS.text.light, 
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  titleDark: { 
    color: COLORS.text.dark 
  },
  subtitle: { 
    fontSize: 15, 
    color: COLORS.subtext.light, 
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitleDark: { 
    color: COLORS.subtext.dark 
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(102,126,234,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  pinDotDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pinDotFilled: {
    backgroundColor: COLORS.primary.light,
    borderColor: COLORS.primary.light,
  },
  pinDotFilledDark: {
    backgroundColor: COLORS.primary.dark,
    borderColor: COLORS.primary.dark,
  },
  loadingIndicator: {
    marginTop: 16,
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
  deleteButton: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  keypadText: {
    fontSize: 26,
    fontWeight: '600',
    color: COLORS.text.light,
  },
  keypadTextDark: {
    color: COLORS.text.dark,
  },
  keypadTextDisabled: {
    color: '#999',
  },
});