// src/utils/logoutUtils.ts
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export const showLogoutConfirmation = async (
  authContext: ReturnType<typeof useAuth>,
  onLogoutComplete?: () => void
) => {
  Alert.alert(
    'Sign Out',
    'Are you sure you want to sign out? You will need to sign in again to access your account.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authContext.signOut();
            // Navigation will automatically redirect to login
            if (onLogoutComplete) {
              onLogoutComplete();
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ],
    { cancelable: false }
  );
};