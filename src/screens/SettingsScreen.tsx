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

import {useTranslation} from 'react-i18next';
import {useSecurity} from '../security/SecurityContext';
import {useTheme} from '../theme/ThemeContext';
import {normalizeThemeName, type Theme, type ThemeName} from '../theme/themes';
import {loadPendingRecovery} from '../storage/pendingRecoveryStorage';
import {Button, Divider, ErrorText, Input, Label, Row, SectionTitle, Spacer} from '../ui/kit';
import {ScreenContainer} from '../ui/ScreenContainer';
import {ThemePicker} from '../components/ThemePicker';

type LanguageName = 'ru' | 'en' | string;

type ApplyOpts = {
  nickname: string;
  theme: ThemeName;
  language: LanguageName;
  displayName?: string;
  about?: string;
};

type Props = {
  initialNickname: string;
  initialTheme: ThemeName;
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
  const theme = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [nickname, setNickname] = useState(String(props.initialNickname || ''));
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [themeName, setThemeName] = useState<ThemeName>(
    normalizeThemeName(props.initialTheme || 'lexmess_dark'),
  );
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
      return pinStep === 1 ? t('settings.pinTitleNew') : t('settings.pinTitleRepeat');
    }
    return pinStep === 1 ? t('settings.pinTitleSet') : t('settings.pinTitleRepeat');
  }, [pinMode, pinStep, t]);

  const openPin = useCallback(async (mode: PinMode) => {
    try {
      setPinErr(null);
      setPinA('');
      setPinB('');
      setPinStep(1);
      setPinMode(mode);

      if (mode === 'change' && security.hasPin) {
        // сначала попросим текущую проверку (PIN/биометрия)
        const ok = await security.requireSensitiveAuth(t('settings.securityChangePinPrompt'));
        if (!ok) return;
      }

      setPinVisible(true);
    } catch (e: any) {
      setPinErr(e?.message || t('settings.securityError'));
    }
  }, [security, t]);

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
        setPinErr(t('settings.pinErrorDigits'));
        return;
      }
      setPinStep(2);
      return;
    }

    if (!isDigits(pinB)) {
      setPinErr(t('settings.pinErrorDigits'));
      return;
    }
    if (pinA !== pinB) {
      setPinErr(t('settings.pinErrorMismatch'));
      return;
    }

    try {
      setBusy(true);
      await security.setPin(pinA);
      closePin();
      Alert.alert(t('common.done'), t('settings.pinSetMessage'));
    } catch (e: any) {
      setPinErr(e?.message || t('settings.pinSetError'));
    } finally {
      setBusy(false);
    }
  }, [busy, closePin, pinA, pinB, pinStep, security, t]);

  const disablePin = useCallback(() => {
    Alert.alert(t('settings.disablePinTitle'), t('settings.disablePinMessage'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('settings.disablePinConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            const ok = await security.requireSensitiveAuth(t('settings.securityDisablePinPrompt'));
            if (!ok) return;
            await security.clearPin();
            Alert.alert(t('common.done'), t('settings.pinDisabledMessage'));
          } catch (e: any) {
            Alert.alert(t('common.error'), e?.message || t('settings.pinDisableError'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [security, t]);

  const apply = useCallback(async () => {
    try {
      setError(null);
      setBusy(true);
      const nick = String(nickname || '').trim();
      if (!nick) {
        setError(t('settings.errorNickEmpty'));
        return;
      }
      await props.onApply({
        nickname: nick,
        theme: themeName,
        language,
        displayName: displayName.trim() || undefined,
        about: about.trim() || undefined,
      });
      Alert.alert(t('common.saved'), t('settings.settingsSavedMessage'));
    } catch (e: any) {
      setError(e?.message || t('settings.settingsSaveError'));
    } finally {
      setBusy(false);
    }
  }, [about, displayName, language, nickname, props, t, themeName]);

  const doChangePassword = useCallback(async () => {
    if (!pwCurrent.trim() || !pwNew.trim() || !pwNew2.trim()) {
      setError(t('settings.changePasswordFieldsError'));
      return;
    }
    if (pwNew.trim() !== pwNew2.trim()) {
      setError(t('settings.changePasswordMismatch'));
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
      Alert.alert(t('common.done'), t('settings.passwordChangedMessage'));
    } catch (e: any) {
      setError(e?.message || t('settings.passwordChangeError'));
    } finally {
      setBusy(false);
    }
  }, [props, pwCurrent, pwNew, pwNew2, t]);

  const doRotateRecovery = useCallback(async () => {
    if (!rotCurrent.trim()) {
      setError(t('settings.rotatePasswordRequired'));
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
      setError(e?.message || t('settings.rotateError'));
    } finally {
      setBusy(false);
    }
  }, [props, rotCurrent, nickname, t]);

  const doLogoutAll = useCallback(() => {
    Alert.alert(t('settings.logoutAllTitle'), t('settings.logoutAllMessage'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('settings.logoutAllConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            setError(null);
            await props.onLogoutAll();
            Alert.alert(t('common.done'), t('settings.logoutAllDoneMessage'));
          } catch (e: any) {
            setError(e?.message || t('settings.logoutAllError'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [props, t]);

  const showRecovery = useCallback(async () => {
    try {
      const p = await loadPendingRecovery();
      if (!p) {
        Alert.alert(t('settings.recoveryTitle'), t('settings.recoveryNotFound'));
        return;
      }
      props.onShowRecovery({login: p.login, recoveryKey: p.recovery_key, walletAddress: p.wallet_address});
    } catch {
      Alert.alert(t('common.error'), t('settings.recoveryLoadErrorMessage'));
    }
  }, [props, t]);

  return (
    <ScreenContainer scroll style={styles.root} contentStyle={styles.content}>
      <SectionTitle>{t('settings.sectionProfile')}</SectionTitle>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Label>{t('settings.labelNickname')}</Label>
      <Input
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="none"
        placeholder={t('settings.placeholderLogin')}
      />
      <Spacer h={10} />

      <Label>{t('settings.labelDisplayName')}</Label>
      <Input
        value={displayName}
        onChangeText={setDisplayName}
        placeholder={t('settings.placeholderDisplayName')}
      />
      <Spacer h={10} />

      <Label>{t('settings.labelAbout')}</Label>
      <Input value={about} onChangeText={setAbout} placeholder={t('settings.placeholderAbout')} />

      <Spacer h={16} />
      <SectionTitle>{t('settings.sectionTheme')}</SectionTitle>
      <ThemePicker value={themeName} onChange={setThemeName} compact />

      <Spacer h={16} />
      <SectionTitle>{t('settings.sectionLanguage')}</SectionTitle>
      <Row>
        <Button
          title={t('settings.languageRu')}
          onPress={() => setLanguage('ru')}
          small
          secondary={String(language) !== 'ru'}
        />
        <Spacer w={10} />
        <Button
          title={t('settings.languageEn')}
          onPress={() => setLanguage('en')}
          small
          secondary={String(language) !== 'en'}
        />
      </Row>

      <Spacer h={16} />
      <SectionTitle>{t('settings.sectionSecurity')}</SectionTitle>
      <Text style={styles.muted}>
        {t('settings.pinStatus', {
          status: security.hasPin ? t('settings.pinStatusEnabled') : t('settings.pinStatusDisabled'),
        })}
      </Text>
      <Spacer h={8} />
      <Row>
        {!security.hasPin ? (
          <Button title={t('settings.setPin')} onPress={() => openPin('set')} small />
        ) : (
          <>
            <Button title={t('settings.changePin')} onPress={() => openPin('change')} small />
            <Spacer w={10} />
            <Button title={t('settings.disablePin')} onPress={disablePin} small secondary />
          </>
        )}
      </Row>

      <Spacer h={8} />
      <Button title={t('settings.showRecovery')} onPress={showRecovery} small secondary />

      <Spacer h={16} />
      <Divider />
      <Spacer h={16} />

      <SectionTitle>{t('settings.sectionNavigation')}</SectionTitle>
      <Row>
        <Button title={t('settings.navHome')} onPress={props.onOpenMain} small secondary />
        <Spacer w={10} />
        <Button title={t('settings.navWallet')} onPress={props.onOpenWallet} small secondary />
        <Spacer w={10} />
        <Button title={t('settings.navDiagnostics')} onPress={props.onOpenDiagnostics} small secondary />
      </Row>

      <Spacer h={18} />
      <Button title={busy ? t('common.loadingShort') : t('settings.saveButton')} onPress={apply} disabled={busy} />
      <Spacer h={10} />
      <Button title={t('settings.backButton')} onPress={props.onBack} secondary />
      <Spacer h={10} />
      <Button title={t('settings.logoutButton')} onPress={props.onLogout} danger secondary />

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
              placeholder={t('settings.pinPlaceholder')}
              placeholderTextColor="#6f7690"
            />
            {pinErr ? <ErrorText>{pinErr}</ErrorText> : null}

            <Spacer h={14} />
            <Row>
              <Button title={t('common.cancel')} onPress={closePin} small secondary />
              <Spacer w={10} />
              <Button title={pinStep === 1 ? t('settings.pinNext') : t('common.done')} onPress={pinNext} small />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPwOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t('settings.changePasswordTitle')}</Text>
            <Spacer h={8} />
            <Input
              value={pwCurrent}
              onChangeText={setPwCurrent}
              placeholder={t('settings.currentPasswordPlaceholder')}
              secureTextEntry
            />
            <Spacer h={8} />
            <Input
              value={pwNew}
              onChangeText={setPwNew}
              placeholder={t('settings.newPasswordPlaceholder')}
              secureTextEntry
            />
            <Spacer h={8} />
            <Input
              value={pwNew2}
              onChangeText={setPwNew2}
              placeholder={t('settings.repeatNewPasswordPlaceholder')}
              secureTextEntry
            />
            <Spacer h={12} />
            <Row>
              <Button title={t('common.cancel')} onPress={() => setPwOpen(false)} secondary />
              <Spacer w={10} />
              <Button
                title={busy ? t('common.loadingShort') : t('settings.changePasswordButton')}
                onPress={doChangePassword}
                disabled={busy}
              />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={rotOpen} transparent animationType="fade" onRequestClose={() => setRotOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRotOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t('settings.rotateRecoveryTitle')}</Text>
            <Text style={styles.muted}>{t('settings.rotateRecoveryHint')}</Text>
            <Spacer h={10} />
            <Input
              value={rotCurrent}
              onChangeText={setRotCurrent}
              placeholder={t('settings.currentPasswordPlaceholder')}
              secureTextEntry
            />
            <Spacer h={12} />
            <Row>
              <Button title={t('common.cancel')} onPress={() => setRotOpen(false)} secondary />
              <Spacer w={10} />
              <Button
                title={busy ? t('common.loadingShort') : t('settings.rotateRecoveryButton')}
                onPress={doRotateRecovery}
                disabled={busy}
              />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>

</ScreenContainer>
  );
};

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    content: {
      padding: 18,
    },
    muted: {
      color: theme.colors.textMuted,
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
      backgroundColor: theme.colors.bgElevated,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    pinInput: {
      height: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      backgroundColor: theme.colors.inputBg,
      paddingHorizontal: 14,
      color: theme.colors.text,
      fontSize: 18,
      letterSpacing: 8,
      textAlign: 'center',
    },
  });
