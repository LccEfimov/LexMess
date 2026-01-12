import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {THEME_OPTIONS, normalizeThemeName, type Theme, type ThemeName} from '../theme/themes';

type Props = {
  value: ThemeName | string | null | undefined;
  onChange: (next: ThemeName) => void;
  compact?: boolean;
};

export const ThemePicker: React.FC<Props> = ({value, onChange, compact}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t, !!compact), [t, compact]);

  const current = useMemo(() => normalizeThemeName(value), [value]);

  return (
    <View style={styles.wrap}>
      {THEME_OPTIONS.map(opt => {
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
