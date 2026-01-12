import AsyncStorage from '@react-native-async-storage/async-storage';
import {saveSecureToken, loadSecureToken, clearSecureToken} from './secureTokenStorage';
import {logger} from '../utils/logger';

const TOKEN_KEY = 'lexmess_access_token_v1';

/**
 * Сохранить access_token (JWT) после регистрации/логина.
 */
export async function saveAccessToken(token) {
  try {
    await saveSecureToken(token);
  } catch (e) {
    logger.warn('authTokenStorage', 'saveAccessToken failed', {error: e});
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
    logger.warn('authTokenStorage', 'getAccessToken secure load failed', {error: e});
  }

  try {
    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (!legacyToken) return null;
    try {
      await saveSecureToken(legacyToken);
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      logger.warn('authTokenStorage', 'getAccessToken migration failed', {error: e});
      return legacyToken;
    }
    return legacyToken;
  } catch (e) {
    logger.warn('authTokenStorage', 'getAccessToken legacy load failed', {error: e});
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
    logger.warn('authTokenStorage', 'clearAccessToken failed', {error: e});
  }

  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    logger.warn('authTokenStorage', 'clearAccessToken legacy cleanup failed', {error: e});
  }
}
