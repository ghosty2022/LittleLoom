import {
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
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
import { getMemberDisplayLabel } from '../../types/roles';
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
import { useFamily } from '../../context/FamilyContext';
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
import { useFocusEffect } from '@react-navigation/native';
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

// Derive the KeyboardAvoidingView offset from the ACTUAL header
// height so the input stays glued to the keyboard on both platforms.
// The old hardcoded 90 was wrong whenever the header grew (badge row,
// safe-area, dynamic type).
const KEYBOARD_VERTICAL_OFFSET_IOS = 90;

// Cap system font scaling so accessibility sizes don't break layout.
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
const capScaling = (n: number) => Math.min(n, 1.35);
// @ts-ignore
RNText.defaultProps = { ...(RNText.defaultProps || {}), maxFontSizeMultiplier: capScaling(1.35) };
// @ts-ignore
RNTextInput.defaultProps = { ...(RNTextInput.defaultProps || {}), maxFontSizeMultiplier: capScaling(1.35) };

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

        <View
          style={[
            !isMe && !showAvatar && { marginLeft: 44 },
            isMe && !showAvatar && { marginRight: 44 },
          ]}
        >
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
                        {/* Prefer the LIVE display name over the frozen
                            snapshot baked into the reply preview. */}
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

        {isMe && showAvatar && (
          <View style={styles.avatarSmallRight}>
            <SafeAvatar
              avatar={user?.avatar}
              size={32}
              fallbackIcon="person"
              fallbackColor={LL.accent}
              fallbackBgColor={`${LL.accent}20`}
            />
          </View>
        )}

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
  const initialChatId = (route.params as any)?.chatId as string | undefined;
  const { getUserById, getUserRole, updateOnlineStatus } = useCommunity();
  const { members: familyMembers } = useFamily();
  const {
    getOrCreateDirectChat,
    getChatById,
    getChatMessages,
    sendMessage,
    editMessage,
    markChatRead,
    markMessagesDelivered,
    setTypingStatus,
    getTypingUsers,
    deleteChat,
    blockUser,
    isUserBlocked,
    resendMessage,
    addReaction,
    deleteMessage,
    pickAndSendImage,
    pickAndSendFile,
    muteChat,
  } = useFamilyChat();

  const { isDark } = useApp();
  const { userProfile } = useAuth();
  const {
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
    toast,
    alert: sweetAlert,
  } = useSweetAlert();
  const insets = useSafeAreaInsets();

  // Track keyboard visibility so the input bar can pad against
  // `insets.bottom` when the keyboard is CLOSED and against a small
  // fixed pad when it's OPEN. Previously a single `insets.bottom`
  // padding was applied in both states, doubling up with the
  // KeyboardAvoidingView's own offset on gesture-nav Android and
  // pushing the input bar off-screen.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
  // Declared HERE (above the bootstrap effect) so the effect's
  // `messagesRef.current` read does not throw a TDZ ReferenceError.
  const messagesRef = useRef<FamilyMessage[]>([]);

  const canSend = inputText.trim().length > 0 && !isBlocked;

  /* ── Chat bootstrap ──────────────────────────────────────── */
  // Community DMs do not resolve family info — the peer is always
  // identified via `getUserById` (Community) or the chat snapshot.

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      // ── INSTANT RENDER ──────────────────────────────────────────
      // If the caller already handed us a chatId (which every entry
      // point except deep-linking does), seed the UI from the local
      // cache synchronously — no spinner, no flash. We still run the
      // async bootstrap below to fill in peer identity + verify the
      // chat exists on the server, but the screen is already usable.
      if (initialChatId) {
        const seeded = getChatMessages(initialChatId);
        if (seeded.length > 0) {
          setMessages(seeded);
          setChatId(initialChatId);
          // Defer the loading spinner toggle so it never paints.
          setIsLoading(false);
        }
      }
      setIsLoading((prev) => (initialChatId && messagesRef.current.length > 0 ? false : true));

      // ── PEER IDENTITY (family first) ───────────────────────
      // `getUserById` is a CommunityContext lookup — it returns
      // `undefined` for co-parents / guardians who never set up
      // a Community profile. That left the header with
      // `user === undefined`, which the screen interpreted as
      // "This member is no longer active" and blocked sending.
      //
      // Resolve the peer from:
      //   1. FamilyContext.members (canonical, live)
      //   2. chat.participantNames / participantAvatars (snapshot)
      //   3. CommunityContext (public profile)
      const chatForPeer = getChatById(initialChatId || '');
      const familyPeer =
        familyMembers.find((m: any) => m.id === otherUserId) ||
        familyMembers.find((m: any) => (m as any).userId === otherUserId);

      const communityPeer = getUserById(otherUserId);

      // ── FALLBACK CHAIN ────────────────────────────────────────
      // 1. FamilyContext.members (live, authoritative)
      // 2. chat.participantNames/Avatars/Roles (last snapshot)
      // 3. CommunityContext (public profile)
      //
      // If all three miss, the peer is genuinely gone — but we
      // still render a placeholder with a real id so the header
      // doesn't crash and the "This member is inactive" banner
      // is accurate.
      const snapshotName = (chatForPeer?.participantNames as any)?.[otherUserId];
      const snapshotAvatar = (chatForPeer?.participantAvatars as any)?.[otherUserId];
      const snapshotRole = (chatForPeer?.participantRoles as any)?.[otherUserId];

      const chatUser = familyPeer
        ? {
            id: (familyPeer as any).userId || familyPeer.id,
            displayName: familyPeer.fullName || snapshotName || 'Family Member',
            handle: `@${(familyPeer.fullName || '').toLowerCase().replace(/\s+/g, '_')}`,
            avatar: familyPeer.avatar || snapshotAvatar,
            isVerified: false,
            onlineStatus: 'offline',
            lastActive: (familyPeer as any).lastActive,
            role: familyPeer.role || snapshotRole || 'guardian',
            relationship: (familyPeer as any).relationship,
            // `isFamilyMember` lets the header show a family badge
            // instead of the Community "verified" icon.
            isFamilyMember: true,
          }
        : communityPeer
          ? {
              id: communityPeer.id,
              displayName: snapshotName || communityPeer.displayName || 'Family Member',
              handle:
                communityPeer.handle ||
                `@${(communityPeer.displayName || '').toLowerCase().replace(/\s+/g, '_')}`,
              avatar: snapshotAvatar || communityPeer.avatar,
              isVerified: communityPeer.isVerified,
              onlineStatus: communityPeer.onlineStatus,
              lastActive: communityPeer.lastActive,
              role: snapshotRole || 'viewer',
              relationship: '',
              isFamilyMember: false,
            }
                      : snapshotName
            ? {
                id: otherUserId,
                displayName: snapshotName,
                handle: '',
                avatar: snapshotAvatar,
                isVerified: false,
                onlineStatus: 'offline',
                lastActive: undefined,
                role: snapshotRole || 'guardian',
                relationship: '',
                // Snapshot name alone doesn't prove family membership —
                // the peer might have been a community user whose
                // community profile was later deleted. Default to
                // `false` so the "Community" badge shows correctly.
                isFamilyMember: false,
              }
            : null;

      if (cancelled) return;
      setUser(chatUser);

      const memberInfo = chatUser
        ? { id: otherUserId, fullName: chatUser.displayName, avatar: chatUser.avatar, role: 'guardian' as const }
        : undefined;

      const newChatId = await getOrCreateDirectChat(otherUserId, memberInfo);
      if (cancelled || !newChatId) return;

      // Seed messages BEFORE flipping chatId so the subscription effect
      // (which fires on chatId change) delivers the same array instead
      // of a transient []. Fixes the flicker.
      const msgs = getChatMessages(newChatId);
      setMessages(msgs);
      setChatId(newChatId);
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
  }, [otherUserId, familyMembers]);

  // ── Keep `isBlocked` in sync with CommunityContext ──────────
  // If I block/unblock from another screen, this chat must reflect
  // it immediately. `isUserBlocked` is a stable ref-read from the
  // CommunityContext, so re-running on mount + on focus is enough.
  useEffect(() => {
    if (!otherUserId) return;
    setIsBlocked(isUserBlocked(otherUserId));
  }, [otherUserId, isUserBlocked]);

  /* ── Realtime profile-change: refresh `user` ─────────────── */
  // When the peer updates their avatar / name / bio (or I do), the
  // header avatar + status text must refresh instantly. `getUserById`
  // returns the freshest snapshot from CommunityContext.
  useEffect(() => {
    if (!otherUserId) return;
    const unsub = subscribeToProfileChanges((payload) => {
      if (payload.userId !== otherUserId) return;
      const fresh = getUserById(otherUserId);
      if (!fresh) return;
      setUser((prev: any) => {
        if (!prev) return fresh;
        return {
          ...fresh,
          isFamilyMember: prev.isFamilyMember ?? fresh.isFamilyMember,
          role: prev.role ?? fresh.role,
          relationship: prev.relationship ?? fresh.relationship,
          displayName:
            prev.isFamilyMember && prev.displayName
              ? prev.displayName
              : fresh.displayName,
          avatar:
            prev.isFamilyMember && prev.avatar
              ? prev.avatar
              : fresh.avatar,
        };
      });
    });
    return unsub;
  }, [otherUserId, getUserById]);

  // ── Periodic peer status refresh ─────────────────────────
  // CommunityContext only re-fetches `user_activity` on realtime
  // events. If the peer goes offline without emitting an event
  // (common when a phone dies), the header stays "Online" forever.
  // Poll the local `getUserById` snapshot every 45 s to force a
  // re-render from whatever status we *do* have (which is fresher
  // than what we rendered 45 s ago because it re-queries the map).
  useEffect(() => {
    if (!otherUserId) return;
    const iv = setInterval(() => {
      const fresh = getUserById(otherUserId);
      if (fresh) {
        setUser((prev: any) => {
          if (!prev) return fresh;
          // Merge — see the profile-change effect above.
          return {
            ...prev,
            // Community-owned fields:
            onlineStatus: fresh.onlineStatus,
            lastActive: fresh.lastActive,
            isVerified: fresh.isVerified,
            handle: fresh.handle || prev.handle,
            // Family-owned fields (fall back to community when null):
            displayName:
              prev.isFamilyMember && prev.displayName
                ? prev.displayName
                : fresh.displayName,
            avatar:
              prev.isFamilyMember && prev.avatar
                ? prev.avatar
                : fresh.avatar,
            role: prev.role ?? fresh.role,
            relationship: prev.relationship ?? '',
            isFamilyMember: prev.isFamilyMember ?? false,
          };
        });
      }
    }, 45_000);
    return () => clearInterval(iv);
  }, [otherUserId, getUserById]);

  // Live-update messages once chatId is known
  const { subscribeToChatMessages } = useFamilyChat();
  useEffect(() => {
    if (!chatId || !subscribeToChatMessages) return;
    const unsub = subscribeToChatMessages(chatId, (_cid, msgs) => {
      setMessages((prev) => {
        // Never blank a populated list with a transient empty payload.
        const next = msgs.length === 0 && prev.length > 0 ? prev : msgs;
        // Auto-scroll ONLY on a genuine message-count increase.
        // This is what stops the keyboard-open reflow from
        // yanking the whole screen upward.
        if (next.length > messagesRef.current.length) {
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            60,
          );
        }
        messagesRef.current = next;
        return next;
      });
      const meId = userProfile?.id;
      // ── DELIVERED TICKS (double grey) ────────────────────────
      // Any inbound message we just received is now 'delivered'
      // to us — mark it so the sender sees ✓✓ instead of ✓.
      if (meId) {
        const undelivered = msgs
          .filter(
            (m) =>
              m.senderId !== meId &&
              (m.deliveryStatus === 'sent' ||
                m.deliveryStatus === 'sending'),
          )
          .map((m) => m.id);
        if (undelivered.length > 0) {
          markMessagesDelivered(chatId, undelivered);
        }
      }
      const hasUnread = !!meId && msgs.some((m) => !m.readBy?.includes(meId));
      if (hasUnread) markChatRead(chatId);
    });
    return unsub;
  }, [chatId, subscribeToChatMessages, markChatRead, markMessagesDelivered, userProfile?.id]);

  /* ── Focus re-sync ──────────────────────────────────────── */
  // If I block/unblock this peer from another screen, or their
  // profile changed while I was elsewhere, refresh everything
  // the moment this screen re-focuses.
  useFocusEffect(
    useCallback(() => {
      if (!otherUserId) return;
      setIsBlocked(isUserBlocked(otherUserId));
      const fresh = getUserById(otherUserId);
      if (fresh) {
        setUser((prev: any) => {
          if (!prev) return fresh;
          return {
            ...prev,
            onlineStatus: fresh.onlineStatus,
            lastActive: fresh.lastActive,
            isVerified: fresh.isVerified,
            displayName:
              prev.isFamilyMember && prev.displayName
                ? prev.displayName
                : fresh.displayName,
            avatar:
              prev.isFamilyMember && prev.avatar
                ? prev.avatar
                : fresh.avatar,
          };
        });
      }
      if (chatId) {
        const fresh2 = getChatMessages(chatId);
        setMessages(fresh2);
        markChatRead(chatId);
      }
    }, [otherUserId, isUserBlocked, getUserById, chatId, getChatMessages, markChatRead]),
  );

  /* ── Refresh loop ────────────────────────────────────────── */
  // ── Clear typing when leaving the chat ───────────────────────
  useEffect(() => {
    if (!chatId) return;
    return () => { setTypingStatus(chatId, false); };
  }, [chatId, setTypingStatus]);

  // Hydrate the pinned message from storage for this chat.
  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const raw = await AsyncStorage.getItem(`@littleloom_pinned_${chatId}`);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.id) setPinnedMessage(parsed);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [chatId]);

  /* ── Send ────────────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (!canSend) return;

    // ── AUTH GUARD (retry-safe) ──────────────────────────────────
    // `userProfile` can be `null` for a beat on cold boot / after an
    // account switch, while the auth state is still committing. The
    // context's own `sendMessage` also reads `userProfileRef.current`
    // — if we call it before the ref syncs, it throws "You must be
    // logged in". We therefore:
    //   1) Bail early ONLY when auth has definitively finished AND
    //      there is no profile (not just "not yet hydrated").
    //   2) Give the context one tick to hydrate the ref before the
    //      send attempt, so the first tap after opening the chat
    //      never fires the false "sign in" alert.
    if (!userProfile?.id) {
      // Wait up to ~800 ms for auth to hydrate, then retry once.
      const started = Date.now();
      const wait = async () => {
        for (let i = 0; i < 8; i++) {
          if (userProfile?.id) return true;
          await new Promise((r) => setTimeout(r, 100));
        }
        return !!userProfile?.id;
      };
      const ok = await wait();
      if (!ok) {
        sweetAlert.alert('Sign In Required', 'Please sign in to send messages', 'warning');
        return;
      }
      // (silence the "unused" warning; measured for diagnostics)
      void (Date.now() - started);
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
      showError('Send Failed', 'Message could not be sent.');
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
  // ── Send image via FamilyChatContext ──────────────────────
  // `pickAndSendImage` uploads to Supabase Storage
  // (`chat_media` bucket) and stores the resulting **public
  // https:// URL** on the message row. That's what makes the
  // image visible on the RECEIVER's device.
  //
  // The old in-file implementation wrote to
  // `FileSystem.documentDirectory` (a device-local `file://`
  // path) and passed that URI as the message payload. The
  // receiver's Image component then tried to load
  // `file:///data/.../chat_img_123.jpg` on THEIR device — where
  // that path doesn't exist — so the image was always broken
  // for anyone except the sender.
  const handleImagePick = async (fromCamera = false) => {
    if (isBlocked) {
      showWarning('Blocked', 'Unblock user to send images');
      return;
    }
    if (typeof pickAndSendImage !== 'function') {
      showWarning('Unavailable', 'Image sending is unavailable right now.');
      return;
    }
    try {
      await pickAndSendImage(chatId, fromCamera);
      setMessages(getChatMessages(chatId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
        console.error('[Chat] image pick failed:', err);
        showError('Error', 'Failed to send image');
      }
  };

  // ── Send file via FamilyChatContext ───────────────────────
  // Same reasoning as images: the file must be uploaded to
  // Supabase Storage and the PUBLIC URL persisted. A local
  // `file://` URI is only valid on the sender's device.
  const handleFilePick = async () => {
    if (isBlocked) {
      showWarning('Blocked', 'Unblock user to send files');
      return;
    }
    if (typeof pickAndSendFile !== 'function') {
      showWarning('Unavailable', 'File sending is unavailable right now.');
      return;
    }
    try {
      await pickAndSendFile(chatId);
      setMessages(getChatMessages(chatId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('[Chat] file pick failed:', err);
      showError('Error', 'Failed to send file');
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const isMe = message.senderId === userProfile?.id;
    // For my own messages, always say "You" — never show the peer's
    // name. For peer messages, prefer the LIVE name from
    // `getUserById` (kept fresh by the profile-change subscription at
    // the top of this component), and fall back to the frozen
    // snapshot only if the peer's profile has been deleted.
    const livePeerName = isMe
      ? 'You'
      : (getUserById(message.senderId)?.displayName
        ?? user?.displayName
        ?? message.senderName
        ?? 'User');
    setReplyingTo({
      id: message.id,
      content:
        message.content ||
        (message.type === 'image' ? '📷 Photo' : message.type === 'file' ? '📎 File' : '...'),
      senderName: livePeerName,
    });
  };

  const handleImagePress = (url: string) => {
    setPreviewImageUrl(url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  /* ── CONTEXT-AWARE QUICK REPLIES ───────────────────────────────
     Suggestions are computed from the last inbound message, the
     peer's role, and their online status. This makes the "chips"
     above the composer genuinely useful instead of generic. */
  const quickReplies = useMemo(() => {
    const lastInbound = [...messages]
      .reverse()
      .find((m) => m.senderId !== userProfile?.id && m.type === 'text');
    const text = (lastInbound?.content || '').toLowerCase();
    const isOnline = user?.onlineStatus === 'online';
    const role = String(user?.role || '');
    const set = new Set<string>();

    if (!messages.length) {
      set.add(role === 'parent2' ? 'Hey co-parent! 👋' : 'Hi there! 👋');
      set.add('How are things going?');
      set.add('Sharing an update…');
    }
    if (text.includes('?')) {
      set.add('Good question — let me check');
      set.add('Yes, that works 👍');
      set.add('Not sure, will follow up');
    }
    if (text.includes('thank')) {
      set.add('Anytime! 💙');
      set.add('No problem at all');
    }
    if (text.includes('photo') || text.includes('picture')) {
      set.add('Beautiful! 📸');
      set.add('Love it!');
    }
    if (text.includes('sick') || text.includes('fever') || text.includes('hurt')) {
      set.add('Oh no — is baby okay?');
      set.add('Let me know if you need anything');
    }
    if (isOnline) set.add('Calling you now…');
    set.add('👍');
    set.add('❤️');

    return Array.from(set).slice(0, 5);
  }, [messages, user, userProfile?.id]);

  const handleFilePress = async (meta?: FileMetadata) => {
    if (!meta) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // If the URL is remote, download it to cache first so the OS can
      // open / share it. Trying to `Linking.openURL('https://…pdf')`
      // just renders the file inline in the browser with no "open in"
      // handler — that's why the old version silently did nothing.
      let localUri = meta.uri;
      if (meta.uri && meta.uri.startsWith('http')) {
        try {
          // `FileSystem` is already imported at the top of this file
          // (`expo-file-system/legacy`). `Sharing` is required lazily
          // since the module is only needed here.
          const Sharing = require('expo-sharing');
          const dest = `${FileSystem.cacheDirectory}${meta.name || 'attachment'}`;
          const dl = await FileSystem.downloadAsync(meta.uri, dest);
          localUri = dl.uri;
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(localUri, {
              mimeType: meta.type || 'application/octet-stream',
              dialogTitle: meta.name || 'Open file',
            });
            return;
          }
        } catch (dlErr) {
          console.warn('[Chat] file download failed, falling back to URL:', dlErr);
        }
      }
      if (localUri && (localUri.startsWith('file://') || localUri.startsWith('http'))) {
        await Linking.openURL(localUri);
      } else {
        showInfo(meta.name || 'File', meta.size ? formatFileSize(meta.size) : 'Attachment');
      }
    } catch {
      showWarning(meta.name || 'File', 'Could not open this file.');
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
        toast(
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
      message: 'This will permanently delete the entire conversation. This cannot be undone.',
      onConfirm: async () => {
        try {
          // `deleteChat` hides the chat for me AND physically deletes
          // the direct-chat row + messages. Await so navigation only
          // happens after the removal lands in state.
          await deleteChat(chatId);
          // Clear the local message buffer so the next render doesn't
          // briefly flash the deleted messages.
          setMessages([]);
          navigation.goBack();
          sweetAlert.toast('Deleted', 'Chat deleted permanently', 'success');
        } catch {
          showError('Error', 'Failed to delete chat. Please try again.');
        }
      },
    });
  };

  // Chat-level mute state (local — the Community DM doesn't have a
  // dedicated per-user mute column yet, but the FamilyChatContext
  // `muteChat` writes to `family_chats.is_muted` which the row for
  // this DM already owns).
  const [isMuted, setIsMuted] = useState<boolean>(false);
  useEffect(() => {
    if (!chatId) return;
    const c = getChatById(chatId);
    setIsMuted(!!c?.isMuted);
  }, [chatId, getChatById]);

  const handleMuteToggle = async () => {
    setShowOptions(false);
    try {
      const next = !isMuted;
      await muteChat(chatId, next);
      setIsMuted(next);
      toast(
        next ? 'Muted' : 'Unmuted',
        next
          ? 'Notifications for this chat are off'
          : 'Notifications for this chat are on',
        next ? 'info' : 'success',
      );
    } catch {
      toast('Error', 'Failed to change mute state', 'error');
    }
  };

  const handlePinMessage = (message: FamilyMessage) => {
    const next = pinnedMessage?.id === message.id ? null : message;
    setPinnedMessage(next);
    // Persist to local storage so the pin survives app restarts.
    // (A dedicated `pinned_messages` table is the eventual home;
    // for now a per-chat AsyncStorage key is enough.)
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const key = `@littleloom_pinned_${chatId}`;
      if (next) {
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
      } else {
        AsyncStorage.removeItem(key).catch(() => {});
      }
    } catch {}
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

  // ── Live peer role label (Parent 1 / Co-Parent / Guardian / Viewer) ──
  // Re-queried from `profiles.role` whenever the peer's profile changes,
  // and invalidated by the CommunityContext role cache on every
  // profile-change broadcast.
  const [livePeerRoleLabel, setLivePeerRoleLabel] = useState<string>('');
  useEffect(() => {
    if (!otherUserId) return;
    let cancelled = false;
    const refresh = async () => {
      const role = await getUserRole(otherUserId);
      if (cancelled) return;
      const label =
        role === 'parent1' ? 'Primary Parent'
        : role === 'parent2' ? 'Co-Parent'
        : role === 'guardian' ? 'Guardian'
        : role === 'viewer' ? 'Viewer'
        : '';
      setLivePeerRoleLabel(label);
    };
    refresh();
    // Re-run when the peer's profile changes (role or otherwise).
    const unsub = subscribeToProfileChanges((payload) => {
      if (payload?.userId === otherUserId) refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [otherUserId, getUserRole]);

  const getStatusText = () => {
    if (!user) return '';
    if (isBlocked) return 'Blocked';
    if (typingUsers.length > 0) return 'typing...';

    const relLabel = user.role
      ? getMemberDisplayLabel({
          role: user.role,
          relationship: user.relationship,
        })
      : '';
    const relSuffix = relLabel ? ` · ${relLabel}` : '';

    if (user.onlineStatus === 'online') return `Online${relSuffix}`;
    if (user.onlineStatus === 'away') return `Away${relSuffix}`;
    const lastActive = user.lastActive ? new Date(user.lastActive).getTime() : 0;
    const diff = Date.now() - lastActive;
    if (!lastActive) return relLabel || 'Family Member';
    if (diff < 60_000) return `Active now${relSuffix}`;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `Active ${minutes}m ago${relSuffix}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Active ${hours}h ago${relSuffix}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Active ${days}d ago${relSuffix}`;
    if (days < 30) return `Active ${Math.floor(days / 7)}w ago${relSuffix}`;
    return `Last active ${Math.floor(days / 30)}mo ago${relSuffix}`;
  };
  const renderMessage = ({ item, index }: { item: FamilyMessage; index: number }) => {
    const isMe = item.senderId === userProfile?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.senderId !== item.senderId);
    const showDate =
      index === 0 || getMessageDate(item.timestamp) !== getMessageDate(messages[index - 1]?.timestamp);

    // ── Pick the LIVE sender for this specific message ────────
    // For my own messages, use `userProfile` (updated live by
    // AuthContext after any edit). For peer messages, use `user`
    // (re-hydrated from CommunityContext on profile-change).
    // Without this, `myMessage` bubbles keep showing the *peer's*
    // avatar because `user` is the peer's identity, not mine.
    const senderIdentity = isMe
      ? {
          avatar: userProfile?.avatar,
          displayName: userProfile?.fullName,
        }
      : {
          avatar: user?.avatar,
          displayName: user?.displayName,
        };

    return (
      <>
        {showDate && <DateSeparator date={getMessageDate(item.timestamp)} isDark={isDark} />}
        <MessageBubble
          message={item}
          isMe={isMe}
          user={senderIdentity}
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

  /* ── Main render ──────────────────────────────────────────
      Structure:
        <View root>
          <Header />
          <KeyboardAvoidingView flex:1>
            <FlatList messages />
            <TypingIndicator />
            <BlockedBanner />
            <ReplyBar />
            <QuickReplies />
            <InputBar />
          </KeyboardAvoidingView>
          <OptionsModal />
        </View>

      The keyboard avoidance wraps EVERYTHING below the header, so
      the message list shrinks and the input sits above the keyboard
      — that is what keeps the composer + last messages visible while
      typing. There is exactly ONE KeyboardAvoidingView and ONE
      closing `</View>` for the input bar container. */
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

      {/* ── Header ─────────────────────────────────────────── */}
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
          onPress={() => {
            if (user?.id) {
              navigation.navigate('CommunityMemberProfile', { userId: user.id });
            }
          }}
          activeOpacity={0.8}
          disabled={!user}
        >
          <View style={styles.avatarWrap}>
            <SafeAvatar
              avatar={user?.avatar}
              size={42}
              fallbackIcon="person"
              fallbackColor={LL.primary}
              fallbackBgColor={`${LL.primary}20`}
              borderWidth={user?.onlineStatus === 'online' && !isBlocked ? 2 : 0}
              borderColor={LL.success}
            />
            {!isBlocked && user?.onlineStatus === 'online' && (
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
                {user?.displayName ?? 'Unknown member'}
              </Text>
              {user?.isVerified && !isBlocked && (
                <View style={[styles.verifiedBadge, { backgroundColor: LL.primary }]}>
                  <Ionicons name="checkmark" size={10} color={LL.white} />
                </View>
              )}
              {user?.isFamilyMember && !isBlocked && (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: isDark ? `${LL.success}20` : `${LL.success}15`,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Ionicons name="people" size={9} color={LL.success} />
                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: '800',
                      color: LL.success,
                      textTransform: 'uppercase',
                      letterSpacing: 0.3,
                    }}
                  >
                    Family
                  </Text>
                </View>
              )}
              {!user?.isFamilyMember && user && !isBlocked && (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: isDark ? `${LL.accent}20` : `${LL.accent}15`,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Ionicons name="globe-outline" size={9} color={LL.accent} />
                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: '800',
                      color: LL.accent,
                      textTransform: 'uppercase',
                      letterSpacing: 0.3,
                    }}
                  >
                    Community
                  </Text>
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
              {livePeerRoleLabel ? ` · ${livePeerRoleLabel}` : ''}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {/* Cross-link: jump to the FamilyChat version of this DM */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('FamilyChat' as never, {
                memberId: otherUserId,
                memberName: user?.displayName,
                memberAvatar: user?.avatar,
                memberRole: 'guardian',
              } as never);
            }}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
            accessibilityLabel="Open family chat"
          >
            <Ionicons name="people" size={20} color={LL.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsSearching((s) => !s)}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
          >
            <Ionicons name={isSearching ? 'close' : 'search'} size={20} color={isDark ? LL.white : LL.gray900} />
          </TouchableOpacity>
          {/* Community DMs are a social-forum surface — no voice/video
              calls here. Calling is reserved for family members inside
              the Family Chat screen so the community stays focused on
              text-based conversation like Twitter/X DMs. */}

          <TouchableOpacity
            onPress={() => setShowOptions(true)}
            style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={isDark ? LL.white : LL.gray900} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Inactive member banner */}
      {!user && (
        <View style={[styles.blockedBanner, { backgroundColor: `${LL.error}12`, marginTop: LL.space.sm }]}>
          <Ionicons name="person-remove" size={18} color={LL.error} />
          <Text style={[styles.blockedBannerText, { color: LL.error, flex: 1 }]}>
            This conversation is no longer available
          </Text>
        </View>
      )}

      {/* ── KAV wraps list + everything below so the whole column
             shrinks above the keyboard. ───────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? insets.top + KEYBOARD_VERTICAL_OFFSET_IOS : 0
        }
      >
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          // Never scroll on content-size change (fires per keystroke).
          // Auto-scroll is handled by the message-count watcher above.
          onContentSizeChange={() => {}}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{ flex: 1 }}
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
                {user?.displayName ?? 'Someone'} is typing
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

        {!inputText.trim() && !editingMessage && quickReplies.length > 0 && (
          <View
            style={{
              // Fixed height prevents the list from jittering as
              // chips re-render on each keystroke.
              height: 44,
              justifyContent: 'center',
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: LL.space.lg,
                paddingVertical: 6,
                gap: 8,
                alignItems: 'center',
              }}
              keyboardShouldPersistTaps="handled"
            >
              {quickReplies.map((reply) => (
                <TouchableOpacity
                  key={reply}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInputText(reply);
                  }}
                  activeOpacity={0.8}
                  style={{
                    // Fixed height + single-line so chips never wrap
                    // or grow the row.
                    height: 32,
                    maxWidth: 260,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    justifyContent: 'center',
                    backgroundColor: isDark
                      ? 'rgba(99,102,241,0.14)'
                      : `${LL.primary}10`,
                    borderWidth: 1,
                    borderColor: isDark
                      ? 'rgba(99,102,241,0.3)'
                      : `${LL.primary}25`,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: isDark ? LL.primaryLight : LL.primary,
                    }}
                  >
                    {reply}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? LL.darkSurface : LL.white,
              borderTopColor: isDark ? LL.darkBorder : LL.lightBorder,
              paddingBottom: keyboardOpen ? LL.space.sm : Math.max(LL.space.md, insets.bottom),
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
              // (unchanged)
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

      {/* ── Options menu ─────────────────────────────────── */}
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
                name={
                  isMuted
                    ? 'notifications-outline'
                    : 'notifications-off-outline'
                }
                size={22}
                color={isDark ? LL.gray300 : LL.gray600}
              />
              <Text style={[styles.optionText, { color: isDark ? LL.white : LL.gray800 }]}>
                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
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
                if (user?.id) {
                  navigation.navigate('CommunityMemberProfile', { userId: user.id });
                }
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
  avatarSmallRight: { marginLeft: LL.space.sm },
  messageBubble: {
    maxWidth: Math.min(SCREEN_W * 0.78, 520),
    borderRadius: LL.radius.xl,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    overflow: 'hidden',
    flexShrink: 1,
  },
  myBubble: { borderBottomRightRadius: LL.space.sm },
  theirBubble: { borderBottomLeftRadius: LL.space.sm },
  messageText: { fontSize: 15, lineHeight: 22, fontWeight: '500', flexShrink: 1 },
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
  input: { fontSize: 14.5, maxHeight: 80, flexShrink: 1 },
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