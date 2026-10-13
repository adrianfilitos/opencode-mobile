import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionLabel, SettingsRow } from '@/components/settings-row';
import { getAgents, getModels, type AgentInfo, type Model } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

const VARIANT_LABEL: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto' };

export default function ModeloScreen() {
  const s = useStyles();
  const t = usePalette();
  const { prefs, set } = usePrefs();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAgents().catch(() => []), getModels().catch(() => [])])
      .then(([a, m]) => {
        setAgents(a);
        setModels(m.filter((x) => x.enabled !== false));
      })
      .finally(() => setLoading(false));
  }, []);

  const byProvider = useMemo(
    () =>
      models.reduce<Record<string, Model[]>>((acc, m) => {
        (acc[m.providerID] ??= []).push(m);
        return acc;
      }, {}),
    [models]
  );

  /** Agentes elegibles: principales y visibles (build, plan…). */
  const pickable = useMemo(() => {
    const list = agents.filter((a) => !a.hidden && a.mode !== 'subagent');
    if (list.length > 0) return list;
    if (agents.length > 0) return agents;
    return [{ name: prefs.agent }] as AgentInfo[];
  }, [agents, prefs.agent]);

  const chosen = models.find(
    (m) => m.id === prefs.modelId && m.providerID === prefs.providerID
  );
  const variants = (chosen?.variants ?? []).map((v) => v.id);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Agente y modelo' }} />

      {loading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} /> : null}

      <SectionLabel>Agente por defecto</SectionLabel>
      {pickable.map((a, i, arr) => (
        <SettingsRow
          key={a.id ?? a.name}
          title={a.name ?? a.id ?? ''}
          subtitle={a.description}
          check={prefs.agent === (a.id ?? a.name)}
          last={i === arr.length - 1}
          onPress={() => {
            haptic('select');
            // ¡OJO! Se guarda el ID («build»), NO el nombre («Build»): el
            // servidor no encuentra el agente si se le pasa el nombre y el
            // turno moría con AgentNotFoundError.
            set({ agent: a.id ?? a.name });
          }}
        />
      ))}
      <Text style={s.hint}>Se usa al crear sesiones nuevas.</Text>

      <SectionLabel>Modelo por defecto</SectionLabel>
      {Object.entries(byProvider).map(([provider, list]) => (
        <View key={provider}>
          <Text style={s.provider}>{provider}</Text>
          {list.map((m, i) => (
            <SettingsRow
              key={`${provider}-${m.id}`}
              title={m.name ?? m.id}
              subtitle={m.id}
              check={prefs.modelId === m.id && prefs.providerID === provider}
              last={i === list.length - 1}
              onPress={() => {
                haptic('select');
                set({ modelId: m.id, providerID: provider, variant: null });
              }}
            />
          ))}
        </View>
      ))}
      <Text style={s.hint}>
        También puedes cambiarlo en cada sesión desde la barra del modelo.
      </Text>

      <SectionLabel>Razonamiento por defecto</SectionLabel>
      {(variants.length > 0 ? variants : ['low', 'medium', 'high']).map((v, i, arr) => (
        <SettingsRow
          key={v}
          title={VARIANT_LABEL[v] ?? v}
          check={prefs.variant === v}
          last={i === arr.length - 1}
          onPress={() => {
            haptic('select');
            set({ variant: v });
          }}
        />
      ))}
      <SettingsRow
        title="El del modelo"
        subtitle="sin forzar razonamiento"
        check={prefs.variant === null}
        last
        onPress={() => {
          haptic('select');
          set({ variant: null });
        }}
      />
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
    hint: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 8, marginHorizontal: 4 },
    provider: {
      color: t.dimSoft,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 12,
      marginBottom: 2,
      marginHorizontal: 4,
    },
  });
