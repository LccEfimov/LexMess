
import React, {useMemo, useRef, useState, useEffect, useCallback} from 'react';
import {
  Pressable,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Linking,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Pressable,SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Pressable,AppHeader} from '../components/AppHeader';
import {
  Pressable,useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';

const makeAttachButtonStyles = (t: Theme) =>
  StyleSheet.create({
    attachItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
    },
    attachCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primarySoft,
      marginRight: 10,
    },
    attachCircleText: {color: t.primary, fontSize: 16, fontWeight: '700'},
    attachItemLabel: {color: t.text, fontSize: 14, fontWeight: '600'},
  });
import DocumentPicker from 'react-native-document-picker';
import {
  Pressable,launchImageLibrary} from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

type ChatMessage = {
  id: string;
  sender: string;
  body: string;
  outgoing: boolean;
  contentType?: string;
  localPath?: string | null;
  deliveryStatus?: 'local' | 'sent' | 'delivered' | 'failed';
};

type Participant = {
  id: string;
  name: string;
};

interface Props {
  roomTitle: string;
  messages: ChatMessage[];
  participants: Participant[];
  pendingCount?: number;
  onRetryPending?: () => void | Promise<void>;
  onSendText: (text: string, toAll: boolean) => void;
  onSendMedia: (
    kind: 'file' | 'image' | 'video' | 'audio',
    fileInfo: {uri: string; name: string; mimeType?: string | null},
  ) => void | Promise<void>;
  onOpenAttachments?: () => void;
  onBack: () => void;
  onOpenMain: () => void;
  onOpenSettings: () => void;
  onStartCall: (opts: {isVideo: boolean; toAll: boolean}) => void;
  onOpenParticipants?: () => void;
}


function dedupMessages(list: any[]) {
  const map = new Map<string, any>();
  for (const m of list) {
    const key =
      m?.clientMsgId ||
      m?.message_id ||
      m?.messageId ||
      `${m?.sender || 'u'}:${m?.ts || m?.created_at || ''}`;
    if (!map.has(key)) {
      map.set(key, m);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = a?.ts || a?.created_at || 0;
    const tb = b?.ts || b?.created_at || 0;
    return ta - tb;
  });
}

export const ChatScreen: React.FC<Props> = ({
  roomTitle,
  messages,
  participants,
  pendingCount,
  onRetryPending,
  onSendText,
  onSendMedia,
  onOpenAttachments,
  onBack,
  onOpenMain,
  onOpenSettings,
  onStartCall,
  onOpenParticipants,
  onOpenRoomDetails,

}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const insets = useSafeAreaInsets();
  const keyboardOffset = 56 + insets.top;

  const listRef = useRef<any | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleListScroll = useCallback((e: any) => {
    const y = Number(e?.nativeEvent?.contentOffset?.y || 0);
    setIsAtBottom(y <= 40);
  }, []);

  useEffect(() => {
    if (!isAtBottom) return;
    // In inverted FlatList, offset 0 corresponds to the "bottom" (latest messages).
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToOffset?.({offset: 0, animated: true});
      } catch (err) {
        // ignore
      }
    });
  }, [messages.length, isAtBottom]);


  const [text, setText] = useState('');
  const [toAll, setToAll] = useState(true);
  const [attachmentsVisible, setAttachmentsVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [recipientsVisible, setRecipientsVisible] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const recorderRef = React.useRef<any | null>(null);
  if (!recorderRef.current) {
    recorderRef.current = new AudioRecorderPlayer();
  }

  const recordingPathRef = React.useRef<string | null>(null);

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voicePosition, setVoicePosition] = useState<number>(0);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);



  const toggleRecipientsMode = () => {
    if (toAll) {
      setToAll(false);
      setRecipientsVisible(true);
    } else {
      setToAll(true);
    }
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleRecipientsDone = () => {
    setRecipientsVisible(false);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    // Пока что onSendText знает только про toAll; список получателей можно
    // будет добавить в сигнатуру позже и передавать ниже в крипто-ядро.
    console.log('Selected recipients for message:', selectedRecipientIds);
    onSendText(trimmed, toAll);
    setText('');
  };

  const openAttachments = () => {
    setAttachmentsVisible(true);
    if (onOpenAttachments) {
      onOpenAttachments();
    }
  };

  const closeAttachments = () => setAttachmentsVisible(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleAttachFile = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        presentationStyle: 'fullScreen',
        copyTo: 'cachesDirectory',
      });
      if (!res) {
        return;
      }
      const info = {
        uri: (res.fileCopyUri || res.uri),
        name: res.name || 'file',
        mimeType: res.type ?? null,
      };
      await onSendMedia('file', info);
      closeAttachments();
    } catch (e: any) {
      if (e && e.code === 'DOCUMENT_PICKER_CANCELED') {
        return;
      }
      console.warn('ChatScreen: handleAttachFile error', e);
    }
  };

  const handleAttachPhoto = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });
      if (res.didCancel || !res.assets || res.assets.length === 0) {
        return;
      }
      const asset = res.assets[0];
      if (!asset.uri) {
        return;
      }
      const info = {
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        mimeType: asset.type ?? null,
      };
      await onSendMedia('image', info);
      closeAttachments();
    } catch (e) {
      console.warn('ChatScreen: handleAttachPhoto error', e);
    }
  };

  const handleAttachVideo = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'video',
        selectionLimit: 1,
      });
      if (res.didCancel || !res.assets || res.assets.length === 0) {
        return;
      }
      const asset = res.assets[0];
      if (!asset.uri) {
        return;
      }
      const info = {
        uri: asset.uri,
        name: asset.fileName || 'video.mp4',
        mimeType: asset.type ?? null,
      };
      await onSendMedia('video', info);
      closeAttachments();
    } catch (e) {
      console.warn('ChatScreen: handleAttachVideo error', e);
    }
  };



  const handleVoiceAll = async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }

    try {
      if (!isRecordingVoice) {
        const outPath = `${RNFS.DocumentDirectoryPath}/lexmess_voice_${Date.now()}.m4a`;
        recordingPathRef.current = outPath;
        await recorder.startRecorder(outPath);
        setIsRecordingVoice(true);
      } else {
        const stoppedPath = await recorder.stopRecorder();
        setIsRecordingVoice(false);

        const rawPath = (stoppedPath || recordingPathRef.current || '').toString();
        if (!rawPath) {
          return;
        }

        const uri = rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`;
        const name = rawPath.split('/').pop() || `voice_${Date.now()}.m4a`;

        await onSendMedia('audio', {
          uri,
          name,
          mimeType: 'audio/m4a',
        });
        closeAttachments();
      }
    } catch (e) {
      console.warn('ChatScreen: handleVoiceAll error', e);
      setIsRecordingVoice(false);
    }
  };

  const handleVoiceSelective = async () => {
    // Пока что выборочные получатели не реализованы в крипто-ядре,
    // поэтому отправляем так же, как и для "всех".
    await handleVoiceAll();
  };

  const handleGoMain = () => {
    closeMenu();
    onOpenMain();
  };

  const handleGoSettings = () => {
    closeMenu();
    onOpenSettings();
  };

  const handleStartCall = (isVideo: boolean, all: boolean) => {
    console.log('Selected recipients for call:', selectedRecipientIds);
    closeAttachments();
    onStartCall({isVideo, toAll: all});
  };



  const formatMillis = (ms: number) => {
    if (!ms || ms <= 0) {
      return '0:00';
    }
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const sStr = s < 10 ? `0${s}` : String(s);
    return `${m}:${sStr}`;
  };

  
  const copyToClipboard = useCallback(async (text: string) => {
    const v = String(text || '');
    if (!v) return;
    try {
      // Optional dependency. If not installed, we fallback to Share.
      // @ts-ignore
      const Clipboard = require('@react-native-clipboard/clipboard')?.default;
      if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(v);
        return;
      }
    } catch {}
    try {
      await Share.share({message: v});
    } catch {}
  }, []);

  const openMessageActions = useCallback(
    async (item: ChatMessage, fileUri?: string) => {
      const status = String(item.deliveryStatus || '').toLowerCase();
      if (item.contentType === 'system') {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{item.body}</Text>
        </View>
      );
    }

    const canRetry =
        !!onRetryPending &&
        item.outgoing &&
        (status === 'queued' || status === 'failed' || status === 'local' || status === 'sending');

      const buttons: any[] = [];

      if (canRetry && onRetryPending) {
        buttons.push({
          text: 'Повторить отправку',
          onPress: () => {
            try {
              onRetryPending();
            } catch (e) {
              console.warn('ChatScreen: onRetryPending failed', e);
            }
          },
        });
      }

      if (item.contentType === 'text' && item.body) {
        buttons.push({
          text: 'Копировать текст',
          onPress: () => {
            copyToClipboard(String(item.body || '')).catch(() => {});
          },
        });
      }

      if (fileUri) {
        buttons.push({
          text: 'Открыть файл',
          onPress: () => {
            try {
              Linking.openURL(fileUri);
            } catch (e) {
              console.warn('ChatScreen: open file failed', e);
            }
          },
        });
      }

      buttons.push({
        text: 'Поделиться',
        onPress: () => {
          const payload = item.contentType === 'text' ? String(item.body || '') : String(item.body || 'Сообщение');
          Share.share({message: payload}).catch(() => {});
        },
      });

      buttons.push({text: 'Отмена', style: 'cancel'});

      Alert.alert('Действия', undefined, buttons);
    },
    [copyToClipboard, onRetryPending],
  );

const handleToggleVoice = async (msg: ChatMessage) => {
    const recorder = recorderRef.current;
    if (!recorder || !msg.localPath) {
      return;
    }

    try {
      let path = msg.localPath;
      if (path.startsWith('file://')) {
        path = path.replace('file://', '');
      }

      if (playingVoiceId === msg.id) {
        try {
          await recorder.stopPlayer();
          try {
            recorder.removePlayBackListener && recorder.removePlayBackListener();
          } catch (e) {
            // ignore
          }
        } catch (e) {
          console.warn('ChatScreen: stopPlayer error', e);
        }
        setPlayingVoiceId(null);
        setVoicePosition(0);
        setVoiceDuration(0);
      } else {
        try {
          await recorder.stopPlayer();
          try {
            recorder.removePlayBackListener && recorder.removePlayBackListener();
          } catch (e) {
            // ignore
          }
        } catch (e) {
          // ignore
        }

        setVoicePosition(0);
        setVoiceDuration(0);

        await recorder.startPlayer(path);
        setPlayingVoiceId(msg.id);

        try {
          recorder.addPlayBackListener &&
            recorder.addPlayBackListener((e: any) => {
              if (!e) {
                return;
              }
              const pos = e.currentPosition ?? 0;
              const dur = e.duration ?? 0;
              setVoicePosition(pos);
              setVoiceDuration(dur);
              if (dur > 0 && pos >= dur) {
                setPlayingVoiceId(null);
                setVoicePosition(0);
                setVoiceDuration(0);
                try {
                  recorder.stopPlayer();
                  recorder.removePlayBackListener &&
                    recorder.removePlayBackListener();
                } catch (err) {
                  // ignore
                }
              }
            });
        } catch (e) {
          console.warn('ChatScreen: addPlayBackListener error', e);
        }
      }
    } catch (e) {
      console.warn('ChatScreen: handleToggleVoice error', e);
      setPlayingVoiceId(null);
      setVoicePosition(0);
      setVoiceDuration(0);
    }
  };

  
const renderMessage = ({item}: {item: ChatMessage}) => {
    const isImage =
      item.contentType === 'image' &&
      item.localPath &&
      typeof item.localPath === 'string';
    const isAudio = item.contentType === 'audio' && item.localPath;
    const isFile =
      (item.contentType === 'file' || item.contentType === 'video') &&
      item.localPath &&
      typeof item.localPath === 'string';

    let uri: string | undefined;
    if (isImage && item.localPath) {
      uri = item.localPath.startsWith('file://')
        ? item.localPath
        : `file://${item.localPath}`;
    }

    let fileUri: string | undefined;
    if (isFile && item.localPath) {
      fileUri = item.localPath.startsWith('file://')
        ? item.localPath
        : `file://${item.localPath}`;
    }

    const ts = Number((item as any).ts || 0);
    const timeText = ts
      ? new Date(ts).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})
      : '';

    const status = String(item.deliveryStatus || '').toLowerCase();
    const statusSymbol =
      status === 'read'
        ? '✓✓'
        : status === 'delivered'
        ? '✓✓'
        : status === 'sent'
        ? '✓'
        : status === 'queued' || status === 'local'
        ? '⏳'
        : status === 'failed'
        ? '!'
        : status
        ? '…'
        : '';

    if (item.contentType === 'system') {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{item.body}</Text>
        </View>
      );
    }

    const canRetry =
      !!onRetryPending &&
      item.outgoing &&
      (status === 'queued' || status === 'failed' || status === 'local');

    return (
      <Pressable
        onLongPress={() => {
          try {
            // open contextual actions for message
            // fileUri is in closure
            openMessageActions(item as any, fileUri);
          } catch (e) {
            console.warn('ChatScreen: openMessageActions failed', e);
          }
        }}
        style={[
          styles.bubble,
          item.outgoing ? styles.bubbleOutgoing : styles.bubbleIncoming,
        ]}>
        <Text style={styles.sender}>{item.sender}</Text>
        {isImage && uri ? (
          <Image source={{uri}} style={styles.imageThumb} resizeMode="cover" />
        ) : isAudio ? (
          <View style={styles.audioRow}>
            <TouchableOpacity
              style={styles.audioButton}
              onPress={() => handleToggleVoice(item)}>
              <Text style={styles.audioButtonText}>
                {playingVoiceId === item.id ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.audioLabel}>
              Голосовое сообщение
              {playingVoiceId === item.id
                ? `  ${formatMillis(voicePosition)} / ${formatMillis(voiceDuration)}`
                : ''}
            </Text>
          </View>
        ) : isFile && fileUri ? (
          <View style={styles.fileRow}>
            <Text style={styles.fileName}>{item.body || 'Файл'}</Text>
            <TouchableOpacity
              style={styles.fileOpenBtn}
              onPress={() => {
                try {
                  Linking.openURL(fileUri);
                } catch (e) {
                  console.warn('ChatScreen: open file failed', e);
                }
              }}>
              <Text style={styles.fileOpenText}>Открыть</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.body}>{item.body}</Text>
        )}

        <View style={styles.metaRow}>
          {!!timeText && <Text style={styles.metaTime}>{timeText}</Text>}
          {item.outgoing && status === 'failed' && onRetryPending ? (
            <TouchableOpacity style={styles.retryInline} onPress={onRetryPending}>
              <Text style={styles.retryInlineText}>Повторить</Text>
            </TouchableOpacity>
          ) : null}
          {item.outgoing && !!statusSymbol && (
            <Text
              style={[
                styles.deliveryStatus,
                status === 'read' ? styles.deliveryStatusRead : null,
                canRetry ? styles.deliveryStatusRetry : null,
              ]}>
              {statusSymbol}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };



  const recipientsLabel = toAll
    ? 'Всем'
    : selectedRecipientIds.length > 0
    ? `Выборочно (${selectedRecipientIds.length})`
    : 'Выборочно';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}>
      <SafeAreaView style={styles.root} edges={['bottom']}>
      <AppHeader
        title={roomTitle}
        onBack={onBack}
        right={
          <View style={styles.headerRight}>
            {typeof pendingCount === 'number' && pendingCount > 0 && onRetryPending ? (
              <TouchableOpacity style={styles.retryBtn} onPress={onRetryPending}>
                <Text style={styles.retryIcon}>↻</Text>
                <View style={styles.retryBadge}>
                  <Text style={styles.retryBadgeText}>{pendingCount}</Text>
                </View>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                if (onOpenParticipants) {
                  onOpenParticipants();
                }
              }}>
              <Text style={styles.headerIcon}>👥</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (onOpenRoomDetails) {
                  onOpenRoomDetails();
                }
              }}>
              <Text style={styles.headerIcon}>ⓘ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openMenu}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Бургер-меню */}
      <Modal
        animationType="fade"
        transparent
        visible={menuVisible}
        onRequestClose={closeMenu}>
        <View style={styles.menuBackdrop}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Навигация</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleGoMain}>
              <Text style={styles.menuItemText}>Главный экран</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                if (onOpenRoomDetails) {
                  onOpenRoomDetails();
                }
              }}>
              <Text style={styles.menuItemText}>О комнате</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleGoSettings}>
              <Text style={styles.menuItemText}>Настройки</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={closeMenu}>
              <Text style={styles.menuItemText}>Закрыть меню</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка выбора получателей */}
      <Modal
        animationType="slide"
        transparent
        visible={recipientsVisible}
        onRequestClose={handleRecipientsDone}>
        <View style={styles.modalBackdrop}>
          <View style={styles.recipientsPanel}>
            <Text style={styles.attachTitle}>Выбор получателей</Text>
            <ScrollView style={styles.recipientsList}>
              {participants.map(p => {
                const active = selectedRecipientIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.recipientRow}
                    onPress={() => toggleRecipient(p.id)}>
                    <View
                      style={[
                        styles.recipientCheck,
                        active && styles.recipientCheckActive,
                      ]}>
                      {active && <Text style={styles.recipientCheckMark}>✓</Text>}
                    </View>
                    <Text style={styles.recipientName}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeAttachButton}
              onPress={handleRecipientsDone}>
              <Text style={styles.closeAttachText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        ref={listRef}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Пока нет сообщений</Text>
            <Text style={styles.emptyHint}>Отправьте первое сообщение, чтобы начать диалог.</Text>
          </View>
        }
        inverted
      />

      {/* Панель вложений (нижняя всплывашка) */}
      <Modal
        animationType="slide"
        transparent
        visible={attachmentsVisible}
        onRequestClose={closeAttachments}>
        <View style={styles.modalBackdrop}>
          <View style={styles.attachPanel}>
            <Text style={styles.attachTitle}>Вложения и звонки</Text>
            <View style={styles.attachGrid}>
              <AttachButton label="Файл" onPress={handleAttachFile} />
              <AttachButton label="Фото" onPress={handleAttachPhoto} />
              <AttachButton label="Видео" onPress={handleAttachVideo} />
              <AttachButton
                label={isRecordingVoice ? "Стоп голос всем" : "Голос всем"}
                onPress={handleVoiceAll}
              />
              <AttachButton
                label="Голос выборочно"
                onPress={handleVoiceSelective}
              />
              <AttachButton
                label="Видео всем"
                onPress={() => handleStartCall(true, true)}
              />
              <AttachButton
                label="Видео выборочно"
                onPress={() => handleStartCall(true, false)}
              />
              <AttachButton
                label="Аудио всем"
                onPress={() => handleStartCall(false, true)}
              />
              <AttachButton
                label="Аудио выборочно"
                onPress={() => handleStartCall(false, false)}
              />
            </View>
            <TouchableOpacity
              style={styles.closeAttachButton}
              onPress={closeAttachments}>
              <Text style={styles.closeAttachText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Нижняя строка ввода */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.modeButton} onPress={toggleRecipientsMode}>
          <Text style={styles.modeText}>{recipientsLabel}</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Сообщение..."
          placeholderTextColor={t.colors.placeholder}
        />

        <TouchableOpacity style={styles.attachButton} onPress={openAttachments}>
          <Text style={styles.attachIcon}>＋</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

interface AttachButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const AttachButton: React.FC<AttachButtonProps> = ({label, onPress, disabled}) => {
  const t = useTheme();
  const s = useMemo(() => makeAttachButtonStyles(t), [t]);
  return (
    <TouchableOpacity
      style={[s.attachItem, disabled ? {opacity: 0.5} : null]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={s.attachCircle}>
        <Text style={s.attachCircleText}>◎</Text>
      </View>
      <Text style={s.attachItemLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
    retryInline: {
      marginLeft: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.bgElevated,
    },
    retryInlineText: {
      ...t.typography.tiny,
      color: t.text,
      fontWeight: '700',
    },

  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  backIcon: {
    fontSize: 20,
    color: t.colors.text,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    marginRight: 10,
  },
  retryIcon: {
    fontSize: 16,
    color: t.colors.primary,
  },
  retryBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  retryBadgeText: {
    fontSize: 11,
    color: t.colors.text,
    fontWeight: '700',
  },

  menuIcon: {
    fontSize: 20,
    color: t.colors.text,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuCard: {
    marginTop: 40,
    marginRight: 12,
    backgroundColor: t.colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 180,
  },
  menuTitle: {
    fontSize: 13,
    color: t.colors.textMuted,
    marginBottom: 6,
  },
  menuItem: {
    paddingVertical: 6,
  },
  menuItemText: {
    fontSize: 14,
    color: t.colors.text,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 4,
  },
  bubbleOutgoing: {
    alignSelf: 'flex-end',
    backgroundColor: t.colors.primary,
  },
  bubbleIncoming: {
    alignSelf: 'flex-start',
    backgroundColor: t.colors.card,
  },
  sender: {
    fontSize: 11,
    color: t.colors.text,
  },
  body: {
    fontSize: 14,
    color: t.colors.text,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  metaTime: {
    fontSize: 11,
    color: t.colors.textMuted,
    marginRight: 6,
  },
  deliveryStatusRead: {
    color: t.colors.primary,
  },
  deliveryStatusRetry: {
    opacity: 0.85,
  },
  deliveryStatus: {
    fontSize: 11,
    color: t.colors.textMuted,
    marginTop: 2,
    textAlign: 'right',
  },
  imageThumb: {
    marginTop: 4,
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: t.colors.bgElevated,
  },
  fileRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fileName: {
    fontSize: 14,
    color: t.colors.text,
    marginRight: 10,
  },
  fileOpenBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.card,
  },
  fileOpenText: {
    fontSize: 12,
    color: t.colors.primary,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  modeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: t.colors.card,
    marginRight: 6,
  },
  modeText: {
    fontSize: 11,
    color: t.colors.text,
  },
  input: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: t.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: t.colors.text,
    marginRight: 6,
  },
  attachButton: {
    padding: 6,
    marginRight: 4,
  },
  attachIcon: {
    fontSize: 20,
    color: t.colors.text,
  },
  sendButton: {
    padding: 6,
  },
  sendIcon: {
    fontSize: 20,
    color: t.colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  attachPanel: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: t.colors.border,
  },
  attachTitle: {
    fontSize: 16,
    color: t.colors.text,
    fontWeight: '600',
    marginBottom: 12,
  },
  attachGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  attachItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 12,
  },
  attachCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  attachCircleText: {
    fontSize: 18,
    color: t.colors.text,
  },
  attachItemLabel: {
    fontSize: 11,
    color: t.colors.text,
    textAlign: 'center',
  },
  closeAttachButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.colors.textMuted,
  },
  closeAttachText: {
    fontSize: 13,
    color: t.colors.textMuted,
  },
  recipientsPanel: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: t.colors.border,
  },
  recipientsList: {
    maxHeight: 260,
    marginBottom: 12,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  recipientCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  recipientCheckActive: {
    backgroundColor: t.colors.primary,
  },
  recipientCheckMark: {
    fontSize: 14,
    color: t.colors.text,
  },
  recipientName: {
    fontSize: 14,
    color: t.colors.text,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  audioButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  audioButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: t.colors.text,
  },
  audioLabel: {
    fontSize: 13,
    color: t.colors.text,
  },
});
