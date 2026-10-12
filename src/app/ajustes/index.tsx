import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SettingsRow } from '@/components/settings-row';
import { loadCreds } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function AjustesMenu() {
  const s = useStyles();
  const router = useRouter();
  const { prefs } = usePrefs();
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    loadCreds()
      .then((c) => setHost(c ? c.baseUrl.replace(/^https?:\/\//, '') : null))
      .catch(() => setHost(null));
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <SettingsRow
        icon="server.rack"
        title="Servidor"
        subtitle={host ?? 'sin configurar'}
        chevron
        onPress={() => router.push('/ajustes/servidor' as never)}
      />
      <SettingsRow
        icon="cpu"
        title="Agente y modelo"
        subtitle={`${prefs.agent} · ${prefs.modelId}`}
        chevron
        onPress={() => router.push('/ajustes/modelo' as never)}
      />
      <SettingsRow
        icon="bolt"
        title="Acciones rápidas"
        subtitle={`${prefs.quickActions.length} guardadas · arriba del teclado`}
        chevron
        onPress={() => router.push('/ajustes/rapidas' as never)}
      />
      <SettingsRow
        icon="paintpalette"
        title="Apariencia"
        subtitle="Temas, color, vibración y avisos"
        chevron
        onPress={() => router.push('/ajustes/apariencia' as never)}
      />
      <SettingsRow
        icon="info.circle"
        title="Acerca de"
        subtitle="OpenCode Mobile 1.0"
        chevron
        last
        onPress={() => router.push('/ajustes/acerca' as never)}
      />
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 14, paddingTop: 6 },
  });
