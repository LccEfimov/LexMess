/* eslint-disable @typescript-eslint/no-var-requires */

// Простые утилиты для PIN. Используем KDF (PBKDF2) и криптографическую соль.
// Это не замена аппаратному хранилищу, но лучше, чем хранить PIN в открытую.

import 'react-native-get-random-values';

export function generateSaltHex(len: number = 16): string {
  const bytesLength = Math.ceil(len / 2);
  const bytes = new Uint8Array(bytesLength);
  const cryptoObj = (global as any).crypto as
    | {getRandomValues?: (values: Uint8Array) => void}
    | undefined;
  if (!cryptoObj?.getRandomValues) {
    throw new Error('Secure random generator is not available');
  }
  cryptoObj.getRandomValues(bytes);
  return bytesToHex(bytes).slice(0, len);
}

export function normalizePin(pin: string): string {
  return String(pin || '').trim();
}

export function isValidPin(pin: string): boolean {
  const p = normalizePin(pin);
  if (p.length < 4 || p.length > 8) return false;
  return /^[0-9]+$/.test(p);
}

export type PinKdfParams = {
  kdf: 'pbkdf2';
  iterations: number;
  keyLength: number;
  digest: 'sha256';
  memory?: number;
};

export const DEFAULT_PIN_KDF: PinKdfParams = {
  kdf: 'pbkdf2',
  iterations: 200_000,
  keyLength: 32,
  digest: 'sha256',
  memory: 0,
};

function bytesToHex(bytes: ArrayBufferView): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const len = normalized.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = parseInt(normalized.substr(i * 2, 2), 16);
  }
  return out;
}

export function hashPin(pin: string, saltHex: string, params: PinKdfParams = DEFAULT_PIN_KDF): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const QuickCrypto = require('react-native-quick-crypto');
  if (params.kdf !== 'pbkdf2') {
    throw new Error(`Unsupported KDF: ${params.kdf}`);
  }
  const derived = QuickCrypto.pbkdf2Sync(
    normalizePin(pin),
    hexToBytes(saltHex),
    params.iterations,
    params.keyLength,
    params.digest,
  );
  return bytesToHex(derived);
}

export function hashPinLegacy(pin: string, saltHex: string): string {
  const sha = require('js-sha256');
  const fn = sha.sha256 || (sha.default && sha.default.sha256) || sha;
  return fn(`${saltHex}:${normalizePin(pin)}`);
}
