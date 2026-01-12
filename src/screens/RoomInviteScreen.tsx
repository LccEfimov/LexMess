import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, StyleSheet, Share} from 'react-native';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import {useLexmessApi} from '../hooks/useLexmessApi';
import type {Theme} from '../theme/themes';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';

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

      <Card style={styles.card}>
        <Text style={styles.label}>Комната</Text>
        <Text style={styles.value}>
          {title || roomId || 'Новая комната'}
        </Text>

        <Text style={[styles.label, styles.labelSpacing]}>ID комнаты</Text>
        <Text style={styles.value}>{roomId}</Text>

        <Text style={[styles.label, styles.labelSpacing]}>Инвайт-код</Text>
        {liveInviteCode ? (
          <Text style={styles.inviteValue}>{liveInviteCode}</Text>
        ) : (
          <Text style={styles.valueMuted}>
            Для этой комнаты код не установлен
          </Text>
        )}
      </Card>

      {roomId && (
        <Button
          title="Обновить код"
          variant="ghost"
          style={styles.secondaryButton}
          onPress={handleRefresh}
        />
      )}

      {liveInviteCode && (
        <Button
          title="Поделиться кодом"
          variant="ghost"
          style={styles.secondaryButton}
          onPress={handleShare}
        />
      )}

      <Button title="Перейти в чат" style={styles.primaryButton} onPress={handleGoChat} />
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  card: {
    marginTop: t.spacing.md,
    gap: t.spacing.sm,
  },
  label: {
    fontSize: 12,
    color: t.colors.textMuted,
  },
  labelSpacing: {
    marginTop: t.spacing.md,
  },
  value: {
    fontSize: 15,
    color: t.colors.text,
    marginTop: 2,
  },
  inviteValue: {
    fontSize: 18,
    color: t.colors.success,
    marginTop: t.spacing.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  valueMuted: {
    fontSize: 13,
    color: t.colors.placeholder,
    marginTop: t.spacing.xs,
  },
  primaryButton: {
    marginTop: t.spacing.xl,
  },
  secondaryButton: {
    marginTop: t.spacing.lg,
  },
});
