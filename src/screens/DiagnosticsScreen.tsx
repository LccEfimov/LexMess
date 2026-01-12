import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share} from 'react-native';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';

import {API_BASE_URL, WS_URL} from '../config/networkConfig';
import {BUILD_DATE, BUILD_VERSION} from '../config/buildInfo';
import {loadLocalAccount} from '../storage/localAccountStorage';
import {checkRequiredRuntimePermissions} from '../permissions/androidPermissions';
import {getMessaging} from '../firebase/getMessaging';

type Props = {
  onBack: () => void;
};

export const DiagnosticsScreen: React.FC<Props> = ({onBack}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [account, setAccount] = useState<any>(null);
  const [perm, setPerm] = useState<{ok: boolean; granted: string[]; missing: string[]}>({
    ok: true,
    granted: [],
    missing: [],
  });
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const a = await loadLocalAccount();
        if (!cancelled) {
          setAccount(a);
        }
      } catch {}

      try {
        const p = await checkRequiredRuntimePermissions();
        if (!cancelled) {
          setPerm(p);
        }
      } catch {}

      try {
        const messaging = getMessaging();
        if (messaging && typeof messaging.getToken === 'function') {
          const t = await messaging.getToken();
          if (!cancelled) {
            setPushToken(typeof t === 'string' ? t : null);
          }
        }
      } catch {
        // ignore
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const debugText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`LexMess build: ${BUILD_VERSION} (${BUILD_DATE})`);
    lines.push(`API_BASE_URL: ${API_BASE_URL}`);
    lines.push(`WS_URL: ${WS_URL}`);
    lines.push('');
    lines.push('Local account:');
    lines.push(`  login: ${account?.login || '-'}`);
    lines.push(`  display_name: ${account?.display_name || '-'}`);
    lines.push(`  wallet_address: ${account?.wallet_address || '-'}`);
    lines.push(`  recovery_shown: ${account?.recovery_shown ? '1' : '0'}`);
    lines.push('');
    lines.push('Android permissions:');
    lines.push(`  ok: ${perm.ok ? 'true' : 'false'}`);
    lines.push(`  missing: ${perm.missing.length}`);
    for (const m of perm.missing.slice(0, 20)) {
      lines.push(`   - ${m}`);
    }
    if (perm.missing.length > 20) {
      lines.push('   ...');
    }
    lines.push('');
    lines.push('Push:');
    lines.push(`  token: ${pushToken ? pushToken : '-'}`);
    return lines.join('\n');
  }, [account, perm, pushToken]);

  const handleCopy = async () => {
    try {
      await Share.share({message: debugText});
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось открыть системное меню "Поделиться".');
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Диагностика" onBack={onBack} right={null} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.blockTitle}>Сборка</Text>
        <Text style={styles.value}>Версия: {BUILD_VERSION}</Text>
        <Text style={styles.value}>Дата: {BUILD_DATE}</Text>

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>Сеть</Text>
        <Text style={styles.value}>API: {API_BASE_URL}</Text>
        <Text style={styles.value}>WS: {WS_URL}</Text>

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>Аккаунт (локально)</Text>
        <Text style={styles.value}>Login: {account?.login || '-'}</Text>
        <Text style={styles.value}>Имя: {account?.display_name || '-'}</Text>
        <Text style={styles.value}>Адрес: {account?.wallet_address || '-'}</Text>

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>Разрешения</Text>
        <Text style={styles.value}>OK: {perm.ok ? 'Да' : 'Нет'}</Text>
        <Text style={styles.value}>Не хватает: {perm.missing.length}</Text>

        {perm.missing.length > 0 && (
          <View style={styles.missingBox}>
            {perm.missing.slice(0, 12).map((p: string) => (
              <Text key={p} style={styles.missingItem}>
                • {p}
              </Text>
            ))}
            {perm.missing.length > 12 && <Text style={styles.missingItem}>…</Text>}
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>Push</Text>
        <Text style={styles.value} numberOfLines={2}>
          Token: {pushToken || '-'}
        </Text>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.primaryBtn} onPress={handleCopy}>
          <Text style={styles.primaryBtnText}>Скопировать диагностику</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: {flex: 1, backgroundColor: t.colors.bg},
  header: {
    paddingTop: t.spacing.md,
    paddingHorizontal: t.spacing.md,
    paddingBottom: t.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: t.colors.ghostBg},
  backText: {color: t.colors.text, fontSize: 14},
  title: {color: t.colors.text, fontSize: 18, fontWeight: '700', marginLeft: t.spacing.md},
  content: {padding: t.spacing.md, paddingBottom: t.spacing.xl},
  blockTitle: {...t.typography.body, color: t.colors.text, fontWeight: '700', marginBottom: t.spacing.xs},
  value: {...t.typography.bodyRegular, color: t.colors.textMuted, marginBottom: 3},
  divider: {height: 1, backgroundColor: t.colors.ghostBg, marginVertical: t.spacing.md},
  missingBox: {padding: t.spacing.sm, borderRadius: t.radii.md, backgroundColor: t.colors.ghostBg},
  missingItem: {...t.typography.caption, color: t.colors.textMuted, marginBottom: 4},
  primaryBtn: {
    marginTop: t.spacing.sm,
    paddingVertical: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
  },
  primaryBtnText: {...t.typography.body, color: t.colors.onPrimary, fontWeight: '700'},
});
