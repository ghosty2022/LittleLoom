// src/context/DatabaseContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { initializeDatabase } from '@/database/db';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isReady: false,
  error: null,
});

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    initializeDatabase()
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch((err) => {
        console.error('[DatabaseContext] Init failed:', err);
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>💥</Text>
        <Text style={styles.title}>Database Error</Text>
        <Text style={styles.message}>{error.message}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loading}>Setting up database...</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{ isReady, error }}>
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
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  message: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  loading: { marginTop: 16, fontSize: 14, color: '#64748b' },
});

export default DatabaseProvider;