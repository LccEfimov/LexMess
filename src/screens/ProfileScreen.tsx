import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {loadLocalAccount} from '../storage/localAccountStorage';
import {i18n} from '../i18n';
import {Button} from '../ui';

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
    return i18n.t('profile.title');
  }, [displayName, nickname]);

  const onLogoutPress = useCallback(() => {
    onLogout();
  }, [onLogout]);

  return (
    <View style={styles.root}>
      <AppHeader title={i18n.t('profile.title')} subtitle={titleName} onBack={null} right={null} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{i18n.t('profile.account.title')}</Text>
          <Text style={styles.label}>{i18n.t('profile.account.login')}</Text>
          <Text style={styles.value}>{(nickname || '').trim() || i18n.t('common.dash')}</Text>

          <Text style={styles.label}>{i18n.t('profile.account.displayName')}</Text>
          <Text style={styles.value}>
            {(displayName || '').trim() || i18n.t('common.dash')}
          </Text>

          <Text style={styles.label}>{i18n.t('profile.account.about')}</Text>
          <Text style={styles.value}>{(about || '').trim() || i18n.t('common.dash')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{i18n.t('profile.wallet.title')}</Text>
          <Text style={styles.label}>{i18n.t('profile.wallet.addressLabel')}</Text>
          <Text selectable style={styles.valueMono}>{walletAddress || i18n.t('common.dash')}</Text>
          <Text style={styles.hint}>{i18n.t('profile.wallet.hint')}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={i18n.t('profile.actions.settings')}
            onPress={onOpenSettings}
            style={styles.actionButton}
          />
          <Button
            title={i18n.t('profile.actions.diagnostics')}
            onPress={onOpenDiagnostics}
            style={styles.actionButton}
            secondary
          />
          <Button
            title={i18n.t('profile.actions.logout')}
            onPress={onLogoutPress}
            danger
          />
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
  actionButton: {marginBottom: 10},
});
