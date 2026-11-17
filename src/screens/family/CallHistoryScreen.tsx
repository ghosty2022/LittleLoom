import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomization } from '../../hooks/useCustomization';
import { useCall, CallHistoryEntry } from '../../context/CallContext';
import { useFamily } from '../../context/FamilyContext';
import { SafeAvatar } from '../../components/SafeAvatar';

const DS = {
  primary: '#6366f1', accent: '#ec4899', success: '#10b981',
  warning: '#f59e0b', danger: '#ef4444', white: '#fff',
  gray100: '#f5f5f4', gray200: '#e7e5e4', gray400: '#a8a29e',
  gray500: '#78716c', gray900: '#1c1917',
  darkBg: '#0c0a09', darkSurface: '#1c1917', darkBorder: 'rgba(255,255,255,0.06)',
};

export default function CallHistoryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDark } = useCustomization();
  const { callHistory, clearCallHistory, startCall } = useCall();
  const { members } = useFamily();

  const resolveName = useCallback((e: CallHistoryEntry) => {
    const m = members.find((x: any) => x.id === e.peerId || x.userId === e.peerId);
    return m?.fullName || e.peerName;
  }, [members]);

  const resolveAvatar = useCallback((e: CallHistoryEntry) => {
    const m = members.find((x: any) => x.id === e.peerId || x.userId === e.peerId);
    return m?.avatar || e.peerAvatar;
  }, [members]);

  const renderItem = ({ item }: { item: CallHistoryEntry }) => {
    const d = new Date(item.startedAt);
    const when = isToday(d) ? format(d, 'h:mm a')
      : isYesterday(d) ? `Yesterday ${format(d, 'h:mm a')}`
      : format(d, 'MMM d, h:mm a');

    const missed = item.status === 'missed' || item.status === 'declined';
    const isVideo = item.type === 'video';
    const isIncoming =
      item.status === 'incoming' || item.status === 'missed';

    return (
      <TouchableOpacity
        style={[styles.row, { borderColor: isDark ? DS.darkBorder : DS.gray200 }]}
        onPress={() =>
          startCall({
            chatId: item.chatId,
            type: item.type,
            peer: {
              id: item.peerId,
              name: resolveName(item),
              avatar: resolveAvatar(item),
            },
          })
        }
      >
        <SafeAvatar avatar={resolveAvatar(item)} size={44} fallbackColor={isVideo ? DS.primary : DS.accent} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: missed ? DS.danger : isDark ? DS.white : DS.gray900 }} numberOfLines={1}>
            {resolveName(item)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons
              name={isIncoming ? 'arrow-down' : 'arrow-up'}
              size={12}
              color={missed ? DS.danger : DS.success}
            />
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={12} color={isDark ? DS.gray400 : DS.gray500} />
            <Text style={{ fontSize: 12, color: isDark ? DS.gray400 : DS.gray500 }}>
              {missed ? 'Missed' : `${Math.floor(item.durationSec / 60)}m ${item.durationSec % 60}s`} · {when}
            </Text>
          </View>
        </View>
        <Ionicons name={isVideo ? 'videocam-outline' : 'call-outline'} size={22} color={DS.primary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? DS.darkBg : DS.gray100, paddingTop: insets.top }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color={isDark ? DS.white : DS.gray900} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: isDark ? DS.white : DS.gray900 }}>Calls</Text>
        <TouchableOpacity onPress={clearCallHistory} style={{ padding: 8 }}>
          <Ionicons name="trash-outline" size={20} color={DS.danger} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={callHistory}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 60, color: isDark ? DS.gray400 : DS.gray500 }}>
            No calls yet
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
});