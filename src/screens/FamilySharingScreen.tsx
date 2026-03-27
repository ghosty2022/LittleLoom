// src/screens/FamilySharingScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  Image,
  Platform,
  ActivityIndicator,
  Share,
  Dimensions,
  Switch,
  Modal,
  Linking,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeInUp, 
  FadeInDown, 
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

import { UserRole, ROLE_LABELS, ROLE_PERMISSIONS, Permission, FamilyMember } from '../types/roles';
import { useFamily } from '../context/FamilyContext';
import { useUser } from '../context/UserContext';
import { useBaby } from '../context/BabyContext';
import { useActivity } from '../context/ActivityContext';
import { useAuth } from '../context/AuthContext';

type FamilySharingScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilySharing'>;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const { width, height } = Dimensions.get('window');

// ==================== ENHANCED ROLE CONFIGURATION ====================
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

// ==================== ACTIVITY TYPE CONFIG ====================
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

// ==================== MODAL COMPONENTS ====================

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
  showCloseButton?: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({ 
  visible, 
  onClose, 
  title, 
  children, 
  isDark,
  showCloseButton = true 
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
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ==================== ACTIVITY LOG COMPONENT ====================

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
}

const ActivityLogItem: React.FC<ActivityLogItemProps> = ({ activity, isDark, index }) => {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;
  
  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 50)}
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

// ==================== MEMBER CARD COMPONENT ====================

interface MemberCardProps {
  member: FamilyMember;
  isCurrentUser: boolean;
  isPrimaryParent: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  index: number;
  isDark: boolean;
  showBabyChat?: boolean;
  onBabyChatPress?: () => void;
}

const MemberCard: React.FC<MemberCardProps> = ({ 
  member, 
  isCurrentUser, 
  isPrimaryParent,
  onPress, 
  onLongPress,
  index,
  isDark,
  showBabyChat,
  onBabyChatPress
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
    <AnimatedTouchableOpacity
      entering={FadeInUp.delay(index * 100)}
      style={[animatedStyle]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayLongPress={500}
      activeOpacity={0.9}
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
          <View style={[styles.memberAvatarContainer, { backgroundColor: roleConfig.color + '20' }]}>
            {member.avatar ? (
              <Image source={{ uri: member.avatar }} style={styles.memberAvatarImage} />
            ) : (
              <Text style={[styles.memberAvatarEmoji, { color: roleConfig.color }]}>
                {isCurrentUser ? '👑' : (member.role === UserRole.PARENT_2 ? '👨‍👩‍👧‍👦' : '👤')}
              </Text>
            )}
            {isCurrentUser && (
              <View style={styles.youBadge}>
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
            {showBabyChat && onBabyChatPress && (
              <TouchableOpacity 
                style={[styles.memberActionBtn, styles.babyChatBtn, { backgroundColor: '#ec489920' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  onBabyChatPress();
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
    </AnimatedTouchableOpacity>
  );
};

// ==================== QUICK ACTION BUTTON ====================

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  isDark: boolean;
  index: number;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, onPress, isDark, index }) => {
  return (
    <AnimatedTouchableOpacity
      entering={FadeInUp.delay(index * 75)}
      style={[styles.quickAction, isDark && styles.quickActionDark]}
      onPress={onPress}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.quickActionLabel, isDark && styles.textMuted]}>{label}</Text>
    </AnimatedTouchableOpacity>
  );
};

// ==================== MAIN SCREEN ====================

export default function FamilySharingScreen({ navigation }: FamilySharingScreenProps) {
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
  const { getEntriesByBaby, getRelativeTime } = useActivity();
  
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showFamilyStats, setShowFamilyStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBabySelector, setShowBabySelector] = useState(false);
  
  // Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.GUARDIAN);
  const [inviteRelationship, setInviteRelationship] = useState('');
  
  // Edit Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    relationship: '',
    avatar: '',
    notificationsEnabled: true,
    customPermissions: [] as string[],
  });

  // Stats
  const [memberStats, setMemberStats] = useState<Record<string, any>>({});
  const [recentFamilyActivity, setRecentFamilyActivity] = useState<any[]>([]);

  const isPrimaryParent = useMemo(() => {
    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    return parent1?.id === currentUserId || members.some(m => 
      m.role === UserRole.PARENT_1 && (m.id === currentUserId || m.userId === currentUserId)
    );
  }, [parent1, members, userProfile, profile]);

  const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  // Calculate member statistics and recent activity
  useEffect(() => {
    if (!currentBaby) return;
    
    const stats: Record<string, any> = {};
    const allActivities = getEntriesByBaby(currentBaby.id);
    const familyActivity: any[] = [];
    
    members.forEach(member => {
      const memberActivities = allActivities.filter(a => a.loggedBy === member.id);
      const last7Days = memberActivities.filter(a => 
        a.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
      );
      
      const recentActivities = memberActivities
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map(a => ({
          id: a.id,
          type: a.type,
          title: a.title || ACTIVITY_CONFIG[a.type]?.label || 'Activity',
          details: a.details,
          timestamp: a.timestamp,
          loggedByName: member.fullName,
          babyName: currentBaby.name,
        }));
      
      familyActivity.push(...recentActivities);
      
      stats[member.id] = {
        totalActivities: memberActivities.length,
        last7Days: last7Days.length,
        lastActive: member.lastActive,
        loginStreak: calculateLoginStreak(member.id, allActivities),
        mostActiveType: getMostActiveType(memberActivities),
        recentActivities,
      };
    });
    
    // Sort all family activity by timestamp
    familyActivity.sort((a, b) => b.timestamp - a.timestamp);
    setRecentFamilyActivity(familyActivity.slice(0, 20));
    setMemberStats(stats);
  }, [members, currentBaby, getEntriesByBaby]);

  const calculateLoginStreak = (memberId: string, activities: any[]) => {
    const memberActivities = activities.filter(a => a.loggedBy === memberId);
    if (memberActivities.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const hasActivity = memberActivities.some(a => {
        const actDate = new Date(a.timestamp);
        return actDate.toDateString() === checkDate.toDateString();
      });
      if (hasActivity) streak++;
      else if (i > 0) break;
    }
    return streak;
  };

  const getMostActiveType = (activities: any[]) => {
    if (activities.length === 0) return null;
    const typeCounts: Record<string, number> = {};
    activities.forEach(a => {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });
    return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFamily();
    setIsRefreshing(false);
  }, [loadFamily]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    
    if (!inviteRelationship.trim()) {
      Alert.alert('Error', 'Please specify the relationship');
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const success = await inviteMember(inviteEmail, inviteRole, inviteRelationship);
    
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRelationship('');
      Alert.alert('Success', `Invitation sent to ${inviteEmail}`);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    
    setIsLoading(false);
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;
    
    if (!editForm.fullName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
      Alert.alert('Success', 'Member updated successfully');
      loadFamily();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update member');
    }
    
    setIsLoading(false);
  };

  const handleRemoveMember = () => {
    if (!selectedMember) return;
    
    if (selectedMember.role === UserRole.PARENT_1) {
      Alert.alert('Cannot Remove', 'Primary Parent cannot be removed');
      return;
    }

    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    if (selectedMember.id === currentUserId) {
      Alert.alert('Cannot Remove', 'You cannot remove yourself');
      return;
    }

    Alert.alert(
      'Remove Family Member',
      `Are you sure you want to remove ${selectedMember.fullName}?\n\nThis will revoke their access to all family data. Their activity history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const success = await removeMember(selectedMember.id);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      Alert.alert('Cannot Change', 'Primary Parent role cannot be changed');
      return;
    }

    const currentCount = members.filter(m => m.role === newRole).length;
    const maxAllowed = ROLE_CONFIG[newRole].maxCount;
    
    if (currentCount >= maxAllowed && newRole !== selectedMember.role) {
      Alert.alert('Role Limit Reached', `You can only have ${maxAllowed} ${ROLE_CONFIG[newRole].label}(s)`);
      return;
    }

    Alert.alert(
      'Change Role',
      `Change ${selectedMember.fullName} to ${ROLE_CONFIG[newRole].label}?\n\nThis will update their permissions immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            const success = await updateGuardianProfile(selectedMember.id, {
              role: newRole,
              permissions: ROLE_PERMISSIONS[newRole],
            });
            
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleContact = async (type: 'call' | 'email' | 'sms') => {
    if (!selectedMember) return;
    
    let url = '';
    switch (type) {
      case 'call':
        if (!selectedMember.phoneNumber) {
          Alert.alert('No Phone', 'No phone number available');
          return;
        }
        url = `tel:${selectedMember.phoneNumber.replace(/\s/g, '')}`;
        break;
      case 'email':
        if (!selectedMember.email) {
          Alert.alert('No Email', 'No email address available');
          return;
        }
        url = `mailto:${selectedMember.email}`;
        break;
      case 'sms':
        if (!selectedMember.phoneNumber) {
          Alert.alert('No Phone', 'No phone number available');
          return;
        }
        url = `sms:${selectedMember.phoneNumber.replace(/\s/g, '')}`;
        break;
    }
    
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleBabyChatPress = (member: FamilyMember) => {
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

  // Render Header with Baby Selector
  const renderHeader = () => (
    <Animated.View entering={FadeInDown} style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, isDark && styles.textDark]}>
            Family Sharing
          </Text>
          {currentBaby && (
            <TouchableOpacity 
              style={styles.babySelector}
              onPress={() => setShowBabySelector(true)}
            >
              <Text style={[styles.babySelectorText, isDark && styles.textMuted]}>
                {currentBaby.name} ▼
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.headerBtn, { marginRight: 8 }]}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons name="settings-outline" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerBtn, styles.headerBtnAccent]}
            onPress={() => setShowInviteModal(true)}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions Row */}
      <View style={styles.quickActionsRow}>
        <QuickAction 
          icon="chatbubbles" 
          label="Family Chat" 
          color="#ec4899" 
          onPress={() => navigation.navigate('FamilyChatList')}
          isDark={isDark}
          index={0}
        />
        <QuickAction 
          icon="time" 
          label="Activity" 
          color="#10b981" 
          onPress={() => setShowActivityLog(true)}
          isDark={isDark}
          index={1}
        />
        <QuickAction 
          icon="stats-chart" 
          label="Analytics" 
          color="#667eea" 
          onPress={() => setShowFamilyStats(true)}
          isDark={isDark}
          index={2}
        />
        <QuickAction 
          icon="notifications" 
          label="Alerts" 
          color="#f59e0b" 
          onPress={() => navigation.navigate('Reminders')}
          isDark={isDark}
          index={3}
        />
      </View>

      {/* Family Stats Summary */}
      <View style={styles.familyStatsContainer}>
        <LinearGradient
          colors={['#667eea20', '#764ba220']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.familyStatsGradient}
        >
          <View style={styles.familyStatsRow}>
            <View style={styles.familyStat}>
              <Text style={styles.familyStatValue}>{members.length}</Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Members</Text>
            </View>
            <View style={styles.familyStatDivider} />
            <View style={styles.familyStat}>
              <Text style={styles.familyStatValue}>{pendingInvites.length}</Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Pending</Text>
            </View>
            <View style={styles.familyStatDivider} />
            <View style={styles.familyStat}>
              <Text style={styles.familyStatValue}>
                {members.filter(m => m.lastActive && new Date(m.lastActive).getTime() > Date.now() - 24 * 60 * 60 * 1000).length}
              </Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Active Today</Text>
            </View>
            <View style={styles.familyStatDivider} />
            <View style={styles.familyStat}>
              <Text style={styles.familyStatValue}>{recentFamilyActivity.length}</Text>
              <Text style={[styles.familyStatLabel, isDark && styles.textMuted]}>Recent Logs</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );

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
              style={styles.addFirstMemberBtn}
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
              Alert.alert(
                'Quick Actions',
                `${member.fullName}`,
                [
                  { text: 'Edit', onPress: () => openMemberDetails(member) },
                  { text: 'Change Role', onPress: () => {
                    setSelectedMember(member);
                    setShowRoleModal(true);
                  }},
                  { text: 'Baby Chat', onPress: () => handleBabyChatPress(member) },
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
            showBabyChat={!!currentBaby && member.id !== currentUserId}
            onBabyChatPress={() => handleBabyChatPress(member)}
          />
        ))
      )}
    </View>
  );

  const renderRecentActivity = () => {
    if (recentFamilyActivity.length === 0) return null;
    
    return (
      <View style={styles.recentActivitySection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Family Activity</Text>
          <TouchableOpacity onPress={() => setShowActivityLog(true)}>
            <Text style={[styles.seeAllText, { color: '#667eea' }]}>See All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={[styles.recentActivityCard, isDark && styles.recentActivityCardDark]}>
          {recentFamilyActivity.slice(0, 5).map((activity, index) => (
            <ActivityLogItem
              key={activity.id}
              activity={activity}
              isDark={isDark}
              index={index}
            />
          ))}
        </View>
      </View>
    );
  };

  if (isLoading && members.length === 0) {
    return (
      <View style={[styles.container, styles.centered, isDark && styles.containerDark]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient 
          colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} 
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
          Loading family...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} 
        style={StyleSheet.absoluteFill}
      />

      {renderHeader()}

      <AnimatedScrollView
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: insets.top + 220, paddingBottom: insets.bottom + 30 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
            colors={['#667eea']}
          />
        }
      >
        {/* Recent Activity Preview */}
        {renderRecentActivity()}

        {/* Primary Parent Section */}
        {renderMemberSection('Primary Parent', members.filter(m => m.role === UserRole.PARENT_1))}

        {/* Co-Parent Section */}
        {renderMemberSection('Co-Parent', members.filter(m => m.role === UserRole.PARENT_2), 'No co-parent added yet')}

        {/* Guardians Section */}
        {renderMemberSection('Guardians', members.filter(m => m.role === UserRole.GUARDIAN), 'No guardians added')}

        {/* Viewers Section */}
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
                entering={FadeInUp.delay(index * 100)}
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
                    <Ionicons name="refresh" size={20} color="#667eea" />
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

        {/* Family Settings Access */}
        <TouchableOpacity 
          style={[styles.familySettingsBtn, isDark && styles.familySettingsBtnDark]}
          onPress={() => navigation.navigate('Settings')}
        >
          <LinearGradient
            colors={isDark ? ['rgba(40,40,45,0.8)', 'rgba(25,25,30,0.6)'] : ['rgba(255,255,255,0.9)', 'rgba(250,250,255,0.7)']}
            style={styles.familySettingsGradient}
          >
            <Ionicons name="settings" size={24} color="#667eea" />
            <View style={styles.familySettingsInfo}>
              <Text style={[styles.familySettingsTitle, isDark && styles.textDark]}>Family Settings</Text>
              <Text style={[styles.familySettingsSubtitle, isDark && styles.textMuted]}>
                Manage notifications, privacy, and security
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </LinearGradient>
        </TouchableOpacity>
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
      >
        {selectedMember && (
          <View style={styles.memberDetailContent}>
            <View style={styles.memberDetailHeader}>
              <View style={[styles.memberDetailAvatar, { backgroundColor: ROLE_CONFIG[selectedMember.role].color + '20' }]}>
                {selectedMember.avatar ? (
                  <Image source={{ uri: selectedMember.avatar }} style={styles.memberDetailAvatarImage} />
                ) : (
                  <Text style={[styles.memberDetailAvatarEmoji, { color: ROLE_CONFIG[selectedMember.role].color }]}>
                    {selectedMember.role === UserRole.PARENT_1 ? '👑' : '👤'}
                  </Text>
                )}
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
                  <Ionicons name="mail" size={20} color="#667eea" />
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
                    <Text style={styles.statBoxValue}>{memberStats[selectedMember.id].totalActivities}</Text>
                    <Text style={[styles.statBoxLabel, isDark && styles.textMuted]}>Total Logs</Text>
                  </View>
                  <View style={[styles.statBox, isDark && styles.statBoxDark]}>
                    <Text style={styles.statBoxValue}>{memberStats[selectedMember.id].last7Days}</Text>
                    <Text style={[styles.statBoxLabel, isDark && styles.textMuted]}>This Week</Text>
                  </View>
                  <View style={[styles.statBox, isDark && styles.statBoxDark]}>
                    <Text style={styles.statBoxValue}>{memberStats[selectedMember.id].loginStreak}</Text>
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
                style={[styles.detailActionBtn, styles.detailActionPrimary]}
                onPress={() => {
                  setShowMemberModal(false);
                  handleBabyChatPress(selectedMember);
                }}
              >
                <LinearGradient colors={ROLE_CONFIG[selectedMember.role].gradient} style={styles.detailActionGradient}>
                  <Ionicons name="chatbubble" size={20} color="#fff" />
                  <Text style={styles.detailActionText}>Baby Chat</Text>
                </LinearGradient>
              </TouchableOpacity>

              {isPrimaryParent && selectedMember.role !== UserRole.PARENT_1 && (
                <>
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, styles.detailActionSecondary, isDark && styles.detailActionSecondaryDark]}
                    onPress={openEditModal}
                  >
                    <Ionicons name="create" size={20} color="#667eea" />
                    <Text style={[styles.detailActionSecondaryText, { color: '#667eea' }]}>Edit Profile</Text>
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
      >
        <View style={styles.editForm}>
          <TouchableOpacity style={styles.editAvatarContainer} onPress={handleImagePick}>
            {editForm.avatar ? (
              <Image source={{ uri: editForm.avatar }} style={styles.editAvatarImage} />
            ) : (
              <View style={[styles.editAvatarPlaceholder, { backgroundColor: ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color + '20' }]}>
                <Ionicons name="camera" size={32} color={ROLE_CONFIG[selectedMember?.role || UserRole.GUARDIAN].color} />
              </View>
            )}
            <View style={styles.editAvatarOverlay}>
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
                color={editForm.notificationsEnabled ? "#667eea" : isDark ? "#555" : "#999"} 
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
              trackColor={{ false: isDark ? '#333' : '#ddd', true: '#667eea' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleUpdateMember}
            disabled={isLoading}
          >
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.saveButtonGradient}>
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
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.inviteButtonGradient}>
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

      {/* Family Analytics Modal */}
      <ActionModal
        visible={showFamilyStats}
        onClose={() => setShowFamilyStats(false)}
        title="Family Analytics"
        isDark={isDark}
      >
        <View style={styles.analyticsContent}>
          <View style={styles.analyticsSection}>
            <Text style={[styles.analyticsTitle, isDark && styles.textDark]}>Role Distribution</Text>
            <View style={styles.distributionGrid}>
              {getRoleDistribution().map(({ role, count }, index) => (
                <View key={role} style={[styles.distributionItem, isDark && styles.distributionItemDark]}>
                  <Text style={[styles.distributionValue, isDark && styles.textDark]}>{count}</Text>
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

      {/* Activity Log Modal */}
      <ActionModal
        visible={showActivityLog}
        onClose={() => setShowActivityLog(false)}
        title="Recent Family Activity"
        isDark={isDark}
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
              />
            ))
          )}
        </View>
      </ActionModal>

      {/* Baby Selector Modal */}
      <ActionModal
        visible={showBabySelector}
        onClose={() => setShowBabySelector(false)}
        title="Select Baby"
        isDark={isDark}
      >
        <View style={styles.babySelectorContent}>
          {babies.map((baby, index) => (
            <TouchableOpacity
              key={baby.id}
              style={[
                styles.babyOption,
                currentBaby?.id === baby.id && styles.babyOptionActive,
                isDark && styles.babyOptionDark
              ]}
              onPress={() => {
                switchBaby(baby.id);
                setShowBabySelector(false);
              }}
            >
              <View style={[styles.babyOptionIcon, { backgroundColor: currentBaby?.id === baby.id ? '#667eea' : isDark ? '#333' : '#e2e8f0' }]}>
                <Text style={styles.babyOptionEmoji}>👶</Text>
              </View>
              <View style={styles.babyOptionInfo}>
                <Text style={[styles.babyOptionName, isDark && styles.textDark]}>{baby.name}</Text>
                <Text style={[styles.babyOptionMeta, isDark && styles.textMuted]}>
                  {new Date(baby.dateOfBirth).toLocaleDateString()} • {baby.gender || 'Baby'}
                </Text>
              </View>
              {currentBaby?.id === baby.id && <Ionicons name="checkmark" size={24} color="#667eea" />}
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={[styles.addBabyOption, isDark && styles.addBabyOptionDark]}
            onPress={() => {
              setShowBabySelector(false);
              navigation.navigate('CreateBabyProfile');
            }}
          >
            <View style={styles.addBabyIcon}>
              <Ionicons name="add" size={24} color="#667eea" />
            </View>
            <Text style={[styles.addBabyText, isDark && styles.textDark]}>Add New Baby</Text>
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Settings Quick Access Modal */}
      <ActionModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        title="Quick Settings"
        isDark={isDark}
      >
        <View style={styles.settingsContent}>
          <TouchableOpacity 
            style={[styles.settingsOption, isDark && styles.settingsOptionDark]}
            onPress={() => {
              setShowSettings(false);
              navigation.navigate('Settings');
            }}
          >
            <Ionicons name="settings-outline" size={24} color="#667eea" />
            <Text style={[styles.settingsOptionText, isDark && styles.textDark]}>Family Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingsOption, isDark && styles.settingsOptionDark]}
            onPress={() => {
              setShowSettings(false);
              navigation.navigate('Reminders');
            }}
          >
            <Ionicons name="notifications-outline" size={24} color="#f59e0b" />
            <Text style={[styles.settingsOptionText, isDark && styles.textDark]}>Reminders & Alerts</Text>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingsOption, isDark && styles.settingsOptionDark]}
            onPress={() => {
              setShowSettings(false);
              navigation.navigate('SecurityLock');
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#10b981" />
            <Text style={[styles.settingsOptionText, isDark && styles.textDark]}>Security & Privacy</Text>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingsOption, isDark && styles.settingsOptionDark]}
            onPress={() => {
              setShowSettings(false);
              Alert.alert(
                'Export Family Data',
                'Generate a comprehensive report of all family activities?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Export', 
                    onPress: () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Export Started', 'You will receive an email when ready.');
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="download-outline" size={24} color="#8b5cf6" />
            <Text style={[styles.settingsOptionText, isDark && styles.textDark]}>Export Data</Text>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>
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

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerBtnAccent: {
    backgroundColor: '#667eea',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: { 
       fontSize: 20, 
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

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 12,
    minWidth: (width - 56) / 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  quickActionDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },

  // Family Stats
  familyStatsContainer: {
    marginBottom: 8,
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

  // Sections
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

  // Recent Activity
  recentActivitySection: {
    marginBottom: 28,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recentActivityCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  recentActivityCardDark: {
    backgroundColor: 'rgba(30,30,35,0.8)',
  },

  // Member Card
  memberCard: {
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  memberCardDark: {
    borderColor: 'rgba(255,255,255,0.1)',
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
  memberAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 20,
  },
  memberAvatarEmoji: {
    fontSize: 28,
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
  babyChatBtn: {
    // Specific styling for baby chat button
  },
  permissionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  permissionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permissionPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderStyle: 'dashed',
  },
  emptyStateDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
  },
  addFirstMemberBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#667eea',
    borderRadius: 12,
  },
  addFirstMemberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Pending Invites
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  pendingCardDark: {
    backgroundColor: 'rgba(245,158,11,0.05)',
    borderColor: 'rgba(245,158,11,0.1)',
  },
  pendingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  pendingEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  pendingRole: {
    fontSize: 13,
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
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Role Limits
  roleLimitsSection: {
    marginBottom: 24,
  },
  roleLimitsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleLimitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleLimitItem: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 14,
    padding: 14,
    minWidth: (width - 52) / 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleLimitItemDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  roleLimitItemFull: {
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  roleLimitValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  roleLimitLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },

  // Family Settings Button
  familySettingsBtn: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  familySettingsBtnDark: {
    // Dark mode handled in gradient
  },
  familySettingsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  familySettingsInfo: {
    flex: 1,
    marginLeft: 14,
  },
  familySettingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  familySettingsSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: width - 32,
    maxHeight: height * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  modalContentDark: {
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    padding: 20,
  },

  // Member Detail
  memberDetailContent: {
    paddingBottom: 20,
  },
  memberDetailHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  memberDetailAvatar: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  memberDetailAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 30,
  },
  memberDetailAvatarEmoji: {
    fontSize: 50,
  },
  memberDetailRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  memberDetailRoleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },

  // Detail Sections
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  detailRowDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  detailText: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    marginLeft: 12,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statBoxDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statBoxValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },

  // Permissions
  permissionsList: {
    gap: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 10,
    padding: 12,
  },
  permissionItemDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  permissionText: {
    fontSize: 14,
    color: '#1a1a1a',
    marginLeft: 10,
  },

  // Detail Actions
  detailActions: {
    gap: 12,
    marginTop: 8,
  },
  detailActionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailActionPrimary: {},
  detailActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  detailActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  detailActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  detailActionSecondaryDark: {
    backgroundColor: 'rgba(102,126,234,0.15)',
    borderColor: 'rgba(102,126,234,0.3)',
  },
  detailActionSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailActionDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
  },
  detailActionDangerText: {
    color: '#ff4757',
    fontSize: 16,
    fontWeight: '600',
  },

  // Edit Form
  editForm: {
    gap: 16,
  },
  editAvatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  editAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 30,
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 30,
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
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },

  // Form Elements
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginLeft: 4,
  },
  formInput: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  formInputDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#ffffff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  toggleRowDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // Buttons
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Invite
  inviteForm: {
    gap: 16,
  },
  inviteDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
  },
  roleSelection: {
    gap: 10,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  roleOptionDisabled: {
    opacity: 0.5,
  },
  roleOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  roleOptionDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  roleOptionLimit: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  inviteButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  inviteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Role Change
  roleChangeContent: {
    gap: 12,
  },
  roleChangeDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 20,
  },
  roleChangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleChangeOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  roleChangeOptionDisabled: {
    opacity: 0.4,
  },
  roleChangeIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChangeInfo: {
    flex: 1,
    marginLeft: 14,
  },
  roleChangeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  roleChangeDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  roleChangePerms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  roleChangePerm: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Analytics
  analyticsContent: {
    gap: 24,
  },
  analyticsSection: {
    gap: 12,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  distributionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  distributionItem: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    padding: 14,
    minWidth: (width - 72) / 2,
    flex: 1,
  },
  distributionItemDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  distributionValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
  },
  distributionLabel: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  analyticsMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 14,
  },
  analyticsMemberRowDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    fontSize: 14,
    fontWeight: '700',
  },
  analyticsStreak: {
    fontSize: 12,
    marginTop: 2,
  },

  // Activity Log
  activityLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  activityLogItemDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  activityLogIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLogContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityLogTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  activityLogMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // Baby Selector
  babySelectorContent: {
    gap: 12,
  },
  babyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  babyOptionActive: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.05)',
  },
  babyOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  babyOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyOptionEmoji: {
    fontSize: 24,
  },
  babyOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  babyOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  babyOptionMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  addBabyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
    borderStyle: 'dashed',
  },
  addBabyOptionDark: {
    backgroundColor: 'rgba(102,126,234,0.05)',
    borderColor: 'rgba(102,126,234,0.3)',
  },
  addBabyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addBabyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },

  // Settings
  settingsContent: {
    gap: 8,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 14,
    padding: 16,
  },
  settingsOptionDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 12,
  },
});