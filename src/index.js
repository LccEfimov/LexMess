import 'react-native-gesture-handler';

import {AppRegistry} from 'react-native';
import {Buffer} from 'buffer';

import App from './src/App';
import {name as appName} from './app.json';

// Buffer polyfill (используется в крипто/стего конвейере)
// eslint-disable-next-line no-global-assign
global.Buffer = global.Buffer || Buffer;

AppRegistry.registerComponent(appName, () => App);
