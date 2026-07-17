import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Clipboard,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFamily } from '../../context/FamilyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useSweetAlert } from '../../components/SweetAlert';
import { useBaby } from '../../context/BabyContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type InviteCodeScreenProps = NativeStackScreenProps<RootStackParamList, 'InviteCode'>;

const { width } = Dimensions.get('window');

type RoleOption = {
  id: 'parent2' | 'guardian' | 'viewer';
  label: string;
  icon: string;
  description: string;
  color: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'parent2',
    label: 'Parent 2',
    icon: 'heart',
    description: 'Mother, Father, or Co-Parent with full access',
    color: '#ec4899',
  },
  {
    id: 'guardian',
    label: 'Guardian',
    icon: 'shield-checkmark',
    description: 'Grandparent, nanny, or trusted caregiver',
    color: '#667eea',
  },
  {
    id: 'viewer',
    label: 'Viewer',
    icon: 'eye',
    description: 'View-only access for extended family',
    color: '#94a3b8',
  },
];

export default function InviteCodeScreen({ navigation }: InviteCodeScreenProps) {
  const [selectedRole, setSelectedRole] = useState<RoleOption['id']>('parent2');
  const [relationship, setRelationship] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCodes, setActiveCodes] = useState<import('@/database/dbHelpers').InviteCode[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);

  const { generateInviteCode, getActiveInviteCodes, revokeInviteCode } = useFamily();
  const { currentBaby } = useBaby();
  const { darkMode: isDark, triggerHaptic } = useCustomization();
  const { success: showSuccess, error: showError, info: showInfo } = useSweetAlert();
  const insets = useSafeAreaInsets();

  const codeScale = useSharedValue(0.5);
  const codeOpacity = useSharedValue(0);

  const codeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: codeScale.value }],
    opacity: codeOpacity.value,
  }));

  useEffect(() => {
    loadActiveCodes();
  }, []);

  const loadActiveCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const codes = await getActiveInviteCodes();
      if (codes) setActiveCodes(codes);
    } catch (error) {
      console.error('Error loading codes:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const handleGenerateCode = useCallback(async () => {
    if (!currentBaby) {
      showError('No Baby Selected', 'Please create a baby profile first');
      return;
    }

    setIsGenerating(true);
    triggerHaptic('medium');

    try {
      const result = await generateInviteCode(selectedRole, relationship || undefined);

      if (result.success && result.code) {
        setGeneratedCode(result.code);
        codeScale.value = withSpring(1, { damping: 12, stiffness: 100 });
        codeOpacity.value = withSpring(1, { damping: 12, stiffness: 100 });
        showSuccess('Code Generated!', `Share this code with your ${selectedRole === 'parent2' ? 'co-parent' : 'family member'}`);
        await loadActiveCodes();
      } else {
        showError('Failed', result.message || 'Could not generate code');
      }
    } catch (error) {
      showError('Error', 'Failed to generate invite code');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedRole, relationship, currentBaby, generateInviteCode, triggerHaptic, showSuccess, showError, codeScale, codeOpacity]);

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    await Clipboard.setString(generatedCode);
    triggerHaptic('light');
    showInfo('Copied!', 'Invite code copied to clipboard');
  };

  const handleShareCode = async () => {
    if (!generatedCode || !currentBaby) return;

    const roleLabel = ROLE_OPTIONS.find(r => r.id === selectedRole)?.label || 'Family Member';
    const message = `👶 Join me on LittleLoom!\n\n` +
      `Baby: ${currentBaby.name}\n` +
      `Your role: ${roleLabel}\n\n` +
      `Enter this invite code in the app:\n` +
      `🎫 ${generatedCode}\n\n` +
      `Download LittleLoom and tap "Join Family" to get started!`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleRevokeCode = async (code: string) => {
    const success = await revokeInviteCode(code);
    if (success) {
      showSuccess('Revoked', 'Invite code has been deactivated');
      await loadActiveCodes();
      if (generatedCode === code) {
        setGeneratedCode('');
        codeScale.value = 0.5;
        codeOpacity.value = 0;
      }
    } else {
      showError('Failed', 'Could not revoke invite code');
    }
  };

  const formatExpiry = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days`;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'parent2': return 'heart';
      case 'guardian': return 'shield-checkmark';
      case 'viewer': return 'eye';
      default: return 'person';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'parent2': return '#ec4899';
      case 'guardian': return '#667eea';
      case 'viewer': return '#94a3b8';
      default: return '#667eea';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#f8faff' }]}>
      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e293b'] : ['#667eea', '#764ba2']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: isDark ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="people" size={28} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>Invite Family</Text>
          <Text style={styles.headerSubtitle}>
            Generate a code to invite someone to your family
          </Text>
        </Animated.View>

        {/* Role Selection */}
        <Animated.View entering={FadeInUp.delay(200)}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
            Select Role
          </Text>
          <View style={styles.roleGrid}>
            {ROLE_OPTIONS.map((role, index) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                    borderColor: selectedRole === role.id ? role.color : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderWidth: selectedRole === role.id ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  setSelectedRole(role.id);
                  triggerHaptic('light');
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconCircle, { backgroundColor: `${role.color}20` }]}>
                  <Ionicons name={role.icon as any} size={22} color={role.color} />
                </View>
                <Text style={[styles.roleLabel, { color: isDark ? '#fff' : '#1e293b' }]}>
                  {role.label}
                </Text>
                <Text style={[styles.roleDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {role.description}
                </Text>
                {selectedRole === role.id && (
                  <View style={[styles.checkBadge, { backgroundColor: role.color }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Generate Button */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.generateSection}>
          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
            onPress={handleGenerateCode}
            disabled={isGenerating || !currentBaby}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.generateGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isGenerating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.generateText}>Generate Invite Code</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {!currentBaby && (
            <Text style={[styles.warningText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
              ⚠️ Create a baby profile first to generate invite codes
            </Text>
          )}
        </Animated.View>

        {/* Generated Code Display */}
        {generatedCode ? (
          <Animated.View style={[styles.codeCard, codeStyle]}>
            <BlurView intensity={isDark ? 40 : 80} style={styles.codeBlur} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={isDark ? ['rgba(30,41,59,0.95)', 'rgba(51,65,85,0.9)'] : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />

              <Text style={[styles.codeLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Your Invite Code
              </Text>

              <View style={styles.codeDisplay}>
                <Text style={styles.codeText}>{generatedCode}</Text>
              </View>

              <Text style={[styles.codeExpiry, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                Valid for 7 days • One-time use
              </Text>

              <View style={styles.codeActions}>
                <TouchableOpacity style={styles.codeAction} onPress={handleCopyCode}>
                  <View style={[styles.actionIcon, { backgroundColor: 'rgba(102,126,234,0.1)' }]}>
                    <Ionicons name="copy-outline" size={20} color="#667eea" />
                  </View>
                  <Text style={[styles.actionText, { color: isDark ? '#fff' : '#1e293b' }]}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.codeAction} onPress={handleShareCode}>
                  <View style={[styles.actionIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                    <Ionicons name="share-outline" size={20} color="#22c55e" />
                  </View>
                  <Text style={[styles.actionText, { color: isDark ? '#fff' : '#1e293b' }]}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.codeAction} onPress={() => handleRevokeCode(generatedCode)}>
                  <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </View>
                  <Text style={[styles.actionText, { color: isDark ? '#fff' : '#1e293b' }]}>Revoke</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>
        ) : null}

        {/* Active Codes List */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.codesListSection}>
          <View style={styles.codesListHeader}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
              Active Codes
            </Text>
            <TouchableOpacity onPress={loadActiveCodes} disabled={isLoadingCodes}>
              <Ionicons name="refresh" size={18} color="#667eea" />
            </TouchableOpacity>
          </View>

          {isLoadingCodes ? (
            <ActivityIndicator color="#667eea" style={{ marginTop: 20 }} />
          ) : activeCodes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="ticket-outline" size={40} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(102,126,234,0.2)'} />
              <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                No active invite codes
              </Text>
            </View>
          ) : (
            activeCodes.map((code, index) => (
              <Animated.View
                key={code.code}
                entering={FadeInUp.delay(100 * index)}
                style={[
                  styles.codeListItem,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <View style={styles.codeListLeft}>
                  <View style={[styles.codeListIcon, { backgroundColor: `${getRoleColor(code.role)}20` }]}>
                    <Ionicons name={getRoleIcon(code.role) as any} size={16} color={getRoleColor(code.role)} />
                  </View>
                  <View>
                    <Text style={[styles.codeListCode, { color: isDark ? '#fff' : '#1e293b' }]}>
                      {code.code}
                    </Text>
                    <Text style={[styles.codeListMeta, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {code.role === 'parent2' ? 'Parent 2' : code.role === 'guardian' ? 'Guardian' : 'Viewer'}
                      {' • '}
                      {formatExpiry(code.expiresAt)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.revokeButton}
                  onPress={() => handleRevokeCode(code.code)}
                >
                  <Ionicons name="close-circle" size={22} color="#ef4444" />
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 10,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  roleGrid: {
    gap: 10,
    marginBottom: 24,
  },
  roleCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    position: 'relative',
  },
  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateSection: {
    marginBottom: 24,
  },
  generateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  generateText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  warningText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  codeCard: {
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  codeBlur: {
    padding: 24,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeDisplay: {
    backgroundColor: 'rgba(102,126,234,0.08)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(102,126,234,0.2)',
    borderStyle: 'dashed',
  },
  codeText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#667eea',
    letterSpacing: 6,
  },
  codeExpiry: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 20,
  },
  codeAction: {
    alignItems: 'center',
    gap: 6,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  codesListSection: {
    marginBottom: 20,
  },
  codesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  codeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  codeListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeListIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeListCode: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  codeListMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  revokeButton: {
    padding: 4,
  },
});