import React, {useMemo} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {sendRoomRtcSignal} from '../net/wsClient';
import {clearLastOffer} from '../bus/rtcBus';
import {logger} from '../utils/logger';

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
      logger.warn('IncomingCallScreen', 'decline send busy failed', {error: e});
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
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: t.colors.card,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    color: t.colors.textMuted,
    marginBottom: 8,
  },
  caller: {
    fontSize: 22,
    color: t.colors.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: t.colors.placeholder,
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  buttonDecline: {
    backgroundColor: '#3b1f2a',
  },
  buttonAccept: {
    backgroundColor: '#1c4c2a',
  },
  buttonDeclineText: {
    color: t.colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonAcceptText: {
    color: '#3bff9c',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default IncomingCallScreen;
