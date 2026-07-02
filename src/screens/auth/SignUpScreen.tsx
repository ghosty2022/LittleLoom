import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated,{ FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import {  ActivityIndicator, Dimensions, Keyboard, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import { UniversalSpinner } from '../../components/UniversalSpinner';

type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;
const { width } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const FACEBOOK_APP_ID = 'YOUR_FACEBOOK_APP_ID';
const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  const { signUp, isLoading: authLoading, isAuthenticated } = useAuth();
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const { toast, error: showError, success: showSuccess } = useSweetAlert();

  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);

  const isMounted = useRef(true);
  const signUpAttempted = useRef(false);

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  const [fbRequest, fbResponse, fbPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: FACEBOOK_APP_ID,
      redirectUri,
      scopes: ['public_profile', 'email'],
    },
    { authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth' }
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    logoScale.value = withDelay(
      0,
      withSpring(1, { damping: 12, stiffness: 100 })
    );

    formTranslateY.value = withDelay(
      200,
      withSpring(0, { damping: 15, stiffness: 100 })
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
    }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const { authentication } = fbResponse;
      if (authentication?.accessToken) {
        handleFacebookUserInfo(authentication.accessToken);
      }
    } else if (fbResponse?.type === 'error') {
      showError('Facebook Error', 'Authentication failed. Please try again.');
      setIsProcessing(false);
    }
  }, [fbResponse]);

  const handleGoogleUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await response.json();

      if (userData.email) {
        await handleSocialSignUp('google', userData.email, userData.name || 'Google User', userData.picture);
      } else {
        throw new Error('No email in Google response');
      }
    } catch (error) {
      console.error('Google user info error:', error);
      showError('Google Error', 'Could not retrieve account information');
      setIsProcessing(false);
    }
  };

  const handleFacebookUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=email,name,picture&access_token=${accessToken}`
      );
      const userData = await response.json();

      if (userData.email) {
        await handleSocialSignUp(
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
    }
  };

  const handleSocialSignUp = async (
    provider: 'google' | 'apple' | 'facebook',
    email: string,
    name: string,
    avatar?: string
  ) => {
    if (!email) {
      showError('Auth Failed', `Could not get ${provider} account information`);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    try {
      const success = await signUp(name, email, `social_${provider}_${Date.now()}`);

      if (success && isMounted.current) {
        showSuccess('Welcome!', `Account created with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
      }
    } catch (error) {
      showError('Sign Up Failed', 'Social authentication failed');
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  };

  const handleGoogleSignUp = async () => {
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await googlePromptAsync();
    } catch (error) {
      showError('Google Error', 'Could not open Google sign-up');
      setIsProcessing(false);
    }
  };

  const handleAppleSignUp = async () => {
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
        await handleSocialSignUp('apple', credential.email, credential.fullName?.givenName || 'Apple User');
      } else if (credential.identityToken) {
        toast('Apple Sign-Up', 'Please use email sign-up for this account', 'info');
      }
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        return;
      }
      showError('Apple Error', 'Apple Sign-Up failed');
    }
  };

  const handleFacebookSignUp = async () => {
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await fbPromptAsync();
    } catch (error) {
      showError('Facebook Error', 'Could not open Facebook sign-up');
      setIsProcessing(false);
    }
  };

  const handleSignUp = useCallback(async () => {
    if (signUpAttempted.current || isProcessing || authLoading) {
      return;
    }

    if (!fullName.trim()) {
      showError('Missing Name', 'Please enter your full name');
      triggerHaptic('error');
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
      showError('Missing Password', 'Please enter a password');
      triggerHaptic('error');
      return;
    }

    if (password.length < 6) {
      showError('Weak Password', 'Password must be at least 6 characters');
      triggerHaptic('error');
      return;
    }

    if (password !== confirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      triggerHaptic('error');
      return;
    }

    signUpAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();

    triggerHaptic('medium');

    try {
      const success = await signUp(fullName.trim(), email.trim(), password);

      if (success && isMounted.current) {
        showSuccess(`Welcome, ${fullName.trim()}!`, 'Your account has been created successfully');
      } else {
        showError('Sign Up Failed', 'Could not create account. Please try again.');
        signUpAttempted.current = false;
      }
    } catch (error) {
      showError('Error', 'Sign up failed. Please try again.');
      signUpAttempted.current = false;
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }, [
    fullName,
    email,
    password,
    confirmPassword,
    signUp,
    isProcessing,
    authLoading,
    triggerHaptic,
    showError,
    showSuccess,
  ]);

  const isLoading = authLoading || isProcessing;

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={showSplash || (isLoading && !isAuthenticated)}
        text="Creating your account..."
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
            { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={[styles.logoCircle, isDark && styles.logoCircleDark]}>
              <Text style={styles.logoEmoji}>👶</Text>
            </View>
            <Text style={styles.logoText}>LittleLoom</Text>
            <Text style={styles.logoTagline}>Join our community of parents</Text>
          </Animated.View>

          {/* Glass Card Form */}
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
                Create Account
              </Text>

              {/* Social Sign Up - Icon Only */}
              <View style={styles.socialIconsContainer}>
                <TouchableOpacity
                  style={[styles.socialIconButton, { borderColor: 'rgba(219,68,55,0.2)' }]}
                  onPress={handleGoogleSignUp}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-google" size={28} color="#DB4437" />
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.socialIconButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
                    onPress={handleAppleSignUp}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-apple" size={28} color={isDark ? '#FFFFFF' : '#000000'} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.socialIconButton, { borderColor: 'rgba(24,119,242,0.2)' }]}
                  onPress={handleFacebookSignUp}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-facebook" size={28} color="#1877F2" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  or sign up with email
                </Text>
                <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              </View>

              {/* Full Name Input */}
              <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                  placeholder="Full name"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  textContentType="name"
                />
              </View>

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
                  returnKeyType="next"
                  textContentType="newPassword"
                  autoComplete="new-password"
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

              {/* Confirm Password Input */}
              <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
                  placeholder="Confirm password"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleSignUp}
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#667eea"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleSignUp}
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
                    <Text style={styles.loginText}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.termsRow}>
                <Text style={[styles.termsText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  By signing up, you agree to our{' '}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                  <Text style={[styles.termsLink, { color: themeColors.primary }]}>Terms of Service</Text>
                </TouchableOpacity>
                <Text style={[styles.termsText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{' '}and{' '}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                  <Text style={[styles.termsLink, { color: themeColors.primary }]}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(800)} style={styles.footer}>
            <Text style={[styles.footerText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)' }]}>
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
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
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoCircleDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoEmoji: {
    fontSize: 40,
  },
  logoText: {
    fontSize: 28,
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
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 8,
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
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
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
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
    lineHeight: 18,
  },
});
