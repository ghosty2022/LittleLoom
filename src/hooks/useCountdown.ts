import { useState, useEffect, useCallback, useRef } from 'react';

interface CountdownState {
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  formatted: string;
  progress: number; // 0-100 based on initial time
}

export const useCountdown = (initialMinutes: number = 45) => {
  const [state, setState] = useState<CountdownState>(() => {
    const total = initialMinutes * 60;
    return {
      minutes: initialMinutes,
      seconds: 0,
      totalSeconds: total,
      isExpired: false,
      formatted: `${initialMinutes}:00`,
      progress: 100,
    };
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialTotalRef = useRef(initialMinutes * 60);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (prev.totalSeconds <= 0) {
          return { ...prev, isExpired: true, progress: 0 };
        }
        
        const newTotal = prev.totalSeconds - 1;
        const mins = Math.floor(newTotal / 60);
        const secs = newTotal % 60;
        
        return {
          minutes: mins,
          seconds: secs,
          totalSeconds: newTotal,
          isExpired: false,
          formatted: `${mins}:${secs.toString().padStart(2, '0')}`,
          progress: (newTotal / initialTotalRef.current) * 100,
        };
      });
    }, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const reset = useCallback((minutes: number) => {
    initialTotalRef.current = minutes * 60;
    setState({
      minutes,
      seconds: 0,
      totalSeconds: minutes * 60,
      isExpired: false,
      formatted: `${minutes}:00`,
      progress: 100,
    });
  }, []);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.totalSeconds <= 0) {
            return { ...prev, isExpired: true, progress: 0 };
          }
          const newTotal = prev.totalSeconds - 1;
          return {
            ...prev,
            minutes: Math.floor(newTotal / 60),
            seconds: newTotal % 60,
            totalSeconds: newTotal,
            formatted: `${Math.floor(newTotal / 60)}:${(newTotal % 60).toString().padStart(2, '0')}`,
            progress: (newTotal / initialTotalRef.current) * 100,
          };
        });
      }, 1000);
    }
  }, []);

  return {
    ...state,
    reset,
    pause,
    resume,
  };
};