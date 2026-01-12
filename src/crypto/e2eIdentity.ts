import nacl from 'tweetnacl';
import {Buffer} from 'buffer';

export type E2EIdentityBundle = {
  identityKeysJson: string;
  signatureB64: string;
  oneTimeKeysJson: string;
  // Secrets (base64)
  ed25519SkB64: string;
  curve25519SkB64: string;
  // Public (base64)
  ed25519PkB64: string;
  curve25519PkB64: string;
  oneTimeSkMapB64: Record<string, string>; // id -> secretKeyB64
};

function b64(u8: Uint8Array): string {
  return Buffer.from(u8).toString('base64');
}

function randomId(prefix: string): string {
  const rnd = nacl.randomBytes(8);
  return `${prefix}_${Date.now()}_${b64(rnd).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
}

/**
 * Генерируем identity-ключи:
 *  - ed25519 (подпись)
 *  - curve25519 (шифрование)
 * И формируем signature = ed25519_detached(identityKeysJson).
 */
export function generateE2EIdentityBundle(oneTimeCount = 20): E2EIdentityBundle {
  const signKp = nacl.sign.keyPair();
  const boxKp = nacl.box.keyPair();

  const edPk = b64(signKp.publicKey);
  const cuPk = b64(boxKp.publicKey);

  // Важно: строка должна совпасть у клиента и сервера при проверке подписи.
  // Держим стабильный порядок полей.
  const identityKeysJson = JSON.stringify({curve25519: cuPk, ed25519: edPk});

  const msg = Buffer.from(identityKeysJson, 'utf8');
  const sig = nacl.sign.detached(new Uint8Array(msg), signKp.secretKey);
  const signatureB64 = b64(sig);

  const otPub: Record<string, string> = {};
  const otSk: Record<string, string> = {};

  for (let i = 0; i < Math.max(0, oneTimeCount); i++) {
    const kp = nacl.box.keyPair();
    const id = randomId('otk');
    otPub[id] = b64(kp.publicKey);
    otSk[id] = b64(kp.secretKey);
  }

  const oneTimeKeysJson = JSON.stringify({curve25519: otPub});

  return {
    identityKeysJson,
    signatureB64,
    oneTimeKeysJson,
    ed25519SkB64: b64(signKp.secretKey),
    curve25519SkB64: b64(boxKp.secretKey),
    ed25519PkB64: edPk,
    curve25519PkB64: cuPk,
    oneTimeSkMapB64: otSk,
  };
}

function deriveSecretboxKey(passphrase: string): Uint8Array {
  const passBytes = Buffer.from(passphrase, 'utf8');
  const h = nacl.hash(new Uint8Array(passBytes)); // SHA-512
  return h.slice(0, 32); // 32 bytes for secretbox
}

export function secretboxEncryptJson(
  passphrase: string,
  obj: any,
): {cipherB64: string; nonceB64: string} {
  const key = deriveSecretboxKey(passphrase);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');
  const cipher = nacl.secretbox(new Uint8Array(plain), nonce, key);
  return {cipherB64: b64(cipher), nonceB64: b64(nonce)};
}

export function secretboxDecryptJson(
  passphrase: string,
  cipherB64: string,
  nonceB64: string,
): any {
  const key = deriveSecretboxKey(passphrase);
  const cipher = Buffer.from(cipherB64, 'base64');
  const nonce = Buffer.from(nonceB64, 'base64');
  const plain = nacl.secretbox.open(new Uint8Array(cipher), new Uint8Array(nonce), key);
  if (!plain) {
    throw new Error('Failed to decrypt E2E secrets');
  }
  const jsonStr = Buffer.from(plain).toString('utf8');
  return JSON.parse(jsonStr);
}

export function secretboxEncryptText(
  passphrase: string,
  text: string,
): {cipherB64: string; nonceB64: string} {
  const key = deriveSecretboxKey(passphrase);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const plain = Buffer.from(text, 'utf8');
  const cipher = nacl.secretbox(new Uint8Array(plain), nonce, key);
  return {cipherB64: b64(cipher), nonceB64: b64(nonce)};
}

export function secretboxDecryptText(
  passphrase: string,
  cipherB64: string,
  nonceB64: string,
): string {
  const key = deriveSecretboxKey(passphrase);
  const cipher = Buffer.from(cipherB64, 'base64');
  const nonce = Buffer.from(nonceB64, 'base64');
  const plain = nacl.secretbox.open(new Uint8Array(cipher), new Uint8Array(nonce), key);
  if (!plain) {
    throw new Error('Failed to decrypt text payload');
  }
  return Buffer.from(plain).toString('utf8');
}
