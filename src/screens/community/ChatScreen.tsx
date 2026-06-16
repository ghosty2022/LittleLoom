import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { CommunityStackParamList } from '../../types/navigation';

import { showConfirmModal, showErrorModal } from '../../utils/modal';
import { useApp } from '../../context/AppContext';
import { useSweetAlert } from '../../components/SweetAlert';
import { useUser } from '../../context/UserContext';
import { showAlert } from '@/utils/alert';
import Animated, {

  FadeInUp,
  FadeIn,
  FadeOut,
  Layout,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  interpolate,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';

// ═══════════════════════════════════════════════════════════
// UNIFIED LITTLELOOM THEME — matches CommunityScreen exactly
// ═══════════════════════════════════════════════════════════
const LL = {
  primary: '#7c6cf1',
  primaryLight: '#a5b4fc',
  primaryDark: '#6b5ce7',
  primaryGhost: '#7c6cf118',
  accent: '#f472b6',
  accentSoft: '#fbcfe8',
  success: '#34d399',
  warning: '#fbbf24',
  info: '#38bdf8',
  error: '#ef4444',
  white: '#ffffff',
  gray50: '#f8f9ff',
  gray100: '#f0f2ff',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  darkBg: '#0b0f1f',
  darkSurface: '#151b2e',
  darkCard: '#1a2236',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, full: 999 },
  text: {
    xs: { size: 11, line: 14, weight: '500' },
    sm: { size: 13, line: 18, weight: '600' },
    base: { size: 15, line: 22, weight: '400' },
    lg: { size: 16, line: 24, weight: '600' },
    xl: { size: 18, line: 26, weight: '700' },
    '2xl': { size: 22, line: 30, weight: '800' },
  },
  shadow: {
    sm: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#7c6cf1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 10 },
  },
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type ChatScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Chat'>;

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════
const isImageUri = (value: string | undefined | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http') || value.startsWith('file://') || value.startsWith('data:');
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
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

// ═══════════════════════════════════════════════════════════
// TYPING DOTS ANIMATION COMPONENT
// ═══════════════════════════════════════════════════════════
const TypingDots = React.memo(({ isDark }: { isDark: boolean }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })),
      -1,
      true
    );
    dot2.value = withRepeat(
      withSequence(withTiming(1, { duration: 400, easing: Easing.ease }), withTiming(0, { duration: 400, easing: Easing.ease })),
      -1,
      true
    );
    dot3.value = withRepeat(
      withSequence(withTiming(1, { duration: 400, easing: Easing.ease }), withTiming(0, { duration: 400, easing: Easing.ease })),
      -1,
      true
    );
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

// ═══════════════════════════════════════════════════════════
// DELIVERY STATUS COMPONENT
// ═══════════════════════════════════════════════════════════
const DeliveryStatus = React.memo(({ status }: { status: Message['deliveryStatus'] }) => {
  if (status === 'sending') {
    return <ActivityIndicator size={12} color={LL.gray400} style={{ marginLeft: 4 }} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={14} color={LL.error} style={{ marginLeft: 4 }} />;
  }
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={14} color={LL.gray400} style={{ marginLeft: 4 }} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done" size={14} color={LL.gray400} style={{ marginLeft: 4 }} />;
  }
  if (status === 'read') {
    return <Ionicons name="checkmark-done" size={14} color={LL.info} style={{ marginLeft: 4 }} />;
  }
  return null;
});

// ═══════════════════════════════════════════════════════════
// IMAGE PREVIEW MODAL
// ═══════════════════════════════════════════════════════════
const ImagePreviewModal = React.memo(({
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
  }, [visible]);

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
            <LinearGradient colors={[LL.gray800, LL.gray700]} style={styles.imagePreviewCloseGrad}>
              <Ionicons name="close" size={20} color={LL.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

// ═══════════════════════════════════════════════════════════
// MESSAGE BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════════
const MessageBubble = React.memo(({
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
}: {
  message: Message;
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
    setTimeout(() => { scale.value = withSpring(1); }, 150);
  };

  const bubbleBg = isMe ? LL.primary : (isDark ? LL.darkCard : LL.white);
  const bubbleBorder = isMe ? undefined : (isDark ? LL.darkBorder : LL.gray200);
  const textColor = isMe ? LL.white : (isDark ? LL.gray300 : LL.gray700);
  const metaColor = isMe ? 'rgba(255,255,255,0.7)' : (isDark ? LL.gray500 : LL.gray400);

  return (
    <Animated.View
      entering={FadeInUp.duration(300).springify()}
      layout={Layout.springify()}
      style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}
    >
      {!isMe && showAvatar && (
        <TouchableOpacity onPress={() => user && showAlert(user.displayName, `Handle: ${user.handle}`)} style={styles.avatarSmall}>
          <SafeAvatar avatar={user?.avatar} size={32} fallbackIcon="person" fallbackColor={LL.primary} fallbackBgColor={`${LL.primary}15`} />
        </TouchableOpacity>
      )}

      <View style={[!isMe && !showAvatar && { marginLeft: 44 }]}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9} delayLongPress={250}>
            <View style={[
              styles.messageBubble,
              isMe ? styles.myBubble : styles.theirBubble,
              { backgroundColor: bubbleBg },
              bubbleBorder && { borderColor: bubbleBorder, borderWidth: 1 },
            ]}>
              {/* Reply reference */}
              {message.replyTo && (
                <View style={[styles.replyPreview, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : `${LL.primary}12` }]}>
                  <View style={[styles.replyLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.5)' : LL.primary }]} />
                  <View style={styles.replyContent}>
                    <Text style={[styles.replyName, { color: isMe ? 'rgba(255,255,255,0.85)' : LL.primary }]} numberOfLines={1}>
                      {message.replyToPreview || 'Replying to message...'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Failed retry */}
              {message.deliveryStatus === 'failed' && isMe && (
                <TouchableOpacity onPress={onResend} style={styles.resendButton}>
                  <Ionicons name="refresh" size={14} color={LL.error} />
                  <Text style={[styles.resendText, { color: LL.error }]}>Tap to retry</Text>
                </TouchableOpacity>
              )}

              {/* Message content */}
              {message.type === 'image' && message.imageUrl ? (
                <TouchableOpacity onPress={() => onImagePress(message.imageUrl!)} activeOpacity={0.9}>
                  <View style={styles.imageContainer}>
                    {imageLoading && (
                      <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? LL.darkSurface : LL.gray100 }]}>
                        <ActivityIndicator size="small" color={LL.primary} />
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
                <TouchableOpacity style={styles.fileBubble} onPress={() => onFilePress(message.fileMetadata)} activeOpacity={0.8}>
                  <View style={[styles.fileIconContainer, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : `${LL.primary}18` }]}>
                    <Ionicons name={getFileIcon(message.fileMetadata?.type) as any} size={22} color={isMe ? LL.white : LL.primary} />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>{message.fileMetadata?.name || 'File'}</Text>
                    <Text style={[styles.fileSize, { color: metaColor }]}>{formatFileSize(message.fileMetadata?.size || 0)}</Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color={isMe ? 'rgba(255,255,255,0.8)' : LL.primary} />
                </TouchableOpacity>
              ) : (
                <Text style={[styles.messageText, { color: textColor }]}>{message.content}</Text>
              )}

              {/* Footer */}
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, { color: metaColor }]}>{formatTime(message.timestamp)}</Text>
                {message.isEdited && <Text style={[styles.editedLabel, { color: metaColor }]}>edited</Text>}
                {isMe && <DeliveryStatus status={message.deliveryStatus} />}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Action Menu Modal */}
      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <Pressable style={styles.actionOverlay} onPress={() => setShowActions(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={[styles.actionMenu, { backgroundColor: isDark ? LL.darkCard : LL.white, borderColor: isDark ? LL.darkBorder : LL.gray200 }]}>
            <AutoHideScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.emojiRow, { borderBottomColor: isDark ? LL.darkBorder : LL.gray200 }]}>
              {['❤️', '👍', '😂', '😮', '😢', '🎉'].map((emoji) => (
                <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => { onReaction(emoji); setShowActions(false); }}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </AutoHideScrollView>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionItem} onPress={() => { onReply(); setShowActions(false); }}>
                <Ionicons name="arrow-undo" size={20} color={LL.primary} />
                <Text style={[styles.actionText, { color: isDark ? LL.white : LL.gray800 }]}>Reply</Text>
              </TouchableOpacity>
              {isMe && (
                <>
                  <TouchableOpacity style={styles.actionItem} onPress={() => { onEdit(); setShowActions(false); }}>
                    <Ionicons name="pencil" size={20} color={LL.accent} />
                    <Text style={[styles.actionText, { color: isDark ? LL.white : LL.gray800 }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionItem} onPress={() => { onDelete(); setShowActions(false); }}>
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
});

// ═══════════════════════════════════════════════════════════
// REPLY PREVIEW BAR
// ═══════════════════════════════════════════════════════════
const ReplyPreviewBar = React.memo(({
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
    <View style={[styles.replyBar, { backgroundColor: isDark ? LL.darkSurface : LL.gray50, borderTopColor: isDark ? LL.darkBorder : LL.gray200 }]}>
      <View style={styles.replyBarContent}>
        <View style={[styles.replyBarLine, { backgroundColor: LL.primary }]} />
        <View style={styles.replyBarText}>
          <Text style={[styles.replyBarName, { color: LL.primary }]}>{replyTo.senderName}</Text>
          <Text style={[styles.replyBarPreview, { color: isDark ? LL.gray400 : LL.gray500 }]} numberOfLines={1}>{replyTo.content}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onCancel} style={styles.replyBarClose}>
        <Ionicons name="close" size={20} color={isDark ? LL.gray500 : LL.gray400} />
      </TouchableOpacity>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════
// DATE SEPARATOR
// ═══════════════════════════════════════════════════════════
const DateSeparator = React.memo(({ date, isDark }: { date: string; isDark: boolean }) => (
  <View style={styles.dateSeparator}>
    <View style={[styles.dateLine, { backgroundColor: isDark ? LL.darkBorder : LL.gray200 }]} />
    <Text style={[styles.dateText, { color: isDark ? LL.gray500 : LL.gray400 }]}>{date}</Text>
    <View style={[styles.dateLine, { backgroundColor: isDark ? LL.darkBorder : LL.gray200 }]} />
  </View>
));

// ═══════════════════════════════════════════════════════════
// MAIN CHAT SCREEN
// ═══════════════════════════════════════════════════════════
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
  const { isDark } = useApp();
  const { profile } = useUser();
  const sweetAlert = useSweetAlert();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
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
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);

  const flatListRef = useRef<AutoHideFlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chat
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

  // ═══════════════════════════════════════════════════════════
  // MESSAGE ACTIONS
  // ═══════════════════════════════════════════════════════════
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isBlocked) return;
    if (!currentUser) {
      sweetAlert.alert('Sign In Required', 'Please sign in to send messages', 'warning');
      return;
    }

    const content = inputText.trim();
    setInputText('');

    if (editingMessage) {
      await editMessage(userId, editingMessage, content);
      setEditingMessage(null);
    } else {
      await sendMessage(userId, content, 'text', undefined, undefined, replyingTo?.id);
    }

    setReplyingTo(null);
    setTypingStatus(userId, false);
    refreshMessages();
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [inputText, userId, currentUser, isBlocked, editingMessage, replyingTo, sendMessage, editMessage, setTypingStatus]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(userId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingStatus(userId, false), 3000);
    } else {
      setTypingStatus(userId, false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MEDIA & FILE HANDLING
  // ═══════════════════════════════════════════════════════════
  const handleImagePick = async (fromCamera: boolean = false) => {
    if (isBlocked) { sweetAlert.alert('Blocked', 'Unblock user to send images', 'warning'); return; }
    try {
      let result;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { sweetAlert.alert('Permission Required', 'Camera access is needed', 'warning'); return; }
        result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { sweetAlert.alert('Permission Required', 'Photo library access is needed', 'warning'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      }

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const fileName = `chat_img_${Date.now()}.jpg`;
        const dir = FileSystem.documentDirectory + 'community_chat_media/';
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const permanentUri = dir + fileName;
        await FileSystem.copyAsync({ from: uri, to: permanentUri });
        await sendMessage(userId, '📷 Photo', 'image', permanentUri);
        refreshMessages();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Image pick error:', error);
      sweetAlert.alert('Error', 'Failed to send image', 'error');
    }
  };

  const handleFilePick = async () => {
    if (isBlocked) { sweetAlert.alert('Blocked', 'Unblock user to send files', 'warning'); return; }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      const fileName = `chat_file_${Date.now()}_${asset.name}`;
      const dir = FileSystem.documentDirectory + 'community_chat_files/';
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const permanentUri = dir + fileName;
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

      const fileMeta: FileMetadata = {
        name: asset.name || 'Unknown file',
        size,
        type: asset.mimeType || 'application/octet-stream',
        uri: permanentUri,
      };

      await sendMessage(userId, `📎 ${asset.name}`, 'file', permanentUri, fileMeta);
      refreshMessages();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('File pick error:', error);
      sweetAlert.alert('Error', 'Failed to send file', 'error');
    }
  };

  const showImageSourceAlert = () => {

showAlert('Send Photo', 'Choose a photo source', [
      { text: 'Cancel', style: 'cancel' },
      { text: '📷 Camera', onPress: () => handleImagePick(true) },
      { text: '🖼️ Gallery', onPress: () => handleImagePick(false) },
    ]);
  };

  // ═══════════════════════════════════════════════════════════
  // MESSAGE INTERACTIONS
  // ═══════════════════════════════════════════════════════════
  const handleReaction = async (messageId: string, emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Implement reaction storage in CommunityContext
    console.log('Reaction:', messageId, emoji);
  };

  const handleDelete = async (messageId: string) => {
    showConfirmModal({
      title: 'Delete Message',
      message: 'Are you sure? This cannot be undone.',
      onConfirm: () => {
        // TODO: Implement delete in CommunityContext
        refreshMessages();
      },
    });
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message.id);
    setInputText(message.content);
  };

  const handleReply = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyingTo({
      id: message.id,
      content: message.content || (message.type === 'image' ? '📷 Photo' : message.type === 'file' ? '📎 File' : '...'),
      senderName: message.senderId === currentUser?.id ? 'You' : user?.displayName || 'User',
    });
  };

  const handleImagePress = (url: string) => {
    setPreviewImageUrl(url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFilePress = async (meta?: FileMetadata) => {
    if (!meta) return;

showAlert(meta.name, `Size: ${formatFileSize(meta.size)}
Type: ${meta.type}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Share', onPress: async () => {
        const { Share } = await import('react-native');
        Share.share({ url: meta.uri, title: meta.name });
      }},
    ]);
  };

  const handleResend = async (messageId: string) => {
    await resendMessage(userId, messageId);
    refreshMessages();
  };

  // ═══════════════════════════════════════════════════════════
  // USER ACTIONS
  // ═══════════════════════════════════════════════════════════
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
        sweetAlert.toast(isBlocked ? 'Unblocked' : 'Blocked', isBlocked ? 'User unblocked' : 'User blocked', isBlocked ? 'success' : 'warning');
      },
    });
  };

  const handleDeleteChat = () => {
    setShowOptions(false);
    showConfirmModal({
      title: 'Delete Chat',
      message: 'This will delete the entire conversation. This cannot be undone.',
      onConfirm: () => {
        deleteChat(userId);
        navigation.goBack();
        sweetAlert.toast('Deleted', 'Chat deleted', 'success');
      },
    });
  };

  const handleMuteToggle = () => {
    // TODO: Implement mute in CommunityContext
    sweetAlert.toast('Coming Soon', 'Mute feature will be available soon', 'info');
    setShowOptions(false);
  };

  const handlePinMessage = (message: Message) => {
    setPinnedMessage(pinnedMessage?.id === message.id ? null : message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ═══════════════════════════════════════════════════════════
  // SEARCH FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const searchResultCount = filteredMessages.length;

  // ═══════════════════════════════════════════════════════════
  // STATUS HELPERS
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  // RENDER MESSAGE
  // ═══════════════════════════════════════════════════════════
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === currentUser?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.senderId !== item.senderId);
    const showDate = index === 0 || getMessageDate(item.timestamp) !== getMessageDate(messages[index - 1]?.timestamp);

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
        />
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER HEADER
  // ═══════════════════════════════════════════════════════════
  const renderHeader = () => (
    <>
      {/* Search Bar */}
      {isSearching && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.searchBar, { backgroundColor: isDark ? LL.darkSurface : LL.white, borderBottomColor: isDark ? LL.darkBorder : LL.gray200 }]}>
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
            <Text style={[styles.searchResultText, { color: isDark ? LL.gray500 : LL.gray400 }]}>
              {searchResultCount} result{searchResultCount !== 1 ? 's' : ''}
            </Text>
          )}
        </Animated.View>
      )}

      {/* Pinned Message */}
      {pinnedMessage && (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.pinnedBar, { backgroundColor: isDark ? `${LL.primary}15` : `${LL.primary}08`, borderBottomColor: isDark ? LL.darkBorder : LL.gray200 }]}>
          <Ionicons name="pin" size={16} color={LL.primary} />
          <Text style={[styles.pinnedText, { color: isDark ? LL.gray300 : LL.gray600 }]} numberOfLines={1}>
            {pinnedMessage.content || '📷 Photo'}
          </Text>
          <TouchableOpacity onPress={() => setPinnedMessage(null)}>
            <Ionicons name="close" size={16} color={isDark ? LL.gray500 : LL.gray400} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );

  // ═══════════════════════════════════════════════════════════
  // LOADING / ERROR STATES
  // ═══════════════════════════════════════════════════════════
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={LL.primary} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.gray50 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centered}>
          <LinearGradient colors={isDark ? [`${LL.primary}20`, `${LL.primaryDark}20`] : [`${LL.primary}15`, `${LL.primaryDark}15`]} style={styles.emptyIconBg}>
            <Ionicons name="person-outline" size={40} color={LL.primary} />
          </LinearGradient>
          <Text style={[styles.errorText, { color: isDark ? LL.gray400 : LL.gray500 }]}>User not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
            <LinearGradient colors={[LL.primary, LL.primaryDark]} style={styles.goBackGrad}>
              <Text style={styles.goBackText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <View style={[styles.container, { backgroundColor: isDark ? LL.darkBg : LL.gray50 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Image Preview Modal */}
      <ImagePreviewModal visible={!!previewImageUrl} imageUrl={previewImageUrl || ''} onClose={() => setPreviewImageUrl(null)} isDark={isDark} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: isDark ? LL.darkSurface : LL.white, borderBottomColor: isDark ? LL.darkBorder : LL.gray200 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}>
          <Ionicons name="arrow-back" size={22} color={isDark ? LL.white : LL.gray800} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.userInfo} onPress={() => navigation.navigate('CommunityMemberProfile', { userId: user.id })}>
          <View style={styles.avatarWrap}>
            <SafeAvatar avatar={user.avatar} size={42} fallbackIcon="person" fallbackColor={LL.primary} fallbackBgColor={`${LL.primary}15`} borderWidth={user.onlineStatus === 'online' && !isBlocked ? 2 : 0} borderColor={LL.success} />
            {!isBlocked && user.onlineStatus === 'online' && (
              <View style={[styles.onlineDot, { borderColor: isDark ? LL.darkSurface : LL.white }]}>
                <View style={[styles.onlineDotInner, { backgroundColor: LL.success }]} />
              </View>
            )}
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: isBlocked ? (isDark ? LL.gray500 : LL.gray400) : (isDark ? LL.white : LL.gray900) }]}>{user.displayName}</Text>
              {user.isVerified && !isBlocked && (
                <View style={[styles.verifiedBadge, { backgroundColor: LL.primary }]}>
                  <Ionicons name="checkmark" size={10} color={LL.white} />
                </View>
              )}
            </View>
            <Text style={[
              styles.userStatus,
              { color: isBlocked ? LL.error : (isDark ? LL.gray500 : LL.gray400) },
              getTypingStatus(userId) && { color: LL.primary, fontStyle: 'italic', fontWeight: '700' },
            ]}>
              {getStatusText()}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setIsSearching(s => !s)} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}>
            <Ionicons name={isSearching ? "close" : "search"} size={20} color={isDark ? LL.white : LL.gray800} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowOptions(true)} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100 }]}>
            <Ionicons name="ellipsis-vertical" size={20} color={isDark ? LL.white : LL.gray800} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages List ── */}
      <AutoHideFlatList
        ref={flatListRef}
        data={filteredMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => !searchQuery && flatListRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          searchQuery ? (
            <View style={styles.emptyChat}>
              <Ionicons name="search-outline" size={48} color={isDark ? LL.gray600 : LL.gray300} />
              <Text style={[styles.emptyText, { color: isDark ? LL.gray400 : LL.gray500 }]}>No messages found</Text>
            </View>
          ) : (
            <View style={styles.emptyChat}>
              <LinearGradient colors={isDark ? [`${LL.primary}20`, `${LL.primaryDark}20`] : [`${LL.primary}15`, `${LL.primaryDark}15`]} style={styles.emptyIconBg}>
                <Ionicons name="chatbubbles-outline" size={40} color={LL.primary} />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: isDark ? LL.white : LL.gray800 }]}>No messages yet</Text>
              <Text style={[styles.emptySubtext, { color: isDark ? LL.gray400 : LL.gray500 }]}>Say hello to start the conversation!</Text>
            </View>
          )
        }
      />

      {/* ── Typing Indicator ── */}
      {getTypingStatus(userId) && !isBlocked && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.typingContainer}>
          <View style={[styles.typingBubble, { backgroundColor: isDark ? LL.darkCard : LL.white, borderColor: isDark ? LL.darkBorder : LL.gray200, borderWidth: 1 }]}>
            <Text style={[styles.typingLabel, { color: isDark ? LL.gray400 : LL.gray500 }]}>{user.displayName} is typing</Text>
            <TypingDots isDark={isDark} />
          </View>
        </Animated.View>
      )}

      {/* ── Blocked Warning ── */}
      {isBlocked && (
        <View style={[styles.blockedBanner, { backgroundColor: `${LL.error}12` }]}>
          <Ionicons name="ban" size={18} color={LL.error} />
          <Text style={[styles.blockedBannerText, { color: LL.error }]}>You have blocked this user</Text>
          <TouchableOpacity onPress={handleBlock}>
            <Text style={[styles.unblockText, { color: LL.primary }]}>Unblock</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Reply Preview ── */}
      <ReplyPreviewBar replyTo={replyingTo} onCancel={() => setReplyingTo(null)} isDark={isDark} />

      {/* ── Input Area ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[styles.inputContainer, { backgroundColor: isDark ? LL.darkSurface : LL.white, borderTopColor: isDark ? LL.darkBorder : LL.gray200 }]}>
          <TouchableOpacity style={[styles.attachBtn, isBlocked && styles.disabledBtn]} onPress={showImageSourceAlert} disabled={isBlocked}>
            <View style={[styles.attachBtnBg, { backgroundColor: isDark ? 'rgba(124,108,241,0.15)' : `${LL.primary}10` }]}>
              <Ionicons name="image-outline" size={22} color={isBlocked ? (isDark ? LL.gray600 : LL.gray300) : LL.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.attachBtn, isBlocked && styles.disabledBtn]} onPress={handleFilePick} disabled={isBlocked}>
            <View style={[styles.attachBtnBg, { backgroundColor: isDark ? 'rgba(124,108,241,0.15)' : `${LL.primary}10` }]}>
              <Ionicons name="document-attach-outline" size={22} color={isBlocked ? (isDark ? LL.gray600 : LL.gray300) : LL.primary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : LL.gray100, borderColor: isDark ? LL.darkBorder : LL.gray200 }]}>
            <TextInput
              style={[styles.input, { color: isDark ? LL.white : LL.gray900 }]}
              placeholder={isBlocked ? 'Unblock to send...' : editingMessage ? 'Edit message...' : 'Type a message...'}
              placeholderTextColor={isDark ? LL.gray500 : LL.gray400}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={500}
              editable={!isBlocked}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isBlocked) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isBlocked}
          >
            <LinearGradient
              colors={inputText.trim() && !isBlocked ? [LL.primary, LL.primaryDark] : [LL.gray200, LL.gray200]}
              style={styles.sendBtnGrad}
            >
              <Ionicons name="arrow-up" size={18} color={inputText.trim() && !isBlocked ? LL.white : (isDark ? LL.gray600 : LL.gray400)} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Options Modal ── */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={[styles.optionsMenu, { backgroundColor: isDark ? LL.darkCard : LL.white, borderColor: isDark ? LL.darkBorder : LL.gray200 }]}>
            <TouchableOpacity style={styles.optionItem} onPress={handleMuteToggle}>
              <Ionicons name="notifications-off-outline" size={22} color={isDark ? LL.gray300 : LL.gray600} />
              <Text style={[styles.optionText, { color: isDark ? LL.white : LL.gray800 }]}>Mute Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
              <Ionicons name={isBlocked ? 'checkmark-circle' : 'ban'} size={22} color={isBlocked ? LL.success : LL.error} />
              <Text style={[styles.optionText, { color: isBlocked ? LL.success : LL.error }]}>{isBlocked ? 'Unblock User' : 'Block User'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleDeleteChat}>
              <Ionicons name="trash" size={22} color={LL.error} />
              <Text style={[styles.optionText, { color: LL.error }]}>Delete Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionItem, styles.optionItemLast]} onPress={() => { setShowOptions(false); navigation.navigate('CommunityMemberProfile', { userId: user.id }); }}>
              <Ionicons name="person" size={22} color={LL.primary} />
              <Text style={[styles.optionText, { color: isDark ? LL.white : LL.gray800 }]}>View Profile</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LL.space.sm,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: LL.space.md,
  },
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
  userName: { fontSize: LL.text.base.size, fontWeight: '700' },
  userStatus: { fontSize: LL.text.sm.size, marginTop: 2, fontWeight: '500' },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchBar: {
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    borderBottomWidth: 1,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: LL.radius.full,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
    gap: LL.space.sm,
  },
  searchInput: { flex: 1, fontSize: LL.text.base.size, paddingVertical: 2 },
  searchResultText: { fontSize: LL.text.xs.size, marginTop: LL.space.sm, fontWeight: '600' },

  // Pinned
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.sm,
    gap: LL.space.sm,
    borderBottomWidth: 1,
  },
  pinnedText: { flex: 1, fontSize: LL.text.sm.size, fontWeight: '600' },

  // Messages List
  messagesList: { paddingHorizontal: LL.space.lg, paddingTop: LL.space.sm, paddingBottom: LL.space.lg },

  // Date Separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: LL.space.lg,
    gap: LL.space.md,
  },
  dateLine: { flex: 1, height: 1 },
  dateText: { fontSize: LL.text.xs.size, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  // Message Bubble
  messageContainer: { marginBottom: LL.space.sm, flexDirection: 'row', alignItems: 'flex-end' },
  myMessage: { justifyContent: 'flex-end' },
  theirMessage: { justifyContent: 'flex-start' },
  avatarSmall: { marginRight: LL.space.sm },
  messageBubble: {
    maxWidth: SCREEN_W * 0.75,
    borderRadius: LL.radius.xl,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.md,
  },
  myBubble: { borderBottomRightRadius: LL.space.sm },
  theirBubble: { borderBottomLeftRadius: LL.space.sm },
  messageText: { fontSize: LL.text.base.size, lineHeight: 22, fontWeight: '500' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: LL.space.xs, gap: 6 },
  messageTime: { fontSize: LL.text.xs.size, fontWeight: '500' },
  editedLabel: { fontSize: LL.text.xs.size, fontStyle: 'italic', fontWeight: '500' },

  // Reply Preview inside bubble
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: LL.space.sm,
    borderRadius: LL.radius.md,
    marginBottom: LL.space.sm,
  },
  replyLine: { width: 3, height: '100%', borderRadius: 2, marginRight: LL.space.sm },
  replyContent: { flex: 1 },
  replyName: { fontSize: LL.text.xs.size, fontWeight: '700' },

  // Resend
  resendButton: { flexDirection: 'row', alignItems: 'center', marginBottom: LL.space.sm, gap: 6 },
  resendText: { fontSize: LL.text.xs.size, fontWeight: '600' },

  // Image
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

  // File
  fileBubble: { flexDirection: 'row', alignItems: 'center', padding: LL.space.md, gap: LL.space.md },
  fileIconContainer: { width: 44, height: 44, borderRadius: LL.radius.md, alignItems: 'center', justifyContent: 'center' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: LL.text.sm.size, fontWeight: '600' },
  fileSize: { fontSize: LL.text.xs.size, marginTop: 2, fontWeight: '500' },

  // Action Menu
  actionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  actionMenu: { margin: LL.space.lg, borderRadius: LL.radius['2xl'], padding: LL.space.lg, overflow: 'hidden', ...LL.shadow.lg },
  emojiRow: { flexDirection: 'row', paddingBottom: LL.space.md, borderBottomWidth: 1 },
  emojiButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26 },
  actionButtons: { paddingTop: LL.space.md },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: LL.space.md, gap: LL.space.md },
  actionText: { fontSize: LL.text.base.size, fontWeight: '600' },

  // Reply Bar
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
  replyBarName: { fontSize: LL.text.sm.size, fontWeight: '700', marginBottom: 2 },
  replyBarPreview: { fontSize: LL.text.sm.size, fontWeight: '500' },
  replyBarClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Typing
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
  typingLabel: { fontSize: LL.text.sm.size, fontWeight: '600' },
  typingDotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  typingDot: { width: 6, height: 6, borderRadius: 3 },

  // Blocked Banner
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: LL.space.md,
    gap: LL.space.sm,
  },
  blockedBannerText: { fontSize: LL.text.sm.size, fontWeight: '700' },
  unblockText: { fontSize: LL.text.sm.size, fontWeight: '800' },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LL.space.md,
    paddingVertical: LL.space.md,
    paddingBottom: Platform.OS === 'ios' ? LL.space.xl : LL.space.md,
    gap: LL.space.sm,
    borderTopWidth: 1,
  },
  attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  attachBtnBg: { width: 36, height: 36, borderRadius: LL.radius.md, alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { opacity: 0.4 },
  inputWrap: {
    flex: 1,
    borderRadius: LL.radius.full,
    borderWidth: 1,
    paddingHorizontal: LL.space.lg,
    paddingVertical: LL.space.sm,
    maxHeight: 100,
  },
  input: { fontSize: LL.text.base.size, maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: LL.radius.full, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Modal / Options
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  optionsMenu: { margin: LL.space.lg, borderRadius: LL.radius['2xl'], padding: LL.space.sm, overflow: 'hidden', ...LL.shadow.lg },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: LL.space.lg, paddingVertical: LL.space.md, gap: LL.space.md },
  optionItemLast: { borderBottomWidth: 0 },
  optionText: { fontSize: LL.text.base.size, fontWeight: '600' },

  // Image Preview
  imagePreviewOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imagePreviewContainer: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' },
  imagePreviewLoader: { position: 'absolute' },
  imagePreviewImage: { width: SCREEN_W * 0.9, height: SCREEN_H * 0.7, borderRadius: LL.radius.lg },
  imagePreviewClose: { position: 'absolute', top: 50, right: 20 },
  imagePreviewCloseGrad: { width: 44, height: 44, borderRadius: LL.radius.full, alignItems: 'center', justifyContent: 'center' },

  // Empty States
  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: LL.radius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LL.space.lg,
  },
  emptyTitle: { fontSize: LL.text.xl.size, fontWeight: '800', marginBottom: LL.space.sm, textAlign: 'center' },
  emptyText: { fontSize: LL.text.base.size, textAlign: 'center', fontWeight: '500' },
  emptySubtext: { fontSize: LL.text.sm.size, marginTop: LL.space.sm, fontWeight: '500' },
  errorText: { fontSize: LL.text.base.size, fontWeight: '600', marginBottom: LL.space.lg },
  goBackButton: { borderRadius: LL.radius.full, overflow: 'hidden' },
  goBackGrad: { paddingHorizontal: LL.space.xl, paddingVertical: LL.space.md },
  goBackText: { color: LL.white, fontSize: LL.text.sm.size, fontWeight: '700' },
});
