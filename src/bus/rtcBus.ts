export type IncomingRtcSignal = {
  roomId: string;
  from: string;
  to?: string | null;
  signalType: string;
  payload: any;
};

type RtcListener = (signal: IncomingRtcSignal) => void | Promise<void>;

const listeners = new Set<RtcListener>();

// Храним последний offer, чтобы можно было "догнать" его после навигации
let lastOffer: IncomingRtcSignal | null = null;

export function subscribeRtc(listener: RtcListener): () => void {
  listeners.add(listener);

  // Если есть невыполненный offer — сразу прокинем его новому слушателю.
  if (lastOffer && lastOffer.signalType === 'offer') {
    try {
      void listener(lastOffer);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[rtcBus] replay offer to new listener failed', e);
    }
  }

  return () => {
    listeners.delete(listener);
  };
}

export function clearLastOffer(callId?: string | null): void {
  if (!lastOffer) {
    return;
  }
  if (!callId) {
    lastOffer = null;
    return;
  }
  try {
    const lastCallId = lastOffer.payload?.callId;
    if (!lastCallId || lastCallId === callId) {
      lastOffer = null;
    }
  } catch {
    lastOffer = null;
  }
}

export async function injectIncomingRtc(signal: IncomingRtcSignal): Promise<void> {
  // Обновляем lastOffer только для offer-сигналов
  if (signal.signalType === 'offer') {
    lastOffer = signal;
  }

  const snapshot = Array.from(listeners);
  for (const cb of snapshot) {
    try {
      await cb(signal);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[rtcBus] listener error', e);
    }
  }
}
