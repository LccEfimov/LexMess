import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';

import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {useLexmessApi} from '../hooks/useLexmessApi';

type MemberRole = 'owner' | 'moderator' | 'member';

type MemberItem = {
  userId: string;
  role: MemberRole;
};

type Props = {
  route: {params: {roomId: string; roomTitle?: string; myUserId?: string}};
  navigation: any;
};

function normalizeRole(v: any): MemberRole {
  const s = String(v || '').toLowerCase();
  if (s === 'owner' || s === 'moderator' || s === 'member') return s as any;
  if (s === 'mod') return 'moderator';
  return 'member';
}

export const RoomMembersScreen: React.FC<Props> = ({route, navigation}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const api = useLexmessApi();

  const roomId = String(route?.params?.roomId || '');
  const roomTitle = route?.params?.roomTitle;
  const myUserId = String(route?.params?.myUserId || '');

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<MemberRole>('member');

  const canManage = myRole === 'owner';
  const canKick = myRole === 'owner' || myRole === 'moderator';

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const room = await api.getRoom(roomId);

      const ownerId = String(room?.owner_id || room?.ownerId || '');
      const rolesObj = room?.roles && typeof room.roles === 'object' ? room.roles : {};
      const membersArr = Array.isArray(room?.members) ? room.members : [];

      const code = room?.invite_code || room?.inviteCode || null;
      setInviteCode(code ? String(code) : null);

      let meRole: MemberRole = 'member';
      if (myUserId) {
        if (ownerId && myUserId === ownerId) meRole = 'owner';
        else if (rolesObj && rolesObj[myUserId]) meRole = normalizeRole(rolesObj[myUserId]);
      }
      setMyRole(meRole);

      const list: MemberItem[] = membersArr.map((id: any) => {
        const uid = String(id);
        let role: MemberRole = 'member';
        if (ownerId && uid === ownerId) role = 'owner';
        else if (rolesObj && rolesObj[uid]) role = normalizeRole(rolesObj[uid]);
        return {userId: uid, role};
      });

      // Keep stable order: owner first, then moderators, then members; then lexicographic
      list.sort((a, b) => {
        const w = (r: MemberRole) => (r === 'owner' ? 0 : r === 'moderator' ? 1 : 2);
        const wa = w(a.role);
        const wb = w(b.role);
        if (wa !== wb) return wa - wb;
        return a.userId.localeCompare(b.userId);
      });

      setMembers(list);
    } catch (e: any) {
      Alert.alert('Ошибка', String(e?.message || e || 'Не удалось загрузить участников'));
    } finally {
      setLoading(false);
    }
  }, [api, roomId, myUserId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const shareInvite = useCallback(async () => {
    try {
      const msgLines = [
        roomTitle ? `Комната: ${roomTitle}` : undefined,
        roomId ? `ID комнаты: ${roomId}` : undefined,
        inviteCode ? `Инвайт-код: ${inviteCode}` : undefined,
      ].filter(Boolean);
      await Share.share({message: msgLines.join('\n')});
    } catch {}
  }, [roomTitle, roomId, inviteCode]);

  const toggleModerator = useCallback(
    async (targetUserId: string, currentRole: MemberRole) => {
      if (!canManage) return;
      const nextRole: MemberRole = currentRole === 'moderator' ? 'member' : 'moderator';
      try {
        await api.setRoomMemberRole({roomId, targetUserId, role: nextRole});
        await load();
      } catch (e: any) {
        Alert.alert('Ошибка', String(e?.message || e || 'Не удалось изменить роль'));
      }
    },
    [api, roomId, canManage, load],
  );

  const kick = useCallback(
    async (targetUserId: string) => {
      if (!canKick) return;
      Alert.alert('Исключить', `Исключить пользователя ${targetUserId}?`, [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Исключить',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.kickRoomMember({roomId, targetUserId});
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', String(e?.message || e || 'Не удалось исключить'));
            }
          },
        },
      ]);
    },
    [api, roomId, canKick, load],
  );

  const leave = useCallback(async () => {
    Alert.alert('Покинуть комнату', 'Вы уверены?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Покинуть',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.leaveRoom({roomId});
          } catch (e: any) {
            Alert.alert('Ошибка', String(e?.message || e || 'Не удалось выйти'));
            return;
          }

          // try to return to Rooms tab
          try {
            const tabNav = navigation.getParent()?.getParent?.();
            if (tabNav && tabNav.navigate) {
              tabNav.navigate('Rooms');
              return;
            }
          } catch {}
          try {
            navigation.popToTop();
          } catch {}
        },
      },
    ]);
  }, [api, roomId, navigation]);

  return (
    <View style={styles.root}>
      <AppHeader
        title={roomTitle ? `Участники • ${roomTitle}` : 'Участники'}
        onBack={() => navigation.goBack()}
        right={
          inviteCode ? (
            <TouchableOpacity style={styles.headerBtn} onPress={shareInvite}>
              <Text style={styles.headerBtnText}>Поделиться</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>Комната: {roomId}</Text>
        <Text style={styles.summaryText}>
          Роль: {myRole === 'owner' ? 'Владелец' : myRole === 'moderator' ? 'Модератор' : 'Участник'}
        </Text>
        {inviteCode ? (
          <Text style={styles.summaryCode}>Инвайт-код: {inviteCode}</Text>
        ) : (
          <Text style={styles.summaryMuted}>Инвайт-код не установлен</Text>
        )}
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.userId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{padding: 14, paddingBottom: 26}}
        renderItem={({item}) => {
          const isOwner = item.role === 'owner';
          const isMod = item.role === 'moderator';
          const me = myUserId && item.userId === myUserId;

          const canToggle = canManage && !isOwner && !me;
          const canKickThis =
            canKick && !isOwner && !me && !(myRole === 'moderator' && isMod);

          return (
            <View style={styles.memberRow}>
              <View style={{flex: 1, minWidth: 0}}>
                <Text style={styles.memberId} numberOfLines={1}>
                  {item.userId}
                </Text>
                <Text style={styles.memberRole}>
                  {isOwner ? 'Владелец' : isMod ? 'Модератор' : 'Участник'}
                  {me ? ' • это вы' : ''}
                </Text>
              </View>

              <View style={styles.actionsCol}>
                {canToggle ? (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => toggleModerator(item.userId, item.role)}>
                    <Text style={styles.smallBtnText}>
                      {isMod ? 'Снять модера' : 'Сделать модером'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {canKickThis ? (
                  <TouchableOpacity
                    style={styles.smallBtnDanger}
                    onPress={() => kick(item.userId)}>
                    <Text style={styles.smallBtnDangerText}>Кик</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Нет данных</Text>
            <Text style={styles.emptyText}>Участники не загружены.</Text>
          </View>
        )}
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.leaveBtn} onPress={leave}>
          <Text style={styles.leaveBtnText}>Покинуть комнату</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: t.colors.bg},
    headerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
    },
    headerBtnText: {...t.typography.body, color: t.colors.text},

    summaryCard: {
      marginHorizontal: 14,
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      padding: 14,
      ...t.shadows.card,
    },
    summaryText: {...t.typography.bodyRegular, color: t.colors.textMuted},
    summaryCode: {...t.typography.body, color: t.colors.text, marginTop: 6},
    summaryMuted: {...t.typography.tiny, color: t.colors.textFaint, marginTop: 6},

    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      marginBottom: 12,
      ...t.shadows.card,
    },
    memberId: {...t.typography.body, color: t.colors.text},
    memberRole: {...t.typography.tiny, color: t.colors.textMuted, marginTop: 4},

    actionsCol: {alignItems: 'flex-end', justifyContent: 'center', gap: 8},
    smallBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      minWidth: 110,
      alignItems: 'center',
    },
    smallBtnText: {...t.typography.tiny, color: t.colors.text},

    smallBtnDanger: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.35)',
      backgroundColor: 'rgba(255,59,48,0.10)',
      minWidth: 110,
      alignItems: 'center',
    },
    smallBtnDangerText: {...t.typography.tiny, color: t.colors.danger},

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

    bottomBar: {
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.bg,
    },
    leaveBtn: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.35)',
      backgroundColor: 'rgba(255,59,48,0.10)',
      paddingVertical: 12,
      alignItems: 'center',
    },
    leaveBtnText: {...t.typography.body, color: t.colors.danger, fontWeight: '700'},
  });
