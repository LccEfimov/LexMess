import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingRecovery = {
  login: string;
  recoveryKey: string;
  walletAddress: string | null;
  createdAt: number;
};

const KEY = '@lexmess/pending_recovery_v1';

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
  await AsyncStorage.setItem(KEY, JSON.stringify(rec));
}

export async function loadPendingRecovery(): Promise<PendingRecovery | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const login = typeof obj.login === 'string' ? obj.login : '';
    const recoveryKey = typeof obj.recoveryKey === 'string' ? obj.recoveryKey : '';
    const walletAddress =
      typeof obj.walletAddress === 'string' ? obj.walletAddress : null;
    const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : 0;
    if (!login || !recoveryKey) return null;
    return {login, recoveryKey, walletAddress, createdAt};
  } catch (e) {
    return null;
  }
}

export async function clearPendingRecovery(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
