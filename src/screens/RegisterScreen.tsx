import React, {useCallback, useMemo, useState} from 'react';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {saveLocalAccount} from '../storage/localAccountStorage';
import {saveThemePreference} from '../storage/themePreferenceStorage';
import {useSetThemeName, useTheme, useThemeName} from '../theme/ThemeContext';
import {normalizeThemeMode, type Theme, type ThemeMode} from '../theme/themes';

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {ThemePicker} from '../components/ThemePicker';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';

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
      setError('Введите логин и пароль');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (password !== password2) {
      setError('Пароли не совпадают');
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
      const m = (e && (e.message || e.payload?.detail)) || 'Ошибка регистрации';
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
        <Text style={styles.title}>Регистрация</Text>
        <Text style={styles.subtitle}>Выберите логин, пароль и тему интерфейса</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>Тема</Text>
        <ThemePicker value={themeName} onChange={onPickTheme} compact />

        <View style={{height: 14}} />

        <Text style={styles.label}>Логин</Text>
        <TextInput
          value={login}
          onChangeText={setLogin}
          placeholder="например: piton_01"
          placeholderTextColor={t.colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={[styles.label, {marginTop: 12}]}>Пароль</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="пароль"
          placeholderTextColor={t.colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <Text style={[styles.label, {marginTop: 12}]}>Повтор пароля</Text>
        <TextInput
          value={password2}
          onChangeText={setPassword2}
          placeholder="повтор"
          placeholderTextColor={t.colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={busy ? 'Создание...' : 'Создать аккаунт'}
          onPress={doRegister}
          disabled={busy}
        />

        <Button
          title="Назад"
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
      gap: 12,
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
  });
