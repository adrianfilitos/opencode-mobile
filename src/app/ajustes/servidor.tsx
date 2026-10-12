import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SettingsRow } from '@/components/settings-row';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';
import {
  activateUrl,
  clearCreds,
  getKnownUrls,
  loadCreds,
  ping,
  rememberUrls,
} from '@/lib/api';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function ServidorScreen() {
  const s = useStyles();
  const t = usePalette();
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [state, setState] = useState<'checking' | 'ok' | 'down' | 'noconf'>('checking');
  const [draft, setDraft] = useState('');

  const check = useCallback(async () => {
    setState('checking');
    const creds = await loadCreds();
    if (!creds) {
      setState('noconf');
      setUrl(null);
      setUrls([]);
      return;
    }
    setUrl(creds.baseUrl);
    const t0 = Date.now();
    const ok = await ping();
    setLatency(ok ? Date.now() - t0 : null);
    setState(ok ? 'ok' : 'down');
    // `ping` puede haber cambiado la dirección activa y aprendido otras
    setUrl((await loadCreds())?.baseUrl ?? creds.baseUrl);
    setUrls(await getKnownUrls());
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

  const others = urls.filter((u) => u !== url);

  async function addAddress() {
    const v = draft.trim();
    if (!v) return;
    const withProto = /^https?:\/\//.test(v) ? v : `http://${v}`;
    await rememberUrls([withProto]);
    await activateUrl(withProto);
    setDraft('');
    await check();
  }

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

      {others.length > 0 ? (
        <>
          <Text style={s.section}>Otras direcciones</Text>
          <Text style={s.hint}>
            La app prueba todas y usa la que responda. Si el PC cambia de IP, aquí
            verás la nueva en cuanto conecte una vez.
          </Text>
          <View style={s.list}>
            {others.map((u) => (
              <View key={u} style={s.addrRow}>
                <Text style={s.addrText} numberOfLines={1}>
                  {u.replace(/^https?:\/\//, '')}
                </Text>
                <Pressable
                  hitSlop={8}
                  style={s.useBtn}
                  onPress={async () => {
                    await activateUrl(u);
                    await check();
                  }}>
                  <Text style={[s.useText, { color: t.accent }]}>Usar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={s.section}>Añadir dirección</Text>
      <View style={s.addRow}>
        <TextInput
          style={s.input}
          placeholder="http://192.168.1.37:49374"
          placeholderTextColor={t.dimSoft}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[s.addBtn, { backgroundColor: t.accent, borderColor: t.accent }]}
          onPress={addAddress}>
          <Text style={[s.addBtnText, { color: t.ink }]}>Añadir</Text>
        </Pressable>
      </View>

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
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 30 },
    section: { color: t.text, fontSize: 14, fontWeight: '700', marginTop: 22, marginBottom: 6 },
    hint: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginBottom: 10 },
    list: { gap: 8 },
    addrRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    addrText: { color: t.textSoft, fontSize: 12.5, flex: 1 },
    useBtn: { paddingHorizontal: 6, paddingVertical: 2 },
    useText: { fontSize: 12.5, fontWeight: '700' },
    addRow: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.text,
      fontSize: 13,
    },
    addBtn: {
      borderRadius: 11,
      paddingHorizontal: 16,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    addBtnText: { fontSize: 13, fontWeight: '700' },
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
