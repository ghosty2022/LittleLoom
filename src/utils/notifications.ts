// src/services/NotificationService.ts
// Add this to the initialize method

async initialize(): Promise<void> {
  if (this.isInitialized) return;

  try {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,  // ✅ This enables sound
        allowAnnouncements: true,
      },
    });

    if (status !== 'granted') {
      console.warn('[NotificationService] Permission not granted');
    }

    // Set notification handler - NO 'sound: default'
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,  // ✅ This is correct
        shouldSetBadge: true,
      }),
    });

    // Android channels - NO 'sound: default'
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,  // ✅ Use null, not 'default'
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#667eea',
      });
    }

    this.isInitialized = true;
    console.log('[NotificationService] Initialized successfully');
  } catch (error) {
    console.warn('[NotificationService] Initialization error:', error);
  }
}