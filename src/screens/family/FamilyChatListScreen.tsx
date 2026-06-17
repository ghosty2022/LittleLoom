import { StyleSheet, ActivityIndicator, Alert, Button, Dimensions ,FlatList ,Image ,Modal ,Platform, RefreshControl ,ScrollView, Switch ,Text ,TextInput, TouchableOpacity, View } from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AutoHideFlatList } from '../../components/AutoHideScrollWrappers';
import { BlurView } from 'expo-blur';
import { EmptyState } from '../../components/EmptyState';
import { AutoHideAnimatedScrollView } from '../../components/AutoHideScrollWrappers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeInRight, FadeIn, SlideInRight, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { FamilyChat, FamilyMessage, useFamilyChat } from '../../context/FamilyChatContext';
import { FamilyMember, useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { showAlert } from '@/utils/alert';

type FamilyChatListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FamilyChatList'
>;

const { width, height } = Dimensions.get('window');

const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return (
    value.startsWith('http') ||
    value.startsWith('file://') ||
    value.startsWith('data:')
  );
};

const isEmoji = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value.length > 4) return false;
  for (const char of value) {
    const code = char.codePointAt(0) || 0;
    const isEmojiChar =
      (code >= 0x1f600 && code <= 0x1f64f) ||
      (code >= 0x1f300 && code <= 0x1f5ff) ||
      (code >= 0x1f680 && code <= 0x1f6ff) ||
      (code >= 0x1f1e0 && code <= 0x1f1ff) ||
      (code >= 0x2600 && code <= 0x26ff) ||
      (code >= 0x2700 && code <= 0x27bf) ||
      (code >= 0x1f900 && code <= 0x1f9ff) ||
      (code >= 0x1f018 && code <= 0x1f270) ||
      code === 0x238c ||
      code === 0x2b06 ||
      code === 0x2b07 ||
      code === 0x2b05 ||
      code === 0x27a1 ||
      (code >= 0x2194 && code <= 0x2199) ||
      (code >= 0x21a9 && code <= 0x21aa) ||
      (code >= 0x2934 && code <= 0x2935) ||
      (code >= 0x25aa && code <= 0x25ab) ||
      (code >= 0x25fb && code <= 0x25fe) ||
      code === 0x25b6 ||
      code === 0x25c0 ||
      (code >= 0x1f200 && code <= 0x1f251) ||
      code === 0x1f004 ||
      code === 0x1f0cf ||
      (code >= 0x1f170 && code <= 0x1f171) ||
      (code >= 0x1f17e && code <= 0x1f17f) ||
      code === 0x1f18e ||
      code === 0x3030 ||
      code === 0x2b50 ||
      code === 0x2b55 ||
      (code >= 0x23e9 && code <= 0x23ec) ||
      code === 0x23f0 ||
      code === 0x23f3 ||
      (code >= 0x231a && code <= 0x231b) ||
      (code >= 0x23f8 && code <= 0x23fa) ||
      code === 0x24c2 ||
      (code >= 0x1f3fb && code <= 0x1f3ff) ||
      (code >= 0x1f3e0 && code <= 0x1f3f4) ||
      (code >= 0x1f3f8 && code <= 0x1f43f) ||
      code === 0x1f440 ||
      (code >= 0x1f442 && code <= 0x1f4ff) ||
      (code >= 0x1f500 && code <= 0x1f53d) ||
      (code >= 0x1f54b && code <= 0x1f54e) ||
      (code >= 0x1f550 && code <= 0x1f567) ||
      (code >= 0x1f595 && code <= 0x1f596) ||
      (code >= 0x1f5fb && code <= 0x1f64f) ||
      (code >= 0x1f680 && code <= 0x1f6c5) ||
      (code >= 0x1f6cb && code <= 0x1f6d2) ||
      (code >= 0x1f6e0 && code <= 0x1f6e5) ||
      code === 0x1f6e9 ||
      (code >= 0x1f6eb && code <= 0x1f6ec) ||
      code === 0x1f6f0 ||
      (code >= 0x1f6f3 && code <= 0x1f6f8) ||
      (code >= 0x1f910 && code <= 0x1f93a) ||
      (code >= 0x1f93c && code <= 0x1f93e) ||
      (code >= 0x1f940 && code <= 0x1f945) ||
      (code >= 0x1f947 && code <= 0x1f94c) ||
      (code >= 0x1f950 && code <= 0x1f96b) ||
      (code >= 0x1f980 && code <= 0x1f997) ||
      code === 0x1f9c0 ||
      (code >= 0x1f9d0 && code <= 0x1f9e6);
    if (!isEmojiChar) return false;
  }
  return true;
};

const SafeAvatar: React.FC<
  {
    avatar?: string | null;
    size?: number;
    fallbackEmoji?: string;
    fallbackIcon?: keyof typeof Ionicons.glyphMap;
    fallbackColor?: string;
    showStatus?: boolean;
    statusColor?: string;
  }
> = ({
  avatar,
  size = 60,
  fallbackEmoji = '👤',
  fallbackIcon = 'person',
  fallbackColor = '#667eea',
  showStatus = false,
  statusColor = '#10b981',
}) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={[`${fallbackColor}20`, `${fallbackColor}40`]}
        style={[
          styles.avatarGradient,
          { width: size, height: size, borderRadius: size / 2.8 },
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
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>
            {avatar}
          </Text>
        ) : (
          <Ionicons
            name={fallbackIcon}
            size={size * 0.4}
            color={fallbackColor}
          />
        )}
      </LinearGradient>

      {showStatus && (
        <View
          style={[
            styles.avatarStatus,
            { backgroundColor: statusColor, borderColor: '#fff' },
          ]}
        />
      )}
    </View>
  );
};

const SweetAlertChatList: React.FC<
  {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    onClose: () => void;
    theme: ChatTheme;
  }
> = ({ visible, type, title, message, onClose, theme }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const colors = {
    success: theme.success,
    error: theme.error,
    warning: theme.accent,
    info: theme.info,
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
            opacity: opacity.value,
          },
        ]}
      >
        <LinearGradient
          colors={[colors[type], `${colors[type]}dd`]}
          style={styles.alertGradient}
        >
          <Ionicons
            name={
              type === 'success'
                ? 'checkmark-circle'
                : type === 'error'
                ? 'close-circle'
                : type === 'warning'
                ? 'warning'
                : 'information-circle'
            }
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

const UserBubble: React.FC<
  {
    member: FamilyMember;
    isSelected: boolean;
    onPress: () => void;
    theme: ChatTheme;
    disabled?: boolean;
  }
> = ({ member, isSelected, onPress, theme, disabled }) => {
  const getRoleColor = () => {
    switch (member.role) {
      case 'parent1':
        return theme.primary;
      case 'parent2':
        return theme.secondary;
      case 'guardian':
        return theme.accent;
      default:
        return theme.text.tertiary;
    }
  };

  const getOnlineStatus = (): 'online' | 'away' | 'offline' => {
    if (!member.lastActive) return 'offline';
    const minutesSince =
      (Date.now() - new Date(member.lastActive).getTime()) / 1000 / 60;
    if (minutesSince < 5) return 'online';
    if (minutesSince < 30) return 'away';
    return 'offline';
  };

  const onlineStatus = getOnlineStatus();
  const statusColors = {
    online: theme.success,
    away: theme.accent,
    offline: theme.text.tertiary,
  };

  const roleColor = getRoleColor();

  return (
    <TouchableOpacity
      style={[
        styles.userBubble,
        isSelected && styles.userBubbleSelected,
        disabled && styles.userBubbleDisabled,
      ]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      <SafeAvatar
        avatar={member.avatar}
        size={60}
        fallbackEmoji={member.role === 'parent1' ? '👑' : '👤'}
        fallbackIcon={
          member.role === 'parent1'
            ? 'shield'
            : member.role === 'parent2'
            ? 'heart'
            : 'person'
        }
        fallbackColor={roleColor}
        showStatus={true}
        statusColor={statusColors[onlineStatus]}
      />

      <Text
        style={[
          styles.userBubbleName,
          { color: theme.text.primary },
        ]}
        numberOfLines={1}
      >
        {member.fullName.split(' ')[0]}
      </Text>
      <Text style={[styles.userBubbleRole, { color: roleColor }]}>
        {member.role === 'parent1'
          ? 'Primary'
          : member.role === 'parent2'
          ? 'Co-Parent'
          : 'Guardian'}
      </Text>

      {isSelected && (
        <View style={styles.userBubbleCheck}>
          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
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

const TypingIndicator: React.FC<{ theme: ChatTheme }> = ({ theme }) => (
  <View style={styles.typingContainer}>
    <View
      style={[styles.typingDot, { backgroundColor: theme.primary }]}
    />
    <View
      style={[styles.typingDot, { backgroundColor: theme.primary }]}
    />
    <View
      style={[styles.typingDot, { backgroundColor: theme.primary }]}
    />
  </View>
);

const PresenceBadge: React.FC<
  {
    status: 'online' | 'away' | 'offline';
    size?: number;
    theme: ChatTheme;
  }
> = ({ status, size = 14, theme }) => {
  const colors = {
    online: theme.success,
    away: theme.accent,
    offline: theme.text.tertiary,
  };

  return (
    <View
      style={[
        styles.presenceBadge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors[status],
          borderWidth: 2,
          borderColor: theme.background.card,
        },
      ]}
    />
  );
};

const ChatListItem: React.FC<
  {
    chat: FamilyChat;
    theme: ChatTheme;
    onPress: () => void;
    onLongPress: () => void;
    unreadCount: number;
    isTyping?: boolean;
    onlineStatus?: 'online' | 'away' | 'offline';
    lastMessagePreview?: string;
  }
> = ({
  chat,
  theme,
  onPress,
  onLongPress,
  unreadCount,
  isTyping,
  onlineStatus,
  lastMessagePreview,
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
      const otherId = chat.participants.find(
        (p) => p !== chat.participantRoles?.[p]
      );
      const role = otherId ? chat.participantRoles[otherId] : '';
      return role === 'parent1'
        ? 'Primary Parent'
        : role === 'parent2'
        ? 'Co-Parent'
        : role === 'guardian'
        ? 'Guardian'
        : 'Family Member';
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
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
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
    if (msg.content.length > 30)
      return msg.content.substring(0, 30) + '...';
    return msg.content;
  };

  const isDirect = chat.type === 'direct';
  const otherParticipantId = isDirect
    ? chat.participants.find((p) => p !== chat.participantRoles?.[p])
    : null;
  const otherAvatar = otherParticipantId
    ? chat.participantAvatars?.[otherParticipantId]
    : null;
  const otherRole = otherParticipantId
    ? chat.participantRoles?.[otherParticipantId]
    : null;

  return (
    <Animated.View entering={FadeInUp}>
      <TouchableOpacity
        style={[
          styles.chatItem,
          {
            backgroundColor: theme.background.card,
            borderColor: theme.border,
          },
          chat.isPinned && [
            styles.pinnedItem,
            { borderLeftColor: theme.primary },
          ],
          unreadCount > 0 && [
            styles.unreadItem,
            {
              backgroundColor: theme.primary + '08',
              borderColor: theme.primary + '30',
            },
          ],
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.avatarContainer,
            {
              backgroundColor:
                chat.type === 'group'
                  ? theme.primary + '20'
                  : theme.secondary + '20',
            },
          ]}
        >
          {isDirect && otherAvatar ? (
            <SafeAvatar
              avatar={otherAvatar}
              size={56}
              fallbackEmoji="👤"
              fallbackIcon={
                otherRole === 'parent1'
                  ? 'shield'
                  : otherRole === 'parent2'
                  ? 'heart'
                  : 'person'
              }
              fallbackColor={
                otherRole === 'parent1'
                  ? theme.primary
                  : otherRole === 'parent2'
                  ? theme.secondary
                  : theme.accent
              }
            />
          ) : (
            <>
              <Text style={styles.avatarEmoji}>{getChatIcon()}</Text>
              {chat.type === 'group' ? (
                <View
                  style={[
                    styles.groupIndicator,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Ionicons name="people" size={10} color="#fff" />
                </View>
              ) : (
                onlineStatus && (
                  <View style={styles.onlineIndicator}>
                    <PresenceBadge
                      status={onlineStatus}
                      size={12}
                      theme={theme}
                    />
                  </View>
                )
              )}
            </>
          )}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text
              style={[
                styles.chatName,
                { color: theme.text.primary },
                unreadCount > 0 && { color: theme.text.primary },
              ]}
              numberOfLines={1}
            >
              {chat.name}
            </Text>
            {chat.lastMessage && (
              <Text
                style={[
                  styles.timestamp,
                  unreadCount > 0 && {
                    color: theme.primary,
                    fontWeight: '600',
                  },
                ]}
              >
                {formatTime(chat.lastMessage.timestamp)}
              </Text>
            )}
          </View>

          <Text style={[styles.subtitle, { color: theme.text.secondary }]} numberOfLines={1}>
            {getChatSubtitle()}
          </Text>

          <View style={styles.messagePreview}>
            {isTyping ? (
              <View style={styles.typingRow}>
                <Text
                  style={[
                    styles.typingLabel,
                    { color: theme.primary },
                  ]}
                >
                  typing
                </Text>
                <TypingIndicator theme={theme} />
              </View>
            ) : (
              <>
                {chat.lastMessage?.senderId !== 'system' && chat.lastMessage && (
                  <Text
                    style={[
                      styles.senderName,
                      { color: theme.text.secondary },
                      unreadCount > 0 && {
                        color: theme.primary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {chat.lastMessage.senderName === 'You'
                      ? 'You: '
                      : `${chat.lastMessage.senderName.split(' ')[0]}: `}
                  </Text>
                )}
                <Text
                  style={[
                    styles.lastMessage,
                    { color: theme.text.secondary },
                    unreadCount > 0 && {
                      color: theme.text.primary,
                      fontWeight: '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {getLastMessagePreview(chat.lastMessage)}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.rightSection}>
          {unreadCount > 0 && (
            <View
              style={[
                styles.unreadBadge,
                { backgroundColor: theme.primary },
              ]}
            >
              <Text style={styles.unreadText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
          {chat.isMuted && (
            <Ionicons
              name="volume-mute"
              size={16}
              color={theme.text.tertiary}
              style={styles.muteIcon}
            />
          )}
          {chat.isPinned && (
            <Ionicons
              name="pin"
              size={14}
              color={theme.primary}
              style={styles.pinIcon}
            />
          )}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.text.tertiary}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const MemberAvatarStack: React.FC<
  {
    members: FamilyMember[];
    theme: ChatTheme;
    maxDisplay?: number;
  }
> = ({ members, theme, maxDisplay = 3 }) => {
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
            },
          ]}
        >
          <SafeAvatar
            avatar={member.avatar}
            size={32}
            fallbackEmoji="👤"
            fallbackIcon={
              member.role === 'parent1'
                ? 'shield'
                : member.role === 'parent2'
                ? 'heart'
                : 'person'
            }
            fallbackColor={
              member.role === 'parent1'
                ? theme.primary
                : member.role === 'parent2'
                ? theme.secondary
                : theme.accent
            }
          />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={[
            styles.stackAvatar,
            styles.stackAvatarMore,
            {
              marginLeft: -12,
              backgroundColor: theme.background.elevated,
            },
          ]}
        >
          <Text
            style={[
              styles.stackAvatarText,
              { fontSize: 12, color: theme.text.primary },
            ]}
          >
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
};

interface ChatTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: {
    gradient: [string, string, string];
    card: string;
    elevated: string;
    main: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  error: string;
  success: string;
  info: string;
  divider: string;
  border: string;
}

export default function FamilyChatListScreen({
  navigation,
}: FamilyChatListScreenProps) {
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
  const { themeColors, darkMode } = useCustomization();
  const insets = useSafeAreaInsets();

  const theme: ChatTheme = useMemo(() => {
    const isDark = darkMode;
    return {
      primary: themeColors.primary,
      secondary: themeColors.secondary,
      accent: themeColors.accent,
      background: {
        gradient: themeColors.colors,
        card: isDark ? '#1e1e2e' : '#ffffff',
        elevated: isDark ? '#2a2a3c' : '#f8faff',
        main: isDark ? '#0f0f1e' : '#f8faff',
      },
      text: {
        primary: isDark ? '#ffffff' : '#1a1a1a',
        secondary: isDark ? '#a0a0a0' : '#666666',
        tertiary: isDark ? '#666666' : '#999999',
      },
      error: '#ff4757',
      success: '#43e97b',
      info: '#4facfe',
      divider: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    };
  }, [themeColors, darkMode]);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedChat, setSelectedChat] = useState<
    FamilyChat | null
  >(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    []
  );
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [alert, setAlert] = useState<
    {
      visible: boolean;
      type: 'success' | 'error' | 'warning' | 'info';
      title: string;
      message: string;
    }
  >({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const otherMembers = useMemo(() => {
    return members.filter(
      (m) => m.id !== userProfile?.id && m.userId !== userProfile?.id
    );
  }, [members, userProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      setRefreshing(false);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    }, 1000);
  }, []);

  const showSweetAlert = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setAlert({ visible: true, type, title, message });
  };

  const getPermanentImagePath = (prefix: string) => {
    const dir = FileSystem.documentDirectory + 'group_images/';
    return `${dir}${prefix}_${Date.now()}.jpg`;
  };

  const ensureDirExists = async () => {
    const dir = FileSystem.documentDirectory + 'group_images/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, {
        intermediates: true,
      });
    }
  };

  const handleTakePhoto = async () => {
    const { status } =
      await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showSweetAlert(
        'error',
        'Permission Required',
        'Please allow access to your camera.'
      );
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
        await FileSystem.copyAsync({
          from: tempUri,
          to: permanentUri,
        });
        setGroupPhoto(permanentUri);
        setIsUploading(false);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }
    } catch (error) {
      console.error('Camera error:', error);
      showSweetAlert('error', 'Error', 'Failed to capture photo');
      setIsUploading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSweetAlert(
        'error',
        'Permission Required',
        'Please allow access to your photo library.'
      );
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
        await FileSystem.copyAsync({
          from: tempUri,
          to: permanentUri,
        });
        setGroupPhoto(permanentUri);
        setIsUploading(false);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
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
      const otherId = chat.participants.find(
        (p) => p !== userProfile?.id
      );
      const member = otherId
        ? members.find((m) => m.id === otherId)
        : undefined;

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
    if (
      member.id === userProfile?.id ||
      member.userId === userProfile?.id
    ) {
      showSweetAlert(
        'warning',
        'Cannot Chat',
        'You cannot start a chat with yourself!'
      );
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning
      );
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
    showSweetAlert(
      'success',
      'Shared!',
      'Family code has been shared'
    );
  };

  const handleDeleteChat = () => {
    if (!selectedChat) return;

showAlert(
      'Delete Chat',
      `Are you sure you want to delete "${selectedChat.name}"? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setShowOptionsModal(false),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
            await deleteChat(selectedChat.id);
            setShowOptionsModal(false);
            setSelectedChat(null);
            showSweetAlert(
              'success',
              'Deleted',
              'Chat has been removed'
            );
          },
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
      selectedChat.isPinned
        ? 'Chat unpinned from top'
        : 'Chat pinned to top'
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
      selectedChat.isMuted
        ? 'Notifications enabled'
        : 'Notifications silenced'
    );
  };

  const handleCreateGroup = async () => {
    if (selectedMembers.length < 2) {
      showSweetAlert(
        'warning',
        'Select Members',
        'Please select at least 2 members to create a group'
      );
      return;
    }

    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );
    showSweetAlert(
      'success',
      'Group Created! 🎉',
      `Created group with ${selectedMembers.length} members`
    );
    setShowNewChatModal(false);
    setSelectedMembers([]);
    setGroupName('');
    setGroupPhoto(null);
  };

  const toggleMemberSelection = (memberId: string) => {
    if (memberId === userProfile?.id) {
      showSweetAlert(
        'warning',
        'Cannot Select',
        'You cannot add yourself to a group'
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const getOnlineStatus = (
    memberId: string
  ): 'online' | 'away' | 'offline' => {
    const lastActive = members.find((m) => m.id === memberId)
      ?.lastActive;
    if (!lastActive) return 'offline';
    const minutesSince =
      (Date.now() - new Date(lastActive).getTime()) / 1000 / 60;
    if (minutesSince < 5) return 'online';
    if (minutesSince < 30) return 'away';
    return 'offline';
  };

  const isUserTyping = (chatId: string): boolean => {
    const typingUsers = getTypingUsers(chatId);
    return typingUsers.some((u) => u.userId !== userProfile?.id);
  };

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    return chats.filter(
      (chat) =>
        chat.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        chat.lastMessage?.content
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (chat.participantNames &&
          Object.values(chat.participantNames).some((name) =>
            name.toLowerCase().includes(searchQuery.toLowerCase())
          ))
    );
  }, [chats, searchQuery]);

  const sortedChats = useMemo(() => {
    return [...filteredChats].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = a.lastMessage
        ? new Date(a.lastMessage.timestamp).getTime()
        : 0;
      const timeB = b.lastMessage
        ? new Date(b.lastMessage.timestamp).getTime()
        : 0;
      return timeB - timeA;
    });
  }, [filteredChats]);

  const totalUnread = useMemo(() => {
    return chats.reduce(
      (sum, chat) =>
        sum + (chat.isMuted ? 0 : chat.unreadCount),
      0
    );
  }, [chats]);

  const renderMemberGrid = () => (
    <View style={styles.membersSection}>
      <View style={styles.membersHeader}>
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.text.primary },
          ]}
        >
          Family Members
        </Text>
        <TouchableOpacity onPress={() => setShowNewChatModal(true)}>
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            style={styles.newGroupBadge}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newGroupText}>Group</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <AutoHideAnimatedScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.membersScroll}
      >
        {otherMembers.map((member, index) => (
          <Animated.View
            key={member.id}
            entering={FadeInRight.delay(index * 50)}
          >
            <UserBubble
              member={member}
              isSelected={false}
              onPress={() => handleMemberPress(member)}
              theme={theme}
            />
          </Animated.View>
        ))}

        <TouchableOpacity
          style={styles.addMemberItem}
          onPress={handleShareCode}
        >
          <View
            style={[
              styles.memberAvatar,
              { backgroundColor: theme.primary + '20' },
            ]}
          >
            <Ionicons
              name="person-add"
              size={24}
              color={theme.primary}
            />
          </View>
          <Text
            style={[
              styles.memberName,
              { color: theme.text.primary },
            ]}
          >
            Invite
          </Text>
          <Text style={styles.memberRole}>New Member</Text>
        </TouchableOpacity>
      </AutoHideAnimatedScrollView>

      <View style={styles.statsContainer}>
        <View
          style={[
            styles.statItem,
            { backgroundColor: theme.background.card },
          ]}
        >
          <Text style={[styles.statNumber, { color: theme.primary }]}>
            {members.length}
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: theme.text.secondary },
            ]}
          >
            Members
          </Text>
        </View>
        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.divider },
          ]}
        />
        <View
          style={[
            styles.statItem,
            { backgroundColor: theme.background.card },
          ]}
        >
          <Text style={[styles.statNumber, { color: theme.success }]}>
            {
              members.filter((m) => getOnlineStatus(m.id) === 'online')
                .length
            }
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: theme.text.secondary },
            ]}
          >
            Online
          </Text>
        </View>
        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.divider },
          ]}
        />
        <View
          style={[
            styles.statItem,
            { backgroundColor: theme.background.card },
          ]}
        >
          <Text style={[styles.statNumber, { color: theme.accent }]}>
            {totalUnread}
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: theme.text.secondary },
            ]}
          >
            Unread
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background.main },
      ]}
    >
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      <SweetAlertChatList
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() =>
          setAlert((prev) => ({ ...prev, visible: false }))
        }
        theme={theme}
      />

      <LinearGradient
        colors={theme.background.gradient}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <BlurView
        intensity={90}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
        tint={darkMode ? 'dark' : 'light'}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.headerButton,
              {
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.text.primary}
            />
          </TouchableOpacity>

          {showSearch ? (
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: darkMode
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={theme.text.tertiary}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  { color: theme.text.primary },
                ]}
                placeholder="Search chats..."
                placeholderTextColor={theme.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setShowSearch(false);
                }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerTitleContainer}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: theme.text.primary },
                ]}
              >
                Family Chat
              </Text>
              {totalUnread > 0 && (
                <View
                  style={[
                    styles.headerBadge,
                    { backgroundColor: theme.error },
                  ]}
                >
                  <Text style={styles.headerBadgeText}>
                    {totalUnread}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.headerActions}>
            {!showSearch && (
              <TouchableOpacity
                style={[
                  styles.headerButton,
                  {
                    backgroundColor: darkMode
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.05)',
                  },
                ]}
                onPress={() => setShowSearch(true)}
              >
                <Ionicons
                  name="search"
                  size={22}
                  color={theme.text.primary}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.headerButton, styles.primaryButton]}
              onPress={handleShareCode}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      <AutoHideFlatList
        data={sortedChats}
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            theme={theme}
            onPress={() => handleChatPress(item)}
            onLongPress={() => handleLongPress(item)}
            unreadCount={getUnreadCount(item.id)}
            isTyping={isUserTyping(item.id)}
            onlineStatus={
              item.type === 'direct'
                ? getOnlineStatus(
                    item.participants.find(
                      (p) => p !== userProfile?.id
                    ) || ''
                  )
                : undefined
            }
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          {
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={renderMemberGrid}
        ListEmptyComponent={
          <Animated.View
            entering={FadeIn}
            style={styles.emptyState}
          >
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text
              style={[
                styles.emptyTitle,
                { color: theme.text.primary },
              ]}
            >
              No chats yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
              Tap on a family member above to start chatting
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowNewChatModal(true)}
            >
              <LinearGradient
                colors={[theme.primary, theme.secondary]}
                style={styles.emptyButtonGradient}
              >
                <Text style={styles.emptyButtonText}>
                  Start Group Chat
                </Text>
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
          <BlurView
            intensity={90}
            style={[
              styles.modalContent,
              {
                backgroundColor: darkMode
                  ? 'rgba(30,30,35,0.95)'
                  : 'rgba(255,255,255,0.95)',
              },
            ]}
            tint={darkMode ? 'dark' : 'light'}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: theme.text.primary },
                ]}
              >
                {selectedChat?.name}
              </Text>
              {selectedChat?.type === 'direct' && (
                <MemberAvatarStack
                  members={selectedChat.participants
                    .map((id) =>
                      members.find((m) => m.id === id)
                    )
                    .filter(
                      (m): m is FamilyMember => m !== undefined
                    )}
                  theme={theme}
                />
              )}
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handlePinChat}
            >
              <View
                style={[
                  styles.modalIcon,
                  { backgroundColor: theme.primary + '20' },
                ]}
              >
                <Ionicons
                  name={selectedChat?.isPinned ? 'pin-off' : 'pin'}
                  size={22}
                  color={theme.primary}
                />
              </View>
              <Text
                style={[
                  styles.modalOptionText,
                  { color: theme.text.primary },
                ]}
              >
                {selectedChat?.isPinned
                  ? 'Unpin Chat'
                  : 'Pin Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleMuteChat}
            >
              <View
                style={[
                  styles.modalIcon,
                  { backgroundColor: theme.accent + '20' },
                ]}
              >
                <Ionicons
                  name={
                    selectedChat?.isMuted
                      ? 'volume-high'
                      : 'volume-mute'
                  }
                  size={22}
                  color={theme.accent}
                />
              </View>
              <Text
                style={[
                  styles.modalOptionText,
                  { color: theme.text.primary },
                ]}
              >
                {selectedChat?.isMuted
                  ? 'Unmute Notifications'
                  : 'Mute Notifications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowOptionsModal(false);
              }}
            >
              <View
                style={[
                  styles.modalIcon,
                  { backgroundColor: theme.accent + '20' },
                ]}
              >
                <Ionicons
                  name="information-circle"
                  size={22}
                  color={theme.accent}
                />
              </View>
              <Text
                style={[
                  styles.modalOptionText,
                  { color: theme.text.primary },
                ]}
              >
                Chat Details
              </Text>
            </TouchableOpacity>

            {selectedChat?.type === 'direct' && (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleDeleteChat}
              >
                <View
                  style={[
                    styles.modalIcon,
                    { backgroundColor: theme.error + '20' },
                  ]}
                >
                  <Ionicons
                    name="trash"
                    size={22}
                    color={theme.error}
                  />
                </View>
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: theme.error },
                  ]}
                >
                  Delete Chat
                </Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </TouchableOpacity>
      </Modal>

      {/* New Group Chat Modal */}
      <Modal
        visible={showNewChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <View style={styles.newChatOverlay}>
          <BlurView
            intensity={100}
            style={[
              styles.newChatContent,
              {
                backgroundColor: darkMode
                  ? 'rgba(15,15,30,0.98)'
                  : 'rgba(255,255,255,0.98)',
              },
            ]}
            tint={darkMode ? 'dark' : 'light'}
          >
            <View style={styles.newChatHeader}>
              <Text
                style={[
                  styles.newChatTitle,
                  { color: theme.text.primary },
                ]}
              >
                New Group Chat
              </Text>
              <TouchableOpacity
                onPress={() => setShowNewChatModal(false)}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.text.primary}
                />
              </TouchableOpacity>
            </View>

            {/* Group Photo Section */}
            <View style={styles.groupPhotoSection}>
              <TouchableOpacity
                style={styles.groupPhotoContainer}
                onPress={() => {

showAlert(
                    'Group Photo',
                    'Choose a photo for your group',
                    [
                      { text: 'Camera', onPress: handleTakePhoto },
                      { text: 'Gallery', onPress: handlePickImage },
                      { text: 'Cancel', style: 'cancel' },
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
                    colors={[
                      theme.primary + '20',
                      theme.secondary + '20',
                    ]}
                    style={styles.groupPhotoPlaceholder}
                  >
                    <Ionicons
                      name="camera"
                      size={32}
                      color={theme.primary}
                    />
                  </LinearGradient>
                )}
                {isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                <View
                  style={[
                    styles.groupPhotoEditBadge,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text
                style={[
                  styles.groupPhotoLabel,
                  { color: theme.text.secondary },
                ]}
              >
                {groupPhoto ? 'Tap to change' : 'Add group photo'}
              </Text>
            </View>

            <TextInput
              style={[
                styles.groupNameInput,
                {
                  backgroundColor: darkMode
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.05)',
                  color: theme.text.primary,
                },
              ]}
              placeholder="Group Name (optional)"
              placeholderTextColor={theme.text.tertiary}
              value={groupName}
              onChangeText={setGroupName}
            />

            <Text
              style={[
                styles.selectLabel,
                { color: theme.text.primary },
              ]}
            >
              Select Members
            </Text>

            <AutoHideAnimatedScrollView style={styles.memberSelectList}>
              {otherMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberSelectItem,
                    {
                      backgroundColor: darkMode
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.02)',
                    },
                    selectedMembers.includes(member.id) && [
                      styles.memberSelectItemActive,
                      {
                        backgroundColor: theme.primary + '10',
                        borderColor: theme.primary + '30',
                      },
                    ],
                  ]}
                  onPress={() => toggleMemberSelection(member.id)}
                >
                  <SafeAvatar
                    avatar={member.avatar}
                    size={48}
                    fallbackEmoji="👤"
                    fallbackIcon={
                      member.role === 'parent1'
                        ? 'shield'
                        : member.role === 'parent2'
                        ? 'heart'
                        : 'person'
                    }
                    fallbackColor={
                      member.role === 'parent1'
                        ? theme.primary
                        : member.role === 'parent2'
                        ? theme.secondary
                        : theme.accent
                    }
                  />
                  <View style={styles.memberSelectInfo}>
                    <Text
                      style={[
                        styles.memberSelectName,
                        { color: theme.text.primary },
                      ]}
                    >
                      {member.fullName}
                    </Text>
                    <Text
                      style={[
                        styles.memberSelectRole,
                        { color: theme.text.secondary },
                      ]}
                    >
                      {member.role === 'parent1'
                        ? 'Primary Parent'
                        : member.role === 'parent2'
                        ? 'Co-Parent'
                        : 'Guardian'}
                    </Text>
                  </View>
                  {selectedMembers.includes(member.id) && (
                    <View style={styles.checkmark}>
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={theme.primary}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </AutoHideAnimatedScrollView>

            <TouchableOpacity
              style={[
                styles.createButton,
                selectedMembers.length < 2 &&
                  styles.createButtonDisabled,
              ]}
              onPress={handleCreateGroup}
              disabled={selectedMembers.length < 2}
            >
              <LinearGradient
                colors={
                  selectedMembers.length >= 2
                    ? [theme.primary, theme.secondary]
                    : ['#ccc', '#ccc']
                }
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
  container: {
    flex: 1,
  },
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 100,
    pointerEvents: 'none',
  },
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  alertGradient: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    color: '#fff',
  },
  alertMessage: {
    fontSize: 13,
    color: '#64748b',
  },
  alertDismiss: {
    marginTop: 8,
  },
  alertDismissText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  avatarWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGradient: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    textAlign: 'center',
  },
  avatarStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  userBubble: {
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 4,
  },
  userBubbleSelected: {
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 16,
  },
  userBubbleDisabled: {
    opacity: 0.5,
  },
  userBubbleName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  userBubbleRole: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  userBubbleCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  userBubbleDisabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  presenceBadge: {
    borderWidth: 2,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pinnedItem: {
    borderLeftWidth: 3,
  },
  unreadItem: {
    borderWidth: 1,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  lastMessage: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  muteIcon: {
    marginBottom: 4,
  },
  pinIcon: {
    marginBottom: 4,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stackAvatarMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarText: {
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#667eea',
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
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
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 40,
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  membersSection: {
    paddingBottom: 20,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  newGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  newGroupText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  membersScroll: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  addMemberItem: {
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 4,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 10,
    fontWeight: '500',
    color: '#999',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.7,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  newChatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  newChatContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: height * 0.9,
  },
  newChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  newChatTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  groupPhotoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  groupPhotoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  groupPhotoImage: {
    width: 100,
    height: 100,
  },
  groupPhotoPlaceholder: {
    width: 100,
    height: 100,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  groupPhotoLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  groupNameInput: {
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
  },
  selectLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  memberSelectList: {
    maxHeight: height * 0.4,
    marginBottom: 20,
  },
  memberSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memberSelectItemActive: {
    borderWidth: 1,
  },
  memberSelectInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberSelectName: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberSelectRole: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  checkmark: {
    marginLeft: 8,
  },
  createButton: {
    borderRadius: 20,
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
