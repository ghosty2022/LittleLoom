import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn, Layout, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useBaby } from '../context/BabyContext';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext'; // NEW: For partner check
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');

type SwitchBabyScreenProps = NativeStackScreenProps<RootStackParamList, 'SwitchBaby'>;

// ==================== SWEET ALERT COMPONENT ====================
interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const SweetAlert = ({ visible, type, title, message, onClose, isDark }: AlertState & { onClose: () => void; isDark: boolean }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(-50);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      translateY.value = withSpring(0, { damping: 15 });
      
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        translateY.value = withTiming(-30, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning' },
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100, pointerEvents: 'none' }]}>
      <Animated.View style={[style, styles.alertContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={styles.alertIconBg}>
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={styles.alertTextContainer}>
          <Text style={[styles.alertTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

// ==================== GLASSMORPHISM CARD ====================
const GlassmorphismCard: React.FC<{ children: React.ReactNode; style?: any; onPress?: () => void; intensity?: number }> = ({ children, style, onPress, intensity = 80 }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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

// ==================== MAIN SCREEN ====================
export default function SwitchBabyScreen({ navigation }: SwitchBabyScreenProps) {
  const { babies, currentBabyId, switchBaby, deleteBaby, loadBabies, isLoading: babyLoading } = useBaby();
  const { userProfile, setupComplete, hasParent2 } = useAuth();
  const { parent2, inviteMember } = useFamily(); // NEW: Check for partner
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddParentModal, setShowAddParentModal] = useState(false); // NEW

  const hasNavigated = useRef(false);

  const showToast = useCallback((type: AlertState['type'], title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  // ============================================
  // CRITICAL: Handle baby switching
  // ============================================
  const handleSwitchBaby = useCallback(async (babyId: string) => {
    if (babyId === currentBabyId) {
      // Already selected, just go to Main
      navigation.replace('Main');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    
    try {
      const success = await switchBaby(babyId);
      
      if (success) {
        await loadBabies();
        showToast('success', 'Switched', 'Baby profile updated');
        
        // Navigate to Main after short delay
        setTimeout(() => {
          if (!hasNavigated.current) {
            hasNavigated.current = true;
            navigation.replace('Main');
          }
        }, 500);
      } else {
        showToast('error', 'Error', 'Failed to switch baby profile');
        setIsProcessing(false);
      }
    } catch (error) {
      showToast('error', 'Error', 'An unexpected error occurred');
      setIsProcessing(false);
    }
  }, [currentBabyId, switchBaby, loadBabies, navigation, showToast]);

  // ============================================
  // NEW: Handle adding a partner
  // ============================================
  const handleAddPartner = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Parent2Setup');
  }, [navigation]);

  // ============================================
  // NEW: Handle skipping partner addition
  // ============================================
  const handleSkipPartner = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Just proceed to Main, don't force partner addition
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
                showToast('success', 'Deleted', 'Baby profile removed');
                
                if (babies.length <= 1) {
                  setTimeout(() => {
                    navigation.replace('CreateBabyProfile');
                  }, 500);
                }
              } else {
                showToast('error', 'Error', 'Failed to delete profile');
              }
            } catch (error) {
              showToast('error', 'Error', 'Failed to delete profile');
            }
          }
        },
      ]
    );
  }, [babies.length, deleteBaby, loadBabies, navigation, showToast]);

  const handleAddBaby = useCallback(() => {
    navigation.navigate('CreateBabyProfile');
  }, [navigation]);

  // Show loading state
  if (babyLoading && babies.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']} style={styles.gradient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={[styles.content, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading babies...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Check if user has a partner
  const hasPartner = parent2 !== null && parent2 !== undefined;

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
            <Ionicons name="add" size={24} color="#667eea" />
          </BlurView>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView 
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
                >
                  <TouchableOpacity 
                    style={styles.babyCardContent} 
                    onPress={() => handleSwitchBaby(baby.id)}
                    activeOpacity={0.9}
                    disabled={isProcessing}
                  >
                    <LinearGradient 
                      colors={isSelected ? ['#667eea', '#764ba2'] : ['#fa709a', '#fee140']} 
                      style={styles.avatar}
                    >
                      <Text style={styles.avatarEmoji}>{baby.avatar || '👶'}</Text>
                      {isSelected && (
                        <View style={styles.checkmarkBadge}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                      )}
                    </LinearGradient>
                    
                    <View style={styles.babyInfo}>
                      <Text style={[styles.babyName, isDark && styles.textDark]}>{baby.name}</Text>
                      <Text style={styles.babyAge}>{baby.age}</Text>
                      <Text style={styles.babyMeta}>
                        {baby.gender === 'girl' ? '👧 Girl' : baby.gender === 'boy' ? '👦 Boy' : '👶 Other'} • {new Date(baby.birthDate).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={styles.babyActions}>
                      {isSelected ? (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.switchButton}
                          onPress={() => handleSwitchBaby(baby.id)}
                          disabled={isProcessing}
                        >
                          <Text style={styles.switchButtonText}>Select</Text>
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
              colors={['rgba(102,126,234,0.1)', 'rgba(118,75,162,0.1)']} 
              style={styles.addBabyGradient}
            >
              <View style={styles.addBabyIcon}>
                <Ionicons name="add" size={32} color="#667eea" />
              </View>
              <Text style={[styles.addBabyText, isDark && styles.textDark]}>Add New Baby Profile</Text>
              <Ionicons name="chevron-forward" size={20} color="#667eea" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ============================================
            NEW: Partner Section
            Show if user doesn't have a partner
        ============================================ */}
        {!hasPartner && (
          <Animated.View entering={FadeInUp.delay(400 + babies.length * 60)}>
            <View style={styles.partnerSection}>
              <Text style={[styles.partnerLabel, isDark && { color: '#94a3b8' }]}>
                Co-Parent
              </Text>
              
              <GlassmorphismCard style={styles.partnerCard}>
                <View style={styles.partnerContent}>
                  <View style={styles.partnerIconContainer}>
                    <Ionicons name="people-outline" size={28} color="#667eea" />
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
                    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addPartnerGradient}>
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
          <BlurView intensity={60} style={styles.familyInfo}>
            <Ionicons name="people" size={20} color="#667eea" />
            <Text style={[styles.familyText, isDark && { color: '#94a3b8' }]}>
              {hasPartner 
                ? `Family: ${userProfile?.fullName} & ${parent2?.fullName}`
                : `Managed by ${userProfile?.fullName || 'Parent'}`
              }
            </Text>
          </BlurView>
        </Animated.View>

        {/* Continue Button (if they just want to proceed) */}
        <Animated.View entering={FadeInUp.delay(600 + babies.length * 60)}>
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={() => navigation.replace('Main')}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.continueGradient}>
              <Text style={styles.continueText}>Continue to App</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <SweetAlert 
        {...alert} 
        onClose={() => setAlert({ ...alert, visible: false })} 
        isDark={isDark} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  gradient: { 
    flex: 1 
  },
  textDark: { 
    color: '#ffffff' 
  },

  // Header
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

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
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

  // Baby List
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
  avatar: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    alignItems: 'center', 
    justifyContent: 'center',
    position: 'relative',
  },
  avatarEmoji: { 
    fontSize: 32 
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  babyInfo: { 
    flex: 1, 
    marginLeft: 16 
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
    backgroundColor: '#667eea',
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
    backgroundColor: 'rgba(102,126,234,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  switchButtonText: {
    color: '#667eea',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
  },

  // Add Baby Card
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
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBabyText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },

  // Partner Section - NEW
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
    backgroundColor: 'rgba(102,126,234,0.1)',
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

  // Continue Button
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

  // Family Info
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

  // Glass Card
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
    backgroundColor: 'rgba(255,255,255,0.8)' 
  },
  glassContent: { 
    flex: 1 
  },

  // Alert
  alertContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 10, 
    minWidth: 300, 
    maxWidth: width - 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertIconBg: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  alertTextContainer: { 
    flex: 1 
  },
  alertTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    marginBottom: 2 
  },
  alertMessage: { 
    fontSize: 13, 
    color: '#64748b' 
  },
});
