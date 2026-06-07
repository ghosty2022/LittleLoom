// src/hooks/useReportRoute.ts
import { useEffect } from 'react';
import { useRoute } from '@react-navigation/native';
import { useSafeApp } from './useSafeContexts';

export const useReportRoute = () => {
  const route = useRoute();
  // 🔑 Use safe hook with fallback instead of undefined useApp
  const { setCommunityRoute } = useSafeApp();

  useEffect(() => {
    if (setCommunityRoute) {
      setCommunityRoute(route.name);
      return () => setCommunityRoute(null);
    }
  }, [route.name, setCommunityRoute]);
};