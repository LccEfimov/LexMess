import {useCallback} from 'react';
import {Buffer} from 'buffer';
import LexmessCore from '../native/LexmessCore';
import {logger} from '../utils/logger';

export type RoomStegoConfig = {
  roomId: string;
  containerType?: 'PNG_2D' | 'PNG';
  templateId?: number; // 0..19
  slotId?: number; // 0..19
  payloadFormat?: 'PNG';
};

/**
 * Формат контейнера (LXMSTEG1):
 *   [8 bytes]  magic: "LXMSTEG1"
 *   [1 byte ]  containerType
 *   [1 byte ]  payloadFormat
 *   [1 byte ]  templateId
 *   [1 byte ]  slotId
 *   [4 bytes]  payloadLength (BE)
 *   [N bytes]  payload (raw .lcc bytes)
 */
const MAGIC = 'LXMSTEG1';

function containerTypeToByte(t: string): number {
  // Сейчас поддерживаем только PNG-контейнеры на уровне клиента.
  switch (t) {
    case 'PNG_2D':
    case 'PNG':
    default:
      return 0x01;
  }
}

function byteToContainerType(_b: number): 'PNG_2D' {
  // Любое значение трактуем как PNG_2D (нормализовано на сервере).
  return 'PNG_2D';
}

function payloadFormatToByte(f: string): number {
  // В клиенте используем только формат PNG.
  switch (f) {
    case 'PNG':
    default:
      return 0x01;
  }
}

function byteToPayloadFormat(_b: number): 'PNG' {
  return 'PNG';
}

export function detectStegoMode(roomConfig?: RoomStegoConfig | null): 'LCC_ONLY' {
  if (!roomConfig || !roomConfig.roomId) {
    return 'LCC_ONLY';
  }
  return 'LCC_ONLY';
}

export function useStegoEngine(roomConfig?: RoomStegoConfig | null) {
  const embedLccIntoContainer = useCallback(
    async (lccBytes: Uint8Array | Buffer) => {
      if (!lccBytes) {
        throw new Error('embedLccIntoContainer: empty lccBytes');
      }

      const payload = lccBytes instanceof Buffer ? lccBytes : Buffer.from(lccBytes);

      const containerType: 'PNG_2D' | 'PNG' =
        (roomConfig?.containerType as any) && roomConfig?.containerType !== ''
          ? (roomConfig.containerType as any)
          : 'PNG_2D';
      const payloadFormat: 'PNG' =
        (roomConfig?.payloadFormat as any) && roomConfig?.payloadFormat !== ''
          ? (roomConfig.payloadFormat as any)
          : 'PNG';

      const containerTypeByte = containerTypeToByte(containerType);
      const payloadFormatByte = payloadFormatToByte(payloadFormat);
      const templateId = typeof roomConfig?.templateId === 'number' ? roomConfig.templateId & 0xff : 0;
      const slotId = typeof roomConfig?.slotId === 'number' ? roomConfig.slotId & 0xff : 0;

      const header = Buffer.alloc(8 + 1 + 1 + 1 + 1 + 4);
      header.write(MAGIC, 0, 'ascii');
      header.writeUInt8(containerTypeByte, 8);
      header.writeUInt8(payloadFormatByte, 9);
      header.writeUInt8(templateId, 10);
      header.writeUInt8(slotId, 11);
      header.writeUInt32BE(payload.length, 12);

      const containerBuf = Buffer.concat([header, payload]);

      // Для PNG-комнат дополнительно заворачиваем контейнер в реальный PNG на нативном слое.
      if (containerType === 'PNG_2D') {
        const pngBase64 = await LexmessCore.embedContainerInPng({
          containerBase64: containerBuf.toString('base64'),
        });
        return Buffer.from(pngBase64, 'base64');
      }

      return containerBuf;
    },
    [roomConfig],
  );

  const extractLccFromContainer = useCallback(
    async (containerBytes: Uint8Array | Buffer) => {
      if (!containerBytes) {
        throw new Error('extractLccFromContainer: empty containerBytes');
      }

      let buf = containerBytes instanceof Buffer ? containerBytes : Buffer.from(containerBytes);

      // Если это PNG — сперва выпотрошим его на нативном уровне, чтобы получить LXMSTEG1-контейнер.
      const isPng =
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a;

      if (isPng) {
        const containerBase64 = await LexmessCore.extractContainerFromPng({
          pngBase64: buf.toString('base64'),
        });
        buf = Buffer.from(containerBase64, 'base64');
      }

      if (buf.length < 8 + 1 + 1 + 1 + 1 + 4) {
        throw new Error('extractLccFromContainer: container too small');
      }

      const magic = buf.toString('ascii', 0, 8);
      if (magic !== MAGIC) {
        // На случай старых контейнеров или тестов — трактуем как raw lcc.
        return buf;
      }

      const containerTypeByte = buf.readUInt8(8);
      const payloadFormatByte = buf.readUInt8(9);
      const templateIdByte = buf.readUInt8(10);
      const slotIdByte = buf.readUInt8(11);
      const payloadLen = buf.readUInt32BE(12);

      if (8 + 1 + 1 + 1 + 1 + 4 + payloadLen > buf.length) {
        throw new Error('extractLccFromContainer: invalid payload length');
      }

      // Проверка соответствия конфигу комнаты.
      if (roomConfig) {
        const expectedType = roomConfig.containerType || 'PNG_2D';
        const expectedFormat = roomConfig.payloadFormat || 'PNG';
        const expectedTemplate = typeof roomConfig.templateId === 'number' ? roomConfig.templateId & 0xff : 0;
        const expectedSlot = typeof roomConfig.slotId === 'number' ? roomConfig.slotId & 0xff : 0;

        const actualType = byteToContainerType(containerTypeByte);
        const actualFormat = byteToPayloadFormat(payloadFormatByte);

        const typeMismatch = actualType !== expectedType;
        const formatMismatch = actualFormat !== expectedFormat;
        const templateMismatch = templateIdByte !== expectedTemplate;
        const slotMismatch = slotIdByte !== expectedSlot;

        if (typeMismatch || formatMismatch || templateMismatch || slotMismatch) {
          logger.warn('useStegoEngine', 'roomConfig mismatch - dropping container', {
            data: {
              expectedType,
              actualType,
              expectedFormat,
              actualFormat,
              expectedTemplate,
              actualTemplate: templateIdByte,
              expectedSlot,
              actualSlot: slotIdByte,
            },
          });
          throw new Error('extractLccFromContainer: container not for this room');
        }
      }

      const payload = buf.slice(8 + 1 + 1 + 1 + 1 + 4, 8 + 1 + 1 + 1 + 1 + 4 + payloadLen);
      return payload;
    },
    [roomConfig],
  );

  return {
    embedLccIntoContainer,
    extractLccFromContainer,
  };
}
