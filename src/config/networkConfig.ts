// Конфигурация сетевого уровня LexMess.
// Здесь указывается адрес WebSocket-сервера-ретранслятора.
//
// При разработке на эмуляторе Android можно использовать что-то вроде:
//   ws://10.0.2.2:8765
// Для реального устройства — IP/домен сервера с запущенным FastAPI+WS.
/**
 * Network endpoints.
 *
 * IMPORTANT:
 * - Android emulator uses 10.0.2.2 to reach the host machine.
 * - Production uses api.lexmess.ru.
 */

// HTTP(S) API base URL (FastAPI)
export const API_BASE_URL = __DEV__ ? 'http://10.0.2.2:8000' : 'https://api.lexmess.ru';

// WS(S) base URL (WITHOUT the "/ws" suffix). wsClient adds "/ws".
export const WS_BASE_URL = __DEV__ ? 'ws://10.0.2.2:8000' : 'wss://api.lexmess.ru';

// Back-compat alias (old code used WS_URL)
export const WS_URL = WS_BASE_URL;
