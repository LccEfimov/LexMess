import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {Buffer} from 'buffer';

/**
 * Базовая директория для сохранения медиа.
 *
 * ВАЖНО для Android 12+:
 * - писать в DownloadDirectoryPath без MediaStore/SAF обычно нельзя (Scoped Storage).
 * - поэтому по умолчанию сохраняем во внутренний DocumentDirectoryPath (без дополнительных разрешений).
 */
function getBaseMediaDir(): string {
  if (Platform.OS === 'android') {
    return RNFS.DocumentDirectoryPath;
  }
  return RNFS.DocumentDirectoryPath;
}

function normalizeExtension(extOrName: string | null | undefined): string {
  const s = String(extOrName || '').trim();
  if (!s) {
    return 'bin';
  }
  const dot = s.lastIndexOf('.');
  let ext = dot >= 0 ? s.slice(dot + 1) : s;
  ext = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (!ext) {
    return 'bin';
  }
  return ext;
}

function buildMediaPath(
  roomId: string,
  kind: 'incoming' | 'outgoing',
  extension: string,
): string {
  const base = getBaseMediaDir();
  const safeRoom = String(roomId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ts = Date.now();
  const ext = normalizeExtension(extension);
  return `${base}/lexmess_${safeRoom}_${kind}_${ts}.${ext}`;
}

async function safeUnlink(path: string): Promise<void> {
  try {
    if (path && (await RNFS.exists(path))) {
      await RNFS.unlink(path);
    }
  } catch {
    // ignore
  }
}

/**
 * Сохранить бинарные данные медиа в файл и вернуть путь.
 * data может быть Uint8Array, Buffer или base64-строкой.
 */
export async function saveMediaBinaryToFile(
  roomId: string,
  kind: 'incoming' | 'outgoing',
  extension: string,
  data: Uint8Array | Buffer | string,
): Promise<string> {
  let buf: Buffer;
  if (typeof data === 'string') {
    buf = Buffer.from(data, 'base64');
  } else if (data instanceof Buffer) {
    buf = data;
  } else {
    buf = Buffer.from(data);
  }

  const path = buildMediaPath(roomId, kind, extension);
  await RNFS.writeFile(path, buf.toString('base64'), 'base64');
  return path;
}

export type ImportedMedia = {
  path: string;
  size: number;
  extension: string;
};

/**
 * Импортировать внешний URI (file://, content://, и т.п.) во внутреннее хранилище приложения.
 *
 * Это нужно для стабильности:
 * - кэш/временные файлы от picker'ов могут исчезнуть;
 * - retry очереди отправки должен всегда иметь доступ к файлу.
 *
 * Возвращает {path, size, extension}.
 */
export async function importMediaFromUriToLocalFile(
  roomId: string,
  kind: 'incoming' | 'outgoing',
  uri: string,
  nameOrExt?: string | null,
): Promise<ImportedMedia> {
  const srcUri = String(uri || '').trim();
  if (!srcUri) {
    throw new Error('empty_uri');
  }

  const extension = normalizeExtension(nameOrExt || srcUri);
  const dstPath = buildMediaPath(roomId, kind, extension);

  // Попытка 1: прямое копирование для обычных file paths
  let copied = false;
  try {
    let srcPath = srcUri;
    if (srcPath.startsWith('file://')) {
      srcPath = srcPath.replace('file://', '');
    }
    if (srcPath.startsWith('/') && (await RNFS.exists(srcPath))) {
      await RNFS.copyFile(srcPath, dstPath);
      copied = true;
    }
  } catch {
    copied = false;
  }

  // Попытка 2: читаем через RNFS (часто умеет content:// на Android) и пишем base64
  if (!copied) {
    try {
      const b64 = await RNFS.readFile(srcUri, 'base64');
      await RNFS.writeFile(dstPath, b64, 'base64');
      copied = true;
    } catch (e) {
      await safeUnlink(dstPath);
      throw e;
    }
  }

  const st = await RNFS.stat(dstPath);
  const size = Number(st?.size || 0);
  return {path: dstPath, size: Number.isFinite(size) ? size : 0, extension};
}
