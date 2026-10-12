import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  findFiles,
  getLocation,
  getProjects,
  listDir,
  readFileText,
  fileAccess,
  fileUrl,
  type FsEntry,
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

const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|heic)$/i;
const isImage = (name: string) => !/\.svg$/i.test(name) && IMG_RE.test(name);

function shortPath(root: string, p: string): string {
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const q = p.replace(/\\/g, '/');
  return q.startsWith(r) ? q.slice(r.length).replace(/^\//, '') || '/' : q;
}

export default function FicherosScreen() {
  const s = useStyles();
  const t = usePalette();
  const { dir } = useLocalSearchParams<{ dir?: string }>();

  const [root, setRoot] = useState<string | null>(dir ?? null);
  const [cwd, setCwd] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; canonical: string }[]>([]);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FsEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<{ base: string; headers: Record<string, string> } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState<{ name: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // raíz: el param, o el primer proyecto, o la ubicación del servidor
  useEffect(() => {
    if (root) return;
    Promise.all([getProjects().catch(() => []), getLocation().catch(() => null)])
      .then(([projs, loc]) => {
        setProjects(projs);
        const first = projs[0]?.canonical;
        const base = first ?? loc?.project?.canonical ?? loc?.directory ?? null;
        setRoot(base);
        setCwd(base);
      })
      .catch(() => setLoading(false));
    fileAccess().then(setAccess).catch(() => {});
  }, [root]);

  useEffect(() => {
    if (cwd) fileAccess().then(setAccess).catch(() => {});
  }, [cwd]);

  const open = useCallback(async (p: string) => {
    setLoading(true);
    try {
      setEntries(await listDir(p));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cwd) open(cwd);
  }, [cwd, open]);

  async function search() {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setBusy(true);
    try {
      const r = await findFiles(q, { directory: root ?? undefined, limit: 60 });
      setResults(r.entries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openFile(e: FsEntry) {
    haptic('tap');
    if (e.type === 'directory') {
      setResults(null);
      setQuery('');
      setCwd(e.abs);
      return;
    }
    if (isImage(e.name) && access) {
      setImage(fileUrl(access.base, e.abs));
      return;
    }
    setBusy(true);
    try {
      const body = await readFileText(e.abs);
      setText({ name: e.name, body: body.slice(0, 30000) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function goUp() {
    if (!cwd || !root) return;
    const parts = cwd.replace(/\\/g, '/').split('/');
    if (parts.length <= 1) return;
    parts.pop();
    const up = parts.join('/');
    if (up.length >= root.replace(/\\/g, '/').length) setCwd(up);
  }

  const shown = results ?? entries;

  return (
    <View style={s.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Ficheros',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontSize: 16 },
          headerTintColor: t.dim,
          headerShadowVisible: false,
        }}
      />
      <View style={s.searchRow}>
        <TextInput
          style={s.search}
          placeholder="Buscar fichero…"
          placeholderTextColor={t.dimSoft}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable
            style={s.searchBtn}
            onPress={() => {
              setQuery('');
              setResults(null);
            }}>
            <Sym name="xmark" size={14} color={t.dim} />
          </Pressable>
        ) : null}
      </View>

      {projects.length > 1 && cwd && root ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.projRow}>
          {projects.map((p) => {
            const on = cwd.replace(/\\/g, '/').startsWith(p.canonical.replace(/\\/g, '/'));
            return (
              <Pressable
                key={p.id}
                style={[s.projChip, on && { backgroundColor: t.accent, borderColor: t.accent }]}
                onPress={() => {
                  haptic('select');
                  setResults(null);
                  setQuery('');
                  setRoot(p.canonical);
                  setCwd(p.canonical);
                }}>
                <Text
                  style={[s.projText, on && { color: t.ink, fontWeight: '700' }]}
                  numberOfLines={1}>
                  {p.canonical.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p.canonical}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {results === null && cwd ? (
        <View style={s.crumbRow}>
          <Pressable hitSlop={8} onPress={goUp} style={s.upBtn}>
            <Sym name="arrow.up" size={12} color={t.dim} />
            <Text style={s.upText}>subir</Text>
          </Pressable>
          <Text style={s.crumb} numberOfLines={1}>
            {root ? shortPath(root, cwd) : cwd}
          </Text>
        </View>
      ) : null}

      {busy ? <ActivityIndicator color={t.accent} style={{ marginVertical: 10 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <ScrollView contentContainerStyle={s.list}>
        {results !== null ? (
          <Text style={s.hint}>
            {results.length} resultado{results.length === 1 ? '' : 's'} para «{query.trim()}»
          </Text>
        ) : null}

        {loading && shown.length === 0 ? (
          <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} />
        ) : null}

        {shown.map((e) => (
          <Pressable key={e.abs} style={s.row} onPress={() => openFile(e)}>
            <Sym
              name={
                e.type === 'directory'
                  ? 'folder'
                  : isImage(e.name)
                    ? 'photo'
                    : 'doc.text'
              }
              size={15}
              color={e.type === 'directory' ? t.accent : t.dim}
            />
            <Text style={s.rowName} numberOfLines={1}>
              {e.name}
            </Text>
            {e.type === 'directory' ? <Sym name="chevron.right" size={12} color={t.dimSoft} /> : null}
          </Pressable>
        ))}

        {!loading && shown.length === 0 ? (
          <Text style={s.hint}>{results !== null ? 'Sin resultados.' : 'Carpeta vacía.'}</Text>
        ) : null}
      </ScrollView>

      {/* imagen a pantalla completa */}
      <Modal visible={!!image} transparent animationType="fade" onRequestClose={() => setImage(null)}>
        <Pressable style={s.fullRoot} onPress={() => setImage(null)}>
          {image ? (
            <Image source={{ uri: image, headers: access?.headers }} style={s.fullImg} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>

      {/* texto */}
      <Modal visible={!!text} transparent animationType="slide" onRequestClose={() => setText(null)}>
        <View style={s.textRoot}>
          <Pressable style={s.backdrop} onPress={() => setText(null)} />
          <View style={s.textCard}>
            <Text style={s.textName} numberOfLines={1}>
              {text?.name}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={s.textBody} selectable>
                {text?.body}
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
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 8 },
    search: {
      flex: 1,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 13,
      paddingVertical: 10,
      color: t.text,
      fontSize: 13.5,
    },
    searchBtn: { padding: 8 },
    projRow: { gap: 7, paddingHorizontal: 14, paddingTop: 9 },
    projChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      maxWidth: 180,
    },
    projText: { color: t.textSoft, fontSize: 12 },
    crumbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
    upBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    upText: { color: t.dim, fontSize: 12 },
    crumb: { color: t.dimSoft, fontSize: 11.5, fontFamily: 'Courier', flex: 1 },
    list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 30 },
    hint: { color: t.dimSoft, fontSize: 11.5, marginBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    rowName: { color: t.textSoft, fontSize: 12.5, flex: 1 },
    error: { color: '#fca5a5', fontSize: 12, paddingHorizontal: 16, marginTop: 8 },
    fullRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    fullImg: { width: '100%', height: '80%' },
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
    textName: { color: t.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
    textBody: { color: t.textSoft, fontSize: 11.5, fontFamily: 'Courier', lineHeight: 16 },
  });
