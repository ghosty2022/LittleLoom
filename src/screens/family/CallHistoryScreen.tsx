// src/screens/family/CallHistoryScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomization } from '../../hooks/useCustomization';
import { useCall, CallHistoryEntry } from '../../context/CallContext';
import { useFamily } from '../../context/FamilyContext';
import { SafeAvatar } from '../../components/SafeAvatar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DS = {
  primary: '#6366f1',
  accent: '#ec4899',
  success: '#10b981',
  info: '#0ea5e9',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#fff',
  gray100: '#f5f5f4',
  gray200: '#e7e5e4',
  gray400: '#a8a29e',
  gray500: '#78716c',
  gray900: '#1c1917',
  darkBg: '#0c0a09',
  darkSurface: '#1c1917',
  darkBorder: 'rgba(255,255,255,0.06)',
};

// Matches the shape of `groupedCallHistory` in CallContext.
type CallGroup = {
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  chatId: string;
  type: 'voice' | 'video';
  count: number;
  missedCount: number;
  latest: CallHistoryEntry;
  entries: CallHistoryEntry[];
};

const whenLabel = (d: Date): string =>
  isToday(d)
    ? format(d, 'h:mm a')
    : isYesterday(d)
    ? `Yesterday ${format(d, 'h:mm a')}`
    : format(d, 'MMM d, h:mm a');

const durationLabel = (sec: number): string =>
  sec > 0 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : '';

export default function CallHistoryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDark } = useCustomization();
  const { groupedCallHistory, clearCallHistory, startCall } = useCall();
  const { members } = useFamily();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const resolveName = useCallback(
    (peerId: string, fallback: string) => {
      const m = members.find(
        (x: any) => x.id === peerId || x.userId === peerId,
      );
      return m?.fullName || fallback;
    },
    [members],
  );

  const resolveAvatar = useCallback(
    (peerId: string, fallback?: string) => {
      const m = members.find(
        (x: any) => x.id === peerId || x.userId === peerId,
      );
      return m?.avatar || fallback;
    },
    [members],
  );

  const toggleExpand = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const renderGroup = useCallback(
    ({ item }: { item: CallGroup }) => {
      const latest = item.latest;
      const name = resolveName(item.peerId, item.peerName);
      const avatar = resolveAvatar(item.peerId, item.peerAvatar);
      const latestMissed =
        latest.status === 'missed' || latest.status === 'declined';
      const key = item.peerId || item.chatId;
      const expanded = expandedKey === key;
      const isVideo = latest.type === 'video';
      const accent = item.missedCount > 0 ? DS.danger : DS.success;

      const statusText = latestMissed
        ? 'Missed'
        : latest.status === 'outgoing'
        ? 'Outgoing'
        : 'Received';

      const redial = () =>
        startCall({
          chatId: latest.chatId,
          type: latest.type,
          peer: { id: item.peerId, name, avatar },
        });

      return (
        <View
          style={[
            styles.groupCard,
            {
              backgroundColor: isDark ? DS.darkSurface : DS.white,
              borderColor: isDark ? DS.darkBorder : DS.gray200,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => toggleExpand(key)}
            onLongPress={redial}
          >
            <View style={styles.groupRow}>
              <SafeAvatar
                avatar={avatar}
                size={46}
                fallbackEmoji="👤"
                fallbackColor={accent}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: latestMissed
                        ? DS.danger
                        : isDark
                        ? DS.white
                        : DS.gray900,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {item.count > 1 && (
                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: `${DS.primary}18` },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: DS.primary,
                        }}
                      >
                        {item.count} dials
                      </Text>
                    </View>
                  )}
                  {item.missedCount > 0 && (
                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: `${DS.danger}18` },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: DS.danger,
                        }}
                      >
                        {item.missedCount} missed
                      </Text>
                    </View>
                  )}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  <Ionicons
                    name={
                      latest.status === 'outgoing' ? 'arrow-up' : 'arrow-down'
                    }
                    size={12}
                    color={latestMissed ? DS.danger : DS.success}
                  />
                  <Ionicons
                    name={isVideo ? 'videocam' : 'call'}
                    size={12}
                    color={isDark ? DS.gray400 : DS.gray500}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: isDark ? DS.gray400 : DS.gray500,
                    }}
                    numberOfLines={1}
                  >
                    {statusText}
                    {' · '}
                    {whenLabel(new Date(latest.startedAt))}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={redial}
                style={{ padding: 8 }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name={isVideo ? 'videocam' : 'call'}
                  size={22}
                  color={accent}
                />
              </TouchableOpacity>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isDark ? DS.gray500 : DS.gray400}
                style={{ marginLeft: 4 }}
              />
            </View>
          </TouchableOpacity>

          {expanded && (
            <View
              style={[
                styles.detailWrap,
                { borderTopColor: isDark ? DS.darkBorder : DS.gray200 },
              ]}
            >
              {item.entries.map((e: CallHistoryEntry) => {
                const missed =
                  e.status === 'missed' || e.status === 'declined';
                const dur = durationLabel(e.durationSec);
                return (
                  <View key={e.id} style={styles.detailRow}>
                    <View style={{ width: 44 }}>
                      <Ionicons
                        name={
                          missed
                            ? 'close-circle'
                            : e.status === 'outgoing'
                            ? 'arrow-up-circle'
                            : 'arrow-down-circle'
                        }
                        size={18}
                        color={missed ? DS.danger : DS.success}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: isDark ? DS.white : DS.gray900,
                        }}
                      >
                        {missed
                          ? 'Missed'
                          : e.status === 'outgoing'
                          ? 'Outgoing'
                          : 'Received'}{' '}
                        · {e.type}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: isDark ? DS.gray400 : DS.gray500,
                        }}
                      >
                        {whenLabel(new Date(e.startedAt))}
                        {dur ? ` · ${dur}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        startCall({
                          chatId: e.chatId,
                          type: e.type,
                          peer: { id: e.peerId, name, avatar },
                        })
                      }
                      style={{ padding: 8 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name={
                          e.type === 'video' ? 'videocam-outline' : 'call-outline'
                        }
                        size={18}
                        color={DS.primary}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      );
    },
    [
      resolveName,
      resolveAvatar,
      expandedKey,
      toggleExpand,
      isDark,
      startCall,
    ],
  );

  const data = groupedCallHistory as unknown as CallGroup[];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? DS.darkBg : DS.gray100,
        paddingTop: insets.top,
      }}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 8 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDark ? DS.white : DS.gray900}
          />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '800',
            color: isDark ? DS.white : DS.gray900,
          }}
        >
          Calls
        </Text>
        <TouchableOpacity
          onPress={clearCallHistory}
          style={{ padding: 8 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color={DS.danger} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={data}
        keyExtractor={(i) => (i.peerId || i.chatId) as string}
        renderItem={renderGroup}
        extraData={expandedKey}
        contentContainerStyle={{
          padding: 12,
          paddingBottom: insets.bottom + 24,
        }}
        ListEmptyComponent={
          <Text
            style={{
              textAlign: 'center',
              marginTop: 60,
              color: isDark ? DS.gray400 : DS.gray500,
            }}
          >
            No calls yet
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  detailWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
});