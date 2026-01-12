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

      <ScrollView contentContainerStyle={{paddingBottom: 22}}>
        <View style={styles.card}>
          <Text style={styles.infoLine}>
            Логин: <Text style={styles.mono}>{login || '—'}</Text>
          </Text>

          {walletAddress ? (
            <Text style={[styles.infoLine, {marginTop: 8}]}>
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
              (!login || busy) && {opacity: 0.9},
            ]}
            onPress={confirmSaved}>
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.btnText}>Я сохранил</Text>
            )}
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
    backgroundColor: '#050817',
    paddingHorizontal: 22,
    paddingTop: 48,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#E8ECFF',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(232,236,255,0.68)',
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(120,150,255,0.22)',
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(10,14,35,0.65)',
  },
  infoLine: {
    fontSize: 12,
    color: 'rgba(232,236,255,0.78)',
    lineHeight: 18,
  },
  mono: {
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'}),
    color: '#E8ECFF',
    fontWeight: '800',
  },
  keyFrame: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(140,175,255,0.55)',
    backgroundColor: 'rgba(5,8,23,0.55)',
    padding: 14,
  },
  keyHint: {
    fontSize: 11,
    color: 'rgba(232,236,255,0.58)',
    textAlign: 'center',
  },
  keyText: {
    marginTop: 10,
    color: '#E8ECFF',
    fontWeight: '900',
    letterSpacing: 1.3,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  warnBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,210,110,0.18)',
    backgroundColor: 'rgba(255,210,110,0.06)',
    padding: 12,
  },
  warnTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(255,210,110,0.95)',
  },
  warnText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(232,236,255,0.78)',
  },
  error: {
    marginTop: 10,
    color: '#FF6B8A',
    fontSize: 12,
  },
  btn: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7CFF',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: '#0B102A',
    fontWeight: '900',
    fontSize: 16,
  },
  // linkBtn/linkText intentionally removed: на этом экране нельзя уходить назад
});