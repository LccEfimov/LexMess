import {PermissionsAndroid, Platform} from 'react-native';

export type RuntimePermissionCheck = {
  ok: boolean;
  granted: string[];
  missing: string[];
};

export function getRequiredRuntimePermissions(): string[] {
  const v = typeof Platform.Version === 'number' ? Platform.Version : 0;

  const base: string[] = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];

  // Bluetooth connect is runtime начиная с Android 12 (API 31)
  if (v >= 31) {
    base.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  }

  // Уведомления: runtime начиная с Android 13 (API 33)
  if (v >= 33) {
    base.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  // Медиа/файлы: Android 13+ использует READ_MEDIA_*, более старые — READ_EXTERNAL_STORAGE
  if (v >= 33) {
    base.push(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
    );
  } else {
    base.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
  }

  // Убираем дубли
  return Array.from(new Set(base));
}

export async function checkRequiredRuntimePermissions(): Promise<RuntimePermissionCheck> {
  if (Platform.OS !== 'android') {
    return {ok: true, granted: [], missing: []};
  }

  const required = getRequiredRuntimePermissions();
  const granted: string[] = [];
  const missing: string[] = [];

  for (const p of required) {
    try {
      const ok = await PermissionsAndroid.check(p);
      if (ok) {
        granted.push(p);
      } else {
        missing.push(p);
      }
    } catch (e) {
      missing.push(p);
    }
  }

  return {
    ok: missing.length === 0,
    granted,
    missing,
  };
}

export async function requestRequiredRuntimePermissions(): Promise<RuntimePermissionCheck> {
  if (Platform.OS !== 'android') {
    return {ok: true, granted: [], missing: []};
  }

  const required = getRequiredRuntimePermissions();

  try {
    const result = await PermissionsAndroid.requestMultiple(required);
    const granted: string[] = [];
    const missing: string[] = [];

    for (const p of required) {
      const r = result[p];
      if (r === PermissionsAndroid.RESULTS.GRANTED) {
        granted.push(p);
      } else {
        missing.push(p);
      }
    }

    return {ok: missing.length === 0, granted, missing};
  } catch (e) {
    return checkRequiredRuntimePermissions();
  }
}

export function humanizePermission(p: string): string {
  switch (p) {
    case PermissionsAndroid.PERMISSIONS.CAMERA:
      return 'Камера (скрытые PNG и фото)';
    case PermissionsAndroid.PERMISSIONS.RECORD_AUDIO:
      return 'Микрофон (голосовые/звонки)';
    case PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS:
      return 'Уведомления';
    case PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT:
      return 'Bluetooth (гарнитуры/аудио)';
    case PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES:
      return 'Доступ к изображениям';
    case PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO:
      return 'Доступ к видео';
    case PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO:
      return 'Доступ к аудио';
    case PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE:
      return 'Доступ к файлам (хранилище)';
    default:
      return p;
  }
}
