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
import {Button, Divider, ErrorText, Input, Label, Row, SectionTitle, Spacer} from '../ui';
import {ScreenContainer} from '../ui/ScreenContainer';
import {ThemePicker} from '../components/ThemePicker';
import {i18n} from '../i18n';

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
  const locale = i18n.getLocale();

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
    if (pinMode === 'change') {
      return pinStep === 1
        ? i18n.t('settings.pin.modalChange')
        : i18n.t('settings.pin.modalRepeat');
    }
    return pinStep === 1 ? i18n.t('settings.pin.modalSet') : i18n.t('settings.pin.modalRepeat');
  }, [locale, pinMode, pinStep]);

  const openPin = useCallback(async (mode: PinMode) => {
    try {
      setPinErr(null);
      setPinA('');
      setPinB('');
      setPinStep(1);
      setPinMode(mode);

      if (mode === 'change' && security.hasPin) {
        // сначала попросим текущую проверку (PIN/биометрия)
        const ok = await security.requireSensitiveAuth(i18n.t('settings.pin.requireChange'));
        if (!ok) return;
      }

      setPinVisible(true);
    } catch (e: any) {
      setPinErr(e?.message || i18n.t('settings.alerts.securityError'));
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
        setPinErr(i18n.t('settings.pin.errorDigits'));
        return;
      }
      setPinStep(2);
      return;
    }

    if (!isDigits(pinB)) {
      setPinErr(i18n.t('settings.pin.errorDigits'));
      return;
    }
    if (pinA !== pinB) {
      setPinErr(i18n.t('settings.pin.errorMismatch'));
      return;
    }

    try {
      setBusy(true);
      await security.setPin(pinA);
      closePin();
      Alert.alert(i18n.t('settings.pin.doneTitle'), i18n.t('settings.pin.setSuccess'));
    } catch (e: any) {
      setPinErr(e?.message || i18n.t('settings.pin.setFailed'));
    } finally {
      setBusy(false);
    }
  }, [busy, closePin, pinA, pinB, pinStep, security]);

  const disablePin = useCallback(() => {
    Alert.alert(i18n.t('settings.pin.disableTitle'), i18n.t('settings.pin.disableBody'), [
      {text: i18n.t('common.cancel'), style: 'cancel'},
      {
        text: i18n.t('settings.pin.disableConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            const ok = await security.requireSensitiveAuth(i18n.t('settings.pin.requireDisable'));
            if (!ok) return;
            await security.clearPin();
            Alert.alert(i18n.t('settings.pin.doneTitle'), i18n.t('settings.pin.disableSuccess'));
          } catch (e: any) {
            Alert.alert(i18n.t('common.error'), e?.message || i18n.t('settings.pin.disableFailed'));
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
        setError(i18n.t('settings.alerts.nicknameRequired'));
        return;
      }
      await props.onApply({
        nickname: nick,
        theme,
        language,
        displayName: displayName.trim() || undefined,
        about: about.trim() || undefined,
      });
      Alert.alert(i18n.t('settings.alerts.savedTitle'), i18n.t('settings.alerts.savedBody'));
    } catch (e: any) {
      setError(e?.message || i18n.t('settings.alerts.saveFailed'));
    } finally {
      setBusy(false);
    }
  }, [about, displayName, language, nickname, props, theme]);

  const doChangePassword = useCallback(async () => {
    if (!pwCurrent.trim() || !pwNew.trim() || !pwNew2.trim()) {
      setError(i18n.t('settings.password.fillAll'));
      return;
    }
    if (pwNew.trim() !== pwNew2.trim()) {
      setError(i18n.t('settings.password.mismatch'));
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
      Alert.alert(i18n.t('settings.pin.doneTitle'), i18n.t('settings.password.changed'));
    } catch (e: any) {
      setError(e?.message || i18n.t('settings.password.changeFailed'));
    } finally {
      setBusy(false);
    }
  }, [props, pwCurrent, pwNew, pwNew2]);

  const doRotateRecovery = useCallback(async () => {
    if (!rotCurrent.trim()) {
      setError(i18n.t('settings.recovery.missing'));
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
      setError(e?.message || i18n.t('settings.recovery.failed'));
    } finally {
      setBusy(false);
    }
  }, [props, rotCurrent, nickname]);

  const doLogoutAll = useCallback(() => {
    Alert.alert(i18n.t('settings.alerts.logoutAllTitle'), i18n.t('settings.alerts.logoutAllBody'), [
      {text: i18n.t('common.cancel'), style: 'cancel'},
      {
        text: i18n.t('settings.alerts.logoutAllConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            setError(null);
            await props.onLogoutAll();
            Alert.alert(i18n.t('settings.pin.doneTitle'), i18n.t('settings.alerts.logoutAllSuccess'));
          } catch (e: any) {
            setError(e?.message || i18n.t('settings.alerts.logoutAllFailed'));
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
        Alert.alert(
          i18n.t('settings.alerts.recoveryTitle'),
          i18n.t('settings.alerts.recoveryMissing'),
        );
        return;
      }
      props.onShowRecovery({login: p.login, recoveryKey: p.recovery_key, walletAddress: p.wallet_address});
    } catch {
      Alert.alert(i18n.t('common.error'), i18n.t('settings.alerts.recoveryLoadFailed'));
    }
  }, [props]);

  return (
    <ScreenContainer scroll style={styles.root} contentStyle={styles.content}>
      <SectionTitle>{i18n.t('settings.title')}</SectionTitle>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Label>{i18n.t('settings.labels.nickname')}</Label>
      <Input value={nickname} onChangeText={setNickname} autoCapitalize="none" placeholder={i18n.t('settings.placeholders.login')} />
      <Spacer h={10} />

      <Label>{i18n.t('settings.labels.displayName')}</Label>
      <Input value={displayName} onChangeText={setDisplayName} placeholder={i18n.t('settings.placeholders.displayName')} />
      <Spacer h={10} />

      <Label>{i18n.t('settings.labels.about')}</Label>
      <Input value={about} onChangeText={setAbout} placeholder={i18n.t('settings.placeholders.about')} />

      <Spacer h={16} />
      <SectionTitle>{i18n.t('settings.theme')}</SectionTitle>
      <ThemePicker value={theme} onChange={setTheme} compact />

      <Spacer h={16} />
      <SectionTitle>{i18n.t('settings.language')}</SectionTitle>
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
      <SectionTitle>{i18n.t('settings.security')}</SectionTitle>
      <Text style={styles.muted}>
        {i18n.t('settings.pinStatus.label')} {security.hasPin ? i18n.t('settings.pinStatus.enabled') : i18n.t('settings.pinStatus.disabled')}
      </Text>
      <Spacer h={8} />
      <Row>
        {!security.hasPin ? (
          <Button title={i18n.t('settings.pin.set')} onPress={() => openPin('set')} small />
        ) : (
          <>
            <Button title={i18n.t('settings.pin.change')} onPress={() => openPin('change')} small />
            <Spacer w={10} />
            <Button title={i18n.t('settings.pin.disable')} onPress={disablePin} small secondary />
          </>
        )}
      </Row>

      <Spacer h={8} />
      <Button title={i18n.t('settings.pin.showRecovery')} onPress={showRecovery} small secondary />

      <Spacer h={16} />
      <Divider />
      <Spacer h={16} />

      <SectionTitle>{i18n.t('settings.navigation')}</SectionTitle>
      <Row>
        <Button title={i18n.t('settings.buttons.main')} onPress={props.onOpenMain} small secondary />
        <Spacer w={10} />
        <Button title={i18n.t('settings.buttons.wallet')} onPress={props.onOpenWallet} small secondary />
        <Spacer w={10} />
        <Button title={i18n.t('settings.buttons.diagnostics')} onPress={props.onOpenDiagnostics} small secondary />
      </Row>

      <Spacer h={18} />
      <Button title={busy ? i18n.t('settings.buttons.saving') : i18n.t('settings.buttons.save')} onPress={apply} disabled={busy} />
      <Spacer h={10} />
      <Button title={i18n.t('settings.buttons.back')} onPress={props.onBack} secondary />
      <Spacer h={10} />
      <Button title={i18n.t('settings.buttons.logout')} onPress={props.onLogout} danger secondary />

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
              <Button title={i18n.t('common.cancel')} onPress={closePin} small secondary />
              <Spacer w={10} />
              <Button title={pinStep === 1 ? i18n.t('common.next') : i18n.t('settings.pin.doneTitle')} onPress={pinNext} small />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPwOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{i18n.t('settings.password.changeTitle')}</Text>
            <Spacer h={8} />
            <Input value={pwCurrent} onChangeText={setPwCurrent} placeholder={i18n.t('settings.password.current')} secureTextEntry />
            <Spacer h={8} />
            <Input value={pwNew} onChangeText={setPwNew} placeholder={i18n.t('settings.password.new')} secureTextEntry />
            <Spacer h={8} />
            <Input value={pwNew2} onChangeText={setPwNew2} placeholder={i18n.t('settings.password.repeat')} secureTextEntry />
            <Spacer h={12} />
            <Row>
              <Button title={i18n.t('common.cancel')} onPress={() => setPwOpen(false)} secondary />
              <Spacer w={10} />
              <Button title={busy ? i18n.t('settings.buttons.saving') : i18n.t('settings.password.change')} onPress={doChangePassword} disabled={busy} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={rotOpen} transparent animationType="fade" onRequestClose={() => setRotOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRotOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{i18n.t('settings.recovery.title')}</Text>
            <Text style={styles.muted}>{i18n.t('settings.recovery.subtitle')}</Text>
            <Spacer h={10} />
            <Input value={rotCurrent} onChangeText={setRotCurrent} placeholder={i18n.t('settings.recovery.current')} secureTextEntry />
            <Spacer h={12} />
            <Row>
              <Button title={i18n.t('common.cancel')} onPress={() => setRotOpen(false)} secondary />
              <Spacer w={10} />
              <Button title={busy ? i18n.t('settings.buttons.saving') : i18n.t('settings.recovery.generate')} onPress={doRotateRecovery} disabled={busy} />
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
      backgroundColor: t.colors.overlayDark,
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
