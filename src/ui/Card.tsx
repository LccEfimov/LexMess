import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import {uiRadii} from './constants';

export const Card: React.FC<{style?: StyleProp<ViewStyle>; children: React.ReactNode}> = ({style, children}) => {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.card,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radii[uiRadii.card],
          padding: t.spacing.md,
        },
        t.shadows.card as any,
        style,
      ]}>
      {children}
    </View>
  );
};
