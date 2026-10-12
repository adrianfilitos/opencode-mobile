import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  clearRevert,
  commitRevert,
  getMessages,
  getSession,
  stageRevert,
  type Msg,
  type Session,
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

function when(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function RevertScreen() {
  const s = useStyles();
  const t = usePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [session, setSession] = useState<Session | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [ses, page] = await Promise.all([
        getSession(id).catch(() => null),
        getMessages(id, { limit: 30, order: 'desc' }).catch(() => null),
      ]);
      setSession(ses);
      setMsgs(page ? [...page.data] : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const staged = session?.revert;
  const stagedFiles = staged?.files ?? [];

  async function stage(messageID: string) {
    if (!id) return;
    setBusy(messageID);
    try {
      await stageRevert(id, messageID);
      haptic('success');
      await load();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function confirmCommit() {
    Alert.alert(
      'Revertir cambios',
      `Se desharán los cambios posteriores a ese punto (${stagedFiles.length} fichero${stagedFiles.length === 1 ? '' : 's'}).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revertir',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setBusy('commit');
            try {
              await commitRevert(id);
              haptic('success');
              await load();
            } catch (e) {
              haptic('error');
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  async function discard() {
    if (!id) return;
    setBusy('clear');
    try {
      await clearRevert(id);
      haptic('tap');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Deshacer',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontSize: 16 },
          headerTintColor: t.dim,
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={s.content}>
        {loading && !session ? <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        {staged ? (
          <View style={s.stagedCard}>
            <View style={s.stagedHead}>
              <Sym name="arrow.uturn.backward" size={15} color={t.accent} />
              <Text style={s.stagedTitle}>Punto elegido</Text>
              <Text style={s.mono}>{staged.messageID?.slice(-8)}</Text>
            </View>
            {stagedFiles.length === 0 ? (
              <Text style={s.sub}>Sin cambios de fichero en ese tramo (solo historial).</Text>
            ) : (
              stagedFiles.map((f) => (
                <View key={f.file} style={s.fileRow}>
                  <Text style={s.fileName} numberOfLines={1}>
                    {f.file}
                  </Text>
                  <Text style={s.fileMeta}>
                    +{f.additions} −{f.deletions}
                  </Text>
                </View>
              ))
            )}
            <View style={s.btns}>
              <Pressable
                style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }, busy === 'commit' && { opacity: 0.6 }]}
                disabled={!!busy}
                onPress={confirmCommit}>
                {busy === 'commit' ? (
                  <ActivityIndicator size="small" color={t.ink} />
                ) : (
                  <Text style={[s.btnText, { color: t.ink }]}>Revertir</Text>
                )}
              </Pressable>
              <Pressable style={[s.btn, busy === 'clear' && { opacity: 0.6 }]} disabled={!!busy} onPress={discard}>
                <Text style={s.btnText}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={s.sub}>
            Elige hasta dónde quieres volver. Toca un mensaje: se marca el punto y luego podrás
            revertir. Nada se borra de la conversación.
          </Text>
        )}

        <Text style={s.section}>Mensajes</Text>
        {msgs.map((m) => {
          const isStaged = staged?.messageID === m.id;
          const who = m.type === 'user' ? 'tú' : (m.agent ?? 'agente');
          return (
            <Pressable
              key={m.id}
              style={[s.msgRow, isStaged && { borderColor: t.accent, backgroundColor: t.panel }]}
              disabled={!!busy}
              onPress={() => stage(m.id)}>
              <Sym
                name={m.type === 'user' ? 'person' : 'cpu'}
                size={13}
                color={isStaged ? t.accent : t.dim}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.msgWho} numberOfLines={1}>
                  {who} · {when(m.time?.created)}
                </Text>
                <Text style={s.msgText} numberOfLines={2}>
                  {m.text?.trim() || (m.content ?? []).map((p) => p.text ?? '').join(' ').trim() || '—'}
                </Text>
              </View>
              {busy === m.id ? (
                <ActivityIndicator size="small" color={t.dim} />
              ) : isStaged ? (
                <Sym name="checkmark.circle.fill" size={16} color={t.accent} />
              ) : (
                <Sym name="arrow.uturn.backward" size={13} color={t.dimSoft} />
              )}
            </Pressable>
          );
        })}
        {!loading && msgs.length === 0 ? <Text style={s.sub}>Sin mensajes.</Text> : null}

        <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={load}>
          <Sym name="arrow.clockwise" size={14} color={t.ink} />
          <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
    section: { color: t.text, fontSize: 13.5, fontWeight: '700', marginTop: 20, marginBottom: 8 },
    sub: { color: t.dim, fontSize: 12.5, lineHeight: 18 },
    stagedCard: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.accent,
      borderRadius: 13,
      padding: 12,
      gap: 6,
    },
    stagedHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    stagedTitle: { color: t.text, fontSize: 13.5, fontWeight: '700', flex: 1 },
    mono: { color: t.dimSoft, fontFamily: 'Courier', fontSize: 11 },
    fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fileName: { color: t.textSoft, fontSize: 11.5, fontFamily: 'Courier', flex: 1 },
    fileMeta: { color: t.dimSoft, fontSize: 11 },
    btns: { flexDirection: 'row', gap: 8, marginTop: 8 },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingVertical: 11,
      marginTop: 6,
    },
    btnText: { color: t.textSoft, fontSize: 13.5, fontWeight: '600' },
    msgRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 11,
      paddingVertical: 10,
      marginBottom: 7,
    },
    msgWho: { color: t.dim, fontSize: 11 },
    msgText: { color: t.textSoft, fontSize: 12.5, marginTop: 2 },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
  });
