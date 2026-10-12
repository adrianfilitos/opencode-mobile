import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { checkPluginUpdates, getPlugins, pluginWhere, updatePlugins, type PluginInfo } from '@/lib/api';
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

function statusColor(status: string | undefined, t: Palette): string {
  if (status === 'active') return t.ok;
  if (status === 'failed') return '#fca5a5';
  return t.dim;
}

/** Una fila de la lista de plugins. */
function PluginRow({ p }: { p: PluginInfo }) {
  const s = useStyles();
  const t = usePalette();
  const st = p.state?.status;
  const color = statusColor(st, t);
  return (
    <View style={s.row}>
      <Sym
        name={st === 'failed' ? 'exclamationmark.triangle.fill' : 'puzzlepiece.extension'}
        size={14}
        color={color}
      />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {p.id}
        </Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {pluginWhere(p) || '—'}
          {p.state?.error ? ` · ${p.state.error}` : ''}
        </Text>
      </View>
      {p.source?.outdated ? (
        <View style={[s.badge, { borderColor: t.warnLine }]}>
          <Text style={[s.badgeText, { color: t.warn }]}>actualizable</Text>
        </View>
      ) : (
        <Text style={[s.badgeText, { color }]}>{st ?? ''}</Text>
      )}
    </View>
  );
}

export default function PluginsScreen() {
  const s = useStyles();
  const t = usePalette();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'check' | 'update' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBuiltins, setShowBuiltins] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlugins(await getPlugins());
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

  async function check() {
    setBusy('check');
    try {
      setPlugins(await checkPluginUpdates());
      haptic('select');
      setError(null);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function update() {
    setBusy('update');
    try {
      setPlugins(await updatePlugins());
      haptic('success');
      setError(null);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const builtins = plugins.filter((p) => p.source?.type === 'builtin');
  const external = plugins.filter((p) => p.source?.type !== 'builtin');
  const outdated = plugins.filter((p) => p.source?.outdated).length;
  const failed = plugins.filter((p) => p.state?.status === 'failed').length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Plugins' }} />

      {loading && plugins.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={s.summary}>
        {plugins.length} plugins · {outdated} por actualizar
        {failed > 0 ? ` · ${failed} con fallos` : ''}
      </Text>

      <View style={s.buttons}>
        <Pressable
          style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }, busy && { opacity: 0.6 }]}
          onPress={check}
          disabled={!!busy}>
          {busy === 'check' ? (
            <ActivityIndicator size="small" color={t.ink} />
          ) : (
            <>
              <Sym name="arrow.triangle.2.circlepath" size={14} color={t.ink} />
              <Text style={[s.btnText, { color: t.ink }]}>Buscar actualizaciones</Text>
            </>
          )}
        </Pressable>
        <Pressable
          style={[s.btn, outdated === 0 && { opacity: 0.5 }, busy && { opacity: 0.6 }]}
          onPress={update}
          disabled={!!busy || outdated === 0}>
          {busy === 'update' ? (
            <ActivityIndicator size="small" color={t.textSoft} />
          ) : (
            <Text style={s.btnText}>Actualizar</Text>
          )}
        </Pressable>
      </View>

      <Text style={s.section}>De paquete o locales · {external.length}</Text>
      {external.length === 0 ? (
        <Text style={s.empty}>Solo hay plugins integrados.</Text>
      ) : (
        external.map((p) => <PluginRow key={p.id} p={p} />)
      )}

      <Pressable
        style={s.toggle}
        onPress={() => {
          haptic('tap');
          setShowBuiltins((v) => !v);
        }}>
        <Text style={[s.toggleText, { color: t.accent }]}>
          {showBuiltins ? '▾ Ocultar' : '▸ Ver'} {builtins.length} integrados
        </Text>
      </Pressable>
      {showBuiltins ? builtins.map((p) => <PluginRow key={p.id} p={p} />) : null}
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
    summary: { color: t.textSoft, fontSize: 13, marginBottom: 12 },
    buttons: { flexDirection: 'row', gap: 8, marginBottom: 6 },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 11,
    },
    btnText: { color: t.textSoft, fontSize: 13, fontWeight: '600' },
    section: { color: t.text, fontSize: 13.5, fontWeight: '700', marginTop: 20, marginBottom: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    rowTitle: { color: t.textSoft, fontSize: 12.5, fontFamily: 'Courier' },
    rowSub: { color: t.dim, fontSize: 11.5, marginTop: 2 },
    badge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 10.5, fontWeight: '600' },
    empty: { color: t.dimSoft, fontSize: 12.5, paddingVertical: 6 },
    toggle: { paddingVertical: 14 },
    toggleText: { fontSize: 12.5, fontWeight: '600' },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
  });
