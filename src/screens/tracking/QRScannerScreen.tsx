import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    const match = data.match(/code=([A-Z0-9]{6})/);
    if (match?.[1]) {
      const code = match[1];
      // @ts-ignore
      navigation.navigate('Login', { inviteCode: code, activeTab: 'join' });
    } else {
      Alert.alert('Invalid QR', 'This is not a valid LittleLoom invite code.');
      setTimeout(() => setScanned(false), 2000);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff' }}>Camera permission is required.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.overlay}>
        <View style={styles.scanBox} />
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>
      {scanned && (
        <View style={styles.processing}>
          <Text style={styles.processingText}>Processing…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  btn: { marginTop: 20, backgroundColor: '#667eea', padding: 16, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanBox: { width: 260, height: 260, borderWidth: 2, borderColor: '#fff', borderRadius: 16, backgroundColor: 'transparent' },
  closeBtn: { position: 'absolute', top: 56, right: 24, zIndex: 10 },
  processing: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  processingText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});