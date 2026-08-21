// src/hooks/useRealtimeSubscription.ts

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UseRealtimeSubscriptionProps {
  table: string;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  enabled?: boolean;
}

export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSubscriptionProps) {
  const subscriptionRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  const setupSubscription = useCallback(async () => {
    if (!enabled || !table) return;

    try {
      // Clean up any existing subscription
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }

      const channelName = `realtime:${table}${filter ? `:${filter}` : ''}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: filter,
          },
          (payload) => {
            switch (payload.eventType) {
              case 'INSERT':
                onInsert?.(payload);
                break;
              case 'UPDATE':
                onUpdate?.(payload);
                break;
              case 'DELETE':
                onDelete?.(payload);
                break;
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            isSubscribedRef.current = false;
          }
        });

      channelRef.current = channel;

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
          isSubscribedRef.current = false;
        }
      };
    } catch (error) {
      console.warn('[useRealtimeSubscription] Error setting up subscription:', error);
    }
  }, [table, filter, onInsert, onUpdate, onDelete, enabled]);

  // Setup subscription on mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      cleanup = await setupSubscription();
    };

    if (enabled) {
      init();
    }

    return () => {
      if (cleanup) {
        cleanup();
      } else if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [setupSubscription, enabled]);

  const unsubscribe = useCallback(async () => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isSubscribedRef.current = false;
    }
  }, []);

  const resubscribe = useCallback(async () => {
    await unsubscribe();
    return setupSubscription();
  }, [unsubscribe, setupSubscription]);

  return {
    isSubscribed: isSubscribedRef.current,
    unsubscribe,
    resubscribe,
  };
}

export default useRealtimeSubscription;