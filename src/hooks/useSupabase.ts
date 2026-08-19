// hooks/useOfflineSync.ts
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
}

export function useOfflineSync() {
  const [queue, setQueue] = useState<OfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

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
    };

    const newQueue = [...queue, newOp];
    await saveQueue(newQueue);
  }, [queue]);

  const sync = useCallback(async () => {
    if (queue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    const errors: OfflineOperation[] = [];

    for (const op of queue) {
      try {
        switch (op.operation) {
          case 'insert':
            await supabase.from(op.table).insert(op.data);
            break;
          case 'update':
            await supabase.from(op.table).update(op.data).eq('id', op.data.id);
            break;
          case 'delete':
            await supabase.from(op.table).delete().eq('id', op.data.id);
            break;
        }
      } catch (error) {
        console.error(`Failed to sync operation ${op.id}:`, error);
        errors.push(op);
      }
    }

    await saveQueue(errors);
    setIsSyncing(false);

    return { success: errors.length === 0, errors };
  }, [queue, isSyncing]);

  const clearQueue = useCallback(async () => {
    await saveQueue([]);
  }, []);

  return {
    queue,
    isSyncing,
    enqueue,
    sync,
    clearQueue,
  };
}