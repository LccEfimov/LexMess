import * as Keychain from 'react-native-keychain';

const SERVICE = 'lexmess_auth_v1';

export async function saveSecureToken(token: string): Promise<void> {
  try {
    await Keychain.setGenericPassword('token', token, {service: SERVICE});
  } catch (e) {
    console.warn('[secureTokenStorage] save failed', e);
  }
}

export async function loadSecureToken(): Promise<string | null> {
  try {
    const res = await Keychain.getGenericPassword({service: SERVICE});
    if (res && typeof res.password === 'string') return res.password;
  } catch (e) {
    console.warn('[secureTokenStorage] load failed', e);
  }
  return null;
}

export async function clearSecureToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: SERVICE});
  } catch (e) {
    console.warn('[secureTokenStorage] clear failed', e);
  }
}
