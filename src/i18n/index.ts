import ru from './ru.json';
import en from './en.json';

export type Locale = 'ru' | 'en';

const resources: Record<Locale, Record<string, any>> = {ru, en};
let currentLocale: Locale = 'ru';

const interpolate = (value: string, vars?: Record<string, string | number>) => {
  if (!vars) {
    return value;
  }
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    const replacement = vars[key];
    return replacement === undefined || replacement === null ? match : String(replacement);
  });
};

const lookup = (messages: Record<string, any>, key: string): string | null => {
  const parts = key.split('.');
  let node: any = messages;
  for (const part of parts) {
    if (!node || typeof node !== 'object' || !(part in node)) {
      return null;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : null;
};

export const setLocale = (locale: string) => {
  if (locale === 'ru' || locale === 'en') {
    currentLocale = locale;
  } else {
    currentLocale = 'ru';
  }
};

export const getLocale = (): Locale => currentLocale;

export const t = (key: string, vars?: Record<string, string | number>) => {
  const primary = lookup(resources[currentLocale], key);
  const fallback = lookup(resources.ru, key);
  const value = primary ?? fallback ?? key;
  return interpolate(value, vars);
};

export const i18n = {t, setLocale, getLocale};
