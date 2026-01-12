# LexMess Mobile — сборка Android 12+ (release, подписано)

Этот архив содержит **оверлей исходников** (src/, app.json, index.js) + скрипты, которые:
1) создают React Native проект в `/opt/mobile/app/`;
2) ставят зависимости;
3) добавляют native-модуль `LexmessCore` (Android);
4) выставляют `minSdkVersion = 31` (Android 12+);
5) генерируют **самописный keystore** и включают release-signing;
6) собирают **release APK**.

## Требования на сервере

- Ubuntu 22.04+ (или аналогичный Linux)
- Node.js 18+ и npm (скрипт при необходимости подтянет Node 20.19.4 локально)
- Java (JDK 17)
- Android SDK (platform-tools + build-tools) + переменная `ANDROID_SDK_ROOT` (или `ANDROID_HOME`)
- Доступ в интернет (нужен для инициализации RN и `npm install`)

## Развёртывание в `/opt/mobile/`

```bash
sudo mkdir -p /opt/mobile
sudo chown -R $USER:$USER /opt/mobile

cd /opt/mobile
# распакуйте сюда содержимое архива

chmod +x /opt/mobile/scripts/build_android12_release.sh
/opt/mobile/scripts/build_android12_release.sh
```

## Где будет APK

После сборки APK лежит примерно тут:

`/opt/mobile/app/android/app/build/outputs/apk/release/app-release.apk`

Скрипт также выводит путь в консоль.

## Keystore и подпись

Keystore генерируется сюда:

- `/opt/mobile/app/android/app/lexmess-release.keystore`

Параметры подписи лежат в:

- `/opt/mobile/app/android/keystore.properties`

Перед публикацией поменяйте пароли и **не теряйте keystore** (иначе обновления приложения подписать тем же ключом не получится).

## Примечания

- Скрипт ставит stub для `pod` (чтобы `react-native init` не падал на Linux).

- Реализация `LexmessCore` на Android делает:
  - `encryptLcc/decryptLcc`: AES-256-GCM (ключ = SHA-256(passphrase||roomId||peerId))
  - `embedContainerInPng/extractContainerFromPng`: контейнер кладётся в ancillary PNG chunk `lxMS`


- Папка legacy/ содержит старые заготовки JNI/iOS из исходного архива и в сборке Android (через RN init) не используется.

## Разрешения Android

В сборщике добавлен патч `AndroidManifest.xml` и экран gate **«Разрешения»**.

### Что добавляется в манифест

- INTERNET, ACCESS_NETWORK_STATE
- WAKE_LOCK, VIBRATE
- CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS
- POST_NOTIFICATIONS
- BLUETOOTH_CONNECT
- READ_MEDIA_IMAGES/VIDEO/AUDIO (Android 13+)
- READ_EXTERNAL_STORAGE (только до Android 12L/32)
- FOREGROUND_SERVICE

### Что запрашивается в рантайме

Приложение 1 раз показывает экран со списком runtime-разрешений. Можно нажать:
- «Разрешить всё» (requestMultiple)
- «Пропустить пока» (gate не блокирует запуск)
- «Открыть настройки» (системные настройки приложения)


## R1–R12 (актуальная архитектура)
- Регистрация/логин: `/v1/auth/register`, `/v1/auth/login` (без email/телефона).
- После регистрации показывается `recovery_key` один раз (экран RecoveryKey).
- У аккаунта есть `wallet_address` (экран Wallet).
- CreateRoom: если токена нет или API недоступен — локальная комната в SQLite.

## Деплой
Смотрите: `docs/DEPLOY_MOBILE.md` и общий гайд `/opt/deploy/README.md` (в full-архиве).


## Пуши (FCM)

Пуши работают через **Firebase Cloud Messaging** и включаются **только если** вы положите файл:

- `firebase/google-services.json`

Тогда сборщик автоматически:
- поставит `@react-native-firebase/app` и `@react-native-firebase/messaging`;
- добавит `google-services` Gradle plugin;
- скопирует `google-services.json` в `android/app/`.

На сервере задайте `FCM_SERVER_KEY` в `.env` (см. full-архив).
