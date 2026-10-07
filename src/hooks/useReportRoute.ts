









import { useEffect } from 'react';
import { useRoute } from '@react-navigation/native';
import { useSafeApp } from './useSafeContexts';

const COMMUNITY_ROUTES = new Set<string>([
  'CommunityMain',
  'Topic',
  'CreatePost',
  'PostDetail',
  'CommunityMemberProfile',
  'Chat',
  'ChatList',
  'Notifications',
  'CommunityProfile',
  'CommunityVerification',
  'CommunitySplash',
  'CommunityOnboarding',
  'Followers',
  'Following',
  'TopicMembers',
  'SearchUsers',
  'BlockedUsers',
  'Report',
]);

export const useReportRoute = () => {
  const route = useRoute();
  const app = useSafeApp() as any;

  const setCommunityScreen: ((isCommunity: boolean) => void) | undefined =
    typeof app?.setCommunityScreen === 'function'
      ? app.setCommunityScreen
      : undefined;

  useEffect(() => {
    if (!setCommunityScreen) return;
    setCommunityScreen(COMMUNITY_ROUTES.has(route.name));
    return () => setCommunityScreen(false);
  }, [route.name, setCommunityScreen]);
};

export default useReportRoute;