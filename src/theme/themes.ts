import {radii, shadows, spacing, typography} from './tokens';

export type ThemeVariant = 'light' | 'dark';
export type ThemePack = 'lexmess' | 'telegram' | 'whatsapp';

// Backward compatible: "dark"/"light" are accepted as aliases for LexMess.
export type ThemeName =
  | 'dark'
  | 'light'
  | 'lexmess_dark'
  | 'lexmess_light'
  | 'telegram_dark'
  | 'telegram_light'
  | 'whatsapp_dark'
  | 'whatsapp_light';
export type ThemeMode = ThemeName | 'system';

export type ThemeColors = {
  bg: string;
  bgElevated: string;
  card: string;

  text: string;
  textMuted: string;
  textFaint: string;
  textSecondary: string;

  border: string;

  primary: string;
  primarySoft: string;
  onPrimary: string;

  accent: string;
  accentText: string;

  danger: string;
  success: string;

  inputBg: string;
  inputBorder: string;
  placeholder: string;

  headerBg: string;
  headerBorder: string;

  tabBg: string;
  tabBorder: string;

  ghostBg: string;
  ghostBorder: string;
};

export type Theme = {
  name: ThemeName;
  isDark: boolean;
  pack: ThemePack;
  variant: ThemeVariant;
  label: string;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};

export function normalizeThemeName(name: ThemeName | string | null | undefined): ThemeName {
  const v = String(name || '').trim();

  // Aliases from older versions
  if (v === 'dark') return 'lexmess_dark';
  if (v === 'light') return 'lexmess_light';

  switch (v) {
    case 'lexmess_dark':
    case 'lexmess_light':
    case 'telegram_dark':
    case 'telegram_light':
    case 'whatsapp_dark':
    case 'whatsapp_light':
      return v;
    default:
      return 'lexmess_dark';
  }
}

export function normalizeThemeMode(name: ThemeMode | string | null | undefined): ThemeMode {
  const v = String(name || '').trim();
  if (v === 'system') return 'system';
  return normalizeThemeName(v);
}

export function resolveThemeName(mode: ThemeMode, scheme: ThemeVariant | null | undefined): ThemeName {
  if (mode !== 'system') return normalizeThemeName(mode);
  return scheme === 'light' ? 'lexmess_light' : 'lexmess_dark';
}

export const THEME_OPTIONS: Array<{id: ThemeName; title: string}> = [
  {id: 'lexmess_dark', title: 'LexMess (тёмная)'},
  {id: 'lexmess_light', title: 'LexMess (светлая)'},
  {id: 'telegram_dark', title: 'Telegram (тёмная)'},
  {id: 'telegram_light', title: 'Telegram (светлая)'},
  {id: 'whatsapp_dark', title: 'WhatsApp (тёмная)'},
  {id: 'whatsapp_light', title: 'WhatsApp (светлая)'},
];

function makeColors(base: Omit<ThemeColors, 'textSecondary' | 'accent' | 'accentText'>): ThemeColors {
  return {
    ...base,
    textSecondary: base.textMuted,
    accent: base.primary,
    accentText: base.onPrimary,
  };
}

// LexMess
const LEXMESS_DARK: ThemeColors = makeColors({
  bg: '#050812',
  bgElevated: '#0b1022',
  card: 'rgba(255,255,255,0.04)',

  text: '#e9ecff',
  textMuted: '#9fa3c0',
  textFaint: '#6f7694',

  border: '#20263f',

  primary: '#2b5cff',
  primarySoft: 'rgba(43,92,255,0.18)',
  onPrimary: '#ffffff',

  danger: '#ff4d6d',
  success: '#33d17a',

  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.10)',
  placeholder: '#6f7694',

  headerBg: '#050812',
  headerBorder: '#20263f',

  tabBg: '#050812',
  tabBorder: '#20263f',

  ghostBg: 'rgba(255,255,255,0.06)',
  ghostBorder: 'rgba(255,255,255,0.10)',
});

const LEXMESS_LIGHT: ThemeColors = makeColors({
  bg: '#f4f7ff',
  bgElevated: '#ffffff',
  card: '#ffffff',

  text: '#0b1022',
  textMuted: '#4b5574',
  textFaint: '#7a86a8',

  border: '#d7def5',

  primary: '#2455ff',
  primarySoft: 'rgba(36,85,255,0.14)',
  onPrimary: '#ffffff',

  danger: '#d71a44',
  success: '#178a4b',

  inputBg: '#ffffff',
  inputBorder: '#d7def5',
  placeholder: '#7a86a8',

  headerBg: '#ffffff',
  headerBorder: '#d7def5',

  tabBg: '#ffffff',
  tabBorder: '#d7def5',

  ghostBg: 'rgba(11,16,34,0.04)',
  ghostBorder: 'rgba(11,16,34,0.10)',
});

// Telegram
const TELEGRAM_DARK: ThemeColors = makeColors({
  bg: '#17212b',
  bgElevated: '#1f2c3a',
  card: '#1f2c3a',

  text: '#e9edef',
  textMuted: 'rgba(233,237,239,0.72)',
  textFaint: 'rgba(233,237,239,0.45)',

  border: 'rgba(255,255,255,0.10)',

  primary: '#2aabee',
  primarySoft: 'rgba(42,171,238,0.18)',
  onPrimary: '#062030',

  danger: '#ff4d6d',
  success: '#33d17a',

  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.10)',
  placeholder: 'rgba(233,237,239,0.40)',

  headerBg: '#17212b',
  headerBorder: 'rgba(255,255,255,0.10)',

  tabBg: '#17212b',
  tabBorder: 'rgba(255,255,255,0.10)',

  ghostBg: 'rgba(255,255,255,0.06)',
  ghostBorder: 'rgba(255,255,255,0.12)',
});

const TELEGRAM_LIGHT: ThemeColors = makeColors({
  bg: '#f7f7f7',
  bgElevated: '#ffffff',
  card: '#ffffff',

  text: '#0b1022',
  textMuted: 'rgba(11,16,34,0.68)',
  textFaint: 'rgba(11,16,34,0.45)',

  border: 'rgba(0,0,0,0.10)',

  primary: '#2aabee',
  primarySoft: 'rgba(42,171,238,0.14)',
  onPrimary: '#ffffff',

  danger: '#d71a44',
  success: '#178a4b',

  inputBg: '#ffffff',
  inputBorder: 'rgba(0,0,0,0.12)',
  placeholder: 'rgba(11,16,34,0.40)',

  headerBg: '#ffffff',
  headerBorder: 'rgba(0,0,0,0.10)',

  tabBg: '#ffffff',
  tabBorder: 'rgba(0,0,0,0.10)',

  ghostBg: 'rgba(0,0,0,0.04)',
  ghostBorder: 'rgba(0,0,0,0.12)',
});

// WhatsApp
const WHATSAPP_DARK: ThemeColors = makeColors({
  bg: '#0b141a',
  bgElevated: '#111b21',
  card: '#111b21',

  text: '#e9edef',
  textMuted: 'rgba(233,237,239,0.72)',
  textFaint: 'rgba(233,237,239,0.45)',

  border: '#1f2c34',

  primary: '#00a884',
  primarySoft: 'rgba(0,168,132,0.18)',
  onPrimary: '#05251f',

  danger: '#ff4d6d',
  success: '#33d17a',

  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.10)',
  placeholder: 'rgba(233,237,239,0.40)',

  headerBg: '#0b141a',
  headerBorder: '#1f2c34',

  tabBg: '#0b141a',
  tabBorder: '#1f2c34',

  ghostBg: 'rgba(255,255,255,0.06)',
  ghostBorder: 'rgba(255,255,255,0.12)',
});

const WHATSAPP_LIGHT: ThemeColors = makeColors({
  bg: '#f0f2f5',
  bgElevated: '#ffffff',
  card: '#ffffff',

  text: '#0b1022',
  textMuted: 'rgba(11,16,34,0.68)',
  textFaint: 'rgba(11,16,34,0.45)',

  border: 'rgba(0,0,0,0.10)',

  primary: '#00a884',
  primarySoft: 'rgba(0,168,132,0.14)',
  onPrimary: '#ffffff',

  danger: '#d71a44',
  success: '#178a4b',

  inputBg: '#ffffff',
  inputBorder: 'rgba(0,0,0,0.12)',
  placeholder: 'rgba(11,16,34,0.40)',

  headerBg: '#ffffff',
  headerBorder: 'rgba(0,0,0,0.10)',

  tabBg: '#ffffff',
  tabBorder: 'rgba(0,0,0,0.10)',

  ghostBg: 'rgba(0,0,0,0.04)',
  ghostBorder: 'rgba(0,0,0,0.12)',
});

const THEME_MAP: Record<
  ThemeName,
  {pack: ThemePack; variant: ThemeVariant; label: string; colors: ThemeColors}
> = {
  // aliases
  dark: {pack: 'lexmess', variant: 'dark', label: 'LexMess (тёмная)', colors: LEXMESS_DARK},
  light: {pack: 'lexmess', variant: 'light', label: 'LexMess (светлая)', colors: LEXMESS_LIGHT},

  lexmess_dark: {pack: 'lexmess', variant: 'dark', label: 'LexMess (тёмная)', colors: LEXMESS_DARK},
  lexmess_light: {pack: 'lexmess', variant: 'light', label: 'LexMess (светлая)', colors: LEXMESS_LIGHT},

  telegram_dark: {pack: 'telegram', variant: 'dark', label: 'Telegram (тёмная)', colors: TELEGRAM_DARK},
  telegram_light: {pack: 'telegram', variant: 'light', label: 'Telegram (светлая)', colors: TELEGRAM_LIGHT},

  whatsapp_dark: {pack: 'whatsapp', variant: 'dark', label: 'WhatsApp (тёмная)', colors: WHATSAPP_DARK},
  whatsapp_light: {pack: 'whatsapp', variant: 'light', label: 'WhatsApp (светлая)', colors: WHATSAPP_LIGHT},
};

export function getTheme(name: ThemeName): Theme {
  const id = normalizeThemeName(name);
  const meta = THEME_MAP[id] || THEME_MAP.lexmess_dark;
  return {
    name: id,
    isDark: meta.variant === 'dark',
    pack: meta.pack,
    variant: meta.variant,
    label: meta.label,
    colors: meta.colors,
    spacing,
    radii,
    typography,
    shadows,
  };
}
