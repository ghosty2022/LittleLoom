import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  Platform,
  ActivityIndicator,
  Share,
  Dimensions,
  Switch,
  Modal,
  Linking,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { UserRole, ROLE_LABELS } from '../../types/roles';
import { useFamily, FamilyMember } from '../../context/FamilyContext';
import { useUser } from '../../context/UserContext';
import { useBaby, ActivityEntry } from '../../context/BabyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { SafeAvatar } from '../../components/SafeAvatar';
import { AutoHideScrollView, AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';

type EditGuardianScreenProps = NativeStackScreenProps<RootStackParamList, 'EditGuardian'>;

const AnimatedScrollView = AutoHideAnimatedScrollView;
const { width, height } = Dimensions.get('window');

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

const ActivityCard: React.FC<{
  activity: ActivityEntry;
  isDark: boolean;
  index: number;
  reduceMotion: boolean;
}> = ({ activity, isDark, index, reduceMotion }) => {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.default;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.delay(index * 50)}
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

const PermissionGrid: React.FC<{
  permissions: string[];
  roleColor: string;
  isDark: boolean;
  reduceMotion: boolean;
}> = ({ permissions, roleColor, isDark, reduceMotion }) => {
  return (
    <View style={styles.permissionGrid}>
      {permissions.map((permission, index) => (
        <Animated.View
          key={permission}
          entering={reduceMotion ? undefined : FadeIn.delay(index * 50)}
          style={[
            styles.permissionChip,
            { backgroundColor: roleColor + '15', borderColor: roleColor + '30' },
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

export default function EditGuardianScreen({ navigation, route }: EditGuardianScreenProps) {
  const { guardianId, mode = 'guardian', fromChat = false } = route.params;
  const { members, guardians, updateGuardianProfile, removeMember, loadFamily } = useFamily();
  const { hasPermission, profile, updateProfile } = useUser();
  const { currentBaby, babies, getRecentActivities } = useBaby();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    themeColors,
    shouldReduceMotion,
    triggerHaptic,
    spinnerColor,
  } = useCustomization();

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

  const dynamicPrimaryColor = themeColors.primary;
  const dynamicGradient = [themeColors.primary, themeColors.secondary] as [string, string];

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  useEffect(() => {
    console.log('Looking for member with ID:', guardianId);
    console.log('Available members:', members.map(m => ({ id: m.id, name: m.fullName, role: m.role })));

    let found = members.find(m => m.id === guardianId);

    if (!found) {
      const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
      console.log('Member not found in array. Current user ID:', currentUserId);

      if (guardianId === currentUserId || guardianId === 'parent1') {
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

      loadMemberActivities(found.id, found.userId);
    } else {
      console.log('Member not found and not current user');
    }
  }, [members, guardianId, currentBaby, userProfile, profile]);

  const loadMemberActivities = useCallback(async (memberId: string, memberUserId?: string) => {
    if (!currentBaby) return;

    setIsLoadingActivities(true);

    try {
      const allActivities = getRecentActivities(50);

      const memberActs = allActivities.filter(a => {
        if (a.loggedBy === memberId) return true;
        if (memberUserId && a.loggedBy === memberUserId) return true;
        if (member && a.loggedByName === member.fullName) return true;
        return false;
      });

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

  const handleSave = async () => {
    if (!member) return;

    if (!formData.fullName.trim()) {
      Alert.alert('Error', 'Name is required');
      triggerHaptic('error');
      return;
    }

    setIsSaving(true);
    triggerHaptic('medium');

    const updates: Partial<FamilyMember> = {};

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

      success = await updateGuardianProfile(member.id, updates);

      if (success) {
        triggerHaptic('success');
        setIsEditing(false);
        setMember(prev => prev ? { ...prev, ...updates } : null);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        triggerHaptic('error');
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      console.error('Save error:', error);
      triggerHaptic('error');
      Alert.alert('Error', 'Failed to update profile');
    }

    setIsSaving(false);
  };

  const handleRemove = () => {
    if (!member) return;

    const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
    if (member.id === currentUserId) {
      Alert.alert('Cannot Remove', 'You cannot remove yourself from the family.');
      return;
    }

    if (!hasPermission('manageFamily')) {
      Alert.alert('Permission Denied', 'Only parents can remove family members');
      triggerHaptic('error');
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
            triggerHaptic('error');
            const success = await removeMember(member.id);
            if (success) {
              triggerHaptic('success');
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

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
        await ensureGuardianDirExists();
        const permanentUri = getPermanentGuardianImagePath(member?.id || 'temp');

        try {
          await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
        } catch (copyError) {
          console.log('copyAsync failed, trying downloadAsync fallback');
          await FileSystem.downloadAsync(tempUri, permanentUri);
        }

        setFormData(prev => ({ ...prev, avatar: permanentUri }));

        if (member) {
          const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;

          if (member.id === currentUserId) {
            try {
              await updateProfile({ avatar: permanentUri });
              setMember(prev => prev ? { ...prev, avatar: permanentUri } : null);
            } catch (err) {
              console.log('UserContext update failed, using fallback');
            }
          }

          const success = await updateGuardianProfile(member.id, { avatar: permanentUri });
          if (success) {
            setMember(prev => prev ? { ...prev, avatar: permanentUri } : null);
          }
        }

        triggerHaptic('light');
        triggerHaptic('success');

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
      triggerHaptic('medium');
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
      triggerHaptic('medium');
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
      triggerHaptic('medium');
      await Linking.openURL(smsUrl);
    } else {
      Alert.alert('Error', 'Cannot open messaging app');
    }
    setShowContactModal(false);
  };

  const handleShareContact = async () => {
    if (!member) return;
    try {
      triggerHaptic('medium');
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

  const currentUserId = userProfile?.id || userProfile?.uid || profile?.id;
  const isCurrentUser = member?.id === currentUserId;

  const canEdit = useMemo(() => {
    if (isCurrentUser) return true;
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

  if (!member || !roleConfig) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.centered]}>
        <ActivityIndicator size="large" color={spinnerColor} />
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
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabContent}>
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
                <ActivityIndicator size="small" color={spinnerColor} />
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
                    reduceMotion={shouldReduceMotion}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        );

      case 'permissions':
        return (
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabContent}>
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
                reduceMotion={shouldReduceMotion}
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
              <LinearGradient
                colors={roleConfig.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCard}
              >
                <Text style={styles.statValue}>{memberActivities.length}</Text>
                <Text style={styles.statLabel}>Activities</Text>
              </LinearGradient>

              <View style={[styles.statCard, isDark && styles.statCardDark, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.statValue, { color: roleConfig.color }]}>{roleConfig.priority}</Text>
                <Text style={[styles.statLabel, isDark && styles.textMuted]}>Role Priority</Text>
              </View>

              <View style={[styles.statCard, isDark && styles.statCardDark, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={[styles.statValue, { color: member.lastActive ? '#10b981' : '#f59e0b' }]}>
                  {member.lastActive ? 'Active' : 'Pending'}
                </Text>
                <Text style={[styles.statLabel, isDark && styles.textMuted]}>Status</Text>
              </View>
            </View>

            {memberActivities.length > 0 && (
              <View style={styles.activityBreakdown}>
                <Text style={[styles.breakdownTitle, isDark && styles.textDark]}>Activity Breakdown</Text>
                {Object.entries(
                  memberActivities.reduce((acc, act) => {
                    acc[act.type] = (acc[act.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort(([, a], [, b]) => b - a)
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
                            <View style={[
                              styles.breakdownFill,
                              {
                                backgroundColor: config.color,
                                width: `${percentage}%`,
                              }
                            ]} />
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
                  triggerHaptic('light');
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
            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(200)} style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Contact Information</Text>
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

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark && styles.textDark]}>Full Name</Text>
                  {isCurrentUser ? (
                    <View style={styles.readOnlyField}>
                      <Ionicons name="lock-closed" size={16} color={isDark ? '#666' : '#999'} style={styles.inputIcon} />
                      <Text style={[styles.readOnlyText, isDark && styles.textDark]}>
                        {formData.fullName}
                      </Text>
                      <View style={[styles.ownedBadge, { backgroundColor: dynamicPrimaryColor }]}>
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
                          color={formData.notificationsEnabled ? dynamicPrimaryColor : isDark ? "#555" : "#999"}
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
                        trackColor={{ false: isDark ? '#333' : '#ddd', true: dynamicPrimaryColor }}
                        thumbColor="#fff"
                      />
                    </View>
                  </>
                )}
              </BlurView>
            </Animated.View>

            <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(300)} style={styles.formSection}>
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Activity Summary</Text>
              <BlurView intensity={80} style={styles.infoCard} tint={isDark ? 'dark' : 'light'}>
                <LinearGradient
                  colors={isDark ? ['rgba(40,40,45,0.9)', 'rgba(25,25,30,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.9)']}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.infoItem}>
                  <View style={[styles.infoIcon, { backgroundColor: dynamicPrimaryColor + '20' }]}>
                    <Ionicons name="time-outline" size={20} color={dynamicPrimaryColor} />
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
      <StatusBar barStyle={isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={shouldReduceMotion ? undefined : FadeInDown} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, isDark && styles.textDark]} numberOfLines={1}>
            {isEditing ? 'Edit Profile' : member.fullName}
          </Text>

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
        {/* Avatar Section */}
        <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(100)} style={styles.avatarSection}>
          <SafeAvatar
            avatar={formData.avatar || member.avatar}
            size={120}
            fallbackIcon={roleConfig.icon as any}
            fallbackColor={roleConfig.color}
            fallbackBgColor={roleConfig.color + '20'}
            borderColor="#fff"
            borderWidth={3}
            showEditBadge={isEditing}
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
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp} style={styles.tabContainer}>
            {(['info', 'activity', 'permissions'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && [styles.activeTab, { borderColor: dynamicPrimaryColor, backgroundColor: dynamicPrimaryColor + '10' }],
                  isDark && styles.tabDark
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setActiveTab(tab);
                }}
              >
                <Ionicons
                  name={
                    tab === 'info' ? 'person-outline' :
                    tab === 'activity' ? 'time-outline' : 'shield-outline'
                  }
                  size={16}
                  color={activeTab === tab ? dynamicPrimaryColor : isDark ? '#94a3b8' : '#64748b'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.tabText,
                  activeTab === tab && { color: dynamicPrimaryColor, fontWeight: '700' },
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
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(500)} style={styles.actionsSection}>
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
          <Animated.View entering={shouldReduceMotion ? undefined : FadeInUp.delay(500)} style={styles.actionsSection}>
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

      {/* Contact Modal */}
      <ActionModal
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        title={isCurrentUser ? 'Your Contact Info' : `Contact ${member.fullName}`}
        isDark={isDark}
      >
        <View style={styles.contactOptions}>
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
                triggerHaptic('medium');
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
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#0a0a0a',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  saveBtn: {
    backgroundColor: '#10b981',
  },
  editBtn: {
    backgroundColor: '#667eea',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  memberName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  roleDescription: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  quickActionBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabDark: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeTab: {
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextDark: {
    color: '#94a3b8',
  },
  tabContent: {
    marginBottom: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
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
  formCard: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
  infoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#64748b',
  },
  input: {
    fontSize: 16,
    paddingVertical: 10,
    color: '#1a1a1a',
  },
  inputDark: {
    color: '#fff',
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
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  readOnlyText: {
    fontSize: 16,
    flex: 1,
  },
  ownedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  ownedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  inputDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 4,
  },
  securityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  activitiesList: {
    gap: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  activityCardDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  activityDetails: {
    fontSize: 13,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    marginTop: 4,
  },
  activityTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  activityTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  permissionsCard: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  permissionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  permissionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  permissionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  permissionNoteText: {
    fontSize: 12,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  activityBreakdown: {
    marginTop: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  breakdownIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  breakdownRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  managePermissionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  managePermissionsText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10,
  },
  actionsSection: {
    marginTop: 20,
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  removeButton: {
    borderWidth: 1,
    borderColor: '#ff4757',
    backgroundColor: 'transparent',
  },
  removeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  removeText: {
    color: '#ff4757',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent',
  },
  cancelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
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
  contactOptions: {
    padding: 16,
    gap: 8,
  },
  selfPhoneDisplay: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
  },
  selfPhoneText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  selfPhoneLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  contactValue: {
    fontSize: 13,
    marginTop: 2,
  },
  roleOptions: {
    padding: 16,
    gap: 8,
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
  roleOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleOptionInfo: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  roleOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  textDark: {
    color: '#fff',
  },
  textMuted: {
    color: '#94a3b8',
  },
});