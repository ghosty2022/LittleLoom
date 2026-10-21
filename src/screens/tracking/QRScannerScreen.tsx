import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Modal,
  Pressable,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

type QRScannerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'QRScanner'>;

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Aura
   ═══════════════════════════════════════════════════════════════════════════ */

const DS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  accentLight: '#f472b6',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#0ea5e9',
  danger: '#ef4444',
  white: '#ffffff',
  gray50: '#fafaf9',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray300: '#d6d3d1',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray600: '#57534e',
  gray700: '#44403c',
  gray800: '#292524',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkCard: '#292524',
  darkBorder: 'rgba(255,255,255,0.06)',
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, '2xl': 28, full: 999 },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 40, elevation: 12 },
  },
};

const HEADER_TOP_PADDING = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 14;

const SCAN_SIZE = Math.min(SCREEN_W - 80, 300);

const HAPTIC_LIGHT = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const HAPTIC_SUCCESS = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const HAPTIC_ERROR = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════════
   GradientText
   ═══════════════════════════════════════════════════════════════════════════ */

const GradientText = React.memo(({ children, style, colors = ['#667eea', '#764ba2', '#f093fb'] }: {
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {letters.map((l, i) => {
        const p = i / Math.max(letters.length - 1, 1);
        const ci = p * (colors.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, colors.length - 1);
        return <Text key={i} style={[style, { color: interp(colors[lo] || colors[0], colors[hi] || colors[colors.length - 1], ci - lo) }]}>{l}</Text>;
      })}
    </View>
  );
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const PressableScale = React.memo<{
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: any; activeScale?: number;
}>(({ children, onPress, disabled, style, activeScale = 0.94 }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedTouchable
      style={[style, anim]}
      onPress={() => { if (!disabled) { HAPTIC_LIGHT(); onPress?.(); } }}
      onPressIn={() => { scale.value = withTiming(activeScale, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      activeOpacity={disabled ? 1 : 0.85}
      disabled={disabled}
    >
      {children}
    </AnimatedTouchable>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function QRScannerScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [invalidVisible, setInvalidVisible] = useState(false);
  const [invalidData, setInvalidData] = useState<string>('');
  const navigation = useNavigation<QRScannerNavigationProp>();

  /* Scan line animation */
  const scanLineY = useSharedValue(0);
  /* Corner pulse */
  const cornerPulse = useSharedValue(1);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withSequence(
        withTiming(SCAN_SIZE - 20, { duration: 2000 }),
        withTiming(10, { duration: 2000 })
      ),
      -1,
      false
    );
    cornerPulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cornerPulse.value }],
  }));

  const handleBarCodeScanned = useCallback(({ data, type }: { data: string; type: string }) => {
    if (scanned) return;
    setScanned(true);

    if (__DEV__) {
      console.log('[QRScanner] Scanned data:', data);
      console.log('[QRScanner] Barcode type:', type);
    }

    /* Extract code */
    let code: string | null = null;

    /* 1) URL parameter: ?code=XXXXXX or &code=XXXXXX */
    const match = data.match(/[&?]code=([A-Z0-9]{6})/i);
    if (match?.[1]) {
      code = match[1];
      if (__DEV__) console.log('[QRScanner] Found code in URL parameter:', code);
    } else {
      /* 2) code:XXXXXX or code=XXXXXX */
      const directMatch = data.match(/code[:=]\s*([A-Z0-9]{6})/i);
      if (directMatch?.[1]) {
        code = directMatch[1];
        if (__DEV__) console.log('[QRScanner] Found code with code: prefix:', code);
      } else {
        /* 3) Standalone 6-char code */
        const codeMatch = data.match(/\b([A-Z0-9]{6})\b/i);
        if (codeMatch?.[1]) {
          code = codeMatch[1].toUpperCase();
          if (__DEV__) console.log('[QRScanner] Found code as standalone:', code);
        }
      }
    }

    if (code) {
      if (__DEV__) console.log('[QRScanner] ✅ Valid invite code found:', code);
      HAPTIC_SUCCESS();
      Vibration.vibrate(100);
      setTimeout(() => {
        navigation.navigate('Login', { inviteCode: code!, activeTab: 'join' });
      }, 300);
    } else {
      if (__DEV__) console.log('[QRScanner] ❌ No valid invite code found');
      HAPTIC_ERROR();
      setInvalidData(data);
      setInvalidVisible(true);
    }
  }, [scanned, navigation]);

  const handleInvalidRetry = useCallback(() => {
    setInvalidVisible(false);
    setScanned(false);
  }, []);

  const handleInvalidCancel = useCallback(() => {
    setInvalidVisible(false);
    navigation.goBack();
  }, [navigation]);

  /* ═══ Permission Screen ═══ */
  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient
          colors={['#0a0a1a', '#12122a', '#0f0f1e']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View entering={FadeInDown.duration(500).springify()} style={{ alignItems: 'center' }}>
          <View style={styles.permissionIconOuter}>
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              style={styles.permissionIconGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="camera-outline" size={44} color={DS.white} />
            </LinearGradient>
          </View>
          <Text style={styles.permissionTitle}>Camera Permission</Text>
          <Text style={styles.permissionSub}>
            LittleLoom uses your camera to scan QR codes from family invites. We never record or store video.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify()} style={{ width: '100%', paddingHorizontal: DS.space['2xl'] }}>
          <PressableScale onPress={requestPermission} activeScale={0.97}>
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              style={styles.permissionBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={DS.white} />
              <Text style={styles.permissionBtnText}>Grant Permission</Text>
            </LinearGradient>
          </PressableScale>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.permissionSecondary}>
            <Text style={styles.permissionSecondaryText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  /* ═══ Scanner Screen ═══ */
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'codabar', 'code39', 'code93', 'code128', 'ean8', 'ean13', 'itf14', 'upc_a', 'upc_e'],
        }}
        enableTorch={torchOn}
      />

      {/* Darkened backdrop overlay with cutout for scan frame */}
      <View style={styles.overlay}>
        <View style={styles.dimTop} />
        <View style={{ flexDirection: 'row', height: SCAN_SIZE }}>
          <View style={styles.dimSide} />
          <View style={styles.scanFrame}>
            {/* Animated corners */}
            <Animated.View style={[styles.cornerTL, cornerStyle]}>
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                style={styles.cornerGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
            </Animated.View>
            <Animated.View style={[styles.cornerTR, cornerStyle]}>
              <LinearGradient
                colors={[DS.accent, DS.primary]}
                style={styles.cornerGradient}
                start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
              />
            </Animated.View>
            <Animated.View style={[styles.cornerBL, cornerStyle]}>
              <LinearGradient
                colors={[DS.accent, DS.primary]}
                style={styles.cornerGradient}
                start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
              />
            </Animated.View>
            <Animated.View style={[styles.cornerBR, cornerStyle]}>
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                style={styles.cornerGradient}
                start={{ x: 1, y: 1 }} end={{ x: 0, y: 0 }}
              />
            </Animated.View>

            {/* Animated scan line */}
            <Animated.View style={[styles.scanLine, scanLineStyle]}>
              <LinearGradient
                colors={['transparent', DS.primary, DS.accent, 'transparent']}
                style={{ flex: 1 }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          </View>
          <View style={styles.dimSide} />
        </View>
        <View style={styles.dimBottom} />

        {/* Instructions */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.instructionsWrap}>
          <View style={styles.instructionsPill}>
            <Ionicons name="qr-code-outline" size={16} color={DS.primaryLight} />
            <Text style={styles.instructionsText}>Position QR code within the frame</Text>
          </View>
        </Animated.View>
      </View>

      {/* Top bar */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.topBar, { paddingTop: HEADER_TOP_PADDING }]}
      >
        <PressableScale onPress={() => navigation.goBack()} activeScale={0.9}>
          <View style={styles.iconBtn}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="arrow-back" size={22} color={DS.white} />
          </View>
        </PressableScale>

        <View style={{ alignItems: 'center' }}>
          <GradientText colors={['#a5b4fc', '#f0abfc', '#fbcfe8']} style={styles.topBarTitle}>
            SCAN QR
          </GradientText>
          <Text style={styles.topBarSub}>
            {torchOn ? 'Torch on' : 'Point at a code'}
          </Text>
        </View>

        <PressableScale onPress={() => setTorchOn(!torchOn)} activeScale={0.9}>
          <View style={[styles.iconBtn, torchOn && { backgroundColor: `${DS.primary}40` }]}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={22}
              color={torchOn ? DS.warning : DS.white}
            />
            {torchOn && <View style={styles.torchActiveDot} />}
          </View>
        </PressableScale>
      </Animated.View>

      {/* Processing overlay */}
      {scanned && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.processingOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.processingCard}>
            <LinearGradient
              colors={[DS.primary, DS.accent]}
              style={styles.processingIcon}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark-circle" size={36} color={DS.white} />
            </LinearGradient>
            <Text style={styles.processingTitle}>Code Detected</Text>
            <Text style={styles.processingSub}>Opening sign-up…</Text>
            <View style={styles.processingDots}>
              {[0, 1, 2].map((i) => (
                <ProcessingDot key={i} delay={i * 200} />
              ))}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Invalid QR modal */}
      <Modal
        visible={invalidVisible}
        transparent
        animationType="fade"
        onRequestClose={handleInvalidCancel}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleInvalidRetry} />
          <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.modalCard}>
            <LinearGradient
              colors={['rgba(45,45,60,0.98)', 'rgba(35,35,50,0.96)']}
              style={StyleSheet.absoluteFill}
            />

            <LinearGradient
              colors={[DS.danger, '#dc2626']}
              style={styles.modalIcon}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="alert-circle" size={36} color={DS.white} />
            </LinearGradient>

            <Text style={styles.modalTitle}>Invalid QR Code</Text>
            <Text style={styles.modalDesc}>
              This QR code does not contain a valid LittleLoom invite code. Please try again with a different code.
            </Text>

            {invalidData ? (
              <View style={styles.modalDataBox}>
                <Text style={styles.modalDataLabel}>Scanned data</Text>
                <Text style={styles.modalDataText} numberOfLines={3}>
                  {invalidData.length > 120 ? `${invalidData.slice(0, 120)}…` : invalidData}
                </Text>
              </View>
            ) : null}

            <PressableScale onPress={handleInvalidRetry} activeScale={0.97} style={{ width: '100%', marginTop: DS.space.md }}>
              <LinearGradient
                colors={[DS.primary, DS.accent]}
                style={styles.modalBtnPrimary}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Ionicons name="refresh-outline" size={18} color={DS.white} />
                <Text style={styles.modalBtnPrimaryText}>Try Again</Text>
              </LinearGradient>
            </PressableScale>

            <TouchableOpacity onPress={handleInvalidCancel} style={styles.modalBtnSecondary}>
              <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ProcessingDot
   ═══════════════════════════════════════════════════════════════════════════ */

const ProcessingDot = ({ delay }: { delay: number }) => {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
        -1,
        true
      );
    }, delay);
    return () => clearTimeout(t);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.processingDot, style]} />;
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  /* ── Permission Screen ── */
  permissionContainer: {
    flex: 1, backgroundColor: DS.darkBg,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: DS.space.lg,
  },
  permissionIconOuter: {
    width: 100, height: 100, borderRadius: 30, overflow: 'hidden',
    marginBottom: DS.space.lg,
    ...DS.shadow.lg,
  },
  permissionIconGradient: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  permissionTitle: {
    fontSize: 24, fontWeight: '800', color: DS.white,
    letterSpacing: -0.4, textAlign: 'center', marginBottom: DS.space.sm,
  },
  permissionSub: {
    fontSize: 14, fontWeight: '500', color: DS.gray400,
    lineHeight: 21, textAlign: 'center', maxWidth: 320, marginBottom: DS.space['2xl'],
  },
  permissionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: DS.radius.lg,
    marginBottom: DS.space.md, ...DS.shadow.md,
  },
  permissionBtnText: { color: DS.white, fontSize: 15, fontWeight: '700' },
  permissionSecondary: { alignItems: 'center', paddingVertical: 12 },
  permissionSecondaryText: { fontSize: 13, fontWeight: '600', color: DS.gray500 },

  /* ── Overlay ── */
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  dimTop: { width: '100%', flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  dimBottom: { width: '100%', flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  dimSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' },
  scanFrame: {
    width: SCAN_SIZE, height: SCAN_SIZE,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  cornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 44, height: 44,
    borderTopLeftRadius: 20, overflow: 'hidden',
  },
  cornerTR: {
    position: 'absolute', top: 0, right: 0,
    width: 44, height: 44,
    borderTopRightRadius: 20, overflow: 'hidden',
  },
  cornerBL: {
    position: 'absolute', bottom: 0, left: 0,
    width: 44, height: 44,
    borderBottomLeftRadius: 20, overflow: 'hidden',
  },
  cornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 44, height: 44,
    borderBottomRightRadius: 20, overflow: 'hidden',
  },
  cornerGradient: {
    width: 44, height: 44,
  },
  scanLine: {
    position: 'absolute', left: 8, right: 8, height: 2,
    borderRadius: 1,
  },

  /* ── Instructions ── */
  instructionsWrap: {
    position: 'absolute', bottom: 80, alignItems: 'center',
  },
  instructionsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(20,20,30,0.75)',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: DS.radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  instructionsText: {
    color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600',
  },

  /* ── Top bar ── */
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: DS.space.lg, paddingBottom: DS.space.md,
    zIndex: 10,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  torchActiveDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: DS.warning,
    borderWidth: 1, borderColor: DS.white,
  },
  topBarTitle: {
    fontSize: 15, fontWeight: '800', letterSpacing: 0.8,
    textAlign: 'center',
  },
  topBarSub: {
    fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.65)',
    marginTop: 1, textAlign: 'center',
  },

  /* ── Processing overlay ── */
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center', alignItems: 'center',
  },
  processingCard: {
    alignItems: 'center', paddingHorizontal: 32, paddingVertical: 28,
    borderRadius: DS.radius.xl,
    backgroundColor: 'rgba(20,20,30,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ...DS.shadow.lg,
  },
  processingIcon: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.space.md,
  },
  processingTitle: {
    fontSize: 17, fontWeight: '800', color: DS.white,
    letterSpacing: -0.3, marginBottom: 4,
  },
  processingSub: {
    fontSize: 12, fontWeight: '500', color: DS.gray400,
    marginBottom: DS.space.md,
  },
  processingDots: {
    flexDirection: 'row', gap: 6,
  },
  processingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: DS.primaryLight,
  },

  /* ── Invalid Modal ── */
  modalBackdrop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: DS.space['2xl'],
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    width: '100%', maxWidth: 380,
    borderRadius: DS.radius['2xl'], padding: DS.space['2xl'],
    alignItems: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ...DS.shadow.lg,
  },
  modalIcon: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.space.lg,
  },
  modalTitle: {
    fontSize: 19, fontWeight: '800', color: DS.white,
    letterSpacing: -0.3, marginBottom: 6, textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13, fontWeight: '500', color: DS.gray400,
    lineHeight: 19, textAlign: 'center', marginBottom: DS.space.md,
  },
  modalDataBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: DS.radius.md, padding: DS.space.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: DS.space.sm,
  },
  modalDataLabel: {
    fontSize: 9, fontWeight: '800', color: DS.gray500,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  modalDataText: {
    fontSize: 11, fontWeight: '500', color: DS.gray300,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: DS.radius.md,
    ...DS.shadow.md,
  },
  modalBtnPrimaryText: { color: DS.white, fontSize: 14, fontWeight: '700' },
  modalBtnSecondary: {
    width: '100%', paddingVertical: 12, alignItems: 'center',
    marginTop: 4,
  },
  modalBtnSecondaryText: {
    fontSize: 13, fontWeight: '600', color: DS.gray400,
  },
});