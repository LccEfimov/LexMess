import {ensureSchema, getDatabase} from './sqliteStorage';

export type LocalAccount = {
  login: string | null;
  displayName: string | null;
  walletAddress: string | null;
  recoveryShown: boolean;
  createdAt: number;
  updatedAt: number;
};

export async function loadLocalAccount(): Promise<LocalAccount | null> {
  await ensureSchema();
  const db = await getDatabase();
  const [res] = await db.executeSql(
    'SELECT * FROM local_account WHERE id = 1 LIMIT 1;',
  );
  if (res.rows.length === 0) {
    return null;
  }
  const row = res.rows.item(0);
  return {
    login: row.login || null,
    displayName: row.display_name || null,
    walletAddress: row.wallet_address || null,
    recoveryShown: (row.recovery_shown || 0) === 1,
    createdAt: row.created_at || Date.now(),
    updatedAt: row.updated_at || Date.now(),
  };
}

export async function saveLocalAccount(params: {
  login?: string | null;
  displayName?: string | null;
  walletAddress?: string | null;
  recoveryShown?: boolean;
}): Promise<void> {
  await ensureSchema();
  const db = await getDatabase();
  const now = Date.now();

  const existing = await loadLocalAccount();
  const createdAt = existing?.createdAt || now;

  const login = params.login !== undefined ? params.login : existing?.login || null;
  const displayName =
    params.displayName !== undefined
      ? params.displayName
      : existing?.displayName || null;
  const walletAddress =
    params.walletAddress !== undefined
      ? params.walletAddress
      : existing?.walletAddress || null;
  const recoveryShown =
    params.recoveryShown !== undefined
      ? params.recoveryShown
      : existing?.recoveryShown || false;

  await db.executeSql(
    `
    INSERT OR REPLACE INTO local_account
      (id, login, display_name, wallet_address, recovery_shown, created_at, updated_at)
    VALUES
      (1, ?, ?, ?, ?, ?, ?);
    `,
    [login, displayName, walletAddress, recoveryShown ? 1 : 0, createdAt, now],
  );
}

export async function clearLocalAccount(): Promise<void> {
  await ensureSchema();
  const db = await getDatabase();
  await db.executeSql('DELETE FROM local_account WHERE id = 1;');
}

export async function markRecoveryShown(): Promise<void> {
  await saveLocalAccount({recoveryShown: true});
}
