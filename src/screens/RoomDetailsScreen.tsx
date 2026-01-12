import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import {i18n} from '../i18n';
import {Button} from '../ui/Button';
import {Input} from '../ui/Input';

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
      Alert.alert(
        i18n.t('roomDetails.alerts.errorTitle'),
        String(e?.message || e || i18n.t('roomDetails.errors.loadFailed')),
      );
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
        room?.title
          ? i18n.t('roomDetails.share.room', {title: room.title})
          : roomTitleParam
            ? i18n.t('roomDetails.share.room', {title: roomTitleParam})
            : undefined,
        roomId ? i18n.t('roomDetails.share.roomId', {roomId}) : undefined,
        room?.inviteCode
          ? i18n.t('roomDetails.share.inviteCode', {inviteCode: room.inviteCode})
          : undefined,
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
      Alert.alert(i18n.t('roomDetails.alerts.inviteSentTitle'), i18n.t('roomDetails.alerts.inviteSentBody'));
      setInviteUserId('');
    } catch (e: any) {
      Alert.alert(
        i18n.t('roomDetails.alerts.errorTitle'),
        String(e?.message || e || i18n.t('roomDetails.errors.inviteFailed')),
      );
    } finally {
      setLoading(false);
    }
  }, [api, roomId, inviteUserId]);

  const leave = useCallback(() => {
    Alert.alert(i18n.t('roomDetails.alerts.leaveTitle'), i18n.t('roomDetails.alerts.leaveBody'), [
      {text: i18n.t('roomDetails.alerts.leaveCancel'), style: 'cancel'},
      {
        text: i18n.t('roomDetails.alerts.leaveConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await api.leaveRoom({roomId});
          } catch (e: any) {
            Alert.alert(
              i18n.t('roomDetails.alerts.errorTitle'),
              String(e?.message || e || i18n.t('roomDetails.errors.leaveFailed')),
            );
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
        title={
          room?.title || roomTitleParam
            ? i18n.t('roomDetails.headerWithTitle', {title: room?.title || roomTitleParam})
            : i18n.t('roomDetails.header')
        }
        onBack={() => navigation.goBack()}
        right={
          room?.inviteCode ? (
            <Button
              title={i18n.t('roomDetails.actions.share')}
              onPress={shareInvite}
              variant="ghost"
              small
              style={styles.headerBtn}
            />
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>{i18n.t('roomDetails.labels.id')}</Text>
              <Text style={styles.value} numberOfLines={1}>
                {roomId}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>{i18n.t('roomDetails.labels.members')}</Text>
              <Text style={styles.value}>{room?.members?.length ?? 0}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>{i18n.t('roomDetails.labels.privacy')}</Text>
              <Text style={styles.value}>
                {room?.isPrivate ? i18n.t('roomDetails.privacy.private') : i18n.t('roomDetails.privacy.public')}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>
                {i18n.t('roomDetails.labels.persistent')}
              </Text>
              <Text style={styles.value}>
                {room?.isPersistent === undefined
                  ? i18n.t('common.dash')
                  : room.isPersistent
                    ? i18n.t('common.yes')
                    : i18n.t('common.no')}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>{i18n.t('roomDetails.labels.limit')}</Text>
              <Text style={styles.value}>
                {room?.maxParticipants ? String(room.maxParticipants) : i18n.t('common.dash')}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={[styles.label, styles.rowLabel]}>
                {i18n.t('roomDetails.labels.inviteCode')}
              </Text>
              <Text style={styles.value}>
                {room?.inviteCode ? String(room.inviteCode) : i18n.t('common.dash')}
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Button
              title={i18n.t('roomDetails.actions.members')}
              onPress={openMembers}
              style={[styles.actionItem, styles.actionButton]}
            />
            <Button
              title={i18n.t('roomDetails.actions.invite')}
              variant="ghost"
              onPress={openInvite}
              style={styles.actionButton}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{i18n.t('roomDetails.invite.title')}</Text>
            <Text style={styles.sectionHint}>{i18n.t('roomDetails.invite.hint')}</Text>

            <Input
              value={inviteUserId}
              onChangeText={setInviteUserId}
              placeholder={i18n.t('roomDetails.invite.placeholder')}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              containerStyle={styles.inputContainer}
            />

            <Button
              title={i18n.t('roomDetails.actions.sendInvite')}
              onPress={invite}
              disabled={!inviteUserId.trim() || loading}
              style={styles.primaryAction}
            />

            {!canManage ? (
              <Text style={styles.sectionNote}>
                {i18n.t('roomDetails.invite.note')}
              </Text>
            ) : null}
          </View>

          <Button
            title={i18n.t('roomDetails.actions.leave')}
            variant="danger"
            onPress={leave}
            style={styles.dangerAction}
          />

          <Button
            title={loading ? i18n.t('roomDetails.actions.refreshing') : i18n.t('roomDetails.actions.refresh')}
            variant="ghost"
            onPress={load}
            disabled={loading}
            style={styles.secondaryAction}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: t.colors.bg},
    pad: {padding: t.spacing.md, paddingBottom: t.spacing.xl},
    keyboard: {flex: 1},
    headerBtn: {
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radii.md,
    },

    card: {
      borderRadius: t.radii.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      padding: t.spacing.md,
      ...t.shadows.card,
      marginBottom: t.spacing.sm,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: t.spacing.sm,
    },
    label: {...t.typography.body, color: t.colors.textMuted},
    rowLabel: {marginRight: t.spacing.sm},
    value: {...t.typography.body, color: t.colors.text, flex: 1, textAlign: 'right'},

    actionsRow: {flexDirection: 'row', marginBottom: t.spacing.sm},
    actionItem: {marginRight: t.spacing.sm},
    actionButton: {flex: 1},

    sectionTitle: {...t.typography.title, color: t.colors.text},
    sectionHint: {
      ...t.typography.tiny,
      color: t.colors.textMuted,
      marginTop: t.spacing.xs,
      marginBottom: t.spacing.sm,
    },
    input: {
      ...t.typography.bodyRegular,
    },
    inputContainer: {
      marginBottom: t.spacing.sm,
    },
    sectionNote: {...t.typography.tiny, color: t.colors.textMuted, marginTop: t.spacing.sm},

    primaryAction: {marginTop: t.spacing.xs},
    dangerAction: {marginTop: t.spacing.xs},
    secondaryAction: {marginTop: t.spacing.sm},
  });
