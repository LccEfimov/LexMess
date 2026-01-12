
import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet} from 'react-native';

type ThemeName = 'light' | 'dark';

interface Props {
  onDone: (nickname: string, theme: ThemeName, language: string, goToSettings: boolean) => void;
}

export const OnboardingScreen: React.FC<Props> = ({onDone}) => {
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
            <Text style={styles.chipText}>Русский</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, language === 'en' && styles.chipActive]}
            onPress={() => setLanguage('en')}>
            <Text style={styles.chipText}>English</Text>
          </TouchableOpacity>
        </View>

        {/* Шаг 2 — никнейм */}
        <Text style={styles.label}>Никнейм</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Как тебя подписать в чатах?"
          placeholderTextColor="#5a6280"
        />

        {/* Шаг 3 — тема */}
        <Text style={styles.label}>Тема приложения</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, theme === 'light' && styles.chipActive]}
            onPress={() => setTheme('light')}>
            <Text style={styles.chipText}>Светлая</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, theme === 'dark' && styles.chipActive]}
            onPress={() => setTheme('dark')}>
            <Text style={styles.chipText}>Тёмная</Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#02040b',
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#050812',
    borderWidth: 1,
    borderColor: '#1a2140',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
  title: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9fa3c0',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: '#9fa3c0',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#20263f',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    marginBottom: 16,
    backgroundColor: '#070d18',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#20263f',
    alignItems: 'center',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#304ffe',
    borderColor: '#304ffe',
  },
  chipText: {
    color: '#ffffff',
    fontSize: 14,
  },
  buttonsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  primaryButton: {
    flex: 1.2,
    borderRadius: 999,
    backgroundColor: '#ff6d00',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ff6d00',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#ffb74d',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
