import { useEffect, useRef } from 'react';
import { useSecurity } from '../context/SecurityContext';
import { navigationRef } from '../navigation/navigationRef';

export const useAppLock = () => {
  const { isSecurityLocked, isLoading } = useSecurity();
  const wasLocked = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!navigationRef.isReady()) return;

    if (isSecurityLocked && !wasLocked.current) {
      wasLocked.current = true;
      // Small delay to ensure state is settled and avoid double navigation
      const timer = setTimeout(() => {
        if (navigationRef.isReady() && isSecurityLocked) {
          navigationRef.navigate('SecurityLock' as never);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isSecurityLocked && wasLocked.current) {
      wasLocked.current = false;
    }
  }, [isSecurityLocked, isLoading]);
};