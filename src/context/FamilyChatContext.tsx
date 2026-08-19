import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';

import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

import { useAuth } from './AuthContext';
import { useBaby } from './BabyContext';
import { useFamily } from './FamilyContext';
import type { FamilyMember } from './FamilyContext';
import { useSweetAlert } from '../components/SweetAlert';

// Import Supabase sync service
import { FamilyChatSyncService } from '../services/FamilyChatSyncService';

export type MessageType = 'text' | 'image' | 'voice' | 'system' | 'file';

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  uri: string;
}

export interface FamilyMessage {
  id: string;
  syncId: string;
  deviceId: string;
  version: number;
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
  voiceUrl?: string;
  fileMetadata?: FileMetadata;
  timestamp: string;
  read: boolean;
  readBy: string[];
  familyCode: string;
  reactions?: { emoji: string; userId: string; userName: string }[];
  replyTo?: string;
  replyToPreview?: string;
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
  pendingSync: string[];
  blockedUsers: string[];
  isSynced: boolean;
}

interface FamilyChatContextType extends FamilyChatState {
  createFamilyGroup: (name?: string, avatar?: string) => Promise<string>;
  getOrCreateDirectChat: (memberId: string, memberInfo?: Partial<FamilyMember>) => Promise<string>;
  getChatMessages: (chatId: string) => FamilyMessage[];
  sendMessage: (chatId: string, content: string, type?: MessageType, mediaData?: string, fileMeta?: FileMetadata, replyToId?: string) => Promise<void>;
  editMessage: (chatId: string, messageId: string, newContent: string) => Promise<void>;
  markChatRead: (chatId: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  clearChat: (chatId: string) => Promise<void>;
  resendMessage: (chatId: string, messageId: string) => Promise<void>;
  
  pickAndSendImage: (chatId: string, fromCamera?: boolean) => Promise<void>;
  pickAndSendFile: (chatId: string) => Promise<void>;
  
  setTypingStatus: (chatId: string, isTyping: boolean) => void;
  isUserTyping: (chatId: string, userId: string) => boolean;
  getTypingUsers: (chatId: string) => TypingStatus[];
  
  addReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  removeReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  
  muteChat: (chatId: string, muted: boolean) => Promise<void>;
  pinChat: (chatId: string, pinned: boolean) => Promise<void>;
  leaveChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  setChatBackground: (chatId: string, imageUri: string | null) => Promise<void>;
  
  generateFamilyCode: () => string;
  getFamilyCode: () => string | null;
  shareFamilyCode: () => Promise<void>;
  joinFamilyByCode: (code: string) => Promise<boolean>;
  
  getUnreadCount: (chatId?: string) => number;
  getChatById: (chatId: string) => FamilyChat | undefined;
  getMemberChatInfo: (memberId: string) => { name: string; avatar: string; role: string } | null;
  syncFamilyData: () => Promise<void>;
  searchMessages: (chatId: string, query: string) => FamilyMessage[];
  getMessageById: (chatId: string, messageId: string) => FamilyMessage | undefined;
  blockUser: (userId: string) => Promise<void>;
  isUserBlocked: (userId: string) => boolean;
  forceSync: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════
// ENCRYPTION HELPERS (XOR + SHA256 key derivation)
// ═══════════════════════════════════════════════════════════
const ENCRYPTION_SALT = 'littleloom_chat_v1';

const deriveKey = async (seed: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    seed + ENCRYPTION_SALT
  );
};

const xorEncrypt = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
};

const toHex = (str: string): string => {
  return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
};

const fromHex = (hex: string): string => {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
};

const encryptData = async (data: string, familyCode: string): Promise<string> => {
  if (!familyCode) return data;
  const key = await deriveKey(familyCode);
  return toHex(xorEncrypt(data, key));
};

const decryptData = async (encrypted: string, familyCode: string): Promise<string> => {
  if (!familyCode) return encrypted;
  const key = await deriveKey(familyCode);
  return xorEncrypt(fromHex(encrypted), key);
};

const STORAGE_KEYS = {
  CHATS: (familyCode: string) => `@littleloom_family_chats_${familyCode}`,
  MESSAGES: (familyCode: string, chatId: string) => `@littleloom_family_msgs_${familyCode}_${chatId}`,
  FAMILY_CODE: '@littleloom_current_family_code',
  TYPING_STATUS: '@littleloom_typing_status',
  SYNC_TIMESTAMP: '@littleloom_family_sync',
  DEVICE_ID: '@littleloom_device_id',
};

const FamilyChatContext = createContext<FamilyChatContextType | null>(null);

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

export const FamilyChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { members, parent1, parent2, guardians, currentBaby } = useFamily();
  const { userProfile } = useAuth();
  const { currentBaby: babyContext } = useBaby();
  const sweetAlert = useSweetAlert();
  
  const [state, setState] = useState<FamilyChatState>({
    chats: [],
    messages: {},
    typingUsers: {},
    isLoading: false,
    currentChatId: null,
    familyCode: null,
    currentUserTyping: false,
    pendingSync: [],
    blockedUsers: [],
    isSynced: false,
  });

  const deviceIdRef = useRef<string>('');
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const syncServiceRef = useRef<FamilyChatSyncService | null>(null);
  const isInitializedRef = useRef(false);
  const isSubscribedRef = useRef(false);

  // ─── Initialize Device ID ────────────────────────────────────
  useEffect(() => {
    (async () => {
      deviceIdRef.current = await getOrCreateDeviceId();
      await loadFamilyCode();
    })();
  }, []);

  // ─── Setup Realtime Listeners ────────────────────────────────
  const setupRealtimeListeners = useCallback(() => {
    if (!syncServiceRef.current) return;

    const service = syncServiceRef.current;
    service.setFamilyCode(state.familyCode || '');

    // Listen for incoming messages
    service.onMessages((remoteMessages) => {
      if (remoteMessages.length === 0) return;
      
      setState(prev => {
        const updatedMessages = { ...prev.messages };
        let hasNewMessages = false;
        
        remoteMessages.forEach(msg => {
          const chatMessages = updatedMessages[msg.chatId] || [];
          const exists = chatMessages.some(m => m.syncId === msg.syncId);
          if (!exists) {
            updatedMessages[msg.chatId] = [...chatMessages, msg];
            hasNewMessages = true;
          }
        });
        
        if (hasNewMessages) {
          const updatedChats = prev.chats.map(chat => {
            const msgs = updatedMessages[chat.id] || [];
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              return { ...chat, lastMessage: last, updatedAt: last.timestamp };
            }
            return chat;
          });
          return { ...prev, messages: updatedMessages, chats: updatedChats };
        }
        return prev;
      });
    });

    // Listen for typing status
    service.onTyping((data) => {
      if (!data) return;
      const { user_id, chat_id, is_typing, timestamp } = data;
      
      if (user_id === deviceIdRef.current) return;
      
      setState(prev => {
        const currentTypers = prev.typingUsers[chat_id] || [];
        const existingIndex = currentTypers.findIndex(t => t.userId === user_id);
        
        let updatedTypers;
        if (is_typing) {
          const newStatus: TypingStatus = {
            userId: user_id,
            userName: 'Family Member',
            chatId: chat_id,
            isTyping: true,
            timestamp: timestamp || new Date().toISOString(),
          };
          if (existingIndex >= 0) {
            updatedTypers = [...currentTypers];
            updatedTypers[existingIndex] = newStatus;
          } else {
            updatedTypers = [...currentTypers, newStatus];
          }
        } else {
          updatedTypers = currentTypers.filter(t => t.userId !== user_id);
        }
        
        return {
          ...prev,
          typingUsers: { ...prev.typingUsers, [chat_id]: updatedTypers },
        };
      });
    });

    // Subscribe to realtime - ONLY IF NOT ALREADY SUBSCRIBED
    if (!isSubscribedRef.current && state.familyCode) {
      isSubscribedRef.current = true;
      service.subscribeToMessages();
    }
  }, [state.familyCode]);

  // ─── Perform Initial Sync ────────────────────────────────────
  const performInitialSync = useCallback(async () => {
    if (!syncServiceRef.current || !state.familyCode) return;
    
    isInitializedRef.current = true;
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const service = syncServiceRef.current;
      
      // Pull remote messages
      const remoteMessages = await service.pullRemoteMessages();
      
      // Pull remote chats
      const remoteChats = await service.pullChats();
      
      // Merge with local
      if (remoteMessages.length > 0 || remoteChats.length > 0) {
        setState(prev => {
          const updatedMessages = { ...prev.messages };
          
          // Merge messages
          remoteMessages.forEach(msg => {
            const chatMessages = updatedMessages[msg.chatId] || [];
            const exists = chatMessages.some(m => m.syncId === msg.syncId);
            if (!exists) {
              updatedMessages[msg.chatId] = [...chatMessages, msg];
            }
          });
          
          // Merge chats
          let updatedChats = [...prev.chats];
          remoteChats.forEach(remoteChat => {
            const existingIndex = updatedChats.findIndex(c => c.id === remoteChat.id);
            if (existingIndex >= 0) {
              updatedChats[existingIndex] = { ...updatedChats[existingIndex], ...remoteChat };
            } else {
              updatedChats.push(remoteChat);
            }
          });
          
          // Sort chats by updatedAt
          updatedChats.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          
          return {
            ...prev,
            chats: updatedChats,
            messages: updatedMessages,
            isSynced: true,
          };
        });
      } else {
        setState(prev => ({ ...prev, isSynced: true }));
      }
      
      await service.updateLastSyncTime();
    } catch (error) {
      console.error('Initial sync error:', error);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.familyCode]);

  // ─── Initialize Sync Service ────────────────────────────────
  useEffect(() => {
    if (deviceIdRef.current && state.familyCode) {
      // Only create service if it doesn't exist or was cleaned up
      if (!syncServiceRef.current) {
        syncServiceRef.current = new FamilyChatSyncService(deviceIdRef.current);
        syncServiceRef.current.setFamilyCode(state.familyCode);
        isSubscribedRef.current = false;
      }
      
      // Setup realtime listeners
      setupRealtimeListeners();
      
      // Initial sync
      if (!isInitializedRef.current) {
        performInitialSync();
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (syncServiceRef.current) {
        syncServiceRef.current.unsubscribe();
        syncServiceRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [deviceIdRef.current, state.familyCode, setupRealtimeListeners, performInitialSync]);

  const loadFamilyCode = async () => {
    try {
      const savedCode = await AsyncStorage.getItem(STORAGE_KEYS.FAMILY_CODE);
      if (savedCode) {
        const blockedKey = `@littleloom_blocked_${savedCode}`;
        const savedBlocked = await AsyncStorage.getItem(blockedKey);
        const blockedUsers = savedBlocked ? JSON.parse(savedBlocked) : [];
        setState(prev => ({ ...prev, familyCode: savedCode, blockedUsers }));
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
      
      const familyGroupId = `family_group_${state.familyCode}`;
      const existingGroup = chats.find(c => c.id === familyGroupId);
      
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
        existingGroup.participants = members.map(m => m.id);
        existingGroup.participantRoles = participantRoles;
        existingGroup.participantNames = participantNames;
        existingGroup.participantAvatars = participantAvatars;
        await AsyncStorage.setItem(chatsKey, JSON.stringify(chats));
      }
      
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

  const saveMessages = async (chatId: string, newMessages: FamilyMessage[]) => {
    if (!state.familyCode) return;
    try {
      const key = STORAGE_KEYS.MESSAGES(state.familyCode, chatId);
      const existing = await AsyncStorage.getItem(key);
      let allMessages: FamilyMessage[] = [];
      
      if (existing) {
        try {
          const decrypted = await decryptData(existing, state.familyCode);
          allMessages = JSON.parse(decrypted);
        } catch {
          allMessages = JSON.parse(existing);
        }
      }
      
      const mergedMap = new Map<string, FamilyMessage>();
      [...allMessages, ...newMessages].forEach(msg => {
        const prev = mergedMap.get(msg.syncId);
        if (!prev || msg.version > prev.version) {
          mergedMap.set(msg.syncId, msg);
        }
      });
      
      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const encrypted = await encryptData(JSON.stringify(merged), state.familyCode);
      await AsyncStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  };

  const loadMessages = async (chatId: string): Promise<FamilyMessage[]> => {
    if (!state.familyCode) return [];
    try {
      const key = STORAGE_KEYS.MESSAGES(state.familyCode, chatId);
      const saved = await AsyncStorage.getItem(key);
      if (!saved) return [];
      try {
        const decrypted = await decryptData(saved, state.familyCode);
        return JSON.parse(decrypted);
      } catch {
        return JSON.parse(saved);
      }
    } catch (error) {
      return [];
    }
  };

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
    
    // Push to remote
    if (syncServiceRef.current) {
      await syncServiceRef.current.pushChats([newChat]);
    }
    
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
    
    // Push to remote
    if (syncServiceRef.current) {
      await syncServiceRef.current.pushChats([newChat]);
    }
    
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
      sweetAlert.alert('Error', 'You must be logged in to send messages', 'info');
      return;
    }
    
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;
    
    if (chat.type === 'direct') {
      const otherId = chat.participants.find(p => p !== userProfile.id);
      if (otherId && state.blockedUsers.includes(otherId)) {
        sweetAlert.alert('Blocked', 'You have blocked this user. Unblock to send messages.', 'warning');
        return;
      }
    }
    
    const syncId = Crypto.randomUUID();
    const now = new Date().toISOString();
    
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
      voiceUrl: type === 'voice' ? mediaData : undefined,
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
    
    setState(prev => {
      const updatedChats = prev.chats.map(c => {
        if (c.id === chatId) {
          return { ...c, lastMessage: newMessage, updatedAt: now };
        }
        return c;
      });
      return {
        ...prev,
        chats: updatedChats,
        messages: {
          ...prev.messages,
          [chatId]: [...(prev.messages[chatId] || []), newMessage],
        },
        pendingSync: [...prev.pendingSync, syncId],
      };
    });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await saveMessages(chatId, [{ ...newMessage, deliveryStatus: 'sent' }]);
      
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
      
      // ─── PUSH TO REMOTE ──────────────────────────────────────
      if (syncServiceRef.current) {
        await syncServiceRef.current.pushMessages([{ ...newMessage, deliveryStatus: 'sent' }]);
        await syncServiceRef.current.pushChats(updatedChats);
      }
      
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
      
      if (syncServiceRef.current) {
        await syncServiceRef.current.pushMessages([{ ...message, deliveryStatus: 'sent' }]);
      }
      
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
    
    if (syncServiceRef.current) {
      const editedMsg = updatedMessages.find(m => m.id === messageId);
      if (editedMsg) {
        await syncServiceRef.current.pushMessages([editedMsg]);
      }
    }
    
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
          sweetAlert.alert('Permission Required', 'Please allow camera access', 'info');
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
          sweetAlert.alert('Permission Required', 'Please allow access to photos', 'info');
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
        const permanentUri = FileSystem.documentDirectory + 'chat_media/' + fileName;
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'chat_media/', { intermediates: true });
        await FileSystem.copyAsync({ from: uri, to: permanentUri });
        
        await sendMessage(chatId, '📷 Photo', 'image', permanentUri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      sweetAlert.alert('Error', 'Failed to send image', 'info');
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
      sweetAlert.alert('Error', 'Failed to send file', 'info');
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
    
    // ─── SYNC READ STATUS ──────────────────────────────────────
    if (syncServiceRef.current && state.familyCode) {
      const unreadMessages = messages.filter(m => !m.readBy.includes(userProfile.id));
      for (const msg of unreadMessages) {
        await syncServiceRef.current.markMessageRead(chatId, msg.id, userProfile.id);
      }
    }
    
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
    
    // ─── BROADCAST TYPING STATUS ──────────────────────────────
    if (syncServiceRef.current && state.familyCode) {
      syncServiceRef.current.broadcastTyping(chatId, isTyping);
    }
    
    if (isTyping) {
      typingTimeoutRef.current[key] = setTimeout(() => {
        setTypingStatus(chatId, false);
      }, 3000);
    }
  }, [userProfile, state.familyCode]);

  const isUserTyping = useCallback((chatId: string, userId: string): boolean => {
    return (state.typingUsers[chatId] || []).some(t => t.userId === userId && t.isTyping);
  }, [state.typingUsers]);

  const getTypingUsers = useCallback((chatId: string): TypingStatus[] => {
    return state.typingUsers[chatId] || [];
  }, [state.typingUsers]);

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
    
    if (syncServiceRef.current) {
      const updatedMsg = updatedMessages.find(m => m.id === messageId);
      if (updatedMsg) {
        await syncServiceRef.current.pushMessages([updatedMsg]);
      }
    }
    
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

  const muteChat = async (chatId: string, muted: boolean): Promise<void> => {
    if (!state.familyCode) return;
    
    const updatedChats = state.chats.map(c => 
      c.id === chatId ? { ...c, isMuted: muted } : c
    );
    
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    if (syncServiceRef.current) {
      await syncServiceRef.current.pushChats(updatedChats);
    }
    
    setState(prev => ({ ...prev, chats: updatedChats }));
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pinChat = async (chatId: string, pinned: boolean): Promise<void> => {
    if (!state.familyCode) return;
    
    const updatedChats = state.chats.map(c => 
      c.id === chatId ? { ...c, isPinned: pinned } : c
    );
    
    await AsyncStorage.setItem(STORAGE_KEYS.CHATS(state.familyCode), JSON.stringify(updatedChats));
    
    if (syncServiceRef.current) {
      await syncServiceRef.current.pushChats(updatedChats);
    }
    
    setState(prev => ({ ...prev, chats: updatedChats }));
  };

  const leaveChat = async (chatId: string): Promise<void> => {
    if (!state.familyCode || !userProfile) return;
    
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat || chat.type === 'group') {
      sweetAlert.alert('Cannot Leave', 'You cannot leave the family group chat', 'info');
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
      
      if (syncServiceRef.current) {
        syncServiceRef.current.setFamilyCode(code);
      }
      
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
      
      // ─── PULL REMOTE DATA ────────────────────────────────────
      if (syncServiceRef.current) {
        await performInitialSync();
        // Reset subscription to ensure it reconnects
        isSubscribedRef.current = false;
        setupRealtimeListeners();
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      sweetAlert.alert('Error', 'Failed to join family', 'info');
      return false;
    }
  };

  const getFamilyCode = (): string | null => state.familyCode;

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
    if (syncServiceRef.current) {
      await performInitialSync();
    }
  };

  const forceSync = async (): Promise<void> => {
    if (syncServiceRef.current) {
      isSubscribedRef.current = false;
      await performInitialSync();
      setupRealtimeListeners();
    }
  };

  const blockUser = async (userId: string): Promise<void> => {
    let wasBlocked = false;
    setState(prev => {
      const isBlocked = prev.blockedUsers.includes(userId);
      wasBlocked = isBlocked;
      const updated = isBlocked
        ? prev.blockedUsers.filter(id => id !== userId)
        : [...prev.blockedUsers, userId];
      if (prev.familyCode) {
        const blockedKey = `@littleloom_blocked_${prev.familyCode}`;
        AsyncStorage.setItem(blockedKey, JSON.stringify(updated)).catch(console.error);
      }
      return { ...prev, blockedUsers: updated };
    });
    Haptics.notificationAsync(
      wasBlocked
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );
  };

  const isUserBlocked = (userId: string): boolean => {
    return state.blockedUsers.includes(userId);
  };

  const value = useMemo<FamilyChatContextType>(() => ({
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
    blockUser,
    isUserBlocked,
    forceSync,
  }), [
    state,
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
    blockUser,
    isUserBlocked,
    forceSync,
  ]);

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