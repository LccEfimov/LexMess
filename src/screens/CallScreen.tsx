import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {RTCView, MediaStream} from 'react-native-webrtc';

import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';

type Props = {
  calleeName: string;
  isVideo: boolean;
  connected: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isSpeaker: boolean;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onSwitchCamera: () => void;
  onToggleVideo: () => void;
  onRetry: () => void;
  connectionState?: string;
  reconnecting?: boolean;
};

export const CallScreen: React.FC<Props> = props => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const {
    calleeName,
    isVideo,
    connected,
    localStream,
    remoteStream,
    isMuted,
    isSpeaker,
    onEnd,
    onToggleMute,
    onToggleSpeaker,
    onSwitchCamera,
    onToggleVideo,
    onRetry,
    connectionState,
    reconnecting,
  } = props;

  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    let timer: any = null;
    if (connected) {
      timer = setInterval(() => setElapsedSec(s => s + 1), 1000);
    } else {
      setElapsedSec(0);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [connected]);

  const remoteUrl = remoteStream ? (remoteStream as any).toURL?.() : null;
  const localUrl = localStream ? (localStream as any).toURL?.() : null;

  const formatElapsed = () => {
    if (!connected) {
      if (reconnecting) {
        return 'Переподключение…';
      }
      return 'Соединение…';
    }
    const total = elapsedSec || 0;
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const stateLabel = () => {
    if (connected) {
      return 'В звонке';
    }
    if (reconnecting) {
      return 'Переподключение';
    }
    if (connectionState) {
      return `Связь: ${connectionState}`;
    }
    return 'Установка соединения';
  };

  const initials = (calleeName || 'L').trim()[0]?.toUpperCase() || 'L';

  const showRetry = !connected;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {calleeName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {stateLabel()}
          </Text>
        </View>
        <Text style={styles.timer}>{formatElapsed()}</Text>
      </View>

      <View style={styles.mediaArea}>
        {isVideo ? (
          <View style={styles.videoWrap}>
            {remoteUrl ? (
              <RTCView style={styles.remoteVideo} streamURL={remoteUrl} objectFit="cover" />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Ожидание видео…</Text>
              </View>
            )}

            {localUrl ? (
              <View style={styles.localPreviewWrap}>
                <RTCView style={styles.localPreview} streamURL={localUrl} objectFit="cover" />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.audioWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={onToggleMute}>
          <Text style={styles.btnText}>{isMuted ? '🎙️✖' : '🎙️'}</Text>
          <Text style={styles.btnLabel}>{isMuted ? 'Микр. выкл' : 'Микрофон'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onToggleSpeaker}>
          <Text style={styles.btnText}>{isSpeaker ? '🔊' : '🔈'}</Text>
          <Text style={styles.btnLabel}>Динамик</Text>
        </TouchableOpacity>

        {isVideo ? (
          <TouchableOpacity style={styles.btn} onPress={onToggleVideo}>
            <Text style={styles.btnText}>📷</Text>
            <Text style={styles.btnLabel}>Видео</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.btnGhost} />
        )}

        {isVideo ? (
          <TouchableOpacity style={styles.btn} onPress={onSwitchCamera}>
            <Text style={styles.btnText}>🔄</Text>
            <Text style={styles.btnLabel}>Камера</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.btnGhost} />
        )}

        {showRetry ? (
          <TouchableOpacity style={styles.btn} onPress={onRetry}>
            <Text style={styles.btnText}>♻️</Text>
            <Text style={styles.btnLabel}>Повтор</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.btnGhost} />
        )}

        <TouchableOpacity style={[styles.btn, styles.hangup]} onPress={onEnd}>
          <Text style={styles.btnText}>⛔</Text>
          <Text style={styles.hangupLabel}>Завершить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.bg,
      padding: t.spacing.lg,
    },
    topBar: {
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    titleWrap: {flex: 1, paddingRight: t.spacing.md},
    title: {
      color: t.colors.text,
      fontSize: 20,
      fontWeight: '700',
    },
    subtitle: {
      marginTop: 4,
      color: t.colors.textMuted,
      fontSize: 13,
    },
    timer: {color: t.colors.text, fontSize: 14, fontWeight: '600'},
    mediaArea: {flex: 1, overflow: 'hidden', borderRadius: t.radii.xl},
    videoWrap: {flex: 1, backgroundColor: '#000', borderRadius: t.radii.xl, overflow: 'hidden'},
    remoteVideo: {width: '100%', height: '100%'},
    placeholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    placeholderText: {color: t.colors.textMuted},
    localPreviewWrap: {
      position: 'absolute',
      right: t.spacing.md,
      bottom: t.spacing.md,
      width: 110,
      height: 160,
      borderRadius: t.radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: '#000',
    },
    localPreview: {width: '100%', height: '100%'},
    audioWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
    avatarCircle: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: t.colors.primarySoft,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {color: t.colors.text, fontSize: 44, fontWeight: '800'},
    controls: {
      paddingTop: t.spacing.lg,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    btn: {
      width: '30%',
      minWidth: 96,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: t.radii.lg,
      backgroundColor: t.colors.ghostBg,
      borderWidth: 1,
      borderColor: t.colors.ghostBorder,
      alignItems: 'center',
      marginBottom: t.spacing.md,
    },
    btnGhost: {
      width: '30%',
      minWidth: 96,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: t.radii.lg,
      opacity: 0,
      marginBottom: t.spacing.md,
    },
    btnText: {fontSize: 18, marginBottom: 6},
    btnLabel: {color: t.colors.textMuted, fontSize: 12, fontWeight: '600'},
    hangup: {
      backgroundColor: 'rgba(255,77,109,0.18)',
      borderColor: 'rgba(255,77,109,0.35)',
    },
    hangupLabel: {color: t.colors.danger, fontSize: 12, fontWeight: '800'},
  });
