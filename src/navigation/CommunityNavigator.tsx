// src/navigation/CommunityNavigator.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';

import { CommunityStackParamList } from '../types/navigation';
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
import FollowersScreen from '../screens/community/FollowersScreen';
import FollowingScreen from '../screens/community/FollowingScreen';
import ReportScreen from '../screens/community/ReportScreen';
import CommunitySplashScreen from '../screens/community/CommunitySplashScreen';
import CommunityOnboardingScreen from '../screens/community/CommunityOnboardingScreen';

import { InlineSpinner, CommunitySpinner } from '../components/UniversalSpinner';
import { CommunityColors } from '../theme/CommunityTheme';

const Stack = createNativeStackNavigator<CommunityStackParamList>();

const COUNTRY_CACHE_KEY = '@littleloom_country_detected_v2';
const COUNTRY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const COMMUNITY_ONBOARDING_KEY = '@littleloom_community_onboarding_done';
const COMMUNITY_TOPICS_KEY = '@littleloom_community_topics_selected';

const useAutomaticCountryDetection = () => {
  const { currentUser, updateUserLocation } = useCommunity();
  const [isDetecting, setIsDetecting] = useState(false);
  const detectionRan = useRef(false);

  useEffect(() => {
    if (detectionRan.current) return;
    if (!currentUser) return;
    if (currentUser.country && currentUser.country !== 'Unknown') return;

    const detectCountry = async () => {
      try {
        const cached = await AsyncStorage.getItem(COUNTRY_CACHE_KEY);
        if (cached) {
          const { country, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < COUNTRY_CACHE_TTL) {
            await updateUserLocation(country);
            detectionRan.current = true;
            return;
          }
        }
      } catch (e) { /* ignore cache errors */ }

      setIsDetecting(true);

      try {
        const regionCode = Localization.region;
        if (regionCode) {
          const countryName = getCountryNameFromCode(regionCode);
          if (countryName) {
            await saveAndUpdate(countryName);
            return;
          }
        }

        const timezone = Localization.timezone;
        const countryFromTimezone = getCountryFromTimezone(timezone);
        if (countryFromTimezone) {
          await saveAndUpdate(countryFromTimezone);
          return;
        }

        setTimeout(async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.getCurrentPositionAsync({ 
                accuracy: Location.Accuracy.Low 
              });
              const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              if (reverseGeocode.length > 0 && reverseGeocode[0].country) {
                await saveAndUpdate(reverseGeocode[0].country);
                return;
              }
            }
          } catch (locError) {
            console.log('Location detection failed:', locError);
          }
          setIsDetecting(false);
          detectionRan.current = true;
        }, 500);
      } catch (error) {
        console.log('Country detection error:', error);
        setIsDetecting(false);
        detectionRan.current = true;
      }
    };

    const saveAndUpdate = async (country: string) => {
      await AsyncStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify({ 
        country, 
        timestamp: Date.now() 
      }));
      await updateUserLocation(country);
      setIsDetecting(false);
      detectionRan.current = true;
    };

    const timer = setTimeout(detectCountry, 100);
    return () => clearTimeout(timer);
  }, [currentUser, updateUserLocation]);

  return isDetecting;
};

const InlineLoadingView = React.memo(({ text }: { text: string }) => (
  <View style={styles.inlineLoadingContainer}>
    <View style={styles.inlineLoadingCard}>
      <InlineSpinner size={32} color={CommunityColors.primary} />
      <Text style={styles.inlineLoadingText}>{text}</Text>
    </View>
  </View>
));

type CommunityPhase = 'loading' | 'onboarding' | 'splash' | 'main';

const CommunityNavigator = React.memo(() => {
  const { isLoading, currentUser, checkOnboardingStatus, getSelectedTopics, isInitialized } = useCommunity();
  const { profile: userProfile } = useUser();
  const { settings, shouldReduceMotion } = useCustomization();
  const isDetectingCountry = useAutomaticCountryDetection();

  const {
    isReady: splashReady,
    shouldShowSplash,
    markShown: markSplashShown,
  } = useIntelligentSplash('community', shouldReduceMotion, settings.compactView);

  const [phase, setPhase] = useState<CommunityPhase>('loading');
  const [navigatorKey, setNavigatorKey] = useState(0);
  const initDone = useRef(false);

  const isContextReady = !isLoading && isInitialized && splashReady;

  useEffect(() => {
    if (!isContextReady || initDone.current) return;

    const initialize = async () => {
      initDone.current = true;

      const [completed, selectedTopics] = await Promise.all([
        checkOnboardingStatus(),
        getSelectedTopics(),
      ]);

      const onboardingDone = await AsyncStorage.getItem(COMMUNITY_ONBOARDING_KEY);
      const topicsStored = await AsyncStorage.getItem(COMMUNITY_TOPICS_KEY);
      const hasTopics = selectedTopics.length > 0 || (topicsStored ? JSON.parse(topicsStored).length > 0 : false);
      const isOnboardingDone = completed || onboardingDone === 'true';

      console.log('[CommunityNavigator] Init - onboardingDone:', isOnboardingDone, 'hasTopics:', hasTopics);

      if (!isOnboardingDone || !hasTopics) {
        setPhase('onboarding');
      } else if (shouldShowSplash && !isDetectingCountry) {
        setPhase('splash');
      } else {
        setPhase('main');
      }
    };

    initialize();
  }, [isContextReady, checkOnboardingStatus, getSelectedTopics, shouldShowSplash, isDetectingCountry]);

  useEffect(() => {
    if (phase !== 'loading') {
      setNavigatorKey(prev => prev + 1);
    }
  }, [phase]);

  const handleSplashComplete = useCallback(async () => {
    await markSplashShown();
    setPhase('main');
  }, [markSplashShown]);

  const handleOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(COMMUNITY_ONBOARDING_KEY, 'true');
    setPhase('main');
    markSplashShown();
  }, [markSplashShown]);

  if (!isContextReady || phase === 'loading') {
    return (
      <CommunitySpinner
        visible={true}
        text={isDetectingCountry ? "Detecting location..." : "Loading community..."}
        subtext="Preparing your personalized experience"
        size="medium"
        overlay={true}
        blur={true}
      />
    );
  }

  if (phase === 'onboarding') {
    return (
      <Stack.Navigator
        key="community-onboarding"
        initialRouteName="CommunityOnboarding"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
          contentStyle: { backgroundColor: CommunityColors.background.main },
        }}
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
        key="community-splash"
        initialRouteName="CommunitySplash"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
          contentStyle: { backgroundColor: CommunityColors.background.main },
        }}
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

  // MAIN PHASE: Full navigator with all routes
  return (
    <Stack.Navigator
      key={`community-main-${navigatorKey}`}
      initialRouteName="CommunityMain"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: CommunityColors.background.main },
      }}
    >
      <Stack.Screen 
        name="CommunityMain" 
        component={CommunityScreen} 
        options={{ animation: 'fade' }} 
      />

      <Stack.Screen name="Topic" component={TopicScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      
      {/* NEW: Community Member Profile (view other users) */}
      <Stack.Screen name="CommunityMemberProfile" component={CommunityMemberProfileScreen} />
      
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      
      {/* NEW: Community Profile (self view/edit) */}
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
  );
});

// Placeholder components for missing screens
const TopicMembersScreen = () => <View><Text>Topic Members</Text></View>;
const SearchUsersScreen = () => <View><Text>Search Users</Text></View>;
const BlockedUsersScreen = () => <View><Text>Blocked Users</Text></View>;

const getCountryNameFromCode = (code: string): string | null => {
  const countryMap: Record<string, string> = {
    'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada', 'AU': 'Australia',
    'DE': 'Germany', 'FR': 'France', 'JP': 'Japan', 'IN': 'India', 'BR': 'Brazil',
    'MX': 'Mexico', 'NG': 'Nigeria', 'ZA': 'South Africa', 'GH': 'Ghana',
    'UG': 'Uganda', 'TZ': 'Tanzania', 'RW': 'Rwanda', 'ET': 'Ethiopia', 'EG': 'Egypt',
    'MA': 'Morocco', 'CN': 'China', 'RU': 'Russia', 'ES': 'Spain', 'IT': 'Italy',
    'NL': 'Netherlands', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
    'PL': 'Poland', 'UA': 'Ukraine', 'TR': 'Turkey', 'SA': 'Saudi Arabia', 'AE': 'United Arab Emirates',
    'IL': 'Israel', 'KR': 'South Korea', 'TH': 'Thailand', 'VN': 'Vietnam', 'ID': 'Indonesia',
    'MY': 'Malaysia', 'PH': 'Philippines', 'SG': 'Singapore', 'NZ': 'New Zealand', 'IE': 'Ireland',
    'PT': 'Portugal', 'GR': 'Greece', 'AT': 'Austria', 'CH': 'Switzerland', 'BE': 'Belgium',
    'CZ': 'Czech Republic', 'HU': 'Hungary', 'RO': 'Romania', 'BG': 'Bulgaria', 'HR': 'Croatia',
    'KE': 'Kenya', 'BD': 'Bangladesh', 'PK': 'Pakistan', 'AR': 'Argentina', 'CO': 'Colombia',
    'CL': 'Chile', 'PE': 'Peru', 'UY': 'Uruguay',
  };
  return countryMap[code.toUpperCase()] || null;
};

const getCountryFromTimezone = (timezone: string): string | null => {
  const timezoneMap: Record<string, string> = {
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
  return timezoneMap[timezone] || null;
};

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
});

export default CommunityNavigator;