import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import {insertSystemMessage} from '../storage/sqliteStorage';
import type {Theme} from '../theme/themes';
import {useLexmessApi} from '../hooks/useLexmessApi';

type Props = {
  navigation: any;
  route: any;
};

function clampInt(v: number, min: number, max: number): number {
  const n = Number.isFinite(v) ? Math.trunc(v) : min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export const CreateRoomScreen: React.FC<Props> = ({navigation, route}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const api = useLexmessApi();

  const ownerId: string | undefined = route?.params?.ownerId;

  const [title, setTitle] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPersistent, setIsPersistent] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState('25');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const max = parseInt(maxParticipants || '0', 10);
    return !!ownerId && !busy && (Number.isFinite(max) ? max >= 2 : false);
  }, [ownerId, busy, maxParticipants]);

  const handleCreate = async () => {
    if (!ownerId) {
      setError('Нужен ownerId. Выполните вход заново.');
      return;
    }

    const rawTitle = title.trim();
    const titleFinal = rawTitle.length > 0 ? rawTitle : `Комната ${new Date().toLocaleDateString('ru-RU')}`;

    const max = clampInt(parseInt(maxParticipants || '25', 10) || 25, 2, 500);

    const roomId = `room-${Date.now()}`;
    const code = inviteCode.trim();

    try {
      setBusy(true);
      setError(null);

      const room = await api.createRoom({
        roomId,
        title: titleFinal,
        maxParticipants: max,
        isPersistent,
        isPrivate,
        inviteCode: code.length > 0 ? code : undefined,
        ownerId,
        // defaults, do not expose algorithm/format details in UI
        styleId: 'default',
        settings: {},
        features: {},
      });

      const createdRoomId =
        room?.room_id || room?.roomId || room?.id || roomId;
      const createdTitle = room?.title || titleFinal;
      const createdInvite =
        room?.invite_code || room?.inviteCode || (code.length > 0 ? code : null);

      // If server did not return room id — stop here
      if (!createdRoomId) {
        Alert.alert('Ошибка', 'Сервер не вернул идентификатор комнаты.');
        return;
      }

      try {
        await insertSystemMessage(createdRoomId, 'Комната создана');
      } catch (e) {
        // ignore
      }

      navigation.replace('RoomInvite', {
        roomId: createdRoomId,
        title: createdTitle,
        inviteCode: createdInvite,
      });
    } catch (e: any) {
      const msg = String(e?.message || e || 'Не удалось создать комнату');
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Создать комнату" onBack={() => navigation.goBack()} right={null} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={styles.scrollPad}
          keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Название</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Например: Общение"
              placeholderTextColor={t.colors.placeholder}
              autoCapitalize="sentences"
              maxLength={64}
            />

            <Text style={[styles.label, styles.labelSpacing]}>Инвайт-код (необязательно)</Text>
            <TextInput
              style={styles.input}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Например: EIN-1234"
              placeholderTextColor={t.colors.placeholder}
              autoCapitalize="characters"
              maxLength={32}
            />

            <Text style={[styles.label, styles.labelSpacing]}>Максимум участников</Text>
            <TextInput
              style={styles.input}
              value={maxParticipants}
              onChangeText={(v) => setMaxParticipants(v.replace(/[^0-9]/g, ''))}
              placeholder="25"
              placeholderTextColor={t.colors.placeholder}
              keyboardType="number-pad"
              maxLength={3}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Приватная комната</Text>
                <Text style={styles.switchHint}>
                  Приватные комнаты не отображаются в публичном списке.
                </Text>
              </View>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Постоянная</Text>
                <Text style={styles.switchHint}>
                  Комната сохраняет настройки и участников.
                </Text>
              </View>
              <Switch value={isPersistent} onValueChange={setIsPersistent} />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              disabled={!canSubmit}
              style={[styles.primaryButton, !canSubmit ? styles.primaryButtonDisabled : null]}
              onPress={handleCreate}>
              {busy ? (
                <ActivityIndicator color={t.colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Создать</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              После создания откроется экран с кодом приглашения.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: t.colors.bg},
    scrollPad: {padding: t.spacing.md, paddingBottom: t.spacing.xl},
    keyboard: {flex: 1},
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      padding: t.spacing.md,
      ...t.shadows.card,
    },
    label: {...t.typography.body, color: t.colors.textMuted},
    labelSpacing: {marginTop: t.spacing.md},
    input: {
      marginTop: t.spacing.sm,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      color: t.colors.text,
      ...t.typography.bodyRegular,
    },
    switchRow: {
      marginTop: t.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
    },
    switchTextWrap: {flex: 1},
    switchTitle: {...t.typography.body, color: t.colors.text},
    switchHint: {...t.typography.tiny, color: t.colors.textMuted, marginTop: t.spacing.xs},
    errorText: {
      marginTop: t.spacing.md,
      color: t.colors.danger,
      ...t.typography.body,
    },
    primaryButton: {
      marginTop: t.spacing.lg,
      borderRadius: 14,
      backgroundColor: t.colors.primary,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: {opacity: 0.6},
    primaryButtonText: {
      ...t.typography.body,
      fontWeight: '700',
      color: t.colors.onPrimary,
    },
    note: {
      marginTop: t.spacing.sm,
      ...t.typography.tiny,
      color: t.colors.textMuted,
    },
  });
