import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatNum, formatUSD, usageColor } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

/**
 * Anillo de contexto: se dibuja SOLO con Views (marcas solapadas que forman un
 * aro continuo). Sin react-native-svg.
 */
function Ring({
  size,
  band,
  percent,
  color,
  track,
  label,
}: {
  size: number;
  band: number;
  percent: number;
  color: string;
  track: string;
  label: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const SEGMENTS = 60;
  const filled = Math.round((p / 100) * SEGMENTS);
  const tickW = band * 0.62;

  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            transform: [{ rotate: `${(360 / SEGMENTS) * i}deg` }],
          }}>
          <View
            style={{
              position: 'absolute',
              left: size / 2 - tickW / 2,
              top: 0,
              width: tickW,
              height: band,
              borderRadius: tickW / 2,
              backgroundColor: i < filled ? color : track,
            }}
          />
        </View>
      ))}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontSize: size * 0.3, fontWeight: '800', color: label }}>{Math.round(p)}</Text>
      </View>
    </View>
  );
}

/**
 * Indicador de contexto/coste para la cabecera del chat.
 * Tocar el anillo abre una tarjeta con Costo / Uso / Tokens.
 */
export default function ContextGauge({
  cost,
  tokens,
  limit,
}: {
  cost?: number;
  tokens?: number;
  limit?: number;
}) {
  const s = useStyles();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const percent = limit && limit > 0 ? Math.min(100, ((tokens ?? 0) / limit) * 100) : 0;
  const color = usageColor(percent, t.ok, t.warn);

  return (
    <>
      <Pressable
        hitSlop={10}
        onPress={() => {
          haptic('tap');
          setOpen(true);
        }}>
        <Ring size={30} band={3.2} percent={percent} color={color} track={t.line} label={t.text} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setOpen(false)}>
          <Pressable style={[s.pop, { top: insets.top + 48 }]} onPress={() => {}}>
            <View style={s.row}>
              <Text style={s.k}>Costo</Text>
              <Text style={s.v}>{formatUSD(cost)}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.k}>Uso</Text>
              <Text style={[s.v, { color }]}>{Math.round(percent)} %</Text>
            </View>
            <View style={s.row}>
              <Text style={s.k}>Tokens</Text>
              <Text style={s.v}>{formatNum(tokens)}</Text>
            </View>

            <View style={s.bar}>
              <View style={[s.barFill, { width: (percent / 100) * 196, backgroundColor: color }]} />
            </View>

            {percent > 85 ? (
              <View style={s.warnRow}>
                <SymbolView name={'exclamationmark.triangle.fill' as never} tintColor="#fca5a5" size={12} />
                <Text style={s.warnText}>Contexto casi lleno · puedes compactar la sesión</Text>
              </View>
            ) : null}

            {limit ? (
              <Text style={s.foot}>de {formatNum(limit)} tokens de contexto</Text>
            ) : (
              <Text style={s.foot}>no sé el límite de este modelo</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    pop: {
      position: 'absolute',
      right: 14,
      width: 224,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 5 },
    k: { color: t.dim, fontSize: 12.5 },
    v: { color: t.text, fontSize: 14, fontWeight: '700' },
    bar: { height: 5, borderRadius: 3, backgroundColor: t.line, marginTop: 9, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
    warnText: { color: '#fca5a5', fontSize: 11, flex: 1, lineHeight: 15 },
    foot: { color: t.dimSoft, fontSize: 10.5, marginTop: 8 },
  });
