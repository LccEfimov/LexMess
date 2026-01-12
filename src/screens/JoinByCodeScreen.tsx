import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import {insertSystemMessage} from '../storage/sqliteStorage';
import type {Theme} from '../theme/themes';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';
import {i18n} from '../i18n';

type Props = {
  navigation: any;
  route: any;
};

export const JoinByCodeScreen: React.FC<Props> = ({navigation, route}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const api = useLexmessApi();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => code.trim().length >= 4 && !busy, [code, busy]);

  const handleJoin = async () => {
    const inviteCode = code.trim();
    if (!inviteCode) return;

    const userId: string | undefined = (route as any)?.params?.userId;
    if (!userId) {
      setError(i18n.t('joinByCode.missingUserId'));
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const res = await api.joinRoomByCode({userId, inviteCode});
      const roomId = res?.room_id || res?.roomId || res?.id;

      if (!roomId) {
        Alert.alert(i18n.t('joinByCode.errorTitle'), i18n.t('joinByCode.serverNoRoomId'));
        return;
      }

      try {
        await insertSystemMessage(roomId, i18n.t('joinByCode.systemMessage'));
      } catch (e) {
        // ignore
      }

      navigation.replace('Chat', {roomId, roomTitle: res?.title || res?.room_title || res?.roomTitle || roomId});
    } catch (e: any) {
      const msg = String(e?.message || e || i18n.t('joinByCode.error'));
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title={i18n.t('joinByCode.title')} onBack={() => navigation.goBack()} right={null} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <Card style={styles.card}>
          <Text style={[styles.label, styles.cardItem]}>{i18n.t('joinByCode.label')}</Text>
          <TextInput
            style={[styles.input, styles.cardItem]}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder={i18n.t('joinByCode.placeholder')}
            placeholderTextColor={t.colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
          />

          {error ? <Text style={[styles.errorText, styles.cardItem]}>{error}</Text> : null}

          <Button
            title={busy ? i18n.t('joinByCode.busy') : i18n.t('joinByCode.submit')}
            onPress={handleJoin}
            disabled={!canSubmit}
            style={styles.cardItem}
          />

          <Text style={styles.note}>
            {i18n.t('joinByCode.note')}
          </Text>
        </Card>
      </KeyboardAvoidingView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: t.colors.bg},
    keyboard: {flex: 1, justifyContent: 'center'},
    card: {
      marginHorizontal: t.spacing.md,
    },
    cardItem: {
      marginBottom: t.spacing.md,
    },
    label: {...t.typography.body, color: t.colors.textMuted},
    input: {
      marginTop: t.spacing.sm,
      borderRadius: t.radii.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElevated,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      color: t.colors.text,
      ...t.typography.bodyRegular,
    },
    errorText: {
      marginTop: t.spacing.md,
      color: t.colors.danger,
      ...t.typography.body,
    },
    note: {
      ...t.typography.tiny,
      color: t.colors.textMuted,
    },
  });
