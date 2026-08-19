import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseMessage = {
  id: string;
  sync_id: string;
  device_id: string;
  version: number;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_avatar?: string;
  receiver_id?: string;
  content: string;
  type: string;
  image_url?: string;
  file_url?: string;
  voice_url?: string;
  file_metadata?: any;
  timestamp: string;
  read: boolean;
  read_by: string[];
  family_code: string;
  reactions: any[];
  reply_to?: string;
  reply_to_preview?: string;
  is_edited: boolean;
  edited_at?: string;
  delivery_status: string;
  created_at?: string;
};