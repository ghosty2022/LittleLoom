import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated,{ FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { ActivityIndicator, Dimensions, Keyboard, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  // ─── TAB STATE ───
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // ─── CREATE ACCOUNT STATE ───
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ─── JOIN FAMILY STATE ───
  const [inviteCode, setInviteCode] = useState('');
  const [joinFullName, setJoinFullName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [codeInfo, setCodeInfo] = useState<{ role: string; relationship?: string } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  const { signUp, signUpWithInviteCode, signIn, isLoading: authLoading, isAuthenticated } = useAuth();
  const { darkMode: isDark, themeColors, triggerHaptic } = useCustomization();
  const { toast, error: showError, success: showSuccess, info: showInfo } = useSweetAlert();

  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);

  const isMounted = useRef(true);
  const signUpAttempted = useRef(false);
  const joinAttempted = useRef(false);
  const codeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);
    };
  }, []);

  useEffect(() => {
    logoScale.value = withDelay(0, withSpring(1, { damping: 12, stiffness: 100 }));
    formTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 100 }));
  }, []);

  // ─── CODE VALIDATION WITH DEBOUNCE ───
  useEffect(() => {
    if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);

    const trimmed = inviteCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (trimmed.length !== 6) {
      setCodeValidated(false);
      setCodeInfo(null);
      return;
    }

    setIsValidatingCode(true);
    codeDebounceTimer.current = setTimeout(async () => {
      try {
        const { validateInviteCode } = await import('@/database/dbHelpers');
        const result = await validateInviteCode(trimmed);

        if (isMounted.current) {
          if (result.valid && result.invite) {
            setCodeValidated(true);
            setCodeInfo({
              role: result.invite.role,
              relationship: result.invite.relationship,
            });
            showInfo('Valid Code!', `You'll join as ${result.invite.role === 'parent2' ? 'Parent 2' : result.invite.role === 'guardian' ? 'Guardian' : 'Viewer'}`);
          } else {
            setCodeValidated(false);
            setCodeInfo(null);
          }
        }
      } catch (error) {
        console.error('Code validation error:', error);
      } finally {
        if (isMounted.current) setIsValidatingCode(false);
      }
    }, 500);
  }, [inviteCode]);

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

  // ─── CREATE ACCOUNT HANDLER ───
  const handleSignUp = useCallback(async () => {
    if (signUpAttempted.current || isProcessing || authLoading) return;

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

    // ─── CRITICAL FIX: Pre-check if email already exists ─────────────
    const { findUserByEmail } = await import('@/database/dbHelpers');
    const existingUser = await findUserByEmail(email.trim());
    
    if (existingUser) {
      showInfo('Account Exists', 'An account with this email already exists. Redirecting to sign in...');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1500);
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
        // ─── CRITICAL FIX: Check if email already exists ───────────────
        const { findUserByEmail } = await import('@/database/dbHelpers');
        const existing = await findUserByEmail(email.trim());
        
        if (existing) {
          showInfo('Account Exists', 'An account with this email already exists. Redirecting to sign in...');
          setTimeout(() => {
            navigation.navigate('Login');
          }, 1500);
        } else {
          showError('Sign Up Failed', 'Could not create account. Please try again.');
        }
        signUpAttempted.current = false;
      }
    } catch (error) {
      showError('Error', 'Sign up failed. Please try again.');
      signUpAttempted.current = false;
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [fullName, email, password, confirmPassword, signUp, isProcessing, authLoading, triggerHaptic, showError, showSuccess, showInfo, navigation]);

  // ─── JOIN FAMILY HANDLER ───
  const handleJoinFamily = useCallback(async () => {
    if (joinAttempted.current || isProcessing || authLoading) return;

    const trimmedCode = inviteCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (trimmedCode.length !== 6) {
      showError('Invalid Code', 'Please enter a valid 6-character invite code');
      triggerHaptic('error');
      return;
    }
    if (!codeValidated) {
      showError('Invalid Code', 'The invite code is not valid or has expired');
      triggerHaptic('error');
      return;
    }
    if (!joinFullName.trim()) {
      showError('Missing Name', 'Please enter your full name');
      triggerHaptic('error');
      return;
    }
    if (!joinEmail.trim()) {
      showError('Missing Email', 'Please enter your email address');
      triggerHaptic('error');
      return;
    }
    if (!isValidEmail(joinEmail)) {
      showError('Invalid Email', 'Please enter a valid email address');
      triggerHaptic('error');
      return;
    }
    if (!joinPassword) {
      showError('Missing Password', 'Please enter a password');
      triggerHaptic('error');
      return;
    }
    if (joinPassword.length < 6) {
      showError('Weak Password', 'Password must be at least 6 characters');
      triggerHaptic('error');
      return;
    }
    if (joinPassword !== joinConfirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      triggerHaptic('error');
      return;
    }

    joinAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      // ─── CRITICAL FIX: Prevent duplicate accounts ────────────────────
      const { findUserByEmail } = await import('@/database/dbHelpers');
      const existingUser = await findUserByEmail(joinEmail.trim());
      
      if (existingUser) {
        showInfo('Account Exists', 'You already have an account. Redirecting to sign in...');
        setTimeout(() => navigation.navigate('Login'), 1500);
        return;
      }

      const result = await signUpWithInviteCode(trimmedCode, joinFullName.trim(), joinEmail.trim(), joinPassword);

      if (result.success && isMounted.current) {
        showSuccess(`Welcome, ${joinFullName.trim()}!`, result.message);
      } else {
        showError('Join Failed', result.message || 'Could not join family. Please try again.');
        joinAttempted.current = false;
      }
    } catch (error) {
      showError('Error', 'Failed to join family. Please try again.');
      joinAttempted.current = false;
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [inviteCode, codeValidated, joinFullName, joinEmail, joinPassword, joinConfirmPassword, signUpWithInviteCode, signIn, isProcessing, authLoading, triggerHaptic, showError, showSuccess, showInfo, navigation]);

  const isLoading = authLoading || isProcessing;

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
  }));

  // ─── RENDER TAB SWITCHER ───
  const renderTabSwitcher = () => (
    <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102,126,234,0.08)' }]}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'create' && [styles.tabButtonActive, { backgroundColor: isDark ? 'rgba(102,126,234,0.4)' : '#667eea' }],
        ]}
        onPress={() => setActiveTab('create')}
        disabled={isLoading}
      >
        <Text style={[
          styles.tabText,
          { color: activeTab === 'create' ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }
        ]}>
          Create Account
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'join' && [styles.tabButtonActive, { backgroundColor: isDark ? 'rgba(102,126,234,0.4)' : '#667eea' }],
        ]}
        onPress={() => setActiveTab('join')}
        disabled={isLoading}
      >
        <Text style={[
          styles.tabText,
          { color: activeTab === 'join' ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }
        ]}>
          Join Family
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ─── RENDER CREATE ACCOUNT FORM ───
  const renderCreateForm = () => (
    <>
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
    </>
  );

  // ─── RENDER JOIN FAMILY FORM ───
  const renderJoinForm = () => (
    <>
      <View style={styles.joinHeader}>
        <Ionicons name="people-outline" size={32} color="#667eea" />
        <Text style={[styles.joinTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
          Join Your Family
        </Text>
        <Text style={[styles.joinSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Enter the invite code shared by your family member
        </Text>
      </View>

      {/* Invite Code Input */}
      <View style={[
        styles.inputContainer,
        isDark && styles.inputContainerDark,
        codeValidated && styles.inputContainerSuccess,
        !codeValidated && inviteCode.length >= 6 && styles.inputContainerError,
      ]}>
        <Ionicons name="key-outline" size={20} color={codeValidated ? '#22c55e' : '#667eea'} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: isDark ? '#fff' : '#1e293b', letterSpacing: 4, fontWeight: '700', fontSize: 18, textTransform: 'uppercase' }]}
          placeholder="INVITE CODE"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
          value={inviteCode}
          onChangeText={(text) => setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isLoading}
          returnKeyType="next"
          maxLength={6}
        />
        {isValidatingCode && (
          <ActivityIndicator size="small" color="#667eea" style={{ marginLeft: 8 }} />
        )}
        {codeValidated && !isValidatingCode && (
          <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
        )}
      </View>

      {codeValidated && codeInfo && (
        <View style={[styles.codeInfoCard, { backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }]}>
          <Ionicons name="shield-checkmark" size={18} color="#22c55e" />
          <Text style={[styles.codeInfoText, { color: isDark ? '#86efac' : '#15803d' }]}>
            You'll join as <Text style={{ fontWeight: '700' }}>{codeInfo.role === 'parent2' ? 'Parent 2' : codeInfo.role === 'guardian' ? 'Guardian' : 'Viewer'}</Text>
            {codeInfo.relationship ? ` (${codeInfo.relationship})` : ''}
          </Text>
        </View>
      )}

      {!codeValidated && inviteCode.length >= 6 && !isValidatingCode && (
        <View style={[styles.codeInfoCard, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' }]}>
          <Ionicons name="alert-circle" size={18} color="#ef4444" />
          <Text style={[styles.codeInfoText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
            Invalid or expired code. Please check and try again.
          </Text>
        </View>
      )}

      {codeValidated && (
        <>
          <View style={styles.divider}>
            <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
            <Text style={[styles.dividerText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              set up your account
            </Text>
            <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
          </View>

          {/* Full Name */}
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
              placeholder="Full name"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
              value={joinFullName}
              onChangeText={setJoinFullName}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!isLoading}
              returnKeyType="next"
              textContentType="name"
            />
          </View>

          {/* Email */}
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
              placeholder="Email address"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
              value={joinEmail}
              onChangeText={setJoinEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              returnKeyType="next"
              textContentType="emailAddress"
              autoComplete="email"
            />
          </View>

          {/* Password */}
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
              placeholder="Password"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
              value={joinPassword}
              onChangeText={setJoinPassword}
              secureTextEntry={!showJoinPassword}
              editable={!isLoading}
              returnKeyType="next"
              textContentType="newPassword"
              autoComplete="new-password"
            />
            <TouchableOpacity
              onPress={() => setShowJoinPassword(!showJoinPassword)}
              style={styles.eyeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isLoading}
            >
              <Ionicons
                name={showJoinPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#667eea"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#667eea" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#1e293b' }]}
              placeholder="Confirm password"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(102,126,234,0.6)'}
              value={joinConfirmPassword}
              onChangeText={setJoinConfirmPassword}
              secureTextEntry={!showJoinConfirmPassword}
              editable={!isLoading}
              returnKeyType="done"
              onSubmitEditing={handleJoinFamily}
              textContentType="newPassword"
            />
            <TouchableOpacity
              onPress={() => setShowJoinConfirmPassword(!showJoinConfirmPassword)}
              style={styles.eyeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isLoading}
            >
              <Ionicons
                name={showJoinConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#667eea"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleJoinFamily}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#22c55e', '#16a34a']}
              style={styles.loginGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.loginText}>Join Family</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={showSplash || (isLoading && !isAuthenticated)}
        text={activeTab === 'join' ? 'Joining your family...' : 'Creating your account...'}
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
        <Animated.ScrollView
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
                {activeTab === 'create' ? 'Create Account' : 'Join Family'}
              </Text>

              {renderTabSwitcher()}

              {activeTab === 'create' ? renderCreateForm() : renderJoinForm()}

              {activeTab === 'create' && (
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
              )}
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
  // ─── TAB SWITCHER ───
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // ─── JOIN FAMILY ───
  joinHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  joinTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  joinSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  codeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  codeInfoText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  inputContainerSuccess: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.05)',
  },
  inputContainerError: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  // ─── SOCIAL ───
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