
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, StatusBar, FlatList, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';

import { Ionicons } from '@expo/vector-icons';
import { useCommunity } from '../context/CommunityContext';
import { useUser } from '../context/UserContext';
import { useCustomization } from '../hooks/useCustomization';
import { useIntelligentSplash } from '../hooks/useIntelligentSplash';

import CommunityScreen from '../screens/community/CommunityScreen';
import TopicScreen from '../screens/community/TopicScreen';
import CreatePostScreen from '../screens/community/CreatePostScreen';
import PostDetailScreen from '../screens/community/PostDetailScreen';
import CommunityMemberProfileScreen from '../screens/community/CommunityMemberProfileScreen';
import ChatScreen from '../screens/community/ChatScreen';
import ChatListScreen from '../screens/community/ChatListScreen';
import NotificationsScreen from '../screens/community/NotificationsScreen';
import CommunityProfileScreen from '../screens/community/CommunityProfileScreen';
import CommunityVerificationScreen from '../screens/community/CommunityVerificationScreen';
import FollowersScreen from '../screens/community/FollowersScreen';
import FollowingScreen from '../screens/community/FollowingScreen';
import ReportScreen from '../screens/community/ReportScreen';
import CommunitySplashScreen from '../screens/community/CommunitySplashScreen';
import CommunityOnboardingScreen from '../screens/community/CommunityOnboardingScreen';

import {
  CommunityColors,
  CommunityGradients,
} from '../theme/CommunityTheme';
import { InlineSpinner } from '../components/UniversalSpinner';
import { LinearGradient } from 'expo-linear-gradient';
import type { CommunityStackParamList } from '../types/navigation';
import { supabase } from '@/utils/supabase';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/NotificationService';

const Stack = createNativeStackNavigator<CommunityStackParamList>();

const COUNTRY_CACHE_KEY = '@littleloom_country_detected_v2';
const COUNTRY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const COMMUNITY_ONBOARDING_KEY = '@littleloom_community_onboarding_v3';
const COMMUNITY_TOPICS_KEY = '@community_selected_topics_v2';

const COUNTRY_MAP: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', JP: 'Japan', IN: 'India', BR: 'Brazil',
  MX: 'Mexico', NG: 'Nigeria', ZA: 'South Africa', GH: 'Ghana',
  UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda', ET: 'Ethiopia', EG: 'Egypt',
  MA: 'Morocco', CN: 'China', RU: 'Russia', ES: 'Spain', IT: 'Italy',
  NL: 'Netherlands', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  PL: 'Poland', UA: 'Ukraine', TR: 'Turkey', SA: 'Saudi Arabia', AE: 'United Arab Emirates',
  IL: 'Israel', KR: 'South Korea', TH: 'Thailand', VN: 'Vietnam', ID: 'Indonesia',
  MY: 'Malaysia', PH: 'Philippines', SG: 'Singapore', NZ: 'New Zealand', IE: 'Ireland',
  PT: 'Portugal', GR: 'Greece', AT: 'Austria', CH: 'Switzerland', BE: 'Belgium',
  CZ: 'Czech Republic', HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', HR: 'Croatia',
  KE: 'Kenya', BD: 'Bangladesh', PK: 'Pakistan', AR: 'Argentina', CO: 'Colombia',
  CL: 'Chile', PE: 'Peru', UY: 'Uruguay',
};

const TIMEZONE_MAP: Record<string, string> = {
  'Africa/Nairobi': 'Kenya', 'Africa/Lagos': 'Nigeria', 'Africa/Johannesburg': 'South Africa',
  'Africa/Cairo': 'Egypt', 'Africa/Accra': 'Ghana', 'Africa/Kigali': 'Rwanda',
  'Africa/Dar_es_Salaam': 'Tanzania', 'Africa/Kampala': 'Uganda', 'Africa/Addis_Ababa': 'Ethiopia',
  'Africa/Casablanca': 'Morocco', 'Europe/London': 'United Kingdom', 'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany', 'Europe/Madrid': 'Spain', 'Europe/Rome': 'Italy',
  'Europe/Amsterdam': 'Netherlands', 'Europe/Brussels': 'Belgium', 'Europe/Vienna': 'Austria',
  'Europe/Zurich': 'Switzerland', 'Europe/Stockholm': 'Sweden', 'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark', 'Europe/Helsinki': 'Finland', 'Europe/Warsaw': 'Poland',
  'Europe/Moscow': 'Russia', 'Europe/Istanbul': 'Turkey', 'Europe/Kiev': 'Ukraine',
  'America/New_York': 'United States', 'America/Chicago': 'United States', 'America/Denver': 'United States',
  'America/Los_Angeles': 'United States', 'America/Toronto': 'Canada', 'America/Vancouver': 'Canada',
  'America/Mexico_City': 'Mexico', 'America/Sao_Paulo': 'Brazil', 'America/Buenos_Aires': 'Argentina',
  'America/Santiago': 'Chile', 'America/Bogota': 'Colombia', 'America/Lima': 'Peru',
  'America/Caracas': 'Venezuela', 'Asia/Tokyo': 'Japan', 'Asia/Seoul': 'South Korea',
  'Asia/Shanghai': 'China', 'Asia/Beijing': 'China', 'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Singapore': 'Singapore', 'Asia/Bangkok': 'Thailand', 'Asia/Jakarta': 'Indonesia',
  'Asia/Kuala_Lumpur': 'Malaysia', 'Asia/Manila': 'Philippines', 'Asia/Mumbai': 'India',
  'Asia/Delhi': 'India', 'Asia/Dubai': 'United Arab Emirates', 'Asia/Tel_Aviv': 'Israel',
  'Asia/Riyadh': 'Saudi Arabia', 'Asia/Tehran': 'Iran', 'Asia/Karachi': 'Pakistan',
  'Asia/Dhaka': 'Bangladesh', 'Asia/Ho_Chi_Minh': 'Vietnam', 'Pacific/Auckland': 'New Zealand',
  'Pacific/Sydney': 'Australia', 'Pacific/Melbourne': 'Australia', 'Pacific/Perth': 'Australia',
  'Pacific/Brisbane': 'Australia', 'Atlantic/Reykjavik': 'Iceland',
};

const getCountryFromCode = (code: string) => COUNTRY_MAP[code.toUpperCase()] || null;
const getCountryFromTz = (tz: string) => TIMEZONE_MAP[tz] || null;


const useAutomaticCountryDetection = () => {
  const { currentUser, updateUserLocation } = useCommunity();
  const [isDetecting, setIsDetecting] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !currentUser || (currentUser.country && currentUser.country !== 'Unknown')) {
      done.current = true;
      return;
    }

    let mounted = true;

    const detect = async () => {
      try {
        const cached = await AsyncStorage.getItem(COUNTRY_CACHE_KEY);
        if (cached) {
          const { country, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < COUNTRY_CACHE_TTL) {
            if (mounted) done.current = true; // guard immediately
            await updateUserLocation(country);
            if (mounted) setIsDetecting(false);
            return;
          }
        }
      } catch { /* ignore */ }

      if (!mounted) return;
      setIsDetecting(true);

      const region = Localization.region;
      let country = region ? getCountryFromCode(region) : null;
      if (!country) country = getCountryFromTz(Localization.timezone);

      if (country) {
        await saveAndUpdate(country);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          const geo = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (geo[0]?.country) {
            await saveAndUpdate(geo[0].country);
            return;
          }
        }
      } catch (e) {
        if (__DEV__) console.log('Location detection failed:', e);
      }

      if (mounted) {
        setIsDetecting(false);
        done.current = true;
      }
    };

    const saveAndUpdate = async (country: string) => {
      await AsyncStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify({ country, timestamp: Date.now() }));
      await updateUserLocation(country);
      if (mounted) {
        setIsDetecting(false);
        done.current = true;
      }
    };

    detect();
    return () => { mounted = false; };
  }, [currentUser, updateUserLocation]);

  return isDetecting;
};


const InlineLoadingView = React.memo(({ text }: { text: string }) => (
  <View style={styles.inlineLoadingContainer}>
    <LinearGradient
      colors={CommunityGradients.header}
      style={StyleSheet.absoluteFill}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    />
    <View style={styles.inlineLoadingCard}>
      <InlineSpinner size={36} color="#ffffff" section="community" variant="aurora" />
      <Text style={styles.inlineLoadingText}>{text}</Text>
    </View>
  </View>
));

type CommunityPhase = 'loading' | 'onboarding' | 'splash' | 'main';

const ONBOARDING_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  gestureEnabled: false,
  contentStyle: { backgroundColor: CommunityColors.background.main },
};

const SPLASH_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'fade' as const,
  gestureEnabled: false,
  contentStyle: { backgroundColor: CommunityColors.background.main },
};

const MAIN_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  gestureEnabled: true,
  contentStyle: { backgroundColor: CommunityColors.background.main },
};

// ─── PLACEHOLDER SCREENS ──────────────────────────────────────────────

const TopicMembersScreen = () => {
  const { topics } = useCommunity();
  const route = useRoute();
  const { topicId } = route.params as { topicId: string };
  const topic = topics.find(t => t.id === topicId);
  
  return (
    <SafeAreaView style={[styles.placeholderContainer, { backgroundColor: CommunityColors.background.main }]}>
      <View style={styles.placeholderHeader}>
        <Text style={[styles.placeholderTitle, { color: CommunityColors.text.primary }]}>
          {topic?.name || 'Topic'} Members
        </Text>
        <Text style={{ color: CommunityColors.text.secondary, fontSize: 14 }}>
          {topic?.members?.toLocaleString() || 0} members
        </Text>
      </View>
      <View style={styles.placeholderContent}>
        <Ionicons name="people" size={48} color={CommunityColors.primary} />
        <Text style={[styles.placeholderText, { marginTop: 16, color: CommunityColors.text.secondary }]}>
          Member list coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
};

const SearchUsersScreen = () => {
  const { getAllUsers } = useCommunity();
  const [query, setQuery] = useState('');
  const users = getAllUsers();
  
  const filtered = query.trim() 
    ? users.filter(u => u.displayName.toLowerCase().includes(query.toLowerCase()))
    : users;
  
  return (
    <SafeAreaView style={[styles.placeholderContainer, { backgroundColor: CommunityColors.background.main, paddingHorizontal: 20 }]}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={CommunityColors.text.secondary} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search parents..."
          placeholderTextColor={CommunityColors.text.secondary}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={CommunityColors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <Text style={styles.userAvatar}>{item.avatar || '👤'}</Text>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: CommunityColors.text.primary }]}>{item.displayName}</Text>
              <Text style={[styles.userHandle, { color: CommunityColors.text.secondary }]}>{item.handle}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: CommunityColors.text.secondary, marginTop: 20 }}>
            {query.trim() ? 'No users found' : 'Search for parents in the community'}
          </Text>
        }
      />
    </SafeAreaView>
  );
};

const BlockedUsersScreen = () => {
  
  
  const community = useCommunity() as any;
  const blockedUsers: string[] = community.blockedUsers ?? [];
  const getUserById = community.getUserById ?? (() => undefined);
  const unblockUser =
    community.unblockUser ??
    community.blockUser ?? 
    (async (_id: string) => {});

  return (
    <SafeAreaView style={[styles.placeholderContainer, { backgroundColor: CommunityColors.background.main, paddingHorizontal: 20 }]}>
      <View style={styles.placeholderHeader}>
        <Text style={[styles.placeholderTitle, { color: CommunityColors.text.primary }]}>Blocked Users</Text>
      </View>
      {blockedUsers.length === 0 ? (
        <View style={styles.placeholderContent}>
          <Ionicons name="shield-checkmark" size={48} color={CommunityColors.text.secondary} />
          <Text style={{ textAlign: 'center', color: CommunityColors.text.secondary, marginTop: 16 }}>
            No blocked users
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={id => id}
          renderItem={({ item }) => {
            const user = getUserById(item);
            return (
              <View style={styles.blockedItem}>
                <View style={styles.userItem}>
                  <Text style={styles.userAvatar}>{user?.avatar || '👤'}</Text>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: CommunityColors.text.primary }]}>
                      {user?.displayName || 'Unknown'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => unblockUser(item)} 
                  style={[styles.unblockButton, { backgroundColor: CommunityColors.primary }]}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};


function useCommunityAuthCheck() {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          console.log('[CommunityNavigator] No authenticated user');
          setIsValid(false);
          return;
        }
        console.log('[CommunityNavigator] Auth valid for user:', user.id);
        setIsValid(true);
      } catch (error) {
        console.error('[CommunityNavigator] Auth check error:', error);
        setIsValid(false);
      }
    };
    
    checkAuth();
  }, []);
  
  return isValid;
}


const CommunityNavigator = React.memo(({ onFullscreenStateChange }: { onFullscreenStateChange?: (fullscreen: boolean) => void } = {}) => {
  const { isLoading, currentUser, checkOnboardingStatus, getSelectedTopics, isInitialized } = useCommunity();
  
  
  const { profile: userProfile } = useUser();
  const { settings, shouldReduceMotion } = useCustomization();
  
  const isAuthValid = useCommunityAuthCheck();
  const isDetectingCountry = useAutomaticCountryDetection();
  
  useEffect(() => {
    if (__DEV__) {
      console.log('[CommunityNavigator] Country detection:', isDetectingCountry ? 'running' : 'done');
      console.log('[CommunityNavigator] Auth valid:', isAuthValid);
    }
  }, [isDetectingCountry, isAuthValid]);

  const {
    isReady: splashReady,
    shouldShowSplash,
    markShown: markSplashShown,
  } = useIntelligentSplash('community', shouldReduceMotion, settings.compactView);

  const [phase, setPhase] = useState<CommunityPhase>('loading');
  const initDone = useRef(false);
  const lastAuthRef = useRef<string | null>(null);

  // Re-run the onboarding decision whenever the signed-in user changes,
  // otherwise a sign-out → sign-in as a different account inherits the
  // previous account's "onboarding done" phase.
  useEffect(() => {
    if (!currentUser?.id) return;
    if (lastAuthRef.current === currentUser.id) return;
    lastAuthRef.current = currentUser.id;
    initDone.current = false;
    setPhase('loading');
  }, [currentUser?.id]);

  // Guard: never declare "ready" until the context is initialized AND we
  // have a valid signed-in user AND the topics list has actually been
  // hydrated. Otherwise checkOnboardingStatus() sees selectedTopics=[]
  // and always routes to onboarding.
  const hasAuthedUser = !!currentUser?.id;
  const topicsHydrated =
    Array.isArray(getSelectedTopics()) && getSelectedTopics().length >= 0;
  const isReady =
    !isLoading &&
    isInitialized &&
    splashReady &&
    hasAuthedUser &&
    isAuthValid === true;

  // Notify parent tabs to hide/show the liquid-glass tab bar.
  // Onboarding + splash must be truly full-screen (no tab bar overlay).
  useEffect(() => {
    const shouldBeFullscreen = phase === 'onboarding' || phase === 'splash' || phase === 'loading';
    onFullscreenStateChange?.(shouldBeFullscreen);
  }, [phase, onFullscreenStateChange]);

  useEffect(() => {
    if (isAuthValid === false) {
      console.log('[CommunityNavigator] Auth invalid — rendering auth-required view');
      
      if (phase === 'loading') {
        setPhase('main');
      }
      return;
    }
    
    if (!isReady || initDone.current) return;
    if (isAuthValid !== true) return;   // wait for real auth confirmation

    let mounted = true;
    initDone.current = true;

    const initialize = async () => {
  try {
    try {
      const { refreshTopics } = require('../context/CommunityContext');
      await refreshTopics();
    } catch (e) {
      console.warn('[CommunityNavigator] Failed to refresh topics:', e);
    }

    const onboardingStatus = await checkOnboardingStatus();

    if (!mounted) return;

    // SECOND GUARD: if the context reports 0 topics AND we've never
    // written the onboarding-complete flag for THIS user, we show
    // onboarding. Otherwise — even if selectedTopics is briefly [] —
    // go to main. `checkOnboardingStatus()` already checks the scoped
    // AsyncStorage key, so a completed-then-cleared-then-remounted
    // user won't re-onboard.
    if (!onboardingStatus.completed && !onboardingStatus.hasTopics) {
      const userId = currentUser?.id;
      const scopedKey = userId
        ? `@community_selected_topics_v2_${userId}`
        : '@community_selected_topics_v2';
      const [rawScoped, rawGlobal, rawOnboarding] = await Promise.all([
        AsyncStorage.getItem(scopedKey),
        AsyncStorage.getItem('@community_selected_topics_v2'),
        AsyncStorage.getItem('@littleloom_community_onboarding_v3'),
      ]);
      const parse = (s: string | null) => {
        if (!s) return [] as string[];
        try {
          const v = JSON.parse(s);
          return Array.isArray(v) ? v : [];
        } catch {
          return [];
        }
      };
      const scoped = parse(rawScoped);
      const global = parse(rawGlobal);
      let fromBlob: string[] = [];
      try {
        const blob = rawOnboarding ? JSON.parse(rawOnboarding) : null;
        if (Array.isArray(blob?.selectedTopics)) fromBlob = blob.selectedTopics;
      } catch {}
      const anyStored = scoped.length || global.length || fromBlob.length;
      if (!anyStored) {
        if (__DEV__) console.log('[CommunityNavigator] → onboarding (truly no topics stored)');
        setPhase('onboarding');
        return;
      }
      // Topics exist in AsyncStorage but context hasn't caught up — force
      // one more refresh, then go to main instead of onboarding.
      if (__DEV__) console.log('[CommunityNavigator] → main (topics exist on disk, syncing context)');
      setPhase('main');
      return;
    }

    // Single source of truth: the context's checkOnboardingStatus().
    // (It already reads scoped key → Supabase → global → in-memory.)
    const needsOnboarding = !onboardingStatus.completed || !onboardingStatus.hasTopics;

    if (__DEV__) {
      console.log('[CommunityNavigator] Init — completed:', onboardingStatus.completed,
        '| hasTopics:', onboardingStatus.hasTopics, '| needsOnboarding:', needsOnboarding);
    }

    if (needsOnboarding) {
      console.log('[CommunityNavigator] → onboarding (needs topics)');
      setPhase('onboarding');
    } else if (shouldShowSplash) {
      console.log('[CommunityNavigator] → splash (topics OK, first visit this session)');
      setPhase('splash');
    } else {
      console.log('[CommunityNavigator] → main');
      setPhase('main');
    }
  } catch (error) {
    console.error('[CommunityNavigator] Init error:', error);
    setPhase('main');
  }
};

    initialize();
    return () => { mounted = false; };
  }, [isReady, checkOnboardingStatus, getSelectedTopics, shouldShowSplash, isDetectingCountry, isAuthValid]);

  const handleSplashComplete = useCallback(async () => {
    try {
      await markSplashShown();
    } catch (e) {
      console.warn('[CommunityNavigator] markSplashShown failed:', e);
    }
    setPhase('main');
  }, [markSplashShown]);

  // Safety net: if we enter splash phase but `onAnimationComplete` never
  // fires (Reanimated issue, JS thread stall, etc.), force-transition
  // after 6 s so the user is never trapped on the splash.
  useEffect(() => {
    if (phase !== 'splash') return;
    const watchdog = setTimeout(() => {
      console.warn('[CommunityNavigator] Splash watchdog fired — force-transitioning to main');
      handleSplashComplete();
    }, 6000);
    return () => clearTimeout(watchdog);
  }, [phase, handleSplashComplete]);

  
  
  
  
  
  const communityNavRef = useRef<any>(null);

  useEffect(() => {
    
    
    if (phase !== 'main') return;

    const handleCommunityNotification = (
      response: Notifications.NotificationResponse
    ) => {
      const data = response.notification.request.content.data || {};
      const type = data.type as string;
      const screen = data.screen as string;
      const params = (data.params as Record<string, unknown>) || {};

      
      const isCommunityType =
        type === 'community_notification' ||
        type === 'chat_message' ||
        type === 'community_like' ||
        type === 'community_comment' ||
        type === 'community_follow' ||
        type === 'community_mention' ||
        type === 'community_reply' ||
        type === 'community_repost' ||
        screen === 'Chat' ||
        screen === 'ChatList' ||
        screen === 'Notifications' ||
        screen === 'PostDetail' ||
        screen === 'CommunityMemberProfile';

      if (!isCommunityType) return;

      
      const nav = communityNavRef.current;
      if (!nav || !nav.isReady?.()) {
        setTimeout(() => {
          const retryNav = communityNavRef.current;
          if (retryNav?.isReady?.()) {
            handleCommunityNotification(response);
          }
        }, 600);
        return;
      }

      try {
        
        const targetScreen = screen || (
          type === 'chat_message' ? 'Chat' :
          type === 'community_notification' ? 'Notifications' :
          type === 'community_like' ||
          type === 'community_comment' ||
          type === 'community_repost' ? 'PostDetail' :
          type === 'community_follow' ? 'CommunityMemberProfile' :
          type === 'community_mention' ? 'Notifications' :
          null
        );

        if (!targetScreen) return;

        
        
        const currentRoute = nav.getCurrentRoute?.()?.name;
        if (currentRoute && currentRoute !== 'CommunityMain' && currentRoute !== targetScreen) {
          
          nav.navigate(targetScreen, params);
        } else {
          nav.navigate(targetScreen, params);
        }

        if (__DEV__) {
          console.log('[CommunityNavigator] Routed notification to:', targetScreen, params);
        }
      } catch (error) {
        console.warn('[CommunityNavigator] Failed to handle notification:', error);
        
        try {
          communityNavRef.current?.navigate?.('CommunityMain');
        } catch {}
      }
    };

    const unsubscribe = notificationService.addResponseHandler(
      handleCommunityNotification
    );

    return () => {
      unsubscribe();
    };
  }, [phase]);

  const handleOnboardingComplete = useCallback(async (topicsFromScreen?: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const scopedTopicsKey = userId
        ? `${COMMUNITY_TOPICS_KEY}_${userId}`
        : COMMUNITY_TOPICS_KEY;

      const [rawOnboarding, rawTopics, rawScopedTopics] = await Promise.all([
        AsyncStorage.getItem(COMMUNITY_ONBOARDING_KEY),
        AsyncStorage.getItem(COMMUNITY_TOPICS_KEY),
        AsyncStorage.getItem(scopedTopicsKey),
      ]);

      const parse = (raw: string | null): string[] => {
        if (!raw) return [];
        try {
          const v = JSON.parse(raw);
          return Array.isArray(v) ? v : [];
        } catch {
          return [];
        }
      };

      // Priority: explicit screen argument > scoped key > global key > onboarding blob
      let finalTopics: string[] = [];
      if (Array.isArray(topicsFromScreen) && topicsFromScreen.length > 0) {
        finalTopics = topicsFromScreen;
      } else {
        const scoped = parse(rawScopedTopics);
        if (scoped.length > 0) finalTopics = scoped;
        else {
          const global = parse(rawTopics);
          if (global.length > 0) finalTopics = global;
          else {
            try {
              const blob = rawOnboarding ? JSON.parse(rawOnboarding) : null;
              if (Array.isArray(blob?.selectedTopics) && blob.selectedTopics.length > 0) {
                finalTopics = blob.selectedTopics;
              }
            } catch { /* ignore */ }
          }
        }
      }

      if (finalTopics.length === 0) {
        console.warn('[CommunityNavigator] Onboarding complete but 0 topics — treating as not done');
        setPhase('onboarding');
        return;
      }

      const finalOnboarding = {
        completed: true,
        selectedTopics: finalTopics,
        timestamp: new Date().toISOString(),
      };

      // Write every key the rest of the system reads, atomically-ish
      await Promise.all([
        AsyncStorage.setItem(COMMUNITY_ONBOARDING_KEY, JSON.stringify(finalOnboarding)),
        AsyncStorage.setItem(COMMUNITY_TOPICS_KEY, JSON.stringify(finalTopics)),
        AsyncStorage.setItem(scopedTopicsKey, JSON.stringify(finalTopics)),
      ]);

      await checkOnboardingStatus();
      await markSplashShown();
      // Only advance to 'main' if this was a first-run completion. If the
      // user opened onboarding in *editing* mode (from a profile / header /
      // prompt), stay on the current navigator — the caller's
      // `navigation.goBack()` handles dismissal.
      if (phase !== 'main') {
        setPhase('main');
      }
    } catch (error) {
      console.error('[CommunityNavigator] Onboarding complete error:', error);
      // Don't silently fall to 'main' if the write failed — leave the user
      // in onboarding so they can retry.
      setPhase('onboarding');
    }
  }, [markSplashShown, checkOnboardingStatus]);

  
  if (isAuthValid === false) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: CommunityColors.background.main }]}>
        <Ionicons name="lock-closed" size={48} color={CommunityColors.text.secondary} />
        <Text style={[styles.placeholderText, { marginTop: 16, color: CommunityColors.text.secondary }]}>
          Please sign in to access the community
        </Text>
      </View>
    );
  }

  // ─── Onboarding phase ────────────────────────────────────────────────
  if (phase === 'onboarding') {
    return (
      <Stack.Navigator
        key={`community-onboarding-${currentUser?.id ?? 'anon'}`}
        initialRouteName="CommunityOnboarding"
        screenOptions={ONBOARDING_SCREEN_OPTIONS}
      >
        <Stack.Screen name="CommunityOnboarding">
          {(props) => (
            <CommunityOnboardingScreen
              {...props}
              onComplete={handleOnboardingComplete}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  
  if (phase === 'splash') {
    // BUG FIX: previously this navigator only registered `CommunitySplash`.
    // Any `navigate('CommunityOnboarding', { editing: true })` from a prompt
    // or auto-trigger while the splash was still mounted therefore threw:
    //   "The action 'NAVIGATE' with payload ... was not handled by any navigator."
    // We now register the FULL stack here, but start on `CommunitySplash`.
    // On completion the navigator transitions out of this branch cleanly.
    return (
      <Stack.Navigator
        key={`community-splash-${currentUser?.id ?? 'anon'}`}
        initialRouteName="CommunitySplash"
        screenOptions={SPLASH_SCREEN_OPTIONS}
      >
        <Stack.Screen name="CommunitySplash">
          {(props) => (
            <CommunitySplashScreen
              {...props}
              onAnimationComplete={handleSplashComplete}
              onSkip={handleSplashComplete}
            />
          )}
        </Stack.Screen>
        {/* The screens below are the same set registered in the main phase.
            They are unreachable by default (initialRouteName is still the
            splash) — they exist only so that a stray `navigate(...)` during
            the splash phase lands on a registered screen instead of throwing. */}
        <Stack.Screen
          name="CommunityMain"
          component={CommunityScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Topic" component={TopicScreen} />
        <Stack.Screen
          name="CreatePost"
          component={CreatePostScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="CommunityMemberProfile" component={CommunityMemberProfileScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen
          name="CommunityProfile"
          component={CommunityProfileScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen
          name="CommunityVerification"
          component={CommunityVerificationScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen
          name="CommunityOnboarding"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        >
          {(props) => (
            <CommunityOnboardingScreen
              {...props}
              onComplete={async (topics?: string[]) => {
                await handleOnboardingComplete(topics);
                if (props.navigation.canGoBack()) props.navigation.goBack();
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="TopicMembers" component={TopicMembersScreen} />
        <Stack.Screen name="Followers" component={FollowersScreen} />
        <Stack.Screen name="Following" component={FollowingScreen} />
        <Stack.Screen name="SearchUsers" component={SearchUsersScreen} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
        <Stack.Screen
          name="Report"
          component={ReportScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
      </Stack.Navigator>
    );
  }

  // ─── Main phase ──────────────────────────────────────────────────────
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Navigator
        key={`community-main-${currentUser?.id ?? 'anon'}`}
        ref={communityNavRef}
        initialRouteName="CommunityMain"
        screenOptions={MAIN_SCREEN_OPTIONS}
      >
        <Stack.Screen
          name="CommunityMain"
          component={CommunityScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Topic" component={TopicScreen} />
        <Stack.Screen 
          name="CreatePost" 
          component={CreatePostScreen} 
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }} 
        />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="CommunityMemberProfile" component={CommunityMemberProfileScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen
          name="CommunityProfile"
          component={CommunityProfileScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen
          name="CommunityVerification"
          component={CommunityVerificationScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen
          name="CommunityOnboarding"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        >
          {(props) => (
            <CommunityOnboardingScreen
              {...props}
              onComplete={async (topics?: string[]) => {
                // Edit-mode: just refresh context so feed re-filters.
                await handleOnboardingComplete(topics);
                if (props.navigation.canGoBack()) props.navigation.goBack();
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="TopicMembers" component={TopicMembersScreen} />
        <Stack.Screen name="Followers" component={FollowersScreen} />
        <Stack.Screen name="Following" component={FollowingScreen} />
        <Stack.Screen name="SearchUsers" component={SearchUsersScreen} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
        <Stack.Screen 
          name="Report" 
          component={ReportScreen} 
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }} 
        />
      </Stack.Navigator>
    </>
  );
});

// ─── STYLES ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  inlineLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineLoadingCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 1,
  },
  inlineLoadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholderContainer: {
    flex: 1,
    backgroundColor: CommunityColors.background.main,
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    marginTop: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: CommunityColors.text.primary,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  userAvatar: {
    fontSize: 28,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: '600',
    fontSize: 16,
  },
  userHandle: {
    fontSize: 13,
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  unblockButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unblockText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default CommunityNavigator;