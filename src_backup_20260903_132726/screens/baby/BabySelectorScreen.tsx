import { StyleSheet, Dimensions, Text, TouchableOpacity, View, StatusBar, Platform } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, Layout, FadeOutDown, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

import { SafeBabyAvatar } from '../../components/SafeAvatar';
import { useBaby } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { LiquidDots } from '../../components/UniversalSpinner';

const { width, height } = Dimensions.get('window');

type BabySelectorScreenProps = NativeStackScreenProps<RootStackParamList, 'SwitchBaby'>;

// Helper to read return target from route params
const VALID_ROOT_SCREENS = new Set<string>([
  'Main', 'Onboarding', 'Login', 'SignUp', 'ForgotPassword', 
  'CreateBabyProfile', 'SwitchBaby', 'AddParent', 'UniversalTrackerHub',
  'Timeline', 'GrowthDashboard', 'Achievements', 'TrackerReminders',
  'SafetyCorner', 'Gallery', 'SoundMixer', 'FamilySharing', 'FamilyChatList',
  'HelpCenter', 'ContactSupport', 'Profile', 'EditProfile', 'EditGuardian',
  'VaccinationSchedule', 'Customize', 'SecurityCenter', 'BiometricSetup',
  'BackupRestore', 'LanguageSettings', 'UnitSettings', 'PrivacyPolicy',
  'TermsOfService', 'About', 'EntryDetail', 'Insights', 'CreateCustomTracker',
  'AddEntry', 'FamilyChat', 'SecurityLock', 'CoParentInviteScreen', 'Parent2Setup',
  'BabyOptional', 'InviteCodeScreen'
]);

const TAB_SCREEN_MAP: Record<string, keyof RootStackParamList> = {
  Home: 'Main',
  Track: 'Main',
  Grow: 'Main',
  Connect: 'Main',
  More: 'Main',
};

const sanitizeRoute = (routeName: string | null | undefined): keyof RootStackParamList => {
  if (!routeName || typeof routeName !== 'string') return 'Main';
  if (VALID_ROOT_SCREENS.has(routeName)) return routeName as keyof RootStackParamList;
  if (TAB_SCREEN_MAP[routeName]) return TAB_SCREEN_MAP[routeName];
  return 'Main';
};

const getReturnTarget = (route: BabySelectorScreenProps['route']): keyof RootStackParamList => {
  return sanitizeRoute(route.params?.returnTo);
};

const getReturnLabel = (route: BabySelectorScreenProps['route']): string => {
  const label = route.params?.returnLabel;
  if (label && typeof label === 'string') return label;

  const raw = route.params?.returnTo;
  if (!raw || typeof raw !== 'string' || raw === 'Main') return 'Home';
  if (TAB_SCREEN_MAP[raw]) return raw;
  return raw;
};

// ─── ENHANCED GLASSMORPHISM CARD ─────────────────────────────────────
const GlassmorphismCard: React.FC<{ 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  intensity?: number; 
  isDark?: boolean;
  animated?: boolean;
  delay?: number;
}> = ({ 
  children, 
  style, 
  onPress, 
  intensity = 80, 
  isDark = false,
  animated = false,
  delay = 0
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  const Component = animated ? Animated.View : View;
  const entering = animated ? FadeInUp.delay(delay).springify().damping(15) : undefined;

  return (
    <Component entering={entering}>
      <Wrapper onPress={onPress} activeOpacity={0.7} style={[styles.glassCard, style]}>
        <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <LinearGradient
          colors={isDark 
            ? ['rgba(40,40,50,0.85)', 'rgba(20,20,30,0.6)'] 
            : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.glassBorder} />
        <View style={styles.glassContent}>{children}</View>
      </Wrapper>
    </Component>
  );
};

// ─── BABY CARD COMPONENT ─────────────────────────────────────────────
const BabyCard: React.FC<{
  baby: any;
  isSelected: boolean;
  isDark: boolean;
  themeColors: any;
  isProcessing: boolean;
  shouldReduceMotion: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  index: number;
}> = ({ 
  baby, 
  isSelected, 
  isDark, 
  themeColors, 
  isProcessing, 
  shouldReduceMotion,
  onSelect,
  onDelete,
  index
}) => {
  const canDelete = baby.babiesCount > 1 || false;

  return (
    <Animated.View 
      entering={FadeInUp.delay(100 + index * 60).springify().damping(15)}
      layout={Layout.springify().damping(20)}
      exiting={FadeOutDown.duration(200)}
    >
      <GlassmorphismCard
        style={[
          styles.babyCard,
          isSelected && styles.babyCardSelected,
          isSelected && { borderColor: themeColors.primary }
        ]}
        intensity={isSelected ? 95 : 80}
        isDark={isDark}
      >
        <TouchableOpacity
          style={styles.babyCardContent}
          onPress={() => onSelect(baby.id)}
          activeOpacity={0.85}
          disabled={isProcessing}
        >
          {/* Avatar with glow effect when selected */}
          <View style={styles.avatarWrapper}>
            {isSelected && (
              <Animated.View 
                entering={FadeIn.duration(300)}
                style={[styles.avatarGlow, { backgroundColor: themeColors.primary + '30' }]}
              />
            )}
            <SafeBabyAvatar
              avatar={baby.avatar}
              gender={baby.gender}
              size={64}
              animated={!shouldReduceMotion}
            />
          </View>

          <View style={styles.babyInfo}>
            <Text style={[styles.babyName, isDark && styles.textDark]}>
              {baby.name}
            </Text>
            <View style={styles.babyDetailsRow}>
              <Text style={styles.babyAge}>{baby.age}</Text>
              <View style={styles.babyDot} />
              <Text style={styles.babyMeta}>
                {baby.gender === 'girl' ? '👧' : baby.gender === 'boy' ? '👦' : '👶'}
              </Text>
              <View style={styles.babyDot} />
              <Text style={styles.babyMeta}>
                {new Date(baby.birthDate).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.babyActions}>
            {isSelected ? (
              <Animated.View 
                entering={FadeIn.duration(300)}
                style={[styles.currentBadge, { backgroundColor: themeColors.primary }]}
              >
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.currentBadgeText}>Active</Text>
              </Animated.View>
            ) : (
              <TouchableOpacity
                style={[styles.switchButton, { backgroundColor: themeColors.primary + '15' }]}
                onPress={() => onSelect(baby.id)}
                disabled={isProcessing}
              >
                <Text style={[styles.switchButtonText, { color: themeColors.primary }]}>
                  Select
                </Text>
                <Ionicons name="arrow-forward" size={16} color={themeColors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </GlassmorphismCard>
    </Animated.View>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────
export default function BabySelectorScreen({ navigation, route }: BabySelectorScreenProps) {
  const sweetAlert = useSweetAlert();
  const { babies, currentBabyId, switchBaby, deleteBaby, loadBabies, isLoading: babyLoading } = useBaby();
  const { userProfile } = useAuth();
  const { parent2 } = useFamily();
  const insets = useSafeAreaInsets();

  const { darkMode: isDark, themeColors, shouldReduceMotion } = useCustomization();

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasNavigated = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Safe navigation function that checks if we can go back
  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace(getReturnTarget(route));
    }
  }, [navigation, route]);

  const handleSwitchBaby = useCallback(async (babyId: string) => {
    if (babyId === currentBabyId) {
      safeGoBack();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    setSelectedId(babyId);

    try {
      const success = await switchBaby(babyId);

      if (success) {
        await loadBabies();
        sweetAlert.success('Switched', 'Baby profile updated');

        setTimeout(() => {
          if (!hasNavigated.current && isMounted.current) {
            hasNavigated.current = true;
            safeGoBack();
          }
        }, 400);
      } else {
        sweetAlert.error('Error', 'Failed to switch baby profile');
        setIsProcessing(false);
        setSelectedId(null);
      }
    } catch (error) {
      sweetAlert.error('Error', 'An unexpected error occurred');
      setIsProcessing(false);
      setSelectedId(null);
    }
  }, [currentBabyId, switchBaby, loadBabies, sweetAlert, safeGoBack]);

  const handleDeleteBaby = useCallback((babyId: string, babyName: string) => {
    if (isProcessing) return;
    if (babies.length <= 1) {
      sweetAlert.alert('Cannot Delete', 'You must have at least one baby profile', 'warning');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    sweetAlert.confirm(
      'Delete Profile?',
      `Are you sure you want to delete ${babyName}'s profile? This cannot be undone.`,
      async () => {
        setIsProcessing(true);
        try {
          const success = await deleteBaby(babyId);
          if (success) {
            await loadBabies();
            sweetAlert.success('Deleted', `${babyName}'s profile has been removed`);
          } else {
            sweetAlert.error('Error', `Failed to delete ${babyName}'s profile`);
          }
        } catch (error) {
          sweetAlert.error('Error', 'An unexpected error occurred');
        } finally {
          setIsProcessing(false);
        }
      },
      () => {},
      'Delete',
      'Cancel',
      true
    );
  }, [babies.length, deleteBaby, loadBabies, sweetAlert, isProcessing]);

  const handleAddBaby = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    safeGoBack();
  }, [safeGoBack]);

  const handleBackPress = useCallback(() => {
    safeGoBack();
  }, [safeGoBack]);

  // ─── LOADING STATE ──────────────────────────────────────────────────
  if (babyLoading && babies.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient 
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} 
          style={styles.gradient}
        >
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
            <Text style={[styles.loadingText, isDark && styles.textDark]}>
              Loading babies...
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const hasPartner = parent2 !== null && parent2 !== undefined;
  const hasMultipleBabies = babies.length > 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient 
        colors={isDark 
          ? ['#0a0a0a', '#1a1a2e', '#16213e'] 
          : ['#f8fafc', '#e2e8f0', '#dbeafe']} 
        style={StyleSheet.absoluteFill} 
      />

      {/* Decorative floating elements */}
      <Animated.View 
        entering={FadeIn.duration(800)}
        style={[styles.decorativeBlob, styles.decorativeBlob1, { backgroundColor: themeColors.primary + '10' }]}
      />
      <Animated.View 
        entering={FadeIn.duration(1000).delay(200)}
        style={[styles.decorativeBlob, styles.decorativeBlob2, { backgroundColor: themeColors.secondary + '10' }]}
      />

      {/* Header */}
      <Animated.View 
        entering={SlideInDown.springify().damping(20)}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity 
          onPress={handleBackPress} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <BlurView intensity={80} style={styles.backBlur} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </BlurView>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>
            Select Baby
          </Text>
          <Text style={[styles.headerSubtitle, isDark && { color: '#94a3b8' }]}>
            {babies.length} {babies.length === 1 ? 'profile' : 'profiles'}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.addButton} 
          onPress={handleAddBaby}
          activeOpacity={0.7}
        >
          <BlurView intensity={80} style={styles.addBlur} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="add" size={28} color={themeColors.primary} />
          </BlurView>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: insets.top + 80, 
            paddingBottom: insets.bottom + 40,
            paddingHorizontal: 20
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.delay(100)}>
          <Text style={[styles.sectionLabel, isDark && { color: '#94a3b8' }]}>
            {hasMultipleBabies ? 'Choose a baby profile' : 'Your Baby'}
          </Text>
        </Animated.View>

        {/* Baby List */}
        <View style={styles.babyList}>
          {babies.map((baby, index) => {
            const isSelected = baby.id === currentBabyId;
            // Inject babiesCount for delete check
            const babyWithCount = { ...baby, babiesCount: babies.length };
            
            return (
              <BabyCard
                key={baby.id}
                baby={babyWithCount}
                isSelected={isSelected}
                isDark={isDark}
                themeColors={themeColors}
                isProcessing={isProcessing}
                shouldReduceMotion={shouldReduceMotion}
                onSelect={handleSwitchBaby}
                onDelete={handleDeleteBaby}
                index={index}
              />
            );
          })}
        </View>

        {/* Add New Baby Button */}
        <Animated.View entering={FadeInUp.delay(300 + babies.length * 60).springify().damping(15)}>
          <TouchableOpacity 
            style={styles.addBabyCard} 
            onPress={handleAddBaby}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[
                themeColors.primary + '08', 
                themeColors.secondary + '08'
              ]}
              style={styles.addBabyGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.addBabyIcon, { backgroundColor: themeColors.primary + '15' }]}>
                <Ionicons name="add" size={32} color={themeColors.primary} />
              </View>
              <Text style={[styles.addBabyText, isDark && styles.textDark]}>
                Add New Baby Profile
              </Text>
              <Ionicons name="chevron-forward" size={20} color={themeColors.primary} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Family Info Footer */}
        <Animated.View entering={FadeIn.delay(400 + babies.length * 60)}>
          <BlurView 
            intensity={60} 
            style={styles.familyInfo} 
            tint={isDark ? 'dark' : 'light'}
          >
            <View style={styles.familyIconContainer}>
              <Ionicons name="people" size={18} color={themeColors.primary} />
            </View>
            <Text style={[styles.familyText, isDark && { color: '#94a3b8' }]}>
              {hasPartner
                ? `Family: ${userProfile?.fullName} & ${parent2?.fullName}`
                : `Managed by ${userProfile?.fullName || 'Parent'}`
              }
            </Text>
          </BlurView>
        </Animated.View>

        {/* Continue Button */}
        <Animated.View entering={FadeInUp.delay(500 + babies.length * 60).springify().damping(15)}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <LinearGradient 
              colors={[themeColors.primary, themeColors.secondary]} 
              style={styles.continueGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.continueText}>Continue to {getReturnLabel(route)}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.ScrollView>
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

  // ─── DECORATIVE ELEMENTS ──────────────────────────────────────────
  decorativeBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.4,
  },
  decorativeBlob1: {
    width: width * 0.5,
    height: width * 0.5,
    top: -width * 0.2,
    right: -width * 0.1,
  },
  decorativeBlob2: {
    width: width * 0.4,
    height: width * 0.4,
    bottom: -width * 0.15,
    left: -width * 0.1,
  },

  // ─── HEADER ─────────────────────────────────────────────────────────
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

  // ─── SCROLL CONTENT ────────────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },

  // ─── BABY LIST ─────────────────────────────────────────────────────
  babyList: {
    gap: 12,
  },

  // ─── BABY CARD ─────────────────────────────────────────────────────
  babyCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  babyCardSelected: {
    borderWidth: 2,
  },
  babyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 40,
    opacity: 0.3,
  },
  babyInfo: {
    flex: 1,
  },
  babyName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  babyDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  babyAge: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  babyDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#94a3b8',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
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

  // ─── ADD BABY CARD ─────────────────────────────────────────────────
  addBabyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.15)',
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

  // ─── CONTINUE BUTTON ──────────────────────────────────────────────
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
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
    letterSpacing: 0.3,
  },

  // ─── FAMILY INFO ──────────────────────────────────────────────────
  familyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  familyIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  familyText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // ─── GLASS CARD ────────────────────────────────────────────────────
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
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