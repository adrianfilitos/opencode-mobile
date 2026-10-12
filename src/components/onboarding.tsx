import * as SecureStore from 'expo-secure-store';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

export const ONBOARDED_KEY = 'oc.onboarded.v1';

function Sym({ name, size = 22, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.ink} size={size} />;
}

const SLIDES = [
  {
    icon: 'terminal',
    title: 'OpenCode en tu bolsillo',
    text: 'Habla con tu agente, sigue las sesiones y aprueba permisos desde el iPhone, sin volver a la silla.',
  },
  {
    icon: 'bubble.left.and.text.bubble.right',
    title: 'Todo lo que ya usas',
    text: 'Conversaciones en vivo, permisos con un toque y todas tus sesiones y proyectos.',
  },
  {
    icon: 'wifi',
    title: 'Solo necesitas tu PC',
    text: 'La app se conecta a OpenCode, que corre en tu ordenador. Los dos en la misma Wi-Fi.',
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const t = usePalette();
  const s = useMemo(() => makeStyles(t), [t]);
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  async function finish() {
    try {
      await SecureStore.setItemAsync(ONBOARDED_KEY, '1');
    } catch {
      /* da igual */
    }
    onDone();
  }

  return (
    <View style={s.root}>
      <View style={s.mid}>
        <View style={[s.logo, { backgroundColor: t.accent }]}>
          <Sym name={slide.icon} size={30} color={t.ink} />
        </View>
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.text}>{slide.text}</Text>
      </View>

      <View style={s.footer}>
        <View style={s.dots}>
          {SLIDES.map((_, idx) => (
            <View key={idx} style={[s.dot, idx === i && { width: 20, borderRadius: 4, backgroundColor: t.accent }]} />
          ))}
        </View>
        <Pressable style={[s.cta, { backgroundColor: t.accent }]} onPress={() => (last ? finish() : setI(i + 1))}>
          <Text style={[s.ctaText, { color: t.ink }]}>{last ? 'Empezar' : 'Continuar'}</Text>
        </Pressable>
        {!last ? (
          <Pressable onPress={finish}>
            <Text style={s.skip}>Saltar</Text>
          </Pressable>
        ) : (
          <Text style={s.skip}> </Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 30, paddingVertical: 50 },
    mid: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    logo: { width: 76, height: 76, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { color: t.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    text: { color: t.dim, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
    footer: { alignItems: 'center', gap: 16 },
    dots: { flexDirection: 'row', gap: 7, alignItems: 'center' },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.line },
    cta: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    ctaText: { fontSize: 15.5, fontWeight: '600' },
    skip: { color: t.dimSoft, fontSize: 13.5, height: 18 },
  });
