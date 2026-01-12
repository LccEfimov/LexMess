import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';

import {
  checkRequiredRuntimePermissions,
  requestRequiredRuntimePermissions,
  humanizePermission,
  getRequiredRuntimePermissions,
  type RuntimePermissionCheck,
} from '../permissions/androidPermissions';
import {i18n} from '../i18n';

interface Props {
  onDone: () => void;
}

export const PermissionsScreen: React.FC<Props> = ({onDone}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const required = useMemo(() => getRequiredRuntimePermissions(), []);
  const [state, setState] = useState<RuntimePermissionCheck>({
    ok: false,
    granted: [],
    missing: required,
  });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await checkRequiredRuntimePermissions();
    setState(res);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ask = useCallback(async () => {
    if (busy) return;
    try {
      setBusy(true);
      const res = await requestRequiredRuntimePermissions();
      setState(res);
      if (res.ok) {
        onDone();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, onDone]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch (e) {
      // ignore
    }
  }, []);

  const isAndroid = Platform.OS === 'android';

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>{i18n.t('permissions.title')}</Text>
        <Text style={styles.subtitle}>{i18n.t('permissions.subtitle')}</Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {required.map(p => {
            const ok = state.granted.includes(p);
            return (
              <View key={p} style={styles.row}>
                <Text style={styles.bullet}>{ok ? '✅' : '⬜️'}</Text>
                <Text style={styles.rowText}>{humanizePermission(p)}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, busy ? styles.btnDisabled : null]}
            onPress={ask}
            disabled={busy || !isAndroid}>
            <Text style={styles.btnText}>
              {busy ? i18n.t('permissions.actions.requesting') : i18n.t('permissions.actions.allowAll')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={refresh}>
            <Text style={[styles.btnText, styles.btnGhostText]}>
              {i18n.t('permissions.actions.refresh')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={openSettings}>
            <Text style={[styles.btnText, styles.btnGhostText]}>
              {i18n.t('permissions.actions.openSettings')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSkip} onPress={onDone}>
            <Text style={styles.btnSkipText}>{i18n.t('permissions.actions.skip')}</Text>
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
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.lg,
  },
  card: {
    flex: 1,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing.lg,
  },
  title: {
    ...t.typography.title,
    fontSize: 26,
    fontWeight: '800',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  subtitle: {
    ...t.typography.bodyRegular,
    color: t.colors.textMuted,
    lineHeight: 20,
    marginBottom: t.spacing.md,
  },
  list: {
    flex: 1,
    marginTop: t.spacing.xs,
  },
  listContent: {
    paddingBottom: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  bullet: {
    width: 32,
    fontSize: 16,
  },
  rowText: {
    flex: 1,
    ...t.typography.bodyRegular,
    color: t.colors.text,
  },
  buttons: {
    marginTop: t.spacing.md,
  },
  btn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.radii.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.md,
    alignItems: 'center',
    marginBottom: t.spacing.sm,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    ...t.typography.body,
    color: t.colors.onPrimary,
    fontWeight: '800',
  },
  btnGhost: {
    backgroundColor: t.colors.ghostBg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  btnGhostText: {
    color: t.colors.text,
  },
  btnSkip: {
    paddingVertical: t.spacing.sm,
    alignItems: 'center',
  },
  btnSkipText: {
    color: t.colors.textMuted,
    textDecorationLine: 'underline',
  },
});
