import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Share,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeInUp, 
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
  SlideInRight,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useFamily, FamilyMember } from '../context/FamilyContext';
import { useBaby } from '../context/BabyContext';
import { useActivity } from '../context/ActivityContext';
import { useUser } from '../context/UserContext';
import { useFamilyChat } from '../context/FamilyChatContext';
import { UserRole } from '../types/roles';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type FamilySharingScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilySharing'>;

const { width } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ==================== NOTIFICATION SYSTEM (FROM HOMESCREEN) ====================

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const SweetAlert = memo(({ visible, type, title, message, onClose, isDark }: AlertState & { onClose: () => void; isDark: boolean }) => {
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
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle', bg: 'rgba(17, 153, 142, 0.1)' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle', bg: 'rgba(239, 68, 68, 0.1)' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle', bg: 'rgba(59, 130, 246, 0.1)' },
    warning: { colors: ['#f59e0b', '#fbbf24'], icon: 'warning', bg: 'rgba(245, 158, 11, 0.1)' },
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
});

// ==================== COMPACT CARD COMPONENT ====================

interface CompactCardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  delay?: number;
}

const CompactCard = memo(({ children, style, onPress, delay = 0 }: CompactCardProps) => {
  const isDark = useColorScheme() === 'dark';
  
  return (
    <Animated.View entering={FadeInUp.delay(delay)} style={[styles.card, style]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.cardBlur}>
          <LinearGradient
            colors={isDark ? ['rgba(40,40,45,0.9)', 'rgba(25,25,30,0.8)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.9)']}
            style={StyleSheet.absoluteFill}
          />
          {children}
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ==================== MEMBER AVATAR COMPONENT ====================

interface MemberAvatarProps {
  member: FamilyMember;
  size?: number;
}

const MemberAvatar = memo(({ member, size = 44 }: MemberAvatarProps) => {
  const roleColors: Record<string, [string, string]> = {
    [UserRole.PARENT_1]: ['#667eea', '#764ba2'],
    [UserRole.PARENT_2]: ['#fa709a', '#fee140'],
    [UserRole.GUARDIAN]: ['#11998e', '#38ef7d'],
    [UserRole.VIEWER]: ['#64748b', '#94a3b8'],
  };

  const colors = roleColors[member.role] || roleColors[UserRole.VIEWER];
  
  return (
    <LinearGradient colors={colors} style={[styles.avatar, { width: size, height: size, borderRadius: size / 3 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
        {member.avatar || member.fullName.charAt(0)}
      </Text>
    </LinearGradient>
  );
});

// ==================== ADD MEMBER MODAL ====================

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (email: string, role: UserRole, relationship: string) => void;
  isDark: boolean;
}

const AddMemberModal = memo(({ visible, onClose, onAdd, isDark }: AddMemberModalProps) => {
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.GUARDIAN);
  const [relationship, setRelationship] = useState('');

  const roles = useMemo(() => [
    { role: UserRole.PARENT_2, label: 'Co-Parent', icon: 'heart', color: '#fa709a', desc: 'Full access, can manage family' },
    { role: UserRole.GUARDIAN, label: 'Guardian', icon: 'shield-checkmark', color: '#11998e', desc: 'Can add entries, cannot delete' },
    { role: UserRole.VIEWER, label: 'Viewer', icon: 'eye', color: '#64748b', desc: 'View only, cannot add entries' },
  ], []);

  const handleAdd = useCallback(() => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    if (!relationship.trim()) {
      Alert.alert('Error', 'Please specify the relationship');
      return;
    }
    onAdd(email.trim(), selectedRole, relationship.trim());
    setEmail('');
    setRelationship('');
    onClose();
  }, [email, relationship, selectedRole, onAdd, onClose]);

  const handleClose = useCallback(() => {
    setEmail('');
    setRelationship('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={90} style={[styles.modalContent, isDark && styles.modalContentDark]} tint={isDark ? 'dark' : 'light'}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>Add Family Member</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder="Email address"
              placeholderTextColor={isDark ? '#666' : '#999'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder="Relationship (e.g., Grandma, Uncle)"
              placeholderTextColor={isDark ? '#666' : '#999'}
              value={relationship}
              onChangeText={setRelationship}
            />

            <Text style={[styles.sectionLabel, isDark && styles.textDark]}>Select Role</Text>
            
            {roles.map((item) => (
              <TouchableOpacity
                key={item.role}
                style={[
                  styles.roleOption,
                  selectedRole === item.role && { borderColor: item.color, backgroundColor: item.color + '10' },
                  isDark && styles.roleOptionDark
                ]}
                onPress={() => setSelectedRole(item.role)}
              >
                <View style={[styles.roleIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.roleInfo}>
                  <Text style={[styles.roleLabel, isDark && styles.textDark]}>{item.label}</Text>
                  <Text style={styles.roleDesc}>{item.desc}</Text>
                </View>
                {selectedRole === item.role && (
                  <Ionicons name="checkmark-circle" size={24} color={item.color} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addButtonGradient}>
                <Text style={styles.addButtonText}>Send Invitation</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
});

// ==================== MAIN SCREEN ====================

export default function FamilySharingScreen({ navigation }: FamilySharingScreenProps) {
  const { userProfile, signOut } = useAuth();
  const { members, parent1, parent2, guardians, loadFamily, removeMember, inviteMember } = useFamily();
  const { currentBaby, babies } = useBaby();
  const { getRecentTimelineEvents, entries } = useActivity();
  const { hasPermission } = useUser();
  const { getUnreadCount, getFamilyCode } = useFamilyChat();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });

  // Memoized values to prevent unnecessary re-renders
  const unreadCount = useMemo(() => getUnreadCount(), [getUnreadCount]);
  const familyCode = useMemo(() => getFamilyCode() || `LOOM-${userProfile?.id?.slice(0, 4).toUpperCase() || '7842'}`, [getFamilyCode, userProfile?.id]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadFamily();
    setRefreshing(false);
  }, [loadFamily]);

  // Memoized recent activities
  const recentActivities = useMemo(() => {
    return getRecentTimelineEvents(5).map(entry => ({
      id: entry.id,
      userName: entry.loggedByName || 'Unknown',
      action: entry.title,
      timestamp: entry.timestamp,
      emoji: entry.icon || '📝',
      type: entry.type,
    }));
  }, [getRecentTimelineEvents]);

  // Memoized stats
  const familyStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      totalEntries: entries.length,
      todayEntries: entries.filter(e => e.timestamp >= today.getTime()).length,
    };
  }, [entries]);

  // Optimized handlers with useCallback
  const handleCopyCode = useCallback(() => {
    Share.share({
      message: `Join my family on LittleLoom! Use code: ${familyCode}\n\nTrack baby's moments together and chat with the family.`,
      title: 'Join My Family on LittleLoom',
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAlert({ visible: true, type: 'success', title: 'Copied!', message: 'Family code copied to clipboard' });
  }, [familyCode]);

  const handleInvite = useCallback(() => {
    if (!hasPermission('manageFamily')) {
      setAlert({ visible: true, type: 'error', title: 'Permission Denied', message: 'Only parents can invite family members.' });
      return;
    }
    setShowAddModal(true);
  }, [hasPermission]);

  const handleAddMember = useCallback(async (email: string, role: UserRole, relationship: string) => {
    const success = await inviteMember(email, role, relationship);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlert({ visible: true, type: 'success', title: 'Invitation Sent', message: `An invitation has been sent to ${email}` });
    } else {
      setAlert({ visible: true, type: 'error', title: 'Failed', message: 'Could not send invitation. Please try again.' });
    }
  }, [inviteMember]);

  const handleRemoveMember = useCallback((member: FamilyMember) => {
    if (!hasPermission('manageFamily')) {
      setAlert({ visible: true, type: 'error', title: 'Permission Denied', message: 'Only parents can remove family members.' });
      return;
    }
    
    if (member.role === UserRole.PARENT_1) {
      setAlert({ visible: true, type: 'warning', title: 'Cannot Remove', message: 'Primary parent cannot be removed.' });
      return;
    }
    
    Alert.alert(
      'Remove Family Member',
      `Remove ${member.fullName}?\n\nTheir activity history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeMember(member.id);
            if (success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setAlert({ visible: true, type: 'success', title: 'Removed', message: `${member.fullName} has been removed from the family` });
            }
          },
        },
      ]
    );
  }, [hasPermission, removeMember]);

  const handleLeaveFamily = useCallback(() => {
    Alert.alert(
      'Leave Family',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: signOut }
      ]
    );
  }, [signOut]);

  // ==================== NAVIGATION HANDLERS (OPTIMIZED) ====================
  
  // ALL profiles (Parent1, Parent2, Guardians) go to EditGuardian
  // Only Baby goes to EditProfile
  const handleMemberPress = useCallback((member: FamilyMember, isYou: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Determine the mode based on role
    let mode: 'guardian' | 'parent2' | 'viewer' = 'guardian';
    if (member.role === UserRole.PARENT_2) mode = 'parent2';
    else if (member.role === UserRole.VIEWER) mode = 'viewer';
    
    // All adult profiles go to EditGuardian screen
    navigation.navigate('EditGuardian', { 
      guardianId: member.id,
      mode,
      fromChat: false
    });
  }, [navigation]);

  const handleBabyPress = useCallback(() => {
    if (babies.length > 1) {
      navigation.navigate('SwitchBaby');
    } else if (currentBaby) {
      navigation.navigate('EditProfile', { 
        mode: 'baby', 
        babyId: currentBaby.id 
      });
    }
  }, [babies.length, currentBaby, navigation]);

  const handleChatPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('FamilyChatList');
  }, [navigation]);

  const handleTimelinePress = useCallback(() => {
    navigation.navigate('Timeline');
  }, [navigation]);

  const handleRemindersPress = useCallback(() => {
    navigation.navigate('Reminders');
  }, [navigation]);

  const handleSwitchBabyPress = useCallback(() => {
    navigation.navigate('SwitchBaby');
  }, [navigation]);

  // ==================== HELPER FUNCTIONS ====================

  const getRoleLabel = useCallback((role: string) => {
    switch (role) {
      case UserRole.PARENT_1: return 'Primary';
      case UserRole.PARENT_2: return 'Co-Parent';
      case UserRole.GUARDIAN: return 'Guardian';
      default: return 'Viewer';
    }
  }, []);

  const formatLastActive = useCallback((dateString?: string) => {
    if (!dateString) return 'Now';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  }, []);

  const getPermissionLabel = useCallback((member: FamilyMember) => {
    if (member.role === UserRole.PARENT_1 || member.role === UserRole.PARENT_2) {
      return 'Full Access';
    } else if (member.role === UserRole.GUARDIAN) {
      return 'Can Add, No Delete';
    } else {
      return 'View Only';
    }
  }, []);

  const getActivityColor = useCallback((type?: string): string => {
    const colors: Record<string, string> = {
      potty: '#8b5cf6', feed: '#f59e0b', sleep: '#3b82f6', growth: '#10b981',
      medication: '#ef4444', milestone: '#f97316', diaper: '#06b6d4', note: '#6b7280',
    };
    return colors[type || 'note'] || '#6b7280';
  }, []);

  const getActivityIcon = useCallback((type?: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      potty: 'water-outline', feed: 'restaurant-outline', sleep: 'moon-outline',
      growth: 'trending-up-outline', medication: 'medical-outline', milestone: 'trophy-outline',
      diaper: 'happy-outline', note: 'document-text-outline',
    };
    return icons[type || 'note'] || 'document-text-outline';
  }, []);

  // ==================== RENDER SECTIONS (MEMOIZED) ====================

  const renderHeader = useMemo(() => (
    <Animated.View entering={FadeInDown} style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>Family</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={handleChatPress} 
            style={[styles.headerBtn, styles.headerBtnSecondary]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chatbubbles" size={20} color="#667eea" />
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleInvite} 
            style={[styles.headerBtn, styles.headerBtnPrimary]}
            disabled={!hasPermission('manageFamily')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  ), [insets.top, isDark, navigation, unreadCount, hasPermission, handleChatPress, handleInvite]);

  const renderInviteCode = useMemo(() => (
    <CompactCard delay={100}>
      <View style={styles.codeContainer}>
        <View style={styles.codeLeft}>
          <View style={styles.codeBadge}>
            <Ionicons name="link" size={14} color="#667eea" />
            <Text style={styles.codeBadgeText}>FAMILY CODE</Text>
          </View>
          <Text style={[styles.codeValue, isDark && styles.textDark]}>
            {familyCode}
          </Text>
        </View>
        <TouchableOpacity onPress={handleCopyCode} style={styles.codeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="copy-outline" size={20} color="#667eea" />
        </TouchableOpacity>
      </View>
    </CompactCard>
  ), [familyCode, isDark, handleCopyCode]);

  const renderBabyCard = useMemo(() => {
    if (!currentBaby) return null;
    return (
      <CompactCard delay={200} onPress={handleBabyPress}>
        <View style={styles.babyContainer}>
          <Text style={styles.babyEmoji}>{currentBaby.avatar || '👶'}</Text>
          <View style={styles.babyInfo}>
            <Text style={[styles.babyName, isDark && styles.textDark]}>{currentBaby.name}</Text>
            <Text style={styles.babyMeta}>{currentBaby.age || 'Newborn'}</Text>
          </View>
          {babies.length > 1 && (
            <Ionicons name="swap-horizontal" size={20} color="#667eea" />
          )}
        </View>
      </CompactCard>
    );
  }, [currentBaby, babies.length, isDark, handleBabyPress]);

  const renderStats = useMemo(() => (
    <CompactCard delay={300}>
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, isDark && styles.textDark]}>{familyStats.todayEntries}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, isDark && styles.textDark]}>{familyStats.totalEntries}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, isDark && styles.textDark]}>{members.length}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
      </View>
    </CompactCard>
  ), [familyStats, members.length, isDark]);

  const renderMemberItem = useCallback((member: FamilyMember, index: number, isYou: boolean = false) => (
    <CompactCard key={member.id} delay={400 + index * 100} style={styles.memberCard}>
      <TouchableOpacity 
        style={styles.memberRow}
        onPress={() => handleMemberPress(member, isYou)}
        onLongPress={() => !isYou && member.canBeRemove && handleRemoveMember(member)}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        <MemberAvatar member={member} />
        <View style={styles.memberContent}>
          <View style={styles.memberHeader}>
            <Text style={[styles.memberName, isDark && styles.textDark]}>
              {member.fullName} {isYou && <Text style={styles.youTag}>(You)</Text>}
            </Text>
            <View style={[
              styles.roleTag, 
              { backgroundColor: member.role === UserRole.PARENT_1 ? '#667eea20' : member.role === UserRole.PARENT_2 ? '#fa709a20' : '#11998e20' }
            ]}>
              <Text style={[
                styles.roleTagText,
                { color: member.role === UserRole.PARENT_1 ? '#667eea' : member.role === UserRole.PARENT_2 ? '#fa709a' : '#11998e' }
              ]}>
                {getRoleLabel(member.role)}
              </Text>
            </View>
          </View>
          <Text style={[styles.memberMeta, isDark && styles.textMuted]}>
            {getPermissionLabel(member)} • {formatLastActive(member.lastActive)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={isDark ? '#555' : '#ccc'} />
      </TouchableOpacity>
    </CompactCard>
  ), [isDark, getRoleLabel, getPermissionLabel, formatLastActive, handleMemberPress, handleRemoveMember]);

  const renderMembers = useMemo(() => {
    const allMembers: (FamilyMember & { isYou?: boolean })[] = [];
    
    if (parent1) allMembers.push({ ...parent1, isYou: true });
    if (parent2) allMembers.push({ ...parent2, isYou: false });
    guardians.forEach(g => allMembers.push({ ...g, isYou: false }));

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Family Members</Text>
        {allMembers.map((member, index) => renderMemberItem(member, index, member.isYou))}
        
        {hasPermission('manageFamily') && (
          <TouchableOpacity style={styles.addButton} onPress={handleInvite}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addButtonGradient}>
              <Ionicons name="person-add" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add Family Member</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [parent1, parent2, guardians, isDark, hasPermission, handleInvite, renderMemberItem]);

  const renderActivity = useMemo(() => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
        <TouchableOpacity onPress={handleTimelinePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      
      {recentActivities.length === 0 ? (
        <CompactCard delay={600}>
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color={isDark ? '#555' : '#999'} />
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>No recent activity</Text>
          </View>
        </CompactCard>
      ) : (
        recentActivities.slice(0, 3).map((activity, index) => (
          <CompactCard key={activity.id} delay={600 + index * 100}>
            <View style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: getActivityColor(activity.type) + '15' }]}>
                <Ionicons name={getActivityIcon(activity.type)} size={18} color={getActivityColor(activity.type)} />
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityText, isDark && styles.textDark]} numberOfLines={1}>
                  <Text style={styles.activityUser}>{activity.userName}</Text> {activity.action}
                </Text>
                <Text style={[styles.activityTime, isDark && styles.textMuted]}>
                  {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          </CompactCard>
        ))
      )}
    </View>
  ), [recentActivities, isDark, getActivityColor, getActivityIcon, handleTimelinePress]);

  const renderSettings = useMemo(() => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Settings</Text>
      
      <CompactCard delay={700}>
        <TouchableOpacity style={styles.settingItem} onPress={handleRemindersPress}>
          <View style={[styles.settingIcon, { backgroundColor: '#667eea15' }]}>
            <Ionicons name="notifications-outline" size={20} color="#667eea" />
          </View>
          <Text style={[styles.settingText, isDark && styles.textDark]}>Family Reminders</Text>
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#555' : '#ccc'} />
        </TouchableOpacity>
        
        <View style={[styles.settingDivider, isDark && styles.settingDividerDark]} />
        
        <TouchableOpacity style={styles.settingItem} onPress={handleSwitchBabyPress}>
          <View style={[styles.settingIcon, { backgroundColor: '#fa709a15' }]}>
            <Ionicons name="swap-horizontal-outline" size={20} color="#fa709a" />
          </View>
          <Text style={[styles.settingText, isDark && styles.textDark]}>Switch Baby Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#555' : '#ccc'} />
        </TouchableOpacity>
        
        <View style={[styles.settingDivider, isDark && styles.settingDividerDark]} />
        
        <TouchableOpacity style={styles.settingItem} onPress={handleChatPress}>
          <View style={[styles.settingIcon, { backgroundColor: '#11998e15' }]}>
            <Ionicons name="chatbubbles-outline" size={20} color="#11998e" />
          </View>
          <Text style={[styles.settingText, isDark && styles.textDark]}>Family Chat</Text>
          <View style={styles.settingMeta}>
            {unreadCount > 0 && (
              <View style={styles.settingBadge}>
                <Text style={styles.settingBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#555' : '#ccc'} />
          </View>
        </TouchableOpacity>
      </CompactCard>

      {hasPermission('manageFamily') && (
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveFamily}>
          <Ionicons name="exit-outline" size={20} color="#ff4757" />
          <Text style={styles.leaveText}>Leave Family</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [isDark, unreadCount, hasPermission, handleRemindersPress, handleSwitchBabyPress, handleChatPress, handleLeaveFamily]);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} 
        style={styles.bg}
      />
      
      {renderHeader}
      
      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        scrollEventThrottle={16}
        removeClippedSubviews={true}
      >
        {renderInviteCode}
        {renderBabyCard}
        {renderStats}
        {renderMembers}
        {renderActivity}
        {renderSettings}
      </AnimatedScrollView>

      <AddMemberModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddMember}
        isDark={isDark}
      />

      <SweetAlert
        {...alert}
        onClose={() => setAlert({ ...alert, visible: false })}
        isDark={isDark}
      />
    </View>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  // Alert Styles (from HomeScreen)
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
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  // Base
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  containerDark: { backgroundColor: '#0a0a0a' },
  bg: { ...StyleSheet.absoluteFillObject },
  
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Header - FIXED: Added zIndex and proper elevation
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    elevation: 5,
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
  headerBtnPrimary: { backgroundColor: '#667eea' },
  headerBtnSecondary: { 
    backgroundColor: 'rgba(102,126,234,0.1)',
    marginRight: 8,
  },
  headerActions: { 
    flexDirection: 'row', 
    alignItems: 'center',
    zIndex: 101, // Ensure buttons are above other elements
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 102,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },

  // Cards
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardBlur: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  // Invite Code
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  codeLeft: { flex: 1 },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  codeBadgeText: { fontSize: 11, fontWeight: '700', color: '#667eea', letterSpacing: 0.5 },
  codeValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', letterSpacing: 1 },
  codeButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Baby Card
  babyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  babyEmoji: { fontSize: 40, marginRight: 16 },
  babyInfo: { flex: 1 },
  babyName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  babyMeta: { fontSize: 13, color: '#667eea', fontWeight: '600', marginTop: 2 },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(100,116,139,0.15)',
    marginHorizontal: 12,
  },

  // Section
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  seeAll: { fontSize: 14, fontWeight: '600', color: '#667eea' },

  // Members
  memberCard: { marginBottom: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  memberContent: { flex: 1, marginLeft: 14 },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  memberName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  youTag: { color: '#667eea', fontWeight: '600' },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  memberMeta: { fontSize: 12, color: '#64748b' },

  // Add Button
  addButton: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Activity
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, color: '#1a1a1a' },
  activityUser: { fontWeight: '700', color: '#667eea' },
  activityTime: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 8 },

  // Settings
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  settingMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingBadge: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  settingDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 16,
  },
  settingDividerDark: { backgroundColor: 'rgba(255,255,255,0.05)' },

  // Leave Button
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 14,
    gap: 8,
  },
  leaveText: { fontSize: 15, fontWeight: '600', color: '#ff4757' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalContentDark: {
    backgroundColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  input: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  inputDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 8,
    marginBottom: 12,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginBottom: 8,
  },
  roleOptionDark: {
    borderColor: 'rgba(255,255,255,0.1)',
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleInfo: { flex: 1 },
  roleLabel: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  roleDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
});