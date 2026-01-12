import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Modal, Text, TextInput, TouchableOpacity, View, StyleSheet} from 'react-native';

import {loadAppSettings, saveAppSettings, loadSecurityState, setPinHashSalt, clearPin as clearPinStorage, recordPinFailure, resetPinFailures, setSecurityBiometricsEnabled} from '../storage/sqliteStorage';
import {DEFAULT_PIN_KDF, generateSaltHex, hashPin, hashPinLegacy, isValidPin, normalizePin, type PinKdfParams} from './pin';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';

export type LockMethod = 'none' | 'pin' | 'biometrics';

type Ctx = {
  lockMethod: LockMethod;
  biometricsEnabled: boolean;
  isPinSet: boolean;
  setLockMethod: (m: LockMethod) => Promise<void>;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  requireSensitiveAuth: (reason: string) => Promise<boolean>;
};

const SecurityContext = createContext<Ctx>({
  lockMethod: 'none',
  biometricsEnabled: false,
  isPinSet: false,
  setLockMethod: async () => {},
  setBiometricsEnabled: async () => {},
  setPin: async () => {},
  clearPin: async () => {},
  requireSensitiveAuth: async () => true,
});

async function tryBiometrics(promptMessage: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RNBiometrics = require('react-native-biometrics');
    const Ctor = RNBiometrics?.default || RNBiometrics;
    if (!Ctor) return false;
    const biom = new Ctor();
    const avail = await biom.isSensorAvailable();
    const ok =
      !!avail &&
      (avail.available === true ||
        avail.available === 'true' ||
        avail.biometryType);
    if (!ok) return false;
    const res = await biom.simplePrompt({promptMessage});
    return !!res?.success;
  } catch {
    return false;
  }
}

export const SecurityProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [lockMethod, setLockMethodState] = useState<LockMethod>('none');
  const [isPinSet, setIsPinSet] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);

  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const [pinPromptReason, setPinPromptReason] = useState<string>('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLockedUntil, setPinLockedUntil] = useState<number>(0);

  const resolverRef = useRef<((v: boolean) => void) | null>(null);
  const lastUnlockAtRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      const s = await loadAppSettings();
      if (s?.lockMethod === 'pin' || s?.lockMethod === 'biometrics' || s?.lockMethod === 'none') {
        setLockMethodState(s.lockMethod);
      } else {
        setLockMethodState('none');
      }
    } catch {
      setLockMethodState('none');
    }

    try {
      const sec = await loadSecurityState();
      setIsPinSet(!!sec.pinHash && !!sec.pinSalt);
      setBiometricsEnabledState(!!sec.biometricsEnabled);
      setPinLockedUntil(Number(sec.pinLockedUntil || 0));
    } catch {
      setIsPinSet(false);
      setBiometricsEnabledState(false);
      setPinLockedUntil(0);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const setLockMethod = useCallback(async (m: LockMethod) => {
    const s = (await loadAppSettings()) || {
      nickname: 'user',
      theme: 'dark',
      lang: 'ru',
      lockMethod: 'none',
      chatsMode: 'persistent',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };
    s.lockMethod = m;
    await saveAppSettings(s as any);
    setLockMethodState(m);
  }, []);

  const setBiometricsEnabled = useCallback(async (enabled: boolean) => {
    await setSecurityBiometricsEnabled(enabled);
    setBiometricsEnabledState(enabled);
  }, []);

  const setPin = useCallback(async (pin: string) => {
    if (!isValidPin(pin)) {
      throw new Error('PIN должен быть 4–8 цифр.');
    }
    const salt = generateSaltHex(32);
    const kdfParams = DEFAULT_PIN_KDF;
    const h = hashPin(pin, salt, kdfParams);
    await setPinHashSalt(h, salt, kdfParams);
    setIsPinSet(true);
    setPinLockedUntil(0);
  }, []);

  const clearPin = useCallback(async () => {
    await clearPinStorage();
    setIsPinSet(false);
    setPinLockedUntil(0);
    if (lockMethod === 'pin') {
      await setLockMethod('none');
    }
  }, [lockMethod, setLockMethod]);

  const closePrompt = useCallback((result: boolean) => {
    setPinPromptVisible(false);
    setPinPromptReason('');
    setPinInput('');
    setPinError(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const requirePinPrompt = useCallback(async (reason: string): Promise<boolean> => {
    const sec = await loadSecurityState();
    const now = Math.floor(Date.now() / 1000);
    const lockedUntil = Number(sec.pinLockedUntil || 0);
    if (lockedUntil && lockedUntil > now) {
      setPinLockedUntil(lockedUntil);
      setPinError(`PIN временно заблокирован до ${new Date(lockedUntil * 1000).toLocaleTimeString()}.`);
      return false;
    }
    if (!sec.pinHash || !sec.pinSalt) {
      setPinError('PIN не установлен.');
      return false;
    }

    setPinPromptReason(reason);
    setPinPromptVisible(true);
    setPinError(null);
    setPinInput('');
    setPinLockedUntil(lockedUntil);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const requireSensitiveAuth = useCallback(async (reason: string): Promise<boolean> => {
    const now = Math.floor(Date.now() / 1000);
    if (lastUnlockAtRef.current && now - lastUnlockAtRef.current <= 60) {
      return true;
    }

    const s = await loadAppSettings();
    const method: LockMethod = (s?.lockMethod as any) || 'none';

    if (method === 'none') {
      return true;
    }

    if (method === 'biometrics') {
      // если пользователь выключил биометрию — не пытаемся.
      const sec = await loadSecurityState();
      const enabled = !!sec.biometricsEnabled;
      if (enabled) {
        const ok = await tryBiometrics('Подтвердите операцию');
        if (ok) {
          lastUnlockAtRef.current = now;
          return true;
        }
      }
      // fallback на PIN
      return await requirePinPrompt(reason);
    }

    // PIN
    const ok = await requirePinPrompt(reason);
    if (ok) {
      lastUnlockAtRef.current = now;
    }
    return ok;
  }, [requirePinPrompt]);

  const onPinSubmit = useCallback(async () => {
    const p = normalizePin(pinInput);
    if (!isValidPin(p)) {
      setPinError('Введите PIN (4–8 цифр).');
      return;
    }

    try {
      const sec = await loadSecurityState();
      const now = Math.floor(Date.now() / 1000);
      const lockedUntil = Number(sec.pinLockedUntil || 0);
      if (lockedUntil && lockedUntil > now) {
        setPinLockedUntil(lockedUntil);
        setPinError(`PIN временно заблокирован до ${new Date(lockedUntil * 1000).toLocaleTimeString()}.`);
        return;
      }

      if (!sec.pinHash || !sec.pinSalt) {
        setPinError('PIN не установлен.');
        return;
      }
      const kdfParams: PinKdfParams | null =
        sec.pinKdf === 'pbkdf2'
          ? {
              kdf: 'pbkdf2',
              iterations: sec.pinIters || DEFAULT_PIN_KDF.iterations,
              keyLength: sec.pinKeyLen || DEFAULT_PIN_KDF.keyLength,
              digest: 'sha256',
              memory: sec.pinMem ?? DEFAULT_PIN_KDF.memory,
            }
          : null;
      const derived = kdfParams
        ? hashPin(p, String(sec.pinSalt), kdfParams)
        : hashPinLegacy(p, String(sec.pinSalt));

      if (String(sec.pinHash) === derived) {
        await resetPinFailures();
        if (!kdfParams) {
          const newSalt = generateSaltHex(32);
          const newHash = hashPin(p, newSalt, DEFAULT_PIN_KDF);
          await setPinHashSalt(newHash, newSalt, DEFAULT_PIN_KDF);
        }
        lastUnlockAtRef.current = now;
        closePrompt(true);
        return;
      }

      const r = await recordPinFailure(5, 300);
      if (r.lockedUntil && r.lockedUntil > now) {
        setPinLockedUntil(r.lockedUntil);
        setPinError(`Слишком много попыток. Заблокировано до ${new Date(r.lockedUntil * 1000).toLocaleTimeString()}.`);
      } else {
        setPinError('Неверный PIN.');
      }
    } catch {
      setPinError('Не удалось проверить PIN.');
    }
  }, [pinInput, closePrompt]);

  const ctx: Ctx = useMemo(() => {
    return {
      lockMethod,
      biometricsEnabled,
      isPinSet,
      setLockMethod,
      setBiometricsEnabled,
      setPin,
      clearPin,
      requireSensitiveAuth,
    };
  }, [lockMethod, biometricsEnabled, isPinSet, setLockMethod, setBiometricsEnabled, setPin, clearPin, requireSensitiveAuth]);

  return (
    <SecurityContext.Provider value={ctx}>
      {children}

      <Modal visible={pinPromptVisible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Подтвердите операцию</Text>
            <Text style={styles.subtitle}>{pinPromptReason || 'Введите PIN'}</Text>

            {!!pinLockedUntil ? (
              <Text style={styles.error}>
                PIN заблокирован до {new Date(pinLockedUntil * 1000).toLocaleTimeString()}.
              </Text>
            ) : null}

            <TextInput
              value={pinInput}
              onChangeText={(v) => setPinInput(v.replace(/[^0-9]/g, '').slice(0, 8))}
              placeholder="PIN (4–8 цифр)"
              keyboardType="number-pad"
              secureTextEntry
              style={styles.input}
              placeholderTextColor={t.colors.placeholder}
              autoFocus
            />

            {pinError ? <Text style={styles.error}>{pinError}</Text> : null}

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost, styles.btnSpacer]} onPress={() => closePrompt(false)}>
                <Text style={styles.btnGhostText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onPinSubmit}>
                <Text style={styles.btnPrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SecurityContext.Provider>
  );
};

export function useSecurity(): Ctx {
  return useContext(SecurityContext);
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 18,
      backgroundColor: t.colors.card,
      padding: 18,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: t.colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      color: t.colors.textMuted,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBg,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.colors.text,
      marginBottom: 10,
    },
    error: {
      color: t.colors.danger,
      marginBottom: 10,
      fontSize: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    btnSpacer: {
      marginRight: 10,
    },
    btn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
    },
    btnGhost: {
      backgroundColor: t.colors.ghostBg,
    },
    btnPrimary: {
      backgroundColor: t.colors.primary,
    },
    btnGhostText: {
      color: t.colors.text,
      fontWeight: '600',
    },
    btnPrimaryText: {
      color: t.colors.onPrimary,
      fontWeight: '800',
    },
  });
