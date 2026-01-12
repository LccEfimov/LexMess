import AsyncStorage from '@react-native-async-storage/async-storage';
import {normalizeThemeName, type ThemeName} from '../theme/themes';

const K_THEME_NAME = 'theme_name_v1';

export async function loadThemePreference(): Promise<ThemeName | null> {
  try {
    const v = await AsyncStorage.getItem(K_THEME_NAME);
    if (!v) return null;
    return normalizeThemeName(v);
  } catch (e) {
    return null;
  }
}

export async function saveThemePreference(name: ThemeName | string): Promise<void> {
  try {
    const id = normalizeThemeName(name);
    await AsyncStorage.setItem(K_THEME_NAME, id);
  } catch (e) {
    // ignore
  }
}

export async function clearThemePreference(): Promise<void> {
  try {
    await AsyncStorage.removeItem(K_THEME_NAME);
  } catch (e) {
    // ignore
  }
}
