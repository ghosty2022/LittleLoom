import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const FAMILY_MEMBERS = [
  { id: '1', name: 'You', role: 'Admin', emoji: '👩', status: 'online', isYou: true },
  { id: '2', name: 'Dad', role: 'Parent', emoji: '👨', status: 'online', isYou: false },
  { id: '3', name: 'Grandma', role: 'Caregiver', emoji: '👵', status: 'offline', isYou: false },
];

const ACTIVITIES = [
  { id: '1', user: 'Dad', action: 'logged potty success', time: '2 min ago', emoji: '🚽' },
  { id: '2', user: 'You', action: 'added feeding', time: '1 hour ago', emoji: '🍼' },
  { id: '3', user: 'Grandma', action: 'updated sleep schedule', time: '3 hours ago', emoji: '😴' },
];

export default function FamilySharingScreen({ navigation }: any) {
  return (
    <LinearGradient colors={['#e0e7ff', '#d1d5ff', '#c7b8ff']} style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.title}>Family 👨‍👩‍👧</Text>
          <TouchableOpacity style={styles.addButton}>
            <BlurView intensity={80} style={styles.addBlur}>
              <Ionicons name="person-add" size={24} color="#667eea" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Family Code */}
        <BlurView intensity={90} style={styles.codeCard}>
          <View style={styles.codeContent}>
            <Text style={styles.codeLabel}>Family Code</Text>
            <Text style={styles.codeValue}>LOOM-7842</Text>
            <Text style={styles.codeHint}>Share this to invite family members</Text>
          </View>
          <TouchableOpacity style={styles.copyButton}>
            <Ionicons name="copy-outline" size={24} color="#667eea" />
          </TouchableOpacity>
        </BlurView>

        {/* Members */}
        <Text style={styles.sectionTitle}>Family Members</Text>
        <BlurView intensity={90} style={styles.membersContainer}>
          {FAMILY_MEMBERS.map((member, index) => (
            <View key={member.id}>
              <View style={styles.memberRow}>
                <View style={styles.memberLeft}>
                  <View style={styles.avatarContainer}>
                    <Text style={styles.memberAvatar}>{member.emoji}</Text>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: member.status === 'online' ? '#11998e' : '#999' }
                    ]} />
                  </View>
                  <View>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName}>
                        {member.name} {member.isYou && <Text style={styles.youBadge}>(You)</Text>}
                      </Text>
                    </View>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                </View>
                {!member.isYou && (
                  <TouchableOpacity style={styles.moreButton}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              {index !== FAMILY_MEMBERS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </BlurView>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {ACTIVITIES.map((activity) => (
          <BlurView key={activity.id} intensity={80} style={styles.activityCard}>
            <Text style={styles.activityEmoji}>{activity.emoji}</Text>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>
                <Text style={styles.activityUser}>{activity.user}</Text> {activity.action}
              </Text>
              <Text style={styles.activityTime}>{activity.time}</Text>
            </View>
          </BlurView>
        ))}

        {/* Permissions */}
        <Text style={styles.sectionTitle}>Permissions</Text>
        <BlurView intensity={90} style={styles.permissionsCard}>
          <View style={styles.permissionRow}>
            <Ionicons name="create-outline" size={24} color="#667eea" />
            <Text style={styles.permissionText}>Can add logs</Text>
            <Text style={styles.permissionValue}>All members</Text>
          </View>
          <View style={styles.permissionDivider} />
          <View style={styles.permissionRow}>
            <Ionicons name="trash-outline" size={24} color="#667eea" />
            <Text style={styles.permissionText}>Can delete logs</Text>
            <Text style={styles.permissionValue}>Parents only</Text>
          </View>
          <View style={styles.permissionDivider} />
          <View style={styles.permissionRow}>
            <Ionicons name="settings-outline" size={24} color="#667eea" />
            <Text style={styles.permissionText}>Manage reminders</Text>
            <Text style={styles.permissionValue}>Parents only</Text>
          </View>
        </BlurView>
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
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
  },
  codeContent: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 4,
  },
  codeHint: {
    fontSize: 13,
    color: '#999',
  },
  copyButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(102,126,234,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    marginTop: 8,
  },
  membersContainer: {
    borderRadius: 24,
    paddingVertical: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  memberAvatar: {
    fontSize: 40,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  youBadge: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 76,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  activityEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  activityUser: {
    fontWeight: '700',
    color: '#667eea',
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  permissionsCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  permissionText: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 16,
  },
  permissionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  permissionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});