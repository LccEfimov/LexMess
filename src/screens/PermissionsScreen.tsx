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
        <Text style={styles.title}>Разрешения</Text>
        <Text style={styles.subtitle}>
          Чтобы работали медиа, звонки, уведомления и скрытые PNG, приложению нужны
          системные разрешения.
        </Text>

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
              {busy ? 'Запрашиваю…' : 'Разрешить всё'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={refresh}>
            <Text style={[styles.btnText, styles.btnGhostText]}>Обновить</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={openSettings}>
            <Text style={[styles.btnText, styles.btnGhostText]}>Открыть настройки</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSkip} onPress={onDone}>
            <Text style={styles.btnSkipText}>Пропустить пока</Text>
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
    backgroundColor: '#0b1220',
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 18,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 30, 50, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(120, 160, 255, 0.25)',
    padding: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#e8eefc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#b8c4de',
    lineHeight: 20,
    marginBottom: 12,
  },
  list: {
    flex: 1,
    marginTop: 6,
  },
  listContent: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.ghostBg,
  },
  bullet: {
    width: 32,
    fontSize: 16,
  },
  rowText: {
    flex: 1,
    color: '#e8eefc',
    fontSize: 15,
  },
  buttons: {
    marginTop: 12,
  },
  btn: {
    backgroundColor: '#2b69ff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    color: t.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  btnGhost: {
    backgroundColor: t.colors.ghostBg,
    borderWidth: 1,
    borderColor: 'rgba(120, 160, 255, 0.25)',
  },
  btnGhostText: {
    color: '#e8eefc',
  },
  btnSkip: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSkipText: {
    color: '#b8c4de',
    textDecorationLine: 'underline',
  },
});