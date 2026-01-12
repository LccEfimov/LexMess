type Level = 'info' | 'warn' | 'error';

export function log(level: Level, message: string, extra?: any) {
  try {
    const payload = extra ? {message, extra} : {message};
    // eslint-disable-next-line no-console
    (console as any)[level]('[LexMess]', payload);
  } catch {}
}

export const logInfo = (m: string, e?: any) => log('info', m, e);
export const logWarn = (m: string, e?: any) => log('warn', m, e);
export const logError = (m: string, e?: any) => log('error', m, e);
