import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { showError } from '@/utils/alert';
import { AppleAuthentication } from 'expo-apple-authentication';
import { ActivityIndicator, AlertAnimated, Button,withTiming, Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
const { width, height } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = Platform.select({
  ios: 'YOUR_IOS_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  android: 'YOUR_ANDROID_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  default: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
});

const FACEBOOK_APP_ID = 'YOUR_FACEBOOK_APP_ID';

const redirectUri = AuthSession.makeRedirectUri({ 
  scheme: 'littleloom',
  useProxy: Platform.OS !== 'web' 
});

interface SocialButtonProps {
  provider: 'google' | 'apple' | 'facebook';
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
}

const SocialButton = React.memo(({ provider, onPress, disabled, isDark }: SocialButtonProps) => {
  const configs = useMemo(() => ({
    google: {
      icon: 'logo-google' as const,
      iconColor: '#DB4437',
      label: 'Continue with Google',
      textColor: '#1e293b',
      borderColor: 'rgba(0,0,0,0.08)',
      shadowColor: 'rgba(0,0,0,0.1)',
    },
    apple: {
      icon: 'logo-apple' as const,
      iconColor: isDark ? '#FFFFFF' : '#000000',
      label: 'Continue with Apple',
      textColor: isDark ? '#FFFFFF' : '#000000',
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
      shadowColor: 'rgba(0,0,0,0.1)',
    },
    facebook: {
      icon: 'logo-facebook' as const,
      iconColor: '#1877F2',
      label: 'Continue with Facebook',
      textColor: '#1877F2',
      borderColor: 'rgba(24,119,242,0.2)',
      shadowColor: 'rgba(24,119,242,0.15)',
    },
  }), [isDark]);

  const config = configs[provider];

  return (
    <TouchableOpacity
      style={[
        styles.socialButton,
        {
          borderColor: config.borderColor,
          shadowColor: config.shadowColor,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={styles.socialButtonInner}>
        <Ionicons name={config.icon} size={22} color={config.iconColor} />
        <Text style={[styles.socialButtonText, { color: config.textColor }]}>
          {config.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const isValidEmail = (email: string): boolean => {
  const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const {
    signIn,
    signInWithSocial,
    isLoading: authLoading,
    isAuthenticated,
    isBiometricAvailable,
    loginWithBiometric,
    hasBiometricLoginCredentials,
    enableBiometricLogin,
    shouldShowBiometricPrompt,
    setupComplete,
    hasParent2,
    hasBaby,
    hasSeenOnboarding,
    userProfile,
  } = useAuth();

  const { resetUnlockLock, forceUnlock } = useSecurity();
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const { toast, error: showError, success: showSuccess, confirm } = useSweetAlert();

  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);
  const biometricScale = useSharedValue(0);

  const isMounted = useRef(true);
  const loginAttempted = useRef(false);
  const autoLoginAttempted = useRef(false);
  const biometricCheckComplete = useRef(false);
  const socialAuthInProgress = useRef(false);

  const userName = userProfile?.fullName || 'there';

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: 'token',
    },
    { 
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    }
  );

  const [fbRequest, fbResponse, fbPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: FACEBOOK_APP_ID,
      redirectUri,
      scopes: ['public_profile', 'email'],
      responseType: 'token',
    },
    { 
      authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
    }
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
      loginAttempted.current = false;
      autoLoginAttempted.current = false;
      socialAuthInProgress.current = false;
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
  }, []);

  
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      if (authentication?.accessToken) {
        handleGoogleUserInfo(authentication.accessToken);
      }
    } else if (googleResponse?.type === 'error') {
      showError('Google Error', 'Authentication failed. Please try again.');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    } else if (googleResponse?.type === 'cancel') {
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  }, [googleResponse]);

  const handleGoogleUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await response.json();

      if (userData.email) {
        await handleSocialLogin('google', userData.email, userData.name || 'Google User', userData.picture);
      } else {
        throw new Error('No email in Google response');
      }
    } catch (error) {
      console.error('Google user info error:', error);
      showError('Google Error', 'Could not retrieve account information');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  
  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const { authentication } = fbResponse;
      if (authentication?.accessToken) {
        handleFacebookUserInfo(authentication.accessToken);
      }
    } else if (fbResponse?.type === 'error') {
      showError('Facebook Error', 'Authentication failed. Please try again.');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    } else if (fbResponse?.type === 'cancel') {
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  }, [fbResponse]);

  const handleFacebookUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=email,name,picture&access_token=${accessToken}`
      );
      const userData = await response.json();

      if (userData.email) {
        await handleSocialLogin(
          'facebook',
          userData.email,
          userData.name || 'Facebook User',
          userData.picture?.data?.url
        );
      } else {
        throw new Error('No email in Facebook response');
      }
    } catch (error) {
      console.error('Facebook user info error:', error);
      showError('Facebook Error', 'Could not retrieve account information');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  const handleSocialLogin = async (
    provider: 'google' | 'apple' | 'facebook',
    email: string,
    name: string,
    avatar?: string
  ) => {
    if (!email) {
      showError('Auth Failed', `Could not get ${provider} account information`);
      setIsProcessing(false);
      socialAuthInProgress.current = false;
      return;
    }

    setIsProcessing(true);
    try {
      const success = await signInWithSocial({
        id: `${provider}_${Date.now()}`,
        email,
        fullName: name,
        avatar,
        provider,
      });

      if (success && isMounted.current) {
        showSuccess('Welcome!', `Signed in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
        forceUnlock().catch(() => {});
      }
    } catch (error) {
      showError('Login Failed', 'Social authentication failed');
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
        socialAuthInProgress.current = false;
      }
    }
  };

  useEffect(() => {
    if (biometricCheckComplete.current || !isBiometricAvailable) return;

    const checkBiometricStatus = async () => {
      try {
        const hasCreds = await hasBiometricLoginCredentials();
        if (hasCreds && isMounted.current) {
          setShowBiometricButton(true);
          biometricScale.value = withSpring(1, { damping: 12, delay: 400 });
        }
        biometricCheckComplete.current = true;
        setAuthInitialized(true);
      } catch (error) {
        console.error('Error checking biometric status:', error);
        biometricCheckComplete.current = true;
        setAuthInitialized(true);
      }
    };

    checkBiometricStatus();
  }, [isBiometricAvailable, hasBiometricLoginCredentials]);

  useEffect(() => {
    if (isAuthenticated || autoLoginAttempted.current || !biometricCheckComplete.current || !authInitialized) return;

    const attemptAutoLogin = async () => {
      const hasCreds = await hasBiometricLoginCredentials();
      if (hasCreds && isBiometricAvailable && isMounted.current) {
        autoLoginAttempted.current = true;

        setTimeout(async () => {
          if (!isMounted.current || isAuthenticated) return;
          resetUnlockLock();
          await handleBiometricLogin();
        }, 800);
      }
    };

    attemptAutoLogin();
  }, [isAuthenticated, isBiometricAvailable, authInitialized]);

  useEffect(() => {
    resetUnlockLock();

    const unsubscribe = navigation.addListener('focus', () => {
      resetUnlockLock();
      loginAttempted.current = false;
    });
    return unsubscribe;
  }, [navigation, resetUnlockLock]);

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

  const handleGoogleLogin = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true;
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await googlePromptAsync();
    } catch (error) {
      showError('Google Error', 'Could not open Google sign-in');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  const handleAppleLogin = async () => {
    if (socialAuthInProgress.current) return;
    triggerHaptic('light');
    
    try {
      const { AppleAuthentication } = await import('expo-apple-authentication');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken && credential.email) {
        await handleSocialLogin('apple', credential.email, credential.fullName?.givenName || 'Apple User');
      } else if (credential.identityToken) {
        toast('Apple Sign-In', 'Please use password login for this account', 'info');
      }
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        return;
      }
      showError('Apple Error', 'Apple Sign-In failed');
    }
  };

  const handleFacebookLogin = async () => {
    if (socialAuthInProgress.current) return;
    socialAuthInProgress.current = true;
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await fbPromptAsync();
    } catch (error) {
      showError('Facebook Error', 'Could not open Facebook sign-in');
      setIsProcessing(false);
      socialAuthInProgress.current = false;
    }
  };

  const handleLogin = useCallback(async () => {
    if (loginAttempted.current || isProcessing || authLoading) {
      return;
    }

    if (!email.trim()) {
      showError('Missing Email', 'Please enter your email address');
      triggerHaptic('error');
      return;
    }

    if (!isValidEmail(email)) {
      showError('Invalid Email', 'Please enter a valid email address');
      triggerHaptic('error');
      return;
    }

    if (!password) {
      showError('Missing Password', 'Please enter your password');
      triggerHaptic('error');
      return;
    }

    if (password.length < 6) {
      showError('Weak Password', 'Password must be at least 6 characters');
      triggerHaptic('error');
      return;
    }

    loginAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      const success = await signIn(email.trim(), password);

      if (success && isMounted.current) {
        showSuccess(`Welcome Back${userName !== 'there' ? `, ${userName}` : ''}!`, 'Successfully signed in');
        forceUnlock().catch(() => {});

        if (hasSeenOnboarding) {
          const shouldPrompt = await shouldShowBiometricPrompt();
          if (shouldPrompt) {
            setTimeout(() => {
              promptEnableBiometricLogin(email.trim(), password);
            }, 1000);
          }
        }
      } else {
        showError('Login Failed', 'Invalid email or password');
        loginAttempted.current = false;
      }
    } catch (error) {
      showError('Error', 'Login failed. Please try again.');
      loginAttempted.current = false;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [
    email,
    password,
    signIn,
    isProcessing,
    authLoading,
    shouldShowBiometricPrompt,
    hasSeenOnboarding,
    forceUnlock,
    userName,
    triggerHaptic,
    showError,
    showSuccess,
  ]);

  const handleBiometricLogin = useCallback(async () => {
    if (loginAttempted.current || isProcessing || authLoading) {
      return false;
    }

    resetUnlockLock();
    loginAttempted.current = true;
    setIsProcessing(true);
    triggerHaptic('medium');

    try {
      const success = await loginWithBiometric();

      if (success && isMounted.current) {
        showSuccess(`Welcome${userName !== 'there' ? `, ${userName}` : ''}!`, 'Biometric login successful');
        forceUnlock().catch(() => {});
        return true;
      } else if (!success) {
        showError('Biometric Failed', 'Please use your password');
        loginAttempted.current = false;
        return false;
      }
    } catch (error) {
      showError('Error', 'Biometric login failed');
      loginAttempted.current = false;
      return false;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [
    loginWithBiometric,
    isProcessing,
    authLoading,
    resetUnlockLock,
    forceUnlock,
    userName,
    triggerHaptic,
    showError,
    showSuccess,
  ]);

  const promptEnableBiometricLogin = async (userEmail: string, userPassword: string) => {
    if (!isMounted.current) return;

    confirm(
      'Enable Biometric Login?',
      'Would you like to use biometric authentication for faster login next time?',
      async () => {
        try {
          const result = await enableBiometricLogin(userEmail, userPassword);
          if (result && isMounted.current) {
            showSuccess('Enabled!', 'Biometric login is now active');
            setShowBiometricButton(true);
            biometricScale.value = withSpring(1, { damping: 12 });
          }
        } catch (error) {
          if (isMounted.current) {
            showError('Error', 'Could not enable biometric login');
          }
        }
      },
      () => {},
      'Enable',
      'Not Now'
    );
  };

  const isLoading = authLoading || isProcessing || !authInitialized;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={isLoading && !isAuthenticated}
        text="Signing you in..."
        subtext="Please wait a moment"
        size="medium"
        overlay={true}
        blur={true}
      />

      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b', '#334155'] : ['#667eea', '#764ba2', '#f093fb']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <AutoHideAnimatedScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={[styles.logoCircle, isDark && styles.logoCircleDark]}>
              <Text style={styles.logoEmoji}>🍼</Text>
            </View>
            <Text style={styles.logoText}>LittleLoom</Text>
            <Text style={styles.logoTagline}>Track every precious moment</Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[styles.formContainer, formStyle]}>
            <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(30,41,59,0.9)', 'rgba(51,65,85,0.8)']
                    : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />

              <Text style={[styles.welcomeText, { color: isDark ? '#fff' : '#1e293b' }]}>
                Welcome Back{userName !== 'there' ? `, ${userName}` : ''}
              </Text>

              {/* Social Login Icons */}
              <View style={styles.socialIconsContainer}>
                <TouchableOpacity
                  style={[styles.socialIconButton, { borderColor: 'rgba(219,68,55,0.2)' }]}
                  onPress={handleGoogleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-google" size={28} color="#DB4437" />
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.socialIconButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
                    onPress={handleAppleLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-apple" size={28} color={isDark ? '#FFFFFF' : '#000000'} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.socialIconButton, { borderColor: 'rgba(24,119,242,0.2)' }]}
                  onPress={handleFacebookLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-facebook" size={28} color="#1877F2" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  or sign in with email
                </Text>
                <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              </View>

              {/* Biometric Login */}
              {showBiometricButton && (
                <Animated.View style={[styles.biometricSection, biometricStyle]}>
                  <TouchableOpacity
                    style={styles.biometricButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.biometricIconWrapper}>
                      <LinearGradient
                        colors={['rgba(102,126,234,0.2)', 'rgba(118,75,162,0.1)']}
                        style={styles.biometricIconBg}
                      >
                        <Ionicons name="finger-print" size={32} color="#667eea" />
                      </LinearGradient>
                    </View>
                    <Text style={styles.biometricTitle}>Use Biometrics</Text>
                    <Text style={styles.biometricSubtitle}>Tap to unlock instantly</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Email Input */}
              <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                  placeholder="Email address"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </View>

              {/* Password Input */}
              <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                  placeholder="Password"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  textContentType="password"
                  autoComplete="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#667eea"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={isLoading}
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

              {/* Fallback Biometric */}
              {!showBiometricButton && isBiometricAvailable && (
                <Animated.View entering={FadeInUp.delay(600)} style={styles.biometricFallback}>
                  <TouchableOpacity
                    style={styles.biometricFallbackButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                  >
                    <Ionicons name="finger-print" size={24} color="#667eea" />
                    <Text style={styles.biometricFallbackText}>Use Biometrics</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </BlurView>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(800)} style={styles.footer}>
            <Text style={[styles.footerText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)' }]}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
              <Text style={styles.footerLink}>Create Account</Text>
            </TouchableOpacity>
          </Animated.View>
        </AutoHideAnimatedScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
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
  logoCircleDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
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
    borderRadius: 28,
    padding: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  socialIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  biometricSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  biometricButton: {
    alignItems: 'center',
    padding: 16,
  },
  biometricIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  biometricIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  biometricTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 4,
  },
  biometricSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
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
  inputContainerDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
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
  biometricFallback: {
    marginTop: 20,
    alignItems: 'center',
  },
  biometricFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  biometricFallbackText: {
    color: '#667eea',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 15,
  },
  footerLink: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  socialButton: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  socialButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
