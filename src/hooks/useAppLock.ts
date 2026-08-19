// src/hooks/useAppLock.ts
import { useEffect, useRef } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { navigationRef } from '../navigation/navigationRef';

export const useAppLock = () => {
  const { isSecurityLocked, isLoading } = useSecurity();
  const wasLocked = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!navigationRef.isReady()) return;

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isSecurityLocked && !wasLocked.current) {
      wasLocked.current = true;
      timeoutRef.current = setTimeout(() => {
        if (navigationRef.isReady() && isSecurityLocked) {
          navigationRef.navigate('SecurityLock' as never);
        }
        timeoutRef.current = null;
      }, 100);
    } else if (!isSecurityLocked && wasLocked.current) {
      wasLocked.current = false;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isSecurityLocked, isLoading]);
};