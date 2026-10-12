import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getAgents, type AgentInfo } from '@/lib/api';
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

function effectColor(effect: string, t: Palette): string {
  if (effect === 'allow') return t.ok;
  if (effect === 'deny') return '#fca5a5';
  return t.warn;
}

export default function AgentesScreen() {
  const s = useStyles();
  const t = usePalette();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgents(await getAgents());
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
      <Stack.Screen options={{ title: 'Agentes' }} />

      {loading && agents.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {agents.map((a) => {
        const id = a.id ?? a.name;
        const expanded = open === id;
        const perms = a.permissions ?? [];
        return (
          <View key={id} style={s.card}>
            <Pressable
              style={s.cardTop}
              onPress={() => {
                haptic('tap');
                setOpen(expanded ? null : id);
              }}>
              <Sym name="cpu" size={15} color={t.accent} />
              <Text style={s.cardTitle} numberOfLines={1}>
                {a.name}
              </Text>
              {a.hidden ? (
                <View style={[s.badge, { borderColor: t.line }]}>
                  <Text style={[s.badgeText, { color: t.dim }]}>oculto</Text>
                </View>
              ) : null}
              {a.mode ? (
                <View style={[s.badge, { borderColor: t.line }]}>
                  <Text style={[s.badgeText, { color: t.dim }]}>{a.mode}</Text>
                </View>
              ) : null}
              <Sym name={expanded ? 'chevron.up' : 'chevron.down'} size={12} color={t.dimSoft} />
            </Pressable>

            {a.description ? (
              <Text style={s.desc} numberOfLines={expanded ? undefined : 2}>
                {a.description}
              </Text>
            ) : null}

            {expanded ? (
              <View style={{ marginTop: 8 }}>
                <Text style={s.ruleHead}>Permisos · {perms.length}</Text>
                {perms.length === 0 ? (
                  <Text style={s.empty}>Sin reglas.</Text>
                ) : (
                  perms.map((p, i) => (
                    <View key={`${p.action}-${p.resource}-${i}`} style={s.rule}>
                      <View style={[s.dot, { backgroundColor: effectColor(p.effect, t) }]} />
                      <Text style={[s.ruleEffect, { color: effectColor(p.effect, t) }]}>
                        {p.effect}
                      </Text>
                      <Text style={s.ruleText} numberOfLines={1}>
                        {p.action} · {p.resource}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={load}>
        <Sym name="arrow.clockwise" size={14} color={t.ink} />
        <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
      </Pressable>
      <Text style={s.note}>
        «allow» permite sin preguntar · «ask» pregunta · «deny» bloquea. Se configuran en el PC
        (AGENTS.md / opencode.json).
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: t.text, fontSize: 13.5, fontWeight: '600', flex: 1 },
    desc: { color: t.dim, fontSize: 11.5, lineHeight: 16, marginTop: 5 },
    badge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 10.5, fontWeight: '600' },
    ruleHead: { color: t.textSoft, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    rule: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    ruleEffect: { fontSize: 11, fontWeight: '700', width: 42 },
    ruleText: { color: t.dim, fontSize: 11.5, flex: 1, fontFamily: 'Courier' },
    empty: { color: t.dimSoft, fontSize: 12 },
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
