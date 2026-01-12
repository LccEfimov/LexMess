import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

/**
 * Простой контейнер экрана.
 * Используется некоторыми экранами (например SettingsScreen).
 */
type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
};

export const ScreenContainer: React.FC<Props> = ({
  children,
  style,
  contentStyle,
  scroll = true,
}) => {
  if (!scroll) {
    return (
      <SafeAreaView style={[{flex: 1}, style]}>
        <View style={[{flex: 1, padding: 16}, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{flex: 1}, style]}>
      <ScrollView
        contentContainerStyle={[{padding: 16, paddingBottom: 28}, contentStyle]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};
