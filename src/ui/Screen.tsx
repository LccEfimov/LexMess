import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

export const Screen: React.FC<{children: React.ReactNode; style?: StyleProp<ViewStyle>}> = ({children, style}) => {
  const t = useTheme();
  return <View style={[{flex: 1, backgroundColor: t.colors.bg}, style]}>{children}</View>;
};
