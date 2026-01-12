# Mobile (Android 12 builder) — памятка

Сборщик: `scripts/build_android12_release.sh` — создаёт RN-проект и накатывает патчи из `src/`, `tools/android/` и `legacy/`.

## Быстрый запуск
```bash
cd /opt/mobile
bash scripts/build_android12_release.sh
```

## Важно
- Runtime-permissions показываются один раз (экран Permissions).
- Recovery key показывается один раз после регистрации.
- CreateRoom имеет fallback: если нет токена/упал API — создаётся локальная комната в SQLite.

См. общий деплой: `/opt/deploy/README.md`
