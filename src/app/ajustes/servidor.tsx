import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/settings-row';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';
import { clearCreds, loadCreds } from '@/lib/api';
import { ping } from '@/lib/api';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function ServidorScreen() {
  const s = useStyles();
  const t = usePalette();
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [state, setState] = useState<'checking' | 'ok' | 'down' | 'noconf'>('checking');

  const check = useCallback(async () => {
    setState('checking');
    const creds = await loadCreds();
    if (!creds) {
      setState('noconf');
      setUrl(null);
      return;
    }
    setUrl(creds.baseUrl);
    const t0 = Date.now();
    const ok = await ping();
    setLatency(ok ? Date.now() - t0 : null);
    setState(ok ? 'ok' : 'down');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const statusText =
    state === 'checking'
      ? 'comprobando…'
      : state === 'ok'
        ? `● conectado${latency !== null ? ` · ${latency} ms` : ''}`
        : state === 'down'
          ? '● sin respuesta'
          : 'no configurado';

  const statusColor = state === 'ok' ? '#4ade80' : state === 'down' ? '#fca5a5' : t.dim;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Servidor' }} />

      {state === 'checking' ? <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} /> : null}

      <SettingsRow
        title="Dirección"
        value={url ? url.replace(/^https?:\/\//, '') : '—'}
      />
      <SettingsRow title="Estado" value={statusText} />
      <SettingsRow title="Emparejamiento" value={state === 'noconf' ? 'sin vincular' : 'vinculado'} last />

      <View style={s.buttons}>
        <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={check}>
          <Text style={[s.btnText, { color: t.ink }]}>Reconectar</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={() => router.push('/conectar' as never)}>
          <Text style={s.btnText}>Re-emparejar</Text>
        </Pressable>
      </View>

      <Pressable
        style={s.danger}
        onPress={async () => {
          await clearCreds();
          router.replace('/conectar' as never);
        }}>
        <Text style={s.dangerText}>Olvidar este servidor</Text>
      </Pressable>
      <Text style={s.note}>Al olvidarlo se borra el token guardado en el llavero del iPhone.</Text>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6 },
    buttons: { flexDirection: 'row', gap: 8, marginTop: 16 },
    btn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
    },
    btnText: { color: t.textSoft, fontSize: 13.5, fontWeight: '600' },
    danger: { marginTop: 26, paddingVertical: 14 },
    dangerText: { color: '#fca5a5', fontSize: 14 },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  });
