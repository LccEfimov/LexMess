import {logger} from '../utils/logger';

export type DeliveryAck = {
  roomId: string;
  userId?: string;
  clientMsgId?: string;
  kind?: string;
  ts?: number;
};

type DeliveryListener = (ack: DeliveryAck) => void | Promise<void>;

const listeners = new Set<DeliveryListener>();

export function subscribeDelivery(listener: DeliveryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function injectDeliveryAck(ack: DeliveryAck): Promise<void> {
  const snapshot = Array.from(listeners);
  for (const cb of snapshot) {
    try {
      const res = cb(ack);
      if (res && typeof (res as any).then === 'function') {
        await (res as Promise<void>);
      }
    } catch (e) {
      logger.warn('deliveryBus', 'listener error', {error: e});
    }
  }
}
