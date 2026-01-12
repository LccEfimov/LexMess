
import React, {useMemo, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';

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
      <View style={styles.card}>
        <Text style={styles.title}>LexMess</Text>
        <Text style={styles.subtitle}>Приватный мессенджер нового поколения</Text>

        {/* Шаг 1 — выбор языка */}
        <Text style={styles.label}>Язык интерфейса</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, language === 'ru' && styles.chipActive]}
            onPress={() => setLanguage('ru')}>
            <Text style={[styles.chipText, language === 'ru' && styles.chipTextActive]}>Русский</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, language === 'en' && styles.chipActive]}
            onPress={() => setLanguage('en')}>
            <Text style={[styles.chipText, language === 'en' && styles.chipTextActive]}>English</Text>
          </TouchableOpacity>
        </View>

        {/* Шаг 2 — никнейм */}
        <Text style={styles.label}>Никнейм</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Как тебя подписать в чатах?"
          placeholderTextColor={t.colors.placeholder}
        />

        {/* Шаг 3 — тема */}
        <Text style={styles.label}>Тема приложения</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, theme === 'light' && styles.chipActive]}
            onPress={() => setTheme('light')}>
            <Text style={[styles.chipText, theme === 'light' && styles.chipTextActive]}>Светлая</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, theme === 'dark' && styles.chipActive]}
            onPress={() => setTheme('dark')}>
            <Text style={[styles.chipText, theme === 'dark' && styles.chipTextActive]}>Тёмная</Text>
          </TouchableOpacity>
        </View>

        {/* Кнопки — как в ТЗ: "Перейти к чатам" и "Ещё настройки" */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.primaryButton, !canContinue && styles.buttonDisabled]}
            onPress={() => handleGo(false)}
            disabled={!canContinue}>
            <Text style={styles.primaryButtonText}>Перейти к чатам</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, !canContinue && styles.buttonDisabled]}
            onPress={() => handleGo(true)}
            disabled={!canContinue}>
            <Text style={styles.secondaryButtonText}>Ещё настройки</Text>
          </TouchableOpacity>
        </View>
      </View>
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
      borderRadius: t.radii.xl,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.xl,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      ...t.shadows.card,
    },
    title: {
      ...t.typography.title,
      fontSize: 32,
      color: t.colors.text,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 4,
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
      borderRadius: t.radii.md,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      color: t.colors.text,
      marginBottom: t.spacing.lg,
      backgroundColor: t.colors.inputBg,
      ...t.typography.bodyRegular,
    },
    row: {
      flexDirection: 'row',
      marginBottom: t.spacing.xl,
      justifyContent: 'space-between',
    },
    chip: {
      flex: 1,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radii.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      marginRight: t.spacing.xs,
    },
    chipActive: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
    chipText: {
      ...t.typography.bodyRegular,
      color: t.colors.text,
    },
    chipTextActive: {
      color: t.colors.onPrimary,
      fontWeight: '600',
    },
    buttonsRow: {
      marginTop: t.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: t.spacing.xs,
    },
    primaryButton: {
      flex: 1.2,
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.primary,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButton: {
      flex: 1,
      borderRadius: t.radii.pill,
      borderWidth: 1,
      borderColor: t.colors.primary,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    primaryButtonText: {
      ...t.typography.body,
      color: t.colors.onPrimary,
      fontWeight: '600',
    },
    secondaryButtonText: {
      ...t.typography.bodyRegular,
      color: t.colors.primary,
      fontWeight: '500',
    },
    buttonDisabled: {
      opacity: 0.4,
    },
  });
