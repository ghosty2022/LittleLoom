import { StyleSheet, ActivityIndicator        , TouchableOpacity, View , Dimensions, Modal, TextInput, Image, Platform, StatusBar, KeyboardAvoidingView, Text, Share} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';


import { BlurView } from 'expo-blur';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isSameWeek, isToday, isYesterday } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';

import { FamilyMessage, FileMetadata, MessageType, useFamilyChat } from '../../context/FamilyChatContext';
import { useAuth } from '../../context/AuthContext';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useMedia } from '../../context/MediaContext';

import Ionicons from '@expo/vector-icons/Ionicons';  // FIXED: Default import

import Animated, { 
  FadeInUp, 
  FadeIn, 
  SlideInRight, 
  SlideInLeft, 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue, 
  runOnJS, 
  FadeInDown, 
  FadeInRight 
} from 'react-native-reanimated';  // FIXED: Removed Layout

import { AudioModule } from 'expo-audio';
type FamilyChatScreenProps = NativeStackScreenProps<RootStackParamList, 'FamilyChat'>;

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
  overlay: {
    background: string;
    border: string;
  };
}

const SafeAvatar: React.FC<{
  avatar?: string | null;
  size?: number;
  fallbackEmoji?: string;
  fallbackColor?: string;
}> = ({ avatar, size = 44, fallbackEmoji = '👤', fallbackColor = '#667eea' }) => {
  const hasImage = isImageUri(avatar);
  const hasEmoji = isEmoji(avatar);

  return (
    <View style={[styles.avatarWrapper, { width: size, height: size }]}>
      <LinearGradient
        colors={
          hasImage
            ? ['#f0f0f0', '#e0e0e0']
            : [fallbackColor + '40', fallbackColor + '20']
        }
        style={[
          styles.avatarGradient,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {hasImage ? (
          <Image
            source={{ uri: avatar! }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
            onError={(e) => console.log('Avatar image error:', e.nativeEvent.error)}
          />
        ) : hasEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>
            {avatar}
          </Text>
        ) : (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>
            {fallbackEmoji}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
};

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉', '👏', '🔥'];
const QUICK_REPLIES = [
  'On my way!',
  'Sounds good!',
  'I love this!',
  'Thanks for sharing',
];

const SweetAlertChat: React.FC<{
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  theme: ChatTheme;
}> = ({ visible, type, title, message, onClose, theme }) => {
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
  }, [visible, onClose, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.alertOverlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.alertContainer, animatedStyle]}>
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

const DeliveryStatus: React.FC<{
  status: FamilyMessage['deliveryStatus'];
  theme: ChatTheme;
}> = ({ status, theme }) => {
  if (status === 'sending') {
    return (
      <ActivityIndicator
        size={12}
        color="rgba(255,255,255,0.7)"
        style={{ marginLeft: 4 }}
      />
    );
  }
  if (status === 'failed') {
    return (
      <Ionicons
        name="alert-circle"
        size={14}
        color={theme.error}
        style={{ marginLeft: 4 }}
      />
    );
  }
  if (status === 'sent') {
    return (
      <Ionicons
        name="checkmark"
        size={14}
        color="rgba(255,255,255,0.7)"
        style={{ marginLeft: 4 }}
      />
    );
  }
  if (status === 'delivered') {
    return (
      <Ionicons
        name="checkmark-done"
        size={14}
        color="rgba(255,255,255,0.7)"
        style={{ marginLeft: 4 }}
      />
    );
  }
  if (status === 'read') {
    return (
      <Ionicons
        name="checkmark-done"
        size={14}
        color="#34b7f1"
        style={{ marginLeft: 4 }}
      />
    );
  }
  return null;
};

const FileBubble: React.FC<{
  fileMeta?: FileMetadata;
  isMe: boolean;
  onPress: () => void;
  theme: ChatTheme;
}> = ({ fileMeta, isMe, onPress, theme }) => {
  if (!fileMeta) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    if (fileMeta.type.startsWith('image/')) return 'image';
    if (fileMeta.type.startsWith('video/')) return 'videocam';
    if (fileMeta.type.startsWith('audio/')) return 'musical-note';
    if (fileMeta.type.includes('pdf')) return 'document-text';
    return 'document';
  };

  return (
    <TouchableOpacity style={styles.fileBubble} onPress={onPress} activeOpacity={0.8}>
      <View
        style={[
          styles.fileIconContainer,
          {
            backgroundColor: isMe
              ? 'rgba(255,255,255,0.2)'
              : theme.primary + '20',
          },
        ]}
      >
        <Ionicons
          name={getFileIcon() as any}
          size={24}
          color={isMe ? '#fff' : theme.primary}
        />
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[
            styles.fileName,
            { color: isMe ? '#fff' : theme.text.primary },
          ]}
          numberOfLines={1}
        >
          {fileMeta.name}
        </Text>
        <Text
          style={[
            styles.fileSize,
            {
              color: isMe
                ? 'rgba(255,255,255,0.7)'
                : theme.text.secondary,
            },
          ]}
        >
          {formatFileSize(fileMeta.size)}
        </Text>
      </View>
      <Ionicons
        name="download-outline"
        size={18}
        color={isMe ? 'rgba(255,255,255,0.8)' : theme.primary}
      />
    </TouchableOpacity>
  );
};

const UserBubble: React.FC<{
  member: any;
  isSelected: boolean;
  onPress: () => void;
  theme: ChatTheme;
  showOnline?: boolean;
}> = ({ member, isSelected, onPress, theme, showOnline = true }) => {
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

  return (
    <TouchableOpacity
      style={[styles.userBubble, isSelected && styles.userBubbleSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.userBubbleAvatar,
          { backgroundColor: getRoleColor() + '20' },
        ]}
      >
        <SafeAvatar
          avatar={member.avatar}
          size={56}
          fallbackEmoji="👤"
          fallbackColor={getRoleColor()}
        />
        {showOnline && (
          <View
            style={[
              styles.userBubbleStatus,
              { backgroundColor: statusColors[onlineStatus] },
            ]}
          />
        )}
      </View>
      <Text
        style={[styles.userBubbleName, { color: theme.text.primary }]}
        numberOfLines={1}
      >
        {member.fullName.split(' ')[0]}
      </Text>
      <Text style={[styles.userBubbleRole, { color: getRoleColor() }]}>
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
    </TouchableOpacity>
  );
};

const MessageInfoModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  message: FamilyMessage | null;
  theme: ChatTheme;
  members: any[];
}> = ({ visible, onClose, message, theme, members }) => {
  if (!message) return null;

  const sender = members.find(
    (m) => m.id === message.senderId
  );
  const readByMembers =
    message.readBy
      ?.map((userId) =>
        members.find((m) => m.id === userId || m.userId === userId)
      )
      .filter(Boolean) || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
        <BlurView
          intensity={95}
          style={StyleSheet.absoluteFill}
          tint={theme.background.main === '#0f0f1e' ? 'dark' : 'light'}
        />
        <Animated.View
          entering={FadeInUp.springify()}
          style={[
            styles.messageInfoModal,
            {
              backgroundColor:
                theme.background.main === '#0f0f1e'
                  ? 'rgba(30,30,35,0.95)'
                  : 'rgba(255,255,255,0.95)',
            },
          ]}
        >
          <LinearGradient
            colors={
              theme.background.main === '#0f0f1e'
                ? ['rgba(40,40,45,0.98)', 'rgba(30,30,35,0.95)']
                : ['rgba(255,255,255,0.98)', 'rgba(250,250,255,0.95)']
            }
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.messageInfoHeader}>
            <View
              style={[
                styles.messageInfoIcon,
                { backgroundColor: theme.primary + '20' },
              ]}
            >
              <Ionicons name="information-circle" size={32} color={theme.primary} />
            </View>
            <Text
              style={[
                styles.messageInfoTitle,
                { color: theme.text.primary },
              ]}
            >
              Message Info
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.messageInfoClose}>
              <Ionicons
                name="close"
                size={24}
                color={theme.text.secondary}
              />
            </TouchableOpacity>
          </View>

          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.messageInfoContent}
          >
            <View style={styles.messageInfoSection}>
              <Text
                style={[
                  styles.messageInfoLabel,
                  { color: theme.text.secondary },
                ]}
              >
                Sent by
              </Text>
              <View style={styles.messageInfoUser}>
                <SafeAvatar
                  avatar={sender?.avatar}
                  size={48}
                  fallbackEmoji="👤"
                  fallbackColor={theme.primary}
                />
                <View>
                  <Text
                    style={[
                      styles.messageInfoUserName,
                      { color: theme.text.primary },
                    ]}
                  >
                    {sender?.fullName || message.senderName}
                  </Text>
                  <Text
                    style={[
                      styles.messageInfoUserRole,
                      { color: theme.primary },
                    ]}
                  >
                    {sender?.role === 'parent1'
                      ? 'Primary Parent'
                      : sender?.role === 'parent2'
                      ? 'Co-Parent'
                      : 'Guardian'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.messageInfoSection}>
              <Text
                style={[
                  styles.messageInfoLabel,
                  { color: theme.text.secondary },
                ]}
              >
                Sent at
              </Text>
              <Text
                style={[
                  styles.messageInfoValue,
                  { color: theme.text.primary },
                ]}
              >
                {format(new Date(message.timestamp), 'MMMM d, yyyy • h:mm a')}
              </Text>
            </View>

            {message.isEdited && (
              <View style={styles.messageInfoSection}>
                <Text
                  style={[
                    styles.messageInfoLabel,
                    { color: theme.text.secondary },
                  ]}
                >
                  Edited
                </Text>
                <Text
                  style={[
                    styles.messageInfoValue,
                    { color: theme.text.primary },
                  ]}
                >
                  {format(
                    new Date(message.editedAt || message.timestamp),
                    'MMMM d, yyyy • h:mm a'
                  )}
                </Text>
              </View>
            )}

            <View style={styles.messageInfoSection}>
              <Text
                style={[
                  styles.messageInfoLabel,
                  { color: theme.text.secondary },
                ]}
              >
                Read by ({readByMembers.length})
              </Text>
              {readByMembers.length > 0 ? (
                readByMembers.map((member: any, index: number) => (
                  <View key={member.id || index} style={styles.readByItem}>
                    <SafeAvatar
                      avatar={member.avatar}
                      size={36}
                      fallbackEmoji="👤"
                      fallbackColor={theme.success}
                    />
                    <Text
                      style={[
                        styles.readByName,
                        { color: theme.text.primary },
                      ]}
                    >
                      {member.fullName}
                    </Text>
                    <Ionicons name="checkmark-done" size={16} color={theme.success} />
                  </View>
                ))
              ) : (
                <Text
                  style={[
                    styles.messageInfoEmpty,
                    { color: theme.text.secondary },
                  ]}
                >
                  Not read yet
                </Text>
              )}
            </View>

            {message.reactions && message.reactions.length > 0 && (
              <View style={styles.messageInfoSection}>
                <Text
                  style={[
                    styles.messageInfoLabel,
                    { color: theme.text.secondary },
                  ]}
                >
                  Reactions
                </Text>
                <View style={styles.messageInfoReactions}>
                  {message.reactions.map((reaction, index) => (
                    <View
                      key={index}
                      style={[
                        styles.messageInfoReaction,
                        {
                          backgroundColor:
                            theme.background.main === '#0f0f1e'
                              ? 'rgba(255,255,255,0.05)'
                              : 'rgba(0,0,0,0.05)',
                        },
                      ]}
                    >
                      <Text style={styles.messageInfoReactionEmoji}>
                        {reaction.emoji}
                      </Text>
                      <Text
                        style={[
                          styles.messageInfoReactionName,
                          { color: theme.text.primary },
                        ]}
                      >
                        {reaction.userName}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const DateSeparator: React.FC<{
  date: string;
  theme: ChatTheme;
}> = ({ date, theme }) => {
  const getDateText = () => {
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    if (isSameWeek(d, new Date())) return format(d, 'EEEE');
    return format(d, 'MMMM d, yyyy');
  };

  return (
    <View style={styles.dateSeparator}>
      <View
        style={[
          styles.dateLine,
          {
            backgroundColor:
              theme.background.main === '#0f0f1e'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
          },
        ]}
      />
      <View
        style={[
          styles.dateBadge,
          {
            backgroundColor:
              theme.background.main === '#0f0f1e'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        <Text
          style={[
            styles.dateText,
            { color: theme.text.secondary },
          ]}
        >
          {getDateText()}
        </Text>
      </View>
      <View
        style={[
          styles.dateLine,
          {
            backgroundColor:
              theme.background.main === '#0f0f1e'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
          },
        ]}
      />
    </View>
  );
};

const TypingIndicator: React.FC<{
  theme: ChatTheme;
}> = ({ theme }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      dot1.value = withSpring(1, { damping: 10 });
      setTimeout(() => {
        dot2.value = withSpring(1, { damping: 10 });
      }, 150);
      setTimeout(() => {
        dot3.value = withSpring(1, { damping: 10 });
      }, 300);
      setTimeout(() => {
        dot1.value = withSpring(0);
        dot2.value = withSpring(0);
        dot3.value = withSpring(0);
      }, 600);
    };

    animate();
    const interval = setInterval(animate, 1200);
    return () => clearInterval(interval);
  }, [dot1, dot2, dot3]);

  const dotStyle = (val: any) =>
    useAnimatedStyle(() => ({
      transform: [{ translateY: val.value * -4 }],
      opacity: 0.4 + val.value * 0.6,
    }));

  return (
    <View
      style={[
        styles.typingBubble,
        {
          backgroundColor:
            theme.background.main === '#0f0f1e'
              ? 'rgba(40,40,45,0.9)'
              : '#fff',
        },
      ]}
    >
      <View style={styles.typingDots}>
        <Animated.View
          style={[
            styles.typingDot,
            {
              backgroundColor:
                theme.background.main === '#0f0f1e' ? '#fff' : theme.primary,
            },
            dotStyle(dot1),
          ]}
        />
        <Animated.View
          style={[
            styles.typingDot,
            {
              backgroundColor:
                theme.background.main === '#0f0f1e' ? '#fff' : theme.primary,
            },
            dotStyle(dot2),
          ]}
        />
        <Animated.View
          style={[
            styles.typingDot,
            {
              backgroundColor:
                theme.background.main === '#0f0f1e' ? '#fff' : theme.primary,
            },
            dotStyle(dot3),
          ]}
        />
      </View>
    </View>
  );
};

const MessageReactions: React.FC<{
  reactions: { emoji: string; userId: string; userName: string }[];
  isMe: boolean;
  onPress: (emoji: string) => void;
  theme: ChatTheme;
}> = ({ reactions, isMe, onPress, theme }) => {
  if (!reactions?.length) return null;

  const grouped = reactions.reduce(
    (acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <View
      style={[
        styles.reactionsContainer,
        isMe ? styles.reactionsRight : styles.reactionsLeft,
      ]}
    >
      {Object.entries(grouped).map(([emoji, count]) => (
        <TouchableOpacity
          key={emoji}
          style={[
            styles.reactionChip,
            {
              backgroundColor:
                theme.background.main === '#0f0f1e'
                  ? 'rgba(40,40,45,0.9)'
                  : '#fff',
            },
          ]}
          onPress={() => onPress(emoji)}
        >
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          {count > 1 && (
            <Text
              style={[
                styles.reactionCount,
                { color: theme.text.secondary },
              ]}
            >
              {count}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const ImagePreviewModal: React.FC<{
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  theme: ChatTheme;
}> = ({ visible, imageUrl, onClose, theme }) => {
  const [loading, setLoading] = useState(true);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.imagePreviewOverlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <BlurView
          intensity={95}
          style={StyleSheet.absoluteFill}
          tint={theme.background.main === '#0f0f1e' ? 'dark' : 'light'}
        />
        <Animated.View entering={FadeIn} style={styles.imagePreviewContainer}>
          {loading && (
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={styles.imagePreviewLoader}
            />
          )}
          <Image
            source={{ uri: imageUrl }}
            style={styles.imagePreviewImage}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              console.log('Preview image error:', e.nativeEvent.error);
            }}
          />
          <TouchableOpacity style={styles.imagePreviewClose} onPress={onClose}>
            <BlurView intensity={80} style={styles.imagePreviewCloseBlur}>
              <Ionicons name="close" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const MessageBubble: React.FC<{
  message: FamilyMessage;
  isMe: boolean;
  theme: ChatTheme;
  member?: any;
  showAvatar: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onInfo: () => void;
  onImagePress: (url: string) => void;
  onFilePress: (meta?: FileMetadata) => void;
  onResend: () => void;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}> = ({
  message,
  isMe,
  theme,
  member,
  showAvatar,
  onReaction,
  onReply,
  onDelete,
  onEdit,
  onInfo,
  onImagePress,
  onFilePress,
  onResend,
  isFirstInGroup,
  isLastInGroup,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSpring(0.98, { damping: 20 });
    setShowActions(true);
    setTimeout(() => {
      scale.value = withSpring(1);
    }, 150);
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  const getBubbleStyle = () => {
    if (message.type === 'system') return styles.systemBubble;
    if (isMe) {
      return [
        styles.myBubble,
        isFirstInGroup && styles.myBubbleFirst,
        isLastInGroup && styles.myBubbleLast,
      ];
    }
    return [
      styles.theirBubble,
      isFirstInGroup && styles.theirBubbleFirst,
      isLastInGroup && styles.theirBubbleLast,
    ];
  };

  const getRoleColor = () => {
    switch (message.senderRole) {
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

  return (
    <Animated.View
      entering={isMe ? SlideInRight : SlideInLeft}
      style={[
        styles.messageContainer,
        isMe ? styles.myMessageContainer : styles.theirMessageContainer,
      ]}
    >
      {!isMe && showAvatar && message.type !== 'system' && (
        <TouchableOpacity
          onPress={() =>
            member && showSweetAlert(member.fullName, `Role: ${member.role}`)
          }
          style={[
            styles.avatarSmall,
            { backgroundColor: getRoleColor() + '20' },
          ]}
        >
          <SafeAvatar
            avatar={member?.avatar}
            size={32}
            fallbackEmoji="👤"
            fallbackColor={getRoleColor()}
          />
        </TouchableOpacity>
      )}

      <View style={[!isMe && !showAvatar && { marginLeft: 44 }]}>
        {!isMe && showAvatar && message.type !== 'system' && (
          <Text style={[styles.senderName, { color: getRoleColor() }]}>
            {message.senderName}
          </Text>
        )}

        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            activeOpacity={0.9}
            delayLongPress={200}
            onPress={onInfo}
          >
            <View
              style={[
                styles.bubble,
                getBubbleStyle(),
                isMe
                  ? { backgroundColor: theme.primary }
                  : {
                      backgroundColor:
                        theme.background.main === '#0f0f1e'
                          ? 'rgba(40,40,45,0.9)'
                          : '#fff',
                      borderColor: theme.border,
                      borderWidth: 1,
                    },
              ]}
            >
              {/* Reply reference */}
              {message.replyTo && (
                <View
                  style={[
                    styles.replyPreview,
                    isMe
                      ? {
                          backgroundColor: 'rgba(255,255,255,0.2)',
                        }
                      : {
                          backgroundColor: theme.primary + '10',
                        },
                  ]}
                >
                  <View
                    style={[
                      styles.replyLine,
                      {
                        backgroundColor: isMe
                          ? 'rgba(255,255,255,0.5)'
                          : theme.primary,
                      },
                    ]}
                  />
                  <View style={styles.replyContent}>
                    <Text
                      style={[
                        styles.replyName,
                        {
                          color: isMe
                            ? 'rgba(255,255,255,0.8)'
                            : theme.primary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {message.replyToPreview || 'Replying to message...'}
                    </Text>
                    <Text
                      style={[
                        styles.replyText,
                        {
                          color: isMe
                            ? 'rgba(255,255,255,0.6)'
                            : theme.text.secondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {message.replyToPreview || '...'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Failed retry button */}
              {message.deliveryStatus === 'failed' && isMe && (
                <TouchableOpacity onPress={onResend} style={styles.resendButton}>
                  <Ionicons name="refresh" size={16} color={theme.error} />
                  <Text style={[styles.resendText, { color: theme.error }]}>
                    Tap to retry
                  </Text>
                </TouchableOpacity>
              )}

              {/* Message content */}
              {message.type === 'image' && message.imageUrl ? (
                <TouchableOpacity
                  onPress={() => onImagePress(message.imageUrl)}
                  activeOpacity={0.9}
                >
                  <View style={styles.imageContainer}>
                    {imageLoading && (
                      <View style={styles.imagePlaceholder}>
                        <ActivityIndicator
                          size="small"
                          color={isMe ? '#fff' : theme.primary}
                        />
                      </View>
                    )}
                    <Image
                      source={{ uri: message.imageUrl }}
                      style={styles.messageImage}
                      resizeMode="cover"
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                    />
                  </View>
                </TouchableOpacity>
              ) : message.type === 'file' ? (
                <FileBubble
                  fileMeta={message.fileMetadata}
                  isMe={isMe}
                  onPress={() => onFilePress(message.fileMetadata)}
                  theme={theme}
                />
              ) : message.type === 'voice' ? (
                <TouchableOpacity style={styles.voiceMessage}>
                  <Ionicons
                    name="play"
                    size={24}
                    color={isMe ? '#fff' : theme.primary}
                  />
                  <View style={styles.waveform}>
                    {[...Array(20)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveformBar,
                          {
                            height: 10 + Math.random() * 20,
                            backgroundColor: isMe
                              ? 'rgba(255,255,255,0.6)'
                              : theme.primary,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text
                    style={[
                      styles.voiceDuration,
                      isMe && { color: 'rgba(255,255,255,0.8)' },
                      !isMe && { color: theme.text.secondary },
                    ]}
                  >
                    0:24
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={[
                    styles.messageText,
                    isMe
                      ? { color: '#fff' }
                      : { color: theme.text.primary },
                    message.type === 'system' && {
                      color: theme.text.secondary,
                      fontSize: 13,
                      fontStyle: 'italic',
                    },
                  ]}
                >
                  {message.content}
                </Text>
              )}

              {/* Footer */}
              <View style={styles.messageFooter}>
                <Text
                  style={[
                    styles.timestamp,
                    isMe
                      ? { color: 'rgba(255,255,255,0.7)' }
                      : { color: theme.text.tertiary },
                    message.type === 'system' && {
                      color: theme.text.tertiary,
                    },
                  ]}
                >
                  {formatTime(message.timestamp)}
                </Text>
                {message.isEdited && (
                  <Text
                    style={[
                      styles.editedLabel,
                      isMe
                        ? { color: 'rgba(255,255,255,0.6)' }
                        : { color: theme.text.tertiary },
                    ]}
                  >
                    edited
                  </Text>
                )}
                {isMe && message.type !== 'system' && (
                  <DeliveryStatus status={message.deliveryStatus} theme={theme} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <MessageReactions
          reactions={message.reactions || []}
          isMe={isMe}
          onPress={onReaction}
          theme={theme}
        />
      </View>

      {/* Action Menu Modal */}
      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <TouchableOpacity
          style={styles.actionOverlay}
          onPress={() => setShowActions(false)}
        >
          <BlurView
            intensity={90}
            style={[
              styles.actionMenu,
              {
                backgroundColor:
                  theme.background.main === '#0f0f1e'
                    ? 'rgba(30,30,35,0.95)'
                    : 'rgba(255,255,255,0.95)',
              },
            ]}
            tint={theme.background.main === '#0f0f1e' ? 'dark' : 'light'}
          >
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.emojiRow,
                {
                  borderBottomColor:
                    theme.background.main === '#0f0f1e'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                },
              ]}
            >
              {REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => {
                    onReaction(emoji);
                    setShowActions(false);
                  }}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </Animated.ScrollView>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onReply();
                  setShowActions(false);
                }}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.primary + '20' },
                  ]}
                >
                  <Ionicons name="arrow-undo" size={20} color={theme.primary} />
                </View>
                <Text
                  style={[
                    styles.actionText,
                    { color: theme.text.primary },
                  ]}
                >
                  Reply
                </Text>
              </TouchableOpacity>

              {isMe && (
                <>
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => {
                      onEdit();
                      setShowActions(false);
                    }}
                  >
                    <View
                      style={[
                        styles.actionIcon,
                        { backgroundColor: theme.accent + '20' },
                      ]}
                    >
                      <Ionicons name="pencil" size={20} color={theme.accent} />
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: theme.text.primary },
                      ]}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => {
                      onDelete();
                      setShowActions(false);
                    }}
                  >
                    <View
                      style={[
                        styles.actionIcon,
                        { backgroundColor: theme.error + '20' },
                      ]}
                    >
                      <Ionicons name="trash" size={20} color={theme.error} />
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: theme.error },
                      ]}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onInfo();
                  setShowActions(false);
                }}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.info + '20' },
                  ]}
                >
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={theme.info}
                  />
                </View>
                <Text
                  style={[
                    styles.actionText,
                    { color: theme.text.primary },
                  ]}
                >
                  Info
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => setShowActions(false)}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.success + '20' },
                  ]}
                >
                  <Ionicons name="copy" size={20} color={theme.success} />
                </View>
                <Text
                  style={[
                    styles.actionText,
                    { color: theme.text.primary },
                  ]}
                >
                  Copy
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const ReplyPreview: React.FC<{
  replyTo: { id: string; content: string; senderName: string } | null;
  onCancel: () => void;
  theme: ChatTheme;
}> = ({ replyTo, onCancel, theme }) => {
  if (!replyTo) return null;

  return (
    <View
      style={[
        styles.replyBar,
        {
          backgroundColor:
            theme.background.main === '#0f0f1e'
              ? 'rgba(30,30,35,0.9)'
              : 'rgba(255,255,255,0.9)',
          borderTopColor: theme.divider,
        },
      ]}
    >
      <View style={styles.replyBarContent}>
        <View
          style={[
            styles.replyBarLine,
            { backgroundColor: theme.primary },
          ]}
        />
        <View style={styles.replyBarText}>
          <Text
            style={[
              styles.replyBarName,
              { color: theme.primary },
            ]}
          >
            {replyTo.senderName}
          </Text>
          <Text
            style={[
              styles.replyBarPreview,
              { color: theme.text.secondary },
            ]}
            numberOfLines={1}
          >
            {replyTo.content}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onCancel} style={styles.replyBarClose}>
        <Ionicons name="close" size={20} color={theme.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
};

export default function FamilyChatScreen({
  navigation,
  route,
}: FamilyChatScreenProps) {
  const {
    chatId: initialChatId,
    memberId,
    memberName,
    memberAvatar,
  } = route.params || {};
  const {
    getOrCreateDirectChat,
    getChatMessages,
    sendMessage,
    editMessage,
    markChatRead,
    deleteMessage,
    addReaction,
    setTypingStatus,
    isUserTyping,
    getChatById,
    pickAndSendImage,
    pickAndSendFile,
    getTypingUsers,
    getMessageById,
    resendMessage,
  } = useFamilyChat();
  const { members } = useFamily();
  const { userProfile } = useAuth();
  const { takePhoto, pickImage } = useMedia();
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
      overlay: {
        background: isDark
          ? 'rgba(30,30,46,0.95)'
          : 'rgba(255,255,255,0.95)',
        border: isDark
          ? 'rgba(255,255,255,0.1)'
          : 'rgba(0,0,0,0.1)',
      },
    };
  }, [themeColors, darkMode]);

  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatId, setChatId] = useState<string>(initialChatId || '');
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showUserBubbles, setShowUserBubbles] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<FamilyMessage | null>(
    null
  );
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

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

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeChat();
  }, [initialChatId, memberId]);

  useEffect(() => {
    if (!chatId) return;

    markChatRead(chatId);
    const interval = setInterval(() => {
      refreshMessages();
    }, 1000);

    return () => clearInterval(interval);
  }, [chatId]);

  const initializeChat = async () => {
    setIsLoading(true);
    let targetChatId = initialChatId;

    if (!targetChatId && memberId) {
      const member = members.find((m) => m.id === memberId);
      targetChatId = await getOrCreateDirectChat(memberId, member);
    }

    if (targetChatId) {
      setChatId(targetChatId);
      const chat = getChatById(targetChatId);
      setChatInfo(chat);
      refreshMessages();
    }
    setIsLoading(false);
  };

  const refreshMessages = () => {
    if (!chatId) return;
    const msgs = getChatMessages(chatId);
    setMessages(msgs);
  };

  const showSweetAlert = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setAlert({ visible: true, type, title, message });
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !chatId) return;
    if (!userProfile) {
      showSweetAlert('error', 'Error', 'Please sign in to send messages');
      return;
    }

    const content = inputText.trim();
    setInputText('');

    if (editingMessage) {
      await editMessage(chatId, editingMessage, content);
      setEditingMessage(null);
      showSweetAlert('success', 'Updated!', 'Message has been edited successfully');
    } else {
      await sendMessage(
        chatId,
        content,
        'text',
        undefined,
        undefined,
        replyingTo?.id
      );
    }

    setReplyingTo(null);
    setTypingStatus(chatId, false);
    refreshMessages();

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [
    inputText,
    chatId,
    userProfile,
    editingMessage,
    replyingTo,
    sendMessage,
    editMessage,
    setTypingStatus,
  ]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(chatId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(
        () => setTypingStatus(chatId, false),
        3000
      );
    } else {
      setTypingStatus(chatId, false);
    }
  };

  const handleImagePick = async (fromCamera: boolean = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await pickAndSendImage(chatId, fromCamera);
      refreshMessages();
      showSweetAlert('success', 'Photo Sent! 📷', 'Your photo has been shared');
    } catch (error) {
      console.error('Image send error:', error);
      showSweetAlert('error', 'Error', 'Failed to send photo');
    }
  };

  const handleFilePick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await pickAndSendFile(chatId);
      refreshMessages();
      showSweetAlert('success', 'File Sent! 📎', 'Your file has been shared');
    } catch (error) {
      console.error('File send error:', error);
      showSweetAlert('error', 'Error', 'Failed to send file');
    }
  };

  const showImageSourceAlert = () => {

showSweetAlert('Send Photo', 'Choose a photo source', [
      { text: 'Cancel', style: 'cancel' },
      { text: '📷 Camera', onPress: () => handleImagePick(true) },
      { text: '🖼️ Gallery', onPress: () => handleImagePick(false) },
    ]);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    await addReaction(chatId, messageId, emoji);
    refreshMessages();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = async (messageId: string) => {

showSweetAlert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMessage(chatId, messageId);
          refreshMessages();
          showSweetAlert('success', 'Deleted', 'Message has been removed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleEdit = (message: FamilyMessage) => {
    setEditingMessage(message.id);
    setInputText(message.content);
    inputRef.current?.focus();
  };

  const handleReply = (message: FamilyMessage) => {
    setReplyingTo({
      id: message.id,
      content:
        message.content ||
        (message.type === 'image'
          ? '📷 Photo'
          : message.type === 'file'
          ? '📎 File'
          : '...'),
      senderName: message.senderName,
    });
    inputRef.current?.focus();
  };

  const handleMessageInfo = (message: FamilyMessage) => {
    setSelectedMessage(message);
    setShowMessageInfo(true);
  };

  const handleImagePress = (url: string) => {
    setPreviewImageUrl(url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFilePress = async (meta?: FileMetadata) => {
    if (!meta) return;
    try {
      const canOpen = await FileSystem.getContentUriAsync(meta.uri);

showSweetAlert(
        meta.name,
        `Size: ${meta.size} bytes\nType: ${meta.type}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share',
            onPress: async () => {
              const { Share } = await import('react-native');
              Share.share({ url: meta.uri, title: meta.name });
            },
          },
        ]
      );
    } catch (error) {
      console.error('File open error:', error);
    }
  };

  const handleResend = async (messageId: string) => {
    await resendMessage(chatId, messageId);
    refreshMessages();
  };

  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        showSweetAlert(
          'error',
          'Permission Needed',
          'Microphone access is required for voice messages'
        );
        return;
      }

      setIsRecording(true);
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      recordingInterval.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const stopRecording = async () => {
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    setIsRecording(false);
    setRecordingDuration(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSweetAlert('success', 'Voice Message', 'Voice message feature coming soon!');
  };

  const getMemberById = (id: string): any | undefined => {
    return members.find((m) => m.id === id);
  };

  const getTypingText = () => {
    const typingUsers = getTypingUsers(chatId);
    const others = typingUsers.filter((u) => u.userId !== userProfile?.id);
    if (!others.length) return '';
    if (others.length === 1) return `${others[0].userName} is typing...`;
    return `${others.length} people are typing...`;
  };

  const getHeaderInfo = () => {
    if (!chatInfo) {
      return {
        name: memberName || 'Chat',
        avatar: memberAvatar || '💬',
        status: '',
      };
    }

    if (chatInfo.type === 'group') {
      return {
        name: chatInfo.name || 'Family Group',
        avatar: chatInfo.avatar || '👨‍👩‍👧‍👦',
        status: `${chatInfo.participants?.length || 0} members`,
      };
    }

    const otherId = chatInfo.participants?.find(
      (p: string) => p !== userProfile?.id
    );
    const member = otherId ? getMemberById(otherId) : undefined;

    return {
      name: member?.fullName || memberName || 'Unknown',
      avatar: member?.avatar || memberAvatar || '👤',
      status:
        member?.role === 'parent1'
          ? 'Primary Parent'
          : member?.role === 'parent2'
          ? 'Co-Parent'
          : member?.role === 'guardian'
          ? 'Guardian'
          : 'Family Member',
    };
  };

  const headerInfo = getHeaderInfo();
  const typingText = getTypingText();

  const otherMembers = useMemo(() => {
    return members.filter(
      (m) => m.id !== userProfile?.id && m.userId !== userProfile?.id
    );
  }, [members, userProfile]);

  const renderMessage = ({
    item,
    index,
  }: {
    item: FamilyMessage;
    index: number;
  }) => {
    const isMe = item.senderId === userProfile?.id;
    const member =
      item.senderId !== 'system' ? getMemberById(item.senderId) : undefined;

    const prevMessage = messages[index - 1];
    const nextMessage = messages[index + 1];

    const isFirstInGroup =
      !prevMessage ||
      prevMessage.senderId !== item.senderId ||
      new Date(item.timestamp).getTime() -
        new Date(prevMessage.timestamp).getTime() >
        300000;
    const isLastInGroup =
      !nextMessage ||
      nextMessage.senderId !== item.senderId ||
      new Date(nextMessage.timestamp).getTime() -
        new Date(item.timestamp).getTime() >
        300000;

    const showDateSeparator =
      !prevMessage ||
      new Date(prevMessage.timestamp).toDateString() !==
        new Date(item.timestamp).toDateString();

    return (
      <View>
        {showDateSeparator && (
          <DateSeparator date={item.timestamp} theme={theme} />
        )}
        <MessageBubble
          message={item}
          isMe={isMe}
          theme={theme}
          member={member}
          showAvatar={isFirstInGroup}
          onReaction={(emoji) => handleReaction(item.id, emoji)}
          onReply={() => handleReply(item)}
          onDelete={() => handleDelete(item.id)}
          onEdit={() => handleEdit(item)}
          onInfo={() => handleMessageInfo(item)}
          onImagePress={handleImagePress}
          onFilePress={handleFilePress}
          onResend={() => handleResend(item.id)}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
        />
      </View>
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.background.main },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background.main },
      ]}
    >
      {/* FIXED: StatusBar barStyle must be a string, not an expression in braces */}
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      <SweetAlertChat
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert((prev) => ({ ...prev, visible: false }))}
        theme={theme}
      />

      <MessageInfoModal
        visible={showMessageInfo}
        onClose={() => setShowMessageInfo(false)}
        message={selectedMessage}
        theme={theme}
        members={members}
      />

      <ImagePreviewModal
        visible={!!previewImageUrl}
        imageUrl={previewImageUrl || ''}
        onClose={() => setPreviewImageUrl(null)}
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
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => {
            if (chatInfo?.type === 'direct') {
              const otherId = chatInfo.participants?.find(
                (p: string) => p !== userProfile?.id
              );
              if (otherId) navigation.navigate('EditGuardian', { guardianId: otherId });
            }
          }}
        >
          <View style={styles.headerAvatar}>
            <SafeAvatar
              avatar={headerInfo.avatar}
              size={44}
              fallbackEmoji={chatInfo?.type === 'group' ? '👨‍👩‍👧‍👦' : '👤'}
              fallbackColor={theme.primary}
            />
            {chatInfo?.type === 'direct' && (
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: theme.success },
                ]}
              />
            )}
          </View>
          <View>
            <Text
              style={[
                styles.headerName,
                { color: theme.text.primary },
              ]}
            >
              {headerInfo.name}
            </Text>
            <Text
              style={[
                styles.headerStatus,
                typingText && {
                  color: theme.secondary,
                  fontStyle: 'italic',
                },
              ]}
            >
              {typingText || headerInfo.status}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
            onPress={() => setShowUserBubbles(!showUserBubbles)}
          >
            <Ionicons
              name="people"
              size={22}
              color={showUserBubbles ? theme.primary : theme.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
            onPress={() => {}}
          >
            <Ionicons name="videocam" size={22} color={theme.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
            onPress={() => {}}
          >
            <Ionicons name="call" size={22} color={theme.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: darkMode
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
            onPress={() => {

showSweetAlert('Chat Options', '', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear Chat',
                  style: 'destructive',
                  onPress: () => {},
                },
                { text: 'Export Chat', onPress: () => {} },
              ]);
            }}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={22}
              color={theme.text.primary}
            />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* User Bubbles Row */}
      {showUserBubbles && (
        <Animated.View
          entering={FadeInDown}
          style={[
            styles.userBubblesContainer,
            {
              paddingTop: insets.top + 70,
              backgroundColor:
                theme.background.main === '#0f0f1e'
                  ? 'rgba(15,15,30,0.95)'
                  : 'rgba(248,250,255,0.95)',
              borderBottomColor: theme.divider,
            },
          ]}
        >
          <BlurView
            intensity={90}
            style={StyleSheet.absoluteFill}
            tint={darkMode ? 'dark' : 'light'}
          />
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.userBubblesScroll}
          >
            {otherMembers.map((member, index) => (
              <Animated.View
                key={member.id}
                entering={FadeInRight.delay(index * 50)}
              >
                <UserBubble
                  member={member}
                  isSelected={false}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  theme={theme}
                />
              </Animated.View>
            ))}
          </Animated.ScrollView>
        </Animated.View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerstyle={[
          styles.messagesList,
          {
            paddingTop: showUserBubbles
              ? insets.top + 140
              : insets.top + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Typing Indicator */}
      {typingText && (
        <View style={styles.typingContainer}>
          <TypingIndicator theme={theme} />
        </View>
      )}

      {/* Reply Preview */}
      <ReplyPreview
        replyTo={replyingTo}
        onCancel={() => setReplyingTo(null)}
        theme={theme}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Quick Replies */}
        {!inputText && !replyingTo && (
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplies}
          >
            {QUICK_REPLIES.map((reply, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickReply,
                  {
                    backgroundColor: theme.primary + '10',
                    borderColor: theme.primary + '20',
                  },
                ]}
                onPress={() => {
                  setInputText(reply);
                  handleSend();
                }}
              >
                <Text
                  style={[
                    styles.quickReplyText,
                    { color: theme.primary },
                  ]}
                >
                  {reply}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.ScrollView>
        )}

        <BlurView
          intensity={100}
          style={[
            styles.inputBar,
            {
              backgroundColor:
                theme.background.main === '#0f0f1e'
                  ? 'rgba(15,15,30,0.98)'
                  : 'rgba(255,255,255,0.98)',
            },
          ]}
          tint={darkMode ? 'dark' : 'light'}
        >
          <TouchableOpacity
            style={styles.inputButton}
            onPress={showImageSourceAlert}
          >
            <Ionicons name="image" size={24} color={theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inputButton}
            onPress={handleFilePick}
          >
            <Ionicons
              name="document-attach"
              size={24}
              color={theme.primary}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor:
                  theme.background.main === '#0f0f1e'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.05)',
                                    borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { color: theme.text.primary },
              ]}
              placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
              placeholderTextColor={theme.text.tertiary}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
            />
          </View>

          {inputText ? (
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={handleSend}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.inputButton}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              delayLongPress={200}
            >
              <Ionicons
                name="mic"
                size={24}
                color={isRecording ? theme.error : theme.primary}
              />
            </TouchableOpacity>
          )}
        </BlurView>

        {/* Recording Overlay */}
        {isRecording && (
          <View style={styles.recordingOverlay}>
            <BlurView intensity={100} style={styles.recordingBar} tint="dark">
              <View style={styles.recordingIndicator}>
                <View
                  style={[
                    styles.recordingDot,
                    { backgroundColor: theme.error },
                  ]}
                />
                <Text style={styles.recordingText}>
                  Recording {formatDuration(recordingDuration)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={stopRecording}
                style={[
                  styles.recordingStop,
                  { backgroundColor: theme.success },
                ]}
              >
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
            </BlurView>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
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
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 4,
  },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
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
  userBubbleAvatar: {
    position: 'relative',
  },
  userBubbleStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageInfoModal: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  messageInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  messageInfoIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  messageInfoTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  messageInfoClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageInfoContent: {
    maxHeight: height * 0.6,
  },
  messageInfoSection: {
    marginBottom: 20,
  },
  messageInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  messageInfoUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageInfoUserName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageInfoUserRole: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageInfoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  readByItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  readByName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  messageInfoEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageInfoReactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  messageInfoReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  messageInfoReactionEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  messageInfoReactionName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    padding: 12,
    borderRadius: 20,
    marginLeft: 16,
    marginBottom: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionsRight: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  reactionsLeft: {
    alignSelf: 'flex-start',
    marginLeft: 52,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  imagePreviewOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  imagePreviewContainer: {
    width: width,
    height: height * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewLoader: {
    position: 'absolute',
  },
  imagePreviewImage: {
    width: width,
    height: height * 0.7,
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  imagePreviewCloseBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignItems: 'flex-start',
  },
  avatarSmall: {
    marginRight: 8,
    borderRadius: 16,
    padding: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 52,
  },
  bubble: {
    maxWidth: width * 0.75,
    padding: 12,
    borderRadius: 20,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  myBubbleFirst: {
    borderBottomRightRadius: 20,
  },
  myBubbleLast: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 20,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
  },
  theirBubbleFirst: {
    borderBottomLeftRadius: 20,
  },
  theirBubbleLast: {
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 20,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
  },
  replyPreview: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  replyLine: {
    width: 3,
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  imageContainer: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageImage: {
    width: '100%',
    height: '100%',
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginHorizontal: 12,
    height: 30,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '500',
  },
  editedLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionMenu: {
    width: width * 0.9,
    maxHeight: height * 0.7,
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  emojiRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  emojiButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  emojiText: {
    fontSize: 24,
  },
  actionButtons: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  replyBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyBarLine: {
    width: 3,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  replyBarText: {
    flex: 1,
  },
  replyBarName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyBarPreview: {
    fontSize: 13,
    fontWeight: '500',
  },
  replyBarClose: {
    padding: 4,
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerStatus: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  userBubblesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    borderBottomWidth: 1,
        paddingBottom: 12,
  },
  userBubblesScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messagesList: {
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  typingContainer: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  quickReplies: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  quickReply: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  quickReplyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  inputButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 10,
    fontWeight: '500',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  recordingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(30,30,46,0.95)',
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  recordingStop: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
