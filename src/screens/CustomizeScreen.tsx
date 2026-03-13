import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const THEME_OPTIONS = [
  { id: 'purple', name: 'Lavender Dream', colors: ['#e0e7ff', '#d1d5ff', '#c7b8ff'], emoji: '💜' },
  { id: 'pink', name: 'Rose Garden', colors: ['#ffe0e9', '#ffd1dc', '#ffc7d1'], emoji: '🌸' },
  { id: 'blue', name: 'Ocean Breeze', colors: ['#e0f7ff', '#d1f0ff', '#c7e8ff'], emoji: '🌊' },
  { id: 'green', name: 'Mint Fresh', colors: ['#e0ffe7', '#d1ffd5', '#c7ffc7'], emoji: '🌿' },
  { id: 'yellow', name: 'Sunny Day', colors: ['#fffbe0', '#fff7d1', '#fff3c7'], emoji: '☀️' },
];

const AVATAR_OPTIONS = ['👶', '🧒', '👧', '👦', '🍼', '🧸', '🎀', '⚽', '🦄', '🦁'];

export default function CustomizeScreen({ navigation }: any) {
  const [selectedTheme, setSelectedTheme] = useState('purple');
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [settings, setSettings] = useState({
    darkMode: false,
    notifications: true,
    soundEffects: true,
    hapticFeedback: true,
    compactView: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Customize 🎨</Text>
          <Text style={styles.subtitle}>Make LittleLoom yours</Text>
        </View>

        {/* Theme Selection */}
        <BlurView intensity={90} style={styles.section}>
          <Text style={styles.sectionTitle}>App Theme</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.themeContainer}>
              {THEME_OPTIONS.map((theme) => (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.themeCard,
                    selectedTheme === theme.id && styles.themeCardActive
                  ]}
                  onPress={() => setSelectedTheme(theme.id)}
                >
                  <LinearGradient colors={theme.colors} style={styles.themePreview}>
                    <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                  </LinearGradient>
                  <Text style={styles.themeName}>{theme.name}</Text>
                  {selectedTheme === theme.id && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color="#667eea" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </BlurView>

        {/* Avatar Selection */}
        <BlurView intensity={90} style={styles.section}>
          <Text style={styles.sectionTitle}>Default Avatar</Text>
          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((avatar, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.avatarButton,
                  selectedAvatar === index && styles.avatarButtonActive
                ]}
                onPress={() => setSelectedAvatar(index)}
              >
                <Text style={styles.avatarEmoji}>{avatar}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>

        {/* App Settings */}
        <BlurView intensity={90} style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#667eea20' }]}>
                <Ionicons name="moon-outline" size={20} color="#667eea" />
              </View>
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={() => toggleSetting('darkMode')}
              trackColor={{ false: '#ddd', true: '#667eea' }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#fa709a20' }]}>
                <Ionicons name="notifications-outline" size={20} color="#fa709a" />
              </View>
              <Text style={styles.settingText}>Notifications</Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={() => toggleSetting('notifications')}
              trackColor={{ false: '#ddd', true: '#fa709a' }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#11998e20' }]}>
                <Ionicons name="volume-high-outline" size={20} color="#11998e" />
              </View>
              <Text style={styles.settingText}>Sound Effects</Text>
            </View>
            <Switch
              value={settings.soundEffects}
              onValueChange={() => toggleSetting('soundEffects')}
              trackColor={{ false: '#ddd', true: '#11998e' }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#fc5c7d20' }]}>
                <Ionicons name="hand-left-outline" size={20} color="#fc5c7d" />
              </View>
              <Text style={styles.settingText}>Haptic Feedback</Text>
            </View>
            <Switch
              value={settings.hapticFeedback}
              onValueChange={() => toggleSetting('hapticFeedback')}
              trackColor={{ false: '#ddd', true: '#fc5c7d' }}
            />
          </View>
        </BlurView>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.saveGradient}>
            <Text style={styles.saveText}>Save Changes</Text>
          </LinearGradient>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  themeContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  themeCard: {
    width: 120,
    alignItems: 'center',
  },
  themeCardActive: {
    transform: [{ scale: 1.05 }],
  },
  themePreview: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  themeEmoji: {
    fontSize: 40,
  },
  themeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: -8,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarButton: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarButtonActive: {
    borderColor: '#667eea',
    backgroundColor: 'rgba(102,126,234,0.1)',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  saveGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});