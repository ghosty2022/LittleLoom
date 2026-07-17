import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {  ActivityIndicator, Dimensions, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
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
import { SafeBabyAvatar } from '../../components/SafeAvatar';

const { width } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type Props = NativeStackScreenProps<RootStackParamList, 'BabyOptional'>;

export default function BabyOnboardingScreen({ navigation }: Props) {
  const {
    babies, currentBabyId, switchBaby, loadBabies, isLoading: babyLoading
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadingTimeoutRef.current = setTimeout(() => {
      if (localLoading && isMountedRef.current) {
        setLocalLoading(false);
      }
    }, 8000);
    return () => {
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Only show loading overlay on first mount, not on re-focus from navigation
        const hasLoadedBefore = babies.length > 0;
        if (!hasLoadedBefore) {
          setLocalLoading(true);
        }
        await loadBabies();
        if (isMountedRef.current) setLocalLoading(false);
      } catch (error) {
        if (isMountedRef.current) {
          setLoadError('Failed to load babies');
          setLocalLoading(false);
        }
      }
    };
    loadData();
  }, [loadBabies, babies.length]);

  const handleSkip = useCallback(async () => {
    triggerHaptic('light');
    setIsProcessing(true);
    try {
      await skipSetup('baby');
      showInfo('Skipped', 'You can add a baby later from settings');
      setTimeout(() => {
        if (isMountedRef.current) {
          navigation.replace('Main');
        }
      }, 1000);
    } catch (error) {
      showError('Error', 'Could not skip baby setup');
      setIsProcessing(false);
    }
  }, [skipSetup, navigation, showError, showInfo, triggerHaptic]);

  const handleCreateBaby = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('CreateBabyProfile');
  }, [navigation, triggerHaptic]);

  const handleSelectBaby = useCallback(async (babyId: string) => {
    triggerHaptic('medium');
    setIsProcessing(true);
    try {
      await switchBaby(babyId);
      await completeSetup('baby');
      showSuccess('Welcome Back!', 'Baby profile selected');
      setTimeout(() => {
        if (isMountedRef.current) {
          navigation.replace('Main');
        }
      }, 500);
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
      if (isMountedRef.current) setLocalLoading(false);
    } catch (error) {
      if (isMountedRef.current) {
        setLoadError('Still unable to load');
        setLocalLoading(false);
      }
    }
  }, [loadBabies, babies.length]);

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

        <Animated.ScrollView
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
                      animated={!shouldReduceMotion}
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
        </Animated.ScrollView>
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
