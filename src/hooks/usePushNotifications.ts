import {useEffect} from 'react';
import {NativeModules, Platform} from 'react-native';
import {logger} from '../utils/logger';

// Пуши опциональны. Если Firebase не подключён (зависимостей/конфига нет),
// этот хук тихо превращается в no-op.
//
// В некоторых сборках Metro/Hermes может падать на `require(...)` ("unknown module \"undefined\"")
// если модуль не был корректно собран/подключён. Поэтому сначала проверяем наличие
// нативных RNFirebase модулей и только потом делаем require.
let cachedMessaging: any | null | undefined = undefined;

function hasFirebaseMessagingNative(): boolean {
  const nm: any = NativeModules;
  return Boolean(
    nm?.RNFBMessagingModule ||
      nm?.RNFirebaseMessagingModule ||
      nm?.RNFBAppModule ||
      nm?.RNFirebaseModule,
  );
}

function getMessaging(): any | null {
  if (cachedMessaging !== undefined) {
    return cachedMessaging;
  }

  if (!hasFirebaseMessagingNative()) {
    cachedMessaging = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-firebase/messaging');
    cachedMessaging = mod?.default || mod;
    return cachedMessaging;
  } catch {
    cachedMessaging = null;
    return null;
  }
}

type UsePushOptions = {
  onNavigateToRoom?: (roomId: string) => void;
  onNavigateToWallet?: () => void;
  onIncrementBadge?: () => void;
};

export function usePushNotifications(
  userId: string | null,
  api: any | null,
  opts?: UsePushOptions,
) {
  useEffect(() => {
    if (!userId || !api) {
      return;
    }

    let messaging: any | null = null;
    try {
      messaging = getMessaging();
    } catch (e) {
      // В реальных сборках Hermes/Metro иногда вылетает "Requiring unknown module \"undefined\""
      // из firebase-модулей при неполной линковке/конфиге. Не роняем всё приложение.
      logger.warn('push', 'getMessaging failed (push disabled)', {error: e});
      return;
    }
    if (!messaging) {
      // Firebase не подключён — не падаем, просто отключаем пуши.
      return;
    }

    let cancelled = false;
    let unsubscribeOnMessage: any | null = null;
    let unsubscribeOnTokenRefresh: any | null = null;
    let unsubscribeOnOpened: any | null = null;

    const safeOpts: UsePushOptions = opts || {};

    const handleRemoteMessage = async (remoteMessage: any) => {
      if (!remoteMessage || cancelled) {
        return;
      }

      // кошелёк/вывод
      if (type && (type.startsWith('wallet') || type.startsWith('withdraw'))) {
        try {
          safeOpts.onNavigateToWallet?.();
        } catch (e) {
          logger.warn('push', 'onNavigateToWallet failed', {error: e});
        }
      }
      const data = remoteMessage.data || {};
      const typeRaw = data.type || data.kind || data.event || null;
      const type = typeRaw ? String(typeRaw).toLowerCase() : null;
      const roomId = data.roomId || data.room_id || null;

      try {
        safeOpts.onIncrementBadge?.();
      } catch (e) {
        logger.warn('push', 'onIncrementBadge failed', {error: e});
      }

      if (roomId) {
        try {
          safeOpts.onNavigateToRoom?.(roomId);
        } catch (e) {
          logger.warn('push', 'onNavigateToRoom failed', {error: e});
        }
      }
    };

    async function register(token: string | null) {
      if (!token || cancelled) {
        return;
      }
      try {
        await api.registerPushToken({
          userId,
          platform: Platform.OS,
          token,
          deviceId: null,
        });
      } catch (e) {
        logger.warn('push', 'registerPushToken failed', {error: e});
      }
    }

    async function init() {
      try {
        // iOS permission prompt, Android 13+ POST_NOTIFICATIONS — на нативном слое.
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          return;
        }

        await messaging().registerDeviceForRemoteMessages();

        const token = await messaging().getToken();
        await register(token);

        unsubscribeOnTokenRefresh = messaging().onTokenRefresh(async (newToken: string) => {
          await register(newToken);
        });

        unsubscribeOnMessage = messaging().onMessage(async (remoteMessage: any) => {
          logger.info('push', 'foreground message', {data: remoteMessage?.data || {}});
          await handleRemoteMessage(remoteMessage);
        });

        unsubscribeOnOpened = messaging().onNotificationOpenedApp(async (remoteMessage: any) => {
          await handleRemoteMessage(remoteMessage);
        });

        const initialMessage = await messaging().getInitialNotification();
        if (initialMessage) {
          await handleRemoteMessage(initialMessage);
        }
      } catch (e) {
        logger.warn('push', 'init push failed', {error: e});
      }
    }

    init();

    return () => {
      cancelled = true;
      try {
        unsubscribeOnMessage?.();
      } catch {
        // ignore
      }
      try {
        unsubscribeOnTokenRefresh?.();
      } catch {
        // ignore
      }
      try {
        unsubscribeOnOpened?.();
      } catch {
        // ignore
      }
    };
  }, [userId, api, opts]);
}
