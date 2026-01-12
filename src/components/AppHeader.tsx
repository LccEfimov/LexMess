import React, {useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../theme/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: (() => void) | null;
  right?: React.ReactNode;
};

export const AppHeader: React.FC<Props> = ({title, subtitle, onBack, right}) => {
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          backgroundColor: t.colors.headerBg,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.headerBorder,
          paddingHorizontal: 12,
          paddingBottom: 10,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        side: {
          width: 92,
          flexDirection: 'row',
          alignItems: 'center',
        },
        left: {
          justifyContent: 'flex-start',
        },
        right: {
          justifyContent: 'flex-end',
        },
        center: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
        },
        title: {
          ...t.typography.title,
          color: t.colors.text,
        },
        subtitle: {
          marginTop: 2,
          ...t.typography.tiny,
          color: t.colors.textMuted,
        },
        backBtn: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: t.radii.md,
          backgroundColor: t.colors.ghostBg,
          borderWidth: 1,
          borderColor: t.colors.ghostBorder,
        },
        backText: {
          ...t.typography.body,
          color: t.colors.text,
        },
        backPlaceholder: {
          width: 46,
          height: 30,
        },
      }),
    [t],
  );

  return (
    <View style={[styles.wrap, {paddingTop: Math.max(insets.top, 8)}]}>
      <View style={styles.row}>
        <View style={[styles.side, styles.left]}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Назад">
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>

        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.side, styles.right]}>{right || <View style={styles.backPlaceholder} />}</View>
      </View>
    </View>
  );
};
