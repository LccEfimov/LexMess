import React, {useMemo} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {sendRoomRtcSignal} from '../net/wsClient';
import {clearLastOffer} from '../bus/rtcBus';

type Props = {
  navigation: any;
  route: {
    params: {
      roomId: string;
      callerId?: string;
      callerName?: string;
      isVideo?: boolean;
      callId?: string;
      myUserId?: string;
    };
  };
};

export const IncomingCallScreen: React.FC<Props> = ({navigation, route}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const {roomId, callerId, callerName, isVideo, callId, myUserId} =
    route.params || {};

  const displayName = callerName || callerId || 'Собеседник';
  const videoLabel = isVideo === false ? 'Голосовой звонок' : 'Видео-звонок';

  const handleDecline = () => {
    try {
      if (roomId && callId && (callerId || route.params?.callerId)) {
        const fromId = myUserId || 'me';
        const toId = callerId || route.params?.callerId || undefined;

        sendRoomRtcSignal({
          roomId,
          from: fromId,
          to: toId,
          signalType: 'busy',
          payload: {
            callId,
            reason: 'rejected',
          },
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[IncomingCallScreen] decline send busy failed', e);
    } finally {
      clearLastOffer(callId || null);
      navigation.goBack();
    }
  };

  const handleAccept = () => {
    // Не шлем отдельный сигнал — ответ сформируется в CallScreen через useWebRtcP2P (answer на offer)
    navigation.replace('Call', {
      roomId,
      calleeName: displayName,
      isVideo: isVideo !== false,
      isCaller: false,
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Входящий звонок</Text>
        <Text style={styles.caller}>{displayName}</Text>
        <Text style={styles.subtitle}>{videoLabel}</Text>

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonDecline]}
            onPress={handleDecline}>
            <Text style={styles.buttonDeclineText}>Отклонить</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonAccept]}
            onPress={handleAccept}>
            <Text style={styles.buttonAcceptText}>Принять</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.spacing.xl,
  },
  card: {
    width: '100%',
    borderRadius: t.radii.xl,
    backgroundColor: t.colors.card,
    paddingVertical: t.spacing.xl,
    paddingHorizontal: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center',
  },
  title: {
    ...t.typography.body,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
  },
  caller: {
    ...t.typography.title,
    fontSize: 22,
    color: t.colors.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    ...t.typography.bodyRegular,
    color: t.colors.textMuted,
    marginBottom: t.spacing.lg,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginTop: t.spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.pill,
    alignItems: 'center',
    marginHorizontal: t.spacing.xs,
  },
  buttonDecline: {
    backgroundColor: t.colors.danger,
  },
  buttonAccept: {
    backgroundColor: t.colors.success,
  },
  buttonDeclineText: {
    ...t.typography.body,
    color: t.colors.onPrimary,
    fontWeight: '600',
  },
  buttonAcceptText: {
    ...t.typography.body,
    color: t.colors.onPrimary,
    fontWeight: '600',
  },
});

export default IncomingCallScreen;
