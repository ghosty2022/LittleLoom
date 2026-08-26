// src/context/DatabaseContext.tsx
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
  const lastLogTimeRef = useRef<Record<string, number>>({});
  const logCooldownMs = 5000; // Only log same message every 5 seconds

  // Throttled logging to reduce noise
  const throttledLog = useCallback((message: string, data?: any) => {
    const now = Date.now();
    const key = message;
    if (!lastLogTimeRef.current[key] || now - lastLogTimeRef.current[key] > logCooldownMs) {
      lastLogTimeRef.current[key] = now;
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }, []);

  // Check Supabase connection and session
  const checkConnection = useCallback(async () => {
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('[DatabaseContext] Supabase session check failed:', sessionError.message);
        setError(new Error('Supabase session issue'));
        setIsReady(false);
        return;
      }

      if (currentSession?.user) {
        setUserId(currentSession.user.id);
        setSession(currentSession);
        setError(null);
        setIsReady(true);
        
        try {
          await AsyncStorage.setItem('@littleloom_session', JSON.stringify(currentSession));
        } catch (storageError) {
          // Silently handle storage error
        }
      } else {
        try {
          const storedSession = await AsyncStorage.getItem('@littleloom_session');
          if (storedSession) {
            const parsed = JSON.parse(storedSession);
            if (parsed?.user) {
              setUserId(parsed.user.id);
              setSession(parsed);
              setError(null);
              setIsReady(true);
              throttledLog('[DatabaseContext] Session restored from cache');
              return;
            }
          }
        } catch {
          // Silently handle
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
  }, [throttledLog]);

  const checkOnlineStatus = useCallback(() => {
    setIsOnline(true);
  }, []);

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

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('@littleloom_session');
      setUserId(null);
      setSession(null);
      console.log('[DatabaseContext] Signed out');
    } catch (err) {
      console.error('[DatabaseContext] Sign out error:', err);
      throw err;
    }
  }, []);

  const retry = useCallback(() => {
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

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'TOKEN_REFRESHED') {
        // Silent refresh - no log
        if (newSession?.user) {
          setUserId(newSession.user.id);
          setSession(newSession);
          await AsyncStorage.setItem('@littleloom_session', JSON.stringify(newSession));
        }
        return;
      }
      
      throttledLog('[DatabaseContext] Auth state changed:', event);
      
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
  }, [throttledLog]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    isMountedRef.current = true;
    checkConnection();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Silent refresh - no log
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

  if (showLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loading}>Connecting...</Text>
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