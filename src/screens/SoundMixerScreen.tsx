import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Slider,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const SOUND_LAYERS = [
  { id: '1', name: 'Rain', emoji: '🌧️', color: '#667eea', volume: 0.7 },
  { id: '2', name: 'White Noise', emoji: '🌬️', color: '#11998e', volume: 0.5 },
  { id: '3', name: 'Heartbeat', emoji: '💓', color: '#fa709a', volume: 0.3 },
  { id: '4', name: 'Lullaby', emoji: '🎵', color: '#fee140', volume: 0.6 },
];

const PRESETS = [
  { id: '1', name: 'Sleepy Time', emoji: '😴', sounds: ['Rain', 'White Noise'] },
  { id: '2', name: 'Calm Down', emoji: '🧘', sounds: ['Heartbeat', 'Lullaby'] },
  { id: '3', name: 'Nap Time', emoji: '💤', sounds: ['Rain', 'Lullaby'] },
];

export default function SoundMixerScreen({ navigation }: any) {
  const [layers, setLayers] = useState(SOUND_LAYERS);
  const [isPlaying, setIsPlaying] = useState(false);

  const updateVolume = (id: string, volume: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, volume } : l));
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Sound Mixer 🎛️</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Master Control */}
        <BlurView intensity={90} style={styles.masterCard}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <LinearGradient
              colors={isPlaying ? ['#fa709a', '#fee140'] : ['#667eea', '#764ba2']}
              style={styles.playGradient}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={40} 
                color="white" 
              />
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.masterInfo}>
            <Text style={styles.masterTitle}>
              {isPlaying ? 'Playing Mix' : 'Ready to Play'}
            </Text>
            <Text style={styles.masterSubtitle}>
              {layers.filter(l => l.volume > 0).length} active layers
            </Text>
          </View>
        </BlurView>

        {/* Presets */}
        <Text style={styles.sectionTitle}>Quick Presets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
          {PRESETS.map((preset) => (
            <TouchableOpacity key={preset.id} style={styles.presetCard}>
              <BlurView intensity={80} style={styles.presetBlur}>
                <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetSounds}>{preset.sounds.join(' + ')}</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sound Layers */}
        <Text style={styles.sectionTitle}>Sound Layers</Text>
        <BlurView intensity={90} style={styles.layersContainer}>
          {layers.map((layer, index) => (
            <View key={layer.id}>
              <View style={styles.layerRow}>
                <View style={[styles.layerIcon, { backgroundColor: `${layer.color}20` }]}>
                  <Text style={styles.layerEmoji}>{layer.emoji}</Text>
                </View>
                <View style={styles.layerInfo}>
                  <Text style={styles.layerName}>{layer.name}</Text>
                  <View style={styles.sliderContainer}>
                    <Ionicons name="volume-low" size={16} color="#999" />
                    <Slider
                      style={styles.slider}
                      value={layer.volume}
                      onValueChange={(value) => updateVolume(layer.id, value)}
                      minimumValue={0}
                      maximumValue={1}
                      minimumTrackTintColor={layer.color}
                      maximumTrackTintColor="rgba(0,0,0,0.1)"
                      thumbTintColor={layer.color}
                    />
                    <Ionicons name="volume-high" size={16} color="#999" />
                  </View>
                </View>
                <Text style={styles.volumeText}>{Math.round(layer.volume * 100)}%</Text>
              </View>
              {index !== layers.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </BlurView>

        {/* Add Custom */}
        <TouchableOpacity style={styles.addButton}>
          <BlurView intensity={80} style={styles.addBlur}>
            <Ionicons name="add" size={24} color="#667eea" />
            <Text style={styles.addText}>Add Custom Sound</Text>
          </BlurView>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  playButton: {
    marginRight: 20,
  },
  playGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  masterInfo: {
    flex: 1,
  },
  masterTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  masterSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    marginTop: 8,
  },
  presetsScroll: {
    marginBottom: 24,
  },
  presetCard: {
    width: 140,
    marginRight: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  presetBlur: {
    padding: 20,
    alignItems: 'center',
  },
  presetEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  presetName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  presetSounds: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  layersContainer: {
    borderRadius: 24,
    paddingVertical: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  layerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  layerEmoji: {
    fontSize: 24,
  },
  layerInfo: {
    flex: 1,
  },
  layerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    marginHorizontal: 8,
    height: 40,
  },
  volumeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    width: 40,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 84,
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
});