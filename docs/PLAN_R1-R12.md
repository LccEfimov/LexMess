# План модернизации LexMess (разбит на ответы R1–R12)

Нотация: **Rk** = один мой ответ с готовым архивом и изменениями по пункту.

Статус: **R1 ✅**, **R2 ✅**, **R3 ✅**, **R4 ✅**, **R5 ✅**, **R6 ✅**, **R7 ✅**, **R8 ✅**, **R9 ✅**, **R10 ✅** (сейчас следующий шаг — **R11**).

## R1 — Сервер: auth+wallet+миграции БД
- Добавить поля аккаунта: login(unique), display_name, password_hash, wallet_address, recovery_key_hash, recovery_shown_at.
- Миграции + обновление моделей/репозиториев.

## R2 — Мобилка: миграции SQLite + local_account
- PRAGMA user_version + миграции.
- Таблица local_account: login/display_name/wallet_address/recovery_shown.
- Совместимость со старыми данными rooms/messages.

## R3 — Мобилка: AuthStack Register/Login + token check
- Экраны Register/Login.
- Preloader: /v1/account/me (мягкая проверка) → навигация.
- Сохранение access_token.

## R4 — Мобилка: RecoveryKeyScreen (показ 1 раз)
- Красивый экран с рамкой/копированием.
- Фиксация recovery_shown локально + на сервере.

## R5 — Сервер: обратная совместимость старых /v1/account
- Не ломаем текущий E2E register/login (если используется).
- Прокси/переадресация или параллельные эндпоинты /v1/auth/*.

## R6 — Комнаты: settings/style/flags (server+mobile)
- room_settings_json: style_id, flags, лимиты, media/voice.
- Синхронизация и хранение в SQLite.

## R7 — CreateRoom UI + локальный fallback
- Если токена нет или API упал → локально создать room через upsertRoom.
- Авто-обновление списка комнат на focus.

## R8 — Android permissions через builder + экран
- Добавить манифест/permissions через scripts builder.
- Экран запроса runtime-permissions (POST_NOTIFICATIONS, CAMERA, MIC, READ_MEDIA*).

## R9 — Wallet Screen MVP
- Адрес, копирование, баланс (API), история (минимум заглушки → потом реальные данные).

## R10 — Награды сообщений → wallet_address
- Сервер: при отправке/приёме сообщений фиксировать sender_wallet_address.
- Worker/chain-интеграция: начисления на адрес.

## R11 — Защита auth
- Rate limit, lockout, анти-брут, запрет повторной выдачи recovery_key.
- Санитайз логов.

## R12 — Полировка + доки деплоя
- README деплой /opt/api /opt/lexmess /opt/eincoin /opt/mobile.
- systemd, nginx, env-примеры, smoke-тесты.
