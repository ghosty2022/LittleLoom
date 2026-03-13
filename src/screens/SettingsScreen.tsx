import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const MENU_ITEMS = [
  {
    id: 'profile',
    title: 'Edit Profile',
    icon: 'person-outline',
    color: '#667eea',
    screen: 'EditProfile',
  },
  {
    id: 'family',
    title: 'Family Sharing',
    icon: 'people-outline',
    color: '#fa709a',
    screen: 'FamilySharing',
  },
  {
    id: 'growth',
    title: 'Growth Charts',
    icon: 'trending-up-outline',
    color: '#11998e',
    screen: 'GrowthChart',
  },
  {
    id: 'reminders',
    title: 'Reminders',
    icon: 'alarm-outline',
    color: '#fc5c7d',
    screen: 'Reminders',
  },
  {
    id: 'achievements',
    title: 'Achievements',
    icon: 'trophy-outline',
    color: '#fee140',
    screen: 'Achievements',
  },
  {
    id: 'help',
    title: 'Help & Support',
    icon: 'help-circle-outline',
    color: '#6a82fb',
    screen: null,
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    icon: 'shield-checkmark-outline',
    color: '#38ef7d',
    screen: null,
  },
];

export default function SettingsScreen({ navigation }: any) {
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => navigation.navigate('Login')
        }
      ]
    );
  };

  const handleMenuPress = (item: typeof MENU_ITEMS[0]) => {
    if (item.screen) {
      navigation.navigate(item.screen);
    } else {
      Alert.alert(item.title, 'Coming soon!');
    }
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings ⚙️</Text>
        </View>

        {/* Profile Summary */}
        <BlurView intensity={90} style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Text style={styles.profileEmoji}>👶🏽</Text>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Emma's Parent</Text>
              <Text style={styles.profileEmail}>parent@littleloom.app</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
              <Ionicons name="chevron-forward" size={24} color="#667eea" />
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>156</Text>
              <Text style={styles.statLabel}>Days Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Achievements</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>48</Text>
              <Text style={styles.statLabel}>Logs</Text>
            </View>
          </View>
        </BlurView>

        {/* Menu Items */}
        <BlurView intensity={90} style={styles.menuContainer}>
          {MENU_ITEMS.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleMenuPress(item)}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
              {index !== MENU_ITEMS.length - 1 && <View style={styles.menuDivider} />}
            </View>
          ))}
        </BlurView>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>LittleLoom v1.0.0</Text>
          <Text style={styles.appCopyright}>Made with 💜 for parents everywhere</Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <BlurView intensity={80} style={styles.logoutBlur}>
            <Ionicons name="log-out-outline" size={24} color="#ff4757" />
            <Text style={styles.logoutText}>Logout</Text>
          </BlurView>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  profileCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileEmoji: {
    fontSize: 56,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  menuContainer: {
    borderRadius: 24,
    paddingVertical: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 80,
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appVersion: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: '#bbb',
  },
  logoutButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoutBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4757',
  },
});