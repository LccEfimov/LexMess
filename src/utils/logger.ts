type Level = 'info' | 'warn' | 'error';

type LogMeta = {
  error?: unknown;
  data?: unknown;
};

const isProduction =
  typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production';
let isEnabled = !isProduction;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
};

const log = (level: Level, context: string, message: string, meta?: LogMeta) => {
  if (!isEnabled) {
    return;
  }

  const payload: Record<string, unknown> = {context, message};
  if (meta?.error !== undefined) {
    payload.error = serializeError(meta.error);
  }
  if (meta?.data !== undefined) {
    payload.data = meta.data;
  }

  try {
    // eslint-disable-next-line no-console
    (console as any)[level]('[LexMess]', payload);
  } catch {}
};

export const logger = {
  info: (context: string, message: string, meta?: LogMeta) =>
    log('info', context, message, meta),
  warn: (context: string, message: string, meta?: LogMeta) =>
    log('warn', context, message, meta),
  error: (context: string, message: string, meta?: LogMeta) =>
    log('error', context, message, meta),
  setEnabled: (enabled: boolean) => {
    isEnabled = enabled;
  },
};
