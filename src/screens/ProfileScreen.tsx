import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';

const SKIN_TONES = ['👶🏻', '👶🏼', '👶🏽', '👶🏾', '👶🏿'];

export default function ProfileScreen() {
  const [baby] = useState({
    name: 'Emma',
    age: '18 months',
    skinIndex: 2,
    streak: 12,
    successes: 47,
  });

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <BlurView intensity={90} tint="light" style={styles.profileCard}>
          <Text style={styles.avatar}>{SKIN_TONES[baby.skinIndex]}</Text>
          <Text style={styles.name}>{baby.name}</Text>
          <Text style={styles.age}>{baby.age}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{baby.streak}</Text>
              <Text style={styles.statLabel}>Day Streak 🔥</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{baby.successes}</Text>
              <Text style={styles.statLabel}>Successes 🎉</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editText}>Edit Profile</Text>
          </TouchableOpacity>
        </BlurView>

        {/* Add more sections: milestones, photos placeholder, etc. */}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileCard: {
    borderRadius: 36,
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatar: { fontSize: 100, marginBottom: 16 },
  name: { fontSize: 36, fontWeight: '800', color: '#1a1a1a' },
  age: { fontSize: 20, color: '#555', marginBottom: 24 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 32 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: 'bold', color: '#667eea' },
  statLabel: { fontSize: 16, color: '#666' },
  editButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    backgroundColor: 'rgba(102,126,234,0.15)',
  },
  editText: { color: '#667eea', fontWeight: '700', fontSize: 16 },
});