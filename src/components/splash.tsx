import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

// Icono de OpenCode (centro) y símbolo de nixer (pie)
const OPENCODE = require('@/assets/images/opencode-icon.png');
const NIXER = require('@/assets/images/splash-icon.png');

/**
 * Pantalla de carga:
 * icono de OpenCode centrado y, abajo, `from` + (símbolo + nixer).
 * Regla de la marca: «studios» NO aparece aquí (solo en el ©).
 */
export default function Splash() {
  const t = usePalette();
  const s = useMemo(() => makeStyles(t), [t]);

  const scale = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const foot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 13 }),
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(foot, { toValue: 1, duration: 520, delay: 260, useNativeDriver: true }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.04,
            duration: 1150,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1150,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [scale, opacity, foot, pulse]);

  return (
    <View style={s.root}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Animated.View style={[s.glow, { transform: [{ scale: pulse }] }]}>
          <Image source={OPENCODE} style={s.mark} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[s.foot, { opacity: foot }]}>
        <Text style={s.from}>from</Text>
        <View style={s.lockup}>
          <Image source={NIXER} style={s.markSmall} resizeMode="contain" />
          <Text style={s.name}>nixer</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    // centrado real: el icono va centrado en TODA la pantalla (el pie es absoluto)
    root: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glow: {
      shadowColor: t.accent,
      shadowOpacity: 0.35,
      shadowRadius: 34,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    mark: { width: 128, height: 128, borderRadius: 28 },
    foot: {
      position: 'absolute',
      bottom: 52,
      alignItems: 'center',
      gap: 7,
    },
    from: { color: t.dim, fontSize: 13 },
    lockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    markSmall: { width: 50, height: 50 },
    name: { color: t.text, fontSize: 23, fontWeight: '700', letterSpacing: -0.5 },
  });
