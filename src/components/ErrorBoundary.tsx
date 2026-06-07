// src/components/ErrorBoundary.tsx
// FIXED: Added primitive fallback for when expo modules fail to load
// FIXED: useErrorHandler now has safer error throwing pattern
// FIXED: Added proper cleanup and memory leak prevention

import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';

// Safe imports with fallbacks — prevents crash if expo modules fail
let LinearGradient: any = View;
let Ionicons: any = null;
let Animated: any = View;
let FadeIn: any = null;
let Updates: any = null;

try {
  const lg = require('expo-linear-gradient');
  LinearGradient = lg.LinearGradient;
} catch { /* fallback to View */ }

try {
  const icons = require('@expo/vector-icons');
  Ionicons = icons.Ionicons;
} catch { /* fallback to text */ }

try {
  const reanimated = require('react-native-reanimated');
  Animated = reanimated.default || reanimated.Animated;
  FadeIn = reanimated.FadeIn;
} catch { /* fallback to View */ }

try {
  Updates = require('expo-updates');
} catch { /* fallback */ }

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ==================== TYPES ====================

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
}

// ==================== PRIMITIVE FALLBACK (zero dependencies) ====================

const PrimitiveFallback: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <View style={[styles.container, { backgroundColor: '#667eea' }]}>
    <View style={styles.content}>
      <Text style={styles.title}>Oops!</Text>
      <Text style={styles.subtitle}>
        Something went wrong loading LittleLoom.
      </Text>
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: '#fff' }]}
        onPress={onReset}
        activeOpacity={0.8}
      >
        <Text style={[styles.primaryButtonText, { color: '#667eea' }]}>
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ==================== MAIN ERROR BOUNDARY ====================

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
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
    try {
      if (Updates?.reloadAsync) {
        await Updates.reloadAsync();
      }
    } catch (e) {
      // If reload fails, just reset the error state
      this.handleReset();
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // If expo modules failed to load, show primitive fallback
      if (!Ionicons || !FadeIn) {
        return <PrimitiveFallback onReset={this.handleReset} />;
      }

      const { error, errorInfo, showDetails } = this.state;
      const isDev = __DEV__;

      const AnimatedView = FadeIn ? Animated.View : View;
      const enteringProp = FadeIn ? { entering: FadeIn.duration(500) } : {};

      return (
        <View style={styles.container}>
          <LinearGradient
            colors={['#667eea', '#764ba2', '#f093fb']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <AnimatedView {...enteringProp} style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="bug-outline" size={64} color="#fff" />
            </View>

            <Text style={styles.title}>Oops!</Text>
            <Text style={styles.subtitle}>
              Something went wrong loading LittleLoom.
            </Text>

            {isDev && error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Error:</Text>
                <Text style={styles.errorMessage}>{error.message}</Text>

                {errorInfo && (
                  <>
                    <TouchableOpacity
                      style={styles.detailsButton}
                      onPress={this.toggleDetails}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.detailsButtonText}>
                        {showDetails ? 'Hide Details' : 'Show Details'}
                      </Text>
                      <Ionicons
                        name={showDetails ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#667eea"
                      />
                    </TouchableOpacity>

                    {showDetails && (
                      <ScrollView
                        style={styles.stackScroll}
                        contentContainerStyle={styles.stackContent}
                        showsVerticalScrollIndicator={true}
                      >
                        <Text style={styles.stackText}>
                          {errorInfo.componentStack}
                        </Text>
                      </ScrollView>
                    )}
                  </>
                )}
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#fff', '#f0f0f0']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="refresh" size={20} color="#667eea" />
                  <Text style={styles.primaryButtonText}>Try Again</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={this.handleReload}
                activeOpacity={0.8}
              >
                <Ionicons name="reload" size={20} color="#fff" />
                <Text style={styles.secondaryButtonText}>Reload App</Text>
              </TouchableOpacity>
            </View>

            {!isDev && (
              <Text style={styles.prodHint}>
                If this keeps happening, please restart the app.
              </Text>
            )}
          </AnimatedView>
        </View>
      );
    }

    return this.props.children;
  }
}

// ==================== HOOK VERSION ====================

export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      // Use setTimeout to break synchronous execution and allow React to finish current render
      const timer = setTimeout(() => {
        throw error;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return React.useCallback((err: Error) => {
    setError(err);
  }, []);
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 420,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: SCREEN_H * 0.35,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorMessage: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
    marginBottom: 12,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 10,
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  stackScroll: {
    marginTop: 12,
    maxHeight: 150,
  },
  stackContent: {
    paddingVertical: 8,
  },
  stackText: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  prodHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default ErrorBoundary;
