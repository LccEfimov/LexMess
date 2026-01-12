import React, {useMemo} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {View, Text, StyleSheet} from 'react-native';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';
import {i18n} from '../i18n';

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
          {i18n.t('authStart.subtitle')}
        </Text>
      </View>

      <Card style={styles.card}>
        <Button
          title={i18n.t('authStart.login')}
          onPress={() => navigation.navigate('Login', {prefillLogin: initialLogin || ''})}
        />
        <Button
          title={i18n.t('authStart.register')}
          variant="ghost"
          onPress={() => navigation.navigate('Register', {prefillLogin: initialLogin || ''})}
        />
      </Card>

      <Text style={styles.hint}>
        {i18n.t('authStart.hint')}
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
    gap: 12,
  },
  hint: {
    marginTop: 18,
    fontSize: 12,
    color: t.colors.textMuted,
  },
});
