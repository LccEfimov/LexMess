import {normalizeThemeName} from '../src/theme/themes';

describe('normalizeThemeName', () => {
  it('maps legacy aliases to lexmess theme ids', () => {
    expect(normalizeThemeName('dark')).toBe('lexmess_dark');
    expect(normalizeThemeName('light')).toBe('lexmess_light');
  });

  it('trims input and falls back to lexmess_dark', () => {
    expect(normalizeThemeName(' telegram_dark ')).toBe('telegram_dark');
    expect(normalizeThemeName('unknown_theme')).toBe('lexmess_dark');
    expect(normalizeThemeName(null)).toBe('lexmess_dark');
  });
});
