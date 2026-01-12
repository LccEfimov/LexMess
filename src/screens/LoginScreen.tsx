import React, {useMemo, useState} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {saveLocalAccount} from '../storage/localAccountStorage';
import {i18n} from '../i18n';

interface Props {
  navigation: any;
  route: any;
  onAuthed: (login: string) => void;
}

export const LoginScreen: React.FC<Props> = ({navigation, route, onAuthed}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const api = useLexmessApi();

  const prefill = useMemo(() => {
    const v = route?.params?.prefillLogin;
    return typeof v === 'string' ? v : '';
  }, [route?.params?.prefillLogin]);

  const [login, setLogin] = useState(prefill);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLogin = async () => {
    const l = (login || '').trim();
    if (!l || !password) {
      setError(i18n.t('auth.login.errors.missing'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res: any = await api.authLogin({login: l, password});
      // подтянем /me чтобы взять wallet/display_name при наличии
      let me: any = null;
      try {
        me = await api.getMe({timeoutMs: 2500});
      } catch (e) {
        // ignore
      }

      await saveLocalAccount({
        login: (me && me.user_id) || l,
        displayName: (me && me.display_name) || null,
        walletAddress: (me && me.wallet_address) || (res && res.wallet_address) || null,
        recoveryShown: !!(me && me.recovery_shown),
      });

      onAuthed((me && me.user_id) || l);
    } catch (e: any) {
      if (e && e.status === 429) {
        const detail = (e && (e.payload?.detail || e.message)) || '';
        const m = /через\s+(\d+)\s*сек/i.exec(String(detail));
        if (m && m[1]) {
          const sec = Math.max(0, parseInt(m[1], 10) || 0);
          const min = Math.max(1, Math.ceil(sec / 60));
          setError(i18n.t('auth.login.errors.tooManyAttemptsWithMinutes', {minutes: min}));
        } else {
          setError(i18n.t('auth.login.errors.tooManyAttempts'));
        }
      } else {
        setError((e && e.message) || i18n.t('auth.login.errors.loginFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('auth.login.subtitle')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{i18n.t('auth.login.loginLabel')}</Text>
        <TextInput
          value={login}
          onChangeText={setLogin}
          placeholder={i18n.t('auth.login.loginPlaceholder')}
          placeholderTextColor={t.colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={[styles.label, {marginTop: 12}]}>{i18n.t('auth.login.passwordLabel')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={i18n.t('auth.login.passwordPlaceholder')}
          placeholderTextColor={t.colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={busy}
          style={({pressed}) => [styles.btn, (pressed || busy) && styles.btnPressed]}
          onPress={doLogin}>
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.btnText}>{i18n.t('auth.login.submit')}</Text>
          )}
        </Pressable>

        <Pressable
          style={({pressed}) => [styles.linkBtn, pressed && styles.btnPressed]}
          onPress={() => navigation.navigate('RecoveryReset', {prefillLogin: login})}>
          <Text style={styles.linkText}>{i18n.t('auth.login.forgotPassword')}</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [styles.linkBtn, pressed && styles.btnPressed]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>{i18n.t('auth.login.back')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
    paddingHorizontal: 22,
    paddingTop: 48,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: t.colors.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: t.colors.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: t.colors.card,
  },
  label: {
    fontSize: 12,
    color: t.colors.textMuted,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.inputBorder,
    paddingHorizontal: 12,
    color: t.colors.text,
    backgroundColor: t.colors.inputBg,
  },
  error: {
    marginTop: 10,
    color: t.colors.danger,
    fontSize: 12,
  },
  btn: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: t.colors.onPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  linkBtn: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  linkText: {
    color: t.colors.text,
    fontWeight: '700',
    opacity: 0.85,
  },
});
