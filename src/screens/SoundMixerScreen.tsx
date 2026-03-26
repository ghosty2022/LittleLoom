

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
// FIX: Import Slider from @react-native-community/slider instead of react-native
import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type SoundMixerScreenProps = NativeStackScreenProps<RootStackParamList, 'SoundMixer'>;

const { width } = Dimensions.get('window');

interface SoundTrack {
  id: string;
  name: string;
  emoji: string;
  color: string;
  volume: number;
  isPlaying: boolean;
  isMuted: boolean;
}

const INITIAL_TRACKS: SoundTrack[] = [
  { id: '1', name: 'Lullaby', emoji: '🌙', color: '#667eea', volume: 0.7, isPlaying: false, isMuted: false },
  { id: '2', name: 'Rain', emoji: '🌧️', color: '#11998e', volume: 0.5, isPlaying: false, isMuted: false },
  { id: '3', name: 'White Noise', emoji: '🌀', color: '#fc5c7d', volume: 0.6, isPlaying: false, isMuted: false },
  { id: '4', name: 'Heartbeat', emoji: '💓', color: '#fa709a', volume: 0.4, isPlaying: false, isMuted: false },
  { id: '5', name: 'Nature', emoji: '🌿', color: '#43e97b', volume: 0.5, isPlaying: false, isMuted: false },
];

export default function SoundMixerScreen({ navigation }: SoundMixerScreenProps) {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<SoundTrack[]>(INITIAL_TRACKS);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [isPlayingAll, setIsPlayingAll] = useState(false);

  const updateTrack = useCallback((id: string, updates: Partial<SoundTrack>) => {
    setTracks(prev => prev.map(track => 
      track.id === id ? { ...track, ...updates } : track
    ));
  }, []);

  const togglePlay = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const track = tracks.find(t => t.id === id);
    updateTrack(id, { isPlaying: !track?.isPlaying });
  }, [tracks, updateTrack]);

  const toggleMute = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const track = tracks.find(t => t.id === id);
    updateTrack(id, { isMuted: !track?.isMuted });
  }, [tracks, updateTrack]);

  const updateVolume = useCallback((id: string, volume: number) => {
    updateTrack(id, { volume });
  }, [updateTrack]);

  const playAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlayingAll(!isPlayingAll);
    setTracks(prev => prev.map(track => ({ ...track, isPlaying: !isPlayingAll })));
  }, [isPlayingAll]);

  const stopAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPlayingAll(false);
    setTracks(prev => prev.map(track => ({ ...track, isPlaying: false })));
  }, []);

  const resetMixer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTracks(INITIAL_TRACKS);
    setMasterVolume(0.8);
    setIsPlayingAll(false);
  }, []);

  return (
    <LinearGradient 
      colors={['#1a1a2e', '#16213e', '#0f3460']} 
      style={styles.container}
    >
      <StatusBar style="light" />
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp} style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <BlurView intensity={60} style={styles.backBlur}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>
          
          <View style={styles.headerText}>
            <Text style={styles.title}>Sound Mixer</Text>
            <Text style={styles.subtitle}>Mix soothing sounds for baby sleep</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={resetMixer}
          >
            <BlurView intensity={60} style={styles.backBlur}>
              <Ionicons name="refresh" size={20} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>

        {/* Master Controls */}
        <Animated.View entering={FadeInUp.delay(100)}>
          <BlurView intensity={40} style={styles.masterCard}>
            <LinearGradient
              colors={['rgba(102,126,234,0.3)', 'rgba(118,75,162,0.3)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            
            <View style={styles.masterHeader}>
              <Text style={styles.masterTitle}>Master Volume</Text>
              <Text style={styles.masterValue}>{Math.round(masterVolume * 100)}%</Text>
            </View>
            
            {/* FIX: Use @react-native-community/slider */}
            <Slider
              style={styles.slider}
              value={masterVolume}
              onValueChange={setMasterVolume}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              minimumTrackTintColor="#667eea"
              maximumTrackTintColor="rgba(255,255,255,0.2)"
              thumbTintColor="#fff"
            />
            
            <View style={styles.masterButtons}>
              <TouchableOpacity 
                style={[styles.masterButton, isPlayingAll && styles.masterButtonActive]}
                onPress={playAll}
              >
                <Ionicons 
                  name={isPlayingAll ? "pause" : "play"} 
                  size={24} 
                  color={isPlayingAll ? "#667eea" : "#fff"} 
                />
                <Text style={[styles.masterButtonText, isPlayingAll && styles.masterButtonTextActive]}>
                  {isPlayingAll ? 'Pause All' : 'Play All'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.masterButton}
                onPress={stopAll}
              >
                <Ionicons name="stop" size={24} color="#ff6b6b" />
                <Text style={[styles.masterButtonText, { color: '#ff6b6b' }]}>Stop All</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>

        {/* Individual Tracks */}
        <Text style={styles.sectionTitle}>Sound Tracks</Text>
        
        {tracks.map((track, index) => (
          <Animated.View 
            key={track.id} 
            entering={FadeInUp.delay(200 + index * 50)}
            style={styles.trackCard}
          >
            <BlurView intensity={60} style={styles.trackBlur}>
              <View style={styles.trackHeader}>
                <View style={[styles.trackIconBg, { backgroundColor: track.color + '30' }]}>
                  <Text style={styles.trackEmoji}>{track.emoji}</Text>
                </View>
                
                <View style={styles.trackInfo}>
                  <Text style={styles.trackName}>{track.name}</Text>
                  <Text style={styles.trackVolume}>{Math.round(track.volume * 100)}%</Text>
                </View>
                
                <View style={styles.trackControls}>
                  <TouchableOpacity 
                    style={[styles.controlButton, track.isMuted && styles.controlButtonMuted]}
                    onPress={() => toggleMute(track.id)}
                  >
                    <Ionicons 
                      name={track.isMuted ? "volume-mute" : "volume-high"} 
                      size={20} 
                      color={track.isMuted ? '#ff6b6b' : '#fff'} 
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.controlButton, track.isPlaying && styles.controlButtonActive]}
                    onPress={() => togglePlay(track.id)}
                  >
                    <Ionicons 
                      name={track.isPlaying ? "pause" : "play"} 
                      size={20} 
                      color={track.isPlaying ? track.color : '#fff'} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* FIX: Use @react-native-community/slider for individual tracks */}
              <Slider
                style={styles.trackSlider}
                value={track.volume}
                onValueChange={(value) => updateVolume(track.id, value)}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                minimumTrackTintColor={track.color}
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor="#fff"
                disabled={track.isMuted}
              />
            </BlurView>
          </Animated.View>
        ))}

        {/* Presets */}
        <Text style={styles.sectionTitle}>Quick Presets</Text>
        
        <View style={styles.presetsContainer}>
          {['Sleep', 'Nap', 'Calm', 'Focus'].map((preset, index) => (
            <TouchableOpacity 
              key={preset}
              style={styles.presetButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Apply preset logic here
              }}
            >
              <BlurView intensity={60} style={styles.presetBlur}>
                <Text style={styles.presetText}>{preset}</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: { borderRadius: 16, overflow: 'hidden' },
  backBlur: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: { borderRadius: 16, overflow: 'hidden' },
  headerText: { flex: 1, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  
  masterCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  masterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  masterTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  masterValue: { fontSize: 16, fontWeight: '600', color: '#667eea' },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 20,
  },
  masterButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  masterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  masterButtonActive: {
    backgroundColor: 'rgba(102,126,234,0.3)',
  },
  masterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  masterButtonTextActive: {
    color: '#667eea',
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
  
  trackCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  trackBlur: {
    padding: 20,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  trackEmoji: { fontSize: 24 },
  trackInfo: { flex: 1 },
  trackName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  trackVolume: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  trackControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  controlButtonMuted: {
    backgroundColor: 'rgba(255,107,107,0.2)',
  },
  trackSlider: {
    width: '100%',
    height: 32,
  },
  
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
  },
  presetButton: {
    flex: 1,
    minWidth: (width - 72) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  presetBlur: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
