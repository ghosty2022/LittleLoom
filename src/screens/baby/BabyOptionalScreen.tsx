// src/screens/baby/BabyOptionalScreen.tsx
// FIXED: Proper setup completion when selecting existing baby or skipping
// FIXED: Consistent navigation pattern (replace instead of navigate)
// FIXED: Error state recovery with proper skip fallback

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Image, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';

const { width } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type Props = NativeStackScreenProps<RootStackParamList, 'BabyOptional'>;

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  for (const char of value) {
    const code = char.codePointAt(0) || 0;
    const isEmojiChar = (
      (code >= 0x1F600 && code <= 0x1F64F) || (code >= 0x1F300 && code <= 0x1F5FF) ||
      (code >= 0x1F680 && code <= 0x1F6FF) || (code >= 0x1F1E0 && code <= 0x1F1FF) ||
      (code >= 0x2600 && code <= 0x26FF) || (code >= 0x2700 && code <= 0x27BF) ||
      (code >= 0x1F900 && code <= 0x1F9FF) || (code >= 0x1F018 && code <= 0x1F270) ||
      code === 0x238C || code === 0x2B06 || code === 0x2B07 || code === 0x2B05 ||
      code === 0x27A1 || (code >= 0x2194 && code <= 0x2199) ||
      (code >= 0x21A9 && code <= 0x21AA) || (code >= 0x2934 && code <= 0x2935) ||
      (code >= 0x25AA && code <= 0x25AB) || (code >= 0x25FB && code <= 0x25FE) ||
      code === 0x25B6 || code === 0x25C0 || (code >= 0x1F200 && code <= 0x1F251) ||
      code === 0x1F004 || code === 0x1F0CF || (code >= 0x1F170 && code <= 0x1F171) ||
      (code >= 0x1F17E && code <= 0x1F17F) || code === 0x1F18E || code === 0x3030 ||
      code === 0x2B50 || code === 0x2B55 || (code >= 0x23E9 && code <= 0x23EC) ||
      code === 0x23F0 || code === 0x23F3 || (code >= 0x231A && code <= 0x231B) ||
      (code >= 0x23F8 && code <= 0x23FA) || code === 0x24C2 ||
      (code >= 0x1F3FB && code <= 0x1F3FF) || (code >= 0x1F3E0 && code <= 0x1F3F4) ||
      (code >= 0x1F3F8 && code <= 0x1F43F) || code === 0x1F440 ||
      (code >= 0x1F442 && code <= 0x1F4FF) || (code >= 0x1F500 && code <= 0x1F53D) ||
      (code >= 0x1F54B && code <= 0x1F54E) || (code >= 0x1F550 && code <= 0x1F567) ||
      (code >= 0x1F595 && code <= 0x1F596) || (code >= 0x1F5FB && code <= 0x1F64F) ||
      (code >= 0x1F680 && code <= 0x1F6C5) || (code >= 0x1F6CB && code <= 0x1F6D2) ||
      (code >= 0x1F6E0 && code <= 0x1F6E5) || code === 0x1F6E9 ||
      (code >= 0x1F6EB && code <= 0x1F6EC) || code === 0x1F6F0 ||
      (code >= 0x1F6F3 && code <= 0x1F6F8) || (code >= 0x1F910 && code <= 0x1F93A) ||
      (code >= 0x1F93C && code <= 0x1F93E) || (code >= 0x1F940 && code <= 0x1F945) ||
      (code >= 0x1F947 && code <= 0x1F94C) || (code >= 0x1F950 && code <= 0x1F96B) ||
      (code >= 0x1F980 && code <= 0x1F997) || code === 0x1F9C0 ||
      (code >= 0x1F9D0 && code <= 0x1F9E6)
    );
    if (!isEmojiChar) return false;
  }
  return true;
};

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#fa709a', gradient: ['#fa709a', '#fee140'] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
];

const SafeBabyAvatar: React.FC<{
  avatar?: string | null;
  gender?: string;
  size?: number;
}> = ({ avatar, gender = 'other', size = 64 }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);

  const genderOption = GENDER_OPTIONS.find(g => g.value === gender);
  const gradientColors = genderOption?.gradient || ['#667eea', '#764ba2'];

  return (
    <LinearGradient
      colors={gradientColors as [string, string]}
      style={[
        styles.avatarGradient,
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    >
      {hasImage ? (
        <Image
          source={{ uri: avatar! }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={(e) => console.log('Baby avatar image error:', e.nativeEvent.error)}
        />
      ) : hasEmoji ? (
        <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>
          {avatar}
        </Text>
      ) : (
        <Ionicons
          name={genderOption?.icon as any || 'ellipse'}
          size={size * 0.4}
          color="#fff"
        />
      )}
    </LinearGradient>
  );
};

export default function BabyOptionalScreen({ navigation }: Props) {
  const {
    skipBaby, babies, currentBabyId, switchBaby, loadBabies, isLoading: babyLoading
  } = useBaby();
  const { userProfile, skipSetup, completeSetup } = useAuth();
  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  const { toast, error: showError, success: showSuccess, info: showInfo } = useSweetAlert();

  const [isProcessing, setIsProcessing] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      if (localLoading) {
        setLocalLoading(false);
      }
    }, 8000);
    return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current); };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLocalLoading(true);
        await loadBabies();
        if (isMounted) setLocalLoading(false);
      } catch (error) {
        if (isMounted) {
          setLoadError('Failed to load babies');
          setLocalLoading(false);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [loadBabies]);

  // CRITICAL FIX: Skip must properly mark baby setup as complete
  const handleSkip = useCallback(async () => {
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await skipBaby();
      await skipSetup('baby');
      showInfo('Skipped', 'You can add a baby later from settings');
      // Use replace to prevent going back to setup screens
      setTimeout(() => navigation.replace('Main'), 1000);
    } catch (error) {
      showError('Error', 'Could not skip baby setup');
      setIsProcessing(false);
    }
  }, [skipBaby, skipSetup, navigation, showError, showInfo, triggerHaptic]);

  const handleCreateBaby = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('CreateBabyProfile');
  }, [navigation, triggerHaptic]);

  // CRITICAL FIX: Selecting existing baby must complete setup
  const handleSelectBaby = useCallback(async (babyId: string) => {
    triggerHaptic('medium');
    setIsProcessing(true);
    try {
      await switchBaby(babyId);
      // Mark baby setup as complete since we selected a baby
      await completeSetup('baby');
      showSuccess('Welcome Back!', 'Baby profile selected');
      // Use replace to prevent going back to setup screens
      setTimeout(() => navigation.replace('Main'), 500);
    } catch (error) {
      showError('Error', 'Could not switch baby');
      setIsProcessing(false);
    }
  }, [switchBaby, completeSetup, navigation, showError, showSuccess, triggerHaptic]);

  const handleRetry = useCallback(async () => {
    setLoadError(null);
    setLocalLoading(true);
    try {
      await loadBabies();
      setLocalLoading(false);
    } catch (error) {
      setLoadError('Still unable to load');
      setLocalLoading(false);
    }
  }, [loadBabies]);

  const showLoading = localLoading || babyLoading;
  const hasExistingBabies = babies && babies.length > 0;

  if (loadError && !showLoading) {
    return (
      <View style={[styles.container]}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="cloud-offline" size={64} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text style={[styles.errorTitle, isDark && styles.textDark]}>Oops!</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={[styles.skipErrorText, { color: themeColors.primary }]}>Continue Without Baby →</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (showLoading) {
    return (
      <View style={[styles.container]}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading your babies...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container]}>
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <AutoHideScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.header}>
            <View style={[styles.iconContainer, isDark && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={styles.icon}>👶</Text>
            </View>
            <Text style={[styles.title, isDark && styles.textDark]}>
              {hasExistingBabies ? 'Select Your Baby' : 'Add Your Baby?'}
            </Text>
            <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
              {hasExistingBabies
                ? `Welcome back, ${userProfile?.fullName?.split(' ')[0] || 'Parent'}!`
                : 'Create a profile to start tracking milestones and activities'}
            </Text>
          </Animated.View>

          {hasExistingBabies && (
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.babiesContainer}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Your Babies</Text>
              {babies.map((baby, index) => (
                <AnimatedTouchableOpacity
                  key={baby.id}
                  entering={shouldReduceMotion ? undefined : FadeInDown.delay(300 + index * 100)}
                  style={[
                    styles.babyCard,
                    currentBabyId === baby.id && { borderColor: themeColors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => handleSelectBaby(baby.id)}
                  disabled={isProcessing}
                >
                  <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                  <LinearGradient
                    colors={currentBabyId === baby.id
                      ? [themeColors.colors[0], themeColors.colors[1]]
                      : isDark ? ['rgba(40,40,50,0.9)', 'rgba(30,30,40,0.7)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.babyCardContent}>
                    <SafeBabyAvatar
                      avatar={baby.avatar}
                      gender={baby.gender}
                      size={64}
                    />
                    <View style={styles.babyInfo}>
                      <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                      <Text style={[styles.babyAge, { color: themeColors.primary }]}>{baby.age}</Text>
                    </View>
                    {currentBabyId === baby.id && (
                      <View style={styles.activeBadge}>
                        <Ionicons name="checkmark-circle" size={24} color={themeColors.primary} />
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={24} color={isDark ? '#94a3b8' : '#999'} />
                  </View>
                </AnimatedTouchableOpacity>
              ))}
            </Animated.View>
          )}

          <Animated.View entering={shouldReduceMotion ? undefined : FadeIn.delay(400)} style={styles.buttonsContainer}>
            {!hasExistingBabies && (
              <TouchableOpacity style={styles.primaryButton} onPress={handleCreateBaby} activeOpacity={0.8}>
                <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.primaryGradient}>
                  <Ionicons name="add-circle" size={24} color="white" />
                  <Text style={styles.primaryText}>Create Baby Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.skipButton,
                hasExistingBabies && { backgroundColor: themeColors.colors[0] }
              ]}
              onPress={handleSkip}
              disabled={isProcessing}
            >
              <Text style={[styles.skipText, isDark && styles.textDark]}>
                {hasExistingBabies ? "I'll decide later" : "I'll do this later"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </AutoHideScrollView>
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
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    color: '#64748b',
  },
  textDark: {
    color: '#fff',
  },
  babiesContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1e293b',
  },
  babyCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  babyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  babyInfo: {
    flex: 1,
    marginLeft: 16,
  },
  babyName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1e293b',
  },
  babyAge: {
    fontSize: 14,
  },
  activeBadge: {
    marginRight: 8,
  },
  buttonsContainer: {
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  avatarGradient: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    color: '#1e293b',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipErrorText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
});
