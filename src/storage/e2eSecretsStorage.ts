import {getDatabase} from './sqliteStorage';
import {getDevicePassphrase} from './passphraseStorage';
import {secretboxDecryptJson, secretboxEncryptJson} from '../crypto/e2eIdentity';

export type StoredE2ESecrets = {
  userId: string;
  identityKeysJson: string;
  secretsCipherB64: string;
  secretsNonceB64: string;
  updatedAt: number;
};

export async function saveE2ESecrets(params: {
  userId: string;
  identityKeysJson: string;
  secrets: any;
}): Promise<void> {
  const db = await getDatabase();
  const pass = await getDevicePassphrase();
  const enc = secretboxEncryptJson(pass, params.secrets);
  const now = Date.now();

  await db.executeSql(
    `INSERT OR REPLACE INTO e2e_secretbox (id, user_id, identity_keys_json, secrets_cipher_b64, secrets_nonce_b64, created_at, updated_at)
     VALUES (1, ?, ?, ?, ?, COALESCE((SELECT created_at FROM e2e_secretbox WHERE id=1), ?), ?);`,
    [
      params.userId,
      params.identityKeysJson,
      enc.cipherB64,
      enc.nonceB64,
      now,
      now,
    ],
  );
}

export async function loadE2ESecrets(): Promise<any | null> {
  const db = await getDatabase();
  const [res] = await db.executeSql(
    'SELECT user_id, identity_keys_json, secrets_cipher_b64, secrets_nonce_b64 FROM e2e_secretbox WHERE id = 1 LIMIT 1;',
  );
  if (res.rows.length === 0) {
    return null;
  }
  const row = res.rows.item(0);
  const pass = await getDevicePassphrase();
  return {
    userId: row.user_id,
    identityKeysJson: row.identity_keys_json,
    secrets: secretboxDecryptJson(pass, row.secrets_cipher_b64, row.secrets_nonce_b64),
  };
}
