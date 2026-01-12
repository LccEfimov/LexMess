import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
} from 'react-native';

import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {useLexmessApi} from '../hooks/useLexmessApi';

type Props = {
  navigation: any;
  route: {params: {roomId: string; roomTitle?: string; myUserId?: string}};
};

type RoomInfo = {
  roomId: string;
  title: string;
  ownerId?: string | null;
  inviteCode?: string | null;
  members: string[];
  roles: Record<string, string>;
  isPrivate?: boolean;
  isPersistent?: boolean;
  maxParticipants?: number | null;
};

function normalizeRoom(roomId: string, data: any): RoomInfo {
  const title = String(data?.title || data?.room_title || data?.name || roomId);
  const ownerId = data?.owner_id || data?.ownerId || null;
  const inviteCode = data?.invite_code || data?.inviteCode || null;

  const members = Array.isArray(data?.members) ? data.members.map((x: any) => String(x)) : [];
  const roles =
    data?.roles && typeof data.roles === 'object' ? (data.roles as Record<string, string>) : {};

  return {
    roomId: String(data?.room_id || data?.roomId || data?.id || roomId),
    title,
    ownerId: ownerId ? String(ownerId) : null,
    inviteCode: inviteCode ? String(inviteCode) : null,
    members,
    roles,
    isPrivate: !!data?.is_private || !!data?.isPrivate,
    isPersistent: data?.is_persistent ?? data?.isPersistent,
    maxParticipants: data?.max_participants ?? data?.maxParticipants ?? null,
  };
}

export const RoomDetailsScreen: React.FC<Props> = ({navigation, route}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const api = useLexmessApi();

  const roomId = String(route?.params?.roomId || '');
  const roomTitleParam = route?.params?.roomTitle;
  const myUserId = String(route?.params?.myUserId || '');

  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const data = await api.getRoom(roomId);
      setRoom(normalizeRoom(roomId, data));
    } catch (e: any) {
      Alert.alert('Ошибка', String(e?.message || e || 'Не удалось загрузить комнату'));
    } finally {
      setLoading(false);
    }
  }, [api, roomId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const canManage = useMemo(() => {
    if (!room) return false;
    if (room.ownerId && myUserId && room.ownerId === myUserId) return true;
    const role = String(room.roles?.[myUserId] || '').toLowerCase();
    return role === 'owner';
  }, [room, myUserId]);

  const shareInvite = useCallback(async () => {
    try {
      const msg = [
        room?.title ? `Комната: ${room.title}` : roomTitleParam ? `Комната: ${roomTitleParam}` : undefined,
        roomId ? `ID комнаты: ${roomId}` : undefined,
        room?.inviteCode ? `Инвайт-код: ${room.inviteCode}` : undefined,
      ]
        .filter(Boolean)
        .join('\n');
      await Share.share({message: msg});
    } catch {}
  }, [room, roomId, roomTitleParam]);

  const invite = useCallback(async () => {
    const peerUserId = inviteUserId.trim();
    if (!peerUserId) return;

    try {
      setLoading(true);
      await api.inviteToRoom({roomId, peerUserId});
      Alert.alert('Готово', 'Инвайт отправлен.');
      setInviteUserId('');
    } catch (e: any) {
      Alert.alert('Ошибка', String(e?.message || e || 'Не удалось отправить инвайт'));
    } finally {
      setLoading(false);
    }
  }, [api, roomId, inviteUserId]);

  const leave = useCallback(() => {
    Alert.alert('Покинуть комнату', 'Вы уверены?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Покинуть',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await api.leaveRoom({roomId});
          } catch (e: any) {
            Alert.alert('Ошибка', String(e?.message || e || 'Не удалось выйти'));
            setLoading(false);
            return;
          }

          try {
            navigation.getParent()?.navigate?.('Rooms');
          } catch {}
          try {
            navigation.popToTop();
          } catch {}
          setLoading(false);
        },
      },
    ]);
  }, [api, navigation, roomId]);

  const openMembers = useCallback(() => {
    navigation.navigate('RoomMembers', {
      roomId,
      roomTitle: room?.title || roomTitleParam || roomId,
      myUserId,
    });
  }, [navigation, roomId, room, roomTitleParam, myUserId]);

  const openInvite = useCallback(() => {
    navigation.navigate('RoomInvite', {
      roomId,
      title: room?.title || roomTitleParam || roomId,
      inviteCode: room?.inviteCode || null,
    });
  }, [navigation, roomId, room, roomTitleParam]);

  return (
    <View style={styles.root}>
      <AppHeader
        title={room?.title ? `Комната • ${room.title}` : 'Комната'}
        onBack={() => navigation.goBack()}
        right={
          room?.inviteCode ? (
            <TouchableOpacity style={styles.headerBtn} onPress={shareInvite}>
              <Text style={styles.headerBtnText}>Поделиться</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>ID</Text>
              <Text style={styles.value} numberOfLines={1}>
                {roomId}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>Участники</Text>
              <Text style={styles.value}>{room?.members?.length ?? 0}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>Приватность</Text>
              <Text style={styles.value}>{room?.isPrivate ? 'Приватная' : 'Публичная'}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>Постоянная</Text>
              <Text style={styles.value}>
                {room?.isPersistent === undefined ? '—' : room.isPersistent ? 'Да' : 'Нет'}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>Лимит</Text>
              <Text style={styles.value}>{room?.maxParticipants ? String(room.maxParticipants) : '—'}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>Инвайт-код</Text>
              <Text style={styles.value}>{room?.inviteCode ? String(room.inviteCode) : '—'}</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.primaryBtn, styles.actionItem]} onPress={openMembers}>
              <Text style={styles.primaryBtnText}>Участники</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={openInvite}>
              <Text style={styles.ghostBtnText}>Инвайт</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Пригласить пользователя</Text>
            <Text style={styles.sectionHint}>
              Укажите User ID получателя. Сервер отправит инвайт (API: /v1/room/invite).
            </Text>

            <TextInput
              style={styles.input}
              value={inviteUserId}
              onChangeText={setInviteUserId}
              placeholder="User ID"
              placeholderTextColor={t.colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, (!inviteUserId.trim() || loading) ? styles.btnDisabled : null]}
              disabled={!inviteUserId.trim() || loading}
              onPress={invite}>
              {loading ? (
                <ActivityIndicator color={t.colors.onPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>Отправить</Text>
              )}
            </TouchableOpacity>

            {!canManage ? (
              <Text style={styles.sectionNote}>
                Примечание: управление ролями/кики доступно на экране участников (если у вас есть права).
              </Text>
            ) : null}
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={leave}>
            <Text style={styles.dangerBtnText}>Покинуть комнату</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtnWide} onPress={load} disabled={loading}>
            <Text style={styles.ghostBtnText}>{loading ? 'Обновление...' : 'Обновить данные'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: t.colors.bg},
    pad: {padding: 14, paddingBottom: 26},
    keyboard: {flex: 1},
    headerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
    },
    headerBtnText: {...t.typography.body, color: t.colors.text},

    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      padding: 14,
      ...t.shadows.card,
      marginBottom: 12,
    },
    rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10},
    label: {...t.typography.body, color: t.colors.textMuted},
    rowLabel: {marginRight: 10},
    value: {...t.typography.body, color: t.colors.text, flex: 1, textAlign: 'right'},

    actionsRow: {flexDirection: 'row', marginBottom: 12},
    actionItem: {marginRight: 10},
    primaryBtn: {
      flex: 1,
      borderRadius: 14,
      backgroundColor: t.colors.primary,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {...t.typography.body, color: t.colors.onPrimary, fontWeight: '700'},
    ghostBtn: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnWide: {
      marginTop: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnText: {...t.typography.body, color: t.colors.text},

    sectionTitle: {...t.typography.title, color: t.colors.text},
    sectionHint: {...t.typography.tiny, color: t.colors.textMuted, marginTop: 6, marginBottom: 10},
    input: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.colors.text,
      ...t.typography.bodyRegular,
      marginBottom: 12,
    },
    sectionNote: {...t.typography.tiny, color: t.colors.textMuted, marginTop: 8},

    dangerBtn: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.dangerBorderStrong,
      backgroundColor: t.colors.dangerBg,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    dangerBtnText: {...t.typography.body, color: t.colors.danger, fontWeight: '700'},
    btnDisabled: {opacity: 0.6},
  });
