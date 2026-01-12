import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';

import {useTranslation} from 'react-i18next';
import {EmptyState} from '../components/EmptyState';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import type {RoomItem} from './RoomsScreen';

type Props = {
  title: string;
  rooms: RoomItem[];
  onBack?: (() => void) | null;
  onOpenRoom: (roomId: string, roomTitle?: string) => void;
  onOpenSettings: () => void;
  onOpenMain?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  pinnedByRoom?: Record<string, number>;
  onTogglePin?: (roomId: string) => void;
  onJoinRoom?: (roomId: string) => Promise<void>;
  onLeaveRoom?: (roomId: string) => Promise<void>;
  busyByRoom?: Record<string, boolean>;
};

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatShortDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

function formatTs(ts?: number | null): string {
  const v = Number(ts || 0);
  if (!v) return '';
  return isToday(v) ? formatTime(v) : formatShortDate(v);
}

export const RoomsListScreen: React.FC<Props> = ({
  title,
  rooms,
  onBack,
  onOpenRoom,
  onOpenSettings,
  onOpenMain,
  onNewDirect,
  refreshing,
  onRefresh,
  pinnedByRoom,
  onTogglePin,
}) => {
  const theme = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [search, setSearch] = useState('');
  const normalized = useMemo(() => search.trim().toLowerCase(), [search]);

  const isPinned = useCallback(
    (roomId: string) => {
      const pins = pinnedByRoom || {};
      return !!pins[roomId];
    },
    [pinnedByRoom],
  );

    const isDirectRoom = useCallback((item: any) => {
    const members = typeof item.members === 'number' ? item.members : 0;
    const isPrivate = !!item.isPrivate;
    return isPrivate && members === 2;
  }, []);

  const visibleRooms = useMemo(() => {
    const list = Array.isArray(visibleRooms) ? visibleRooms : [];
    if (title === 'Чаты') {
      return list.filter(it => isDirectRoom(it));
    }
    return list.filter(it => !isDirectRoom(it));
  }, [rooms, title, isDirectRoom]);

const filtered = useMemo(() => {
    const list = Array.isArray(visibleRooms) ? visibleRooms : [];
    if (!normalized) return list;

    return list.filter(item => {
      const tt = String(item.title || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      const last = String(item.lastMessage || '').toLowerCase();
      return tt.includes(normalized) || id.includes(normalized) || last.includes(normalized);
    });
  }, [visibleRooms, normalized]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const pins = pinnedByRoom || {};
    arr.sort((a, b) => {
      const pa = Number(pins[a.id] || 0);
      const pb = Number(pins[b.id] || 0);
      if (pb !== pa) return pb - pa;

      const ta = Number(a.lastMessageTs || 0);
      const tb = Number(b.lastMessageTs || 0);
      if (tb !== ta) return tb - ta;

      const ua = Number(a.unreadCount || 0);
      const ub = Number(b.unreadCount || 0);
      if (ub !== ua) return ub - ua;

      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    return arr;
  }, [filtered, pinnedByRoom]);

  const clearSearch = useCallback(() => setSearch(''), []);

  const right = useMemo(() => {
    return (
      <View style={styles.headerRight}>
        {onOpenMain ? (
          <Pressable style={styles.headerBtn} onPress={onOpenMain}>
            <Text style={styles.headerBtnText}>{t('roomsList.headerRooms')}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.headerBtn} onPress={onOpenSettings}>
          <Text style={styles.headerBtnText}>{t('roomsList.headerSettings')}</Text>
        </Pressable>
      </View>
    );
  }, [onOpenMain, onOpenSettings, styles, t]);

  return (
    <View style={styles.root}>
      <AppHeader title={title} onBack={onBack ?? null} right={right} />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={
            title.toLowerCase().includes('чат')
              ? t('roomsList.searchChats')
              : t('roomsList.searchRooms')
          }
          placeholderTextColor={theme.colors.placeholder}
        />
        {search ? (
          <Pressable style={styles.searchClear} onPress={clearSearch} accessibilityRole="button">
            <Text style={styles.searchClearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listPad}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        renderItem={({item}) => {
          const pinned = isPinned(item.id);
          const unread = Number(item.unreadCount || 0);
          const time = formatTs(item.lastMessageTs);

          const badgeText =
            item.type === 'my'
              ? t('roomsList.badgeMy')
              : item.type === 'open'
              ? t('roomsList.badgeOpen')
              : item.isPrivate
              ? t('roomsList.badgePrivate')
              : t('roomsList.badgePublic');

          return (
            <Pressable
              style={({pressed}) => [styles.card, pressed ? styles.cardPressed : null]}
              onPress={() => onOpenRoom(item.id, item.title)}
              onLongPress={onTogglePin ? () => onTogglePin(item.id) : undefined}
              delayLongPress={350}>
              <View style={styles.cardTopRow}>
                <View style={styles.leftCol}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.badge, item.isPrivate ? styles.badgePrivate : styles.badgePublic]}>
                      {badgeText}
                    </Text>
                    {pinned ? <Text style={styles.pin}>📌</Text> : null}
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title || item.id}
                    </Text>
                  </View>

                  {item.lastMessage ? (
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {item.lastMessage}
                    </Text>
                  ) : (
                    <Text style={styles.subtitleEmpty} numberOfLines={1}>
                      {t('roomsList.emptyLastMessage')}
                    </Text>
                  )}
                </View>

                <View style={styles.rightCol}>
                  {time ? <Text style={styles.time}>{time}</Text> : null}
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{unread > 99 ? '99+' : String(unread)}</Text>
                    </View>
                  ) : (
                    <View style={styles.unreadSpacer} />
                  )}
                </View>

{(item.type === 'public' || item.type === 'my') ? (
  <TouchableOpacity
    style={[
      styles.actionBtn,
      (busyByRoom && busyByRoom[item.id]) ? styles.actionBtnDisabled : null,
    ]}
    disabled={!!(busyByRoom && busyByRoom[item.id])}
    onPress={() => {
      if (item.type === 'public') {
        const doJoin = async () => {
          try {
            if (onJoinRoom) {
              await onJoinRoom(item.id);
            }
            onOpenRoom(item.id, item.title);
          } catch (e) {
            console.warn('joinRoom failed', e);
            Alert.alert(t('common.error'), t('roomsList.joinError'));
          }
        };
        doJoin();
        return;
      }

      if (item.type === 'my') {
        if (item.role === 'owner') {
          onOpenRoom(item.id, item.title);
          return;
        }
        Alert.alert(
          t('roomsList.leaveConfirmTitle'),
          t('roomsList.leaveConfirmMessage'),
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('roomsList.actionLeave'),
              style: 'destructive',
              onPress: () => {
                const doLeave = async () => {
                  try {
                    if (onLeaveRoom) {
                      await onLeaveRoom(item.id);
                    }
                  } catch (e) {
                    console.warn('leaveRoom failed', e);
                    Alert.alert(t('common.error'), t('roomsList.leaveError'));
                  }
                };
                doLeave();
              },
            },
          ],
        );
      }
    }}>
    <Text style={styles.actionBtnText}>
      {item.type === 'public'
        ? t('roomsList.actionJoin')
        : item.role === 'owner'
        ? t('roomsList.actionOpen')
        : t('roomsList.actionLeave')}
    </Text>
  </TouchableOpacity>
) : (
  <View style={styles.actionBtnSpacer} />
)}
              </View>

              <Text style={styles.hintLine} numberOfLines={1}>
                {onTogglePin ? t('roomsList.hintPin') : ''}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <EmptyState
            title={title === 'Чаты' ? t('roomsList.emptyChatsTitle') : t('roomsList.emptyRoomsTitle')}
            subtitle={title === 'Чаты'
              ? t('roomsList.emptyChatsSubtitle')
              : t('roomsList.emptyRoomsSubtitle')}
          />
        )}
        />
    </View>
  );
};

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: theme.colors.bg},
    headerRight: {flexDirection: 'row', alignItems: 'center', gap: 10},
    headerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgElevated,
    },
    headerBtnText: {...theme.typography.body, color: theme.colors.text},
    searchWrap: {
      marginHorizontal: 14,
      marginTop: 12,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      backgroundColor: theme.colors.bgElevated,
      paddingHorizontal: 12,
      paddingVertical: 10,
      position: 'relative',
    },
    searchInput: {...theme.typography.bodyRegular, color: theme.colors.text, paddingRight: 28},
    searchClear: {
      position: 'absolute',
      right: 10,
      top: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.ghostBg,
      borderWidth: 1,
      borderColor: theme.colors.ghostBorder,
    },
    searchClearText: {fontSize: 20, color: theme.colors.textMuted, marginTop: -2},
    listPad: {padding: 14, paddingTop: 10, paddingBottom: 28},
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 12,
      ...theme.shadows.card,
    },
    cardPressed: {opacity: 0.92},
    cardTopRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
    leftCol: {flex: 1, minWidth: 0},
    rightCol: {alignItems: 'flex-end', justifyContent: 'space-between', minWidth: 60},
    titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
    badge: {
      ...theme.typography.tiny,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      overflow: 'hidden',
    },
    badgePublic: {backgroundColor: theme.colors.ghostBg, borderColor: theme.colors.ghostBorder, color: theme.colors.textMuted},
    badgePrivate: {backgroundColor: 'rgba(255,59,48,0.10)', borderColor: 'rgba(255,59,48,0.25)', color: theme.colors.danger},
    pin: {fontSize: 12, color: theme.colors.textMuted},
    title: {...theme.typography.title, color: theme.colors.text, flex: 1},
    subtitle: {...theme.typography.bodyRegular, color: theme.colors.textMuted, marginTop: 6},
    subtitleEmpty: {...theme.typography.bodyRegular, color: theme.colors.textFaint, marginTop: 6},
    time: {...theme.typography.tiny, color: theme.colors.textMuted},
    unreadBadge: {
      marginTop: 8,
      minWidth: 28,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadText: {...theme.typography.tiny, color: '#fff'},
    unreadSpacer: {height: 22, marginTop: 8},
    actionBtn: {
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnDisabled: {opacity: 0.5},
    actionBtnText: {...theme.typography.tiny, color: theme.colors.text},
    actionBtnSpacer: {height: 36, marginTop: 10},
    hintLine: {...theme.typography.tiny, color: theme.colors.textFaint, marginTop: 10},
    empty: {
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgElevated,
      alignItems: 'center',
    },
    emptyTitle: {...theme.typography.title, color: theme.colors.text, marginBottom: 6},
    emptyText: {...theme.typography.bodyRegular, color: theme.colors.textMuted, textAlign: 'center'},
  });
