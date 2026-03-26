// src/screens/BiometricSetupScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Easing,
  useColorScheme,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSecurity } from '../context/SecurityContext';
import type { RootStackParamList } from '../types/navigation';

type BiometricSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'BiometricSetup'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Modern color palette
const COLORS = {
  primary: { light: '#667eea', dark: '#a3bffa' },
  success: { light: '#43e97b', dark: '#51cf66' },
  danger: { light: '#ff4757', dark: '#ff6b6b' },
  warning: { light: '#ffa502', dark: '#ffc107' },
  text: { light: '#1a1a1a', dark: '#ffffff' },
  subtext: { light: '#666', dark: '#a0a0a0' },
};

// Biometric type configuration
interface BiometricTypeConfig {
  type: LocalAuthentication.AuthenticationType;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const useSafeGoBack = (navigation: any) => {
  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Settings' });
    }
  }, [navigation]);
};

const BiometricIcon = ({ 
  isScanning, 
  isDark, 
  biometricType,
  iconName,
}: { 
  isScanning: boolean; 
  isDark: boolean;
  biometricType: string;
  iconName: string;
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ]),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }

    return () => {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    };
  }, [isScanning, pulseAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.biometricIconContainer,
        {
          transform: [
            { scale: pulseAnim },
            { rotate: isScanning ? rotate : '0deg' }
          ],
        },
      ]}
    >
      <LinearGradient
        colors={isScanning ? ['#667eea', '#764ba2'] : (isDark ? ['#333', '#444'] : ['#e0e7ff', '#d1d5ff'])}
        style={styles.biometricGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons 
          name={iconName as any} 
          size={60} 
          color={isScanning ? '#fff' : (isDark ? COLORS.primary.dark : COLORS.primary.light)} 
        />
      </LinearGradient>
      {isScanning && (
        <View style={styles.scanningOverlay}>
          <Animated.View style={[styles.scanLine, { opacity: pulseAnim }]} />
        </View>
      )}
    </Animated.View>
  );
};

export default function BiometricSetupScreen({ navigation }: BiometricSetupScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<BiometricTypeConfig[]>([]);
  const [selectedType, setSelectedType] = useState<BiometricTypeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  
  const { toggleBiometric, settings: securitySettings } = useSecurity();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const successScale = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const safeGoBack = useSafeGoBack(navigation);

  // Get all available biometric configurations
  const getBiometricConfigs = (types: LocalAuthentication.AuthenticationType[]): BiometricTypeConfig[] => {
    const configs: BiometricTypeConfig[] = [];
    
    types.forEach(type => {
      switch (type) {
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          configs.push({
            type,
            name: 'Face ID',
            icon: 'scan-outline',
            description: 'Use your face to unlock',
            color: '#667eea',
          });
          break;
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          configs.push({
            type,
            name: 'Fingerprint',
            icon: 'finger-print',
            description: 'Use your fingerprint to unlock',
            color: '#43e97b',
          });
          break;
        case LocalAuthentication.AuthenticationType.IRIS:
          configs.push({
            type,
            name: 'Iris Scan',
            icon: 'eye',
            description: 'Use your eyes to unlock',
            color: '#ffa502',
          });
          break;
      }
    });
    
    return configs;
  };

  useEffect(() => {
    checkBiometricAvailability();
    
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (setupComplete) {
      Animated.spring(successScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
      
      // FIXED: Navigation timeout increased and forced
      const timer = setTimeout(() => {
        console.log('🟢 Setup complete - navigating back');
        // Force navigation with replace to avoid stack issues
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main', { screen: 'Settings' });
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [setupComplete, navigation]);

  const checkBiometricAvailability = async () => {
    try {
      const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      console.log('🔵 Biometric check:', { hardwareAvailable, enrolled, types });
      
      setHasHardware(hardwareAvailable);
      setIsEnrolled(enrolled);
      
      if (hardwareAvailable && enrolled && types.length > 0) {
        const configs = getBiometricConfigs(types);
        setAvailableTypes(configs);
        // Select first available by default
        setSelectedType(configs[0]);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Biometric check failed:', error);
      setHasHardware(false);
      setIsEnrolled(false);
      setIsLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a biometric method');
      return;
    }

    if (!hasHardware || !isEnrolled) {
      Alert.alert(
        'Biometric Not Available',
        'Please ensure you have set up biometric authentication in your device settings.'
      );
      return;
    }

    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${selectedType.name} for LittleLoom`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      setIsScanning(false);

      if (result.success) {
        const enabled = await toggleBiometric(true);
        if (enabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSetupComplete(true);
        } else {
          Alert.alert('Error', 'Failed to enable biometric authentication.');
        }
      } else {
        if (result.error === 'user_cancel') {
          console.log('👤 User cancelled biometric setup');
          return;
        }
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        if (result.error === 'not_enrolled' || result.error === 'not_available') {
          Alert.alert(
            'Biometric Unavailable', 
            'Please set up biometric authentication in your device settings first.'
          );
        } else {
          Alert.alert('Authentication Failed', 'Please try again.');
        }
      }
    } catch (error) {
      console.error('Biometric error:', error);
      setIsScanning(false);
      Alert.alert('Error', 'An error occurred during authentication.');
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    safeGoBack();
  };

  const selectBiometricType = (config: BiometricTypeConfig) => {
    if (isScanning) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(config);
  };

  const getBiometricIconName = (typeName: string) => {
    if (typeName.includes('Face')) return 'scan-outline';
    if (typeName.includes('Iris')) return 'eye';
    return 'finger-print';
  };

  if (isLoading) {
    return (
      <LinearGradient 
        colors={isDark ? ['#0f0f1e', '#1a1a2e', '#16213e'] : ['#f8faff', '#f0f4ff', '#e8eeff']} 
        style={styles.container}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.content, { paddingTop: insets.top + 40, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={COLORS.primary.light} />
          <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>Checking biometric availability...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (setupComplete) {
    return (
      <LinearGradient 
        colors={isDark ? ['#0f0f1e', '#1a1a2e', '#16213e'] : ['#f8faff', '#f0f4ff', '#e8eeff']} 
        style={styles.container}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.content, { paddingTop: insets.top + 100 }]}>
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <View style={[styles.successCircle, isDark && styles.successCircleDark]}>
              <Ionicons name="checkmark" size={60} color="#fff" />
            </View>
            <Text style={[styles.successTitle, isDark && styles.successTitleDark]}>
              {selectedType?.name || 'Biometric'} Enabled!
            </Text>
            <Text style={[styles.successSubtitle, isDark && styles.successSubtitleDark]}>
              You can now unlock LittleLoom with {selectedType?.name || 'biometric authentication'}
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient 
      colors={isDark ? ['#0f0f1e', '#1a1a2e', '#16213e'] : ['#f8faff', '#f0f4ff', '#e8eeff']} 
      style={styles.container}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <Animated.View style={[styles.content, { paddingTop: insets.top + 40, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={safeGoBack}>
            <BlurView intensity={80} style={[styles.backBlur, isDark && styles.backBlurDark]}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : COLORS.primary.light} />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.mainContent}>
            {/* Show selected biometric icon or multi-select */}
            {availableTypes.length === 1 ? (
              <View style={styles.iconWrapper}>
                <BiometricIcon 
                  isScanning={isScanning} 
                  isDark={isDark} 
                  biometricType={availableTypes[0].name}
                  iconName={availableTypes[0].icon}
                />
              </View>
            ) : selectedType ? (
              <View style={styles.iconWrapper}>
                <BiometricIcon 
                  isScanning={isScanning} 
                  isDark={isDark} 
                  biometricType={selectedType.name}
                  iconName={selectedType.icon}
                />
              </View>
            ) : null}

            <Text style={[styles.title, isDark && styles.titleDark]}>
              {availableTypes.length > 1 ? 'Choose Biometric Method' : `Enable ${availableTypes[0]?.name || 'Biometric'}`}
            </Text>
            
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              {hasHardware && isEnrolled
                ? availableTypes.length > 1 
                  ? 'Select your preferred biometric authentication method'
                  : `Use ${availableTypes[0]?.name || 'biometric authentication'} for quick and secure access to your baby's memories.`
                : 'Biometric authentication is not available on this device or has not been set up.'
              }
            </Text>

            {/* Multiple biometric options */}
            {availableTypes.length > 1 && (
              <View style={styles.optionsContainer}>
                {availableTypes.map((config) => (
                  <TouchableOpacity
                    key={config.type}
                    style={[
                      styles.optionCard,
                      selectedType?.type === config.type && styles.optionCardSelected,
                      isDark && styles.optionCardDark,
                      selectedType?.type === config.type && isDark && styles.optionCardSelectedDark,
                    ]}
                    onPress={() => selectBiometricType(config)}
                    disabled={isScanning}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: `${config.color}20` }]}>
                      <Ionicons 
                        name={config.icon as any} 
                        size={28} 
                        color={config.color} 
                      />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionName, isDark && styles.optionNameDark]}>
                        {config.name}
                      </Text>
                      <Text style={[styles.optionDescription, isDark && styles.optionDescriptionDark]}>
                        {config.description}
                      </Text>
                    </View>
                    {selectedType?.type === config.type && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={24} color={COLORS.success.light} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {hasHardware && isEnrolled && (
              <View style={styles.benefitsContainer}>
                <View style={styles.benefitItem}>
                  <View style={[styles.benefitIcon, isDark && styles.benefitIconDark]}>
                    <Ionicons name="flash" size={20} color={COLORS.primary.light} />
                  </View>
                  <Text style={[styles.benefitText, isDark && styles.benefitTextDark]}>Quick Access</Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={[styles.benefitIcon, isDark && styles.benefitIconDark]}>
                    <Ionicons name="shield-checkmark" size={20} color={COLORS.success.light} />
                  </View>
                  <Text style={[styles.benefitText, isDark && styles.benefitTextDark]}>Secure</Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={[styles.benefitIcon, isDark && styles.benefitIconDark]}>
                    <Ionicons name="happy" size={20} color={COLORS.danger.light} />
                  </View>
                  <Text style={[styles.benefitText, isDark && styles.benefitTextDark]}>Convenient</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {hasHardware && isEnrolled ? (
            <>
              <TouchableOpacity 
                style={[
                  styles.enableButton,
                  (!selectedType || isScanning) && styles.enableButtonDisabled
                ]}
                onPress={handleEnableBiometric}
                disabled={!selectedType || isScanning}
              >
                <LinearGradient 
                  colors={['#667eea', '#764ba2']} 
                  style={styles.enableGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isScanning ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons 
                        name={selectedType ? (selectedType.icon as any) : 'finger-print'} 
                        size={24} 
                        color="#fff" 
                      />
                      <Text style={styles.enableText}>
                        Enable {selectedType?.name || 'Biometric'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={isScanning}>
                <Text style={[styles.skipText, isDark && styles.skipTextDark]}>Maybe Later</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.unavailableCard, isDark && styles.unavailableCardDark]}>
                <Ionicons name="alert-circle" size={48} color={COLORS.danger.light} />
                <Text style={[styles.unavailableTitle, isDark && styles.unavailableTitleDark]}>
                  {!hasHardware ? 'Not Supported' : 'Not Set Up'}
                </Text>
                <Text style={[styles.unavailableText, isDark && styles.unavailableTextDark]}>
                  {!hasHardware 
                    ? 'This device does not support biometric authentication.'
                    : 'Please set up biometric authentication in your device settings first.'
                  }
                </Text>
              </View>

              <TouchableOpacity style={styles.enableButton} onPress={safeGoBack}>
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.enableGradient}>
                  <Text style={styles.enableText}>Go Back</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  backButton: {
    borderRadius: 16,
    overflow: 'hidden',
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
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mainContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  iconWrapper: {
    marginBottom: 32,
  },
  biometricIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 70,
  },
  scanLine: {
    width: 140,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    position: 'absolute',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text.light,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  titleDark: {
    color: COLORS.text.dark,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.subtext.light,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  subtitleDark: {
    color: COLORS.subtext.dark,
  },
  // Multiple options styles
  optionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardDark: {
    backgroundColor: 'rgba(40,40,50,0.9)',
  },
  optionCardSelected: {
    borderColor: COLORS.primary.light,
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  optionCardSelectedDark: {
    borderColor: COLORS.primary.dark,
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.light,
    marginBottom: 4,
  },
  optionNameDark: {
    color: COLORS.text.dark,
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.subtext.light,
  },
  optionDescriptionDark: {
    color: COLORS.subtext.dark,
  },
  checkmark: {
    marginLeft: 8,
  },
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  benefitItem: {
    alignItems: 'center',
    gap: 8,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitIconDark: {
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  benefitText: {
    fontSize: 13,
    color: COLORS.subtext.light,
    fontWeight: '600',
  },
  benefitTextDark: {
    color: COLORS.subtext.dark,
  },
  buttonContainer: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  enableButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  enableButtonDisabled: {
    opacity: 0.5,
  },
  enableGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  enableText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    alignSelf: 'center',
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    color: COLORS.primary.light,
    fontWeight: '600',
  },
  skipTextDark: {
    color: COLORS.primary.dark,
  },
  unavailableCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.3)',
  },
  unavailableCardDark: {
    backgroundColor: 'rgba(30,30,40,0.8)',
    borderColor: 'rgba(255,71,87,0.3)',
  },
  unavailableTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text.light,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  unavailableTitleDark: {
    color: COLORS.text.dark,
  },
  unavailableText: {
    fontSize: 15,
    color: COLORS.subtext.light,
    textAlign: 'center',
    lineHeight: 22,
  },
  unavailableTextDark: {
    color: COLORS.subtext.dark,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.subtext.light,
  },
  loadingTextDark: {
    color: COLORS.subtext.dark,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.success.light,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    shadowColor: COLORS.success.light,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  successCircleDark: {
    shadowColor: '#276749',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text.light,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  successTitleDark: {
    color: COLORS.text.dark,
  },
  successSubtitle: {
    fontSize: 16,
    color: COLORS.subtext.light,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  successSubtitleDark: {
    color: COLORS.subtext.dark,
  },
});