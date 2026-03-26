import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeIn, 
  FadeInUp, 
  useAnimatedStyle, 
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types/navigation';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  
  const { 
    signIn, 
    isLoading: authLoading,
    isAuthenticated,  // CRITICAL: Get isAuthenticated
    isBiometricAvailable,
    loginWithBiometric,
    hasBiometricLoginCredentials,
    enableBiometricLogin,
    shouldShowBiometricPrompt,
  } = useAuth();
  
  const insets = useSafeAreaInsets();
  
  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);
  const biometricScale = useSharedValue(0);
  
  const isMounted = useRef(true);
  const loginAttempted = useRef(false);
  const biometricCheckComplete = useRef(false);
  const autoLoginAttempted = useRef(false);  // CRITICAL: Prevent double auto-login

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    logoScale.value = withSequence(
      withTiming(0.8, { duration: 0 }),
      withSpring(1, { damping: 12, stiffness: 100 })
    );
    
    formTranslateY.value = withSequence(
      withTiming(50, { duration: 0 }),
      withSpring(0, { damping: 15, stiffness: 100, delay: 200 })
    );

    if (!biometricCheckComplete.current) {
      checkBiometricStatus();
    }
  }, []);

  // CRITICAL FIX: Prevent auto-login if already authenticated or already attempted
  useEffect(() => {
    if (isAuthenticated) return;  // Don't auto-login if already authenticated
    if (autoLoginAttempted.current) return;  // Don't attempt twice
    
    const attemptAutoLogin = async () => {
      const hasCreds = await hasBiometricLoginCredentials();
      if (hasCreds && isBiometricAvailable) {
        autoLoginAttempted.current = true;
        console.log('🔵 Auto-attempting biometric login');
        await handleBiometricLogin();
      }
    };
    
    attemptAutoLogin();
  }, [isAuthenticated, isBiometricAvailable]);  // Dependencies include isAuthenticated

  const checkBiometricStatus = async () => {
    if (biometricCheckComplete.current) return;
    
    try {
      const hasCreds = await hasBiometricLoginCredentials();
      if (hasCreds && isBiometricAvailable) {
        setShowBiometricButton(true);
        biometricScale.value = withSpring(1, { damping: 12, delay: 400 });
      }
      biometricCheckComplete.current = true;
    } catch (error) {
      console.error('Error checking biometric status:', error);
    }
  };

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
  }));

  const biometricStyle = useAnimatedStyle(() => ({
    transform: [{ scale: biometricScale.value }],
    opacity: biometricScale.value,
  }));

  const handleLogin = useCallback(async () => {
    if (loginAttempted.current || isProcessing || authLoading) {
      console.log('⚠️ Login already in progress, ignoring');
      return;
    }
    
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    loginAttempted.current = true;
    setIsProcessing(true);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    try {
      const success = await signIn(email, password);
      
      if (success && isMounted.current) {
        const shouldPrompt = await shouldShowBiometricPrompt();
        if (shouldPrompt) {
          setTimeout(() => {
            promptEnableBiometricLogin(email, password);
          }, 500);
        }
      }
    } catch (error) {
      console.error('🔴 Login error:', error);
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
      setTimeout(() => {
        loginAttempted.current = false;
      }, 2000);
    }
  }, [email, password, signIn, isProcessing, authLoading, shouldShowBiometricPrompt]);

  const handleBiometricLogin = useCallback(async () => {
    // CRITICAL: Prevent duplicate attempts
    if (loginAttempted.current || isProcessing || authLoading) {
      console.log('⚠️ Biometric login already in progress, ignoring');
      return;
    }
    
    loginAttempted.current = true;
    setIsProcessing(true);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    try {
      const success = await loginWithBiometric();
      
      if (!success && isMounted.current) {
        Alert.alert(
          'Biometric Login Failed',
          'Please enter your email and password to log in.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('🔴 Biometric login error:', error);
      Alert.alert('Error', 'Biometric login failed. Please use your password.');
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
      setTimeout(() => {
        loginAttempted.current = false;
      }, 3000);
    }
  }, [loginWithBiometric, isProcessing, authLoading]);

  const promptEnableBiometricLogin = async (userEmail: string, userPassword: string) => {
    Alert.alert(
      'Enable Face ID Login?',
      'Would you like to use Face ID for faster login next time? No need to enter your password!',
      [
        { 
          text: 'Not Now', 
          style: 'cancel',
          onPress: () => {
            console.log('👤 User declined biometric login');
          }
        },
        { 
          text: 'Enable', 
          onPress: async () => {
            try {
              const result = await enableBiometricLogin(userEmail, userPassword);
              if (result) {
                Alert.alert('Success', 'Face ID login enabled! You can now log in without your password.');
              }
            } catch (error) {
              console.error('Error enabling biometric:', error);
            }
          }
        },
      ]
    );
  };

  const handleSocialLogin = useCallback((provider: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert('Coming Soon', `${provider} login will be available soon!`);
  }, []);

  const isLoading = authLoading || isProcessing;

  return (
    <LinearGradient 
      colors={['#667eea', '#764ba2', '#f093fb']} 
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar style="light" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent, 
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }
          ]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>👶</Text>
            </View>
            <Text style={styles.logoText}>LittleLoom</Text>
            <Text style={styles.logoTagline}>Track every precious moment</Text>
          </Animated.View>

          <Animated.View style={[styles.formContainer, formStyle]}>
            <BlurView intensity={60} style={styles.glassCard}>
              <Text style={styles.welcomeText}>Welcome Back</Text>
              
              {showBiometricButton && (
                <Animated.View style={[styles.biometricLoginContainer, biometricStyle]}>
                  <TouchableOpacity 
                    style={styles.biometricLoginButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="finger-print" size={32} color="#667eea" />
                    <Text style={styles.biometricLoginTitle}>
                      {Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint'} Login
                    </Text>
                    <Text style={styles.biometricLoginSubtitle}>
                      Tap to sign in instantly
                    </Text>
                  </TouchableOpacity>
                  
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or use password</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </Animated.View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="rgba(102,126,234,0.6)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(102,126,234,0.6)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)} 
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#667eea" 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#667eea', '#764ba2']} 
                  style={styles.loginGradient}
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.loginText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {!showBiometricButton && isBiometricAvailable && (
                <Animated.View style={[styles.biometricContainer, biometricStyle]}>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.biometricButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="finger-print" size={28} color="#667eea" />
                    <Text style={styles.biometricText}>
                      {Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </BlurView>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600)} style={styles.socialContainer}>
            <Text style={styles.socialText}>Or continue with</Text>
            <View style={styles.socialButtons}>
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleSocialLogin('Google')}
              >
                <Ionicons name="logo-google" size={24} color="#DB4437" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleSocialLogin('Apple')}
              >
                <Ionicons name="logo-apple" size={24} color={Platform.OS === 'ios' ? '#000' : '#fff'} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(800)} style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signupLink}>Create Account</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  keyboardView: { 
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoEmoji: {
    fontSize: 50,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  logoTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCard: {
    borderRadius: 24,
    padding: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 24,
    textAlign: 'center',
  },
  
  biometricLoginContainer: {
    marginBottom: 20,
  },
  biometricLoginButton: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  biometricLoginTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
    marginTop: 12,
  },
  biometricLoginSubtitle: {
    fontSize: 13,
    color: '#667eea',
    opacity: 0.8,
    marginTop: 4,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.15)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  eyeButton: { padding: 4 },
  
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  biometricContainer: {
    marginTop: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#667eea',
    fontSize: 13,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 10,
  },
  biometricText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '700',
  },
  
  socialContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  socialText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 16,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  signupText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
  },
  signupLink: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});