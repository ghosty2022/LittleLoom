import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Dimensions, Image, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, Layout, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { SafeBabyAvatar } from '../../components/SafeAvatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';

const { width } = Dimensions.get('window');

type SwitchBabyScreenProps = NativeStackScreenProps<RootStackParamList, 'SwitchBaby'>;

const GENDER_OPTIONS = [
  { value: 'boy', label: 'Boy', icon: 'male', color: '#667eea', gradient: ['#667eea', '#764ba2'] },
  { value: 'girl', label: 'Girl', icon: 'female', color: '#fa709a', gradient: ['#fa709a', '#fee140'] },
  { value: 'other', label: 'Other', icon: 'ellipse', color: '#11998e', gradient: ['#11998e', '#38ef7d'] },
];

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

export default function SwitchBabyScreen({ navigation }: SwitchBabyScreenProps) {
  const { babies, currentBabyId, switchBaby, deleteBaby, loadBabies, isLoading: babyLoading } = useBaby();
  const { userProfile } = useAuth();
  const { parent2 } = useFamily();
  const insets = useSafeAreaInsets();

  const { darkMode: isDark, themeColors, shouldReduceMotion } = useCustomization();
  const { toast, error: showError, success: showSuccess } = useSweetAlert();

  const [isProcessing, setIsProcessing] = useState(false);
  const hasNavigated = useRef(false);

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
          if (!hasNavigated.current) {
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

  const handleAddPartner = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Parent2Setup');
  }, [navigation]);

  const handleSkipPartner = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace('Main');
  }, [navigation]);

  const handleDeleteBaby = useCallback((babyId: string, babyName: string) => {
    if (babies.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one baby profile');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
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

                if (babies.length <= 1) {
                  setTimeout(() => {
                    navigation.replace('CreateBabyProfile');
                  }, 500);
                }
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

  if (babyLoading && babies.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
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

      <AutoHideScrollView
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
                      showBadge={isSelected}
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

        {/* Partner Section */}
        {!hasPartner && (
          <Animated.View entering={FadeInUp.delay(400 + babies.length * 60)}>
            <View style={styles.partnerSection}>
              <Text style={[styles.partnerLabel, isDark && { color: '#94a3b8' }]}>
                Co-Parent
              </Text>

              <GlassmorphismCard style={styles.partnerCard} isDark={isDark}>
                <View style={styles.partnerContent}>
                  <View style={[styles.partnerIconContainer, { backgroundColor: themeColors.primary + '15' }]}>
                    <Ionicons name="people-outline" size={28} color={themeColors.primary} />
                  </View>
                  <View style={styles.partnerInfo}>
                    <Text style={[styles.partnerTitle, isDark && styles.textDark]}>
                      Add a Co-Parent?
                    </Text>
                    <Text style={styles.partnerSubtitle}>
                      Invite your partner to share baby tracking
                    </Text>
                  </View>
                </View>

                <View style={styles.partnerActions}>
                  <TouchableOpacity
                    style={styles.skipPartnerButton}
                    onPress={handleSkipPartner}
                  >
                    <Text style={styles.skipPartnerText}>Skip</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.addPartnerButton}
                    onPress={handleAddPartner}
                  >
                    <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.addPartnerGradient}>
                      <Ionicons name="person-add" size={18} color="#fff" />
                      <Text style={styles.addPartnerButtonText}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </GlassmorphismCard>
            </View>
          </Animated.View>
        )}

        {/* Family Info Footer */}
        <Animated.View entering={FadeIn.delay(500 + babies.length * 60)}>
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
        <Animated.View entering={FadeInUp.delay(600 + babies.length * 60)}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => navigation.replace('Main')}
          >
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.continueGradient}>
              <Text style={styles.continueText}>Continue to App</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </AutoHideScrollView>
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

  partnerSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  partnerLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '500',
  },
  partnerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
  },
  partnerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  partnerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  partnerSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  partnerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  skipPartnerButton: {
    flex: 1,
    backgroundColor: 'rgba(100,116,139,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  skipPartnerText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  addPartnerButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addPartnerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  addPartnerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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