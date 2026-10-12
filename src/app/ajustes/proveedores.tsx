import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getCredentials,
  getProviders,
  maskKey,
  type Credential,
  type Provider,
} from '@/lib/api';
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

export default function ProveedoresScreen() {
  const s = useStyles();
  const t = usePalette();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([getProviders(), getCredentials()]);
      setProviders(p);
      setCreds(c);
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
      <Stack.Screen options={{ title: 'Proveedores y claves' }} />

      {loading && providers.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={s.section}>Proveedores · {providers.length}</Text>
      {providers.length === 0 && !loading ? (
        <Text style={s.empty}>No hay proveedores configurados.</Text>
      ) : null}
      {providers.map((p) => {
        const enabled = p.activation === 'enabled' || p.activation === 'auto';
        return (
          <View key={p.id} style={s.card}>
            <View style={s.cardTop}>
              <Sym name="cpu" size={15} color={t.accent} />
              <Text style={s.cardTitle} numberOfLines={1}>
                {p.name ?? p.id}
              </Text>
              <View style={[s.badge, { borderColor: enabled ? t.ok : t.line }]}>
                <Text style={[s.badgeText, { color: enabled ? t.ok : t.dim }]}>
                  {p.activation ?? '—'}
                </Text>
              </View>
            </View>
            <Text style={s.mono} numberOfLines={1}>
              {p.id}
              {p.package ? ` · ${p.package}` : ''}
            </Text>
          </View>
        );
      })}

      <Text style={s.section}>Claves guardadas · {creds.length}</Text>
      {creds.length === 0 && !loading ? (
        <Text style={s.empty}>No hay claves guardadas.</Text>
      ) : null}
      {creds.map((c) => (
        <View key={c.id} style={s.card}>
          <View style={s.cardTop}>
            <Sym name="key" size={15} color={c.active ? t.ok : t.dim} />
            <Text style={s.cardTitle} numberOfLines={1}>
              {c.label?.trim() || c.integrationID}
            </Text>
            {c.active ? (
              <View style={[s.badge, { borderColor: t.ok }]}>
                <Text style={[s.badgeText, { color: t.ok }]}>activa</Text>
              </View>
            ) : (
              <View style={[s.badge, { borderColor: t.line }]}>
                <Text style={[s.badgeText, { color: t.dim }]}>inactiva</Text>
              </View>
            )}
          </View>
          <Text style={s.mono} numberOfLines={1}>
            {c.integrationID}
            {c.value?.key ? ` · ${maskKey(c.value.key)}` : c.value?.type ? ` · ${c.value.type}` : ''}
          </Text>
        </View>
      ))}

      <Text style={s.note}>
        Por seguridad, las claves se muestran enmascaradas (solo los últimos 4 caracteres). La
        edición se hace en el PC.
      </Text>

      <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={load}>
        <Sym name="arrow.clockwise" size={14} color={t.ink} />
        <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 30 },
    section: {
      color: t.text,
      fontSize: 13.5,
      fontWeight: '700',
      marginTop: 18,
      marginBottom: 8,
    },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      gap: 4,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: t.text, fontSize: 13.5, fontWeight: '600', flex: 1 },
    mono: { color: t.dim, fontSize: 11.5, fontFamily: 'Courier' },
    badge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 10.5, fontWeight: '600' },
    empty: { color: t.dimSoft, fontSize: 12.5, paddingVertical: 6 },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 14 },
    error: { color: '#fca5a5', fontSize: 12, marginTop: 10 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 12,
      marginTop: 18,
    },
    btnText: { fontSize: 13.5, fontWeight: '700' },
  });
