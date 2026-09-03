// src/hooks/useSupabase.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface SupabaseState {
  isConnected: boolean;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

export function useSupabase() {
  const [state, setState] = useState<SupabaseState>({
    isConnected: false,
    user: null,
    session: null,
    isLoading: true,
  });

  // Check connection and get user
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Test connection with a lightweight query
        const { error } = await supabase.from('tracker_entries').select('id').limit(1);
        const isConnected = !error;

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        setState({
          isConnected,
          user: user || null,
          session: session || null,
          isLoading: false,
        });
      } catch (err) {
        console.warn('Supabase connection check failed:', err);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isLoading: false,
        }));
      }
    };

    checkConnection();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setState(prev => ({
        ...prev,
        user: session?.user || null,
        session: session || null,
      }));
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Refresh connection status
  const refreshConnection = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const { error } = await supabase.from('tracker_entries').select('id').limit(1);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      setState({
        isConnected: !error,
        user: user || null,
        session: session || null,
        isLoading: false,
      });
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, isConnected: false }));
    }
  }, []);

  return {
    ...state,
    supabase,
    refreshConnection,
  };
}

export default useSupabase;