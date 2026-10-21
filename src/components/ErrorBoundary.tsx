import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  BackHandler,
  NativeModules,
  Appearance,
  Clipboard,
} from 'react-native';

let LinearGradient: any = View;
let Ionicons: any = null;
let Animated: any = View;
let FadeIn: any = null;
let Updates: any = null;
let BlurView: any = View;

try {
  const lg = require('expo-linear-gradient');
  LinearGradient = lg.LinearGradient;
} catch {}

try {
  const icons = require('@expo/vector-icons');
  Ionicons = icons.Ionicons;
} catch {}

try {
  const reanimated = require('react-native-reanimated');
  Animated = reanimated.default || reanimated.Animated;
  FadeIn = reanimated.FadeIn;
} catch {}

try {
  Updates = require('expo-updates');
} catch {}

try {
  const bv = require('expo-blur');
  BlurView = bv.BlurView;
} catch {}

const { height: SCREEN_H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════════════════
   AURA PALETTE (matches app DS)
   ═══════════════════════════════════════════════════════════════════════════ */

const AURA = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
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
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  isReloading: boolean;
  copied: boolean;
}

const PrimitiveFallback: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <View style={[styles.container, { backgroundColor: AURA.primary }]}>
    <View style={styles.content}>
      <Text style={styles.title}>Oops!</Text>
      <Text style={styles.subtitle}>
        Something went wrong loading LittleLoom.
      </Text>
      <TouchableOpacity
        style={[styles.primaryButtonSolid, { backgroundColor: AURA.white }]}
        onPress={onReset}
        activeOpacity={0.8}
      >
        <Text style={[styles.primaryButtonSolidText, { color: AURA.primary }]}>
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      isReloading: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  ErrorBoundary caught an error                                ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('Error:', error?.message || error);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('╚══════════════════════════════════════════════════════════════╝');

    this.props.onError?.(error, errorInfo);
  }

  handleReload = async () => {
    this.setState({ isReloading: true });
    try {
      if (Updates?.reloadAsync) {
        await Updates.reloadAsync();
        return;
      }
      if (__DEV__ && NativeModules?.DevSettings?.reload) {
        NativeModules.DevSettings.reload();
        return;
      }
      if (Platform.OS === 'android' && NativeModules?.BackHandler) {
        BackHandler.exitApp();
      } else {
        this.setState({ isReloading: false });
        this.handleReset();
      }
    } catch (e) {
      console.error('Reload failed:', e);
      this.setState({ isReloading: false });
      this.handleReset();
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      isReloading: false,
      copied: false,
    });
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  handleCopy = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Message: ${error?.message ?? 'Unknown'}`,
      error?.stack ? `\nStack:\n${error.stack}` : '',
      errorInfo?.componentStack ? `\nComponent Stack:\n${errorInfo.componentStack}` : '',
      `\nPlatform: ${Platform.OS} ${Platform.Version}`,
    ].join('\n');
    try {
      Clipboard.setString(text);
      this.setState({ copied: true });
      setTimeout(() => {
        if (this.state.hasError) this.setState({ copied: false });
      }, 2000);
    } catch {}
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      if (!Ionicons || !FadeIn) {
        return <PrimitiveFallback onReset={this.handleReset} />;
      }

      const { error, errorInfo, showDetails, isReloading, copied } = this.state;
      const isDev = __DEV__;

      // Detect theme from system — safe in class component
      const scheme = Appearance.getColorScheme();
      const isDark = scheme === 'dark';

      const AnimatedView = FadeIn ? Animated.View : View;
      const enteringProp = FadeIn ? { entering: FadeIn.duration(400) } : {};

      // ─── Aura-aligned surfaces ───
      const cardBg = isDark ? AURA.darkCard : AURA.white;
      const cardBorder = isDark ? AURA.darkBorder : AURA.gray200;
      const cardText = isDark ? AURA.white : AURA.gray900;
      const cardTextSecondary = isDark ? AURA.gray400 : AURA.gray500;

      return (
        <View style={[styles.container, { backgroundColor: isDark ? AURA.darkBg : AURA.gray50 }]}>
          {/* Aura gradient — matches App.tsx splash & Timeline */}
          <LinearGradient
            colors={
              isDark
                ? ['#0c0a09', '#1a1428', '#0c0a09']
                : ['#f8faff', '#eef0f5', '#e4e8f0']
            }
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Aura glows */}
          <LinearGradient
            colors={[`${AURA.primary}${isDark ? '45' : '28'}`, 'transparent']}
            style={styles.auraGlowTopLeft}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[`${AURA.accent}${isDark ? '38' : '22'}`, 'transparent']}
            style={styles.auraGlowBottomRight}
            start={{ x: 1, y: 1 }}
            end={{ x: 0, y: 0 }}
            pointerEvents="none"
          />

          <AnimatedView {...enteringProp} style={styles.content}>
            {/* Gradient icon ring */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[AURA.primary, AURA.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.iconInner, { backgroundColor: isDark ? AURA.darkSurface : AURA.white }]}>
                <Ionicons name="bug-outline" size={44} color={AURA.danger} />
              </View>
            </View>

            <Text style={[styles.title, { color: isDark ? AURA.white : AURA.gray900 }]}>
              Oops!
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? AURA.gray400 : AURA.gray500 }]}>
              Something went wrong loading LittleLoom.
            </Text>

            {error && (
              <View style={[styles.errorCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                {BlurView !== View && (
                  <BlurView
                    intensity={isDark ? 40 : 70}
                    style={StyleSheet.absoluteFill}
                    tint={isDark ? 'dark' : 'light'}
                  />
                )}
                <View style={styles.errorCardInner}>
                  <View style={styles.errorHeaderRow}>
                    <View style={[styles.errorBadge, { backgroundColor: `${AURA.danger}18` }]}>
                      <Ionicons name="alert-circle" size={12} color={AURA.danger} />
                      <Text style={[styles.errorBadgeText, { color: AURA.danger }]}>ERROR</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.copyBtn, { backgroundColor: copied ? `${AURA.success}18` : `${AURA.primary}12` }]}
                      onPress={this.handleCopy}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={copied ? 'checkmark' : 'copy-outline'}
                        size={12}
                        color={copied ? AURA.success : AURA.primary}
                      />
                      <Text style={[styles.copyBtnText, { color: copied ? AURA.success : AURA.primary }]}>
                        {copied ? 'Copied' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.errorMessage, { color: cardText }]} numberOfLines={3}>
                    {error.message || 'Unknown error'}
                  </Text>

                  {isDev && errorInfo && (
                    <>
                      <TouchableOpacity
                        style={[styles.detailsButton, { backgroundColor: `${AURA.primary}10` }]}
                        onPress={this.toggleDetails}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.detailsButtonText, { color: AURA.primary }]}>
                          {showDetails ? 'Hide Details' : 'Show Details'}
                        </Text>
                        <Ionicons
                          name={showDetails ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={AURA.primary}
                        />
                      </TouchableOpacity>

                      {showDetails && (
                        <ScrollView
                          style={styles.stackScroll}
                          contentContainerStyle={styles.stackContent}
                          showsVerticalScrollIndicator={true}
                        >
                          <Text style={[styles.stackText, { color: cardTextSecondary }]}>
                            {errorInfo.componentStack}
                          </Text>
                        </ScrollView>
                      )}
                    </>
                  )}
                </View>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={this.handleReset}
                activeOpacity={0.85}
                disabled={isReloading}
              >
                <LinearGradient
                  colors={[AURA.primary, AURA.accent]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="refresh" size={18} color={AURA.white} />
                  <Text style={styles.primaryButtonText}>Try Again</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { borderColor: isDark ? 'rgba(255,255,255,0.15)' : AURA.gray300 },
                  isReloading && styles.secondaryButtonDisabled,
                ]}
                onPress={this.handleReload}
                activeOpacity={0.85}
                disabled={isReloading}
              >
                {isReloading ? (
                  <Text style={[styles.secondaryButtonText, { color: isDark ? AURA.white : AURA.gray900 }]}>
                    Reloading...
                  </Text>
                ) : (
                  <>
                    <Ionicons name="reload" size={18} color={isDark ? AURA.white : AURA.gray900} />
                    <Text style={[styles.secondaryButtonText, { color: isDark ? AURA.white : AURA.gray900 }]}>
                      Reload App
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.hintText, { color: isDark ? AURA.gray500 : AURA.gray400 }]}>
              Tap "Reload App" to restart fresh, or "Try Again" to recover.
            </Text>
          </AnimatedView>
        </View>
      );
    }

    return this.props.children;
  }
}

export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        throw error;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return React.useCallback((err: Error): void => {
    setError(err);
  }, []);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  auraGlowTopLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.9,
  },
  auraGlowBottomRight: {
    position: 'absolute',
    bottom: -140,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.8,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 420,
    zIndex: 1,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AURA.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  iconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  errorCard: {
    borderRadius: 20,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: SCREEN_H * 0.36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  errorCardInner: {
    padding: 16,
  },
  errorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  errorBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 18,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stackScroll: {
    marginTop: 10,
    maxHeight: 130,
  },
  stackContent: {
    paddingVertical: 6,
  },
  stackText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 15,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: AURA.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: AURA.white,
  },
  primaryButtonSolid: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonSolidText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
  },
});

export default ErrorBoundary;