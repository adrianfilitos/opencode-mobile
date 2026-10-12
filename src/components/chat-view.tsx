import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Drawer from '@/components/drawer';
import ContextGauge from '@/components/context-gauge';
import FormCard from '@/components/form-card';
import Md from '@/components/md';
import ModelPicker from '@/components/model-picker';
import QuickActions from '@/components/quick-actions';
import SessionMenu from '@/components/session-menu';
import Sheet, { SheetPeek } from '@/components/sheet';
import {
  cancelForm,
  compactSession,
  contextTokens,
  deleteSession,
  forkSession,
  getCommands,
  getForms,
  getMessages,
  getModels,
  getPermissions,
  getSession,
  getSessionDiff,
  getSkills,
  interruptSession,
  renameSession,
  replyForm,
  replyPermission,
  runCommand,
  sendPrompt,
  setSessionModel,
  type CommandInfo,
  type FileDiff,
  type FormInfo,
  type Msg,
  type Part,
  type PermissionRequest,
  type SkillInfo,
} from '@/lib/api';
import { pickFiles, pickImages, takePhoto, type Picked } from '@/lib/attachments';
import { subscribeEvents, useConnection, type ConnState } from '@/lib/events';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette, useTheme } from '@/theme/theme';

const PAGE = 40;

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.text} size={size} />;
}

/** Tres puntos que rebotan, mientras el agente piensa. */
function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.delay(560 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
      }}
    />
  );
}

/** Ruedecita girando (herramienta en curso). */
function Spinner({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: color,
        borderTopColor: 'transparent',
        transform: [
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    />
  );
}

/** Un check que aparece con un pequeño rebote. */
function CheckMark({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 18 }).start();
  }, [v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ scale: v }] }}>
      <Sym name="checkmark" size={13} color={color} />
    </Animated.View>
  );
}

const CONN_COLOR: Record<ConnState, string> = { online: '#4ade80', connecting: '#fbbf24', offline: '#fca5a5' };
const CONN_LABEL: Record<ConnState, string> = {
  online: 'conectado',
  connecting: 'conectando…',
  offline: 'sin conexión',
};

function Header({
  title,
  conn,
  onMenu,
  onMore,
  extra,
}: {
  title: string;
  conn: ConnState;
  onMenu: () => void;
  onMore: () => void;
  extra?: ReactNode;
}) {
  const s = useStyles();
  const t = usePalette();
  return (
    <View style={s.header}>
      <Pressable hitSlop={10} onPress={onMenu}>
        <Sym name="line.3.horizontal" size={20} color={t.dim} />
      </Pressable>
      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable hitSlop={8} style={s.conn} onPress={() => {}}>
        <View style={[s.connDot, { backgroundColor: CONN_COLOR[conn] }]} />
        <Text style={s.connText}>{CONN_LABEL[conn]}</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {extra ? <View style={{ marginRight: 6 }}>{extra}</View> : null}
      <Pressable hitSlop={10} onPress={onMore}>
        <Sym name="ellipsis" size={18} color={t.dim} />
      </Pressable>
    </View>
  );
}

function ModelBar({
  model,
  reasoning,
  onPress,
}: {
  model?: string;
  reasoning?: string;
  onPress?: () => void;
}) {
  const s = useStyles();
  const t = usePalette();
  const [pressed, setPressed] = useState(false);
  const variantLabel =
    reasoning === 'low' ? 'Bajo' : reasoning === 'medium' ? 'Medio' : reasoning === 'high' ? 'Alto' : '—';
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[s.modelBar, pressed && { backgroundColor: t.panel2 }]}>
      <View style={s.modelTop}>
        <Sym name="cpu" size={14} color={t.dim} />
        <View style={s.pill}>
          <Text style={s.pillText}>{model ?? 'sin sesión'}</Text>
        </View>
      </View>
      <View style={s.modelBottom}>
        <Sym name="sparkles" size={12} color={t.dim} />
        <Text style={s.modelBottomText}>
          Razonamiento <Text style={s.modelBottomValue}>{variantLabel}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

function ToolRow({ part }: { part: Part }) {
  const s = useStyles();
  const t = usePalette();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const status = part.state?.status;
  const done = status === 'completed' || status === 'success';
  const failed = status === 'error' || status === 'failed';
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [v]);

  const input: Record<string, unknown> = part.state?.input ?? {};
  const command = typeof input.command === 'string' ? (input.command as string) : '';
  const code = typeof input.code === 'string' ? (input.code as string) : '';
  const inputText =
    command || code || (Object.keys(input).length > 0 ? JSON.stringify(input, null, 2) : '');
  const outputText = (part.state?.content ?? [])
    .map((c) => c.text ?? '')
    .filter((x) => x.length > 0)
    .join('\n');
  const ms =
    part.time?.completed != null && part.time?.ran != null
      ? part.time.completed - part.time.ran
      : undefined;

  async function copy(kind: 'in' | 'out', text: string) {
    await Clipboard.setStringAsync(text);
    haptic('tap');
    setCopied(kind);
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <Animated.View
      style={[
        s.toolWrap,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}>
      <Pressable
        style={s.toolRow}
        onPress={() => {
          haptic('tap');
          setOpen((o) => !o);
        }}>
        <Sym name="wrench.and.screwdriver" size={13} color={t.dim} />
        <Text style={s.toolText} numberOfLines={open ? 2 : 1}>
          {part.name}
          {command ? ` · ${command.split('\n')[0].slice(0, 60)}` : ''}
        </Text>
        <View style={{ flex: 1 }} />
        {failed ? (
          <Sym name="xmark" size={13} color="#fca5a5" />
        ) : done ? (
          <CheckMark color={t.ok} />
        ) : (
          <Spinner color={t.dim} />
        )}
        <Sym name={open ? 'chevron.up' : 'chevron.down'} size={12} color={t.dimSoft} />
      </Pressable>

      {open ? (
        <View style={s.toolBody}>
          {inputText ? (
            <>
              <View style={s.toolHead}>
                <Text style={s.toolLabel}>Entrada</Text>
                <Pressable hitSlop={8} onPress={() => copy('in', inputText)}>
                  <Sym
                    name={copied === 'in' ? 'checkmark' : 'doc.on.doc'}
                    size={12}
                    color={copied === 'in' ? t.ok : t.dimSoft}
                  />
                </Pressable>
              </View>
              <View style={s.codeBox}>
                <Text style={s.codeText} numberOfLines={14}>
                  {inputText}
                </Text>
              </View>
            </>
          ) : null}

          {outputText ? (
            <>
              <View style={s.toolHead}>
                <Text style={s.toolLabel}>Salida</Text>
                <Pressable hitSlop={8} onPress={() => copy('out', outputText)}>
                  <Sym
                    name={copied === 'out' ? 'checkmark' : 'doc.on.doc'}
                    size={12}
                    color={copied === 'out' ? t.ok : t.dimSoft}
                  />
                </Pressable>
              </View>
              <View style={s.codeBox}>
                <Text style={s.codeText} numberOfLines={16}>
                  {outputText}
                </Text>
              </View>
            </>
          ) : done ? (
            <Text style={s.toolEmpty}>Sin salida.</Text>
          ) : null}

          <View style={s.toolMeta}>
            {ms != null ? (
              <Text style={s.metaText}>
                {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}
              </Text>
            ) : null}
            <Text style={s.metaText}>{status ?? ''}</Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

function AssistantBlock({ msg, showHead }: { msg: Msg; showHead: boolean }) {
  const s = useStyles();
  const parts = (msg.content ?? []).filter(
    (p) => (p.type === 'text' && p.text && p.text.trim()) || p.type === 'tool'
  );
  if (parts.length === 0) return null;
  return (
    <View>
      {showHead ? (
        <View style={s.roleHead}>
          <View style={s.dot} />
          <Text style={s.roleText}>
            {msg.agent ?? 'agente'}
            {msg.model?.id ? ` · ${msg.model.id}` : ''}
          </Text>
        </View>
      ) : null}
      {parts.map((p, i) => {
        if (p.type === 'text' && p.text) return <Md key={i}>{p.text}</Md>;
        if (p.type === 'tool') return <ToolRow key={i} part={p} />;
        return null;
      })}
    </View>
  );
}

function PermissionCard({
  perms,
  onReply,
}: {
  perms: PermissionRequest[];
  onReply: (req: PermissionRequest, d: 'once' | 'always' | 'reject') => void;
}) {
  const s = useStyles();
  const t = usePalette();
  const req = perms[0];
  return (
    <View style={s.permCard}>
      <Text style={s.permTitle}>
        {perms.length > 1 ? `⚠ ${perms.length} permisos pendientes` : '⚠ Permiso requerido'}
      </Text>
      <Text style={s.permAction} numberOfLines={2}>
        {req.message?.trim() || req.action}
      </Text>
      {req.resources && req.resources.length > 0 ? (
        <Text style={s.permRes} numberOfLines={2}>
          {req.resources.join(' · ')}
        </Text>
      ) : null}
      <View style={s.permButtons}>
        <Pressable
          style={[s.permPrimary, { backgroundColor: t.accent }]}
          onPress={() => onReply(req, 'once')}>
          <Text style={s.permPrimaryText}>Permitir</Text>
        </Pressable>
        <Pressable style={s.permAlt} onPress={() => onReply(req, 'always')}>
          <Text style={s.permAltText}>Siempre</Text>
        </Pressable>
        <Pressable style={s.permGhost} onPress={() => onReply(req, 'reject')}>
          <Text style={s.permGhostText}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyState() {
  const s = useStyles();
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Sym name="bubble.left.and.text.bubble.right" size={26} color="#5f5f6b" />
      </View>
      <Text style={s.emptyTitle}>Elige una sesión</Text>
      <Text style={s.emptySub}>Abre el ☰ y toca una de tus sesiones del PC.</Text>
    </View>
  );
}

/** Menú para elegir de dónde sacar el adjunto. */
function AttachMenu({
  open,
  busy,
  skills,
  onClose,
  onPick,
}: {
  open: boolean;
  busy: boolean;
  skills: number;
  onClose: () => void;
  onPick: (kind: 'camera' | 'library' | 'file' | 'skill') => void;
}) {
  const s = useStyles();
  const t = usePalette();
  const rows: { kind: 'camera' | 'library' | 'file' | 'skill'; icon: string; label: string; sub: string }[] = [
    { kind: 'camera', icon: 'camera', label: 'Hacer una foto', sub: 'con la cámara' },
    { kind: 'library', icon: 'photo.on.rectangle', label: 'Elegir foto', sub: 'de tu galería (hasta 4)' },
    { kind: 'file', icon: 'doc', label: 'Elegir archivo', sub: 'texto, código, PDF…' },
    {
      kind: 'skill',
      icon: 'sparkles',
      label: 'Usar una skill',
      sub: skills > 0 ? `${skills} disponible${skills === 1 ? '' : 's'}` : 'ninguna instalada',
    },
  ];
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <Pressable style={s.modalScrim} onPress={onClose} />
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Adjuntar</Text>
          {busy ? (
            <View style={s.attachBusy}>
              <ActivityIndicator color={t.accent} />
              <Text style={s.attachBusyText}>Preparando el archivo…</Text>
            </View>
          ) : (
            rows.map((r) => (
              <Pressable key={r.kind} style={s.modalRow} onPress={() => onPick(r.kind)}>
                <Sym name={r.icon} size={16} color={t.dim} />
                <View style={{ flex: 1 }}>
                  <Text style={s.modalRowTitle}>{r.label}</Text>
                  <Text style={s.modalRowSub}>{r.sub}</Text>
                </View>
                <Sym name="chevron.right" size={13} color={t.dimSoft} />
              </Pressable>
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Lista para elegir una skill del servidor. */
function SkillPicker({
  open,
  skills,
  onClose,
  onPick,
}: {
  open: boolean;
  skills: SkillInfo[];
  onClose: () => void;
  onPick: (sk: SkillInfo) => void;
}) {
  const s = useStyles();
  const t = usePalette();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <Pressable style={s.modalScrim} onPress={onClose} />
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Usar una skill</Text>
          <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
            {skills.length === 0 ? (
              <Text style={s.emptySub}>No hay skills instaladas en el servidor.</Text>
            ) : null}
            {skills.map((sk) => (
              <Pressable
                key={sk.id}
                style={s.modalRow}
                onPress={() => {
                  haptic('select');
                  onPick(sk);
                }}>
                <Sym name="sparkles" size={16} color={t.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={s.modalRowTitle}>{sk.name ?? sk.id}</Text>
                  {sk.description ? (
                    <Text style={s.modalRowSub} numberOfLines={2}>
                      {sk.description}
                    </Text>
                  ) : null}
                </View>
                <Sym name="plus.circle" size={16} color={t.dimSoft} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ChatView({ sessionId, title }: { sessionId?: string; title?: string }) {
  const s = useStyles();
  const t = usePalette();
  const { density, flat } = useTheme();
  const { prefs, set } = usePrefs();
  const conn = useConnection();
  const gap = density === 'compact' ? 6 : density === 'spacious' ? 18 : 12;
  const radius = density === 'compact' ? 12 : density === 'spacious' ? 20 : 16;
  const router = useRouter();

  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sessionMenu, setSessionMenu] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attBusy, setAttBusy] = useState(false);
  const [att, setAtt] = useState<Picked[]>([]);
  const [pickedSkills, setPickedSkills] = useState<SkillInfo[]>([]);
  const [skillPicker, setSkillPicker] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [cmds, setCmds] = useState<CommandInfo[]>([]);

  const [page, setPage] = useState<Msg[]>([]); // últimos mensajes (orden ascendente)
  const [older, setOlder] = useState<Msg[]>([]); // páginas antiguas ya cargadas
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [perms, setPerms] = useState<PermissionRequest[]>([]);
  const [forms, setForms] = useState<FormInfo[]>([]);
  const [diff, setDiff] = useState<FileDiff[]>([]);
  const [cost, setCost] = useState<number | undefined>(undefined);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<{ id: string; text: string } | null>(null);
  const [thinking, setThinking] = useState(false);

  const scroller = useRef<ScrollView>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressScroll = useRef(false);

  // Deslizar hacia la derecha desde el borde izquierdo abre el menú ☰
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.x0 < 44 && g.dx > 14 && Math.abs(g.dy) < 34,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 60) {
          haptic('tap');
          setMenu(true);
        }
      },
    })
  ).current;

  /** Trae la página más reciente y actualiza permisos y diff. */
  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const first = await getMessages(sessionId, { limit: PAGE, order: 'desc' });
      setPage([...first.data].reverse());
      setCursor((prev) => prev ?? first.cursor.next ?? null);
      setHasMore((prev) => prev || !!first.cursor.next);
      try {
        setPerms(await getPermissions(sessionId));
      } catch {
        setPerms([]);
      }
      try {
        setForms(await getForms(sessionId));
      } catch {
        setForms([]);
      }
      try {
        const ses = await getSession(sessionId);
        setCost(ses?.cost);
      } catch {
        setCost(undefined);
      }
      try {
        setDiff(await getSessionDiff(sessionId));
      } catch {
        setDiff([]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  /** Al cambiar de sesión: todo a cero. */
  useEffect(() => {
    if (!sessionId) return;
    setPage([]);
    setOlder([]);
    setCursor(null);
    setHasMore(false);
    setAtt([]);
    setLoading(true);
    load();
    poll.current = setInterval(load, 8000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [sessionId, load]);

  const loadMore = useCallback(async () => {
    if (!sessionId || !cursor || loadingMore) return;
    setLoadingMore(true);
    suppressScroll.current = true;
    try {
      const prev = await getMessages(sessionId, { limit: PAGE, cursor });
      setOlder((list) => [...[...prev.data].reverse(), ...list]);
      setCursor(prev.cursor.next ?? null);
      setHasMore(!!prev.cursor.next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [sessionId, cursor, loadingMore]);

  useEffect(() => {
    if (!sessionId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        load();
      }, 300);
    };

    const unsub = subscribeEvents((e) => {
      const d = e.data;
      if (d?.sessionID && d.sessionID !== sessionId) return;
      switch (e.type) {
        case 'session.text.started':
          setStream({ id: d?.assistantMessageID ?? 'stream', text: '' });
          break;
        case 'session.text.delta':
          if (typeof d?.delta === 'string') {
            const id = d?.assistantMessageID ?? 'stream';
            setStream((p) => ({ id, text: (p && p.id === id ? p.text : '') + d?.delta }));
          }
          break;
        case 'session.reasoning.started':
          setThinking(true);
          break;
        case 'session.reasoning.ended':
          setThinking(false);
          break;
        case 'session.text.ended':
          setThinking(false);
          schedule();
          break;
        case 'session.execution.succeeded':
        case 'session.execution.failed':
          setThinking(false);
          setStream(null);
          schedule();
          break;
        case 'form.created':
        case 'form.replied':
        case 'form.cancelled':
          schedule();
          break;
        default:
          schedule();
      }
    });

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, load]);

  /** Si vuelve la conexión, refrescamos. */
  useEffect(() => {
    if (conn === 'online') load();
  }, [conn, load]);

  /** Límites de contexto por modelo (para el % del anillo). Una sola vez. */
  useEffect(() => {
    getModels()
      .then((list) => {
        const map: Record<string, number> = {};
        for (const m of list) {
          const ctx = m.limit?.context;
          if (ctx) map[`${m.providerID}/${m.id}`] = ctx;
        }
        setLimits(map);
      })
      .catch(() => {});
  }, []);

  /** Comandos y skills del servidor (para «/» y para adjuntar). Una sola vez. */
  useEffect(() => {
    const load2 = () => {
      getCommands()
        .then(setCmds)
        .catch(() => {});
      getSkills()
        .then(setSkills)
        .catch(() => {});
    };
    load2();
  }, []);

  const msgs = useMemo(() => {
    const ids = new Set(page.map((m) => m.id));
    return [...older.filter((m) => !ids.has(m.id)), ...page];
  }, [older, page]);

  const info = useMemo(() => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const mm = msgs[i].model;
      if (mm?.id) return { model: mm.id, variant: mm.variant, providerID: mm.providerID };
    }
    return { model: undefined, variant: undefined, providerID: undefined };
  }, [msgs]);

  const working = useMemo(() => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.type === 'user') return true;
      if (m.type === 'assistant') return !m.finish;
    }
    return false;
  }, [msgs]);

  const tools = useMemo(
    () => msgs.flatMap((m) => m.content ?? []).filter((p) => p.type === 'tool'),
    [msgs]
  );

  /** Tokens que ocupa el contexto: los de la ÚLTIMA respuesta del agente. */
  const ctxTokens = useMemo(() => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.type === 'assistant' && m.tokens) return contextTokens(m.tokens);
    }
    return 0;
  }, [msgs]);

  /** Límite de contexto del modelo de la sesión (para el % del anillo). */
  const modelLimit =
    info.providerID && info.model ? limits[`${info.providerID}/${info.model}`] : undefined;

  const busy = working || !!stream?.text || thinking;
  const canSend = !!sessionId && (draft.trim().length > 0 || att.length > 0) && !sending;

  // modo comando: «/» sin espacios todavía
  const cmdQuery = draft.startsWith('/') && !/\s/.test(draft) ? draft.slice(1).toLowerCase() : null;
  const cmdMatches =
    cmdQuery === null
      ? []
      : cmds.filter((c) => c.name.toLowerCase().startsWith(cmdQuery)).slice(0, 5);

  async function stop() {
    if (!sessionId) return;
    haptic('tap');
    try {
      await interruptSession(sessionId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function send() {
    if (!sessionId || !canSend) return;
    const raw = draft.trim();
    const text = raw || 'Mira el adjunto.';
    const files = att.map(({ uri, name }) => ({ uri, name }));
    const skillIds = pickedSkills.map((sk) => ({ id: sk.id }));
    const delivery = prefs.steer ? ('steer' as const) : undefined;

    // ¿es un comando?  →  /nombre args
    const m = raw.match(/^\/([a-zA-Z0-9._-]+)\s*([\s\S]*)$/);
    const cmd = m ? cmds.find((c) => c.name === m[1]) : undefined;

    setDraft('');
    setAtt([]);
    setPickedSkills([]);
    setSending(true);
    haptic('tap');
    try {
      if (cmd) {
        await runCommand(sessionId, cmd.name, m?.[2] ?? '', { files, skills: skillIds, delivery });
      } else {
        await sendPrompt(sessionId, text, files, { skills: skillIds, delivery });
      }
      await load();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function addAttachment(kind: 'camera' | 'library' | 'file' | 'skill') {
    setAttachOpen(false);
    if (kind === 'skill') {
      setSkillPicker(true);
      return;
    }
    setAttBusy(true);
    try {
      const picked =
        kind === 'camera' ? await takePhoto() : kind === 'library' ? await pickImages() : await pickFiles();
      if (picked.length > 0) {
        setAtt((list) => [...list, ...picked].slice(0, 6));
        haptic('select');
      }
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAttBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']} {...swipe.panHandlers}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header
          title={title ?? 'OpenCode'}
          conn={conn}
          extra={<ContextGauge cost={cost} tokens={ctxTokens} limit={modelLimit} />}
          onMenu={() => {
            haptic('tap');
            setMenu(true);
          }}
          onMore={() => sessionId && setSessionMenu(true)}
        />
        <ModelBar model={info.model} reasoning={info.variant} onPress={() => sessionId && setPickerOpen(true)} />

        {sessionId ? (
          <ScrollView
            ref={scroller}
            style={{ flex: 1 }}
            contentContainerStyle={[s.thread, { gap }]}
            keyboardDismissMode="interactive"
            maintainVisibleContentPosition={older.length > 0 ? { minIndexForVisible: 1 } : undefined}
            onContentSizeChange={() => {
              if (suppressScroll.current) {
                suppressScroll.current = false;
                return;
              }
              scroller.current?.scrollToEnd({ animated: false });
            }}>
            {error ? <Text style={s.error}>{error}</Text> : null}
            {loading && page.length === 0 ? <ActivityIndicator color={t.accent} /> : null}

            {hasMore ? (
              <Pressable style={s.moreBtn} onPress={loadMore} disabled={loadingMore}>
                <Text style={s.moreText}>
                  {loadingMore ? 'cargando…' : '↑ Ver mensajes anteriores'}
                </Text>
              </Pressable>
            ) : null}

            {msgs.map((m, idx) => {
              if (m.type === 'user') {
                return (
                  <View key={m.id} style={s.userRow}>
                    {flat ? (
                      <Text style={[s.flatText, { color: t.accent }]}>{m.text}</Text>
                    ) : (
                      <View style={[s.bubble, { backgroundColor: t.accent, borderRadius: radius }]}>
                        <Text style={[s.bubbleText, { color: t.ink }]}>{m.text}</Text>
                      </View>
                    )}
                  </View>
                );
              }
              if (m.type === 'assistant') {
                const prev = msgs[idx - 1];
                const showHead = !prev || prev.type !== 'assistant';
                return <AssistantBlock key={m.id} msg={m} showHead={showHead} />;
              }
              return null;
            })}

            {stream && stream.text ? (
              <View>
                <View style={s.roleHead}>
                  <View style={s.dot} />
                  <Text style={s.roleText}>{info.model ?? 'agente'}</Text>
                </View>
                <Md>{stream.text + ' ▍'}</Md>
              </View>
            ) : thinking ? (
              <View>
                <View style={s.roleHead}>
                  <View style={s.dot} />
                  <Text style={s.roleText}>{info.model ?? 'agente'}</Text>
                </View>
                <View style={s.thinkingRow}>
                  <Dot delay={0} color={t.dim} />
                  <Dot delay={160} color={t.dim} />
                  <Dot delay={320} color={t.dim} />
                  <Text style={s.thinking}>pensando</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <EmptyState />
        )}

        {sessionId && forms.length > 0
          ? forms.map((f) => (
              <FormCard
                key={f.id}
                form={f}
                onReply={async (answer) => {
                  try {
                    await replyForm(sessionId, f.id, answer);
                    setForms((list) => list.filter((x) => x.id !== f.id));
                    load();
                  } catch (e) {
                    haptic('error');
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                onCancel={async () => {
                  try {
                    await cancelForm(sessionId, f.id);
                    setForms((list) => list.filter((x) => x.id !== f.id));
                    load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              />
            ))
          : null}

        {sessionId && perms.length > 0 ? (
          <PermissionCard
            perms={perms}
            onReply={async (req, decision) => {
              haptic(decision === 'reject' ? 'warning' : 'success');
              try {
                await replyPermission(sessionId, req.id, decision);
                setPerms((p) => p.filter((x) => x.id !== req.id));
                load();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          />
        ) : null}

        {sessionId ? (
          <QuickActions
            actions={prefs.quickActions}
            onPick={(a) => {
              haptic('select');
              setDraft((d) => (d.trim() ? `${d.trim()}\n${a.text}` : a.text));
            }}
            onEdit={() => router.push('/ajustes/rapidas' as never)}
          />
        ) : null}

        {sessionId ? (
          <View style={s.composerWrap}>
            {att.length > 0 || pickedSkills.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.attRow}>
                {pickedSkills.map((sk, i) => (
                  <View key={`sk-${sk.id}-${i}`} style={s.attChip}>
                    <Sym name="sparkles" size={13} color={t.accent} />
                    <Text style={s.attName} numberOfLines={1}>
                      {sk.name ?? sk.id}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        haptic('tap');
                        setPickedSkills((l) => l.filter((_, idx) => idx !== i));
                      }}>
                      <Sym name="xmark.circle.fill" size={15} color={t.dimSoft} />
                    </Pressable>
                  </View>
                ))}
                {att.map((a, i) => (
                  <View key={`${a.name}-${i}`} style={s.attChip}>
                    {a.kind === 'image' ? (
                      <Image source={{ uri: a.uri }} style={s.attThumb} />
                    ) : (
                      <Sym name="doc" size={14} color={t.dim} />
                    )}
                    <Text style={s.attName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        haptic('tap');
                        setAtt((list) => list.filter((_, idx) => idx !== i));
                      }}>
                      <Sym name="xmark.circle.fill" size={15} color={t.dimSoft} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {cmdMatches.length > 0 ? (
              <View style={s.cmdCard}>
                {cmdMatches.map((c) => (
                  <Pressable
                    key={c.name}
                    style={s.cmdRow}
                    onPress={() => {
                      haptic('select');
                      setDraft(`/${c.name} `);
                    }}>
                    <Text style={s.cmdName}>/{c.name}</Text>
                    {c.description ? (
                      <Text style={s.cmdDesc} numberOfLines={1}>
                        {c.description}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {busy ? (
              <Pressable
                style={s.steerRow}
                onPress={() => {
                  haptic('select');
                  set({ steer: !prefs.steer });
                }}>
                <View style={[s.swTrack, prefs.steer && { backgroundColor: t.accent }]}>
                  <View style={[s.swKnob, prefs.steer && { left: 16 }]} />
                </View>
                <Text style={s.steerText}>
                  {prefs.steer ? 'Se enviará sin interrumpir' : 'Se enviará al terminar'}
                </Text>
              </Pressable>
            ) : null}

            <View style={s.composer}>
              <View style={s.composerBox}>
                <TextInput
                  style={s.composerInput}
                  placeholder="Escribe…"
                  placeholderTextColor={t.dim}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                />
                <Pressable
                  style={s.inerBtn}
                  onPress={() => {
                    haptic('tap');
                    setAttachOpen(true);
                  }}>
                  {attBusy ? (
                    <ActivityIndicator size="small" color={t.dim} />
                  ) : (
                    <Sym name="paperclip" size={16} color={att.length > 0 ? t.accent : t.dimSoft} />
                  )}
                </Pressable>
                <Pressable
                  style={[s.inerBtn, s.inerSend, (!busy && !canSend) || sending ? { opacity: 0.5 } : null]}
                  onPress={busy ? stop : send}
                  disabled={sending || (!busy && !canSend)}>
                  <Sym name={busy ? 'stop.fill' : 'arrow.up'} size={14} color={t.ink} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <SheetPeek
          onPress={() => setSheetOpen(true)}
          counts={{ diff: diff.length, tools: tools.length, perm: perms.length }}
        />
      </KeyboardAvoidingView>

      <Drawer open={menu} onClose={() => setMenu(false)} />
      <AttachMenu
        open={attachOpen}
        busy={attBusy}
        skills={skills.length}
        onClose={() => setAttachOpen(false)}
        onPick={addAttachment}
      />
      <SkillPicker
        open={skillPicker}
        skills={skills}
        onClose={() => setSkillPicker(false)}
        onPick={(sk) => {
          setSkillPicker(false);
          setPickedSkills((l) => (l.some((x) => x.id === sk.id) ? l : [...l, sk]));
        }}
      />
      <ModelPicker
        visible={pickerOpen}
        current={info}
        onClose={() => setPickerOpen(false)}
        onPick={async (m, variant) => {
          setPickerOpen(false);
          if (!sessionId) return;
          haptic('select');
          try {
            await setSessionModel(sessionId, { id: m.id, providerID: m.providerID, variant });
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      />
      <SessionMenu
        visible={sessionMenu}
        title={title ?? 'Sesión'}
        onClose={() => setSessionMenu(false)}
        onReview={() => {
          setSessionMenu(false);
          if (sessionId) {
            router.push({ pathname: '/revision', params: { id: sessionId } } as never);
          }
        }}
        onRevert={() => {
          setSessionMenu(false);
          if (sessionId) {
            router.push({ pathname: '/revert', params: { id: sessionId } } as never);
          }
        }}
        onRename={async (nt) => {
          setSessionMenu(false);
          if (!sessionId) return;
          try {
            await renameSession(sessionId, nt);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
        onFork={async () => {
          setSessionMenu(false);
          if (!sessionId) return;
          try {
            const forked = await forkSession(sessionId);
            if (forked?.id) {
              router.push({
                pathname: '/sesion/[id]',
                params: { id: forked.id, title: `${title ?? 'Sesión'} (fork)` },
              } as never);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
        onCompact={async () => {
          setSessionMenu(false);
          if (!sessionId) return;
          try {
            await compactSession(sessionId);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
        onDelete={async () => {
          setSessionMenu(false);
          if (!sessionId) return;
          try {
            await deleteSession(sessionId);
            router.back();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      />
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        diff={diff}
        tools={tools}
        perms={perms}
        onReply={async (req, decision) => {
          if (!sessionId) return;
          haptic(decision === 'reject' ? 'warning' : 'success');
          try {
            await replyPermission(sessionId, req.id, decision);
            setPerms((p) => p.filter((x) => x.id !== req.id));
            load();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      />
    </SafeAreaView>
  );
}

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { color: t.text, fontSize: 16, fontWeight: '600', maxWidth: '46%' },
    conn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    connDot: { width: 7, height: 7, borderRadius: 4 },
    connText: { color: t.dimSoft, fontSize: 10.5 },

    modelBar: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      gap: 3,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.line,
    },
    modelTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    pill: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 2,
    },
    pillText: { color: t.text, fontSize: 13, fontWeight: '600' },
    modelBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    modelBottomText: { color: t.dim, fontSize: 11.5 },
    modelBottomValue: { color: t.textSoft, fontWeight: '600' },

    thread: { padding: 14, gap: 12, paddingBottom: 24, flexGrow: 1, justifyContent: 'flex-end' },
    userRow: { alignItems: 'flex-end' },
    bubble: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      maxWidth: '82%',
    },
    bubbleText: { fontSize: 14 },
    flatText: { fontSize: 14, textAlign: 'right', maxWidth: '85%' },

    roleHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9, marginTop: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.ok },
    roleText: { color: t.dim, fontSize: 12 },

    moreBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 },
    moreText: { color: t.accent, fontSize: 12.5, fontWeight: '600' },

    toolWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.lineSoft,
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    toolText: { color: t.dim, fontSize: 12.5, flexShrink: 1 },
    toolBody: { paddingBottom: 10 },
    toolHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      marginBottom: 5,
    },
    toolLabel: {
      color: t.dimSoft,
      fontSize: 10.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    codeBox: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    codeText: { color: t.textSoft, fontSize: 11.5, fontFamily: mono, lineHeight: 16 },
    toolMeta: { flexDirection: 'row', gap: 12, marginTop: 7 },
    metaText: { color: t.dimSoft, fontSize: 10.5 },
    toolEmpty: { color: t.dimSoft, fontSize: 11.5, marginTop: 4 },

    thinking: { color: t.dim, fontSize: 13, fontStyle: 'italic', marginLeft: 6 },
    thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
    emptyIcon: {
      width: 70,
      height: 70,
      borderRadius: 20,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { color: t.text, fontSize: 17, fontWeight: '700' },
    emptySub: { color: t.dim, fontSize: 13, textAlign: 'center', maxWidth: 250, lineHeight: 19 },

    permCard: {
      marginHorizontal: 13,
      marginBottom: 8,
      backgroundColor: t.warnBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.warnLine,
      borderRadius: 14,
      padding: 12,
    },
    permTitle: { color: t.warn, fontSize: 13, fontWeight: '700', marginBottom: 4 },
    permAction: { color: t.textSoft, fontSize: 13, lineHeight: 18 },
    permRes: { color: t.warnText, fontSize: 11.5, marginTop: 4, fontFamily: mono },
    permButtons: { flexDirection: 'row', gap: 8, marginTop: 11 },
    permPrimary: { borderRadius: 9, paddingHorizontal: 16, paddingVertical: 9 },
    permPrimaryText: { color: t.ink, fontSize: 12.5, fontWeight: '600' },
    permAlt: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.warnLine,
      borderRadius: 9,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    permAltText: { color: t.warnText, fontSize: 12.5, fontWeight: '600' },
    permGhost: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 9,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    permGhostText: { color: t.dim, fontSize: 12.5, fontWeight: '600' },

    composerWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.line,
    },
    attRow: { gap: 8, paddingHorizontal: 13, paddingTop: 10 },
    attChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 9,
      paddingVertical: 6,
      maxWidth: 210,
    },
    attThumb: { width: 22, height: 22, borderRadius: 5 },
    attName: { color: t.textSoft, fontSize: 12, flexShrink: 1 },

    composer: { paddingHorizontal: 13, paddingVertical: 10 },
    cmdCard: {
      marginHorizontal: 13,
      marginBottom: 6,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    cmdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    cmdName: { color: t.accent, fontSize: 13, fontWeight: '700', fontFamily: mono },
    cmdDesc: { color: t.dim, fontSize: 11.5, flex: 1 },
    steerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    swTrack: {
      width: 34,
      height: 20,
      borderRadius: 10,
      backgroundColor: t.line,
      justifyContent: 'center',
    },
    swKnob: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#fff',
      position: 'absolute',
      left: 2,
    },
    steerText: { color: t.dim, fontSize: 11.5 },
    composerBox: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 20,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 6,
      minHeight: 46,
    },
    composerInput: {
      flex: 1,
      color: t.text,
      fontSize: 14,
      paddingTop: 8,
      paddingBottom: 8,
      maxHeight: 120,
    },
    inerBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inerSend: { backgroundColor: t.accent },

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
    },
    modalTitle: { color: t.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    modalRowTitle: { color: t.text, fontSize: 14 },
    modalRowSub: { color: t.dimSoft, fontSize: 11, marginTop: 2 },
    attachBusy: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
    attachBusyText: { color: t.dim, fontSize: 13 },
  });
