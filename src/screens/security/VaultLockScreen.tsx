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
import AnimatedRe, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useSecurity } from '../../context/SecurityContext';
import { useUnifiedTrackerTheme } from '../../hooks/useUnifiedTrackerTheme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

const AURA = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  success: '#10b981',
  danger: '#ef4444',
  white: '#ffffff',
};

/* ─── Gradient Text ───────────────────────────────────────────── */
const GradientText = React.memo(({
  children, style, colors = ['#ffffff', '#fbcfe8', '#c7d2fe'],
}: {
  children: React.ReactNode; style?: any; colors?: string[];
}) => {
  const raw = typeof children === 'string' ? children : String(children ?? '');
  const letters = raw.split('');
  const interp = (c1: string, c2: string, t: number) => {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return (
          <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>
            {l}
          </Text>
        );
      })}
    </View>
  );
});

/* ─── Keypad key with press feedback ──────────────────────────── */
const VaultKey = React.memo(({
  value, onPress, onDelete, disabled, hasError,
}: {
  value: string;
  onPress: (v: string) => void;
  onDelete: () => void;
  disabled: boolean;
  hasError: boolean;
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (value === '') return <View style={styles.keyOuter} />;

  const isDelete = value === '⌫';

  return (
    <AnimatedRe.View style={[styles.keyOuter, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 15, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
        onPress={() => (isDelete ? onDelete() : onPress(value))}
        style={[
          styles.key,
          hasError && styles.keyError,
          disabled && { opacity: 0.4 },
        ]}
      >
        <LinearGradient
          colors={isDelete
            ? ['rgba(239,68,68,0.18)', 'rgba(239,68,68,0.08)']
            : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.06)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.keyInnerRing} pointerEvents="none" />
        {isDelete ? (
          <Ionicons name="backspace-outline" size={26} color={hasError ? AURA.danger : AURA.white} />
        ) : (
          <Text style={styles.keyText}>{value}</Text>
        )}
      </TouchableOpacity>
    </AnimatedRe.View>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════════════════ */

export default function VaultLockScreen() {
  const navigation = useNavigation<any>();
  const theme = useUnifiedTrackerTheme();
  const insets = useSafeAreaInsets();
  const {
    verifyPin, authenticateWithBiometric,
    isBiometricEnrolled, isBiometricHardwareAvailable,
  } = useSecurity();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleDigit = useCallback((d: string) => {
    if (isChecking) return;
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4 || next.length === 6) {
      setTimeout(() => trySubmit(next), 100);
    }
  }, [pin, isChecking]);

  const handleDelete = useCallback(() => {
    if (isChecking) return;
    setPin((p) => p.slice(0, -1));
    setError('');
  }, [isChecking]);

  const trySubmit = useCallback(async (candidate: string) => {
    setIsChecking(true);
    try {
      const ok = await verifyPin(candidate);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        navigation.goBack();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Vibration.vibrate(200);
        setError('Incorrect PIN. Try again.');
        setPin('');
      }
    } finally {
      setIsChecking(false);
    }
  }, [verifyPin, navigation]);

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
  const isDark = theme.isDark ?? false;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={isDark ? ['#0c0a09', '#1a1428', '#0c0a09'] : ['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'transparent']}
        style={styles.auraGlowTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'transparent']}
        style={styles.auraGlowBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Header close button */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
            <Ionicons name="close" size={22} color={AURA.white} />
          </TouchableOpacity>
        </View>

        {/* Hero lock icon */}
        <AnimatedRe.View entering={FadeInDown.duration(500).springify()} style={styles.heroWrap}>
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)']}
            style={styles.heroCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="lock-closed" size={42} color={AURA.white} />
          </LinearGradient>
        </AnimatedRe.View>

        {/* Title */}
        <GradientText style={styles.title}>Private Vault</GradientText>
        <Text style={styles.subtitle}>Enter your PIN to unlock</Text>

        {/* Glass card with PIN dots */}
        <AnimatedRe.View entering={FadeInUp.delay(150).duration(400).springify()} style={styles.pinCardWrap}>
          <BlurView intensity={isDark ? 40 : 80} style={styles.pinCard} tint="dark">
            <LinearGradient
              colors={['rgba(30,30,40,0.88)', 'rgba(50,50,60,0.82)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'transparent']}
              style={styles.cardTopShine}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
            />

            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const filled = i < pin.length;
                return (
                  <View key={i} style={styles.pinDotWrap}>
                    {filled && !error && (
                      <LinearGradient
                        colors={[AURA.primary, AURA.accent]}
                        style={styles.pinDotGlow}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    )}
                    <View
                      style={[
                        styles.pinDot,
                        filled && !error && { backgroundColor: AURA.white, borderColor: AURA.white },
                        error && { borderColor: AURA.danger, backgroundColor: 'rgba(239,68,68,0.3)' },
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#fecaca" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <Text style={styles.hintText}>
                {pin.length === 0 ? 'Tap digits to enter' : `${pin.length} digit${pin.length > 1 ? 's' : ''} entered`}
              </Text>
            )}
          </BlurView>
        </AnimatedRe.View>

        {/* Keypad */}
        <AnimatedRe.View entering={FadeInUp.delay(250).duration(400).springify()} style={styles.keypad}>
          {KEYS.map((k, i) => (
            <VaultKey
              key={`${k}-${i}`}
              value={k}
              onPress={handleDigit}
              onDelete={handleDelete}
              disabled={isChecking}
              hasError={!!error}
            />
          ))}
        </AnimatedRe.View>

        {/* Biometric button */}
        {hasBiometric && (
          <AnimatedRe.View entering={FadeInUp.delay(350).duration(400)} style={styles.biometricWrap}>
            <TouchableOpacity
              style={styles.biometricBtn}
              onPress={handleBiometric}
              activeOpacity={0.85}
            >
              <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
              <LinearGradient
                colors={['rgba(99,102,241,0.25)', 'rgba(236,72,153,0.15)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.biometricIconCircle}>
                <Ionicons name="finger-print" size={22} color={AURA.white} />
              </View>
              <Text style={styles.biometricText}>Use Biometrics</Text>
            </TouchableOpacity>
          </AnimatedRe.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },

  auraGlowTopLeft: {
    position: 'absolute', top: -140, left: -100,
    width: 340, height: 340, borderRadius: 170,
  },
  auraGlowBottomRight: {
    position: 'absolute', bottom: -160, right: -120,
    width: 360, height: 360, borderRadius: 180,
  },

  headerRow: {
    width: '100%', flexDirection: 'row', justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  heroWrap: { marginTop: 8, marginBottom: 14 },
  heroCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },

  title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.8)',
    marginBottom: 22, fontWeight: '500',
  },

  pinCardWrap: { width: '100%', maxWidth: 360, marginBottom: 20 },
  pinCard: {
    borderRadius: 24, padding: 22, alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  cardTopShine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 80,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },

  pinDotsRow: {
    flexDirection: 'row', gap: 16, marginBottom: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  pinDotWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pinDotGlow: { position: 'absolute', width: 26, height: 26, borderRadius: 13, opacity: 0.3 },
  pinDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },

  hintText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 12, color: '#fecaca', fontWeight: '600' },

  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 300, justifyContent: 'space-between',
    marginBottom: 20,
  },
  keyOuter: { width: 84, height: 84, marginBottom: 12 },
  key: {
    width: '100%', height: '100%',
    borderRadius: 28, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  keyError: {
    borderColor: 'rgba(239,68,68,0.5)',
  },
  keyInnerRing: {
    position: 'absolute', top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 27, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  keyText: { fontSize: 26, fontWeight: '700', color: AURA.white },

  biometricWrap: { width: '100%', maxWidth: 300, marginTop: 4 },
  biometricBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, paddingHorizontal: 22,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  biometricIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  biometricText: { color: AURA.white, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
});