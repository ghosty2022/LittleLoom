import { StyleSheet, Dimensions, ScrollView, Switch, Text, TouchableOpacity, View, StatusBar } from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BlurView } from 'expo-blur';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, Layout, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { STORAGE_KEYS, useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useSweetAlert } from '../../components/SweetAlert';

import { LiquidDots } from '../../components/UniversalSpinner'; // <-- IMPORT ADDED
import { showAlert } from '@/utils/alert';;

const { width } = Dimensions.get('window');

type BabySelectorScreenProps = NativeStackScreenProps<RootStackParamList, 'SwitchBaby'>;

const safeParse = <T,>(json: string | null, fallback: T): T => {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
};

const GlassmorphismCard: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void; intensity?: number; isDark?: boolean }> = ({ 
  children, style, onPress, intensity = 80, isDark = false 
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper onPress={onPress} activeOpacity={0.8} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(40,40,40,0.8)', 'rgba(20,20,20,0.6)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

export default function BabySelectorScreen({ navigation }: BabySelectorScreenProps) {
  const sweetAlert = useSweetAlert();
  const { babies, currentBabyId, switchBaby, deleteBaby, loadBabies, isLoading: babyLoading } = useBaby();
  const { userProfile } = useAuth();
  const { parent2 } = useFamily();
  const insets = useSafeAreaInsets();

  const { darkMode: isDark, themeColors, shouldReduceMotion } = useCustomization();
  const { toast, error: showError, success: showSuccess } = useSweetAlert();

  const [isProcessing, setIsProcessing] = useState(false);
  const hasNavigated = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleSwitchBaby = useCallback(async (babyId: string) => {
    if (babyId === currentBabyId) {
      navigation.replace('Main');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);

    try {
      const success = await switchBaby(babyId);

      if (success) {
        await loadBabies();
        showSuccess('Switched', 'Baby profile updated');

        setTimeout(() => {
          if (!hasNavigated.current && isMounted.current) {
            hasNavigated.current = true;
            navigation.replace('Main');
          }
        }, 500);
      } else {
        showError('Error', 'Failed to switch baby profile');
        setIsProcessing(false);
      }
    } catch (error) {
      showError('Error', 'An unexpected error occurred');
      setIsProcessing(false);
    }
  }, [currentBabyId, switchBaby, loadBabies, navigation, showError, showSuccess]);

  const handleDeleteBaby = useCallback((babyId: string, babyName: string) => {
    if (babies.length <= 1) {
      sweetAlert.alert('Cannot Delete', 'You must have at least one baby profile', 'warning');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

showAlert(
      'Delete Profile?',
      `Are you sure you want to delete ${babyName}'s profile? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteBaby(babyId);

              if (success) {
                await loadBabies();
                showSuccess('Deleted', 'Baby profile removed');

                setTimeout(async () => {
                  try {
                    const babiesStr = await AsyncStorage.getItem(STORAGE_KEYS.BABIES);
                    const remainingBabies = safeParse<BabyProfile[]>(babiesStr, []);

                    if (remainingBabies.length === 0) {
                      await AsyncStorage.multiRemove([
                        STORAGE_KEYS.CURRENT_BABY,
                        STORAGE_KEYS.HAS_SKIPPED_BABY
                      ]);

                      if (isMounted.current) {
                        navigation.replace('BabyOptional');
                      }
                    }
                  } catch (checkError) {
                    console.error('Error checking remaining babies:', checkError);
                  }
                }, 300);
              } else {
                showError('Error', 'Failed to delete profile');
              }
            } catch (error) {
              showError('Error', 'Failed to delete profile');
            }
          }
        },
      ]
    );
  }, [babies.length, deleteBaby, loadBabies, navigation, showError, showSuccess]);

  const handleAddBaby = useCallback(() => {
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  const handleContinue = useCallback(() => {
    navigation.replace('Main');
  }, [navigation]);

  if (babyLoading && babies.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <LiquidDots
              colors={[
                themeColors.primary,
                themeColors.secondary || '#764ba2',
                '#f093fb',
                '#4facfe'
              ]}
              size={72}
            />
            <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading babies...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const hasPartner = parent2 !== null && parent2 !== undefined;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View entering={FadeInUp} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <BlurView intensity={80} style={styles.backBlur}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </BlurView>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>Select Baby</Text>
          <Text style={styles.headerSubtitle}>{babies.length} {babies.length === 1 ? 'profile' : 'profiles'}</Text>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddBaby}>
          <BlurView intensity={80} style={styles.addBlur}>
            <Ionicons name="add" size={24} color={themeColors.primary} />
          </BlurView>
        </TouchableOpacity>
      </Animated.View>

      <AutoHideAnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.delay(100)}>
          <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>
            {babies.length > 1 ? 'Choose a baby profile' : 'Your Baby'}
          </Text>
        </Animated.View>

        {/* Baby List */}
        <View style={styles.babyList}>
          {babies.map((baby, index) => {
            const isSelected = baby.id === currentBabyId;

            return (
              <Animated.View key={baby.id} entering={FadeInUp.delay(100 + index * 60)} layout={Layout.springify()}>
                <GlassmorphismCard
                  style={[styles.babyCard, isSelected && styles.babyCardSelected]}
                  intensity={isSelected ? 95 : 80}
                  isDark={isDark}
                >
                  <TouchableOpacity
                    style={styles.babyCardContent}
                    onPress={() => handleSwitchBaby(baby.id)}
                    activeOpacity={0.9}
                    disabled={isProcessing}
                  >
                    <SafeBabyAvatar
                      avatar={baby.avatar}
                      gender={baby.gender}
                      size={64}
                      animated={!shouldReduceMotion}
                    />

                    <View style={styles.babyInfo}>
                      <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                      <Text style={styles.babyAge}>{baby.age}</Text>
                      <Text style={styles.babyMeta}>
                        {baby.gender === 'girl' ? '👧 Girl' : baby.gender === 'boy' ? '👦 Boy' : '👶 Other'} • {new Date(baby.birthDate).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={styles.babyActions}>
                      {isSelected ? (
                        <View style={[styles.currentBadge, { backgroundColor: themeColors.primary }]}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.switchButton, { backgroundColor: themeColors.primary + '15' }]}
                          onPress={() => handleSwitchBaby(baby.id)}
                          disabled={isProcessing}
                        >
                          <Text style={[styles.switchButtonText, { color: themeColors.primary }]}>Select</Text>
                        </TouchableOpacity>
                      )}

                      {babies.length > 1 && !isSelected && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteBaby(baby.id, baby.name)}
                          disabled={isProcessing}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                </GlassmorphismCard>
              </Animated.View>
            );
          })}
        </View>

        {/* Add New Baby Button */}
        <Animated.View entering={FadeInUp.delay(300 + babies.length * 60)}>
          <TouchableOpacity style={styles.addBabyCard} onPress={handleAddBaby}>
            <LinearGradient
              colors={[themeColors.primary + '15', themeColors.secondary + '15']}
              style={styles.addBabyGradient}
            >
              <View style={[styles.addBabyIcon, { backgroundColor: themeColors.primary + '15' }]}>
                <Ionicons name="add" size={32} color={themeColors.primary} />
              </View>
              <Text style={[styles.addBabyText, isDark && styles.textDark]}>Add New Baby Profile</Text>
              <Ionicons name="chevron-forward" size={20} color={themeColors.primary} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Family Info Footer */}
        <Animated.View entering={FadeIn.delay(400 + babies.length * 60)}>
          <BlurView intensity={60} style={styles.familyInfo} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="people" size={20} color={themeColors.primary} />
            <Text style={[styles.familyText, isDark && { color: '#94a3b8' }]}>
              {hasPartner
                ? `Family: ${userProfile?.fullName} & ${parent2?.fullName}`
                : `Managed by ${userProfile?.fullName || 'Parent'}`
              }
            </Text>
          </BlurView>
        </Animated.View>

        {/* Continue Button */}
        <Animated.View entering={FadeInUp.delay(500 + babies.length * 60)}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.continueGradient}>
              <Text style={styles.continueText}>Continue to App</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </AutoHideAnimatedScrollView>
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
    flex: 1,
    paddingHorizontal: 20,
  },
  textDark: {
    color: '#ffffff',
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 100,
  },
  backButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  backBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },

  babyList: {
    gap: 12,
  },
  babyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  babyCardSelected: {
    borderWidth: 2,
    borderColor: '#667eea',
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
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  babyAge: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
    fontWeight: '500',
  },
  babyMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  babyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  switchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  switchButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
  },

  addBabyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
    borderStyle: 'dashed',
  },
  addBabyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  addBabyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBabyText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },

  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 20,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  continueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  familyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  familyText: {
    fontSize: 14,
    color: '#64748b',
  },

  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  glassContent: {
    flex: 1,
  },
});