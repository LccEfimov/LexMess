import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

export type PendingRecovery = {
  login: string;
  recoveryKey: string;
  walletAddress: string | null;
  createdAt: number;
};

const KEY = '@lexmess/pending_recovery_v1';
const SERVICE = 'lexmess_pending_recovery_v1';

export async function savePendingRecovery(p: {
  login: string;
  recoveryKey: string;
  walletAddress?: string | null;
}): Promise<void> {
  const rec: PendingRecovery = {
    login: (p.login || '').trim(),
    recoveryKey: String(p.recoveryKey || ''),
    walletAddress:
      p.walletAddress !== undefined ? (p.walletAddress || null) : null,
    createdAt: Date.now(),
  };
  try {
    await Keychain.setGenericPassword('pending_recovery', JSON.stringify(rec), {
      service: SERVICE,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pendingRecoveryStorage] save failed', e);
  }
}

export async function loadPendingRecovery(): Promise<PendingRecovery | null> {
  try {
    const res = await Keychain.getGenericPassword({service: SERVICE});
    if (res && typeof res.password === 'string' && res.password.length > 0) {
      const obj = JSON.parse(res.password);
      if (!obj || typeof obj !== 'object') return null;
      const login = typeof obj.login === 'string' ? obj.login : '';
      const recoveryKey =
        typeof obj.recoveryKey === 'string' ? obj.recoveryKey : '';
      const walletAddress =
        typeof obj.walletAddress === 'string' ? obj.walletAddress : null;
      const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : 0;
      if (!login || !recoveryKey) return null;
      return {login, recoveryKey, walletAddress, createdAt};
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pendingRecoveryStorage] load failed', e);
  }

  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const login = typeof obj.login === 'string' ? obj.login : '';
    const recoveryKey = typeof obj.recoveryKey === 'string' ? obj.recoveryKey : '';
    const walletAddress =
      typeof obj.walletAddress === 'string' ? obj.walletAddress : null;
    const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : 0;
    if (!login || !recoveryKey) return null;
    try {
      await Keychain.setGenericPassword('pending_recovery', raw, {
        service: SERVICE,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[pendingRecoveryStorage] migration save failed', e);
      return {login, recoveryKey, walletAddress, createdAt};
    }
    try {
      await AsyncStorage.removeItem(KEY);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[pendingRecoveryStorage] legacy cleanup failed', e);
    }
    return {login, recoveryKey, walletAddress, createdAt};
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pendingRecoveryStorage] legacy load failed', e);
    return null;
  }
}

export async function clearPendingRecovery(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: SERVICE});
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pendingRecoveryStorage] clear failed', e);
  }
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pendingRecoveryStorage] legacy clear failed', e);
  }
}
