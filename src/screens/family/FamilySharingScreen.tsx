import { StyleSheet, ActivityIndicator ,Alert, Button, Dimensions ,Image ,Linking, Modal, Platform, RefreshControl, ScrollView, Settings ,Share, Switch ,TextInput ,TouchableOpacity ,View } from 'react-native';;
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BlurView } from 'expo-blur';
import { EmptyState } from '../../components/EmptyState';
import { AutoHideScrollView } from '../../components/AutoHideScrollWrappers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withSpring, useAnimatedScrollHandler, interpolate, Extrapolation, Layout } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { showAlert } from '@/utils/alert';

type FamilySharingScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilySharing'>;

const AnimatedScrollView = Animated.ScrollView;
const { width, height } = Dimensions.get('window');

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

const ROLE_CONFIG: Record<UserRole, {
  label: string;
  color: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  permissions: string[];
  canEdit: boolean;
  canRemove: boolean;
  canPromote: boolean;
  badge: string;
  priority: number;
  maxCount: number;
}> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    icon: 'shield',
    description: 'Full owner access to everything',
    permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data', 'Billing', 'Delete Account'],
    canEdit: true,
    canRemove: false,
    canPromote: false,
    badge: 'Owner',
    priority: 1,
    maxCount: 1,
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    icon: 'heart',
    description: 'Full access to manage family and baby data',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data', 'View Analytics'],
    canEdit: true,
    canRemove: true,
    canPromote: false,
    badge: 'Co-Parent',
    priority: 2,
    maxCount: 1,
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    icon: 'shield-checkmark',
    description: 'Can add entries but cannot delete or manage family',
    permissions: ['Read', 'Write', 'Limited Delete', 'View Timeline', 'Add Photos'],
    canEdit: true,
    canRemove: true,
    canPromote: true,
    badge: 'Guardian',
    priority: 3,
    maxCount: 5,
  },
  [UserRole.VIEWER]: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    description: 'View only access, cannot add or modify data',
    permissions: ['Read Only', 'View Timeline', 'View Photos'],
    canEdit: true,
    canRemove: true,
    canPromote: true,
    badge: 'Viewer',
    priority: 4,
    maxCount: 10,
  },
};

const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding' },
  sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep' },
  growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth' },
  medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication' },
  milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone' },
  diaper: { icon: 'layers-outline', color: '#3b82f6', label: 'Diaper' },
  note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note' },
  login: { icon: 'log-in-outline', color: '#10b981', label: 'Login' },
  permission_change: { icon: 'key-outline', color: '#f59e0b', label: 'Permission' },
  invite_sent: { icon: 'paper-plane-outline', color: '#667eea', label: 'Invite Sent' },
  member_removed: { icon: 'person-remove-outline', color: '#ef4444', label: 'Member Removed' },
  profile_update: { icon: 'create-outline', color: '#8b5cf6', label: 'Profile Updated' },
  chat: { icon: 'chatbubble-outline', color: '#ec4899', label: 'Chat' },
  baby_added: { icon: 'add-circle-outline', color: '#10b981', label: 'Baby Added' },
  default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity' },
};

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  showCloseButton?: boolean;
  primaryColor?: string;
}

const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  onClose,
  title,
  children,
  isDark,
  showCloseButton = true,
  primaryColor = '#667eea'
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <Animated.View
          entering={FadeInUp}
          style={[styles.modalContent, isDark && styles.modalContentDark]}
        >
          <LinearGradient
            colors={isDark ? ['rgba(30,30,35,0.95)', 'rgba(20,20,25,0.98)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>{title}</Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
            )}
          </View>
          <AutoHideScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            {children}
          </AutoHideScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

interface ActivityLogItemProps {
  activity: {
    id: string;
    type: string;
    title: string;
    details?: string;
    timestamp: number;
    loggedByName?: string;
    babyName?: string;
  };
  isDark: boolean;
  index: number;
  shouldReduceMotion: boolean;
}

const ActivityLogItem: React.FC<ActivityLogItemProps> = ({ activity, isDark, index, shouldReduceMotion }) => {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;

  return (
    <Animated.View
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 50)}
      style={[styles.activityLogItem, isDark && styles.activityLogItemDark]}
    >
      <View style={[styles.activityLogIcon, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon} size={18} color={config.color} />
      </View>
      <View style={styles.activityLogContent}>
        <Text style={[styles.activityLogTitle, isDark && styles.textDark]} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={[styles.activityLogMeta, isDark && styles.textMuted]}>
          {activity.loggedByName && `${activity.loggedByName}`}
          {activity.babyName && ` • ${activity.babyName}`}
          {' • '}{new Date(activity.timestamp).toLocaleDateString()}
        </Text>
      </View>
    </Animated.View>
  );
};

const SafeAvatar: React.FC<{
  avatar?: string | null;
  size?: number;
  fallbackEmoji?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackColor?: string;
}> = ({ avatar, size = 56, fallbackEmoji = '👤', fallbackIcon = 'person', fallbackColor = '#667eea' }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={[fallbackColor + '20', fallbackColor + '40']}
        style={[styles.avatarGradient, { width: size, height: size, borderRadius: size / 2.8 }]}
      >
        {hasImage ? (
          <View style={{ width: size, height: size, borderRadius: size / 2.8, overflow: 'hidden' }}>
            <Image
              source={{ uri: avatar! }}
              style={{ width: size, height: size }}
              resizeMode="cover"
              onError={(e) => console.log('Avatar image error:', e.nativeEvent.error)}
            />
          </View>
        ) : hasEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{avatar}</Text>
        ) : (
          <Ionicons name={fallbackIcon} size={size * 0.4} color={fallbackColor} />
        )}
      </LinearGradient>
    </View>
  );
};

interface MemberCardProps {
  member: FamilyMember;
  isCurrentUser: boolean;
  isPrimaryParent: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  index: number;
  isDark: boolean;
  showFamilyChat: boolean;
  onFamilyChatPress?: () => void;
  themeColors: any;
  shouldReduceMotion: boolean;
}

const MemberCard: React.FC<MemberCardProps> = ({
  member,
  isCurrentUser,
  isPrimaryParent,
  onPress,
  onLongPress,
  index,
  isDark,
  showFamilyChat,
  onFamilyChatPress,
  themeColors,
  shouldReduceMotion
}) => {
  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 100)}
      layout={shouldReduceMotion ? undefined : Layout.springify()}
      style={styles.memberCardWrapper}
    >
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={500}
          activeOpacity={0.9}
          style={styles.memberCardTouchable}
        >
          <BlurView intensity={60} style={[styles.memberCard, isDark && styles.memberCardDark]} tint={isDark ? 'dark' : 'light'}>
            <LinearGradient
              colors={isDark ? ['rgba(40,40,45,0.6)', 'rgba(25,25,30,0.4)'] : ['rgba(255,255,255,0.8)', 'rgba(250,250,255,0.6)']}
              style={StyleSheet.absoluteFill}
            />

            <LinearGradient
              colors={roleConfig.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.roleStrip}
            />

            <View style={styles.memberCardContent}>
              <View style={styles.memberAvatarContainer}>
                <SafeAvatar
                  avatar={member.avatar}
                  size={56}
                  fallbackEmoji={isCurrentUser ? '👑' : (member.role === UserRole.PARENT_2 ? '👨‍👩‍👧‍👦' : '👤')}
                  fallbackIcon={member.role === UserRole.PARENT_1 ? 'shield' : member.role === UserRole.PARENT_2 ? 'heart' : 'person'}
                  fallbackColor={roleConfig.color}
                />
                {isCurrentUser && (
                  <View style={[styles.youBadge, { backgroundColor: themeColors.primary }]}>
                    <Text style={styles.youBadgeText}>YOU</Text>
                  </View>
                )}
                {member.notificationsEnabled === false && (
                  <View style={styles.mutedBadge}>
                    <Ionicons name="notifications-off" size={10} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={[styles.memberName, isDark && styles.textDark]} numberOfLines={1}>
                    {member.fullName}
                  </Text>
                  {member.lastActive && new Date(member.lastActive).getTime() > Date.now() - 5 * 60 * 1000 && (
                    <View style={styles.onlineIndicator} />
                  )}
                </View>

                <View style={styles.memberMetaRow}>
                  <LinearGradient
                    colors={roleConfig.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.roleBadgeSmall}
                  >
                    <Ionicons name={roleConfig.icon} size={10} color="#fff" />
                    <Text style={styles.roleBadgeSmallText}>{roleConfig.badge}</Text>
                  </LinearGradient>

                  <Text style={[styles.memberRelationship, isDark && styles.textMuted]}>
                    {member.relationship || 'Family Member'}
                  </Text>
                </View>

                {member.lastActive ? (
                  <Text style={[styles.memberLastActive, isDark && styles.textMuted]}>
                    Active {new Date(member.lastActive).toLocaleDateString()}
                  </Text>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Ionicons name="time-outline" size={12} color="#f59e0b" />
                    <Text style={styles.pendingText}>Pending Invitation</Text>
                  </View>
                )}
              </View>

              <View style={styles.memberActions}>
                {showFamilyChat && onFamilyChatPress && (
                  <TouchableOpacity
                    style={[styles.memberActionBtn, styles.familyChatBtn, { backgroundColor: '#ec489920' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      onFamilyChatPress();
                    }}
                  >
                    <Ionicons name="chatbubbles" size={18} color="#ec4899" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.memberActionBtn, { backgroundColor: roleConfig.color + '15' }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onPress();
                  }}
                >
                  <Ionicons name="chevron-forward" size={20} color={roleConfig.color} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.permissionPills}>
              {roleConfig.permissions.slice(0, 3).map((perm, i) => (
                <View key={i} style={[styles.permissionPill, { backgroundColor: roleConfig.color + '10' }]}>
                  <Text style={[styles.permissionPillText, { color: roleConfig.color }]}>{perm}</Text>
                </View>
              ))}
              {roleConfig.permissions.length > 3 && (
                <View style={[styles.permissionPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.permissionPillText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                    +{roleConfig.permissions.length - 3}
                  </Text>
                </View>
              )}
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  isDark: boolean;
  index: number;
  shouldReduceMotion: boolean;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, onPress, isDark, index, shouldReduceMotion }) => {
  return (
    <Animated.View
      entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 75)}
      layout={shouldReduceMotion ? undefined : Layout.springify()}
      style={styles.quickActionWrapper}
    >
      <TouchableOpacity
        style={[styles.quickAction, isDark && styles.quickActionDark]}
        onPress={onPress}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={[styles.quickActionLabel, isDark && styles.textMuted]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function FamilySharingScreen({ navigation }: FamilySharingScreenProps) {
  const sweetAlert = useSweetAlert();
  const {
    members,
    guardians,
    parent1,
    parent2,
    pendingInvites,
    loadFamily,
    inviteMember,
    removeMember,
    updateGuardianProfile,
    updateParent2Profile,
    resendInvite,
    cancelInvite,
    getEffectivePermissions
  } = useFamily();

  const { profile, hasPermission } = useUser();
  const { currentBaby, babies, switchBaby } = useBaby();
  const { userProfile } = useAuth();

  const insets = useSafeAreaInsets();

  const {
    darkMode: isDark,
    themeColors,
    triggerHaptic,
    shouldReduceMotion,
  } = useCustomization();

  const scrollY = useSharedValue(0);
  const headerBlurIntensity = useSharedValue(0);
  const headerOpacity = useSharedValue(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showFamilyStats, setShowFamilyStats] = useState(false);
  const [showFamilySettings, setShowFamilySettings] = useState(false);
  const [showBabySelector, setShowBabySelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'activity' | 'analytics'>('members');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.GUARDIAN);
  const [inviteRelationship, setInviteRelationship] = useState('');

  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    relationship: '',
    avatar: '',
    notificationsEnabled: true,
    customPermissions: [] as string[],
  });

  const [memberStats, setMemberStats] = useState<Record<string, any>>({});
  const [recentFamilyActivity, setRecentFamilyActivity] = useState<any[]>([]);

  const currentUserId = useMemo(() => {
    return userProfile?.id || userProfile?.uid || profile?.id || '';
  }, [userProfile, profile]);

  const isPrimaryParent = useMemo(() => {
    if (!currentUserId) return false;
    return parent1?.id === currentUserId || members.some(m =>
      m.role === UserRole.PARENT_1 && (m.id === currentUserId || m.userId === currentUserId)
    );
  }, [parent1, members, currentUserId]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  useEffect(() => {
    if (!currentBaby) return;

    const stats: Record<string, any> = {};

    members.forEach(member => {
      stats[member.id] = {
        totalActivities: 0,
        last7Days: 0,
        lastActive: member.lastActive,
        loginStreak: 0,
        mostActiveType: null,
        recentActivities: [],
      };
    });

    setMemberStats(stats);
  }, [members, currentBaby]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      headerBlurIntensity.value = interpolate(
        scrollY.value,
        [0, 100, 200],
        [0, 60, 100],
        Extrapolation.CLAMP
      );
      headerOpacity.value = interpolate(
        scrollY.value,
        [0, 50, 150],
        [0, 0.8, 1],
        Extrapolation.CLAMP
      );
    },
  });

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFamily();
    setIsRefreshing(false);
  }, [loadFamily]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      sweetAlert.alert('Error', 'Please enter an email address', 'warning');
      return;
    }

    if (!inviteRelationship.trim()) {
      sweetAlert.alert('Error', 'Please specify the relationship', 'warning');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    const success = await inviteMember(inviteEmail, inviteRole, inviteRelationship);

    if (success) {
      triggerHaptic('success');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRelationship('');
      sweetAlert.alert('Success', 'Invitation sent to ${inviteEmail}', 'warning');
    } else {
      triggerHaptic('error');
    }

    setIsLoading(false);
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;

    if (!editForm.fullName.trim()) {
      sweetAlert.alert('Error', 'Name is required', 'warning');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    let success = false;

    if (selectedMember.role === UserRole.PARENT_2) {
      success = await updateParent2Profile({
        fullName: editForm.fullName,
        email: editForm.email,
        phoneNumber: editForm.phoneNumber,
        avatar: editForm.avatar,
      });
    } else {
      success = await updateGuardianProfile(selectedMember.id, {
        fullName: editForm.fullName,
        email: editForm.email,
        phoneNumber: editForm.phoneNumber,
        relationship: editForm.relationship,
        avatar: editForm.avatar,
        notificationsEnabled: editForm.notificationsEnabled,
      });
    }

    if (success) {
      triggerHaptic('success');
      setShowEditModal(false);
      sweetAlert.alert('Success', 'Member updated successfully', 'warning');
      loadFamily();
    } else {
      triggerHaptic('error');
      sweetAlert.alert('Error', 'Failed to update member', 'warning');
    }

    setIsLoading(false);
  };

  const handleRemoveMember = () => {
    if (!selectedMember) return;

    if (selectedMember.role === UserRole.PARENT_1) {
      sweetAlert.alert('Cannot Remove', 'Primary Parent cannot be removed', 'warning');
      return;
    }

    if (selectedMember.id === currentUserId) {
      sweetAlert.alert('Cannot Remove', 'You cannot remove yourself', 'warning');
      return;
    }

showAlert(
      'Remove Family Member',
      `Are you sure you want to remove ${selectedMember.fullName}?\n\nThis will revoke their access to all family data. Their activity history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('error');
            const success = await removeMember(selectedMember.id);
            if (success) {
              triggerHaptic('success');
              setShowMemberModal(false);
              setSelectedMember(null);
              loadFamily();
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = async (newRole: UserRole) => {
    if (!selectedMember || !isPrimaryParent) return;

    if (selectedMember.role === UserRole.PARENT_1) {
      sweetAlert.alert('Cannot Change', 'Primary Parent role cannot be changed', 'warning');
      return;
    }

    const currentCount = members.filter(m => m.role === newRole).length;
    const maxAllowed = ROLE_CONFIG[newRole].maxCount;

    if (currentCount >= maxAllowed && newRole !== selectedMember.role) {
      sweetAlert.alert('Role Limit Reached', 'You can only have ${maxAllowed} ${ROLE_CONFIG[newRole].label}(s)', 'warning');
      return;
    }

showAlert(
      'Change Role',
      `Change ${selectedMember.fullName} to ${ROLE_CONFIG[newRole].label}?\n\nThis will update their permissions immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            triggerHaptic('medium');

            const success = await updateGuardianProfile(selectedMember.id, {
              role: newRole,
              permissions: ROLE_PERMISSIONS[newRole],
            });

            if (success) {
              triggerHaptic('success');
              setShowRoleModal(false);
              loadFamily();
            }
          },
        },
      ]
    );
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setEditForm(prev => ({ ...prev, avatar: result.assets[0].uri }));
      triggerHaptic('light');
    }
  };

  const handleContact = async (type: 'call' | 'email' | 'sms') => {
    if (!selectedMember) return;

    let url = '';
    switch (type) {
      case 'call':
        if (!selectedMember.phoneNumber) {
          sweetAlert.alert('No Phone', 'No phone number available', 'warning');
          return;
        }
        url = `tel:${selectedMember.phoneNumber.replace(/\s/g, '')}`;
        break;
      case 'email':
        if (!selectedMember.email) {
          sweetAlert.alert('No Email', 'No email address available', 'warning');
          return;
        }
        url = `mailto:${selectedMember.email}`;
        break;
      case 'sms':
        if (!selectedMember.phoneNumber) {
          sweetAlert.alert('No Phone', 'No phone number available', 'warning');
          return;
        }
        url = `sms:${selectedMember.phoneNumber.replace(/\s/g, '')}`;
        break;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      triggerHaptic('medium');
      await Linking.openURL(url);
    }
  };

  const handleShareContact = async () => {
    if (!selectedMember) return;
    try {
      await Share.share({
        message: `${selectedMember.fullName} - ${ROLE_LABELS[selectedMember.role]}\n${selectedMember.email || ''}\n${selectedMember.phoneNumber || ''}`,
        title: `${selectedMember.fullName}'s Contact Info`,
      });
    } catch (error) {
      console.error('Error sharing contact:', error);
    }
  };

  const openMemberDetails = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditForm({
      fullName: member.fullName || '',
      email: member.email || '',
      phoneNumber: member.phoneNumber || '',
      relationship: member.relationship || '',
      avatar: member.avatar || '',
      notificationsEnabled: member.notificationsEnabled ?? true,
      customPermissions: member.permissions ? Object.keys(member.permissions).filter(k => member.permissions[k as keyof Permission]) : [],
    });
    setShowMemberModal(true);
    triggerHaptic('light');
  };

  const openEditModal = () => {
    setShowMemberModal(false);
    setShowEditModal(true);
  };

  const getRoleDistribution = () => {
    const distribution: Record<string, number> = {};
    members.forEach(m => {
      const role = ROLE_LABELS[m.role] || m.role;
      distribution[role] = (distribution[role] || 0) + 1;
    });
    return Object.entries(distribution).map(([role, count]) => ({ role, count }));
  };

  const handleFamilyChatPress = (member: FamilyMember) => {
    if (!currentBaby) return;
    navigation.navigate('FamilyChat', {
      memberId: member.id,
      memberName: member.fullName,
      memberAvatar: member.avatar,
      memberRole: member.role,
      babyId: currentBaby.id,
      babyName: currentBaby.name,
    });
  };

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isDark
      ? `rgba(10,10,10,${headerOpacity.value})`
      : `rgba(248,250,252,${headerOpacity.value})`,
  }));

  const blurAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP),
  }));

  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { paddingTop: insets.top }, headerAnimatedStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, blurAnimatedStyle, { zIndex: -1 }]}>
        <BlurView
          intensity={60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, isDark && styles.headerBtnDark]}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>
            Family Dashboard
          </Text>
          {currentBaby && (
            <TouchableOpacity
              style={[styles.babySelector, { backgroundColor: themeColors.colors[0] }]}
              onPress={() => setShowBabySelector(true)}
            >
              <Text style={[styles.babySelectorText, { color: themeColors.primary }]}>
                {currentBaby.name} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnAccent, { backgroundColor: themeColors.primary }]}
            onPress={() => setShowInviteModal(true)}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions - Clean Icons Only */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.iconAction}
          onPress={() => navigation.navigate('FamilyChatList')}
        >
          <Ionicons name="chatbubbles" size={24} color="#ec4899" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconAction}
          onPress={() => setShowActivityLog(true)}
        >
          <Ionicons name="time" size={24} color="#10b981" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Activity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconAction}
          onPress={() => setShowFamilyStats(true)}
        >
          <Ionicons name="stats-chart" size={24} color={themeColors.primary} />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconAction}
          onPress={() => setShowFamilySettings(true)}
        >
          <Ionicons name="notifications" size={24} color="#f59e0b" />
          <Text style={[styles.iconActionLabel, isDark && styles.textMuted]}>Alerts</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, isDark && styles.tabContainerDark]}>
        {(['members', 'activity', 'analytics'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.tabActive,
              activeTab === tab && { borderBottomColor: themeColors.primary, backgroundColor: themeColors.colors[0] }
            ]}
            onPress={() => {
              setActiveTab(tab);
              triggerHaptic('light');
            }}
          >
            <Text style={[
              styles.tabText,
              isDark && styles.textMuted,
              activeTab === tab && [styles.tabTextActive, { color: themeColors.primary }]
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'members':
        return (
          <View style={styles.tabContent}>
            {/* Family Stats Summary */}
            <View style={styles.familyStatsContainer}>
              <LinearGradient
                colors={[themeColors.colors[0], themeColors.colors[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.familyStatsGradient}
              >
                <View style={styles.familyStatsRow}>
                  <View style={styles.familyStat}>
                    <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{members.length}</Text>
                    <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Members</Text>
                  </View>
                  <View style={styles.familyStatDivider} />
                  <View style={styles.familyStat}>
                    <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{pendingInvites.length}</Text>
                    <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Pending</Text>
                  </View>
                  <View style={styles.familyStatDivider} />
                  <View style={styles.familyStat}>
                    <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>
                      {members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 24 * 60 * 60 * 1000).length}
                    </Text>
                    <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Active Today</Text>
                  </View>
                  <View style={styles.familyStatDivider} />
                  <View style={styles.familyStat}>
                    <Text style={[styles.familyStatValue, { color: themeColors.primary }]}>{recentFamilyActivity.length}</Text>
                    <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Recent Logs</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Member Sections */}
            {renderMemberSection('Primary Parent', members.filter(m => m.role === UserRole.PARENT_1))}
            {renderMemberSection('Co-Parent', members.filter(m => m.role === UserRole.PARENT_2), 'No co-parent added yet')}
            {renderMemberSection('Guardians', members.filter(m => m.role === UserRole.GUARDIAN), 'No guardians added')}
            {renderMemberSection('Viewers', members.filter(m => m.role === UserRole.VIEWER), 'No viewers added')}

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Pending Invites</Text>
                  <Text style={[styles.sectionCount, isDark && styles.textMuted]}>{pendingInvites.length}</Text>
                </View>

                {pendingInvites.map((invite, index) => (
                  <Animated.View
                    key={invite.id}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 100)}
                    layout={shouldReduceMotion ? undefined : Layout.springify()}
                    style={[styles.pendingCard, isDark && styles.pendingCardDark]}
                  >
                    <View style={styles.pendingIcon}>
                      <Ionicons name="mail-outline" size={24} color="#f59e0b" />
                    </View>
                    <View style={styles.pendingInfo}>
                      <Text style={[styles.pendingEmail, isDark && styles.textDark]}>{invite.email}</Text>
                      <Text style={[styles.pendingRole, isDark && styles.textMuted]}>
                        {ROLE_LABELS[invite.role]} • {invite.relationship}
                      </Text>
                      <Text style={[styles.pendingSent, isDark && styles.textMuted]}>
                        Sent {new Date(invite.addedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.pendingActions}>
                      <TouchableOpacity
                        style={styles.pendingAction}
                        onPress={() => resendInvite(invite.id)}
                      >
                        <Ionicons name="refresh" size={20} color={themeColors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pendingAction}
                        onPress={() => cancelInvite(invite.id)}
                      >
                        <Ionicons name="close" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Role Limits */}
            <View style={styles.roleLimitsSection}>
              <Text style={[styles.roleLimitsTitle, isDark && styles.textMuted]}>Role Limits</Text>
              <View style={styles.roleLimitsGrid}>
                {Object.entries(ROLE_CONFIG).map(([role, config]) => {
                  const currentCount = members.filter(m => m.role === role).length;
                  const isAtLimit = currentCount >= config.maxCount;

                  return (
                    <View
                      key={role}
                      style={[
                        styles.roleLimitItem,
                        isDark && styles.roleLimitItemDark,
                        isAtLimit && styles.roleLimitItemFull
                      ]}
                    >
                      <Text style={[
                        styles.roleLimitValue,
                        { color: isAtLimit ? '#ef4444' : config.color }
                      ]}>
                        {currentCount}/{config.maxCount}
                      </Text>
                      <Text style={[styles.roleLimitLabel, isDark && styles.textMuted]}>{config.badge}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        );

      case 'activity':
        return (
          <View style={styles.tabContent}>
            <View style={[styles.recentActivityCard, isDark && styles.recentActivityCardDark]}>
              {recentFamilyActivity.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={48} color={isDark ? '#555' : '#ccc'} />
                  <Text style={[styles.emptyStateText, isDark && styles.textMuted]}>
                    No recent activity recorded
                  </Text>
                </View>
              ) : (
                recentFamilyActivity.map((activity, index) => (
                  <ActivityLogItem
                    key={activity.id}
                    activity={activity}
                    isDark={isDark}
                    index={index}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                ))
              )}
            </View>
          </View>
        );

      case 'analytics':
        return (
          <View style={styles.tabContent}>
            <View style={styles.analyticsSection}>
              <Text style={[styles.analyticsTitle, isDark && styles.textDark]}>Role Distribution</Text>
              <View style={styles.distributionGrid}>
                {getRoleDistribution().map(({ role, count }, index) => (
                  <Animated.View
                    key={role}
                    entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 100)}
                    layout={shouldReduceMotion ? undefined : Layout.springify()}
                    style={[styles.distributionItem, isDark && styles.distributionItemDark]}
                  >
                    <Text style={[styles.distributionValue, isDark && styles.textDark, { color: themeColors.primary }]}>{count}</Text>
                    <Text style={[styles.distributionLabel, isDark && styles.textMuted]}>{role}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>

            <View style={styles.analyticsSection}>
              <Text style={[styles.analyticsTitle, isDark && styles.textDark]}>Member Activity</Text>
              {members.map((member, index) => (
                <Animated.View
                  key={member.id}
                  entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 50)}
                  layout={shouldReduceMotion ? undefined : Layout.springify()}
                  style={[styles.analyticsMemberRow, isDark && styles.analyticsMemberRowDark]}
                >
                  <View style={styles.analyticsMemberInfo}>
                    <Text style={[styles.analyticsMemberName, isDark && styles.textDark]}>
                      {member.fullName}
                    </Text>
                    <Text style={[styles.analyticsMemberRole, isDark && styles.textMuted]}>
                      {ROLE_LABELS[member.role]}
                    </Text>
                  </View>
                  <View style={styles.analyticsMemberStats}>
                    <Text style={[styles.analyticsStat, { color: ROLE_CONFIG[member.role].color }]}>
                      {memberStats[member.id]?.totalActivities || 0} logs
                    </Text>
                    <Text style={[styles.analyticsStreak, isDark && styles.textMuted]}>
                      🔥 {memberStats[member.id]?.loginStreak || 0} day streak
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
        );
    }
  };

  const renderMemberSection = (title: string, data: FamilyMember[], emptyText?: string) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{title}</Text>
        <Text style={[styles.sectionCount, isDark && styles.textMuted]}>{data.length}</Text>
      </View>

      {data.length === 0 && emptyText ? (
        <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
          <Ionicons name="people-outline" size={32} color={isDark ? '#555' : '#ccc'} />
          <Text style={[styles.emptyStateText, isDark && styles.textMuted]}>{emptyText}</Text>
          {isPrimaryParent && title !== 'Primary Parent' && (
            <TouchableOpacity
              style={[styles.addFirstMemberBtn, { backgroundColor: themeColors.primary }]}
              onPress={() => setShowInviteModal(true)}
            >
              <Text style={styles.addFirstMemberText}>Add First Member</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        data.map((member, index) => (
          <MemberCard
            key={member.id}
            member={member}
            isCurrentUser={member.id === currentUserId || member.userId === currentUserId}
            isPrimaryParent={isPrimaryParent}
            onPress={() => openMemberDetails(member)}
            onLongPress={isPrimaryParent && member.role !== UserRole.PARENT_1 ? () => {
              setSelectedMember(member);

showAlert(
                'Quick Actions',
                `${member.fullName}`,
                [
                  { text: 'Edit', onPress: () => openMemberDetails(member) },
                  { text: 'Change Role', onPress: () => {
                    setSelectedMember(member);
                    setShowRoleModal(true);
                  }},
                  { text: 'Family Chat', onPress: () => handleFamilyChatPress(member) },
                  member.role !== UserRole.PARENT_1 && {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                      setSelectedMember(member);
                      handleRemoveMember();
                    }
                  },
                  { text: 'Cancel', style: 'cancel' }
                ].filter(Boolean) as any
              );
            } : undefined}
            index={index}
            isDark={isDark}
            showFamilyChat={!!currentBaby && member.id !== currentUserId}
            onFamilyChatPress={() => handleFamilyChatPress(member)}
            themeColors={themeColors}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))
      )}
    </View>
  );

  if (isLoading && members.length === 0) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.containerDark]}>
        <StatusBar barStyle={isDark ? 'light' : 'dark'} />
        <LinearGradient
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ marginTop: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
          Loading family...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Sticky Header with Blur */}
      {renderHeader()}

      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 180 + insets.top, paddingBottom: insets.bottom + 30 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        }
      >
        {renderTabContent()}
      </AnimatedScrollView>

      {/* Member Detail Modal */}
      <ActionModal
        visible={showMemberModal}
        onClose={() => {
          setShowMemberModal(false);
          setSelectedMember(null);
        }}
        title={selectedMember?.fullName || 'Member Details'}
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        {selectedMember && (
          <View style={styles.memberDetailContent}>
            <View style={styles.memberDetailHeader}>
              <View style={styles.memberDetailAvatar}>
                <SafeAvatar
                  avatar={selectedMember.avatar}
                  size={100}
                  fallbackEmoji={selectedMember.role === UserRole.PARENT_1 ? '👑' : '👤'}
                  fallbackIcon={selectedMember.role === UserRole.PARENT_1 ? 'shield' : 'person'}
                  fallbackColor={ROLE_CONFIG[selectedMember.role].color}
                />
              </View>
              <LinearGradient
                colors={ROLE_CONFIG[selectedMember.role].gradient}
                style={styles.memberDetailRoleBadge}
              >
                <Ionicons name={ROLE_CONFIG[selectedMember.role].icon} size={14} color="#fff" />
                <Text style={styles.memberDetailRoleText}>{ROLE_CONFIG[selectedMember.role].label}</Text>
              </LinearGradient>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, isDark && styles.textDark]}>Contact Information</Text>

              {selectedMember.email && (
                <TouchableOpacity
                  style={[styles.detailRow, isDark && styles.detailRowDark]}
                  onPress={() => handleContact('email')}
                >
                  <Ionicons name="mail" size={20} color={themeColors.primary} />
                  <Text style={[styles.detailText, isDark && styles.textDark]}>{selectedMember.email}</Text>
                  <Ionicons name="open-outline" size={16} color={isDark ? '#666' : '#999'} />
                </TouchableOpacity>
              )}

              {selectedMember.phoneNumber && (
                <TouchableOpacity
                  style={[styles.detailRow, isDark && styles.detailRowDark]}
                  onPress={() => handleContact('call')}
                >
                  <Ionicons name="call" size={20} color="#10b981" />
                  <Text style={[styles.detailText, isDark && styles.textDark]}>{selectedMember.phoneNumber}</Text>
                  <Ionicons name="open-outline" size={16} color={isDark ? '#666' : '#999'} />
                </TouchableOpacity>
              )}

              <View style={[styles.detailRow, isDark && styles.detailRowDark]}>
                <Ionicons name="people" size={20} color="#f59e0b" />
                <Text style={[styles.detailText, isDark && styles.textDark]}>
                  {selectedMember.relationship || 'Family Member'}
                </Text>
              </View>
            </View>

            {memberStats[selectedMember.id] && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, isDark && styles.textDark]}>Activity Stats</Text>
                <View style={styles.statsGrid}>
                  <View style={[styles.statBox, isDark && styles.statBoxDark]}>
                    <Text style={[styles.statBoxValue, { color: themeColors.primary }]}>{memberStats[selectedMember.id].totalActivities}</Text>
                    <Text style={[styles.statBoxLabel, isDark && styles.textMuted]}>Total Logs</Text>
                  </View>
                  <View style={[styles.statBox, isDark && styles.statBoxDark]}>
                    <Text style={[styles.statBoxValue, { color: themeColors.primary }]}>{memberStats[selectedMember.id].last7Days}</Text>
                    <Text style={[styles.statBoxLabel, isDark && styles.textMuted]}>This Week</Text>
                  </View>
                  <View style={[styles.statBox, isDark && styles.statBoxDark]}>
                    <Text style={[styles.statBoxValue, { color: themeColors.primary }]}>{memberStats[selectedMember.id].loginStreak}</Text>
                    <Text style={[styles.statBoxLabel, isDark && styles.textMuted]}>Day Streak</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, isDark && styles.textDark]}>Permissions</Text>
              <View style={styles.permissionsList}>
                {ROLE_CONFIG[selectedMember.role].permissions.map((perm, i) => (
                  <View key={i} style={[styles.permissionItem, isDark && styles.permissionItemDark]}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={[styles.permissionText, isDark && styles.textDark]}>{perm}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.detailActions}>
              <TouchableOpacity
                style={styles.detailActionBtn}
                onPress={() => {
                  setShowMemberModal(false);
                  handleFamilyChatPress(selectedMember);
                }}
              >
                <LinearGradient colors={ROLE_CONFIG[selectedMember.role].gradient} style={styles.detailActionGradient}>
                  <Ionicons name="chatbubble" size={20} color="#fff" />
                  <Text style={styles.detailActionText}>Family Chat</Text>
                </LinearGradient>
              </TouchableOpacity>

              {isPrimaryParent && selectedMember.role !== UserRole.PARENT_1 && (
                <>
                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionSecondary, isDark && styles.detailActionSecondaryDark]}
                    onPress={openEditModal}
                  >
                    <Ionicons name="create" size={20} color={themeColors.primary} />
                    <Text style={[styles.detailActionSecondaryText, { color: themeColors.primary }]}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionSecondary, isDark && styles.detailActionSecondaryDark]}
                    onPress={() => {
                      setShowMemberModal(false);
                      setShowRoleModal(true);
                    }}
                  >
                    <Ionicons name="shield" size={20} color="#f59e0b" />
                    <Text style={[styles.detailActionSecondaryText, { color: '#f59e0b' }]}>Change Role</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailActionBtn, styles.detailActionDanger]}
                    onPress={handleRemoveMember}
                  >
                    <Ionicons name="trash" size={20} color="#ff4757" />
                    <Text style={styles.detailActionDangerText}>Remove Member</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </ActionModal>

      {/* Edit Member Modal */}
      <ActionModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Member"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.editForm}>
          <TouchableOpacity style={styles.editAvatarContainer} onPress={handleImagePick}>
            {editForm.avatar ? (
              <SafeAvatar
                avatar={editForm.avatar}
                size={100}
                fallbackEmoji="👤"
                fallbackIcon="camera"
                fallbackColor={themeColors.primary}
              />
            ) : (
              <View style={[styles.editAvatarPlaceholder, { backgroundColor: ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color + '20' }]}>
                <Ionicons name="camera" size={32} color={ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color} />
              </View>
            )}
            <View style={[styles.editAvatarOverlay, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Full Name</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.fullName}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, fullName: text }))}
              placeholder="Enter full name"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Email</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.email}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
              placeholder="Enter email address"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Phone Number</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.phoneNumber}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, phoneNumber: text }))}
              placeholder="Enter phone number"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Relationship</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={editForm.relationship}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, relationship: text }))}
              placeholder="e.g., Grandma, Uncle, Nanny"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          <View style={[styles.toggleRow, isDark && styles.toggleRowDark]}>
            <View style={styles.toggleInfo}>
              <Ionicons
                name={editForm.notificationsEnabled ? "notifications" : "notifications-off"}
                size={22}
                color={editForm.notificationsEnabled ? themeColors.primary : isDark ? "#555" : "#999"}
              />
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, isDark && styles.textDark]}>Notifications</Text>
                <Text style={[styles.toggleDescription, isDark && styles.textMuted]}>
                  Receive alerts about family activities
                </Text>
              </View>
            </View>
            <Switch
              value={editForm.notificationsEnabled}
              onValueChange={(val) => setEditForm(prev => ({ ...prev, notificationsEnabled: val }))}
              trackColor={{ false: isDark ? '#333' : '#ddd', true: themeColors.primary }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleUpdateMember}
            disabled={isLoading}
          >
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.saveButtonGradient}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Invite Member Modal */}
      <ActionModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Family Member"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.inviteForm}>
          <Text style={[styles.inviteDescription, isDark && styles.textMuted]}>
            Invite someone to join your family and help track {currentBaby?.name || 'your baby'}.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Email Address</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Enter email address"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, isDark && styles.textDark]}>Relationship to Baby</Text>
            <TextInput
              style={[styles.formInput, isDark && styles.formInputDark]}
              value={inviteRelationship}
              onChangeText={setInviteRelationship}
              placeholder="e.g., Grandma, Uncle, Babysitter"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          <Text style={[styles.formLabel, isDark && styles.textDark, { marginTop: 8 }]}>Select Role</Text>

          <View style={styles.roleSelection}>
            {[UserRole.PARENT_2, UserRole.GUARDIAN, UserRole.VIEWER].map((role) => {
              const config = ROLE_CONFIG[role];
              const isSelected = inviteRole === role;
              const currentCount = members.filter(m => m.role === role).length;
              const isDisabled = currentCount >= config.maxCount;

              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    isSelected && { borderColor: config.color, backgroundColor: config.color + '10' },
                    isDisabled && styles.roleOptionDisabled,
                    isDark && styles.roleOptionDark
                  ]}
                  onPress={() => !isDisabled && setInviteRole(role)}
                  disabled={isDisabled}
                >
                  <LinearGradient colors={config.gradient} style={styles.roleOptionIcon}>
                    <Ionicons name={config.icon} size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.roleOptionInfo}>
                    <Text style={[styles.roleOptionTitle, isDark && styles.textDark, isDisabled && styles.textDisabled]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.roleOptionDesc, isDark && styles.textMuted, isDisabled && styles.textDisabled]}>
                      {config.description}
                    </Text>
                    <Text style={[styles.roleOptionLimit, { color: isDisabled ? '#ef4444' : config.color }]}>
                      {currentCount}/{config.maxCount} used
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.inviteButton, !inviteEmail.trim() && styles.inviteButtonDisabled]}
            onPress={handleInvite}
            disabled={isLoading || !inviteEmail.trim()}
          >
            <LinearGradient colors={[themeColors.primary, themeColors.secondary]} style={styles.inviteButtonGradient}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.inviteButtonText}>Send Invitation</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Change Role Modal */}
      <ActionModal
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Change Member Role"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.roleChangeContent}>
          <Text style={[styles.roleChangeDescription, isDark && styles.textMuted]}>
            Changing {selectedMember?.fullName}'s role will update their permissions immediately.
          </Text>

          {Object.entries(ROLE_CONFIG)
            .filter(([role]) => role !== UserRole.PARENT_1)
            .map(([role, config]) => {
              const isCurrent = selectedMember?.role === role;
              const currentCount = members.filter(m => m.role === role).length;
              const isAtLimit = !isCurrent && currentCount >= config.maxCount;

              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChangeOption,
                    isCurrent && { borderColor: config.color, backgroundColor: config.color + '15' },
                    isAtLimit && styles.roleChangeOptionDisabled,
                    isDark && styles.roleChangeOptionDark
                  ]}
                  onPress={() => handleChangeRole(role as UserRole)}
                  disabled={isCurrent || isAtLimit}
                >
                  <LinearGradient colors={config.gradient} style={styles.roleChangeIcon}>
                    <Ionicons name={config.icon} size={24} color="#fff" />
                  </LinearGradient>
                  <View style={styles.roleChangeInfo}>
                    <Text style={[styles.roleChangeTitle, isDark && styles.textDark]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.roleChangeDesc, isDark && styles.textMuted]}>
                      {config.description}
                    </Text>
                    <View style={styles.roleChangePerms}>
                      {config.permissions.slice(0, 2).map((perm, i) => (
                        <Text key={i} style={[styles.roleChangePerm, { color: config.color }]}>• {perm}</Text>
                      ))}
                    </View>
                  </View>
                  {isCurrent && <Ionicons name="checkmark" size={24} color={config.color} />}
                </TouchableOpacity>
              );
            })}
        </View>
      </ActionModal>

      {/* Activity Log Modal */}
      <ActionModal
        visible={showActivityLog}
        onClose={() => setShowActivityLog(false)}
        title="Recent Family Activity"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.analyticsContent}>
          {recentFamilyActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={isDark ? '#555' : '#ccc'} />
              <Text style={[styles.emptyStateText, isDark && styles.textMuted]}>
                No recent activity recorded
              </Text>
            </View>
          ) : (
            recentFamilyActivity.map((activity, index) => (
              <ActivityLogItem
                key={activity.id}
                activity={activity}
                isDark={isDark}
                index={index}
                shouldReduceMotion={shouldReduceMotion}
              />
            ))
          )}
        </View>
      </ActionModal>

      {/* Family Stats Modal */}
      <ActionModal
        visible={showFamilyStats}
        onClose={() => setShowFamilyStats(false)}
        title="Family Analytics"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.analyticsContent}>
          <View style={styles.analyticsSection}>
            <Text style={[styles.analyticsTitle, isDark && styles.textDark]}>Role Distribution</Text>
            <View style={styles.distributionGrid}>
              {getRoleDistribution().map(({ role, count }) => (
                <View key={role} style={[styles.distributionItem, isDark && styles.distributionItemDark]}>
                  <Text style={[styles.distributionValue, isDark && styles.textDark, { color: themeColors.primary }]}>{count}</Text>
                  <Text style={[styles.distributionLabel, isDark && styles.textMuted]}>{role}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.analyticsSection}>
            <Text style={[styles.analyticsTitle, isDark && styles.textDark]}>Member Activity</Text>
            {members.map((member) => (
              <View key={member.id} style={[styles.analyticsMemberRow, isDark && styles.analyticsMemberRowDark]}>
                <View style={styles.analyticsMemberInfo}>
                  <Text style={[styles.analyticsMemberName, isDark && styles.textDark]}>
                    {member.fullName}
                  </Text>
                  <Text style={[styles.analyticsMemberRole, isDark && styles.textMuted]}>
                    {ROLE_LABELS[member.role]}
                  </Text>
                </View>
                <View style={styles.analyticsMemberStats}>
                  <Text style={[styles.analyticsStat, { color: ROLE_CONFIG[member.role].color }]}>
                    {memberStats[member.id]?.totalActivities || 0} logs
                  </Text>
                  <Text style={[styles.analyticsStreak, isDark && styles.textMuted]}>
                    🔥 {memberStats[member.id]?.loginStreak || 0} day streak
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ActionModal>

      {/* Baby Selector Modal */}
      <ActionModal
        visible={showBabySelector}
        onClose={() => setShowBabySelector(false)}
        title="Select Baby"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.babySelectorContent}>
          {babies.map((baby) => (
            <TouchableOpacity
              key={baby.id}
              style={[
                styles.babyOption,
                currentBaby?.id === baby.id && [styles.babyOptionActive, { borderColor: themeColors.primary, backgroundColor: themeColors.colors[0] }],
                isDark && styles.babyOptionDark
              ]}
              onPress={() => {
                switchBaby(baby.id);
                setShowBabySelector(false);
              }}
            >
              <View style={[styles.babyOptionIcon, { backgroundColor: currentBaby?.id === baby.id ? themeColors.primary : isDark ? '#333' : '#e2e8f0' }]}>
                <Text style={styles.babyOptionEmoji}>👶</Text>
              </View>
              <View style={styles.babyOptionInfo}>
                <Text style={[styles.babyOptionName, isDark && styles.textDark]}>{baby.name}</Text>
                <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                  {new Date(baby.dateOfBirth).toLocaleDateString()} • {baby.gender || 'Baby'}
                </Text>
              </View>
              {currentBaby?.id === baby.id && <Ionicons name="checkmark" size={24} color={themeColors.primary} />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.addBabyOption, isDark && styles.addBabyOptionDark]}
            onPress={() => {
              setShowBabySelector(false);
              navigation.navigate('CreateBabyProfile');
            }}
          >
            <View style={[styles.addBabyIcon, { backgroundColor: themeColors.colors[0] }]}>
              <Ionicons name="add" size={24} color={themeColors.primary} />
            </View>
            <Text style={[styles.addBabyText, isDark && styles.textDark, { color: themeColors.primary }]}>Add New Baby</Text>
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Family Settings Modal */}
      <ActionModal
        visible={showFamilySettings}
        onClose={() => setShowFamilySettings(false)}
        title="Family Alerts & Notifications"
        isDark={isDark}
        primaryColor={themeColors.primary}
      >
        <View style={styles.settingsContent}>
          <Text style={[styles.settingsDescription, isDark && styles.textMuted]}>
            Manage how your family stays connected and informed about baby activities.
          </Text>

          <TouchableOpacity
            style={[styles.settingsOption, isDark && styles.settingsOptionDark]}
            onPress={() => {
              setShowFamilySettings(false);
              navigation.navigate('TrackerReminders');
            }}
          >
            <Ionicons name="notifications-outline" size={24} color="#f59e0b" />
            <View style={styles.settingsOptionInfo}>
              <Text style={[styles.settingsOptionText, isDark && styles.textDark]}>Activity Reminders</Text>
              <Text style={[styles.settingsOptionSubtext, isDark && styles.textMuted]}>
                Set up feeding, sleep, and medication alerts
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsOption, isDark && styles.settingsOptionDark]}
            onPress={() => {
              setShowFamilySettings(false);

showAlert(
                'Export Family Data',
                'Generate a comprehensive report of all family activities?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Export',
                    onPress: () => {
                      triggerHaptic('success');
                      sweetAlert.alert('Export Started', 'You will receive an email when ready.', 'warning');
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="download-outline" size={24} color="#8b5cf6" />
            <View style={styles.settingsOptionInfo}>
              <Text style={[styles.settingsOptionText, isDark && styles.textDark]}>Export Family Data</Text>
              <Text style={[styles.settingsOptionSubtext, isDark && styles.textMuted]}>
                Download activity logs and milestones
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>

          <View style={[styles.toggleRow, isDark && styles.toggleRowDark, { marginTop: 16 }]}>
            <View style={styles.toggleInfo}>
              <Ionicons name="chatbubbles-outline" size={22} color="#ec4899" />
                            <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, isDark && styles.textDark]}>Family Chat Notifications</Text>
                <Text style={[styles.toggleDescription, isDark && styles.textMuted]}>
                  Get notified when family members send messages
                </Text>
              </View>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: isDark ? '#333' : '#ddd', true: '#ec4899' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.toggleRow, isDark && styles.toggleRowDark]}>
            <View style={styles.toggleInfo}>
              <Ionicons name="mail-outline" size={22} color={themeColors.primary} />
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, isDark && styles.textDark]}>Email Digest</Text>
                <Text style={[styles.toggleDescription, isDark && styles.textMuted]}>
                  Weekly summary of family activities
                </Text>
              </View>
            </View>
            <Switch
              value={false}
              onValueChange={() => {}}
              trackColor={{ false: isDark ? '#333' : '#ddd', true: themeColors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.toggleRow, isDark && styles.toggleRowDark]}>
            <View style={styles.toggleInfo}>
              <Ionicons name="person-add-outline" size={22} color="#10b981" />
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, isDark && styles.textDark]}>New Member Alerts</Text>
                <Text style={[styles.toggleDescription, isDark && styles.textMuted]}>
                  Notify when someone joins the family
                </Text>
              </View>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: isDark ? '#333' : '#ddd', true: '#10b981' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  containerDark: {
    backgroundColor: '#0a0a0a'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  textDark: {
    color: '#ffffff'
  },
  textMuted: {
    color: '#94a3b8'
  },
  textDisabled: {
    color: '#64748b',
    opacity: 0.5
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBtnDark: {
    backgroundColor: 'rgba(40,40,50,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerBtnAccent: {
    backgroundColor: '#667eea',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  babySelector: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 12,
  },
  babySelectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconAction: {
    alignItems: 'center',
    padding: 8,
  },
  iconActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: {
        elevation: 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  tabContainerDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  tabContent: {
    paddingTop: 16,
  },
  memberCardWrapper: {
    marginBottom: 14,
    borderRadius: 20,
  },
  memberCardTouchable: {
    width: '100%',
  },
  quickActionWrapper: {
    borderRadius: 16,
  },
  familyStatsContainer: {
    marginBottom: 20,
  },
  familyStatsGradient: {
    borderRadius: 20,
    padding: 16,
  },
  familyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  familyStat: {
    alignItems: 'center',
  },
  familyStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
  },
  familyStatLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },
  familyStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recentActivityCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: {
        elevation: 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  recentActivityCardDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  memberCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8
      },
      android: {
        elevation: 3,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  memberCardDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  roleStrip: {
    height: 4,
    width: '100%',
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  memberAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  youBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#667eea',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  mutedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#64748b',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    marginLeft: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  roleBadgeSmallText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  memberRelationship: {
    fontSize: 13,
    color: '#64748b',
  },
  memberLastActive: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pendingText: {
    fontSize: 12,
    color: '#f59e0b',
    marginLeft: 4,
    fontWeight: '600',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 8,
  },
  memberActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyChatBtn: {
    backgroundColor: '#ec489920',
  },
  permissionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  permissionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  permissionPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  quickAction: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.8)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: {
        elevation: 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  quickActionDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: {
        elevation: 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  pendingCardDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  pendingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f59e0b15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  pendingRole: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  pendingSent: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleLimitsSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  roleLimitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
  },
  roleLimitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleLimitItem: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    padding: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4
      },
      android: {
        elevation: 1,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  roleLimitItemDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  roleLimitItemFull: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  roleLimitValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  roleLimitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
  },
  emptyStateDark: {
    backgroundColor: 'rgba(30,30,35,0.5)',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 8,
  },
  addFirstMemberBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addFirstMemberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  analyticsSection: {
    marginBottom: 24,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  distributionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distributionItem: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: {
        elevation: 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  distributionItemDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  distributionValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
  },
  distributionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  analyticsMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4
      },
      android: {
        elevation: 1,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  analyticsMemberRowDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,35,0.95)',
      },
    }),
  },
  analyticsMemberInfo: {
    flex: 1,
  },
  analyticsMemberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  analyticsMemberRole: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  analyticsMemberStats: {
    alignItems: 'flex-end',
  },
  analyticsStat: {
    fontSize: 13,
    fontWeight: '700',
  },
  analyticsStreak: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  modalContentDark: {
    backgroundColor: '#1a1a2e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalScrollContent: {
    padding: 16,
  },
  activityLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  activityLogItemDark: {
    backgroundColor: 'rgba(30,30,35,0.5)',
  },
  activityLogIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityLogContent: {
    flex: 1,
  },
  activityLogTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  activityLogMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  avatarWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  memberDetailContent: {
    padding: 16,
  },
  memberDetailHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  memberDetailAvatar: {
    marginBottom: 12,
  },
  memberDetailRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  memberDetailRoleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailRowDark: {
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    marginLeft: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    padding: 12,
  },
  statBoxDark: {
    backgroundColor: 'rgba(30,30,35,0.5)',
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#667eea',
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
  },
  permissionsList: {
    gap: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  permissionItemDark: {
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  permissionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  detailActions: {
    gap: 10,
    marginTop: 10,
  },
  detailActionBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  detailActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  detailActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  detailActionSecondaryDark: {
    backgroundColor: 'rgba(30,30,35,0.5)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  detailActionSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
  },
  detailActionDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff4757',
    backgroundColor: 'rgba(255,71,87,0.05)',
  },
  detailActionDangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff4757',
  },
  editForm: {
    padding: 16,
  },
  editAvatarContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  formInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    color: '#1a1a1a',
  },
  formInputDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  toggleRowDark: {
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTextContainer: {
    marginLeft: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  saveButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  inviteForm: {
    padding: 16,
  },
  inviteDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  inviteButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inviteButtonDisabled: {
    opacity: 0.7,
    backgroundColor: 'rgba(100,116,139,0.15)',
  },
  inviteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  roleSelection: {
    gap: 10,
    marginTop: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  roleOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  roleOptionDisabled: {
    opacity: 0.4,
  },
  roleOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleOptionInfo: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  roleOptionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  roleOptionLimit: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  roleChangeContent: {
    padding: 16,
  },
  roleChangeDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  roleChangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  roleChangeOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  roleChangeOptionDisabled: {
    opacity: 0.4,
  },
  roleChangeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleChangeInfo: {
    flex: 1,
  },
  roleChangeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  roleChangeDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  roleChangePerms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  roleChangePerm: {
    fontSize: 11,
    fontWeight: '600',
  },
  analyticsContent: {
    padding: 16,
  },
  babySelectorContent: {
    padding: 16,
  },
  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  babyOptionActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(102,126,234,0.05)',
  },
  babyOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  babyOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  babyOptionEmoji: {
    fontSize: 24,
  },
  babyOptionInfo: {
    flex: 1,
  },
  babyOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  babyOptionMeta: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  addBabyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.1)',
    marginTop: 8,
  },
  addBabyOptionDark: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addBabyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addBabyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  settingsContent: {
    padding: 16,
  },
  settingsDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  settingsOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  settingsOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  settingsOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  settingsOptionSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});
