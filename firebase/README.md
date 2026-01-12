# Firebase / FCM (push)

Чтобы включить push-уведомления:

1) Создайте проект в Firebase Console.
2) Добавьте Android-приложение с applicationId (пакетом) **com.lexmess** (или ваш FINAL_PKG).
3) Скачайте `google-services.json`.
4) Положите его сюда: `firebase/google-services.json`
5) Запустите сборку: `scripts/build_android12_release.sh`

Если файла `firebase/google-services.json` нет — сборщик не включает Firebase, а пуши превращаются в no-op.
