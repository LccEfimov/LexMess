export type LogLevel = 'info' | 'warn' | 'error';

export type LoggerSink = (level: LogLevel, message: string, extra?: any) => void;

type LoggerConfig = {
  enabled?: boolean;
  sink?: LoggerSink;
};

const defaultSink: LoggerSink = (level, message, extra) => {
  try {
    const payload = extra ? {message, extra} : {message};
    // eslint-disable-next-line no-console
    (console as any)[level]('[LexMess]', payload);
  } catch {}
};

let isEnabled = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
let sink: LoggerSink = defaultSink;

export function configureLogger(config: LoggerConfig) {
  if (typeof config.enabled === 'boolean') {
    isEnabled = config.enabled;
  }
  if (config.sink) {
    sink = config.sink;
  }
}

export function log(level: LogLevel, message: string, extra?: any) {
  if (!isEnabled) return;
  try {
    sink(level, message, extra);
  } catch {}
}

export const logger = {
  info: (m: string, e?: any) => log('info', m, e),
  warn: (m: string, e?: any) => log('warn', m, e),
  error: (m: string, e?: any) => log('error', m, e),
};

export const logInfo = (m: string, e?: any) => log('info', m, e);
export const logWarn = (m: string, e?: any) => log('warn', m, e);
export const logError = (m: string, e?: any) => log('error', m, e);
