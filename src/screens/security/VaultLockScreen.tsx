// src/screens/security/VaultLockScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════
// PIN fallback screen for the private vault when biometrics aren't available.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Vibration,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useSecurity } from '../../context/SecurityContext';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function VaultLockScreen() {
  const navigation = useNavigation<any>();
  const theme = useUnifiedTrackerTheme();
  const insets = useSafeAreaInsets();
  const { verifyPin, authenticateWithBiometric, isBiometricEnrolled, isBiometricHardwareAvailable } = useSecurity();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleDigit = useCallback(
    (d: string) => {
      if (isChecking) return;
      if (d === '⌫') {
        setPin((p) => p.slice(0, -1));
        setError('');
        return;
      }
      if (pin.length >= 6) return;
      const next = pin + d;
      setPin(next);
      setError('');

      // Auto-submit at 4+ digits if user has 4-digit PIN
      if (next.length === 4 || next.length === 6) {
        setTimeout(() => trySubmit(next), 100);
      }
    },
    [pin, isChecking]
  );

  const trySubmit = useCallback(
    async (candidate: string) => {
      setIsChecking(true);
      try {
        const ok = await verifyPin(candidate);
        if (ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          navigation.goBack();
          // The gallery will re-check vault unlock status when it regains focus
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          Vibration.vibrate(200);
          setError('Incorrect PIN. Try again.');
          setPin('');
        }
      } finally {
        setIsChecking(false);
      }
    },
    [verifyPin, navigation]
  );

  const handleBiometric = useCallback(async () => {
    try {
      const result = await authenticateWithBiometric('Unlock Vault');
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        navigation.goBack();
      }
    } catch {}
  }, [authenticateWithBiometric, navigation]);

  const hasBiometric = isBiometricEnrolled && isBiometricHardwareAvailable;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={
          theme.isDark
            ? ['#0a0a1a', '#12122a', '#1a1a3e']
            : ['#667eea', '#764ba2', '#f093fb']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={44} color="#fff" />
        </View>
        <Text style={styles.title}>Private Vault</Text>
        <Text style={styles.subtitle}>Enter your PIN to unlock</Text>

        {/* PIN dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length && styles.dotFilled,
                error ? styles.dotError : null,
              ]}
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Keypad */}
        <View style={styles.keypad}>
          {KEYS.map((k, i) => {
            if (k === '') return <View key={`empty-${i}`} style={styles.key} />;
            return (
              <TouchableOpacity
                key={k}
                style={styles.key}
                onPress={() => handleDigit(k)}
                activeOpacity={0.7}
              >
                {k === '⌫' ? (
                  <Ionicons name="backspace-outline" size={28} color="#fff" />
                ) : (
                  <Text style={styles.keyText}>{k}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {hasBiometric ? (
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometric}
            activeOpacity={0.8}
          >
            <Ionicons name="finger-print" size={24} color="#fff" />
            <Text style={styles.biometricText}>Use Biometrics</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  closeBtn: { position: 'absolute', top: 60, right: 20, zIndex: 10 },

  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20, marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.75)', marginTop: 6, marginBottom: 32 },

  dotsRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  dotFilled: { backgroundColor: '#fff', borderColor: '#fff' },
  dotError: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.4)' },

  errorText: { color: '#fecaca', fontSize: 13, marginTop: 8, marginBottom: 8, textAlign: 'center' },

  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 300, justifyContent: 'space-between',
    marginTop: 24,
  },
  key: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  keyText: { fontSize: 28, fontWeight: '600', color: '#fff' },

  biometricBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24, marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  biometricText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});