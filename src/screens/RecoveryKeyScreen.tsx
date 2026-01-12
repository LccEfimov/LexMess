import React, {useEffect, useMemo, useState} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {
  BackHandler,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {markRecoveryShown, saveLocalAccount} from '../storage/localAccountStorage';
import {
  clearPendingRecovery,
  loadPendingRecovery,
  type PendingRecovery,
} from '../storage/pendingRecoveryStorage';

interface Props {
  navigation: any;
  route: any;
  onDone: (login: string) => void;
}

function normalizeKey(s: string): string {
  return (s || '').trim().replace(/\s+/g, ' ');
}

export const RecoveryKeyScreen: React.FC<Props> = ({route, onDone}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const api = useLexmessApi();

  const routeLogin = useMemo(() => {
    const v = route?.params?.login;
    return typeof v === 'string' ? v : '';
  }, [route?.params?.login]);

  const routeRecoveryKey = useMemo(() => {
    const v = route?.params?.recoveryKey;
    return typeof v === 'string' ? v : '';
  }, [route?.params?.recoveryKey]);

  const routeWallet = useMemo(() => {
    const v = route?.params?.walletAddress;
    return typeof v === 'string' ? v : null;
  }, [route?.params?.walletAddress]);

  const [pending, setPending] = useState<PendingRecovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await loadPendingRecovery();
        if (!cancelled) {
          setPending(p);
        }
      } catch (e) {
        if (!cancelled) {
          setPending(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Не даём случайно уйти назад, пока ключ не подтверждён.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      try {
        sub.remove();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const login = routeLogin || pending?.login || '';
  const recoveryKey = normalizeKey(routeRecoveryKey || pending?.recoveryKey || '');
  const walletAddress = routeWallet || pending?.walletAddress || null;

  const confirmSaved = async () => {
    if (!login) {
      setError('Не удалось определить логин');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      try {
        await api.authRecoveryAck();
      } catch (e) {
        // сервер может быть недоступен, но локально всё равно фиксируем
      }

      try {
        await markRecoveryShown();
      } catch (e) {
        // ignore
      }

      // на всякий случай обновим wallet/display_name в local_account
      try {
        await saveLocalAccount({
          login,
          walletAddress: walletAddress || null,
          recoveryShown: true,
        });
      } catch (e) {
        // ignore
      }

      try {
        await clearPendingRecovery();
      } catch (e) {
        // ignore
      }

      onDone(login);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ключ восстановления</Text>
        <Text style={styles.subtitle}>
          Сохраните его. Он показывается один раз. {'\n'}
          Лучше переписать на бумагу и хранить отдельно.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.infoLine}>
            Логин: <Text style={styles.mono}>{login || '—'}</Text>
          </Text>

          {walletAddress ? (
            <Text style={[styles.infoLine, styles.infoLineSpacing]}>
              Адрес кошелька: <Text style={styles.mono}>{walletAddress}</Text>
            </Text>
          ) : null}

          <View style={styles.keyFrame}>
            <Text style={styles.keyHint}>Нажмите и удерживайте, чтобы выделить и скопировать</Text>
            <Text selectable style={styles.keyText}>
              {recoveryKey || '—'}
            </Text>
          </View>

          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Важно</Text>
            <Text style={styles.warnText}>
              • Потеряете ключ — потеряете доступ к аккаунту/кошельку.{"\n"}
              • Не отправляйте ключ в чаты и не храните в галерее скриншотами.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={busy || !login}
            style={({pressed}) => [
              styles.btn,
              (pressed || busy) && styles.btnPressed,
              (!login || busy) && styles.btnDisabled,
            ]}
            onPress={confirmSaved}>
            {busy ? <ActivityIndicator color={t.colors.onPrimary} /> : <Text style={styles.btnText}>Я сохранил</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.xl * 2,
  },
  header: {
    marginBottom: t.spacing.lg,
  },
  title: {
    ...t.typography.title,
    fontSize: 26,
    fontWeight: '900',
    color: t.colors.text,
  },
  subtitle: {
    marginTop: t.spacing.sm,
    ...t.typography.caption,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radii.lg,
    padding: t.spacing.md,
    backgroundColor: t.colors.card,
  },
  infoLine: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    lineHeight: 18,
  },
  infoLineSpacing: {
    marginTop: t.spacing.sm,
  },
  mono: {
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'}),
    color: t.colors.text,
    fontWeight: '800',
  },
  keyFrame: {
    marginTop: t.spacing.md,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.inputBg,
    padding: t.spacing.md,
  },
  keyHint: {
    ...t.typography.tiny,
    color: t.colors.textFaint,
    textAlign: 'center',
  },
  keyText: {
    marginTop: t.spacing.sm,
    color: t.colors.text,
    fontWeight: '900',
    letterSpacing: 1.3,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  warnBox: {
    marginTop: t.spacing.md,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.ghostBg,
    padding: t.spacing.md,
  },
  warnTitle: {
    ...t.typography.caption,
    fontWeight: '900',
    color: t.colors.text,
  },
  warnText: {
    marginTop: t.spacing.xs,
    ...t.typography.caption,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  error: {
    marginTop: t.spacing.sm,
    color: t.colors.danger,
    ...t.typography.caption,
  },
  btn: {
    marginTop: t.spacing.md,
    height: 48,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.9,
  },
  btnText: {
    color: t.colors.onPrimary,
    fontWeight: '900',
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: t.spacing.xl,
  },
  // linkBtn/linkText intentionally removed: на этом экране нельзя уходить назад
});
