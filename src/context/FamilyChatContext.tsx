// src/context/FamilyChatContext.tsx
// Full Supabase real-time implementation

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { supabase } from '@/utils/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { useAuth } from './AuthContext';
import { useBaby } from './BabyContext';
import { useFamily } from './FamilyContext';
import type { FamilyMember } from './FamilyContext';
import { useSweetAlert } from '../components/SweetAlert';

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

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  FAMILY_CODE: '@littleloom_current_family_code',
  TYPING_STATUS: '@littleloom_typing_status',
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
  deviceId: string,
  senderName: string = 'LittleLoom'
): FamilyMessage => ({
  id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  syncId: `sys_${Crypto.randomUUID()}`,
  deviceId,
  version: 1,
  chatId,
  senderId: 'system',
  senderName,
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

/* ═══════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════ */

export const FamilyChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { members, parent1, parent2, guardians, getCurrentBaby } = useFamily();
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
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const isInitializedRef = useRef(false);
  const isSubscribedRef = useRef(false);

  /* ─── Initialize Device ID ──────────────────────────────────── */
  useEffect(() => {
    (async () => {
      deviceIdRef.current = await getOrCreateDeviceId();
      await loadFamilyCode();
    })();
  }, []);

  /* ─── Setup Realtime Listeners ──────────────────────────────── */
  const setupRealtimeListeners = useCallback(() => {
    if (!state.familyCode) return;
    if (isSubscribedRef.current) return;

    // Unsubscribe from existing channel
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }

    // Create a channel for this family
    const channel = supabase.channel(`family-chat-${state.familyCode}`);

    // Listen for new messages
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'family_messages',
        filter: `family_code=eq.${state.familyCode}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const newMessage = payload.new as Record<string, unknown>;
        if (!newMessage) return;

        // Check if message is from this device
        if (newMessage.device_id === deviceIdRef.current) return;

        const message: FamilyMessage = {
          id: newMessage.id as string,
          syncId: newMessage.sync_id as string,
          deviceId: newMessage.device_id as string,
          version: newMessage.version as number || 1,
          chatId: newMessage.chat_id as string,
          senderId: newMessage.sender_id as string,
          senderName: newMessage.sender_name as string,
          senderRole: newMessage.sender_role as string,
          senderAvatar: newMessage.sender_avatar as string || undefined,
          receiverId: newMessage.receiver_id as string || undefined,
          content: newMessage.content as string,
          type: newMessage.type as MessageType || 'text',
          imageUrl: newMessage.image_url as string || undefined,
          fileUrl: newMessage.file_url as string || undefined,
          voiceUrl: newMessage.voice_url as string || undefined,
          fileMetadata: newMessage.file_metadata ? JSON.parse(newMessage.file_metadata as string) : undefined,
          timestamp: newMessage.timestamp as string,
          read: newMessage.read as boolean || false,
          readBy: newMessage.read_by as string[] || [],
          familyCode: newMessage.family_code as string,
          reactions: newMessage.reactions ? JSON.parse(newMessage.reactions as string) : [],
          replyTo: newMessage.reply_to as string || undefined,
          replyToPreview: newMessage.reply_to_preview as string || undefined,
          isEdited: newMessage.is_edited as boolean || false,
          editedAt: newMessage.edited_at as string || undefined,
          deliveryStatus: 'sent',
        };

        setState(prev => {
          const chatMessages = prev.messages[message.chatId] || [];
          const exists = chatMessages.some(m => m.syncId === message.syncId);
          if (exists) return prev;

          const updatedMessages = {
            ...prev.messages,
            [message.chatId]: [...chatMessages, message],
          };

          // Update chat's last message
          const updatedChats = prev.chats.map(chat => {
            if (chat.id === message.chatId) {
              return {
                ...chat,
                lastMessage: message,
                updatedAt: message.timestamp,
                unreadCount: chat.unreadCount + 1,
              };
            }
            return chat;
          });

          return {
            ...prev,
            messages: updatedMessages,
            chats: updatedChats,
          };
        });
      }
    );

    // Listen for message updates (read status, edits, reactions)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'family_messages',
        filter: `family_code=eq.${state.familyCode}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const updatedData = payload.new as Record<string, unknown>;
        if (!updatedData) return;

        const messageId = updatedData.id as string;
        const chatId = updatedData.chat_id as string;

        setState(prev => {
          const chatMessages = prev.messages[chatId] || [];
          const updatedMessages = chatMessages.map(msg => {
            if (msg.id === messageId) {
              return {
                ...msg,
                read: updatedData.read as boolean || false,
                readBy: updatedData.read_by as string[] || [],
                reactions: updatedData.reactions ? JSON.parse(updatedData.reactions as string) : msg.reactions,
                content: updatedData.content as string || msg.content,
                isEdited: updatedData.is_edited as boolean || msg.isEdited,
                editedAt: updatedData.edited_at as string || msg.editedAt,
              };
            }
            return msg;
          });

          return {
            ...prev,
            messages: {
              ...prev.messages,
              [chatId]: updatedMessages,
            },
          };
        });
      }
    );

    // Listen for typing status
    channel.on(
      'broadcast',
      { event: 'typing' },
      (payload: { payload: any }) => {
        const data = payload.payload;
        if (!data || data.userId === deviceIdRef.current) return;

        setState(prev => {
          const currentTypers = prev.typingUsers[data.chatId] || [];
          const existingIndex = currentTypers.findIndex(t => t.userId === data.userId);
          
          let updatedTypers;
          if (data.isTyping) {
            const newStatus: TypingStatus = {
              userId: data.userId,
              userName: data.userName || 'Family Member',
              chatId: data.chatId,
              isTyping: true,
              timestamp: data.timestamp || new Date().toISOString(),
            };
            if (existingIndex >= 0) {
              updatedTypers = [...currentTypers];
              updatedTypers[existingIndex] = newStatus;
            } else {
              updatedTypers = [...currentTypers, newStatus];
            }
          } else {
            updatedTypers = currentTypers.filter(t => t.userId !== data.userId);
          }
          
          return {
            ...prev,
            typingUsers: { ...prev.typingUsers, [data.chatId]: updatedTypers },
          };
        });
      }
    );

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[FamilyChat] Subscribed to real-time channel');
        isSubscribedRef.current = true;
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('[FamilyChat] Channel error, will retry...');
        setTimeout(() => {
          if (realtimeChannelRef.current) {
            realtimeChannelRef.current.subscribe();
          }
        }, 5000);
      }
    });

    realtimeChannelRef.current = channel;
  }, [state.familyCode]);

  /* ─── Perform Initial Sync ──────────────────────────────────── */
  const performInitialSync = useCallback(async () => {
    if (!state.familyCode) return;
    
    isInitializedRef.current = true;
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Fetch chats
      const { data: chatsData, error: chatsError } = await supabase
        .from('family_chats')
        .select('*')
        .eq('family_code', state.familyCode);

      if (chatsError) {
        console.warn('[FamilyChat] Chats fetch error:', chatsError.message);
      }

      // Fetch messages for each chat
      const messages: Record<string, FamilyMessage[]> = {};
      const chats: FamilyChat[] = [];

      if (chatsData) {
        for (const chatData of chatsData) {
          // Map to FamilyChat
          const chat: FamilyChat = {
            id: chatData.id,
            type: chatData.type,
            name: chatData.name,
            participants: chatData.participants,
            participantRoles: chatData.participant_roles || {},
            participantNames: chatData.participant_names || {},
            participantAvatars: chatData.participant_avatars || {},
            unreadCount: chatData.unread_count || 0,
            createdAt: chatData.created_at,
            updatedAt: chatData.updated_at,
            avatar: chatData.avatar || undefined,
            isMuted: chatData.is_muted || false,
            familyCode: chatData.family_code,
            isPinned: chatData.is_pinned || false,
            backgroundImage: chatData.background_image || undefined,
          };
          chats.push(chat);

          // Fetch messages for this chat
          const { data: msgData, error: msgError } = await supabase
            .from('family_messages')
            .select('*')
            .eq('chat_id', chat.id)
            .eq('family_code', state.familyCode)
            .order('timestamp', { ascending: true })
            .limit(100);

          if (!msgError && msgData) {
            messages[chat.id] = msgData.map((row: any) => ({
              id: row.id,
              syncId: row.sync_id,
              deviceId: row.device_id,
              version: row.version || 1,
              chatId: row.chat_id,
              senderId: row.sender_id,
              senderName: row.sender_name,
              senderRole: row.sender_role,
              senderAvatar: row.sender_avatar || undefined,
              receiverId: row.receiver_id || undefined,
              content: row.content,
              type: row.type || 'text',
              imageUrl: row.image_url || undefined,
              fileUrl: row.file_url || undefined,
              voiceUrl: row.voice_url || undefined,
              fileMetadata: row.file_metadata ? JSON.parse(row.file_metadata) : undefined,
              timestamp: row.timestamp,
              read: row.read || false,
              readBy: row.read_by || [],
              familyCode: row.family_code,
              reactions: row.reactions ? JSON.parse(row.reactions) : [],
              replyTo: row.reply_to || undefined,
              replyToPreview: row.reply_to_preview || undefined,
              isEdited: row.is_edited || false,
              editedAt: row.edited_at || undefined,
              deliveryStatus: 'sent',
            }));

            // Set last message
            if (msgData.length > 0) {
              const last = msgData[msgData.length - 1];
              chat.lastMessage = messages[chat.id][messages[chat.id].length - 1];
            }
          }
        }
      }

      setState(prev => ({
        ...prev,
        chats,
        messages,
        isLoading: false,
        isSynced: true,
      }));

      // Setup real-time listeners
      setupRealtimeListeners();

    } catch (error) {
      console.error('[FamilyChat] Initial sync error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.familyCode, setupRealtimeListeners]);

  /* ─── Load Family Code ────────────────────────────────────────── */
  const loadFamilyCode = useCallback(async () => {
    try {
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'family_code')
        .maybeSingle();

      if (settingsData?.value) {
        const code = settingsData.value;
        setState(prev => ({ ...prev, familyCode: code }));
      } else if (babyContext) {
        const newCode = `FAM-${babyContext.id.slice(0, 6).toUpperCase()}`;
        await supabase
          .from('app_settings')
          .upsert({
            key: 'family_code',
            value: newCode,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' });
        setState(prev => ({ ...prev, familyCode: newCode }));
      }
    } catch (error) {
      console.error('Error loading family code:', error);
    }
  }, [babyContext]);

  /* ─── Initialize ────────────────────────────────────────────────── */
  useEffect(() => {
    if (deviceIdRef.current && state.familyCode && !isInitializedRef.current) {
      performInitialSync();
    }
  }, [deviceIdRef.current, state.familyCode, performInitialSync]);

  /* ─── Cleanup ────────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe();
        realtimeChannelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, []);

  /* ─── Chat Management ────────────────────────────────────────────── */

  const createFamilyGroup = useCallback(async (name?: string, avatar?: string): Promise<string> => {
    if (!state.familyCode || !userProfile) return '';

    const chatId = `family_group_${state.familyCode}`;
    
    // Check if group already exists
    const { data: existing } = await supabase
      .from('family_chats')
      .select('id')
      .eq('id', chatId)
      .maybeSingle();

    if (existing) {
      return chatId;
    }

    const participantNames: Record<string, string> = {};
    const participantRoles: Record<string, string> = {};
    const participantAvatars: Record<string, string> = {};

    members.forEach(m => {
      participantRoles[m.id] = m.role;
      participantNames[m.id] = m.fullName;
      participantAvatars[m.id] = m.avatar || '👤';
    });

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('family_chats')
      .insert({
        id: chatId,
        type: 'group',
        name: name || `${getCurrentBaby()?.name || 'Family'} Group`,
        participants: members.map(m => m.id),
        participant_roles: participantRoles,
        participant_names: participantNames,
        participant_avatars: participantAvatars,
        unread_count: 0,
        created_at: now,
        updated_at: now,
        avatar: avatar || '👨‍👩‍👧‍👦',
        is_muted: false,
        family_code: state.familyCode,
        is_pinned: true,
      });

    if (error) {
      console.error('[FamilyChat] Create group error:', error);
      sweetAlert.alert('Error', 'Failed to create family group', 'error');
      return '';
    }

    // Add welcome message
    const welcomeMsg = createSystemMessage(
      chatId,
      `Welcome to ${getCurrentBaby()?.name || 'your baby'}'s family chat! 💕\n\nShare updates, photos, and stay connected with your family.`,
      state.familyCode,
      deviceIdRef.current
    );

    await supabase
      .from('family_messages')
      .insert({
        id: welcomeMsg.id,
        sync_id: welcomeMsg.syncId,
        device_id: welcomeMsg.deviceId,
        version: welcomeMsg.version,
        chat_id: welcomeMsg.chatId,
        sender_id: welcomeMsg.senderId,
        sender_name: welcomeMsg.senderName,
        sender_role: welcomeMsg.senderRole,
        sender_avatar: welcomeMsg.senderAvatar,
        content: welcomeMsg.content,
        type: welcomeMsg.type,
        timestamp: welcomeMsg.timestamp,
        read: welcomeMsg.read,
        read_by: welcomeMsg.readBy,
        family_code: welcomeMsg.familyCode,
        delivery_status: welcomeMsg.deliveryStatus,
      });

    // Add chat to state
    const newChat: FamilyChat = {
      id: chatId,
      type: 'group',
      name: name || `${getCurrentBaby()?.name || 'Family'} Group`,
      participants: members.map(m => m.id),
      participantRoles,
      participantNames,
      participantAvatars,
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
      avatar: avatar || '👨‍👩‍👧‍👦',
      isMuted: false,
      familyCode: state.familyCode,
      isPinned: true,
    };

    setState(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats],
      messages: {
        ...prev.messages,
        [chatId]: [welcomeMsg],
      },
    }));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return chatId;
  }, [state.familyCode, userProfile, members, getCurrentBaby]);

  const getOrCreateDirectChat = useCallback(async (memberId: string, memberInfo?: Partial<FamilyMember>): Promise<string> => {
    if (!state.familyCode || !userProfile) return '';

    // Check if chat already exists
    const { data: existing } = await supabase
      .from('family_chats')
      .select('*')
      .eq('family_code', state.familyCode)
      .eq('type', 'direct')
      .contains('participants', [userProfile.id, memberId])
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    const member = members.find(m => m.id === memberId) || memberInfo;
    if (!member) return '';

    const chatId = `direct_${[userProfile.id, memberId].sort().join('_')}`;
    const now = new Date().toISOString();

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

    const { error } = await supabase
      .from('family_chats')
      .insert({
        id: chatId,
        type: 'direct',
        name: member.fullName || 'Unknown',
        participants: [userProfile.id, memberId],
        participant_roles: participantRoles,
        participant_names: participantNames,
        participant_avatars: participantAvatars,
        unread_count: 0,
        created_at: now,
        updated_at: now,
        avatar: member.avatar || '👤',
        is_muted: false,
        family_code: state.familyCode,
        is_pinned: false,
      });

    if (error) {
      console.error('[FamilyChat] Create direct chat error:', error);
      sweetAlert.alert('Error', 'Failed to create chat', 'error');
      return '';
    }

    const newChat: FamilyChat = {
      id: chatId,
      type: 'direct',
      name: member.fullName || 'Unknown',
      participants: [userProfile.id, memberId],
      participantRoles,
      participantNames,
      participantAvatars,
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
      avatar: member.avatar || '👤',
      isMuted: false,
      familyCode: state.familyCode,
      isPinned: false,
    };

    setState(prev => ({
      ...prev,
      chats: [newChat, ...prev.chats],
    }));

    return chatId;
  }, [state.familyCode, userProfile, members]);

  /* ─── Send Message ────────────────────────────────────────────────── */

  const sendMessage = useCallback(async (
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

    // Check if user is blocked
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

    // Add to local state immediately
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
      };
    });

    try {
      // Insert into Supabase
      const { error } = await supabase
        .from('family_messages')
        .insert({
          id: newMessage.id,
          sync_id: newMessage.syncId,
          device_id: newMessage.deviceId,
          version: newMessage.version,
          chat_id: newMessage.chatId,
          sender_id: newMessage.senderId,
          sender_name: newMessage.senderName,
          sender_role: newMessage.senderRole,
          sender_avatar: newMessage.senderAvatar,
          content: newMessage.content,
          type: newMessage.type,
          image_url: newMessage.imageUrl,
          file_url: newMessage.fileUrl,
          voice_url: newMessage.voiceUrl,
          file_metadata: newMessage.fileMetadata ? JSON.stringify(newMessage.fileMetadata) : null,
          timestamp: newMessage.timestamp,
          read: newMessage.read,
          read_by: newMessage.readBy,
          family_code: newMessage.familyCode,
          reactions: JSON.stringify(newMessage.reactions),
          reply_to: newMessage.replyTo,
          reply_to_preview: newMessage.replyToPreview,
          delivery_status: 'sent',
        });

      if (error) {
        console.error('[FamilyChat] Send message error:', error);
        // Update message as failed
        setState(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: prev.messages[chatId]?.map(m =>
              m.id === newMessage.id ? { ...m, deliveryStatus: 'failed' } : m
            ) || [],
          },
        }));
        sweetAlert.alert('Error', 'Failed to send message', 'error');
        return;
      }

      // Update chat last message
      await supabase
        .from('family_chats')
        .update({
          last_message_id: newMessage.id,
          updated_at: now,
        })
        .eq('id', chatId);

      // Update local state
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: prev.messages[chatId]?.map(m =>
            m.id === newMessage.id ? { ...m, deliveryStatus: 'sent' } : m
          ) || [],
        },
      }));

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    } catch (error) {
      console.error('[FamilyChat] Send message error:', error);
      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: prev.messages[chatId]?.map(m =>
            m.id === newMessage.id ? { ...m, deliveryStatus: 'failed' } : m
          ) || [],
        },
      }));
    }
  }, [state.familyCode, state.chats, state.messages, state.blockedUsers, userProfile, sweetAlert]);

  /* ─── Resend Message ────────────────────────────────────────────────── */

  const resendMessage = useCallback(async (chatId: string, messageId: string): Promise<void> => {
    const message = state.messages[chatId]?.find(m => m.id === messageId);
    if (!message || message.deliveryStatus !== 'failed') return;

    // Reset status
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
      const { error } = await supabase
        .from('family_messages')
        .update({
          delivery_status: 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) {
        throw error;
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
    } catch (error) {
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
  }, [state.messages]);

  /* ─── Edit Message ────────────────────────────────────────────────── */

  const editMessage = useCallback(async (chatId: string, messageId: string, newContent: string) => {
    if (!state.familyCode || !userProfile) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('family_messages')
      .update({
        content: newContent,
        is_edited: true,
        edited_at: now,
        updated_at: now,
      })
      .eq('id', messageId)
      .eq('sender_id', userProfile.id);

    if (error) {
      console.error('[FamilyChat] Edit message error:', error);
      sweetAlert.alert('Error', 'Failed to edit message', 'error');
      return;
    }

    setState(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [chatId]: prev.messages[chatId]?.map(m =>
          m.id === messageId ? { ...m, content: newContent, isEdited: true, editedAt: now } : m
        ) || [],
      },
    }));
  }, [state.familyCode, userProfile, sweetAlert]);

  /* ─── Mark Chat Read ────────────────────────────────────────────────── */

  const markChatRead = useCallback(async (chatId: string) => {
    if (!userProfile) return;

    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    const messages = state.messages[chatId] || [];
    const unreadMessages = messages.filter(m => !m.readBy.includes(userProfile.id));

    if (unreadMessages.length === 0) return;

    const messageIds = unreadMessages.map(m => m.id);

    // Update Supabase
    for (const msgId of messageIds) {
      await supabase
        .from('family_messages')
        .update({
          read: true,
          read_by: [...unreadMessages.find(m => m.id === msgId)!.readBy, userProfile.id],
        })
        .eq('id', msgId);
    }

    // Update local state
    const updatedMessages = messages.map(msg => {
      if (messageIds.includes(msg.id)) {
        return { ...msg, read: true, readBy: [...msg.readBy, userProfile.id] };
      }
      return msg;
    });

    const updatedChats = state.chats.map(c => {
      if (c.id === chatId) {
        return { ...c, unreadCount: 0 };
      }
      return c;
    });

    setState(prev => ({
      ...prev,
      chats: updatedChats,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));
  }, [userProfile, state.chats, state.messages]);

  /* ─── Delete Message ────────────────────────────────────────────────── */

  const deleteMessage = useCallback(async (chatId: string, messageId: string) => {
    if (!state.familyCode || !userProfile) return;

    const message = state.messages[chatId]?.find(m => m.id === messageId);
    if (!message) return;

    // Only allow deletion by sender or parent1
    if (message.senderId !== userProfile.id && userProfile.role !== 'parent1') {
      sweetAlert.alert('Permission Denied', 'You can only delete your own messages', 'warning');
      return;
    }

    const { error } = await supabase
      .from('family_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('[FamilyChat] Delete message error:', error);
      sweetAlert.alert('Error', 'Failed to delete message', 'error');
      return;
    }

    const updatedMessages = state.messages[chatId]?.filter(m => m.id !== messageId) || [];

    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [state.familyCode, state.messages, userProfile, sweetAlert]);

  /* ─── Clear Chat ────────────────────────────────────────────────────── */

  const clearChat = useCallback(async (chatId: string) => {
    if (!state.familyCode || !userProfile) return;

    // Only allow clearing by parent1
    if (userProfile.role !== 'parent1') {
      sweetAlert.alert('Permission Denied', 'Only Parent 1 can clear the chat', 'warning');
      return;
    }

    const { error } = await supabase
      .from('family_messages')
      .delete()
      .eq('chat_id', chatId)
      .eq('family_code', state.familyCode);

    if (error) {
      console.error('[FamilyChat] Clear chat error:', error);
      sweetAlert.alert('Error', 'Failed to clear chat', 'error');
      return;
    }

    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: [] },
    }));
  }, [state.familyCode, userProfile, sweetAlert]);

  /* ─── Image/File Picker ────────────────────────────────────────────── */

  const pickAndSendImage = useCallback(async (chatId: string, fromCamera: boolean = false): Promise<void> => {
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

        // Upload to Supabase storage
        const fileExt = uri.split('.').pop() || 'jpg';
        const storagePath = `chat_images/${state.familyCode}/${Date.now()}.${fileExt}`;

        const fileData = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(storagePath, Buffer.from(fileData, 'base64'), {
            contentType: `image/${fileExt}`,
          });

        if (uploadError) {
          console.error('[FamilyChat] Image upload error:', uploadError);
          sweetAlert.alert('Error', 'Failed to upload image', 'error');
          return;
        }

        const { data: urlData } = supabase.storage
          .from('chat_media')
          .getPublicUrl(storagePath);

        await sendMessage(chatId, '📷 Photo', 'image', urlData.publicUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[FamilyChat] Pick image error:', error);
      sweetAlert.alert('Error', 'Failed to send image', 'error');
    }
  }, [state.familyCode, sendMessage, sweetAlert]);

  const pickAndSendFile = useCallback(async (chatId: string): Promise<void> => {
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

      // Upload to Supabase storage
      const storagePath = `chat_files/${state.familyCode}/${Date.now()}_${asset.name}`;
      const fileData = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { error: uploadError } = await supabase.storage
        .from('chat_files')
        .upload(storagePath, Buffer.from(fileData, 'base64'), {
          contentType: asset.mimeType || 'application/octet-stream',
        });

      if (uploadError) {
        console.error('[FamilyChat] File upload error:', uploadError);
        sweetAlert.alert('Error', 'Failed to upload file', 'error');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('chat_files')
        .getPublicUrl(storagePath);

      const fileMeta: FileMetadata = {
        name: asset.name || 'Unknown file',
        size,
        type: asset.mimeType || 'application/octet-stream',
        uri: permanentUri,
      };

      await sendMessage(chatId, `📎 ${asset.name}`, 'file', urlData.publicUrl, fileMeta);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[FamilyChat] File pick error:', error);
      sweetAlert.alert('Error', 'Failed to send file', 'error');
    }
  }, [state.familyCode, sendMessage, sweetAlert]);

  /* ─── Reactions ────────────────────────────────────────────────────── */

  const addReaction = useCallback(async (chatId: string, messageId: string, emoji: string) => {
    if (!userProfile) return;

    const messages = state.messages[chatId] || [];
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = message.reactions || [];
    const existingIndex = reactions.findIndex(r => r.userId === userProfile.id && r.emoji === emoji);

    let updatedReactions;
    if (existingIndex >= 0) {
      updatedReactions = reactions.filter((_, i) => i !== existingIndex);
    } else {
      updatedReactions = [...reactions, { emoji, userId: userProfile.id, userName: userProfile.fullName }];
    }

    const { error } = await supabase
      .from('family_messages')
      .update({
        reactions: JSON.stringify(updatedReactions),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) {
      console.error('[FamilyChat] Add reaction error:', error);
      return;
    }

    const updatedMessages = messages.map(m =>
      m.id === messageId ? { ...m, reactions: updatedReactions } : m
    );

    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [userProfile, state.messages]);

  const removeReaction = useCallback(async (chatId: string, messageId: string, emoji: string) => {
    if (!userProfile) return;

    const messages = state.messages[chatId] || [];
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = (message.reactions || []).filter(
      r => !(r.userId === userProfile.id && r.emoji === emoji)
    );

    const { error } = await supabase
      .from('family_messages')
      .update({
        reactions: JSON.stringify(reactions),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) {
      console.error('[FamilyChat] Remove reaction error:', error);
      return;
    }

    const updatedMessages = messages.map(m =>
      m.id === messageId ? { ...m, reactions } : m
    );

    setState(prev => ({
      ...prev,
      messages: { ...prev.messages, [chatId]: updatedMessages },
    }));
  }, [userProfile, state.messages]);

  /* ─── Typing Status ────────────────────────────────────────────────── */

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

    // Broadcast typing status via Supabase
    if (state.familyCode && realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: userProfile.id,
          userName: userProfile.fullName,
          chatId,
          isTyping,
          timestamp: new Date().toISOString(),
        },
      });
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

  /* ─── Chat Settings ────────────────────────────────────────────────── */

  const muteChat = useCallback(async (chatId: string, muted: boolean) => {
    if (!state.familyCode) return;

    const { error } = await supabase
      .from('family_chats')
      .update({
        is_muted: muted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    if (error) {
      console.error('[FamilyChat] Mute chat error:', error);
      return;
    }

    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c => c.id === chatId ? { ...c, isMuted: muted } : c),
    }));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [state.familyCode]);

  const pinChat = useCallback(async (chatId: string, pinned: boolean) => {
    if (!state.familyCode) return;

    const { error } = await supabase
      .from('family_chats')
      .update({
        is_pinned: pinned,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    if (error) {
      console.error('[FamilyChat] Pin chat error:', error);
      return;
    }

    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c => c.id === chatId ? { ...c, isPinned: pinned } : c),
    }));
  }, [state.familyCode]);

  const setChatBackground = useCallback(async (chatId: string, imageUri: string | null) => {
    if (!state.familyCode) return;

    const { error } = await supabase
      .from('family_chats')
      .update({
        background_image: imageUri,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    if (error) {
      console.error('[FamilyChat] Set background error:', error);
      return;
    }

    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c => c.id === chatId ? { ...c, backgroundImage: imageUri || undefined } : c),
    }));
  }, [state.familyCode]);

  const leaveChat = useCallback(async (chatId: string) => {
    if (!state.familyCode || !userProfile) return;

    const chat = state.chats.find(c => c.id === chatId);
    if (!chat || chat.type === 'group') {
      sweetAlert.alert('Cannot Leave', 'You cannot leave the family group chat', 'info');
      return;
    }

    // Remove user from participants
    const updatedParticipants = chat.participants.filter(p => p !== userProfile.id);

    const { error } = await supabase
      .from('family_chats')
      .update({
        participants: updatedParticipants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    if (error) {
      console.error('[FamilyChat] Leave chat error:', error);
      sweetAlert.alert('Error', 'Failed to leave chat', 'error');
      return;
    }

    setState(prev => ({
      ...prev,
      chats: prev.chats.filter(c => c.id !== chatId),
    }));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [state.familyCode, state.chats, userProfile, sweetAlert]);

  const deleteChat = useCallback(async (chatId: string) => {
    if (!state.familyCode || !userProfile) return;

    // Only allow deletion by parent1 or chat owner
    if (userProfile.role !== 'parent1') {
      sweetAlert.alert('Permission Denied', 'Only Parent 1 can delete chats', 'warning');
      return;
    }

    const { error } = await supabase
      .from('family_chats')
      .delete()
      .eq('id', chatId)
      .eq('family_code', state.familyCode);

    if (error) {
      console.error('[FamilyChat] Delete chat error:', error);
      sweetAlert.alert('Error', 'Failed to delete chat', 'error');
      return;
    }

    // Also delete all messages in this chat
    await supabase
      .from('family_messages')
      .delete()
      .eq('chat_id', chatId);

    setState(prev => ({
      ...prev,
      chats: prev.chats.filter(c => c.id !== chatId),
      messages: { ...prev.messages, [chatId]: undefined },
    }));
  }, [state.familyCode, userProfile, sweetAlert]);

  /* ─── Family Code Management ───────────────────────────────────────── */

  const shareFamilyCode = useCallback(async () => {
    const code = state.familyCode || generateFamilyCode();
    try {
      await Share.share({
        message: `Join my family on LittleLoom! Use code: ${code}\n\nTrack baby's moments together and chat with the family. Download the app and enter this code during setup.`,
        title: 'Join My Family on LittleLoom',
      });
    } catch (error) {
      console.error('Error sharing family code:', error);
    }
  }, [state.familyCode]);

  const joinFamilyByCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      // Verify code exists
      const { data: chatData, error: chatError } = await supabase
        .from('family_chats')
        .select('*')
        .eq('family_code', code)
        .eq('type', 'group')
        .maybeSingle();

      if (chatError || !chatData) {
        sweetAlert.alert('Invalid Code', 'This family code does not exist', 'error');
        return false;
      }

      // Update family code in settings
      await supabase
        .from('app_settings')
        .upsert({
          key: 'family_code',
          value: code,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      // Add user to participants
      if (userProfile && !chatData.participants.includes(userProfile.id)) {
        const updatedParticipants = [...chatData.participants, userProfile.id];
        const updatedNames = { ...chatData.participant_names, [userProfile.id]: userProfile.fullName };
        const updatedRoles = { ...chatData.participant_roles, [userProfile.id]: userProfile.role || 'guardian' };
        const updatedAvatars = { ...chatData.participant_avatars, [userProfile.id]: userProfile.avatar || '👤' };

        await supabase
          .from('family_chats')
          .update({
            participants: updatedParticipants,
            participant_names: updatedNames,
            participant_roles: updatedRoles,
            participant_avatars: updatedAvatars,
            updated_at: new Date().toISOString(),
          })
          .eq('id', chatData.id);

        // Add welcome message
        const welcomeMsg = createSystemMessage(
          chatData.id,
          `👋 ${userProfile.fullName} joined the family`,
          code,
          deviceIdRef.current
        );

        await supabase
          .from('family_messages')
          .insert({
            id: welcomeMsg.id,
            sync_id: welcomeMsg.syncId,
            device_id: welcomeMsg.deviceId,
            version: welcomeMsg.version,
            chat_id: welcomeMsg.chatId,
            sender_id: welcomeMsg.senderId,
            sender_name: welcomeMsg.senderName,
            sender_role: welcomeMsg.senderRole,
            sender_avatar: welcomeMsg.senderAvatar,
            content: welcomeMsg.content,
            type: welcomeMsg.type,
            timestamp: welcomeMsg.timestamp,
            read: welcomeMsg.read,
            read_by: welcomeMsg.readBy,
            family_code: welcomeMsg.familyCode,
            delivery_status: welcomeMsg.deliveryStatus,
          });
      }

      setState(prev => ({ ...prev, familyCode: code }));
      await performInitialSync();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      console.error('[FamilyChat] Join family error:', error);
      sweetAlert.alert('Error', 'Failed to join family', 'error');
      return false;
    }
  }, [userProfile, performInitialSync, sweetAlert]);

  /* ─── Block User ────────────────────────────────────────────────────── */

  const blockUser = useCallback(async (userId: string) => {
    let wasBlocked = false;
    setState(prev => {
      const isBlocked = prev.blockedUsers.includes(userId);
      wasBlocked = isBlocked;
      const updated = isBlocked
        ? prev.blockedUsers.filter(id => id !== userId)
        : [...prev.blockedUsers, userId];
      
      // Store in AsyncStorage for persistence
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
  }, []);

  const isUserBlocked = useCallback((userId: string): boolean => {
    return state.blockedUsers.includes(userId);
  }, [state.blockedUsers]);

  /* ─── Getters ───────────────────────────────────────────────────────── */

  const getChatMessages = useCallback((chatId: string): FamilyMessage[] => {
    return state.messages[chatId] || [];
  }, [state.messages]);

  const getMessageById = useCallback((chatId: string, messageId: string): FamilyMessage | undefined => {
    return state.messages[chatId]?.find(m => m.id === messageId);
  }, [state.messages]);

  const getChatById = useCallback((chatId: string): FamilyChat | undefined => {
    return state.chats.find(c => c.id === chatId);
  }, [state.chats]);

  const getFamilyCode = useCallback((): string | null => state.familyCode, [state.familyCode]);

  const getUnreadCount = useCallback((chatId?: string): number => {
    if (chatId) {
      const chat = state.chats.find(c => c.id === chatId);
      return chat?.isMuted ? 0 : (chat?.unreadCount || 0);
    }
    return state.chats.reduce((total, chat) => total + (chat.isMuted ? 0 : chat.unreadCount), 0);
  }, [state.chats]);

  const getMemberChatInfo = useCallback((memberId: string): { name: string; avatar: string; role: string } | null => {
    const member = members.find(m => m.id === memberId);
    if (!member) return null;

    return {
      name: member.fullName,
      avatar: member.avatar || '👤',
      role: member.role,
    };
  }, [members]);

  const searchMessages = useCallback((chatId: string, query: string): FamilyMessage[] => {
    const messages = state.messages[chatId] || [];
    const lowerQuery = query.toLowerCase();
    return messages.filter(msg =>
      msg.content.toLowerCase().includes(lowerQuery) ||
      msg.senderName.toLowerCase().includes(lowerQuery)
    );
  }, [state.messages]);

  const syncFamilyData = useCallback(async (): Promise<void> => {
    await performInitialSync();
  }, [performInitialSync]);

  const forceSync = useCallback(async (): Promise<void> => {
    isSubscribedRef.current = false;
    await performInitialSync();
    setupRealtimeListeners();
  }, [performInitialSync, setupRealtimeListeners]);

  /* ─── Memoized Value ────────────────────────────────────────────────── */

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