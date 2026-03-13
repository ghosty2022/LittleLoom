import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform, Alert, AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Configure notification handler - FIXED: Added shouldShowAlert
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,        // Required: Show alert/banner
    shouldShowBanner: true,       // Show as banner (iOS)
    shouldShowList: true,         // Show in notification center
    shouldPlaySound: true,        // Play sound
    shouldSetBadge: false,        // Don't update badge count
  }),
});

// Import navigator
import AppNavigator from './src/navigation/AppNavigator';

export default function App(): JSX.Element | null {
  const [appIsReady, setAppIsReady] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Load fonts if you have custom fonts
  const [fontsLoaded] = useFonts({
    // Add your custom fonts here
    // 'Inter-Regular': require('./assets/fonts/Inter-Regular.otf'),
  });

  useEffect(() => {
    const prepareApp = async () => {
      try {
        // Setup notifications
        await setupNotifications();
        
        // Simulate any other async initialization (API calls, etc.)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.warn('Error preparing app:', error);
      } finally {
        setAppIsReady(true);
      }
    };

    prepareApp();
  }, []);

  useEffect(() => {
    if (appIsReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded]);

  // Handle app state changes for notifications
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Handle notification responses
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const setupNotifications = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Notifications',
        'Please enable notifications for baby reminders ✨',
        [{ text: 'OK' }]
      );
      return;
    }

    // Setup Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('baby-reminders', {
        name: 'Baby Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
      });

      // Additional channel for sleep sounds
      await Notifications.setNotificationChannelAsync('sleep-sounds', {
        name: 'Sleep Sounds',
        importance: Notifications.AndroidImportance.LOW,
        sound: 'default',
      });
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      // Schedule background tasks if needed
      console.log('App went to background');
    }
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    
    // Handle navigation from notification tap
    if (data?.screen) {
      navigationRef.current?.navigate(data.screen as string, data.params);
    }
  };

  // Schedule a test notification (remove in production)
  const scheduleTestNotification = useCallback(async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "LittleLoom Reminder 🍼",
        body: "Time for baby's next feeding!",
        data: { screen: 'AddLog', params: { type: 'feed' } },
      },
      trigger: { seconds: 5 },
    });
  }, []);

  if (!appIsReady || !fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            console.log('Navigation ready');
            // Uncomment to test notifications
            // scheduleTestNotification();
          }}
        >
          <AppNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});