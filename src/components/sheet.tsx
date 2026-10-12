import { SymbolView } from 'expo-symbols';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { haptic } from '@/lib/haptics';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';
import type { FileDiff, Part, PermissionRequest } from '@/lib/api';

const WINDOW = Dimensions.get('window');
export const SHEET_H = Math.round(WINDOW.height * 0.5);

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 14, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

type Props = {
  open: boolean;
  onClose: () => void;
  diff?: FileDiff[];
  tools?: Part[];
  perms?: PermissionRequest[];
  onReply?: (req: PermissionRequest, d: 'once' | 'always' | 'reject') => void;
};

function DiffView({ diff }: { diff: FileDiff[] }) {
  const s = useStyles();
  const t = usePalette();
  const [copied, setCopied] = useState<string | null>(null);
  if (!diff || diff.length === 0) return <Text style={s.empty}>Sin cambios en esta sesión.</Text>;
  return (
    <View style={{ gap: 10 }}>
      {diff.map((d) => (
        <View key={d.file} style={s.fileBox}>
          <View style={s.fileHead}>
            <Text style={s.fileName} numberOfLines={1}>
              {d.file}
            </Text>
            <Text style={s.fileMeta}>
              +{d.additions} −{d.deletions}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={async () => {
                await Clipboard.setStringAsync(d.file);
                haptic('tap');
                setCopied(d.file);
                setTimeout(() => setCopied(null), 1200);
              }}>
              <Sym
                name={copied === d.file ? 'checkmark' : 'doc.on.doc'}
                size={12}
                color={copied === d.file ? t.ok : t.dimSoft}
              />
            </Pressable>
          </View>
          {d.patch.split('\n').slice(0, 60).map((l, i) => (
            <Text key={i} style={[s.diffLine, l.startsWith('+') && s.add, l.startsWith('-') && s.del]}>
              {l || ' '}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ToolsView({ tools }: { tools: Part[] }) {
  const s = useStyles();
  const t = usePalette();
  if (!tools || tools.length === 0) return <Text style={s.empty}>Todavía no ha usado herramientas.</Text>;
  return (
    <View>
      {tools.map((tool, i) => {
        const status = tool.state?.status;
        const done = status === 'completed' || status === 'success';
        const failed = status === 'error' || status === 'failed';
        const cmd = typeof tool.state?.input?.command === 'string' ? (tool.state.input.command as string) : '';
        return (
          <View key={tool.id ?? i} style={s.toolRow}>
            <Sym name="wrench.and.screwdriver" size={13} color={t.dim} />
            <View style={{ flex: 1 }}>
              <Text style={s.toolName}>{tool.name}</Text>
              {cmd ? (
                <Text style={s.toolCmd} numberOfLines={1}>
                  {cmd.split('\n')[0]}
                </Text>
              ) : null}
            </View>
            <Sym
              name={failed ? 'xmark' : done ? 'checkmark' : 'ellipsis'}
              size={13}
              color={failed ? '#fca5a5' : done ? t.ok : t.dim}
            />
            {cmd ? (
              <Pressable
                hitSlop={8}
                onPress={async () => {
                  await Clipboard.setStringAsync(cmd);
                  haptic('tap');
                }}>
                <Sym name="doc.on.doc" size={12} color={t.dimSoft} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function PermsView({ perms, onReply }: { perms: PermissionRequest[]; onReply?: Props['onReply'] }) {
  const s = useStyles();
  const t = usePalette();
  if (!perms || perms.length === 0) return <Text style={s.empty}>No hay permisos pendientes.</Text>;
  return (
    <View style={{ gap: 10 }}>
      {perms.map((r) => (
        <View key={r.id} style={s.perm}>
          <Text style={s.permTitle}>{r.action}</Text>
          {r.resources?.length ? <Text style={s.permFile}>{r.resources.join(' · ')}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <Pressable style={[s.permPrimary, { backgroundColor: t.accent }]} onPress={() => onReply?.(r, 'once')}>
              <Text style={[s.permPrimaryText, { color: t.ink }]}>Permitir</Text>
            </Pressable>
            <Pressable style={s.permAlt} onPress={() => onReply?.(r, 'always')}>
              <Text style={s.permAltText}>Siempre</Text>
            </Pressable>
            <Pressable style={s.permGhost} onPress={() => onReply?.(r, 'reject')}>
              <Text style={s.permGhostText}>No</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const TABS = ['diff', 'tools', 'perm'] as const;

export function SheetPeek({
  onPress,
  counts,
}: {
  onPress: () => void;
  counts: { diff: number; tools: number; perm: number };
}) {
  const s = useStyles();
  return (
    <Pressable style={s.peek} onPress={onPress}>
      <View style={s.grab} />
      <View style={s.tabs}>
        <Text style={s.tab}>Diff ·{counts.diff}</Text>
        <Text style={s.tab}>Herramientas ·{counts.tools}</Text>
        <Text style={s.tab}>Permisos ·{counts.perm}</Text>
      </View>
    </Pressable>
  );
}

export default function Sheet({ open, onClose, diff, tools, perms, onReply }: Props) {
  const s = useStyles();
  const t = usePalette();
  const [tab, setTab] = useState<(typeof TABS)[number]>('diff');
  const y = useRef(new Animated.Value(SHEET_H)).current;
  const scrim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(y, { toValue: open ? 0 : SHEET_H, useNativeDriver: true, bounciness: 0, speed: 13 }),
      Animated.timing(scrim, { toValue: open ? 1 : 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [open, y, scrim]);

  useEffect(() => {
    if (open && perms && perms.length > 0) setTab('perm');
  }, [open, perms]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) y.setValue(Math.min(SHEET_H, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 80) onClose();
        else Animated.timing(y, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      },
    })
  ).current;

  const labels: Record<string, string> = {
    diff: `Diff ·${diff?.length ?? 0}`,
    tools: `Herramientas ·${tools?.length ?? 0}`,
    perm: `Permisos ·${perms?.length ?? 0}`,
  };

  return (
    <>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[s.scrim, { opacity: scrim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[s.sheet, { transform: [{ translateY: y }] }]}>
        <View {...pan.panHandlers}>
          <View style={s.grab} />
        </View>

        <View style={s.tabs}>
          {TABS.map((k) => (
            <Pressable key={k} onPress={() => setTab(k)}>
              <Text style={[s.tab, tab === k && { color: t.accent, fontWeight: '600' }]}>{labels[k]}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}>
          {tab === 'diff' ? <DiffView diff={diff ?? []} /> : null}
          {tab === 'tools' ? <ToolsView tools={tools ?? []} /> : null}
          {tab === 'perm' ? <PermsView perms={perms ?? []} onReply={onReply} /> : null}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    peek: {
      backgroundColor: t.panel,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      paddingHorizontal: 12,
    },
    scrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 20,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: SHEET_H,
      backgroundColor: t.panel,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      paddingHorizontal: 12,
      zIndex: 21,
    },
    grab: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.line,
      alignSelf: 'center',
      marginTop: 7,
      marginBottom: 9,
    },
    tabs: {
      flexDirection: 'row',
      gap: 16,
      paddingBottom: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.line,
    },
    tab: { color: t.dim, fontSize: 12.5 },
    empty: { color: t.dimSoft, fontSize: 12.5, paddingVertical: 10 },

    fileBox: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 12,
      overflow: 'hidden',
    },
    fileHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.line,
    },
    fileName: { color: t.textSoft, fontSize: 12, fontFamily: mono, flexShrink: 1 },
    fileMeta: { marginLeft: 'auto', color: t.dimSoft, fontSize: 11 },
    diffLine: { fontFamily: mono, fontSize: 11.5, paddingHorizontal: 10, paddingVertical: 1, color: t.textSoft },
    add: { color: '#a7f3c4', backgroundColor: 'rgba(74,222,128,0.10)' },
    del: { color: '#fca5a5', backgroundColor: 'rgba(248,113,113,0.10)' },

    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    toolName: { color: t.textSoft, fontSize: 13 },
    toolCmd: { color: t.dimSoft, fontSize: 11, fontFamily: mono, marginTop: 2 },

    perm: {
      backgroundColor: t.warnBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.warnLine,
      borderRadius: 13,
      padding: 12,
    },
    permTitle: { color: t.warn, fontSize: 12.5, fontWeight: '700', marginBottom: 4 },
    permFile: { color: t.warnText, fontSize: 11.5, marginBottom: 10, fontFamily: mono },
    permPrimary: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
    permPrimaryText: { fontSize: 12, fontWeight: '600' },
    permAlt: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.warnLine,
      borderRadius: 9,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    permAltText: { color: t.warnText, fontSize: 12, fontWeight: '600' },
    permGhost: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 9,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    permGhostText: { color: t.dim, fontSize: 12, fontWeight: '600' },
  });
