
import React, {useMemo, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';
import {i18n} from '../i18n';
import {Input} from '../ui/Input';

type ThemeName = 'light' | 'dark';

interface Props {
  onDone: (nickname: string, theme: ThemeName, language: string, goToSettings: boolean) => void;
}

export const OnboardingScreen: React.FC<Props> = ({onDone}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [language, setLanguage] = useState<string>('ru');
  const [nickname, setNickname] = useState('');
  const [theme, setTheme] = useState<ThemeName>('dark');

  const canContinue = nickname.trim().length > 0;

  const handleGo = (goToSettings: boolean) => {
    if (!canContinue) {
      return;
    }
    onDone(nickname.trim(), theme, language, goToSettings);
  };

  return (
    <View style={styles.root}>
      <Card style={styles.card}>
        <Text style={styles.title}>{i18n.t('onboarding.title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('onboarding.subtitle')}</Text>

        {/* Шаг 1 — выбор языка */}
        <Text style={styles.label}>{i18n.t('onboarding.language.label')}</Text>
        <View style={styles.row}>
          <Button
            title={i18n.t('onboarding.language.ru')}
            variant={language === 'ru' ? 'primary' : 'ghost'}
            onPress={() => setLanguage('ru')}
            small
            style={styles.chip}
          />
          <Button
            title={i18n.t('onboarding.language.en')}
            variant={language === 'en' ? 'primary' : 'ghost'}
            onPress={() => setLanguage('en')}
            small
            style={styles.chip}
          />
        </View>

        {/* Шаг 2 — никнейм */}
        <Input
          label={i18n.t('onboarding.nickname.label')}
          value={nickname}
          onChangeText={setNickname}
          placeholder={i18n.t('onboarding.nickname.placeholder')}
          style={styles.input}
          containerStyle={styles.inputContainer}
        />

        {/* Шаг 3 — тема */}
        <Text style={styles.label}>{i18n.t('onboarding.theme.label')}</Text>
        <View style={styles.row}>
          <Button
            title={i18n.t('onboarding.theme.light')}
            variant={theme === 'light' ? 'primary' : 'ghost'}
            onPress={() => setTheme('light')}
            small
            style={styles.chip}
          />
          <Button
            title={i18n.t('onboarding.theme.dark')}
            variant={theme === 'dark' ? 'primary' : 'ghost'}
            onPress={() => setTheme('dark')}
            small
            style={styles.chip}
          />
        </View>

        {/* Кнопки — как в ТЗ: "Перейти к чатам" и "Ещё настройки" */}
        <View style={styles.buttonsRow}>
          <Button
            title={i18n.t('onboarding.actions.goToChats')}
            onPress={() => handleGo(false)}
            disabled={!canContinue}
            style={styles.primaryAction}
          />
          <Button
            title={i18n.t('onboarding.actions.moreSettings')}
            variant="ghost"
            onPress={() => handleGo(true)}
            disabled={!canContinue}
            style={styles.secondaryAction}
          />
        </View>
      </Card>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.bg,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      width: '100%',
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.xl,
    },
    title: {
      ...t.typography.title,
      color: t.colors.text,
      textAlign: 'center',
      marginBottom: t.spacing.xs,
    },
    subtitle: {
      ...t.typography.bodyRegular,
      color: t.colors.textMuted,
      textAlign: 'center',
      marginBottom: t.spacing.xl,
    },
    label: {
      ...t.typography.bodyRegular,
      color: t.colors.textMuted,
      marginBottom: t.spacing.xs,
    },
    input: {
      ...t.typography.bodyRegular,
    },
    inputContainer: {
      marginBottom: t.spacing.lg,
    },
    row: {
      flexDirection: 'row',
      marginBottom: t.spacing.xl,
      justifyContent: 'space-between',
    },
    chip: {
      flex: 1,
      borderRadius: t.radii.pill,
      marginRight: t.spacing.xs,
    },
    buttonsRow: {
      marginTop: t.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    primaryAction: {
      flex: 1.2,
      marginRight: t.spacing.xs,
    },
    secondaryAction: {
      flex: 1,
    },
  });
