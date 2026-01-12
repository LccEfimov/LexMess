import React, {useMemo} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {View, Text, StyleSheet, Pressable} from 'react-native';

interface Props {
  navigation: any;
  initialLogin?: string | null;
}

export const AuthStartScreen: React.FC<Props> = ({navigation, initialLogin}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LexMess</Text>
        <Text style={styles.subtitle}>
          Логин — уникальный. Имя отображения может быть любым.
        </Text>
      </View>

      <View style={styles.card}>
        <Pressable
          style={({pressed}) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => navigation.navigate('Login', {prefillLogin: initialLogin || ''})}>
          <Text style={styles.btnText}>Войти</Text>
        </Pressable>

        <Pressable
          style={({pressed}) => [styles.btnAlt, pressed && styles.btnPressed]}
          onPress={() => navigation.navigate('Register', {prefillLogin: initialLogin || ''})}>
          <Text style={styles.btnAltText}>Регистрация</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Подсказка: логин — латиница/цифры/._
      </Text>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
    paddingHorizontal: 22,
    paddingTop: 48,
  },
  header: {
    marginBottom: 26,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: t.colors.text,
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: t.colors.textMuted,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: t.colors.card,
  },
  btn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
  btnAlt: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.ghostBorder,
    backgroundColor: t.colors.ghostBg,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: t.colors.onPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  btnAltText: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  hint: {
    marginTop: 18,
    fontSize: 12,
    color: t.colors.textMuted,
  },
});