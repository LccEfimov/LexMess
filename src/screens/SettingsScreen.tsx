import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {useSecurity} from '../security/SecurityContext';
import {useTheme} from '../theme/ThemeContext';
import {normalizeThemeMode, type Theme, type ThemeMode} from '../theme/themes';
import {loadPendingRecovery} from '../storage/pendingRecoveryStorage';
import {Button, Divider, ErrorText, Input, Label, Row, SectionTitle, Spacer} from '../ui/kit';
import {ScreenContainer} from '../ui/ScreenContainer';
import {ThemePicker} from '../components/ThemePicker';

type LanguageName = 'ru' | 'en' | string;

type ApplyOpts = {
  nickname: string;
  theme: ThemeMode;
  language: LanguageName;
  displayName?: string;
  about?: string;
};

type Props = {
  initialNickname: string;
  initialTheme: ThemeMode;
  initialLanguage: LanguageName;
  onBack: () => void;
  onApply: (opts: ApplyOpts) => Promise<void> | void;
  onOpenMain: () => void;
  onOpenWallet: () => void;
  onOpenDiagnostics: () => void;
  onLogout: () => void;
  onLogoutAll: () => Promise<void>;
  onChangePassword: (data: {currentPassword: string; newPassword: string}) => Promise<void>;
  onRotateRecovery: (data: {currentPassword: string}) => Promise<{recoveryKey: string; walletAddress: string}>;
  onShowRecovery: (data: {login: string; recoveryKey: string; walletAddress: string}) => void;
};

type PinMode = 'set' | 'change';

export const SettingsScreen: React.FC<Props> = props => {
  const security = useSecurity();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [nickname, setNickname] = useState(String(props.initialNickname || ''));
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [theme, setTheme] = useState<ThemeMode>(normalizeThemeMode(props.initialTheme || 'system'));
  const [language, setLanguage] = useState<LanguageName>(props.initialLanguage || 'ru');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');

  const [rotOpen, setRotOpen] = useState(false);
  const [rotCurrent, setRotCurrent] = useState('');

  // PIN modal
  const [pinVisible, setPinVisible] = useState(false);
  const [pinMode, setPinMode] = useState<PinMode>('set');
  const [pinStep, setPinStep] = useState<1 | 2>(1);
  const [pinA, setPinA] = useState('');
  const [pinB, setPinB] = useState('');
  const [pinErr, setPinErr] = useState<string | null>(null);

  const pinTitle = useMemo(() => {
    if (pinMode === 'change') return pinStep === 1 ? 'Новый PIN' : 'Повторите PIN';
    return pinStep === 1 ? 'Установите PIN' : 'Повторите PIN';
  }, [pinMode, pinStep]);

  const openPin = useCallback(async (mode: PinMode) => {
    try {
      setPinErr(null);
      setPinA('');
      setPinB('');
      setPinStep(1);
      setPinMode(mode);

      if (mode === 'change' && security.hasPin) {
        // сначала попросим текущую проверку (PIN/биометрия)
        const ok = await security.requireSensitiveAuth('Изменение PIN');
        if (!ok) return;
      }

      setPinVisible(true);
    } catch (e: any) {
      setPinErr(e?.message || 'Ошибка безопасности');
    }
  }, [security]);

  const closePin = useCallback(() => {
    setPinVisible(false);
    setPinErr(null);
    setPinA('');
    setPinB('');
    setPinStep(1);
  }, []);

  const pinNext = useCallback(async () => {
    setPinErr(null);
    const isDigits = (s: string) => /^[0-9]{4}$/.test(s);

    if (pinStep === 1) {
      if (!isDigits(pinA)) {
        setPinErr('PIN должен состоять из 4 цифр');
        return;
      }
      setPinStep(2);
      return;
    }

    if (!isDigits(pinB)) {
      setPinErr('PIN должен состоять из 4 цифр');
      return;
    }
    if (pinA !== pinB) {
      setPinErr('PIN не совпадает');
      return;
    }

    try {
      setBusy(true);
      await security.setPin(pinA);
      closePin();
      Alert.alert('Готово', 'PIN установлен');
    } catch (e: any) {
      setPinErr(e?.message || 'Не удалось установить PIN');
    } finally {
      setBusy(false);
    }
  }, [busy, closePin, pinA, pinB, pinStep, security]);

  const disablePin = useCallback(() => {
    Alert.alert('Отключить PIN', 'Отключить защиту PIN для входа и операций?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Отключить',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            const ok = await security.requireSensitiveAuth('Отключение PIN');
            if (!ok) return;
            await security.clearPin();
            Alert.alert('Готово', 'PIN отключен');
          } catch (e: any) {
            Alert.alert('Ошибка', e?.message || 'Не удалось отключить PIN');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [security]);

  const apply = useCallback(async () => {
    try {
      setError(null);
      setBusy(true);
      const nick = String(nickname || '').trim();
      if (!nick) {
        setError('Ник не может быть пустым');
        return;
      }
      await props.onApply({
        nickname: nick,
        theme,
        language,
        displayName: displayName.trim() || undefined,
        about: about.trim() || undefined,
      });
      Alert.alert('Сохранено', 'Настройки обновлены');
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }, [about, displayName, language, nickname, props, theme]);

  const doChangePassword = useCallback(async () => {
    if (!pwCurrent.trim() || !pwNew.trim() || !pwNew2.trim()) {
      setError('Заполните все поля');
      return;
    }
    if (pwNew.trim() !== pwNew2.trim()) {
      setError('Новые пароли не совпадают');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await props.onChangePassword({currentPassword: pwCurrent, newPassword: pwNew});
      setPwOpen(false);
      setPwCurrent('');
      setPwNew('');
      setPwNew2('');
      Alert.alert('Готово', 'Пароль изменён');
    } catch (e: any) {
      setError(e?.message || 'Не удалось изменить пароль');
    } finally {
      setBusy(false);
    }
  }, [props, pwCurrent, pwNew, pwNew2]);

  const doRotateRecovery = useCallback(async () => {
    if (!rotCurrent.trim()) {
      setError('Введите текущий пароль');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await props.onRotateRecovery({currentPassword: rotCurrent});
      setRotOpen(false);
      setRotCurrent('');
      // показываем новый recovery key через существующий экран
      props.onShowRecovery({login: nickname, recoveryKey: res.recoveryKey, walletAddress: res.walletAddress});
    } catch (e: any) {
      setError(e?.message || 'Не удалось сгенерировать ключ');
    } finally {
      setBusy(false);
    }
  }, [props, rotCurrent, nickname]);

  const doLogoutAll = useCallback(() => {
    Alert.alert('Выход со всех устройств', 'Завершить все активные сессии?', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Выйти везде',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            setError(null);
            await props.onLogoutAll();
            Alert.alert('Готово', 'Все сессии завершены');
          } catch (e: any) {
            setError(e?.message || 'Не удалось выполнить');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [props]);

  const showRecovery = useCallback(async () => {
    try {
      const p = await loadPendingRecovery();
      if (!p) {
        Alert.alert('Ключ восстановления', 'Ключ не найден (он показывается один раз после регистрации).');
        return;
      }
      props.onShowRecovery({login: p.login, recoveryKey: p.recovery_key, walletAddress: p.wallet_address});
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить ключ');
    }
  }, [props]);

  return (
    <ScreenContainer scroll style={styles.root} contentStyle={styles.content}>
      <SectionTitle>Профиль</SectionTitle>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Label>Ник (логин)</Label>
      <Input value={nickname} onChangeText={setNickname} autoCapitalize="none" placeholder="login" />
      <Spacer h={10} />

      <Label>Имя отображения</Label>
      <Input value={displayName} onChangeText={setDisplayName} placeholder="например: Алексей" />
      <Spacer h={10} />

      <Label>О себе</Label>
      <Input value={about} onChangeText={setAbout} placeholder="пара слов" />

      <Spacer h={16} />
      <SectionTitle>Тема</SectionTitle>
      <ThemePicker value={theme} onChange={setTheme} compact />

      <Spacer h={16} />
      <SectionTitle>Язык</SectionTitle>
      <Row>
        <Button
          title="RU"
          onPress={() => setLanguage('ru')}
          small
          secondary={String(language) !== 'ru'}
        />
        <Spacer w={10} />
        <Button
          title="EN"
          onPress={() => setLanguage('en')}
          small
          secondary={String(language) !== 'en'}
        />
      </Row>

      <Spacer h={16} />
      <SectionTitle>Безопасность</SectionTitle>
      <Text style={styles.muted}>PIN: {security.hasPin ? 'включён' : 'выключен'}</Text>
      <Spacer h={8} />
      <Row>
        {!security.hasPin ? (
          <Button title="Установить PIN" onPress={() => openPin('set')} small />
        ) : (
          <>
            <Button title="Изменить PIN" onPress={() => openPin('change')} small />
            <Spacer w={10} />
            <Button title="Отключить" onPress={disablePin} small secondary />
          </>
        )}
      </Row>

      <Spacer h={8} />
      <Button title="Показать ключ восстановления" onPress={showRecovery} small secondary />

      <Spacer h={16} />
      <Divider />
      <Spacer h={16} />

      <SectionTitle>Навигация</SectionTitle>
      <Row>
        <Button title="Главная" onPress={props.onOpenMain} small secondary />
        <Spacer w={10} />
        <Button title="Кошелёк" onPress={props.onOpenWallet} small secondary />
        <Spacer w={10} />
        <Button title="Диагностика" onPress={props.onOpenDiagnostics} small secondary />
      </Row>

      <Spacer h={18} />
      <Button title={busy ? '...' : 'Сохранить'} onPress={apply} disabled={busy} />
      <Spacer h={10} />
      <Button title="Назад" onPress={props.onBack} secondary />
      <Spacer h={10} />
      <Button title="Выйти" onPress={props.onLogout} danger secondary />

      {/* PIN modal */}
      <Modal visible={pinVisible} transparent animationType="fade" onRequestClose={closePin}>
        <Pressable style={styles.modalOverlay} onPress={closePin}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>{pinTitle}</Text>
            <Spacer h={10} />

            <TextInput
              value={pinStep === 1 ? pinA : pinB}
              onChangeText={pinStep === 1 ? setPinA : setPinB}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              style={styles.pinInput}
              placeholder="••••"
              placeholderTextColor={t.colors.placeholder}
            />
            {pinErr ? <ErrorText>{pinErr}</ErrorText> : null}

            <Spacer h={14} />
            <Row>
              <Button title="Отмена" onPress={closePin} small secondary />
              <Spacer w={10} />
              <Button title={pinStep === 1 ? 'Далее' : 'Готово'} onPress={pinNext} small />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPwOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Изменение пароля</Text>
            <Spacer h={8} />
            <Input value={pwCurrent} onChangeText={setPwCurrent} placeholder="Текущий пароль" secureTextEntry />
            <Spacer h={8} />
            <Input value={pwNew} onChangeText={setPwNew} placeholder="Новый пароль" secureTextEntry />
            <Spacer h={8} />
            <Input value={pwNew2} onChangeText={setPwNew2} placeholder="Повтор нового пароля" secureTextEntry />
            <Spacer h={12} />
            <Row>
              <Button title="Отмена" onPress={() => setPwOpen(false)} secondary />
              <Spacer w={10} />
              <Button title={busy ? '...' : 'Сменить'} onPress={doChangePassword} disabled={busy} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={rotOpen} transparent animationType="fade" onRequestClose={() => setRotOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRotOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Новый ключ восстановления</Text>
            <Text style={styles.muted}>Для генерации требуется подтверждение текущим паролем.</Text>
            <Spacer h={10} />
            <Input value={rotCurrent} onChangeText={setRotCurrent} placeholder="Текущий пароль" secureTextEntry />
            <Spacer h={12} />
            <Row>
              <Button title="Отмена" onPress={() => setRotOpen(false)} secondary />
              <Spacer w={10} />
              <Button title={busy ? '...' : 'Сгенерировать'} onPress={doRotateRecovery} disabled={busy} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>

</ScreenContainer>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    content: {
      padding: 18,
    },
    muted: {
      color: t.colors.textMuted,
      fontSize: 13,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: t.colors.bgElevated,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    modalTitle: {
      color: t.colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    pinInput: {
      height: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBg,
      paddingHorizontal: 14,
      color: t.colors.text,
      fontSize: 18,
      letterSpacing: 8,
      textAlign: 'center',
    },
  });
