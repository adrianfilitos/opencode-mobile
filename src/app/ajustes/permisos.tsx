import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getSavedPermissions,
  removeSavedPermission,
  type SavedPermission,
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

function shortProject(id?: string) {
  if (!id) return '';
  return id.replace(/^prj_/, '').slice(0, 8);
}

export default function PermisosScreen() {
  const s = useStyles();
  const t = usePalette();
  const [items, setItems] = useState<SavedPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getSavedPermissions());
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

  function confirmRemove(p: SavedPermission) {
    Alert.alert(
      'Quitar permiso',
      `¿Dejar de permitir siempre «${p.action}» sobre ${p.resource}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            setBusyId(p.id);
            try {
              await removeSavedPermission(p.id);
              setItems((list) => list.filter((x) => x.id !== p.id));
              haptic('warning');
            } catch (e) {
              haptic('error');
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Permisos guardados' }} />

      {loading && items.length === 0 ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {!loading && items.length === 0 ? (
        <View style={s.emptyBox}>
          <Sym name="checkmark.shield" size={26} color={t.dimSoft} />
          <Text style={s.emptyTitle}>Nada guardado</Text>
          <Text style={s.emptySub}>
            Cuando respondas «Siempre» a un permiso, aparecerá aquí para poder quitarlo.
          </Text>
        </View>
      ) : null}

      {items.map((p) => (
        <View key={p.id} style={s.card}>
          <View style={s.cardTop}>
            <Sym name="checkmark.shield.fill" size={15} color={t.ok} />
            <Text style={s.cardTitle} numberOfLines={1}>
              {p.action}
            </Text>
            <Pressable
              hitSlop={8}
              style={[s.remove, busyId === p.id && { opacity: 0.5 }]}
              disabled={busyId === p.id}
              onPress={() => confirmRemove(p)}>
              {busyId === p.id ? (
                <ActivityIndicator size="small" color="#fca5a5" />
              ) : (
                <Text style={s.removeText}>Quitar</Text>
              )}
            </Pressable>
          </View>
          <Text style={s.mono} numberOfLines={1}>
            {p.resource}
          </Text>
          {p.projectID ? <Text style={s.sub}>proyecto {shortProject(p.projectID)}</Text> : null}
        </View>
      ))}

      <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={load}>
        <Sym name="arrow.clockwise" size={14} color={t.ink} />
        <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
      </Pressable>
      <Text style={s.note}>
        «Siempre» en un permiso guarda una regla permanente en el servidor. Aquí puedes revocarla.
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
      gap: 4,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { color: t.text, fontSize: 13.5, fontWeight: '600', flex: 1 },
    mono: { color: t.textSoft, fontSize: 11.5, fontFamily: 'Courier' },
    sub: { color: t.dimSoft, fontSize: 11 },
    remove: { paddingHorizontal: 4 },
    removeText: { color: '#fca5a5', fontSize: 12.5, fontWeight: '600' },
    emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 50, paddingHorizontal: 20 },
    emptyTitle: { color: t.text, fontSize: 15, fontWeight: '700' },
    emptySub: { color: t.dim, fontSize: 12.5, textAlign: 'center', lineHeight: 18, maxWidth: 260 },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 12,
      marginTop: 16,
    },
    btnText: { fontSize: 13.5, fontWeight: '700' },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 12 },
  });
