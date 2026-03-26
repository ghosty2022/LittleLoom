import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  useColorScheme,
  Modal,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useBaby } from '../context/BabyContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 4;
const ITEM_SIZE = (width - 32 - (COLUMN_COUNT - 1) * SPACING) / COLUMN_COUNT;

type GalleryScreenProps = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

interface Photo {
  id: string;
  uri: string;
  date: string;
  type: 'milestone' | 'daily' | 'sleep' | 'all';
  caption?: string;
}

const MOCK_PHOTOS: Photo[] = [
  { id: '1', uri: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400&q=80', date: '2024-01-15', type: 'milestone', caption: 'First smile!' },
  { id: '2', uri: 'https://images.unsplash.com/photo-1544126592-807ade215a0b?w=400&q=80', date: '2024-01-14', type: 'daily', caption: 'Morning routine' },
  { id: '3', uri: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df4?w=400&q=80', date: '2024-01-13', type: 'milestone', caption: 'First steps' },
  { id: '4', uri: 'https://images.unsplash.com/photo-1520454974749-611b7248ffc6?w=400&q=80', date: '2024-01-12', type: 'daily', caption: 'Playtime' },
  { id: '5', uri: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&q=80', date: '2024-01-11', type: 'sleep', caption: 'Nap time' },
  { id: '6', uri: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df4?w=400&q=80', date: '2024-01-10', type: 'milestone', caption: 'Sitting up' },
  { id: '7', uri: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400&q=80', date: '2024-01-09', type: 'daily', caption: 'Bath time' },
  { id: '8', uri: 'https://images.unsplash.com/photo-1544126592-807ade215a0b?w=400&q=80', date: '2024-01-08', type: 'daily', caption: 'Feeding time' },
  { id: '9', uri: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df4?w=400&q=80', date: '2024-01-07', type: 'milestone', caption: 'Rolling over' },
];

const CATEGORIES = [
  { id: 'all', label: 'All Photos', icon: 'images' },
  { id: 'milestone', label: 'Milestones', icon: 'trophy' },
  { id: 'daily', label: 'Daily', icon: 'camera' },
  { id: 'sleep', label: 'Sleep', icon: 'moon' },
];

export default function GalleryScreen({ navigation }: GalleryScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { currentBaby } = useBaby();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredPhotos = selectedCategory === 'all' 
    ? MOCK_PHOTOS 
    : MOCK_PHOTOS.filter(p => p.type === selectedCategory);

  const handleShare = useCallback(async (photo: Photo) => {
    try {
      await Share.share({
        url: photo.uri,
        message: `Check out this photo of ${currentBaby?.name || 'baby'}! ${photo.caption || ''}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share photo');
    }
  }, [currentBaby]);

  const handleDelete = useCallback((photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // TODO: Implement actual delete logic
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelectedPhoto(null);
          }
        },
      ]
    );
  }, []);

  const renderPhoto = useCallback(({ item, index }: { item: Photo; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)}>
      <TouchableOpacity 
        style={styles.photoContainer}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedPhoto(item);
        }}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.uri }} style={styles.photo} />
        {item.type === 'milestone' && (
          <View style={styles.milestoneBadge}>
            <Ionicons name="trophy" size={12} color="#fff" />
          </View>
        )}
        {viewMode === 'list' && (
          <View style={styles.listInfo}>
            <Text style={styles.listDate}>{item.date}</Text>
            {item.caption && (
              <Text style={styles.listCaption} numberOfLines={1}>
                {item.caption}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  ), [viewMode]);

  const renderPhotoModal = () => (
    <Modal
      visible={selectedPhoto !== null}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setSelectedPhoto(null)}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        <StatusBar barStyle="light-content" />
        
        {/* Backdrop with blur */}
        <BlurView 
          intensity={100} 
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Close button */}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setSelectedPhoto(null)}
        >
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={28} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Photo display */}
        <Animated.View 
          entering={FadeIn}
          style={styles.modalImageContainer}
        >
          <Image 
            source={{ uri: selectedPhoto?.uri }} 
            style={styles.modalImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Photo info panel */}
        <Animated.View 
          entering={FadeInDown.delay(200)}
          style={styles.modalInfoPanel}
        >
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.infoBlur}>
            <View style={styles.infoContent}>
              <View style={styles.infoHeader}>
                <View style={styles.typeBadge}>
                  <Ionicons 
                    name={selectedPhoto?.type === 'milestone' ? 'trophy' : 
                          selectedPhoto?.type === 'sleep' ? 'moon' : 'camera'} 
                    size={16} 
                    color="#667eea" 
                  />
                  <Text style={styles.typeText}>
                    {selectedPhoto?.type.charAt(0).toUpperCase() + selectedPhoto?.type.slice(1)}
                  </Text>
                </View>
                <Text style={styles.modalDate}>{selectedPhoto?.date}</Text>
              </View>
              
              {selectedPhoto?.caption && (
                <Text style={styles.modalCaption}>{selectedPhoto.caption}</Text>
              )}

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => selectedPhoto && handleShare(selectedPhoto)}
                >
                  <Ionicons name="share-outline" size={24} color="#667eea" />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="heart-outline" size={24} color="#ef4444" />
                  <Text style={styles.actionText}>Favorite</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="download-outline" size={24} color="#10b981" />
                  <Text style={styles.actionText}>Save</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => selectedPhoto && handleDelete(selectedPhoto.id)}
                >
                  <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f8fafc' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <LinearGradient 
        colors={isDark ? ['#1a1a2e', '#000'] : ['#fff', '#f8fafc']} 
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1e293b'} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>
            {currentBaby?.name ? `${currentBaby.name}'s Gallery` : 'Gallery'}
          </Text>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              style={styles.iconButton}
            >
              <Ionicons 
                name={viewMode === 'grid' ? 'list' : 'grid'} 
                size={24} 
                color={isDark ? '#fff' : '#1e293b'} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('AddLog', { type: 'photo' })}
            >
              <Ionicons name="add" size={24} color={isDark ? '#fff' : '#1e293b'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories */}
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.categoriesContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryButton,
                selectedCategory === item.id && styles.categoryButtonActive
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(item.id);
              }}
            >
              <Ionicons 
                name={item.icon as any} 
                size={16} 
                color={selectedCategory === item.id ? '#fff' : isDark ? '#94a3b8' : '#64748b'} 
              />
              <Text style={[
                styles.categoryText,
                selectedCategory === item.id && styles.categoryTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </LinearGradient>

      {/* Photo Grid/List */}
      <FlatList
        data={filteredPhotos}
        numColumns={viewMode === 'grid' ? COLUMN_COUNT : 1}
        key={viewMode}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.grid,
          viewMode === 'list' && styles.listContainer
        ]}
        columnWrapperStyle={viewMode === 'grid' ? {
          justifyContent: 'flex-start',
          gap: SPACING,
          marginBottom: SPACING,
        } : undefined}
        renderItem={renderPhoto}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, { color: isDark ? '#64748b' : '#94a3b8' }]}>
              No photos in this category
            </Text>
            <TouchableOpacity 
              style={styles.addPhotoButton}
              onPress={() => navigation.navigate('AddLog', { type: 'photo' })}
            >
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Photo Viewer Modal */}
      {renderPhotoModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
  },
  categoriesContainer: {
    gap: 8,
    paddingRight: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
  },
  categoryButtonActive: {
    backgroundColor: '#667eea',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  grid: {
    padding: 16,
    paddingBottom: 100,
  },
  listContainer: {
    padding: 16,
  },
  photoContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  milestoneBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 4,
  },
  listInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
  },
  listDate: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listCaption: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  addPhotoButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addPhotoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 100,
  },
  closeButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: width,
    height: height * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalInfoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  infoBlur: {
    padding: 24,
    paddingBottom: 40,
  },
  infoContent: {
    gap: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDate: {
    fontSize: 14,
    color: '#64748b',
  },
  modalCaption: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});
