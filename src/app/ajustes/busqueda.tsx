import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getWebSearchProviders, type WebSearchProvider } from '@/lib/api';
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

export default function BusquedaScreen() {
  const s = useStyles();
  const t = usePalette();
  const [items, setItems] = useState<WebSearchProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getWebSearchProviders());
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

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Búsqueda web' }} />

      {loading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={s.hint}>Proveedores disponibles · {items.length}</Text>
      {items.map((p) => (
        <View key={p.id} style={s.card}>
          <Sym name="magnifyingglass" size={15} color={t.dim} />
          <Text style={s.cardTitle} numberOfLines={1}>
            {p.name ?? p.id}
          </Text>
          <Text style={s.mono}>{p.id}</Text>
        </View>
      ))}

      <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={load}>
        <Sym name="arrow.clockwise" size={14} color={t.ink} />
        <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
      </Pressable>
      <Text style={s.note}>
        El proveedor que usa el agente se elige en la configuración del servidor (PC). Aquí los ves
        para saber qué hay disponible.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
    hint: { color: t.textSoft, fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginBottom: 8,
    },
    cardTitle: { color: t.text, fontSize: 13.5, fontWeight: '600', flex: 1 },
    mono: { color: t.dim, fontSize: 11, fontFamily: 'Courier' },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 12,
      marginTop: 14,
    },
    btnText: { fontSize: 13.5, fontWeight: '700' },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 12 },
  });
