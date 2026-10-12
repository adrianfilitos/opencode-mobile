import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

export default function AvisosScreen() {
  const s = useStyles();
  const t = usePalette();
  const { prefs, set } = usePrefs();
  const [topic, setTopic] = useState(prefs.ntfyTopic);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sendTest() {
    const tt = topic.trim();
    if (!tt) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`https://ntfy.sh/${encodeURIComponent(tt)}`, {
        method: 'POST',
        headers: { Title: 'OpenCode Mobile', Tags: 'white_check_mark' },
        body: 'Prueba desde OpenCode Mobile ✅',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      haptic('success');
      setResult('Enviada. Debería llegarte al móvil en unos segundos.');
    } catch (e) {
      haptic('error');
      setResult(`No se pudo enviar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Avisos' }} />

      <Text style={s.intro}>
        El helper del PC avisa por <Text style={{ fontWeight: '700' }}>ntfy</Text> cuando el agente
        pide un permiso. Aquí compruebas que la notificación te llega al móvil.
      </Text>

      <Text style={s.label}>Tu tema de ntfy</Text>
      <TextInput
        style={s.input}
        placeholder="oc-tu-tema"
        placeholderTextColor={t.dimSoft}
        value={topic}
        onChangeText={setTopic}
        onBlur={() => set({ ntfyTopic: topic.trim() })}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={s.hint}>
        Es el mismo que usa el helper en el PC (lo verás en su registro o en `tools\\.ntfy-topic`).
        Se guarda solo en el llavero del iPhone, no en el repo.
      </Text>

      <Pressable
        style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }, busy && { opacity: 0.6 }]}
        disabled={busy || !topic.trim()}
        onPress={sendTest}>
        {busy ? (
          <ActivityIndicator size="small" color={t.ink} />
        ) : (
          <>
            <Sym name="bell.badge" size={14} color={t.ink} />
            <Text style={[s.btnText, { color: t.ink }]}>Enviar aviso de prueba</Text>
          </>
        )}
      </Pressable>

      {result ? <Text style={[s.result, { color: result.startsWith('Enviada') ? t.ok : '#fca5a5' }]}>{result}</Text> : null}

      <View style={s.card}>
        <Sym name="info.circle" size={15} color={t.dim} />
        <Text style={s.cardText}>
          Los avisos con la app cerrada los manda el helper del PC (ntfy). El tema se configura en el
          PC; aquí solo lo guardas para hacer la prueba.
        </Text>
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
    intro: { color: t.textSoft, fontSize: 13, lineHeight: 19, marginBottom: 16 },
    label: { color: t.dim, fontSize: 12, marginBottom: 6 },
    input: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 13,
      paddingVertical: 11,
      color: t.text,
      fontSize: 13.5,
    },
    hint: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 8 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 13,
      marginTop: 18,
    },
    btnText: { fontSize: 14, fontWeight: '700' },
    result: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      padding: 12,
      marginTop: 22,
    },
    cardText: { color: t.dim, fontSize: 11.5, lineHeight: 17, flex: 1 },
  });
