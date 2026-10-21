import { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const ONBOARDING_SEEN_KEY = '@littleloom_onboarding_seen_v3';

interface SplashScreenProps {
  navigation?: any;
  onAnimationComplete?: () => void;
  onNavigateToOnboarding?: () => void;
  onNavigateToLogin?: () => void;
}

/**
 * Lightweight router-only splash.
 *
 * App.tsx's CustomSplashScreen already paints the animated aura splash during
 * cold boot. This screen exists ONLY as a deep-link / restored-nav handoff
 * fallback so navigation can route to Login or Onboarding in a single frame.
 *
 * Runs in ~1 frame + one AsyncStorage read (typically <50ms, hard-capped 300ms).
 * Paints a minimal gradient so it never flickers if it must appear.
 */
export default function SplashScreen({
  navigation,
  onAnimationComplete,
  onNavigateToOnboarding,
  onNavigateToLogin,
}: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const routedRef = useRef(false);

  useEffect(() => {
    if (routedRef.current) return;
    routedRef.current = true;

    let cancelled = false;

    (async () => {
      // Hard timeout — never block more than 300ms even if storage hangs.
      const timeout = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 300)
      );

      let hasSeen = false;
      try {
        const result = await Promise.race([
          AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
          timeout,
        ]);
        hasSeen = result === 'true';
      } catch {
        hasSeen = false;
      }

      if (cancelled) return;

      // Allow the caller to intercept — useful when the caller wants to
      // handle the routing itself (e.g. a wrapper that shows its own UI).
      if (onAnimationComplete) {
        onAnimationComplete();
        return;
      }

      try {
        if (hasSeen) {
          if (onNavigateToLogin) onNavigateToLogin();
          else navigation?.replace?.('Login');
        } else {
          if (onNavigateToOnboarding) onNavigateToOnboarding();
          else navigation?.replace?.('Onboarding');
        }
      } catch {
        try {
          navigation?.replace?.('Login');
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#ec4899']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});