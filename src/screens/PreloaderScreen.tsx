import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useTheme} from '../theme/ThemeContext';
import type {Theme} from '../theme/themes';
import {View, StyleSheet, Animated, Easing, Pressable} from 'react-native';
import Video from 'react-native-video';
import {useLexmessApi} from '../hooks/useLexmessApi';

interface Props {
  onDone: () => void;
}

export const PreloaderScreen: React.FC<Props> = ({onDone}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  // Важно: useLexmessApi() возвращает новый объект на каждый рендер.
  // Если зависеть от всего объекта в useEffect, эффект может перезапускаться,
  // а cleanup будет сбивать таймеры — прелоадер может стать «вечным».
  // Берём только стабильную функцию.
  const {getMe} = useLexmessApi();

  // onDone часто создаётся заново (inline callback в App). Если держать его
  // в зависимостях эффекта, таймеры будут постоянно сбрасываться и прелоадер
  // станет «вечным». Поэтому храним актуальную ссылку в ref.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const doneOnceRef = useRef(false);
  const safeDone = useCallback(() => {
    if (doneOnceRef.current) return;
    doneOnceRef.current = true;
    onDoneRef.current();
  }, []);

  const videoSource = useMemo(() => require('../assets/preloader.mp4'), []);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.02)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start();
    return () => anim.stop();
  }, [opacity, scale]);

  useEffect(() => {
    let cancelled = false;

    // Фэйл-сейф: если сеть/инициализация зависла, не держим прелоад бесконечно.
    const hardTimer = setTimeout(() => {
      if (!cancelled) safeDone();
    }, 6000);

    const run = async () => {
      try {
        await getMe({timeoutMs: 2500});
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Preloader] /v1/account/me failed (will continue anyway)', e);
      } finally {
        if (!cancelled) {
          setTimeout(() => {
            if (!cancelled) safeDone();
          }, 900);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(hardTimer);
    };
  }, [getMe, safeDone]);

  return (
    <Pressable style={styles.container} onPress={safeDone}>
      <Animated.View
        // чтобы нажатие всегда ловилось Pressable, а не Video
        pointerEvents="none"
        style={[styles.frame, {opacity, transform: [{scale}]}]}>
        <Video
          source={videoSource}
          style={styles.video}
          resizeMode="contain"
          repeat
          muted
          controls={false}
          paused={false}
          playInBackground={false}
          playWhenInactive={false}
          onError={(e) =>
            // eslint-disable-next-line no-console
            console.warn('[Preloader] video error', e)
          }
        />
      </Animated.View>
    </Pressable>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  // Отступы: по бокам 15% ширины, сверху 7% высоты
  frame: {
    width: '70%',     // 100% - 15% - 15%
    height: '93%',    // 100% - 7% сверху
    marginTop: '7%',
    overflow: 'hidden',
  },

  video: {
    width: '100%',
    height: '100%',
  },
});
