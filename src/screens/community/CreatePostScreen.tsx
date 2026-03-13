import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const TOPICS = [
  { id: '1', name: 'Potty Training', emoji: '🚽', color: '#667eea' },
  { id: '2', name: 'Sleep Tips', emoji: '😴', color: '#11998e' },
  { id: '3', name: 'Feeding', emoji: '🍼', color: '#fa709a' },
  { id: '4', name: 'Milestones', emoji: '🏆', color: '#fee140' },
  { id: '5', name: 'Health', emoji: '💊', color: '#fc5c7d' },
];

export default function CreatePostScreen({ navigation }: any) {
  const [content, setContent] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [images, setImages] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets.map(a => a.uri)]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Post</Text>
          <TouchableOpacity 
            style={[styles.postButton, content.length > 0 && styles.postButtonActive]}
            disabled={content.length === 0}
          >
            <Text style={[styles.postButtonText, content.length > 0 && styles.postButtonTextActive]}>
              Post
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Topic Selector */}
          <Text style={styles.sectionLabel}>Select Topic</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topicsContainer}
          >
            {TOPICS.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={[
                  styles.topicChip,
                  selectedTopic.id === topic.id && { 
                    backgroundColor: topic.color + '30',
                    borderColor: topic.color,
                  }
                ]}
                onPress={() => setSelectedTopic(topic)}
              >
                <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                <Text style={[
                  styles.topicName,
                  selectedTopic.id === topic.id && { color: topic.color, fontWeight: '700' }
                ]}>
                  {topic.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Content Input */}
          <BlurView intensity={80} style={styles.inputContainer}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputAvatar}>👩</Text>
              <View>
                <Text style={styles.inputName}>Sarah M.</Text>
                <Text style={styles.inputTopic}>Posting in {selectedTopic.name}</Text>
              </View>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="What's on your mind? Share your experience, ask a question, or offer support..."
              placeholderTextColor="#999"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </BlurView>

          {/* Image Preview */}
          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <TouchableOpacity 
                    style={styles.removeImage}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Tools */}
          <View style={styles.toolsContainer}>
            <TouchableOpacity style={styles.toolButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={24} color="#667eea" />
              <Text style={styles.toolText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton}>
              <Ionicons name="camera-outline" size={24} color="#667eea" />
              <Text style={styles.toolText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton}>
              <Ionicons name="mic-outline" size={24} color="#667eea" />
              <Text style={styles.toolText}>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton}>
              <Ionicons name="poll-outline" size={24} color="#667eea" />
              <Text style={styles.toolText}>Poll</Text>
            </TouchableOpacity>
          </View>

          {/* Options */}
          <BlurView intensity={80} style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.optionRow}
              onPress={() => setIsAnonymous(!isAnonymous)}
            >
              <View style={styles.optionLeft}>
                <Ionicons name="eye-off-outline" size={22} color="#666" />
                <Text style={styles.optionText}>Post anonymously</Text>
              </View>
              <View style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}>
                {isAnonymous && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
            </TouchableOpacity>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(102,126,234,0.2)',
  },
  postButtonActive: {
    backgroundColor: '#667eea',
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#999',
  },
  postButtonTextActive: {
    color: 'white',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 24,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topicsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
  },
  topicEmoji: {
    fontSize: 20,
  },
  topicName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  inputContainer: {
    margin: 24,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputAvatar: {
    fontSize: 40,
    marginRight: 12,
  },
  inputName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  inputTopic: {
    fontSize: 13,
    color: '#667eea',
    marginTop: 2,
  },
  textInput: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    minHeight: 150,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 16,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  toolButton: {
    alignItems: 'center',
    gap: 4,
  },
  toolText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  optionsContainer: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
});