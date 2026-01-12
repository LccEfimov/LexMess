import {useCallback, useEffect, useRef, useState} from 'react';
import {
  RTCPeerConnection,
  mediaDevices,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';

import {subscribeRtc, IncomingRtcSignal, clearLastOffer} from '../bus/rtcBus';
import {API_BASE_URL} from '../config/networkConfig';
import {getAccessToken} from '../storage/authTokenStorage';
import {
  sendRoomRtcSignal,
  ensureRoomConnection,
  disposeRoomConnection,
} from '../net/wsClient';

type UseWebRtcP2POptions = {
  roomId: string;
  userId: string;
  preferVideo: boolean;
  targetUserId?: string | null;
};

type InternalState = {
  inCall: boolean;
  connected: boolean;
  connectionState: string;
  reconnecting: boolean;
  isVideo: boolean;
  callId: string | null;
  remoteUserId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  audioMuted: boolean;
  videoEnabled: boolean;
  speakerOn: boolean;
};

let cachedIceServers: any[] | null = null;
let cachedIceServersTs = 0;

async function fetchIceServers(): Promise<any[]> {
  const now = Date.now();
  if (cachedIceServers && now - cachedIceServersTs < 10 * 60 * 1000) {
    return cachedIceServers;
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE_URL}/v1/webrtc/ice_config`, {
      method: 'GET',
      headers: token ? {Authorization: `Bearer ${token}`} : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.iceServers) && data.iceServers.length) {
        cachedIceServers = data.iceServers;
        cachedIceServersTs = now;
        return cachedIceServers;
      }
    }
  } catch {
    // ignore
  }

  cachedIceServers = [{urls: 'stun:stun.l.google.com:19302'}];
  cachedIceServersTs = now;
  return cachedIceServers;
}

function isConnectedState(st?: string | null): boolean {
  return st === 'connected' || st === 'completed';
}

export function useWebRtcP2P(options: UseWebRtcP2POptions) {
  const [state, setState] = useState<InternalState>({
    inCall: false,
    connected: false,
    connectionState: 'new',
    reconnecting: false,
    isVideo: options.preferVideo,
    callId: null,
    remoteUserId: null,
    localStream: null,
    remoteStream: null,
    audioMuted: false,
    videoEnabled: options.preferVideo,
    speakerOn: false,
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomIdRef = useRef(options.roomId);
  const userIdRef = useRef(options.userId);
  const remoteToRef = useRef<string | null>(options.targetUserId || null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);

  const isCallerRef = useRef<boolean>(false);
  const restartAttemptsRef = useRef<number>(0);
  const disconnectTimerRef = useRef<any>(null);
  const reconnectInFlightRef = useRef<boolean>(false);

  useEffect(() => {
    roomIdRef.current = options.roomId;
    userIdRef.current = options.userId;
    remoteToRef.current = options.targetUserId || null;
  }, [options.roomId, options.userId, options.targetUserId]);

  const sendSignal = useCallback(
    (signalType: string, payload: any, to?: string) => {
      sendRoomRtcSignal({
        roomId: roomIdRef.current,
        from: userIdRef.current,
        signalType,
        payload,
        to,
      });
    },
    [],
  );

  const cleanupPeer = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    reconnectInFlightRef.current = false;
    restartAttemptsRef.current = 0;

    const pc = pcRef.current;
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        // @ts-expect-error RN-webrtc type may not include these
        pc.oniceconnectionstatechange = null;
        // @ts-expect-error RN-webrtc type may not include these
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {
        // ignore
      }
    }
    pcRef.current = null;

    const local = localStreamRef.current;
    if (local) {
      local.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }
    localStreamRef.current = null;

    callIdRef.current = null;
    isCallerRef.current = false;

    setState(prev => ({
      ...prev,
      inCall: false,
      connected: false,
      connectionState: 'closed',
      reconnecting: false,
      callId: null,
      remoteUserId: null,
      localStream: null,
      remoteStream: null,
      audioMuted: false,
      // videoEnabled оставляем как есть
      speakerOn: false,
    }));
  }, []);

  useEffect(() => {
    // Для звонков нужна активная WS-связь комнаты.
    ensureRoomConnection({
      roomId: roomIdRef.current,
      userId: userIdRef.current,
      nickname: userIdRef.current,
    });

    return () => {
      disposeRoomConnection(roomIdRef.current);
      cleanupPeer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensurePeer = useCallback(
    async (isVideo: boolean): Promise<RTCPeerConnection> => {
      if (pcRef.current) {
        return pcRef.current;
      }

      const iceServers = await fetchIceServers();
      const pc = new RTCPeerConnection({iceServers});
      pcRef.current = pc;

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      localStreamRef.current = stream;

      setState(prev => ({
        ...prev,
        isVideo,
        localStream: stream,
        videoEnabled: isVideo,
      }));

      pc.onicecandidate = event => {
        if (event.candidate && callIdRef.current) {
          sendSignal(
            'candidate',
            {callId: callIdRef.current, candidate: event.candidate},
            remoteToRef.current || undefined,
          );
        }
      };

      pc.ontrack = event => {
        const [remote] = event.streams;
        setState(prev => ({
          ...prev,
          remoteStream: remote,
        }));
      };

      // Connection state (reconnect logic)
      const updateConn = () => {
        const iceState = (pc as any).iceConnectionState as string | undefined;
        const connState = (pc as any).connectionState as string | undefined;
        const merged = connState || iceState || 'new';
        const connected = isConnectedState(iceState) || isConnectedState(connState);

        setState(prev => ({
          ...prev,
          connectionState: merged,
          connected: connected || prev.connected,
          reconnecting:
            prev.reconnecting && (connected ? false : prev.reconnecting),
        }));

        if (connected) {
          restartAttemptsRef.current = 0;
          reconnectInFlightRef.current = false;
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          return;
        }

        // auto retry (caller only)
        if (iceState === 'failed') {
          void tryIceRestart('auto_failed');
        } else if (iceState === 'disconnected') {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
          }
          disconnectTimerRef.current = setTimeout(() => {
            const st = (pc as any).iceConnectionState as string | undefined;
            if (st === 'disconnected') {
              void tryIceRestart('auto_disconnected');
            }
          }, 3500);
        }
      };

      // @ts-expect-error RN-webrtc type may not include these
      pc.oniceconnectionstatechange = updateConn;
      // @ts-expect-error RN-webrtc type may not include these
      pc.onconnectionstatechange = updateConn;

      return pc;
    },
    [sendSignal],
  );

  const startOutgoingCall = useCallback(
    async (isVideo: boolean) => {
      if (state.inCall) {
        return;
      }

      const callId = `${userIdRef.current}-${Date.now()}`;
      callIdRef.current = callId;
      isCallerRef.current = true;
      restartAttemptsRef.current = 0;
      reconnectInFlightRef.current = false;

      setState(prev => ({
        ...prev,
        inCall: true,
        connected: false,
        connectionState: 'new',
        reconnecting: false,
        isVideo,
        callId,
        remoteUserId: remoteToRef.current || null,
      }));

      const pc = await ensurePeer(isVideo);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignal(
        'offer',
        {callId, sdp: offer, isVideo, restart: false},
        remoteToRef.current || undefined,
      );
    },
    [ensurePeer, sendSignal, state.inCall],
  );

  const tryIceRestart = useCallback(
    async (reason: 'manual' | 'auto_failed' | 'auto_disconnected') => {
      if (!callIdRef.current) {
        return;
      }
      if (!pcRef.current) {
        return;
      }
      if (!remoteToRef.current) {
        return;
      }
      if (!isCallerRef.current) {
        // чтобы избежать "glare" — перезапуск делает только инициатор
        return;
      }
      if (reconnectInFlightRef.current) {
        return;
      }
      if (restartAttemptsRef.current >= 3) {
        return;
      }

      reconnectInFlightRef.current = true;
      restartAttemptsRef.current += 1;

      setState(prev => ({...prev, reconnecting: true}));

      try {
        const pc = pcRef.current;
        if (!pc) {
          reconnectInFlightRef.current = false;
          setState(prev => ({...prev, reconnecting: false}));
          return;
        }

        const offer = await pc.createOffer({iceRestart: true} as any);
        await pc.setLocalDescription(offer);

        sendSignal(
          'offer',
          {
            callId: callIdRef.current,
            sdp: offer,
            isVideo: state.isVideo,
            restart: true,
            reason,
            attempt: restartAttemptsRef.current,
          },
          remoteToRef.current || undefined,
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useWebRtcP2P] iceRestart failed', e);
      } finally {
        reconnectInFlightRef.current = false;
        // reconnecting выключим, когда увидим connected
      }
    },
    [sendSignal, state.isVideo],
  );

  const handleOffer = useCallback(
    async (signal: IncomingRtcSignal) => {
      const {from, payload} = signal;
      const {callId, sdp} = payload || {};
      if (!callId || !sdp) {
        return;
      }

      // offer можно переигрывать (ICE-restart). Очистим lastOffer для текущего callId.
      clearLastOffer(callId);

      // Если это новый callId и мы уже в звонке — busy
      if (state.inCall && callIdRef.current && callIdRef.current !== callId) {
        sendSignal('busy', {callId, reason: 'in_call'}, from);
        return;
      }

      // Приняли входящий offer (или renegotiation)
      remoteToRef.current = from;
      isCallerRef.current = false;
      callIdRef.current = callId;

      const isVideo =
        payload && typeof payload.isVideo === 'boolean'
          ? !!payload.isVideo
          : options.preferVideo;

      setState(prev => ({
        ...prev,
        inCall: true,
        connected: false,
        connectionState: prev.connectionState || 'new',
        reconnecting: false,
        callId,
        remoteUserId: from,
        isVideo,
      }));

      const pc = await ensurePeer(isVideo);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', {callId, sdp: answer}, from);
    },
    [ensurePeer, options.preferVideo, sendSignal, state.inCall],
  );

  const handleAnswer = useCallback(async (signal: IncomingRtcSignal) => {
    const {payload} = signal;
    const {callId, sdp} = payload || {};
    if (!callId || !sdp) {
      return;
    }
    if (!callIdRef.current || callIdRef.current !== callId) {
      return;
    }

    const pc = pcRef.current;
    if (!pc) {
      return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    setState(prev => ({...prev, connected: true}));
  }, []);

  const handleCandidate = useCallback(async (signal: IncomingRtcSignal) => {
    const {payload} = signal;
    const {callId, candidate} = payload || {};
    if (!callId || !candidate) {
      return;
    }
    if (!callIdRef.current || callIdRef.current !== callId) {
      return;
    }

    const pc = pcRef.current;
    if (!pc) {
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[useWebRtcP2P] addIceCandidate failed', e);
    }
  }, []);

  const handleHangupSignal = useCallback(() => {
    cleanupPeer();
  }, [cleanupPeer]);

  const handleBusy = useCallback(
    (signal: IncomingRtcSignal) => {
      const {payload} = signal;
      const {callId} = payload || {};
      if (!callId || !callIdRef.current || callIdRef.current !== callId) {
        return;
      }
      cleanupPeer();
    },
    [cleanupPeer],
  );

  useEffect(() => {
    const unsubscribe = subscribeRtc(signal => {
      if (signal.to && signal.to !== userIdRef.current) {
        return;
      }

      switch (signal.signalType) {
        case 'offer':
          void handleOffer(signal);
          break;
        case 'answer':
          void handleAnswer(signal);
          break;
        case 'candidate':
          void handleCandidate(signal);
          break;
        case 'hangup':
          handleHangupSignal();
          break;
        case 'busy':
          handleBusy(signal);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [handleAnswer, handleBusy, handleCandidate, handleHangupSignal, handleOffer]);

  const hangup = useCallback(() => {
    if (callIdRef.current) {
      const currentId = callIdRef.current;
      sendSignal('hangup', {callId: currentId}, remoteToRef.current || undefined);
      clearLastOffer(currentId);
    } else {
      clearLastOffer(null);
    }
    cleanupPeer();
  }, [cleanupPeer, sendSignal]);

  const toggleMute = useCallback(() => {
    const local = localStreamRef.current;
    if (!local) {
      return;
    }
    const nextMuted = !state.audioMuted;
    local.getAudioTracks().forEach(t => {
      t.enabled = !nextMuted;
    });
    setState(prev => ({...prev, audioMuted: nextMuted}));
  }, [state.audioMuted]);

  const toggleVideo = useCallback(() => {
    const local = localStreamRef.current;
    if (!local) {
      return;
    }
    const nextEnabled = !state.videoEnabled;
    local.getVideoTracks().forEach(t => {
      t.enabled = nextEnabled;
    });
    setState(prev => ({...prev, videoEnabled: nextEnabled}));
  }, [state.videoEnabled]);

  const switchCamera = useCallback(() => {
    const local = localStreamRef.current;
    if (!local) {
      return;
    }
    const track: any = local.getVideoTracks()[0];
    if (track && typeof track._switchCamera === 'function') {
      try {
        track._switchCamera();
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    // Для полноценного speaker route лучше InCallManager, но как минимум отразим состояние.
    setState(prev => ({...prev, speakerOn: !prev.speakerOn}));
  }, []);

  const reconnect = useCallback(() => {
    void tryIceRestart('manual');
  }, [tryIceRestart]);

  return {
    // state
    inCall: state.inCall,
    connected: state.connected,
    connectionState: state.connectionState,
    reconnecting: state.reconnecting,
    localStream: state.localStream,
    remoteStream: state.remoteStream,
    isMuted: state.audioMuted,
    isSpeaker: state.speakerOn,
    isVideoEnabled: state.videoEnabled,
    // actions
    startOutgoingCall,
    hangup,
    toggleMute,
    toggleSpeaker,
    switchCamera,
    toggleVideo,
    reconnect,
  };
}
