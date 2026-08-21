// src/context/DatabaseContext.tsx
// Full Supabase - No local DB initialization needed

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, AppState } from 'react-native';
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
  retry: () => void;
  isOnline: boolean;
  userId: string | null;
  session: any | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isReady: true,
  error: null,
  retry: () => {},
  isOnline: true,
  userId: null,
  session: null,
  refreshSession: async () => {},
  signOut: async () => {},
});

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const appStateSubscriptionRef = useRef<any>(null);
  const initRef = useRef(false);

  // Check Supabase connection and session
  const checkConnection = useCallback(async () => {
    try {
      // Get current session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('[DatabaseContext] Supabase session check failed:', sessionError.message);
        setError(new Error('Supabase session issue'));
        setIsReady(false);
        return;
      }

      // Check if we have a valid session
      if (currentSession?.user) {
        setUserId(currentSession.user.id);
        setSession(currentSession);
        setError(null);
        setIsReady(true);
        
        // Store session in AsyncStorage for offline access
        try {
          await AsyncStorage.setItem('@littleloom_session', JSON.stringify(currentSession));
        } catch (storageError) {
          console.warn('[DatabaseContext] Failed to cache session:', storageError);
        }
      } else {
        // Try to restore session from storage
        try {
          const storedSession = await AsyncStorage.getItem('@littleloom_session');
          if (storedSession) {
            const parsed = JSON.parse(storedSession);
            if (parsed?.user) {
              setUserId(parsed.user.id);
              setSession(parsed);
              setError(null);
              setIsReady(true);
              console.log('[DatabaseContext] Restored session from cache');
              return;
            }
          }
        } catch (storageError) {
          console.warn('[DatabaseContext] Failed to restore session:', storageError);
        }
        
        setUserId(null);
        setSession(null);
        setIsReady(true);
      }
    } catch (err) {
      console.warn('[DatabaseContext] Connection check error:', err);
      setError(err instanceof Error ? err : new Error('Connection failed'));
      setIsReady(true);
    }
  }, []);

  // Simple online check
  const checkOnlineStatus = useCallback(() => {
    setIsOnline(true);
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn('[DatabaseContext] Session refresh failed:', refreshError.message);
        return;
      }
      if (refreshedSession?.user) {
        setUserId(refreshedSession.user.id);
        setSession(refreshedSession);
        setError(null);
        setIsReady(true);
        await AsyncStorage.setItem('@littleloom_session', JSON.stringify(refreshedSession));
      }
    } catch (err) {
      console.warn('[DatabaseContext] Session refresh error:', err);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('@littleloom_session');
      setUserId(null);
      setSession(null);
      console.log('[DatabaseContext] Signed out successfully');
    } catch (err) {
      console.error('[DatabaseContext] Sign out error:', err);
      throw err;
    }
  }, []);

  // Retry connection
  const retry = useCallback(() => {
    console.log('[DatabaseContext] Manual retry requested');
    retryCountRef.current = 0;
    setError(null);
    setIsReady(false);
    setShowLoading(true);
    checkConnection().finally(() => {
      if (isMountedRef.current) {
        setShowLoading(false);
      }
    });
  }, [checkConnection]);

  // Handle auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[DatabaseContext] Auth state changed:', event);
      
      if (newSession?.user) {
        setUserId(newSession.user.id);
        setSession(newSession);
        setError(null);
        setIsReady(true);
        await AsyncStorage.setItem('@littleloom_session', JSON.stringify(newSession));
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        setSession(null);
        await AsyncStorage.removeItem('@littleloom_session');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Initial setup
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    isMountedRef.current = true;
    
    // Check connection on mount
    checkConnection();

    // Retry when app comes back to foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        console.log('[DatabaseContext] App became active, checking connection...');
        refreshSession();
      }
    });
    appStateSubscriptionRef.current = subscription;

    return () => {
      isMountedRef.current = false;
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
        appStateSubscriptionRef.current = null;
      }
    };
  }, [checkConnection, refreshSession]);

  // Only show loading on initial check
  if (showLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loading}>Connecting to LittleLoom...</Text>
      </View>
    );
  }

  const value: DatabaseContextType = {
    isReady,
    error,
    retry,
    isOnline,
    userId,
    session,
    refreshSession,
    signOut,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8faff',
    padding: 32,
  },
  loading: { marginTop: 16, fontSize: 14, color: '#64748b' },
});

export default DatabaseProvider;