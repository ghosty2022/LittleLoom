// src/context/DatabaseContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, AppState } from 'react-native';
import { initializeDatabase } from '@/database/db';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
  retry: () => void;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isReady: false,
  error: null,
  retry: () => {},
});

export const useDatabase = () => useContext(DatabaseContext);

const DB_INIT_TIMEOUT = 15000; // 15 second timeout
const RETRY_DELAY = 5000; // 5 seconds between retries
const MAX_RETRIES = 3;

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showLoading, setShowLoading] = useState(true);
  const retryCountRef = useRef(0);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initDb = async () => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout;

    try {
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          console.warn('[DatabaseContext] DB init timed out, allowing app to render anyway');
          setIsReady(true);
          setShowLoading(false);
        }
      }, DB_INIT_TIMEOUT);

      timeoutIdRef.current = timeoutId;
      await initializeDatabase();
      clearTimeout(timeoutId);
      timeoutIdRef.current = null;

      if (!cancelled) {
        setIsReady(true);
        setError(null);
        setShowLoading(false);
        retryCountRef.current = 0;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      timeoutIdRef.current = null;
      console.error('[DatabaseContext] Init failed:', err);
      if (!cancelled) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setIsReady(true); // STILL don't block — app can work with fallback
        setShowLoading(false);

        // Auto-retry in background if we haven't exceeded max retries
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log(`[DatabaseContext] Will retry DB init in ${RETRY_DELAY}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
          retryTimeoutRef.current = setTimeout(() => {
            if (!cancelled) {
              console.log('[DatabaseContext] Auto-retrying DB init...');
              initDb();
            }
          }, RETRY_DELAY);
        }
      }
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  };

  useEffect(() => {
    initDb();

    // Retry when app comes back to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && error && !isReady) {
        console.log('[DatabaseContext] App became active, retrying DB init...');
        initDb();
      }
    });

    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      sub.remove();
    };
  }, []);

  const retry = () => {
    console.log('[DatabaseContext] Manual retry requested');
    retryCountRef.current = 0;
    setError(null);
    setIsReady(false);
    setShowLoading(true);
    initDb();
  };

  // NEVER block children from rendering — the app should work even if DB is down
  // Only show loading UI on first mount for a brief moment
  if (showLoading && !isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loading}>Setting up database...</Text>
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