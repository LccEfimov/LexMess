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
import {i18n} from '../i18n';

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
    lines.push(i18n.t('diagnostics.debug.build', {version: BUILD_VERSION, date: BUILD_DATE}));
    lines.push(i18n.t('diagnostics.debug.apiBase', {url: API_BASE_URL}));
    lines.push(i18n.t('diagnostics.debug.ws', {url: WS_URL}));
    lines.push('');
    lines.push(i18n.t('diagnostics.debug.localAccount'));
    lines.push(
      i18n.t('diagnostics.debug.login', {value: account?.login || i18n.t('common.dash')}),
    );
    lines.push(
      i18n.t('diagnostics.debug.displayName', {
        value: account?.display_name || i18n.t('common.dash'),
      }),
    );
    lines.push(
      i18n.t('diagnostics.debug.walletAddress', {
        value: account?.wallet_address || i18n.t('common.dash'),
      }),
    );
    lines.push(
      i18n.t('diagnostics.debug.recoveryShown', {value: account?.recovery_shown ? '1' : '0'}),
    );
    lines.push('');
    lines.push(i18n.t('diagnostics.debug.permissions'));
    lines.push(
      i18n.t('diagnostics.debug.permissionsOk', {
        value: perm.ok ? i18n.t('common.true') : i18n.t('common.false'),
      }),
    );
    lines.push(i18n.t('diagnostics.debug.permissionsMissing', {count: perm.missing.length}));
    for (const m of perm.missing.slice(0, 20)) {
      lines.push(i18n.t('diagnostics.debug.permissionsItem', {permission: m}));
    }
    if (perm.missing.length > 20) {
      lines.push(i18n.t('diagnostics.debug.permissionsMore'));
    }
    lines.push('');
    lines.push(i18n.t('diagnostics.debug.push'));
    lines.push(
      i18n.t('diagnostics.debug.pushToken', {token: pushToken ? pushToken : i18n.t('common.dash')}),
    );
    return lines.join('\n');
  }, [account, perm, pushToken]);

  const handleCopy = async () => {
    try {
      await Share.share({message: debugText});
    } catch (e) {
      Alert.alert(i18n.t('diagnostics.alerts.errorTitle'), i18n.t('diagnostics.alerts.shareFailed'));
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title={i18n.t('diagnostics.title')} onBack={onBack} right={null} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.blockTitle}>{i18n.t('diagnostics.sections.build')}</Text>
        <Text style={styles.value}>{i18n.t('diagnostics.build.version', {version: BUILD_VERSION})}</Text>
        <Text style={styles.value}>{i18n.t('diagnostics.build.date', {date: BUILD_DATE})}</Text>

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>{i18n.t('diagnostics.sections.network')}</Text>
        <Text style={styles.value}>{i18n.t('diagnostics.network.api', {url: API_BASE_URL})}</Text>
        <Text style={styles.value}>{i18n.t('diagnostics.network.ws', {url: WS_URL})}</Text>

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>{i18n.t('diagnostics.sections.account')}</Text>
        <Text style={styles.value}>
          {i18n.t('diagnostics.account.login', {value: account?.login || i18n.t('common.dash')})}
        </Text>
        <Text style={styles.value}>
          {i18n.t('diagnostics.account.name', {
            value: account?.display_name || i18n.t('common.dash'),
          })}
        </Text>
        <Text style={styles.value}>
          {i18n.t('diagnostics.account.address', {
            value: account?.wallet_address || i18n.t('common.dash'),
          })}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>{i18n.t('diagnostics.sections.permissions')}</Text>
        <Text style={styles.value}>
          {i18n.t('diagnostics.permissions.ok', {
            value: perm.ok ? i18n.t('common.yes') : i18n.t('common.no'),
          })}
        </Text>
        <Text style={styles.value}>
          {i18n.t('diagnostics.permissions.missingCount', {count: perm.missing.length})}
        </Text>

        {perm.missing.length > 0 && (
          <View style={styles.missingBox}>
            {perm.missing.slice(0, 12).map((p: string) => (
              <Text key={p} style={styles.missingItem}>
                {i18n.t('diagnostics.permissions.item', {permission: p})}
              </Text>
            ))}
            {perm.missing.length > 12 && (
              <Text style={styles.missingItem}>{i18n.t('common.ellipsis')}</Text>
            )}
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.blockTitle}>{i18n.t('diagnostics.sections.push')}</Text>
        <Text style={styles.value} numberOfLines={2}>
          {i18n.t('diagnostics.push.token', {token: pushToken || i18n.t('common.dash')})}
        </Text>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.primaryBtn} onPress={handleCopy}>
          <Text style={styles.primaryBtnText}>{i18n.t('diagnostics.actions.copy')}</Text>
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
