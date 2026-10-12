import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { connectMcp, disconnectMcp, getMcpServers, removeMcp, type McpServer } from '@/lib/api';
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

const LABEL: Record<string, string> = {
  connected: 'conectado',
  pending: 'pendiente',
  disabled: 'desactivado',
  failed: 'fallo',
  needs_auth: 'falta autenticación',
};

export default function McpScreen() {
  const s = useStyles();
  const t = usePalette();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await getMcpServers());
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

  async function act(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    try {
      await fn();
      haptic('success');
      setError(null);
      await load();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(name: string) {
    Alert.alert('Quitar servidor MCP', `¿Quitar «${name}» de la configuración?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => act(name, () => removeMcp(name)),
      },
    ]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'MCP' }} />

      {loading && servers.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {!loading && servers.length === 0 ? (
        <View style={s.emptyBox}>
          <Sym name="server.rack" size={26} color={t.dimSoft} />
          <Text style={s.emptyTitle}>Sin servidores MCP</Text>
          <Text style={s.emptySub}>
            Añádelos en el PC (opencode.json → «mcp»). Aquí aparecerán para conectar, desconectar o
            quitarlos.
          </Text>
        </View>
      ) : null}

      {servers.map((m) => {
        const st = m.status?.status ?? 'unknown';
        const color =
          st === 'connected' ? t.ok : st === 'failed' || st === 'needs_auth' ? '#fca5a5' : t.warn;
        return (
          <View key={m.name} style={s.card}>
            <View style={s.cardTop}>
              <Sym name="server.rack" size={15} color={color} />
              <Text style={s.cardTitle} numberOfLines={1}>
                {m.name}
              </Text>
              <View style={[s.badge, { borderColor: color }]}>
                <Text style={[s.badgeText, { color }]}>{LABEL[st] ?? st}</Text>
              </View>
            </View>
            {m.status?.error ? <Text style={s.err2}>{m.status.error}</Text> : null}
            <View style={s.actions}>
              <Pressable
                style={[s.act, { backgroundColor: t.accent, borderColor: t.accent }, busy === m.name && { opacity: 0.6 }]}
                disabled={busy === m.name}
                onPress={() => act(m.name, () => connectMcp(m.name))}>
                {busy === m.name ? (
                  <ActivityIndicator size="small" color={t.ink} />
                ) : (
                  <Text style={[s.actText, { color: t.ink }]}>Conectar</Text>
                )}
              </Pressable>
              <Pressable
                style={[s.act, busy === m.name && { opacity: 0.6 }]}
                disabled={busy === m.name}
                onPress={() => act(m.name, () => disconnectMcp(m.name))}>
                <Text style={s.actText}>Desconectar</Text>
              </Pressable>
              <Pressable style={s.act} onPress={() => confirmRemove(m.name)}>
                <Text style={[s.actText, { color: '#fca5a5' }]}>Quitar</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

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
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      gap: 8,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: t.text, fontSize: 13.5, fontWeight: '600', flex: 1 },
    badge: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 10.5, fontWeight: '600' },
    err2: { color: '#fca5a5', fontSize: 11.5 },
    actions: { flexDirection: 'row', gap: 8 },
    act: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 9,
      paddingHorizontal: 13,
      paddingVertical: 8,
      minWidth: 84,
      alignItems: 'center',
    },
    actText: { color: t.textSoft, fontSize: 12, fontWeight: '600' },
    emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 46, paddingHorizontal: 20 },
    emptyTitle: { color: t.text, fontSize: 15, fontWeight: '700' },
    emptySub: { color: t.dim, fontSize: 12.5, textAlign: 'center', lineHeight: 18, maxWidth: 280 },
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
  });
