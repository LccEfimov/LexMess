import React, {createContext, useContext, useMemo} from 'react';
import {getTheme, Theme, ThemeName} from './themes';

type Ctx = {
  themeName: ThemeName;
  theme: Theme;
  setThemeName?: (name: ThemeName) => void;
};

const ThemeContext = createContext<Ctx>({
  themeName: 'dark',
  theme: getTheme('dark'),
});

export const ThemeProvider: React.FC<{
  themeName: ThemeName;
  setThemeName?: (name: ThemeName) => void;
  children: React.ReactNode;
}> = ({themeName, setThemeName, children}) => {
  const theme = useMemo(() => getTheme(themeName), [themeName]);
  const value = useMemo(() => ({themeName, theme, setThemeName}), [themeName, theme, setThemeName]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeName(): ThemeName {
  return useContext(ThemeContext).themeName;
}

export function useSetThemeName(): ((name: ThemeName) => void) | undefined {
  return useContext(ThemeContext).setThemeName;
}
