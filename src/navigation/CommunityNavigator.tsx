import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, StatusBar } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';

import { useCommunity } from '../context/CommunityContext';
import { useUser } from '../context/UserContext';
import { useCustomization } from '../hooks/useCustomization';
import { useIntelligentSplash } from '../hooks/useIntelligentSplash';
import { useSmartNavVisibility } from '../hooks/useSmartNavVisibility';

import CommunityScreen from '../screens/community/CommunityScreen';
import TopicScreen from '../screens/community/TopicScreen';
import CreatePostScreen from '../screens/community/CreatePostScreen';
import PostDetailScreen from '../screens/community/PostDetailScreen';
import CommunityMemberProfileScreen from '../screens/community/CommunityMemberProfileScreen';
import ChatScreen from '../screens/community/ChatScreen';
import ChatListScreen from '../screens/community/ChatListScreen';
import NotificationsScreen from '../screens/community/NotificationsScreen';
import CommunityProfileScreen from '../screens/community/CommunityProfileScreen';
import FollowersScreen from '../screens/community/FollowersScreen';
import FollowingScreen from '../screens/community/FollowingScreen';
import ReportScreen from '../screens/community/ReportScreen';
import CommunitySplashScreen from '../screens/community/CommunitySplashScreen';
import CommunityOnboardingScreen from '../screens/community/CommunityOnboardingScreen';

import { CommunityColors } from '../theme/CommunityTheme';
import { InlineSpinner } from '../components/UniversalSpinner';
import type { CommunityStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<CommunityStackParamList>();

const COUNTRY_CACHE_KEY = '@littleloom_country_detected_v2';
const COUNTRY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const COMMUNITY_ONBOARDING_KEY = '@littleloom_community_onboarding_done';
const COMMUNITY_TOPICS_KEY = '@littleloom_community_topics_selected';

// Module-level country maps (not recreated per call)
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

// Automatic country detection hook
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
      // Check cache first
      try {
        const cached = await AsyncStorage.getItem(COUNTRY_CACHE_KEY);
        if (cached) {
          const { country, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < COUNTRY_CACHE_TTL) {
            await updateUserLocation(country);
            if (mounted) { done.current = true; setIsDetecting(false); }
            return;
          }
        }
      } catch { /* ignore */ }

      if (!mounted) return;
      setIsDetecting(true);

      // Try region/timezone immediately
      const region = Localization.region;
      let country = region ? getCountryFromCode(region) : null;
      if (!country) country = getCountryFromTz(Localization.timezone);

      if (country) {
        await saveAndUpdate(country);
        return;
      }

      // Fallback: location permission
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

// Inline loading view
const InlineLoadingView = React.memo(({ text }: { text: string }) => (
  <View style={styles.inlineLoadingContainer}>
    <View style={styles.inlineLoadingCard}>
      <InlineSpinner size={32} color={CommunityColors.primary} />
      <Text style={styles.inlineLoadingText}>{text}</Text>
    </View>
  </View>
));

type CommunityPhase = 'loading' | 'onboarding' | 'splash' | 'main';

// Static screen options
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

// Placeholder screens
const TopicMembersScreen = () => (
  <View style={styles.placeholderContainer}>
    <Text style={styles.placeholderText}>Topic Members</Text>
  </View>
);

const SearchUsersScreen = () => (
  <View style={styles.placeholderContainer}>
    <Text style={styles.placeholderText}>Search Users</Text>
  </View>
);

const BlockedUsersScreen = () => (
  <View style={styles.placeholderContainer}>
    <Text style={styles.placeholderText}>Blocked Users</Text>
  </View>
);

const CommunityNavigator = React.memo(() => {
  const { isLoading, currentUser, checkOnboardingStatus, getSelectedTopics, isInitialized } = useCommunity();
  const { profile: userProfile } = useUser();
  const { settings, shouldReduceMotion } = useCustomization();
  const isDetectingCountry = useAutomaticCountryDetection();
  const smartNav = useSmartNavVisibility();

  const {
    isReady: splashReady,
    shouldShowSplash,
    markShown: markSplashShown,
  } = useIntelligentSplash('community', shouldReduceMotion, settings.compactView);

  const [phase, setPhase] = useState<CommunityPhase>('loading');
  const initDone = useRef(false);

  const isReady = !isLoading && isInitialized && splashReady;

  // Force hide main tab bar when in community screens
  useEffect(() => {
    smartNav.forceHide();
    return () => {
      smartNav.forceShow();
    };
  }, [smartNav]);

  // Initialize phase
  useEffect(() => {
    if (!isReady || initDone.current) return;

    let mounted = true;
    initDone.current = true;

    const initialize = async () => {
      const [completed, selectedTopics, onboardingDone, topicsStored] = await Promise.all([
        checkOnboardingStatus(),
        getSelectedTopics(),
        AsyncStorage.getItem(COMMUNITY_ONBOARDING_KEY),
        AsyncStorage.getItem(COMMUNITY_TOPICS_KEY),
      ]);

      if (!mounted) return;

      const hasTopics = selectedTopics.length > 0 || (topicsStored ? JSON.parse(topicsStored).length > 0 : false);
      const isOnboardingDone = completed || onboardingDone === 'true';

      if (__DEV__) {
        console.log('[CommunityNavigator] Init - onboardingDone:', isOnboardingDone, 'hasTopics:', hasTopics);
      }

      if (!isOnboardingDone || !hasTopics) {
        setPhase('onboarding');
      } else if (shouldShowSplash && !isDetectingCountry) {
        setPhase('splash');
      } else {
        setPhase('main');
      }
    };

    initialize();
    return () => { mounted = false; };
  }, [isReady, checkOnboardingStatus, getSelectedTopics, shouldShowSplash, isDetectingCountry]);

  const handleSplashComplete = useCallback(async () => {
    await markSplashShown();
    setPhase('main');
  }, [markSplashShown]);

  const handleOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(COMMUNITY_ONBOARDING_KEY, 'true');
    setPhase('main');
    markSplashShown();
  }, [markSplashShown]);

  if (!isReady || phase === 'loading') {
    return (
      <InlineLoadingView
        text={isDetectingCountry ? 'Detecting location...' : 'Loading community...'}
      />
    );
  }

  if (phase === 'onboarding') {
    return (
      <Stack.Navigator
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
    return (
      <Stack.Navigator
        initialRouteName="CommunitySplash"
        screenOptions={SPLASH_SCREEN_OPTIONS}
      >
        <Stack.Screen name="CommunitySplash">
          {(props) => (
            <CommunitySplashScreen
              {...props}
              onAnimationComplete={handleSplashComplete}
              userName={userProfile?.fullName || currentUser?.displayName || 'Parent'}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  // Main community stack
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Navigator
        initialRouteName="CommunityMain"
        screenOptions={MAIN_SCREEN_OPTIONS}
      >
        <Stack.Screen
          name="CommunityMain"
          component={CommunityScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Topic" component={TopicScreen} />
        <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
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
        <Stack.Screen name="TopicMembers" component={TopicMembersScreen} />
        <Stack.Screen name="Followers" component={FollowersScreen} />
        <Stack.Screen name="Following" component={FollowingScreen} />
        <Stack.Screen name="SearchUsers" component={SearchUsersScreen} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
        <Stack.Screen name="Report" component={ReportScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      </Stack.Navigator>
    </>
  );
});

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
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  inlineLoadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.main,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: CommunityColors.text.primary,
  },
});

export default CommunityNavigator;