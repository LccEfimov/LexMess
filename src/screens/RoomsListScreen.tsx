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

import {EmptyState} from '../components/EmptyState';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import type {RoomItem} from './RoomsScreen';
import {i18n} from '../i18n';
import {formatTs} from '../utils/dateTime';

type Props = {
  title: string;
  rooms: RoomItem[];
  listKind?: 'chats' | 'rooms';
  onBack?: (() => void) | null;
  onOpenRoom: (roomId: string, roomTitle?: string) => void;
  onOpenSettings: () => void;
  onOpenMain?: () => void;
  onNewDirect?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  pinnedByRoom?: Record<string, number>;
  onTogglePin?: (roomId: string) => void;
  onJoinRoom?: (roomId: string) => Promise<void>;
  onLeaveRoom?: (roomId: string) => Promise<void>;
  busyByRoom?: Record<string, boolean>;
};

export const RoomsListScreen: React.FC<Props> = ({
  title,
  rooms,
  listKind = 'rooms',
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const locale = i18n.getLocale();

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

  const filtered = useMemo(() => {
    const list = Array.isArray(rooms) ? rooms : [];
    const filteredByKind =
      listKind === 'chats' ? list.filter(it => isDirectRoom(it)) : list.filter(it => !isDirectRoom(it));
    if (!normalized) return filteredByKind;

    return filteredByKind.filter(item => {
      const tt = String(item.title || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      const last = String(item.lastMessage || '').toLowerCase();
      return tt.includes(normalized) || id.includes(normalized) || last.includes(normalized);
    });
  }, [rooms, title, listKind, normalized, isDirectRoom]);

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
          <Pressable style={[styles.headerBtn, styles.headerBtnSpacing]} onPress={onOpenMain}>
            <Text style={styles.headerBtnText}>{i18n.t('roomsList.header.rooms')}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.headerBtn} onPress={onOpenSettings}>
          <Text style={styles.headerBtnText}>{i18n.t('roomsList.header.settings')}</Text>
        </Pressable>
      </View>
    );
  }, [locale, onOpenMain, onOpenSettings, styles]);

  return (
    <View style={styles.root}>
      <AppHeader title={title} onBack={onBack ?? null} right={right} />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={
            listKind === 'chats'
              ? i18n.t('roomsList.search.chats')
              : i18n.t('roomsList.search.rooms')
          }
          placeholderTextColor={t.colors.placeholder}
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
              ? i18n.t('roomsList.badge.my')
              : item.type === 'open'
              ? i18n.t('roomsList.badge.open')
              : item.isPrivate
              ? i18n.t('roomsList.badge.private')
              : i18n.t('roomsList.badge.public');

          return (
            <Pressable
              style={({pressed}) => [styles.card, pressed ? styles.cardPressed : null]}
              onPress={() => onOpenRoom(item.id, item.title)}
              onLongPress={onTogglePin ? () => onTogglePin(item.id) : undefined}
              delayLongPress={350}>
              <View style={styles.cardTopRow}>
                <View style={[styles.leftCol, styles.cardTopItem]}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.badge,
                        styles.titleRowItem,
                        item.isPrivate ? styles.badgePrivate : styles.badgePublic,
                      ]}>
                      {badgeText}
                    </Text>
                    {pinned ? <Text style={[styles.pin, styles.titleRowItem]}>📌</Text> : null}
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
                      {i18n.t('roomsList.noMessages')}
                    </Text>
                  )}
                </View>

                <View style={[styles.rightCol, styles.cardTopItem]}>
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
            Alert.alert(i18n.t('roomsList.alerts.joinErrorTitle'), i18n.t('roomsList.alerts.joinErrorBody'));
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
          i18n.t('roomsList.alerts.leaveConfirmTitle'),
          i18n.t('roomsList.alerts.leaveConfirmBody'),
          [
            {text: i18n.t('roomsList.alerts.leaveConfirmCancel'), style: 'cancel'},
            {
              text: i18n.t('roomsList.alerts.leaveConfirmLeave'),
              style: 'destructive',
              onPress: () => {
                const doLeave = async () => {
                  try {
                    if (onLeaveRoom) {
                      await onLeaveRoom(item.id);
                    }
                  } catch (e) {
                    console.warn('leaveRoom failed', e);
                    Alert.alert(i18n.t('roomsList.alerts.leaveErrorTitle'), i18n.t('roomsList.alerts.leaveErrorBody'));
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
        ? i18n.t('roomsList.actions.join')
        : item.role === 'owner'
        ? i18n.t('roomsList.actions.open')
        : i18n.t('roomsList.actions.leave')}
    </Text>
  </TouchableOpacity>
) : (
  <View style={styles.actionBtnSpacer} />
)}
              </View>

              <Text style={styles.hintLine} numberOfLines={1}>
                {onTogglePin ? i18n.t('roomsList.pinHint') : ''}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <EmptyState
            title={
              listKind === 'chats'
                ? i18n.t('roomsList.empty.chatsTitle')
                : i18n.t('roomsList.empty.roomsTitle')
            }
            subtitle={
              listKind === 'chats'
                ? i18n.t('roomsList.empty.chatsSubtitle')
                : i18n.t('roomsList.empty.roomsSubtitle')
            }
          />
        )}
        />
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: t.colors.bg},
    headerRight: {flexDirection: 'row', alignItems: 'center'},
    headerBtnSpacing: {marginRight: 10},
    headerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
    },
    headerBtnText: {...t.typography.body, color: t.colors.text},
    searchWrap: {
      marginHorizontal: 14,
      marginTop: 12,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.bgElevated,
      paddingHorizontal: 12,
      paddingVertical: 10,
      position: 'relative',
    },
    searchInput: {...t.typography.bodyRegular, color: t.colors.text, paddingRight: 28},
    searchClear: {
      position: 'absolute',
      right: 10,
      top: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.ghostBg,
      borderWidth: 1,
      borderColor: t.colors.ghostBorder,
    },
    searchClearText: {fontSize: 20, color: t.colors.textMuted, marginTop: -2},
    listPad: {padding: 14, paddingTop: 10, paddingBottom: 28},
    card: {
      backgroundColor: t.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 14,
      marginBottom: 12,
      ...t.shadows.card,
    },
    cardPressed: {opacity: 0.92},
    cardTopRow: {flexDirection: 'row', alignItems: 'flex-start'},
    cardTopItem: {marginRight: 10},
    leftCol: {flex: 1, minWidth: 0},
    rightCol: {alignItems: 'flex-end', justifyContent: 'space-between', minWidth: 60},
    titleRow: {flexDirection: 'row', alignItems: 'center'},
    titleRowItem: {marginRight: 8},
    badge: {
      ...t.typography.tiny,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      overflow: 'hidden',
    },
    badgePublic: {backgroundColor: t.colors.ghostBg, borderColor: t.colors.ghostBorder, color: t.colors.textMuted},
    badgePrivate: {backgroundColor: 'rgba(255,59,48,0.10)', borderColor: 'rgba(255,59,48,0.25)', color: t.colors.danger},
    pin: {fontSize: 12, color: t.colors.textMuted},
    title: {...t.typography.title, color: t.colors.text, flex: 1},
    subtitle: {...t.typography.bodyRegular, color: t.colors.textMuted, marginTop: 6},
    subtitleEmpty: {...t.typography.bodyRegular, color: t.colors.textFaint, marginTop: 6},
    time: {...t.typography.tiny, color: t.colors.textMuted},
    unreadBadge: {
      marginTop: 8,
      minWidth: 28,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadText: {...t.typography.tiny, color: t.colors.onPrimary},
    unreadSpacer: {height: 22, marginTop: 8},
    actionBtn: {
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnDisabled: {opacity: 0.5},
    actionBtnText: {...t.typography.tiny, color: t.colors.text},
    actionBtnSpacer: {height: 36, marginTop: 10},
    hintLine: {...t.typography.tiny, color: t.colors.textFaint, marginTop: 10},
    empty: {
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      alignItems: 'center',
    },
    emptyTitle: {...t.typography.title, color: t.colors.text, marginBottom: 6},
    emptyText: {...t.typography.bodyRegular, color: t.colors.textMuted, textAlign: 'center'},
  });
