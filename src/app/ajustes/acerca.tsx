import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SettingsRow } from '@/components/settings-row';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function AcercaScreen() {
  const s = useStyles();
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Acerca de' }} />

      <SettingsRow icon="info.circle" title="OpenCode Mobile" subtitle="versión 1.0" />
      <SettingsRow title="Servidor" value="v2.0.24" />
      <SettingsRow icon="chevron.left.forwardslash.chevron.right" title="Código fuente" chevron last />

      <Text style={s.note}>
        Hecho para uso personal. Firmado con Apple ID gratuita: la app caduca cada 7 días y hay que
        renovarla desde el PC.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
    note: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 22, marginHorizontal: 4 },
  });
