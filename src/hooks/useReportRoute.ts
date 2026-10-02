import { useEffect } from 'react';
import { useRoute } from '@react-navigation/native';
import { useSafeApp } from './useSafeContexts';

// `useApp` in AppContext exposes `setCommunityScreen(boolean)`, not
// `setCommunityRoute(name)`. The old wrapper read a non-existent
// function off the fallback, so this hook was a silent no-op.
//
// We use the real API and translate route name → boolean.
const COMMUNITY_ROUTES = new Set([
  'CommunityMain', 'Topic', 'CreatePost', 'PostDetail',
  'CommunityMemberProfile', 'Chat', 'ChatList', 'Notifications',
  'CommunityProfile', 'Followers', 'Following', 'TopicMembers',
  'SearchUsers', 'BlockedUsers', 'Report',
]);

export const useReportRoute = () => {
  const route = useRoute();
  const app = useSafeApp() as any;
  const setCommunityScreen: ((isCommunity: boolean) => void) | undefined =
    app?.setCommunityScreen;

  useEffect(() => {
    if (!setCommunityScreen) return;
    setCommunityScreen(COMMUNITY_ROUTES.has(route.name));
    return () => setCommunityScreen(false);
  }, [route.name, setCommunityScreen]);
};
