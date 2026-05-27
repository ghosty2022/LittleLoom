// src/screens/ProfileScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeInUp, 
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, formatDistanceToNow } from 'date-fns';

import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { useBaby, ActivityEntry, Milestone } from '../context/BabyContext';
import { useFamily, FamilyMember } from '../context/FamilyContext';
import { UserRole } from '../types/roles';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;

// ==================== UNIFIED SAFE AVATAR (matches SettingsScreen) ====================

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  return /\p{Emoji}/u.test(value);
};

interface SafeAvatarProps {
  avatar?: string | null;
  gender?: string;
  size?: number;
  showEditButton?: boolean;
  onEdit?: () => void;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackColor?: string;
}

const SafeAvatar: React.FC<SafeAvatarProps> = ({ 
  avatar, 
  gender = 'other', 
  size = 72, 
  showEditButton = false, 
  onEdit,
  fallbackIcon,
  fallbackColor,
}) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);
  
  const gradientColors = gender === 'boy' ? ['#667eea', '#764ba2'] 
    : gender === 'girl' ? ['#fa709a', '#fee140'] 
    : ['#11998e', '#38ef7d'];
  
  const iconName = fallbackIcon || (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'person');
  const color = fallbackColor || (gender === 'boy' ? '#667eea' : gender === 'girl' ? '#fa709a' : '#11998e');

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : gradientColors}
        style={[
          styles.avatarGradient, 
          { width: size, height: size, borderRadius: size * 0.33 }
        ]}
      >
        {hasImage ? (
          <View style={{ width: size, height: size, borderRadius: size * 0.33, overflow: 'hidden' }}>
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
          <Ionicons name={iconName as any} size={size * 0.4} color="#fff" />
        )}
      </LinearGradient>
      
      {showEditButton && onEdit && (
        <TouchableOpacity 
          style={[styles.editAvatarBtn, { bottom: -4, right: -4 }]}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.editAvatarGradient}
          >
            <Ionicons name="camera" size={14} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ==================== GLASS CARD COMPONENT ====================

const GlassCard: React.FC<{ 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void; 
  intensity?: number;
}> = ({ children, style, onPress, intensity = 85 }) => {
  const isDark = useColorScheme() === 'dark';
  const Wrapper = onPress ? TouchableOpacity : View;
  
  return (
    <Wrapper onPress={onPress} activeOpacity={0.85} style={[styles.glassCard, style]}>
      <BlurView intensity={intensity} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'] : ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassBorder} />
      <View style={styles.glassContent}>{children}</View>
    </Wrapper>
  );
};

// ==================== STAT BADGE COMPONENT ====================

const StatBadge: React.FC<{ icon: string; value: number | string; label: string; color: string }> = ({ 
  icon, value, label, color 
}) => (
  <View style={styles.statBadge}>
    <View style={[styles.statIconBg, { backgroundColor: `${color}20` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ==================== FAMILY AVATAR STACK ====================

const FamilyAvatarStack: React.FC<{ 
  members: FamilyMember[]; 
  maxDisplay?: number;
  onPress: () => void;
}> = ({ members, maxDisplay = 4, onPress }) => {
  const isDark = useColorScheme() === 'dark';
  const displayMembers = members.slice(0, maxDisplay);
  const remaining = members.length - maxDisplay;
  
  const roleColors: Record<string, string[]> = {
    [UserRole.PARENT_1]: ['#667eea', '#764ba2'],
    [UserRole.PARENT_2]: ['#fa709a', '#fee140'],
    [UserRole.GUARDIAN]: ['#11998e', '#38ef7d'],
    [UserRole.VIEWER]: ['#64748b', '#94a3b8'],
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.avatarStackContainer}>
      <View style={styles.avatarStack}>
        {displayMembers.map((member, index) => (
          <LinearGradient
            key={member.id}
            colors={roleColors[member.role] || roleColors[UserRole.VIEWER]}
            style={[styles.stackAvatar, { marginLeft: index > 0 ? -12 : 0, zIndex: maxDisplay - index }]}
          >
            <Text style={styles.stackAvatarText}>{member.fullName.charAt(0)}</Text>
          </LinearGradient>
        ))}
        {remaining > 0 && (
          <View style={[styles.stackAvatar, styles.stackAvatarMore, { marginLeft: -12, zIndex: 0 }]}>
            <Text style={styles.stackAvatarMoreText}>+{remaining}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={isDark ? '#667eea' : '#764ba2'} />
    </TouchableOpacity>
  );
};

// ==================== ACTIVITY ITEM ====================

const ActivityItem: React.FC<{ activity: ActivityEntry; isDark: boolean }> = ({ activity, isDark }) => {
  const config = {
    potty: { icon: '🚽', color: '#8b5cf6' },
    feed: { icon: '🍼', color: '#f59e0b' },
    sleep: { icon: '😴', color: '#3b82f6' },
    growth: { icon: '📏', color: '#10b981' },
    medication: { icon: '💊', color: '#ef4444' },
    milestone: { icon: '🌟', color: '#f97316' },
    diaper: { icon: '🧷', color: '#06b6d4' },
    note: { icon: '📝', color: '#6b7280' },
  }[activity.type] || { icon: '📝', color: '#6b7280' };

  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: `${config.color}15` }]}>
        <Text style={styles.activityEmoji}>{config.icon}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityTitle, isDark && styles.textDark]} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.activityTime}>
          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
        </Text>
      </View>
    </View>
  );
};

// ==================== MILESTONE ITEM ====================

const MilestoneItem: React.FC<{ milestone: Milestone; isDark: boolean }> = ({ milestone, isDark }) => (
  <View style={styles.milestoneItem}>
    <LinearGradient colors={['#f59e0b', '#fbbf24']} style={styles.milestoneIcon}>
      <Text style={styles.milestoneEmoji}>🌟</Text>
    </LinearGradient>
    <View style={styles.milestoneContent}>
      <Text style={[styles.milestoneTitle, isDark && styles.textDark]} numberOfLines={1}>
        {milestone.title}
      </Text>
      <Text style={styles.milestoneCategory}>{milestone.category}</Text>
      <Text style={styles.milestoneDate}>{format(new Date(milestone.achievedAt), 'MMM d, yyyy')}</Text>
    </View>
  </View>
);

// ==================== MAIN SCREEN ====================

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const { userProfile } = useAuth();
  const { profile } = useUser();
  const { 
    babies, currentBaby, currentBabyId, switchBaby, deleteBaby,
    growthData, milestones, activities, getBabyStats, loadBabies, getPottyStreak
  } = useBaby();
  const { members, parent1, parent2, guardians, loadFamily, removeMember } = useFamily();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'family' | 'growth'>('overview');

  // FIX: Safe user data with fallback
  const effectiveUser = useMemo(() => userProfile || profile, [userProfile, profile]);
  const hasUser = !!effectiveUser;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], Extrapolate.CLAMP),
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBabies(), loadFamily()]);
    setRefreshing(false);
  }, [loadBabies, loadFamily]);

  const handleSwitchBaby = useCallback((babyId: string) => {
    if (babyId === currentBabyId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switchBaby(babyId);
  }, [currentBabyId, switchBaby]);

  const handleDeleteBaby = useCallback((baby: typeof babies[0]) => {
    Alert.alert('Delete Profile', `Remove ${baby.name}'s profile permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          await deleteBaby(baby.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      },
    ]);
  }, [deleteBaby]);

  const handleRemoveMember = useCallback((member: FamilyMember) => {
    Alert.alert('Remove Member', `Remove ${member.fullName} from family?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMember(member.id) },
    ]);
  }, [removeMember]);

  // Navigation handlers
  const handleMemberPress = useCallback((member: FamilyMember, isYou: boolean = false) => {
    navigation.navigate('EditGuardian', { 
      guardianId: member.id,
      mode: isYou || member.role === UserRole.PARENT_2 ? 'parent2' : 'guardian'
    });
  }, [navigation]);

  const handleBabyEdit = useCallback((babyId: string) => {
    navigation.navigate('EditProfile', { mode: 'baby', babyId });
  }, [navigation]);

  const handleCurrentUserEdit = useCallback(() => {
    if (effectiveUser?.id) {
      navigation.navigate('EditGuardian', { 
        guardianId: effectiveUser.id,
        mode: 'parent2'
      });
    }
  }, [navigation, effectiveUser]);

  // FIX: Use actual members from context, with safe fallback
  const displayMembers = useMemo(() => {
    if (members.length > 0) return members;
    if (!hasUser) return [];
    return [{ 
      id: effectiveUser.id || '1', 
      fullName: effectiveUser.fullName || 'You', 
      role: UserRole.PARENT_1,
      relationship: 'Parent',
      email: effectiveUser.email || '',
      addedAt: new Date().toISOString(),
      addedBy: '',
      canBeRemoved: false,
      permissions: { read: true, write: true, delete: true, manageFamily: true, manageSecurity: true, exportData: true }
    }];
  }, [members, hasUser, effectiveUser]);

  const recentActivities = useMemo(() => 
    activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
  [activities]);

  const recentMilestones = useMemo(() => 
    milestones.sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()).slice(0, 3),
  [milestones]);

  const babyStats = useMemo(() => currentBaby ? getBabyStats() : null, [currentBaby, getBabyStats]);

  // ==================== RENDER SECTIONS ====================

  const renderHeader = () => (
    <Animated.View style={[styles.header, headerOpacity, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, isDark && styles.textDark]}>Family Center</Text>
        
        <FamilyAvatarStack 
          members={displayMembers}
          onPress={() => navigation.navigate('FamilySharing')}
        />
      </View>
    </Animated.View>
  );

  const renderBabyChips = () => (
    <View style={styles.babyChipsContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.babyChipsContent}
      >
        {babies.map((baby) => (
          <TouchableOpacity
            key={baby.id}
            onPress={() => handleSwitchBaby(baby.id)}
            style={[styles.babyChip, currentBabyId === baby.id && styles.babyChipActive]}
          >
            <LinearGradient
              colors={currentBabyId === baby.id ? ['#667eea', '#764ba2'] : isDark ? ['rgba(60,60,70,0.8)', 'rgba(40,40,50,0.6)'] : ['rgba(255,255,255,0.9)', 'rgba(245,245,250,0.7)']}
              style={styles.babyChipGradient}
            >
              <Text style={styles.babyChipEmoji}>{baby.avatar || '👶'}</Text>
              <Text style={[styles.babyChipName, currentBabyId === baby.id && styles.babyChipNameActive, isDark && currentBabyId !== baby.id && styles.textDark]}>
                {baby.name}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity style={styles.addBabyChip} onPress={() => navigation.navigate('CreateBabyProfile')}>
          <View style={[styles.addBabyChipInner, isDark && { borderColor: '#475569', backgroundColor: 'rgba(60,60,70,0.5)' }]}>
            <Ionicons name="add" size={20} color="#667eea" />
            <Text style={[styles.addBabyText, isDark && styles.textDark]}>Add</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderTabs = () => (
    <View style={[styles.tabBar, { top: insets.top + 70 }]}>
      <BlurView intensity={90} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient
        colors={isDark ? ['rgba(30,30,40,0.98)', 'rgba(20,20,30,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tabContainer}>
        {[
          { id: 'overview', icon: 'grid-outline', label: 'Overview' },
          { id: 'family', icon: 'people-outline', label: 'Family' },
          { id: 'growth', icon: 'trending-up-outline', label: 'Growth' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => {
                if (tab.id === 'family') {
                  navigation.navigate('FamilySharing');
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id as typeof activeTab);
              }}
            >
              <View style={[styles.tabBg, isActive && { backgroundColor: isDark ? 'rgba(102,126,234,0.3)' : 'rgba(102,126,234,0.15)' }]}>
                <Ionicons 
                  name={tab.icon as any} 
                  size={18} 
                  color={isActive ? '#667eea' : isDark ? '#94a3b8' : '#64748b'} 
                />
                <Text style={[
                  styles.tabLabel, 
                  isActive && styles.tabLabelActive,
                  isDark && !isActive && styles.textMuted
                ]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderOverview = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      {currentBaby && (
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <SafeAvatar 
              avatar={currentBaby.avatar}
              gender={currentBaby.gender}
              size={72} 
              showEditButton 
              onEdit={() => handleBabyEdit(currentBaby.id)}
            />
            
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, isDark && styles.textDark]}>{currentBaby.name}</Text>
              <Text style={styles.heroMeta}>{currentBaby.age} • {currentBaby.gender}</Text>
              <View style={styles.heroTags}>
                <View style={[styles.heroTag, { backgroundColor: '#fa709a20' }]}>
                  <Ionicons name="flame" size={12} color="#fa709a" />
                  <Text style={[styles.heroTagText, { color: '#fa709a' }]}>{getPottyStreak()}d streak</Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.editBtn}
              onPress={() => handleBabyEdit(currentBaby.id)}
            >
              <Ionicons name="create-outline" size={20} color="#667eea" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatBadge icon="🌟" value={currentBaby.milestones || 0} label="Milestones" color="#f59e0b" />
            <StatBadge icon="📸" value={currentBaby.photos || 0} label="Photos" color="#8b5cf6" />
            <StatBadge icon="📏" value={growthData.length} label="Records" color="#10b981" />
          </View>

          {(currentBaby.weight || currentBaby.height) && (
            <View style={styles.quickStats}>
              {currentBaby.weight && (
                <View style={styles.quickStat}>
                  <Ionicons name="scale-outline" size={16} color="#fa709a" />
                  <Text style={[styles.quickStatValue, isDark && styles.textDark]}>{currentBaby.weight}</Text>
                </View>
              )}
              {currentBaby.height && (
                <View style={styles.quickStat}>
                  <Ionicons name="resize-outline" size={16} color="#667eea" />
                  <Text style={[styles.quickStatValue, isDark && styles.textDark]}>{currentBaby.height}</Text>
                </View>
              )}
            </View>
          )}
        </GlassCard>
      )}

      {/* Parent Card */}
      <GlassCard style={styles.parentCard} onPress={handleCurrentUserEdit}>
        <LinearGradient colors={['#11998e20', '#38ef7d10']} style={StyleSheet.absoluteFill} />
        <View style={styles.parentRow}>
          <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.parentAvatar}>
            <Text style={styles.parentAvatarText}>{effectiveUser?.fullName?.charAt(0) || 'P'}</Text>
          </LinearGradient>
          <View style={styles.parentInfo}>
            <Text style={[styles.parentName, isDark && styles.textDark]}>{effectiveUser?.fullName || 'Parent'}</Text>
            <Text style={styles.parentRole}>Primary Parent</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#667eea' : '#764ba2'} />
        </View>
      </GlassCard>

      {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Timeline')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.activityCard}>
            {recentActivities.slice(0, 3).map((activity) => (
              <ActivityItem key={activity.id} activity={activity} isDark={isDark} />
            ))}
          </GlassCard>
        </View>
      )}
    </Animated.View>
  );

  const renderFamily = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, isDark && styles.textDark]}>{members.length}</Text>
            <Text style={styles.summaryLabel}>Members</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, isDark && styles.textDark]}>{babies.length}</Text>
            <Text style={styles.summaryLabel}>Babies</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, isDark && styles.textDark]}>{activities.length}</Text>
            <Text style={styles.summaryLabel}>Activities</Text>
          </View>
        </View>
      </GlassCard>

      {/* Parent 1 */}
      {parent1 && (
        <View style={styles.memberSection}>
          <Text style={[styles.memberSectionTitle, isDark && styles.textMuted]}>You</Text>
          <GlassCard onPress={() => handleMemberPress(parent1, true)}>
            <View style={styles.memberRow}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{parent1.fullName.charAt(0)}</Text>
              </LinearGradient>
              <View style={styles.memberDetails}>
                <Text style={[styles.memberName, isDark && styles.textDark]}>{parent1.fullName}</Text>
                <View style={[styles.rolePill, { backgroundColor: '#667eea20' }]}>
                  <Text style={[styles.rolePillText, { color: '#667eea' }]}>Primary</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={isDark ? '#667eea' : '#764ba2'} />
            </View>
          </GlassCard>
        </View>
      )}

      {/* Parent 2 */}
      {parent2 ? (
        <View style={styles.memberSection}>
          <Text style={[styles.memberSectionTitle, isDark && styles.textMuted]}>Co-Parent</Text>
          <GlassCard onPress={() => handleMemberPress(parent2, false)}>
            <View style={styles.memberRow}>
              <LinearGradient colors={['#fa709a', '#fee140']} style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{parent2.fullName.charAt(0)}</Text>
              </LinearGradient>
              <View style={styles.memberDetails}>
                <Text style={[styles.memberName, isDark && styles.textDark]}>{parent2.fullName}</Text>
                <View style={[styles.rolePill, { backgroundColor: '#fa709a20' }]}>
                  <Text style={[styles.rolePillText, { color: '#fa709a' }]}>Co-Parent</Text>
                </View>
              </View>
              {parent2.canBeRemoved && (
                <TouchableOpacity onPress={() => handleRemoveMember(parent2)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </GlassCard>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('Parent2Optional')}
        >
          <LinearGradient colors={['#fa709a', '#fee140']} style={styles.addBtnGradient}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add Co-Parent</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Guardians */}
      {guardians.length > 0 && (
        <View style={styles.memberSection}>
          <Text style={[styles.memberSectionTitle, isDark && styles.textMuted]}>Guardians</Text>
          {guardians.map(g => (
            <GlassCard key={g.id} style={styles.memberCard} onPress={() => handleMemberPress(g, false)}>
              <View style={styles.memberRow}>
                <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{g.fullName.charAt(0)}</Text>
                </LinearGradient>
                <View style={styles.memberDetails}>
                  <Text style={[styles.memberName, isDark && styles.textDark]}>{g.fullName}</Text>
                  <View style={[styles.rolePill, { backgroundColor: '#11998e20' }]}>
                    <Text style={[styles.rolePillText, { color: '#11998e' }]}>{g.relationship}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleRemoveMember(g)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))}
        </View>
      )}

      <TouchableOpacity 
        style={styles.addGuardianBtn}
        onPress={() => navigation.navigate('AddParent')}
      >
        <View style={[styles.addGuardianInner, isDark && { borderColor: '#475569' }]}>
          <Ionicons name="add-circle" size={22} color="#667eea" />
          <Text style={[styles.addGuardianText, isDark && styles.textDark]}>Add Guardian</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderGrowth = () => (
    <Animated.View entering={FadeInUp} style={styles.tabPanel}>
      <GlassCard style={styles.growthSummaryCard}>
        <View style={styles.growthStatsRow}>
          <View style={styles.growthStatItem}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.growthStatIcon}>
              <Ionicons name="resize-outline" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[styles.growthStatValue, isDark && styles.textDark]}>
                {growthData.filter(g => g.type === 'height').pop()?.value || '--'} 
                {growthData.filter(g => g.type === 'height').pop()?.unit || ''}
              </Text>
              <Text style={styles.growthStatLabel}>Height</Text>
            </View>
          </View>
          <View style={styles.growthStatItem}>
            <LinearGradient colors={['#fa709a', '#fee140']} style={styles.growthStatIcon}>
              <Ionicons name="scale-outline" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[styles.growthStatValue, isDark && styles.textDark]}>
                {growthData.filter(g => g.type === 'weight').pop()?.value || '--'}
                {growthData.filter(g => g.type === 'weight').pop()?.unit || ''}
              </Text>
              <Text style={styles.growthStatLabel}>Weight</Text>
            </View>
          </View>
          <View style={styles.growthStatItem}>
            <LinearGradient colors={['#11998e', '#38ef7d']} style={styles.growthStatIcon}>
              <Ionicons name="analytics-outline" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={[styles.growthStatValue, isDark && styles.textDark]}>{growthData.length}</Text>
              <Text style={styles.growthStatLabel}>Records</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {recentMilestones.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Latest Milestones</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Achievements')}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <GlassCard style={styles.milestonesCard}>
            {recentMilestones.map((m) => (
              <MilestoneItem key={m.id} milestone={m} isDark={isDark} />
            ))}
          </GlassCard>
        </View>
      )}

      <TouchableOpacity 
        style={styles.fullChartBtn}
        onPress={() => navigation.navigate('GrowthChart')}
      >
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.fullChartGradient}>
          <Ionicons name="trending-up" size={20} color="#fff" />
          <Text style={styles.fullChartText}>Full Growth Charts</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} 
        style={styles.bg} 
      />

      {renderHeader()}
      {renderTabs()}
      
      <View style={[styles.babyChipsWrapper, { top: insets.top + 130 }]}>
        {renderBabyChips()}
      </View>

      <AnimatedScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 200 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'family' && renderFamily()}
        {activeTab === 'growth' && renderGrowth()}

        <View style={styles.bottomSpacer} />
      </AnimatedScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },
  scrollContent: { paddingHorizontal: 16 },
  bottomSpacer: { height: 40 },

  // Safe Avatar Styles — FIXED: overflow hidden wrapper for images
  avatarWrapper: {
    position: 'relative',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarEmoji: {},
  editAvatarBtn: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editAvatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },

  // Family Avatar Stack
  avatarStackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stackAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stackAvatarMore: {
    backgroundColor: '#64748b',
  },
  stackAvatarMoreText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Tab Bar
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
  },
  tabBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '700',
  },

  // Baby Chips
  babyChipsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 98,
    paddingVertical: 12,
  },
  babyChipsContainer: {
    marginTop: 8,
  },
  babyChipsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  babyChip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  babyChipActive: {
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  babyChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  babyChipEmoji: {
    fontSize: 18,
  },
  babyChipName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  babyChipNameActive: {
    color: '#fff',
    fontWeight: '700',
  },
  addBabyChip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBabyChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  addBabyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  // Glass Card
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  glassContent: { flex: 1 },

  // Tab Panel
  tabPanel: {
    marginTop: 16,
    gap: 16,
  },

  // Hero Card
  heroCard: {
    padding: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroInfo: {
    flex: 1,
    marginLeft: 16,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  heroMeta: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  heroTags: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.1)',
  },
  statBadge: {
    alignItems: 'center',
    gap: 6,
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 22,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100,116,139,0.1)',
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },

  // Parent Card
  parentCard: {
    padding: 16,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  parentInfo: {
    flex: 1,
    marginLeft: 14,
  },
  parentName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  parentRole: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },

  // Section
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // Activity
  activityCard: {
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.08)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityEmoji: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // Family Tab
  summaryCard: {
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(100,116,139,0.15)',
  },

  // Members
  memberSection: {
    marginTop: 8,
  },
  memberSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberCard: {
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  memberDetails: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  removeBtn: {
    padding: 4,
  },

  // Add Buttons
  addBtn: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#fa709a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  addGuardianBtn: {
    marginTop: 12,
  },
  addGuardianInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
    backgroundColor: 'rgba(100,116,139,0.08)',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  addGuardianText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },

  // Growth Tab
  growthSummaryCard: {
    padding: 20,
  },
  growthStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  growthStatItem: {
    alignItems: 'center',
    gap: 10,
  },
  growthStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  growthStatLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },

  // Milestones
  milestonesCard: {
    padding: 16,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100,116,139,0.08)',
  },
  milestoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  milestoneEmoji: {
    fontSize: 22,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  milestoneCategory: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  milestoneDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Full Chart Button
  fullChartBtn: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  fullChartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  fullChartText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});