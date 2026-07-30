import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../types/navigation';
import { useCustomization } from '../../hooks/useCustomization';
import { useFamily } from '../../context/FamilyContext';
import { useAuth } from '../../context/AuthContext';
import { useBaby } from '../../context/BabyContext';
import { useSweetAlert } from '../../components/SweetAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilySettings'>;

/* ─── Reusable Menu Item ─────────────────────────────────────────── */

const MenuItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  color: string;
  isDark: boolean;
  isLast?: boolean;
  isDestructive?: boolean;
}> = ({ icon, title, subtitle, onPress, color, isDark, isLast, isDestructive }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[styles.menuItem, !isLast && styles.menuItemBorder]}
  >
    <View
      style={[
        styles.menuIconWrap,
        {
          backgroundColor: isDestructive
            ? 'rgba(239,68,68,0.12)'
            : `${color}12`,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={isDestructive ? '#ef4444' : color}
      />
    </View>
    <View style={styles.menuTextContainer}>
      <Text
        style={[
          styles.menuTitle,
          {
            color: isDestructive
              ? '#ef4444'
              : isDark
              ? '#fff'
              : '#1a1a1a',
          },
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[styles.menuSubtitle, isDark && styles.textMuted]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      )}
    </View>
    <Ionicons
      name="chevron-forward"
      size={18}
      color={isDark ? '#666' : '#bbb'}
    />
  </TouchableOpacity>
);

/* ─── Main Screen ────────────────────────────────────────────────── */

export default function FamilySettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark, themeColors, fullThemeColors } = useCustomization();
  const { members, parent2, guardians, removeMember } = useFamily();
  const { userProfile } = useAuth();
  const { currentBaby } = useBaby();
  const sweetAlert = useSweetAlert();

  const primary = themeColors?.primary || '#667eea';
  const secondary = themeColors?.secondary || '#fa709a';
  const accent = themeColors?.accent || '#43e97b';

  const bgColors = useMemo(() => {
    if (isDark) {
      return [
        fullThemeColors?.background || '#0f0f1e',
        fullThemeColors?.surface || '#1a1a2e',
      ];
    }
    return [
      fullThemeColors?.background || '#f8faff',
      fullThemeColors?.surface || '#ffffff',
    ];
  }, [isDark, fullThemeColors]);

  const familyCount = useMemo(
    () => members.length + (currentBaby ? 1 : 0),
    [members, currentBaby]
  );

  const hasCoParent = useMemo(
    () => members.some((m) => m.role === 'parent2') || !!parent2,
    [members, parent2]
  );

  const handleLeaveFamily = useCallback(() => {
    sweetAlert.confirm(
      'Leave Family?',
      'You will lose access to this family\'s data unless you are re-invited.',
      async () => {
        // Implement your leave-family logic here (e.g. call removeMember on yourself)
        sweetAlert.toast('Left Family', 'You have been removed from the family group.', 'info');
        navigation.goBack();
      },
      undefined,
      'Leave',
      'Stay',
      true
    );
  }, [sweetAlert, navigation]);

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, isDark && styles.backBtnDark]}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? '#fff' : '#1a1a1a'}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>
          Family Settings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <Animated.View
          entering={FadeInUp.delay(50)}
          style={{ marginHorizontal: 16, marginBottom: 20 }}
        >
          <BlurView
            intensity={isDark ? 40 : 80}
            style={styles.summaryCard}
            tint={isDark ? 'dark' : 'light'}
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(40,40,45,0.6)', 'rgba(25,25,30,0.4)']
                  : ['rgba(255,255,255,0.8)', 'rgba(250,250,255,0.6)']
              }
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: primary }]}>
                  {familyCount}
                </Text>
                <Text
                  style={[styles.summaryLabel, isDark && styles.textMuted]}
                >
                  Members
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: secondary }]}>
                  {hasCoParent ? 'Yes' : 'No'}
                </Text>
                <Text
                  style={[styles.summaryLabel, isDark && styles.textMuted]}
                >
                  Co-Parent
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: accent }]}>
                  {guardians?.length || 0}
                </Text>
                <Text
                  style={[styles.summaryLabel, isDark && styles.textMuted]}
                >
                  Guardians
                </Text>
              </View>
            </View>
          </BlurView>
        </Animated.View>

        {/* Management */}
        <Animated.View
          entering={FadeInUp.delay(100)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `${primary}18` },
              ]}
            >
              <Ionicons name="people" size={22} color={primary} />
            </View>
            <View>
              <Text
                style={[styles.sectionTitle, isDark && styles.textLight]}
              >
                Family Management
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  isDark && styles.textMuted,
                ]}
              >
                Manage your household
              </Text>
            </View>
          </View>

          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="people-outline"
              title="Family Dashboard"
              subtitle="View and manage family members"
              onPress={() => navigation.navigate('FamilySharing')}
              color={primary}
              isDark={isDark}
            />
            <MenuItem
              icon="person-add"
              title="Invite Co-Parent"
              subtitle="Send an invite to your partner"
              onPress={() =>
                navigation.navigate('FamilySharing', { openInvite: true })
              }
              color="#11998e"
              isDark={isDark}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              title="Permissions"
              subtitle="Control what family members can access"
              onPress={() => navigation.navigate('FamilySharing')}
              color="#f59e0b"
              isDark={isDark}
              isLast
            />
          </BlurView>
        </Animated.View>

        {/* Data & Privacy */}
        <Animated.View
          entering={FadeInUp.delay(150)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `rgba(239,68,68,0.12)` },
              ]}
            >
              <Ionicons name="lock-closed" size={22} color="#ef4444" />
            </View>
            <View>
              <Text
                style={[styles.sectionTitle, isDark && styles.textLight]}
              >
                Data & Privacy
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  isDark && styles.textMuted,
                ]}
              >
                Family data controls
              </Text>
            </View>
          </View>

          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="share-outline"
              title="Export Family Data"
              subtitle="Backup all family records"
              onPress={() => navigation.navigate('BackupRestore')}
              color={accent}
              isDark={isDark}
            />
            <MenuItem
              icon="notifications-outline"
              title="Family Notifications"
              subtitle="Alerts for family activity"
              onPress={() => navigation.navigate('TrackerReminders')}
              color="#4facfe"
              isDark={isDark}
              isLast
            />
          </BlurView>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View
          entering={FadeInUp.delay(200)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIconWrap,
                { backgroundColor: `rgba(239,68,68,0.12)` },
              ]}
            >
              <Ionicons name="warning" size={22} color="#ef4444" />
            </View>
            <View>
              <Text
                style={[styles.sectionTitle, isDark && styles.textLight]}
              >
                Danger Zone
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  isDark && styles.textMuted,
                ]}
              >
                Destructive actions
              </Text>
            </View>
          </View>

          <BlurView
            intensity={isDark ? 30 : 70}
            style={styles.menuContainer}
            tint={isDark ? 'dark' : 'light'}
          >
            <MenuItem
              icon="exit-outline"
              title="Leave Family"
              subtitle="Remove yourself from this family group"
              onPress={handleLeaveFamily}
              color="#ef4444"
              isDark={isDark}
              isDestructive
              isLast
            />
          </BlurView>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  textLight: { color: '#ffffff' },
  textMuted: { color: '#888' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },

  summaryCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: { alignItems: 'center', gap: 6 },
  summaryValue: { fontSize: 28, fontWeight: '800' },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(100,116,139,0.15)',
  },

  section: { marginBottom: 4, paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },

  menuContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContainer: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
  },
});