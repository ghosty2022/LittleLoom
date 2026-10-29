
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

interface LogoutButtonProps {
  variant?: 'icon' | 'text' | 'full';
  onPress?: () => void;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({ 
  variant = 'text',
  onPress 
}) => {
  const auth = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to sign in again to access your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.setItem('littleloom_security_lock', 'false');
              await AsyncStorage.multiRemove([
                'littleloom_nav_state_v4',
                '@littleloom_nav_state_v4',
                'littleloom_last_auth_state',
                'littleloom_security_lock',
              ]);
              await auth.signOut();
              if (onPress) onPress();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  if (variant === 'icon') {
    return (
      <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
        <Ionicons name="log-out-outline" size={24} color="#ef4444" />
      </TouchableOpacity>
    );
  }

  if (variant === 'full') {
    return (
      <TouchableOpacity onPress={handleLogout} style={styles.fullButton}>
        <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        <Text style={styles.fullText}>Sign Out</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handleLogout} style={styles.textButton}>
      <Text style={styles.text}>Sign Out</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  textButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  fullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    gap: 12,
  },
  fullText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});