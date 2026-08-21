// src/hooks/useOfflineSync.ts

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const OFFLINE_QUEUE_KEY = '@littleloom_offline_queue';

interface OfflineOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
}

export function useOfflineSync() {
  const [queue, setQueue] = useState<OfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (data) {
        setQueue(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  };

  const saveQueue = async (newQueue: OfflineOperation[]) => {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
      setQueue(newQueue);
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  };

  const enqueue = useCallback(async (
    table: string,
    operation: OfflineOperation['operation'],
    data: any
  ) => {
    const newOp: OfflineOperation = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      table,
      operation,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    const newQueue = [...queue, newOp];
    await saveQueue(newQueue);
  }, [queue]);

  const sync = useCallback(async () => {
    if (queue.length === 0 || isSyncing) {
      return { success: true, errors: [] };
    }

    setIsSyncing(true);
    const errors: OfflineOperation[] = [];

    // Check if online
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsSyncing(false);
      return { success: false, errors: queue, message: 'No authenticated user' };
    }

    for (const op of queue) {
      try {
        switch (op.operation) {
          case 'insert':
            await supabase.from(op.table).insert({ ...op.data, user_id: user.id });
            break;
          case 'update':
            await supabase.from(op.table).update(op.data).eq('id', op.data.id).eq('user_id', user.id);
            break;
          case 'delete':
            await supabase.from(op.table).delete().eq('id', op.data.id).eq('user_id', user.id);
            break;
        }
      } catch (error) {
        console.error(`Failed to sync operation ${op.id}:`, error);
        op.retries += 1;
        if (op.retries < 3) {
          errors.push(op);
        }
      }
    }

    await saveQueue(errors);
    setIsSyncing(false);
    setLastSync(new Date());

    return { success: errors.length === 0, errors };
  }, [queue, isSyncing]);

  const clearQueue = useCallback(async () => {
    await saveQueue([]);
  }, []);

  const getQueueStatus = useCallback(() => {
    return {
      pending: queue.length,
      isSyncing,
      lastSync,
    };
  }, [queue.length, isSyncing, lastSync]);

  return {
    queue,
    isSyncing,
    lastSync,
    enqueue,
    sync,
    clearQueue,
    getQueueStatus,
  };
}

export default useOfflineSync;