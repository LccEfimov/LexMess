import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';

export const Row: React.FC<{children: React.ReactNode; style?: StyleProp<ViewStyle>}> = ({children, style}) => {
  return <View style={[{flexDirection: 'row', alignItems: 'center'}, style]}>{children}</View>;
};
