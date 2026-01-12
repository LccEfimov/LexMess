
import React, {useState, useMemo, useEffect, useCallback, useRef} from 'react';
import {Alert, BackHandler, Text, Image, View, useColorScheme} from 'react-native';
import {NavigationContainer, NavigationContainerRef} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {SafeAreaProvider} from 'react-native-safe-area-context';

import {ThemeProvider} from './theme/ThemeContext';
import {SecurityProvider} from './security/SecurityContext';
import {getTheme, normalizeThemeMode, resolveThemeName} from './theme/themes';
import type {ThemeMode} from './theme/themes';
import {makeNavigationTheme} from './theme/navigationTheme';

import {PreloaderScreen} from './screens/PreloaderScreen';
import {AuthStartScreen} from './screens/AuthStartScreen';
import {LoginScreen} from './screens/LoginScreen';
import {RegisterScreen} from './screens/RegisterScreen';
import {RecoveryKeyScreen} from './screens/RecoveryKeyScreen';
import {RecoveryResetScreen} from './screens/RecoveryResetScreen';
import {NewDirectChatScreen} from './screens/NewDirectChatScreen';
import {PermissionsScreen} from './screens/PermissionsScreen';
import {RoomsScreen, RoomItem} from './screens/RoomsScreen';
import {getMessagesForRoom, type MessageRecord} from './storage/sqliteStorage';
import {RoomsListScreen} from './screens/RoomsListScreen';
import {CreateRoomScreen} from './screens/CreateRoomScreen';
import {JoinByCodeScreen} from './screens/JoinByCodeScreen';
import {RoomInviteScreen} from './screens/RoomInviteScreen';
import {ChatScreen} from './screens/ChatScreen';
import {RoomMembersScreen} from './screens/RoomMembersScreen';
import {RoomDetailsScreen} from './screens/RoomDetailsScreen';
import {CallScreen} from './screens/CallScreen';
import {IncomingCallScreen} from './screens/IncomingCallScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {DiagnosticsScreen} from './screens/DiagnosticsScreen';
import {WalletScreen} from './screens/WalletScreen';
import {ProfileScreen} from './screens/ProfileScreen';

import {subscribeRtc, IncomingRtcSignal} from './bus/rtcBus';

import {useLexmessApi} from './hooks/useLexmessApi';
import {useCryptoEngine} from './hooks/useCryptoEngine';
import {useStegoEngine} from './hooks/useStegoEngine';
import {useChatRoom} from './hooks/useChatRoom';
import {useWebRtcP2P} from './hooks/useWebRtcP2P';
import {usePushNotifications} from './hooks/usePushNotifications';
import {getAccessToken, clearAccessToken} from './storage/authTokenStorage';
import {loadLocalAccount} from './storage/localAccountStorage';
import {loadPendingRecovery, clearPendingRecovery, type PendingRecovery} from './storage/pendingRecoveryStorage';
import {getPermissionsGateShown, setPermissionsGateShown} from './storage/permissionsGateStorage';
import {checkRequiredRuntimePermissions} from './permissions/androidPermissions';
import {
  ensureSchema,
  loadAppSettings,
  saveAppSettings,
  loadLastReadByRoom,
  updateRoomLastRead,
  loadPinnedRooms,
  setRoomPinned,
  getUnreadCountForRoom,
} from './storage/sqliteStorage';
import {loadThemePreference, saveThemePreference} from './storage/themePreferenceStorage';
import {i18n} from './i18n';
import {logger} from './utils/logger';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RoomsStack = createNativeStackNavigator();
const ChatsStack = createNativeStackNavigator();
const WalletStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();


class ErrorBoundary extends React.Component<{children: React.ReactNode; title: string; message: string}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError() {
    return {hasError: true};
  }

  componentDidCatch(error: any) {
    logger.warn('UI crash:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20}}>
          <Text style={{fontSize: 16, fontWeight: '700', marginBottom: 10}}>{this.props.title}</Text>
          <Text style={{fontSize: 13, opacity: 0.8, textAlign: 'center'}}>
            {this.props.message}
          </Text>
        </View>
      );
    }
    return this.props.children as any;
  }
}

export const App: React.FC = () => {
  const navigationRef = useRef<NavigationContainerRef<any> | null>(null);
  const sqliteInitAlertedRef = useRef(false);

  // Берём только стабильные функции из useLexmessApi(), чтобы эффекты не перезапускались бесконечно.
const {getProfile, listRooms, getMe, registerPushToken, joinRoom, leaveRoom, ensureDirectRoom, authChangePassword, authLogoutAll, authRecoveryRotate, walletMe} = useLexmessApi();

  const pushApi = useMemo(() => ({registerPushToken}), [registerPushToken]);

  const [preloaded, setPreloaded] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [recoveryGate, setRecoveryGate] = useState<PendingRecovery | null>(null);
  const [permissionsGate, setPermissionsGate] = useState(false);
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [nickname, setNickname] = useState<string>('');
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [language, setLanguage] = useState<string>('ru');
  const [mute, setMute] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileAbout, setProfileAbout] = useState<string | null>(null);
  const [roomBusyById, setRoomBusyById] = useState<Record<string, boolean>>({});

  const systemScheme = useColorScheme();
  i18n.setLocale(language);
  const resolvedThemeName = useMemo(
    () => resolveThemeName(theme, systemScheme),
    [theme, systemScheme],
  );
  const themeObj = useMemo(() => getTheme(resolvedThemeName), [resolvedThemeName]);
  const navTheme = useMemo(() => makeNavigationTheme(themeObj), [themeObj]);

  const myUserId = useMemo(
    () => (nickname && nickname.trim()) || 'me',
    [nickname],
  );
  const myName = useMemo(
    () =>
      (profileDisplayName && profileDisplayName.trim()) ||
      (nickname && nickname.trim()) ||
      i18n.t('app.participant.me'),
    [profileDisplayName, nickname],
  );


  
// Инициализация SQLite + настройки + локальный аккаунт
  useEffect(() => {
    (async () => {
      try {
        await ensureSchema();

        // 1) Быстрая UI-настройка (например выбранная тема на экране регистрации)
        const prefTheme = await loadThemePreference();
        const stored = await loadAppSettings();
        if (prefTheme) {
          setTheme(prefTheme);
        } else if (stored?.theme) {
          setTheme(normalizeThemeMode(stored.theme));
        }
        if (stored) {
          setLanguage(stored.lang);
        }

        const local = await loadLocalAccount();
        if (local && local.login) {
          setNickname(local.login);
          setProfileDisplayName(local.displayName || null);
        }

        // Загружаем последнюю прочитанную метку для комнат
        const lastReadMap = await loadLastReadByRoom();
        setLastReadByRoom(lastReadMap);

        const pinsMap = await loadPinnedRooms();
        setPinnedByRoom(pinsMap);
      } catch (e) {
        logger.warn('SQLite initialization failed', e);
        if (!sqliteInitAlertedRef.current) {
          sqliteInitAlertedRef.current = true;
          Alert.alert('Ошибка', 'Не удалось инициализировать локальное хранилище.');
        }
      }
    })();
  }, []);


  // Загрузка анкеты (профиля) текущего пользователя для отображения в комнатах/чатах
  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const userId = (nickname && nickname.trim()) || '';
      if (!userId) {
        setProfileDisplayName(null);
        setProfileAbout(null);
        return;
      }
      try {
        const profile = await getProfile(userId);
        if (!profile || cancelled) {
          return;
        }
        setProfileDisplayName(profile.display_name || null);
        setProfileAbout(profile.about || null);
      } catch (e) {
        logger.warn('loadProfile (App) failed', e);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [getProfile, nickname]);

  // Простая roomConfig-заглушка, дальше будет подменяться по реальному чату
  const roomConfig = useMemo(
    () => ({
      roomId: 'demo-room',
      containerType: 'PNG_2D',
      templateId: 0,
      slotId: 0,
      payloadFormat: 'PNG',
    }),
    [],
  );

  const stego = useStegoEngine(roomConfig);
  const cryptoEngine = useCryptoEngine(roomConfig);
  // Регистрация push-токена устройства на сервере и обработка пушей
  usePushNotifications(isAuthed ? myUserId : null, pushApi, {
    onNavigateToRoom: roomId => {
      const nav = navigationRef.current;
      if (!nav || !roomId) {
        return;
      }
      try {
        nav.navigate(
          'MainTabs' as never,
          {
            screen: 'Rooms',
            params: {screen: 'Chat', params: {roomId}},
          } as never,
        );
      } catch (e) {
        logger.warn('[push] navigation to room failed', e);
      }
    },
    onNavigateToWallet: () => {
      const nav = navigationRef.current;
      if (!nav) {
        return;
      }
      try {
        nav.navigate('MainTabs' as never, {screen: 'Wallet'} as never);
      } catch (e) {
        logger.warn('[push] navigation to wallet failed', e);
      }
    },
  });

  const summarizeMessage = useCallback((msg: MessageRecord): string => {
    const body = (msg.body || '').trim();
    if (msg.contentType === 'system') {
      return body || i18n.t('app.messages.event');
    }
    if (msg.contentType === 'text') {
      return body || i18n.t('app.messages.text');
    }
    if (msg.contentType === 'image') {
      return body || i18n.t('app.messages.image');
    }
    if (msg.contentType === 'video') {
      return body || i18n.t('app.messages.video');
    }
    if (msg.contentType === 'audio') {
      return body || i18n.t('app.messages.audio');
    }
    if (msg.contentType === 'voice') {
      return body || i18n.t('app.messages.voice');
    }
    return body || i18n.t('app.messages.file');
  }, []);

  const [publicRooms, setPublicRooms] = useState<RoomItem[]>([]);
  const [myRooms, setMyRooms] = useState<RoomItem[]>([]);
  const [openRooms, setOpenRooms] = useState<RoomItem[]>([]);

  const chatRooms = useMemo(() => {
    const m = new Map<string, RoomItem>();
    for (const r of [...myRooms, ...openRooms]) {
      if (r && r.id) {
        m.set(r.id, r);
      }
    }
    return Array.from(m.values());
  }, [myRooms, openRooms]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const roomsLoadLock = useRef(false);
  const lastRoomsLoadAt = useRef(0);

  const [lastReadByRoom, setLastReadByRoom] = useState<Record<string, number>>({});
  const [pinnedByRoom, setPinnedByRoom] = useState<Record<string, number>>({});

  // Failsafe: если по какой-то причине прелоадер не сможет вызвать onDone
  // (редкий баг с видеовью/таймерами/крашем при смене экрана), то не держим
  // пользователя на нём бесконечно.
  useEffect(() => {
    if (preloaded) return;
    const t = setTimeout(() => {
      setPreloaded(true);
    }, 9000);
    return () => clearTimeout(t);
  }, [preloaded]);


// Auth check: token + /me (если сеть упала — считаем залогиненным, чтобы работали локальные функции)
useEffect(() => {
  if (!preloaded || authChecked) {
    return;
  }

  let cancelled = false;

  (async () => {
    try {
      const token = await getAccessToken();
      const local = await loadLocalAccount();
      const pending = await loadPendingRecovery();

      // Если есть неподтверждённый recovery-key — показываем его прежде любых экранов.
      // Это важно при перезапуске приложения после регистрации.
      if (pending && local && local.login && !local.recoveryShown) {
        if (!cancelled) {
          setRecoveryGate(pending);
          setIsAuthed(false);
        }
        return;
      }

      // Если recovery уже отмечен — не держим лишние данные в AsyncStorage.
      if (pending && (!local || local.recoveryShown)) {
        try {
          await clearPendingRecovery();
        } catch (e) {
          // ignore
        }
      }

      if (local && local.login) {
        // на всякий случай подтянем логин из local_account
        setNickname(local.login);
        if (local.displayName) {
          setProfileDisplayName(local.displayName);
        }
      }

      if (token && local && local.login) {
        try {
          await getMe({timeoutMs: 2500});
          if (!cancelled) {
            setIsAuthed(true);
          }
        } catch (e: any) {
          const msg = (e && e.message) || '';
          if (msg === 'UNAUTHORIZED') {
            if (!cancelled) {
              setIsAuthed(false);
            }
          } else {
            // сеть/сервер недоступны — работаем в "полу-оффлайн" режиме
            if (!cancelled) {
              setIsAuthed(true);
            }
          }
        }
      } else {
        if (!cancelled) {
          setIsAuthed(false);
        }
      }
    } finally {
      if (!cancelled) {
        setAuthChecked(true);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [preloaded, authChecked, getMe]);

// R8: gate на Android-разрешения (показываем 1 раз, можно пропустить)
useEffect(() => {
  if (!preloaded) {
    return;
  }
  if (!isAuthed) {
    // Сбрасываем, чтобы после логина проверка была заново
    setPermissionsGate(false);
    setPermissionsChecked(false);
    return;
  }
  if (recoveryGate) {
    return;
  }
  if (permissionsChecked) {
    return;
  }

  let cancelled = false;

  (async () => {
    try {
      const shown = await getPermissionsGateShown();
      if (shown) {
        if (!cancelled) {
          setPermissionsGate(false);
          setPermissionsChecked(true);
        }
        return;
      }

      const check = await checkRequiredRuntimePermissions();
      if (cancelled) {
        return;
      }

      if (check.ok) {
        setPermissionsGate(false);
        setPermissionsChecked(true);
        await setPermissionsGateShown(true);
      } else {
        setPermissionsGate(true);
        setPermissionsChecked(true);
      }
    } catch (e) {
      if (!cancelled) {
        setPermissionsGate(false);
        setPermissionsChecked(true);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [preloaded, isAuthed, recoveryGate, permissionsChecked]);

  const participants = [
    {id: myUserId, name: myName},
    {id: 'peer-1', name: i18n.t('app.participant.peer1')},
    {id: 'peer-2', name: i18n.t('app.participant.peer2')},
  ];
  
const markRoomRead = useCallback(async (roomId: string) => {
  const rid = (roomId || '').trim();
  if (!rid) {
    return;
  }

  let lastTs = Date.now();
  try {
    const rows = await getMessagesForRoom(rid, 1);
    if (rows && rows.length > 0) {
      const ts = Number((rows[0] as any).ts || 0);
      if (Number.isFinite(ts) && ts > 0) {
        lastTs = ts;
      }
    }
  } catch (e) {
    // ignore
  }

  setLastReadByRoom(prev => {
    const prevTs = Number(prev[rid] || 0);
    const nextTs = Math.max(prevTs, lastTs);
    if (nextTs === prevTs) {
      return prev;
    }
    // сохраняем в SQLite
    updateRoomLastRead(rid, nextTs).catch(err => {
      logger.warn('updateRoomLastRead failed', err);
    });
    return {
      ...prev,
      [rid]: nextTs,
    };
  });

  setPublicRooms(prev => prev.map(r => (r.id === rid ? {...r, unreadCount: 0} : r)));
  setMyRooms(prev => prev.map(r => (r.id === rid ? {...r, unreadCount: 0} : r)));
  setOpenRooms(prev => prev.map(r => (r.id === rid ? {...r, unreadCount: 0} : r)));
}, []);

const toggleRoomPin = useCallback(async (roomId: string) => {
  const rid = (roomId || '').trim();
  if (!rid) {
    return;
  }

  let nowPinned = false;
  setPinnedByRoom(prev => {
    const next = {...prev};
    if (next[rid]) {
      delete next[rid];
      nowPinned = false;
    } else {
      next[rid] = Date.now();
      nowPinned = true;
    }
    return next;
  });

  try {
    await setRoomPinned(rid, nowPinned);
  } catch (e) {
    logger.warn('setRoomPinned failed', e);
  }
}, []);



    const loadRooms = useCallback(async () => {
    if (roomsLoadLock.current) {
      return;
    }
    const now = Date.now();
    if (now - lastRoomsLoadAt.current < 700) {
      return;
    }
    roomsLoadLock.current = true;
    lastRoomsLoadAt.current = now;
    try {
      setRoomsLoading(true);
      const token = await getAccessToken();
      let list: any[] | null = [];

      if (!token) {
        setPublicRooms([]);
        setMyRooms([]);
        setOpenRooms([]);
        return;
      }

      if (token) {
        try {
          const serverList = await listRooms();
          if (Array.isArray(serverList)) {
            list = serverList;
          } else if (serverList && Array.isArray((serverList as any).rooms)) {
            list = (serverList as any).rooms;
          } else if (serverList && Array.isArray((serverList as any).items)) {
            list = (serverList as any).items;
          } else {
            list = [];
          }
        } catch (e) {
          list = null;
        }
      }

      const safeList: any[] = Array.isArray(list) ? list : [];

      const baseItems: RoomItem[] = safeList.map((room: any) => {
        const roomId = room.room_id || room.roomId || '';
        const title = room.title || roomId || i18n.t('app.room.fallbackTitle');
        const members: string[] = Array.isArray(room.members)
          ? room.members
          : [];
        const ownerId: string = room.owner_id || room.ownerId || '';
        const isOwner = ownerId === myUserId;
        const isMember = members.includes(myUserId);
        let type: 'public' | 'my' | 'open';
        if (isOwner) {
          type = 'my';
        } else if (isMember) {
          type = 'open';
        } else {
          type = 'public';
        }
        const onlineCount: number =
          typeof room.online_count === 'number'
            ? room.online_count
            : typeof room.onlineCount === 'number'
            ? room.onlineCount
            : 0;
        const isPrivate: boolean =
          typeof room.is_private === 'boolean'
            ? room.is_private
            : typeof room.isPrivate === 'boolean'
            ? room.isPrivate
            : !!(room.is_private || room.isPrivate);
        const isPersistent: boolean =
          typeof room.is_persistent === 'boolean'
            ? room.is_persistent
            : typeof room.isPersistent === 'boolean'
            ? room.isPersistent
            : true;

        const roles = room.roles && typeof room.roles === 'object' ? room.roles : null;
        const myRole = roles && roles[myUserId] ? roles[myUserId] : (isOwner ? 'owner' : isMember ? 'member' : undefined);

        return {
          id: roomId,
          title,
          type,
          members: members.length,
          online: onlineCount,
          isPrivate,
          isPersistent,
          role: myRole,
        };
      });

      const itemsWithLast: RoomItem[] = await Promise.all(
        baseItems.map(async item => {
          try {
            const messages = await getMessagesForRoom(item.id, 1);
            if (messages.length > 0) {
              const m: MessageRecord = messages[0];
              const basePreview = summarizeMessage(m);
              const lastMessage = m.outgoing
                ? i18n.t('app.messages.youPrefix', {message: basePreview})
                : basePreview;
              const lastMessageTs = m.ts || 0;
              const lastReadTs = lastReadByRoom[item.id] || 0;
              let unreadCount = 0;
              try {
                unreadCount = await getUnreadCountForRoom(item.id, lastReadTs);
              } catch (e) {
                unreadCount = 0;
              }
              return {
                ...item,
                lastMessage,
                lastMessageTs,
                unreadCount,
              };
            }
          } catch (e) {
            logger.warn('loadRooms: failed to read last message for room', item.id, e);
          }
          return {
            ...item,
            lastMessage: null,
            lastMessageTs: null,
            unreadCount: 0,
          };
        }),
      );

      const sortRooms = (items: RoomItem[]) =>
        [...items].sort((a, b) => {
          const ta = a.lastMessageTs || 0;
          const tb = b.lastMessageTs || 0;
          if (tb !== ta) {
            return tb - ta;
          }
          return (a.title || '').localeCompare(b.title || '');
        });

      setPublicRooms(sortRooms(itemsWithLast.filter(r => r.type === 'public')));
      setMyRooms(sortRooms(itemsWithLast.filter(r => r.type === 'my')));
      setOpenRooms(sortRooms(itemsWithLast.filter(r => r.type === 'open')));
    } catch (e) {
      logger.warn('loadRooms failed', e);
    } finally {
      roomsLoadLock.current = false;
      setRoomsLoading(false);
    }
  }, [listRooms, myUserId, lastReadByRoom, summarizeMessage]);

const setRoomBusy = useCallback((roomId: string, value: boolean) => {
  setRoomBusyById(prev => ({...prev, [roomId]: value}));
}, []);

const handleJoinRoom = useCallback(
  async (roomId: string) => {
    try {
      setRoomBusy(roomId, true);
      await joinRoom({roomId, userId: myUserId});
      await loadRooms();
    } finally {
      setRoomBusy(roomId, false);
    }
  },
  [joinRoom, loadRooms, myUserId, setRoomBusy],
);

const handleLeaveRoom = useCallback(
  async (roomId: string) => {
    try {
      setRoomBusy(roomId, true);
      await leaveRoom({roomId});
      await loadRooms();
    } finally {
      setRoomBusy(roomId, false);
    }
  },
  [leaveRoom, loadRooms, setRoomBusy],
);



  // Rooms are refreshed on-demand (Rooms tab focus / pull-to-refresh) to avoid UI "jumping".

  // Глобальный обработчик входящих WebRTC offer — навигируем на экран входящего звонка
  useEffect(() => {
    const unsubscribe = subscribeRtc((signal: IncomingRtcSignal) => {
      if (signal.signalType !== 'offer') {
        return;
      }

      // Если есть явный адресат — реагируем только на свои вызовы
      if (signal.to && signal.to !== myUserId) {
        return;
      }

      // Игнорируем собственные исходящие offer
      if (signal.from === myUserId) {
        return;
      }

      const nav = navigationRef.current;
      if (!nav) {
        return;
      }

      const isVideo =
        (signal.payload && typeof signal.payload.isVideo === 'boolean'
          ? signal.payload.isVideo
          : true) ?? true;

      const roomId = signal.roomId;
      const callerId = signal.from;
      const callId = signal.payload && signal.payload.callId;

      try {
        nav.navigate('IncomingCall' as never, {
          roomId,
          callerId,
          callerName: callerId,
          isVideo,
          callId,
          myUserId,
        } as never);
      } catch (e) {
        logger.warn('navigate to IncomingCall failed', e);
      }
    });

    return unsubscribe;
  }, [myUserId]);

  const handleAuthed = useCallback((login: string) => {
    const l = (login || '').trim();
    if (l) {
      setNickname(l);
    }
    setRecoveryGate(null);
    setIsAuthed(true);
    setAuthChecked(true);

    // Фиксируем базовые настройки сразу после авторизации,
    // чтобы тема/язык сохранялись даже без захода в Settings.
    try {
      (async () => {
        try {
          await saveAppSettings({
            nickname: l || nickname || 'me',
            theme: normalizeThemeMode(theme),
            lang: String(language || 'ru'),
            lockMethod: 'none',
            chatsMode: 'persistent',
          });
        } catch {}
        try {
          await saveThemePreference(normalizeThemeMode(theme));
        } catch {}
      })();
    } catch {
      // ignore
    }

    // Сброс навигации на главный экран
    try {
      setTimeout(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{name: 'MainTabs' as never}],
        });
      }, 0);
    } catch (e) {
      // ignore
    }
  }, [language, nickname, theme]);

  const handleLogout = useCallback(async () => {
    try {
      await clearAccessToken();
    } catch (e) {
      // ignore
    }
    setRecoveryGate(null);
    setIsAuthed(false);
    setAuthChecked(true);

    try {
      setTimeout(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{name: 'AuthStart' as never}],
        });
      }, 50);
    } catch (e) {
      // ignore
    }
  }, []);


  const handlePermissionsDone = useCallback(() => {
    setPermissionsGate(false);
    setPermissionsChecked(true);
    setPermissionsGateShown(true).catch(() => {});

    // Сброс навигации на главный экран (чтобы Back не возвращал на gate)
    try {
      setTimeout(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{name: 'MainTabs' as never}],
        });
      }, 0);
    } catch (e) {
      // ignore
    }
  }, []);

  const exitApp = () => {
    BackHandler.exitApp();
  };

  // Tabs (R23): Чаты/Комнаты/Кошелёк/Профиль
  const MainTabs: React.FC = () => {
    const iconFor = (routeName: string) => {
      switch (routeName) {
        case 'Chats':
          return require('./assets/icons/tab_chats.png');
        case 'Rooms':
          return require('./assets/icons/tab_rooms.png');
        case 'Wallet':
          return require('./assets/icons/tab_wallet.png');
        case 'Profile':
          return require('./assets/icons/tab_profile.png');
        default:
          return require('./assets/icons/tab_chats.png');
      }
    };

    return (
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: themeObj.colors.tabBg,
            borderTopColor: themeObj.colors.tabBorder,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {fontSize: 11, fontWeight: '700', marginBottom: 3},
          tabBarActiveTintColor: themeObj.colors.primary,
          tabBarInactiveTintColor: themeObj.colors.textMuted,
          tabBarIcon: ({focused}) => (
            <Image
              source={iconFor(route.name)}
              style={{
                width: 22,
                height: 22,
                tintColor: focused ? themeObj.colors.primary : themeObj.colors.textMuted,
                opacity: focused ? 1 : 0.85,
              }}
              resizeMode="contain"
            />
          ),
        })}>
        <Tab.Screen
          name="Chats"
          options={{tabBarLabel: i18n.t('tabs.chats')}}
          children={() => (
            <ChatsStack.Navigator screenOptions={{headerShown: false}} initialRouteName="ChatsHome">
              <ChatsStack.Screen name="ChatsHome">
                {({navigation}) => (
                  <RoomsListScreen
                    title={i18n.t('roomsList.title.chats')}
                    listKind="chats"
                    rooms={chatRooms}
                    pinnedByRoom={pinnedByRoom}
                    onTogglePin={(rid: string) => {
                      toggleRoomPin(rid).catch(e => logger.warn('toggleRoomPin error', e));
                    }}
                    onBack={null}
                    onOpenRoom={(roomId: string, roomTitle?: string) => {
                      markRoomRead(roomId).catch(e => logger.warn('markRoomRead error', e));
                      navigation.navigate('Chat', {roomId, roomTitle: roomTitle || roomId});
                    }}
                    onOpenMain={() => navigation.navigate('Rooms')}
                    onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                    refreshing={roomsLoading}
                    onRefresh={() => {
                      loadRooms().catch(e => logger.warn('loadRooms error', e));
                    }}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                  />
                )}
              </ChatsStack.Screen>

                            <ChatsStack.Screen name="NewDirectChat">
                {({navigation}) => (
                  <NewDirectChatScreen
                    onBack={() => navigation.goBack()}
                    onCreate={async (peerUserId: string) => {
                      const res: any = await ensureDirectRoom({peerUserId});
                      const roomId: string = (res && (res.room_id || res.roomId || res.id)) ? String(res.room_id || res.roomId || res.id) : '';
                      if (!roomId) {
                        throw new Error(i18n.t('app.errors.noRoomId'));
                      }
                      await loadRooms();
                      navigation.replace('Chat', {roomId, roomTitle: roomId});
                    }}
                  />
                )}
              </ChatsStack.Screen>

<ChatsStack.Screen name="Chat">
                {({route, navigation}) => {
                  const {roomId, roomTitle} = route.params as {roomId: string; roomTitle?: string};

                  const {
                    messages,
                    sendText,
                    sendMedia,
                    retryPending,
                    loadOlder,
                    loadingOlder,
                    hasOlder,
                    pendingCount,
                    lastError,
                    clearLastError,
                  } = useChatRoom(
                    roomId,
                    nickname || 'me',
                    cryptoEngine,
                    stego,
                  );

                  useEffect(() => {
                    if (!lastError) return;
                    Alert.alert(lastError.title, lastError.message);
                    clearLastError();
                  }, [lastError, clearLastError]);

                  return (
                    <ChatScreen
                      roomTitle={roomTitle || roomId}
                      messages={messages}
                      participants={participants}
                      pendingCount={pendingCount}
                      onRetryPending={async () => {
                        try {
                          await retryPending();
                        } catch (e) {
                          logger.warn('retryPending error', e);
                        }
                      }}
                      onLoadOlder={async () => {
                        try {
                          await loadOlder();
                        } catch (e) {
                          logger.warn('loadOlder error', e);
                        }
                      }}
                      loadingOlder={loadingOlder}
                      hasOlderMessages={hasOlder}
                      onBack={() => navigation.goBack()}
                      onOpenAttachments={() => {}}
                      onOpenMain={() => navigation.navigate('Rooms')}
                      onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                      onOpenParticipants={() => {
                        navigation.navigate('RoomMembers', {roomId, roomTitle: roomTitle || roomId, myUserId: nickname || 'me'});
                      }}
                      onOpenRoomDetails={() => {
                        navigation.navigate('RoomDetails', {roomId, roomTitle: roomTitle || roomId, myUserId: nickname || 'me'});
                      }}
                      onSendMedia={async (kind, fileInfo) => {
                        try {
                          await sendMedia(kind, fileInfo);
                        } catch (e) {
                          logger.warn('sendMedia error', e);
                        }
                      }}
                      onSendText={async (text, toAll) => {
                        try {
                          await sendText(text, toAll);
                        } catch (e) {
                          logger.warn('sendText error', e);
                        }
                      }}
                      onStartCall={({isVideo, toAll}) => {
                        const calleeName = toAll
                          ? i18n.t('app.call.group')
                          : i18n.t('app.call.selective');
                        const targetUserId = !toAll
                          ? participants.find(p => p.id && p.id !== myUserId)?.id
                          : undefined;
                        navigation.navigate('Call', {calleeName, isVideo, roomId, isCaller: true, targetUserId});
                      }}
                    />
                  );
                }}
              </ChatsStack.Screen>

              <ChatsStack.Screen name="RoomMembers">
                {({navigation, route}) => (
                  <RoomMembersScreen navigation={navigation} route={route as any} />
                )}
              </ChatsStack.Screen>
            </ChatsStack.Navigator>
          )}
        />

        <Tab.Screen
          name="Rooms"
          options={{tabBarLabel: i18n.t('tabs.rooms')}}
          children={() => (
            <RoomsStack.Navigator screenOptions={{headerShown: false}} initialRouteName="Rooms">
              <RoomsStack.Screen
                name="Rooms"
                listeners={{
                  focus: () => {
                    loadRooms().catch(e => logger.warn('loadRooms error', e));
                  },
                }}>
                {({navigation}) => (
                  <RoomsScreen
                    publicRooms={publicRooms}
                    myRooms={myRooms}
                    openRooms={openRooms}
                    onOpenRoom={(roomId: string, roomTitle?: string) => {
                  markRoomRead(roomId).catch(e => logger.warn('markRoomRead error', e));
                  navigation.navigate('Chat', {roomId, roomTitle: roomTitle || roomId});
                }}
                    onShowMorePublic={() => navigation.navigate('PublicRoomsList')}
                    onShowMoreMy={() => navigation.navigate('MyRoomsList')}
                    onShowMoreOpen={() => navigation.navigate('OpenRoomsList')}
                    onSettings={() => navigation.navigate('Settings')}
                    onCreateRoom={() => navigation.navigate('CreateRoom', {ownerId: nickname || 'me'})}
                    onJoinByCode={() => navigation.navigate('JoinByCode', {userId: nickname || 'me'})}
                    refreshing={roomsLoading}
                    onRefresh={() => {
                      loadRooms().catch(e => logger.warn('loadRooms error', e));
                    }}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                    mute={mute}
                    onToggleMute={() => setMute(prev => !prev)}
                    onExitApp={exitApp}
                  />
                )}
              </RoomsStack.Screen>

              <RoomsStack.Screen name="PublicRoomsList">
                {({navigation}) => (
                  <RoomsListScreen
                    title={i18n.t('roomsList.title.public')}
                    rooms={publicRooms}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                    onBack={() => navigation.goBack()}

                    onOpenRoom={(roomId: string, roomTitle?: string) => {
                  markRoomRead(roomId).catch(e => logger.warn('markRoomRead error', e));
                  navigation.navigate('Chat', {roomId, roomTitle: roomTitle || roomId});
                }}
                    onOpenMain={() => navigation.navigate('Rooms')}
                    onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                    refreshing={roomsLoading}
                    onRefresh={() => {
                      loadRooms().catch(e => logger.warn('loadRooms error', e));
                    }}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                  />
                )}
              </RoomsStack.Screen>

              <RoomsStack.Screen name="MyRoomsList">
                {({navigation}) => (
                  <RoomsListScreen
                    title={i18n.t('roomsList.title.my')}
                    rooms={myRooms}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                    onBack={() => navigation.goBack()}
                    onOpenRoom={(roomId: string, roomTitle?: string) => {
                  markRoomRead(roomId).catch(e => logger.warn('markRoomRead error', e));
                  navigation.navigate('Chat', {roomId, roomTitle: roomTitle || roomId});
                }}
                    onOpenMain={() => navigation.navigate('Rooms')}
                    onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                    refreshing={roomsLoading}
                    onRefresh={() => {
                      loadRooms().catch(e => logger.warn('loadRooms error', e));
                    }}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                  />
                )}
              </RoomsStack.Screen>

              <RoomsStack.Screen name="OpenRoomsList">
                {({navigation}) => (
                  <RoomsListScreen
                    title={i18n.t('roomsList.title.open')}
                    rooms={openRooms}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                    onBack={() => navigation.goBack()}
                    onOpenRoom={(roomId: string, roomTitle?: string) => {
                  markRoomRead(roomId).catch(e => logger.warn('markRoomRead error', e));
                  navigation.navigate('Chat', {roomId, roomTitle: roomTitle || roomId});
                }}
                    onOpenMain={() => navigation.navigate('Rooms')}
                    onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                    refreshing={roomsLoading}
                    onRefresh={() => {
                      loadRooms().catch(e => logger.warn('loadRooms error', e));
                    }}
                    onJoinRoom={handleJoinRoom}
                    onLeaveRoom={handleLeaveRoom}
                    busyByRoom={roomBusyById}
                  />
                )}
              </RoomsStack.Screen>

              <RoomsStack.Screen name="CreateRoom">
                {({navigation, route}) => (
                  <CreateRoomScreen navigation={navigation} route={route as any} />
                )}
              </RoomsStack.Screen>

              <RoomsStack.Screen name="JoinByCode">
                {({navigation, route}) => (
                  <JoinByCodeScreen navigation={navigation} route={route as any} />
                )}
              </RoomsStack.Screen>

                            <RoomsStack.Screen name="RoomDetails">
                {({navigation, route}) => (
                  <RoomDetailsScreen navigation={navigation} route={route as any} />
                )}
              </RoomsStack.Screen>

<RoomsStack.Screen name="RoomInvite">
                {({navigation, route}) => (
                  <RoomInviteScreen navigation={navigation} route={route as any} />
                )}
              </RoomsStack.Screen>

              <RoomsStack.Screen name="RoomMembers">
                {({navigation, route}) => (
                  <RoomMembersScreen navigation={navigation} route={route as any} />
                )}
              </RoomsStack.Screen>

              <RoomsStack.Screen name="Chat">
                {({route, navigation}) => {
                  const {roomId, roomTitle} = route.params as {roomId: string; roomTitle?: string};

                  const {
                    messages,
                    sendText,
                    sendMedia,
                    retryPending,
                    loadOlder,
                    loadingOlder,
                    hasOlder,
                    pendingCount,
                    lastError,
                    clearLastError,
                  } = useChatRoom(
                    roomId,
                    nickname || 'me',
                    cryptoEngine,
                    stego,
                  );

                  useEffect(() => {
                    if (!lastError) return;
                    Alert.alert(lastError.title, lastError.message);
                    clearLastError();
                  }, [lastError, clearLastError]);

                  return (
                    <ChatScreen
                      roomTitle={roomTitle || roomId}
                      messages={messages}
                      participants={participants}
                      pendingCount={pendingCount}
                      onRetryPending={async () => {
                        try {
                          await retryPending();
                        } catch (e) {
                          logger.warn('retryPending error', e);
                        }
                      }}
                      onLoadOlder={async () => {
                        try {
                          await loadOlder();
                        } catch (e) {
                          logger.warn('loadOlder error', e);
                        }
                      }}
                      loadingOlder={loadingOlder}
                      hasOlderMessages={hasOlder}
                      onBack={() => navigation.goBack()}
                      onOpenAttachments={() => {}}
                      onOpenMain={() => navigation.navigate('Rooms')}
                      onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                      onOpenParticipants={() => {
                        navigation.navigate('RoomMembers', {roomId, roomTitle: roomTitle || roomId, myUserId: nickname || 'me'});
                      }}
                      onOpenRoomDetails={() => {
                        navigation.navigate('RoomDetails', {roomId, roomTitle: roomTitle || roomId, myUserId: nickname || 'me'});
                      }}
                      onSendMedia={async (kind, fileInfo) => {
                        try {
                          await sendMedia(kind, fileInfo);
                        } catch (e) {
                          logger.warn('sendMedia error', e);
                        }
                      }}
                      onSendText={async (text, toAll) => {
                        try {
                          await sendText(text, toAll);
                        } catch (e) {
                          logger.warn('sendText error', e);
                        }
                      }}
                      onStartCall={({isVideo, toAll}) => {
                        const calleeName = toAll
                          ? i18n.t('app.call.group')
                          : i18n.t('app.call.selective');
                        const targetUserId = !toAll
                          ? participants.find(p => p.id && p.id !== myUserId)?.id
                          : undefined;
                        navigation.navigate('Call', {calleeName, isVideo, roomId, isCaller: true, targetUserId});
                      }}
                    />
                  );
                }}
              </RoomsStack.Screen>
            </RoomsStack.Navigator>
          )}
        />

        <Tab.Screen
          name="Wallet"
          options={{tabBarLabel: i18n.t('tabs.wallet')}}
          children={() => (
            <WalletStack.Navigator screenOptions={{headerShown: false}} initialRouteName="WalletHome">
              <WalletStack.Screen name="WalletHome">
                {({navigation}) => (
                  <WalletScreen onBack={null} />
                )}
              </WalletStack.Screen>
            </WalletStack.Navigator>
          )}
        />

        <Tab.Screen
          name="Profile"
          options={{tabBarLabel: i18n.t('tabs.profile')}}
          children={() => (
            <ProfileStack.Navigator screenOptions={{headerShown: false}} initialRouteName="ProfileHome">
              <ProfileStack.Screen name="ProfileHome">
                {({navigation}) => (
                  <ProfileScreen
                    nickname={nickname || 'me'}
                    displayName={profileDisplayName}
                    about={profileAbout}
                    onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                    onOpenDiagnostics={() => navigation.navigate('Diagnostics')}
                    onLogout={handleLogout}
                  onLogoutAll={async () => {
                    const res = await authLogoutAll();
                    if (res && res.accessToken) {
                      try { const {saveAccessToken} = await import('./storage/authTokenStorage'); await saveAccessToken(res.accessToken); } catch {}
                    }
                  }}
                  onChangePassword={async ({currentPassword, newPassword}: any) => {
                    await authChangePassword({currentPassword, newPassword});
                  }}
                  onRotateRecovery={async ({currentPassword}: any) => {
                    const r = await authRecoveryRotate({currentPassword});
                    if (!r || !r.accessToken || !r.recoveryKey) {
                      throw new Error(i18n.t('app.errors.noRecoveryKey'));
                    }
                    try { const {saveAccessToken} = await import('./storage/authTokenStorage'); await saveAccessToken(r.accessToken); } catch {}
                    // получаем адрес кошелька
                    let addr = '—';
                    try {
                      const w = await walletMe();
                      if (w && w.address) addr = w.address;
                    } catch {}
                    return {recoveryKey: r.recoveryKey, walletAddress: addr};
                  }}
                  />
                )}
              </ProfileStack.Screen>
            </ProfileStack.Navigator>
          )}
        />
      </Tab.Navigator>
    );
  };

  return (
    <ErrorBoundary title={i18n.t('app.error.title')} message={i18n.t('app.error.body')}>
      <SafeAreaProvider>
      <ThemeProvider themeName={theme} setThemeName={setTheme}>
        <SecurityProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <RootStack.Navigator screenOptions={{headerShown: false}}>
        {!preloaded ? (
          <RootStack.Screen name="Preloader">
            {() => (
              <PreloaderScreen
                onDone={() => {
                  setPreloaded(true);
                }}
              />
            )}
          </RootStack.Screen>
        ) : recoveryGate ? (
          <RootStack.Screen name="RecoveryKey">
            {({navigation, route}) => (
              <RecoveryKeyScreen
                navigation={navigation}
                route={route}
                onDone={async (login: string) => {
                  setRecoveryGate(null);
                  handleAuthed(login);
                }}
                onExit={exitApp}
              />
            )}
          </RootStack.Screen>
        ) : !isAuthed ? (
          <>
            <RootStack.Screen name="AuthStart">
              {({navigation}) => (
                <AuthStartScreen
                  navigation={navigation}
                  onLogin={() => navigation.navigate('Login')}
                  onRegister={() => navigation.navigate('Register')}
                  onExit={exitApp}
                />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="Login">
              {({navigation}) => (
                <LoginScreen
                  navigation={navigation}
                  onBack={() => navigation.goBack()}
                  onAuthed={handleAuthed}
                  onRecovery={() => navigation.navigate('RecoveryReset')}
                />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="Register">
              {({navigation}) => (
                <RegisterScreen
                  navigation={navigation}
                  onBack={() => navigation.goBack()}
                  onAuthed={handleAuthed}
                />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="RecoveryReset">
              {({navigation}) => (
                <RecoveryResetScreen navigation={navigation} onBack={() => navigation.goBack()} />
              )}
            </RootStack.Screen>

            {/* Allow immediate show of recovery key right after Register (without needing app restart). */}
            <RootStack.Screen name="RecoveryKey">
              {({navigation, route}) => (
                <RecoveryKeyScreen
                  navigation={navigation}
                  route={route}
                  onDone={handleAuthed}
                  onExit={exitApp}
                />
              )}
            </RootStack.Screen>
          </>
        ) : !permissionsChecked && permissionsGate ? (
          <RootStack.Screen name="Permissions">
            {({navigation}) => (
              <PermissionsScreen
                navigation={navigation}
                onDone={async () => {
                  handlePermissionsDone();
                }}
              />
            )}
          </RootStack.Screen>
        ) : (
          <>
            <RootStack.Screen name="MainTabs">
              {() => <MainTabs />}
            </RootStack.Screen>

            <RootStack.Screen name="Settings">
              {({navigation}) => (
                <SettingsScreen
                  initialNickname={nickname}
                  initialTheme={theme}
                  initialLanguage={language}
                  onBack={() => navigation.goBack()}
                  onApply={async opts => {
                    setNickname(opts.nickname);
                    setTheme(normalizeThemeMode(opts.theme));
                    setLanguage(opts.language);
                    if (typeof opts.displayName === 'string') {
                      setProfileDisplayName(opts.displayName);
                    }
                    if (typeof opts.about === 'string') {
                      setProfileAbout(opts.about);
                    }
                    try {
                      await saveAppSettings({
                        nickname: opts.nickname,
                        theme: normalizeThemeMode(opts.theme),
                        lang: opts.language,
                        lockMethod: 'none',
                        chatsMode: 'persistent',
                      });
                      try {
                        await saveThemePreference(normalizeThemeMode(opts.theme));
                      } catch {}
                    } catch (e) {
                      logger.warn('saveAppSettings (settings) failed', e);
                    }
                    navigation.goBack();
                  }}
                  onOpenMain={() => navigation.navigate('MainTabs', {screen: 'Rooms'} as any)}
                  onOpenWallet={() => navigation.navigate('MainTabs', {screen: 'Wallet'} as any)}
                  onOpenDiagnostics={() => navigation.navigate('Diagnostics')}
                  onLogout={handleLogout}
                  onLogoutAll={async () => {
                    const res = await authLogoutAll();
                    if (res && res.accessToken) {
                      try { const {saveAccessToken} = await import('./storage/authTokenStorage'); await saveAccessToken(res.accessToken); } catch {}
                    }
                  }}
                  onChangePassword={async ({currentPassword, newPassword}: any) => {
                    await authChangePassword({currentPassword, newPassword});
                  }}
                  onRotateRecovery={async ({currentPassword}: any) => {
                    const r = await authRecoveryRotate({currentPassword});
                    if (!r || !r.accessToken || !r.recoveryKey) {
                      throw new Error(i18n.t('app.errors.noRecoveryKey'));
                    }
                    try { const {saveAccessToken} = await import('./storage/authTokenStorage'); await saveAccessToken(r.accessToken); } catch {}
                    // получаем адрес кошелька
                    let addr = '—';
                    try {
                      const w = await walletMe();
                      if (w && w.address) addr = w.address;
                    } catch {}
                    return {recoveryKey: r.recoveryKey, walletAddress: addr};
                  }}
                  onShowRecovery={(pending: any) => {
                    setRecoveryGate(pending);
                    setIsAuthed(false);
                  }}
                />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="Diagnostics">
              {({navigation}) => (
                <DiagnosticsScreen
                  navigation={navigation}
                  onBack={() => navigation.goBack()}
                  onOpenMain={() => navigation.navigate('MainTabs', {screen: 'Rooms'} as any)}
                  onOpenWallet={() => navigation.navigate('MainTabs', {screen: 'Wallet'} as any)}
                  onOpenSettings={() => navigation.navigate('Settings')}
                    onNewDirect={() => navigation.navigate('NewDirectChat')}
                />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="IncomingCall">
              {({navigation, route}) => (
                <IncomingCallScreen navigation={navigation} route={route as any} />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="Call">
              {({route, navigation}) => {
                const {calleeName, isVideo, roomId, isCaller, targetUserId} = route.params as {
                  calleeName: string;
                  isVideo: boolean;
                  roomId: string;
                  isCaller?: boolean;
                  targetUserId?: string;
                };

                const rtc = useWebRtcP2P({
                  roomId,
                  userId: nickname || 'me',
                  preferVideo: isVideo,
                  targetUserId: targetUserId || null,
                });

                useEffect(() => {
                  if (isCaller) {
                    rtc.startOutgoingCall(isVideo);
                  }
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [isCaller, isVideo]);

                return (
                  <CallScreen
                    calleeName={calleeName}
                    isVideo={isVideo}
                    connected={rtc.connected}
                    connectionState={rtc.connectionState}
                    reconnecting={rtc.reconnecting}
                    localStream={rtc.localStream}
                    remoteStream={rtc.remoteStream}
                    isMuted={rtc.isMuted}
                    isSpeaker={rtc.isSpeaker}
                    onEnd={() => {
                      rtc.hangup();
                      navigation.goBack();
                    }}
                    onToggleMute={() => rtc.toggleMute()}
                    onToggleSpeaker={() => rtc.toggleSpeaker()}
                    onSwitchCamera={() => rtc.switchCamera()}
                    onToggleVideo={() => rtc.toggleVideo()}
                    onRetry={() => rtc.reconnect()}
                  />
                );
              }}
            </RootStack.Screen>
          </>
        )}
            </RootStack.Navigator>
          </NavigationContainer>
        </SecurityProvider>
      </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
