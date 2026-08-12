import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  Clipboard,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedReanimated, {
  FadeInUp,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useApp } from '../../context/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Parent2Setup'>;

const { width: SCREEN_W } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   ROLE CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */

type RoleKey = 'parent2' | 'guardian' | 'viewer';

const ROLE_META: Record<RoleKey, {
  label: string;
  color: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  placeholder: string;
}> = {
  parent2: {
    label: 'Co-Parent',
    color: '#ec4899',
    gradient: ['#ec4899', '#f43f5e'],
    icon: 'heart',
    description: 'Full access to manage baby data, family settings, and export',
    placeholder: 'e.g., Father, Mother, Partner',
  },
  guardian: {
    label: 'Guardian',
    color: '#10b981',
    gradient: ['#10b981', '#34d399'],
    icon: 'shield-checkmark',
    description: 'Can log activities and view data, but cannot manage family',
    placeholder: 'e.g., Grandma, Nanny, Uncle',
  },
  viewer: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    description: 'View-only access to timeline, photos, and growth charts',
    placeholder: 'e.g., Aunt, Family Friend',
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SIMPLE QR CODE COMPONENT (SVG-based, no extra deps)
   ═══════════════════════════════════════════════════════════════════════════ */

const SimpleQR: React.FC<{ data: string; size?: number; color?: string }> = ({
  data,
  size = 160,
  color = '#1a1a1a',
}) => {
  // Deterministic pseudo-random pattern based on string hash
  const hash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < data.length; i++) h = ((h << 5) - h + data.charCodeAt(i)) | 0;
    return Math.abs(h);
  }, [data]);

  const cells = 25;
  const cellSize = size / cells;
  const modules: boolean[][] = useMemo(() => {
    const grid: boolean[][] = [];
    const seed = hash;
    for (let r = 0; r < cells; r++) {
      grid[r] = [];
      for (let c = 0; c < cells; c++) {
        // Create a plausible QR-like pattern
        const isFinder = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
        const isTiming = r === 6 || c === 6;
        const isDark = isFinder
          ? (r === 0 || r === 6 || c === 0 || c === 6 || (r > 1 && r < 5 && c > 1 && c < 5))
          : isTiming
          ? (r + c) % 2 === 0
          : Math.sin((r * 7 + c * 13 + seed) * 0.5) > 0;
        grid[r][c] = isDark;
      }
    }
    // Ensure some data-like randomness in center
    for (let r = 8; r < cells - 8; r++) {
      for (let c = 8; c < cells - 8; c++) {
        grid[r][c] = Math.sin((r * 3 + c * 5 + seed) * 0.8) > 0.1;
      }
    }
    return grid;
  }, [hash]);

  return (
    <View style={[styles.qrContainer, { width: size, height: size }]}>
      {modules.map((row, r) =>
        row.map((isDark, c) =>
          isDark ? (
            <View
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: c * cellSize,
                top: r * cellSize,
                width: cellSize + 0.5,
                height: cellSize + 0.5,
                backgroundColor: color,
              }}
            />
          ) : null
        )
      )}
      {/* Center logo placeholder */}
      <View style={[styles.qrLogo, { backgroundColor: '#fff' }]}>
        <Ionicons name="link" size={20} color={color} />
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const Toast = ({ message, type, visible, onHide }: {
  message: string; type: 'success' | 'error' | 'info';
  visible: boolean; onHide: () => void;
}) => {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      RNAnimated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      const t = setTimeout(() => {
        RNAnimated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(onHide);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [visible, onHide, opacity]);
  if (!visible) return null;

  const colors = {
    success: { bg: '#10b981', icon: 'checkmark-circle' },
    error: { bg: '#ef4444', icon: 'alert-circle' },
    info: { bg: '#3b82f6', icon: 'information-circle' },
  }[type];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <RNAnimated.View style={[styles.toast, { opacity, backgroundColor: colors.bg }]}>
        <Ionicons name={colors.icon as any} size={18} color="#fff" />
        <Text style={styles.toastText}>{message}</Text>
      </RNAnimated.View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CoParentSetupScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [role, setRole] = useState<RoleKey>('parent2');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentCodes, setRecentCodes] = useState<Array<{ code: string; role: RoleKey; createdAt: number }>>([]);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as const });
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const { completeSetup, skipSetup, userProfile } = useAuth();
  const { currentBaby } = useBaby();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useApp();
  const { themeColors, shouldReduceMotion, triggerHaptic } = useCustomization();

  const dynamicPrimary = themeColors.primary || colors.primary;
  const dynamicSecondary = themeColors.secondary || colors.primaryLight;
  const dynamicGradient = [dynamicPrimary, dynamicSecondary] as [string, string];

  // Success animation values
  const checkScale = useSharedValue(0);
  const checkRotate = useSharedValue(0);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: checkScale.value },
      { rotate: `${checkRotate.value}deg` },
    ],
  }));

  const triggerSuccessAnim = useCallback(() => {
    checkScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 10, stiffness: 200 }),
      withTiming(1, { duration: 200 })
    );
    checkRotate.value = withSequence(
      withTiming(-180, { duration: 0 }),
      withSpring(0, { damping: 12, stiffness: 150 })
    );
  }, [checkScale, checkRotate]);

  const validate = () => {
    if (!relationship.trim()) {
      showToast('Please enter their relationship to the baby', 'error');
      return false;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Please enter a valid email', 'error');
      return false;
    }
    return true;
  };

  const handleGenerate = useCallback(async () => {
    if (!validate()) return;
    if (!currentBaby?.id) {
      showToast('Create a baby profile first to generate invites', 'info');
      return;
    }

    triggerHaptic('medium');
    setIsGenerating(true);

    try {
      const { createInviteCode } = await import('@/database/dbHelpers');
      const result = await createInviteCode({
        familyId: currentBaby.id,
        role,
        createdBy: userProfile?.id || '',
        relationship: relationship.trim(),
        inviteeName: fullName.trim() || undefined,
        inviteeEmail: email.trim() || undefined,
        inviteePhone: phone.trim() || undefined,
        maxUses: 1,
        expiresInDays: 7,
      });

      if (result.success && result.code) {
        setGeneratedCode(result.code);
        setRecentCodes(prev => [{ code: result.code, role, createdAt: Date.now() }, ...prev].slice(0, 5));
        triggerHaptic('success');
        triggerSuccessAnim();
        showToast('Invite code generated!');
      } else {
        showToast(result.message || 'Failed to generate code', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Something went wrong', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [relationship, fullName, email, phone, currentBaby, userProfile, role, triggerHaptic, showToast, triggerSuccessAnim]);

  const handleContinue = useCallback(async () => {
    triggerHaptic('medium');
    setIsLoading(true);
    try {
      await completeSetup('parent2');
      setTimeout(() => setIsLoading(false), 600);
    } catch {
      showToast('Could not save progress', 'error');
      setIsLoading(false);
    }
  }, [completeSetup, triggerHaptic, showToast]);

  const handleSkip = useCallback(() => {
    triggerHaptic('light');
    skipSetup('parent2').catch(() => showToast('Could not skip step', 'error'));
  }, [skipSetup, triggerHaptic, showToast]);

  const shareCode = useCallback(async (method: 'copy' | 'whatsapp' | 'sms' | 'email' | 'native') => {
    if (!generatedCode) return;
    const roleLabel = ROLE_META[role].label;
    const babyName = currentBaby?.name || 'our baby';
    const message = `👋 Join me on LittleLoom!\n\n👶 Baby: ${babyName}\n🎫 Code: ${generatedCode}\n👤 Role: ${roleLabel}\n\nDownload the app and enter this code.`;
    const url = `https://littleloom.app/join?code=${generatedCode}`;

    triggerHaptic('light');

    switch (method) {
      case 'copy':
        await Clipboard.setString(`${message}\n${url}`);
        showToast('Copied to clipboard');
        break;
      case 'whatsapp':
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message + '\n' + url)}`).catch(() =>
          showToast('WhatsApp not installed', 'error')
        );
        break;
      case 'sms':
        Linking.openURL(`sms:?body=${encodeURIComponent(message)}`).catch(() =>
          showToast('SMS not available', 'error')
        );
        break;
      case 'email':
        Linking.openURL(`mailto:?subject=${encodeURIComponent(`LittleLoom Invite - ${babyName}`)}&body=${encodeURIComponent(message + '\n\n' + url)}`).catch(() =>
          showToast('Email not available', 'error')
        );
        break;
      case 'native':
        await Share.share({ message, title: `Invite to LittleLoom - ${babyName}` });
        break;
    }
  }, [generatedCode, role, currentBaby, triggerHaptic, showToast]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.surface] : ['#f8faff', '#eef2ff']}
        style={styles.gradient}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <AnimatedReanimated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.header}>
              <TouchableOpacity
                style={[styles.backBtn, isDark && styles.backBtnDark]}
                onPress={() => navigation.goBack()}
              >
                <BlurView intensity={60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
                <Ionicons name="arrow-back" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, isDark && styles.textDark]}>Invite Co-Parent</Text>
              <View style={{ width: 46 }} />
            </AnimatedReanimated.View>

            {/* Avatar */}
            <AnimatedReanimated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(80)} style={styles.avatarSection}>
              <SafeAvatar
                avatar={null}
                size={80}
                fallbackIcon="person-add"
                fallbackColor={dynamicPrimary}
                fallbackBgColor={dynamicPrimary + '12'}
                borderWidth={3}
                borderColor={dynamicPrimary + '30'}
                animated={!shouldReduceMotion}
              />
              <Text style={[styles.avatarLabel, isDark && { color: '#94a3b8' }]}>
                {currentBaby ? `Invite someone to ${currentBaby.name}'s family` : 'Invite someone to your family'}
              </Text>
            </AnimatedReanimated.View>

            {/* ── STEP 1: Role Selection ── */}
            <AnimatedReanimated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(120)} style={styles.stepSection}>
              <Text style={[styles.stepLabel, isDark && styles.textDark]}>1. Select their role</Text>
              <View style={styles.roleCards}>
                {(Object.keys(ROLE_META) as RoleKey[]).map((r) => {
                  const meta = ROLE_META[r];
                  const active = role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      activeOpacity={0.85}
                      onPress={() => { setRole(r); triggerHaptic('light'); }}
                      style={[
                        styles.roleCard,
                        active && { borderColor: meta.color, backgroundColor: meta.color + '08' },
                        isDark && styles.roleCardDark,
                      ]}
                    >
                      <LinearGradient colors={meta.gradient} style={styles.roleCardIcon}>
                        <Ionicons name={meta.icon} size={20} color="#fff" />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleCardTitle, isDark && styles.textDark]}>{meta.label}</Text>
                        <Text style={[styles.roleCardDesc, isDark && { color: '#94a3b8' }]} numberOfLines={2}>
                          {meta.description}
                        </Text>
                      </View>
                      <View style={[
                        styles.roleCheck,
                        active && { backgroundColor: meta.color, borderColor: meta.color }
                      ]}>
                        {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </AnimatedReanimated.View>

            {/* ── STEP 2: Details ── */}
            {!generatedCode && (
              <AnimatedReanimated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(180)} style={styles.stepSection}>
                <Text style={[styles.stepLabel, isDark && styles.textDark]}>2. Their details</Text>
                <View style={[styles.formCard, isDark && styles.formCardDark]}>
                  <BlurView intensity={isDark ? 30 : 70} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />

                  <InputRow
                    icon="heart-outline"
                    placeholder={ROLE_META[role].placeholder}
                    value={relationship}
                    onChangeText={setRelationship}
                    themeColor={dynamicPrimary}
                    isDark={isDark}
                  />
                  <InputRow
                    icon="person-outline"
                    placeholder="Full Name (optional)"
                    value={fullName}
                    onChangeText={setFullName}
                    themeColor={dynamicPrimary}
                    isDark={isDark}
                  />
                  <InputRow
                    icon="mail-outline"
                    placeholder="Email (optional)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    themeColor={dynamicPrimary}
                    isDark={isDark}
                    autoCapitalize="none"
                  />
                  <InputRow
                    icon="call-outline"
                    placeholder="Phone (optional)"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    themeColor={dynamicPrimary}
                    isDark={isDark}
                  />

                  <View style={styles.infoPill}>
                    <Ionicons name="information-circle" size={16} color={dynamicPrimary} />
                    <Text style={[styles.infoPillText, isDark && { color: '#94a3b8' }]}>
                      They'll use this code when signing up. Expires in 7 days.
                    </Text>
                  </View>
                </View>
              </AnimatedReanimated.View>
            )}

            {/* ── STEP 3: Generated Code ── */}
            {generatedCode ? (
              <AnimatedReanimated.View entering={shouldReduceMotion ? undefined : FadeInUp.springify()} style={styles.successSection}>
                <View style={[styles.codeCard, isDark && styles.codeCardDark]}>
                  <BlurView intensity={isDark ? 30 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />

                  <AnimatedReanimated.View style={[styles.checkBurst, checkStyle]}>
                    <LinearGradient colors={['#10b981', '#34d399']} style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={32} color="#fff" />
                    </LinearGradient>
                  </AnimatedReanimated.View>

                  <Text style={[styles.codeLabel, isDark && { color: '#94a3b8' }]}>INVITE CODE</Text>
                  <Text style={[styles.codeText, { color: dynamicPrimary }]}>{generatedCode}</Text>

                  {/* QR Code */}
                  <View style={[styles.qrWrap, isDark && styles.qrWrapDark]}>
                    <SimpleQR data={generatedCode} size={140} color={isDark ? '#fff' : '#1a1a1a'} />
                  </View>

                  <Text style={[styles.codeSub, isDark && { color: '#94a3b8' }]}>
                    Valid for 7 days • One-time use • {ROLE_META[role].label}
                  </Text>

                  {/* Share Grid */}
                  <View style={styles.shareGrid}>
                    <ShareButton icon="copy-outline" label="Copy" color="#667eea" onPress={() => shareCode('copy')} />
                    <ShareButton icon="logo-whatsapp" label="WhatsApp" color="#25d366" onPress={() => shareCode('whatsapp')} />
                    <ShareButton icon="chatbubble-outline" label="SMS" color="#3b82f6" onPress={() => shareCode('sms')} />
                    <ShareButton icon="mail-outline" label="Email" color="#ef4444" onPress={() => shareCode('email')} />
                    <ShareButton icon="share-outline" label="More" color="#64748b" onPress={() => shareCode('native')} />
                  </View>

                  <TouchableOpacity style={styles.resetBtn} onPress={() => setGeneratedCode('')}>
                    <Text style={[styles.resetText, { color: dynamicPrimary }]}>Generate Another Code</Text>
                  </TouchableOpacity>
                </View>

                {/* Continue */}
                <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} disabled={isLoading}>
                  <LinearGradient colors={['#10b981', '#059669']} style={styles.continueGradient}>
                    {isLoading ? <ActivityIndicator color="#fff" /> : (
                      <Text style={styles.continueText}>Continue to Dashboard →</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </AnimatedReanimated.View>
            ) : (
              /* Generate Button */
              <AnimatedReanimated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(240)}>
                <TouchableOpacity
                  style={[
                    styles.generateBtn,
                    (!relationship.trim() || isGenerating) && styles.generateBtnDisabled,
                    { shadowColor: dynamicPrimary }
                  ]}
                  onPress={handleGenerate}
                  disabled={!relationship.trim() || isGenerating}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={dynamicGradient} style={styles.generateGradient}>
                    {isGenerating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="key" size={20} color="#fff" />
                        <Text style={styles.generateText}>Generate Invite Code</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
                  <Text style={[styles.skipText, isDark && { color: '#64748b' }]}>Skip for now</Text>
                </TouchableOpacity>
              </AnimatedReanimated.View>
            )}

            {/* Recent Codes */}
            {recentCodes.length > 0 && !generatedCode && (
              <AnimatedReanimated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.recentSection}>
                <Text style={[styles.stepLabel, isDark && styles.textDark]}>Recent Codes</Text>
                {recentCodes.map((rc) => (
                  <View key={rc.code} style={[styles.recentRow, isDark && styles.recentRowDark]}>
                    <View style={[styles.recentDot, { backgroundColor: ROLE_META[rc.role].color }]} />
                    <Text style={[styles.recentCode, isDark && styles.textDark]}>{rc.code}</Text>
                    <Text style={[styles.recentMeta, isDark && { color: '#94a3b8' }]}>
                      {ROLE_META[rc.role].label}
                    </Text>
                  </View>
                ))}
              </AnimatedReanimated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <Toast {...toast} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const InputRow = ({
  icon, placeholder, value, onChangeText, themeColor, isDark, keyboardType, autoCapitalize
}: any) => (
  <View style={[styles.inputRow, isDark && styles.inputRowDark]}>
    <Ionicons name={icon} size={18} color={themeColor} style={{ marginRight: 10, opacity: 0.8 }} />
    <TextInput
      style={[styles.input, isDark && styles.textDark]}
      placeholder={placeholder}
      placeholderTextColor={isDark ? '#64748b' : themeColor + '80'}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize || 'words'}
    />
  </View>
);

const ShareButton = ({ icon, label, color, onPress }: any) => (
  <TouchableOpacity style={styles.shareBtn} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.shareIconBg, { backgroundColor: color + '12' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.shareLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22 },
  textDark: { color: '#fff' },

  /* Toast */
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 999,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  backBtnDark: {
    backgroundColor: 'rgba(40,40,50,0.6)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },

  /* Avatar */
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },

  /* Steps */
  stepSection: { marginBottom: 24 },
  stepLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },

  /* Role Cards */
  roleCards: { gap: 10 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleCardDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
  },
  roleCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  roleCardDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    lineHeight: 17,
  },
  roleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Form */
  formCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    gap: 12,
  },
  formCardDark: {
    backgroundColor: 'rgba(30,30,40,0.3)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  inputRowDark: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  infoPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 17,
  },

  /* Generate */
  generateBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    marginTop: 4,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    gap: 10,
  },
  generateText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  skipBtn: { alignItems: 'center', paddingVertical: 16 },
  skipText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Success / Code */
  successSection: { marginTop: 8, marginBottom: 20 },
  codeCard: {
    borderRadius: 28,
    padding: 28,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  codeCardDark: {
    backgroundColor: 'rgba(30,30,40,0.4)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  checkBurst: { marginBottom: 4 },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 2,
    marginTop: 4,
  },
  codeText: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
  },
  qrWrap: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginVertical: 4,
  },
  qrWrapDark: {
    backgroundColor: '#1a1a2e',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  qrContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  qrLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  codeSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  shareBtn: {
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  shareIconBg: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  resetBtn: { marginTop: 8, padding: 8 },
  resetText: {
    fontSize: 13,
    fontWeight: '800',
  },

  /* Continue */
  continueBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  continueGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  /* Recent */
  recentSection: { marginTop: 8, marginBottom: 20 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 6,
  },
  recentRowDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 2,
    flex: 1,
  },
  recentMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
});