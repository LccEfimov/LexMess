export type IncomingContainerMessage = {
  id: string;
  roomId: string;
  senderId: string;
  /**
   * Контейнер с .lcc в base64.
   * Сейчас это всегда PNG‑контейнер, на этом уровне нас интересует только байтовый поток.
   */
  containerBase64: string;
  /**
   * Тип сообщения:
   *   0 — текст
   *   1 — произвольный файл (в т.ч. изображение)
   *   2 — аудио
   *   3 — видео
   */
  messageType?: number;
  fileName?: string;
  extension?: string;
};

type ContainerListener = (msg: IncomingContainerMessage) => void | Promise<void>;

const listeners = new Set<ContainerListener>();

/**
 * Подписка на входящие контейнеры сообщений.
 * Возвращает функцию для отписки.
 */
export function subscribeIncomingContainers(
  listener: ContainerListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Инъекция нового сообщения в внутреннюю шину.
 * Обычно вызывается WebSocket‑клиентом при получении данных с сервера.
 */
export async function injectIncomingContainer(
  msg: IncomingContainerMessage,
): Promise<void> {
  const snapshot = Array.from(listeners);
  for (const cb of snapshot) {
    try {
      const res = cb(msg);
      if (res && typeof (res as any).then === 'function') {
        await (res as Promise<void>);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[messageBus] listener error', e);
    }
  }
}
