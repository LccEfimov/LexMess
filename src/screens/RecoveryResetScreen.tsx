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
      setError('Заполните логин, ключ и новый пароль');
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
      setOkMsg('Пароль обновлён. Войдите в аккаунт.');
      navigation.replace('Login', {prefillLogin: l});
    } catch (e: any) {
      if (e && e.status === 429) {
        setError('Слишком много попыток. Подождите и попробуйте позже.');
      } else {
        setError((e && e.message) || 'Не удалось восстановить');
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
        <Text style={styles.title}>Восстановление</Text>
        <Text style={styles.subtitle}>
          Введите логин, ключ восстановления и задайте новый пароль.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 22}} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Логин</Text>
          <TextInput
            value={login}
            onChangeText={setLogin}
            placeholder="например: piton_01"
            placeholderTextColor="rgba(232,236,255,0.35)"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={[styles.label, {marginTop: 12}]}>Ключ восстановления</Text>
          <TextInput
            value={recoveryKey}
            onChangeText={setRecoveryKey}
            placeholder="вставьте ключ"
            placeholderTextColor="rgba(232,236,255,0.35)"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={[styles.input, styles.inputMulti]}
          />

          <Text style={[styles.label, {marginTop: 12}]}>Новый пароль</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="новый пароль"
            placeholderTextColor="rgba(232,236,255,0.35)"
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
            {busy ? <ActivityIndicator /> : <Text style={styles.btnText}>Восстановить</Text>}
          </Pressable>

          <Pressable
            style={({pressed}) => [styles.linkBtn, pressed && styles.btnPressed]}
            onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Назад</Text>
          </Pressable>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>Важно</Text>
          <Text style={styles.noteText}>
            После восстановления система выдаст новый ключ и покажет его один раз.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 20,
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
  label: {
    fontSize: 12,
    color: 'rgba(232,236,255,0.75)',
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120,150,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E8ECFF',
    backgroundColor: 'rgba(5,8,23,0.35)',
  },
  inputMulti: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: 10,
    color: '#FF6B8A',
    fontSize: 12,
  },
  ok: {
    marginTop: 10,
    color: 'rgba(120,255,170,0.9)',
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
    color: 'rgba(232,236,255,0.75)',
    fontWeight: '700',
  },
  noteBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(140,175,255,0.18)',
    backgroundColor: 'rgba(120,150,255,0.06)',
    borderRadius: 14,
    padding: 12,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(232,236,255,0.85)',
  },
  noteText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(232,236,255,0.68)',
  },
});