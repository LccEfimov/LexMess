import 'react-native-gesture-handler';
// Secure random for tweetnacl / ключи (иначе будет "no PRNG").
import 'react-native-get-random-values';

import {AppRegistry} from 'react-native';
import {Buffer} from 'buffer';

import App from './src/App';
import {name as appName} from './app.json';

// Buffer polyfill (используется в крипто/стего конвейере)
// eslint-disable-next-line no-global-assign
global.Buffer = global.Buffer || Buffer;



// FCM background handler (опционально). Не падаем, если Firebase не подключён.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {NativeModules} = require('react-native');
  const nm = NativeModules || {};
  const has =
    Boolean(
      nm?.RNFBMessagingModule ||
        nm?.RNFirebaseMessagingModule ||
        nm?.RNFBAppModule ||
        nm?.RNFirebaseModule,
    );
  if (has) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-firebase/messaging');
    const messaging = mod?.default || mod;
    if (messaging) {
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        // Можно логировать/складывать в локальную очередь, но не роняем процесс.
        // eslint-disable-next-line no-console
        console.log('[push] background message', remoteMessage?.data || {});
      });
    }
  }
} catch (e) {
  // ignore
}
AppRegistry.registerComponent(appName, () => App);
