import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {THEME_OPTIONS, normalizeThemeMode, type Theme, type ThemeMode} from '../theme/themes';
import {i18n} from '../i18n';

type Props = {
  value: ThemeMode | string | null | undefined;
  onChange: (next: ThemeMode) => void;
  compact?: boolean;
};

export const ThemePicker: React.FC<Props> = ({value, onChange, compact}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t, !!compact), [t, compact]);

  const current = useMemo(() => normalizeThemeMode(value), [value]);
  const locale = i18n.getLocale();
  const options = useMemo(
    () => [
      {id: 'system' as const, title: i18n.t('theme.system')},
      ...THEME_OPTIONS.map(option => ({
        ...option,
        title: i18n.t(`theme.${option.id}`) || option.title,
      })),
    ],
    [locale],
  );

  return (
    <View style={styles.wrap}>
      {options.map(opt => {
        const selected = current === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={({pressed}) => [
              styles.item,
              selected ? styles.itemSelected : styles.itemNormal,
              pressed && styles.itemPressed,
            ]}>
            <Text style={[styles.itemText, selected && styles.itemTextSelected]}>{opt.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const makeStyles = (t: Theme, compact: boolean) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 8 : 10,
    },
    item: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: compact ? 12 : 14,
      paddingVertical: compact ? 8 : 10,
    },
    itemNormal: {
      backgroundColor: t.colors.ghostBg,
      borderColor: t.colors.ghostBorder,
    },
    itemSelected: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
    itemPressed: {
      opacity: 0.9,
    },
    itemText: {
      color: t.colors.text,
      fontSize: compact ? 12 : 13,
      fontWeight: '700',
    },
    itemTextSelected: {
      color: t.colors.onPrimary,
    },
  });
