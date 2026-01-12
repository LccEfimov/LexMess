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

import {useTranslation} from 'react-i18next';
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
  const theme = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
      Alert.alert(t('common.error'), String(e?.message || e || t('roomDetails.loadError')));
    } finally {
      setLoading(false);
    }
  }, [api, roomId, t]);

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
          ? t('roomDetails.shareRoomTitle', {title: room.title})
          : roomTitleParam
          ? t('roomDetails.shareRoomTitle', {title: roomTitleParam})
          : undefined,
        roomId ? t('roomDetails.shareRoomId', {roomId}) : undefined,
        room?.inviteCode ? t('roomDetails.shareInviteCode', {code: room.inviteCode}) : undefined,
      ]
        .filter(Boolean)
        .join('\n');
      await Share.share({message: msg});
    } catch {}
  }, [room, roomId, roomTitleParam, t]);

  const invite = useCallback(async () => {
    const peerUserId = inviteUserId.trim();
    if (!peerUserId) return;

    try {
      setLoading(true);
      await api.inviteToRoom({roomId, peerUserId});
      Alert.alert(t('common.done'), t('roomDetails.inviteSuccessMessage'));
      setInviteUserId('');
    } catch (e: any) {
      Alert.alert(t('common.error'), String(e?.message || e || t('roomDetails.inviteError')));
    } finally {
      setLoading(false);
    }
  }, [api, roomId, inviteUserId, t]);

  const leave = useCallback(() => {
    Alert.alert(t('roomDetails.leaveTitle'), t('roomDetails.leaveMessage'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('roomDetails.leaveButton'),
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await api.leaveRoom({roomId});
          } catch (e: any) {
            Alert.alert(t('common.error'), String(e?.message || e || t('roomDetails.leaveError')));
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
  }, [api, navigation, roomId, t]);

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
        title={room?.title ? t('roomDetails.titleWithName', {title: room.title}) : t('roomDetails.title')}
        onBack={() => navigation.goBack()}
        right={
          room?.inviteCode ? (
            <TouchableOpacity style={styles.headerBtn} onPress={shareInvite}>
              <Text style={styles.headerBtnText}>{t('roomDetails.shareButton')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('roomDetails.labelId')}</Text>
              <Text style={styles.value} numberOfLines={1}>
                {roomId}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('roomDetails.labelMembers')}</Text>
              <Text style={styles.value}>{room?.members?.length ?? 0}</Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('roomDetails.labelPrivacy')}</Text>
              <Text style={styles.value}>
                {room?.isPrivate ? t('roomDetails.privacyPrivate') : t('roomDetails.privacyPublic')}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('roomDetails.labelPersistent')}</Text>
              <Text style={styles.value}>
                {room?.isPersistent === undefined
                  ? t('common.dash')
                  : room.isPersistent
                  ? t('common.yes')
                  : t('common.no')}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('roomDetails.labelLimit')}</Text>
              <Text style={styles.value}>
                {room?.maxParticipants ? String(room.maxParticipants) : t('common.dash')}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('roomDetails.labelInviteCode')}</Text>
              <Text style={styles.value}>
                {room?.inviteCode ? String(room.inviteCode) : t('common.dash')}
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={openMembers}>
              <Text style={styles.primaryBtnText}>{t('roomDetails.buttonMembers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={openInvite}>
              <Text style={styles.ghostBtnText}>{t('roomDetails.buttonInvite')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('roomDetails.sectionInviteTitle')}</Text>
            <Text style={styles.sectionHint}>
              {t('roomDetails.sectionInviteHint')}
            </Text>

            <TextInput
              style={styles.input}
              value={inviteUserId}
              onChangeText={setInviteUserId}
              placeholder={t('roomDetails.placeholderUserId')}
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, (!inviteUserId.trim() || loading) ? styles.btnDisabled : null]}
              disabled={!inviteUserId.trim() || loading}
              onPress={invite}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{t('roomDetails.sendButton')}</Text>
              )}
            </TouchableOpacity>

            {!canManage ? (
              <Text style={styles.sectionNote}>
                {t('roomDetails.sectionNote')}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={leave}>
            <Text style={styles.dangerBtnText}>{t('roomDetails.leaveButton')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtnWide} onPress={load} disabled={loading}>
            <Text style={styles.ghostBtnText}>
              {loading ? t('roomDetails.refreshLoading') : t('roomDetails.refresh')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: theme.colors.bg},
    pad: {padding: 14, paddingBottom: 26},
    headerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgElevated,
    },
    headerBtnText: {...theme.typography.body, color: theme.colors.text},

    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 14,
      ...theme.shadows.card,
      marginBottom: 12,
    },
    rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10},
    label: {...theme.typography.body, color: theme.colors.textMuted},
    value: {...theme.typography.body, color: theme.colors.text, flex: 1, textAlign: 'right'},

    actionsRow: {flexDirection: 'row', gap: 10, marginBottom: 12},
    primaryBtn: {
      flex: 1,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {...theme.typography.body, color: '#fff', fontWeight: '700'},
    ghostBtn: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgElevated,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnWide: {
      marginTop: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgElevated,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnText: {...theme.typography.body, color: theme.colors.text},

    sectionTitle: {...theme.typography.title, color: theme.colors.text},
    sectionHint: {...theme.typography.tiny, color: theme.colors.textMuted, marginTop: 6, marginBottom: 10},
    input: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bgElevated,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.text,
      ...theme.typography.bodyRegular,
      marginBottom: 12,
    },
    sectionNote: {...theme.typography.tiny, color: theme.colors.textMuted, marginTop: 8},

    dangerBtn: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.35)',
      backgroundColor: 'rgba(255,59,48,0.10)',
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    dangerBtnText: {...theme.typography.body, color: theme.colors.danger, fontWeight: '700'},
    btnDisabled: {opacity: 0.6},
  });
