import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/settings-row';
import { getDefaultModel, type DefaultModel } from '@/lib/api';
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

function tokens(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export default function ModeloDefectoScreen() {
  const s = useStyles();
  const t = usePalette();
  const [model, setModel] = useState<DefaultModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setModel(await getDefaultModel());
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

  const cost = model?.cost?.[0];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Modelo por defecto' }} />

      {loading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {model ? (
        <>
          <View style={s.hero}>
            <Sym name="cpu" size={18} color={t.accent} />
            <Text style={s.heroTitle} numberOfLines={1}>
              {model.name ?? model.modelID ?? model.id}
            </Text>
            {model.status ? (
              <View style={[s.badge, { borderColor: t.ok }]}>
                <Text style={[s.badgeText, { color: t.ok }]}>{model.status}</Text>
              </View>
            ) : null}
          </View>

          <SettingsRow title="Proveedor" value={model.providerID ?? '—'} />
          <SettingsRow title="Identificador" value={model.modelID ?? model.id ?? '—'} />
          <SettingsRow title="Contexto" value={tokens(model.limit?.context)} />
          <SettingsRow title="Salida máx." value={tokens(model.limit?.output)} />
          <SettingsRow
            title="Capacidades"
            value={`${model.capabilities?.tools ? 'herramientas' : 'sin herramientas'} · ${(model.capabilities?.input ?? []).join('/')}`}
          />
          <SettingsRow
            title="Razonamiento"
            value={(model.variants ?? []).map((v) => v.id).join(', ') || 'no'}
          />
          <SettingsRow
            title="Coste (por millón)"
            value={cost ? `${cost.input ?? 0} / ${cost.output ?? 0}` : '—'}
            last
          />

          <Pressable
            style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]}
            onPress={load}>
            <Sym name="arrow.clockwise" size={14} color={t.ink} />
            <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
          </Pressable>
          <Text style={s.note}>
            Es el modelo que usa el servidor cuando no se indica otro. Para las sesiones nuevas que
            creas desde el móvil se usa el de Ajustes → Agente y modelo.
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 14,
    },
    heroTitle: { color: t.text, fontSize: 14.5, fontWeight: '700', flex: 1 },
    badge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 10.5, fontWeight: '600' },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
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
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 12 },
  });
