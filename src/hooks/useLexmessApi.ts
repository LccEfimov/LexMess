import {useCallback} from 'react';
import {getAccessToken, saveAccessToken, clearAccessToken} from '../storage/authTokenStorage';
import {API_BASE_URL} from '../config/networkConfig';


/**
 * Хук для общения с сервером LexMess (FastAPI + Redis).
 * Сервер:
 *   - не хранит переписку и *.lcc;
 *   - знает только аккаунты (identity + one-time-keys);
 *   - знает только метаданные комнат.
 */

// Default API base.
// NOTE: for Android emulator we use 10.0.2.2 in __DEV__ mode (see config).
const DEFAULT_BASE_URL = API_BASE_URL;

export function useLexmessApi(baseUrl = DEFAULT_BASE_URL) {
  const apiBase = baseUrl.replace(/\/+$/, '');

  const requestJson = useCallback(
    async (path, options: any = {}) => {
      const {timeoutMs, ...fetchOptions} = options ?? {};
      const url = apiBase + path;

      const optHeaders: any = fetchOptions.headers || {};
      const extraHeaders: any = {...optHeaders};
      try {
        const token = await getAccessToken();
        if (token) {
          extraHeaders.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        // ignore token errors, continue without Authorization
      }

      // Опциональный таймаут (для нестабильной сети на Android fetch бывает "висит").
      let controller: AbortController | null = null;
      let timeoutId: any = null;
      let signal: any = undefined;
      if (typeof AbortController !== 'undefined' && typeof timeoutMs === 'number' && timeoutMs > 0) {
        controller = new AbortController();
        signal = controller.signal;
        timeoutId = setTimeout(() => {
          try {
            controller?.abort();
          } catch (e) {
            // ignore
          }
        }, timeoutMs);
      }

      try {
        const {headers: _ignored, ...restFetchOptions} = fetchOptions;
        const resp = await fetch(url, {
          ...restFetchOptions,
          signal,
          headers: {
            'Content-Type': 'application/json',
            ...extraHeaders,
          },
        });

        const text = await resp.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (e) {
          throw new Error(`Bad JSON from ${url}: ${e}`);
        }

        if (!resp.ok) {
          const detail =
            (json && (json.detail || json.error)) ||
            `HTTP ${resp.status}`;
          // При 401 предполагаем, что токен протух — очищаем локальное хранилище
          if (resp.status === 401) {
            try {
              await clearAccessToken();
            } catch (e) {
              // ignore
            }
          }
          const err: any = new Error(detail);
          err.status = resp.status;
          err.payload = json;
          throw err;
        }

        return json;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
    [apiBase],
  );

  /**
   * Регистрация/обновление аккаунта.
   * @param {object} params
   *  - userId: string
   *  - identityKeysJson: string
   *  - oneTimeKeysJson: string
   *  - signature: string
   */

/**
 * Регистрация по логину/паролю.
 * Возвращает access_token + wallet_address + recovery_key (показать один раз).
 */
const authRegister = useCallback(
  async ({login, password, displayName, identityKeysJson, oneTimeKeysJson, signature}: {login: string; password: string; displayName?: string | null; identityKeysJson?: string | null; oneTimeKeysJson?: string | null; signature?: string | null}) => {
    const res = await requestJson('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        login,
        password,
        display_name: displayName ?? null,
        identity_keys_json: identityKeysJson ?? null,
        one_time_keys_json: oneTimeKeysJson ?? null,
        signature: signature ?? null,
      }),
    });

    if (res && res.access_token) {
      await saveAccessToken(res.access_token);
    }

    return res;
  },
  [requestJson],
);

/**
 * Логин по логину/паролю.
 */
const authLogin = useCallback(
  async ({login, password}: {login: string; password: string}) => {
    const res = await requestJson('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        login,
        password,
      }),
    });

    if (res && res.access_token) {
      await saveAccessToken(res.access_token);
    }

    return res;
  },
  [requestJson],
);

/**
 * Подтвердить, что recovery-key был показан пользователю.
 */
const authRecoveryAck = useCallback(async () => {
  return requestJson('/v1/auth/recovery/ack', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}, [requestJson]);

/**
 * Восстановление по recovery-key: сброс пароля и выдача нового recovery-key (по умолчанию).
 */
const authRecoveryReset = useCallback(
  async ({login, recoveryKey, newPassword, rotateRecovery = true}: {login: string; recoveryKey: string; newPassword: string; rotateRecovery?: boolean}) => {
    const res = await requestJson('/v1/auth/recovery/reset', {
      method: 'POST',
      body: JSON.stringify({
        login,
        recovery_key: recoveryKey,
        new_password: newPassword,
        rotate_recovery: !!rotateRecovery,
      }),
    });

    if (res && res.access_token) {
      await saveAccessToken(res.access_token);
    }

    return res;
  },
  [requestJson],
);


  const registerAccount = useCallback(
    async ({userId, identityKeysJson, oneTimeKeysJson, signature}) => {
      const res = await requestJson('/v1/account/register', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          identity_keys_json: identityKeysJson,
          one_time_keys_json: oneTimeKeysJson,
          signature,
        }),
      });

      if (res && res.access_token) {
        await saveAccessToken(res.access_token);
      }

      return res;
    },
    [requestJson],
  );

  /**
   * Получить публичные данные аккаунта (identity + текущие prekeys).
   */
  const getAccount = useCallback(
    async userId => {
      return requestJson(`/v1/account/${encodeURIComponent(userId)}`, {
        method: 'GET',
      });
    },
    [requestJson],
  );

  /**
   * Забрать пакет one-time-keys (prekeys) для установки новой сессии.
   * После этого сервер может удалить пакет, чтобы гарантировать одноразовость.
   */
	const getMe = useCallback(
	  async (opts?: {timeoutMs?: number}) => {
	    return requestJson('/v1/account/me', {
	      method: 'GET',
	      timeoutMs: opts?.timeoutMs,
	    });
	  },
	  [requestJson],
	);


  const walletMe = useCallback(
    async () => {
      return requestJson('/v1/wallet/me', {method: 'GET'});
    },
    [requestJson],
  );

  const walletTx = useCallback(
    async ({limit, beforeTs}: {limit?: number; beforeTs?: number | null} = {}) => {
      const params: string[] = [];
      if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(250, Math.floor(limit)))) )}`);
      }
      if (typeof beforeTs === 'number' && Number.isFinite(beforeTs) && beforeTs > 0) {
        params.push(`before_ts=${encodeURIComponent(String(Math.floor(beforeTs)))}`);
      }
      const qs = params.length ? `?${params.join('&')}` : '';
      return requestJson(`/v1/wallet/tx${qs}`, {method: 'GET'});
    },
    [requestJson],
  );


  const walletSend = useCallback(
    async ({
      toAddress,
      amount,
      memo,
      idempotencyKey,
    }: {
      toAddress: string;
      amount: number;
      memo?: string | null;
      idempotencyKey?: string | null;
    }) => {
      const hdrs: any = {};
      if (idempotencyKey) {
        hdrs['Idempotency-Key'] = idempotencyKey;
      }
      return requestJson('/v1/wallet/send', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          to_address: toAddress,
          amount,
          memo: memo ?? null,
          idempotency_key: idempotencyKey ?? null,
        }),
      });
    },
    [requestJson],
  );

  const withdrawMin = useCallback(
    async () => {
      return requestJson('/v1/withdraw/min', {method: 'GET'});
    },
    [requestJson],
  );

  const withdrawRequest = useCallback(
  async ({
    amount,
    destination,
    comment,
    idempotencyKey,
  }: {
    amount: number;
    destination: string;
    comment?: string | null;
    idempotencyKey?: string | null;
  }) => {
    const hdrs: any = {};
    if (idempotencyKey) {
      hdrs['Idempotency-Key'] = idempotencyKey;
    }
    return requestJson('/v1/withdraw/request', {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({
        amount,
        destination,
        comment: comment ?? null,
        idempotency_key: idempotencyKey ?? null,
      }),
    });
  },
  [requestJson],
);

  const withdrawList = useCallback(
    async () => {
      return requestJson('/v1/withdraw/list', {method: 'GET'});
    },
    [requestJson],
  );

  const fetchPrekeys = useCallback(
    async userId => {
      return requestJson(
        `/v1/account/${encodeURIComponent(userId)}/prekeys`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
    },
    [requestJson],
  );

  /**
   * Создать комнату.
   * @param {object} params
   *  - roomId, title, maxParticipants, isPersistent,
   *  - containerType, templateId, slotId, payloadFormat, ownerId,
   *  - isPrivate, inviteCode
   */
  const createRoom = useCallback(
    async params => {
      const {
        roomId,
        title,
        maxParticipants = 25,
        isPersistent = true,
        isPrivate = false,
        containerType,
        templateId,
        slotId,
        payloadFormat,
        ownerId,
        styleId = 'default',
        settings,
        features,
      } = params;

      return requestJson('/v1/room/create', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          title,
          max_participants: maxParticipants,
          is_persistent: !!isPersistent,
          is_private: !!isPrivate,
          container_type: containerType,
          template_id: templateId,
          slot_id: slotId,
          payload_format: payloadFormat,
          style_id: styleId,
          settings: settings || {},
          features: features || {},
          owner_id: ownerId,
        }),
      });
    },
    [requestJson],
  );

  /**
   * Войти в комнату.
   */
  const joinRoom = useCallback(
    async ({roomId, userId}) => {
      return requestJson('/v1/room/join', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          user_id: userId,
        }),
      });
    },
    [requestJson],
  );



  /**
   * Прочитать анкету (профиль) пользователя.
   */
  const getProfile = useCallback(
    async userId => {
      return requestJson(`/v1/account/${encodeURIComponent(userId)}/profile`, {
        method: 'GET',
      });
    },
    [requestJson],
  );

  /**
   * Обновить анкету (профиль) пользователя.
   */
  const updateProfile = useCallback(
    async ({userId, displayName, about, avatarUrl, extras}) => {
      return requestJson('/v1/account/profile/update', {
        method: 'POST',
        body: JSON.stringify({
          display_name: displayName,
          about,
          avatar_url: avatarUrl,
          extras: extras || undefined,
        }),
      });
    },
    [requestJson],
  );

/**
 * Присоединиться к комнате по инвайт-коду.
 * @param {object} params
 *  - userId: string
 *  - inviteCode: string
 */
const joinRoomByCode = useCallback(
  async ({userId, inviteCode}) => {
    return requestJson('/v1/room/join_by_code', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        invite_code: inviteCode,
      }),
    });
  },
  [requestJson],
);

/**
 * Получить список всех публичных комнат.
 */
const listRooms = useCallback(async () => {
  const resp: any = await requestJson('/v1/room/list_all', {
    method: 'GET',
  });

  // Normalize: server may return array directly or an object with rooms/items field.
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.rooms)) return resp.rooms;
  if (resp && Array.isArray(resp.items)) return resp.items;
  if (resp && resp.data && Array.isArray(resp.data.rooms)) return resp.data.rooms;
  if (resp && resp.data && Array.isArray(resp.data.items)) return resp.data.items;

  return [];
}, [requestJson]);

  /**
   * Прочитать конфиг комнаты.
   */

/**
 * Исключить участника из комнаты (kick).
 * Требует прав owner/moderator на сервере.
 */
const kickRoomMember = useCallback(
  async ({roomId, targetUserId}) => {
    return requestJson('/v1/room/kick', {
      method: 'POST',
      body: JSON.stringify({
        room_id: roomId,
        target_user_id: targetUserId,
      }),
    });
  },
  [requestJson],
);

/**
 * Назначить / снять модератора в комнате (set_role).
 * Роли:
 *   - "member"
 *   - "moderator"
 * Право вызова есть только у владельца комнаты.
 */
const setRoomMemberRole = useCallback(
  async ({roomId, targetUserId, role}) => {
    return requestJson('/v1/room/set_role', {
      method: 'POST',
      body: JSON.stringify({
        room_id: roomId,
        target_user_id: targetUserId,
        role,
      }),
    });
  },
  [requestJson],
);

  const getRoom = useCallback(
    async roomId => {
      return requestJson(`/v1/room/${encodeURIComponent(roomId)}`, {
        method: 'GET',
      });
    },
    [requestJson],
  );


  /**
   * Зарегистрировать push-токен устройства для пользователя.
   */
  const registerPushToken = useCallback(
    async ({userId, platform, token, deviceId}) => {
      return requestJson('/v1/push/register', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          platform,
          token,
          device_id: deviceId ?? null,
        }),
      });
    },
    [requestJson],
  );

  const inviteToRoom = useCallback(
    async ({roomId, peerUserId}) => {
      return requestJson('/v1/room/invite', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          peer_user_id: peerUserId,
        }),
      });
    },
    [requestJson],
  );

  const leaveRoom = useCallback(
    async ({roomId}) => {
      return requestJson('/v1/room/leave', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
        }),
      });
    },
    [requestJson],
  );

  const ensureDirectRoom = useCallback(
    async ({peerUserId}) => {
      return requestJson('/v1/direct/ensure', {
        method: 'POST',
        body: JSON.stringify({
          peer_user_id: peerUserId,
        }),
      });
    },
    [requestJson],
  );

  

/**
 * Сменить пароль (требует текущий пароль). Возвращает новый access_token (старый станет недействителен).
 */
const authChangePassword = useCallback(
  async ({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
  }) => {
    const res = await requestJson('/v1/auth/password/change', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (res && res.access_token) {
      await saveAccessToken(res.access_token);
      return {accessToken: res.access_token};
    }

    return {accessToken: null};
  },
  [requestJson],
);

/**
 * Завершить все сессии (кроме текущей, т.к. выдаём новый токен). Возвращает новый access_token.
 */
const authLogoutAll = useCallback(async () => {
  const res = await requestJson('/v1/auth/logout_all', {method: 'POST'});
  if (res && res.access_token) {
    // Side effect: update stored access token for subsequent requests.
    await saveAccessToken(res.access_token);
    return {accessToken: res.access_token};
  }
  return {accessToken: null};
}, [requestJson]);

/**
 * Сгенерировать новый ключ восстановления. Возвращает новый access_token + recovery_key.
 */
const authRecoveryRotate = useCallback(
  async ({currentPassword}: {currentPassword: string}) => {
    const res = await requestJson('/v1/auth/recovery/rotate', {
      method: 'POST',
      body: JSON.stringify({current_password: currentPassword}),
    });

    if (res && res.access_token && res.recovery_key) {
      // Side effect: update stored access token for subsequent requests.
      await saveAccessToken(res.access_token);
      return {accessToken: res.access_token, recoveryKey: res.recovery_key};
    }
    return {accessToken: null, recoveryKey: null};
  },
  [requestJson],
);

  return {
    authRegister,
    authLogin,
    authRecoveryAck,
    authRecoveryReset,
    authChangePassword,
    authLogoutAll,
    authRecoveryRotate,
    registerAccount,
    getAccount,
    getMe,
    fetchPrekeys,
    getProfile,
    updateProfile,
    createRoom,
    joinRoom,
    joinRoomByCode,
    getRoom,
    listRooms,
    inviteToRoom,
    leaveRoom,
    kickRoomMember,
    setRoomMemberRole,
    ensureDirectRoom,
    walletMe,
    walletTx,
    walletSend,
    withdrawMin,
    withdrawRequest,
    withdrawList,
    registerPushToken,
  };
}
