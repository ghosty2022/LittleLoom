import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeIn,
  Layout,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import {
  useCommunity,
  Message,
  MessageType,
  FileMetadata,
} from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showErrorModal, showConfirmModal } from '../../utils/modal';
import { useCustomization } from '../../hooks/useCustomization';
import {
  AutoHideScrollView,
  AutoHideFlatList,
} from '../../components/AutoHideScrollWrappers';
import {
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows,
} from '../../theme/CommunityTheme';

type ChatScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Chat'>;

const { width, height } = Dimensions.get('window');

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
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
            }}
            resizeMode="cover"
            onError={(e) =>
              console.log('Avatar image error:', e.nativeEvent.error)
            }
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

const DeliveryStatus: React.FC<{ status: Message['deliveryStatus'] }> = ({
  status,
}) => {
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
        color="#ff4757"
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
  primaryColor: string;
  textPrimary: string;
  textSecondary: string;
}> = ({ fileMeta, isMe, onPress, primaryColor, textPrimary, textSecondary }) => {
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
    <TouchableOpacity
      style={styles.fileBubble}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.fileIconContainer,
          {
            backgroundColor: isMe
              ? 'rgba(255,255,255,0.2)'
              : primaryColor + '20',
          },
        ]}
      >
        <Ionicons
          name={getFileIcon() as any}
          size={24}
          color={isMe ? '#fff' : primaryColor}
        />
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[
            styles.fileName,
            { color: isMe ? '#fff' : textPrimary },
          ]}
          numberOfLines={1}
        >
          {fileMeta.name}
        </Text>
        <Text
          style={[
            styles.fileSize,
            { color: isMe ? 'rgba(255,255,255,0.7)' : textSecondary },
          ]}
        >
          {formatFileSize(fileMeta.size)}
        </Text>
      </View>
      <Ionicons
        name="download-outline"
        size={18}
        color={isMe ? 'rgba(255,255,255,0.8)' : primaryColor}
      />
    </TouchableOpacity>
  );
};

const ImagePreviewModal: React.FC<{
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  primaryColor: string;
  hapticFeedback: boolean;
  reduceMotion: boolean;
}> = ({
  visible,
  imageUrl,
  onClose,
  primaryColor,
  hapticFeedback,
  reduceMotion,
}) => {
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
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn}
          style={styles.imagePreviewContainer}
        >
          {loading && (
            <ActivityIndicator
              size="large"
              color={primaryColor}
              style={styles.imagePreviewLoader}
            />
          )}
          <Image
            source={{ uri: imageUrl }}
            style={styles.imagePreviewImage}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          <TouchableOpacity
            style={styles.imagePreviewClose}
            onPress={() => {
              if (hapticFeedback) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onClose();
            }}
          >
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
  message: Message;
  isMe: boolean;
  user: any;
  showAvatar: boolean;
  theme: ChatTheme;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onImagePress: (url: string) => void;
  onFilePress: (meta?: FileMetadata) => void;
  onResend: () => void;
  hapticFeedback: boolean;
  reduceMotion: boolean;
}> = ({
  message,
  isMe,
  user,
  showAvatar,
  theme,
  onReaction,
  onReply,
  onDelete,
  onEdit,
  onImagePress,
  onFilePress,
  onResend,
  hapticFeedback,
  reduceMotion,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLongPress = () => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    scale.value = withSpring(0.98, { damping: 20 });
    setShowActions(true);
    setTimeout(() => {
      scale.value = withSpring(1);
    }, 150);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : isMe ? FadeInUp : FadeInUp}
      layout={reduceMotion ? undefined : Layout.springify()}
      style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.theirMessage,
      ]}
    >
      {!isMe && showAvatar && (
        <TouchableOpacity
          onPress={() =>
            user && Alert.alert(user.displayName, `Handle: ${user.handle}`)
          }
          style={styles.avatarSmall}
        >
          <SafeAvatar
            avatar={user?.avatar}
            size={32}
            fallbackEmoji="👤"
            fallbackColor={theme.primary}
          />
        </TouchableOpacity>
      )}

      <View style={[!isMe && !showAvatar && { marginLeft: 44 }]}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            activeOpacity={0.9}
            delayLongPress={200}
          >
            <View
              style={[
                styles.messageBubble,
                isMe
                  ? [styles.myBubble, { backgroundColor: theme.primary }]
                  : [
                      styles.theirBubble,
                      {
                        backgroundColor: theme.background.card,
                        borderColor: theme.border,
                      },
                    ],
              ]}
            >
              {/* Reply reference */}
              {message.replyTo && (
                <View
                  style={[
                    styles.replyPreview,
                    isMe
                      ? [
                          styles.replyPreviewMe,
                          { backgroundColor: 'rgba(255,255,255,0.2)' },
                        ]
                      : [
                          styles.replyPreviewThem,
                          { backgroundColor: theme.primary + '15' },
                        ],
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
                  </View>
                </View>
              )}

              {/* Failed retry */}
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
                  primaryColor={theme.primary}
                  textPrimary={theme.text.primary}
                  textSecondary={theme.text.secondary}
                />
              ) : (
                <Text
                  style={[
                    styles.messageText,
                    { color: isMe ? '#fff' : theme.text.primary },
                  ]}
                >
                  {message.content}
                </Text>
              )}

              {/* Footer */}
              <View style={styles.messageFooter}>
                <Text
                  style={[
                    styles.messageTime,
                    {
                      color: isMe
                        ? 'rgba(255,255,255,0.7)'
                        : theme.text.tertiary,
                    },
                  ]}
                >
                  {formatTime(message.timestamp)}
                </Text>
                {message.isEdited && (
                  <Text
                    style={[
                      styles.editedLabel,
                      {
                        color: isMe
                          ? 'rgba(255,255,255,0.6)'
                          : theme.text.tertiary,
                      },
                    ]}
                  >
                    edited
                  </Text>
                )}
                {isMe && <DeliveryStatus status={message.deliveryStatus} />}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Action Menu */}
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
          <BlurView intensity={90} style={styles.actionMenu} tint="light">
            <AutoHideScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.emojiRow, { borderBottomColor: theme.overlay.border }]}
            >
              {['❤️', '👍', '😂', '😮', '😢', '🎉'].map((emoji) => (
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
            </AutoHideScrollView>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onReply();
                  setShowActions(false);
                }}
              >
                <Ionicons name="arrow-undo" size={20} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.text.primary }]}>
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
                    <Ionicons name="pencil" size={20} color={theme.accent} />
                    <Text
                      style={[styles.actionText, { color: theme.text.primary }]}
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
                    <Ionicons name="trash" size={20} color={theme.error} />
                    <Text style={[styles.actionText, { color: theme.error }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </BlurView>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const ReplyPreviewBar: React.FC<{
  replyTo: { id: string; content: string; senderName: string } | null;
  onCancel: () => void;
  theme: ChatTheme;
  hapticFeedback: boolean;
}> = ({ replyTo, onCancel, theme, hapticFeedback }) => {
  if (!replyTo) return null;

  return (
    <View
      style={[
        styles.replyBar,
        {
          backgroundColor: theme.background.elevated,
          borderTopColor: theme.divider,
        },
      ]}
    >
      <View style={styles.replyBarContent}>
        <View
          style={[styles.replyBarLine, { backgroundColor: theme.primary }]}
        />
        <View style={styles.replyBarText}>
          <Text style={[styles.replyBarName, { color: theme.primary }]}>
            {replyTo.senderName}
          </Text>
          <Text
            style={[styles.replyBarPreview, { color: theme.text.secondary }]}
            numberOfLines={1}
          >
            {replyTo.content}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => {
          if (hapticFeedback) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onCancel();
        }}
        style={styles.replyBarClose}
      >
        <Ionicons name="close" size={20} color={theme.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
};

export default function ChatScreen({ navigation, route }: ChatScreenProps) {
  const { userId } = route.params;
  const {
    getUserById,
    getChatMessages,
    sendMessage,
    editMessage,
    markChatRead,
    setTypingStatus,
    getTypingStatus,
    currentUser,
    updateOnlineStatus,
    deleteChat,
    blockUser,
    isUserBlocked,
    resendMessage,
  } = useCommunity();
  const { profile } = useUser();

  const {
    themeColors,
    avatar,
    darkMode,
    hapticFeedback,
    soundEffects,
    reduceMotion,
    compactView,
  } = useCustomization();

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
        border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      },
    };
  }, [themeColors, darkMode]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const flatListRef = useRef<AutoHideFlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeChat();
    const interval = setInterval(() => refreshMessages(), 2000);
    return () => {
      clearInterval(interval);
      setTypingStatus(userId, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [userId]);

  const initializeChat = async () => {
    setIsLoading(true);
    const chatUser = getUserById(userId);
    const chatMessages = getChatMessages(userId);
    setUser(chatUser);
    setMessages(chatMessages);
    setIsBlocked(isUserBlocked(userId));
    setIsLoading(false);
    markChatRead(userId);
    updateOnlineStatus('online');
  };

  const refreshMessages = () => {
    const fresh = getChatMessages(userId);
    setMessages(fresh);
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isBlocked) return;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to send messages' });
      return;
    }

    const content = inputText.trim();
    setInputText('');

    if (editingMessage) {
      await editMessage(userId, editingMessage, content);
      setEditingMessage(null);
    } else {
      await sendMessage(
        userId,
        content,
        'text',
        undefined,
        undefined,
        replyingTo?.id
      );
    }

    setReplyingTo(null);
    setTypingStatus(userId, false);
    refreshMessages();

    setTimeout(
      () => flatListRef.current?.scrollToEnd({ animated: true }),
      100
    );

    if (hapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [
    inputText,
    userId,
    currentUser,
    isBlocked,
    editingMessage,
    replyingTo,
    sendMessage,
    editMessage,
    setTypingStatus,
    hapticFeedback,
  ]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(userId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(
        () => setTypingStatus(userId, false),
        3000
      );
    } else {
      setTypingStatus(userId, false);
    }
  };

  const handleImagePick = async (fromCamera: boolean = false) => {
    if (isBlocked) {
      showErrorModal({ message: 'Unblock user to send images' });
      return;
    }

    try {
      let result;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showErrorModal({ message: 'Camera permission required' });
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showErrorModal({ message: 'Photo library permission required' });
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const fileName = `chat_img_${Date.now()}.jpg`;
        const permanentUri =
          FileSystem.documentDirectory +
          'community_chat_media/' +
          fileName;
        await FileSystem.makeDirectoryAsync(
          FileSystem.documentDirectory + 'community_chat_media/',
          { intermediates: true }
        );
        await FileSystem.copyAsync({ from: uri, to: permanentUri });

        await sendMessage(userId, '📷 Photo', 'image', permanentUri);
        refreshMessages();
        if (hapticFeedback) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Image pick error:', error);
      showErrorModal({ message: 'Failed to send image' });
    }
  };

  const handleFilePick = async () => {
    if (isBlocked) {
      showErrorModal({ message: 'Unblock user to send files' });
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      const size =
        fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      const fileName = `chat_file_${Date.now()}_${asset.name}`;
      const permanentUri =
        FileSystem.documentDirectory +
        'community_chat_files/' +
        fileName;
      await FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory + 'community_chat_files/',
        { intermediates: true }
      );
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

      const fileMeta: FileMetadata = {
        name: asset.name || 'Unknown file',
        size,
        type: asset.mimeType || 'application/octet-stream',
        uri: permanentUri,
      };

      await sendMessage(
        userId,
        `📎 ${asset.name}`,
        'file',
        permanentUri,
        fileMeta
      );
      refreshMessages();
      if (hapticFeedback) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('File pick error:', error);
      showErrorModal({ message: 'Failed to send file' });
    }
  };

  const showImageSourceAlert = () => {
    Alert.alert('Send Photo', 'Choose a photo source', [
      { text: 'Cancel', style: 'cancel' },
      { text: '📷 Camera', onPress: () => handleImagePick(true) },
      { text: '🖼️ Gallery', onPress: () => handleImagePick(false) },
    ]);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleDelete = async (messageId: string) => {
    refreshMessages();
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message.id);
    setInputText(message.content);
  };

  const handleReply = (message: Message) => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setReplyingTo({
      id: message.id,
      content:
        message.content ||
        (message.type === 'image'
          ? '📷 Photo'
          : message.type === 'file'
            ? '📎 File'
            : '...'),
      senderName:
        message.senderId === currentUser?.id
          ? 'You'
          : user?.displayName || 'User',
    });
  };

  const handleImagePress = (url: string) => {
    setPreviewImageUrl(url);
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleFilePress = async (meta?: FileMetadata) => {
    if (!meta) return;
    try {
      Alert.alert(meta.name, `Size: ${meta.size} bytes\nType: ${meta.type}`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: async () => {
            const { Share } = await import('react-native');
            Share.share({ url: meta.uri, title: meta.name });
          },
        },
      ]);
    } catch (error) {
      console.error('File open error:', error);
    }
  };

  const handleResend = async (messageId: string) => {
    await resendMessage(userId, messageId);
    refreshMessages();
  };

  const handleBlock = () => {
    showConfirmModal({
      title: isBlocked ? 'Unblock User' : 'Block User',
      message: isBlocked
        ? 'Unblock this user to receive messages from them again?'
        : 'Block this user? You will no longer receive messages from them.',
      onConfirm: () => {
        blockUser(userId);
        setIsBlocked(!isBlocked);
        setShowOptions(false);
      },
    });
  };

  const handleDeleteChat = () => {
    setShowOptions(false);
    deleteChat(userId);
    navigation.goBack();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d ago`;
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusText = () => {
    if (!user) return '';
    if (isBlocked) return 'Blocked';
    if (getTypingStatus(userId)) return 'typing...';
    if (user.onlineStatus === 'online') return 'Online';
    if (user.onlineStatus === 'away') return 'Away';
    const lastActive = new Date(user.lastActive);
    const diff = Date.now() - lastActive.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `Active ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Active ${hours}h ago`;
    return `Active ${Math.floor(hours / 24)}d ago`;
  };

  const renderMessage = ({
    item,
    index,
  }: {
    item: Message;
    index: number;
  }) => {
    const isMe = item.senderId === currentUser?.id;
    const showAvatar =
      !isMe &&
      (index === 0 || messages[index - 1]?.senderId !== item.senderId);

    return (
      <MessageBubble
        message={item}
        isMe={isMe}
        user={user}
        showAvatar={showAvatar}
        theme={theme}
        onReaction={(emoji) => handleReaction(item.id, emoji)}
        onReply={() => handleReply(item)}
        onDelete={() => handleDelete(item.id)}
        onEdit={() => handleEdit(item)}
        onImagePress={handleImagePress}
        onFilePress={handleFilePress}
        onResend={() => handleResend(item.id)}
        hapticFeedback={hapticFeedback}
        reduceMotion={reduceMotion}
      />
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient
          colors={theme.background.gradient}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient
          colors={theme.background.gradient}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.errorText, { color: theme.text.secondary }]}>
          User not found
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.goBackButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <LinearGradient
        colors={theme.background.gradient}
        style={StyleSheet.absoluteFill}
      />

      {/* Image Preview Modal */}
      <ImagePreviewModal
        visible={!!previewImageUrl}
        imageUrl={previewImageUrl || ''}
        onClose={() => setPreviewImageUrl(null)}
        primaryColor={theme.primary}
        hapticFeedback={hapticFeedback}
        reduceMotion={reduceMotion}
      />

      {/* Header */}
      <BlurView
        intensity={95}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
        tint={darkMode ? 'dark' : 'light'}
      >
        <LinearGradient
          colors={
            darkMode
              ? ['rgba(15,15,30,0.95)', 'rgba(15,15,30,0.98)']
              : ['rgba(255,255,255,0.95)', 'rgba(255,250,250,0.98)']
          }
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          onPress={() =>
            navigation.navigate('UserProfile', { userId: user.id })
          }
        >
          <View style={styles.avatarContainer}>
            <SafeAvatar
              avatar={user.avatar}
              size={44}
              fallbackEmoji={avatar || '👤'}
              fallbackColor={theme.primary}
            />
            {!isBlocked && (
              <View
                style={[
                  styles.userStatusDot,
                  {
                    backgroundColor:
                      user.onlineStatus === 'online'
                        ? theme.success
                        : user.onlineStatus === 'away'
                          ? theme.accent
                          : theme.text.tertiary,
                  },
                ]}
              />
            )}
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text
                style={[
                  styles.userName,
                  {
                    color: isBlocked
                      ? theme.text.tertiary
                      : theme.text.primary,
                  },
                ]}
              >
                {user.displayName}
              </Text>
              {user.isVerified && !isBlocked && (
                <View
                  style={[
                    styles.verifiedBadge,
                    { backgroundColor: theme.info },
                  ]}
                >
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>
            <Text
              style={[
                styles.userStatus,
                isBlocked && { color: theme.error },
                getTypingStatus(userId) && {
                  color: theme.secondary,
                  fontStyle: 'italic',
                  fontWeight: '600',
                },
              ]}
            >
              {getStatusText()}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowOptions(true)}
          style={styles.headerButton}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={24}
            color={theme.text.primary}
          />
        </TouchableOpacity>
      </BlurView>

      {/* Messages */}
      <AutoHideFlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={theme.text.tertiary}
            />
            <Text
              style={[styles.emptyText, { color: theme.text.secondary }]}
            >
              No messages yet
            </Text>
            <Text
              style={[styles.emptySubtext, { color: theme.text.tertiary }]}
            >
              Say hello to start the conversation!
            </Text>
          </View>
        }
      />

      {/* Typing Indicator */}
      {getTypingStatus(userId) && !isBlocked && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn}
          style={styles.typingContainer}
        >
          <BlurView
            intensity={80}
            style={styles.typingBubble}
            tint={darkMode ? 'dark' : 'light'}
          >
            <Text
              style={[styles.typingText, { color: theme.text.secondary }]}
            >
              {user.displayName} is typing
            </Text>
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={styles.typingDots}
            />
          </BlurView>
        </Animated.View>
      )}

      {/* Blocked Warning */}
      {isBlocked && (
        <View
          style={[
            styles.blockedBanner,
            { backgroundColor: theme.error + '15' },
          ]}
        >
          <Ionicons name="ban" size={20} color={theme.error} />
          <Text style={[styles.blockedBannerText, { color: theme.error }]}>
            You have blocked this user
          </Text>
          <TouchableOpacity onPress={handleBlock}>
            <Text style={[styles.unblockText, { color: theme.primary }]}>
              Unblock
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reply Preview */}
      <ReplyPreviewBar
        replyTo={replyingTo}
        onCancel={() => setReplyingTo(null)}
        theme={theme}
        hapticFeedback={hapticFeedback}
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <BlurView
          intensity={100}
          style={styles.inputContainer}
          tint={darkMode ? 'dark' : 'light'}
        >
          <LinearGradient
            colors={
              darkMode
                ? ['rgba(15,15,30,0.98)', 'rgba(15,15,30,0.95)']
                : ['rgba(255,255,255,0.98)', 'rgba(255,250,250,0.95)']
            }
            style={StyleSheet.absoluteFill}
          />

          <TouchableOpacity
            style={[styles.attachButton, isBlocked && styles.disabledButton]}
            onPress={showImageSourceAlert}
            disabled={isBlocked}
          >
            <View
              style={[
                styles.attachButtonBg,
                { backgroundColor: theme.primary + '15' },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={24}
                color={isBlocked ? theme.text.tertiary : theme.primary}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachButton, isBlocked && styles.disabledButton]}
            onPress={handleFilePick}
            disabled={isBlocked}
          >
            <View
              style={[
                styles.attachButtonBg,
                { backgroundColor: theme.primary + '15' },
              ]}
            >
              <Ionicons
                name="document-attach-outline"
                size={24}
                color={isBlocked ? theme.text.tertiary : theme.primary}
              />
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.background.elevated,
                borderColor: theme.border,
              },
              isBlocked && {
                backgroundColor: theme.background.main,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: theme.text.primary }]}
              placeholder={
                isBlocked
                  ? 'Unblock to send messages...'
                  : editingMessage
                    ? 'Edit message...'
                    : 'Type a message...'
              }
              placeholderTextColor={theme.text.tertiary}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={500}
              editable={!isBlocked}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (inputText.length === 0 || isBlocked) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={inputText.length === 0 || isBlocked}
          >
            <LinearGradient
              colors={
                inputText.length > 0 && !isBlocked
                  ? [themeColors.primary, themeColors.secondary]
                  : ['transparent', 'transparent']
              }
              style={styles.sendButtonGradient}
            >
              <Ionicons
                name="send"
                size={20}
                color={
                  inputText.length > 0 && !isBlocked
                    ? '#fff'
                    : theme.text.tertiary
                }
              />
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>

      {/* Options Modal */}
      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptions(false)}
        >
          <View
            style={[
              styles.optionsMenu,
              {
                backgroundColor: theme.background.card,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
              <Ionicons
                name={isBlocked ? 'checkmark-circle' : 'ban'}
                size={24}
                color={isBlocked ? theme.success : theme.error}
              />
              <Text
                style={[
                  styles.optionText,
                  { color: isBlocked ? theme.success : theme.error },
                ]}
              >
                {isBlocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleDeleteChat}
            >
              <Ionicons name="trash" size={24} color={theme.error} />
              <Text style={[styles.optionText, { color: theme.error }]}>
                Delete Chat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemLast]}
              onPress={() =>
                navigation.navigate('UserProfile', { userId: user.id })
              }
            >
              <Ionicons name="person" size={24} color={theme.primary} />
              <Text style={[styles.optionText, { color: theme.text.primary }]}>
                View Profile
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  goBackButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  avatarWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    textAlign: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },

  messageContainer: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  avatarSmall: {
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: width * 0.75,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  messageTime: {
    fontSize: 11,
  },
  editedLabel: {
    fontSize: 11,
    fontStyle: 'italic',
  },

  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    width: width * 0.6,
    height: width * 0.45,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
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

  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  replyPreviewMe: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  replyPreviewThem: {
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  replyLine: {
    width: 3,
    height: '100%',
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

  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  resendText: {
    fontSize: 12,
    fontWeight: '600',
  },

  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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

  actionOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionMenu: {
    margin: 16,
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  emojiRow: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  emojiButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 28,
  },
  actionButtons: {
    paddingTop: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    marginRight: 10,
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
  },
  replyBarClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  typingContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  typingText: {
    fontSize: 13,
    marginRight: 8,
  },
  typingDots: {
    transform: [{ scale: 0.7 }],
  },

  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  blockedBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '700',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButtonBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: {
    fontSize: 15,
    maxHeight: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  optionsMenu: {
    margin: 16,
    borderRadius: 24,
    padding: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  imagePreviewOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewLoader: {
    position: 'absolute',
  },
  imagePreviewImage: {
    width: width * 0.9,
    height: height * 0.7,
    borderRadius: 16,
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 50,
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
});
