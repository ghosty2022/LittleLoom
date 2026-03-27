import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  StatusBar,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  RefreshControl,
  useColorScheme,
  Modal,
  Alert,
  FlatList,
  ImageBackground,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeIn,
  FadeInUp,
  FadeInDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  SlideInRight,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow, format } from 'date-fns';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

// Contexts
import { useAuth } from '../context/AuthContext';
import { useBaby } from '../context/BabyContext';
import { useActivity } from '../context/ActivityContext';
import { useSecurity } from '../context/SecurityContext';
import { useCommunity } from '../context/CommunityContext';
import { useAudio, SOUND_TRACKS } from '../context/AudioContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ==================== CONFIGURATION ====================

const getGridColumns = () => {
  if (width >= 768) return 6;
  if (width >= 414) return 5;
  return 4;
};

const GRID_COLUMNS = getGridColumns();

// UPDATED: Extended quick actions with more navigation options
const DEFAULT_QUICK_ACTIONS = [
  { id: 'potty', label: 'Potty', icon: '🚽', color: '#667eea', gradient: ['#667eea', '#764ba2'], screen: 'UniversalTracker', params: { type: 'potty' } },
  { id: 'feed', label: 'Feed', icon: '🍼', color: '#fa709a', gradient: ['#fa709a', '#fee140'], screen: 'UniversalTracker', params: { type: 'feed' } },
  { id: 'sleep', label: 'Sleep', icon: '😴', color: '#11998e', gradient: ['#11998e', '#38ef7d'], screen: 'UniversalTracker', params: { type: 'sleep' } },
  { id: 'diaper', label: 'Diaper', icon: '🧷', color: '#fc5c7d', gradient: ['#fc5c7d', '#6a82fb'], screen: 'UniversalTracker', params: { type: 'diaper' } },
  { id: 'growth', label: 'Growth', icon: '📏', color: '#43e97b', gradient: ['#43e97b', '#38f9d7'], screen: 'GrowthChart', params: {} },
  { id: 'milestone', label: 'Milestone', icon: '🌟', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], screen: 'Achievements', params: {} },
  { id: 'medication', label: 'Meds', icon: '💊', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'UniversalTracker', params: { type: 'medication' } },
  { id: 'note', label: 'Note', icon: '📝', color: '#64748b', gradient: ['#64748b', '#94a3b8'], screen: 'UniversalTracker', params: { type: 'note' } },
];

// UPDATED: More available actions with navigation screens
const AVAILABLE_ACTIONS = [
  { id: 'pump', label: 'Pump', icon: '🤱', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], screen: 'UniversalTracker', params: { type: 'pump' } },
  { id: 'bath', label: 'Bath', icon: '🛁', color: '#3b82f6', gradient: ['#3b82f6', '#60a5fa'], screen: 'UniversalTracker', params: { type: 'bath' } },
  { id: 'sun', label: 'Sun', icon: '☀️', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'], screen: 'UniversalTracker', params: { type: 'sun' } },
  { id: 'play', label: 'Play', icon: '🎮', color: '#ec4899', gradient: ['#ec4899', '#f472b6'], screen: 'UniversalTracker', params: { type: 'play' } },
  { id: 'walk', label: 'Walk', icon: '🚶', color: '#10b981', gradient: ['#10b981', '#34d399'], screen: 'UniversalTracker', params: { type: 'walk' } },
  { id: 'family_chat', label: 'Family Chat', icon: '💬', color: '#06b6d4', gradient: ['#06b6d4', '#22d3ee'], screen: 'FamilyChatList', params: {} },
  { id: 'family_center', label: 'Family', icon: '👨‍👩‍👧', color: '#f97316', gradient: ['#f97316', '#fb923c'], screen: 'FamilySharing', params: {} },
  { id: 'reminders', label: 'Reminders', icon: '⏰', color: '#ef4444', gradient: ['#ef4444', '#f87171'], screen: 'Reminders', params: {} },
  { id: 'safety', label: 'Safety', icon: '🛡️', color: '#dc2626', gradient: ['#dc2626', '#ef4444'], screen: 'SafetyCorner', params: {} },
  { id: 'gallery', label: 'Gallery', icon: '🖼️', color: '#8b5cf6', gradient: ['#8b5cf6', '#a78bfa'], screen: 'Gallery', params: {} },
  { id: 'sound', label: 'Sounds', icon: '🎵', color: '#1DB954', gradient: ['#1DB954', '#1ed760'], screen: 'SoundMixer', params: {} },
];

// UPDATED: Feature cards with full navigation coverage
const FEATURE_CARDS = [
  { id: 'reminders', label: 'Reminders', icon: 'alarm', color: '#f59e0b', screen: 'Reminders', badge: '3' },
  { id: 'achievements', label: 'Milestones', icon: 'trophy', color: '#ec4899', screen: 'Achievements' },
  { id: 'growth', label: 'Growth', icon: 'trending-up', color: '#10b981', screen: 'GrowthChart' },
  { id: 'family', label: 'Family', icon: 'people', color: '#3b82f6', screen: 'FamilySharing' },
  { id: 'safety', label: 'Safety', icon: 'shield-checkmark', color: '#ef4444', screen: 'SafetyCorner' },
  { id: 'gallery', label: 'Gallery', icon: 'images', color: '#8b5cf6', screen: 'Gallery', badge: 'New' },
  { id: 'chat', label: 'Family Chat', icon: 'chatbubbles', color: '#06b6d4', screen: 'FamilyChatList', badge: 'Live' },
  { id: 'sound', label: 'Sound Mixer', icon: 'musical-notes', color: '#1DB954', screen: 'SoundMixer' },
];

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

// ==================== SWEET ALERT SYSTEM ====================

interface AlertState {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  icon?: string;
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
};

// ==================== CONFIRM MODAL ====================

const ConfirmModal = ({ 
  visible, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  type = 'default',
  isDark
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger' | 'warning';
  isDark: boolean;
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  const colors = {
    default: ['#667eea', '#764ba2'],
    danger: ['#ef4444', '#dc2626'],
    warning: ['#f59e0b', '#d97706'],
  }[type];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10000, justifyContent: 'center', alignItems: 'center' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }, backdropStyle]}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      </Animated.View>
      
      <Animated.View style={[styles.confirmModal, modalStyle, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <View style={styles.confirmIconContainer}>
          <LinearGradient colors={colors} style={styles.confirmIconBg}>
            <Ionicons name={type === 'danger' ? 'trash' : type === 'warning' ? 'warning' : 'help-circle'} size={32} color="#fff" />
          </LinearGradient>
        </View>
        
        <Text style={[styles.confirmTitle, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
        <Text style={styles.confirmMessage}>{message}</Text>
        
        <View style={styles.confirmButtons}>
          <TouchableOpacity style={[styles.confirmButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>{cancelText}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onConfirm}>
            <LinearGradient colors={colors} style={styles.confirmButtonGradient}>
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ==================== NOTIFICATION CHOOSER MODAL (UPDATED) ====================

const NotificationChooserModal = ({ 
  visible, 
  onClose, 
  onSelect,
  isDark
}: { 
  visible: boolean; 
  onClose: () => void; 
  onSelect: (type: 'app' | 'community') => void;
  isDark: boolean;
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 20 });
      translateY.value = withSpring(0, { damping: 20 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.9, { duration: 150 });
      translateY.value = withTiming(-20, { duration: 150 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ 
    transform: [{ scale: scale.value }, { translateY: translateY.value }] 
  }));

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10001 }]} pointerEvents="box-none">
      {/* Backdrop - clickable to dismiss */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }, backdropStyle]}>
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />
        </Animated.View>
      </TouchableOpacity>
      
      {/* Modal positioned top right */}
      <Animated.View style={[
        styles.notificationModal, 
        modalStyle, 
        { backgroundColor: isDark ? '#1a1a2e' : '#fff' }
      ]}>
        <View style={styles.notificationHandle} />
        <Text style={[styles.notificationTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Notifications</Text>
        
        <TouchableOpacity 
          style={styles.notificationOption} 
          onPress={() => { onSelect('app'); onClose(); }}
        >
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.notificationIcon}>
            <Ionicons name="notifications" size={18} color="#fff" />
          </LinearGradient>
          <View style={styles.notificationTextContainer}>
            <Text style={[styles.notificationOptionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>App</Text>
            <Text style={styles.notificationOptionSubtitle}>Reminders & alerts</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#64748b" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.notificationOption} 
          onPress={() => { onSelect('community'); onClose(); }}
        >
          <LinearGradient colors={['#ec4899', '#f472b6']} style={styles.notificationIcon}>
            <Ionicons name="people" size={18} color="#fff" />
          </LinearGradient>
          <View style={styles.notificationTextContainer}>
            <Text style={[styles.notificationOptionTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Community</Text>
            <Text style={styles.notificationOptionSubtitle}>Likes & mentions</Text>
          </View>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>5</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748b" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ==================== SUB-COMPONENTS ====================

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

const CircularProgress: React.FC<{ progress: number; value: string; label: string; color: string; onPress?: () => void; size?: number }> = ({ progress, value, label, color, onPress, size = 60 }) => {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <TouchableOpacity style={[styles.progressItem, { width: size + 20 }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.progressSvgContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} />
              <Stop offset="100%" stopColor={color + '80'} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
          <Circle cx={size/2} cy={size/2} r={radius} stroke={`url(#grad-${label})`} strokeWidth="6" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
        </Svg>
        <Text style={[styles.progressValue, { color, fontSize: size * 0.25 }]}>{value}</Text>
      </View>
      <Text style={[styles.progressLabel, { fontSize: size * 0.18 }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const DraggableGrid = ({ items, onPress, onRemove, onAdd, columns, isDark }: { items: any[], onPress: (item: any) => void, onRemove: (id: string) => void, onAdd: () => void, columns: number, isDark: boolean }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  
  const totalMargin = 20; // Reduced for full width
  const gap = 10;
  const availableWidth = width - totalMargin;
  const itemWidth = (availableWidth - (columns - 1) * gap) / columns;

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View>
      <View style={styles.gridHeader}>
        <Text style={[styles.gridHint, isDark && { color: '#94a3b8' }]}>
          {isEditMode ? 'Tap X to remove' : `Hold to customize (${columns} cols)`}
        </Text>
        {isEditMode && (
          <TouchableOpacity onPress={toggleEditMode} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.gridContainer, { gap }]}>
        {items.map((item, index) => (
          <Animated.View key={item.id} entering={FadeInUp.delay(index * 50)} layout={Layout.springify()} style={[styles.gridItem, { width: itemWidth }]}>
            <TouchableOpacity onPress={() => isEditMode ? null : onPress(item)} onLongPress={toggleEditMode} delayLongPress={300} style={styles.gridItemTouchable}>
              <LinearGradient colors={item.gradient} style={[styles.gridItemGradient, isEditMode && styles.gridItemGradientEdit]}>
                <Text style={styles.gridItemIcon}>{item.icon}</Text>
                {isEditMode && (
                  <TouchableOpacity style={styles.removeBadge} onPress={() => onRemove(item.id)}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                )}
              </LinearGradient>
              <Text style={[styles.gridItemLabel, isDark && { color: '#fff' }]}>{item.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
        <TouchableOpacity style={[styles.gridItem, { width: itemWidth }]} onPress={onAdd}>
          <View style={[styles.addItemGradient, isDark && { borderColor: '#475569', backgroundColor: 'rgba(71,85,105,0.2)' }]}>
            <Ionicons name="add" size={28} color="#667eea" />
          </View>
          <Text style={[styles.gridItemLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ==================== PAGINATED ACTIVITY LIST ====================

const PaginatedActivityList = ({ 
  activities, 
  isDark, 
  navigation,
  onLoadMore,
  hasMore,
  isLoading
}: { 
  activities: any[], 
  isDark: boolean, 
  navigation: any,
  onLoadMore: () => void,
  hasMore: boolean,
  isLoading: boolean
}) => {
  const [displayCount, setDisplayCount] = useState(5);
  
  const displayedActivities = activities.slice(0, displayCount);
  const canLoadMore = displayCount < activities.length;

  const handleLoadMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplayCount(prev => Math.min(prev + 5, activities.length));
    onLoadMore();
  };

  if (activities.length === 0) {
    return (
      <GlassmorphismCard style={styles.emptyState} intensity={60}>
        <View style={styles.emptyStateIcon}>
          <Ionicons name="document-text-outline" size={32} color="#667eea" />
        </View>
        <Text style={styles.emptyStateTitle}>No activities yet</Text>
        <Text style={styles.emptyStateText}>Tap a quick action above to log your first activity!</Text>
      </GlassmorphismCard>
    );
  }

  return (
    <View>
      {displayedActivities.map((item, index) => (
        <Animated.View key={item.id} entering={FadeInUp.delay(index * 80)} layout={Layout.springify()}>
          <TouchableOpacity onPress={() => navigation.navigate('UniversalTracker', { type: item.type })} activeOpacity={0.8}>
            <GlassmorphismCard style={styles.activityItem} intensity={60}>
              <View style={[styles.activityIcon, { backgroundColor: `${item.color || '#667eea'}20` }]}>
                <Text style={styles.activityEmoji}>{item.icon || '📝'}</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, isDark && styles.textDark]}>{item.title}</Text>
                <Text style={styles.activityTime}>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</Text>
                {item.details && <Text style={styles.activityDetails} numberOfLines={1}>{item.details}</Text>}
              </View>
              <View style={styles.activityArrow}>
                <Ionicons name="chevron-forward" size={18} color="#667eea" />
              </View>
            </GlassmorphismCard>
          </TouchableOpacity>
        </Animated.View>
      ))}
      
      {(canLoadMore || isLoading) && (
        <TouchableOpacity 
          style={styles.loadMoreButton} 
          onPress={handleLoadMore}
          disabled={isLoading}
        >
          <BlurView intensity={60} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'}>
            <LinearGradient
              colors={isDark ? ['rgba(40,40,40,0.6)', 'rgba(20,20,20,0.4)'] : ['rgba(255,255,255,0.6)', 'rgba(248,250,252,0.4)']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
          <View style={styles.loadMoreContent}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#667eea" />
            ) : (
              <>
                <Text style={[styles.loadMoreText, isDark && styles.textDark]}>
                  Load More ({activities.length - displayCount} remaining)
                </Text>
                <Ionicons name="chevron-down" size={16} color="#667eea" />
              </>
            )}
          </View>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity 
        style={styles.viewAllButton}
        onPress={() => navigation.navigate('Timeline')}
      >
        <Text style={styles.viewAllText}>View All in Timeline</Text>
        <Ionicons name="arrow-forward" size={16} color="#667eea" />
      </TouchableOpacity>
    </View>
  );
};

// ==================== SOUND MIXER SECTION ====================

const SoundMixerSection = ({ onPress, isDark }: { onPress: () => void, isDark: boolean }) => {
  const { playTrack, currentTrack, isPlaying, togglePlayback } = useAudio();

  const handlePlayTrack = (track: typeof SOUND_TRACKS[0]) => {
    if (currentTrack?.id === track.id) {
      togglePlayback();
    } else {
      playTrack(track);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.soundMixerContainer}>
        <View style={styles.soundMixerHeader}>
          <View style={styles.soundMixerTitle}>
            <Ionicons name="musical-notes" size={24} color="#1DB954" />
            <Text style={styles.soundMixerTitleText}>Sound Mixer</Text>
          </View>
          <View style={styles.soundMixerControls}>
            <Text style={styles.nowPlaying}>
              {currentTrack && isPlaying ? currentTrack.title : 'Tap to play'}
            </Text>
            <TouchableOpacity 
              style={[styles.playAllButton, isPlaying && styles.playAllButtonActive]} 
              onPress={(e) => { 
                e.stopPropagation(); 
                if (!currentTrack) {
                  playTrack(SOUND_TRACKS[0]);
                } else {
                  togglePlayback();
                }
              }}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={SOUND_TRACKS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingRight: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.trackCard} onPress={(e) => { e.stopPropagation(); handlePlayTrack(item); }}>
              <ImageBackground source={{ uri: item.image }} style={styles.trackImage} imageStyle={{ borderRadius: 8 }}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.trackOverlay}>
                  <View style={[styles.trackPlayButton, currentTrack?.id === item.id && isPlaying && styles.trackPlayButtonActive]}>
                    <Ionicons name={currentTrack?.id === item.id && isPlaying ? "pause" : "play"} size={16} color="#fff" />
                  </View>
                </LinearGradient>
                {currentTrack?.id === item.id && isPlaying && (
                  <View style={styles.playingIndicator}>
                    <View style={styles.bar} />
                    <View style={[styles.bar, styles.barMiddle]} />
                    <View style={styles.bar} />
                  </View>
                )}
              </ImageBackground>
              <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.trackArtist}>{item.artist}</Text>
              <Text style={styles.trackDuration}>{item.duration}</Text>
            </TouchableOpacity>
          )}
        />
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ==================== STICKY HEADER COMPONENT ====================

const StickyAppHeader = ({ 
  scrollY, 
  isDark, 
  userProfile, 
  currentBaby, 
  currentTime, 
  greeting,
  onNotificationPress,
  onLockPress,
  onProfilePress,
  onBabyPress,
  onAddBabyPress,
  unreadCount
}: {
  scrollY: any;
  isDark: boolean;
  userProfile: any;
  currentBaby: any;
  currentTime: Date;
  greeting: string;
  onNotificationPress: () => void;
  onLockPress: () => void;
  onProfilePress: () => void;
  onBabyPress: () => void;
  onAddBabyPress: () => void;
  unreadCount: number;
}) => {
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [0, 1], Extrapolate.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 100], [-20, 0], Extrapolate.CLAMP) }],
  }));

  const blurIntensity = useMemo(() => {
    // Calculate blur based on scroll
    const intensity = interpolate(scrollY.value, [0, 150], [0, 95], Extrapolate.CLAMP);
    return intensity;
  }, [scrollY.value]);

  return (
    <Animated.View style={[styles.stickyHeaderContainer, headerOpacity]}>
      <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
      <LinearGradient 
        colors={isDark ? ['rgba(20,20,30,0.98)', 'rgba(10,10,20,0.95)'] : ['rgba(255,255,255,0.98)', 'rgba(248,250,252,0.95)']} 
        style={StyleSheet.absoluteFill} 
      />
      
      <View style={styles.stickyHeaderContent}>
        {/* Left: Profile */}
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity onPress={onProfilePress} style={styles.stickyHeaderProfile}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.stickyHeaderAvatar}>
              <Text style={styles.stickyHeaderAvatarText}>{userProfile?.fullName?.charAt(0) || 'P'}</Text>
            </LinearGradient>
            <View style={styles.stickyHeaderText}>
              <Text style={[styles.stickyHeaderGreeting, isDark && styles.textDark]} numberOfLines={1}>
                {greeting.split(' ')[0]}
              </Text>
              <Text style={styles.stickyHeaderTime}>{format(currentTime, 'h:mm a')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Center: Title */}
        <View style={styles.stickyHeaderCenter}>
          <Text style={[styles.stickyHeaderTitle, isDark && styles.textDark]}>LittleLoom</Text>
          <View style={styles.stickyHeaderUnderline} />
        </View>

        {/* Right: Actions */}
        <View style={styles.stickyHeaderRight}>
          <TouchableOpacity style={styles.stickyHeaderIconBtn} onPress={onNotificationPress}>
            <Ionicons name="notifications-outline" size={22} color={isDark ? '#fff' : '#667eea'} />
            {unreadCount > 0 && (
              <View style={styles.stickyHeaderBadge}>
                <Text style={styles.stickyHeaderBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {currentBaby ? (
            <TouchableOpacity style={styles.stickyHeaderBaby} onPress={onBabyPress}>
              <LinearGradient colors={['#fa709a', '#fee140']} style={styles.stickyHeaderBabyAvatar}>
                <Text style={styles.stickyHeaderBabyEmoji}>{currentBaby.avatar || '👶'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stickyHeaderIconBtn} onPress={onAddBabyPress}>
              <Ionicons name="add-circle" size={24} color="#667eea" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.stickyHeaderLockBtn} onPress={onLockPress}>
            <LinearGradient colors={['#ff6b6b', '#ee5a5a']} style={styles.stickyHeaderLockGradient}>
              <Ionicons name="lock-closed" size={14} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

// ==================== MAIN SCREEN ====================

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useSharedValue(0);

  const { userProfile, signOut, isLoading: authLoading } = useAuth();
  const { currentBaby, loadBabies, getPottyStreak } = useBaby();
  
  const { 
    entries: activities, 
    getRecentTimelineEvents, 
    getTodayCount,
    loadEntries: loadActivities,
    isLoading: activitiesLoading 
  } = useActivity();
  
  const { lockApp } = useSecurity();
  const { notifications, getUnreadCount } = useCommunity();

  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quickActions, setQuickActions] = useState(DEFAULT_QUICK_ACTIONS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ visible: false, type: 'success', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: () => {}, type: 'default' as const });
  const [showNotificationChooser, setShowNotificationChooser] = useState(false);
  const [columns, setColumns] = useState(GRID_COLUMNS);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
    
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    
    const dimensionListener = Dimensions.addEventListener('change', () => {
      setColumns(getGridColumns());
    });
    
    return () => {
      clearInterval(timer);
      dimensionListener?.remove();
    };
  }, []);

  useEffect(() => {
    loadBabies();
    loadActivities();
  }, [loadBabies, loadActivities]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const showToast = useCallback((type: AlertState['type'], title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, type: 'default' | 'danger' | 'warning' = 'default') => {
    setConfirmModal({ visible: true, title, message, onConfirm, type });
  }, []);

  const handleNotificationPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowNotificationChooser(true);
  }, []);

  const handleNotificationSelect = useCallback((type: 'app' | 'community') => {
    if (type === 'app') {
      navigation.navigate('Reminders');
    } else {
      navigation.navigate('Community', { screen: 'Notifications' });
    }
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadBabies(),
        loadActivities(),
      ]);
      showToast('success', 'Refreshed!', 'Your dashboard is up to date.');
    } catch (error) {
      showToast('error', 'Refresh Failed', 'Could not update dashboard data.');
    } finally {
      setRefreshing(false);
    }
  }, [loadBabies, loadActivities, showToast]);

  // UPDATED: Handle navigation with screen and params
  const handleQuickAction = useCallback((action: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!currentBaby && action.id !== 'note') {
      showToast('error', 'No Baby Profile', 'Please create a baby profile first.');
      return;
    }
    
    // Navigate to specific screen with params
    if (action.screen) {
      navigation.navigate(action.screen as any, action.params);
    } else {
      navigation.navigate('UniversalTracker', { type: action.id });
    }
    
    showToast('success', `${action.label} Logged`, 'Activity recorded successfully!');
  }, [currentBaby, navigation, showToast]);

  const handleRemoveAction = useCallback((id: string) => {
    showConfirm(
      'Remove Action',
      'Are you sure you want to remove this quick action?',
      () => {
        setQuickActions(prev => prev.filter(a => a.id !== id));
        showToast('success', 'Action Removed', 'Quick action removed from grid.');
      },
      'danger'
    );
  }, [showConfirm, showToast]);

  // UPDATED: Handle adding actions with navigation support
  const handleAddAction = useCallback((action: any) => {
    if (quickActions.find(a => a.id === action.id)) {
      showToast('error', 'Already Exists', 'This action is already in your quick actions.');
      return;
    }
    const newAction = {
      ...action,
      screen: action.screen || 'UniversalTracker',
      params: action.params || { type: action.id }
    };
    setQuickActions(prev => [...prev, newAction]);
    setShowAddModal(false);
    showToast('success', 'Action Added!', `${action.label} has been added to your quick actions.`);
  }, [quickActions, showToast]);

  const handleLockPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await lockApp();
    showToast('info', 'App Locked', 'LittleLoom has been secured.');
  }, [lockApp, showToast]);

  const handleSignOut = useCallback(() => {
    showConfirm(
      'Sign Out',
      'Are you sure you want to sign out of LittleLoom?',
      () => {
        showToast('info', 'Goodbye!', 'See you next time!');
        setTimeout(signOut, 1000);
      },
      'warning'
    );
  }, [showConfirm, showToast, signOut]);

  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => setIsLoadingMore(false), 500);
  }, []);

  const stats = useMemo(() => {
    if (!currentBaby) return [];
    
    const todaySleepCount = getTodayCount('sleep', currentBaby.id);
    const todayFeedCount = getTodayCount('feed', currentBaby.id);
    const pottyStreak = getPottyStreak();
    
    return [
      { 
        label: 'Sleep', 
        value: Math.min(todaySleepCount, 5).toString(), 
        progress: Math.min((todaySleepCount / 3) * 100, 100), 
        color: '#667eea' 
      },
      { 
        label: 'Feeds', 
        value: todayFeedCount.toString(), 
        progress: Math.min((todayFeedCount / 6) * 100, 100), 
        color: '#fa709a' 
      },
      { 
        label: 'Streak', 
        value: `${pottyStreak}d`, 
        progress: Math.min((pottyStreak / 7) * 100, 100), 
        color: '#11998e' 
      },
    ];
  }, [currentBaby, getTodayCount, getPottyStreak]);

  const allTimelineEvents = useMemo(() => {
    if (!currentBaby) return [];
    return getRecentTimelineEvents(50, currentBaby.id);
  }, [currentBaby, getRecentTimelineEvents, activities]);

  const unreadCommunityCount = useMemo(() => getUnreadCount(), [getUnreadCount]);

  if (authLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.loadingGradient}>
          <Text style={styles.loadingText}>LittleLoom</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (activitiesLoading && activities.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8fafc', '#e2e8f0']} style={styles.backgroundGradient} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      
      <LinearGradient colors={isDark ? ['#0a0a0a', '#1a1a2e', '#16213e'] : ['#f8fafc', '#e2e8f0', '#dbeafe']} style={styles.backgroundGradient} />

      {/* Sticky Header - Always visible on scroll */}
      <StickyAppHeader 
        scrollY={scrollY}
        isDark={isDark}
        userProfile={userProfile}
        currentBaby={currentBaby}
        currentTime={currentTime}
        greeting={greeting}
        onNotificationPress={handleNotificationPress}
        onLockPress={handleLockPress}
        onProfilePress={() => navigation.navigate('Profile')}
        onBabyPress={() => navigation.navigate('SwitchBaby')}
        onAddBabyPress={() => navigation.navigate('CreateBabyProfile')}
        unreadCount={unreadCommunityCount}
      />

      {/* Main Content */}
      <AnimatedScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" colors={['#667eea', '#764ba2']} />}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Header Section */}
        <Animated.View entering={FadeInDown.springify()}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleSignOut} style={styles.iconButton}>
              <BlurView intensity={60} style={styles.iconBlur} tint={isDark ? 'dark' : 'light'}>
                <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              </BlurView>
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={[styles.appTitle, isDark && styles.textDark]}>LittleLoom</Text>
              <View style={styles.titleUnderline} />
              <Text style={styles.appSubtitle}>Baby Tracker</Text>
            </View>

            <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress}>
              <BlurView intensity={60} style={styles.iconBlur} tint={isDark ? 'dark' : 'light'}>
                <Ionicons name="notifications-outline" size={22} color={isDark ? '#fff' : '#667eea'} />
                {(unreadCommunityCount > 0) && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{unreadCommunityCount}</Text>
                  </View>
                )}
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Parent Card */}
          <Animated.View entering={FadeInDown.springify()}>
            <GlassmorphismCard style={styles.parentCard} intensity={90}>
              <View style={styles.parentHeader}>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.parentAvatar}>
                    <Text style={styles.parentAvatarText}>{userProfile?.fullName?.charAt(0) || 'P'}</Text>
                    <View style={styles.editBadge}><Ionicons name="camera" size={10} color="#fff" /></View>
                  </LinearGradient>
                </TouchableOpacity>
                <View style={styles.parentInfo}>
                  <Text style={[styles.greetingText, isDark && styles.textDark]}>{greeting}</Text>
                  <Text style={[styles.parentName, isDark && styles.textDark]}>{userProfile?.fullName || 'Parent'}</Text>
                  <View style={styles.parentMeta}>
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={12} color="#43e97b" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                    <Text style={styles.timeText}>{format(currentTime, 'EEEE, MMM d')}</Text>
                  </View>
                </View>
              </View>
            </GlassmorphismCard>
          </Animated.View>

          {/* Baby Card */}
          {currentBaby ? (
            <Animated.View entering={FadeInUp.delay(100).springify()}>
              <GlassmorphismCard style={styles.babyCard} intensity={95}>
                <View style={styles.babyHeader}>
                  <TouchableOpacity style={styles.babySelector} onPress={() => navigation.navigate('SwitchBaby')}>
                    <Text style={styles.babySelectorLabel}>Current Baby</Text>
                    <Ionicons name="chevron-down" size={14} color="#667eea" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile', { mode: 'baby', babyId: currentBaby.id })}>
                    <Ionicons name="create-outline" size={18} color="#667eea" />
                  </TouchableOpacity>
                </View>

                <View style={styles.babyMainInfo}>
                  <LinearGradient colors={['#fa709a', '#fee140']} style={styles.babyAvatar}>
                    <Text style={styles.babyEmoji}>{currentBaby.avatar || '👶'}</Text>
                    <View style={styles.statusDot} />
                  </LinearGradient>
                  <View style={styles.babyDetails}>
                    <Text style={[styles.babyName, isDark && styles.textDark]}>{currentBaby.name}</Text>
                    <Text style={styles.babyAge}>{currentBaby.age}</Text>
                    <View style={styles.babyStatus}>
                      <Ionicons name="heart" size={12} color="#43e97b" />
                      <Text style={styles.babyStatusText}>Healthy & Active</Text>
                    </View>
                  </View>
                  <LinearGradient colors={['#fa709a', '#fee140']} style={styles.streakBadge}>
                    <Ionicons name="flame" size={14} color="#fff" />
                    <Text style={styles.streakText}>{getPottyStreak()}d</Text>
                  </LinearGradient>
                </View>

                <View style={styles.statsRow}>
                  {stats.map((stat) => (
                    <CircularProgress key={stat.label} progress={stat.progress} value={stat.value} label={stat.label} color={stat.color} size={65} />
                  ))}
                </View>
              </GlassmorphismCard>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.delay(100).springify()}>
              <TouchableOpacity onPress={() => navigation.navigate('CreateBabyProfile')}>
                <GlassmorphismCard style={styles.noBabyCard} intensity={90}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.noBabyGradient}>
                    <Text style={styles.noBabyEmoji}>👶</Text>
                    <Text style={styles.noBabyTitle}>Welcome to LittleLoom!</Text>
                    <Text style={styles.noBabyText}>Create your first baby profile to start tracking</Text>
                    <View style={styles.noBabyButton}>
                      <Text style={styles.noBabyButtonText}>Get Started</Text>
                      <Ionicons name="arrow-forward" size={16} color="#667eea" />
                    </View>
                  </LinearGradient>
                </GlassmorphismCard>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* Sound Mixer Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="musical-notes" size={20} color="#1DB954" />
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Sound Mixer</Text>
            </View>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('SoundMixer')}>
              <Text style={styles.seeAllText}>Full Mixer</Text>
              <Ionicons name="arrow-forward" size={14} color="#667eea" />
            </TouchableOpacity>
          </View>
          <SoundMixerSection onPress={() => navigation.navigate('SoundMixer')} isDark={isDark} />
        </View>

        {/* Quick Actions Section - FULL WIDTH */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, styles.sectionHeaderPadded]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid" size={20} color="#667eea" />
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Quick Actions</Text>
            </View>
          </View>
          <View style={styles.gridWrapper}>
            <DraggableGrid 
              items={quickActions} 
              onPress={handleQuickAction} 
              onRemove={handleRemoveAction} 
              onAdd={() => setShowAddModal(true)} 
              columns={columns}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Features Section - FULL WIDTH CARDS */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, styles.sectionHeaderPadded]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="apps" size={20} color="#f59e0b" />
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Tools & Features</Text>
            </View>
          </View>
          <View style={styles.featuresGridFullWidth}>
            {FEATURE_CARDS.map((feature, index) => (
              <Animated.View key={feature.id} entering={FadeInUp.delay(index * 60)} style={styles.featureCardWrapper}>
                <TouchableOpacity onPress={() => navigation.navigate(feature.screen as any)} style={styles.featureCardFullWidth}>
                  <LinearGradient colors={[`${feature.color}15`, `${feature.color}05`]} style={[styles.featureGradientFullWidth, { borderColor: `${feature.color}30` }]}>
                    <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
                      <Ionicons name={feature.icon as any} size={22} color="#fff" />
                    </View>
                    <Text style={[styles.featureLabelFullWidth, isDark && { color: '#fff' }]}>{feature.label}</Text>
                    {feature.badge && (
                      <View style={[styles.featureBadge, { backgroundColor: feature.color }]}>
                        <Text style={styles.featureBadgeText}>{feature.badge}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={18} color={feature.color} style={styles.featureArrowFullWidth} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Activity Section */}
        <View style={styles.sectionFullWidth}>
          <View style={[styles.sectionHeader, styles.sectionHeaderPadded]}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time" size={20} color="#ec4899" />
              <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Recent Activity</Text>
            </View>
            <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate('Timeline')}>
              <Text style={styles.seeAllText}>View All</Text>
              <Ionicons name="arrow-forward" size={14} color="#667eea" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.activityWrapper}>
            <PaginatedActivityList 
              activities={allTimelineEvents}
              isDark={isDark}
              navigation={navigation}
              onLoadMore={handleLoadMore}
              hasMore={allTimelineEvents.length > 5}
              isLoading={isLoadingMore}
            />
          </View>
        </View>

        <View style={{ height: 140 }} />
      </AnimatedScrollView>

      {/* Add Action Modal */}
      <Modal 
        visible={showAddModal} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowAddModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
          <Animated.View entering={SlideInRight} style={styles.modalContent}>
            <LinearGradient colors={isDark ? ['#1a1a2e', '#16213e'] : ['#fff', '#f8fafc']} style={styles.modalGradient}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, isDark && { color: '#fff' }]}>Add Quick Action</Text>
                  <Text style={styles.modalSubtitle}>Choose an action to add to your grid</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowAddModal(false)} 
                  style={styles.modalClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalGrid}>
                {AVAILABLE_ACTIONS.map((action, index) => (
                  <Animated.View key={action.id} entering={FadeInUp.delay(index * 100)} style={styles.modalItem}>
                    <TouchableOpacity 
                      style={styles.modalItemButton} 
                      onPress={() => handleAddAction(action)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient colors={action.gradient} style={styles.modalItemGradient}>
                        <Text style={styles.modalItemIcon}>{action.icon}</Text>
                      </LinearGradient>
                      <Text style={[styles.modalItemLabel, isDark && { color: '#fff' }]}>{action.label}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>

      {/* Modals */}
      <SweetAlert {...alert} onClose={() => setAlert({ ...alert, visible: false })} isDark={isDark} />
      
      <ConfirmModal 
        {...confirmModal} 
        onCancel={() => setConfirmModal({ ...confirmModal, visible: false })}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, visible: false });
        }}
        isDark={isDark}
      />
      
      <NotificationChooserModal 
        visible={showNotificationChooser} 
        onClose={() => setShowNotificationChooser(false)}
        onSelect={handleNotificationSelect}
        isDark={isDark}
      />
    </View>
  );
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
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
  alertIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertMessage: { fontSize: 13, color: '#64748b' },

  // Confirm Modal
  confirmModal: { 
    width: width - 60, 
    borderRadius: 24, 
    padding: 24, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  confirmIconContainer: { marginBottom: 16 },
  confirmIconBg: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  confirmMessage: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: 'rgba(100,116,139,0.1)' },
  cancelButtonText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  confirmButtonGradient: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // UPDATED: Notification Modal - Top Right Positioned
  notificationModal: { 
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 80,
    right: 16,
    width: 280,
    borderRadius: 20, 
    padding: 16, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  notificationHandle: { 
    width: 32, 
    height: 4, 
    backgroundColor: 'rgba(100,116,139,0.3)', 
    borderRadius: 2, 
    alignSelf: 'center', 
    marginBottom: 12 
  },
  notificationTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  notificationOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 14, 
    marginBottom: 8, 
    backgroundColor: 'rgba(100,116,139,0.05)' 
  },
  notificationIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  notificationTextContainer: { flex: 1 },
  notificationOptionTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    marginBottom: 1 
  },
  notificationOptionSubtitle: { 
    fontSize: 12, 
    color: '#64748b' 
  },
  badgeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  badge: { 
    backgroundColor: '#ef4444', 
    borderRadius: 10, 
    minWidth: 20, 
    height: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 6 
  },
  badgeText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: 'bold' 
  },

  // Base
  container: { flex: 1 },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  scrollContent: { 
    paddingTop: Platform.OS === 'ios' ? 120 : 100, 
    paddingBottom: 30 
  },
  textDark: { color: '#ffffff' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 20 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },

  // UPDATED: Sticky Header Styles
  stickyHeaderContainer: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 1000, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingHorizontal: 16, 
    paddingBottom: 12, 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24, 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 12, 
    elevation: 10,
  },
  stickyHeaderContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    height: 50,
  },
  stickyHeaderLeft: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyHeaderProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyHeaderAvatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 8,
  },
  stickyHeaderAvatarText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '700' 
  },
  stickyHeaderText: {
    justifyContent: 'center',
  },
  stickyHeaderGreeting: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#1e293b',
  },
  stickyHeaderTime: { 
    fontSize: 10, 
    color: '#64748b',
    marginTop: 1,
  },
  stickyHeaderCenter: { 
    flex: 1, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyHeaderTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.3,
  },
  stickyHeaderUnderline: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#667eea',
    marginTop: 2,
    alignSelf: 'center',
  },
  stickyHeaderRight: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-end', 
    gap: 8,
  },
  stickyHeaderIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(100,116,139,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stickyHeaderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  stickyHeaderBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  stickyHeaderBaby: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  stickyHeaderBabyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyHeaderBabyEmoji: {
    fontSize: 18,
  },
  stickyHeaderLockBtn: { 
    marginLeft: 2,
  },
  stickyHeaderLockGradient: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
  },

  // Original Header
  topBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20, 
    marginTop: Platform.OS === 'ios' ? 10 : 20,
    paddingHorizontal: 20,
  },
  iconButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 16, 
    overflow: 'hidden' 
  },
  iconBlur: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  titleContainer: { 
    alignItems: 'center' 
  },
  appTitle: { 
    fontSize: 26, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.5 
  },
  titleUnderline: { 
    width: 40, 
    height: 3, 
    borderRadius: 2, 
    backgroundColor: '#667eea', 
    marginTop: 4, 
        alignSelf: 'center',
  },
  appSubtitle: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 4, 
    fontWeight: '500' 
  },
  notificationBadge: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    backgroundColor: '#ef4444', 
    borderRadius: 10, 
    minWidth: 18, 
    height: 18, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: 'white' 
  },
  notificationBadgeText: { 
    color: 'white', 
    fontSize: 10, 
    fontWeight: 'bold' 
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
    elevation: 10 
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

  // Parent Card
  parentCard: { 
    marginBottom: 16, 
    borderRadius: 28,
    marginHorizontal: 20,
  },
  parentHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20 
  },
  parentAvatar: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    alignItems: 'center', 
    justifyContent: 'center', 
    position: 'relative' 
  },
  parentAvatarText: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: '700' 
  },
  editBadge: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: '#667eea', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  parentInfo: { 
    flex: 1, 
    marginLeft: 16 
  },
  greetingText: { 
    fontSize: 13, 
    color: '#64748b', 
    fontWeight: '500', 
    marginBottom: 2 
  },
  parentName: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.5 
  },
  parentMeta: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 6, 
    gap: 12 
  },
  verifiedBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(67,233,123,0.1)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12, 
    gap: 4 
  },
  verifiedText: { 
    fontSize: 11, 
    color: '#43e97b', 
    fontWeight: '600' 
  },
  timeText: { 
    fontSize: 11, 
    color: '#94a3b8' 
  },

  // Baby Card
  babyCard: { 
    borderRadius: 28, 
    marginBottom: 20,
    marginHorizontal: 20,
  },
  babyHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 16 
  },
  babySelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  babySelectorLabel: { 
    fontSize: 12, 
    color: '#64748b', 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  editButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(102,126,234,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  babyMainInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    position: 'relative' 
  },
  babyAvatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    alignItems: 'center', 
    justifyContent: 'center', 
    position: 'relative' 
  },
  babyEmoji: { 
    fontSize: 40 
  },
  statusDot: { 
    position: 'absolute', 
    bottom: 4, 
    right: 4, 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    backgroundColor: '#43e97b', 
    borderWidth: 3, 
    borderColor: '#fff' 
  },
  babyDetails: { 
    flex: 1, 
    marginLeft: 16 
  },
  babyName: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.5 
  },
  babyAge: { 
    fontSize: 14, 
    color: '#64748b', 
    marginTop: 2, 
    fontWeight: '500' 
  },
  babyStatus: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8, 
    gap: 6 
  },
  babyStatusText: { 
    fontSize: 13, 
    color: '#43e97b', 
    fontWeight: '600' 
  },
  streakBadge: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  streakText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '700' 
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 16, 
    paddingHorizontal: 20, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(100,116,139,0.1)' 
  },
  progressItem: { 
    alignItems: 'center' 
  },
  progressSvgContainer: { 
    position: 'relative', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  progressValue: { 
    position: 'absolute', 
    fontWeight: '800' 
  },
  progressLabel: { 
    color: '#64748b', 
    marginTop: 6, 
    fontWeight: '600' 
  },

  // No Baby
  noBabyCard: { 
    borderRadius: 28, 
    marginBottom: 20, 
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  noBabyGradient: { 
    padding: 32, 
    alignItems: 'center' 
  },
  noBabyEmoji: { 
    fontSize: 56, 
    marginBottom: 16 
  },
  noBabyTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#fff', 
    marginBottom: 8 
  },
  noBabyText: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.9)', 
    textAlign: 'center', 
    marginBottom: 20 
  },
  noBabyButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 16, 
    gap: 8 
  },
  noBabyButtonText: { 
    color: '#667eea', 
    fontSize: 15, 
    fontWeight: '700' 
  },

  // Sections - UPDATED for full width
  section: { 
    marginTop: 8, 
    paddingHorizontal: 20 
  },
  sectionFullWidth: { 
    marginTop: 8, 
    width: '100%',
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16, 
    marginTop: 24 
  },
  sectionHeaderPadded: {
    paddingHorizontal: 20,
  },
  sectionTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#1e293b', 
    letterSpacing: -0.3 
  },
  seeAllButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  seeAllText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#667eea' 
  },

  // Sound Mixer
  soundMixerContainer: { 
    borderRadius: 24, 
    padding: 16, 
    marginBottom: 8,
    marginHorizontal: 20,
  },
  soundMixerHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  soundMixerTitle: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  soundMixerTitleText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '700' 
  },
  soundMixerControls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  nowPlaying: { 
    color: 'rgba(255,255,255,0.7)', 
    fontSize: 12, 
    fontWeight: '500' 
  },
  playAllButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#1DB954', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  playAllButtonActive: { 
    backgroundColor: '#f59e0b' 
  },
  trackCard: { 
    width: 130, 
    marginRight: 12 
  },
  trackImage: { 
    width: 130, 
    height: 130, 
    borderRadius: 8, 
    marginBottom: 8 
  },
  trackOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    padding: 8, 
    borderRadius: 8 
  },
  trackPlayButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#1DB954', 
    alignItems: 'center', 
    justifyContent: 'center', 
    alignSelf: 'flex-end' 
  },
  trackPlayButtonActive: { 
    backgroundColor: '#f59e0b' 
  },
  trackTitle: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 2 
  },
  trackArtist: { 
    color: 'rgba(255,255,255,0.6)', 
    fontSize: 12, 
    marginBottom: 2 
  },
  trackDuration: { 
    color: 'rgba(255,255,255,0.4)', 
    fontSize: 11 
  },
  playingIndicator: { 
    position: 'absolute', 
    top: 8, 
    left: 8, 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    gap: 2, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    padding: 6, 
    borderRadius: 8 
  },
  bar: { 
    width: 3, 
    height: 12, 
    backgroundColor: '#1DB954', 
    borderRadius: 1 
  },
  barMiddle: { 
    height: 18 
  },

  // Draggable Grid - UPDATED for full width
  gridWrapper: {
    paddingHorizontal: 10,
  },
  gridHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12, 
    paddingHorizontal: 10,
  },
  gridHint: { 
    fontSize: 12, 
    color: '#94a3b8', 
    fontStyle: 'italic' 
  },
  doneButton: { 
    backgroundColor: '#667eea', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  doneButtonText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'flex-start',
    width: '100%',
  },
  gridItem: { 
    alignItems: 'center', 
    marginBottom: 12,
  },
  gridItemTouchable: { 
    alignItems: 'center',
    width: '100%',
  },
  gridItemGradient: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 2, 
    position: 'relative' 
  },
  gridItemGradientEdit: { 
    borderWidth: 2, 
    borderColor: '#fff', 
    transform: [{ scale: 0.95 }] 
  },
  gridItemIcon: { 
    fontSize: 28 
  },
  gridItemLabel: { 
    fontSize: 11, 
    color: '#1e293b', 
    fontWeight: '600', 
    marginTop: 6, 
    textAlign: 'center' 
  },
  removeBadge: { 
    position: 'absolute', 
    top: -6, 
    right: -6, 
    backgroundColor: '#ef4444', 
    borderRadius: 10, 
    width: 20, 
    height: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#fff', 
    zIndex: 10 
  },
  addItemGradient: { 
    width: '100%', 
    aspectRatio: 1, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(100,116,139,0.1)', 
    borderWidth: 2, 
    borderColor: '#cbd5e1', 
    borderStyle: 'dashed' 
  },

  // Feature Cards - UPDATED for full width
  featuresGridFullWidth: { 
    width: '100%',
    paddingHorizontal: 10,
    gap: 10,
  },
  featureCardWrapper: { 
    width: '100%',
    marginBottom: 4,
  },
  featureCardFullWidth: { 
    borderRadius: 20, 
    overflow: 'hidden',
    width: '100%',
  },
  featureGradientFullWidth: { 
    padding: 16, 
    alignItems: 'center', 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.5)',
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  featureIcon: { 
    width: 52, 
    height: 52, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  featureLabelFullWidth: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#1e293b', 
    flex: 1,
  },
  featureBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  featureBadgeText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: 'bold' 
  },
  featureArrowFullWidth: { 
    marginLeft: 'auto',
    opacity: 0.6,
  },

  // Activity
  activityWrapper: {
    paddingHorizontal: 20,
  },
  emptyState: { 
    padding: 32, 
    alignItems: 'center', 
    borderRadius: 24 
  },
  emptyStateIcon: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: 'rgba(102,126,234,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 16 
  },
  emptyStateTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#64748b', 
    marginBottom: 8 
  },
  emptyStateText: { 
    color: '#94a3b8', 
    fontSize: 14, 
    textAlign: 'center' 
  },
  activityItem: { 
    marginVertical: 6, 
    padding: 14, 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  activityIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14 
  },
  activityEmoji: { 
    fontSize: 24 
  },
  activityContent: { 
    flex: 1 
  },
  activityTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#1e293b', 
    marginBottom: 2 
  },
  activityTime: { 
    fontSize: 12, 
    color: '#94a3b8', 
    fontWeight: '500' 
  },
  activityDetails: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 2 
  },
  activityArrow: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: 'rgba(102,126,234,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

  // Load More
  loadMoreButton: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 50,
  },
  loadMoreContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  viewAllButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },

  // Modal
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    overflow: 'hidden', 
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalGradient: { 
    flex: 1, 
    padding: 24 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 24,
    paddingRight: 8,
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#1e293b', 
    marginBottom: 4 
  },
  modalSubtitle: { 
    fontSize: 14, 
    color: '#64748b' 
  },
  modalClose: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(100,116,139,0.1)', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: -4,
  },
  modalGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 16,
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  modalItem: { 
    width: (width - 80) / 3,
    marginBottom: 8,
  },
  modalItemButton: { 
    alignItems: 'center' 
  },
  modalItemGradient: { 
    width: '100%', 
    aspectRatio: 1,
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 4 
  },
  modalItemIcon: { 
    fontSize: 32 
  },
  modalItemLabel: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#1e293b', 
    textAlign: 'center' 
  },
});