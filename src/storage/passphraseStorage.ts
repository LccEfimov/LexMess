import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const STORAGE_KEY = 'lexmess_device_passphrase_v1';
const SERVICE = 'lexmess_device_passphrase_v1';

/**
 * Получить (или сгенерировать) уникальную passphrase для шифрования локальной БД и контейнеров.
 */
export async function getDevicePassphrase() {
  try {
    const res = await Keychain.getGenericPassword({service: SERVICE});
    if (res && typeof res.password === 'string' && res.password.length > 0) {
      return res.password;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[passphraseStorage] getDevicePassphrase keychain read failed', e);
  }

  try {
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    if (legacy && legacy.length > 0) {
      try {
        await Keychain.setGenericPassword('passphrase', legacy, {service: SERVICE});
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[passphraseStorage] getDevicePassphrase keychain migrate failed', e);
        return legacy;
      }
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[passphraseStorage] getDevicePassphrase legacy cleanup failed', e);
      }
      return legacy;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[passphraseStorage] getDevicePassphrase legacy read failed', e);
  }

  // Минимально случайная строка; при желании можно заменить на криптостойкий генератор.
  const random = Array.from({length: 64})
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('');

  try {
    await Keychain.setGenericPassword('passphrase', random, {service: SERVICE});
    return random;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[passphraseStorage] getDevicePassphrase keychain write failed', e);
    throw new Error('Failed to persist device passphrase in Keychain');
  }
}
