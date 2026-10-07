















import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../utils/supabase';



const OFFLINE_QUEUE_KEY = '@littleloom_offline_queue';
const MAX_RETRIES = 3;



export interface OfflineOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
  /** Set true after MAX_RETRIES failures — kept for manual retry, not deleted */
  permanentlyFailed?: boolean;
  /** Last error message for debugging */
  lastError?: string;
  /** When the last attempt was made */
  lastAttemptAt?: number;
}

export interface SyncResult {
  success: boolean;
  errors: OfflineOperation[];
  message?: string;
  synced?: number;
}

export interface UseOfflineSyncOptions {
  /** Called when an op hits MAX_RETRIES and becomes permanentlyFailed */
  onPermanentFailure?: (op: OfflineOperation) => void;
  /** Called after a successful sync pass */
  onSyncComplete?: (result: SyncResult) => void;
  /** Auto-sync on mount + when network comes back online. Default: true */
  autoSync?: boolean;
}



const generateOpId = (): string => {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};



export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const {
    onPermanentFailure,
    onSyncComplete,
    autoSync = true,
  } = options;

  const [queue, setQueue] = useState<OfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  
  const queueRef = useRef<OfflineOperation[]>([]);
  const isSyncingRef = useRef(false);
  const isMountedRef = useRef(true);
  const onPermanentFailureRef = useRef(onPermanentFailure);
  const onSyncCompleteRef = useRef(onSyncComplete);
  
  
  const performSyncRef = useRef<(() => Promise<SyncResult>) | null>(null);

  
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);
  useEffect(() => { onPermanentFailureRef.current = onPermanentFailure; }, [onPermanentFailure]);
  useEffect(() => { onSyncCompleteRef.current = onSyncComplete; }, [onSyncComplete]);

  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  

  /**
   * Save the queue to AsyncStorage and update state.
   * Wrapped in try/catch so storage failures don't crash callers.
   */
  const persistQueue = useCallback(async (newQueue: OfflineOperation[]) => {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
      if (isMountedRef.current) {
        setQueue(newQueue);
        queueRef.current = newQueue;
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to persist queue:', error);
      // Still update in-memory state so the app can function
      if (isMountedRef.current) {
        setQueue(newQueue);
        queueRef.current = newQueue;
      }
    }
  }, []);

  /**
   * Load queue from AsyncStorage on mount.
   */
  const loadQueue = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      // Filter to well-formed ops only
      const valid: OfflineOperation[] = parsed.filter(
        (op: any) =>
          op &&
          typeof op.id === 'string' &&
          typeof op.table === 'string' &&
          typeof op.operation === 'string' &&
          ['insert', 'update', 'delete'].includes(op.operation)
      );

      if (isMountedRef.current) {
        setQueue(valid);
        queueRef.current = valid;
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to load queue:', error);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // ─── Network Detection ────────────────────────────────────────

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      // Initial read
      try {
        const state = await NetInfo.fetch();
        if (isMountedRef.current) {
          setIsOnline(!!state.isConnected);
        }
      } catch {
        // Assume online if we can't determine
        if (isMountedRef.current) setIsOnline(true);
      }

      
      unsubscribe = NetInfo.addEventListener((state) => {
        const nowOnline = !!state.isConnected;
        if (!isMountedRef.current) return;

        setIsOnline((prev) => {
          
          if (!prev && nowOnline && autoSync) {
            
            
            setTimeout(() => {
              performSyncRef.current?.();
            }, 100);
          }
          return nowOnline;
        });
      });
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
    
  }, [autoSync]);

  

  /**
   * Add an operation to the queue.
   * Uses functional setState to avoid stale closure bugs.
   */
  const enqueue = useCallback(
    async (
      table: string,
      operation: OfflineOperation['operation'],
      data: any
    ): Promise<OfflineOperation> => {
      const newOp: OfflineOperation = {
        id: generateOpId(),
        table,
        operation,
        data,
        timestamp: Date.now(),
        retries: 0,
      };

      const nextQueue = [...queueRef.current, newOp];
      await persistQueue(nextQueue);

      if (__DEV__) {
        console.log(
          `[OfflineSync] Enqueued ${operation} on ${table} (queue size: ${nextQueue.length})`
        );
      }

      return newOp;
    },
    [persistQueue]
  );

  

  /**
   * The actual sync worker. Extracted so we can call it from
   * multiple places (mount, network change, manual) without
   * circular dependencies in useCallback.
   */
  const performSync = useCallback(async (): Promise<SyncResult> => {
    
    if (isSyncingRef.current) {
      return {
        success: false,
        errors: queueRef.current,
        message: 'Sync already in progress',
      };
    }

    const currentQueue = queueRef.current;
    if (currentQueue.length === 0) {
      return { success: true, errors: [], synced: 0 };
    }

    
    let online = isOnline;
    try {
      const netState = await NetInfo.fetch();
      online = !!netState.isConnected;
      if (isMountedRef.current) setIsOnline(online);
    } catch {
      
    }

    if (!online) {
      return {
        success: false,
        errors: currentQueue,
        message: 'Device is offline',
      };
    }

    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        errors: currentQueue,
        message: 'No authenticated user',
      };
    }

    setIsSyncing(true);
    isSyncingRef.current = true;

    const failedOps: OfflineOperation[] = [];
    const successIds = new Set<string>();
    let syncedCount = 0;

    for (const op of currentQueue) {
      
      if (op.permanentlyFailed) {
        failedOps.push(op);
        continue;
      }

      try {
        const opData = op.data || {};

        switch (op.operation) {
          case 'insert': {
            
            const insertPayload = opData.user_id
              ? opData
              : { ...opData, user_id: user.id };
            const { error } = await supabase.from(op.table).insert(insertPayload);
            if (error) throw error;
            break;
          }

          case 'update': {
            if (!opData.id) {
              throw new Error('Update operation missing id');
            }
            const updatePayload: Record<string, unknown> = { ...opData };
            delete updatePayload.id;
            
            
            if (!updatePayload.user_id) {
              updatePayload.user_id = user.id;
            }
            const { error } = await supabase
              .from(op.table)
              .update(updatePayload)
              .eq('id', opData.id)
              .eq('user_id', user.id);
            if (error) throw error;
            break;
          }

          case 'delete': {
            if (!opData.id) {
              throw new Error('Delete operation missing id');
            }
            
            
            const { error } = await supabase
              .from(op.table)
              .delete()
              .eq('id', opData.id)
              .eq('user_id', user.id);
            if (error) throw error;
            break;
          }

          default:
            throw new Error(`Unknown operation: ${op.operation}`);
        }

        
        successIds.add(op.id);
        syncedCount++;

        if (__DEV__) {
          console.log(`[OfflineSync] Synced ${op.operation} on ${op.table} (${op.id})`);
        }
      } catch (error: any) {
        const nextRetries = op.retries + 1;
        const errorMessage = error?.message || String(error);

        if (__DEV__) {
          console.warn(
            `[OfflineSync] Failed ${op.operation} on ${op.table} ` +
            `(attempt ${nextRetries}/${MAX_RETRIES}): ${errorMessage}`
          );
        }

        if (nextRetries >= MAX_RETRIES) {
          
          const failedOp: OfflineOperation = {
            ...op,
            retries: nextRetries,
            permanentlyFailed: true,
            lastError: errorMessage,
            lastAttemptAt: Date.now(),
          };
          failedOps.push(failedOp);

          if (__DEV__) {
            console.error(
              `[OfflineSync] Op ${op.id} marked permanentlyFailed after ` +
              `${nextRetries} attempts: ${errorMessage}`
            );
          }

          try {
            onPermanentFailureRef.current?.(failedOp);
          } catch (cbErr) {
            console.error('[OfflineSync] onPermanentFailure callback threw:', cbErr);
          }
        } else {
          
          failedOps.push({
            ...op,
            retries: nextRetries,
            lastError: errorMessage,
            lastAttemptAt: Date.now(),
          });
        }
      }
    }

    
    
    const newQueue = currentQueue
      .filter((op) => !successIds.has(op.id))
      .map((op) => {
        const updated = failedOps.find((f) => f.id === op.id);
        return updated || op;
      });

    await persistQueue(newQueue);

    if (isMountedRef.current) {
      setIsSyncing(false);
      setLastSync(new Date());
    }
    isSyncingRef.current = false;

    const result: SyncResult = {
      success: failedOps.length === 0,
      errors: failedOps,
      synced: syncedCount,
    };

    if (__DEV__) {
      console.log(
        `[OfflineSync] Sync complete: ${syncedCount} synced, ` +
        `${failedOps.length} remaining ` +
        `(${failedOps.filter((f) => f.permanentlyFailed).length} permanently failed)`
      );
    }

    try {
      onSyncCompleteRef.current?.(result);
    } catch (cbErr) {
      console.error('[OfflineSync] onSyncComplete callback threw:', cbErr);
    }

    return result;
  }, [isOnline, persistQueue]);

  
  useEffect(() => {
    performSyncRef.current = performSync;
  }, [performSync]);

  

  const sync = useCallback(async (): Promise<SyncResult> => {
    return performSync();
  }, [performSync]);

  
  useEffect(() => {
    if (!autoSync) return;
    if (queue.length === 0) return;

    
    const timer = setTimeout(() => {
      performSync().catch((err) => {
        if (__DEV__) {
          console.warn('[OfflineSync] Auto-sync failed:', err);
        }
      });
    }, 3000);

    return () => clearTimeout(timer);
    
  }, [autoSync, queue.length]);

  

  /**
   * Reset permanently-failed ops back to pending so they'll retry.
   */
  const retryFailed = useCallback(async () => {
    const currentQueue = queueRef.current;
    const hasFailed = currentQueue.some((op) => op.permanentlyFailed);
    if (!hasFailed) return;

    const nextQueue = currentQueue.map((op) =>
      op.permanentlyFailed
        ? {
            ...op,
            retries: 0,
            permanentlyFailed: false,
            lastError: undefined,
            lastAttemptAt: undefined,
          }
        : op
    );

    await persistQueue(nextQueue);

    if (__DEV__) {
      console.log('[OfflineSync] Reset failed ops to pending');
    }
  }, [persistQueue]);

  /**
   * Remove an op from the queue entirely.
   */
  const removeOperation = useCallback(
    async (opId: string) => {
      const nextQueue = queueRef.current.filter((op) => op.id !== opId);
      await persistQueue(nextQueue);
    },
    [persistQueue]
  );

  /**
   * Nuke the queue.
   */
  const clearQueue = useCallback(async () => {
    await persistQueue([]);
  }, [persistQueue]);

  

  const getQueueStatus = useCallback(() => {
    const currentQueue = queueRef.current;
    const permanentlyFailed = currentQueue.filter((op) => op.permanentlyFailed);
    const pending = currentQueue.filter((op) => !op.permanentlyFailed);
    return {
      total: currentQueue.length,
      pending: pending.length,
      permanentlyFailed: permanentlyFailed.length,
      isSyncing: isSyncingRef.current,
      lastSync,
      isOnline,
    };
  }, [lastSync, isOnline]);

  const getFailedOperations = useCallback((): OfflineOperation[] => {
    return queueRef.current.filter((op) => op.permanentlyFailed);
  }, []);

  const getPendingOperations = useCallback((): OfflineOperation[] => {
    return queueRef.current.filter((op) => !op.permanentlyFailed);
  }, []);

  

  return {
    
    queue,
    isSyncing,
    lastSync,
    isOnline,

    
    enqueue,
    sync,
    retryFailed,
    removeOperation,
    clearQueue,

    
    getQueueStatus,
    getFailedOperations,
    getPendingOperations,
  };
}

export default useOfflineSync;