import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lexmess_permissions_gate_shown_v1';

export async function getPermissionsGateShown(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === '1';
  } catch (e) {
    return false;
  }
}

export async function setPermissionsGateShown(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? '1' : '0');
  } catch (e) {
    // ignore
  }
}
