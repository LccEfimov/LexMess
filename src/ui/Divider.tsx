import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {useTheme} from '../theme/ThemeContext';

export const Divider: React.FC<{style?: StyleProp<ViewStyle>}> = ({style}) => {
  const t = useTheme();
  return <View style={[{height: 1, backgroundColor: t.colors.border, opacity: 0.9}, style]} />;
};
