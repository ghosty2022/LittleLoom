// src/context/DatabaseContext.tsx
// Full Supabase - No local DB initialization needed

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, AppState } from 'react-native';
import { supabase } from '@/utils/supabase';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
  retry: () => void;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isReady: true, // Always true for Supabase
  error: null,
  retry: () => {},
});

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const retryCountRef = useRef(0);

  const checkConnection = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[DatabaseContext] Supabase connection check failed:', error.message);
        setError(new Error('Supabase connection issue'));
        setIsReady(false);
      } else {
        setIsReady(true);
        setError(null);
      }
    } catch (err) {
      console.warn('[DatabaseContext] Connection check error:', err);
      setError(err instanceof Error ? err : new Error('Connection failed'));
      setIsReady(false);
    }
  };

  useEffect(() => {
    // Check connection on mount
    checkConnection();

    // Retry when app comes back to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && error) {
        console.log('[DatabaseContext] App became active, checking connection...');
        checkConnection();
      }
    });

    return () => sub.remove();
  }, []);

  const retry = () => {
    console.log('[DatabaseContext] Manual retry requested');
    retryCountRef.current = 0;
    setError(null);
    setIsReady(false);
    setShowLoading(true);
    checkConnection().finally(() => setShowLoading(false));
  };

  // Only show loading on initial check
  if (showLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loading}>Connecting to LittleLoom...</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{ isReady, error, retry }}>
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