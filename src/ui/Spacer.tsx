import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';

export const Spacer: React.FC<{h?: number; w?: number; style?: StyleProp<ViewStyle>}> = ({h, w, style}) => {
  return <View style={[{width: w || 0, height: h || 0}, style]} />;
};
