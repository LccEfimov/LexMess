import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {Appearance} from 'react-native';
import {getTheme, resolveThemeName, Theme, ThemeMode} from './themes';

type Ctx = {
  themeName: ThemeMode;
  theme: Theme;
  setThemeName?: (name: ThemeMode) => void;
};

const ThemeContext = createContext<Ctx>({
  themeName: 'dark',
  theme: getTheme('dark'),
});

export const ThemeProvider: React.FC<{
  themeName: ThemeMode;
  setThemeName?: (name: ThemeMode) => void;
  children: React.ReactNode;
}> = ({themeName, setThemeName, children}) => {
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    if (themeName !== 'system') {
      return;
    }
    setSystemScheme(Appearance.getColorScheme());
    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      setSystemScheme(colorScheme);
    });
    return () => {
      subscription.remove();
    };
  }, [themeName]);

  const resolvedName = useMemo(
    () => resolveThemeName(themeName, systemScheme),
    [themeName, systemScheme],
  );
  const theme = useMemo(() => getTheme(resolvedName), [resolvedName]);
  const value = useMemo(() => ({themeName, theme, setThemeName}), [themeName, theme, setThemeName]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeName(): ThemeMode {
  return useContext(ThemeContext).themeName;
}

export function useSetThemeName(): ((name: ThemeMode) => void) | undefined {
  return useContext(ThemeContext).setThemeName;
}
