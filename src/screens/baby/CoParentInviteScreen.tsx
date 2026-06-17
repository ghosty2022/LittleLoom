import React, { useCallback } from 'react';
import { Button, Settings, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Parent2Optional'>;

export default function CoParentInviteScreen({ navigation }: Props) {
  const { userProfile, skipSetup } = useAuth();
  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    shouldReduceMotion,
    triggerHaptic,
    avatar,
  } = useCustomization();

  const dynamicPrimary = themeColors.primary;
  const dynamicSecondary = themeColors.secondary;
  const dynamicGradient = [dynamicPrimary, dynamicSecondary] as [string, string];

  const handleSkip = useCallback(async () => {
    triggerHaptic('light');
    try {
      await skipSetup('parent2');
      navigation.replace('BabyOptional');
    } catch (error) {
      console.error('Error skipping Parent2:', error);
      navigation.replace('BabyOptional');
    }
  }, [navigation, skipSetup, triggerHaptic]);

  const handleAddParent = useCallback(() => {
    triggerHaptic('medium');
    navigation.navigate('Parent2Setup');
  }, [navigation, triggerHaptic]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f0f4ff', '#e0e7ff']}
        style={styles.gradient}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp}
            style={styles.header}
          >
            <View style={[
              styles.iconContainer,
              isDark && { backgroundColor: 'rgba(255,255,255,0.1)' },
              { borderColor: dynamicPrimary + '4D' }
            ]}>
              <SafeAvatar
                avatar={avatar}
                size={80}
                fallbackIcon="people"
                fallbackColor={dynamicPrimary}
                fallbackBgColor={dynamicPrimary + '20'}
                borderWidth={2}
                borderColor={dynamicPrimary + '40'}
                animated={!shouldReduceMotion}
              />
            </View>
            <Text style={[styles.title, isDark && styles.textDark]}>Add Co-Parent?</Text>
            <Text style={[styles.subtitle, isDark && { color: '#94a3b8' }]}>
              Invite your partner to share and track your baby's journey together
            </Text>
          </Animated.View>

          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)}
            style={styles.benefitsContainer}
          >
            <BlurView intensity={60} style={styles.glassCard}>
              <BenefitItem
                icon="sync"
                text="Real-time sync of all activities"
                isDark={isDark}
                themeColor={dynamicPrimary}
              />
              <BenefitItem
                icon="notifications"
                text="Instant notifications for both parents"
                isDark={isDark}
                themeColor={dynamicPrimary}
              />
              <BenefitItem
                icon="calendar"
                text="Shared calendar and reminders"
                isDark={isDark}
                themeColor={dynamicPrimary}
              />
              <BenefitItem
                icon="analytics"
                text="Combined insights and analytics"
                isDark={isDark}
                themeColor={dynamicPrimary}
              />
            </BlurView>
          </Animated.View>

          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeIn.delay(400)}
            style={styles.buttonsContainer}
          >
            <TouchableOpacity
              style={[styles.primaryButton, { shadowColor: dynamicPrimary }]}
              onPress={handleAddParent}
              activeOpacity={0.8}
            >
              <LinearGradient colors={dynamicGradient} style={styles.primaryGradient}>
                <Ionicons name="person-add" size={24} color="#fff" />
                <Text style={styles.primaryText}>Add Co-Parent</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={[styles.skipText, isDark && styles.textDark]}>Skip for Now</Text>
              <Text style={[styles.skipSubtext, isDark && { color: '#64748b' }]}>
                You can add later in settings
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            entering={shouldReduceMotion ? undefined : FadeIn.delay(600)}
            style={styles.userInfo}
          >
            <Text style={[styles.userText, isDark && { color: '#64748b' }]}>
              Signed in as {userProfile?.fullName}
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

function BenefitItem({
  icon,
  text,
  isDark,
  themeColor = '#667eea'
}: {
  icon: string;
  text: string;
  isDark: boolean;
  themeColor?: string;
}) {
  return (
    <View style={styles.benefitItem}>
      <View style={[
        styles.benefitIcon,
        isDark && { backgroundColor: themeColor + '33' }
      ]}>
        <Ionicons name={icon as any} size={20} color={themeColor} />
      </View>
      <Text style={[styles.benefitText, isDark && styles.textDark]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'space-between' },
  textDark: { color: '#fff' },

  header: { alignItems: 'center' },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.3)'
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300
  },

  benefitsContainer: { marginVertical: 20 },
  glassCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    gap: 16
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '600'
  },

  buttonsContainer: { gap: 16 },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12
  },
  primaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff'
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12
  },
  skipText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a'
  },
  skipSubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4
  },

  userInfo: { alignItems: 'center' },
  userText: {
    fontSize: 14,
    color: '#64748b'
  },
});
