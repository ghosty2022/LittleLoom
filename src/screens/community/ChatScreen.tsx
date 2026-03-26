// src/screens/community/ChatScreen.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import { useCommunity, Message, CommunityUser } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showErrorModal } from '../../utils/modal';

type ChatScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Chat'>;

const { width } = Dimensions.get('window');

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
  } = useCommunity();
  const { profile } = useUser();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadChatData();
    markChatRead(userId);
    updateOnlineStatus('online');
    
    return () => {
      setTypingStatus(userId, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [userId]);

  const loadChatData = async () => {
    setIsLoading(true);
    const chatUser = getUserById(userId);
    const chatMessages = getChatMessages(userId);
    
    setUser(chatUser);
    setMessages(chatMessages);
    setIsLoading(false);
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    if (!currentUser) {
      showErrorModal({ message: 'Please sign in to send messages' });
      return;
    }
    
    const content = inputText.trim();
    setInputText('');
    setTypingStatus(userId, false);
    
    // Optimistically add message
    const tempMessage: Message = {
      id: `temp_${Date.now()}`,
      chatId: `chat_${[currentUser.id, userId].sort().join('_')}`,
      senderId: currentUser.id,
      receiverId: userId,
      content,
      timestamp: new Date().toISOString(),
      read: true,
      type: 'text',
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    await sendMessage(userId, content);
    const updatedMessages = getChatMessages(userId);
    setMessages(updatedMessages);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [inputText, userId, currentUser, sendMessage, setTypingStatus, getChatMessages]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.length > 0) {
      setTypingStatus(userId, true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(userId, false);
      }, 3000);
    } else {
      setTypingStatus(userId, false);
    }
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      await sendMessage(userId, '📷 Photo', 'image', result.assets[0].uri);
      const updatedMessages = getChatMessages(userId);
      setMessages(updatedMessages);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCall = () => {
    Alert.alert('Voice Call', 'Voice calling is coming soon!');
  };

  const handleVideoCall = () => {
    Alert.alert('Video Call', 'Video calling is coming soon!');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusText = () => {
    if (!user) return '';
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser?.id;
    
    return (
      <Animated.View 
        entering={FadeInUp}
        style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}
      >
        {!isMe && user && (
          <Text style={styles.messageAvatar}>{user.avatar}</Text>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {item.type === 'image' && item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
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
                color={item.read ? "#34b7f1" : "rgba(255,255,255,0.7)"} 
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
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTyping = getTypingStatus(userId);

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <BlurView intensity={90} style={[styles.header, { paddingTop: insets.top + 10 }]} tint="light">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.userAvatar}>{user.avatar}</Text>
            <View style={[styles.userStatusDot, { 
              backgroundColor: user.onlineStatus === 'online' ? '#11998e' : 
                            user.onlineStatus === 'away' ? '#fee140' : '#999' 
            }]} />
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user.displayName}</Text>
              {user.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color="#667eea" />
              )}
            </View>
            <Text style={[styles.userStatus, isTyping && styles.typingStatus]}>
              {getStatusText()}
            </Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleCall} style={styles.headerAction}>
            <Ionicons name="call-outline" size={22} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleVideoCall} style={styles.headerAction}>
            <Ionicons name="videocam-outline" size={22} color="#667eea" />
          </TouchableOpacity>
        </View>
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
      />

      {/* Typing Indicator */}
      {isTyping && (
        <View style={styles.typingContainer}>
          <BlurView intensity={80} style={styles.typingBubble} tint="light">
            <Text style={styles.typingText}>{user.displayName} is typing</Text>
            <ActivityIndicator size="small" color="#667eea" style={styles.typingDots} />
          </BlurView>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <BlurView intensity={100} style={styles.inputContainer} tint="light">
          <TouchableOpacity style={styles.attachButton} onPress={handleImagePick}>
            <Ionicons name="image-outline" size={24} color="#667eea" />
          </TouchableOpacity>
          
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={500}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.sendButton, inputText.length > 0 && styles.sendButtonActive]}
            onPress={handleSend}
            disabled={inputText.length === 0}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={inputText.length > 0 ? "white" : "#999"} 
            />
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  userStatus: { fontSize: 13, color: '#666', marginTop: 2 },
  typingStatus: { color: '#11998e', fontStyle: 'italic' },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerAction: { padding: 4 },
  messagesList: {
    paddingHorizontal: 16,
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
  messageBubble: {
    maxWidth: width * 0.7,
    padding: 12,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, lineHeight: 20 },
  myText: { color: 'white' },
  theirText: { color: '#1a1a1a' },
  messageImage: { width: width * 0.6, height: 200, borderRadius: 12 },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: { fontSize: 11 },
  myTime: { color: 'rgba(255,255,255,0.7)' },
  theirTime: { color: '#999' },
  typingContainer: { paddingHorizontal: 16, marginBottom: 8 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  typingText: { fontSize: 13, color: '#666' },
  typingDots: { transform: [{ scale: 0.8 }] },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 30,
  },
  attachButton: { padding: 8, marginRight: 8 },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: { fontSize: 16, color: '#333', maxHeight: 80 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(102,126,234,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonActive: { backgroundColor: '#667eea' },
  errorText: { fontSize: 18, color: '#666', marginBottom: 16 },
  goBackButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackText: { color: 'white', fontSize: 16, fontWeight: '600' },
});