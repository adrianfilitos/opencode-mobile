import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatNum, formatUSD, getSessionStats, type SessionStats } from '@/lib/api';
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

type RangeKey = 'today' | '7d' | '30d' | 'all';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'all', label: 'Todo' },
];

const DAY = 24 * 60 * 60 * 1000;

function rangeFor(key: RangeKey): { from?: number; to?: number } {
  const now = Date.now();
  if (key === 'all') return {};
  if (key === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return { from: d.getTime(), to: now };
  }
  return { from: now - (key === '7d' ? 7 : 30) * DAY, to: now };
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function shortDay(iso: string): string {
  const parts = iso.split('-');
  if (parts.length === 3) return `${Number(parts[2])} ${MONTHS[Number(parts[1]) - 1] ?? ''}`.trim();
  return iso;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const s = useStyles();
  return (
    <View style={s.card}>
      <Text style={s.cardLabel}>{label}</Text>
      <Text style={s.cardValue}>{value}</Text>
      {sub ? <Text style={s.cardSub}>{sub}</Text> : null}
    </View>
  );
}

export default function EstadisticasScreen() {
  const s = useStyles();
  const t = usePalette();
  const [range, setRange] = useState<RangeKey>('7d');
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: RangeKey) => {
    setLoading(true);
    try {
      setStats(await getSessionStats(rangeFor(key)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const activity = (stats?.activity ?? []).slice(-10);
  const maxSteps = Math.max(1, ...activity.map((a) => a.steps));

  const byModel = useMemo(() => {
    const map = new Map<string, { cost: number; steps: number }>();
    for (const mu of stats?.models ?? []) {
      const key = `${mu.model?.providerID ?? ''}/${mu.model?.id ?? ''}`;
      const cur = map.get(key) ?? { cost: 0, steps: 0 };
      map.set(key, { cost: cur.cost + (mu.cost ?? 0), steps: cur.steps + (mu.steps ?? 0) });
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost);
  }, [stats]);

  const toolsTotals = stats?.tools?.totals;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Estadísticas' }} />

      <View style={s.segs}>
        {RANGES.map((r) => {
          const on = r.key === range;
          return (
            <Pressable
              key={r.key}
              style={[s.seg, on && { backgroundColor: t.accent, borderColor: t.accent }]}
              onPress={() => setRange(r.key)}>
              <Text style={[s.segText, on && { color: t.ink, fontWeight: '700' }]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !stats ? <ActivityIndicator color={t.accent} style={{ marginVertical: 20 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {stats ? (
        <>
          <View style={s.cards}>
            <Card label="Coste" value={formatUSD(stats.cost)} sub="estimado" />
            <Card
              label="Tokens"
              value={formatNum((stats.tokens?.input ?? 0) + (stats.tokens?.output ?? 0) + (stats.tokens?.reasoning ?? 0))}
              sub={`+ ${formatNum(stats.tokens?.cache?.read)} en caché`}
            />
            <Card label="Pasos" value={formatNum(stats.steps)} sub={`${stats.sessions ?? 0} sesiones`} />
            <Card
              label="Herramientas"
              value={formatNum(toolsTotals?.calls)}
              sub={toolsTotals?.failed ? `${toolsTotals.failed} con fallos` : 'sin fallos'}
            />
          </View>

          <Text style={s.section}>Actividad</Text>
          {activity.length === 0 ? (
            <Text style={s.empty}>Sin actividad en este rango.</Text>
          ) : (
            <View style={s.chart}>
              {activity.map((a) => (
                <View key={a.date} style={s.barCol}>
                  <View style={[s.bar, { height: Math.max(4, (a.steps / maxSteps) * 74) }]} />
                  <Text style={s.day}>{shortDay(a.date)}</Text>
                </View>
              ))}
            </View>
          )}

          {byModel.length > 0 ? (
            <>
              <Text style={s.section}>Por modelo</Text>
              {byModel.map(([key, v]) => {
                const [prov, id] = key.split('/');
                return (
                  <View key={key} style={s.row}>
                    <Text style={s.rowName} numberOfLines={1}>
                      {id}
                      <Text style={s.rowDim}> · {prov}</Text>
                    </Text>
                    <Text style={s.rowVal}>{formatUSD(v.cost)}</Text>
                  </View>
                );
              })}
            </>
          ) : null}

          <Text style={s.section}>Resumen</Text>
          <View style={s.row}>
            <Text style={s.rowName}>Días activo</Text>
            <Text style={s.rowVal}>{formatNum(stats.activeDays)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowName}>Racha</Text>
            <Text style={s.rowVal}>{formatNum(stats.streak)} días</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowName}>Prompts</Text>
            <Text style={s.rowVal}>{formatNum(stats.prompts)}</Text>
          </View>

          <Pressable
            style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]}
            onPress={() => load(range)}>
            <Sym name="arrow.clockwise" size={14} color={t.ink} />
            <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
          </Pressable>
          <Text style={s.note}>
            Datos del servidor (todas tus sesiones). «Todo» usa el rango por defecto del servidor.
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
    segs: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
    seg: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    segText: { color: t.textSoft, fontSize: 12.5 },
    cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
    card: {
      flexGrow: 1,
      flexBasis: '46%',
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 13,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    cardLabel: { color: t.dim, fontSize: 11.5 },
    cardValue: { color: t.text, fontSize: 19, fontWeight: '800', marginTop: 3 },
    cardSub: { color: t.dimSoft, fontSize: 10.5, marginTop: 2 },
    section: { color: t.text, fontSize: 13.5, fontWeight: '700', marginTop: 20, marginBottom: 8 },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100, paddingBottom: 2 },
    barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
    bar: { width: '100%', borderRadius: 5, backgroundColor: t.accent, opacity: 0.85 },
    day: { color: t.dimSoft, fontSize: 9 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    rowName: { color: t.textSoft, fontSize: 12.5, flex: 1 },
    rowDim: { color: t.dimSoft, fontSize: 11.5 },
    rowVal: { color: t.text, fontSize: 12.5, fontWeight: '700' },
    empty: { color: t.dimSoft, fontSize: 12.5, paddingVertical: 6 },
    error: { color: '#fca5a5', fontSize: 12, marginTop: 10 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 12,
      marginTop: 20,
    },
    btnText: { fontSize: 13.5, fontWeight: '700' },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 12 },
  });
