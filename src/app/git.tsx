import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getLocation,
  getProjects,
  getVcsBranches,
  getVcsDiff,
  getVcsStatus,
  vcsInit,
  type FileDiff,
  type VcsBranch,
  type VcsStatus,
} from '@/lib/api';
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

const LETTER: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
  conflicted: 'U',
};

function letterColor(st: string | undefined, t: Palette): string {
  if (st === 'added' || st === 'untracked') return t.ok;
  if (st === 'deleted' || st === 'conflicted') return '#fca5a5';
  return t.warn;
}

export default function GitScreen() {
  const s = useStyles();
  const t = usePalette();
  const { dir } = useLocalSearchParams<{ dir?: string }>();

  const [root, setRoot] = useState<string | null>(dir ?? null);
  const [status, setStatus] = useState<VcsStatus[]>([]);
  const [branches, setBranches] = useState<VcsBranch[]>([]);
  const [diff, setDiff] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: string | null) => {
    setLoading(true);
    try {
      const [st, br, df] = await Promise.all([
        getVcsStatus(d ?? undefined).catch(() => []),
        getVcsBranches(d ?? undefined).catch(() => []),
        getVcsDiff(d ?? undefined).catch(() => []),
      ]);
      setStatus(st);
      setBranches(br);
      setDiff(df);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (root) {
      load(root);
      return;
    }
    Promise.all([getProjects().catch(() => []), getLocation().catch(() => null)])
      .then(([projs, loc]) => {
        const base = projs[0]?.canonical ?? loc?.project?.canonical ?? loc?.directory ?? null;
        setRoot(base);
      })
      .catch(() => setLoading(false));
  }, [root, load]);

  async function init() {
    setBusy(true);
    try {
      await vcsInit(root ?? undefined);
      haptic('success');
      await load(root);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const current = branches.find((b) => b.current)?.name ?? branches[0]?.name;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Git',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontSize: 16 },
          headerTintColor: t.dim,
          headerShadowVisible: false,
        }}
      />

      {loading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.card}>
        <View style={s.rowHead}>
          <Sym name="arrow.triangle.branch" size={15} color={t.accent} />
          <Text style={s.branch}>{current ?? 'sin rama'}</Text>
        </View>
        <Text style={s.sub}>
          {status.length === 0
            ? 'Sin cambios pendientes.'
            : `${status.length} cambio${status.length === 1 ? '' : 's'} sin guardar`}
        </Text>
        {root ? (
          <Text style={s.mono} numberOfLines={1}>
            {root}
          </Text>
        ) : null}
      </View>

      {status.length > 0 ? (
        <>
          <Text style={s.section}>Estado</Text>
          {status.map((e, i) => {
            const st = (e.status ?? '').toLowerCase().replace('modified', 'modified');
            return (
              <View key={`${e.path}-${i}`} style={s.fileRow}>
                <Text style={[s.letter, { color: letterColor(st, t) }]}>{LETTER[st] ?? '·'}</Text>
                <Text style={s.filePath} numberOfLines={1}>
                  {e.path}
                </Text>
                {e.staged ? <Text style={s.staged}>staged</Text> : null}
              </View>
            );
          })}
        </>
      ) : null}

      {diff.length > 0 ? (
        <>
          <Text style={s.section}>Diff</Text>
          {diff.map((d) => (
            <View key={d.file} style={s.diffBox}>
              <View style={s.diffHead}>
                <Text style={s.diffFile} numberOfLines={1}>
                  {d.file}
                </Text>
                <Text style={s.diffMeta}>
                  +{d.additions} −{d.deletions}
                </Text>
              </View>
              {d.patch
                .split('\n')
                .slice(0, 22)
                .map((l, i) => (
                  <Text
                    key={i}
                    style={[s.diffLine, l.startsWith('+') && s.add, l.startsWith('-') && s.del]}>
                    {l || ' '}
                  </Text>
                ))}
            </View>
          ))}
        </>
      ) : null}

      <View style={s.btns}>
        <Pressable
          style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]}
          onPress={() => load(root)}>
          <Sym name="arrow.clockwise" size={14} color={t.ink} />
          <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
        </Pressable>
        {status.length === 0 && diff.length === 0 ? (
          <Pressable style={[s.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={init}>
            {busy ? (
              <ActivityIndicator size="small" color={t.textSoft} />
            ) : (
              <Text style={s.btnText}>Iniciar repo</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      <Text style={s.note}>
        Solo lectura + iniciar repositorio. Para commit/push, pídeselo al agente desde el chat.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    branch: { color: t.text, fontSize: 14, fontWeight: '700' },
    sub: { color: t.dim, fontSize: 12 },
    mono: { color: t.dimSoft, fontSize: 11, fontFamily: 'Courier' },
    section: { color: t.text, fontSize: 13.5, fontWeight: '700', marginTop: 18, marginBottom: 6 },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    letter: { fontSize: 12.5, fontWeight: '800', width: 14, textAlign: 'center' },
    filePath: { color: t.textSoft, fontSize: 12, fontFamily: 'Courier', flex: 1 },
    staged: { color: t.ok, fontSize: 10, fontWeight: '700' },
    diffBox: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      overflow: 'hidden',
      marginBottom: 8,
    },
    diffHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.line,
    },
    diffFile: { color: t.textSoft, fontSize: 11.5, flex: 1, fontFamily: 'Courier' },
    diffMeta: { color: t.dimSoft, fontSize: 11 },
    diffLine: { fontFamily: 'Courier', fontSize: 11, paddingHorizontal: 10, paddingVertical: 1, color: t.textSoft },
    add: { color: '#a7f3c4', backgroundColor: 'rgba(74,222,128,0.10)' },
    del: { color: '#fca5a5', backgroundColor: 'rgba(248,113,113,0.10)' },
    btns: { flexDirection: 'row', gap: 8, marginTop: 18 },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingVertical: 12,
    },
    btnText: { color: t.textSoft, fontSize: 13.5, fontWeight: '600' },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 12 },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
  });
