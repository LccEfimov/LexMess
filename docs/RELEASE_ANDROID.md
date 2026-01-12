# Android Release Notes (R34)

Сборка (Ubuntu 22.04, Android SDK 34, JDK 17):
```bash
cd /opt/mobile
./scripts/build_android12_release.sh
```

Артефакт:
- `app/android/app/build/outputs/apk/release/*.apk`

Рекомендуется:
- хранить APK вместе с `src/config/buildInfo.ts` (версия)
- keystore хранить отдельно и бэкапить
