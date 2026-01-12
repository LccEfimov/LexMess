import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Share} from 'react-native';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import {useLexmessApi} from '../hooks/useLexmessApi';
import type {Theme} from '../theme/themes';

type Props = {
  navigation: any;
  route: {params: {roomId: string; title?: string; inviteCode?: string | null}};
};

export const RoomInviteScreen: React.FC<Props> = ({navigation, route}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const api = useLexmessApi();
  const {roomId, title, inviteCode} = route.params || {};
  const [liveInviteCode, setLiveInviteCode] = useState<string | null>(inviteCode || null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!roomId) return;
        const room = await api.getRoom(roomId);
        const code = room?.invite_code || room?.inviteCode || null;
        if (!cancelled) {
          setLiveInviteCode(code ? String(code) : null);
        }
      } catch {}
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [api, roomId]);


  const handleRefresh = async () => {
    try {
      if (!roomId) return;
      const room = await api.getRoom(roomId);
      const code = room?.invite_code || room?.inviteCode || null;
      setLiveInviteCode(code ? String(code) : null);
    } catch (e) {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!liveInviteCode && !roomId) {
      return;
    }
    try {
      const messageLines = [
        title ? `Комната: ${title}` : undefined,
        roomId ? `ID комнаты: ${roomId}` : undefined,
        liveInviteCode ? `Инвайт-код: ${liveInviteCode}` : undefined,
      ].filter(Boolean);
      await Share.share({
        message: messageLines.join('\n'),
      });
    } catch (e) {
      // ничего страшного, просто не поделились
    }
  };
  const handleGoChat = () => {
    if (roomId) {
      navigation.replace('Chat', {roomId, roomTitle: title || roomId});
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Комната создана" onBack={() => navigation.goBack()} right={null} />

      <View style={styles.card}>
        <Text style={styles.label}>Комната</Text>
        <Text style={styles.value}>
          {title || roomId || 'Новая комната'}
        </Text>

        <Text style={[styles.label, {marginTop: 12}]}>ID комнаты</Text>
        <Text style={styles.value}>{roomId}</Text>

        <Text style={[styles.label, {marginTop: 12}]}>Инвайт-код</Text>
        {liveInviteCode ? (
          <Text style={styles.inviteValue}>{liveInviteCode}</Text>
        ) : (
          <Text style={styles.valueMuted}>
            Для этой комнаты код не установлен
          </Text>
        )}
      </View>

      {roomId && (
        <TouchableOpacity style={styles.tertiaryButton} onPress={handleRefresh}>
          <Text style={styles.tertiaryButtonText}>Обновить код</Text>
        </TouchableOpacity>
      )}

      {liveInviteCode && (
        <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
          <Text style={styles.secondaryButtonText}>Поделиться кодом</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={handleGoChat}>
        <Text style={styles.primaryButtonText}>Перейти в чат</Text>
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    fontSize: 18,
    color: t.colors.text,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
  },
  card: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: t.colors.card,
    padding: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  label: {
    fontSize: 12,
    color: t.colors.textMuted,
  },
  value: {
    fontSize: 15,
    color: t.colors.text,
    marginTop: 2,
  },
  inviteValue: {
    fontSize: 18,
    color: '#3bff9c',
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 1,
  },
  valueMuted: {
    fontSize: 13,
    color: t.colors.placeholder,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: t.colors.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: t.colors.text,
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.primary,
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: t.colors.primary,
    fontWeight: '500',
  },
});
