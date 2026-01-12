import React from 'react';
import {StyleProp, TextInput, TextInputProps, TextStyle, View, ViewStyle} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {uiRadii, uiSpacing} from './constants';
import {Label} from './Label';

export const Input: React.FC<
  TextInputProps & {
    label?: string;
    containerStyle?: StyleProp<ViewStyle>;
  }
> = ({label, style, containerStyle, placeholderTextColor, ...props}) => {
  const t = useTheme();
  return (
    <View style={[{marginBottom: t.spacing.md}, containerStyle]}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        {...props}
        placeholderTextColor={placeholderTextColor ?? t.colors.placeholder}
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
          style as StyleProp<TextStyle>,
        ]}
      />
    </View>
  );
};
