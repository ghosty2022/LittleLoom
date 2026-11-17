// src/components/InCallPill.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCall } from '../context/CallContext';
import { useCustomization } from '../hooks/useCustomization';

const DS = {
  primary: '#6366f1',
  success: '#10b981',
  danger: '#ef4444',
  white: '#fff',
  darkBorder: 'rgba(255,255,255,0.06)',
};

/**
 * Floating "in call" pill shown when a call is active but the CallScreen
 * is not focused (i.e. `isCallMinimized === true`).
 *
 * MUST be rendered inside AppNavigator's NavigationContainer — `useNavigation`
 * requires a navigation context ancestor. See AppNavigator.tsx.
 */
export function InCallPill() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDark } = useCustomization();
  const { activeCall, isCallMinimized, restoreCall, endCall } = useCall();

  // All hooks are called before this early return — Rules of Hooks safe.
  if (!activeCall || !isCallMinimized) return null;

  const peerName = activeCall.peer?.name ?? 'In call';

  return (
    <View
      style={[
        styles.wrap,
        {
          top: insets.top + 6,
          backgroundColor: isDark
            ? 'rgba(28,25,23,0.96)'
            : 'rgba(255,255,255,0.98)',
          borderColor: isDark ? DS.darkBorder : '#e7e5e4',
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.pill}
        onPress={() => {
          restoreCall();
          navigation.navigate('Call');
        }}
      >
        <Ionicons name="call" size={14} color={DS.success} />
        <Text
          style={[styles.label, { color: isDark ? DS.white : '#1c1917' }]}
          numberOfLines={1}
        >
          {peerName} · Tap to return
        </Text>
        <TouchableOpacity
          onPress={() => endCall()}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={14} color={DS.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 4,
  },
});