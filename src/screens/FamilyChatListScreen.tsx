import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  Alert,
  Share,
  Modal,
  TextInput,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInUp, 
  FadeInRight, 
  Layout,
  FadeIn,
  SlideInRight,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useFamilyChat, FamilyChat, FamilyMessage } from '../context/FamilyChatContext';
import { useFamily, FamilyMember } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';

type FamilyChatListScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilyChatList'>;

const { width } = Dimensions.get('window');

// ==================== IMAGE UTILITY FUNCTIONS (from SwitchBabyScreen) ====================
const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  for (const char of value) {
    const code = char.codePointAt(0) || 0;
    const isEmojiChar = (
      (code >= 0x1F600 && code <= 0x1F64F) ||
      (code >= 0x1F300 && code <= 0x1F5FF) ||
      (code >= 0x1F680 && code <= 0x1F6FF) ||
      (code >= 0x1F1E0 && code <= 0x1F1FF) ||
      (code >= 0x2600 && code <= 0x26FF) ||
      (code >= 0x2700 && code <= 0x27BF) ||
      (code >= 0x1F900 && code <= 0x1F9FF) ||
      (code >= 0x1F018 && code <= 0x1F270) ||
      code === 0x238C || code === 0x2B06 || code === 0x2B07 || code === 0x2B05 ||
      code === 0x27A1 || (code >= 0x2194 && code <= 0x2199) ||
      (code >= 0x21A9 && code <= 0x21AA) || (code >= 0x2934 && code <= 0x2935) ||
      (code >= 0x25AA && code <= 0x25AB) || (code >= 0x25FB && code <= 0x25FE) ||
      code === 0x25B6 || code === 0x25C0 || (code >= 0x1F200 && code <= 0x1F251) ||
      code === 0x1F004 || code === 0x1F0CF || (code >= 0x1F170 && code <= 0x1F171) ||
      (code >= 0x1F17E && code <= 0x1F17F) || code === 0x1F18E || code === 0x3030 ||
      code === 0x2B50 || code === 0x2B55 || (code >= 0x23E9 && code <= 0x23EC) ||
      code === 0x23F0 || code === 0x23F3 || (code >= 0x231A && code <= 0x231B) ||
      (code >= 0x23F8 && code <= 0x23FA) || code === 0x24C2 ||
      (code >= 0x1F3FB && code <= 0x1F3FF) ||
      (code >= 0x1F3E0 && code <= 0x1F3F4) ||
      (code >= 0x1F3F8 && code <= 0x1F43F) ||
      code === 0x1F440 || (code >= 0x1F442 && code <= 0x1F4FF) ||
      (code >= 0x1F500 && code <= 0x1F53D) ||
      (code >= 0x1F54B && code <= 0x1F54E) ||
      (code >= 0x1F550 && code <= 0x1F567) ||
      (code >= 0x1F595 && code <= 0x1F596) ||
      (code >= 0x1F5FB && code <= 0x1F64F) ||
      (code >= 0x1F680 && code <= 0x1F6C5) ||
      (code >= 0x1F6CB && code <= 0x1F6D2) ||
      (code >= 0x1F6E0 && code <= 0x1F6E5) ||
      code === 0x1F6E9 || (code >= 0x1F6EB && code <= 0x1F6EC) ||
      code === 0x1F6F0 || (code >= 0x1F6F3 && code <= 0x1F6F8) ||
      (code >= 0x1F910 && code <= 0x1F93A) ||
      (code >= 0x1F93C && code <= 0x1F93E) ||
      (code >= 0x1F940 && code <= 0x1F945) ||
      (code >= 0x1F947 && code <= 0x1F94C) ||
      (code >= 0x1F950 && code <= 0x1F96B) ||
      (code >= 0x1F980 && code <= 0x1F997) ||
      code === 0x1F9C0 || (code >= 0x1F9D0 && code <= 0x1F9E6)
    );
    if (!isEmojiChar) return false;
  }
  return true;
};

// ==================== SAFE AVATAR COMPONENT (matches SwitchBabyScreen & FamilySharingScreen) ====================
const SafeAvatar: React.FC<{
  avatar?: string | null;
  size?: number;
  fallbackEmoji?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackColor?: string;
  showStatus?: boolean;
  statusColor?: string;
}> = ({ 
  avatar, 
  size = 60, 
  fallbackEmoji = '👤', 
  fallbackIcon = 'person', 
  fallbackColor = '#667eea',
  showStatus = false,
  statusColor = '#10b981'
}) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={[`${fallbackColor}20`, `${fallbackColor}40`]}
        style={[
          styles.avatarGradient, 
          { width: size, height: size, borderRadius: size / 2.8 }
        ]}
      >
        {hasImage ? (
          <Image 
            source={{ uri: avatar! }} 
            style={{ width: size, height: size, borderRadius: size / 2.8 }}
            resizeMode="cover"
            onError={(e) => console.log('Avatar image error:', e.nativeEvent.error)}
          />
        ) : hasEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{avatar}</Text>
        ) : (
          <Ionicons name={fallbackIcon} size={size * 0.4} color={fallbackColor} />
        )}
      </LinearGradient>
      
      {showStatus && (
        <View style={[
          styles.avatarStatus,
          { backgroundColor: statusColor, borderColor: '#fff' }
        ]} />
      )}
    </View>
  );
};

// ==================== SWEET ALERT COMPONENT ====================
const SweetAlertChatList: React.FC<{
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}> = ({ visible, type, title, message, onClose }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 });
      opacity.value = withSpring(1);
      const timer = setTimeout(() => {
        scale.value = withSpring(0);
        opacity.value = withSpring(0, {}, () => runOnJS(onClose)());
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, scale, opacity, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View 
        entering={FadeIn.springify()}
        style={[
          styles.alertContainer, 
          { 
            transform: [{ scale: scale.value }], 
            opacity: opacity.value 
          }
        ]}
      >
        <LinearGradient
          colors={[colors[type], `${colors[type]}dd`]}
          style={styles.alertGradient}
        >
          <Ionicons 
            name={type === 'success' ? 'checkmark-circle' : type === 'error' ? 'close-circle' : type === 'warning' ? 'warning' : 'information-circle'} 
            size={56} 
            color="#fff" 
          />
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertDismiss} onPress={onClose}>
            <Text style={styles.alertDismissText}>Tap to dismiss</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

// ==================== USER BUBBLE COMPONENT (UPDATED with SafeAvatar) ====================
const UserBubble: React.FC<{
  member: FamilyMember;
  isSelected: boolean;
  onPress: () => void;
  isDark: boolean;
  disabled?: boolean;
}> = ({ member, isSelected, onPress, isDark, disabled }) => {
  const getRoleColor = () => {
    switch (member.role) {
      case 'parent1': return '#667eea';
      case 'parent2': return '#fa709a';
      case 'guardian': return '#11998e';
      default: return '#64748b';
    }
  };

  const getOnlineStatus = (): 'online' | 'away' | 'offline' => {
    if (!member.lastActive) return 'offline';
    const minutesSince = (Date.now() - new Date(member.lastActive).getTime()) / 1000 / 60;
    if (minutesSince < 5) return 'online';
    if (minutesSince < 30) return 'away';
    return 'offline';
  };

  const onlineStatus = getOnlineStatus();
  const statusColors = {
    online: '#10b981',
    away: '#f59e0b',
    offline: '#6b7280',
  };

  const roleColor = getRoleColor();

  return (
    <TouchableOpacity 
      style={[
        styles.userBubble, 
        isSelected && styles.userBubbleSelected, 
        disabled && styles.userBubbleDisabled
      ]} 
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      {/* REPLACED: Raw emoji text with SafeAvatar */}
      <SafeAvatar 
        avatar={member.avatar}
        size={60}
        fallbackEmoji={member.role === 'parent1' ? '👑' : '👤'}
        fallbackIcon={member.role === 'parent1' ? 'shield' : member.role === 'parent2' ? 'heart' : 'person'}
        fallbackColor={roleColor}
        showStatus={true}
        statusColor={statusColors[onlineStatus]}
      />
      
      <Text style={[styles.userBubbleName, isDark && styles.textDark]} numberOfLines={1}>
        {member.fullName.split(' ')[0]}
      </Text>
      <Text style={[styles.userBubbleRole, { color: roleColor }]}>
        {member.role === 'parent1' ? 'Primary' : member.role === 'parent2' ? 'Co-Parent' : 'Guardian'}
      </Text>
      
      {isSelected && (
        <View style={styles.userBubbleCheck}>
          <Ionicons name="checkmark-circle" size={20} color="#667eea" />
        </View>
      )}
      {disabled && (
        <View style={styles.userBubbleDisabledOverlay}>
          <Ionicons name="ban" size={16} color="#999" />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ==================== TYPING INDICATOR COMPONENT ====================
const TypingIndicator: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <View style={styles.typingContainer}>
    <View style={[styles.typingDot, { backgroundColor: isDark ? '#667eea' : '#667eea' }]} />
    <View style={[styles.typingDot, { backgroundColor: isDark ? '#667eea' : '#667eea' }]} />
    <View style={[styles.typingDot, { backgroundColor: isDark ? '#667eea' : '#667eea' }]} />
  </View>
);

// ==================== PRESENCE BADGE COMPONENT ====================
const PresenceBadge: React.FC<{ 
  status: 'online' | 'away' | 'offline';
  size?: number;
}> = ({ status, size = 14 }) => {
  const colors = {
    online: '#10b981',
    away: '#f59e0b',
    offline: '#6b7280',
  };

  return (
    <View style={[
      styles.presenceBadge, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: colors[status],
        borderWidth: 2,
        borderColor: '#fff',
      }
    ]} />
  );
};

// ==================== CHAT LIST ITEM COMPONENT (UPDATED with SafeAvatar for direct chats) ====================
const ChatListItem: React.FC<{
  chat: FamilyChat;
  isDark: boolean;
  onPress: () => void;
  onLongPress: () => void;
  unreadCount: number;
  isTyping?: boolean;
  onlineStatus?: 'online' | 'away' | 'offline';
  lastMessagePreview?: string;
}> = ({ 
  chat, 
  isDark, 
  onPress, 
  onLongPress, 
  unreadCount, 
  isTyping, 
  onlineStatus,
  lastMessagePreview 
}) => {
  const getChatIcon = () => {
    if (chat.type === 'group') return '👨‍👩‍👧‍👦';
    return chat.avatar || '👤';
  };

  const getChatSubtitle = () => {
    if (chat.type === 'group') {
      return `${chat.participants?.length || 0} family members`;
    }
    if (chat.participantRoles) {
      const otherId = chat.participants.find(p => p !== chat.participantRoles?.[p]);
      const role = otherId ? chat.participantRoles[otherId] : '';
      return role === 'parent1' ? 'Primary Parent' : 
             role === 'parent2' ? 'Co-Parent' : 
             role === 'guardian' ? 'Guardian' : 'Family Member';
    }
    return 'Direct Message';
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getLastMessagePreview = (msg?: FamilyMessage) => {
    if (!msg) return 'No messages yet';
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'voice') return '🎤 Voice message';
    if (msg.type === 'file') return '📎 File';
    if (msg.type === 'system') return msg.content;
    if (msg.content.length > 30) return msg.content.substring(0, 30) + '...';
    return msg.content;
  };

  // For direct chats, use SafeAvatar; for groups, use emoji/icon
  const isDirect = chat.type === 'direct';
  const otherParticipantId = isDirect ? chat.participants.find(p => p !== chat.participantRoles?.[p]) : null;
  const otherAvatar = otherParticipantId ? chat.participantAvatars?.[otherParticipantId] : null;
  const otherRole = otherParticipantId ? chat.participantRoles?.[otherParticipantId] : null;

  return (
    <Animated.View entering={FadeInUp} layout={Layout.springify()}>
      <TouchableOpacity 
        style={[
          styles.chatItem, 
          isDark && styles.chatItemDark,
          chat.isPinned && styles.pinnedItem,
          unreadCount > 0 && styles.unreadItem
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <View style={[
          styles.avatarContainer, 
          { backgroundColor: chat.type === 'group' ? '#667eea20' : '#fa709a20' }
        ]}>
          {isDirect && otherAvatar ? (
            <SafeAvatar 
              avatar={otherAvatar}
              size={56}
              fallbackEmoji="👤"
              fallbackIcon={otherRole === 'parent1' ? 'shield' : otherRole === 'parent2' ? 'heart' : 'person'}
              fallbackColor={otherRole === 'parent1' ? '#667eea' : otherRole === 'parent2' ? '#fa709a' : '#11998e'}
            />
          ) : (
            <>
              <Text style={styles.avatarEmoji}>{getChatIcon()}</Text>
              {chat.type === 'group' ? (
                <View style={styles.groupIndicator}>
                  <Ionicons name="people" size={10} color="#fff" />
                </View>
              ) : onlineStatus && (
                <View style={styles.onlineIndicator}>
                  <PresenceBadge status={onlineStatus} size={12} />
                </View>
              )}
            </>
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[
              styles.chatName, 
              isDark && styles.textDark,
              unreadCount > 0 && styles.unreadText
            ]} numberOfLines={1}>
              {chat.name}
            </Text>
            {chat.lastMessage && (
              <Text style={[
                styles.timestamp,
                unreadCount > 0 && styles.unreadTimestamp
              ]}>
                {formatTime(chat.lastMessage.timestamp)}
              </Text>
            )}
          </View>
          
          <Text style={styles.subtitle} numberOfLines={1}>
            {getChatSubtitle()}
          </Text>
          
          <View style={styles.messagePreview}>
            {isTyping ? (
              <View style={styles.typingRow}>
                <Text style={[styles.typingLabel, isDark && styles.textMuted]}>
                  typing
                </Text>
                <TypingIndicator isDark={isDark} />
              </View>
            ) : (
              <>
                {chat.lastMessage?.senderId !== 'system' && chat.lastMessage && (
                  <Text style={[
                    styles.senderName, 
                    isDark && styles.textMuted,
                    unreadCount > 0 && styles.unreadSender
                  ]}>
                    {chat.lastMessage.senderName === 'You' ? 'You: ' : `${chat.lastMessage.senderName.split(' ')[0]}: `}
                  </Text>
                )}
                <Text style={[
                  styles.lastMessage, 
                  isDark && styles.lastMessageDark,
                  unreadCount > 0 && styles.unreadLastMessage
                ]} numberOfLines={1}>
                  {getLastMessagePreview(chat.lastMessage)}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.rightSection}>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
          {chat.isMuted && (
            <Ionicons name="volume-mute" size={16} color={isDark ? '#555' : '#999'} style={styles.muteIcon} />
          )}
          {chat.isPinned && (
            <Ionicons name="pin" size={14} color="#667eea" style={styles.pinIcon} />
          )}
          <Ionicons name="chevron-forward" size={20} color={isDark ? '#555' : '#ccc'} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== MEMBER AVATAR STACK COMPONENT (UPDATED with SafeAvatar) ====================
const MemberAvatarStack: React.FC<{ 
  members: FamilyMember[]; 
  isDark: boolean;
  maxDisplay?: number;
}> = ({ members, isDark, maxDisplay = 3 }) => {
  const displayMembers = members.slice(0, maxDisplay);
  const remaining = members.length - maxDisplay;

  return (
    <View style={styles.avatarStack}>
      {displayMembers.map((member, index) => (
        <View 
          key={member.id} 
          style={[
            styles.stackAvatar,
            { 
              marginLeft: index > 0 ? -12 : 0,
              zIndex: displayMembers.length - index,
            }
          ]}
        >
          <SafeAvatar 
            avatar={member.avatar}
            size={32}
            fallbackEmoji="👤"
            fallbackIcon={member.role === 'parent1' ? 'shield' : member.role === 'parent2' ? 'heart' : 'person'}
            fallbackColor={member.role === 'parent1' ? '#667eea' : member.role === 'parent2' ? '#fa709a' : '#11998e'}
          />
        </View>
      ))}
      {remaining > 0 && (
        <View style={[styles.stackAvatar, styles.stackAvatarMore, { marginLeft: -12 }]}>
          <Text style={[styles.stackAvatarText, { fontSize: 12 }]}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
};

// ==================== MAIN SCREEN ====================
export default function FamilyChatListScreen({ navigation }: FamilyChatListScreenProps) {
  const { 
    chats, 
    getUnreadCount, 
    getOrCreateDirectChat, 
    shareFamilyCode,
    deleteChat,
    pinChat,
    muteChat,
    isLoading,
    getTypingUsers,
  } = useFamilyChat();
  const { members, parent1, parent2, guardians } = useFamily();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedChat, setSelectedChat] = useState<FamilyChat | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Sweet Alert state
  const [alert, setAlert] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Filter out current user from members - CANNOT CHAT WITH SELF
  const otherMembers = useMemo(() => {
    return members.filter(m => m.id !== userProfile?.id && m.userId !== userProfile?.id);
  }, [members, userProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1000);
  }, []);

  const showSweetAlert = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
  };

  // ==================== PHOTO HANDLERS (from EditProfileScreen) ====================
  const getPermanentImagePath = (prefix: string) => {
    const dir = FileSystem.documentDirectory + 'group_images/';
    return `${dir}${prefix}_${Date.now()}.jpg`;
  };

  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'group_images/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showSweetAlert('error', 'Permission Required', 'Please allow access to your camera.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const tempUri = result.assets[0].uri;
        const permanentUri = getPermanentImagePath('group');
        await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
        setGroupPhoto(permanentUri);
        setIsUploading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Camera error:', error);
      showSweetAlert('error', 'Error', 'Failed to capture photo');
      setIsUploading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSweetAlert('error', 'Permission Required', 'Please allow access to your photo library.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsUploading(true);
        await ensureDirExists();
        const tempUri = result.assets[0].uri;
        const permanentUri = getPermanentImagePath('group');
        await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
        setGroupPhoto(permanentUri);
        setIsUploading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      showSweetAlert('error', 'Error', 'Failed to pick photo');
      setIsUploading(false);
    }
  };

  const handleChatPress = async (chat: FamilyChat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (chat.type === 'direct') {
      const otherId = chat.participants.find(p => p !== userProfile?.id);
      const member = otherId ? members.find(m => m.id === otherId) : undefined;
      
      navigation.navigate('FamilyChat', { 
        chatId: chat.id,
        memberId: otherId,
        memberName: member?.fullName || chat.name,
        memberAvatar: member?.avatar || chat.avatar,
        memberRole: member?.role,
        familyCode: chat.familyCode,
      });
    } else {
      navigation.navigate('FamilyChat', { 
        chatId: chat.id,
        familyCode: chat.familyCode,
      });
    }
  };

  const handleMemberPress = async (member: FamilyMember) => {
    if (member.id === userProfile?.id || member.userId === userProfile?.id) {
      showSweetAlert('warning', 'Cannot Chat', 'You cannot start a chat with yourself!');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const chatId = await getOrCreateDirectChat(member.id, member);
    
    navigation.navigate('FamilyChat', {
      chatId,
      memberId: member.id,
      memberName: member.fullName,
      memberAvatar: member.avatar,
      memberRole: member.role,
    });
  };

  const handleLongPress = (chat: FamilyChat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedChat(chat);
    setShowOptionsModal(true);
  };

  const handleShareCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await shareFamilyCode();
    showSweetAlert('success', 'Shared!', 'Family code has been shared');
  };

  const handleDeleteChat = () => {
    if (!selectedChat) return;
    
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${selectedChat.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowOptionsModal(false) },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteChat(selectedChat.id);
            setShowOptionsModal(false);
            setSelectedChat(null);
            showSweetAlert('success', 'Deleted', 'Chat has been removed');
          }
        },
      ]
    );
  };

  const handlePinChat = async () => {
    if (!selectedChat) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await pinChat(selectedChat.id, !selectedChat.isPinned);
    setShowOptionsModal(false);
    showSweetAlert(
      'success', 
      selectedChat.isPinned ? 'Unpinned' : 'Pinned',
      selectedChat.isPinned ? 'Chat unpinned from top' : 'Chat pinned to top'
    );
  };

  const handleMuteChat = async () => {
    if (!selectedChat) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await muteChat(selectedChat.id, !selectedChat.isMuted);
    setShowOptionsModal(false);
    showSweetAlert(
      'info',
      selectedChat.isMuted ? 'Unmuted' : 'Muted',
      selectedChat.isMuted ? 'Notifications enabled' : 'Notifications silenced'
    );
  };

  const handleCreateGroup = async () => {
    if (selectedMembers.length < 2) {
      showSweetAlert('warning', 'Select Members', 'Please select at least 2 members to create a group');
      return;
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSweetAlert('success', 'Group Created! 🎉', `Created group with ${selectedMembers.length} members`);
    setShowNewChatModal(false);
    setSelectedMembers([]);
    setGroupName('');
    setGroupPhoto(null);
  };

  const toggleMemberSelection = (memberId: string) => {
    if (memberId === userProfile?.id) {
      showSweetAlert('warning', 'Cannot Select', 'You cannot add yourself to a group');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const getOnlineStatus = (memberId: string): 'online' | 'away' | 'offline' => {
    const lastActive = members.find(m => m.id === memberId)?.lastActive;
    if (!lastActive) return 'offline';
    const minutesSince = (Date.now() - new Date(lastActive).getTime()) / 1000 / 60;
    if (minutesSince < 5) return 'online';
    if (minutesSince < 30) return 'away';
    return 'offline';
  };

  const isUserTyping = (chatId: string): boolean => {
    const typingUsers = getTypingUsers(chatId);
    return typingUsers.some(u => u.userId !== userProfile?.id);
  };

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    return chats.filter(chat => 
      chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.participantNames && Object.values(chat.participantNames).some(name => 
        name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [chats, searchQuery]);

  const sortedChats = useMemo(() => {
    return [...filteredChats].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredChats]);

  const totalUnread = useMemo(() => {
    return chats.reduce((sum, chat) => sum + (chat.isMuted ? 0 : chat.unreadCount), 0);
  }, [chats]);

  const renderMemberGrid = () => (
    <View style={styles.membersSection}>
      <View style={styles.membersHeader}>
        <Text style={[styles.sectionTitle, isDark && styles.textDark]}>Family Members</Text>
        <TouchableOpacity onPress={() => setShowNewChatModal(true)}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.newGroupBadge}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newGroupText}>Group</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.membersScroll}
      >
        {otherMembers.map((member, index) => (
          <Animated.View key={member.id} entering={FadeInRight.delay(index * 50)}>
            <UserBubble
              member={member}
              isSelected={false}
              onPress={() => handleMemberPress(member)}
              isDark={isDark}
            />
          </Animated.View>
        ))}
        
        <TouchableOpacity style={styles.addMemberItem} onPress={handleShareCode}>
          <View style={[styles.memberAvatar, { backgroundColor: '#667eea20' }]}>
            <Ionicons name="person-add" size={24} color="#667eea" />
          </View>
          <Text style={[styles.memberName, isDark && styles.textDark]}>Invite</Text>
          <Text style={styles.memberRole}>New Member</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statItem, isDark && styles.statItemDark]}>
          <Text style={styles.statNumber}>{members.length}</Text>
          <Text style={[styles.statLabel, isDark && styles.textMuted]}>Members</Text>
        </View>
        <View style={[styles.statDivider, isDark && styles.statDividerDark]} />
        <View style={[styles.statItem, isDark && styles.statItemDark]}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>
            {members.filter(m => getOnlineStatus(m.id) === 'online').length}
          </Text>
          <Text style={[styles.statLabel, isDark && styles.textMuted]}>Online</Text>
        </View>
        <View style={[styles.statDivider, isDark && styles.statDividerDark]} />
        <View style={[styles.statItem, isDark && styles.statItemDark]}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{totalUnread}</Text>
          <Text style={[styles.statLabel, isDark && styles.textMuted]}>Unread</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <SweetAlertChatList
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert(prev => ({ ...prev, visible: false }))}
      />
      
      <LinearGradient 
        colors={isDark ? ['#0a0a0a', '#1a1a2e'] : ['#f8faff', '#e0e7ff']} 
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <BlurView intensity={90} style={[styles.header, { paddingTop: insets.top + 10 }]} tint={isDark ? 'dark' : 'light'}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
          </TouchableOpacity>
          
          {showSearch ? (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={isDark ? '#666' : '#999'} />
              <TextInput
                style={[styles.searchInput, isDark && styles.searchInputDark]}
                placeholder="Search chats..."
                placeholderTextColor={isDark ? '#666' : '#999'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setSearchQuery(''); setShowSearch(false); }}>
                <Ionicons name="close" size={20} color={isDark ? '#666' : '#999'} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, isDark && styles.textDark]}>Family Chat</Text>
              {totalUnread > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{totalUnread}</Text>
                </View>
              )}
            </View>
          )}
          
          <View style={styles.headerActions}>
            {!showSearch && (
              <TouchableOpacity style={styles.headerButton} onPress={() => setShowSearch(true)}>
                <Ionicons name="search" size={22} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.headerButton, styles.primaryButton]} onPress={handleShareCode}>
              <Ionicons name="person-add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      <FlatList
        data={sortedChats}
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            isDark={isDark}
            onPress={() => handleChatPress(item)}
            onLongPress={() => handleLongPress(item)}
            unreadCount={getUnreadCount(item.id)}
            isTyping={isUserTyping(item.id)}
            onlineStatus={item.type === 'direct' ? 
              getOnlineStatus(item.participants.find(p => p !== userProfile?.id) || '') : 
              undefined
            }
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContainer, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        ListHeaderComponent={renderMemberGrid}
        ListEmptyComponent={
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={[styles.emptyTitle, isDark && styles.textDark]}>No chats yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap on a family member above to start chatting
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setShowNewChatModal(true)}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.emptyButtonGradient}>
                <Text style={styles.emptyButtonText}>Start Group Chat</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        }
      />

      {/* Options Modal */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowOptionsModal(false)}
        >
          <BlurView intensity={90} style={styles.modalContent} tint={isDark ? 'dark' : 'light'}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>
                {selectedChat?.name}
              </Text>
              {selectedChat?.type === 'direct' && (
                <MemberAvatarStack 
                  members={selectedChat.participants
                    .map(id => members.find(m => m.id === id))
                    .filter((m): m is FamilyMember => m !== undefined)}
                  isDark={isDark}
                />
              )}
            </View>
            
            <TouchableOpacity style={styles.modalOption} onPress={handlePinChat}>
              <View style={[styles.modalIcon, { backgroundColor: '#667eea20' }]}>
                <Ionicons 
                  name={selectedChat?.isPinned ? "pin-off" : "pin"} 
                  size={22} 
                  color="#667eea" 
                />
              </View>
              <Text style={[styles.modalOptionText, isDark && styles.textDark]}>
                {selectedChat?.isPinned ? 'Unpin Chat' : 'Pin Chat'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={handleMuteChat}>
              <View style={[styles.modalIcon, { backgroundColor: '#11998e20' }]}>
                <Ionicons 
                  name={selectedChat?.isMuted ? "volume-high" : "volume-mute"} 
                  size={22} 
                  color="#11998e" 
                />
              </View>
              <Text style={[styles.modalOptionText, isDark && styles.textDark]}>
                {selectedChat?.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={() => {
              setShowOptionsModal(false);
            }}>
              <View style={[styles.modalIcon, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="information-circle" size={22} color="#f59e0b" />
              </View>
              <Text style={[styles.modalOptionText, isDark && styles.textDark]}>
                Chat Details
              </Text>
            </TouchableOpacity>
            
            {selectedChat?.type === 'direct' && (
              <TouchableOpacity style={styles.modalOption} onPress={handleDeleteChat}>
                <View style={[styles.modalIcon, { backgroundColor: '#ff475720' }]}>
                  <Ionicons name="trash" size={22} color="#ff4757" />
                </View>
                <Text style={[styles.modalOptionText, { color: '#ff4757' }]}>
                  Delete Chat
                </Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </TouchableOpacity>
      </Modal>

      {/* New Group Chat Modal (UPDATED with photo capture) */}
      <Modal
        visible={showNewChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <View style={styles.newChatOverlay}>
          <BlurView intensity={100} style={styles.newChatContent} tint={isDark ? 'dark' : 'light'}>
            <View style={styles.newChatHeader}>
              <Text style={[styles.newChatTitle, isDark && styles.textDark]}>New Group Chat</Text>
              <TouchableOpacity onPress={() => setShowNewChatModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a1a'} />
              </TouchableOpacity>
            </View>

            {/* Group Photo Section (NEW) */}
            <View style={styles.groupPhotoSection}>
              <TouchableOpacity 
                style={styles.groupPhotoContainer}
                onPress={() => {
                  Alert.alert(
                    'Group Photo',
                    'Choose a photo for your group',
                    [
                      { text: 'Camera', onPress: handleTakePhoto },
                      { text: 'Gallery', onPress: handlePickImage },
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }}
              >
                {groupPhoto ? (
                  <Image 
                    source={{ uri: groupPhoto }} 
                    style={styles.groupPhotoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient 
                    colors={['#667eea20', '#764ba220']} 
                    style={styles.groupPhotoPlaceholder}
                  >
                    <Ionicons name="camera" size={32} color="#667eea" />
                  </LinearGradient>
                )}
                {isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                <View style={styles.groupPhotoEditBadge}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.groupPhotoLabel, isDark && styles.textMuted]}>
                {groupPhoto ? 'Tap to change' : 'Add group photo'}
              </Text>
            </View>

            <TextInput
              style={[styles.groupNameInput, isDark && styles.groupNameInputDark]}
              placeholder="Group Name (optional)"
              placeholderTextColor={isDark ? '#666' : '#999'}
              value={groupName}
              onChangeText={setGroupName}
            />

            <Text style={[styles.selectLabel, isDark && styles.textDark]}>Select Members</Text>
            
            <ScrollView style={styles.memberSelectList}>
              {otherMembers.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberSelectItem,
                    selectedMembers.includes(member.id) && styles.memberSelectItemActive,
                    isDark && styles.memberSelectItemDark
                  ]}
                  onPress={() => toggleMemberSelection(member.id)}
                >
                  {/* UPDATED: Use SafeAvatar instead of raw emoji */}
                  <SafeAvatar 
                    avatar={member.avatar}
                    size={48}
                    fallbackEmoji="👤"
                    fallbackIcon={member.role === 'parent1' ? 'shield' : member.role === 'parent2' ? 'heart' : 'person'}
                    fallbackColor={member.role === 'parent1' ? '#667eea' : member.role === 'parent2' ? '#fa709a' : '#11998e'}
                  />
                  <View style={styles.memberSelectInfo}>
                    <Text style={[styles.memberSelectName, isDark && styles.textDark]}>
                      {member.fullName}
                    </Text>
                    <Text style={styles.memberSelectRole}>
                      {member.role === 'parent1' ? 'Primary Parent' : 
                       member.role === 'parent2' ? 'Co-Parent' : 'Guardian'}
                    </Text>
                  </View>
                  {selectedMembers.includes(member.id) && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color="#667eea" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[
                styles.createButton,
                selectedMembers.length < 2 && styles.createButtonDisabled
              ]}
              onPress={handleCreateGroup}
              disabled={selectedMembers.length < 2}
            >
              <LinearGradient 
                colors={selectedMembers.length >= 2 ? ['#667eea', '#764ba2'] : ['#ccc', '#ccc']} 
                style={styles.createButtonGradient}
              >
                <Text style={styles.createButtonText}>
                  Create Group ({selectedMembers.length})
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#0a0a0a' },
  
  // SafeAvatar styles (NEW - matching SwitchBabyScreen)
  avatarWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {},
  avatarStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },

  // SweetAlert
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alertContainer: {
    width: width * 0.85,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  alertGradient: {
    padding: 28,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  alertDismiss: {
    marginTop: 8,
  },
  alertDismissText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  // User Bubbles (UPDATED - removed old avatar styles, now handled by SafeAvatar)
  userBubble: {
    alignItems: 'center',
    width: 70,
    marginRight: 12,
  },
  userBubbleSelected: {
    opacity: 0.7,
  },
  userBubbleDisabled: {
    opacity: 0.4,
  },
  userBubbleDisabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBubbleName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginTop: 6,
  },
  userBubbleRole: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  userBubbleCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#667eea',
    marginLeft: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerBadge: {
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 8,
  },
  searchInputDark: {
    color: '#fff',
  },
  textDark: { color: '#ffffff' },
  textMuted: { color: '#94a3b8' },

  // Members Section
  membersSection: {
    marginBottom: 20,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  newGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  newGroupText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  membersScroll: {
    paddingHorizontal: 4,
    gap: 16,
  },
  memberItem: {
    alignItems: 'center',
    width: 70,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  memberAvatarText: {
    fontSize: 28,
  },
  memberStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  memberRole: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  addMemberItem: {
    alignItems: 'center',
    width: 70,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statItemDark: {},
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  statDividerDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Chat List
  listContainer: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  chatItemDark: {
    backgroundColor: 'rgba(30,30,35,0.9)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pinnedItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  unreadItem: {
    backgroundColor: 'rgba(102,126,234,0.05)',
    borderColor: 'rgba(102,126,234,0.2)',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  groupIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  unreadText: {
    color: '#1a1a1a',
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
  },
  unreadTimestamp: {
    color: '#667eea',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderName: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginRight: 4,
  },
  unreadSender: {
    color: '#667eea',
  },
  lastMessage: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  lastMessageDark: {
    color: '#94a3b8',
  },
  unreadLastMessage: {
    color: '#1a1a1a',
    fontWeight: '500',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingLabel: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
    marginRight: 4,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
    opacity: 0.4,
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  unreadBadge: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  muteIcon: {
    marginBottom: 4,
  },
  pinIcon: {
    marginBottom: 4,
  },

  // Avatar Stack
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stackAvatarMore: {
    backgroundColor: '#e2e8f0',
  },
  stackAvatarText: {
    fontSize: 14,
  },
  presenceBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width - 60,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },

  // New Chat Modal (UPDATED with photo styles)
  newChatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  newChatContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  newChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  newChatTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  
  // Group Photo Section (NEW)
  groupPhotoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  groupPhotoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 30,
    overflow: 'hidden',
  },
  groupPhotoImage: {
    width: 100,
    height: 100,
    borderRadius: 30,
  },
  groupPhotoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPhotoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  groupPhotoLabel: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },

  groupNameInput: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 20,
  },
  groupNameInputDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },
  selectLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  memberSelectList: {
    maxHeight: 300,
  },
  memberSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  memberSelectItemDark: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  memberSelectItemActive: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.3)',
  },
  memberSelectInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberSelectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  memberSelectRole: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  checkmark: {
    marginLeft: 8,
  },
  createButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});