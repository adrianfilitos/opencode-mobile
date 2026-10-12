import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

export default function Splash() {
  const t = usePalette();
  const s = useMemo(() => makeStyles(t), [t]);

  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 9, speed: 13 }),
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        delay: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.07,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [scale, opacity, pulse, textOpacity]);

  return (
    <View style={s.root}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Animated.View style={[s.logo, { transform: [{ scale: pulse }] }]}>
          <SymbolView name={'terminal' as never} tintColor={t.ink} size={38} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center', gap: 6 }}>
        <Text style={s.name}>OpenCode</Text>
        <Text style={s.sub}>Mobile</Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 26,
    },
    logo: {
      width: 96,
      height: 96,
      borderRadius: 26,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.accent,
      shadowOpacity: 0.45,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    name: { color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: 0.3 },
    sub: { color: t.dim, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' },
  });
