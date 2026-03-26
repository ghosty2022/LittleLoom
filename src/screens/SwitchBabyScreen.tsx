
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// FIXED: Import from correct contexts
import { useAuth } from '../context/AuthContext';
import { useBaby } from '../context/BabyContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type SwitchBabyScreenProps = NativeStackScreenProps<RootStackParamList, 'SwitchBaby'>;

export default function SwitchBabyScreen({ navigation }: SwitchBabyScreenProps) {
  // FIXED: Get baby data from BabyContext
  const { babies, currentBabyId, switchBaby, deleteBaby } = useBaby();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSwitchBaby = async (babyId: string) => {
    if (babyId === currentBabyId) {
      navigation.goBack();
      return;
    }
    await switchBaby(babyId);
    navigation.goBack();
  };

  const handleDeleteBaby = (babyId: string, babyName: string) => {
    Alert.alert(
      'Delete Baby Profile',
      `Are you sure you want to delete ${babyName}'s profile? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteBaby(babyId);
            if (success && babies.length <= 1) {
              navigation.replace('CreateBabyProfile');
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Switch Baby 👶</Text>
          <View style={styles.placeholder} />
        </View>

        <Text style={styles.subtitle}>Select a baby profile to view</Text>

        {/* Baby List */}
        <View style={styles.babyList}>
          {babies.map((baby) => (
            <BlurView 
              key={baby.id} 
              intensity={90} 
              style={[
                styles.babyCard,
                currentBabyId === baby.id && styles.babyCardActive
              ]}
            >
              <TouchableOpacity 
                style={styles.babyCardContent}
                onPress={() => handleSwitchBaby(baby.id)}
              >
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatar}>{baby.avatar}</Text>
                  {currentBabyId === baby.id && (
                    <View style={styles.activeIndicator}>
                      <Ionicons name="checkmark-circle" size={24} color="#667eea" />
                    </View>
                  )}
                </View>
                <View style={styles.babyInfo}>
                  <Text style={styles.babyName}>{baby.name}</Text>
                  <Text style={styles.babyAge}>{baby.age}</Text>
                  <Text style={styles.babyGender}>
                    {baby.gender === 'girl' ? '👧 Girl' : baby.gender === 'boy' ? '👦 Boy' : '👶 Other'}
                  </Text>
                </View>
                <Ionicons 
                  name="chevron-forward" 
                  size={24} 
                  color={currentBabyId === baby.id ? '#667eea' : '#999'} 
                />
              </TouchableOpacity>
              
              {/* Delete button for non-active babies */}
              {babies.length > 1 && currentBabyId !== baby.id && (
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => handleDeleteBaby(baby.id, baby.name)}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff4757" />
                </TouchableOpacity>
              )}
            </BlurView>
          ))}
        </View>

        {/* Add New Baby Button */}
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            navigation.goBack();
            navigation.navigate('CreateBabyProfile');
          }}
        >
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.addGradient}>
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addText}>Add New Baby</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Family Info */}
        <BlurView intensity={80} style={styles.familyInfo}>
          <Ionicons name="people" size={20} color="#667eea" />
          <Text style={styles.familyText}>
            Managed by {userProfile?.fullName || 'Parent'}
            {babies.length > 0 && ` • ${babies.length} bab${babies.length === 1 ? 'y' : 'ies'}`}
          </Text>
        </BlurView>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  placeholder: { width: 44 },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  babyList: { gap: 16 },
  babyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
  },
  babyCardActive: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  babyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: { fontSize: 56 },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  babyInfo: { flex: 1 },
  babyName: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  babyAge: { fontSize: 14, color: '#667eea', marginBottom: 2 },
  babyGender: { fontSize: 13, color: '#999' },
  deleteButton: {
    position: 'absolute',
    right: 60,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,71,87,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
    marginBottom: 16,
  },
  addGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  familyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  familyText: {
    fontSize: 14,
    color: '#666',
  },
});
