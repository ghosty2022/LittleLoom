import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, Layout, useAnimatedStyle, withSpring, useSharedValue, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Message, MessageType, FileMetadata } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showErrorModal, showConfirmModal } from '../../utils/modal';
import {
  CommunityColors,
  CommunityGradients,
  CommunitySpacing,
  CommunityBorderRadius,
  CommunityShadows
} from '../../theme/CommunityTheme';

type ChatScreenProps = NativeStackScreenProps<<CommunityStackParamList, 'Chat'>;

const { width, height } = Dimensions.get('window');

// ==================== IMAGE UTILITY FUNCTIONS ====================
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
      (code >= 0x1F600 && code <= 0x1F64F) || (code >= 0x1F300 && code <= 0x1F5FF) ||
      (code >= 0x1F680 && code <= 0x1F6FF) || (code >= 0x1F1E0 && code <= 0x1F1FF) ||
      (code >= 0x2600 && code <= 0x26FF) || (code >= 0x2700 && code <= 0x27BF) ||
      (code >= 0x1F900 && code <= 0x1F9FF) || (code >= 0x1F018 && code <= 0x1F270) ||
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
      (code >= 0x1F3FB && code <= 0x1F3FF) || (code >= 0x1F3E0 && code <= 0x1F3F4) ||
      (code >= 0x1F3F8 && code <= 0x1F43F) || code === 0x1F440 ||
      (code >= 0x1F442 && code <= 0x1F4FF) || (code >= 0x1F500 && code <= 0x1F53D) ||
      (code >= 0x1F54B && code <= 0x1F54E) || (code >= 0x1F550 && code <= 0x1F567) ||
      (code >= 0x1F595 && code <= 0x1F596) || (code >= 0x1F5FB && code <= 0x1F64F) ||
      (code >= 0x1F680 && code <= 0x1F6C5) || (code >= 0x1F6CB && code <= 0x1F6D2) ||
      (code >= 0x1F6E0 && code <= 0x1F6E5) || code === 0x1F6E9 ||
      (code >= 0x1F6EB && code <= 0x1F6EC) || code === 0x1F6F0 ||
      (code >= 0x1F6F3 && code <= 0x1F6F8) || (code >= 0x1F910 && code <= 0x1F93A) ||
      (code >= 0x1F93C && code <= 0x1F93E) || (code >= 0x1F940 && code <= 0x1F945) ||
      (code >= 0x1F947 && code <= 0x1F94C) || (code >= 0x1F950 && code <= 0x1F96B) ||
      (code >= 0x1F980 && code <= 0x1F997) || code === 0x1F9C0 ||
      (code >= 0x1F9D0 && code <= 0x1F9E6)
    );
    if (!isEmojiChar) return false;
  }
  return true;
};

// ==================== SAFE AVATAR RENDERER ====================
const SafeAvatar: React.FC<<{
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
        colors={hasImage ? ['#f0f0f0', '#e0e0e0'] : [fallbackColor + '40', fallbackColor + '20']}
        style={[styles.avatarGradient, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {hasImage ? (
          <Image
            source={{ uri: avatar! }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
            onError={(e) => console.log('Avatar image error:', e.nativeEvent.error)}
          />
        ) : hasEmoji ? (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{avatar}</Text>
        ) : (
          <Text style={[styles.avatarEmoji, { fontSize: size * 0.5 }]}>{fallbackEmoji}</Text>
        )}
      </LinearGradient>
    </View>
  );
};

// ==================== DELIVERY STATUS INDICATOR ====================
const DeliveryStatus: React.FC<{ status: Message['deliveryStatus'] }> = ({ status }) => {
  if (status === 'sending') {
    return <ActivityIndicator size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={14} color="#ff4757" style={{ marginLeft: 4 }} />;
  }
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
  }
  if (status === 'read') {
    return <Ionicons name="checkmark-done" size={14} color="#34b7f1" style={{ marginLeft: 4 }} />;
  }
  return null;
};

// ==================== FILE BUBBLE COMPONENT ====================
const FileBubble: React.FC<<{
  fileMeta?: FileMetadata;
  isMe: boolean;
  onPress: () => void;
}> = ({ fileMeta, isMe, onPress }) => {
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
      <View style={[styles.fileIconContainer, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#667eea20' }]}>
        <Ionicons name={getFileIcon() as any} size={24} color={isMe ? '#fff' : '#667eea'} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, isMe && styles.fileNameMe]} numberOfLines={1}>
          {fileMeta.name}
        </Text>
        <Text style={[styles.fileSize, isMe && styles.fileSizeMe]}>
          {formatFileSize(fileMeta.size)}
        </Text>
      </View>
      <Ionicons name="download-outline" size={18} color={isMe ? 'rgba(255,255,255,0.8)' : '#667eea'} />
    </TouchableOpacity>
  );
};

// ==================== IMAGE PREVIEW MODAL ====================
const ImagePreviewModal: React.FC<<{
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}> = ({ visible, imageUrl, onClose }) => {
  const [loading, setLoading] = useState(true);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.imagePreviewOverlay} onPress={onClose} activeOpacity={1}>
        <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="dark" />
        <Animated.View entering={FadeIn} style={styles.imagePreviewContainer}>
          {loading && (
            <ActivityIndicator size="large" color="#667eea" style={styles.imagePreviewLoader} />
          )}
          <Image
            source={{ uri: imageUrl }}
            style={styles.imagePreviewImage}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
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

// ==================== MESSAGE BUBBLE COMPONENT ====================
const MessageBubble: React.FC<<{
  message: Message;
  isMe: boolean;
  user: any;
  showAvatar: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onImagePress: (url: string) => void;
  onFilePress: (meta?: FileMetadata) => void;
  onResend: () => void;
}> = ({
  message,
  isMe,
  user,
  showAvatar,
  onReaction,
  onReply,
  onDelete,
  onEdit,
  onImagePress,
  onFilePress,
  onResend,
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
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Animated.View
      entering={isMe ? FadeInUp : FadeInUp}
      layout={Layout.springify()}
      style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}
    >
      {!isMe && showAvatar && (
        <TouchableOpacity
          onPress={() => user && Alert.alert(user.displayName, `Handle: ${user.handle}`)}
          style={styles.avatarSmall}
        >
          <SafeAvatar avatar={user?.avatar} size={32} fallbackEmoji="👤" fallbackColor="#667eea" />
        </TouchableOpacity>
      )}

      <View style={[!isMe && !showAvatar && { marginLeft: 44 }]}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            onLongPress={handleLongPress}
            activeOpacity={0.9}
            delayLongPress={200}
          >
            <View style={[
              styles.messageBubble,
              isMe ? styles.myBubble : styles.theirBubble,
            ]}>
              {/* Reply reference */}
              {message.replyTo && (
                <View style={[styles.replyPreview, isMe ? styles.replyPreviewMe : styles.replyPreviewThem]}>
                  <View style={[styles.replyLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.5)' : '#667eea' }]} />
                  <View style={styles.replyContent}>
                    <Text style={[styles.replyName, isMe && styles.replyNameMe]} numberOfLines={1}>
                      {message.replyToPreview || 'Replying to message...'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Failed retry */}
              {message.deliveryStatus === 'failed' && isMe && (
                <TouchableOpacity onPress={onResend} style={styles.resendButton}>
                  <Ionicons name="refresh" size={16} color="#ff4757" />
                  <Text style={styles.resendText}>Tap to retry</Text>
                </TouchableOpacity>
              )}

              {/* Message content */}
              {message.type === 'image' && message.imageUrl ? (
                <TouchableOpacity onPress={() => onImagePress(message.imageUrl)} activeOpacity={0.9}>
                  <View style={styles.imageContainer}>
                    {imageLoading && (
                      <View style={styles.imagePlaceholder}>
                        <ActivityIndicator size="small" color={isMe ? '#fff' : '#667eea'} />
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
                />
              ) : (
                <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
                  {message.content}
                </Text>
              )}

              {/* Footer */}
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, isMe ? styles.myTime : styles.theirTime]}>
                  {formatTime(message.timestamp)}
                </Text>
                {message.isEdited && (
                  <Text style={[styles.editedLabel, isMe && styles.editedLabelMe]}>edited</Text>
                )}
                {isMe && <DeliveryStatus status={message.deliveryStatus} />}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Action Menu */}
      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={styles.actionOverlay} onPress={() => setShowActions(false)}>
          <BlurView intensity={90} style={styles.actionMenu} tint="light">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
              {['❤️', '👍', '😂', '😮', '😢', '🎉'].map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => { onReaction(emoji); setShowActions(false); }}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionItem} onPress={() => { onReply(); setShowActions(false); }}>
                <Ionicons name="arrow-undo" size={20} color="#667eea" />
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
              {isMe && (
                <>
                  <TouchableOpacity style={styles.actionItem} onPress={() => { onEdit(); setShowActions(false); }}>
                    <Ionicons name="pencil" size={20} color="#f59e0b" />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionItem} onPress={() => { onDelete(); setShowActions(false); }}>
                    <Ionicons name="trash" size={20} color="#ff4757" />
                    <Text style={[styles.actionText, { color: '#ff4757' }]}>Delete</Text>
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

// ==================== REPLY PREVIEW BAR ====================
const ReplyPreviewBar: React.FC<<{
  replyTo: { id: string; content: string; senderName: string } | null;
  onCancel: () => void;
}> = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;

  return (
    <View style={styles.replyBar}>
      <View style={styles.replyBarContent}>
        <View style={styles.replyBarLine} />
        <View style={styles.replyBarText}>
          <Text style={styles.replyBarName}>{replyTo.senderName}</Text>
          <Text style={styles.replyBarPreview} numberOfLines={1}>{replyTo.content}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onCancel} style={styles.replyBarClose}>
        <Ionicons name="close" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );
};

// ==================== MAIN SCREEN ====================
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

  const flatListRef = useRef<<FlatList>(null);
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
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        const permanentUri = FileSystem.documentDirectory + 'community_chat_media/' + fileName;
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'community_chat_media/', { intermediates: true });
        await FileSystem.copyAsync({ from: uri, to: permanentUri });

        await sendMessage(userId, '📷 Photo', 'image', permanentUri);
        refreshMessages();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      const fileName = `chat_file_${Date.now()}_${asset.name}`;
      const permanentUri = FileSystem.documentDirectory + 'community_chat_files/' + fileName;
      await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'community_chat_files/', { intermediates: true });
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
      showErrorModal({ message: 'Failed to send file' });
    }
  };

  const showImageSourceAlert = () => {
    Alert.alert(
      'Send Photo',
      'Choose a photo source',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '📷 Camera', onPress: () => handleImagePick(true) },
        { text: '🖼️ Gallery', onPress: () => handleImagePick(false) },
      ]
    );
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    // Community context doesn't have addReaction yet, but we can add it later
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = async (messageId: string) => {
    // Use deleteChat or implement per-message delete in context
    refreshMessages();
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message.id);
    setInputText(message.content);
  };

  const handleReply = (message: Message) => {
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
    try {
      Alert.alert(
        meta.name,
        `Size: ${meta.size} bytes\nType: ${meta.type}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share', onPress: async () => {
              const { Share } = await import('react-native');
              Share.share({ url: meta.uri, title: meta.name });
            }
          },
        ]
      );
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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === currentUser?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.senderId !== item.senderId);

    return (
      <MessageBubble
        message={item}
        isMe={isMe}
        user={user}
        showAvatar={showAvatar}
        onReaction={(emoji) => handleReaction(item.id, emoji)}
        onReply={() => handleReply(item)}
        onDelete={() => handleDelete(item.id)}
        onEdit={() => handleEdit(item)}
        onImagePress={handleImagePress}
        onFilePress={handleFilePress}
        onResend={() => handleResend(item.id)}
      />
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient colors={CommunityGradients.header} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={CommunityColors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient colors={CommunityGradients.header} style={StyleSheet.absoluteFill} />
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />

      {/* Image Preview Modal */}
      <ImagePreviewModal
        visible={!!previewImageUrl}
        imageUrl={previewImageUrl || ''}
        onClose={() => setPreviewImageUrl(null)}
      />

      {/* Header */}
      <BlurView intensity={95} style={[styles.header, { paddingTop: insets.top + 10 }]} tint="light">
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,250,250,0.98)']}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={CommunityColors.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
        >
          <View style={styles.avatarContainer}>
            <SafeAvatar avatar={user.avatar} size={44} fallbackEmoji="👤" fallbackColor="#667eea" />
            {!isBlocked && (
              <View style={[styles.userStatusDot, {
                backgroundColor: user.onlineStatus === 'online' ? CommunityColors.success :
                  user.onlineStatus === 'away' ? CommunityColors.accent :
                    CommunityColors.text.tertiary
              }]} />
            )}
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, isBlocked && styles.blockedText]}>
                {user.displayName}
              </Text>
              {user.isVerified && !isBlocked && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[styles.userStatus, isBlocked && styles.blockedStatus, getTypingStatus(userId) && styles.typingStatus]}>
              {getStatusText()}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowOptions(true)} style={styles.headerButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={CommunityColors.text.primary} />
        </TouchableOpacity>
      </BlurView>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={64} color={CommunityColors.text.tertiary} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Say hello to start the conversation!</Text>
          </View>
        }
      />

      {/* Typing Indicator */}
      {getTypingStatus(userId) && !isBlocked && (
        <Animated.View entering={FadeIn} style={styles.typingContainer}>
          <BlurView intensity={80} style={styles.typingBubble} tint="light">
            <Text style={styles.typingText}>{user.displayName} is typing</Text>
            <ActivityIndicator size="small" color={CommunityColors.primary} style={styles.typingDots} />
          </BlurView>
        </Animated.View>
      )}

      {/* Blocked Warning */}
      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Ionicons name="ban" size={20} color={CommunityColors.error} />
          <Text style={styles.blockedBannerText}>You have blocked this user</Text>
          <TouchableOpacity onPress={handleBlock}>
            <Text style={styles.unblockText}>Unblock</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reply Preview */}
      <ReplyPreviewBar replyTo={replyingTo} onCancel={() => setReplyingTo(null)} />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <BlurView intensity={100} style={styles.inputContainer} tint="light">
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(255,250,250,0.95)']}
            style={StyleSheet.absoluteFill}
          />

          <TouchableOpacity
            style={[styles.attachButton, isBlocked && styles.disabledButton]}
            onPress={showImageSourceAlert}
            disabled={isBlocked}
          >
            <View style={[styles.attachButtonBg, { backgroundColor: CommunityColors.primary + '15' }]}>
              <Ionicons name="image-outline" size={24} color={isBlocked ? CommunityColors.text.tertiary : CommunityColors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachButton, isBlocked && styles.disabledButton]}
            onPress={handleFilePick}
            disabled={isBlocked}
          >
            <View style={[styles.attachButtonBg, { backgroundColor: CommunityColors.primary + '15' }]}>
              <Ionicons name="document-attach-outline" size={24} color={isBlocked ? CommunityColors.text.tertiary : CommunityColors.primary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.inputWrapper, isBlocked && styles.disabledInput]}>
            <TextInput
              style={styles.input}
              placeholder={isBlocked ? "Unblock to send messages..." : editingMessage ? "Edit message..." : "Type a message..."}
              placeholderTextColor={CommunityColors.text.tertiary}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={500}
              editable={!isBlocked}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendButton, (inputText.length === 0 || isBlocked) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={inputText.length === 0 || isBlocked}
          >
            <LinearGradient
              colors={inputText.length > 0 && !isBlocked ? CommunityGradients.primary : ['transparent', 'transparent']}
              style={styles.sendButtonGradient}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.length > 0 && !isBlocked ? "#fff" : CommunityColors.text.tertiary}
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
          <View style={styles.optionsMenu}>
            <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
              <Ionicons
                name={isBlocked ? "checkmark-circle" : "ban"}
                size={24}
                color={isBlocked ? CommunityColors.success : CommunityColors.error}
              />
              <Text style={[styles.optionText, isBlocked && { color: CommunityColors.success }]}>
                {isBlocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={handleDeleteChat}>
              <Ionicons name="trash" size={24} color={CommunityColors.error} />
              <Text style={styles.optionText}>Delete Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemLast]}
              onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
            >
              <Ionicons name="person" size={24} color={CommunityColors.primary} />
              <Text style={styles.optionText}>View Profile</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  // SafeAvatar
  avatarWrapper: {
    position: 'relative',
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
  avatarEmoji: {},

  // File Bubble
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    minWidth: 200,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  fileNameMe: {
    color: '#fff',
  },
  fileSize: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  fileSizeMe: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Resend
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  resendText: {
    fontSize: 12,
    color: '#ff4757',
    fontWeight: '600',
  },

  // Image Preview Modal
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: width,
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewLoader: {
    position: 'absolute',
  },
  imagePreviewImage: {
    width: width - 40,
    height: height * 0.6,
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.divider,
    overflow: 'hidden',
  },
  headerButton: { padding: 8 },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  userStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 16, fontWeight: '800', color: CommunityColors.text.primary },
  blockedText: { color: CommunityColors.text.tertiary },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: CommunityColors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userStatus: { fontSize: 13, color: CommunityColors.text.secondary, marginTop: 2 },
  blockedStatus: { color: CommunityColors.error },
  typingStatus: { color: CommunityColors.secondary, fontStyle: 'italic', fontWeight: '600' },

  // Messages
  messagesList: {
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: 20,
    paddingBottom: 100,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessage: { justifyContent: 'flex-end' },
  theirMessage: { justifyContent: 'flex-start' },
  avatarSmall: {
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: width * 0.72,
    padding: 12,
    borderRadius: CommunityBorderRadius.lg,
    ...CommunityShadows.sm,
  },
  myBubble: {
    backgroundColor: CommunityColors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: CommunityColors.background.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  messageText: { fontSize: 15, lineHeight: 20 },
  myText: { color: 'white' },
  theirText: { color: CommunityColors.text.primary },

  // Image in message
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  messageImage: {
    width: width * 0.6,
    height: 200,
    borderRadius: 12,
  },

  // Reply Preview
  replyPreview: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
  },
  replyPreviewMe: { backgroundColor: 'rgba(255,255,255,0.2)' },
  replyPreviewThem: { backgroundColor: 'rgba(102,126,234,0.1)' },
  replyLine: { width: 2, borderRadius: 1, marginRight: 8 },
  replyContent: { flex: 1 },
  replyName: { fontSize: 12, fontWeight: '600', color: '#667eea', marginBottom: 2 },
  replyNameMe: { color: 'rgba(255,255,255,0.8)' },

  // Message Footer
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: { fontSize: 11 },
  myTime: { color: 'rgba(255,255,255,0.7)' },
  theirTime: { color: CommunityColors.text.tertiary },
  editedLabel: { fontSize: 10, color: CommunityColors.text.tertiary, fontStyle: 'italic' },
  editedLabelMe: { color: 'rgba(255,255,255,0.6)' },

  // Action Menu
  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenu: {
    width: width - 40,
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  emojiRow: {
    flexDirection: 'row',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emojiText: { fontSize: 28 },
  actionButtons: { marginTop: 12 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  actionText: { fontSize: 16, color: CommunityColors.text.primary, fontWeight: '500' },

  // Reply Bar
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: CommunityColors.divider,
  },
  replyBarContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBarLine: { width: 4, height: 36, backgroundColor: CommunityColors.primary, borderRadius: 2, marginRight: 12 },
  replyBarText: { flex: 1 },
  replyBarName: { fontSize: 13, fontWeight: '600', color: CommunityColors.primary, marginBottom: 2 },
  replyBarPreview: { fontSize: 13, color: CommunityColors.text.secondary },
  replyBarClose: { padding: 4 },

  // Empty State
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.2,
  },
  emptyText: {
    fontSize: 18,
    color: CommunityColors.text.secondary,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: CommunityColors.text.tertiary,
    marginTop: 8,
  },

  // Typing
  typingContainer: {
    paddingHorizontal: CommunitySpacing.md,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    overflow: 'hidden',
  },
  typingText: { fontSize: 13, color: CommunityColors.text.secondary },
  typingDots: { transform: [{ scale: 0.8 }] },

  // Blocked Banner
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CommunityColors.error + '15',
    paddingVertical: 12,
    gap: 8,
  },
  blockedBannerText: {
    color: CommunityColors.error,
    fontWeight: '600',
  },
  unblockText: {
    color: CommunityColors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: 12,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  attachButton: { padding: 4, marginRight: 4 },
  attachButtonBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: { opacity: 0.5 },
  inputWrapper: {
    flex: 1,
    backgroundColor: CommunityColors.background.elevated,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: CommunityColors.border,
  },
  disabledInput: { backgroundColor: CommunityColors.background.main },
  input: { fontSize: 16, color: CommunityColors.text.primary, maxHeight: 80 },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 8,
    overflow: 'hidden',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error/Go Back
  errorText: { fontSize: 18, color: CommunityColors.text.secondary, marginBottom: 16 },
  goBackButton: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingRight: 20,
  },
  optionsMenu: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginLeft: 'auto',
    width: 200,
    ...CommunityShadows.lg,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.divider,
  },
  optionItemLast: { borderBottomWidth: 0 },
  optionText: { fontSize: 16, color: CommunityColors.text.primary, fontWeight: '600' },
});