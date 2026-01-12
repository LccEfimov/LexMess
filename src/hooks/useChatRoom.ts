import {useEffect, useState, useCallback, useRef} from 'react';
import {AppState} from 'react-native';
import {Buffer} from 'buffer';
import RNFS from 'react-native-fs';
import {importMediaFromUriToLocalFile} from '../storage/mediaStorage';
import {
  getMessagesForRoom,
  markRoomRead,
  getPendingOutgoingMessages,
  insertMessage,
  updateMessageDeliveryStatus,
  bumpOutgoingSendAttempt,
  type MessageRecord,
} from '../storage/sqliteStorage';
import {subscribeIncomingContainers} from '../bus/messageBus';
import {subscribeDelivery} from '../bus/deliveryBus';
import {
  ensureRoomConnection,
  disposeRoomConnection,
  sendRoomContainer,
  sendRoomRead,
} from '../net/wsClient';
import {logger} from '../utils/logger';
import {i18n} from '../i18n';

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

type ChatMessage = {
  id: string;
  sender: string;
  body: string;
  outgoing: boolean;
  contentType: string;
  localPath?: string | null;
  deliveryStatus?: string | null;
  ts?: number;
};

export type ChatRoomError = {
  title: string;
  message: string;
  kind: 'history' | 'sendText' | 'sendMedia' | 'fileTooLarge';
};

function safeNow(): number {
  return Date.now();
}

function statusRank(s: string | null | undefined): number {
  const v = String(s || 'local').toLowerCase();
  if (v === 'read') return 5;
  if (v === 'delivered') return 4;
  if (v === 'sent') return 3;
  if (v === 'sending') return 2;
  if (v === 'queued') return 1;
  if (v === 'failed') return -1;
  return 0; // local
}

function clampStatus(next: string): string {
  const v = String(next || '').toLowerCase();
  if (v === 'read') return 'read';
  if (v === 'delivered') return 'delivered';
  if (v === 'sent') return 'sent';
  if (v === 'sending') return 'sending';
  if (v === 'queued') return 'queued';
  if (v === 'failed') return 'failed';
  return 'local';
}

/**
 * Хук управления чатом:
 *  - поднимает историю сообщений из SQLite;
 *  - шлёт новые сообщения через WS (стего-контейнеры);
 *  - принимает контейнеры, расшифровывает и пишет в SQLite;
 *  - обрабатывает ack'и: sent/delivered/read;
 *  - держит offline outbox (retryPending) с экспоненциальным backoff.
 */
export function useChatRoom(roomId, currentUserId, cryptoEngine, stegoEngine) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastError, setLastError] = useState<ChatRoomError | null>(null);
  const [minLoadedTs, setMinLoadedTs] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const minLoadedTsRef = useRef<number | null>(null);
  const loadingOlderRef = useRef(false);
  const lastReadAckTsRef = useRef(0);
  const historyAlertedRef = useRef(false);
  const setErrorOnce = useCallback((error: ChatRoomError) => {
    setLastError(error);
  }, []);
  const clearLastError = useCallback(() => {
    setLastError(null);
  }, []);

  const sendReadAckIfNeeded = useCallback(
    async (ts: number) => {
      const v = Number(ts || 0);
      if (!v || v <= 0) return;
      if (v <= lastReadAckTsRef.current) return;
      lastReadAckTsRef.current = v;

      try {
        await markRoomRead(roomId);
      } catch {}

      // Try WS read ack (non-blocking). If socket is down, it will queue inside wsClient.
      try {
        sendRoomRead(roomId, v);
      } catch {}
    },
    [roomId],
  );

  // append (top) for inverted FlatList or latest-first UI
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [msg, ...prev]);
    if (typeof msg.ts === 'number') {
      setMinLoadedTs(prev => {
        if (prev === null || msg.ts! < prev) {
          minLoadedTsRef.current = msg.ts!;
          return msg.ts!;
        }
        return prev;
      });
    }
  }, []);

  const updateMessageStateStatus = useCallback((id: string, nextStatus: string) => {
    const next = clampStatus(nextStatus);
    setMessages(prev =>
      prev.map(m => {
        if (String(m.id) !== String(id) || !m.outgoing) return m;
        const cur = clampStatus(String(m.deliveryStatus || 'local'));
        // never downgrade status
        if (statusRank(next) < statusRank(cur)) return m;
        return {...m, deliveryStatus: next};
      }),
    );
  }, []);

  // Загрузка истории из SQLite при входе в комнату
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const historyLimit = 200;
      try {
        const rows = await getMessagesForRoom(roomId, historyLimit);
        if (cancelled) return;

        const sorted = [...rows].sort((a, b) => {
          const ta = a.ts || 0;
          const tb = b.ts || 0;
          return ta - tb;
        });

        const mapped: ChatMessage[] = sorted.map(row => ({
          id: String(row.id ?? `${row.ts}_${row.senderId}`),
          sender: row.senderId,
          body: row.body || '',
          outgoing: !!row.outgoing,
          contentType: row.contentType || 'text',
          localPath: row.localPath || null,
          deliveryStatus: row.deliveryStatus || (row.outgoing ? 'local' : 'delivered'),
          ts: row.ts || 0,
        }));

        setMessages(mapped);
        const nextMinTs =
          rows.length > 0
            ? rows.reduce((min, row) => Math.min(min, Number(row.ts || 0)), Number(rows[0]?.ts || 0))
            : null;
        minLoadedTsRef.current = nextMinTs;
        setMinLoadedTs(nextMinTs);
        setHasOlder(rows.length >= historyLimit);
      } catch (e) {
        logger.warn('useChatRoom: load history failed', e);
        if (!historyAlertedRef.current) {
          historyAlertedRef.current = true;
          setErrorOnce({
            title: i18n.t('common.error'),
            message: i18n.t('chatRoom.errors.historyLoadFailed'),
            kind: 'history',
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current) {
      return;
    }
    const beforeTs = minLoadedTsRef.current;
    if (!beforeTs || beforeTs <= 0) {
      return;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const historyLimit = 200;

    try {
      const rows = await getMessagesForRoom(roomId, historyLimit, {beforeTs});
      if (!rows || rows.length === 0) {
        setHasOlder(false);
        return;
      }

      const mapped: ChatMessage[] = rows.map(row => ({
        id: String(row.id ?? `${row.ts}_${row.senderId}`),
        sender: row.senderId,
        body: row.body || '',
        outgoing: !!row.outgoing,
        contentType: row.contentType || 'text',
        localPath: row.localPath || null,
        deliveryStatus: row.deliveryStatus || (row.outgoing ? 'local' : 'delivered'),
        ts: row.ts || 0,
      }));

      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const deduped = mapped.filter(m => !existingIds.has(m.id));
        return [...prev, ...deduped];
      });

      const nextMinTs = rows.reduce((min, row) => Math.min(min, Number(row.ts || 0)), beforeTs);
      minLoadedTsRef.current = nextMinTs;
      setMinLoadedTs(nextMinTs);
      setHasOlder(rows.length >= historyLimit);
    } catch (e) {
      logger.warn('useChatRoom: loadOlder failed', e);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [roomId]);

  // WS connection per room
  useEffect(() => {
    ensureRoomConnection({
      roomId,
      userId: currentUserId,
      nickname: currentUserId,
    });

    return () => {
      disposeRoomConnection(roomId);
    };
  }, [roomId, currentUserId]);

  const retryPending = useCallback(async () => {
    const MAX_ATTEMPTS = 10;

    try {
      const pending = await getPendingOutgoingMessages(roomId, 80);
      if (!pending || pending.length === 0) return;

      for (const row of pending) {
        const idNum = Number(row.id || 0);
        if (!idNum || idNum <= 0) continue;

        const status = clampStatus(String(row.deliveryStatus || 'local'));
        if (status === 'delivered' || status === 'read') continue;
        if (status === 'failed') continue;

        const attempts = Number(row.sendAttempts || 0);
        const lastTs = Number(row.lastSendTs || 0);

        if (attempts >= MAX_ATTEMPTS) {
          await updateMessageDeliveryStatus(idNum, 'failed');
          updateMessageStateStatus(String(idNum), 'failed');
          continue;
        }

        const backoff = Math.min(30000, 1000 * Math.pow(2, Math.max(0, attempts)));
        if (lastTs > 0 && Date.now() - lastTs < backoff) {
          continue;
        }

        try {
          const contentType = String(row.contentType || 'text');

          if (contentType === 'text') {
            const body = (row.body || '').trim();
            if (!body) {
              await bumpOutgoingSendAttempt(idNum, 'failed', 'empty_text');
              updateMessageStateStatus(String(idNum), 'failed');
              continue;
            }

            const {lcc} = await cryptoEngine.encryptText(body, 'peer', roomId);
            const containerBytes = await stegoEngine.embedLccIntoContainer(lcc);
            const containerBase64 = Buffer.from(containerBytes).toString('base64');

            const ok = sendRoomContainer({
              roomId,
              userId: currentUserId,
              messageType: 0,
              containerBase64,
              clientMsgId: String(idNum),
            });

            await bumpOutgoingSendAttempt(idNum, ok ? 'sent' : 'queued', null);
            updateMessageStateStatus(String(idNum), ok ? 'sent' : 'queued');
            continue;
          }

          // media/file
          const localPath = row.localPath || null;
          const fileName = (row.body || '').trim();

          if (!localPath) {
            await bumpOutgoingSendAttempt(idNum, 'failed', 'missing_local_path');
            updateMessageStateStatus(String(idNum), 'failed');
            continue;
          }

          const exists = await RNFS.exists(localPath);
          if (!exists) {
            await bumpOutgoingSendAttempt(idNum, 'failed', 'file_not_found');
            updateMessageStateStatus(String(idNum), 'failed');
            continue;
          }

          const stat = await RNFS.stat(localPath);
          const sizeBytes = Number(stat?.size || 0);
          if (sizeBytes > MAX_MEDIA_BYTES) {
            await bumpOutgoingSendAttempt(idNum, 'failed', 'file_too_large');
            updateMessageStateStatus(String(idNum), 'failed');
            continue;
          }

          const base64Data = await RNFS.readFile(localPath, 'base64');
          const fileBytes = Buffer.from(base64Data, 'base64');

          let messageType = 1;
          if (contentType === 'audio') messageType = 2;
          else if (contentType === 'video') messageType = 3;

          const ext = (() => {
            const fromName = fileName ? fileName.split('.').pop()?.toLowerCase() : null;
            if (fromName) return fromName;
            const fromPath = localPath.split('.').pop()?.toLowerCase();
            return fromPath || 'bin';
          })();

          const {lcc} = await cryptoEngine.encryptFile(fileBytes, 'peer', messageType, roomId);
          const containerBytes = await stegoEngine.embedLccIntoContainer(lcc);
          const containerBase64 = Buffer.from(containerBytes).toString('base64');

          const ok = sendRoomContainer({
            roomId,
            userId: currentUserId,
            messageType,
            containerBase64,
            fileName: fileName || `file.${ext}`,
            extension: ext,
            clientMsgId: String(idNum),
          });

          await bumpOutgoingSendAttempt(idNum, ok ? 'sent' : 'queued', null);
          updateMessageStateStatus(String(idNum), ok ? 'sent' : 'queued');
        } catch (e: any) {
          const err = e && e.message ? String(e.message) : 'retry_failed';
          await bumpOutgoingSendAttempt(idNum, 'local', err);
          updateMessageStateStatus(String(idNum), 'local');
        }
      }
    } catch (e) {
      logger.warn('useChatRoom: retryPending failed', e);
    }
  }, [roomId, currentUserId, cryptoEngine, stegoEngine, updateMessageStateStatus]);

  // R16: при входе в комнату пробуем дослать все недоставленные исходящие (offline outbox).
  useEffect(() => {
    let mounted = true;
    const t = setTimeout(() => {
      if (mounted) retryPending();
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [retryPending]);

  // R16: при возврате приложения в foreground — ретрай очереди.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        retryPending();
      }
    });
    return () => {
      sub.remove();
    };
  }, [retryPending]);

  /**
   * Отправка текстового сообщения.
   */
  const sendText = useCallback(
    async (text: string, _toAll: boolean = true) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return;

      const now = Date.now();

      const outgoingRecord: MessageRecord = {
        roomId,
        senderId: currentUserId,
        ts: now,
        outgoing: true,
        contentType: 'text',
        localPath: null,
        body: trimmed, // будет зашифровано at-rest в sqliteStorage.insertMessage
      };

      let outgoingId = 0;
      try {
        outgoingId = await insertMessage(outgoingRecord);
      } catch (e) {
        logger.warn('useChatRoom: insert outgoing failed', e);
      }

      const clientMsgId = String(outgoingId || `${now}_${currentUserId}`);

      // Optimistic UI
      appendMessage({
        id: clientMsgId,
        sender: currentUserId,
        body: trimmed,
        outgoing: true,
        contentType: 'text',
        localPath: null,
        deliveryStatus: 'local',
        ts: now,
      });

      try {
        const {lcc} = await cryptoEngine.encryptText(trimmed, 'peer', roomId);
        const containerBytes = await stegoEngine.embedLccIntoContainer(lcc);
        const containerBase64 = Buffer.from(containerBytes).toString('base64');

        const ok = sendRoomContainer({
          roomId,
          userId: currentUserId,
          messageType: 0,
          containerBase64,
          clientMsgId: String(outgoingId || clientMsgId),
        });

        if (outgoingId > 0) {
          await bumpOutgoingSendAttempt(outgoingId, ok ? 'sent' : 'queued', null);
        }
        updateMessageStateStatus(clientMsgId, ok ? 'sent' : 'queued');
      } catch (e) {
        logger.warn('useChatRoom: sendText crypto/stego error', e);
        setErrorOnce({
          title: i18n.t('common.error'),
          message: i18n.t('chatRoom.errors.sendTextFailed'),
          kind: 'sendText',
        });
        if (outgoingId > 0) {
          await bumpOutgoingSendAttempt(outgoingId, 'local', 'crypto_or_stego_failed');
        }
        updateMessageStateStatus(clientMsgId, 'local');
      }

      // On successful send attempt, update local read state (self)
      try {
        await sendReadAckIfNeeded(now);
      } catch {}
    },
    [roomId, currentUserId, cryptoEngine, stegoEngine, appendMessage, updateMessageStateStatus, sendReadAckIfNeeded],
  );

  /**
   * Отправка медиа/файла:
   * kind:
   *   - 'file'  — произвольный документ
   *   - 'image' — фото/картинка
   *   - 'video' — видео
   *
   * fileInfo:
   *   { uri: string; name: string; mimeType?: string | null }
   */
  const sendMedia = useCallback(
    async (kind: 'file' | 'image' | 'video' | 'audio', fileInfo: any) => {
      if (!fileInfo || !fileInfo.uri) return;

      const now = Date.now();
      const contentType =
        kind === 'image' ? 'image' : kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : 'file';

      const filePath = await importMediaFromUriToLocalFile(fileInfo.uri, fileInfo.name || `file_${now}`);

      const outgoingRecord: MessageRecord = {
        roomId,
        senderId: currentUserId,
        ts: now,
        outgoing: true,
        contentType,
        localPath: filePath,
        body: String(fileInfo.name || '').trim(),
      };

      let outgoingId = 0;
      try {
        outgoingId = await insertMessage(outgoingRecord);
      } catch (e) {
        logger.warn('useChatRoom: insert outgoing media failed', e);
      }

      const clientMsgId = String(outgoingId || `${now}_${currentUserId}`);

      appendMessage({
        id: clientMsgId,
        sender: currentUserId,
        body: outgoingRecord.body || `[${contentType}]`,
        outgoing: true,
        contentType,
        localPath: filePath,
        deliveryStatus: 'local',
        ts: now,
      });

      try {
        const stat = await RNFS.stat(filePath);
        const sizeBytes = Number(stat?.size || 0);
        if (sizeBytes > MAX_MEDIA_BYTES) {
          if (outgoingId > 0) {
            await bumpOutgoingSendAttempt(outgoingId, 'failed', 'file_too_large');
          }
          updateMessageStateStatus(clientMsgId, 'failed');
          setErrorOnce({
            title: i18n.t('common.error'),
            message: i18n.t('chatRoom.errors.fileTooLarge'),
            kind: 'fileTooLarge',
          });
          return;
        }

        const base64Data = await RNFS.readFile(filePath, 'base64');
        const fileBytes = Buffer.from(base64Data, 'base64');

        let messageType = 1;
        if (kind === 'audio') messageType = 2;
        else if (kind === 'video') messageType = 3;

        const ext =
          (fileInfo.name ? String(fileInfo.name).split('.').pop()?.toLowerCase() : null) ||
          (filePath ? filePath.split('.').pop()?.toLowerCase() : null) ||
          'bin';

        const {lcc} = await cryptoEngine.encryptFile(fileBytes, 'peer', messageType, roomId);
        const containerBytes = await stegoEngine.embedLccIntoContainer(lcc);
        const containerBase64 = Buffer.from(containerBytes).toString('base64');

        const ok = sendRoomContainer({
          roomId,
          userId: currentUserId,
          messageType,
          containerBase64,
          fileName: outgoingRecord.body || `file.${ext}`,
          extension: ext,
          clientMsgId: String(outgoingId || clientMsgId),
        });

        if (outgoingId > 0) {
          await bumpOutgoingSendAttempt(outgoingId, ok ? 'sent' : 'queued', null);
        }
        updateMessageStateStatus(clientMsgId, ok ? 'sent' : 'queued');
      } catch (e) {
        logger.warn('useChatRoom: sendMedia error', e);
        setErrorOnce({
          title: i18n.t('common.error'),
          message: i18n.t('chatRoom.errors.sendMediaFailed'),
          kind: 'sendMedia',
        });
        if (outgoingId > 0) {
          await bumpOutgoingSendAttempt(outgoingId, 'local', 'crypto_or_stego_failed');
        }
        updateMessageStateStatus(clientMsgId, 'local');
      }
    },
    [roomId, currentUserId, cryptoEngine, stegoEngine, appendMessage, updateMessageStateStatus],
  );

  // Фоновый приём контейнеров из messageBus и их расшифровка.
  useEffect(() => {
    const unsubscribe = subscribeIncomingContainers(async msg => {
      try {
        if (!msg || msg.roomId !== roomId) return;

        const {roomId: roomFromMsg, senderId, containerBase64} = msg;
        if (!containerBase64) return;

        const containerBuf = Buffer.from(containerBase64, 'base64');
        const containerBytes = new Uint8Array(containerBuf.buffer, containerBuf.byteOffset, containerBuf.byteLength);

        const lccIncoming = await stegoEngine.extractLccFromContainer(containerBytes);
        const tsIncoming = safeNow();
        const msgType = msg.messageType ?? 0;

        if (msgType === 0) {
          const decryptedText = await cryptoEngine.decryptText(lccIncoming, senderId, 0, roomFromMsg);

          const incomingRecord: MessageRecord = {
            roomId: roomFromMsg,
            senderId,
            ts: tsIncoming,
            outgoing: false,
            contentType: 'text',
            localPath: null,
            body: decryptedText, // будет зашифровано at-rest
          };

          let incomingId = 0;
          try {
            incomingId = await insertMessage(incomingRecord);
          } catch (e) {
            logger.warn('useChatRoom: insert incoming (text) failed', e);
          }

          appendMessage({
            id: String(incomingId || `${tsIncoming}_${senderId}`),
            sender: senderId,
            body: decryptedText || '',
            outgoing: false,
            contentType: 'text',
            localPath: null,
            ts: tsIncoming,
          });

          // mark read locally + send WS read
          await sendReadAckIfNeeded(tsIncoming);
          return;
        }

        // media/file
        const extension =
          msg.extension ||
          (msg.fileName ? String(msg.fileName).split('.').pop()?.toLowerCase() || 'bin' : 'bin');

        let contentType = 'file';
        if (msgType === 2) contentType = 'audio';
        else if (msgType === 3) contentType = 'video';
        else if (msgType === 1) {
          const imgExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic'];
          const ext = String(extension || '').toLowerCase();
          if (imgExts.includes(ext)) contentType = 'image';
        }

        let localPath = null;
        try {
          localPath = await cryptoEngine.decryptFile(lccIncoming, senderId, msgType, extension, roomFromMsg);
        } catch (e) {
          logger.warn('useChatRoom: decryptFile failed', e);
          return;
        }

        const incomingRecord: MessageRecord = {
          roomId: roomFromMsg,
          senderId,
          ts: tsIncoming,
          outgoing: false,
          contentType,
          localPath,
          body: msg.fileName || '',
        };

        let incomingId = 0;
        try {
          incomingId = await insertMessage(incomingRecord);
        } catch (e) {
          logger.warn('useChatRoom: insert incoming (file) failed', e);
        }

        appendMessage({
          id: String(incomingId || `${tsIncoming}_${senderId}`),
          sender: senderId,
          body: msg.fileName || `[${contentType}]`,
          outgoing: false,
          contentType,
          localPath,
          ts: tsIncoming,
        });

        await sendReadAckIfNeeded(tsIncoming);
      } catch (e) {
        logger.warn('useChatRoom: incoming container error', e);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, cryptoEngine, stegoEngine, appendMessage, sendReadAckIfNeeded]);

  // Подписка на ACK'и доставки сообщений
  useEffect(() => {
    const unsubscribeDelivery = subscribeDelivery(async ack => {
      if (!ack || !ack.clientMsgId) return;
      if (ack.roomId !== roomId) return;

      const {clientMsgId} = ack;
      const numericId = Number(clientMsgId);
      if (!Number.isFinite(numericId) || numericId <= 0) return;

      const kind = clampStatus(String((ack.kind || 'delivered')).toLowerCase());
      // normalize: if server sends unknown kind -> delivered
      const status = kind === 'sent' || kind === 'delivered' || kind === 'read' ? kind : 'delivered';

      try {
        await updateMessageDeliveryStatus(numericId, status);
      } catch (e) {
        logger.warn('useChatRoom: failed to update delivery status in DB', e);
      }

      updateMessageStateStatus(String(clientMsgId), status);
    });

    return () => {
      unsubscribeDelivery();
    };
  }, [roomId, updateMessageStateStatus]);

  const pendingCount = messages.filter(
    m => m.outgoing && !['delivered', 'read'].includes(String(m.deliveryStatus || 'local')),
  ).length;

  return {
    messages,
    sendText,
    sendMedia,
    retryPending,
    loadOlder,
    loadingOlder,
    hasOlder,
    minLoadedTs,
    pendingCount,
    lastError,
    clearLastError,
  };
}
