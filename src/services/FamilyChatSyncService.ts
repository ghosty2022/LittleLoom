import { supabase, SupabaseMessage } from './supabaseClient';
import { FamilyMessage, FamilyChat, TypingStatus } from '../context/FamilyChatContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  LAST_SYNC: '@littleloom_last_sync_timestamp',
  SYNCED_MESSAGE_IDS: '@littleloom_synced_message_ids',
};

export class FamilyChatSyncService {
  private familyCode: string | null = null;
  private deviceId: string;
  private isSubscribed: boolean = false;
  private messageCallbacks: ((messages: FamilyMessage[]) => void)[] = [];
  private chatCallbacks: ((chats: FamilyChat[]) => void)[] = [];
  private typingCallbacks: ((data: any) => void)[] = [];

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  setFamilyCode(code: string) {
    this.familyCode = code;
  }

  // ─── Message Sync ────────────────────────────────────────────

  async pushMessages(messages: FamilyMessage[]): Promise<void> {
    if (!this.familyCode) return;

    const supabaseMessages = messages.map(msg => this.toSupabaseFormat(msg));
    
    const { error } = await supabase
      .from('family_messages')
      .upsert(supabaseMessages, { 
        onConflict: 'sync_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Error pushing messages:', error);
      throw error;
    }

    const syncedIds = messages.map(m => m.syncId);
    await this.markSynced(syncedIds);
  }

  async pullRemoteMessages(chatId?: string): Promise<FamilyMessage[]> {
    if (!this.familyCode) return [];

    let query = supabase
      .from('family_messages')
      .select('*')
      .eq('family_code', this.familyCode)
      .order('timestamp', { ascending: true });

    if (chatId) {
      query = query.eq('chat_id', chatId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error pulling remote messages:', error);
      return [];
    }

    return (data || []).map(msg => this.fromSupabaseFormat(msg));
  }

  // ─── Real-Time Subscriptions ────────────────────────────────

  subscribeToMessages(chatId?: string): void {
    if (this.isSubscribed || !this.familyCode) return;

    let filter = `family_code=eq.${this.familyCode}`;
    if (chatId) {
      filter += `,chat_id=eq.${chatId}`;
    }

    supabase
      .channel('family_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_messages',
          filter: filter,
        },
        (payload) => {
          const message = this.fromSupabaseFormat(payload.new as SupabaseMessage);
          if (message.deviceId === this.deviceId) return;
          this.messageCallbacks.forEach(cb => cb([message]));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'family_messages',
          filter: filter,
        },
        (payload) => {
          const message = this.fromSupabaseFormat(payload.new as SupabaseMessage);
          if (message.deviceId === this.deviceId) return;
          this.messageCallbacks.forEach(cb => cb([message]));
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
        this.isSubscribed = status === 'SUBSCRIBED';
      });

    this.subscribeToTyping();
  }

  private subscribeToTyping(): void {
    if (!this.familyCode) return;

    supabase
      .channel('typing_status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `family_code=eq.${this.familyCode}`,
        },
        (payload) => {
          this.typingCallbacks.forEach(cb => cb(payload.new));
        }
      )
      .subscribe();
  }

  // ─── Typing Status ────────────────────────────────────────────

  async broadcastTyping(chatId: string, isTyping: boolean): Promise<void> {
    if (!this.familyCode) return;

    const { error } = await supabase
      .from('typing_status')
      .upsert({
        user_id: this.deviceId,
        chat_id: chatId,
        family_code: this.familyCode,
        is_typing: isTyping,
        timestamp: new Date().toISOString(),
      }, { onConflict: 'user_id,chat_id' });

    if (error) console.error('Error broadcasting typing:', error);
  }

  // ─── Message Status Updates ──────────────────────────────────

  async markMessageRead(chatId: string, messageId: string, userId: string): Promise<void> {
    if (!this.familyCode) return;

    const { data } = await supabase
      .from('family_messages')
      .select('read_by')
      .eq('id', messageId)
      .single();

    const readBy = data?.read_by || [];
    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }

    const { error } = await supabase
      .from('family_messages')
      .update({ 
        read_by: readBy,
        read: true,
      })
      .eq('id', messageId);

    if (error) console.error('Error marking message read:', error);
  }

  // ─── Chat Sync ───────────────────────────────────────────────

  async pushChats(chats: FamilyChat[]): Promise<void> {
    if (!this.familyCode) return;

    const supabaseChats = chats.map(chat => ({
      id: chat.id,
      type: chat.type,
      name: chat.name,
      participants: chat.participants,
      participant_roles: chat.participantRoles || {},
      participant_names: chat.participantNames || {},
      participant_avatars: chat.participantAvatars || {},
      last_message_id: chat.lastMessage?.id || null,
      unread_count: chat.unreadCount,
      created_at: chat.createdAt,
      updated_at: chat.updatedAt,
      avatar: chat.avatar || null,
      is_muted: chat.isMuted,
      family_code: chat.familyCode,
      is_pinned: chat.isPinned || false,
      background_image: chat.backgroundImage || null,
    }));

    const { error } = await supabase
      .from('family_chats')
      .upsert(supabaseChats, { onConflict: 'id' });

    if (error) console.error('Error pushing chats:', error);
  }

  async pullChats(): Promise<FamilyChat[]> {
    if (!this.familyCode) return [];

    const { data, error } = await supabase
      .from('family_chats')
      .select('*')
      .eq('family_code', this.familyCode);

    if (error) {
      console.error('Error pulling chats:', error);
      return [];
    }

    return (data || []).map(chat => ({
      id: chat.id,
      type: chat.type,
      name: chat.name,
      participants: chat.participants || [],
      participantRoles: chat.participant_roles || {},
      participantNames: chat.participant_names || {},
      participantAvatars: chat.participant_avatars || {},
      unreadCount: chat.unread_count || 0,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      avatar: chat.avatar || undefined,
      isMuted: chat.is_muted || false,
      familyCode: chat.family_code,
      isPinned: chat.is_pinned || false,
      backgroundImage: chat.background_image || undefined,
      lastMessage: undefined,
    }));
  }

  // ─── Local Sync State ────────────────────────────────────────

  private async markSynced(messageIds: string[]): Promise<void> {
    const key = `${STORAGE_KEYS.SYNCED_MESSAGE_IDS}_${this.familyCode}`;
    const existing = await AsyncStorage.getItem(key);
    const synced: string[] = existing ? JSON.parse(existing) : [];
    const updated = [...new Set([...synced, ...messageIds])];
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  }

  async getLastSyncTime(): Promise<string | null> {
    const key = `${STORAGE_KEYS.LAST_SYNC}_${this.familyCode}`;
    return await AsyncStorage.getItem(key);
  }

  async updateLastSyncTime(): Promise<void> {
    const key = `${STORAGE_KEYS.LAST_SYNC}_${this.familyCode}`;
    await AsyncStorage.setItem(key, new Date().toISOString());
  }

  // ─── Callbacks ───────────────────────────────────────────────

  onMessages(callback: (messages: FamilyMessage[]) => void) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  onChats(callback: (chats: FamilyChat[]) => void) {
    this.chatCallbacks.push(callback);
    return () => {
      this.chatCallbacks = this.chatCallbacks.filter(cb => cb !== callback);
    };
  }

  onTyping(callback: (data: any) => void) {
    this.typingCallbacks.push(callback);
    return () => {
      this.typingCallbacks = this.typingCallbacks.filter(cb => cb !== callback);
    };
  }

  // ─── Format Converters ──────────────────────────────────────

  private toSupabaseFormat(msg: FamilyMessage): any {
    return {
      id: msg.id,
      sync_id: msg.syncId,
      device_id: msg.deviceId,
      version: msg.version || 1,
      chat_id: msg.chatId,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
      sender_role: msg.senderRole,
      sender_avatar: msg.senderAvatar || null,
      receiver_id: msg.receiverId || null,
      content: msg.content,
      type: msg.type,
      image_url: msg.imageUrl || null,
      file_url: msg.fileUrl || null,
      voice_url: msg.voiceUrl || null,
      file_metadata: msg.fileMetadata || null,
      timestamp: msg.timestamp,
      read: msg.read || false,
      read_by: msg.readBy || [],
      family_code: msg.familyCode,
      reactions: msg.reactions || [],
      reply_to: msg.replyTo || null,
      reply_to_preview: msg.replyToPreview || null,
      is_edited: msg.isEdited || false,
      edited_at: msg.editedAt || null,
      delivery_status: msg.deliveryStatus || 'sent',
    };
  }

  private fromSupabaseFormat(data: SupabaseMessage): FamilyMessage {
    return {
      id: data.id,
      syncId: data.sync_id,
      deviceId: data.device_id,
      version: data.version || 1,
      chatId: data.chat_id,
      senderId: data.sender_id,
      senderName: data.sender_name,
      senderRole: data.sender_role,
      senderAvatar: data.sender_avatar || undefined,
      receiverId: data.receiver_id || undefined,
      content: data.content,
      type: data.type as any,
      imageUrl: data.image_url || undefined,
      fileUrl: data.file_url || undefined,
      voiceUrl: data.voice_url || undefined,
      fileMetadata: data.file_metadata || undefined,
      timestamp: data.timestamp,
      read: data.read || false,
      readBy: data.read_by || [],
      familyCode: data.family_code,
      reactions: data.reactions || [],
      replyTo: data.reply_to || undefined,
      replyToPreview: data.reply_to_preview || undefined,
      isEdited: data.is_edited || false,
      editedAt: data.edited_at || undefined,
      deliveryStatus: data.delivery_status as any,
    };
  }

  // ─── Cleanup ────────────────────────────────────────────────

  unsubscribe(): void {
    this.isSubscribed = false;
    supabase.removeAllChannels();
    this.messageCallbacks = [];
    this.chatCallbacks = [];
    this.typingCallbacks = [];
  }
}