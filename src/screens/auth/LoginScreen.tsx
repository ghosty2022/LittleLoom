import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSecurity } from '../../context/SecurityContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import type { RootStackParamList } from '../../types/navigation';
import { UniversalSpinner } from '../../components/UniversalSpinner';
import { useFamily } from '../../context/FamilyContext';
import { useBaby } from '../../context/BabyContext';
import { supabase } from '../../utils/supabase';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
const { width } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

/* ═══════════════════════════════════════════════════════════════════════════
   AURA DS
   ═══════════════════════════════════════════════════════════════════════════ */

const AURA = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
};

const REMEMBER_ME_EMAIL_KEY = '@littleloom_remember_me_email';
const REMEMBER_ME_FLAG_KEY = '@littleloom_remember_me_enabled';

const GOOGLE_CLIENT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
}) ?? 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '1526133312174343';

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'littleloom',
  useProxy: true,
});

const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
};

const isValidPhone = (phone: string): boolean => {
  const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
  return re.test(phone.trim());
};

const isValidUsername = (username: string): boolean => {
  const trimmed = username.trim();
  return trimmed.length >= 3 && /^[a-zA-Z0-9_.]+$/.test(trimmed);
};

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({
  children, style, colors = ['#ffffff', '#fbcfe8', '#c7d2fe'],
}: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return (
          <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>
            {l}
          </Text>
        );
      })}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Pulsing Biometric Button
   ═══════════════════════════════════════════════════════════════════════════ */

const PulsingBiometric = React.memo(({
  onPress, disabled, isDark,
}: {
  onPress: () => void; disabled?: boolean; isDark: boolean;
}) => {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
    glow.value = withRepeat(withSequence(withTiming(0.85, { duration: 1800 }), withTiming(0.4, { duration: 1800 })), -1, true);
  }, [pulse, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <TouchableOpacity
      style={styles.biometricButton}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={styles.biometricIconWrap}>
        <Animated.View style={[styles.biometricGlow, glowStyle]} pointerEvents="none" />
        <LinearGradient
          colors={['rgba(99,102,241,0.25)', 'rgba(236,72,153,0.15)']}
          style={styles.biometricIconBg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="finger-print" size={30} color={AURA.primary} />
        </LinearGradient>
      </View>
      <Text style={[styles.biometricTitle, { color: isDark ? AURA.primaryLight : AURA.primary }]}>
        Use Biometrics
      </Text>
      <Text style={[styles.biometricSubtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
        Tap to unlock instantly
      </Text>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LoginScreen({ navigation, route }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'join'>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberMeLoaded, setRememberMeLoaded] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [joinFullName, setJoinFullName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [codeInfo, setCodeInfo] = useState<{
    role: string;
    relationship?: string;
    used?: boolean;
    signupCompleted?: boolean;
    isPartial?: boolean;
    partialEmail?: string;
    partialPhone?: string;
    partialName?: string;
  } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [showPartialRecovery, setShowPartialRecovery] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  const {
    signIn,
    signUpWithInviteCode,
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
    findUserByEmail,
    findUserByEmailOrUsername,
    findUserByEmailOrUsernameOrPhone,
    mustChangePassword,
  } = useAuth();

  const {
    validateInviteCode: validateInviteCodeFromFamily,
    getInviteCodeById,
    getPartialSignupInfo,
    recoverPartialSignup,
    markSignupComplete,
  } = useFamily();

  // `babies` is needed to decide whether to route to SwitchBaby on
  // login. The old code only checked setupComplete, so a user with
  // 2+ babies was silently dropped onto the "priority" baby.
  const { babies } = useBaby();

  const { resetUnlockLock, forceUnlock } = useSecurity();

  const customization = useCustomization();
  const isDark = customization?.darkMode ?? false;
  const themeColors = customization?.themeColors ?? { primary: '#6366f1', secondary: '#8b5cf6' };
  const triggerHaptic = customization?.triggerHaptic ?? (() => {});

  const {
    toast,
    error: showError,
    success: showSuccess,
    confirm,
    info: showInfo,
    alert: showAlert,
  } = useSweetAlert();

  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);

  const isMounted = useRef(true);
  const loginAttempted = useRef(false);
  const joinAttempted = useRef(false);
  const autoLoginAttempted = useRef(false);
  const biometricCheckComplete = useRef(false);
  const codeDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialAuthInProgress = useRef(false);
  const navigationAttemptedRef = useRef(false);

  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedEmail, savedFlag] = await Promise.all([
          AsyncStorage.getItem(REMEMBER_ME_EMAIL_KEY),
          AsyncStorage.getItem(REMEMBER_ME_FLAG_KEY),
        ]);
        if (cancelled) return;

        if (savedFlag === 'true' && savedEmail) {
          setRememberMe(true);
          setEmail(savedEmail);
        }
      } catch (e) {
        if (__DEV__) console.warn('[Login] Failed to load remember-me:', e);
      } finally {
        if (!cancelled) setRememberMeLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistRememberMe = useCallback(
    async (enabled: boolean, emailToSave?: string) => {
      try {
        if (enabled && emailToSave) {
          await AsyncStorage.multiSet([
            [REMEMBER_ME_FLAG_KEY, 'true'],
            [REMEMBER_ME_EMAIL_KEY, emailToSave.trim()],
          ]);
        } else {
          await AsyncStorage.multiRemove([
            REMEMBER_ME_FLAG_KEY,
            REMEMBER_ME_EMAIL_KEY,
          ]);
        }
      } catch (e) {
        if (__DEV__) console.warn('[Login] Failed to save remember-me:', e);
      }
    },
    []
  );

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
    const code = (route.params as any)?.inviteCode;
    if (code) {
      if (activeTab !== 'join') setActiveTab('join');
      setInviteCode(code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
    }
  }, [route.params]);

  const userName = userProfile?.fullName || 'there';

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
      const socialResult = await signInWithSocial({
        id: `${provider}_${Date.now()}`,
        email,
        fullName: name,
        avatar,
        provider,
      });

      if (socialResult.success && isMounted.current) {
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
    return () => {
      isMounted.current = false;
      loginAttempted.current = false;
      autoLoginAttempted.current = false;
      joinAttempted.current = false;
      socialAuthInProgress.current = false;
      if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (isProcessing) return;
    if (navigationAttemptedRef.current) return;
    if (loginAttempted.current) return;

    navigationAttemptedRef.current = true;

    // ── TEMP PASSWORD: block all setup flow until password is reset ──
    // Navigation also routes to ForcedPasswordChange on its own, but
    // we short-circuit here so the login screen never briefly flashes
    // the family setup screens.
    if (mustChangePassword === true) {
      const timer = setTimeout(() => {
        if (!isMounted.current) return;
        forceUnlock().catch(() => {});
        navigation.replace('ForcedPasswordChange');
      }, 200);
      return () => clearTimeout(timer);
    }

    const parent2Addressed = hasParent2 === true || hasParent2 === 'skipped';
    const babyAddressed = hasBaby === true || hasBaby === 'skipped';

    const timer = setTimeout(() => {
      if (!isMounted.current) return;
      if (loginAttempted.current) return;

      forceUnlock().catch(() => {});

      if (!setupComplete) {
        if (!babyAddressed) {
          navigation.replace('BabyOptional');
        } else if (!parent2Addressed) {
          navigation.replace('CoParentInviteScreen');
        } else {
          navigation.replace('Main');
        }
        return;
      }

      // ── MULTI-BABY SELECTION GUARD ─────────────────────────────
      // If the user belongs to MORE THAN ONE baby, they MUST pick
      // which baby to continue with before landing on Main. Without
      // this, the app silently picks the "priority" baby and the
      // user has no way to know (or change) that without navigating
      // into SwitchBaby manually.
      //
      // We only do this if the user hasn't already made a selection
      // this session (tracked via a session flag), so a returning
      // user who already tapped a baby doesn't get re-prompted.
      const babiesArr = Array.isArray(babies) ? babies : [];
      const multiBaby = babiesArr.length > 1;

      if (multiBaby) {
        let alreadySelectedThisSession = false;
        try {
          const flag = await AsyncStorage.getItem(
            '@littleloom_multi_baby_selected_this_session'
          );
          alreadySelectedThisSession = flag === 'true';
        } catch {}

        if (!alreadySelectedThisSession) {
          navigation.replace('SwitchBaby', {
            returnTo: 'Main',
            returnLabel: 'Home',
          } as never);
          return;
        }
      }

      navigation.replace('Main');
    }, 200);

    return () => clearTimeout(timer);
  }, [
    authLoading,
    isAuthenticated,
    isProcessing,
    setupComplete,
    hasParent2,
    hasBaby,
    babies,
    navigation,
    forceUnlock,
    mustChangePassword,
  ]);

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
    if (activeTab !== 'join') return;
    if (codeDebounceTimer.current) clearTimeout(codeDebounceTimer.current);

    const trimmed = inviteCode.trim();

    if (trimmed.length !== 6) {
      setCodeValidated(false);
      setCodeInfo(null);
      setShowPartialRecovery(false);
      return;
    }

    setIsValidatingCode(true);
    setShowPartialRecovery(false);
    codeDebounceTimer.current = setTimeout(async () => {
      try {
        console.log('[Login] 🔍 Validating invite code:', trimmed);
        const partialInfo = await getPartialSignupInfo(trimmed);
        console.log('[Login] 📊 Partial signup info:', partialInfo);

        if (partialInfo.exists) {
          console.log('[Login] ⚠️ Partial sign-up detected for code:', trimmed);

          if (isMounted.current) {
            setCodeValidated(true);
            setCodeInfo({
              role: 'partial',
              isPartial: true,
              partialEmail: partialInfo.email,
              partialPhone: partialInfo.phone,
              partialName: partialInfo.name,
              used: true,
              signupCompleted: false,
            });
            setShowPartialRecovery(true);

            if (partialInfo.email) setJoinEmail(partialInfo.email);
            if (partialInfo.phone) setJoinPhone(partialInfo.phone);
            if (partialInfo.name) setJoinFullName(partialInfo.name);

            showInfo(
              'Resume Sign-up',
              partialInfo.email
                ? `Continue signing up with ${partialInfo.email}`
                : 'Complete your registration'
            );
            setIsValidatingCode(false);
          }
          return;
        }

        let codeDetails = await getInviteCodeById(trimmed);
        console.log('[Login] 📊 Code details:', codeDetails);

        if (codeDetails) {
          if (codeDetails.used && codeDetails.signup_completed) {
            if (isMounted.current) {
              setCodeValidated(false);
              setCodeInfo(null);
              showInfo('Code Already Used', 'This invite code has already been used. Please sign in with your account.');
              setTimeout(() => {
                if (isMounted.current) {
                  setActiveTab('signin');
                }
              }, 2000);
              setIsValidatingCode(false);
            }
            return;
          }
        }

        const result = await validateInviteCodeFromFamily(trimmed);
        console.log('[Login] 📋 Validation result:', result);

        if (isMounted.current) {
          if (result.valid && result.data) {
            setCodeValidated(true);
            setCodeInfo({
              role: result.data.role,
              relationship: result.data.relationship,
              used: result.data.used || false,
              signupCompleted: result.data.signup_completed || false,
              isPartial: result.data.isPartial || false,
            });
            showInfo('Valid Code!', `You'll join as ${result.data.role === 'parent2' ? 'Parent 2' : result.data.role === 'guardian' ? 'Guardian' : 'Viewer'}`);
          } else {
            setCodeValidated(false);
            setCodeInfo(null);
          }
        }
      } catch (error) {
        console.error('[Login] 💥 Code validation error:', error);
        if (isMounted.current) {
          setCodeValidated(false);
          setCodeInfo(null);
        }
      } finally {
        if (isMounted.current) setIsValidatingCode(false);
      }
    }, 500);
  }, [inviteCode, activeTab, validateInviteCodeFromFamily, getInviteCodeById, getPartialSignupInfo, showInfo, showAlert]);

  const handlePartialSignupRecovery = useCallback(async () => {
    if (isProcessing || authLoading) return;

    const trimmedCode = inviteCode.trim();
    if (trimmedCode.length !== 6) {
      showError('Invalid Code', 'Please enter a valid invite code');
      return;
    }

    if (!joinEmail.trim()) {
      showError('Missing Email', 'Please enter your email address');
      return;
    }
    if (!isValidEmail(joinEmail)) {
      showError('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (!joinFullName.trim()) {
      showError('Missing Name', 'Please enter your full name');
      return;
    }
    if (!joinPassword) {
      showError('Missing Password', 'Please enter a password');
      return;
    }
    if (joinPassword.length < 8) {
      showError('Weak Password', 'Password must be at least 8 characters');
      return;
    }
    if (joinPassword !== joinConfirmPassword) {
      showError('Password Mismatch', 'Passwords do not match');
      return;
    }

    try {
      const existingUser = await findUserByEmail(joinEmail.trim());
      if (existingUser) {
        showInfo('Account Found', 'You already have an account. Would you like to sign in instead?');
        setActiveTab('signin');
        setEmail(joinEmail.trim());
        return;
      }
    } catch (e) {
      console.warn('[Login] Error checking existing user:', e);
    }

    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      const signUpResult = await signUpWithInviteCode(
        trimmedCode,
        joinFullName.trim(),
        joinEmail.trim(),
        joinPassword
      );

      if (signUpResult.success && isMounted.current) {
        const { data: { user } } = await supabase.auth.getUser();

        const recoveryResult = await recoverPartialSignup(
          trimmedCode,
          user?.id || '',
          joinEmail.trim(),
          joinPhone.trim() || undefined,
          joinFullName.trim()
        );

        if (recoveryResult.success) {
          showSuccess('Welcome to the family!', recoveryResult.message);
          forceUnlock().catch(() => {});
        } else {
          showSuccess('Account Created!', 'Your account has been created. Please complete your family setup.');
          forceUnlock().catch(() => {});
        }
      } else {
        showError('Failed', signUpResult.message || 'Could not create account. Please try again.');
        joinAttempted.current = false;
      }
    } catch (error) {
      console.error('[Login] Partial signup recovery error:', error);
      showError('Error', 'Failed to complete signup. Please try again.');
      joinAttempted.current = false;
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [
    inviteCode,
    joinEmail,
    joinPhone,
    joinFullName,
    joinPassword,
    joinConfirmPassword,
    signUpWithInviteCode,
    recoverPartialSignup,
    findUserByEmail,
    userProfile,
    isProcessing,
    authLoading,
    triggerHaptic,
    showError,
    showSuccess,
    showInfo,
    forceUnlock,
  ]);

  const handleLogin = useCallback(async () => {
    loginAttempted.current = false;

    if (isProcessing || authLoading) return;

    if (isAuthenticated && setupComplete) {
      forceUnlock().catch(() => {});
      navigation.replace('Main');
      return;
    }

    const trimmedIdentifier = email.trim();
    if (!trimmedIdentifier) {
      showError('Missing Information', 'Please enter your email, phone number, or username');
      triggerHaptic('error');
      return;
    }

    const isEmail = isValidEmail(trimmedIdentifier);
    const isPhone = isValidPhone(trimmedIdentifier);
    const isUsername = isValidUsername(trimmedIdentifier);

    if (!isEmail && !isPhone && !isUsername) {
      showError('Invalid Input', 'Please enter a valid email, phone number, or username');
      triggerHaptic('error');
      return;
    }

    if (!password) {
      showError('Missing Password', 'Please enter your password');
      triggerHaptic('error');
      return;
    }

    if (loginAttempted.current) return;
    loginAttempted.current = true;
    setIsProcessing(true);
    Keyboard.dismiss();
    triggerHaptic('medium');

    try {
      let userIdentifier = trimmedIdentifier;

      if (!isEmail) {
        try {
          const user = await findUserByEmailOrUsernameOrPhone(trimmedIdentifier);
          if (user && user.email) {
            userIdentifier = user.email;
            if (__DEV__) console.log('[Login] Resolved identifier to email:', userIdentifier);
          } else {
            showError(
              'Account Not Found',
              'No account matches that email, username, or phone number.'
            );
            triggerHaptic('error');
            loginAttempted.current = false;
            setIsProcessing(false);
            return;
          }
        } catch (e) {
          if (__DEV__) console.warn('[Login] Identifier resolve failed:', e);
        }
      }

      const result = await signIn(userIdentifier, password);

      if (result.success && isMounted.current) {
        await persistRememberMe(rememberMe, userIdentifier);

        showSuccess(
          `Welcome Back${userName !== 'there' ? `, ${userName}` : ''}!`,
          'Successfully signed in'
        );
        forceUnlock().catch(() => {});

        if (
          isBiometricAvailable &&
          !(await hasBiometricLoginCredentials()) &&
          await shouldShowBiometricPrompt()
        ) {
          promptEnableBiometricLogin(userIdentifier, password);
        }
      } else if (isMounted.current) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}

        showError(
          'Login Failed',
          'Invalid credentials. Please try again.'
        );
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
    rememberMe,
    persistRememberMe,
    signIn,
    findUserByEmailOrUsername,
    isProcessing,
    authLoading,
    isAuthenticated,
    setupComplete,
    hasParent2,
    hasBaby,
    shouldShowBiometricPrompt,
    findUserByEmailOrUsernameOrPhone,
    hasSeenOnboarding,
    forceUnlock,
    navigation,
    userName,
    triggerHaptic,
    showError,
    showSuccess,
  ]);

  const handleJoinFamily = useCallback(async () => {
    joinAttempted.current = false;

    if (isProcessing || authLoading) return;

    if (isAuthenticated && setupComplete) {
      forceUnlock().catch(() => {});
      navigation.replace('Main');
      return;
    }

    const trimmedCode = inviteCode.trim();
    let isPartialSignup = false;

    if (trimmedCode.length === 6) {
      try {
        const partialInfo = await getPartialSignupInfo(trimmedCode);
        if (partialInfo.exists) {
          isPartialSignup = true;
          console.log('[Login] Completing partial sign-up for code:', trimmedCode);

          if (partialInfo.email && joinEmail.trim().toLowerCase() !== partialInfo.email.toLowerCase()) {
            showError('Email Mismatch', `This partial sign-up was started with ${partialInfo.email}. Please use the same email to continue.`);
            setJoinEmail(partialInfo.email || '');
            return;
          }
        }
      } catch (e) {
        console.warn('[Login] Error checking partial sign-up:', e);
      }
    }

    const existingUser = await findUserByEmail(joinEmail.trim());

    if (existingUser) {
      if (isPartialSignup) {
        confirm(
          'Account Exists',
          'You already have an account. Would you like to sign in instead?',
          () => {
            setActiveTab('signin');
            setEmail(joinEmail.trim());
          },
          () => {},
          'Sign In',
          'Continue'
        );
        return;
      }

      showInfo('Account Found', 'You already have an account. Please sign in instead.');
      setActiveTab('signin');
      setEmail(joinEmail.trim());
      return;
    }

    if (trimmedCode.length !== 6) {
      showError('Invalid Code', 'Invite code must be exactly 6 characters');
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
    if (joinPassword.length < 8) {
      showError('Weak Password', 'Password must be at least 8 characters');
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
      const result = await signUpWithInviteCode(trimmedCode, joinFullName.trim(), joinEmail.trim(), joinPassword);

      if (result.success && isMounted.current) {
        if (isPartialSignup && userProfile?.id) {
          await markSignupComplete(trimmedCode, userProfile.id);
        }

        await persistRememberMe(rememberMe, joinEmail.trim());

        showSuccess(`Welcome, ${joinFullName.trim()}!`, result.message);
        forceUnlock().catch(() => {});
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
  }, [inviteCode, codeValidated, joinFullName, joinEmail, joinPassword, joinConfirmPassword, signUpWithInviteCode, findUserByEmail, getPartialSignupInfo, markSignupComplete, userProfile, isProcessing, authLoading, isAuthenticated, setupComplete, triggerHaptic, showError, showSuccess, showInfo, confirm, forceUnlock, navigation, rememberMe, persistRememberMe]);

  const handleBiometricLogin = useCallback(async () => {
    loginAttempted.current = false;

    if (isProcessing || authLoading) return false;

    if (isAuthenticated && setupComplete) {
      forceUnlock().catch(() => {});
      navigation.replace('Main');
      return true;
    }

    resetUnlockLock();
    loginAttempted.current = true;
    setIsProcessing(true);
    triggerHaptic('medium');

    try {
      const result = await loginWithBiometric();

      if (result.success && isMounted.current) {
        showSuccess(`Welcome${userName !== 'there' ? `, ${userName}` : ''}!`, 'Biometric login successful');
        forceUnlock().catch(() => {});
        return true;
      } else {
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
    isAuthenticated,
    setupComplete,
    resetUnlockLock,
    forceUnlock,
    navigation,
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

  useEffect(() => {
    if (biometricCheckComplete.current) return;

    if (!isBiometricAvailable) {
      biometricCheckComplete.current = true;
      setAuthInitialized(true);
      return;
    }

    const checkBiometricStatus = async () => {
      try {
        const hasCreds = await hasBiometricLoginCredentials();
        if (hasCreds && isMounted.current) {
          setShowBiometricButton(true);
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

  const isLoading = authLoading || isProcessing || !authInitialized;

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
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
    triggerHaptic('light');
    showInfo('Coming Soon', 'Apple Sign-In will be available shortly');
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

  const handleScanQR = useCallback(() => {
    triggerHaptic('light');
    navigation.navigate('QRScanner' as never);
  }, [navigation, triggerHaptic]);

  const handleGoToSignUp = useCallback(() => {
    triggerHaptic('light');
    navigation.navigate('SignUp');
  }, [navigation, triggerHaptic]);

  const handleToggleRememberMe = useCallback(() => {
    triggerHaptic('light');
    setRememberMe((prev) => {
      const next = !prev;
      if (!next) {
        persistRememberMe(false).catch(() => {});
      }
      return next;
    });
  }, [persistRememberMe, triggerHaptic]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : '#f8faff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <UniversalSpinner
        visible={isLoading && !isAuthenticated}
        text={activeTab === 'join' ? 'Joining your family...' : 'Signing you in...'}
        subtext="Please wait a moment"
        size="medium"
        overlay={true}
        blur={true}
      />

      {/* Aura gradient */}
      <LinearGradient
        colors={isDark
          ? ['#0c0a09', '#1a1428', '#0c0a09']
          : ['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Aura glows */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, logoStyle]}>
            <View style={styles.logoFloatWrap}>
              <View style={styles.logoGlow} />
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <GradientText colors={['#ffffff', '#fbcfe8', '#c7d2fe']} style={styles.logoText}>
              LittleLoom
            </GradientText>
            <Text style={styles.logoTagline}>Track every precious moment</Text>
          </Animated.View>

          {/* Form card */}
          <Animated.View style={[styles.formContainer, formStyle]}>
            <BlurView intensity={isDark ? 40 : 80} style={styles.glassCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(30,30,40,0.92)', 'rgba(50,50,60,0.85)']
                    : ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.88)']
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />

              <Text style={[styles.welcomeText, { color: isDark ? AURA.white : AURA.gray900 }]}>
                {activeTab === 'signin' ? `Welcome Back${userName !== 'there' ? `, ${userName}` : ''}` : 'Join Family'}
              </Text>

              {/* Tab Switcher */}
              <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.08)' }]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'signin' && { backgroundColor: AURA.primary },
                  ]}
                  onPress={() => setActiveTab('signin')}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'signin' ? AURA.white : isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500 },
                  ]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'join' && { backgroundColor: AURA.success },
                  ]}
                  onPress={() => setActiveTab('join')}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === 'join' ? AURA.white : isDark ? 'rgba(255,255,255,0.6)' : AURA.gray500 },
                  ]}>
                    Join Family
                  </Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'signin' ? (
                <>
                  {/* Social */}
                  <View style={styles.socialIconsContainer}>
                    <TouchableOpacity
                      style={[styles.socialIconButton, { borderColor: 'rgba(219,68,55,0.2)' }]}
                      onPress={handleGoogleLogin}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <Image source={require('../../../assets/social/google.png')} style={styles.socialIcon} resizeMode="contain" />
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={[styles.socialIconButton, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}
                        onPress={handleAppleLogin}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <Image source={require('../../../assets/social/apple.png')} style={[styles.socialIcon, isDark && { tintColor: AURA.white }]} resizeMode="contain" />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.socialIconButton, { borderColor: 'rgba(24,119,242,0.2)' }]}
                      onPress={handleFacebookLogin}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <Image source={require('../../../assets/social/facebook.png')} style={styles.socialIcon} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                    <Text style={[styles.dividerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                      or sign in with email
                    </Text>
                    <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                  </View>

                  {/* Biometric */}
                  {showBiometricButton && (
                    <Animated.View entering={FadeInUp.delay(200)} style={styles.biometricSection}>
                      <PulsingBiometric onPress={handleBiometricLogin} disabled={isLoading} isDark={isDark} />
                    </Animated.View>
                  )}

                  {/* Identifier input */}
                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                    },
                  ]}>
                    <Ionicons name="person-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                      placeholder="Email, username, or phone"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                    />
                  </View>

                  {/* Password input */}
                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                    },
                  ]}>
                    <Ionicons name="lock-closed-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                      placeholder="Password"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      textContentType="password"
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
                        color={AURA.primary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Temp-password hint. Shown whenever the password
                      field has content and looks like it might be a
                      temporary password (>=8 chars, mixed case + digit).
                      Users with a real password never notice this; users
                      with a temp password get the confirmation they need
                      to press Sign In. */}
                  {password.length >= 8 && /[0-9]/.test(password) && /[A-Za-z]/.test(password) && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        marginBottom: 14,
                        borderRadius: 12,
                        backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.18)',
                      }}
                    >
                      <Ionicons name="key-outline" size={16} color={AURA.warning} />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 11,
                          lineHeight: 16,
                          fontWeight: '500',
                          color: isDark ? AURA.gray400 : AURA.gray500,
                        }}
                      >
                        Using a temporary password? Sign in normally — you'll be asked to set a new one on the next screen.
                      </Text>
                    </View>
                  )}

                  {/* Remember / Forgot */}
                  <View style={styles.rowContainer}>
                    <TouchableOpacity
                      style={styles.rememberMeContainer}
                      onPress={handleToggleRememberMe}
                      disabled={isLoading || !rememberMeLoaded}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, rememberMe && { backgroundColor: AURA.primary, borderColor: AURA.primary }]}>
                        {rememberMe && <Ionicons name="checkmark" size={14} color={AURA.white} />}
                      </View>
                      <Text style={[styles.rememberMeText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                        Remember me
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => navigation.navigate('ForgotPassword')}
                      disabled={isLoading}
                    >
                      <Text style={[styles.forgotPasswordText, { color: isDark ? AURA.primaryLight : AURA.primary }]}>
                        Forgot Password?
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Login button */}
                  <TouchableOpacity
                    style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[AURA.primary, AURA.accent]}
                      style={styles.loginGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={AURA.white} size="small" />
                      ) : (
                        <Text style={styles.loginText}>Sign In</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.signupLinkContainer}>
                    <Text style={[styles.signupLinkText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                      Don't have an account?
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
                      <Text style={[styles.signupLink, { color: isDark ? AURA.primaryLight : AURA.primary }]}>
                        Sign Up
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.joinHeader}>
                    <View style={[styles.joinIconWrap, { backgroundColor: `${AURA.success}18` }]}>
                      <Ionicons name="people-outline" size={26} color={AURA.success} />
                    </View>
                    <Text style={[styles.joinTitle, { color: isDark ? AURA.white : AURA.gray900 }]}>
                      Join Your Family
                    </Text>
                    <Text style={[styles.joinSubtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                      Enter the invite code shared by your family member
                    </Text>
                  </View>

                  {/* QR button */}
                  <TouchableOpacity
                    style={[
                      styles.qrButton,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      },
                    ]}
                    onPress={handleScanQR}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="qr-code-outline" size={22} color={AURA.primary} />
                    <Text style={[styles.qrButtonText, { color: isDark ? AURA.white : AURA.gray900 }]}>
                      Scan QR Code Instead
                    </Text>
                  </TouchableOpacity>

                  {/* Partial warning */}
                  {codeInfo?.isPartial && showPartialRecovery && (
                    <View style={[styles.partialWarning, { backgroundColor: `${AURA.warning}15`, borderColor: `${AURA.warning}30` }]}>
                      <Ionicons name="warning" size={18} color={AURA.warning} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.partialWarningText, { color: AURA.warning }]}>
                          Resume your sign-up
                        </Text>
                        {codeInfo.partialEmail && (
                          <Text style={[styles.partialWarningSubtext, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                            Email: {codeInfo.partialEmail}
                          </Text>
                        )}
                        {codeInfo.partialPhone && (
                          <Text style={[styles.partialWarningSubtext, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                            Phone: {codeInfo.partialPhone}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Invite code */}
                  <View style={[
                    styles.inputContainer,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                      borderColor: codeInfo?.isPartial
                        ? AURA.warning
                        : codeValidated
                        ? AURA.success
                        : (inviteCode.length === 6 && !isValidatingCode)
                        ? AURA.danger
                        : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)'),
                    },
                  ]}>
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color={
                        codeInfo?.isPartial
                          ? AURA.warning
                          : codeValidated
                          ? AURA.success
                          : AURA.primary
                      }
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, {
                        color: isDark ? AURA.white : AURA.gray900,
                        letterSpacing: 3,
                        fontWeight: '700',
                        fontSize: 18,
                        textAlign: 'center',
                      }]}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      maxLength={6}
                    />
                    {isValidatingCode && (
                      <ActivityIndicator size="small" color={AURA.primary} style={{ marginLeft: 8 }} />
                    )}
                    {codeValidated && !isValidatingCode && !codeInfo?.isPartial && (
                      <Ionicons name="checkmark-circle" size={22} color={AURA.success} />
                    )}
                    {codeInfo?.isPartial && !isValidatingCode && (
                      <Ionicons name="warning" size={22} color={AURA.warning} />
                    )}
                  </View>

                  {codeValidated && codeInfo && !codeInfo.isPartial && (
                    <View style={[styles.codeInfoCard, { backgroundColor: `${AURA.success}15` }]}>
                      <Ionicons name="shield-checkmark" size={18} color={AURA.success} />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#86efac' : '#15803d' }]}>
                        You'll join as <Text style={{ fontWeight: '700' }}>{codeInfo.role === 'parent2' ? 'Parent 2' : codeInfo.role === 'guardian' ? 'Guardian' : 'Viewer'}</Text>
                        {codeInfo.relationship ? ` (${codeInfo.relationship})` : ''}
                      </Text>
                    </View>
                  )}

                  {!codeValidated && inviteCode.length >= 6 && !isValidatingCode && (
                    <View style={[styles.codeInfoCard, { backgroundColor: `${AURA.danger}15` }]}>
                      <Ionicons name="alert-circle" size={18} color={AURA.danger} />
                      <Text style={[styles.codeInfoText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
                        Invalid or expired code. Please check and try again.
                      </Text>
                    </View>
                  )}

                  {codeValidated && !codeInfo?.isPartial && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          set up your account
                        </Text>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="person-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Full name"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={joinFullName}
                          onChangeText={setJoinFullName}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="name"
                        />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="mail-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Email address"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={joinEmail}
                          onChangeText={setJoinEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="emailAddress"
                        />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="call-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Phone number (optional)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={joinPhone}
                          onChangeText={setJoinPhone}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="telephoneNumber"
                        />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="lock-closed-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Password (min 8 characters)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
                          value={joinPassword}
                          onChangeText={setJoinPassword}
                          secureTextEntry={!showJoinPassword}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="newPassword"
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
                            color={AURA.primary}
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)',
                      }]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={AURA.primary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Confirm password"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(99,102,241,0.5)'}
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
                            color={AURA.primary}
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.rowContainer}>
                        <TouchableOpacity
                          style={styles.rememberMeContainer}
                          onPress={handleToggleRememberMe}
                          disabled={isLoading || !rememberMeLoaded}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkbox, rememberMe && { backgroundColor: AURA.primary, borderColor: AURA.primary }]}>
                            {rememberMe && <Ionicons name="checkmark" size={14} color={AURA.white} />}
                          </View>
                          <Text style={[styles.rememberMeText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                            Remember me
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handleJoinFamily}
                        disabled={isLoading}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={[AURA.success, '#059669']}
                          style={styles.loginGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {isLoading ? (
                            <ActivityIndicator color={AURA.white} size="small" />
                          ) : (
                            <Text style={styles.loginText}>Join Family</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={styles.signupLinkContainer}>
                        <Text style={[styles.signupLinkText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          Don't have an invite code?
                        </Text>
                        <TouchableOpacity onPress={handleGoToSignUp} disabled={isLoading}>
                          <Text style={[styles.signupLink, { color: AURA.success }]}>
                            Sign Up Instead
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Partial recovery form */}
                  {codeInfo?.isPartial && showPartialRecovery && (
                    <>
                      <View style={styles.divider}>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                        <Text style={[styles.dividerText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          complete your registration
                        </Text>
                        <View style={[styles.dividerLine, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                      }]}>
                        <Ionicons name="person-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Full name"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinFullName}
                          onChangeText={setJoinFullName}
                          autoCapitalize="words"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="name"
                        />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                      }]}>
                        <Ionicons name="mail-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Email address"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinEmail}
                          onChangeText={setJoinEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="emailAddress"
                        />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                      }]}>
                        <Ionicons name="call-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Phone number (optional)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinPhone}
                          onChangeText={setJoinPhone}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="telephoneNumber"
                        />
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                      }]}>
                        <Ionicons name="lock-closed-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Password (min 8 characters)"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinPassword}
                          onChangeText={setJoinPassword}
                          secureTextEntry={!showJoinPassword}
                          editable={!isLoading}
                          returnKeyType="next"
                          textContentType="newPassword"
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
                            color={AURA.warning}
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.inputContainer, {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.06)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.15)',
                      }]}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={AURA.warning} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: isDark ? AURA.white : AURA.gray900 }]}
                          placeholder="Confirm password"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(245,158,11,0.5)'}
                          value={joinConfirmPassword}
                          onChangeText={setJoinConfirmPassword}
                          secureTextEntry={!showJoinConfirmPassword}
                          editable={!isLoading}
                          returnKeyType="done"
                          onSubmitEditing={handlePartialSignupRecovery}
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
                            color={AURA.warning}
                          />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handlePartialSignupRecovery}
                        disabled={isLoading}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={[AURA.warning, '#d97706']}
                          style={styles.loginGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {isLoading ? (
                            <ActivityIndicator color={AURA.white} size="small" />
                          ) : (
                            <Text style={styles.loginText}>Complete Sign-up</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={styles.signupLinkContainer}>
                        <Text style={[styles.signupLinkText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                          Already have an account?
                        </Text>
                        <TouchableOpacity onPress={() => { setActiveTab('signin'); setEmail(joinEmail); }} disabled={isLoading}>
                          <Text style={[styles.signupLink, { color: AURA.warning }]}>
                            Sign In
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {!codeValidated && inviteCode.length < 6 && (
                    <View style={styles.signupLinkContainer}>
                      <Text style={[styles.signupLinkText, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
                        Don't have an invite code?
                      </Text>
                      <TouchableOpacity onPress={handleGoToSignUp} disabled={isLoading}>
                        <Text style={[styles.signupLink, { color: AURA.success }]}>
                          Sign Up Instead
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </BlurView>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  auraGlowTopLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  auraGlowBottomRight: {
    position: 'absolute',
    bottom: -140,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoFloatWrap: {
    width: Math.min(width * 0.38, 160),
    height: Math.min(width * 0.38, 160),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoImage: {
    width: Math.min(width * 0.35, 140),
    height: Math.min(width * 0.35, 140),
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  logoTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    fontWeight: '500',
  },

  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCard: {
    borderRadius: 28,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },

  socialIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 18,
  },
  socialIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  socialIcon: {
    width: 28,
    height: 28,
  },

  biometricSection: {
    marginBottom: 18,
    alignItems: 'center',
  },
  biometricButton: {
    alignItems: 'center',
    padding: 12,
    width: '100%',
  },
  biometricIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  biometricGlow: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  biometricIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
  },
  biometricTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  biometricSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    height: 54,
    borderWidth: 1,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  eyeButton: { padding: 4 },

  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AURA.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rememberMeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
  },

  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    color: AURA.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
  },
  signupLinkText: {
    fontSize: 13,
  },
  signupLink: {
    fontSize: 13,
    fontWeight: '800',
  },

  joinHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  joinIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  joinTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  joinSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  codeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  codeInfoText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },

  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  qrButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },

  partialWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  partialWarningText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  partialWarningSubtext: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});