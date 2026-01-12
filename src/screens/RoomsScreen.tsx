import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import {EmptyState} from '../components/EmptyState';
import {Loader} from '../components/Loader';

import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';

export type RoomItem = {
  id: string;
  title: string;
  type: 'public' | 'my' | 'open';
  members: number;
  online?: number;
  isPrivate?: boolean;
  isPersistent?: boolean;
  lastMessage?: string | null;
  lastMessageTs?: number | null;
  unreadCount?: number | null;
  role?: 'owner' | 'moderator' | 'member';
};

type Props = {
  publicRooms: RoomItem[];
  myRooms: RoomItem[];
  openRooms: RoomItem[];

  onOpenRoom: (roomId: string, roomTitle?: string) => void;

  onShowMorePublic: () => void;
  onShowMoreMy: () => void;
  onShowMoreOpen: () => void;

  onSettings: () => void;
  onCreateRoom: () => void;
  onJoinByCode: () => void;

  refreshing: boolean;
  onRefresh: () => void;

  mute: boolean;
  onToggleMute: () => void;
  onExitApp: () => void;

  // room actions via API
  onJoinRoom?: (roomId: string) => Promise<void>;
  onLeaveRoom?: (roomId: string) => Promise<void>;
  busyByRoom?: Record<string, boolean>;
};

type TabKey = 'my' | 'open' | 'public';

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

export const RoomsScreen: React.FC<Props> = (props) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [tab, setTab] = useState<TabKey>('my');
  const [search, setSearch] = useState('');

  const normalized = useMemo(() => search.trim().toLowerCase(), [search]);

  const currentList = useMemo(() => {
    const list =
      tab === 'my' ? props.myRooms : tab === 'open' ? props.openRooms : props.publicRooms;
    const safe = Array.isArray(list) ? list : [];
    if (!normalized) return safe;

    return safe.filter(r => {
      const title = String(r.title || '').toLowerCase();
      const id = String(r.id || '').toLowerCase();
      const last = String(r.lastMessage || '').toLowerCase();
      return title.includes(normalized) || id.includes(normalized) || last.includes(normalized);
    });
  }, [tab, props.myRooms, props.openRooms, props.publicRooms, normalized]);

  const sorted = useMemo(() => {
    const arr = [...currentList];
    arr.sort((a, b) => {
      const ua = Number(a.unreadCount || 0);
      const ub = Number(b.unreadCount || 0);
      if (ub !== ua) return ub - ua;

      const ta = Number(a.lastMessageTs || 0);
      const tb = Number(b.lastMessageTs || 0);
      if (tb !== ta) return tb - ta;

      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    return arr;
  }, [currentList]);

  const onShowAll = useCallback(() => {
    if (tab === 'my') props.onShowMoreMy();
    else if (tab === 'open') props.onShowMoreOpen();
    else props.onShowMorePublic();
  }, [tab, props]);

  const headerRight = useMemo(() => {
    return (
      <View style={styles.headerRight}>
        <Pressable style={[styles.headerBtn, styles.headerBtnSpacing]} onPress={props.onToggleMute}>
          <Text style={styles.headerBtnText}>{props.mute ? 'Без звука' : 'Со звуком'}</Text>
        </Pressable>
        <Pressable style={[styles.headerBtn, styles.headerBtnSpacing]} onPress={props.onSettings}>
          <Text style={styles.headerBtnText}>Настройки</Text>
        </Pressable>
        <Pressable
          style={[styles.headerBtn, styles.headerBtnDanger]}
          onPress={() => {
            Alert.alert('Выход', 'Выйти из приложения?', [
              {text: 'Отмена', style: 'cancel'},
              {text: 'Выйти', style: 'destructive', onPress: props.onExitApp},
            ]);
          }}>
          <Text style={[styles.headerBtnText, styles.headerBtnDangerText]}>Выйти</Text>
        </Pressable>
      </View>
    );
  }, [styles, props.onSettings, props.onExitApp, props.onToggleMute, props.mute]);

  const clearSearch = useCallback(() => setSearch(''), []);

  const renderTabs = useMemo(() => {
    const tabBtn = (key: TabKey, label: string, count: number, isLast: boolean) => {
      const active = tab === key;
      return (
        <Pressable
          key={key}
          style={[styles.tabBtn, !isLast ? styles.tabBtnSpacing : null, active ? styles.tabBtnActive : null]}
          onPress={() => setTab(key)}>
          <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
          <View style={[styles.tabCount, active ? styles.tabCountActive : null]}>
            <Text style={[styles.tabCountText, active ? styles.tabCountTextActive : null]}>
              {count > 999 ? '999+' : String(count)}
            </Text>
          </View>
        </Pressable>
      );
    };

    return (
      <View style={styles.tabs}>
        {tabBtn('my', 'Мои', (props.myRooms || []).length, false)}
        {tabBtn('open', 'Участник', (props.openRooms || []).length, false)}
        {tabBtn('public', 'Публичные', (props.publicRooms || []).length, true)}
      </View>
    );
  }, [styles, tab, props.myRooms, props.openRooms, props.publicRooms]);

  const renderActions = useMemo(() => {
    return (
      <View style={styles.actionsRow}>
        <Pressable style={[styles.actionBtn, styles.actionBtnSpacing]} onPress={props.onCreateRoom}>
          <Text style={styles.actionBtnText}>Создать комнату</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionBtnSpacing]} onPress={props.onJoinByCode}>
          <Text style={styles.actionBtnText}>Войти по коду</Text>
        </Pressable>
        <Pressable style={styles.actionBtnGhost} onPress={onShowAll}>
          <Text style={styles.actionBtnGhostText}>Показать все</Text>
        </Pressable>
      </View>
    );
  }, [styles, props.onCreateRoom, props.onJoinByCode, onShowAll]);

  const onJoin = useCallback(
    async (roomId: string) => {
      if (!props.onJoinRoom) return;
      try {
        await props.onJoinRoom(roomId);
      } catch (e: any) {
        Alert.alert('Ошибка', String(e?.message || e || 'Не удалось войти'));
      }
    },
    [props.onJoinRoom],
  );

  const onLeave = useCallback(
    async (roomId: string) => {
      if (!props.onLeaveRoom) return;
      Alert.alert('Выход из комнаты', 'Покинуть комнату?', [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Покинуть',
          style: 'destructive',
          onPress: async () => {
            try {
              await props.onLeaveRoom?.(roomId);
            } catch (e: any) {
              Alert.alert('Ошибка', String(e?.message || e || 'Не удалось выйти'));
            }
          },
        },
      ]);
    },
    [props.onLeaveRoom],
  );

  return (
    <View style={styles.root}>
      <AppHeader title="Комнаты" onBack={null} right={headerRight} />

      {renderTabs}

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск"
          placeholderTextColor={t.colors.placeholder}
        />
        {search ? (
          <Pressable style={styles.searchClear} onPress={clearSearch}>
            <Text style={styles.searchClearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {renderActions}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPad}
        refreshControl={
          <RefreshControl refreshing={!!props.refreshing} onRefresh={props.onRefresh} />
        }
        renderItem={({item}) => {
          const busy = !!(props.busyByRoom || {})[item.id];
          const unread = Number(item.unreadCount || 0);
          const ts = formatTs(item.lastMessageTs);

          const badge =
            item.type === 'my'
              ? 'МОЯ'
              : item.type === 'open'
              ? 'УЧАСТНИК'
              : item.isPrivate
              ? 'ПРИВАТ'
              : 'ПУБЛ';

          const canJoin = item.type === 'public' && !!props.onJoinRoom;
          const canLeave = item.type === 'open' && !!props.onLeaveRoom;
          const hasActionsBelow = canJoin || canLeave;

          return (
            <Pressable
              style={({pressed}) => [styles.card, pressed ? styles.cardPressed : null]}
              onPress={() => props.onOpenRoom(item.id, item.title)}>
              <View style={styles.cardTop}>
                <View style={[styles.cardLeft, styles.cardTopItem]}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.badge,
                        styles.titleRowItem,
                        item.isPrivate ? styles.badgePrivate : styles.badgePublic,
                      ]}>
                      {badge}
                    </Text>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title || item.id}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {Number(item.members || 0)} участн.
                      {typeof item.online === 'number' ? ` • онлайн ${item.online}` : ''}
                    </Text>
                    {ts ? <Text style={styles.metaTime}>{ts}</Text> : null}
                  </View>

                  {item.lastMessage ? (
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {item.lastMessage}
                    </Text>
                  ) : (
                    <Text style={styles.lastMessageEmpty} numberOfLines={1}>
                      Нет сообщений
                    </Text>
                  )}
                </View>

                <View style={styles.cardRight}>
                  {unread > 0 ? (
                    <View style={[styles.unreadBadge, hasActionsBelow ? styles.cardRightItem : null]}>
                      <Text style={styles.unreadText}>{unread > 99 ? '99+' : String(unread)}</Text>
                    </View>
                  ) : (
                    <View style={[styles.unreadSpacer, hasActionsBelow ? styles.cardRightItem : null]} />
                  )}

                  {canJoin ? (
                    <Pressable
                      style={[
                        styles.smallBtn,
                        busy ? styles.smallBtnDisabled : null,
                        canLeave ? styles.cardRightItem : null,
                      ]}
                      onPress={() => onJoin(item.id)}
                      disabled={busy}>
                      <Text style={styles.smallBtnText}>{busy ? '...' : 'Войти'}</Text>
                    </Pressable>
                  ) : null}

                  {canLeave ? (
                    <Pressable
                      style={[styles.smallBtnGhost, busy ? styles.smallBtnDisabled : null]}
                      onPress={() => onLeave(item.id)}
                      disabled={busy}>
                      <Text style={styles.smallBtnGhostText}>{busy ? '...' : 'Выйти'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Пусто</Text>
            <Text style={styles.emptyText}>Нет комнат по вашему фильтру.</Text>
          </View>
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
    headerBtnDanger: {borderColor: 'rgba(255,59,48,0.35)'},
    headerBtnText: {...t.typography.body, color: t.colors.text},
    headerBtnDangerText: {color: t.colors.danger},

    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 6,
    },
    tabBtnSpacing: {marginRight: 10},
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
    },
    tabBtnActive: {borderColor: t.colors.primary},
    tabText: {...t.typography.body, color: t.colors.textMuted},
    tabTextActive: {color: t.colors.text},
    tabCount: {
      minWidth: 30,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabCountActive: {borderColor: t.colors.primary, backgroundColor: t.colors.primary},
    tabCountText: {...t.typography.tiny, color: t.colors.textMuted},
    tabCountTextActive: {color: t.colors.onPrimary},

    searchWrap: {
      marginHorizontal: 14,
      marginTop: 10,
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

    actionsRow: {flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10},
    actionBtnSpacing: {marginRight: 10},
    actionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnText: {...t.typography.body, color: t.colors.onPrimary},
    actionBtnGhost: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnGhostText: {...t.typography.body, color: t.colors.text},

    listPad: {padding: 14, paddingTop: 12, paddingBottom: 28},

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
    cardTop: {flexDirection: 'row', alignItems: 'flex-start'},
    cardTopItem: {marginRight: 12},
    cardLeft: {flex: 1, minWidth: 0},
    cardRight: {alignItems: 'flex-end', justifyContent: 'flex-start', minWidth: 84},

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
    title: {...t.typography.title, color: t.colors.text, flex: 1},

    metaRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6},
    metaText: {...t.typography.tiny, color: t.colors.textMuted},
    metaTime: {...t.typography.tiny, color: t.colors.textMuted},

    lastMessage: {...t.typography.bodyRegular, color: t.colors.textMuted, marginTop: 8},
    lastMessageEmpty: {...t.typography.bodyRegular, color: t.colors.textFaint, marginTop: 8},

    unreadBadge: {
      minWidth: 28,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadText: {...t.typography.tiny, color: t.colors.onPrimary},
    unreadSpacer: {height: 22},
    cardRightItem: {marginBottom: 10},

    smallBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 78,
    },
    smallBtnText: {...t.typography.body, color: t.colors.onPrimary},
    smallBtnGhost: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 78,
    },
    smallBtnGhostText: {...t.typography.body, color: t.colors.text},
    smallBtnDisabled: {opacity: 0.6},

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
