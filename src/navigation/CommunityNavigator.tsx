// src/navigation/CommunityNavigator.tsx
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityStackParamList } from '../types/navigation';
import { useCommunity } from '../context/CommunityContext';
import { useUser } from '../context/UserContext';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { InteractionManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CommunityColors, CommunityGradients } from '../theme/CommunityTheme';
import CommunitySplashScreen from '../screens/community/CommunitySplashScreen';
import CommunityOnboardingScreen from '../screens/community/CommunityOnboardingScreen';

const UniversalSpinner = lazy(() => import('../components/UniversalSpinner'));
const CommunityScreen = lazy(() => import('../screens/community/CommunityScreen'));
const TopicScreen = lazy(() => import('../screens/community/TopicScreen'));
const CreatePostScreen = lazy(() => import('../screens/community/CreatePostScreen'));
const PostDetailScreen = lazy(() => import('../screens/community/PostDetailScreen'));
const UserProfileScreen = lazy(() => import('../screens/community/UserProfileScreen'));
const ChatScreen = lazy(() => import('../screens/community/ChatScreen'));
const ChatListScreen = lazy(() => import('../screens/community/ChatListScreen'));
const NotificationsScreen = lazy(() => import('../screens/community/NotificationsScreen'));
const EditCommunityProfileScreen = lazy(() => import('../screens/community/EditCommunityProfileScreen'));
const FollowersScreen = lazy(() => import('../screens/community/FollowersScreen'));
const FollowingScreen = lazy(() => import('../screens/community/FollowingScreen'));
const ReportScreen = lazy(() => import('../screens/community/ReportScreen'));

const Stack = createNativeStackNavigator<CommunityStackParamList>();

const useAutomaticCountryDetection = () => {
  const { currentUser, updateUserLocation } = useCommunity();
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let mounted = true;

    const detectCountry = async () => {
      if (!currentUser || (currentUser.country && currentUser.country !== 'Unknown')) {
        if (mounted) setIsDetecting(false);
        return;
      }

      try {
        await InteractionManager.runAfterInteractions(async () => {
          const regionCode = Localization.region;

          if (regionCode) {
            const countryName = getCountryNameFromCode(regionCode);
            if (countryName && mounted) {
              await updateUserLocation(countryName);
              setIsDetecting(false);
              return;
            }
          }

          const { status } = await Location.requestForegroundPermissionsAsync();

          if (status === 'granted' && mounted) {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });

            const reverseGeocode = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            if (reverseGeocode.length > 0 && mounted) {
              const country = reverseGeocode[0].country;
              if (country) {
                await updateUserLocation(country);
                setIsDetecting(false);
                return;
              }
            }
          }

          if (mounted) {
            const timezone = Localization.timezone;
            const countryFromTimezone = getCountryFromTimezone(timezone);
            if (countryFromTimezone) {
              await updateUserLocation(countryFromTimezone);
            }
            setIsDetecting(false);
          }
        });
      } catch (error) {
        console.log('Country detection error:', error);
        if (mounted) setIsDetecting(false);
      }
    };

    requestAnimationFrame(() => {
      detectCountry();
    });

    return () => {
      mounted = false;
    };
  }, [currentUser, updateUserLocation]);

  return isDetecting;
};

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

// FIX: LazyScreen wrapper that properly forwards navigation props
const LazyScreen: React.FC<{ 
  children: React.ReactNode;
}> = ({ children }) => (
  <Suspense fallback={null}>
    {children}
  </Suspense>
);

// FIX: Create wrapper components that properly receive and forward route/navigation props
const CommunityScreenWrapper = (props: any) => (
  <LazyScreen><CommunityScreen {...props} /></LazyScreen>
);
const TopicScreenWrapper = (props: any) => (
  <LazyScreen><TopicScreen {...props} /></LazyScreen>
);
const CreatePostScreenWrapper = (props: any) => (
  <LazyScreen><CreatePostScreen {...props} /></LazyScreen>
);
const PostDetailScreenWrapper = (props: any) => (
  <LazyScreen><PostDetailScreen {...props} /></LazyScreen>
);
const UserProfileScreenWrapper = (props: any) => (
  <LazyScreen><UserProfileScreen {...props} /></LazyScreen>
);
const ChatScreenWrapper = (props: any) => (
  <LazyScreen><ChatScreen {...props} /></LazyScreen>
);
const ChatListScreenWrapper = (props: any) => (
  <LazyScreen><ChatListScreen {...props} /></LazyScreen>
);
const NotificationsScreenWrapper = (props: any) => (
  <LazyScreen><NotificationsScreen {...props} /></LazyScreen>
);
const EditCommunityProfileScreenWrapper = (props: any) => (
  <LazyScreen><EditCommunityProfileScreen {...props} /></LazyScreen>
);
const FollowersScreenWrapper = (props: any) => (
  <LazyScreen><FollowersScreen {...props} /></LazyScreen>
);
const FollowingScreenWrapper = (props: any) => (
  <LazyScreen><FollowingScreen {...props} /></LazyScreen>
);
const ReportScreenWrapper = (props: any) => (
  <LazyScreen><ReportScreen {...props} /></LazyScreen>
);

const CommunityLoadingScreen = ({ text, subtext }: { text: string; subtext?: string }) => (
  <View style={styles.loadingContainer}>
    <LinearGradient 
      colors={CommunityGradients.header} 
      style={StyleSheet.absoluteFill}
    />
    <Suspense fallback={null}>
      <UniversalSpinner
        visible={true}
        text={text}
        subtext={subtext}
        size="large"
        overlay={false}
        blur={false}
      />
    </Suspense>
  </View>
);

export default function CommunityNavigator() {
  const { isLoading, currentUser, checkOnboardingStatus, getSelectedTopics } = useCommunity();
  const { profile: userProfile } = useUser();
  const isDetectingCountry = useAutomaticCountryDetection();

  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Check onboarding after splash completes
  useEffect(() => {
    const check = async () => {
      if (!showSplash && !isLoading && !isDetectingCountry) {
        const completed = await checkOnboardingStatus();
        const hasTopics = getSelectedTopics().length > 0;
        // Show onboarding if not completed OR if user has no topics selected
        setShowOnboarding(!completed || !hasTopics);
        setOnboardingChecked(true);
      }
    };
    check();
  }, [showSplash, isLoading, isDetectingCountry, checkOnboardingStatus, getSelectedTopics]);

  if (isLoading || isDetectingCountry || showSplash) {
    if (showSplash) {
      return (
        <CommunitySplashScreen 
          onAnimationComplete={() => setShowSplash(false)}
          userName={userProfile?.fullName}
        />
      );
    }

    return (
      <CommunityLoadingScreen 
        text={isDetectingCountry ? "Detecting your location..." : "Loading community..."}
        subtext={isDetectingCountry ? "This helps us show relevant content" : undefined}
      />
    );
  }

  if (!currentUser && userProfile) {
    return (
      <CommunityLoadingScreen 
        text="Setting up your profile..."
      />
    );
  }

  // Show onboarding before the main navigator
  if (showOnboarding && onboardingChecked) {
    return <CommunityOnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        contentStyle: { 
          backgroundColor: CommunityColors.background.main,
        },
      }}
    >
      <Stack.Screen 
        name="CommunityMain"
        component={CommunityScreenWrapper}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="Topic"
        component={TopicScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="CreatePost"
        component={CreatePostScreenWrapper}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen 
        name="PostDetail"
        component={PostDetailScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="UserProfile"
        component={UserProfileScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Chat"
        component={ChatScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="ChatList"
        component={ChatListScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Notifications"
        component={NotificationsScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="EditCommunityProfile"
        component={EditCommunityProfileScreenWrapper}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen 
        name="Followers"
        component={FollowersScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Following"
        component={FollowingScreenWrapper}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Report"
        component={ReportScreenWrapper}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});