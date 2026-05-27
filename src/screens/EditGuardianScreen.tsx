// src/screens/EditGuardianScreen.tsx
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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

// FIXED: Import UserRole from types/roles, not from UserContext
import { UserRole, ROLE_LABELS } from '../types/roles';
import { useFamily, FamilyMember } from '../context/FamilyContext';
import { useUser } from '../context/UserContext';
import { useBaby, ActivityEntry } from '../context/BabyContext';
import { useAuth } from '../context/AuthContext'; // ADDED: Import useAuth

type EditGuardianScreenProps = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const { width, height } = Dimensions.get('window');

// ==================== ENHANCED ROLE CONFIGURATION ====================
const ROLE_CONFIG: Record<UserRole, {
  label: string;
  color: string;
  gradient: [string, string];
  icon: string;
  description: string;
  permissions: string[];
  canEdit: boolean;
  canRemove: boolean;
  badge: string;
  priority: number;
}> = {
  [UserRole.PARENT_1]: {
    label: 'Primary Parent',
    color: '#667eea',
    gradient: ['#667eea', '#764ba2'],
    icon: 'shield',
    description: 'Full owner access to everything',
    permissions: ['All Permissions', 'Manage Family', 'Manage Security', 'Export Data', 'Billing'],
    canEdit: false,
    canRemove: false,
    badge: 'Owner',
    priority: 1,
  },
  [UserRole.PARENT_2]: {
    label: 'Co-Parent',
    color: '#fa709a',
    gradient: ['#fa709a', '#f5576c'],
    icon: 'heart',
    description: 'Full access to manage family and baby data',
    permissions: ['Read', 'Write', 'Delete', 'Manage Family', 'Export Data'],
    canEdit: true,
    canRemove: true,
    badge: 'Co-Parent',
    priority: 2,
  },
  [UserRole.GUARDIAN]: {
    label: 'Guardian',
    color: '#11998e',
    gradient: ['#11998e', '#38ef7d'],
    icon: 'shield-checkmark',
    description: 'Can add entries but cannot delete or manage family',
    permissions: ['Read', 'Write', 'Limited Delete'],
    canEdit: true,
    canRemove: true,
    badge: 'Guardian',
    priority: 3,
  },
  [UserRole.VIEWER]: {
    label: 'Viewer',
    color: '#64748b',
    gradient: ['#64748b', '#94a3b8'],
    icon: 'eye',
    description: 'View only access, cannot add or modify data',
    permissions: ['Read Only'],
    canEdit: true,
    canRemove: true,
    badge: 'Viewer',
    priority: 4,
  },
};

// ==================== ACTIVITY TYPE CONFIG ====================
const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  potty: { icon: 'water-outline', color: '#06b6d4', label: 'Potty' },
  feed: { icon: 'restaurant-outline', color: '#f59e0b', label: 'Feeding' },
  sleep: { icon: 'moon-outline', color: '#8b5cf6', label: 'Sleep' },
  growth: { icon: 'trending-up-outline', color: '#10b981', label: 'Growth' },
  medication: { icon: 'medical-outline', color: '#ef4444', label: 'Medication' },
  milestone: { icon: 'trophy-outline', color: '#fbbf24', label: 'Milestone' },
  diaper: { icon: 'layers-outline', color: '#3b82f6', label: 'Diaper' },
  note: { icon: 'document-text-outline', color: '#6b7280', label: 'Note' },
  default: { icon: 'ellipse-outline', color: '#9ca3af', label: 'Activity' },
};

// ==================== HELPER: CHECK IF VALUE IS IMAGE URI ====================
const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  // Emoji strings are typically 1-4 characters and contain emoji unicode
  return value.length <= 4 && /\p{Emoji}/u.test(value);
};

// ==================== MODAL COMPONENT ====================
interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({ visible, onClose, title, children, isDark }) => {
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
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

// ==================== ACTIVITY CARD COMPONENT ====================
const ActivityCard: React.FC<{ 
  activity: ActivityEntry; 
  isDark: boolean;
  index: number;
}> = ({ activity, isDark, index }) => {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 50)}
      style={[styles.activityCard, isDark && styles.activityCardDark]}
    >
      <View style={[styles.activityIconContainer, { backgroundColor: config.color + '20' }]}>
        <Ionicons name={config.icon as any} size={20} color={config.color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityTitle, isDark && styles.textDark]}>
          {activity.title || config.label}
        </Text>
        {activity.details && (
          <Text style={[styles.activityDetails, isDark && styles.textMuted]} numberOfLines={2}>
            {activity.details}
          </Text>
        )}
        <Text style={[styles.activityTime, isDark && styles.textMuted]}>
          {new Date(activity.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <View style={[styles.activityTypeBadge, { backgroundColor: config.color + '15' }]}>
        <Text style={[styles.activityTypeText, { color: config.color }]}>{config.label}</Text>
      </View>
    </Animated.View>
  );
};

// ==================== PERMISSION GRID COMPONENT ====================
const PermissionGrid: React.FC<{
  permissions: string[];
  roleColor: string;
  isDark: boolean;
}> = ({ permissions, roleColor, isDark }) => {
  return (
    <View style={styles.permissionGrid}>
      {permissions.map((permission, index) => (
        <Animated.View 
          key={permission} 
          entering={FadeIn.delay(index * 50)}
          style={[
            styles.permissionChip,
            { backgroundColor: roleColor + '15', borderColor: roleColor + '30' }
          ]}
        >
          <Ionicons name="checkmark-circle" size={14} color={roleColor} />
          <Text style={[styles.permissionChipText, { color: roleColor }]}>
            {permission}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
};

// ==================== AVATAR DISPLAY COMPONENT ====================
const AvatarDisplay: React.FC<{
  avatar: string | undefined;
  role: UserRole;
  size?: number;
  showEdit?: boolean;
  onPress?: () => void;
}> = ({ avatar, role, size = 120, showEdit = false, onPress }) => {
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG[UserRole.VIEWER];

  // Determine what to render
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);

  return (
    <TouchableOpacity 
      style={[
        styles.avatarContainer, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 3,
          backgroundColor: roleConfig.color + '20' 
        }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
    >
      {hasImage ? (
        <Image 
          source={{ uri: avatar }} 
          style={{ width: size, height: size, borderRadius: size / 3 }}
          resizeMode="cover"
          onError={(e) => console.log('Avatar image error:', e.nativeEvent.error)}
        />
      ) : hasEmoji ? (
        <Text style={[styles.avatarEmoji, { color: roleConfig.color, fontSize: size * 0.5 }]}>
          {avatar}
        </Text>
      ) : (
        <Ionicons 
          name={roleConfig.icon as any} 
          size={size * 0.4} 
          color={roleConfig.color} 
        />
      )}

      {showEdit && (
        <View style={[styles.editAvatarOverlay, { bottom: 0, right: 0 }]}>
          <Ionicons name="camera" size={24} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ==================== MAIN SCREEN ====================
export default function EditGuardianScreen({ navigation, route }: EditGuardianScreenProps) {
  const { guardianId, mode = 'guardian', fromChat = false } = route.params;
  const { members, guardians, updateGuardianProfile, removeMember, loadFamily } = useFamily();
  const { hasPermission, profile, updateProfile } = useUser();
  const { currentBaby, babies, getRecentActivities } = useBaby();
  const { userProfile } = useAuth(); // ADDED: Get current user from AuthContext
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [member, setMember] = useState<FamilyMember | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'activity' | 'permissions'>('info');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [memberActivities, setMemberActivities] = useState<ActivityEntry[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    relationship: '',
    avatar: '',
    notificationsEnabled: true,
    darkMode: false,
  });

  // FIXED: Enhanced member loading logic that handles current user not in members array
  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  useEffect(() => {
    console.log('Looking for member with ID:', guardianId);
    console.log('Available members:', members.map(m => ({ id: m.id, name: m.fullName, role: m.role })));

    let found = members.find(m => m.id === guardianId);

    // FIXED: If member not found in members array, check if it's the current user
    if (!found) {
      const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
      console.log('Member not found in array. Current user ID:', currentUserId);

      if (guardianId === currentUserId || guardianId === 'parent1') {
        // This is the current user (Parent 1) - construct a FamilyMember from userProfile
        console.log('Constructing FamilyMember from current user profile');
        found = {
          id: currentUserId || 'parent1',
          userId: currentUserId || 'parent1',
          fullName: userProfile?.fullName || profile?.fullName || 'Primary Parent',
          email: userProfile?.email || profile?.email || '',
          phoneNumber: userProfile?.phoneNumber || profile?.phoneNumber || '',
          avatar: userProfile?.avatar || profile?.avatar || '',
          role: UserRole.PARENT_1,
          relationship: 'Parent',
          addedAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          notificationsEnabled: true,
          canBeRemove: false,
          canEdit: false,
        } as FamilyMember;
      }
    }

    if (found) {
      console.log('Found/constructed member:', found.fullName, 'Role:', found.role, 'Avatar:', found.avatar);
      setMember(found);
      setFormData({
        fullName: found.fullName || '',
        email: found.email || '',
        phoneNumber: found.phoneNumber || '',
        relationship: found.relationship || '',
        avatar: found.avatar || '',
        notificationsEnabled: found.notificationsEnabled ?? true,
        darkMode: false,
      });

      // Load member's activities
      loadMemberActivities(found.id, found.userId);
    } else {
      console.log('Member not found and not current user');
    }
  }, [members, guardianId, currentBaby, userProfile, profile]);

  // FIXED: Enhanced activity loading with multiple fallback matching strategies
  const loadMemberActivities = useCallback(async (memberId: string, memberUserId?: string) => {
    if (!currentBaby) return;

    setIsLoadingActivities(true);

    try {
      // Get all activities for current baby
      const allActivities = getRecentActivities(50); // Get more to filter properly

      // Try multiple matching strategies
      const memberActs = allActivities.filter(a => {
        // Strategy 1: Direct ID match
        if (a.loggedBy === memberId) return true;
        // Strategy 2: User ID match (if different from member ID)
        if (memberUserId && a.loggedBy === memberUserId) return true;
        // Strategy 3: Name match (fallback for legacy data)
        if (member && a.loggedByName === member.fullName) return true;
        return false;
      });

      // Sort and limit
      const sorted = memberActs
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);

      setMemberActivities(sorted);
    } catch (error) {
      console.error('Error loading member activities:', error);
      setMemberActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [currentBaby, getRecentActivities, member]);

  // FIXED: Handle save with self-editing support for non-name fields
  const handleSave = async () => {
    if (!member) return;

    if (!formData.fullName.trim()) {
      Alert.alert('Error', 'Name is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Build updates object - only include changed fields
    const updates: Partial<FamilyMember> = {};

    // For current user, don't update name through FamilyContext
    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    const isCurrentUser = member.id === currentUserId;

    if (!isCurrentUser && formData.fullName !== member.fullName) {
      updates.fullName = formData.fullName;
    }

    if (formData.email !== member.email) updates.email = formData.email;
    if (formData.phoneNumber !== member.phoneNumber) updates.phoneNumber = formData.phoneNumber;
    if (formData.relationship !== member.relationship) updates.relationship = formData.relationship;
    if (formData.avatar !== member.avatar) updates.avatar = formData.avatar;
    if (formData.notificationsEnabled !== member.notificationsEnabled) {
      updates.notificationsEnabled = formData.notificationsEnabled;
    }

    try {
      let success = false;

      if (isCurrentUser) {
        // For current user, update through UserContext/AuthContext first
        try {
          await updateProfile({ 
            phoneNumber: formData.phoneNumber,
            email: formData.email,
            avatar: formData.avatar,
          });
        } catch (err) {
          console.log('UserContext update failed, using fallback');
        }
      }

      // Always update via FamilyContext for consistency
      success = await updateGuardianProfile(member.id, updates);

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsEditing(false);

        // Update local member state
        setMember(prev => prev ? { ...prev, ...updates } : null);

        Alert.alert('Success', 'Profile updated successfully');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      console.error('Save error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update profile');
    }

    setIsSaving(false);
  };

  const handleRemove = () => {
    if (!member) return;

    // Cannot remove self
    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    if (member.id === currentUserId) {
      Alert.alert('Cannot Remove', 'You cannot remove yourself from the family.');
      return;
    }

    if (!hasPermission('manageFamily')) {
      Alert.alert('Permission Denied', 'Only parents can remove family members');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Alert.alert(
      'Remove Family Member',
      `Are you sure you want to remove ${member.fullName}?\n\nTheir activity history will be preserved, but they will lose access to family data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const success = await removeMember(member.id);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  // ==================== PERMANENT IMAGE STORAGE ====================
  const getPermanentGuardianImagePath = (guardianId: string) => {
    const dir = FileSystem.documentDirectory + 'guardian_images/';
    return `${dir}${guardianId}_avatar_${Date.now()}.jpg`;
  };

  const ensureGuardianDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'guardian_images/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  };

  // FIXED: handleImagePick with proper image display and SDK 54+ compatibility
  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const tempUri = result.assets[0].uri;

      try {
        // COPY to permanent storage
        await ensureGuardianDirExists();
        const permanentUri = getPermanentGuardianImagePath(member?.id || 'temp');

        // Use copyAsync with fallback for SDK 54+
        try {
          await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
        } catch (copyError) {
          console.log('copyAsync failed, trying downloadAsync fallback');
          await FileSystem.downloadAsync(tempUri, permanentUri);
        }

        // Update local form state with permanent URI
        setFormData(prev => ({ ...prev, avatar: permanentUri }));

        // IMMEDIATELY persist to storage
        if (member) {
          const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;

          if (member.id === currentUserId) {
            // For current user, update through UserContext
            try {
              await updateProfile({ avatar: permanentUri });
              setMember(prev => prev ? { ...prev, avatar: permanentUri } : null);
            } catch (err) {
              console.log('UserContext update failed, using fallback');
            }
          }

          // Always update via FamilyContext
          const success = await updateGuardianProfile(member.id, { avatar: permanentUri });
          if (success) {
            setMember(prev => prev ? { ...prev, avatar: permanentUri } : null);
          }
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        Alert.alert('Photo Saved!', 'Profile picture saved permanently.');

      } catch (error) {
        console.error('Image save error:', error);
        Alert.alert('Error', 'Failed to save photo permanently');
      }
    }
  };

  const handleCall = async () => {
    if (!member?.phoneNumber) {
      Alert.alert('No Phone Number', 'This family member has no phone number on file.');
      return;
    }

    const phoneUrl = `tel:${member.phoneNumber.replace(/\s/g, '')}`;
    const canOpen = await Linking.canOpenURL(phoneUrl);

    if (canOpen) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Linking.openURL(phoneUrl);
    } else {
      Alert.alert('Error', 'Cannot open phone app');
    }
    setShowContactModal(false);
  };

  const handleEmail = async () => {
    if (!member?.email) {
      Alert.alert('No Email', 'This family member has no email on file.');
      return;
    }

    const emailUrl = `mailto:${member.email}`;
    const canOpen = await Linking.canOpenURL(emailUrl);

    if (canOpen) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Linking.openURL(emailUrl);
    } else {
      Alert.alert('Error', 'Cannot open email app');
    }
    setShowContactModal(false);
  };

  const handleMessage = async () => {
    if (!member?.phoneNumber) {
      Alert.alert('No Phone Number', 'This family member has no phone number for messaging.');
      return;
    }

    const smsUrl = `sms:${member.phoneNumber.replace(/\s/g, '')}`;
    const canOpen = await Linking.canOpenURL(smsUrl);

    if (canOpen) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Linking.openURL(smsUrl);
    } else {
      Alert.alert('Error', 'Cannot open messaging app');
    }
    setShowContactModal(false);
  };

  const handleShareContact = async () => {
    if (!member) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Share.share({
        message: `${member.fullName} - ${ROLE_LABELS[member.role] || member.role}\n${member.email || ''}\n${member.phoneNumber || ''}`,
        title: `${member.fullName}'s Contact Info`,
      });
    } catch (error) {
      console.error('Error sharing contact:', error);
    }
  };

  const getRoleConfig = () => {
    if (!member) return null;
    return ROLE_CONFIG[member.role] || ROLE_CONFIG[UserRole.VIEWER];
  };

  const roleConfig = getRoleConfig();

  // FIXED: Permission checks - current user CAN edit their own non-name fields
  const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
  const isCurrentUser = member?.id === currentUserId;

  // Can edit: either has manageFamily permission AND role allows editing, OR is current user editing self
  const canEdit = useMemo(() => {
    if (isCurrentUser) return true; // Self can always edit own profile (except name)
    return hasPermission('manageFamily') && roleConfig?.canEdit;
  }, [hasPermission, roleConfig, isCurrentUser]);

  const canRemove = useMemo(() => 
    hasPermission('manageFamily') && roleConfig?.canRemove && !isCurrentUser,
    [hasPermission, roleConfig, isCurrentUser]
  );

  const canManagePermissions = useMemo(() =>
    hasPermission('manageFamily') && !isCurrentUser,
    [hasPermission, isCurrentUser]
  );

  // FIXED: Show loading only briefly, not indefinitely
  if (!member || !roleConfig) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'activity':
        return (
          <Animated.View entering={FadeInUp} style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activities</Text>
              <View style={[styles.badge, { backgroundColor: roleConfig.color + '20' }]}>
                <Text style={[styles.badgeText, { color: roleConfig.color }]}>
                  {memberActivities.length} entries
                </Text>
              </View>
            </View>

            {isLoadingActivities ? (
              <View style={[styles.emptyCard, { paddingVertical: 40 }]}>
                <ActivityIndicator size="small" color={roleConfig.color} />
                <Text style={[styles.emptyText, isDark && styles.textMuted, { marginTop: 12 }]}>
                  Loading activities...
                </Text>
              </View>
            ) : memberActivities.length === 0 ? (
              <BlurView intensity={80} style={styles.emptyCard} tint={isDark ? 'dark' : 'light'}>
                <LinearGradient
                  colors={isDark ? ['rgba(40,40,45,0.9)', 'rgba(25,25,30,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.9)']}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="time-outline" size={48} color={isDark ? '#555' : '#ccc'} />
                <Text style={[styles.emptyText, isDark && styles.textMuted]}>
                  {isCurrentUser ? "You haven't recorded any activities yet" : `${member.fullName} hasn't recorded any activities yet`}
                </Text>
                <Text style={[styles.emptySubtext, isDark && styles.textMuted]}>
                  Activities will appear here when {isCurrentUser ? 'you' : 'they'} log entries for {currentBaby?.name || 'the baby'}
                </Text>
              </BlurView>
            ) : (
              <View style={styles.activitiesList}>
                {memberActivities.map((activity, index) => (
                  <ActivityCard 
                    key={activity.id} 
                    activity={activity} 
                    isDark={isDark} 
                    index={index}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        );

      case 'permissions':
        return (
          <Animated.View entering={FadeInUp} style={styles.tabContent}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Access Permissions</Text>
            <BlurView intensity={80} style={styles.permissionsCard} tint={isDark ? 'dark' : 'light'}>
              <LinearGradient
                colors={isDark ? ['rgba(40,40,45,0.9)', 'rgba(25,25,30,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.9)']}
                style={StyleSheet.absoluteFill}
              />
              <PermissionGrid 
                permissions={roleConfig.permissions} 
                roleColor={roleConfig.color}
                isDark={isDark}
              />
              <View style={styles.permissionNote}>
                <Ionicons name="information-circle" size={16} color={roleConfig.color} />
                <Text style={[styles.permissionNoteText, isDark && styles.textMuted]}>
                  These permissions are set by the {roleConfig.label} role and cannot be modified individually.
                </Text>
              </View>
            </BlurView>

            <Text style={[styles.sectionTitle, isDark && styles.textDark, { marginTop: 24 }]}>Activity Stats</Text>
            <View style={styles.statsGrid}>
              {/* FIXED: Real activity count */}
              <LinearGradient
                colors={roleConfig.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCard}
              >
                <Text style={styles.statValue}>{memberActivities.length}</Text>
                <Text style={styles.statLabel}>Activities</Text>
              </LinearGradient>

              {/* FIXED: Role priority */}
              <View style={[styles.statCard, isDark && styles.statCardDark, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.statValue, { color: roleConfig.color }]}>{roleConfig.priority}</Text>
                <Text style={[styles.statLabel, isDark && styles.textMuted]}>Role Priority</Text>
              </View>

              {/* FIXED: Real status based on lastActive */}
              <View style={[styles.statCard, isDark && styles.statCardDark, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.statValue, { color: member.lastActive ? '#10b981' : '#f59e0b' }]}>
                  {member.lastActive ? 'Active' : 'Pending'}
                </Text>
                <Text style={[styles.statLabel, isDark && styles.textMuted]}>Status</Text>
              </View>
            </View>

            {/* FIXED: Activity breakdown by type */}
            {memberActivities.length > 0 && (
              <View style={styles.activityBreakdown}>
                <Text style={[styles.breakdownTitle, isDark && styles.textDark]}>Activity Breakdown</Text>
                {Object.entries(
                  memberActivities.reduce((acc, act) => {
                    acc[act.type] = (acc[act.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => {
                    const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.default;
                    const percentage = Math.round((count / memberActivities.length) * 100);
                    return (
                      <View key={type} style={styles.breakdownRow}>
                        <View style={styles.breakdownLeft}>
                          <View style={[styles.breakdownIcon, { backgroundColor: config.color + '20' }]}>
                            <Ionicons name={config.icon as any} size={14} color={config.color} />
                          </View>
                          <Text style={[styles.breakdownLabel, isDark && styles.textDark]}>{config.label}</Text>
                        </View>
                        <View style={styles.breakdownRight}>
                          <View style={[styles.breakdownBar, { backgroundColor: config.color + '15' }]}>
                            <View style={[styles.breakdownFill, { 
                              backgroundColor: config.color, 
                              width: `${percentage}%` 
                            }]} />
                          </View>
                          <Text style={[styles.breakdownCount, { color: config.color }]}>{count}</Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}

            {canManagePermissions && (
              <TouchableOpacity 
                style={[styles.managePermissionsBtn, { backgroundColor: roleConfig.color + '15' }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowRoleModal(true);
                }}
              >
                <Ionicons name="shield-outline" size={20} color={roleConfig.color} />
                <Text style={[styles.managePermissionsText, { color: roleConfig.color }]}>
                  Manage Role & Permissions
                </Text>
                <Ionicons name="chevron-forward" size={20} color={roleConfig.color} />
              </TouchableOpacity>
            )}
          </Animated.View>
        );

      default:
        return (
          <>
            {/* Contact Information */}
            <Animated.View entering={FadeInUp.delay(200)} style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Contact Information</Text>
                {/* FIXED: Show contact button for everyone, but label differently for self */}
                {!isEditing && (member.phoneNumber || member.email) && (
                  <TouchableOpacity 
                    style={[styles.contactBtn, { backgroundColor: roleConfig.color + '15' }]}
                    onPress={() => setShowContactModal(true)}
                  >
                    <Ionicons name={isCurrentUser ? "person-outline" : "call-outline"} size={16} color={roleConfig.color} />
                    <Text style={[styles.contactBtnText, { color: roleConfig.color }]}>
                      {isCurrentUser ? 'Your Info' : 'Contact'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <BlurView intensity={80} style={styles.formCard} tint={isDark ? 'dark' : 'light'}>
                <LinearGradient
                  colors={isDark ? ['rgba(40,40,45,0.9)', 'rgba(25,25,30,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.9)']}
                  style={StyleSheet.absoluteFill}
                />

                {/* Full Name - Read only for self, editable for others */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && styles.textDark]}>Full Name</Text>
                  {isCurrentUser ? (
                    <View style={styles.readOnlyField}>
                      <Ionicons name="lock-closed" size={16} color={isDark ? '#666' : '#999'} style={styles.inputIcon} />
                      <Text style={[styles.readOnlyText, isDark && styles.textDark]}>
                        {formData.fullName}
                      </Text>
                      <View style={styles.ownedBadge}>
                        <Text style={styles.ownedBadgeText}>You</Text>
                      </View>
                    </View>
                  ) : (
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark]}
                      value={formData.fullName}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                      placeholder="Enter full name"
                      placeholderTextColor={isDark ? '#666' : '#999'}
                      editable={isEditing}
                    />
                  )}
                </View>

                <View style={styles.inputDivider} />

                {/* Email - Editable for all when editing */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && styles.textDark]}>Email</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="mail" size={16} color={isDark ? '#666' : '#999'} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark, styles.flexInput]}
                      value={formData.email}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                      placeholder="Enter email address"
                      placeholderTextColor={isDark ? '#666' : '#999'}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={isEditing}
                    />
                  </View>
                </View>

                <View style={styles.inputDivider} />

                {/* Phone - Editable for all when editing */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && styles.textDark]}>Phone Number</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="call" size={16} color={isDark ? '#666' : '#999'} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark, styles.flexInput]}
                      value={formData.phoneNumber}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
                      placeholder="Enter phone number"
                      placeholderTextColor={isDark ? '#666' : '#999'}
                      keyboardType="phone-pad"
                      editable={isEditing}
                    />
                  </View>
                </View>

                <View style={styles.inputDivider} />

                {/* Relationship - Editable for all when editing */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && styles.textDark]}>Relationship</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="people" size={16} color={isDark ? '#666' : '#999'} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark, styles.flexInput]}
                      value={formData.relationship}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, relationship: text }))}
                      placeholder="e.g., Grandma, Uncle, Nanny"
                      placeholderTextColor={isDark ? '#666' : '#999'}
                      editable={isEditing}
                    />
                  </View>
                </View>

                {isEditing && (
                  <>
                    <View style={styles.inputDivider} />
                    <View style={styles.toggleRow}>
                      <View style={styles.toggleInfo}>
                        <Ionicons 
                          name={formData.notificationsEnabled ? "notifications" : "notifications-off"} 
                          size={20} 
                          color={formData.notificationsEnabled ? "#667eea" : isDark ? "#555" : "#999"} 
                          style={styles.toggleIcon}
                        />
                        <View>
                          <Text style={[styles.toggleLabel, isDark && styles.textDark]}>Notifications</Text>
                          <Text style={[styles.toggleDescription, isDark && styles.textMuted]}>
                            Receive alerts about family activities
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={formData.notificationsEnabled}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, notificationsEnabled: val }))}
                        trackColor={{ false: isDark ? '#333' : '#ddd', true: '#667eea' }}
                        thumbColor="#fff"
                      />
                    </View>
                  </>
                )}
              </BlurView>
            </Animated.View>

            {/* Activity Summary */}
            <Animated.View entering={FadeInUp.delay(300)} style={styles.formSection}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Activity Summary</Text>
              <BlurView intensity={80} style={styles.infoCard} tint={isDark ? 'dark' : 'light'}>
                <LinearGradient
                  colors={isDark ? ['rgba(40,40,45,0.9)', 'rgba(25,25,30,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.9)']}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.infoItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#667eea20' }]}>
                    <Ionicons name="time-outline" size={20} color="#667eea" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Last Active</Text>
                    <Text style={[styles.infoValue, isDark && styles.textDark]}>
                      {member.lastActive 
                        ? `${new Date(member.lastActive).toLocaleString()} (Active)`
                        : 'Never logged in'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#10b98120' }]}>
                    <Ionicons name="calendar-outline" size={20} color="#10b981" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Added On</Text>
                    <Text style={[styles.infoValue, isDark && styles.textDark]}>
                      {new Date(member.addedAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoItem}>
                  <View style={[styles.infoIcon, { backgroundColor: '#f59e0b20' }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Security Status</Text>
                    <View style={styles.securityStatus}>
                      <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                      <Text style={[styles.infoValue, isDark && styles.textDark]}>Verified Account</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoItem}>
                  <View style={[styles.infoIcon, { backgroundColor: roleConfig.color + '20' }]}>
                    <Ionicons name={roleConfig.icon as any} size={20} color={roleConfig.color} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, isDark && styles.textMuted]}>Role Assignment</Text>
                    <Text style={[styles.infoValue, isDark && styles.textDark, { color: roleConfig.color }]}>
                      {roleConfig.label}
                    </Text>
                  </View>
                </View>
              </BlurView>
            </Animated.View>
          </>
        );
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} 
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={FadeInDown} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, isDark && styles.textDark]} numberOfLines={1}>
            {isEditing ? 'Edit Profile' : member.fullName}
          </Text>

          {/* FIXED: Show edit button for current user too */}
          {canEdit && (
            <TouchableOpacity 
              onPress={() => isEditing ? handleSave() : setIsEditing(true)} 
              style={[styles.headerBtn, isEditing ? styles.saveBtn : styles.editBtn]}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons 
                  name={isEditing ? "checkmark" : "create-outline"} 
                  size={20} 
                  color="#fff" 
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section - FIXED: Using AvatarDisplay component */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.avatarSection}>
          <AvatarDisplay
            avatar={formData.avatar || member.avatar}
            role={member.role}
            size={120}
            showEdit={isEditing}
            onPress={isEditing ? handleImagePick : undefined}
          />

          <LinearGradient
            colors={roleConfig.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.roleBadge}
          >
            <Ionicons name={roleConfig.icon as any} size={14} color="#fff" />
            <Text style={styles.roleText}>{roleConfig.label}</Text>
          </LinearGradient>

          <Text style={[styles.memberName, isDark && styles.textDark]}>
            {member.fullName}
          </Text>

          <Text style={[styles.roleDescription, isDark && styles.textMuted]}>
            {roleConfig.description}
          </Text>

          {!isEditing && (
            <View style={styles.quickActions}>
              {/* FIXED: Only show Message button for others, not self */}
              {!isCurrentUser && (
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('FamilyChat', {
                  memberId: member.id,
                  memberName: member.fullName,
                  memberAvatar: member.avatar,
                  memberRole: member.role,
                })}>
                  <LinearGradient colors={roleConfig.gradient} style={styles.quickActionGradient}>
                    <Ionicons name="chatbubble" size={20} color="#fff" />
                    <Text style={styles.quickActionText}>Message</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowContactModal(true)}>
                <View style={[
                  styles.quickActionGradient, 
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                ]}>
                  <Ionicons name={isCurrentUser ? "person" : "call"} size={20} color={isDark ? '#fff' : '#1a1a1a'} />
                  <Text style={[styles.quickActionText, { color: isDark ? '#fff' : '#1a1a1a' }]}>
                    {isCurrentUser ? 'Your Info' : 'Call'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionBtn} onPress={handleShareContact}>
                <View style={[
                  styles.quickActionGradient, 
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                ]}>
                  <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Tab Navigation */}
        {!isEditing && (
          <Animated.View entering={FadeInUp} style={styles.tabContainer}>
            {(['info', 'activity', 'permissions'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && [styles.activeTab, { borderColor: roleConfig.color, backgroundColor: roleConfig.color + '10' }],
                  isDark && styles.tabDark
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab);
                }}
              >
                <Ionicons 
                  name={
                    tab === 'info' ? 'person-outline' : 
                    tab === 'activity' ? 'time-outline' : 'shield-outline'
                  } 
                  size={16} 
                  color={activeTab === tab ? roleConfig.color : isDark ? '#94a3b8' : '#64748b'} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.tabText,
                  activeTab === tab && { color: roleConfig.color, fontWeight: '700' },
                  isDark && styles.tabTextDark
                ]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Tab Content */}
        {renderTabContent()}

        {/* Actions */}
        {canEdit && !isEditing && (
          <Animated.View entering={FadeInUp.delay(500)} style={styles.actionsSection}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setIsEditing(true)}
            >
              <LinearGradient colors={roleConfig.gradient} style={styles.actionGradient}>
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.actionText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>

            {canRemove && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.removeButton]}
                onPress={handleRemove}
              >
                <View style={styles.removeButtonContent}>
                  <Ionicons name="trash-outline" size={20} color="#ff4757" />
                  <Text style={styles.removeText}>Remove from Family</Text>
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {isEditing && (
          <Animated.View entering={FadeInUp.delay(500)} style={styles.actionsSection}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <LinearGradient colors={roleConfig.gradient} style={styles.actionGradient}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.actionText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setIsEditing(false)}
              disabled={isSaving}
            >
              <View style={styles.cancelButtonContent}>
                <Ionicons name="close" size={20} color={isDark ? '#fff' : '#1a1a1a'} />
                <Text style={[styles.cancelText, isDark && styles.textDark]}>Cancel</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </AnimatedScrollView>

      {/* Contact Modal - FIXED: Different title for self */}
      <ActionModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        title={isCurrentUser ? 'Your Contact Info' : `Contact ${member.fullName}`}
        isDark={isDark}
      >
        <View style={styles.contactOptions}>
          {/* FIXED: Show phone number prominently for self */}
          {isCurrentUser && member.phoneNumber && (
            <View style={styles.selfPhoneDisplay}>
              <Ionicons name="call" size={20} color="#10b981" />
              <Text style={[styles.selfPhoneText, isDark && styles.textDark]}>
                {member.phoneNumber}
              </Text>
              <Text style={[styles.selfPhoneLabel, isDark && styles.textMuted]}>
                Your registered number
              </Text>
            </View>
          )}

          {member.phoneNumber && (
            <>
              <TouchableOpacity style={styles.contactOption} onPress={handleCall}>
                <View style={[styles.contactIcon, { backgroundColor: '#10b98120' }]}>
                  <Ionicons name="call" size={24} color="#10b981" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactLabel, isDark && styles.textDark]}>
                    {isCurrentUser ? 'Call Your Number' : 'Phone Call'}
                  </Text>
                  <Text style={[styles.contactValue, isDark && styles.textMuted]}>{member.phoneNumber}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.contactOption} onPress={handleMessage}>
                <View style={[styles.contactIcon, { backgroundColor: '#667eea20' }]}>
                  <Ionicons name="chatbubble" size={24} color="#667eea" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactLabel, isDark && styles.textDark]}>
                    {isCurrentUser ? 'Message Your Number' : 'Send Message'}
                  </Text>
                  <Text style={[styles.contactValue, isDark && styles.textMuted]}>SMS/Text</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
              </TouchableOpacity>
            </>
          )}

          {member.email && (
            <TouchableOpacity style={styles.contactOption} onPress={handleEmail}>
              <View style={[styles.contactIcon, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="mail" size={24} color="#f59e0b" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, isDark && styles.textDark]}>Email</Text>
                <Text style={[styles.contactValue, isDark && styles.textMuted]}>{member.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.contactOption} onPress={handleShareContact}>
            <View style={[styles.contactIcon, { backgroundColor: '#ec489920' }]}>
              <Ionicons name="share" size={24} color="#ec4899" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, isDark && styles.textDark]}>Share Contact</Text>
              <Text style={[styles.contactValue, isDark && styles.textMuted]}>Export contact info</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
          </TouchableOpacity>
        </View>
      </ActionModal>

      {/* Role Management Modal */}
      <ActionModal
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Manage Role"
        isDark={isDark}
      >
        <View style={styles.roleOptions}>
          {Object.entries(ROLE_CONFIG).map(([role, config]) => (
            <TouchableOpacity 
              key={role}
              style={[
                styles.roleOption,
                member.role === role && { backgroundColor: config.color + '15', borderColor: config.color }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert('Change Role', `Change ${member.fullName} to ${config.label}?`);
                setShowRoleModal(false);
              }}
            >
              <LinearGradient
                colors={config.gradient}
                style={styles.roleOptionIcon}
              >
                <Ionicons name={config.icon as any} size={20} color="#fff" />
              </LinearGradient>
              <View style={styles.roleOptionInfo}>
                <Text style={[styles.roleOptionTitle, isDark && styles.textDark]}>{config.label}</Text>
                <Text style={[styles.roleOptionDesc, isDark && styles.textMuted]}>{config.description}</Text>
              </View>
              {member.role === role && (
                <Ionicons name="checkmark-circle" size={24} color={config.color} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  containerDark: { backgroundColor: '#0a0a0a' },
  centered: { justifyContent: 'center', alignItems: 'center' },

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
  editBtn: { backgroundColor: '#667eea' },
  saveBtn: { backgroundColor: '#10b981' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarEmoji: {
    fontSize: 60,
  },
  editAvatarOverlay: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  memberName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  activeTab: {
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  tabTextDark: {
    color: '#94a3b8',
  },
  tabContent: {
    marginBottom: 20,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Form Section
  formSection: {
    marginBottom: 20,
  },
  formCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inputGroup: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
  },
  inputDark: {
    color: '#ffffff',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginRight: 8,
  },
  flexInput: {
    flex: 1,
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 16,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  ownedBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleIcon: {
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },

  // Contact Button
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Activity Cards
  activitiesList: {
    gap: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activityCardDark: {
    backgroundColor: 'rgba(30,30,35,0.9)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activityTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 250,
  },

  // Permissions
  permissionsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
  },
  permissionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  permissionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  permissionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    gap: 8,
  },
  permissionNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  managePermissionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
  },
  managePermissionsText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statCardDark: {
    backgroundColor: 'rgba(30,30,35,0.9)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },

  // NEW: Activity Breakdown
  activityBreakdown: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  breakdownIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  breakdownBar: {
    height: 6,
    borderRadius: 3,
    flex: 1,
    marginRight: 10,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownCount: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'right',
  },

  // Info Section
  infoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  securityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 16,
  },

  // Actions Section
  actionsSection: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  editButton: {},
  saveButton: {},
  removeButton: {
    backgroundColor: 'rgba(255,71,87,0.1)',
  },
  removeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  removeText: {
    color: '#ff4757',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  cancelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: width - 40,
    maxHeight: height * 0.7,
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

  // Contact Modal
  contactOptions: {
    padding: 20,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 13,
    color: '#64748b',
  },
  // NEW: Self phone display
  selfPhoneDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 16,
  },
  selfPhoneText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 8,
  },
  selfPhoneLabel: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },

  // Role Modal
  roleOptions: {
    padding: 20,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  roleOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleOptionInfo: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  roleOptionDesc: {
    fontSize: 13,
    color: '#64748b',
  },
});