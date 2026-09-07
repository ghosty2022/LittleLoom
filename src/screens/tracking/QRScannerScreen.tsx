// src/screens/tracking/QRScannerScreen.tsx - COMPLETE FIXED

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import * as Haptics from 'expo-haptics';

type QRScannerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'QRScanner'>;

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const navigation = useNavigation<QRScannerNavigationProp>();

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = ({ data, type }: { data: string; type: string }) => {
    if (scanned) return;
    setScanned(true);
    
    console.log('[QRScanner] Scanned data:', data);
    console.log('[QRScanner] Barcode type:', type);
    
    // Try to extract invite code from QR data
    // Supports multiple formats:
    // - code=XXXXXX
    // - XXXXXX (just the code)
    // - https://littleloom.app/join?code=XXXXXX
    // - littleloom://join?code=XXXXXX
    let code: string | null = null;
    
    // Check for code=XXXXXX format
    const match = data.match(/[&?]code=([A-Z0-9]{6})/i);
    if (match?.[1]) {
      code = match[1];
      console.log('[QRScanner] Found code in URL parameter:', code);
    } else {
      // Check for code=XXXXXX without query params
      const directMatch = data.match(/code[:=]\s*([A-Z0-9]{6})/i);
      if (directMatch?.[1]) {
        code = directMatch[1];
        console.log('[QRScanner] Found code with code: prefix:', code);
      } else {
        // Try to find a 6-character alphanumeric code in the data
        const codeMatch = data.match(/\b([A-Z0-9]{6})\b/i);
        if (codeMatch?.[1]) {
          code = codeMatch[1].toUpperCase();
          console.log('[QRScanner] Found code as standalone:', code);
        }
      }
    }
    
    if (code) {
      console.log('[QRScanner] ✅ Valid invite code found:', code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate(100);
      
      // Navigate back to Login with the invite code
      setTimeout(() => {
        // @ts-ignore - navigation can handle this
        navigation.navigate('Login', { inviteCode: code, activeTab: 'join' });
      }, 300);
    } else {
      console.log('[QRScanner] ❌ No valid invite code found in QR data');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert(
        'Invalid QR Code',
        'This QR code does not contain a valid LittleLoom invite code. Please try again with a different code.',
        [
          { 
            text: 'Try Again', 
            onPress: () => {
              setScanned(false);
            } 
          },
          { 
            text: 'Cancel', 
            onPress: () => navigation.goBack(),
            style: 'cancel'
          }
        ]
      );
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
        barcodeScannerSettings={{ 
          barcodeTypes: ['qr', 'codabar', 'code39', 'code93', 'code128', 'ean8', 'ean13', 'itf14', 'upc_a', 'upc_e']
        }}
        enableTorch={torchOn}
      />
      
      {/* Overlay with scan box */}
      <View style={styles.overlay}>
        <View style={styles.scanBoxContainer}>
          <View style={styles.scanBox} />
          <View style={styles.scanCornerTL} />
          <View style={styles.scanCornerTR} />
          <View style={styles.scanCornerBL} />
          <View style={styles.scanCornerBR} />
          
          {/* Scanning line animation - simple indicator */}
          <View style={styles.scanLine} />
        </View>
        <Text style={styles.scanInstructions}>
          Position the QR code within the frame
        </Text>
      </View>
      
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Scan QR Code</Text>
        <TouchableOpacity 
          style={styles.torchBtn} 
          onPress={() => setTorchOn(!torchOn)}
        >
          <Ionicons 
            name={torchOn ? "flashlight" : "flashlight-outline"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>
      
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
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#667eea',
    opacity: 0.6,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanInstructions: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  topBar: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  torchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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