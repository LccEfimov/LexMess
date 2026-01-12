import React from 'react';
import {StyleProp, TextInput, TextInputProps, View, ViewStyle} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {uiRadii, uiSpacing} from './constants';
import {Label} from './Label';

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
            borderRadius: t.radii[uiRadii.input],
            paddingHorizontal: uiSpacing.inputPaddingHorizontal,
            paddingVertical: uiSpacing.inputPaddingVertical,
            color: t.colors.text,
          },
          style as StyleProp<ViewStyle>,
        ]}
      />
    </View>
  );
};
