/* eslint-disable @typescript-eslint/no-var-requires */

// Простые утилиты для PIN. Хэшируем sha256(salt + ':' + pin).
// Это не замена аппаратному хранилищу, но лучше, чем хранить PIN в открытую.

export function generateSaltHex(len: number = 16): string {
  const out = Array.from({length: len})
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('');
  return out;
}

export function normalizePin(pin: string): string {
  return String(pin || '').trim();
}

export function isValidPin(pin: string): boolean {
  const p = normalizePin(pin);
  if (p.length < 4 || p.length > 8) return false;
  return /^[0-9]+$/.test(p);
}

export function hashPin(pin: string, saltHex: string): string {
  const sha = require('js-sha256');
  const fn = sha.sha256 || (sha.default && sha.default.sha256) || sha;
  return fn(`${saltHex}:${normalizePin(pin)}`);
}
