import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type QRScannerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'QRScanner'>;

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const navigation = useNavigation<QRScannerNavigationProp>();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    
    // Try to extract invite code from QR data
    // Supports formats: code=XXXXXX or just the 6-digit code
    let code: string | null = null;
    
    // Check for code=XXXXXX format
    const match = data.match(/code=([A-Z0-9]{6})/i);
    if (match?.[1]) {
      code = match[1];
    } else {
      // Try to find a 6-character alphanumeric code in the data
      const codeMatch = data.match(/\b([A-Z0-9]{6})\b/i);
      if (codeMatch?.[1]) {
        code = codeMatch[1].toUpperCase();
      }
    }
    
    if (code) {
      // Navigate back to Login or SignUp with the invite code
      // @ts-ignore - navigation can handle this
      navigation.navigate('Login', { inviteCode: code, activeTab: 'join' });
    } else {
      Alert.alert(
        'Invalid QR Code',
        'This QR code does not contain a valid LittleLoom invite code. Please try again with a different code.'
      );
      setTimeout(() => setScanned(false), 2000);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16 }}>
          Camera permission is required to scan QR codes.
        </Text>
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
      
      {/* Overlay with scan box */}
      <View style={styles.overlay}>
        <View style={styles.scanBoxContainer}>
          <View style={styles.scanBox} />
          <View style={styles.scanCornerTL} />
          <View style={styles.scanCornerTR} />
          <View style={styles.scanCornerBL} />
          <View style={styles.scanCornerBR} />
        </View>
        <Text style={styles.scanInstructions}>
          Position the QR code within the frame
        </Text>
      </View>
      
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <View style={styles.closeBtnInner}>
          <Ionicons name="close" size={28} color="#fff" />
        </View>
      </TouchableOpacity>
      
      {/* Processing overlay */}
      {scanned && (
        <View style={styles.processing}>
          <View style={styles.processingContent}>
            <Text style={styles.processingText}>Processing…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  btn: { 
    marginTop: 20, 
    backgroundColor: '#667eea', 
    padding: 16, 
    borderRadius: 12 
  },
  btnText: { 
    color: '#fff', 
    fontWeight: '700' 
  },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  scanBoxContainer: {
    position: 'relative',
    width: 280,
    height: 280,
  },
  scanBox: { 
    width: 280, 
    height: 280, 
    borderWidth: 2, 
    borderColor: 'rgba(255,255,255,0.4)', 
    borderRadius: 16, 
    backgroundColor: 'transparent' 
  },
  scanCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#667eea',
    borderRadius: 4,
  },
  scanCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#667eea',
    borderRadius: 4,
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#667eea',
    borderRadius: 4,
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#667eea',
    borderRadius: 4,
  },
  scanInstructions: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  closeBtn: { 
    position: 'absolute', 
    top: 56, 
    right: 24, 
    zIndex: 10 
  },
  closeBtnInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processing: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  processingContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  processingText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '700' 
  },
});