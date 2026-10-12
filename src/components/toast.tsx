import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSessions } from '@/lib/api';
import { subscribeEvents } from '@/lib/events';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

type Notice = { id: number; title: string; body: string; sessionID?: string; ok: boolean };

/**
 * Aviso que baja desde arriba cuando el agente termina un turno.
 * Se puede desactivar en Ajustes → Apariencia.
 */
export default function ToastHost() {
  const s = useStyles();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs } = usePrefs();
  const [notice, setNotice] = useState<Notice | null>(null);
  const y = useRef(new Animated.Value(-140)).current;
  const titles = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  // Nombres de sesión para poder decirte cuál ha terminado.
  useEffect(() => {
    getSessions()
      .then((list) => {
        for (const ses of list) titles.current[ses.id] = ses.title?.trim() || ses.id.slice(-6);
      })
      .catch(() => {});
  }, [notice]);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start(() =>
      setNotice(null)
    );
  };

  const show = (n: Notice) => {
    setNotice(n);
    y.setValue(-140);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 16 }).start();
    haptic(n.ok ? 'success' : 'error');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, 5200);
  };

  useEffect(() => {
    if (!prefs.inAppNotify) return;
    const unsub = subscribeEvents((e) => {
      // pregunta (question) nueva → aviso para que no se quede colgada
      if (e.type === 'form.created') {
        const sid = e.data?.sessionID;
        if (!sid) return;
        seq.current += 1;
        show({
          id: seq.current,
          title: 'Te están preguntando',
          body: titles.current[sid] ?? 'Sesión',
          sessionID: sid,
          ok: false,
        });
        return;
      }
      const ok = e.type === 'session.execution.succeeded';
      const fail = e.type === 'session.execution.failed';
      if (!ok && !fail) return;
      const sid = e.data?.sessionID;
      if (!sid) return;
      seq.current += 1;
      show({
        id: seq.current,
        title: ok ? 'Listo' : 'Algo ha fallado',
        body: titles.current[sid] ?? 'Sesión',
        sessionID: sid,
        ok,
      });
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.inAppNotify]);

  if (!notice) return null;

  return (
    <Animated.View
      style={[s.wrap, { top: insets.top + 6, transform: [{ translateY: y }] }]}
      pointerEvents="box-none">
      <Pressable
        style={[s.card, { borderColor: notice.ok ? t.line : t.warnLine }]}
        onPress={() => {
          const sid = notice.sessionID;
          hide();
          haptic('tap');
          if (sid) {
            router.push({
              pathname: '/sesion/[id]',
              params: { id: sid, title: titles.current[sid] ?? 'Sesión' },
            } as never);
          }
        }}>
        <SymbolView
          name={notice.ok ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
          tintColor={notice.ok ? t.ok : t.warn}
          size={20}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{notice.title}</Text>
          <Text style={s.body} numberOfLines={1}>
            {notice.body}
          </Text>
        </View>
        <Text style={s.hint}>abrir</Text>
      </Pressable>
    </Animated.View>
  );
}

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 12,
      right: 12,
      zIndex: 100,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    title: { color: t.text, fontSize: 13.5, fontWeight: '700' },
    body: { color: t.dim, fontSize: 12, marginTop: 2 },
    hint: { color: t.accent, fontSize: 11.5, fontWeight: '600' },
  });
