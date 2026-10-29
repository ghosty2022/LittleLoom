import {
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  interpolate,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAvatar } from '../../components/SafeAvatar';
import { useCommunity } from '../../context/CommunityContext';
import { useFamilyChat, FamilyMessage, FileMetadata } from '../../context/FamilyChatContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { showConfirmModal } from '../../utils/modal';
import { useApp } from '../../context/AppContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useAuth, subscribeToProfileChanges } from '../../context/AuthContext';

type ChatScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Chat'>;

/* ═══════════════════════════════════════════════════════════
   The Loom tokens (matches CommunityScreen / PostDetail)
   ═══════════════════════════════════════════════════════════ */
const LL = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  primaryGhost: 'rgba(99,102,241,0.08)',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  error: '#ef4444',

  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',

  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  lightBg: '#fafaf9',
  lightBorder: '#e7e5e4',

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  },
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */
const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType.startsWith('audio/')) return 'musical-note';
  if (mimeType.includes('pdf')) return 'document-text';
  return 'document';
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getMessageDate = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

/* ═══════════════════════════════════════════════════════════
   Typing dots
   ═══════════════════════════════════════════════════════════ */
const TypingDots = React.memo(({ isDark }: { isDark: boolean }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const loop = (sv: typeof dot1, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.ease }),
          withTiming(0, { duration: 400, easing: Easing.ease }),
        ),
        -1,
        true,
      );
    };
    loop(dot1, 0);
    loop(dot2, 150);
    loop(dot3, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: interpolate(dot1.value, [0, 1], [0.3, 1]) }));
  const s2 = useAnimatedStyle(() => ({ opacity: interpolate(dot2.value, [0, 1], [0.3, 1]) }));
  const s3 = useAnimatedStyle(() => ({ opacity: interpolate(dot3.value, [0, 1], [0.3, 1]) }));

  const dotColor = isDark ? LL.gray400 : LL.gray500;

  return (
    <View style={styles.typingDotsRow}>
      <Animated.View style={[styles.typingDot, { backgroundColor: dotColor }, s1]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: dotColor }, s2]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: dotColor }, s3]} />
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════
   Delivery status
   ═══════════════════════════════════════════════════════════ */
const DeliveryStatus = React.memo(
  ({ status }: { status: FamilyMessage['deliveryStatus'] }) => {
    if (status === 'sending')
      return <ActivityIndicator size={12} color={LL.gray400} style={{ marginLeft: 4 }} />;
    if (status === 'failed')
      return <Ionicons name="alert-circle" size={14} color={LL.error} style={{ marginLeft: 4 }} />;
    if (status === 'sent')
      return <Ionicons name="checkmark" size={14} color={LL.gray400} style={{ marginLeft: 4 }} />;
    if (status === 'delivered')
      return <Ionicons name="checkmark-done" size={14} color={LL.gray400} style={{ marginLeft: 4 }} />;
    if (status === 'read')
      return <Ionicons name="checkmark-done" size={14} color={LL.info} style={{ marginLeft: 4 }} />;
    return null;
  },
);

/* ═══════════════════════════════════════════════════════════
   Image preview modal
   ═══════════════════════════════════════════════════════════ */
const ImagePreviewModal = React.memo(
  ({
    visible,
    imageUrl,
    onClose,
    isDark,
  }: {
    visible: boolean;
    imageUrl: string;
    onClose: () => void;
    isDark: boolean;
  }) => {
    const [loading, setLoading] = useState(true);
    const scale = useSharedValue(0.9);
    const opacity = useSharedValue(0);

    useEffect(() => {
      if (visible) {
        scale.value = withSpring(1, { damping: 20 });
        opacity.value = withTiming(1, { duration: 200 });
      } else {
        scale.value = withTiming(0.9, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
      }
    }, [visible, opacity, scale]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

    if (!visible) return null;

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.imagePreviewOverlay} onPress={onClose}>
          <BlurView intensity={95} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
          <Animated.View style={[styles.imagePreviewContainer, animStyle]}>
            {loading && <ActivityIndicator size="large" color={LL.primary} style={styles.imagePreviewLoader} />}
            <Image
              source={{ uri: imageUrl }}
              style={styles.imagePreviewImage}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
            <TouchableOpacity style={styles.imagePreviewClose} onPress={onClose}>
              <LinearGradient
                colors={[LL.primary, LL.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.imagePreviewCloseGrad}
              >
                <Ionicons name="close" size={20} color={LL.white} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  },
);

/* ═══════════════════════════════════════════════════════════
   Message bubble
   ═══════════════════════════════════════════════════════════ */
const MessageBubble = React.memo(
  ({
    message,
    isMe,
    user,
    showAvatar,
    isDark,
    onReaction,
    onReply,
    onDelete,
    onEdit,
    onImagePress,
    onFilePress,
    onResend,
    onPin,
  }: {
    message: FamilyMessage;
    isMe: boolean;
    user: any;
    showAvatar: boolean;
    isDark: boolean;
    onReaction: (emoji: string) => void;
    onReply: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onImagePress: (url: string) => void;
    onFilePress: (meta?: FileMetadata) => void;
    onResend: () => void;
    onPin: () => void;
  }) => {
    const [showActions, setShowActions] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handleLongPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scale.value = withSpring(0.96, { damping: 20 });
      setShowActions(true);
      setTimeout(() => {
        scale.value = withSpring(1);
      }, 150);
    };

    const bubbleBg = isMe
      ? LL.primary
      : isDark
      ? LL.darkCard
      : LL.white;
    const bubbleBorder = isMe ? undefined : isDark ? LL.darkBorder : LL.lightBorder;
    const textColor = isMe ? LL.white : isDark ? LL.gray300 : LL.gray700;
    const metaColor = isMe ? 'rgba(255,255,255,0.7)' : isDark ? LL.gray500 : LL.gray500;

    return (
      <Animated.View
        entering={FadeInUp.duration(300).springify()}
        layout={Layout.springify()}
        style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}
      >
        {!isMe && showAvatar && (
          <View style={styles.avatarSmall}>
            <SafeAvatar
              avatar={user?.avatar}
              size={32}
              fallbackIcon="person"
              fallbackColor={LL.primary}
              fallbackBgColor={`${LL.primary}20`}
            />
          </View>
        )}

        <View style={[!isMe && !showAvatar && { marginLeft: 44 }]}>
          <Animated.View style={animatedStyle}>
            <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9} delayLongPress={250}>
              <View
                style={[
                  styles.messageBubble,
                  isMe ? styles.myBubble : styles.theirBubble,
                  { backgroundColor: bubbleBg },
                  bubbleBorder && { borderColor: bubbleBorder, borderWidth: 1 },
                ]}
              >
                {isMe && (
                  <LinearGradient
                    colors={[LL.primary, LL.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                )}

                {/* Reply reference */}
                {message.replyTo && (
                  <View
                    style={[
                      styles.replyPreview,
                      { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : `${LL.primary}12` },
                    ]}
                  >
                    <View
                      style={[
                        styles.replyLine,
                        { backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : LL.primary },
                      ]}
                    />
                    <View style={styles.replyContent}>
                      <Text
                        style={[
                          styles.replyName,
                          { color: isMe ? 'rgba(255,255,255,0.9)' : LL.primary },
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
                    <Ionicons name="refresh" size={14} color={LL.white} />
                    <Text style={[styles.resendText, { color: LL.white }]}>Tap to retry</Text>
                  </TouchableOpacity>
                )}

                {/* Content */}
                {message.type === 'image' && message.imageUrl ? (
                  <TouchableOpacity onPress={() => onImagePress(message.imageUrl!)} activeOpacity={0.9}>
                    <View style={styles.imageContainer}>
                      {imageLoading && (
                        <View
                          style={[
                            styles.imagePlaceholder,
                            { backgroundColor: isDark ? LL.darkSurface : LL.gray100 },
                          ]}
                        >
                          <ActivityIndicator size="small" color={LL.white} />
                        </View>
                      )}
                      <Image
                        source={{ uri: message.imageUrl }}
                        style={styles.messageImage}
                        resizeMode="cover"
                        onLoadStart={() => setImageLoading(true)}
                        onLoadEnd={() => setImageLoading(false)}
                      />
                    </View>
                  </TouchableOpacity>
                ) : message.type === 'file' ? (
                  <TouchableOpacity
                    style={styles.fileBubble}
                    onPress={() => onFilePress(message.fileMetadata)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.fileIconContainer,
                        { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : `${LL.primary}18` },
                      ]}
                    >
                      <Ionicons
                        name={getFileIcon(message.fileMetadata?.type) as any}
                        size={22}
                        color={isMe ? LL.white : LL.primary}
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
                        {message.fileMetadata?.name || 'File'}
                      </Text>
                      <Text style={[styles.fileSize, { color: metaColor }]}>
                        {formatFileSize(message.fileMetadata?.size || 0)}
                      </Text>
                    </View>
                    <Ionicons
                      name="download-outline"
                      size={18}
                      color={isMe ? 'rgba(255,255,255,0.85)' : LL.primary}
                    />
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.messageText, { color: textColor }]}>{message.content}</Text>
                )}

                {/* Footer */}
                <View style={styles.messageFooter}>
                  <Text style={[styles.messageTime, { color: metaColor }]}>
                    {formatTime(message.timestamp)}
                  </Text>
                  {message.isEdited && (
                    <Text style={[styles.editedLabel, { color: metaColor }]}>edited</Text>
                  )}
                  {isMe && <DeliveryStatus status={message.deliveryStatus} />}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Action menu */}
        <Modal
          visible={showActions}
          transparent
          animationType="fade"
          onRequestClose={() => setShowActions(false)}
        >
          <Pressable style={styles.actionOverlay} onPress={() => setShowActions(false)}>
            <Animated.View
              entering={FadeIn.duration(200)}
              style={[
                styles.actionMenu,
                {
                  backgroundColor: isDark ? LL.darkCard : LL.white,
                  borderColor: isDark ? LL.darkBorder : LL.lightBorder,
                },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.emojiRow, { borderBottomColor: isDark ? LL.darkBorder : LL.lightBorder }]}
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
              </ScrollView>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onReply();
                    setShowActions(false);
                  }}
                >
                  <Ionicons name="arrow-undo" size={20} color={LL.primary} />
                  <Text style={[styles.actionText, { color: isDark ? LL.white : LL.gray800 }]}>
                    Reply
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    onPin();
                    setShowActions(false);
                  }}
                >
                  <Ionicons name="pin" size={20} color={LL.warning} />
                  <Text style={[styles.actionText, { color: isDark ? LL.white : LL.gray800 }]}>
                    Pin
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
                      <Ionicons name="pencil" size={20} color={LL.accent} />
                      <Text style={[styles.actionText, { color: isDark ? LL.white : LL.gray800 }]}>
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
                      <Ionicons name="trash" size={20} color={LL.error} />
                      <Text style={[styles.actionText, { color: LL.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Animated.View>
          </Pressable>
        </Modal>
      </Animated.View>
    );
  },
);

/* ═══════════════════════════════════════════════════════════
   Reply bar + Date separator
   ═══════════════════════════════════════════════════════════ */
const ReplyPreviewBar = React.memo(
  ({
    replyTo,
    onCancel,
    isDark,
  }: {
    replyTo: { id: string; content: string; senderName: string } | null;
    onCancel: () => void;
    isDark: boolean;
  }) => {
    if (!replyTo) return null;
    return (
      <View
        style={[
          styles.replyBar,
          {
            backgroundColor: isDark ? LL.darkSurface : LL.gray50,
            borderTopColor: isDark ? LL.darkBorder : LL.lightBorder,
          },
        ]}
      >
        <View style={styles.replyBarContent}>
          <View style={[styles.replyBarLine, { backgroundColor: LL.primary }]} />
          <View style={styles.replyBarText}>
            <Text style={[styles.replyBarName, { color: LL.primary }]}>{replyTo.senderName}</Text>
            <Text
              style={[styles.replyBarPreview, { color: isDark ? LL.gray400 : LL.gray500 }]}
              numberOfLines={1}
            >
              {replyTo.content}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.replyBarClose}>
          <Ionicons name="close" size={20} color={isDark ? LL.gray400 : LL.gray500} />
        </TouchableOpacity>
      </View>
    );
  },
);

const DateSeparator = React.memo(({ date, isDark }: { date: string; isDark: boolean }) => (
  <View style={styles.dateSeparator}>
    <View style={[styles.dateLine, { backgroundColor: isDark ? LL.darkBorder : LL.lightBorder }]} />
    <Text style={[styles.dateText, { color: isDark ? LL.gray500 : LL.gray500 }]}>{date}</Text>
    <View style={[styles.dateLine, { backgroundColor: isDark ? LL.darkBorder : LL.lightBorder }]} />
  </View>
));

/* ═══════════════════════════════════════════════════════════
   Main screen
   ═══════════════════════════════════════════════════════════ */
export default function ChatScreen({ navigation, route }: ChatScreenProps) {
  const otherUserId = (route.params as any)?.chatId ?? (route.params as any)?.userId;
  const { getUserById, updateOnlineStatus } = useCommunity();
  const {
    getOrCreateDirectChat,
    getChatMessages,
    sendMessage,
    editMessage,
    markChatRead,
    setTypingStatus,
    getTypingUsers,
    deleteChat,
    blockUser,
    isUserBlocked,
    resendMessage,
    addReaction,
    deleteMessage,
  } = useFamilyChat();

  const { isDark } = useApp();
  const { userProfile } = useAuth();
  const sweetAlert = useSweetAlert();
  const insets = useSafeAreaInsets();

  const [chatId, setChatId] = useState<string>('');
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<FamilyMessage | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSend = inputText.trim().length > 0 && !isBlocked;

  /* ── Chat bootstrap ──────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setIsLoading(true);
      const chatUser = getUserById(otherUserId);
      if (cancelled) return;
      setUser(chatUser);

      const memberInfo = chatUser
        ? { id: otherUserId, fullName: chatUser.displayName, avatar: chatUser.avatar, role: 'guardian' as const }
        : undefined;

      const newChatId = await getOrCreateDirectChat(otherUserId, memberInfo);
      if (cancelled || !newChatId) return;

      setChatId(newChatId);
      const msgs = getChatMessages(newChatId);
      setMessages(msgs);
      setIsBlocked(isUserBlocked(otherUserId));
      setIsLoading(false);
      markChatRead(newChatId);
      updateOnlineStatus('online').catch(() => {});
    };
    init();
    return () => {
      cancelled = true;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [otherUserId]);

  /* ── Realtime profile-change: refresh `user` ─────────────── */
  // When the peer updates their avatar / name / bio (or I do), the
  // header avatar + status text must refresh instantly. `getUserById`
  // returns the freshest snapshot from CommunityContext.
  useEffect(() => {
    if (!otherUserId) return;
    const unsub = subscribeToProfileChanges((payload) => {
      // Peer's profile changed → swap in the new snapshot.
      if (payload.userId === otherUserId) {
        const fresh = getUserById(otherUserId);
        if (fresh) setUser(fresh);
      }
      // My own profile changed → community context already broadcast;
      // my own messages will re-render from message stream, no action.
    });
    return unsub;
  }, [otherUserId, getUserById]);

  // Live-update messages once chatId is known
  const { subscribeToChatMessages } = useFamilyChat();
  useEffect(() => {
    if (!chatId || !subscribeToChatMessages) return;
    const unsub = subscribeToChatMessages(chatId, (_cid, msgs) => {
      setMessages(msgs);
      const meId = userProfile?.id;
      const hasUnread = !!meId && msgs.some((m) => !m.readBy?.includes(meId));
      if (hasUnread) markChatRead(chatId);
    });
    return unsub;
  }, [chatId, subscribeToChatMessages, markChatRead, userProfile?.id]);

  /* ── Refresh loop ────────────────────────────────────────── */
  // ── Clear typing when leaving the chat ───────────────────────
  useEffect(() => {
    if (!chatId) return;
    return () => { setTypingStatus(chatId, false); };
  }, [chatId, setTypingStatus]);

  /* ── Send ────────────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (!canSend) return;
    if (!userProfile) {
      sweetAlert.alert('Sign In Required', 'Please sign in to send messages', 'warning');
      return;
    }
    const content = inputText.trim();
    setInputText('');

    try {
      if (editingMessage) {
        await editMessage(chatId, editingMessage, content);
        setEditingMessage(null);
      } else {
        await sendMessage(chatId, content, 'text', undefined, undefined, replyingTo?.id);
      }
      setReplyingTo(null);
      setTypingStatus(chatId, false);
      const fresh = getChatMessages(chatId);
      setMessages(fresh);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Chat] send failed:', err);
      sweetAlert.alert('Send Failed', 'Message could not be sent.', 'error');
    }
  }, [canSend, inputText, chatId, userProfile, editingMessage, replyingTo, sendMessage, editMessage, setTypingStatus]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(chatId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingStatus(chatId, false), 3000);
    } else {
      setTypingStatus(chatId, false);
    }
  };

  /* ── Media handlers ──────────────────────────────────────── */
  const handleImagePick = async (fromCamera = false) => {
    if (isBlocked) {
      sweetAlert.alert('Blocked', 'Unblock user to send images', 'warning');
      return;
    }
    try {
      let result;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          sweetAlert.alert('Permission Required', 'Camera access is needed', 'warning');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          sweetAlert.alert('Permission Required', 'Photo library access is needed', 'warning');
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
        const dir = FileSystem.documentDirectory + 'community_chat_media/';
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const permanentUri = dir + `chat_img_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: permanentUri });
        await sendMessage(chatId, '📷 Photo', 'image', permanentUri);
        setMessages(getChatMessages(chatId));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error('[Chat] image pick failed:', err);
      sweetAlert.alert('Error', 'Failed to send image', 'error');
    }
  };

  const handleFilePick = async () => {
    if (isBlocked) {
      sweetAlert.alert('Blocked', 'Unblock user to send files', 'warning');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const info = await FileSystem.getInfoAsync(asset.uri);
      const size = info.exists && 'size' in info ? info.size : 0;

      const dir = FileSystem.documentDirectory + 'community_chat_files/';
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const permanentUri = dir + `chat_file_${Date.now()}_${asset.name}`;
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

      const fileMeta: FileMetadata = {
        name: asset.name || 'Unknown file',
        size,
        type: asset.mimeType || 'application/octet-stream',
        uri: permanentUri,
      };

      await sendMessage(chatId, `📎 ${asset.name}`, 'file', permanentUri, fileMeta);
      setMessages(getChatMessages(chatId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Chat] file pick failed:', err);
      sweetAlert.alert('Error', 'Failed to send file', 'error');
    }
  };

  const showImageSourceAlert = () => {
    sweetAlert.confirm(
      'Send Photo',
      'Choose a photo source',
      () => handleImagePick(false),
      () => {},
      '🖼️ Gallery',
      '📷 Camera',
    );
  };

  /* ── Message actions ─────────────────────────────────────── */
  const handleReaction = async (messageId: string, emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (typeof addReaction === 'function') await addReaction(chatId, messageId, emoji);
      setMessages(getChatMessages(chatId));
    } catch (err) {
      console.warn('[Chat] reaction failed:', err);
    }
  };

  const handleDelete = async (messageId: string) => {
    showConfirmModal({
      title: 'Delete Message',
      message: 'Are you sure? This cannot be undone.',
      onConfirm: async () => {
        await deleteMessage(chatId, messageId);
        setMessages(getChatMessages(chatId));
      },
    });
  };

  const handleEdit = (message: FamilyMessage) => {
    setEditingMessage(message.id);
    setInputText(message.content);
  };

  const handleReply = (message: FamilyMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyingTo({
      id: message.id,
      content:
        message.content ||
        (message.type === 'image' ? '📷 Photo' : message.type === 'file' ? '📎 File' : '...'),
      senderName: message.senderId === userProfile?.id ? 'You' : user?.displayName || 'User',
    });
  };

  const handleImagePress = (url: string) => {
    setPreviewImageUrl(url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFilePress = async (meta?: FileMetadata) => {
    if (!meta) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (meta.uri && (meta.uri.startsWith('file://') || meta.uri.startsWith('http'))) {
        await Linking.openURL(meta.uri);
      } else {
        sweetAlert.alert(meta.name || 'File', meta.size ? formatFileSize(meta.size) : 'Attachment', 'info');
      }
    } catch {
      sweetAlert.alert(meta.name || 'File', 'Could not open this file.', 'warning');
    }
  };

  const handleResend = async (messageId: string) => {
    await resendMessage(chatId, messageId);
    setMessages(getChatMessages(chatId));
  };

  const handleBlock = () => {
    showConfirmModal({
      title: isBlocked ? 'Unblock User' : 'Block User',
      message: isBlocked
        ? 'Unblock this user to receive messages from them again?'
        : 'Block this user? You will no longer receive messages from them.',
      onConfirm: () => {
        blockUser(otherUserId);
        setIsBlocked(!isBlocked);
        setShowOptions(false);
        sweetAlert.toast(
          isBlocked ? 'Unblocked' : 'Blocked',
          isBlocked ? 'User unblocked' : 'User blocked',
          isBlocked ? 'success' : 'warning',
        );
      },
    });
  };

  const handleDeleteChat = () => {
    setShowOptions(false);
    showConfirmModal({
      title: 'Delete Chat',
      message: 'This will delete the entire conversation. This cannot be undone.',
      onConfirm: () => {
        deleteChat(chatId);
        navigation.goBack();
        sweetAlert.toast('Deleted', 'Chat deleted', 'success');
      },
    });
  };

  const handleMuteToggle = () => {
    sweetAlert.toast('Coming Soon', 'Mute feature will be available soon', 'info');
    setShowOptions(false);
  };

  const handlePinMessage = (message: FamilyMessage) => {
    setPinnedMessage(pinnedMessage?.id === message.id ? null : message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  /* ── Derived ─────────────────────────────────────────────── */
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => (m.content || '').toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const typingUsers = useMemo(() => {
    const list = getTypingUsers(chatId) as any[];
    return list?.filter((t) => (t.userId ? t.userId !== userProfile?.id : t.chatId !== userProfile?.id)) ?? [];
  }, [getTypingUsers, chatId, userProfile?.id]);

  const getStatusText = () => {
    if (!user) return '';
    if (isBlocked) return 'Blocked';
    if (typingUsers.length > 0) return 'typing...';
    if (user.onlineStatus === 'online') return 'Online';
    if (user.onlineStatus === 'away') return 'Away';
    const lastActive = new Date(user.lastActive).getTime();
    const diff = Date.now() - lastActive;
    if (diff < 60_000) return 'Active now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `Active ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Active ${hours}h ago`;
    return `Active ${Math.floor(hours / 24)}d ago`;
  };

  const renderMessage = ({ item, index }: { item: FamilyMessage; index: number }) => {
    const isMe = item.senderId === userProfile?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.senderId !== item.senderId);
    const showDate =
      index === 0 || getMessageDate(item.timestamp) !== getMessageDate(messages[index - 1]?.timestamp);

    return (
      <>
        {showDate && <DateSeparator date={getMessageDate(item.timestamp)} isDark={isDark} />}
        <MessageBubble
          message={item}
          isMe={isMe}
          user={user}
          showAvatar={showAvatar}
          isDark={isDark}
          onReaction={(emoji) => handleReaction(item.id, emoji)}
          onReply={() => handleReply(item)}
          onDelete={() => handleDelete(item.id)}
          onEdit={() => handleEdit(item)}
          onImagePress={handleImagePress}
          onFilePress={handleFilePress}
          onResend={() => handleResend(item.id)}
          onPin={() => handlePinMessage(item)}
        />
      </>
    );
  };

  /* ── Header render ───────────────────────────────────────── */
  const renderListHeader = () => (
    <>
      {isSearching && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? LL.darkSurface : LL.white,
              borderBottomColor: isDark ? LL.darkBorder : LL.lightBorder,
            },
          ]}
        >
          <View style={[styles.searchInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}>
            <Ionicons name="search" size={18} color={LL.gray400} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? LL.white : LL.gray900 }]}
              placeholder="Search messages..."
              placeholderTextColor={LL.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={LL.gray400} />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <Text style={[styles.searchResultText, { color: isDark ? LL.gray500 : LL.gray500 }]}>
              {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
            </Text>
          )}
        </Animated.View>
      )}

      {pinnedMessage && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[
            styles.pinnedBar,
            {
              backgroundColor: isDark ? `${LL.primary}15` : `${LL.primary}08`,
              borderBottomColor: isDark ? LL.darkBorder : LL.lightBorder,
            },
          ]}
        >
          <Ionicons name="pin" size={16} color={LL.primary} />
          <Text
            style={[styles.pinnedText, { color: isDark ? LL.gray300 : LL.gray600 }]}
            numberOfLines={1}
          >
            {pinnedMessage.content || '📷 Photo'}
          </Text>
          <TouchableOpacity onPress={() => setPinnedMessage(null)}>
            <Ionicons name="close" size={16} color={isDark ? LL.gray500 : LL.gray400} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );

  /* ── Loading state ───────────────────────────────────────── */
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.lightBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.08)', 'transparent']
              : ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={LL.primary} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.lightBg }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centered}>
          <LinearGradient
            colors={
              isDark
                ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)']
                : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)']
            }
            style={styles.emptyIconBg}
          >
            <Ionicons name="person-outline" size={40} color={LL.primary} />
          </LinearGradient>
          <Text style={[styles.errorText, { color: isDark ? LL.gray400 : LL.gray500 }]}>
            User not found
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
            <LinearGradient
              colors={[LL.primary, LL.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.goBackGrad}
            >
              <Text style={styles.goBackText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── Main render ────────────────────────────────────────── */
  return (
    <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.lightBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Aura bg */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.08)', 'rgba(236,72,153,0.04)', 'transparent']
            : ['rgba(99,102,241,0.05)', 'rgba(236,72,153,0.02)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />

      <ImagePreviewModal
        visible={!!previewImageUrl}
        imageUrl={previewImageUrl || ''}
        onClose={() => setPreviewImageUrl(null)}
        isDark={isDark}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: isDark ? LL.darkSurface : LL.white,
            borderBottomColor: isDark ? LL.darkBorder : LL.lightBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? LL.white : LL.gray900} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('CommunityMemberProfile', { userId: user.id })}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrap}>
            <SafeAvatar
              avatar={user.avatar}
              size={42}
              fallbackIcon="person"
              fallbackColor={LL.primary}
              fallbackBgColor={`${LL.primary}20`}
              borderWidth={user.onlineStatus === 'online' && !isBlocked ? 2 : 0}
              borderColor={LL.success}
            />
            {!isBlocked && user.onlineStatus === 'online' && (
              <View style={[styles.onlineDot, { borderColor: isDark ? LL.darkSurface : LL.white }]}>
                <View style={[styles.onlineDotInner, { backgroundColor: LL.success }]} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text
                style={[
                  styles.userName,
                  { color: isBlocked ? (isDark ? LL.gray500 : LL.gray400) : isDark ? LL.white : LL.gray900 },
                ]}
                numberOfLines={1}
              >
                {user.displayName}
              </Text>
              {user.isVerified && !isBlocked && (
                <View style={[styles.verifiedBadge, { backgroundColor: LL.primary }]}>
                  <Ionicons name="checkmark" size={10} color={LL.white} />
                </View>
              )}
            </View>
            <Text
              style={[
                styles.userStatus,
                { color: isBlocked ? LL.error : isDark ? LL.gray500 : LL.gray500 },
                typingUsers.length > 0 && { color: LL.primary, fontStyle: 'italic', fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {getStatusText()}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setIsSearching((s) => !s)}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
          >
            <Ionicons name={isSearching ? 'close' : 'search'} size={20} color={isDark ? LL.white : LL.gray900} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowOptions(true)}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={isDark ? LL.white : LL.gray900} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (searchQuery) return;
          // instant scroll on new message arrival
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          searchQuery ? (
            <View style={styles.emptyChat}>
              <Ionicons name="search-outline" size={48} color={isDark ? LL.gray600 : LL.gray300} />
              <Text style={[styles.emptyText, { color: isDark ? LL.gray400 : LL.gray500 }]}>
                No messages found
              </Text>
            </View>
          ) : (
            <View style={styles.emptyChat}>
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(99,102,241,0.22)', 'rgba(236,72,153,0.12)']
                    : ['rgba(99,102,241,0.10)', 'rgba(236,72,153,0.05)']
                }
                style={styles.emptyIconBg}
              >
                <Ionicons name="chatbubbles-outline" size={40} color={LL.primary} />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: isDark ? LL.white : LL.gray800 }]}>
                No messages yet
              </Text>
              <Text style={[styles.emptySubtext, { color: isDark ? LL.gray400 : LL.gray500 }]}>
                Say hello to start the conversation!
              </Text>
            </View>
          )
        }
      />

      {/* Typing indicator */}
      {typingUsers.length > 0 && !isBlocked && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.typingContainer}>
          <View
            style={[
              styles.typingBubble,
              {
                backgroundColor: isDark ? LL.darkCard : LL.white,
                borderColor: isDark ? LL.darkBorder : LL.lightBorder,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.typingLabel, { color: isDark ? LL.gray400 : LL.gray500 }]}>
              {user.displayName} is typing
            </Text>
            <TypingDots isDark={isDark} />
          </View>
        </Animated.View>
      )}

      {/* Blocked banner */}
      {isBlocked && (
        <View style={[styles.blockedBanner, { backgroundColor: `${LL.error}12` }]}>
          <Ionicons name="ban" size={18} color={LL.error} />
          <Text style={[styles.blockedBannerText, { color: LL.error }]}>You have blocked this user</Text>
          <TouchableOpacity onPress={handleBlock}>
            <Text style={[styles.unblockText, { color: LL.primary }]}>Unblock</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reply preview */}
      <ReplyPreviewBar replyTo={replyingTo} onCancel={() => setReplyingTo(null)} isDark={isDark} />

      {/* Input area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? LL.darkSurface : LL.white,
              borderTopColor: isDark ? LL.darkBorder : LL.lightBorder,
              paddingBottom: Math.max(insets.bottom, LL.space.md),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.attachBtn, isBlocked && styles.disabledBtn]}
            onPress={showImageSourceAlert}
            disabled={isBlocked}
          >
            <View
              style={[
                styles.attachBtnBg,
                { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${LL.primary}10` },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={20}
                color={isBlocked ? (isDark ? LL.gray600 : LL.gray300) : LL.primary}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachBtn, isBlocked && styles.disabledBtn]}
            onPress={handleFilePick}
            disabled={isBlocked}
          >
            <View
              style={[
                styles.attachBtnBg,
                { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : `${LL.primary}10` },
              ]}
            >
              <Ionicons
                name="document-attach-outline"
                size={20}
                color={isBlocked ? (isDark ? LL.gray600 : LL.gray300) : LL.primary}
              />
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100,
                borderColor: isDark ? LL.darkBorder : LL.lightBorder,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: isDark ? LL.white : LL.gray900 }]}
              placeholder={
                isBlocked
                  ? 'Unblock to send...'
                  : editingMessage
                  ? 'Edit message...'
                  : 'Type a message...'
              }
              placeholderTextColor={isDark ? LL.gray500 : LL.gray400}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={500}
              editable={!isBlocked}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            <LinearGradient
              colors={canSend ? [LL.primary, LL.accent] : [LL.gray300, LL.gray300]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtnGrad}
            >
              <Ionicons name="arrow-up" size={18} color={LL.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Options menu */}
      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[
              styles.optionsMenu,
              { backgroundColor: isDark ? LL.darkCard : LL.white, borderColor: isDark ? LL.darkBorder : LL.lightBorder },
            ]}
          >
            <TouchableOpacity style={styles.optionItem} onPress={handleMuteToggle}>
              <Ionicons
                name="notifications-off-outline"
                size={22}
                color={isDark ? LL.gray300 : LL.gray600}
              />
              <Text style={[styles.optionText, { color: isDark ? LL.white : LL.gray800 }]}>
                Mute Notifications
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
              <Ionicons
                name={isBlocked ? 'checkmark-circle' : 'ban'}
                size={22}
                color={isBlocked ? LL.success : LL.error}
              />
              <Text style={[styles.optionText, { color: isBlocked ? LL.success : LL.error }]}>
                {isBlocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleDeleteChat}>
              <Ionicons name="trash" size={22} color={LL.error} />
              <Text style={[styles.optionText, { color: LL.error }]}>Delete Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemLast]}
              onPress={() => {
                setShowOptions(false);
                navigation.navigate('CommunityMemberProfile', { userId: user.id });
              }}
            >
              <Ionicons name="person" size={22} color={LL.primary} />
              <Text style={[styles.optionText, { color: isDark ? LL.white : LL.gray800 }]}>
                View Profile
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LL.space.lg,
    paddingBottom: LL.space.md,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: LL.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: LL.space.sm },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: LL.space.md },
  avatarWrap: { position: 'relative', marginRight: LL.space.md },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LL.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  onlineDotInner: { width: 8, height: 8, borderRadius: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  userStatus: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  searchBar: { paddingHorizontal: LL.space.lg, paddingVertical: LL.space.md, borderBottomWidth: 1 },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.full,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    gap: LL.space.sm,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },
  searchResultText: { fontSize: 11, marginTop: LL.space.sm, fontWeight: '600' },

  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.sm,
    gap: LL.space.sm,
    borderBottomWidth: 1,
  },
  pinnedText: { flex: 1, fontSize: 12.5, fontWeight: '600' },

  messagesList: { paddingHorizontal: LL.space.lg, paddingTop: LL.space.sm, paddingBottom: LL.space.lg },

  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: LL.space.lg,
    gap: LL.space.md,
  },
  dateLine: { flex: 1, height: 1 },
  dateText: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  messageContainer: { marginBottom: LL.space.sm, flexDirection: 'row', alignItems: 'flex-end' },
  myMessage: { justifyContent: 'flex-end' },
  theirMessage: { justifyContent: 'flex-start' },
  avatarSmall: { marginRight: LL.space.sm },
  messageBubble: {
    maxWidth: SCREEN_W * 0.76,
    borderRadius: LL.radius.xl,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    overflow: 'hidden',
  },
  myBubble: { borderBottomRightRadius: LL.space.sm },
  theirBubble: { borderBottomLeftRadius: LL.space.sm },
  messageText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: LL.space.xs, gap: 6 },
  messageTime: { fontSize: 10.5, fontWeight: '500' },
  editedLabel: { fontSize: 10.5, fontStyle: 'italic', fontWeight: '500' },

  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: LL.space.sm,
    borderRadius: LL.radius.md,
    marginBottom: LL.space.sm,
  },
  replyLine: { width: 3, height: '100%', borderRadius: 2, marginRight: LL.space.sm },
  replyContent: { flex: 1 },
  replyName: { fontSize: 11, fontWeight: '700' },

  resendButton: { flexDirection: 'row', alignItems: 'center', marginBottom: LL.space.sm, gap: 6 },
  resendText: { fontSize: 11, fontWeight: '700' },

  imageContainer: {
    borderRadius: LL.radius.lg,
    overflow: 'hidden',
    width: SCREEN_W * 0.55,
    height: SCREEN_W * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  messageImage: { width: '100%', height: '100%' },

  fileBubble: { flexDirection: 'row', alignItems: 'center', padding: LL.space.md, gap: LL.space.md },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: LL.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '700' },
  fileSize: { fontSize: 11, marginTop: 2, fontWeight: '500' },

  actionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  actionMenu: {
    margin: LL.space.lg,
    borderRadius: LL.radius['2xl'],
    padding: LL.space.lg,
    overflow: 'hidden',
    ...LL.shadow.md,
  },
  emojiRow: { flexDirection: 'row', paddingBottom: LL.space.md, borderBottomWidth: 1 },
  emojiButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26 },
  actionButtons: { paddingTop: LL.space.md },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: LL.space.md, gap: LL.space.md },
  actionText: { fontSize: 15, fontWeight: '700' },

  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderTopWidth: 1,
  },
  replyBarContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBarLine: { width: 3, height: 36, borderRadius: 2, marginRight: LL.space.md },
  replyBarText: { flex: 1 },
  replyBarName: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  replyBarPreview: { fontSize: 12, fontWeight: '500' },
  replyBarClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  typingContainer: { paddingHorizontal: LL.space.lg, marginBottom: LL.space.sm },
  typingBubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderRadius: LL.radius.xl,
    borderBottomLeftRadius: LL.space.sm,
    gap: LL.space.sm,
  },
  typingLabel: { fontSize: 12, fontWeight: '600' },
  typingDotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  typingDot: { width: 6, height: 6, borderRadius: 3 },

  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LL.space.md,
    gap: LL.space.sm,
  },
  blockedBannerText: { fontSize: 12, fontWeight: '800' },
  unblockText: { fontSize: 12, fontWeight: '800' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LL.space.md,
    paddingTop: LL.space.md,
    gap: LL.space.sm,
    borderTopWidth: 1,
  },
  attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  attachBtnBg: {
    width: 36,
    height: 36,
    borderRadius: LL.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.4 },
  inputWrap: {
    flex: 1,
    borderRadius: LL.radius.full,
    borderWidth: 1,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.sm,
    maxHeight: 100,
  },
  input: { fontSize: 14.5, maxHeight: 80 },
  sendBtn: { width: 42, height: 42, borderRadius: LL.radius.full, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  optionsMenu: {
    margin: LL.space.lg,
    borderRadius: LL.radius['2xl'],
    padding: LL.space.sm,
    overflow: 'hidden',
    ...LL.shadow.md,
  },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: LL.space.lg, paddingVertical: LL.space.md, gap: LL.space.md },
  optionItemLast: { borderBottomWidth: 0 },
  optionText: { fontSize: 15, fontWeight: '600' },

  imagePreviewOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imagePreviewContainer: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' },
  imagePreviewLoader: { position: 'absolute' },
  imagePreviewImage: { width: SCREEN_W * 0.9, height: SCREEN_H * 0.7, borderRadius: LL.radius.lg },
  imagePreviewClose: { position: 'absolute', top: 50, right: 20 },
  imagePreviewCloseGrad: {
    width: 44,
    height: 44,
    borderRadius: LL.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...LL.shadow.md,
  },

  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: LL.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LL.space.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: LL.space.sm, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', fontWeight: '500' },
  emptySubtext: { fontSize: 13, marginTop: LL.space.sm, fontWeight: '500' },
  errorText: { fontSize: 15, fontWeight: '600', marginBottom: LL.space.lg },
  goBackButton: { borderRadius: LL.radius.full, overflow: 'hidden', ...LL.shadow.sm },
  goBackGrad: { paddingHorizontal: LL.space.xl, paddingVertical: LL.space.md },
  goBackText: { color: LL.white, fontSize: 13, fontWeight: '800' },
});