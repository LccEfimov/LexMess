
import SQLite from 'react-native-sqlite-storage';
import {getDevicePassphrase} from './passphraseStorage';
import {secretboxDecryptText, secretboxEncryptText} from '../crypto/e2eIdentity';
import {normalizeThemeMode, type ThemeMode} from '../theme/themes';


SQLite.enablePromise(true);

const DB_NAME = 'lexmess_client.db';


async function encryptBodyAtRest(plainText: string): Promise<{cipherB64: string; nonceB64: string}> {
  const passphrase = await getDevicePassphrase();
  return secretboxEncryptText(passphrase, plainText);
}

async function decryptBodyAtRest(cipherB64: string, nonceB64: string): Promise<string> {
  const passphrase = await getDevicePassphrase();
  return secretboxDecryptText(passphrase, cipherB64, nonceB64);
}

async function lazyMigratePlaintextBody(
  db: SQLite.SQLiteDatabase,
  messageId: number,
  plainText: string,
): Promise<void> {
  try {
    const enc = await encryptBodyAtRest(plainText);
    await db.executeSql(
      `UPDATE messages SET body_cipher_b64 = ?, body_nonce_b64 = ?, body = NULL WHERE id = ?`,
      [enc.cipherB64, enc.nonceB64, messageId],
    );
  } catch (e) {
    // ignore
  }
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

// Увеличиваем при изменении схемы. Миграции ниже обязаны быть идемпотентны.
const SCHEMA_VERSION = 9;

async function getUserVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const [res] = await db.executeSql('PRAGMA user_version;');
  if (res.rows.length === 0) {
    return 0;
  }
  const row = res.rows.item(0);
  const v = (row.user_version as number) || 0;
  return v;
}

async function setUserVersion(
  db: SQLite.SQLiteDatabase,
  version: number,
): Promise<void> {
  await db.executeSql(`PRAGMA user_version = ${version};`);
}

async function migrateToV1(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      nickname        TEXT NOT NULL,
      theme           TEXT NOT NULL DEFAULT 'dark',
      lang            TEXT NOT NULL DEFAULT 'ru',
      lock_method     TEXT NOT NULL DEFAULT 'none',
      chats_mode      TEXT NOT NULL DEFAULT 'persistent',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
  `);

  // Старый E2E-аккаунт (pickle). Позже переименуем, но сейчас сохраняем совместимость.
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS accounts (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      pickle          TEXT NOT NULL,
      updated_at      INTEGER NOT NULL
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS sessions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id         TEXT NOT NULL,
      peer_id         TEXT NOT NULL,
      session_id      TEXT NOT NULL,
      pickle          TEXT NOT NULL,
      updated_at      INTEGER NOT NULL,
      UNIQUE (room_id, peer_id)
    );
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_sessions_room_peer
      ON sessions(room_id, peer_id);
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS rooms (
    unread_count INTEGER DEFAULT 0,
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id             TEXT NOT NULL UNIQUE,
      title               TEXT NOT NULL,
      max_participants    INTEGER NOT NULL DEFAULT 25,
      is_persistent       INTEGER NOT NULL DEFAULT 1,
      container_type      TEXT NOT NULL,
      template_id         INTEGER NOT NULL,
      slot_id             INTEGER NOT NULL,
      payload_format      TEXT NOT NULL,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL
    );
  `);

  // Базовая таблица сообщений. Новые колонки добавляются ALTER-ами ниже.
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id          TEXT NOT NULL,
      sender_id        TEXT NOT NULL,
      ts               INTEGER NOT NULL,
      outgoing         INTEGER NOT NULL,
      content_type     TEXT NOT NULL,
      local_path       TEXT,
      body             TEXT
    );
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_messages_room_ts
      ON messages(room_id, ts DESC);
  `);

  // Мягкие ALTER для старых схем.
  try {
    await db.executeSql(
      `ALTER TABLE messages ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'local';`,
    );
  } catch (e) {
    // ignore
  }

  try {
    await db.executeSql(`ALTER TABLE messages ADD COLUMN e2e_epoch INTEGER;`);
  } catch (e) {
    // ignore
  }

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS room_read_state (
      room_id      TEXT PRIMARY KEY,
      last_read_ts INTEGER NOT NULL
    );
  `);
}

async function migrateToV2(db: SQLite.SQLiteDatabase): Promise<void> {
  // Локальная информация об аккаунте (логин/имя/кошелёк) для будущего auth-flow.
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS local_account (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      login           TEXT,
      display_name    TEXT,
      wallet_address  TEXT,
      recovery_shown  INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
  `);

  await db.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_local_account_login ON local_account(login);',
  );
}


async function migrateToV3(db: SQLite.SQLiteDatabase): Promise<void> {
  // R6: расширение rooms для стилей и настроек.
  try {
    await db.executeSql(
      `ALTER TABLE rooms ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;`,
    );
  } catch (e) {
    // ignore
  }
  try {
    await db.executeSql(
      `ALTER TABLE rooms ADD COLUMN style_id TEXT NOT NULL DEFAULT 'default';`,
    );
  } catch (e) {
    // ignore
  }
  try {
    await db.executeSql(
      `ALTER TABLE rooms ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';`,
    );
  } catch (e) {
    // ignore
  }
  try {
    await db.executeSql(
      `ALTER TABLE rooms ADD COLUMN features_json TEXT NOT NULL DEFAULT '{}';`,
    );
  } catch (e) {
    // ignore
  }
}


async function migrateToV4(db: SQLite.SQLiteDatabase): Promise<void> {
  // R13: E2E identity/private secrets stored as secretbox (tweetnacl) in SQLite.
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS e2e_secretbox (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      user_id             TEXT,
      identity_keys_json  TEXT,
      secrets_cipher_b64  TEXT NOT NULL,
      secrets_nonce_b64   TEXT NOT NULL,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL
    );
  `);

  await db.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_e2e_secretbox_user ON e2e_secretbox(user_id);',
  );
}


async function migrateToV5(db: SQLite.SQLiteDatabase): Promise<void> {
  // R16: offline outbox / retries for outgoing messages.
  try {
    await db.executeSql(`ALTER TABLE messages ADD COLUMN send_attempts INTEGER NOT NULL DEFAULT 0;`);
  } catch (e) {
    // ignore
  }
  try {
    await db.executeSql(`ALTER TABLE messages ADD COLUMN last_send_ts INTEGER NOT NULL DEFAULT 0;`);
  } catch (e) {
    // ignore
  }
  try {
    await db.executeSql(`ALTER TABLE messages ADD COLUMN last_error TEXT;`);
  } catch (e) {
    // ignore
  }

  try {
    await db.executeSql(`
      CREATE INDEX IF NOT EXISTS idx_messages_pending
        ON messages(room_id, outgoing, delivery_status, ts DESC);
    `);
  } catch (e) {
    // ignore
  }
}


async function migrateToV6(db: SQLite.SQLiteDatabase): Promise<void> {
  // R26: кэш истории кошелька (офлайн-first).
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS wallet_tx_cache (
      k   TEXT PRIMARY KEY,
      ts  INTEGER NOT NULL,
      json TEXT NOT NULL
    );
  `);
  await db.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_wallet_tx_cache_ts ON wallet_tx_cache(ts DESC);',
  );
}


async function migrateToV7(db: SQLite.SQLiteDatabase): Promise<void> {
  // R29: состояние защиты операций (PIN/биометрия).
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS security_state (
      id                INTEGER PRIMARY KEY CHECK (id = 1),
      pin_hash          TEXT,
      pin_salt          TEXT,
      pin_fail_count    INTEGER NOT NULL DEFAULT 0,
      pin_locked_until  INTEGER NOT NULL DEFAULT 0,
      biometrics_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at        INTEGER NOT NULL
    );
  `);

  const now = Math.floor(Date.now() / 1000);
  await db.executeSql(
    'INSERT OR IGNORE INTO security_state (id, updated_at) VALUES (1, ?);',
    [now],
  );
  await db.executeSql(
    'UPDATE security_state SET updated_at = COALESCE(updated_at, ?) WHERE id = 1;',
    [now],
  );
}



async function migrateToV8(db: SQLite.SQLiteDatabase): Promise<void> {
  // R30: закрепы чатов (pinned rooms) + метаданные для списка чатов.
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS room_pins (
      room_id    TEXT PRIMARY KEY,
      pinned_at  INTEGER NOT NULL
    );
  `);
  await db.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_room_pins_pinned_at ON room_pins(pinned_at DESC);',
  );
}



/**
 * Получаем (и открываем при необходимости) соединение с локальной БД.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  const db = await SQLite.openDatabase({
    name: DB_NAME,
    location: 'default',
  });
  dbInstance = db;
  return db;
}

/**
 * Инициализация схемы БД.
 * Схема совпадает с db/lexmess_client_schema.sql.
 */

async function migrateToV9(db: SQLite.SQLiteDatabase): Promise<void> {
  // R35: хранение сообщений только в зашифрованном виде (at-rest encryption).
  // Добавляем колонки для secretbox(cipher+nonce). Старое поле body остаётся для ленивой миграции.
  try {
    await db.executeSql(`ALTER TABLE messages ADD COLUMN body_cipher_b64 TEXT;`);
  } catch (e) {}
  try {
    await db.executeSql(`ALTER TABLE messages ADD COLUMN body_nonce_b64 TEXT;`);
  } catch (e) {}
}

export async function ensureSchema(): Promise<void> {
  const db = await getDatabase();

  await db.executeSql('PRAGMA foreign_keys = ON;');

  const current = await getUserVersion(db);

  // Миграции выполняются строго по порядку.
  if (current < 1) {
    await migrateToV1(db);
    await setUserVersion(db, 1);
  }
  if (current < 2) {
    await migrateToV2(db);
    await setUserVersion(db, 2);
  }
  if (current < 3) {
    await migrateToV3(db);
    await setUserVersion(db, 3);
  }
  if (current < 4) {
    await migrateToV4(db);
    await setUserVersion(db, 4);
  }
  if (current < 5) {
    await migrateToV5(db);
    await setUserVersion(db, 5);
  }
  if (current < 6) {
    await migrateToV6(db);
    await setUserVersion(db, 6);
  }

  // На всякий случай: если user_version вручную уменьшили, все равно держим актуальность.
  const v2 = await getUserVersion(db);
  if (v2 < SCHEMA_VERSION) {
    // Доводим до последней версии через последовательные шаги.
    if (v2 < 1) {
      await migrateToV1(db);
    }
    if (v2 < 2) {
      await migrateToV2(db);
    }
    if (v2 < 3) {
      await migrateToV3(db);
    }
    if (v2 < 4) {
      await migrateToV4(db);
    }
    if (v2 < 5) {
      await migrateToV5(db);
    }
    if (v2 < 6) {
      await migrateToV6(db);
    }
    if (v2 < 7) {
      await migrateToV7(db);
    }
    if (v2 < 8) {
      await migrateToV8(db);
    }
    if (v2 < 9) {
      await migrateToV9(db);
    }
    await setUserVersion(db, SCHEMA_VERSION);
  }
}
// ===== app_settings =====

export type AppSettings = {
  nickname: string;
  theme: ThemeMode | string;
  lang: string;
  lockMethod: 'none' | 'pin' | 'biometrics';
  chatsMode: 'persistent' | 'ephemeral';
  createdAt?: number;
  updatedAt?: number;
};

export async function loadAppSettings(): Promise<AppSettings | null> {
  const db = await getDatabase();
  const [res] = await db.executeSql(
    'SELECT * FROM app_settings WHERE id = 1 LIMIT 1;',
  );
  if (res.rows.length === 0) {
    return null;
  }
  const row = res.rows.item(0);
  return {
    nickname: row.nickname,
    theme: normalizeThemeMode(row.theme || 'lexmess_dark'),
    lang: row.lang || 'ru',
    lockMethod: row.lock_method || 'none',
    chatsMode: row.chats_mode === 'ephemeral' ? 'ephemeral' : 'persistent',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  const created = settings.createdAt || now;
  await db.executeSql(
    `
    INSERT OR REPLACE INTO app_settings
      (id, nickname, theme, lang, lock_method, chats_mode, created_at, updated_at)
    VALUES
      (1, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      settings.nickname,
      normalizeThemeMode(settings.theme || 'lexmess_dark'),
      settings.lang,
      settings.lockMethod,
      settings.chatsMode,
      created,
      now,
    ],
  );
}


// ===== room_read_state =====

export async function loadLastReadByRoom(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const [res] = await db.executeSql(
    'SELECT room_id, last_read_ts FROM room_read_state;',
  );
  const result: Record<string, number> = {};
  for (let i = 0; i < res.rows.length; i += 1) {
    const row = res.rows.item(i);
    const roomId = row.room_id as string;
    const ts = (row.last_read_ts as number) || 0;
    result[roomId] = ts;
  }
  return result;
}


export async function updateMessageDeliveryStatus(
  id: number,
  status: string,
): Promise<void> {
  const db = await getDatabase();
  try {
    await db.executeSql(
      `UPDATE messages SET delivery_status = ?, last_error = CASE WHEN ? = 'delivered' THEN NULL ELSE last_error END WHERE id = ?;`,
      [status, status, id],
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[sqliteStorage] updateMessageDeliveryStatus failed', e);
  }
}


export async function updateRoomLastRead(roomId: string, ts: number): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `
    INSERT INTO room_read_state (room_id, last_read_ts)
    VALUES (?, ?)
    ON CONFLICT(room_id) DO UPDATE SET
      last_read_ts = excluded.last_read_ts;
    `,
    [roomId, ts],
  );
}

export async function markRoomRead(roomId: string): Promise<void> {
  const ts = Date.now();
  await updateRoomLastRead(roomId, ts);
}




// ===== room_pins (закрепы) =====

export async function loadPinnedRooms(): Promise<Record<string, number>> {
  const db = await getDatabase();
  await ensureSchema();
  const [res] = await db.executeSql('SELECT room_id, pinned_at FROM room_pins;');
  const out: Record<string, number> = {};
  for (let i = 0; i < res.rows.length; i += 1) {
    const row = res.rows.item(i);
    const roomId = String(row.room_id || '');
    const pinnedAt = Number(row.pinned_at || 0);
    if (roomId) {
      out[roomId] = Number.isFinite(pinnedAt) ? pinnedAt : 0;
    }
  }
  return out;
}

export async function setRoomPinned(roomId: string, pinned: boolean): Promise<void> {
  const db = await getDatabase();
  await ensureSchema();
  const rid = String(roomId || '').trim();
  if (!rid) {
    return;
  }
  if (pinned) {
    const now = Date.now();
    await db.executeSql(
      `
      INSERT INTO room_pins (room_id, pinned_at)
      VALUES (?, ?)
      ON CONFLICT(room_id) DO UPDATE SET pinned_at = excluded.pinned_at;
      `,
      [rid, now],
    );
  } else {
    await db.executeSql('DELETE FROM room_pins WHERE room_id = ?;', [rid]);
  }
}

// ===== rooms =====

export type RoomRecord = {
  roomId: string;
  title: string;
  maxParticipants: number;
  isPersistent: boolean;
  isPrivate?: boolean;
  containerType: string;
  templateId: number;
  slotId: number;
  payloadFormat: string;
  styleId?: string;
  settingsJson?: string;
  featuresJson?: string;
  createdAt?: number;
  updatedAt?: number;
};

export async function upsertRoom(room: RoomRecord): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  const created = room.createdAt || now;
  await db.executeSql(
    `
    INSERT INTO rooms
      (room_id, title, max_participants, is_persistent, is_private, container_type, template_id,
       slot_id, payload_format, style_id, settings_json, features_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id) DO UPDATE SET
      title = excluded.title,
      max_participants = excluded.max_participants,
      is_persistent = excluded.is_persistent,
      is_private = excluded.is_private,
      container_type = excluded.container_type,
      template_id = excluded.template_id,
      slot_id = excluded.slot_id,
      payload_format = excluded.payload_format,
      style_id = excluded.style_id,
      settings_json = excluded.settings_json,
      features_json = excluded.features_json,
      updated_at = excluded.updated_at;
    `,
    [
      room.roomId,
      room.title,
      room.maxParticipants,
      room.isPersistent ? 1 : 0,
      room.isPrivate ? 1 : 0,
      room.containerType,
      room.templateId,
      room.slotId,
      room.payloadFormat,
      room.styleId || 'default',
      room.settingsJson || '{}',
      room.featuresJson || '{}',
      created,
      now,
    ],
  );
}

export async function getAllRooms(): Promise<RoomRecord[]> {
  const db = await getDatabase();
  const [res] = await db.executeSql(
    'SELECT * FROM rooms ORDER BY updated_at DESC;',
  );
  const result: RoomRecord[] = [];
  for (let i = 0; i < res.rows.length; i += 1) {
    const row = res.rows.item(i);
    result.push({
      roomId: row.room_id,
      title: row.title,
      maxParticipants: row.max_participants,
      isPersistent: !!row.is_persistent,
      isPrivate: !!row.is_private,
      containerType: row.container_type,
      templateId: row.template_id,
      slotId: row.slot_id,
      payloadFormat: row.payload_format,
      styleId: row.style_id || 'default',
      settingsJson: row.settings_json || '{}',
      featuresJson: row.features_json || '{}',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return result;
}

// ===== messages =====

export type MessageRecord = {
  id?: number;
  roomId: string;
  senderId: string;
  ts?: number;
  outgoing: boolean;
  contentType: string;
  localPath?: string | null;
  body?: string | null;
  deliveryStatus?: string | null;
  e2eEpoch?: number | null;
  sendAttempts?: number | null;
  lastSendTs?: number | null;
  lastError?: string | null;
  bodyCipherB64?: string | null;
  bodyNonceB64?: string | null;
};

export async function insertMessage(message: MessageRecord): Promise<number> {
  const db = await getDatabase();
  const ts = Number(message.ts || Date.now());

  const roomId = message.roomId;
  const senderId = message.senderId;
  const outgoing = message.outgoing ? 1 : 0;
  const contentType = message.contentType || 'text';
  const localPath = message.localPath ?? null;

  let body: string | null = message.body ?? null;
  let bodyCipher: string | null = null;
  let bodyNonce: string | null = null;

  // At-rest encryption for text messages.
  // We do not store plaintext in `body` for contentType === 'text'.
  if (contentType === 'text' || contentType === 'system') {
    const plain = (body || '').toString();
    if (plain.length > 0) {
      try {
        const enc = await encryptBodyAtRest(plain);
        bodyCipher = enc.cipherB64;
        bodyNonce = enc.nonceB64;
        body = null;
      } catch (e) {
        // If encryption fails, fallback to plaintext to avoid data loss,
        // but it will be migrated lazily on next read if possible.
        // eslint-disable-next-line no-console
        console.warn('[sqliteStorage] insertMessage: at-rest encryption failed', e);
      }
    }
  }

  const deliveryStatus = message.deliveryStatus || (outgoing ? 'local' : 'delivered');
  const e2eEpoch = message.e2eEpoch ?? null;
  const sendAttempts = Number(message.sendAttempts || 0);
  const lastSendTs = Number(message.lastSendTs || 0);
  const lastError = message.lastError ?? null;

  const sql = `
    INSERT INTO messages(
      room_id, sender_id, ts, outgoing, content_type, local_path,
      body, delivery_status, e2e_epoch, send_attempts, last_send_ts, last_error,
      body_cipher_b64, body_nonce_b64
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    roomId,
    senderId,
    ts,
    outgoing,
    contentType,
    localPath,
    body,
    deliveryStatus,
    e2eEpoch,
    sendAttempts,
    lastSendTs,
    lastError,
    bodyCipher,
    bodyNonce,
  ];

  const res = await db.executeSql(sql, params);
  const id = res[0].insertId;
  return Number(id || 0);
}


export async function insertSystemMessage(roomId: string, text: string): Promise<number> {
  const body = String(text || '').trim();
  if (!body) return 0;
  return insertMessage({
    roomId,
    senderId: 'system',
    ts: Date.now(),
    outgoing: false,
    contentType: 'system',
    body,
  });
}



export async function getMessagesForRoom(
  roomId: string,
  limit = 200,
): Promise<MessageRecord[]> {
  const db = await getDatabase();
  const res = await db.executeSql(
    `SELECT id, room_id, sender_id, ts, outgoing, content_type, local_path, body,
            delivery_status, e2e_epoch, send_attempts, last_send_ts, last_error,
            body_cipher_b64, body_nonce_b64
       FROM messages
      WHERE room_id = ?
      ORDER BY ts DESC
      LIMIT ?`,
    [roomId, limit],
  );

  const rows: MessageRecord[] = [];
  const resultRows = res[0].rows;
  for (let i = 0; i < resultRows.length; i++) {
    const r: any = resultRows.item(i);
    const idNum = Number(r.id || 0);

    let body: string | null = r.body ?? null;

    if ((r.content_type || 'text') === 'text' || (r.content_type || '') === 'system') {
      const cipher = r.body_cipher_b64 || null;
      const nonce = r.body_nonce_b64 || null;
      if (cipher && nonce) {
        try {
          body = await decryptBodyAtRest(String(cipher), String(nonce));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[sqliteStorage] getMessagesForRoom: decrypt failed', e);
          body = body || '';
        }
      } else if (body && idNum > 0) {
        // Lazy migration for old plaintext rows.
        await lazyMigratePlaintextBody(db, idNum, String(body));
      }
    }

    rows.push({
      id: idNum,
      roomId: String(r.room_id),
      senderId: String(r.sender_id),
      ts: Number(r.ts || 0),
      outgoing: !!Number(r.outgoing || 0),
      contentType: String(r.content_type || 'text'),
      localPath: r.local_path ?? null,
      body: body ?? null,
      deliveryStatus: r.delivery_status ?? null,
      e2eEpoch: r.e2e_epoch ?? null,
      sendAttempts: r.send_attempts ?? null,
      lastSendTs: r.last_send_ts ?? null,
      lastError: r.last_error ?? null,
    });
  }

  return rows;
}




export async function getUnreadCountForRoom(roomId: string, afterTs: number): Promise<number> {
  const db = await getDatabase();
  const ts = Number(afterTs || 0);
  const [res] = await db.executeSql(
    `
    SELECT COUNT(*) as c
    FROM messages
    WHERE room_id = ?
      AND ts > ?
      AND outgoing = 0;
    `,
    [roomId, ts],
  );
  if (res.rows.length === 0) {
    return 0;
  }
  const row = res.rows.item(0);
  const c = Number(row.c || 0);
  return Number.isFinite(c) ? c : 0;
}


export async function getPendingOutgoingMessages(
  roomId: string,
  limit = 80,
): Promise<MessageRecord[]> {
  const db = await getDatabase();
  const res = await db.executeSql(
    `SELECT id, room_id, sender_id, ts, outgoing, content_type, local_path, body,
            delivery_status, e2e_epoch, send_attempts, last_send_ts, last_error,
            body_cipher_b64, body_nonce_b64
       FROM messages
      WHERE room_id = ?
        AND outgoing = 1
        AND (delivery_status IS NULL OR delivery_status IN ('local','queued','sent','sending'))
      ORDER BY ts ASC
      LIMIT ?`,
    [roomId, limit],
  );

  const rows: MessageRecord[] = [];
  const resultRows = res[0].rows;
  for (let i = 0; i < resultRows.length; i++) {
    const r: any = resultRows.item(i);
    const idNum = Number(r.id || 0);

    let body: string | null = r.body ?? null;

    if ((r.content_type || 'text') === 'text' || (r.content_type || '') === 'system') {
      const cipher = r.body_cipher_b64 || null;
      const nonce = r.body_nonce_b64 || null;
      if (cipher && nonce) {
        try {
          body = await decryptBodyAtRest(String(cipher), String(nonce));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[sqliteStorage] getPendingOutgoingMessages: decrypt failed', e);
          body = body || '';
        }
      } else if (body && idNum > 0) {
        await lazyMigratePlaintextBody(db, idNum, String(body));
      }
    }

    rows.push({
      id: idNum,
      roomId: String(r.room_id),
      senderId: String(r.sender_id),
      ts: Number(r.ts || 0),
      outgoing: true,
      contentType: String(r.content_type || 'text'),
      localPath: r.local_path ?? null,
      body: body ?? null,
      deliveryStatus: r.delivery_status ?? null,
      e2eEpoch: r.e2e_epoch ?? null,
      sendAttempts: r.send_attempts ?? null,
      lastSendTs: r.last_send_ts ?? null,
      lastError: r.last_error ?? null,
    });
  }

  return rows;
}


export async function bumpOutgoingSendAttempt(
  id: number,
  status: string = 'sent',
  error: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  try {
    await db.executeSql(
      `
      UPDATE messages
      SET
        send_attempts = COALESCE(send_attempts, 0) + 1,
        last_send_ts = ?,
        delivery_status = ?,
        last_error = ?
      WHERE id = ?;
      `,
      [now, status, error, id],
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[sqliteStorage] bumpOutgoingSendAttempt failed', e);
  }
}


// ===== wallet_tx_cache =====

export async function loadWalletTxCache(limit: number = 120): Promise<any[]> {
  const db = await getDatabase();
  await ensureSchema();
  const lim = Math.max(1, Math.min(500, Math.floor(limit)));
  const [res] = await db.executeSql(
    'SELECT json FROM wallet_tx_cache ORDER BY ts DESC LIMIT ?;',
    [lim],
  );
  const out: any[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    try {
      const row = res.rows.item(i);
      const j = row?.json ? JSON.parse(String(row.json)) : null;
      if (j) out.push(j);
    } catch {
      // ignore bad json
    }
  }
  return out;
}

export async function saveWalletTxCache(items: any[]): Promise<void> {
  const db = await getDatabase();
  await ensureSchema();
  const arr = Array.isArray(items) ? items : [];
  // Upsert
  for (const it of arr) {
    const ts = Number((it as any)?.ts ?? 0);
    const tsv = Number.isFinite(ts) ? Math.floor(ts) : 0;
    const k = String(
      (it as any)?.tx_id ??
        (it as any)?.chain_tx_id ??
        (it as any)?.op_id ??
        (it as any)?.request_id ??
        (it as any)?.id ??
        `${(it as any)?.kind || 'tx'}:${tsv}:${Number((it as any)?.amount || 0)}:${String((it as any)?.memo || '')}:${String((it as any)?.status || '')}`,
    );
    try {
      await db.executeSql(
        'INSERT OR REPLACE INTO wallet_tx_cache (k, ts, json) VALUES (?, ?, ?);',
        [k, tsv, JSON.stringify(it ?? null)],
      );
    } catch {
      // ignore single-row insert errors
    }
  }
  // Cap size (keep last 500)
  try {
    await db.executeSql(
      'DELETE FROM wallet_tx_cache WHERE k NOT IN (SELECT k FROM wallet_tx_cache ORDER BY ts DESC LIMIT 500);',
    );
  } catch {
    // ignore
  }
}

export async function clearWalletTxCache(): Promise<void> {
  const db = await getDatabase();
  await ensureSchema();
  try {
    await db.executeSql('DELETE FROM wallet_tx_cache;');
  } catch {
    // ignore
  }
}

// ===== security_state =====

export type SecurityState = {
  pinHash: string | null;
  pinSalt: string | null;
  pinFailCount: number;
  pinLockedUntil: number;
  biometricsEnabled: boolean;
  updatedAt: number;
};

export async function loadSecurityState(): Promise<SecurityState> {
  const db = await getDatabase();
  await ensureSchema();
  const [res] = await db.executeSql(
    'SELECT * FROM security_state WHERE id = 1 LIMIT 1;',
  );
  if (res.rows.length === 0) {
    const now = Math.floor(Date.now() / 1000);
    await db.executeSql(
      'INSERT OR REPLACE INTO security_state (id, updated_at) VALUES (1, ?);',
      [now],
    );
    return {
      pinHash: null,
      pinSalt: null,
      pinFailCount: 0,
      pinLockedUntil: 0,
      biometricsEnabled: false,
      updatedAt: now,
    };
  }
  const row = res.rows.item(0);
  return {
    pinHash: row.pin_hash ? String(row.pin_hash) : null,
    pinSalt: row.pin_salt ? String(row.pin_salt) : null,
    pinFailCount: Number(row.pin_fail_count || 0),
    pinLockedUntil: Number(row.pin_locked_until || 0),
    biometricsEnabled: Number(row.biometrics_enabled || 0) === 1,
    updatedAt: Number(row.updated_at || 0),
  };
}

export async function setSecurityBiometricsEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await ensureSchema();
  const now = Math.floor(Date.now() / 1000);
  await db.executeSql(
    'UPDATE security_state SET biometrics_enabled = ?, updated_at = ? WHERE id = 1;',
    [enabled ? 1 : 0, now],
  );
}

export async function setPinHashSalt(pinHash: string, pinSalt: string): Promise<void> {
  const db = await getDatabase();
  await ensureSchema();
  const now = Math.floor(Date.now() / 1000);
  await db.executeSql(
    'UPDATE security_state SET pin_hash = ?, pin_salt = ?, pin_fail_count = 0, pin_locked_until = 0, updated_at = ? WHERE id = 1;',
    [pinHash, pinSalt, now],
  );
}

export async function clearPin(): Promise<void> {
  const db = await getDatabase();
  await ensureSchema();
  const now = Math.floor(Date.now() / 1000);
  await db.executeSql(
    'UPDATE security_state SET pin_hash = NULL, pin_salt = NULL, pin_fail_count = 0, pin_locked_until = 0, updated_at = ? WHERE id = 1;',
    [now],
  );
}

export async function recordPinFailure(maxFails: number = 5, lockSeconds: number = 300): Promise<{lockedUntil: number; failCount: number}> {
  const db = await getDatabase();
  await ensureSchema();
  const state = await loadSecurityState();
  const now = Math.floor(Date.now() / 1000);
  let failCount = (state.pinFailCount || 0) + 1;
  let lockedUntil = state.pinLockedUntil || 0;
  if (failCount >= maxFails) {
    lockedUntil = now + lockSeconds;
    failCount = 0; // reset after lock
  }
  await db.executeSql(
    'UPDATE security_state SET pin_fail_count = ?, pin_locked_until = ?, updated_at = ? WHERE id = 1;',
    [failCount, lockedUntil, now],
  );
  return {lockedUntil, failCount};
}

export async function resetPinFailures(): Promise<void> {
  const db = await getDatabase();
  await ensureSchema();
  const now = Math.floor(Date.now() / 1000);
  await db.executeSql(
    'UPDATE security_state SET pin_fail_count = 0, pin_locked_until = 0, updated_at = ? WHERE id = 1;',
    [now],
  );
}


export async function getRoomUnreadCount(roomId: string): Promise<number> {
  const res = await db.executeSql(`SELECT unread_count FROM rooms WHERE room_id = ?`, [roomId]);
  const row = res[0].rows.length ? res[0].rows.item(0) : null;
  return row ? Number(row.unread_count || 0) : 0;
}
