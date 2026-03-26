// src/screens/SafetyCornerScreen.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
  Linking,
  Alert,
  Animated,
  Share,
  Platform,
  Modal,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../types/navigation';
import { useSafety, SafetyTopic, EmergencyContact } from '../hooks/useSafety';
import { useBaby } from '../context/BabyContext';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import * as Haptics from 'expo-haptics';

type SafetyCornerScreenProps = BottomTabScreenProps<MainTabParamList, 'SafetyCorner'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPRING_CONFIG = { damping: 15, mass: 1, stiffness: 150 };

const COLORS = {
  emergency: { primary: '#ff4757', secondary: '#ff6b81', gradient: ['#ff4757', '#ff6348'] as const },
  prevention: { primary: '#43e97b', secondary: '#38f9d7', gradient: ['#43e97b', '#38f9d7'] as const },
  daily: { primary: '#667eea', secondary: '#764ba2', gradient: ['#667eea', '#764ba2'] as const },
  dark: { bg: ['#0f0f1e', '#1a1a2e', '#16213e'] as const, card: 'rgba(255,255,255,0.05)', text: '#ffffff', subtext: '#a0a0b0' },
  light: { bg: ['#f8faff', '#f0f4ff', '#e8eeff'] as const, card: '#ffffff', text: '#1a1a2e', subtext: '#6b7280' },
};

// Components
const SafetyCard: React.FC<{ topic: SafetyTopic; isDark: boolean; onPress: () => void; index: number; onComplete?: () => void }> = 
  ({ topic, isDark, onPress, index }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 400, delay: index * 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
    ]).start();
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, ...SPRING_CONFIG }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, ...SPRING_CONFIG }).start();

  return (
    <Animated.View style={[styles.cardContainer, { transform: [{ scale: scaleAnim }, { translateY }], opacity }]}>
      <TouchableOpacity
        style={[
          styles.safetyCard,
          isDark && styles.safetyCardDark,
          { borderLeftColor: topic.category === 'emergency' ? COLORS.emergency.primary : topic.category === 'prevention' ? COLORS.prevention.primary : COLORS.daily.primary, borderLeftWidth: 4 },
          topic.category === 'emergency' && styles.emergencyGlow,
          topic.completedAt && styles.completedCard,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${topic.color}15` }]}>
          <Ionicons name={topic.icon as keyof typeof Ionicons.glyphMap} size={24} color={topic.color} />
          {topic.completedAt && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>{topic.title}</Text>
            {topic.category === 'emergency' && (
              <View style={[styles.emergencyBadge, { backgroundColor: topic.color }]}>
                <Text style={styles.emergencyText}>SOS</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>{topic.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : '#999'} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const EmergencyButton: React.FC<{ contact: EmergencyContact; isDark: boolean; onPress: () => void; isSOS?: boolean }> = 
  ({ contact, isDark, onPress, isSOS }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSOS || contact.type === 'emergency') {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [isSOS, contact.type]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[
          styles.emergencyBtn,
          isDark && styles.emergencyBtnDark,
          isSOS && styles.sosButton,
          { borderColor: isSOS ? '#ff4757' : contact.color },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isSOS ? ['#ff475730', '#ff475710'] : [`${contact.color}20`, `${contact.color}05`]}
          style={styles.emergencyBtnGradient}
        >
          <Ionicons 
            name={isSOS ? 'alert' : contact.icon as keyof typeof Ionicons.glyphMap} 
            size={isSOS ? 32 : 24} 
            color={isSOS ? '#ff4757' : contact.color} 
          />
          <Text style={[styles.emergencyBtnText, { color: isSOS ? '#ff4757' : contact.color, fontSize: isSOS ? 16 : 13 }]}>
            {isSOS ? 'SOS EMERGENCY' : contact.label}
          </Text>
          {!isSOS && contact.number && (
            <Text style={[styles.emergencyBtnNumber, isDark && styles.emergencyBtnNumberDark]}>{contact.number}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ChecklistModal: React.FC<{ visible: boolean; onClose: () => void; isDark: boolean }> = ({ visible, onClose, isDark }) => {
  const { checklists, toggleChecklistItem, triggerHaptic } = useSafety();
  const [activeChecklist, setActiveChecklist] = useState(checklists[0]);

  if (!activeChecklist) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDark ? 40 : 80} style={styles.checklistContainer} tint={isDark ? 'dark' : 'light'}>
          <View style={styles.checklistHeader}>
            <Text style={[styles.checklistTitle, isDark && styles.checklistTitleDark]}>Safety Checklist</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={isDark ? '#fff' : '#1a1a2e'} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.checklistTabs}>
            {checklists.map(cl => (
              <TouchableOpacity
                key={cl.id}
                style={[
                  styles.checklistTab,
                  activeChecklist.id === cl.id && { backgroundColor: COLORS.prevention.primary },
                ]}
                onPress={() => setActiveChecklist(cl)}
              >
                <Text style={[
                  styles.checklistTabText,
                  activeChecklist.id === cl.id && styles.checklistTabTextActive,
                ]}>
                  {cl.category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.checklistContent}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${activeChecklist.progress}%`, backgroundColor: COLORS.prevention.primary }]} />
            </View>
            <Text style={[styles.progressText, isDark && styles.progressTextDark]}>
              {activeChecklist.progress}% Complete
            </Text>

            {activeChecklist.items.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.checklistItem}
                onPress={() => {
                  toggleChecklistItem(activeChecklist.id, item.id);
                  triggerHaptic('light');
                }}
              >
                <View style={[
                  styles.checkbox,
                  item.completed && { backgroundColor: COLORS.prevention.primary, borderColor: COLORS.prevention.primary },
                  item.critical && !item.completed && { borderColor: COLORS.emergency.primary },
                ]}>
                  {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={[
                  styles.checklistItemText,
                  isDark && styles.checklistItemTextDark,
                  item.completed && styles.checklistItemCompleted,
                  item.critical && !item.completed && { color: COLORS.emergency.primary },
                ]}>
                  {item.text}
                  {item.critical && <Text style={styles.criticalTag}> CRITICAL</Text>}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
};

export default function SafetyCornerScreen({ navigation }: SafetyCornerScreenProps) {
  const [selectedTopic, setSelectedTopic] = useState<SafetyTopic | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [checklistVisible, setChecklistVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'emergency' | 'prevention' | 'daily'>('all');
  
  const { 
    topics, emergencyContacts, callEmergency, triggerSOS, findNearbyHospitals,
    findNearbyPediatricians, shareLocationWithEmergency, markTipAsViewed,
    getSafetyScore, streakDays, currentLocation, triggerHaptic,
    markTopicCompleted, importFamilyContacts,
  } = useSafety();
  
  const { currentBaby } = useBaby();
  const { guardians, parent2, userProfile } = useFamily();
  const { userProfile: authProfile } = useAuth();
  
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useRef(new Animated.Value(0)).current;

  // Import family contacts on mount
  useEffect(() => {
    const familyMembers = [];
    if (authProfile?.phoneNumber) {
      familyMembers.push({ ...authProfile, relationship: 'Parent (You)', role: 'parent1' });
    }
    if (parent2?.phoneNumber) {
      familyMembers.push({ ...parent2, relationship: 'Co-Parent', role: 'parent2' });
    }
    if (guardians?.length) {
      familyMembers.push(...guardians);
    }
    
    if (familyMembers.length > 0) {
      importFamilyContacts(familyMembers);
    }
  }, [authProfile, parent2, guardians]);

  const safetyScore = getSafetyScore();

  const handleTopicPress = useCallback(async (topic: SafetyTopic) => {
    setSelectedTopic(topic);
    setModalVisible(true);
    await markTipAsViewed(topic.id);
    triggerHaptic('light');
  }, [markTipAsViewed, triggerHaptic]);

  const handleSOS = useCallback(() => {
    Vibration.vibrate([0, 500, 200, 500]);
    triggerSOS();
  }, [triggerSOS]);

  const filteredTopics = topics.filter(t => activeCategory === 'all' ? true : t.category === activeCategory);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity, paddingTop: insets.top }]}>
        <BlurView intensity={isDark ? 40 : 80} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        <View style={styles.floatingHeaderContent}>
          <Text style={[styles.floatingHeaderText, isDark && styles.floatingHeaderTextDark]}>Safety Corner</Text>
          {streakDays > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={14} color="#ff9500" />
              <Text style={styles.streakText}>{streakDays} day streak</Text>
            </View>
          )}
        </View>
      </Animated.View>

      <LinearGradient colors={isDark ? COLORS.dark.bg : COLORS.light.bg} style={[styles.gradient, { paddingTop: insets.top }]}>
        <Animated.ScrollView 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
        >
          {/* Hero with Score */}
          <View style={styles.heroSection}>
            <View style={styles.heroIconContainer}>
              <LinearGradient colors={COLORS.emergency.gradient} style={styles.heroIconGradient}>
                <Ionicons name="shield-checkmark" size={40} color="#fff" />
              </LinearGradient>
              <View style={[styles.scoreBadge, { backgroundColor: safetyScore > 80 ? '#43e97b' : safetyScore > 50 ? '#f39c12' : '#ff4757' }]}>
                <Text style={styles.scoreText}>{safetyScore}%</Text>
              </View>
            </View>
            <Text style={[styles.heroTitle, isDark && styles.heroTitleDark]}>Safety Corner</Text>
            <Text style={[styles.heroSubtitle, isDark && styles.heroSubtitleDark]}>
              {currentBaby ? `Protecting ${currentBaby.name} (${currentBaby.age})` : 'Your family safety hub'}
            </Text>
            
            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={[styles.statItem, isDark && styles.statItemDark]}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.prevention.primary} />
                <Text style={[styles.statValue, isDark && styles.statValueDark]}>{topics.filter(t => t.completedAt).length}</Text>
                <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>Completed</Text>
              </View>
              <View style={[styles.statItem, isDark && styles.statItemDark]}>
                <Ionicons name="flame" size={20} color="#ff9500" />
                <Text style={[styles.statValue, isDark && styles.statValueDark]}>{streakDays}</Text>
                <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>Day Streak</Text>
              </View>
              <TouchableOpacity style={[styles.statItem, isDark && styles.statItemDark]} onPress={() => setChecklistVisible(true)}>
                <Ionicons name="list" size={20} color={COLORS.daily.primary} />
                <Text style={[styles.statValue, isDark && styles.statValueDark]}>Check</Text>
                <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>List</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SOS Emergency Button */}
          <View style={styles.sosSection}>
            <EmergencyButton
              contact={{ id: 'sos', label: 'SOS', number: '911', type: 'emergency', icon: 'alert', color: '#ff4757' }}
              isDark={isDark}
              onPress={handleSOS}
              isSOS={true}
            />
            <Text style={[styles.sosDisclaimer, isDark && styles.sosDisclaimerDark]}>
              Press in life-threatening emergencies only. Calls 911 and alerts family.
            </Text>
          </View>

          {/* Emergency Contacts */}
          <View style={styles.emergencySection}>
            <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>EMERGENCY CONTACTS</Text>
            <View style={styles.emergencyGrid}>
              {emergencyContacts.filter(c => c.isDefault).map((contact) => (
                <EmergencyButton
                  key={contact.id}
                  contact={contact}
                  isDark={isDark}
                  onPress={() => callEmergency(contact.number, contact.label, contact.type as any)}
                />
              ))}
            </View>
            
            {/* Family Contacts Row */}
            {emergencyContacts.filter(c => c.type === 'family').length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.familyContactsScroll}>
                {emergencyContacts.filter(c => c.type === 'family').map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={[styles.familyChip, isDark && styles.familyChipDark]}
                    onPress={() => callEmergency(contact.number, contact.label, 'family')}
                  >
                    <Ionicons name={contact.icon as keyof typeof Ionicons.glyphMap} size={16} color={contact.color} />
                    <Text style={[styles.familyChipText, isDark && styles.familyChipTextDark]}>{contact.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Category Filter */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
              {(['all', 'emergency', 'prevention', 'daily'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterChip,
                    activeCategory === cat && styles.filterChipActive,
                    activeCategory === cat && { 
                      backgroundColor: cat === 'emergency' ? COLORS.emergency.primary : 
                                      cat === 'prevention' ? COLORS.prevention.primary : 
                                      COLORS.daily.primary 
                    },
                  ]}
                  onPress={() => {
                    setActiveCategory(cat);
                    triggerHaptic('light');
                  }}
                >
                  <Text style={[styles.filterChipText, activeCategory === cat && styles.filterChipTextActive]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Safety Topics */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Safety Topics</Text>
            {filteredTopics.map((topic, index) => (
              <SafetyCard 
                key={topic.id} 
                topic={topic} 
                isDark={isDark}
                onPress={() => handleTopicPress(topic)}
                index={index}
                onComplete={() => markTopicCompleted(topic.id)}
              />
            ))}
          </View>

          {/* Location Services */}
          {currentLocation && (
            <BlurView intensity={isDark ? 20 : 60} style={styles.locationCard} tint={isDark ? 'dark' : 'light'}>
              <Ionicons name="location" size={20} color={COLORS.daily.primary} />
              <Text style={[styles.locationText, isDark && styles.locationTextDark]}>
                Location active • Ready for emergency sharing
              </Text>
            </BlurView>
          )}

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity style={[styles.quickActionCard, isDark && styles.quickActionCardDark]} onPress={() => callEmergency('911', 'Emergency', 'emergency')}>
                <LinearGradient colors={['#ff475720', '#ff475705']} style={styles.quickActionGradient}>
                  <Ionicons name="call" size={24} color="#ff4757" />
                  <Text style={[styles.quickActionText, isDark && styles.quickActionTextDark]}>Call 911</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.quickActionCard, isDark && styles.quickActionCardDark]} onPress={findNearbyHospitals}>
                <LinearGradient colors={['#11998e20', '#11998e05']} style={styles.quickActionGradient}>
                  <Ionicons name="location" size={24} color="#11998e" />
                  <Text style={[styles.quickActionText, isDark && styles.quickActionTextDark]}>Hospitals</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.quickActionCard, isDark && styles.quickActionCardDark]} onPress={findNearbyPediatricians}>
                <LinearGradient colors={['#667eea20', '#667eea05']} style={styles.quickActionGradient}>
                  <Ionicons name="medical" size={24} color="#667eea" />
                  <Text style={[styles.quickActionText, isDark && styles.quickActionTextDark]}>Pediatrician</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.quickActionCard, isDark && styles.quickActionCardDark]} onPress={() => shareLocationWithEmergency()}>
                <LinearGradient colors={['#fa709a20', '#fa709a05']} style={styles.quickActionGradient}>
                  <Ionicons name="share" size={24} color="#fa709a" />
                  <Text style={[styles.quickActionText, isDark && styles.quickActionTextDark]}>Share Loc</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Disclaimer */}
          <BlurView intensity={isDark ? 20 : 60} style={styles.disclaimer} tint={isDark ? 'dark' : 'light'}>
            <Ionicons name="information-circle" size={20} color={isDark ? '#666' : '#999'} />
            <Text style={[styles.disclaimerText, isDark && styles.disclaimerTextDark]}>
              This information is for educational purposes only. In case of emergency, always call 911 immediately.
            </Text>
          </BlurView>
        </Animated.ScrollView>
      </LinearGradient>

      {/* Checklist Modal */}
      <ChecklistModal visible={checklistVisible} onClose={() => setChecklistVisible(false)} isDark={isDark} />

      {/* Topic Detail Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, isDark && styles.modalContainerDark]}>
            <View style={styles.modalHandle} />
            
            {selectedTopic && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIconContainer, { backgroundColor: `${selectedTopic.color}15` }]}>
                    <Ionicons name={selectedTopic.icon as keyof typeof Ionicons.glyphMap} size={28} color={selectedTopic.color} />
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                    <BlurView intensity={80} style={styles.closeBtnBlur}>
                      <Ionicons name="close" size={20} color={isDark ? '#fff' : '#1a1a2e'} />
                    </BlurView>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>{selectedTopic.title}</Text>
                <Text style={[styles.modalDescription, isDark && styles.modalDescriptionDark]}>{selectedTopic.description}</Text>

                {currentBaby && (
                  <View style={[styles.babyBanner, isDark && styles.babyBannerDark]}>
                    <Text style={styles.babyBannerEmoji}>{currentBaby.avatar || '👶'}</Text>
                    <Text style={[styles.babyBannerText, isDark && styles.babyBannerTextDark]}>
                      Tips for {currentBaby.name} ({currentBaby.age})
                    </Text>
                  </View>
                )}

                <View style={styles.tipsContainer}>
                  <Text style={[styles.tipsTitle, isDark && styles.tipsTitleDark]}>Key Safety Tips</Text>
                  {selectedTopic.tips.map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <View style={[styles.tipBullet, { backgroundColor: selectedTopic.color }]}>
                        <Text style={styles.tipNumber}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.tipText, isDark && styles.tipTextDark]}>{tip}</Text>
                    </View>
                  ))}
                </View>

                {selectedTopic.emergencyNumbers && (
                  <View style={styles.emergencyActionsContainer}>
                    <Text style={[styles.emergencyActionsTitle, isDark && styles.emergencyActionsTitleDark]}>Emergency Actions</Text>
                    {selectedTopic.emergencyNumbers.map((num, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.emergencyActionBtn, { backgroundColor: selectedTopic.color }]}
                        onPress={() => callEmergency(num.number, num.label, 'emergency')}
                      >
                        <Ionicons name="call" size={20} color="#fff" />
                        <Text style={styles.emergencyActionText}>Call {num.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity 
                  style={[styles.completeBtn, { backgroundColor: COLORS.prevention.primary }]}
                  onPress={() => {
                    markTopicCompleted(selectedTopic.id);
                    triggerHaptic('success');
                    setModalVisible(false);
                  }}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.completeBtnText}>Mark as Completed</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: `${selectedTopic.title}\n\n${selectedTopic.tips.join('\n')}` })}>
                  <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#667eea'} />
                  <Text style={[styles.shareText, isDark && styles.shareTextDark]}>Share Tips</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: Platform.OS === 'ios' ? 100 : 80,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  floatingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingHeaderText: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  floatingHeaderTextDark: { color: '#ffffff' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: { fontSize: 12, fontWeight: '600', color: '#ff9500' },
  content: { paddingHorizontal: 20 },
  heroSection: { alignItems: 'center', marginTop: 20, marginBottom: 24 },
  heroIconContainer: { position: 'relative', marginBottom: 16 },
  heroIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  scoreBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  scoreText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#1a1a2e', marginBottom: 8 },
  heroTitleDark: { color: '#ffffff' },
  heroSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  heroSubtitleDark: { color: '#a0a0b0' },
  quickStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItemDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginTop: 4 },
  statValueDark: { color: '#ffffff' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  statLabelDark: { color: '#a0a0b0' },
  sosSection: { marginBottom: 24, alignItems: 'center' },
  sosDisclaimer: { fontSize: 11, color: '#999', marginTop: 8, textAlign: 'center' },
  sosDisclaimerDark: { color: '#666' },
  emergencySection: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#ff4757', marginBottom: 12, letterSpacing: 1 },
  sectionLabelDark: { color: '#ff6b81' },
  emergencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emergencyBtn: {
    width: (SCREEN_WIDTH - 50) / 2,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sosButton: {
    width: SCREEN_WIDTH - 40,
    borderWidth: 2,
    borderRadius: 20,
  },
  emergencyBtnDark: { borderColor: 'rgba(255,255,255,0.1)' },
  emergencyBtnGradient: { padding: 16, alignItems: 'center', gap: 6 },
  emergencyBtnText: { fontSize: 13, fontWeight: '700' },
  emergencyBtnNumber: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  emergencyBtnNumberDark: { color: '#a0a0b0' },
  familyContactsScroll: { marginTop: 12 },
  familyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  familyChipDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
  familyChipText: { fontSize: 12, fontWeight: '600', color: '#1a1a2e' },
  familyChipTextDark: { color: '#ffffff' },
  filterContainer: { marginBottom: 20 },
  filterContent: { paddingRight: 20, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  filterChipActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  sectionTitleDark: { color: '#ffffff' },
  cardContainer: { marginBottom: 10 },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  safetyCardDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
  emergencyGlow: {
    shadowColor: '#ff4757',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  completedCard: {
    opacity: 0.8,
    borderLeftColor: '#43e97b',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  completedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#43e97b',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardContent: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginRight: 8,
  },
  cardTitleDark: { color: '#ffffff' },
  emergencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emergencyText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  cardDescriptionDark: { color: '#a0a0b0' },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  locationTextDark: { color: '#a0a0b0' },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionCardDark: { backgroundColor: 'rgba(255,255,255,0.05)' },
  quickActionGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  quickActionTextDark: { color: '#ffffff' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  disclaimerTextDark: { color: '#888' },
  
  // Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalContainerDark: { backgroundColor: '#1a1a2e' },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalScrollContent: {
    padding: 24,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeBtnBlur: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  modalTitleDark: { color: '#ffffff' },
  modalDescription: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 22,
  },
  modalDescriptionDark: { color: '#a0a0b0' },
  babyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250,112,154,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  babyBannerDark: { backgroundColor: 'rgba(250,112,154,0.2)' },
  babyBannerEmoji: { fontSize: 24 },
  babyBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fa709a',
  },
  babyBannerTextDark: { color: '#fc5c7d' },
  tipsContainer: { marginBottom: 24 },
  tipsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  tipsTitleDark: { color: '#ffffff' },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  tipBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tipNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
  tipTextDark: { color: '#d1d5db' },
  emergencyActionsContainer: { marginBottom: 24 },
  emergencyActionsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  emergencyActionsTitleDark: { color: '#ffffff' },
  emergencyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 8,
  },
  emergencyActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  completeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
  },
  shareTextDark: { color: '#a0a0b0' },

  // Checklist Modal Styles
  checklistContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.8,
    padding: 24,
    paddingTop: 12,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  checklistTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  checklistTitleDark: { color: '#ffffff' },
  checklistTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  checklistTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  checklistTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  checklistTabTextActive: { color: '#fff' },
  checklistContent: { maxHeight: SCREEN_HEIGHT * 0.5 },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  progressTextDark: { color: '#ffffff' },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistItemText: {
    flex: 1,
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 20,
  },
  checklistItemTextDark: { color: '#d1d5db' },
  checklistItemCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  criticalTag: {
    color: '#ff4757',
    fontWeight: '700',
    fontSize: 11,
  },
});