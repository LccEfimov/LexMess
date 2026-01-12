import AsyncStorage from '@react-native-async-storage/async-storage';
import {saveSecureToken, loadSecureToken, clearSecureToken} from './secureTokenStorage';

const TOKEN_KEY = 'lexmess_access_token_v1';

/**
 * Сохранить access_token (JWT) после регистрации/логина.
 */
export async function saveAccessToken(token) {
  try {
    await saveSecureToken(token);
    await AsyncStorage.setItem(TOKEN_KEY, token);
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
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token || null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[authTokenStorage] getAccessToken failed', e);
    return null;
  }
}

/**
 * Очистить токен (logout).
 */
export async function clearAccessToken() {
  try {
    await clearSecureToken();
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[authTokenStorage] clearAccessToken failed', e);
  }
}
