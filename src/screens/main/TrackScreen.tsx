import React from 'react';
import { View, StyleSheet } from 'react-native';
import UniversalTrackerHubScreen from '../tracking/UniversalTrackerHubScreen';

export default function TrackScreen() {
  return (
    <View style={styles.container}>
      <UniversalTrackerHubScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
