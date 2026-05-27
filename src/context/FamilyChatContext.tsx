import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useFamily, FamilyMember } from './FamilyContext';
import { useAuth } from './AuthContext';
import { useBaby } from './BabyContext';
import * as Crypto from 'expo-crypto';

// ==================== TYPES ====================
export type MessageType = 'text' | 'image' | 'voice' | 'system' | 'file';

export interface FileMetadata {
  name: string;
  size: number;
  type: string; // mime type
  uri: string;
}

export interface FamilyMessage {
  id: string;
  syncId: string;          // UUID for deduplication across devices
  deviceId: string;        // Device that created the message
  version: number;         // For conflict resolution
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  receiverId?: string;
  content: string;
  type: MessageType;
  imageUrl?: string;
  fileUrl?: string;
  fileMetadata?: FileMetadata;
  timestamp: string;
  read: boolean;
  readBy: string[];
  familyCode: string;
  reactions?: { emoji: string; userId: string; userName: string }[];
  replyTo?: string; // ID of message being replied to
  replyToPreview?: string; // Snippet of replied message content
  isEdited?: boolean;
  editedAt?: string;
  deliveryStatus: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface FamilyChat {
  id: string;
  type: 'group' | 'direct';
  name: string;
  participants: string[];
  participantRoles?: Record<string, string>;
  participantNames?: Record<string, string>;
  participantAvatars?: Record<string, string>;
  lastMessage?: FamilyMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  isMuted: boolean;
  familyCode: string;
  isPinned?: boolean;
  backgroundImage?: string;
}

export interface TypingStatus {
  userId: string;
  userName: string;
  chatId: string;
  isTyping: boolean;
  timestamp: string;
}

interface FamilyChatState {
  chats: FamilyChat[];
  messages: Record<string, FamilyMessage[]>;
  typingUsers: Record<string, TypingStatus[]>;
  isLoading: boolean;
  currentChatId: string | null;
  familyCode: string | null;
  currentUserTyping: boolean;
  pendingSync: string[]; // syncIds waiting for backend sync
}

interface FamilyChatContextType extends FamilyChatState {
  // Chat Management
  createFamilyGroup: (name?: string, avatar?: string) => Promise<string>;
  getOrCreateDirectChat: (memberId: string, memberInfo?: Partial<FamilyMember>) => Promise<string>;
  getChatMessages: (chatId: string) => FamilyMessage[];
  sendMessage: (chatId: string, content: string, type?: MessageType, mediaData?: string, fileMeta?: FileMetadata, replyToId?: string) => Promise<void>;
  editMessage: (chatId: string, messageId: string, newContent: string) => Promise<void>;
  markChatRead: (chatId: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  clearChat: (chatId: string) => Promise<void>;
  resendMessage: (chatId: string, messageId: string) => Promise<void>;
  
  // Media
  pickAndSendImage: (chatId: string, fromCamera?: boolean) => Promise<void>;
  pickAndSendFile: (chatId: string) => Promise<void>;
  
  // Typing & Presence
  setTypingStatus: (chatId: string, isTyping: boolean) => void;
  isUserTyping: (chatId: string, userId: string) => boolean;
  getTypingUsers: (chatId: string) => TypingStatus[];
  
  // Reactions
  addReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  removeReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  
  // Chat Settings
  muteChat: (chatId: string, muted: boolean) => Promise<void>;
  pinChat: (chatId: string, pinned: boolean) => Promise<void>;
  leaveChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  setChatBackground: (chatId: string, imageUri: string | null) => Promise<void>;
  
  // Family Code
  generateFamilyCode: () => string;
  getFamilyCode: () => string | null;
  shareFamilyCode: () => Promise<void>;
  joinFamilyByCode: (code: string) => Promise<boolean>;
  
  // Utility
  getUnreadCount: (chatId?: string) => number;
  getChatById: (chatId: string) => FamilyChat | undefined;
  getMemberChatInfo: (memberId: string) => { name: string; avatar: string; role: string } | null;
  syncFamilyData: () => Promise<void>;
  searchMessages: (chatId: string, query: string) => FamilyMessage[];
  getMessageById: (chatId: string, messageId: string) => FamilyMessage | undefined;
}

// ==================== STORAGE KEYS ====================
const STORAGE_KEYS = {
  CHATS: (familyCode: string) => `@littleloom_family_chats_${familyCode}`,
  MESSAGES: (familyCode: string, chatId: string) => `@littleloom_family_msgs_${familyCode}_${chatId}`,
  FAMILY_CODE: '@littleloom_current_family_code',
  TYPING_STATUS: '@littleloom_typing_status',
  SYNC_TIMESTAMP: '@littleloom_family_sync',
  DEVICE_ID: '@littleloom_device_id',
};

// ==================== CONTEXT ====================
const FamilyChatContext = createContext<FamilyChatContextType | null>(null);

// ==================== HELPER FUNCTIONS ====================
const generateFamilyCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FAM-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const createSystemMessage = (
  chatId: string, 
  content: string, 
  familyCode: string,
  deviceId: string
): FamilyMessage => ({
  id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  syncId: `sys_${Crypto.randomUUID()}`,
  deviceId,
  version: 1,
  chatId,
  senderId: 'system',
  senderName: 'LittleLoom',
  senderRole: 'system',
  senderAvatar: '🤖',
  content,
  type: 'system',
  timestamp: new Date().toISOString(),
  read: true,
  readBy: [],
  familyCode,
  deliveryStatus: 'sent',
});

const getOrCreateDeviceId = async (): Promise<string> => {
  let id = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
};

// ==================== PROVIDER ====================
export const FamilyChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { members, parent1, parent2, guardians, currentBaby } = useFamily();
  const { userProfile } = useAuth();
  const { currentBaby: babyContext } = useBaby();
  
  const [state, setState] = useState<FamilyChatState>({
    chats: [],
    messages: {},
    typingUsers: {},
    isLoading: false,
    currentChatId: null,
    familyCode: null,
    currentUserTyping: false,
    pendingSync: [],
  });

  const deviceIdRef = useRef<string>('');
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    (async () => {
      deviceIdRef.current = await getOrCreateDeviceId();
      await loadFamilyCode();
    })();
  }, []);

  useEffect(() => {
    if (state.familyCode && members.length > 0) {
      initializeFamilyChat();
    }
  }, [state.familyCode, members.length]);

  const loadFamilyCode = async () => {
    try {
      const savedCode = await AsyncStorage.getItem(STORAGE_KEYS.FAMILY_CODE);
      if (savedCode) {
        setState(prev => ({ ...prev, familyCode: savedCode }));
      } else if (babyContext) {
        const newCode = `FAM-${babyContext.id.slice(0, 6).toUpperCase()}`;
        await AsyncStorage.setItem(STORAGE_KEYS.FAMILY_CODE, newCode);
        setState(prev => ({ ...prev, familyCode: newCode }));
      }
    } catch (error) {
      console.error('Error loading family code:', error);
    }
  };

  const initializeFamilyChat = async () => {
    if (!state.familyCode || !userProfile) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const chatsKey = STORAGE_KEYS.CHATS(state.familyCode);
      const savedChats = await AsyncStorage.getItem(chatsKey);
      let chats: FamilyChat[] = savedChats ? JSON.parse(savedChats) : [];
      
      // Ensure family group chat exists
      const familyGroupId = `family_group_${state.familyCode}`;
      const existingGroup = chats.find(c => c.id === familyGroupId);
      
      // Build participant info maps
      const participantRoles: Record<string, string> = {};
      const participantNames: Record<string, string> = {};
      const participantAvatars: Record<string, string> = {};
      
      members.forEach(m => {
        participantRoles[m.id] = m.role;
        participantNames[m.id] = m.fullName;
        participantAvatars[m.id] = m.avatar || '👤';
      });

      if (!existingGroup) {
        const familyGroup: FamilyChat = {
          id: familyGroupId,
          type: 'group',
          name: `${currentBaby?.name || 'Family'} Group`,
          participants: members.map(m => m.id),
          participantRoles,
          participantNames,
          participantAvatars,
          unreadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          avatar: '👨‍👩‍👧‍👦',
          isMuted: false,
          familyCode: state.familyCode,
          isPinned: true,
        };
        chats.unshift(familyGroup);
        await AsyncStorage.setItem(chatsKey, JSON.stringify(chats));
        
        const welcomeMsg = createSystemMessage(
          familyGroupId,
          `Welcome to ${currentBaby?.name || 'your baby'}'s family chat! 💕\n\nShare updates, photos, and stay connected with your family.`,
          state.familyCode,
          deviceIdRef.current
        );
        await saveMessages(familyGroupId, [welcomeMsg]);
      } else {
        // Update participant info
        existingGroup.participants = members.map(m => m.id);
        existingGroup.participantRoles = participantRoles;
        existingGroup.participantNames = participantNames;
        existingGroup.participantAvatars = participantAvatars;
        await AsyncStorage.setItem(chatsKey, JSON.stringify(chats));
      }
      
      // Load messages for all chats
      const messages: Record<string, FamilyMessage[]> = {};
      for (const chat of chats) {
        const msgs = await loadMessages(chat.id);
        messages[chat.id] = msgs;
      }
      
      setState(prev => ({
        ...prev,
        chats,
        messages,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error initializing family chat:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // ==================== STORAGE HELPERS ====================
  const saveMessages = async (chatId: string, newMessages: FamilyMessage[]) => {
    if (!state.familyCode) return;
    try {
      const key = STORAGE_KEYS.MESSAGES(state.familyCode, chatId);
      const existing = await AsyncStorage.getItem(key);
      const allMessages: FamilyMessage[] = existing ? JSON.parse(existing) : [];
      
      // Merge and deduplicate by syncId (for cross-device sync readiness)
      const mergedMap = new Map<string, FamilyMessage>();
      [...allMessages, ...newMessages].forEach(msg => {
        const existing = mergedMap.get(msg.syncId);
        if (!existing || msg.version > existing.version) {
          mergedMap.set(msg.syncId, msg);
        }
      });
      
      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      await AsyncStorage.setItem(key, JSON.stringify(merged));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  };

  const loadMessages = async (chatId: string): Promise<FamilyMessage[]> => {
    if (!state.familyCode) return [];
    try {
      const key = STORAGE_KEYS.MESSAGES(state.familyCode, chatId);
      const saved = await AsyncStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  };

  // ==================== CHAT ACTIONS ====================
  const createFamilyGroup = async (name?: string, avatar?: string): Promise<string> => {
    if (!state.familyCode || !userProfile) return '';
    
    const chatId = `family_group_${state.familyCode}_${Date.now()}`;
    
    const participantRoles: Record<string, string> = {};
    const participantNames: Record<string, string> = {};
    const participantAvatars: Record<string, string> = {};
    
    members.forEach(m => {
      participantRoles[m.id] = m.role;
      participantNames[m.id] = m.fullName;
      participantAvatars[m.id] = m.avatar || '👤';
    });
    
    const newChat: FamilyChat = {
      id: chatId,
      type: 'group',
      name: name || 'Family Group',
      participants: members.map(m => m.id),
      participantRoles,
      participantNames,
      participantAvatars,
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      avatar: avatar || '👨‍👩‍👧‍👦',
      isMuted: false,
      familyCode: state.familyCode,
    };
    
    const updatedChats = [newChat, ...state.chats];
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    setState(prev => ({ ...prev, chats: updatedChats }));
    
    const welcomeMsg = createSystemMessage(
      chatId,
      'Family group created! Start sharing updates with your family. 🎉',
      state.familyCode,
      deviceIdRef.current
    );
    await saveMessages(chatId, [welcomeMsg]);
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return chatId;
  };

  const getOrCreateDirectChat = async (memberId: string, memberInfo?: Partial<FamilyMember>): Promise<string> => {
    if (!state.familyCode || !userProfile) return '';
    
    const existingChat = state.chats.find(
      c => c.type === 'direct' && 
           c.participants.includes(userProfile.id) && 
           c.participants.includes(memberId)
    );
    
    if (existingChat) return existingChat.id;
    
    const member = members.find(m => m.id === memberId) || memberInfo;
    if (!member) return '';
    
    const chatId = `direct_${[userProfile.id, memberId].sort().join('_')}`;
    
    const participantRoles: Record<string, string> = {
      [userProfile.id]: userProfile.role || 'parent1',
      [memberId]: member.role || 'guardian',
    };
    const participantNames: Record<string, string> = {
      [userProfile.id]: userProfile.fullName,
      [memberId]: member.fullName || 'Unknown',
    };
    const participantAvatars: Record<string, string> = {
      [userProfile.id]: userProfile.avatar || '👤',
      [memberId]: member.avatar || '👤',
    };
    
    const newChat: FamilyChat = {
      id: chatId,
      type: 'direct',
      name: member.fullName || 'Unknown',
      participants: [userProfile.id, memberId],
      participantRoles,
      participantNames,
      participantAvatars,
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      avatar: member.avatar || '👤',
      isMuted: false,
      familyCode: state.familyCode,
    };
    
    const updatedChats = [...state.chats, newChat];
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    setState(prev => ({ ...prev, chats: updatedChats }));
    
    return chatId;
  };

  const getChatMessages = useCallback((chatId: string): FamilyMessage[] => {
    return state.messages[chatId] || [];
  }, [state.messages]);

  const getMessageById = useCallback((chatId: string, messageId: string): FamilyMessage | undefined => {
    return state.messages[chatId]?.find(m => m.id === messageId);
  }, [state.messages]);

  const sendMessage = async (
    chatId: string, 
    content: string, 
    type: MessageType = 'text',
    mediaData?: string,
    fileMeta?: FileMetadata,
    replyToId?: string
  ): Promise<void> => {
    if (!state.familyCode || !userProfile) {
      Alert.alert('Error', 'You must be logged in to send messages');
      return;
    }
    
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;
    
    const syncId = Crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Find reply preview if applicable
    let replyToPreview: string | undefined;
    if (replyToId) {
      const repliedMsg = state.messages[chatId]?.find(m => m.id === replyToId);
      replyToPreview = repliedMsg ? (repliedMsg.content.slice(0, 60) || 'Media') : undefined;
    }
    
    const newMessage: FamilyMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      syncId,
      deviceId: deviceIdRef.current,
      version: 1,
      chatId,
      senderId: userProfile.id,
      senderName: userProfile.fullName,
      senderRole: userProfile.role || 'parent1',
      senderAvatar: userProfile.avatar,
      content,
      type,
      imageUrl: type === 'image' ? mediaData : undefined,
      fileUrl: type === 'file' ? mediaData : undefined,
      fileMetadata: type === 'file' ? fileMeta : undefined,
      timestamp: now,
      read: false,
      readBy: [userProfile.id],
      familyCode: state.familyCode,
      reactions: [],
      replyTo: replyToId,
      replyToPreview,
      deliveryStatus: 'sending',
    };
    
    // Optimistic update
    setState(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [chatId]: [...(prev.messages[chatId] || []), newMessage],
      },
      pendingSync: [...prev.pendingSync, syncId],
    }));
    
    try {
      // Simulate network then persist
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Save to storage (in real app, send to backend here)
      await saveMessages(chatId, [{ ...newMessage, deliveryStatus: 'sent' }]);
      
      // Update chat last message
      const updatedChats = state.chats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            lastMessage: { ...newMessage, deliveryStatus: 'sent' },
            updatedAt: now,
            unreadCount: c.participants.filter(p => p !== userProfile.id).length,
          };
        }
        return c;
      });
      
      await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
      
      setState(prev => ({
        ...prev,
        chats: updatedChats,
        messages: {
          ...prev.messages,
          [chatId]: prev.messages[chatId]?.map(m => 
            m.syncId === syncId ? { ...m, deliveryStatus: 'sent' } : m
          ) || [],
        },
        pendingSync: prev.pendingSync.filter(id => id !== syncId),
      }));
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: prev.messages[chatId]?.map(m => 
            m.syncId === syncId ? { ...m, deliveryStatus: 'failed' } : m
          ) || [],
        },
        pendingSync: prev.pendingSync.filter(id => id !== syncId),
      }));
      throw error;
    }
  };

  const resendMessage = async (chatId: string, messageId: string): Promise<void> => {
    const message = state.messages[chatId]?.find(m => m.id === messageId);
    if (!message || message.deliveryStatus !== 'failed') return;
    
    setState(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [chatId]: prev.messages[chatId]?.map(m => 
          m.id === messageId ? { ...m, deliveryStatus: 'sending' } : m
        ) || [],
      },
    }));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await saveMessages(chatId, [{ ...message, deliveryStatus: 'sent' }]);
      
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: prev.messages[chatId]?.map(m => 
            m.id === messageId ? { ...m, deliveryStatus: 'sent' } : m
          ) || [],
        },
      }));
    } catch {
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: prev.messages[chatId]?.map(m => 
            m.id === messageId ? { ...m, deliveryStatus: 'failed' } : m
          ) || [],
        },
      }));
    }
  };

  const editMessage = async (chatId: string, messageId: string, newContent: string): Promise<void> => {
    if (!state.familyCode || !userProfile) return;
    
    const messages = state.messages[chatId] || [];
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId && msg.senderId === userProfile.id) {
        return {
          ...msg,
          content: newContent,
          isEdited: true,
          editedAt: new Date().toISOString(),
          version: msg.version + 1,
        };
      }
      return msg;
    });
    
    await saveMessages(chatId, updatedMessages);
    
    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));
  };

  const pickAndSendImage = async (chatId: string, fromCamera: boolean = false): Promise<void> => {
    try {
      let result;
      
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow camera access');
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
          Alert.alert('Permission Required', 'Please allow access to photos');
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
        // Copy to permanent storage
        const fileName = `chat_img_${Date.now()}.jpg`;
        const permanentUri = FileSystem.documentDirectory + 'chat_media/' + fileName;
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'chat_media/', { intermediates: true });
        await FileSystem.copyAsync({ from: uri, to: permanentUri });
        
        await sendMessage(chatId, '📷 Photo', 'image', permanentUri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send image');
    }
  };

  const pickAndSendFile = async (chatId: string): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) return;
      
      const asset = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      
      // Copy to app storage
      const fileName = `chat_file_${Date.now()}_${asset.name}`;
      const permanentUri = FileSystem.documentDirectory + 'chat_files/' + fileName;
      await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'chat_files/', { intermediates: true });
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });
      
      const fileMeta: FileMetadata = {
        name: asset.name || 'Unknown file',
        size,
        type: asset.mimeType || 'application/octet-stream',
        uri: permanentUri,
      };
      
      await sendMessage(chatId, `📎 ${asset.name}`, 'file', permanentUri, fileMeta);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('File pick error:', error);
      Alert.alert('Error', 'Failed to send file');
    }
  };

  const markChatRead = async (chatId: string): Promise<void> => {
    if (!userProfile) return;
    
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;
    
    const messages = state.messages[chatId] || [];
    const updatedMessages = messages.map(msg => {
      if (!msg.readBy.includes(userProfile.id)) {
        return { ...msg, readBy: [...msg.readBy, userProfile.id], read: true, deliveryStatus: 'read' as const };
      }
      return msg;
    });
    
    await saveMessages(chatId, updatedMessages);
    
    const updatedChats = state.chats.map(c => {
      if (c.id === chatId) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    });
    
    if (state.familyCode) {
      await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    }
    
    setState(prev => ({
      ...prev,
      chats: updatedChats,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));
  };

  const deleteMessage = async (chatId: string, messageId: string): Promise<void> => {
    if (!state.familyCode) return;
    
    const messages = state.messages[chatId] || [];
    const updatedMessages = messages.filter(m => m.id !== messageId);
    
    await saveMessages(chatId, updatedMessages);
    
    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const clearChat = async (chatId: string): Promise<void> => {
    if (!state.familyCode) return;
    
    await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES(state.familyCode, chatId), JSON.stringify([]));
    
    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: [] },
    }));
  };

  // ==================== TYPING STATUS ====================
  const setTypingStatus = useCallback((chatId: string, isTyping: boolean) => {
    if (!userProfile) return;
    
    const key = `${chatId}_${userProfile.id}`;
    
    if (typingTimeoutRef.current[key]) {
      clearTimeout(typingTimeoutRef.current[key]);
    }
    
    setState(prev => {
      const currentTypers = prev.typingUsers[chatId] || [];
      const existingIndex = currentTypers.findIndex(t => t.userId === userProfile.id);
      
      let updatedTypers;
      if (isTyping) {
        const newStatus: TypingStatus = {
          userId: userProfile.id,
          userName: userProfile.fullName,
          chatId,
          isTyping: true,
          timestamp: new Date().toISOString(),
        };
        
        if (existingIndex >= 0) {
          updatedTypers = [...currentTypers];
          updatedTypers[existingIndex] = newStatus;
        } else {
          updatedTypers = [...currentTypers, newStatus];
        }
      } else {
        updatedTypers = currentTypers.filter(t => t.userId !== userProfile.id);
      }
      
      return {
        ...prev,
        typingUsers: { ...prev.typingUsers, [chatId]: updatedTypers },
        currentUserTyping: isTyping,
      };
    });
    
    if (isTyping) {
      typingTimeoutRef.current[key] = setTimeout(() => {
        setTypingStatus(chatId, false);
      }, 3000);
    }
  }, [userProfile]);

  const isUserTyping = useCallback((chatId: string, userId: string): boolean => {
    return (state.typingUsers[chatId] || []).some(t => t.userId === userId && t.isTyping);
  }, [state.typingUsers]);

  const getTypingUsers = useCallback((chatId: string): TypingStatus[] => {
    return state.typingUsers[chatId] || [];
  }, [state.typingUsers]);

  // ==================== REACTIONS ====================
  const addReaction = async (chatId: string, messageId: string, emoji: string): Promise<void> => {
    if (!userProfile) return;
    
    const messages = state.messages[chatId] || [];
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        const existingIndex = reactions.findIndex(r => r.userId === userProfile.id && r.emoji === emoji);
        
        if (existingIndex >= 0) {
          return {
            ...msg,
            reactions: reactions.filter((_, i) => i !== existingIndex),
          };
        }
        
        return {
          ...msg,
          reactions: [...reactions, { emoji, userId: userProfile.id, userName: userProfile.fullName }],
        };
      }
      return msg;
    });
    
    await saveMessages(chatId, updatedMessages);
    
    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeReaction = async (chatId: string, messageId: string, emoji: string): Promise<void> => {
    if (!userProfile) return;
    
    const messages = state.messages[chatId] || [];
    const updatedMessages = messages.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          reactions: (msg.reactions || []).filter(
            r => !(r.userId === userProfile.id && r.emoji === emoji)
          ),
        };
      }
      return msg;
    });
    
    await saveMessages(chatId, updatedMessages);
    
    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));
  };

  // ==================== CHAT SETTINGS ====================
  const muteChat = async (chatId: string, muted: boolean): Promise<void> => {
    if (!state.familyCode) return;
    
    const updatedChats = state.chats.map(c => 
      c.id === chatId ? { ...c, isMuted: muted } : c
    );
    
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    setState(prev => ({ ...prev, chats: updatedChats }));
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pinChat = async (chatId: string, pinned: boolean): Promise<void> => {
    if (!state.familyCode) return;
    
    const updatedChats = state.chats.map(c => 
      c.id === chatId ? { ...c, isPinned: pinned } : c
    );
    
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    setState(prev => ({ ...prev, chats: updatedChats }));
  };

  const leaveChat = async (chatId: string): Promise<void> => {
    if (!state.familyCode || !userProfile) return;
    
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat || chat.type === 'group') {
      Alert.alert('Cannot Leave', 'You cannot leave the family group chat');
      return;
    }
    
    const updatedChats = state.chats.filter(c => c.id !== chatId);
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    setState(prev => ({ ...prev, chats: updatedChats }));
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteChat = async (chatId: string): Promise<void> => {
    if (!state.familyCode) return;
    
    const updatedChats = state.chats.filter(c => c.id !== chatId);
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    await AsyncStorage.removeItem(STORAGE_KEYS.MESSAGES(state.familyCode, chatId));
    
    setState(prev => ({
      ...prev,
      chats: updatedChats,
      messages: { ...prev.messages, [chatId]: undefined },
    }));
  };

  const setChatBackground = async (chatId: string, imageUri: string | null): Promise<void> => {
    if (!state.familyCode) return;
    
    const updatedChats = state.chats.map(c => 
      c.id === chatId ? { ...c, backgroundImage: imageUri || undefined } : c
    );
    
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    setState(prev => ({ ...prev, chats: updatedChats }));
  };

  // ==================== FAMILY CODE ====================
  const shareFamilyCode = async (): Promise<void> => {
    const code = state.familyCode || generateFamilyCode();
    try {
      await Share.share({
        message: `Join my family on LittleLoom! Use code: ${code}\n\nTrack baby's moments together and chat with the family. Download the app and enter this code during setup.`,
        title: 'Join My Family on LittleLoom',
      });
    } catch (error) {
      console.error('Error sharing family code:', error);
    }
  };

  const joinFamilyByCode = async (code: string): Promise<boolean> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.FAMILY_CODE, code);
      setState(prev => ({ ...prev, familyCode: code }));
      
      const chatsKey = STORAGE_KEYS.CHATS(code);
      const savedChats = await AsyncStorage.getItem(chatsKey);
      
      if (savedChats) {
        const chats: FamilyChat[] = JSON.parse(savedChats);
        
        const familyGroup = chats.find(c => c.type === 'group');
        if (familyGroup && userProfile && !familyGroup.participants.includes(userProfile.id)) {
          familyGroup.participants.push(userProfile.id);
          familyGroup.participantRoles![userProfile.id] = userProfile.role || 'guardian';
          familyGroup.participantNames![userProfile.id] = userProfile.fullName;
          familyGroup.participantAvatars![userProfile.id] = userProfile.avatar || '👤';
          
          await AsyncStorage.setItem(chatsKey, JSON.stringify(chats));
          
          const joinMsg = createSystemMessage(
            familyGroup.id,
            `👋 ${userProfile.fullName} joined the family`,
            code,
            deviceIdRef.current
          );
          await saveMessages(familyGroup.id, [joinMsg]);
        }
        
        setState(prev => ({ ...prev, chats }));
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to join family');
      return false;
    }
  };

  const getFamilyCode = (): string | null => state.familyCode;

  // ==================== UTILITY ====================
  const getUnreadCount = (chatId?: string): number => {
    if (chatId) {
      const chat = state.chats.find(c => c.id === chatId);
      return chat?.isMuted ? 0 : (chat?.unreadCount || 0);
    }
    return state.chats.reduce((total, chat) => total + (chat.isMuted ? 0 : chat.unreadCount), 0);
  };

  const getChatById = (chatId: string): FamilyChat | undefined => {
    return state.chats.find(c => c.id === chatId);
  };

  const getMemberChatInfo = (memberId: string): { name: string; avatar: string; role: string } | null => {
    const member = members.find(m => m.id === memberId);
    if (!member) return null;
    
    return {
      name: member.fullName,
      avatar: member.avatar || '👤',
      role: member.role,
    };
  };

  const searchMessages = (chatId: string, query: string): FamilyMessage[] => {
    const messages = state.messages[chatId] || [];
    const lowerQuery = query.toLowerCase();
    return messages.filter(msg => 
      msg.content.toLowerCase().includes(lowerQuery) ||
      msg.senderName.toLowerCase().includes(lowerQuery)
    );
  };

  const syncFamilyData = async (): Promise<void> => {
    await initializeFamilyChat();
  };

  // ==================== CONTEXT VALUE ====================
  const value: FamilyChatContextType = {
    ...state,
    createFamilyGroup,
    getOrCreateDirectChat,
    getChatMessages,
    sendMessage,
    editMessage,
    markChatRead,
    deleteMessage,
    clearChat,
    resendMessage,
    pickAndSendImage,
    pickAndSendFile,
    setTypingStatus,
    isUserTyping,
    getTypingUsers,
    addReaction,
    removeReaction,
    muteChat,
    pinChat,
    leaveChat,
    deleteChat,
    setChatBackground,
    generateFamilyCode,
    getFamilyCode,
    shareFamilyCode,
    joinFamilyByCode,
    getUnreadCount,
    getChatById,
    getMemberChatInfo,
    syncFamilyData,
    searchMessages,
    getMessageById,
  };

  return (
    <FamilyChatContext.Provider value={value}>
      {children}
    </FamilyChatContext.Provider>
  );
};

export const useFamilyChat = () => {
  const context = useContext(FamilyChatContext);
  if (!context) throw new Error('useFamilyChat must be used within FamilyChatProvider');
  return context;
};

export default FamilyChatProvider;