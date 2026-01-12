import AsyncStorage from '@react-native-async-storage/async-storage';
import {saveSecureToken, loadSecureToken, clearSecureToken} from './secureTokenStorage';

const TOKEN_KEY = 'lexmess_access_token_v1';

/**
 * Сохранить access_token (JWT) после регистрации/логина.
 */
export async function saveAccessToken(token) {
  try {
    await saveSecureToken(token);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[authTokenStorage] saveAccessToken failed', e);
  }
}

/**
 * Получить текущий access_token.
 */
export async function getAccessToken() {
  try {
    const secureToken = await loadSecureToken();
    if (secureToken) return secureToken;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[authTokenStorage] getAccessToken secure load failed', e);
  }

  try {
    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (!legacyToken) return null;
    try {
      await saveSecureToken(legacyToken);
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[authTokenStorage] getAccessToken migration failed', e);
      return legacyToken;
    }
    return legacyToken;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[authTokenStorage] getAccessToken legacy load failed', e);
    return null;
  }
}

/**
 * Очистить токен (logout).
 */
export async function clearAccessToken() {
  try {
    await clearSecureToken();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[authTokenStorage] clearAccessToken failed', e);
  }

  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[authTokenStorage] clearAccessToken legacy cleanup failed', e);
  }
}
