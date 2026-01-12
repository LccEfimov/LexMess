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
  ScrollView,
} from 'react-native';
import {useLexmessApi} from '../hooks/useLexmessApi';
import {savePendingRecovery} from '../storage/pendingRecoveryStorage';
import {saveLocalAccount} from '../storage/localAccountStorage';
import {i18n} from '../i18n';

interface Props {
  navigation: any;
  route: any;
}

export const RecoveryResetScreen: React.FC<Props> = ({navigation, route}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const api = useLexmessApi();

  const prefillLogin = useMemo(() => {
    const v = route?.params?.prefillLogin;
    return typeof v === 'string' ? v : '';
  }, [route?.params?.prefillLogin]);

  const [login, setLogin] = useState(prefillLogin);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const doReset = async () => {
    const l = (login || '').trim();
    const rk = (recoveryKey || '').trim();
    const np = (newPassword || '').trim();

    if (!l || !rk || !np) {
      setError(i18n.t('auth.recoveryReset.errors.missing'));
      return;
    }

    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res: any = await api.authRecoveryReset({
        login: l,
        recoveryKey: rk,
        newPassword: np,
        rotateRecovery: true,
      });

      const walletAddress = (res && res.wallet_address) || null;
      const newKey = (res && res.recovery_key) || '';

      // сброс recoveryShown, чтобы гейт показался корректно
      await saveLocalAccount({
        login: l,
        walletAddress,
        recoveryShown: false,
      });

      if (newKey) {
        await savePendingRecovery({
          login: l,
          walletAddress,
          recoveryKey: newKey,
        });

        navigation.replace('RecoveryKey', {
          login: l,
          walletAddress,
          recoveryKey: newKey,
        });
        return;
      }

      // Теоретически возможно rotateRecovery=false. Тогда просто вернём на логин.
      setOkMsg(i18n.t('auth.recoveryReset.success'));
      navigation.replace('Login', {prefillLogin: l});
    } catch (e: any) {
      if (e && e.status === 429) {
        setError(i18n.t('auth.recoveryReset.errors.tooManyAttempts'));
      } else {
        setError((e && e.message) || i18n.t('auth.recoveryReset.errors.resetFailed'));
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
        <Text style={styles.title}>{i18n.t('auth.recoveryReset.title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('auth.recoveryReset.subtitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>{i18n.t('auth.recoveryReset.loginLabel')}</Text>
          <TextInput
            value={login}
            onChangeText={setLogin}
            placeholder={i18n.t('auth.recoveryReset.loginPlaceholder')}
            placeholderTextColor={t.colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpacing]}>
            {i18n.t('auth.recoveryReset.recoveryKeyLabel')}
          </Text>
          <TextInput
            value={recoveryKey}
            onChangeText={setRecoveryKey}
            placeholder={i18n.t('auth.recoveryReset.recoveryKeyPlaceholder')}
            placeholderTextColor={t.colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={[styles.input, styles.inputMulti]}
          />

          <Text style={[styles.label, styles.labelSpacing]}>
            {i18n.t('auth.recoveryReset.newPasswordLabel')}
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={i18n.t('auth.recoveryReset.newPasswordPlaceholder')}
            placeholderTextColor={t.colors.placeholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {okMsg ? <Text style={styles.ok}>{okMsg}</Text> : null}

          <Pressable
            disabled={busy}
            style={({pressed}) => [styles.btn, (pressed || busy) && styles.btnPressed]}
            onPress={doReset}>
            {busy ? (
              <ActivityIndicator color={t.colors.onPrimary} />
            ) : (
              <Text style={styles.btnText}>{i18n.t('auth.recoveryReset.submit')}</Text>
            )}
          </Pressable>

          <Pressable
            style={({pressed}) => [styles.linkBtn, pressed && styles.btnPressed]}
            onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>{i18n.t('auth.recoveryReset.back')}</Text>
          </Pressable>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>{i18n.t('auth.recoveryReset.noteTitle')}</Text>
          <Text style={styles.noteText}>{i18n.t('auth.recoveryReset.noteText')}</Text>
        </View>
      </ScrollView>
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
    marginBottom: 20,
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
  label: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginBottom: t.spacing.xs,
  },
  labelSpacing: {
    marginTop: t.spacing.md,
  },
  input: {
    minHeight: 46,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.inputBorder,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    color: t.colors.text,
    backgroundColor: t.colors.inputBg,
  },
  inputMulti: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: t.spacing.sm,
    color: t.colors.danger,
    ...t.typography.caption,
  },
  ok: {
    marginTop: t.spacing.sm,
    color: t.colors.success,
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
  btnText: {
    color: t.colors.onPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  linkBtn: {
    marginTop: t.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.spacing.sm,
  },
  linkText: {
    color: t.colors.textMuted,
    fontWeight: '700',
  },
  noteBox: {
    marginTop: t.spacing.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.ghostBg,
    borderRadius: t.radii.md,
    padding: t.spacing.md,
  },
  noteTitle: {
    ...t.typography.caption,
    fontWeight: '900',
    color: t.colors.text,
  },
  noteText: {
    marginTop: t.spacing.xs,
    ...t.typography.caption,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  scrollContent: {
    paddingBottom: t.spacing.xl,
  },
});
