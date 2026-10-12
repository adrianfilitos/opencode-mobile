import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SettingsRow } from '@/components/settings-row';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

const MARK = require('@/assets/images/splash-icon.png');
const REPO = 'https://github.com/adrianfilitos/opencode-mobile';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function AcercaScreen() {
  const s = useStyles();
  const t = usePalette();

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Acerca de' }} />

      <View style={s.brand}>
        <Image source={MARK} style={s.mark} resizeMode="contain" />
        <Text style={s.name}>nixer</Text>
        <Text style={s.tag}>OpenCode Mobile</Text>
      </View>

      <SettingsRow icon="info.circle" title="Versión" value="1.0" />
      <SettingsRow title="Servidor" value="v2.0.24" />
      <SettingsRow
        icon="chevron.left.forwardslash.chevron.right"
        title="Código fuente"
        subtitle="adrianfilitos / opencode-mobile"
        chevron
        last
        onPress={() => {
          Linking.openURL(REPO).catch(() => {});
        }}
      />

      <Text style={s.note}>
        Hecho para uso personal. Firmado con Apple ID gratuita: la app caduca cada 7 días y hay que
        renovarla desde el PC.
      </Text>

      <View style={s.footer}>
        <Text style={s.copy}>© 2026</Text>
        <Text style={[s.copy, { color: t.dim }]}>nixer studios</Text>
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
    brand: { alignItems: 'center', paddingVertical: 26, gap: 2 },
    mark: { width: 118, height: 118, marginBottom: 2 },
    name: { color: t.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
    tag: { color: t.dim, fontSize: 12.5, letterSpacing: 2.6, textTransform: 'uppercase' },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 22, marginHorizontal: 4 },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 7,
      marginTop: 30,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.lineSoft,
    },
    copy: { color: t.dimSoft, fontSize: 12 },
  });
