import React, {useMemo, useState} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {saveLocalAccount} from '../storage/localAccountStorage';
import {i18n} from '../i18n';
import {Button} from '../ui/Button';
import {Input} from '../ui/Input';

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
        <Input
          label={i18n.t('auth.login.loginLabel')}
          value={login}
          onChangeText={setLogin}
          placeholder={i18n.t('auth.login.loginPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Input
          label={i18n.t('auth.login.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          placeholder={i18n.t('auth.login.passwordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          containerStyle={styles.inputSpacing}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={i18n.t('auth.login.submit')}
          onPress={doLogin}
          loading={busy}
          style={styles.loginButton}
        />

        <Pressable
          style={({pressed}) => [styles.linkBtn, pressed && styles.linkPressed]}
          onPress={() => navigation.navigate('RecoveryReset', {prefillLogin: login})}>
          <Text style={styles.linkText}>{i18n.t('auth.login.forgotPassword')}</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [styles.linkBtn, pressed && styles.linkPressed]}
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
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.xl * 2,
  },
  header: {
    marginBottom: t.spacing.lg,
  },
  title: {
    ...t.typography.title,
    color: t.colors.text,
  },
  subtitle: {
    marginTop: t.spacing.sm,
    ...t.typography.caption,
    color: t.colors.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radii.lg,
    padding: t.spacing.lg,
    backgroundColor: t.colors.card,
  },
  input: {
    minHeight: t.spacing.xl * 2,
    ...t.typography.bodyRegular,
  },
  inputSpacing: {
    marginTop: t.spacing.sm,
  },
  error: {
    marginTop: t.spacing.sm,
    color: t.colors.danger,
    ...t.typography.caption,
  },
  loginButton: {
    marginTop: t.spacing.md,
    minHeight: t.spacing.xl * 2,
  },
  linkBtn: {
    marginTop: t.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.spacing.sm,
  },
  linkPressed: {
    opacity: 0.85,
  },
  linkText: {
    color: t.colors.text,
    ...t.typography.body,
    fontWeight: '700',
    opacity: 0.85,
  },
});
