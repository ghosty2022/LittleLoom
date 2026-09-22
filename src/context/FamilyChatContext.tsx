// src/context/FamilyChatContext.tsx
// Full Supabase real-time implementation with instant messaging
// FIXED: ref-backed listeners, stable callbacks, no resubscribe storms

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { supabase } from '@/utils/supabase';
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

import { useAuth } from './AuthContext';
import { useBaby } from './BabyContext';
import { useFamily } from './FamilyContext';
import type { FamilyMember } from './FamilyContext';
import { useSweetAlert } from '../components/SweetAlert';
import { notificationService } from '../services/NotificationService';

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

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
  sendMessage: (
    chatId: string,
    content: string,
    type?: MessageType,
    mediaData?: string,
    fileMeta?: FileMetadata,
    replyToId?: string,
  ) => Promise<void>;
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
  setCurrentChatId: (chatId: string | null) => void;
}

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  FAMILY_CODE: '@littleloom_current_family_code',
  TYPING_STATUS: '@littleloom_typing_status',
  DEVICE_ID: '@littleloom_device_id',
} as const;

const FamilyChatContext = createContext<FamilyChatContextType | null>(null);

const generateFamilyCodeString = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'FAM-';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const createSystemMessage = (
  chatId: string,
  content: string,
  familyCode: string,
  deviceId: string,
  senderName = 'LittleLoom',
): FamilyMessage => ({
  id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

const parseReactions = (raw: unknown): { emoji: string; userId: string; userName: string }[] => {
  if (!raw) return [];
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (Array.isArray(raw)) return raw;
  } catch {}
  return [];
};

const parseFileMeta = (raw: unknown): FileMetadata | undefined => {
  if (!raw) return undefined;
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (typeof raw === 'object') return raw as FileMetadata;
  } catch {}
  return undefined;
};

/* ═══════════════════════════════════════════════════════════════════
   PROVIDER
   ═══════════════════════════════════════════════════════════════════ */

export const FamilyChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { members, getCurrentBaby } = useFamily();
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

  /* ─── Refs (stable identity across renders) ──────────────────── */
  const deviceIdRef = useRef<string>('');
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const isInitializedRef = useRef(false);
  const isSubscribedRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const currentChatIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // ⭐ Chat / message refs prevent stale closure bugs in realtime callbacks
  const chatsRef = useRef<FamilyChat[]>([]);
  const messagesRef = useRef<Record<string, FamilyMessage[]>>({});
  const familyCodeRef = useRef<string | null>(null);
  const userProfileRef = useRef(userProfile);

  /* ─── Keep refs synchronised with state ─────────────────────── */
  useEffect(() => { chatsRef.current = state.chats; }, [state.chats]);
  useEffect(() => { messagesRef.current = state.messages; }, [state.messages]);
  useEffect(() => { familyCodeRef.current = state.familyCode; }, [state.familyCode]);
  useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);
  useEffect(() => { currentChatIdRef.current = state.currentChatId; }, [state.currentChatId]);

  /* ─── Mount / unmount ────────────────────────────────────────── */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (realtimeChannelRef.current) {
        try { realtimeChannelRef.current.unsubscribe(); } catch {}
        realtimeChannelRef.current = null;
      }
      Object.values(typingTimeoutRef.current).forEach(t => clearTimeout(t));
      typingTimeoutRef.current = {};
    };
  }, []);

  /* ─── Load Family Code ──────────────────────────────────────── */
  const loadFamilyCode = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value, user_id')
        .eq('key', 'family_code')
        .eq('user_id', userProfileRef.current?.id ?? '')
        .maybeSingle();

      if (data?.value) {
        const code = data.value;
        const blockedKey = `@littleloom_blocked_${code}`;
        const savedBlocked = await AsyncStorage.getItem(blockedKey);
        const blockedUsers = savedBlocked ? JSON.parse(savedBlocked) : [];
        if (isMountedRef.current) {
          familyCodeRef.current = code;
          setState(prev => ({ ...prev, familyCode: code, blockedUsers }));
        }
        return;
      }

      if (babyContext) {
        const newCode = `FAM-${babyContext.id.slice(0, 6).toUpperCase()}`;
        await supabase
          .from('app_settings')
          .upsert(
            {
              key: 'family_code',
              value: newCode,
              user_id: userProfileRef.current?.id ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key,user_id' },
          );
        if (isMountedRef.current) {
          familyCodeRef.current = newCode;
          setState(prev => ({ ...prev, familyCode: newCode }));
        }
      }
    } catch (error) {
      console.warn('[FamilyChat] Load family code error:', error);
    }
  }, [babyContext]);

  /* ─── Initial Device ID + Notification Service ──────────────── */
  useEffect(() => {
    (async () => {
      deviceIdRef.current = await getOrCreateDeviceId();
      await loadFamilyCode();
      try {
        await notificationService.initialize();
      } catch (error) {
        console.warn('[FamilyChat] Notification init error:', error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Setup Realtime Listeners ──────────────────────────────── */
  /**
   * IMPORTANT: this callback must NOT depend on `state.chats` or `state.messages`.
   * Everything dynamic is read from refs inside the callbacks.
   */
  const setupRealtimeListeners = useCallback(() => {
    const familyCode = familyCodeRef.current;
    if (!familyCode) return;

    // Tear down existing channel
    if (realtimeChannelRef.current) {
      try { realtimeChannelRef.current.unsubscribe(); } catch {}
      realtimeChannelRef.current = null;
      isSubscribedRef.current = false;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const channel = supabase.channel(`family-chat-${familyCode}`, {
      config: {
        broadcast: { ack: true, self: true },
        presence: { key: deviceIdRef.current },
      },
    });

    /* ─── INSERT ─────────────────────────────────────────────── */
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'family_messages',
        filter: `family_code=eq.${familyCode}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const raw = payload.new as Record<string, unknown>;
        if (!raw) return;

        const isFromThisDevice = raw.device_id === deviceIdRef.current;

        try {
          const reactions = parseReactions(raw.reactions);
          const fileMetadata = parseFileMeta(raw.file_metadata);

          const message: FamilyMessage = {
            id: raw.id as string,
            syncId: raw.sync_id as string,
            deviceId: raw.device_id as string,
            version: (raw.version as number) || 1,
            chatId: raw.chat_id as string,
            senderId: raw.sender_id as string,
            senderName: raw.sender_name as string,
            senderRole: raw.sender_role as string,
            senderAvatar: (raw.sender_avatar as string) || undefined,
            receiverId: (raw.receiver_id as string) || undefined,
            content: raw.content as string,
            type: (raw.type as MessageType) || 'text',
            imageUrl: (raw.image_url as string) || undefined,
            fileUrl: (raw.file_url as string) || undefined,
            voiceUrl: (raw.voice_url as string) || undefined,
            fileMetadata,
            timestamp: raw.timestamp as string,
            read: (raw.read as boolean) || false,
            readBy: (raw.read_by as string[]) || [],
            familyCode: raw.family_code as string,
            reactions,
            replyTo: (raw.reply_to as string) || undefined,
            replyToPreview: (raw.reply_to_preview as string) || undefined,
            isEdited: (raw.is_edited as boolean) || false,
            editedAt: (raw.edited_at as string) || undefined,
            deliveryStatus: 'sent',
          };

          // ⭐ Read mutable state from refs — never from closure
          const chat = chatsRef.current.find(c => c.id === message.chatId);
          const isChatMuted = chat?.isMuted ?? false;

          setState(prev => {
            const existing = prev.messages[message.chatId] ?? [];
            if (existing.some(m => m.id === message.id || m.syncId === message.syncId)) {
              return prev;
            }
            const updatedMessages = {
              ...prev.messages,
              [message.chatId]: [...existing, message],
            };
            const updatedChats = prev.chats.map(c =>
              c.id === message.chatId
                ? {
                    ...c,
                    lastMessage: message,
                    updatedAt: message.timestamp,
                    unreadCount: isFromThisDevice ? c.unreadCount : (c.unreadCount || 0) + 1,
                  }
                : c,
            );
            return { ...prev, messages: updatedMessages, chats: updatedChats };
          });

          // Notification only when not self, not current chat, not muted
          const activeChatId = currentChatIdRef.current;
          if (
            !isFromThisDevice &&
            activeChatId !== message.chatId &&
            !isChatMuted &&
            message.type !== 'system'
          ) {
            notificationService
              .sendChatNotification(
                message.senderName,
                message.type === 'image'
                  ? '📷 Sent a photo'
                  : message.type === 'file'
                  ? '📎 Sent a file'
                  : message.type === 'voice'
                  ? '🎤 Sent a voice message'
                  : message.content,
                message.chatId,
              )
              .catch(err => console.warn('[FamilyChat] Notification failed:', err));
          }
        } catch (error) {
          console.error('[FamilyChat] Error processing INSERT:', error);
        }
      },
    );

    /* ─── UPDATE ─────────────────────────────────────────────── */
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'family_messages',
        filter: `family_code=eq.${familyCode}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const raw = payload.new as Record<string, unknown>;
        if (!raw) return;
        const messageId = raw.id as string;
        const chatId = raw.chat_id as string;
        const reactions = parseReactions(raw.reactions);

        setState(prev => {
          const chatMessages = prev.messages[chatId];
          if (!chatMessages) return prev;
          const updated = chatMessages.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  read: (raw.read as boolean) || false,
                  readBy: (raw.read_by as string[]) || [],
                  reactions: reactions.length > 0 ? reactions : msg.reactions,
                  content: (raw.content as string) || msg.content,
                  isEdited: (raw.is_edited as boolean) || msg.isEdited,
                  editedAt: (raw.edited_at as string) || msg.editedAt,
                }
              : msg,
          );
          return { ...prev, messages: { ...prev.messages, [chatId]: updated } };
        });
      },
    );

    /* ─── Typing Broadcast ───────────────────────────────────── */
    channel.on('broadcast', { event: 'typing' }, (payload: { payload: any }) => {
      const data = payload?.payload;
      if (!data || data.userId === deviceIdRef.current) return;

      setState(prev => {
        const current = prev.typingUsers[data.chatId] ?? [];
        const existingIdx = current.findIndex(t => t.userId === data.userId);
        let updated: TypingStatus[];
        if (data.isTyping) {
          const next: TypingStatus = {
            userId: data.userId,
            userName: data.userName || 'Family Member',
            chatId: data.chatId,
            isTyping: true,
            timestamp: data.timestamp || new Date().toISOString(),
          };
          if (existingIdx >= 0) {
            updated = [...current];
            updated[existingIdx] = next;
          } else {
            updated = [...current, next];
          }
        } else {
          updated = current.filter(t => t.userId !== data.userId);
        }
        return { ...prev, typingUsers: { ...prev.typingUsers, [data.chatId]: updated } };
      });
    });

    /* ─── Presence ───────────────────────────────────────────── */
    channel.on('presence', { event: 'sync' }, () => {
      // no-op; hook can be added later
    });

    /* ─── Subscribe ──────────────────────────────────────────── */
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
        reconnectAttemptsRef.current = 0;
        channel
          .track({
            user_id: userProfileRef.current?.id,
            user_name: userProfileRef.current?.fullName,
            device_id: deviceIdRef.current,
            online_at: new Date().toISOString(),
          })
          .catch(err => console.warn('[FamilyChat] Presence track failed:', err));
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        isSubscribedRef.current = false;
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          5000 * Math.pow(1.5, reconnectAttemptsRef.current - 1),
          30_000,
        );
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (realtimeChannelRef.current && !isSubscribedRef.current) {
            realtimeChannelRef.current.subscribe();
          }
        }, delay);
      }
    });

    realtimeChannelRef.current = channel;
    // ⭐ Deliberately no state deps — reads from refs
  }, []);

  /* ─── Perform Initial Sync ──────────────────────────────────── */
  const performInitialSync = useCallback(async () => {
    const familyCode = familyCodeRef.current;
    if (!familyCode) return;

    isInitializedRef.current = true;
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data: chatsData, error: chatsError } = await supabase
        .from('family_chats')
        .select('*')
        .eq('family_code', familyCode);

      if (chatsError) console.warn('[FamilyChat] Chats fetch error:', chatsError.message);

      const chats: FamilyChat[] = [];
      const messages: Record<string, FamilyMessage[]> = {};

      for (const chatRow of chatsData ?? []) {
        const chat: FamilyChat = {
          id: chatRow.id,
          type: chatRow.type,
          name: chatRow.name,
          participants: chatRow.participants ?? [],
          participantRoles: chatRow.participant_roles || {},
          participantNames: chatRow.participant_names || {},
          participantAvatars: chatRow.participant_avatars || {},
          unreadCount: chatRow.unread_count || 0,
          createdAt: chatRow.created_at,
          updatedAt: chatRow.updated_at,
          avatar: chatRow.avatar || undefined,
          isMuted: chatRow.is_muted || false,
          familyCode: chatRow.family_code,
          isPinned: chatRow.is_pinned || false,
          backgroundImage: chatRow.background_image || undefined,
        };
        chats.push(chat);

        const { data: msgData, error: msgError } = await supabase
          .from('family_messages')
          .select('*')
          .eq('chat_id', chat.id)
          .eq('family_code', familyCode)
          .order('timestamp', { ascending: true })
          .limit(100);

        if (!msgError && msgData) {
          messages[chat.id] = msgData.map(row => ({
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
            fileMetadata: parseFileMeta(row.file_metadata),
            timestamp: row.timestamp,
            read: row.read || false,
            readBy: row.read_by || [],
            familyCode: row.family_code,
            reactions: parseReactions(row.reactions),
            replyTo: row.reply_to || undefined,
            replyToPreview: row.reply_to_preview || undefined,
            isEdited: row.is_edited || false,
            editedAt: row.edited_at || undefined,
            deliveryStatus: 'sent',
          }));
          if (messages[chat.id].length > 0) {
            chat.lastMessage = messages[chat.id][messages[chat.id].length - 1];
          }
        }
      }

      // Sync refs immediately (avoid a render-time race)
      chatsRef.current = chats;
      messagesRef.current = messages;

      setState(prev => ({
        ...prev,
        chats,
        messages,
        isLoading: false,
        isSynced: true,
      }));

      setupRealtimeListeners();
    } catch (error) {
      console.error('[FamilyChat] Initial sync error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [setupRealtimeListeners]);

  /* ─── Kick off sync once family code is known ───────────────── */
  useEffect(() => {
    if (deviceIdRef.current && state.familyCode && !isInitializedRef.current) {
      performInitialSync();
    }
  }, [state.familyCode, performInitialSync]);

  /* ─── Setters ────────────────────────────────────────────────── */
  const setCurrentChatId = useCallback((chatId: string | null) => {
    setState(prev => ({ ...prev, currentChatId: chatId }));
  }, []);

  /* ─── Chat Management ───────────────────────────────────────── */

  const createFamilyGroup = useCallback(
    async (name?: string, avatar?: string): Promise<string> => {
      const familyCode = familyCodeRef.current;
      const me = userProfileRef.current;
      if (!familyCode || !me) return '';

      const chatId = `family_group_${familyCode}`;

      const { data: existing } = await supabase
        .from('family_chats')
        .select('id')
        .eq('id', chatId)
        .maybeSingle();

      if (existing) return chatId;

      const participantNames: Record<string, string> = {};
      const participantRoles: Record<string, string> = {};
      const participantAvatars: Record<string, string> = {};
      members.forEach(m => {
        participantRoles[m.id] = m.role;
        participantNames[m.id] = m.fullName;
        participantAvatars[m.id] = m.avatar || '👤';
      });

      const now = new Date().toISOString();
      const displayName = name || `${getCurrentBaby()?.name || 'Family'} Group`;

      const { error } = await supabase.from('family_chats').insert({
        id: chatId,
        type: 'group',
        name: displayName,
        participants: members.map(m => m.id),
        participant_roles: participantRoles,
        participant_names: participantNames,
        participant_avatars: participantAvatars,
        unread_count: 0,
        created_at: now,
        updated_at: now,
        avatar: avatar || '👨‍👩‍👧‍👦',
        is_muted: false,
        family_code: familyCode,
        is_pinned: true,
      });

      if (error) {
        console.error('[FamilyChat] Create group error:', error);
        sweetAlert.alert('Error', 'Failed to create family group', 'error');
        return '';
      }

      const welcomeMsg = createSystemMessage(
        chatId,
        `Welcome to ${getCurrentBaby()?.name || 'your baby'}'s family chat! 💕`,
        familyCode,
        deviceIdRef.current,
      );

      await supabase.from('family_messages').insert({
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

      const newChat: FamilyChat = {
        id: chatId,
        type: 'group',
        name: displayName,
        participants: members.map(m => m.id),
        participantRoles,
        participantNames,
        participantAvatars,
        unreadCount: 0,
        createdAt: now,
        updatedAt: now,
        avatar: avatar || '👨‍👩‍👧‍👦',
        isMuted: false,
        familyCode,
        isPinned: true,
      };

      setState(prev => ({
        ...prev,
        chats: [newChat, ...prev.chats],
        messages: { ...prev.messages, [chatId]: [welcomeMsg] },
      }));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return chatId;
    },
    [members, getCurrentBaby, sweetAlert],
  );

  const getOrCreateDirectChat = useCallback(
    async (memberId: string, memberInfo?: Partial<FamilyMember>): Promise<string> => {
      const familyCode = familyCodeRef.current;
      const me = userProfileRef.current;
      if (!familyCode || !me) return '';

      let actualUserId = memberId;
      let memberName = memberInfo?.fullName || '';
      let memberAvatar = memberInfo?.avatar || '👤';
      let memberRole = memberInfo?.role || 'guardian';

      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

      if (!isUUID) {
        const { data: row } = await supabase
          .from('family_members')
          .select('user_id, full_name, avatar, role')
          .eq('id', memberId)
          .maybeSingle();
        if (row?.user_id) {
          actualUserId = row.user_id;
          memberName = row.full_name || memberName;
          memberAvatar = row.avatar || memberAvatar;
          memberRole = row.role || memberRole;
        } else {
          const found = members.find(m => m.id === memberId);
          if (found) {
            actualUserId = found.userId || found.id;
            memberName = found.fullName;
            memberAvatar = found.avatar || '👤';
            memberRole = found.role || 'guardian';
          }
        }
      } else {
        const found = members.find(m => m.id === memberId || m.userId === memberId);
        if (found) {
          memberName = found.fullName;
          memberAvatar = found.avatar || '👤';
          memberRole = found.role || 'guardian';
        }
      }

      const { data: existing } = await supabase
        .from('family_chats')
        .select('*')
        .eq('family_code', familyCode)
        .eq('type', 'direct')
        .contains('participants', [me.id, actualUserId])
        .maybeSingle();

      if (existing) return existing.id;

      const chatId = `direct_${[me.id, actualUserId].sort().join('_')}`;
      const now = new Date().toISOString();

      const participantRoles: Record<string, string> = {
        [me.id]: me.role || 'parent1',
        [actualUserId]: memberRole,
      };
      const participantNames: Record<string, string> = {
        [me.id]: me.fullName,
        [actualUserId]: memberName || 'Family Member',
      };
      const participantAvatars: Record<string, string> = {
        [me.id]: me.avatar || '👤',
        [actualUserId]: memberAvatar,
      };

      const { error } = await supabase.from('family_chats').insert({
        id: chatId,
        type: 'direct',
        name: memberName || 'Family Member',
        participants: [me.id, actualUserId],
        participant_roles: participantRoles,
        participant_names: participantNames,
        participant_avatars: participantAvatars,
        unread_count: 0,
        created_at: now,
        updated_at: now,
        avatar: memberAvatar,
        is_muted: false,
        family_code: familyCode,
        is_pinned: false,
      });

      if (error) {
        console.error('[FamilyChat] Create direct chat error:', error);
        sweetAlert.alert('Error', 'Failed to create chat: ' + error.message, 'error');
        return '';
      }

      const newChat: FamilyChat = {
        id: chatId,
        type: 'direct',
        name: memberName || 'Family Member',
        participants: [me.id, actualUserId],
        participantRoles,
        participantNames,
        participantAvatars,
        unreadCount: 0,
        createdAt: now,
        updatedAt: now,
        avatar: memberAvatar,
        isMuted: false,
        familyCode,
        isPinned: false,
      };

      setState(prev => ({ ...prev, chats: [newChat, ...prev.chats] }));
      return chatId;
    },
    [members, sweetAlert],
  );

  /* ─── Send Message ──────────────────────────────────────────── */

  const sendMessage = useCallback(
    async (
      chatId: string,
      content: string,
      type: MessageType = 'text',
      mediaData?: string,
      fileMeta?: FileMetadata,
      replyToId?: string,
    ): Promise<void> => {
      const familyCode = familyCodeRef.current;
      const me = userProfileRef.current;
      if (!familyCode || !me) {
        sweetAlert.alert('Error', 'You must be logged in to send messages', 'info');
        return;
      }

      const chat = chatsRef.current.find(c => c.id === chatId);
      if (!chat) {
        sweetAlert.alert('Error', 'Chat not found', 'error');
        return;
      }

      if (chat.type === 'direct') {
        const otherId = chat.participants.find(p => p !== me.id);
        if (otherId && state.blockedUsers.includes(otherId)) {
          sweetAlert.alert('Blocked', 'You have blocked this user.', 'warning');
          return;
        }
      }

      const syncId = Crypto.randomUUID();
      const now = new Date().toISOString();

      let replyToPreview: string | undefined;
      if (replyToId) {
        const replied = messagesRef.current[chatId]?.find(m => m.id === replyToId);
        replyToPreview = replied ? replied.content.slice(0, 60) || 'Media' : undefined;
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const newMessage: FamilyMessage = {
        id: messageId,
        syncId,
        deviceId: deviceIdRef.current,
        version: 1,
        chatId,
        senderId: me.id,
        senderName: me.fullName,
        senderRole: me.role || 'parent1',
        senderAvatar: me.avatar,
        content,
        type,
        imageUrl: type === 'image' ? mediaData : undefined,
        fileUrl: type === 'file' ? mediaData : undefined,
        voiceUrl: type === 'voice' ? mediaData : undefined,
        fileMetadata: type === 'file' ? fileMeta : undefined,
        timestamp: now,
        read: false,
        readBy: [me.id],
        familyCode,
        reactions: [],
        replyTo: replyToId,
        replyToPreview,
        deliveryStatus: 'sending',
      };

      // Optimistic local insert
      setState(prev => {
        const updatedChats = prev.chats.map(c =>
          c.id === chatId ? { ...c, lastMessage: newMessage, updatedAt: now } : c,
        );
        return {
          ...prev,
          chats: updatedChats,
          messages: {
            ...prev.messages,
            [chatId]: [...(prev.messages[chatId] ?? []), newMessage],
          },
        };
      });

      try {
        const insertData: Record<string, unknown> = {
          id: newMessage.id,
          sync_id: newMessage.syncId,
          device_id: newMessage.deviceId,
          version: newMessage.version,
          chat_id: newMessage.chatId,
          sender_id: newMessage.senderId,
          sender_name: newMessage.senderName,
          sender_role: newMessage.senderRole,
          sender_avatar: newMessage.senderAvatar ?? null,
          content: newMessage.content,
          type: newMessage.type,
          timestamp: newMessage.timestamp,
          read: newMessage.read,
          read_by: newMessage.readBy,
          family_code: newMessage.familyCode,
          reactions: JSON.stringify(newMessage.reactions ?? []),
          delivery_status: 'sent',
          created_at: now,
        };
        if (newMessage.imageUrl) insertData.image_url = newMessage.imageUrl;
        if (newMessage.fileUrl) insertData.file_url = newMessage.fileUrl;
        if (newMessage.voiceUrl) insertData.voice_url = newMessage.voiceUrl;
        if (newMessage.fileMetadata) insertData.file_metadata = JSON.stringify(newMessage.fileMetadata);
        if (newMessage.replyTo) insertData.reply_to = newMessage.replyTo;
        if (newMessage.replyToPreview) insertData.reply_to_preview = newMessage.replyToPreview;

        const { error } = await supabase.from('family_messages').insert(insertData);
        if (error) throw error;

        await supabase
          .from('family_chats')
          .update({ last_message_id: newMessage.id, updated_at: now })
          .eq('id', chatId);

        setState(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: (prev.messages[chatId] ?? []).map(m =>
              m.id === newMessage.id ? { ...m, deliveryStatus: 'sent' } : m,
            ),
          },
        }));

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch (error) {
        console.error('[FamilyChat] Send message error:', error);
        setState(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: (prev.messages[chatId] ?? []).map(m =>
              m.id === newMessage.id ? { ...m, deliveryStatus: 'failed' } : m,
            ),
          },
        }));
        sweetAlert.alert('Error', 'Failed to send message. Please try again.', 'error');
      }
    },
    [state.blockedUsers, sweetAlert],
  );

  /* ─── Resend / Edit / Delete / Clear ─────────────────────────── */

  const resendMessage = useCallback(
    async (chatId: string, messageId: string): Promise<void> => {
      const message = messagesRef.current[chatId]?.find(m => m.id === messageId);
      if (!message || message.deliveryStatus !== 'failed') return;

      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: (prev.messages[chatId] ?? []).map(m =>
            m.id === messageId ? { ...m, deliveryStatus: 'sending' } : m,
          ),
        },
      }));

      try {
        const { error } = await supabase
          .from('family_messages')
          .update({ delivery_status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', messageId);
        if (error) throw error;

        setState(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: (prev.messages[chatId] ?? []).map(m =>
              m.id === messageId ? { ...m, deliveryStatus: 'sent' } : m,
            ),
          },
        }));
      } catch {
        setState(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: (prev.messages[chatId] ?? []).map(m =>
              m.id === messageId ? { ...m, deliveryStatus: 'failed' } : m,
            ),
          },
        }));
      }
    },
    [],
  );

  const editMessage = useCallback(
    async (chatId: string, messageId: string, newContent: string) => {
      const me = userProfileRef.current;
      if (!me) return;
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('family_messages')
        .update({ content: newContent, is_edited: true, edited_at: now, updated_at: now })
        .eq('id', messageId)
        .eq('sender_id', me.id);

      if (error) {
        sweetAlert.alert('Error', 'Failed to edit message', 'error');
        return;
      }

      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: (prev.messages[chatId] ?? []).map(m =>
            m.id === messageId ? { ...m, content: newContent, isEdited: true, editedAt: now } : m,
          ),
        },
      }));
    },
    [sweetAlert],
  );

  const markChatRead = useCallback(
    async (chatId: string) => {
      const me = userProfileRef.current;
      if (!me) return;

      const msgs = messagesRef.current[chatId] ?? [];
      const unread = msgs.filter(m => !m.readBy.includes(me.id));
      if (unread.length === 0) {
        // Still reset local unread badge
        setState(prev => ({
          ...prev,
          chats: prev.chats.map(c => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
        }));
        return;
      }

      // ⭐ Batch: single update for all unread rows
      const ids = unread.map(m => m.id);
      const { error } = await supabase
        .from('family_messages')
        .update({
          read: true,
          read_by: [...new Set([...unread.flatMap(m => m.readBy), me.id])],
        })
        .in('id', ids);

      if (error) {
        console.warn('[FamilyChat] markChatRead error:', error);
      }

      setState(prev => {
        const updatedMessages = (prev.messages[chatId] ?? []).map(m =>
          ids.includes(m.id) && !m.readBy.includes(me.id)
            ? { ...m, read: true, readBy: [...m.readBy, me.id] }
            : m,
        );
        const updatedChats = prev.chats.map(c =>
          c.id === chatId ? { ...c, unreadCount: 0 } : c,
        );
        return { ...prev, chats: updatedChats, messages: { ...prev.messages, [chatId]: updatedMessages } };
      });
    },
    [],
  );

  const deleteMessage = useCallback(
    async (chatId: string, messageId: string) => {
      const me = userProfileRef.current;
      if (!me) return;
      const message = messagesRef.current[chatId]?.find(m => m.id === messageId);
      if (!message) return;

      if (message.senderId !== me.id && me.role !== 'parent1') {
        sweetAlert.alert('Permission Denied', 'You can only delete your own messages', 'warning');
        return;
      }

      const { error } = await supabase.from('family_messages').delete().eq('id', messageId);
      if (error) {
        sweetAlert.alert('Error', 'Failed to delete message', 'error');
        return;
      }

      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: (prev.messages[chatId] ?? []).filter(m => m.id !== messageId),
        },
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [sweetAlert],
  );

  const clearChat = useCallback(
    async (chatId: string) => {
      const familyCode = familyCodeRef.current;
      const me = userProfileRef.current;
      if (!familyCode || !me) return;
      if (me.role !== 'parent1') {
        sweetAlert.alert('Permission Denied', 'Only Parent 1 can clear the chat', 'warning');
        return;
      }

      const { error } = await supabase
        .from('family_messages')
        .delete()
        .eq('chat_id', chatId)
        .eq('family_code', familyCode);

      if (error) {
        sweetAlert.alert('Error', 'Failed to clear chat', 'error');
        return;
      }
      setState(prev => ({ ...prev, messages: { ...prev.messages, [chatId]: [] } }));
    },
    [sweetAlert],
  );

  /* ─── Image / File Picker ───────────────────────────────────── */

  const pickAndSendImage = useCallback(
    async (chatId: string, fromCamera = false): Promise<void> => {
      const familyCode = familyCodeRef.current;
      if (!familyCode) return;

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
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
        }

        if (result.canceled || !result.assets?.[0]) return;
        const uri = result.assets[0].uri;
        const ext = uri.split('.').pop() || 'jpg';
        const storagePath = `chat_images/${familyCode}/${Date.now()}.${ext}`;

        const fileData = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(storagePath, decode(fileData), { contentType: `image/${ext}` });

        if (uploadError) {
          sweetAlert.alert('Error', 'Failed to upload image', 'error');
          return;
        }

        const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(storagePath);
        await sendMessage(chatId, '📷 Photo', 'image', urlData.publicUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (error) {
        console.error('[FamilyChat] Pick image error:', error);
        sweetAlert.alert('Error', 'Failed to send image', 'error');
      }
    },
    [sendMessage, sweetAlert],
  );

  const pickAndSendFile = useCallback(
    async (chatId: string): Promise<void> => {
      const familyCode = familyCodeRef.current;
      if (!familyCode) return;

      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0];

        const info = await FileSystem.getInfoAsync(asset.uri);
        const size = info.exists && 'size' in info ? info.size : 0;

        const storagePath = `chat_files/${familyCode}/${Date.now()}_${asset.name}`;
        const fileData = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: uploadError } = await supabase.storage
          .from('chat_files')
          .upload(storagePath, decode(fileData), {
            contentType: asset.mimeType || 'application/octet-stream',
          });

        if (uploadError) {
          sweetAlert.alert('Error', 'Failed to upload file', 'error');
          return;
        }

        const { data: urlData } = supabase.storage.from('chat_files').getPublicUrl(storagePath);

        const fileMeta: FileMetadata = {
          name: asset.name || 'Unknown file',
          size,
          type: asset.mimeType || 'application/octet-stream',
          uri: asset.uri,
        };

        await sendMessage(chatId, `📎 ${asset.name}`, 'file', urlData.publicUrl, fileMeta);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (error) {
        console.error('[FamilyChat] File pick error:', error);
        sweetAlert.alert('Error', 'Failed to send file', 'error');
      }
    },
    [sendMessage, sweetAlert],
  );

  /* ─── Reactions ─────────────────────────────────────────────── */

  const addReaction = useCallback(
    async (chatId: string, messageId: string, emoji: string) => {
      const me = userProfileRef.current;
      if (!me) return;
      const message = messagesRef.current[chatId]?.find(m => m.id === messageId);
      if (!message) return;

      const existing = message.reactions ?? [];
      const idx = existing.findIndex(r => r.userId === me.id && r.emoji === emoji);
      const updated =
        idx >= 0
          ? existing.filter((_, i) => i !== idx)
          : [...existing, { emoji, userId: me.id, userName: me.fullName }];

      const { error } = await supabase
        .from('family_messages')
        .update({ reactions: JSON.stringify(updated), updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) return;

      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: (prev.messages[chatId] ?? []).map(m =>
            m.id === messageId ? { ...m, reactions: updated } : m,
          ),
        },
      }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [],
  );

  const removeReaction = useCallback(
    async (chatId: string, messageId: string, emoji: string) => {
      const me = userProfileRef.current;
      if (!me) return;
      const message = messagesRef.current[chatId]?.find(m => m.id === messageId);
      if (!message) return;

      const updated = (message.reactions ?? []).filter(
        r => !(r.userId === me.id && r.emoji === emoji),
      );

      const { error } = await supabase
        .from('family_messages')
        .update({ reactions: JSON.stringify(updated), updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) return;

      setState(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: (prev.messages[chatId] ?? []).map(m =>
            m.id === messageId ? { ...m, reactions: updated } : m,
          ),
        },
      }));
    },
    [],
  );

  /* ─── Typing ────────────────────────────────────────────────── */

  const setTypingStatus = useCallback((chatId: string, isTyping: boolean) => {
    const me = userProfileRef.current;
    if (!me) return;

    const key = `${chatId}_${me.id}`;
    if (typingTimeoutRef.current[key]) clearTimeout(typingTimeoutRef.current[key]);

    setState(prev => {
      const current = prev.typingUsers[chatId] ?? [];
      const idx = current.findIndex(t => t.userId === me.id);
      let updated: TypingStatus[];
      if (isTyping) {
        const next: TypingStatus = {
          userId: me.id,
          userName: me.fullName,
          chatId,
          isTyping: true,
          timestamp: new Date().toISOString(),
        };
        if (idx >= 0) {
          updated = [...current];
          updated[idx] = next;
        } else {
          updated = [...current, next];
        }
      } else {
        updated = current.filter(t => t.userId !== me.id);
      }
      return {
        ...prev,
        typingUsers: { ...prev.typingUsers, [chatId]: updated },
        currentUserTyping: isTyping,
      };
    });

    if (familyCodeRef.current && realtimeChannelRef.current && isSubscribedRef.current) {
      realtimeChannelRef.current
        .send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId: me.id,
            userName: me.fullName,
            chatId,
            isTyping,
            timestamp: new Date().toISOString(),
          },
        })
        .catch(() => {});
    }

    if (isTyping) {
      typingTimeoutRef.current[key] = setTimeout(() => setTypingStatus(chatId, false), 3000);
    }
  }, []);

  const isUserTyping = useCallback(
    (chatId: string, userId: string) =>
      (state.typingUsers[chatId] ?? []).some(t => t.userId === userId && t.isTyping),
    [state.typingUsers],
  );

  const getTypingUsers = useCallback(
    (chatId: string) => state.typingUsers[chatId] ?? [],
    [state.typingUsers],
  );

  /* ─── Chat Settings ─────────────────────────────────────────── */

  const muteChat = useCallback(async (chatId: string, muted: boolean) => {
    const { error } = await supabase
      .from('family_chats')
      .update({ is_muted: muted, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) return;
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c => (c.id === chatId ? { ...c, isMuted: muted } : c)),
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const pinChat = useCallback(async (chatId: string, pinned: boolean) => {
    const { error } = await supabase
      .from('family_chats')
      .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) return;
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c => (c.id === chatId ? { ...c, isPinned: pinned } : c)),
    }));
  }, []);

  const setChatBackground = useCallback(async (chatId: string, imageUri: string | null) => {
    const { error } = await supabase
      .from('family_chats')
      .update({ background_image: imageUri, updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (error) return;
    setState(prev => ({
      ...prev,
      chats: prev.chats.map(c =>
        c.id === chatId ? { ...c, backgroundImage: imageUri || undefined } : c,
      ),
    }));
  }, []);

  const leaveChat = useCallback(
    async (chatId: string) => {
      const familyCode = familyCodeRef.current;
      const me = userProfileRef.current;
      if (!familyCode || !me) return;
      const chat = chatsRef.current.find(c => c.id === chatId);
      if (!chat || chat.type === 'group') {
        sweetAlert.alert('Cannot Leave', 'You cannot leave the family group chat', 'info');
        return;
      }
      const updatedParticipants = chat.participants.filter(p => p !== me.id);
      const { error } = await supabase
        .from('family_chats')
        .update({ participants: updatedParticipants, updated_at: new Date().toISOString() })
        .eq('id', chatId);
      if (error) {
        sweetAlert.alert('Error', 'Failed to leave chat', 'error');
        return;
      }
      setState(prev => ({ ...prev, chats: prev.chats.filter(c => c.id !== chatId) }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [sweetAlert],
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      const familyCode = familyCodeRef.current;
      const me = userProfileRef.current;
      if (!familyCode || !me) return;
      if (me.role !== 'parent1') {
        sweetAlert.alert('Permission Denied', 'Only Parent 1 can delete chats', 'warning');
        return;
      }

      const { error } = await supabase
        .from('family_chats')
        .delete()
        .eq('id', chatId)
        .eq('family_code', familyCode);
      if (error) {
        sweetAlert.alert('Error', 'Failed to delete chat', 'error');
        return;
      }
      await supabase.from('family_messages').delete().eq('chat_id', chatId);

      setState(prev => {
        const nextMessages = { ...prev.messages };
        delete nextMessages[chatId];
        return { ...prev, chats: prev.chats.filter(c => c.id !== chatId), messages: nextMessages };
      });
    },
    [sweetAlert],
  );

  /* ─── Family Code ───────────────────────────────────────────── */

  const shareFamilyCode = useCallback(async () => {
    const code = familyCodeRef.current || generateFamilyCodeString();
    try {
      await Share.share({
        message: `Join my family on LittleLoom! Use code: ${code}`,
        title: 'Join My Family on LittleLoom',
      });
    } catch (error) {
      console.warn('[FamilyChat] Share error:', error);
    }
  }, []);

  const joinFamilyByCode = useCallback(
    async (code: string): Promise<boolean> => {
      try {
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

        await supabase
          .from('app_settings')
          .upsert(
            {
              key: 'family_code',
              value: code,
              user_id: userProfileRef.current?.id ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key,user_id' },
          );

        if (userProfileRef.current && !chatData.participants.includes(userProfileRef.current.id)) {
          const me = userProfileRef.current;
          const updatedNames = { ...chatData.participant_names, [me.id]: me.fullName };
          const updatedRoles = { ...chatData.participant_roles, [me.id]: me.role || 'guardian' };
          const updatedAvatars = { ...chatData.participant_avatars, [me.id]: me.avatar || '👤' };

          await supabase
            .from('family_chats')
            .update({
              participants: [...chatData.participants, me.id],
              participant_names: updatedNames,
              participant_roles: updatedRoles,
              participant_avatars: updatedAvatars,
              updated_at: new Date().toISOString(),
            })
            .eq('id', chatData.id);

          const welcome = createSystemMessage(
            chatData.id,
            `👋 ${me.fullName} joined the family`,
            code,
            deviceIdRef.current,
          );
          await supabase.from('family_messages').insert({
            id: welcome.id,
            sync_id: welcome.syncId,
            device_id: welcome.deviceId,
            version: welcome.version,
            chat_id: welcome.chatId,
            sender_id: welcome.senderId,
            sender_name: welcome.senderName,
            sender_role: welcome.senderRole,
            sender_avatar: welcome.senderAvatar,
            content: welcome.content,
            type: welcome.type,
            timestamp: welcome.timestamp,
            read: welcome.read,
            read_by: welcome.readBy,
            family_code: welcome.familyCode,
            delivery_status: welcome.deliveryStatus,
          });
        }

        familyCodeRef.current = code;
        setState(prev => ({ ...prev, familyCode: code }));
        await performInitialSync();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return true;
      } catch (error) {
        console.error('[FamilyChat] Join family error:', error);
        sweetAlert.alert('Error', 'Failed to join family', 'error');
        return false;
      }
    },
    [performInitialSync, sweetAlert],
  );

  /* ─── Block User ────────────────────────────────────────────── */

  const blockUser = useCallback(async (userId: string) => {
    setState(prev => {
      const isBlocked = prev.blockedUsers.includes(userId);
      const updated = isBlocked
        ? prev.blockedUsers.filter(id => id !== userId)
        : [...prev.blockedUsers, userId];

      if (prev.familyCode) {
        AsyncStorage.setItem(
          `@littleloom_blocked_${prev.familyCode}`,
          JSON.stringify(updated),
        ).catch(() => {});
      }
      return { ...prev, blockedUsers: updated };
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, []);

  const isUserBlocked = useCallback(
    (userId: string) => state.blockedUsers.includes(userId),
    [state.blockedUsers],
  );

  /* ─── Getters ───────────────────────────────────────────────── */

  const getChatMessages = useCallback(
    (chatId: string) => messagesRef.current[chatId] ?? [],
    [],
  );

  const getMessageById = useCallback(
    (chatId: string, messageId: string) =>
      messagesRef.current[chatId]?.find(m => m.id === messageId),
    [],
  );

  const getChatById = useCallback(
    (chatId: string) => chatsRef.current.find(c => c.id === chatId),
    [],
  );

  const getFamilyCode = useCallback(() => familyCodeRef.current, []);

  const getUnreadCount = useCallback(
    (chatId?: string): number => {
      if (chatId) {
        const chat = chatsRef.current.find(c => c.id === chatId);
        return chat?.isMuted ? 0 : chat?.unreadCount ?? 0;
      }
      return chatsRef.current.reduce(
        (total, chat) => total + (chat.isMuted ? 0 : chat.unreadCount),
        0,
      );
    },
    [],
  );

  const getMemberChatInfo = useCallback(
    (memberId: string): { name: string; avatar: string; role: string } | null => {
      const member = members.find(m => m.id === memberId);
      if (!member) return null;
      return { name: member.fullName, avatar: member.avatar || '👤', role: member.role };
    },
    [members],
  );

  const searchMessages = useCallback((chatId: string, query: string) => {
    const all = messagesRef.current[chatId] ?? [];
    const q = query.toLowerCase();
    return all.filter(
      m => m.content.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q),
    );
  }, []);

  const syncFamilyData = useCallback(async () => {
    isInitializedRef.current = false;
    await performInitialSync();
  }, [performInitialSync]);

  const forceSync = useCallback(async () => {
    isInitializedRef.current = false;
    isSubscribedRef.current = false;
    await performInitialSync();
  }, [performInitialSync]);

  /* ─── Context Value ─────────────────────────────────────────── */

  const value = useMemo<FamilyChatContextType>(
    () => ({
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
      generateFamilyCode: generateFamilyCodeString,
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
      setCurrentChatId,
    }),
    [
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
      setCurrentChatId,
    ],
  );

  return <FamilyChatContext.Provider value={value}>{children}</FamilyChatContext.Provider>;
};

export const useFamilyChat = (): FamilyChatContextType => {
  const context = useContext(FamilyChatContext);
  if (!context) throw new Error('useFamilyChat must be used within FamilyChatProvider');
  return context;
};

export default FamilyChatProvider;