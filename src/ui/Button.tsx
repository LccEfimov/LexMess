import React, {useMemo} from 'react';
import {StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {uiRadii, uiSpacing, uiTypography} from './constants';

type ButtonVariant = 'primary' | 'ghost' | 'danger';

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** legacy */
  small?: boolean;
  /** legacy */
  secondary?: boolean;
  /** legacy */
  danger?: boolean;
  /** new */
  variant?: ButtonVariant;
}> = ({title, onPress, disabled, style, small, secondary, danger, variant}) => {
  const t = useTheme();

  const v: ButtonVariant = useMemo(() => {
    if (variant) return variant;
    if (danger) return 'danger';
    if (secondary) return 'ghost';
    return 'primary';
  }, [danger, secondary, variant]);

  const styles = useMemo(() => makeButtonStyles(t, v, !!disabled, !!small), [t, v, disabled, small]);

  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.btn, style]}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

function makeButtonStyles(t: Theme, variant: ButtonVariant, disabled: boolean, small: boolean) {
  const size = small ? uiSpacing.buttonPadding.small : uiSpacing.buttonPadding.regular;
  const base: ViewStyle = {
    borderRadius: small ? t.radii[uiRadii.buttonSmall] : t.radii[uiRadii.buttonRegular],
    paddingVertical: size.vertical,
    paddingHorizontal: size.horizontal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    opacity: disabled ? 0.6 : 1,
  };

  let bg = t.colors.primary;
  let border = t.colors.primary;
  let text = t.colors.onPrimary;

  if (variant === 'ghost') {
    bg = t.colors.ghostBg;
    border = t.colors.ghostBorder;
    text = t.colors.text;
  }

  if (variant === 'danger') {
    bg = t.colors.danger;
    border = t.colors.danger;
    text = '#ffffff';
  }

  return StyleSheet.create({
    btn: {...base, backgroundColor: bg, borderColor: border},
    text: {
      ...(small ? t.typography[uiTypography.buttonSmall] : t.typography[uiTypography.buttonRegular]),
      color: text,
      fontWeight: '800',
    },
  });
}
