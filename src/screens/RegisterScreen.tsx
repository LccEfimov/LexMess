import React, {useCallback, useMemo, useState} from 'react';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {saveLocalAccount} from '../storage/localAccountStorage';
import {saveThemePreference} from '../storage/themePreferenceStorage';
import {useSetThemeName, useTheme, useThemeName} from '../theme/ThemeContext';
import {normalizeThemeMode, type Theme, type ThemeMode} from '../theme/themes';

import {View, Text, StyleSheet, KeyboardAvoidingView, Platform} from 'react-native';
import {ThemePicker} from '../components/ThemePicker';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';
import {i18n} from '../i18n';
import {Input} from '../ui/Input';

interface Props {
  navigation: any;
  route: any;
  onAuthed: (login: string) => void;
  onBack?: () => void;
}

export const RegisterScreen: React.FC<Props> = ({navigation, route, onAuthed, onBack}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const themeName = useThemeName();
  const setThemeName = useSetThemeName();

  const api = useLexmessApi();

  const prefill = useMemo(() => {
    const v = route?.params?.prefillLogin;
    return typeof v === 'string' ? v : '';
  }, [route?.params?.prefillLogin]);

  const [login, setLogin] = useState(prefill);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickTheme = useCallback(
    async (next: ThemeMode) => {
      const id = normalizeThemeMode(next);
      try {
        setThemeName(id);
      } catch {
        // ignore
      }
      await saveThemePreference(id);
    },
    [setThemeName],
  );

  const doRegister = async () => {
    const l = (login || '').trim();
    if (!l || !password) {
      setError(i18n.t('register.errors.missing'));
      return;
    }
    if (password.length < 6) {
      setError(i18n.t('register.errors.passwordLength'));
      return;
    }
    if (password !== password2) {
      setError(i18n.t('register.errors.passwordMismatch'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res: any = await api.authRegister({login: l, password});

      // сразу дернем /me, чтобы взять display_name/wallet/recovery
      let me: any = null;
      try {
        me = await api.getMe({timeoutMs: 2500});
      } catch {
        // ignore
      }

      await saveLocalAccount({
        login: (me && me.user_id) || l,
        displayName: (me && me.display_name) || null,
        walletAddress: (me && me.wallet_address) || (res && res.wallet_address) || null,
        recoveryShown: !!(me && me.recovery_shown),
      });

      // фолбэк: сохраним тему, выбранную на регистрации
      try {
        await saveThemePreference(normalizeThemeMode(themeName));
      } catch {
        // ignore
      }

      onAuthed((me && me.user_id) || l);
    } catch (e: any) {
      const m = (e && (e.message || e.payload?.detail)) || i18n.t('register.errors.registerFailed');
      setError(String(m));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('register.title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('register.subtitle')}</Text>
      </View>

      <Card style={styles.card}>
        <Text style={[styles.label, styles.cardItem]}>{i18n.t('register.theme')}</Text>
        <View style={styles.cardItem}>
          <ThemePicker value={themeName} onChange={onPickTheme} compact />
        </View>

        <View style={[styles.spacer, styles.cardItem]} />

        <Input
          label={i18n.t('register.loginLabel')}
          value={login}
          onChangeText={setLogin}
          placeholder={i18n.t('register.loginPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          containerStyle={styles.cardItem}
        />

        <Input
          label={i18n.t('register.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          placeholder={i18n.t('register.passwordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          containerStyle={[styles.cardItem, styles.inputSpacing]}
        />

        <Input
          label={i18n.t('register.passwordRepeatLabel')}
          value={password2}
          onChangeText={setPassword2}
          placeholder={i18n.t('register.passwordRepeatPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          containerStyle={[styles.cardItem, styles.inputSpacing]}
        />

        {error ? <Text style={[styles.error, styles.cardItem]}>{error}</Text> : null}

        <Button
          title={busy ? i18n.t('register.creating') : i18n.t('register.create')}
          onPress={doRegister}
          disabled={busy}
          style={styles.cardItem}
        />

        <Button
          title={i18n.t('register.back')}
          variant="ghost"
          onPress={() => (onBack ? onBack() : navigation.goBack())}
        />
      </Card>
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
    card: {},
    cardItem: {
      marginBottom: t.spacing.md,
    },
    spacer: {
      height: t.spacing.md,
    },
    label: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginBottom: t.spacing.xs,
    },
    inputSpacing: {
      marginTop: t.spacing.sm,
    },
    input: {
      minHeight: t.spacing.xl * 2,
      ...t.typography.bodyRegular,
    },
    error: {
      marginTop: t.spacing.sm,
      color: t.colors.danger,
      ...t.typography.caption,
    },
  });
