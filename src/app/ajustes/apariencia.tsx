import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Sym } from '@/components/settings-row';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/lib/prefs';
import { PALETTES, type Palette } from '@/theme/palettes';
import { ACCENTS, usePalette, useTheme } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function AparienciaScreen() {
  const s = useStyles();
  const t = usePalette();
  const { themeId, setTheme, accentOverride, setAccent, density, setDensity, flat, setFlat } = useTheme();
  const { prefs, set } = usePrefs();

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Apariencia' }} />

      <Text style={s.section}>Temas</Text>
      <View style={s.themes}>
        {PALETTES.map((p) => {
          const on = p.id === themeId;
          return (
            <Pressable
              key={p.id}
              onPress={() => setTheme(p.id)}
              style={[s.tile, { backgroundColor: p.bg, borderColor: on ? t.accent : p.line }, on && s.tileOn]}>
              <View style={[s.tileBar, { backgroundColor: p.accent }]} />
              <View style={[s.tileBar, { backgroundColor: p.text, width: '62%' }]} />
              <View style={[s.tileBar, { backgroundColor: p.dim, width: '44%' }]} />
              {on ? (
                <View style={s.tileCheck}>
                  <Sym name="checkmark" size={13} color={t.accent} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={s.hint}>
        {PALETTES.find((p) => p.id === themeId)?.name ?? 'Midnight'} · {PALETTES.length} temas
      </Text>

      <Text style={s.section}>Color de acento</Text>
      <View style={s.swatches}>
        {ACCENTS.map((a) => {
          const color = a.color || PALETTES.find((p) => p.id === themeId)?.accent || t.accent;
          const on = a.color === '' ? accentOverride === null : accentOverride === a.color;
          return (
            <Pressable
              key={a.id}
              onPress={() => setAccent(a.color || null)}
              style={[s.swatch, { backgroundColor: color }, on && s.swatchOn]}>
              {on ? <Sym name="checkmark" size={16} color="#0d0d10" /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={s.hint}>«Del tema» usa el color propio de cada tema.</Text>

      <Text style={s.section}>Densidad del hilo</Text>
      <View style={s.segment}>
        {(
          [
            ['compact', 'Compacta'],
            ['comfortable', 'Cómoda'],
            ['spacious', 'Amplia'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setDensity(id)}
            style={[s.segItem, density === id && { backgroundColor: t.accent }]}>
            <Text style={[s.segText, density === id && { color: t.ink }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.section}>Estilo de tus mensajes</Text>
      <View style={s.segment}>
        {(
          [
            [false, 'Burbujas'],
            [true, 'Planos'],
          ] as const
        ).map(([val, label]) => (
          <Pressable
            key={label}
            onPress={() => setFlat(val)}
            style={[s.segItem, flat === val && { backgroundColor: t.accent }]}>
            <Text style={[s.segText, flat === val && { color: t.ink }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>Vibración y avisos</Text>
      <View style={s.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowText}>Vibración</Text>
          <Text style={s.rowHint}>Al enviar, aprobar permisos o si algo falla</Text>
        </View>
        <Switch
          value={prefs.haptics}
          onValueChange={(v) => {
            set({ haptics: v });
            haptic('select');
          }}
          trackColor={{ true: t.accent, false: t.line }}
          thumbColor="#ffffff"
        />
      </View>
      <View style={s.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowText}>Vibración al escribir</Text>
          <Text style={s.rowHint}>
            Toques suaves mientras el agente responde, más seguidos cuanto más rápido escribe
          </Text>
        </View>
        <Switch
          value={prefs.typingHaptics}
          onValueChange={(v) => {
            set({ typingHaptics: v });
            haptic('select');
          }}
          disabled={!prefs.haptics}
          trackColor={{ true: t.accent, false: t.line }}
          thumbColor="#ffffff"
        />
      </View>
      <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowText}>Avisos dentro de la app</Text>
          <Text style={s.rowHint}>Banner arriba cuando el agente termina</Text>
        </View>
        <Switch
          value={prefs.inAppNotify}
          onValueChange={(v) => {
            set({ inAppNotify: v });
            haptic('select');
          }}
          trackColor={{ true: t.accent, false: t.line }}
          thumbColor="#ffffff"
        />
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
    section: {
      color: t.dimSoft,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 8,
      marginHorizontal: 4,
    },
    themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: {
      width: '30%',
      aspectRatio: 1.35,
      borderRadius: 12,
      borderWidth: 1,
      padding: 8,
      gap: 5,
      justifyContent: 'center',
    },
    tileOn: { borderWidth: 2 },
    tileBar: { height: 5, borderRadius: 3, width: '80%', opacity: 0.95 },
    tileCheck: { position: 'absolute', top: 5, right: 5 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 2, paddingHorizontal: 2 },
    swatch: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    swatchOn: { borderWidth: 3, borderColor: '#fff' },
    hint: { color: t.dimSoft, fontSize: 11.5, marginTop: 8, marginHorizontal: 4 },
    segment: { flexDirection: 'row', gap: 6, marginTop: 2 },
    segItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      backgroundColor: t.panel2,
    },
    segText: { color: t.textSoft, fontSize: 13, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    rowHint: { color: t.dimSoft, fontSize: 11, marginTop: 3 },
    rowText: { color: t.text, fontSize: 14, flex: 1 },
    rowValue: { color: t.dim, fontSize: 13 },
  });
