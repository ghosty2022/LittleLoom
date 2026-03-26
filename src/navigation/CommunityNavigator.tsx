// src/navigation/CommunityNavigator.tsx
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommunityStackParamList } from '../types/navigation';
import { useCommunity } from '../context/CommunityContext';
import { useUser } from '../context/UserContext';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { InteractionManager } from 'react-native';

// Components - lazy load heavy components
const UniversalSpinner = lazy(() => import('../components/UniversalSpinner'));

// Screens - lazy load all screens for faster startup
const CommunityScreen = lazy(() => import('../screens/community/CommunityScreen'));
const TopicScreen = lazy(() => import('../screens/community/TopicScreen'));
const CreatePostScreen = lazy(() => import('../screens/community/CreatePostScreen'));
const PostDetailScreen = lazy(() => import('../screens/community/PostDetailScreen'));
const UserProfileScreen = lazy(() => import('../screens/community/UserProfileScreen'));
const ChatScreen = lazy(() => import('../screens/community/ChatScreen'));
const NotificationsScreen = lazy(() => import('../screens/community/NotificationsScreen'));
const EditCommunityProfileScreen = lazy(() => import('../screens/community/EditCommunityProfileScreen'));

const Stack = createNativeStackNavigator<CommunityStackParamList>();

// Country detection helper using device locale and location
const useAutomaticCountryDetection = () => {
  const { currentUser, updateUserLocation } = useCommunity();
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const detectCountry = async () => {
      if (!currentUser || currentUser.country !== 'Unknown') {
        if (mounted) setIsDetecting(false);
        return;
      }

      try {
        // Defer heavy location operations to after interactions
        await InteractionManager.runAfterInteractions(async () => {
          // First try: Use device locale region (fastest)
          const regionCode = Localization.region;
          
          if (regionCode) {
            const countryName = getCountryNameFromCode(regionCode);
            if (countryName && mounted) {
              await updateUserLocation(countryName);
              setIsDetecting(false);
              return;
            }
          }

          // Second try: Request location permission (expensive)
          const { status } = await Location.requestForegroundPermissionsAsync();
          
          if (status === 'granted' && mounted) {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low, // Use low accuracy for speed
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

          // Fallback: Use timezone
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

    // Defer detection to avoid blocking startup
    requestAnimationFrame(() => {
      detectCountry();
    });

    return () => {
      mounted = false;
    };
  }, [currentUser, updateUserLocation]);

  return isDetecting;
};

// Optimized country map - load only common countries initially
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
    'CL': 'Chile', 'PE': 'Peru', 'UY': 'Uruguay', 'ZA': 'South Africa',
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

// Lazy screen wrapper with fallback
const LazyScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={null}>
    {children}
  </Suspense>
);

export default function CommunityNavigator() {
  const { isLoading, currentUser } = useCommunity();
  const { profile: userProfile } = useUser();
  const isDetectingCountry = useAutomaticCountryDetection();

  // Show spinner while community data is loading or country is being detected
  if (isLoading || isDetectingCountry) {
    return (
      <Suspense fallback={null}>
        <UniversalSpinner
          visible={true}
          text={isDetectingCountry ? "Detecting your location..." : "Loading community..."}
          subtext={isDetectingCountry ? "This helps us show relevant content" : undefined}
          size="large"
          overlay={true}
          blur={true}
        />
      </Suspense>
    );
  }

  // If user is not authenticated in community context, show auth prompt
  if (!currentUser && userProfile) {
    return (
      <Suspense fallback={null}>
        <UniversalSpinner
          visible={true}
          text="Setting up your profile..."
          size="medium"
          overlay={true}
          blur={true}
        />
      </Suspense>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen 
        name="CommunityMain"
        options={{ animation: 'fade' }}
      >
        {() => <LazyScreen><CommunityScreen /></LazyScreen>}
      </Stack.Screen>
      <Stack.Screen 
        name="Topic"
        options={{ animation: 'slide_from_right' }}
      >
        {() => <LazyScreen><TopicScreen /></LazyScreen>}
      </Stack.Screen>
      <Stack.Screen 
        name="CreatePost"
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      >
        {() => <LazyScreen><CreatePostScreen /></LazyScreen>}
      </Stack.Screen>
      <Stack.Screen 
        name="PostDetail"
        options={{ animation: 'slide_from_right' }}
      >
        {() => <LazyScreen><PostDetailScreen /></LazyScreen>}
      </Stack.Screen>
      <Stack.Screen 
        name="UserProfile"
        options={{ animation: 'slide_from_right' }}
      >
        {() => <LazyScreen><UserProfileScreen /></LazyScreen>}
      </Stack.Screen>
      <Stack.Screen 
        name="Chat"
        options={{ animation: 'slide_from_right' }}
      >
        {() => <LazyScreen><ChatScreen /></LazyScreen>}
      </Stack.Screen>
      <Stack.Screen 
        name="Notifications"
        options={{ animation: 'slide_from_right' }}
      >
        {() => <LazyScreen><NotificationsScreen /></LazyScreen>}
      </Stack.Screen>
      <Stack.Screen 
        name="EditCommunityProfile"
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      >
        {() => <LazyScreen><EditCommunityProfileScreen /></LazyScreen>}
      </Stack.Screen>
    </Stack.Navigator>
  );
}