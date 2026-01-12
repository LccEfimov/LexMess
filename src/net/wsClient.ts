import {WS_URL} from '../config/networkConfig';
import {injectIncomingContainer} from '../bus/messageBus';
import {injectIncomingRtc, IncomingRtcSignal, OutgoingRtcSignal} from '../bus/rtcBus';
import {injectDeliveryAck} from '../bus/deliveryBus';
import {getAccessToken} from '../storage/authTokenStorage';
import {isAppActive, onAppStateChange} from '../utils/appState';

export type OutgoingContainerPayload = {
  roomId: string;
  userId: string;
  messageType: number; // 0=text,1=file,2=audio,3=video
  containerBase64: string;
  fileName?: string;
  extension?: string;
  clientMsgId?: string;
};

export type RoomClientOptions = {
  roomId: string;
  userId: string;
};

type ServerWsMessage =
  | {type: 'pong'}
  | {type: 'ack'; roomId?: string; userId?: string; clientMsgId?: string; kind?: string; ts?: number}
  | {
      type: 'container';
      id?: string;
      roomId?: string;
      from?: string;
      messageType?: number;
      containerBase64?: string;
      fileName?: string;
      extension?: string;
      clientMsgId?: string;
      ts?: number;
    }
  | {
      type: 'rtc';
      roomId?: string;
      from?: string;
      to?: string;
      callId?: string;
      signalType?: string;
      payload?: any;
      ts?: number;
    };

function normalizeWsBase(base: string): string {
  // networkConfig declares WS_URL without "/ws" suffix
  // so we append "/ws" unless it's already present.
  const b = String(base || '').replace(/\s+/g, '');
  if (!b) return '';
  if (b.endsWith('/')) {
    if (b.endsWith('/ws/')) return b.slice(0, -1);
    if (b.endsWith('/ws')) return b.slice(0, -1);
    return b.slice(0, -1) + '/ws';
  }
  if (b.endsWith('/ws')) return b;
  return b + '/ws';
}

class RoomWsClient {
  opts: RoomClientOptions;
  socket: WebSocket | null = null;
  manuallyClosed = false;

  appStateUnsub: null | (() => void) = null;
  reconnectPending = false;

  heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  lastPongTs: number = 0;

  reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  reconnectAttempt = 0;

  pendingContainers: OutgoingContainerPayload[] = [];
  pendingRtc: OutgoingRtcSignal[] = [];
  pendingReadTs: number | null = null;

  constructor(opts: RoomClientOptions) {
    this.opts = opts;

    // Avoid reconnect storm in background. Reconnect when app becomes active.
    try {
      this.appStateUnsub = onAppStateChange(state => {
        if (this.manuallyClosed) return;
        const active = String(state) === 'active';
        if (active && this.reconnectPending) {
          this.reconnectPending = false;
          if (!this.isOpen()) {
            this.connect();
          }
        }
      });
    } catch {}

    this.connect();
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.lastPongTs = Date.now();

    this.heartbeatTimer = setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      // If no pong for too long - reconnect.
      const silentMs = Date.now() - this.lastPongTs;
      if (silentMs > 25_000) {
        // eslint-disable-next-line no-console
        console.warn('[wsClient] heartbeat timeout, reconnecting...');
        try {
          socket.close();
        } catch {}
        return;
      }

      try {
        socket.send(JSON.stringify({type: 'ping', ts: Date.now()}));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[wsClient] ping send failed', e);
      }
    }, 6_000);
  }

  private scheduleReconnect() {
    if (this.manuallyClosed) return;
    if (!isAppActive()) {
      this.reconnectPending = true;
      return;
    }
    this.clearReconnect();

    const attempt = Math.min(this.reconnectAttempt + 1, 8);
    this.reconnectAttempt = attempt;

    const base = 700;
    const max = 9000;
    const jitter = Math.floor(Math.random() * 400);
    const delay = Math.min(max, base * attempt + jitter);

    this.reconnectTimer = setTimeout(() => {
      if (this.manuallyClosed) return;
      this.connect();
    }, delay);
  }

  async connect() {
    if (this.manuallyClosed) return;
    if (!isAppActive()) {
      this.reconnectPending = true;
      return;
    }

    this.clearReconnect();

    let urlBase = normalizeWsBase(WS_URL);
    if (!urlBase) {
      // eslint-disable-next-line no-console
      console.warn('[wsClient] WS_URL is empty');
      return;
    }

    // attach token & roomId as query params for server auth/routing
    let url = urlBase;
    try {
      const token = await getAccessToken();
      const sep = url.includes('?') ? '&' : '?';
      if (token) {
        url = `${url}${sep}token=${encodeURIComponent(token)}&room_id=${encodeURIComponent(
          this.opts.roomId,
        )}`;
      } else {
        url = `${url}${sep}room_id=${encodeURIComponent(this.opts.roomId)}`;
      }
    } catch (e) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}room_id=${encodeURIComponent(this.opts.roomId)}`;
    }

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempt = 0;
        try {
          socket.send(
            JSON.stringify({
              type: 'hello',
              roomId: this.opts.roomId,
              userId: this.opts.userId,
              ts: Date.now(),
            }),
          );
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[wsClient] send hello failed', e);
        }

        this.startHeartbeat();
        this.flushPending();
      };

      socket.onmessage = event => {
        try {
          const msg = JSON.parse(String(event.data)) as ServerWsMessage;
          if (!msg || !(msg as any).type) {
            return;
          }

          if (msg.type === 'pong') {
            this.lastPongTs = Date.now();
            return;
          }

          if (msg.type === 'ack') {
            injectDeliveryAck({
              roomId: String(msg.roomId || this.opts.roomId),
              userId: msg.userId ? String(msg.userId) : undefined,
              clientMsgId: msg.clientMsgId ? String(msg.clientMsgId) : undefined,
              kind: msg.kind ? String(msg.kind) : undefined,
              ts: typeof msg.ts === 'number' ? msg.ts : undefined,
            });
            return;
          }

          if (msg.type === 'container') {
            if (!msg.containerBase64) return;
            injectIncomingContainer({
              id: String(msg.id || msg.clientMsgId || `${Date.now()}`),
              roomId: String(msg.roomId || this.opts.roomId),
              senderId: String(msg.from || ''),
              messageType: typeof msg.messageType === 'number' ? msg.messageType : 0,
              containerBase64: String(msg.containerBase64),
              fileName: msg.fileName ? String(msg.fileName) : undefined,
              extension: msg.extension ? String(msg.extension) : undefined,
              clientMsgId: msg.clientMsgId ? String(msg.clientMsgId) : undefined,
              ts: typeof msg.ts === 'number' ? msg.ts : undefined,
            });
            return;
          }

          if (msg.type === 'rtc') {
            const rtc: IncomingRtcSignal = {
              roomId: String(msg.roomId || this.opts.roomId),
              from: msg.from ? String(msg.from) : '',
              to: msg.to ? String(msg.to) : undefined,
              callId: msg.callId ? String(msg.callId) : undefined,
              signalType: msg.signalType ? String(msg.signalType) : 'unknown',
              payload: msg.payload,
              ts: typeof msg.ts === 'number' ? msg.ts : Date.now(),
            };
            injectIncomingRtc(rtc);
            return;
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[wsClient] onmessage parse failed', e);
        }
      };

      socket.onclose = () => {
        this.socket = null;
        this.clearHeartbeat();
        if (!this.manuallyClosed) {
          this.scheduleReconnect();
        }
      };

      socket.onerror = ev => {
        // eslint-disable-next-line no-console
        console.warn('[wsClient] socket error', ev);
      };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[wsClient] connect failed', e);
      this.scheduleReconnect();
    }
  }

  isOpen(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  flushPending() {
    // Containers
    if (this.pendingContainers.length > 0) {
      const batch = [...this.pendingContainers];
      this.pendingContainers = [];
      for (const p of batch) {
        this.sendContainer(p);
      }
    }

    // RTC signals
    if (this.pendingRtc.length > 0) {
      const batch = [...this.pendingRtc];
      this.pendingRtc = [];
      for (const s of batch) {
        this.sendRtc(s);
      }
    }

    // Read ack
    if (this.pendingReadTs && this.pendingReadTs > 0) {
      const ts = this.pendingReadTs;
      this.pendingReadTs = null;
      this.sendRead(ts);
    }
  }

  sendRead(ts: number): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.pendingReadTs = Math.max(this.pendingReadTs || 0, ts);
      return false;
    }

    try {
      socket.send(
        JSON.stringify({
          type: 'read',
          roomId: this.opts.roomId,
          userId: this.opts.userId,
          ts,
        }),
      );
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[wsClient] sendRead failed', e);
      this.pendingReadTs = Math.max(this.pendingReadTs || 0, ts);
      return false;
    }
  }

  sendContainer(payload: OutgoingContainerPayload): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.pendingContainers.push(payload);
      return false;
    }

    const msg: any = {
      type: 'container',
      roomId: payload.roomId,
      from: payload.userId,
      messageType: payload.messageType,
      containerBase64: payload.containerBase64,
      fileName: payload.fileName,
      extension: payload.extension,
      ts: Date.now(),
    };

    if (payload.clientMsgId) {
      msg.clientMsgId = payload.clientMsgId;
    }

    try {
      socket.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[wsClient] sendContainer failed', e);
      this.pendingContainers.push(payload);
      return false;
    }
  }

  sendRtc(signal: OutgoingRtcSignal) {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.pendingRtc.push(signal);
      return;
    }

    const msg: any = {
      type: 'rtc',
      roomId: signal.roomId,
      from: signal.from,
      to: signal.to,
      callId: signal.callId,
      signalType: signal.signalType,
      payload: signal.payload,
      ts: Date.now(),
    };

    try {
      socket.send(JSON.stringify(msg));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[wsClient] sendRtc failed', e);
      this.pendingRtc.push(signal);
    }
  }

  dispose() {
    this.manuallyClosed = true;
    try {
      this.appStateUnsub?.();
    } catch {}
    this.appStateUnsub = null;
    this.pendingContainers = [];
    this.pendingRtc = [];
    this.pendingReadTs = null;

    this.clearReconnect();
    this.clearHeartbeat();

    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }
}

const clientsByRoom = new Map<string, RoomWsClient>();

export async function ensureRoomConnection(opts: RoomClientOptions): Promise<void> {
  const existing = clientsByRoom.get(opts.roomId);
  if (existing) {
    return;
  }
  const client = new RoomWsClient(opts);
  clientsByRoom.set(opts.roomId, client);
}

export function disposeRoomConnection(roomId: string): void {
  const client = clientsByRoom.get(roomId);
  if (!client) return;
  client.dispose();
  clientsByRoom.delete(roomId);
}

export function isRoomConnected(roomId: string): boolean {
  const client = clientsByRoom.get(roomId);
  return !!client && client.isOpen();
}

export function sendRoomRead(roomId: string, ts: number): boolean {
  const client = clientsByRoom.get(roomId);
  if (!client) {
    return false;
  }
  return client.sendRead(ts);
}

export function sendRoomContainer(payload: OutgoingContainerPayload): boolean {
  const client = clientsByRoom.get(payload.roomId);
  if (!client) {
    // eslint-disable-next-line no-console
    console.warn('[wsClient] sendRoomContainer: no client for room', payload.roomId);
    return false;
  }
  return client.sendContainer(payload);
}

export function sendRoomRtcSignal(signal: OutgoingRtcSignal): void {
  const client = clientsByRoom.get(signal.roomId);
  if (!client) {
    // eslint-disable-next-line no-console
    console.warn('[wsClient] sendRoomRtcSignal: no client for room', signal.roomId);
    return;
  }
  client.sendRtc(signal);
}
