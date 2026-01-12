
import {useCallback} from 'react';
import {Buffer} from 'buffer';
import LexmessCore from '../native/LexmessCore';
import {saveMediaBinaryToFile} from '../storage/mediaStorage';
import {getDevicePassphrase} from '../storage/passphraseStorage';

/**
 * RoomCryptoConfig:
 * {
 *   roomId: string,
 *   containerType: 'PNG_2D',
 *   templateId: number,    // 0..19
 *   slotId: number,        // 0..19
 *   payloadFormat: 'PNG',
 * }
 */

// Имя БД — то же самое, что и в sqliteStorage / native SqliteStorage.
const DB_NAME = 'lexmess_client.db';

export function useCryptoEngine(roomConfig) {
  /**
   * Шифрование текста → *.lcc
   * Возвращаем:
   *   { lcc: Uint8Array, meta: EncryptResult }
   */
  const encryptText = useCallback(
    async (text, peerId = 'peer', roomIdOverride) => {
      const plainBuf = Buffer.from(text, 'utf8');

      const res = await LexmessCore.encryptLcc({
        dbName: DB_NAME,
        passphrase: await getDevicePassphrase(),
        roomId: roomIdOverride || roomConfig.roomId,
        peerId,
        plaintextBase64: plainBuf.toString('base64'),
        messageType: 0, // 0 = text
      });

      const lccBytes = Buffer.from(res.messageBase64, 'base64');
      return {lcc: lccBytes, meta: res};
    },
    [roomConfig],
  );

  /**
   * Дешифрование текста из *.lcc (base64).
   * Здесь предполагается, что стего‑движок уже вытащил lcc‑байты.
   */
  const decryptText = useCallback(
    async (lccBytes, peerId = 'peer', messageType = 0, roomIdOverride) => {
      const lccBase64 = Buffer.from(lccBytes).toString('base64');

      const plainBase64 = await LexmessCore.decryptLcc({
        dbName: DB_NAME,
        passphrase: await getDevicePassphrase(),
        roomId: roomIdOverride || roomConfig.roomId,
        peerId,
        messageBase64: lccBase64,
        messageType,
      });

      const buf = Buffer.from(plainBase64, 'base64');
      return buf.toString('utf8');
    },
    [roomConfig],
  );

  /**
   * Шифрование произвольного бинарного файла (фото/видео/аудио/документы) → *.lcc
   * filePath — путь к локальному файлу.
   *
   * messageType:
   *   1 — произвольный файл
   *   2 — аудио
   *   3 — видео
   */
  const encryptFile = useCallback(
    async (filePath, peerId = 'peer', messageType = 1, roomIdOverride) => {
      if (!filePath) {
        throw new Error('filePath is required for encryptFile');
      }

      const res = await LexmessCore.encryptLcc({
        dbName: DB_NAME,
        passphrase: await getDevicePassphrase(),
        roomId: roomIdOverride || roomConfig.roomId,
        peerId,
        filePath: String(filePath),
        messageType,
      });

      const lccBytes = Buffer.from(res.messageBase64, 'base64');
      return {lcc: lccBytes, meta: res};
    },
    [roomConfig],
  );

  /**
   * Дешифрование бинарного файла из *.lcc и сохранение на диск.
   *
   * extension — предполагаемое расширение файла (например, 'png', 'jpg', 'mp4', 'm4a').
   * Возвращаем локальный путь к сохранённому файлу.
   */
  const decryptFile = useCallback(
    async (lccBytes, peerId = 'peer', messageType = 1, extension = 'bin', roomIdOverride) => {
      const lccBase64 = Buffer.from(lccBytes).toString('base64');

      const plainBase64 = await LexmessCore.decryptLcc({
        dbName: DB_NAME,
        passphrase: await getDevicePassphrase(),
        roomId: roomIdOverride || roomConfig.roomId,
        peerId,
        messageBase64: lccBase64,
        messageType,
      });

      const fileBuf = Buffer.from(plainBase64, 'base64');
      const path = await saveMediaBinaryToFile(
        roomConfig.roomId,
        'incoming',
        extension,
        fileBuf,
      );
      return path;
    },
    [roomConfig],
  );

  return {
    encryptText,
    decryptText,
    encryptFile,
    decryptFile,
  };
}
