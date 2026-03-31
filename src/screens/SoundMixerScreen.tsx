// src/screens/SoundMixerScreen.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  TextInput,
  Share,
  Modal,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeInUp, 
  FadeIn, 
  FadeInDown,
  Layout,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

import { useAudio, AudioTrack, SOUND_TRACKS } from '../context/AudioContext';
import { useBaby } from '../context/BabyContext';

type SoundMixerScreenProps = NativeStackScreenProps<RootStackParamList, 'SoundMixer'>;
const { width } = Dimensions.get('window');

// Sweet Alert Component
const SweetAlert = ({ visible, type, title, message, onClose, isDark }: any) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  const config = {
    success: { colors: ['#11998e', '#38ef7d'], icon: 'checkmark-circle' },
    error: { colors: ['#ef4444', '#f87171'], icon: 'alert-circle' },
    info: { colors: ['#3b82f6', '#60a5fa'], icon: 'information-circle' },
  }[type as keyof typeof config] || config.info;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 100 }]} pointerEvents="none">
      <Animated.View style={[style, alertStyles.container, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <LinearGradient colors={config.colors} style={alertStyles.iconBg}>
          <Ionicons name={config.icon as any} size={28} color="#fff" />
        </LinearGradient>
        <View style={alertStyles.textContainer}>
          <Text style={[alertStyles.title, { color: isDark ? '#fff' : '#1e293b' }]}>{title}</Text>
          <Text style={alertStyles.message}>{message}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const alertStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, minWidth: 300, maxWidth: width - 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  iconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  textContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  message: { fontSize: 13, color: '#64748b' },
});

interface Playlist {
  id: string;
  title: string;
  description: string;
  coverColor: string;
  tracks: AudioTrack[];
  type: 'system' | 'custom' | 'mood' | 'time' | 'favorites' | 'imported';
  playCount: number;
  isLiked: boolean;
  createdAt: string;
  coverImage?: string;
}

const ENHANCED_TRACKS: AudioTrack[] = [
  ...SOUND_TRACKS,
  { id: '5', title: 'Womb Sounds', artist: 'Baby Sleep', duration: '4:00', color: '#ff6b6b', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: '6', title: 'Ocean Waves', artist: 'Nature Sleep', duration: '5:30', color: '#4ecdc4', image: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: '7', title: 'Soft Piano', artist: 'Lullaby Classics', duration: '3:45', color: '#ffe66d', image: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: '8', title: 'Brown Noise', artist: 'Deep Sleep', duration: '6:00', color: '#a8e6cf', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
];

// Centered Import Modal
const ImportMusicModal = ({ visible, onClose, onImport, isDark }: { visible: boolean; onClose: () => void; onImport: (source: 'device' | 'spotify' | 'apple') => void; isDark: boolean }) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 20 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.9, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000, justifyContent: 'center', alignItems: 'center' }]} pointerEvents="box-none">
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      </TouchableOpacity>
      
      <Animated.View style={[importStyles.modalContent, modalStyle, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        <View style={importStyles.header}>
          <Text style={[importStyles.title, { color: isDark ? '#fff' : '#1e293b' }]}>Add Music</Text>
          <TouchableOpacity onPress={onClose} style={importStyles.closeBtn}>
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1e293b'} />
          </TouchableOpacity>
        </View>
        
        <Text style={importStyles.subtitle}>Choose source for baby's playlist</Text>
        
        <TouchableOpacity style={importStyles.option} onPress={() => onImport('device')}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={importStyles.gradient}>
            <Ionicons name="phone-portrait" size={28} color="#fff" />
            <View style={importStyles.textContainer}>
              <Text style={importStyles.optionTitle}>From Device</Text>
              <Text style={importStyles.optionDesc}>Import MP3 files from your phone</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={importStyles.option} onPress={() => onImport('spotify')}>
          <LinearGradient colors={['#1DB954', '#1ed760']} style={importStyles.gradient}>
            <Ionicons name="musical-notes" size={28} color="#fff" />
            <View style={importStyles.textContainer}>
              <Text style={importStyles.optionTitle}>Spotify</Text>
              <Text style={importStyles.optionDesc}>Connect to Spotify playlists</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={importStyles.option} onPress={() => onImport('apple')}>
          <LinearGradient colors={['#fa57c1', '#f093fb']} style={importStyles.gradient}>
            <Ionicons name="logo-apple" size={28} color="#fff" />
            <View style={importStyles.textContainer}>
              <Text style={importStyles.optionTitle}>Apple Music</Text>
              <Text style={importStyles.optionDesc}>Access Apple Music library</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        
        <Text style={importStyles.note}>Premium subscriptions may be required</Text>
      </Animated.View>
    </View>
  );
};

const importStyles = StyleSheet.create({
  modalContent: { width: width - 60, borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(100,116,139,0.1)', alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 24, fontWeight: '500' },
  option: { marginBottom: 12, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  gradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  textContainer: { flex: 1 },
  optionTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 2 },
  optionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  note: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});

// Fixed Playlist Card - Smaller and better text handling
const PlaylistCard: React.FC<{ playlist: Playlist; onPress: () => void; index: number }> = ({ playlist, onPress, index }) => {
  return (
    <View style={playlistCardStyles.wrapper}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={[playlist.coverColor, `${playlist.coverColor}80`]}
          style={playlistCardStyles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {playlist.coverImage && (
            <Image source={{ uri: playlist.coverImage }} style={playlistCardStyles.coverImage} />
          )}
          <View style={playlistCardStyles.iconContainer}>
            <Ionicons name="musical-notes" size={24} color="#fff" />
          </View>
          {playlist.type === 'favorites' && (
            <View style={playlistCardStyles.favBadge}>
              <Ionicons name="heart" size={14} color="#ff6b6b" />
            </View>
          )}
        </LinearGradient>
        <View style={playlistCardStyles.textContainer}>
          <Text style={playlistCardStyles.title} numberOfLines={1}>{playlist.title}</Text>
          <Text style={playlistCardStyles.desc} numberOfLines={1}>{playlist.description}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const playlistCardStyles = StyleSheet.create({
  wrapper: { width: (width - 56) / 2, marginBottom: 16 },
  gradient: { width: '100%', aspectRatio: 1.2, borderRadius: 16, padding: 12, justifyContent: 'space-between', position: 'relative' },
  coverImage: { ...StyleSheet.absoluteFillObject, opacity: 0.3, borderRadius: 16 },
  iconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  favBadge: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  textContainer: { marginTop: 8 },
  title: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 2 },
  desc: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
});

// Fixed Track Row - Better spacing
const TrackRow: React.FC<{
  track: AudioTrack;
  index: number;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  isFavorite: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
}> = ({ track, index, isPlaying, isCurrentTrack, isFavorite, onPress, onLongPress, onToggleFavorite }) => {
  return (
    <TouchableOpacity 
      style={[trackRowStyles.container, isCurrentTrack && trackRowStyles.active]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={trackRowStyles.left}>
        {!isCurrentTrack && <Text style={trackRowStyles.number}>{index + 1}</Text>}
        {isCurrentTrack && isPlaying && (
          <View style={trackRowStyles.waveform}>
            <View style={[trackRowStyles.bar, { height: 8 }]} />
            <View style={[trackRowStyles.bar, { height: 12 }]} />
            <View style={[trackRowStyles.bar, { height: 6 }]} />
          </View>
        )}
        <Image source={{ uri: track.image }} style={trackRowStyles.image} />
      </View>
      
      <View style={trackRowStyles.info}>
        <Text style={[trackRowStyles.title, isCurrentTrack && { color: track.color }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={trackRowStyles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      
      <TouchableOpacity style={trackRowStyles.favBtn} onPress={onToggleFavorite}>
        <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={20} color={isFavorite ? "#ff6b6b" : "#64748b"} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const trackRowStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)' },
  active: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  left: { flexDirection: 'row', alignItems: 'center', width: 80 },
  number: { fontSize: 13, color: '#64748b', width: 24, textAlign: 'center', fontWeight: '600' },
  waveform: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16, width: 24, justifyContent: 'center' },
  bar: { width: 3, backgroundColor: '#10b981', borderRadius: 1.5 },
  image: { width: 48, height: 48, borderRadius: 10, marginLeft: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  info: { flex: 1, marginLeft: 12, marginRight: 8 },
  title: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  artist: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  favBtn: { padding: 6, borderRadius: 16 },
});

export default function SoundMixerScreen({ navigation }: SoundMixerScreenProps) {
  const insets = useSafeAreaInsets();
  const { currentBaby } = useBaby();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    expandPlayer,
    favorites,
    toggleFavorite,
    isFavorite,
    addImportedTrack,
    removeImportedTrack,
    importedTracks,
    importFromDevice,
  } = useAudio();

  const colorScheme = 'dark'; // Simplified for this example
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'imported'>('all');
  const [alert, setAlert] = useState({ visible: false, type: 'success', title: '', message: '' });
  const [isImporting, setIsImporting] = useState(false);

  // Show sweet alert helper
  const showAlert = useCallback((type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlert({ visible: true, type, title, message });
    Haptics.notificationAsync(
      type === 'success' ? Haptics.NotificationFeedbackType.Success :
      type === 'error' ? Haptics.NotificationFeedbackType.Error :
      Haptics.NotificationFeedbackType.Warning
    );
  }, []);

  // Generate playlists
  useEffect(() => {
    const smartPlaylists: Playlist[] = [
      {
        id: 'favorites',
        title: 'Favorites',
        description: `${favorites.length} saved songs`,
        coverColor: '#ff6b6b',
        tracks: ENHANCED_TRACKS.filter(t => favorites.includes(t.id)),
        type: 'favorites',
        playCount: 0,
        isLiked: true,
        createdAt: new Date().toISOString(),
        coverImage: 'https://images.unsplash.com/photo-1514525253440-b393452e3726?w=400&q=80',
      },
      {
        id: 'imported',
        title: 'My Imports',
        description: `${importedTracks.length} imported songs`,
        coverColor: '#9b59b6',
        tracks: importedTracks,
        type: 'imported',
        playCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      },
      {
        id: 'quick-sleep',
        title: 'Quick Sleep',
        description: '15 min to dreamland',
        coverColor: '#667eea',
        tracks: ENHANCED_TRACKS.slice(0, 4),
        type: 'system',
        playCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        coverImage: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=80',
      },
      {
        id: 'deep-night',
        title: 'Deep Night',
        description: 'All night long',
        coverColor: '#1a1a2e',
        tracks: ENHANCED_TRACKS.filter(t => ['White Noise', 'Brown Noise'].includes(t.title)),
        type: 'time',
        playCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        coverImage: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&q=80',
      },
    ];
    setPlaylists(smartPlaylists);
  }, [favorites, importedTracks]);

  const handlePlayTrack = useCallback(async (track: AudioTrack) => {
    await playTrack(track);
    setTimeout(() => expandPlayer(), 100);
  }, [playTrack, expandPlayer]);

  const handlePlayPlaylist = useCallback((playlist: Playlist) => {
    if (playlist.tracks.length > 0) {
      handlePlayTrack(playlist.tracks[0]);
    } else {
      showAlert('info', 'Empty Playlist', 'This playlist has no songs yet.');
    }
  }, [handlePlayTrack, showAlert]);

  // Fixed Import Handler
  const handleImport = useCallback(async (source: 'device' | 'spotify' | 'apple') => {
    setShowImportModal(false);
    setIsImporting(true);
    
    try {
      if (source === 'device') {
        await importFromDevice();
        showAlert('success', 'Import Successful', 'Music added to your library!');
      } else if (source === 'spotify') {
        // Try to open Spotify
        const spotifyUrl = 'spotify://';
        const webUrl = 'https://open.spotify.com';
        
        const canOpen = await Linking.canOpenURL(spotifyUrl);
        if (canOpen) {
          await Linking.openURL(spotifyUrl);
          showAlert('info', 'Spotify Opened', 'Select a playlist to import from Spotify');
        } else {
          await Linking.openURL(webUrl);
          showAlert('info', 'Spotify Web', 'Opening Spotify in browser...');
        }
      } else if (source === 'apple') {
        const appleUrl = 'music://';
        const canOpen = await Linking.canOpenURL(appleUrl);
        if (canOpen) {
          await Linking.openURL(appleUrl);
          showAlert('info', 'Apple Music Opened', 'Select music to import');
        } else {
          showAlert('error', 'Apple Music Not Found', 'Please install Apple Music app');
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      showAlert('error', 'Import Failed', 'Could not import music. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [importFromDevice, showAlert]);

  const filteredTracks = useMemo(() => {
    let tracks = [...ENHANCED_TRACKS, ...importedTracks];
    if (activeTab === 'favorites') tracks = tracks.filter(t => isFavorite(t.id));
    else if (activeTab === 'imported') tracks = importedTracks;
    
    if (!searchQuery) return tracks;
    return tracks.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, favorites, importedTracks, activeTab, isFavorite]);

  const moods = [
    { id: 'sleep', label: 'Sleep', emoji: '😴', color: '#667eea' },
    { id: 'calm', label: 'Calm', emoji: '😌', color: '#11998e' },
    { id: 'play', label: 'Play', emoji: '🎮', color: '#feca57' },
    { id: 'focus', label: 'Focus', emoji: '🎯', color: '#ff6b6b' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f0f1e', '#1a1a2e', '#16213e']} style={StyleSheet.absoluteFill} />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 140 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}
            </Text>
            <Text style={styles.title}>Lullaby Lounge</Text>
            {currentBaby && (
              <View style={styles.babyInfo}>
                <Ionicons name="heart" size={14} color="#ff6b6b" />
                <Text style={styles.babyText}>Personalized for {currentBaby.name}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowImportModal(true)}>
              <BlurView intensity={60} style={styles.blurIcon}>
                <Ionicons name="add" size={24} color="#fff" />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setShowSearch(!showSearch)}>
              <BlurView intensity={60} style={styles.blurIcon}>
                <Ionicons name={showSearch ? "close" : "search"} size={24} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        {showSearch && (
          <FadeInDown>
            <View style={styles.searchContainer}>
              <BlurView intensity={80} style={styles.searchBlur} tint="dark">
                <Ionicons name="search" size={20} color="#64748b" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search sounds, artists..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#64748b"
                  autoFocus
                />
              </BlurView>
            </View>
          </FadeInDown>
        )}

        {/* Moods */}
        <View style={styles.moodSection}>
          <Text style={styles.sectionTitle}>How is baby feeling?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodScroll}>
            {moods.map((mood) => (
              <TouchableOpacity key={mood.id} style={[styles.moodChip, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Playlists */}
        <View style={styles.playlistSection}>
          <Text style={styles.sectionTitle}>
            {currentBaby?.name ? `Made For ${currentBaby.name}` : 'Made For Your Baby'}
          </Text>
          <View style={styles.playlistGrid}>
            {playlists.map((playlist, index) => (
              <PlaylistCard key={playlist.id} playlist={playlist} onPress={() => handlePlayPlaylist(playlist)} index={index} />
            ))}
            <TouchableOpacity style={styles.addCard} onPress={() => setShowImportModal(true)}>
              <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.addGradient}>
                <View style={styles.addIcon}>
                  <Ionicons name="add-circle" size={32} color="#fff" />
                </View>
                <Text style={styles.addTitle}>Add Music</Text>
                <Text style={styles.addDesc}>Device, Spotify, Apple</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'favorites', 'imported'].map((tab) => (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab as any)}
              >
                <Ionicons 
                  name={tab === 'favorites' ? 'heart' : tab === 'imported' ? 'download' : 'musical-notes'} 
                  size={14} 
                  color={activeTab === tab ? '#fff' : '#64748b'} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Track List */}
        <View style={styles.trackList}>
          {filteredTracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              isPlaying={isPlaying && currentTrack?.id === track.id}
              isCurrentTrack={currentTrack?.id === track.id}
              isFavorite={isFavorite(track.id)}
              onPress={() => handlePlayTrack(track)}
              onToggleFavorite={() => toggleFavorite(track.id)}
            />
          ))}
          
          {filteredTracks.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="musical-note" size={48} color="#64748b" />
              <Text style={styles.emptyText}>No songs found</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ImportMusicModal 
        visible={showImportModal} 
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        isDark={true}
      />

      <SweetAlert 
        {...alert} 
        onClose={() => setAlert({ ...alert, visible: false })} 
        isDark={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scrollView: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingHorizontal: 20 },
  headerText: { flex: 1 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  greeting: { fontSize: 14, color: '#94a3b8', fontWeight: '500', letterSpacing: 0.5 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 4, letterSpacing: -1 },
  babyInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  babyText: { fontSize: 14, color: '#cbd5e1', fontWeight: '600' },
  iconButton: { borderRadius: 16, overflow: 'hidden' },
  blurIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  searchContainer: { marginBottom: 20, paddingHorizontal: 20 },
  searchBlur: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchInput: { flex: 1, fontSize: 16, color: '#fff', marginLeft: 12, fontWeight: '500' },
  
  moodSection: { marginBottom: 28, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 16, letterSpacing: -0.5 },
  moodScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  moodChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28, marginRight: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  moodEmoji: { fontSize: 20 },
  moodLabel: { fontSize: 15, fontWeight: '600', color: '#cbd5e1' },
  
  playlistSection: { marginBottom: 28, paddingHorizontal: 20 },
  playlistGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  addCard: { width: (width - 56) / 2, marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' },
  addGradient: { width: '100%', aspectRatio: 1.2, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  addTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  addDesc: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  
  tabsContainer: { marginBottom: 16, paddingHorizontal: 20 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#fff' },
  
  trackList: { paddingHorizontal: 20, marginBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#64748b', fontSize: 16, marginTop: 12, fontWeight: '500' },
});