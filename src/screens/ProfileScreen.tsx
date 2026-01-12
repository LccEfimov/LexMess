import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {loadLocalAccount} from '../storage/localAccountStorage';

type Props = {
  nickname: string;
  displayName: string | null;
  about: string | null;
  onOpenSettings: () => void;
  onOpenDiagnostics: () => void;
  onLogout: () => void;
};

export const ProfileScreen: React.FC<Props> = ({
  nickname,
  displayName,
  about,
  onOpenSettings,
  onOpenDiagnostics,
  onLogout,
}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const local = await loadLocalAccount();
        if (local?.walletAddress) {
          setWalletAddress(local.walletAddress);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const titleName = useMemo(() => {
    const dn = (displayName || '').trim();
    if (dn) return dn;
    const nn = (nickname || '').trim();
    if (nn) return nn;
    return 'Профиль';
  }, [displayName, nickname]);

  const onLogoutPress = useCallback(() => {
    onLogout();
  }, [onLogout]);

  return (
    <View style={styles.root}>
      <AppHeader title="Профиль" subtitle={titleName} onBack={null} right={null} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Учетная запись</Text>
          <Text style={styles.label}>Логин</Text>
          <Text style={styles.value}>{(nickname || '').trim() || '—'}</Text>

          <Text style={styles.label}>Отображаемое имя</Text>
          <Text style={styles.value}>{(displayName || '').trim() || '—'}</Text>

          <Text style={styles.label}>О себе</Text>
          <Text style={styles.value}>{(about || '').trim() || '—'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Кошелёк</Text>
          <Text style={styles.label}>Адрес EIN</Text>
          <Text selectable style={styles.valueMono}>{walletAddress || '—'}</Text>
          <Text style={styles.hint}>Адрес выдаётся при регистрации. Он нужен для начисления наград за сообщения.</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={onOpenSettings}>
            <Text style={styles.btnText}>Настройки</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={onOpenDiagnostics}>
            <Text style={styles.btnText}>Диагностика</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnDanger} onPress={onLogoutPress}>
            <Text style={styles.btnText}>Выйти</Text>
          </TouchableOpacity>
        </View>

        <View style={{height: 24}} />
      </ScrollView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: {flex: 1, backgroundColor: t.colors.bg},
  scroll: {flex: 1},
  content: {padding: 16, paddingBottom: 40},
  card: {
    backgroundColor: t.colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    marginBottom: 12,
  },
  cardTitle: {color: t.colors.text, fontSize: 13, fontWeight: '800', marginBottom: 10},
  label: {color: t.colors.textMuted, fontSize: 11, marginTop: 8},
  value: {color: t.colors.text, fontSize: 13, fontWeight: '600', marginTop: 2, lineHeight: 18},
  valueMono: {color: t.colors.text, fontSize: 12, fontWeight: '700', marginTop: 4, letterSpacing: 0.4},
  hint: {color: t.colors.textMuted, fontSize: 11, marginTop: 8, lineHeight: 15},
  actions: {marginTop: 4},
  btn: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondary: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: t.colors.ghostBorder,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: t.colors.ghostBorder,
  },
  btnDanger: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: t.colors.dangerBg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.dangerBorderStrong,
  },
  btnText: {color: t.colors.text, fontSize: 13, fontWeight: '800'},
});
