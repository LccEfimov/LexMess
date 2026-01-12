import * as Keychain from 'react-native-keychain';
import {logger} from '../utils/logger';

const SERVICE = 'lexmess_auth_v1';

export async function saveSecureToken(token: string): Promise<void> {
  try {
    await Keychain.setGenericPassword('token', token, {service: SERVICE});
  } catch (e) {
    logger.warn('secureTokenStorage', 'save failed', {error: e});
  }
}

export async function loadSecureToken(): Promise<string | null> {
  try {
    const res = await Keychain.getGenericPassword({service: SERVICE});
    if (res && typeof res.password === 'string') return res.password;
  } catch (e) {
    logger.warn('secureTokenStorage', 'load failed', {error: e});
  }
  return null;
}

export async function clearSecureToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: SERVICE});
  } catch (e) {
    logger.warn('secureTokenStorage', 'clear failed', {error: e});
  }
}
