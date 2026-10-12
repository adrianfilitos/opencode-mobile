import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Palette } from '@/theme/palettes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/theme';
import {
  apiGet,
  createSession,
  formatUSD,
  getMessages,
  getProjects,
  loadCreds,
  shortPath,
  type Project,
  type Session,
} from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/lib/prefs';

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.83);

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

type Row = { title: string; meta?: string; icon?: string; color?: string };

function Item({
  row,
  onPress,
  selected,
}: {
  row: Row;
  onPress?: () => void;
  selected?: boolean;
}) {
  const s = useStyles();
  const t = usePalette();
  return (
    <Pressable
      style={[s.item, selected && s.itemSelected]}
      onPress={() => {
        haptic('tap');
        onPress?.();
      }}>
      <Sym name={row.icon ?? 'bubble.left'} size={14} color={row.color ?? t.dim} />
      <Text style={s.itemTitle} numberOfLines={1}>
        {row.title}
      </Text>
      <Text style={[s.itemMeta, row.color === t.warn && { color: t.warn }]}>{row.meta}</Text>
    </Pressable>
  );
}

type Hit = { sessionID: string; title: string; snippet: string };

/** Texto plano de un mensaje, para buscar dentro. */
function plainText(m: { text?: string; content?: { type: string; text?: string }[] }): string {
  const parts = m.content ?? [];
  return [m.text ?? '', ...parts.map((p) => (p.type === 'text' ? (p.text ?? '') : ''))]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStyles();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, model } = usePrefs();
  const x = useRef(new Animated.Value(-WIDTH)).current;
  const scrim = useRef(new Animated.Value(0)).current;

  const [connected, setConnected] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(x, {
        toValue: open ? 0 : -WIDTH,
        useNativeDriver: true,
        bounciness: 0,
        speed: 14,
      }),
      Animated.timing(scrim, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [open, x, scrim]);

  const load = useCallback(async () => {
    setError(null);
    const creds = await loadCreds();
    if (!creds) {
      setConnected(false);
      return;
    }
    setConnected(true);
    try {
      const res = await apiGet<{ data: Session[] }>('/api/session');
      setSessions(res.data ?? []);
      setProjects(await getProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const newSession = useCallback(
    async (directory: string) => {
      if (creating) return;
      setCreating(true);
      setError(null);
      try {
        const ses = await createSession(directory, { agent: prefs.agent, model });
        haptic('success');
        setPicker(false);
        onClose();
        router.push({
          pathname: '/sesion/[id]',
          params: { id: ses.id, title: shortPath(directory) },
        } as never);
      } catch (e) {
        haptic('error');
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCreating(false);
      }
    },
    [creating, onClose, router, prefs.agent, model]
  );

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter(
        (ses) =>
          (ses.title ?? '').toLowerCase().includes(q) ||
          ses.id.toLowerCase().includes(q) ||
          (ses.agent ?? '').toLowerCase().includes(q) ||
          (ses.model?.id ?? '').toLowerCase().includes(q)
      )
    : sessions;

  // Busca también DENTRO de los mensajes de las sesiones recientes.
  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2 || sessions.length === 0) {
      setHits([]);
      setSearching(false);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      const queue = sessions.slice(0, 12);
      const found: Hit[] = [];
      setSearching(true);
      const worker = async () => {
        while (queue.length > 0 && alive) {
          const ses = queue.shift();
          if (!ses) break;
          try {
            const res = await getMessages(ses.id, { limit: 30, order: 'desc' });
            for (const m of res.data) {
              const txt = plainText(m);
              const at = txt.toLowerCase().indexOf(term);
              if (at >= 0) {
                found.push({
                  sessionID: ses.id,
                  title: ses.title?.trim() || `Nueva · ${ses.id.slice(-4)}`,
                  snippet: txt.slice(Math.max(0, at - 28), at + 58).trim(),
                });
                break;
              }
            }
          } catch {
            /* sesión ilegible: la saltamos */
          }
        }
      };
      Promise.all([worker(), worker(), worker()]).then(() => {
        if (!alive) return;
        found.sort((a, b) => a.title.localeCompare(b.title));
        setHits(found);
        setSearching(false);
      });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, sessions]);

  const openSession = (id: string, title: string) => {
    onClose();
    router.push({ pathname: '/sesion/[id]', params: { id, title } } as never);
  };

  return (
    <>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[s.scrim, { opacity: scrim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          s.drawer,
          { transform: [{ translateX: x }], paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 },
        ]}>
        <View style={s.drawerTop}>
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={s.mark}
            resizeMode="contain"
          />
          <View>
            <Text style={s.brand}>nixer</Text>
            <Text style={s.brandSub}>OpenCode Mobile</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Sym name="slider.horizontal.3" size={16} color={t.dim} />
        </View>

        <Pressable
          style={[s.newBtn, { backgroundColor: t.accent }]}
          onPress={() => {
            const dir = projects[0]?.canonical;
            if (!dir) {
              haptic('tap');
              setPicker(true);
              return;
            }
            newSession(dir);
          }}
          onLongPress={() => {
            haptic('tap');
            setPicker(true);
          }}>
          <Sym name="plus" size={15} color={t.ink} />
          <Text style={[s.newBtnText, { color: t.ink }]}>Nueva sesión</Text>
          <View style={{ flex: 1 }} />
          <Text style={[s.newBtnHint, { color: t.ink }]}>mantén ⌄</Text>
        </Pressable>

        <View style={s.search}>
          <Sym name="magnifyingglass" size={14} color={t.dim} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar sesiones y mensajes…"
            placeholderTextColor={t.dim}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color={t.dim} /> : null}
          {query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Sym name="xmark.circle.fill" size={15} color={t.dimSoft} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
          {connected === false ? (
            <Pressable
              style={s.connectCard}
              onPress={() => {
                onClose();
                router.push('/conectar' as never);
              }}>
              <Sym name="wifi.exclamationmark" size={18} color={t.warn} />
              <View style={{ flex: 1 }}>
                <Text style={s.connectTitle}>Sin conexión con el PC</Text>
                <Text style={s.connectSub}>Toca para emparejar</Text>
              </View>
              <Sym name="chevron.right" size={14} color={t.dimSoft} />
            </Pressable>
          ) : null}

          {error ? <Text style={s.error}>{error}</Text> : null}

          {connected ? (
            <>
              <Text style={s.group}>{q ? `Sesiones (${filtered.length})` : 'Sesiones'}</Text>
              {filtered.length === 0 ? (
                <Text style={s.empty}>
                  {q ? `Ningún título coincide con «${query}».` : 'No hay sesiones todavía.'}
                </Text>
              ) : (
                filtered.slice(0, 20).map((ses) => (
                  <Item
                    key={ses.id}
                    onPress={() =>
                      openSession(
                        ses.id,
                        ses.title?.trim() || `Nueva · ${ses.id.slice(-4)}`
                      )
                    }
                    row={{
                      title: ses.title?.trim() || `Nueva · ${ses.id.slice(-4)}`,
                      meta:
                        (ses.cost ?? 0) > 0
                          ? formatUSD(ses.cost)
                          : ses.model?.id ?? ses.agent ?? '',
                      icon: 'bubble.left',
                    }}
                  />
                ))
              )}

              {q.length >= 2 ? (
                <>
                  <Text style={s.group}>
                    {searching ? 'Mensajes · buscando…' : `Mensajes (${hits.length})`}
                  </Text>
                  {!searching && hits.length === 0 ? (
                    <Text style={s.empty}>Sin coincidencias en los mensajes recientes.</Text>
                  ) : (
                    hits.slice(0, 20).map((h) => (
                      <Pressable
                        key={`${h.sessionID}-${h.snippet}`}
                        style={s.hit}
                        onPress={() => {
                          haptic('tap');
                          openSession(h.sessionID, h.title);
                        }}>
                        <Sym name="text.magnifyingglass" size={13} color={t.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.hitTitle} numberOfLines={1}>
                            {h.title}
                          </Text>
                          <Text style={s.hitSnippet} numberOfLines={2}>
                            …{h.snippet}…
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </>
              ) : null}
            </>
          ) : null}

          <Text style={s.group}>Proyectos</Text>
          <Item
            row={{ title: 'Ver proyectos', meta: '', icon: 'folder' }}
            onPress={() => {
              onClose();
              router.push('/proyectos' as never);
            }}
          />
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            style={s.item}
            onPress={() => {
              onClose();
              router.push('/ajustes' as never);
            }}>
            <Sym name="slider.horizontal.3" size={14} color={t.dim} />
            <Text style={s.itemTitle}>Ajustes</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <View style={s.modalRoot}>
          <Pressable style={s.modalScrim} onPress={() => setPicker(false)} />
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>¿En qué proyecto?</Text>
            {projects.length === 0 ? (
              <Text style={s.modalEmpty}>No se han encontrado proyectos.</Text>
            ) : (
              projects.map((p) => (
                <Pressable key={p.id} style={s.modalRow} onPress={() => newSession(p.canonical)}>
                  <Sym name="folder" size={15} color={t.dim} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalRowTitle}>{shortPath(p.canonical)}</Text>
                    <Text style={s.modalRowSub} numberOfLines={1}>
                      {p.canonical}
                    </Text>
                  </View>
                  <Sym name="chevron.right" size={13} color={t.dimSoft} />
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    scrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      zIndex: 10,
    },
    drawer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: WIDTH,
      backgroundColor: t.panel,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: t.line,
      padding: 14,
      zIndex: 11,
    },
    drawerTop: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
    mark: { width: 30, height: 30 },
    brand: { color: t.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.4, lineHeight: 19 },
    brandSub: { color: t.dimSoft, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' },

    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      marginBottom: 10,
    },
    newBtnText: { fontSize: 14, fontWeight: '600' },
    newBtnHint: { fontSize: 11, opacity: 0.72 },

    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginBottom: 4,
    },
    searchText: { color: t.dim, fontSize: 13 },
    searchInput: { flex: 1, color: t.text, fontSize: 13, padding: 0 },

    connectCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      backgroundColor: t.warnBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.warnLine,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
    },
    connectTitle: { color: t.warn, fontSize: 13, fontWeight: '600' },
    connectSub: { color: t.warnText, fontSize: 11.5, marginTop: 2 },

    error: { color: '#fca5a5', fontSize: 11.5, marginTop: 10, marginHorizontal: 6, lineHeight: 16 },
    empty: { color: t.dimSoft, fontSize: 12.5, marginHorizontal: 8, marginTop: 4 },

    group: {
      color: t.dimSoft,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 3,
      marginHorizontal: 6,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 10,
    },
    itemSelected: { backgroundColor: t.panel2 },
    itemTitle: { color: t.textSoft, fontSize: 13.5, flexShrink: 1 },
    itemMeta: { marginLeft: 'auto', color: t.dimSoft, fontSize: 11.5 },

    hit: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 10,
    },
    hitTitle: { color: t.textSoft, fontSize: 13 },
    hitSnippet: { color: t.dimSoft, fontSize: 11.5, marginTop: 2, lineHeight: 15 },

    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.line,
      paddingTop: 6,
    },

    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    modalScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalCard: {
      backgroundColor: t.panel2,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      padding: 16,
      paddingBottom: 30,
      gap: 2,
    },
    modalTitle: { color: t.text, fontSize: 15, fontWeight: '700', marginBottom: 10 },
    modalEmpty: { color: t.dim, fontSize: 13, paddingVertical: 10 },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    modalRowTitle: { color: t.text, fontSize: 14 },
    modalRowSub: { color: t.dimSoft, fontSize: 11, marginTop: 2 },
  });
