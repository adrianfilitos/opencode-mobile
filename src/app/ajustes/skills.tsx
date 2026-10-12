import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getCommands, getSkills, type CommandInfo, type SkillInfo } from '@/lib/api';
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

export default function SkillsScreen() {
  const s = useStyles();
  const t = usePalette();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sk, cm] = await Promise.all([getSkills(), getCommands()]);
      setSkills(sk);
      setCommands(cm);
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
      <Stack.Screen options={{ title: 'Skills y comandos' }} />

      {loading && skills.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={s.section}>Skills · {skills.length}</Text>
      {skills.map((sk) => {
        const id = sk.id ?? sk.name ?? '';
        const expanded = open === id;
        return (
          <View key={id} style={s.card}>
            <Pressable
              style={s.cardTop}
              onPress={() => {
                haptic('tap');
                setOpen(expanded ? null : id);
              }}>
              <Sym name="sparkles" size={15} color={t.accent} />
              <Text style={s.cardTitle} numberOfLines={1}>
                {sk.name ?? id}
              </Text>
              <Sym name={expanded ? 'chevron.up' : 'chevron.down'} size={12} color={t.dimSoft} />
            </Pressable>
            {sk.description ? (
              <Text style={s.desc} numberOfLines={expanded ? undefined : 3}>
                {sk.description}
              </Text>
            ) : null}
            {expanded && sk.path ? <Text style={s.mono}>{sk.path}</Text> : null}
          </View>
        );
      })}
      {!loading && skills.length === 0 ? <Text style={s.empty}>No hay skills.</Text> : null}

      <Text style={s.section}>Comandos · {commands.length}</Text>
      {commands.map((c) => (
        <View key={c.name} style={s.cmdRow}>
          <Text style={[s.slash, { color: t.accent }]}>/</Text>
          <Text style={s.cmdName}>{c.name}</Text>
          {c.description ? (
            <Text style={s.cmdDesc} numberOfLines={1}>
              {c.description}
            </Text>
          ) : null}
        </View>
      ))}
      {!loading && commands.length === 0 ? <Text style={s.empty}>No hay comandos.</Text> : null}

      <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={load}>
        <Sym name="arrow.clockwise" size={14} color={t.ink} />
        <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
      </Pressable>
      <Text style={s.note}>
        Solo lectura. Las skills y los comandos se definen en el PC. Escribe «/» en el chat para ver
        si el servidor ofrece más.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
    section: { color: t.text, fontSize: 13.5, fontWeight: '700', marginTop: 16, marginBottom: 8 },
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
    mono: { color: t.dimSoft, fontSize: 10.5, fontFamily: 'Courier', marginTop: 6 },
    cmdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    slash: { fontSize: 14, fontWeight: '700' },
    cmdName: { color: t.textSoft, fontSize: 13, fontFamily: 'Courier' },
    cmdDesc: { color: t.dim, fontSize: 11.5, flex: 1, textAlign: 'right' },
    empty: { color: t.dimSoft, fontSize: 12.5, paddingVertical: 6 },
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
