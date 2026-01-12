import React from 'react';
import {StyleProp, Text, TextStyle} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {uiSpacing, uiTypography} from './constants';

export const Label: React.FC<{children: React.ReactNode; style?: StyleProp<TextStyle>}> = ({children, style}) => {
  const t = useTheme();
  return (
    <Text
      style={[
        t.typography[uiTypography.label],
        {color: t.colors.textMuted, marginBottom: uiSpacing.labelMarginBottom},
        style,
      ]}>
      {children}
    </Text>
  );
};

export const ErrorText: React.FC<{children?: React.ReactNode; text?: string | null; style?: StyleProp<TextStyle>}> = ({
  children,
  text,
  style,
}) => {
  const t = useTheme();
  const content = typeof text === 'string' ? text : children;
  if (!content) return null;
  return (
    <Text
      style={[
        t.typography[uiTypography.error],
        {color: t.colors.danger, marginTop: uiSpacing.errorMarginTop},
        style,
      ]}>
      {content}
    </Text>
  );
};

export const SectionTitle: React.FC<{children: React.ReactNode; style?: StyleProp<TextStyle>}> = ({children, style}) => {
  const t = useTheme();
  return (
    <Text style={[t.typography[uiTypography.sectionTitle], {color: t.colors.text, marginBottom: t.spacing.sm}, style]}>
      {children}
    </Text>
  );
};
