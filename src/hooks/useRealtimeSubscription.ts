// hooks/useSupabase.ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useSupabase() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (mounted) setIsLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    // Check connection status
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('health_check').select('*').limit(1);
        if (mounted) {
          setIsConnected(!error);
        }
      } catch {
        if (mounted) {
          setIsConnected(false);
        }
      }
    };

    checkConnection();

    // Periodically check connection
    const interval = setInterval(checkConnection, 30000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      return session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  }, []);

  return {
    session,
    user,
    isConnected,
    isLoading,
    signOut,
    refreshSession,
    supabase,
  };
}