import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';
import { getModels, type Model } from '@/lib/api';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

function ctxLabel(m: Model) {
  const c = m.limit?.context;
  if (!c) return '';
  return c >= 1000000 ? `${Math.round(c / 1000000)}M` : `${Math.round(c / 1000)}k`;
}

function priceLabel(m: Model) {
  const p = m.cost?.[0]?.input;
  if (p === undefined) return '';
  return p === 0 ? 'gratis' : `$${p}/M`;
}

const VARIANT_LABEL: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto' };

export default function ModelPicker({
  visible,
  current,
  onClose,
  onPick,
}: {
  visible: boolean;
  current: { model?: string; variant?: string };
  onClose: () => void;
  onPick: (m: Model, variant?: string) => void;
}) {
  const s = useStyles();
  const t = usePalette();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getModels()
      .then((ms) => setModels(ms.filter((m) => m.enabled !== false)))
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const byProvider = models.reduce<Record<string, Model[]>>((acc, m) => {
    (acc[m.providerID] ??= []).push(m);
    return acc;
  }, {});

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={s.scrim} onPress={onClose} />
        <View style={s.card}>
          <View style={s.grab} />
          <Text style={s.title}>Modelo y razonamiento</Text>

          {loading ? (
            <ActivityIndicator color={t.accent} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 20 }}>
              {Object.entries(byProvider).map(([provider, list]) => (
                <View key={provider}>
                  <Text style={s.group}>{provider}</Text>
                  {list.map((m) => {
                    const selected = current.model === m.id;
                    const open = expanded === m.id;
                    const variants = (m.variants ?? []).map((v) => v.id);
                    return (
                      <View key={m.id}>
                        <Pressable
                          style={s.row}
                          onPress={() => (variants.length > 0 ? setExpanded(open ? null : m.id) : onPick(m, undefined))}>
                          <Sym
                            name={selected ? 'largecircle.fill.circle' : 'circle'}
                            size={16}
                            color={selected ? t.accent : t.dimSoft}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.rowTitle, selected && { color: t.text }]}>{m.name ?? m.id}</Text>
                            <Text style={s.rowSub}>{[ctxLabel(m), priceLabel(m)].filter(Boolean).join(' · ')}</Text>
                          </View>
                          {variants.length > 0 ? (
                            <Sym name={open ? 'chevron.up' : 'chevron.down'} size={13} color={t.dimSoft} />
                          ) : null}
                        </Pressable>

                        {open
                          ? variants.map((v) => {
                              const vSelected = selected && (current.variant ?? '') === v;
                              return (
                                <Pressable key={v} style={[s.row, s.subRow]} onPress={() => onPick(m, v)}>
                                  <Sym
                                    name={vSelected ? 'largecircle.fill.circle' : 'circle'}
                                    size={14}
                                    color={vSelected ? t.accent : t.dimSoft}
                                  />
                                  <Text style={s.subText}>Razonamiento {VARIANT_LABEL[v] ?? v}</Text>
                                </Pressable>
                              );
                            })
                          : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
    card: {
      backgroundColor: t.panel2,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      paddingHorizontal: 16,
      paddingBottom: 34,
    },
    grab: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.line,
      alignSelf: 'center',
      marginTop: 7,
      marginBottom: 10,
    },
    title: { color: t.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
    group: {
      color: t.dimSoft,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 12,
      marginBottom: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    subRow: { paddingLeft: 28, paddingVertical: 10, backgroundColor: t.panel },
    subText: { color: t.textSoft, fontSize: 13.5 },
    rowTitle: { color: t.textSoft, fontSize: 14 },
    rowSub: { color: t.dimSoft, fontSize: 11, marginTop: 2 },
  });
