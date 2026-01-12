import {Theme as NavTheme} from '@react-navigation/native';
import {Theme} from './themes';

export function makeNavigationTheme(t: Theme): NavTheme {
  return {
    dark: !!t.isDark,
    colors: {
      primary: t.colors.primary,
      background: t.colors.bg,
      card: t.colors.bgElevated,
      text: t.colors.text,
      border: t.colors.border,
      notification: t.colors.primary,
    },
  };
}
