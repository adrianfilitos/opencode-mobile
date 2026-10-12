import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
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

import { connectIntegrationKey, getIntegrations, type Integration } from '@/lib/api';
import { haptic } from '@/lib/haptics';
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

const MAX = 60;

export default function IntegracionesScreen() {
  const s = useStyles();
  const t = usePalette();
  const [all, setAll] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAll(await getIntegrations());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const connected = all.filter((i) => (i.connections?.length ?? 0) > 0);
  const matches = q
    ? all.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    : connected;
  const shown = matches.slice(0, MAX);

  async function addKey(it: Integration) {
    const key = keyDraft.trim();
    if (!key) return;
    setBusy(it.id);
    try {
      await connectIntegrationKey(it.id, key);
      haptic('success');
      setKeyDraft('');
      setOpen(null);
      await load();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function methodsText(it: Integration): string {
    const types = (it.methods ?? []).map((m) => m.type ?? '');
    return [...new Set(types)].join(' · ') || '—';
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Integraciones' }} />

      <TextInput
        style={s.search}
        placeholder={`Buscar entre ${all.length} integraciones…`}
        placeholderTextColor={t.dimSoft}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading && all.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {q === '' ? (
        <Text style={s.hint}>
          {connected.length > 0
            ? `Conectadas · ${connected.length}`
            : 'Ninguna conectada. Escribe arriba para buscar y añadir una clave.'}
        </Text>
      ) : (
        <Text style={s.hint}>
          {matches.length} resultado{matches.length === 1 ? '' : 's'}
          {matches.length > MAX ? ` · mostrando ${MAX}` : ''}
        </Text>
      )}

      {shown.map((it) => {
        const expanded = open === it.id;
        const conns = it.connections ?? [];
        return (
          <View key={it.id} style={s.card}>
            <Pressable
              style={s.cardTop}
              onPress={() => {
                haptic('tap');
                setKeyDraft('');
                setOpen(expanded ? null : it.id);
              }}>
              <Sym
                name={conns.length > 0 ? 'checkmark.circle.fill' : 'plus.circle'}
                size={15}
                color={conns.length > 0 ? t.ok : t.dimSoft}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>
                  {it.name}
                </Text>
                <Text style={s.mono} numberOfLines={1}>
                  {it.id} · {methodsText(it)}
                  {conns.length > 0 ? ` · ${conns.length} conexión${conns.length === 1 ? '' : 'es'}` : ''}
                </Text>
              </View>
              <Sym name={expanded ? 'chevron.up' : 'chevron.down'} size={12} color={t.dimSoft} />
            </Pressable>

            {expanded ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                {conns.map((c, i) => (
                  <View key={c.id ?? i} style={s.conn}>
                    <Sym name="key" size={13} color={t.ok} />
                    <Text style={s.connText} numberOfLines={1}>
                      {c.label?.trim() || c.methodID || c.type || 'conexión'}
                    </Text>
                  </View>
                ))}
                <View style={s.addRow}>
                  <TextInput
                    style={s.input}
                    placeholder="Pega la API key…"
                    placeholderTextColor={t.dimSoft}
                    value={keyDraft}
                    onChangeText={setKeyDraft}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <Pressable
                    style={[s.addBtn, { backgroundColor: t.accent, borderColor: t.accent }, busy === it.id && { opacity: 0.6 }]}
                    disabled={busy === it.id || !keyDraft.trim()}
                    onPress={() => addKey(it)}>
                    {busy === it.id ? (
                      <ActivityIndicator size="small" color={t.ink} />
                    ) : (
                      <Text style={[s.addText, { color: t.ink }]}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
                <Text style={s.warn}>
                  La clave se guarda en tu servidor (no sale del PC). Aquí solo se muestra enmascarada.
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {matches.length === 0 && !loading ? (
        <Text style={s.empty}>Sin resultados para «{query.trim()}».</Text>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
    search: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 13,
      paddingVertical: 10,
      color: t.text,
      fontSize: 13.5,
      marginBottom: 10,
    },
    hint: { color: t.textSoft, fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    cardTitle: { color: t.text, fontSize: 13.5, fontWeight: '600' },
    mono: { color: t.dim, fontSize: 11, fontFamily: 'Courier', marginTop: 2 },
    conn: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    connText: { color: t.textSoft, fontSize: 12, flex: 1 },
    addRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
    input: {
      flex: 1,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: t.text,
      fontSize: 13,
    },
    addBtn: {
      borderRadius: 10,
      paddingHorizontal: 16,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    addText: { fontSize: 13, fontWeight: '700' },
    warn: { color: t.dimSoft, fontSize: 11, lineHeight: 16 },
    empty: { color: t.dimSoft, fontSize: 12.5, paddingVertical: 10 },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
  });
