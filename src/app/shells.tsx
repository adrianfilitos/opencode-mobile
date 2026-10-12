import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getLocation, getProjects, getShells, readFileText, removeShell, type ShellInfo } from '@/lib/api';
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

function statusColor(st: string | undefined, t: Palette): string {
  if (st === 'running') return t.ok;
  if (st === 'failed' || st === 'error') return '#fca5a5';
  return t.dim;
}

function secs(from?: number, to?: number): string {
  if (!from) return '';
  const ms = (to ?? Date.now()) - from;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function ShellsScreen() {
  const s = useStyles();
  const t = usePalette();
  const [dir, setDir] = useState<string | null>(null);
  const [items, setItems] = useState<ShellInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ name: string; body: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (d: string | null) => {
    setLoading(true);
    try {
      setItems(await getShells(d ?? undefined));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([getProjects().catch(() => []), getLocation().catch(() => null)])
      .then(([projs, loc]) => {
        const base = projs[0]?.canonical ?? loc?.project?.canonical ?? loc?.directory ?? null;
        setDir(base);
        load(base);
      })
      .catch(() => setLoading(false));
  }, [load]);

  async function openOutput(sh: ShellInfo) {
    if (!sh.file) {
      setOutput({ name: sh.command ?? sh.id, body: '(sin fichero de salida)' });
      return;
    }
    setBusy(sh.id);
    try {
      const body = await readFileText(sh.file);
      setOutput({ name: sh.command ?? sh.id, body: body.slice(-20000) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function kill(sh: ShellInfo) {
    haptic('warning');
    try {
      await removeShell(sh.id, dir ?? undefined);
      await load(dir);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={s.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Shells',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontSize: 16 },
          headerTintColor: t.dim,
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.sub}>Comandos que ha lanzado el agente. Toca uno para ver su salida.</Text>

        {loading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {items.map((sh) => (
          <Pressable key={sh.id} style={s.card} onPress={() => openOutput(sh)}>
            <View style={s.cardTop}>
              <View style={[s.dot, { backgroundColor: statusColor(sh.status, t) }]} />
              <Text style={s.cmd} numberOfLines={1}>
                {(sh.command ?? '').split('\n')[0]}
              </Text>
              {busy === sh.id ? (
                <ActivityIndicator size="small" color={t.dim} />
              ) : (
                <Text style={s.meta}>
                  {sh.status === 'running' ? secs(sh.time?.started) : sh.status}
                </Text>
              )}
            </View>
            {sh.cwd ? (
              <Text style={s.mono} numberOfLines={1}>
                {sh.cwd}
              </Text>
            ) : null}
            {sh.status !== 'running' ? (
              <Pressable hitSlop={8} onPress={() => kill(sh)}>
                <Text style={s.kill}>Quitar del listado</Text>
              </Pressable>
            ) : null}
          </Pressable>
        ))}

        {!loading && items.length === 0 ? <Text style={s.sub}>Nada en marcha.</Text> : null}

        <Pressable
          style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]}
          onPress={() => load(dir)}>
          <Sym name="arrow.clockwise" size={14} color={t.ink} />
          <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={!!output} transparent animationType="slide" onRequestClose={() => setOutput(null)}>
        <View style={s.textRoot}>
          <Pressable style={s.backdrop} onPress={() => setOutput(null)} />
          <View style={s.textCard}>
            <Text style={s.textName} numberOfLines={1}>
              {output?.name}
            </Text>
            <ScrollView style={{ maxHeight: 440 }}>
              <Text style={s.textBody} selectable>
                {output?.body}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
    sub: { color: t.dim, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      padding: 12,
      gap: 4,
      marginBottom: 8,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    cmd: { color: t.textSoft, fontSize: 12.5, fontFamily: 'Courier', flex: 1 },
    meta: { color: t.dimSoft, fontSize: 11 },
    mono: { color: t.dimSoft, fontSize: 10.5, fontFamily: 'Courier' },
    kill: { color: '#fca5a5', fontSize: 11.5, marginTop: 2 },
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
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
    textRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
    textCard: {
      backgroundColor: t.panel2,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      padding: 16,
      paddingBottom: 30,
    },
    textName: { color: t.text, fontSize: 13.5, fontWeight: '700', marginBottom: 10, fontFamily: 'Courier' },
    textBody: { color: t.textSoft, fontSize: 11, fontFamily: 'Courier', lineHeight: 15 },
  });
