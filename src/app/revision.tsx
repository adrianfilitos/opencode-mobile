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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  REVIEW_DIR,
  collectShownFiles,
  fileAccess,
  fileUrl,
  getMessages,
  getSessionDiff,
  listDir,
  readFileText,
  type DirEntry,
  type FileDiff,
  type ShownFile,
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

function isImage(name: string, mime?: string): boolean {
  if (/\.svg$/i.test(name)) return false; // RN no pinta SVG
  return (mime ?? '').startsWith('image/') || IMG_RE.test(name);
}

type Access = { base: string; headers: Record<string, string> } | null;

export default function RevisionScreen() {
  const s = useStyles();
  const t = usePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [access, setAccess] = useState<Access>(null);
  const [shown, setShown] = useState<ShownFile[]>([]);
  const [folder, setFolder] = useState<DirEntry[]>([]);
  const [diff, setDiff] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState<{ name: string; body: string } | null>(null);
  const [textBusy, setTextBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccess(await fileAccess());
      const [files, entries] = await Promise.all([
        listDir(REVIEW_DIR).catch(() => [] as DirEntry[]),
        id
          ? getMessages(id, { limit: 60, order: 'desc' })
              .then((p) => collectShownFiles(p.data))
              .catch(() => [] as ShownFile[])
          : Promise.resolve([] as ShownFile[]),
      ]);
      setFolder(files);
      setShown(entries);
      if (id) {
        try {
          setDiff(await getSessionDiff(id));
        } catch {
          setDiff([]);
        }
      }
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

  async function openText(name: string, path: string) {
    setTextBusy(true);
    haptic('select');
    try {
      const body = await readFileText(path);
      setText({ name, body: body.slice(0, 20000) });
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTextBusy(false);
    }
  }

  const Thumb = ({ name, path, mime }: { name: string; path: string; mime?: string }) => {
    if (isImage(name, mime) && access) {
      return (
        <Pressable
          style={s.thumbWrap}
          onPress={() => {
            haptic('tap');
            setImage(fileUrl(access.base, path));
          }}>
          <Image
            source={{ uri: fileUrl(access.base, path), headers: access.headers }}
            style={s.thumb}
            resizeMode="cover"
          />
        </Pressable>
      );
    }
    return (
      <Pressable style={s.fileChip} onPress={() => openText(name, path)}>
        <Sym name="doc.text" size={14} color={t.dim} />
        <Text style={s.fileChipText} numberOfLines={1}>
          {name}
        </Text>
        {textBusy ? <ActivityIndicator size="small" color={t.dim} /> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Revisión',
          headerStyle: { backgroundColor: t.bg },
          headerTitleStyle: { color: t.text, fontSize: 16 },
          headerTintColor: t.dim,
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator color={t.accent} style={{ marginVertical: 18 }} /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}

        <Text style={s.section}>El agente muestra · {folder.length}</Text>
        <Text style={s.hint}>
          Lo que el agente deja en la carpeta de revisión para que lo veas desde el móvil.
        </Text>
        {!loading && folder.length === 0 ? (
          <Text style={s.empty}>Nada todavía.</Text>
        ) : (
          <View style={s.grid}>
            {folder.map((f) =>
              f.type === 'directory' ? null : (
                <Thumb key={f.path} name={f.name} path={f.path} />
              )
            )}
          </View>
        )}

        {shown.length > 0 ? (
          <>
            <Text style={s.section}>Ficheros de las herramientas · {shown.length}</Text>
            <View style={s.grid}>
              {shown.map((f) => (
                <Thumb key={f.path} name={f.name ?? f.path.split('/').pop() ?? ''} path={f.path} mime={f.mime} />
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.section}>Cambios en la sesión · {diff.length}</Text>
        {!loading && diff.length === 0 ? (
          <Text style={s.empty}>Sin cambios.</Text>
        ) : (
          diff.map((d) => (
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
                .slice(0, 24)
                .map((l, i) => (
                  <Text
                    key={i}
                    style={[s.diffLine, l.startsWith('+') && s.add, l.startsWith('-') && s.del]}>
                    {l || ' '}
                  </Text>
                ))}
            </View>
          ))
        )}

        <Pressable style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }]} onPress={load}>
          <Sym name="arrow.clockwise" size={14} color={t.ink} />
          <Text style={[s.btnText, { color: t.ink }]}>Actualizar</Text>
        </Pressable>
      </ScrollView>

      {/* imagen a pantalla completa */}
      <Modal visible={!!image} transparent animationType="fade" onRequestClose={() => setImage(null)}>
        <Pressable style={s.fullRoot} onPress={() => setImage(null)}>
          {image ? <Image source={{ uri: image, headers: access?.headers }} style={s.fullImg} resizeMode="contain" /> : null}
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
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 30 },
    section: { color: t.text, fontSize: 13.5, fontWeight: '700', marginTop: 20, marginBottom: 6 },
    hint: { color: t.dimSoft, fontSize: 11.5, lineHeight: 16, marginBottom: 10 },
    empty: { color: t.dimSoft, fontSize: 12.5, paddingVertical: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    thumbWrap: {
      width: 104,
      height: 104,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
    },
    thumb: { width: '100%', height: '100%' },
    fileChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 11,
      paddingVertical: 11,
      maxWidth: '100%',
    },
    fileChipText: { color: t.textSoft, fontSize: 12.5, flexShrink: 1 },
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
    error: { color: '#fca5a5', fontSize: 12, marginTop: 8 },
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
