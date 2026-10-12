import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  createWorktree,
  getProjects,
  getWorktrees,
  refreshWorktrees,
  removeWorktree,
  type Worktree,
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

export default function WorktreesScreen() {
  const s = useStyles();
  const t = usePalette();
  const [projectID, setProjectID] = useState<string | null>(null);
  const [items, setItems] = useState<Worktree[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      setItems(await getWorktrees(pid));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getProjects()
      .then((p) => {
        const id = p[0]?.id ?? null;
        setProjectID(id);
        if (id) load(id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [load]);

  async function create() {
    if (!projectID || !draft.trim()) return;
    setBusy(true);
    try {
      await createWorktree(projectID, { branch: draft.trim(), name: draft.trim() });
      haptic('success');
      setDraft('');
      await refreshWorktrees(projectID).catch(() => {});
      await load(projectID);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(w: Worktree) {
    if (!projectID || !w.directory) return;
    Alert.alert('Quitar worktree', w.directory, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeWorktree(projectID, w.directory as string, true);
            haptic('warning');
            await load(projectID);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Worktrees',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontSize: 16 },
          headerTintColor: t.dim,
          headerShadowVisible: false,
        }}
      />

      <Text style={s.sub}>
        Copias del proyecto en paralelo para trabajar en varias ramas a la vez.
      </Text>

      {loading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {items.map((w) => (
        <View key={w.directory ?? w.name} style={s.card}>
          <View style={s.cardTop}>
            <Sym name="arrow.triangle.branch" size={15} color={t.accent} />
            <Text style={s.name} numberOfLines={1}>
              {w.name ?? w.branch ?? w.directory}
            </Text>
            <Pressable hitSlop={8} onPress={() => confirmRemove(w)}>
              <Text style={s.remove}>Quitar</Text>
            </Pressable>
          </View>
          {w.branch ? <Text style={s.branch}>rama {w.branch}</Text> : null}
          {w.directory ? (
            <Text style={s.mono} numberOfLines={1}>
              {w.directory}
            </Text>
          ) : null}
        </View>
      ))}
      {!loading && items.length === 0 ? <Text style={s.sub}>Ningún worktree listado.</Text> : null}

      <Text style={s.section}>Crear</Text>
      <View style={s.addRow}>
        <TextInput
          style={s.input}
          placeholder="nombre / rama…"
          placeholderTextColor={t.dimSoft}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[s.addBtn, { backgroundColor: t.accent, borderColor: t.accent }, busy && { opacity: 0.6 }]}
          disabled={busy || !draft.trim()}
          onPress={create}>
          {busy ? <ActivityIndicator size="small" color={t.ink} /> : <Text style={[s.addText, { color: t.ink }]}>Crear</Text>}
        </Pressable>
      </View>

      <Pressable
        style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]}
        onPress={() => projectID && load(projectID)}>
        <Sym name="arrow.clockwise" size={14} color={t.ink} />
        <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
    sub: { color: t.dim, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      padding: 12,
      gap: 3,
      marginBottom: 8,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { color: t.text, fontSize: 13.5, fontWeight: '600', flex: 1 },
    remove: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
    branch: { color: t.dim, fontSize: 11.5 },
    mono: { color: t.dimSoft, fontSize: 11, fontFamily: 'Courier' },
    section: { color: t.text, fontSize: 13.5, fontWeight: '700', marginTop: 18, marginBottom: 8 },
    addRow: { flexDirection: 'row', gap: 8 },
    input: {
      flex: 1,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.text,
      fontSize: 13,
    },
    addBtn: {
      borderRadius: 11,
      paddingHorizontal: 18,
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    addText: { fontSize: 13, fontWeight: '700' },
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
  });
