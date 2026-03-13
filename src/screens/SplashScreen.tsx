import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function SplashScreen({ navigation }: any) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <LinearGradient colors={['#e0e7ff', '#c7b8ff']} style={styles.container}>
      <Text style={styles.title}>LittleLoom 🍼✨</Text>
      <Text style={styles.subtitle}>Gentle potty training companion</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 48, fontWeight: '800', color: '#4c669f' },
  subtitle: { fontSize: 20, color: '#555', marginTop: 12 },
});