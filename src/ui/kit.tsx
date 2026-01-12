import React, {useMemo} from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';

export const Spacer: React.FC<{h?: number; w?: number; style?: StyleProp<ViewStyle>}> = ({h, w, style}) => {
  return <View style={[{width: w || 0, height: h || 0}, style]} />;
};

export const Row: React.FC<{children: React.ReactNode; style?: StyleProp<ViewStyle>}> = ({children, style}) => {
  return <View style={[{flexDirection: 'row', alignItems: 'center'}, style]}>{children}</View>;
};

export const Divider: React.FC<{style?: StyleProp<ViewStyle>}> = ({style}) => {
  const t = useTheme();
  return <View style={[{height: 1, backgroundColor: t.colors.border, opacity: 0.9}, style]} />;
};

export const Label: React.FC<{children: React.ReactNode; style?: StyleProp<TextStyle>}> = ({children, style}) => {
  const t = useTheme();
  return <Text style={[t.typography.caption, {color: t.colors.textMuted, marginBottom: 6}, style]}>{children}</Text>;
};

export const ErrorText: React.FC<{children?: React.ReactNode; text?: string | null; style?: StyleProp<TextStyle>}> = ({children, text, style}) => {
  const t = useTheme();
  const content = typeof text === 'string' ? text : children;
  if (!content) return null;
  return <Text style={[t.typography.caption, {color: t.colors.danger, marginTop: 6}, style]}>{content}</Text>;
};

export const Card: React.FC<{style?: StyleProp<ViewStyle>; children: React.ReactNode}> = ({style, children}) => {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.card,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radii.lg,
          padding: t.spacing.md,
        },
        t.shadows.card as any,
        style,
      ]}>
      {children}
    </View>
  );
};

export const SectionTitle: React.FC<{children: React.ReactNode; style?: StyleProp<TextStyle>}> = ({children, style}) => {
  const t = useTheme();
  return <Text style={[t.typography.subtitle, {color: t.colors.text, marginBottom: t.spacing.sm}, style]}>{children}</Text>;
};

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

export const Input: React.FC<TextInputProps & {label?: string}> = ({label, style, ...props}) => {
  const t = useTheme();
  return (
    <View style={{marginBottom: t.spacing.md}}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        {...props}
        placeholderTextColor={t.colors.placeholder}
        style={[
          {
            backgroundColor: t.colors.inputBg,
            borderColor: t.colors.inputBorder,
            borderWidth: 1,
            borderRadius: t.radii.md,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: t.colors.text,
          },
          style as any,
        ]}
      />
    </View>
  );
};

export const Screen: React.FC<{children: React.ReactNode; style?: StyleProp<ViewStyle>}> = ({children, style}) => {
  const t = useTheme();
  return <View style={[{flex: 1, backgroundColor: t.colors.bg}, style]}>{children}</View>;
};

function makeButtonStyles(t: Theme, variant: ButtonVariant, disabled: boolean, small: boolean) {
  const base: ViewStyle = {
    borderRadius: small ? t.radii.sm : t.radii.md,
    paddingVertical: small ? 9 : 12,
    paddingHorizontal: small ? 12 : 14,
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
      ...(small ? t.typography.caption : t.typography.body),
      color: text,
      fontWeight: '800',
    },
  });
}

const _unused = StyleSheet.create({});
