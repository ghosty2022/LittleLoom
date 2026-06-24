import React, { useState } from 'react';
import { ActivityIndicator, Alert, Button, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, Settings, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import type {  NativeStackScreenProps  } from '@react-navigation/native-stack';
import type {  CommunityStackParamList  } from '../../types/navigation';
import { useCommunity } from '../../context/CommunityContext';
import { useUser } from '../../context/UserContext';
import { showSuccessModal, showErrorModal } from '../../utils/modal';
import { useReportRoute } from '../../hooks/useReportRoute';
import { useCustomization } from '../../hooks/useCustomization';

import { CommunityColors, CommunityGradients, CommunitySpacing, CommunityBorderRadius, CommunityShadows } from '../../theme/CommunityTheme';

type ReportScreenProps = NativeStackScreenProps<CommunityStackParamList, 'Report'>;

const { width } = Dimensions.get('window');

const REPORT_CATEGORIES = [
  {
    id: 'spam',
    icon: 'megaphone',
    title: 'Spam',
    description: 'Misleading or repetitive content',
    color: '#FF9500',
  },
  {
    id: 'harassment',
    icon: 'alert-circle',
    title: 'Harassment or Bullying',
    description: 'Targeting someone with harmful behavior',
    color: '#FF3B30',
  },
  {
    id: 'hate_speech',
    icon: 'chatbubbles',
    title: 'Hate Speech',
    description: 'Promoting hatred against protected groups',
    color: '#FF2D55',
  },
  {
    id: 'misinformation',
    icon: 'information-circle',
    title: 'Misinformation',
    description: 'Sharing false or misleading information',
    color: '#5856D6',
  },
  {
    id: 'inappropriate',
    icon: 'eye-off',
    title: 'Inappropriate Content',
    description: 'NSFW, graphic, or offensive material',
    color: '#AF52DE',
  },
  {
    id: 'impersonation',
    icon: 'person',
    title: 'Impersonation',
    description: 'Pretending to be someone else',
    color: '#007AFF',
  },
  {
    id: 'self_harm',
    icon: 'heart-dislike',
    title: 'Self-Harm or Suicide',
    description: 'Content promoting self-injury',
    color: '#FF3B30',
  },
  {
    id: 'minor_safety',
    icon: 'shield',
    title: 'Child Safety',
    description: 'Content endangering minors',
    color: '#34C759',
  },
  {
    id: 'privacy',
    icon: 'lock-closed',
    title: 'Privacy Violation',
    description: 'Sharing private information without consent',
    color: '#5AC8FA',
  },
  {
    id: 'other',
    icon: 'ellipsis-horizontal',
    title: 'Something Else',
    description: 'Another issue not listed above',
    color: '#8E8E93',
  },
];

const SEVERITY_LEVELS = [
  { id: 'low', label: 'Low', description: 'Annoying but not harmful', color: '#34C759' },
  { id: 'medium', label: 'Medium', description: 'Potentially harmful', color: '#FF9500' },
  { id: 'high', label: 'High', description: 'Clearly harmful or dangerous', color: '#FF3B30' },
  { id: 'critical', label: 'Critical', description: 'Immediate danger or illegal', color: '#FF2D55' },
];

export default function ReportScreen({ navigation, route }: ReportScreenProps) {
  useReportRoute();

  const { type, targetId, targetUserId, postId } = route.params;
  const { currentUser, blockUser, isUserBlocked } = useCommunity();
  const { communityProfile } = useUser();

  const {
    shouldReduceMotion,
    triggerHaptic,
    spinnerColor,
  } = useCustomization();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('medium');
  const [description, setDescription] = useState('');
  const [blockAlso, setBlockAlso] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'category' | 'details' | 'confirm'>('category');

  const targetLabel = type === 'user' ? 'User' : type === 'post' ? 'Post' : type === 'comment' ? 'Comment' : 'Topic';
  const isBlocked = targetUserId ? isUserBlocked(targetUserId) : false;

  const handleCategorySelect = (categoryId: string) => {
    triggerHaptic('light');
    setSelectedCategory(categoryId);

    if (['self_harm', 'minor_safety', 'harassment'].includes(categoryId)) {
      setSelectedSeverity('high');
    }

    setCurrentStep('details');
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      showErrorModal({ message: 'Please select a reason for reporting' });
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('success');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (blockAlso && targetUserId && !isBlocked) {
        await blockUser(targetUserId);
      }

      console.log('Report submitted:', {
        reporterId: currentUser?.id,
        reporterHandle: communityProfile?.handle,
        type,
        targetId,
        targetUserId,
        postId,
        category: selectedCategory,
        severity: selectedSeverity,
        description,
        blockAlso,
        timestamp: new Date().toISOString(),
      });

      setIsSubmitting(false);
      setCurrentStep('confirm');

      showSuccessModal({
        title: 'Report Submitted',
        message: 'Thank you for helping keep our community safe. Our team will review this report within 24 hours.',
      });
    } catch (error) {
      setIsSubmitting(false);
      showErrorModal({ message: 'Failed to submit report. Please try again.' });
    }
  };

  const handleDone = () => {
    navigation.goBack();
  };

  const selectedCategoryData = REPORT_CATEGORIES.find(c => c.id === selectedCategory);
  const selectedSeverityData = SEVERITY_LEVELS.find(s => s.id === selectedSeverity);

  const renderCategoryStep = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeIn}>
      <Text style={styles.stepTitle}>Why are you reporting this {targetLabel.toLowerCase()}?</Text>
      <Text style={styles.stepSubtitle}>
        Your report is anonymous. The person you report will not know who reported them.
      </Text>

      <View style={styles.categoriesGrid}>
        {REPORT_CATEGORIES.map((category, index) => (
          <Animated.View 
            key={category.id} 
            entering={shouldReduceMotion ? undefined : FadeInUp.delay(index * 40)}
          >
            <TouchableOpacity
              style={[
                styles.categoryCard,
                selectedCategory === category.id && styles.categoryCardSelected,
              ]}
              onPress={() => handleCategorySelect(category.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                <Ionicons name={category.icon as any} size={22} color={category.color} />
              </View>
              <View style={styles.categoryText}>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryDesc} numberOfLines={2}>{category.description}</Text>
              </View>
              <Ionicons 
                name={selectedCategory === category.id ? "radio-button-on" : "radio-button-off"} 
                size={20} 
                color={selectedCategory === category.id ? CommunityColors.primary : CommunityColors.text.tertiary} 
              />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );

  const renderDetailsStep = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeIn}>
      <TouchableOpacity 
        style={styles.backStepBtn}
        onPress={() => setCurrentStep('category')}
      >
        <Ionicons name="arrow-back" size={18} color={CommunityColors.primary} />
        <Text style={styles.backStepText}>Change reason</Text>
      </TouchableOpacity>

      {selectedCategoryData && (
        <BlurView intensity={60} style={styles.selectedCategoryBanner} tint="light">
          <View style={[styles.selectedCatIcon, { backgroundColor: selectedCategoryData.color + '20' }]}>
            <Ionicons name={selectedCategoryData.icon as any} size={20} color={selectedCategoryData.color} />
          </View>
          <View>
            <Text style={styles.selectedCatTitle}>{selectedCategoryData.title}</Text>
            <Text style={styles.selectedCatDesc}>{selectedCategoryData.description}</Text>
          </View>
        </BlurView>
      )}

      <Text style={styles.sectionLabel}>How serious is this?</Text>
      <View style={styles.severityContainer}>
        {SEVERITY_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.severityBtn,
              selectedSeverity === level.id && { 
                backgroundColor: level.color + '20',
                borderColor: level.color },
            ]}
            onPress={() => {
              setSelectedSeverity(level.id);
              triggerHaptic('light');
            }}
          >
            <View style={[styles.severityDot, { backgroundColor: level.color }]} />
            <Text style={[
              styles.severityLabel,
              selectedSeverity === level.id && { color: level.color, fontWeight: '700' },
            ]}>
              {level.label}
            </Text>
            <Text style={styles.severityDesc}>{level.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Additional Details (Optional)</Text>
      <BlurView intensity={60} style={styles.inputContainer} tint="light">
        <TextInput
          style={styles.textInput}
          placeholder="Please provide any additional context that might help us understand the issue..."
          placeholderTextColor={CommunityColors.text.tertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </BlurView>

      {targetUserId && targetUserId !== currentUser?.id && (
        <TouchableOpacity 
          style={styles.blockOption}
          onPress={() => {
            setBlockAlso(!blockAlso);
            triggerHaptic('light');
          }}
        >
          <View style={styles.blockOptionLeft}>
            <Ionicons 
              name={blockAlso ? "checkbox" : "square-outline"} 
              size={22} 
              color={blockAlso ? CommunityColors.primary : CommunityColors.text.tertiary} 
            />
            <View style={styles.blockOptionText}>
              <Text style={styles.blockOptionTitle}>Also block this user</Text>
              <Text style={styles.blockOptionDesc}>
                You won't see their content and they can't message you
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <LinearGradient 
          colors={isSubmitting ? ['#ccc', '#aaa'] : CommunityGradients.primary} 
          style={styles.submitGradient}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={20} color="white" />
              <Text style={styles.submitText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.safetyNotice}>
        <Ionicons name="information-circle" size={16} color={CommunityColors.info} />
        <Text style={styles.safetyText}>
          If someone is in immediate danger, please contact local emergency services.
        </Text>
      </View>
    </Animated.View>
  );

  const renderConfirmStep = () => (
    <Animated.View entering={shouldReduceMotion ? undefined : FadeIn} style={styles.confirmContainer}>
      <View style={styles.confirmIcon}>
        <Ionicons name="shield-checkmark" size={64} color={CommunityColors.success} />
      </View>
      <Text style={styles.confirmTitle}>Report Received</Text>
      <Text style={styles.confirmText}>
        Thank you for helping us maintain a safe community. Our moderation team will review this report and take appropriate action within 24 hours.
      </Text>

      {blockAlso && targetUserId && (
        <BlurView intensity={60} style={styles.blockConfirmBanner} tint="light">
          <Ionicons name="ban" size={20} color={CommunityColors.error} />
          <Text style={styles.blockConfirmText}>
            This user has also been blocked. You can unblock them from your settings.
          </Text>
        </BlurView>
      )}

      <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
        <LinearGradient colors={CommunityGradients.primary} style={styles.doneGradient}>
          <Text style={styles.doneText}>Done</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.reportAnotherBtn}
        onPress={() => {
          setSelectedCategory(null);
          setDescription('');
          setBlockAlso(false);
          setCurrentStep('category');
        }}
      >
        <Text style={styles.reportAnotherText}>Report Another Issue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={CommunityColors.background.gradient} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <BlurView intensity={95} style={styles.header} tint="light">
        <LinearGradient 
          colors={['rgba(255,255,255,0.98)', 'rgba(255,250,250,0.95)']} 
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={CommunityColors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Report {targetLabel}</Text>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, currentStep === 'category' && styles.stepDotActive]} />
            <View style={[styles.stepLine, currentStep !== 'category' && styles.stepLineActive]} />
            <View style={[styles.stepDot, currentStep === 'details' && styles.stepDotActive]} />
            <View style={[styles.stepLine, currentStep === 'confirm' && styles.stepLineActive]} />
            <View style={[styles.stepDot, currentStep === 'confirm' && styles.stepDotActive]} />
          </View>
        </View>

        <View style={styles.headerButton} />
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <AutoHideAnimatedScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {currentStep === 'category' && renderCategoryStep()}
          {currentStep === 'details' && renderDetailsStep()}
          {currentStep === 'confirm' && renderConfirmStep()}
        </AutoHideAnimatedScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CommunitySpacing.md,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CommunityColors.divider,
    overflow: 'hidden',
  },
  headerButton: { padding: 8, width: 40 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: CommunityColors.text.primary },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CommunityColors.border,
  },
  stepDotActive: {
    backgroundColor: CommunityColors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: CommunityColors.border,
  },
  stepLineActive: {
    backgroundColor: CommunityColors.primary,
  },
  keyboardView: { flex: 1 },
  scrollContent: { padding: CommunitySpacing.lg, paddingBottom: 40 },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: CommunityColors.text.secondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  categoriesGrid: { gap: 10 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    ...CommunityShadows.sm,
  },
  categoryCardSelected: {
    borderColor: CommunityColors.primary,
    backgroundColor: CommunityColors.primary + '08',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryText: { flex: 1 },
  categoryTitle: { fontSize: 15, fontWeight: '700', color: CommunityColors.text.primary },
  categoryDesc: { fontSize: 12, color: CommunityColors.text.secondary, marginTop: 2 },
  backStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backStepText: { fontSize: 14, color: CommunityColors.primary, fontWeight: '600' },
  selectedCategoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    overflow: 'hidden',
  },
  selectedCatIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedCatTitle: { fontSize: 15, fontWeight: '700', color: CommunityColors.text.primary },
  selectedCatDesc: { fontSize: 12, color: CommunityColors.text.secondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CommunityColors.text.secondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  severityContainer: { gap: 8, marginBottom: 24 },
  severityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 10,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  severityLabel: { fontSize: 14, fontWeight: '600', color: CommunityColors.text.primary, width: 60 },
  severityDesc: { fontSize: 12, color: CommunityColors.text.secondary, flex: 1 },
  inputContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  textInput: {
    fontSize: 15,
    color: CommunityColors.text.primary,
    minHeight: 100,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 12,
    color: CommunityColors.text.tertiary,
    textAlign: 'right',
    marginTop: 8,
  },
  blockOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CommunityColors.background.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    ...CommunityShadows.sm,
  },
  blockOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  blockOptionText: { flex: 1 },
  blockOptionTitle: { fontSize: 14, fontWeight: '700', color: CommunityColors.text.primary },
  blockOptionDesc: { fontSize: 12, color: CommunityColors.text.secondary, marginTop: 2 },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...CommunityShadows.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitText: { color: 'white', fontSize: 16, fontWeight: '700' },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CommunityColors.info + '10',
    borderRadius: 12,
    padding: 12,
  },
  safetyText: {
    fontSize: 12,
    color: CommunityColors.text.secondary,
    flex: 1,
    lineHeight: 16,
  },
  confirmContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  confirmIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: CommunityColors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: CommunityColors.text.primary,
    marginBottom: 12,
  },
  confirmText: {
    fontSize: 15,
    color: CommunityColors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  blockConfirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    overflow: 'hidden',
  },
  blockConfirmText: {
    fontSize: 13,
    color: CommunityColors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  doneBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...CommunityShadows.md,
  },
  doneGradient: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  doneText: { color: 'white', fontSize: 16, fontWeight: '700' },
  reportAnotherBtn: {
    paddingVertical: 12,
  },
  reportAnotherText: {
    fontSize: 15,
    color: CommunityColors.primary,
    fontWeight: '600',
  },
});
