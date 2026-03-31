// src/screens/community/ChatScreen.tsx
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Message } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showErrorModal, showConfirmModal } from '../../utils/modal';
import { 
  CommunityColors, 
  CommunityGradients, 
  CommunitySpacing, 
  CommunityBorderRadius,
  CommunityShadows 
} from '../../theme/CommunityTheme';

type ChatScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Chat'>;

const { width, height } = Dimensions.get('window');

// Message encryption/decryption helpers
const simpleEncrypt = (text: string): string => {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return text;
  }
};

const simpleDecrypt = (text: string): string => {
  try {
    return decodeURIComponent(escape(atob(text)));
  } catch {
    return text;
  }
};

export default function ChatScreen({ navigation, route }: ChatScreenProps) {
  const { userId } = route.params;
  const { 
    getUserById, 
    getChatMessages, 
    sendMessage, 
    markChatRead,
    getOrCreateChat,
    setTypingStatus,
    getTypingStatus,
    currentUser,
    updateOnlineStatus,
    deleteChat,
    blockUser,
    isUserBlocked,
  } = useCommunity();
  const { profile } = useUser();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeChat();
    const interval = setInterval(() => {
      refreshMessages();
    }, 2000); // Poll for new messages every 2 seconds
    
    return () => {
      clearInterval(interval);
      setTypingStatus(userId, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [userId]);

  const initializeChat = async () => {
    setIsLoading(true);
    const chatUser = getUserById(userId);
    const chatMessages = getChatMessages(userId).map(msg => ({
      ...msg,
      content: msg.type === 'text' ? simpleDecrypt(msg.content) : msg.content
    }));
    
    setUser(chatUser);
    setMessages(chatMessages);
    setIsBlocked(isUserBlocked(userId));
    setIsLoading(false);
    markChatRead(userId);
    updateOnlineStatus('online');
  };

  const refreshMessages = () => {
    const fresh = getChatMessages(userId).map(msg => ({
      ...msg,
      content: msg.type === 'text' ? simpleDecrypt(msg.content) : msg.content
    }));
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
    setTypingStatus(userId, false);
    
    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      chatId: `chat_${[currentUser.id, userId].sort().join('_')}`,
      senderId: currentUser.id,
      receiverId: userId,
      content: content,
      timestamp: new Date().toISOString(),
      read: true,
      type: 'text',
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    try {
      await sendMessage(userId, simpleEncrypt(content));
      refreshMessages();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      showErrorModal({ message: 'Failed to send message' });
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }, [inputText, userId, currentUser, isBlocked, sendMessage, setTypingStatus]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(userId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(userId, false);
      }, 3000);
    } else {
      setTypingStatus(userId, false);
    }
  };

  const handleImagePick = async () => {
    if (isBlocked) {
      showErrorModal({ message: 'Unblock user to send images' });
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled) {
      await sendMessage(userId, '📷 Photo', 'image', result.assets[0].uri);
      refreshMessages();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
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
      <Animated.View 
        entering={FadeInUp.delay(50)}
        layout={Layout.springify()}
        style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}
      >
        {!isMe && showAvatar && user ? (
          <Text style={styles.messageAvatar}>{user.avatar}</Text>
        ) : !isMe && <View style={styles.avatarPlaceholder} />}
        
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {item.type === 'image' && item.imageUrl ? (
            <TouchableOpacity activeOpacity={0.9}>
              <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe ? styles.myTime : styles.theirTime]}>
              {formatTime(item.timestamp)}
            </Text>
            {isMe && (
              <Ionicons 
                name={item.read ? "checkmark-done" : "checkmark"} 
                size={14} 
                color={item.read ? CommunityColors.secondary : "rgba(255,255,255,0.6)"} 
              />
            )}
          </View>
        </View>
      </Animated.View>
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
            <Text style={styles.userAvatar}>{user.avatar}</Text>
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
            onPress={handleImagePick}
            disabled={isBlocked}
          >
            <View style={[styles.attachButtonBg, { backgroundColor: CommunityColors.primary + '15' }]}>
              <Ionicons name="image-outline" size={24} color={isBlocked ? CommunityColors.text.tertiary : CommunityColors.primary} />
            </View>
          </TouchableOpacity>
          
          <View style={[styles.inputWrapper, isBlocked && styles.disabledInput]}>
            <TextInput
              style={styles.input}
              placeholder={isBlocked ? "Unblock to send messages..." : "Type a message..."}
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
  userAvatar: { fontSize: 40 },
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
  messageAvatar: { fontSize: 28, marginRight: 8 },
  avatarPlaceholder: { width: 36 },
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
  messageImage: { 
    width: width * 0.6, 
    height: 200, 
    borderRadius: 12,
    backgroundColor: CommunityColors.background.elevated,
  },
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CommunitySpacing.md,
    paddingVertical: 12,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  attachButton: { padding: 4, marginRight: 8 },
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
  errorText: { fontSize: 18, color: CommunityColors.text.secondary, marginBottom: 16 },
  goBackButton: {
    backgroundColor: CommunityColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '700' },
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