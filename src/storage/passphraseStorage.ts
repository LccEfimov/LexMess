import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lexmess_device_passphrase_v1';

/**
 * Получить (или сгенерировать) уникальную passphrase для шифрования локальной БД и контейнеров.
 */
export async function getDevicePassphrase() {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[passphraseStorage] getDevicePassphrase read failed', e);
  }

  // Минимально случайная строка; при желании можно заменить на криптостойкий генератор.
  const random = Array.from({length: 64})
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('');

  try {
    await AsyncStorage.setItem(STORAGE_KEY, random);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[passphraseStorage] getDevicePassphrase write failed', e);
  }

  return random;
}
